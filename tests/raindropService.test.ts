import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { RaindropService, DEMO_RAINDROP_BOOKMARKS } from '../src/core/raindrop/raindropService';
import { FeedItemSchema } from '../src/core/domain/types';

describe('RaindropService (Bookmark Ingestion & Profile Synthesis)', () => {
  it('verifies demo token instantly without network dependency', async () => {
    const res = await RaindropService.verifyToken('demo');
    assert.equal(res.success, true);
    assert.equal(res.user?._id, 42);
    assert.ok(res.user?.name.includes('Demo'));
  });

  it('rejects empty token with clear German error message', async () => {
    const res = await RaindropService.verifyToken('');
    assert.equal(res.success, false);
    assert.ok(res.error?.includes('Kein Token'));
  });

  it('loads demo collections and bookmarks', async () => {
    const collections = await RaindropService.getCollections('demo');
    assert.ok(collections.length >= 4);

    const bookmarks = await RaindropService.getRaindrops('demo', 0);
    assert.equal(bookmarks.length, DEMO_RAINDROP_BOOKMARKS.length);
  });

  it('derives calibrated profile interest weights from Raindrop bookmark tags', () => {
    const { interests, boostedDomains, tagCounts } = RaindropService.deriveProfileFromRaindrop(DEMO_RAINDROP_BOOKMARKS);

    // Bookmarks contain 'philosophy', 'mindfulness', 'synth', 'sound', 'ai', 'health'
    assert.ok(typeof interests.philosophy_ethics === 'number');
    assert.ok(typeof interests.sound_synthesis === 'number');
    assert.ok(typeof interests.ai_apple === 'number');
    assert.ok(typeof interests.health_biohacking === 'number');

    // Calibrated weights should be in reasonable range 0.65 - 0.95
    assert.ok((interests.philosophy_ethics ?? 0) >= 0.65);
    assert.ok((interests.sound_synthesis ?? 0) >= 0.65);

    // Boosted domains identified
    assert.ok(boostedDomains.includes('aeon.co'));
    assert.ok(boostedDomains.includes('cdm.link'));
    assert.ok(boostedDomains.includes('quantamagazine.org'));
  });

  it('converts a Raindrop bookmark to a schema-valid FeedItem for the reader', () => {
    const bookmark = DEMO_RAINDROP_BOOKMARKS[0];
    const feedItem = RaindropService.convertRaindropToFeedItem(bookmark);

    // Must satisfy strict Zod schema
    const parsed = FeedItemSchema.safeParse(feedItem);
    assert.equal(parsed.success, true, parsed.success ? undefined : parsed.error.message);

    assert.equal(feedItem.flair, '💧 Raindrop Bookmark');
    assert.equal(feedItem.canonicalUrl, bookmark.link);
    assert.ok(feedItem.sourceReferences[0]?.publisher === bookmark.domain);
    assert.ok(feedItem.articleBody?.includes('Raindrop.io'));
  });

  it('saves an article to Raindrop (demo mode succeeds)', async () => {
    const res = await RaindropService.saveToRaindrop('demo', {
      title: 'Das Phantom des Ich: David Hume und die Bündeltheorie',
      link: 'https://plato.stanford.edu/entries/hume/',
      tags: ['philosophy', 'atmen']
    });
    assert.equal(res.success, true);
  });
});
