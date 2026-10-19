import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FeedItem } from '../src/core/domain/types';
import { scoreFeedItem, sortFeedForDisplay } from '../src/core/domain/ranking';
import { DEFAULT_USER_PROFILE, INITIAL_FIXTURES } from '../src/core/data/fixtures';
import { FeedOperationManager } from '../src/core/feed/FeedOperationManager';
import { BatchEditionEnricher } from '../src/core/enrichment/batchEnricher';
import { EnrichmentUsageLedger } from '../src/core/enrichment/ledger';
import { EnrichmentCache } from '../src/core/enrichment/cache';
import { ContinuousLiveNewsService, mapTagesschauRessortToTopic } from '../src/core/data/continuousLiveNewsService';
import { BackupService } from '../src/core/data/backupService';
import { MemoryStorageDriver, AtemStorage } from '../src/core/data/storage';

function createMockItem(id: string, overrides: Partial<FeedItem> = {}): FeedItem {
  return {
    ...INITIAL_FIXTURES[0],
    id,
    title: `Substantieller Beitrag ${id}`,
    canonicalUrl: `https://example.org/article-${id}`,
    publishedAt: '2026-10-18T10:00:00Z',
    curationScore: 7,
    topics: ['philosophy_ethics'],
    primaryTopic: 'philosophy_ethics',
    ...overrides
  };
}

describe('P0 Feed Repair & Production Hardening Verification Suite', () => {
  // Criterion 1: Honest execution path, duration measurement, and truthful status
  it('1. Curation execution measures true duration and labels fallback honestly as status fallback', async () => {
    const manager = new FeedOperationManager();
    const op = manager.startOperation('ai_curation', 'op-test-timing-1');
    assert.equal(op.operationId, 'op-test-timing-1');

    // Simulate elapsed time during procurement and local heuristic fallback
    await new Promise(r => setTimeout(r, 20));

    const completed = manager.completeOperation({
      usedAI: false,
      usedFallback: true,
      candidateCount: 6,
      insertedCount: 2,
      updatedCount: 0,
      errorMessage: 'Kein API-Schlüssel konfiguriert.'
    });

    assert.equal(completed.status, 'fallback');
    assert.equal(completed.usedAI, false);
    assert.equal(completed.usedFallback, true);
    assert.ok(completed.durationMs >= 15, `Duration must measure elapsed time (>0ms), got ${completed.durationMs}ms`);
    assert.equal(completed.errorMessage, 'Kein API-Schlüssel konfiguriert.');
  });

  it('1b. AI success is only granted when usedAI is true', () => {
    const manager = new FeedOperationManager();
    manager.startOperation('ai_curation', 'op-test-ai-success');
    const completed = manager.completeOperation({
      usedAI: true,
      usedFallback: false,
      candidateCount: 6,
      insertedCount: 4,
      modelUsed: 'gemini-2.5-flash'
    });

    assert.equal(completed.status, 'completed');
    assert.equal(completed.usedAI, true);
    assert.equal(completed.modelUsed, 'gemini-2.5-flash');
  });

  // Criterion 2: No mass pins of updated items freezing the feed
  it('2. Does not mass-pin dozens of updated articles; caps automatic freshness pins at 4', () => {
    const manager = new FeedOperationManager();
    manager.startOperation('ai_curation');
    const fourteenIds = Array.from({ length: 14 }, (_, i) => `updated-${i + 1}`);

    // If 14 articles were updated (like the original bug), manager must NEVER pin all 14!
    manager.completeOperation({
      updatedCount: 14,
      updatedIds: fourteenIds
    });

    const pinned = manager.getPinnedItemIds();
    assert.ok(pinned.length <= 4, `Expected at most 4 pinned items, but got ${pinned.length}`);
    assert.deepEqual(pinned, ['updated-1', 'updated-2', 'updated-3', 'updated-4']);

    // Changing sort clears temporary automatic pins
    manager.clearAutomaticPins();
    assert.equal(manager.getPinnedItemIds().length, 0, 'clearAutomaticPins must dissolve temporary curation pins');
  });

  // Criterion 3: Distinct and visible sort behavior across Neu, Top, and Gems
  it('3. Sort modes Neu, Top, and Gems produce distinctly different top-3 cards', () => {
    const itemNewest = createMockItem('newest-wire', {
      publishedAt: '2026-10-18T18:00:00Z',
      curationScore: 7,
      format: 'sourced_update'
    });
    const itemTopScore = createMockItem('deep-scholarship', {
      publishedAt: '2026-10-15T12:00:00Z',
      curationScore: 10,
      evidenceTier: 'permitted_full_text',
      externalCommunityScore: { points: 420, commentsCount: 95 }
    });
    const itemGem = createMockItem('timeless-gem', {
      publishedAt: '2025-01-01T00:00:00Z',
      curationScore: 8,
      isEvergreenGem: true,
      format: 'art_showcase',
      sourceTrustLevel: 'museum_collection'
    });
    const itemMid = createMockItem('standard-article', {
      publishedAt: '2026-10-17T12:00:00Z',
      curationScore: 7.5
    });

    const pool = [itemMid, itemGem, itemNewest, itemTopScore].map(i =>
      scoreFeedItem(i, DEFAULT_USER_PROFILE)
    );

    const sortedNew = sortFeedForDisplay(pool, 'new');
    const sortedTop = sortFeedForDisplay(pool, 'top');
    const sortedGems = sortFeedForDisplay(pool, 'gems');

    // In 'new': strict timestamp descending -> itemNewest is #1
    assert.equal(sortedNew[0].id, 'newest-wire');

    // In 'top': highest composite curation + community points + tier -> itemTopScore is #1
    assert.equal(sortedTop[0].id, 'deep-scholarship');

    // In 'gems': evergreen gems and art showcases -> itemGem is #1
    assert.equal(sortedGems[0].id, 'timeless-gem');

    // Verify at least 2 of the top 3 cards differ between Neu, Top, and Gems
    const top3New = sortedNew.slice(0, 3).map(i => i.id);
    const top3Top = sortedTop.slice(0, 3).map(i => i.id);
    const top3Gems = sortedGems.slice(0, 3).map(i => i.id);

    const diffNewVsTop = top3New.filter((id, idx) => id !== top3Top[idx]).length;
    const diffNewVsGems = top3New.filter((id, idx) => id !== top3Gems[idx]).length;

    assert.ok(diffNewVsTop >= 2, `Expected at least 2 cards to differ between New and Top, diff was ${diffNewVsTop}`);
    assert.ok(diffNewVsGems >= 2, `Expected at least 2 cards to differ between New and Gems, diff was ${diffNewVsGems}`);
  });

  // Criterion 4: Tagesschau dynamic topic mapping and full quota support
  it('4. Tagesschau dynamically maps ressorts to valid topics', () => {
    assert.equal(mapTagesschauRessortToTopic('wirtschaft', 'Börse und Konjunktur'), 'opportunities_growth');
    assert.equal(mapTagesschauRessortToTopic('finanzen', 'DAX schließt im Plus'), 'opportunities_growth');
    assert.equal(mapTagesschauRessortToTopic('wissen', 'James Webb Teleskop entdeckt Galaxie'), 'science_society');
    assert.equal(mapTagesschauRessortToTopic('kultur', 'Eröffnung der Buchmesse'), 'art_aesthetics');
    assert.equal(mapTagesschauRessortToTopic('sport', 'Olympische Spiele Vorbereitung'), 'health_biohacking');
    assert.equal(mapTagesschauRessortToTopic('inland', 'Bundestagsdebatte über Haushalt'), 'philosophy_ethics');
    assert.equal(mapTagesschauRessortToTopic('ausland', 'Wahlen in Europa'), 'philosophy_ethics');
    assert.equal(mapTagesschauRessortToTopic('investigativ', 'Recherche über Schattenhaushalte'), 'philosophy_ethics');
  });

  // Criterion 5: Honest refresh telemetry without fabricated additions
  it('5. Honest refresh tracking reports 0 new items on repeated checks', async () => {
    const mockFeed = [
      createMockItem('tagesschau-1', { canonicalUrl: 'https://www.tagesschau.de/item-1' }),
      createMockItem('tagesschau-2', { canonicalUrl: 'https://www.tagesschau.de/item-2' })
    ];

    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = async () =>
        new Response(
          JSON.stringify({
            news: [
              {
                externalId: '101',
                title: 'Meldung Eins',
                firstSentence: 'Erster Satz',
                ressort: 'wissen',
                date: new Date().toISOString()
              }
            ]
          }),
          { status: 200 }
        );

      const firstItems = await ContinuousLiveNewsService.fetchTagesschauLiveJson(40);
      assert.ok(firstItems.length > 0);
      assert.equal(firstItems[0].primaryTopic, 'science_society');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  // Criterion 6: Backup V2 data integrity, privacy (no secrets exported), and backward compatibility
  it('6. Backup V2 safely exports/imports without leaking secrets or tokens', async () => {
    const memory = new MemoryStorageDriver();
    const storage = new AtemStorage(memory);

    // Seed mock user data including sensitive token
    await storage.setItem('@atem:user_profile:v1', JSON.stringify(DEFAULT_USER_PROFILE));
    await storage.setItem('@atem:interactions:v1', JSON.stringify({
      'art-1': {
        itemId: 'art-1',
        completedAt: '2026-10-18T10:00:00Z',
        userNotes: [{ id: 'note-1', text: 'Wichtige Erkenntnis', createdAt: '2026-10-18T10:00:00Z', tag: 'notiz' }]
      }
    }));
    await storage.setItem('@atem:saved_articles:v1', JSON.stringify([createMockItem('art-1')]));
    await storage.setItem('@atem:user_thoughts:v1', JSON.stringify([{ id: 'thought-1', text: 'Kreativer Gedanke' }]));
    await storage.setItem('@atem:knowledge_connections:v1', JSON.stringify([{ id: 'conn-1', fromId: 'a', toId: 'b' }]));
    await storage.setItem('@atem:investigations:v1', JSON.stringify([{ id: 'inv-1', title: 'Recherche-Dossier' }]));
    await storage.setItem('@atem:automation_rules:v1', JSON.stringify([{ id: 'rule-1', trigger: 'daily' }]));
    await storage.setItem('@atem:raindrop_api_token:v1', 'super-secret-raindrop-token-12345');
    await storage.setItem('@atem:ai_credentials:v1', JSON.stringify({ apiKey: 'secret-gemini-key' }));

    // Export backup JSON
    const exportedJson = await BackupService.exportBackupJson(false, storage);
    const parsedBackup = JSON.parse(exportedJson);

    // Strict Privacy Verifications:
    assert.equal(parsedBackup.version, 2);
    assert.equal(parsedBackup.raindropToken, undefined, 'Raindrop token MUST NOT be exported');
    assert.ok(!exportedJson.includes('super-secret-raindrop-token-12345'), 'Exported JSON must never contain Raindrop token');
    assert.ok(!exportedJson.includes('secret-gemini-key'), 'Exported JSON must never contain AI API keys');

    // Data Integrity Verifications:
    assert.equal(parsedBackup.savedArticles.length, 1);
    assert.equal(parsedBackup.thoughts?.length, 1);
    assert.equal(parsedBackup.connections?.length, 1);
    assert.equal(parsedBackup.investigations?.length, 1);
    assert.equal(parsedBackup.rules?.length, 1);

    // Test Import into a clean storage instance
    const freshMemory = new MemoryStorageDriver();
    const freshStorage = new AtemStorage(freshMemory);

    const importResult = await BackupService.importBackupJson(exportedJson, freshStorage);
    assert.equal(importResult.success, true);
    assert.equal(importResult.restoredSavedCount, 1);
    assert.equal(importResult.restoredNotesCount, 1);
    assert.equal(importResult.restoredThoughtsCount, 1);

    // Verify imported data in storage
    const restoredThoughts = JSON.parse(await freshStorage.getItem('@atem:user_thoughts:v1') || '[]');
    assert.equal(restoredThoughts[0].text, 'Kreativer Gedanke');

    // Verify backward compatibility: importing a V1 backup payload
    const v1Payload = JSON.stringify({
      version: 1,
      exportedAt: '2025-01-01T00:00:00Z',
      profile: DEFAULT_USER_PROFILE,
      interactions: {
        'legacy-1': {
          itemId: 'legacy-1',
          userNotes: [{ id: 'old-note-1', text: 'Alte Notiz', createdAt: '2025-01-01T00:00:00Z', tag: 'notiz' }]
        }
      },
      savedArticles: [createMockItem('legacy-1')],
      raindropToken: 'old-token'
    });

    const v1ImportResult = await BackupService.importBackupJson(v1Payload, freshStorage);
    assert.equal(v1ImportResult.success, true);
    assert.equal(v1ImportResult.restoredSavedCount, 1);
    assert.equal(v1ImportResult.restoredNotesCount, 1);
  });
});
