import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  MAX_PRELOAD_CACHE,
  preloadUpcomingFeedImages,
  resetPreloadedImageCacheForTest
} from '../src/core/utils/imagePreloader';
import {
  buildDeterministicTopicPlan,
  runTopicPremiumPipeline
} from '../src/core/studio/topicPremiumPipeline';
import { SubchannelFlourishService } from '../src/core/ingestion/subchannelFlourishService';
import { defaultSnapshotLoader } from '../src/core/feed/SnapshotLoader';
import {
  areFeedCardPropsEqual,
  scoreFeedItem,
  sortFeedForDisplay,
  ScoredFeedItem
} from '../src/core/domain/ranking';
import { RecursiveLearningEngine } from '../src/core/recommendations/recursiveLearningEngine';
import { FeedItem, FeedItemSchema, TopicTag, UserProfile } from '../src/core/domain/types';
import { DEFAULT_USER_PROFILE } from '../src/core/data/fixtures';

const ROOT_DIR = path.resolve(__dirname, '..');

function makeFeedItem(id: string, overrides: Partial<FeedItem> = {}): FeedItem {
  const nowIso = new Date().toISOString();
  return FeedItemSchema.parse({
    id,
    type: 'deep_dive',
    format: 'sourced_update',
    title: `Analytischer Essay ${id}: Perspektiven aus Kultur und Wissenschaft`,
    subtitle: 'Redaktionelle Einordnung',
    feedText:
      'Eine fundierte Untersuchung zentraler Zusammenhänge, historischer Hintergründe und methodischer Perspektiven für konzentriertes Lesen.',
    body:
      'Eine fundierte Untersuchung zentraler Zusammenhänge, historischer Hintergründe und methodischer Perspektiven für konzentriertes Lesen über mehrere Absätze.',
    articleBody:
      '### Analytischer Essay\n\nEine fundierte Untersuchung zentraler Zusammenhänge, historischer Hintergründe und methodischer Perspektiven für konzentriertes Lesen.',
    keyInsight: 'Klare Gegenüberstellung empirischer Befunde und offener Fragen.',
    primaryTopic: 'philosophy_ethics',
    topics: ['philosophy_ethics'],
    space: 'c/dialektik',
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
    provenanceSummary: 'Geprüfte Quelle',
    wordCount: 240,
    evidenceTier: 'publisher_excerpt',
    contentOrigin: 'live_ingested',
    contentHash: `hash-${id}`,
    canonicalUrl: `https://example-source-${id}.org/${id}`,
    sourceDomain: `example-source-${id}.org`,
    sourceBroadcasterName: `Source ${id}`,
    sourceReferences: [
      {
        publisher: `Source ${id}`,
        originalUrl: `https://example-source-${id}.org/${id}`,
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

function makeScored(id: string, overrides: Partial<FeedItem> = {}, score = 0.78): ScoredFeedItem {
  const item = makeFeedItem(id, overrides);
  return {
    ...item,
    score,
    scoreBreakdown: {
      topicMatch: 0.8,
      topicAffinity: 0.8,
      goalAlignment: 0.75,
      readingTimeFit: 0.85,
      durationMatch: 0.85,
      freshness: 0.9,
      editorialValue: 0.88,
      depthBonus: 0.35,
      serendipity: 0.65,
      feedbackAdjustment: 0.5,
      behavioralAdjustment: 0.5,
      authorBoost: 0,
      totalScore: score,
      explanation: 'Test Score',
      primaryReason: 'Test',
      secondaryReason: 'Test',
      whyFactors: ['Test']
    }
  };
}

function makeInvertedAbstract(text: string): Record<string, number[]> {
  const index: Record<string, number[]> = {};
  const words = text.split(/\s+/).filter(Boolean);
  words.forEach((word, pos) => {
    if (!index[word]) index[word] = [];
    index[word].push(pos);
  });
  return index;
}

test('Atmen v24 — Smooth Scroll, AI Studio Premium-Pipeline, Sharp Horizons, Upvote Taste Steering & Bloomscroll Checkpoint', async (t) => {
  await t.test(
    'Case 1 (#1): preloadUpcomingFeedImages handles native no-op, idle/timeout scheduling, dedupe, maxBatch, FIFO eviction at 80 & FeedCard zero-reflow contract',
    async () => {
      const globalAny = globalThis as Record<string, unknown>;
      const originalWindow = globalAny.window;

      try {
        resetPreloadedImageCacheForTest();

        // 1a. Native / SSR no-op when window is undefined
        delete globalAny.window;
        assert.doesNotThrow(() => {
          preloadUpcomingFeedImages(['https://cdn.example.org/native-noop.jpg'], 6);
        });

        // 1b. requestIdleCallback scheduling, dedupe, and maxBatch
        const loadedImages: { src: string; decoding: string }[] = [];
        const idleCallbacks: { cb: () => void; timeout?: number }[] = [];

        class MockImage {
          src = '';
          decoding = '';
          constructor() {
            loadedImages.push(this);
          }
        }

        globalAny.window = {
          Image: MockImage,
          requestIdleCallback: (cb: () => void, options?: { timeout?: number }) => {
            idleCallbacks.push({ cb, timeout: options?.timeout });
            return idleCallbacks.length;
          }
        };

        preloadUpcomingFeedImages(
          [
            'https://cdn.example.org/a.jpg',
            'https://cdn.example.org/a.jpg', // duplicate in same batch
            'https://cdn.example.org/b.jpg',
            'https://cdn.example.org/c.jpg',
            'https://cdn.example.org/d.jpg'
          ],
          3
        );

        assert.equal(idleCallbacks.length, 1, 'Should schedule one requestIdleCallback batch');
        assert.equal(idleCallbacks[0].timeout, 300);
        assert.equal(loadedImages.length, 0, 'Images should not instantiate until idle callback fires');

        idleCallbacks[0].cb();
        assert.deepEqual(
          loadedImages.map(i => i.src),
          [
            'https://cdn.example.org/a.jpg',
            'https://cdn.example.org/b.jpg',
            'https://cdn.example.org/c.jpg'
          ],
          'Should dedupe and respect maxBatch = 3'
        );
        assert.ok(loadedImages.every(i => i.decoding === 'async'), 'Every preloaded image must use async decoding');

        // Re-submitting already-cached URLs schedules nothing
        preloadUpcomingFeedImages(
          ['https://cdn.example.org/a.jpg', 'https://cdn.example.org/b.jpg'],
          6
        );
        assert.equal(idleCallbacks.length, 1, 'Already cached URLs must be deduped without new idle callback');

        // 1c. setTimeout fallback when requestIdleCallback is unavailable
        resetPreloadedImageCacheForTest();
        loadedImages.length = 0;
        globalAny.window = { Image: MockImage };

        preloadUpcomingFeedImages(['https://cdn.example.org/fallback-timeout.jpg'], 4);
        assert.equal(loadedImages.length, 0, 'Fallback timeout should defer image preload');
        await new Promise(resolve => setTimeout(resolve, 110));
        assert.deepEqual(
          loadedImages.map(i => i.src),
          ['https://cdn.example.org/fallback-timeout.jpg'],
          'setTimeout fallback should preload image after ~80ms'
        );

        // 1d. FIFO eviction at MAX_PRELOAD_CACHE = 80
        assert.equal(MAX_PRELOAD_CACHE, 80);
        resetPreloadedImageCacheForTest();
        loadedImages.length = 0;
        idleCallbacks.length = 0;
        globalAny.window = {
          Image: MockImage,
          requestIdleCallback: (cb: () => void) => {
            cb();
            return 1;
          }
        };

        const batch80 = Array.from({ length: 80 }, (_, idx) => `https://cdn.example.org/img-${idx}.jpg`);
        preloadUpcomingFeedImages(batch80, 80);
        assert.equal(loadedImages.length, 80);

        // Adding 81st URL evicts img-0 (oldest FIFO) while keeping img-1 cached
        preloadUpcomingFeedImages(['https://cdn.example.org/img-80.jpg'], 1);
        assert.equal(loadedImages.length, 81);

        loadedImages.length = 0;
        preloadUpcomingFeedImages(
          ['https://cdn.example.org/img-1.jpg', 'https://cdn.example.org/img-0.jpg'],
          6
        );
        assert.deepEqual(
          loadedImages.map(i => i.src),
          ['https://cdn.example.org/img-0.jpg'],
          'FIFO eviction must evict img-0 while keeping img-1 cached'
        );

        // 1e. FeedCard.tsx zero-reflow & smooth-scroll contract
        const feedCardSrc = fs.readFileSync(path.join(ROOT_DIR, 'src/ui/components/FeedCard.tsx'), 'utf8');
        assert.equal(
          feedCardSrc.includes("contentVisibility: 'auto'"),
          false,
          'FeedCard.tsx must NOT use contentVisibility: auto'
        );
        assert.equal(
          feedCardSrc.includes('containIntrinsicSize'),
          false,
          'FeedCard.tsx must NOT use containIntrinsicSize'
        );
        assert.ok(
          feedCardSrc.includes("contain: 'layout style'"),
          'FeedCard.tsx must use lightweight contain: layout style on web'
        );
        assert.ok(
          feedCardSrc.includes('isEagerImage?: boolean') &&
            feedCardSrc.includes("loading: isEagerImage || isHero ? 'eager' : 'lazy'"),
          'FeedCard.tsx must support isEagerImage prop for eager/lazy web loading'
        );
        assert.ok(
          feedCardSrc.includes('isStandardEditorialImage') &&
            feedCardSrc.includes('cardInnerWidth / 1.6'),
          'FeedCard.tsx must lock standard editorial cards to fixed 16:10 frames'
        );

        // Verify handleLoadedImageDimensions exits early for standard editorial cards before setNaturalDims
        const dimHandlerMatch = feedCardSrc.match(
          /const handleLoadedImageDimensions = [\s\S]*?\n\s*};/
        );
        assert.ok(dimHandlerMatch, 'handleLoadedImageDimensions handler must exist in FeedCard.tsx');
        const handlerBody = dimHandlerMatch[0];
        const earlyReturnIdx = handlerBody.indexOf('if (!isMemeCard && !isArtCard)');
        const returnIdx = handlerBody.indexOf('return;', earlyReturnIdx);
        const setNaturalDimsIdx = handlerBody.indexOf('setNaturalDims(');
        assert.ok(
          earlyReturnIdx !== -1 && returnIdx !== -1 && setNaturalDimsIdx > returnIdx,
          'Standard editorial cards must return early before setNaturalDims to prevent mid-scroll layout reflows'
        );

        // areFeedCardPropsEqual intentionally ignores isEagerImage flips on mounted cards
        const sample = makeScored('v24-eager-memo');
        assert.equal(
          areFeedCardPropsEqual(
            { item: sample, isEagerImage: true, cardWidth: 700, viewportWidth: 1200 },
            { item: sample, isEagerImage: false, cardWidth: 700, viewportWidth: 1200 }
          ),
          true,
          'areFeedCardPropsEqual must ignore isEagerImage transitions on mounted cards'
        );
      } finally {
        resetPreloadedImageCacheForTest();
        if (originalWindow === undefined) {
          delete globalAny.window;
        } else {
          globalAny.window = originalWindow;
        }
      }
    }
  );

  await t.test(
    'Case 2 (#2): buildDeterministicTopicPlan, 5-lane runTopicPremiumPipeline, Silent Editor-in-Chief AI ranking (zero prose mutation) & custom flourishChannel skips generic blueprints',
    async () => {
      // 2a. Deterministic topic planner
      const plan = buildDeterministicTopicPlan(
        'Bauhaus Architektur',
        'Moderne Gestaltung, Typografie und Städtebau im 20. Jahrhundert',
        'art_aesthetics',
        ['https://bauhaus-journal.example.org/rss.xml']
      );
      assert.ok(plan.deKeywords.some(k => /bauhaus/i.test(k)), 'deKeywords must include Bauhaus');
      assert.ok(plan.enKeywords.some(k => /architecture|bauhaus/i.test(k)), 'enKeywords must include English translations');
      assert.ok(plan.wikipediaQueries.length >= 2, 'wikipediaQueries must be populated');
      assert.ok(plan.openAlexQuery.length >= 5, 'openAlexQuery must be populated');
      assert.ok(plan.hnQueries.length >= 1 && plan.youtubeQueries.length >= 1, 'HN & YouTube queries must be populated');
      assert.ok(
        plan.matchingRssUrls.includes('https://bauhaus-journal.example.org/rss.xml'),
        'seedSources RSS URL must be prioritized in matchingRssUrls'
      );
      assert.ok(plan.matchingRssUrls.length <= 4, 'matchingRssUrls must be capped at 4');

      // 2b. Mock all 5 CORS-safe lanes + Silent Editor-in-Chief Gemini endpoint
      const originalFetch = globalThis.fetch;
      const originalLoadReservoir = defaultSnapshotLoader.loadReservoir.bind(defaultSnapshotLoader);
      const originalLoadSnapshot = defaultSnapshotLoader.loadSnapshot.bind(defaultSnapshotLoader);

      const snapshotBauhausItem = makeFeedItem('snap-bauhaus-1', {
        title: 'Bauhaus Architektur in Dessau: Licht, Stahl und offene Raumgeometrie',
        subtitle: 'Architekturgeschichte',
        feedText:
          'Das Bauhaus-Gebäude in Dessau prägte die moderne Architektur mit gläsernen Vorhangfassaden, funktionaler Klarheit und neuer Werkstattausbildung.',
        body:
          'Das Bauhaus-Gebäude in Dessau prägte die moderne Architektur mit gläsernen Vorhangfassaden, funktionaler Klarheit und neuer Werkstattausbildung.',
        articleBody:
          '### Bauhaus Architektur in Dessau\n\nDas Bauhaus-Gebäude in Dessau prägte die moderne Architektur mit gläsernen Vorhangfassaden.',
        primaryTopic: 'art_aesthetics',
        topics: ['art_aesthetics'],
        space: 'c/kunst_galerie',
        canonicalUrl: 'https://architektur-archiv.example.org/bauhaus-dessau',
        sourceDomain: 'architektur-archiv.example.org',
        sourceBroadcasterName: 'Architektur Archiv'
      });

      const snapshotUnrelatedItem = makeFeedItem('snap-unrelated-cooking', {
        title: 'Sauerteigbrot backen: Mehltypen und Gärzeiten für Einsteiger',
        subtitle: 'Küche & Backen',
        feedText:
          'Ein praktischer Leitfaden für knusprige Krusten, lange Teigführung und einfache Rezepte für den heimischen Backofen.',
        body:
          'Ein praktischer Leitfaden für knusprige Krusten, lange Teigführung und einfache Rezepte für den heimischen Backofen.',
        primaryTopic: 'health_biohacking',
        topics: ['health_biohacking'],
        space: 'c/health_longevity',
        canonicalUrl: 'https://backstube.example.org/sauerteig',
        sourceDomain: 'backstube.example.org',
        sourceBroadcasterName: 'Backstube'
      });

      let aiStage3ElevatedId = '';
      let aiStage3DroppedId = '';

      try {
        defaultSnapshotLoader.loadReservoir = async () => ({
          success: true,
          items: [snapshotBauhausItem, snapshotUnrelatedItem],
          itemCount: 2,
          generatedAt: new Date().toISOString()
        });
        defaultSnapshotLoader.loadSnapshot = async () => ({
          success: true,
          items: [],
          itemCount: 0,
          generatedAt: new Date().toISOString()
        });

        globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
          const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

          // Lane 2: api.rss2json.com
          if (url.startsWith('https://api.rss2json.com/v1/api.json')) {
            return new Response(
              JSON.stringify({
                status: 'ok',
                feed: { title: 'Bauhaus Journal', author: 'Bauhaus Redaktion' },
                items: [
                  {
                    title: 'Typografie am Bauhaus: Wie Herbert Bayer und László Moholy-Nagy das Lesen veränderten',
                    link: 'https://bauhaus-journal.example.org/typografie-bauhaus',
                    pubDate: '2026-11-25 10:00:00',
                    author: 'Clara Weber',
                    thumbnail: 'https://bauhaus-journal.example.org/images/typografie-1200.jpg',
                    description:
                      '<p>Die Typografie am Bauhaus verband funktionale Klarheit mit asymmetrischer Spannung und schuf visuelle Hierarchien, die bis heute Buchgestaltung, Architektur-Leitsysteme und digitale Interfaces prägen.</p>'
                  }
                ]
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
          }

          // Lane 3a: Wikipedia search DE/EN
          if (url.includes('.wikipedia.org/w/api.php')) {
            const isDe = url.includes('de.wikipedia.org');
            return new Response(
              JSON.stringify({
                query: {
                  search: [
                    {
                      title: isDe ? 'Bauhaus' : 'Bauhaus architecture',
                      pageid: isDe ? 1001 : 2002
                    }
                  ]
                }
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
          }

          // Lane 3b: Wikipedia page summary DE/EN
          if (url.includes('.wikipedia.org/api/rest_v1/page/summary/')) {
            const isDe = url.includes('de.wikipedia.org');
            return new Response(
              JSON.stringify({
                type: 'standard',
                title: isDe ? 'Bauhaus' : 'Bauhaus architecture',
                pageid: isDe ? 1001 : 2002,
                description: isDe ? 'Kunstschule der Moderne' : 'Modernist architecture school',
                timestamp: '2026-11-20T12:00:00Z',
                extract: isDe
                  ? 'Das Bauhaus wurde 1919 von Walter Gropius in Weimar als Hochschule für Gestaltung gegründet und verband Handwerk, Architektur, Typografie und industrielle Formgebung zu einem weltweiten Leitbild der Moderne.'
                  : 'Bauhaus architecture emerged in Weimar and Dessau as a radical modernist synthesis of craft, structural honesty, glass curtain walls, and urban design that reshaped twentieth-century cities worldwide.',
                originalimage: {
                  source: isDe
                    ? 'https://upload.wikimedia.org/wikipedia/commons/bauhaus-dessau.jpg'
                    : 'https://upload.wikimedia.org/wikipedia/commons/bauhaus-masterhouses.jpg'
                },
                content_urls: {
                  desktop: {
                    page: isDe
                      ? 'https://de.wikipedia.org/wiki/Bauhaus'
                      : 'https://en.wikipedia.org/wiki/Bauhaus_architecture'
                  }
                }
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
          }

          // Lane 4: OpenAlex (1 genuine Bauhaus paper + 1 wet-lab molecular oncology paper that MUST be filtered)
          if (url.startsWith('https://api.openalex.org/works')) {
            return new Response(
              JSON.stringify({
                results: [
                  {
                    id: 'https://openalex.org/W-bauhaus-urbanism',
                    doi: 'https://doi.org/10.1000/bauhaus-2026',
                    title: 'Bauhaus Architecture and Modernist Urban Design in Central Europe',
                    publication_date: '2026-09-12',
                    cited_by_count: 42,
                    primary_location: {
                      landing_page_url: 'https://journal.example.edu/bauhaus-urbanism',
                      source: { display_name: 'Journal of Architectural History' }
                    },
                    authorships: [{ author: { display_name: 'Prof. Helena Lindner' } }],
                    abstract_inverted_index: makeInvertedAbstract(
                      'This study examines how Bauhaus architecture and modernist urban design principles shaped housing cooperatives, daylight standards, and material transparency across Weimar, Dessau, and post-war European cities.'
                    )
                  },
                  {
                    id: 'https://openalex.org/W-wetlab-noise',
                    doi: 'https://doi.org/10.1000/wetlab-noise',
                    title: 'Bauhaus-inspired Spatial Tumor Microenvironment scRNA-seq Biomarker in Colorectal Carcinoma Xenografts',
                    publication_date: '2026-10-01',
                    cited_by_count: 5,
                    primary_location: {
                      landing_page_url: 'https://biomed.example.edu/wetlab-tumor',
                      source: { display_name: 'Molecular Oncology Assays' }
                    },
                    authorships: [{ author: { display_name: 'Dr. Wet Lab' } }],
                    abstract_inverted_index: makeInvertedAbstract(
                      'Using single-cell RNA-seq, Western blot, flow cytometry, and murine xenograft immunohistochemistry, we quantified CD8+ T-cell infiltration and apoptosis signaling in metastatic colorectal carcinoma cell lines.'
                    )
                  }
                ]
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
          }

          // Lane 5a: Hacker News Algolia (essays & YouTube video-essays)
          if (url.startsWith('https://hn.algolia.com/api/v1/search')) {
            const isYoutubeQuery = decodeURIComponent(url).includes('youtube.com/watch');
            if (isYoutubeQuery) {
              return new Response(
                JSON.stringify({
                  hits: [
                    {
                      objectID: 'hn-yt-bauhaus-1',
                      title: 'Why Bauhaus Architecture Still Shapes Modern Cities',
                      url: 'https://www.youtube.com/watch?v=BauhausVid1',
                      author: 'archfan',
                      points: 145,
                      num_comments: 38,
                      created_at: '2026-11-24T15:00:00Z',
                      story_text: ''
                    }
                  ]
                }),
                { status: 200, headers: { 'Content-Type': 'application/json' } }
              );
            }
            return new Response(
              JSON.stringify({
                hits: [
                  {
                    objectID: 'hn-essay-bauhaus-1',
                    title: 'Revisiting Bauhaus Architecture: What Modernist Designers Got Right About Everyday Objects',
                    url: 'https://design-essays.example.org/bauhaus-everyday-objects',
                    author: 'designhistorian',
                    points: 192,
                    num_comments: 64,
                    created_at: '2026-11-26T09:30:00Z',
                    story_text:
                      'A long-form architectural analysis of how the Bauhaus workshops in Weimar and Dessau merged structural clarity, affordable industrial craft, and humane urban spaces without sacrificing tactile warmth.'
                  }
                ]
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
          }

          // Lane 5b: noembed.com for YouTube enrichment
          if (url.startsWith('https://noembed.com/embed')) {
            return new Response(
              JSON.stringify({
                title: 'Why Bauhaus Architecture Still Shapes Modern Cities',
                author_name: 'Architecture Stories'
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
          }

          // Gemini API mock for Silent Editor-in-Chief test
          if (url.includes('generativelanguage.googleapis.com')) {
            const bodyText = typeof init?.body === 'string' ? init.body : '';
            const parsedReq = JSON.parse(bodyText) as {
              contents?: { parts?: { text?: string }[] }[];
            };
            const promptText = parsedReq.contents?.[0]?.parts?.[0]?.text || '';

            if (promptText.includes('stille Chefredakteur')) {
              const rosterMarker = 'Kandidaten:\n';
              const rosterJsonStr = promptText.slice(promptText.indexOf(rosterMarker) + rosterMarker.length).trim();
              const roster = JSON.parse(rosterJsonStr) as { id: string; title: string }[];

              // Drop the last item, elevate the second-to-last item as a Gem, keep the rest
              aiStage3DroppedId = roster[roster.length - 1].id;
              aiStage3ElevatedId = roster[Math.max(0, roster.length - 2)].id;

              const decisions = roster.map(entry => {
                if (entry.id === aiStage3DroppedId) {
                  return { id: entry.id, keep: false, editorialScore: 2.1, isGem: false };
                }
                if (entry.id === aiStage3ElevatedId) {
                  return { id: entry.id, keep: true, editorialScore: 9.8, isGem: true };
                }
                return { id: entry.id, keep: true, editorialScore: 2.5, isGem: false };
              });

              return new Response(
                JSON.stringify({
                  candidates: [
                    {
                      content: {
                        parts: [{ text: JSON.stringify({ decisions }) }]
                      }
                    }
                  ],
                  usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 80 }
                }),
                { status: 200, headers: { 'Content-Type': 'application/json' } }
              );
            }

            // Stage 1 AI Query Architect response
            return new Response(
              JSON.stringify({
                candidates: [
                  {
                    content: {
                      parts: [
                        {
                          text: JSON.stringify({
                            deKeywords: ['Bauhaus', 'Architektur', 'Typografie', 'Dessau'],
                            enKeywords: ['Bauhaus', 'modernist architecture', 'urban design'],
                            wikipediaQueries: ['Bauhaus', 'Bauhaus architecture'],
                            openAlexQuery: 'Bauhaus modernist architecture urban design',
                            hnQueries: ['Bauhaus architecture'],
                            youtubeQueries: ['Bauhaus architecture'],
                            avoidTerms: ['baumarkt', 'hornbach']
                          })
                        }
                      ]
                    }
                  }
                ],
                usageMetadata: { promptTokenCount: 90, candidatesTokenCount: 60 }
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
          }

          // Any unexpected network URL fails cleanly (non-fatal)
          return new Response('{}', { status: 404, headers: { 'Content-Type': 'application/json' } });
        }) as typeof fetch;

        // Run deterministic (no-AI) 5-lane pipeline
        const deterministicResult = await runTopicPremiumPipeline({
          handle: 'c/bauhaus_architektur',
          title: 'Bauhaus Architektur',
          description: 'Moderne Gestaltung, Typografie und Städtebau',
          primaryTopic: 'art_aesthetics',
          seedSources: ['https://bauhaus-journal.example.org/rss.xml'],
          credentials: { provider: 'gemini', apiKey: '', model: 'gemini-2.5-flash' }
        });

        assert.equal(deterministicResult.usedAi, false);
        assert.equal(deterministicResult.laneCounts.snapshot, 1, 'Snapshot lane must keep Bauhaus and drop cooking');
        assert.ok(deterministicResult.laneCounts.rss >= 1, 'Catalog/Seed RSS lane via rss2json must return >= 1 item');
        assert.ok(deterministicResult.laneCounts.wikipedia >= 2, 'Wikipedia DE & EN lane must return items');
        assert.equal(deterministicResult.laneCounts.openAlex, 1, 'OpenAlex lane must filter out wet-lab oncology noise');
        assert.equal(deterministicResult.laneCounts.hnArticles, 1, 'HN essays lane must return 1 essay');
        assert.equal(deterministicResult.laneCounts.hnYoutube, 1, 'HN YouTube + noembed lane must return 1 video-essay');
        assert.ok(deterministicResult.items.length >= 6, 'Combined 5 lanes must yield >= 6 authentic items');

        // Verify unrelated cooking & wet-lab noise never appear
        assert.equal(
          deterministicResult.items.some(it => /sauerteig|colorectal|xenograft/i.test(`${it.title} ${it.feedText}`)),
          false,
          'Unrelated snapshot item and wet-lab OpenAlex paper must be excluded'
        );

        // Verify YouTube gem emitted cleanly with noembed channelTitle and zero filler prose
        const ytItem = deterministicResult.items.find(it => it.format === 'youtube_gem');
        assert.ok(ytItem, 'Pipeline must emit a youtube_gem item from HN + noembed');
        assert.equal(ytItem.youtubeMeta?.videoId, 'BauhausVid1');
        assert.equal(ytItem.youtubeMeta?.channelTitle, 'Architecture Stories');
        assert.equal(ytItem.feedText, '', 'YouTube gem without authentic description must have empty feedText (zero filler)');

        // Run Silent Editor-in-Chief AI ranking test
        const aiResult = await runTopicPremiumPipeline({
          handle: 'c/bauhaus_architektur',
          title: 'Bauhaus Architektur',
          description: 'Moderne Gestaltung, Typografie und Städtebau',
          primaryTopic: 'art_aesthetics',
          seedSources: ['https://bauhaus-journal.example.org/rss.xml'],
          credentials: {
            provider: 'gemini',
            apiKey: 'test-v24-silent-editor-key',
            model: 'gemini-2.5-flash',
            persistApiKey: true
          }
        });

        assert.equal(aiResult.usedAi, true, 'AI Silent Editor pipeline must report usedAi = true');
        assert.ok(aiStage3DroppedId.length > 0 && aiStage3ElevatedId.length > 0);
        assert.equal(
          aiResult.items.some(it => it.id === aiStage3DroppedId),
          false,
          'Silent Editor keep:false verdict must drop the rejected candidate'
        );

        const elevatedIdx = aiResult.items.findIndex(it => it.id === aiStage3ElevatedId);
        const detElevatedIdx = deterministicResult.items.findIndex(it => it.id === aiStage3ElevatedId);
        assert.ok(elevatedIdx !== -1, 'Elevated gem must remain in final AI-curated items');
        assert.ok(
          elevatedIdx < detElevatedIdx,
          `Silent Editor isGem + editorialScore 9.8 must elevate candidate rank (${detElevatedIdx} -> ${elevatedIdx})`
        );
        const elevatedItem = aiResult.items[elevatedIdx];
        assert.equal(elevatedItem.curationScore, 9.8);
        assert.equal(elevatedItem.isEvergreenGem, true);

        // Strict Silent Editor-in-Chief prose invariance check: feedText, body & articleBody MUST NEVER be altered by AI
        const deterministicById = new Map(deterministicResult.items.map(it => [it.id, it]));
        for (const aiItem of aiResult.items) {
          const orig = deterministicById.get(aiItem.id);
          if (!orig) continue;
          assert.equal(aiItem.feedText, orig.feedText, `AI must NEVER modify feedText for ${aiItem.id}`);
          assert.equal(aiItem.body, orig.body, `AI must NEVER modify body for ${aiItem.id}`);
          assert.equal(aiItem.articleBody, orig.articleBody, `AI must NEVER modify articleBody for ${aiItem.id}`);
        }

        // 2c. SubchannelFlourishService.flourishChannel on custom channel skips generic effortpostBlueprints when >= 3 live items exist
        const flourishRes = await SubchannelFlourishService.flourishChannel(
          {
            handle: 'c/bauhaus_architektur',
            title: 'Bauhaus Architektur',
            description: 'Moderne Gestaltung und Städtebau',
            primaryTopic: 'art_aesthetics',
            seedSources: ['https://bauhaus-journal.example.org/rss.xml']
          },
          {
            force: true,
            existingItems: [],
            credentials: { provider: 'gemini', apiKey: '', model: 'gemini-2.5-flash' }
          }
        );

        assert.ok(flourishRes.items.length >= 3, 'Custom channel flourish must return >= 3 live items');
        const hasGenericBlueprint = flourishRes.items.some(
          it =>
            it.id.includes('flourish-anchor') ||
            it.id.includes('concept-anchor') ||
            it.sourceBroadcasterName === 'OpenAlex Research Synthesis' ||
            it.sourceBroadcasterName === 'Semantic Scholar Briefing' ||
            /Welche Kausalmechanismen tragen über kurzfristige Oberflächeneffekte hinaus/i.test(it.title)
        );
        assert.equal(
          hasGenericBlueprint,
          false,
          'Custom channel flourish must skip generic effortpostBlueprints when >= 3 live items are returned'
        );
      } finally {
        globalThis.fetch = originalFetch;
        defaultSnapshotLoader.loadReservoir = originalLoadReservoir;
        defaultSnapshotLoader.loadSnapshot = originalLoadSnapshot;
      }
    }
  );

  await t.test(
    'Case 3 (#3): sortFeedForDisplay sharpens discourse & top horizons (disjoint top-5 vs for_you on pools >= 15) + FeedHorizonBar crisp German captions for all 5 horizons',
    () => {
      const nowMs = Date.now();
      const recentIso = (hoursAgo: number) => new Date(nowMs - hoursAgo * 3600_000).toISOString();

      // 3a. Sharpened 'discourse': flagship long-form essays & counter-perspectives rank clearly ahead of memes & short news flashes
      const flagshipEssays: ScoredFeedItem[] = [
        makeScored('disc-aeon-1', {
          title: 'Die Ethik der Aufmerksamkeit im Zeitalter autonomer Systeme',
          primaryTopic: 'philosophy_ethics',
          sourceDomain: 'aeon.co',
          sourceBroadcasterName: 'Aeon',
          sourceTrustLevel: 'deep_essay',
          format: 'long_invitation',
          wordCount: 460,
          curationScore: 8.8,
          isChallengingPerspective: true,
          publishedAt: recentIso(30),
          perspectiveDetails: {
            claim: 'Aufmerksamkeit ist eine moralische Ressource.',
            counterPerspective: 'Kognitive Entlastung kann Urteilskraft auch freisetzen.',
            humanSource: 'Aeon Redaktion'
          }
        }),
        makeScored('disc-psyche-2', {
          title: 'Resonanz oder Optimierung: Warum produktive Reibung Denken vertieft',
          primaryTopic: 'contemplation_mind',
          sourceDomain: 'psyche.co',
          sourceBroadcasterName: 'Psyche',
          sourceTrustLevel: 'deep_essay',
          format: 'long_invitation',
          wordCount: 390,
          curationScore: 8.6,
          publishedAt: recentIso(42)
        }),
        makeScored('disc-dlf-3', {
          title: 'Sein und Streit: Braucht Demokratie eine neue Streitkultur?',
          primaryTopic: 'philosophy_ethics',
          sourceDomain: 'deutschlandfunkkultur.de',
          sourceBroadcasterName: 'Deutschlandfunk Kultur',
          sourceTrustLevel: 'deep_essay',
          format: 'long_invitation',
          wordCount: 360,
          curationScore: 8.5,
          isChallengingPerspective: true,
          publishedAt: recentIso(50)
        }),
        makeScored('disc-spektrum-4', {
          title: 'Kognitive Architektur des Lernens: Was Meta-Analysen wirklich zeigen',
          primaryTopic: 'german_didactics',
          sourceDomain: 'spektrum.de',
          sourceBroadcasterName: 'Spektrum der Wissenschaft',
          sourceTrustLevel: 'deep_essay',
          format: 'long_invitation',
          wordCount: 340,
          curationScore: 8.4,
          publishedAt: recentIso(60)
        }),
        makeScored('disc-verf-5', {
          title: 'Verfassungsrechtliche Grenzen algorithmischer Vorauswahl',
          primaryTopic: 'science_society',
          sourceDomain: 'verfassungsblog.de',
          sourceBroadcasterName: 'Verfassungsblog',
          sourceTrustLevel: 'deep_essay',
          format: 'long_invitation',
          wordCount: 410,
          curationScore: 8.7,
          publishedAt: recentIso(72)
        }),
        makeScored('disc-eurozine-6', {
          title: 'Europäische Öffentlichkeit zwischen Diskurs und Fragmentierung',
          primaryTopic: 'science_society',
          sourceDomain: 'eurozine.com',
          sourceBroadcasterName: 'Eurozine',
          sourceTrustLevel: 'deep_essay',
          format: 'long_invitation',
          wordCount: 380,
          curationScore: 8.5,
          publishedAt: recentIso(80)
        })
      ];

      const lightweightNoise: ScoredFeedItem[] = [
        makeScored('disc-meme-1', {
          title: 'Kant und die Kaffeemaschine',
          primaryTopic: 'memes_satire',
          space: 'c/memes',
          format: 'meme',
          wordCount: 30,
          curationScore: 9.2,
          sourceDomain: 'existentialcomics.com',
          sourceBroadcasterName: 'Existential Comics',
          publishedAt: recentIso(20)
        }),
        makeScored('disc-flash-2', {
          title: 'Kurzmeldung: Sitzung im Rathaus auf Donnerstag vertagt',
          primaryTopic: 'science_society',
          format: 'sourced_update',
          wordCount: 65,
          curationScore: 8.9,
          sourceDomain: 'wire-flash.example.de',
          sourceBroadcasterName: 'Kurz-Ticker',
          publishedAt: recentIso(10)
        })
      ];

      const discourseSorted = sortFeedForDisplay([...lightweightNoise, ...flagshipEssays], 'discourse');
      const top5DiscourseIds = discourseSorted.slice(0, 5).map(i => i.id);
      assert.equal(
        top5DiscourseIds.includes('disc-meme-1') || top5DiscourseIds.includes('disc-flash-2'),
        false,
        'Sharpened discourse must place flagship long-form essays ahead of memes and short news flashes'
      );

      // 3b. Sharpened 'top' vs 'for_you' on a pool >= 15 items: disjoint top-5 + strong upvote/community weighting
      const topics: TopicTag[] = [
        'philosophy_ethics',
        'science_society',
        'ai_apple',
        'german_didactics',
        'contemplation_mind',
        'book_mastery'
      ];
      const pool20: ScoredFeedItem[] = Array.from({ length: 20 }, (_, idx) => {
        const topic = topics[idx % topics.length];
        const isCommunityStar = idx >= 12 && idx < 18;
        return makeScored(
          `horizon-pool-${idx}`,
          {
            title: `Horizont-Artikel ${idx}: Vertiefende Einordnung zu ${topic}`,
            primaryTopic: topic,
            topics: [topic],
            sourceDomain: `publisher-${idx}.org`,
            sourceBroadcasterName: `Publisher ${idx}`,
            publishedAt: recentIso(24 + idx * 4),
            curationScore: isCommunityStar ? 9.1 : 7.5 + (idx < 6 ? 0.8 : 0),
            upvotesCount: isCommunityStar ? 4 : 0,
            externalCommunityScore: isCommunityStar
              ? { platform: 'Hacker News', points: 320 + idx * 10, commentsCount: 95 }
              : undefined,
            sourceTrustLevel: isCommunityStar ? 'peer_reviewed' : 'community_curated'
          },
          // Give first items higher personal score so for_you leads with them
          idx < 8 ? 0.94 - idx * 0.01 : 0.72 - idx * 0.005
        );
      });

      const forYouTop5 = new Set(sortFeedForDisplay(pool20, 'for_you').slice(0, 5).map(i => i.id));
      const topRanked = sortFeedForDisplay(pool20, 'top');
      const topTabTop5 = topRanked.slice(0, 5).map(i => i.id);

      const overlapCount = topTabTop5.filter(id => forYouTop5.has(id)).length;
      assert.equal(
        overlapCount,
        0,
        `Top-5 of 'top' must be disjoint from Top-5 of 'for_you' on pools >= 15 (overlap: ${overlapCount})`
      );
      assert.ok(
        topTabTop5.some(id => id.startsWith('horizon-pool-1')),
        'High-upvote / high-community-score items must lead the sharpened Top horizon'
      );

      // 3c. Verify FeedHorizonBar exports getHorizonModeCaption and crisp German captions for all 5 horizons
      const horizonBarSrc = fs.readFileSync(path.join(ROOT_DIR, 'src/ui/components/FeedHorizonBar.tsx'), 'utf8');
      assert.ok(
        horizonBarSrc.includes('export function getHorizonModeCaption(mode: FeedSortMode): string'),
        'FeedHorizonBar.tsx must export getHorizonModeCaption'
      );
      for (const expectedCaption of [
        "mode: 'for_you'",
        "caption: 'Dein kuratierter Bloom-Mix'",
        "mode: 'today'",
        "caption: 'Aktuelle Meldungen der letzten 24 Std.'",
        "mode: 'discourse'",
        "caption: 'Langform-Essays, Streitfragen & Gegenperspektiven'",
        "mode: 'top'",
        "caption: 'Meistdiskutierte & bestbewertete Fundstücke'",
        "mode: 'timeless'",
        "caption: 'Evergreen-Perlen, Kunst, Bücher & Klassiker'"
      ]) {
        assert.ok(
          horizonBarSrc.includes(expectedCaption),
          `FeedHorizonBar.tsx must define crisp German caption fragment: ${expectedCaption}`
        );
      }
    }
  );

  await t.test(
    'Case 4 (#5): RecursiveLearningEngine upvote (+0.18 up to 1.85), downvote (-0.22 down to 0.3), muteSourceDomain (0.1 persisted & sharply lowers scoreFeedItem) + FeedCard inline taste feedback contract',
    async () => {
      await RecursiveLearningEngine.resetState();
      let profile: UserProfile = structuredClone(DEFAULT_USER_PROFILE);

      // 4a. Upvote boost +0.18 per distinct item, capped at 1.85
      const upItem1 = makeFeedItem('taste-up-1', {
        sourceDomain: 'bright-essays.org',
        canonicalUrl: 'https://bright-essays.org/essay-1',
        sourceReferences: [
          {
            publisher: 'Bright Essays',
            originalUrl: 'https://bright-essays.org/essay-1',
            title: 'Essay 1',
            publicationTimestamp: new Date().toISOString(),
            retrievalTimestamp: new Date().toISOString(),
            isVerified: true
          }
        ]
      });

      const resUp1 = await RecursiveLearningEngine.recordInteractionEvent(profile, upItem1, 'upvote');
      profile = resUp1.updatedProfile;
      let state = await RecursiveLearningEngine.getEngineState();
      assert.equal(state.domainTrustScores['bright-essays.org'], 1.18, 'Single upvote must boost domain trust by +0.18');

      // Apply 5 more upvotes on distinct items to verify 1.85 cap
      for (let i = 2; i <= 7; i++) {
        const nextItem = makeFeedItem(`taste-up-${i}`, {
          sourceDomain: 'bright-essays.org',
          canonicalUrl: `https://bright-essays.org/essay-${i}`,
          sourceReferences: [
            {
              publisher: 'Bright Essays',
              originalUrl: `https://bright-essays.org/essay-${i}`,
              title: `Essay ${i}`,
              publicationTimestamp: new Date().toISOString(),
              retrievalTimestamp: new Date().toISOString(),
              isVerified: true
            }
          ]
        });
        const r = await RecursiveLearningEngine.recordInteractionEvent(profile, nextItem, 'upvote');
        profile = r.updatedProfile;
      }
      state = await RecursiveLearningEngine.getEngineState();
      assert.equal(state.domainTrustScores['bright-essays.org'], 1.85, 'Repeated upvotes must cap domain trust at 1.85');

      // 4b. Downvote penalty -0.22 per distinct item, floored at 0.3
      const downItem1 = makeFeedItem('taste-down-1', {
        sourceDomain: 'noisy-wire.net',
        canonicalUrl: 'https://noisy-wire.net/item-1',
        sourceReferences: [
          {
            publisher: 'Noisy Wire',
            originalUrl: 'https://noisy-wire.net/item-1',
            title: 'Noise 1',
            publicationTimestamp: new Date().toISOString(),
            retrievalTimestamp: new Date().toISOString(),
            isVerified: true
          }
        ]
      });

      const resDown1 = await RecursiveLearningEngine.recordInteractionEvent(profile, downItem1, 'downvote');
      profile = resDown1.updatedProfile;
      state = await RecursiveLearningEngine.getEngineState();
      assert.equal(state.domainTrustScores['noisy-wire.net'], 0.78, 'Single downvote must lower domain trust by -0.22');

      for (let i = 2; i <= 6; i++) {
        const nextDown = makeFeedItem(`taste-down-${i}`, {
          sourceDomain: 'noisy-wire.net',
          canonicalUrl: `https://noisy-wire.net/item-${i}`,
          sourceReferences: [
            {
              publisher: 'Noisy Wire',
              originalUrl: `https://noisy-wire.net/item-${i}`,
              title: `Noise ${i}`,
              publicationTimestamp: new Date().toISOString(),
              retrievalTimestamp: new Date().toISOString(),
              isVerified: true
            }
          ]
        });
        const r = await RecursiveLearningEngine.recordInteractionEvent(profile, nextDown, 'downvote');
        profile = r.updatedProfile;
      }
      state = await RecursiveLearningEngine.getEngineState();
      assert.equal(state.domainTrustScores['noisy-wire.net'], 0.3, 'Repeated downvotes must floor domain trust at 0.3');

      // 4c. muteSourceDomain sets 0.1 persisted in storage and sharply lowers scoreFeedItem
      const candidateToMute = makeFeedItem('taste-mute-check', {
        sourceDomain: 'spam-clickbait.de',
        canonicalUrl: 'https://www.spam-clickbait.de/story/99',
        sourceReferences: [
          {
            publisher: 'Spam Clickbait',
            originalUrl: 'https://www.spam-clickbait.de/story/99',
            title: 'Story 99',
            publicationTimestamp: new Date().toISOString(),
            retrievalTimestamp: new Date().toISOString(),
            isVerified: true
          }
        ]
      });

      const unmutedScore = scoreFeedItem(candidateToMute, DEFAULT_USER_PROFILE, {});
      await RecursiveLearningEngine.muteSourceDomain('https://www.Spam-Clickbait.de/story/99');

      const reloadedState = await RecursiveLearningEngine.getEngineState();
      assert.equal(
        reloadedState.domainTrustScores['spam-clickbait.de'],
        0.1,
        'muteSourceDomain must normalize domain, set trust to 0.1, and persist in appStorage'
      );

      const mutedScore = scoreFeedItem(candidateToMute, DEFAULT_USER_PROFILE, {});
      assert.ok(
        mutedScore.score < unmutedScore.score * 0.35,
        `Muted source score (${mutedScore.score}) must be sharply reduced vs unmuted score (${unmutedScore.score})`
      );

      // 4d. FeedCard.tsx inline upvote confirmation & 1-click mute action check
      const feedCardSrc = fs.readFileSync(path.join(ROOT_DIR, 'src/ui/components/FeedCard.tsx'), 'utf8');
      assert.ok(
        feedCardSrc.includes('✓ Gemerkt · Mehr von ${publisherName} & ${spaceName}'),
        'FeedCard.tsx must display inline upvote taste confirmation banner'
      );
      assert.ok(
        feedCardSrc.includes('RecursiveLearningEngine.muteSourceDomain(domainToMute)') &&
          feedCardSrc.includes('handleMuteSource') &&
          feedCardSrc.includes('stummschalten'),
        'FeedCard.tsx must provide 1-click source mute wired to RecursiveLearningEngine.muteSourceDomain'
      );

      await RecursiveLearningEngine.resetState();
    }
  );

  await t.test(
    'Case 5 (#6 & #10): FeedScreen.tsx contract check for non-blocking bloom_checkpoint (every 12 articles), preloadUpcomingFeedImages, isEagerImage, scoredItemCacheRef & Web FlatList tuning',
    () => {
      const feedScreenSrc = fs.readFileSync(path.join(ROOT_DIR, 'src/features/feed/FeedScreen.tsx'), 'utf8');

      // Non-blocking bloom_checkpoint every 12 articles with Nach oben + Heute-Überblick
      assert.ok(
        feedScreenSrc.includes("kind: 'bloom_checkpoint'") &&
          feedScreenSrc.includes('articleCount % 12 === 0'),
        'FeedScreen.tsx must insert non-blocking bloom_checkpoint rows every 12 articles'
      );
      assert.ok(
        feedScreenSrc.includes('Nach oben') && feedScreenSrc.includes('Heute-Überblick'),
        'bloom_checkpoint must offer calm Nach oben and Heute-Überblick actions'
      );

      // Lookahead preloader & eager image window
      assert.ok(
        feedScreenSrc.includes("import { preloadUpcomingFeedImages } from '../../core/utils/imagePreloader'") &&
          feedScreenSrc.includes('preloadUpcomingFeedImages(urls, 6)'),
        'FeedScreen.tsx must import and invoke preloadUpcomingFeedImages'
      );
      assert.ok(
        feedScreenSrc.includes('isEagerImage={row.cardIndex < 10}'),
        'FeedScreen.tsx must pass isEagerImage={row.cardIndex < 10} to FeedCard'
      );

      // Channel/Sort Speed Diet: scoredItemCacheRef + Web FlatList tuning
      assert.ok(
        feedScreenSrc.includes('const scoredItemCacheRef = React.useRef'),
        'FeedScreen.tsx must maintain scoredItemCacheRef to avoid redundant scoring on sort/channel switches'
      );
      assert.ok(
        feedScreenSrc.includes('initialNumToRender={6}') &&
          feedScreenSrc.includes('maxToRenderPerBatch={3}') &&
          feedScreenSrc.includes('windowSize={9}'),
        'FeedScreen.tsx must configure Web FlatList with initialNumToRender={6}, maxToRenderPerBatch={3}, windowSize={9}'
      );
    }
  );
});
