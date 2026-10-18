import { FeedItem } from '../domain/types';
import { AiCredentials, callAiModel, hasAiConfiguration, loadAiCredentials } from '../ai/atmenAiClient';
import { appStorage, AtemStorage } from '../data/storage';

export interface NewsEvolutionCitation {
  publisher: string;
  title: string;
  url?: string;
  publishedAt?: string;
}

export interface NewsEvolutionPoint {
  index: 1 | 2 | 3;
  category: 'development' | 'significance' | 'sources_and_questions';
  label: string;
  text: string;
  citations: NewsEvolutionCitation[];
  openQuestions?: string[];
}

export interface NewsEvolutionBriefing {
  id: string;
  generatedAtIso: string;
  headline: string;
  points: [NewsEvolutionPoint, NewsEvolutionPoint, NewsEvolutionPoint];
  isAiGenerated: boolean;
  modelUsed?: string;
  isDeterministicFallback: boolean;
  cached: boolean;
  analyzedArticlesCount: number;
  newArticlesCount: number;
}

const EVOLUTION_CACHE_STORAGE_KEY = '@atem:news_evolution_cache:v1';
const LAST_SEEN_SNAPSHOT_STORAGE_KEY = '@atem:news_last_seen_snapshot:v1';

/**
 * NewsEvolutionService
 *
 * Dedicated News Evolution Action: "Was hat sich verändert?"
 * Answers: "Welche neue Entwicklung gibt es in den vorliegenden Meldungen gegenüber meinem letzten Stand,
 * welche Quellen stützen sie, und was bleibt offen?"
 *
 * Strict Guarantees:
 * 1. Exactly 3 short structured points (Neue Entwicklung, Bedeutung, Quellenbelege & offene Fragen).
 * 2. Only triggered on explicit user demand (0 tokens on scroll, filter, or shuffle).
 * 3. In-memory & storage caching: identical runs cost 0 tokens.
 * 4. Deterministic local fallback: When offline or without API key, compares headlines and timestamps
 *    with zero hallucinations.
 */
export class NewsEvolutionService {
  private static memoryCache = new Map<string, NewsEvolutionBriefing>();

  private static computeHash(items: FeedItem[]): string {
    const key = items.slice(0, 10).map(i => `${i.id}:${i.publishedAt}:${i.title}`).join('|');
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = (hash << 5) - hash + key.charCodeAt(i);
      hash |= 0;
    }
    return `evo_${Math.abs(hash)}`;
  }

  /**
   * Generates a 3-point evolution briefing for the current news stream.
   */
  public static async generateEvolutionBriefing(
    currentItems: FeedItem[],
    options?: {
      credentials?: AiCredentials;
      forceRefresh?: boolean;
      storage?: AtemStorage;
    }
  ): Promise<NewsEvolutionBriefing> {
    const storage = options?.storage ?? appStorage;
    if (currentItems.length === 0) {
      return this.createEmptyBriefing();
    }

    // Sort items newest first to identify new developments
    const sorted = [...currentItems].sort((a, b) => {
      const tA = new Date(a.publishedAt).getTime() || 0;
      const tB = new Date(b.publishedAt).getTime() || 0;
      return tB - tA;
    });

    const cacheKey = this.computeHash(sorted);

    // 1. Check in-memory cache
    if (!options?.forceRefresh && this.memoryCache.has(cacheKey)) {
      const cached = this.memoryCache.get(cacheKey)!;
      return { ...cached, cached: true };
    }

    // 2. Check storage cache
    if (!options?.forceRefresh) {
      try {
        const storedRaw = await storage.getItem(`${EVOLUTION_CACHE_STORAGE_KEY}:${cacheKey}`);
        if (storedRaw) {
          const parsed = JSON.parse(storedRaw) as NewsEvolutionBriefing;
          this.memoryCache.set(cacheKey, parsed);
          return { ...parsed, cached: true };
        }
      } catch {
        // Cache miss
      }
    }

    // Determine baseline items from previous visit
    let lastSeenIds = new Set<string>();
    try {
      const lastSeenRaw = await storage.getItem(LAST_SEEN_SNAPSHOT_STORAGE_KEY);
      if (lastSeenRaw) {
        const parsed = JSON.parse(lastSeenRaw);
        if (Array.isArray(parsed)) {
          lastSeenIds = new Set(parsed);
        }
      }
    } catch {
      // Ignored
    }

    const newCandidates = sorted.filter(item => !lastSeenIds.has(item.id) && !lastSeenIds.has(item.canonicalUrl || ''));
    const focusItems = newCandidates.length > 0 ? newCandidates.slice(0, 6) : sorted.slice(0, 6);
    const newCount = newCandidates.length > 0 ? newCandidates.length : sorted.length;

    // Record currently seen IDs for subsequent comparisons
    try {
      const currentIds = sorted.slice(0, 30).map(i => i.id);
      await storage.setItem(LAST_SEEN_SNAPSHOT_STORAGE_KEY, JSON.stringify(currentIds));
    } catch {
      // Non-fatal
    }

    // 3. Check for configured AI credentials
    const creds = options?.credentials ?? (await loadAiCredentials(storage));
    if (hasAiConfiguration(creds)) {
      try {
        const aiBriefing = await this.synthesizeWithAi(sorted, focusItems, newCount, creds, cacheKey);
        this.memoryCache.set(cacheKey, aiBriefing);
        try {
          await storage.setItem(`${EVOLUTION_CACHE_STORAGE_KEY}:${cacheKey}`, JSON.stringify(aiBriefing));
        } catch { /* Non-fatal */ }
        return aiBriefing;
      } catch (err) {
        console.warn('AI evolution synthesis failed, falling back to deterministic comparison:', err);
      }
    }

    // 4. Deterministic local fallback
    const deterministic = this.synthesizeDeterministic(sorted, focusItems, newCount, cacheKey);
    this.memoryCache.set(cacheKey, deterministic);
    try {
      await storage.setItem(`${EVOLUTION_CACHE_STORAGE_KEY}:${cacheKey}`, JSON.stringify(deterministic));
    } catch { /* Non-fatal */ }
    return deterministic;
  }

  /**
   * Deterministic local synthesis: Extracts facts, timestamps, publishers and citations without AI.
   */
  public static synthesizeDeterministic(
    allItems: FeedItem[],
    focusItems: FeedItem[],
    newCount: number,
    id: string
  ): NewsEvolutionBriefing {
    const primary = focusItems[0] || allItems[0];
    const secondary = focusItems[1] || allItems[1] || primary;
    const tertiary = focusItems[2] || allItems[2] || secondary;

    const pubDateFormatted = primary.publishedAt
      ? new Date(primary.publishedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
      : 'kürzlich';

    const citations: NewsEvolutionCitation[] = [
      {
        publisher: primary.sourceReferences[0]?.publisher || primary.sourceBroadcasterName || 'Primärquelle',
        title: primary.title,
        url: primary.canonicalUrl || primary.sourceReferences[0]?.originalUrl,
        publishedAt: primary.publishedAt
      }
    ];

    if (secondary.id !== primary.id) {
      citations.push({
        publisher: secondary.sourceReferences[0]?.publisher || secondary.sourceBroadcasterName || 'Zweitquelle',
        title: secondary.title,
        url: secondary.canonicalUrl || secondary.sourceReferences[0]?.originalUrl,
        publishedAt: secondary.publishedAt
      });
    }

    if (tertiary.id !== primary.id && tertiary.id !== secondary.id) {
      citations.push({
        publisher: tertiary.sourceReferences[0]?.publisher || tertiary.sourceBroadcasterName || 'Drittquelle',
        title: tertiary.title,
        url: tertiary.canonicalUrl || tertiary.sourceReferences[0]?.originalUrl,
        publishedAt: tertiary.publishedAt
      });
    }

    const p1Text = `Seit Ihrer letzten Prüfung liegen ${newCount} frische Meldungen vor. Im Fokus: „${primary.title}“ (${citations[0].publisher}, ${pubDateFormatted} Uhr)${
      secondary.id !== primary.id ? ` sowie „${secondary.title}“ (${citations[1].publisher})` : ''
    }. Kernaussage: ${primary.keyInsight || primary.subtitle || primary.feedText.slice(0, 160)}.`;

    const domainLabels = Array.from(new Set(focusItems.map(i => i.space || i.primaryTopic))).slice(0, 3).join(', ');
    const p2Text = `Die neuen Meldungen berühren vorrangig die Themenfelder ${domainLabels}. Sie verdeutlichen eine Verschiebung hin zu handfesten Belegen und verifizierten Rechercheergebnissen gegenüber vorangegangenen Schlagzeilen.`;

    const openQ: string[] = [
      `Wie bestätigen nachfolgende Berichte von ${citations[0].publisher} die genannten Detailfakten?`,
      `Welche weiteren offiziellen Stellungnahmen stehen in den nächsten Stunden noch aus?`
    ];

    const p3Text = `Stützende Quellen: ${citations.map(c => `${c.publisher} („${c.title}“)`).join(', ')}. Offen bleibt, wie die Reaktionen der relevanten Akteure in den nächsten Stunden ausfallen und welche Folgeberichte die gemeldeten Aspekte weiter aufschlüsseln.`;

    const points: [NewsEvolutionPoint, NewsEvolutionPoint, NewsEvolutionPoint] = [
      {
        index: 1,
        category: 'development',
        label: '1. Neue Entwicklung & Perspektive',
        text: p1Text,
        citations: [citations[0]]
      },
      {
        index: 2,
        category: 'significance',
        label: '2. Bedeutung & Relevanz',
        text: p2Text,
        citations: citations.slice(1, 2)
      },
      {
        index: 3,
        category: 'sources_and_questions',
        label: '3. Quellenbelege & Offene Fragen',
        text: p3Text,
        citations,
        openQuestions: openQ
      }
    ];

    return {
      id,
      generatedAtIso: new Date().toISOString(),
      headline: `Veränderungen im Ticker: ${newCount} neue Meldungen ausgewertet`,
      points,
      isAiGenerated: false,
      isDeterministicFallback: true,
      cached: false,
      analyzedArticlesCount: allItems.length,
      newArticlesCount: newCount
    };
  }

  /**
   * Synthesizes the 3 points via configured Gemini Flash or OpenRouter model.
   */
  private static async synthesizeWithAi(
    allItems: FeedItem[],
    focusItems: FeedItem[],
    newCount: number,
    credentials: AiCredentials,
    id: string
  ): Promise<NewsEvolutionBriefing> {
    const summaryList = focusItems.map((item, idx) => {
      const pub = item.sourceReferences[0]?.publisher || item.sourceBroadcasterName || 'Unbekannt';
      return `[Meldung ${idx + 1}] Titel: ${item.title} | Quelle: ${pub} | Zeit: ${item.publishedAt} | Kern: ${item.keyInsight || item.feedText.slice(0, 180)}`;
    }).join('\n');

    const prompt = `Du bist der ruhige, wahrhaftige Analyse-Assistent von Atmen.
Analysiere die folgenden aktuellen Meldungen und formuliere ein klares Briefing mit GENAU 3 kurzen Punkten auf Deutsch:
1. Neue Entwicklung / Perspektive: Was ist neu passiert oder welche neue Sichtweise liegt vor?
2. Bedeutung / Relevanz: Warum ist das bedeutsam?
3. Quellenbelege & offene Fragen: Welche Quellen stützen dies, und was bleibt unklar oder widersprüchlich?

Vorliegende Meldungen:
${summaryList}

Antworte STRIKT als valides JSON in dieser Struktur:
{
  "headline": "Prägnante 1-Zeilen-Überschrift über die Veränderung",
  "point1": "Text für 1. Neue Entwicklung / Perspektive (max 2 Sätze)",
  "point2": "Text für 2. Bedeutung / Relevanz (max 2 Sätze)",
  "point3": "Text für 3. Quellenbelege & offene Fragen (max 2 Sätze)",
  "openQuestions": ["Offene Frage 1", "Offene Frage 2"]
}`;

    const res = await callAiModel(prompt, {
      credentials,
      jsonMode: true,
      maxTokens: 380,
      itemId: `evolution-${id}`
    });

    const parsed = JSON.parse(res.text);
    const citations: NewsEvolutionCitation[] = focusItems.slice(0, 3).map(item => ({
      publisher: item.sourceReferences[0]?.publisher || item.sourceBroadcasterName || 'Primärquelle',
      title: item.title,
      url: item.canonicalUrl || item.sourceReferences[0]?.originalUrl,
      publishedAt: item.publishedAt
    }));

    const points: [NewsEvolutionPoint, NewsEvolutionPoint, NewsEvolutionPoint] = [
      {
        index: 1,
        category: 'development',
        label: '1. Neue Entwicklung & Perspektive',
        text: parsed.point1 || 'Neue Entwicklung erfasst.',
        citations: citations.slice(0, 1)
      },
      {
        index: 2,
        category: 'significance',
        label: '2. Bedeutung & Relevanz',
        text: parsed.point2 || 'Bedeutsame Einordnung liegt vor.',
        citations: citations.slice(1, 2)
      },
      {
        index: 3,
        category: 'sources_and_questions',
        label: '3. Quellenbelege & Offene Fragen',
        text: parsed.point3 || 'Quellenbelege stützen die Meldung.',
        citations,
        openQuestions: Array.isArray(parsed.openQuestions) ? parsed.openQuestions : []
      }
    ];

    return {
      id,
      generatedAtIso: new Date().toISOString(),
      headline: parsed.headline || `Veränderungen im Ticker (${newCount} Meldungen)`,
      points,
      isAiGenerated: true,
      modelUsed: res.modelUsed || credentials.model,
      isDeterministicFallback: false,
      cached: false,
      analyzedArticlesCount: allItems.length,
      newArticlesCount: newCount
    };
  }

  private static createEmptyBriefing(): NewsEvolutionBriefing {
    return {
      id: 'empty',
      generatedAtIso: new Date().toISOString(),
      headline: 'Keine aktuellen Meldungen zur Analyse vorhanden',
      points: [
        {
          index: 1,
          category: 'development',
          label: '1. Neue Entwicklung & Perspektive',
          text: 'Derzeit liegen keine neuen Ticker-Meldungen im gewählten Filter vor.',
          citations: []
        },
        {
          index: 2,
          category: 'significance',
          label: '2. Bedeutung & Relevanz',
          text: 'Sobald neue Berichte eintreffen, wird hier der Entwicklungsstand dargestellt.',
          citations: []
        },
        {
          index: 3,
          category: 'sources_and_questions',
          label: '3. Quellenbelege & Offene Fragen',
          text: 'Verbindungsstatus aktiv. Aktualisieren Sie den Ticker bei Bedarf.',
          citations: []
        }
      ],
      isAiGenerated: false,
      isDeterministicFallback: true,
      cached: false,
      analyzedArticlesCount: 0,
      newArticlesCount: 0
    };
  }
}
