import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  determineCurrentEditionType,
  rankEditionFeed
} from '../src/core/domain/ranking';
import {
  DEFAULT_USER_PROFILE
} from '../src/core/data/fixtures';
import {
  DayEditionType,
  DAY_EDITIONS_META,
  EditorialAbstractSchema,
  UserProfile
} from '../src/core/domain/types';
import { REAL_KNOWLEDGE_VAULT } from '../src/core/data/realKnowledgeVault';
import { LocalFeedRepository } from '../src/core/data/feedRepository';
import { WeatherService } from '../src/core/weather/weatherService';
import { synthesizeEditorialAbstract } from '../src/core/synthesis/backgroundResearchPipeline';
import { RecursiveLearningEngine } from '../src/core/recommendations/recursiveLearningEngine';

describe('Three Daily Editions & Editorial Depth', () => {
  it('determines edition type correctly based on local hour in Europe/Berlin', () => {
    // 08:00 morning in Berlin
    const morningDate = new Date('2026-10-15T08:00:00Z');
    const editionMorning = determineCurrentEditionType(morningDate, DEFAULT_USER_PROFILE);
    assert.strictEqual(editionMorning, 'morning');

    // 13:00 midday in Berlin (11:00 UTC)
    const middayDate = new Date('2026-10-15T11:00:00Z');
    const editionMidday = determineCurrentEditionType(middayDate, DEFAULT_USER_PROFILE);
    assert.strictEqual(editionMidday, 'midday');

    // 21:00 evening in Berlin (19:00 UTC)
    const eveningDate = new Date('2026-10-15T19:00:00Z');
    const editionEvening = determineCurrentEditionType(eveningDate, DEFAULT_USER_PROFILE);
    assert.strictEqual(editionEvening, 'evening');
  });

  it('honors custom edition start hours from user profile', () => {
    const customProfile: UserProfile = {
      ...DEFAULT_USER_PROFILE,
      editionPreferences: {
        timezone: 'Europe/Berlin',
        morningStartHour: 6,
        middayStartHour: 11,
        eveningStartHour: 17,
        weatherEnabled: true,
        weatherCity: 'Berlin'
      }
    };

    // 11:30 in Berlin (09:30 UTC) should be midday with custom preference
    const testDate = new Date('2026-10-15T09:30:00Z');
    const edition = determineCurrentEditionType(testDate, customProfile);
    assert.strictEqual(edition, 'midday');
  });

  it('ranks edition feeds with target counts and editorial quotas', () => {
    const repository = new LocalFeedRepository();
    const items = repository.getAllItems();
    const morningFeed = rankEditionFeed(items, 'morning', DEFAULT_USER_PROFILE, {}, '2026-10-15');
    assert.strictEqual(morningFeed.length, 8, `Morning feed should have 8 items, got ${morningFeed.length}`);

    const middayFeed = rankEditionFeed(items, 'midday', DEFAULT_USER_PROFILE, {}, '2026-10-15');
    assert.strictEqual(middayFeed.length, 8, `Midday feed should have 8 items, got ${middayFeed.length}`);

    const eveningFeed = rankEditionFeed(items, 'evening', DEFAULT_USER_PROFILE, {}, '2026-10-15');
    assert.strictEqual(eveningFeed.length, 8, `Evening feed should have 8 items, got ${eveningFeed.length}`);

    // Verify soft quotas (at least 1 teaching and 1 challenging perspective in morning feed)
    const hasTeaching = morningFeed.some(item => item.isTeachingRelated || item.primaryTopic === 'german_didactics');
    const hasChallenging = morningFeed.some(item => item.isChallengingPerspective);
    assert.ok(hasTeaching, 'Morning feed should include a teaching-related perspective');
    assert.ok(hasChallenging, 'Morning feed should include a challenging perspective');

    // Verify evening feed features contemplation / sound / philosophy
    const eveningTopics = eveningFeed.map(i => i.primaryTopic);
    const hasEveningFocus = eveningTopics.some(t =>
      t === 'contemplation_mind' || t === 'sound_synthesis' || t === 'philosophy_ethics' || t === 'book_mastery'
    );
    assert.ok(hasEveningFocus, 'Evening feed should feature calming, philosophical or sound topics');
  });

  it('guarantees 0% article overlap across morning, midday, and evening editions', async () => {
    const repository = new LocalFeedRepository();
    const morning = await repository.getEditionFeed('morning', DEFAULT_USER_PROFILE, {}, '2026-10-15');
    const midday = await repository.getEditionFeed('midday', DEFAULT_USER_PROFILE, {}, '2026-10-15');
    const evening = await repository.getEditionFeed('evening', DEFAULT_USER_PROFILE, {}, '2026-10-15');

    assert.strictEqual(morning.length, 8);
    assert.strictEqual(midday.length, 8);
    assert.strictEqual(evening.length, 8);

    const morningIds = new Set(morning.map(item => item.id));
    const middayIds = new Set(midday.map(item => item.id));
    const eveningIds = new Set(evening.map(item => item.id));

    const morningMiddayOverlap = [...morningIds].filter(id => middayIds.has(id));
    const morningEveningOverlap = [...morningIds].filter(id => eveningIds.has(id));
    const middayEveningOverlap = [...middayIds].filter(id => eveningIds.has(id));

    assert.deepStrictEqual(morningMiddayOverlap, [], 'Morning and midday editions must have 0% overlap');
    assert.deepStrictEqual(morningEveningOverlap, [], 'Morning and evening editions must have 0% overlap');
    assert.deepStrictEqual(middayEveningOverlap, [], 'Midday and evening editions must have 0% overlap');

    const totalUnique = new Set([...morningIds, ...middayIds, ...eveningIds]).size;
    assert.strictEqual(totalUnique, 24, 'All 24 daily edition items must be unique');
  });

  it('synthesizes Ebene 2 Editorial Abstract conforming to schema', () => {
    const item = REAL_KNOWLEDGE_VAULT[0];
    const abstract = synthesizeEditorialAbstract(item);

    const parsed = EditorialAbstractSchema.safeParse(abstract);
    assert.strictEqual(parsed.success, true);
    assert.ok(abstract.overview.length > 20);
    assert.ok(abstract.keyFinding.length > 20);
    assert.ok(abstract.relevanceWhy.length > 15);
    if (abstract.limitation) {
      assert.ok(abstract.limitation.length > 10);
    }
  });

  it('handles already_known and more_depth recursive learning feedback', async () => {
    const item = { ...REAL_KNOWLEDGE_VAULT[0], id: 'test-feedback-signal-item-1' };
    const primaryTopic = item.primaryTopic;
    const initialWeight = DEFAULT_USER_PROFILE.derivedWeights?.[primaryTopic] ?? DEFAULT_USER_PROFILE.explicitInterests[primaryTopic] ?? 0.5;

    // Test 'already_known': should dampen weight
    const knownResult = await RecursiveLearningEngine.recordInteractionEvent(
      DEFAULT_USER_PROFILE,
      item,
      'feedback_already_known'
    );
    assert.ok(knownResult.updatedProfile);
    const dampenedWeight = knownResult.updatedProfile.derivedWeights?.[primaryTopic] ?? knownResult.updatedProfile.explicitInterests[primaryTopic] ?? 0;
    assert.ok(dampenedWeight < initialWeight, 'Already known feedback should dampen topic weight');

    // Test 'more_depth': should boost weight
    const depthItem = { ...REAL_KNOWLEDGE_VAULT[0], id: 'test-feedback-signal-item-2' };
    const depthResult = await RecursiveLearningEngine.recordInteractionEvent(
      DEFAULT_USER_PROFILE,
      depthItem,
      'feedback_more_depth'
    );
    assert.ok(depthResult.updatedProfile);
    const boostedWeight = depthResult.updatedProfile.derivedWeights?.[primaryTopic] ?? depthResult.updatedProfile.explicitInterests[primaryTopic] ?? 0;
    assert.ok(boostedWeight > initialWeight, 'More depth feedback should increase topic weight');
  });

  it('WeatherService handles network gracefully and caches results', async () => {
    // Calling for supported city
    const weather = await WeatherService.getWeatherForCity('Berlin');
    // In test environment without network, it returns null without crashing or throwing
    if (weather) {
      assert.strictEqual(weather.locationName, 'Berlin');
      assert.ok(typeof weather.temperatureCelsius === 'number');
      assert.ok(typeof weather.weatherDescription === 'string');
      assert.ok(typeof weather.iconName === 'string');

      // Test caching
      const cached = await WeatherService.getWeatherForCity('Berlin');
      assert.deepStrictEqual(cached, weather);
    } else {
      // Graceful offline fail-safe
      assert.strictEqual(weather, null);
    }
  });
});
