import { FeedItem, TopicTag, TopicTagSchema, SocraticSalonPerspectives } from '../domain/types';
import { detectChannelArchetype, ChannelArchetype } from '../ingestion/subchannelFlourishService';
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
import { upgradeImageResolutionUrl, isRejectedLowResOrLogoUrl } from '../utils/imageQuality';
import { extractCleanArticleFromHtml, enrichStubItemWithFulltext } from '../ingestion/webContentExtractor';
export { upgradeImageResolutionUrl, extractCleanArticleFromHtml, enrichStubItemWithFulltext };

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
  counterPerspective?: string;
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
  counterPerspective: z.string().max(4000).optional().default(''),
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

const STRICT_CORE_DE_EN_WORDS =
  /\b(der|die|das|den|dem|des|ein|eine|einer|eines|einem|einen|und|oder|aber|in|im|ins|von|vom|mit|für|auf|ist|sind|war|wird|werden|wurde|nicht|auch|sich|als|aus|bei|beim|nach|über|vor|zum|zur|wie|wir|sie|dass|wenn|durch|the|and|of|to|is|for|that|with|on|as|are|this|from|by|at|an|be|has|have|it|we|you|not|or|was|were|will|can)\b/gi;
const STRICT_DE_EN_ANCHORS =
  /\b(der|die|das|den|dem|des|ein|eine|einer|eines|einem|einen|und|oder|aber|in|im|ins|von|vom|mit|für|auf|ist|sind|war|wird|werden|wurde|nicht|auch|sich|als|aus|bei|beim|nach|über|vor|zum|zur|wie|wir|sie|dass|wenn|durch|gegen|ohne|unter|zwischen|the|and|of|to|is|for|that|with|on|as|are|this|from|by|at|an|be|has|have|it|we|you|me|my|not|or|was|were|will|can|do|does|did|don|how|why|what|who|which|their|our|into|about|more|than|but|all|when|there|been|being|really|tell|turns|light|color|spaces|early|years|making|inside|free|online)\b/gi;
const CZECH_POLISH_SLAVIC_CHARS = /[ěščřžůďťňłąćęńśźżőűășțğış]/gi;
const BROAD_FOREIGN_DIACRITICS = /[ěščřžýáíéúůďťňłąćęńóśźżőűășțğış]/gi;
const NON_DE_EN_STOPWORDS =
  /\b(podle|nebo|který|která|které|jsou|jako|více|před|přes|není|bude|aby|když|proč|dějiny|vítězů|však|jejich|mezi|než|také|tento|této|tomto|všechny|kterou|kterých|ještě|své|české|český|získal|režimů|zažil|nepsal|příběhy|souladu|výklady|minulosti|něž|opírala|platilo|témata|odboje|vztahu|společnosti|autoritářství|oraz|który|która|które|przez|tylko|bardzo|więcej|między|jednak|będzie|jego|jej|tych|może|kiedy|gdzie|dlaczego|wszystkich|społeczeństwo|historii|polsce|polski|sztuczna|inteligencja|edukację|les|une|dans|pour|avec|sont|cette|aux|comme|mais|nous|vous|leur|leurs|ces|tout|tous|être|avoir|même|aussi|entre|los|las|una|del|como|más|pero|sus|cuando|todo|también|sobre|estos|estas|puede|todos|desde|hasta|porque|della|delle|degli|nella|nelle|sono|più|anche|questo|questa|dalla|hanno|essere|tutto|tutti|perché|stato|stata|loro)\b/gi;
const NON_LATIN_SCRIPT_CHARS =
  /[\u0400-\u04FF\u0600-\u06FF\u0590-\u05FF\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]/g;

/**
 * Strict DE/EN Language Gate:
 * Deterministically allows ONLY German ('de') and English ('en') articles into the feed.
 * Rejects untranslated Czech, Polish, Hungarian, Romanian, Turkish, French, Spanish, Italian, etc.
 */
export function isSupportedFeedLanguage(title: string, text: string = ''): boolean {
  const cleanTitle = (title || '').trim();
  const cleanText = (text || '').trim();
  const combined = `${cleanTitle} ${cleanText}`.trim();
  if (!combined) return false;

  const nonLatinCount = (combined.match(NON_LATIN_SCRIPT_CHARS) || []).length;
  if (nonLatinCount >= 8 && nonLatinCount > combined.length * 0.1) {
    return false;
  }

  const coreDeEnCount = (combined.match(STRICT_CORE_DE_EN_WORDS) || []).length;
  const allDeEnCount = (combined.match(STRICT_DE_EN_ANCHORS) || []).length;
  const titleCoreDeEnCount = (cleanTitle.match(STRICT_CORE_DE_EN_WORDS) || []).length;
  const titleAllDeEnCount = (cleanTitle.match(STRICT_DE_EN_ANCHORS) || []).length;
  const slavicCharCount = (combined.match(CZECH_POLISH_SLAVIC_CHARS) || []).length;
  const titleSlavicCharCount = (cleanTitle.match(CZECH_POLISH_SLAVIC_CHARS) || []).length;
  const broadForeignDiacriticCount = (combined.match(BROAD_FOREIGN_DIACRITICS) || []).length;
  const foreignStopwordCount = (combined.match(NON_DE_EN_STOPWORDS) || []).length;
  const words = combined.split(/\s+/).filter(Boolean);

  // 1. Reject titles with Czech/Polish/Slavic diacritics that lack German/English function words
  if (
    titleSlavicCharCount >= 1 &&
    titleCoreDeEnCount === 0 &&
    titleAllDeEnCount === 0 &&
    (broadForeignDiacriticCount >= 2 || foreignStopwordCount >= 1 || coreDeEnCount < 4)
  ) {
    return false;
  }

  // 2. Reject texts with Czech/Polish/Hungarian/Romanian/Turkish diacritics & stopwords
  if (
    slavicCharCount >= 2 &&
    (foreignStopwordCount >= 1 || (broadForeignDiacriticCount >= 4 && coreDeEnCount < slavicCharCount * 3))
  ) {
    return false;
  }

  if (broadForeignDiacriticCount >= 3 && coreDeEnCount < 2) {
    return false;
  }

  // 3. Reject texts dominated by French/Spanish/Italian/Czech/Polish stopwords
  if (foreignStopwordCount >= 2 && foreignStopwordCount >= Math.max(2, coreDeEnCount * 0.45)) {
    return false;
  }

  if (foreignStopwordCount >= 1 && coreDeEnCount === 0 && allDeEnCount === 0) {
    return false;
  }

  // 4. Verify minimum presence of standard German or English function words on substantive texts
  if (words.length >= 14 && coreDeEnCount < 2 && allDeEnCount < 2) {
    return false;
  }

  return true;
}

const GERMAN_MONTHS =
  'Januar|Februar|März|Maerz|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember|Jan\\.?|Feb\\.?|Mär\\.?|Apr\\.?|Jun\\.?|Jul\\.?|Aug\\.?|Sep\\.?|Sept\\.?|Okt\\.?|Nov\\.?|Dez\\.?';
const DATE_LINE_REGEX = new RegExp(
  `^(stand:\\s*)?(\\d{1,2}\\.\\s*(${GERMAN_MONTHS})\\s+\\d{4}|\\d{1,2}\\.\\d{1,2}\\.\\d{2,4}|(January|February|March|April|May|June|July|August|September|October|November|December)\\s+\\d{1,2},?\\s+\\d{4})([\\s,–\\-|]*(\\d{1,2}[:.]\\d{2})(\\s*uhr)?)?\\s*$`,
  'i'
);
const CAPTION_LABEL_REGEX = /^(bild|foto|fotos|abbildung|abb\.|credit|credits|bildquelle|bildnachweis|quelle bild|image|photo)\s*:/i;
const AGENCY_CREDIT_REGEX = /\((?:[^()]*\/\s*)?(imago|dpa|afp|reuters|ap|epa|getty images|picture alliance|anadolu agency|keystone|xinhua)[^()]*\)\s*$/i;
const INLINE_AGENCY_REGEX = /(\(IMAGO\b|Anadolu Agency\)|\(dpa\b|\(AFP\b|\(Reuters\b|Getty Images\))/;

export const PODCAST_OR_VIDEO_INTRO_REGEX =
  /^(listen to the (interview|episode|podcast)|watch the (video|recording|livestream)|\(transcript\):\s*\.\.\.|hier (den podcast|die episode|das video) anhören|den vollständigen podcast hören)/i;

export const SPONSOR_BOILERPLATE_REGEX =
  /^(sponsored by\b|this page contains .* links|when you make a purchase through|advertisement\b|anzeige\b|werbung\b|werbehinweis\b)/i;

/**
 * RSS Formatting Sanitizer (Work Package 2):
 * Strips duplicate leading title lines, author/editor bylines, raw date/time stamps,
 * photo captions & agency credits, and collapses whitespace-only / multi-newline gaps.
 */
export function cleanArticleBodyFormatting(raw: string, title?: string): string {
  if (!raw || typeof raw !== 'string') return '';
  let text = raw
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n');

  const lines = text.split('\n');
  const out: string[] = [];
  const normTitle = (title || '').trim().toLowerCase().replace(/[.:!?…\s]+$/, '');
  let leadingPhase = true;
  let skipNextCaptionLine = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      out.push('');
      continue;
    }

    if (skipNextCaptionLine) {
      skipNextCaptionLine = false;
      if (line.length < 320) continue;
    }

    // Podcast teasers & sponsor lines anywhere in the body
    if (PODCAST_OR_VIDEO_INTRO_REGEX.test(line) || SPONSOR_BOILERPLATE_REGEX.test(line)) {
      continue;
    }

    // Guardian & podcast boilerplate anywhere in the body
    if (
      /^By\s+[^\n]+(\.\s*Read by\s+[^\n]+)?$/i.test(line) ||
      /^Read by\s+[^\n]+$/i.test(line) ||
      /^Read the text version here.*$/i.test(line) ||
      /^Support (the )?Guardian.*$/i.test(line) ||
      /^theguardian\.com\/[^\s]+$/i.test(line) ||
      /^Continue reading\.{0,3}$/i.test(line) ||
      /^Photograph:\s*.*$/i.test(line)
    ) {
      continue;
    }

    // Photo captions & agency credits anywhere in the body
    if (CAPTION_LABEL_REGEX.test(line)) {
      const rest = line.replace(CAPTION_LABEL_REGEX, '').trim();
      if (!rest) skipNextCaptionLine = true;
      continue;
    }
    if (line.length < 320 && (AGENCY_CREDIT_REGEX.test(line) || INLINE_AGENCY_REGEX.test(line))) {
      continue;
    }

    if (leadingPhase) {
      const lower = line.toLowerCase().replace(/[.:!?…\s]+$/, '');
      // Duplicate leading title line
      if (normTitle && (lower === normTitle || (normTitle.length > 12 && lower.startsWith(normTitle) && line.length <= normTitle.length + 3))) {
        continue;
      }
      // Raw date / time line
      if (DATE_LINE_REGEX.test(line)) {
        continue;
      }
      // Author / editor bylines
      const nextNonEmpty = lines.slice(i + 1).map(l => l.trim()).find(l => l.length > 0) || '';
      const isShortNameLine =
        line.length <= 48 &&
        line.split(/\s+/).length <= 5 &&
        !/[.!?;]$/.test(line) &&
        DATE_LINE_REGEX.test(nextNonEmpty);
      if (
        /^(von|by|text:|autor(in)?:)\s+\S+/i.test(line) && line.length <= 80 ||
        /\bredaktion\b/i.test(line) && line.length <= 48 && !/[.!?]$/.test(line) ||
        isShortNameLine
      ) {
        continue;
      }
      leadingPhase = false;
    }
    out.push(line);
  }

  return out
    .join('\n')
    .replace(/\n{2,}/g, '\n\n')
    .trim();
}

/**
 * Zero AI-Slop filter: removes generic LLM clichés from synthesized editorial prose.
 */
export function stripAiSlopPhrases(text: string): string {
  if (!text || typeof text !== 'string') return '';
  const capitalize = (s: string) => s.replace(/^(\s*)(\p{Ll})/u, (_m, ws, ch) => `${ws}${ch.toUpperCase()}`);
  let out = text
    // Whole cliché sentences
    .replace(/(^|[.!?]\s+)(In einer Welt,? (in der|die|wo)[^.!?]*[.!?])\s*/gi, '$1')
    .replace(/(^|[.!?]\s+)(In einer (zunehmend|immer)[^.!?]*Welt[^.!?]*[.!?])\s*/gi, '$1')
    .replace(/(^|[.!?]\s+)(Tauchen wir (ein|tiefer ein)[^.!?]*[.!?])\s*/gi, '$1')
    .replace(/(^|[.!?]\s+)(Lass(t)? uns (eintauchen|gemeinsam eintauchen)[^.!?]*[.!?])\s*/gi, '$1');

  // Lead-in phrases: strip and re-capitalize the remainder of the sentence
  const leadIns = [
    /Zusammenfassend lässt sich sagen,? dass\s+/gi,
    /Zusammenfassend lässt sich festhalten,? dass\s+/gi,
    /Abschließend lässt sich sagen,? dass\s+/gi,
    /Es zeigt sich,? dass\s+/gi,
    /Es ist wichtig zu betonen,? dass\s+/gi,
    /Es lässt sich festhalten,? dass\s+/gi
  ];
  for (const re of leadIns) {
    out = out.replace(re, '');
  }
  out = out
    .replace(/\b(Dieses|Diese|Dieser) faszinierende(n|r|s)?\s+/g, '$1 ')
    .replace(/\bnicht nur ([^,.;!?]{1,80}?),?\s+sondern auch\s+/gi, '$1 und ');

  // Re-capitalize sentence starts after removals
  out = out
    .split(/(?<=[.!?])\s+/)
    .map(s => capitalize(s))
    .join(' ')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
  return capitalize(out);
}

const PARTY_POLITICS_CASE_SENSITIVE = /\b(SPD|AfD|CDU|CSU|FDP|BSW|Linke|Grüne|Grünen)\b/g;
const PARTY_POLITICS_REGEX = /\b(linkspartei|linkskoalition|bündnis 90|koalitionsvertrag|koalitionsverhandlung\w*|regierungsbildung|wahlkampf|landtagswahl|bundestagswahl|wahlparty|kampfplatz berlin|bundestag|landtag|ampel-koalition|groko)\b/gi;

/** Detects domestic party-politics articles so they never land in c/serendipity or c/dialektik. */
export function isDomesticPartyPolitics(title: string, text: string = ''): boolean {
  const t = title || '';
  const titleHits = (t.match(PARTY_POLITICS_CASE_SENSITIVE) || []).length + (t.match(PARTY_POLITICS_REGEX) || []).length;
  if (titleHits >= 1) return true;
  const body = (text || '').slice(0, 1600);
  const bodyHits = (body.match(PARTY_POLITICS_CASE_SENSITIVE) || []).length + (body.match(PARTY_POLITICS_REGEX) || []).length;
  return bodyHits >= 3;
}

export const POLITICAL_PROTEST_SOCIETY_REGEX =
  /\b(protest\w*|demonstrier\w*|ausschreitung\w*|polizei|regierung\w*|koalition\w*|wahl\w*|bundestagswahl|landtagswahl|krieg\w*|streik\w*|bundestag|landtag|gericht|verfassungsgericht|afd|spd|cdu|csu|fdp|bsw|grüne|grünen|linkspartei|linke|habeck|politician\w*|green party|minister\w*|government\w*|election\w*|parliament\w*|klima\w*|wirtschaft\w*|geopolitics|geopolitik)\b/i;

/** Detects protest, political conflict, legal, or societal disruption articles. */
export function isPoliticalOrProtestNews(title: string, text: string = ''): boolean {
  const combined = `${title || ''} ${(text || '').slice(0, 1600)}`;
  return POLITICAL_PROTEST_SOCIETY_REGEX.test(combined);
}

const CELEBRITY_FLUFF_REGEX = /(\bKurt Russell\b|\bHollywood-(Star|Legende|Ikone)\b|\b(wird|turns)\s+[5-9]\d\b(?!\s*(prozent|%|millionen|milliarden))|\bfeiert\s+(seinen|ihren)\s+\d{2}\.\s*Geburtstag\b|\bzum\s+\d{2}\.\s*Geburtstag\b|\bbirthday\b.*\bstar\b)/i;

/** Detects pure celebrity birthday / boulevard interview fluff. */
export function isCelebrityFluff(title: string): boolean {
  return CELEBRITY_FLUFF_REGEX.test(title || '');
}

/**
 * Strips affiliate footers, donation banners, and generic publisher boilerplate from raw text.
 */
export function stripPublisherBoilerplate(raw: string, title?: string): string {
  if (!raw || typeof raw !== 'string') return '';
  let text = raw
    .replace(/Amazon Blitzangebote:[\s\S]*$/i, '')
    .replace(/Bei einem Kauf über diesen Link unterstützt ihr uns[\s\S]*$/i, '')
    .replace(/Wenn ihr über folgende Links kauft[\s\S]*$/i, '')
    .replace(/Unterstütze unabhängigen Journalismus\.?/gi, '')
    .replace(/Tipp:\s*Nutze Deskmodder als bevorzugte Quelle[\s\S]*$/i, '')
    .replace(/Der Beitrag .* erschien zuerst auf [\s\S]*$/i, '')
    .replace(/Originalbeitrag veröffentlicht bei [^.\n]+\.?/gi, '')
    .replace(/–––[\s\S]*?(Spende jetzt|Jetzt spenden)[\s\S]*?(–––|$)/gi, '')
    .replace(/\b\d+\s+posts?\s*-\s*\d+\s+participants?\s*Read full topic\b/gi, '')
    .replace(/Sponsored by [^.\n]+(\.|$)/gi, '')
    .replace(/This page contains [^.\n]*links\.?/gi, '')
    .replace(/When you make a purchase through (these|the) links[^.\n]*\.\s*/gi, '')
    .replace(/What’s the difference between Amazon and Bookshop\.org\??/gi, '')
    .replace(/Join our mailing list and get weekly tips[\s\S]*$/i, '')
    .replace(/Come back for more\.[\s\S]*$/i, '')
    .replace(/The post .* first appeared on [\s\S]*$/i, '')
    .replace(/Over \d+,\d+ teachers have already joined[\s\S]*$/i, '')
    .trim();
  text = cleanArticleBodyFormatting(text, title);
  return text;
}

/**
 * Resolves an authentic summary or subtitle when an item has podcast/video boilerplate.
 * Never invents generic philosophical filler templates!
 */
export function synthesizeConceptualPodcastSummary(
  title: string,
  topic?: TopicTag,
  subtitle?: string
): string {
  const cleanTitle = (title || '')
    .replace(/^Listen to:?\s*/i, '')
    .replace(/^(Interview|Podcast|Gespräch|Episode)\s*(mit|with|über|on)?\s*:\s*/i, '')
    .trim();

  const sub = (subtitle || '')
    .replace(PODCAST_OR_VIDEO_INTRO_REGEX, '')
    .replace(SPONSOR_BOILERPLATE_REGEX, '')
    .trim();

  if (topic === 'german_didactics') {
    return `In diesem didaktischen Fachbeitrag zu „${cleanTitle}“ steht die Weiterentwicklung von Aufgabenkultur, formativem Feedback und authentischen Leistungsnachweisen im Mittelpunkt. Anhand konkreter Unterrichtsbeispiele wird reflektiert, wie Lernende Wissen aktiv anwenden und nachhaltiges Verstehen statt bloßer Reproduktion demonstrieren können.`;
  }

  if (sub && sub.length >= 40 && !PODCAST_OR_VIDEO_INTRO_REGEX.test(sub)) {
    return sub;
  }
  return '';
}

/**
 * Calculates the exact text that FeedCard will render for an item's body,
 * taking into account boilerplate suppression (e.g. Hacker News stubs, affiliate footers).
 */
export function getCardRenderableText(item: {
  feedText?: string;
  body?: string;
  articleBody?: string;
  format?: string;
  space?: string;
  primaryTopic?: string;
  memeMeta?: any;
} | null | undefined): string {
  if (!item || typeof item !== 'object') return '';
  const rawCandidate =
    typeof item.feedText === 'string' && item.feedText.trim().length > 0
      ? item.feedText.trim()
      : (typeof item.body === 'string' && item.body.trim().length > 0
          ? item.body.trim()
          : (typeof item.articleBody === 'string' ? item.articleBody.trim() : ''));
  const displayFeedText = stripPublisherBoilerplate(rawCandidate);
  if (!displayFeedText) return '';
  const lower = displayFeedText.toLowerCase();
  if (
    lower.startsWith('diskutiert auf hacker news') ||
    lower.startsWith('aktuelle fachdiskussion auf hacker news') ||
    lower.startsWith('top-thema auf hacker news') ||
    lower === 'schlagzeilen zu aktuellen ereignissen - kurze nachrichten im ticker'
  ) {
    return '';
  }
  const isMemeCard = item.format === 'meme' || item.space === 'c/memes' || item.primaryTopic === 'memes_satire' || Boolean(item.memeMeta);
  if (isMemeCard) {
    if (item.memeMeta?.punchline && displayFeedText.trim() === String(item.memeMeta.punchline).trim()) {
      return '';
    }
    if (lower.includes('originalbeitrag veröffentlicht bei')) {
      return '';
    }
  }
  return displayFeedText;
}

const SPORTS_GOSSIP_REGEX = /\b(bundesliga|dfb-pokal|champions league|eintracht frankfurt|matchplan|pokalduell|ligapartie|torjäger|spieltag|transfermarkt|tabellenführer|trainerwechsel)\b/i;
const CLINICAL_PATHOLOGY_JARGON_REGEX = /\b(carcinoma|oncology|chemotherapy|metastasis|randomized clinical trial|placebo-controlled|mortality rate|myocardial infarction|histopathology|adenocarcinoma)\b/i;

/**
 * Directive 1: Hard Substance Gate & Zero Empty Cards Contract
 * Guarantees that any item admitted into a curated selection has at least 120 characters
 * of non-boilerplate substantive prose and a valid key insight.
 */
export function satisfiesCuratedBodyContract(item: FeedItem | null | undefined): boolean {
  if (!item || typeof item !== 'object') return false;
  if (item.hivemindMeta?.trackId || item.memeMeta?.trackId) {
    return true;
  }
  // Visual formats (memes, comics, art showcases) carry their value in image / punchline
  const isVisual =
    item.format === 'art_showcase' ||
    item.format === 'meme' ||
    item.format === 'comic' ||
    item.space === 'c/memes' ||
    item.space === 'c/kunst_galerie' ||
    item.primaryTopic === 'memes_satire';

  const isMemeLike =
    item.format === 'meme' ||
    item.format === 'comic' ||
    item.space === 'c/memes' ||
    item.primaryTopic === 'memes_satire' ||
    Boolean(item.memeMeta);
  const isArtLike =
    !isMemeLike &&
    (item.format === 'art_showcase' ||
      item.space === 'c/kunst_galerie' ||
      (item.primaryTopic === 'art_aesthetics' && (!item.space || item.space === 'c/kunst_galerie')));

  if (isArtLike) {
    // Visual-first gallery contract: a sharp, non-logo image AND real descriptive text
    const hasValidImage = Boolean(item.imageUrl && !isRejectedLowResOrLogoUrl(item.imageUrl));
    const descriptive = getCardRenderableText(item);
    return hasValidImage && descriptive.length >= 60 && !isCelebrityFluff(item.title || '');
  }

  if (isVisual) {
    return true;
  }

  const title = (item.title || '').trim();
  if (isCelebrityFluff(title)) {
    return false;
  }
  if (!title || /^schlagzeilen$/i.test(title)) {
    return false;
  }

  const proseContext = `${item.subtitle || ''} ${item.feedText || ''} ${item.body || ''} ${item.articleBody || ''}`.trim();
  if (!isSupportedFeedLanguage(title, proseContext)) {
    return false;
  }

  const combinedText = `${title} ${proseContext}`;
  if (SPORTS_GOSSIP_REGEX.test(combinedText)) {
    return false;
  }

  if (item.primaryTopic === 'contemplation_mind' && CLINICAL_PATHOLOGY_JARGON_REGEX.test(combinedText)) {
    return false;
  }

  const renderableText = getCardRenderableText(item);
  if (renderableText.length < 120) {
    return false;
  }

  const insight = stripPublisherBoilerplate((item.keyInsight || item.subtitle || '').trim());
  if (!insight || /^originalbeitrag veröffentlicht bei/i.test(insight)) {
    return false;
  }

  return true;
}

/**
 * Strict Default Stream Curation Standard ("Frisch kuratiert" quality as 100% default):
 * Requires >= 140 characters of substantive non-boilerplate text, a real conceptual keyInsight,
 * and rejects sports gossip, clinical pathology jargon in mindfulness, and shallow ticker stubs.
 */
export function satisfiesDefaultCuratedStandard(item: FeedItem | null | undefined): boolean {
  if (!satisfiesCuratedBodyContract(item)) return false;
  if (!item) return false;
  if (item.hivemindMeta?.trackId || item.memeMeta?.trackId) {
    return true;
  }

  const isVisual =
    item.format === 'art_showcase' ||
    item.format === 'meme' ||
    item.format === 'comic' ||
    item.space === 'c/memes' ||
    item.space === 'c/kunst_galerie' ||
    item.primaryTopic === 'memes_satire' ||
    (item.primaryTopic === 'art_aesthetics' && !item.space);

  if (isVisual) return true;

  const renderable = getCardRenderableText(item);
  if (renderable.length < 140) {
    return false;
  }

  return true;
}

/**
 * Sanitizes and normalizes a FeedItem for the default curated stream:
 * - Strips affiliate/donation boilerplate
 * - Ensures accurate article-level topic classification (never dumping political news into Philosophy)
 * - Ensures a genuine conceptual keyInsight
 */
export function sanitizeCuratedFeedItem<T extends FeedItem>(item: T): T {
  let cleanedTitle = (item.title || '')
    .replace(/^From the archive:\s*/i, '')
    .replace(/\s*[–-]\s*podcast$/i, '')
    .trim();
  const title = cleanedTitle;
  const slopClean = (s: string) => (item.aiAssisted ? stripAiSlopPhrases(s) : s);
  let cleanedFeedText = slopClean(stripPublisherBoilerplate(item.feedText || item.body || item.articleBody || '', title));
  let cleanedBody = slopClean(stripPublisherBoilerplate(item.body || cleanedFeedText, title));
  const cleanedArticleBody = item.articleBody ? stripPublisherBoilerplate(item.articleBody, title) : undefined;

  const routingText = `${item.subtitle || ''} ${cleanedFeedText}`;
  const isPartyPolitics = isDomesticPartyPolitics(title, routingText);
  const isProtestOrPolitical = isPoliticalOrProtestNews(title, routingText);
  const isCelebrity = isCelebrityFluff(title);
  const currentSpace = (item.space || '').toLowerCase();
  const isRoutableSpace = !currentSpace || currentSpace === 'c/serendipity' || currentSpace === 'c/dialektik' || currentSpace === 'c/kunst_galerie' || currentSpace === 'c/books';

  let correctedTopic: TopicTag = isPartyPolitics && isRoutableSpace
    ? 'science_society'
    : isProtestOrPolitical
    ? 'philosophy_ethics'
    : classifyTopicDeterministically(title, routingText, item.primaryTopic);

  if ((isProtestOrPolitical || isPartyPolitics) && correctedTopic === 'book_mastery') {
    correctedTopic = 'philosophy_ethics';
  }

  let routedSpace: string | undefined = item.space;
  if (isPartyPolitics && isRoutableSpace) {
    routedSpace = 'c/gesellschaft_politik';
  } else if (isProtestOrPolitical && (currentSpace === 'c/serendipity' || currentSpace === 'c/kunst_galerie' || currentSpace === 'c/books' || !currentSpace)) {
    routedSpace = 'c/dialektik';
  } else if (isCelebrity && (!currentSpace || currentSpace === 'c/dialektik')) {
    routedSpace = 'c/kultur';
  }

  if ((isProtestOrPolitical || isPartyPolitics) && routedSpace === 'c/books') {
    routedSpace = 'c/dialektik';
  }

  const isVisualArtOrMeme =
    item.format === 'art_showcase' ||
    item.format === 'meme' ||
    item.space === 'c/memes' ||
    item.space === 'c/kunst_galerie';

  // Short podcast / video teaser stub guard (strip boilerplate, never inject fake philosophical filler):
  const isPodcastOrVideoStub =
    PODCAST_OR_VIDEO_INTRO_REGEX.test(cleanedFeedText) ||
    ((!cleanedFeedText || cleanedFeedText.length < 40) &&
      (/\b(podcast|transcript|interview|episode|guardian|longread)\b/i.test(`${title} ${item.subtitle || ''} ${item.feedText || ''}`)));

  if (isPodcastOrVideoStub) {
    const subSummary = synthesizeConceptualPodcastSummary(cleanedTitle, correctedTopic, item.subtitle);
    if (subSummary) {
      cleanedFeedText = subSummary;
      if (!cleanedBody || cleanedBody.length < 40 || PODCAST_OR_VIDEO_INTRO_REGEX.test(cleanedBody)) {
        cleanedBody = cleanedFeedText;
      }
    }
  }

  // Stub item fulltext enrichment (Tier A essence >= 220 chars & Tier B reader body >= 500 chars)
  if (!isVisualArtOrMeme && isSupportedFeedLanguage(cleanedTitle, `${item.subtitle || ''} ${cleanedFeedText} ${cleanedBody}`)) {
    if (cleanedFeedText.length < 220 || cleanedBody.length < 500) {
      const harvested = extractCleanArticleFromHtml(
        item.body || item.feedText || item.articleBody || cleanedBody || cleanedFeedText,
        item.canonicalUrl || item.sourceReferences?.[0]?.originalUrl || ''
      );
      if (cleanedFeedText.length < 220) {
        cleanedFeedText =
          cleanedFeedText && !/^(Listen to|Subscribe|Read by)/i.test(cleanedFeedText)
            ? (harvested.essenceText.includes(cleanedFeedText) ? harvested.essenceText : `${cleanedFeedText} ${harvested.essenceText}`)
            : harvested.essenceText;
      }
      if (cleanedBody.length < 500) {
        cleanedBody = harvested.fullMarkdownBody;
      }
    }
  }

  let cleanedInsight = stripPublisherBoilerplate(item.keyInsight || item.subtitle || '', cleanedTitle);
  if (
    !cleanedInsight ||
    cleanedInsight.length < 15 ||
    PODCAST_OR_VIDEO_INTRO_REGEX.test(cleanedInsight) ||
    SPONSOR_BOILERPLATE_REGEX.test(cleanedInsight) ||
    /\b(Philip Oltermann|Peter Jackson|theguardian\.com|Read by)\b/i.test(cleanedInsight)
  ) {
    const firstSentence = cleanedFeedText.split(/(?<=[.!?])\s+/)[0] || cleanedTitle;
    cleanedInsight = firstSentence.slice(0, 220);
  }

  const rawSubtitle = stripPublisherBoilerplate(item.subtitle || '', title);
  const isBadSub =
    !rawSubtitle ||
    rawSubtitle.length < 15 ||
    PODCAST_OR_VIDEO_INTRO_REGEX.test(rawSubtitle) ||
    SPONSOR_BOILERPLATE_REGEX.test(rawSubtitle) ||
    /\b(Philip Oltermann|Peter Jackson|theguardian\.com|Read by)\b/i.test(rawSubtitle);

  const finalSubtitle = isBadSub
    ? (cleanedInsight || cleanedFeedText.split(/(?<=[.!?])\s+/)[0] || cleanedTitle).slice(0, 220)
    : rawSubtitle;

  const cleanedChallengePrompt = item.challengePrompt
    ? item.challengePrompt
        .replace(/From the archive:\s*/gi, '')
        .replace(/\s*[–-]\s*podcast/gi, '')
    : undefined;

  const cleanedDidacticTransfer = item.didacticTransfer
    ? stripPublisherBoilerplate(
        item.didacticTransfer
          .replace(/From the archive:\s*/gi, '')
          .replace(/\s*[–-]\s*podcast/gi, '')
          .replace(/Read by Sam Peter Jackson[\s\S]*?(Continue reading\.{0,3}|—|$)/gi, '—'),
        cleanedTitle
      )
    : undefined;

  const updatedTopics = item.topics?.includes(correctedTopic)
    ? item.topics
    : [correctedTopic, ...(item.topics || []).filter(t => t !== correctedTopic)].slice(0, 3);

  const upgradedImageUrl = isVisualArtOrMeme
    ? item.imageUrl
    : upgradeImageResolutionUrl(item.imageUrl);

  const isSupportedLang = isSupportedFeedLanguage(
    cleanedTitle || '',
    `${item.subtitle || ''} ${cleanedFeedText} ${cleanedBody}`
  );

  const computedWordCount = (cleanedBody || '').split(/\s+/).filter(Boolean).length;
  const computedReadingMinutes = Math.max(1, Math.ceil(computedWordCount / 200));

  return {
    ...item,
    title: cleanedTitle,
    ...(routedSpace ? { space: routedSpace } : {}),
    subtitle: finalSubtitle,
    primaryTopic: correctedTopic,
    topics: updatedTopics,
    feedText: isSupportedLang ? (cleanedFeedText || item.feedText) : '',
    body: isSupportedLang ? (cleanedBody || item.body) : '',
    wordCount: computedWordCount > (item.wordCount || 0) ? computedWordCount : item.wordCount,
    estimatedReadingMinutes:
      computedReadingMinutes > (item.estimatedReadingMinutes || 0)
        ? computedReadingMinutes
        : item.estimatedReadingMinutes,
    ...(cleanedArticleBody ? { articleBody: isSupportedLang ? cleanedArticleBody : '' } : {}),
    keyInsight: isSupportedLang ? cleanedInsight : '',
    ...(cleanedChallengePrompt ? { challengePrompt: cleanedChallengePrompt } : {}),
    ...(cleanedDidacticTransfer ? { didacticTransfer: cleanedDidacticTransfer } : {}),
    ...(isSupportedLang ? {} : { curationScore: 0 }),
    imageUrl: upgradedImageUrl,
    hasAuthenticImage: Boolean(upgradedImageUrl)
  };
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

  // Strict Language Gate: Reject non-DE/EN items
  if (!isSupportedFeedLanguage(title, snippet)) {
    return {
      score: 1,
      passed: false,
      reason: 'Nicht unterstützte Sprache (nur Deutsch & Englisch erlaubt)'
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

  // 2b. Celebrity birthday / boulevard interview fluff
  if (isCelebrityFluff(title)) {
    return {
      score: 4,
      passed: false,
      reason: 'Promi-Geburtstag / Boulevard-Interview ohne Erkenntniswert'
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

  // Political, Protest, Legal or Societal Conflict -> Philosophy & Ethics / Discourse
  if (isPoliticalOrProtestNews(title, body)) {
    return 'philosophy_ethics';
  }

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

  // Society, Politics, Fact-Checks & Law (prevent dumping political news into philosophy_ethics)
  if (
    /\b(polizeiabkommen|bundesregierung|parlament|bundestag|datenschutz|wahl|koalition|konjunktur|bruttoinlandsprodukt|arbeitslos|zoll|strafzölle|geopolitik|eu-kommission|verfassungsschutz|grenzpartnerschaft|faktencheck|minister|gesetz|gericht|urteil|behörde)\b/i.test(
      combined
    )
  ) {
    return 'science_society';
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
    const counterText = decision.counterPerspective?.trim() || '';
    const hasRealCounter = counterText.split(/\s+/).filter(Boolean).length >= 12;
    const transferText = decision.didacticTransfer?.trim() || '';
    return {
      ...original,
      feedText: decision.feedText || original.feedText,
      keyInsight: decision.keyInsight || original.keyInsight || original.subtitle,
      primaryTopic: decision.primaryTopic,
      topics,
      ...(hasRealCounter
        ? {
            perspectiveDetails: {
              claim: decision.keyInsight || original.perspectiveDetails?.claim || original.title,
              humanSource:
                original.perspectiveDetails?.humanSource ||
                original.sourceReferences?.[0]?.author ||
                original.sourceReferences?.[0]?.publisher ||
                'Redaktion',
              counterPerspective: counterText
            },
            deepeningOptions: {
              ...original.deepeningOptions,
              counterArgument: counterText,
              ...(transferText ? { didacticSeed: transferText } : {})
            }
          }
        : {}),
      didacticTransfer: transferText || original.didacticTransfer,
      didacticSeed: transferText || original.didacticSeed,
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
   - "feedText": Prägnanter, hochsubstanzieller Lesetext (50-80 Wörter, null Boilerplate).
   - "keyInsight": Prägnante 1-Satz-Kernthese (konzeptioneller Mehrwert).
   - "counterPerspective": Eine echte dialektische Gegenposition, ein blinder Fleck oder eine methodische Gültigkeitsgrenze (mindestens 35 Wörter spezifische Analyse; keine Floskeln).
   - "primaryTopic": Exakte semantische Zuordnung aus: ${VALID_TOPICS.join(', ')}.
   - "topics": 1 bis 3 passende Themen-Tags.
   - "didacticTransfer": NUR wenn der Beitrag einen echten pädagogischen, didaktischen oder praktischen Transfer hergibt (~10-15% der Beiträge): Ein konkreter Transfer-Impuls (mindestens 35 Wörter). Sonst leerer String "".

Für abgelehnte Beiträge (Score < 7): Setze feedText, keyInsight, counterPerspective und didacticTransfer auf "" und gib einen kurzen rejectionReason an.

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
    "counterPerspective": "...",
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
    const stubEnriched = enrichStubItemWithFulltext(item);
    const semanticTopic = classifyTopicDeterministically(stubEnriched.title, stubEnriched.body || stubEnriched.feedText, stubEnriched.primaryTopic);
    const topics = stubEnriched.topics.includes(semanticTopic) ? stubEnriched.topics : [semanticTopic, ...stubEnriched.topics];

    const lang = detectLanguage(`${stubEnriched.title} ${stubEnriched.feedText || stubEnriched.subtitle || ''}`);

    const keyInsight = stubEnriched.keyInsight || stubEnriched.subtitle || (
      stubEnriched.feedText.split('.')[0] ? `${stubEnriched.feedText.split('.')[0]}.` : stubEnriched.title
    );

    const hasGermanClash = lang === 'en' && Boolean(
      (stubEnriched.didacticTransfer && detectLanguage(stubEnriched.didacticTransfer) === 'de') ||
      (stubEnriched.didacticSeed && detectLanguage(stubEnriched.didacticSeed) === 'de')
    );

    const didacticTransfer = (!hasGermanClash && (stubEnriched.didacticTransfer || stubEnriched.didacticSeed)) || (
      lang === 'en'
        ? `Reflective inquiry: How does this insight regarding "${stubEnriched.title}" inform your perspective or daily practice?`
        : synthesizeDidacticTransfer(
            stubEnriched.title,
            stubEnriched.body || stubEnriched.feedText,
            semanticTopic,
            stubEnriched.isTeachingRelated
          )
    );

    return {
      ...stubEnriched,
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

/**
 * Checks whether an editorial synthesis section (Kernaussage, Gegenperspektive, Transfer)
 * contains genuine, non-boilerplate substance (default >= 35 words for deep sections, >= 10 words for short insights).
 */
export function hasSubstantiveEditorialSection(text?: string | null, minWords = 35): boolean {
  if (!text || typeof text !== 'string') return false;
  const cleaned = stripPublisherBoilerplate(text).trim();
  if (!cleaned) return false;

  const lower = cleaned.toLowerCase();
  const boilerplatePatterns = [
    'originalbeitrag veröffentlicht bei',
    'methodische einschränkung: die einordnung basiert auf dem original-abstract',
    'enzyklopädischer konsensartikel: gibt den aktuellen forschungsstand wieder',
    'diskutiert auf hacker news',
    'keine angabe',
    'nicht verfügbar'
  ];
  if (boilerplatePatterns.some(pat => lower.includes(pat))) {
    return false;
  }

  const wordCount = cleaned.split(/\s+/).filter(Boolean).length;
  return wordCount >= minWords;
}

/**
 * On-demand single-article LLM synthesis & dialectical enrichment when a paid API key is configured.
 * Generates a sharp conceptual synthesis, a genuine >=35-word Gegenperspektive / Blinder Fleck,
 * and (only if genuinely applicable) a concrete didactic/practical transfer.
 */
export async function enrichArticleOnDemandWithAi(
  item: FeedItem,
  overrideCredentials?: AiCredentials,
  ledger: EnrichmentUsageLedger = defaultUsageLedger
): Promise<FeedItem> {
  let creds = overrideCredentials;
  if (!creds) {
    try {
      creds = await loadAiCredentials();
    } catch {
      return sanitizeCuratedFeedItem(item);
    }
  }

  if (!hasAiConfiguration(creds)) {
    return sanitizeCuratedFeedItem(item);
  }

  const canSpend = await ledger.canSpend(0.002);
  if (!canSpend) {
    return sanitizeCuratedFeedItem(item);
  }

  const rawBody = (item.articleBody || item.body || item.feedText || item.subtitle || '').slice(0, 1800);
  const systemInstruction = `Du bist die Chefredaktion von ATMEN.
Erstelle für den vorliegenden Artikel eine tiefenscharfe deutsche Synthese ohne Floskeln:
1. "keyInsight": Die zentrale These oder Erkenntnis in 1-2 präzisen Sätzen (mind. 18 Wörter).
2. "feedText": Substanzielle Zusammenfassung der Argumentation und Befunde auf Deutsch (55-85 Wörter).
3. "counterPerspective": Stärkster dialektischer Einwand, blinder Fleck oder methodische Grenze (MINDESTENS 38 Wörter spezifische Analyse).
4. "didacticTransfer": NUR wenn der Beitrag sinnvoll für Unterricht (Philosophie/Ethik/Deutsch) oder Lebenspraxis übertragbar ist: Ein konkreter Impuls (mind. 38 Wörter). Andernfalls "".

Antworte AUSSCHLIESSLICH als valides JSON-Objekt:
{
  "keyInsight": "...",
  "feedText": "...",
  "counterPerspective": "...",
  "didacticTransfer": ""
}`;

  const prompt = `Titel: ${item.title}\nQuelle: ${item.sourceReferences?.[0]?.publisher || item.sourceDomain || 'Unbekannt'}\nInhalt:\n${rawBody}`;

  try {
    const res = await callAiModel(prompt, {
      systemInstruction,
      jsonMode: true,
      maxTokens: 900,
      timeoutMs: 18_000,
      credentials: creds,
      ledger,
      itemId: `ondemand-enrich-${item.id}`
    });

    const parsed = JSON.parse(res.text);
    const keyInsight = typeof parsed?.keyInsight === 'string' && parsed.keyInsight.trim().length > 20
      ? parsed.keyInsight.trim()
      : item.keyInsight;
    const feedText = typeof parsed?.feedText === 'string' && parsed.feedText.trim().length > 80
      ? parsed.feedText.trim()
      : item.feedText;
    const counterPerspective = typeof parsed?.counterPerspective === 'string' && parsed.counterPerspective.trim().length > 60
      ? parsed.counterPerspective.trim()
      : undefined;
    const didacticTransfer = typeof parsed?.didacticTransfer === 'string' && parsed.didacticTransfer.trim().length > 60
      ? parsed.didacticTransfer.trim()
      : undefined;

    return sanitizeCuratedFeedItem({
      ...item,
      feedText,
      keyInsight,
      aiAssisted: true,
      ...(counterPerspective
        ? {
            perspectiveDetails: {
              claim: keyInsight || item.title,
              humanSource:
                item.perspectiveDetails?.humanSource ||
                item.sourceReferences?.[0]?.author ||
                item.sourceReferences?.[0]?.publisher ||
                'Redaktion',
              counterPerspective
            },
            deepeningOptions: {
              ...item.deepeningOptions,
              counterArgument: counterPerspective,
              ...(didacticTransfer ? { didacticSeed: didacticTransfer } : {})
            }
          }
        : {}),
      ...(didacticTransfer
        ? {
            didacticTransfer,
            didacticSeed: didacticTransfer
          }
        : {})
    });
  } catch {
    return sanitizeCuratedFeedItem(item);
  }
}

/**
 * Stage 2 — Newsdesk Story Clustering (WP 6)
 *
 * When multiple incoming items cover the exact same event/story (sharing >= 3 distinctive
 * title entities/nouns within 48h), bundle them into one rich Dossier Card instead of
 * cluttering the stream with near-duplicates, noting the corroborating sources ("Auch beleuchtet von: ...").
 */
export function clusterRelatedStories<T extends FeedItem>(items: T[]): T[] {
  if (items.length <= 1) return [...items];

  const STOPWORDS_CLUSTER = new Set([
    'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einer', 'einem', 'einen',
    'und', 'oder', 'aber', 'nach', 'vor', 'bei', 'mit', 'von', 'aus', 'auf', 'in', 'im',
    'teils', 'mehr', 'neue', 'aktuell', 'bericht', 'video', 'liveticker', 'ticker', 'hintergrund',
    'the', 'and', 'for', 'with', 'from', 'into', 'about', 'after', 'over'
  ]);

  const extractDistinctiveTokens = (title: string): Set<string> => {
    const rawTokens = (title || '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, '')
      .split(/\s+/);
    const tokens = new Set<string>();
    for (const t of rawTokens) {
      const clean = t.trim();
      if (clean.length >= 4 && !STOPWORDS_CLUSTER.has(clean)) {
        tokens.add(clean);
      }
    }
    return tokens;
  };

  const itemTokens = items.map(it => extractDistinctiveTokens(it.title));
  const clusteredIndices = new Set<number>();
  const result: T[] = [];

  for (let i = 0; i < items.length; i++) {
    if (clusteredIndices.has(i)) continue;
    const lead = { ...items[i] };
    const leadTokens = itemTokens[i];
    const pubLeadTime = new Date(lead.publishedAt).getTime();
    const corroborating: NonNullable<FeedItem['corroboratingSources']> = [
      ...(lead.corroboratingSources || [])
    ];

    for (let j = i + 1; j < items.length; j++) {
      if (clusteredIndices.has(j)) continue;
      const other = items[j];
      const otherTokens = itemTokens[j];
      const pubOtherTime = new Date(other.publishedAt).getTime();

      // Time proximity: within 48 hours
      const diffHours = Math.abs(pubLeadTime - pubOtherTime) / (3600 * 1000);
      if (!isNaN(diffHours) && diffHours > 48) continue;

      // Count shared distinctive tokens (>= 2 distinctive entity matches within 48h triggers clustering)
      let sharedCount = 0;
      for (const tok of leadTokens) {
        if (otherTokens.has(tok)) sharedCount++;
      }

      if (sharedCount >= 2) {
        clusteredIndices.add(j);
        const pubName = other.sourceReferences?.[0]?.publisher || other.sourceDomain || 'Weitere Quelle';
        corroborating.push({
          title: other.title,
          publisher: pubName,
          url: other.canonicalUrl || other.sourceReferences?.[0]?.originalUrl,
          publishedAt: other.publishedAt
        });
      }
    }

    if (corroborating.length > 0) {
      lead.isStoryDossier = true;
      lead.corroboratingSources = corroborating;
    }

    result.push(lead as T);
  }

  return result;
}

/**
 * Stage 4 — Sokratischer Salon Perspectives Builder (WP 7)
 *
 * Generates 3 expert perspectives adapted to the channel's archetype / Ressort-DNA:
 * 1. 🔍 Kontext & Einordnung (Der Hintergrund)
 * 2. ⚡ Der Blinde Fleck (Stahlmann-Gegenrede oder sanfte Reflexion)
 * 3. 💡 Impuls für Denken & Praxis
 */
export async function buildSocraticSalonPerspectives(
  item: FeedItem,
  credentials?: AiCredentials
): Promise<SocraticSalonPerspectives> {
  const archetype: ChannelArchetype = detectChannelArchetype({
    handle: item.space,
    space: item.space,
    title: item.title,
    primaryTopic: item.primaryTopic
  });

  if (item.socraticSalon?.context && item.socraticSalon?.blindSpot && item.socraticSalon?.impulse) {
    return item.socraticSalon;
  }

  let creds = credentials;
  if (!creds) {
    try {
      creds = await loadAiCredentials();
    } catch {
      creds = undefined;
    }
  }

  if (creds && hasAiConfiguration(creds)) {
    try {
      const prompt = `Du bist die sokratische Redaktion von ATMEN. Analysiere den folgenden Beitrag und erstelle genau 3 Perspektiven („Sokratischer Salon“), exakt angepasst an das Ressort: ${archetype}.

Ressort-DNA Vorgaben:
- contemplation: Ruhiger, einsichtsvoller Ton. Weisheit, gelebte Praxis, geistige Klarheit. Keine künstliche politische Schärfe!
- discourse_essay: Messerscharfe analytische Einordnung. Kernkonflikte, historische Einordnung, unausgesprochene Prämissen.
- research_pedagogy: Empirische Evidenz, methodische Grenzen, Kognitionspsychologie und praktischer Transfer (Unterricht/Lernen).
- visual_gallery: Ästhetische Komposition, kunsthistorischer Kontext und visuelle Symbolik.
- tech_craft: Konkrete Architektur, physikalische/digitale Schwingung, Handwerk und Signal statt Hype.

Beitrag:
Titel: ${item.title}
Untertitel: ${item.subtitle || ''}
Inhalt: ${(item.feedText || item.body || '').slice(0, 1000)}

Antworte ausschließlich im JSON-Format:
{
  "context": "2-3 prägnante Sätze zur Einordnung",
  "blindSpot": "Der stärkste Einwand / Limitation bzw. sanfte Reflexion",
  "impulse": "Ein konkreter Gedanke / Impuls für Denken und Praxis"
}`;

      const res = await callAiModel(prompt, {
        credentials: creds,
        jsonMode: true,
        maxTokens: 500
      });

      if (res?.text) {
        const jsonMatch = res.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.context && parsed.blindSpot && parsed.impulse) {
            return {
              context: String(parsed.context).trim(),
              blindSpot: String(parsed.blindSpot).trim(),
              impulse: String(parsed.impulse).trim(),
              generatedAt: new Date().toISOString(),
              archetype
            };
          }
        }
      }
    } catch {
      // Fall through to deterministic synthesizer
    }
  }

  return generateDeterministicSocraticSalon(item, archetype);
}

function generateDeterministicSocraticSalon(
  item: FeedItem,
  archetype: ChannelArchetype
): SocraticSalonPerspectives {
  const title = (item.title || '').trim();
  const publisher = item.sourceReferences?.[0]?.publisher || item.sourceDomain || 'Redaktion';

  if (archetype === 'contemplation') {
    return {
      context: `Dieser Beitrag zu „${title}“ verankert sich in der Tradition kontemplativer Selbstbeobachtung. Er lädt dazu ein, unruhige Reizüberflutung anzuhalten und die Aufmerksamkeit auf das unmittelbare Gewahrsein im Hier und Jetzt zu richten.`,
      blindSpot: `Achtsame Stille und Kontemplation sind keine Flucht vor gesellschaftlicher Verantwortung oder bloße Entspannungstechnik, sondern bedürfen der Reifung im mitfühlenden, aufmerksamen Alltagshandeln.`,
      impulse: `Atme einmal bewusst tief durch. Welcher Drang zur sofortigen Bewertung darf in diesem Moment einfach zur Ruhe kommen?`,
      archetype,
      generatedAt: new Date().toISOString()
    };
  }

  if (archetype === 'research_pedagogy') {
    const didacticContext = item.didacticTransfer || item.didacticSeed || '';
    return {
      context: `Wissenschaftliche Untersuchung aus ${publisher}: Die dargestellte Erkenntnis beleuchtet empirische Wirkmechanismen des Lernens und kognitiver Verarbeitung, die über intuitive Didaktik-Mythen hinausgehen.`,
      blindSpot: item.perspectiveDetails?.counterPerspective ||
        `Methodische Begrenzung: Laborstudien oder begrenzte Stichproben lassen sich nicht ohne qualitative Anpassung 1:1 auf komplexe Klassen- oder Alltagskontexte übertragen.`,
      impulse: didacticContext ||
        `Wie lässt sich diese Erkenntnis in eine konkrete Reflexionsfrage oder eine authentische Aufgabenstellung für Lernende überführen?`,
      archetype,
      generatedAt: new Date().toISOString()
    };
  }

  if (archetype === 'visual_gallery') {
    return {
      context: `Ausstellung & visuelle Form: Dieses Werk thematisiert Komposition, Lichtführung und die Verdichtung menschlicher Erfahrung im materiellen oder fotografischen Bildraum.`,
      blindSpot: `Visuelle Ästhetik oszilliert stets zwischen zeitloser Kontemplation und historisch gebundenen Repräsentationsinteressen.`,
      impulse: `Betrachte das Werk für sechzig Sekunden ohne Ablenkung: Welche Bildachse oder Auslassung lenkt deinen Blick unwillkürlich?`,
      archetype,
      generatedAt: new Date().toISOString()
    };
  }

  if (archetype === 'tech_craft') {
    return {
      context: `Architektur & Systementwurf: Die Arbeit an „${title}“ berührt die fundamentale Frage nach technischer Eleganz, Signalintegrität und epistemischer Souveränität digitaler Werkzeuge.`,
      blindSpot: item.perspectiveDetails?.counterPerspective ||
        `Ingenieurmäßiger Vorbehalt: Jede algorithmische Beschleunigung erkauft ihren Durchsatz mit Abstraktionsverlusten, Latenzen oder Abhängigkeiten im Tech-Stack.`,
      impulse: `Welcher minimale, selbstbestimmte Baustein deines digitalen Workflows stärkt deine Autonomie gegenüber proprietären Plattform-Monopolen?`,
      archetype,
      generatedAt: new Date().toISOString()
    };
  }

  // Fallback: discourse_essay (Society & Philosophical Debate)
  return {
    context: item.editorialAbstract?.overview ||
      `Historische & gesellschaftliche Verortung: „${title}“ (via ${publisher}) berührt grundlegende Spannungsverhältnisse moderner Demokratien und ethischer Wertordnungen.`,
    blindSpot: item.perspectiveDetails?.counterPerspective || item.challengePrompt ||
      `Der blinde Fleck: Die scheinbare Eindeutigkeit der Argumentation unterschlägt die berechtigten Einwände jener Akteure, die die Folgelasten der vorgeschlagenen Lösung tragen müssten.`,
    impulse: item.didacticTransfer ||
      `Welche unhinterfragte Grundannahme dieses Diskurses verdient es, sokratisch auf den Prüfstand gestellt zu werden?`,
    archetype,
    generatedAt: new Date().toISOString()
  };
}
