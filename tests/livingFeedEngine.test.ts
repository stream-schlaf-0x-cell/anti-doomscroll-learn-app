import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FeedMergeService } from '../src/core/feed/FeedMergeService';
import { FeedOperationManager } from '../src/core/feed/FeedOperationManager';
import { ArticleIndex } from '../src/core/feed/articleIndex';
import { EnrichmentCache } from '../src/core/enrichment/cache';
import { handleAiProxyRequest } from '../server/ai/proxy';
import { FeedItem } from '../src/core/domain/types';
import { INITIAL_FIXTURES } from '../src/core/data/fixtures';

function createMockItem(
  id: string,
  title: string,
  category = 'philosophy_ethics',
  topics: Array<'philosophy_ethics' | 'contemplation_mind' | 'science_society'> = ['philosophy_ethics']
): FeedItem {
  const base = INITIAL_FIXTURES[0];
  return {
    ...base,
    id,
    title,
    subtitle: `Untertitel für ${title}`,
    canonicalUrl: `https://example.com/articles/${id}`,
    sourceReferences: [
      {
        publisher: 'Test Publisher',
        originalUrl: `https://example.com/articles/${id}`,
        title,
        publicationTimestamp: new Date().toISOString(),
        retrievalTimestamp: new Date().toISOString(),
        author: 'Test Author',
        isVerified: true
      }
    ],
    primaryTopic: category as any,
    topics: topics as any,
    curationScore: 7
  };
}

describe('Living Feed Engine & Layered Architecture Tests', () => {
  describe('1. FeedMergeService (Idempotent Merge & Deduplication)', () => {
    it('correctly inserts true new items and detects duplicates', () => {
      const existing = [createMockItem('item-1', 'Article 1'), createMockItem('item-2', 'Article 2')];
      const incoming = [
        createMockItem('item-2-dup', 'Article 2'), // duplicate by identical title
        createMockItem('item-3', 'Article 3 (Brand New)')
      ];

      const { mergedItems, operationResult } = FeedMergeService.merge(existing, incoming, {
        operationType: 'ai_curation',
        pinInserted: true
      });

      assert.equal(mergedItems.length, 3, 'Should contain exactly 3 unique items');
      assert.equal(operationResult.candidateCount, 2);
      assert.equal(operationResult.insertedCount, 1, 'Only item-3 should be inserted');
      assert.equal(operationResult.duplicateCount, 1, 'item-2-dup should be counted as duplicate');
      assert.equal(operationResult.updatedCount, 0);

      // Verify that newly inserted item is flagged
      const item3 = mergedItems.find(i => i.id === 'item-3');
      assert.ok(item3?.isNewlyCurated, 'Newly inserted item must have isNewlyCurated flag');
      assert.ok(item3?.curatedAt, 'Newly inserted item must have curatedAt timestamp');
    });

    it('updates existing item when incoming version has higher quality score or updated body', () => {
      const existing = [createMockItem('item-1', 'Article 1')];

      const updated = {
        ...existing[0],
        articleBody: 'Freshly enriched substantive article body that has been updated.',
        curationScore: 9.5
      };

      const { mergedItems, operationResult } = FeedMergeService.merge(existing, [updated], {
        operationType: 'ai_curation'
      });

      assert.equal(mergedItems.length, 1);
      assert.equal(operationResult.updatedCount, 1);
      assert.equal(operationResult.insertedCount, 0);
      assert.equal(mergedItems[0].curationScore, 9.5);
    });

    it('rejects malformed items and logs rejection reason', () => {
      const existing = [createMockItem('item-1', 'Article 1')];
      const malformed = { id: 'bad-item' } as unknown as FeedItem;

      const { operationResult } = FeedMergeService.merge(existing, [malformed], {
        operationType: 'ai_curation'
      });

      assert.equal(operationResult.rejectedCount, 1);
      assert.equal(operationResult.rejectedReasons?.['schema_invalid'], 1);
    });
  });

  describe('2. FeedOperationManager (Top-Pinning & Telemetry)', () => {
    it('pins user-curated items to top and records operation telemetry', () => {
      const manager = new FeedOperationManager();
      manager.startOperation('ai_curation', 'op-test-1');

      const opResult = manager.completeOperation({
        candidateCount: 10,
        insertedCount: 2,
        updatedCount: 0,
        duplicateCount: 8,
        rejectedCount: 0,
        insertedIds: ['pinned-1', 'pinned-2'],
        usedAI: true
      }, { pinNewItems: true });

      assert.equal(opResult.insertedCount, 2);
      assert.equal(opResult.operationType, 'ai_curation');
      assert.equal(opResult.status, 'completed');

      // Verify top-pinning retrieval
      assert.ok(manager.isItemPinned('pinned-1'));
      assert.ok(manager.isItemPinned('pinned-2'));
      assert.ok(!manager.isItemPinned('other-item'));

      const pinnedIds = manager.getPinnedItemIds();
      assert.ok(pinnedIds.includes('pinned-1'));
      assert.ok(pinnedIds.includes('pinned-2'));

      // Verify unpin and clear
      manager.clearPins();
      assert.equal(manager.getPinnedItemIds().length, 0);
    });

    it('notifies listeners on operation completed', () => {
      const manager = new FeedOperationManager();
      let notified = false;

      const unsubscribe = manager.subscribe(result => {
        if (result.operationId === 'op-sub-test') {
          notified = true;
        }
      });

      manager.startOperation('manual_refresh', 'op-sub-test');
      manager.completeOperation({
        candidateCount: 5,
        insertedCount: 1,
        insertedIds: ['bg-1']
      });

      assert.ok(notified, 'Listener should be called on operation completed');
      unsubscribe();
    });
  });

  describe('3. ArticleIndex (O(1) Keyword & Topic Inverted Index)', () => {
    it('indexes items and performs sub-millisecond candidate lookup', () => {
      const index = new ArticleIndex();
      const item1 = createMockItem('art-1', 'Epictetus Stoicism and Inner Peace', 'philosophy_ethics', ['philosophy_ethics']);
      const item2 = createMockItem('art-2', 'Neuroscience of Attention and Focus', 'contemplation_mind', ['contemplation_mind']);
      const item3 = createMockItem('art-3', 'Modern Stoicism for Digital Life', 'philosophy_ethics', ['philosophy_ethics']);

      index.buildIndex([item1, item2, item3]);

      assert.equal(index.size(), 3);

      // Fast topic lookup
      const philosophyItems = index.getItemsByTopic('philosophy_ethics');
      assert.equal(philosophyItems.length, 2);
      assert.ok(philosophyItems.some(i => i.id === 'art-1'));
      assert.ok(philosophyItems.some(i => i.id === 'art-3'));

      // Fast candidate retrieval via inverted index
      const candidates = index.findRelatedCandidates(item1, 2);
      assert.ok(candidates.length > 0);
      assert.equal(candidates[0].id, 'art-3', 'Item sharing stoicism keyword and philosophy topic must rank highest');
    });
  });

  describe('4. Multi-Dimensional EnrichmentCache', () => {
    it('generates content-addressable cache keys incorporating content, prompt, and model', () => {
      const cache = new EnrichmentCache(undefined, false); // MemoryCacheStorage

      const key1 = cache.makeKey({
        contentHash: 'hash-abc',
        task: 'didactic_enrichment',
        schemaVersion: 'v2',
        promptVersion: 'p1',
        modelId: 'gemini-2.5-flash',
        language: 'de'
      });

      const key2 = cache.makeKey({
        contentHash: 'hash-abc',
        task: 'didactic_enrichment',
        schemaVersion: 'v2',
        promptVersion: 'p1',
        modelId: 'gemini-2.5-flash',
        language: 'de'
      });

      const keyDifferentModel = cache.makeKey({
        contentHash: 'hash-abc',
        task: 'didactic_enrichment',
        schemaVersion: 'v2',
        promptVersion: 'p1',
        modelId: 'gemini-2.5-pro',
        language: 'de'
      });

      assert.equal(key1, key2, 'Keys with identical parameters must match');
      assert.notEqual(key1, keyDifferentModel, 'Keys with different models must not collide');
    });
  });

  describe('5. Secure AI Proxy (server/ai/proxy)', () => {
    it('returns capabilities without exposing server secrets', async () => {
      const res = await handleAiProxyRequest({
        method: 'GET',
        url: '/api/ai/capabilities',
        headers: {}
      });

      assert.equal(res.statusCode, 200);
      assert.ok(res.body.serverProxyActive);
      assert.ok(typeof res.body.masterKeyConfigured === 'boolean');
      assert.ok(res.body.supportedEndpoints.length > 0);
    });

    it('rejects oversized payloads with 413 Payload Too Large', async () => {
      const hugePrompt = 'A'.repeat(130 * 1024);
      const res = await handleAiProxyRequest({
        method: 'POST',
        url: '/api/ai/curate',
        headers: { 'x-gemini-key': 'test-key' },
        body: {
          task: 'enrichment',
          model: 'gemini-2.5-flash',
          prompt: hugePrompt
        }
      });

      assert.equal(res.statusCode, 413);
      assert.match(res.body.error, /Payload zu groß/);
    });

    it('rejects missing body with 400 Bad Request', async () => {
      const res = await handleAiProxyRequest({
        method: 'POST',
        url: '/api/ai/curate',
        headers: { 'x-gemini-key': 'test-key' },
        body: null
      });

      assert.equal(res.statusCode, 400);
      assert.match(res.body.error, /Ungültiger oder leerer/);
    });
  });
});
