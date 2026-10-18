import { FeedItem, FeedItemSchema } from '../domain/types';
import { AtemStorage, appStorage } from '../data/storage';

const STORAGE_KEY_ARTICLES = '@atem:persisted_articles:v2';
const STORAGE_KEY_META = '@atem:persisted_articles_meta:v2';

export interface PersistentStoreMeta {
  version: number;
  lastSavedAt: string;
  itemCount: number;
}

/**
 * PersistentArticleStore: Handles non-blocking persistent caching of ingested and curated articles.
 * Isolates storage failures so app startup remains robust and instant.
 */
export class PersistentArticleStore {
  private storage: AtemStorage;

  constructor(storage: AtemStorage = appStorage) {
    this.storage = storage;
  }

  /**
   * Loads all cached articles from persistent storage.
   * Silently recovers from malformed or corrupted cache entries without throwing.
   */
  public async loadArticles(): Promise<FeedItem[]> {
    try {
      const raw = await this.storage.getItem(STORAGE_KEY_ARTICLES);
      if (!raw) return [];

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];

      const validItems: FeedItem[] = [];
      for (const entry of parsed) {
        const validated = FeedItemSchema.safeParse(entry);
        if (validated.success) {
          validItems.push(validated.data);
        }
      }
      return validItems;
    } catch {
      // Safe fallback on corrupted storage
      return [];
    }
  }

  /**
   * Atomically saves articles to persistent storage.
   */
  public async saveArticles(items: FeedItem[]): Promise<boolean> {
    try {
      const serialized = JSON.stringify(items);
      await this.storage.setItem(STORAGE_KEY_ARTICLES, serialized);

      const meta: PersistentStoreMeta = {
        version: 2,
        lastSavedAt: new Date().toISOString(),
        itemCount: items.length
      };
      await this.storage.setItem(STORAGE_KEY_META, JSON.stringify(meta));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clears the persistent store.
   */
  public async clear(): Promise<void> {
    try {
      await this.storage.removeItem(STORAGE_KEY_ARTICLES);
      await this.storage.removeItem(STORAGE_KEY_META);
    } catch {
      // Non-fatal
    }
  }
}

export const defaultPersistentArticleStore = new PersistentArticleStore();
