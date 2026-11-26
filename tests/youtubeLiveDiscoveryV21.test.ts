import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  SubchannelFlourishService,
  extractYoutubeVideoId,
  cleanYoutubeDescription
} from '../src/core/ingestion/subchannelFlourishService';
import {
  getActiveInlineVideoKey,
  setActiveInlineVideoKey,
  subscribeActiveInlineVideo,
  extractInlineYoutubeVideoId,
  buildYouTubeNoCookieEmbedUrl
} from '../src/core/utils/inlineVideoBus';
import {
  isWithin14DayRelevanceWindow,
  scoreFeedItem,
  sortFeedForDisplay,
  getEffectiveSpaceHandle,
  ScoredFeedItem
} from '../src/core/domain/ranking';
import { LocalFeedRepository, feedRepository } from '../src/core/data/feedRepository';
import { AtemStorage, MemoryStorageDriver } from '../src/core/data/storage';
import { DEFAULT_USER_PROFILE } from '../src/core/data/fixtures';
import { REAL_KNOWLEDGE_VAULT } from '../src/core/data/realKnowledgeVault';
import { defaultFeedOperationManager } from '../src/core/feed/FeedOperationManager';
import { defaultSnapshotLoader } from '../src/core/feed/SnapshotLoader';
import {
  satisfiesDefaultCuratedStandard,
  getCardRenderableText,
  stripSyntheticFillerSentences
} from '../src/core/enrichment/batchEnricher';
import { FeedItem, FeedItemSchema } from '../src/core/domain/types';

function makeFeedItem(id: string, overrides: Partial<FeedItem> = {}): FeedItem {
  const nowIso = new Date().toISOString();
  return FeedItemSchema.parse({
    id,
    type: 'deep_dive',
    format: 'sourced_update',
    title: `Analytischer Fachbeitrag ${id}: Perspektiven aus Erkenntnistheorie und Wissenschaft`,
    subtitle: 'Wissenschaft & Gesellschaft',
    feedText:
      'Eine differenzierte Untersuchung aktueller Forschungsergebnisse, historischer Hintergründe und konzeptioneller Gegenargumente für konzentriertes Lesen ohne Ablenkung.',
    body:
      'Eine differenzierte Untersuchung aktueller Forschungsergebnisse, historischer Hintergründe und konzeptioneller Gegenargumente für konzentriertes Lesen ohne Ablenkung über mehrere Absätze.',
    articleBody:
      'Eine differenzierte Untersuchung aktueller Forschungsergebnisse, historischer Hintergründe und konzeptioneller Gegenargumente für konzentriertes Lesen ohne Ablenkung über mehrere Absätze hinweg.',
    keyInsight:
      'Strukturierte Gegenüberstellung empirischer Befunde, historischer Linien und methodischer Einwände.',
    primaryTopic: 'science_society',
    topics: ['science_society'],
    space: 'c/dialektik',
    publishedAt: nowIso,
    publicationDateReliable: true,
    firstSeenAt: nowIso,
    generatedAt: nowIso,
    estimatedReadingMinutes: 4,
    relevanceExplanation: 'Thematische Passung und belastbare Quellenlage.',
    contentStatus: 'editorial_briefing',
    isDailyEdition: false,
    editionDate: nowIso.slice(0, 10),
    isDemonstration: false,
    aiAssisted: false,
    factReviewStatus: 'curated_illustrative',
    provenanceSummary: 'Verifizierte Redaktionsquelle',
    wordCount: 190,
    evidenceTier: 'publisher_excerpt',
    contentOrigin: 'live_ingested',
    contentHash: `hash-${id}`,
    canonicalUrl: `https://example-editorial.de/${id}`,
    sourceDomain: 'example-editorial.de',
    sourceBroadcasterName: `Publisher ${id}`,
    sourceReferences: [
      {
        publisher: `Publisher ${id}`,
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

function makeYoutubeGem(id: string, videoId: string, creator: string, overrides: Partial<FeedItem> = {}): FeedItem {
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  return makeFeedItem(id, {
    format: 'youtube_gem',
    title: `Video-Essay ${id}: Komplexe Systeme anschaulich verstehen`,
    subtitle: `YouTube Video-Essay • ${creator}`,
    feedText:
      `Das Video-Essay von ${creator} entfaltet präzise visuelle Erklärungsmodelle zu komplexen Dynamiken in Wissenschaft und Gesellschaft und eignet sich ideal für ruhiges Verstehen.`,
    body:
      `Das Video-Essay von ${creator} entfaltet präzise visuelle Erklärungsmodelle zu komplexen Dynamiken in Wissenschaft und Gesellschaft und eignet sich ideal für ruhiges Verstehen.`,
    articleBody:
      `### Video-Essay ${id}\n\nDas Video-Essay von ${creator} entfaltet präzise visuelle Erklärungsmodelle zu komplexen Dynamiken in Wissenschaft und Gesellschaft.`,
    keyInsight: `${creator} verbindet anschauliche Erklärungen mit begrifflicher Schärfe für konzentriertes Sehen.`,
    primaryTopic: 'youtube_gems',
    topics: ['youtube_gems', 'science_society'],
    space: 'c/youtube',
    canonicalUrl: watchUrl,
    sourceDomain: 'youtube.com',
    sourceBroadcasterName: creator,
    imageUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    hasAuthenticImage: true,
    sourceTrustLevel: 'verified_creator',
    youtubeMeta: {
      videoId,
      channelTitle: creator,
      duration: '18:10',
      keyTakeaways: [`Direktlink: ${watchUrl}`]
    },
    sourceReferences: [
      {
        publisher: creator,
        originalUrl: watchUrl,
        title: `Video-Essay ${id}`,
        publicationTimestamp: overrides.publishedAt ?? new Date().toISOString(),
        retrievalTimestamp: new Date().toISOString(),
        author: creator,
        isVerified: true
      }
    ],
    ...overrides
  });
}

function makeScored(id: string, overrides: Partial<FeedItem> = {}, scoreOverride?: number): ScoredFeedItem {
  const scored = scoreFeedItem(makeFeedItem(id, overrides), DEFAULT_USER_PROFILE, {});
  return scoreOverride !== undefined ? { ...scored, score: scoreOverride } : scored;
}

describe('Atmen v21: CORS-Safe Live YouTube Discovery & Channel-Aware Research', () => {
  it('Case 1: fetchYoutubeVideoEssayLane parses HN Algolia, rss2json & Lemmy, enriches via noembed with fallback, dedupes & advances cursor pagination across 2 clicks', async () => {
    assert.equal(extractYoutubeVideoId('https://www.youtube.com/watch?v=aircAruvnKk&t=12s'), 'aircAruvnKk');
    assert.equal(extractYoutubeVideoId('https://youtu.be/WUvTyaaNkzM?si=abc'), 'WUvTyaaNkzM');
    assert.equal(extractYoutubeVideoId('https://vimeo.com/123456'), null);

    const requestedUrls: string[] = [];
    const existingVid = 'exstVid0001';
    const intraBatchDupVid = 'dupHnRss001';
    const noembedFailVid = 'noemFail001';
    const hnWatchVid = 'hnWatch0001';
    const hnShortVid = 'hnShort0002';
    const rssVid0A = 'rssVid0000A';
    const rssVid0B = 'rssVid0000B';
    const lemmyVid0 = 'lemmyVid001';

    const page1HnWatchVid = 'p1HnWatch01';
    const page1HnShortVid = 'p1HnShort02';
    const page1RssVid = 'p1RssVid001';
    const page1LemmyVid = 'p1Lemmy0001';

    mock.method(defaultSnapshotLoader, 'loadSnapshot', async () => ({
      success: true,
      itemCount: 0,
      items: []
    }));
    mock.method(defaultSnapshotLoader, 'loadReservoir', async () => ({
      success: true,
      itemCount: 0,
      items: []
    }));
    mock.method(feedRepository, 'addItems', () => {});

    mock.method(globalThis, 'fetch', async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      requestedUrls.push(url);

      // Lane A: HN Algolia
      if (url.includes('hn.algolia.com/api/v1/')) {
        const pageMatch = url.match(/[?&]page=(\d+)/);
        const pageNum = pageMatch ? Number(pageMatch[1]) : 0;
        const isFirstCallBatch = pageNum % 2 === 0;

        if (url.includes('query=youtu.be')) {
          const vid = isFirstCallBatch ? hnShortVid : page1HnShortVid;
          return new Response(
            JSON.stringify({
              hits: [
                {
                  objectID: `hn-short-${pageNum}`,
                  title: `How Transformer Attention Circuits Emerge in Language Models (page ${pageNum})`,
                  url: `https://youtu.be/${vid}?si=shared`,
                  points: 92,
                  num_comments: 31,
                  created_at: '2026-10-10T10:00:00.000Z'
                },
                {
                  // Duplicate against preExistingUrls via watch?v= form
                  objectID: `hn-dup-existing-${pageNum}`,
                  title: 'Existing Video Already In Repository Must Be Deduplicated',
                  url: `https://youtu.be/${existingVid}`,
                  points: 55,
                  num_comments: 11,
                  created_at: '2026-10-11T10:00:00.000Z'
                }
              ]
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }

        if (url.includes('points%3E80') || url.includes('points>80')) {
          return new Response(
            JSON.stringify({
              hits: isFirstCallBatch
                ? [
                    {
                      objectID: `hn-noembed-fail-${pageNum}`,
                      title: 'Why Ancient Aqueducts Still Shape Modern Hydraulic Engineering',
                      url: `https://www.youtube.com/watch?v=${noembedFailVid}`,
                      points: 110,
                      num_comments: 24,
                      created_at: '2026-10-08T12:00:00.000Z'
                    }
                  ]
                : []
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }

        const watchVid = isFirstCallBatch ? hnWatchVid : page1HnWatchVid;
        return new Response(
          JSON.stringify({
            hits: [
              {
                objectID: `hn-watch-${pageNum}`,
                title: `Inside Geometric Linear Algebra and Eigenvalue Intuition (page ${pageNum})`,
                url: `https://www.youtube.com/watch?v=${watchVid}&t=42s`,
                points: 44,
                num_comments: 14,
                created_at: '2026-10-12T08:00:00.000Z'
              },
              {
                // Intra-batch duplicate with RSS feed item (same videoId)
                objectID: `hn-intra-dup-${pageNum}`,
                title: 'Intra-batch duplicate of curated RSS video must not appear twice',
                url: `https://www.youtube.com/watch?v=${intraBatchDupVid}`,
                points: 70,
                num_comments: 19,
                created_at: '2026-10-12T09:00:00.000Z'
              }
            ]
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Lane B: api.rss2json.com curated YouTube channels
      if (url.includes('api.rss2json.com/v1/api.json')) {
        if (url.includes('UCYO_jab_esuFRV4b17AJtAw')) {
          return new Response(
            JSON.stringify({
              status: 'ok',
              feed: { title: '3Blue1Brown', author: '3Blue1Brown' },
              items: [
                {
                  title: 'Visualizing Fourier Series Through Epicycles and Complex Numbers',
                  link: `https://www.youtube.com/watch?v=${rssVid0A}`,
                  pubDate: '2026-11-20 14:00:00',
                  author: '3Blue1Brown',
                  description:
                    '<p>An intuitive visual tour through Fourier transforms, complex exponentials, and harmonic rotation.</p>'
                },
                {
                  title: 'Shared RSS and HN Candidate That Must Deduplicate Cleanly',
                  guid: `yt:video:${intraBatchDupVid}`,
                  link: `https://www.youtube.com/watch?v=${intraBatchDupVid}`,
                  pubDate: '2026-11-19 10:00:00',
                  author: '3Blue1Brown',
                  description: 'Detailed mathematical walkthrough of vector spaces and orthogonal projections.'
                }
              ]
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }

        if (url.includes('UCLLibJTCy3sXjHLVaDimnpQ')) {
          return new Response(
            JSON.stringify({
              status: 'ok',
              feed: { title: 'ARTEde', author: 'ARTEde' },
              items: [
                {
                  title: 'Philosophie der Aufmerksamkeit im Zeitalter digitaler Zerstreuung',
                  link: `https://www.youtube.com/watch?v=${rssVid0B}`,
                  pubDate: '2026-11-21 18:30:00',
                  author: 'ARTEde',
                  description:
                    'Eine essayistische Dokumentation über geistige Präsenz, Erkenntnisarbeit und digitale Kultur.'
                }
              ]
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }

        const uniqueHash = Buffer.from(url).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(-7);
        const generatedVid = url.includes('UCwRH985XgMYXQ6NxXDo8npw')
          ? 'rssKurz0001'
          : `${page1RssVid.slice(0, 4)}${uniqueHash}`.slice(0, 11);
        return new Response(
          JSON.stringify({
            status: 'ok',
            feed: { title: 'Kuratiert Wissen', author: 'Kuratiert Wissen' },
            items: [
              {
                title: `Tiefenanalyse aus der Wissenschaftsreihe (${generatedVid})`,
                link: `https://www.youtube.com/watch?v=${generatedVid}`,
                pubDate: '2026-11-22 12:00:00',
                description:
                  'Fundierte Aufbereitung aktueller physikalischer und philosophischer Konzepte für vertieftes Verstehen.'
              }
            ]
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Lane C: lemmy.world documentaries
      if (url.includes('lemmy.world/api/v3/post/list')) {
        const pageMatch = url.match(/[?&]page=(\d+)/);
        const lemmyPage = pageMatch ? Number(pageMatch[1]) : 1;
        const vid = lemmyPage === 1 ? lemmyVid0 : page1LemmyVid;
        return new Response(
          JSON.stringify({
            posts: [
              {
                post: {
                  id: 9000 + lemmyPage,
                  name: `The Forgotten History of Acoustic Architecture (lemmy p${lemmyPage})`,
                  url: `https://www.youtube.com/watch?v=${vid}`,
                  body: 'Long-form documentary exploring concert hall acoustics and architectural resonance.',
                  published: '2026-11-18T16:00:00.000Z',
                  removed: false,
                  deleted: false,
                  nsfw: false
                },
                counts: { score: 65, comments: 12 },
                creator: { name: 'doc_curator' }
              },
              {
                post: {
                  id: 9999,
                  name: 'Removed Post Should Be Skipped Even With Valid Video',
                  url: 'https://www.youtube.com/watch?v=removed0001',
                  removed: true
                },
                counts: { score: 200, comments: 50 }
              }
            ]
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Noembed enrichment
      if (url.includes('noembed.com/embed')) {
        if (url.includes(noembedFailVid)) {
          return new Response('Internal Server Error', { status: 500 });
        }
        if (url.includes(hnWatchVid) || url.includes(page1HnWatchVid)) {
          return new Response(
            JSON.stringify({
              author_name: 'Veritasium',
              title: 'Inside Geometric Linear Algebra and Eigenvalue Intuition'
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        if (url.includes(hnShortVid) || url.includes(page1HnShortVid)) {
          return new Response(
            JSON.stringify({
              author_name: 'Welch Labs',
              title: 'How Transformer Attention Circuits Emerge in Language Models'
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        if (url.includes(lemmyVid0) || url.includes(page1LemmyVid)) {
          return new Response(
            JSON.stringify({
              author_name: 'PolyMatter',
              title: 'The Forgotten History of Acoustic Architecture'
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response(JSON.stringify({ error: 'Not found' }), { status: 200 });
      }

      return new Response(JSON.stringify({}), { status: 404 });
    });

    try {
      const profile = SubchannelFlourishService.buildQueryProfile('c/youtube');
      const today = new Date().toISOString().slice(0, 10);

      // Direct unit test of fetchYoutubeVideoEssayLane on pageCursor: 0
      const laneItems = await SubchannelFlourishService.fetchYoutubeVideoEssayLane(profile, today, {
        pageCursor: 0,
        force: true,
        existingIds: new Set([`live-yt-discover-preIdOnly`]),
        existingUrls: new Set([`https://www.youtube.com/watch?v=${existingVid}`])
      });

      const laneVideoIds = laneItems.map(i => i.youtubeMeta?.videoId);
      assert.equal(laneVideoIds.includes(existingVid), false, 'Pre-existing YouTube URL must be deduplicated');
      assert.equal(laneVideoIds.includes('removed0001'), false, 'Removed Lemmy post must be filtered out');
      assert.equal(
        laneVideoIds.filter(v => v === intraBatchDupVid).length,
        1,
        'Intra-batch duplicate between RSS and HN must appear only once'
      );

      // Verify all 3 lanes contributed
      assert.ok(laneVideoIds.includes(rssVid0A), 'Expected rss2json 3Blue1Brown item');
      assert.ok(laneVideoIds.includes(rssVid0B), 'Expected rss2json ARTEde item');
      assert.ok(laneVideoIds.includes(hnWatchVid), 'Expected HN youtube.com/watch item');
      assert.ok(laneVideoIds.includes(hnShortVid), 'Expected HN youtu.be item');
      assert.ok(laneVideoIds.includes(lemmyVid0), 'Expected Lemmy documentaries item');
      assert.ok(laneVideoIds.includes(noembedFailVid), 'Expected HN item even when noembed fails');

      // Verify noembed resolved real creator names & graceful fallback on failure
      const hnWatchItem = laneItems.find(i => i.youtubeMeta?.videoId === hnWatchVid)!;
      assert.equal(hnWatchItem.youtubeMeta?.channelTitle, 'Veritasium');
      assert.equal(hnWatchItem.sourceBroadcasterName, 'Veritasium');
      assert.equal(hnWatchItem.sourceReferences[0]?.publisher, 'Veritasium');

      const hnShortItem = laneItems.find(i => i.youtubeMeta?.videoId === hnShortVid)!;
      assert.equal(hnShortItem.youtubeMeta?.channelTitle, 'Welch Labs');

      const lemmyItem = laneItems.find(i => i.youtubeMeta?.videoId === lemmyVid0)!;
      assert.equal(lemmyItem.youtubeMeta?.channelTitle, 'PolyMatter');

      const fallbackItem = laneItems.find(i => i.youtubeMeta?.videoId === noembedFailVid)!;
      assert.equal(fallbackItem.youtubeMeta?.channelTitle, 'YouTube', 'Fallback creator when noembed returns 500');
      assert.equal(fallbackItem.isEvergreenGem, true, 'HN points >= 80 should mark isEvergreenGem=true');

      for (const item of laneItems) {
        assert.equal(item.space, 'c/youtube');
        assert.equal(item.format, 'youtube_gem');
        assert.equal(item.primaryTopic, 'youtube_gems');
        assert.ok(item.imageUrl?.endsWith('/hqdefault.jpg'));
        assert.equal(satisfiesDefaultCuratedStandard(item), true);
        assert.equal(
          item.feedText.includes('verbindet anschauliche Erklärung mit konzeptioneller Tiefe'),
          false,
          'YouTube card must never contain generic German boilerplate in feedText'
        );
        assert.equal(item.keyInsight, undefined, 'YouTube card must not emit fabricated boilerplate keyInsight');
      }

      // HN items without authentic description stay clean (no filler text), RSS items keep real description
      assert.equal(hnWatchItem.feedText, '');
      assert.equal(getCardRenderableText(hnWatchItem), '');
      const rssItemA = laneItems.find(i => i.youtubeMeta?.videoId === rssVid0A)!;
      assert.ok(
        rssItemA.feedText.includes('Fourier transforms'),
        `RSS YouTube item should keep authentic video description, got "${rssItemA.feedText}"`
      );

      // Now test 2-click cursor pagination via flourishChannel('c/youtube', { force: true, existingItems })
      // Reset cursor to 0 for deterministic 2-click pagination check
      (SubchannelFlourishService as any).youtubeSearchPageCursor = 0;
      requestedUrls.length = 0;

      const click1 = await SubchannelFlourishService.flourishChannel('c/youtube', {
        force: true,
        existingItems: []
      });
      const click1HnPages = requestedUrls
        .filter(u => u.includes('hn.algolia.com'))
        .map(u => Number(u.match(/[?&]page=(\d+)/)?.[1] ?? -1));
      const click1LemmyPage = Number(
        requestedUrls.find(u => u.includes('lemmy.world'))?.match(/[?&]page=(\d+)/)?.[1] ?? -1
      );

      requestedUrls.length = 0;
      const click2 = await SubchannelFlourishService.flourishChannel('c/youtube', {
        force: true,
        existingItems: click1.addedItems
      });
      const click2HnPages = requestedUrls
        .filter(u => u.includes('hn.algolia.com'))
        .map(u => Number(u.match(/[?&]page=(\d+)/)?.[1] ?? -1));
      const click2LemmyPage = Number(
        requestedUrls.find(u => u.includes('lemmy.world'))?.match(/[?&]page=(\d+)/)?.[1] ?? -1
      );

      assert.ok(click1.addedItems.length >= 6, `Click 1 should add >= 6 live videos, got ${click1.addedItems.length}`);
      assert.ok(click2.addedItems.length >= 4, `Click 2 should add >= 4 new live videos, got ${click2.addedItems.length}`);

      assert.ok(click1HnPages.every(p => p === 0), `Click 1 HN cursor should be 0, got ${click1HnPages}`);
      assert.ok(click2HnPages.every(p => p === 1), `Click 2 HN cursor should advance to 1, got ${click2HnPages}`);
      assert.equal(click1LemmyPage, 1);
      assert.equal(click2LemmyPage, 2);

      const combinedIds = [...click1.addedItems, ...click2.addedItems].map(i => i.id);
      const combinedVideoIds = [...click1.addedItems, ...click2.addedItems]
        .map(i => i.youtubeMeta?.videoId)
        .filter((v): v is string => Boolean(v));

      assert.equal(
        new Set(combinedIds).size,
        combinedIds.length,
        'Click 1 + Click 2 addedItems must contain 0 duplicate item IDs'
      );
      assert.equal(
        new Set(combinedVideoIds).size,
        combinedVideoIds.length,
        'Click 1 + Click 2 addedItems must contain 0 duplicate YouTube video IDs'
      );
    } finally {
      mock.restoreAll();
    }
  });

  it('Case 2: isWithin14DayRelevanceWindow & sortFeedForDisplay retain >45d evergreen/pinned youtube_gem items and place pinned newly researched videos at top across for_you and top', () => {
    const nowMs = Date.now();
    const sixtyDaysAgoIso = new Date(nowMs - 60 * 24 * 3600 * 1000).toISOString();
    const twoHoursAgoIso = new Date(nowMs - 2 * 3600 * 1000).toISOString();

    const oldUnpinnedNonEvergreenYt = makeYoutubeGem('yt-old-drop', 'oldDrop0001', 'Old Channel', {
      publishedAt: sixtyDaysAgoIso,
      isEvergreenGem: false,
      pinnedManualRunAt: undefined
    });
    const oldEvergreenYt = makeYoutubeGem('yt-old-evergreen', 'oldEver0001', '3Blue1Brown', {
      publishedAt: sixtyDaysAgoIso,
      isEvergreenGem: true,
      curationScore: 8.6
    });
    const oldPinnedYt = makeYoutubeGem('yt-old-pinned', 'oldPinn0001', 'Veritasium', {
      publishedAt: sixtyDaysAgoIso,
      isEvergreenGem: false,
      pinnedManualRunAt: nowMs - 60_000,
      curationScore: 8.4
    });
    const freshPinnedYt = makeYoutubeGem('yt-fresh-pinned', 'freshPin001', 'Kurzgesagt', {
      publishedAt: twoHoursAgoIso,
      isEvergreenGem: true,
      pinnedManualRunAt: nowMs,
      curationScore: 8.9
    });

    assert.equal(
      isWithin14DayRelevanceWindow(oldUnpinnedNonEvergreenYt, nowMs),
      false,
      'Non-evergreen unpinned youtube_gem > 45 days old must be excluded by 14d/45d window'
    );
    assert.equal(
      isWithin14DayRelevanceWindow(oldEvergreenYt, nowMs),
      true,
      'Evergreen youtube_gem > 45 days old must be retained'
    );
    assert.equal(
      isWithin14DayRelevanceWindow(oldPinnedYt, nowMs),
      true,
      'Recently pinned (pinnedManualRunAt) youtube_gem > 45 days old must be retained'
    );

    // Populated fresh background pool (>= 15 non-vault fresh items) so apply14DayWindow & live horizon exclusions trigger
    const freshBackground: ScoredFeedItem[] = Array.from({ length: 16 }, (_, idx) =>
      makeScored(
        `bg-fresh-${idx}`,
        {
          space: idx % 2 === 0 ? 'c/dialektik' : 'c/didaktik_labor',
          primaryTopic: idx % 2 === 0 ? 'philosophy_ethics' : 'german_didactics',
          topics: [idx % 2 === 0 ? 'philosophy_ethics' : 'german_didactics'],
          publishedAt: new Date(nowMs - (idx + 1) * 3600 * 1000).toISOString(),
          canonicalUrl: `https://journal-${idx}.de/essay-${idx}`,
          sourceDomain: `journal-${idx}.de`,
          sourceBroadcasterName: `Journal ${idx}`,
          curationScore: 9.0 - idx * 0.05
        },
        0.95 - idx * 0.01
      )
    );

    const pool: ScoredFeedItem[] = [
      ...freshBackground,
      scoreFeedItem(oldUnpinnedNonEvergreenYt, DEFAULT_USER_PROFILE, {}),
      scoreFeedItem(oldEvergreenYt, DEFAULT_USER_PROFILE, {}),
      scoreFeedItem(oldPinnedYt, DEFAULT_USER_PROFILE, {}),
      scoreFeedItem(freshPinnedYt, DEFAULT_USER_PROFILE, {})
    ];

    for (const mode of ['for_you', 'top'] as const) {
      const sorted = sortFeedForDisplay(pool, mode, { interleave: true });
      const ids = sorted.map(i => i.id);

      assert.equal(
        ids.includes('yt-old-evergreen'),
        true,
        `Mode ${mode} must retain >45d isEvergreenGem youtube_gem`
      );
      assert.equal(
        ids.includes('yt-old-pinned'),
        true,
        `Mode ${mode} must retain >45d pinnedManualRunAt youtube_gem`
      );
      if (mode === 'for_you') {
        assert.equal(
          ids.includes('yt-old-drop'),
          false,
          'for_you must drop >45d non-evergreen unpinned youtube_gem'
        );
      }

      // Pinned newly researched videos (sorted newest pinnedManualRunAt first) must lead right at index 0 & 1
      assert.equal(sorted[0].id, 'yt-fresh-pinned', `Mode ${mode} must place newest pinnedManualRunAt video at index 0`);
      assert.equal(sorted[1].id, 'yt-old-pinned', `Mode ${mode} must place second pinnedManualRunAt video at index 1`);
    }
  });

  it('Case 3: End-to-end 2-batch flourishChannel("c/youtube") -> LocalFeedRepository -> getEditionAndDiscovery -> sortFeedForDisplay("for_you") keeps every freshly added video at the top', async () => {
    defaultFeedOperationManager.clearPins();

    mock.method(defaultSnapshotLoader, 'loadSnapshot', async () => ({
      success: true,
      itemCount: 0,
      items: []
    }));
    mock.method(defaultSnapshotLoader, 'loadReservoir', async () => ({
      success: true,
      itemCount: 0,
      items: []
    }));

    const batch1Ids = ['b1Vid000001', 'b1Vid000002', 'b1Vid000003', 'b1Vid000004'];
    const batch2Ids = ['b2Vid000001', 'b2Vid000002', 'b2Vid000003', 'b2Vid000004'];

    mock.method(globalThis, 'fetch', async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('hn.algolia.com/api/v1/')) {
        const pageMatch = url.match(/[?&]page=(\d+)/);
        const page = pageMatch ? Number(pageMatch[1]) : 0;
        const batch = page % 2 === 0 ? batch1Ids : batch2Ids;
        if (url.includes('query=youtube.com/watch') && !url.includes('80')) {
          return new Response(
            JSON.stringify({
              hits: batch.map((vid, idx) => ({
                objectID: `e2e-${page}-${idx}`,
                title: `E2E Epistemology and Systems Thinking Video ${vid}`,
                url: `https://www.youtube.com/watch?v=${vid}`,
                points: 95 - idx * 5,
                num_comments: 18 + idx,
                created_at: new Date(Date.now() - (idx + 40 * 24) * 3600 * 1000).toISOString()
              }))
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response(JSON.stringify({ hits: [] }), { status: 200 });
      }
      if (url.includes('api.rss2json.com')) {
        return new Response(JSON.stringify({ status: 'ok', items: [] }), { status: 200 });
      }
      if (url.includes('lemmy.world')) {
        return new Response(JSON.stringify({ posts: [] }), { status: 200 });
      }
      if (url.includes('noembed.com/embed')) {
        const vid = decodeURIComponent(url).match(/v=([a-zA-Z0-9_-]{11})/)?.[1] || '0';
        return new Response(
          JSON.stringify({ author_name: `Creator ${vid.slice(-2)}` }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify({}), { status: 404 });
    });

    const vaultYoutubeItems = REAL_KNOWLEDGE_VAULT.filter(
      v => v.space === 'c/youtube' || v.primaryTopic === 'youtube_gems' || v.format === 'youtube_gem'
    );
    const nowMs = Date.now();
    const initialRepoItems: FeedItem[] = [
      ...vaultYoutubeItems,
      ...Array.from({ length: 18 }, (_, i) =>
        makeFeedItem(`e2e-bg-${i}`, {
          space: i % 3 === 0 ? 'c/dialektik' : i % 3 === 1 ? 'c/didaktik_labor' : 'c/acceleration',
          primaryTopic: i % 3 === 0 ? 'philosophy_ethics' : i % 3 === 1 ? 'german_didactics' : 'ai_apple',
          topics: [i % 3 === 0 ? 'philosophy_ethics' : i % 3 === 1 ? 'german_didactics' : 'ai_apple'],
          canonicalUrl: `https://bg-journal-${i}.org/post-${i}`,
          sourceDomain: `bg-journal-${i}.org`,
          sourceBroadcasterName: `BG Journal ${i}`,
          publishedAt: new Date(nowMs - (i + 1) * 3600 * 1000).toISOString(),
          curationScore: 8.8 - i * 0.02
        })
      ),
      makeYoutubeGem('e2e-existing-yt-1', 'oldExYt0001', 'Existing YT Creator 1', {
        publishedAt: new Date(nowMs - 5 * 24 * 3600 * 1000).toISOString()
      }),
      makeYoutubeGem('e2e-existing-yt-2', 'oldExYt0002', 'Existing YT Creator 2', {
        publishedAt: new Date(nowMs - 10 * 24 * 3600 * 1000).toISOString()
      })
    ];

    const repo = new LocalFeedRepository(initialRepoItems, new AtemStorage(new MemoryStorageDriver()));
    await repo.ensureInitialized();

    // Forward singleton feedRepository.addItems calls into our isolated LocalFeedRepository
    mock.method(feedRepository, 'addItems', (items: FeedItem[], opts?: any) => {
      repo.addItems(items, opts);
    });

    try {
      (SubchannelFlourishService as any).youtubeSearchPageCursor = 0;

      const res1 = await SubchannelFlourishService.flourishChannel('c/youtube', {
        force: true,
        existingItems: repo.getAllItems()
      });
      assert.equal(res1.addedItems.length, 4, 'Batch 1 must add all 4 live YouTube videos');

      // Advance pinnedManualRunAt slightly for batch 2 so batch 2 sorts deterministically ahead of batch 1
      await new Promise(resolve => setTimeout(resolve, 10));

      const res2 = await SubchannelFlourishService.flourishChannel('c/youtube', {
        force: true,
        existingItems: repo.getAllItems()
      });
      assert.equal(res2.addedItems.length, 4, 'Batch 2 must add all 4 new live YouTube videos');

      const allFreshIds = new Set([...res1.addedItems, ...res2.addedItems].map(i => i.id));
      assert.equal(allFreshIds.size, 8, 'Combined batch 1 + batch 2 must have 8 unique freshly added videos');

      const { daily, discovery } = await repo.getEditionAndDiscovery('morning', DEFAULT_USER_PROFILE);
      const combinedById = new Map<string, ScoredFeedItem>();
      for (const item of [...daily, ...discovery]) {
        if (!combinedById.has(item.id)) combinedById.set(item.id, item);
      }
      const combinedPool = Array.from(combinedById.values());
      const pinnedIds = defaultFeedOperationManager.getPinnedItemIds();

      // 1. Channel view (c/youtube filtered stream) -> all 8 freshly added videos must be at top 0..7
      const ytOnlyStream = combinedPool.filter(i => getEffectiveSpaceHandle(i) === 'c/youtube');
      const sortedYtChannel = sortFeedForDisplay(ytOnlyStream, 'for_you', { pinnedIds, interleave: true });

      assert.equal(
        sortedYtChannel.length,
        ytOnlyStream.length,
        'c/youtube stream must lose 0 videos to age filters or diversity truncation'
      );
      for (const freshId of allFreshIds) {
        assert.ok(
          sortedYtChannel.some(i => i.id === freshId),
          `Freshly added video ${freshId} must survive getEditionAndDiscovery -> sortFeedForDisplay`
        );
      }
      const top8Ids = new Set(sortedYtChannel.slice(0, 8).map(i => i.id));
      assert.deepEqual(
        top8Ids,
        allFreshIds,
        'Every freshly added video from batch 1 + batch 2 must sit right at the top of c/youtube'
      );

      // 2. Full combined "Alle Spaces" for_you stream -> all 8 freshly added videos retained and lead index 0..1
      const sortedAllSpaces = sortFeedForDisplay(combinedPool, 'for_you', { pinnedIds, interleave: true });
      for (const freshId of allFreshIds) {
        assert.ok(
          sortedAllSpaces.some(i => i.id === freshId),
          `Freshly added video ${freshId} must be retained in full for_you stream`
        );
      }
      assert.ok(allFreshIds.has(sortedAllSpaces[0].id), 'Top slot #0 in for_you must be a freshly researched YouTube video');
      assert.ok(allFreshIds.has(sortedAllSpaces[1].id), 'Top slot #1 in for_you must be a freshly researched YouTube video');
    } finally {
      defaultFeedOperationManager.clearPins();
      mock.restoreAll();
    }
  });

  it('Case 4: FeedScreen.tsx contract check: handleRunManualResearchPipeline delegates channel refreshes to handleFlourishActiveChannel, which resets scroll-freeze / top-lock and reveals newly added videos', () => {
    const feedScreenPath = path.resolve(process.cwd(), 'src/features/feed/FeedScreen.tsx');
    const source = fs.readFileSync(feedScreenPath, 'utf8');

    const flourishStart = source.indexOf('const handleFlourishActiveChannel = useCallback');
    const flourishEnd = source.indexOf('const onRefresh = useCallback', flourishStart);
    assert.ok(flourishStart !== -1 && flourishEnd > flourishStart, 'Could not locate handleFlourishActiveChannel');
    const flourishBody = source.slice(flourishStart, flourishEnd);

    const pipelineStart = source.indexOf('const handleRunManualResearchPipeline = useCallback');
    const pipelineEnd = source.indexOf('const cardLayoutsRef =', pipelineStart);
    assert.ok(pipelineStart !== -1 && pipelineEnd > pipelineStart, 'Could not locate handleRunManualResearchPipeline');
    const pipelineBody = source.slice(pipelineStart, pipelineEnd);

    // 1. handleRunManualResearchPipeline delegates selectedFilter !== 'all' to handleFlourishActiveChannel
    assert.ok(
      pipelineBody.includes('if (isRunningManualPipeline || isFlourishingChannel) return;'),
      'handleRunManualResearchPipeline must guard against concurrent manual/channel research runs'
    );
    assert.match(
      pipelineBody,
      /if\s*\(\s*selectedFilter\s*!==\s*'all'\s*\)\s*\{\s*await\s+handleFlourishActiveChannel\(false\);\s*return;\s*\}/,
      'handleRunManualResearchPipeline must delegate channel refreshes (selectedFilter !== "all") to handleFlourishActiveChannel(false)'
    );

    // 2. handleFlourishActiveChannel inserts pinned items, resets scroll-freeze / top-lock, and reveals newly added videos
    const requiredFlourishStatements = [
      "feedRepository.addItems(res.addedItems, { operationType: 'manual_refresh', pinInserted: true })",
      'lockedTopItemIdsRef.current = null',
      'hasCommittedInitialViewportRef.current = false',
      'frozenRenderedFreshRef.current = []',
      'newArrivalsQueueRef.current = []',
      'setPendingStreamArrivals([])',
      'setPendingNewItemIds([])',
      'setArrivalsBannerState(INITIAL_ARRIVALS_BANNER_STATE)',
      'isScrolledDownRef.current = false',
      'setIsScrolledDown(false)',
      'setRevealedNewItems(res.addedItems)',
      'setPinnedIds(defaultFeedOperationManager.getPinnedItemIds())',
      'await recomputeFeed()',
      'scrollToFeedTop(true)'
    ];
    for (const stmt of requiredFlourishStatements) {
      assert.ok(
        flourishBody.includes(stmt),
        `Expected handleFlourishActiveChannel to include "${stmt}"`
      );
    }

    // 3. Footer research CTA binds handleRunManualResearchPipeline and shows channel-aware YouTube copy
    assert.ok(source.includes('onPress={handleRunManualResearchPipeline}'));
    assert.ok(source.includes('disabled={isRunningManualPipeline || isFlourishingChannel}'));
    assert.ok(source.includes('20 neue Videos recherchieren'));
    assert.ok(source.includes('Suche spannende Videos…'));
  });

  it('Case 5 (v22): cleanYoutubeDescription strips sponsor/URL/timestamp clutter & legacy cached v21 YouTube boilerplate self-heals to empty', () => {
    const messyDesc = [
      '00:00 Intro',
      '04:12 Main Idea',
      'Support us on Patreon: https://patreon.com/example',
      'This video is sponsored by Brilliant.org - use my link below!',
      'An exploration of how ancient Greek astronomers measured the distance to the Moon using eclipses and simple geometry.',
      'Subscribe to our channel for weekly essays! #science #astronomy'
    ].join('\n');

    const cleaned = cleanYoutubeDescription(messyDesc);
    assert.ok(cleaned.includes('ancient Greek astronomers measured the distance to the Moon'));
    assert.equal(cleaned.toLowerCase().includes('patreon'), false);
    assert.equal(cleaned.toLowerCase().includes('brilliant'), false);
    assert.equal(cleaned.toLowerCase().includes('subscribe'), false);
    assert.equal(cleaned.includes('00:00'), false);

    assert.equal(cleanYoutubeDescription('https://example.com\nSubscribe now! #video'), '');

    // Legacy v21 cached YouTube item with generic boilerplate in feedText, body & keyInsight
    const legacyCachedHnYt = makeYoutubeGem('live-yt-discover-legacy001', 'legacy00001', 'Veritasium', {
      feedText:
        'Das Video-Essay „Why Light Slows Down in Glass“ von Veritasium (mit starker Resonanz über Hacker News (116 Punkte, 266 Kommentare)) verbindet anschauliche Erklärung mit konzeptioneller Tiefe. Statt schneller Ablenkung steht das gründliche Nachvollziehen komplexer Zusammenhänge im Mittelpunkt – abrufbar direkt über den kuratierten Video-Link.',
      body:
        'Das Video-Essay „Why Light Slows Down in Glass“ von Veritasium (mit starker Resonanz über Hacker News (116 Punkte, 266 Kommentare)) verbindet anschauliche Erklärung mit konzeptioneller Tiefe. Statt schneller Ablenkung steht das gründliche Nachvollziehen komplexer Zusammenhänge im Mittelpunkt – abrufbar direkt über den kuratierten Video-Link. Im Fokus stehen tragfähige Argumente, visuelle Modelle und weiterführende Perspektiven für YouTube Video-Essays, die sich ideal für ruhiges, konzentriertes Sehen eignen.',
      articleBody:
        '### Video-Essay: Why Light Slows Down in Glass\n\n- **Kanal / Urheber:** Veritasium\n- **YouTube-Direktlink:** [https://www.youtube.com/watch?v=legacy00001](https://www.youtube.com/watch?v=legacy00001)',
      keyInsight:
        'Veritasium entfaltet in „Why Light Slows Down in Glass“ zentrale Denkanstöße und Erklärungsmodelle – kuratiert für konzentriertes Verstehen statt flüchtiger Clips und direkt auf YouTube abrufbar.'
    });

    assert.equal(
      getCardRenderableText(legacyCachedHnYt),
      '',
      'Legacy cached YouTube boilerplate must self-heal to empty string without falling back to articleBody markdown'
    );
    assert.equal(stripSyntheticFillerSentences(legacyCachedHnYt.keyInsight || '').trim(), '');
    assert.equal(satisfiesDefaultCuratedStandard(legacyCachedHnYt), true);

    // Legacy cached RSS item that had real description after "Aus der Videobeschreibung (...):" recovers real prose
    const legacyCachedRssYt = makeYoutubeGem('live-yt-discover-legacy002', 'legacy00002', '3Blue1Brown', {
      feedText:
        'Das Video-Essay „Fourier Transform“ von 3Blue1Brown (aus dem kuratierten Wissenskanal 3Blue1Brown) verbindet anschauliche Erklärung mit konzeptioneller Tiefe. Statt schneller Ablenkung steht das gründliche Nachvollziehen komplexer Zusammenhänge im Mittelpunkt – abrufbar direkt über den kuratierten Video-Link.',
      body:
        'Das Video-Essay „Fourier Transform“ von 3Blue1Brown (aus dem kuratierten Wissenskanal 3Blue1Brown) verbindet anschauliche Erklärung mit konzeptioneller Tiefe. Statt schneller Ablenkung steht das gründliche Nachvollziehen komplexer Zusammenhänge im Mittelpunkt – abrufbar direkt über den kuratierten Video-Link.\n\nAus der Videobeschreibung (3Blue1Brown): An animated introduction to the Fourier Transform and winding frequencies around a circle.'
    });
    assert.equal(
      getCardRenderableText(legacyCachedRssYt),
      'An animated introduction to the Fourier Transform and winding frequencies around a circle.'
    );
  });

  it('Case 6 (v22): inlineVideoBus enforces single active player & FeedCard wires click-to-play youtube-nocookie facade', () => {
    setActiveInlineVideoKey(null);
    const seenEvents: Array<string | null> = [];
    const unsubscribe = subscribeActiveInlineVideo(key => seenEvents.push(key));
    try {
      assert.equal(getActiveInlineVideoKey(), null);
      setActiveInlineVideoKey('yt-card-1');
      assert.equal(getActiveInlineVideoKey(), 'yt-card-1');
      // Starting a second video automatically replaces the first (max 1 iframe at a time)
      setActiveInlineVideoKey('yt-card-2');
      assert.equal(getActiveInlineVideoKey(), 'yt-card-2');
      setActiveInlineVideoKey(null);
      assert.equal(getActiveInlineVideoKey(), null);
      assert.deepEqual(seenEvents, ['yt-card-1', 'yt-card-2', null]);
    } finally {
      unsubscribe();
      setActiveInlineVideoKey(null);
    }

    assert.equal(extractInlineYoutubeVideoId('https://www.youtube.com/watch?v=aircAruvnKk'), 'aircAruvnKk');
    assert.equal(extractInlineYoutubeVideoId('https://youtu.be/WUvTyaaNkzM?t=10'), 'WUvTyaaNkzM');
    assert.equal(extractInlineYoutubeVideoId('https://www.youtube-nocookie.com/embed/aircAruvnKk'), 'aircAruvnKk');
    assert.equal(
      buildYouTubeNoCookieEmbedUrl('aircAruvnKk'),
      'https://www.youtube-nocookie.com/embed/aircAruvnKk?autoplay=1&rel=0&modestbranding=1'
    );

    const feedCardPath = path.resolve(process.cwd(), 'src/ui/components/FeedCard.tsx');
    const feedCardSource = fs.readFileSync(feedCardPath, 'utf8');
    assert.ok(feedCardSource.includes('buildYouTubeNoCookieEmbedUrl'));
    assert.ok(feedCardSource.includes('subscribeActiveInlineVideo'));
    assert.ok(feedCardSource.includes('handlePlayYoutubeInline'));
    assert.ok(feedCardSource.includes('handleCloseInlineVideo'));
    assert.ok(feedCardSource.includes('Direkt abspielen'));
    assert.ok(feedCardSource.includes('stripSyntheticFillerSentences(item.keyInsight)'));
  });
});
