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
}

/**
 * Parses inline formatting like **bold**, *italic*, and `code`
 */
export function parseInlineFormatting(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_|`[^`]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ text: text.slice(lastIndex, match.index) });
    }
    const tokenStr = match[0];
    if (tokenStr.startsWith('**') && tokenStr.endsWith('**')) {
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
