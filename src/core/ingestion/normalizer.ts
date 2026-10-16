import { RawFeedEntry, RawFeedSource } from './types';
import { FeedItem, FeedItemFormat, SourceReference, TOPIC_SPACE_MAP } from '../domain/types';
import { calculateReadingStats, getCuratedImageForTopic, getSimulatedCommentsForTopic } from '../data/fixtures';
import { enrichItemWithInstantResearch } from '../synthesis/backgroundResearchPipeline';

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
 * Pure JavaScript implementation of SHA-256 for cross-platform zero-Node.js Expo Web & iOS compatibility.
 */
export function pureJsSha256(ascii: string): string {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let i: number, j: number, result = '';
  const words: number[] = [];
  const utf8 = unescape(encodeURIComponent(ascii));
  const asciiBitLength = utf8.length * 8;
  const hash: number[] = [];
  const k: number[] = [];
  let primeCounter = 0;
  const isComposite: Record<number, number> = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (i = 0; i < 313; i += candidate) isComposite[i] = candidate;
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }
  let s = utf8 + '\x80';
  while (s.length % 64 !== 56) s += '\x00';
  for (i = 0; i < s.length; i++) {
    words[i >> 2] |= s.charCodeAt(i) << ((3 - (i % 4)) * 8);
  }
  words.push((asciiBitLength / maxWord) | 0);
  words.push(asciiBitLength | 0);
  for (j = 0; j < words.length;) {
    const w = words.slice(j, j += 16);
    const oldHash = hash.slice(0);
    for (i = 0; i < 64; i++) {
      const w15 = w[i - 15], w2 = w[i - 2];
      const s0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3);
      const s1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10);
      w[i] = (i < 16) ? (w[i] || 0) : ((w[i - 16] + s0 + w[i - 7] + s1) | 0);
      const s1h = rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25);
      const ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
      const temp1 = (hash[7] + s1h + ch + k[i] + w[i]) | 0;
      const s0h = rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22);
      const maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
      const temp2 = (s0h + maj) | 0;
      hash[7] = hash[6]; hash[6] = hash[5]; hash[5] = hash[4];
      hash[4] = (hash[3] + temp1) | 0;
      hash[3] = hash[2]; hash[2] = hash[1]; hash[1] = hash[0];
      hash[0] = (temp1 + temp2) | 0;
    }
    for (i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
  }
  for (i = 0; i < 8; i++) {
    for (j = 3; j >= 0; j--) {
      const b = (hash[i] >> (8 * j)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }
  return result;
}

/**
 * Generates deterministic 64-character SHA-256 hash for content identity and deduplication.
 * Pure JavaScript implementation with zero Node.js dependencies for cross-platform Expo Web & iOS compatibility.
 */
export function generateContentHash(canonicalUrl: string, title: string, text: string): string {
  const normalizedPayload = `${(canonicalUrl || '').toLowerCase().trim()}|${(title || '').toLowerCase().trim()}|${(text || '').slice(0, 300).trim()}`;
  return pureJsSha256(normalizedPayload);
}

/**
 * Determines appropriate editorial format based on content length and source characteristics.
 */
function inferFormat(source: RawFeedSource, words: number, isChallenging?: boolean): FeedItemFormat {
  if (source.primaryTopic === 'youtube_gems' || source.id.startsWith('yt-')) return 'youtube_gem';
  if (source.primaryTopic === 'book_mastery') return 'book_masterpiece';
  if (source.primaryTopic === 'memes_satire') return 'meme';
  if (source.primaryTopic === 'opportunities_growth') return 'opportunity_radar';
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

  const contentHash = generateContentHash(canonicalUrl, entry.title, entry.summary);

  // Standalone feed reading: generate distinct subtitle and feedText so they never duplicate
  const summaryParagraphs = entry.summary.split('\n\n').map(p => p.trim()).filter(Boolean);

  let subtitle: string;
  let feedText: string;

  if (summaryParagraphs.length >= 2) {
    subtitle = summaryParagraphs[0].slice(0, 140) + (summaryParagraphs[0].length > 140 ? '…' : '');
    feedText = summaryParagraphs.slice(1, 3).join('\n\n');
  } else if (summaryParagraphs.length === 1) {
    const rawSum = summaryParagraphs[0];
    const sentences = rawSum.split(/(?<=[.!?])\s+/).filter(Boolean);
    if (sentences.length >= 2) {
      subtitle = sentences[0].slice(0, 140) + (sentences[0].length > 140 ? '…' : '');
      feedText = sentences.slice(1).join(' ');
    } else {
      subtitle = `Aktueller Beitrag aus ${source.name}`;
      feedText = rawSum;
    }
  } else {
    subtitle = `Aktueller Beitrag aus ${source.name}`;
    feedText = entry.title;
  }

  const author = entry.author || source.defaultAuthor || source.name;
  const isChallenging = source.isChallengingPerspective ?? false;

  // Honest Source Fidelity & Evidence Tier Assignment:
  // Never inflate articleBody or feedText with synthetic template boilerplate.
  // Keep articleBody as the authentic, verbatim source excerpt or text.
  let evidenceTier = source.defaultEvidenceTier;
  const rawLength = bodyText.trim().length;
  if (rawLength < 120) {
    evidenceTier = 'metadata_only';
  } else if (rawLength < 400 && evidenceTier === 'permitted_full_text') {
    evidenceTier = 'publisher_excerpt';
  }
  const articleBody = bodyText;

  const stats = calculateReadingStats(articleBody);
  const wordCount = Math.max(1, stats.wordCount);
  const format = inferFormat(source, wordCount, isChallenging);

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

  const baseItem: FeedItem = {
    id: `ingest-${source.id}-${contentHash.slice(0, 12)}`,
    type: wordCount <= 220 ? 'quick_insight' : isChallenging ? 'perspective' : 'briefing',
    format,
    title: entry.title,
    subtitle,
    feedText,
    articleBody,
    body: articleBody,
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
    evidenceTier,
    contentOrigin: 'live_ingested',
    contentHash,
    canonicalUrl,
    isTeachingRelated: source.isTeachingRelated ?? false,
    isChallengingPerspective: isChallenging,
    perspectiveDetails: isChallenging ? {
      claim: entry.title,
      interpretation: entry.summary.slice(0, 200),
      humanSource: author
    } : undefined,
    imageUrl: entry.imageUrl || getCuratedImageForTopic(source.primaryTopic, entry.title),

    // Atem Network & Social Discovery Additions (Honest provenance: 0 fake upvotes)
    space: TOPIC_SPACE_MAP[source.primaryTopic]?.space,
    flair: TOPIC_SPACE_MAP[source.primaryTopic]?.flair,
    upvotesCount: 0,
    awardsCount: { gold: 0, brain: 0, spark: 0 },
    sourceTrustLevel: (source.id.includes('tagesschau') || source.id.includes('dlf') || source.id.includes('zdf') || source.id.includes('bpb'))
      ? 'public_broadcaster'
      : (source.id.startsWith('yt-') ? 'verified_creator' : (source.id.includes('sep') || source.id.includes('plato') ? 'peer_reviewed' : 'deep_essay')),
    sourceBroadcasterName: source.name,
    sourceDomain: canonicalUrl ? canonicalUrl.replace(/^https?:\/\//, '').split('/')[0].replace(/^www\./, '') : undefined,
    comments: getSimulatedCommentsForTopic(source.primaryTopic, entry.title, contentHash.slice(0, 8))
  };

  return enrichItemWithInstantResearch(baseItem);
}

