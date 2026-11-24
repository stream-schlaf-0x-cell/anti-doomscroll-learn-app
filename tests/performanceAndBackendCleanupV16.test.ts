import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { FeedItem } from '../src/core/domain/types';
import { INITIAL_FIXTURES } from '../src/core/data/fixtures';
import {
  compactItemForSnapshot,
  parseSnapshotPayload,
  utf8ByteLength
} from '../src/core/feed/snapshotPayload';
import {
  RAW_GITHUB_SNAPSHOT_URL,
  SNAPSHOT_SAME_ORIGIN_FRESHNESS_MS,
  SnapshotLoader
} from '../src/core/feed/SnapshotLoader';
import {
  BOOT_DECK_MAX_BYTES,
  BOOT_DECK_MAX_ITEMS,
  FeedCacheStore,
  buildBootDeckPayload,
  measureUtf8Bytes
} from '../src/core/data/feedCacheStore';
import { AtemStorage, MemoryStorageDriver } from '../src/core/data/storage';
import { sanitizeCuratedFeedItem } from '../src/core/enrichment/batchEnricher';
import {
  BACKGROUND_QUIET_SETTLE_MS,
  BackgroundCoordinator,
  SUFFICIENT_FRESH_UNSEEN_THRESHOLD
} from '../src/core/context/backgroundCoordinator';

const ROOT_DIR = path.resolve(__dirname, '..');

function makeFreshItem(id: string, offsetMinutes: number): FeedItem {
  const base = INITIAL_FIXTURES[0];
  const publishedAt = new Date(Date.now() - offsetMinutes * 60_000).toISOString();
  return {
    ...base,
    id,
    title: `V16 Performance Test Artikel ${id}`,
    subtitle: 'Kompakte Einordnung',
    feedText:
      'Substanzielle Analyse zur Performance-Architektur von modernen Wissensfeeds mit klaren Messwerten und nachvollziehbaren Quellen.',
    body:
      'Ausführlicher Volltext für den ReaderScreen ohne Redundanz zwischen body und articleBody.',
    articleBody:
      'Ausführlicher Volltext für den ReaderScreen ohne Redundanz zwischen body und articleBody — längere Fassung mit zusätzlichem Kontext.',
    primaryTopic: 'science_society',
    topics: ['science_society'],
    space: 'c/wissenschaft',
    format: 'concise_insight',
    type: 'briefing',
    contentOrigin: 'live_ingested',
    publishedAt,
    firstSeenAt: publishedAt,
    publicationDateReliable: true,
    isStaticFallback: false,
    isEvergreenGem: false,
    curationScore: 8.5,
    wordCount: 180,
    estimatedReadingMinutes: 2
  };
}

test('Atmen v16 — Performance Turbo, Payload Compaction, Warm Cache & Backend Cleanup', async (t) => {
  await t.test('1. WP1: Compacted snapshot & reservoir payloads slash bytes and auto-restore full articleBody', () => {
    const snapPath = path.join(ROOT_DIR, 'public/feed-snapshot.json');
    const resPath = path.join(ROOT_DIR, 'public/feed-reservoir.json');

    const snapBytes = fs.statSync(snapPath).size;
    const resBytes = fs.statSync(resPath).size;

    assert.ok(
      snapBytes < 950_000,
      `public/feed-snapshot.json must be < 950 KB (was 2,425 KB; got ${snapBytes} B)`
    );
    assert.ok(
      resBytes < 4_500_000,
      `public/feed-reservoir.json must be < 4.5 MB (was 8,999 KB; got ${resBytes} B)`
    );

    const rawSnap = JSON.parse(fs.readFileSync(snapPath, 'utf8'));
    const rawRes = JSON.parse(fs.readFileSync(resPath, 'utf8'));

    assert.ok(Array.isArray(rawSnap.items) && rawSnap.items.length >= 100, 'Snapshot must retain >= 100 rich items');
    assert.ok(Array.isArray(rawRes.items) && rawRes.items.length >= 500, 'Reservoir must retain >= 500 items');

    const artItems = rawSnap.items.filter((it: FeedItem) => it.space === 'c/kunst_galerie');
    assert.ok(artItems.length >= 22, `Snapshot must retain >= 22 c/kunst_galerie artworks (got ${artItems.length})`);

    // Serialized JSON must not duplicate articleBody or bloat relatedCrossReferences
    for (const rawItem of rawSnap.items) {
      assert.equal(rawItem.articleBody, undefined, `Serialized snapshot item ${rawItem.id} must omit redundant articleBody`);
      assert.equal(rawItem.relatedCrossReferences, undefined, `Serialized snapshot item ${rawItem.id} must omit relatedCrossReferences`);
    }

    // parseSnapshotPayload must seamlessly restore articleBody from body for ReaderScreen
    const parsed = parseSnapshotPayload(rawSnap, { skipByteBudget: true });
    assert.ok(parsed && parsed.items.length === rawSnap.items.length, 'parseSnapshotPayload must hydrate all snapshot items');
    for (const hydrated of parsed.items) {
      if (hydrated.body && hydrated.body.trim().length > 0) {
        assert.equal(
          hydrated.articleBody,
          hydrated.body,
          `Hydrated item ${hydrated.id} must restore articleBody from body so ReaderScreen never loses content`
        );
      }
    }

    // compactItemForSnapshot keeps the richer text in body and omits articleBody/relatedCrossReferences
    const rich = makeFreshItem('v16-compact-check', 10);
    const compacted = compactItemForSnapshot({
      ...rich,
      relatedCrossReferences: [
        {
          id: 'x',
          title: 'X',
          publisher: 'Spektrum',
          insight: 'Kontext-Impuls',
          connectionReason: 'Kontext'
        }
      ]
    });
    assert.equal(compacted.body, rich.articleBody, 'compactItemForSnapshot must promote longer articleBody into body');
    assert.equal(compacted.articleBody, undefined);
    assert.equal(compacted.relatedCrossReferences, undefined);

    // utf8ByteLength matches exact UTF-8 byte count
    const utf8Sample = 'Atmen — ÄÖÜß Philosophie & Wissens-Feed 🔥🧠✨';
    assert.equal(utf8ByteLength(utf8Sample), Buffer.byteLength(utf8Sample, 'utf8'));
  });

  await t.test('2. WP3a: SnapshotLoader fetches Same-Origin first without double-download when fresh, falls back to raw_github when stale or forced', async () => {
    const originalFetch = globalThis.fetch;
    const freshItem = compactItemForSnapshot(makeFreshItem('v16-loader-fresh', 15));
    const newerRawItem = compactItemForSnapshot(makeFreshItem('v16-loader-raw', 5));

    const freshTs = new Date(Date.now() - 30 * 60_000).toISOString();
    const staleTs = new Date(Date.now() - (SNAPSHOT_SAME_ORIGIN_FRESHNESS_MS + 30 * 60_000)).toISOString();
    const newerTs = new Date(Date.now() - 2 * 60_000).toISOString();

    const makeResponse = (payload: unknown) =>
      ({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(payload),
        json: async () => payload
      }) as unknown as Response;

    try {
      // Case A: Fresh Same-Origin (< 4.5h) -> strictly 1 fetch, zero raw.githubusercontent.com call
      const callsA: { url: string; cache?: RequestCache }[] = [];
      globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        callsA.push({ url, cache: init?.cache });
        return makeResponse({
          generatedAt: freshTs,
          totalCandidateSources: 400,
          activeDeliveringSources: 350,
          totalAvailableItems: 1,
          items: [freshItem],
          sourceHealth: {}
        });
      }) as typeof fetch;

      const loader = new SnapshotLoader();
      const resA = await loader.loadSnapshot('./feed-snapshot.json');
      assert.equal(resA.success, true);
      assert.equal(resA.sourceOrigin, 'pages_or_local');
      assert.equal(callsA.length, 1, 'Fresh Same-Origin snapshot must perform ONLY 1 fetch (no blind double-download)');
      assert.equal(callsA[0].cache, 'no-cache', 'Normal Same-Origin load must use cache: no-cache for HTTP 304/ETag validation');
      assert.ok(!callsA.some(c => c.url.includes('raw.githubusercontent.com')));
      assert.equal(resA.items[0].articleBody, resA.items[0].body, 'Loaded snapshot item must have restored articleBody');

      // Case B: Stale Same-Origin (> 4.5h) -> falls back to raw.githubusercontent.com and picks newer payload
      const callsB: string[] = [];
      globalThis.fetch = (async (input: string | URL | Request) => {
        const url = String(input);
        callsB.push(url);
        if (url.startsWith(RAW_GITHUB_SNAPSHOT_URL)) {
          return makeResponse({
            generatedAt: newerTs,
            totalCandidateSources: 400,
            activeDeliveringSources: 355,
            totalAvailableItems: 1,
            items: [newerRawItem],
            sourceHealth: {}
          });
        }
        return makeResponse({
          generatedAt: staleTs,
          totalCandidateSources: 400,
          activeDeliveringSources: 350,
          totalAvailableItems: 1,
          items: [freshItem],
          sourceHealth: {}
        });
      }) as typeof fetch;

      const resB = await loader.loadSnapshot('./feed-snapshot.json');
      assert.equal(resB.success, true);
      assert.equal(resB.sourceOrigin, 'raw_github', 'Stale Same-Origin (> 4.5h) must fall back to raw_github');
      assert.equal(resB.items[0].id, newerRawItem.id);
      assert.ok(callsB.some(u => u.startsWith(RAW_GITHUB_SNAPSHOT_URL)));

      // Case C: forceRefresh: true -> checks raw_github even if Same-Origin is fresh
      const callsC: string[] = [];
      globalThis.fetch = (async (input: string | URL | Request) => {
        const url = String(input);
        callsC.push(url);
        if (url.startsWith(RAW_GITHUB_SNAPSHOT_URL)) {
          return makeResponse({
            generatedAt: newerTs,
            totalCandidateSources: 400,
            activeDeliveringSources: 360,
            totalAvailableItems: 1,
            items: [newerRawItem],
            sourceHealth: {}
          });
        }
        return makeResponse({
          generatedAt: freshTs,
          totalCandidateSources: 400,
          activeDeliveringSources: 350,
          totalAvailableItems: 1,
          items: [freshItem],
          sourceHealth: {}
        });
      }) as typeof fetch;

      const resC = await loader.loadSnapshot('./feed-snapshot.json', 8000, { forceRefresh: true });
      assert.equal(resC.success, true);
      assert.equal(resC.sourceOrigin, 'raw_github', 'forceRefresh must query raw_github and select newer snapshot');
      assert.ok(callsC.some(u => u.startsWith(RAW_GITHUB_SNAPSHOT_URL)));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await t.test('3. WP2 & WP3b: FeedCacheStore <100 KB Boot-Deck, O(1) sanitize WeakSet cache & quiet BackgroundCoordinator', async () => {
    const rawSnap = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'public/feed-snapshot.json'), 'utf8'));
    const parsedSnap = parseSnapshotPayload(rawSnap, { skipByteBudget: true });
    assert.ok(parsedSnap && parsedSnap.items.length > 0);

    // Boot-Deck strictly < 100 KB and <= 24 diverse fresh items
    const deck = buildBootDeckPayload(parsedSnap.items, { generatedAt: parsedSnap.generatedAt });
    const deckBytes = measureUtf8Bytes(JSON.stringify(deck));
    assert.ok(deck.items.length > 0 && deck.items.length <= BOOT_DECK_MAX_ITEMS);
    assert.ok(deckBytes <= BOOT_DECK_MAX_BYTES && deckBytes < 100 * 1024, `Boot-Deck must be < 100 KB (got ${deckBytes} B)`);

    // FeedCacheStore round-trips Boot-Deck & public snapshot cleanly on isolated MemoryStorageDriver
    const memStorage = new AtemStorage(new MemoryStorageDriver());
    const cacheStore = new FeedCacheStore(memStorage, { useIndexedDb: false });
    await cacheStore.setPublicSnapshot({
      generatedAt: parsedSnap.generatedAt,
      cachedAt: new Date().toISOString(),
      remoteUrl: 'default',
      items: parsedSnap.items
    });
    const loadedDeck = await cacheStore.getBootDeck();
    const loadedSnap = await cacheStore.getPublicSnapshot();
    assert.ok(loadedDeck && loadedDeck.items.length === deck.items.length, 'FeedCacheStore must persist & restore Boot-Deck');
    assert.ok(loadedSnap && loadedSnap.items.length === parsedSnap.items.length, 'FeedCacheStore must persist & restore public snapshot');

    // sanitizeCuratedFeedItem O(1) WeakSet cache preserves object identity on repeat calls while still sanitizing fresh clones
    const dirty = {
      ...makeFreshItem('v16-weakset-1', 10),
      title: 'From the archive: Tiefenanalyse der Informationsökonomie'
    };
    const firstPass = sanitizeCuratedFeedItem(dirty);
    assert.equal(firstPass.title, 'Tiefenanalyse der Informationsökonomie');
    const secondPass = sanitizeCuratedFeedItem(firstPass);
    assert.strictEqual(secondPass, firstPass, 'Repeat sanitizeCuratedFeedItem on already-sanitized object must hit O(1) WeakSet cache');

    const freshClone = { ...firstPass, title: 'From the archive: Neue Überschrift' };
    const clonePass = sanitizeCuratedFeedItem(freshClone);
    assert.equal(clonePass.title, 'Neue Überschrift', 'Fresh cloned objects must still run full sanitization');

    // BackgroundCoordinator enforces >= 15s quiet settle and skips maintenance when >= 40 fresh unseen items exist
    assert.ok(BACKGROUND_QUIET_SETTLE_MS >= 15_000, 'Quiet settle delay must be >= 15s');
    assert.equal(SUFFICIENT_FRESH_UNSEEN_THRESHOLD, 40);

    const freshPool45 = Array.from({ length: 45 }, (_, i) => makeFreshItem(`v16-bg-${i}`, i + 1));
    let reservoirCalled = 0;
    let liveCalled = 0;
    let newsroomCalled = 0;

    const quietCoord = new BackgroundCoordinator({
      getRepoItems: () => freshPool45,
      getSeenIds: async () => new Set<string>(),
      hydrateReservoir: async () => {
        reservoirCalled++;
        return { success: true, insertedCount: 10 };
      },
      runLiveReplenishment: async () => {
        liveCalled++;
        return [];
      },
      runAiNewsroom: async () => {
        newsroomCalled++;
        return [];
      }
    });

    const skippedReport = await quietCoord.runQuietMaintenancePass();
    assert.equal(skippedReport.skipped, true, 'BackgroundCoordinator must skip completely when >= 40 fresh unseen items exist');
    assert.equal(reservoirCalled, 0);
    assert.equal(liveCalled, 0);
    assert.equal(newsroomCalled, 0);

    // When unseen items are low (< 40), BackgroundCoordinator triggers lazy reservoir hydration
    const lowPool5 = freshPool45.slice(0, 5);
    const lowCoord = new BackgroundCoordinator({
      getRepoItems: () => lowPool5,
      getSeenIds: async () => new Set<string>(),
      hydrateReservoir: async () => {
        reservoirCalled++;
        return { success: true, insertedCount: 50 };
      }
    });
    const lowReport = await lowCoord.runQuietMaintenancePass();
    assert.equal(lowReport.skipped, false);
    assert.equal(lowReport.ranReservoir, true);
    assert.equal(reservoirCalled, 1);
  });

  await t.test('4. WP4 & WP5: Node-only source-health guard, React.lazy code-splitting & verified dead backend cleanup', () => {
    const sourceRepoTs = fs.readFileSync(path.join(ROOT_DIR, 'src/core/data/sourceRepository.ts'), 'utf8');
    assert.ok(
      !sourceRepoTs.includes("require('./source-health.json')"),
      'sourceRepository.ts must NOT statically require(./source-health.json) into the web bundle'
    );
    assert.ok(
      sourceRepoTs.includes("eval('require')('fs')") && sourceRepoTs.includes('process.versions?.node'),
      'sourceRepository.ts must guard source-health.json behind a Node-only runtime check'
    );

    const harvesterTs = fs.readFileSync(path.join(ROOT_DIR, 'src/core/ingestion/openWebHarvester.ts'), 'utf8');
    assert.ok(
      harvesterTs.includes("import('./globalCorpusSources')"),
      'openWebHarvester.ts must dynamically import globalCorpusSources on demand'
    );

    const appTsx = fs.readFileSync(path.join(ROOT_DIR, 'App.tsx'), 'utf8');
    assert.ok(
      appTsx.includes("import { FeedScreen } from './src/features/feed/FeedScreen'"),
      'App.tsx must keep FeedScreen eagerly loaded for zero startup waterfall'
    );
    for (const lazyComp of ['ReaderScreen', 'LibraryScreen', 'SettingsScreen', 'NetworkScreen', 'OnboardingScreen', 'WhyThisModal', 'InvestigationModal']) {
      assert.ok(
        appTsx.includes(`const ${lazyComp} = React.lazy(`),
        `App.tsx must code-split ${lazyComp} via React.lazy()`
      );
    }
    assert.ok(appTsx.includes('<Suspense'), 'App.tsx must wrap lazy routes/modals in Suspense');

    const headerTsx = fs.readFileSync(path.join(ROOT_DIR, 'src/ui/components/Header.tsx'), 'utf8');
    assert.ok(
      headerTsx.includes('const UltraMasterModal = React.lazy(') &&
        headerTsx.includes('{showMaster && (') &&
        headerTsx.includes('<Suspense fallback={null}>'),
      'Header.tsx must lazily and conditionally mount modals inside Suspense'
    );

    const feedScreenTsx = fs.readFileSync(path.join(ROOT_DIR, 'src/features/feed/FeedScreen.tsx'), 'utf8');
    assert.ok(
      feedScreenTsx.includes('React.lazy(') &&
        feedScreenTsx.includes('<Suspense') &&
        feedScreenTsx.includes('hydrateFromReservoir'),
      'FeedScreen.tsx must code-split secondary modals and lazily trigger hydrateFromReservoir on scroll'
    );

    // Dead backend files removed in WP5
    for (const removedRel of [
      'src/core/archive/foundationalCanonService.ts',
      'src/core/enrichment/geminiEnricher.ts',
      'src/core/studio/atmenStudio.ts',
      'scripts/generate-codebase-dumps.ts'
    ]) {
      assert.equal(
        fs.existsSync(path.join(ROOT_DIR, removedRel)),
        false,
        `Dead backend file ${removedRel} must stay removed`
      );
    }
  });
});
