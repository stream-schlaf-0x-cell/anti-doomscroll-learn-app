import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ContinuousLiveNewsService } from '../src/core/data/continuousLiveNewsService';
import { FeedItemSchema } from '../src/core/domain/types';

describe('ContinuousLiveNewsService & Instant Research Invariants', () => {
  it('returns verified live stream items conforming strictly to FeedItemSchema', async () => {
    const items = await ContinuousLiveNewsService.getLiveStream({ limit: 15 });
    assert.ok(items.length > 0, 'Expected non-empty live news stream');
    assert.ok(items.length <= 15, 'Respects limit parameter');

    for (const item of items) {
      // Validate schema
      const parseResult = FeedItemSchema.safeParse(item);
      assert.strictEqual(
        parseResult.success,
        true,
        `Item ${item.id} must be schema-valid: ${parseResult.error?.message}`
      );

      // Verify instant research learning tools
      assert.ok(item.keyInsight && item.keyInsight.length > 0, 'Item must have a keyInsight');
      assert.ok(item.didacticTransfer && item.didacticTransfer.length > 0, 'Item must have didactic transfer');
      assert.ok(item.challengePrompt && item.challengePrompt.length > 0, 'Item must have a challenge prompt');
      assert.ok(item.sourceReferences.length > 0, 'Item must have source references');
    }
  });

  it('filters live items by specific category (e.g. oerr, tech, science)', async () => {
    const oerrItems = await ContinuousLiveNewsService.getLiveStream({ category: 'oerr', limit: 20 });
    assert.ok(oerrItems.length > 0, 'Should find oerr items');
    for (const item of oerrItems) {
      const publisher = item.sourceReferences[0]?.publisher?.toLowerCase() || '';
      const domain = (item.sourceDomain || '').toLowerCase();
      assert.ok(
        publisher.includes('tagesschau') ||
        publisher.includes('deutschlandfunk') ||
        publisher.includes('zdf') ||
        domain.includes('tagesschau') ||
        domain.includes('deutschlandfunk'),
        `Expected OERR item, got publisher: ${publisher}, domain: ${domain}`
      );
    }

    const techItems = await ContinuousLiveNewsService.getLiveStream({ category: 'tech', limit: 20 });
    assert.ok(techItems.length > 0, 'Should find tech items');
    for (const item of techItems) {
      const publisher = item.sourceReferences[0]?.publisher?.toLowerCase() || '';
      const domain = (item.sourceDomain || '').toLowerCase();
      assert.ok(
        publisher.includes('heise') ||
        publisher.includes('ars technica') ||
        publisher.includes('nature') ||
        domain.includes('heise') ||
        domain.includes('arstechnica') ||
        item.topics.includes('ai_apple') ||
        item.topics.includes('science_society'),
        `Expected Tech item, got publisher: ${publisher}, domain: ${domain}`
      );
    }
  });

  it('searches live items accurately by search query', async () => {
    const searchResults = await ContinuousLiveNewsService.getLiveStream({ query: 'Klima' });
    assert.ok(searchResults.length > 0, 'Expected results for query "Klima"');
    for (const item of searchResults) {
      const match =
        item.title.toLowerCase().includes('klima') ||
        (item.subtitle && item.subtitle.toLowerCase().includes('klima')) ||
        (item.feedText && item.feedText.toLowerCase().includes('klima')) ||
        item.topics.some(t => t.toLowerCase().includes('klima'));
      assert.strictEqual(match, true, 'Result must match query keyword');
    }
  });

  it('provides timeless Evergreen Classics with high epistemic value', () => {
    const classics = ContinuousLiveNewsService.getEvergreenClassics();
    assert.ok(classics.length >= 5, 'Expected at least 5 evergreen classics');

    for (const item of classics) {
      const parseResult = FeedItemSchema.safeParse(item);
      assert.strictEqual(parseResult.success, true, `Classic ${item.id} must be schema-valid`);
      assert.strictEqual(item.isEvergreenGem, true, 'isEvergreenGem flag must be true');
      assert.ok(item.keyInsight && item.keyInsight.length > 0);
      assert.ok(item.didacticTransfer && item.didacticTransfer.length > 0);
    }
  });
});
