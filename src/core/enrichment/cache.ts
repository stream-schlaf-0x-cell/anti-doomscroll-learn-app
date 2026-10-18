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

export interface CacheKeyParams {
  contentHash: string;
  task?: string;
  schemaVersion?: string;
  promptVersion?: string;
  modelId?: string;
  language?: string;
  personalizationScope?: string;
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

  makeKey(contentHashOrParams: string | CacheKeyParams, promptVersion?: string): string {
    if (typeof contentHashOrParams === 'object') {
      const p = contentHashOrParams;
      return `${p.contentHash}:${p.task || 'enrich'}:${p.schemaVersion || 'v1'}:${p.promptVersion || 'v1'}:${p.modelId || 'default'}:${p.language || 'de'}`;
    }
    return `${contentHashOrParams}:${promptVersion || 'v1'}`;
  }

  async get(contentHashOrParams: string | CacheKeyParams, promptVersion?: string): Promise<EnrichmentResult | null> {
    const all = await this.load();
    const key = this.makeKey(contentHashOrParams, promptVersion);
    return all[key] ?? null;
  }

  async set(contentHashOrParams: string | CacheKeyParams, resultOrPromptVersion: any, maybeResult?: EnrichmentResult): Promise<void> {
    await this.load();
    let key: string;
    let result: EnrichmentResult;

    if (typeof contentHashOrParams === 'object') {
      key = this.makeKey(contentHashOrParams);
      result = resultOrPromptVersion as EnrichmentResult;
    } else {
      key = this.makeKey(contentHashOrParams, resultOrPromptVersion as string);
      result = maybeResult as EnrichmentResult;
    }

    this.cache[key] = result;
    await this.save();
  }

  async clear(): Promise<void> {
    this.cache = {};
    await this.storage.clear();
  }
}

export const defaultEnrichmentCache = new EnrichmentCache();
