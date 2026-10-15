import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ArchiveService } from '../src/core/archive/archiveService';
import { INITIAL_FIXTURES } from '../src/core/data/fixtures';

describe('ArchiveService (Permanent Knowledge Library & Craft Export)', () => {
  it('records and retrieves a daily edition by date', async () => {
    const testDate = '2026-10-15';
    const sampleItems = INITIAL_FIXTURES.slice(0, 3);

    const edition = await ArchiveService.recordEdition(sampleItems, testDate);
    assert.equal(edition.date, testDate);
    assert.equal(edition.itemCount, 3);
    assert.equal(edition.leadArticleTitle, sampleItems[0].title);

    const fetched = await ArchiveService.getEditionByDate(testDate);
    assert.ok(fetched);
    assert.equal(fetched?.date, testDate);
    assert.equal(fetched?.itemCount, 3);
  });

  it('performs full-text search across archived items', async () => {
    const results = await ArchiveService.searchArchive({ term: 'Hume' });
    assert.ok(Array.isArray(results));
  });

  it('exports an archived edition as formatted Markdown for Craft Docs / Obsidian', async () => {
    const testDate = '2026-10-15';
    const sampleItems = INITIAL_FIXTURES.slice(0, 2);
    const edition = await ArchiveService.recordEdition(sampleItems, testDate);

    const md = ArchiveService.exportEditionToMarkdown(edition);
    assert.ok(md.includes(`# atmen Tagesausgabe: ${testDate}`));
    assert.ok(md.includes(sampleItems[0].title));
    assert.ok(md.includes('- **Lesezeit:**'));
  });

  it('calculates archive statistics', async () => {
    const stats = await ArchiveService.getArchiveStats();
    assert.ok(typeof stats.totalEditions === 'number');
    assert.ok(typeof stats.totalArticles === 'number');
    assert.ok(typeof stats.totalEstimatedReadingHours === 'number');
  });

  it('preserves distinct session units on the same date without overwriting', async () => {
    const testDate = '2026-10-16';
    const dailyItems = INITIAL_FIXTURES.slice(0, 2);
    const pocketItems = INITIAL_FIXTURES.slice(2, 4);

    // Record daily edition
    await ArchiveService.recordEdition(dailyItems, testDate, { sessionType: 'daily' });

    // Record pocket research stream on the exact same date
    await ArchiveService.recordEdition(pocketItems, testDate, {
      sessionType: 'pocket_stream',
      sessionId: 'pocket-didaktik-01',
      label: 'Didaktik-Fokus'
    });

    const editions = await ArchiveService.getAllEditions();
    const dayUnits = editions.filter(e => e.date === testDate);
    assert.equal(dayUnits.length, 2, 'Both daily edition and pocket stream should coexist on the same date');

    const dailyUnit = dayUnits.find(u => u.sessionType === 'daily');
    const pocketUnit = dayUnits.find(u => u.sessionType === 'pocket_stream');
    assert.ok(dailyUnit);
    assert.ok(pocketUnit);
    assert.equal(dailyUnit.leadArticleTitle, dailyItems[0].title);
    assert.equal(pocketUnit.leadArticleTitle, pocketItems[0].title);
  });

  it('handles parallel writes concurrently without data loss', async () => {
    const dates = ['2026-10-20', '2026-10-21', '2026-10-22'];
    await Promise.all(
      dates.map((d, idx) =>
        ArchiveService.recordEdition([INITIAL_FIXTURES[idx]], d, {
          sessionType: 'daily'
        })
      )
    );

    const all = await ArchiveService.getAllEditions();
    for (const d of dates) {
      assert.ok(all.some(e => e.date === d), `Date ${d} must be preserved in concurrent writes`);
    }
  });

  it('rejects corrupted stored archive with CorruptedDataError and safely recovers', async () => {
    const { appStorage, CorruptedDataError } = await import('../src/core/data/storage');
    // Inject corrupt JSON into storage key
    await appStorage.setItem(ArchiveService.STORAGE_KEY, '{{INVALID_JSON_CORRUPT');

    await assert.rejects(
      async () => ArchiveService.getAllEditions(),
      (err: any) => {
        assert.ok(err.name === 'CorruptedDataError' || err instanceof CorruptedDataError);
        assert.equal(err.raw, '{{INVALID_JSON_CORRUPT');
        return true;
      }
    );

    // Recover from corruption
    await ArchiveService.recoverCorruptedArchive();

    // Now reading should succeed and return clean array
    const recovered = await ArchiveService.getAllEditions();
    assert.deepEqual(recovered, []);
  });
});
