import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeFeedEntry } from '../src/core/ingestion/normalizer';
import { parseFeedXml } from '../src/core/ingestion/rssParser';
import { VERIFIED_FEED_SOURCES } from '../src/core/ingestion/sources';
import { SubchannelFlourishService, extractYoutubeVideoId } from '../src/core/ingestion/subchannelFlourishService';
import {
  ContinuousLiveNewsService,
  buildSubstantiveHackerNewsCopy,
  isEditorialQualityHackerNewsStory
} from '../src/core/data/continuousLiveNewsService';
import {
  isSaxonyRegionalItem,
  isWithin14DayRelevanceWindow,
  rankBloomScrollFeed,
  scoreFeedItem,
  sortFeedForDisplay,
  isAggregatorItem,
  getEffectiveSpaceHandle,
  ScoredFeedItem
} from '../src/core/domain/ranking';
import {
  selectBalancedStartupItems,
  selectCappedReservoirItems,
  PRIORITY_SPACES,
  STARTUP_SNAPSHOT_CAP
} from '../scripts/run-pipeline';
import { satisfiesDefaultCuratedStandard } from '../src/core/enrichment/batchEnricher';
import { DEFAULT_USER_PROFILE } from '../src/core/data/fixtures';
import { FeedItem, FeedItemSchema, TopicTag } from '../src/core/domain/types';
import { RawFeedEntry, RawFeedSource } from '../src/core/ingestion/types';

function makeItem(id: string, overrides: Partial<FeedItem> = {}): FeedItem {
  const nowIso = new Date().toISOString();
  return FeedItemSchema.parse({
    id,
    type: 'briefing',
    format: 'sourced_update',
    title: `Analytischer Fachbeitrag ${id}: Perspektiven aus Wissenschaft und Gesellschaft`,
    subtitle: 'Wissenschaft & Diskurs',
    feedText:
      'Eine differenzierte Untersuchung aktueller Forschungsergebnisse, historischer Hintergründe und methodischer Einwände für konzentriertes Lesen ohne Sensationsrhetorik.',
    articleBody:
      'Eine differenzierte Untersuchung aktueller Forschungsergebnisse, historischer Hintergründe und methodischer Einwände für konzentriertes Lesen ohne Sensationsrhetorik über mehrere Absätze.',
    body:
      'Eine differenzierte Untersuchung aktueller Forschungsergebnisse, historischer Hintergründe und methodischer Einwände für konzentriertes Lesen.',
    keyInsight: 'Strukturierte Gegenüberstellung empirischer Befunde und offener Forschungsfragen.',
    primaryTopic: 'science_society',
    topics: ['science_society'],
    space: 'c/serendipity',
    publishedAt: nowIso,
    publicationDateReliable: true,
    firstSeenAt: nowIso,
    generatedAt: nowIso,
    estimatedReadingMinutes: 4,
    relevanceExplanation: 'Thematische Relevanz und belastbare Quellenlage.',
    contentStatus: 'editorial_briefing',
    isDailyEdition: true,
    editionDate: nowIso.slice(0, 10),
    isDemonstration: false,
    aiAssisted: false,
    factReviewStatus: 'curated_illustrative',
    provenanceSummary: 'Verifizierte Redaktionsquelle',
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

function makeScored(id: string, overrides: Partial<FeedItem> = {}, scoreOverride?: number): ScoredFeedItem {
  const scored = scoreFeedItem(makeItem(id, overrides), DEFAULT_USER_PROFILE, {});
  return scoreOverride !== undefined ? { ...scored, score: scoreOverride } : scored;
}

describe('Channels, YouTube, Memes & Saxony Regional V18', () => {
  it('1. Normalizer protects c/youtube from topic/politics hijacking and preserves YouTube thumbnails', () => {
    const ytSource: RawFeedSource = {
      id: 'yt-3blue1brown',
      name: '3Blue1Brown',
      url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCYO_jab_esuFRV4b17AJtAw',
      primaryTopic: 'youtube_gems',
      topics: ['youtube_gems', 'ai_apple', 'science_society'],
      defaultEvidenceTier: 'publisher_excerpt',
      defaultAuthor: 'Grant Sanderson',
      language: 'en'
    };

    const ytEntry: RawFeedEntry = {
      id: 'yt-entry-politics-ai',
      sourceId: 'yt-3blue1brown',
      title: 'Bundestag, Bundesregierung und Transformer-Netze: Wie KI-Regulierung und Mathematik zusammenhängen',
      link: 'https://www.youtube.com/watch?v=aircAruvnKk',
      publishedAt: new Date().toISOString(),
      summary:
        'Visualizing backpropagation, gradient descent, and why public debates in Berlin and Brussels need mathematical clarity on neural networks and linear algebra.',
      fullContent:
        'Visualizing backpropagation, gradient descent, and why public debates in Berlin and Brussels need mathematical clarity on neural networks and linear algebra across deep layers.',
      imageUrl: 'https://i.ytimg.com/vi/aircAruvnKk/hqdefault.jpg'
    };

    const normalized = normalizeFeedEntry(ytEntry, ytSource);
    assert.equal(normalized.format, 'youtube_gem');
    assert.equal(normalized.primaryTopic, 'youtube_gems');
    assert.equal(normalized.space, 'c/youtube');
    assert.equal(normalized.imageUrl, 'https://i.ytimg.com/vi/aircAruvnKk/hqdefault.jpg');
    assert.equal(normalized.hasAuthenticImage, true);
    assert.equal(satisfiesDefaultCuratedStandard(normalized), true);

    const avatarSource: RawFeedSource = {
      id: 'kurzgesagt-video',
      name: 'Kurzgesagt Logo Channel',
      url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCwRH985XgMYXQ6NxXDo8npw',
      primaryTopic: 'youtube_gems',
      topics: ['youtube_gems'],
      defaultEvidenceTier: 'publisher_excerpt',
      language: 'de'
    };
    const avatarNormalized = normalizeFeedEntry(
      {
        ...ytEntry,
        id: 'yt-avatar-1',
        imageUrl: 'https://yt3.ggpht.com/ytc/AIdro_channel_banner_test=s800-c-k-c0x00ffffff-no-rj'
      },
      avatarSource
    );
    assert.equal(avatarNormalized.space, 'c/youtube');
    assert.equal(avatarNormalized.primaryTopic, 'youtube_gems');
    assert.ok(avatarNormalized.imageUrl?.includes('yt3.ggpht.com'));
  });

  it('2. SubchannelFlourishService extracts real YouTube videos & image memes with zero generic blueprints, plus Saxony lane', async () => {
    assert.equal(extractYoutubeVideoId('https://www.youtube.com/watch?v=aircAruvnKk&t=12s'), 'aircAruvnKk');
    assert.equal(extractYoutubeVideoId('https://youtu.be/WUvTyaaNkzM?si=xyz'), 'WUvTyaaNkzM');
    assert.equal(extractYoutubeVideoId('https://vimeo.com/12345678'), null);

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

      if (url.includes('hn.algolia.com')) {
        if (url.includes('query=youtube.com/watch') && !url.includes('80')) {
          return new Response(
            JSON.stringify({
              hits: [
                {
                  objectID: 've1',
                  title: 'How Architecture Shapes Public Silence and Civic Attention',
                  url: 'https://www.youtube.com/watch?v=aircAruvnKk',
                  points: 410,
                  num_comments: 54,
                  created_at: new Date(Date.now() - 3600_000).toISOString()
                },
                {
                  objectID: 've_invalid',
                  title: 'Non-YouTube discussion post that must be ignored',
                  url: 'https://vimeo.com/99999999',
                  points: 90,
                  num_comments: 12,
                  created_at: new Date(Date.now() - 3600_000).toISOString()
                }
              ]
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response(JSON.stringify({ hits: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (url.includes('api.rss2json.com')) {
        if (url.includes('UCYO_jab_esuFRV4b17AJtAw')) {
          return new Response(
            JSON.stringify({
              status: 'ok',
              feed: { title: '3Blue1Brown', author: '3Blue1Brown' },
              items: [
                {
                  title: 'Visualizing Essence of Linear Algebra Through Geometric Intuition',
                  link: 'https://youtu.be/WUvTyaaNkzM',
                  pubDate: new Date(Date.now() - 7200_000).toISOString(),
                  author: '3Blue1Brown',
                  description:
                    'Visualizing linear transformations, basis vectors, and determinants through geometric intuition.'
                }
              ]
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        if (url.includes(encodeURIComponent('https://xkcd.com/rss.xml')) || url.includes('xkcd.com')) {
          return new Response(
            JSON.stringify({
              status: 'ok',
              feed: { title: 'xkcd.com', author: 'Randall Munroe' },
              items: [
                {
                  title: 'Epistemological Standards',
                  link: 'https://xkcd.com/3042/',
                  pubDate: new Date(Date.now() - 1800_000).toISOString(),
                  author: 'Randall Munroe',
                  description:
                    '<img src="https://imgs.xkcd.com/comics/epistemological_standards.png" title="Kant reading your daily schedule at 6am in Koenigsberg" alt="Epistemological Standards" />'
                }
              ]
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        if (url.includes('existentialcomics.com')) {
          return new Response(
            JSON.stringify({
              status: 'ok',
              feed: { title: 'Existential Comics', author: 'Corey Mohler' },
              items: [
                {
                  title: 'Hegel and Kant at the Coffee Shop',
                  link: 'https://existentialcomics.com/comic/580',
                  pubDate: new Date(Date.now() - 3600_000).toISOString(),
                  author: 'Corey Mohler',
                  thumbnail: 'https://existentialcomics.com/comics/580.png',
                  description: 'Dialectic tension over espresso extraction times.'
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

      if (url.includes('lemmy.world/api/v3/post/list')) {
        if (url.includes('community_name=sciencememes')) {
          return new Response(
            JSON.stringify({
              posts: [
                {
                  post: {
                    id: 9102,
                    name: 'Peer reviewer 2 reading the methodology section at midnight',
                    url: 'https://lemmy.world/pictrs/image/science_peer_review_meme.webp',
                    body: 'Every statistics class eventually converges on this chart.',
                    published: new Date(Date.now() - 2400_000).toISOString(),
                    removed: false,
                    deleted: false,
                    nsfw: false
                  },
                  counts: { score: 420, comments: 28 },
                  creator: { name: 'episteme_memer' }
                }
              ]
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response(
          JSON.stringify({
            posts: [
              {
                post: {
                  id: 4201,
                  name: 'The Forgotten Architecture of European Concert Halls',
                  url: 'https://youtu.be/lemmyDoc001',
                  body: 'Long-form documentary examining acoustic design and spatial geometry.',
                  published: new Date(Date.now() - 10800_000).toISOString(),
                  removed: false,
                  deleted: false,
                  nsfw: false
                },
                counts: { score: 85, comments: 14 },
                creator: { name: 'doc_curator' }
              }
            ]
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (url.includes('noembed.com/embed')) {
        if (url.includes('aircAruvnKk')) {
          return new Response(
            JSON.stringify({
              author_name: 'Grant Sanderson (3Blue1Brown)',
              title: 'How Architecture Shapes Public Silence and Civic Attention'
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response(JSON.stringify({ author_name: 'Acoustic Archive' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (url.includes('tagesschau.de/api2u/news/?regions=14')) {
        return new Response(
          JSON.stringify({
            news: [
              {
                externalId: 'sx-dd-1',
                title: 'Dresden stärkt Forschungsverbund für Mikroelektronik und Kultur',
                firstSentence: 'In Dresden investieren Land und Hochschulen weiter in nachhaltige Infrastruktur und Bildung.',
                date: new Date().toISOString(),
                ressort: 'regional',
                detailsweb: 'https://www.tagesschau.de/inland/regional/sachsen/dresden-100.html'
              }
            ]
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(JSON.stringify({ data: { children: [] }, results: [], query: { pages: {} } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }) as typeof fetch;

    try {
      const ytRes = await SubchannelFlourishService.flourishChannel('c/youtube', {
        force: true,
        pageCursor: 0,
        existingItems: []
      });
      assert.equal(
        ytRes.items.some(i => i.id.startsWith('flourish-anchor-')),
        false,
        'c/youtube must NEVER append generic effortpostBlueprints anchors'
      );
      const ytReal = ytRes.items.filter(i => i.id.startsWith('live-yt-discover-'));
      assert.equal(ytReal.length, 3, 'Expected exactly 3 real YouTube video items from HN, rss2json & Lemmy mocked feeds');
      for (const ytItem of ytReal) {
        assert.equal(ytItem.format, 'youtube_gem');
        assert.equal(ytItem.space, 'c/youtube');
        assert.equal(ytItem.primaryTopic, 'youtube_gems');
        assert.ok(ytItem.canonicalUrl?.startsWith('https://www.youtube.com/watch?v='));
        assert.ok(ytItem.imageUrl?.startsWith('https://i.ytimg.com/vi/') && ytItem.imageUrl?.endsWith('/hqdefault.jpg'));
        assert.equal(satisfiesDefaultCuratedStandard(ytItem), true);
      }
      const hnEnriched = ytReal.find(i => i.id === 'live-yt-discover-aircAruvnKk');
      assert.equal(hnEnriched?.youtubeMeta?.channelTitle, 'Grant Sanderson (3Blue1Brown)');
      assert.equal(ytRes.items.some(i => i.canonicalUrl?.includes('vimeo.com')), false);

      const memesRes = await SubchannelFlourishService.flourishChannel('c/memes', {
        force: true,
        pageCursor: 0,
        existingItems: []
      });
      assert.equal(
        fetchedUrls.some(u => u.includes('reddit.com')),
        false,
        'c/memes live refresh must make ZERO reddit.com requests'
      );
      assert.equal(memesRes.items.some(i => i.id.startsWith('flourish-anchor-')), false);
      const xkcdMeme = memesRes.items.find(i => i.imageUrl === 'https://imgs.xkcd.com/comics/epistemological_standards.png');
      const lemmyMeme = memesRes.items.find(i => i.id.startsWith('flourish-meme-lemmy-'));
      assert.ok(xkcdMeme, 'Expected authentic xkcd image comic via CORS-open api.rss2json.com');
      assert.ok(lemmyMeme, 'Expected authentic science meme via CORS-open lemmy.world');
      for (const comic of [xkcdMeme, lemmyMeme]) {
        assert.equal(comic.format, 'meme');
        assert.equal(comic.space, 'c/memes');
        assert.equal(comic.hasAuthenticImage, true);
      }

      const saxonyRes = await SubchannelFlourishService.flourishChannel(
        { handle: 'c/dresden_diskurs', title: 'Dresden & Sachsen Diskurs' },
        { force: true, existingItems: [] }
      );
      assert.ok(
        fetchedUrls.some(u => u.includes('tagesschau.de/api2u/news/?regions=14')),
        'Regional Saxony channel must trigger fetchSaxonyRegionalNews(12)'
      );
      assert.ok(
        saxonyRes.items.some(i => i.id === 'live-tagesschau-sx-dd-1'),
        'Regional Saxony channel must include Dresden/Saxony news'
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('3. HN live fetch defaults to science_society, rejects off-topic fee/CEO/Meta junk, caps <= 8 & <= 2 per topic, and removes boilerplate', async () => {
    assert.equal(
      isEditorialQualityHackerNewsStory('California bill would ban car subscriptions and post-purchase fees', 'latimes.com'),
      false
    );
    assert.equal(
      isEditorialQualityHackerNewsStory("Man storms Meta's offices after Instagram account suspension", 'theverge.com'),
      false
    );
    assert.equal(
      isEditorialQualityHackerNewsStory('OpenAI investors push for restoring Sam Altman as CEO', 'reuters.com'),
      false
    );

    const copyA = buildSubstantiveHackerNewsCopy({
      title: 'Why Formal Verification of Distributed Protocols Matters',
      domain: 'acm.org',
      targetUrl: 'https://acm.org/formal',
      hnUrl: 'https://news.ycombinator.com/item?id=101',
      points: 250,
      commentsCount: 70
    });
    const copyB = buildSubstantiveHackerNewsCopy({
      title: 'The Quiet Economics of Municipal Tram Networks in Europe',
      domain: 'urbanism.org',
      targetUrl: 'https://urbanism.org/trams',
      hnUrl: 'https://news.ycombinator.com/item?id=102',
      points: 185,
      commentsCount: 44
    });

    assert.ok(copyA.feedText.length >= 160);
    assert.ok(copyA.articleBody.length >= 260);
    assert.ok(!copyA.feedText.includes('Aktuelle Analyse bei'));
    assert.ok(!copyA.feedText.includes('Im Originalartikel werden Hintergründe, Einordnung und weiterführende Perspektiven'));
    assert.notEqual(copyA.feedText, copyB.feedText);

    const originalFetch = globalThis.fetch;
    const nowIso = new Date().toISOString();
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('hn.algolia.com')) {
        return new Response(
          JSON.stringify({
            hits: [
              { objectID: 'bad1', title: 'New car subscription law targets post-purchase fees', url: 'https://news.example/fees', points: 150, num_comments: 40, created_at: nowIso },
              { objectID: 'bad2', title: "Protester storms Meta's offices over moderation policy", url: 'https://news.example/meta', points: 140, num_comments: 30, created_at: nowIso },
              { objectID: 'bad3', title: 'Board discusses restoring founder as CEO after revolt', url: 'https://news.example/ceo', points: 130, num_comments: 25, created_at: nowIso },
              { objectID: 'soc1', title: 'Urban Canopy Planning Reduces Summer Heat Across Cities', url: 'https://cities.example/canopy', points: 210, num_comments: 60, created_at: nowIso },
              { objectID: 'soc2', title: 'Long-Term Preservation of Civic Archives in Public Libraries', url: 'https://archives.example/civic', points: 190, num_comments: 52, created_at: nowIso },
              { objectID: 'soc3', title: 'How Medieval Guilds Governed Apprenticeship Quality Standards', url: 'https://history.example/guilds', points: 180, num_comments: 48, created_at: nowIso },
              { objectID: 'ai1', title: 'Evaluating Local LLM Quantization Across Reasoning Benchmarks', url: 'https://ml.example/quant', points: 320, num_comments: 88, created_at: nowIso },
              { objectID: 'ai2', title: 'Attention Head Specialization in Small Transformer Models', url: 'https://ml.example/heads', points: 290, num_comments: 74, created_at: nowIso },
              { objectID: 'ai3', title: 'Scaling Inference Time Compute for Open-Weight AI Agents', url: 'https://ml.example/inference', points: 270, num_comments: 65, created_at: nowIso },
              { objectID: 'phil1', title: 'Epistemic Humility and Moral Philosophy in Kantian Ethics', url: 'https://phil.example/kant', points: 175, num_comments: 42, created_at: nowIso }
            ]
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify({}), { status: 404 });
    }) as typeof fetch;

    try {
      const hnItems = await ContinuousLiveNewsService.fetchHackerNewsLiveJson();
      assert.ok(hnItems.length <= 8, `Expected default HN limit <= 8, got ${hnItems.length}`);
      assert.equal(hnItems.some(i => i.id.includes('bad')), false, 'Rejected HN stories must be excluded');

      const soc1 = hnItems.find(i => i.id === 'openweb-hn-soc1');
      assert.ok(soc1, 'Expected general civic story soc1');
      assert.equal(soc1.primaryTopic, 'science_society', 'General HN fallback must be science_society, not ai_apple');
      assert.equal(soc1.space, 'c/serendipity');

      const topicCounts = new Map<TopicTag, number>();
      for (const item of hnItems) {
        topicCounts.set(item.primaryTopic, (topicCounts.get(item.primaryTopic) || 0) + 1);
      }
      for (const [topic, count] of topicCounts.entries()) {
        assert.ok(count <= 2, `Topic ${topic} exceeded max 2 per live HN refresh (got ${count})`);
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('4. Strict anti-clustering prevents >2 consecutive same-space and >1 back-to-back HN cards even when pinned, and keeps YouTube 45d + Memes cadence', () => {
    const nowMs = Date.now();
    const yt30d = makeScored('yt-30d', {
      format: 'youtube_gem',
      space: 'c/youtube',
      primaryTopic: 'youtube_gems',
      publishedAt: new Date(nowMs - 30 * 86400_000).toISOString(),
      score: undefined
    }, 0.52);
    const yt50d = makeScored('yt-50d', {
      format: 'youtube_gem',
      space: 'c/youtube',
      primaryTopic: 'youtube_gems',
      publishedAt: new Date(nowMs - 50 * 86400_000).toISOString(),
      score: undefined
    }, 0.52);
    assert.equal(isWithin14DayRelevanceWindow(yt30d, nowMs), true, 'YouTube item at 30d (<= 1080h) must stay eligible');
    assert.equal(isWithin14DayRelevanceWindow(yt50d, nowMs), false, 'YouTube item at 50d (> 1080h) must age out');

    const hnPinned1 = makeScored('openweb-hn-1', {
      space: 'c/acceleration',
      primaryTopic: 'ai_apple',
      sourceDomain: 'a.example.org',
      sourceBroadcasterName: 'a.example.org (HN)',
      pinnedManualRunAt: nowMs - 10_000
    }, 0.95);
    const hnPinned2 = makeScored('openweb-hn-2', {
      space: 'c/acceleration',
      primaryTopic: 'ai_apple',
      sourceDomain: 'b.example.org',
      sourceBroadcasterName: 'b.example.org (HN)',
      pinnedManualRunAt: nowMs - 20_000
    }, 0.94);
    const hnPinned3 = makeScored('openweb-hn-3', {
      space: 'c/acceleration',
      primaryTopic: 'ai_apple',
      sourceDomain: 'c.example.org',
      sourceBroadcasterName: 'c.example.org (HN)',
      pinnedManualRunAt: nowMs - 30_000
    }, 0.93);
    const hnPinned4 = makeScored('openweb-hn-4', {
      space: 'c/acceleration',
      primaryTopic: 'ai_apple',
      sourceDomain: 'd.example.org',
      sourceBroadcasterName: 'd.example.org (HN)',
      pinnedManualRunAt: nowMs - 40_000
    }, 0.92);

    const diverseRest: ScoredFeedItem[] = [
      makeScored('rest-phil-1', { space: 'c/dialektik', primaryTopic: 'philosophy_ethics', sourceDomain: 'phil1.de' }, 0.90),
      makeScored('rest-ser-1', { space: 'c/serendipity', primaryTopic: 'science_society', sourceDomain: 'ser1.de' }, 0.89),
      makeScored('rest-kont-1', { space: 'c/kontemplation', primaryTopic: 'contemplation_mind', sourceDomain: 'kont1.de' }, 0.88),
      makeScored('rest-did-1', { space: 'c/didaktik_labor', primaryTopic: 'german_didactics', sourceDomain: 'did1.de' }, 0.87),
      makeScored('rest-books-1', { space: 'c/books', primaryTopic: 'book_mastery', sourceDomain: 'books1.de' }, 0.86),
      makeScored('rest-meme-1', { space: 'c/memes', primaryTopic: 'memes_satire', format: 'meme', sourceDomain: 'xkcd.com', imageUrl: 'https://imgs.xkcd.com/comics/test.png' }, 0.65)
    ];

    const sortedWithManualPins = sortFeedForDisplay(
      [hnPinned1, hnPinned2, hnPinned3, hnPinned4, ...diverseRest],
      'for_you'
    );

    for (let i = 1; i < sortedWithManualPins.length; i++) {
      assert.equal(
        isAggregatorItem(sortedWithManualPins[i]) && isAggregatorItem(sortedWithManualPins[i - 1]),
        false,
        `Back-to-back HN/aggregator cards at index ${i - 1}..${i} must be prevented even when pinned`
      );
      if (i >= 2) {
        const s0 = getEffectiveSpaceHandle(sortedWithManualPins[i - 2]);
        const s1 = getEffectiveSpaceHandle(sortedWithManualPins[i - 1]);
        const s2 = getEffectiveSpaceHandle(sortedWithManualPins[i]);
        assert.equal(
          s0 === s1 && s1 === s2,
          false,
          `More than 2 consecutive items of space ${s2} at ${i - 2}..${i}`
        );
      }
    }

    // Verify c/memes is surfaced periodically in rankBloomScrollFeed rather than buried at the bottom
    const bigPool: ScoredFeedItem[] = [];
    const nonMemeSpaces: Array<{ space: string; topic: TopicTag }> = [
      { space: 'c/dialektik', topic: 'philosophy_ethics' },
      { space: 'c/serendipity', topic: 'science_society' },
      { space: 'c/acceleration', topic: 'ai_apple' },
      { space: 'c/books', topic: 'book_mastery' },
      { space: 'c/didaktik_labor', topic: 'german_didactics' }
    ];
    for (let i = 0; i < 25; i++) {
      const sp = nonMemeSpaces[i % nonMemeSpaces.length];
      bigPool.push(
        makeScored(
          `essay-${i}`,
          {
            space: sp.space,
            primaryTopic: sp.topic,
            sourceDomain: `pub-${i}.example.de`,
            publishedAt: new Date(nowMs - (i + 1) * 3600_000).toISOString()
          },
          0.90 - i * 0.004
        )
      );
    }
    bigPool.push(
      makeScored(
        'meme-top',
        {
          space: 'c/memes',
          primaryTopic: 'memes_satire',
          format: 'meme',
          sourceDomain: 'xkcd.com',
          imageUrl: 'https://imgs.xkcd.com/comics/standards.png'
        },
        0.62
      )
    );
    const bloomOrder = rankBloomScrollFeed(bigPool);
    const memeIdx = bloomOrder.findIndex(i => i.id === 'meme-top');
    assert.ok(memeIdx >= 0 && memeIdx <= 12, `Expected c/memes visible within top 12 in Für dich, got index ${memeIdx}`);
  });

  it('5. isSaxonyRegionalItem, Dresden/Leipzig +0.14 score boost, and 6 new live-verified Saxony RSS sources', () => {
    const sourceIds = new Set(VERIFIED_FEED_SOURCES.map(s => s.id));
    for (const expectedId of [
      'mdr-sachsen-rss',
      'fc-mdr-sachsen-investigativ',
      'neustadt-gefluester-dresden',
      'leipziger-zeitung-liz',
      'kreuzer-leipzig-magazin',
      'lvz-leipzig-sachsen',
      'mdr-kultur-sachsen',
      'mdr-wissen-mitteldeutschland'
    ]) {
      assert.ok(sourceIds.has(expectedId), `Expected Saxony source ${expectedId} in VERIFIED_FEED_SOURCES`);
    }
    assert.equal(sourceIds.has('dresden-stadt'), false);
    assert.equal(sourceIds.has('mdr-sachsen-dresden'), false);

    const neustadtItem = makeItem('dd-neustadt', {
      title: 'Neuer Kulturraum in der Dresdner Neustadt eröffnet',
      sourceDomain: 'neustadt-ticker.de',
      sourceBroadcasterName: 'Neustadt-Geflüster Dresden'
    });
    const lizItem = makeItem('lpz-liz', {
      title: 'Verkehrswende und Radwege im Fokus',
      sourceDomain: 'l-iz.de',
      sourceBroadcasterName: 'Leipziger Zeitung (L-IZ)'
    });
    const kreuzerItem = makeItem('lpz-kreuzer', {
      title: 'Programmkino-Reihe im Herbst',
      sourceDomain: 'kreuzer-leipzig.de',
      sourceBroadcasterName: 'Kreuzer Leipzig'
    });
    const lvzItem = makeItem('lpz-lvz', {
      title: 'Neuer Forschungsbau am Campus eingeweiht',
      sourceDomain: 'lvz.de',
      sourceBroadcasterName: 'Leipziger Volkszeitung (LVZ)'
    });
    const nonSaxonyItem = makeItem('hh-1', {
      title: 'Hafenausbau an der Elbmündung bei Hamburg',
      sourceDomain: 'zeit.de',
      sourceBroadcasterName: 'ZEIT ONLINE'
    });

    assert.equal(isSaxonyRegionalItem(neustadtItem), true);
    assert.equal(isSaxonyRegionalItem(lizItem), true);
    assert.equal(isSaxonyRegionalItem(kreuzerItem), true);
    assert.equal(isSaxonyRegionalItem(lvzItem), true);
    assert.equal(isSaxonyRegionalItem(nonSaxonyItem), false);

    const dresdenScore = scoreFeedItem(neustadtItem, {
      ...DEFAULT_USER_PROFILE,
      editionPreferences: { ...DEFAULT_USER_PROFILE.editionPreferences, weatherCity: 'dresden' }
    }).score;
    const leipzigScore = scoreFeedItem(neustadtItem, {
      ...DEFAULT_USER_PROFILE,
      editionPreferences: { ...DEFAULT_USER_PROFILE.editionPreferences, weatherCity: 'leipzig' }
    }).score;
    const defaultCityScore = scoreFeedItem(neustadtItem, {
      ...DEFAULT_USER_PROFILE,
      editionPreferences: { ...DEFAULT_USER_PROFILE.editionPreferences, weatherCity: '' }
    }).score;
    const berlinScore = scoreFeedItem(neustadtItem, {
      ...DEFAULT_USER_PROFILE,
      editionPreferences: { ...DEFAULT_USER_PROFILE.editionPreferences, weatherCity: 'berlin' }
    }).score;

    assert.ok(
      Math.abs((dresdenScore - berlinScore) - 0.14) < 0.005,
      `Expected +0.14 Dresden boost (got ${dresdenScore - berlinScore})`
    );
    assert.ok(Math.abs((leipzigScore - berlinScore) - 0.14) < 0.005);
    assert.ok(Math.abs((defaultCityScore - berlinScore) - 0.14) < 0.005);
  });

  it('6. selectBalancedStartupItems populates all 12 editorial spaces + c/kunst_galerie and guarantees >=6 Saxony items', () => {
    const nowMs = Date.now();
    const spaceTopicMap: Array<{ space: string; topic: TopicTag; format?: FeedItem['format'] }> = [
      { space: 'c/didaktik_labor', topic: 'german_didactics' },
      { space: 'c/books', topic: 'book_mastery' },
      { space: 'c/kontemplation', topic: 'contemplation_mind' },
      { space: 'c/synth_alchemie', topic: 'sound_synthesis' },
      { space: 'c/acceleration', topic: 'ai_apple' },
      { space: 'c/dialektik', topic: 'philosophy_ethics' },
      { space: 'c/serendipity', topic: 'science_society' },
      { space: 'c/health_longevity', topic: 'health_biohacking' },
      { space: 'c/chancen', topic: 'opportunities_growth' },
      { space: 'c/youtube', topic: 'youtube_gems', format: 'youtube_gem' },
      { space: 'c/memes', topic: 'memes_satire', format: 'meme' },
      { space: 'c/gesellschaft_politik', topic: 'science_society' },
      { space: 'c/kunst_galerie', topic: 'art_aesthetics', format: 'art_showcase' }
    ];

    const pool: FeedItem[] = [];
    for (const entry of spaceTopicMap) {
      for (let k = 0; k < 10; k++) {
        const isSaxony = entry.space === 'c/serendipity' && k < 7;
        pool.push(
          makeItem(`${entry.space.replace('c/', '')}-${k}`, {
            space: entry.space,
            primaryTopic: entry.topic,
            format: entry.format || 'sourced_update',
            title: isSaxony
              ? `Dresden und Leipzig Impuls ${k}: Sächsische Kultur- und Wissenschaftsinitiative`
              : `Beitrag ${k} für ${entry.space}: Tiefgehende Perspektive`,
            sourceDomain: `${entry.space.replace('c/', '')}-${k}.example.org`,
            imageUrl:
              entry.format === 'art_showcase' || entry.format === 'meme' || entry.format === 'youtube_gem'
                ? `https://cdn.example.org/${entry.space.replace('c/', '')}-${k}.jpg`
                : undefined,
            hasAuthenticImage: entry.format === 'art_showcase' || entry.format === 'meme' || entry.format === 'youtube_gem',
            publishedAt: new Date(
              nowMs - (entry.space === 'c/youtube' ? 25 * 86400_000 : (k + 1) * 3600_000)
            ).toISOString()
          })
        );
      }
    }

    const startup = selectBalancedStartupItems(pool, nowMs, STARTUP_SNAPSHOT_CAP);
    assert.ok(startup.length <= STARTUP_SNAPSHOT_CAP);

    const countsBySpace = new Map<string, number>();
    for (const item of startup) {
      const sp = item.space || '';
      countsBySpace.set(sp, (countsBySpace.get(sp) || 0) + 1);
    }

    for (const sp of PRIORITY_SPACES) {
      assert.ok((countsBySpace.get(sp) || 0) >= 1, `Expected space ${sp} to be populated in startup snapshot`);
    }
    assert.ok((countsBySpace.get('c/youtube') || 0) >= 8, `Expected >=8 c/youtube items, got ${countsBySpace.get('c/youtube')}`);
    assert.ok((countsBySpace.get('c/memes') || 0) >= 8, `Expected >=8 c/memes items, got ${countsBySpace.get('c/memes')}`);
    assert.ok(
      (countsBySpace.get('c/gesellschaft_politik') || 0) >= 6,
      `Expected >=6 c/gesellschaft_politik items, got ${countsBySpace.get('c/gesellschaft_politik')}`
    );
    assert.ok((countsBySpace.get('c/kunst_galerie') || 0) >= 1, 'Expected c/kunst_galerie populated');

    const saxonyCount = startup.filter(isSaxonyRegionalItem).length;
    assert.ok(saxonyCount >= 6, `Expected >=6 Saxony regional items in startup snapshot, got ${saxonyCount}`);

    // Verify reservoir protection retains youtube, memes, and saxony even when overflowing 650 items
    const overflowPool: FeedItem[] = [
      ...Array.from({ length: 700 }, (_, i) =>
        makeItem(`filler-${i}`, {
          space: 'c/serendipity',
          primaryTopic: 'science_society',
          sourceDomain: `filler-${i % 20}.example.org`
        })
      ),
      makeItem('protected-yt-1', { space: 'c/youtube', primaryTopic: 'youtube_gems', format: 'youtube_gem', sourceDomain: 'youtube.com' }),
      makeItem('protected-meme-1', { space: 'c/memes', primaryTopic: 'memes_satire', format: 'meme', sourceDomain: 'xkcd.com' }),
      makeItem('protected-saxony-1', { space: 'c/dialektik', title: 'Dresden Kulturdebatte', sourceDomain: 'neustadt-ticker.de' })
    ];
    const reservoir = selectCappedReservoirItems(overflowPool, 650);
    const resIds = new Set(reservoir.map(i => i.id));
    assert.ok(resIds.has('protected-yt-1'), 'Reservoir must protect c/youtube items');
    assert.ok(resIds.has('protected-meme-1'), 'Reservoir must protect c/memes items');
    assert.ok(resIds.has('protected-saxony-1'), 'Reservoir must protect Saxony regional items');
  });

  it('7. parseFeedXml extracts YouTube <media:description>, strips sponsors, and verified youtube_gem passes curation standard', () => {
    const sampleYtAtom = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>yt:video:zqzk43bSdDI</id>
    <title>What if AI solved the Riemann Hypothesis?</title>
    <link rel="alternate" href="https://www.youtube.com/watch?v=zqzk43bSdDI"/>
    <author><name>3Blue1Brown</name></author>
    <published>2026-11-22T02:02:12+00:00</published>
    <media:group>
      <media:thumbnail url="https://i3.ytimg.com/vi/zqzk43bSdDI/hqdefault.jpg" width="480" height="360"/>
      <media:description>A formal proof milestone examining how formalized verification and mathematician collaborations evaluate claims on the generalized Riemann hypothesis.

0:00 - Kevin Buzzard
0:45 - Ken Ono
3:14 - Terence Tao

Sponsored by ExampleSponsor — use code MATH20 for discount!
https://example.com/sponsor</media:description>
    </media:group>
  </entry>
</feed>`;

    const parsed = parseFeedXml(sampleYtAtom, 'yt-3blue1brown');
    assert.equal(parsed.length, 1);
    assert.ok(parsed[0].summary.includes('formal proof milestone'), 'Expected <media:description> summary extracted');
    assert.equal(/sponsored by|MATH20/i.test(parsed[0].summary), false, 'Sponsor boilerplate must be stripped');
    assert.equal(parsed[0].imageUrl, 'https://i3.ytimg.com/vi/zqzk43bSdDI/hqdefault.jpg');

    const ytSource = VERIFIED_FEED_SOURCES.find(s => s.id === 'yt-3blue1brown')!;
    const normalized = normalizeFeedEntry(parsed[0], ytSource);
    assert.equal(normalized.space, 'c/youtube');
    assert.equal(normalized.format, 'youtube_gem');
    assert.equal(satisfiesDefaultCuratedStandard(normalized), true);
  });
});
