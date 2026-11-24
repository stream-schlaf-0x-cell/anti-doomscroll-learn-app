import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { SnapshotLoader, RAW_GITHUB_SNAPSHOT_URL } from '../src/core/feed/SnapshotLoader';
import { RESERVOIR_MAX_ITEMS } from '../src/core/feed/snapshotPayload';
import { SourceRepository } from '../src/core/data/sourceRepository';
import { AtemStorage, MemoryStorageDriver } from '../src/core/data/storage';
import {
  extractDateFromUrl,
  parseDateWithReliability,
  parseFeedXml
} from '../src/core/ingestion/rssParser';
import { normalizeFeedEntry } from '../src/core/ingestion/normalizer';
import { VERIFIED_FEED_SOURCES } from '../src/core/ingestion/sources';
import {
  satisfiesCuratedBodyContract,
  satisfiesDefaultCuratedStandard,
  sanitizeCuratedFeedItem
} from '../src/core/enrichment/batchEnricher';
import {
  isWithin14DayRelevanceWindow,
  rankBloomScrollFeed,
  ScoredFeedItem
} from '../src/core/domain/ranking';
import { LocalFeedRepository } from '../src/core/data/feedRepository';
import { SeenImpressionsService, seenImpressionsService } from '../src/core/data/seenImpressionsService';
import { FeedItem } from '../src/core/domain/types';

function makeValidFeedItem(overrides: Partial<FeedItem> = {}): FeedItem {
  const nowIso = new Date().toISOString();
  return {
    id: overrides.id || 'v14-item-1',
    type: 'deep_dive',
    format: 'sourced_update',
    space: 'c/dialektik',
    title: 'Epistemische Souveränität im Zeitalter generativer Sprachmodelle',
    subtitle: 'Warum kritische Urteilskraft und Primärquellenarbeit im Unterricht wichtiger werden denn je.',
    feedText:
      'In einer Medienumgebung voller synthetischer Zusammenfassungen verschiebt sich die eigentliche Bildungsaufgabe von der bloßen Informationsbeschaffung hin zur eigenständigen Prüfung von Prämissen, Quellenketten und argumentativer Kohärenz.',
    articleBody:
      '## Urteilskraft statt Reproduktion\n\nIn einer Medienumgebung voller synthetischer Zusammenfassungen verschiebt sich die eigentliche Bildungsaufgabe von der bloßen Informationsbeschaffung hin zur eigenständigen Prüfung von Prämissen, Quellenketten und argumentativer Kohärenz.',
    body:
      'In einer Medienumgebung voller synthetischer Zusammenfassungen verschiebt sich die eigentliche Bildungsaufgabe von der bloßen Informationsbeschaffung hin zur eigenständigen Prüfung von Prämissen, Quellenketten und argumentativer Kohärenz.',
    topics: ['philosophy_ethics', 'german_didactics'],
    primaryTopic: 'philosophy_ethics',
    sourceReferences: [
      {
        publisher: 'Philosophie Magazin',
        originalUrl: 'https://www.philomag.de/artikel/epistemische-souveraenitaet',
        title: 'Epistemische Souveränität im Zeitalter generativer Sprachmodelle',
        publicationTimestamp: nowIso,
        retrievalTimestamp: nowIso,
        isVerified: true
      }
    ],
    publishedAt: nowIso,
    publicationDateReliable: true,
    firstSeenAt: nowIso,
    generatedAt: nowIso,
    estimatedReadingMinutes: 4,
    relevanceExplanation: 'Relevante philosophisch-didaktische Analyse.',
    contentStatus: 'editorial_briefing',
    isDailyEdition: true,
    editionDate: nowIso.slice(0, 10),
    isDemonstration: false,
    aiAssisted: false,
    factReviewStatus: 'philosophical_discourse',
    provenanceSummary: 'Philosophie Magazin Redaktion.',
    wordCount: 220,
    evidenceTier: 'permitted_full_text',
    contentOrigin: 'live_ingested',
    contentHash: `hash-${overrides.id || 'v14-item-1'}`,
    canonicalUrl: `https://www.philomag.de/artikel/${overrides.id || 'v14-item-1'}`,
    isTeachingRelated: false,
    isChallengingPerspective: false,
    hasAuthenticImage: false,
    keyInsight: 'Urteilskraft entsteht durch Reibung an überprüfbaren Primärquellen.',
    upvotesCount: 0,
    awardsCount: { gold: 0, brain: 0, spark: 0 },
    comments: [],
    sourceTrustLevel: 'verified_creator',
    sourceDomain: 'philomag.de',
    ...overrides
  };
}

describe('Living Endless Bloomscroll v14 — End-to-End Architectural Guards', () => {
  it('1. Dual-Origin SnapshotLoader selects newer raw.githubusercontent.com snapshot over stale GitHub Pages snapshot', async () => {
    const storage = new AtemStorage(new MemoryStorageDriver());
    const sourceRepo = new SourceRepository(storage);
    const loader = new SnapshotLoader(sourceRepo);
    const originalFetch = globalThis.fetch;

    const staleItem = makeValidFeedItem({
      id: 'stale-pages-nov15',
      publishedAt: '2026-11-15T12:00:00.000Z'
    });
    const freshItem = makeValidFeedItem({
      id: 'fresh-raw-nov24',
      publishedAt: '2026-11-24T07:30:00.000Z'
    });

    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('raw.githubusercontent.com')) {
        return new Response(
          JSON.stringify({
            generatedAt: '2026-11-24T07:35:00.000Z',
            items: [freshItem]
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({
          generatedAt: '2026-11-15T15:32:41.699Z',
          items: [staleItem]
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }) as typeof fetch;

    try {
      const res = await loader.loadSnapshot('https://stream-schlaf-0x-cell.github.io/anti-doomscroll-learn-app/feed-snapshot.json');
      assert.equal(res.success, true);
      assert.equal(res.sourceOrigin, 'raw_github');
      assert.equal(res.generatedAt, '2026-11-24T07:35:00.000Z');
      assert.equal(res.items[0].id, 'fresh-raw-nov24');
      assert.ok(RAW_GITHUB_SNAPSHOT_URL.includes('raw.githubusercontent.com'));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('2. SnapshotLoader.loadReservoir parses large >500-item rolling reservoir beyond startup cap', async () => {
    const storage = new AtemStorage(new MemoryStorageDriver());
    const loader = new SnapshotLoader(new SourceRepository(storage));
    const originalFetch = globalThis.fetch;

    const manyItems = Array.from({ length: 540 }, (_, idx) =>
      makeValidFeedItem({
        id: `res-item-${idx}`,
        canonicalUrl: `https://pub-${idx % 90}.example.org/post-${idx}`,
        sourceDomain: `pub-${idx % 90}.example.org`
      })
    );

    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          generatedAt: '2026-11-24T08:00:00.000Z',
          items: manyItems
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )) as typeof fetch;

    try {
      const res = await loader.loadReservoir('https://custom-reservoir.example.org/feed-reservoir.json');
      assert.equal(res.success, true);
      assert.equal(res.items.length, 540);
      assert.ok(RESERVOIR_MAX_ITEMS >= 900);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('3. RSS parser recovers dates from URLs and prevents undated entries from faking 0-second recency', () => {
    const recovered = extractDateFromUrl('https://9to5mac.com/2026/11/22/apple-silicon-essay/');
    assert.ok(recovered?.startsWith('2026-11-22'));

    const withUrlFallback = parseDateWithReliability('', 'https://herrlarbig.de/2026/11/20/ki-im-deutschunterricht/');
    assert.equal(withUrlFallback.reliable, true);
    assert.ok(withUrlFallback.iso.startsWith('2026-11-20'));

    const trulyUndated = parseDateWithReliability('', 'https://plato.stanford.edu/entries/schopenhauer/');
    assert.equal(trulyUndated.reliable, false);
    const ageHours = (Date.now() - new Date(trulyUndated.iso).getTime()) / 3600_000;
    assert.ok(ageHours >= 96, `Undated entry must not receive "0s ago" timestamp, got ${ageHours.toFixed(1)}h`);

    const xmlWithDcterms = `<?xml version="1.0"?>
      <rss version="2.0"><channel><item>
        <title>Didaktik der Urteilskraft</title>
        <link>https://herrlarbig.de/urteilskraft</link>
        <description>Ausführliche Unterrichtsreflexion zur Förderung argumentativer Präzision in der Oberstufe.</description>
        <dcterms:issued>2026-11-23T10:00:00Z</dcterms:issued>
      </item></channel></rss>`;
    const parsed = parseFeedXml(xmlWithDcterms, 'herr-larbig-didaktik');
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].publicationDateReliable, true);
    assert.equal(parsed[0].publishedAt, '2026-11-23T10:00:00.000Z');
  });

  it('4. 70/30 Freshness Choreography prioritizes <48h fresh cards while admitting genuinely high-relevance 3-14d essays', () => {
    const now = Date.now();
    const hoursAgo = (h: number) => new Date(now - h * 3600_000).toISOString();

    const unboostedOld10d = {
      ...makeValidFeedItem({
        id: 'unboosted-10d',
        publishedAt: hoursAgo(240),
        space: 'c/serendipity',
        sourceDomain: 'old-filler.org'
      }),
      score: 0.74,
      scoreBreakdown: {} as any
    } as ScoredFeedItem;

    const highRelEssay9d = {
      ...makeValidFeedItem({
        id: 'earned-essay-9d',
        publishedAt: hoursAgo(216),
        space: 'c/books',
        primaryTopic: 'book_mastery',
        sourceDomain: 'lrb.co.uk',
        wordCount: 900
      }),
      score: 0.90,
      scoreBreakdown: {} as any
    } as ScoredFeedItem;

    assert.equal(isWithin14DayRelevanceWindow(unboostedOld10d, now), false);
    assert.equal(isWithin14DayRelevanceWindow(highRelEssay9d, now), true);

    const spaces = [
      ['c/didaktik_labor', 'german_didactics', 'herrlarbig.de'],
      ['c/dialektik', 'philosophy_ethics', 'philomag.de'],
      ['c/acceleration', 'ai_apple', 'simonwillison.net'],
      ['c/kontemplation', 'contemplation_mind', 'mindful.org'],
      ['c/synth_alchemie', 'sound_synthesis', 'cdm.link'],
      ['c/serendipity', 'science_society', 'mdr.de'],
      ['c/health_longevity', 'health_biohacking', 'spektrum.de'],
      ['c/chancen', 'opportunities_growth', 'noahpinion.blog']
    ] as const;

    const freshItems: ScoredFeedItem[] = spaces.map(([sp, top, dom], i) => ({
      ...makeValidFeedItem({
        id: `fresh-today-${i}`,
        title: `Frische Analyse Nummer ${i} aus ${dom}`,
        publishedAt: hoursAgo(4 + i * 3),
        space: sp,
        primaryTopic: top as any,
        topics: [top as any],
        sourceDomain: dom,
        canonicalUrl: `https://${dom}/fresh-${i}`
      }),
      score: 0.84,
      scoreBreakdown: {} as any
    }));

    const ranked = rankBloomScrollFeed([highRelEssay9d, unboostedOld10d, ...freshItems]);
    assert.ok(!ranked.some(i => i.id === 'unboosted-10d'), 'Unboosted 10d filler must be filtered out');
    assert.ok(ranked.some(i => i.id === 'earned-essay-9d'), 'High-relevance 9d essay must be kept');

    const top8FreshCount = ranked.slice(0, 8).filter(i => i.id.startsWith('fresh-today-')).length;
    assert.ok(top8FreshCount >= 6, `Expected >= 6 of top 8 cards to be <48h fresh, got ${top8FreshCount}`);
  });

  it('5. Specialist Space Protection & Quality Gates block imageless memes, sports, errata, and preserve Didaktik', () => {
    const schulportalSource = VERIFIED_FEED_SOURCES.find(s => s.id === 'deutsches-schulportal')!;
    assert.ok(schulportalSource);

    const normalizedDidaktik = normalizeFeedEntry(
      {
        id: 'schulportal-streik-1',
        title: 'Warum ich die Urkunde nicht will',
        link: 'https://deutsches-schulportal.de/kolumnen/warum-ich-die-urkunde-nicht-will/',
        summary:
          'Für viele Lehrkräfte ist die Verbeamtung selbstverständlich. Julia Westphal erklärt, warum ihr pädagogische Freiheit und das Recht zu streiken in der Schule wichtiger sind als Sicherheit.',
        publishedAt: new Date().toISOString(),
        publicationDateReliable: true,
        sourceId: 'deutsches-schulportal'
      },
      schulportalSource
    );
    const sanitizedDidaktik = sanitizeCuratedFeedItem(normalizedDidaktik);
    assert.equal(sanitizedDidaktik.primaryTopic, 'german_didactics');
    assert.equal(sanitizedDidaktik.space, 'c/didaktik_labor');

    // Imageless meme card must fail body contract for c/memes, while sanitizeCuratedFeedItem reroutes real prose out of c/memes
    const rawImagelessMeme = makeValidFeedItem({
      id: 'live-lobsters-no-img',
      space: 'c/memes',
      primaryTopic: 'memes_satire',
      format: 'meme',
      imageUrl: undefined,
      hasAuthenticImage: false,
      title: 'Bluetooth2Shell: One tap of pairing is all it takes on Linux systems'
    });
    assert.equal(satisfiesCuratedBodyContract(rawImagelessMeme), false);
    const rerouted = sanitizeCuratedFeedItem(rawImagelessMeme);
    assert.notEqual(rerouted.space, 'c/memes');
    assert.notEqual(rerouted.format, 'meme');

    // Sports URL, journal errata, and trivia clickbait must be rejected
    const football = makeValidFeedItem({
      id: 'fr-fussball',
      title: 'Frustrierendes Erlebnis für OFC bei SG Barockstadt Fulda-Lehnerz',
      canonicalUrl: 'https://www.fr.de/sport/fussball/ofc-barockstadt-94591089.html'
    });
    const lancetCorrection = makeValidFeedItem({
      id: 'lancet-erratum',
      title: '[Corrections] Correction to Lancet Psychiatry 2026; 13: 916–18',
      space: 'c/kontemplation'
    });
    const triviaClickbait = makeValidFeedItem({
      id: 'fr-trivia',
      title: 'Auf welchem Kontinent erhebt sich der höchste Berg außerhalb Asiens?'
    });
    assert.equal(satisfiesDefaultCuratedStandard(football), false);
    assert.equal(satisfiesDefaultCuratedStandard(lancetCorrection), false);
    assert.equal(satisfiesDefaultCuratedStandard(triviaClickbait), false);
  });

  it('6. LocalFeedRepository supports >400 unseen items, filters seen items on reservoir hydration & notifies seen subscribers', async () => {
    const memStorage = new AtemStorage(new MemoryStorageDriver());
    const localSeen = new SeenImpressionsService(memStorage);
    let notified = 0;
    const unsub = localSeen.subscribe(() => {
      notified++;
    });
    await localSeen.recordSeen(['seen-res-1']);
    assert.ok(notified >= 1, 'SeenImpressionsService must notify subscribers immediately');
    unsub();

    await seenImpressionsService.recordSeen(['already-seen-global-1']);
    const seedItems = Array.from({ length: 240 }, (_, i) =>
      makeValidFeedItem({
        id: `seed-unseen-${i}`,
        title: `Ursprungsbeitrag Nummer ${i} zur Erkenntnistheorie`,
        canonicalUrl: `https://seed.example.org/${i}`
      })
    );
    const repo = new LocalFeedRepository(seedItems, memStorage);
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          generatedAt: new Date().toISOString(),
          items: [
            makeValidFeedItem({
              id: 'already-seen-global-1',
              title: 'Bereits gesehener Beitrag aus voriger Sitzung',
              canonicalUrl: 'https://res.example.org/seen-1'
            }),
            ...Array.from({ length: 220 }, (_, j) =>
              makeValidFeedItem({
                id: `reservoir-fresh-${j}`,
                title: `Reservoir-Tiefenbeitrag Nummer ${j} zur Fachdidaktik`,
                canonicalUrl: `https://res.example.org/fresh-${j}`
              })
            )
          ]
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )) as typeof fetch;

    try {
      const hyd = await repo.hydrateFromReservoir('https://custom-res.example.org/feed-reservoir.json');
      assert.equal(hyd.success, true);
      assert.equal(hyd.insertedCount, 220);
      const all = repo.getAllItems();
      assert.equal(all.length, 460, 'Repository must retain >400 unseen items without 160-item truncation');
      assert.equal(all.some(i => i.id === 'already-seen-global-1'), false, 'Already-seen item must not enter reservoir pool');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('7. Scheduled Newsroom Workflow & FeedScreen enforce 4h Pages deploy and strict 100% Unseen stream', () => {
    const rootDir = path.resolve(__dirname, '..');
    const workflowYml = fs.readFileSync(path.join(rootDir, '.github/workflows/scheduled-newsroom.yml'), 'utf-8');
    assert.ok(workflowYml.includes("cron: '0 */4 * * *'"), 'Newsroom cron must run every 4 hours');
    assert.ok(workflowYml.includes('actions/deploy-pages@v4'), 'Newsroom workflow must deploy directly to GitHub Pages');
    assert.ok(workflowYml.includes('feed-reservoir.json'), 'Newsroom workflow must publish feed-reservoir.json');

    const feedScreenSrc = fs.readFileSync(path.join(rootDir, 'src/features/feed/FeedScreen.tsx'), 'utf-8');
    assert.equal(
      feedScreenSrc.includes('[...sortedUnseen, ...sortedTail]'),
      false,
      'FeedScreen must never silently append seen quarantinedTail items back into the main stream'
    );
    assert.ok(feedScreenSrc.includes('wakeRefreshSignal'), 'FeedScreen must respond to wakeRefreshSignal');
  });
});
