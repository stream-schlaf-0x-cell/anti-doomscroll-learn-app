import { ReadingInteraction, ReadingInteractionSchema, FeedItem, FeedItemSchema } from '../domain/types';
import { AtemStorage, appStorage, CorruptedDataError } from './storage';
import { generateSparringReply } from './fixtures';

export const INTERACTIONS_STORAGE_KEY = '@atem:interactions:v1';
export const SAVED_ARTICLES_STORAGE_KEY = '@atem:saved_articles:v1';

export interface ILibraryRepository {
  getInteractions(): Promise<Record<string, ReadingInteraction>>;
  getInteraction(itemId: string): Promise<ReadingInteraction | null>;
  saveItem(itemId: string): Promise<ReadingInteraction>;
  saveArticle(article: FeedItem): Promise<ReadingInteraction>;
  unsaveItem(itemId: string): Promise<ReadingInteraction>;
  unsaveArticle(itemId: string): Promise<ReadingInteraction>;
  getSavedArticles(): Promise<FeedItem[]>;
  getSavedArticle(itemId: string): Promise<FeedItem | null>;
  updateProgress(itemId: string, progressPercent: number): Promise<ReadingInteraction>;
  setFeedback(itemId: string, feedback: 'more_like_this' | 'less_like_this' | 'neutral'): Promise<ReadingInteraction>;
  addNote(itemId: string, text: string, tag?: 'einwand' | 'unterricht' | 'these' | 'notiz'): Promise<ReadingInteraction>;
  voteItem(itemId: string, direction: 'up' | 'down' | 'clear'): Promise<ReadingInteraction>;
  clearLibrary(): Promise<void>;
  quarantineAndReset(): Promise<Record<string, ReadingInteraction>>;
}

export class LocalLibraryRepository implements ILibraryRepository {
  constructor(private storage: AtemStorage = appStorage) {}

  /**
   * Retrieves all user interactions from storage.
   * Distinguishes missing data ({}) from corrupted data.
   */
  async getInteractions(): Promise<Record<string, ReadingInteraction>> {
    const raw = await this.storage.getItem(INTERACTIONS_STORAGE_KEY);
    if (!raw) return {};

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (parseErr) {
      throw new CorruptedDataError(
        'Die Bibliotheksdaten sind syntaktisch ungültig.',
        raw,
        parseErr
      );
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new CorruptedDataError(
        'Die Bibliotheksdaten haben ein ungültiges Format (Objekt erwartet).',
        raw
      );
    }

    const validated: Record<string, ReadingInteraction> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      const safe = ReadingInteractionSchema.safeParse(value);
      if (safe.success) {
        validated[key] = safe.data;
      }
    }
    return validated;
  }

  async getInteraction(itemId: string): Promise<ReadingInteraction | null> {
    const all = await this.getInteractions();
    return all[itemId] ?? null;
  }

  /**
   * Internal atomic mutator. Runs within a single transaction lock.
   * Reads the latest committed state directly from tx.get(), applies the mutator,
   * validates schema, and saves via tx.set().
   * Throws CorruptedDataError on invalid raw bytes to prevent destructive clobbering.
   */
  private async mutateInteraction(
    itemId: string,
    mutator: (current: ReadingInteraction) => ReadingInteraction
  ): Promise<ReadingInteraction> {
    return this.storage.runTransaction(INTERACTIONS_STORAGE_KEY, async (tx) => {
      const raw = await tx.get();
      const all: Record<string, ReadingInteraction> = {};

      if (raw) {
        let parsed: unknown;
        try {
          parsed = JSON.parse(raw);
        } catch (parseErr) {
          throw new CorruptedDataError(
            'Die Bibliotheksdaten sind syntaktisch ungültig.',
            raw,
            parseErr
          );
        }

        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          throw new CorruptedDataError(
            'Die Bibliotheksdaten haben ein ungültiges Format (Objekt erwartet).',
            raw
          );
        }

        for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
          const safe = ReadingInteractionSchema.safeParse(value);
          if (safe.success) {
            all[key] = safe.data;
          }
        }
      }

      const existing: ReadingInteraction = all[itemId] ?? {
        itemId,
        saved: false,
        progressPercent: 0,
        furthestPositionPercent: 0,
        userNotes: [],
        voteScore: 0
      };

      const updated = mutator(existing);
      const validated = ReadingInteractionSchema.parse(updated);
      all[itemId] = validated;

      await tx.set(JSON.stringify(all));
      return validated;
    });
  }

  async saveItem(itemId: string): Promise<ReadingInteraction> {
    return this.mutateInteraction(itemId, current => ({
      ...current,
      saved: true,
      savedAt: new Date().toISOString()
    }));
  }

  /**
   * Persists both the interaction bookmark and the full article offline
   * so it remains accessible permanently even when feeds rotate.
   */
  async saveArticle(article: FeedItem): Promise<ReadingInteraction> {
    const interaction = await this.saveItem(article.id);

    await this.storage.runTransaction(SAVED_ARTICLES_STORAGE_KEY, async (tx) => {
      const raw = await tx.get();
      const articles: Record<string, FeedItem> = {};

      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            for (const [key, val] of Object.entries(parsed as Record<string, unknown>)) {
              const safe = FeedItemSchema.safeParse(val);
              if (safe.success) {
                articles[key] = safe.data;
              }
            }
          }
        } catch {
          // Keep existing map clean
        }
      }

      const validatedArticle = FeedItemSchema.parse(article);
      articles[article.id] = validatedArticle;
      await tx.set(JSON.stringify(articles));
    });

    return interaction;
  }

  async unsaveItem(itemId: string): Promise<ReadingInteraction> {
    return this.mutateInteraction(itemId, current => ({
      ...current,
      saved: false,
      savedAt: undefined
    }));
  }

  /**
   * Unmarks bookmark and removes the full article from decoupled offline storage.
   */
  async unsaveArticle(itemId: string): Promise<ReadingInteraction> {
    const interaction = await this.unsaveItem(itemId);

    await this.storage.runTransaction(SAVED_ARTICLES_STORAGE_KEY, async (tx) => {
      const raw = await tx.get();
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            const articles = { ...(parsed as Record<string, FeedItem>) };
            delete articles[itemId];
            await tx.set(JSON.stringify(articles));
          }
        } catch {
          // Ignore parse errors on delete
        }
      }
    });

    return interaction;
  }

  async getSavedArticles(): Promise<FeedItem[]> {
    const raw = await this.storage.getItem(SAVED_ARTICLES_STORAGE_KEY);
    if (!raw) return [];

    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return [];

      const list: FeedItem[] = [];
      for (const val of Object.values(parsed as Record<string, unknown>)) {
        const safe = FeedItemSchema.safeParse(val);
        if (safe.success) {
          list.push(safe.data);
        }
      }
      return list;
    } catch {
      return [];
    }
  }

  async getSavedArticle(itemId: string): Promise<FeedItem | null> {
    const raw = await this.storage.getItem(SAVED_ARTICLES_STORAGE_KEY);
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
      const val = (parsed as Record<string, unknown>)[itemId];
      if (!val) return null;
      const safe = FeedItemSchema.safeParse(val);
      return safe.success ? safe.data : null;
    } catch {
      return null;
    }
  }

  async updateProgress(itemId: string, progressPercent: number): Promise<ReadingInteraction> {
    const clamped = Math.max(0, Math.min(100, Math.round(progressPercent)));
    return this.mutateInteraction(itemId, current => ({
      ...current,
      progressPercent: clamped,
      furthestPositionPercent: Math.max(current.furthestPositionPercent ?? 0, clamped),
      completedAt: clamped >= 95 ? (current.completedAt ?? new Date().toISOString()) : current.completedAt
    }));
  }

  async setFeedback(
    itemId: string,
    feedback: 'more_like_this' | 'less_like_this' | 'neutral' | 'already_known' | 'more_depth',
    timeWorthFeedback?: 'very_worthwhile' | 'worthwhile' | 'neutral' | 'not_worthwhile'
  ): Promise<ReadingInteraction> {
    return this.mutateInteraction(itemId, current => ({
      ...current,
      feedback,
      timeWorthFeedback: timeWorthFeedback ?? current.timeWorthFeedback
    }));
  }

  async addNote(
    itemId: string,
    text: string,
    tag: 'einwand' | 'unterricht' | 'these' | 'notiz' = 'notiz'
  ): Promise<ReadingInteraction> {
    const trimmed = text.trim();
    if (!trimmed) {
      const existing = await this.getInteraction(itemId);
      if (existing) return existing;
      return this.mutateInteraction(itemId, c => c);
    }
    const sparringReply = generateSparringReply(trimmed, tag);
    const note = {
      id: `note_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      text: trimmed,
      createdAt: new Date().toISOString(),
      tag,
      sparringReply
    };
    return this.mutateInteraction(itemId, current => ({
      ...current,
      userNotes: [...(current.userNotes ?? []), note]
    }));
  }

  async voteItem(itemId: string, direction: 'up' | 'down' | 'clear'): Promise<ReadingInteraction> {
    const score = direction === 'up' ? 1 : direction === 'down' ? -1 : 0;
    return this.mutateInteraction(itemId, current => ({
      ...current,
      voteScore: score,
      feedback: direction === 'up' ? 'more_like_this' : direction === 'down' ? 'less_like_this' : current.feedback
    }));
  }

  async clearLibrary(): Promise<void> {
    await Promise.all([
      this.storage.removeItem(INTERACTIONS_STORAGE_KEY),
      this.storage.removeItem(SAVED_ARTICLES_STORAGE_KEY)
    ]);
  }

  async quarantineAndReset(): Promise<Record<string, ReadingInteraction>> {
    const timestamp = Date.now();
    await this.storage.runTransaction(INTERACTIONS_STORAGE_KEY, async (tx) => {
      const raw = await tx.get();
      if (raw) {
        const quarantineKey = `@atem:quarantine:interactions:${timestamp}`;
        await this.storage.setItem(quarantineKey, raw);
      }
      await tx.remove();
      return {};
    });

    await this.storage.runTransaction(SAVED_ARTICLES_STORAGE_KEY, async (tx) => {
      const raw = await tx.get();
      if (raw) {
        const quarantineKey = `@atem:quarantine:saved_articles:${timestamp}`;
        await this.storage.setItem(quarantineKey, raw);
      }
      await tx.remove();
    });

    return {};
  }
}

export const libraryRepository = new LocalLibraryRepository();
