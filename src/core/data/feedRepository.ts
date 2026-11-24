import { FeedItem, UserProfile, ReadingInteraction, TOPIC_SPACE_MAP, DayEditionType } from '../domain/types';
import { INITIAL_FIXTURES } from './fixtures';
import {
  rankAndInterleaveFeed,
  rankBloomScrollFeed,
  ScoredFeedItem,
  scoreFeedItem
} from '../domain/ranking';
import { AtemStorage, appStorage } from './storage';
import { FeedCacheStore, defaultFeedCacheStore } from './feedCacheStore';
import { REAL_KNOWLEDGE_VAULT } from './realKnowledgeVault';
import { enrichItemWithInstantResearch } from '../synthesis/backgroundResearchPipeline';
import {
  defaultBatchEditionEnricher,
  sanitizeCuratedFeedItem,
  isSupportedFeedLanguage,
  IRRELEVANT_WETLAB_OR_NICHE_ACADEMIC_REGEX
} from '../enrichment/batchEnricher';
import { ArticleIndex } from '../feed/articleIndex';
import { RelatedContentService } from '../feed/RelatedContentService';
import { FeedMergeService, MergeOptions } from '../feed/FeedMergeService';
import { defaultFeedOperationManager, FeedOperationResult, FeedOperationType } from '../feed/FeedOperationManager';
import { defaultSnapshotLoader } from '../feed/SnapshotLoader';
import { parseSnapshotPayload } from '../feed/snapshotPayload';
import { isDeprecatedShowcaseStarterItem } from '../learning/hivemindLearningService';
import { seenImpressionsService } from './seenImpressionsService';

const SNAPSHOT_CACHE_REUSE_TTL_MS = 15 * 60 * 1000;

/**
 * Identifies bundled static fallback entries (`vault-*`, `init-*`, or `isStaticFallback === true`).
 */
export function isStaticFallbackItem(
  item: Pick<FeedItem, 'id' | 'isStaticFallback'>
): boolean {
  if (!item) return false;
  if (item.isStaticFallback === true) return true;
  const id = String(item.id || '');
  return id.startsWith('vault-') || id.startsWith('init-');
}

function isRejectedCachedItem(item: Partial<FeedItem> | null | undefined): boolean {
  if (!item || typeof item !== 'object') return true;
  if (isDeprecatedShowcaseStarterItem(item)) return true;
  const id = String(item.id || '');
  if (id.startsWith('openweb-doaj-') || id.startsWith('openweb-crossref-')) return true;
  const title = String(item.title || '');
  const context = `${item.subtitle || ''} ${item.feedText || ''}`;
  if (title && !isSupportedFeedLanguage(title, context)) return true;
  if (IRRELEVANT_WETLAB_OR_NICHE_ACADEMIC_REGEX.test(`${title} ${context}`)) return true;
  return false;
}

function itemContentRichness(item: Pick<FeedItem, 'articleBody' | 'body' | 'feedText'>): number {
  return Math.max(
    (item.articleBody || '').length,
    (item.body || '').length,
    (item.feedText || '').length
  );
}

/**
 * Applies the top-batch teaching/challenging/no-consecutive-topic diversity sweep
 * directly on already-scored items without re-scoring.
 */
function ensureTopBatchDiversity(ranked: ScoredFeedItem[], batchSize = 5): ScoredFeedItem[] {
  if (ranked.length <= batchSize) return ranked;

  const topBatch = ranked.slice(0, batchSize);
  const rest = ranked.slice(batchSize);

  const insertSafelyIntoRest = (item: ScoredFeedItem) => {
    const lastTopTopic = topBatch[topBatch.length - 1]?.primaryTopic;
    if (
      rest.length > 0 &&
      (rest[0].primaryTopic === item.primaryTopic || lastTopTopic === item.primaryTopic)
    ) {
      const nextDiffIdx = rest.findIndex(
        r => r.primaryTopic !== item.primaryTopic && r.primaryTopic !== lastTopTopic
      );
      if (nextDiffIdx !== -1) {
        rest.splice(nextDiffIdx, 0, item);
        return;
      }
    }
    rest.unshift(item);
  };

  if (!topBatch.some(i => i.isTeachingRelated || i.primaryTopic === 'german_didactics')) {
    const tIdx = rest.findIndex(i => i.isTeachingRelated || i.primaryTopic === 'german_didactics');
    if (tIdx !== -1) {
      const [teachItem] = rest.splice(tIdx, 1);
      const displaced = topBatch[batchSize - 1];
      topBatch[batchSize - 1] = teachItem;
      insertSafelyIntoRest(displaced);
    }
  }

  if (!topBatch.some(i => i.isChallengingPerspective || i.type === 'perspective')) {
    const cIdx = rest.findIndex(i => i.isChallengingPerspective || i.type === 'perspective');
    if (cIdx !== -1 && batchSize >= 2) {
      const [challItem] = rest.splice(cIdx, 1);
      const replacePos = topBatch[batchSize - 2]?.isTeachingRelated ? batchSize - 3 : batchSize - 2;
      const pos = Math.max(0, replacePos);
      const displaced = topBatch[pos];
      topBatch[pos] = challItem;
      insertSafelyIntoRest(displaced);
    }
  }

  for (let i = 0; i < topBatch.length - 1; i++) {
    if (topBatch[i].primaryTopic === topBatch[i + 1].primaryTopic) {
      const swapIdx = topBatch.findIndex((x, idx) => idx > i + 1 && x.primaryTopic !== topBatch[i].primaryTopic);
      if (swapIdx !== -1) {
        const temp = topBatch[i + 1];
        topBatch[i + 1] = topBatch[swapIdx];
        topBatch[swapIdx] = temp;
      }
    }
  }
  if (rest.length > 0 && topBatch[topBatch.length - 1].primaryTopic === rest[0].primaryTopic) {
    const swapRestIdx = rest.findIndex(r => r.primaryTopic !== topBatch[topBatch.length - 1].primaryTopic);
    if (swapRestIdx !== -1) {
      const [nonDup] = rest.splice(swapRestIdx, 1);
      rest.unshift(nonDup);
    }
  }

  return [...topBatch, ...rest];
}

/**
 * Applies deterministic daily-edition variation & multipliers directly onto a pre-computed base score
 * so `scoreFeedItem` is never invoked repeatedly across morning / midday / evening / discovery.
 */
function scoreForEditionFromBase(
  base: ScoredFeedItem,
  editionType: DayEditionType,
  seed: string,
  shuffleOffset: number = 0
): ScoredFeedItem {
  let hash = 0;
  const str = `${seed}_s${shuffleOffset}_${editionType}_${base.id}`;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const variationFactor = 0.92 + (Math.abs(hash) % 160) / 1000;

  let editionMultiplier = 1.0;

  if (editionType === 'morning') {
    if (base.sourceTrustLevel === 'public_broadcaster' || base.format === 'sourced_update') editionMultiplier += 0.35;
    if (base.primaryTopic === 'science_society') editionMultiplier += 0.30;
    if (base.primaryTopic === 'ai_apple') editionMultiplier += 0.20;
    if (base.estimatedReadingMinutes <= 3) editionMultiplier += 0.20;
  } else if (editionType === 'midday') {
    if (base.isTeachingRelated || base.primaryTopic === 'german_didactics') editionMultiplier += 0.35;
    if (base.primaryTopic === 'opportunities_growth' || base.primaryTopic === 'health_biohacking') editionMultiplier += 0.30;
    if (base.primaryTopic === 'memes_satire' || base.format === 'meme') editionMultiplier += 0.30;
    if (base.primaryTopic === 'youtube_gems' || base.format === 'youtube_gem') editionMultiplier += 0.25;
  } else if (editionType === 'evening') {
    if (base.format === 'long_invitation' || base.estimatedReadingMinutes >= 4) editionMultiplier += 0.35;
    if (base.primaryTopic === 'philosophy_ethics' || base.primaryTopic === 'contemplation_mind') editionMultiplier += 0.30;
    if (base.primaryTopic === 'book_mastery' || base.format === 'book_masterpiece') editionMultiplier += 0.30;
    if (base.primaryTopic === 'sound_synthesis' || base.primaryTopic === 'art_aesthetics') editionMultiplier += 0.25;
    if (base.isEvergreenGem) editionMultiplier += 0.25;
  }

  if (base.targetEditions && base.targetEditions.length > 0) {
    if (base.targetEditions.includes(editionType)) {
      editionMultiplier += 0.20;
    } else {
      editionMultiplier -= 0.30;
    }
  }

  const adjustedScore = Math.round(base.score * variationFactor * Math.max(0.1, editionMultiplier) * 1000) / 1000;
  return {
    ...base,
    score: adjustedScore
  };
}

// Dynamic, non-static load of pipeline output in Node.js test / CLI environments
// Uses eval('require') so Metro / Expo Web bundler DOES NOT bundle 1.8 MB of JSON into the client JS
let nodePipelineItems: FeedItem[] = [];
if (typeof process !== 'undefined' && process.versions?.node && !(process as any).browser) {
  try {
    const fsMod = eval('require')('fs');
    const pathMod = eval('require')('path');
    const pipelinePath = pathMod.resolve(__dirname, 'pipeline-output.json');
    if (fsMod.existsSync(pipelinePath)) {
      const parsed = JSON.parse(fsMod.readFileSync(pipelinePath, 'utf-8'));
      if (Array.isArray(parsed)) {
        nodePipelineItems = parsed as FeedItem[];
      }
    }
  } catch {
    nodePipelineItems = [];
  }
}

export function enrichSocialFeedItem(rawItem: FeedItem, options?: { lazyCrossReferences?: boolean }): FeedItem {
  const item = enrichItemWithInstantResearch(rawItem, options);

  const topic = item.primaryTopic || 'philosophy_ethics';
  const topicMeta = TOPIC_SPACE_MAP[topic];
  const space = item.space || topicMeta?.space || `c/${topic}`;
  const flair = item.flair || topicMeta?.flair || '◈ Recherche';

  // Only keep imageUrl if it genuinely belongs to the item (no generic Unsplash stock photos on text articles)
  const isGenericUnsplash = Boolean(
    item.imageUrl &&
    item.imageUrl.includes('images.unsplash.com') &&
    item.format !== 'art_showcase'
  );
  const imageUrl = isGenericUnsplash ? undefined : item.imageUrl;
  const hasAuthenticImage = Boolean(imageUrl);

  // Honest provenance for encyclopedias and museum collections
  const domain = (item.sourceDomain || item.canonicalUrl || '').toLowerCase();
  const isWiki = domain.includes('wikipedia.org');
  const isMuseum = domain.includes('artic.edu') || domain.includes('wikimedia.org');

  const sourceTrustLevel = isWiki
    ? 'encyclopedia'
    : isMuseum
    ? 'museum_collection'
    : item.sourceTrustLevel;

  const factReviewStatus = isWiki
    ? 'encyclopedia_entry'
    : item.factReviewStatus;

  // Grounded: Zero fake upvotes, zero fake awards, zero simulated human comments
  const safeFormat = item.format === 'art_showcase' && !hasAuthenticImage ? 'sourced_update' : item.format;

  return {
    ...item,
    format: safeFormat,
    space,
    flair,
    imageUrl,
    hasAuthenticImage,
    sourceTrustLevel,
    factReviewStatus,
    upvotesCount: item.upvotesCount || 0,
    awardsCount: item.awardsCount || { gold: 0, brain: 0, spark: 0 },
    comments: item.comments || []
  };
}

export type ContentOperationOptions = Pick<MergeOptions, 'pinInserted' | 'pinUpdated' | 'telemetry' | 'operationId'>;

export interface IFeedRepository {
  getDailyEdition(profile: UserProfile, interactions?: Record<string, ReadingInteraction>): Promise<ScoredFeedItem[]>;
  getEditionFeed(
    editionType: DayEditionType,
    profile: UserProfile,
    interactions?: Record<string, ReadingInteraction>,
    dateSeed?: string,
    shuffleOffset?: number,
    previouslyShownIds?: Set<string>
  ): Promise<ScoredFeedItem[]>;
  getDiscoveryItems(
    profile: UserProfile,
    interactions?: Record<string, ReadingInteraction>,
    excludedIds?: Set<string>,
    shuffleOffset?: number,
    previouslyShownIds?: Set<string>
  ): Promise<ScoredFeedItem[]>;
  getEditionAndDiscovery?(
    editionType: DayEditionType,
    profile: UserProfile,
    interactions?: Record<string, ReadingInteraction>,
    dateSeed?: string,
    shuffleOffset?: number,
    previouslyShownIds?: Set<string>
  ): Promise<{ daily: ScoredFeedItem[]; discovery: ScoredFeedItem[] }>;
  getItemById(id: string): Promise<FeedItem | null>;
  searchItems(query: string, profile: UserProfile, interactions?: Record<string, ReadingInteraction>): Promise<ScoredFeedItem[]>;
  setItems?(items: FeedItem[]): void;
  addItems?(items: FeedItem[], options?: { operationType?: FeedOperationType; pinInserted?: boolean; telemetry?: import('../feed/FeedOperationManager').FeedOperationTelemetry }): void;
  getAllItems?(): FeedItem[];
  ensureInitialized?(): Promise<void>;
  hydrateFromBootDeck?(): Promise<{ loadedCount: number; generatedAt?: string }>;
  clearCache?(): Promise<void>;
  hydrateFromPublicSnapshot?(
    remoteUrl?: string,
    options?: { forceRefresh?: boolean }
  ): Promise<{
    success: boolean;
    itemCount: number;
    insertedCount?: number;
    snapshotDate?: string;
    generatedAt?: string;
    fromCache?: boolean;
  }>;
  hydrateFromReservoir?(remoteUrl?: string): Promise<{
    success: boolean;
    itemCount: number;
    insertedCount: number;
    generatedAt?: string;
  }>;
  curateAndAddItems?(items: FeedItem[]): Promise<FeedItem[]>;
  executeContentOperation?(type: FeedOperationType, candidates: FeedItem[], options?: ContentOperationOptions): Promise<FeedOperationResult>;
}

export class LocalFeedRepository implements IFeedRepository {
  private items: FeedItem[];
  private dynamicItems: FeedItem[] = [];
  private storage: AtemStorage;
  private cacheStore: FeedCacheStore;
  private articleIndex: ArticleIndex;
  private relatedService: RelatedContentService;
  private indexDirty: boolean = true;
  private indexTimer: ReturnType<typeof setTimeout> | null = null;
  private indexIdleHandle: number | null = null;
  private itemsVersion: number = 0;
  private scoreCache: {
    version: number;
    profile: UserProfile;
    interactions: Record<string, ReadingInteraction>;
    byId: Map<string, ScoredFeedItem>;
  } | null = null;
  private dynamicInitPromise: Promise<void>;

  private cancelScheduledIndexBuild(): void {
    if (this.indexTimer !== null) {
      clearTimeout(this.indexTimer);
      this.indexTimer = null;
    }
    if (
      this.indexIdleHandle !== null &&
      typeof window !== 'undefined' &&
      typeof (window as any).cancelIdleCallback === 'function'
    ) {
      (window as any).cancelIdleCallback(this.indexIdleHandle);
      this.indexIdleHandle = null;
    }
  }

  private ensureIndexReady(): void {
    if (!this.indexDirty) return;
    this.cancelScheduledIndexBuild();
    this.articleIndex.buildIndex(this.items);
    this.relatedService.setIndex(this.articleIndex);
    this.indexDirty = false;
  }

  private scheduleIndexBuild(): void {
    this.indexDirty = true;
    this.itemsVersion++;
    this.scoreCache = null;

    const isBrowserRuntime = typeof window !== 'undefined' && typeof document !== 'undefined';
    if (!isBrowserRuntime) {
      // Keep lazy in Node/tests: zero idle timer leaks and built on demand in ensureIndexReady()
      return;
    }

    this.cancelScheduledIndexBuild();
    const runBuild = () => {
      this.indexIdleHandle = null;
      this.indexTimer = null;
      if (!this.indexDirty) return;
      this.articleIndex.buildIndex(this.items);
      this.relatedService.setIndex(this.articleIndex);
      this.indexDirty = false;
    };

    if (typeof (window as any).requestIdleCallback === 'function') {
      this.indexIdleHandle = (window as any).requestIdleCallback(runBuild, { timeout: 1000 });
    } else {
      this.indexTimer = setTimeout(runBuild, 350);
    }
  }

  private getBaseScores(
    profile: UserProfile,
    interactions: Record<string, ReadingInteraction> = {}
  ): Map<string, ScoredFeedItem> {
    if (
      this.scoreCache &&
      this.scoreCache.version === this.itemsVersion &&
      this.scoreCache.profile === profile &&
      this.scoreCache.interactions === interactions
    ) {
      return this.scoreCache.byId;
    }

    const byId = new Map<string, ScoredFeedItem>();
    for (const item of this.items) {
      byId.set(item.id, scoreFeedItem(item, profile, interactions));
    }
    this.scoreCache = {
      version: this.itemsVersion,
      profile,
      interactions,
      byId
    };
    return byId;
  }

  private allocateEditionsFromBase(
    baseScores: Map<string, ScoredFeedItem>,
    dateSeed?: string,
    shuffleOffset: number = 0,
    previouslyShownIds?: Set<string>
  ): Record<DayEditionType, ScoredFeedItem[]> {
    const seed = dateSeed || new Date().toISOString().slice(0, 10);
    const targetPerEdition = 8;
    const assignedIds = new Set<string>();
    const editions: DayEditionType[] = ['morning', 'midday', 'evening'];
    const allocations: Record<DayEditionType, ScoredFeedItem[]> = {
      morning: [],
      midday: [],
      evening: []
    };

    const allScored = Array.from(baseScores.values());
    const unshownPool =
      previouslyShownIds && previouslyShownIds.size > 0
        ? allScored.filter(item => !previouslyShownIds.has(item.id))
        : [];

    for (const edition of editions) {
      let availablePool =
        unshownPool.length > 0
          ? unshownPool.filter(item => !assignedIds.has(item.id))
          : allScored.filter(item => !assignedIds.has(item.id));

      if (availablePool.length < targetPerEdition) {
        const currentAvailableIds = new Set(availablePool.map(i => i.id));
        const backfill = allScored.filter(
          item => !assignedIds.has(item.id) && !currentAvailableIds.has(item.id)
        );
        availablePool = [...availablePool, ...backfill];
      }

      const scored = availablePool.map(base =>
        scoreForEditionFromBase(base, edition, seed, shuffleOffset)
      );

      // Rank top candidate slice (bounded for speed while keeping teaching/challenging quotas intact)
      let rankingInput = scored;
      if (scored.length > 140) {
        const byScore = [...scored].sort((a, b) => (b.score || 0) - (a.score || 0));
        const topSlice = byScore.slice(0, 120);
        const topSliceIds = new Set(topSlice.map(i => i.id));
        let extraTeaching = 0;
        let extraChallenging = 0;
        for (let i = 120; i < byScore.length; i++) {
          const cand = byScore[i];
          if (
            extraTeaching < 8 &&
            (cand.isTeachingRelated || cand.primaryTopic === 'german_didactics') &&
            !topSliceIds.has(cand.id)
          ) {
            topSlice.push(cand);
            topSliceIds.add(cand.id);
            extraTeaching++;
          } else if (
            extraChallenging < 8 &&
            (cand.isChallengingPerspective || cand.type === 'perspective') &&
            !topSliceIds.has(cand.id)
          ) {
            topSlice.push(cand);
            topSliceIds.add(cand.id);
            extraChallenging++;
          }
          if (extraTeaching >= 8 && extraChallenging >= 8) break;
        }
        rankingInput = topSlice;
      }

      const bloomRanked = rankBloomScrollFeed(rankingInput);
      const count = Math.min(targetPerEdition, bloomRanked.length);
      const topBatch = bloomRanked.slice(0, count);
      const remainder = bloomRanked.slice(count);

      if (
        (edition === 'morning' || edition === 'midday') &&
        !topBatch.some(i => i.isTeachingRelated || i.primaryTopic === 'german_didactics')
      ) {
        const tIdx = remainder.findIndex(
          i => i.isTeachingRelated || i.primaryTopic === 'german_didactics'
        );
        if (tIdx !== -1 && topBatch.length > 0) {
          const [elevated] = remainder.splice(tIdx, 1);
          topBatch[topBatch.length - 1] = elevated;
        }
      }

      if (!topBatch.some(i => i.isChallengingPerspective)) {
        const cIdx = remainder.findIndex(i => i.isChallengingPerspective);
        if (cIdx !== -1 && topBatch.length > 1) {
          const [elevated] = remainder.splice(cIdx, 1);
          topBatch[topBatch.length - 2] = elevated;
        } else {
          const pIdx = remainder.findIndex(i => i.type === 'perspective');
          if (pIdx !== -1 && topBatch.length > 1) {
            const [elevated] = remainder.splice(pIdx, 1);
            topBatch[topBatch.length - 2] = elevated;
          }
        }
      }

      for (const item of topBatch) {
        assignedIds.add(item.id);
      }
      allocations[edition] = topBatch;
    }

    return allocations;
  }

  private rankDiscoveryFromBase(
    baseScores: Map<string, ScoredFeedItem>,
    profile: UserProfile,
    interactions: Record<string, ReadingInteraction> = {},
    excludedIds?: Set<string>,
    shuffleOffset: number = 0,
    previouslyShownIds?: Set<string>
  ): ScoredFeedItem[] {
    const excludeSet = new Set<string>(excludedIds ?? []);
    if (!excludedIds) {
      const dailyScored: ScoredFeedItem[] = [];
      for (const item of this.items) {
        if (item.isDailyEdition) {
          const s = baseScores.get(item.id);
          if (s) dailyScored.push(s);
        }
      }
      const rankedDaily = ensureTopBatchDiversity(rankBloomScrollFeed(dailyScored), 5);
      for (const i of rankedDaily.slice(0, 12)) excludeSet.add(i.id);
    }
    if (previouslyShownIds && previouslyShownIds.size > 0 && shuffleOffset > 0) {
      for (const id of previouslyShownIds) excludeSet.add(id);
    }

    let remainingItems = this.items.filter(item => !excludeSet.has(item.id));
    if (remainingItems.length < 12) {
      const baseDailyExclude = new Set(
        this.items
          .filter(i => i.isDailyEdition)
          .slice(0, 8)
          .map(i => i.id)
      );
      const unshownIds = new Set(remainingItems.map(i => i.id));
      const backfill = this.items.filter(
        item => !baseDailyExclude.has(item.id) && !unshownIds.has(item.id)
      );
      remainingItems = [...remainingItems, ...backfill];
    }

    const remainingScored = remainingItems.map(
      item => baseScores.get(item.id) ?? scoreFeedItem(item, profile, interactions)
    );
    const ranked = ensureTopBatchDiversity(rankBloomScrollFeed(remainingScored), 5);
    const rankedIds = new Set(ranked.map(r => r.id));
    const missingNonArdTail = remainingItems
      .filter(item => !rankedIds.has(item.id))
      .map(item => baseScores.get(item.id) ?? scoreFeedItem(item, profile, interactions));
    const completeRanked = missingNonArdTail.length > 0 ? [...ranked, ...missingNonArdTail] : ranked;
    return this.applyPinnedItems(completeRanked, profile, interactions, excludeSet, baseScores);
  }

  constructor(customItemsOrStorage?: FeedItem[] | AtemStorage, storage: AtemStorage = appStorage) {
    if (
      customItemsOrStorage instanceof AtemStorage ||
      (customItemsOrStorage && typeof (customItemsOrStorage as any).getItem === 'function' && !Array.isArray(customItemsOrStorage))
    ) {
      this.storage = customItemsOrStorage as AtemStorage;
    } else {
      this.storage = storage;
    }
    this.cacheStore = this.storage === appStorage ? defaultFeedCacheStore : new FeedCacheStore(this.storage);
    this.articleIndex = new ArticleIndex();
    this.relatedService = new RelatedContentService(this.articleIndex);

    if (Array.isArray(customItemsOrStorage)) {
      this.items = customItemsOrStorage.map(i => enrichSocialFeedItem(i, { lazyCrossReferences: true }));
    } else {
      const map = new Map<string, FeedItem>();

      // 1. Pipeline items in Node environment
      for (const item of nodePipelineItems) {
        if (!map.has(item.id)) {
          map.set(item.id, enrichSocialFeedItem(item, { lazyCrossReferences: true }));
        }
      }

      // 2. Real Grounded Knowledge Vault & Timeless Classics
      for (const item of REAL_KNOWLEDGE_VAULT) {
        if (!map.has(item.id)) {
          map.set(item.id, enrichSocialFeedItem(item, { lazyCrossReferences: true }));
        }
      }

      // 3. Initial Curated Bootstrap Fixtures (only inject if real pool < 30)
      if (map.size < 30) {
        for (const item of INITIAL_FIXTURES) {
          if (!map.has(item.id)) {
            map.set(item.id, enrichSocialFeedItem(item, { lazyCrossReferences: true }));
          }
        }
      }
      this.items = this.purgeDemoFixturesIfSufficient(Array.from(map.values()));
    }

    this.scheduleIndexBuild();
    this.dynamicInitPromise = this.initDynamicItems();
  }

  async ensureInitialized(): Promise<void> {
    await this.dynamicInitPromise;
  }

  /**
   * Hydrates the compact `< 100 KB` Boot-Deck (`@atem:boot_deck:v1`) in `< 20ms`
   * so warm boots immediately render fresh real cards while IndexedDB / network hydrate full bodies.
   */
  async hydrateFromBootDeck(): Promise<{ loadedCount: number; generatedAt?: string }> {
    try {
      const deck = await this.cacheStore.getBootDeck();
      if (!deck || !Array.isArray(deck.items) || deck.items.length === 0) {
        return { loadedCount: 0 };
      }

      const map = new Map<string, FeedItem>();
      for (const item of this.items) {
        if (!isRejectedCachedItem(item)) {
          map.set(item.id, item);
        }
      }

      let loadedCount = 0;
      for (const raw of deck.items) {
        if (isRejectedCachedItem(raw)) continue;
        const existing = map.get(raw.id);
        if (existing && itemContentRichness(existing) >= itemContentRichness(raw)) {
          // Never downgrade an already-loaded full article with a compact boot-deck preview
          continue;
        }
        const clean = sanitizeCuratedFeedItem(enrichSocialFeedItem(raw, { lazyCrossReferences: true }));
        map.set(clean.id, clean);
        loadedCount++;
      }

      if (loadedCount > 0) {
        this.items = this.purgeDemoFixturesIfSufficient(Array.from(map.values()));
        this.scheduleIndexBuild();
      }
      return { loadedCount, generatedAt: deck.generatedAt };
    } catch {
      return { loadedCount: 0 };
    }
  }

  async clearCache(): Promise<void> {
    await this.cacheStore.clearAll();
  }

  private purgeDemoFixturesIfSufficient(items: FeedItem[]): FeedItem[] {
    const demoIds = new Set(INITIAL_FIXTURES.map(f => f.id));
    const realItems = items.filter(i => !demoIds.has(i.id));
    const pool = realItems.length >= 30 ? realItems : items;
    return this.capActivePool(pool, 1200);
  }

  /**
   * Caps active in-memory article pool to 1,200 items (O(1) space map keeps Space switching < 2ms),
   * strictly protecting Hivemind learning items, saved items, and unseen discoveries ahead of already-seen items.
   */
  private capActivePool(items: FeedItem[], maxItems = 1200): FeedItem[] {
    if (items.length <= maxItems) return items;
    const seenSet = seenImpressionsService.getSeenIdsSync();
    const protectedIds = new Set<string>();
    for (const item of items) {
      if (isDeprecatedShowcaseStarterItem(item)) continue;
      if (
        (item.id.startsWith('hivemind-') && !isDeprecatedShowcaseStarterItem(item)) ||
        item.id.startsWith('flourish-') ||
        (item.isEvergreenGem === true && item.space === 'c/kunst_galerie') ||
        Boolean((item as any).isSaved)
      ) {
        protectedIds.add(item.id);
      }
    }

    const byTopicUnseen = new Map<string, FeedItem[]>();
    const byTopicSeen = new Map<string, FeedItem[]>();
    for (const item of items) {
      const topic = item.primaryTopic || 'general';
      const targetMap = seenSet.has(item.id) ? byTopicSeen : byTopicUnseen;
      const list = targetMap.get(topic) || [];
      list.push(item);
      targetMap.set(topic, list);
    }

    const keptIds = new Set<string>(protectedIds);

    const fillFromTopicMap = (topicMap: Map<string, FeedItem[]>) => {
      const topicKeys = Array.from(topicMap.keys());
      let round = 0;
      let added = true;
      while (keptIds.size < maxItems && added) {
        added = false;
        for (const topic of topicKeys) {
          if (keptIds.size >= maxItems) break;
          const list = topicMap.get(topic);
          if (list && round < list.length) {
            const cand = list[round];
            if (!keptIds.has(cand.id)) {
              keptIds.add(cand.id);
              added = true;
            }
          }
        }
        round++;
      }
    };

    // Pass 1: Keep all unseen items round-robin across topics first
    fillFromTopicMap(byTopicUnseen);
    // Pass 2: Only fill remaining capacity with already-seen items
    if (keptIds.size < maxItems) {
      fillFromTopicMap(byTopicSeen);
    }

    return items.filter(it => keptIds.has(it.id));
  }

  private async initDynamicItems(): Promise<void> {
    try {
      const parsed = await this.cacheStore.getDynamicItems();
      if (Array.isArray(parsed) && parsed.length > 0) {
        const filtered = parsed.filter((i: any) => !isRejectedCachedItem(i));
        this.dynamicItems = filtered.map(i =>
          sanitizeCuratedFeedItem(enrichSocialFeedItem(i, { lazyCrossReferences: true }))
        );
        if (filtered.length !== parsed.length) {
          await this.cacheStore.setDynamicItems(this.dynamicItems);
        }
        const map = new Map<string, FeedItem>();
        for (const item of this.items) {
          if (!isRejectedCachedItem(item)) {
            map.set(item.id, item);
          }
        }
        for (const dyn of this.dynamicItems) {
          const existing = map.get(dyn.id);
          if (!existing || itemContentRichness(dyn) >= itemContentRichness(existing)) {
            map.set(dyn.id, dyn);
          }
        }
        this.items = this.purgeDemoFixturesIfSufficient(Array.from(map.values()));
        this.scheduleIndexBuild();
      }
    } catch {
      // Non-fatal fallback
    }
  }

  private async persistDynamicItems(): Promise<void> {
    try {
      this.dynamicItems = this.dynamicItems.filter(i => !isRejectedCachedItem(i));
      await this.cacheStore.setDynamicItems(this.dynamicItems);
    } catch {
      // Non-fatal fallback
    }
  }

  setItems(items: FeedItem[]): void {
    const map = new Map<string, FeedItem>();
    const canonicalMap = new Map<string, string>();

    for (const item of items) {
      if (isRejectedCachedItem(item)) continue;
      const enriched = sanitizeCuratedFeedItem(enrichSocialFeedItem(item, { lazyCrossReferences: true }));
      map.set(item.id, enriched);
      if (item.canonicalUrl) {
        canonicalMap.set(item.canonicalUrl.toLowerCase(), item.id);
      }
    }
    const hasRichPool = map.size >= 25;
    for (const item of REAL_KNOWLEDGE_VAULT) {
      // Keep curated museum artworks available, but never re-inject 2004 archive essays into populated live pools
      if (hasRichPool && item.space !== 'c/kunst_galerie') continue;
      const canon = item.canonicalUrl?.toLowerCase();
      if (!map.has(item.id) && (!canon || !canonicalMap.has(canon))) {
        map.set(item.id, enrichSocialFeedItem(item, { lazyCrossReferences: true }));
        if (canon) canonicalMap.set(canon, item.id);
      }
    }
    const nowMs = Date.now();
    const isStaleDynamic = (dyn: FeedItem): boolean => {
      if (
        dyn.publicationDateReliable === false ||
        dyn.format === 'art_showcase' ||
        dyn.format === 'meme' ||
        dyn.space === 'c/kunst_galerie' ||
        dyn.space === 'c/memes'
      ) {
        return false;
      }
      const pubTime = new Date(dyn.publishedAt).getTime();
      return !isNaN(pubTime) && nowMs - pubTime > 14 * 86400 * 1000;
    };

    const survivingDynamic: FeedItem[] = [];
    for (const dyn of this.dynamicItems) {
      if (isRejectedCachedItem(dyn)) continue;
      if (!map.has(dyn.id) && isStaleDynamic(dyn)) continue;
      const canon = dyn.canonicalUrl?.toLowerCase();
      const existingIdForCanon = canon ? canonicalMap.get(canon) : undefined;
      if (map.has(dyn.id)) {
        const cleanDyn = sanitizeCuratedFeedItem(dyn);
        map.set(dyn.id, cleanDyn);
        survivingDynamic.push(cleanDyn);
      } else if (existingIdForCanon) {
        // Duplicate canonical URL under a different ID is not resurrected
      } else {
        const cleanDyn = sanitizeCuratedFeedItem(dyn);
        map.set(dyn.id, cleanDyn);
        if (canon) canonicalMap.set(canon, dyn.id);
        survivingDynamic.push(cleanDyn);
      }
    }
    this.dynamicItems = survivingDynamic;
    this.items = this.purgeDemoFixturesIfSufficient(Array.from(map.values()));
    this.scheduleIndexBuild();
  }

  addItems(
    newItems: FeedItem[],
    options?: {
      operationType?: FeedOperationType;
      pinInserted?: boolean;
      telemetry?: import('../feed/FeedOperationManager').FeedOperationTelemetry;
    }
  ): void {
    const cleanInput = newItems.filter(i => !isRejectedCachedItem(i));
    const enrichedNew = cleanInput.map(i =>
      sanitizeCuratedFeedItem(enrichSocialFeedItem(i, { lazyCrossReferences: true }))
    );
    const mergeResult = FeedMergeService.merge(this.items, enrichedNew, {
      operationType: options?.operationType ?? 'background_sync',
      pinInserted: options?.pinInserted ?? false,
      telemetry: options?.telemetry
    });

    this.items = this.purgeDemoFixturesIfSufficient(mergeResult.mergedItems);
    this.rememberMergedChanges(mergeResult.operationResult);
    this.scheduleIndexBuild();
    void this.persistDynamicItems();
  }

  getAllItems(): FeedItem[] {
    return [...this.items];
  }

  private applyPinnedItems(
    rankedItems: ScoredFeedItem[],
    profile: UserProfile,
    interactions: Record<string, ReadingInteraction> = {},
    excludedIds: Set<string> = new Set(),
    baseScores?: Map<string, ScoredFeedItem>
  ): ScoredFeedItem[] {
    const pinnedIds = defaultFeedOperationManager.getPinnedItemIds();
    if (pinnedIds.length === 0) return rankedItems;

    const pinnedSet = new Set(pinnedIds);
    const topPinned: ScoredFeedItem[] = [];

    for (const id of pinnedIds) {
      if (excludedIds.has(id)) continue;
      const cached = baseScores?.get(id);
      if (cached) {
        topPinned.push(cached);
        continue;
      }
      const match = this.items.find(i => i.id === id);
      if (match) {
        topPinned.push(scoreFeedItem(match, profile, interactions));
      }
    }

    const unpinnedRanked = rankedItems.filter(i => !pinnedSet.has(i.id));
    return [...topPinned, ...unpinnedRanked];
  }

  async getDailyEdition(
    profile: UserProfile,
    interactions: Record<string, ReadingInteraction> = {}
  ): Promise<ScoredFeedItem[]> {
    const baseScores = this.getBaseScores(profile, interactions);
    const dailyScored: ScoredFeedItem[] = [];
    for (const item of this.items) {
      if (item.isDailyEdition) {
        const scored = baseScores.get(item.id);
        if (scored) dailyScored.push(scored);
      }
    }
    const rankedDaily = ensureTopBatchDiversity(rankBloomScrollFeed(dailyScored), 5);
    const withPinned = this.applyPinnedItems(rankedDaily, profile, interactions, new Set(), baseScores);
    return withPinned.slice(0, 12);
  }

  async getEditionFeed(
    editionType: DayEditionType,
    profile: UserProfile,
    interactions: Record<string, ReadingInteraction> = {},
    dateSeed?: string,
    shuffleOffset?: number,
    previouslyShownIds?: Set<string>
  ): Promise<ScoredFeedItem[]> {
    if (this.items.length === 0) return [];
    const baseScores = this.getBaseScores(profile, interactions);
    const allocations = this.allocateEditionsFromBase(
      baseScores,
      dateSeed,
      shuffleOffset ?? 0,
      previouslyShownIds
    );
    const ranked = allocations[editionType] || [];
    return this.applyPinnedItems(ranked, profile, interactions, new Set(), baseScores);
  }

  async getDiscoveryItems(
    profile: UserProfile,
    interactions: Record<string, ReadingInteraction> = {},
    excludedIds?: Set<string>,
    shuffleOffset: number = 0,
    previouslyShownIds?: Set<string>
  ): Promise<ScoredFeedItem[]> {
    const baseScores = this.getBaseScores(profile, interactions);
    return this.rankDiscoveryFromBase(
      baseScores,
      profile,
      interactions,
      excludedIds,
      shuffleOffset,
      previouslyShownIds
    );
  }

  /**
   * Single-pass recompute computing both Daily Edition and Discovery streams from
   * one shared `scoreFeedItem` pass across `this.items`.
   */
  async getEditionAndDiscovery(
    editionType: DayEditionType,
    profile: UserProfile,
    interactions: Record<string, ReadingInteraction> = {},
    dateSeed?: string,
    shuffleOffset: number = 0,
    previouslyShownIds?: Set<string>
  ): Promise<{ daily: ScoredFeedItem[]; discovery: ScoredFeedItem[] }> {
    if (this.items.length === 0) {
      return { daily: [], discovery: [] };
    }
    const baseScores = this.getBaseScores(profile, interactions);
    const allocations = this.allocateEditionsFromBase(
      baseScores,
      dateSeed,
      shuffleOffset,
      previouslyShownIds
    );
    const daily = this.applyPinnedItems(
      allocations[editionType] || [],
      profile,
      interactions,
      new Set(),
      baseScores
    );
    const dailyIds = new Set(daily.map(i => i.id));
    const discovery = this.rankDiscoveryFromBase(
      baseScores,
      profile,
      interactions,
      dailyIds,
      shuffleOffset,
      previouslyShownIds
    );
    return { daily, discovery };
  }

  async getItemById(id: string): Promise<FeedItem | null> {
    this.ensureIndexReady();
    const found = this.articleIndex.getItem(id) || this.items.find(item => item.id === id);
    if (!found) return null;

    // Lazily attach related cross references if missing
    if (!found.relatedCrossReferences || found.relatedCrossReferences.length === 0) {
      const lazyRefs = this.relatedService.getRelatedArticles(found);
      return {
        ...found,
        relatedCrossReferences: lazyRefs
      };
    }
    return found;
  }

  async searchItems(
    query: string,
    profile: UserProfile,
    interactions: Record<string, ReadingInteraction> = {}
  ): Promise<ScoredFeedItem[]> {
    this.ensureIndexReady();
    const q = query.toLowerCase().trim();
    if (!q) {
      return rankAndInterleaveFeed(this.items, profile, interactions);
    }
    const matched = this.items.filter(item =>
      item.title.toLowerCase().includes(q) ||
      item.subtitle.toLowerCase().includes(q) ||
      item.body.toLowerCase().includes(q) ||
      item.topics.some(t => t.toLowerCase().includes(q))
    );
    return rankAndInterleaveFeed(matched, profile, interactions);
  }

  /**
   * Fetches the latest serverless feed snapshot using SnapshotLoader
   * and safely merges validated items into IndexedDB (browser) or AtemStorage (Node/tests).
   * Checks cached snapshot quickly on warm boots unless `forceRefresh: true`.
   */
  async hydrateFromPublicSnapshot(
    remoteUrl?: string,
    options?: { forceRefresh?: boolean }
  ): Promise<{
    success: boolean;
    itemCount: number;
    insertedCount?: number;
    snapshotDate?: string;
    generatedAt?: string;
    fromCache?: boolean;
  }> {
    const forceRefresh = options?.forceRefresh === true;
    const trimmedUrl = remoteUrl?.trim() || '';
    let cachedFallback: {
      itemCount: number;
      insertedCount: number;
      snapshotDate?: string;
      generatedAt?: string;
    } | null = null;

    if (!forceRefresh) {
      try {
        const parsedObj = await this.cacheStore.getPublicSnapshot();
        if (parsedObj) {
          const cachedPayload = parseSnapshotPayload(parsedObj);
          const cachedOriginUrl =
            typeof parsedObj.remoteUrl === 'string'
              ? String(parsedObj.remoteUrl).trim()
              : '';
          const urlMatchesCache =
            !cachedOriginUrl ||
            !trimmedUrl ||
            cachedOriginUrl === trimmedUrl ||
            (cachedOriginUrl === 'default' && !trimmedUrl);

          if (cachedPayload && urlMatchesCache && cachedPayload.items.length > 0) {
            const beforeIds = new Set(this.items.map(i => i.id));
            this.addItems(cachedPayload.items, { operationType: 'background_sync', pinInserted: false });
            const cachedInsertedCount = this.items.filter(i => !beforeIds.has(i.id)).length;
            const cachedSnapshotDate = cachedPayload.generatedAt
              ? new Date(cachedPayload.generatedAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
              : undefined;

            const nowMs = Date.now();
            const cachedAtMs =
              typeof parsedObj.cachedAt === 'string'
                ? Date.parse(parsedObj.cachedAt)
                : NaN;
            const generatedAtMs = cachedPayload.generatedAt ? Date.parse(cachedPayload.generatedAt) : NaN;
            const isFreshCache = Number.isFinite(cachedAtMs)
              ? nowMs - cachedAtMs >= -60_000 && nowMs - cachedAtMs <= SNAPSHOT_CACHE_REUSE_TTL_MS
              : Number.isFinite(generatedAtMs) &&
                nowMs - generatedAtMs >= -5 * 60_000 &&
                nowMs - generatedAtMs <= 4 * 60 * 60 * 1000;

            cachedFallback = {
              itemCount: cachedPayload.items.length,
              insertedCount: cachedInsertedCount,
              snapshotDate: cachedSnapshotDate,
              generatedAt: cachedPayload.generatedAt
            };

            if (isFreshCache) {
              return {
                success: true,
                ...cachedFallback,
                fromCache: true
              };
            }
          }
        }
      } catch {
        // Ignore malformed cache and proceed to network fetch
      }
    }

    try {
      const effectiveUrl = forceRefresh
        ? trimmedUrl
          ? trimmedUrl.includes('?')
            ? `${trimmedUrl}&_t=${Date.now()}`
            : `${trimmedUrl}?_t=${Date.now()}`
          : `./feed-snapshot.json?_t=${Date.now()}`
        : trimmedUrl || undefined;

      const res = await defaultSnapshotLoader.loadSnapshot(effectiveUrl);
      if (res.success && res.items.length > 0) {
        const beforeIds = new Set(this.items.map(i => i.id));
        this.addItems(res.items, { operationType: 'background_sync', pinInserted: false });
        const insertedCount = this.items.filter(i => !beforeIds.has(i.id)).length;

        try {
          await this.cacheStore.setPublicSnapshot({
            generatedAt: res.generatedAt,
            cachedAt: new Date().toISOString(),
            remoteUrl: trimmedUrl || 'default',
            items: res.items,
            sourceHealth: res.sourceHealth,
            totalCandidateSources: res.totalCandidateSources
          });
        } catch {
          // Non-fatal if cache storage is unavailable
        }

        return {
          success: true,
          itemCount: res.itemCount,
          insertedCount,
          snapshotDate: res.snapshotDate,
          generatedAt: res.generatedAt,
          fromCache: false
        };
      }
      if (cachedFallback) {
        return {
          success: true,
          ...cachedFallback,
          fromCache: true
        };
      }
      return { success: false, itemCount: 0, insertedCount: 0, fromCache: false };
    } catch {
      if (cachedFallback) {
        return {
          success: true,
          ...cachedFallback,
          fromCache: true
        };
      }
      return { success: false, itemCount: 0, insertedCount: 0, fromCache: false };
    }
  }

  /**
   * Lazily hydrates the rolling 14-day Deep Endless Reservoir (`feed-reservoir.json`, up to ~900 items)
   * silently into the tail of the repository pool without pinning or triggering top-banner noise.
   */
  async hydrateFromReservoir(
    remoteUrl?: string
  ): Promise<{
    success: boolean;
    itemCount: number;
    insertedCount: number;
    generatedAt?: string;
  }> {
    try {
      const res = await defaultSnapshotLoader.loadReservoir(remoteUrl);
      if (!res.success || res.items.length === 0) {
        return { success: false, itemCount: 0, insertedCount: 0 };
      }

      const seenSet = await seenImpressionsService.getSeenIds().catch(() => seenImpressionsService.getSeenIdsSync());
      const normTitle = (t: string) => (t || '').trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
      const normUrl = (u?: string) => (u || '').trim().toLowerCase().replace(/\/+$/, '');

      const existingIds = new Set(this.items.map(i => i.id));
      const existingUrls = new Set(this.items.map(i => normUrl(i.canonicalUrl)).filter(Boolean));
      const existingTitles = new Set(this.items.map(i => normTitle(i.title)).filter(t => t.length >= 8));

      const appended: FeedItem[] = [];
      for (const raw of res.items) {
        if (seenSet.has(raw.id)) continue;
        if (existingIds.has(raw.id)) continue;
        if (isRejectedCachedItem(raw)) continue;
        const uKey = normUrl(raw.canonicalUrl);
        if (uKey && existingUrls.has(uKey)) continue;
        const tKey = normTitle(raw.title);
        if (tKey.length >= 8 && existingTitles.has(tKey)) continue;

        const clean = sanitizeCuratedFeedItem(enrichSocialFeedItem(raw, { lazyCrossReferences: true }));
        existingIds.add(clean.id);
        if (uKey) existingUrls.add(uKey);
        if (tKey.length >= 8) existingTitles.add(tKey);
        appended.push(clean);
      }

      if (appended.length > 0) {
        this.items = this.purgeDemoFixturesIfSufficient([...this.items, ...appended]);
        this.scheduleIndexBuild();
      }

      return {
        success: true,
        itemCount: res.itemCount,
        insertedCount: appended.length,
        generatedAt: res.generatedAt
      };
    } catch {
      return { success: false, itemCount: 0, insertedCount: 0 };
    }
  }

  /**
   * Passes candidate items through the AI Signal-vs-Noise Gatekeeper,
   * merges with atomic deduplication, and guarantees top-pinning for new additions.
   */
  async curateAndAddItems(items: FeedItem[]): Promise<FeedItem[]> {
    const curated = await defaultBatchEditionEnricher.gatekeepAndEnrichBatch(items);
    const enrichedCurated = curated.map(i => enrichSocialFeedItem(i, { lazyCrossReferences: true }));

    const mergeResult = FeedMergeService.merge(this.items, enrichedCurated, {
      operationType: 'ai_curation',
      pinInserted: true,
      telemetry: defaultBatchEditionEnricher.getLastBatchReport()
    });

    this.items = this.purgeDemoFixturesIfSufficient(mergeResult.mergedItems);
    this.rememberMergedChanges(mergeResult.operationResult);
    this.scheduleIndexBuild();
    await this.persistDynamicItems();

    return curated;
  }

  /**
   * Executes a typed content operation, reporting full telemetry.
   */
  async executeContentOperation(
    type: FeedOperationType,
    candidates: FeedItem[],
    options?: ContentOperationOptions
  ): Promise<FeedOperationResult> {
    const enrichedCandidates = candidates.map(i => enrichSocialFeedItem(i, { lazyCrossReferences: true }));
    const mergeResult = FeedMergeService.merge(this.items, enrichedCandidates, {
      operationType: type,
      operationId: options?.operationId,
      pinInserted: options?.pinInserted !== false,
      pinUpdated: options?.pinUpdated === true,
      telemetry: options?.telemetry
    });

    this.items = this.purgeDemoFixturesIfSufficient(mergeResult.mergedItems);
    this.rememberMergedChanges(mergeResult.operationResult);
    this.scheduleIndexBuild();
    await this.persistDynamicItems();

    return mergeResult.operationResult;
  }

  private rememberMergedChanges(result: FeedOperationResult): void {
    const changed = new Set([...result.insertedIds, ...result.updatedIds]);
    const dynamic = new Map(this.dynamicItems.map(item => [item.id, item]));
    for (const item of this.items) {
      if (changed.has(item.id)) dynamic.set(item.id, item);
    }
    this.dynamicItems = [...dynamic.values()];
  }
}

export const feedRepository = new LocalFeedRepository();
