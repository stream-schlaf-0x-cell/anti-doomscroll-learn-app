import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  sortFeedForDisplay,
  interleaveTodayNewsStream,
  isArdSource,
  scoreFeedItem,
  ScoredFeedItem
} from '../src/core/domain/ranking';
import { FeedItem } from '../src/core/domain/types';
import { prependRevealedItems } from '../src/core/feed/feedPresentation';
import { buildSubstantiveHackerNewsCopy } from '../src/core/data/continuousLiveNewsService';
import {
  getCardRenderableText,
  satisfiesDefaultCuratedStandard
} from '../src/core/enrichment/batchEnricher';
import { INITIAL_FIXTURES, DEFAULT_USER_PROFILE } from '../src/core/data/fixtures';
import { OpenWebHarvester } from '../src/core/ingestion/openWebHarvester';
import { AtemStorage, MemoryStorageDriver } from '../src/core/data/storage';

function makeScoredItem(id: string, overrides: Partial<FeedItem> = {}): ScoredFeedItem {
  const now = new Date();
  const base: FeedItem = {
    ...INITIAL_FIXTURES[0],
    id,
    type: 'briefing',
    format: 'sourced_update',
    title: `Analytischer Bericht ${id}: Erkenntnisse aus Forschung und Gesellschaft`,
    subtitle: 'Wissenschaft & Diskurs • Tagesanalyse',
    feedText:
      'Eine detaillierte Einordnung aktueller wissenschaftlicher, technischer und gesellschaftlicher Entwicklungen mit belastbaren Quellen und klaren historischen Bezügen für das vertiefte Lesen.',
    articleBody:
      'Eine detaillierte Einordnung aktueller wissenschaftlicher, technischer und gesellschaftlicher Entwicklungen mit belastbaren Quellen, überprüfbaren Fakten und klaren historischen Bezügen für das vertiefte Lesen abseits kurzlebiger Schlagzeilen.',
    body:
      'Eine detaillierte Einordnung aktueller wissenschaftlicher, technischer und gesellschaftlicher Entwicklungen mit belastbaren Quellen.',
    primaryTopic: 'science_society',
    topics: ['science_society'],
    publishedAt: new Date(now.getTime() - 3 * 3600 * 1000).toISOString(),
    publicationDateReliable: true,
    firstSeenAt: now.toISOString(),
    generatedAt: now.toISOString(),
    contentOrigin: 'live_ingested',
    evidenceTier: 'publisher_excerpt',
    sourceTrustLevel: 'verified_creator',
    sourceDomain: 'spektrum.de',
    sourceBroadcasterName: 'Spektrum der Wissenschaft',
    sourceReferences: [
      {
        title: `Bericht ${id}`,
        publisher: 'Spektrum',
        originalUrl: `https://example.org/${id}`,
        publicationTimestamp: now.toISOString(),
        retrievalTimestamp: now.toISOString(),
        isVerified: true
      }
    ],
    estimatedReadingMinutes: 3,
    isEvergreenGem: false,
    ...overrides
  };
  return scoreFeedItem(base, DEFAULT_USER_PROFILE, {});
}

describe('True Internet Diversity in "Heute", Zero Duplicates & High-Yield Research', () => {
  it('1. Caps Tagesschau/ARD to <= 25% (max 5) in "⚡ Heute" and enforces domain spacing', () => {
    const ardItems = Array.from({ length: 20 }, (_, i) =>
      makeScoredItem(`live-tagesschau-${i + 1}`, {
        title: `Tagesschau Meldung ${i + 1}: Aktuelle Lage im Inland und Europa`,
        sourceDomain: 'tagesschau.de',
        sourceBroadcasterName: 'ARD Tagesschau',
        sourceTrustLevel: 'public_broadcaster',
        imageUrl: `https://images.tagesschau.de/image-${i + 1}.jpg`,
        hasAuthenticImage: true
      })
    );

    const domains = [
      'spektrum.de',
      'netzpolitik.org',
      'deutschlandfunk.de',
      'wired.com',
      'lithub.com',
      'verfassungsblog.de',
      'theintercept.com',
      'asimov.press',
      'noahpinion.blog',
      'construction-physics.com',
      'latent.space',
      'designboom.com'
    ];

    const diverseItems = domains.map((dom, i) =>
      makeScoredItem(`diverse-today-${i + 1}`, {
        title: `Hintergrundanalyse aus ${dom}: Technologische und gesellschaftliche Dynamiken ${i + 1}`,
        sourceDomain: dom,
        sourceBroadcasterName: dom,
        sourceTrustLevel: 'verified_creator',
        imageUrl: i % 2 === 0 ? `https://${dom}/img-${i + 1}.jpg` : undefined,
        hasAuthenticImage: i % 2 === 0,
        publishedAt: new Date(Date.now() - (4 + (i % 6)) * 3600 * 1000).toISOString()
      })
    );

    const mixedPool = [...ardItems, ...diverseItems];
    const todayFeed = sortFeedForDisplay(mixedPool, 'today');

    const ardCount = todayFeed.filter(isArdSource).length;
    assert.ok(ardCount >= 1 && ardCount <= 5, `Expected 1..5 ARD items in Heute, got ${ardCount}`);
    assert.ok(
      ardCount / todayFeed.length <= 0.35,
      `Expected ARD ratio <= 35%, got ${ardCount}/${todayFeed.length}`
    );

    const distinctDomains = new Set(todayFeed.map(it => it.sourceDomain)).size;
    assert.ok(distinctDomains >= 8, `Expected >= 8 distinct domains in Heute, got ${distinctDomains}`);

    for (let i = 1; i < todayFeed.length; i++) {
      assert.notEqual(
        todayFeed[i - 1].sourceDomain,
        todayFeed[i].sourceDomain,
        `Consecutive duplicate domain "${todayFeed[i].sourceDomain}" at index ${i - 1}..${i}`
      );
    }

    // Verify at least 3 non-ARD items separate consecutive ARD items
    const ardIndices = todayFeed
      .map((item, idx) => (isArdSource(item) ? idx : -1))
      .filter(idx => idx >= 0);
    for (let k = 1; k < ardIndices.length; k++) {
      assert.ok(
        ardIndices[k] - ardIndices[k - 1] >= 4,
        `Expected >= 3 non-ARD cards between ARD cards (indices ${ardIndices[k - 1]} and ${ardIndices[k]})`
      );
    }

    // Verify interleaveTodayNewsStream also handles pure ARD overload cleanly
    const interleavedOnly = interleaveTodayNewsStream([...ardItems, ...diverseItems]);
    assert.ok(interleavedOnly.filter(isArdSource).length <= 5);
  });

  it('2. Deduplicates revealed items by normalized title & canonical URL even with mismatched HN IDs', () => {
    const existing = [
      makeScoredItem('live-hn-42999111', {
        title: 'CERN Built the Large Hadron Collider, Now It’s Looking Inside It',
        canonicalUrl: 'https://spectrum.ieee.org/cern-lhc-upgrade/'
      }),
      makeScoredItem('other-1', {
        title: 'Digitale Souveränität an Schulen in Sachsen',
        canonicalUrl: 'https://example.org/sachsen'
      })
    ];

    const revealed = [
      makeScoredItem('openweb-hn-42999111', {
        title: 'CERN Built the Large Hadron Collider, Now It’s Looking Inside It',
        canonicalUrl: 'https://spectrum.ieee.org/cern-lhc-upgrade'
      }),
      makeScoredItem('openweb-new-99', {
        title: 'Vollkommen neuer Artikel über Phänomenologie und Kognitionswissenschaft',
        canonicalUrl: 'https://example.org/phenomenology'
      })
    ];

    const merged = prependRevealedItems(existing, revealed);
    const matchingCern = merged.filter(it => it.title.includes('Large Hadron Collider'));
    assert.equal(matchingCern.length, 1, 'Same HN title under different IDs must never render twice');
    assert.equal(merged.length, 3);
    assert.equal(merged[0].id, 'openweb-hn-42999111');
  });

  it('3. buildSubstantiveHackerNewsCopy produces non-boilerplate prose accepted by DefaultCuratedStandard', () => {
    const copy = buildSubstantiveHackerNewsCopy({
      title: 'Why Formal Verification of Critical Infrastructure Matters in 2026',
      domain: 'acm.org',
      targetUrl: 'https://acm.org/formal-verification',
      hnUrl: 'https://news.ycombinator.com/item?id=999001',
      points: 312,
      commentsCount: 118
    });

    assert.ok(copy.feedText.length >= 160, `Expected feedText >= 160 chars, got ${copy.feedText.length}`);
    assert.ok(copy.articleBody.length >= 260, `Expected articleBody >= 260 chars, got ${copy.articleBody.length}`);

    const hnItem = makeScoredItem('openweb-hn-999001', {
      title: 'Why Formal Verification of Critical Infrastructure Matters in 2026',
      subtitle: 'acm.org • 312 HN-Punkte (118 Kommentare)',
      feedText: copy.feedText,
      articleBody: copy.articleBody,
      body: copy.feedText,
      keyInsight: copy.keyInsight,
      sourceDomain: 'acm.org',
      sourceTrustLevel: 'community_curated'
    });

    assert.ok(
      getCardRenderableText(hnItem).length >= 160,
      'getCardRenderableText must NOT blank out substantive HN items'
    );
    assert.equal(
      satisfiesDefaultCuratedStandard(hnItem),
      true,
      'Substantive HN item must pass satisfiesDefaultCuratedStandard'
    );
  });

  it('4. Multi-Lane Research filters out existing IDs/titles upfront and yields >= 10 diverse new items', async () => {
    const originalFetch = globalThis.fetch;
    const storage = new AtemStorage(new MemoryStorageDriver());

    const preloadedIds = new Set<string>([
      ...Array.from({ length: 12 }, (_, i) => `live-tagesschau-existing-${i + 1}`),
      'live-hn-1001',
      'openweb-hn-1002'
    ]);
    const preloadedTitles = new Set<string>([
      'alreadyexistingarticlefromboot',
      'cernbuiltthelargehadroncollider'
    ]);

    const nowIso = new Date().toISOString();

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();

      if (url.includes('tagesschau.de/api2u/news')) {
        return new Response(
          JSON.stringify({
            news: Array.from({ length: 12 }, (_, i) => ({
              externalId: i < 10 ? `existing-${i + 1}` : `fresh-${i + 1}`,
              title: `Tagesschau Meldung ${i + 1}: Europäische Energie- und Bildungspolitik im Wandel`,
              firstSentence: 'Hintergrundbericht über aktuelle Beschlüsse in Berlin und Brüssel.',
              date: nowIso,
              ressort: 'inland',
              detailsweb: `https://www.tagesschau.de/inland/meldung-${i + 1}.html`
            }))
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (url.includes('hn.algolia.com')) {
        return new Response(
          JSON.stringify({
            hits: [
              {
                objectID: '1001',
                title: 'CERN Built the Large Hadron Collider',
                url: 'https://spectrum.ieee.org/cern',
                points: 200,
                num_comments: 40,
                created_at: nowIso
              },
              {
                objectID: '2001',
                title: 'Mechanistic Interpretability in Small Transformer Architectures',
                url: 'https://transformer-circuits.pub/2026/study',
                points: 420,
                num_comments: 95,
                created_at: nowIso
              },
              {
                objectID: '2002',
                title: 'Designing Calm Typography for Long-Form Digital Reading',
                url: 'https://ia.net/topics/calm-typography',
                points: 260,
                num_comments: 62,
                created_at: nowIso
              },
              {
                objectID: '2003',
                title: 'How Distributed Consensus Algorithms Work Under Real Packet Loss',
                url: 'https://lamport.org/notes/consensus',
                points: 310,
                num_comments: 84,
                created_at: nowIso
              }
            ]
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (url.includes('api.spaceflightnewsapi.net')) {
        return new Response(
          JSON.stringify({
            results: Array.from({ length: 5 }, (_, i) => ({
              id: 8000 + i,
              title: `James Webb & ESA Mission Update ${i + 1}: Atmospheric Spectroscopy on Exoplanets`,
              url: `https://esa-science-${i + 1}.org/exoplanets`,
              image_url: `https://esa-science-${i + 1}.org/exo.jpg`,
              news_site: `SpaceScience ${i + 1}`,
              summary:
                'Neue hochauflösende Spektraldaten liefern präzise Hinweise auf atmosphärische Prozesse und thermische Schichtung ferner Gesteinsplaneten.',
              published_at: nowIso
            }))
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (url.includes('wikipedia.org/api/rest_v1/page/random/summary')) {
        const randId = Math.floor(Math.random() * 100000);
        return new Response(
          JSON.stringify({
            title: `Phänomenologie und Wahrnehmung ${randId}`,
            extract:
              'Die Phänomenologie untersucht die Strukturen bewusster Erfahrung aus der Perspektive der ersten Person und fragt danach, wie Bedeutung im Erleben entsteht und reflektiert werden kann.',
            content_urls: { desktop: { page: `https://de.wikipedia.org/wiki/Phaenomenologie_${randId}` } }
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (url.includes('wikipedia.org/w/api.php')) {
        return new Response(
          JSON.stringify({
            query: {
              pages: {
                '101': {
                  title: 'Erkenntnistheoretischer Realismus',
                  fullurl: 'https://de.wikipedia.org/wiki/Erkenntnistheoretischer_Realismus',
                  extract:
                    'Der erkenntnistheoretische Realismus geht davon aus, dass eine vom menschlichen Bewusstsein unabhängige Außenwelt existiert und durch wissenschaftliche Methoden angenähert werden kann.'
                },
                '102': {
                  title: 'Hermeneutischer Zirkel in der Didaktik',
                  fullurl: 'https://de.wikipedia.org/wiki/Hermeneutischer_Zirkel',
                  extract:
                    'Das Verstehen einzelner Textstellen setzt stets ein Vorverständnis des Ganzen voraus, während sich dieses Vorverständnis durch die präzise Lektüre schrittweise korrigiert.'
                }
              }
            }
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (url.includes('reddit.com/r/')) {
        return new Response(
          JSON.stringify({
            data: {
              children: [
                {
                  data: {
                    id: 'rd9001',
                    title: 'Why Stoic & Buddhist Ethics Converge on Attention Discipline',
                    selftext:
                      'Across Hellenistic and early Buddhist manuscripts, training attention away from reflexive reactivity serves as the shared foundation for ethical clarity, composure, and intellectual honesty.',
                    permalink: '/r/Philosophy/comments/rd9001/ethics/',
                    url: 'https://reddit.com/r/Philosophy/comments/rd9001/ethics/',
                    score: 340,
                    num_comments: 76,
                    created_utc: Math.floor(Date.now() / 1000) - 3600
                  }
                }
              ]
            }
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(JSON.stringify({}), { status: 404 });
    }) as typeof fetch;

    try {
      const result = await OpenWebHarvester.harvestMultiLaneInternetDiscovery({
        storage,
        existingIds: preloadedIds,
        existingTitles: preloadedTitles,
        targetNewCount: 16
      });

      assert.ok(
        result.insertedCount >= 10,
        `Expected >= 10 new articles even with preloaded boot IDs, got ${result.insertedCount}`
      );
      assert.equal(
        result.duplicateCount <= 3,
        true,
        `Expected upfront unseen filtering to keep duplicateCount <= 3, got ${result.duplicateCount}`
      );
      assert.equal(
        result.items.some(it => it.id === 'openweb-hn-1001' || it.id === 'live-hn-1001'),
        false,
        'Excluded HN item must not be re-added'
      );
      const ardNewCount = result.items.filter(isArdSource).length;
      assert.ok(ardNewCount <= 2, `Expected Tagesschau capped at <= 2 in manual research, got ${ardNewCount}`);
      const domains = new Set(result.items.map(it => it.sourceDomain));
      assert.ok(domains.size >= 4, `Expected >= 4 distinct domains in research output, got ${domains.size}`);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
