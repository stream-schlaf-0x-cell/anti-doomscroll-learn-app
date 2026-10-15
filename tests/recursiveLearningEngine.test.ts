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

  it('records upvote and increases topic weight with Bayesian dampening', async () => {
    const item = INITIAL_FIXTURES.find(f => f.primaryTopic === 'philosophy_ethics') || INITIAL_FIXTURES[0];
    const targetTopic = item.primaryTopic;
    const initialWeight = DEFAULT_USER_PROFILE.explicitInterests[targetTopic] ?? 0.5;

    const { updatedProfile, event } = await RecursiveLearningEngine.recordInteractionEvent(
      DEFAULT_USER_PROFILE,
      item,
      'upvote'
    );

    assert.equal(event.type, 'upvote');
    assert.equal(event.topic, targetTopic);
    assert.ok(event.delta > 0);
    assert.ok((updatedProfile.explicitInterests[targetTopic] ?? 0) > initialWeight);
  });

  it('records critical feedback and dampens topic weight without falling below min floor', async () => {
    const item = INITIAL_FIXTURES[0];
    const { updatedProfile, event } = await RecursiveLearningEngine.recordInteractionEvent(
      DEFAULT_USER_PROFILE,
      item,
      'feedback_negative'
    );

    assert.equal(event.type, 'feedback_negative');
    assert.ok(event.delta < 0);
    assert.ok((updatedProfile.explicitInterests.philosophy_ethics ?? 0) >= 0.10);
  });

  it('generates transparent explanation of topic evolution', () => {
    const explanation = RecursiveLearningEngine.explainTopicEvolution('philosophy_ethics', []);
    assert.ok(explanation.includes('Grundkalibrierung'));
  });
});
