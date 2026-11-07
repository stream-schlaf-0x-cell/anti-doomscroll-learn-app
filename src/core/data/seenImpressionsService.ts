import { AtemStorage, appStorage } from './storage';

export interface SeenImpressionRecord {
  itemId: string;
  firstSeenAt: string; // ISO timestamp
  lastSeenAt: string;  // ISO timestamp
  count: number;
}

/**
 * SeenImpressionsService (Upgraded to v2 with 72h Cooldown, Session Memory & Debounced Storage Persistence)
 *
 * Tracks cards the user has viewed or scrolled past so that:
 * 1. Fresh discoveries surface at the top of "🔥 Für dich".
 * 2. Seen cards receive a hard -3.0 score penalty for 72 hours, preventing 3-day repetition.
 * 3. In-memory state updates in 0ms while JSON serialization to localStorage/AsyncStorage is debounced (1200ms)
 *    so scrolling never blocks the main UI thread on iOS Safari.
 * Storage key: @atem:seen_impressions:v2
 */
export class SeenImpressionsService {
  public static readonly STORAGE_KEY = '@atem:seen_impressions:v2';
  public static readonly LEGACY_STORAGE_KEY = '@atem:seen_impressions:v1';
  public static readonly MAX_RECORDS = 1000;
  public static readonly DEBOUNCE_MS = 1200;

  private seenMap: Map<string, SeenImpressionRecord> = new Map();
  private hydrated = false;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private persistCount = 0;

  constructor(private storage: AtemStorage = appStorage) {
    this.registerLifecycleFlushListeners();
  }

  private registerLifecycleFlushListeners(): void {
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('pagehide', () => {
        void this.flush();
      });
    }
    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          void this.flush();
        }
      });
    }
  }

  /**
   * Synchronously updates the in-memory Map in 0ms and schedules a debounced (1200ms) storage write.
   */
  public async recordSeen(itemIds: string[]): Promise<void> {
    if (!itemIds || itemIds.length === 0) return;
    const cleanIds = Array.from(new Set(itemIds.filter(Boolean)));
    if (cleanIds.length === 0) return;

    const nowIso = new Date().toISOString();

    // 1. Synchronous 0ms in-memory update
    for (const id of cleanIds) {
      const existing = this.seenMap.get(id);
      if (existing) {
        existing.lastSeenAt = nowIso;
        existing.count = (existing.count || 1) + 1;
      } else {
        this.seenMap.set(id, {
          itemId: id,
          firstSeenAt: nowIso,
          lastSeenAt: nowIso,
          count: 1
        });
      }
    }

    this.pruneInMemoryIfNeeded();

    // 2. Schedule debounced background persistence (1200ms)
    this.scheduleDebouncedPersist();
  }

  /**
   * Alias for recordSeen to support callers using recordSeenImpressions.
   */
  public async recordSeenImpressions(itemIds: string[]): Promise<void> {
    return this.recordSeen(itemIds);
  }

  /**
   * Synchronous 0ms getter for in-memory seen IDs.
   */
  public getSeenIdsSync(): Set<string> {
    return new Set(this.seenMap.keys());
  }

  /**
   * Synchronous 0ms getter for in-memory seen records.
   */
  public getSeenRecordMapSync(): Map<string, SeenImpressionRecord> {
    return new Map(this.seenMap);
  }

  /**
   * Returns how many times storage persistence has been executed (useful for testing debounce invariants).
   */
  public getPersistCount(): number {
    return this.persistCount;
  }

  private pruneInMemoryIfNeeded(): void {
    if (this.seenMap.size <= SeenImpressionsService.MAX_RECORDS) return;
    const sorted = Array.from(this.seenMap.values()).sort(
      (a, b) => new Date(a.lastSeenAt).getTime() - new Date(b.lastSeenAt).getTime()
    );
    const keep = sorted.slice(sorted.length - SeenImpressionsService.MAX_RECORDS);
    this.seenMap.clear();
    for (const rec of keep) {
      this.seenMap.set(rec.itemId, rec);
    }
  }

  private scheduleDebouncedPersist(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      void this.flush();
    }, SeenImpressionsService.DEBOUNCE_MS);

    if (this.debounceTimer && typeof (this.debounceTimer as any).unref === 'function') {
      (this.debounceTimer as any).unref();
    }
  }

  /**
   * Immediately flushes the in-memory seen records to persistent storage.
   */
  public async flush(): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    await this.ensureHydrated();
    this.pruneInMemoryIfNeeded();
    const records = Array.from(this.seenMap.values());
    this.persistCount += 1;
    await this.storage.setItem(SeenImpressionsService.STORAGE_KEY, JSON.stringify(records));
  }

  private async ensureHydrated(): Promise<void> {
    if (this.hydrated) return;
    this.hydrated = true;
    const storedRecords = await this.readInternalRecords();
    for (const stored of storedRecords) {
      const mem = this.seenMap.get(stored.itemId);
      if (!mem) {
        this.seenMap.set(stored.itemId, stored);
      } else {
        // Merge stored + in-memory
        const earliest =
          new Date(stored.firstSeenAt).getTime() < new Date(mem.firstSeenAt).getTime()
            ? stored.firstSeenAt
            : mem.firstSeenAt;
        const latest =
          new Date(stored.lastSeenAt).getTime() > new Date(mem.lastSeenAt).getTime()
            ? stored.lastSeenAt
            : mem.lastSeenAt;
        this.seenMap.set(stored.itemId, {
          itemId: stored.itemId,
          firstSeenAt: earliest,
          lastSeenAt: latest,
          count: Math.max(stored.count, mem.count)
        });
      }
    }
  }

  private async readInternalRecords(tx?: { get: () => Promise<string | null> }): Promise<SeenImpressionRecord[]> {
    const raw = tx ? await tx.get() : await this.storage.getItem(SeenImpressionsService.STORAGE_KEY);
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
    await this.ensureHydrated();
    return new Map(this.seenMap);
  }

  /**
   * Returns a Set of all item IDs that have been seen.
   */
  public async getSeenIds(): Promise<Set<string>> {
    await this.ensureHydrated();
    return new Set(this.seenMap.keys());
  }

  /**
   * Clears the seen impressions cache.
   */
  public async clearSeen(): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.seenMap.clear();
    this.hydrated = true;
    await this.storage.removeItem(SeenImpressionsService.STORAGE_KEY);
    await this.storage.removeItem(SeenImpressionsService.LEGACY_STORAGE_KEY).catch(() => {});
  }
}

export const seenImpressionsService = new SeenImpressionsService();
