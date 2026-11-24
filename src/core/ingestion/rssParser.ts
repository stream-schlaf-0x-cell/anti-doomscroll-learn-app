import { RawFeedEntry } from './types';
import { assessEditorialImage, isLikelyBannerOrLogoUrl } from '../utils/imageQuality';

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
    '&raquo;': '»',
    '&copy;': '©',
    '&reg;': '®',
    '&trade;': '™',
    '&bull;': '•',
    '&middot;': '·',
    '&shy;': '',
    '&zwnj;': '',
    '&sbquo;': '‚',
    '&bdquo;': '„'
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

function stripEmbeddedStyleAndScriptBlocks(raw: string): string {
  return raw
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, ' ');
}

/**
 * Strips HTML tags, embedded CSS/script blocks, orphaned stylesheet rules, and newsletter preambles,
 * preserving paragraph breaks as double newlines and trimming excess whitespace.
 * Decodes XML entities before tag stripping so escaped tags (&lt;p&gt;, &lt;style&gt;) are properly detected and removed.
 */
export function stripHtml(input: string): string {
  if (!input) return '';
  const unwrapped = unwrapCdata(input);
  const preDecodedClean = stripEmbeddedStyleAndScriptBlocks(unwrapped);
  const decoded = stripEmbeddedStyleAndScriptBlocks(decodeXmlEntities(preDecodedClean));
  const textWithLineBreaks = decoded
    .replace(/<\/?(p|div|br|li|h[1-6])[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '');
  return decodeXmlEntities(textWithLineBreaks)
    .replace(/([.#]?[a-zA-Z0-9_-]+(?:\s*,\s*[.#]?[a-zA-Z0-9_-]+)*\s*\{[^}]*\}\s*)+/g, ' ')
    .replace(/\.bh__[a-zA-Z0-9_-]+[^\n.]*/gi, ' ')
    .replace(ZERO_WIDTH_REGEX, '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim()
    .replace(/^(?:in today['’]s newsletter\s*:?\s*|view in browser\s*[|·:-]?\s*|read online\s*[|·:-]?\s*)+/i, '')
    .trim();
}

/**
 * Removes sponsor/advertising containers that newsletter platforms (Beehiiv, Substack, Mailchimp)
 * embed into the full-text RSS payload, e.g. Techpresso's "FROM OUR PARTNER" boxes.
 * Works on raw HTML so that the real editorial stories between two ad boxes are never swallowed.
 */
export function stripNewsletterAdBlocks(html: string): string {
  if (!html) return '';
  let out = html;
  // Beehiiv / Dupple ad containers: <div id="main-ad-copy">, <div id="spotlight-ad-headline"> …
  out = out.replace(/<div\b[^>]*\bid=["'][^"']*-ad-[^"']*["'][^>]*>[\s\S]*?<\/div>/gi, ' ');
  // Ad labels (<p id="main-ad-partner-label"> / <p><b>FROM OUR PARTNER</b></p>)
  out = out.replace(/<p\b[^>]*\bid=["'][^"']*-ad-[^"']*["'][^>]*>[\s\S]*?<\/p>/gi, ' ');
  out = out.replace(/<(p|div|td|h[1-6])\b[^>]*>\s*(?:<(?:b|strong|span)\b[^>]*>\s*)*(?:from\s+our\s+partners?|together\s+with|sponsored\s+by|presented\s+by|anzeige|werbung)\b[^<]{0,60}(?:<\/(?:b|strong|span)>\s*)*<\/\1>/gi, ' ');
  // Every link/image explicitly flagged as ad slot
  out = out.replace(/<a\b[^>]*\bdata-ad-[a-z-]+=["'][^"']*["'][^>]*>[\s\S]*?<\/a>/gi, ' ');
  out = out.replace(/<img\b[^>]*(?:alt=["']sponsor["']|data-ad-role)[^>]*>/gi, ' ');
  out = out.replace(/<div\b[^>]*\bid=["']beehiiv-ad-slot["'][^>]*>[\s\S]*?<\/div>/gi, ' ');
  return out;
}

const LINK_ONLY_ANCHOR_TEXT = /^(?:link|read more|mehr|weiterlesen|mehr lesen|here|hier|source|quelle|→|↗|»|more|full story|continue reading)$/i;

function hostnameLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'Quelle';
  }
}

function isSkippableHref(href: string): boolean {
  const lower = href.trim().toLowerCase();
  return (
    !/^https?:\/\//.test(lower) ||
    /unsubscribe|manage[-_ ]?preferences|subscribe\?|\/subscribe\b|view[-_ ]?in[-_ ]?browser|mailto:|utm_campaign=referral|\/advertise\b|beehiiv\.com\/\?|share\.|twitter\.com\/intent|facebook\.com\/sharer|linkedin\.com\/share/.test(lower)
  );
}

/**
 * Structure-preserving HTML → Markdown converter for the Reader.
 * Keeps sub-headings (##/###), block quotes (>), bullet lists (-), bold/italic emphasis and
 * real source links ([text](url)) instead of flattening everything into plain text.
 * Newsletter story titles rendered as bold table cells (Beehiiv/Techpresso) become ### headings,
 * and their trailing "LINK" anchors become a dedicated "↗ Primärquelle" line under the heading.
 */
export function htmlToEditorialMarkdown(input: string): string {
  if (!input) return '';
  let html = unwrapCdata(input);
  // Entity-escaped HTML (RSS without CDATA): decode once so tags become real tags
  if (!/<[a-z][^>]*>/i.test(html) && /&lt;[a-z]/i.test(html)) {
    html = decodeXmlEntities(html);
  }
  html = stripEmbeddedStyleAndScriptBlocks(html);
  html = stripNewsletterAdBlocks(html);

  const LINK_OPEN = '\uE000';
  const LINK_MID = '\uE001';
  const LINK_CLOSE = '\uE002';
  const SRC_OPEN = '\uE003';

  // 1. Anchors → link markers (before any other tag stripping)
  html = html.replace(/<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_m, rawHref: string, inner: string) => {
    const href = decodeXmlEntities(rawHref).trim();
    const text = decodeXmlEntities(inner.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
    if (!text) return ' ';
    if (isSkippableHref(href)) return text;
    if (LINK_ONLY_ANCHOR_TEXT.test(text)) return ` ${SRC_OPEN}${href}${LINK_CLOSE} `;
    return `${LINK_OPEN}${text}${LINK_MID}${href}${LINK_CLOSE}`;
  });

  // 2. Drop media
  html = html.replace(/<(img|picture|source|video|audio|iframe)\b[^>]*>/gi, ' ').replace(/<\/(picture|video|audio|iframe)>/gi, ' ');

  const innerText = (s: string) => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  // 3. Headings
  html = html.replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (_m, level: string, inner: string) => {
    const text = innerText(inner);
    if (!text) return '\n\n';
    const hashes = level === '1' || level === '2' ? '##' : level === '3' ? '###' : '####';
    return `\n\n${hashes} ${text}\n\n`;
  });

  // 4. Bold-styled short table cells / paragraphs act as section headings (newsletter story titles)
  html = html.replace(
    /<(td|p|div)\b([^>]*\bstyle=(?:"[^"]*font-weight:\s*(?:bold|[6-9]00)[^"]*"|'[^']*font-weight:\s*(?:bold|[6-9]00)[^']*')[^>]*)>([\s\S]*?)<\/\1>/gi,
    (match, _tag: string, _attrs: string, inner: string) => {
      if (/<(?:p|div|td|table|ul|ol|li|h[1-6])\b/i.test(inner)) return match;
      const text = innerText(inner);
      const visible = text.replace(new RegExp(`${SRC_OPEN}[\\s\\S]*?${LINK_CLOSE}`, 'g'), '').trim();
      if (visible.length < 4 || visible.length > 150 || /[.!?:;]$/.test(visible)) return match;
      return `\n\n### ${text}\n\n`;
    }
  );

  // 5. Block quotes
  html = html.replace(/<blockquote\b[^>]*>([\s\S]*?)<\/blockquote>/gi, (_m, inner: string) => {
    const text = inner
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div)>/gi, '\n')
      .replace(/<[^>]+>/g, ' ');
    const lines = text
      .split('\n')
      .map(l => l.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .map(l => `> ${l}`);
    return lines.length ? `\n\n${lines.join('\n')}\n\n` : '\n\n';
  });

  // 6. Lists
  html = html.replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_m, inner: string) => {
    const text = innerText(inner.replace(/<\/(p|div)>/gi, ' '));
    return text ? `\n- ${text}\n` : '\n';
  });

  // 7. Inline emphasis
  html = html.replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_m, _t: string, inner: string) => {
    const text = innerText(inner);
    if (!text || text.includes('*')) return ` ${text} `;
    return ` **${text}** `;
  });
  html = html.replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_m, _t: string, inner: string) => {
    const text = innerText(inner);
    if (!text || text.includes('*') || text.length > 220) return ` ${text} `;
    return ` *${text}* `;
  });

  // 8. Block boundaries
  html = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(p|div|tr|table|tbody|thead|section|article|figure|figcaption|header|footer|ul|ol|hr|center)\b[^>]*>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ');

  let text = decodeXmlEntities(html)
    .replace(ZERO_WIDTH_REGEX, '')
    .replace(/\u00a0/g, ' ')
    .replace(/\r\n?/g, '\n');

  // 9. Line-level normalization
  const rawLines = text.split('\n').map(l => l.replace(/[ \t]+/g, ' ').trim());
  const lines: string[] = [];
  for (let line of rawLines) {
    if (!line) {
      lines.push('');
      continue;
    }
    if (/^(?:link|★+|☆+|\*+)$/i.test(line)) continue;
    line = line.replace(/^[•·▪◦‣]\s*/, '- ');
    // Fix emphasis spacing artifacts: "** text **" → "**text**", stray " ." after emphasis
    line = line.replace(/\*\*\s+([^*]+?)\s+\*\*/g, '**$1**').replace(/\s+([.,;:!?])/g, '$1');

    if (/^#{2,4}\s/.test(line)) {
      // Pull source links out of headings into a dedicated line beneath
      const sources: string[] = [];
      line = line.replace(new RegExp(`${SRC_OPEN}([\\s\\S]*?)${LINK_CLOSE}`, 'g'), (_m, url: string) => {
        sources.push(url);
        return '';
      });
      line = line
        .replace(new RegExp(`${LINK_OPEN}([\\s\\S]*?)${LINK_MID}([\\s\\S]*?)${LINK_CLOSE}`, 'g'), (_m, t: string, url: string) => {
          sources.push(url);
          return t;
        })
        .replace(/\*\*/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (/^#{2,4}$/.test(line)) continue;
      lines.push('', line, '');
      if (sources.length > 0) {
        const url = sources[0];
        lines.push(`[↗ Primärquelle: ${hostnameLabel(url)}](${url})`, '');
      }
      continue;
    }

    line = line
      .replace(new RegExp(`${SRC_OPEN}([\\s\\S]*?)${LINK_CLOSE}`, 'g'), (_m, url: string) => `[↗ ${hostnameLabel(url)}](${url})`)
      .replace(new RegExp(`${LINK_OPEN}([\\s\\S]*?)${LINK_MID}([\\s\\S]*?)${LINK_CLOSE}`, 'g'), (_m, t: string, url: string) => `[${t.replace(/[[\]]/g, '')}](${url})`)
      .replace(/\s+/g, ' ')
      .trim();
    if (!line || line === '-' || line === '>' || line === '**' || line === '****') continue;
    lines.push(line);
  }

  // 10. Re-join: collapse blank lines, keep consecutive list items together
  const merged: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === '') {
      const prev = merged[merged.length - 1];
      let j = i + 1;
      while (j < lines.length && lines[j] === '') j++;
      const next = lines[j];
      if (prev !== undefined && next !== undefined && /^- /.test(prev) && /^- /.test(next)) continue;
      if (prev === '' || merged.length === 0) continue;
      merged.push('');
      continue;
    }
    merged.push(line);
  }

  return cleanNewsletterDigestMarkdown(merged.join('\n').replace(/\n{3,}/g, '\n\n').trim());
}

/**
 * Removes newsletter chrome around digest editions (greeting, date bar, duplicated table of contents,
 * feedback/rating footer, subscribe CTA) while keeping every real story, tool and paper section.
 */
export function cleanNewsletterDigestMarkdown(md: string): string {
  if (!md) return '';
  let out = md;
  out = out.replace(/^[^\n]*Join Free[^\n]*Upgrade[^\n]*$/gim, '');
  out = out.replace(/^Hi there,? this is your daily[^\n]*$/gim, '');
  out = out.replace(/^You can check the previous tools[^\n]*$/gim, '');
  // Duplicated table of contents ("In today's newsletter:" … "Plus: …") when real sections follow
  if (/\n#{2,4} /.test(out)) {
    out = out.replace(/(?:^|\n)\**In today['’]s (?:newsletter|edition|issue)\**:?\**\s*\n[\s\S]*?(?:\n\**Plus:?\**[^\n]*\n|(?=\n#{2,4} ))/i, '\n');
  }
  // Footer: community spotlight, academy upsell, rating widget, subscribe CTA
  out = out.replace(/\n(?:#{2,4}\s*)?[^\n]{0,6}\s*\**(?:From our community|Want to master the AI tools|How did you find today['’]s edition|Not subscribed to|Was this forwarded to you|Share this newsletter)[\s\S]*$/i, '');
  out = out.replace(/\n(?:Subscribe for free|Advertise|Feedback|Read Online|Unsubscribe)\s*(?=\n|$)/gi, '\n');
  return out.replace(/\n{3,}/g, '\n\n').trim();
}

/** Returns true when markdown carries real structure worth rendering (headings, lists, quotes, links). */
export function hasEditorialMarkdownStructure(md: string): boolean {
  if (!md) return false;
  return /(^|\n)(#{2,4} |> |- )\S/.test(md) || /\[[^\]]+\]\(https?:\/\/[^)\s]+\)/.test(md);
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
 * Attempts to recover a genuine publication date (YYYY/MM/DD or YYYY-MM-DD) from an article URL
 * when the feed XML omits <pubDate>.
 */
export function extractDateFromUrl(url?: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const fullDateMatch = url.match(/(?:^|[/\-_])(20[12]\d)[/\-_](0[1-9]|1[0-2])[/\-_](0[1-9]|[12]\d|3[01])(?=$|[/\-_.?])/);
  if (!fullDateMatch) return null;
  const [, yyyy, mm, dd] = fullDateMatch;
  const candidate = new Date(`${yyyy}-${mm}-${dd}T12:00:00.000Z`);
  if (isNaN(candidate.getTime())) return null;
  if (candidate.getTime() > Date.now() + 24 * 3600 * 1000) return null;
  return candidate.getTime() > Date.now() ? new Date().toISOString() : candidate.toISOString();
}

/**
 * Parses a date string into standard ISO 8601.
 * - Clamps future dates (e.g. weekend print issue dates) to Date.now().
 * - Recovers YYYY-MM-DD from article URLs if XML omits <pubDate>.
 * - When truly undated, assigns a neutral 5-day-old timestamp with `reliable: false`
 *   so undated archive essays never masquerade as "published 0 seconds ago" ahead of today's news.
 */
export function parseDateWithReliability(dateStr?: string, fallbackUrl?: string): { iso: string; reliable: boolean } {
  const neutralUndatedIso = () => new Date(Date.now() - 5 * 86400 * 1000).toISOString();
  if (!dateStr || !dateStr.trim()) {
    const urlDate = extractDateFromUrl(fallbackUrl);
    if (urlDate) {
      return { iso: urlDate, reliable: true };
    }
    return { iso: neutralUndatedIso(), reliable: false };
  }
  const parsed = new Date(dateStr.trim());
  if (isNaN(parsed.getTime())) {
    const urlDate = extractDateFromUrl(fallbackUrl);
    if (urlDate) {
      return { iso: urlDate, reliable: true };
    }
    return { iso: neutralUndatedIso(), reliable: false };
  }
  if (parsed.getTime() > Date.now()) {
    return { iso: new Date().toISOString(), reliable: true };
  }
  return { iso: parsed.toISOString(), reliable: true };
}

export function parseDateToIso(dateStr: string): string {
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

  if (candidate) {
    const cleanMedia = sanitizeImageUrl(candidate);
    if (cleanMedia && !isLikelyBannerOrLogoUrl(cleanMedia)) {
      return cleanMedia;
    }
    candidate = undefined;
  }

  // 4. <img> tags in HTML content/description: scan all candidates and skip newsletter header/logo banners
  const decodedBlock = decodeXmlEntities(block);
  for (const imgMatch of decodedBlock.matchAll(/<img\b[^>]*>/gi)) {
    const tag = imgMatch[0];
    const srcAttr = tag.match(/\bsrc=["']([^"']+)["']/i)?.[1];
    if (!srcAttr) continue;
    const altAttr = tag.match(/\balt=["']([^"']+)["']/i)?.[1] || '';
    const classAttr = tag.match(/\bclass=["']([^"']+)["']/i)?.[1] || '';
    if (/(?:techpresso|banner|header|logo|wordmark|masthead|avatar|pixel|spacer|sponsor)/i.test(`${srcAttr} ${altAttr} ${classAttr}`)) {
      continue;
    }
    const widthVal = parseInt(tag.match(/\bwidth=["']?(\d+)/i)?.[1] || '0', 10);
    const heightVal = parseInt(tag.match(/\bheight=["']?(\d+)/i)?.[1] || '0', 10);
    if (widthVal > 0 && heightVal > 0 && (widthVal / heightVal > 2.35 || widthVal < 200 || heightVal < 100)) {
      continue;
    }
    const resolved = resolveMaybeRelativeUrl(srcAttr, itemLink);
    const sanitized = sanitizeImageUrl(resolved);
    if (sanitized && !isLikelyBannerOrLogoUrl(sanitized) && assessEditorialImage(sanitized).isValid) {
      return sanitized;
    }
  }

  return undefined;
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
      const { cleanSummary: summary, imageCredit } = extractCreditAndCleanSummary(stripHtml(stripNewsletterAdBlocks(summaryRaw)));
      const fullContentRaw = getTagContent(block, 'content');
      const fullContent = fullContentRaw ? stripHtml(stripNewsletterAdBlocks(fullContentRaw)) : undefined;
      const fullContentMarkdown = fullContentRaw ? htmlToEditorialMarkdown(fullContentRaw) : undefined;

      const author =
        getTagContent(block, 'name') ||
        getTagContent(block, 'author') ||
        undefined;

      const published =
        getTagContent(block, 'published') ||
        getTagContent(block, 'updated') ||
        getTagContent(block, 'dc:date') ||
        getTagContent(block, 'dcterms:issued') ||
        getTagContent(block, 'dcterms:modified');

      const imageUrl = extractImageUrl(block, link);
      const imageAltText = extractImageAltText(block, title);

      const dateInfo = parseDateWithReliability(published, link);

      if (title && link) {
        entries.push({
          id: cleanId || link,
          title,
          link,
          summary,
          fullContent,
          fullContentMarkdown,
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
      const { cleanSummary: summary, imageCredit } = extractCreditAndCleanSummary(stripHtml(stripNewsletterAdBlocks(descRaw)));

      const contentEncodedRaw = getTagContent(block, 'content:encoded');
      const fullContent = contentEncodedRaw ? stripHtml(stripNewsletterAdBlocks(contentEncodedRaw)) : undefined;
      const fullContentMarkdown = contentEncodedRaw ? htmlToEditorialMarkdown(contentEncodedRaw) : undefined;

      const author =
        getTagContent(block, 'dc:creator') ||
        getTagContent(block, 'author') ||
        undefined;

      const pubDate =
        getTagContent(block, 'pubDate') ||
        getTagContent(block, 'dc:date') ||
        getTagContent(block, 'dcterms:issued') ||
        getTagContent(block, 'dcterms:modified') ||
        getTagContent(block, 'atom:published') ||
        getTagContent(block, 'atom:updated') ||
        getTagContent(block, 'prism:publicationDate');

      const dateInfo = parseDateWithReliability(pubDate, link);
      const imageUrl = extractImageUrl(block, link);
      const imageAltText = extractImageAltText(block, title);

      if (title && link) {
        entries.push({
          id: cleanGuid || link,
          title,
          link,
          summary,
          fullContent,
          fullContentMarkdown,
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

