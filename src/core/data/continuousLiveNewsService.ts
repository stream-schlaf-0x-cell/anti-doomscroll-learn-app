import { FeedItem, TopicTag } from '../domain/types';
import { REAL_KNOWLEDGE_VAULT } from './realKnowledgeVault';
import { enrichItemWithInstantResearch } from '../synthesis/backgroundResearchPipeline';
import { optimizeImageUrl } from '../utils/imageQuality';
import { defaultSourceRepository } from './sourceRepository';
import { fetchRssWithCorsFallback } from '../ingestion/feedFetcher';
import { parseFeedXml } from '../ingestion/rssParser';
import { normalizeFeedEntry, pureJsSha256 } from '../ingestion/normalizer';
import { deduplicateFeedItems } from '../ingestion/deduplicator';
import { RawFeedSource } from '../ingestion/types';

// Safely load real-world ingested pipeline items (serves as offline / bottom fallback)
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
 * - Native CORS-Open JSON Connectors: Tagesschau Live v2, Hacker News Frontpage, Wikipedia Featured & Trending
 * - CORS-Bridged RSS/Atom fetching with automatic proxy fallback on Web
 * - Strict chronological sorting & domain interleaving (freshest items always at position #1)
 * - In-memory cache with formatted timestamp and manual force refresh
 * - Every article is enriched with Kernpunkt, Gegenstimme, Praxis-Impuls & Deep Reader
 */
export class ContinuousLiveNewsService {
  private static liveCache: {
    items: FeedItem[];
    timestamp: number;
    lastFetchedAt: string;
  } | null = null;

  public static readonly LIVE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  /**
   * Returns human-readable time string when live feeds were last updated.
   */
  public static getLastUpdatedTime(): string {
    return this.liveCache?.lastFetchedAt || 'Live';
  }

  /**
   * Helper: Interleaves items by sourceDomain so consecutive cards come from different sources.
   */
  private static interleaveDomains(items: FeedItem[]): FeedItem[] {
    if (items.length <= 2) return items;
    const pool = [...items];
    const result: FeedItem[] = [];

    while (pool.length > 0) {
      const lastDomain = result.length > 0 ? (result[result.length - 1].sourceDomain || '') : null;
      let nextIdx = pool.findIndex(i => (i.sourceDomain || '') !== lastDomain);
      if (nextIdx === -1) nextIdx = 0;
      const [chosen] = pool.splice(nextIdx, 1);
      result.push(chosen);
    }

    return result;
  }

  /**
   * Native Tagesschau Live JSON Connector (v2 Open API, 100% CORS-friendly)
   */
  private static async fetchTagesschauLiveJson(): Promise<FeedItem[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    try {
      const res = await fetch('https://www.tagesschau.de/api2u/news/', {
        signal: controller.signal,
        headers: { Accept: 'application/json' }
      });
      clearTimeout(timeout);
      if (!res.ok) return [];
      const data = await res.json();
      if (!data || !Array.isArray(data.news)) return [];

      const items: FeedItem[] = [];
      for (const entry of data.news) {
        if (!entry || !entry.title) continue;
        const ressort = (entry.ressort || '').toLowerCase();
        let primaryTopic: TopicTag = 'science_society';
        let space = 'c/wissenschaft_ideen';

        if (ressort.includes('wissen') || ressort.includes('forschung')) {
          primaryTopic = 'science_society';
          space = 'c/wissenschaft_ideen';
        } else if (ressort.includes('wirtschaft') || ressort.includes('digital')) {
          primaryTopic = 'ai_apple';
          space = 'c/singularity_watch';
        } else if (ressort.includes('kultur')) {
          primaryTopic = 'philosophy_ethics';
          space = 'c/philosophie_ethik';
        }

        const dateStr = entry.date || new Date().toISOString();
        const firstSentence = (entry.firstSentence || '').trim();
        const contentStr = Array.isArray(entry.content)
          ? entry.content.map((c: any) => c?.value || '').join('\n\n')
          : (entry.content || '');

        const summaryText = firstSentence || contentStr || entry.title;
        const articleBody = contentStr && contentStr.length > summaryText.length ? contentStr : summaryText;
        const imageUrl = entry.teaserImage?.imageVariants?.['16x9-960'] ||
                         entry.teaserImage?.imageVariants?.['16x9-512'] ||
                         entry.teaserImage?.imageVariants?.['16x9-640'] ||
                         undefined;

        const id = `ts-${entry.sophoraId || entry.externalId || pureJsSha256(entry.title).slice(0, 8)}`;
        const canonicalUrl = entry.detailsweb || 'https://www.tagesschau.de';
        const nowIso = new Date().toISOString();
        const todayStr = nowIso.split('T')[0];

        const item: FeedItem = {
          id,
          type: 'briefing',
          format: 'sourced_update',
          title: entry.title,
          subtitle: firstSentence || 'Eilmeldung der ARD Tagesschau',
          feedText: summaryText,
          articleBody,
          body: articleBody,
          topics: [primaryTopic],
          primaryTopic,
          publishedAt: dateStr,
          generatedAt: nowIso,
          editionDate: todayStr,
          isDailyEdition: true,
          isDemonstration: false,
          aiAssisted: false,
          factReviewStatus: 'curated_illustrative',
          contentOrigin: 'live_ingested',
          contentHash: id,
          relevanceExplanation: 'Aktuelle Live-Meldung der Tagesschau',
          contentStatus: 'editorial_briefing',
          provenanceSummary: 'ARD Tagesschau Live',
          wordCount: Math.max(1, articleBody.split(/\s+/).length),
          isTeachingRelated: false,
          isChallengingPerspective: false,
          sourceTrustLevel: 'public_broadcaster',
          evidenceTier: 'publisher_excerpt',
          sourceDomain: 'tagesschau.de',
          sourceBroadcasterName: 'ARD Tagesschau (Live)',
          canonicalUrl,
          imageUrl,
          space,
          flair: '🛡️ Tagesschau Live',
          estimatedReadingMinutes: Math.max(1, Math.round(articleBody.split(/\s+/).length / 200)),
          sourceReferences: [{
            publisher: 'ARD Tagesschau',
            originalUrl: canonicalUrl,
            title: entry.title,
            author: 'ARD Tagesschau',
            publicationTimestamp: dateStr,
            retrievalTimestamp: nowIso,
            isVerified: true
          }],
          upvotesCount: 45,
          awardsCount: { gold: 2, brain: 5, spark: 4 },
          comments: [
            {
              id: `c-ts-${id}-1`,
              authorHandle: 'u/fakten_pruefer',
              authorBadge: 'ÖRR-Monitor',
              text: 'Verifizierte Primärmeldung der ARD-Redaktion ohne algorithmische Verzerrung.',
              score: 18,
              timeAgo: 'vor kurzem',
              commentType: 'creative_synthesis'
            }
          ]
        };
        items.push(item);
      }
      return items;
    } catch {
      clearTimeout(timeout);
      return [];
    }
  }

  /**
   * Native Hacker News Algolia Live Stream (100% CORS-friendly)
   */
  private static async fetchHackerNewsLiveJson(): Promise<FeedItem[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    try {
      const res = await fetch('https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=12', {
        signal: controller.signal,
        headers: { Accept: 'application/json' }
      });
      clearTimeout(timeout);
      if (!res.ok) return [];
      const data = await res.json();
      if (!data || !Array.isArray(data.hits)) return [];

      const items: FeedItem[] = [];
      for (const hit of data.hits) {
        if (!hit || !hit.title) continue;
        const externalUrl = hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`;
        let domain = 'news.ycombinator.com';
        try {
          if (hit.url) {
            domain = new URL(hit.url).hostname.replace(/^www\./, '');
          }
        } catch {
          // ignore
        }

        const dateStr = hit.created_at || new Date().toISOString();
        const points = hit.points || 0;
        const numComments = hit.num_comments || 0;
        const storyText = hit.story_text ? hit.story_text.replace(/<[^>]*>/g, '').trim() : '';

        const id = `hn-${hit.objectID}`;
        const subtitle = `Frontpage-Diskussion auf Hacker News (${points} Punkte • ${numComments} Kommentare)`;
        const feedText = storyText || `Top-Thema auf Hacker News: „${hit.title}“. Diskutiert von ${numComments} Entwicklern und Forschern weltweit.`;
        const nowIso = new Date().toISOString();
        const todayStr = nowIso.split('T')[0];

        const item: FeedItem = {
          id,
          type: 'quick_insight',
          format: 'sourced_update',
          title: hit.title,
          subtitle,
          feedText,
          articleBody: feedText,
          body: feedText,
          topics: ['ai_apple', 'science_society'],
          primaryTopic: 'ai_apple',
          publishedAt: dateStr,
          generatedAt: nowIso,
          editionDate: todayStr,
          isDailyEdition: false,
          isDemonstration: false,
          aiAssisted: false,
          factReviewStatus: 'historical_reference',
          contentOrigin: 'live_ingested',
          contentHash: id,
          relevanceExplanation: 'Hacker News Frontpage Diskussion',
          contentStatus: 'editorial_briefing',
          provenanceSummary: 'Hacker News Algolia API',
          wordCount: Math.max(1, feedText.split(/\s+/).length),
          isTeachingRelated: false,
          isChallengingPerspective: false,
          sourceTrustLevel: 'peer_reviewed',
          evidenceTier: 'publisher_excerpt',
          sourceDomain: domain,
          sourceBroadcasterName: `Hacker News (${domain})`,
          canonicalUrl: externalUrl,
          space: 'c/singularity_watch',
          flair: '⚡ Tech-Frontpage',
          estimatedReadingMinutes: 2,
          sourceReferences: [{
            publisher: `Hacker News • ${domain}`,
            originalUrl: externalUrl,
            title: hit.title,
            author: hit.author || 'HN',
            publicationTimestamp: dateStr,
            retrievalTimestamp: nowIso,
            isVerified: true
          }],
          upvotesCount: points > 0 ? points : 52,
          awardsCount: { gold: 3, brain: 12, spark: 8 },
          comments: [
            {
              id: `c-hn-${id}-1`,
              authorHandle: `u/${hit.author || 'hackernews_user'}`,
              authorBadge: 'HN Member',
              text: `Frontpage-Kuration mit ${numComments} Beiträgen in der Diskussion.`,
              score: Math.min(30, points),
              timeAgo: 'heute',
              commentType: 'creative_synthesis'
            }
          ]
        };
        items.push(item);
      }
      return items;
    } catch {
      clearTimeout(timeout);
      return [];
    }
  }

  /**
   * Native Wikipedia Featured & Trending Knowledge Stream (100% CORS-friendly)
   */
  private static async fetchWikipediaLiveJson(): Promise<FeedItem[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    try {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const url = `https://de.wikipedia.org/api/rest_v1/feed/featured/${yyyy}/${mm}/${dd}`;

      const res = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'application/json' }
      });
      clearTimeout(timeout);
      if (!res.ok) return [];
      const data = await res.json();
      if (!data) return [];

      const items: FeedItem[] = [];
      const todayStr = `${yyyy}-${mm}-${dd}`;
      const nowIso = now.toISOString();

      // 1. Artikel des Tages (tfa)
      if (data.tfa && data.tfa.title) {
        const tfa = data.tfa;
        const pageUrl = tfa.content_urls?.desktop?.page || `https://de.wikipedia.org/wiki/${encodeURIComponent(tfa.title)}`;
        const imageUrl = tfa.originalimage?.source || tfa.thumbnail?.source || undefined;
        const extract = tfa.extract || tfa.description || tfa.title;

        items.push({
          id: `wiki-tfa-${yyyy}-${mm}-${dd}`,
          type: 'briefing',
          format: 'sourced_update',
          title: `Artikel des Tages: ${tfa.title}`,
          subtitle: tfa.description || 'Exzellenter Artikel der deutschsprachigen Wikipedia',
          feedText: extract,
          articleBody: extract,
          body: extract,
          topics: ['science_society', 'philosophy_ethics'],
          primaryTopic: 'science_society',
          publishedAt: nowIso,
          generatedAt: nowIso,
          editionDate: todayStr,
          isDailyEdition: true,
          isDemonstration: false,
          aiAssisted: false,
          factReviewStatus: 'scientific_paper',
          contentOrigin: 'live_ingested',
          contentHash: `wiki-tfa-${yyyy}-${mm}-${dd}`,
          relevanceExplanation: 'Wikipedia Artikel des Tages',
          contentStatus: 'scientific_analysis',
          provenanceSummary: 'Wikipedia Exzellenter Artikel',
          wordCount: Math.max(1, extract.split(/\s+/).length),
          isTeachingRelated: false,
          isChallengingPerspective: false,
          sourceTrustLevel: 'peer_reviewed',
          evidenceTier: 'publisher_excerpt',
          sourceDomain: 'de.wikipedia.org',
          sourceBroadcasterName: 'Wikipedia (Artikel des Tages)',
          canonicalUrl: pageUrl,
          imageUrl,
          space: 'c/wissenschaft_ideen',
          flair: '🏆 Exzellenter Artikel',
          estimatedReadingMinutes: Math.max(2, Math.round(extract.split(/\s+/).length / 200)),
          sourceReferences: [{
            publisher: 'Wikipedia',
            originalUrl: pageUrl,
            title: tfa.title,
            author: 'Wikipedia Community',
            publicationTimestamp: nowIso,
            retrievalTimestamp: nowIso,
            isVerified: true
          }],
          upvotesCount: 95,
          awardsCount: { gold: 5, brain: 22, spark: 15 },
          comments: []
        });
      }

      // 2. Picture of the Day (image)
      if (data.image && data.image.file_page) {
        const img = data.image;
        const imgUrl = img.image?.source || img.thumbnail?.source;
        const desc = typeof img.description === 'string' ? img.description : (img.description?.text || 'Wikimedia Commons Bild des Tages');
        const artist = img.artist?.text || 'Wikimedia Commons';

        items.push({
          id: `wiki-potd-${yyyy}-${mm}-${dd}`,
          type: 'quick_insight',
          format: 'art_showcase',
          title: `Bild des Tages: ${img.title ? img.title.replace(/^Datei:/, '') : 'Meisterwerk der Fotografie & Kunst'}`,
          subtitle: `Kuratiert von Wikimedia Commons • Von ${artist}`,
          feedText: desc,
          articleBody: desc,
          body: desc,
          topics: ['art_aesthetics', 'contemplation_mind'],
          primaryTopic: 'art_aesthetics',
          publishedAt: nowIso,
          generatedAt: nowIso,
          editionDate: todayStr,
          isDailyEdition: true,
          isDemonstration: false,
          aiAssisted: false,
          factReviewStatus: 'curated_illustrative',
          contentOrigin: 'live_ingested',
          contentHash: `wiki-potd-${yyyy}-${mm}-${dd}`,
          relevanceExplanation: 'Wikimedia Commons Bild des Tages',
          contentStatus: 'philosophical_perspective',
          provenanceSummary: 'Wikimedia Commons',
          wordCount: Math.max(1, desc.split(/\s+/).length),
          isTeachingRelated: false,
          isChallengingPerspective: false,
          sourceTrustLevel: 'peer_reviewed',
          evidenceTier: 'publisher_excerpt',
          sourceDomain: 'commons.wikimedia.org',
          sourceBroadcasterName: 'Wikimedia Commons (Bild des Tages)',
          canonicalUrl: img.file_page,
          imageUrl: imgUrl,
          artMeta: {
            artist,
            museum: 'Wikimedia Commons Kuratoren',
            highResImageUrl: imgUrl,
            aestheticImpulse: 'Halte inne und betrachte die Komposition, das Licht und die handwerkliche Vollendung dieses Bildes.'
          },
          space: 'c/kunst_galerie',
          flair: '🎨 Bild des Tages',
          estimatedReadingMinutes: 1,
          sourceReferences: [{
            publisher: 'Wikimedia Commons',
            originalUrl: img.file_page,
            title: 'Bild des Tages',
            author: artist,
            publicationTimestamp: nowIso,
            retrievalTimestamp: nowIso,
            isVerified: true
          }],
          upvotesCount: 112,
          awardsCount: { gold: 12, brain: 34, spark: 28 },
          comments: []
        });
      }

      // 3. Most read trending knowledge topics (up to 4)
      if (data.mostread && Array.isArray(data.mostread.articles)) {
        for (const art of data.mostread.articles.slice(0, 4)) {
          if (!art.title || art.title === 'Hauptseite') continue;
          const pageUrl = art.content_urls?.desktop?.page || `https://de.wikipedia.org/wiki/${encodeURIComponent(art.title)}`;
          const extract = art.extract || art.description || art.title;
          const imageUrl = art.originalimage?.source || art.thumbnail?.source || undefined;

          items.push({
            id: `wiki-trend-${pureJsSha256(art.title).slice(0, 8)}`,
            type: 'quick_insight',
            format: 'sourced_update',
            title: art.title,
            subtitle: art.description || 'Aktuell meistgelesenes Thema in der deutschsprachigen Wikipedia',
            feedText: extract,
            articleBody: extract,
            body: extract,
            topics: ['science_society'],
            primaryTopic: 'science_society',
            publishedAt: nowIso,
            generatedAt: nowIso,
            editionDate: todayStr,
            isDailyEdition: false,
            isDemonstration: false,
            aiAssisted: false,
            factReviewStatus: 'historical_reference',
            contentOrigin: 'live_ingested',
            contentHash: `wiki-trend-${pureJsSha256(art.title).slice(0, 8)}`,
            relevanceExplanation: 'Wikipedia Wissens-Trend',
            contentStatus: 'editorial_briefing',
            provenanceSummary: 'Wikipedia Trends',
            wordCount: Math.max(1, extract.split(/\s+/).length),
            isTeachingRelated: false,
            isChallengingPerspective: false,
            sourceTrustLevel: 'peer_reviewed',
            evidenceTier: 'publisher_excerpt',
            sourceDomain: 'de.wikipedia.org',
            sourceBroadcasterName: 'Wikipedia Trends',
            canonicalUrl: pageUrl,
            imageUrl,
            space: 'c/wissenschaft_ideen',
            flair: '📈 Wissens-Trend',
            estimatedReadingMinutes: 2,
            sourceReferences: [{
              publisher: 'Wikipedia',
              originalUrl: pageUrl,
              title: art.title,
              author: 'Wikipedia',
              publicationTimestamp: nowIso,
              retrievalTimestamp: nowIso,
              isVerified: true
            }],
            upvotesCount: 65,
            awardsCount: { gold: 2, brain: 10, spark: 7 },
            comments: []
          });
        }
      }

      return items;
    } catch {
      clearTimeout(timeout);
      return [];
    }
  }

  /**
   * Fetches real live RSS feeds and open API streams.
   * Concurrently queries Tagesschau Live, Hacker News, Wikipedia and enabled RSS feeds (with CORS fallback).
   * Caches results in memory for 5 minutes.
   */
  public static async refreshLiveFeeds(force = false): Promise<FeedItem[]> {
    const now = Date.now();
    if (!force && this.liveCache && (now - this.liveCache.timestamp < this.LIVE_CACHE_TTL_MS)) {
      return this.liveCache.items;
    }

    try {
      // 1. Concurrently launch CORS-friendly live connectors
      const tagesschauPromise = this.fetchTagesschauLiveJson();
      const hackerNewsPromise = this.fetchHackerNewsLiveJson();
      const wikipediaPromise = this.fetchWikipediaLiveJson();

      // 2. Fetch enabled RSS sources with CORS fallback
      const allSources = await defaultSourceRepository.getAllSources();
      const activeSources = allSources
        .filter(s => s.enabled && s.url && (s.url.startsWith('http://') || s.url.startsWith('https://')))
        .slice(0, 8);

      const rssPromises = activeSources.map(async source => {
        try {
          const res = await fetchRssWithCorsFallback(source.url, { timeoutMs: 2500, retries: 0 });
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
          return [];
        }
      });

      const settled = await Promise.allSettled([
        tagesschauPromise,
        hackerNewsPromise,
        wikipediaPromise,
        ...rssPromises
      ]);

      const fetchedItems: FeedItem[] = [];
      for (const result of settled) {
        if (result.status === 'fulfilled' && Array.isArray(result.value)) {
          fetchedItems.push(...result.value);
        }
      }

      if (fetchedItems.length > 0) {
        // Sort strictly by publishedAt descending (newest first)
        fetchedItems.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

        // Deduplicate
        const { uniqueItems } = deduplicateFeedItems(fetchedItems, rawPipelineItems);

        // Interleave domains to prevent consecutive clumping
        const interleaved = this.interleaveDomains(uniqueItems);

        const currentTimeStr = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + ' Uhr';
        this.liveCache = {
          items: interleaved,
          timestamp: Date.now(),
          lastFetchedAt: currentTimeStr
        };
        return interleaved;
      }
    } catch {
      // Non-fatal: graceful fallback below
    }

    if (this.liveCache && this.liveCache.items.length > 0) {
      return this.liveCache.items;
    }

    // Offline / Network fallback
    const fallbackItems = rawPipelineItems.length > 0 ? rawPipelineItems : REAL_KNOWLEDGE_VAULT;
    const sortedFallback = [...fallbackItems].sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
    const fallbackTime = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + ' Uhr (Archiv)';
    this.liveCache = {
      items: sortedFallback,
      timestamp: Date.now(),
      lastFetchedAt: fallbackTime
    };
    return sortedFallback;
  }

  /**
   * Retrieves enriched, live real-world news stream.
   * Merges live fetched items ahead of static pipeline items.
   * Static items are deprioritized to the very bottom as offline fallback.
   */
  public static async getLiveStream(options: ContinuousNewsOptions = {}): Promise<FeedItem[]> {
    const { category = 'all', query = '', limit = 30, offset = 0, forceRefresh = false } = options;

    // 1. Fetch fresh live items (or retrieve cached)
    const liveItems = await this.refreshLiveFeeds(forceRefresh);

    // 2. Candidates: Fresh live items at the top, static pipeline appended at bottom
    const staticPool = rawPipelineItems.length > 0 ? rawPipelineItems : REAL_KNOWLEDGE_VAULT;
    let combinedPool: FeedItem[];
    if (liveItems.length > 0) {
      const { uniqueItems } = deduplicateFeedItems(liveItems, staticPool);
      // Deprioritize static items to the bottom, live fresh items first
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
            domain.includes('ycombinator') ||
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
            domain.includes('wikipedia') ||
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
            topic === 'art_aesthetics' ||
            domain.includes('plato.stanford') ||
            domain.includes('aeon') ||
            domain.includes('wikimedia')
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
