import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_FIXTURES, DEFAULT_USER_PROFILE } from '../src/core/data/fixtures';
import { FeedItem } from '../src/core/domain/types';
import { scoreFeedItem, interleaveForAddictiveLearning, sortFeedForDisplay, FeedSortMode } from '../src/core/domain/ranking';
import { FeedMergeService } from '../src/core/feed/FeedMergeService';
import { defaultFeedOperationManager, FeedOperationManager } from '../src/core/feed/FeedOperationManager';
import { holdFeedPresentation, formatCurationLabel } from '../src/core/feed/feedPresentation';
import { LocalFeedRepository } from '../src/core/data/feedRepository';
import { AtemStorage, MemoryStorageDriver } from '../src/core/data/storage';

function item(id: string, overrides: Partial<FeedItem> = {}): FeedItem {
  return {
    ...INITIAL_FIXTURES[0],
    id,
    title: `Substanzieller Beitrag ${id}`,
    canonicalUrl: `https://example.org/${id}`,
    ...overrides
  };
}

afterEach(() => defaultFeedOperationManager.clearPins());

describe('Feed presentation and truthful operation telemetry', () => {
  it('keeps the manually pinned low-score result ahead of high-score items through endless interleaving', () => {
    const low = { ...scoreFeedItem(item('fresh'), DEFAULT_USER_PROFILE), score: 1 };
    const oldA = { ...scoreFeedItem(item('old-a'), DEFAULT_USER_PROFILE), score: 100 };
    const oldB = { ...scoreFeedItem(item('old-b'), DEFAULT_USER_PROFILE), score: 90 };
    const displayed = interleaveForAddictiveLearning([oldA, low, oldB], ['fresh']);
    assert.deepEqual(displayed.map(entry => entry.id), ['fresh', 'old-a', 'old-b']);
  });

  for (const mode of ['hot', 'new', 'top', 'gems'] as FeedSortMode[]) {
    it(`keeps explicit pin order through ${mode} sorting and deduplicates combined pools`, () => {
      const fresh = { ...scoreFeedItem(item('fresh', { publishedAt: '2020-01-01T00:00:00Z' }), DEFAULT_USER_PROFILE), score: 1 };
      const updated = { ...fresh, id: 'updated' };
      const old = { ...scoreFeedItem(item('old', { publishedAt: '2026-10-18T12:00:00Z', format: 'art_showcase' }), DEFAULT_USER_PROFILE), score: 100 };
      const displayed = sortFeedForDisplay([old, fresh, updated, fresh], mode, { pinnedIds: ['updated', 'fresh'] });
      assert.deepEqual(displayed.map(entry => entry.id), ['updated', 'fresh', 'old']);
    });
  }

  it('surfaces manually updated articles without claiming they were newly inserted', () => {
    const manager = new FeedOperationManager();
    manager.startOperation('ai_curation');
    const result = manager.completeOperation({ updatedCount: 1, updatedIds: ['recurated'] });
    assert.equal(result.insertedCount, 0);
    assert.deepEqual(manager.getPinnedItemIds(), ['recurated']);
  });

  it('does not pin background arrivals even when a caller leaves the pin option implicit', () => {
    const manager = new FeedOperationManager();
    manager.startOperation('background_sync');
    manager.completeOperation({ insertedCount: 1, insertedIds: ['background'] });
    assert.deepEqual(manager.getPinnedItemIds(), []);
  });

  it('never infers actual AI use from an AI-named operation', () => {
    const result = FeedMergeService.merge([], [item('keyless')], { operationType: 'ai_curation' }).operationResult;
    assert.equal(result.usedAI, false);
  });

  it('combines gatekeeper rejections and schema rejections and preserves actual cache/fallback usage', () => {
    const existing = item('existing');
    const malformed = { id: 'invalid' } as FeedItem;
    const result = FeedMergeService.merge([existing], [existing, item('insert'), malformed], {
      operationType: 'ai_curation',
      telemetry: {
        candidateCount: 7,
        approvedCount: 3,
        rejectedCount: 4,
        usedAI: false,
        usedFallback: true,
        cacheHits: 2
      }
    }).operationResult;
    assert.equal(result.candidateCount, 7);
    assert.equal(result.rejectedCount, 5);
    assert.equal(result.duplicateCount, 1);
    assert.equal(result.insertedCount, 1);
    assert.equal(result.usedAI, false);
    assert.equal(result.usedFallback, true);
    assert.equal(result.cacheHits, 2);
    assert.deepEqual(result.rejectedReasons, { gatekeeper: 4, schema_invalid: 1 });
    assert.equal(result.candidateCount, result.insertedCount + result.updatedCount + result.duplicateCount + result.rejectedCount);
  });

  it('records a changed teaser or topic as an update and refreshes its curation timestamp', () => {
    const existing = item('reclassified', { curatedAt: '2026-10-01T12:00:00Z' });
    const incoming = { ...existing, feedText: 'Neue präzise Einordnung der Forschung.', primaryTopic: 'science_society' as const };
    const { operationResult, mergedItems } = FeedMergeService.merge([existing], [incoming], { operationType: 'ai_curation' });
    assert.equal(operationResult.updatedCount, 1);
    assert.equal(operationResult.insertedCount, 0);
    assert.equal(mergedItems[0].primaryTopic, 'science_society');
    assert.notEqual(mergedItems[0].curatedAt, existing.curatedAt);
  });

  it('retains the visible order and article bodies while reading until the reader accepts updates', () => {
    const previous = { scope: 'infinite:all:hot', items: [item('reading'), item('next')] };
    const latest = { scope: 'infinite:all:hot', items: [item('arrival'), item('reading', { feedText: 'Ein neuer längerer Text.' })] };
    assert.equal(holdFeedPresentation(previous, latest, true), previous);
    assert.equal(holdFeedPresentation(previous, latest, false), latest);
    const filtered = { scope: 'infinite:science:hot', items: [item('science')] };
    assert.equal(holdFeedPresentation(previous, filtered, true), filtered);
  });

  it('preserves an updated established article across a subsequent snapshot replacement', async () => {
    const original = item('persistent');
    const repo = new LocalFeedRepository([original], new AtemStorage(new MemoryStorageDriver()));
    await repo.executeContentOperation('ai_curation', [{ ...original, keyInsight: 'Erste überarbeitete Einsicht.' }]);
    await repo.executeContentOperation('ai_curation', [{ ...original, keyInsight: 'Zweite überarbeitete Einsicht.' }]);
    repo.setItems([original]);
    assert.equal((await repo.getItemById('persistent'))?.keyInsight, 'Zweite überarbeitete Einsicht.');
  });

  it('does not resurrect a duplicate canonical URL under a second ID after snapshot replacement', async () => {
    const original = item('canonical');
    const repo = new LocalFeedRepository([original], new AtemStorage(new MemoryStorageDriver()));
    repo.addItems([{ ...original, id: 'alias' }]);
    repo.setItems([original]);
    assert.equal(await repo.getItemById('alias'), null);
    assert.equal(repo.getAllItems().filter(entry => entry.canonicalUrl === original.canonicalUrl).length, 1);
  });

  it('does not inject an excluded pin into the appended discovery list a second time', async () => {
    const repo = new LocalFeedRepository([], new AtemStorage(new MemoryStorageDriver()));
    await repo.executeContentOperation('manual_refresh', [item('new-pin')]);
    const discovery = await repo.getDiscoveryItems(DEFAULT_USER_PROFILE, {}, new Set(['new-pin']));
    assert.ok(!discovery.some(entry => entry.id === 'new-pin'));
  });

  it('dates an older curation instead of claiming it happened seconds ago', () => {
    assert.match(formatCurationLabel('2026-10-01T12:00:00Z'), /01\.10\./);
    assert.equal(formatCurationLabel('not-a-date'), 'Kuratiert');
    assert.equal(formatCurationLabel(), 'Kuratiert');
  });
});
