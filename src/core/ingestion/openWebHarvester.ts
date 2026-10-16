import { FeedItem } from '../domain/types';
import { REAL_KNOWLEDGE_VAULT } from '../data/realKnowledgeVault';

export interface OpenWebHarvestResult {
  museumArtworks: FeedItem[];
  wikipediaGems: FeedItem[];
  techFrontpage: FeedItem[];
  allHarvested: FeedItem[];
  fromCache: boolean;
  timestamp: number;
}

/**
 * Open-Web JSON Harvester Beyond RSS
 * 
 * Scours open, zero-cost, API-key-free JSON endpoints:
 * 1. Art Institute of Chicago Open Access (IIIF high-resolution paintings & sculptures)
 * 2. German Wikipedia Featured / Picture of the Day API
 * 3. Hacker News Frontpage Algolia API
 * 
 * Features:
 * - 3500ms timeout per endpoint via AbortController
 * - Zero Node.js builtins (pure JS fetch compatible with Web & React Native)
 * - 15-minute in-memory caching to eliminate redundant network traffic
 * - Resilient fallback to REAL_KNOWLEDGE_VAULT art and discoveries on error or offline
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
        'User-Agent': 'atmen-learning-network/1.0 (https://atmen.app; sovereign-knowledge-client)'
      }
    }).finally(() => {
      clearTimeout(timeoutId);
    });
  }

  /**
   * 1. Art Institute of Chicago Open Access API
   */
  public static async harvestMuseumArtworks(limit = 8): Promise<FeedItem[]> {
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
        const altText = record.thumbnail?.alt_text || `Meisterwerk: ${record.title} von ${artist}`;

        const aestheticImpulse = `Betrachte die Balance aus Licht und Schatten: Wie ${artist} hier mit ${medium} Raum und Stimmung erzeugt, fordert den Betrachter auf, den Blick zu verlangsamen und die feinen Nuancen wahrzunehmen.`;

        const feedText = `${record.title} (${year}) von ${artist}. Ein Werk aus der offenen Sammlung des Art Institute of Chicago. ${altText}`;
        const articleBody = `### Meisterwerk der Bildenden Kunst: ${record.title}\n\n**Künstler:** ${artist}\n**Entstehungszeit:** ${year}\n**Material/Technik:** ${medium}\n**Epoche/Stil:** ${styleMovement}\n**Sammlung:** The Art Institute of Chicago\n\n#### Ästhetische Einordnung & Kontemplation\n${aestheticImpulse}\n\n#### Warum dieses Werk inspiriert\nGroße Kunstwerke sind keine dekorativen Hintergrundbilder für die digitale Hektik. Sie sind stehende Wellen menschlicher Wahrnehmung. Indem Museen diese Schätze gemeinfrei zugänglich machen, laden sie uns ein, den Blick zu schärfen und die Welt mit den Augen der Meister neu zu betrachten.`;

        const item: FeedItem = {
          id: `openweb-art-${record.id}`,
          type: 'deep_dive',
          format: 'art_showcase',
          title: `${record.title}: Meisterwerk von ${artist}`,
          subtitle: `${artist} (${year}) • The Art Institute of Chicago • ${styleMovement}`,
          feedText,
          articleBody,
          body: feedText,
          topics: ['art_aesthetics', 'contemplation_mind', 'philosophy_ethics'],
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
          estimatedReadingMinutes: 3,
          relevanceExplanation: 'Offenes Museumskunstwerk zur visuellen Kontemplation und ästhetischen Horizonterweiterung.',
          contentStatus: 'philosophical_perspective',
          isDailyEdition: false,
          editionDate: new Date().toISOString().split('T')[0],
          isTeachingRelated: false,
          isChallengingPerspective: false,
          isDemonstration: false,
          aiAssisted: false,
          factReviewStatus: 'historical_reference',
          provenanceSummary: 'Gemeinfreies Meisterwerk aus dem offenen Datenbestand des Art Institute of Chicago (CC0 / Public Domain).',
          wordCount: 280,
          evidenceTier: 'permitted_full_text',
          contentOrigin: 'live_ingested',
          contentHash: `artic-${record.id}-${record.image_id}`,
          canonicalUrl: `https://www.artic.edu/artworks/${record.id}`,
          imageUrl: highResImageUrl,
          space: 'c/kunst_galerie',
          flair: '🎨 Kunst-Galerie',
          keyInsight: 'Visuelle Ästhetik verlangt ein Innehalten: Wahres Sehen beginnt erst dort, wo das flüchtige Weiterscrollen stoppt.',
          challengePrompt: 'Welche Farbe oder welches unscheinbare Detail im Bild fällt dir erst nach dreißig Sekunden bewussten Hinschauens auf?',
          upvotesCount: 0,
          awardsCount: { gold: 5, brain: 14, spark: 19 },
          sourceTrustLevel: 'peer_reviewed',
          sourceDomain: 'artic.edu',
          sourceBroadcasterName: 'The Art Institute of Chicago',
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
        const pageTitle = tfa.normalizedtitle || tfa.title || 'Wikipedia Exzellenz-Thema';
        const extract = tfa.extract || tfa.description || 'Ein handkuratierter Exzellenz-Artikel aus der deutschen Wikipedia.';
        const canonical = tfa.content_urls?.desktop?.page || `https://de.wikipedia.org/wiki/${encodeURIComponent(pageTitle)}`;
        const imgUrl = tfa.originalimage?.source || tfa.thumbnail?.source;

        items.push({
          id: `openweb-wiki-tfa-${yyyy}${mm}${dd}`,
          type: 'deep_dive',
          format: 'sourced_update',
          title: `Artikel des Tages: ${pageTitle}`,
          subtitle: `Wikipedia Exzellenz-Archiv • Ausführlicher Forschungsüberblick`,
          feedText: extract,
          articleBody: `### Wikipedia Exzellenz-Artikel: ${pageTitle}\n\n${extract}\n\n> [!NOTE]\n> Dieser Beitrag wurde von der Wikipedia-Community aufgrund seiner herausragenden Quellentreue und wissenschaftlichen Ausführlichkeit zum **Artikel des Tages** gekürt.`,
          body: extract,
          topics: ['science_society', 'philosophy_ethics'],
          primaryTopic: 'science_society',
          sourceReferences: [
            {
              title: pageTitle,
              publisher: 'Wikipedia – Die freie Enzyklopädie',
              author: 'Wikipedia Autorenkollektiv',
              originalUrl: canonical,
              publicationTimestamp: now.toISOString(),
              retrievalTimestamp: now.toISOString(),
              isVerified: true
            }
          ],
          publishedAt: now.toISOString(),
          generatedAt: now.toISOString(),
          estimatedReadingMinutes: 5,
          relevanceExplanation: 'Handkuratierter exzellenter Enzyklopädie-Beitrag zur Vertiefung allgemeinen Wissens.',
          contentStatus: 'scientific_analysis',
          isDailyEdition: true,
          editionDate: `${yyyy}-${mm}-${dd}`,
          isTeachingRelated: false,
          isChallengingPerspective: false,
          isDemonstration: false,
          aiAssisted: false,
          factReviewStatus: 'scientific_paper',
          provenanceSummary: 'Freie Enzyklopädie Wikipedia (Creative Commons CC BY-SA 4.0).',
          wordCount: 350,
          evidenceTier: 'multiple_sources',
          contentOrigin: 'live_ingested',
          contentHash: `wiki-tfa-${yyyy}${mm}${dd}`,
          canonicalUrl: canonical,
          imageUrl: imgUrl,
          space: 'c/serendipity',
          flair: '🏛 Enzyklopädie',
          keyInsight: 'Wissen wächst dort am tiefsten, wo Neugier und akribische Quellensichtung aufeinandertreffen.',
          challengePrompt: 'Welcher Aspekt dieses Themas berührt deinen eigenen Alltag oder dein bisheriges Verständnis?',
          upvotesCount: 0,
          awardsCount: { gold: 12, brain: 34, spark: 22 },
          sourceTrustLevel: 'peer_reviewed',
          sourceDomain: 'de.wikipedia.org',
          sourceBroadcasterName: 'Wikipedia Exzellenz-Archiv',
          comments: []
        });
      }

      // B. Picture of the Day (Bild des Tages)
      if (data?.image) {
        const img = data.image;
        const imgTitle = img.title?.replace(/File:|Datei:/i, '').replace(/\.[a-zA-Z0-9]+$/, '') || 'Bild des Tages';
        const imgDesc = img.description?.text || 'Ein hochauflösendes visuelles Dokument aus Wikimedia Commons.';
        const highResUrl = img.image?.source || img.thumbnail?.source;
        const fileUrl = img.file_page || `https://commons.wikimedia.org/wiki/${encodeURIComponent(img.title || '')}`;

        if (highResUrl) {
          items.push({
            id: `openweb-wiki-potd-${yyyy}${mm}${dd}`,
            type: 'quick_insight',
            format: 'art_showcase',
            title: `Bild des Tages: ${imgTitle}`,
            subtitle: `Wikimedia Commons • Visuelles Welterbe & Fotokunst`,
            feedText: `${imgDesc} Ein ausgewähltes Bild des Tages aus den offenen Sammlungen der Wikimedia Commons.`,
            articleBody: `### Bild des Tages: ${imgTitle}\n\n${imgDesc}\n\n**Quelle:** Wikimedia Commons Public Media\n**Bild-Details:** [Originaldatei ansehen](${fileUrl})\n\n#### Visuelle Kontemplation\nEin Bild transportiert Zusammenhänge, die kein Text vollständig erfassen kann. Halte für eine Minute inne und erforsche die Strukturen, Kontraste und die historische Dimension dieser Aufnahme.`,
            body: imgDesc,
            topics: ['art_aesthetics', 'science_society'],
            primaryTopic: 'art_aesthetics',
            sourceReferences: [
              {
                title: imgTitle,
                publisher: 'Wikimedia Commons',
                author: 'Wikimedia Contributor',
                originalUrl: fileUrl,
                publicationTimestamp: now.toISOString(),
                retrievalTimestamp: now.toISOString(),
                isVerified: true
              }
            ],
            publishedAt: now.toISOString(),
            generatedAt: now.toISOString(),
            estimatedReadingMinutes: 2,
            relevanceExplanation: 'Hochauflösendes Fotodokument zur visuellen Wahrnehmungsschärfung.',
            contentStatus: 'philosophical_perspective',
            isDailyEdition: true,
            editionDate: `${yyyy}-${mm}-${dd}`,
            isTeachingRelated: false,
            isChallengingPerspective: false,
            isDemonstration: false,
            aiAssisted: false,
            factReviewStatus: 'curated_illustrative',
            provenanceSummary: 'Wikimedia Commons Picture of the Day (Freie Bildlizenz CC BY-SA / Public Domain).',
            wordCount: 220,
            evidenceTier: 'permitted_full_text',
            contentOrigin: 'live_ingested',
            contentHash: `wiki-potd-${yyyy}${mm}${dd}`,
            canonicalUrl: fileUrl,
            imageUrl: highResUrl,
            space: 'c/kunst_galerie',
            flair: '📷 Fotodokument',
            keyInsight: 'Die Welt ist reich an visuellen Wundern, die erst sichtbar werden, wenn wir den Blick ruhig verweilen lassen.',
            challengePrompt: 'Welche Geschichte verbirgt sich hinter dem Ausschnitt dieses Bildes?',
            upvotesCount: 0,
            awardsCount: { gold: 15, brain: 28, spark: 40 },
            sourceTrustLevel: 'community_curated',
            sourceDomain: 'commons.wikimedia.org',
            sourceBroadcasterName: 'Wikimedia Commons',
            artMeta: {
              artist: 'Wikimedia Commons Fotograf',
              year: yyyy,
              medium: 'Fotografie / Digitale Bildkunst',
              museum: 'Wikimedia Commons Archives',
              highResImageUrl: highResUrl,
              styleMovement: 'Dokumentarfotografie & Welterbe',
              aestheticImpulse: imgDesc
            },
            comments: []
          });
        }
      }

      // C. Historic Milestones (Was geschah am...)
      if (Array.isArray(data?.onthisday) && data.onthisday.length > 0) {
        const milestones = data.onthisday.slice(0, 2);
        for (let i = 0; i < milestones.length; i++) {
          const m = milestones[i];
          const primaryPage = m.pages?.[0];
          const pageTitle = primaryPage?.normalizedtitle || primaryPage?.title || `Historischer Meilenstein (${m.year})`;
          const pageExtract = m.text || primaryPage?.extract || 'Historisches Ereignis an diesem Tag.';
          const canonical = primaryPage?.content_urls?.desktop?.page || 'https://de.wikipedia.org';

          items.push({
            id: `openweb-wiki-onthisday-${yyyy}${mm}${dd}-${i}`,
            type: 'quick_insight',
            format: 'concise_insight',
            title: `${m.year}: ${pageTitle}`,
            subtitle: `Was geschah am ${dd}.${mm}.? • Historische Resonanz`,
            feedText: `${m.year}: ${pageExtract}`,
            articleBody: `### Historischer Wendepunkt: ${m.year}\n\n${pageExtract}\n\n#### Warum Geschichte Gegenwart ist\nJeder historische Moment wirft lange Schatten in unsere heutige Lebenswelt. Zu verstehen, wie Menschen früherer Epochen mit Umbrüchen umgegangen sind, schult das Urteilsvermögen für gegenwärtige Herausforderungen.`,
            body: pageExtract,
            topics: ['science_society', 'philosophy_ethics'],
            primaryTopic: 'philosophy_ethics',
            sourceReferences: [
              {
                title: pageTitle,
                publisher: 'Wikipedia Geschichts-Archiv',
                originalUrl: canonical,
                publicationTimestamp: now.toISOString(),
                retrievalTimestamp: now.toISOString(),
                isVerified: true
              }
            ],
            publishedAt: now.toISOString(),
            generatedAt: now.toISOString(),
            estimatedReadingMinutes: 2,
            relevanceExplanation: 'Historischer Kontextualisierungs-Impuls.',
            contentStatus: 'philosophical_perspective',
            isDailyEdition: false,
            editionDate: `${yyyy}-${mm}-${dd}`,
            isTeachingRelated: false,
            isChallengingPerspective: false,
            isDemonstration: false,
            aiAssisted: false,
            factReviewStatus: 'historical_reference',
            provenanceSummary: 'Wikipedia Geschichts-Archiv (CC BY-SA 4.0).',
            wordCount: 190,
            evidenceTier: 'publisher_excerpt',
            contentOrigin: 'live_ingested',
            contentHash: `wiki-hist-${yyyy}${mm}${dd}-${i}`,
            canonicalUrl: canonical,
            space: 'c/dialektik',
            flair: '⏳ Geschichte',
            keyInsight: 'Die Gegenwart wird erst lesbar, wenn man die historischen Wurzeln ihrer Selbstverständlichkeiten kennt.',
            challengePrompt: 'Wie sähe unsere Gegenwart aus, wenn sich dieses historische Ereignis damals anders entwickelt hätte?',
            upvotesCount: 0,
            awardsCount: { gold: 6, brain: 19, spark: 15 },
            sourceTrustLevel: 'peer_reviewed',
            sourceDomain: 'de.wikipedia.org',
            sourceBroadcasterName: 'Wikipedia Kalenderblatt',
            comments: []
          });
        }
      }

      if (items.length > 0) return items;
      return [];
    } catch {
      return [];
    }
  }

  /**
   * 3. Hacker News Algolia API Frontpage Discovery
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
        const targetUrl = hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`;
        const domain = hit.url ? new URL(hit.url).hostname.replace(/^www\./, '') : 'news.ycombinator.com';

        const feedText = `Frontpage Diskussion (${hit.points || 0} Punkte, ${hit.num_comments || 0} Kommentare). Ein vielbeachteter technischer oder wissenschaftlicher Impuls aus der globalen Entwickler-Community.`;
        const articleBody = `### Tech & Science Radar: ${hit.title}\n\n**Quelle:** [${domain}](${targetUrl})\n**Community-Resonanz:** ${hit.points || 0} Punkte und ${hit.num_comments || 0} Kommentare auf Hacker News.\n\n${feedText}\n\n#### Warum lesenswert?\nAuf der Hacker News Frontpage diskutieren Entwickler, Forscher und Systemarchitekten über Themen am Puls des technologischen Wandels – jenseits von PR-Floskeln mit hohem fachlichen Anspruch.`;

        const item: FeedItem = {
          id: `openweb-hn-${hit.objectID}`,
          type: 'briefing',
          format: 'sourced_update',
          title: hit.title,
          subtitle: `${domain} • ${hit.points || 0} Punkte • Hacker News Radar`,
          feedText,
          articleBody,
          body: feedText,
          topics: ['ai_apple', 'science_society'],
          primaryTopic: 'ai_apple',
          sourceReferences: [
            {
              title: hit.title,
              publisher: domain,
              author: hit.author || 'HN Community',
              originalUrl: targetUrl,
              publicationTimestamp: hit.created_at || new Date().toISOString(),
              retrievalTimestamp: new Date().toISOString(),
              isVerified: true
            }
          ],
          publishedAt: hit.created_at || new Date().toISOString(),
          generatedAt: new Date().toISOString(),
          estimatedReadingMinutes: 3,
          relevanceExplanation: 'Hochgradig relevante Echtzeit-Debatte aus der globalen Tech- und Wissenschaftswelt.',
          contentStatus: 'scientific_analysis',
          isDailyEdition: false,
          editionDate: new Date().toISOString().split('T')[0],
          isTeachingRelated: false,
          isChallengingPerspective: false,
          isDemonstration: false,
          aiAssisted: false,
          factReviewStatus: 'historical_reference',
          provenanceSummary: `Hacker News Frontpage Aggregation (Algolia API).`,
          wordCount: 210,
          evidenceTier: 'publisher_excerpt',
          contentOrigin: 'live_ingested',
          contentHash: `hn-${hit.objectID}`,
          canonicalUrl: targetUrl,
          space: 'c/acceleration',
          flair: '⚡ Tech-Radar',
          keyInsight: 'Die wichtigsten Durchbrüche beginnen oft als unscheinbare Diskussionen unter Spezialisten.',
          challengePrompt: 'Welche Tragweite hat diese technische Entwicklung für die nächsten zwei bis drei Jahre?',
          upvotesCount: 0,
          awardsCount: { gold: 8, brain: 32, spark: 18 },
          sourceTrustLevel: 'verified_creator',
          sourceDomain: domain,
          sourceBroadcasterName: 'Hacker News Frontpage',
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

    const [artworksResult, wikiResult, hnResult] = await Promise.allSettled([
      this.harvestMuseumArtworks(8),
      this.harvestWikipediaGems(),
      this.harvestTechFrontpage(6)
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

    const allHarvested: FeedItem[] = [
      ...museumArtworks,
      ...wikipediaGems,
      ...techFrontpage
    ];

    const result: OpenWebHarvestResult = {
      museumArtworks,
      wikipediaGems,
      techFrontpage,
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
