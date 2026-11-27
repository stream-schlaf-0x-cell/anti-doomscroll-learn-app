import { FeedItem, TopicTag } from '../domain/types';
import { VERIFIED_FEED_SOURCES } from '../ingestion/sources';
import { RawFeedSource } from '../ingestion/types';
import { normalizeSpaceHandle } from '../spaces/spaceRepository';
import {
  AiCredentials,
  callAiModel,
  extractJsonFromAiResponse,
  hasAiConfiguration,
  loadAiCredentials
} from '../ai/atmenAiClient';
import { defaultSnapshotLoader } from '../feed/SnapshotLoader';
import {
  isCelebrityFluff,
  isDoomscrollOrOffTopicNoise,
  isIncomprehensibleWetLabPaper,
  isSupportedFeedLanguage,
  sanitizeCuratedFeedItem,
  satisfiesDefaultCuratedStandard,
  upgradeImageResolutionUrl
} from '../enrichment/batchEnricher';
import { isRejectedLowResOrLogoUrl } from '../utils/imageQuality';

export interface TopicQueryPlan {
  deKeywords: string[];
  enKeywords: string[];
  wikipediaQueries: string[];
  openAlexQuery: string;
  hnQueries: string[];
  youtubeQueries: string[];
  matchingRssUrls: string[];
  avoidTerms: string[];
  usedAi: boolean;
}

export interface TopicPremiumPipelineInput {
  handle: string;
  title: string;
  description?: string;
  primaryTopic: TopicTag;
  seedSources?: string[];
  existingIds?: Set<string>;
  existingUrls?: Set<string>;
  targetCount?: number;
  credentials?: AiCredentials;
  skipNetworkInTests?: boolean;
  onProgress?: (label: string) => void;
}

export interface TopicPremiumPipelineResult {
  plan: TopicQueryPlan;
  items: FeedItem[];
  usedAi: boolean;
  laneCounts: {
    snapshot: number;
    rss: number;
    wikipedia: number;
    openAlex: number;
    hnArticles: number;
    hnYoutube: number;
  };
}

type PipelineLane = 'snapshot' | 'rss' | 'wikipedia' | 'openalex' | 'hn_article' | 'hn_youtube';

interface PipelineCandidate {
  item: FeedItem;
  lane: PipelineLane;
  fromSeedSource: boolean;
  topicScore: number;
  baseScore: number;
}

interface Rss2JsonEntry {
  title?: string;
  pubDate?: string;
  link?: string;
  guid?: string;
  author?: string;
  thumbnail?: string;
  description?: string;
  content?: string;
  enclosure?: {
    link?: string;
    type?: string;
  };
}

interface Rss2JsonResponse {
  status?: string;
  feed?: {
    title?: string;
    author?: string;
  };
  items?: Rss2JsonEntry[];
}

interface WikipediaSearchHit {
  title?: string;
  pageid?: number;
}

interface WikipediaSearchResponse {
  query?: {
    search?: WikipediaSearchHit[];
  };
}

interface WikipediaSummaryResponse {
  type?: string;
  title?: string;
  description?: string;
  extract?: string;
  pageid?: number;
  timestamp?: string;
  originalimage?: { source?: string };
  thumbnail?: { source?: string };
  content_urls?: {
    desktop?: { page?: string };
  };
}

interface OpenAlexAuthorship {
  author?: {
    display_name?: string;
  };
}

interface OpenAlexWork {
  id?: string;
  doi?: string;
  title?: string;
  publication_date?: string;
  cited_by_count?: number;
  abstract_inverted_index?: Record<string, number[]>;
  primary_location?: {
    landing_page_url?: string;
    source?: {
      display_name?: string;
    };
  };
  authorships?: OpenAlexAuthorship[];
}

interface OpenAlexResponse {
  results?: OpenAlexWork[];
}

interface HnAlgoliaHit {
  objectID?: string;
  title?: string;
  url?: string;
  author?: string;
  points?: number;
  num_comments?: number;
  created_at?: string;
  story_text?: string;
}

interface HnAlgoliaResponse {
  hits?: HnAlgoliaHit[];
}

interface NoembedResponse {
  title?: string;
  author_name?: string;
  error?: string;
}

interface AiQueryPlanPayload {
  deKeywords?: unknown;
  enKeywords?: unknown;
  wikipediaQueries?: unknown;
  openAlexQuery?: unknown;
  hnQueries?: unknown;
  youtubeQueries?: unknown;
  avoidTerms?: unknown;
}

interface AiEditorDecisionRaw {
  id?: unknown;
  keep?: unknown;
  editorialScore?: unknown;
  isGem?: unknown;
}

interface AiEditorCurationPayload {
  decisions?: unknown;
}

const STOPWORDS = new Set<string>([
  'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einer', 'einem', 'einen', 'eines',
  'und', 'oder', 'aber', 'doch', 'für', 'von', 'vom', 'mit', 'aus', 'über', 'unter', 'durch',
  'nach', 'beim', 'wie', 'was', 'wer', 'wen', 'wem', 'wo', 'wann', 'warum', 'sowie', 'rund',
  'zum', 'zur', 'im', 'in', 'am', 'an', 'auf', 'als', 'auch', 'bei', 'bis', 'dass', 'mehr',
  'nicht', 'nur', 'noch', 'schon', 'sehr', 'sich', 'sind', 'wird', 'werden', 'sein', 'haben',
  'the', 'and', 'for', 'with', 'from', 'into', 'about', 'that', 'this', 'these', 'those',
  'are', 'was', 'were', 'how', 'why', 'what', 'when', 'where', 'which', 'your', 'our', 'their',
  'channel', 'space', 'raum', 'thema', 'themen', 'themenraum', 'wissensraum', 'perspektiven',
  'diskurs', 'praxis', 'forschung', 'grundlagen', 'ideen', 'kultur', 'alltag', 'welt'
]);

const DE_EN_TOPIC_GLOSSARY: readonly (readonly [RegExp, readonly string[]])[] = [
  [/erkenntnistheori/i, ['epistemology', 'philosophy of knowledge']],
  [/philosophi/i, ['philosophy']],
  [/ethik|moral/i, ['ethics', 'moral philosophy']],
  [/dialektik/i, ['dialectics', 'critical theory']],
  [/phänomenologi|phaenomenologi/i, ['phenomenology']],
  [/existenzial/i, ['existentialism']],
  [/stoa|stoisch/i, ['stoicism', 'stoic philosophy']],
  [/buddhis/i, ['buddhism', 'contemplative practice']],
  [/achtsamkeit/i, ['mindfulness', 'contemplation']],
  [/meditation/i, ['meditation', 'attention']],
  [/kontemplation/i, ['contemplation', 'mindfulness']],
  [/quantenphysik/i, ['quantum physics', 'quantum mechanics']],
  [/quanten/i, ['quantum']],
  [/physik/i, ['physics']],
  [/astrophysik|astronomie|weltraum/i, ['astrophysics', 'astronomy']],
  [/mathematik/i, ['mathematics']],
  [/biologi/i, ['biology']],
  [/evolution/i, ['evolutionary biology']],
  [/neurowissenschaft|gehirn/i, ['neuroscience', 'brain cognition']],
  [/bewusstsein/i, ['consciousness']],
  [/psychologi/i, ['psychology']],
  [/lernpsychologi/i, ['cognitive psychology', 'learning science']],
  [/kognition|kognitiv/i, ['cognition', 'cognitive science']],
  [/didaktik/i, ['didactics', 'pedagogy']],
  [/pädagogik|paedagogik/i, ['pedagogy', 'education']],
  [/bildung/i, ['education']],
  [/schule|unterricht/i, ['teaching', 'classroom instruction']],
  [/visible\s*learning|hattie/i, ['visible learning', 'formative assessment']],
  [/bauhaus/i, ['bauhaus', 'modernist architecture']],
  [/architektur/i, ['architecture', 'urban design']],
  [/städtebau|staedtebau|stadtentwicklung/i, ['urbanism', 'urban planning']],
  [/brutalismus/i, ['brutalist architecture']],
  [/kunstgeschichte|kunst/i, ['art history', 'visual art']],
  [/malerei/i, ['painting']],
  [/fotografi/i, ['photography']],
  [/ästhetik|aesthetik/i, ['aesthetics']],
  [/typografi/i, ['typography', 'graphic design']],
  [/modular/i, ['modular synthesizer', 'eurorack']],
  [/synthese|synthesizer/i, ['sound synthesis', 'synthesizer']],
  [/elektronische\s+musik|elektronisch/i, ['electronic music', 'sound design']],
  [/klang|akustik/i, ['acoustics', 'sound design']],
  [/musik/i, ['music', 'music theory']],
  [/jazz/i, ['jazz']],
  [/klassik/i, ['classical music']],
  [/filmgeschichte|kino|film/i, ['cinema', 'film theory']],
  [/literatur/i, ['literature', 'literary criticism']],
  [/geschichte/i, ['history']],
  [/antike/i, ['classical antiquity', 'ancient history']],
  [/mittelalter/i, ['medieval history']],
  [/soziologi|gesellschaft/i, ['sociology', 'society']],
  [/demokrati/i, ['democracy', 'political theory']],
  [/geopolitik/i, ['geopolitics']],
  [/ökonomi|oekonomi|wirtschaft/i, ['economics']],
  [/klima|klimawandel/i, ['climate science', 'climate change']],
  [/ökologi|oekologi|naturschutz/i, ['ecology', 'biodiversity']],
  [/nachhaltigkeit|energie/i, ['renewable energy', 'sustainability']],
  [/künstliche\s+intelligenz|kuenstliche\s+intelligenz|\bki\b/i, ['artificial intelligence', 'machine learning']],
  [/sprachmodell|\bllm\b/i, ['large language models']],
  [/kybernetik/i, ['cybernetics', 'systems theory']],
  [/systemtheori/i, ['systems theory', 'complexity']],
  [/kryptografi/i, ['cryptography']],
  [/programmierung|software/i, ['software engineering', 'programming']],
  [/schlaf/i, ['sleep science', 'circadian rhythm']],
  [/ernährung|ernaehrung/i, ['nutrition science']],
  [/gesundheit|langlebigkeit/i, ['health', 'longevity']],
  [/atem|atmung/i, ['breathing', 'respiratory physiology']],
  [/schach/i, ['chess']],
  [/kaffee/i, ['coffee', 'espresso science']],
  [/sauerteig|fermentation/i, ['sourdough', 'fermentation']],
  [/kochen|kulinarik/i, ['culinary science', 'food history']],
  [/garten|botanik/i, ['botany', 'gardening']],
  [/reisen|geografi/i, ['geography', 'cultural history']],
  [/sprache|linguistik/i, ['linguistics', 'language']]
];

const YT_PROMO_LINE_REGEX =
  /^\s*(?:https?:\/\/|www\.|#|\d{1,2}:\d{2}\b|(?:chapters?|kapitel|timestamps?|zeitstempel)\s*:|(?:subscribe|abonnier\w*|follow\s+(?:us|me)|folge\s+uns|support\s+(?:us|this|the\s+channel)|unterstütz\w*|patreon|ko-?fi|merch|shop\b|sponsored\s+by|this\s+video\s+is\s+sponsored|use\s+code\b|promo\s*code|music\s+by|soundtrack|credits?:|impressum|datenschutz|business\s+inquir|instagram|twitter|tiktok|discord|facebook|linkedin)\b)/i;

function decodeHtmlEntities(raw: string): string {
  return raw
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    })
    .replace(/&#(\d+);/g, (_, dec: string) => {
      const code = Number.parseInt(dec, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    })
    .replace(/&#x200B;|&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function cleanHtmlAndUrls(raw: string): string {
  return decodeHtmlEntities(raw.replace(/<[^>]+>/g, ' '))
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractFirstImgSrc(html?: string): string {
  if (!html || typeof html !== 'string') return '';
  const match = html.match(/<img\b[^>]*?\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)')/i);
  const rawUrl = decodeHtmlEntities((match?.[1] || match?.[2] || '').trim());
  return /^https?:\/\//i.test(rawUrl) ? rawUrl : '';
}

function resolveRss2JsonImage(entry: Rss2JsonEntry): string {
  const candidates: string[] = [];
  if (typeof entry.thumbnail === 'string' && entry.thumbnail.trim()) {
    candidates.push(decodeHtmlEntities(entry.thumbnail.trim()));
  }
  const enclosureLink =
    typeof entry.enclosure?.link === 'string' ? decodeHtmlEntities(entry.enclosure.link.trim()) : '';
  const enclosureType = String(entry.enclosure?.type || '').toLowerCase();
  if (enclosureLink && (!enclosureType || enclosureType.startsWith('image/'))) {
    candidates.push(enclosureLink);
  }
  const descImg = extractFirstImgSrc(entry.description);
  if (descImg) candidates.push(descImg);
  const contentImg = extractFirstImgSrc(entry.content);
  if (contentImg) candidates.push(contentImg);

  for (const candidate of candidates) {
    if (!/^https?:\/\//i.test(candidate)) continue;
    if (/\.(?:mp4|webm|gifv|mp3|wav|ogg|m4a|pdf|svg)(?:[?#].*)?$/i.test(candidate)) continue;
    if (isRejectedLowResOrLogoUrl(candidate, false)) continue;
    return candidate;
  }
  return '';
}

function extractYoutubeVideoId(rawUrl: string): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  try {
    const parsed = new URL(rawUrl.trim());
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '');
    if (host === 'youtube.com') {
      if (parsed.pathname === '/watch') {
        const v = parsed.searchParams.get('v')?.trim();
        if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
      }
      return null;
    }
    if (host === 'youtu.be') {
      const id = parsed.pathname.replace(/^\/+/, '').split('/')[0]?.trim();
      if (id && /^[a-zA-Z0-9_-]{11}$/.test(id)) return id;
      return null;
    }
    return null;
  } catch {
    return null;
  }
}

function normalizeDedupeUrl(rawUrl?: string): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  const ytId = extractYoutubeVideoId(trimmed);
  if (ytId) return `yt:${ytId}`;
  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    const pathname = parsed.pathname.replace(/\/+$/, '');
    return `${host}${pathname}${parsed.search}`.toLowerCase();
  } catch {
    return trimmed.toLowerCase().replace(/\/+$/, '');
  }
}

function normalizeTitleForDedupe(title: string): string {
  return (title || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanYoutubeDescription(raw?: string | null, maxChars = 260): string {
  if (!raw || typeof raw !== 'string') return '';
  const decoded = decodeHtmlEntities(
    raw.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<[^>]+>/g, ' ')
  );

  const keptLines: string[] = [];
  for (const rawLine of decoded.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (!trimmed || YT_PROMO_LINE_REGEX.test(trimmed)) continue;

    const cleanedLine = trimmed
      .replace(/https?:\/\/\S+/gi, '')
      .replace(/\bwww\.\S+/gi, '')
      .replace(/(?:^|\s)#[a-zA-Z0-9_äöüÄÖÜß-]+/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (cleanedLine.length < 18) continue;
    if (
      /\b(?:patreon\.com|brilliant\.org|squarespace|nordvpn|surfshark|nebula\.tv|skillshare|audible\.com|ground\.news|use\s+my\s+link|link\s+in\s+(?:the\s+)?description|check\s+out\s+our\s+sponsor|subscribe\s+to\s+(?:our|the)\s+channel)\b/i.test(
        cleanedLine
      )
    ) {
      continue;
    }

    keptLines.push(cleanedLine);
    if (keptLines.join(' ').length >= maxChars + 80) break;
  }

  const joined = keptLines.join(' ').replace(/\s+/g, ' ').trim();
  if (joined.length < 40) return '';
  if (joined.length <= maxChars) return joined;

  const slice = joined.slice(0, maxChars);
  const lastSentenceEnd = Math.max(
    slice.lastIndexOf('. '),
    slice.lastIndexOf('! '),
    slice.lastIndexOf('? ')
  );
  if (lastSentenceEnd >= 80) {
    return slice.slice(0, lastSentenceEnd + 1).trim();
  }
  const lastSpace = slice.lastIndexOf(' ');
  return `${(lastSpace >= 60 ? slice.slice(0, lastSpace) : slice).trim()}…`;
}

function cleanYoutubeTitle(rawTitle: string): string {
  return rawTitle
    .replace(/\s*\[(?:video|youtube)\]\s*$/i, '')
    .replace(/\s*\((?:video|youtube(?:\.com)?)\)\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function stableShortHash(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function parseFlexibleIsoDate(rawDate: string | undefined, fallbackIso: string): { iso: string; reliable: boolean } {
  if (!rawDate || !rawDate.trim()) {
    return { iso: fallbackIso, reliable: false };
  }
  const trimmed = rawDate.trim();
  const normalized = /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}$/.test(trimmed)
    ? `${trimmed.replace(' ', 'T')}Z`
    : trimmed;
  const parsed = Date.parse(normalized);
  if (!Number.isFinite(parsed)) {
    return { iso: fallbackIso, reliable: false };
  }
  return { iso: new Date(parsed).toISOString(), reliable: true };
}

function extractFirstSubstantiveSentence(prose: string, fallback: string): string {
  const cleaned = prose.replace(/\s+/g, ' ').trim();
  if (cleaned.length < 40) return fallback;
  const sentences = cleaned.split(/(?<=[.!?])\s+/);
  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (trimmed.length >= 36) {
      return trimmed.slice(0, 220);
    }
  }
  return cleaned.slice(0, 200);
}

function sliceAtSentenceBoundary(prose: string, maxChars: number): string {
  const cleaned = prose.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= maxChars) return cleaned;
  const slice = cleaned.slice(0, maxChars);
  const lastSentenceEnd = Math.max(
    slice.lastIndexOf('. '),
    slice.lastIndexOf('! '),
    slice.lastIndexOf('? ')
  );
  if (lastSentenceEnd >= Math.floor(maxChars * 0.45)) {
    return slice.slice(0, lastSentenceEnd + 1).trim();
  }
  const lastSpace = slice.lastIndexOf(' ');
  return `${(lastSpace >= Math.floor(maxChars * 0.5) ? slice.slice(0, lastSpace) : slice).trim()}…`;
}

function dedupeStrings(values: readonly string[], limit: number): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    const cleaned = raw.replace(/\s+/g, ' ').trim();
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
    if (out.length >= limit) break;
  }
  return out;
}

function extractCleanTokens(raw: string): string[] {
  const normalized = (raw || '')
    .replace(/[_/]+/g, ' ')
    .replace(/[^\p{L}\p{N}-]+/gu, ' ')
    .trim();
  if (!normalized) return [];

  const tokens: string[] = [];
  for (const piece of normalized.split(/\s+/)) {
    const cleanPiece = piece.replace(/^-+|-+$/g, '');
    if (cleanPiece.length >= 3 && !STOPWORDS.has(cleanPiece.toLowerCase())) {
      tokens.push(cleanPiece);
    }
    if (cleanPiece.includes('-')) {
      for (const part of cleanPiece.split('-')) {
        if (part.length >= 3 && !STOPWORDS.has(part.toLowerCase())) {
          tokens.push(part);
        }
      }
    }
  }
  return dedupeStrings(tokens, 16);
}

function extractDomainFromUrlOrHost(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return null;
  try {
    const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const host = new URL(candidate).hostname.toLowerCase().replace(/^www\./, '');
    if (!host || !host.includes('.') || host.includes(' ')) return null;
    return host;
  } catch {
    return null;
  }
}

function parseSeedSources(seedSources?: string[]): { directRssUrls: string[]; seedDomains: Set<string> } {
  const directRssUrls: string[] = [];
  const seedDomains = new Set<string>();
  if (!Array.isArray(seedSources)) {
    return { directRssUrls, seedDomains };
  }

  for (const rawEntry of seedSources) {
    if (typeof rawEntry !== 'string') continue;
    const trimmed = rawEntry.trim();
    if (!trimmed) continue;

    if (/^https?:\/\//i.test(trimmed)) {
      if (/(?:rss|feed|atom|\.xml\b)/i.test(trimmed)) {
        directRssUrls.push(trimmed);
      }
      const dom = extractDomainFromUrlOrHost(trimmed);
      if (dom) seedDomains.add(dom);
    } else {
      const dom = extractDomainFromUrlOrHost(trimmed);
      if (dom) seedDomains.add(dom);
    }
  }
  return {
    directRssUrls: dedupeStrings(directRssUrls, 4),
    seedDomains
  };
}

function selectMatchingCatalogRssUrls(
  deKeywords: string[],
  enKeywords: string[],
  primaryTopic?: TopicTag,
  seedSources?: string[]
): string[] {
  const { directRssUrls, seedDomains } = parseSeedSources(seedSources);
  const allKeywords = dedupeStrings([...deKeywords, ...enKeywords], 16)
    .map(k => k.toLowerCase())
    .filter(k => k.length >= 3 && !STOPWORDS.has(k));

  const scored: { source: RawFeedSource; score: number }[] = [];

  for (const source of VERIFIED_FEED_SOURCES) {
    if (!source?.url || !/^https?:\/\//i.test(source.url)) continue;
    if (source.sourceKind === 'reference') continue;
    if (/youtube\.com\/feeds\/videos\.xml/i.test(source.url)) continue;

    const sourceDomain = extractDomainFromUrlOrHost(source.url) || '';
    const homeDomain = source.homepageUrl ? extractDomainFromUrlOrHost(source.homepageUrl) || '' : '';
    const hay = `${source.name} ${source.id} ${source.description || ''} ${sourceDomain} ${homeDomain}`.toLowerCase();

    let score = 0;

    if (
      (sourceDomain && seedDomains.has(sourceDomain)) ||
      (homeDomain && seedDomains.has(homeDomain))
    ) {
      score += 30;
    } else {
      for (const sd of seedDomains) {
        if (sourceDomain.endsWith(`.${sd}`) || homeDomain.endsWith(`.${sd}`)) {
          score += 24;
          break;
        }
      }
    }

    let keywordHits = 0;
    for (const kw of allKeywords) {
      if (hay.includes(kw)) {
        keywordHits += 1;
        score += kw.length >= 6 ? 8 : 5;
      }
    }

    if (primaryTopic) {
      if (source.primaryTopic === primaryTopic) score += 2.5;
      else if (Array.isArray(source.topics) && source.topics.includes(primaryTopic)) score += 1.2;
    }

    // Require either a seed match, keyword hit, or primaryTopic match
    if (score >= 2.5 && (keywordHits > 0 || score >= 20 || (primaryTopic && source.primaryTopic === primaryTopic))) {
      scored.push({ source, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);

  const selectedUrls: string[] = [...directRssUrls];
  const seenDomains = new Set<string>(
    directRssUrls
      .map(u => extractDomainFromUrlOrHost(u) || '')
      .filter(Boolean)
  );

  for (const entry of scored) {
    if (selectedUrls.length >= 4) break;
    const dom = extractDomainFromUrlOrHost(entry.source.url) || entry.source.id;
    if (seenDomains.has(dom)) continue;
    seenDomains.add(dom);
    selectedUrls.push(entry.source.url);
  }

  return dedupeStrings(selectedUrls, 4);
}

/**
 * Deterministic Topic Query Planner:
 * Extracts clean DE & EN search terms, selects up to 4 matching RSS feeds from
 * `VERIFIED_FEED_SOURCES` (plus any valid URL/domain from `seedSources`), and builds
 * structured queries for Wikipedia, OpenAlex, Hacker News, and YouTube.
 */
export function buildDeterministicTopicPlan(
  title: string,
  description?: string,
  primaryTopic?: TopicTag,
  seedSources?: string[]
): TopicQueryPlan {
  const cleanTitle = (title || '').replace(/^c\//i, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
  const cleanDesc = (description || '').replace(/\s+/g, ' ').trim();
  const combinedInput = `${cleanTitle} ${cleanDesc}`.trim();

  const titleTokens = extractCleanTokens(cleanTitle);
  const descTokens = extractCleanTokens(cleanDesc);

  const deKeywords = dedupeStrings(
    [
      ...(cleanTitle.length >= 3 && cleanTitle.split(/\s+/).length <= 4 ? [cleanTitle] : []),
      ...titleTokens,
      ...descTokens.slice(0, 4)
    ],
    8
  );

  const translatedEnTerms: string[] = [];
  for (const [pattern, enTerms] of DE_EN_TOPIC_GLOSSARY) {
    if (pattern.test(combinedInput)) {
      translatedEnTerms.push(...enTerms);
    }
  }

  // Include international / ASCII-clean title tokens so English topics or proper nouns pass through directly
  const asciiFallbackTokens = titleTokens
    .filter(tok => /^[a-zA-Z0-9-]+$/.test(tok) && tok.length >= 3)
    .map(tok => tok.toLowerCase());

  const enKeywords = dedupeStrings(
    [
      ...translatedEnTerms,
      ...asciiFallbackTokens,
      ...deKeywords
        .map(k =>
          k
            .replace(/ä/gi, 'ae')
            .replace(/ö/gi, 'oe')
            .replace(/ü/gi, 'ue')
            .replace(/ß/g, 'ss')
        )
        .filter(k => k.length >= 3)
    ],
    8
  );

  const primaryDePhrase = cleanTitle || deKeywords.slice(0, 2).join(' ') || 'Wissenschaft';
  const primaryEnPhrase =
    translatedEnTerms.length > 0
      ? translatedEnTerms.slice(0, 2).join(' ')
      : enKeywords.slice(0, 2).join(' ') || primaryDePhrase;

  const wikipediaQueries = dedupeStrings(
    [
      primaryDePhrase,
      primaryEnPhrase,
      ...titleTokens.slice(0, 2),
      ...translatedEnTerms.slice(0, 2)
    ],
    4
  );

  const openAlexQuery = dedupeStrings(
    [
      ...translatedEnTerms.slice(0, 3),
      ...asciiFallbackTokens.slice(0, 2),
      ...(translatedEnTerms.length === 0 ? titleTokens.slice(0, 3) : [])
    ],
    4
  ).join(' ') || primaryEnPhrase;

  const hnQueries = dedupeStrings(
    [
      primaryEnPhrase,
      translatedEnTerms[0] || enKeywords[0] || primaryDePhrase,
      enKeywords.length >= 2 ? `${enKeywords[0]} ${enKeywords[1]}` : ''
    ].filter(Boolean),
    3
  );

  const youtubeQueries = dedupeStrings(
    [
      primaryEnPhrase,
      translatedEnTerms[0] || enKeywords[0] || primaryDePhrase,
      cleanTitle
    ].filter(Boolean),
    3
  );

  const matchingRssUrls = selectMatchingCatalogRssUrls(
    deKeywords,
    enKeywords,
    primaryTopic,
    seedSources
  );

  return {
    deKeywords: deKeywords.length > 0 ? deKeywords : [primaryDePhrase],
    enKeywords: enKeywords.length > 0 ? enKeywords : [primaryEnPhrase],
    wikipediaQueries,
    openAlexQuery,
    hnQueries,
    youtubeQueries,
    matchingRssUrls,
    avoidTerms: [],
    usedAi: false
  };
}

async function fetchJsonWithTimeout<T>(url: string, timeoutMs: number): Promise<T | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' }
    });
    if (!res.ok) return null;
    const rawText = await res.text();
    const trimmed = rawText.trim();
    if (!trimmed || (!trimmed.startsWith('{') && !trimmed.startsWith('['))) {
      return null;
    }
    return JSON.parse(trimmed) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function toStringArray(raw: unknown, limit: number): string[] {
  if (!Array.isArray(raw)) return [];
  const clean: string[] = [];
  for (const item of raw) {
    if (typeof item === 'string' && item.trim().length >= 2) {
      clean.push(item.trim());
    }
  }
  return dedupeStrings(clean, limit);
}

/**
 * Stage 1 (Query Architect):
 * Optional single compact AI JSON call acting strictly as a Silent Editor-in-Chief
 * query planner, safely merged with `buildDeterministicTopicPlan`.
 */
async function buildTopicQueryPlan(
  input: TopicPremiumPipelineInput,
  creds?: AiCredentials
): Promise<TopicQueryPlan> {
  const deterministic = buildDeterministicTopicPlan(
    input.title,
    input.description,
    input.primaryTopic,
    input.seedSources
  );

  if (input.skipNetworkInTests || !creds || !hasAiConfiguration(creds)) {
    return deterministic;
  }

  try {
    const prompt = `Du bist der stille Chefredakteur (Query-Architekt) von Atem.
Plane präzise Suchbegriffe für den Themenraum (KEINE Zusammenfassungen, NUR Suchbegriffe):
Titel: "${input.title}"
Beschreibung: "${input.description || ''}"
Themenfeld: "${input.primaryTopic}"
Nutzer-Quellen: ${JSON.stringify(input.seedSources || [])}

Antworte ausschließlich als kompaktes JSON-Objekt:
{
  "deKeywords": ["3-6 präzise deutsche Fachbegriffe"],
  "enKeywords": ["3-6 präzise englische Fachbegriffe"],
  "wikipediaQueries": ["2-4 enzyklopädische Suchbegriffe DE & EN"],
  "openAlexQuery": "2-5 englische akademische Suchbegriffe",
  "hnQueries": ["2-3 knappe englische Suchphrasen für Essays"],
  "youtubeQueries": ["2-3 knappe englische Suchphrasen für Video-Essays"],
  "avoidTerms": ["0-5 offensichtliche Rausch- oder Homonym-Begriffe"]
}`;

    const aiRes = await callAiModel(prompt, {
      jsonMode: true,
      maxTokens: 450,
      timeoutMs: 10_000,
      credentials: creds,
      itemId: `studio-query-plan-${normalizeSpaceHandle(input.handle)}-${Date.now()}`
    });

    const parsed = extractJsonFromAiResponse<AiQueryPlanPayload>(aiRes.text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return deterministic;
    }

    const aiDe = toStringArray(parsed.deKeywords, 6);
    const aiEn = toStringArray(parsed.enKeywords, 6);
    const aiWiki = toStringArray(parsed.wikipediaQueries, 4);
    const aiHn = toStringArray(parsed.hnQueries, 3);
    const aiYt = toStringArray(parsed.youtubeQueries, 3);
    const aiAvoid = toStringArray(parsed.avoidTerms, 6);
    const aiOpenAlex =
      typeof parsed.openAlexQuery === 'string' && parsed.openAlexQuery.trim().length >= 3
        ? parsed.openAlexQuery.trim()
        : '';

    const mergedDe = dedupeStrings([...aiDe, ...deterministic.deKeywords], 8);
    const mergedEn = dedupeStrings([...aiEn, ...deterministic.enKeywords], 8);
    const mergedRss = selectMatchingCatalogRssUrls(
      mergedDe,
      mergedEn,
      input.primaryTopic,
      input.seedSources
    );

    return {
      deKeywords: mergedDe,
      enKeywords: mergedEn,
      wikipediaQueries: dedupeStrings([...aiWiki, ...deterministic.wikipediaQueries], 4),
      openAlexQuery: aiOpenAlex || deterministic.openAlexQuery,
      hnQueries: dedupeStrings([...aiHn, ...deterministic.hnQueries], 3),
      youtubeQueries: dedupeStrings([...aiYt, ...deterministic.youtubeQueries], 3),
      matchingRssUrls: mergedRss.length > 0 ? mergedRss : deterministic.matchingRssUrls,
      avoidTerms: aiAvoid,
      usedAi: true
    };
  } catch {
    return deterministic;
  }
}

function buildTopicMatchTokens(title: string, plan: TopicQueryPlan): { phrases: string[]; tokens: string[] } {
  const rawPhrases = dedupeStrings(
    [
      title.replace(/^c\//i, '').replace(/[_]+/g, ' ').trim(),
      ...plan.deKeywords,
      ...plan.enKeywords
    ],
    18
  )
    .map(p => p.toLowerCase())
    .filter(p => p.length >= 4 && !STOPWORDS.has(p));

  const singleTokens: string[] = [];
  for (const phrase of rawPhrases) {
    for (const tok of extractCleanTokens(phrase)) {
      const low = tok.toLowerCase();
      if (low.length >= 4 && !STOPWORDS.has(low)) {
        singleTokens.push(low);
      }
    }
  }

  return {
    phrases: dedupeStrings(rawPhrases, 16),
    tokens: dedupeStrings(singleTokens, 24)
  };
}

function computeTopicRelevanceScore(
  item: Pick<FeedItem, 'title' | 'subtitle' | 'feedText' | 'body' | 'sourceDomain'>,
  title: string,
  plan: TopicQueryPlan
): number {
  const { phrases, tokens } = buildTopicMatchTokens(title, plan);
  const titleLower = (item.title || '').toLowerCase();
  const bodyLower = `${item.subtitle || ''} ${item.feedText || ''} ${item.body || ''}`.toLowerCase();

  let score = 0;
  let matchedTokens = 0;

  for (const phrase of phrases) {
    if (phrase.includes(' ')) {
      if (titleLower.includes(phrase)) {
        score += 7;
        matchedTokens += 2;
      } else if (bodyLower.includes(phrase)) {
        score += 3.5;
        matchedTokens += 1;
      }
    }
  }

  for (const token of tokens) {
    if (titleLower.includes(token)) {
      score += 4;
      matchedTokens += 1;
    } else if (bodyLower.includes(token)) {
      score += 1.5;
      matchedTokens += 1;
    }
  }

  if (matchedTokens >= 3) {
    score += 2.5;
  }

  return score;
}

function hasAvoidTermCollision(item: Pick<FeedItem, 'title' | 'feedText'>, avoidTerms: string[]): boolean {
  if (!avoidTerms.length) return false;
  const titleLower = (item.title || '').toLowerCase();
  for (const term of avoidTerms) {
    const clean = term.toLowerCase().trim();
    if (clean.length >= 4 && titleLower.includes(clean)) {
      return true;
    }
  }
  return false;
}

function reconstructOpenAlexAbstract(invertedIndex?: Record<string, number[]>): string {
  if (!invertedIndex || typeof invertedIndex !== 'object') return '';
  const words: string[] = [];
  for (const [word, positions] of Object.entries(invertedIndex)) {
    if (Array.isArray(positions)) {
      for (const pos of positions) {
        if (typeof pos === 'number' && pos >= 0 && pos < 4000) {
          words[pos] = word;
        }
      }
    }
  }
  return words.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Lane 1: Matching unseen items from `defaultSnapshotLoader` (reservoir + snapshot)
 * requiring >= 1 strong topic token match in title/body.
 */
async function fetchSnapshotTopicLane(
  input: TopicPremiumPipelineInput,
  plan: TopicQueryPlan,
  seedDomains: Set<string>
): Promise<PipelineCandidate[]> {
  const [reservoirRes, snapshotRes] = await Promise.allSettled([
    defaultSnapshotLoader.loadReservoir(undefined, 3800),
    defaultSnapshotLoader.loadSnapshot(undefined, 3800)
  ]);

  const combined: FeedItem[] = [];
  if (reservoirRes.status === 'fulfilled' && reservoirRes.value?.success) {
    combined.push(...reservoirRes.value.items);
  }
  if (snapshotRes.status === 'fulfilled' && snapshotRes.value?.success) {
    combined.push(...snapshotRes.value.items);
  }

  const normalizedHandle = normalizeSpaceHandle(input.handle);
  const results: PipelineCandidate[] = [];

  for (const item of combined) {
    if (!item?.id || !item?.title) continue;
    if (isDoomscrollOrOffTopicNoise(item)) continue;
    if (!isSupportedFeedLanguage(item.title, `${item.subtitle || ''} ${item.feedText || ''}`)) continue;

    const topicScore = computeTopicRelevanceScore(item, input.title, plan);
    const domain = (item.sourceDomain || extractDomainFromUrlOrHost(item.canonicalUrl || '') || '').toLowerCase();
    const fromSeedSource = Boolean(domain && seedDomains.has(domain));

    // Strictly require >= 1 strong topic token match (or explicit user seed source)
    if (topicScore < 1.5 && !fromSeedSource) continue;

    results.push({
      item: {
        ...item,
        space: normalizedHandle,
        primaryTopic: input.primaryTopic,
        topics: item.topics?.includes(input.primaryTopic)
          ? item.topics
          : [input.primaryTopic, ...(item.topics || [])].slice(0, 3)
      },
      lane: 'snapshot',
      fromSeedSource,
      topicScore,
      baseScore: topicScore + 2.2 + (item.imageUrl ? 0.6 : 0) + (fromSeedSource ? 3 : 0)
    });
  }

  results.sort((a, b) => b.baseScore - a.baseScore);
  return results.slice(0, 12);
}

/**
 * Lane 2: Up to 3 matching catalog RSS feeds via CORS-open `api.rss2json.com`.
 */
async function fetchCatalogRssTopicLane(
  input: TopicPremiumPipelineInput,
  plan: TopicQueryPlan,
  seedDomains: Set<string>,
  today: string
): Promise<PipelineCandidate[]> {
  const feedUrls = plan.matchingRssUrls.slice(0, 3);
  if (feedUrls.length === 0) return [];

  const sourceByUrl = new Map<string, RawFeedSource>();
  for (const src of VERIFIED_FEED_SOURCES) {
    sourceByUrl.set(src.url, src);
  }

  const settledList = await Promise.allSettled(
    feedUrls.map(async rssUrl => {
      const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;
      const data = await fetchJsonWithTimeout<Rss2JsonResponse>(apiUrl, 3800);
      return { rssUrl, data };
    })
  );

  const normalizedHandle = normalizeSpaceHandle(input.handle);
  const safeSlug = normalizedHandle.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const nowIso = new Date().toISOString();
  const results: PipelineCandidate[] = [];

  for (const settled of settledList) {
    if (settled.status !== 'fulfilled') continue;
    const { rssUrl, data } = settled.value;
    if (!data || data.status !== 'ok' || !Array.isArray(data.items)) continue;

    const meta = sourceByUrl.get(rssUrl);
    const feedDomain = extractDomainFromUrlOrHost(rssUrl) || 'rss-source';
    const feedName =
      meta?.name ||
      decodeHtmlEntities(String(data.feed?.title || '')).trim() ||
      feedDomain;
    const fromSeedSource =
      seedDomains.has(feedDomain) ||
      Array.from(seedDomains).some(sd => feedDomain.endsWith(`.${sd}`));

    for (const entry of data.items.slice(0, 8)) {
      const title = decodeHtmlEntities(String(entry?.title || '')).replace(/\s+/g, ' ').trim();
      if (title.length < 12 || isCelebrityFluff(title)) continue;

      const rawLink = decodeHtmlEntities(String(entry?.link || entry?.guid || '')).trim();
      if (!/^https?:\/\//i.test(rawLink)) continue;

      const descClean = cleanHtmlAndUrls(String(entry?.description || ''));
      const contentClean = cleanHtmlAndUrls(String(entry?.content || ''));
      const cleanedProse = contentClean.length > descClean.length ? contentClean : descClean;
      if (cleanedProse.length < 120) continue;
      if (!isSupportedFeedLanguage(title, cleanedProse)) continue;

      const entryDomain = extractDomainFromUrlOrHost(rawLink) || feedDomain;
      const rawImage = resolveRss2JsonImage(entry);
      const upgradedImage = rawImage ? upgradeImageResolutionUrl(rawImage) : undefined;
      const { iso: pubDate, reliable } = parseFlexibleIsoDate(entry?.pubDate, nowIso);
      const author =
        decodeHtmlEntities(String(entry?.author || data.feed?.author || meta?.defaultAuthor || feedName)).trim() ||
        feedName;
      const bodyText = cleanedProse.slice(0, 1600);
      const feedExcerpt = sliceAtSentenceBoundary(cleanedProse, 380);
      const keyInsight = extractFirstSubstantiveSentence(cleanedProse, title);

      const candidateItem: FeedItem = {
        id: `premium-rss-${safeSlug}-${stableShortHash(rawLink)}`,
        type: 'deep_dive',
        format: 'sourced_update',
        title,
        subtitle: feedName,
        feedText: feedExcerpt,
        body: bodyText,
        articleBody: `### ${title}\n\n${bodyText}\n\n**Originalquelle:** [${feedName}](${rawLink})`,
        ...(upgradedImage ? { imageUrl: upgradedImage, hasAuthenticImage: true } : {}),
        topics: [input.primaryTopic],
        primaryTopic: input.primaryTopic,
        sourceReferences: [
          {
            publisher: feedName,
            originalUrl: rawLink,
            title,
            publicationTimestamp: pubDate,
            retrievalTimestamp: nowIso,
            author,
            isVerified: true
          }
        ],
        publishedAt: pubDate,
        publicationDateReliable: reliable,
        generatedAt: nowIso,
        estimatedReadingMinutes: Math.max(2, Math.ceil(bodyText.split(/\s+/).filter(Boolean).length / 190)),
        relevanceExplanation: `Verifizierte Fachquelle (${feedName}) im Themenraum ${input.title}.`,
        contentStatus: 'editorial_briefing',
        isDailyEdition: false,
        editionDate: today,
        isDemonstration: false,
        aiAssisted: false,
        factReviewStatus: 'curated_illustrative',
        provenanceSummary: `✨ ${feedName}`,
        wordCount: bodyText.split(/\s+/).filter(Boolean).length,
        evidenceTier: 'publisher_excerpt',
        contentOrigin: 'live_ingested',
        contentHash: `premium-rss-${stableShortHash(rawLink)}`,
        canonicalUrl: rawLink,
        space: normalizedHandle,
        flair: feedName,
        keyInsight,
        upvotesCount: 0,
        awardsCount: { gold: 0, brain: 0, spark: 0 },
        sourceTrustLevel: 'deep_essay',
        sourceDomain: entryDomain,
        sourceBroadcasterName: feedName,
        isTeachingRelated: input.primaryTopic === 'german_didactics',
        isChallengingPerspective: false,
        comments: []
      };

      const topicScore = computeTopicRelevanceScore(candidateItem, input.title, plan);
      results.push({
        item: candidateItem,
        lane: 'rss',
        fromSeedSource,
        topicScore,
        baseScore: topicScore + 2.5 + (upgradedImage ? 0.8 : 0) + (fromSeedSource ? 3.5 : 0)
      });
    }
  }

  return results;
}

/**
 * Lane 3: Live Wikipedia DE & EN REST search + page summary (`CORS: *`)
 * returning authentic encyclopedic deep dives with lead images.
 */
async function fetchWikipediaBilingualLane(
  input: TopicPremiumPipelineInput,
  plan: TopicQueryPlan,
  today: string
): Promise<PipelineCandidate[]> {
  const deQuery = plan.wikipediaQueries[0] || plan.deKeywords[0] || input.title;
  const enQuery =
    plan.enKeywords.slice(0, 2).join(' ') ||
    plan.wikipediaQueries[1] ||
    deQuery;

  const searchSpecs: readonly { lang: 'de' | 'en'; query: string }[] = [
    { lang: 'de', query: deQuery },
    { lang: 'en', query: enQuery }
  ];

  const searchSettled = await Promise.allSettled(
    searchSpecs.map(async spec => {
      const searchUrl = `https://${spec.lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
        spec.query
      )}&utf8=&format=json&origin=*&srlimit=3`;
      const res = await fetchJsonWithTimeout<WikipediaSearchResponse>(searchUrl, 3600);
      const hits = Array.isArray(res?.query?.search) ? res.query.search.slice(0, 3) : [];
      return { lang: spec.lang, hits };
    })
  );

  const summaryJobs: { lang: 'de' | 'en'; title: string; pageid?: number }[] = [];
  const seenTitles = new Set<string>();
  for (const settled of searchSettled) {
    if (settled.status !== 'fulfilled') continue;
    for (const hit of settled.value.hits) {
      const hitTitle = typeof hit?.title === 'string' ? hit.title.trim() : '';
      if (!hitTitle) continue;
      const key = `${settled.value.lang}:${hitTitle.toLowerCase()}`;
      if (seenTitles.has(key)) continue;
      seenTitles.add(key);
      summaryJobs.push({ lang: settled.value.lang, title: hitTitle, pageid: hit.pageid });
    }
  }

  if (summaryJobs.length === 0) return [];

  const summarySettled = await Promise.allSettled(
    summaryJobs.slice(0, 6).map(async job => {
      const sumUrl = `https://${job.lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(job.title)}`;
      const summary = await fetchJsonWithTimeout<WikipediaSummaryResponse>(sumUrl, 3500);
      return { job, summary };
    })
  );

  const normalizedHandle = normalizeSpaceHandle(input.handle);
  const safeSlug = normalizedHandle.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const nowIso = new Date().toISOString();
  const results: PipelineCandidate[] = [];

  for (const settled of summarySettled) {
    if (settled.status !== 'fulfilled') continue;
    const { job, summary } = settled.value;
    if (!summary || summary.type === 'disambiguation') continue;

    const extract = typeof summary.extract === 'string' ? summary.extract.replace(/\s+/g, ' ').trim() : '';
    if (extract.length < 140) continue;

    const resolvedTitle = (summary.title || job.title).trim();
    if (!resolvedTitle || !isSupportedFeedLanguage(resolvedTitle, extract)) continue;

    const pageUrl =
      summary.content_urls?.desktop?.page ||
      `https://${job.lang}.wikipedia.org/wiki/${encodeURIComponent(resolvedTitle.replace(/\s+/g, '_'))}`;
    const rawImage = summary.originalimage?.source || summary.thumbnail?.source || '';
    const validImage =
      rawImage && /^https?:\/\//i.test(rawImage) && !isRejectedLowResOrLogoUrl(rawImage, false)
        ? upgradeImageResolutionUrl(rawImage)
        : undefined;

    const pubDate = parseFlexibleIsoDate(summary.timestamp, nowIso);
    const publisherLabel = job.lang === 'de' ? 'Wikipedia (DE)' : 'Wikipedia (EN)';
    const feedExcerpt = sliceAtSentenceBoundary(extract, 380);
    const keyInsight = extractFirstSubstantiveSentence(extract, resolvedTitle);

    const candidateItem: FeedItem = {
      id: `premium-wiki-${job.lang}-${safeSlug}-${summary.pageid ?? job.pageid ?? stableShortHash(pageUrl)}`,
      type: 'briefing',
      format: 'concise_insight',
      title: resolvedTitle,
      subtitle: summary.description?.trim() || `Enzyklopädischer Überblick • ${publisherLabel}`,
      feedText: feedExcerpt,
      body: extract,
      articleBody: `### ${resolvedTitle}\n\n${extract}\n\n**Quelle:** [${resolvedTitle} auf ${publisherLabel}](${pageUrl})`,
      ...(validImage ? { imageUrl: validImage, hasAuthenticImage: true } : {}),
      topics: [input.primaryTopic],
      primaryTopic: input.primaryTopic,
      sourceReferences: [
        {
          publisher: publisherLabel,
          originalUrl: pageUrl,
          title: resolvedTitle,
          publicationTimestamp: pubDate.iso,
          retrievalTimestamp: nowIso,
          author: publisherLabel,
          isVerified: true
        }
      ],
      publishedAt: pubDate.iso,
      publicationDateReliable: pubDate.reliable,
      generatedAt: nowIso,
      estimatedReadingMinutes: Math.max(2, Math.ceil(extract.split(/\s+/).filter(Boolean).length / 180)),
      relevanceExplanation: `Enzyklopädische Grundlage aus ${publisherLabel} für ${input.title}.`,
      contentStatus: 'verified_fact',
      isDailyEdition: false,
      editionDate: today,
      isDemonstration: false,
      aiAssisted: false,
      factReviewStatus: 'encyclopedia_entry',
      provenanceSummary: `📖 ${publisherLabel}`,
      wordCount: extract.split(/\s+/).filter(Boolean).length,
      evidenceTier: 'publisher_excerpt',
      contentOrigin: 'live_ingested',
      contentHash: `wiki-${job.lang}-${summary.pageid ?? stableShortHash(pageUrl)}`,
      canonicalUrl: pageUrl,
      space: normalizedHandle,
      flair: 'Enzyklopädie',
      keyInsight,
      upvotesCount: 0,
      awardsCount: { gold: 0, brain: 0, spark: 0 },
      sourceTrustLevel: 'encyclopedia',
      sourceDomain: `${job.lang}.wikipedia.org`,
      sourceBroadcasterName: publisherLabel,
      isTeachingRelated: input.primaryTopic === 'german_didactics',
      isChallengingPerspective: false,
      comments: []
    };

    const topicScore = computeTopicRelevanceScore(candidateItem, input.title, plan);
    results.push({
      item: candidateItem,
      lane: 'wikipedia',
      fromSeedSource: false,
      topicScore,
      baseScore: topicScore + (job.lang === 'de' ? 2.6 : 2.1) + (validImage ? 0.9 : 0)
    });
  }

  return results;
}

/**
 * Lane 4: Live OpenAlex (`api.openalex.org/works?search=...&filter=has_abstract:true`, `CORS: *`)
 * reconstructing authentic abstracts and filtering out wet-lab noise.
 */
async function fetchOpenAlexTopicLane(
  input: TopicPremiumPipelineInput,
  plan: TopicQueryPlan,
  today: string
): Promise<PipelineCandidate[]> {
  const query = plan.openAlexQuery.trim();
  if (!query) return [];

  const url = `https://api.openalex.org/works?search=${encodeURIComponent(
    query
  )}&per_page=8&filter=has_abstract:true&sort=relevance_score:desc`;
  const data = await fetchJsonWithTimeout<OpenAlexResponse>(url, 3800);
  const works = Array.isArray(data?.results) ? data.results : [];
  if (works.length === 0) return [];

  const normalizedHandle = normalizeSpaceHandle(input.handle);
  const safeSlug = normalizedHandle.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const nowIso = new Date().toISOString();
  const results: PipelineCandidate[] = [];

  for (let idx = 0; idx < works.length; idx++) {
    const work = works[idx];
    const title = typeof work?.title === 'string' ? cleanHtmlAndUrls(work.title) : '';
    if (title.length < 12) continue;

    const abstractText = reconstructOpenAlexAbstract(work.abstract_inverted_index);
    if (abstractText.length < 140) continue;
    if (isIncomprehensibleWetLabPaper(title, abstractText)) continue;
    if (!isSupportedFeedLanguage(title, abstractText)) continue;

    const rawLanding = work.doi || work.primary_location?.landing_page_url || work.id || '';
    const canonicalUrl = rawLanding.startsWith('http')
      ? rawLanding
      : rawLanding
        ? `https://doi.org/${rawLanding.replace(/^doi:\s*/i, '')}`
        : 'https://openalex.org';
    const domain = extractDomainFromUrlOrHost(canonicalUrl) || 'openalex.org';
    const venue = work.primary_location?.source?.display_name?.trim() || 'OpenAlex Peer-Reviewed Research';
    const authors = Array.isArray(work.authorships)
      ? work.authorships
          .slice(0, 3)
          .map(a => a?.author?.display_name?.trim() || '')
          .filter(Boolean)
          .join(', ')
      : '';
    const pubDate = parseFlexibleIsoDate(work.publication_date, nowIso);
    const feedExcerpt = sliceAtSentenceBoundary(abstractText, 380);
    const keyInsight = extractFirstSubstantiveSentence(abstractText, title);
    const bodyText = abstractText.slice(0, 1800);

    const candidateItem: FeedItem = {
      id: `premium-openalex-${safeSlug}-${stableShortHash(work.id || canonicalUrl || String(idx))}`,
      type: 'deep_dive',
      format: 'sourced_update',
      title,
      subtitle: `${venue} • Peer-Reviewed Publikation`,
      feedText: feedExcerpt,
      body: bodyText,
      articleBody: `### ${title}\n\n${bodyText}\n\n**Autoren:** ${authors || venue}\n\n**Primärquelle:** [${venue}](${canonicalUrl})`,
      topics: [input.primaryTopic],
      primaryTopic: input.primaryTopic,
      sourceReferences: [
        {
          publisher: venue,
          originalUrl: canonicalUrl,
          title,
          publicationTimestamp: pubDate.iso,
          retrievalTimestamp: nowIso,
          author: authors || venue,
          isVerified: true
        }
      ],
      publishedAt: pubDate.iso,
      publicationDateReliable: pubDate.reliable,
      generatedAt: nowIso,
      estimatedReadingMinutes: Math.max(2, Math.ceil(bodyText.split(/\s+/).filter(Boolean).length / 170)),
      relevanceExplanation: `Peer-reviewed Fachpublikation (${venue}) für ${input.title}.`,
      contentStatus: 'scientific_analysis',
      isDailyEdition: false,
      editionDate: today,
      isDemonstration: false,
      aiAssisted: false,
      factReviewStatus: 'scientific_paper',
      provenanceSummary: `🔬 ${venue} (OpenAlex)`,
      wordCount: bodyText.split(/\s+/).filter(Boolean).length,
      evidenceTier: 'publisher_excerpt',
      contentOrigin: 'live_ingested',
      contentHash: `openalex-${stableShortHash(work.id || canonicalUrl)}`,
      canonicalUrl,
      space: normalizedHandle,
      flair: 'Fachpublikation',
      keyInsight,
      upvotesCount: 0,
      awardsCount: { gold: 0, brain: 0, spark: 0 },
      sourceTrustLevel: 'peer_reviewed',
      sourceDomain: domain,
      sourceBroadcasterName: venue,
      isTeachingRelated: input.primaryTopic === 'german_didactics',
      isChallengingPerspective: false,
      comments: []
    };

    const topicScore = computeTopicRelevanceScore(candidateItem, input.title, plan);
    const citationBonus =
      typeof work.cited_by_count === 'number' && work.cited_by_count >= 25 ? 0.8 : 0;

    results.push({
      item: candidateItem,
      lane: 'openalex',
      fromSeedSource: false,
      topicScore,
      baseScore: topicScore + 2.2 + citationBonus
    });
  }

  return results;
}

/**
 * Lane 5: Live Hacker News Algolia — High-Signal Essays AND YouTube Video-Essays
 * (enriched via `noembed.com`, zero generic filler prose on `youtube_gem` items).
 */
async function fetchHackerNewsAndYoutubeLane(
  input: TopicPremiumPipelineInput,
  plan: TopicQueryPlan,
  seedDomains: Set<string>,
  today: string
): Promise<{ articles: PipelineCandidate[]; videos: PipelineCandidate[] }> {
  const essayQueries = plan.hnQueries.slice(0, 2);
  const ytQueries = plan.youtubeQueries.slice(0, 2);

  const essayUrls = essayQueries.map(
    q =>
      `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(
        q
      )}&tags=story&numericFilters=points>20&hitsPerPage=8`
  );
  const ytUrls = ytQueries.map(
    q =>
      `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(
        `${q} youtube.com/watch`
      )}&tags=story&numericFilters=points>10&hitsPerPage=8`
  );

  const [essaySettled, ytSettled] = await Promise.all([
    Promise.allSettled(essayUrls.map(u => fetchJsonWithTimeout<HnAlgoliaResponse>(u, 3800))),
    Promise.allSettled(ytUrls.map(u => fetchJsonWithTimeout<HnAlgoliaResponse>(u, 3800)))
  ]);

  const normalizedHandle = normalizeSpaceHandle(input.handle);
  const safeSlug = normalizedHandle.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const nowIso = new Date().toISOString();
  const seenObjectIds = new Set<string>();
  const seenVideoIds = new Set<string>();

  interface PendingYoutubeHit {
    videoId: string;
    title: string;
    channelTitle: string;
    rawStoryText: string;
    points: number;
    commentsCount: number;
    publishedAt: string;
    publicationDateReliable: boolean;
    discussionUrl: string;
  }

  const pendingYoutube: PendingYoutubeHit[] = [];
  const articles: PipelineCandidate[] = [];

  const processHit = (hit: HnAlgoliaHit, expectYoutubeOnly: boolean): void => {
    const objId = typeof hit?.objectID === 'string' ? hit.objectID.trim() : '';
    if (objId && seenObjectIds.has(objId)) return;

    const rawTitle = typeof hit?.title === 'string' ? decodeHtmlEntities(hit.title).replace(/\s+/g, ' ').trim() : '';
    if (rawTitle.length < 12 || isCelebrityFluff(rawTitle)) return;

    const rawUrl = typeof hit?.url === 'string' ? hit.url.trim() : '';
    const videoId = extractYoutubeVideoId(rawUrl);

    if (videoId) {
      if (seenVideoIds.has(videoId)) return;
      seenVideoIds.add(videoId);
      if (objId) seenObjectIds.add(objId);

      const cleanTitle = cleanYoutubeTitle(rawTitle);
      const rawStoryText = cleanHtmlAndUrls(String(hit.story_text || '')).slice(0, 900);
      if (!isSupportedFeedLanguage(cleanTitle, rawStoryText)) return;

      const { iso, reliable } = parseFlexibleIsoDate(hit.created_at, nowIso);
      pendingYoutube.push({
        videoId,
        title: cleanTitle,
        channelTitle: 'YouTube',
        rawStoryText,
        points: typeof hit.points === 'number' && Number.isFinite(hit.points) ? hit.points : 0,
        commentsCount:
          typeof hit.num_comments === 'number' && Number.isFinite(hit.num_comments) ? hit.num_comments : 0,
        publishedAt: iso,
        publicationDateReliable: reliable,
        discussionUrl: objId
          ? `https://news.ycombinator.com/item?id=${objId}`
          : `https://www.youtube.com/watch?v=${videoId}`
      });
      return;
    }

    if (expectYoutubeOnly) return;

    const storyUrl = rawUrl || (objId ? `https://news.ycombinator.com/item?id=${objId}` : '');
    if (!/^https?:\/\//i.test(storyUrl)) return;
    if (objId) seenObjectIds.add(objId);

    const storyTextClean = cleanHtmlAndUrls(String(hit.story_text || ''));
    const points = typeof hit.points === 'number' && Number.isFinite(hit.points) ? hit.points : 0;
    const commentsCount =
      typeof hit.num_comments === 'number' && Number.isFinite(hit.num_comments) ? hit.num_comments : 0;

    // Only admit HN essays that either carry authentic story_text (>= 140 chars)
    // or are high-signal external discussions (>= 40 points, >= 15 comments)
    const hasAuthenticStoryText = storyTextClean.length >= 140;
    if (!hasAuthenticStoryText && (points < 40 || commentsCount < 15)) return;
    if (!isSupportedFeedLanguage(rawTitle, storyTextClean)) return;

    const domain = extractDomainFromUrlOrHost(storyUrl) || 'news.ycombinator.com';
    const fromSeedSource =
      seedDomains.has(domain) || Array.from(seedDomains).some(sd => domain.endsWith(`.${sd}`));
    const { iso: pubDate, reliable } = parseFlexibleIsoDate(hit.created_at, nowIso);
    const discussionUrl = objId ? `https://news.ycombinator.com/item?id=${objId}` : storyUrl;
    const authorLabel = hit.author ? `hn/${hit.author}` : domain;

    // Grounded authentic prose when story_text exists; otherwise strictly factual provenance only
    const dateLabel = pubDate.slice(0, 10);
    const bodyText = hasAuthenticStoryText
      ? storyTextClean.slice(0, 1600)
      : `Veröffentlicht auf ${domain} („${rawTitle}“) und in der Hacker-News-Fachcommunity von ${authorLabel} eingebracht (${points} Punkte, ${commentsCount} Kommentare, ${dateLabel}). Primärquelle und Diskussion sind direkt verlinkt.`;
    const feedExcerpt = hasAuthenticStoryText ? sliceAtSentenceBoundary(storyTextClean, 380) : bodyText;

    const candidateItem: FeedItem = {
      id: `premium-hn-${safeSlug}-${objId || stableShortHash(storyUrl)}`,
      type: 'deep_dive',
      format: 'sourced_update',
      title: rawTitle,
      subtitle: `${domain} • Hacker News (${points} Punkte · ${commentsCount} Kommentare)`,
      feedText: feedExcerpt,
      body: bodyText,
      articleBody: `### ${rawTitle}\n\n${bodyText}\n\n- **Primärquelle:** [${domain}](${storyUrl})\n- **Fachdiskussion:** [${commentsCount} Kommentare auf Hacker News](${discussionUrl})`,
      topics: [input.primaryTopic],
      primaryTopic: input.primaryTopic,
      sourceReferences: [
        {
          publisher: domain,
          originalUrl: storyUrl,
          title: rawTitle,
          publicationTimestamp: pubDate,
          retrievalTimestamp: nowIso,
          author: authorLabel,
          isVerified: true
        }
      ],
      publishedAt: pubDate,
      publicationDateReliable: reliable,
      generatedAt: nowIso,
      estimatedReadingMinutes: Math.max(2, Math.ceil(bodyText.split(/\s+/).filter(Boolean).length / 190)),
      relevanceExplanation: `Fachdiskurs auf ${domain} (${points} HN-Punkte) im Raum ${input.title}.`,
      contentStatus: 'editorial_briefing',
      isDailyEdition: false,
      editionDate: today,
      isDemonstration: false,
      aiAssisted: false,
      factReviewStatus: 'community_discussion',
      provenanceSummary: `🌐 ${domain} · Hacker News`,
      wordCount: bodyText.split(/\s+/).filter(Boolean).length,
      evidenceTier: hasAuthenticStoryText ? 'publisher_excerpt' : 'metadata_only',
      contentOrigin: 'live_ingested',
      contentHash: `premium-hn-${objId || stableShortHash(storyUrl)}`,
      canonicalUrl: storyUrl,
      space: normalizedHandle,
      flair: 'Fachdiskurs',
      keyInsight: hasAuthenticStoryText ? extractFirstSubstantiveSentence(storyTextClean, rawTitle) : rawTitle,
      externalCommunityScore: {
        platform: 'Hacker News',
        points: Math.max(0, Math.round(points)),
        commentsCount: Math.max(0, Math.round(commentsCount)),
        discussionUrl
      },
      upvotesCount: 0,
      awardsCount: { gold: 0, brain: 0, spark: 0 },
      sourceTrustLevel: 'community_curated',
      sourceDomain: domain,
      sourceBroadcasterName: domain,
      isTeachingRelated: input.primaryTopic === 'german_didactics',
      isChallengingPerspective: false,
      comments: []
    };

    const topicScore = computeTopicRelevanceScore(candidateItem, input.title, plan);
    articles.push({
      item: candidateItem,
      lane: 'hn_article',
      fromSeedSource,
      topicScore,
      baseScore:
        topicScore +
        (hasAuthenticStoryText ? 1.9 : 0.8) +
        (points >= 120 ? 0.8 : 0) +
        (fromSeedSource ? 3 : 0)
    });
  };

  for (const settled of essaySettled) {
    if (settled.status !== 'fulfilled' || !settled.value?.hits) continue;
    for (const hit of settled.value.hits) {
      processHit(hit, false);
    }
  }

  for (const settled of ytSettled) {
    if (settled.status !== 'fulfilled' || !settled.value?.hits) continue;
    for (const hit of settled.value.hits) {
      processHit(hit, true);
    }
  }

  // Enrich up to 6 YouTube hits in parallel via noembed.com (2200ms timeout, non-fatal)
  const ytTargets = pendingYoutube.slice(0, 6);
  if (ytTargets.length > 0) {
    await Promise.allSettled(
      ytTargets.map(async yt => {
        const watchUrl = `https://www.youtube.com/watch?v=${yt.videoId}`;
        const meta = await fetchJsonWithTimeout<NoembedResponse>(
          `https://noembed.com/embed?url=${encodeURIComponent(watchUrl)}`,
          2200
        );
        if (!meta || meta.error) return;
        if (typeof meta.author_name === 'string' && meta.author_name.trim().length > 0) {
          yt.channelTitle = meta.author_name.trim();
        }
        if (typeof meta.title === 'string') {
          const cleanEmbedTitle = cleanYoutubeTitle(meta.title);
          if (
            cleanEmbedTitle.length >= 12 &&
            isSupportedFeedLanguage(cleanEmbedTitle, yt.rawStoryText) &&
            (yt.title.length < 18 || /^(?:show hn|ask hn|watch|video)\b/i.test(yt.title))
          ) {
            yt.title = cleanEmbedTitle;
          }
        }
      })
    );
  }

  const videos: PipelineCandidate[] = [];
  for (const yt of ytTargets) {
    const watchUrl = `https://www.youtube.com/watch?v=${yt.videoId}`;
    const imageUrl = `https://i.ytimg.com/vi/${yt.videoId}/hqdefault.jpg`;
    const cleanDesc = cleanYoutubeDescription(yt.rawStoryText);
    const hasAuthenticDesc = cleanDesc.length >= 40;

    const articleLines = [
      `### ${yt.title}`,
      '',
      `- **Kanal / Urheber:** ${yt.channelTitle}`,
      `- **Quelle:** Hacker News (${yt.points} Punkte · ${yt.commentsCount} Kommentare)`,
      `- **YouTube-Direktlink:** [${watchUrl}](${watchUrl})`,
      `- **Diskussion:** [Hacker News](${yt.discussionUrl})`
    ];
    if (hasAuthenticDesc) {
      articleLines.push('', cleanDesc);
    }

    const candidateItem: FeedItem = {
      id: `premium-yt-${safeSlug}-${yt.videoId}`,
      type: 'deep_dive',
      format: 'youtube_gem',
      title: yt.title,
      subtitle: '',
      // Zero generic filler prose: keep authentic cleaned description or empty string
      feedText: hasAuthenticDesc ? cleanDesc : '',
      body: hasAuthenticDesc ? cleanDesc : '',
      articleBody: articleLines.join('\n'),
      imageUrl,
      hasAuthenticImage: true,
      topics: dedupeStrings([input.primaryTopic, 'youtube_gems'], 2) as TopicTag[],
      primaryTopic: input.primaryTopic,
      sourceReferences: [
        {
          publisher: yt.channelTitle,
          originalUrl: watchUrl,
          title: yt.title,
          publicationTimestamp: yt.publishedAt,
          retrievalTimestamp: nowIso,
          author: yt.channelTitle,
          isVerified: true
        }
      ],
      publishedAt: yt.publishedAt,
      publicationDateReliable: yt.publicationDateReliable,
      generatedAt: nowIso,
      estimatedReadingMinutes: 4,
      relevanceExplanation: `Video-Essay von ${yt.channelTitle} zum Thema ${input.title}.`,
      contentStatus: 'editorial_briefing',
      isDailyEdition: false,
      editionDate: today,
      isDemonstration: false,
      aiAssisted: false,
      factReviewStatus: 'community_discussion',
      provenanceSummary: `🎬 YouTube (${yt.channelTitle})`,
      wordCount: Math.max(8, cleanDesc.split(/\s+/).filter(Boolean).length),
      evidenceTier: 'publisher_excerpt',
      contentOrigin: 'live_ingested',
      contentHash: `yt-${yt.videoId}`,
      canonicalUrl: watchUrl,
      space: normalizedHandle,
      flair: 'Video-Essay',
      isEvergreenGem: yt.points >= 80,
      youtubeMeta: {
        videoId: yt.videoId,
        channelTitle: yt.channelTitle,
        duration: 'YouTube',
        keyTakeaways: [
          `Empfohlen via Hacker News (${yt.points} Punkte, ${yt.commentsCount} Kommentare)`,
          `Direktlink: ${watchUrl}`
        ]
      },
      externalCommunityScore: {
        platform: 'Hacker News',
        points: Math.max(0, Math.round(yt.points)),
        commentsCount: Math.max(0, Math.round(yt.commentsCount)),
        discussionUrl: yt.discussionUrl
      },
      upvotesCount: 0,
      awardsCount: { gold: 0, brain: 0, spark: 0 },
      sourceTrustLevel: 'verified_creator',
      sourceDomain: 'youtube.com',
      sourceBroadcasterName: yt.channelTitle,
      isTeachingRelated: input.primaryTopic === 'german_didactics',
      isChallengingPerspective: false,
      comments: []
    };

    const topicScore = computeTopicRelevanceScore(
      {
        title: yt.title,
        subtitle: yt.channelTitle,
        feedText: cleanDesc,
        body: yt.rawStoryText,
        sourceDomain: 'youtube.com'
      },
      input.title,
      plan
    );

    videos.push({
      item: candidateItem,
      lane: 'hn_youtube',
      fromSeedSource: false,
      topicScore,
      baseScore: topicScore + 2.0 + (yt.points >= 80 ? 0.8 : 0)
    });
  }

  return { articles, videos };
}

/**
 * Stage 3 Silent Editor-in-Chief AI Sieve:
 * NEVER modifies `feedText`, `body`, `articleBody`, `title`, or generates summaries.
 * Strictly outputs `{ id, keep, editorialScore, isGem }` to filter off-topic noise,
 * sort by editorial quality, and elevate true gems via `curationScore` / `isEvergreenGem`.
 */
async function runSilentEditorAiCuration(
  candidates: PipelineCandidate[],
  input: TopicPremiumPipelineInput,
  creds?: AiCredentials
): Promise<{ curated: PipelineCandidate[]; usedAi: boolean }> {
  if (input.skipNetworkInTests || !creds || !hasAiConfiguration(creds) || candidates.length < 3) {
    return { curated: candidates, usedAi: false };
  }

  const batch = candidates.slice(0, 14);
  const rest = candidates.slice(14);

  const compactRoster = batch.map(c => ({
    id: c.item.id,
    title: c.item.title.slice(0, 120),
    source: c.item.sourceBroadcasterName || c.item.sourceDomain || '',
    excerpt: (c.item.feedText || c.item.subtitle || '').slice(0, 180)
  }));

  const prompt = `Du bist der stille Chefredakteur von Atem.
Prüfe für den Themenraum "${input.title}" (${input.description || input.primaryTopic}), welche Originalbeiträge wirklich thematisch passen und redaktionell wertvoll sind.
STRENGE REGEL: Schreibe KEINE Texte, KEINE Zusammenfassungen und KEINE Erklärungen. Antworte NUR mit Bewertungs-Metadaten als JSON:
{
  "decisions": [
    { "id": "...", "keep": true, "editorialScore": 8.4, "isGem": false }
  ]
}
Kriterien:
- keep: false für themenfremde Treffer, Klickköder oder oberflächliches Rauschen; true für echte thematische Relevanz.
- editorialScore: 0 bis 10 (Tiefe, Originalität, thematische Passung).
- isGem: true nur für herausragende, zeitlose Tiefenstücke oder exzellente Primärquellen.

Kandidaten:
${JSON.stringify(compactRoster)}`;

  try {
    const aiRes = await callAiModel(prompt, {
      jsonMode: true,
      maxTokens: 600,
      timeoutMs: 12_000,
      credentials: creds,
      itemId: `studio-silent-editor-${normalizeSpaceHandle(input.handle)}-${Date.now()}`
    });

    const parsed = extractJsonFromAiResponse<AiEditorCurationPayload>(aiRes.text);
    const rawDecisions = Array.isArray(parsed?.decisions)
      ? (parsed.decisions as AiEditorDecisionRaw[])
      : Array.isArray(parsed)
        ? (parsed as AiEditorDecisionRaw[])
        : [];

    if (rawDecisions.length === 0) {
      return { curated: candidates, usedAi: false };
    }

    const decisionMap = new Map<string, { keep: boolean; editorialScore: number; isGem: boolean }>();
    for (const d of rawDecisions) {
      if (!d || typeof d.id !== 'string' || !d.id.trim()) continue;
      const keep = typeof d.keep === 'boolean' ? d.keep : true;
      const rawScore = typeof d.editorialScore === 'number' && Number.isFinite(d.editorialScore) ? d.editorialScore : 6.5;
      const editorialScore = Math.max(0, Math.min(10, Math.round(rawScore * 10) / 10));
      const isGem = d.isGem === true;
      decisionMap.set(d.id.trim(), { keep, editorialScore, isGem });
    }

    if (decisionMap.size === 0) {
      return { curated: candidates, usedAi: false };
    }

    const kept: PipelineCandidate[] = [];
    const fallbackDropped: PipelineCandidate[] = [];

    for (const cand of batch) {
      const verdict = decisionMap.get(cand.item.id);
      if (!verdict) {
        kept.push(cand);
        continue;
      }

      // Strictly update ONLY editorial sorting/elevation metadata — never touch prose!
      const updatedItem: FeedItem = {
        ...cand.item,
        curationScore: verdict.editorialScore,
        isEvergreenGem: verdict.isGem ? true : cand.item.isEvergreenGem
      };
      const updatedCand: PipelineCandidate = {
        ...cand,
        item: updatedItem,
        baseScore: cand.baseScore + verdict.editorialScore * 0.8 + (verdict.isGem ? 2.0 : 0)
      };

      if (verdict.keep || cand.fromSeedSource) {
        kept.push(updatedCand);
      } else {
        fallbackDropped.push(updatedCand);
      }
    }

    const combinedKept = [...kept, ...rest];
    if (combinedKept.length < 3 && fallbackDropped.length > 0) {
      fallbackDropped.sort((a, b) => b.baseScore - a.baseScore);
      combinedKept.push(...fallbackDropped.slice(0, 3 - combinedKept.length));
    }

    combinedKept.sort((a, b) => b.baseScore - a.baseScore);
    return { curated: combinedKept, usedAi: true };
  } catch {
    return { curated: candidates, usedAi: false };
  }
}

/**
 * AI Studio "Premium-Pipeline":
 * Populates any arbitrary custom topic channel with genuinely relevant real content
 * from 5 CORS-safe live lanes (Snapshot/Reservoir, Matching Catalog RSS via rss2json,
 * Wikipedia DE & EN, OpenAlex abstracts, and Hacker News Essays + YouTube Video-Essays),
 * with optional Silent Editor-in-Chief AI query planning & relevance curation.
 */
export async function runTopicPremiumPipeline(
  input: TopicPremiumPipelineInput
): Promise<TopicPremiumPipelineResult> {
  const normalizedHandle = normalizeSpaceHandle(input.handle);
  const targetCount = Math.max(1, input.targetCount ?? 18);
  const today = new Date().toISOString().slice(0, 10);
  const { seedDomains } = parseSeedSources(input.seedSources);

  let creds = input.credentials;
  if (!creds && !input.skipNetworkInTests) {
    try {
      creds = await loadAiCredentials();
    } catch {
      creds = undefined;
    }
  }

  // Stage 1: Query Architect
  input.onProgress?.('Analysiere Thema & Quellen…');
  const plan = await buildTopicQueryPlan(input, creds);

  if (input.skipNetworkInTests) {
    return {
      plan,
      items: [],
      usedAi: plan.usedAi,
      laneCounts: {
        snapshot: 0,
        rss: 0,
        wikipedia: 0,
        openAlex: 0,
        hnArticles: 0,
        hnYoutube: 0
      }
    };
  }

  // Stage 2: 5 CORS-Safe Live Lanes in Parallel
  input.onProgress?.('Recherchiere echte Artikel, Videos & Studien…');
  const [snapSettled, rssSettled, wikiSettled, oaSettled, hnSettled] = await Promise.allSettled([
    fetchSnapshotTopicLane(input, plan, seedDomains),
    fetchCatalogRssTopicLane(input, plan, seedDomains, today),
    fetchWikipediaBilingualLane(input, plan, today),
    fetchOpenAlexTopicLane(input, plan, today),
    fetchHackerNewsAndYoutubeLane(input, plan, seedDomains, today)
  ]);

  const snapCandidates = snapSettled.status === 'fulfilled' ? snapSettled.value : [];
  const rssCandidates = rssSettled.status === 'fulfilled' ? rssSettled.value : [];
  const wikiCandidates = wikiSettled.status === 'fulfilled' ? wikiSettled.value : [];
  const oaCandidates = oaSettled.status === 'fulfilled' ? oaSettled.value : [];
  const hnArticles = hnSettled.status === 'fulfilled' ? hnSettled.value.articles : [];
  const hnVideos = hnSettled.status === 'fulfilled' ? hnSettled.value.videos : [];

  const allRawCandidates: PipelineCandidate[] = [
    ...wikiCandidates,
    ...rssCandidates,
    ...oaCandidates,
    ...snapCandidates,
    ...hnVideos,
    ...hnArticles
  ];

  // Stage 3: Quality & Relevance Sieve
  input.onProgress?.('Filtere Qualität & Relevanz…');

  const seenIds = new Set<string>(input.existingIds ? [...input.existingIds] : []);
  const seenUrls = new Set<string>();
  if (input.existingUrls) {
    for (const rawUrl of input.existingUrls) {
      if (!rawUrl) continue;
      seenUrls.add(rawUrl);
      seenUrls.add(rawUrl.trim().toLowerCase());
      const norm = normalizeDedupeUrl(rawUrl);
      if (norm) seenUrls.add(norm);
    }
  }
  const seenTitles = new Set<string>();

  const filteredCandidates: PipelineCandidate[] = [];
  for (const cand of allRawCandidates) {
    const item = cand.item;
    if (!item?.id || !item?.title) continue;
    if (seenIds.has(item.id)) continue;

    const rawUrl = item.canonicalUrl || item.sourceReferences?.[0]?.originalUrl || '';
    const normUrl = normalizeDedupeUrl(rawUrl);
    if (rawUrl && (seenUrls.has(rawUrl) || seenUrls.has(rawUrl.toLowerCase()))) continue;
    if (normUrl && seenUrls.has(normUrl)) continue;

    const normTitle = normalizeTitleForDedupe(item.title);
    if (normTitle.length >= 10 && seenTitles.has(normTitle)) continue;

    if (isDoomscrollOrOffTopicNoise(item)) continue;
    if (!isSupportedFeedLanguage(item.title, `${item.subtitle || ''} ${item.feedText || ''} ${item.body || ''}`)) {
      continue;
    }
    if (hasAvoidTermCollision(item, plan.avoidTerms) && cand.topicScore < 4) continue;

    // Drop items with 0 topical relevance unless directly from a user-provided seedSource
    if (cand.topicScore <= 0 && !cand.fromSeedSource) continue;

    // Validate against curated quality contract (YouTube gems pass via isVerifiedYouTubeGemItem)
    if (!satisfiesDefaultCuratedStandard(item)) continue;

    seenIds.add(item.id);
    if (rawUrl) {
      seenUrls.add(rawUrl);
      seenUrls.add(rawUrl.toLowerCase());
    }
    if (normUrl) seenUrls.add(normUrl);
    if (normTitle.length >= 10) seenTitles.add(normTitle);
    filteredCandidates.push(cand);
  }

  filteredCandidates.sort((a, b) => b.baseScore - a.baseScore);

  const aiSieve = await runSilentEditorAiCuration(filteredCandidates, input, creds);
  const nowMs = Date.now();

  // Apply publisher diversity (<= 3 per domain) and targetCount cap
  const domainCounts = new Map<string, number>();
  const primaryPicked: PipelineCandidate[] = [];
  const overflowByDomain: PipelineCandidate[] = [];

  for (const cand of aiSieve.curated) {
    if (primaryPicked.length >= targetCount) break;
    const domainKey = (
      cand.item.sourceDomain ||
      extractDomainFromUrlOrHost(cand.item.canonicalUrl || '') ||
      'unknown'
    ).toLowerCase();
    const count = domainCounts.get(domainKey) ?? 0;
    if (count >= 3) {
      overflowByDomain.push(cand);
      continue;
    }
    domainCounts.set(domainKey, count + 1);
    primaryPicked.push(cand);
  }

  // Only relax domain cap slightly if we have fewer than 6 items total
  if (primaryPicked.length < Math.min(6, targetCount) && overflowByDomain.length > 0) {
    for (const cand of overflowByDomain) {
      if (primaryPicked.length >= Math.min(6, targetCount)) break;
      primaryPicked.push(cand);
    }
  }

  const finalItems: FeedItem[] = primaryPicked.map(cand => {
    const raw = cand.item;
    const isYt = raw.format === 'youtube_gem' || Boolean(raw.youtubeMeta?.videoId);

    const tagged: FeedItem = {
      ...raw,
      space: normalizedHandle,
      primaryTopic: input.primaryTopic,
      topics: raw.topics?.includes(input.primaryTopic)
        ? raw.topics
        : [input.primaryTopic, ...(raw.topics || [])].slice(0, 3),
      pinnedManualRunAt: nowMs
    };

    if (isYt) {
      // Preserve authentic YouTube gem fields & guarantee videoId + thumbnail even on snapshot-origin YouTube cards
      const resolvedVideoId =
        raw.youtubeMeta?.videoId ||
        extractYoutubeVideoId(raw.canonicalUrl || raw.sourceReferences?.[0]?.originalUrl || '') ||
        '';
      const resolvedImageUrl =
        raw.imageUrl ||
        (resolvedVideoId ? `https://i.ytimg.com/vi/${resolvedVideoId}/hqdefault.jpg` : undefined);
      return {
        ...tagged,
        format: 'youtube_gem',
        feedText: raw.feedText,
        body: raw.body,
        imageUrl: resolvedImageUrl,
        hasAuthenticImage: Boolean(resolvedImageUrl),
        ...(resolvedVideoId
          ? {
              youtubeMeta: {
                videoId: resolvedVideoId,
                channelTitle: raw.youtubeMeta?.channelTitle || raw.sourceBroadcasterName || 'YouTube',
                duration: raw.youtubeMeta?.duration || 'YouTube',
                ...(raw.youtubeMeta?.viewCount ? { viewCount: raw.youtubeMeta.viewCount } : {}),
                keyTakeaways: raw.youtubeMeta?.keyTakeaways || []
              }
            }
          : {})
      };
    }

    const sanitized = sanitizeCuratedFeedItem(tagged);
    return {
      ...sanitized,
      space: normalizedHandle,
      primaryTopic: input.primaryTopic,
      pinnedManualRunAt: nowMs
    };
  });

  return {
    plan,
    items: finalItems,
    usedAi: plan.usedAi || aiSieve.usedAi,
    laneCounts: {
      snapshot: snapCandidates.length,
      rss: rssCandidates.length,
      wikipedia: wikiCandidates.length,
      openAlex: oaCandidates.length,
      hnArticles: hnArticles.length,
      hnYoutube: hnVideos.length
    }
  };
}
