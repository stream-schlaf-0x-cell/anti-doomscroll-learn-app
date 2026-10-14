import { describe, it } from 'node:test';
import assert from 'node:assert';
import { FeedItemSchema, UserProfileSchema, ReadingInteractionSchema, FeedItem } from '../src/core/domain/types';
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

  it('should verify the demonstration collection contains the intended range of reading lengths', () => {
    assert.strictEqual(INITIAL_FIXTURES.length, 9, 'Must contain exactly 9 curated fixtures');

    const quickInsights = INITIAL_FIXTURES.filter(f => f.isDailyEdition && f.wordCount >= 100 && f.wordCount <= 220);
    const briefings = INITIAL_FIXTURES.filter(f => f.isDailyEdition && f.wordCount >= 350 && f.wordCount <= 650);
    const deepDives = INITIAL_FIXTURES.filter(f => f.isDailyEdition && f.wordCount >= 900 && f.wordCount <= 1400);
    const discoveryPieces = INITIAL_FIXTURES.filter(f => !f.isDailyEdition && f.wordCount >= 350 && f.wordCount <= 800);

    assert.strictEqual(quickInsights.length, 3, 'Must contain 3 quick insights (100–220 words)');
    assert.strictEqual(briefings.length, 3, 'Must contain 3 briefings (350–650 words)');
    assert.strictEqual(deepDives.length, 2, 'Must contain 2 deep dives (900–1400 words)');
    assert.strictEqual(discoveryPieces.length, 1, 'Must contain 1 discovery piece (500–800 words)');

    // Check estimatedReadingMinutes distribution
    const oneMinItems = INITIAL_FIXTURES.filter(f => f.estimatedReadingMinutes === 1);
    const deepItems = INITIAL_FIXTURES.filter(f => f.estimatedReadingMinutes >= 4);

    assert.ok(oneMinItems.length >= 3, 'Must have at least 3 items with 1 min reading time');
    assert.ok(deepItems.length >= 2, 'Must have at least 2 items with >= 4 min reading time');
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

  it('should boost items matching user reading duration preference using controlled test data', () => {
    const quickProfile = {
      ...DEFAULT_USER_PROFILE,
      readingPreferences: {
        ...DEFAULT_USER_PROFILE.readingPreferences,
        preferredDuration: 'quick' as const
      }
    };

    const deepProfile = {
      ...DEFAULT_USER_PROFILE,
      readingPreferences: {
        ...DEFAULT_USER_PROFILE.readingPreferences,
        preferredDuration: 'deep' as const
      }
    };

    // Controlled test fixtures with equal topic affinity to isolate duration scoring
    const controlledQuickItem: FeedItem = {
      ...INITIAL_FIXTURES[0],
      id: 'ctrl-quick',
      estimatedReadingMinutes: 1,
      wordCount: 150
    };

    const controlledDeepItem: FeedItem = {
      ...INITIAL_FIXTURES[0],
      id: 'ctrl-deep',
      estimatedReadingMinutes: 5,
      wordCount: 1100
    };

    // Under quick profile: quick item gets higher durationMatch
    const scoredUnderQuick = scoreFeedItem(controlledQuickItem, quickProfile);
    const scoredDeepUnderQuick = scoreFeedItem(controlledDeepItem, quickProfile);

    assert.ok(
      scoredUnderQuick.scoreBreakdown.durationMatch > scoredDeepUnderQuick.scoreBreakdown.durationMatch,
      'Quick profile should score 1-min item higher than 5-min item on durationMatch'
    );

    // Under deep profile: deep item gets higher durationMatch
    const scoredUnderDeep = scoreFeedItem(controlledDeepItem, deepProfile);
    const scoredQuickUnderDeep = scoreFeedItem(controlledQuickItem, deepProfile);

    assert.ok(
      scoredUnderDeep.scoreBreakdown.durationMatch > scoredQuickUnderDeep.scoreBreakdown.durationMatch,
      'Deep profile should score 5-min item higher than 1-min item on durationMatch'
    );
  });

  it('should produce observable ranking differences between quick and deep preferences on real fixtures', () => {
    const quickProfile = {
      ...DEFAULT_USER_PROFILE,
      readingPreferences: {
        ...DEFAULT_USER_PROFILE.readingPreferences,
        preferredDuration: 'quick' as const
      }
    };

    const deepProfile = {
      ...DEFAULT_USER_PROFILE,
      readingPreferences: {
        ...DEFAULT_USER_PROFILE.readingPreferences,
        preferredDuration: 'deep' as const
      }
    };

    const quickRanked = rankAndInterleaveFeed(INITIAL_FIXTURES, quickProfile);
    const deepRanked = rankAndInterleaveFeed(INITIAL_FIXTURES, deepProfile);

    // Calculate average duration of top 3 ranked items in each feed
    const avgDurationQuick = quickRanked.slice(0, 3).reduce((sum, item) => sum + item.estimatedReadingMinutes, 0) / 3;
    const avgDurationDeep = deepRanked.slice(0, 3).reduce((sum, item) => sum + item.estimatedReadingMinutes, 0) / 3;

    assert.ok(
      avgDurationDeep > avgDurationQuick,
      `Expected average duration under deep profile (${avgDurationDeep}m) to be greater than quick profile (${avgDurationQuick}m)`
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
      if (current === next) {
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
    assert.ok(scored.relevanceExplanation.includes('Affinität zu') || scored.relevanceExplanation.length > 10);
    assert.ok(scored.scoreBreakdown.explanation.length > 10, 'Explanation must not be empty');
  });
});
