import { ReadingInteraction, ReadingInteractionSchema } from '../domain/types';
import { appStorage } from './storage';

const INTERACTIONS_STORAGE_KEY = '@atem:interactions:v1';

export interface ILibraryRepository {
  getInteractions(): Promise<Record<string, ReadingInteraction>>;
  getInteraction(itemId: string): Promise<ReadingInteraction | null>;
  saveItem(itemId: string): Promise<ReadingInteraction>;
  unsaveItem(itemId: string): Promise<ReadingInteraction>;
  updateProgress(itemId: string, progressPercent: number): Promise<ReadingInteraction>;
  setFeedback(itemId: string, feedback: 'more_like_this' | 'less_like_this' | 'neutral'): Promise<ReadingInteraction>;
  clearLibrary(): Promise<void>;
}

export class LocalLibraryRepository implements ILibraryRepository {
  async getInteractions(): Promise<Record<string, ReadingInteraction>> {
    try {
      const raw = await appStorage.getItem(INTERACTIONS_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      const validated: Record<string, ReadingInteraction> = {};
      for (const [key, value] of Object.entries(parsed)) {
        const safe = ReadingInteractionSchema.safeParse(value);
        if (safe.success) {
          validated[key] = safe.data;
        }
      }
      return validated;
    } catch {
      return {};
    }
  }

  async getInteraction(itemId: string): Promise<ReadingInteraction | null> {
    const all = await this.getInteractions();
    return all[itemId] ?? null;
  }

  private async saveAll(interactions: Record<string, ReadingInteraction>): Promise<void> {
    await appStorage.setItem(INTERACTIONS_STORAGE_KEY, JSON.stringify(interactions));
  }

  async saveItem(itemId: string): Promise<ReadingInteraction> {
    const all = await this.getInteractions();
    const existing = all[itemId] ?? {
      itemId,
      saved: false,
      progressPercent: 0
    };
    const updated: ReadingInteraction = {
      ...existing,
      saved: true,
      savedAt: new Date().toISOString()
    };
    all[itemId] = updated;
    await this.saveAll(all);
    return updated;
  }

  async unsaveItem(itemId: string): Promise<ReadingInteraction> {
    const all = await this.getInteractions();
    const existing = all[itemId] ?? {
      itemId,
      saved: false,
      progressPercent: 0
    };
    const updated: ReadingInteraction = {
      ...existing,
      saved: false,
      savedAt: undefined
    };
    all[itemId] = updated;
    await this.saveAll(all);
    return updated;
  }

  async updateProgress(itemId: string, progressPercent: number): Promise<ReadingInteraction> {
    const all = await this.getInteractions();
    const existing = all[itemId] ?? {
      itemId,
      saved: false,
      progressPercent: 0
    };
    const clamped = Math.max(0, Math.min(100, Math.round(progressPercent)));
    const updated: ReadingInteraction = {
      ...existing,
      progressPercent: Math.max(existing.progressPercent, clamped),
      completedAt: clamped >= 95 ? (existing.completedAt ?? new Date().toISOString()) : existing.completedAt
    };
    all[itemId] = updated;
    await this.saveAll(all);
    return updated;
  }

  async setFeedback(itemId: string, feedback: 'more_like_this' | 'less_like_this' | 'neutral'): Promise<ReadingInteraction> {
    const all = await this.getInteractions();
    const existing = all[itemId] ?? {
      itemId,
      saved: false,
      progressPercent: 0
    };
    const updated: ReadingInteraction = {
      ...existing,
      feedback
    };
    all[itemId] = updated;
    await this.saveAll(all);
    return updated;
  }

  async clearLibrary(): Promise<void> {
    await appStorage.removeItem(INTERACTIONS_STORAGE_KEY);
  }
}

export const libraryRepository = new LocalLibraryRepository();
