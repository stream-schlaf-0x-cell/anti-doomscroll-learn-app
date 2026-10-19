import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  FeedItem,
  FeedItemSchema,
  UserProfileSchema
} from '../src/core/domain/types';
import {
  scoreFeedItem,
  sortFeedForDisplay
} from '../src/core/domain/ranking';
import {
  SpaceRepository,
  normalizeSpaceHandle
} from '../src/core/spaces/spaceRepository';
import { prependRevealedItems } from '../src/core/feed/feedPresentation';
import { BackupService } from '../src/core/data/backupService';
import { AtemStorage, MemoryStorageDriver } from '../src/core/data/storage';
import { MEME_VAULT_ENTRIES } from '../src/core/data/memeVaultEntries';
import { evaluateSignalVsNoiseDeterministically } from '../src/core/enrichment/batchEnricher';
import { callAiModel } from '../src/core/ai/atmenAiClient';
import { EnrichmentUsageLedger } from '../src/core/enrichment/ledger';
import { DEFAULT_USER_PROFILE } from '../src/core/data/fixtures';

function makeMockItem(overrides: Partial<FeedItem> = {}): FeedItem {
  return FeedItemSchema.parse({
    id: `item-${Math.random().toString(36).slice(2, 8)}`,
    type: 'deep_dive',
    format: 'sourced_update',
    title: 'Wissenschaftlicher Erkenntnisfortschritt',
    subtitle: 'Wichtige Einsicht',
    feedText: 'Detaillierter Text für die Karte zur Verifikation.',
    body: 'Ausführlicher Inhalt für den Reader.',
    topics: ['science_society'],
    primaryTopic: 'science_society',
    publishedAt: '2026-10-18T12:00:00.000Z',
    generatedAt: '2026-10-18T12:05:00.000Z',
    estimatedReadingMinutes: 4,
    relevanceExplanation: 'Relevanz',
    contentStatus: 'scientific_analysis',
    isDailyEdition: true,
    editionDate: '2026-10-18',
    isDemonstration: false,
    aiAssisted: false,
    factReviewStatus: 'scientific_paper',
    provenanceSummary: 'Peer-reviewed Quelle',
    wordCount: 400,
    evidenceTier: 'multiple_sources',
    contentOrigin: 'live_ingested',
    contentHash: 'hash-abc',
    canonicalUrl: 'https://example.org/study-1',
    space: 'c/serendipity',
    sourceReferences: [],
    sourceTrustLevel: 'peer_reviewed',
    isTeachingRelated: false,
    isChallengingPerspective: false,
    upvotesCount: 0,
    comments: [],
    ...overrides
  });
}

describe('Masterprompt v2.0 User Feedback & Acceptance Suite', () => {

  // --------------------------------------------------------------------------
  // Pillar 1: Honest Timestamps & Chronological Sorting
  // --------------------------------------------------------------------------
  describe('Pillar 1: Honest Timestamps & Sorting (Neueste, Hot, Top, Gems)', () => {
    it('Neueste strictly places verified recent dates above undated timeless memes and classics', () => {
      const genuineRecent = makeMockItem({
        id: 'news-recent-1',
        title: 'Echte aktuelle Eilmeldung',
        publishedAt: '2026-10-19T08:00:00.000Z',
        publicationDateReliable: true
      });

      const genuineOlder = makeMockItem({
        id: 'news-older-2',
        title: 'Echte Meldung von gestern',
        publishedAt: '2026-10-18T08:00:00.000Z',
        publicationDateReliable: true
      });

      const timelessMeme = makeMockItem({
        id: 'meme-timeless-3',
        title: 'This is Fine Meme Classic',
        format: 'meme',
        publishedAt: '1900-01-01T00:00:00.000Z',
        publicationDateReliable: false,
        historicalYearOrEra: 'Meme-Klassiker · 2013'
      });

      const undatedArt = makeMockItem({
        id: 'art-undated-4',
        title: 'Caspar David Friedrich - Wanderer über dem Nebelmeer',
        format: 'art_showcase',
        publishedAt: '1818-01-01T00:00:00.000Z',
        publicationDateReliable: false,
        historicalYearOrEra: 'Werk von 1818'
      });

      const dummyProfile = DEFAULT_USER_PROFILE;
      const scored = [timelessMeme, genuineOlder, undatedArt, genuineRecent].map(item =>
        scoreFeedItem(item, dummyProfile, {})
      );

      const sortedNew = sortFeedForDisplay(scored, 'new');
      assert.equal(sortedNew[0].id, 'news-recent-1', 'Most recent verified item must be at index 0');
      assert.equal(sortedNew[1].id, 'news-older-2', 'Older verified item must be at index 1');
      assert.ok(
        sortedNew[2].id === 'meme-timeless-3' || sortedNew[2].id === 'art-undated-4',
        'Timeless and undated items must be ranked after verified recent news'
      );
      assert.ok(
        sortedNew[3].id === 'meme-timeless-3' || sortedNew[3].id === 'art-undated-4',
        'Timeless and undated items must be ranked after verified recent news'
      );
    });

    it('Schema preserves publicationDateReliable, firstSeenAt, and historicalYearOrEra', () => {
      const item = makeMockItem({
        publicationDateReliable: false,
        firstSeenAt: '2026-10-01T10:00:00.000Z',
        historicalYearOrEra: 'Klassiker · 2013'
      });

      assert.equal(item.publicationDateReliable, false);
      assert.equal(item.firstSeenAt, '2026-10-01T10:00:00.000Z');
      assert.equal(item.historicalYearOrEra, 'Klassiker · 2013');
    });
  });

  // --------------------------------------------------------------------------
  // Pillar 2: 1:1 Banner Promise & Prepending Revealed Items
  // --------------------------------------------------------------------------
  describe('Pillar 2: 1:1 Banner Promise & Revealed Items Insertion', () => {
    it('prependRevealedItems guarantees revealed items appear at index 0 without duplicates', () => {
      const existingItems = [
        { id: 'item-1', title: 'Erster alter Beitrag' },
        { id: 'item-2', title: 'Zweiter alter Beitrag' }
      ];

      const newRevealed = [
        { id: 'item-new-1', title: 'Neu eingetroffene Meldung 1' },
        { id: 'item-new-2', title: 'Neu eingetroffene Meldung 2' }
      ];

      const result = prependRevealedItems(existingItems, newRevealed);

      assert.equal(result.length, 4);
      assert.equal(result[0].id, 'item-new-1', 'First revealed item must be at position 0');
      assert.equal(result[1].id, 'item-new-2', 'Second revealed item must be at position 1');
      assert.equal(result[2].id, 'item-1');
      assert.equal(result[3].id, 'item-2');

      // Idempotency check: if an item is already present, it is not duplicated
      const duplicateTest = prependRevealedItems(existingItems, [{ id: 'item-1', title: 'Duplikat' }]);
      assert.equal(duplicateTest.length, 2);
      assert.equal(duplicateTest[0].id, 'item-1');
    });
  });

  // --------------------------------------------------------------------------
  // Pillar 3: Space Persistence & iPad Normalization
  // --------------------------------------------------------------------------
  describe('Pillar 3: iPad Channel Persistence & Clean Isolation', () => {
    it('normalizeSpaceHandle deterministically formats handles and strips invalid symbols', () => {
      assert.equal(normalizeSpaceHandle('visible_learning'), 'c/visible_learning');
      assert.equal(normalizeSpaceHandle('c/visible_learning'), 'c/visible_learning');
      assert.equal(normalizeSpaceHandle('  Visible Learning!  '), 'c/visible_learning');
      assert.equal(normalizeSpaceHandle('c/AI & Philosophy 2026'), 'c/ai_philosophy_2026');
      assert.equal(normalizeSpaceHandle(''), 'c/channel');
    });

    it('SpaceRepository safely creates, verifies storage write, and notifies subscribers', async () => {
      const storage = new AtemStorage(new MemoryStorageDriver());
      const repo = new SpaceRepository(storage);

      let notifiedCount = 0;
      const unsubscribe = repo.subscribe(() => {
        notifiedCount++;
      });

      const created = await repo.createSubchannel({
        title: 'Visible Learning',
        handle: 'visible_learning',
        description: 'Empirische Bildungsforschung nach Hattie',
        icon: 'school-outline',
        flair: 'Didaktik',
        primaryTopic: 'german_didactics',
        accentColor: '#4D947A'
      });

      assert.equal(created.handle, 'c/visible_learning');
      assert.equal(created.isCustom, true);
      assert.ok(notifiedCount >= 1, 'Subscriber should be notified upon space creation');

      // Verify read-back from storage
      const allSpaces = await repo.getAllSpaces();
      const found = allSpaces.find(s => s.handle === 'c/visible_learning');
      assert.ok(found, 'Created space must be found in stored spaces list');
      assert.equal(found.title, 'Visible Learning');

      unsubscribe();
    });

    it('BackupService exports custom spaces and restores them correctly', async () => {
      const storage = new AtemStorage(new MemoryStorageDriver());

      // Prepare profile and custom space in storage
      await storage.setItem('@atem:user_profile:v1', JSON.stringify(DEFAULT_USER_PROFILE));
      await storage.setItem('@atem:custom_subchannels', JSON.stringify([
        {
          id: 'custom-visible-learning',
          handle: 'c/visible_learning',
          title: 'Visible Learning',
          description: 'Lernforschung',
          icon: 'school-outline',
          flair: 'Didaktik',
          primaryTopic: 'german_didactics',
          accentColor: '#4D947A',
          isCustom: true,
          createdAt: new Date().toISOString(),
          pinned: true,
          memberCount: 1
        }
      ]));

      // Export backup JSON
      const json = await BackupService.exportBackupJson(false, storage);
      assert.ok(json.includes('c/visible_learning'), 'Backup must contain custom space handle');

      // Restore into fresh storage
      const freshStorage = new AtemStorage(new MemoryStorageDriver());
      const res = await BackupService.importBackupJson(json, freshStorage);
      assert.equal(res.success, true);

      const restoredRaw = await freshStorage.getItem('@atem:custom_subchannels');
      assert.ok(restoredRaw && restoredRaw.includes('c/visible_learning'), 'Custom space must be restored into storage');
    });
  });

  // --------------------------------------------------------------------------
  // Pillar 4: AI Curation & BYOK Fallback
  // --------------------------------------------------------------------------
  describe('Pillar 4: AI Curation Fallback & Direct BYOK', () => {
    it('seamlessly falls back to direct provider HTTPS when proxy is unavailable (e.g. 404)', async () => {
      let directCalled = false;
      const originalFetch = globalThis.fetch;

      globalThis.fetch = (async (url: string | URL | Request) => {
        const urlStr = String(url);
        if (urlStr.includes('proxy.example')) {
          // Simulate Cloudflare Worker 404 / 405 on static GitHub Pages
          return new Response(JSON.stringify({ error: 'Proxy route not found' }), { status: 404 });
        }
        if (urlStr.includes('generativelanguage.googleapis.com')) {
          directCalled = true;
          return new Response(JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [{ text: JSON.stringify({ status: 'ok', score: 9 }) }]
                }
              }
            ],
            usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 10 }
          }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        return new Response('Not found', { status: 404 });
      }) as typeof fetch;

      try {
        const ledger = new EnrichmentUsageLedger('', false);
        const result = await callAiModel('Teste Verbindung', {
          credentials: {
            provider: 'gemini',
            apiKey: 'fake-test-key-for-direct-fallback',
            proxyUrl: 'https://proxy.example/api/ai'
          },
          ledger
        });

        assert.equal(directCalled, true, 'Direct Gemini API must be contacted when proxy 404s and apiKey is present');
        assert.ok(result.text.includes('status'), 'Must receive response from direct fallback');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  // --------------------------------------------------------------------------
  // Pillar 5: c/memes Discovery Pool (>= 30 Authentic Entries)
  // --------------------------------------------------------------------------
  describe('Pillar 5: c/memes Discovery Pool', () => {
    it('contains at least 30 authentic meme classics, comics, and mental models', () => {
      assert.ok(
        MEME_VAULT_ENTRIES.length >= 30,
        `Expected at least 30 meme vault entries, but found ${MEME_VAULT_ENTRIES.length}`
      );

      for (const entry of MEME_VAULT_ENTRIES) {
        assert.ok(entry.id, 'Entry must have a valid id');
        assert.ok(entry.title.length > 5, `Title too short for ${entry.id}`);
        assert.ok(
          entry.format === 'meme' || entry.format === 'comic',
          `Format must be meme or comic for ${entry.id}, was: ${entry.format}`
        );
        assert.equal(entry.space, 'c/memes', `Space must be c/memes for ${entry.id}`);
        assert.ok(entry.imageUrl, `Must have image URL for visual meme ${entry.id}`);
        assert.equal(entry.hasAuthenticImage, true, `Must have authentic image flag for ${entry.id}`);
      }
    });

    it('batchEnricher does not reject meme and comic formats for short text', () => {
      const memeItem = makeMockItem({
        id: 'meme-short-text',
        format: 'meme',
        space: 'c/memes',
        feedText: 'Kurzer Meme-Text (unter 40 Zeichen)'
      });

      const comicItem = makeMockItem({
        id: 'comic-short-text',
        format: 'comic',
        space: 'c/memes',
        feedText: 'xkcd Comic Panel'
      });

      const report1 = evaluateSignalVsNoiseDeterministically(memeItem);
      assert.equal(report1.passed, true, 'Memes must be approved even with concise punchline text');
      assert.ok(report1.score >= 7, 'Meme score must be >= 7');

      const report2 = evaluateSignalVsNoiseDeterministically(comicItem);
      assert.equal(report2.passed, true, 'Comics must be approved even with concise punchline text');
      assert.ok(report2.score >= 7, 'Comic score must be >= 7');
    });
  });
});
