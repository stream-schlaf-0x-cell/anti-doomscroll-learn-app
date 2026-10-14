import { ReadingInteraction, ReadingInteractionSchema } from '../domain/types';
import { AtemStorage, appStorage, CorruptedDataError } from './storage';

export const INTERACTIONS_STORAGE_KEY = '@atem:interactions:v1';

export interface ILibraryRepository {
  getInteractions(): Promise<Record<string, ReadingInteraction>>;
  getInteraction(itemId: string): Promise<ReadingInteraction | null>;
  saveItem(itemId: string): Promise<ReadingInteraction>;
  unsaveItem(itemId: string): Promise<ReadingInteraction>;
  updateProgress(itemId: string, progressPercent: number): Promise<ReadingInteraction>;
  setFeedback(itemId: string, feedback: 'more_like_this' | 'less_like_this' | 'neutral'): Promise<ReadingInteraction>;
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
   */
  private async mutateInteraction(
    itemId: string,
    mutator: (current: ReadingInteraction) => ReadingInteraction
  ): Promise<ReadingInteraction> {
    return this.storage.runTransaction(INTERACTIONS_STORAGE_KEY, async (tx) => {
      const raw = await tx.get();
      const all: Record<string, ReadingInteraction> = {};

      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
              const safe = ReadingInteractionSchema.safeParse(value);
              if (safe.success) {
                all[key] = safe.data;
              }
            }
          }
        } catch {
          // If parsing fails during mutation, keep all as empty dictionary
        }
      }

      const existing: ReadingInteraction = all[itemId] ?? {
        itemId,
        saved: false,
        progressPercent: 0
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

  async unsaveItem(itemId: string): Promise<ReadingInteraction> {
    return this.mutateInteraction(itemId, current => ({
      ...current,
      saved: false,
      savedAt: undefined
    }));
  }

  async updateProgress(itemId: string, progressPercent: number): Promise<ReadingInteraction> {
    const clamped = Math.max(0, Math.min(100, Math.round(progressPercent)));
    return this.mutateInteraction(itemId, current => ({
      ...current,
      progressPercent: Math.max(current.progressPercent, clamped),
      completedAt: clamped >= 95 ? (current.completedAt ?? new Date().toISOString()) : current.completedAt
    }));
  }

  async setFeedback(
    itemId: string,
    feedback: 'more_like_this' | 'less_like_this' | 'neutral'
  ): Promise<ReadingInteraction> {
    return this.mutateInteraction(itemId, current => ({
      ...current,
      feedback
    }));
  }

  async clearLibrary(): Promise<void> {
    return this.storage.runTransaction(INTERACTIONS_STORAGE_KEY, async (tx) => {
      await tx.remove();
    });
  }

  async quarantineAndReset(): Promise<Record<string, ReadingInteraction>> {
    return this.storage.runTransaction(INTERACTIONS_STORAGE_KEY, async (tx) => {
      const raw = await tx.get();
      if (raw) {
        const quarantineKey = `@atem:quarantine:interactions:${Date.now()}`;
        await this.storage.setItem(quarantineKey, raw);
      }
      await tx.remove();
      return {};
    });
  }
}

export const libraryRepository = new LocalLibraryRepository();
