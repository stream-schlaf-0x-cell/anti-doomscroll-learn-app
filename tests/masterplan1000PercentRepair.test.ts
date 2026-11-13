import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  DEFAULT_GEMINI_MODEL,
  DEFAULT_OPENROUTER_MODEL,
  DEFAULT_GEMINI_TEXT_MODEL,
  findGeminiModel,
  callAiWithGoogleSearch,
  saveAiCredentials,
  loadAiCredentials
} from '../src/core/ai/atmenAiClient';
import {
  CURRENT_DATA_MIGRATION_VERSION,
  runInPlaceDataMigration
} from '../src/core/data/migrationService';
import { LocalFeedRepository } from '../src/core/data/feedRepository';
import { MemoryStorageDriver, AtemStorage } from '../src/core/data/storage';
import {
  hivemindLearningService,
  isDeprecatedShowcaseStarterItem
} from '../src/core/learning/hivemindLearningService';
import {
  sanitizeCuratedFeedItem,
  stripPublisherBoilerplate
} from '../src/core/enrichment/batchEnricher';
import {
  rankBloomScrollFeed,
  interleaveSerendipitySlot,
  sortFeedForDisplay,
  scoreFeedItem
} from '../src/core/domain/ranking';
import { DEFAULT_USER_PROFILE } from '../src/core/data/fixtures';
import { REAL_KNOWLEDGE_VAULT } from '../src/core/data/realKnowledgeVault';
import { FeedItem } from '../src/core/domain/types';
import { OpenWebHarvester } from '../src/core/ingestion/openWebHarvester';

function makeArticle(id: string, overrides: Partial<FeedItem> = {}): FeedItem {
  const nowIso = new Date().toISOString();
  return {
    id,
    type: 'deep_dive',
    format: 'sourced_update',
    title: overrides.title || `Analyse zu ${id}`,
    subtitle: overrides.subtitle || 'Spektrum • Redaktion',
    feedText:
      overrides.feedText ||
      'Ausführliche wissenschaftliche und philosophische Analyse zu aktuellen Fragen von Erkenntnis, Bildung und technischer Entwicklung mit konkreten Belegen.',
    articleBody:
      overrides.articleBody ||
      'Ausführliche wissenschaftliche und philosophische Analyse zu aktuellen Fragen von Erkenntnis, Bildung und technischer Entwicklung. Zweiter Absatz mit belastbaren Quellen und differenzierter Einordnung.',
    body: overrides.body || 'Ausführliche wissenschaftliche und philosophische Analyse mit Quellen.',
    topics: overrides.topics || ['philosophy_ethics', 'science_society'],
    primaryTopic: overrides.primaryTopic || 'philosophy_ethics',
    sourceReferences: overrides.sourceReferences || [
      {
        title: `Quelle ${id}`,
        publisher: 'Spektrum der Wissenschaft',
        originalUrl: `https://example.org/${id}`,
        retrievalTimestamp: nowIso,
        isVerified: true
      }
    ],
    publishedAt: overrides.publishedAt || nowIso,
    publicationDateReliable: true,
    firstSeenAt: nowIso,
    generatedAt: nowIso,
    estimatedReadingMinutes: 4,
    relevanceExplanation: 'Relevanter Impuls für Philosophie und Bildung.',
    contentStatus: 'editorial_briefing',
    isDailyEdition: false,
    editionDate: nowIso.slice(0, 10),
    isTeachingRelated: false,
    isChallengingPerspective: false,
    isDemonstration: false,
    aiAssisted: false,
    factReviewStatus: 'public_news',
    provenanceSummary: 'Qualitätsquelle',
    wordCount: 160,
    evidenceTier: 'publisher_excerpt',
    contentOrigin: 'live_ingested',
    contentHash: `hash-${id}`,
    canonicalUrl: overrides.canonicalUrl || `https://example.org/${id}`,
    hasAuthenticImage: false,
    space: overrides.space || 'c/dialektik',
    upvotesCount: 0,
    awardsCount: { gold: 0, brain: 0, spark: 0 },
    sourceTrustLevel: 'verified_creator',
    sourceDomain: overrides.sourceDomain || 'example.org',
    sourceBroadcasterName: 'Spektrum',
    comments: [],
    ...overrides
  };
}

describe('Masterplan 1000%-Reparatur: Alle 6 Säulen', () => {
  it('Säule 1: Entfernt Rom & Quantenphysik rückstandslos aus @atem:dynamic_items:v1, Migration und FeedRepository', async () => {
    const storage = new AtemStorage(new MemoryStorageDriver());
    const repo = new LocalFeedRepository(storage);

    const romanCard = makeArticle('hivemind-track-roman-republic-empire-step-1', {
      title: 'Das Paradox der Römischen Republik: Sieg nach außen, Zerfall im Inneren',
      space: 'c/hivemind',
      hivemindMeta: {
        trackId: 'track-roman-republic-empire',
        trackTitle: 'Aufstieg & Fall Roms (Marius bis Augustus)',
        stepIndex: 1,
        totalSteps: 12,
        cardArchetype: 'story_thread'
      }
    });
    const quantumCard = makeArticle('hivemind-track-quantum-reality-step-2', {
      title: 'Quantenphysik: Messung und Dekohärenz',
      space: 'c/hivemind',
      hivemindMeta: {
        trackId: 'track-quantum-reality',
        trackTitle: 'Quantenphysik',
        stepIndex: 2,
        totalSteps: 12,
        cardArchetype: 'story_thread'
      }
    });
    const realNews = makeArticle('real-news-dresden-1', {
      title: 'Neue Didaktik-Studie zur KI im Ethik-Unterricht in Sachsen'
    });

    await storage.setItem('@atem:dynamic_items:v1', JSON.stringify([romanCard, quantumCard, realNews]));
    await storage.setItem('@atem:feed_items:v1', JSON.stringify([romanCard, realNews]));
    await storage.setItem(
      '@atem:hivemind_tracks:v1',
      JSON.stringify([
        {
          id: 'track-roman-republic-empire',
          title: 'Aufstieg & Fall Roms',
          subtitle: 'Demo',
          topic: 'science_society',
          sourceType: 'topic',
          createdAt: new Date().toISOString(),
          itemIds: [romanCard.id],
          completedItemIds: [],
          totalSteps: 12
        }
      ])
    );

    const migrationResult = await runInPlaceDataMigration(storage, repo);
    assert.equal(migrationResult.version, CURRENT_DATA_MIGRATION_VERSION);

    const allRepoItems = repo.getAllItems();
    assert.equal(
      allRepoItems.some(i => isDeprecatedShowcaseStarterItem(i)),
      false,
      'FeedRepository darf keine Rom/Quanten-Starterkarten mehr enthalten'
    );
    assert.ok(allRepoItems.some(i => i.id === realNews.id), 'Echte Nutzer-/Live-Beiträge bleiben erhalten');

    // Re-hydrating a fresh repository instance from migrated storage must also stay clean
    const repoReloaded = new LocalFeedRepository(storage);
    await new Promise(resolve => setTimeout(resolve, 25));
    assert.equal(
      repoReloaded.getAllItems().some(i => isDeprecatedShowcaseStarterItem(i)),
      false,
      'Neu geladener Bestand aus dem Speicher darf keine Rom/Quanten-Starterkarten mehr enthalten'
    );

    const cleanedDynamicRaw = await storage.getItem('@atem:dynamic_items:v1');
    const cleanedDynamic: FeedItem[] = cleanedDynamicRaw ? JSON.parse(cleanedDynamicRaw) : [];
    assert.equal(cleanedDynamic.some(i => isDeprecatedShowcaseStarterItem(i)), false);

    const tracks = await hivemindLearningService.getTracks(storage);
    assert.equal(tracks.length, 0, 'Gelöschte Demo-Lernpfade dürfen nicht neu angelegt werden');
  });

  it('Säule 2: Setzt gemini-4-hydrogen als Standard und vermeidet HTTP-400 JSON-Konflikt bei Google-Search-Grounding', async () => {
    assert.equal(DEFAULT_GEMINI_MODEL, 'gemini-4-hydrogen');
    assert.equal(DEFAULT_GEMINI_TEXT_MODEL, 'gemini-4-hydrogen');
    assert.equal(DEFAULT_OPENROUTER_MODEL, 'google/gemini-4-hydrogen');
    const hydrogenEntry = findGeminiModel('gemini-4-hydrogen');
    assert.ok(hydrogenEntry && hydrogenEntry.recommended === true, 'gemini-4-hydrogen muss im Katalog empfohlen sein');

    const memStorage = new AtemStorage(new MemoryStorageDriver());
    await saveAiCredentials(
      { provider: 'gemini', apiKey: 'test-key-hydrogen-123456', model: 'gemini-4-hydrogen', persistApiKey: true },
      memStorage
    );
    const loadedCreds = await loadAiCredentials(memStorage);
    assert.equal(loadedCreds.persistApiKey, true);
    assert.equal(loadedCreds.apiKey, 'test-key-hydrogen-123456');

    const originalFetch = global.fetch;
    const capturedBodies: { tools?: unknown; generationConfig?: { responseMimeType?: string } }[] = [];
    global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const urlStr = typeof input === 'string' ? input : input.toString();
      if (urlStr.includes('/v1beta/models?')) {
        return new Response(
          JSON.stringify({
            models: [{ name: 'models/gemini-4-hydrogen', supportedGenerationMethods: ['generateContent'] }]
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (urlStr.includes(':generateContent') && init?.body) {
        capturedBodies.push(JSON.parse(String(init.body)));
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: { parts: [{ text: 'Aktuelle Erkenntnisse zur Bildungspolitik 2026.' }] },
                groundingMetadata: {
                  webSearchQueries: ['Bildungspolitik Sachsen 2026'],
                  groundingChunks: [
                    { web: { uri: 'https://www.spektrum.de/artikel/beispiel-1', title: 'spektrum.de' } },
                    { web: { uri: 'https://www.tagesschau.de/wissen/beispiel-2.html', title: 'tagesschau.de' } }
                  ]
                }
              }
            ],
            usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 80 }
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response('{}', { status: 404 });
    }) as typeof fetch;

    try {
      const res = await callAiWithGoogleSearch('Recherchiere Bildungspolitik.', {
        credentials: loadedCreds,
        timeoutMs: 8000
      });
      const capturedRequestBody = capturedBodies[0];
      assert.ok(capturedRequestBody, 'Request-Body muss gesendet worden sein');
      assert.deepEqual(capturedRequestBody.tools, [{ google_search: {} }]);
      assert.equal(
        capturedRequestBody.generationConfig?.responseMimeType,
        undefined,
        'tools: [{ google_search: {} }] darf NIEMALS mit responseMimeType: application/json kombiniert werden!'
      );
      assert.equal(res.modelUsed, 'gemini-4-hydrogen');
      assert.equal(res.groundingChunks?.length, 2);
      assert.equal(res.groundingChunks?.[0].uri, 'https://www.spektrum.de/artikel/beispiel-1');
      assert.deepEqual(res.webSearchQueries, ['Bildungspolitik Sachsen 2026']);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('Säule 3: Dual-Engine Live-Recherche rotiert Seiten, nutzt echte KI-Websuche + KI-Türsteher und verwirft Dünnschicht', async () => {
    const storage = new AtemStorage(new MemoryStorageDriver());
    const creds = {
      provider: 'gemini' as const,
      apiKey: 'test-dual-engine-key-999999',
      model: 'gemini-4-hydrogen',
      persistApiKey: true
    };
    const requestedOpenAlexUrls: string[] = [];
    const originalFetch = global.fetch;

    global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const urlStr = typeof input === 'string' ? input : input.toString();
      if (urlStr.includes('/v1beta/models?')) {
        return new Response(
          JSON.stringify({
            models: [{ name: 'models/gemini-4-hydrogen', supportedGenerationMethods: ['generateContent'] }]
          }),
          { status: 200 }
        );
      }
      if (urlStr.includes('api.openalex.org')) {
        requestedOpenAlexUrls.push(urlStr);
        return new Response(
          JSON.stringify({
            results: [
              {
                id: 'https://openalex.org/W999001',
                title: 'Epistemic Trust and Classroom Discourse in Secondary Ethics',
                doi: 'https://doi.org/10.1234/ethics-999001',
                publication_date: new Date().toISOString().slice(0, 10),
                cited_by_count: 14,
                abstract_inverted_index: {
                  This: [0],
                  study: [1],
                  examines: [2],
                  epistemic: [3],
                  trust: [4],
                  and: [5],
                  socratic: [6],
                  argumentation: [7],
                  in: [8],
                  german: [9],
                  ethics: [10],
                  classrooms: [11],
                  with: [12],
                  empirical: [13],
                  classroom: [14],
                  observations: [15]
                }
              }
            ]
          }),
          { status: 200 }
        );
      }
      if (urlStr.includes('hn.algolia.com')) {
        return new Response(
          JSON.stringify({
            hits: [
              {
                objectID: '888001',
                title: 'Clickbait Promo Deal 99% Off Everything',
                url: 'https://promo.example.org/deal',
                points: 42,
                num_comments: 3,
                created_at: new Date().toISOString()
              },
              {
                objectID: '888002',
                title: 'Mechanistic Interpretability of Transformer Attention Circuits',
                url: 'https://research.example.org/circuits',
                points: 310,
                num_comments: 84,
                created_at: new Date().toISOString()
              }
            ]
          }),
          { status: 200 }
        );
      }
      if (urlStr.includes(':generateContent') && init?.body) {
        const parsedBody = JSON.parse(String(init.body));
        const hasGoogleSearch = Array.isArray(parsedBody.tools);
        if (hasGoogleSearch) {
          return new Response(
            JSON.stringify({
              candidates: [
                {
                  content: { parts: [{ text: 'Spektrum berichtet über neue Erkenntnisse zur Aufmerksamkeit und tiefem Lesen.' }] },
                  groundingMetadata: {
                    webSearchQueries: ['tiefes lesen kognition 2026'],
                    groundingChunks: [
                      { web: { uri: 'https://www.spektrum.de/news/tiefes-lesen-2026', title: 'spektrum.de' } }
                    ]
                  }
                }
              ],
              usageMetadata: { promptTokenCount: 150, candidatesTokenCount: 90 }
            }),
            { status: 200 }
          );
        }
        const promptText = String(parsedBody?.contents?.[0]?.parts?.[0]?.text || '');
        if (promptText.includes('chunkIndex')) {
          return new Response(
            JSON.stringify({
              candidates: [
                {
                  content: {
                    parts: [
                      {
                        text: JSON.stringify([
                          {
                            chunkIndex: 0,
                            title: 'Warum tiefes Lesen im KI-Zeitalter kognitive Resilienz stärkt',
                            subtitle: 'Spektrum der Wissenschaft • Live-Web-Recherche',
                            publisherName: 'Spektrum der Wissenschaft',
                            feedText:
                              'Neue kognitionspsychologische Befunde zeigen, wie zusammenhängende Langtexte Arbeitsgedächtnis und Begriffsbildung weit über schnelles Überfliegen hinaus trainieren.',
                            articleBody:
                              'Eine aktuelle Übersichtsstudie analysiert den Unterschied zwischen fragmentiertem Bildschirm-Scanning und vertiefendem Lesen. Lernende, die längere Argumentationsbögen ohne ständige Benachrichtigungen durchdringen, zeigen messbar bessere Transferleistungen.',
                            keyInsight: 'Tiefes Lesen verankert kausale Zusammenhänge deutlich nachhaltiger als Kurz-Feeds.',
                            counterPerspective: 'Digitale Hypertexte ermöglichen hingegen schnelleren Querverweis-Abgleich bei erfahrener Medienkompetenz.',
                            challengePrompt: 'Wie lassen sich 20 Minuten konzentrierte Lektüre fest im Unterricht verankern?',
                            primaryTopic: 'german_didactics'
                          }
                        ])
                      }
                    ]
                  }
                }
              ],
              usageMetadata: { promptTokenCount: 200, candidatesTokenCount: 180 }
            }),
            { status: 200 }
          );
        }
        // BatchEditionEnricher Gatekeeper response: approve OpenAlex + HN Circuits, reject Clickbait Promo
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify([
                        {
                          id: 'openweb-openalex-W999001',
                          curationScore: 9,
                          rejectionReason: '',
                          feedText:
                            'Empirische Untersuchung aus der Ethik-Didaktik: Wie sokratische Gesprächsführung das epistemische Vertrauen und die Argumentationsqualität in der Oberstufe messbar steigert.',
                          keyInsight: 'Sokratische Klärung stärkt belastbare Urteilskraft im Ethikunterricht.',
                          counterPerspective: 'Offene Diskurse benötigen klare Moderation, um rhetorische Dominanz einzelner Stimmen auszugleichen.',
                          challengePrompt: 'Welcher sokratische Impuls eignet sich als Stundeneinstieg?',
                          primaryTopic: 'german_didactics',
                          topics: ['german_didactics', 'philosophy_ethics'],
                          didacticTransfer: ''
                        },
                        {
                          id: 'openweb-hn-888001',
                          curationScore: 2,
                          rejectionReason: 'Reiner Shopping-/Promo-Link ohne Erkenntniswert',
                          feedText: '',
                          keyInsight: '',
                          counterPerspective: '',
                          challengePrompt: '',
                          primaryTopic: 'ai_apple',
                          topics: ['ai_apple'],
                          didacticTransfer: ''
                        },
                        {
                          id: 'openweb-hn-888002',
                          curationScore: 8,
                          rejectionReason: '',
                          feedText:
                            'Detaillierte Analyse mechanistischer Aufmerksamkeitsschaltkreise in Transformern: Wie sich interpretierbare Konzepte direkt im Aktivierungsraum lokalisieren und testen lassen.',
                          keyInsight: 'Mechanistische Interpretierbarkeit macht interne Modell-Heuristiken überprüfbar.',
                          counterPerspective: 'Isolierte Schaltkreis-Analysen erfassen noch nicht das Zusammenspiel unter Verteilungsverschiebung.',
                          challengePrompt: 'Wo liegen die Grenzen heutiger Transparenzmethoden bei Sprachmodellen?',
                          primaryTopic: 'ai_apple',
                          topics: ['ai_apple', 'science_society'],
                          didacticTransfer: ''
                        }
                      ])
                    }
                  ]
                }
              }
            ],
            usageMetadata: { promptTokenCount: 250, candidatesTokenCount: 210 }
          }),
          { status: 200 }
        );
      }
      return new Response('{}', { status: 404 });
    }) as typeof fetch;

    try {
      const run1 = await OpenWebHarvester.harvestMultiLaneInternetDiscovery({
        storage,
        credentials: creds,
        targetNewCount: 15
      });
      assert.equal(run1.usedAI, true, 'Live-Recherche mit gültigem Key muss echte KI melden');
      assert.ok(run1.rejectedCount >= 1, 'KI-Türsteher muss schwache Kandidaten aussortieren');
      assert.ok(
        run1.items.some(i => i.canonicalUrl === 'https://www.spektrum.de/news/tiefes-lesen-2026'),
        'Verifizierte Google-Search-Grounding-Quelle muss im Ergebnis enthalten sein'
      );
      assert.ok(
        run1.items.some(i => i.id === 'openweb-hn-888002'),
        'Substanzielle HN-Diskussion darf nicht vorab verworfen werden, sondern durch die KI-Redaktion veredelt werden'
      );
      assert.equal(
        run1.items.some(i => i.id === 'openweb-hn-888001'),
        false,
        'Clickbait-Promo muss durch den KI-Türsteher aussortiert werden'
      );

      // Run 2 rotates cursor & page parameter on OpenAlex
      await OpenWebHarvester.harvestMultiLaneInternetDiscovery({
        storage,
        credentials: creds,
        targetNewCount: 15
      });
      assert.ok(requestedOpenAlexUrls.length >= 2);
      assert.notEqual(requestedOpenAlexUrls[0], requestedOpenAlexUrls[1], 'Zweiter Lauf muss Suchseite/Fokus rotieren');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('Säule 4a: Gesehene 2004-Klassiker (Paul Graham) rutschen auch nach >72 Stunden NIE wieder nach oben in Für dich', () => {
    const paulGrahamVault = REAL_KNOWLEDGE_VAULT.find(v => v.id === 'vault-gem-002-paul-graham-hackers-painters');
    assert.ok(paulGrahamVault, 'Paul Graham Fixture existiert als Referenz im Vault');

    const distinctDomains = [
      'zeit.de',
      'spektrum.de',
      'dlf.de',
      'aeon.co',
      'quantamagazine.org',
      'heise.de',
      'faz.net',
      'sueddeutsche.de',
      'arstechnica.com',
      'nature.com',
      'theguardian.com',
      'monopol-magazin.de'
    ];
    const freshItems: FeedItem[] = Array.from({ length: 12 }, (_, idx) => {
      const dom = distinctDomains[idx % distinctDomains.length];
      return makeArticle(`fresh-live-2026-${idx + 1}`, {
        primaryTopic: idx % 2 === 0 ? 'science_society' : 'german_didactics',
        topics: ['science_society', 'german_didactics'],
        sourceDomain: dom,
        canonicalUrl: `https://${dom}/article-${idx + 1}`,
        curationScore: 8.6
      });
    });

    const oldSeenAt = new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString();
    const seenIds = new Set<string>([paulGrahamVault!.id]);
    const seenRecords = new Map([
      [
        paulGrahamVault!.id,
        { itemId: paulGrahamVault!.id, firstSeenAt: oldSeenAt, lastSeenAt: oldSeenAt, count: 4 }
      ]
    ]);

    const scored = [...freshItems, paulGrahamVault!].map(it => scoreFeedItem(it, DEFAULT_USER_PROFILE, {}));
    const ranked = rankBloomScrollFeed(scored, { seenItemIds: seenIds, seenRecords });
    const withSerendipity = interleaveSerendipitySlot(ranked, seenIds);
    const fullSorted = sortFeedForDisplay(scored, 'for_you', { seenItemIds: seenIds, seenRecords });

    const topTenIds = new Set(withSerendipity.slice(0, 10).map(i => i.id));
    assert.equal(topTenIds.has(paulGrahamVault!.id), false, 'Serendipity darf gesehene 2004-Essays nicht in Top-10 hochziehen');
    assert.equal(fullSorted[fullSorted.length - 1].id, paulGrahamVault!.id, 'Gesehener 2004-Essay gehört ans Ende hinter frische Beiträge');
  });

  it('Säule 4b: Entfernt mehrteilige SerpApi-/AINews-Werbetexte restlos aus allen Kartenfeldern', () => {
    const dirtyItem = makeArticle('dirty-ains-serpapi', {
      title: 'AIE CODE: System One and Gemini Decision 1',
      subtitle: 'Latent Space • And support AINews by giving your agent SerpApi!',
      feedText:
        'Benchmarks are good (usual caveat about benchmarks):\n\nAnd you can hear all this and more on today’s System One track. And support AINews by giving your agent SerpApi to read and crawl the web! Sponsored by SerpApi\n\nGive Your AI Agents the Full Page, Not Just the Link\nRetrieve public web pages by URL as clean Markdown, structured JSON, or raw HTML with SerpApi’s Extract API. Pair it with 100+ SerpApi search APIs to go from query to page content with one provider.',
      articleBody:
        'Today was the System One day of the AIE CODE event covering calibrated decision models.\n\nAnd you can hear all this and more on today’s System One track.\n\nAnd support AINews by giving your agent SerpApi to read and crawl the web!\n\nGive Your AI Agents the Full Page, Not Just the Link\nRetrieve public web pages by URL as clean Markdown, structured JSON, or raw HTML with SerpApi’s Extract API. Pair it with 100+ SerpApi search APIs to go from query to page content with one provider.\n\nThanks to SerpApi for working with business@latent.space!\n\nAI Twitter Recap: Researchers compared latency metrics across five architectures with deterministic benchmarks.',
      keyInsight: 'And support AINews by giving your agent SerpApi to read and crawl the web!'
    });

    const strippedDirect = stripPublisherBoilerplate(dirtyItem.feedText, dirtyItem.title);
    assert.equal(/SerpApi|Sponsored by|AINews/i.test(strippedDirect), false);

    const sanitized = sanitizeCuratedFeedItem(dirtyItem);
    assert.equal(/SerpApi/i.test(sanitized.feedText), false, 'feedText darf keinen SerpApi-Text mehr enthalten');
    assert.equal(/SerpApi/i.test(sanitized.articleBody || ''), false, 'articleBody darf keinen SerpApi-Text mehr enthalten');
    assert.equal(/SerpApi/i.test(sanitized.keyInsight || ''), false, 'keyInsight darf keinen SerpApi-Text mehr enthalten');
    assert.equal(/SerpApi/i.test(sanitized.subtitle), false, 'subtitle darf keinen SerpApi-Text mehr enthalten');
    assert.ok(
      (sanitized.articleBody || '').includes('AI Twitter Recap: Researchers compared latency metrics'),
      'Eigentlicher redaktioneller Inhalt nach der Sponsor-Box muss erhalten bleiben'
    );
  });

  it('Säule 5: Server-Pipeline ruft Scrapling-Web-Harvester auf & ausgelieferte Snapshots sind komplett sauber', () => {
    const pipelineScript = fs.readFileSync(path.resolve(__dirname, '../scripts/run-pipeline.ts'), 'utf8');
    assert.ok(pipelineScript.includes('harvestWebPageContent('), 'scripts/run-pipeline.ts muss harvestWebPageContent aktiv aufrufen');

    const snapshotPath = path.resolve(__dirname, '../public/feed-snapshot.json');
    if (fs.existsSync(snapshotPath)) {
      const snapshotRaw = fs.readFileSync(snapshotPath, 'utf8');
      assert.equal(snapshotRaw.includes('SerpApi'), false, 'public/feed-snapshot.json darf keine SerpApi-Werbung enthalten');
      assert.equal(snapshotRaw.includes('hivemind-track-roman'), false, 'public/feed-snapshot.json darf keine Rom-Karten enthalten');
      assert.equal(snapshotRaw.includes('hivemind-track-quantum'), false, 'public/feed-snapshot.json darf keine Quanten-Karten enthalten');
    }
  });
});
