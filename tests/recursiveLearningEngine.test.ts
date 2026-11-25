import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  RecursiveLearningEngine,
  applyGentleFeedbackDecay
} from '../src/core/recommendations/recursiveLearningEngine';
import { DEFAULT_USER_PROFILE, INITIAL_FIXTURES } from '../src/core/data/fixtures';
import { scoreFeedItem, extractConceptKeywords } from '../src/core/domain/ranking';
import { LocalLibraryRepository } from '../src/core/data/libraryRepository';
import { AtemStorage, MemoryStorageDriver } from '../src/core/data/storage';
import { UserProfile } from '../src/core/domain/types';

describe('RecursiveLearningEngine (Adaptive Cognitive Personalization)', () => {
  it('retrieves default engine state with base domain trust multipliers', async () => {
    await RecursiveLearningEngine.resetState();
    const state = await RecursiveLearningEngine.getEngineState();
    assert.ok(typeof state.totalLearningCycles === 'number');
    assert.ok(state.domainTrustScores['plato.stanford.edu'] >= 1.2);
    assert.ok(state.domainTrustScores['quantamagazine.org'] >= 1.2);
  });

  it('records upvote and increases topic weight with bounded adaptive dampening', async () => {
    await RecursiveLearningEngine.resetState();
    const item = { ...(INITIAL_FIXTURES.find(f => f.primaryTopic === 'philosophy_ethics') || INITIAL_FIXTURES[0]), id: 'test-item-upvote-1' };
    const targetTopic = item.primaryTopic;
    const initialWeight = DEFAULT_USER_PROFILE.explicitInterests[targetTopic] ?? 0.5;

    const { updatedProfile, event } = await RecursiveLearningEngine.recordInteractionEvent(
      DEFAULT_USER_PROFILE,
      item,
      'upvote'
    );

    assert.ok(event);
    assert.equal(event.type, 'upvote');
    assert.equal(event.topic, targetTopic);
    assert.ok(event.delta > 0);
    const effectiveWeight = updatedProfile.derivedWeights?.[targetTopic] ?? updatedProfile.explicitInterests[targetTopic] ?? 0;
    assert.ok(effectiveWeight > initialWeight);
    // Explicit interests remain untouched
    assert.equal(updatedProfile.explicitInterests[targetTopic], DEFAULT_USER_PROFILE.explicitInterests[targetTopic]);
  });

  it('records critical feedback and dampens topic weight without falling below min floor', async () => {
    await RecursiveLearningEngine.resetState();
    const item = { ...INITIAL_FIXTURES[0], id: 'test-item-feedback-1' };
    const { updatedProfile, event } = await RecursiveLearningEngine.recordInteractionEvent(
      DEFAULT_USER_PROFILE,
      item,
      'feedback_negative'
    );

    assert.ok(event);
    assert.equal(event.type, 'feedback_negative');
    assert.ok(event.delta < 0);
    const effectivePhil = updatedProfile.derivedWeights?.philosophy_ethics ?? updatedProfile.explicitInterests.philosophy_ethics ?? 0;
    assert.ok(effectivePhil >= 0.10);
  });

  it('enforces idempotency on duplicate interaction events for the same item', async () => {
    await RecursiveLearningEngine.resetState();
    const item = { ...INITIAL_FIXTURES[0], id: 'test-item-idempotency-1' };
    const first = await RecursiveLearningEngine.recordInteractionEvent(DEFAULT_USER_PROFILE, item, 'upvote');
    assert.ok(first.event);

    const second = await RecursiveLearningEngine.recordInteractionEvent(first.updatedProfile, item, 'upvote');
    assert.equal(second.event, null);
    assert.deepEqual(second.updatedProfile.derivedWeights, first.updatedProfile.derivedWeights);
  });

  it('enforces composite idempotency when interleaved with another event type (Upvote -> Note -> same Upvote)', async () => {
    await RecursiveLearningEngine.resetState();
    const item = { ...INITIAL_FIXTURES[0], id: 'test-item-interleaved-idempotency' };
    const primaryTopic = item.primaryTopic || 'philosophy_ethics';

    // 1. Upvote
    const step1 = await RecursiveLearningEngine.recordInteractionEvent(DEFAULT_USER_PROFILE, item, 'upvote');
    assert.ok(step1.event);
    const weightAfterUpvote = step1.updatedProfile.derivedWeights?.[primaryTopic] ?? 0;

    // 2. Note created (different event type on the same item)
    const step2 = await RecursiveLearningEngine.recordInteractionEvent(step1.updatedProfile, item, 'note_created');
    assert.ok(step2.event);
    const weightAfterNote = step2.updatedProfile.derivedWeights?.[primaryTopic] ?? 0;
    assert.ok(weightAfterNote > weightAfterUpvote);

    // 3. Same Upvote again on the same item -> MUST be rejected by composite idempotency
    const step3 = await RecursiveLearningEngine.recordInteractionEvent(step2.updatedProfile, item, 'upvote');
    assert.equal(step3.event, null, 'Duplicate upvote must be rejected despite interleaved note event');
    assert.equal(
      step3.updatedProfile.derivedWeights?.[primaryTopic],
      weightAfterNote,
      'Topic weight must not increase from repeated upvote'
    );
  });

  it('generates transparent explanation of topic evolution', () => {
    const explanation = RecursiveLearningEngine.explainTopicEvolution('philosophy_ethics', []);
    assert.ok(explanation.includes('Grundkalibrierung'));
  });

  it('records bookmark_saved and completed_reading and propagates signals into feedbackMemory and domainTrustScores', async () => {
    await RecursiveLearningEngine.resetState();
    const baseItem = INITIAL_FIXTURES.find(f => f.primaryTopic === 'ai_apple') || INITIAL_FIXTURES[0];
    const testItem = {
      ...baseItem,
      id: 'test-bookmark-completed-1',
      title: 'Kognitive Werkzeuge und Emergenz',
      sourceDomain: 'www.emergent-epistemology.org',
      space: 'c/acceleration',
      sourceReferences: [
        {
          publisher: 'Emergent Epistemology Press',
          originalUrl: 'https://www.emergent-epistemology.org/article',
          title: 'Original',
          retrievalTimestamp: new Date().toISOString(),
          author: 'Dr. Clara Brentano',
          isVerified: true
        }
      ]
    };

    const topKeywords = extractConceptKeywords(testItem).slice(0, 2);
    const baseProfile: UserProfile = {
      ...DEFAULT_USER_PROFILE,
      derivedWeights: { [testItem.primaryTopic]: 0.50 },
      feedbackMemory: {
        boostedTopics: {},
        penalizedTopics: {},
        boostedAuthors: {},
        penalizedAuthors: {},
        boostedKeywords: {},
        penalizedKeywords: {},
        boostedDomains: {},
        penalizedDomains: {},
        boostedSpaces: {},
        penalizedSpaces: {}
      }
    };

    const bookmarkRes = await RecursiveLearningEngine.recordInteractionEvent(baseProfile, testItem, 'bookmark_saved');
    assert.ok(bookmarkRes.event);
    assert.equal(bookmarkRes.event.type, 'bookmark_saved');
    assert.ok(bookmarkRes.event.reason.includes('Als Lesezeichen gesichert'));
    assert.ok((bookmarkRes.updatedProfile.derivedWeights?.[testItem.primaryTopic] ?? 0) > 0.50);
    assert.equal(bookmarkRes.updatedProfile.feedbackMemory.boostedTopics[testItem.primaryTopic], 1);
    assert.equal(bookmarkRes.updatedProfile.feedbackMemory.boostedDomains['www.emergent-epistemology.org'], 1);
    assert.equal(bookmarkRes.updatedProfile.feedbackMemory.boostedAuthors['Dr. Clara Brentano'], 1);
    assert.equal(bookmarkRes.updatedProfile.feedbackMemory.boostedSpaces['c/acceleration'], 1);
    for (const kw of topKeywords) {
      assert.equal(bookmarkRes.updatedProfile.feedbackMemory.boostedKeywords[kw], 1);
    }

    const completedRes = await RecursiveLearningEngine.recordInteractionEvent(
      bookmarkRes.updatedProfile,
      testItem,
      'completed_reading'
    );
    assert.ok(completedRes.event);
    assert.equal(completedRes.event.type, 'completed_reading');
    assert.ok(
      (completedRes.updatedProfile.derivedWeights?.[testItem.primaryTopic] ?? 0) >
      (bookmarkRes.updatedProfile.derivedWeights?.[testItem.primaryTopic] ?? 0)
    );
    assert.equal(completedRes.updatedProfile.feedbackMemory.boostedTopics[testItem.primaryTopic], 2);
    assert.equal(completedRes.updatedProfile.feedbackMemory.boostedAuthors['Dr. Clara Brentano'], 2);

    const trustCache = RecursiveLearningEngine.getCachedDomainTrustScores();
    assert.ok(trustCache['emergent-epistemology.org'] > 1.0);
    assert.ok(trustCache['Emergent Epistemology Press'] > 1.0);
  });

  it('incorporates domainTrustScores into scoreFeedItem and whyFactors', async () => {
    await RecursiveLearningEngine.resetState();
    const item = {
      ...INITIAL_FIXTURES[0],
      id: 'trust-score-test-1',
      sourceDomain: 'www.example-journal.de',
      sourceReferences: [
        {
          publisher: 'Example Journal',
          originalUrl: 'https://www.example-journal.de/piece',
          title: 'Source',
          retrievalTimestamp: new Date().toISOString(),
          isVerified: true
        }
      ]
    };

    const neutral = scoreFeedItem(item, DEFAULT_USER_PROFILE, {}, {});
    const trusted = scoreFeedItem(item, DEFAULT_USER_PROFILE, {}, { 'example-journal.de': 1.40 });
    const untrusted = scoreFeedItem(item, DEFAULT_USER_PROFILE, {}, { 'example-journal.de': 0.65 });

    assert.ok(trusted.score > neutral.score, `Expected trusted (${trusted.score}) > neutral (${neutral.score})`);
    assert.ok(untrusted.score < neutral.score, `Expected untrusted (${untrusted.score}) < neutral (${neutral.score})`);
    assert.ok(
      trusted.scoreBreakdown.whyFactors.some(f => f.includes('Gelerntes Quellen-Vertrauen: +40%'))
    );
    assert.ok(
      untrusted.scoreBreakdown.whyFactors.some(f => f.includes('Gelerntes Quellen-Vertrauen: -35%'))
    );
  });

  it('applyGentleFeedbackDecay stamps missing timestamp without decaying, decays after >24h, and preserves feedMixRatio', () => {
    const startMs = Date.UTC(2026, 9, 1, 12, 0, 0);
    const initialProfile: UserProfile = {
      ...DEFAULT_USER_PROFILE,
      explicitInterests: {
        ...DEFAULT_USER_PROFILE.explicitInterests,
        ai_apple: 0.60
      },
      derivedWeights: {
        ai_apple: 0.90
      },
      feedMixRatio: {
        focusRatio: 0.55,
        socraticRatio: 0.30,
        serendipityRatio: 0.15
      },
      feedbackMemory: {
        boostedTopics: { ai_apple: 2, sound_synthesis: 0.2 },
        penalizedTopics: { memes_satire: 1 },
        boostedAuthors: { 'Author A': 4 },
        penalizedAuthors: {},
        boostedKeywords: { epistemik: 2 },
        penalizedKeywords: {},
        boostedDomains: { 'quantamagazine.org': 2 },
        penalizedDomains: {},
        boostedSpaces: { 'c/acceleration': 1 },
        penalizedSpaces: {}
      }
    };

    // 1. Missing lastFeedbackDecayAt -> stamps now without decaying
    const stamped = applyGentleFeedbackDecay(initialProfile, startMs);
    assert.equal(stamped.feedbackMemory.lastFeedbackDecayAt, new Date(startMs).toISOString());
    assert.equal(stamped.derivedWeights?.ai_apple, 0.90);
    assert.equal(stamped.feedbackMemory.boostedTopics.ai_apple, 2);
    assert.equal(stamped.feedbackMemory.boostedTopics.sound_synthesis, 0.2);

    // 2. Within 24h -> no-op
    const within24h = applyGentleFeedbackDecay(stamped, startMs + 12 * 60 * 60 * 1000);
    assert.strictEqual(within24h, stamped);

    // 3. After 28 days -> half-life decay (factor = 0.5), pruning < 0.15, relaxing derivedWeights halfway to explicitInterests
    const after28Days = applyGentleFeedbackDecay(stamped, startMs + 28 * 24 * 60 * 60 * 1000);
    assert.equal(after28Days.feedbackMemory.boostedTopics.ai_apple, 1);
    assert.equal(after28Days.feedbackMemory.boostedTopics.sound_synthesis, undefined); // 0.2 * 0.5 = 0.10 < 0.15 pruned
    assert.equal(after28Days.feedbackMemory.boostedAuthors['Author A'], 2);
    assert.equal(after28Days.feedbackMemory.penalizedTopics.memes_satire, 0.5);
    assert.equal(after28Days.derivedWeights?.ai_apple, 0.75); // halfway from 0.90 toward 0.60
    assert.deepEqual(after28Days.feedMixRatio, initialProfile.feedMixRatio);
  });

  it('persists upvotedAt and itemSnapshot in libraryRepository.voteItem and preserves snapshot on down/clear', async () => {
    const repo = new LocalLibraryRepository(new AtemStorage(new MemoryStorageDriver()));
    const snapshot = {
      title: 'Epistemische Hygiene im digitalen Zeitalter',
      subtitle: 'Warum Langsamkeit Tiefe erzeugt',
      publisher: 'Aeon',
      sourceDomain: 'aeon.co',
      space: 'c/dialektik',
      primaryTopic: 'philosophy_ethics' as const,
      canonicalUrl: 'https://aeon.co/essays/epistemic-hygiene',
      estimatedReadingMinutes: 6
    };

    const upvoted = await repo.voteItem('snap-item-1', 'up', snapshot);
    assert.equal(upvoted.voteScore, 1);
    assert.ok(upvoted.upvotedAt);
    assert.deepEqual(upvoted.itemSnapshot, snapshot);

    const firstUpvotedAt = upvoted.upvotedAt;
    const upvotedAgain = await repo.voteItem('snap-item-1', 'up');
    assert.equal(upvotedAgain.upvotedAt, firstUpvotedAt);
    assert.deepEqual(upvotedAgain.itemSnapshot, snapshot);

    const cleared = await repo.voteItem('snap-item-1', 'clear');
    assert.equal(cleared.voteScore, 0);
    assert.equal(cleared.upvotedAt, undefined);
    assert.deepEqual(cleared.itemSnapshot, snapshot);

    const downvoted = await repo.voteItem('snap-item-1', 'down');
    assert.equal(downvoted.voteScore, -1);
    assert.equal(downvoted.upvotedAt, undefined);
    assert.deepEqual(downvoted.itemSnapshot, snapshot);
  });
});
