/**
 * Bright-Web Open API Adapters & Flagship Signal Detector
 *
 * Works identically in Node.js (4-hourly snapshot/reservoir pipeline) and Browser
 * (live channel flourishing where CORS allows):
 * - Art Institute of Chicago Open Access CC0 API (CORS=*)
 * - Cleveland Museum of Art Open Access CC0 API
 * - Wikipedia DE & EN Featured REST API (TFA + Picture of the Day, CORS=*)
 * - Curated "Bright Side of the Internet" Flagship Publisher Detector
 */

import { FeedItem } from '../domain/types';
import { isRejectedLowResOrLogoUrl } from '../utils/imageQuality';
import { pureJsSha256 } from './normalizer';

const DEFAULT_TIMEOUT_MS = 4500;

const BRIGHT_WEB_FLAGSHIP_TOKENS: readonly string[] = [
  'aeon.co',
  'psyche.co',
  'quantamagazine.org',
  'publicdomainreview.org',
  'themarginalian.org',
  'fivebooks.com',
  '54books.de',
  'xkcd.com',
  'what-if.xkcd.com',
  'smbc-comics.com',
  'existentialcomics.com',
  'pbfcomics.com',
  'theoatmeal.com',
  'sketchplanations.com',
  'daily.bandcamp.com',
  'cdm.link',
  'synthtopia.com',
  'headphonecommute.com',
  'acloserlisten.com',
  'deutsches-schulportal.de',
  'learningscientists.org',
  'cultofpedagogy.com',
  'bobblume.de',
  'simonwillison.net',
  'lilianweng.github.io',
  'huggingface.co',
  'lobste.rs',
  'kagi.com',
  'kagi-smallweb',
  'asteriskmag.com',
  'fs.blog',
  'construction-physics.com',
  'peterattiamd.com',
  'quarks.de',
  'ndr.de',
  'spektrum.de',
  'dailynous.com',
  'plato.stanford.edu',
  'philosophynow.org',
  'plumvillage.org',
  'tricycle.org',
  'lionsroar.com',
  'artic.edu',
  'clevelandart.org',
  'wikipedia.org',
  'wikimedia.org',
  'pudding.cool',
  'thisiscolossal.com',
  'nautil.us',
  'openculture.com',
  'atlasobscura.com',
  '3blue1brown',
  'veritasium',
  'kurzgesagt',
  'numberphile',
  'computerphile',
  'deutschlandfunkkultur.de',
  'greatergood.berkeley.edu',
  'calnewport.com',
  'craigmod.com',
  'robinsloan.com'
];

const HTML_ENTITY_MAP: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
  '&mdash;': '—',
  '&ndash;': '–',
  '&hellip;': '…',
  '&laquo;': '«',
  '&raquo;': '»'
};

function stripHtmlClean(input: string | null | undefined): string {
  if (!input || typeof input !== 'string') return '';
  const withoutTags = input
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
  const decoded = withoutTags
    .replace(/&#(\d+);/g, (_match, code: string) => {
      const n = Number.parseInt(code, 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : ' ';
    })
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex: string) => {
      const n = Number.parseInt(hex, 16);
      return Number.isFinite(n) ? String.fromCodePoint(n) : ' ';
    })
    .replace(/&[a-z0-9#]+;/gi, (entity) => HTML_ENTITY_MAP[entity.toLowerCase()] ?? entity);
  return decoded.replace(/\s+/g, ' ').trim();
}

function truncateClean(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const slice = text.slice(0, Math.max(0, maxLength - 1)).trim();
  const lastSpace = slice.lastIndexOf(' ');
  const cut = lastSpace > maxLength * 0.6 ? slice.slice(0, lastSpace) : slice;
  return `${cut.replace(/[.,;:!?-]+$/, '')}…`;
}

function countWords(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return Math.max(12, words.length);
}

function extractHostname(rawUrl?: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  try {
    return new URL(rawUrl).hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return '';
  }
}

async function fetchJsonWithTimeout<T>(url: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json'
      },
      signal: controller.signal
    });
    if (!response.ok) {
      return null;
    }
    const parsed: unknown = await response.json();
    return parsed as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function ensureHttpUrl(candidate?: string | null): string | undefined {
  if (!candidate || typeof candidate !== 'string') return undefined;
  const trimmed = candidate.trim();
  if (trimmed.startsWith('https://') || trimmed.startsWith('http://')) {
    return trimmed;
  }
  return undefined;
}

/**
 * Returns true when an item originates from a curated "Bright Side of the Internet"
 * flagship domain, museum collection, encyclopedia, or creator across all 12 channels.
 */
export function isBrightWebFlagshipItem(item: Partial<FeedItem> | null | undefined): boolean {
  if (!item || typeof item !== 'object') return false;

  const candidateFields: string[] = [
    item.sourceDomain ?? '',
    extractHostname(item.canonicalUrl),
    item.canonicalUrl ?? '',
    extractHostname(item.sourceReferences?.[0]?.originalUrl),
    item.sourceReferences?.[0]?.originalUrl ?? '',
    item.sourceReferences?.[0]?.publisher ?? '',
    item.sourceBroadcasterName ?? '',
    item.youtubeMeta?.channelTitle ?? '',
    item.artMeta?.museum ?? '',
    item.id ?? ''
  ];

  const haystack = candidateFields
    .filter((value) => value.length > 0)
    .join(' ')
    .toLowerCase();

  if (!haystack) return false;

  for (const token of BRIGHT_WEB_FLAGSHIP_TOKENS) {
    if (haystack.includes(token)) {
      return true;
    }
  }
  return false;
}

/* ============================================================================
 * 1. Art Institute of Chicago Open Access CC0 Adapter
 * ========================================================================== */

interface ArticArtworkRecord {
  id?: number;
  title?: string | null;
  artist_display?: string | null;
  date_display?: string | null;
  medium_display?: string | null;
  place_of_origin?: string | null;
  department_title?: string | null;
  image_id?: string | null;
  thumbnail?: {
    alt_text?: string | null;
  } | null;
  short_description?: string | null;
  is_public_domain?: boolean | null;
}

interface ArticApiResponse {
  data?: ArticArtworkRecord[];
}

export interface ArtInstituteFetchOptions {
  limit?: number;
  page?: number;
  today?: string;
}

function buildArticProse(art: ArticArtworkRecord, artist: string, year: string, medium: string): {
  feedText: string;
  articleBody: string;
  aestheticImpulse: string;
} {
  const shortDesc = stripHtmlClean(art.short_description);
  const altText = stripHtmlClean(art.thumbnail?.alt_text);
  const origin = stripHtmlClean(art.place_of_origin);
  const department = stripHtmlClean(art.department_title);
  const title = stripHtmlClean(art.title);

  const metaParts: string[] = [];
  if (artist) metaParts.push(artist);
  if (year) metaParts.push(year);
  if (origin) metaParts.push(origin);
  if (medium) metaParts.push(medium);
  if (department) metaParts.push(`Abteilung: ${department}`);
  const metaSentence = `„${title}“ (${metaParts.join(' · ')}) stammt aus der gemeinfreien Open-Access-Sammlung des Art Institute of Chicago.`;

  let primaryNarrative = shortDesc;
  if (primaryNarrative.length < 80 && altText) {
    primaryNarrative = primaryNarrative
      ? `${primaryNarrative} ${altText}`
      : altText;
  }
  if (primaryNarrative.length < 80) {
    primaryNarrative = primaryNarrative
      ? `${primaryNarrative} ${metaSentence}`
      : metaSentence;
  }

  const feedText = truncateClean(primaryNarrative, 520);
  const detailParagraphs: string[] = [primaryNarrative];
  if (altText && !primaryNarrative.includes(altText)) {
    detailParagraphs.push(`Bildbeschreibung: ${altText}`);
  }
  if (!primaryNarrative.includes('Art Institute of Chicago')) {
    detailParagraphs.push(metaSentence);
  }
  const articleBody = detailParagraphs.join('\n\n');

  const aestheticImpulse = shortDesc.length >= 45
    ? truncateClean(shortDesc, 220)
    : `${title} von ${artist} (${year}) — ${medium}${origin ? `, ${origin}` : ''}, aus der Sammlung des Art Institute of Chicago.`;

  return { feedText, articleBody, aestheticImpulse };
}

export async function fetchArtInstituteArtworks(
  options: ArtInstituteFetchOptions = {}
): Promise<FeedItem[]> {
  const limit = Math.max(1, Math.min(24, options.limit ?? 8));
  const fetchLimit = Math.min(40, Math.max(limit * 3, 18));
  const today = options.today ?? new Date().toISOString().slice(0, 10);
  const daySeed = Number.parseInt(today.replace(/-/g, ''), 10) || 1;
  const page = options.page && options.page > 0 ? Math.floor(options.page) : (daySeed % 18) + 1;

  const fields = [
    'id',
    'title',
    'artist_display',
    'date_display',
    'medium_display',
    'place_of_origin',
    'department_title',
    'image_id',
    'thumbnail',
    'short_description',
    'is_public_domain'
  ].join(',');

  const apiUrl = `https://api.artic.edu/api/v1/artworks?page=${page}&limit=${fetchLimit}&fields=${fields}`;
  const payload = await fetchJsonWithTimeout<ArticApiResponse>(apiUrl, DEFAULT_TIMEOUT_MS);
  if (!payload || !Array.isArray(payload.data)) {
    return [];
  }

  const nowIso = new Date().toISOString();
  const items: FeedItem[] = [];
  const seenIds = new Set<number>();

  for (const art of payload.data) {
    if (items.length >= limit) break;
    if (!art || !art.is_public_domain || !art.image_id || !art.title || typeof art.id !== 'number') {
      continue;
    }
    if (seenIds.has(art.id)) continue;

    const cleanTitle = stripHtmlClean(art.title);
    if (!cleanTitle) continue;

    const imageUrl = `https://www.artic.edu/iiif/2/${art.image_id}/full/843,/0/default.jpg`;
    const highResImageUrl = `https://www.artic.edu/iiif/2/${art.image_id}/full/1200,/0/default.jpg`;
    if (isRejectedLowResOrLogoUrl(imageUrl)) continue;

    const artistRaw = stripHtmlClean((art.artist_display ?? '').split('\n')[0]);
    const artist = artistRaw || 'Unbekannte Künstlerin / Unbekannter Künstler';
    const year = stripHtmlClean(art.date_display) || 'Historisches Werk';
    const medium = stripHtmlClean(art.medium_display) || 'Bildende Kunst';
    const department = stripHtmlClean(art.department_title) || 'Museums-Sammlung';

    const { feedText, articleBody, aestheticImpulse } = buildArticProse(art, artist, year, medium);
    if (feedText.length < 80) continue;

    seenIds.add(art.id);
    const canonicalUrl = `https://www.artic.edu/artworks/${art.id}`;
    const contentHash = pureJsSha256(`${canonicalUrl}|${cleanTitle}|${art.image_id}`);
    const words = countWords(articleBody);

    items.push({
      id: `bright-artic-${art.id}`,
      type: 'quick_insight',
      format: 'art_showcase',
      space: 'c/kunst_galerie',
      flair: 'Kunst & Kultur',
      title: cleanTitle,
      subtitle: truncateClean(`${artist} (${year}) · ${department}`, 150),
      feedText,
      articleBody,
      body: feedText,
      topics: ['art_aesthetics', 'contemplation_mind'],
      primaryTopic: 'art_aesthetics',
      sourceReferences: [
        {
          publisher: 'Art Institute of Chicago',
          originalUrl: canonicalUrl,
          title: `${cleanTitle} (${artist})`,
          retrievalTimestamp: nowIso,
          author: artist,
          isVerified: true
        }
      ],
      publishedAt: nowIso,
      publicationDateReliable: false,
      historicalYearOrEra: year,
      firstSeenAt: nowIso,
      generatedAt: nowIso,
      estimatedReadingMinutes: Math.max(1, Math.min(5, Math.ceil(words / 180))),
      relevanceExplanation: 'Gemeinfreies Meisterwerk (CC0) aus der Sammlung des Art Institute of Chicago.',
      contentStatus: 'philosophical_perspective',
      isDailyEdition: true,
      editionDate: today,
      isDemonstration: false,
      aiAssisted: false,
      factReviewStatus: 'historical_reference',
      provenanceSummary: 'Open-Access-Sammlung (CC0): Art Institute of Chicago.',
      wordCount: words,
      evidenceTier: 'permitted_full_text',
      contentOrigin: 'live_ingested',
      contentHash,
      canonicalUrl,
      imageUrl,
      imageCredit: `${artist} · Art Institute of Chicago (CC0)`,
      hasAuthenticImage: true,
      isTeachingRelated: false,
      isChallengingPerspective: false,
      keyInsight: aestheticImpulse,
      challengePrompt: 'Welche Details in Komposition, Licht und Material fallen erst beim zweiten Blick auf?',
      upvotesCount: 0,
      awardsCount: { gold: 0, brain: 0, spark: 0 },
      comments: [],
      sourceTrustLevel: 'museum_collection',
      sourceDomain: 'artic.edu',
      sourceBroadcasterName: 'Art Institute of Chicago',
      artMeta: {
        artist,
        year,
        medium,
        museum: 'Art Institute of Chicago',
        highResImageUrl,
        styleMovement: department,
        aestheticImpulse
      }
    });
  }

  return items;
}

/* ============================================================================
 * 2. Cleveland Museum of Art Open Access CC0 Adapter
 * ========================================================================== */

interface ClevelandCreator {
  description?: string | null;
}

interface ClevelandArtworkRecord {
  id?: number;
  accession_number?: string | null;
  title?: string | null;
  creation_date?: string | null;
  technique?: string | null;
  department?: string | null;
  culture?: string[] | null;
  wall_description?: string | null;
  fun_fact?: string | null;
  description?: string | null;
  url?: string | null;
  creators?: ClevelandCreator[] | null;
  images?: {
    web?: { url?: string | null } | null;
    print?: { url?: string | null } | null;
  } | null;
}

interface ClevelandApiResponse {
  data?: ClevelandArtworkRecord[];
}

export interface ClevelandMuseumFetchOptions {
  limit?: number;
  skip?: number;
  today?: string;
}

function buildClevelandProse(
  art: ClevelandArtworkRecord,
  artist: string,
  year: string,
  medium: string,
  department: string
): {
  feedText: string;
  articleBody: string;
  aestheticImpulse: string;
} {
  const title = stripHtmlClean(art.title);
  const wallDesc = stripHtmlClean(art.wall_description);
  const funFact = stripHtmlClean(art.fun_fact);
  const desc = stripHtmlClean(art.description);
  const culture = Array.isArray(art.culture) ? art.culture.map((c) => stripHtmlClean(c)).filter(Boolean).join(', ') : '';

  const metaParts: string[] = [artist, year];
  if (culture) metaParts.push(culture);
  if (medium) metaParts.push(medium);
  if (department) metaParts.push(department);
  const metaSentence = `„${title}“ (${metaParts.join(' · ')}) gehört zur gemeinfreien Open-Access-Sammlung des Cleveland Museum of Art.`;

  let primaryNarrative = wallDesc || desc || funFact;
  if (primaryNarrative.length < 80 && funFact && !primaryNarrative.includes(funFact)) {
    primaryNarrative = primaryNarrative ? `${primaryNarrative} ${funFact}` : funFact;
  }
  if (primaryNarrative.length < 80 && desc && !primaryNarrative.includes(desc)) {
    primaryNarrative = primaryNarrative ? `${primaryNarrative} ${desc}` : desc;
  }
  if (primaryNarrative.length < 80) {
    primaryNarrative = primaryNarrative ? `${primaryNarrative} ${metaSentence}` : metaSentence;
  }

  const feedText = truncateClean(primaryNarrative, 520);
  const paragraphs: string[] = [primaryNarrative];
  if (funFact && !primaryNarrative.includes(funFact)) {
    paragraphs.push(`Kuratorischer Hinweis: ${funFact}`);
  }
  if (!primaryNarrative.includes('Cleveland Museum of Art')) {
    paragraphs.push(metaSentence);
  }
  const articleBody = paragraphs.join('\n\n');

  const aestheticImpulse = wallDesc.length >= 45
    ? truncateClean(wallDesc, 220)
    : funFact.length >= 45
    ? truncateClean(funFact, 220)
    : `${title} von ${artist} (${year}) — ${medium}, Open-Access-Sammlung des Cleveland Museum of Art.`;

  return { feedText, articleBody, aestheticImpulse };
}

export async function fetchClevelandMuseumArtworks(
  options: ClevelandMuseumFetchOptions = {}
): Promise<FeedItem[]> {
  const limit = Math.max(1, Math.min(24, options.limit ?? 6));
  const fetchLimit = Math.min(36, Math.max(limit * 3, 18));
  const today = options.today ?? new Date().toISOString().slice(0, 10);
  const daySeed = Number.parseInt(today.replace(/-/g, ''), 10) || 1;
  const skip = options.skip !== undefined && options.skip >= 0
    ? Math.floor(options.skip)
    : (daySeed % 40) * 12;

  const apiUrl = `https://openaccess-api.clevelandart.org/api/artworks/?has_image=1&cc0=1&limit=${fetchLimit}&skip=${skip}`;
  const payload = await fetchJsonWithTimeout<ClevelandApiResponse>(apiUrl, DEFAULT_TIMEOUT_MS);
  if (!payload || !Array.isArray(payload.data)) {
    return [];
  }

  const nowIso = new Date().toISOString();
  const items: FeedItem[] = [];
  const seenIds = new Set<number>();

  for (const art of payload.data) {
    if (items.length >= limit) break;
    if (!art || typeof art.id !== 'number' || !art.title) continue;
    if (seenIds.has(art.id)) continue;

    const webImageUrl = ensureHttpUrl(art.images?.web?.url);
    if (!webImageUrl || isRejectedLowResOrLogoUrl(webImageUrl)) continue;
    const highResImageUrl = ensureHttpUrl(art.images?.print?.url) ?? webImageUrl;

    const cleanTitle = stripHtmlClean(art.title);
    if (!cleanTitle) continue;

    const creatorDesc = stripHtmlClean(art.creators?.[0]?.description);
    const artist = creatorDesc || 'Unbekannte Künstlerin / Unbekannter Künstler';
    const year = stripHtmlClean(art.creation_date) || 'Historisches Werk';
    const medium = stripHtmlClean(art.technique) || 'Bildende Kunst';
    const department = stripHtmlClean(art.department) || 'Museums-Sammlung';

    const { feedText, articleBody, aestheticImpulse } = buildClevelandProse(
      art,
      artist,
      year,
      medium,
      department
    );
    if (feedText.length < 80) continue;

    seenIds.add(art.id);
    const accession = stripHtmlClean(art.accession_number);
    const canonicalUrl =
      ensureHttpUrl(art.url) ??
      `https://www.clevelandart.org/art/${encodeURIComponent(accession || String(art.id))}`;
    const contentHash = pureJsSha256(`${canonicalUrl}|${cleanTitle}|${webImageUrl}`);
    const words = countWords(articleBody);

    items.push({
      id: `bright-cma-${art.id}`,
      type: 'quick_insight',
      format: 'art_showcase',
      space: 'c/kunst_galerie',
      flair: 'Kunst & Kultur',
      title: cleanTitle,
      subtitle: truncateClean(`${artist} (${year}) · ${department}`, 150),
      feedText,
      articleBody,
      body: feedText,
      topics: ['art_aesthetics', 'contemplation_mind'],
      primaryTopic: 'art_aesthetics',
      sourceReferences: [
        {
          publisher: 'Cleveland Museum of Art',
          originalUrl: canonicalUrl,
          title: `${cleanTitle} (${artist})`,
          retrievalTimestamp: nowIso,
          author: artist,
          isVerified: true
        }
      ],
      publishedAt: nowIso,
      publicationDateReliable: false,
      historicalYearOrEra: year,
      firstSeenAt: nowIso,
      generatedAt: nowIso,
      estimatedReadingMinutes: Math.max(1, Math.min(5, Math.ceil(words / 180))),
      relevanceExplanation: 'Gemeinfreies Kunstwerk (CC0) aus der Open-Access-Sammlung des Cleveland Museum of Art.',
      contentStatus: 'philosophical_perspective',
      isDailyEdition: true,
      editionDate: today,
      isDemonstration: false,
      aiAssisted: false,
      factReviewStatus: 'historical_reference',
      provenanceSummary: 'Open-Access-Sammlung (CC0): Cleveland Museum of Art.',
      wordCount: words,
      evidenceTier: 'permitted_full_text',
      contentOrigin: 'live_ingested',
      contentHash,
      canonicalUrl,
      imageUrl: webImageUrl,
      imageCredit: `${artist} · Cleveland Museum of Art (CC0)`,
      hasAuthenticImage: true,
      isTeachingRelated: false,
      isChallengingPerspective: false,
      keyInsight: aestheticImpulse,
      challengePrompt: 'Was verraten Technik, Material und Entstehungszeit über die visuelle Sprache dieses Werks?',
      upvotesCount: 0,
      awardsCount: { gold: 0, brain: 0, spark: 0 },
      comments: [],
      sourceTrustLevel: 'museum_collection',
      sourceDomain: 'clevelandart.org',
      sourceBroadcasterName: 'Cleveland Museum of Art',
      artMeta: {
        artist,
        year,
        medium,
        museum: 'Cleveland Museum of Art',
        highResImageUrl,
        styleMovement: department,
        aestheticImpulse
      }
    });
  }

  return items;
}

/* ============================================================================
 * 3. Wikipedia DE & EN Featured REST API Adapter (TFA + Picture of the Day)
 * ========================================================================== */

interface WikiImageRef {
  source?: string | null;
  width?: number;
  height?: number;
}

interface WikiTfaPayload {
  title?: string | null;
  normalizedtitle?: string | null;
  displaytitle?: string | null;
  description?: string | null;
  extract?: string | null;
  originalimage?: WikiImageRef | null;
  thumbnail?: WikiImageRef | null;
  content_urls?: {
    desktop?: {
      page?: string | null;
    } | null;
  } | null;
}

interface WikiPotdPayload {
  title?: string | null;
  image?: WikiImageRef | null;
  thumbnail?: WikiImageRef | null;
  description?: {
    text?: string | null;
    html?: string | null;
  } | null;
  artist?: {
    text?: string | null;
  } | null;
  credit?: {
    text?: string | null;
  } | null;
  file_page?: string | null;
}

interface WikiFeaturedResponse {
  tfa?: WikiTfaPayload | null;
  image?: WikiPotdPayload | null;
}

export interface WikipediaBrightFetchOptions {
  date?: Date;
  today?: string;
}

function buildWikipediaTfaItem(
  lang: 'de' | 'en',
  tfa: WikiTfaPayload,
  yyyy: string,
  mm: string,
  dd: string,
  today: string,
  nowIso: string
): FeedItem | null {
  const title = stripHtmlClean(tfa.normalizedtitle || tfa.title || '');
  const extract = stripHtmlClean(tfa.extract);
  if (!title || extract.length < 140) {
    return null;
  }

  const description = stripHtmlClean(tfa.description);
  const canonicalUrl =
    ensureHttpUrl(tfa.content_urls?.desktop?.page) ??
    `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/\s+/g, '_'))}`;

  const rawImg = ensureHttpUrl(tfa.originalimage?.source) ?? ensureHttpUrl(tfa.thumbnail?.source);
  const imageUrl = rawImg && !isRejectedLowResOrLogoUrl(rawImg) ? rawImg : undefined;

  const feedText = truncateClean(extract, 520);
  const articleBody = description && !extract.toLowerCase().includes(description.toLowerCase())
    ? `${description}\n\n${extract}`
    : extract;
  const words = countWords(articleBody);

  const label = lang === 'de' ? 'Wikipedia Artikel des Tages (DE)' : 'Wikipedia Featured Article (EN)';
  const subtitle = description
    ? truncateClean(`${description} · ${label}`, 150)
    : label;

  const keyInsight = truncateClean(
    description
      ? `${title}: ${description} — enzyklopädischer Einstieg als Ausgangspunkt für Primärquellen.`
      : `${title} — ausgewählter Überblicksartikel der Wikipedia (${lang.toUpperCase()}).`,
    220
  );

  const contentHash = pureJsSha256(`${canonicalUrl}|${title}|${extract.slice(0, 240)}`);

  return {
    id: `bright-wiki-tfa-${lang}-${yyyy}${mm}${dd}`,
    type: 'deep_dive',
    format: 'long_invitation',
    space: 'c/serendipity',
    flair: 'Wissenschaft',
    title,
    subtitle,
    feedText,
    articleBody,
    body: feedText,
    topics: ['science_society', 'philosophy_ethics'],
    primaryTopic: 'science_society',
    sourceReferences: [
      {
        publisher: lang === 'de' ? 'Wikipedia (DE)' : 'Wikipedia (EN)',
        originalUrl: canonicalUrl,
        title,
        publicationTimestamp: nowIso,
        retrievalTimestamp: nowIso,
        author: 'Wikipedia Contributors',
        isVerified: true
      }
    ],
    publishedAt: nowIso,
    publicationDateReliable: true,
    firstSeenAt: nowIso,
    generatedAt: nowIso,
    estimatedReadingMinutes: Math.max(2, Math.min(8, Math.ceil(words / 180))),
    relevanceExplanation:
      lang === 'de'
        ? 'Ausgezeichneter Wikipedia-Artikel des Tages als strukturierter Wissens-Einstieg.'
        : 'Featured Wikipedia article of the day for serendipitous interdisciplinary discovery.',
    contentStatus: 'editorial_briefing',
    isDailyEdition: true,
    editionDate: today,
    isDemonstration: false,
    aiAssisted: false,
    factReviewStatus: 'encyclopedia_entry',
    provenanceSummary: `Enzyklopädischer Überblick aus Wikipedia (${lang.toUpperCase()}, CC BY-SA 4.0).`,
    wordCount: words,
    evidenceTier: 'publisher_excerpt',
    contentOrigin: 'live_ingested',
    contentHash,
    canonicalUrl,
    imageUrl,
    hasAuthenticImage: Boolean(imageUrl),
    isTeachingRelated: false,
    isChallengingPerspective: false,
    keyInsight,
    challengePrompt: 'Welche Primärquelle oder historische Perspektive lohnt nach diesem Überblick eine tiefere Prüfung?',
    upvotesCount: 0,
    awardsCount: { gold: 0, brain: 0, spark: 0 },
    comments: [],
    sourceTrustLevel: 'encyclopedia',
    sourceDomain: `${lang}.wikipedia.org`,
    sourceBroadcasterName: lang === 'de' ? 'Wikipedia (DE)' : 'Wikipedia (EN)'
  };
}

function buildWikipediaPotdItem(
  lang: 'de' | 'en',
  potd: WikiPotdPayload,
  yyyy: string,
  mm: string,
  dd: string,
  today: string,
  nowIso: string
): FeedItem | null {
  const rawImage = ensureHttpUrl(potd.image?.source) ?? ensureHttpUrl(potd.thumbnail?.source);
  if (!rawImage || isRejectedLowResOrLogoUrl(rawImage)) {
    return null;
  }

  const rawDesc = stripHtmlClean(potd.description?.text || potd.description?.html);
  const rawTitle = stripHtmlClean(potd.title)
    .replace(/^(?:File|Datei):/i, '')
    .replace(/\.[a-z0-9]{2,5}$/i, '')
    .replace(/_/g, ' ')
    .trim();
  const artist = stripHtmlClean(potd.artist?.text || potd.credit?.text) || 'Wikimedia Commons Contributors';
  const title = rawTitle || (lang === 'de' ? `Bild des Tages (${today})` : `Picture of the Day (${today})`);

  const museumLabel = lang === 'de' ? 'Wikimedia Commons · Bild des Tages' : 'Wikimedia Commons · Picture of the Day';
  let prose = rawDesc;
  if (prose.length < 80) {
    const context = lang === 'de'
      ? `${title} — ausgewähltes Wikimedia-Commons-Bild des Tages (${today}), festgehalten von ${artist}.`
      : `${title} — featured Wikimedia Commons Picture of the Day (${today}), photographed or created by ${artist}.`;
    prose = prose ? `${prose} ${context}` : context;
  }
  if (prose.length < 80) {
    return null;
  }

  const canonicalUrl =
    ensureHttpUrl(potd.file_page) ??
    `https://commons.wikimedia.org/wiki/${encodeURIComponent(potd.title || title)}`;
  const feedText = truncateClean(prose, 520);
  const words = countWords(prose);
  const contentHash = pureJsSha256(`${canonicalUrl}|${title}|${rawImage}`);
  const aestheticImpulse = truncateClean(prose, 220);

  return {
    id: `bright-wiki-potd-${lang}-${yyyy}${mm}${dd}`,
    type: 'quick_insight',
    format: 'art_showcase',
    space: 'c/kunst_galerie',
    flair: 'Kunst & Kultur',
    title: truncateClean(title, 140),
    subtitle: truncateClean(`${artist} · ${museumLabel}`, 150),
    feedText,
    articleBody: prose,
    body: feedText,
    topics: ['art_aesthetics', 'science_society'],
    primaryTopic: 'art_aesthetics',
    sourceReferences: [
      {
        publisher: museumLabel,
        originalUrl: canonicalUrl,
        title,
        publicationTimestamp: nowIso,
        retrievalTimestamp: nowIso,
        author: artist,
        isVerified: true
      }
    ],
    publishedAt: nowIso,
    publicationDateReliable: true,
    firstSeenAt: nowIso,
    generatedAt: nowIso,
    estimatedReadingMinutes: 1,
    relevanceExplanation: 'Freies, redaktionell ausgewähltes Bild des Tages aus dem Wikimedia-Commons-Archiv.',
    contentStatus: 'editorial_briefing',
    isDailyEdition: true,
    editionDate: today,
    isDemonstration: false,
    aiAssisted: false,
    factReviewStatus: 'historical_reference',
    provenanceSummary: `Wikimedia Commons Bildarchiv (${lang.toUpperCase()}, freie Lizenz).`,
    wordCount: words,
    evidenceTier: 'permitted_full_text',
    contentOrigin: 'live_ingested',
    contentHash,
    canonicalUrl,
    imageUrl: rawImage,
    imageCredit: `${artist} · Wikimedia Commons`,
    hasAuthenticImage: true,
    isTeachingRelated: false,
    isChallengingPerspective: false,
    keyInsight: aestheticImpulse,
    challengePrompt: 'Welche visuelle Geschichte oder technische Präzision steckt hinter dieser Aufnahme?',
    upvotesCount: 0,
    awardsCount: { gold: 0, brain: 0, spark: 0 },
    comments: [],
    sourceTrustLevel: 'museum_collection',
    sourceDomain: 'commons.wikimedia.org',
    sourceBroadcasterName: museumLabel,
    artMeta: {
      artist,
      year: yyyy,
      medium: 'Fotografie & Bildarchiv',
      museum: museumLabel,
      highResImageUrl: rawImage,
      styleMovement: 'Wikimedia Featured Media',
      aestheticImpulse
    }
  };
}

export async function fetchWikipediaBrightDiscoveries(
  options: WikipediaBrightFetchOptions = {}
): Promise<FeedItem[]> {
  const targetDate = options.date ?? new Date();
  const yyyy = String(targetDate.getUTCFullYear());
  const mm = String(targetDate.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(targetDate.getUTCDate()).padStart(2, '0');
  const today = options.today ?? `${yyyy}-${mm}-${dd}`;
  const nowIso = new Date().toISOString();

  const endpoints: { lang: 'de' | 'en'; url: string }[] = [
    { lang: 'de', url: `https://de.wikipedia.org/api/rest_v1/feed/featured/${yyyy}/${mm}/${dd}` },
    { lang: 'en', url: `https://en.wikipedia.org/api/rest_v1/feed/featured/${yyyy}/${mm}/${dd}` }
  ];

  const settled = await Promise.allSettled(
    endpoints.map(async ({ lang, url }) => ({
      lang,
      payload: await fetchJsonWithTimeout<WikiFeaturedResponse>(url, DEFAULT_TIMEOUT_MS)
    }))
  );

  const results: FeedItem[] = [];
  const seenPotdUrls = new Set<string>();

  for (const outcome of settled) {
    if (outcome.status !== 'fulfilled' || !outcome.value.payload) {
      continue;
    }
    const { lang, payload } = outcome.value;

    if (payload.tfa) {
      const tfaItem = buildWikipediaTfaItem(lang, payload.tfa, yyyy, mm, dd, today, nowIso);
      if (tfaItem) {
        results.push(tfaItem);
      }
    }

    if (payload.image) {
      const potdItem = buildWikipediaPotdItem(lang, payload.image, yyyy, mm, dd, today, nowIso);
      if (potdItem && potdItem.imageUrl && !seenPotdUrls.has(potdItem.imageUrl)) {
        seenPotdUrls.add(potdItem.imageUrl);
        results.push(potdItem);
      }
    }
  }

  return results;
}
