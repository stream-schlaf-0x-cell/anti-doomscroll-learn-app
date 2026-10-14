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
 */
function parseDateToIso(dateStr: string): string {
  if (!dateStr) return new Date().toISOString();
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
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
      const summary = stripHtml(summaryRaw);
      const fullContentRaw = getTagContent(block, 'content');
      const fullContent = fullContentRaw ? stripHtml(fullContentRaw) : undefined;

      const author =
        getTagContent(block, 'name') ||
        getTagContent(block, 'author') ||
        undefined;

      const published =
        getTagContent(block, 'published') ||
        getTagContent(block, 'updated');

      if (title && link) {
        entries.push({
          id: cleanId || link,
          title,
          link,
          summary,
          fullContent,
          author: author ? stripHtml(author) : undefined,
          publishedAt: parseDateToIso(published),
          sourceId
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
      const summary = stripHtml(descRaw);

      const contentEncodedRaw = getTagContent(block, 'content:encoded');
      const fullContent = contentEncodedRaw ? stripHtml(contentEncodedRaw) : undefined;

      const author =
        getTagContent(block, 'dc:creator') ||
        getTagContent(block, 'author') ||
        undefined;

      const pubDate =
        getTagContent(block, 'pubDate') ||
        getTagContent(block, 'dc:date');

      if (title && link) {
        entries.push({
          id: cleanGuid || link,
          title,
          link,
          summary,
          fullContent,
          author: author ? stripHtml(author) : undefined,
          publishedAt: parseDateToIso(pubDate),
          sourceId
        });
      }
    }
  }

  return entries;
}
