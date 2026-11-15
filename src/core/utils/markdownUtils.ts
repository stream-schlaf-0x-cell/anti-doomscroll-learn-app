/**
 * Markdown Utilities for Editorial Readability
 * 
 * Provides pure utility functions for parsing inline markdown tokens
 * and stripping markdown syntax for clean text distillation.
 */

export interface InlineToken {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  /** Absolute http(s) URL when the token is a Markdown link `[text](url)`. */
  url?: string;
}

/**
 * Parses inline formatting like **bold**, *italic*, `code` and [links](https://…)
 */
export function parseInlineFormatting(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  const regex = /(\[[^\]\n]{1,300}\]\(https?:\/\/[^)\s]+\)|\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_|`[^`]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ text: text.slice(lastIndex, match.index) });
    }
    const tokenStr = match[0];
    const linkMatch = tokenStr.match(/^\[([^\]\n]{1,300})\]\((https?:\/\/[^)\s]+)\)$/);
    if (linkMatch) {
      const label = linkMatch[1].replace(/\*\*/g, '').trim();
      tokens.push({ text: label || linkMatch[2], url: linkMatch[2] });
    } else if (tokenStr.startsWith('**') && tokenStr.endsWith('**')) {
      tokens.push({ text: tokenStr.slice(2, -2), bold: true });
    } else if (
      (tokenStr.startsWith('*') && tokenStr.endsWith('*')) ||
      (tokenStr.startsWith('_') && tokenStr.endsWith('_'))
    ) {
      tokens.push({ text: tokenStr.slice(1, -1), italic: true });
    } else if (tokenStr.startsWith('`') && tokenStr.endsWith('`')) {
      tokens.push({ text: tokenStr.slice(1, -1), code: true });
    } else {
      tokens.push({ text: tokenStr });
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    tokens.push({ text: text.slice(lastIndex) });
  }

  return tokens.length > 0 ? tokens : [{ text }];
}

/**
 * Strips leading and trailing markdown artifacts for clean plain text display
 */
export function stripMarkdownFormatting(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/^#{1,6}\s+/gm, '') // Remove heading hashes
    .replace(/^\s*[-*+]\s+/gm, '') // Remove bullet markers
    .replace(/^\s*\d+\.\s+/gm, '') // Remove numbered list markers
    .replace(/^\s*>\s+/gm, '') // Remove blockquotes
    .replace(/\*\*([^*]+)\*\*/g, '$1') // Bold
    .replace(/\*([^*]+)\*/g, '$1') // Italic
    .replace(/_([^_]+)_/g, '$1')
    .replace(/`([^`]+)`/g, '$1') // Code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Links [title](url) -> title
    .replace(/\s+/g, ' ')
    .trim();
}

export const BOLD_ONLY_LINE = /^\*\*([^*\n]{3,120})\*\*:?$/;
export const BULLET_LINE = /^(?:[-*•]\s+)/;
export const NUMBERED_LINE = /^\d+[.)]\s+/;

/**
 * Splits raw markdown into render blocks and upgrades implicit structure:
 * - a heading line followed by text in the same block becomes its own block
 * - a short stand-alone **bold** line acts as a sub-heading (### …)
 */
export function buildMarkdownBlocks(content: string): string[] {
  const rawBlocks = (content || '').replace(/\r\n?/g, '\n').split(/\n\s*\n/);
  const blocks: string[] = [];
  for (const raw of rawBlocks) {
    const lines = raw.split('\n').map(l => l.trimEnd());
    let buffer: string[] = [];
    const flush = () => {
      if (buffer.length === 0) return;
      const isStructured = buffer.some(l => BULLET_LINE.test(l) || NUMBERED_LINE.test(l) || l.startsWith('>'));
      const proseLines = buffer.filter(l => l.length >= 60).length;
      if (!isStructured && buffer.length > 1 && proseLines >= Math.ceil(buffer.length * 0.6)) {
        // Plain-text feeds separate paragraphs with single newlines: give each its own paragraph
        for (const l of buffer) blocks.push(l);
      } else {
        const joined = buffer.join('\n').trim();
        if (joined) blocks.push(joined);
      }
      buffer = [];
    };
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (/^#{1,4}\s+\S/.test(trimmed)) {
        flush();
        blocks.push(trimmed);
        continue;
      }
      if (/^(?:-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
        flush();
        blocks.push('---');
        continue;
      }
      const boldOnly = trimmed.match(BOLD_ONLY_LINE);
      if (boldOnly && !/[.!?]$/.test(boldOnly[1].trim())) {
        flush();
        blocks.push(`### ${boldOnly[1].trim()}`);
        continue;
      }
      buffer.push(trimmed);
    }
    flush();
  }
  return blocks;
}
