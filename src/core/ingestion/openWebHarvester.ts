import { FeedItem } from '../domain/types';
import { REAL_KNOWLEDGE_VAULT } from '../data/realKnowledgeVault';

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

  private static fetchWithTimeout(url: string, timeoutMs = 3500): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'atmen-learning-network/2.0 (https://atmen.app; sovereign-knowledge-client)'
      }
    }).finally(() => {
      clearTimeout(timeoutId);
    });
  }

  /**
   * 1. Art Institute of Chicago Open Access API
   * Note: Artworks are categorized as museum_collection / art_showcase, never as live news.
   */
  public static async harvestMuseumArtworks(limit = 6): Promise<FeedItem[]> {
    try {
      const url = `https://api.artic.edu/api/v1/artworks/search?q=painting+landscape+impressionism+modern&query[term][is_public_domain]=true&fields=id,title,artist_display,date_display,medium_display,image_id,thumbnail,style_title,classification_title&limit=${limit}`;
      const response = await this.fetchWithTimeout(url, 3500);
      if (!response.ok) {
        throw new Error(`Art Institute API responded with status ${response.status}`);
      }
      const data = await response.json();
      const records = Array.isArray(data?.data) ? data.data : [];

      const items: FeedItem[] = [];

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
              publicationTimestamp: new Date().toISOString(),
              retrievalTimestamp: new Date().toISOString(),
              isVerified: true
            }
          ],
          publishedAt: new Date().toISOString(),
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

      if (items.length > 0) return items;
      return this.getLocalArtFallback();
    } catch {
      return this.getLocalArtFallback();
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
            space: 'c/serendipity',
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
                publicationTimestamp: now.toISOString(),
                retrievalTimestamp: now.toISOString(),
                isVerified: true
              }
            ],
            publishedAt: now.toISOString(),
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
                publicationTimestamp: now.toISOString(),
                retrievalTimestamp: now.toISOString(),
                isVerified: true
              }
            ],
            publishedAt: now.toISOString(),
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
   * 3. Hacker News Algolia API Frontpage Discovery
   * Stores real HN points/comments in externalCommunityScore; internal upvotes/awards are 0.
   */
  public static async harvestTechFrontpage(limit = 6): Promise<FeedItem[]> {
    try {
      const url = `https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=${limit}`;
      const response = await this.fetchWithTimeout(url, 3500);
      if (!response.ok) {
        throw new Error(`Hacker News Algolia responded with status ${response.status}`);
      }
      const data = await response.json();
      const hits = Array.isArray(data?.hits) ? data.hits : [];
      const items: FeedItem[] = [];

      for (const hit of hits) {
        if (!hit.title || !hit.objectID) continue;
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

        const feedText = `Diskutiert auf Hacker News (${points} HN-Punkte, ${numComments} Kommentare) • Primärquelle: ${domain}.`;
        const articleBody = `${hit.title}\n\nVeröffentlicht auf: ${domain}\nOriginal-URL: ${targetUrl}\nHacker-News-Diskussion (${points} Punkte, ${numComments} Beiträge): ${hnUrl}`;

        const item: FeedItem = {
          id: `openweb-hn-${hit.objectID}`,
          type: 'quick_insight',
          format: 'concise_insight',
          title: hit.title,
          subtitle: `${domain} • ${points} HN-Punkte (${numComments} Kommentare)`,
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
              publicationTimestamp: hit.created_at || new Date().toISOString(),
              retrievalTimestamp: new Date().toISOString(),
              isVerified: true
            }
          ],
          publishedAt: hit.created_at || new Date().toISOString(),
          generatedAt: new Date().toISOString(),
          estimatedReadingMinutes: 1,
          relevanceExplanation: `Aktuelle Fachdiskussion aus der Hacker-News-Community (${points} HN-Punkte).`,
          contentStatus: 'editorial_briefing',
          isDailyEdition: false,
          editionDate: new Date().toISOString().split('T')[0],
          isTeachingRelated: false,
          isChallengingPerspective: false,
          isDemonstration: false,
          aiAssisted: false,
          factReviewStatus: 'community_discussion',
          provenanceSummary: `Community-Fundstück von ${domain}, kuratiert auf Hacker News (${points} Punkte, ${numComments} Kommentare).`,
          wordCount: 35,
          evidenceTier: 'metadata_only',
          contentOrigin: 'live_ingested',
          contentHash: `hn-${hit.objectID}`,
          canonicalUrl: targetUrl,
          hasAuthenticImage: false,
          space: 'c/acceleration',
          flair: '💬 HN-Community',
          keyInsight: `Externes Community-Signal: ${points} Punkte und ${numComments} Debattenbeiträge auf Hacker News.`,
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
   */
  public static async harvestOpenAlexPapers(limit = 5): Promise<FeedItem[]> {
    try {
      const url = `https://api.openalex.org/works?filter=is_oa:true,has_abstract:true,from_publication_date:2025-01-01&sort=cited_by_count:desc&per-page=${limit}`;
      const response = await this.fetchWithTimeout(url, 3500);
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

        // Reconstruct abstract from OpenAlex abstract_inverted_index if available
        let abstractText = '';
        if (work.abstract_inverted_index && typeof work.abstract_inverted_index === 'object') {
          const wordsByPos: string[] = [];
          for (const [word, positions] of Object.entries(work.abstract_inverted_index)) {
            if (Array.isArray(positions)) {
              for (const pos of positions) {
                if (typeof pos === 'number' && pos < 250) {
                  wordsByPos[pos] = word;
                }
              }
            }
          }
          abstractText = wordsByPos.filter(Boolean).join(' ').trim();
        }

        if (abstractText.length < 40) {
          abstractText = `Open-Access-Forschungsarbeit veröffentlicht in ${journal} (${work.cited_by_count || 0} wissenschaftliche Zitationen).`;
        }

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
          space: 'c/serendipity',
          flair: '🔬 Fachpublikation',
          keyInsight: `Forschungsarbeit aus ${journal} (${work.cited_by_count || 0} Zitationen).`,
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
}

export const defaultOpenWebHarvester = OpenWebHarvester;
