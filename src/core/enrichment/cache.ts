import fs from 'node:fs/promises';
import path from 'node:path';
import { EnrichmentResult } from './types';

const isBrowserEnv = typeof window !== 'undefined' || typeof document !== 'undefined';

function getSafeCacheFilePath(): string {
  if (isBrowserEnv) return '';
  try {
    return typeof __dirname !== 'undefined' ? path.resolve(__dirname, '../data/enrichment-cache.json') : '';
  } catch {
    return '';
  }
}

export class EnrichmentCache {
  private cache: Record<string, EnrichmentResult> = {};

  constructor(
    private readonly filePath: string = getSafeCacheFilePath(),
    private readonly useFilePersistence: boolean = !isBrowserEnv && Boolean(getSafeCacheFilePath())
  ) {}

  private async load(): Promise<Record<string, EnrichmentResult>> {
    if (!this.useFilePersistence) return this.cache;
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        this.cache = parsed;
        return parsed;
      }
      return {};
    } catch {
      return this.cache;
    }
  }

  private async save(): Promise<void> {
    if (!this.useFilePersistence) return;
    try {
      await fs.writeFile(this.filePath, JSON.stringify(this.cache, null, 2), 'utf8');
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
    if (this.useFilePersistence) {
      try {
        await fs.unlink(this.filePath);
      } catch {
        // Ignored
      }
    }
  }
}

export const defaultEnrichmentCache = new EnrichmentCache();
