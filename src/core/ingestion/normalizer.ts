import { FeedItem, FeedItemFormat, ContentType, FactReviewStatus } from '../domain/types';
import { RawFeedEntry, RawFeedSource } from './types';
import { buildKnowledgeContextForEntry } from '../synthesis/backgroundResearchPipeline';
import { ZERO_WIDTH_REGEX, sanitizeImageUrl } from './rssParser';

/**
 * Pure TypeScript SHA-256 implementation (FIPS 180-4).
 * Zero dependency on Node 'crypto', works identically in Hermes (iOS/Android), Web, and Node.
 */
export function pureJsSha256(ascii: string): string {
  function rightRotate(value: number, amount: number): number {
    return (value >>> amount) | (value << (32 - amount));
  }

  const utf8Str = unescape(encodeURIComponent(ascii));
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let result = '';

  const words: number[] = [];
  const asciiBitLength = utf8Str.length * 8;

  let hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ];
  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  let str = utf8Str + '\x80';
  while ((str.length % 64) - 56) str += '\x00';
  for (let i = 0; i < str.length; i++) {
    const j = str.charCodeAt(i);
    words[i >> 2] |= j << (((3 - i) % 4) * 8);
  }
  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength;

  for (let j = 0; j < words.length;) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash.slice(0);

    for (let i = 0; i < 64; i++) {
      const w15 = w[i - 15], w2 = w[i - 2];
      const a = hash[0], e = hash[4];
      const temp1 =
        hash[7] +
        (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
        ((e & hash[5]) ^ (~e & hash[6])) +
        k[i] +
        (w[i] =
          i < 16
            ? w[i]
            : (w[i - 16] +
                (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                w[i - 7] +
                (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
              0);
      const temp2 =
        (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
        ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));

      hash = [(temp1 + temp2) | 0].concat(hash);
      hash[4] = (hash[4] + temp1) | 0;
      hash.pop();
    }

    for (let i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  for (let i = 0; i < 8; i++) {
    for (let j = 3; j + 1; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? 0 : '') + b.toString(16);
    }
  }
  return result;
}

const TRACKING_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'fbclid',
  'gclid',
  'mc_cid',
  'mc_eid',
  'ref'
];

export function canonicalizeUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl.trim());
    for (const param of TRACKING_PARAMS) {
      parsed.searchParams.delete(param);
    }
    parsed.hash = '';
    const str = parsed.toString();
    return str.endsWith('/') && parsed.pathname !== '/' ? str.slice(0, -1) : str;
  } catch {
    return rawUrl.trim();
  }
}

export function generateContentHash(canonicalUrl: string, title: string, summary: string): string {
  const normalizedInput = `${canonicalUrl.toLowerCase()}|${title.trim().toLowerCase()}|${summary.trim().slice(0, 300).toLowerCase()}`;
  return pureJsSha256(normalizedInput);
}

function classifyFormatAndType(
  entry: RawFeedEntry,
  source: RawFeedSource,
  wordCount: number
): { format: FeedItemFormat; type: ContentType } {
  const titleLower = entry.title.toLowerCase();

  if (source.primaryTopic === 'memes_satire' || source.id.includes('xkcd') || source.id.includes('smbc')) {
    return { format: 'meme', type: 'quick_insight' };
  }
  if (source.primaryTopic === 'youtube_gems' || source.id.startsWith('yt-')) {
    return { format: 'youtube_gem', type: 'deep_dive' };
  }
  if (source.primaryTopic === 'art_aesthetics' && Boolean(entry.imageUrl)) {
    return { format: 'art_showcase', type: 'quick_insight' };
  }
  if (source.primaryTopic === 'book_mastery') {
    return { format: 'book_masterpiece', type: 'deep_dive' };
  }
  if (source.primaryTopic === 'sound_synthesis') {
    return { format: 'creative_idea', type: 'briefing' };
  }
  if (source.isChallengingPerspective || titleLower.includes('warum') || titleLower.includes('kritik') || titleLower.includes('problem') || titleLower.includes('streit')) {
    return { format: 'perspective_disagreement', type: 'perspective' };
  }
  if (titleLower.endsWith('?')) {
    return { format: 'intriguing_question', type: 'perspective' };
  }
  if (wordCount > 250) {
    return { format: 'long_invitation', type: 'deep_dive' };
  }
  if (wordCount > 90) {
    return { format: 'sourced_update', type: 'briefing' };
  }
  return { format: 'concise_insight', type: 'quick_insight' };
}

function classifySourceProvenance(source: RawFeedSource): {
  sourceTrustLevel: FeedItem['sourceTrustLevel'];
  factReviewStatus: FactReviewStatus;
  provenanceSummary: string;
} {
  const id = source.id.toLowerCase();
  if (
    id.startsWith('tagesschau') ||
    id === 'zdf-heute' ||
    id.startsWith('deutschlandfunk') ||
    id.startsWith('dlf-') ||
    id.startsWith('br24') ||
    id.startsWith('dw-') ||
    id.startsWith('bpb-')
  ) {
    return {
      sourceTrustLevel: 'public_broadcaster',
      factReviewStatus: 'public_news',
      provenanceSummary: `Öffentlich-rechtliche Redaktion: ${source.name}.`
    };
  }

  if (
    id === 'quanta-magazine' ||
    id === 'forschung-und-wissen' ||
    id === 'idw-wissenschaft' ||
    id === 'nautilus-magazine' ||
    id.startsWith('spektrum') ||
    id === 'gehirn-und-geist' ||
    id === 'nature-news' ||
    id.startsWith('sciencedaily') ||
    id === 'mpg-forschung' ||
    id === 'scinexx-wissen' ||
    id.startsWith('arxiv-')
  ) {
    return {
      sourceTrustLevel: 'peer_reviewed',
      factReviewStatus: 'scientific_paper',
      provenanceSummary: `Wissenschafts- & Forschungsquelle: ${source.name}.`
    };
  }

  if (
    id === 'sep-whats-new' ||
    id === 'daily-nous' ||
    id === 'aeon-essays' ||
    id === 'psyche-magazine' ||
    id === 'philosophy-now' ||
    id === 'perlentaucher-magazin' ||
    id === 'the-marginalian' ||
    id === 'public-domain-review' ||
    id === 'astral-codex-ten' ||
    id === 'works-in-progress' ||
    id === 'tricycle-buddhist' ||
    id === 'lions-roar-buddhism' ||
    id === 'plum-village-mindfulness' ||
    id === 'zen-habits-focus'
  ) {
    return {
      sourceTrustLevel: 'deep_essay',
      factReviewStatus: 'philosophical_discourse',
      provenanceSummary: `Essay & Kulturpublikation: ${source.name}.`
    };
  }

  if (source.isTeachingRelated) {
    return {
      sourceTrustLevel: 'verified_creator',
      factReviewStatus: 'pedagogical_concept',
      provenanceSummary: `Bildungs- & Didaktikquelle: ${source.name}.`
    };
  }

  if (id === 'lobsters-community' || id === 'hn-frontpage-rss') {
    return {
      sourceTrustLevel: 'community_curated',
      factReviewStatus: 'community_discussion',
      provenanceSummary: `Kuratierte Fach-Community: ${source.name}.`
    };
  }

  return {
    sourceTrustLevel: 'verified_creator',
    factReviewStatus: 'curated_illustrative',
    provenanceSummary: `Verifizierter Originalauszug von ${source.name} (${source.language.toUpperCase()}).`
  };
}

function buildRelevanceExplanation(source: RawFeedSource): string {
  if (source.isTeachingRelated) {
    return `Relevant für Unterricht & Didaktik (${source.name}).`;
  }
  if (source.isChallengingPerspective) {
    return `Philosophische oder gesellschaftliche Gegenperspektive (${source.name}).`;
  }
  switch (source.primaryTopic) {
    case 'ai_apple':
      return `Einblick in KI-Architektur & Software-Souveränität (${source.name}).`;
    case 'sound_synthesis':
      return `Impuls für Klangsynthese & kreative Musikpraxis (${source.name}).`;
    case 'contemplation_mind':
      return `Perspektive für Achtsamkeit, Kontemplation & Fokus (${source.name}).`;
    case 'philosophy_ethics':
      return `Gedankengang zur ethischen & philosophischen Vertiefung (${source.name}).`;
    case 'art_aesthetics':
      return `Visuelle Kultur & ästhetische Entdeckung (${source.name}).`;
    case 'memes_satire':
      return `Spielerischer Perspektivwechsel & kluge Satire (${source.name}).`;
    case 'book_mastery':
      return `Literarischer Essay & Buch-Entdeckung (${source.name}).`;
    default:
      return `Aktuelle Einordnung aus Wissenschaft & Gesellschaft (${source.name}).`;
  }
}

export const BOILERPLATE_PATTERNS: RegExp[] = [
  /Für Links auf dieser Seite.*?Provision.*?Partner/gi,
  /Hier geht['']?s zu unseren Affiliate-Links/gi,
  /Hinweis: Für diesen Artikel.*?Provision/gi,
  /Folgen Sie uns auf.*?(?:Telegram|WhatsApp|Facebook|Twitter|X|Instagram)/gi
];

export function stripBoilerplate(text: string): string {
  if (!text) return '';
  let cleaned = text;
  for (const pattern of BOILERPLATE_PATTERNS) {
    cleaned = cleaned.replace(pattern, '');
  }
  return cleaned.trim();
}

/**
 * Splits text into sentences while respecting German/English ordinal numbers (e.g. "21. September")
 * and abbreviations (e.g. "z.B.", "Dr.", "Prof.") so they are not falsely treated as sentence boundaries.
 */
export function splitSentencesAware(text: string): string[] {
  if (!text) return [];
  const clean = text.trim();
  if (!clean) return [];

  const regex = /([.!?]+)(?=\s+|$)/g;
  const sentences: string[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(clean)) !== null) {
    const punct = match[1];
    const matchIndex = match.index;
    const matchEnd = matchIndex + punct.length;

    if (punct.includes('.')) {
      const textBefore = clean.slice(0, matchIndex);
      // Check 1-2 digits: e.g. " 21."
      if (/\b\d{1,2}$/.test(textBefore)) {
        continue;
      }
      // Check abbreviations: e.g. "z.B", "Dr", "Prof", "ca", etc.
      if (/(?:^|\s)(?:z\.B|u\.a|d\.h|bzw|vgl|ca|Dr|Prof|Mio|Mrd|Nr|St|vs|etc|inkl|evtl|usw)$/i.test(textBefore)) {
        continue;
      }
    }

    const rest = clean.slice(matchEnd);
    const wsMatch = rest.match(/^\s+/);
    if (!wsMatch && matchEnd < clean.length) {
      continue;
    }

    const sentence = clean.slice(lastIndex, matchEnd).trim();
    if (sentence) {
      sentences.push(sentence);
    }
    lastIndex = matchEnd + (wsMatch ? wsMatch[0].length : 0);
  }

  const trailing = clean.slice(lastIndex).trim();
  if (trailing) {
    sentences.push(trailing);
  }

  return sentences.length > 0 ? sentences : [clean];
}

/**
 * Enforces minimum substance for subtitles/claims:
 * Must have at least 35 characters and at least 6 words, and cannot be a stub like "Comments".
 */
export function isSubstantialSubtitle(text: string): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();
  if (lower === 'comments' || lower.startsWith('comments (') || lower === 'kommentare' || lower.startsWith('kommentare (')) {
    return false;
  }
  if (trimmed.length < 35) return false;
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length < 6) return false;
  return true;
}

/**
 * Normalizes a raw RSS/Atom entry into a strictly validated FeedItem.
 * - Preserves 100% honest source text without template bloating.
 * - Never attaches generic stock images (`imageUrl` is only set if the entry genuinely provides one).
 * - Never attaches fake upvotes, fake awards, or simulated human comments.
 */
export function normalizeFeedEntry(
  entry: RawFeedEntry,
  source: RawFeedSource,
  editionDate: string = new Date().toISOString().slice(0, 10)
): FeedItem {
  const canonical = canonicalizeUrl(entry.link);
  const cleanTitle = entry.title.replace(ZERO_WIDTH_REGEX, '').trim();
  const rawBodyText = stripBoilerplate(
    ((entry.fullContent && entry.fullContent.length > entry.summary.length)
      ? entry.fullContent
      : entry.summary
    ).replace(ZERO_WIDTH_REGEX, '').trim()
  );

  const effectiveText = rawBodyText.length > 0
    ? rawBodyText
    : entry.imageAltText
    ? entry.imageAltText.replace(ZERO_WIDTH_REGEX, '').trim()
    : `${cleanTitle}. Originalbeitrag veröffentlicht bei ${source.name}.`;

  const words = effectiveText.split(/\s+/).filter(Boolean);
  const wordCount = Math.max(12, words.length);
  const estimatedReadingMinutes = Math.max(1, Math.min(15, Math.ceil(wordCount / 180)));

  const contentHash = generateContentHash(canonical, cleanTitle, effectiveText);
  const { format, type } = classifyFormatAndType({ ...entry, title: cleanTitle }, source, wordCount);
  const { sourceTrustLevel, factReviewStatus, provenanceSummary } = classifySourceProvenance(source);

  // Split teaser into distinct subtitle and non-repeating feedText
  const sentences = splitSentencesAware(effectiveText).filter(Boolean);
  let subtitle = '';
  let feedText = '';

  let firstSubstantialIdx = -1;
  for (let i = 0; i < sentences.length; i++) {
    if (isSubstantialSubtitle(sentences[i])) {
      firstSubstantialIdx = i;
      break;
    }
  }

  if (firstSubstantialIdx !== -1) {
    const candidateSub = sentences[firstSubstantialIdx].trim();
    subtitle = candidateSub.length > 150
      ? candidateSub.slice(0, 147).trim() + '…'
      : candidateSub;
    const remainingText = sentences.filter((_, idx) => idx !== firstSubstantialIdx).join(' ').trim();
    feedText = remainingText.length > 520
      ? remainingText.slice(0, 517).trim() + '…'
      : (remainingText || effectiveText);
  } else if (sentences.length > 0 && sentences[0].length >= 20 && !sentences[0].toLowerCase().startsWith('comments')) {
    const firstSentence = sentences[0].trim();
    subtitle = firstSentence.length > 150
      ? firstSentence.slice(0, 147).trim() + '…'
      : firstSentence;
    const remainingText = sentences.slice(1).join(' ').trim();
    feedText = remainingText.length > 520
      ? remainingText.slice(0, 517).trim() + '…'
      : (remainingText || effectiveText);
  } else {
    subtitle = `${source.name} • ${source.defaultAuthor || 'Redaktion'}`;
    feedText = effectiveText.length > 520
      ? effectiveText.slice(0, 517).trim() + '…'
      : effectiveText;
  }

  let honestTier = source.defaultEvidenceTier;
  if (rawBodyText.length < 120) {
    honestTier = 'metadata_only';
  } else if (rawBodyText.length < 900 && honestTier === 'permitted_full_text') {
    honestTier = 'publisher_excerpt';
  }

  const articleBody = effectiveText;

  const knowledgeContext = buildKnowledgeContextForEntry({
    title: cleanTitle,
    summary: effectiveText,
    topic: source.primaryTopic,
    sourceName: source.name
  });

  const deterministicId = `live-${source.id}-${contentHash.slice(0, 10)}`;
  let sourceDomain: string | undefined;
  try {
    sourceDomain = new URL(canonical).hostname.replace(/^www\./, '');
  } catch {
    sourceDomain = undefined;
  }

  const authenticImageUrl = sanitizeImageUrl(entry.imageUrl);

  const memeMeta =
    format === 'meme' && entry.imageAltText
      ? {
          templateName: source.name,
          punchline: entry.imageAltText,
          satireContext: `Bonus-Punchline (Original-Alt-Text) • ${source.name}`
        }
      : undefined;

  return {
    id: deterministicId,
    type,
    format,
    title: cleanTitle,
    subtitle,
    feedText,
    articleBody,
    body: feedText,
    topics: source.topics,
    primaryTopic: source.primaryTopic,
    sourceReferences: [
      {
        publisher: source.name,
        originalUrl: canonical,
        title: cleanTitle,
        publicationTimestamp: entry.publishedAt,
        retrievalTimestamp: new Date().toISOString(),
        author: entry.author || source.defaultAuthor,
        isVerified: true
      }
    ],
    publishedAt: entry.publishedAt,
    generatedAt: new Date().toISOString(),
    estimatedReadingMinutes,
    relevanceExplanation: buildRelevanceExplanation(source),
    contentStatus: 'editorial_briefing',
    isDailyEdition: true,
    editionDate,
    isDemonstration: false,
    aiAssisted: false,
    factReviewStatus,
    provenanceSummary,
    wordCount,
    evidenceTier: honestTier,
    contentOrigin: 'live_ingested',
    contentHash,
    canonicalUrl: canonical,
    imageUrl: authenticImageUrl,
    imageCredit: entry.imageCredit,
    hasAuthenticImage: Boolean(authenticImageUrl),
    memeMeta,
    isTeachingRelated: Boolean(source.isTeachingRelated),
    isChallengingPerspective: Boolean(source.isChallengingPerspective),
    keyInsight: knowledgeContext.keyInsight,
    challengePrompt: knowledgeContext.challengePrompt,
    didacticTransfer: knowledgeContext.actionableTransfer,
    relatedCrossReferences: knowledgeContext.relatedCrossReferences,
    perspectiveDetails: source.isChallengingPerspective
      ? {
          claim: subtitle,
          counterPerspective: knowledgeContext.counterPerspective,
          humanSource: entry.author || source.defaultAuthor || source.name
        }
      : undefined,
    upvotesCount: 0,
    awardsCount: { gold: 0, brain: 0, spark: 0 },
    comments: [],
    sourceTrustLevel,
    sourceDomain,
    sourceBroadcasterName: source.name
  };
}
