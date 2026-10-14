import { FeedItem } from '../domain/types';

/**
 * Normalizes title string for duplicate detection (lowercase, remove punctuation, trim).
 */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface DeduplicationResult {
  uniqueItems: FeedItem[];
  duplicateCount: number;
  duplicateIds: string[];
}

/**
 * Deduplicates feed items within an incoming batch and against an optional existing pool.
 * Uses canonicalUrl, contentHash, and normalized title for exact identification.
 */
export function deduplicateFeedItems(
  newItems: FeedItem[],
  existingPool: FeedItem[] = []
): DeduplicationResult {
  const seenUrls = new Set<string>();
  const seenHashes = new Set<string>();
  const seenTitles = new Set<string>();
  const seenIds = new Set<string>();

  // Register existing items into lookup sets
  for (const item of existingPool) {
    seenIds.add(item.id);
    if (item.canonicalUrl) {
      seenUrls.add(item.canonicalUrl.toLowerCase());
    }
    if (item.contentHash) {
      seenHashes.add(item.contentHash);
    }
    seenTitles.add(normalizeTitle(item.title));
  }

  const uniqueItems: FeedItem[] = [];
  const duplicateIds: string[] = [];

  for (const item of newItems) {
    const normUrl = item.canonicalUrl ? item.canonicalUrl.toLowerCase() : null;
    const normTitle = normalizeTitle(item.title);
    const hash = item.contentHash;

    const isDuplicate =
      seenIds.has(item.id) ||
      (normUrl && seenUrls.has(normUrl)) ||
      (hash && seenHashes.has(hash)) ||
      (normTitle.length > 10 && seenTitles.has(normTitle));

    if (isDuplicate) {
      duplicateIds.push(item.id);
    } else {
      uniqueItems.push(item);
      seenIds.add(item.id);
      if (normUrl) seenUrls.add(normUrl);
      if (hash) seenHashes.add(hash);
      if (normTitle) seenTitles.add(normTitle);
    }
  }

  return {
    uniqueItems,
    duplicateCount: duplicateIds.length,
    duplicateIds
  };
}
