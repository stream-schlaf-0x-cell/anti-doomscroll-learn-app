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
});
