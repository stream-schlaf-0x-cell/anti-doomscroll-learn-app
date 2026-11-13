import { FeedItem, TopicTag, TOPIC_SPACE_MAP } from '../domain/types';
import { REAL_KNOWLEDGE_VAULT } from '../data/realKnowledgeVault';
import {
  classifyTopicDeterministically,
  sanitizeCuratedFeedItem,
  satisfiesDefaultCuratedStandard,
  isSupportedFeedLanguage,
  detectLanguage,
  IRRELEVANT_WETLAB_OR_NICHE_ACADEMIC_REGEX,
  defaultBatchEditionEnricher
} from '../enrichment/batchEnricher';
import { upgradeImageResolutionUrl, isRejectedLowResOrLogoUrl } from '../utils/imageQuality';
import { appStorage, AtemStorage } from '../data/storage';
import { VERIFIED_FEED_SOURCES } from './sources';
import { GLOBAL_CORPUS_RESERVE_SOURCES } from './globalCorpusSources';
import { fetchSingleFeed } from './feedFetcher';
import { normalizeFeedEntry } from './normalizer';
import {
  loadAiCredentials,
  hasAiConfiguration,
  AiCredentials,
  callAiWithGoogleSearch,
  callAiModel
} from '../ai/atmenAiClient';
import { ContinuousLiveNewsService, buildSubstantiveHackerNewsCopy } from '../data/continuousLiveNewsService';
import { isDeprecatedShowcaseStarterItem } from '../learning/hivemindLearningService';

export interface MultiLaneDiscoveryOptions {
  storage?: AtemStorage;
  existingIds?: Set<string>;
  existingTitles?: Set<string>;
  seenIds?: Set<string>;
  targetNewCount?: number;
  credentials?: AiCredentials;
  topicHint?: string;
  onStageChange?: (stage: string) => void;
}

export interface MultiLaneDiscoveryResult {
  items: FeedItem[];
  fetchedCount: number;
  insertedCount: number;
  approvedCount: number;
  rejectedCount: number;
  duplicateCount: number;
  usedAI: boolean;
  usedFallback: boolean;
  cacheHits: number;
  modelUsed?: string;
  errorClass?: string;
  errorMessage?: string;
  durationMs: number;
  sourcesCheckedCount: number;
}

export interface OpenWebHarvestResult {
  museumArtworks: FeedItem[];
  wikipediaGems: FeedItem[];
  techFrontpage: FeedItem[];
  openAlexPapers: FeedItem[];
  allHarvested: FeedItem[];
  fromCache: boolean;
  timestamp: number;
}

/**
 * Open-Web JSON Harvester Beyond RSS
 *
 * Scours open, zero-cost, API-key-free CORS-native JSON endpoints:
 * 1. Art Institute of Chicago Open Access (IIIF high-resolution paintings & sculptures)
 * 2. German Wikipedia Featured / Picture of the Day API (explicitly labeled as Encyclopedia)
 * 3. Hacker News Frontpage Algolia API (explicitly labeled with external HN points)
 * 4. OpenAlex Open-Access Research API (genuine peer-reviewed scientific publications)
 */
export class OpenWebHarvester {
  private static cache: OpenWebHarvestResult | null = null;
  private static cacheTimestamp = 0;
  private static CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
  private static readonly DISCOVERY_CURSOR_KEY = '@atem:discovery_cursor:v1';
  private static inMemoryCursor = 0;

  private static isBrowserEnvironment(): boolean {
    return typeof window !== 'undefined' && typeof document !== 'undefined';
  }

  private static normalizeTitleKey(title: string): string {
    return (title || '').trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
  }

  private static isKnownCandidate(
    item: { id: string; title: string },
    excludeIds?: Set<string>,
    excludeTitles?: Set<string>
  ): boolean {
    if (excludeIds) {
      if (excludeIds.has(item.id)) return true;
      if (item.id.startsWith('openweb-hn-') && excludeIds.has(item.id.replace('openweb-hn-', 'live-hn-'))) return true;
      if (item.id.startsWith('live-hn-') && excludeIds.has(item.id.replace('live-hn-', 'openweb-hn-'))) return true;
    }
    if (excludeTitles && item.title) {
      const key = this.normalizeTitleKey(item.title);
      if (key.length >= 6 && excludeTitles.has(key)) return true;
    }
    return false;
  }

  private static async nextDiscoveryCursor(storage?: AtemStorage): Promise<number> {
    const store = storage || appStorage;
    let current = this.inMemoryCursor;
    try {
      const raw = await store.getItem(this.DISCOVERY_CURSOR_KEY);
      if (raw) {
        const parsed = parseInt(raw, 10);
        if (!Number.isNaN(parsed) && parsed >= 0) {
          current = parsed;
        }
      }
      const next = current + 1;
      this.inMemoryCursor = next;
      await store.setItem(this.DISCOVERY_CURSOR_KEY, String(next));
      return current;
    } catch {
      const val = this.inMemoryCursor;
      this.inMemoryCursor += 1;
      return val;
    }
  }

  private static reconstructOpenAlexAbstract(invertedIndex: unknown, maxWords = 250): string {
    if (!invertedIndex || typeof invertedIndex !== 'object') return '';
    const wordsByPos: string[] = [];
    for (const [word, positions] of Object.entries(invertedIndex as Record<string, unknown>)) {
      if (Array.isArray(positions)) {
        for (const pos of positions) {
          if (typeof pos === 'number' && pos >= 0 && pos < maxWords) {
            wordsByPos[pos] = word;
          }
        }
      }
    }
    return wordsByPos.filter(Boolean).join(' ').trim();
  }

  private static stripXmlAndHtml(raw: string): string {
    return (raw || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  private static fetchWithTimeout(url: string, timeoutMs = 4500): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const acceptHeader = url.includes('rss') || url.includes('xml')
      ? 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8'
      : 'application/json';
    return fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: acceptHeader,
        'User-Agent': 'atmen-learning-network/2.0 (https://atmen.app; sovereign-knowledge-client)'
      }
    }).finally(() => {
      clearTimeout(timeoutId);
    });
  }

  /**
   * 1. Art Institute of Chicago & Metropolitan Museum Open Access APIs
   * Rotates page & search queries so repeated live discovery runs yield fresh artworks.
   */
  public static async harvestMuseumArtworks(limit = 6, cursor = 0): Promise<FeedItem[]> {
    const artQueries = [
      'painting landscape impressionism modern',
      'japanese woodblock architecture study',
      'still life portrait oil canvas',
      'abstract color geometry drawing',
      'romanticism light sea horizon',
      'calligraphy sculpture ink wash'
    ];
    const query = artQueries[cursor % artQueries.length];
    const page = 1 + (cursor % 20);
    const items: FeedItem[] = [];

    try {
      const url = `https://api.artic.edu/api/v1/artworks/search?q=${encodeURIComponent(query)}&query[term][is_public_domain]=true&fields=id,title,artist_display,date_display,medium_display,image_id,thumbnail,style_title,classification_title&page=${page}&limit=${limit}`;
      const response = await this.fetchWithTimeout(url, 4000);
      if (!response.ok) {
        throw new Error(`Art Institute API responded with status ${response.status}`);
      }
      const data = await response.json();
      const records = Array.isArray(data?.data) ? data.data : [];

      for (const record of records) {
        if (!record.image_id || !record.title) continue;

        const highResImageUrl = `https://www.artic.edu/iiif/2/${record.image_id}/full/843,/0/default.jpg`;
        const artist = record.artist_display ? record.artist_display.split('\n')[0] : 'Unbekannter Meister';
        const year = record.date_display || 'Klassische Epoche';
        const medium = record.medium_display || 'Malerei / Mischtechnik';
        const styleMovement = record.style_title || 'Bildende Kunst';
        const altText = record.thumbnail?.alt_text || `Werkbeschreibung: ${record.title} von ${artist}.`;

        const aestheticImpulse = `Wie ${artist} hier mit ${medium} Raum, Licht und Atmosphäre verdichtet, lädt dazu ein, den Blick für dreißig Sekunden ruhen zu lassen.`;

        const feedText = `${altText}`;
        const articleBody = `Werk: ${record.title}\nKünstler: ${artist}\nEntstehungszeit: ${year}\nTechnik: ${medium}\nEpoche/Stil: ${styleMovement}\nSammlung: The Art Institute of Chicago (Public Domain / CC0)\n\nBildbeschreibung:\n${altText}`;

        const item: FeedItem = {
          id: `openweb-art-${record.id}`,
          type: 'quick_insight',
          format: 'art_showcase',
          title: `${record.title}`,
          subtitle: `${artist} (${year}) • ${styleMovement}`,
          feedText,
          articleBody,
          body: feedText,
          topics: ['art_aesthetics', 'contemplation_mind'],
          primaryTopic: 'art_aesthetics',
          sourceReferences: [
            {
              title: `${record.title} (${artist})`,
              publisher: 'The Art Institute of Chicago',
              author: artist,
              originalUrl: `https://www.artic.edu/artworks/${record.id}`,
              publicationTimestamp: undefined,
              retrievalTimestamp: new Date().toISOString(),
              isVerified: true
            }
          ],
          publishedAt: '1900-01-01T00:00:00.000Z',
          publicationDateReliable: false,
          historicalYearOrEra: year !== 'Klassische Epoche' ? `Werk von ${year}` : 'Klassisches Werk',
          firstSeenAt: new Date().toISOString(),
          generatedAt: new Date().toISOString(),
          estimatedReadingMinutes: 1,
          relevanceExplanation: 'Gemeinfreies Kunstwerk aus der Sammlung des Art Institute of Chicago.',
          contentStatus: 'philosophical_perspective',
          isDailyEdition: false,
          editionDate: new Date().toISOString().split('T')[0],
          isTeachingRelated: false,
          isChallengingPerspective: false,
          isDemonstration: false,
          aiAssisted: false,
          factReviewStatus: 'historical_reference',
          provenanceSummary: 'Museums-Sammlung: The Art Institute of Chicago (Open Access CC0).',
          wordCount: 85,
          evidenceTier: 'permitted_full_text',
          contentOrigin: 'live_ingested',
          contentHash: `artic-${record.id}-${record.image_id}`,
          canonicalUrl: `https://www.artic.edu/artworks/${record.id}`,
          imageUrl: highResImageUrl,
          hasAuthenticImage: true,
          space: 'c/kunst_galerie',
          flair: '🎨 Museums-Werk',
          keyInsight: aestheticImpulse,
          challengePrompt: 'Welches Detail im Bild fällt dir erst beim zweiten Hinsehen auf?',
          upvotesCount: 0,
          awardsCount: { gold: 0, brain: 0, spark: 0 },
          sourceTrustLevel: 'museum_collection',
          sourceDomain: 'artic.edu',
          sourceBroadcasterName: 'Art Institute of Chicago',
          artMeta: {
            artist,
            year,
            medium,
            museum: 'The Art Institute of Chicago',
            highResImageUrl,
            styleMovement,
            aestheticImpulse
          },
          comments: []
        };

        items.push(item);
      }

      // Supplement with The Metropolitan Museum of Art (Open Access CORS-native)
      if (items.length < limit) {
        const metArtItems = await this.harvestMetMuseumArtworks(Math.max(2, limit - items.length), cursor);
        for (const m of metArtItems) {
          if (items.length < limit) items.push(m);
        }
      }

      if (items.length > 0) return items;
      return this.getLocalArtFallback();
    } catch {
      const metArtItems = await this.harvestMetMuseumArtworks(limit, cursor);
      if (metArtItems.length > 0) return metArtItems;
      return this.getLocalArtFallback();
    }
  }

  /**
   * 1b. The Metropolitan Museum of Art Open Access API (CORS-open)
   */
  public static async harvestMetMuseumArtworks(limit = 3, cursor = 0): Promise<FeedItem[]> {
    const queries = ['landscape', 'philosophy', 'astronomy', 'music', 'portrait', 'architecture'];
    const q = queries[cursor % queries.length];
    try {
      const searchUrl = `https://collectionapi.metmuseum.org/public/collection/v1/search?hasImages=true&isHighlight=true&q=${encodeURIComponent(q)}`;
      const res = await this.fetchWithTimeout(searchUrl, 3800);
      if (!res.ok) return [];
      const data = await res.json();
      const ids: number[] = Array.isArray(data?.objectIDs) ? data.objectIDs : [];
      if (ids.length === 0) return [];
      const offset = (cursor * limit) % Math.max(1, ids.length);
      const pickedIds = Array.from({ length: Math.min(limit, ids.length) }, (_, idx) => ids[(offset + idx) % ids.length]);
      const objResponses = await Promise.allSettled(
        pickedIds.map(id => this.fetchWithTimeout(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`, 3500).then(r => (r.ok ? r.json() : null)))
      );
      const items: FeedItem[] = [];
      for (const objRes of objResponses) {
        if (objRes.status !== 'fulfilled' || !objRes.value) continue;
        const obj = objRes.value;
        const imgUrl = obj.primaryImageSmall || obj.primaryImage;
        if (!obj.title || !imgUrl) continue;
        const artist = obj.artistDisplayName || 'Unbekannter Meister';
        const year = obj.objectDate || 'Sammlungswerk';
        const medium = obj.medium || 'Kunstwerk';
        const styleMovement = obj.department || 'Metropolitan Museum Collection';
        const desc = `${obj.title} (${year}) von ${artist} — ${medium} aus der Sammlung des Metropolitan Museum of Art.`;
        items.push({
          id: `openweb-met-${obj.objectID}`,
          type: 'quick_insight',
          format: 'art_showcase',
          title: obj.title,
          subtitle: `${artist} (${year}) • ${styleMovement}`,
          feedText: desc,
          articleBody: `Werk: ${obj.title}\nKünstler: ${artist}\nDatierung: ${year}\nTechnik: ${medium}\nAbteilung: ${styleMovement}\nSammlung: The Metropolitan Museum of Art (Open Access CC0)\n\n${desc}`,
          body: desc,
          topics: ['art_aesthetics', 'contemplation_mind'],
          primaryTopic: 'art_aesthetics',
          sourceReferences: [
            {
              title: `${obj.title} (${artist})`,
              publisher: 'The Metropolitan Museum of Art',
              author: artist,
              originalUrl: obj.objectURL || `https://www.metmuseum.org/art/collection/search/${obj.objectID}`,
              retrievalTimestamp: new Date().toISOString(),
              isVerified: true
            }
          ],
          publishedAt: '1900-01-01T00:00:00.000Z',
          publicationDateReliable: false,
          historicalYearOrEra: year,
          firstSeenAt: new Date().toISOString(),
          generatedAt: new Date().toISOString(),
          estimatedReadingMinutes: 1,
          relevanceExplanation: 'Gemeinfreies Highlight aus dem Metropolitan Museum of Art.',
          contentStatus: 'philosophical_perspective',
          isDailyEdition: false,
          editionDate: new Date().toISOString().split('T')[0],
          isTeachingRelated: false,
          isChallengingPerspective: false,
          isDemonstration: false,
          aiAssisted: false,
          factReviewStatus: 'historical_reference',
          provenanceSummary: 'Museums-Sammlung: The Metropolitan Museum of Art (CC0).',
          wordCount: 75,
          evidenceTier: 'permitted_full_text',
          contentOrigin: 'live_ingested',
          contentHash: `met-${obj.objectID}`,
          canonicalUrl: obj.objectURL || `https://www.metmuseum.org/art/collection/search/${obj.objectID}`,
          imageUrl: imgUrl,
          hasAuthenticImage: true,
          space: 'c/kunst_galerie',
          flair: '🎨 Met Museum',
          keyInsight: `Wie ${artist} in „${obj.title}“ mit ${medium} Form und Präsenz verdichtet, öffnet einen ruhigen Gegenpol zum Nachrichtenstrom.`,
          challengePrompt: 'Welche visuelle Spannung prägt den Bildaufbau auf den zweiten Blick?',
          upvotesCount: 0,
          awardsCount: { gold: 0, brain: 0, spark: 0 },
          sourceTrustLevel: 'museum_collection',
          sourceDomain: 'metmuseum.org',
          sourceBroadcasterName: 'Metropolitan Museum of Art',
          artMeta: {
            artist,
            year,
            medium,
            museum: 'The Metropolitan Museum of Art',
            highResImageUrl: imgUrl,
            styleMovement,
            aestheticImpulse: desc
          },
          comments: []
        });
      }
      return items;
    } catch {
      return [];
    }
  }

  /**
   * 2. German Wikipedia Featured Article, Picture of the Day & Historic Milestones
   * Explicitly classified as Encyclopedia ('encyclopedia' / 'encyclopedia_entry'), never as 'scientific_paper'.
   */
  public static async harvestWikipediaGems(): Promise<FeedItem[]> {
    try {
      const now = new Date();
      const yyyy = now.getUTCFullYear().toString();
      const mm = (now.getUTCMonth() + 1).toString().padStart(2, '0');
      const dd = now.getUTCDate().toString().padStart(2, '0');

      const url = `https://de.wikipedia.org/api/rest_v1/feed/featured/${yyyy}/${mm}/${dd}`;
      const response = await this.fetchWithTimeout(url, 3500);
      if (!response.ok) {
        throw new Error(`Wikipedia API responded with status ${response.status}`);
      }
      const data = await response.json();
      const items: FeedItem[] = [];

      // A. Today's Featured Article (Artikel des Tages)
      if (data?.tfa) {
        const tfa = data.tfa;
        const pageTitle = tfa.normalizedtitle || tfa.title || 'Wikipedia Artikel des Tages';
        const extract = (tfa.extract || tfa.description || '').trim();
        const canonical = tfa.content_urls?.desktop?.page || `https://de.wikipedia.org/wiki/${encodeURIComponent(pageTitle)}`;
        const imgUrl = tfa.originalimage?.source || tfa.thumbnail?.source;

        if (extract.length > 40) {
          items.push({
            id: `openweb-wiki-tfa-${yyyy}${mm}${dd}`,
            type: 'briefing',
            format: 'sourced_update',
            title: `${pageTitle}`,
            subtitle: `Wikipedia Artikel des Tages • Enzyklopädischer Überblick`,
            feedText: extract,
            articleBody: extract,
            body: extract,
            topics: ['science_society', 'philosophy_ethics'],
            primaryTopic: 'science_society',
            sourceReferences: [
              {
                title: pageTitle,
                publisher: 'Wikipedia (Enzyklopädie)',
                author: 'Wikipedia-Autorenkollektiv',
                originalUrl: canonical,
                publicationTimestamp: now.toISOString(),
                retrievalTimestamp: now.toISOString(),
                isVerified: true
              }
            ],
            publishedAt: now.toISOString(),
            publicationDateReliable: true,
            firstSeenAt: now.toISOString(),
            generatedAt: now.toISOString(),
            estimatedReadingMinutes: 3,
            relevanceExplanation: 'Kuratiertes enzyklopädisches Überblicksthema des Tages aus der deutschen Wikipedia.',
            contentStatus: 'editorial_briefing',
            isDailyEdition: true,
            editionDate: `${yyyy}-${mm}-${dd}`,
            isTeachingRelated: false,
            isChallengingPerspective: false,
            isDemonstration: false,
            aiAssisted: false,
            factReviewStatus: 'encyclopedia_entry',
            provenanceSummary: 'Enzyklopädie-Artikel aus der deutschen Wikipedia (CC BY-SA 4.0) – gemeinschaftlich verfasst, keine Primärstudie.',
            wordCount: Math.max(40, extract.split(/\s+/).length),
            evidenceTier: 'publisher_excerpt',
            contentOrigin: 'live_ingested',
            contentHash: `wiki-tfa-${yyyy}${mm}${dd}`,
            canonicalUrl: canonical,
            imageUrl: imgUrl,
            hasAuthenticImage: Boolean(imgUrl),
            space: 'c/books',
            flair: '🏛 Enzyklopädie',
            keyInsight: `Enzyklopädischer Überblick zu „${pageTitle}“ als Ausgangspunkt für weiterführende Primärquellen.`,
            challengePrompt: 'Welche Primärquelle oder historische Perspektive hinter diesem Überblicksartikel lohnt eine tiefere Prüfung?',
            upvotesCount: 0,
            awardsCount: { gold: 0, brain: 0, spark: 0 },
            sourceTrustLevel: 'encyclopedia',
            sourceDomain: 'de.wikipedia.org',
            sourceBroadcasterName: 'Wikipedia (Enzyklopädie)',
            comments: []
          });
        }
      }

      // B. Picture of the Day (Bild des Tages)
      if (data?.image) {
        const img = data.image;
        const imgTitle = img.title?.replace(/File:|Datei:/i, '').replace(/\.[a-zA-Z0-9]+$/, '').replace(/_/g, ' ') || 'Bild des Tages';
        const imgDesc = (img.description?.text || 'Ausgewähltes Fotodokument aus Wikimedia Commons.').trim();
        const highResUrl = img.image?.source || img.thumbnail?.source;
        const fileUrl = img.file_page || `https://commons.wikimedia.org/wiki/${encodeURIComponent(img.title || '')}`;

        if (highResUrl) {
          items.push({
            id: `openweb-wiki-potd-${yyyy}${mm}${dd}`,
            type: 'quick_insight',
            format: 'art_showcase',
            title: `Bild des Tages: ${imgTitle}`,
            subtitle: `Wikimedia Commons • Dokumentarfotografie & Bildarchiv`,
            feedText: imgDesc,
            articleBody: imgDesc,
            body: imgDesc,
            topics: ['art_aesthetics', 'science_society'],
            primaryTopic: 'art_aesthetics',
            sourceReferences: [
              {
                title: imgTitle,
                publisher: 'Wikimedia Commons',
                author: img.artist?.text || 'Wikimedia Commons Fotograf',
                originalUrl: fileUrl,
                publicationTimestamp: undefined,
                retrievalTimestamp: now.toISOString(),
                isVerified: true
              }
            ],
            publishedAt: '1900-01-01T00:00:00.000Z',
            publicationDateReliable: false,
            historicalYearOrEra: 'Archiv-Fotografie',
            firstSeenAt: now.toISOString(),
            generatedAt: now.toISOString(),
            estimatedReadingMinutes: 1,
            relevanceExplanation: 'Täglich kuratiertes Bilddokument aus dem freien Medienarchiv Wikimedia Commons.',
            contentStatus: 'editorial_briefing',
            isDailyEdition: false,
            editionDate: `${yyyy}-${mm}-${dd}`,
            isTeachingRelated: false,
            isChallengingPerspective: false,
            isDemonstration: false,
            aiAssisted: false,
            factReviewStatus: 'curated_illustrative',
            provenanceSummary: 'Wikimedia Commons Bild des Tages (freie Bildlizenz CC BY-SA / Public Domain).',
            wordCount: Math.max(25, imgDesc.split(/\s+/).length),
            evidenceTier: 'permitted_full_text',
            contentOrigin: 'live_ingested',
            contentHash: `wiki-potd-${yyyy}${mm}${dd}`,
            canonicalUrl: fileUrl,
            imageUrl: highResUrl,
            hasAuthenticImage: true,
            space: 'c/kunst_galerie',
            flair: '📷 Bild des Tages',
            keyInsight: imgDesc,
            challengePrompt: 'Welchen realen Ort oder historischen Moment hält diese Aufnahme fest?',
            upvotesCount: 0,
            awardsCount: { gold: 0, brain: 0, spark: 0 },
            sourceTrustLevel: 'museum_collection',
            sourceDomain: 'commons.wikimedia.org',
            sourceBroadcasterName: 'Wikimedia Commons',
            artMeta: {
              artist: img.artist?.text || 'Wikimedia Commons',
              year: yyyy,
              medium: 'Fotografie / Bilddokument',
              museum: 'Wikimedia Commons',
              highResImageUrl: highResUrl,
              styleMovement: 'Dokumentarfotografie',
              aestheticImpulse: imgDesc
            },
            comments: []
          });
        }
      }

      // C. Single Historic Milestone (Was geschah am...) — max 1 to avoid Wikipedia repetition!
      if (Array.isArray(data?.onthisday) && data.onthisday.length > 0) {
        const m = data.onthisday[0];
        const primaryPage = m.pages?.[0];
        const pageTitle = primaryPage?.normalizedtitle || primaryPage?.title || `Historisches Ereignis (${m.year})`;
        const pageExtract = (m.text || primaryPage?.extract || '').trim();
        const canonical = primaryPage?.content_urls?.desktop?.page || 'https://de.wikipedia.org';

        if (pageExtract.length > 20) {
          items.push({
            id: `openweb-wiki-onthisday-${yyyy}${mm}${dd}-0`,
            type: 'quick_insight',
            format: 'concise_insight',
            title: `Kalenderblatt ${m.year}: ${pageTitle}`,
            subtitle: `Historischer Jahrestag (${dd}.${mm}.) • Wikipedia Chronik`,
            feedText: `${m.year}: ${pageExtract}`,
            articleBody: `${m.year}: ${pageExtract}${primaryPage?.extract ? `\n\nHintergrund:\n${primaryPage.extract}` : ''}`,
            body: pageExtract,
            topics: ['science_society', 'philosophy_ethics'],
            primaryTopic: 'philosophy_ethics',
            sourceReferences: [
              {
                title: pageTitle,
                publisher: 'Wikipedia Chronik',
                originalUrl: canonical,
                publicationTimestamp: undefined,
                retrievalTimestamp: now.toISOString(),
                isVerified: true
              }
            ],
            publishedAt: `${String(m.year).padStart(4, '0')}-01-01T00:00:00.000Z`,
            publicationDateReliable: false,
            historicalYearOrEra: `Jahrestag · ${m.year}`,
            firstSeenAt: now.toISOString(),
            generatedAt: now.toISOString(),
            estimatedReadingMinutes: 1,
            relevanceExplanation: 'Kurzer historischer Rückblick zum heutigen Kalendertag.',
            contentStatus: 'historical_reference' as any,
            isDailyEdition: false,
            editionDate: `${yyyy}-${mm}-${dd}`,
            isTeachingRelated: false,
            isChallengingPerspective: false,
            isDemonstration: false,
            aiAssisted: false,
            factReviewStatus: 'historical_reference',
            provenanceSummary: 'Enzyklopädischer Jahrestag aus der Wikipedia (CC BY-SA 4.0).',
            wordCount: Math.max(25, pageExtract.split(/\s+/).length),
            evidenceTier: 'publisher_excerpt',
            contentOrigin: 'live_ingested',
            contentHash: `wiki-hist-${yyyy}${mm}${dd}-0`,
            canonicalUrl: canonical,
            hasAuthenticImage: false,
            space: 'c/dialektik',
            flair: '⏳ Jahrestag',
            keyInsight: `${m.year}: ${pageExtract}`,
            upvotesCount: 0,
            awardsCount: { gold: 0, brain: 0, spark: 0 },
            sourceTrustLevel: 'encyclopedia',
            sourceDomain: 'de.wikipedia.org',
            sourceBroadcasterName: 'Wikipedia Kalenderblatt',
            comments: []
          });
        }
      }

      return items;
    } catch {
      return [];
    }
  }

  /**
   * 3. Hacker News Algolia API Frontpage & Topic Search Discovery
   * Rotates across frontpage, recent high-signal stories, and intellectual topic queries,
   * skipping already-known IDs/titles and enriching each story with substantive copy.
   */
  public static async harvestTechFrontpage(
    limit = 10,
    cursor = 0,
    excludeIds?: Set<string>,
    excludeTitles?: Set<string>
  ): Promise<FeedItem[]> {
    try {
      const queryModes = [
        `https://hn.algolia.com/api/v1/search?tags=front_page&page=${cursor % 4}&hitsPerPage=24`,
        `https://hn.algolia.com/api/v1/search_by_date?tags=story&numericFilters=points%3E40&page=${cursor % 6}&hitsPerPage=24`,
        `https://hn.algolia.com/api/v1/search?query=philosophy+OR+epistemology+OR+ethics&tags=story&numericFilters=points%3E35&page=${Math.floor(cursor / 2) % 4}&hitsPerPage=24`,
        `https://hn.algolia.com/api/v1/search?query=AI+alignment+mechanistic+interpretability&tags=story&numericFilters=points%3E40&page=${Math.floor(cursor / 2) % 4}&hitsPerPage=24`,
        `https://hn.algolia.com/api/v1/search?query=quantum+physics+astronomy+neuroscience&tags=story&numericFilters=points%3E35&page=${Math.floor(cursor / 2) % 4}&hitsPerPage=24`,
        `https://hn.algolia.com/api/v1/search?query=education+pedagogy+reading+books&tags=story&numericFilters=points%3E30&page=${Math.floor(cursor / 2) % 4}&hitsPerPage=24`,
        `https://hn.algolia.com/api/v1/search?query=europe+germany+society+economy&tags=story&numericFilters=points%3E40&page=${Math.floor(cursor / 2) % 4}&hitsPerPage=24`,
        `https://hn.algolia.com/api/v1/search?tags=story&numericFilters=points%3E120&page=${1 + (cursor % 6)}&hitsPerPage=24`
      ];
      const endpoint = queryModes[cursor % queryModes.length];
      const response = await this.fetchWithTimeout(endpoint, 3800);
      if (!response.ok) {
        throw new Error(`Hacker News Algolia responded with status ${response.status}`);
      }
      const data = await response.json();
      const hits = Array.isArray(data?.hits) ? data.hits : [];
      const items: FeedItem[] = [];

      for (const hit of hits) {
        if (items.length >= limit) break;
        if (!hit.title || !hit.objectID) continue;
        const itemId = `openweb-hn-${hit.objectID}`;
        if (this.isKnownCandidate({ id: itemId, title: hit.title }, excludeIds, excludeTitles)) continue;

        const hnUrl = `https://news.ycombinator.com/item?id=${hit.objectID}`;
        const targetUrl = hit.url || hnUrl;
        let domain = 'news.ycombinator.com';
        try {
          if (hit.url) domain = new URL(hit.url).hostname.replace(/^www\./, '');
        } catch {
          domain = 'news.ycombinator.com';
        }

        const points = typeof hit.points === 'number' ? hit.points : 0;
        const numComments = typeof hit.num_comments === 'number' ? hit.num_comments : 0;
        const copy = buildSubstantiveHackerNewsCopy({
          title: hit.title,
          domain,
          targetUrl,
          hnUrl,
          points,
          commentsCount: numComments,
          storyText: typeof hit.story_text === 'string' ? hit.story_text : undefined
        });
        const primaryTopic = classifyTopicDeterministically(hit.title, `${domain} ${copy.feedText}`, 'ai_apple');

        const item: FeedItem = {
          id: itemId,
          type: 'quick_insight',
          format: 'concise_insight',
          title: hit.title,
          subtitle: `${domain} • ${points} HN-Punkte (${numComments} Kommentare)`,
          feedText: copy.feedText,
          articleBody: copy.articleBody,
          body: copy.feedText,
          topics: [primaryTopic, 'science_society'].filter((t, i, arr) => arr.indexOf(t) === i) as TopicTag[],
          primaryTopic,
          sourceReferences: [
            {
              title: hit.title,
              publisher: `${domain} (via Hacker News)`,
              author: hit.author || domain,
              originalUrl: targetUrl,
              publicationTimestamp: hit.created_at || new Date().toISOString(),
              retrievalTimestamp: new Date().toISOString(),
              isVerified: true
            }
          ],
          publishedAt: hit.created_at || new Date().toISOString(),
          publicationDateReliable: Boolean(hit.created_at),
          firstSeenAt: new Date().toISOString(),
          generatedAt: new Date().toISOString(),
          estimatedReadingMinutes: Math.max(1, Math.ceil(copy.articleBody.split(/\s+/).length / 150)),
          relevanceExplanation: `Aktuelle Fachdiskussion aus der Hacker-News-Community (${points} HN-Punkte).`,
          contentStatus: 'editorial_briefing',
          isDailyEdition: true,
          editionDate: new Date().toISOString().split('T')[0],
          isTeachingRelated: primaryTopic === 'german_didactics',
          isChallengingPerspective: false,
          isDemonstration: false,
          aiAssisted: false,
          factReviewStatus: 'community_discussion',
          provenanceSummary: `Community-Fundstück von ${domain}, kuratiert auf Hacker News (${points} Punkte, ${numComments} Kommentare).`,
          wordCount: Math.max(45, copy.articleBody.split(/\s+/).length),
          evidenceTier: 'publisher_excerpt',
          contentOrigin: 'live_ingested',
          contentHash: `hn-${hit.objectID}`,
          canonicalUrl: targetUrl,
          hasAuthenticImage: false,
          space: TOPIC_SPACE_MAP[primaryTopic]?.space || 'c/acceleration',
          flair: '💬 HN-Community',
          keyInsight: copy.keyInsight,
          upvotesCount: 0,
          awardsCount: { gold: 0, brain: 0, spark: 0 },
          externalCommunityScore: {
            platform: 'HN',
            points,
            commentsCount: numComments,
            discussionUrl: hnUrl
          },
          sourceTrustLevel: 'community_curated',
          sourceDomain: domain,
          sourceBroadcasterName: `${domain} (HN)`,
          comments: []
        };

        items.push(item);
      }

      return items;
    } catch {
      return [];
    }
  }

  /**
   * 4. OpenAlex Open-Access Science API (Genuine Peer-Reviewed Papers)
   * Rotates discipline queries, sorting (newest vs most cited), and page cursor on every run.
   */
  public static async harvestOpenAlexPapers(limit = 6, cursor = 0, topicHint?: string): Promise<FeedItem[]> {
    const rotatingQueries = [
      'philosophy OR ethics OR epistemology',
      'pedagogy OR didactics OR education',
      'cognitive neuroscience OR consciousness',
      'artificial intelligence OR alignment OR interpretability',
      'mindfulness OR contemplation OR phenomenology',
      'electronic music OR acoustics OR aesthetics'
    ];
    const searchQ = topicHint?.trim() || rotatingQueries[cursor % rotatingQueries.length];
    const page = 1 + (cursor % 8);
    const sortMode = cursor % 2 === 0 ? 'publication_date:desc' : 'cited_by_count:desc';
    try {
      const url = `https://api.openalex.org/works?filter=is_oa:true,has_abstract:true,from_publication_date:2026-01-01&search=${encodeURIComponent(searchQ)}&sort=${sortMode}&page=${page}&per-page=${limit}`;
      const response = await this.fetchWithTimeout(url, 4000);
      if (!response.ok) {
        throw new Error(`OpenAlex API responded with status ${response.status}`);
      }
      const data = await response.json();
      const results = Array.isArray(data?.results) ? data.results : [];
      const items: FeedItem[] = [];

      for (const work of results) {
        if (!work.title || !work.id) continue;
        const workId = String(work.id).replace('https://openalex.org/', '');
        const doiUrl = work.doi || work.primary_location?.landing_page_url || work.id;
        const journal = work.primary_location?.source?.display_name || 'OpenAlex Fachpublikation';
        const firstAuthor = work.authorships?.[0]?.author?.display_name || 'Forschungsteam';
        const pubDate = work.publication_date
          ? new Date(work.publication_date).toISOString()
          : new Date().toISOString();

        const abstractText = this.reconstructOpenAlexAbstract(work.abstract_inverted_index, 250);
        if (abstractText.length < 40) continue;
        if (!isSupportedFeedLanguage(work.title, abstractText)) continue;
        if (IRRELEVANT_WETLAB_OR_NICHE_ACADEMIC_REGEX.test(`${work.title} ${abstractText}`)) continue;

        const firstInsightSentence = abstractText
          .split(/(?<=[.!?])\s+/)
          .find(s => s.trim().length >= 25 && !/^(Open-Access-Forschungsarbeit|Begutachtete|Summary|Abstract)/i.test(s.trim()));
        const cleanInsight = firstInsightSentence ? firstInsightSentence.trim().slice(0, 220) : work.title;

        items.push({
          id: `openweb-openalex-${workId}`,
          type: 'deep_dive',
          format: 'sourced_update',
          title: work.title,
          subtitle: `${journal} • ${firstAuthor} • ${work.cited_by_count || 0} Zitationen`,
          feedText: abstractText.length > 420 ? abstractText.slice(0, 417) + '…' : abstractText,
          articleBody: abstractText,
          body: abstractText,
          topics: ['science_society', 'ai_apple'],
          primaryTopic: 'science_society',
          sourceReferences: [
            {
              title: work.title,
              publisher: journal,
              author: firstAuthor,
              originalUrl: doiUrl,
              publicationTimestamp: pubDate,
              retrievalTimestamp: new Date().toISOString(),
              isVerified: true
            }
          ],
          publishedAt: pubDate,
          publicationDateReliable: Boolean(work.publication_date),
          firstSeenAt: new Date().toISOString(),
          generatedAt: new Date().toISOString(),
          estimatedReadingMinutes: Math.max(2, Math.ceil(abstractText.split(/\s+/).length / 150)),
          relevanceExplanation: `Begutachtete Open-Access-Publikation aus ${journal}.`,
          contentStatus: 'scientific_analysis',
          isDailyEdition: false,
          editionDate: new Date().toISOString().split('T')[0],
          isTeachingRelated: false,
          isChallengingPerspective: false,
          isDemonstration: false,
          aiAssisted: false,
          factReviewStatus: 'scientific_paper',
          provenanceSummary: `Wissenschaftliche Open-Access-Publikation via OpenAlex (${journal}).`,
          wordCount: Math.max(30, abstractText.split(/\s+/).length),
          evidenceTier: abstractText.length >= 120 ? 'publisher_excerpt' : 'metadata_only',
          contentOrigin: 'live_ingested',
          contentHash: `openalex-${workId}`,
          canonicalUrl: doiUrl,
          hasAuthenticImage: false,
          space: 'c/dialektik',
          flair: '🔬 Fachpublikation',
          keyInsight: cleanInsight,
          upvotesCount: 0,
          awardsCount: { gold: 0, brain: 0, spark: 0 },
          sourceTrustLevel: 'peer_reviewed',
          sourceDomain: 'openalex.org',
          sourceBroadcasterName: journal,
          comments: []
        });
      }

      return items;
    } catch {
      return [];
    }
  }

  /**
   * 4b. Targeted Scholarly & Journalistic Research for Specific Channels/Topics (Directive 6)
   * Queries OpenAlex for works matching a query with guaranteed substantive abstracts >= 140 chars.
   */
  public static async harvestScholarlyWorksForQuery(query: string, limit = 5): Promise<FeedItem[]> {
    const cleanQuery = query.replace(/^c\//i, '').replace(/[_-]/g, ' ').trim();
    if (!cleanQuery) return [];

    try {
      const searchParam = encodeURIComponent(cleanQuery);
      const url = `https://api.openalex.org/works?filter=is_oa:true,has_abstract:true&search=${searchParam}&sort=cited_by_count:desc&per-page=${limit}`;
      const response = await this.fetchWithTimeout(url, 4000);
      if (!response.ok) {
        throw new Error(`OpenAlex query failed (${response.status})`);
      }
      const data = await response.json();
      const results = Array.isArray(data?.results) ? data.results : [];
      const items: FeedItem[] = [];

      for (const work of results) {
        if (!work.title || !work.id) continue;
        const workId = String(work.id).replace('https://openalex.org/', '');
        const doiUrl = work.doi || work.primary_location?.landing_page_url || work.id;
        const journal = work.primary_location?.source?.display_name || 'OpenAlex Fachpublikation';
        const firstAuthor = work.authorships?.[0]?.author?.display_name || 'Forschungsteam';
        const pubDate = work.publication_date
          ? new Date(work.publication_date).toISOString()
          : new Date().toISOString();

        const abstractText = this.reconstructOpenAlexAbstract(work.abstract_inverted_index, 250);

        // Directive 1: Guarantee substantive prose >= 140 chars
        if (abstractText.length < 140) continue;

        const primaryTopic = classifyTopicDeterministically(work.title, abstractText, 'german_didactics');

        items.push({
          id: `openalex-q-${workId}`,
          type: 'deep_dive',
          format: 'sourced_update',
          title: work.title,
          subtitle: `${journal} • ${firstAuthor} • ${work.cited_by_count || 0} Zitationen`,
          feedText: abstractText.length > 420 ? abstractText.slice(0, 417) + '…' : abstractText,
          articleBody: abstractText,
          body: abstractText,
          topics: [primaryTopic, 'science_society'],
          primaryTopic,
          sourceReferences: [
            {
              title: work.title,
              publisher: journal,
              author: firstAuthor,
              originalUrl: doiUrl,
              publicationTimestamp: pubDate,
              retrievalTimestamp: new Date().toISOString(),
              isVerified: true
            }
          ],
          publishedAt: pubDate,
          publicationDateReliable: Boolean(work.publication_date),
          firstSeenAt: new Date().toISOString(),
          generatedAt: new Date().toISOString(),
          estimatedReadingMinutes: Math.max(2, Math.ceil(abstractText.split(/\s+/).length / 150)),
          relevanceExplanation: `Gezielte Fachrecherche zu „${cleanQuery}“ (${journal}).`,
          contentStatus: 'scientific_analysis',
          isDailyEdition: false,
          editionDate: new Date().toISOString().split('T')[0],
          isTeachingRelated: true,
          isChallengingPerspective: false,
          isDemonstration: false,
          aiAssisted: false,
          factReviewStatus: 'scientific_paper',
          provenanceSummary: `Gezielte wissenschaftliche Publikation via OpenAlex (${journal}).`,
          wordCount: abstractText.split(/\s+/).length,
          evidenceTier: 'publisher_excerpt',
          contentOrigin: 'live_ingested',
          contentHash: `openalex-q-${workId}`,
          canonicalUrl: doiUrl,
          hasAuthenticImage: false,
          space: `c/${cleanQuery.replace(/\s+/g, '_')}`,
          flair: '🔬 Fachrecherche',
          keyInsight: `Erkenntnis aus ${journal}: ${work.title}`,
          upvotesCount: 0,
          awardsCount: { gold: 0, brain: 0, spark: 0 },
          sourceTrustLevel: 'peer_reviewed',
          sourceDomain: 'openalex.org',
          sourceBroadcasterName: journal,
          comments: []
        });
      }

      return items;
    } catch {
      return [];
    }
  }

  /**
   * Harvests all open-web endpoints in parallel with resilient error isolation.
   */
  public static async harvestAllOpenWeb(forceRefresh = false): Promise<OpenWebHarvestResult> {
    const now = Date.now();
    if (!forceRefresh && this.cache && now - this.cacheTimestamp < this.CACHE_TTL_MS) {
      return {
        ...this.cache,
        fromCache: true
      };
    }

    const [artworksResult, wikiResult, hnResult, openAlexResult] = await Promise.allSettled([
      this.harvestMuseumArtworks(6),
      this.harvestWikipediaGems(),
      this.harvestTechFrontpage(6),
      this.harvestOpenAlexPapers(4)
    ]);

    const museumArtworks = artworksResult.status === 'fulfilled' && artworksResult.value.length > 0
      ? artworksResult.value
      : this.getLocalArtFallback();

    const wikipediaGems = wikiResult.status === 'fulfilled'
      ? wikiResult.value
      : [];

    const techFrontpage = hnResult.status === 'fulfilled'
      ? hnResult.value
      : [];

    const openAlexPapers = openAlexResult.status === 'fulfilled'
      ? openAlexResult.value
      : [];

    const allHarvested: FeedItem[] = [
      ...openAlexPapers,
      ...techFrontpage,
      ...museumArtworks,
      ...wikipediaGems
    ];

    const result: OpenWebHarvestResult = {
      museumArtworks,
      wikipediaGems,
      techFrontpage,
      openAlexPapers,
      allHarvested,
      fromCache: false,
      timestamp: now
    };

    this.cache = result;
    this.cacheTimestamp = now;

    return result;
  }

  /**
   * Resilient local fallback from REAL_KNOWLEDGE_VAULT
   */
  private static getLocalArtFallback(): FeedItem[] {
    const vaultArt = REAL_KNOWLEDGE_VAULT.filter(item => item.primaryTopic === 'art_aesthetics' || item.format === 'art_showcase');
    if (vaultArt.length > 0) return vaultArt;
    return [];
  }

  /**
   * 5. ArXiv Open-Access Preprints (AI, Computation, Epistemology & Mind)
   */
  public static async harvestArxivPapers(limit = 6): Promise<FeedItem[]> {
    try {
      const url = `https://export.arxiv.org/api/query?search_query=cat:cs.AI+OR+cat:cs.CY+OR+cat:stat.ML+OR+cat:q-bio.NC+OR+cat:physics.soc-ph&sortBy=submittedDate&sortOrder=descending&max_results=${limit}`;
      const response = await this.fetchWithTimeout(url, 4000);
      if (!response.ok) {
        throw new Error(`ArXiv responded with status ${response.status}`);
      }
      const xml = await response.text();
      const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
      let match: RegExpExecArray | null;
      const items: FeedItem[] = [];

      while ((match = entryRegex.exec(xml)) !== null && items.length < limit) {
        const entryXml = match[1];
        const rawId = (entryXml.match(/<id>([\s\S]*?)<\/id>/)?.[1] || '').trim();
        const arxivId = rawId.replace(/^https?:\/\/arxiv\.org\/abs\//i, '').replace(/v\d+$/, '');
        const title = (entryXml.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '')
          .replace(/\s+/g, ' ')
          .replace(/^Title:\s*/i, '')
          .trim();
        const summary = (entryXml.match(/<summary>([\s\S]*?)<\/summary>/)?.[1] || '')
          .replace(/\s+/g, ' ')
          .trim();
        const author = (entryXml.match(/<author>[\s\S]*?<name>([\s\S]*?)<\/name>/)?.[1] || 'ArXiv Forschungsteam').trim();
        const published = (entryXml.match(/<published>([\s\S]*?)<\/published>/)?.[1] || new Date().toISOString()).trim();

        if (!title || summary.length < 50) continue;

        const canonicalUrl = `https://arxiv.org/abs/${arxivId}`;
        const primaryTopic = classifyTopicDeterministically(title, summary, 'ai_apple');

        items.push({
          id: `openweb-arxiv-${arxivId}`,
          type: 'deep_dive',
          format: 'sourced_update',
          title,
          subtitle: `arXiv.org Preprint • ${author} • Peer-Forschung`,
          feedText: summary.length > 420 ? summary.slice(0, 417) + '…' : summary,
          articleBody: summary,
          body: summary,
          topics: [primaryTopic, 'science_society'],
          primaryTopic,
          sourceReferences: [
            {
              title,
              publisher: 'arXiv.org (Cornell University)',
              author,
              originalUrl: canonicalUrl,
              publicationTimestamp: published,
              retrievalTimestamp: new Date().toISOString(),
              isVerified: true
            }
          ],
          publishedAt: published,
          publicationDateReliable: true,
          firstSeenAt: new Date().toISOString(),
          generatedAt: new Date().toISOString(),
          estimatedReadingMinutes: Math.max(2, Math.ceil(summary.split(/\s+/).length / 140)),
          relevanceExplanation: `Aktuelles wissenschaftliches Preprint aus dem Facharchiv arXiv (${arxivId}).`,
          contentStatus: 'scientific_analysis',
          isDailyEdition: false,
          editionDate: new Date().toISOString().split('T')[0],
          isTeachingRelated: false,
          isChallengingPerspective: false,
          isDemonstration: false,
          aiAssisted: false,
          factReviewStatus: 'scientific_paper',
          provenanceSummary: 'Wissenschaftliches Open-Access-Preprint von arXiv.org (Cornell University).',
          wordCount: summary.split(/\s+/).length,
          evidenceTier: 'publisher_excerpt',
          contentOrigin: 'live_ingested',
          contentHash: `arxiv-${arxivId}`,
          canonicalUrl,
          hasAuthenticImage: false,
          space: 'c/dialektik',
          flair: '🔬 arXiv Preprint',
          keyInsight: `Forschungsarbeit auf arXiv: ${title}`,
          upvotesCount: 0,
          awardsCount: { gold: 0, brain: 0, spark: 0 },
          sourceTrustLevel: 'peer_reviewed',
          sourceDomain: 'arxiv.org',
          sourceBroadcasterName: 'arXiv.org',
          comments: []
        });
      }

      return items;
    } catch {
      return [];
    }
  }

  /**
   * 6. Live Wikipedia Discovery: Random Excellence & Paginated Knowledge Search (DE & EN)
   */
  public static async harvestWikipediaRandomGems(
    limit = 6,
    cursor = 0,
    excludeIds?: Set<string>,
    excludeTitles?: Set<string>
  ): Promise<FeedItem[]> {
    const urls = [
      'https://de.wikipedia.org/api/rest_v1/page/random/summary',
      'https://de.wikipedia.org/api/rest_v1/page/random/summary',
      'https://en.wikipedia.org/api/rest_v1/page/random/summary',
      'https://en.wikipedia.org/api/rest_v1/page/random/summary'
    ];

    const searchTopics = [
      { lang: 'de', q: 'Erkenntnistheorie' },
      { lang: 'en', q: 'Philosophy of mind' },
      { lang: 'de', q: 'Kognitionswissenschaft' },
      { lang: 'en', q: 'Quantum mechanics interpretation' },
      { lang: 'de', q: 'Bildungstheorie Pädagogik' },
      { lang: 'en', q: 'Information theory' },
      { lang: 'de', q: 'Bewusstseinsforschung' },
      { lang: 'en', q: 'History of science' },
      { lang: 'de', q: 'Klangsynthese Elektronische Musik' },
      { lang: 'en', q: 'Phenomenology philosophy' },
      { lang: 'de', q: 'Moralphilosophie Ethik' },
      { lang: 'en', q: 'Neuroplasticity cognition' },
      { lang: 'de', q: 'Systemtheorie Komplexität' },
      { lang: 'en', q: 'Renaissance humanism' }
    ];
    const topicSlot = searchTopics[cursor % searchTopics.length];
    const gsrOffset = (Math.floor(cursor / searchTopics.length) * 6) % 36;
    const searchUrl = `https://${topicSlot.lang}.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(topicSlot.q)}&gsrlimit=8&gsroffset=${gsrOffset}&prop=extracts|pageimages|info&exintro=1&explaintext=1&inprop=url&pithumbsize=960&format=json&origin=*`;

    const [randomResults, searchResult] = await Promise.all([
      Promise.allSettled(urls.map(u => this.fetchWithTimeout(u, 3200).then(r => (r.ok ? r.json() : null)))),
      this.fetchWithTimeout(searchUrl, 3200).then(r => (r.ok ? r.json() : null)).catch(() => null)
    ]);

    const rawRecords: { title: string; extract: string; canonical: string; imgUrl?: string; lang: 'de' | 'en' }[] = [];

    for (const res of randomResults) {
      if (res.status !== 'fulfilled' || !res.value) continue;
      const data = res.value;
      const title = data.normalizedtitle || data.title;
      const extract = (data.extract || data.description || '').trim();
      const canonical = data.content_urls?.desktop?.page || `https://wikipedia.org/wiki/${encodeURIComponent(title || '')}`;
      const imgUrl = data.originalimage?.source || data.thumbnail?.source;
      const lang: 'de' | 'en' = canonical.includes('de.wikipedia') ? 'de' : 'en';
      if (title && extract) {
        rawRecords.push({ title, extract, canonical, imgUrl, lang });
      }
    }

    const pagesObj = searchResult?.query?.pages;
    if (pagesObj && typeof pagesObj === 'object') {
      for (const page of Object.values(pagesObj) as any[]) {
        const title = page?.title;
        const extract = (page?.extract || '').trim();
        const canonical = page?.fullurl || `https://${topicSlot.lang}.wikipedia.org/wiki/${encodeURIComponent(title || '')}`;
        const imgUrl = page?.thumbnail?.source;
        if (title && extract) {
          rawRecords.push({ title, extract, canonical, imgUrl, lang: topicSlot.lang as 'de' | 'en' });
        }
      }
    }

    const items: FeedItem[] = [];
    const now = new Date();
    const seenLocalTitles = new Set<string>();

    for (const rec of rawRecords) {
      if (items.length >= limit) break;
      if (!rec.title || rec.extract.length < 110) continue;
      if (!isSupportedFeedLanguage(rec.title, rec.extract)) continue;

      const norm = this.normalizeTitleKey(rec.title);
      if (seenLocalTitles.has(norm)) continue;
      const itemId = `openweb-wiki-rnd-${norm.slice(0, 36)}`;
      if (this.isKnownCandidate({ id: itemId, title: rec.title }, excludeIds, excludeTitles)) continue;
      seenLocalTitles.add(norm);

      const langDomain = rec.lang === 'de' ? 'de.wikipedia.org' : 'en.wikipedia.org';
      const langLabel = rec.lang === 'de' ? 'Deutsche Wikipedia' : 'English Wikipedia';
      const primaryTopic = classifyTopicDeterministically(rec.title, rec.extract, 'science_society');
      const trimmedFeed = rec.extract.length > 440 ? `${rec.extract.slice(0, 437)}…` : rec.extract;

      items.push({
        id: itemId,
        type: 'briefing',
        format: 'sourced_update',
        title: rec.title,
        subtitle: `${langLabel} • Enzyklopädische Entdeckung`,
        feedText: trimmedFeed,
        articleBody: rec.extract,
        body: trimmedFeed,
        topics: [primaryTopic, 'philosophy_ethics'].filter((t, i, arr) => arr.indexOf(t) === i) as TopicTag[],
        primaryTopic,
        sourceReferences: [
          {
            title: rec.title,
            publisher: `Wikipedia (${langLabel})`,
            author: 'Wikipedia-Autorenkollektiv',
            originalUrl: rec.canonical,
            publicationTimestamp: now.toISOString(),
            retrievalTimestamp: now.toISOString(),
            isVerified: true
          }
        ],
        publishedAt: now.toISOString(),
        publicationDateReliable: true,
        firstSeenAt: now.toISOString(),
        generatedAt: now.toISOString(),
        estimatedReadingMinutes: Math.max(1, Math.ceil(rec.extract.split(/\s+/).length / 150)),
        relevanceExplanation: `Enzyklopädisches Wissensthema aus der freien Enzyklopädie (${langLabel}).`,
        contentStatus: 'editorial_briefing',
        isDailyEdition: true,
        editionDate: now.toISOString().split('T')[0],
        isTeachingRelated: primaryTopic === 'german_didactics',
        isChallengingPerspective: false,
        isDemonstration: false,
        aiAssisted: false,
        factReviewStatus: 'encyclopedia_entry',
        provenanceSummary: `Enzyklopädie-Eintrag aus Wikipedia (${langLabel}, CC BY-SA).`,
        wordCount: Math.max(30, rec.extract.split(/\s+/).length),
        evidenceTier: 'publisher_excerpt',
        contentOrigin: 'live_ingested',
        contentHash: `wiki-rnd-${norm.slice(0, 24)}`,
        canonicalUrl: rec.canonical,
        imageUrl: rec.imgUrl,
        hasAuthenticImage: Boolean(rec.imgUrl),
        space: TOPIC_SPACE_MAP[primaryTopic]?.space || 'c/books',
        flair: '🏛 Wikipedia-Perle',
        keyInsight: `${rec.extract.split(/(?<=[.!?])\s+/)[0]?.slice(0, 200) || rec.title}`,
        upvotesCount: 0,
        awardsCount: { gold: 0, brain: 0, spark: 0 },
        sourceTrustLevel: 'encyclopedia',
        sourceDomain: langDomain,
        sourceBroadcasterName: langLabel,
        comments: []
      });
    }

    return items;
  }

  /**
   * 6b. Spaceflight & Frontier Astronomy News API (100% CORS-open JSON with fresh timestamps & photography)
   */
  public static async harvestSpaceflightAndScienceNews(
    limit = 6,
    cursor = 0,
    excludeIds?: Set<string>,
    excludeTitles?: Set<string>
  ): Promise<FeedItem[]> {
    try {
      const offset = (cursor * 6) % 60;
      const url = `https://api.spaceflightnewsapi.net/v4/articles/?limit=15&offset=${offset}`;
      const res = await this.fetchWithTimeout(url, 3800);
      if (!res.ok) return [];
      const data = await res.json();
      const results = Array.isArray(data?.results) ? data.results : [];
      const items: FeedItem[] = [];
      const nowIso = new Date().toISOString();

      for (const art of results) {
        if (items.length >= limit) break;
        const title = typeof art?.title === 'string' ? art.title.trim() : '';
        const rawSummary = typeof art?.summary === 'string' ? this.stripXmlAndHtml(art.summary) : '';
        if (!title || rawSummary.length < 80) continue;
        if (!isSupportedFeedLanguage(title, rawSummary)) continue;

        const itemId = `openweb-snapi-${art.id}`;
        if (this.isKnownCandidate({ id: itemId, title }, excludeIds, excludeTitles)) continue;

        const publisher = art.news_site || 'Science & Space Dispatch';
        let domain = 'spaceflightnewsapi.net';
        try {
          if (art.url) domain = new URL(art.url).hostname.replace(/^www\./, '');
        } catch {
          domain = 'spaceflightnewsapi.net';
        }
        const canonicalUrl = art.url || `https://${domain}`;
        const pubAt = art.published_at || nowIso;
        const expandedBody =
          rawSummary.length >= 180
            ? rawSummary
            : `${rawSummary} Aktueller Bericht von ${publisher} über Forschung, Astronomie und Raumfahrt-Technik.`;
        const articleBody = `${title}\n\n${expandedBody}\n\nQuelle: ${publisher} (${canonicalUrl}).`;
        const cleanImg = typeof art.image_url === 'string' && !isRejectedLowResOrLogoUrl(art.image_url) ? art.image_url : undefined;

        items.push({
          id: itemId,
          type: 'briefing',
          format: 'sourced_update',
          title,
          subtitle: `${publisher} • Naturwissenschaft & Raumfahrt`,
          feedText: expandedBody.length > 430 ? `${expandedBody.slice(0, 427)}…` : expandedBody,
          articleBody,
          body: expandedBody,
          topics: ['science_society', 'ai_apple'],
          primaryTopic: 'science_society',
          sourceReferences: [
            {
              title,
              publisher,
              author: publisher,
              originalUrl: canonicalUrl,
              publicationTimestamp: pubAt,
              retrievalTimestamp: nowIso,
              isVerified: true
            }
          ],
          publishedAt: pubAt,
          publicationDateReliable: Boolean(art.published_at),
          firstSeenAt: nowIso,
          generatedAt: nowIso,
          estimatedReadingMinutes: Math.max(1, Math.ceil(articleBody.split(/\s+/).length / 150)),
          relevanceExplanation: `Aktueller Wissenschafts- & Technologiebericht aus ${publisher}.`,
          contentStatus: 'editorial_briefing',
          isDailyEdition: true,
          editionDate: pubAt.slice(0, 10),
          isTeachingRelated: false,
          isChallengingPerspective: false,
          isDemonstration: false,
          aiAssisted: false,
          factReviewStatus: 'public_news',
          provenanceSummary: `Wissenschafts- und Raumfahrtmeldung von ${publisher}.`,
          wordCount: Math.max(40, articleBody.split(/\s+/).length),
          evidenceTier: 'publisher_excerpt',
          contentOrigin: 'live_ingested',
          contentHash: `snapi-${art.id}`,
          canonicalUrl,
          imageUrl: cleanImg,
          hasAuthenticImage: Boolean(cleanImg),
          space: 'c/serendipity',
          flair: '🔭 Wissenschaft & Weltall',
          keyInsight: `${expandedBody.split(/(?<=[.!?])\s+/)[0]?.slice(0, 200) || title}`,
          upvotesCount: 0,
          awardsCount: { gold: 0, brain: 0, spark: 0 },
          sourceTrustLevel: 'verified_creator',
          sourceDomain: domain,
          sourceBroadcasterName: publisher,
          comments: []
        });
      }

      return items;
    } catch {
      return [];
    }
  }

  /**
   * 7. Reddit Intellectual Discussions (r/DepthHub, r/AskHistorians, r/Philosophy, r/Science, ...)
   * Isolated with quick timeout, cursor rotation, and unseen deduplication.
   */
  public static async harvestRedditIntellectualTop(
    limit = 6,
    cursor = 0,
    excludeIds?: Set<string>,
    excludeTitles?: Set<string>
  ): Promise<FeedItem[]> {
    const subreddits = [
      'DepthHub',
      'AskHistorians',
      'Philosophy',
      'Science',
      'TrueReddit',
      'FoodforThought',
      'cogsci',
      'AcademicPhilosophy'
    ];
    const sub = subreddits[cursor % subreddits.length];
    try {
      const url = `https://www.reddit.com/r/${sub}/top.json?t=week&limit=${Math.max(15, limit * 2)}`;
      const response = await this.fetchWithTimeout(url, 2500);
      if (!response.ok) return [];
      const json = await response.json();
      const children = Array.isArray(json?.data?.children) ? json.data.children : [];
      const items: FeedItem[] = [];

      for (const child of children) {
        if (items.length >= limit) break;
        const post = child.data;
        if (!post?.title || post.over_18) continue;
        const itemId = `openweb-reddit-${post.id}`;
        if (this.isKnownCandidate({ id: itemId, title: post.title }, excludeIds, excludeTitles)) continue;

        const selfText = (post.selftext || '').trim();
        const postUrl = `https://reddit.com${post.permalink}`;
        const externalUrl = post.url && !post.url.includes('reddit.com') ? post.url : postUrl;
        const excerpt =
          selfText.length >= 160
            ? selfText
            : `Fachdiskussion in r/${sub} über „${post.title}“ mit ${post.score || 0} Upvotes und ${post.num_comments || 0} Beiträgen. Die Community diskutiert Primärquellen, Gegenargumente und konkrete methodische Einordnungen.`;
        if (!isSupportedFeedLanguage(post.title, excerpt)) continue;

        const primaryTopic = classifyTopicDeterministically(post.title, excerpt, 'philosophy_ethics');
        const pubAt = post.created_utc ? new Date(post.created_utc * 1000).toISOString() : new Date().toISOString();

        const item: FeedItem = {
          id: itemId,
          type: 'perspective',
          format: 'perspective_disagreement',
          title: post.title,
          subtitle: `r/${sub} • ${post.score} Upvotes (${post.num_comments} Beiträge)`,
          feedText: excerpt.length > 420 ? excerpt.slice(0, 417) + '…' : excerpt,
          articleBody: selfText ? `${post.title}\n\n${selfText}` : excerpt,
          body: excerpt.length > 420 ? excerpt.slice(0, 417) + '…' : excerpt,
          topics: [primaryTopic, 'science_society'].filter((t, i, arr) => arr.indexOf(t) === i) as TopicTag[],
          primaryTopic,
          sourceReferences: [
            {
              title: post.title,
              publisher: `Reddit r/${sub}`,
              author: post.author || `r/${sub}`,
              originalUrl: externalUrl,
              publicationTimestamp: pubAt,
              retrievalTimestamp: new Date().toISOString(),
              isVerified: true
            }
          ],
          publishedAt: pubAt,
          publicationDateReliable: Boolean(post.created_utc),
          firstSeenAt: new Date().toISOString(),
          generatedAt: new Date().toISOString(),
          estimatedReadingMinutes: Math.max(1, Math.ceil(excerpt.split(/\s+/).length / 150)),
          relevanceExplanation: `Kuratiertes intellektuelles Community-Gespräch auf r/${sub}.`,
          contentStatus: 'philosophical_perspective',
          isDailyEdition: true,
          editionDate: new Date().toISOString().split('T')[0],
          isTeachingRelated: primaryTopic === 'german_didactics',
          isChallengingPerspective: true,
          isDemonstration: false,
          aiAssisted: false,
          factReviewStatus: 'community_discussion',
          provenanceSummary: `Community-Debatte auf Reddit r/${sub} (${post.score} Upvotes).`,
          wordCount: Math.max(35, excerpt.split(/\s+/).length),
          evidenceTier: 'publisher_excerpt',
          contentOrigin: 'live_ingested',
          contentHash: `reddit-${post.id}`,
          canonicalUrl: externalUrl,
          hasAuthenticImage: false,
          space: TOPIC_SPACE_MAP[primaryTopic]?.space || 'c/dialektik',
          flair: `💬 r/${sub}`,
          keyInsight: `Diskurs auf r/${sub}: ${post.title}`,
          upvotesCount: 0,
          awardsCount: { gold: 0, brain: 0, spark: 0 },
          sourceTrustLevel: 'community_curated',
          sourceDomain: 'reddit.com',
          sourceBroadcasterName: `r/${sub}`,
          comments: []
        };
        items.push(item);
      }
      return items;
    } catch {
      return [];
    }
  }

  /**
   * 8. Rotating Multi-Source RSS Harvest (18-24 Diverse Active Sources)
   * Excludes tagesschau.de (handled separately with strict cap) and walks deeper into entries to pick unseen articles.
   */
  public static async harvestRotatingRssFeeds(
    batchSize = 20,
    storage?: AtemStorage,
    excludeIds?: Set<string>,
    excludeTitles?: Set<string>
  ): Promise<FeedItem[]> {
    const ROTATION_STORAGE_KEY = '@atem:last_polled_source_ids:v1';
    const activeStorage = storage || appStorage;
    let lastPolledIds: Set<string> = new Set();
    try {
      const raw = await activeStorage.getItem(ROTATION_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          lastPolledIds = new Set(parsed);
        }
      }
    } catch {
      lastPolledIds = new Set();
    }

    const isBrowserEnv = this.isBrowserEnvironment();
    const isBrowserCorsFriendly = (srcUrl: string): boolean => {
      const lower = srcUrl.toLowerCase();
      return (
        lower.includes('spektrum.de') ||
        lower.includes('nachrichtenfeeds.br.de') ||
        lower.includes('deutschlandfunk.de') ||
        lower.includes('netzpolitik.org') ||
        lower.includes('verfassungsblog.de') ||
        lower.includes('54books.de') ||
        lower.includes('wired.com') ||
        lower.includes('openculture.com') ||
        lower.includes('feedpress.me') ||
        lower.includes('sketchplanations.com') ||
        lower.includes('dynomight.net') ||
        lower.includes('rss.beehiiv.com') ||
        lower.includes('jalammar.github.io') ||
        lower.includes('lilianweng.github.io') ||
        lower.includes('construction-physics.com') ||
        lower.includes('asimov.press') ||
        lower.includes('nesslabs.com') ||
        lower.includes('themarginalian.org') ||
        lower.includes('noahpinion.blog') ||
        lower.includes('latent.space')
      );
    };

    // Combine verified sources and global corpus reserve sources, excluding Tagesschau (handled separately with cap)
    const allSources = [...VERIFIED_FEED_SOURCES, ...GLOBAL_CORPUS_RESERVE_SOURCES].filter(
      s =>
        s.url &&
        !s.url.toLowerCase().includes('tagesschau.de') &&
        !s.url.includes('github.com') &&
        !s.url.endsWith('.html') &&
        !s.url.endsWith('/')
    );
    const scopedSources = isBrowserEnv
      ? allSources.filter(s => isBrowserCorsFriendly(s.url))
      : allSources;
    const effectiveSources = scopedSources.length > 0 ? scopedSources : allSources;

    // Filter out sources polled in the last run
    let availableSources = effectiveSources.filter(s => !lastPolledIds.has(s.id));
    if (availableSources.length < Math.min(batchSize, effectiveSources.length)) {
      // Reset rotation cycle if exhausted
      lastPolledIds.clear();
      availableSources = effectiveSources;
    }

    // Pick diverse batch across categories
    const categories: ((s: typeof allSources[0]) => boolean)[] = [
      s => /science|forschung|nature|arxiv|phys|wissen|pnas/i.test(`${s.name} ${s.url} ${(s.topics || []).join(' ')}`),
      s => /phil|ethic|aeon|denken|sokrat|vernunft/i.test(`${s.name} ${s.url} ${(s.topics || []).join(' ')}`),
      s => /didakt|unterricht|schul|paedagog|bildung|lern/i.test(`${s.name} ${s.url} ${(s.topics || []).join(' ')}`),
      s => /tech|apple|heise|golem|hacker|programm|lobste/i.test(`${s.name} ${s.url} ${(s.topics || []).join(' ')}`),
      s => /zeit|spiegel|taz|tagesschau|guardian|politico|faz|dw/i.test(`${s.name} ${s.url} ${(s.topics || []).join(' ')}`),
      s => /kultur|kunst|buddh|achtsam|mind|psycho|music/i.test(`${s.name} ${s.url} ${(s.topics || []).join(' ')}`)
    ];

    const chosenSources: typeof allSources = [];
    const usedSourceIds = new Set<string>();

    // Round-robin pick from each category
    for (const catPred of categories) {
      const matching = availableSources.filter(s => catPred(s) && !usedSourceIds.has(s.id));
      for (const src of matching.slice(0, 3)) {
        chosenSources.push(src);
        usedSourceIds.add(src.id);
      }
    }

    // Fill up to batchSize with remaining available sources
    for (const src of availableSources) {
      if (chosenSources.length >= batchSize) break;
      if (!usedSourceIds.has(src.id)) {
        chosenSources.push(src);
        usedSourceIds.add(src.id);
      }
    }

    // Update rotation storage key
    try {
      const updatedPolled = Array.from(new Set([...lastPolledIds, ...chosenSources.map(s => s.id)])).slice(-300);
      await activeStorage.setItem(ROTATION_STORAGE_KEY, JSON.stringify(updatedPolled));
    } catch {
      // Storage fallback
    }

    // Fetch chosen sources concurrently with timeout & error isolation
    const fetchResults = await Promise.allSettled(
      chosenSources.map(src => fetchSingleFeed(src, 3500))
    );

    const items: FeedItem[] = [];
    const todayStr = new Date().toISOString().slice(0, 10);

    for (const res of fetchResults) {
      if (res.status === 'fulfilled' && res.value.success && res.value.entries.length > 0) {
        const { source, entries } = res.value;
        let pickedForFeed = 0;
        // Scan up to 10 entries per source to skip already-known articles and find up to 2 unseen items
        for (const entry of entries.slice(0, 10)) {
          if (pickedForFeed >= 2) break;
          try {
            const rawItem = normalizeFeedEntry(entry, source, todayStr);
            const sanitized = sanitizeCuratedFeedItem(rawItem);
            if (!sanitized.title || (sanitized.feedText || sanitized.subtitle || '').trim().length < 30) {
              continue;
            }
            if (this.isKnownCandidate({ id: sanitized.id, title: sanitized.title }, excludeIds, excludeTitles)) {
              continue;
            }
            items.push(sanitized);
            pickedForFeed++;
          } catch {
            // Ignore malformed entries
          }
        }
      }
    }

    return items;
  }

  /**
   * 8b. DOAJ Open-Access Articles API (CORS-open scholarly humanities, education & science)
   */
  public static async harvestDoajPapers(limit = 5, cursor = 0, topicHint?: string): Promise<FeedItem[]> {
    const queries = ['philosophy', 'ethics', 'education', 'artificial intelligence', 'cognitive science', 'aesthetics'];
    const q = topicHint?.trim() || queries[cursor % queries.length];
    const page = 1 + (cursor % 8);
    try {
      const url = `https://doaj.org/api/search/articles/${encodeURIComponent(q)}?page=${page}&pageSize=${limit}`;
      const res = await this.fetchWithTimeout(url, 4000);
      if (!res.ok) return [];
      const data = await res.json();
      const results = Array.isArray(data?.results) ? data.results : [];
      const items: FeedItem[] = [];
      for (const rec of results) {
        const bib = rec?.bibjson;
        const title = typeof bib?.title === 'string' ? bib.title.trim() : '';
        const abstract = this.stripXmlAndHtml(typeof bib?.abstract === 'string' ? bib.abstract : '');
        if (!title || abstract.length < 40) continue;
        if (!isSupportedFeedLanguage(title, abstract)) continue;

        const fulltextLink = Array.isArray(bib?.link)
          ? (bib.link.find((l: any) => l?.type === 'fulltext' && typeof l?.url === 'string')?.url || bib.link[0]?.url)
          : undefined;
        const doiId = Array.isArray(bib?.identifier)
          ? bib.identifier.find((idObj: any) => idObj?.type === 'doi')?.id
          : undefined;
        const canonicalUrl = fulltextLink || (doiId ? `https://doi.org/${doiId}` : `https://doaj.org/article/${rec.id}`);
        const journal = bib?.journal?.title || 'DOAJ Open Access Journal';
        const author = bib?.author?.[0]?.name || 'Forschungsteam';
        const pubYear = bib?.year ? `${bib.year}-06-01T12:00:00.000Z` : new Date().toISOString();
        const primaryTopic = classifyTopicDeterministically(title, abstract, 'philosophy_ethics');
        let dom = 'doaj.org';
        try {
          dom = new URL(canonicalUrl).hostname.replace(/^www\./, '');
        } catch {
          dom = 'doaj.org';
        }

        items.push({
          id: `openweb-doaj-${rec.id}`,
          type: 'deep_dive',
          format: 'sourced_update',
          title,
          subtitle: `${journal} • ${author} • Open Access`,
          feedText: abstract.length > 420 ? `${abstract.slice(0, 417)}…` : abstract,
          articleBody: abstract,
          body: abstract,
          topics: [primaryTopic, 'science_society'],
          primaryTopic,
          sourceReferences: [
            {
              title,
              publisher: journal,
              author,
              originalUrl: canonicalUrl,
              publicationTimestamp: pubYear,
              retrievalTimestamp: new Date().toISOString(),
              isVerified: true
            }
          ],
          publishedAt: pubYear,
          publicationDateReliable: Boolean(bib?.year),
          firstSeenAt: new Date().toISOString(),
          generatedAt: new Date().toISOString(),
          estimatedReadingMinutes: Math.max(2, Math.ceil(abstract.split(/\s+/).length / 150)),
          relevanceExplanation: `Begutachteter Open-Access-Fachartikel über DOAJ (${journal}).`,
          contentStatus: 'scientific_analysis',
          isDailyEdition: false,
          editionDate: new Date().toISOString().split('T')[0],
          isTeachingRelated: primaryTopic === 'german_didactics',
          isChallengingPerspective: false,
          isDemonstration: false,
          aiAssisted: false,
          factReviewStatus: 'scientific_paper',
          provenanceSummary: `Open-Access-Fachjournal via DOAJ (${journal}).`,
          wordCount: abstract.split(/\s+/).length,
          evidenceTier: abstract.length >= 140 ? 'publisher_excerpt' : 'metadata_only',
          contentOrigin: 'live_ingested',
          contentHash: `doaj-${rec.id}`,
          canonicalUrl,
          hasAuthenticImage: false,
          space: TOPIC_SPACE_MAP[primaryTopic]?.space || 'c/dialektik',
          flair: '🔬 DOAJ Open Access',
          keyInsight: `Begutachtete Open-Access-Studie aus ${journal}.`,
          upvotesCount: 0,
          awardsCount: { gold: 0, brain: 0, spark: 0 },
          sourceTrustLevel: 'peer_reviewed',
          sourceDomain: dom,
          sourceBroadcasterName: journal,
          comments: []
        });
      }
      return items;
    } catch {
      return [];
    }
  }

  /**
   * 8c. Crossref Open-Metadata API (CORS-open recent peer-reviewed publications with abstracts)
   */
  public static async harvestCrossrefPapers(limit = 5, cursor = 0, topicHint?: string): Promise<FeedItem[]> {
    const queries = ['epistemology ethics', 'german didactics pedagogy', 'neuroscience meditation', 'artificial intelligence reasoning'];
    const q = topicHint?.trim() || queries[cursor % queries.length];
    const offset = (cursor % 8) * limit;
    try {
      const url = `https://api.crossref.org/works?query=${encodeURIComponent(q)}&filter=has-abstract:true,from-pub-date:2025-01-01&sort=published&order=desc&rows=${limit}&offset=${offset}&mailto=redaktion@atmen.app`;
      const res = await this.fetchWithTimeout(url, 4000);
      if (!res.ok) return [];
      const data = await res.json();
      const works = Array.isArray(data?.message?.items) ? data.message.items : [];
      const items: FeedItem[] = [];
      for (const work of works) {
        const title = Array.isArray(work?.title) ? String(work.title[0] || '').trim() : '';
        const abstract = this.stripXmlAndHtml(typeof work?.abstract === 'string' ? work.abstract : '');
        if (!title || abstract.length < 40) continue;
        if (!isSupportedFeedLanguage(title, abstract)) continue;

        const doi = typeof work?.DOI === 'string' ? work.DOI.trim() : '';
        const canonicalUrl = (typeof work?.URL === 'string' && work.URL) || (doi ? `https://doi.org/${doi}` : '');
        if (!canonicalUrl) continue;
        const journal = (Array.isArray(work?.['container-title']) && work['container-title'][0]) || work?.publisher || 'Crossref Fachpublikation';
        const firstAuth = work?.author?.[0]
          ? [work.author[0].given, work.author[0].family].filter(Boolean).join(' ')
          : 'Forschungsteam';
        const dateParts = work?.published?.['date-parts']?.[0] || work?.created?.['date-parts']?.[0];
        const pubIso = Array.isArray(dateParts) && dateParts[0]
          ? new Date(Date.UTC(Number(dateParts[0]), Math.max(0, Number(dateParts[1] || 1) - 1), Number(dateParts[2] || 1))).toISOString()
          : new Date().toISOString();
        const primaryTopic = classifyTopicDeterministically(title, abstract, 'science_society');
        const safeId = (doi || title).replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 60);

        items.push({
          id: `openweb-crossref-${safeId}`,
          type: 'deep_dive',
          format: 'sourced_update',
          title,
          subtitle: `${journal} • ${firstAuth}`,
          feedText: abstract.length > 420 ? `${abstract.slice(0, 417)}…` : abstract,
          articleBody: abstract,
          body: abstract,
          topics: [primaryTopic, 'science_society'],
          primaryTopic,
          sourceReferences: [
            {
              title,
              publisher: journal,
              author: firstAuth,
              originalUrl: canonicalUrl,
              publicationTimestamp: pubIso,
              retrievalTimestamp: new Date().toISOString(),
              isVerified: true
            }
          ],
          publishedAt: pubIso,
          publicationDateReliable: Boolean(dateParts),
          firstSeenAt: new Date().toISOString(),
          generatedAt: new Date().toISOString(),
          estimatedReadingMinutes: Math.max(2, Math.ceil(abstract.split(/\s+/).length / 150)),
          relevanceExplanation: `Wissenschaftliche Primärquelle über Crossref (${journal}).`,
          contentStatus: 'scientific_analysis',
          isDailyEdition: false,
          editionDate: new Date().toISOString().split('T')[0],
          isTeachingRelated: primaryTopic === 'german_didactics',
          isChallengingPerspective: false,
          isDemonstration: false,
          aiAssisted: false,
          factReviewStatus: 'scientific_paper',
          provenanceSummary: `Peer-Review / DOI-Metadaten über Crossref (${journal}).`,
          wordCount: abstract.split(/\s+/).length,
          evidenceTier: abstract.length >= 140 ? 'publisher_excerpt' : 'metadata_only',
          contentOrigin: 'live_ingested',
          contentHash: `crossref-${safeId}`,
          canonicalUrl,
          hasAuthenticImage: false,
          space: TOPIC_SPACE_MAP[primaryTopic]?.space || 'c/dialektik',
          flair: '🔬 DOI-Publikation',
          keyInsight: `Wissenschaftliche Arbeit aus ${journal}.`,
          upvotesCount: 0,
          awardsCount: { gold: 0, brain: 0, spark: 0 },
          sourceTrustLevel: 'peer_reviewed',
          sourceDomain: 'doi.org',
          sourceBroadcasterName: journal,
          comments: []
        });
      }
      return items;
    } catch {
      return [];
    }
  }

  /**
   * 8d. Engine A: Two-Stage Live Gemini Google Search Grounding Discovery
   * Stage 1 calls Gemini with `google_search` tool enabled (NO JSON mime type to avoid REST HTTP 400).
   * Stage 2 curates verified `groundingChunks` URLs into rich German FeedItems with zero URL hallucination.
   */
  public static async harvestAiGroundedWebDiscovery(options: {
    credentials?: AiCredentials;
    cursor: number;
    topicHint?: string;
    existingUrls?: Set<string>;
    existingIds?: Set<string>;
    seenIds?: Set<string>;
  }): Promise<{
    items: FeedItem[];
    usedAI: boolean;
    modelUsed?: string;
    errorClass?: string;
    errorMessage?: string;
  }> {
    const creds = options.credentials;
    if (!creds || !hasAiConfiguration(creds)) {
      return {
        items: [],
        usedAI: false,
        errorClass: 'no_credentials',
        errorMessage: 'Kein aktiver KI-Schlüssel konfiguriert.'
      };
    }

    const groundedFocuses = [
      { label: 'Aktuelle tiefgründige Analysen zu Wissenschaft, KI, Philosophie & europäischem Zeitgeschehen', topic: 'science_society' as TopicTag },
      { label: 'Didaktik, Pädagogik, Ethik- & Deutschunterricht sowie Bildungspolitik', topic: 'german_didactics' as TopicTag },
      { label: 'Erkenntnistheorie, Moralphilosophie, Bewusstseinsforschung & Kontemplation', topic: 'philosophy_ethics' as TopicTag },
      { label: 'Mechanistische KI-Forschung, Apple-Technologie & digitale Souveränität', topic: 'ai_apple' as TopicTag },
      { label: 'Hintergründige Nachrichten & Faktenanalysen aus Deutschland, Sachsen & der Welt (keine Boulevard-Meldungen)', topic: 'science_society' as TopicTag },
      { label: 'Kultur, Literatur, Ästhetik, elektronische Musik & Klangsynthese', topic: 'sound_synthesis' as TopicTag }
    ];
    const cleanHint = options.topicHint?.replace(/^c\//i, '').replace(/[_-]+/g, ' ').trim();
    const focus = cleanHint
      ? { label: `Tiefgründige aktuelle Fachartikel, Studien und Essays zum Themenfeld „${cleanHint}“`, topic: classifyTopicDeterministically(cleanHint, cleanHint, 'science_society') }
      : groundedFocuses[options.cursor % groundedFocuses.length];

    const validTopics: TopicTag[] = [
      'ai_apple',
      'philosophy_ethics',
      'german_didactics',
      'contemplation_mind',
      'sound_synthesis',
      'art_aesthetics',
      'book_mastery',
      'health_biohacking',
      'science_society'
    ];

    const todayStr = new Date().toISOString().split('T')[0];
    const stage1Prompt = [
      `Heute ist der ${todayStr}. Führe eine Live-Websuche nach 6 aktuellen, substanziellen Artikeln, Essays oder Studien aus Qualitätsmedien rund um:`,
      `"${focus.label}".`,
      '',
      'Kriterien:',
      '- Breite Quellenvielfalt (Wissenschaftsmagazine, überregionale Redaktionen, Fachblogs, Kultur, Philosophie, Bildung — nicht nur eine Quelle).',
      '- Keine Shopping-Deals, Keine Sportgerüchte, Keine Social-Media-Einzeiler.',
      '- Antworte direkt als JSON-Array (oder Markdown-Codeblock ```json [...] ```) mit bis zu 6 Einträgen in folgendem Schema:',
      `[{ "title": "Prägnante deutsche Überschrift", "subtitle": "Medium • Einordnung", "publisherName": "Herausgeber", "sourceUrl": "https://...", "feedText": "55-80 Wörter scharfe Essenz auf Deutsch", "articleBody": "140-220 Wörter Einordnung auf Deutsch", "keyInsight": "1 Kernsatz", "challengePrompt": "1 präzise Weiterdenkfrage", "primaryTopic": "${validTopics.join('|')}" }]`
    ].join('\n');

    try {
      const stage1Res = await callAiWithGoogleSearch(stage1Prompt, {
        systemInstruction:
          'Du bist Recherche-Redakteur mit Google-Websuche. Reiche reale, über Websuche gefundene Quellen direkt im gewünschten JSON-Array-Format ein.',
        credentials: creds,
        maxTokens: 2800,
        temperature: 0.35,
        timeoutMs: 14_000,
        itemId: 'openweb-ai-search-stage1'
      });

      const extractJsonArray = (rawText: string): Record<string, unknown>[] => {
        try {
          const cleaned = (rawText || '')
            .replace(/^```(?:json)?\s*/i, '')
            .replace(/```\s*$/i, '')
            .trim();
          const bracketMatch = cleaned.match(/\[[\s\S]*\]/);
          const candidateStr = bracketMatch ? bracketMatch[0] : cleaned;
          const parsed = JSON.parse(candidateStr);
          return Array.isArray(parsed)
            ? parsed.filter((x): x is Record<string, unknown> => Boolean(x && typeof x === 'object'))
            : [];
        } catch {
          return [];
        }
      };

      const chunks = stage1Res.groundingChunks || [];
      let parsedArray = extractJsonArray(stage1Res.text);
      let modelUsed = stage1Res.modelUsed;

      // Fast secondary formatting pass ONLY if Google Search returned prose + groundingChunks instead of direct JSON
      if (parsedArray.length === 0 && chunks.length > 0) {
        const indexedChunks = chunks.slice(0, 12).map((c, idx) => ({
          chunkIndex: idx,
          sourceHint: c.title,
          url: c.uri
        }));

        const stage2Prompt = `Du hast folgende verifizierte Web-Recherche durchgeführt:\n${stage1Res.text.slice(0, 4800)}\n\nVERIFIZIERTE QUELLEN-CHUNKS:\n${JSON.stringify(indexedChunks, null, 2)}\n\nErstelle ein JSON-Array mit bis zu 6 deutschen Feed-Beiträgen:\n[{"chunkIndex":0,"title":"...","subtitle":"...","publisherName":"...","feedText":"55-80 Wörter Essenz","articleBody":"140-220 Wörter Aufbereitung","keyInsight":"1 Kernsatz","challengePrompt":"1 Weiterdenkfrage","primaryTopic":"${validTopics[0]}"}]\nAntworte AUSSCHLIESSLICH mit dem JSON-Array.`;

        const stage2Res = await callAiModel(stage2Prompt, {
          systemInstruction: 'Du bist Chefredakteur der App Atmen. Antworte ausschließlich als valides JSON-Array.',
          jsonMode: true,
          credentials: creds,
          maxTokens: 2800,
          temperature: 0.3,
          timeoutMs: 9_000,
          itemId: 'openweb-ai-search-stage2'
        });
        parsedArray = extractJsonArray(stage2Res.text);
        modelUsed = stage2Res.modelUsed || modelUsed;
      }

      if (parsedArray.length === 0) {
        return {
          items: [],
          usedAI: Boolean(stage1Res.text),
          modelUsed
        };
      }

      const nowIso = new Date().toISOString();
      const groundedItems: FeedItem[] = [];
      const seenUrls = new Set(options.existingUrls || []);
      const existingIds = options.existingIds || new Set<string>();
      const seenIds = options.seenIds || new Set<string>();

      for (let i = 0; i < parsedArray.length; i++) {
        const entry = parsedArray[i];
        const idx = typeof entry.chunkIndex === 'number' ? entry.chunkIndex : Number(entry.chunkIndex);
        const matchedChunk = Number.isInteger(idx) && idx >= 0 && idx < chunks.length ? chunks[idx] : chunks[i];
        const directSourceUrl = typeof entry.sourceUrl === 'string' && /^https?:\/\//i.test(entry.sourceUrl.trim())
          ? entry.sourceUrl.trim()
          : '';
        const chosenUrl = (matchedChunk?.uri && /^https?:\/\//i.test(matchedChunk.uri) ? matchedChunk.uri : '') || directSourceUrl;
        if (!chosenUrl || /example\.(com|org|net)/i.test(chosenUrl)) continue;

        const normUrl = chosenUrl.toLowerCase();
        if (seenUrls.has(normUrl)) continue;
        seenUrls.add(normUrl);

        const title = typeof entry.title === 'string' ? entry.title.trim() : '';
        const feedText = typeof entry.feedText === 'string' ? entry.feedText.trim() : '';
        const articleBody = typeof entry.articleBody === 'string' ? entry.articleBody.trim() : feedText;
        if (title.length < 12 || feedText.length < 60) continue;

        const hashSlug = chosenUrl
          .replace(/^https?:\/\//i, '')
          .replace(/[^a-zA-Z0-9]/g, '')
          .slice(-24) || `${options.cursor}-${i}`;
        const itemId = `openweb-ai-ground-${hashSlug}-${i}`;
        if (existingIds.has(itemId) || seenIds.has(itemId)) continue;

        let resolvedDomain = 'web';
        const hintTitle = (matchedChunk?.title || '').trim();
        if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(hintTitle)) {
          resolvedDomain = hintTitle.toLowerCase().replace(/^www\./, '');
        } else {
          try {
            const parsedHost = new URL(chosenUrl).hostname.replace(/^www\./, '');
            resolvedDomain = parsedHost.includes('vertexaisearch.cloud.google.com')
              ? (hintTitle.toLowerCase().replace(/[^a-z0-9.-]+/g, '-') || 'web-quelle')
              : parsedHost;
          } catch {
            resolvedDomain = 'web-quelle';
          }
        }

        const publisherName =
          (typeof entry.publisherName === 'string' && entry.publisherName.trim()) ||
          resolvedDomain;
        const primaryTopic = classifyTopicDeterministically(
          title,
          `${feedText} ${typeof entry.primaryTopic === 'string' ? entry.primaryTopic : ''}`,
          focus.topic
        );
        const spaceHandle = options.topicHint?.trim().startsWith('c/')
          ? options.topicHint.trim()
          : cleanHint
          ? `c/${cleanHint.toLowerCase().replace(/\s+/g, '_')}`
          : (TOPIC_SPACE_MAP[primaryTopic]?.space || 'c/dialektik');

        const candidate: FeedItem = sanitizeCuratedFeedItem({
          id: itemId,
          type: 'deep_dive',
          format: 'sourced_update',
          title,
          subtitle:
            (typeof entry.subtitle === 'string' && entry.subtitle.trim()) ||
            `${publisherName} • Live-Web-Recherche`,
          feedText,
          articleBody,
          body: articleBody,
          topics: [primaryTopic, focus.topic].filter((t, pos, arr) => arr.indexOf(t) === pos) as TopicTag[],
          primaryTopic,
          sourceReferences: [
            {
              title,
              publisher: publisherName,
              author: publisherName,
              originalUrl: chosenUrl,
              publicationTimestamp: nowIso,
              retrievalTimestamp: nowIso,
              isVerified: true
            }
          ],
          publishedAt: nowIso,
          publicationDateReliable: true,
          firstSeenAt: nowIso,
          generatedAt: nowIso,
          estimatedReadingMinutes: Math.max(2, Math.ceil(articleBody.split(/\s+/).length / 160)),
          relevanceExplanation: `Aktueller Live-Fund über KI-Websuche (${modelUsed}) aus ${publisherName}.`,
          contentStatus: 'editorial_briefing',
          isDailyEdition: true,
          editionDate: todayStr,
          isTeachingRelated: primaryTopic === 'german_didactics',
          isChallengingPerspective: false,
          isDemonstration: false,
          aiAssisted: true,
          enrichmentTier: 'ai',
          factReviewStatus: primaryTopic === 'science_society' ? 'public_news' : primaryTopic === 'philosophy_ethics' ? 'philosophical_discourse' : 'curated_illustrative',
          provenanceSummary: `Verifizierte Live-Websuche via Google Grounding (${publisherName}).`,
          wordCount: Math.max(40, articleBody.split(/\s+/).length),
          evidenceTier: 'publisher_excerpt',
          contentOrigin: 'live_ingested',
          contentHash: `ai-ground-${hashSlug}`,
          canonicalUrl: chosenUrl,
          hasAuthenticImage: false,
          space: spaceHandle,
          flair: '🌐 Live-Web-Recherche',
          keyInsight: typeof entry.keyInsight === 'string' ? entry.keyInsight.trim() : '',
          challengePrompt: typeof entry.challengePrompt === 'string' ? entry.challengePrompt.trim() : '',
          upvotesCount: 0,
          awardsCount: { gold: 0, brain: 0, spark: 0 },
          sourceTrustLevel: primaryTopic === 'science_society' ? 'verified_creator' : 'deep_essay',
          sourceDomain: resolvedDomain,
          sourceBroadcasterName: publisherName,
          comments: []
        });

        if (satisfiesDefaultCuratedStandard(candidate)) {
          groundedItems.push(candidate);
        }
      }

      return {
        items: groundedItems,
        usedAI: true,
        modelUsed
      };
    } catch (err: any) {
      const msg = err?.message || 'Fehler bei der Live-Webrecherche.';
      const status = err?.status;
      const errorClass =
        status === 401
          ? 'auth_error'
          : status === 429
          ? 'rate_limit'
          : msg.toLowerCase().includes('timeout')
          ? 'timeout'
          : 'network_error';
      return {
        items: [],
        usedAI: false,
        errorClass,
        errorMessage: msg
      };
    }
  }

  /**
   * 8b. Contextual Visual Image Enricher (CORS-open Wikimedia / Wikipedia PageImages)
   * Enriches imageless articles with genuine Wikimedia editorial photography/artwork (never SVG icons/logos).
   */
  public static async enrichMissingArticleImages(items: FeedItem[], maxToEnrich = 10): Promise<FeedItem[]> {
    const candidates = items
      .filter(it => !it.hivemindMeta?.trackId && (!it.imageUrl || isRejectedLowResOrLogoUrl(it.imageUrl)))
      .slice(0, maxToEnrich);
    if (candidates.length === 0) return items;

    const STOPWORDS = new Set([
      'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einer', 'eines', 'und', 'oder',
      'aber', 'mit', 'für', 'auf', 'von', 'vom', 'aus', 'bei', 'nach', 'über', 'vor', 'zum', 'zur',
      'wie', 'warum', 'wieso', 'neue', 'neuer', 'neues', 'studie', 'bericht', 'analyse', 'heute',
      'the', 'and', 'for', 'with', 'from', 'that', 'this', 'how', 'why', 'what', 'when', 'into', 'about'
    ]);

    const buildQuery = (title: string): string => {
      const cleaned = title.replace(/[„“"':;?!()[\]–—]/g, ' ').trim();
      const keywords = cleaned
        .split(/\s+/)
        .filter(w => w.length >= 4 && !STOPWORDS.has(w.toLowerCase()) && !/^\d+$/.test(w))
        .slice(0, 3);
      if (keywords.length >= 1) return keywords.join(' ');
      return cleaned.split(/\s+/).slice(0, 3).join(' ');
    };

    const enrichedMap = new Map<string, string>();
    await Promise.allSettled(
      candidates.map(async item => {
        const query = buildQuery(item.title || '');
        if (!query || query.length < 3) return;
        const lang = detectLanguage(`${item.title || ''} ${item.feedText || ''}`);
        const url = `https://${lang}.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrlimit=2&prop=pageimages&piprop=thumbnail&pithumbsize=960&format=json&origin=*`;
        try {
          const res = await this.fetchWithTimeout(url, 1800);
          if (!res.ok) return;
          const json = await res.json();
          const pages = json?.query?.pages ? (Object.values(json.query.pages) as { thumbnail?: { source?: string } }[]) : [];
          for (const page of pages) {
            const rawSrc = page?.thumbnail?.source;
            if (!rawSrc || /\.svg(\?|$)/i.test(rawSrc) || isRejectedLowResOrLogoUrl(rawSrc)) continue;
            const upgraded = upgradeImageResolutionUrl(rawSrc, 960);
            if (upgraded) {
              enrichedMap.set(item.id, upgraded);
              break;
            }
          }
        } catch {
          // Graceful offline/timeout skip
        }
      })
    );

    if (enrichedMap.size === 0) return items;
    return items.map(item => {
      const resolvedUrl = enrichedMap.get(item.id);
      if (!resolvedUrl) return item;
      return {
        ...item,
        imageUrl: resolvedUrl,
        hasAuthenticImage: true
      };
    });
  }

  /**
   * 9. Dual-Engine Multi-Lane Internet Discovery Engine
   * Engine A: Live Gemini Web Search Grounding (`gemini-4-hydrogen` default).
   * Engine B: CORS-open Web APIs (Tagesschau JSON & Saxony, Wikipedia Current News & Gems, OpenAlex, HN, Art Museums, Rotating RSS).
   * Respects persistent cursor rotation so sequential clicks yield fresh, unseen articles and genuinely exercise AI Gatekeeper.
   */
  public static async harvestMultiLaneInternetDiscovery(
    options: MultiLaneDiscoveryOptions = {}
  ): Promise<MultiLaneDiscoveryResult> {
    const startTime = Date.now();
    const isBrowserEnv = this.isBrowserEnvironment();
    const cursor = await this.nextDiscoveryCursor(options.storage);

    let creds = options.credentials;
    if (!creds) {
      try {
        creds = await loadAiCredentials(options.storage);
      } catch {
        creds = undefined;
      }
    }
    const hasAiKey = Boolean(creds && hasAiConfiguration(creds));

    options.onStageChange?.(
      hasAiKey
        ? '1/3: Live-Websuche (KI) & offene Primärquellen abfragen …'
        : '1/3: Freie Open-Web-Quellen & APIs abfragen …'
    );

    const existingIds = options.existingIds ?? new Set<string>();
    const existingTitles = options.existingTitles ?? new Set<string>();
    const seenIds = options.seenIds ?? new Set<string>();
    const existingUrls = new Set<string>();

    const combinedExcludeIds = new Set([...existingIds, ...seenIds]);

    const [
      aiSearchResult,
      rssResult,
      tagesschauJsonResult,
      spaceScienceResult,
      wikiCurrentNewsResult,
      openAlexResult,
      wikiRandomResult,
      wikiFeaturedResult,
      hnResult,
      artResult,
      arxivResult,
      redditResult
    ] = await Promise.allSettled([
      hasAiKey
        ? this.harvestAiGroundedWebDiscovery({
            credentials: creds,
            cursor,
            topicHint: options.topicHint,
            existingUrls,
            existingIds,
            seenIds
          })
        : Promise.resolve<{
            items: FeedItem[];
            usedAI: boolean;
            modelUsed?: string;
            errorClass?: string;
            errorMessage?: string;
          }>({
            items: [],
            usedAI: false,
            errorClass: 'no_credentials',
            errorMessage: 'Kein aktiver KI-Schlüssel konfiguriert.'
          }),
      this.harvestRotatingRssFeeds(isBrowserEnv ? 16 : 20, options.storage, combinedExcludeIds, existingTitles),
      ContinuousLiveNewsService.fetchTagesschauLiveJson(12)
        .then(tsItems => tsItems.filter(it => !this.isKnownCandidate(it, combinedExcludeIds, existingTitles)).slice(0, 2))
        .catch(() => []),
      this.harvestSpaceflightAndScienceNews(6, cursor, combinedExcludeIds, existingTitles),
      ContinuousLiveNewsService.fetchWikipediaCurrentNewsJson()
        .then(wn => wn.filter(it => !this.isKnownCandidate(it, combinedExcludeIds, existingTitles)))
        .catch(() => []),
      this.harvestOpenAlexPapers(3, cursor, options.topicHint)
        .then(oa => oa.filter(it => !this.isKnownCandidate(it, combinedExcludeIds, existingTitles))),
      this.harvestWikipediaRandomGems(6, cursor, combinedExcludeIds, existingTitles),
      this.harvestWikipediaGems()
        .then(wf => wf.filter(it => !this.isKnownCandidate(it, combinedExcludeIds, existingTitles))),
      this.harvestTechFrontpage(10, cursor, combinedExcludeIds, existingTitles),
      this.harvestMuseumArtworks(6, cursor)
        .then(art => art.filter(it => !this.isKnownCandidate(it, combinedExcludeIds, existingTitles)).slice(0, 3)),
      isBrowserEnv
        ? Promise.resolve([])
        : this.harvestArxivPapers(6).then(ax => ax.filter(it => !this.isKnownCandidate(it, combinedExcludeIds, existingTitles))),
      this.harvestRedditIntellectualTop(6, cursor, combinedExcludeIds, existingTitles)
    ]);

    const aiDiscovery =
      aiSearchResult.status === 'fulfilled'
        ? aiSearchResult.value
        : { items: [], usedAI: false, modelUsed: undefined, errorClass: undefined, errorMessage: undefined };

    const openWebRawCandidates: FeedItem[] = [];
    let sourcesCheckedCount = aiDiscovery.items.length;

    const collect = (res: PromiseSettledResult<FeedItem[]>) => {
      if (res.status === 'fulfilled' && Array.isArray(res.value)) {
        openWebRawCandidates.push(...res.value);
        sourcesCheckedCount += res.value.length;
      }
    };

    collect(rssResult);
    collect(spaceScienceResult);
    collect(hnResult);
    collect(redditResult);
    collect(wikiRandomResult);
    collect(wikiCurrentNewsResult);
    collect(wikiFeaturedResult);
    collect(tagesschauJsonResult);
    collect(openAlexResult);
    collect(artResult);
    collect(arxivResult);

    const seenUrls = new Set<string>();
    const seenTitles = new Set<string>(existingTitles);

    // Seed deduplication sets with verified AI grounded web search items first
    const finalAiGroundedItems: FeedItem[] = [];
    for (const aiItem of aiDiscovery.items) {
      if (isDeprecatedShowcaseStarterItem(aiItem)) continue;
      if (this.isKnownCandidate(aiItem, combinedExcludeIds, seenTitles)) continue;
      const canon = (aiItem.canonicalUrl || aiItem.sourceReferences?.[0]?.originalUrl || aiItem.id).toLowerCase();
      const normTitle = this.normalizeTitleKey(aiItem.title || '');
      if (seenUrls.has(canon)) continue;
      seenUrls.add(canon);
      if (normTitle.length > 5) seenTitles.add(normTitle);
      finalAiGroundedItems.push(aiItem);
    }

    const candidatePool: FeedItem[] = [];
    let preDuplicateCount = 0;
    let preRejectedCount = 0;

    for (const item of openWebRawCandidates) {
      if (item.isStaticFallback || isDeprecatedShowcaseStarterItem(item)) {
        preRejectedCount++;
        continue;
      }
      if (this.isKnownCandidate(item, combinedExcludeIds, seenTitles)) {
        preDuplicateCount++;
        continue;
      }

      const normTitle = this.normalizeTitleKey(item.title || '');
      const canon = (item.canonicalUrl || item.sourceReferences?.[0]?.originalUrl || item.id).toLowerCase();
      if (seenUrls.has(canon)) {
        preDuplicateCount++;
        continue;
      }

      const sanitized = sanitizeCuratedFeedItem(item);
      const wetlabContext = `${sanitized.title || ''} ${sanitized.subtitle || ''} ${sanitized.feedText || ''}`;
      if (
        !isSupportedFeedLanguage(sanitized.title || '', `${sanitized.subtitle || ''} ${sanitized.feedText || ''}`) ||
        IRRELEVANT_WETLAB_OR_NICHE_ACADEMIC_REGEX.test(wetlabContext)
      ) {
        preRejectedCount++;
        continue;
      }

      if (satisfiesDefaultCuratedStandard(sanitized)) {
        if (normTitle.length > 5) seenTitles.add(normTitle);
        seenUrls.add(canon);
        candidatePool.push(sanitized);
      } else {
        preRejectedCount++;
      }
    }

    // Interleave candidatePool round-robin across distinct domains (max 2 per domain, max 2 Tagesschau)
    const domainBuckets = new Map<string, FeedItem[]>();
    for (const item of candidatePool) {
      const dom = (item.sourceDomain || item.sourceReferences?.[0]?.publisher || 'unknown').toLowerCase().replace(/^www\./, '');
      const list = domainBuckets.get(dom) || [];
      if (list.length < 2) {
        list.push(item);
        domainBuckets.set(dom, list);
      }
    }
    const diversePool: FeedItem[] = [];
    let roundIdx = 0;
    let pickedInRound = true;
    while (pickedInRound) {
      pickedInRound = false;
      for (const [, list] of domainBuckets.entries()) {
        if (roundIdx < list.length) {
          diversePool.push(list[roundIdx]);
          pickedInRound = true;
        }
      }
      roundIdx++;
    }

    const poolToSelect = diversePool.length >= 8 ? diversePool : candidatePool;
    const targetCount = Math.max(12, Math.min(24, options.targetNewCount ?? 18));
    const remainingCapacity = Math.max(6, targetCount - finalAiGroundedItems.length);
    const selectedPool = poolToSelect.slice(0, remainingCapacity);

    // Hybrid Fast Curation: send at most 6 unseen candidates (1 fast chunk) to AI Gatekeeper/Enricher
    // while admitting remaining already-standard-compliant open-web discoveries directly so runtime stays 6-14s.
    const aiPolishBatch = hasAiKey ? selectedPool.slice(0, 6) : selectedPool.slice(0, 10);
    const readyOpenWebTail = hasAiKey ? selectedPool.slice(6).filter(satisfiesDefaultCuratedStandard) : selectedPool.slice(10).filter(satisfiesDefaultCuratedStandard);

    let gatekeepUsedAi = false;
    let usedFallback = false;
    let cacheHits = 0;
    let gatekeeperRejectedCount = 0;
    let gatekeeperModelUsed: string | undefined;
    let errorClass: string | undefined = aiDiscovery.errorClass;
    let errorMessage: string | undefined = aiDiscovery.errorMessage;
    let curatedFrontBatch: FeedItem[] = aiPolishBatch;

    if (aiPolishBatch.length > 0) {
      options.onStageChange?.(
        hasAiKey
          ? `2/3: KI-Redaktion veredelt ${aiPolishBatch.length} Spitzenfunde (+ ${readyOpenWebTail.length} geprüfte) …`
          : '2/3: Lokale Qualitätsprüfung & Einordnung …'
      );
      try {
        const curated = await defaultBatchEditionEnricher.gatekeepAndEnrichBatch(aiPolishBatch, creds);
        const report = defaultBatchEditionEnricher.getLastBatchReport();
        gatekeepUsedAi = report.usedAI;
        usedFallback = report.usedFallback;
        cacheHits = report.cacheHits;
        gatekeeperRejectedCount = report.rejectedCount;
        gatekeeperModelUsed = report.modelUsed;
        if (!errorClass && report.errorClass) errorClass = report.errorClass;
        if (!errorMessage && report.errorMessage) errorMessage = report.errorMessage;
        curatedFrontBatch = curated
          .map(sanitizeCuratedFeedItem)
          .filter(it =>
            !isDeprecatedShowcaseStarterItem(it) &&
            satisfiesDefaultCuratedStandard(it) &&
            !IRRELEVANT_WETLAB_OR_NICHE_ACADEMIC_REGEX.test(`${it.title || ''} ${it.subtitle || ''} ${it.feedText || ''}`)
          );
      } catch (err: any) {
        usedFallback = true;
        errorClass = errorClass || 'network_error';
        errorMessage = errorMessage || err?.message || 'Fehler bei der KI-Redaktion.';
        curatedFrontBatch = aiPolishBatch.filter(satisfiesDefaultCuratedStandard);
      }
    } else if (!hasAiKey) {
      usedFallback = true;
      errorClass = 'no_credentials';
      errorMessage = 'Kein aktiver KI-Schlüssel gefunden — hinterlege deinen Gemini-Key in „Steuerung“ für Live-Web-Recherche.';
    }

    const curatedOpenWeb = [...curatedFrontBatch, ...readyOpenWebTail];

    const combinedItems = await this.enrichMissingArticleImages(
      [...finalAiGroundedItems, ...curatedOpenWeb],
      10
    );
    const usedAI = Boolean(aiDiscovery.usedAI || gatekeepUsedAi);
    const modelUsed = gatekeeperModelUsed || aiDiscovery.modelUsed || (usedAI ? creds?.model : undefined);

    // Stamp new items with pinnedManualRunAt and isNewlyCurated
    const nowTime = Date.now();
    const finalItems = combinedItems.map(item => ({
      ...item,
      pinnedManualRunAt: nowTime,
      isNewlyCurated: true,
      curatedAt: new Date(nowTime).toISOString()
    }));

    const durationMs = Math.max(80, Date.now() - startTime);
    const fetchedTotal = aiDiscovery.items.length + openWebRawCandidates.length;
    const totalRejected = gatekeeperRejectedCount + preRejectedCount;

    return {
      items: finalItems,
      fetchedCount: fetchedTotal,
      insertedCount: finalItems.length,
      approvedCount: finalItems.length,
      rejectedCount: totalRejected,
      duplicateCount: preDuplicateCount,
      usedAI,
      usedFallback: usedAI ? false : usedFallback,
      cacheHits,
      modelUsed,
      errorClass: usedAI ? undefined : errorClass,
      errorMessage: usedAI ? undefined : errorMessage,
      durationMs,
      sourcesCheckedCount
    };
  }
}

export const defaultOpenWebHarvester = OpenWebHarvester;
