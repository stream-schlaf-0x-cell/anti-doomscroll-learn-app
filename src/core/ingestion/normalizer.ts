import crypto from 'node:crypto';
import { RawFeedEntry, RawFeedSource } from './types';
import { FeedItem, FeedItemFormat, SourceReference } from '../domain/types';
import { calculateReadingStats } from '../data/fixtures';

/**
 * Removes tracking parameters (utm_*, fbclid, etc.) and normalizes URLs.
 */
export function canonicalizeUrl(urlStr: string): string {
  try {
    const parsed = new URL(urlStr);
    const trackingParams = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'fbclid', 'gclid', 'ref', 'source', 'mc_cid', 'mc_eid'
    ];
    for (const param of trackingParams) {
      parsed.searchParams.delete(param);
    }
    // Remove empty hash
    // Remove trailing slash if path is longer than '/'
    let path = parsed.pathname;
    if (path.length > 1 && path.endsWith('/')) {
      path = path.slice(0, -1);
    }
    parsed.pathname = path;

    let res = parsed.toString();
    if (res.endsWith('#')) {
      res = res.slice(0, -1);
    }
    return res;
  } catch {
    return urlStr.trim();
  }
}

/**
 * Generates deterministic SHA-256 hash for content identity and deduplication.
 */
export function generateContentHash(canonicalUrl: string, title: string, text: string): string {
  const normalizedPayload = `${canonicalUrl.toLowerCase().trim()}|${title.toLowerCase().trim()}|${text.slice(0, 300).trim()}`;
  return crypto.createHash('sha256').update(normalizedPayload, 'utf8').digest('hex');
}

/**
 * Determines appropriate editorial format based on content length and source characteristics.
 */
function inferFormat(words: number, isChallenging?: boolean): FeedItemFormat {
  if (isChallenging) return 'perspective_disagreement';
  if (words <= 220) return 'concise_insight';
  if (words >= 800) return 'long_invitation';
  return 'sourced_update';
}

/**
 * Normalizes a raw feed entry into a fully validated Atem FeedItem.
 */
export function normalizeFeedEntry(entry: RawFeedEntry, source: RawFeedSource): FeedItem {
  const canonicalUrl = canonicalizeUrl(entry.link);
  const rawBody = entry.fullContent && entry.fullContent.length > entry.summary.length
    ? entry.fullContent
    : entry.summary;
  const bodyText = rawBody && rawBody.trim().length > 0 ? rawBody.trim() : entry.title;

  const stats = calculateReadingStats(bodyText);
  const wordCount = Math.max(1, stats.wordCount);
  const contentHash = generateContentHash(canonicalUrl, entry.title, entry.summary);

  // Standalone feed reading: use summary or first two paragraphs
  const summaryParagraphs = entry.summary.split('\n\n').filter(Boolean);
  const feedText = summaryParagraphs.slice(0, 2).join('\n\n') || entry.title;
  const subtitle = entry.summary.trim().length > 0
    ? (entry.summary.slice(0, 140) + (entry.summary.length > 140 ? '…' : ''))
    : `Aktueller Beitrag aus ${source.name}`;

  const author = entry.author || source.defaultAuthor || source.name;
  const isChallenging = source.isChallengingPerspective ?? false;
  const format = inferFormat(wordCount, isChallenging);

  const sourceRef: SourceReference = {
    publisher: source.name,
    originalUrl: canonicalUrl,
    title: entry.title,
    author,
    publicationTimestamp: entry.publishedAt,
    retrievalTimestamp: new Date().toISOString(),
    isVerified: true
  };

  const todayStr = new Date().toISOString().split('T')[0];

  return {
    id: `ingest-${source.id}-${contentHash.slice(0, 12)}`,
    type: wordCount <= 220 ? 'quick_insight' : isChallenging ? 'perspective' : 'briefing',
    format,
    title: entry.title,
    subtitle,
    feedText,
    articleBody: bodyText,
    body: bodyText,
    topics: source.topics,
    primaryTopic: source.primaryTopic,
    sourceReferences: [sourceRef],
    publishedAt: entry.publishedAt,
    generatedAt: new Date().toISOString(),
    estimatedReadingMinutes: stats.estimatedReadingMinutes,
    relevanceExplanation: `Live recherchierter Beitrag aus ${source.name} zum Themenbereich ${source.primaryTopic}.`,
    contentStatus: isChallenging ? 'philosophical_perspective' : (source.primaryTopic === 'science_society' ? 'scientific_analysis' : 'editorial_briefing'),
    isDailyEdition: true,
    editionDate: todayStr,
    editorialNote: `Ausgabe ${todayStr} via ${source.name}`,

    // Editorial Provenance Metadata
    isDemonstration: false,
    aiAssisted: false,
    factReviewStatus: 'curated_illustrative',
    provenanceSummary: `Originalbeitrag von ${author} veröffentlicht bei ${source.name}. Erfasst über öffentlichen RSS/Atom-Feed.`,
    wordCount: stats.wordCount,

    // Phase 2 Pipeline Properties
    evidenceTier: source.defaultEvidenceTier,
    contentOrigin: 'live_ingested',
    contentHash,
    canonicalUrl,
    isTeachingRelated: source.isTeachingRelated ?? false,
    isChallengingPerspective: isChallenging,
    perspectiveDetails: isChallenging ? {
      claim: entry.title,
      interpretation: entry.summary.slice(0, 200),
      humanSource: author
    } : undefined
  };
}
