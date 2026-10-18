import { FeedItem, FeedItemSchema } from '../domain/types';

export interface SnapshotPayload {
  generatedAt: string;
  totalCandidateSources: number;
  activeDeliveringSources: number;
  items: FeedItem[];
  sourceHealth?: Record<string, any>;
}

export interface SnapshotHydrationResult {
  success: boolean;
  itemCount: number;
  snapshotDate?: string;
  items: FeedItem[];
  error?: string;
}

/**
 * SnapshotLoader: Asynchronously loads public / remote feed snapshots.
 * Provides request deduplication, timeouts, and safe error handling.
 */
export class SnapshotLoader {
  private activePromise: Promise<SnapshotHydrationResult> | null = null;

  /**
   * Loads the snapshot from a remote or relative URL.
   */
  public async loadSnapshot(remoteUrl?: string, timeoutMs: number = 8000): Promise<SnapshotHydrationResult> {
    if (this.activePromise) {
      return this.activePromise;
    }

    this.activePromise = this.executeFetch(remoteUrl, timeoutMs).finally(() => {
      this.activePromise = null;
    });

    return this.activePromise;
  }

  private async executeFetch(remoteUrl?: string, timeoutMs: number = 8000): Promise<SnapshotHydrationResult> {
    const urlsToTry: string[] = [];
    if (remoteUrl && remoteUrl.trim().length > 0) {
      urlsToTry.push(remoteUrl.trim());
    }

    // Default web endpoints
    if (typeof window !== 'undefined' && window.location) {
      const base = window.location.pathname.replace(/\/[^/]*$/, '/');
      urlsToTry.push(`${base}feed-snapshot.json`);
      urlsToTry.push('./feed-snapshot.json');
      urlsToTry.push('/feed-snapshot.json');
    } else {
      urlsToTry.push('./feed-snapshot.json');
    }

    for (const targetUrl of urlsToTry) {
      try {
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

        const response = await fetch(targetUrl, {
          cache: 'default',
          signal: controller ? controller.signal : undefined
        });

        if (timer) clearTimeout(timer);

        if (!response.ok) continue;

        const json = await response.json();
        const rawItems = Array.isArray(json) ? json : json?.items;
        if (!Array.isArray(rawItems) || rawItems.length === 0) continue;

        const validatedItems: FeedItem[] = [];
        for (const raw of rawItems) {
          const res = FeedItemSchema.safeParse(raw);
          if (res.success) {
            validatedItems.push(res.data);
          }
        }

        if (validatedItems.length > 0) {
          const snapshotDate = json?.generatedAt
            ? new Date(json.generatedAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
            : new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });

          return {
            success: true,
            itemCount: validatedItems.length,
            snapshotDate,
            items: validatedItems
          };
        }
      } catch {
        // Try next fallback URL
      }
    }

    return {
      success: false,
      itemCount: 0,
      items: [],
      error: 'Kein gültiger Snapshot erreichbar'
    };
  }
}

export const defaultSnapshotLoader = new SnapshotLoader();
