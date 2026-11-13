import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import { applyScrollFreeze } from '../src/core/feed/feedPresentation';
import { defaultFeedOperationManager } from '../src/core/feed/FeedOperationManager';
import { FeedMergeService } from '../src/core/feed/FeedMergeService';
import { INITIAL_FIXTURES, DEFAULT_USER_PROFILE } from '../src/core/data/fixtures';
import { AtemStorage, MemoryStorageDriver } from '../src/core/data/storage';
import { BatchEditionEnricher } from '../src/core/enrichment/batchEnricher';
import { EnrichmentUsageLedger } from '../src/core/enrichment/ledger';
import { EnrichmentCache, StorageDriverCacheStorage } from '../src/core/enrichment/cache';
import {
  HivemindLearningService,
  HIVEMIND_TRACKS_STORAGE_KEY,
  buildShowcaseStarterTracks,
  SHOWCASE_STARTER_TRACK_IDS
} from '../src/core/learning/hivemindLearningService';
import { runInPlaceDataMigration } from '../src/core/data/migrationService';
import { sortFeedForDisplay, isHivemindLearningCard, scoreFeedItem } from '../src/core/domain/ranking';

describe('Live Test UX & AI Editorial Upgrades v7.0', () => {
  it('1. Smart Arrivals Banner: infinite-scroll tail pagination does not inflate queuedArrivals while true top arrivals do, and reset clears cleanly', () => {
    const baseItems = Array.from({ length: 12 }, (_, idx) => ({ id: `art-${idx + 1}`, title: `Article ${idx + 1}` }));
    const tailAppendedItems = [
      ...baseItems,
      ...Array.from({ length: 20 }, (_, idx) => ({ id: `art-${idx + 13}`, title: `Article ${idx + 13}` }))
    ];

    // Case A: User is scrolled down (450px > 80px) and infinite scroll loads 20 more items below
    const paginationFreeze = applyScrollFreeze(baseItems, tailAppendedItems, 450, [], 80);
    assert.equal(
      paginationFreeze.queuedArrivals.length,
      0,
      'Infinite scroll tail appends must NEVER be miscounted as new redaktion arrivals'
    );
    assert.equal(paginationFreeze.items.length, 32, 'Tail appends extend smoothly below rendered items');

    // Case B: Genuine new top arrival appears at index 0 while scrolled down (450px)
    const topArrival = { id: 'new-top-99', title: 'Echte Top-Meldung' };
    const withTopArrival = [topArrival, ...tailAppendedItems];
    const topFreeze = applyScrollFreeze(paginationFreeze.items, withTopArrival, 450, [], 80);
    assert.equal(topFreeze.queuedArrivals.length, 1);
    assert.equal(topFreeze.queuedArrivals[0].id, 'new-top-99');
    assert.equal(topFreeze.items[0].id, 'art-1', 'Visible viewport stays frozen at art-1 until banner click');

    // Case C: Clicking banner resets scrollOffsetY to 0 and clears queuedArrivals immediately
    const revealed = applyScrollFreeze(topFreeze.items, withTopArrival, 0, topFreeze.queuedArrivals, 80);
    assert.equal(revealed.queuedArrivals.length, 0, 'Queued arrivals must clear immediately on scroll to top');
    assert.equal(revealed.items[0].id, 'new-top-99', 'New top arrival appears first after reveal');
  });

  it('2. Operation Telemetry Isolation & Real Gemini AI Gatekeeper Execution (durationMs, modelUsed, rejectedCount)', async () => {
    // 2a. FeedOperationManager keeps concurrent operation duration intact across background_sync
    const manualOp = defaultFeedOperationManager.startOperation('manual_refresh', 'op-manual-test-v7');
    const existing = INITIAL_FIXTURES.slice(0, 2);

    // Simulate background_sync arriving in the middle of a manual research operation
    FeedMergeService.merge(existing, [INITIAL_FIXTURES[2]], {
      operationType: 'background_sync',
      pinInserted: false
    });

    // Complete manual_refresh with explicit elapsed duration
    const completedManual = FeedMergeService.merge(existing, [INITIAL_FIXTURES[3]], {
      operationType: 'manual_refresh',
      operationId: manualOp.operationId,
      telemetry: {
        candidateCount: 15,
        approvedCount: 1,
        rejectedCount: 14,
        duplicateCount: 0,
        usedAI: true,
        usedFallback: false,
        cacheHits: 0,
        modelUsed: 'gemini-2.5-flash',
        durationMs: 1850
      }
    }).operationResult;

    assert.equal(completedManual.operationId, 'op-manual-test-v7');
    assert.ok((completedManual.durationMs || 0) >= 1850, 'Manual research durationMs must never collapse to 0.0s');
    assert.equal(completedManual.usedAI, true);
    assert.equal(completedManual.modelUsed, 'gemini-2.5-flash');
    assert.equal(completedManual.rejectedCount, 14);

    // 2b. BatchEditionEnricher handles markdown-fenced JSON from Gemini and rejects score < 7 candidates
    const storage = new AtemStorage(new MemoryStorageDriver());
    const ledger = new EnrichmentUsageLedger(undefined, false);
    const cache = new EnrichmentCache<unknown>(
      undefined,
      undefined,
      new StorageDriverCacheStorage<unknown>(storage, '@atem:test_batch_cache:v7')
    );
    const enricher = new BatchEditionEnricher(ledger, undefined, cache);

    const candApprove = {
      ...INITIAL_FIXTURES[0],
      id: 'ai-cand-approve',
      title: 'Kants kopernikanische Wende in der Erkenntnistheorie neu gedeutet',
      feedText: 'Ursprünglicher Roh-Teaser aus dem Feed.'
    };
    const candReject = {
      ...INITIAL_FIXTURES[1],
      id: 'ai-cand-reject',
      title: 'Top 10 Black-Friday Rabatte für Schreibtischlampen',
      feedText: 'Hier sparen Sie heute bis zu 40 Prozent auf alle LED-Lampen im Online-Shop.'
    };

    const originalFetch = global.fetch;
    try {
      global.fetch = async (url: any) => {
        const u = String(url);
        if (u.includes('/v1beta/models?')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              models: [{ name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] }]
            })
          } as any;
        }
        const aiDecisions = [
          {
            id: 'ai-cand-approve',
            curationScore: 9,
            rejectionReason: '',
            feedText: 'Wie Kant die Erkenntnistheorie vom passiven Abbilden auf die aktive Strukturierung durch Vernunftbegriffe umstellt.',
            keyInsight: 'Erkenntnis richtet sich nach dem Subjekt, nicht umgekehrt.',
            counterPerspective: 'Kritiker aus dem Spekulativen Realismus wenden ein, dass diese Perspektive die Eigenwirklichkeit von Objekten jenseits menschlicher Anschauungsformen ausblendet.',
            primaryTopic: 'philosophy_ethics',
            topics: ['philosophy_ethics'],
            didacticTransfer: ''
          },
          {
            id: 'ai-cand-reject',
            curationScore: 2,
            rejectionReason: 'Shopping-Deal / Affiliate ohne intellektuellen Gehalt',
            feedText: '',
            keyInsight: '',
            counterPerspective: '',
            primaryTopic: 'tech',
            topics: ['tech'],
            didacticTransfer: ''
          }
        ];
        return {
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [
              {
                content: {
                  parts: [{ text: '```json\n' + JSON.stringify(aiDecisions) + '\n```' }]
                },
                finishReason: 'STOP'
              }
            ],
            usageMetadata: { promptTokenCount: 180, candidatesTokenCount: 110 }
          })
        } as any;
      };

      const curated = await enricher.gatekeepAndEnrichBatch([candApprove, candReject], {
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        apiKey: 'AIzaTestKeyForUnitTestsOnly123456',
        persistApiKey: true
      });
      const report = enricher.getLastBatchReport();

      assert.equal(report.usedAI, true, 'Enricher must mark usedAI=true');
      assert.equal(report.usedFallback, false, 'Enricher must not fall back on valid Gemini response');
      assert.ok(report.modelUsed?.includes('gemini-2.5-flash'), 'Must report actual resolved Gemini model');
      assert.equal(report.approvedCount, 1);
      assert.equal(report.rejectedCount, 1, 'Gatekeeper must count score < 7 rejection in rejectedCount');
      assert.equal(curated.length, 1);
      assert.equal(curated[0].id, 'ai-cand-approve');
      assert.ok(curated[0].feedText.includes('Kant'), 'Approved card must carry AI-refined feedText');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('3. Demo Hivemind Tracks removed cleanly & Heute tab strictly excludes all Hivemind learning cards', async () => {
    const storage = new AtemStorage(new MemoryStorageDriver());
    const service = new HivemindLearningService();
    const demoTracks = buildShowcaseStarterTracks();
    assert.ok(SHOWCASE_STARTER_TRACK_IDS.has('track-roman-republic-empire'));
    assert.ok(SHOWCASE_STARTER_TRACK_IDS.has('track-quantum-reality'));

    const userTrack = {
      ...demoTracks[0],
      id: 'track-user-dresden-didaktik',
      title: 'Ethikunterricht in der Oberstufe',
      items: demoTracks[0].items.map((it, idx) => ({
        ...it,
        id: `user-didaktik-${idx + 1}`,
        hivemindMeta: it.hivemindMeta ? { ...it.hivemindMeta, trackId: 'track-user-dresden-didaktik' } : undefined
      }))
    };

    await storage.setItem(HIVEMIND_TRACKS_STORAGE_KEY, JSON.stringify([...demoTracks, userTrack]));
    await runInPlaceDataMigration(storage);

    const remainingTracks = await service.getTracks(storage);
    assert.equal(remainingTracks.length, 1, 'Migration must remove demo Rome/Quantum tracks while preserving user tracks');
    assert.equal(remainingTracks[0].id, 'track-user-dresden-didaktik');

    // Check that sortFeedForDisplay(..., 'today') strictly excludes Hivemind learning cards
    const recentIso = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
    const learningCard = {
      ...userTrack.items[0],
      publishedAt: recentIso,
      pinnedManualRunAt: Date.now(),
      publicationDateReliable: true
    };
    const newsCard = {
      ...INITIAL_FIXTURES[0],
      id: 'fresh-news-today-1',
      title: 'Aktuelle Bildungsstudie aus Europa veröffentlicht',
      publishedAt: recentIso,
      publicationDateReliable: true,
      hivemindMeta: undefined,
      memeMeta: undefined,
      factReviewStatus: 'public_news' as const,
      space: 'c/science'
    };

    assert.equal(isHivemindLearningCard(learningCard), true);
    assert.equal(isHivemindLearningCard(newsCard), false);

    const scoredPool = [learningCard, newsCard].map(item => scoreFeedItem(item, DEFAULT_USER_PROFILE, {}));
    const todayRanked = sortFeedForDisplay(scoredPool, 'today', { pinnedIds: [learningCard.id] });

    assert.equal(
      todayRanked.some(item => isHivemindLearningCard(item)),
      false,
      '⚡ Heute tab must strictly exclude all Hivemind learning cards even when recently published or pinned'
    );
    assert.ok(todayRanked.some(item => item.id === 'fresh-news-today-1'));
  });

  it('4. Clean UI Invariants: no duplicate Hivemind/Pipeline toolbar buttons, single arrow banner, single Hivemind track badge, decluttered sidebar', () => {
    const rootDir = path.resolve(__dirname, '..');
    const feedScreenSrc = fs.readFileSync(path.join(rootDir, 'src/features/feed/FeedScreen.tsx'), 'utf8');
    const bannerSrc = fs.readFileSync(path.join(rootDir, 'src/ui/components/FeedOperationBanner.tsx'), 'utf8');
    const cardSrc = fs.readFileSync(path.join(rootDir, 'src/ui/components/FeedCard.tsx'), 'utf8');
    const sidebarSrc = fs.readFileSync(path.join(rootDir, 'src/ui/components/DesktopSidebar.tsx'), 'utf8');
    const reportModalSrc = fs.readFileSync(path.join(rootDir, 'src/ui/components/FeedOperationReportModal.tsx'), 'utf8');

    // FeedScreen: no duplicate toolbar buttons & no inline arrivals container with double arrow
    assert.equal(feedScreenSrc.includes('Pipeline-Einblick'), false, 'Pipeline-Einblick button must be removed');
    assert.equal(
      /styles\.sortTab[\s\S]{0,400}Lernen \(Hivemind\)/.test(feedScreenSrc),
      false,
      'Duplicate Lernen (Hivemind) button in the second sort toolbar must be removed'
    );
    assert.equal(
      feedScreenSrc.includes('Lernen (Hivemind)'),
      true,
      'Single header Lernen (Hivemind) pill must remain preserved'
    );
    assert.equal(feedScreenSrc.includes('inlineArrivalsContainer'), false, 'Duplicate inline arrivals container must be removed');
    assert.ok(
      feedScreenSrc.includes("sortMode === 'today' && isHivemindLearningCard"),
      'FeedScreen must filter out Hivemind cards when sortMode === today'
    );

    // FeedOperationBanner: single arrow icon, no trailing ↑ arrow duplicate
    assert.equal(bannerSrc.includes('anzeigen ↑'), false, 'Floating pill text must not repeat trailing ↑ arrow');
    assert.ok(bannerSrc.includes('neue Beiträge aus der Redaktion anzeigen'));

    // FeedCard: hides grey publisherText when hivemindTrackId is set so track title appears only once
    assert.ok(cardSrc.includes('{!hivemindTrackId && ('), 'FeedCard must omit duplicate publisherText on Hivemind cards');

    // DesktopSidebar: technical pool/source counters & health button removed
    assert.equal(sidebarSrc.includes('Im Pool'), false, 'Sidebar must not display "Im Pool" counter');
    assert.equal(sidebarSrc.includes('Quellen live'), false, 'Sidebar must not display "Quellen live" counter');
    assert.equal(sidebarSrc.includes('Quellen-Katalog & Health'), false, 'Sidebar must not display health catalog button');
    assert.equal(sidebarSrc.includes('AKTIVE QUELLEN'), false, 'Sidebar must not display "AKTIVE QUELLEN" badge');

    // FeedOperationReportModal: displays model name when usedAI is true
    assert.ok(
      reportModalSrc.includes("`Ja (${result.modelUsed || 'Gemini'})`"),
      'FeedOperationReportModal must report Ja (<model>) when AI was used'
    );
  });
});
