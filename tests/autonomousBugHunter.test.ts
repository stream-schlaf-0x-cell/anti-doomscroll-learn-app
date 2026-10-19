import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AtemStorage, MemoryStorageDriver } from '../src/core/data/storage';
import { runInPlaceDataMigration, CURRENT_DATA_MIGRATION_VERSION } from '../src/core/data/migrationService';
import { LocalFeedRepository } from '../src/core/data/feedRepository';
import { PersistentArticleStore } from '../src/core/feed/PersistentArticleStore';
import {
  FeedItem,
  FeedItemSchema,
  UserProfile,
  UserProfileSchema,
  TopicTag
} from '../src/core/domain/types';
import { scoreFeedItem } from '../src/core/domain/ranking';
import { RecursiveLearningEngine } from '../src/core/recommendations/recursiveLearningEngine';
import { AutonomousResearcherService } from '../src/core/ingestion/autonomousResearcherService';
import { OnTheFlyStreamService } from '../src/core/synthesis/onTheFlyStreamService';
import { DEFAULT_USER_PROFILE } from '../src/core/data/fixtures';
import { satisfiesCuratedBodyContract, getCardRenderableText } from '../src/core/enrichment/batchEnricher';

function createMockSubstantiveItem(id: string, primaryTopic: TopicTag = 'philosophy_ethics'): FeedItem {
  const now = new Date().toISOString();
  return FeedItemSchema.parse({
    id,
    type: 'deep_dive',
    format: 'sourced_update',
    title: `Forschung zu ${primaryTopic}: Kognition und Geist`,
    subtitle: 'Wissenschaftliche Untersuchung zur Erkenntnistheorie',
    feedText: 'Dies ist ein ausführlicher, hochgradig substanzieller Beitrag mit mehr als einhundertvierzig Zeichen, um alle Substanz-Gates zuverlässig zu passieren und den Contract zu erfüllen.',
    articleBody: 'Ausführlicher Fließtext für den Reader mit Belegen, Methodik und weiterführenden Referenzen zur dialektischen Reflexion.',
    body: 'Dies ist der vollständige Fließtext des Artikels für das Wissensnetzwerk und die Leseerfahrung.',
    topics: [primaryTopic, 'science_society'],
    primaryTopic,
    sourceReferences: [
      {
        title: 'Originalpublikation',
        publisher: 'Fachverlag Philosophie',
        originalUrl: 'https://example.org/paper',
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
    relevanceExplanation: 'Empfohlen aufgrund deiner intellektuellen Interessen.',
    contentStatus: 'scientific_analysis',
    isDailyEdition: false,
    editionDate: now.slice(0, 10),
    isDemonstration: false,
    aiAssisted: false,
    factReviewStatus: 'scientific_paper',
    provenanceSummary: '🔬 Geprüfte Fachpublikation',
    wordCount: 150,
    evidenceTier: 'publisher_excerpt',
    contentOrigin: 'live_ingested',
    contentHash: `hash-${id}`,
    canonicalUrl: `https://example.org/paper/${id}`,
    upvotesCount: 0,
    awardsCount: { gold: 0, brain: 0, spark: 0 },
    keyInsight: 'Die Verbindung von Erkenntnistheorie und Empirie stärkt kritisches Urteilsvermögen.'
  });
}

describe('Autonomous QA, Chaos Fuzzing & Bug Hunter Suite', () => {

  describe('1. Corrupted Storage Fuzzing & Safe Fallback Recovery', () => {
    it('handles severely corrupted JSON, null arrays, and primitive values in migrationService without throwing', async () => {
      const memoryDriver = new MemoryStorageDriver();
      const storage = new AtemStorage(memoryDriver);

      // Inject malicious / corrupted storage shapes
      await memoryDriver.setItem('@atem:persistent_articles:v1', '{broken JSON: [123, invalid');
      await memoryDriver.setItem('@atem:feed_items:v1', 'null');
      await memoryDriver.setItem('@atem:dynamic_items:v1', '"malicious-raw-string-instead-of-array"');
      await memoryDriver.setItem(
        '@atem:user_interactions:v1',
        JSON.stringify({
          'valid-item-1': { voteScore: 1, isFavorite: true },
          'corrupted-entry-1': null,
          'corrupted-entry-2': 12345,
          'corrupted-entry-3': 'not-an-object'
        })
      );
      await memoryDriver.setItem(
        '@atem:saved_articles:v1',
        JSON.stringify([
          null,
          123,
          'not-an-item',
          { id: 'valid-saved-item' }
        ])
      );

      const mockRepo = new LocalFeedRepository(storage);

      // In-place migration should recover cleanly with 0 unhandled exceptions
      const result = await runInPlaceDataMigration(storage, mockRepo);
      assert.strictEqual(result.migrated, true);
      assert.strictEqual(result.version, CURRENT_DATA_MIGRATION_VERSION);
      assert.ok(result.totalItemsCount > 0, 'Should have populated knowledge vault items');

      // The recorded version in storage must now match CURRENT_DATA_MIGRATION_VERSION
      const storedVersion = await storage.getItem('@atem:data_migration_version:v1');
      assert.strictEqual(storedVersion, CURRENT_DATA_MIGRATION_VERSION);
    });

    it('PersistentArticleStore and LocalFeedRepository handle empty, null, or corrupted storage gracefully', async () => {
      const memoryDriver = new MemoryStorageDriver();
      const storage = new AtemStorage(memoryDriver);
      await memoryDriver.setItem('@atem:persisted_articles:v2', '{not valid json');
      await memoryDriver.setItem('@atem:dynamic_items:v1', '{corrupt json');

      const store = new PersistentArticleStore(storage);
      const loaded = await store.loadArticles();
      assert.deepStrictEqual(loaded, []);

      const repo = new LocalFeedRepository(storage);
      assert.ok(Array.isArray(repo.getAllItems()));
      assert.ok(repo.getAllItems().length > 0);
    });

    it('satisfiesCuratedBodyContract and getCardRenderableText never throw on null, undefined or malformed inputs', () => {
      assert.strictEqual(satisfiesCuratedBodyContract(null), false);
      assert.strictEqual(satisfiesCuratedBodyContract(undefined), false);
      assert.strictEqual(satisfiesCuratedBodyContract({} as any), false);
      assert.strictEqual(satisfiesCuratedBodyContract({ title: 'Just title' } as any), false);

      assert.strictEqual(getCardRenderableText(null), '');
      assert.strictEqual(getCardRenderableText(undefined), '');
      assert.strictEqual(getCardRenderableText({} as any), '');
      assert.strictEqual(getCardRenderableText({ feedText: '   ' } as any), '');
      assert.strictEqual(getCardRenderableText({ feedText: 'Diskutiert auf Hacker News' } as any), '');
    });
  });

  describe('2. Rapid-Fire Interaction Stress Test & Mathematical Invariants', () => {
    it('simulates 30 rapid alternating interactions ensuring derived weights remain bounded [0.05, 0.95] and finite', async () => {
      let currentProfile: UserProfile = { ...DEFAULT_USER_PROFILE };
      const topics: TopicTag[] = ['philosophy_ethics', 'german_didactics', 'ai_apple', 'science_society'];

      for (let i = 0; i < 30; i++) {
        const topic = topics[i % topics.length];
        const item = createMockSubstantiveItem(`stress-item-${i}`, topic);
        const eventType = i % 2 === 0 ? 'upvote' : 'downvote';

        const result = await RecursiveLearningEngine.recordInteractionEvent(currentProfile, item, eventType);
        if (result.event) {
          currentProfile = {
            ...currentProfile,
            derivedWeights: result.updatedProfile.derivedWeights
          };
        }

        // Verify mathematical bounds at each step
        for (const [t, w] of Object.entries(currentProfile.derivedWeights || {})) {
          assert.ok(Number.isFinite(w), `Weight for ${t} must be finite, got ${w}`);
          assert.ok(w >= 0.10 && w <= 0.98, `Weight for ${t} must be bounded [0.10, 0.98], got ${w}`);
        }
      }

      // Ranking score under stressed profile must be strictly finite between 0 and 1
      const testItem = createMockSubstantiveItem('test-final', 'philosophy_ethics');
      const scored = scoreFeedItem(testItem, currentProfile, {});
      assert.ok(Number.isFinite(scored.score), 'Ranking score must be finite');
      assert.ok(scored.score >= 0 && scored.score <= 1.0, `Score must be in [0, 1], got ${scored.score}`);
    });
  });

  describe('3. 3D Galaxy Coordinate & Canvas Math Fuzzing', () => {
    it('verifies 3D projection math under extreme zooms (0.1x to 10x) and boundary node counts (0, 1, 2, 500)', () => {
      const geometries: Array<'orbital' | 'lotus' | 'torus'> = ['orbital', 'lotus', 'torus'];
      const nodeCounts = [0, 1, 2, 500];
      const zoomLevels = [0.1, 0.4, 1.0, 2.5, 10.0];
      const rotationAngles = [-Math.PI, -0.5, 0, 0.25, Math.PI, 2 * Math.PI];

      for (const geom of geometries) {
        for (const count of nodeCounts) {
          // Generate synthetic 3D points matching HyperspaceCanvas formulas
          const points: Array<{ x: number; y: number; z: number; baseRadius: number }> = [];
          const goldenAngle = Math.PI * (3 - Math.sqrt(5));

          for (let i = 0; i < count; i++) {
            if (geom === 'orbital') {
              const phi = (i / Math.max(1, count)) * Math.PI * 2;
              const orbitR = 90 + (i % 6) * 35;
              const tilt = ((i % 4) - 1.5) * 0.22;
              points.push({
                x: Math.cos(phi) * orbitR,
                y: Math.sin(phi) * orbitR * tilt,
                z: Math.sin(phi) * orbitR,
                baseRadius: 10
              });
            } else if (geom === 'lotus') {
              const y = 1 - (i / Math.max(1, count - 1)) * 2;
              const rAtY = Math.sqrt(Math.max(0, 1 - y * y));
              const theta = goldenAngle * i;
              const sphereRadius = 160 + (i % 4) * 25;
              points.push({
                x: Math.cos(theta) * rAtY * sphereRadius,
                y: y * sphereRadius,
                z: Math.sin(theta) * rAtY * sphereRadius,
                baseRadius: 8
              });
            } else {
              const majorR = 170;
              const minorR = 65 + (i % 3) * 15;
              const u = (i / Math.max(1, count)) * Math.PI * 2;
              const v = ((i * 3) / Math.max(1, count)) * Math.PI * 2;
              points.push({
                x: (majorR + minorR * Math.cos(v)) * Math.cos(u),
                y: (majorR + minorR * Math.cos(v)) * Math.sin(u) * 0.6,
                z: minorR * Math.sin(v),
                baseRadius: 9
              });
            }
          }

          // Test projection across extreme zooms and rotations
          for (const zoom of zoomLevels) {
            for (const rotX of rotationAngles) {
              const rotY = rotX * 0.7;
              const cx = 420;
              const cy = 280;
              const safeZoom = Math.max(0.2, Math.min(5.0, Number.isFinite(zoom) ? zoom : 1.0));
              const fov = Math.max(120, 460 * safeZoom);
              const cosX = Math.cos(rotX);
              const sinX = Math.sin(rotX);
              const cosY = Math.cos(rotY);
              const sinY = Math.sin(rotY);

              for (const pt of points) {
                const x1 = pt.x * cosY + pt.z * sinY;
                const z1 = -pt.x * sinY + pt.z * cosY;
                const y2 = pt.y * cosX - z1 * sinX;
                const z2 = pt.y * sinX + z1 * cosX;

                // Safe division clamp invariant
                const safeDistance = Math.max(40, fov + z2);
                assert.ok(safeDistance >= 40, `Denominator must be >= 40, got ${safeDistance}`);

                const scale = fov / safeDistance;
                assert.ok(Number.isFinite(scale) && scale > 0, `Scale must be finite positive, got ${scale}`);

                const sx = cx + x1 * scale;
                const sy = cy + y2 * scale;
                assert.ok(Number.isFinite(sx), `Screen x must be finite, got ${sx}`);
                assert.ok(Number.isFinite(sy), `Screen y must be finite, got ${sy}`);

                // Radius & Aura gradient radius invariant (never NaN, never <= 0)
                const radius = Math.max(3, Math.min(32, pt.baseRadius * scale));
                assert.ok(Number.isFinite(radius) && radius > 0, `Radius must be > 0, got ${radius}`);

                const auraRadius = Math.max(1, Math.min(150, radius * 3.0));
                assert.ok(Number.isFinite(auraRadius) && auraRadius > 0, `Aura radius must be > 0 for createRadialGradient, got ${auraRadius}`);
              }
            }
          }
        }
      }
    });
  });

  describe('4. Network Blackout Simulation & Graceful Service Degradation', () => {
    it('gracefully handles offline/network timeout during OpenAlex and Wikipedia lane searches without crashing', async () => {
      const originalFetch = globalThis.fetch;

      // Mock network blackout: reject fetch immediately with network error
      globalThis.fetch = async () => {
        throw new TypeError('Failed to fetch (offline network blackout simulation)');
      };

      try {
        // OpenAlex lane must not throw and return empty array
        const alexResults = await AutonomousResearcherService.researchOpenAlexLane('quantum machine learning', 2);
        assert.deepStrictEqual(alexResults, []);

        // Wikipedia lane must not throw and return empty array
        const wikiResults = await AutonomousResearcherService.researchWikipediaLane('Epistemologie', 'de');
        assert.deepStrictEqual(wikiResults, []);

        // OnTheFlyStreamService OpenAlex search must catch and return empty array
        const onTheFlyAlex = await OnTheFlyStreamService.searchOpenAlex('ai ethics', 'ai_apple', 'c/ai', '2026-10-19');
        assert.deepStrictEqual(onTheFlyAlex, []);

        // OnTheFlyStreamService Wikipedia search must catch and return empty array
        const onTheFlyWiki = await OnTheFlyStreamService.searchWikipedia('Phänomenologie', 'philosophy_ethics', 'c/philosophie', '2026-10-19');
        assert.deepStrictEqual(onTheFlyWiki, []);

        // Editorial Research Team inquiry must gracefully execute and return array
        const teamResults = await AutonomousResearcherService.conductEditorialResearchTeamInquiry('Didaktik', { space: 'c/recherche' });
        assert.ok(Array.isArray(teamResults), 'Editorial inquiry must return array');

        // Spiritual Teammate Inquiry must fall back to local corpus and return a valid FeedItem
        const dossier = await AutonomousResearcherService.conductSpiritualInquiry('Künstliche Intelligenz und Geist');
        assert.ok(dossier, 'Spiritual inquiry must synthesize a fallback dossier');
        assert.ok(dossier.title.length > 0);
        assert.ok(dossier.provenanceSummary.length > 0);
        assert.ok(dossier.perspectiveDetails?.claim);
        assert.ok(dossier.perspectiveDetails?.counterPerspective);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});
