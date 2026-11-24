import { FeedItem } from '../domain/types';
import { AtemStorage, appStorage } from './storage';

export const IDB_DB_NAME = 'atmen_cache_v1';
export const IDB_STORE_NAME = 'kv';
export const IDB_KEY_PUBLIC_SNAPSHOT = 'public_snapshot';
export const IDB_KEY_DYNAMIC_ITEMS = 'dynamic_items';

export const LEGACY_PUBLIC_SNAPSHOT_STORAGE_KEY = '@atem:public_feed_snapshot:v1';
export const DYNAMIC_ITEMS_STORAGE_KEY = '@atem:dynamic_items:v1';
export const BOOT_DECK_STORAGE_KEY = '@atem:boot_deck:v1';

export const BOOT_DECK_MAX_ITEMS = 24;
export const BOOT_DECK_MAX_BYTES = 96 * 1024; // Strictly < 100 KB
export const LEGACY_SNAPSHOT_CLEANUP_THRESHOLD_BYTES = 200 * 1024;

export interface CachedPublicSnapshotRecord {
  generatedAt?: string;
  cachedAt?: string;
  remoteUrl?: string;
  items: FeedItem[];
  sourceHealth?: Record<string, unknown>;
  totalCandidateSources?: number;
}

export interface BootDeckPayload {
  version: 1;
  savedAt: string;
  generatedAt?: string;
  items: FeedItem[];
}

export interface FeedCacheStoreOptions {
  /** Override whether IndexedDB is used for large blobs (defaults to true in browser with default appStorage). */
  useIndexedDb?: boolean;
  dbName?: string;
  storeName?: string;
  idbFactory?: IDBFactory | null;
}

const textEncoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;

export function measureUtf8Bytes(value: string): number {
  if (!value) return 0;
  if (textEncoder) {
    return textEncoder.encode(value).byteLength;
  }
  if (typeof Buffer !== 'undefined' && typeof Buffer.byteLength === 'function') {
    return Buffer.byteLength(value, 'utf8');
  }
  return value.length * 2;
}

function isFallbackBootItem(item: Pick<FeedItem, 'id' | 'isStaticFallback'>): boolean {
  if (!item) return true;
  if (item.isStaticFallback === true) return true;
  const id = String(item.id || '');
  return id.startsWith('vault-') || id.startsWith('init-');
}

function truncateCleanly(text: string, maxChars: number): string {
  const trimmed = (text || '').trim();
  if (trimmed.length <= maxChars) return trimmed;
  const slice = trimmed.slice(0, maxChars);
  const lastSpace = slice.lastIndexOf(' ');
  const cut = lastSpace > maxChars * 0.65 ? slice.slice(0, lastSpace) : slice;
  return `${cut.replace(/[.,;:\s]+$/, '')}…`;
}

/**
 * Produces a lightweight card-ready preview item for the `< 100 KB` warm-boot deck.
 * Full bodies (`articleBody`, `body`, cross-references) hydrate seamlessly from IndexedDB / snapshot.
 */
export function compactBootDeckItem(item: FeedItem): FeedItem {
  const previewFeedText = truncateCleanly(item.feedText || item.body || '', 420);
  const previewBody = truncateCleanly(item.body || previewFeedText || item.subtitle || item.title, 700);
  const {
    articleBody: _omitArticleBody,
    relatedCrossReferences: _omitCrossRefs,
    socraticSalon: _omitSalon,
    editorialAbstract: _omitAbstract,
    corroboratingSources: _omitCorroborating,
    deepeningOptions: _omitDeepening,
    perspectiveDetails: _omitPerspective,
    ...rest
  } = item;

  return {
    ...rest,
    subtitle: truncateCleanly(item.subtitle || '', 220),
    feedText: previewFeedText,
    body: previewBody,
    keyInsight: item.keyInsight ? truncateCleanly(item.keyInsight, 220) : undefined,
    relevanceExplanation: truncateCleanly(item.relevanceExplanation || '', 180),
    sourceReferences: Array.isArray(item.sourceReferences) ? item.sourceReferences.slice(0, 2) : [],
    comments: []
  };
}

/**
 * Selects up to `maxItems` (default 24) fresh, diverse real items and compacts them
 * under a hard UTF-8 byte budget (`< 100 KB`) for `< 20ms` warm-boot hydration.
 */
export function buildBootDeckPayload(
  items: FeedItem[],
  options?: { maxItems?: number; maxBytes?: number; generatedAt?: string }
): BootDeckPayload {
  const maxItems = options?.maxItems ?? BOOT_DECK_MAX_ITEMS;
  const maxBytes = options?.maxBytes ?? BOOT_DECK_MAX_BYTES;

  const freshReal = items.filter(item => item && !isFallbackBootItem(item));

  // Group by primaryTopic (sorted newest + highest curationScore first inside each topic)
  // and round-robin pick so Frame 1 on warm boot has immediate topic/space diversity.
  const sorted = [...freshReal].sort((a, b) => {
    const timeA = a.publishedAt ? Date.parse(a.publishedAt) : 0;
    const timeB = b.publishedAt ? Date.parse(b.publishedAt) : 0;
    const validA = Number.isFinite(timeA) ? timeA : 0;
    const validB = Number.isFinite(timeB) ? timeB : 0;
    if (validB !== validA) return validB - validA;
    return (b.curationScore ?? 7) - (a.curationScore ?? 7);
  });

  const byTopic = new Map<string, FeedItem[]>();
  for (const item of sorted) {
    const key = item.primaryTopic || 'science_society';
    const list = byTopic.get(key) || [];
    list.push(item);
    byTopic.set(key, list);
  }

  const orderedCandidates: FeedItem[] = [];
  const topicLists = Array.from(byTopic.values());
  let round = 0;
  while (orderedCandidates.length < maxItems * 2) {
    let addedInRound = false;
    for (const list of topicLists) {
      if (round < list.length) {
        orderedCandidates.push(list[round]);
        addedInRound = true;
        if (orderedCandidates.length >= maxItems * 2) break;
      }
    }
    if (!addedInRound) break;
    round++;
  }

  const payload: BootDeckPayload = {
    version: 1,
    savedAt: new Date().toISOString(),
    ...(options?.generatedAt ? { generatedAt: options.generatedAt } : {}),
    items: []
  };

  let currentBytes = measureUtf8Bytes(JSON.stringify(payload));
  const seenIds = new Set<string>();

  for (const raw of orderedCandidates) {
    if (payload.items.length >= maxItems) break;
    if (seenIds.has(raw.id)) continue;
    seenIds.add(raw.id);

    const compact = compactBootDeckItem(raw);
    const entryBytes = measureUtf8Bytes(JSON.stringify(compact)) + (payload.items.length > 0 ? 1 : 0);
    if (currentBytes + entryBytes > maxBytes) {
      continue;
    }
    payload.items.push(compact);
    currentBytes += entryBytes;
  }

  return payload;
}

function getBrowserLocalStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
      return window.localStorage;
    }
  } catch {
    // Restricted iframe / private mode
  }
  return null;
}

/**
 * Async IndexedDB cache for large feed blobs (`public_snapshot`, `dynamic_items`)
 * paired with a tiny `< 100 KB` Boot-Deck (`@atem:boot_deck:v1`) in `AtemStorage`.
 *
 * Automatically falls back to the injected `AtemStorage` in Node.js / unit tests
 * or when a custom `AtemStorage` instance is supplied.
 */
export class FeedCacheStore {
  private readonly storage: AtemStorage;
  private readonly dbName: string;
  private readonly storeName: string;
  private readonly idbFactory: IDBFactory | null;
  private readonly shouldUseIndexedDb: boolean;
  private dbPromise: Promise<IDBDatabase | null> | null = null;
  private legacyCleanupDone = false;

  constructor(storage: AtemStorage = appStorage, options?: FeedCacheStoreOptions) {
    this.storage = storage;
    this.dbName = options?.dbName ?? IDB_DB_NAME;
    this.storeName = options?.storeName ?? IDB_STORE_NAME;
    const resolvedFactory =
      options?.idbFactory !== undefined
        ? options.idbFactory
        : typeof indexedDB !== 'undefined'
        ? indexedDB
        : null;
    this.idbFactory = resolvedFactory;

    if (options?.useIndexedDb !== undefined) {
      this.shouldUseIndexedDb = Boolean(options.useIndexedDb && resolvedFactory);
    } else {
      // Only activate browser IndexedDB for the default appStorage singleton;
      // unit tests passing a custom MemoryStorageDriver stay 100% isolated.
      this.shouldUseIndexedDb = storage === appStorage && Boolean(resolvedFactory);
    }
  }

  public isUsingIndexedDb(): boolean {
    return this.shouldUseIndexedDb;
  }

  private openDb(): Promise<IDBDatabase | null> {
    if (!this.shouldUseIndexedDb || !this.idbFactory) {
      return Promise.resolve(null);
    }
    if (this.dbPromise) {
      return this.dbPromise;
    }
    this.dbPromise = new Promise<IDBDatabase | null>(resolve => {
      try {
        const request = this.idbFactory!.open(this.dbName, 1);
        request.onupgradeneeded = () => {
          try {
            const db = request.result;
            if (!db.objectStoreNames.contains(this.storeName)) {
              db.createObjectStore(this.storeName);
            }
          } catch {
            // Non-fatal upgrade guard
          }
        };
        request.onsuccess = () => {
          const db = request.result;
          db.onversionchange = () => {
            try {
              db.close();
            } catch {
              // Ignore close error
            }
            this.dbPromise = null;
          };
          resolve(db);
        };
        request.onerror = () => {
          this.dbPromise = null;
          resolve(null);
        };
        request.onblocked = () => {
          this.dbPromise = null;
          resolve(null);
        };
      } catch {
        this.dbPromise = null;
        resolve(null);
      }
    });
    return this.dbPromise;
  }

  private async idbGet<T>(key: string): Promise<T | null> {
    const db = await this.openDb();
    if (!db) return null;
    return new Promise<T | null>(resolve => {
      try {
        const tx = db.transaction(this.storeName, 'readonly');
        const store = tx.objectStore(this.storeName);
        const req = store.get(key);
        req.onsuccess = () => {
          resolve(req.result === undefined ? null : (req.result as T));
        };
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  private async idbSet<T>(key: string, value: T): Promise<boolean> {
    const db = await this.openDb();
    if (!db) return false;
    return new Promise<boolean>(resolve => {
      try {
        const tx = db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        store.put(value, key);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
        tx.onabort = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  }

  private async idbDelete(key: string): Promise<void> {
    const db = await this.openDb();
    if (!db) return;
    await new Promise<void>(resolve => {
      try {
        const tx = db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        store.delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
        tx.onabort = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  /**
   * On first browser run, migrates (if needed) and purges oversized legacy
   * `@atem:public_feed_snapshot:v1` (> 200 KB) and oversized `@atem:dynamic_items:v1` (> 200 KB)
   * from `localStorage` so the 5 MB browser quota is freed immediately.
   */
  async cleanupLegacyLocalStorageSnapshot(): Promise<{ cleanedSnapshot: boolean; cleanedDynamic: boolean }> {
    if (this.legacyCleanupDone) {
      return { cleanedSnapshot: false, cleanedDynamic: false };
    }
    this.legacyCleanupDone = true;

    let cleanedSnapshot = false;
    let cleanedDynamic = false;

    const ls = getBrowserLocalStorage();
    if (!ls && !this.shouldUseIndexedDb) {
      return { cleanedSnapshot, cleanedDynamic };
    }

    const readLegacyRaw = async (key: string): Promise<string | null> => {
      if (ls) {
        try {
          const direct = ls.getItem(key);
          if (direct !== null) return direct;
        } catch {
          // Fallback to storage driver
        }
      }
      if (this.shouldUseIndexedDb) {
        try {
          return await this.storage.getItem(key);
        } catch {
          return null;
        }
      }
      return null;
    };

    const removeLegacyRaw = async (key: string): Promise<void> => {
      if (ls) {
        try {
          ls.removeItem(key);
        } catch {
          // Ignore
        }
      }
      try {
        await this.storage.removeItem(key);
      } catch {
        // Ignore
      }
    };

    try {
      const legacySnapRaw = await readLegacyRaw(LEGACY_PUBLIC_SNAPSHOT_STORAGE_KEY);
      if (legacySnapRaw && measureUtf8Bytes(legacySnapRaw) > LEGACY_SNAPSHOT_CLEANUP_THRESHOLD_BYTES) {
        if (this.shouldUseIndexedDb) {
          try {
            const existingIdb = await this.idbGet<CachedPublicSnapshotRecord>(IDB_KEY_PUBLIC_SNAPSHOT);
            if (!existingIdb) {
              const parsed = JSON.parse(legacySnapRaw);
              if (parsed && typeof parsed === 'object') {
                await this.idbSet(IDB_KEY_PUBLIC_SNAPSHOT, parsed);
              }
            }
          } catch {
            // Malformed legacy blob; safe to delete
          }
        }
        await removeLegacyRaw(LEGACY_PUBLIC_SNAPSHOT_STORAGE_KEY);
        cleanedSnapshot = true;
      }
    } catch {
      // Non-fatal cleanup
    }

    try {
      if (this.shouldUseIndexedDb) {
        const legacyDynRaw = await readLegacyRaw(DYNAMIC_ITEMS_STORAGE_KEY);
        if (legacyDynRaw && measureUtf8Bytes(legacyDynRaw) > LEGACY_SNAPSHOT_CLEANUP_THRESHOLD_BYTES) {
          try {
            const existingIdbDyn = await this.idbGet<FeedItem[]>(IDB_KEY_DYNAMIC_ITEMS);
            if (!existingIdbDyn) {
              const parsed = JSON.parse(legacyDynRaw);
              if (Array.isArray(parsed)) {
                await this.idbSet(IDB_KEY_DYNAMIC_ITEMS, parsed);
              }
            }
          } catch {
            // Malformed legacy blob; safe to delete
          }
          await removeLegacyRaw(DYNAMIC_ITEMS_STORAGE_KEY);
          cleanedDynamic = true;
        }
      }
    } catch {
      // Non-fatal cleanup
    }

    return { cleanedSnapshot, cleanedDynamic };
  }

  /**
   * Reads the tiny `< 100 KB` Boot-Deck (`@atem:boot_deck:v1`) for `< 20ms` warm-boot hydration.
   */
  async getBootDeck(): Promise<BootDeckPayload | null> {
    try {
      const raw = await this.storage.getItem(BOOT_DECK_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && Array.isArray(parsed.items) && parsed.items.length > 0) {
        return parsed as BootDeckPayload;
      }
    } catch {
      // Ignore malformed boot deck
    }
    return null;
  }

  /**
   * Persists a compact `< 100 KB` Boot-Deck of up to 24 fresh real items into `AtemStorage`.
   */
  async saveBootDeck(items: FeedItem[], generatedAt?: string): Promise<BootDeckPayload | null> {
    try {
      const payload = buildBootDeckPayload(items, { generatedAt });
      if (payload.items.length === 0) return null;
      const serialized = JSON.stringify(payload);
      if (measureUtf8Bytes(serialized) > BOOT_DECK_MAX_BYTES) {
        return null;
      }
      await this.storage.setItem(BOOT_DECK_STORAGE_KEY, serialized);
      return payload;
    } catch {
      return null;
    }
  }

  /**
   * Reads cached public snapshot blob from IndexedDB in browser, or from `AtemStorage` in Node/tests.
   */
  async getPublicSnapshot(): Promise<CachedPublicSnapshotRecord | null> {
    if (this.shouldUseIndexedDb) {
      await this.cleanupLegacyLocalStorageSnapshot();
      const fromIdb = await this.idbGet<CachedPublicSnapshotRecord | string>(IDB_KEY_PUBLIC_SNAPSHOT);
      if (fromIdb) {
        if (typeof fromIdb === 'string') {
          try {
            const parsed = JSON.parse(fromIdb);
            return parsed && typeof parsed === 'object' ? (parsed as CachedPublicSnapshotRecord) : null;
          } catch {
            return null;
          }
        }
        return fromIdb;
      }
    }

    try {
      const raw = await this.storage.getItem(LEGACY_PUBLIC_SNAPSHOT_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? (parsed as CachedPublicSnapshotRecord) : null;
    } catch {
      return null;
    }
  }

  /**
   * Persists public snapshot blob to IndexedDB (never overflowing 5 MB `localStorage` in browser)
   * and updates the `< 100 KB` Boot-Deck. Falls back to `AtemStorage` in Node/unit tests.
   */
  async setPublicSnapshot(record: CachedPublicSnapshotRecord): Promise<void> {
    if (this.shouldUseIndexedDb) {
      await this.cleanupLegacyLocalStorageSnapshot();
      await this.idbSet(IDB_KEY_PUBLIC_SNAPSHOT, record);
      if (Array.isArray(record.items) && record.items.length > 0) {
        await this.saveBootDeck(record.items, record.generatedAt);
      }
      return;
    }

    try {
      await this.storage.setItem(LEGACY_PUBLIC_SNAPSHOT_STORAGE_KEY, JSON.stringify(record));
    } catch {
      // Non-fatal fallback
    }
    if (Array.isArray(record.items) && record.items.length > 0) {
      await this.saveBootDeck(record.items, record.generatedAt);
    }
  }

  /**
   * Reads dynamic items from IndexedDB in browser (with one-time migration from `AtemStorage`),
   * or directly from `AtemStorage` (`@atem:dynamic_items:v1`) in Node/unit tests.
   */
  async getDynamicItems(): Promise<FeedItem[] | null> {
    if (this.shouldUseIndexedDb) {
      await this.cleanupLegacyLocalStorageSnapshot();
      const fromIdb = await this.idbGet<FeedItem[] | string>(IDB_KEY_DYNAMIC_ITEMS);
      if (Array.isArray(fromIdb)) {
        return fromIdb;
      }
      if (typeof fromIdb === 'string') {
        try {
          const parsed = JSON.parse(fromIdb);
          if (Array.isArray(parsed)) return parsed as FeedItem[];
        } catch {
          // Fall through
        }
      }
    }

    try {
      const raw = await this.storage.getItem(DYNAMIC_ITEMS_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return null;
      if (this.shouldUseIndexedDb) {
        // Migrate legacy dynamic items into IndexedDB seamlessly
        await this.idbSet(IDB_KEY_DYNAMIC_ITEMS, parsed);
      }
      return parsed as FeedItem[];
    } catch {
      return null;
    }
  }

  /**
   * Persists dynamic items to IndexedDB in browser (avoiding `localStorage` quota crashes)
   * or to `AtemStorage` (`@atem:dynamic_items:v1`) in Node/unit tests.
   */
  async setDynamicItems(items: FeedItem[]): Promise<void> {
    if (this.shouldUseIndexedDb) {
      await this.cleanupLegacyLocalStorageSnapshot();
      const ok = await this.idbSet(IDB_KEY_DYNAMIC_ITEMS, items);
      if (ok) {
        // Remove stale legacy localStorage copy so quota stays clean
        try {
          await this.storage.removeItem(DYNAMIC_ITEMS_STORAGE_KEY);
        } catch {
          // Ignore
        }
        return;
      }
    }

    try {
      await this.storage.setItem(DYNAMIC_ITEMS_STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Non-fatal fallback
    }
  }

  /**
   * Wipes cached snapshot, dynamic items, and Boot-Deck (used by full data reset).
   */
  async clearAll(): Promise<void> {
    if (this.shouldUseIndexedDb) {
      await Promise.all([
        this.idbDelete(IDB_KEY_PUBLIC_SNAPSHOT),
        this.idbDelete(IDB_KEY_DYNAMIC_ITEMS)
      ]);
    }
    await Promise.all([
      this.storage.removeItem(BOOT_DECK_STORAGE_KEY).catch(() => {}),
      this.storage.removeItem(LEGACY_PUBLIC_SNAPSHOT_STORAGE_KEY).catch(() => {}),
      this.storage.removeItem(DYNAMIC_ITEMS_STORAGE_KEY).catch(() => {})
    ]);
  }
}

export const defaultFeedCacheStore = new FeedCacheStore(appStorage);
