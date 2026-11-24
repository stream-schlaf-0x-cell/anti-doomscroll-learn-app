import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { FeedItem, TopicTag } from '../src/core/domain/types';
import {
  isArtShowcaseItem,
  isNonArtVaultItem,
  isWithin14DayRelevanceWindow,
  rankBloomScrollFeed,
  scoreFeedItem,
  sortFeedForDisplay
} from '../src/core/domain/ranking';
import { REAL_KNOWLEDGE_VAULT } from '../src/core/data/realKnowledgeVault';
import { DEFAULT_USER_PROFILE, INITIAL_FIXTURES } from '../src/core/data/fixtures';
import { isStaticFallbackItem } from '../src/core/data/feedRepository';
import {
  HORIZON_BAR_DOWN_DELTA,
  HORIZON_BAR_HIDE_SCROLL_Y,
  HORIZON_BAR_TOP_LOCK_Y,
  HORIZON_BAR_UP_DELTA,
  PULL_REFRESH_MAX,
  PULL_REFRESH_THRESHOLD,
  evaluateHorizonBarVisibility,
  evaluatePullToRefreshGesture,
  shouldUnlockFallbackTopLock
} from '../src/core/feed/scrollUxController';

const ROOT_DIR = path.resolve(__dirname, '..');

function makeFreshLiveItem(index: number, nowMs: number): FeedItem {
  const base = INITIAL_FIXTURES[0];
  const topics: TopicTag[] = [
    'science_society',
    'philosophy_ethics',
    'ai_apple',
    'contemplation_mind',
    'german_didactics',
    'sound_synthesis',
    'health_biohacking',
    'opportunities_growth'
  ];
  const spaces = [
    'c/wissenschaft',
    'c/philosophie',
    'c/ki_tech',
    'c/kontemplation',
    'c/didaktik',
    'c/klang',
    'c/gesundheit',
    'c/chancen'
  ];
  const domains = [
    'spektrum.de',
    'zeit.de',
    'sueddeutsche.de',
    'quantamagazine.org',
    'nature.com',
    'heise.de',
    'deutschlandfunk.de',
    'faz.net',
    'theguardian.com',
    'spiegel.de'
  ];

  const topic = topics[index % topics.length];
  const space = spaces[index % spaces.length];
  const domain = domains[index % domains.length];
  const publishedAt = new Date(nowMs - (index + 1) * 45 * 60 * 1000).toISOString();

  return {
    ...base,
    id: `live-news-v15-${String(index + 1).padStart(2, '0')}`,
    title: `Aktuelle Analyse #${index + 1}: Durchbruch bei ${topic} in Europa`,
    subtitle: `Einordnung aus ${domain}`,
    feedText:
      `Substanzielle redaktionelle Analyse #${index + 1} über neue wissenschaftliche und gesellschaftliche Entwicklungen mit konkreten Daten, Einordnungen und Quellen.`,
    body:
      `Ausführlicher Analyse-Text #${index + 1} mit klarem methodischem Kontext, Datenpunkten und Gegenperspektiven aus ${domain}.`,
    articleBody:
      `### Einordnung\n\nAusführlicher Analyse-Text #${index + 1} mit klarem methodischem Kontext, Datenpunkten und Gegenperspektiven aus ${domain}.`,
    primaryTopic: topic,
    topics: [topic],
    space,
    format: index % 3 === 0 ? 'long_invitation' : 'concise_insight',
    type: index % 3 === 0 ? 'deep_dive' : 'briefing',
    contentOrigin: 'live_ingested',
    sourceTrustLevel: index % 2 === 0 ? 'deep_essay' : 'public_broadcaster',
    sourceBroadcasterName: domain,
    canonicalUrl: `https://${domain}/artikel/v15-${index + 1}`,
    publishedAt,
    firstSeenAt: publishedAt,
    publicationDateReliable: true,
    isStaticFallback: false,
    isEvergreenGem: false,
    curationScore: 8.6 - (index % 5) * 0.1,
    wordCount: 240,
    estimatedReadingMinutes: 3,
    sourceReferences: [
      {
        title: `${domain} Bericht #${index + 1}`,
        originalUrl: `https://${domain}/artikel/v15-${index + 1}`,
        publisher: domain,
        retrievalTimestamp: publishedAt,
        publicationTimestamp: publishedAt,
        isVerified: true
      }
    ]
  };
}

test('Atmen v15 — Live Deploy, Cold-Boot Freshness, PWA Viewport & Scroll/Pull UX', async (t) => {
  await t.test('1. WP1: GitHub Pages & Scheduled Newsroom Workflows use @v4 upload-pages-artifact and GEMINI_API_KEY', () => {
    const workflowFiles = [
      '.github/workflows/deploy.yml',
      '.github/workflows/scheduled-newsroom.yml'
    ];

    for (const relPath of workflowFiles) {
      const content = fs.readFileSync(path.join(ROOT_DIR, relPath), 'utf8');
      assert.ok(
        content.includes('uses: actions/upload-pages-artifact@v4'),
        `${relPath} must use actions/upload-pages-artifact@v4 (Node 24 compatible)`
      );
      assert.ok(
        content.includes('uses: actions/deploy-pages@v4'),
        `${relPath} must keep actions/deploy-pages@v4`
      );
      assert.ok(
        content.includes('uses: actions/configure-pages@v5'),
        `${relPath} must keep actions/configure-pages@v5`
      );
      assert.ok(
        !/actions\/upload-(?:pages-)?artifact@v3/.test(content),
        `${relPath} must NOT contain deprecated @v3 artifact actions`
      );
      assert.ok(
        !content.includes('@v3'),
        `${relPath} must have zero @v3 action references`
      );
      assert.ok(
        content.includes('GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}'),
        `${relPath} must pass GEMINI_API_KEY secret to npm run ingest`
      );
      assert.ok(
        content.includes('cp public/feed-snapshot.json dist/feed-snapshot.json'),
        `${relPath} must copy public/feed-snapshot.json into dist/`
      );
      assert.ok(
        content.includes('cp public/feed-reservoir.json dist/feed-reservoir.json'),
        `${relPath} must copy public/feed-reservoir.json into dist/`
      );
      assert.ok(
        content.includes('cp dist/index.html dist/404.html') && content.includes('touch dist/.nojekyll'),
        `${relPath} must emit dist/404.html and dist/.nojekyll`
      );
    }
  });

  await t.test('2. WP2: Cold-Boot Freshness bans vault-gem-* from live horizons, preserves timeless, and shields Top #1-#3 from artworks', () => {
    const nowMs = Date.now();
    const shannonItem = REAL_KNOWLEDGE_VAULT.find(
      item => item.id === 'vault-gem-004-claude-shannon-information-theory'
    );
    const parisRainArt = REAL_KNOWLEDGE_VAULT.find(
      item => item.id === 'vault-art-009-caillebotte-paris-rain'
    );

    assert.ok(shannonItem, 'REAL_KNOWLEDGE_VAULT must include Claude Shannon (1948)');
    assert.ok(parisRainArt, 'REAL_KNOWLEDGE_VAULT must include Caillebotte Paris Rain (1877) artwork');

    // Helper classifications
    assert.equal(isStaticFallbackItem(shannonItem), true);
    assert.equal(isStaticFallbackItem({ id: 'init-1', isStaticFallback: false }), true);
    assert.equal(isStaticFallbackItem({ id: 'live-news-1', isStaticFallback: true }), true);
    assert.equal(isStaticFallbackItem({ id: 'live-news-1', isStaticFallback: false }), false);

    assert.equal(isNonArtVaultItem(shannonItem), true);
    assert.equal(isNonArtVaultItem(parisRainArt), false);
    assert.equal(isArtShowcaseItem(parisRainArt), true);

    // 14-day relevance window must NOT grant a vault-* evergreen loophole to 1948 essays
    assert.equal(
      isWithin14DayRelevanceWindow(shannonItem, nowMs),
      false,
      'Claude Shannon (1948) must fail the 14-day relevance window'
    );

    const liveItems = Array.from({ length: 18 }, (_, i) => makeFreshLiveItem(i, nowMs));
    const scoredVault = REAL_KNOWLEDGE_VAULT.map(item => {
      const scored = scoreFeedItem(item, DEFAULT_USER_PROFILE, {});
      // Artificially boost vault & art items to prove guards hold even under extreme scores
      return {
        ...scored,
        score: item.id === shannonItem.id || item.id === parisRainArt.id ? 999 : scored.score + 200
      };
    });
    const scoredLive = liveItems.map(item => scoreFeedItem(item, DEFAULT_USER_PROFILE, {}));
    const mixedPool = [...scoredVault, ...scoredLive];

    // Live horizons: for_you, today, discourse, top must exclude ALL vault-gem-* essays when >= 15 real items exist
    for (const mode of ['for_you', 'today', 'discourse', 'top'] as const) {
      const result = sortFeedForDisplay(mixedPool, mode, {
        interleave: true,
        seenItemIds: new Set<string>()
      });
      const vaultGemsInMode = result.filter(item => item.id.startsWith('vault-gem-'));
      assert.equal(
        vaultGemsInMode.length,
        0,
        `Horizon "${mode}" must exclude all vault-gem-* items when >= 15 real articles exist (found: ${vaultGemsInMode.map(i => i.id).join(', ')})`
      );
      assert.ok(
        !result.some(item => item.id === shannonItem.id),
        `Claude Shannon (1948) must NEVER appear in "${mode}" when >= 15 real items exist`
      );
    }

    // Cold boot for_you: c/kunst_galerie artworks must NEVER occupy Slot #1, #2, or #3, and max 1 in Top 10
    const forYouColdBoot = sortFeedForDisplay(mixedPool, 'for_you', {
      interleave: true,
      seenItemIds: new Set<string>()
    });
    assert.ok(forYouColdBoot.length >= 10, 'for_you must return at least 10 ranked items');
    for (let slot = 0; slot < 3; slot++) {
      assert.notEqual(
        forYouColdBoot[slot].space,
        'c/kunst_galerie',
        `Cold-boot Slot #${slot + 1} must NOT be c/kunst_galerie (got ${forYouColdBoot[slot].id})`
      );
      assert.equal(
        isArtShowcaseItem(forYouColdBoot[slot]),
        false,
        `Cold-boot Slot #${slot + 1} must NOT be an art_showcase item`
      );
    }
    const artInTop10 = forYouColdBoot.slice(0, 10).filter(item => isArtShowcaseItem(item));
    assert.ok(
      artInTop10.length <= 1,
      `At most 1 artwork is allowed in Top 10 on cold boot (found ${artInTop10.length})`
    );

    // Timeless horizon MUST still allow vault-gem-* classics like Claude Shannon (1948)
    const timelessResult = sortFeedForDisplay(mixedPool, 'timeless', {
      interleave: false,
      seenItemIds: new Set<string>()
    });
    assert.ok(
      timelessResult.some(item => item.id === shannonItem.id),
      'Horizon "timeless" must keep Claude Shannon (1948) accessible'
    );

    // Offline fallback (< 15 real items): rankBloomScrollFeed must not leave the feed empty
    const offlineOnly = rankBloomScrollFeed(scoredVault.slice(0, 8), {
      seenItemIds: new Set<string>()
    });
    assert.ok(
      offlineOnly.length > 0,
      'Offline fallback (< 15 real items) must still render available vault items'
    );

    // Structural contract check on AppContext cold-boot gate & feedRepository forceRefresh
    const appContextTsx = fs.readFileSync(path.join(ROOT_DIR, 'src/core/context/AppContext.tsx'), 'utf8');
    const feedRepoTs = fs.readFileSync(path.join(ROOT_DIR, 'src/core/data/feedRepository.ts'), 'utf8');
    assert.ok(
      appContextTsx.includes('realCount < 15') &&
        appContextTsx.includes('hydrateFromPublicSnapshot') &&
        appContextTsx.includes('ensureInitialized'),
      'AppContext must await public snapshot hydration before Frame 1 on cold boot when realCount < 15'
    );
    assert.ok(
      appContextTsx.includes('{ forceRefresh: true }'),
      'AppContext refresh paths must pass { forceRefresh: true } to hydrateFromPublicSnapshot'
    );
    assert.ok(
      feedRepoTs.includes('export function isStaticFallbackItem') &&
        feedRepoTs.includes('?_t=${Date.now()}') &&
        feedRepoTs.includes('forceRefresh?: boolean'),
      'feedRepository.ts must export isStaticFallbackItem and support forceRefresh cache-busting'
    );
  });

  await t.test('3. WP4 & WP5: scrollUxController horizon visibility, pull-to-refresh thresholds & fallback top-lock unlock', () => {
    assert.equal(HORIZON_BAR_HIDE_SCROLL_Y, 72);
    assert.equal(HORIZON_BAR_TOP_LOCK_Y, 48);
    assert.equal(HORIZON_BAR_DOWN_DELTA, 10);
    assert.equal(HORIZON_BAR_UP_DELTA, 7);
    assert.equal(PULL_REFRESH_THRESHOLD, 64);
    assert.equal(PULL_REFRESH_MAX, 108);

    // Stays visible near top (<= 48px) even when scrolling down
    const nearTop = evaluateHorizonBarVisibility({
      currentY: 42,
      lastY: 10,
      contentHeight: 3000,
      viewportHeight: 800,
      currentlyVisible: true
    });
    assert.equal(nearTop.visible, true);
    assert.equal(nearTop.clampedY, 42);

    // Hides on clear down-scroll past 72px with dy > 10
    const hideOnDown = evaluateHorizonBarVisibility({
      currentY: 120,
      lastY: 95,
      contentHeight: 3000,
      viewportHeight: 800,
      currentlyVisible: true
    });
    assert.equal(hideOnDown.visible, false);
    assert.equal(hideOnDown.clampedY, 120);

    // Stays hidden within deadzone (small up wiggle dy = -4)
    const deadzoneUp = evaluateHorizonBarVisibility({
      currentY: 900,
      lastY: 904,
      contentHeight: 3000,
      viewportHeight: 800,
      currentlyVisible: false
    });
    assert.equal(deadzoneUp.visible, false);

    // Immediately reveals on up-scroll (dy < -7) anywhere deep in the feed
    const revealDeepUp = evaluateHorizonBarVisibility({
      currentY: 1580,
      lastY: 1592,
      contentHeight: 3000,
      viewportHeight: 800,
      currentlyVisible: false
    });
    assert.equal(revealDeepUp.visible, true);
    assert.equal(revealDeepUp.clampedY, 1580);

    // Top rubber-band overscroll (y < 0) clamps to 0 and stays visible
    const topBounce = evaluateHorizonBarVisibility({
      currentY: -36,
      lastY: 0,
      contentHeight: 3000,
      viewportHeight: 800,
      currentlyVisible: true
    });
    assert.equal(topBounce.clampedY, 0);
    assert.equal(topBounce.visible, true);

    // Bottom rubber-band overscroll (y > maxScroll) clamps to maxScroll and avoids spurious reveal on rebound
    const maxScroll = 3000 - 800; // 2200
    const bottomOvershoot = evaluateHorizonBarVisibility({
      currentY: maxScroll + 55,
      lastY: maxScroll,
      contentHeight: 3000,
      viewportHeight: 800,
      currentlyVisible: false
    });
    assert.equal(bottomOvershoot.clampedY, maxScroll);
    assert.equal(bottomOvershoot.visible, false);

    const bottomRebound = evaluateHorizonBarVisibility({
      currentY: maxScroll,
      lastY: maxScroll + 55,
      contentHeight: 3000,
      viewportHeight: 800,
      currentlyVisible: false
    });
    assert.equal(bottomRebound.clampedY, maxScroll);
    assert.equal(
      bottomRebound.visible,
      false,
      'Rebounding from bottom overscroll back to maxScroll must NOT flicker the horizon bar open'
    );

    // Focus-within keeps the horizon bar visible even while scrolling down
    const focusedDown = evaluateHorizonBarVisibility({
      currentY: 420,
      lastY: 300,
      contentHeight: 3000,
      viewportHeight: 800,
      currentlyVisible: true,
      hasFocusWithin: true
    });
    assert.equal(focusedDown.visible, true);

    // Pull-to-Refresh phases: idle -> pulling -> ready -> clamped max -> refreshing
    const ptrIdleZero = evaluatePullToRefreshGesture({ pullDeltaY: 0, isRefreshing: false });
    assert.equal(ptrIdleZero.phase, 'idle');
    assert.equal(ptrIdleZero.pullDistance, 0);
    assert.equal(ptrIdleZero.readyToRelease, false);

    const ptrIdleTiny = evaluatePullToRefreshGesture({ pullDeltaY: 16, isRefreshing: false });
    assert.equal(ptrIdleTiny.phase, 'idle');
    assert.equal(ptrIdleTiny.readyToRelease, false);

    const ptrPulling = evaluatePullToRefreshGesture({ pullDeltaY: 80, isRefreshing: false });
    assert.equal(ptrPulling.phase, 'pulling');
    assert.equal(ptrPulling.readyToRelease, false);
    assert.ok(ptrPulling.pullDistance >= 10 && ptrPulling.pullDistance < PULL_REFRESH_THRESHOLD);
    assert.ok(ptrPulling.progress > 0 && ptrPulling.progress < 1);

    const ptrReady = evaluatePullToRefreshGesture({ pullDeltaY: 140, isRefreshing: false });
    assert.equal(ptrReady.phase, 'ready');
    assert.equal(ptrReady.readyToRelease, true);
    assert.equal(ptrReady.progress, 1);
    assert.ok(ptrReady.pullDistance >= PULL_REFRESH_THRESHOLD && ptrReady.pullDistance <= PULL_REFRESH_MAX);

    const ptrClamped = evaluatePullToRefreshGesture({ pullDeltaY: 400, isRefreshing: false });
    assert.equal(ptrClamped.pullDistance, PULL_REFRESH_MAX);
    assert.equal(ptrClamped.phase, 'ready');

    const ptrRefreshing = evaluatePullToRefreshGesture({ pullDeltaY: 0, isRefreshing: true });
    assert.equal(ptrRefreshing.phase, 'refreshing');
    assert.equal(ptrRefreshing.readyToRelease, false);
    assert.equal(ptrRefreshing.progress, 1);
    assert.equal(ptrRefreshing.pullDistance, PULL_REFRESH_THRESHOLD);

    // shouldUnlockFallbackTopLock: unlocks vault-* / init-* when >= 10 real items arrive
    const realPool12 = Array.from({ length: 12 }, (_, idx) => ({
      id: `live-news-${idx + 1}`,
      isStaticFallback: false
    }));
    const realPool5 = realPool12.slice(0, 5);

    assert.equal(
      shouldUnlockFallbackTopLock(['vault-gem-004-claude-shannon-information-theory', 'live-news-1'], realPool12),
      true,
      'Must unlock when lockedIds contain vault-* and >= 10 real items arrive'
    );
    assert.equal(
      shouldUnlockFallbackTopLock(['init-001'], realPool12),
      true,
      'Must unlock when lockedIds contain init-* and >= 10 real items arrive'
    );
    assert.equal(
      shouldUnlockFallbackTopLock(['live-news-1', 'live-news-2'], realPool12),
      false,
      'Must NOT unlock when lockedIds only contain real live items'
    );
    assert.equal(
      shouldUnlockFallbackTopLock(['vault-gem-004-claude-shannon-information-theory'], realPool5),
      false,
      'Must NOT unlock when fewer than 10 real items exist in candidatePool'
    );

    // Verify FeedScreen & PullToRefreshIndicator integration wiring
    const feedScreenTsx = fs.readFileSync(path.join(ROOT_DIR, 'src/features/feed/FeedScreen.tsx'), 'utf8');
    const ptrComponentTsx = fs.readFileSync(path.join(ROOT_DIR, 'src/ui/components/PullToRefreshIndicator.tsx'), 'utf8');
    assert.ok(
      feedScreenTsx.includes('evaluateHorizonBarVisibility') &&
        feedScreenTsx.includes('evaluatePullToRefreshGesture') &&
        feedScreenTsx.includes('shouldUnlockFallbackTopLock') &&
        feedScreenTsx.includes('<PullToRefreshIndicator') &&
        feedScreenTsx.includes('{ forceRefresh: true }'),
      'FeedScreen.tsx must wire scrollUxController, PullToRefreshIndicator, and forceRefresh pull reload'
    );
    assert.ok(
      ptrComponentTsx.includes('accessibilityRole="button"') &&
        ptrComponentTsx.includes('minHeight: 44') &&
        ptrComponentTsx.includes('Loslassen zum Neu-Laden'),
      'PullToRefreshIndicator.tsx must render an accessible >=44px clickable release/reload pill'
    );
  });

  await t.test('4. WP3: iOS/iPadOS standalone PWA viewport height sync, safe-area padding & iPad landscape tab bar', () => {
    const indexHtml = fs.readFileSync(path.join(ROOT_DIR, 'public/index.html'), 'utf8');
    const appTsx = fs.readFileSync(path.join(ROOT_DIR, 'App.tsx'), 'utf8');

    assert.ok(
      indexHtml.includes('function syncStandaloneViewportHeight()') &&
        indexHtml.includes("docEl.style.setProperty('--app-height'") &&
        indexHtml.includes("docEl.setAttribute('data-standalone-viewport', 'expanded')") &&
        indexHtml.includes('var(--app-height, 100dvh)'),
      'public/index.html must sync --app-height for standalone iOS/iPadOS PWA viewports'
    );
    assert.ok(
      indexHtml.includes('expectedScreenWidth * 0.9') && indexHtml.includes('heightDelta <= 120'),
      'public/index.html viewport sync must guard against iPad Split View and soft keyboard'
    );
    assert.ok(
      indexHtml.includes('scroll-padding-bottom'),
      'public/index.html must include scroll-padding-bottom on html'
    );
    assert.ok(
      !appTsx.includes('isStandaloneIosPwa ? 28'),
      'App.tsx must NOT use the old isStandaloneIosPwa ? 28 double-gap bottom padding'
    );
    assert.ok(
      appTsx.includes(
        'paddingBottom: isStandaloneIosPwa ? (insets.bottom > 0 ? Math.min(insets.bottom, 20) : 16) : Math.max(insets.bottom, 10)'
      ),
      'App.tsx must apply numeric safe-area bottom padding without double-gap'
    );
    assert.ok(
      appTsx.includes('const isDesktop = width >= 960 && !isStandaloneIosPwa;'),
      'App.tsx must preserve bottom tab bar in iPad standalone landscape (!isStandaloneIosPwa)'
    );
  });
});
