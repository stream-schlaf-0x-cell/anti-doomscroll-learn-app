import { FeedItem, UserProfile, ReadingInteraction, TOPIC_SPACE_MAP, DayEditionType } from '../domain/types';
import { INITIAL_FIXTURES } from './fixtures';
import { rankAndInterleaveFeed, rankEditionFeed, ScoredFeedItem, scoreFeedItem } from '../domain/ranking';
import { AtemStorage, appStorage } from './storage';
import { REAL_KNOWLEDGE_VAULT } from './realKnowledgeVault';
import { enrichItemWithInstantResearch } from '../synthesis/backgroundResearchPipeline';
import { defaultBatchEditionEnricher } from '../enrichment/batchEnricher';
import { ArticleIndex } from '../feed/articleIndex';
import { RelatedContentService } from '../feed/RelatedContentService';
import { FeedMergeService, MergeOptions } from '../feed/FeedMergeService';
import { defaultFeedOperationManager, FeedOperationResult, FeedOperationType } from '../feed/FeedOperationManager';
import { defaultSnapshotLoader } from '../feed/SnapshotLoader';

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

export type ContentOperationOptions = Pick<MergeOptions, 'pinInserted' | 'telemetry'>;

export interface IFeedRepository {
  getDailyEdition(profile: UserProfile, interactions?: Record<string, ReadingInteraction>): Promise<ScoredFeedItem[]>;
  getEditionFeed(
    editionType: DayEditionType,
    profile: UserProfile,
    interactions?: Record<string, ReadingInteraction>,
    dateSeed?: string,
    shuffleOffset?: number
  ): Promise<ScoredFeedItem[]>;
  getDiscoveryItems(profile: UserProfile, interactions?: Record<string, ReadingInteraction>, excludedIds?: Set<string>): Promise<ScoredFeedItem[]>;
  getItemById(id: string): Promise<FeedItem | null>;
  searchItems(query: string, profile: UserProfile, interactions?: Record<string, ReadingInteraction>): Promise<ScoredFeedItem[]>;
  setItems?(items: FeedItem[]): void;
  addItems?(items: FeedItem[]): void;
  getAllItems?(): FeedItem[];
  hydrateFromPublicSnapshot?(remoteUrl?: string): Promise<{ success: boolean; itemCount: number; snapshotDate?: string }>;
  curateAndAddItems?(items: FeedItem[]): Promise<FeedItem[]>;
  executeContentOperation?(type: FeedOperationType, candidates: FeedItem[], options?: ContentOperationOptions): Promise<FeedOperationResult>;
}

export class LocalFeedRepository implements IFeedRepository {
  private items: FeedItem[];
  private dynamicItems: FeedItem[] = [];
  private storage: AtemStorage;
  private articleIndex: ArticleIndex;
  private relatedService: RelatedContentService;

  constructor(customItems?: FeedItem[], storage: AtemStorage = appStorage) {
    this.storage = storage;
    this.articleIndex = new ArticleIndex();
    this.relatedService = new RelatedContentService(this.articleIndex);

    if (customItems) {
      this.items = customItems.map(i => enrichSocialFeedItem(i, { lazyCrossReferences: true }));
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

      // 3. Initial Curated Bootstrap Fixtures
      for (const item of INITIAL_FIXTURES) {
        if (!map.has(item.id)) {
          map.set(item.id, enrichSocialFeedItem(item, { lazyCrossReferences: true }));
        }
      }
      this.items = Array.from(map.values());
    }

    this.articleIndex.buildIndex(this.items);
    this.relatedService.setIndex(this.articleIndex);
    this.initDynamicItems();
  }

  private async initDynamicItems(): Promise<void> {
    try {
      const raw = await this.storage.getItem('@atem:dynamic_items:v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.dynamicItems = parsed.map(i => enrichSocialFeedItem(i, { lazyCrossReferences: true }));
          const map = new Map<string, FeedItem>();
          for (const item of this.items) {
            map.set(item.id, item);
          }
          for (const dyn of this.dynamicItems) {
            map.set(dyn.id, dyn);
          }
          this.items = Array.from(map.values());
          this.articleIndex.buildIndex(this.items);
          this.relatedService.setIndex(this.articleIndex);
        }
      }
    } catch {
      // Non-fatal fallback
    }
  }

  private async persistDynamicItems(): Promise<void> {
    try {
      await this.storage.setItem('@atem:dynamic_items:v1', JSON.stringify(this.dynamicItems));
    } catch {
      // Non-fatal fallback
    }
  }

  setItems(items: FeedItem[]): void {
    const map = new Map<string, FeedItem>();
    const canonicalMap = new Map<string, string>();

    for (const item of items) {
      const enriched = enrichSocialFeedItem(item, { lazyCrossReferences: true });
      map.set(item.id, enriched);
      if (item.canonicalUrl) {
        canonicalMap.set(item.canonicalUrl.toLowerCase(), item.id);
      }
    }
    for (const item of REAL_KNOWLEDGE_VAULT) {
      const canon = item.canonicalUrl?.toLowerCase();
      if (!map.has(item.id) && (!canon || !canonicalMap.has(canon))) {
        map.set(item.id, enrichSocialFeedItem(item, { lazyCrossReferences: true }));
        if (canon) canonicalMap.set(canon, item.id);
      }
    }
    const survivingDynamic: FeedItem[] = [];
    for (const dyn of this.dynamicItems) {
      const canon = dyn.canonicalUrl?.toLowerCase();
      const existingIdForCanon = canon ? canonicalMap.get(canon) : undefined;
      if (map.has(dyn.id)) {
        map.set(dyn.id, dyn);
        survivingDynamic.push(dyn);
      } else if (existingIdForCanon) {
        // Duplicate canonical URL under a different ID is not resurrected
      } else {
        map.set(dyn.id, dyn);
        if (canon) canonicalMap.set(canon, dyn.id);
        survivingDynamic.push(dyn);
      }
    }
    this.dynamicItems = survivingDynamic;
    this.items = Array.from(map.values());
    this.articleIndex.buildIndex(this.items);
    this.relatedService.setIndex(this.articleIndex);
  }

  addItems(newItems: FeedItem[]): void {
    const enrichedNew = newItems.map(i => enrichSocialFeedItem(i, { lazyCrossReferences: true }));
    const mergeResult = FeedMergeService.merge(this.items, enrichedNew, {
      operationType: 'manual_refresh',
      pinInserted: false
    });

    this.items = mergeResult.mergedItems;
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
    shuffleOffset?: number
  ): Promise<ScoredFeedItem[]> {
    const ranked = rankEditionFeed(this.items, editionType, profile, interactions, dateSeed, shuffleOffset);
    return this.applyPinnedItems(ranked, profile, interactions);
  }

  async getDiscoveryItems(
    profile: UserProfile,
    interactions: Record<string, ReadingInteraction> = {},
    excludedIds?: Set<string>
  ): Promise<ScoredFeedItem[]> {
    const excludeSet = excludedIds ?? (() => {
      const dailyPool = this.items.filter(item => item.isDailyEdition);
      const rankedDaily = rankAndInterleaveFeed(dailyPool, profile, interactions);
      return new Set(rankedDaily.slice(0, 12).map(i => i.id));
    })();

    const remainingItems = this.items.filter(item => !excludeSet.has(item.id));
    const ranked = rankAndInterleaveFeed(remainingItems, profile, interactions);
    return this.applyPinnedItems(ranked, profile, interactions, excludeSet);
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
  ): Promise<{ success: boolean; itemCount: number; snapshotDate?: string }> {
    try {
      const res = await defaultSnapshotLoader.loadSnapshot(remoteUrl);
      if (res.success && res.items.length > 0) {
        this.addItems(res.items);
        return {
          success: true,
          itemCount: res.itemCount,
          snapshotDate: res.snapshotDate
        };
      }
      return { success: false, itemCount: 0 };
    } catch {
      return { success: false, itemCount: 0 };
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

    this.items = mergeResult.mergedItems;
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
      pinInserted: options?.pinInserted !== false,
      telemetry: options?.telemetry
    });

    this.items = mergeResult.mergedItems;
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
