import { FeedItem, FeedItemSchema } from '../domain/types';
import { FeedFetchResult } from './feedFetcher';
import { normalizeFeedEntry } from './normalizer';
import { SourceHealthInfo } from './sourceHealth';

export function normalizePipelineResults(results: FeedFetchResult[], previous: Record<string, SourceHealthInfo>, editionDate: string) {
  const normalizedCandidates: FeedItem[] = [];
  const sourceHealth: Record<string, SourceHealthInfo> = {};
  let totalRawEntries = 0;
  let successFeedCount = 0;
  for (const result of results) {
    let validForSource = 0;
    if (result.success && result.entries.length) {
      totalRawEntries += result.entries.length;
      for (const entry of result.entries.slice(0, 4)) {
        try {
          const parsed = FeedItemSchema.safeParse(normalizeFeedEntry(entry, result.source, editionDate));
          if (parsed.success) {
            normalizedCandidates.push(parsed.data);
            validForSource++;
          }
        } catch { /* Malformed entries do not count as deliveries. */ }
      }
    }
    if (validForSource > 0) successFeedCount++;
    sourceHealth[result.source.id] = {
      sourceId: result.source.id, name: result.source.name, url: result.source.url,
      fetchSuccess: validForSource > 0, itemCount: validForSource,
      checkedAt: result.fetchedAt,
      lastSuccessAt: validForSource ? result.fetchedAt : previous[result.source.id]?.lastSuccessAt,
      lastError: validForSource ? undefined : result.error || 'Keine validen Einträge nach Normalisierung',
      durationMs: result.durationMs
    };
  }
  return { normalizedCandidates, sourceHealth, totalRawEntries, successFeedCount };
}
