import { FeedItem } from '../domain/types';
import { defaultSourceRepository, SourceRepository } from '../data/sourceRepository';
import { SnapshotPayload, parseSnapshotPayload } from './snapshotPayload';
export type { SnapshotPayload } from './snapshotPayload';

export interface SnapshotHydrationResult extends Partial<Omit<SnapshotPayload, 'items'>> {
  success: boolean;
  itemCount: number;
  snapshotDate?: string;
  items: FeedItem[];
  error?: string;
}

/** Public snapshot validation and bounded hydration; telemetry is measured at the snapshot date. */
export class SnapshotLoader {
  private activePromises = new Map<string, Promise<SnapshotHydrationResult>>();
  constructor(private sources: SourceRepository = defaultSourceRepository) {}

  public async loadSnapshot(remoteUrl?: string, timeoutMs = 8000): Promise<SnapshotHydrationResult> {
    const key = `${remoteUrl?.trim() || 'default'}:${timeoutMs}`;
    const active = this.activePromises.get(key);
    if (active) return active;
    const promise = this.executeFetch(remoteUrl, timeoutMs).finally(() => this.activePromises.delete(key));
    this.activePromises.set(key, promise);
    return promise;
  }

  private async executeFetch(remoteUrl?: string, timeoutMs = 8000): Promise<SnapshotHydrationResult> {
    const urlsToTry: string[] = [];
    if (remoteUrl?.trim()) urlsToTry.push(remoteUrl.trim());
    if (typeof window !== 'undefined' && window.location) {
      const base = window.location.pathname.replace(/\/[^/]*$/, '/');
      urlsToTry.push(`${base}feed-snapshot.json`, './feed-snapshot.json', '/feed-snapshot.json');
    } else urlsToTry.push('./feed-snapshot.json');

    for (const targetUrl of new Set(urlsToTry)) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(targetUrl, { cache: 'default', signal: controller.signal });
        if (!response.ok) continue;
        const payload = parseSnapshotPayload(await response.json());
        if (!payload) continue;
        await this.sources.recordSnapshotHealth(payload.sourceHealth, payload.generatedAt);
        return {
          ...payload, success: true, itemCount: payload.items.length,
          snapshotDate: payload.generatedAt
            ? new Date(payload.generatedAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
            : undefined
        };
      } catch { /* Try the next endpoint. */ }
      finally { clearTimeout(timer); }
    }
    return { success: false, itemCount: 0, items: [], error: 'Kein gültiger Snapshot erreichbar' };
  }
}

export const defaultSnapshotLoader = new SnapshotLoader();
