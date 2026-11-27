/**
 * src/core/ingestion/webContentExtractor.ts — Hybrid Web Content Extractor
 *
 * Bridges the Python `scrapling` framework for server/CLI ingestion
 * with a pure TypeScript fallback for mobile browser and offline testing.
 *
 * Populates two distinct tiers:
 *   - Tier A (Card Essence): 4–6 sentence distilled summary (~90–160 words, >= 220 chars) for FeedCard.
 *   - Tier B (Reader Body): Complete, clean, structured long-form Markdown (headings, blockquotes, lists) for ReaderScreen.
 */

import { FeedItem } from '../domain/types';
import { isRejectedLowResOrLogoUrl } from '../utils/imageQuality';

export interface HarvestedArticle {
  url: string;
  title: string;
  essenceText: string;
  fullMarkdownBody: string;
  wordCount: number;
  estimatedReadingMinutes: number;
  imageUrl?: string;
}

const BOILERPLATE_PATTERNS = [
  /support\s+the\s+guardian/i,
  /subscribe\s+now/i,
  /newsletter\s+sign-?up/i,
  /listen\s+to:\s*/i,
  /read\s+by\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+/i,
  /photograph(?:s)?:\s*.*/i,
  /illustration:\s*.*/i,
  /follow\s+us\s+on\s+(?:twitter|x|instagram|facebook)/i,
  /cookie\s+(?:policy|settings|notice|consent)/i,
  /all\s+rights\s+reserved/i,
  /share\s+this\s+article/i,
  /sign\s+up\s+for\s+the\s+.*newsletter/i,
];

const SITE_SUFFIX_PATTERN = /\s*(?:[-|–—]\s*(?:The Guardian|Spiegel|ZEIT ONLINE|Süddeutsche Zeitung|FAZ|NZZ|BBC News|Ars Technica|Wired|The Verge|Aeon|The Atlantic|New Yorker|Quanta Magazine|Nature|Scientific American)).*$/i;

/**
 * Strips HTML tags, entities, and excessive whitespace.
 */
function cleanText(text: string): string {
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

const META_IMAGE_PRIORITY = [
  'og:image:secure_url',
  'og:image:url',
  'og:image',
  'twitter:image:src',
  'twitter:image'
] as const;

/**
 * Extracts an authentic og:image / twitter:image hero photo URL from HTML,
 * supporting both attribute orders, resolving relative URLs, and filtering logos/icons/svgs/1x1 pixels.
 */
function extractHeroImageFromHtml(html: string, sourceUrl = ''): string | undefined {
  if (!html || typeof html !== 'string') return undefined;

  const candidates = new Map<string, string>();
  const metaTagRegex = /<meta\b[^>]*>/gi;
  const attrRegex = /([a-zA-Z0-9:_-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi;

  let tagMatch: RegExpExecArray | null;
  while ((tagMatch = metaTagRegex.exec(html)) !== null) {
    const tagStr = tagMatch[0];
    const attrs: Record<string, string> = {};
    let attrMatch: RegExpExecArray | null;
    attrRegex.lastIndex = 0;
    while ((attrMatch = attrRegex.exec(tagStr)) !== null) {
      const key = attrMatch[1].toLowerCase();
      const rawVal = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? '';
      attrs[key] = rawVal
        .replace(/&amp;/gi, '&')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .trim();
    }

    const metaKey = (attrs.property || attrs.name || '').toLowerCase().trim();
    const content = (attrs.content || '').trim();
    if (
      content &&
      (META_IMAGE_PRIORITY as readonly string[]).includes(metaKey) &&
      !candidates.has(metaKey)
    ) {
      candidates.set(metaKey, content);
    }
  }

  for (const key of META_IMAGE_PRIORITY) {
    const rawCandidate = candidates.get(key);
    if (!rawCandidate) continue;

    let resolved = rawCandidate;
    if (resolved.startsWith('//')) {
      resolved = `https:${resolved}`;
    } else if (!/^https?:\/\//i.test(resolved) && sourceUrl) {
      try {
        resolved = new URL(resolved, sourceUrl).toString();
      } catch {
        continue;
      }
    }

    if (!isRejectedLowResOrLogoUrl(resolved)) {
      return resolved;
    }
  }

  return undefined;
}

/**
 * Pure TypeScript HTML content extractor.
 * Converts article/main HTML into clean Markdown and dual-tier essence/body.
 */
export function extractCleanArticleFromHtml(html: string, sourceUrl = ''): HarvestedArticle {
  if (!html || typeof html !== 'string') {
    return createSyntheticFallback(sourceUrl, 'Fachbeitrag');
  }

  // 0. Extract authentic og:image / twitter:image hero photo before stripping head tags
  const imageUrl = extractHeroImageFromHtml(html, sourceUrl);

  // 1. Extract title
  let title = '';
  const ogTitleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  if (ogTitleMatch && ogTitleMatch[1]) {
    title = cleanText(ogTitleMatch[1]);
  } else {
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (titleMatch && titleMatch[1]) {
      title = cleanText(titleMatch[1]);
    }
  }
  if (!title) {
    const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    if (h1Match && h1Match[1]) {
      title = cleanText(h1Match[1]);
    }
  }
  title = title.replace(SITE_SUFFIX_PATTERN, '').trim();
  if (!title && sourceUrl) {
    const slug = sourceUrl.split('/').filter(Boolean).pop()?.replace(/[-_]/g, ' ') || 'Fachbeitrag';
    title = slug.charAt(0).toUpperCase() + slug.slice(1);
  }

  // 2. Remove script, style, nav, footer, header, aside, noscript, svg, form tags
  let cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<aside[\s\S]*?<\/aside>/gi, '')
    .replace(/<form[\s\S]*?<\/form>/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '');

  // 3. Find main or article container if present
  const articleMatch = cleaned.match(/<article[\s\S]*?<\/article>/i) || cleaned.match(/<main[\s\S]*?<\/main>/i);
  const container = articleMatch ? articleMatch[0] : cleaned;

  // 4. Extract blocks in document order
  const blockRegex = /<(h[1-6]|p|blockquote|li)[^>]*>([\s\S]*?)<\/\1>/gi;
  const markdownBlocks: string[] = [];
  const rawParagraphs: string[] = [];

  if (title) {
    markdownBlocks.push(`# ${title}\n`);
  }

  let match: RegExpExecArray | null;
  while ((match = blockRegex.exec(container)) !== null) {
    const tag = match[1].toLowerCase();
    const rawInner = cleanText(match[2]);
    if (rawInner.length < 3) continue;

    // Check boilerplate patterns
    if (BOILERPLATE_PATTERNS.some(pat => pat.test(rawInner))) continue;

    if (tag === 'h1' || tag === 'h2') {
      markdownBlocks.push(`## ${rawInner}\n`);
    } else if (tag === 'h3' || tag === 'h4') {
      markdownBlocks.push(`### ${rawInner}\n`);
    } else if (tag === 'blockquote') {
      markdownBlocks.push(`> ${rawInner}\n`);
      rawParagraphs.push(rawInner);
    } else if (tag === 'li') {
      markdownBlocks.push(`- ${rawInner}`);
    } else {
      markdownBlocks.push(`${rawInner}\n`);
      rawParagraphs.push(rawInner);
    }
  }

  // Handle plain text without HTML wrapper tags
  if (rawParagraphs.length === 0) {
    const plain = cleanText(container);
    if (plain.length > 10 && !BOILERPLATE_PATTERNS.some(pat => pat.test(plain))) {
      rawParagraphs.push(plain);
      markdownBlocks.push(`${plain}\n`);
    }
  }

  let fullMarkdownBody = markdownBlocks.join('\n').trim();

  // 5. Tier A: Essence Text (4–6 sentences, ~90–160 words, >= 220 chars)
  const sentences: string[] = [];
  for (const para of rawParagraphs) {
    const sents = para.split(/(?<=[.!?])\s+/);
    for (const s of sents) {
      const sClean = s.trim();
      if (sClean.length > 20 && !BOILERPLATE_PATTERNS.some(pat => pat.test(sClean))) {
        sentences.push(sClean);
      }
      if (sentences.length >= 6) break;
    }
    if (sentences.length >= 6) break;
  }

  let essenceText = '';
  if (sentences.length >= 4) {
    essenceText = sentences.slice(0, 6).join(' ');
  } else if (sentences.length > 0) {
    essenceText = sentences.join(' ');
  }

  const cleanTitle = (title || 'Fachbeitrag')
    .replace(/\.(html?|php|aspx?)$/i, '')
    .replace(/[-_]+/g, ' ')
    .trim();

  if (fullMarkdownBody && title && !fullMarkdownBody.startsWith('#')) {
    fullMarkdownBody = `# ${cleanTitle}\n\n${fullMarkdownBody}`;
  }

  const wordCount = fullMarkdownBody ? fullMarkdownBody.split(/\s+/).filter(Boolean).length : 0;
  const estimatedReadingMinutes = Math.max(1, Math.ceil(wordCount / 200));

  return {
    url: sourceUrl,
    title,
    essenceText,
    fullMarkdownBody,
    wordCount,
    estimatedReadingMinutes,
    ...(imageUrl ? { imageUrl } : {})
  };
}

function createSyntheticFallback(url: string, defaultTitle: string): HarvestedArticle {
  const rawTitle = defaultTitle || 'Fachbeitrag';
  const cleanTitle = rawTitle
    .replace(/\.(html?|php|aspx?)$/i, '')
    .replace(/[-_]+/g, ' ')
    .trim();

  return {
    url,
    title: cleanTitle,
    essenceText: '',
    fullMarkdownBody: '',
    wordCount: 0,
    estimatedReadingMinutes: 1
  };
}

/**
 * Hybrid Extractor:
 * 1. In Node.js CLI: calls `python3 scripts/scrapling_harvester.py <url>` with a 5-second timeout.
 * 2. In browser / fallback / offline: uses pure TypeScript `extractCleanArticleFromHtml`.
 */
export async function harvestWebPageContent(url: string, htmlFallback?: string): Promise<HarvestedArticle> {
  if (!url || typeof url !== 'string') {
    return createSyntheticFallback('', 'Fachbeitrag');
  }

  // Check if running in Node.js
  const isNode = typeof process !== 'undefined' && Boolean(process.versions?.node);

  if (isNode) {
    try {
      // Dynamic import to avoid bundling child_process in browser / react-native-web
      const { execFile } = await import('child_process');
      const path = await import('path');

      const scriptPath = path.resolve(__dirname, '../../../scripts/scrapling_harvester.py');

      const runPy = (): Promise<HarvestedArticle> => {
        return new Promise((resolve, reject) => {
          execFile('python3', [scriptPath, url], { timeout: 5000, maxBuffer: 10 * 1024 * 1024 }, (err, stdout) => {
            if (err) return reject(err);
            try {
              const parsed = JSON.parse(stdout) as Record<string, unknown>;
              if (parsed && typeof parsed.essenceText === 'string' && typeof parsed.fullMarkdownBody === 'string') {
                const rawImg = typeof parsed.imageUrl === 'string' ? parsed.imageUrl.trim() : '';
                const validImageUrl = rawImg && !isRejectedLowResOrLogoUrl(rawImg) ? rawImg : undefined;
                return resolve({
                  url: typeof parsed.url === 'string' ? parsed.url : url,
                  title: typeof parsed.title === 'string' ? parsed.title : '',
                  essenceText: parsed.essenceText,
                  fullMarkdownBody: parsed.fullMarkdownBody,
                  wordCount: typeof parsed.wordCount === 'number' ? parsed.wordCount : 0,
                  estimatedReadingMinutes: typeof parsed.estimatedReadingMinutes === 'number' ? parsed.estimatedReadingMinutes : 1,
                  ...(validImageUrl ? { imageUrl: validImageUrl } : {})
                });
              }
              reject(new Error('Invalid JSON schema from scrapling_harvester'));
            } catch (parseErr) {
              reject(parseErr);
            }
          });
        });
      };

      const result = await runPy();
      if (result && (result.essenceText || result.fullMarkdownBody || result.imageUrl)) {
        return result;
      }
    } catch {
      // Gracefully fall through to TypeScript fallback
    }
  }

  // TypeScript Fallback
  if (htmlFallback) {
    return extractCleanArticleFromHtml(htmlFallback, url);
  }

  if (typeof fetch === 'function') {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 (Atem Reader)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      });
      if (res.ok) {
        const text = await res.text();
        return extractCleanArticleFromHtml(text, url);
      }
    } catch {
      // Network failure or CORS rejection
    }
  }

  return createSyntheticFallback(url, 'Fachbeitrag');
}

/**
 * Checks whether an item is a thin stub (feedText < 40 chars or body < 40 chars)
 * and enriches it with authentic content if available.
 * Never concatenates or pads genuine RSS summaries with synthetic filler!
 */
export function enrichStubItemWithFulltext(item: FeedItem, harvested?: HarvestedArticle): FeedItem {
  const currentFeedText = (item.feedText || '').trim();
  const currentBody = (item.body || item.articleBody || '').trim();

  const isFeedTextThin = currentFeedText.length < 40;
  const isBodyThin = currentBody.length < 40;
  const hasExistingImage = Boolean(item.imageUrl && !isRejectedLowResOrLogoUrl(item.imageUrl));

  if (!isFeedTextThin && !isBodyThin && !harvested) {
    return item;
  }

  // Use provided harvested content or extract clean content from raw HTML
  const article = harvested || extractCleanArticleFromHtml(
    item.body || item.feedText || item.articleBody || '',
    item.canonicalUrl || item.sourceReferences?.[0]?.originalUrl || ''
  );

  const resolvedImageUrl = !hasExistingImage && article.imageUrl && !isRejectedLowResOrLogoUrl(article.imageUrl)
    ? article.imageUrl
    : undefined;

  const updatedFeedText = isFeedTextThin
    ? (article.essenceText || currentFeedText)
    : currentFeedText;

  const updatedBody = isBodyThin
    ? (article.fullMarkdownBody || currentBody)
    : (article.fullMarkdownBody.length > currentBody.length ? article.fullMarkdownBody : currentBody);

  const wordCount = updatedBody.split(/\s+/).filter(Boolean).length;
  const estimatedReadingMinutes = Math.max(1, Math.ceil(wordCount / 200));

  return {
    ...item,
    feedText: updatedFeedText,
    body: updatedBody,
    ...(resolvedImageUrl ? { imageUrl: resolvedImageUrl, hasAuthenticImage: true } : {}),
    wordCount: isBodyThin ? wordCount : (item.wordCount && item.wordCount > wordCount ? item.wordCount : wordCount),
    estimatedReadingMinutes: isBodyThin ? estimatedReadingMinutes : (
      item.estimatedReadingMinutes && item.estimatedReadingMinutes > estimatedReadingMinutes
        ? item.estimatedReadingMinutes
        : estimatedReadingMinutes
    )
  };
}
