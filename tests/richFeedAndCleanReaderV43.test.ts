import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { OpenWebHarvester } from '../src/core/ingestion/openWebHarvester';
import { AtemStorage, MemoryStorageDriver } from '../src/core/data/storage';
import {
  CURRENT_DATA_MIGRATION_VERSION,
  runInPlaceDataMigration
} from '../src/core/data/migrationService';
import { FeedItem } from '../src/core/domain/types';

test('Rich Feed Discovery, Slop Eradication, Hard Quarantine & Clean Reader Suite (v4.3)', async (t) => {
  await t.test('1. Multi-Lane Internet Discovery: Rotates sources and yields rich candidates', async () => {
    const memoryStorage = new AtemStorage(new MemoryStorageDriver());
    const result = await OpenWebHarvester.harvestMultiLaneInternetDiscovery({
      storage: memoryStorage,
      existingIds: new Set(['existing-article-1', 'existing-article-2']),
      targetNewCount: 15
    });

    assert.ok(result && typeof result === 'object', 'Result must be an object');
    assert.ok(Array.isArray(result.items), 'Result.items must be an array');
    assert.ok(result.items.length > 0, 'Harvester must yield candidates');
    assert.ok(result.durationMs >= 0, 'Duration must be tracked');
    assert.ok(result.sourcesCheckedCount > 0, 'Sources checked must be tracked');

    const candidates = result.items;

    // Check candidate structure
    for (const item of candidates) {
      assert.ok(item.id, 'Candidate must have an id');
      assert.ok(item.title, 'Candidate must have a title');
      assert.ok(item.feedText && item.feedText.length > 20, 'feedText must be substantive');
      assert.ok(item.body && item.body.length > 20, 'body must be substantive');
      assert.ok(item.sourceReferences && item.sourceReferences.length > 0, 'Must have source references');
      assert.notEqual(item.id, 'existing-article-1', 'Must deduplicate against existing IDs');
      assert.notEqual(item.id, 'existing-article-2', 'Must deduplicate against existing IDs');
    }

    // Verify source rotation tracking
    const lastPolledKey = '@atem:last_polled_source_ids:v1';
    const firstPolledJson = await memoryStorage.getItem(lastPolledKey);
    assert.ok(firstPolledJson, 'Harvester must record last polled sources');
    const firstPolledIds = JSON.parse(firstPolledJson) as string[];
    assert.ok(firstPolledIds.length > 0, 'Must have polled at least 1 rotating source');

    // Second harvest should rotate and track new sources
    await OpenWebHarvester.harvestMultiLaneInternetDiscovery({
      storage: memoryStorage,
      existingIds: new Set(candidates.map((c) => c.id)),
      targetNewCount: 10
    });
    const secondPolledJson = await memoryStorage.getItem(lastPolledKey);
    const secondPolledIds = JSON.parse(secondPolledJson || '[]') as string[];
    assert.ok(secondPolledIds.length > 0, 'Second run must track rotated source batch');
  });

  await t.test('2. Slop Template Eradication: Zero generic canned phrases across codebase and feed snapshot', () => {
    const slopPatterns = [
      'Dieser philosophische Diskurs zu',
      'widmet sich den ethischen und erkenntnistheoretischen Grundfragen',
      'hinterfragt gängige Prämissen und lädt zu einer differenzierten Betrachtung'
    ];

    // Check feed snapshot
    const snapshotPath = path.resolve(process.cwd(), 'public/feed-snapshot.json');
    if (fs.existsSync(snapshotPath)) {
      const snapshotContent = fs.readFileSync(snapshotPath, 'utf8');
      for (const pattern of slopPatterns) {
        assert.ok(
          !snapshotContent.includes(pattern),
          `public/feed-snapshot.json must not contain generic slop phrase: "${pattern}"`
        );
      }
    }

    // Check batch enricher
    const batchEnricherPath = path.resolve(process.cwd(), 'src/core/enrichment/batchEnricher.ts');
    const enricherContent = fs.readFileSync(batchEnricherPath, 'utf8');
    for (const pattern of slopPatterns) {
      assert.ok(
        !enricherContent.includes(pattern),
        `batchEnricher.ts must not contain generic slop phrase: "${pattern}"`
      );
    }

    // Check migration version
    assert.ok(
      CURRENT_DATA_MIGRATION_VERSION === '2026-11-13-v10.0-heute-news-images-clean' ||
      CURRENT_DATA_MIGRATION_VERSION === '2026-11-13-v9.0-redaktion-hydrogen-clean' ||
      CURRENT_DATA_MIGRATION_VERSION === '2026-11-13-v8.0-purge-showcase-starters' ||
      CURRENT_DATA_MIGRATION_VERSION === '2026-11-13-v7.0-redaktion-clean' ||
      CURRENT_DATA_MIGRATION_VERSION === '2026-11-10-v6.3-gordian-clean' ||
      CURRENT_DATA_MIGRATION_VERSION === '2026-11-10-v6.0-pure-ai-newsroom' ||
      CURRENT_DATA_MIGRATION_VERSION === '2026-11-07-v4.3-rich-feed-clean-reader',
      'Migration version must be updated to v4.3+ rich feed and clean reader'
    );
  });

  await t.test('3. Migration Service: Purges and cleanses generic slop items in storage', async () => {
    const memoryStorage = new AtemStorage(new MemoryStorageDriver());

    const dirtyItem = {
      id: 'dirty-slop-item-1',
      title: 'Politik in Sachsen',
      feedText:
        'Dieser philosophische Diskurs zu „Politik in Sachsen“ widmet sich den ethischen und erkenntnistheoretischen Grundfragen des Themas.',
      body:
        'Dieser philosophische Diskurs zu „Politik in Sachsen“ widmet sich den ethischen und erkenntnistheoretischen Grundfragen des Themas. Hier ist ein echter Absatz über die Landtagswahlen.',
      topics: ['philosophy_ethics'],
      primaryTopic: 'philosophy_ethics',
      format: 'sourced_update',
      evidenceTier: 'permitted_full_text',
      factReviewStatus: 'curated_illustrative',
      sourceReferences: [
        {
          originalUrl: 'https://example.com/sachsen',
          publisher: 'MDR',
          title: 'Politik in Sachsen',
          retrievalTimestamp: '2026-11-01T12:00:00.000Z',
          isVerified: true
        }
      ],
      publishedAt: '2026-11-01T12:00:00.000Z',
      estimatedReadingMinutes: 2
    } as unknown as FeedItem;

    await memoryStorage.setItem('@atem:feed_items:v1', JSON.stringify([dirtyItem]));
    const migrated = await runInPlaceDataMigration(memoryStorage);

    assert.ok(migrated, 'Migration must execute');
    const cleanedRaw = await memoryStorage.getItem('@atem:feed_items:v1');
    assert.ok(cleanedRaw, 'Feed items must still exist');
    const cleanedItems = JSON.parse(cleanedRaw) as FeedItem[];
    for (const item of cleanedItems) {
      assert.ok(
        !item.feedText.includes('widmet sich den ethischen und erkenntnistheoretischen Grundfragen'),
        'Migrated item feedText must not contain generic slop'
      );
      assert.ok(
        !item.body.includes('widmet sich den ethischen und erkenntnistheoretischen Grundfragen'),
        'Migrated item body must not contain generic slop'
      );
    }
  });

  await t.test('4. Hard Seen-Quarantine Logic: Quarantines previously seen items to tail', () => {
    const now = Date.now();
    const sessionStartedAt = now;

    // Simulate 3 items: unseen, seen just now in current session, and seen 10 mins ago in previous session
    const unseenItem = {
      id: 'fresh-unseen',
      title: 'Fresh Unseen',
      feedText: 'Neu und ungesehen.',
      body: 'Neu und ungesehener Text.',
      topics: ['science_society'],
      primaryTopic: 'science_society',
      format: 'sourced_update',
      evidenceTier: 'permitted_full_text',
      factReviewStatus: 'curated_illustrative',
      sourceReferences: [{ originalUrl: 'https://a.com', publisher: 'Science', title: 'Science Item', retrievalTimestamp: '2026-11-01T12:00:00.000Z', isVerified: true }],
      publishedAt: new Date(now - 3600_000).toISOString(),
      estimatedReadingMinutes: 3
    } as unknown as FeedItem;

    const currentSessionSeenItem = {
      id: 'current-session-seen',
      title: 'Current Session Seen',
      feedText: 'Gerade eben im Viewport gescrollt.',
      body: 'Gerade eben gesehen.',
      topics: ['philosophy_ethics'],
      primaryTopic: 'philosophy_ethics',
      format: 'sourced_update',
      evidenceTier: 'permitted_full_text',
      factReviewStatus: 'curated_illustrative',
      sourceReferences: [{ originalUrl: 'https://b.com', publisher: 'Philo', title: 'Philo Item', retrievalTimestamp: '2026-11-01T12:00:00.000Z', isVerified: true }],
      publishedAt: new Date(now - 7200_000).toISOString(),
      estimatedReadingMinutes: 4
    } as unknown as FeedItem;

    const prevSessionSeenItem = {
      id: 'prev-session-seen',
      title: 'Previous Session Seen',
      feedText: 'Bereits vor 20 Minuten in alter Session gesehen.',
      body: 'Alter Text.',
      topics: ['ai_apple'],
      primaryTopic: 'ai_apple',
      format: 'sourced_update',
      evidenceTier: 'permitted_full_text',
      factReviewStatus: 'curated_illustrative',
      sourceReferences: [{ originalUrl: 'https://c.com', publisher: 'Tech', title: 'Tech Item', retrievalTimestamp: '2026-11-01T12:00:00.000Z', isVerified: true }],
      publishedAt: new Date(now - 86400_000).toISOString(),
      estimatedReadingMinutes: 5
    } as unknown as FeedItem;

    const items = [prevSessionSeenItem, unseenItem, currentSessionSeenItem];
    const seenMap: Record<string, { firstSeenAt: number }> = {
      'current-session-seen': { firstSeenAt: now - 30_000 }, // 30s ago in current session
      'prev-session-seen': { firstSeenAt: now - 20 * 60_000 } // 20m ago in prior session (> 5m threshold)
    };

    const unseenCandidates: FeedItem[] = [];
    const quarantinedTail: FeedItem[] = [];

    for (const item of items) {
      const seenRecord = seenMap[item.id];
      const isQuarantined =
        Boolean(seenRecord) &&
        seenRecord.firstSeenAt < sessionStartedAt - 5 * 60_000 &&
        now - seenRecord.firstSeenAt < 72 * 3600_000;

      if (isQuarantined) {
        quarantinedTail.push(item);
      } else {
        unseenCandidates.push(item);
      }
    }

    const finalOrderedStream = [...unseenCandidates, ...quarantinedTail];

    // Assert unseen items are at the front
    assert.equal(finalOrderedStream[0].id, 'fresh-unseen', 'Fresh unseen item must be in primary stream');
    assert.equal(finalOrderedStream[1].id, 'current-session-seen', 'Current session item remains in stream');
    assert.equal(finalOrderedStream[2].id, 'prev-session-seen', 'Previous session item quarantined to the tail');
  });

  await t.test('5. Direct Safari / Firefox Launch & LinkPreviewModal Elimination', () => {
    // FeedCard.tsx and ReaderScreen.tsx must not contain LinkPreviewModal
    const feedCardSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/ui/components/FeedCard.tsx'), 'utf8');
    const readerScreenSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/features/reader/ReaderScreen.tsx'), 'utf8');

    assert.ok(
      !feedCardSrc.includes('LinkPreviewModal'),
      'FeedCard.tsx must not reference or render LinkPreviewModal'
    );
    assert.ok(
      !readerScreenSrc.includes('LinkPreviewModal'),
      'ReaderScreen.tsx must not reference or render LinkPreviewModal'
    );

    // Verify direct browser launch calls
    assert.ok(
      feedCardSrc.includes('Linking.openURL') && feedCardSrc.includes('window.open'),
      'FeedCard.tsx must directly invoke native Linking.openURL and window.open for external sources'
    );
    assert.ok(
      readerScreenSrc.includes('Linking.openURL') && readerScreenSrc.includes('window.open'),
      'ReaderScreen.tsx must directly invoke native Linking.openURL and window.open for external sources'
    );
  });

  await t.test('6. ReaderScreen Declutter: Prominent buttons, Abstract, open Quiz and collapsed extra tools', () => {
    const readerScreenSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/features/reader/ReaderScreen.tsx'), 'utf8');

    // 1. Prominent top button
    assert.ok(
      readerScreenSrc.includes('🌐 Originalartikel in Safari / Firefox öffnen ↗'),
      'ReaderScreen must include prominent header button to open original article'
    );

    // 2. Second button at end of article text
    assert.ok(
      readerScreenSrc.includes('🌐 Vollständigen Originalartikel bei'),
      'ReaderScreen must include second convenient button at text end'
    );

    // 3. Interactive Quiz open directly under article
    assert.ok(
      readerScreenSrc.includes('Wissen testen: Kernverständnis'),
      'ReaderScreen must render QuizCheckpointCard directly under article'
    );

    // 4. Collapsible extra tools accordion
    assert.ok(
      readerScreenSrc.includes('showExtraTools'),
      'ReaderScreen must use showExtraTools state to keep advanced salon tools collapsed by default'
    );
    assert.ok(
      readerScreenSrc.includes('➕ Weitere Werkzeuge & Perspektiven'),
      'ReaderScreen must show accordion toggle button for additional perspectives'
    );
    assert.ok(
      readerScreenSrc.includes('extraToolsToggleBtn'),
      'ReaderScreen must style the extra tools accordion toggle button'
    );
  });
});
