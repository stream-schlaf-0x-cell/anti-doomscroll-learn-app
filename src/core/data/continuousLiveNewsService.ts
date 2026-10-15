import { FeedItem, TopicTag } from '../domain/types';
import { REAL_KNOWLEDGE_VAULT } from './realKnowledgeVault';
import { enrichItemWithInstantResearch } from '../synthesis/backgroundResearchPipeline';
import { optimizeImageUrl } from '../utils/imageQuality';
import { defaultSourceRepository } from './sourceRepository';
import { fetchFeedXml } from '../ingestion/feedFetcher';
import { parseFeedXml } from '../ingestion/rssParser';
import { normalizeFeedEntry } from '../ingestion/normalizer';
import { deduplicateFeedItems } from '../ingestion/deduplicator';
import { RawFeedSource } from '../ingestion/types';

// Safely load real-world ingested pipeline items
let rawPipelineItems: FeedItem[] = [];
try {
  const loaded = require('./pipeline-output.json');
  if (Array.isArray(loaded)) {
    rawPipelineItems = loaded as FeedItem[];
  }
} catch {
  rawPipelineItems = [];
}

export type NewsHubFilterCategory = 'all' | 'oerr' | 'tech' | 'science' | 'didactic' | 'culture';

export interface ContinuousNewsOptions {
  category?: NewsHubFilterCategory;
  query?: string;
  topic?: TopicTag;
  limit?: number;
  offset?: number;
  forceRefresh?: boolean;
}

/**
 * Continuous Live News Service
 * 
 * Delivers an ongoing, high-velocity stream of verified real-world news from
 * public broadcasters and established science/tech publications (Tagesschau,
 * Deutschlandfunk, Ars Technica, Quanta Magazine, Heise, Stanford SEP, etc.).
 * 
 * Features:
 * - Real live RSS/Atom fetching with strict 3000ms timeout via AbortController
 * - In-memory 5-minute cache for instant tab switching and zero UI lag
 * - Instant graceful fallback to bundled pipeline items if offline or on network failure
 * - Every article is enriched with Kernpunkt, Gegenstimme, Praxis-Impuls & Deep Reader
 */
export class ContinuousLiveNewsService {
  private static liveCache: { items: FeedItem[]; timestamp: number } | null = null;
  public static readonly LIVE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  /**
   * Fetches real live RSS feeds from enabled sources with a strict 3-second timeout.
   * Caches results in memory for 5 minutes.
   */
  public static async refreshLiveFeeds(force = false): Promise<FeedItem[]> {
    const now = Date.now();
    if (!force && this.liveCache && (now - this.liveCache.timestamp < this.LIVE_CACHE_TTL_MS)) {
      return this.liveCache.items;
    }

    try {
      const allSources = await defaultSourceRepository.getAllSources();
      // Pick top enabled sources (up to 8) with valid HTTP URLs
      const activeSources = allSources
        .filter(s => s.enabled && s.url && (s.url.startsWith('http://') || s.url.startsWith('https://')))
        .slice(0, 8);

      if (activeSources.length === 0) {
        return this.liveCache?.items || [];
      }

      const fetchPromises = activeSources.map(async source => {
        try {
          const res = await fetchFeedXml(source.url, { timeoutMs: 3000, retries: 0 });
          if (res.notModified || !res.content) return [];
          const rawEntries = parseFeedXml(res.content, source.id);
          const rawSource: RawFeedSource = {
            id: source.id,
            name: source.name,
            url: source.url,
            primaryTopic: source.primaryTopic,
            topics: source.topics,
            defaultEvidenceTier: 'publisher_excerpt',
            defaultAuthor: source.defaultAuthor,
            language: source.language,
            isTeachingRelated: source.category === 'education' || source.primaryTopic === 'german_didactics',
            isChallengingPerspective: false
          };
          return rawEntries.slice(0, 6).map(entry => normalizeFeedEntry(entry, rawSource));
        } catch {
          // Timeout or fetch error for this single source is non-fatal
          return [];
        }
      });

      const settled = await Promise.allSettled(fetchPromises);
      const fetchedItems: FeedItem[] = [];
      for (const result of settled) {
        if (result.status === 'fulfilled' && Array.isArray(result.value)) {
          fetchedItems.push(...result.value);
        }
      }

      if (fetchedItems.length > 0) {
        const { uniqueItems } = deduplicateFeedItems(fetchedItems, rawPipelineItems);
        this.liveCache = {
          items: uniqueItems,
          timestamp: Date.now()
        };
        return uniqueItems;
      }
    } catch {
      // Seamless fallback on any network or parsing error
    }

    if (this.liveCache && this.liveCache.items.length > 0) {
      return this.liveCache.items;
    }

    const fallbackItems = rawPipelineItems.length > 0 ? rawPipelineItems : REAL_KNOWLEDGE_VAULT;
    this.liveCache = {
      items: fallbackItems,
      timestamp: Date.now()
    };
    return fallbackItems;
  }

  /**
   * Retrieves enriched, live real-world news stream.
   * Merges live fetched items ahead of static pipeline items.
   */
  public static async getLiveStream(options: ContinuousNewsOptions = {}): Promise<FeedItem[]> {
    const { category = 'all', query = '', limit = 30, offset = 0, forceRefresh = false } = options;

    // 1. Fetch or get cached live items with 3s timeout
    const liveItems = await this.refreshLiveFeeds(forceRefresh);

    // 2. Gather candidates: live items merged ahead of static pipeline / knowledge vault
    const staticPool = rawPipelineItems.length > 0 ? rawPipelineItems : REAL_KNOWLEDGE_VAULT;
    let combinedPool: FeedItem[];
    if (liveItems.length > 0) {
      const { uniqueItems } = deduplicateFeedItems(liveItems, staticPool);
      combinedPool = [...uniqueItems, ...staticPool];
    } else {
      combinedPool = staticPool;
    }

    const pool = combinedPool;

    // Filter out disabled sources according to user settings in NewsHub
    const disabledDomains = new Set<string>();
    const disabledTokens: string[] = [];
    try {
      const allSources = await defaultSourceRepository.getAllSources();
      for (const s of allSources.filter(src => !src.enabled)) {
        disabledTokens.push(s.name.toLowerCase());
        disabledTokens.push(s.id.toLowerCase());
        try {
          const parsedUrl = new URL(s.url);
          const host = parsedUrl.hostname.replace(/^www\./, '').toLowerCase();
          disabledDomains.add(host);
        } catch {
          // ignore
        }
      }
    } catch {
      // Non-fatal
    }

    // 2. Filter by category and enabled sources
    let filtered = pool.filter(item => {
      const publisher = (item.sourceReferences?.[0]?.publisher || '').toLowerCase();
      const domain = (item.sourceDomain || '').replace(/^www\./, '').toLowerCase();

      if (domain && disabledDomains.has(domain)) {
        return false;
      }
      for (const token of disabledTokens) {
        if (token && (publisher.includes(token) || item.id.toLowerCase().includes(token))) {
          return false;
        }
      }

      if (category === 'all') return true;

      const topic = item.primaryTopic;

      switch (category) {
        case 'oerr':
          return (
            domain.includes('tagesschau') ||
            domain.includes('deutschlandfunk') ||
            domain.includes('zdf') ||
            domain.includes('bpb') ||
            domain.includes('br.de') ||
            item.sourceTrustLevel === 'public_broadcaster'
          );
        case 'tech':
          return (
            topic === 'ai_apple' ||
            domain.includes('arstechnica') ||
            domain.includes('heise') ||
            domain.includes('simonwillison') ||
            domain.includes('transformer') ||
            domain.includes('cdm')
          );
        case 'science':
          return (
            topic === 'science_society' ||
            domain.includes('quanta') ||
            domain.includes('nature') ||
            domain.includes('spektrum') ||
            domain.includes('arxiv')
          );
        case 'didactic':
          return (
            topic === 'german_didactics' ||
            item.isTeachingRelated ||
            domain.includes('bildungsserver') ||
            domain.includes('schulportal')
          );
        case 'culture':
          return (
            topic === 'philosophy_ethics' ||
            topic === 'sound_synthesis' ||
            topic === 'book_mastery' ||
            topic === 'contemplation_mind' ||
            domain.includes('plato.stanford') ||
            domain.includes('aeon')
          );
        default:
          return true;
      }
    });

    // 3. Filter by search query if present
    if (query.trim().length > 0) {
      const q = query.toLowerCase().trim();
      filtered = filtered.filter(item =>
        item.title.toLowerCase().includes(q) ||
        (item.subtitle && item.subtitle.toLowerCase().includes(q)) ||
        (item.feedText && item.feedText.toLowerCase().includes(q)) ||
        (item.sourceDomain && item.sourceDomain.toLowerCase().includes(q)) ||
        (item.sourceReferences[0]?.publisher && item.sourceReferences[0].publisher.toLowerCase().includes(q))
      );
    }

    // 4. Slice batch
    const paged = filtered.slice(offset, offset + limit);

    // 5. Enrich with instant research, didactic transfer, and optimized imagery
    return paged.map(item => {
      const enriched = enrichItemWithInstantResearch(item);
      const imageUrl = enriched.imageUrl ? optimizeImageUrl(enriched.imageUrl) : undefined;
      return {
        ...enriched,
        imageUrl: imageUrl || enriched.imageUrl
      };
    });
  }

  /**
   * Retrieves all timeless masterpieces ("old gems of the internet") from the vault.
   */
  public static getEvergreenClassics(): FeedItem[] {
    const classicsOnly = REAL_KNOWLEDGE_VAULT.filter(item => item.isEvergreenGem === true);
    return classicsOnly.map(item => {
      const enriched = enrichItemWithInstantResearch(item);
      return {
        ...enriched,
        isEvergreenGem: true,
        imageUrl: enriched.imageUrl ? optimizeImageUrl(enriched.imageUrl) : enriched.imageUrl
      };
    });
  }
}
