import { RawFeedEntry } from './types';

/**
 * Decodes common XML/HTML entities into plain characters.
 */
export function decodeXmlEntities(input: string): string {
  const entityMap: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&apos;': "'",
    '&#39;': "'",
    '&nbsp;': ' ',
    '&auml;': 'ä',
    '&ouml;': 'ö',
    '&uuml;': 'ü',
    '&Auml;': 'Ä',
    '&Ouml;': 'Ö',
    '&Uuml;': 'Ü',
    '&szlig;': 'ß',
    '&eacute;': 'é',
    '&egrave;': 'è',
    '&ndash;': '–',
    '&mdash;': '—',
    '&hellip;': '…',
    '&lsquo;': '’',
    '&rsquo;': '’',
    '&ldquo;': '“',
    '&rdquo;': '”',
    '&laquo;': '«',
    '&raquo;': '»'
  };

  let decoded = input;
  for (const [entity, char] of Object.entries(entityMap)) {
    decoded = decoded.split(entity).join(char);
  }

  return decoded
    .replace(/&#(\d+);/g, (_, dec) => {
      try {
        return String.fromCharCode(parseInt(dec, 10));
      } catch {
        return '';
      }
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      try {
        return String.fromCharCode(parseInt(hex, 16));
      } catch {
        return '';
      }
    });
}

/**
 * Unwraps CDATA sections and extracts the raw inner text.
 */
export function unwrapCdata(input: string): string {
  return input.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
}

export const ZERO_WIDTH_REGEX = /[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF\u00AD]/g;

/**
 * Strips HTML tags, preserves paragraph breaks as double newlines, and trims excess whitespace.
 * Decodes XML entities before tag stripping so escaped tags (&lt;p&gt;) are properly detected and removed.
 */
export function stripHtml(input: string): string {
  if (!input) return '';
  const unwrapped = unwrapCdata(input);
  const decoded = decodeXmlEntities(unwrapped);
  const textWithLineBreaks = decoded
    .replace(/<\/?(p|div|br|li|h[1-6])[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '');
  return decodeXmlEntities(textWithLineBreaks)
    .replace(ZERO_WIDTH_REGEX, '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/**
 * Extracts inner content of a specific XML tag from a block of text.
 */
function getTagContent(xml: string, tagName: string): string {
  const cdataRegex = new RegExp(`<${tagName}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*<\\/${tagName}>`, 'i');
  const cdataMatch = xml.match(cdataRegex);
  if (cdataMatch && cdataMatch[1]) {
    return cdataMatch[1].trim();
  }

  const standardRegex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = xml.match(standardRegex);
  if (match && match[1]) {
    return unwrapCdata(match[1]).trim();
  }
  return '';
}

/**
 * Extracts attribute value (e.g. href="...") from an XML tag.
 */
function getAttribute(xml: string, tagName: string, attrName: string): string {
  const regex = new RegExp(`<${tagName}[^>]*\\b${attrName}=["']([^"']+)["'][^>]*>`, 'i');
  const match = xml.match(regex);
  return match && match[1] ? match[1].trim() : '';
}

/**
 * Parses a date string into standard ISO 8601 or falls back to current time.
 * Clamps future dates (e.g. weekend print issue dates) to Date.now().
 */
export function parseDateWithReliability(dateStr?: string): { iso: string; reliable: boolean } {
  if (!dateStr || !dateStr.trim()) {
    return { iso: new Date().toISOString(), reliable: false };
  }
  const parsed = new Date(dateStr.trim());
  if (isNaN(parsed.getTime())) {
    return { iso: new Date().toISOString(), reliable: false };
  }
  if (parsed.getTime() > Date.now()) {
    return { iso: new Date().toISOString(), reliable: true };
  }
  return { iso: parsed.toISOString(), reliable: true };
}

function parseDateToIso(dateStr: string): string {
  return parseDateWithReliability(dateStr).iso;
}

export function sanitizeImageUrl(rawUrl?: string): string | undefined {
  if (!rawUrl) return undefined;
  let url = decodeXmlEntities(rawUrl.trim());
  url = url.replace(/&amp;/g, '&');

  // Upgrade http:// to https://
  if (url.startsWith('http://')) {
    url = 'https://' + url.slice(7);
  } else if (url.startsWith('//')) {
    url = 'https:' + url;
  }

  // Reject tracking pixel and junk image URLs
  const lower = url.toLowerCase();
  if (
    lower.includes('cpx.golem.de') ||
    lower.includes('follow.it/track') ||
    lower.includes('doubleclick') ||
    lower.includes('1x1') ||
    lower.includes('pixel') ||
    lower.endsWith('.svg') ||
    lower.includes('.svg?')
  ) {
    return undefined;
  }

  // Must be a valid absolute HTTPS URL
  if (!url.startsWith('https://')) {
    return undefined;
  }

  return url;
}

function resolveMaybeRelativeUrl(rawSrc: string, itemLink?: string): string | undefined {
  const src = rawSrc.trim();
  if (!src) return undefined;
  if (src.startsWith('http://') || src.startsWith('https://')) {
    return src;
  }
  if (src.startsWith('//')) {
    return `https:${src}`;
  }
  if (itemLink && (src.startsWith('/') || /^[a-z0-9_\-./]+\.(jpg|jpeg|png|webp|gif)/i.test(src))) {
    try {
      return new URL(src, itemLink).toString();
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/**
 * Extracts a media/enclosure/inline image URL if present in the entry block.
 * Resolves relative paths (e.g. /bilder/... on forschung-und-wissen.de) against itemLink.
 */
function extractImageUrl(block: string, itemLink?: string): string | undefined {
  let candidate: string | undefined;

  // 1. YouTube & Media RSS thumbnail (<media:thumbnail url="...">)
  const thumbMatch = block.match(/<media:thumbnail\b[^>]*\burl=["']([^"']+)["']/i);
  if (thumbMatch && thumbMatch[1]) {
    candidate = resolveMaybeRelativeUrl(decodeXmlEntities(thumbMatch[1]), itemLink);
  }

  // 2. Enclosure attribute url="..." (filter out non-images like audio/video)
  if (!candidate) {
    const enclosureMatch = block.match(/<enclosure\b[^>]*\burl=["']([^"']+)["']/i);
    if (enclosureMatch && enclosureMatch[1] && !/\.(mp3|wav|ogg|mp4|m4a|flv)/i.test(enclosureMatch[1])) {
      candidate = resolveMaybeRelativeUrl(decodeXmlEntities(enclosureMatch[1]), itemLink);
    }
  }

  // 3. Media:content if it's an image (skip YouTube player URLs like youtube.com/v/ and media files)
  if (!candidate) {
    const mediaContentMatch = block.match(/<media:content\b[^>]*\burl=["']([^"']+)["']/i);
    if (
      mediaContentMatch &&
      mediaContentMatch[1] &&
      !/\.(mp3|wav|ogg|mp4|m4a|flv)/i.test(mediaContentMatch[1]) &&
      !mediaContentMatch[1].includes('youtube.com/v/')
    ) {
      candidate = resolveMaybeRelativeUrl(decodeXmlEntities(mediaContentMatch[1]), itemLink);
    }
  }

  // 4. <img> tag in HTML content/description (handle both raw and XML-escaped HTML e.g. xkcd, forschung-und-wissen.de)
  if (!candidate) {
    const decodedBlock = decodeXmlEntities(block);
    const imgMatch = decodedBlock.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i);
    if (imgMatch && imgMatch[1]) {
      candidate = resolveMaybeRelativeUrl(imgMatch[1], itemLink);
    }
  }

  return sanitizeImageUrl(candidate);
}

/**
 * Extracts the hidden hover / bonus punchline from <img title="..." alt="..."> (e.g. xkcd, SMBC, Existential Comics).
 */
function extractImageAltText(block: string, entryTitle: string): string | undefined {
  const decodedBlock = decodeXmlEntities(block);
  const imgTagMatch = decodedBlock.match(/<img\b[^>]*>/i);
  if (!imgTagMatch) return undefined;
  const imgTag = imgTagMatch[0];

  const titleAttr = imgTag.match(/\btitle=["']([^"']+)["']/i)?.[1]?.trim();
  if (titleAttr && titleAttr.length > 6 && titleAttr.toLowerCase() !== entryTitle.trim().toLowerCase()) {
    return decodeXmlEntities(titleAttr);
  }

  const altAttr = imgTag.match(/\balt=["']([^"']+)["']/i)?.[1]?.trim();
  if (altAttr && altAttr.length > 20 && altAttr.toLowerCase() !== entryTitle.trim().toLowerCase()) {
    return decodeXmlEntities(altAttr);
  }

  return undefined;
}

/**
 * Separates inline copyright prefixes (e.g. "© Forschung und Wissen, KI-Bild") from the summary text.
 */
function extractCreditAndCleanSummary(summaryText: string): { cleanSummary: string; imageCredit?: string } {
  const trimmed = summaryText.trim();
  const creditMatch = trimmed.match(/^(?:©|Foto:|Bild:|Image:)\s*([^\n.]{3,75}?)(?:\s{2,}|\n|(?=[A-ZÄÖÜ]))/);
  if (creditMatch && creditMatch[1]) {
    const credit = creditMatch[1].trim();
    const rest = trimmed.slice(creditMatch[0].length).trim();
    if (rest.length > 20) {
      return { cleanSummary: rest, imageCredit: `© ${credit.replace(/^©\s*/, '')}` };
    }
  }
  return { cleanSummary: trimmed };
}

/**
 * Pure TypeScript parser for RSS 2.0, RSS 1.0 (RDF), and Atom feeds.
 * Does not depend on native C++ bindings or browser DOM.
 */
export function parseFeedXml(xmlContent: string, sourceId: string): RawFeedEntry[] {
  const entries: RawFeedEntry[] = [];
  const isAtom = /<feed\b[^>]*>/i.test(xmlContent) || /<entry\b[^>]*>/i.test(xmlContent);

  if (isAtom) {
    // Atom 1.0 Parsing
    const entryBlocks = xmlContent.match(/<entry\b[\s\S]*?<\/entry>/gi) || [];
    for (const block of entryBlocks) {
      const id = getTagContent(block, 'id') || getAttribute(block, 'link', 'href');
      const titleRaw = getTagContent(block, 'title');
      const title = stripHtml(titleRaw);

      // Atom link can be <link href="..."/> or <link rel="alternate" href="..."/>
      let link = '';
      const linkMatches = block.match(/<link\b[^>]*>/gi) || [];
      for (const lTag of linkMatches) {
        const href = lTag.match(/href=["']([^"']+)["']/i)?.[1];
        const rel = lTag.match(/rel=["']([^"']+)["']/i)?.[1];
        if (href && (!rel || rel === 'alternate')) {
          link = href;
          break;
        }
      }
      if (!link) {
        link = getAttribute(block, 'link', 'href') || id;
      }
      link = decodeXmlEntities(link.trim());
      const cleanId = decodeXmlEntities(id.trim());

      const summaryRaw = getTagContent(block, 'summary') || getTagContent(block, 'content');
      const { cleanSummary: summary, imageCredit } = extractCreditAndCleanSummary(stripHtml(summaryRaw));
      const fullContentRaw = getTagContent(block, 'content');
      const fullContent = fullContentRaw ? stripHtml(fullContentRaw) : undefined;

      const author =
        getTagContent(block, 'name') ||
        getTagContent(block, 'author') ||
        undefined;

      const published =
        getTagContent(block, 'published') ||
        getTagContent(block, 'updated');

      const imageUrl = extractImageUrl(block, link);
      const imageAltText = extractImageAltText(block, title);

      const dateInfo = parseDateWithReliability(published);

      if (title && link) {
        entries.push({
          id: cleanId || link,
          title,
          link,
          summary,
          fullContent,
          author: author ? stripHtml(author) : undefined,
          publishedAt: dateInfo.iso,
          publicationDateReliable: dateInfo.reliable,
          sourceId,
          imageUrl,
          imageAltText,
          imageCredit
        });
      }
    }
  } else {
    // RSS 2.0 / RSS 1.0 Parsing
    const itemBlocks = xmlContent.match(/<item\b[\s\S]*?<\/item>/gi) || [];
    for (const block of itemBlocks) {
      const guid = getTagContent(block, 'guid');
      const rawLink = getTagContent(block, 'link') || guid;
      const link = decodeXmlEntities(rawLink.trim());
      const cleanGuid = decodeXmlEntities(guid.trim());
      const titleRaw = getTagContent(block, 'title');
      const title = stripHtml(titleRaw);

      const descRaw = getTagContent(block, 'description');
      const { cleanSummary: summary, imageCredit } = extractCreditAndCleanSummary(stripHtml(descRaw));

      const contentEncodedRaw = getTagContent(block, 'content:encoded');
      const fullContent = contentEncodedRaw ? stripHtml(contentEncodedRaw) : undefined;

      const author =
        getTagContent(block, 'dc:creator') ||
        getTagContent(block, 'author') ||
        undefined;

      const pubDate =
        getTagContent(block, 'pubDate') ||
        getTagContent(block, 'dc:date');

      const dateInfo = parseDateWithReliability(pubDate);
      const imageUrl = extractImageUrl(block, link);
      const imageAltText = extractImageAltText(block, title);

      if (title && link) {
        entries.push({
          id: cleanGuid || link,
          title,
          link,
          summary,
          fullContent,
          author: author ? stripHtml(author) : undefined,
          publishedAt: dateInfo.iso,
          publicationDateReliable: dateInfo.reliable,
          sourceId,
          imageUrl,
          imageAltText,
          imageCredit
        });
      }
    }
  }

  return entries;
}

