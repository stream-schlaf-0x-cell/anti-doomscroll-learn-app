import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TrendRadarService, CURATED_TREND_DIALECTICS } from '../src/core/synthesis/trendRadarService';
import { FeedItemSchema } from '../src/core/domain/types';

describe('TrendRadarService (Hegelian Dialectics & Critical Analysis)', () => {
  it('returns all curated dialectical trends', () => {
    const trends = TrendRadarService.getActiveTrends();
    assert.ok(trends.length >= 4);
    assert.ok(trends.every(t => t.thesis && t.antithesis && t.synthesis));
  });

  it('converts dialectical trend to a schema-valid FeedItem', () => {
    const trend = CURATED_TREND_DIALECTICS[0];
    const item = TrendRadarService.convertTrendToFeedItem(trend);

    // Must satisfy strict Zod schema
    const parsed = FeedItemSchema.safeParse(item);
    assert.equal(parsed.success, true, parsed.success ? undefined : parsed.error.message);

    assert.equal(item.flair, '⚡ Trend-Antithese');
    assert.ok(item.articleBody?.includes('## Ausgangslage & These'));
    assert.ok(item.articleBody?.includes('## Die kritische Antithese'));
    assert.ok(item.articleBody?.includes('## Dialektische Synthese & Erkenntnisgewinn'));
    assert.equal(item.space, trend.targetSpace);
  });

  it('generates dynamic dialectical analysis from raw headline and summary', () => {
    const dynamicTrend = TrendRadarService.analyzeRawTrend(
      'Neuer Durchbruch in der Quantenkryptographie',
      'Forscher melden unknackbare Verschränkung über 1000 km.',
      'nature.com',
      'https://nature.com/articles/quantum-crypto',
      'science_society'
    );

    assert.ok(dynamicTrend.id.startsWith('trend-'));
    assert.equal(dynamicTrend.sourceDomain, 'nature.com');
    assert.ok(dynamicTrend.antithesis.length > 30);
    assert.ok(dynamicTrend.synthesis.length > 30);
    assert.equal(dynamicTrend.targetSpace, 'c/science_society');
  });
});
