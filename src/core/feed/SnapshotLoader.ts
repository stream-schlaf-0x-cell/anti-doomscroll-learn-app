import { FeedItem } from '../domain/types';
import { defaultSourceRepository, SourceRepository } from '../data/sourceRepository';
import {
  SnapshotPayload,
  ParseSnapshotOptions,
  STARTUP_SNAPSHOT_MAX_BYTES,
  RESERVOIR_MAX_BYTES,
  parseSnapshotPayload,
  parseReservoirPayload,
  utf8ByteLength
} from './snapshotPayload';
export type { SnapshotPayload } from './snapshotPayload';

export const RAW_GITHUB_SNAPSHOT_URL =
  'https://raw.githubusercontent.com/stream-schlaf-0x-cell/anti-doomscroll-learn-app/main/public/feed-snapshot.json';
export const RAW_GITHUB_RESERVOIR_URL =
  'https://raw.githubusercontent.com/stream-schlaf-0x-cell/anti-doomscroll-learn-app/main/public/feed-reservoir.json';

/** Same-Origin snapshots newer than 4.5 hours skip redundant raw.githubusercontent.com downloads. */
export const SNAPSHOT_SAME_ORIGIN_FRESHNESS_MS = 4.5 * 60 * 60 * 1000;

export interface SnapshotLoadOptions {
  forceRefresh?: boolean;
}

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

function hasCacheBustQuery(url?: string): boolean {
  return Boolean(url && /[?&]_?t=\d+/.test(url));
}

function isSnapshotFreshEnough(payload: SnapshotPayload | null, nowMs = Date.now()): boolean {
  if (!payload?.generatedAt) return false;
  const generatedMs = Date.parse(payload.generatedAt);
  if (!Number.isFinite(generatedMs)) return false;
  return nowMs - generatedMs <= SNAPSHOT_SAME_ORIGIN_FRESHNESS_MS;
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
 * Public snapshot & deep reservoir loader with Same-Origin First + Lazy Dual-Origin Freshness Fallback:
 * - On normal loads, fetches Same-Origin (`./feed-snapshot.json`) FIRST using `cache: 'no-cache'`
 *   so HTTP 304 / ETag revalidation avoids redundant downloads.
 * - Queries `raw.githubusercontent.com/...` ONLY if Same-Origin fails, lacks `generatedAt`, is older
 *   than 4.5 hours, or `options.forceRefresh === true`.
 */
export class SnapshotLoader {
  private activePromises = new Map<string, Promise<SnapshotHydrationResult>>();
  constructor(private sources: SourceRepository = defaultSourceRepository) {}

  public async loadSnapshot(
    remoteUrl?: string,
    timeoutMs = 8000,
    options?: SnapshotLoadOptions
  ): Promise<SnapshotHydrationResult> {
    const forceRefresh = Boolean(options?.forceRefresh || hasCacheBustQuery(remoteUrl));
    const key = `snap:${remoteUrl?.trim() || 'default'}:${timeoutMs}:${forceRefresh ? '1' : '0'}`;
    const active = this.activePromises.get(key);
    if (active) return active;
    const promise = this.executeDualOriginFetch({
      remoteUrl,
      timeoutMs,
      forceRefresh,
      fileName: 'feed-snapshot.json',
      rawGithubUrl: RAW_GITHUB_SNAPSHOT_URL,
      maxBytes: STARTUP_SNAPSHOT_MAX_BYTES,
      parser: parseSnapshotPayload,
      recordTelemetry: true
    }).finally(() => this.activePromises.delete(key));
    this.activePromises.set(key, promise);
    return promise;
  }

  public async loadReservoir(
    remoteUrl?: string,
    timeoutMs = 9000,
    options?: SnapshotLoadOptions
  ): Promise<SnapshotHydrationResult> {
    const forceRefresh = Boolean(options?.forceRefresh || hasCacheBustQuery(remoteUrl));
    const key = `res:${remoteUrl?.trim() || 'default'}:${timeoutMs}:${forceRefresh ? '1' : '0'}`;
    const active = this.activePromises.get(key);
    if (active) return active;
    const promise = this.executeDualOriginFetch({
      remoteUrl,
      timeoutMs,
      forceRefresh,
      fileName: 'feed-reservoir.json',
      rawGithubUrl: RAW_GITHUB_RESERVOIR_URL,
      maxBytes: RESERVOIR_MAX_BYTES,
      parser: parseReservoirPayload,
      recordTelemetry: false
    }).finally(() => this.activePromises.delete(key));
    this.activePromises.set(key, promise);
    return promise;
  }

  private async fetchFirstValidFromList(
    urls: string[],
    timeoutMs: number,
    maxBytes: number,
    parser: (val: unknown, options?: ParseSnapshotOptions) => SnapshotPayload | null,
    cacheMode: RequestCache
  ): Promise<SnapshotPayload | null> {
    for (const targetUrl of new Set(urls)) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(targetUrl, { cache: cacheMode, signal: controller.signal });
        if (!response.ok) continue;
        let rawJson: unknown;
        let skipByteBudget = false;
        if (typeof response.text === 'function') {
          const rawText = await response.text();
          // Compact payloads omit articleBody (hydrated from body in memory); 2x guarantees safe headroom
          skipByteBudget = utf8ByteLength(rawText) * 2 <= maxBytes;
          rawJson = JSON.parse(rawText);
        } else {
          rawJson = await response.json();
        }
        const payload = parser(rawJson, { skipByteBudget });
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
    forceRefresh: boolean;
    fileName: string;
    rawGithubUrl: string;
    maxBytes: number;
    parser: (val: unknown, options?: ParseSnapshotOptions) => SnapshotPayload | null;
    recordTelemetry: boolean;
  }): Promise<SnapshotHydrationResult> {
    const { remoteUrl, timeoutMs, forceRefresh, fileName, rawGithubUrl, maxBytes, parser, recordTelemetry } = params;
    const nowTag = Date.now();
    const cacheBuster = `?t=${nowTag}`;

    const withBusterVariants = (url: string): string[] => {
      const trimmed = url.trim();
      if (!trimmed) return [];
      const busted = hasCacheBustQuery(trimmed)
        ? trimmed
        : trimmed.includes('?')
          ? `${trimmed}&_t=${nowTag}`
          : `${trimmed}${cacheBuster}`;
      const out = [busted];
      if (!trimmed.includes('?')) out.push(trimmed);
      return out;
    };

    const formatCandidates = (url: string, bust: boolean): string[] => {
      const trimmed = url.trim();
      if (!trimmed) return [];
      return bust ? withBusterVariants(trimmed) : [trimmed];
    };

    // Custom explicit third-party URL (e.g. user-configured endpoint or isolated unit test URL): try directly first
    if (remoteUrl?.trim() && !isDefaultOrPagesSnapshotUrl(remoteUrl)) {
      const customPayload = await this.fetchFirstValidFromList(
        formatCandidates(remoteUrl, forceRefresh),
        timeoutMs,
        maxBytes,
        parser,
        forceRefresh ? 'no-store' : 'no-cache'
      );
      if (customPayload) {
        return this.finalizePayload(customPayload, 'custom', recordTelemetry);
      }
    }

    const localUrls: string[] = [];
    if (remoteUrl?.trim() && isDefaultOrPagesSnapshotUrl(remoteUrl)) {
      localUrls.push(...formatCandidates(remoteUrl, forceRefresh));
    }

    if (typeof window !== 'undefined' && window.location) {
      const pathname = window.location.pathname || '';
      const dirBase = pathname.endsWith('/') ? pathname : `${pathname.replace(/\/[^/]*$/, '')}/`;
      localUrls.push(...formatCandidates(`./${fileName}`, forceRefresh));
      localUrls.push(...formatCandidates(`${dirBase}${fileName}`, forceRefresh));
      localUrls.push(...formatCandidates(`/anti-doomscroll-learn-app/${fileName}`, forceRefresh));
      localUrls.push(...formatCandidates(`/${fileName}`, forceRefresh));
    } else {
      localUrls.push(...formatCandidates(`./${fileName}`, forceRefresh));
      localUrls.push(...formatCandidates(`/anti-doomscroll-learn-app/${fileName}`, forceRefresh));
      localUrls.push(...formatCandidates(`/${fileName}`, forceRefresh));
    }

    const rawGithubCandidates = withBusterVariants(rawGithubUrl);

    if (forceRefresh) {
      // Explicit refresh: race both Same-Origin and Raw GitHub with cache-busting and pick newer payload
      const [localPayload, rawPayload] = await Promise.all([
        this.fetchFirstValidFromList(localUrls, timeoutMs, maxBytes, parser, 'no-store'),
        this.fetchFirstValidFromList(rawGithubCandidates, Math.min(timeoutMs, 5500), maxBytes, parser, 'no-store')
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

    // Normal load: Same-Origin FIRST with `cache: 'no-cache'` (allows HTTP 304/ETag validation!)
    const localPayload = await this.fetchFirstValidFromList(
      localUrls,
      timeoutMs,
      maxBytes,
      parser,
      'no-cache'
    );

    if (localPayload && isSnapshotFreshEnough(localPayload)) {
      return this.finalizePayload(localPayload, 'pages_or_local', recordTelemetry);
    }

    // Fallback to Raw GitHub ONLY when Same-Origin failed, lacked generatedAt, or is older than 4.5 hours
    const rawPayload = await this.fetchFirstValidFromList(
      rawGithubCandidates,
      Math.min(timeoutMs, 5500),
      maxBytes,
      parser,
      'no-store'
    );

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
