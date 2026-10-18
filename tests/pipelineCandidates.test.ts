import { it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePipelineResults } from '../src/core/ingestion/pipelineCandidates';
import { FeedFetchResult, fetchSingleFeed } from '../src/core/ingestion/feedFetcher';

it('counts delivering sources only after entries pass normalization and schema validation', () => {
  const results: FeedFetchResult[] = ['valid', 'invalid'].map(id => ({
    source: { id, name: id, url: `https://example.org/${id}.xml`, primaryTopic: 'science_society', topics: ['science_society'], defaultEvidenceTier: 'publisher_excerpt', language: 'de' },
    entries: [{ id, sourceId: id, title: 'A controlled source report', summary: 'A complete publisher excerpt about research and science.', publishedAt: '2024-01-01T12:00:00.000Z', link: id === 'valid' ? 'https://example.org/article' : 'not a valid URL' }],
    success: true, durationMs: 10, fetchedAt: '2024-01-02T12:00:00.000Z'
  }));
  const result = normalizePipelineResults(results, {}, '2024-01-02');
  assert.equal(result.totalRawEntries, 2);
  assert.equal(result.normalizedCandidates.length, 1);
  assert.equal(result.sourceHealth.invalid.fetchSuccess, false);
  assert.equal(result.sourceHealth.invalid.itemCount, 0);
  assert.equal(result.successFeedCount, 1);
});

it('keeps a reference page in the catalog without attempting to fetch it as RSS', async t => {
  let networkCalls = 0;
  t.mock.method(globalThis, 'fetch', async () => { networkCalls++; throw new Error('No network in test'); });
  const result = await fetchSingleFeed({ id: 'reference', name: 'Reference', url: 'https://example.org/research', sourceKind: 'reference', primaryTopic: 'science_society', topics: ['science_society'], defaultEvidenceTier: 'publisher_excerpt', language: 'de' });
  assert.equal(result.success, false);
  assert.equal(networkCalls, 0);
  assert.match(result.error || '', /Referenz/i);
});
