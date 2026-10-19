import { FeedItem, TopicTag, TopicTagSchema } from '../domain/types';
import {
  callAiModel,
  AiCredentials,
  loadAiCredentials,
  hasAiConfiguration,
  AiCredentialsMissingError,
  AiBudgetExceededError
} from '../ai/atmenAiClient';
import { AiHttpError } from '../ai/aiTransport';
import { z } from 'zod';
import { EnrichmentCache, StorageDriverCacheStorage, CacheKeyParams } from './cache';
import { pureJsSha256 } from '../ingestion/normalizer';
import { EnrichmentUsageLedger, defaultUsageLedger } from './ledger';
import { synthesizeDidacticTransfer } from '../synthesis/backgroundResearchPipeline';

export interface BatchEnrichmentItemInput {
  id: string;
  title: string;
  subtitle?: string;
  body: string;
  publisher?: string;
  currentTopic: TopicTag;
}

export interface EnrichedItemData {
  id: string;
  curationScore: number;
  rejectionReason?: string;
  feedText: string;
  keyInsight: string;
  primaryTopic: TopicTag;
  topics: TopicTag[];
  didacticTransfer: string;
}

export type CurationErrorClass =
  | 'no_credentials'
  | 'budget_exceeded'
  | 'auth_error'
  | 'rate_limit'
  | 'model_not_found'
  | 'timeout'
  | 'network_error'
  | 'response_invalid'
  | 'no_approved_candidates'
  | 'cache_only'
  | 'local_fallback';

export interface BatchCurationReport {
  candidateCount: number;
  approvedCount: number;
  rejectedCount: number;
  usedAI: boolean;
  usedFallback: boolean;
  cacheHits: number;
  errorClass?: CurationErrorClass;
  errorMessage?: string;
  modelUsed?: string;
}

const BATCH_PROMPT_VERSION = 'curation-v2';
const BatchDecisionSchema = z.object({
  id: z.string().min(1),
  curationScore: z.number().min(0).max(10),
  rejectionReason: z.string().max(1000).optional(),
  feedText: z.string().max(10000).default(''),
  keyInsight: z.string().max(2000).default(''),
  primaryTopic: TopicTagSchema,
  topics: z.array(TopicTagSchema).max(3).default([]),
  didacticTransfer: z.string().max(4000).default('')
});

export interface GatekeeperEvaluation {
  score: number; // 0 to 10
  passed: boolean; // score >= 7
  reason: string;
}

export const VALID_TOPICS: TopicTag[] = [
  'philosophy_ethics',
  'german_didactics',
  'ai_apple',
  'contemplation_mind',
  'science_society',
  'sound_synthesis',
  'memes_satire',
  'youtube_gems',
  'book_mastery',
  'health_biohacking',
  'opportunities_growth',
  'art_aesthetics'
];

/**
 * Detects whether the predominant language of a text is German or English.
 */
export function detectLanguage(text: string): 'de' | 'en' {
  const englishWords = /\b(the|is|and|of|to|in|for|with|that|this|from|by|on|at|as|an|are|be|has|have|it|we|you|not|or)\b/gi;
  const germanWords = /\b(der|die|das|und|ist|von|zu|im|für|mit|dass|dies|aus|bei|am|als|eine|einer|eines|einem|einen|wurde|wird|nicht|auf|sich)\b/gi;
  const enCount = (text.match(englishWords) || []).length;
  const deCount = (text.match(germanWords) || []).length;
  return enCount > deCount ? 'en' : 'de';
}

/**
 * Calculates the exact text that FeedCard will render for an item's body,
 * taking into account boilerplate suppression (e.g. Hacker News stubs).
 */
export function getCardRenderableText(item: {
  feedText?: string;
  body?: string;
  format?: string;
  space?: string;
  primaryTopic?: string;
  memeMeta?: any;
}): string {
  const displayFeedText =
    item.feedText && item.feedText.trim().length > 0 ? item.feedText.trim() : (item.body || '').trim();
  if (!displayFeedText) return '';
  const lower = displayFeedText.toLowerCase();
  if (
    lower.startsWith('diskutiert auf hacker news') ||
    lower.startsWith('aktuelle fachdiskussion auf hacker news') ||
    lower.startsWith('top-thema auf hacker news')
  ) {
    return '';
  }
  const isMemeCard = item.format === 'meme' || item.space === 'c/memes' || item.primaryTopic === 'memes_satire' || Boolean(item.memeMeta);
  if (isMemeCard) {
    if (item.memeMeta?.punchline && displayFeedText.trim() === item.memeMeta.punchline.trim()) {
      return '';
    }
    if (lower.includes('originalbeitrag veröffentlicht bei')) {
      return '';
    }
  }
  return displayFeedText;
}

/**
 * Directive 1: Hard Substance Gate & Zero Empty Cards Contract
 * Guarantees that any item admitted into a curated selection has at least 120 characters
 * of non-boilerplate substantive prose and a valid key insight.
 */
export function satisfiesCuratedBodyContract(item: FeedItem): boolean {
  // Visual formats (memes, comics, art showcases) carry their value in image / punchline
  const isVisual =
    item.format === 'art_showcase' ||
    item.format === 'meme' ||
    item.format === 'comic' ||
    item.space === 'c/memes' ||
    item.space === 'c/kunst_galerie' ||
    item.primaryTopic === 'memes_satire';

  if (isVisual) {
    return true;
  }

  const renderableText = getCardRenderableText(item);
  if (renderableText.length < 120) {
    return false;
  }

  const hasInsight = Boolean((item.keyInsight || item.subtitle || '').trim());
  if (!hasInsight) {
    return false;
  }

  return true;
}

/**
 * Deterministic Signal-vs-Noise evaluation for offline and unconfigured fallback.
 * Evaluates incoming raw items (Title + Publisher + Snippet) for intellectual depth,
 * substance, and absence of clickbait/shopping/daily-politics triviality (Score 0–10).
 * Threshold: score >= 7 passes; score < 7 is filtered out.
 */
export function evaluateSignalVsNoiseDeterministically(
  item: {
    title: string;
    subtitle?: string;
    body?: string;
    feedText?: string;
    publisher?: string;
    format?: string;
    sourceTrustLevel?: string;
    space?: string;
    primaryTopic?: string;
  }
): GatekeeperEvaluation {
  const title = (item.title || '').trim();
  const snippet = (item.feedText || item.body || item.subtitle || '').trim();
  const fullContent = [title, item.subtitle, item.feedText, item.body].filter(Boolean).join(' ');
  const combined = fullContent.toLowerCase();

  // Memes, comics and visual satire are visual works whose punchline lives in title/image
  const isVisualMemeOrComic = item.format === 'meme' ||
    item.format === 'comic' ||
    item.space === 'c/memes' ||
    item.primaryTopic === 'memes_satire';

  if (isVisualMemeOrComic) {
    return {
      score: 8,
      passed: true,
      reason: 'Visuelle Satire / Meme-Klassiker / Comic'
    };
  }

  // 1. One-line stubs or extreme short text (< 30 characters) without art format
  if (snippet.length < 30 && item.format !== 'art_showcase') {
    return {
      score: 3,
      passed: false,
      reason: 'Einzeiliger Stub / Unzureichender Kontext'
    };
  }

  // 1b. Directive 1: Bare link stubs / boilerplate without real substantive article prose
  const isBoilerplateSnippet = /^(diskutiert auf hacker news|aktuelle fachdiskussion auf hacker news|top-thema auf hacker news)/i.test(snippet);
  if (isBoilerplateSnippet && item.format !== 'art_showcase') {
    const rawArticle = (item.body || '').trim();
    const isBoilerplateArticle = /^(diskutiert auf hacker news|aktuelle fachdiskussion auf hacker news|top-thema auf hacker news)/i.test(rawArticle);
    if (rawArticle.length < 140 || isBoilerplateArticle) {
      return {
        score: 3,
        passed: false,
        reason: 'Reiner Link-Stub / Boilerplate ohne Fließtext'
      };
    }
  }

  // 2. Pure affiliate deals, promo, vouchers, commerce discounts
  const affiliateRegex = /\b(deal|deals|rabatt|rabattcode|gutschein|gutscheine|schnäppchen|kaufen|günstig kaufen|spartipp|affiliate|bestellen|preisvergleich|black friday|prime day|geschenktipp|werbung|anzeige|gesponsert|sponsored|shopping|cashback|sale)\b/i;
  if (affiliateRegex.test(combined)) {
    return {
      score: 2,
      passed: false,
      reason: 'Kommerzielles Angebot / Affiliate-Deal'
    };
  }

  // 3. Clickbait & Outrage / Boulevard
  const clickbaitRegex = /\b(unglaublich|schock|enthüllt|du wirst nicht glauben|dieser trick|irre|promi|doku-drama|skandal|netz lacht|ausraster|verblüfft|heimlich)\b/i;
  if (clickbaitRegex.test(title)) {
    return {
      score: 4,
      passed: false,
      reason: 'Clickbait / Trivialer Boulevard'
    };
  }

  // 4. Substantial, trusted publishers and trust levels
  const publisher = (item.publisher || '').toLowerCase();
  const highTrustPublishers = [
    'tagesschau', 'zdf', 'deutschlandfunk', 'dlf', 'quanta', 'spektrum', 'stanford',
    'aeon', 'nautilus', 'mit technology review', 'nature', 'science', 'wikipedia',
    'ars technica', 'heise', 'netzpolitik', 'br', 'wdr', 'swr', 'faz', 'zeit', 'lab', 'journal', 'foundation'
  ];
  const isHighTrust = highTrustPublishers.some(p => publisher.includes(p)) ||
    item.sourceTrustLevel === 'peer_reviewed' ||
    item.sourceTrustLevel === 'public_broadcaster' ||
    item.sourceTrustLevel === 'encyclopedia' ||
    item.sourceTrustLevel === 'museum_collection';

  // Word count & depth heuristic based on full intellectual content
  const wordCount = fullContent.split(/\s+/).filter(Boolean).length;
  if (isHighTrust || wordCount >= 30) {
    return {
      score: 8,
      passed: true,
      reason: 'Substanzieller Beitrag mit Tiefgang'
    };
  }

  // Baseline standard item with sufficient substance
  if (wordCount >= 15) {
    return {
      score: 7,
      passed: true,
      reason: 'Solider Informationswert'
    };
  }

  return {
    score: 5,
    passed: false,
    reason: 'Geringe Informationstiefe'
  };
}

/**
 * Deterministic semantic keyword mapper for offline / fallback topic classification.
 * Prevents e.g. WIRED biology or ecology articles from being misclassified as ai_apple.
 */
export function classifyTopicDeterministically(
  title: string,
  body: string,
  fallback: TopicTag = 'philosophy_ethics'
): TopicTag {
  const combined = `${title} ${body}`.toLowerCase();

  // Science & Society / Biology / Physics / Space
  if (
    /\b(biolog|genom|dna|rna|zell|crispr|organism|ökolog|klima|astronom|physik|quanten|teleskop|evolution|bakteri|virus)\b/i.test(
      combined
    )
  ) {
    return 'science_society';
  }

  // Sound Synthesis & Music Craft
  if (
    /\b(synthesizer|synth|eurorack|modular|moog|filter|reverb|ambient|klang|frequenz|audio|midi|ableton|patch)\b/i.test(
      combined
    )
  ) {
    return 'sound_synthesis';
  }

  // Contemplation & Mind
  if (
    /\b(meditat|achtsam|stoisch|stoiz|gelassen|atem|ruhe|entschleunig|fokus|kontemplat|zen|buddhis)\b/i.test(
      combined
    )
  ) {
    return 'contemplation_mind';
  }

  // Philosophy & Ethics
  if (
    /\b(philosoph|ethik|moral|epistem|sokrates|kant|nietzsche|aurelius|erkenntnis|sinn|existenz)\b/i.test(
      combined
    )
  ) {
    return 'philosophy_ethics';
  }

  // German Didactics & Teaching
  if (
    /\b(unterricht|didaktik|pädagog|schule|lehrkraft|schüler|lehrplan|bildungssystem|curriculum)\b/i.test(
      combined
    )
  ) {
    return 'german_didactics';
  }

  // Health & Biohacking
  if (
    /\b(schlaf|circadian|longevity|fasten|ernährung|dopamin|cortisol|mikrobiom|training|herzfrequenz)\b/i.test(
      combined
    )
  ) {
    return 'health_biohacking';
  }

  // AI & Apple Systems
  if (
    /\b(llm|gpt|transformer|mlx|apple silicon|m4|macos|ios|inference|neural network|diffusion|agent)\b/i.test(
      combined
    )
  ) {
    return 'ai_apple';
  }

  return fallback;
}

export class BatchEditionEnricher {
  private runQueue: Promise<unknown> = Promise.resolve();
  private lastBatchReport: BatchCurationReport = {
    candidateCount: 0, approvedCount: 0, rejectedCount: 0,
    usedAI: false, usedFallback: false, cacheHits: 0
  };

  constructor(
    private readonly ledger: EnrichmentUsageLedger = defaultUsageLedger,
    private readonly credentialsLoader: () => Promise<AiCredentials> = loadAiCredentials,
    private readonly cache: EnrichmentCache<unknown> = new EnrichmentCache<unknown>(
      new StorageDriverCacheStorage<unknown>(undefined, '@atem:batch_curation_cache:v1')
    )
  ) {}

  getLastBatchReport(): BatchCurationReport {
    return { ...this.lastBatchReport };
  }

  private cacheKey(item: FeedItem, credentials: AiCredentials): CacheKeyParams {
    const sourceText = item.articleBody || item.body || item.feedText || '';
    const publisher = item.sourceReferences[0]?.publisher || item.sourceDomain || '';
    return {
      contentHash: pureJsSha256(JSON.stringify([item.canonicalUrl || '', item.title, item.subtitle, publisher, sourceText])),
      task: 'batch_curation', schemaVersion: 'v2', promptVersion: BATCH_PROMPT_VERSION,
      modelId: `${credentials.provider}:${credentials.model || 'default'}`,
      language: detectLanguage(`${item.title} ${sourceText.slice(0, 1000)}`)
    };
  }

  private applyDecision(original: FeedItem, decision: EnrichedItemData): FeedItem {
    const topics = decision.topics.includes(decision.primaryTopic)
      ? decision.topics : [decision.primaryTopic, ...decision.topics].slice(0, 3);
    return {
      ...original,
      feedText: decision.feedText || original.feedText,
      keyInsight: decision.keyInsight || original.keyInsight || original.subtitle,
      primaryTopic: decision.primaryTopic,
      topics,
      didacticTransfer: decision.didacticTransfer || original.didacticTransfer,
      didacticSeed: decision.didacticTransfer || original.didacticSeed,
      curationScore: decision.curationScore,
      aiAssisted: true
    };
  }

  /**
   * Deterministic evaluation of signal vs noise.
   */
  evaluateSignalVsNoise(item: FeedItem): GatekeeperEvaluation {
    return evaluateSignalVsNoiseDeterministically({
      title: item.title,
      subtitle: item.subtitle,
      body: item.body,
      feedText: item.feedText,
      publisher: item.sourceReferences?.[0]?.publisher,
      format: item.format,
      space: item.space,
      primaryTopic: item.primaryTopic
    });
  }

  /**
   * AI Curation Gatekeeper & Batch Intelligence.
   * Passes candidate items through a smart Signal-vs-Noise Gatekeeper (evaluating for depth,
   * substance, and absence of clickbait/shopping/daily politics, score 0-10).
   * Filters out low-score items (< 7).
   * Preserves source language: if source article is English, stays English; if German, stays German.
   * Falls back gracefully to deterministic heuristics when offline or unconfigured.
   */
  gatekeepAndEnrichBatch(items: FeedItem[], overrideCredentials?: AiCredentials): Promise<FeedItem[]> {
    // Serialize runs through this shared curator so simultaneous clicks reuse completed cache writes.
    const run = this.runQueue.then(async () => {
      this.lastBatchReport = {
        candidateCount: items.length,
        approvedCount: 0,
        rejectedCount: 0,
        usedAI: false,
        usedFallback: false,
        cacheHits: 0
      };
      const curated: FeedItem[] = [];
      const CHUNK_SIZE = 6;
      for (let i = 0; i < items.length; i += CHUNK_SIZE) {
        curated.push(...await this.processChunk(items.slice(i, i + CHUNK_SIZE), overrideCredentials));
      }
      this.lastBatchReport.approvedCount = curated.length;
      this.lastBatchReport.rejectedCount = items.length - curated.length;
      return curated;
    });
    this.runQueue = run.catch(() => undefined);
    return run;
  }

  /**
   * Backward-compatible batch enricher method.
   */
  async enrichBatch(items: FeedItem[], overrideCredentials?: AiCredentials): Promise<FeedItem[]> {
    return this.gatekeepAndEnrichBatch(items, overrideCredentials);
  }

  private async processChunk(items: FeedItem[], overrideCredentials?: AiCredentials): Promise<FeedItem[]> {
    let credentials: AiCredentials;
    if (overrideCredentials) {
      credentials = overrideCredentials;
    } else {
      try {
        credentials = await this.credentialsLoader();
      } catch (err: any) {
        this.lastBatchReport.usedFallback = true;
        this.lastBatchReport.errorClass = 'no_credentials';
        this.lastBatchReport.errorMessage = err?.message || 'Keine KI-Zugangsdaten konfiguriert.';
        return this.fallbackDeterministicGatekeep(items);
      }
    }

    if (!hasAiConfiguration(credentials)) {
      this.lastBatchReport.usedFallback = true;
      this.lastBatchReport.errorClass = 'no_credentials';
      this.lastBatchReport.errorMessage = 'Kein API-Schlüssel konfiguriert.';
      return this.fallbackDeterministicGatekeep(items);
    }

    const cachedDecisions = new Map<string, EnrichedItemData>();
    const cacheKeys = new Map<string, CacheKeyParams>();
    const pending: FeedItem[] = [];
    for (const item of items) {
      const key = this.cacheKey(item, credentials);
      cacheKeys.set(item.id, key);
      const cached = BatchDecisionSchema.safeParse(await this.cache.get(key));
      if (cached.success) {
        cachedDecisions.set(item.id, { ...cached.data, id: item.id });
        this.lastBatchReport.cacheHits++;
      } else {
        pending.push(item);
      }
    }
    const fromDecisions = (decisions: Map<string, EnrichedItemData>): FeedItem[] => {
      const approved: FeedItem[] = [];
      for (const original of items) {
        const decision = decisions.get(original.id);
        if (decision) {
          if (decision.curationScore >= 7) approved.push(this.applyDecision(original, decision));
        } else {
          this.lastBatchReport.usedFallback = true;
          approved.push(...this.fallbackDeterministicGatekeep([original]));
        }
      }
      return approved;
    };

    if (pending.length === 0) {
      return fromDecisions(cachedDecisions);
    }

    const canSpend = await this.ledger.canSpend(0.005);
    if (!canSpend) {
      this.lastBatchReport.usedFallback = true;
      this.lastBatchReport.errorClass = 'budget_exceeded';
      this.lastBatchReport.errorMessage = 'Monatliches KI-Budget von 5,00 € erreicht oder gesperrt.';
      return fromDecisions(cachedDecisions);
    }

    const payload = pending.map(it => {
      const rawText = (it.articleBody || it.body || it.feedText || it.subtitle || '').trim();
      const excerpt = rawText.length > 280 ? rawText.slice(0, 277) + '…' : rawText;
      const detectedLang = detectLanguage(`${it.title} ${excerpt}`);
      return {
        id: it.id,
        title: it.title.slice(0, 240),
        subtitle: it.subtitle?.slice(0, 280),
        publisher: (it.sourceReferences[0]?.publisher || it.sourceDomain || '').slice(0, 120),
        currentTopic: it.primaryTopic,
        sourceLanguage: detectedLang,
        excerpt
      };
    });

    const systemInstruction = `Du bist die intellektuelle Chefredaktion und der Signal-vs-Noise Gatekeeper der Wissens- und Bildungs-App "Atmen".
Deine Aufgabe ist zweistufig:
1. Signal-vs-Noise Gatekeeper:
   Bewerte jeden eingehenden Beitrag unbestechlich auf einer Skala von 0 bis 10:
   - Intellektuelle Tiefe, Substanz, Erkenntnisgewinn, Evidenz, zeitlose Relevanz.
   - Punktabzug (Score < 7) für: Clickbait, Affiliate-Deals/Shopping-Tipps, tagespolitischen Boulevard, Empörung, Parteiengezänk, PR-Meldungen oder einzeilige Stummeltexte ohne Kontext.
   - Ein Score von mindestens 7 (7 bis 10) ist die zwingende Hürde für die Aufnahme in Atmen.

2. Veredelung (nur für Beiträge mit curationScore >= 7):
   - "feedText": Prägnanter, hochsubstanzieller Lesetext (50-80 Wörter).
   - "keyInsight": Prägnante 1-Satz-Kernthese.
   - "primaryTopic": Exakte semantische Zuordnung aus: ${VALID_TOPICS.join(', ')}.
   - "topics": 1 bis 3 passende Themen-Tags.
   - "didacticTransfer": Ein konkreter pädagogischer oder kontemplativer Reflexionsimpuls (1-2 Sätze).

Für abgelehnte Beiträge (Score < 7): Setze feedText, keyInsight und didacticTransfer auf "" und gib einen kurzen rejectionReason an.

SPRACH-REGEL:
Behalte die Ausgangssprache des Originalartikels bei! (sourceLanguage === "en" -> Englisch, sourceLanguage === "de" -> Deutsch).

Antworte AUSSCHLIESSLICH als JSON-Array:
[
  {
    "id": "item-id",
    "curationScore": 8,
    "rejectionReason": "",
    "feedText": "...",
    "keyInsight": "...",
    "primaryTopic": "...",
    "topics": ["..."],
    "didacticTransfer": "..."
  }
]`;

    const prompt = `Hier sind die ${pending.length} Kandidaten zur Kuration und Signal-vs-Noise-Prüfung:\n${JSON.stringify(payload, null, 2)}`;

    try {
      const response = await callAiModel(prompt, {
        systemInstruction,
        jsonMode: true,
        maxTokens: 2500,
        timeoutMs: 25_000,
        credentials,
        ledger: this.ledger,
        itemId: `ai-gatekeeper-${Date.now()}`
      });

      this.lastBatchReport.usedAI = true;
      this.lastBatchReport.modelUsed = response.modelUsed || credentials.model;
      const parsed: unknown = JSON.parse(response.text);
      if (Array.isArray(parsed)) {
        const wantedIds = new Set(pending.map(item => item.id));
        const decisions = new Map(cachedDecisions);
        let approvedCount = 0;
        for (const entry of parsed) {
          const validated = BatchDecisionSchema.safeParse(entry);
          if (!validated.success || !wantedIds.has(validated.data.id)) continue;
          decisions.set(validated.data.id, validated.data);
          if (validated.data.curationScore >= 7) approvedCount++;
          const key = cacheKeys.get(validated.data.id);
          if (key) await this.cache.set(key, validated.data);
        }
        if (approvedCount === 0 && parsed.length > 0) {
          this.lastBatchReport.errorClass = 'no_approved_candidates';
          this.lastBatchReport.errorMessage = 'Kein Kandidat erreichte die Qualitätshürde (Score >= 7).';
        }
        return fromDecisions(decisions);
      } else {
        this.lastBatchReport.usedFallback = true;
        this.lastBatchReport.errorClass = 'response_invalid';
        this.lastBatchReport.errorMessage = 'Antwort des KI-Modells war kein JSON-Array.';
      }
    } catch (err: any) {
      this.lastBatchReport.usedFallback = true;
      if (err instanceof AiCredentialsMissingError) {
        this.lastBatchReport.errorClass = 'no_credentials';
        this.lastBatchReport.errorMessage = 'Kein API-Schlüssel konfiguriert.';
      } else if (err instanceof AiBudgetExceededError) {
        this.lastBatchReport.errorClass = 'budget_exceeded';
        this.lastBatchReport.errorMessage = err.message || 'Monatliches KI-Budget erreicht.';
      } else if (err instanceof AiHttpError) {
        if (err.status === 401 || err.status === 403) {
          this.lastBatchReport.errorClass = 'auth_error';
          this.lastBatchReport.errorMessage = `Authentifizierungsfehler (${err.status}): Bitte API-Schlüssel prüfen.`;
        } else if (err.status === 429) {
          this.lastBatchReport.errorClass = 'rate_limit';
          this.lastBatchReport.errorMessage = 'Rate-Limit des KI-Anbieters erreicht (HTTP 429).';
        } else if (err.status === 404) {
          this.lastBatchReport.errorClass = 'model_not_found';
          this.lastBatchReport.errorMessage = 'Modell beim Anbieter nicht verfügbar (404).';
        } else {
          this.lastBatchReport.errorClass = 'network_error';
          this.lastBatchReport.errorMessage = `KI-Serverfehler (HTTP ${err.status}).`;
        }
      } else if (err?.message?.includes('Zeitüberschreitung') || err?.name === 'AbortError') {
        this.lastBatchReport.errorClass = 'timeout';
        this.lastBatchReport.errorMessage = 'Zeitüberschreitung der KI-Anfrage (Timeout nach 25s).';
      } else if (err instanceof SyntaxError || err?.message?.includes('JSON')) {
        this.lastBatchReport.errorClass = 'response_invalid';
        this.lastBatchReport.errorMessage = 'Antwort des KI-Modells war fehlerhaftes JSON.';
      } else {
        this.lastBatchReport.errorClass = 'network_error';
        this.lastBatchReport.errorMessage = err?.message || 'Netzwerkfehler bei der KI-Anfrage.';
      }
    }
    return fromDecisions(cachedDecisions);
  }

  /**
   * Evaluates each item deterministically: filters out items with score < 7
   * and enriches passing items with language preservation.
   */
  private fallbackDeterministicGatekeep(items: FeedItem[]): FeedItem[] {
    const approved: FeedItem[] = [];

    for (const item of items) {
      const evalResult = this.evaluateSignalVsNoise(item);
      if (evalResult.passed) {
        const enriched = this.enrichDeterministically(item);
        approved.push({
          ...enriched,
          curationScore: evalResult.score,
          curationReason: evalResult.reason
        });
      }
    }

    return approved;
  }

  /**
   * Deterministic zero-token fallback enrichment with strict source language preservation.
   */
  enrichDeterministically(item: FeedItem): FeedItem {
    const semanticTopic = classifyTopicDeterministically(item.title, item.body || item.feedText, item.primaryTopic);
    const topics = item.topics.includes(semanticTopic) ? item.topics : [semanticTopic, ...item.topics];

    const lang = detectLanguage(`${item.title} ${item.feedText || item.subtitle || ''}`);

    const keyInsight = item.keyInsight || item.subtitle || (
      item.feedText.split('.')[0] ? `${item.feedText.split('.')[0]}.` : item.title
    );

    const hasGermanClash = lang === 'en' && Boolean(
      (item.didacticTransfer && detectLanguage(item.didacticTransfer) === 'de') ||
      (item.didacticSeed && detectLanguage(item.didacticSeed) === 'de')
    );

    const didacticTransfer = (!hasGermanClash && (item.didacticTransfer || item.didacticSeed)) || (
      lang === 'en'
        ? `Reflective inquiry: How does this insight regarding "${item.title}" inform your perspective or daily practice?`
        : synthesizeDidacticTransfer(
            item.title,
            item.body || item.feedText,
            semanticTopic,
            item.isTeachingRelated
          )
    );

    return {
      ...item,
      primaryTopic: semanticTopic,
      topics,
      keyInsight,
      didacticTransfer,
      didacticSeed: didacticTransfer
    };
  }

  classifyTopicDeterministically(
    title: string,
    body: string,
    fallback: TopicTag = 'philosophy_ethics'
  ): TopicTag {
    return classifyTopicDeterministically(title, body, fallback);
  }
}

export const defaultBatchEditionEnricher = new BatchEditionEnricher();

export function enrichDeterministically(item: FeedItem): FeedItem {
  return defaultBatchEditionEnricher.enrichDeterministically(item);
}
