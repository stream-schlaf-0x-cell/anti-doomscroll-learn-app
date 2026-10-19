import { FeedItem, FeedItemSchema, TOPIC_SPACE_MAP, TopicTag } from '../domain/types';
import { REAL_KNOWLEDGE_VAULT, EVERGREEN_INTERNET_CLASSICS } from './realKnowledgeVault';
import { VERIFIED_FEED_SOURCES } from '../ingestion/sources';
import { fetchAllFeeds } from '../ingestion/feedFetcher';
import { normalizeFeedEntry } from '../ingestion/normalizer';
import { appStorage } from './storage';
import { defaultSourceRepository } from './sourceRepository';
import { enrichItemWithInstantResearch } from '../synthesis/backgroundResearchPipeline';
import { defaultSnapshotLoader } from '../feed/SnapshotLoader';
import { parseSnapshotPayload } from '../feed/snapshotPayload';
import { getSourceKind } from '../ingestion/sourceHealth';
import { classifyTopicDeterministically } from '../enrichment/batchEnricher';

let staticPipelineItems: FeedItem[] = [];
if (typeof process !== 'undefined' && process.versions?.node) {
  try {
    const fsMod = eval('require')('fs');
    const pathMod = eval('require')('path');
    const pipelinePath = pathMod.resolve(__dirname, 'pipeline-output.json');
    if (fsMod.existsSync(pipelinePath)) {
      const loaded = JSON.parse(fsMod.readFileSync(pipelinePath, 'utf8'));
      if (Array.isArray(loaded)) {
        staticPipelineItems = loaded as FeedItem[];
      } else {
        staticPipelineItems = REAL_KNOWLEDGE_VAULT;
      }
    } else {
      staticPipelineItems = REAL_KNOWLEDGE_VAULT;
    }
  } catch {
    staticPipelineItems = REAL_KNOWLEDGE_VAULT;
  }
} else {
  staticPipelineItems = REAL_KNOWLEDGE_VAULT;
}

export type NewsHubFilterCategory = 'all' | 'oerr' | 'tech' | 'science' | 'didactic' | 'culture';

export type { SnapshotPayload as PublicFeedSnapshot } from '../feed/snapshotPayload';
const PUBLIC_SNAPSHOT_CACHE_KEY = '@atem:public_feed_snapshot:v1';

export type NewsProviderId = 'tagesschau' | 'hackernews' | 'wikinews' | 'snapshot' | 'rss';

export interface NewsStatusInfo {
  lastFetchTimeFormatted: string;
  fetchStatus: 'live' | 'snapshot' | 'cached' | 'offline';
  totalItems: number;
  snapshotAgeLabel: string;
  reachableSourcesCount: number;
  totalSourcesCount: number;
  statusLabel: string;
}

export interface LiveNewsUpdateEvent {
  items: FeedItem[];
  providerId: NewsProviderId;
  newItemsCount: number;
  statusInfo: NewsStatusInfo;
}

export type LiveNewsSubscriber = (event: LiveNewsUpdateEvent) => void;

export function mapTagesschauRessortToTopic(ressort: string, title = '', content = ''): TopicTag {
  const r = (ressort || '').toLowerCase();
  if (r.includes('wirtschaft') || r.includes('finanzen') || r.includes('unternehmen') || r.includes('boerse')) {
    return 'opportunities_growth';
  }
  if (r.includes('wissen') || r.includes('forschung') || r.includes('technologie') || r.includes('digital')) {
    return 'science_society';
  }
  if (r.includes('kultur') || r.includes('kunst') || r.includes('literatur') || r.includes('film')) {
    return 'art_aesthetics';
  }
  if (r.includes('sport') || r.includes('gesundheit') || r.includes('medizin')) {
    return 'health_biohacking';
  }
  if (r.includes('inland') || r.includes('politik') || r.includes('ausland') || r.includes('investigativ')) {
    return 'philosophy_ethics';
  }
  return classifyTopicDeterministically(title, content, 'science_society');
}

/**
 * ContinuousLiveNewsService
 *
 * Provides live news and public snapshot synchronization across Web & iOS:
 * 1. Public Feed Snapshot (`./feed-snapshot.json`) updated multiple times daily via GitHub Actions,
 *    cached locally in AtemStorage with honest offline fallback to `pipeline-output.json`.
 * 2. Native CORS-open live APIs (ARD Tagesschau v2, Hacker News Algolia, Wikipedia News, OpenAlex).
 * 3. Direct RSS fetching on native iOS / Node.
 * 4. Strict Provenance: Zero fake upvotes, zero fake awards, zero simulated comments,
 *    encyclopedias labeled as encyclopedia, and artworks excluded from Live News.
 */
export class ContinuousLiveNewsService {
  private static liveIngestedItems: FeedItem[] = [];
  private static lastFetchTimestamp: number = 0;
  private static lastDirectFetchTimestamp: number = 0;
  private static lastCheckAttemptTimestamp: number = 0;
  private static lastRefreshNewCount: number = 0;
  private static reachableLiveSources: Set<NewsProviderId> = new Set();
  private static activeRefreshPromise: Promise<FeedItem[]> | null = null;
  private static listeners = new Set<LiveNewsSubscriber>();
  private static lastFormattedUpdate: string = 'Offline · gespeicherte Inhalte';
  private static snapshotStatus: 'live_snapshot' | 'stale_snapshot' | 'cached_snapshot' | 'offline_fallback' = 'offline_fallback';
  private static readonly CACHE_TTL_MS = 1000 * 60 * 5; // 5 minutes

  public static getLastRefreshNewCount(): number {
    return this.lastRefreshNewCount;
  }

  public static subscribe(listener: LiveNewsSubscriber): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private static notifySubscribers(event: LiveNewsUpdateEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.warn('Live news listener error:', err);
      }
    }
  }

  public static resetStateForTesting(options?: {
    items?: FeedItem[];
    snapshotStatus?: 'live_snapshot' | 'stale_snapshot' | 'cached_snapshot' | 'offline_fallback';
    lastFetchTimestamp?: number;
    lastDirectFetchTimestamp?: number;
    reachableLiveSources?: NewsProviderId[];
  }): void {
    this.liveIngestedItems = options?.items ? [...options.items] : [];
    this.snapshotStatus = options?.snapshotStatus ?? 'offline_fallback';
    this.lastFetchTimestamp = options?.lastFetchTimestamp ?? 0;
    this.lastDirectFetchTimestamp = options?.lastDirectFetchTimestamp ?? 0;
    this.reachableLiveSources = new Set(options?.reachableLiveSources ?? []);
    this.activeRefreshPromise = null;
    this.lastFormattedUpdate = 'Offline · gespeicherte Inhalte';
  }

  public static getLastUpdatedTime(): string {
    return this.lastFormattedUpdate;
  }

  public static getSnapshotStatus(): 'live_snapshot' | 'stale_snapshot' | 'cached_snapshot' | 'offline_fallback' {
    return this.snapshotStatus;
  }

  private static updateTimestampLabel(customIso?: string): void {
    const date = customIso ? new Date(customIso) : new Date();
    if (!Number.isFinite(date.getTime())) {
      this.lastFormattedUpdate = 'Ausgabedatum unbekannt';
      return;
    }
    this.lastFormattedUpdate = `${date.toLocaleDateString('de-DE')}, ${date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`;
  }

  private static fetchWithTimeout(url: string, timeoutMs = 3500): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json'
      }
    }).finally(() => {
      clearTimeout(timeoutId);
    });
  }

  /**
   * Sanitizes any item from snapshot or static fallback to guarantee:
   * - 0 internal upvotes & 0 awards
   * - No simulated fake comments
   * - No generic Unsplash stock photo on text articles
   */
  public static sanitizeProvenanceItem(item: FeedItem): FeedItem {
    const isStockUnsplash = Boolean(
      item.imageUrl &&
      item.imageUrl.includes('images.unsplash.com') &&
      item.format !== 'art_showcase'
    );
    const cleanImageUrl = isStockUnsplash ? undefined : item.imageUrl;
    const isWiki = (item.sourceDomain || '').includes('wikipedia.org');
    const safeFormat = item.format === 'art_showcase' && !cleanImageUrl ? 'sourced_update' : item.format;

    return {
      ...item,
      format: safeFormat,
      space: item.space || TOPIC_SPACE_MAP[item.primaryTopic].space,
      imageUrl: cleanImageUrl,
      hasAuthenticImage: Boolean(cleanImageUrl),
      upvotesCount: 0,
      awardsCount: { gold: 0, brain: 0, spark: 0 },
      comments: [],
      sourceTrustLevel: isWiki ? 'encyclopedia' : item.sourceTrustLevel,
      factReviewStatus: isWiki ? 'encyclopedia_entry' : item.factReviewStatus
    };
  }

  /**
   * Loads the public feed snapshot (`./feed-snapshot.json`) generated by GitHub Actions
   * with local storage caching and honest offline fallback.
   */
  public static async loadPublicFeedSnapshot(): Promise<FeedItem[]> {
    const remoteUrl = typeof window !== 'undefined' && window.location?.href
      ? new URL('./feed-snapshot.json', window.location.href).toString() : undefined;
    try {
      const result = await defaultSnapshotLoader.loadSnapshot(remoteUrl, 3500);
      if (result.success && result.items.length) {
        const age = result.generatedAt ? Date.now() - Date.parse(result.generatedAt) : Infinity;
        this.snapshotStatus = age >= -5 * 60_000 && age <= 24 * 60 * 60_000 ? 'live_snapshot' : 'stale_snapshot';
        if (result.generatedAt) this.updateTimestampLabel(result.generatedAt);
        else this.lastFormattedUpdate = 'Ausgabedatum unbekannt';
        try {
          await appStorage.setItem(PUBLIC_SNAPSHOT_CACHE_KEY, JSON.stringify({
            generatedAt: result.generatedAt, items: result.items, sourceHealth: result.sourceHealth,
            totalCandidateSources: result.totalCandidateSources
          }));
        } catch { /* Reading stays available when storage is full. */ }
        return result.items.map(item => this.sanitizeProvenanceItem(item));
      }
    } catch { /* Try the persisted snapshot. */ }

    try {
      const cachedRaw = await appStorage.getItem(PUBLIC_SNAPSHOT_CACHE_KEY);
      const snapshot = cachedRaw ? parseSnapshotPayload(JSON.parse(cachedRaw)) : null;
      if (snapshot) {
        this.snapshotStatus = 'cached_snapshot';
        if (snapshot.generatedAt) {
          this.updateTimestampLabel(snapshot.generatedAt);
          this.lastFormattedUpdate = `Offline · Ausgabe ${this.lastFormattedUpdate}`;
        } else this.lastFormattedUpdate = 'Offline · Ausgabedatum unbekannt';
        await defaultSourceRepository.recordSnapshotHealth(snapshot.sourceHealth, snapshot.generatedAt);
        return snapshot.items.map(item => this.sanitizeProvenanceItem(item));
      }
    } catch { /* Try bundled offline content. */ }

    this.snapshotStatus = 'offline_fallback';
    this.lastFormattedUpdate = 'Offline · gespeicherte Inhalte';
    return this.validatedItems(staticPipelineItems);
  }

  private static validatedItems(items: FeedItem[]): FeedItem[] {
    const valid: FeedItem[] = [];
    for (const item of items) {
      const parsed = FeedItemSchema.safeParse(item);
      if (parsed.success) valid.push(this.sanitizeProvenanceItem(parsed.data));
    }
    return valid;
  }

  /**
   * 1. Native CORS-Open Connector: Tagesschau API v2 (`https://www.tagesschau.de/api2u/news/`)
   */
  public static async fetchTagesschauLiveJson(limit = 40): Promise<FeedItem[]> {
    try {
      const response = await this.fetchWithTimeout('https://www.tagesschau.de/api2u/news/', 3500);
      if (!response.ok) return [];
      const data = await response.json();
      const newsList = Array.isArray(data?.news) ? data.news.slice(0, limit) : [];
      const items: FeedItem[] = [];
      const nowIso = new Date().toISOString();

      for (const entry of newsList) {
        if (!entry.title || !entry.externalId) continue;

        const firstSentence = (entry.firstSentence || '').trim();
        let bodyParagraphs = '';
        if (Array.isArray(entry.content)) {
          bodyParagraphs = entry.content
            .filter((c: any) => c.type === 'text' && typeof c.value === 'string')
            .map((c: any) => c.value.replace(/<[^>]*>/g, '').trim())
            .filter(Boolean)
            .join('\n\n');
        }

        const effectiveBody = bodyParagraphs.length > firstSentence.length
          ? bodyParagraphs
          : (firstSentence || `${entry.title}. Aktuelle Meldung der ARD-Tagesschau.`);

        const subtitle = firstSentence && firstSentence !== effectiveBody
          ? firstSentence
          : `ARD Tagesschau (${entry.ressort ? entry.ressort.toUpperCase() : 'AKTUELL'})`;

        const feedText = effectiveBody.startsWith(subtitle) && effectiveBody.length > subtitle.length + 20
          ? effectiveBody.slice(subtitle.length).trim()
          : effectiveBody;

        const imageVariants = entry.teaserImage?.imageVariants;
        const imageUrl =
          imageVariants?.['16x9-960'] ||
          imageVariants?.['16x9-512'] ||
          imageVariants?.['16x9-640'] ||
          undefined;

        const ressort = (entry.ressort || '').toLowerCase();
        const primaryTopic: TopicTag = mapTagesschauRessortToTopic(ressort, entry.title, effectiveBody);
        const secondaryTopic: TopicTag = primaryTopic === 'philosophy_ethics' ? 'science_society' : 'philosophy_ethics';
        const publishedAt = entry.date || nowIso;
        const originalUrl = entry.detailsweb || entry.shareURL || 'https://www.tagesschau.de';

        items.push({
          id: `live-tagesschau-${entry.externalId}`,
          type: 'briefing',
          format: 'sourced_update',
          title: entry.title,
          subtitle,
          feedText: feedText.slice(0, 480),
          articleBody: effectiveBody,
          body: feedText.slice(0, 480),
          topics: [primaryTopic, secondaryTopic],
          primaryTopic,
          sourceReferences: [
            {
              title: entry.title,
              publisher: 'ARD Tagesschau',
              author: 'ARD-aktuell Redaktion',
              originalUrl,
              publicationTimestamp: publishedAt,
              retrievalTimestamp: nowIso,
              isVerified: true
            }
          ],
          publishedAt,
          generatedAt: nowIso,
          estimatedReadingMinutes: Math.max(1, Math.ceil(effectiveBody.split(/\s+/).length / 180)),
          relevanceExplanation: 'Verifizierte öffentlich-rechtliche Meldung der ARD Tagesschau.',
          contentStatus: 'verified_fact',
          isDailyEdition: true,
          editionDate: publishedAt.slice(0, 10),
          isTeachingRelated: false,
          isChallengingPerspective: false,
          isDemonstration: false,
          aiAssisted: false,
          factReviewStatus: 'public_news',
          provenanceSummary: 'Öffentlich-rechtliche Redaktion: ARD Tagesschau API v2.',
          wordCount: Math.max(30, effectiveBody.split(/\s+/).length),
          evidenceTier: effectiveBody.length >= 400 ? 'permitted_full_text' : 'publisher_excerpt',
          contentOrigin: 'live_ingested',
          contentHash: `ts-${entry.externalId}`,
          canonicalUrl: originalUrl,
          imageUrl,
          hasAuthenticImage: Boolean(imageUrl),
          space: 'c/serendipity',
          flair: '🛡 Öffentlich-Rechtlich',
          keyInsight: firstSentence || entry.title,
          upvotesCount: 0,
          awardsCount: { gold: 0, brain: 0, spark: 0 },
          sourceTrustLevel: 'public_broadcaster',
          sourceDomain: 'tagesschau.de',
          sourceBroadcasterName: 'ARD Tagesschau',
          comments: []
        });
      }

      return items;
    } catch {
      return [];
    }
  }

  /**
   * 2. Native CORS-Open Connector: Hacker News Algolia Live Stream
   */
  public static async fetchHackerNewsLiveJson(limit = 25): Promise<FeedItem[]> {
    try {
      const response = await this.fetchWithTimeout(
        `https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=${limit}`,
        3500
      );
      if (!response.ok) return [];
      const data = await response.json();
      const hits = Array.isArray(data?.hits) ? data.hits : [];
      const items: FeedItem[] = [];
      const nowIso = new Date().toISOString();

      for (const hit of hits) {
        if (!hit.title || !hit.objectID) continue;
        const hnUrl = `https://news.ycombinator.com/item?id=${hit.objectID}`;
        const targetUrl = hit.url || hnUrl;
        let domain = 'news.ycombinator.com';
        try {
          if (hit.url) {
            domain = new URL(hit.url).hostname.replace(/^www\./, '');
          }
        } catch {
          domain = 'news.ycombinator.com';
        }

        const publishedAt = hit.created_at || nowIso;
        const points = typeof hit.points === 'number' ? hit.points : 0;
        const commentsCount = typeof hit.num_comments === 'number' ? hit.num_comments : 0;

        const subtitle = `${domain} • ${points} HN-Punkte • ${commentsCount} Kommentare`;
        const feedText = `Aktuelle Fachdiskussion auf Hacker News (Primärquelle: ${domain}). Von der Entwickler- und Forschungs-Community mit ${points} Punkten gewichtet.`;
        const articleBody = `${hit.title}\n\nQuelle: ${domain} (${targetUrl})\nHacker-News-Debatte (${points} Punkte, ${commentsCount} Kommentare): ${hnUrl}`;

        items.push({
          id: `live-hn-${hit.objectID}`,
          type: 'quick_insight',
          format: 'concise_insight',
          title: hit.title,
          subtitle,
          feedText,
          articleBody,
          body: feedText,
          topics: ['ai_apple', 'science_society'],
          primaryTopic: 'ai_apple',
          sourceReferences: [
            {
              title: hit.title,
              publisher: `${domain} (via Hacker News)`,
              author: hit.author || domain,
              originalUrl: targetUrl,
              publicationTimestamp: publishedAt,
              retrievalTimestamp: nowIso,
              isVerified: true
            }
          ],
          publishedAt,
          generatedAt: nowIso,
          estimatedReadingMinutes: 1,
          relevanceExplanation: `Echtzeit-Signal aus der internationalen Tech- & Wissenschafts-Community (${points} HN-Punkte).`,
          contentStatus: 'editorial_briefing',
          isDailyEdition: true,
          editionDate: publishedAt.slice(0, 10),
          isTeachingRelated: false,
          isChallengingPerspective: false,
          isDemonstration: false,
          aiAssisted: false,
          factReviewStatus: 'community_discussion',
          provenanceSummary: `Community-Fundstück (${domain}) via Hacker News Algolia API (${points} HN-Punkte).`,
          wordCount: 40,
          evidenceTier: 'metadata_only',
          contentOrigin: 'live_ingested',
          contentHash: `hn-live-${hit.objectID}`,
          canonicalUrl: targetUrl,
          hasAuthenticImage: false,
          space: 'c/acceleration',
          flair: '💬 HN-Community',
          keyInsight: `${points} HN-Punkte und ${commentsCount} Kommentare zur Quelle ${domain}.`,
          upvotesCount: 0,
          awardsCount: { gold: 0, brain: 0, spark: 0 },
          externalCommunityScore: {
            platform: 'HN',
            points,
            commentsCount,
            discussionUrl: hnUrl
          },
          sourceTrustLevel: 'community_curated',
          sourceDomain: domain,
          sourceBroadcasterName: `${domain} (HN)`,
          comments: []
        });
      }

      return items;
    } catch {
      return [];
    }
  }

  /**
   * 3. Native CORS-Open Connector: Wikipedia Current News (Excludes Featured Encyclopedia / Artworks from News)
   */
  public static async fetchWikipediaCurrentNewsJson(): Promise<FeedItem[]> {
    try {
      const now = new Date();
      const yyyy = now.getUTCFullYear().toString();
      const mm = (now.getUTCMonth() + 1).toString().padStart(2, '0');
      const dd = now.getUTCDate().toString().padStart(2, '0');
      const nowIso = now.toISOString();

      const response = await this.fetchWithTimeout(
        `https://de.wikipedia.org/api/rest_v1/feed/featured/${yyyy}/${mm}/${dd}`,
        3500
      );
      if (!response.ok) return [];
      const data = await response.json();
      const items: FeedItem[] = [];

      if (Array.isArray(data?.news)) {
        for (let i = 0; i < Math.min(3, data.news.length); i++) {
          const n = data.news[i];
          const primaryPage = n.links?.[0];
          const title = primaryPage?.normalizedtitle || primaryPage?.title || 'Aktuelles Zeitgeschehen';
          const cleanStory = (n.story || '').replace(/<[^>]*>/g, '').trim();
          if (!cleanStory) continue;

          const subtitle = `Wikipedia Aktuelles • Hintergrund & Kontext`;
          const feedText = cleanStory !== primaryPage?.extract && primaryPage?.extract
            ? `${cleanStory} — ${primaryPage.extract}`
            : cleanStory;
          const canonical = primaryPage?.content_urls?.desktop?.page || 'https://de.wikipedia.org';

          items.push({
            id: `live-wiki-news-${yyyy}${mm}${dd}-${i}`,
            type: 'quick_insight',
            format: 'concise_insight',
            title: `Hintergrund: ${title}`,
            subtitle,
            feedText: feedText.slice(0, 480),
            articleBody: `${cleanStory}\n\n${primaryPage?.extract || ''}`.trim(),
            body: feedText.slice(0, 480),
            topics: ['science_society'],
            primaryTopic: 'science_society',
            sourceReferences: [
              {
                title,
                publisher: 'Wikipedia Aktuelles (Enzyklopädie)',
                originalUrl: canonical,
                publicationTimestamp: `${yyyy}-${mm}-${dd}T06:00:00.000Z`,
                retrievalTimestamp: nowIso,
                isVerified: true
              }
            ],
            publishedAt: `${yyyy}-${mm}-${dd}T06:00:00.000Z`,
            generatedAt: nowIso,
            estimatedReadingMinutes: 2,
            relevanceExplanation: 'Enzyklopädischer Hintergrund zu aktuellen Weltereignissen.',
            contentStatus: 'editorial_briefing',
            isDailyEdition: true,
            editionDate: `${yyyy}-${mm}-${dd}`,
            isTeachingRelated: false,
            isChallengingPerspective: false,
            isDemonstration: false,
            aiAssisted: false,
            factReviewStatus: 'encyclopedia_entry',
            provenanceSummary: 'Enzyklopädische Einordnung aus Wikipedia Aktuelles (CC BY-SA 4.0).',
            wordCount: Math.max(30, feedText.split(/\s+/).length),
            evidenceTier: 'publisher_excerpt',
            contentOrigin: 'live_ingested',
            contentHash: `wiki-news-live-${yyyy}${mm}${dd}-${i}`,
            canonicalUrl: canonical,
            imageUrl: primaryPage?.thumbnail?.source,
            hasAuthenticImage: Boolean(primaryPage?.thumbnail?.source),
            space: 'c/serendipity',
            flair: '🏛 Enzyklopädie',
            keyInsight: cleanStory,
            upvotesCount: 0,
            awardsCount: { gold: 0, brain: 0, spark: 0 },
            sourceTrustLevel: 'encyclopedia',
            sourceDomain: 'de.wikipedia.org',
            sourceBroadcasterName: 'Wikipedia (Enzyklopädie)',
            comments: []
          });
        }
      }

      return items;
    } catch {
      return [];
    }
  }

  private static integrateProviderItems(incoming: FeedItem[], providerId: NewsProviderId): number {
    const valid = this.validatedItems(incoming);
    if (valid.length === 0) return 0;

    if (providerId !== 'snapshot') {
      this.lastDirectFetchTimestamp = Date.now();
      this.reachableLiveSources.add(providerId);
    }

    const seen = new Set<string>();
    for (const existing of this.liveIngestedItems) {
      seen.add(existing.canonicalUrl || existing.id);
    }

    let newCount = 0;
    const itemsToAdd: FeedItem[] = [];
    for (const item of valid) {
      const key = item.canonicalUrl || item.id;
      if (!seen.has(key)) {
        seen.add(key);
        itemsToAdd.push(item);
        newCount++;
      }
    }

    if (itemsToAdd.length > 0) {
      this.liveIngestedItems = [...itemsToAdd, ...this.liveIngestedItems];
    }
    this.lastFetchTimestamp = Date.now();
    if (providerId !== 'snapshot') {
      this.updateTimestampLabel();
    }

    this.notifySubscribers({
      items: [...this.liveIngestedItems],
      providerId,
      newItemsCount: newCount,
      statusInfo: this.getNewsStatusInfo()
    });

    return newCount;
  }

  /**
   * Fetches fresh live feeds progressively across CORS-open JSON APIs, Public Snapshot, and direct RSS on native/Node.
   * Fast sources (e.g. Tagesschau ~200ms) are immediately emitted via subscriptions without waiting for slower sources.
   * Concurrent requests are deduplicated in-flight.
   */
  public static refreshLiveFeeds(force = false): Promise<FeedItem[]> {
    if (this.activeRefreshPromise) {
      return this.activeRefreshPromise;
    }

    const now = Date.now();
    if (!force && this.liveIngestedItems.length > 0 && now - this.lastFetchTimestamp < this.CACHE_TTL_MS) {
      return Promise.resolve(this.liveIngestedItems);
    }

    this.activeRefreshPromise = (async () => {
      this.lastCheckAttemptTimestamp = Date.now();
      this.lastRefreshNewCount = 0;
      this.reachableLiveSources.clear();

      const tasks: Promise<any>[] = [
        this.fetchTagesschauLiveJson(40)
          .then(items => {
            const count = this.integrateProviderItems(items, 'tagesschau');
            this.lastRefreshNewCount += count;
            return count;
          })
          .catch(() => 0),
        this.fetchHackerNewsLiveJson(25)
          .then(items => {
            const count = this.integrateProviderItems(items, 'hackernews');
            this.lastRefreshNewCount += count;
            return count;
          })
          .catch(() => 0),
        this.fetchWikipediaCurrentNewsJson()
          .then(items => {
            const count = this.integrateProviderItems(items, 'wikinews');
            this.lastRefreshNewCount += count;
            return count;
          })
          .catch(() => 0),
        this.loadPublicFeedSnapshot()
          .then(items => {
            const count = this.integrateProviderItems(items, 'snapshot');
            this.lastRefreshNewCount += count;
            return count;
          })
          .catch(() => 0)
      ];

      const isWebBrowser = typeof window !== 'undefined' && typeof (window as any).document !== 'undefined';
      if (!isWebBrowser) {
        tasks.push(
          (async () => {
            try {
              const prioritySources = VERIFIED_FEED_SOURCES.filter(source => getSourceKind(source) === 'feed').slice(0, 12);
              const results = await fetchAllFeeds(prioritySources, 4, 3500);
              const today = new Date().toISOString().slice(0, 10);
              const rssItems: FeedItem[] = [];
              for (const res of results) {
                if (!res.success) continue;
                for (const entry of res.entries.slice(0, 3)) {
                  try {
                    rssItems.push(normalizeFeedEntry(entry, res.source, today));
                  } catch {
                    // Skip malformed entry
                  }
                }
              }
              const count = this.integrateProviderItems(rssItems, 'rss');
              this.lastRefreshNewCount += count;
              return count;
            } catch {
              return 0;
            }
          })()
        );
      }

      await Promise.allSettled(tasks);

      if (this.liveIngestedItems.length === 0) {
        this.snapshotStatus = 'offline_fallback';
        this.lastFormattedUpdate = 'Offline · gespeicherte Inhalte';
        return this.validatedItems(staticPipelineItems);
      }

      return this.liveIngestedItems;
    })().finally(() => {
      this.activeRefreshPromise = null;
    });

    return this.activeRefreshPromise;
  }

  /**
   * Interleaves items across publishers/domains so a single source never clumps consecutively.
   */
  private static interleaveByDomain(items: FeedItem[]): FeedItem[] {
    if (items.length <= 2) return items;

    const buckets = new Map<string, FeedItem[]>();
    for (const item of items) {
      const domain = (item.sourceDomain || item.sourceBroadcasterName || item.sourceReferences[0]?.publisher || 'unknown')
        .toLowerCase()
        .replace(/^www\./, '');
      if (!buckets.has(domain)) {
        buckets.set(domain, []);
      }
      buckets.get(domain)!.push(item);
    }

    const result: FeedItem[] = [];
    const domainKeys = Array.from(buckets.keys());
    let added = true;

    while (added) {
      added = false;
      for (const key of domainKeys) {
        const list = buckets.get(key)!;
        if (list.length > 0) {
          result.push(list.shift()!);
          added = true;
        }
      }
    }

    return result;
  }

  /**
   * Scores an item for the 7-Day Rolling Quality Window so substantive essays,
   * studies, and deep journalism from the last 7 days outrank thin minute-old wire noise.
   */
  public static computeRollingWindowQualityScore(
    item: FeedItem,
    windowMode: '7d_quality' | '48h_fresh' | 'chronological' = '7d_quality',
    nowMs: number = Date.now()
  ): number {
    const pubMs = new Date(item.publishedAt).getTime() || nowMs;
    const ageHours = Math.max(0, (nowMs - pubMs) / (1000 * 60 * 60));

    if (windowMode === 'chronological') {
      return pubMs;
    }

    let score = 0;

    if (windowMode === '48h_fresh') {
      if (ageHours <= 48) {
        score += 65 - (ageHours / 48) * 20;
      } else if (ageHours <= 168) {
        score += 25 - ((ageHours - 48) / 120) * 15;
      } else {
        score += 5;
      }
    } else {
      // '7d_quality': 7-Day Rolling Quality Window (168 hours)
      // Treats the entire past 7 days as an active quality pool rather than rewarding raw minute-by-minute recency
      if (ageHours <= 168) {
        score += 50;
        // Sweet spot: 3 hours to 120 hours (5 days) old where full articles & discussions have matured
        if (ageHours >= 2 && ageHours <= 120) {
          score += 12;
        }
      } else if (ageHours <= 336) {
        score += 22;
      } else {
        score += 8;
      }
    }

    // Substance & Depth signals
    const words = item.wordCount || item.feedText.split(/\s+/).length;
    if (words >= 220) score += 20;
    else if (words >= 120) score += 14;
    else if (words < 45 && !item.externalCommunityScore?.points) score -= 18;

    if (item.feedText && item.feedText.length >= 160) score += 10;
    if (item.evidenceTier === 'multiple_sources' || item.evidenceTier === 'permitted_full_text') score += 14;
    if (item.sourceTrustLevel === 'peer_reviewed') score += 16;
    else if (item.sourceTrustLevel === 'public_broadcaster') score += 12;

    const hnPoints = item.externalCommunityScore?.points;
    if (typeof hnPoints === 'number' && hnPoints >= 40) {
      score += Math.min(16, Math.round(Math.log10(hnPoints) * 6));
    }

    if (item.format === 'long_invitation' || item.format === 'surprising_connection' || item.format === 'perspective_disagreement') {
      score += 8;
    }

    return score;
  }

  /**
   * Returns a 7-day quality-ranked, domain-interleaved stream of live news & research items.
   * Explicitly excludes artworks (`art_showcase` / `museum_collection`) from Live News.
   */
  public static async getLiveStream(options?: {
    category?: NewsHubFilterCategory;
    query?: string;
    limit?: number;
    forceRefresh?: boolean;
    windowMode?: '7d_quality' | '48h_fresh' | 'chronological';
    topic?: TopicTag;
  }): Promise<FeedItem[]> {
    const category = options?.category || 'all';
    const query = (options?.query || '').toLowerCase().trim();
    const limit = options?.limit || 80;
    const windowMode = options?.windowMode || '7d_quality';

    const liveItems = await this.refreshLiveFeeds(Boolean(options?.forceRefresh));

    let disabledDomains: string[] = [];
    let disabledNames: string[] = [];
    try {
      disabledDomains = await defaultSourceRepository.getDisabledDomains();
      disabledNames = await defaultSourceRepository.getDisabledNames();
    } catch {
      disabledDomains = [];
      disabledNames = [];
    }

    const refreshedStatic = this.validatedItems(staticPipelineItems);
    const combined = liveItems.length > 0 ? liveItems : refreshedStatic;

    const seen = new Set<string>();
    let unique = combined.filter(item => {
      // Artworks, philosophy vault and museum showcases are NOT live news!
      if (
        item.format === 'art_showcase' ||
        item.primaryTopic === 'art_aesthetics' ||
        item.sourceTrustLevel === 'museum_collection' ||
        item.isEvergreenGem
      ) {
        return false;
      }

      // Filter out disabled sources
      if (disabledDomains.length > 0 || disabledNames.length > 0) {
        const domain = (item.sourceDomain || '').toLowerCase();
        const publisher = (item.sourceReferences?.[0]?.publisher || '').toLowerCase();
        const broadcaster = (item.sourceBroadcasterName || '').toLowerCase();
        const isDomainDisabled = disabledDomains.some(d => domain.includes(d) || publisher.includes(d) || broadcaster.includes(d));
        const isNameDisabled = disabledNames.some(n => {
          const cleanName = n.split('(')[0].trim().toLowerCase();
          return cleanName.length > 2 && (publisher.includes(cleanName) || broadcaster.includes(cleanName) || domain.includes(cleanName));
        });
        if (isDomainDisabled || isNameDisabled) {
          return false;
        }
      }

      const key = item.canonicalUrl || item.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    if (options?.topic) {
      unique = unique.filter(
        item => item.primaryTopic === options.topic || item.topics.includes(options.topic!)
      );
    }

    const nowMs = Date.now();

    if (windowMode === 'chronological' || windowMode === '48h_fresh') {
      // STRICT CHRONOLOGICAL: No domain-interleaving; newest publication time stays #1!
      const maxAgeHours = windowMode === '48h_fresh' ? 48 : 24;
      let recent = unique.filter(item => {
        const pubMs = new Date(item.publishedAt).getTime();
        if (!pubMs || isNaN(pubMs)) return false;
        const ageHours = (nowMs - pubMs) / (1000 * 60 * 60);
        return ageHours >= -0.5 && ageHours <= maxAgeHours;
      });

      // When the 24h window has 0 items (e.g. public snapshot is 27h+ old), gracefully expand to 48h
      if (recent.length === 0 && maxAgeHours < 48) {
        recent = unique.filter(item => {
          const pubMs = new Date(item.publishedAt).getTime();
          if (!pubMs || isNaN(pubMs)) return false;
          const ageHours = (nowMs - pubMs) / (1000 * 60 * 60);
          return ageHours >= -0.5 && ageHours <= 48;
        });
      }

      // If still empty, fall back to recent valid items so the ticker never shows an empty void
      unique = recent.length > 0 ? recent : unique.slice(0, 30);

      unique.sort((a, b) => {
        const timeA = new Date(a.publishedAt).getTime() || 0;
        const timeB = new Date(b.publishedAt).getTime() || 0;
        return timeB - timeA;
      });
    } else {
      // 7d_quality mode: Quality score + publisher diversity interleave
      unique.sort((a, b) => {
        const scoreA = this.computeRollingWindowQualityScore(a, windowMode, nowMs);
        const scoreB = this.computeRollingWindowQualityScore(b, windowMode, nowMs);
        if (scoreB !== scoreA) return scoreB - scoreA;
        const timeA = new Date(a.publishedAt).getTime() || 0;
        const timeB = new Date(b.publishedAt).getTime() || 0;
        return timeB - timeA;
      });
      unique = this.interleaveByDomain(unique);
    }

    if (category !== 'all') {
      unique = unique.filter(item => {
        if (category === 'oerr') {
          const pub = (item.sourceReferences?.[0]?.publisher || '').toLowerCase();
          const dom = (item.sourceDomain || '').toLowerCase();
          return pub.includes('tagesschau') ||
                 pub.includes('deutschlandfunk') ||
                 pub.includes('zdf') ||
                 dom.includes('tagesschau') ||
                 dom.includes('deutschlandfunk') ||
                 dom.includes('zdf');
        }
        if (category === 'tech') {
          return item.primaryTopic === 'ai_apple' || item.topics.includes('ai_apple');
        }
        if (category === 'science') {
          return item.primaryTopic === 'science_society' || item.primaryTopic === 'health_biohacking';
        }
        if (category === 'didactic') {
          return item.isTeachingRelated || item.primaryTopic === 'german_didactics' || item.topics.includes('german_didactics');
        }
        if (category === 'culture') {
          return item.primaryTopic === 'philosophy_ethics' ||
                 item.primaryTopic === 'book_mastery' ||
                 item.primaryTopic === 'sound_synthesis' ||
                 item.primaryTopic === 'contemplation_mind';
        }
        return true;
      });
    }

    if (query.length > 0) {
      unique = unique.filter(item =>
        item.title.toLowerCase().includes(query) ||
        item.subtitle.toLowerCase().includes(query) ||
        item.feedText.toLowerCase().includes(query) ||
        item.topics.some(t => t.toLowerCase().includes(query)) ||
        (item.sourceBroadcasterName && item.sourceBroadcasterName.toLowerCase().includes(query)) ||
        (item.sourceReferences[0]?.publisher && item.sourceReferences[0].publisher.toLowerCase().includes(query))
      );
    }

    return unique.slice(0, limit).map(item => enrichItemWithInstantResearch(item));
  }

  /**
   * Returns timeless Evergreen Classics & Internet Gems.
   */
  public static getEvergreenClassics(): FeedItem[] {
    return EVERGREEN_INTERNET_CLASSICS.map(i => enrichItemWithInstantResearch(this.sanitizeProvenanceItem(i)));
  }

  /**
   * Transparent provenance status for the News Hub header.
   */
  public static getNewsStatusInfo(): NewsStatusInfo {
    const now = Date.now();
    const ageDirectMs = now - this.lastDirectFetchTimestamp;
    const ageAttemptMs = now - this.lastFetchTimestamp;
    const totalAttempted = 3; // Tagesschau, HN, Wikipedia (+ Snapshot)

    let fetchStatus: 'live' | 'snapshot' | 'cached' | 'offline' = 'live';
    let statusLabel = '';

    if (this.reachableLiveSources.size > 0 && ageDirectMs < this.CACHE_TTL_MS) {
      fetchStatus = 'live';
      const mins = Math.max(0, Math.round(ageDirectMs / 60000));
      statusLabel = mins === 0
        ? `Live geprüft · ${this.reachableLiveSources.size} Direktquellen aktiv`
        : `Vor ${mins} Min. live geprüft · ${this.reachableLiveSources.size} Direktquellen aktiv`;
    } else if (this.snapshotStatus === 'live_snapshot' || this.snapshotStatus === 'stale_snapshot' || this.snapshotStatus === 'cached_snapshot') {
      fetchStatus = 'snapshot';
      statusLabel = this.snapshotStatus === 'live_snapshot'
        ? `Gespeicherter Stand (Snapshot) · ${this.lastFormattedUpdate}`
        : `Älterer Stand (Snapshot) · ${this.lastFormattedUpdate}`;
    } else if (this.liveIngestedItems.length > 0 && ageAttemptMs < this.CACHE_TTL_MS * 4) {
      fetchStatus = 'cached';
      const mins = Math.max(1, Math.round(ageAttemptMs / 60000));
      statusLabel = `Aus Zwischenspeicher · Zuletzt vor ${mins} Min. geprüft`;
    } else {
      fetchStatus = 'offline';
      statusLabel = 'Offline · Gespeicherte Inhalte';
    }

    const lastTime = this.lastFetchTimestamp > 0
      ? new Date(this.lastFetchTimestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
      : 'Noch nicht geprüft';

    return {
      lastFetchTimeFormatted: lastTime,
      fetchStatus,
      totalItems: this.liveIngestedItems.length,
      snapshotAgeLabel: this.lastFormattedUpdate,
      reachableSourcesCount: this.reachableLiveSources.size,
      totalSourcesCount: totalAttempted,
      statusLabel
    };
  }

  public static getOlderAvailableCount(currentCount: number): number {
    const total = this.liveIngestedItems.length + staticPipelineItems.length;
    return Math.max(0, total - currentCount);
  }

  public static getLastFetchTimestamp(): number {
    return this.lastFetchTimestamp;
  }
}
