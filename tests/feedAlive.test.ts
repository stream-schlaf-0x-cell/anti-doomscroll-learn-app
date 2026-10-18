import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ContinuousLiveNewsService, NewsStatusInfo } from '../src/core/data/continuousLiveNewsService';
import { LocalFeedRepository } from '../src/core/data/feedRepository';
import { DEFAULT_USER_PROFILE } from '../src/core/data/fixtures';
import { FeedItem } from '../src/core/domain/types';
import { allocateDailyEditions, rankEditionFeed } from '../src/core/domain/ranking';
import { BoundedIdSet } from '../src/core/feed/boundedIdSet';
import { NewsEvolutionService } from '../src/core/news/newsEvolutionService';

function createMockFeedItem(id: string, publishedAtIso: string, publisher = 'Mock Publisher', title = `Mock Article ${id}`): FeedItem {
  return {
    id,
    type: 'briefing',
    format: 'sourced_update',
    title,
    subtitle: `Subtitle for ${id}`,
    feedText: `Feed text content for ${id}. This is a verified test item.`,
    body: `Body content for ${id}.`,
    topics: ['science_society', 'philosophy_ethics'],
    primaryTopic: 'science_society',
    sourceReferences: [
      {
        title,
        publisher,
        originalUrl: `https://example.com/${id}`,
        publicationTimestamp: publishedAtIso,
        retrievalTimestamp: new Date().toISOString(),
        isVerified: true
      }
    ],
    publishedAt: publishedAtIso,
    generatedAt: new Date().toISOString(),
    estimatedReadingMinutes: 2,
    relevanceExplanation: 'Test relevance',
    contentStatus: 'verified_fact',
    isDailyEdition: true,
    editionDate: publishedAtIso.slice(0, 10),
    isTeachingRelated: false,
    isChallengingPerspective: false,
    isDemonstration: false,
    aiAssisted: false,
    factReviewStatus: 'public_news',
    provenanceSummary: 'Test provenance',
    wordCount: 120,
    evidenceTier: 'publisher_excerpt',
    contentOrigin: 'live_ingested',
    contentHash: `hash-${id}`,
    canonicalUrl: `https://example.com/${id}`,
    hasAuthenticImage: false,
    space: 'c/serendipity',
    flair: '◈ Test',
    keyInsight: `Key insight for ${id}`,
    upvotesCount: 0,
    awardsCount: { gold: 0, brain: 0, spark: 0 },
    sourceTrustLevel: 'public_broadcaster',
    sourceDomain: 'example.com',
    sourceBroadcasterName: publisher,
    comments: []
  };
}

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
        assert.ok(!item.id.startsWith('kv_'), `Live news must not contain vault item: ${item.id}`);
        assert.ok(!item.id.startsWith('vault_'), `Live news must not contain vault item: ${item.id}`);
        assert.notStrictEqual(item.format, 'art_showcase', 'Live news should not contain art showcase cards');
      }
    });

    it('provides honest status info distinguishing live, snapshot, cached, and offline', () => {
      // 1. Direct live fetch state
      ContinuousLiveNewsService.resetStateForTesting({
        items: [createMockFeedItem('item-1', new Date().toISOString())],
        lastFetchTimestamp: Date.now(),
        lastDirectFetchTimestamp: Date.now(),
        reachableLiveSources: ['tagesschau', 'hackernews']
      });

      const liveStatus = ContinuousLiveNewsService.getNewsStatusInfo();
      assert.strictEqual(liveStatus.fetchStatus, 'live', 'Direct fetch within TTL must report live');
      assert.strictEqual(liveStatus.reachableSourcesCount, 2, 'Must report 2 reachable direct sources');
      assert.ok(liveStatus.statusLabel.includes('Direktquellen'), 'Status label must mention direct sources');

      // 2. Snapshot-only state (honest provenance: snapshot is NOT live)
      ContinuousLiveNewsService.resetStateForTesting({
        items: [createMockFeedItem('item-2', new Date().toISOString())],
        snapshotStatus: 'live_snapshot',
        lastFetchTimestamp: Date.now(),
        lastDirectFetchTimestamp: 0,
        reachableLiveSources: []
      });

      const snapshotStatus = ContinuousLiveNewsService.getNewsStatusInfo();
      assert.strictEqual(snapshotStatus.fetchStatus, 'snapshot', 'Snapshot state must honestly report snapshot, not live');
      assert.ok(snapshotStatus.statusLabel.includes('Snapshot'), 'Status label must mention Snapshot');

      // 3. Offline fallback state
      ContinuousLiveNewsService.resetStateForTesting({
        items: [],
        snapshotStatus: 'offline_fallback',
        lastFetchTimestamp: 0,
        lastDirectFetchTimestamp: 0,
        reachableLiveSources: []
      });

      const offlineStatus = ContinuousLiveNewsService.getNewsStatusInfo();
      assert.strictEqual(offlineStatus.fetchStatus, 'offline', 'Must report offline when fallback is active');
      assert.ok(offlineStatus.statusLabel.includes('Offline'), 'Label must mention Offline');
    });

    it('strictly adheres to the 24h window without secret expansion to all items', async () => {
      const now = Date.now();
      const twoHoursAgo = new Date(now - 2 * 3600 * 1000).toISOString();
      const fiveHoursAgo = new Date(now - 5 * 3600 * 1000).toISOString();
      const threeDaysAgo = new Date(now - 72 * 3600 * 1000).toISOString();
      const fiveDaysAgo = new Date(now - 120 * 3600 * 1000).toISOString();

      // Only 2 items in 24h window, 2 ancient items
      const mockItems: FeedItem[] = [
        createMockFeedItem('recent-1', twoHoursAgo, 'Tagesschau'),
        createMockFeedItem('recent-2', fiveHoursAgo, 'Hacker News'),
        createMockFeedItem('ancient-1', threeDaysAgo, 'Spiegel Archiv'),
        createMockFeedItem('ancient-2', fiveDaysAgo, 'Zeit Archiv')
      ];

      ContinuousLiveNewsService.resetStateForTesting({
        items: mockItems,
        lastFetchTimestamp: now,
        lastDirectFetchTimestamp: now,
        reachableLiveSources: ['tagesschau']
      });

      const stream24h = await ContinuousLiveNewsService.getLiveStream({
        windowMode: 'chronological',
        limit: 10
      });

      // Strict adherence: Must contain EXACTLY the 2 recent items, not 4!
      assert.strictEqual(stream24h.length, 2, '24h chronological mode must return exactly 2 items without secret expansion');
      assert.strictEqual(stream24h[0].id, 'recent-1');
      assert.strictEqual(stream24h[1].id, 'recent-2');

      // In 48h mode, still only 2 items because the ancient items are 72h+ old
      const stream48h = await ContinuousLiveNewsService.getLiveStream({
        windowMode: '48h_fresh',
        limit: 10
      });
      assert.strictEqual(stream48h.length, 2, '48h fresh mode must also exclude 72h+ items');
    });

    it('does not penalize news_hub_heise_1 with artificial hardcoded score reductions', () => {
      const now = Date.now();
      const oneHourAgo = new Date(now - 3600 * 1000).toISOString();
      const heiseItem = createMockFeedItem('news_hub_heise_1', oneHourAgo, 'Heise Online', 'Wichtiger Tech-Durchbruch');
      const standardItem = createMockFeedItem('standard_tech_1', oneHourAgo, 'Tech Blog', 'Standardmeldung');

      const heiseScore = ContinuousLiveNewsService.computeRollingWindowQualityScore(heiseItem, '7d_quality', now);
      const standardScore = ContinuousLiveNewsService.computeRollingWindowQualityScore(standardItem, '7d_quality', now);

      assert.ok(heiseScore > 0, `Heise score must be positive, got ${heiseScore}`);
      assert.ok(Math.abs(heiseScore - standardScore) < 25, 'Heise item must be evaluated fairly without -1000 bias');
    });

    it('deduplicates in-flight calls and supports progressive provider update notifications', async () => {
      let receivedEvents = 0;
      const unsubscribe = ContinuousLiveNewsService.subscribe(event => {
        receivedEvents++;
        assert.ok(Array.isArray(event.items), 'Event must include items array');
        assert.ok(typeof event.newItemsCount === 'number', 'Event must include newItemsCount');
        assert.ok(event.statusInfo, 'Event must include statusInfo');
      });

      // Concurrent fetch calls return the identical in-flight promise
      const p1 = ContinuousLiveNewsService.refreshLiveFeeds(true);
      const p2 = ContinuousLiveNewsService.refreshLiveFeeds(false);

      assert.strictEqual(p1, p2, 'Concurrent refreshLiveFeeds calls must share the identical in-flight promise');

      await Promise.all([p1, p2]);
      unsubscribe();
    });
  });

  describe('2. BoundedIdSet & Neuer Mix History Tracking', () => {
    it('evicts oldest IDs in FIFO order and never abruptly drops history to 0', () => {
      const bounded = new BoundedIdSet(5);

      // Add 5 items
      bounded.add('id-1');
      bounded.add('id-2');
      bounded.add('id-3');
      bounded.add('id-4');
      bounded.add('id-5');

      assert.strictEqual(bounded.size, 5);
      assert.ok(bounded.has('id-1'));
      assert.ok(bounded.has('id-5'));

      // Add 6th item -> id-1 should be evicted in FIFO order
      bounded.add('id-6');
      assert.strictEqual(bounded.size, 5, 'Size must not exceed capacity of 5');
      assert.strictEqual(bounded.has('id-1'), false, 'Oldest item id-1 must be evicted');
      assert.strictEqual(bounded.has('id-2'), true, 'id-2 must still be retained');
      assert.strictEqual(bounded.has('id-6'), true, 'Newly added id-6 must be present');

      // Add 7th and 8th items
      bounded.add('id-7');
      bounded.add('id-8');
      assert.strictEqual(bounded.size, 5, 'Size remains strictly bounded at 5 (never drops to 0)');
      assert.deepStrictEqual(bounded.toArray(), ['id-4', 'id-5', 'id-6', 'id-7', 'id-8']);
    });

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

      assert.ok(
        publishers.size >= 8,
        `Expected at least 8 publishers in 24 items, got ${publishers.size}: ${[...publishers].join(', ')}`
      );
      assert.ok(
        topics.size >= 4,
        `Expected at least 4 topic domains in 24 items, got ${topics.size}: ${[...topics].join(', ')}`
      );
    });
  });

  describe('3. P1: News Evolution Briefing ("Was hat sich verändert?")', () => {
    it('produces exactly 3 structured points with citations in deterministic local fallback', async () => {
      const now = Date.now();
      const items: FeedItem[] = [
        createMockFeedItem('ts-1', new Date(now - 30 * 60 * 1000).toISOString(), 'ARD Tagesschau', 'Forschungsteam entdeckt neue Methode zur CO2-Speicherung'),
        createMockFeedItem('hn-1', new Date(now - 60 * 60 * 1000).toISOString(), 'Hacker News', 'Show HN: Open Source VAD Engine mit 10ms Latenz'),
        createMockFeedItem('wiki-1', new Date(now - 120 * 60 * 1000).toISOString(), 'Wikipedia Aktuelles', 'Hintergrund: Globale Energiewende im Jahr 2026')
      ];

      const briefing = await NewsEvolutionService.generateEvolutionBriefing(items, {
        credentials: { provider: 'gemini', apiKey: '' },
        forceRefresh: true
      });

      assert.ok(briefing, 'Briefing must be returned');
      assert.strictEqual(briefing.points.length, 3, 'Must contain exactly 3 points');
      assert.strictEqual(briefing.isDeterministicFallback, true, 'Without API key, must run deterministic fallback');
      assert.strictEqual(briefing.isAiGenerated, false);

      // Verify Point 1: Neue Entwicklung
      assert.strictEqual(briefing.points[0].index, 1);
      assert.strictEqual(briefing.points[0].category, 'development');
      assert.ok(briefing.points[0].label.includes('Neue Entwicklung'));
      assert.ok(briefing.points[0].text.includes('CO2-Speicherung') || briefing.points[0].text.includes('ARD Tagesschau'));
      assert.ok(briefing.points[0].citations.length > 0, 'Point 1 must cite primary source');

      // Verify Point 2: Bedeutung & Relevanz
      assert.strictEqual(briefing.points[1].index, 2);
      assert.strictEqual(briefing.points[1].category, 'significance');
      assert.ok(briefing.points[1].label.includes('Bedeutung'));

      // Verify Point 3: Quellenbelege & Offene Fragen
      assert.strictEqual(briefing.points[2].index, 3);
      assert.strictEqual(briefing.points[2].category, 'sources_and_questions');
      assert.ok(briefing.points[2].label.includes('Quellenbelege'));
      assert.ok(briefing.points[2].citations.length >= 2, 'Point 3 must list supporting citations');
      assert.ok(Array.isArray(briefing.points[2].openQuestions), 'Point 3 must formulate open questions');
    });

    it('caches identical runs so re-opening the briefing consumes 0 tokens and returns instantly', async () => {
      const now = Date.now();
      const items: FeedItem[] = [
        createMockFeedItem('ts-2', new Date(now - 45 * 60 * 1000).toISOString(), 'ARD Tagesschau', 'Klimaforschung meldet neue Ozean-Messwerte')
      ];

      const firstCall = await NewsEvolutionService.generateEvolutionBriefing(items, { forceRefresh: true });
      assert.strictEqual(firstCall.cached, false, 'First run is not cached');

      const secondCall = await NewsEvolutionService.generateEvolutionBriefing(items, { forceRefresh: false });
      assert.strictEqual(secondCall.cached, true, 'Second identical run must return cached: true without token consumption');
      assert.strictEqual(secondCall.id, firstCall.id);
      assert.strictEqual(secondCall.headline, firstCall.headline);
    });
  });
});
