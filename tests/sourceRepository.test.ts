import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { SourceRepository } from '../src/core/data/sourceRepository';
import { MemoryStorageDriver, AtemStorage } from '../src/core/data/storage';
import { VERIFIED_FEED_SOURCES } from '../src/core/ingestion/sources';

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

    // Active core sources should be enabled by default
    const coreSources = sources.filter(s => s.defaultEnabled !== false);
    assert.strictEqual(coreSources.every(s => s.enabled), true);

    // Reserve research corpus sources should be inactive by default
    const reserveSources = sources.filter(s => s.defaultEnabled === false);
    assert.ok(reserveSources.length >= 200, 'Expected >= 200 reserve sources');
    assert.strictEqual(reserveSources.every(s => !s.enabled), true);
  });

  it('toggles a source off and on', async () => {
    const initial = await repo.getAllSources();
    const target = initial.find(s => s.defaultEnabled !== false)!;

    const isEnabledAfterToggle = await repo.toggleSource(target.id);
    assert.strictEqual(isEnabledAfterToggle, false);

    let updated = await repo.getAllSources();
    assert.strictEqual(updated.find(s => s.id === target.id)?.enabled, false);

    const isEnabledAgain = await repo.toggleSource(target.id);
    assert.strictEqual(isEnabledAgain, true);

    updated = await repo.getAllSources();
    assert.strictEqual(updated.find(s => s.id === target.id)?.enabled, true);

    // Also test toggling a reserve source on and off
    const reserveTarget = initial.find(s => s.defaultEnabled === false)!;
    assert.strictEqual(reserveTarget.enabled, false);

    const isReserveEnabledAfterToggle = await repo.toggleSource(reserveTarget.id);
    assert.strictEqual(isReserveEnabledAfterToggle, true);

    updated = await repo.getAllSources();
    assert.strictEqual(updated.find(s => s.id === reserveTarget.id)?.enabled, true);

    const isReserveDisabledAgain = await repo.toggleSource(reserveTarget.id);
    assert.strictEqual(isReserveDisabledAgain, false);
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
    <outline text="Custom Test Category">
      <outline type="rss" text="Mock Tech News" title="Mock Tech News" xmlUrl="https://custom-mock-test-1.org/feed.xml" />
      <outline type="rss" text="Mock Science Journal" title="Mock Science Journal" xmlUrl="https://custom-mock-test-2.org/rss.xml" />
    </outline>
  </body>
</opml>`;

    const res = await repo.importOPML(sampleOpml);
    assert.strictEqual(res.added.length, 2);
    assert.strictEqual(res.added[0].name, 'Mock Tech News');
    assert.strictEqual(res.added[1].name, 'Mock Science Journal');

    const sources = await repo.getAllSources();
    assert.strictEqual(sources.some(s => s.url === 'https://custom-mock-test-1.org/feed.xml'), true);
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

  it('toggles an entire category in bulk (toggleCategory)', async () => {
    // 1. Disable all OERR sources at once
    await repo.toggleCategory('oerr', false);
    let sources = await repo.getAllSources();
    const oerrSources = sources.filter(s => s.category === 'oerr');
    assert.ok(oerrSources.length > 0);
    assert.strictEqual(oerrSources.every(s => !s.enabled), true);

    // 2. Enable all OERR sources at once
    await repo.toggleCategory('oerr', true);
    sources = await repo.getAllSources();
    const oerrSourcesAfter = sources.filter(s => s.category === 'oerr');
    assert.strictEqual(oerrSourcesAfter.every(s => s.enabled), true);

    // 3. Enable a reserve category in bulk
    await repo.toggleCategory('fact_check', true);
    sources = await repo.getAllSources();
    const factCheckSources = sources.filter(s => s.category === 'fact_check');
    assert.ok(factCheckSources.length > 0);
    assert.strictEqual(factCheckSources.every(s => s.enabled), true);
  });

  it('guarantees zero duplicate IDs or normalized URLs across VERIFIED_FEED_SOURCES', () => {
    const normalizeUrl = (url: string) =>
      url.trim().toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/\/+$/, '');

    const seenIds = new Set<string>();
    const seenUrls = new Map<string, string>();

    for (const source of VERIFIED_FEED_SOURCES) {
      assert.strictEqual(seenIds.has(source.id), false, `Duplicate source ID detected: ${source.id}`);
      seenIds.add(source.id);

      const normalized = normalizeUrl(source.url);
      assert.strictEqual(
        seenUrls.has(normalized),
        false,
        `Duplicate normalized URL "${normalized}" for ${source.id} (already used by ${seenUrls.get(normalized)})`
      );
      seenUrls.set(normalized, source.id);
    }
  });

  it('activates all flagship DE & EN sources by default with valid categories and German trustBadges', async () => {
    const flagshipSpecs: {
      id: string;
      expectedCategory: 'culture' | 'science' | 'education' | 'oerr' | 'tech';
      expectTeaching?: boolean;
      expectChallenging?: boolean;
    }[] = [
      { id: 'brandeins-magazin', expectedCategory: 'culture' },
      { id: 'krautreporter-magazin', expectedCategory: 'culture', expectChallenging: true },
      { id: 'republik-ch', expectedCategory: 'culture', expectChallenging: true },
      { id: 'bpb-apuz', expectedCategory: 'education', expectTeaching: true },
      { id: 'zeit-wissen', expectedCategory: 'science' },
      { id: 'zeit-kultur', expectedCategory: 'culture' },
      { id: 'sz-wissen', expectedCategory: 'science' },
      { id: 'sz-kultur', expectedCategory: 'culture' },
      { id: 'geschichte-der-gegenwart', expectedCategory: 'culture', expectChallenging: true },
      { id: 'praefaktisch-philosophie', expectedCategory: 'culture' },
      { id: 'verfassungsblog-de', expectedCategory: 'culture', expectChallenging: true },
      { id: 'bob-blume-netzlehrer', expectedCategory: 'education', expectTeaching: true },
      { id: 'asimov-press', expectedCategory: 'science' },
      { id: 'works-in-progress', expectedCategory: 'culture' },
      { id: 'the-conversation-global', expectedCategory: 'science' },
      { id: 'open-culture', expectedCategory: 'culture', expectTeaching: true },
      { id: 'nautilus-magazine', expectedCategory: 'science' },
      { id: 'noema-magazine', expectedCategory: 'culture', expectChallenging: true },
      { id: 'archdaily-architecture', expectedCategory: 'culture' },
      { id: 'dezeen-design', expectedCategory: 'culture' },
      { id: 'sound-on-sound', expectedCategory: 'tech' },
      { id: 'attack-magazine-synth', expectedCategory: 'tech' }
    ];

    const allSources = await repo.getAllSources();
    const byId = new Map(allSources.map(s => [s.id, s]));
    const rawById = new Map(VERIFIED_FEED_SOURCES.map(s => [s.id, s]));

    for (const spec of flagshipSpecs) {
      const source = byId.get(spec.id);
      const raw = rawById.get(spec.id);
      assert.ok(source, `Flagship source ${spec.id} must exist in SourceRepository`);
      assert.ok(raw, `Flagship source ${spec.id} must exist in VERIFIED_FEED_SOURCES`);
      assert.notStrictEqual(raw.defaultEnabled, false, `${spec.id} must not be disabled by default`);
      assert.strictEqual(source.enabled, true, `${spec.id} must be enabled by default`);
      assert.strictEqual(source.category, spec.expectedCategory, `${spec.id} category mismatch`);
      assert.ok(source.trustBadge && source.trustBadge.trim().length > 0, `${spec.id} must have a trustBadge`);
      if (spec.expectTeaching) {
        assert.strictEqual(raw.isTeachingRelated, true, `${spec.id} must have isTeachingRelated: true`);
      }
      if (spec.expectChallenging) {
        assert.strictEqual(raw.isChallengingPerspective, true, `${spec.id} must have isChallengingPerspective: true`);
      }
    }
  });
});


it('does not let inactive reference pages block the domain of an enabled feed', async () => {
  const repo = new SourceRepository(new AtemStorage(new MemoryStorageDriver()));
  const domains = await repo.getDisabledDomains();
  assert.equal(domains.includes('tagesschau.de'), false);
  assert.equal(domains.includes('spiegel.de'), false);
});
