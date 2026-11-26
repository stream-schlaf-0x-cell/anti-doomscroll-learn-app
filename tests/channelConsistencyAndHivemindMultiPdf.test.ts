import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { LocalFeedRepository, feedRepository } from '../src/core/data/feedRepository';
import { AtemStorage, MemoryStorageDriver } from '../src/core/data/storage';
import { DEFAULT_USER_PROFILE } from '../src/core/data/fixtures';
import { scoreFeedItem, sortFeedForDisplay, getEffectiveSpaceHandle } from '../src/core/domain/ranking';
import { FeedItem, FeedItemSchema } from '../src/core/domain/types';
import { SubchannelFlourishService } from '../src/core/ingestion/subchannelFlourishService';
import { defaultSnapshotLoader } from '../src/core/feed/SnapshotLoader';
import { REAL_KNOWLEDGE_VAULT } from '../src/core/data/realKnowledgeVault';
import {
  isAccessibleHealthLongevityItem,
  sanitizeCuratedFeedItem,
  satisfiesCuratedBodyContract,
  stripPublisherBoilerplate,
  evaluateSignalVsNoiseDeterministically,
  isShoppingDealTitle
} from '../src/core/enrichment/batchEnricher';
import {
  buildMultiDocumentSynthesisContext,
  buildMultiDocumentChapterSpecs,
  generateHivemindLearningTrack,
  generateNextHivemindChapter
} from '../src/core/learning/hivemindLearningService';

function makeValidFeedItem(id: string, overrides: Partial<FeedItem> = {}): FeedItem {
  const nowIso = new Date().toISOString();
  return FeedItemSchema.parse({
    id,
    type: 'briefing',
    format: 'sourced_update',
    title: `Analytischer Fachbeitrag ${id}: Perspektiven aus Wissenschaft und Praxis`,
    subtitle: 'Wissenschaft & Alltag',
    feedText:
      'Eine fundierte Darstellung aktueller Befunde mit konkreten methodischen Einordnungen und nachvollziehbaren Quellenangaben für konzentriertes Lesen.',
    articleBody:
      'Eine fundierte Darstellung aktueller Befunde mit konkreten methodischen Einordnungen und nachvollziehbaren Quellenangaben für konzentriertes Lesen über mehrere Absätze hinweg.',
    body:
      'Eine fundierte Darstellung aktueller Befunde mit konkreten methodischen Einordnungen und nachvollziehbaren Quellenangaben.',
    keyInsight: 'Strukturierte Einordnung aktueller Forschungsergebnisse ohne oberflächliche Zuspitzung.',
    primaryTopic: 'science_society',
    topics: ['science_society'],
    space: 'c/serendipity',
    publishedAt: nowIso,
    publicationDateReliable: true,
    firstSeenAt: nowIso,
    generatedAt: nowIso,
    estimatedReadingMinutes: 4,
    relevanceExplanation: 'Belastbare Quellenlage und thematische Relevanz.',
    contentStatus: 'editorial_briefing',
    isDailyEdition: false,
    editionDate: nowIso.slice(0, 10),
    isDemonstration: false,
    aiAssisted: false,
    factReviewStatus: 'curated_illustrative',
    provenanceSummary: 'Verifizierte Redaktionsquelle',
    wordCount: 180,
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

function makeYoutubeItem(
  id: string,
  videoId: string,
  creator: string,
  title: string,
  urlOverride?: string
): FeedItem {
  const url = urlOverride ?? `https://www.youtube.com/watch?v=${videoId}`;
  return makeValidFeedItem(id, {
    format: 'youtube_gem',
    title,
    subtitle: `Video-Essay • ${creator}`,
    feedText:
      `In diesem ausführlichen Video-Essay untersucht ${creator} die historischen, technischen und konzeptionellen Grundlagen hinter ${title} anhand klarer visueller Modelle.`,
    body:
      `In diesem ausführlichen Video-Essay untersucht ${creator} die historischen, technischen und konzeptionellen Grundlagen hinter ${title} anhand klarer visueller Modelle und nachvollziehbarer Beispiele.`,
    articleBody:
      `In diesem ausführlichen Video-Essay untersucht ${creator} die historischen, technischen und konzeptionellen Grundlagen hinter ${title} anhand klarer visueller Modelle und nachvollziehbarer Beispiele.`,
    keyInsight: `${creator} verbindet anschauliche Visualisierung mit präziser Begriffsarbeit.`,
    primaryTopic: 'youtube_gems',
    topics: ['youtube_gems', 'science_society'],
    space: 'c/youtube',
    canonicalUrl: url,
    sourceDomain: 'youtube.com',
    sourceBroadcasterName: creator,
    imageUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    hasAuthenticImage: true,
    youtubeMeta: {
      videoId,
      channelTitle: creator,
      duration: '18:24',
      keyTakeaways: ['Visualisierte Kernideen und klare Begriffsarbeit'],
      viewCount: '240K'
    },
    sourceReferences: [
      {
        publisher: creator,
        originalUrl: url,
        title,
        publicationTimestamp: new Date().toISOString(),
        retrievalTimestamp: new Date().toISOString(),
        isVerified: true
      }
    ]
  });
}

describe('Channel Consistency, Health/Caschy Gates & Hivemind Multi-PDF (v20)', () => {
  it('1. c/youtube end-to-end: LocalFeedRepository -> getEditionAndDiscovery -> sortFeedForDisplay preserves >= 8 snapshot & > 50 reservoir videos', async () => {
    const snapshotPath = path.resolve(process.cwd(), 'public/feed-snapshot.json');
    const reservoirPath = path.resolve(process.cwd(), 'public/feed-reservoir.json');
    const snapshotJson = JSON.parse(fs.readFileSync(snapshotPath, 'utf8')) as { items: FeedItem[] };
    const reservoirJson = JSON.parse(fs.readFileSync(reservoirPath, 'utf8')) as { items: FeedItem[] };

    const isYt = (it: FeedItem) =>
      getEffectiveSpaceHandle(it) === 'c/youtube' || it.primaryTopic === 'youtube_gems';

    const snapshotYtRaw = snapshotJson.items.filter(isYt);
    const reservoirYtRaw = reservoirJson.items.filter(isYt);

    assert.ok(
      snapshotYtRaw.length >= 8,
      `Expected >= 8 c/youtube items in public/feed-snapshot.json, got ${snapshotYtRaw.length}`
    );
    assert.ok(
      reservoirYtRaw.length > 50,
      `Expected > 50 c/youtube items in public/feed-reservoir.json, got ${reservoirYtRaw.length}`
    );

    const repo = new LocalFeedRepository(snapshotJson.items, new AtemStorage(new MemoryStorageDriver()));
    const { daily, discovery } = await repo.getEditionAndDiscovery('morning', DEFAULT_USER_PROFILE);
    const editionCombined = [...daily, ...discovery];
    const editionYt = editionCombined.filter(isYt);
    assert.ok(
      editionYt.length >= 8,
      `getEditionAndDiscovery must retain >= 8 c/youtube items, got ${editionYt.length}`
    );

    const scoredSnapshotYt = snapshotYtRaw.map(it => scoreFeedItem(it, DEFAULT_USER_PROFILE, {}));
    const sortedSnapshotYt = sortFeedForDisplay(scoredSnapshotYt, 'for_you', { interleave: true });
    assert.equal(
      sortedSnapshotYt.length,
      snapshotYtRaw.length,
      `sortFeedForDisplay(for_you, interleave: true) must preserve all ${snapshotYtRaw.length} snapshot c/youtube items, got ${sortedSnapshotYt.length}`
    );

    const scoredReservoirYt = reservoirYtRaw.map(it => scoreFeedItem(it, DEFAULT_USER_PROFILE, {}));
    const sortedReservoirYt = sortFeedForDisplay(scoredReservoirYt, 'for_you', { interleave: true });
    assert.equal(
      sortedReservoirYt.length,
      reservoirYtRaw.length,
      `sortFeedForDisplay(for_you, interleave: true) must preserve all ${reservoirYtRaw.length} reservoir c/youtube items, got ${sortedReservoirYt.length}`
    );
    assert.ok(sortedReservoirYt.length > 50, 'Reservoir c/youtube display list must exceed 50 items and never collapse to 1');
  });

  it('2. SubchannelFlourishService.flourishChannel("c/youtube", { force: true }) deduplicates cleanly and counts only genuinely new items', async () => {
    const existingItems: FeedItem[] = REAL_KNOWLEDGE_VAULT.filter(
      v => v.space === 'c/youtube' || v.primaryTopic === 'youtube_gems' || v.format === 'youtube_gem'
    );
    for (let i = 0; i < 22; i++) {
      const vid = `existVid00${String(i).padStart(2, '0')}`;
      existingItems.push(
        makeYoutubeItem(
          `yt-existing-${i}`,
          vid,
          `Creator ${i % 5}`,
          `Bestehendes Erklärvideo ${i}: Komplexe Konzepte verständlich visualisiert`
        )
      );
    }
    // Specific URL formats to verify cross-URL canonical YouTube deduplication
    existingItems.push(
      makeYoutubeItem(
        'yt-existing-watch',
        'abc123XYZ00',
        '3Blue1Brown',
        'Differential Equations and Phase Portraits Visualized',
        'https://www.youtube.com/watch?v=abc123XYZ00'
      ),
      makeYoutubeItem(
        'yt-existing-short',
        'def456UVW11',
        'Veritasium',
        'Why Nobody Actually Understands Quantum Tunneling Speed',
        'https://youtu.be/def456UVW11'
      )
    );

    const snapshotCandidates: FeedItem[] = [
      // Duplicate by ID
      makeYoutubeItem(
        'yt-existing-0',
        'existVid0000',
        'Creator 0',
        'Duplicate By Id Video That Must Be Skipped'
      ),
      // Duplicate by watch?v= -> youtu.be canonical equivalence
      makeYoutubeItem(
        'yt-dupe-short-url',
        'abc123XYZ00',
        '3Blue1Brown',
        'Differential Equations and Phase Portraits Visualized (Short URL)',
        'https://youtu.be/abc123XYZ00'
      ),
      // Duplicate by youtu.be -> watch?v= canonical equivalence
      makeYoutubeItem(
        'yt-dupe-watch-url',
        'def456UVW11',
        'Veritasium',
        'Why Nobody Actually Understands Quantum Tunneling Speed (Watch URL)',
        'https://www.youtube.com/watch?v=def456UVW11'
      ),
      // Two genuinely new items
      makeYoutubeItem(
        'yt-brand-new-1',
        'newVid11111',
        'Sabine Hossenfelder',
        'Does Quantum Gravity Actually Need String Theory Or Loop Approaches?'
      ),
      makeYoutubeItem(
        'yt-brand-new-2',
        'newVid22222',
        'Kurzgesagt',
        'How Cellular Aging Clocks Measure Biological Time Inside Human Tissues'
      )
    ];

    const addedToRepo: FeedItem[] = [];
    mock.method(defaultSnapshotLoader, 'loadSnapshot', async () => ({
      success: true,
      itemCount: snapshotCandidates.length,
      items: snapshotCandidates
    }));
    mock.method(defaultSnapshotLoader, 'loadReservoir', async () => ({
      success: true,
      itemCount: 0,
      items: []
    }));
    mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ data: { children: [] } }), { status: 200 }));
    mock.method(feedRepository, 'addItems', (items: FeedItem[]) => {
      addedToRepo.push(...items);
    });

    try {
      const firstRun = await SubchannelFlourishService.flourishChannel('c/youtube', {
        force: true,
        minUnseenCount: 20,
        existingItems
      });

      assert.equal(firstRun.flourished, true, 'force: true must bypass minUnseenCount early exit');
      assert.equal(firstRun.addedItems.length, 2, `Expected exactly 2 genuinely new items, got ${firstRun.addedItems.length}`);
      assert.deepEqual(
        firstRun.addedItems.map(i => i.id).sort(),
        ['yt-brand-new-1', 'yt-brand-new-2']
      );
      assert.equal(addedToRepo.length, 2);

      // Repeat call with newly added items now present must yield 0 addedItems
      const secondRun = await SubchannelFlourishService.flourishChannel('c/youtube', {
        force: true,
        minUnseenCount: 20,
        existingItems: [...existingItems, ...firstRun.addedItems]
      });
      assert.equal(secondRun.flourished, false);
      assert.equal(secondRun.addedItems.length, 0, 'Repeat forced flourish must add 0 duplicates');
    } finally {
      mock.restoreAll();
    }
  });

  it('3. c/health_longevity gate rejects wet-lab mouse/Frontiers, ESA/astronaut, and arXiv AI papers while admitting genuine accessible health articles', () => {
    const frontiersMousePaper = makeValidFeedItem('hl-reject-frontiers', {
      title: 'ZDHHC7 deficiency modulates GABAA receptor palmitoylation in female mice',
      subtitle: 'Frontiers in Molecular Neuroscience',
      feedText:
        'Using acute brain slices and electrophysiological recordings in female mice, we show how ZDHHC7 deficiency alters prefrontal synaptic transmission.',
      body:
        'Using acute brain slices and electrophysiological recordings in female mice, we show how ZDHHC7 deficiency alters prefrontal synaptic transmission and GABAA trafficking.',
      space: 'c/health_longevity',
      primaryTopic: 'health_biohacking',
      topics: ['health_biohacking'],
      canonicalUrl: 'https://www.frontiersin.org/articles/10.3389/fnmol.2026.12345/full',
      sourceDomain: 'frontiersin.org',
      sourceReferences: [
        {
          publisher: 'Frontiers in Molecular Neuroscience',
          originalUrl: 'https://www.frontiersin.org/articles/10.3389/fnmol.2026.12345/full',
          title: 'ZDHHC7 deficiency modulates GABAA receptor palmitoylation in female mice',
          retrievalTimestamp: new Date().toISOString(),
          isVerified: true
        }
      ]
    });

    const esaAstronautArticle = makeValidFeedItem('hl-reject-astronaut', {
      title: 'Australian astronaut completes intensive ESA training for upcoming orbital mission',
      subtitle: 'Phys.org Spaceflight',
      feedText:
        'During intensive ESA training modules in Cologne, the astronaut practiced spacecraft docking procedures and microgravity contingency drills.',
      body:
        'During intensive ESA training modules in Cologne, the astronaut practiced spacecraft docking procedures and microgravity contingency drills ahead of launch.',
      space: 'c/health_longevity',
      primaryTopic: 'health_biohacking',
      topics: ['health_biohacking'],
      canonicalUrl: 'https://phys.org/news/2026-11-australian-astronaut-esa-training.html',
      sourceDomain: 'phys.org'
    });

    const arxivAiPaper = makeValidFeedItem('hl-reject-arxiv', {
      title: 'Context Scaling Laws for Long-Horizon AI Model Training',
      subtitle: 'arXiv cs.LG',
      feedText:
        'We study context scaling laws during large language model training across transformer architectures and evaluate reasoning benchmarks.',
      body:
        'We study context scaling laws during large language model training across transformer architectures and evaluate reasoning benchmarks.',
      space: 'c/health_longevity',
      primaryTopic: 'health_biohacking',
      topics: ['health_biohacking'],
      canonicalUrl: 'https://arxiv.org/abs/2611.01234',
      sourceDomain: 'arxiv.org'
    });

    assert.equal(isAccessibleHealthLongevityItem(frontiersMousePaper), false, 'Frontiers mouse paper must be rejected');
    assert.equal(isAccessibleHealthLongevityItem(esaAstronautArticle), false, 'ESA astronaut article must be rejected');
    assert.equal(isAccessibleHealthLongevityItem(arxivAiPaper), false, 'arXiv AI paper must be rejected');

    assert.equal(satisfiesCuratedBodyContract(frontiersMousePaper), false);
    assert.equal(satisfiesCuratedBodyContract(esaAstronautArticle), false);
    assert.equal(satisfiesCuratedBodyContract(arxivAiPaper), false);

    // Also verify sanitizeCuratedFeedItem re-routes misplaced items out of c/health_longevity
    const reroutedAi = sanitizeCuratedFeedItem(arxivAiPaper);
    assert.notEqual(reroutedAi.space, 'c/health_longevity');

    const genuineSleepDe = makeValidFeedItem('hl-admit-sleep-de', {
      title: 'Warum regelmäßiger Schlaf und Morgenlicht den zirkadianen Rhythmus stabilisieren',
      subtitle: 'NDR Ratgeber Gesundheit',
      feedText:
        'Schlafmediziner erklären, wie feste Aufstehzeiten, frühes Tageslicht und abendliche Lichtreduktion die Schlafqualität, Erholung und Herzgesundheit messbar verbessern.',
      body:
        'Schlafmediziner erklären, wie feste Aufstehzeiten, frühes Tageslicht und abendliche Lichtreduktion die Schlafqualität, Erholung und Herzgesundheit messbar verbessern. Schon nach zwei Wochen stabilisieren sich Melatoninrhythmus und Konzentrationsfähigkeit.',
      space: 'c/health_longevity',
      primaryTopic: 'health_biohacking',
      topics: ['health_biohacking'],
      canonicalUrl: 'https://www.ndr.de/ratgeber/gesundheit/schlaf-zirkadianer-rhythmus.html',
      sourceDomain: 'ndr.de'
    });

    const genuineLongevityEn = makeValidFeedItem('hl-admit-longevity-en', {
      title: 'How Resistance Training and Protein Intake Protect Muscle Mass and Longevity',
      subtitle: 'Stronger By Science',
      feedText:
        'Evidence-based guidance on progressive strength training, dietary protein distribution, and VO2 max habits that support healthy aging and metabolic health.',
      body:
        'Evidence-based guidance on progressive strength training, dietary protein distribution, and VO2 max habits that support healthy aging and metabolic health across midlife and older adulthood.',
      space: 'c/health_longevity',
      primaryTopic: 'health_biohacking',
      topics: ['health_biohacking'],
      canonicalUrl: 'https://www.strongerbyscience.com/resistance-training-longevity/',
      sourceDomain: 'strongerbyscience.com'
    });

    assert.equal(isAccessibleHealthLongevityItem(genuineSleepDe), true);
    assert.equal(isAccessibleHealthLongevityItem(genuineLongevityEn), true);
    assert.equal(satisfiesCuratedBodyContract(genuineSleepDe), true);
    assert.equal(satisfiesCuratedBodyContract(genuineLongevityEn), true);
  });

  it('4. Caschy Amazon-affiliate stripping, Tagesgeld rejection, and visible-card fallback resolution for openArticle', async () => {
    const rawCaschyBody = [
      'Apple verteilt ab sofort iOS 18.2 mit verbesserter On-Device-Suche und feinerer Mitteilungssteuerung für unterstützte iPhones.',
      '',
      'Dir gefällt, was wir machen? Dann hilft uns ein Einkauf über unseren Amazon-Link: Amazon.de öffnen und wie gewohnt einkaufen. Für dich wird nichts teurer, wir erhalten eine kleine Provision. Als Amazon-Partner verdienen wir an qualifizierten Verkäufen.',
      'Wo du uns folgen kannst: Mastodon, Bluesky und WhatsApp.',
      'Auf dem Laufenden bleiben? Füge uns bei Google als bevorzugte Quelle hinzu.',
      'Zum Beitrag: https://stadt-bremerhaven.de/ios-18-2-update/'
    ].join('\n');

    const cleanedCaschy = stripPublisherBoilerplate(rawCaschyBody, 'Apple verteilt iOS 18.2');
    assert.ok(cleanedCaschy.includes('Apple verteilt ab sofort iOS 18.2'), 'Editorial lead must be preserved');
    assert.ok(!/Dir gefällt,\s*was wir machen/i.test(cleanedCaschy), 'Caschy donation prompt must be stripped');
    assert.ok(!/Amazon-Link|Amazon\.de öffnen|Amazon-Partner/i.test(cleanedCaschy), 'Amazon affiliate lines must be stripped');
    assert.ok(!/Zum Beitrag:/i.test(cleanedCaschy), 'Zum Beitrag footer must be stripped');

    const tagesgeldTitle = 'C24 Bank bietet jetzt wieder 2,5 Prozent Zinsen p. a. auf das Tagesgeld und Girokonto-Prämie';
    assert.equal(isShoppingDealTitle(tagesgeldTitle), true);
    const tagesgeldEval = evaluateSignalVsNoiseDeterministically({
      title: tagesgeldTitle,
      feedText: 'Aktuelle Zinsaktion für Neukunden mit Tagesgeld und Bonus bei Kontoeröffnung.',
      body: 'Aktuelle Zinsaktion für Neukunden mit Tagesgeld und Bonus bei Kontoeröffnung über das Vergleichsportal.',
      publisher: 'Caschys Blog'
    });
    assert.equal(tagesgeldEval.passed, false, 'Tagesgeld/Zins deal must fail signal-vs-noise gate');

    // Verify openArticle fallback resolution pattern: visible card missing from repo can be resolved & inserted cleanly
    const repo = new LocalFeedRepository([], new AtemStorage(new MemoryStorageDriver()));
    const visibleCard = makeValidFeedItem('visible-card-fallback-1', {
      title: 'Sichtbare Karte aus Discovery-Reservoir ohne vorherigen Repo-Eintrag',
      space: 'c/ai_apple',
      primaryTopic: 'ai_apple'
    });
    assert.equal(await repo.getItemById(visibleCard.id), null, 'Item is initially absent from repository');

    // Mirrors AppContext.openArticle(id, fallbackItem) behavior when repo/library miss
    let resolved = await repo.getItemById(visibleCard.id);
    if (!resolved) {
      resolved = visibleCard;
      repo.addItems([resolved], { operationType: 'background_sync', pinInserted: false });
    }
    assert.equal(resolved.id, visibleCard.id);
    const persistedAfterOpen = await repo.getItemById(visibleCard.id);
    assert.ok(persistedAfterOpen, 'Resolved fallback item must be persisted into FeedRepository for ReaderScreen');
    assert.equal(persistedAfterOpen?.title, visibleCard.title);

    // Also verify AppContext.tsx and FeedCard.tsx wire fallbackItem through openArticle(item.id, item)
    const appContextSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/core/context/AppContext.tsx'), 'utf8');
    const feedCardSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/ui/components/FeedCard.tsx'), 'utf8');
    assert.match(appContextSrc, /openArticle:\s*\(id:\s*string,\s*fallbackItem\?:\s*FeedItem\)\s*=>\s*Promise<void>/);
    assert.match(feedCardSrc, /openArticle\(item\.id,\s*item\)/);
  });

  it('5. Multi-PDF Hivemind synthesis & chapter progression fairly covers all 3 uploaded PDFs', async () => {
    const doc1 = {
      name: '01_Kant_Grundlegung_Ethik.pdf',
      text: `MARKER_PDF1_KANT Kategorischer Imperativ und Autonomie der praktischen Vernunft. ${'Immanuel Kant untersucht den guten Willen und das Sittengesetz als universalisierbare Maxime. '.repeat(260)}`
    };
    const doc2 = {
      name: '02_Vipassana_Achtsamkeit_Praxis.pdf',
      text: `MARKER_PDF2_VIPASSANA Satipatthana und kontemplative Aufmerksamkeitsforschung im Buddhismus. ${'Achtsame Gegenwärtigkeit beobachtet Reiz-Reaktions-Ketten ohne impulsive Identifikation. '.repeat(65)}`
    };
    const doc3 = {
      name: '03_Epiktet_Stoische_Resilienz.pdf',
      text: `MARKER_PDF3_EPICTETUS Dichotomie der Kontrolle und innere Gelassenheit im Encheiridion. ${'Epiktet unterscheidet konsequent zwischen dem, was in unserer Macht steht, und äußeren Umständen. '.repeat(50)}`
    };
    const docs = [doc1, doc2, doc3];

    const synthesisCtx = buildMultiDocumentSynthesisContext(docs, 12000);
    assert.ok(synthesisCtx.length <= 12000, `Context length ${synthesisCtx.length} must respect 12000 char budget`);
    assert.ok(synthesisCtx.includes('=== DOKUMENT 1/3: 01_Kant_Grundlegung_Ethik.pdf ==='));
    assert.ok(synthesisCtx.includes('=== DOKUMENT 2/3: 02_Vipassana_Achtsamkeit_Praxis.pdf ==='));
    assert.ok(synthesisCtx.includes('=== DOKUMENT 3/3: 03_Epiktet_Stoische_Resilienz.pdf ==='));
    assert.ok(synthesisCtx.includes('MARKER_PDF1_KANT'), 'PDF #1 must be represented');
    assert.ok(synthesisCtx.includes('MARKER_PDF2_VIPASSANA'), 'PDF #2 must not be dropped');
    assert.ok(synthesisCtx.includes('MARKER_PDF3_EPICTETUS'), 'PDF #3 must not be dropped');

    const specs = buildMultiDocumentChapterSpecs('Ethik & Kontemplation', docs);
    assert.equal(specs.length, 5, '3 PDFs must yield 5 chapters (1 overview + 3 deep dives + 1 comparative synthesis)');
    assert.equal(specs[0].isGenerated, true);
    assert.equal(specs[1].isGenerated, false);
    assert.equal(specs[2].isGenerated, false);
    assert.equal(specs[3].isGenerated, false);
    assert.equal(specs[4].isGenerated, false);
    assert.ok(specs[1].focusPromptOrChunk.includes('MARKER_PDF1_KANT'));
    assert.ok(specs[2].focusPromptOrChunk.includes('MARKER_PDF2_VIPASSANA'));
    assert.ok(specs[3].focusPromptOrChunk.includes('MARKER_PDF3_EPICTETUS'));

    const storage = new AtemStorage(new MemoryStorageDriver());
    const track = await generateHivemindLearningTrack({
      titleOrTopic: 'Ethik & Kontemplation',
      sourceDocuments: docs,
      storage,
      skipNetworkFetch: true
    });

    assert.equal(track.items.length, 12);
    assert.equal(track.chapters?.length, 5);
    const ch1Blob = track.items.map(i => `${i.title} ${i.subtitle} ${i.feedText} ${i.body}`).join(' ');
    assert.ok(ch1Blob.includes('Kant') && ch1Blob.includes('Vipassana') && ch1Blob.includes('Epiktet'), 'Chapter 1 cards must draw across all 3 PDFs');

    const afterCh2 = await generateNextHivemindChapter(track.id, { storage, skipNetworkFetch: true });
    assert.equal(afterCh2.items.length, 24);
    assert.equal(afterCh2.chapters?.[1]?.isGenerated, true);

    const afterCh3 = await generateNextHivemindChapter(track.id, { storage, skipNetworkFetch: true });
    assert.equal(afterCh3.items.length, 36);
    assert.equal(afterCh3.chapters?.[2]?.isGenerated, true);
    const ch3ItemsBlob = afterCh3.items.slice(24).map(i => `${i.title} ${i.feedText} ${i.body}`).join(' ');
    assert.ok(ch3ItemsBlob.includes('Vipassana') || ch3ItemsBlob.includes('Achtsamkeit'), 'Chapter 3 must cover PDF #2');

    const afterCh4 = await generateNextHivemindChapter(track.id, { storage, skipNetworkFetch: true });
    assert.equal(afterCh4.items.length, 48);
    assert.equal(afterCh4.chapters?.[3]?.isGenerated, true);
    const ch4ItemsBlob = afterCh4.items.slice(36).map(i => `${i.title} ${i.feedText} ${i.body}`).join(' ');
    assert.ok(ch4ItemsBlob.includes('Epiktet') || ch4ItemsBlob.includes('Stoische'), 'Chapter 4 must cover PDF #3');
  });
});
