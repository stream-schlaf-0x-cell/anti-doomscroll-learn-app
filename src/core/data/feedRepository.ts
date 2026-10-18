import { FeedItem, FeedItemSchema, UserProfile, ReadingInteraction, TOPIC_SPACE_MAP, DayEditionType } from '../domain/types';
import { INITIAL_FIXTURES } from './fixtures';
import { rankAndInterleaveFeed, rankEditionFeed, ScoredFeedItem } from '../domain/ranking';
import { AtemStorage, appStorage } from './storage';
import { REAL_KNOWLEDGE_VAULT } from './realKnowledgeVault';
import { enrichItemWithInstantResearch } from '../synthesis/backgroundResearchPipeline';
import { defaultBatchEditionEnricher } from '../enrichment/batchEnricher';

// Safely load curated pipeline output if present
let pipelineItems: FeedItem[] = [];
try {
  const loaded = require('./pipeline-output.json');
  if (Array.isArray(loaded)) {
    pipelineItems = loaded as FeedItem[];
  }
} catch {
  pipelineItems = [];
}

function enrichSocialFeedItem(rawItem: FeedItem): FeedItem {
  const item = enrichItemWithInstantResearch(rawItem);

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
    upvotesCount: 0,
    awardsCount: { gold: 0, brain: 0, spark: 0 },
    comments: []
  };
}

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
}

export class LocalFeedRepository implements IFeedRepository {
  private items: FeedItem[];
  private dynamicItems: FeedItem[] = [];
  private storage: AtemStorage;

  constructor(customItems?: FeedItem[], storage: AtemStorage = appStorage) {
    this.storage = storage;
    if (customItems) {
      this.items = customItems.map(enrichSocialFeedItem);
    } else {
      const map = new Map<string, FeedItem>();

      // 1. Real Ingested Pipeline Items (50+ live verified feeds)
      for (const item of pipelineItems) {
        if (!map.has(item.id)) {
          map.set(item.id, enrichSocialFeedItem(item));
        }
      }

      // 2. Real Grounded Knowledge Vault & Timeless Classics
      for (const item of REAL_KNOWLEDGE_VAULT) {
        if (!map.has(item.id)) {
          map.set(item.id, enrichSocialFeedItem(item));
        }
      }

      // 3. Initial Curated Fixtures
      for (const item of INITIAL_FIXTURES) {
        if (!map.has(item.id)) {
          map.set(item.id, enrichSocialFeedItem(item));
        }
      }
      this.items = Array.from(map.values());
    }
    this.initDynamicItems();
  }

  private async initDynamicItems(): Promise<void> {
    try {
      const raw = await this.storage.getItem('@atem:dynamic_items:v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.dynamicItems = parsed.map(enrichSocialFeedItem);
          const map = new Map<string, FeedItem>();
          for (const item of this.items) {
            map.set(item.id, item);
          }
          for (const dyn of this.dynamicItems) {
            map.set(dyn.id, dyn);
          }
          this.items = Array.from(map.values());
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
    for (const item of items) {
      map.set(item.id, enrichSocialFeedItem(item));
    }
    for (const item of REAL_KNOWLEDGE_VAULT) {
      if (!map.has(item.id)) {
        map.set(item.id, enrichSocialFeedItem(item));
      }
    }
    for (const dyn of this.dynamicItems) {
      map.set(dyn.id, dyn);
    }
    this.items = Array.from(map.values());
  }

  addItems(newItems: FeedItem[]): void {
    const map = new Map<string, FeedItem>();
    for (const item of this.items) {
      map.set(item.id, item);
    }
    for (const item of newItems) {
      const enriched = enrichSocialFeedItem(item);
      map.set(item.id, enriched);
      if (!this.dynamicItems.some(d => d.id === item.id)) {
        this.dynamicItems.push(enriched);
      }
    }
    this.items = Array.from(map.values());
    this.persistDynamicItems();
  }

  getAllItems(): FeedItem[] {
    return [...this.items];
  }

  async getDailyEdition(
    profile: UserProfile,
    interactions: Record<string, ReadingInteraction> = {}
  ): Promise<ScoredFeedItem[]> {
    const dailyPool = this.items.filter(item => item.isDailyEdition);
    const rankedDaily = rankAndInterleaveFeed(dailyPool, profile, interactions);
    return rankedDaily.slice(0, 12);
  }

  async getEditionFeed(
    editionType: DayEditionType,
    profile: UserProfile,
    interactions: Record<string, ReadingInteraction> = {},
    dateSeed?: string,
    shuffleOffset?: number
  ): Promise<ScoredFeedItem[]> {
    return rankEditionFeed(this.items, editionType, profile, interactions, dateSeed, shuffleOffset);
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
    return rankAndInterleaveFeed(remainingItems, profile, interactions);
  }

  async getItemById(id: string): Promise<FeedItem | null> {
    const found = this.items.find(item => item.id === id);
    return found ?? null;
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
   * Fetches the latest serverless feed snapshot (from raw GitHub or local public dir)
   * with a 6-second timeout and safely merges validated items into storage.
   */
  async hydrateFromPublicSnapshot(
    remoteUrl?: string
  ): Promise<{ success: boolean; itemCount: number; snapshotDate?: string }> {
    const url = remoteUrl?.trim() || (
      typeof window !== 'undefined'
        ? './feed-snapshot.json'
        : 'https://raw.githubusercontent.com/username/anti-doomscroll-learn-app/main/public/feed-snapshot.json'
    );

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        return { success: false, itemCount: 0 };
      }

      const json = await response.json();
      const rawItems = Array.isArray(json?.items) ? json.items : (Array.isArray(json) ? json : []);
      const validated: FeedItem[] = [];

      for (const raw of rawItems) {
        const safe = FeedItemSchema.safeParse(raw);
        if (safe.success) {
          validated.push(safe.data);
        }
      }

      if (validated.length > 0) {
        // Pass candidate items through smart AI Signal-vs-Noise Gatekeeper
        // (Falls back gracefully to deterministic heuristics when offline/unconfigured)
        const curated = await defaultBatchEditionEnricher.gatekeepAndEnrichBatch(validated);
        const finalItems = curated.length > 0 ? curated : validated;

        this.addItems(finalItems);
        const snapshotDate = json?.generatedAt
          ? new Date(json.generatedAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
          : new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });

        return {
          success: true,
          itemCount: finalItems.length,
          snapshotDate
        };
      }

      return { success: false, itemCount: 0 };
    } catch {
      return { success: false, itemCount: 0 };
    }
  }

  /**
   * Passes candidate items through the AI Signal-vs-Noise Gatekeeper and adds them to storage.
   */
  async curateAndAddItems(items: FeedItem[]): Promise<FeedItem[]> {
    const curated = await defaultBatchEditionEnricher.gatekeepAndEnrichBatch(items);
    this.addItems(curated);
    return curated;
  }
}

export const feedRepository = new LocalFeedRepository();
