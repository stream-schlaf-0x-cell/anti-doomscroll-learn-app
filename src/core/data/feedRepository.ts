import { FeedItem, UserProfile, ReadingInteraction, TOPIC_SPACE_MAP } from '../domain/types';
import { INITIAL_FIXTURES, getCuratedImageForTopic } from './fixtures';
import { rankAndInterleaveFeed, ScoredFeedItem } from '../domain/ranking';
import { AtemStorage, appStorage } from './storage';
import { REAL_KNOWLEDGE_VAULT } from './realKnowledgeVault';
import { enrichItemWithInstantResearch } from '../synthesis/backgroundResearchPipeline';

// Safely load pipeline output if present
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
  // 1. Run automated epistemic research & didactic synthesis
  const item = enrichItemWithInstantResearch(rawItem);

  const topic = item.primaryTopic || 'philosophy_ethics';
  const topicMeta = TOPIC_SPACE_MAP[topic];
  const space = item.space || topicMeta?.space || `c/${topic}`;
  const flair = item.flair || topicMeta?.flair || '◈ Recherche';
  const imageUrl = item.imageUrl || getCuratedImageForTopic(topic, item.id);
  // Grounded: No simulated upvotes or artificial community numbers. Personal voting is tracked locally.
  const upvotesCount = item.upvotesCount ?? 0;
  // Grounded: Only retain authentic comments with origin/link, zero synthetic comments.
  const comments = item.comments ?? [];

  return {
    ...item,
    space,
    flair,
    imageUrl,
    upvotesCount,
    comments
  };
}

export interface IFeedRepository {
  getDailyEdition(profile: UserProfile, interactions: Record<string, ReadingInteraction>): Promise<ScoredFeedItem[]>;
  getDiscoveryItems(profile: UserProfile, interactions: Record<string, ReadingInteraction>): Promise<ScoredFeedItem[]>;
  getItemById(id: string): Promise<FeedItem | null>;
  searchItems(query: string, profile: UserProfile, interactions: Record<string, ReadingInteraction>): Promise<ScoredFeedItem[]>;
  setItems?(items: FeedItem[]): void;
  addItems?(items: FeedItem[]): void;
  getAllItems?(): FeedItem[];
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

      // 1. Prioritize Real Grounded Knowledge Vault & Timeless Classics
      for (const item of REAL_KNOWLEDGE_VAULT) {
        map.set(item.id, enrichSocialFeedItem(item));
      }

      // 2. Real Ingested Pipeline Items
      for (const item of pipelineItems) {
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
    // Asynchronously re-hydrate dynamic items from local storage
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
    // Always preserve dynamically generated pocket items!
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
    // Curated daily items for the finite edition (top 10-12 items)
    const dailyPool = this.items.filter(item => item.isDailyEdition);
    const rankedDaily = rankAndInterleaveFeed(dailyPool, profile, interactions);
    return rankedDaily.slice(0, 12);
  }

  async getDiscoveryItems(
    profile: UserProfile,
    interactions: Record<string, ReadingInteraction> = {}
  ): Promise<ScoredFeedItem[]> {
    // Discovery pool contains all remaining items beyond the finite daily edition
    const dailyPool = this.items.filter(item => item.isDailyEdition);
    const rankedDaily = rankAndInterleaveFeed(dailyPool, profile, interactions);
    const dailyTop12Ids = new Set(rankedDaily.slice(0, 12).map(i => i.id));

    const remainingItems = this.items.filter(item => !dailyTop12Ids.has(item.id));
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
}

export const feedRepository = new LocalFeedRepository();
