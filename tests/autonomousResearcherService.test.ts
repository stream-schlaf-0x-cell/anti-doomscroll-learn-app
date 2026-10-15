import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  AutonomousResearcherService,
  POPULAR_QUALITY_FEEDS
} from '../src/core/ingestion/autonomousResearcherService';
import { feedRepository } from '../src/core/data/feedRepository';
import { FeedItemSchema } from '../src/core/domain/types';

describe('AutonomousResearcherService (Automated Gatherer & Spiritual Teammate)', () => {
  it('contains pre-vetted quality feed catalog for 1-click subscription', () => {
    assert.ok(POPULAR_QUALITY_FEEDS.length >= 10);
    for (const feed of POPULAR_QUALITY_FEEDS) {
      assert.ok(feed.name.length > 0);
      assert.ok(feed.url.startsWith('http'));
      assert.ok(feed.siteUrl.startsWith('http'));
      assert.ok(feed.category);
    }
  });

  it('discovers feed for known top domains instantly', async () => {
    const spiegel = await AutonomousResearcherService.discoverFeedFromWebsite('https://www.spiegel.de');
    assert.ok(spiegel);
    assert.ok(spiegel?.name.includes('Der Spiegel'));
    assert.ok(spiegel?.url.includes('spiegel.de'));

    const quanta = await AutonomousResearcherService.discoverFeedFromWebsite('quantamagazine.org');
    assert.ok(quanta);
    assert.strictEqual(quanta?.name, 'Quanta Magazine');
    assert.strictEqual(quanta?.category, 'science');
  });

  it('handles direct RSS/XML feed links gracefully', async () => {
    const directRss = await AutonomousResearcherService.discoverFeedFromWebsite('https://example.com/custom-feed.xml');
    assert.ok(directRss);
    assert.strictEqual(directRss?.url, 'https://example.com/custom-feed.xml');
    assert.strictEqual(directRss?.name, 'Example Feed');
  });

  it('generates standard fallback feed endpoint for unknown websites', async () => {
    const unknown = await AutonomousResearcherService.discoverFeedFromWebsite('mytechblog.io');
    assert.ok(unknown);
    assert.ok(unknown?.url.includes('mytechblog.io/feed'));
  });

  it('returns null for empty or invalid URLs', async () => {
    const empty = await AutonomousResearcherService.discoverFeedFromWebsite('');
    assert.strictEqual(empty, null);

    const spaceOnly = await AutonomousResearcherService.discoverFeedFromWebsite('   ');
    assert.strictEqual(spaceOnly, null);
  });

  it('conducts a deep spiritual inquiry and registers schema-valid FeedItem', async () => {
    const inquiryResult = await AutonomousResearcherService.conductSpiritualInquiry(
      'Wie verändert künstliche Intelligenz unser Verständnis von Intuition und Kunst?'
    );

    assert.ok(inquiryResult);
    assert.strictEqual(inquiryResult.space, 'c/persoenlicher_focus');
    assert.strictEqual(inquiryResult.aiAssisted, true);
    assert.ok(inquiryResult.keyInsight && inquiryResult.keyInsight.length > 20);
    assert.ok(inquiryResult.challengePrompt && inquiryResult.challengePrompt.length > 10);
    assert.ok(inquiryResult.articleBody && inquiryResult.articleBody.length > 200);

    // Validate with Zod FeedItemSchema
    const parseResult = FeedItemSchema.safeParse(inquiryResult);
    assert.strictEqual(parseResult.success, true, 'Inquiry FeedItem must conform strictly to FeedItemSchema');

    // Confirm it is registered in feedRepository
    const inRepo = await feedRepository.getItemById(inquiryResult.id);
    assert.ok(inRepo, 'Generated inquiry must be persisted in feedRepository');
    assert.strictEqual(inRepo?.id, inquiryResult.id);
  });
});
