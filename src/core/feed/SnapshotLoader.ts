import { FeedItem } from '../domain/types';
import { defaultSourceRepository, SourceRepository } from '../data/sourceRepository';
import {
  SnapshotPayload,
  parseSnapshotPayload,
  parseReservoirPayload
} from './snapshotPayload';
export type { SnapshotPayload } from './snapshotPayload';

export const RAW_GITHUB_SNAPSHOT_URL =
  'https://raw.githubusercontent.com/stream-schlaf-0x-cell/anti-doomscroll-learn-app/main/public/feed-snapshot.json';
export const RAW_GITHUB_RESERVOIR_URL =
  'https://raw.githubusercontent.com/stream-schlaf-0x-cell/anti-doomscroll-learn-app/main/public/feed-reservoir.json';

export interface SnapshotHydrationResult extends Partial<Omit<SnapshotPayload, 'items'>> {
  success: boolean;
  itemCount: number;
  snapshotDate?: string;
  sourceOrigin?: 'raw_github' | 'pages_or_local' | 'custom';
  items: FeedItem[];
  error?: string;
}

function isDefaultOrPagesSnapshotUrl(remoteUrl?: string): boolean {
  if (!remoteUrl || !remoteUrl.trim()) return true;
  const trimmed = remoteUrl.trim().toLowerCase();
  if (trimmed.startsWith('./') || trimmed.startsWith('/')) return true;
  if (trimmed.includes('github.io/') || trimmed.includes('localhost') || trimmed.includes('127.0.0.1')) {
    return true;
  }
  return false;
}

function pickNewerPayload(
  a: { payload: SnapshotPayload; origin: SnapshotHydrationResult['sourceOrigin'] } | null,
  b: { payload: SnapshotPayload; origin: SnapshotHydrationResult['sourceOrigin'] } | null
): { payload: SnapshotPayload; origin: SnapshotHydrationResult['sourceOrigin'] } | null {
  if (!a) return b;
  if (!b) return a;
  const tA = a.payload.generatedAt ? Date.parse(a.payload.generatedAt) : NaN;
  const tB = b.payload.generatedAt ? Date.parse(b.payload.generatedAt) : NaN;
  if (Number.isFinite(tA) && Number.isFinite(tB)) {
    if (tB > tA) return b;
    if (tA > tB) return a;
    return b.payload.items.length > a.payload.items.length ? b : a;
  }
  if (Number.isFinite(tB) && !Number.isFinite(tA)) return b;
  if (Number.isFinite(tA) && !Number.isFinite(tB)) return a;
  return b.payload.items.length > a.payload.items.length ? b : a;
}

/**
 * Public snapshot & deep reservoir loader with Dual-Origin Freshness Selection:
 * Compares GitHub Pages (`./feed-snapshot.json`) against `raw.githubusercontent.com/.../main/public/feed-snapshot.json`
 * and picks whichever valid snapshot has the newer `generatedAt` timestamp so devices never get stuck on stale CDN caches.
 */
export class SnapshotLoader {
  private activePromises = new Map<string, Promise<SnapshotHydrationResult>>();
  constructor(private sources: SourceRepository = defaultSourceRepository) {}

  public async loadSnapshot(remoteUrl?: string, timeoutMs = 8000): Promise<SnapshotHydrationResult> {
    const key = `snap:${remoteUrl?.trim() || 'default'}:${timeoutMs}`;
    const active = this.activePromises.get(key);
    if (active) return active;
    const promise = this.executeDualOriginFetch({
      remoteUrl,
      timeoutMs,
      fileName: 'feed-snapshot.json',
      rawGithubUrl: RAW_GITHUB_SNAPSHOT_URL,
      parser: parseSnapshotPayload,
      recordTelemetry: true
    }).finally(() => this.activePromises.delete(key));
    this.activePromises.set(key, promise);
    return promise;
  }

  public async loadReservoir(remoteUrl?: string, timeoutMs = 9000): Promise<SnapshotHydrationResult> {
    const key = `res:${remoteUrl?.trim() || 'default'}:${timeoutMs}`;
    const active = this.activePromises.get(key);
    if (active) return active;
    const promise = this.executeDualOriginFetch({
      remoteUrl,
      timeoutMs,
      fileName: 'feed-reservoir.json',
      rawGithubUrl: RAW_GITHUB_RESERVOIR_URL,
      parser: parseReservoirPayload,
      recordTelemetry: false
    }).finally(() => this.activePromises.delete(key));
    this.activePromises.set(key, promise);
    return promise;
  }

  private async fetchFirstValidFromList(
    urls: string[],
    timeoutMs: number,
    parser: (val: unknown) => SnapshotPayload | null
  ): Promise<SnapshotPayload | null> {
    for (const targetUrl of new Set(urls)) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(targetUrl, { cache: 'no-store', signal: controller.signal });
        if (!response.ok) continue;
        const payload = parser(await response.json());
        if (payload) return payload;
      } catch {
        /* Try the next endpoint. */
      } finally {
        clearTimeout(timer);
      }
    }
    return null;
  }

  private async executeDualOriginFetch(params: {
    remoteUrl?: string;
    timeoutMs: number;
    fileName: string;
    rawGithubUrl: string;
    parser: (val: unknown) => SnapshotPayload | null;
    recordTelemetry: boolean;
  }): Promise<SnapshotHydrationResult> {
    const { remoteUrl, timeoutMs, fileName, rawGithubUrl, parser, recordTelemetry } = params;
    const nowTag = Date.now();
    const cacheBuster = `?t=${nowTag}`;

    const withBusterVariants = (url: string): string[] => {
      const trimmed = url.trim();
      if (!trimmed) return [];
      const out = [trimmed.includes('?') ? `${trimmed}&_t=${nowTag}` : `${trimmed}${cacheBuster}`];
      if (!trimmed.includes('?')) out.push(trimmed);
      return out;
    };

    // Custom explicit third-party URL (e.g. user-configured endpoint or isolated unit test URL): try it directly first
    if (remoteUrl?.trim() && !isDefaultOrPagesSnapshotUrl(remoteUrl)) {
      const customPayload = await this.fetchFirstValidFromList(
        withBusterVariants(remoteUrl),
        timeoutMs,
        parser
      );
      if (customPayload) {
        return this.finalizePayload(customPayload, 'custom', recordTelemetry);
      }
    }

    const localUrls: string[] = [];
    if (remoteUrl?.trim() && isDefaultOrPagesSnapshotUrl(remoteUrl)) {
      localUrls.push(...withBusterVariants(remoteUrl));
    }

    if (typeof window !== 'undefined' && window.location) {
      const pathname = window.location.pathname || '';
      const dirBase = pathname.endsWith('/') ? pathname : `${pathname.replace(/\/[^/]*$/, '')}/`;
      localUrls.push(...withBusterVariants(`./${fileName}`));
      localUrls.push(...withBusterVariants(`${dirBase}${fileName}`));
      localUrls.push(...withBusterVariants(`/anti-doomscroll-learn-app/${fileName}`));
      localUrls.push(...withBusterVariants(`/${fileName}`));
    } else {
      localUrls.push(...withBusterVariants(`./${fileName}`));
      localUrls.push(...withBusterVariants(`/anti-doomscroll-learn-app/${fileName}`));
      localUrls.push(...withBusterVariants(`/${fileName}`));
    }

    const rawGithubCandidates = withBusterVariants(rawGithubUrl);

    // Fetch local/Pages and Raw GitHub concurrently and pick whichever valid snapshot has the newer generatedAt!
    const [localPayload, rawPayload] = await Promise.all([
      this.fetchFirstValidFromList(localUrls, timeoutMs, parser),
      this.fetchFirstValidFromList(rawGithubCandidates, Math.min(timeoutMs, 5500), parser)
    ]);

    const winner = pickNewerPayload(
      localPayload ? { payload: localPayload, origin: 'pages_or_local' } : null,
      rawPayload ? { payload: rawPayload, origin: 'raw_github' } : null
    );

    if (winner) {
      return this.finalizePayload(winner.payload, winner.origin, recordTelemetry);
    }

    return { success: false, itemCount: 0, items: [], error: 'Kein gültiger Snapshot erreichbar' };
  }

  private async finalizePayload(
    payload: SnapshotPayload,
    origin: SnapshotHydrationResult['sourceOrigin'],
    recordTelemetry: boolean
  ): Promise<SnapshotHydrationResult> {
    if (recordTelemetry) {
      await this.sources.recordSnapshotHealth(payload.sourceHealth, payload.generatedAt);
    }
    return {
      ...payload,
      success: true,
      sourceOrigin: origin,
      itemCount: payload.items.length,
      snapshotDate: payload.generatedAt
        ? new Date(payload.generatedAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
        : undefined
    };
  }
}

export const defaultSnapshotLoader = new SnapshotLoader();
