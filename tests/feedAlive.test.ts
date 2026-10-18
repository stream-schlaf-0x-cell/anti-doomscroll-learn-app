import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ContinuousLiveNewsService } from '../src/core/data/continuousLiveNewsService';
import { LocalFeedRepository } from '../src/core/data/feedRepository';
import { DEFAULT_USER_PROFILE } from '../src/core/data/fixtures';
import { FeedItem } from '../src/core/domain/types';
import { allocateDailyEditions, rankEditionFeed } from '../src/core/domain/ranking';

describe('Make The Feed Alive — Verifications', () => {
  describe('1. Live News Hub & Chronological Ordering', () => {
    it('returns news items strictly ordered newest first in chronological mode', async () => {
      const stream = await ContinuousLiveNewsService.getLiveStream({
        windowMode: 'chronological',
        limit: 30
      });

      assert.ok(stream.length > 0, 'Stream must not be empty');

      // Verify strict descending publication timestamps
      for (let i = 0; i < stream.length - 1; i++) {
        const timeA = new Date(stream[i].publishedAt || 0).getTime();
        const timeB = new Date(stream[i + 1].publishedAt || 0).getTime();
        assert.ok(
          timeA >= timeB,
          `Item at ${i} (${stream[i].title}: ${stream[i].publishedAt}) must be newer or equal to ${i + 1} (${stream[i + 1].title}: ${stream[i + 1].publishedAt})`
        );
      }
    });

    it('does not contaminate live news stream with ancient REAL_KNOWLEDGE_VAULT essays', async () => {
      const stream = await ContinuousLiveNewsService.getLiveStream({
        category: 'all',
        windowMode: 'chronological',
        limit: 40
      });

      for (const item of stream) {
        // Vault items have ids starting with 'kv_' or 'vault_'
        assert.ok(!item.id.startsWith('kv_'), `Live news must not contain vault item: ${item.id}`);
        assert.ok(!item.id.startsWith('vault_'), `Live news must not contain vault item: ${item.id}`);
        // Nor should it contain pure art showcases in live news
        assert.notStrictEqual(item.format, 'art_showcase', 'Live news should not contain art showcase cards');
      }
    });

    it('provides transparent status info (Live / Cached / Offline with timestamp)', () => {
      const statusInfo = ContinuousLiveNewsService.getNewsStatusInfo();
      assert.ok(
        ['live', 'cached', 'offline'].includes(statusInfo.fetchStatus),
        `fetchStatus must be live, cached, or offline: got ${statusInfo.fetchStatus}`
      );
      assert.ok(statusInfo.lastFetchTimeFormatted.length > 0, 'Must have formatted last fetch time');
      assert.ok(typeof statusInfo.totalItems === 'number', 'totalItems must be number');
    });
  });

  describe('2. Neuer Mix — Distinct Candidate Rotation & Diversity', () => {
    it('produces completely fresh candidate sets across consecutive mixes without repeating recently shown items', async () => {
      const repo = new LocalFeedRepository();

      // Mix 0: Initial fetch
      const mix0 = await repo.getEditionFeed('morning', DEFAULT_USER_PROFILE, {}, '2026-10-19', 0);
      assert.strictEqual(mix0.length, 8, 'Edition must return 8 cards');
      const mix0Ids = new Set(mix0.map(i => i.id));

      // Mix 1: User clicks "Neuer Mix" -> offset 1, passing mix0Ids as previouslyShownIds
      const mix1 = await repo.getEditionFeed('morning', DEFAULT_USER_PROFILE, {}, '2026-10-19', 1, mix0Ids);
      assert.strictEqual(mix1.length, 8, 'Rotated edition must return 8 cards');
      const mix1Ids = new Set(mix1.map(i => i.id));

      // Assert ZERO overlap between Mix 0 and Mix 1
      const overlap01 = mix0.filter(item => mix1Ids.has(item.id));
      assert.strictEqual(
        overlap01.length,
        0,
        `Expected 0 overlapping items between mix 0 and mix 1, but found: ${overlap01.map(i => i.title).join(', ')}`
      );

      // Mix 2: User clicks "Neuer Mix" again -> offset 2, passing both mix0Ids and mix1Ids
      const combinedSeen = new Set([...mix0Ids, ...mix1Ids]);
      const mix2 = await repo.getEditionFeed('morning', DEFAULT_USER_PROFILE, {}, '2026-10-19', 2, combinedSeen);
      assert.strictEqual(mix2.length, 8, 'Second rotated edition must return 8 cards');

      // Assert ZERO overlap between Mix 2 and previous mixes
      const overlap02 = mix2.filter(item => combinedSeen.has(item.id));
      assert.strictEqual(
        overlap02.length,
        0,
        `Expected 0 overlapping items between mix 2 and previous mixes, but found: ${overlap02.map(i => i.title).join(', ')}`
      );
    });

    it('rotates discovery pool items cleanly when previously shown IDs are provided', async () => {
      const repo = new LocalFeedRepository();

      const disc0 = await repo.getDiscoveryItems(DEFAULT_USER_PROFILE, {}, undefined, 0);
      assert.ok(disc0.length > 0, 'Discovery pool 0 must have items');
      const disc0Top16 = disc0.slice(0, 16);
      const disc0Ids = new Set(disc0Top16.map(i => i.id));

      const disc1 = await repo.getDiscoveryItems(DEFAULT_USER_PROFILE, {}, undefined, 1, disc0Ids);
      assert.ok(disc1.length > 0, 'Discovery pool 1 must have items');
      const disc1Top16 = disc1.slice(0, 16);

      const overlap = disc1Top16.filter(item => disc0Ids.has(item.id));
      assert.strictEqual(
        overlap.length,
        0,
        `Discovery pool rotation must have 0 overlap with previous pool, got: ${overlap.map(i => i.title).join(', ')}`
      );
    });

    it('guarantees rich publisher and topic diversity in the candidate selection', async () => {
      const repo = new LocalFeedRepository();
      const edition = await repo.getEditionFeed('morning', DEFAULT_USER_PROFILE, {}, '2026-10-19', 0);
      const discovery = await repo.getDiscoveryItems(DEFAULT_USER_PROFILE, {}, undefined, 0);
      const full24 = [...edition, ...discovery.slice(0, 16)];

      assert.strictEqual(full24.length, 24, 'Full discovery edition should contain 24 items');

      const publishers = new Set(full24.map(i => i.sourceReferences[0]?.publisher || i.sourceBroadcasterName || 'Unbekannt'));
      const topics = new Set(full24.map(i => i.primaryTopic));

      // Requirements from Section 6 of prompt: >=8 distinct publishers, >=4 distinct topics
      assert.ok(
        publishers.size >= 8,
        `Expected at least 8 publishers in 24 items, got ${publishers.size}: ${[...publishers].join(', ')}`
      );
      assert.ok(
        topics.size >= 4,
        `Expected at least 4 topic domains in 24 items, got ${topics.size}: ${[...topics].join(', ')}`
      );

      // No 3-in-a-row format monoculture check
      for (let i = 0; i < full24.length - 2; i++) {
        const fmtA = full24[i].format;
        const fmtB = full24[i + 1].format;
        const fmtC = full24[i + 2].format;
        const allSame = fmtA === fmtB && fmtB === fmtC;
        // Allowed if diverse, but flag if 3 consecutive identical niche formats occur
        if (allSame && fmtA === 'art_showcase') {
          assert.fail(`Format monoculture: 3 consecutive art showcases at indices ${i}, ${i + 1}, ${i + 2}`);
        }
      }
    });
  });
});
