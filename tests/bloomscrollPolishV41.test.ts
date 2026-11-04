import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { INITIAL_FIXTURES } from '../src/core/data/fixtures';
import {
  cleanArticleBodyFormatting,
  sanitizeCuratedFeedItem
} from '../src/core/enrichment/batchEnricher';
import {
  CloudSyncService,
  mergeSyncSnapshots,
  AtmenSyncSnapshot
} from '../src/core/sync/cloudSyncService';
import { AtemStorage, MemoryStorageDriver } from '../src/core/data/storage';
import { atmenAiClient, saveAiCredentials, loadAiCredentials } from '../src/core/ai/atmenAiClient';
import { FeedItemSchema, FeedItem } from '../src/core/domain/types';

test('Bloomscroll Polish V4.1 — Eliminate the 8 Live iPhone Stumbling Blocks', async (t) => {
  const rootDir = path.resolve(__dirname, '..');

  await t.test('1. Work Package 1: Fix iOS PWA Bottom Gap in public/index.html & App.tsx', () => {
    const indexHtml = fs.readFileSync(path.join(rootDir, 'public/index.html'), 'utf8');
    assert.ok(
      !indexHtml.includes('-webkit-fill-available'),
      'public/index.html must NOT contain -webkit-fill-available because it clips above iOS home indicator'
    );
    assert.ok(
      indexHtml.includes('background-color: #0E1424 !important'),
      'public/index.html must set background-color: #0E1424 !important on html, body, and #root'
    );
    assert.ok(
      indexHtml.includes('min-height: 100dvh'),
      'public/index.html must use min-height: 100dvh'
    );
    assert.ok(
      indexHtml.includes('overflow: hidden'),
      'public/index.html must set overflow: hidden on html/body'
    );

    const appTsx = fs.readFileSync(path.join(rootDir, 'App.tsx'), 'utf8');
    assert.ok(
      !appTsx.includes('calc(env(safe-area-inset-bottom'),
      'App.tsx tabBar must not use invalid string calc(...) for react-native-web paddingBottom'
    );
    assert.ok(
      appTsx.includes('isStandaloneIosPwa'),
      'App.tsx must detect isStandaloneIosPwa'
    );
    assert.ok(
      appTsx.includes('isStandaloneIosPwa ? 28 : Math.max(insets.bottom, 12)'),
      'App.tsx must pass numeric paddingBottom to tabBar'
    );
  });

  await t.test('2. Work Package 2: Escapable Fullscreen Image Lightbox in FeedCard & ReaderScreen', () => {
    const feedCardTsx = fs.readFileSync(path.join(rootDir, 'src/ui/components/FeedCard.tsx'), 'utf8');
    const readerScreenTsx = fs.readFileSync(path.join(rootDir, 'src/features/reader/ReaderScreen.tsx'), 'utf8');

    for (const [name, content] of [['FeedCard.tsx', feedCardTsx], ['ReaderScreen.tsx', readerScreenTsx]] as const) {
      assert.ok(
        content.includes("e.key === 'Escape'"),
        `${name} must listen for Escape key on web to close image lightbox`
      );
      assert.ok(
        content.includes('✕ Vollbild schließen'),
        `${name} must render reachable bottom close button "✕ Vollbild schließen"`
      );
      assert.ok(
        content.includes('✕ Schließen'),
        `${name} must render top close pill "✕ Schließen"`
      );
    }
  });

  await t.test('3. Work Package 3: Arrivals Banner Timing, Instant Reset & ✨ Neu Badges', () => {
    // Schema check for isNewlyArrived
    const baseItem = INITIAL_FIXTURES[0];
    const itemData = {
      ...baseItem,
      id: 'test-neu-item-1',
      isNewlyArrived: true,
      pinnedManualRunAt: Date.now()
    };
    const parsed = FeedItemSchema.safeParse(itemData);
    assert.ok(parsed.success, 'FeedItemSchema must accept isNewlyArrived and pinnedManualRunAt');
    assert.equal(parsed.data.isNewlyArrived, true);

    const feedScreenTsx = fs.readFileSync(path.join(rootDir, 'src/features/feed/FeedScreen.tsx'), 'utf8');
    assert.ok(
      feedScreenTsx.includes('appMountedAtRef'),
      'FeedScreen must track appMountedAtRef to suppress arrivals banner during boot window'
    );
    assert.ok(
      feedScreenTsx.includes('@atem:surfaced_arrival_ids:v1'),
      'FeedScreen must persist surfaced arrival IDs to prevent repeated daily arrivals popups'
    );
    assert.ok(
      feedScreenTsx.includes('lockedTopItemIdsRef.current = [];') ||
      feedScreenTsx.includes('lockedTopItemIdsRef.current ='),
      'FeedScreen must reset lockedTopItemIdsRef on reveal'
    );

    const feedCardTsx = fs.readFileSync(path.join(rootDir, 'src/ui/components/FeedCard.tsx'), 'utf8');
    assert.ok(
      feedCardTsx.includes('✨ Neu'),
      'FeedCard must render subtle "✨ Neu" badge for freshly arrived items'
    );
  });

  await t.test('4. Work Package 4: Reliable API Key Cloud Sync & iOS Clipboard Fallback', async () => {
    const memory = new MemoryStorageDriver();
    const storage = new AtemStorage(memory);

    // Save test API keys
    await saveAiCredentials(
      {
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        apiKey: 'AIzaSyTestKey123456789',
        persistApiKey: true
      },
      storage
    );

    const creds = await loadAiCredentials(storage);
    assert.equal(creds.apiKey, 'AIzaSyTestKey123456789');

    // Test buildLocalSnapshot includes credentials
    const syncService = new CloudSyncService(storage);
    const snapshot = await syncService.buildLocalSnapshot();
    assert.ok(snapshot.aiCredentials, 'Local sync snapshot must bundle aiCredentials');
    assert.equal(snapshot.aiCredentials?.geminiApiKey, 'AIzaSyTestKey123456789');
    assert.equal(snapshot.aiCredentials?.preferredProvider, 'gemini');

    // Test mergeSyncSnapshots does not overwrite non-empty remote keys with empty local keys
    const emptyLocalSnapshot: AtmenSyncSnapshot = {
      version: 1,
      updatedAt: '2026-11-04T12:00:00.000Z',
      deviceId: 'iphone-empty',
      aiCredentials: {
        geminiApiKey: '',
        openRouterApiKey: '',
        preferredProvider: 'gemini',
        selectedGeminiModelId: 'gemini-2.5-flash'
      }
    };
    const richRemoteSnapshot: AtmenSyncSnapshot = {
      version: 1,
      updatedAt: '2026-11-04T11:50:00.000Z',
      deviceId: 'mac-primary',
      aiCredentials: {
        geminiApiKey: 'AIzaSyRemoteKey987654321',
        openRouterApiKey: 'sk-or-v1-test',
        preferredProvider: 'gemini',
        selectedGeminiModelId: 'gemini-2.5-flash'
      }
    };

    const merged = mergeSyncSnapshots(emptyLocalSnapshot, richRemoteSnapshot);
    assert.equal(
      merged.aiCredentials?.geminiApiKey,
      'AIzaSyRemoteKey987654321',
      'Merging empty local snapshot with rich remote snapshot must preserve remote Gemini API key'
    );
    assert.equal(
      merged.aiCredentials?.openRouterApiKey,
      'sk-or-v1-test',
      'Merging empty local snapshot with rich remote snapshot must preserve remote OpenRouter API key'
    );

    // Test craftExport copyToClipboard has execCommand fallback
    const craftExportTs = fs.readFileSync(path.join(rootDir, 'src/core/export/craftExport.ts'), 'utf8');
    assert.ok(
      craftExportTs.includes("execCommand('copy')"),
      'copyToClipboard must contain execCommand fallback for iOS Safari PWA'
    );
  });

  await t.test('5. Work Package 5: Guardian/Podcast Boilerplate Stripper & Political Re-routing', () => {
    // Test boilerplate stripping
    const rawGuardianBoilerplate = `By Philip Oltermann. Read by Sam Peter Jackson \n\n Read the text version here \n\n Support the Guardian today: theguardian.com/longreadpod \n Continue reading...`;
    const cleaned = cleanArticleBodyFormatting(rawGuardianBoilerplate);
    assert.ok(!cleaned.includes('By Philip Oltermann'), 'Must strip author spoken-by line');
    assert.ok(!cleaned.includes('Read by Sam Peter Jackson'), 'Must strip reader spoken-by line');
    assert.ok(!cleaned.includes('Read the text version here'), 'Must strip read text version link');
    assert.ok(!cleaned.includes('Support the Guardian today'), 'Must strip support guardian line');
    assert.ok(!cleaned.includes('theguardian.com/longreadpod'), 'Must strip podcast URL');
    assert.ok(!cleaned.includes('Continue reading...'), 'Must strip continue reading stub');

    // Test Robert Habeck item sanitization & re-routing away from c/books
    const rawHabeckItem: FeedItem = {
      ...INITIAL_FIXTURES[0],
      id: 'guardian-habeck-trials',
      title: "From the archive: The trials of Robert Habeck: is the world's most powerful green politician doomed to fail? – podcast",
      feedText: rawGuardianBoilerplate,
      primaryTopic: 'book_mastery',
      space: 'c/books',
      publishedAt: '2026-11-04T10:00:00.000Z',
      estimatedReadingMinutes: 8,
      sourceReferences: [
        {
          publisher: 'The Guardian Long Read',
          originalUrl: 'https://www.theguardian.com/news/audio/2023/may/26/the-trials-of-robert-habeck-podcast',
          title: "The trials of Robert Habeck",
          retrievalTimestamp: '2026-11-04T10:00:00.000Z',
          isVerified: true
        }
      ]
    };

    const sanitized = sanitizeCuratedFeedItem(rawHabeckItem);
    assert.ok(!sanitized.title.startsWith('From the archive:'), 'Must strip "From the archive:" prefix');
    assert.ok(!sanitized.title.includes('– podcast'), 'Must strip "– podcast" suffix');
    assert.notEqual(sanitized.space, 'c/books', 'Political article must never be in c/books');
    assert.notEqual(sanitized.primaryTopic, 'book_mastery', 'Political article must never be in book_mastery');
    assert.equal(sanitized.space, 'c/dialektik', 'Political article must be routed to c/dialektik');
    assert.equal(sanitized.primaryTopic, 'philosophy_ethics', 'Political article must be routed to philosophy_ethics');
    assert.ok(sanitized.feedText.length >= 140, 'Must synthesize substantive analytical summary for short stub');

    // Verify snapshot file
    const snapshotPath = path.join(rootDir, 'public/feed-snapshot.json');
    if (fs.existsSync(snapshotPath)) {
      const parsedSnapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
      const snapshotItems: FeedItem[] = Array.isArray(parsedSnapshot) ? parsedSnapshot : (parsedSnapshot.items || []);
      const habeckInSnapshot = snapshotItems.find(i => i.id === 'fc-the-guardian-longreads-robert-habeck');
      if (habeckInSnapshot) {
        assert.equal(habeckInSnapshot.space, 'c/dialektik', 'Habeck in feed-snapshot.json must be in c/dialektik');
        assert.ok(!habeckInSnapshot.feedText.includes('Read by Sam Peter Jackson'), 'Habeck text must be clean');
      }
    }
  });

  await t.test('6. Work Package 6: Tabbed Mobile Settings & Neutral AI Studio', () => {
    // Neutral AI Studio checks
    const ultraMasterTsx = fs.readFileSync(path.join(rootDir, 'src/ui/components/UltraMasterModal.tsx'), 'utf8');
    assert.ok(
      !ultraMasterTsx.includes('z.B. Buddhismus'),
      'UltraMasterModal must not use hardcoded Buddhismus placeholder'
    );
    assert.ok(
      !ultraMasterTsx.includes('c/buddhismus'),
      'UltraMasterModal must not use hardcoded c/buddhismus placeholder'
    );

    const subchannelAssistantTs = fs.readFileSync(path.join(rootDir, 'src/core/studio/subchannelAssistant.ts'), 'utf8');
    assert.ok(
      !subchannelAssistantTs.includes('c/buddhismus'),
      'subchannelAssistant must not hardcode c/buddhismus in AI prompt example'
    );

    // Settings screen tabbed layout checks
    const settingsTsx = fs.readFileSync(path.join(rootDir, 'src/features/settings/SettingsScreen.tsx'), 'utf8');
    assert.ok(
      settingsTsx.includes("activeSubTab === 'ai_sync'"),
      'SettingsScreen must support ai_sync subtab'
    );
    assert.ok(
      settingsTsx.includes("activeSubTab === 'appearance'"),
      'SettingsScreen must support appearance subtab'
    );
    assert.ok(
      settingsTsx.includes("activeSubTab === 'focus'"),
      'SettingsScreen must support focus subtab'
    );
    assert.ok(
      settingsTsx.includes("activeSubTab === 'data'"),
      'SettingsScreen must support data subtab'
    );
    assert.ok(
      settingsTsx.includes('subTabBarContainer'),
      'SettingsScreen must render subTabBarContainer'
    );
    assert.ok(
      settingsTsx.includes('hasAiConfiguration(aiCreds) ?'),
      'SettingsScreen must display AI configuration status badge'
    );
  });
});
