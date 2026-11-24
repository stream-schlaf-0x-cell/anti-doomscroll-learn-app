import { FeedItem } from '../domain/types';
import { isStaticFallbackItem } from '../data/feedRepository';

export const BACKGROUND_QUIET_SETTLE_MS = 16_000; // >= 15s of quiet interactivity after boot
export const BACKGROUND_CALM_INTERVAL_MS = 15 * 60 * 1000;
export const SUFFICIENT_FRESH_UNSEEN_THRESHOLD = 40;
export const FRESH_WINDOW_MS = 14 * 86400 * 1000;

export interface QuietMaintenanceReport {
  skipped: boolean;
  unseenFreshCount: number;
  addedCount: number;
  ranReservoir: boolean;
  ranLiveReplenish: boolean;
  ranNewsroom: boolean;
}

export interface BackgroundCoordinatorDeps {
  getRepoItems: () => FeedItem[];
  getSeenIds: () => Promise<Set<string>>;
  hydrateReservoir?: () => Promise<{ success: boolean; insertedCount: number } | undefined>;
  runLiveReplenishment?: (context: {
    existingIds: Set<string>;
    seenIds: Set<string>;
    unseenFreshCount: number;
  }) => Promise<FeedItem[]>;
  runAiNewsroom?: (items: FeedItem[]) => Promise<FeedItem[]>;
  runPeriodicLiveCheck?: () => Promise<FeedItem[]>;
  onItemsAdded?: (items: FeedItem[], shouldRecompute: boolean) => Promise<void> | void;
  quietDelayMs?: number;
  calmIntervalMs?: number;
  sufficientUnseenThreshold?: number;
}

/**
 * Counts real (non-fallback), unseen items published within the active 14-day freshness window.
 */
export function countFreshUnseenItems(
  items: readonly Pick<FeedItem, 'id' | 'publishedAt' | 'isStaticFallback'>[],
  seenIds: ReadonlySet<string>,
  nowMs: number = Date.now()
): number {
  const cutoffMs = nowMs - FRESH_WINDOW_MS;
  let count = 0;
  for (const item of items) {
    if (!item || isStaticFallbackItem(item)) continue;
    if (seenIds.has(item.id)) continue;
    const t = item.publishedAt ? Date.parse(item.publishedAt) : NaN;
    if (Number.isFinite(t) && t >= cutoffMs) {
      count++;
    }
  }
  return count;
}

/**
 * Consolidated, cancellable idle background task coordinator.
 * Replaces scattered 3s/8s boot-storm timers with a single quiet settle window (>= 15s)
 * and skips background newsroom / live replenishment completely when >= 40 fresh unseen items exist.
 */
export class BackgroundCoordinator {
  private readonly deps: BackgroundCoordinatorDeps;
  private readonly quietDelayMs: number;
  private readonly calmIntervalMs: number;
  private readonly sufficientUnseenThreshold: number;
  private settleTimer: ReturnType<typeof setTimeout> | null = null;
  private calmInterval: ReturnType<typeof setInterval> | null = null;
  private stopped: boolean = false;
  private inFlight: boolean = false;

  constructor(deps: BackgroundCoordinatorDeps) {
    this.deps = deps;
    this.quietDelayMs = deps.quietDelayMs ?? BACKGROUND_QUIET_SETTLE_MS;
    this.calmIntervalMs = deps.calmIntervalMs ?? BACKGROUND_CALM_INTERVAL_MS;
    this.sufficientUnseenThreshold =
      deps.sufficientUnseenThreshold ?? SUFFICIENT_FRESH_UNSEEN_THRESHOLD;
  }

  public getQuietDelayMs(): number {
    return this.quietDelayMs;
  }

  public getSufficientUnseenThreshold(): number {
    return this.sufficientUnseenThreshold;
  }

  public isActive(): boolean {
    return !this.stopped && (this.settleTimer !== null || this.calmInterval !== null);
  }

  public start(): void {
    this.stop();
    this.stopped = false;

    this.settleTimer = setTimeout(() => {
      this.settleTimer = null;
      if (this.stopped) return;
      void this.runQuietMaintenancePass().finally(() => {
        if (!this.stopped) {
          this.armCalmInterval();
        }
      });
    }, this.quietDelayMs);

    if (this.settleTimer && typeof (this.settleTimer as any).unref === 'function') {
      (this.settleTimer as any).unref();
    }
  }

  private armCalmInterval(): void {
    if (this.stopped || this.calmInterval !== null || !this.deps.runPeriodicLiveCheck) {
      return;
    }
    this.calmInterval = setInterval(() => {
      if (this.stopped) return;
      void (async () => {
        try {
          const items = await this.deps.runPeriodicLiveCheck?.();
          if (!this.stopped && items && items.length > 0) {
            await this.deps.onItemsAdded?.(items, true);
          }
        } catch {
          // Non-blocking calm background check
        }
      })();
    }, this.calmIntervalMs);

    if (this.calmInterval && typeof (this.calmInterval as any).unref === 'function') {
      (this.calmInterval as any).unref();
    }
  }

  public async runQuietMaintenancePass(): Promise<QuietMaintenanceReport> {
    if (this.stopped || this.inFlight) {
      return {
        skipped: true,
        unseenFreshCount: 0,
        addedCount: 0,
        ranReservoir: false,
        ranLiveReplenish: false,
        ranNewsroom: false
      };
    }

    this.inFlight = true;
    try {
      const seenIds = await this.deps.getSeenIds().catch(() => new Set<string>());
      if (this.stopped) {
        return {
          skipped: true,
          unseenFreshCount: 0,
          addedCount: 0,
          ranReservoir: false,
          ranLiveReplenish: false,
          ranNewsroom: false
        };
      }

      const initialItems = this.deps.getRepoItems();
      let unseenFreshCount = countFreshUnseenItems(initialItems, seenIds);

      // Quiet fast-path: skip completely when >= 40 fresh unseen items already exist
      if (unseenFreshCount >= this.sufficientUnseenThreshold) {
        return {
          skipped: true,
          unseenFreshCount,
          addedCount: 0,
          ranReservoir: false,
          ranLiveReplenish: false,
          ranNewsroom: false
        };
      }

      let addedCount = 0;
      let ranReservoir = false;
      let ranLiveReplenish = false;
      let ranNewsroom = false;

      // 1. Lazy Tier-2 Reservoir hydration ONLY when unseen items are low
      if (this.deps.hydrateReservoir) {
        try {
          ranReservoir = true;
          const res = await this.deps.hydrateReservoir();
          if (!this.stopped && res?.success && res.insertedCount > 0) {
            addedCount += res.insertedCount;
            await this.deps.onItemsAdded?.([], true);
          }
        } catch {
          // Non-blocking reservoir fallback
        }
      }

      if (this.stopped) {
        return { skipped: false, unseenFreshCount, addedCount, ranReservoir, ranLiveReplenish, ranNewsroom };
      }

      // Re-count after reservoir hydration; skip heavy live scraping if reservoir already refilled the pool
      const afterReservoirItems = this.deps.getRepoItems();
      unseenFreshCount = countFreshUnseenItems(afterReservoirItems, seenIds);

      if (unseenFreshCount < this.sufficientUnseenThreshold && this.deps.runLiveReplenishment) {
        try {
          ranLiveReplenish = true;
          const existingIds = new Set(afterReservoirItems.map(i => i.id));
          const liveAdded = await this.deps.runLiveReplenishment({
            existingIds,
            seenIds,
            unseenFreshCount
          });
          if (!this.stopped && liveAdded.length > 0) {
            addedCount += liveAdded.length;
            await this.deps.onItemsAdded?.(liveAdded, true);
          }
        } catch {
          // Non-blocking replenishment fallback
        }
      }

      if (this.stopped) {
        return { skipped: false, unseenFreshCount, addedCount, ranReservoir, ranLiveReplenish, ranNewsroom };
      }

      // 2. Background AI newsroom batch (silent repository enrichment, no disruptive stream jump)
      if (this.deps.runAiNewsroom) {
        try {
          ranNewsroom = true;
          const newsroomItems = await this.deps.runAiNewsroom(this.deps.getRepoItems());
          if (!this.stopped && newsroomItems.length > 0) {
            addedCount += newsroomItems.length;
            await this.deps.onItemsAdded?.(newsroomItems, false);
          }
        } catch {
          // Silent newsroom worker fallback
        }
      }

      return {
        skipped: false,
        unseenFreshCount,
        addedCount,
        ranReservoir,
        ranLiveReplenish,
        ranNewsroom
      };
    } finally {
      this.inFlight = false;
    }
  }

  public stop(): void {
    this.stopped = true;
    if (this.settleTimer !== null) {
      clearTimeout(this.settleTimer);
      this.settleTimer = null;
    }
    if (this.calmInterval !== null) {
      clearInterval(this.calmInterval);
      this.calmInterval = null;
    }
  }
}
