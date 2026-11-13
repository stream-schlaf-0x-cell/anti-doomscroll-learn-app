import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import { AtemStorage, MemoryStorageDriver } from '../src/core/data/storage';
import { SAVED_ARTICLES_STORAGE_KEY } from '../src/core/data/libraryRepository';
import { INITIAL_FIXTURES, DEFAULT_USER_PROFILE } from '../src/core/data/fixtures';
import { runInPlaceDataMigration } from '../src/core/data/migrationService';
import { mergeSyncSnapshots, AtmenSyncSnapshot } from '../src/core/sync/cloudSyncService';
import {
  buildShowcaseStarterTracks,
  generateHivemindLearningTrack,
  HIVEMIND_TRACKS_STORAGE_KEY,
  SHOWCASE_STARTER_TRACK_IDS
} from '../src/core/learning/hivemindLearningService';
import {
  evaluateArrivalsBannerVisibility,
  INITIAL_ARRIVALS_BANNER_STATE,
  ARRIVALS_BANNER_MIN_SCROLL_Y,
  ARRIVALS_BANNER_AUTO_HIDE_DELTA_Y,
  formatRelativeTime
} from '../src/core/feed/feedPresentation';
import {
  sortFeedForDisplay,
  scoreFeedItem,
  enforceCuratedStreamDiversity,
  isArtShowcaseItem
} from '../src/core/domain/ranking';

const ROOT_DIR = path.resolve(__dirname, '..');

describe('Masterplan 5-Steps Verification Suite', () => {
  it('1. Step 1: iPad PWA allows landscape orientation and preserves flex scroll containers', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'public/manifest.json'), 'utf8'));
    assert.equal(manifest.orientation, 'any', 'manifest.json must allow orientation: any for iPad landscape');

    const indexHtml = fs.readFileSync(path.join(ROOT_DIR, 'public/index.html'), 'utf8');
    assert.ok(indexHtml.includes('flex-direction: column'), 'index.html #root must be flex column');
    assert.ok(indexHtml.includes('min-height: 0'), 'index.html #root must set min-height: 0');
    assert.ok(indexHtml.includes('-webkit-overflow-scrolling: touch'), 'index.html must enable iOS touch scrolling');

    const feedScreen = fs.readFileSync(path.join(ROOT_DIR, 'src/features/feed/FeedScreen.tsx'), 'utf8');
    assert.ok(feedScreen.includes("alignItems: 'stretch'"), 'FeedScreen desktopLayoutWrapper must stretch to bound height');
    assert.ok(feedScreen.includes('minHeight: 0'), 'FeedScreen must set minHeight: 0 on nested scroll columns');

    const appTsx = fs.readFileSync(path.join(ROOT_DIR, 'App.tsx'), 'utf8');
    assert.ok(appTsx.includes('minHeight: 0'), 'App.tsx screen containers must constrain minHeight: 0');
  });

  it('2. Step 2: Heute channel stays alive offline via 48h/7d fallback while preserving strict today priority & excluding Hivemind', () => {
    const now = Date.now();
    const hourMs = 3600 * 1000;

    // Older 36h article + 4-day article + evergreen vault item + art item when NO <18h item is available
    const item36h = {
      ...INITIAL_FIXTURES[0],
      id: 'today-fallback-36h',
      title: 'Aktueller europäischer Bildungsbericht vorgestellt',
      publishedAt: new Date(now - 36 * hourMs).toISOString(),
      publicationDateReliable: true,
      isEvergreenGem: false,
      format: 'sourced_update' as const,
      hivemindMeta: undefined,
      memeMeta: undefined
    };
    const evergreen = {
      ...INITIAL_FIXTURES[0],
      id: 'evergreen-should-stay-out-of-today',
      title: 'Zeitlose Philosophie',
      publishedAt: new Date(now - 2 * hourMs).toISOString(),
      isEvergreenGem: true,
      hivemindMeta: undefined,
      memeMeta: undefined
    };

    const olderScored = [item36h, evergreen].map(i => scoreFeedItem(i, DEFAULT_USER_PROFILE, {}));
    const todayFallback = sortFeedForDisplay(olderScored, 'today');
    assert.equal(todayFallback.length, 1, 'Heute must fall back to 48h/7d recent news instead of going empty');
    assert.equal(todayFallback[0].id, 'today-fallback-36h');

    // Verify FeedScreen wires ContinuousLiveNewsService + dedicated Heute empty state
    const feedScreen = fs.readFileSync(path.join(ROOT_DIR, 'src/features/feed/FeedScreen.tsx'), 'utf8');
    assert.ok(feedScreen.includes('ContinuousLiveNewsService.subscribe'), 'FeedScreen must subscribe to live news');
    assert.ok(feedScreen.includes('ContinuousLiveNewsService.refreshLiveFeeds'), 'FeedScreen must auto-refresh live news on Heute');
    assert.ok(feedScreen.includes('Heute • Aktuelle Tagesmeldungen'), 'FeedScreen must show Heute-specific empty UI');
  });

  it('3. Step 3: Rome & Quantum demo tracks are empty and unconditionally purged across storage & sync', async () => {
    assert.equal(buildShowcaseStarterTracks().length, 0);

    const sample = await generateHivemindLearningTrack({
      titleOrTopic: 'Sokrates Dialoge',
      sourceType: 'topic',
      rawText: 'Mäeutik, Aporie und prüfendes Fragen in Platons frühen Dialogen.',
      cardCount: 10
    });

    const storage = new AtemStorage(new MemoryStorageDriver());
    const legacySavedRome = {
      ...sample.items[0],
      id: 'hivemind-track-roman-republic-empire-step-1',
      title: 'Gründung Roms & Republik'
    };
    const normalSavedArticle = {
      ...INITIAL_FIXTURES[0],
      id: 'user-kept-article-1',
      title: 'Normaler Artikel bleiben behalten'
    };

    await storage.setItem(
      SAVED_ARTICLES_STORAGE_KEY,
      JSON.stringify([legacySavedRome, normalSavedArticle])
    );
    await storage.setItem(
      HIVEMIND_TRACKS_STORAGE_KEY,
      JSON.stringify([{ ...sample, id: 'track-roman-republic-empire' }])
    );

    await runInPlaceDataMigration(storage);

    const savedAfter = JSON.parse((await storage.getItem(SAVED_ARTICLES_STORAGE_KEY)) || '[]');
    assert.equal(savedAfter.length, 1, 'Migration must unconditionally purge legacy Rome saved card');
    assert.equal(savedAfter[0].id, 'user-kept-article-1');

    // Cloud Sync must strip Rome/Quantum saved articles and include showcase IDs as tombstones
    const localSnap: AtmenSyncSnapshot = {
      version: 1,
      deviceId: 'dev-a',
      updatedAt: '2026-11-13T10:00:00.000Z',
      savedArticles: [legacySavedRome, normalSavedArticle]
    };
    const remoteSnap: AtmenSyncSnapshot = {
      version: 1,
      deviceId: 'dev-b',
      updatedAt: '2026-11-13T11:00:00.000Z',
      savedArticles: [legacySavedRome]
    };
    const merged = mergeSyncSnapshots(localSnap, remoteSnap);
    assert.equal(merged.savedArticles?.some(i => i.id.includes('roman')), false);
    for (const demoId of SHOWCASE_STARTER_TRACK_IDS) {
      assert.ok(merged.deletedHivemindTrackIds?.includes(demoId));
    }
  });

  it('4. Step 4: Quiet scroll-sensitive arrivals badge hides at top, reveals in reading zone, auto-hides & resets', () => {
    let state = INITIAL_ARRIVALS_BANNER_STATE;

    // Hidden near top even with 5 pending items
    state = evaluateArrivalsBannerVisibility(state, 5, 0);
    assert.equal(state.isVisible, false);
    state = evaluateArrivalsBannerVisibility(state, 5, ARRIVALS_BANNER_MIN_SCROLL_Y - 20);
    assert.equal(state.isVisible, false);

    // Appears softly once scrolled into reading zone
    state = evaluateArrivalsBannerVisibility(state, 5, ARRIVALS_BANNER_MIN_SCROLL_Y);
    assert.equal(state.isVisible, true);
    assert.equal(state.anchorScrollY, ARRIVALS_BANNER_MIN_SCROLL_Y);

    // Automatically hides after continued deeper scrolling
    state = evaluateArrivalsBannerVisibility(
      state,
      5,
      ARRIVALS_BANNER_MIN_SCROLL_Y + ARRIVALS_BANNER_AUTO_HIDE_DELTA_Y
    );
    assert.equal(state.isVisible, false);

    // Stays hidden for same 5 pending items when scrolling further
    state = evaluateArrivalsBannerVisibility(state, 5, 1800);
    assert.equal(state.isVisible, false);

    // Clears cleanly when tapped (pending -> 0)
    state = evaluateArrivalsBannerVisibility(state, 0, 0);
    assert.deepEqual(state, INITIAL_ARRIVALS_BANNER_STATE);
  });

  it('5. Step 5: Relative time handles month boundary accurately, snapshots define spaces, and artworks do not cluster', () => {
    const nov13 = new Date('2026-11-13T12:00:00.000Z');
    // Same day-of-month (12th) one month earlier must NEVER display 'gestern'
    const oct12Label = formatRelativeTime('2026-10-12T12:00:00.000Z', nov13);
    assert.notEqual(oct12Label, 'gestern');

    const nov12Label = formatRelativeTime('2026-11-12T12:00:00.000Z', nov13);
    assert.equal(nov12Label, 'gestern');

    // Snapshot hygiene: every item in pipeline-output.json and public/feed-snapshot.json has an explicit space
    const pubSnap = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'public/feed-snapshot.json'), 'utf8'));
    for (const item of pubSnap.items) {
      assert.ok(item.space && String(item.space).startsWith('c/'), `Item ${item.id} must define an explicit space`);
    }
    const pipeItems = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'src/core/data/pipeline-output.json'), 'utf8'));
    for (const item of pipeItems) {
      assert.ok(item.space && String(item.space).startsWith('c/'), `Pipeline item ${item.id} must define an explicit space`);
    }

    // Artworks in mixed stream never cluster next to each other
    const diverse = enforceCuratedStreamDiversity(pubSnap.items);
    for (let idx = 1; idx < Math.min(20, diverse.length); idx++) {
      assert.equal(
        isArtShowcaseItem(diverse[idx]) && isArtShowcaseItem(diverse[idx - 1]),
        false,
        `Mixed stream must never show consecutive art items at index ${idx}`
      );
    }
  });
});
