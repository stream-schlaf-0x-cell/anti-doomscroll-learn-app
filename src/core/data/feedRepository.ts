import { FeedItem, UserProfile, ReadingInteraction } from '../domain/types';
import { INITIAL_FIXTURES } from './fixtures';
import { rankAndInterleaveFeed, ScoredFeedItem } from '../domain/ranking';

export interface IFeedRepository {
  getDailyEdition(profile: UserProfile, interactions: Record<string, ReadingInteraction>): Promise<ScoredFeedItem[]>;
  getDiscoveryItems(profile: UserProfile, interactions: Record<string, ReadingInteraction>): Promise<ScoredFeedItem[]>;
  getItemById(id: string): Promise<FeedItem | null>;
  searchItems(query: string, profile: UserProfile, interactions: Record<string, ReadingInteraction>): Promise<ScoredFeedItem[]>;
}

export class LocalFeedRepository implements IFeedRepository {
  private items: FeedItem[] = INITIAL_FIXTURES;

  async getDailyEdition(
    profile: UserProfile,
    interactions: Record<string, ReadingInteraction> = {}
  ): Promise<ScoredFeedItem[]> {
    // Curated daily items for the finite edition
    const dailyPool = this.items.filter(item => item.isDailyEdition);
    return rankAndInterleaveFeed(dailyPool, profile, interactions);
  }

  async getDiscoveryItems(
    profile: UserProfile,
    interactions: Record<string, ReadingInteraction> = {}
  ): Promise<ScoredFeedItem[]> {
    // Extended discovery items (items not in daily edition, or all items for infinite continuation)
    const discoveryPool = this.items.filter(item => !item.isDailyEdition);
    return rankAndInterleaveFeed(discoveryPool, profile, interactions);
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
