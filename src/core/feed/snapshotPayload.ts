import { FeedItem, FeedItemSchema } from '../domain/types';
import { isDeliveringHealth, parseSourceHealth, SourceHealthInfo } from '../ingestion/sourceHealth';

export const STARTUP_SNAPSHOT_MAX_ITEMS = 450;
export const STARTUP_SNAPSHOT_MAX_BYTES = 3_500_000;
export const RESERVOIR_MAX_ITEMS = 950;
export const RESERVOIR_MAX_BYTES = 9_000_000;

export interface SnapshotPayload {
  generatedAt?: string;
  totalCandidateSources: number;
  activeDeliveringSources: number;
  totalAvailableItems: number;
  items: FeedItem[];
  sourceHealth: Record<string, SourceHealthInfo>;
}

export interface ParseSnapshotOptions {
  maxItems?: number;
  maxBytes?: number;
  skipByteBudget?: boolean;
}

export interface CompactSnapshotItemOptions {
  maxBodyChars?: number;
}

const sharedTextEncoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;

export function utf8ByteLength(value: string): number {
  if (!value) return 0;
  if (typeof Buffer !== 'undefined' && typeof Buffer.byteLength === 'function') {
    return Buffer.byteLength(value, 'utf8');
  }
  if (sharedTextEncoder) {
    return sharedTextEncoder.encode(value).byteLength;
  }
  let bytes = 0;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 0x80) {
      bytes += 1;
    } else if (code < 0x800) {
      bytes += 2;
    } else if (code >= 0xd800 && code <= 0xdbff && i + 1 < value.length) {
      const next = value.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        i++;
      } else {
        bytes += 3;
      }
    } else {
      bytes += 3;
    }
  }
  return bytes;
}

function truncateTextAtCleanBoundary(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const slice = text.slice(0, maxChars);
  const minKeep = Math.floor(maxChars * 0.6);
  const paraBreak = slice.lastIndexOf('\n\n');
  if (paraBreak >= minKeep) {
    return `${slice.slice(0, paraBreak).trimEnd()}\n\n…`;
  }
  const sentenceBreak = Math.max(
    slice.lastIndexOf('. '),
    slice.lastIndexOf('.\n'),
    slice.lastIndexOf('! '),
    slice.lastIndexOf('? ')
  );
  if (sentenceBreak >= minKeep) {
    return `${slice.slice(0, sentenceBreak + 1).trimEnd()}\n\n…`;
  }
  const spaceBreak = slice.lastIndexOf(' ');
  if (spaceBreak >= minKeep) {
    return `${slice.slice(0, spaceBreak).trimEnd()}…`;
  }
  return `${slice.trimEnd()}…`;
}

const OPTIONAL_EMPTY_STRING_KEYS: readonly string[] = [
  'updatedAt',
  'editorialNote',
  'flair',
  'keyInsight',
  'challengePrompt',
  'didacticSeed',
  'didacticTransfer',
  'evergreenContext',
  'sourceDomain',
  'sourceBroadcasterName',
  'imageCredit',
  'curationReason',
  'curatedAt',
  'firstSeenAt',
  'historicalYearOrEra',
  'recommendedBecauseOfTitle',
  'contentHash'
];

const OPTIONAL_FALSE_BOOLEAN_KEYS: readonly string[] = [
  'hasAuthenticImage',
  'isEvergreenGem',
  'isNewlyCurated',
  'isNewlyArrived',
  'isStoryDossier',
  'isStaticFallback'
];

/**
 * Compacts a FeedItem for serialized snapshot/reservoir JSON without losing ReaderScreen content:
 * - Stores the richest fulltext ONCE in `body` and omits redundant `articleBody` (restored on hydrate)
 * - Omits `relatedCrossReferences` (computed lazily in < 1ms by LocalFeedRepository.getItemById)
 * - Strips empty optional fields and schema-default boilerplate safely
 */
export function compactItemForSnapshot(
  item: FeedItem,
  options?: CompactSnapshotItemOptions
): FeedItem {
  const rawArticleBody = typeof item.articleBody === 'string' ? item.articleBody.trim() : '';
  const rawBody = typeof item.body === 'string' ? item.body.trim() : '';
  let richestBody = rawArticleBody.length > rawBody.length ? rawArticleBody : rawBody;
  if (!richestBody) {
    richestBody = typeof item.body === 'string' ? item.body : (item.articleBody ?? '');
  }
  if (options?.maxBodyChars && options.maxBodyChars > 0 && richestBody.length > options.maxBodyChars) {
    richestBody = truncateTextAtCleanBoundary(richestBody, options.maxBodyChars);
  }

  const out: Record<string, unknown> = { ...item, body: richestBody };
  delete out.articleBody;
  delete out.relatedCrossReferences;

  // Strip null/undefined keys
  for (const key of Object.keys(out)) {
    if (out[key] === undefined || out[key] === null) {
      delete out[key];
    }
  }

  // Strip schema-defaulted empty/zero boilerplate (restored cleanly on hydrate)
  if (Array.isArray(out.comments) && out.comments.length === 0) {
    delete out.comments;
  }
  if (
    out.awardsCount &&
    typeof out.awardsCount === 'object' &&
    (out.awardsCount as { gold?: number; brain?: number; spark?: number }).gold === 0 &&
    (out.awardsCount as { gold?: number; brain?: number; spark?: number }).brain === 0 &&
    (out.awardsCount as { gold?: number; brain?: number; spark?: number }).spark === 0
  ) {
    delete out.awardsCount;
  }
  if (out.upvotesCount === 0) delete out.upvotesCount;
  if (out.isTeachingRelated === false) delete out.isTeachingRelated;
  if (out.isChallengingPerspective === false) delete out.isChallengingPerspective;
  if (out.isDailyEdition === true) delete out.isDailyEdition;

  // Deduplicate identical optional metadata strings
  if (out.didacticSeed && out.didacticSeed === out.didacticTransfer) {
    delete out.didacticSeed;
  }
  if (out.firstSeenAt && out.firstSeenAt === out.generatedAt) {
    delete out.firstSeenAt;
  }

  for (const key of OPTIONAL_EMPTY_STRING_KEYS) {
    if (out[key] === '') delete out[key];
  }
  for (const key of OPTIONAL_FALSE_BOOLEAN_KEYS) {
    if (out[key] === false) delete out[key];
  }
  if (Array.isArray(out.targetEditions) && out.targetEditions.length === 0) {
    delete out.targetEditions;
  }
  if (Array.isArray(out.corroboratingSources) && out.corroboratingSources.length === 0) {
    delete out.corroboratingSources;
  }

  return out as unknown as FeedItem;
}

/**
 * Slims sourceHealth for public snapshot delivery while preserving 100% SourceHealthSchema
 * validity and activeDeliveringSources / failing source telemetry.
 * Pure reference homepages are omitted because SourceRepository classifies them locally.
 */
export function compactSourceHealthForSnapshot(
  sourceHealth: Record<string, SourceHealthInfo>
): Record<string, SourceHealthInfo> {
  const compact: Record<string, SourceHealthInfo> = {};
  for (const [id, info] of Object.entries(sourceHealth)) {
    if (!info || info.sourceId !== id) continue;
    if (
      !info.fetchSuccess &&
      info.itemCount === 0 &&
      typeof info.lastError === 'string' &&
      info.lastError.includes('Referenzseite')
    ) {
      continue;
    }
    const slim: SourceHealthInfo = {
      sourceId: info.sourceId,
      name: info.name,
      url: info.url,
      fetchSuccess: info.fetchSuccess,
      itemCount: info.itemCount
    };
    if (info.lastSuccessAt) slim.lastSuccessAt = info.lastSuccessAt;
    if (info.lastError) {
      slim.lastError = info.lastError.length > 90 ? `${info.lastError.slice(0, 87)}...` : info.lastError;
    }
    compact[id] = slim;
  }
  return compact;
}

const VALID_CONTENT_TYPES = new Set([
  'quick_insight', 'briefing', 'deep_dive', 'perspective', 'connection', 'personal_update', 'discovery'
]);
const VALID_TOPIC_TAGS = new Set([
  'philosophy_ethics', 'german_didactics', 'ai_apple', 'contemplation_mind',
  'science_society', 'sound_synthesis', 'memes_satire', 'youtube_gems',
  'book_mastery', 'health_biohacking', 'opportunities_growth', 'art_aesthetics'
]);
const VALID_CONTENT_STATUSES = new Set([
  'verified_fact', 'scientific_analysis', 'philosophical_perspective', 'editorial_briefing', 'demonstration_fixture'
]);
const VALID_FORMATS = new Set([
  'concise_insight', 'sourced_update', 'creative_idea', 'intriguing_question',
  'surprising_connection', 'perspective_disagreement', 'long_invitation',
  'meme', 'comic', 'youtube_gem', 'book_masterpiece', 'opportunity_radar', 'art_showcase'
]);
const VALID_FACT_REVIEW_STATUSES = new Set([
  'curated_illustrative', 'historical_reference', 'pedagogical_concept', 'philosophical_discourse',
  'scientific_paper', 'encyclopedia_entry', 'public_news', 'community_discussion'
]);
const VALID_EVIDENCE_TIERS = new Set([
  'metadata_only', 'publisher_excerpt', 'permitted_full_text', 'multiple_sources'
]);
const VALID_CONTENT_ORIGINS = new Set(['live_ingested', 'enriched_ai', 'demo_fixture']);
const VALID_TRUST_LEVELS = new Set([
  'public_broadcaster', 'peer_reviewed', 'verified_creator', 'deep_essay',
  'community_curated', 'encyclopedia', 'museum_collection'
]);
const VALID_SYNTHESIS_TYPES = new Set([
  'original_text', 'publisher_excerpt', 'editorial_deepening', 'scientific_synthesis'
]);
const VALID_ENRICHMENT_TIERS = new Set(['ai', 'local', 'none']);
const VALID_DAY_EDITIONS = new Set(['morning', 'midday', 'evening']);
const FAST_HTTP_URL_RE = /^https?:\/\/[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+(?::\d+)?(?:[/?#][^\s]*)?$/i;

const OPTIONAL_SCALAR_STRING_FIELDS: readonly string[] = [
  'articleBody', 'updatedAt', 'editorialNote', 'space', 'flair', 'keyInsight',
  'challengePrompt', 'didacticSeed', 'didacticTransfer', 'evergreenContext',
  'sourceDomain', 'sourceBroadcasterName', 'imageCredit', 'curationReason',
  'curatedAt', 'firstSeenAt', 'historicalYearOrEra', 'recommendedBecauseOfTitle', 'contentHash'
];

const OPTIONAL_SCALAR_BOOLEAN_FIELDS: readonly string[] = [
  'isDailyEdition', 'isDemonstration', 'aiAssisted', 'isTeachingRelated',
  'isChallengingPerspective', 'isEvergreenGem', 'hasAuthenticImage', 'isNewlyCurated',
  'publicationDateReliable', 'isNewlyArrived', 'isStoryDossier', 'isStaticFallback'
];

const COMPLEX_FALLBACK_FIELDS: readonly string[] = [
  'quiz', 'deepeningOptions', 'youtubeMeta', 'bookMeta', 'memeMeta',
  'hivemindMeta', 'opportunityMeta', 'relatedCrossReferences',
  'externalCommunityScore', 'corroboratingSources', 'socraticSalon'
];

function hydrateArticleBody(item: FeedItem): FeedItem {
  if (!item.articleBody && item.body) {
    return { ...item, articleBody: item.body };
  }
  return item;
}

function isPlainRecord(val: unknown): val is Record<string, unknown> {
  return Boolean(val && typeof val === 'object' && !Array.isArray(val));
}

function isOptionalString(val: unknown): boolean {
  return val === undefined || typeof val === 'string';
}

/**
 * O(1) structural validator for well-formed snapshot items.
 * Returns:
 * - hydrated `FeedItem` when strictly conforming
 * - `'reject'` when definitely malformed (missing core strings)
 * - `'fallback'` when rare complex nested fields or edge cases need full Zod parsing
 */
function fastValidateSnapshotItem(raw: unknown): FeedItem | 'reject' | 'fallback' {
  if (!isPlainRecord(raw)) return 'reject';

  // Core required strings — fast O(1) reject for junk entries like `{ id: 'bad' }`
  if (
    typeof raw.id !== 'string' ||
    typeof raw.title !== 'string' ||
    typeof raw.subtitle !== 'string' ||
    typeof raw.body !== 'string' ||
    typeof raw.publishedAt !== 'string' ||
    typeof raw.generatedAt !== 'string' ||
    typeof raw.relevanceExplanation !== 'string' ||
    typeof raw.editionDate !== 'string' ||
    typeof raw.provenanceSummary !== 'string'
  ) {
    return 'reject';
  }

  // Required enums & positive integers
  if (
    typeof raw.type !== 'string' || !VALID_CONTENT_TYPES.has(raw.type) ||
    typeof raw.primaryTopic !== 'string' || !VALID_TOPIC_TAGS.has(raw.primaryTopic) ||
    typeof raw.contentStatus !== 'string' || !VALID_CONTENT_STATUSES.has(raw.contentStatus) ||
    typeof raw.estimatedReadingMinutes !== 'number' || !Number.isInteger(raw.estimatedReadingMinutes) || raw.estimatedReadingMinutes <= 0 ||
    typeof raw.wordCount !== 'number' || !Number.isInteger(raw.wordCount) || raw.wordCount <= 0
  ) {
    return 'fallback';
  }

  // Topics array
  if (!Array.isArray(raw.topics) || raw.topics.length < 1) return 'fallback';
  for (let i = 0; i < raw.topics.length; i++) {
    const t = raw.topics[i];
    if (typeof t !== 'string' || !VALID_TOPIC_TAGS.has(t)) return 'fallback';
  }

  // Source references
  if (!Array.isArray(raw.sourceReferences)) return 'fallback';
  let needsRefDefault = false;
  for (let i = 0; i < raw.sourceReferences.length; i++) {
    const ref = raw.sourceReferences[i];
    if (!isPlainRecord(ref)) return 'fallback';
    if (
      typeof ref.publisher !== 'string' ||
      typeof ref.title !== 'string' ||
      typeof ref.retrievalTimestamp !== 'string' ||
      typeof ref.originalUrl !== 'string' || !FAST_HTTP_URL_RE.test(ref.originalUrl) ||
      !isOptionalString(ref.publicationTimestamp) ||
      !isOptionalString(ref.author) ||
      (ref.isVerified !== undefined && typeof ref.isVerified !== 'boolean')
    ) {
      return 'fallback';
    }
    if (ref.isVerified === undefined) needsRefDefault = true;
  }

  // Defer rare complex nested objects to full Zod schema
  for (let i = 0; i < COMPLEX_FALLBACK_FIELDS.length; i++) {
    if (raw[COMPLEX_FALLBACK_FIELDS[i]] !== undefined) return 'fallback';
  }

  // Optional/defaulted enums
  if (raw.format !== undefined && (typeof raw.format !== 'string' || !VALID_FORMATS.has(raw.format))) return 'fallback';
  if (raw.factReviewStatus !== undefined && (typeof raw.factReviewStatus !== 'string' || !VALID_FACT_REVIEW_STATUSES.has(raw.factReviewStatus))) return 'fallback';
  if (raw.evidenceTier !== undefined && (typeof raw.evidenceTier !== 'string' || !VALID_EVIDENCE_TIERS.has(raw.evidenceTier))) return 'fallback';
  if (raw.contentOrigin !== undefined && (typeof raw.contentOrigin !== 'string' || !VALID_CONTENT_ORIGINS.has(raw.contentOrigin))) return 'fallback';
  if (raw.sourceTrustLevel !== undefined && (typeof raw.sourceTrustLevel !== 'string' || !VALID_TRUST_LEVELS.has(raw.sourceTrustLevel))) return 'fallback';
  if (raw.editorialSynthesisType !== undefined && (typeof raw.editorialSynthesisType !== 'string' || !VALID_SYNTHESIS_TYPES.has(raw.editorialSynthesisType))) return 'fallback';
  if (raw.enrichmentTier !== undefined && (typeof raw.enrichmentTier !== 'string' || !VALID_ENRICHMENT_TIERS.has(raw.enrichmentTier))) return 'fallback';

  // Optional URLs
  if (raw.canonicalUrl !== undefined && (typeof raw.canonicalUrl !== 'string' || !FAST_HTTP_URL_RE.test(raw.canonicalUrl))) return 'fallback';
  if (raw.imageUrl !== undefined && (typeof raw.imageUrl !== 'string' || !FAST_HTTP_URL_RE.test(raw.imageUrl))) return 'fallback';

  // feedText & optional scalar strings
  if (raw.feedText !== undefined && typeof raw.feedText !== 'string') return 'fallback';
  for (let i = 0; i < OPTIONAL_SCALAR_STRING_FIELDS.length; i++) {
    const val = raw[OPTIONAL_SCALAR_STRING_FIELDS[i]];
    if (val !== undefined && typeof val !== 'string') return 'fallback';
  }

  // Optional booleans
  for (let i = 0; i < OPTIONAL_SCALAR_BOOLEAN_FIELDS.length; i++) {
    const val = raw[OPTIONAL_SCALAR_BOOLEAN_FIELDS[i]];
    if (val !== undefined && typeof val !== 'boolean') return 'fallback';
  }

  // Optional numbers
  if (raw.upvotesCount !== undefined && (typeof raw.upvotesCount !== 'number' || !Number.isInteger(raw.upvotesCount))) return 'fallback';
  if (raw.score !== undefined && (typeof raw.score !== 'number' || !Number.isFinite(raw.score))) return 'fallback';
  if (raw.pinnedManualRunAt !== undefined && (typeof raw.pinnedManualRunAt !== 'number' || !Number.isFinite(raw.pinnedManualRunAt))) return 'fallback';
  if (raw.curationScore !== undefined && (typeof raw.curationScore !== 'number' || !Number.isFinite(raw.curationScore) || raw.curationScore < 0 || raw.curationScore > 10)) return 'fallback';

  // Comments (empty fast path; non-empty falls back to Zod)
  if (raw.comments !== undefined && (!Array.isArray(raw.comments) || raw.comments.length > 0)) return 'fallback';

  // awardsCount
  if (raw.awardsCount !== undefined) {
    if (!isPlainRecord(raw.awardsCount)) return 'fallback';
    const ac = raw.awardsCount;
    if (
      (ac.gold !== undefined && (typeof ac.gold !== 'number' || !Number.isInteger(ac.gold))) ||
      (ac.brain !== undefined && (typeof ac.brain !== 'number' || !Number.isInteger(ac.brain))) ||
      (ac.spark !== undefined && (typeof ac.spark !== 'number' || !Number.isInteger(ac.spark)))
    ) {
      return 'fallback';
    }
  }

  // Common nested objects (artMeta, perspectiveDetails, editorialAbstract, targetEditions)
  if (raw.artMeta !== undefined) {
    if (!isPlainRecord(raw.artMeta)) return 'fallback';
    const am = raw.artMeta;
    if (
      typeof am.artist !== 'string' ||
      typeof am.museum !== 'string' ||
      typeof am.highResImageUrl !== 'string' ||
      typeof am.aestheticImpulse !== 'string' ||
      !isOptionalString(am.year) ||
      !isOptionalString(am.medium) ||
      !isOptionalString(am.styleMovement)
    ) {
      return 'fallback';
    }
  }

  if (raw.perspectiveDetails !== undefined) {
    if (!isPlainRecord(raw.perspectiveDetails)) return 'fallback';
    const pd = raw.perspectiveDetails;
    if (
      typeof pd.claim !== 'string' ||
      typeof pd.humanSource !== 'string' ||
      !isOptionalString(pd.interpretation) ||
      !isOptionalString(pd.prediction) ||
      !isOptionalString(pd.counterPerspective) ||
      !isOptionalString(pd.uncertaintyNote)
    ) {
      return 'fallback';
    }
  }

  if (raw.editorialAbstract !== undefined) {
    if (!isPlainRecord(raw.editorialAbstract)) return 'fallback';
    const ea = raw.editorialAbstract;
    if (
      typeof ea.overview !== 'string' ||
      typeof ea.keyFinding !== 'string' ||
      typeof ea.relevanceWhy !== 'string' ||
      !isOptionalString(ea.limitation)
    ) {
      return 'fallback';
    }
  }

  if (raw.targetEditions !== undefined) {
    if (!Array.isArray(raw.targetEditions)) return 'fallback';
    for (let i = 0; i < raw.targetEditions.length; i++) {
      const ed = raw.targetEditions[i];
      if (typeof ed !== 'string' || !VALID_DAY_EDITIONS.has(ed)) return 'fallback';
    }
  }

  // Hydrate schema defaults + articleBody seamlessly
  const ac = isPlainRecord(raw.awardsCount) ? raw.awardsCount : null;
  const hydrated: FeedItem = {
    ...(raw as unknown as FeedItem),
    format: (raw.format as FeedItem['format']) ?? 'concise_insight',
    feedText: typeof raw.feedText === 'string' ? raw.feedText : '',
    articleBody: (typeof raw.articleBody === 'string' && raw.articleBody.length > 0)
      ? raw.articleBody
      : (raw.body || undefined),
    sourceReferences: needsRefDefault
      ? (raw.sourceReferences as FeedItem['sourceReferences']).map(ref => ({
          ...ref,
          isVerified: ref.isVerified ?? false
        }))
      : (raw.sourceReferences as FeedItem['sourceReferences']),
    isDailyEdition: typeof raw.isDailyEdition === 'boolean' ? raw.isDailyEdition : true,
    isDemonstration: typeof raw.isDemonstration === 'boolean' ? raw.isDemonstration : true,
    aiAssisted: typeof raw.aiAssisted === 'boolean' ? raw.aiAssisted : true,
    factReviewStatus: (raw.factReviewStatus as FeedItem['factReviewStatus']) ?? 'curated_illustrative',
    evidenceTier: (raw.evidenceTier as FeedItem['evidenceTier']) ?? 'publisher_excerpt',
    contentOrigin: (raw.contentOrigin as FeedItem['contentOrigin']) ?? 'demo_fixture',
    contentHash: typeof raw.contentHash === 'string' ? raw.contentHash : '',
    isTeachingRelated: typeof raw.isTeachingRelated === 'boolean' ? raw.isTeachingRelated : false,
    isChallengingPerspective: typeof raw.isChallengingPerspective === 'boolean' ? raw.isChallengingPerspective : false,
    upvotesCount: typeof raw.upvotesCount === 'number' ? raw.upvotesCount : 0,
    comments: Array.isArray(raw.comments) ? (raw.comments as FeedItem['comments']) : [],
    awardsCount: ac
      ? {
          gold: typeof ac.gold === 'number' ? ac.gold : 0,
          brain: typeof ac.brain === 'number' ? ac.brain : 0,
          spark: typeof ac.spark === 'number' ? ac.spark : 0
        }
      : { gold: 0, brain: 0, spark: 0 },
    sourceTrustLevel: (raw.sourceTrustLevel as FeedItem['sourceTrustLevel']) ?? 'verified_creator'
  };

  return hydrated;
}

/** Keeps complete reader bodies, taking one item per publisher before subsequent passes. */
export function selectStartupItems(
  items: FeedItem[],
  byteBudget = STARTUP_SNAPSHOT_MAX_BYTES,
  maxItems = STARTUP_SNAPSHOT_MAX_ITEMS
): FeedItem[] {
  const buckets = new Map<string, FeedItem[]>();
  for (const item of items) {
    // Treat curated knowledge vault items as distinct high-signal entries so museum collections are preserved
    const publisher = item.id.startsWith('vault-')
      ? item.id
      : (item.sourceDomain || item.sourceReferences[0]?.publisher || item.id);
    const queue = buckets.get(publisher) || [];
    queue.push(item);
    buckets.set(publisher, queue);
  }
  const result: FeedItem[] = [];
  let bytes = 2;
  const seen = new Set<string>();
  let pending = true;
  while (pending && result.length < maxItems) {
    pending = false;
    for (const queue of buckets.values()) {
      const item = queue.shift();
      if (!item) continue;
      pending = true;
      const key = item.canonicalUrl || item.id;
      if (seen.has(key)) continue;
      seen.add(key);
      const itemBytes = utf8ByteLength(JSON.stringify(item)) + (result.length ? 1 : 0);
      if (bytes + itemBytes > byteBudget) continue;
      result.push(item);
      bytes += itemBytes;
      if (result.length === maxItems) break;
    }
  }
  return result;
}

/** Fast client-side selector skipping per-item JSON.stringify when payload already fits memory budget. */
function selectItemsSkipByteBudget(items: FeedItem[], maxItems: number): FeedItem[] {
  if (items.length <= maxItems) {
    const result: FeedItem[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const key = item.canonicalUrl || item.id;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(item);
    }
    return result;
  }

  const buckets = new Map<string, FeedItem[]>();
  for (const item of items) {
    const publisher = item.id.startsWith('vault-')
      ? item.id
      : (item.sourceDomain || item.sourceReferences[0]?.publisher || item.id);
    const queue = buckets.get(publisher) || [];
    queue.push(item);
    buckets.set(publisher, queue);
  }
  const result: FeedItem[] = [];
  const seen = new Set<string>();
  let pending = true;
  while (pending && result.length < maxItems) {
    pending = false;
    for (const queue of buckets.values()) {
      const item = queue.shift();
      if (!item) continue;
      pending = true;
      const key = item.canonicalUrl || item.id;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(item);
      if (result.length === maxItems) break;
    }
  }
  return result;
}

export function parseSnapshotPayload(
  value: unknown,
  options?: ParseSnapshotOptions
): SnapshotPayload | null {
  if (!value || typeof value !== 'object') return null;
  const maxItems = options?.maxItems ?? STARTUP_SNAPSHOT_MAX_ITEMS;
  const maxBytes = options?.maxBytes ?? STARTUP_SNAPSHOT_MAX_BYTES;
  const object = value as Record<string, unknown>;
  const rawItems = Array.isArray(value) ? value : object.items;
  if (!Array.isArray(rawItems)) return null;
  const validItems: FeedItem[] = [];
  for (let i = 0; i < rawItems.length; i++) {
    const raw = rawItems[i];
    const fastResult = fastValidateSnapshotItem(raw);
    if (fastResult === 'reject') continue;
    if (fastResult !== 'fallback') {
      validItems.push(fastResult);
      continue;
    }
    const parsed = FeedItemSchema.safeParse(raw);
    if (parsed.success) validItems.push(hydrateArticleBody(parsed.data));
  }
  if (!validItems.length) return null;
  const sourceHealth = parseSourceHealth(object.sourceHealth);
  const generatedAt = typeof object.generatedAt === 'string' && Number.isFinite(Date.parse(object.generatedAt))
    ? object.generatedAt : undefined;
  const payload: SnapshotPayload = {
    generatedAt,
    totalCandidateSources: typeof object.totalCandidateSources === 'number' && Number.isInteger(object.totalCandidateSources) && object.totalCandidateSources >= 0
      ? object.totalCandidateSources : Object.keys(sourceHealth).length,
    activeDeliveringSources: Object.values(sourceHealth).filter(isDeliveringHealth).length,
    totalAvailableItems: typeof object.totalAvailableItems === 'number' && Number.isInteger(object.totalAvailableItems) && object.totalAvailableItems >= validItems.length
      ? object.totalAvailableItems : validItems.length,
    items: [],
    sourceHealth
  };
  if (options?.skipByteBudget === true) {
    payload.items = selectItemsSkipByteBudget(validItems, maxItems);
  } else {
    const metadataBytes = utf8ByteLength(JSON.stringify(payload));
    payload.items = selectStartupItems(validItems, Math.max(0, maxBytes - metadataBytes), maxItems);
  }
  return payload.items.length ? payload : null;
}

export function parseReservoirPayload(
  value: unknown,
  options?: ParseSnapshotOptions
): SnapshotPayload | null {
  return parseSnapshotPayload(value, {
    maxItems: options?.maxItems ?? RESERVOIR_MAX_ITEMS,
    maxBytes: options?.maxBytes ?? RESERVOIR_MAX_BYTES,
    skipByteBudget: options?.skipByteBudget
  });
}
