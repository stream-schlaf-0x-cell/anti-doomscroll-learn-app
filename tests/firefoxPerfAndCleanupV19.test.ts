import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { FeedItem } from '../src/core/domain/types';
import { INITIAL_FIXTURES } from '../src/core/data/fixtures';
import { LocalFeedRepository } from '../src/core/data/feedRepository';
import { defaultSnapshotLoader } from '../src/core/feed/SnapshotLoader';
import { upgradeImageResolutionUrl } from '../src/core/utils/imageQuality';
import { areFeedCardPropsEqual, ScoredFeedItem, sortFeedForDisplay } from '../src/core/domain/ranking';

const ROOT_DIR = path.resolve(__dirname, '..');

function makeSyntheticItem(id: string, overrides: Partial<FeedItem> = {}): FeedItem {
  const base = INITIAL_FIXTURES[0];
  const publishedAt = overrides.publishedAt ?? new Date(Date.now() - 2 * 3600_000).toISOString();
  return {
    ...base,
    id,
    title: `V19 Synthetischer Artikel ${id} zur digitalen Aufmerksamkeitsökonomie`,
    subtitle: 'Analytische Einordnung',
    feedText:
      'Kompakte Analyse zu Browser-Performance, Hauptthread-Entlastung und ruhigem Lesen im offenen Web mit belastbaren Quellen.',
    body:
      'Ausführlicher Artikeltext über die Architektur reaktionsschneller Wissensfeeds ohne blockierende Hauptthread-Spitzen oder unnötige Bild-Dekodierung.',
    articleBody:
      'Ausführlicher Artikeltext über die Architektur reaktionsschneller Wissensfeeds ohne blockierende Hauptthread-Spitzen oder unnötige Bild-Dekodierung.',
    canonicalUrl: `https://example.org/v19/${id}`,
    sourceDomain: 'example.org',
    sourceBroadcasterName: 'Wissensredaktion',
    primaryTopic: 'philosophy_ethics',
    topics: ['philosophy_ethics'],
    space: 'c/dialektik',
    format: 'concise_insight',
    type: 'briefing',
    contentOrigin: 'live_ingested',
    publishedAt,
    firstSeenAt: publishedAt,
    publicationDateReliable: true,
    isStaticFallback: false,
    isEvergreenGem: false,
    curationScore: 8.4,
    wordCount: 220,
    estimatedReadingMinutes: 2,
    ...overrides
  };
}

function makeScoredItem(id: string, overrides: Partial<ScoredFeedItem> = {}): ScoredFeedItem {
  const base = makeSyntheticItem(id, overrides);
  return {
    ...base,
    score: 84,
    scoreBreakdown: {
      topicMatch: 20,
      topicAffinity: 15,
      goalAlignment: 10,
      readingTimeFit: 8,
      durationMatch: 8,
      freshness: 12,
      editorialValue: 10,
      depthBonus: 5,
      serendipity: 2,
      feedbackAdjustment: 0,
      behavioralAdjustment: 0,
      authorBoost: 0,
      totalScore: 84,
      explanation: 'Aktueller Beitrag im Interessensfeld',
      primaryReason: 'Themenpassung',
      secondaryReason: 'Aktuell',
      whyFactors: ['Aktueller Beitrag']
    },
    ...overrides
  };
}

test('Atmen v19 — Firefox Performance, Chunked Hydration & Modular Cleanup', async (t) => {
  await t.test(
    'Test 1: hydrateFromReservoir chunked hydration preserves all valid items and skips redundant regex sweep on pre-curated items',
    async () => {
      const repoSrc = fs.readFileSync(path.join(ROOT_DIR, 'src/core/data/feedRepository.ts'), 'utf8');
      assert.ok(
        repoSrc.includes('RESERVOIR_HYDRATION_CHUNK_SIZE = 40'),
        'feedRepository.ts must define RESERVOIR_HYDRATION_CHUNK_SIZE = 40'
      );
      assert.ok(
        repoSrc.includes('yieldToMainThread()') && repoSrc.includes('canUsePreCuratedSnapshotFastPath'),
        'feedRepository.ts must yield between chunks and include pre-curated snapshot fast-path'
      );

      // Build 95 distinct valid items (> 2 full chunks of 40) + 1 dirty item with legacy prefix/HTML
      const cleanBatch: FeedItem[] = [];
      for (let i = 0; i < 94; i++) {
        cleanBatch.push(
          makeSyntheticItem(`v19-res-clean-${i}`, {
            title: `V19 Clean Reservoir Beitrag ${i}: Erkenntnistheorie und Medien`,
            space: i % 2 === 0 ? 'c/dialektik' : 'c/serendipity',
            canonicalUrl: `https://example.org/clean-${i}`
          })
        );
      }
      const dirtyItem = makeSyntheticItem('v19-res-dirty-94', {
        title: 'From the archive: Historische Debatte über Öffentlichkeit',
        feedText: '<p>Archivtext mit <strong>HTML</strong>-Fragmenten zur Prüfung des Fallback-Sanitizers.</p>',
        body: '<p>Volltext mit <em>HTML</em>-Fragmenten zur Prüfung des Fallback-Sanitizers.</p>',
        canonicalUrl: 'https://example.org/dirty-94'
      });
      const allMockItems = [...cleanBatch, dirtyItem];

      const repo = new LocalFeedRepository();
      repo.setItems([]);
      const beforeCount = repo.getAllItems().length;

      const originalLoadReservoir = defaultSnapshotLoader.loadReservoir.bind(defaultSnapshotLoader);
      defaultSnapshotLoader.loadReservoir = async () => ({
        success: true,
        items: allMockItems,
        itemCount: allMockItems.length,
        generatedAt: new Date().toISOString()
      });

      try {
        const result = await repo.hydrateFromReservoir('https://mock.local/feed-reservoir.json');
        assert.equal(result.success, true, 'hydrateFromReservoir must succeed');
        assert.equal(result.insertedCount, 95, `Expected all 95 valid reservoir items inserted (got ${result.insertedCount})`);

        const stored = repo.getAllItems();
        const storedIds = new Set(stored.map((it) => it.id));
        const presentMockCount = allMockItems.filter((it) => storedIds.has(it.id)).length;
        assert.equal(
          presentMockCount,
          95,
          `Expected all 95 mock reservoir items present after chunked hydration (got ${presentMockCount}, total=${stored.length}, before=${beforeCount})`
        );

        // Clean item kept intact via pre-curated fast-path
        const sampleClean = stored.find((it) => it.id === 'v19-res-clean-50');
        assert.ok(sampleClean, 'Clean item from middle chunk must be preserved');
        assert.equal(sampleClean.space, 'c/dialektik');

        // Dirty item fell back to sanitizeCuratedFeedItem (strips legacy "From the archive:" prefix)
        const sanitizedDirty = stored.find((it) => it.id === 'v19-res-dirty-94');
        assert.ok(sanitizedDirty, 'Dirty item must still be hydrated via fallback sanitizer');
        assert.equal(
          /^From the archive:/i.test(sanitizedDirty.title),
          false,
          `Dirty reservoir item with archive prefix must pass through sanitizeCuratedFeedItem (got "${sanitizedDirty.title}")`
        );
      } finally {
        defaultSnapshotLoader.loadReservoir = originalLoadReservoir;
      }
    }
  );

  await t.test(
    'Test 2: FeedScreen scroll guard (>= 15 local unseen), startTransition sort switch & dynamic lazy imports',
    () => {
      const feedScreenSrc = fs.readFileSync(path.join(ROOT_DIR, 'src/features/feed/FeedScreen.tsx'), 'utf8');

      // 1. Local-unseen >= 15 early-return guard in curateNextStreamBatch('scroll') before live network calls
      const scrollBranchIdx = feedScreenSrc.indexOf("if (reason === 'scroll')");
      assert.ok(scrollBranchIdx > 0, 'curateNextStreamBatch must have a scroll branch');

      const guardIdx = feedScreenSrc.indexOf('if (localUnseenCount >= 15)', scrollBranchIdx);
      assert.ok(
        guardIdx > scrollBranchIdx,
        'curateNextStreamBatch must guard scroll replenishment when localUnseenCount >= 15'
      );

      const liveStreamRefreshIdx = feedScreenSrc.indexOf('ContinuousLiveNewsService.getLiveStream', guardIdx);
      assert.ok(
        liveStreamRefreshIdx > guardIdx,
        'localUnseenCount >= 15 early-return guard must appear BEFORE ContinuousLiveNewsService.getLiveStream'
      );

      // 2. React.startTransition for sort switching
      assert.ok(
        feedScreenSrc.includes('startTransition(') && feedScreenSrc.includes('setUiSortMode('),
        'handleSortChange must update uiSortMode synchronously and wrap heavy sort state updates in startTransition'
      );

      // 3. Zero static top-level imports of OpenWebHarvester, SubchannelFlourishService, OnTheFlyStreamService
      const importBlock = feedScreenSrc.slice(0, 4500);
      assert.equal(
        /^\s*import\s+.*from\s+['"].*openWebHarvester['"]/m.test(importBlock),
        false,
        'OpenWebHarvester must NOT be statically imported at top of FeedScreen.tsx'
      );
      assert.equal(
        /^\s*import\s+.*from\s+['"].*subchannelFlourishService['"]/m.test(importBlock),
        false,
        'SubchannelFlourishService must NOT be statically imported at top of FeedScreen.tsx'
      );
      assert.equal(
        /^\s*import\s+.*from\s+['"].*onTheFlyStreamService['"]/m.test(importBlock),
        false,
        'OnTheFlyStreamService must NOT be statically imported at top of FeedScreen.tsx'
      );

      // Dynamic import(...) present for all 3 heavy services
      assert.ok(
        feedScreenSrc.includes("import('../../core/ingestion/openWebHarvester')"),
        'FeedScreen.tsx must dynamically import openWebHarvester'
      );
      assert.ok(
        feedScreenSrc.includes("import('../../core/ingestion/subchannelFlourishService')"),
        'FeedScreen.tsx must dynamically import subchannelFlourishService'
      );
      assert.ok(
        feedScreenSrc.includes("import('../../core/synthesis/onTheFlyStreamService')"),
        'FeedScreen.tsx must dynamically import onTheFlyStreamService'
      );
    }
  );

  await t.test(
    'Test 3: upgradeImageResolutionUrl respects targetWidth <= 800 compact feed cards vs > 800 high-res Reader/Lightbox',
    () => {
      const ytMq = 'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg';
      const ytHq = 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg';
      const itunes = 'https://is1-ssl.mzstatic.com/image/thumb/Podcasts116/v4/aa/bb/cc/100x100bb.jpg';
      const wiki = 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Caspar_David_Friedrich.jpg/220px-Caspar_David_Friedrich.jpg';
      const dlf = 'https://bilder.deutschlandfunk.de/FI/LE/example-320x180.jpg';

      // Compact feed card thumbnails (targetWidth <= 800)
      assert.equal(
        upgradeImageResolutionUrl(ytMq, 800),
        'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
        'YouTube mqdefault at targetWidth=800 must upgrade to hqdefault.jpg (not maxresdefault)'
      );
      assert.equal(
        upgradeImageResolutionUrl(ytHq, 800),
        'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
        'YouTube hqdefault at targetWidth=800 must remain hqdefault.jpg'
      );
      assert.equal(
        upgradeImageResolutionUrl(itunes, 800),
        'https://is1-ssl.mzstatic.com/image/thumb/Podcasts116/v4/aa/bb/cc/600x600bb.jpg',
        'iTunes artwork at targetWidth=800 must use 600x600bb'
      );
      assert.equal(
        upgradeImageResolutionUrl(wiki, 800),
        'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Caspar_David_Friedrich.jpg/640px-Caspar_David_Friedrich.jpg',
        'Wikimedia thumb at targetWidth=800 must use 640px- (<= 800px)'
      );
      assert.equal(
        upgradeImageResolutionUrl(dlf, 800),
        'https://bilder.deutschlandfunk.de/FI/LE/example-1280x720.jpg',
        'DLF image at targetWidth=800 must stay below 1920x1080 (1280x720)'
      );

      // High-res Reader / Lightbox (targetWidth = 1200 and default = 1080)
      for (const highTarget of [1200, undefined] as const) {
        const label = highTarget === undefined ? 'default' : String(highTarget);
        assert.equal(
          upgradeImageResolutionUrl(ytHq, highTarget),
          'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
          `YouTube at ${label} must upgrade to maxresdefault.jpg`
        );
        assert.equal(
          upgradeImageResolutionUrl(itunes, highTarget),
          'https://is1-ssl.mzstatic.com/image/thumb/Podcasts116/v4/aa/bb/cc/1200x1200bb.jpg',
          `iTunes at ${label} must upgrade to 1200x1200bb`
        );
        assert.equal(
          upgradeImageResolutionUrl(wiki, highTarget),
          'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Caspar_David_Friedrich.jpg/800px-Caspar_David_Friedrich.jpg',
          `Wikimedia at ${label} must upgrade to 800px-`
        );
        assert.equal(
          upgradeImageResolutionUrl(dlf, highTarget),
          'https://bilder.deutschlandfunk.de/FI/LE/example-1920x1080.jpg',
          `DLF at ${label} must upgrade to 1920x1080`
        );
      }
    }
  );

  await t.test(
    'Test 4: sortFeedForDisplay(items650, "today") finishes in < 50 ms on a 650-item pool and prioritizes fresh 48h items',
    () => {
      const nowMs = Date.now();
      const domains = [
        'zeit.de',
        'sueddeutsche.de',
        'deutschlandfunk.de',
        'faz.net',
        'spektrum.de',
        'heise.de',
        'netzpolitik.org',
        'mdr.de',
        'tagesschau.de',
        'republik.ch'
      ];
      const spaces = [
        'c/gesellschaft_politik',
        'c/dialektik',
        'c/acceleration',
        'c/serendipity',
        'c/didaktik_labor',
        'c/kontemplation'
      ];

      const items650: ScoredFeedItem[] = [];
      for (let i = 0; i < 650; i++) {
        // First 40 items are fresh (< 16h), next 30 are 20-40h, remaining 580 are stale (5d - 120d)
        const ageMs =
          i < 40
            ? (i % 14 + 1) * 3600_000
            : i < 70
            ? (20 + (i % 18)) * 3600_000
            : (5 + (i % 115)) * 24 * 3600_000;
        const domain = domains[i % domains.length];
        items650.push(
          makeScoredItem(`v19-pool-${i}`, {
            title: `Aktueller Bericht ${i} aus ${domain}`,
            sourceDomain: domain,
            sourceBroadcasterName: domain,
            canonicalUrl: `https://${domain}/story-${i}`,
            space: spaces[i % spaces.length],
            publishedAt: new Date(nowMs - ageMs).toISOString(),
            publicationDateReliable: true,
            sourceTrustLevel: 'public_broadcaster',
            curationScore: 7.5 + (i % 20) * 0.1
          })
        );
      }

      // Warm up JIT once on tiny slice, then measure 650-item run
      sortFeedForDisplay(items650.slice(0, 10), 'today');

      const t0 = performance.now();
      const sorted = sortFeedForDisplay(items650, 'today');
      const elapsedMs = performance.now() - t0;

      assert.ok(
        elapsedMs < 50,
        `sortFeedForDisplay(650, 'today') took ${elapsedMs.toFixed(2)} ms (expected < 50 ms)`
      );
      assert.ok(sorted.length >= 20, `Expected >= 20 fresh items in today output (got ${sorted.length})`);

      // Verify all top returned items are fresh (<= 48h old)
      const fortyEightHoursMs = 48 * 3600_000;
      for (const item of sorted.slice(0, 20)) {
        const ageMs = nowMs - Date.parse(item.publishedAt);
        assert.ok(
          ageMs <= fortyEightHoursMs,
          `Item ${item.id} in top 'today' results is too old (${(ageMs / 3600_000).toFixed(1)}h)`
        );
      }
    }
  );

  await t.test(
    'Test 5: FeedCard eliminates useWindowDimensions/onLayout, enables CSS contentVisibility on web & checks width props in memo comparator',
    () => {
      const feedCardSrc = fs.readFileSync(path.join(ROOT_DIR, 'src/ui/components/FeedCard.tsx'), 'utf8');

      assert.equal(
        feedCardSrc.includes('useWindowDimensions'),
        false,
        'FeedCard.tsx must NOT call useWindowDimensions() per card'
      );
      assert.equal(
        /\bonLayout\s*=/.test(feedCardSrc),
        false,
        'FeedCard.tsx must NOT attach per-card onLayout handlers'
      );
      assert.ok(
        feedCardSrc.includes("contentVisibility: 'auto'") &&
          feedCardSrc.includes("contain: 'layout style paint'"),
        'FeedCard.tsx must apply CSS containment (contentVisibility: auto, contain: layout style paint) on web'
      );

      // Verify FeedScreen passes cardWidth & viewportWidth
      const feedScreenSrc = fs.readFileSync(path.join(ROOT_DIR, 'src/features/feed/FeedScreen.tsx'), 'utf8');
      assert.ok(
        feedScreenSrc.includes('cardWidth={feedCardWidth}') && feedScreenSrc.includes('viewportWidth={width}'),
        'FeedScreen.tsx must pass cardWidth={feedCardWidth} and viewportWidth={width} to FeedCard'
      );

      // Verify areFeedCardPropsEqual compares cardWidth and viewportWidth
      const item = makeScoredItem('v19-memo-card');
      const baseProps = {
        item,
        isDark: false,
        palette: 'tidalglass' as const,
        enableSoundGrounding: true,
        isHero: false,
        isFocused: false,
        isExpanded: false,
        cardWidth: 740,
        viewportWidth: 1280
      };

      assert.equal(
        areFeedCardPropsEqual(baseProps, { ...baseProps }),
        true,
        'Identical FeedCard props including cardWidth & viewportWidth must be equal'
      );
      assert.equal(
        areFeedCardPropsEqual(baseProps, { ...baseProps, cardWidth: 680 }),
        false,
        'Changing cardWidth must invalidate FeedCard memo'
      );
      assert.equal(
        areFeedCardPropsEqual(baseProps, { ...baseProps, viewportWidth: 960 }),
        false,
        'Changing viewportWidth must invalidate FeedCard memo'
      );
    }
  );
});
