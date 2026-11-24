import { FeedItem, UserProfile, ReadingInteraction, TOPIC_SPACE_MAP, DayEditionType } from '../domain/types';
import { INITIAL_FIXTURES } from './fixtures';
import { rankAndInterleaveFeed, rankEditionFeed, ScoredFeedItem, scoreFeedItem } from '../domain/ranking';
import { AtemStorage, appStorage } from './storage';
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
import { isDeprecatedShowcaseStarterItem } from '../learning/hivemindLearningService';
import { seenImpressionsService } from './seenImpressionsService';

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
  getItemById(id: string): Promise<FeedItem | null>;
  searchItems(query: string, profile: UserProfile, interactions?: Record<string, ReadingInteraction>): Promise<ScoredFeedItem[]>;
  setItems?(items: FeedItem[]): void;
  addItems?(items: FeedItem[], options?: { operationType?: FeedOperationType; pinInserted?: boolean; telemetry?: import('../feed/FeedOperationManager').FeedOperationTelemetry }): void;
  getAllItems?(): FeedItem[];
  hydrateFromPublicSnapshot?(remoteUrl?: string): Promise<{
    success: boolean;
    itemCount: number;
    insertedCount?: number;
    snapshotDate?: string;
    generatedAt?: string;
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
  private articleIndex: ArticleIndex;
  private relatedService: RelatedContentService;
  private indexTimer: ReturnType<typeof setTimeout> | null = null;

  private scheduleIndexBuild(): void {
    const isBrowserRuntime = typeof window !== 'undefined' && typeof document !== 'undefined';
    if (!isBrowserRuntime) {
      this.articleIndex.buildIndex(this.items);
      this.relatedService.setIndex(this.articleIndex);
      return;
    }
    if (this.indexTimer) {
      clearTimeout(this.indexTimer);
    }
    this.indexTimer = setTimeout(() => {
      this.indexTimer = null;
      this.articleIndex.buildIndex(this.items);
      this.relatedService.setIndex(this.articleIndex);
    }, 120);
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
    this.initDynamicItems();
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
      const raw = await this.storage.getItem('@atem:dynamic_items:v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter((i: any) => !isRejectedCachedItem(i));
          this.dynamicItems = filtered.map(i =>
            sanitizeCuratedFeedItem(enrichSocialFeedItem(i, { lazyCrossReferences: true }))
          );
          if (filtered.length !== parsed.length) {
            await this.storage.setItem('@atem:dynamic_items:v1', JSON.stringify(this.dynamicItems));
          }
          const map = new Map<string, FeedItem>();
          for (const item of this.items) {
            if (!isRejectedCachedItem(item)) {
              map.set(item.id, item);
            }
          }
          for (const dyn of this.dynamicItems) {
            map.set(dyn.id, dyn);
          }
          this.items = this.purgeDemoFixturesIfSufficient(Array.from(map.values()));
          this.scheduleIndexBuild();
        }
      }
    } catch {
      // Non-fatal fallback
    }
  }

  private async persistDynamicItems(): Promise<void> {
    try {
      this.dynamicItems = this.dynamicItems.filter(i => !isRejectedCachedItem(i));
      await this.storage.setItem('@atem:dynamic_items:v1', JSON.stringify(this.dynamicItems));
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

  addItems(newItems: FeedItem[], options?: { operationType?: FeedOperationType; pinInserted?: boolean; telemetry?: import('../feed/FeedOperationManager').FeedOperationTelemetry }): void {
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
    this.articleIndex.buildIndex(this.items);
    this.relatedService.setIndex(this.articleIndex);
    this.persistDynamicItems();
  }

  getAllItems(): FeedItem[] {
    return [...this.items];
  }

  private applyPinnedItems(
    rankedItems: ScoredFeedItem[],
    profile: UserProfile,
    interactions: Record<string, ReadingInteraction> = {},
    excludedIds: Set<string> = new Set()
  ): ScoredFeedItem[] {
    const pinnedIds = defaultFeedOperationManager.getPinnedItemIds();
    if (pinnedIds.length === 0) return rankedItems;

    const pinnedSet = new Set(pinnedIds);
    const topPinned: ScoredFeedItem[] = [];

    // Find pinned items in this.items
    for (const id of pinnedIds) {
      if (excludedIds.has(id)) continue;
      const match = this.items.find(i => i.id === id);
      if (match) {
        const scored = scoreFeedItem(match, profile, interactions);
        topPinned.push(scored);
      }
    }

    const unpinnedRanked = rankedItems.filter(i => !pinnedSet.has(i.id));
    return [...topPinned, ...unpinnedRanked];
  }

  async getDailyEdition(
    profile: UserProfile,
    interactions: Record<string, ReadingInteraction> = {}
  ): Promise<ScoredFeedItem[]> {
    const dailyPool = this.items.filter(item => item.isDailyEdition);
    const rankedDaily = rankAndInterleaveFeed(dailyPool, profile, interactions);
    const withPinned = this.applyPinnedItems(rankedDaily, profile, interactions);
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
    const ranked = rankEditionFeed(this.items, editionType, profile, interactions, dateSeed, shuffleOffset, previouslyShownIds);
    return this.applyPinnedItems(ranked, profile, interactions);
  }

  async getDiscoveryItems(
    profile: UserProfile,
    interactions: Record<string, ReadingInteraction> = {},
    excludedIds?: Set<string>,
    shuffleOffset: number = 0,
    previouslyShownIds?: Set<string>
  ): Promise<ScoredFeedItem[]> {
    const excludeSet = new Set<string>(excludedIds ?? []);
    if (!excludedIds) {
      const dailyPool = this.items.filter(item => item.isDailyEdition);
      const rankedDaily = rankAndInterleaveFeed(dailyPool, profile, interactions);
      for (const i of rankedDaily.slice(0, 12)) excludeSet.add(i.id);
    }
    if (previouslyShownIds && previouslyShownIds.size > 0 && shuffleOffset > 0) {
      for (const id of previouslyShownIds) excludeSet.add(id);
    }

    let remainingItems = this.items.filter(item => !excludeSet.has(item.id));
    // If excluding previously shown left fewer than 12 items, keep unshown items first and backfill
    if (remainingItems.length < 12) {
      const baseDailyExclude = new Set(this.items.filter(i => i.isDailyEdition).slice(0, 8).map(i => i.id));
      const unshownIds = new Set(remainingItems.map(i => i.id));
      const backfill = this.items.filter(item => !baseDailyExclude.has(item.id) && !unshownIds.has(item.id));
      remainingItems = [...remainingItems, ...backfill];
    }
    const ranked = rankAndInterleaveFeed(remainingItems, profile, interactions);
    const rankedIds = new Set(ranked.map(r => r.id));
    const missingNonArdTail = remainingItems
      .filter(item => !rankedIds.has(item.id))
      .map(item => scoreFeedItem(item, profile, interactions));
    const completeRanked = missingNonArdTail.length > 0 ? [...ranked, ...missingNonArdTail] : ranked;
    return this.applyPinnedItems(completeRanked, profile, interactions, excludeSet);
  }

  async getItemById(id: string): Promise<FeedItem | null> {
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
   * and safely merges validated items into storage.
   */
  async hydrateFromPublicSnapshot(
    remoteUrl?: string
  ): Promise<{
    success: boolean;
    itemCount: number;
    insertedCount?: number;
    snapshotDate?: string;
    generatedAt?: string;
  }> {
    try {
      const res = await defaultSnapshotLoader.loadSnapshot(remoteUrl);
      if (res.success && res.items.length > 0) {
        const beforeIds = new Set(this.items.map(i => i.id));
        this.addItems(res.items, { operationType: 'background_sync', pinInserted: false });
        const insertedCount = this.items.filter(i => !beforeIds.has(i.id)).length;
        return {
          success: true,
          itemCount: res.itemCount,
          insertedCount,
          snapshotDate: res.snapshotDate,
          generatedAt: res.generatedAt
        };
      }
      return { success: false, itemCount: 0, insertedCount: 0 };
    } catch {
      return { success: false, itemCount: 0, insertedCount: 0 };
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
    this.articleIndex.buildIndex(this.items);
    this.relatedService.setIndex(this.articleIndex);
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
    this.articleIndex.buildIndex(this.items);
    this.relatedService.setIndex(this.articleIndex);
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
