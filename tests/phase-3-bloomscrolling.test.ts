import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  FeedQuizQuestionSchema,
  FeedItem,
  FeedItemSchema,
  TopicTag,
  TOPIC_METADATA
} from '../src/core/domain/types';
import {
  generateQuizForArticle
} from '../src/core/quiz/quizGenerator';
import {
  FEATURE_MODULES,
  DEFAULT_ENABLED_MODULES,
  isFeatureEnabled
} from '../src/core/modules/featureRegistry';
import { DEFAULT_USER_PROFILE } from '../src/core/data/fixtures';
import { defaultSourceRepository } from '../src/core/data/sourceRepository';
// Note: We avoid importing AtmenBreathingPortal directly to prevent esbuild react-native transform issues in Node CLI tests
import { generateHivemindStream } from '../src/core/synthesis/onTheFlyStreamService';

describe('Phase 3: Bloomscrolling Engine, Native Atem Integration, Quizzes & Simplified Hub', () => {
  it('1. Feature Registry cleanly integrates 3 Phase 3 modules with default enabled', () => {
    assert.strictEqual(FEATURE_MODULES.length, 9);

    const breathingMod = FEATURE_MODULES.find(m => m.id === 'breathing_portal');
    assert.ok(breathingMod, 'breathing_portal module must exist');
    assert.strictEqual(breathingMod.defaultEnabled, true);

    const quizMod = FEATURE_MODULES.find(m => m.id === 'bloomscroll_quizzes');
    assert.ok(quizMod, 'bloomscroll_quizzes module must exist');
    assert.strictEqual(quizMod.defaultEnabled, true);

    const hivemindMod = FEATURE_MODULES.find(m => m.id === 'hivemind_streams');
    assert.ok(hivemindMod, 'hivemind_streams module must exist');
    assert.strictEqual(hivemindMod.defaultEnabled, true);

    assert.strictEqual(DEFAULT_ENABLED_MODULES.breathing_portal, true);
    assert.strictEqual(DEFAULT_ENABLED_MODULES.bloomscroll_quizzes, true);
    assert.strictEqual(DEFAULT_ENABLED_MODULES.hivemind_streams, true);

    assert.strictEqual(isFeatureEnabled(DEFAULT_USER_PROFILE, 'breathing_portal'), true);
    assert.strictEqual(isFeatureEnabled(DEFAULT_USER_PROFILE, 'bloomscroll_quizzes'), true);
    assert.strictEqual(isFeatureEnabled(DEFAULT_USER_PROFILE, 'hivemind_streams'), true);
  });

  it('2. NewsHubModal source contract: exactly 2 submenus, zero duplicate emoji bugs, clean source management', async () => {
    const filePath = join(__dirname, '../src/ui/components/NewsHubModal.tsx');
    const sourceCode = readFileSync(filePath, 'utf-8');

    // Exactly 2 tabs: 'Themen wählen' and 'Quellen & Eigene Feeds'
    assert.ok(sourceCode.includes("'topics' | 'sources'"), 'HubTab must only have topics and sources');
    assert.ok(sourceCode.includes('Themen wählen'), 'Submenu 1 title must be present');
    assert.ok(sourceCode.includes('Quellen & Eigene Feeds'), 'Submenu 2 title must be present');

    // Zero redundant old tabs
    assert.strictEqual(sourceCode.includes('curated_news'), false, 'Legacy curated_news tab must be removed');
    assert.strictEqual(sourceCode.includes('gatherer'), false, 'Legacy gatherer tab must be removed');
    assert.strictEqual(sourceCode.includes('raindrop'), false, 'Legacy raindrop tab must be removed from modal');

    // Accessibility label guard
    assert.ok(sourceCode.includes('accessibilityLabel="News-Hub schließen"'), 'Close button accessibilityLabel must be intact');

    // Test SourceRepository toggle and custom source operations
    const testCustomUrl = `https://test-bloomscroll-${Date.now()}.org/feed.xml`;
    const newSource = await defaultSourceRepository.addCustomSource({
      name: 'Test Bloomscroll Feed',
      url: testCustomUrl,
      primaryTopic: 'philosophy_ethics'
    });
    assert.ok(newSource.id.startsWith('custom-'));
    assert.strictEqual(newSource.isCustom, true);

    // Toggle
    const toggledOff = await defaultSourceRepository.toggleSource(newSource.id, false);
    assert.strictEqual(toggledOff, false);
    const toggledOn = await defaultSourceRepository.toggleSource(newSource.id, true);
    assert.strictEqual(toggledOn, true);

    // Remove
    await defaultSourceRepository.removeCustomSource(newSource.id);
    const allAfter = await defaultSourceRepository.getAllSources();
    assert.strictEqual(allAfter.some(s => s.id === newSource.id), false);
  });

  it('3. AtmenBreathingPortal points to authentic URL and supports modal and inline modes', () => {
    const portalFile = readFileSync(join(__dirname, '../src/features/breathing/AtmenBreathingPortal.tsx'), 'utf-8');
    assert.ok(portalFile.includes("'https://stream-schlaf-0x-cell.github.io/atem/'"), 'Authentic URL must be defined');
    assert.ok(portalFile.includes("mode === 'inline'"), 'Inline mode must be supported');
    assert.ok(portalFile.includes("mode === 'modal'"), 'Modal mode must be supported');
    assert.ok(portalFile.includes("Platform.OS === 'web'"), 'Platform-specific web iframe must be present');
  });

  it('4. QuizGenerator synthesizes valid FeedQuizQuestionSchema with 4 options and correct answer', () => {
    const dummyArticle: FeedItem = {
      id: 'test-art-1',
      type: 'deep_dive',
      format: 'concise_insight',
      title: 'Die Evolutionäre Erkenntnistheorie',
      subtitle: 'Warum unsere Sinne die Welt nicht abbilden, sondern filtern',
      feedText: 'Unsere Kognition ist das Produkt adaptiver Selektion. Das Gehirn erzeugt Modelle, die das Überleben sichern, nicht zwingend objektive Wahrheit.',
      body: 'Unsere Kognition ist das Produkt adaptiver Selektion. Das Gehirn erzeugt Modelle, die das Überleben sichern, nicht zwingend objektive Wahrheit.',
      topics: ['philosophy_ethics'],
      primaryTopic: 'philosophy_ethics',
      sourceReferences: [
        {
          publisher: 'Stanford Encyclopedia of Philosophy',
          originalUrl: 'https://plato.stanford.edu/entries/evolutionary-epistemology/',
          title: 'Evolutionary Epistemology',
          retrievalTimestamp: new Date().toISOString(),
          isVerified: true
        }
      ],
      publishedAt: new Date().toISOString(),
      generatedAt: new Date().toISOString(),
      estimatedReadingMinutes: 4,
      relevanceExplanation: 'Zentraler Text zur Erkenntnistheorie.',
      contentStatus: 'philosophical_perspective',
      isDailyEdition: true,
      editionDate: '2026-10-18',
      isDemonstration: false,
      aiAssisted: false,
      factReviewStatus: 'philosophical_discourse',
      provenanceSummary: 'Stanford SEP',
      wordCount: 150,
      evidenceTier: 'publisher_excerpt',
      contentOrigin: 'demo_fixture',
      contentHash: 'hash-test-1',
      sourceTrustLevel: 'peer_reviewed',
      isTeachingRelated: false,
      isChallengingPerspective: false,
      upvotesCount: 0,
      awardsCount: { gold: 0, brain: 0, spark: 0 },
      comments: [],
      keyInsight: 'Das Gehirn erzeugt überlebenssichernde Modelle, keine objektive Abbildung der Wirklichkeit.'
    };

    const quiz = generateQuizForArticle(dummyArticle);
    const parsed = FeedQuizQuestionSchema.safeParse(quiz);

    assert.ok(parsed.success, `Quiz must validate against FeedQuizQuestionSchema: ${parsed.error?.message}`);
    assert.strictEqual(quiz.options.length, 4, 'Quiz must have exactly 4 options');
    assert.ok(quiz.correctIndex >= 0 && quiz.correctIndex < 4, 'correctIndex must be in range 0-3');
    assert.ok(quiz.question.length > 10, 'Question must be substantial');
    assert.ok(quiz.explanation.length > 10, 'Explanation must be substantial');
    assert.strictEqual(quiz.sourceArticleId, dummyArticle.id);
  });

  it('5. Hivemind 2.0: generateHivemindStream generates 4-card sequence with thesis, mechanics, antithesis, and synthesis + quiz', async () => {
    const result = await generateHivemindStream({
      seedTopicOrQuestion: 'Wie verändert generative KI die sokratische Bildung?',
      targetCount: 4,
      preferredLanguage: 'de'
    });

    assert.ok(result.items.length === 4, 'Hivemind stream must return exactly 4 cards');
    assert.ok(result.topic, 'Hivemind stream must infer a valid topic');
    assert.ok(result.synthesisTitle.length > 5, 'Synthesis title must be non-empty');

    const [thesis, mechanics, antithesis, synthesis] = result.items;

    assert.ok(thesis.title.includes('[Kernthese]'), 'Card 1 must be Kernthese');
    assert.ok(mechanics.title.includes('[Tiefenbohrung]'), 'Card 2 must be Tiefenbohrung');
    assert.ok(antithesis.title.includes('[Gegenposition]'), 'Card 3 must be Gegenposition');
    assert.ok(synthesis.title.includes('[Synthese]'), 'Card 4 must be Synthese');

    // Check schema validation on all 4 items
    for (const item of result.items) {
      const parsed = FeedItemSchema.safeParse(item);
      assert.ok(parsed.success, `Hivemind item ${item.title} must validate: ${parsed.error?.message}`);
      assert.ok(item.quiz, 'Each Hivemind item must have a quiz attached');
      assert.strictEqual(item.quiz?.options.length, 4);
    }
  });
});
