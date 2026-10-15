import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { RecursiveLearningEngine } from '../src/core/recommendations/recursiveLearningEngine';
import { DEFAULT_USER_PROFILE } from '../src/core/data/fixtures';
import { INITIAL_FIXTURES } from '../src/core/data/fixtures';

describe('RecursiveLearningEngine (Adaptive Cognitive Personalization)', () => {
  it('retrieves default engine state with base domain trust multipliers', async () => {
    const state = await RecursiveLearningEngine.getEngineState();
    assert.ok(typeof state.totalLearningCycles === 'number');
    assert.ok(state.domainTrustScores['plato.stanford.edu'] >= 1.2);
    assert.ok(state.domainTrustScores['quantamagazine.org'] >= 1.2);
  });

  it('records upvote and increases topic weight with bounded adaptive dampening', async () => {
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
    const item = { ...INITIAL_FIXTURES[0], id: 'test-item-idempotency-1' };
    const first = await RecursiveLearningEngine.recordInteractionEvent(DEFAULT_USER_PROFILE, item, 'upvote');
    assert.ok(first.event);

    const second = await RecursiveLearningEngine.recordInteractionEvent(first.updatedProfile, item, 'upvote');
    assert.equal(second.event, null);
    assert.deepEqual(second.updatedProfile.derivedWeights, first.updatedProfile.derivedWeights);
  });

  it('enforces composite idempotency when interleaved with another event type (Upvote -> Note -> same Upvote)', async () => {
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
});
