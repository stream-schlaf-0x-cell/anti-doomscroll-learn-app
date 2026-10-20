import { AtemStorage, appStorage } from './storage';

export interface SeenImpressionRecord {
  itemId: string;
  seenAt: string; // ISO timestamp
  impressionCount: number;
}

/**
 * SeenImpressionsService
 * 
 * Tracks cards the user has scrolled past so that on refresh, the "🔥 Für dich"
 * feed rotates them down and surfaces fresh, unseen discoveries at the top.
 * Storage key: @atem:seen_impressions:v1
 */
export class SeenImpressionsService {
  public static readonly STORAGE_KEY = '@atem:seen_impressions:v1';
  public static readonly MAX_RECORDS = 800;

  constructor(private storage: AtemStorage = appStorage) {}

  /**
   * Idempotently records that the user has viewed / scrolled past these item IDs.
   */
  public async recordSeen(itemIds: string[]): Promise<void> {
    if (!itemIds || itemIds.length === 0) return;
    const cleanIds = Array.from(new Set(itemIds.filter(Boolean)));
    if (cleanIds.length === 0) return;

    const nowIso = new Date().toISOString();

    await this.storage.runTransaction(SeenImpressionsService.STORAGE_KEY, async (tx) => {
      const raw = await tx.get();
      let records: SeenImpressionRecord[] = [];
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            records = parsed;
          }
        } catch {
          records = [];
        }
      }

      const map = new Map<string, SeenImpressionRecord>();
      for (const rec of records) {
        map.set(rec.itemId, rec);
      }

      for (const id of cleanIds) {
        const existing = map.get(id);
        if (existing) {
          existing.seenAt = nowIso;
          existing.impressionCount = (existing.impressionCount || 1) + 1;
        } else {
          const newRec: SeenImpressionRecord = {
            itemId: id,
            seenAt: nowIso,
            impressionCount: 1
          };
          map.set(id, newRec);
          records.push(newRec);
        }
      }

      // Cap at MAX_RECORDS, pruning oldest seenAt
      if (records.length > SeenImpressionsService.MAX_RECORDS) {
        records.sort((a, b) => new Date(a.seenAt).getTime() - new Date(b.seenAt).getTime());
        records = records.slice(records.length - SeenImpressionsService.MAX_RECORDS);
      }

      await tx.set(JSON.stringify(records));
    });
  }

  /**
   * Returns a Set of all item IDs that have been seen.
   */
  public async getSeenIds(): Promise<Set<string>> {
    const raw = await this.storage.getItem(SeenImpressionsService.STORAGE_KEY);
    if (!raw) return new Set();
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return new Set(parsed.map((r: SeenImpressionRecord) => r.itemId).filter(Boolean));
      }
    } catch {
      // Fallback
    }
    return new Set();
  }

  /**
   * Clears the seen impressions cache.
   */
  public async clearSeen(): Promise<void> {
    await this.storage.removeItem(SeenImpressionsService.STORAGE_KEY);
  }
}

export const seenImpressionsService = new SeenImpressionsService();
