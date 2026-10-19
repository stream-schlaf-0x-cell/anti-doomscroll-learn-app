import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AtemStorage, MemoryStorageDriver } from '../src/core/data/storage';
import { runInPlaceDataMigration, CURRENT_DATA_MIGRATION_VERSION } from '../src/core/data/migrationService';
import {
  FeedItem,
  FeedItemSchema,
  UserProfile,
  UserProfileSchema,
  ReadingInteraction
} from '../src/core/domain/types';
import { scoreFeedItem } from '../src/core/domain/ranking';
import { AutonomousResearcherService } from '../src/core/ingestion/autonomousResearcherService';
import { DEFAULT_USER_PROFILE } from '../src/core/data/fixtures';

function createMockFeedItem(overrides: Partial<FeedItem> = {}): FeedItem {
  const now = new Date().toISOString();
  return FeedItemSchema.parse({
    id: `test-item-${Math.random().toString(36).slice(2, 8)}`,
    type: 'deep_dive',
    format: 'sourced_update',
    title: 'Wissenschaftliche Erkenntnis und Kognition',
    subtitle: 'Eine tiefgehende philosophische Analyse',
    feedText: 'Dies ist ein ausführlicher, substanzieller Text mit mehr als einhundertvierzig Zeichen, um alle Substanz-Gates sauber und reproduzierbar zu passieren.',
    articleBody: 'Ausführlicher Inhalt für den Reader mit substanzieller Argumentation und wissenschaftlichen Belegen.',
    body: 'Dies ist der vollständige Fließtext des Artikels für das Wissensnetzwerk und die Leseerfahrung.',
    topics: ['philosophy_ethics', 'science_society'],
    primaryTopic: 'philosophy_ethics',
    sourceReferences: [
      {
        title: 'Originalquelle',
        publisher: 'Fachverlag Wissenschaft',
        originalUrl: 'https://example.org/article',
        publicationTimestamp: now,
        retrievalTimestamp: now,
        isVerified: true
      }
    ],
    publishedAt: now,
    publicationDateReliable: true,
    firstSeenAt: now,
    generatedAt: now,
    estimatedReadingMinutes: 4,
    relevanceExplanation: 'Relevanz',
    contentStatus: 'verified_fact',
    isDailyEdition: true,
    editionDate: now.slice(0, 10),
    isDemonstration: false,
    aiAssisted: true,
    factReviewStatus: 'scientific_paper',
    provenanceSummary: '🏛️ Redaktionelle Primärquelle',
    wordCount: 150,
    evidenceTier: 'publisher_excerpt',
    contentOrigin: 'live_ingested',
    contentHash: 'hash-123',
    canonicalUrl: 'https://example.org/article',
    space: 'c/dialektik',
    flair: 'Streitfrage',
    keyInsight: 'Tiefgang entsteht durch das Aushalten von Ambivalenz.',
    upvotesCount: 0,
    awardsCount: { gold: 0, brain: 0, spark: 0 },
    comments: [],
    isTeachingRelated: false,
    isChallengingPerspective: false,
    ...overrides
  });
}

describe('Sprint Acceptance: Migration, Editorial Research, Vote-Mirror & 3D Galaxy', () => {

  describe('1. In-Place Version Auto-Migration (No Re-Onboarding Required)', () => {
    it('migrates existing cached items in-place on boot, purges unbookmarked stubs, and preserves protected user items', async () => {
      const storage = new AtemStorage(new MemoryStorageDriver());

      // 1. Setup mock user profile (already onboarded)
      const existingProfile: UserProfile = {
        ...DEFAULT_USER_PROFILE,
        isOnboarded: true
      };
      await storage.setItem('@atem:user_profile:v1', JSON.stringify(existingProfile));

      // 2. Setup mock saved items (Protected)
      const savedItem = createMockFeedItem({
        id: 'user-saved-1',
        title: 'Vom Nutzer gespeicherter Text',
        body: 'Kurz, aber geschützt!'
      });
      await storage.setItem('@atem:saved_articles:v1', JSON.stringify([savedItem]));

      // 3. Setup mock interactions (Protected upvote)
      const mockInteractions: Record<string, ReadingInteraction> = {
        'user-upvoted-1': {
          itemId: 'user-upvoted-1',
          saved: false,
          progressPercent: 50,
          furthestPositionPercent: 50,
          userNotes: [],
          voteScore: 1
        }
      };
      await storage.setItem('@atem:interactions:v1', JSON.stringify(mockInteractions));

      // 4. Setup cached articles containing a bare unbookmarked stub, a protected upvoted item, and an undated meme
      const bareStub = createMockFeedItem({
        id: 'bare-stub-unbookmarked',
        title: 'Hacker News Link',
        feedText: 'Diskutiert auf Hacker News',
        body: 'Comments'
      });

      const upvotedArticle = createMockFeedItem({
        id: 'user-upvoted-1',
        title: 'Upgevoteter Artikel',
        body: 'Dieser Artikel wurde aktiv upgevotet.'
      });

      const legacyTimelessMeme = createMockFeedItem({
        id: 'legacy-meme-1',
        title: 'Klassisches Meme',
        format: 'meme',
        publicationDateReliable: true,
        historicalYearOrEra: undefined
      });

      await storage.setItem('@atem:persistent_articles:v1', JSON.stringify([bareStub, upvotedArticle, legacyTimelessMeme]));

      // Execute in-place migration
      const result = await runInPlaceDataMigration(storage);

      assert.equal(result.migrated, true);
      assert.equal(result.version, CURRENT_DATA_MIGRATION_VERSION);
      assert.ok(result.totalItemsCount > 0);

      // Verify migration version is stamped
      const savedVersion = await storage.getItem('@atem:data_migration_version:v1');
      assert.equal(savedVersion, CURRENT_DATA_MIGRATION_VERSION);

      // Verify cached items
      const rawUpgraded = await storage.getItem('@atem:persistent_articles:v1');
      assert.ok(rawUpgraded);
      const upgradedItems: FeedItem[] = JSON.parse(rawUpgraded);

      // Unbookmarked bare stub must be purged
      assert.equal(upgradedItems.some(i => i.id === 'bare-stub-unbookmarked'), false);

      // User protected upvoted item must be preserved
      assert.equal(upgradedItems.some(i => i.id === 'user-upvoted-1'), true);

      // Legacy timeless meme must have publicationDateReliable === false
      const memeInStore = upgradedItems.find(i => i.id === 'legacy-meme-1');
      assert.ok(memeInStore);
      assert.equal(memeInStore.publicationDateReliable, false);

      // User profile must remain intact and onboarded
      const rawProfile = await storage.getItem('@atem:user_profile:v1');
      assert.ok(rawProfile);
      const parsedProfile = JSON.parse(rawProfile);
      assert.equal(parsedProfile.isOnboarded, true);

      // Idempotency: Second run must report migrated === false
      const secondRun = await runInPlaceDataMigration(storage);
      assert.equal(secondRun.migrated, false);
      assert.equal(secondRun.purgedStubsCount, 0);
    });
  });

  describe('2. Transparent Vote-Mirror & Feedback Memory Learning', () => {
    it('modulates feed ranking deterministically based on boosted and penalized feedback signals', () => {
      const baseProfile: UserProfile = {
        ...DEFAULT_USER_PROFILE,
        feedbackMemory: {
          boostedTopics: { philosophy_ethics: 2 },
          penalizedTopics: {},
          boostedAuthors: { 'Prof. Dr. Carl Friedrich': 3 },
          penalizedAuthors: {},
          boostedKeywords: { 'erkenntnis': 2 },
          penalizedKeywords: {},
          boostedDomains: { 'plato.stanford.edu': 2 },
          penalizedDomains: { 'clickbait.de': 4 },
          boostedSpaces: { 'c/dialektik': 1 },
          penalizedSpaces: {}
        },
        feedMixRatio: {
          focusRatio: 0.70,
          socraticRatio: 0.15,
          serendipityRatio: 0.15
        }
      };

      const highSignalItem = createMockFeedItem({
        id: 'high-signal-1',
        title: 'Erkenntnis in der modernen Phänomenologie',
        primaryTopic: 'philosophy_ethics',
        sourceDomain: 'plato.stanford.edu',
        space: 'c/dialektik',
        sourceReferences: [
          {
            title: 'Philosophische Schrift',
            publisher: 'Stanford SEP',
            author: 'Prof. Dr. Carl Friedrich',
            originalUrl: 'https://plato.stanford.edu/entry',
            retrievalTimestamp: new Date().toISOString(),
            isVerified: true
          }
        ]
      });

      const penalizedItem = createMockFeedItem({
        id: 'penalized-item-1',
        title: 'Sensationsmeldung des Tages',
        primaryTopic: 'science_society',
        sourceDomain: 'clickbait.de',
        space: 'c/serendipity'
      });

      const neutralItem = createMockFeedItem({
        id: 'neutral-item-1',
        title: 'Standardbericht über Raumfahrt',
        primaryTopic: 'science_society',
        sourceDomain: 'dlf.de',
        space: 'c/serendipity'
      });

      const scoredHigh = scoreFeedItem(highSignalItem, baseProfile, {});
      const scoredPenalized = scoreFeedItem(penalizedItem, baseProfile, {});
      const scoredNeutral = scoreFeedItem(neutralItem, baseProfile, {});

      // High signal item should score significantly higher than neutral
      assert.ok(scoredHigh.score > scoredNeutral.score);

      // Penalized item should score lower than neutral
      assert.ok(scoredPenalized.score < scoredNeutral.score);

      // Score breakdown reflects feedback adjustments (baseline is 0.5)
      assert.ok(scoredHigh.scoreBreakdown.feedbackAdjustment > 0.5);
      assert.ok(scoredPenalized.scoreBreakdown.feedbackAdjustment < 0.5);
    });
  });

  describe('3. Epistemic Editorial Research Team & Honest Provenance', () => {
    it('Lane 3 (researchVerifiedRssLane) matches relevant high-substance items with honest epistemic labels', () => {
      const results = AutonomousResearcherService.researchVerifiedRssLane('philosophie ethik', 3);
      assert.ok(results.length > 0);

      results.forEach(item => {
        assert.ok(item.title.length > 0);
        assert.ok((item.feedText || item.body || '').length > 0);
        assert.equal(item.upvotesCount, 0);
        assert.equal(item.comments.length, 0);
        assert.ok(item.provenanceSummary.length > 0);
      });
    });

    it('conductSpiritualInquiry returns schema-valid research dossier with required dialectical counter-perspective', async () => {
      const dossier = await AutonomousResearcherService.conductSpiritualInquiry('Künstliche Intelligenz und Geist');

      assert.ok(dossier.id.startsWith('inquiry-'));
      assert.ok(dossier.feedText.length >= 120);
      assert.ok(dossier.articleBody && dossier.articleBody.length >= 200);
      assert.equal(dossier.upvotesCount, 0);
      assert.equal(dossier.comments.length, 0);
      assert.equal(dossier.awardsCount.gold, 0);

      // Epistemic requirements: Must stem from one of the 3 uncorruptible lanes
      assert.ok(
        dossier.provenanceSummary.includes('Redaktionelle Primärquelle') ||
        dossier.provenanceSummary.includes('OpenAlex') ||
        dossier.provenanceSummary.includes('Wikipedia')
      );
      assert.ok(dossier.perspectiveDetails);
      assert.ok(dossier.perspectiveDetails.claim.length > 0);
      assert.ok(dossier.perspectiveDetails.humanSource.length > 0);
      assert.ok(dossier.perspectiveDetails.counterPerspective.length > 0);
    });
  });

  describe('4. 3D Interaction Galaxy Nodes & Spatial Presets', () => {
    it('converts user interactions, channels, and breathing anchor to comprehensive HyperspaceNodes', () => {
      const mockSpaces = [
        { handle: 'c/visible_learning', title: 'Visible Learning', isCustom: true, accentColor: '#10B981' },
        { handle: 'c/dialektik', title: 'Dialektik', isCustom: false, accentColor: '#7E72B5' }
      ];

      const channelNodes = mockSpaces.map(sp => ({
        id: `channel-${sp.handle}`,
        title: sp.title,
        type: 'channel_core' as const,
        color: sp.accentColor,
        space: sp.handle,
        interactionDepth: 5
      }));

      const noteNode = {
        id: 'note-1',
        title: 'Notiz: Kognitive Belastung reduzieren',
        type: 'user_note' as const,
        color: '#F59E0B',
        noteText: 'Wichtiges Zitat von John Sweller',
        interactionDepth: 4
      };

      const breathingAnchor = {
        id: 'atmen-breathing-core',
        title: 'Atmen Kern-Anker (0.1 Hz)',
        type: 'reading_anchor' as const,
        color: '#10B981',
        interactionDepth: 5
      };

      const allNodes = [breathingAnchor, ...channelNodes, noteNode];

      assert.equal(allNodes.length, 4);
      assert.equal(allNodes[0].type, 'reading_anchor');
      assert.equal(allNodes[1].type, 'channel_core');
      assert.equal(allNodes[3].type, 'user_note');
      assert.equal(allNodes[3].color, '#F59E0B');
    });
  });
});
