import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  FoundationalCanonService,
  INITIAL_FOUNDATIONAL_CANON
} from '../src/core/archive/foundationalCanonService';

describe('FoundationalCanonService (Independent Knowledge Foundation)', () => {
  it('retrieves genesis foundational canon with pre-seeded bookmarks and weights', async () => {
    const canon = await FoundationalCanonService.getCanon();
    assert.ok(canon);
    assert.equal(canon.totalBookmarks, 4);
    assert.ok(canon.boostedDomains.includes('aeon.co'));
    assert.ok(canon.boostedDomains.includes('quantamagazine.org'));
    assert.ok((canon.derivedWeights.philosophy_ethics ?? 0) >= 0.9);
  });

  it('creates and persists a customized snapshot of imported items', async () => {
    const customSnapshot = FoundationalCanonService.createSnapshot({
      name: 'Persönliches Philosophie-Fundament',
      description: 'Manuell verifiziertes Denk-Fundament',
      bookmarks: INITIAL_FOUNDATIONAL_CANON.bookmarks.slice(0, 2),
      feedItems: [],
      derivedWeights: { philosophy_ethics: 0.98 },
      boostedDomains: ['aeon.co']
    });

    assert.equal(customSnapshot.name, 'Persönliches Philosophie-Fundament');
    assert.equal(customSnapshot.totalBookmarks, 2);

    await FoundationalCanonService.saveCanon(customSnapshot);
    const retrieved = await FoundationalCanonService.getCanon();
    assert.equal(retrieved.name, 'Persönliches Philosophie-Fundament');
    assert.equal(retrieved.totalBookmarks, 2);
  });

  it('exports foundational canon to human-readable Markdown with weights and sources', () => {
    const md = FoundationalCanonService.exportCanonToMarkdown(INITIAL_FOUNDATIONAL_CANON);
    assert.ok(md.includes('# 🏛️ atmen Ur-Fundament'));
    assert.ok(md.includes('aeon.co'));
    assert.ok(md.includes('Kalibrierte Kognitions-Gewichte'));
    assert.ok(md.includes('Epistemischer Grundstock') || md.includes('epistemicManifesto') || md.includes('Fundament'));
  });

  it('exports foundational canon to standalone JSON string', () => {
    const json = FoundationalCanonService.exportCanonToJson(INITIAL_FOUNDATIONAL_CANON);
    const parsed = JSON.parse(json);
    assert.equal(parsed.id, INITIAL_FOUNDATIONAL_CANON.id);
    assert.equal(parsed.bookmarks.length, 4);
  });
});
