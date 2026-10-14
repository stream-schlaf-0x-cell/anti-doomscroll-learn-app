import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { SourceRepository } from '../src/core/data/sourceRepository';
import { MemoryStorageDriver, AtemStorage } from '../src/core/data/storage';

describe('SourceRepository & News Hub Ingestion Engine', () => {
  let storage: AtemStorage;
  let repo: SourceRepository;

  beforeEach(() => {
    storage = new AtemStorage(new MemoryStorageDriver());
    repo = new SourceRepository(storage);
  });

  it('loads all verified sources by default with category metadata', async () => {
    const sources = await repo.getAllSources();
    assert.ok(sources.length >= 25, `Expected >= 25 sources, got ${sources.length}`);

    // Verify key categories exist
    const oerr = sources.filter(s => s.category === 'oerr');
    assert.ok(oerr.length >= 4, 'Expected >= 4 OERR sources');
    assert.strictEqual(oerr.some(s => s.name.includes('Tagesschau')), true);

    const youtube = sources.filter(s => s.category === 'youtube');
    assert.ok(youtube.length >= 4, 'Expected >= 4 YouTube sources');
    assert.strictEqual(youtube.some(s => s.name === '3Blue1Brown'), true);

    const memes = sources.filter(s => s.category === 'memes');
    assert.ok(memes.length >= 1, 'Expected >= 1 memes source');
    assert.strictEqual(memes[0].name.includes('xkcd'), true);

    // All should be enabled by default
    assert.strictEqual(sources.every(s => s.enabled), true);
  });

  it('toggles a source off and on', async () => {
    const initial = await repo.getAllSources();
    const target = initial[0];

    const isEnabledAfterToggle = await repo.toggleSource(target.id);
    assert.strictEqual(isEnabledAfterToggle, false);

    let updated = await repo.getAllSources();
    assert.strictEqual(updated.find(s => s.id === target.id)?.enabled, false);

    const isEnabledAgain = await repo.toggleSource(target.id);
    assert.strictEqual(isEnabledAgain, true);

    updated = await repo.getAllSources();
    assert.strictEqual(updated.find(s => s.id === target.id)?.enabled, true);
  });

  it('adds and removes a custom RSS feed', async () => {
    const custom = await repo.addCustomSource({
      name: 'Hacker News Frontpage',
      url: 'https://news.ycombinator.com/rss',
      primaryTopic: 'science_society'
    });

    assert.ok(custom.id.includes('custom-'));
    assert.strictEqual(custom.isCustom, true);

    const sources = await repo.getAllSources();
    assert.strictEqual(sources.some(s => s.url === 'https://news.ycombinator.com/rss'), true);

    // Removing
    await repo.removeCustomSource(custom.id);
    const afterDelete = await repo.getAllSources();
    assert.strictEqual(afterDelete.some(s => s.url === 'https://news.ycombinator.com/rss'), false);
  });

  it('rejects duplicate feed URLs', async () => {
    await repo.addCustomSource({
      name: 'Feed One',
      url: 'https://example.com/rss.xml'
    });

    await assert.rejects(
      repo.addCustomSource({
        name: 'Feed Two',
        url: 'https://example.com/rss.xml'
      }),
      /bereits in deinen Quellen vorhanden/
    );
  });

  it('imports feeds from standard OPML XML', async () => {
    const sampleOpml = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head><title>Subscriptions</title></head>
  <body>
    <outline text="Tech">
      <outline type="rss" text="Ars Technica" title="Ars Technica" xmlUrl="https://arstechnica.com/feed/" />
      <outline type="rss" text="The Verge" title="The Verge" xmlUrl="https://www.theverge.com/rss/index.xml" />
    </outline>
  </body>
</opml>`;

    const res = await repo.importOPML(sampleOpml);
    assert.strictEqual(res.added.length, 2);
    assert.strictEqual(res.added[0].name, 'Ars Technica');
    assert.strictEqual(res.added[1].name, 'The Verge');

    const sources = await repo.getAllSources();
    assert.strictEqual(sources.some(s => s.url === 'https://arstechnica.com/feed/'), true);
  });

  it('exports all sources to standard OPML 2.0 XML', async () => {
    const sources = await repo.getAllSources();
    const opml = repo.exportOPML(sources);

    assert.ok(opml.includes('<opml version="2.0">'));
    assert.ok(opml.includes('<outline text="Öffentlich-Rechtliche"'));
    assert.ok(opml.includes('xmlUrl="https://www.tagesschau.de/wissen/index~rss2.xml"'));
    assert.ok(opml.includes('</opml>'));
  });

  it('applies curated presets (oerr_only, all)', async () => {
    await repo.applyPreset('oerr_only');
    const oerrOnly = await repo.getAllSources();
    const enabled = oerrOnly.filter(s => s.enabled);
    assert.strictEqual(enabled.every(s => s.category === 'oerr'), true);

    await repo.applyPreset('all');
    const all = await repo.getAllSources();
    assert.strictEqual(all.every(s => s.enabled), true);
  });
});
