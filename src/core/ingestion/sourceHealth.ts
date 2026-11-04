import { z } from 'zod';
import { RawFeedSource } from './types';

export const SourceHealthSchema = z.object({
  sourceId: z.string().min(1),
  name: z.string(),
  url: z.string().url(),
  fetchSuccess: z.boolean(),
  lastSuccessAt: z.string().datetime({ offset: true }).optional(),
  checkedAt: z.string().datetime({ offset: true }).optional(),
  lastError: z.string().optional(),
  itemCount: z.number().int().nonnegative(),
  durationMs: z.number().nonnegative().optional()
});
export type SourceHealthInfo = z.infer<typeof SourceHealthSchema>;
export type SourceKind = 'feed' | 'reference';
export type SourceHealthStatus = 'unknown' | 'delivering' | 'failing' | 'reference';

/**
 * Detects whether a URL is a bare homepage or HTML reference page without RSS/Atom endpoints.
 * E.g. ending in .de/, .org/, .ch/, .at/, or .html/.htm without feed/rss/xml/atom.
 */
export function isNonRssHomepageUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    const full = `${url.pathname}${url.search}`.toLowerCase();
    const hasFeedHint = /(?:feed|rss|atom|\.rdf|\.xml|biorxiv_xml)/i.test(full);
    if (hasFeedHint || url.hostname.startsWith('newsfeed.')) return false;

    // Bare root or homepath
    const path = url.pathname.toLowerCase().replace(/\/+$/, '');
    if (path === '' || /\.(?:html?|php)$/i.test(path)) {
      return true;
    }

    // Bare overview sections or github repositories without feed
    if (url.hostname === 'github.com' && !full.includes('/commits/')) {
      return true;
    }
    if (path.split('/').length <= 2 && !hasFeedHint) {
      return true;
    }

    return false;
  } catch {
    return true;
  }
}

/** Catalog membership is editorial selection; a reference URL is not an RSS claim. */
export function getSourceKind(source: Pick<RawFeedSource, 'sourceKind' | 'defaultEnabled' | 'url'>): SourceKind {
  if (source.sourceKind) return source.sourceKind;
  if (isNonRssHomepageUrl(source.url)) return 'reference';
  if (source.defaultEnabled !== false) return 'feed';
  const url = new URL(source.url);
  const feedEndpoint = /(?:feed|rss|atom|\.rdf|\.xml|biorxiv_xml)/i.test(`${url.pathname}${url.search}`)
    || url.hostname.startsWith('newsfeed.');
  return feedEndpoint ? 'feed' : 'reference';
}

export function parseSourceHealth(value: unknown): Record<string, SourceHealthInfo> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const records: Record<string, SourceHealthInfo> = {};
  for (const [id, raw] of Object.entries(value)) {
    const parsed = SourceHealthSchema.safeParse(raw);
    if (parsed.success && parsed.data.sourceId === id) records[id] = parsed.data;
  }
  return records;
}

export function isDeliveringHealth(health?: SourceHealthInfo): boolean {
  return health?.fetchSuccess === true && health.itemCount > 0 && Boolean(health.lastSuccessAt);
}
