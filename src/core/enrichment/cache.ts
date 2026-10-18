import { EnrichmentResult } from './types';
import { appStorage, AtemStorage } from '../data/storage';

export interface ICacheStorage<T = EnrichmentResult> {
  load(): Promise<Record<string, T>>;
  save(data: Record<string, T>): Promise<void>;
  clear(): Promise<void>;
}

export class MemoryCacheStorage<T = EnrichmentResult> implements ICacheStorage<T> {
  private data: Record<string, T> = {};

  async load(): Promise<Record<string, T>> {
    return { ...this.data };
  }

  async save(data: Record<string, T>): Promise<void> {
    this.data = { ...data };
  }

  async clear(): Promise<void> {
    this.data = {};
  }
}

export class StorageDriverCacheStorage<T = EnrichmentResult> implements ICacheStorage<T> {
  private static STORAGE_KEY = '@atem:enrichment_cache:v1';

  constructor(
    private readonly storage: AtemStorage = appStorage,
    private readonly storageKey = StorageDriverCacheStorage.STORAGE_KEY
  ) {}

  async load(): Promise<Record<string, T>> {
    try {
      const raw = await this.storage.getItem(this.storageKey);
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

  async save(data: Record<string, T>): Promise<void> {
    try {
      await this.storage.setItem(this.storageKey, JSON.stringify(data));
    } catch {
      // Non-fatal fallback
    }
  }

  async clear(): Promise<void> {
    try {
      await this.storage.removeItem(this.storageKey);
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

export class EnrichmentCache<T = EnrichmentResult> {
  private cache: Record<string, T> = {};
  private storage: ICacheStorage<T>;

  constructor(
    _filePathOrStorage?: string | ICacheStorage<T>,
    useFilePersistence?: boolean,
    storageOverride?: ICacheStorage<T>
  ) {
    if (typeof _filePathOrStorage === 'object' && _filePathOrStorage !== null && 'load' in _filePathOrStorage) {
      this.storage = _filePathOrStorage;
    } else if (storageOverride) {
      this.storage = storageOverride;
    } else if (useFilePersistence === false) {
      this.storage = new MemoryCacheStorage<T>();
    } else {
      this.storage = new StorageDriverCacheStorage<T>();
    }
  }

  private async load(): Promise<Record<string, T>> {
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
      return `${p.contentHash}:${p.task || 'enrich'}:${p.schemaVersion || 'v1'}:${p.promptVersion || 'v1'}:${p.modelId || 'default'}:${p.language || 'de'}:${p.personalizationScope || 'shared'}`;
    }
    return `${contentHashOrParams}:${promptVersion || 'v1'}`;
  }

  async get(contentHashOrParams: string | CacheKeyParams, promptVersion?: string): Promise<T | null> {
    const all = await this.load();
    const key = this.makeKey(contentHashOrParams, promptVersion);
    return all[key] ?? null;
  }

  async set(contentHashOrParams: string | CacheKeyParams, resultOrPromptVersion: any, maybeResult?: T): Promise<void> {
    await this.load();
    let key: string;
    let result: T;

    if (typeof contentHashOrParams === 'object') {
      key = this.makeKey(contentHashOrParams);
      result = resultOrPromptVersion as T;
    } else {
      key = this.makeKey(contentHashOrParams, resultOrPromptVersion as string);
      result = maybeResult as T;
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
