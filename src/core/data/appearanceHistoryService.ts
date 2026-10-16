import { FeedItem } from '../domain/types';
import { AtemStorage, appStorage } from './storage';

export interface AppearanceRecord {
  itemId: string;
  firstSeenAt: string; // ISO timestamp
  sequenceNumber: number;
  lastSeenAt?: string;
}

/**
 * AppearanceHistoryService
 * 
 * Tracks the exact chronological sequence in which cards appear on the user's screen.
 * Powers the "🕓 Meine Chronik" (Watch & Read History) so no discovery is ever lost
 * when switching feeds, closing the app, or reloading.
 */
export class AppearanceHistoryService {
  public static readonly STORAGE_KEY = '@atem:appearance_history:v1';
  public static readonly MAX_HISTORY_RECORDS = 500;

  constructor(private storage: AtemStorage = appStorage) {}

  /**
   * Idempotently records the appearance of items on screen.
   * Newly seen items get an incrementing sequence number and firstSeenAt.
   * Existing items update lastSeenAt while preserving their original sequenceNumber.
   * Automatically capped at 500 records to keep storage lightning-fast.
   */
  public async recordAppearances(itemIds: string[]): Promise<AppearanceRecord[]> {
    if (!itemIds || itemIds.length === 0) {
      return this.getHistoryRecords();
    }

    const uniqueIds = Array.from(new Set(itemIds.filter(Boolean)));
    const nowIso = new Date().toISOString();

    return this.storage.runTransaction(AppearanceHistoryService.STORAGE_KEY, async (tx) => {
      const raw = await tx.get();
      let records: AppearanceRecord[] = [];
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

      const map = new Map<string, AppearanceRecord>();
      let maxSeq = 0;
      for (const rec of records) {
        map.set(rec.itemId, rec);
        if (rec.sequenceNumber > maxSeq) {
          maxSeq = rec.sequenceNumber;
        }
      }

      for (const id of uniqueIds) {
        const existing = map.get(id);
        if (existing) {
          existing.lastSeenAt = nowIso;
        } else {
          maxSeq += 1;
          const newRecord: AppearanceRecord = {
            itemId: id,
            firstSeenAt: nowIso,
            sequenceNumber: maxSeq,
            lastSeenAt: nowIso
          };
          map.set(id, newRecord);
          records.push(newRecord);
        }
      }

      // Cap at MAX_HISTORY_RECORDS, pruning oldest by sequenceNumber
      if (records.length > AppearanceHistoryService.MAX_HISTORY_RECORDS) {
        records.sort((a, b) => a.sequenceNumber - b.sequenceNumber);
        records = records.slice(records.length - AppearanceHistoryService.MAX_HISTORY_RECORDS);
      }

      await tx.set(JSON.stringify(records));
      return records;
    });
  }

  /**
   * Returns all appearance records in stored sequence order.
   */
  public async getHistoryRecords(): Promise<AppearanceRecord[]> {
    const raw = await this.storage.getItem(AppearanceHistoryService.STORAGE_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      return [];
    }
    return [];
  }

  /**
   * Returns items matched against the history in reverse-chronological (most recent first)
   * or chronological order of appearance.
   */
  public async getHistoryOrderedItems(
    allItemsPool: FeedItem[],
    sortOrder: 'recent' | 'chronological' = 'recent'
  ): Promise<{ item: FeedItem; record: AppearanceRecord }[]> {
    const records = await this.getHistoryRecords();
    if (records.length === 0) return [];

    const itemMap = new Map<string, FeedItem>();
    for (const item of allItemsPool) {
      itemMap.set(item.id, item);
    }

    const sortedRecords = [...records].sort((a, b) => {
      if (sortOrder === 'recent') {
        const timeA = new Date(a.lastSeenAt || a.firstSeenAt).getTime();
        const timeB = new Date(b.lastSeenAt || b.firstSeenAt).getTime();
        if (timeA !== timeB) return timeB - timeA;
        return b.sequenceNumber - a.sequenceNumber;
      } else {
        return a.sequenceNumber - b.sequenceNumber;
      }
    });

    const results: { item: FeedItem; record: AppearanceRecord }[] = [];

    for (const record of sortedRecords) {
      const item = itemMap.get(record.itemId);
      if (item) {
        results.push({ item, record });
      }
    }

    return results;
  }

  /**
   * Resets the entire appearance history.
   */
  public async clearHistory(): Promise<void> {
    await this.storage.removeItem(AppearanceHistoryService.STORAGE_KEY);
  }
}

export const appearanceHistoryService = new AppearanceHistoryService();
