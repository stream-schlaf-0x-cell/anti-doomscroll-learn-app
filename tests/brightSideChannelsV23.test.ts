import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import * as path from 'node:path';
import {
  isDoomscrollOrOffTopicNoise,
  satisfiesDefaultCuratedStandard
} from '../src/core/enrichment/batchEnricher';
import {
  selectBalancedStartupItems,
  selectCappedReservoirItems,
  PRIORITY_SPACES,
  STARTUP_SNAPSHOT_CAP
} from '../scripts/run-pipeline';
import {
  fetchArtInstituteArtworks,
  fetchClevelandMuseumArtworks,
  fetchWikipediaBrightDiscoveries,
  isBrightWebFlagshipItem
} from '../src/core/ingestion/brightWebAdapters';
import { SubchannelFlourishService } from '../src/core/ingestion/subchannelFlourishService';
import { FeedItem, FeedItemSchema, TopicTag } from '../src/core/domain/types';

function makeItem(id: string, overrides: Partial<FeedItem> = {}): FeedItem {
  const nowIso = new Date().toISOString();
  return FeedItemSchema.parse({
    id,
    type: 'briefing',
    format: 'sourced_update',
    title: `Analytischer Beitrag ${id}: Perspektiven aus Wissenschaft und Kultur`,
    subtitle: 'Wissenschaft & Kultur',
    feedText:
      'Eine fundierte Untersuchung zentraler Zusammenhänge, historischer Hintergründe und methodischer Perspektiven für konzentriertes Lesen.',
    articleBody:
      'Eine fundierte Untersuchung zentraler Zusammenhänge, historischer Hintergründe und methodischer Perspektiven für konzentriertes Lesen über mehrere Absätze.',
    body:
      'Eine fundierte Untersuchung zentraler Zusammenhänge, historischer Hintergründe und methodischer Perspektiven für konzentriertes Lesen.',
    keyInsight: 'Klare Gegenüberstellung empirischer Befunde und offener Fragen.',
    primaryTopic: 'science_society',
    topics: ['science_society'],
    space: 'c/serendipity',
    publishedAt: nowIso,
    publicationDateReliable: true,
    firstSeenAt: nowIso,
    generatedAt: nowIso,
    estimatedReadingMinutes: 4,
    relevanceExplanation: 'Thematische Relevanz und geprüfte Quelle.',
    contentStatus: 'editorial_briefing',
    isDailyEdition: true,
    editionDate: nowIso.slice(0, 10),
    isDemonstration: false,
    aiAssisted: false,
    factReviewStatus: 'curated_illustrative',
    provenanceSummary: 'Geprüfte Redaktionsquelle',
    wordCount: 220,
    evidenceTier: 'publisher_excerpt',
    contentOrigin: 'live_ingested',
    contentHash: `hash-${id}`,
    canonicalUrl: `https://example-editorial.de/${id}`,
    sourceDomain: 'example-editorial.de',
    sourceBroadcasterName: 'Editorial Source',
    sourceReferences: [
      {
        publisher: 'Editorial Source',
        originalUrl: `https://example-editorial.de/${id}`,
        title: `Beitrag ${id}`,
        publicationTimestamp: nowIso,
        retrievalTimestamp: nowIso,
        isVerified: true
      }
    ],
    sourceTrustLevel: 'deep_essay',
    upvotesCount: 0,
    awardsCount: { gold: 0, brain: 0, spark: 0 },
    comments: [],
    ...overrides
  });
}

describe('Bright-Side of the Internet v23 Contracts', () => {
  it('1. isDoomscrollOrOffTopicNoise blocks police blotters, abuse tabloids, consumer spam & clinical oncology/EEG while allowing bright-web essays and structural policy', () => {
    // Blocked everywhere
    assert.equal(
      isDoomscrollOrOffTopicNoise({
        title: 'Polizeibericht: Laubenbrand in Dresden-Pieschen fordert Feuerwehr',
        space: 'c/serendipity'
      }),
      true
    );
    assert.equal(
      isDoomscrollOrOffTopicNoise({
        title: 'Lehrer soll Schülerin missbraucht haben – Prozess beginnt',
        space: 'c/didaktik_labor'
      }),
      true
    );
    assert.equal(
      isDoomscrollOrOffTopicNoise({
        title: '13-Jährige schildert Missbrauch vor dem Landgericht',
        space: 'c/dialektik'
      }),
      true
    );
    assert.equal(
      isDoomscrollOrOffTopicNoise({
        title: 'Test: Peugeot E-3008 im Alltagstest auf der Autobahn',
        space: 'c/acceleration'
      }),
      true
    );
    assert.equal(
      isDoomscrollOrOffTopicNoise({
        title: '10 Best Meal Delivery Services Tested for Busy Families',
        space: 'c/health_longevity'
      }),
      true
    );
    assert.equal(
      isDoomscrollOrOffTopicNoise({
        title: 'GTA 6 Trailer: Alle neuen Gerüchte zum Release-Termin',
        space: 'c/serendipity'
      }),
      true
    );
    assert.equal(
      isDoomscrollOrOffTopicNoise({
        title: 'FRITZ!Box 5690 Pro erhält neues Labor-Update mit WLAN-Optionen',
        space: 'c/acceleration'
      }),
      true
    );
    assert.equal(
      isDoomscrollOrOffTopicNoise({
        title: 'Early Black Friday deal: Save 40% on noise-cancelling headphones',
        space: 'c/synth_alchemie'
      }),
      true
    );

    // Clinical oncology / EEG wet-lab papers blocked in c/serendipity & c/kontemplation
    assert.equal(
      isDoomscrollOrOffTopicNoise({
        title: 'Spatial tumor architecture predicts anticancer drug response in colorectal cancer',
        space: 'c/serendipity',
        primaryTopic: 'science_society'
      }),
      true
    );
    assert.equal(
      isDoomscrollOrOffTopicNoise({
        title: 'Aperiodic EEG slope dynamics during visual working memory tasks',
        sourceBroadcasterName: 'Frontiers in Human Neuroscience',
        space: 'c/kontemplation',
        primaryTopic: 'contemplation_mind'
      }),
      true
    );

    // Real bright-web essays & comics MUST be allowed
    const allowedBrightItems: Partial<FeedItem>[] = [
      {
        title: 'Why Kantian Autonomy Still Illuminates Modern Digital Ethics',
        sourceDomain: 'aeon.co',
        space: 'c/dialektik'
      },
      {
        title: 'How Mathematicians Mapped a New Geometry of Prime Gaps',
        sourceDomain: 'quantamagazine.org',
        space: 'c/serendipity'
      },
      {
        title: 'The Quiet Renaissance of Tape Loops and Modular Ambient Synthesis',
        sourceDomain: 'daily.bandcamp.com',
        space: 'c/synth_alchemie'
      },
      {
        title: 'Epistemological Standards in Coordinate Systems',
        sourceDomain: 'xkcd.com',
        space: 'c/memes'
      },
      {
        title: 'Formatives Feedback im Ethikunterricht: Wie Lernprozesse sichtbar werden',
        sourceDomain: 'deutsches-schulportal.de',
        space: 'c/didaktik_labor'
      },
      {
        title: 'Investitionen in Schienenverkehr und Forschung: Bundestag berät Strukturprogramm',
        sourceDomain: 'tagesschau.de',
        space: 'c/gesellschaft_politik'
      }
    ];

    for (const allowed of allowedBrightItems) {
      assert.equal(
        isDoomscrollOrOffTopicNoise(allowed),
        false,
        `Expected bright-web / policy item "${allowed.title}" to be ALLOWED`
      );
    }
  });

  it('2. selectBalancedStartupItems & selectCappedReservoirItems cap <= 2 per publisher, prioritize bright-web gems over tickers, and protect reservoir floors', () => {
    const nowMs = Date.now();
    const oneHourAgo = new Date(nowMs - 3600_000).toISOString();
    const fiveDaysAgo = new Date(nowMs - 5 * 86_400_000).toISOString();

    const pool: FeedItem[] = [];

    // Flood each key channel with 6 fresh 1-hour-old generic ticker items from a single high-frequency publisher
    const tickerChannels: Array<{
      space: string;
      topic: TopicTag;
      tickerDomain: string;
      flagshipDomain: string;
      flagshipName: string;
      format?: FeedItem['format'];
    }> = [
      {
        space: 'c/dialektik',
        topic: 'philosophy_ethics',
        tickerDomain: 'ticker-news.example.de',
        flagshipDomain: 'aeon.co',
        flagshipName: 'Aeon'
      },
      {
        space: 'c/serendipity',
        topic: 'science_society',
        tickerDomain: 'ticker-sci.example.de',
        flagshipDomain: 'quantamagazine.org',
        flagshipName: 'Quanta Magazine'
      },
      {
        space: 'c/memes',
        topic: 'memes_satire',
        tickerDomain: 'boingboing.net',
        flagshipDomain: 'xkcd.com',
        flagshipName: 'xkcd',
        format: 'meme'
      },
      {
        space: 'c/synth_alchemie',
        topic: 'sound_synthesis',
        tickerDomain: 'amazona.de',
        flagshipDomain: 'daily.bandcamp.com',
        flagshipName: 'Bandcamp Daily'
      },
      {
        space: 'c/didaktik_labor',
        topic: 'german_didactics',
        tickerDomain: 'news4teachers.de',
        flagshipDomain: 'deutsches-schulportal.de',
        flagshipName: 'Das Deutsche Schulportal'
      },
      {
        space: 'c/kunst_galerie',
        topic: 'art_aesthetics',
        tickerDomain: 'generic-artblog.example.org',
        flagshipDomain: 'artic.edu',
        flagshipName: 'Art Institute of Chicago',
        format: 'art_showcase'
      }
    ];

    for (const ch of tickerChannels) {
      for (let i = 0; i < 6; i++) {
        pool.push(
          makeItem(`ticker-${ch.space.replace('c/', '')}-${i}`, {
            space: ch.space,
            primaryTopic: ch.topic,
            format: ch.format || 'sourced_update',
            publishedAt: oneHourAgo,
            sourceDomain: ch.tickerDomain,
            sourceBroadcasterName: ch.tickerDomain,
            imageUrl: `https://cdn.example.org/${ch.tickerDomain}-${i}.jpg`,
            hasAuthenticImage: true
          })
        );
      }
      // Add 2 flagship bright-web gems that are 5 days older than the 1-hour tickers
      for (let j = 0; j < 2; j++) {
        const flagshipItem = makeItem(`flagship-${ch.space.replace('c/', '')}-${j}`, {
          space: ch.space,
          primaryTopic: ch.topic,
          format: ch.format || 'long_invitation',
          publishedAt: fiveDaysAgo,
          sourceDomain: ch.flagshipDomain,
          sourceBroadcasterName: ch.flagshipName,
          canonicalUrl: `https://${ch.flagshipDomain}/essay-${j}`,
          imageUrl: `https://images.example.org/${ch.flagshipDomain}-${j}.jpg`,
          hasAuthenticImage: true
        });
        assert.equal(isBrightWebFlagshipItem(flagshipItem), true, `Expected ${ch.flagshipDomain} to be flagship`);
        pool.push(flagshipItem);
      }
    }

    const startup = selectBalancedStartupItems(pool, nowMs, STARTUP_SNAPSHOT_CAP);

    for (const ch of tickerChannels) {
      const chItems = startup.filter(i => i.space === ch.space);
      const tickerCount = chItems.filter(i => i.sourceDomain === ch.tickerDomain).length;
      assert.ok(
        tickerCount <= 2,
        `Expected <= 2 items from ticker ${ch.tickerDomain} in ${ch.space}, got ${tickerCount}`
      );

      const flagshipIdx = chItems.findIndex(i => i.sourceDomain === ch.flagshipDomain);
      const tickerIdx = chItems.findIndex(i => i.sourceDomain === ch.tickerDomain);
      assert.ok(flagshipIdx >= 0, `Expected flagship ${ch.flagshipDomain} included in ${ch.space}`);
      if (tickerIdx >= 0) {
        assert.ok(
          flagshipIdx < tickerIdx,
          `Expected 5-day-old flagship ${ch.flagshipDomain} (idx ${flagshipIdx}) to rank ahead of 1-hour-old ticker ${ch.tickerDomain} (idx ${tickerIdx}) in ${ch.space}`
        );
      }
    }

    // Verify selectCappedReservoirItems protects balanced reservoir floors across ALL channels including c/health_longevity
    const reservoirPool: FeedItem[] = [];
    for (let i = 0; i < 650; i++) {
      reservoirPool.push(
        makeItem(`flood-accel-${i}`, {
          space: 'c/acceleration',
          primaryTopic: 'ai_apple',
          sourceDomain: `accel-${i % 40}.example.org`,
          publishedAt: oneHourAgo
        })
      );
    }
    for (const sp of PRIORITY_SPACES) {
      const topicMap: Record<string, TopicTag> = {
        'c/didaktik_labor': 'german_didactics',
        'c/books': 'book_mastery',
        'c/kontemplation': 'contemplation_mind',
        'c/synth_alchemie': 'sound_synthesis',
        'c/acceleration': 'ai_apple',
        'c/dialektik': 'philosophy_ethics',
        'c/serendipity': 'science_society',
        'c/health_longevity': 'health_biohacking',
        'c/chancen': 'opportunities_growth',
        'c/youtube': 'youtube_gems',
        'c/memes': 'memes_satire',
        'c/gesellschaft_politik': 'science_society'
      };
      for (let k = 0; k < 20; k++) {
        reservoirPool.push(
          makeItem(`floor-${sp.replace('c/', '')}-${k}`, {
            space: sp,
            primaryTopic: topicMap[sp] || 'science_society',
            sourceDomain: `${sp.replace('c/', '')}-pub-${k}.example.org`,
            publishedAt: fiveDaysAgo
          })
        );
      }
    }

    const reservoir = selectCappedReservoirItems(reservoirPool, 650);
    const healthCount = reservoir.filter(i => i.space === 'c/health_longevity').length;
    assert.ok(
      healthCount >= 18,
      `Expected balanced reservoir floor for c/health_longevity (>= 18), got ${healthCount}`
    );
    for (const sp of PRIORITY_SPACES) {
      const count = reservoir.filter(i => i.space === sp).length;
      assert.ok(count >= 15, `Expected reservoir floor >= 15 for ${sp}, got ${count}`);
    }
  });

  it('3. brightWebAdapters (ARTIC, Cleveland Museum, Wikipedia DE/EN) emit schema-valid curated FeedItems with high-res images & artMeta', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();

      if (url.includes('api.artic.edu/api/v1/artworks')) {
        return new Response(
          JSON.stringify({
            data: [
              {
                id: 27992,
                title: 'A Sunday on La Grande Jatte — 1884',
                artist_display: 'Georges Seurat\nFrench, 1859–1891',
                date_display: '1884–86',
                medium_display: 'Oil on canvas',
                place_of_origin: 'France',
                department_title: 'Painting and Sculpture of Europe',
                image_id: '2d484387-2509-5e8e-2c43-22f9981972eb',
                thumbnail: {
                  alt_text: 'Pointillist painting of Parisians relaxing along the Seine river bank.'
                },
                short_description:
                  'Georges Seurat painted his monumental pointillist masterpiece using luminous juxtaposed dots of pure color to capture light and stillness.',
                is_public_domain: true
              }
            ]
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (url.includes('openaccess-api.clevelandart.org/api/artworks')) {
        return new Response(
          JSON.stringify({
            data: [
              {
                id: 94979,
                accession_number: '1958.31',
                title: 'The Red Kerchief',
                creation_date: 'c. 1868–73',
                technique: 'Oil on canvas',
                department: 'European Painting and Sculpture',
                culture: ['France'],
                wall_description:
                  'Claude Monet captures his wife Camille passing a snow-framed window in Argenteuil, contrasting cool winter light with a fleeting burst of crimson.',
                url: 'https://www.clevelandart.org/art/1958.31',
                creators: [{ description: 'Claude Monet (French, 1840–1926)' }],
                images: {
                  web: { url: 'https://openaccess-cdn.clevelandart.org/1958.31/1958.31_web.jpg' },
                  print: { url: 'https://openaccess-cdn.clevelandart.org/1958.31/1958.31_print.jpg' }
                }
              }
            ]
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (url.includes('de.wikipedia.org/api/rest_v1/feed/featured/')) {
        return new Response(
          JSON.stringify({
            tfa: {
              title: 'Dresdner_Zwinger',
              normalizedtitle: 'Dresdner Zwinger',
              description: 'Barockes Bauwerksensemble mit Gartenanlagen in Dresden',
              extract:
                'Der Dresdner Zwinger ist ein bedeutendes barockes Gesamtkunstwerk aus Architektur, Plastik und Malerei, das ab 1709 unter der Leitung von Matthäus Daniel Pöppelmann und Balthasar Permoser entstand und heute weltberühmte Museen beherbergt.',
              originalimage: {
                source: 'https://upload.wikimedia.org/wikipedia/commons/zwinger_dresden_hd.jpg',
                width: 1600,
                height: 1066
              },
              content_urls: {
                desktop: { page: 'https://de.wikipedia.org/wiki/Dresdner_Zwinger' }
              }
            },
            image: {
              title: 'File:Elbsandsteingebirge_Morgennebel.jpg',
              image: {
                source: 'https://upload.wikimedia.org/wikipedia/commons/elbsandstein_potd.jpg',
                width: 1920,
                height: 1280
              },
              description: {
                text: 'Morgennebel über den Sandsteinfelsen der Sächsischen Schweiz im ersten Sonnenlicht des Herbstes.'
              },
              artist: { text: 'Clara Fotografie' },
              file_page: 'https://commons.wikimedia.org/wiki/File:Elbsandsteingebirge_Morgennebel.jpg'
            }
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (url.includes('en.wikipedia.org/api/rest_v1/feed/featured/')) {
        return new Response(
          JSON.stringify({
            tfa: {
              title: 'Noether%27s_theorem',
              normalizedtitle: "Noether's theorem",
              description: 'Fundamental theorem relating symmetry and conservation laws in physics',
              extract:
                "Noether's theorem proves that every differentiable symmetry of the action of a physical system with conservative forces corresponds to a conservation law, uniting mathematical beauty with the deepest structural principles of modern physics.",
              originalimage: {
                source: 'https://upload.wikimedia.org/wikipedia/commons/emmy_noether_portrait.jpg',
                width: 1200,
                height: 1500
              },
              content_urls: {
                desktop: { page: "https://en.wikipedia.org/wiki/Noether's_theorem" }
              }
            }
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(JSON.stringify({}), { status: 404 });
    }) as typeof fetch;

    try {
      const [articItems, clevelandItems, wikiItems] = await Promise.all([
        fetchArtInstituteArtworks({ limit: 4, page: 1, today: '2026-11-27' }),
        fetchClevelandMuseumArtworks({ limit: 4, skip: 0, today: '2026-11-27' }),
        fetchWikipediaBrightDiscoveries({ date: new Date('2026-11-27T08:00:00Z'), today: '2026-11-27' })
      ]);

      assert.equal(articItems.length, 1);
      assert.equal(clevelandItems.length, 1);
      assert.equal(wikiItems.length, 3); // DE TFA + DE POTD + EN TFA

      for (const item of [...articItems, ...clevelandItems, ...wikiItems]) {
        const parsed = FeedItemSchema.safeParse(item);
        assert.equal(parsed.success, true, `FeedItemSchema failed for ${item.id}: ${parsed.success ? '' : parsed.error.message}`);
        assert.equal(
          satisfiesDefaultCuratedStandard(item),
          true,
          `satisfiesDefaultCuratedStandard failed for ${item.id}`
        );
        assert.ok(item.imageUrl && item.imageUrl.startsWith('https://'), `Expected https imageUrl on ${item.id}`);
        assert.equal(item.hasAuthenticImage, true);
      }

      assert.equal(articItems[0].space, 'c/kunst_galerie');
      assert.equal(articItems[0].format, 'art_showcase');
      assert.equal(articItems[0].artMeta?.museum, 'Art Institute of Chicago');
      assert.ok(articItems[0].artMeta?.highResImageUrl?.includes('/full/1200,/0/default.jpg'));

      assert.equal(clevelandItems[0].space, 'c/kunst_galerie');
      assert.equal(clevelandItems[0].format, 'art_showcase');
      assert.equal(clevelandItems[0].artMeta?.museum, 'Cleveland Museum of Art');
      assert.equal(
        clevelandItems[0].artMeta?.highResImageUrl,
        'https://openaccess-cdn.clevelandart.org/1958.31/1958.31_print.jpg'
      );

      const potd = wikiItems.find(i => i.id.startsWith('bright-wiki-potd-'));
      assert.ok(potd?.artMeta?.museum?.includes('Wikimedia Commons'));
      assert.equal(potd?.space, 'c/kunst_galerie');
      const tfaDe = wikiItems.find(i => i.id.startsWith('bright-wiki-tfa-de-'));
      assert.equal(tfaDe?.space, 'c/serendipity');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('4. SubchannelFlourishService live refresh: CORS-open c/memes (0 reddit.com), ARTIC c/kunst_galerie, bright-web c/dialektik', async () => {
    const originalFetch = globalThis.fetch;
    const fetchedUrls: string[] = [];

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      fetchedUrls.push(url);

      if (url.includes('feed-reservoir.json') || url.includes('feed-snapshot.json')) {
        return new Response(
          JSON.stringify({
            generatedAt: new Date().toISOString(),
            totalCandidateSources: 10,
            activeDeliveringSources: 5,
            totalAvailableItems: 0,
            items: [],
            sourceHealth: {}
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (url.includes('api.rss2json.com')) {
        if (url.includes('xkcd.com')) {
          return new Response(
            JSON.stringify({
              status: 'ok',
              feed: { title: 'xkcd.com', author: 'Randall Munroe' },
              items: [
                {
                  title: 'Bayesian Calibration',
                  link: 'https://xkcd.com/3100/',
                  pubDate: new Date().toISOString(),
                  author: 'Randall Munroe',
                  description:
                    '<img src="https://imgs.xkcd.com/comics/bayesian_calibration.png" title="Updating priors after reading one chart" alt="Bayesian Calibration" />'
                }
              ]
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        if (url.includes('aeon.co')) {
          return new Response(
            JSON.stringify({
              status: 'ok',
              feed: { title: 'Aeon', author: 'Aeon Editors' },
              items: [
                {
                  title: 'The Epistemology of Attention in an Age of Algorithmic Speed',
                  link: 'https://aeon.co/essays/epistemology-of-attention',
                  pubDate: new Date().toISOString(),
                  author: 'Elena Hartmann',
                  thumbnail: 'https://images.aeonmedia.co/images/attention_essay_hero.jpg',
                  description:
                    'Philosophy of perception reveals that sustained attention is not a passive spotlight but an active ethical practice shaped by the environments we build and share.'
                }
              ]
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response(JSON.stringify({ status: 'ok', items: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (url.includes('lemmy.world/api/v3/post/list?community_name=sciencememes')) {
        return new Response(
          JSON.stringify({
            posts: [
              {
                post: {
                  id: 7742,
                  name: 'Thermodynamics professors explaining entropy before breakfast',
                  url: 'https://lemmy.world/pictrs/image/entropy_breakfast.jpg',
                  body: 'Second law remains undefeated.',
                  published: new Date().toISOString(),
                  removed: false,
                  deleted: false,
                  nsfw: false
                },
                counts: { score: 315, comments: 19 },
                creator: { name: 'maxwell_demon' }
              }
            ]
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (url.includes('api.artic.edu/api/v1/artworks')) {
        return new Response(
          JSON.stringify({
            data: [
              {
                id: 111628,
                title: 'Nighthawks',
                artist_display: 'Edward Hopper\nAmerican, 1882–1967',
                date_display: '1942',
                medium_display: 'Oil on canvas',
                place_of_origin: 'United States',
                department_title: 'Arts of the Americas',
                image_id: '831a05de-d3f6-f4fa-a460-23008dd58dda',
                short_description:
                  'Edward Hopper portrays four figures inside a fluorescent-lit downtown diner at night, turning architectural geometry into a meditation on urban solitude.',
                is_public_domain: true
              }
            ]
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(JSON.stringify({ data: { children: [] }, results: [], hits: [], query: { pages: {} } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }) as typeof fetch;

    try {
      // A. fetchMemesComicsLane: ZERO reddit.com requests, authentic image comics, zero synthetic boilerplate
      const memeProfile = SubchannelFlourishService.buildQueryProfile('c/memes');
      const memeItems = await SubchannelFlourishService.fetchMemesComicsLane(
        memeProfile,
        '2026-11-27',
        { pageCursor: 0 }
      );
      assert.equal(
        fetchedUrls.some(u => u.includes('reddit.com')),
        false,
        'fetchMemesComicsLane must make ZERO reddit.com requests'
      );
      assert.ok(memeItems.some(i => i.imageUrl === 'https://imgs.xkcd.com/comics/bayesian_calibration.png'));
      assert.ok(memeItems.some(i => i.imageUrl === 'https://lemmy.world/pictrs/image/entropy_breakfast.jpg'));
      for (const item of memeItems) {
        assert.equal(item.format, 'meme');
        assert.equal(item.space, 'c/memes');
        assert.equal(item.hasAuthenticImage, true);
        assert.ok(!item.feedText.includes('Die Analyse zu'), 'No synthetic boilerplate allowed in c/memes');
        assert.ok(!item.feedText.includes('untersucht die kognitiven'), 'No synthetic boilerplate allowed in c/memes');
      }

      // B. flourishChannel('c/kunst_galerie') fetches ARTIC CC0 artworks
      const artRes = await SubchannelFlourishService.flourishChannel('c/kunst_galerie', {
        force: true,
        pageCursor: 0,
        existingItems: []
      });
      assert.ok(
        fetchedUrls.some(u => u.includes('api.artic.edu/api/v1/artworks')),
        'flourishChannel(c/kunst_galerie) must fetch ARTIC CC0 artworks'
      );
      const hopper = artRes.items.find(i => i.id === 'bright-artic-111628');
      assert.ok(hopper, 'Expected ARTIC artwork bright-artic-111628 in c/kunst_galerie');
      assert.equal(hopper.format, 'art_showcase');
      assert.equal(hopper.artMeta?.museum, 'Art Institute of Chicago');

      // C. flourishChannel('c/dialektik') uses bright-web live lane (Aeon via rss2json)
      const dialektikRes = await SubchannelFlourishService.flourishChannel('c/dialektik', {
        force: true,
        pageCursor: 0,
        existingItems: []
      });
      assert.ok(
        fetchedUrls.some(u => u.includes('api.rss2json.com') && u.includes('aeon.co')),
        'flourishChannel(c/dialektik) must call bright-web live lane for Aeon'
      );
      const aeonItem = dialektikRes.items.find(i => i.canonicalUrl === 'https://aeon.co/essays/epistemology-of-attention');
      assert.ok(aeonItem, 'Expected live Aeon essay returned in c/dialektik');
      assert.equal(aeonItem.space, 'c/dialektik');
      assert.equal(aeonItem.imageUrl, 'https://images.aeonmedia.co/images/attention_essay_hero.jpg');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('5. scripts/scrapling_harvester.py extracts og:image/twitter:image, rejects favicons/1x1 pixels, and never emits synthetic German boilerplate', () => {
    const repoRoot = path.resolve(__dirname, '..');
    const pythonScript = `
import json, sys
sys.path.insert(0, "scripts")
from scrapling_harvester import build_dual_tier_content

html_og = """<!doctype html><html><head>
  <title>Philosophy of Slow Reading - Aeon</title>
  <meta content="/assets/hero-reading-room.jpg" property="og:image" />
</head><body><article>
  <h1>Philosophy of Slow Reading</h1>
  <p>Deep reading requires sustained cognitive silence and unhurried dialogue with complex texts across disciplines.</p>
  <p>When readers step outside algorithmic feeds, memory consolidation and critical discernment strengthen measurably.</p>
</article></body></html>"""

html_twitter = """<!doctype html><html><head>
  <title>Acoustic Ecology</title>
  <meta property="og:image" content="https://example.org/favicon.ico" />
  <meta name="twitter:image" content="https://cdn.example.org/soundscape-1200.webp" />
</head><body><main><p>Acoustic ecology investigates how natural and urban soundscapes shape human perception and wellbeing.</p></main></body></html>"""

html_pixel_empty = """<!doctype html><html><head>
  <title>Minimal Stub</title>
  <meta property="og:image" content="https://tracker.example.org/1x1/pixel.gif" />
  <meta name="twitter:image" content="https://example.org/site-logo.png" />
</head><body><article></article></body></html>"""

out = {
  "og": build_dual_tier_content("https://aeon.co/essays/slow-reading", html_og),
  "twitter": build_dual_tier_content("https://example.org/acoustic", html_twitter),
  "empty": build_dual_tier_content("https://example.org/minimal-stub", html_pixel_empty),
}
print(json.dumps(out, ensure_ascii=False))
`;

    const rawStdout = execFileSync('python3', ['-c', pythonScript], {
      cwd: repoRoot,
      encoding: 'utf-8',
      timeout: 15_000
    });
    const parsed = JSON.parse(rawStdout) as {
      og: { imageUrl: string; essenceText: string; fullMarkdownBody: string };
      twitter: { imageUrl: string; essenceText: string; fullMarkdownBody: string };
      empty: { imageUrl: string; essenceText: string; fullMarkdownBody: string };
    };

    assert.equal(parsed.og.imageUrl, 'https://aeon.co/assets/hero-reading-room.jpg');
    assert.ok(parsed.og.essenceText.includes('Deep reading requires sustained cognitive silence'));

    assert.equal(parsed.twitter.imageUrl, 'https://cdn.example.org/soundscape-1200.webp');

    assert.equal(parsed.empty.imageUrl, '', 'Favicons, 1x1 tracking pixels, and site-logo URLs must be rejected');
    assert.equal(
      parsed.empty.essenceText.includes('Die Analyse zu'),
      false,
      'Must NEVER emit synthetic German boilerplate in essenceText'
    );
    assert.equal(
      parsed.empty.fullMarkdownBody.includes('Die Analyse zu'),
      false,
      'Must NEVER emit synthetic German boilerplate in fullMarkdownBody'
    );
    assert.equal(
      parsed.empty.fullMarkdownBody.includes('untersucht die kognitiven'),
      false,
      'Must NEVER emit synthetic cognitive boilerplate'
    );
  });
});
