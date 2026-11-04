import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SnapshotLoader } from '../src/core/feed/SnapshotLoader';
import { isNonRssHomepageUrl, getSourceKind } from '../src/core/ingestion/sourceHealth';
import { callAiModel } from '../src/core/ai/atmenAiClient';
import { EnrichmentUsageLedger } from '../src/core/enrichment/ledger';

test('Architectural Audit V4.2 — 6 Deep Codebase Fixes Suite', async (t) => {
  const rootDir = path.resolve(__dirname, '..');

  await t.test('1. Manifest & Index: Align background_color & theme_color with #0E1424 and relative icon paths', () => {
    const manifestPath = path.join(rootDir, 'public/manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    assert.equal(
      manifest.background_color,
      '#0E1424',
      'manifest.json background_color must be #0E1424'
    );
    assert.equal(
      manifest.theme_color,
      '#0E1424',
      'manifest.json theme_color must be #0E1424'
    );

    // Verify icons use relative "./" paths
    for (const icon of manifest.icons) {
      assert.ok(
        icon.src.startsWith('./'),
        `Icon src "${icon.src}" must start with "./" for subpath hosting on GitHub Pages`
      );
    }

    const indexHtml = fs.readFileSync(path.join(rootDir, 'public/index.html'), 'utf8');
    assert.ok(
      indexHtml.includes('<meta name="theme-color" content="#0E1424" />'),
      'index.html must specify meta theme-color #0E1424'
    );
  });

  await t.test('2. Stacking Context: App.tsx sets readerOverlay zIndex higher than tabBar and disables pointer events', () => {
    const appTsx = fs.readFileSync(path.join(rootDir, 'App.tsx'), 'utf8');

    // Verify readerOverlay has zIndex 5000 and position: fixed on Web
    assert.ok(
      appTsx.includes('zIndex: 5000'),
      'readerOverlay must have high zIndex (5000) to sit above all bottom tabs and bars'
    );
    assert.ok(
      appTsx.includes("Platform.OS === 'web' ? ({ position: 'fixed' } as any) : {}"),
      'readerOverlay must use fixed position on web'
    );

    // Verify mobile tabBar hides or sets pointerEvents none when selectedArticleId is active
    assert.ok(
      appTsx.includes("pointerEvents={selectedArticleId ? 'none' : 'auto'}"),
      'tabBar must disable pointerEvents when an article is open in the reader'
    );
    assert.ok(
      appTsx.includes("selectedArticleId ? { display: 'none' as const } : {}"),
      'tabBar must hide display when selectedArticleId is active'
    );
  });

  await t.test('3. Evergreen Content: Static items in generate-rich-content.ts & vault have frozen historical timestamps', () => {
    const richContentScript = fs.readFileSync(path.join(rootDir, 'scripts/generate-rich-content.ts'), 'utf8');

    assert.ok(
      !richContentScript.includes('Date.now() - 3600000'),
      'scripts/generate-rich-content.ts must not use rolling Date.now() - ... timestamps for evergreen items'
    );
    assert.ok(
      !richContentScript.includes('isDailyEdition: true'),
      'scripts/generate-rich-content.ts items must have isDailyEdition: false so they belong to Zeitlos'
    );

    const vaultTs = fs.readFileSync(path.join(rootDir, 'src/core/data/realKnowledgeVault.ts'), 'utf8');
    assert.ok(
      !vaultTs.includes('isDailyEdition: true'),
      'realKnowledgeVault.ts items must have isDailyEdition: false'
    );
  });

  await t.test('4. Subpath Hydration: SnapshotLoader resolves URLs with GitHub Pages subpath and cache busting', async () => {
    const loader = new SnapshotLoader();

    // Verify executeFetch tries GitHub Pages subpath
    const testUrl = 'https://custom-domain.example/snapshot.json';
    const originalFetch = globalThis.fetch;
    const attemptedUrls: string[] = [];

    // Mock fetch to inspect candidate URLs
    globalThis.fetch = (async (url: string | URL | Request) => {
      attemptedUrls.push(String(url));
      return new Response(JSON.stringify({
        generatedAt: '2026-10-14T12:00:00.000Z',
        items: []
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }) as any;

    try {
      await loader.loadSnapshot();
      assert.ok(
        attemptedUrls.some(u => u.includes('/anti-doomscroll-learn-app/feed-snapshot.json')),
        'SnapshotLoader must attempt GitHub Pages subpath /anti-doomscroll-learn-app/feed-snapshot.json'
      );
      assert.ok(
        attemptedUrls.some(u => u.includes('?t=')),
        'SnapshotLoader must include cache busting query parameter ?t='
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await t.test('5. BYOK Direct Routing & Budget Exemption: Personal API keys bypass budget ceiling & static host skips proxy', async () => {
    // 1. Budget exemption: When user provides their own apiKey, callAiModel does NOT throw AiBudgetExceededError even when ledger ceiling is exhausted
    const exhaustedLedger = new EnrichmentUsageLedger('', false);
    // Artificially exhaust ledger
    await exhaustedLedger.recordUsage({
      itemId: 'exhaustion-seed',
      model: 'test-model',
      inputTokens: 50_000_000,
      outputTokens: 50_000_000,
      costEur: 100.00
    });

    const isAvailable = await exhaustedLedger.canSpend(1.00);
    assert.equal(isAvailable, false, 'Ledger should be exhausted');

    // Mock direct Gemini fetch
    const originalFetch = globalThis.fetch;
    let directFetchCalled = false;
    globalThis.fetch = (async (url: string | URL | Request) => {
      const urlStr = String(url);
      if (urlStr.includes('generativelanguage.googleapis.com')) {
        directFetchCalled = true;
        return new Response(JSON.stringify({
          candidates: [{ content: { parts: [{ text: 'BYOK success' }] } }]
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response('Not found', { status: 404 });
    }) as any;

    try {
      const response = await callAiModel('Say hello', {
        credentials: {
          provider: 'gemini',
          model: 'gemini-2.5-flash',
          apiKey: 'AIzaSyPersonalUserKeyTest123',
          persistApiKey: true
        },
        ledger: exhaustedLedger
      });
      assert.equal(response.text, 'BYOK success');
      assert.equal(directFetchCalled, true, 'Must call direct Gemini API directly');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await t.test('6. Non-RSS URL Guard: Bare homepages and HTML reference URLs are classified as reference', () => {
    // Bare homepages
    assert.equal(isNonRssHomepageUrl('https://www.ard-zdf-medienstudie.de/'), true);
    assert.equal(isNonRssHomepageUrl('https://gesund.bund.de/'), true);
    assert.equal(isNonRssHomepageUrl('https://www.klicksafe.de/'), true);
    assert.equal(isNonRssHomepageUrl('https://github.com/gorhill/uBlock'), true);
    assert.equal(isNonRssHomepageUrl('https://www.apa.org/topics/social-media.html'), true);

    // Real RSS feeds
    assert.equal(isNonRssHomepageUrl('https://correctiv.org/faktencheck/feed/'), false);
    assert.equal(isNonRssHomepageUrl('https://www.snopes.com/feed/'), false);
    assert.equal(isNonRssHomepageUrl('https://www.sciencemediacenter.de/rss.xml'), false);
    assert.equal(isNonRssHomepageUrl('https://perspective-daily.de/feed'), false);

    // getSourceKind classifies bare homepages as reference
    const bareSource = {
      sourceKind: undefined,
      defaultEnabled: true,
      url: 'https://www.ard-zdf-medienstudie.de/'
    };
    assert.equal(getSourceKind(bareSource), 'reference');

    const feedSource = {
      sourceKind: undefined,
      defaultEnabled: true,
      url: 'https://correctiv.org/faktencheck/feed/'
    };
    assert.equal(getSourceKind(feedSource), 'feed');
  });
});
