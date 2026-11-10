import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';
import { applyInitialViewportLock } from '../src/core/feed/feedPresentation';
import {
  areFeedCardPropsEqual,
  computeOptimisticVoteState
} from '../src/core/domain/ranking';
import { SourceOnlyEnricher } from '../src/core/enrichment/enricher';
import { normalizeFeedEntry } from '../src/core/ingestion/normalizer';
import { runBackgroundEditorialNewsroomBatch } from '../src/core/enrichment/batchEnricher';
import {
  generateHivemindLearningTrack,
  generateNextHivemindChapter
} from '../src/core/learning/hivemindLearningService';
import { AtemStorage, MemoryStorageDriver } from '../src/core/data/storage';
import { INITIAL_FIXTURES } from '../src/core/data/fixtures';
import { PersistentArticleStore } from '../src/core/feed/PersistentArticleStore';

describe('Master Architectural Upgrade v6.0 — Zero-Flicker Boot, 60fps UI, Pure Text & Multi-Chapter Hivemind', () => {
  afterEach(() => {
    mock.restoreAll();
  });

  it('1. locks initial viewport order at scrollOffsetY = 0 so background arrivals never reorder top cards on boot', () => {
    const initialCards = [
      { id: 'card-1', title: 'Erste Karte' },
      { id: 'card-2', title: 'Zweite Karte' },
      { id: 'card-3', title: 'Dritte Karte' }
    ];

    // Frame 1 at scrollOffsetY === 0: commits initial viewport order
    const frame1 = applyInitialViewportLock([], false, initialCards, [], 12);
    assert.equal(frame1.hasCommittedInitialViewport, true);
    assert.deepEqual(frame1.lockedOrderIds, ['card-1', 'card-2', 'card-3']);
    assert.deepEqual(frame1.orderedItems.map(c => c.id), ['card-1', 'card-2', 'card-3']);
    assert.equal(frame1.queuedArrivals.length, 0);

    // Frame 2 (background snapshot / live harvest arrives while user is still at scrollOffsetY === 0):
    const backgroundIncoming = [
      { id: 'bg-new-1', title: 'Hintergrund-Neuankömmling 1' },
      { id: 'card-2', title: 'Zweite Karte (aktualisiert)' },
      { id: 'card-1', title: 'Erste Karte' },
      { id: 'card-3', title: 'Dritte Karte' }
    ];

    const frame2 = applyInitialViewportLock(
      frame1.lockedOrderIds,
      frame1.hasCommittedInitialViewport,
      backgroundIncoming,
      frame1.queuedArrivals,
      12
    );

    // Top viewport order remains strictly ['card-1', 'card-2', 'card-3'], and 'bg-new-1' is queued in queuedArrivals!
    assert.deepEqual(frame2.orderedItems.map(c => c.id), ['card-1', 'card-2', 'card-3']);
    assert.equal(frame2.orderedItems[1].title, 'Zweite Karte (aktualisiert)');
    assert.deepEqual(frame2.queuedArrivals.map(c => c.id), ['bg-new-1']);
  });

  it('2. upvoting updates card state synchronously in 0ms without triggering unrelated card re-renders', () => {
    const baseItem = { ...INITIAL_FIXTURES[0], finalScore: 0.9, matchReason: 'Top' } as any;
    const { nextInteractions, nextItems } = computeOptimisticVoteState({}, [baseItem], baseItem.id, 'up');
    assert.equal(nextInteractions[baseItem.id]?.voteScore, 1);
    assert.equal(nextItems[0].id, baseItem.id);
    const prevProps = {
      item: baseItem,
      interaction: {
        itemId: baseItem.id,
        saved: false,
        progressPercent: 0,
        furthestPositionPercent: 0,
        isFavorite: false,
        feedback: 'neutral' as const,
        userNotes: [],
        voteScore: 0
      },
      isHero: false,
      isFocused: false,
      isExpanded: false,
      isDark: true,
      hivemindTrackProgressPercent: 0,
      isHivemindStepCompleted: false
    };

    // Unrelated card props remain strictly equal under React.memo comparator
    assert.equal(areFeedCardPropsEqual(prevProps, { ...prevProps }), true);
    // Upvoted card re-renders immediately
    assert.equal(
      areFeedCardPropsEqual(prevProps, {
        ...prevProps,
        interaction: { ...prevProps.interaction, voteScore: 1 }
      }),
      false
    );
  });

  it('3. eradicates all synthetic filler phrases in SourceOnlyEnricher, normalizeFeedEntry, and PersistentArticleStore', async () => {
    const enricher = new SourceOnlyEnricher();
    const res = await enricher.enrich({ item: INITIAL_FIXTURES[0] });

    const forbiddenPhrases = [
      'In diesem Beitrag zu',
      'Dieser philosophische Diskurs',
      'Im Zentrum steht die erkenntnistheoretische',
      'Ein neuer Beitrag aus',
      'Originalbeitrag veröffentlicht bei'
    ];

    for (const phrase of forbiddenPhrases) {
      assert.equal(res.feedText.includes(phrase), false, `SourceOnlyEnricher must not emit "${phrase}"`);
    }

    const normalized = normalizeFeedEntry(
      {
        id: 'raw-1',
        sourceId: 'dlf-wissenschaft',
        title: 'Neue Erkenntnisse zur Quantenkohärenz in biologischen Systemen',
        link: 'https://www.deutschlandfunk.de/quantenkohaerenz-100.html',
        publishedAt: new Date().toISOString(),
        summary: ''
      },
      {
        id: 'dlf-wissenschaft',
        name: 'Deutschlandfunk Wissenschaft',
        url: 'https://www.deutschlandfunk.de/wissenschaft.rss',
        primaryTopic: 'science_society',
        topics: ['science_society'],
        language: 'de',
        defaultEvidenceTier: 'publisher_excerpt'
      }
    );
    assert.equal(normalized.feedText.includes('Originalbeitrag veröffentlicht bei'), false);

    // PersistentArticleStore strips synthetic filler and drops un-enriched <80 char stubs
    const storage = new AtemStorage(new MemoryStorageDriver());
    const store = new PersistentArticleStore(storage);
    const shortStub = {
      ...INITIAL_FIXTURES[0],
      id: 'stub-short-1',
      aiAssisted: false,
      feedText: 'Zu kurzer Stub.',
      body: 'Zu kurzer Stub.',
      articleBody: 'Zu kurzer Stub.'
    };
    const substantiveCard = {
      ...INITIAL_FIXTURES[0],
      id: 'substantive-card-1',
      feedText:
        'Die Max-Planck-Gesellschaft präsentiert neue experimentelle Daten zur Quantenverschränkung in supraleitenden Schaltkreisen. In diesem Beitrag zu „test-slug.html“ werden die zentralen Thesen und Hintergründe systematisch aufgeschlüsselt.',
      body:
        'Die Max-Planck-Gesellschaft präsentiert neue experimentelle Daten zur Quantenverschränkung in supraleitenden Schaltkreisen und zeigt präzise Dekohärenz-Grenzen auf.'
    };

    await store.saveArticles([shortStub, substantiveCard]);
    const loaded = await store.loadArticles();
    assert.equal(loaded.some(i => i.id === 'stub-short-1'), false, 'Short un-enriched stub must be filtered out');
    const cleaned = loaded.find(i => i.id === 'substantive-card-1');
    assert.ok(cleaned);
    assert.equal(cleaned.feedText.includes('In diesem Beitrag zu'), false);
  });

  it('4. generateNextHivemindChapter appends 12 new cards and advances multi-chapter progress', async () => {
    const storage = new AtemStorage(new MemoryStorageDriver());
    const track = await generateHivemindLearningTrack({
      titleOrTopic: 'Quantenphysik & Realität',
      sourceType: 'book',
      storage,
      skipNetworkFetch: true
    });

    assert.equal(track.items.length, 12);
    assert.ok(Array.isArray(track.chapters) && track.chapters.length >= 4);
    assert.equal(track.chapters![0].isGenerated, true);
    assert.equal(track.chapters![1].isGenerated, false);

    const expanded = await generateNextHivemindChapter(track.id, {
      storage,
      skipNetworkFetch: true
    });

    assert.equal(expanded.items.length, 24);
    assert.equal(expanded.totalItemsCount, 24);
    assert.equal(expanded.currentChapterIndex, 2);
    assert.equal(expanded.chapters![1].isGenerated, true);
    assert.equal(expanded.items[12].hivemindMeta?.stepIndex, 13);
    assert.equal(expanded.items[23].hivemindMeta?.stepIndex, 24);
    assert.equal(expanded.items[23].hivemindMeta?.totalSteps, 24);
  });

  it('5. Autonomous AI Editorial Newsroom worker enriches un-enriched articles in batches of 4', async () => {
    const unEnriched = {
      ...INITIAL_FIXTURES[0],
      id: 'raw-newsroom-1',
      aiAssisted: false,
      feedText: 'Kurzer RSS-Auszug über neue Entwicklungen in der Erkenntnistheorie und KI-Forschung an deutschen Universitäten.'
    };

    mock.method(globalThis, 'fetch', async () => {
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      articles: [
                        {
                          id: 'raw-newsroom-1',
                          feedText:
                            'Wissenschaftler an deutschen Universitäten untersuchen, wie große Sprachmodelle epistemische Rechtfertigung verändern. Im Mittelpunkt steht der Unterschied zwischen statistischer Mustererkennung und begründetem Wissen. Während klassische Erkenntnistheorie wahre, gerechtfertigte Überzeugungen voraussetzt, operieren neuronale Netze über hochdimensionale Wahrscheinlichkeitsverteilungen. Die Studie zeigt konkrete Konsequenzen für Forschung und Unterricht auf.',
                          body:
                            '### Kernaussage & Befund\n\nWissenschaftler an deutschen Universitäten untersuchen, wie große Sprachmodelle epistemische Rechtfertigung verändern.\n\n### Wissenschaftliche Einordnung\n\nWährend klassische Erkenntnistheorie wahre, gerechtfertigte Überzeugungen voraussetzt, operieren neuronale Netze über hochdimensionale Wahrscheinlichkeitsverteilungen.\n\n### Kritische Perspektive\n\nFür die akademische Praxis bedeutet dies, dass algorithmische Kohärenz niemals mit empirischer Evidenz verwechselt werden darf.',
                          keyInsight: 'Statistische Sprachkohärenz ersetzt keine epistemische Rechtfertigung durch Primärquellen.',
                          quiz: {
                            question: 'Worin liegt der zentrale Unterschied zwischen menschlichem Wissen und Sprachmodell-Ausgaben laut der Analyse?',
                            options: [
                              'In der epistemischen Rechtfertigung gegenüber bloßer statistischer Wahrscheinlichkeit',
                              'In der Rechengeschwindigkeit von Siliziumchips',
                              'In der Anzahl gespeicherter Wörterbücher',
                              'Im Stromverbrauch der Server'
                            ],
                            correctIndex: 0,
                            explanation: 'Sprachmodelle berechnen Token-Wahrscheinlichkeiten ohne eigenes Wahrheits- oder Rechtfertigungsverständnis.'
                          }
                        }
                      ]
                    })
                  }
                ]
              },
              finishReason: 'STOP'
            }
          ],
          usageMetadata: { promptTokenCount: 250, candidatesTokenCount: 320 }
        }),
        { status: 200 }
      );
    });

    const result = await runBackgroundEditorialNewsroomBatch([unEnriched], {
      batchSize: 4,
      credentials: {
        provider: 'gemini',
        apiKey: 'fake-newsroom-key',
        model: 'gemini-2.5-flash'
      }
    });

    assert.equal(result.usedAI, true);
    assert.equal(result.processedCount, 1);
    assert.equal(result.enrichedItems[0].aiAssisted, true);
    assert.ok(result.enrichedItems[0].feedText.length >= 200);
    assert.ok(result.enrichedItems[0].body.includes('### Kernaussage'));
    assert.ok(result.enrichedItems[0].quiz);
    assert.equal(result.enrichedItems[0].quiz?.options.length, 4);
  });
});
