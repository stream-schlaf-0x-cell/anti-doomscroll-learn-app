/**
 * Strips duplicate leading title from article summary or feedText if the body
 * accidentally starts with its own headline.
 */
export function stripLeadingTitleDuplicate(text: string, title?: string): string {
  if (!text || !title) return text;
  const cleanTitle = title.trim();
  const cleanText = text.trim();
  if (cleanTitle.length === 0 || cleanText.length === 0) return text;

  // Exact match or prefix match followed by punctuation/whitespace
  if (cleanText.toLowerCase().startsWith(cleanTitle.toLowerCase())) {
    let remainder = cleanText.slice(cleanTitle.length).trim();
    // Strip leading punctuation often placed after repeated headline
    remainder = remainder.replace(/^[:\-–—.,\s]+/, '').trim();
    if (remainder.length > 0) {
      return remainder;
    }
  }

  // Also check if title ending in question mark or exclamation mark is repeated
  const titleWithoutPunct = cleanTitle.replace(/[.:\-–—!?]+$/, '').trim();
  if (titleWithoutPunct.length > 10 && cleanText.toLowerCase().startsWith(titleWithoutPunct.toLowerCase())) {
    let remainder = cleanText.slice(titleWithoutPunct.length).trim();
    remainder = remainder.replace(/^[:\-–—.,?!;\s]+/, '').trim();
    if (remainder.length > 0) {
      return remainder;
    }
  }

  // Fallback: match first 6 headline words followed by separator punctuation
  const titleWords = titleWithoutPunct.split(/\s+/).slice(0, 6).join(' ').toLowerCase();
  if (titleWords.length > 18 && cleanText.toLowerCase().startsWith(titleWords)) {
    const sepMatch = cleanText.slice(0, titleWithoutPunct.length + 20).match(/[:\-–—]\s*/);
    if (sepMatch && sepMatch.index !== undefined) {
      const remainder = cleanText.slice(sepMatch.index + sepMatch[0].length).trim();
      if (remainder.length > 0) {
        return remainder;
      }
    }
  }

  return text;
}
