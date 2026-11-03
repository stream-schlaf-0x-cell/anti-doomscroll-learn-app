import test from 'node:test';
import assert from 'node:assert/strict';
import { LiveCivicPulseService } from '../src/core/ingestion/liveCivicPulseService';
import { seenImpressionsService } from '../src/core/data/seenImpressionsService';
import { FeedItem } from '../src/core/domain/types';

test('Surgical Hotfix Suite', async (t) => {
  await t.test('1. liveCivicPulseService fallback items have static historical timestamps', () => {
    const pool = LiveCivicPulseService.getCuratedRealityAndSerendipityPool();
    assert.ok(pool.length >= 4, 'Fallback pool should have at least 4 items');

    const sachsenKi = pool.find(item => item.id === 'civic-fallback-sachsen-ki-1');
    assert.ok(sachsenKi, 'Sachsen KI fallback item must exist with deterministic ID civic-fallback-sachsen-ki-1');
    assert.ok(
      sachsenKi.publishedAt === '2026-10-20T09:00:00.000Z' || sachsenKi.publishedAt === '2026-10-25T09:00:00.000Z',
      'Published timestamp must be fixed historical, not rolling Date.now()'
    );
    assert.equal(sachsenKi.isStaticFallback, true, 'Fallback items must be flagged with isStaticFallback: true');

    for (const item of pool) {
      assert.ok(
        item.publishedAt === '2026-10-20T09:00:00.000Z' || item.publishedAt === '2026-10-25T09:00:00.000Z',
        `Item ${item.id} must have static historical publishedAt`
      );
      assert.equal(item.isStaticFallback, true, `Item ${item.id} must be flagged as static fallback`);
      // Ensure the timestamp is not within the last 24 hours of current Date.now()
      const ageMs = Date.now() - new Date(item.publishedAt).getTime();
      assert.ok(ageMs > 24 * 3600 * 1000, `Item ${item.id} must not have rolling relative timestamp (age: ${ageMs}ms)`);
    }
  });

  await t.test('2. Already-seen items and static fallback items never receive pinnedManualRunAt', async () => {
    // Record an ID as already seen
    const seenId = 'already-seen-card-123';
    await seenImpressionsService.recordSeen([seenId]);

    const fakeSeenCandidate: FeedItem = {
      id: seenId,
      type: 'deep_dive',
      format: 'sourced_update',
      title: 'Ein bereits gelesener Artikel zur digitalen Bildung',
      subtitle: 'Warum dieser Beitrag nicht erneut an die Spitze gepinnt werden darf',
      feedText: 'Ein fundierter Beitrag, der bereits in einer früheren Sitzung gelesen wurde.',
      body: 'Ein fundierter Beitrag, der bereits in einer früheren Sitzung gelesen wurde.',
      topics: ['german_didactics'],
      primaryTopic: 'german_didactics',
      sourceReferences: [{
        publisher: 'Test Quelle',
        originalUrl: 'https://example.com/seen',
        title: 'Bereits gesehen',
        publicationTimestamp: '2026-11-01T10:00:00.000Z',
        retrievalTimestamp: '2026-11-01T10:00:00.000Z',
        author: 'Redaktion',
        isVerified: true
      }],
      publishedAt: '2026-11-01T10:00:00.000Z',
      generatedAt: '2026-11-01T10:00:00.000Z',
      estimatedReadingMinutes: 3,
      relevanceExplanation: 'Test Relevanz',
      contentStatus: 'editorial_briefing',
      isDailyEdition: false,
      editionDate: '2026-11-01',
      isTeachingRelated: true,
      isChallengingPerspective: false,
      isDemonstration: false,
      aiAssisted: false,
      factReviewStatus: 'pedagogical_concept',
      provenanceSummary: 'Test Provenance',
      wordCount: 80,
      evidenceTier: 'publisher_excerpt',
      contentOrigin: 'live_ingested',
      contentHash: 'hash-seen-1',
      canonicalUrl: 'https://example.com/seen',
      space: 'c/didaktik_labor',
      upvotesCount: 0,
      awardsCount: { gold: 0, brain: 0, spark: 0 },
      sourceTrustLevel: 'verified_creator',
      comments: []
    };

    const freshCandidate: FeedItem = {
      ...fakeSeenCandidate,
      id: 'brand-new-card-999',
      title: 'Ganz frisch entdeckte Primärquelle zur Bildungsforschung',
      contentHash: 'hash-fresh-999',
      canonicalUrl: 'https://example.com/fresh'
    };

    const staticFallback: FeedItem = {
      ...fakeSeenCandidate,
      id: 'civic-fallback-sachsen-ki-1',
      isStaticFallback: true,
      contentHash: 'hash-fallback-1',
      canonicalUrl: 'https://example.com/fallback'
    };

    const result = await LiveCivicPulseService.runManualResearchPipeline({
      candidateOverride: [fakeSeenCandidate, freshCandidate, staticFallback],
      existingIds: new Set([fakeSeenCandidate.id])
    });

    const seenOut = result.items.find(i => i.id === fakeSeenCandidate.id);
    const freshOut = result.items.find(i => i.id === freshCandidate.id);
    const fallbackOut = result.items.find(i => i.id === staticFallback.id);

    if (seenOut) {
      assert.equal(seenOut.pinnedManualRunAt, undefined, 'Already-seen item must never have pinnedManualRunAt stamped');
    }
    if (fallbackOut) {
      assert.equal(fallbackOut.pinnedManualRunAt, undefined, 'Static fallback item must never have pinnedManualRunAt stamped');
    }
    if (freshOut) {
      assert.ok(typeof freshOut.pinnedManualRunAt === 'number', 'Genuinely fresh item must receive pinnedManualRunAt');
    }
  });
});
