import { FeedItem, UserProfile, ReadingInteraction, TOPIC_SPACE_MAP } from '../domain/types';
import { INITIAL_FIXTURES, getCuratedImageForTopic, getSimulatedCommentsForTopic } from './fixtures';
import { rankAndInterleaveFeed, ScoredFeedItem } from '../domain/ranking';

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

function enrichSocialFeedItem(item: FeedItem): FeedItem {
  const topic = item.primaryTopic || 'philosophy_ethics';
  const topicMeta = TOPIC_SPACE_MAP[topic];
  const space = item.space || topicMeta?.space || `c/${topic}`;
  const flair = item.flair || topicMeta?.flair || '◈ Recherche';
  const imageUrl = item.imageUrl || getCuratedImageForTopic(topic, item.id);
  const keyInsight = item.keyInsight || (item.subtitle && item.subtitle.length > 20 ? item.subtitle : undefined);
  const challengePrompt = item.challengePrompt || (
    item.isTeachingRelated
      ? 'Wie würdest du dieses Phänomen im Unterricht didaktisch aufbereiten?'
      : item.isChallengingPerspective
      ? 'Welches stärkste Argument spricht gegen diese Position?'
      : 'Welcher Gedanke oder Einwand fällt dir spontan dazu ein?'
  );
  const upvotesCount = item.upvotesCount || (40 + ((item.id.charCodeAt(item.id.length - 1) * 3) % 75));
  const comments = item.comments && item.comments.length > 0
    ? item.comments
    : getSimulatedCommentsForTopic(topic, item.title, item.id);

  return {
    ...item,
    space,
    flair,
    imageUrl,
    keyInsight,
    challengePrompt,
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
}

export class LocalFeedRepository implements IFeedRepository {
  private items: FeedItem[];

  constructor(customItems?: FeedItem[]) {
    if (customItems) {
      this.items = customItems.map(enrichSocialFeedItem);
    } else {
      const map = new Map<string, FeedItem>();
      for (const item of pipelineItems) {
        map.set(item.id, enrichSocialFeedItem(item));
      }
      for (const item of INITIAL_FIXTURES) {
        if (!map.has(item.id)) {
          map.set(item.id, enrichSocialFeedItem(item));
        }
      }
      this.items = Array.from(map.values());
    }
  }

  setItems(items: FeedItem[]): void {
    this.items = items.map(enrichSocialFeedItem);
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
