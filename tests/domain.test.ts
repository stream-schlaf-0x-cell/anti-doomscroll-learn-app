import { describe, it } from 'node:test';
import assert from 'node:assert';
import { FeedItemSchema, UserProfileSchema, ReadingInteractionSchema } from '../src/core/domain/types';
import { INITIAL_FIXTURES, DEFAULT_USER_PROFILE } from '../src/core/data/fixtures';
import { scoreFeedItem, rankAndInterleaveFeed } from '../src/core/domain/ranking';

describe('Domain Schemas & Invariant Validation', () => {
  it('should validate all initial fixtures against FeedItemSchema', () => {
    for (const fixture of INITIAL_FIXTURES) {
      const parsed = FeedItemSchema.safeParse(fixture);
      assert.strictEqual(
        parsed.success,
        true,
        `Fixture ${fixture.id} failed validation: ${parsed.error?.message}`
      );
    }
  });

  it('should validate default user profile against UserProfileSchema', () => {
    const parsed = UserProfileSchema.safeParse(DEFAULT_USER_PROFILE);
    assert.strictEqual(parsed.success, true, 'Default user profile failed validation');
  });

  it('should reject invalid reading interaction schema data', () => {
    const invalid = { itemId: '123', progressPercent: 150 }; // progress > 100
    const parsed = ReadingInteractionSchema.safeParse(invalid);
    assert.strictEqual(parsed.success, false, 'Invalid progress was incorrectly accepted');
  });
});

describe('Deterministic Ranking Engine', () => {
  it('should assign higher score to articles matching top user interests', () => {
    const profile = {
      ...DEFAULT_USER_PROFILE,
      explicitInterests: {
        philosophy_ethics: 1.0,
        german_didactics: 0.1,
        ai_apple: 0.1,
        contemplation_mind: 0.1,
        science_society: 0.1,
        sound_synthesis: 0.1
      }
    };

    const philItem = INITIAL_FIXTURES.find(i => i.primaryTopic === 'philosophy_ethics')!;
    const didacticsItem = INITIAL_FIXTURES.find(i => i.primaryTopic === 'german_didactics')!;

    const scoredPhil = scoreFeedItem(philItem, profile);
    const scoredDidactics = scoreFeedItem(didacticsItem, profile);

    assert.ok(
      scoredPhil.score > scoredDidactics.score,
      `Expected philosophy (${scoredPhil.score}) > didactics (${scoredDidactics.score})`
    );
  });

  it('should boost items matching user reading duration preference', () => {
    const quickProfile = {
      ...DEFAULT_USER_PROFILE,
      readingPreferences: {
        ...DEFAULT_USER_PROFILE.readingPreferences,
        preferredDuration: 'quick' as const
      }
    };

    const quickItem = INITIAL_FIXTURES.find(i => i.estimatedReadingMinutes <= 2)!;
    const deepItem = INITIAL_FIXTURES.find(i => i.estimatedReadingMinutes >= 5)!;

    const scoredQuick = scoreFeedItem(quickItem, quickProfile);
    const scoredDeep = scoreFeedItem(deepItem, quickProfile);

    assert.ok(
      scoredQuick.scoreBreakdown.durationMatch > scoredDeep.scoreBreakdown.durationMatch,
      'Quick profile should favor short duration'
    );
  });

  it('should adjust scores based on explicit user feedback', () => {
    const item = INITIAL_FIXTURES[0];
    const normal = scoreFeedItem(item, DEFAULT_USER_PROFILE, {});
    const positive = scoreFeedItem(item, DEFAULT_USER_PROFILE, {
      [item.id]: { itemId: item.id, saved: false, progressPercent: 0, feedback: 'more_like_this' }
    });
    const negative = scoreFeedItem(item, DEFAULT_USER_PROFILE, {
      [item.id]: { itemId: item.id, saved: false, progressPercent: 0, feedback: 'less_like_this' }
    });

    assert.ok(positive.score > normal.score, 'Positive feedback should increase score');
    assert.ok(negative.score < normal.score, 'Negative feedback should decrease score');
  });

  it('should interleave topics to avoid clumping identical primary topics', () => {
    const ranked = rankAndInterleaveFeed(INITIAL_FIXTURES, DEFAULT_USER_PROFILE, {});
    assert.ok(ranked.length > 0, 'Ranked feed should not be empty');

    // Verify consecutive items do not share identical primaryTopic if alternative exists
    for (let i = 0; i < ranked.length - 1; i++) {
      const current = ranked[i].primaryTopic;
      const next = ranked[i + 1].primaryTopic;
      // In a diverse pool, consecutive duplicates should be minimized
      if (current === next) {
        // If consecutive match happened, ensure no unselected alternative existed
        const remaining = ranked.slice(i + 1);
        const distinctRemaining = remaining.filter(item => item.primaryTopic !== current);
        assert.ok(
          distinctRemaining.length === 0,
          `Found consecutive duplicate topic "${current}" when other topics remained`
        );
      }
    }
  });

  it('should produce transparent German explanation breakdown', () => {
    const item = INITIAL_FIXTURES[0];
    const scored = scoreFeedItem(item, DEFAULT_USER_PROFILE);
    assert.ok(scored.relevanceExplanation.includes('Affinität zu'), 'Explanation should mention affinity');
    assert.ok(scored.scoreBreakdown.explanation.length > 10, 'Explanation must not be empty');
  });
});
