import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { LocalFeedRepository } from '../src/core/data/feedRepository';
import { DEFAULT_USER_PROFILE } from '../src/core/data/fixtures';
import {
  formatEvidenceTier,
  formatFeedItemFormat,
  EvidenceTier,
  FeedItemFormat,
  FeedItem
} from '../src/core/domain/types';
import { INITIAL_FIXTURES } from '../src/core/data/fixtures';

describe('Feed Batching & Discovery Partitioning Invariants', () => {
  it('1. Returns at most 12 items for daily edition even when larger candidate pool exists', async () => {
    const repo = new LocalFeedRepository();
    const daily = await repo.getDailyEdition(DEFAULT_USER_PROFILE);

    assert.ok(daily.length > 0, 'Daily edition should contain items');
    assert.ok(daily.length <= 12, `Daily edition must be at most 12 items, got ${daily.length}`);
  });

  it('2. Guarantees zero ID overlap between daily edition and discovery pool', async () => {
    const repo = new LocalFeedRepository();
    const daily = await repo.getDailyEdition(DEFAULT_USER_PROFILE);
    const discovery = await repo.getDiscoveryItems(DEFAULT_USER_PROFILE);

    const dailyIds = new Set(daily.map(item => item.id));
    const discoveryIds = new Set(discovery.map(item => item.id));

    assert.equal(dailyIds.size, daily.length, 'Daily items must have unique IDs');
    assert.equal(discoveryIds.size, discovery.length, 'Discovery items must have unique IDs');

    for (const dId of discoveryIds) {
      assert.ok(!dailyIds.has(dId), `Discovery item ${dId} must not appear in daily edition`);
    }
  });

  it('3. Retains all non-daily items in discovery pool without losing candidate stories', async () => {
    // Construct controlled repository with 25 items
    const testItems: FeedItem[] = Array.from({ length: 25 }, (_, idx) => {
      const template = INITIAL_FIXTURES[idx % INITIAL_FIXTURES.length];
      return {
        ...template,
        id: `batch-test-item-${idx}`,
        title: `Test Beitrag ${idx}: ${template.title}`,
        isDailyEdition: true
      };
    });

    const repo = new LocalFeedRepository(testItems);
    const daily = await repo.getDailyEdition(DEFAULT_USER_PROFILE);
    const discovery = await repo.getDiscoveryItems(DEFAULT_USER_PROFILE);

    assert.equal(daily.length, 12, 'Primary daily batch must take exactly 12 items when >= 12 available');
    assert.equal(discovery.length, 13, 'Discovery pool must take remaining 13 items');
    assert.equal(daily.length + discovery.length, 25, 'Total partitioned count must equal total items');
  });

  it('4. Correctly maps all Phase 2 EvidenceTier values to German UI descriptions', () => {
    const tiers: Record<EvidenceTier, string> = {
      permitted_full_text: 'Volltext verfügbar',
      multiple_sources: 'Quellensynthese',
      publisher_excerpt: 'Herausgeber-Auszug',
      metadata_only: 'Quellnotiz'
    };

    for (const [tier, expectedLabel] of Object.entries(tiers)) {
      assert.equal(formatEvidenceTier(tier as EvidenceTier), expectedLabel);
    }
    assert.equal(formatEvidenceTier(undefined), 'Verifizierte Quelle');
  });

  it('5. Correctly maps all Phase 2 FeedItemFormat values to editorial labels', () => {
    const formats: Record<FeedItemFormat, string> = {
      concise_insight: '⚡︎ Kompaktimpuls',
      sourced_update: '◈ Recherche & Update',
      creative_idea: '💡 Kreativer Impuls',
      intriguing_question: '❓ Denkfrage',
      surprising_connection: '☍ Interdisziplinäre Brücke',
      perspective_disagreement: '✦ Philosophische Gegenposition',
      long_invitation: '📖 Vertiefender Essay',
      meme: '🎭 High-IQ Satire & Meme',
      youtube_gem: '📺 YouTube Gem & Video-Essay',
      book_masterpiece: '📚 Meisterwerk-Empfehlung',
      opportunity_radar: '🚀 Chancen- & Hebel-Radar',
      art_showcase: '🎨 Kunst & Visuelles'
    };

    for (const [format, expectedLabel] of Object.entries(formats)) {
      assert.equal(formatFeedItemFormat(format as FeedItemFormat), expectedLabel);
    }
    assert.equal(formatFeedItemFormat(undefined), '✦ Lese-Entdeckung');
  });
});
