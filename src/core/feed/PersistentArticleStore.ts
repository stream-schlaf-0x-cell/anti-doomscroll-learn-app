import { FeedItem, FeedItemSchema } from '../domain/types';
import { AtemStorage, appStorage } from '../data/storage';
import { stripSyntheticFillerSentences } from '../enrichment/batchEnricher';

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
   * Strips any legacy synthetic filler sentences and filters out un-enriched stubs (< 80 chars).
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
          const item = validated.data;
          const cleanedFeedText = stripSyntheticFillerSentences(item.feedText || '').trim();
          const cleanedBody = stripSyntheticFillerSentences(item.body || item.articleBody || '').trim();
          const cleanedArticleBody = item.articleBody
            ? stripSyntheticFillerSentences(item.articleBody).trim()
            : cleanedBody;

          const isVisualOrTrackCard =
            item.format === 'meme' ||
            item.format === 'art_showcase' ||
            Boolean(item.hivemindMeta) ||
            Boolean(item.aiAssisted);

          // Substance gate: drop un-enriched scraped stubs whose cleaned feedText is < 80 chars
          if (!isVisualOrTrackCard && cleanedFeedText.length < 80 && cleanedBody.length < 80) {
            continue;
          }

          validItems.push({
            ...item,
            feedText: cleanedFeedText || item.feedText,
            body: cleanedBody || item.body,
            articleBody: cleanedArticleBody || item.articleBody
          });
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
