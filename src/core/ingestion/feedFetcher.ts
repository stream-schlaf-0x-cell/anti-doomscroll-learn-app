import { RawFeedSource, RawFeedEntry } from './types';
import { parseFeedXml } from './rssParser';
import { getSourceKind } from './sourceHealth';

export interface FeedFetchResult {
  source: RawFeedSource;
  entries: RawFeedEntry[];
  success: boolean;
  error?: string;
  durationMs: number;
  fetchedAt: string;
}

/**
 * Fetches an RSS/Atom feed directly without any third-party CORS proxy.
 * Server-side / CI pipeline (`scripts/run-pipeline.ts`) and native iOS fetch all feeds directly;
 * Web clients consume the public feed snapshot (`feed-snapshot.json`) plus CORS-native open APIs.
 */
async function fetchRssDirect(url: string, timeoutMs: number): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
        'User-Agent': 'atmen-learning-reader/2.0 (sovereign-knowledge-feed)'
      },
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const xml = await response.text();
    if (!xml || (!xml.includes('<rss') && !xml.includes('<feed') && !xml.includes('<rdf') && !xml.includes('<item') && !xml.includes('<entry'))) {
      throw new Error('Response is not valid RSS/Atom XML');
    }
    return xml;
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

/**
 * Fetches and parses a single RSS/Atom feed with timeout & error isolation.
 * Records fetch success, timestamp, item count, and error message per source.
 */
export async function fetchSingleFeed(
  source: RawFeedSource,
  timeoutMs = 7000
): Promise<FeedFetchResult> {
  const start = Date.now();
  const fetchedAt = new Date().toISOString();
  if (getSourceKind(source) === 'reference') {
    return { source, entries: [], success: false, error: 'Referenzseite – kein RSS-/Atom-Endpunkt', durationMs: 0, fetchedAt };
  }

  try {
    const xml = await fetchRssDirect(source.url, timeoutMs);
    const entries = parseFeedXml(xml, source.id);

    return {
      source,
      entries,
      success: entries.length > 0,
      error: entries.length === 0 ? 'Keine Einträge im Feed gefunden' : undefined,
      durationMs: Date.now() - start,
      fetchedAt
    };
  } catch (err: any) {
    const errorMsg = err?.name === 'AbortError'
      ? `Timeout after ${timeoutMs}ms`
      : (err?.message || String(err));

    return {
      source,
      entries: [],
      success: false,
      error: errorMsg,
      durationMs: Date.now() - start,
      fetchedAt
    };
  }
}

/**
 * Fetches multiple feeds concurrently with bounded concurrency.
 * Never throws; returns isolated results for every source.
 */
export async function fetchAllFeeds(
  sources: RawFeedSource[],
  concurrency = 6,
  timeoutMs = 7000
): Promise<FeedFetchResult[]> {
  const results: FeedFetchResult[] = [];
  const queue = [...sources];

  async function worker() {
    while (queue.length > 0) {
      const next = queue.shift();
      if (!next) break;
      const res = await fetchSingleFeed(next, timeoutMs);
      results.push(res);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, sources.length) }, () => worker());
  await Promise.all(workers);

  return results;
}

/**
 * Fetches raw XML string for a given feed URL.
 */
export async function fetchFeedXml(
  url: string,
  options?: { timeoutMs?: number }
): Promise<{ content: string; status: number }> {
  const timeoutMs = options?.timeoutMs ?? 6000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'atmen-bloomscroll/2.0',
        Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*'
      }
    });
    clearTimeout(timer);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return { content: await res.text(), status: res.status };
  } finally {
    clearTimeout(timer);
  }
}

