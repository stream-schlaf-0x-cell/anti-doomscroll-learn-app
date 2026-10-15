/**
 * Daily Generation Service
 * 
 * Orchestrates autonomous daily content generation:
 * - Checks calendar dates to generate fresh editions every 24 hours
 * - Merges verified RSS inputs, dialectical trend antitheses, and Raindrop bookmarks
 * - Indexes every daily batch permanently into the ArchiveService
 * - Adapts ranking to the user's latest recursive learning profile
 */

import { FeedItem, UserProfile } from '../domain/types';
import { ArchiveService, ArchivedEdition } from '../archive/archiveService';
import { TrendRadarService } from '../synthesis/trendRadarService';
import { feedRepository } from '../data/feedRepository';
import { appStorage } from '../data/storage';
import { ContinuousLiveNewsService } from '../data/continuousLiveNewsService';

export interface DailyGenerationStatus {
  lastGeneratedDate: string;
  isTodayGenerated: boolean;
  totalDailyItems: number;
  autoDaemonEnabled: boolean;
  nextScheduledGeneration: string;
}

export class DailyGenerationService {
  private static STORAGE_KEY_LAST_GEN = '@atem:last_generated_edition_date';
  private static STORAGE_KEY_DAEMON = '@atem:auto_daemon_enabled';

  /**
   * Checks current daily edition status.
   */
  public static async getStatus(): Promise<DailyGenerationStatus> {
    const today = new Date().toISOString().slice(0, 10);
    const lastGen = await appStorage.getItem(this.STORAGE_KEY_LAST_GEN) || '';
    const daemonRaw = await appStorage.getItem(this.STORAGE_KEY_DAEMON);
    const autoDaemonEnabled = daemonRaw !== 'false'; // Enabled by default

    const existingToday = await ArchiveService.getEditionByDate(today);

    // Next scheduled is midnight tonight
    const tomorrow = new Date();
    tomorrow.setHours(24, 0, 0, 0);

    return {
      lastGeneratedDate: lastGen,
      isTodayGenerated: Boolean(existingToday),
      totalDailyItems: existingToday ? existingToday.itemCount : 0,
      autoDaemonEnabled,
      nextScheduledGeneration: tomorrow.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  }

  /**
   * Generates or refreshes the daily edition for a specific date (defaults to today).
   */
  public static async generateDailyEdition(
    profile: UserProfile,
    targetDate?: string,
    forceRefresh: boolean = false
  ): Promise<{ edition: ArchivedEdition; generatedItems: FeedItem[] }> {
    const today = targetDate || new Date().toISOString().slice(0, 10);

    // If already generated today and not forced, return cached edition
    if (!forceRefresh) {
      const existing = await ArchiveService.getEditionByDate(today);
      if (existing) {
        return { edition: existing, generatedItems: existing.items };
      }
    }

    // 1. Collect candidate items from feedRepository
    const baseItems = feedRepository.getAllItems ? feedRepository.getAllItems() : [];

    // 2. Collect dialectical trend items from TrendRadarService
    const trends = TrendRadarService.getActiveTrends();
    const trendItems = trends.map(t => TrendRadarService.convertTrendToFeedItem(t));

    // 3. Pool and deduplicate
    const poolMap = new Map<string, FeedItem>();
    for (const item of trendItems) {
      poolMap.set(item.id, { ...item, editionDate: today, isDailyEdition: true });
    }
    for (const item of baseItems) {
      if (!poolMap.has(item.id)) {
        poolMap.set(item.id, { ...item, editionDate: today, isDailyEdition: true });
      }
    }

    const candidatePool = Array.from(poolMap.values());

    // 4. Rank items matching user's profile interests
    const scoredPool = candidatePool.map(item => {
      const topic = item.primaryTopic || 'philosophy_ethics';
      const weight = profile.explicitInterests[topic] ?? 0.5;
      const score = weight * 1.5 + (item.upvotesCount ? item.upvotesCount / 100 : 0.5);
      return { item, score };
    });

    scoredPool.sort((a, b) => b.score - a.score);

    // Select the top 12 items for the finite daily edition
    const selectedItems = scoredPool.slice(0, 12).map(s => s.item);

    // 5. Permanently archive this edition
    const edition = await ArchiveService.recordEdition(selectedItems, today);
    await appStorage.setItem(this.STORAGE_KEY_LAST_GEN, today);

    // 6. Ensure feedRepository has these fresh items
    if (feedRepository.addItems) {
      feedRepository.addItems(selectedItems);
    }

    return { edition, generatedItems: selectedItems };
  }

  /**
   * Simulates daily content generation as a developer:
   * - Computes a simulated date (e.g. today, tomorrow, or offset)
   * - Optionally forces fresh real-world live RSS fetching
   * - Re-ranks candidate pools with that date's seed
   * - Persists into ArchiveService and feedRepository
   */
  public static async simulateDailyGeneration(options: {
    profile: UserProfile;
    daysOffset?: number;
    targetDate?: string;
    fetchLiveNews?: boolean;
  }): Promise<{ edition: ArchivedEdition; generatedItems: FeedItem[]; simulatedDate: string }> {
    const { profile, daysOffset = 0, targetDate, fetchLiveNews = true } = options;

    let simulatedDate = targetDate;
    if (!simulatedDate) {
      const d = new Date();
      d.setDate(d.getDate() + daysOffset);
      simulatedDate = d.toISOString().slice(0, 10);
    }

    // 1. Optionally fetch fresh live news and inject into pool
    if (fetchLiveNews) {
      try {
        const liveItems = await ContinuousLiveNewsService.refreshLiveFeeds(true);
        if (liveItems.length > 0 && feedRepository.addItems) {
          feedRepository.addItems(liveItems);
        }
      } catch {
        // Fallback gracefully
      }
    }

    // 2. Generate and force refresh for simulated date
    const { edition, generatedItems } = await this.generateDailyEdition(profile, simulatedDate, true);

    return { edition, generatedItems, simulatedDate };
  }

  /**
   * Toggles autonomous daemon state.
   */
  public static async toggleAutoDaemon(enabled: boolean): Promise<boolean> {
    await appStorage.setItem(this.STORAGE_KEY_DAEMON, enabled ? 'true' : 'false');
    return enabled;
  }
}
