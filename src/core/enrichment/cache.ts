import { EnrichmentResult } from './types';
import { appStorage, AtemStorage } from '../data/storage';

export interface ICacheStorage {
  load(): Promise<Record<string, EnrichmentResult>>;
  save(data: Record<string, EnrichmentResult>): Promise<void>;
  clear(): Promise<void>;
}

export class MemoryCacheStorage implements ICacheStorage {
  private data: Record<string, EnrichmentResult> = {};

  async load(): Promise<Record<string, EnrichmentResult>> {
    return { ...this.data };
  }

  async save(data: Record<string, EnrichmentResult>): Promise<void> {
    this.data = { ...data };
  }

  async clear(): Promise<void> {
    this.data = {};
  }
}

export class StorageDriverCacheStorage implements ICacheStorage {
  private static STORAGE_KEY = '@atem:enrichment_cache:v1';

  constructor(private readonly storage: AtemStorage = appStorage) {}

  async load(): Promise<Record<string, EnrichmentResult>> {
    try {
      const raw = await this.storage.getItem(StorageDriverCacheStorage.STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
      return {};
    } catch {
      return {};
    }
  }

  async save(data: Record<string, EnrichmentResult>): Promise<void> {
    try {
      await this.storage.setItem(StorageDriverCacheStorage.STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Non-fatal fallback
    }
  }

  async clear(): Promise<void> {
    try {
      await this.storage.removeItem(StorageDriverCacheStorage.STORAGE_KEY);
    } catch {
      // Non-fatal fallback
    }
  }
}

export class EnrichmentCache {
  private cache: Record<string, EnrichmentResult> = {};
  private storage: ICacheStorage;

  constructor(
    _filePathOrStorage?: string | ICacheStorage,
    useFilePersistence?: boolean,
    storageOverride?: ICacheStorage
  ) {
    if (typeof _filePathOrStorage === 'object' && _filePathOrStorage !== null && 'load' in _filePathOrStorage) {
      this.storage = _filePathOrStorage;
    } else if (storageOverride) {
      this.storage = storageOverride;
    } else if (useFilePersistence === false) {
      this.storage = new MemoryCacheStorage();
    } else {
      this.storage = new StorageDriverCacheStorage();
    }
  }

  private async load(): Promise<Record<string, EnrichmentResult>> {
    try {
      const loaded = await this.storage.load();
      if (loaded && Object.keys(loaded).length > 0) {
        this.cache = loaded;
      }
      return this.cache;
    } catch {
      return this.cache;
    }
  }

  private async save(): Promise<void> {
    try {
      await this.storage.save(this.cache);
    } catch {
      // Ignored
    }
  }

  makeKey(contentHash: string, promptVersion: string): string {
    return `${contentHash}:${promptVersion}`;
  }

  async get(contentHash: string, promptVersion: string): Promise<EnrichmentResult | null> {
    const all = await this.load();
    const key = this.makeKey(contentHash, promptVersion);
    return all[key] ?? null;
  }

  async set(contentHash: string, promptVersion: string, result: EnrichmentResult): Promise<void> {
    await this.load();
    const key = this.makeKey(contentHash, promptVersion);
    this.cache[key] = result;
    await this.save();
  }

  async clear(): Promise<void> {
    this.cache = {};
    await this.storage.clear();
  }
}

export const defaultEnrichmentCache = new EnrichmentCache();
