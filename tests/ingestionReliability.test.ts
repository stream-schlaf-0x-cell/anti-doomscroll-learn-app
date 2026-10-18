import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { SourceRepository } from '../src/core/data/sourceRepository';
import { AtemStorage, MemoryStorageDriver, appStorage } from '../src/core/data/storage';
import { SnapshotLoader } from '../src/core/feed/SnapshotLoader';
import { ContinuousLiveNewsService } from '../src/core/data/continuousLiveNewsService';
import { FeedItemSchema } from '../src/core/domain/types';
import { REAL_KNOWLEDGE_VAULT } from '../src/core/data/realKnowledgeVault';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const createRepository = () => new SourceRepository(new AtemStorage(new MemoryStorageDriver()));
const sampleItem = () => FeedItemSchema.parse({
  ...REAL_KNOWLEDGE_VAULT[0], id: 'controlled-snapshot-item',
  publishedAt: '2024-01-02T08:00:00.000Z'
});

describe('Ingestion reliability regressions (no network)', () => {
  it('keeps unmeasured catalog feeds unknown instead of inventing a successful fetch', async () => {
    const repo = createRepository();
    const sources = await repo.getAllSources();
    const unknownFeed = sources.find(source => source.id === 'fc-snopes')!;
    assert.equal(unknownFeed.fetchSuccess, undefined);
    assert.equal(unknownFeed.isDelivering, false);
    assert.equal(unknownFeed.itemCount, 0);
    assert.equal(unknownFeed.lastSuccessAt, undefined);
    const overview = repo.getHealthOverview();
    assert.ok(overview.deliveringCount < overview.totalSources);
    assert.ok(overview.unknownCount > 0);
  });

  it('keeps an untested custom feed unknown until measured', async () => {
    const repo = createRepository();
    const added = await repo.addCustomSource({ name: 'Untested feed', url: 'https://example.org/untested.xml' });
    assert.equal(added.fetchSuccess, undefined);
    assert.equal((await repo.getActiveDeliveringSources()).some(source => source.id === added.id), false);
  });

  it('labels research landing pages as references and excludes them from RSS delivery claims', async () => {
    const source = (await createRepository().getAllSources()).find(source => source.id === 'fc-dpa-faktencheck')!;
    assert.equal(source.sourceKind, 'reference');
    assert.equal(source.healthStatus, 'reference');
    assert.equal(source.isDelivering, false);
  });

  it('propagates validated snapshot telemetry and derives actual delivering count', async () => {
    const repo = createRepository();
    globalThis.fetch = async () => new Response(JSON.stringify({
      generatedAt: '2024-01-03T06:00:00.000Z', items: [sampleItem(), { id: 'bad' }],
      activeDeliveringSources: 999,
      sourceHealth: {
        'tagesschau-wissen': { sourceId: 'tagesschau-wissen', name: 'Tagesschau Wissen', url: 'https://www.tagesschau.de/wissen/index~rss2.xml', fetchSuccess: false, itemCount: 0, lastError: 'No valid entries' },
        'fc-snopes': { sourceId: 'fc-snopes', name: 'Snopes', url: 'https://www.snopes.com/feed/', fetchSuccess: true, itemCount: 2, lastSuccessAt: '2024-01-03T06:00:00.000Z' },
        malformed: { fetchSuccess: true, itemCount: 'invented' }
      }
    }), { headers: { 'Content-Type': 'application/json' } });
    const result = await new SnapshotLoader(repo).loadSnapshot('https://example.org/feed-snapshot.json');
    assert.equal(result.success, true);
    assert.equal(result.items.length, 1);
    assert.equal(result.generatedAt, '2024-01-03T06:00:00.000Z');
    assert.equal(result.activeDeliveringSources, 1);
    assert.equal(result.sourceHealth?.malformed, undefined);
    const source = (await repo.getAllSources()).find(source => source.id === 'tagesschau-wissen')!;
    assert.equal(source.fetchSuccess, false);
    assert.equal(source.itemCount, 0);
    assert.equal(source.lastError, 'No valid entries');
    assert.equal(repo.getHealthOverview().deliveringCount, (await repo.getAllSources()).filter(source => source.isDelivering).length);
  });

  it('does not invent a generation date for legacy array snapshots', async () => {
    globalThis.fetch = async () => new Response(JSON.stringify([sampleItem()]));
    const result = await new SnapshotLoader(createRepository()).loadSnapshot('https://example.org/legacy.json');
    assert.equal(result.success, true);
    assert.equal(result.snapshotDate, undefined);
    assert.equal(result.items[0].publishedAt, '2024-01-02T08:00:00.000Z');
  });

  it('validates offline fallback, preserves old publication dates and labels it offline', async () => {
    await appStorage.removeItem('@atem:public_feed_snapshot:v1');
    globalThis.fetch = async () => { throw new TypeError('Controlled offline'); };
    const items = await ContinuousLiveNewsService.refreshLiveFeeds(true);
    assert.ok(items.length > 0);
    for (const item of items) {
      const result = FeedItemSchema.safeParse(item);
      assert.equal(result.success, true, `${item.id}: ${result.error?.message}`);
      assert.ok(item.space, `Offline item ${item.id} needs its reader space`);
    }
    assert.equal(ContinuousLiveNewsService.getSnapshotStatus(), 'offline_fallback');
    assert.match(ContinuousLiveNewsService.getLastUpdatedTime(), /Offline/i);
  });

  it('ignores a malformed cached snapshot rather than emitting invalid feed cards', async () => {
    globalThis.fetch = async () => { throw new TypeError('Controlled offline'); };
    await appStorage.setItem('@atem:public_feed_snapshot:v1', JSON.stringify({ generatedAt: '2024-01-03T06:00:00.000Z', items: [{ id: 'invalid' }] }));
    const items = await ContinuousLiveNewsService.loadPublicFeedSnapshot();
    assert.ok(items.length > 0);
    assert.ok(items.every(item => FeedItemSchema.safeParse(item).success));
    assert.equal(ContinuousLiveNewsService.getSnapshotStatus(), 'offline_fallback');
    await appStorage.removeItem('@atem:public_feed_snapshot:v1');
  });
});

describe('Bounded snapshot delivery', () => {
  it('limits startup cards while retaining publisher diversity and complete reader bodies', async () => {
    const items = Array.from({ length: 230 }, (_, index) => ({
      ...sampleItem(), id: `snapshot-${index}`, canonicalUrl: `https://publisher-${index % 115}.example/article-${index}`,
      sourceDomain: `publisher-${index % 115}.example`, articleBody: `Complete body ${index}: ${'A source paragraph. '.repeat(30)}`,
      sourceReferences: [{ ...sampleItem().sourceReferences[0], publisher: `Publisher ${index % 115}` }]
    }));
    globalThis.fetch = async () => new Response(JSON.stringify({ generatedAt: '2024-01-03T06:00:00.000Z', items }));
    const result = await new SnapshotLoader(createRepository()).loadSnapshot('https://example.org/large.json');
    assert.equal(result.items.length, 200);
    assert.equal(new Set(result.items.map(item => item.sourceDomain)).size, 115);
    for (const item of result.items) assert.equal(item.articleBody, items.find(candidate => candidate.id === item.id)?.articleBody);
  });
});

describe('Snapshot provenance and payload budget', () => {
  it('keeps cached snapshot timestamps during an entirely offline refresh', async () => {
    globalThis.fetch = async () => { throw new TypeError('Controlled offline'); };
    await appStorage.setItem('@atem:public_feed_snapshot:v1', JSON.stringify({ generatedAt: '2024-01-03T06:00:00.000Z', items: [sampleItem()] }));
    const items = await ContinuousLiveNewsService.refreshLiveFeeds(true);
    assert.equal(ContinuousLiveNewsService.getSnapshotStatus(), 'cached_snapshot');
    assert.match(ContinuousLiveNewsService.getLastUpdatedTime(), /2024/);
    assert.match(ContinuousLiveNewsService.getLastUpdatedTime(), /Offline/);
    assert.equal(items.find(item => item.id === 'controlled-snapshot-item')?.publishedAt, '2024-01-02T08:00:00.000Z');
    await appStorage.removeItem('@atem:public_feed_snapshot:v1');
  });

  it('bounds Unicode payload bytes without truncating the delivered reader text', async () => {
    const items = Array.from({ length: 10 }, (_, index) => ({
      ...sampleItem(), id: `large-${index}`, canonicalUrl: `https://example.org/large-${index}`,
      articleBody: '🌍'.repeat(100_000)
    }));
    globalThis.fetch = async () => new Response(JSON.stringify({ generatedAt: '2024-01-03T06:00:00.000Z', items }));
    const result = await new SnapshotLoader(createRepository()).loadSnapshot('https://example.org/huge.json');
    assert.ok(result.items.length > 0);
    assert.ok(Buffer.byteLength(JSON.stringify(result.items), 'utf8') < 1_500_000);
    assert.ok(result.items.length < 10);
    for (const item of result.items) assert.equal(item.articleBody, '🌍'.repeat(100_000));
  });
});
