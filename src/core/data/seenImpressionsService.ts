import { AtemStorage, appStorage } from './storage';

export interface SeenImpressionRecord {
  itemId: string;
  firstSeenAt: string; // ISO timestamp
  lastSeenAt: string;  // ISO timestamp
  count: number;
}

/**
 * SeenImpressionsService (Upgraded to v2 with 72h Cooldown & Session Memory)
 * 
 * Tracks cards the user has viewed or scrolled past so that:
 * 1. Fresh discoveries surface at the top of "🔥 Für dich".
 * 2. Seen cards receive a hard -3.0 score penalty for 72 hours, preventing 3-day repetition.
 * Storage key: @atem:seen_impressions:v2
 */
export class SeenImpressionsService {
  public static readonly STORAGE_KEY = '@atem:seen_impressions:v2';
  public static readonly LEGACY_STORAGE_KEY = '@atem:seen_impressions:v1';
  public static readonly MAX_RECORDS = 1000;

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
      let records = await this.readInternalRecords(tx);
      const map = new Map<string, SeenImpressionRecord>();
      for (const rec of records) {
        map.set(rec.itemId, rec);
      }

      for (const id of cleanIds) {
        const existing = map.get(id);
        if (existing) {
          existing.lastSeenAt = nowIso;
          existing.count = (existing.count || 1) + 1;
        } else {
          const newRec: SeenImpressionRecord = {
            itemId: id,
            firstSeenAt: nowIso,
            lastSeenAt: nowIso,
            count: 1
          };
          map.set(id, newRec);
          records.push(newRec);
        }
      }

      // Cap at MAX_RECORDS, pruning oldest lastSeenAt
      if (records.length > SeenImpressionsService.MAX_RECORDS) {
        records.sort((a, b) => new Date(a.lastSeenAt).getTime() - new Date(b.lastSeenAt).getTime());
        records = records.slice(records.length - SeenImpressionsService.MAX_RECORDS);
      }

      await tx.set(JSON.stringify(records));
    });
  }

  private async readInternalRecords(tx?: { get: () => Promise<string | null> }): Promise<SeenImpressionRecord[]> {
    let raw = tx ? await tx.get() : await this.storage.getItem(SeenImpressionsService.STORAGE_KEY);
    if (!raw) {
      // Check legacy v1 key and migrate
      try {
        const legacyRaw = await this.storage.getItem(SeenImpressionsService.LEGACY_STORAGE_KEY);
        if (legacyRaw) {
          const parsed = JSON.parse(legacyRaw);
          if (Array.isArray(parsed)) {
            return parsed.map((item: any) => ({
              itemId: String(item.itemId || item.id || ''),
              firstSeenAt: String(item.firstSeenAt || item.seenAt || new Date().toISOString()),
              lastSeenAt: String(item.lastSeenAt || item.seenAt || new Date().toISOString()),
              count: Number(item.count || item.impressionCount || 1)
            })).filter(r => Boolean(r.itemId));
          }
        }
      } catch {
        // Fallback
      }
      return [];
    }

    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((item: any) => ({
          itemId: String(item.itemId || item.id || ''),
          firstSeenAt: String(item.firstSeenAt || item.seenAt || new Date().toISOString()),
          lastSeenAt: String(item.lastSeenAt || item.seenAt || new Date().toISOString()),
          count: Number(item.count || item.impressionCount || 1)
        })).filter(r => Boolean(r.itemId));
      }
    } catch {
      return [];
    }
    return [];
  }

  /**
   * Returns a Map of item IDs to their SeenImpressionRecord.
   */
  public async getSeenRecordMap(): Promise<Map<string, SeenImpressionRecord>> {
    const records = await this.readInternalRecords();
    const map = new Map<string, SeenImpressionRecord>();
    for (const r of records) {
      map.set(r.itemId, r);
    }
    return map;
  }

  /**
   * Returns a Set of all item IDs that have been seen.
   */
  public async getSeenIds(): Promise<Set<string>> {
    const records = await this.readInternalRecords();
    return new Set(records.map(r => r.itemId).filter(Boolean));
  }

  /**
   * Clears the seen impressions cache.
   */
  public async clearSeen(): Promise<void> {
    await this.storage.removeItem(SeenImpressionsService.STORAGE_KEY);
    await this.storage.removeItem(SeenImpressionsService.LEGACY_STORAGE_KEY).catch(() => {});
  }
}

export const seenImpressionsService = new SeenImpressionsService();
