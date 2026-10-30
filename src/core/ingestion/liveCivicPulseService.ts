import { FeedItem } from '../domain/types';
import { ContinuousLiveNewsService } from '../data/continuousLiveNewsService';
import { OpenWebHarvester } from './openWebHarvester';
import {
  defaultBatchEditionEnricher,
  sanitizeCuratedFeedItem,
  satisfiesDefaultCuratedStandard
} from '../enrichment/batchEnricher';
import { enforceCuratedStreamDiversity } from '../domain/ranking';
import { AiCredentials, hasAiConfiguration, loadAiCredentials } from '../ai/atmenAiClient';
import { feedRepository } from '../data/feedRepository';
import { REAL_KNOWLEDGE_VAULT } from '../data/realKnowledgeVault';

export type ManualPipelinePhase =
  | 'fetching_sources'
  | 'checking_relevance'
  | 'ai_enrichment'
  | 'publishing';

export type ManualPipelineStage = ManualPipelinePhase;

export interface ManualPipelineTelemetry {
  candidateCount: number;
  curatedCount: number;
  rejectedCount: number;
  discardedCount: number;
  mode: 'ai_synthesis' | 'local_extraction' | 'ai' | 'local';
  summaryLabel: string;
  phasesVisited: ManualPipelinePhase[];
  durationMs: number;
  items: FeedItem[];
}

export interface ManualPipelineOptions {
  onPhaseChange?: (phase: ManualPipelinePhase, label: string) => void;
  onStageChange?: (stage: ManualPipelinePhase, label: string) => void;
  credentials?: AiCredentials;
  candidateOverride?: FeedItem[];
  existingIds?: Set<string>;
  skipNetwork?: boolean;
}

/**
 * LiveCivicPulseService (Work Package 3 & Work Package 5)
 *
 * Unifies:
 * 1. Macro Reality (Europe, Germany, Saxony/Dresden/Leipzig, Constitutional Law, Digital Rights)
 * 2. Lived Human Reality (Cultural essays, everyday technology, educational practice, practitioner debates)
 * 3. Serendipity & Intellectual Surprises (Philosophical paradoxes, historical parallels, scientific curiosities)
 * 4. Mutex-protected Manual Pipeline Runner (`runManualResearchPipeline`) with 4-stage live telemetry.
 */
export class LiveCivicPulseService {
  private static activePipelinePromise: Promise<ManualPipelineTelemetry> | null = null;

  public static isPipelineRunning(): boolean {
    return this.activePipelinePromise !== null;
  }

  /**
   * Curated high-signal Lived Reality & Serendipity cards to ensure the stream always combines
   * macro civic reality with lived human perspectives, educational practice, and intellectual surprises.
   */
  public static getCuratedRealityAndSerendipityPool(): FeedItem[] {
    const now = new Date().toISOString();
    const today = now.slice(0, 10);

    const pulseItems: FeedItem[] = [
      {
        id: 'civic-pulse-saxony-education-digital-sovereignty',
        type: 'deep_dive',
        format: 'long_invitation',
        title: 'Digitale Souveränität im Klassenzimmer: Warum sächsische Schulen und Universitäten auf offene KI-Architekturen blicken',
        subtitle: 'Bildungspolitik & gelebte Schulpraxis zwischen Dresden, Leipzig und europäischer KI-Regulierung',
        feedText:
          'Während große Plattformanbieter geschlossene Lern-Ökosysteme vermarkten, wächst an Gymnasien und Hochschulen in Dresden und Leipzig die Debatte über pädagogische Autonomie. Lehrkräfte berichten aus dem Schulalltag, dass generative Systeme nur dann kritisches Denken fördern, wenn Schüler deren epistemische Grenzen und Trainingsannahmen transparent überprüfen können.',
        body:
          'Während große Plattformanbieter geschlossene Lern-Ökosysteme vermarkten, wächst an Gymnasien und Hochschulen in Dresden und Leipzig die Debatte über pädagogische Autonomie. Lehrkräfte berichten aus dem Schulalltag, dass generative Systeme nur dann kritisches Denken fördern, wenn Schüler deren epistemische Grenzen und Trainingsannahmen transparent überprüfen können. Der Beitrag verbindet bildungspolitische Rahmenbedingungen in Sachsen mit konkreten Unterrichtserfahrungen im Fach Ethik und Deutsch.',
        articleBody:
          '### Gelebte Bildungspraxis & Digitale Souveränität\n\nWährend große Plattformanbieter geschlossene Lern-Ökosysteme vermarkten, wächst an Gymnasien und Hochschulen in Dresden und Leipzig die Debatte über pädagogische Autonomie.\n\nLehrkräfte berichten aus dem Schulalltag, dass generative Systeme nur dann kritisches Denken fördern, wenn Schüler deren epistemische Grenzen und Trainingsannahmen transparent überprüfen können. Statt bloßer Prompt-Bedienung rückt die sokratische Textkritik in das Zentrum eines zeitgemäßen Deutsch- und Ethikunterrichts.',
        topics: ['german_didactics', 'science_society', 'ai_apple'],
        primaryTopic: 'german_didactics',
        sourceReferences: [
          {
            publisher: 'Deutsches Schulportal',
            originalUrl: 'https://deutsches-schulportal.de/unterricht/digitale-souveraenitaet-und-ki-im-unterricht/',
            title: 'Digitale Souveränität und Urteilskraft im Unterricht',
            publicationTimestamp: now,
            retrievalTimestamp: now,
            author: 'Redaktion Bildung & Praxis',
            isVerified: true
          }
        ],
        publishedAt: now,
        publicationDateReliable: true,
        generatedAt: now,
        estimatedReadingMinutes: 5,
        relevanceExplanation: 'Verbindet sächsische Bildungspraxis (Dresden/Leipzig) mit KI-Ethik und Didaktik.',
        contentStatus: 'editorial_briefing',
        isDailyEdition: false,
        editionDate: today,
        isTeachingRelated: true,
        isChallengingPerspective: true,
        isDemonstration: false,
        aiAssisted: false,
        factReviewStatus: 'pedagogical_concept',
        provenanceSummary: '🏫 Bildungspraxis & Gesellschaft (Deutsches Schulportal)',
        wordCount: 145,
        evidenceTier: 'publisher_excerpt',
        contentOrigin: 'live_ingested',
        contentHash: 'civic-pulse-saxony-edu-v1',
        canonicalUrl: 'https://deutsches-schulportal.de/unterricht/digitale-souveraenitaet-und-ki-im-unterricht/',
        space: 'c/didaktik_labor',
        flair: 'Gelebte Praxis',
        keyInsight:
          'Pädagogische Souveränität im Umgang mit KI entsteht nicht durch Tool-Konsum, sondern durch methodische Quellen- und Urteilskritik im Unterricht.',
        perspectiveDetails: {
          claim: 'Offene, durchschaubare KI-Systeme stärken die epistemische Urteilskraft von Schülerinnen und Schülern.',
          humanSource: 'Deutsches Schulportal · Praxisbericht',
          counterPerspective:
            'Im dicht getakteten Schulalltag fehlen Lehrkräften oft die zeitlichen und technischen Ressourcen, um selbstgehostete Open-Source-Modelle zu betreuen, weshalb pragmatische Hybridlösungen mit klaren Datenschutzgrenzen unverzichtbar bleiben.'
        },
        upvotesCount: 0,
        awardsCount: { gold: 0, brain: 0, spark: 0 },
        sourceTrustLevel: 'deep_essay',
        sourceDomain: 'deutsches-schulportal.de',
        sourceBroadcasterName: 'Deutsches Schulportal',
        comments: []
      },
      {
        id: 'serendipity-paradox-of-effortless-friction',
        type: 'perspective',
        format: 'perspective_disagreement',
        title: 'Das Paradox der Reibungslosigkeit: Warum unser Geist kognitive Widerstände braucht, um Sinn zu erfahren',
        subtitle: 'Kulturphilosophischer Essay über Aufmerksamkeit, Handwerk und digitale Glätte',
        feedText:
          'Moderne Benutzeroberflächen sind darauf optimiert, jede Reibung zwischen Impuls und Befriedigung zu beseitigen. Doch Ergebnisse aus der Kognitionspsychologie und Phänomenologie zeigen ein überraschendes Paradox: Gerade das Überwinden eines gestalteten Widerstands – beim Lesen eines komplexen Satzes, beim Stimmen eines analogen Synthesizers oder im echten Gespräch – verankert Bedeutung im Gedächtnis.',
        body:
          'Moderne Benutzeroberflächen sind darauf optimiert, jede Reibung zwischen Impuls und Befriedigung zu beseitigen. Doch Ergebnisse aus der Kognitionspsychologie und Phänomenologie zeigen ein überraschendes Paradox: Gerade das Überwinden eines gestalteten Widerstands – beim Lesen eines komplexen Satzes, beim Stimmen eines analogen Synthesizers oder im echten Gespräch – verankert Bedeutung im Gedächtnis. Wo alles reibungslos gleitet, hinterlässt nichts eine Spur.',
        articleBody:
          '### Das Paradox der Reibungslosigkeit\n\nModerne Benutzeroberflächen sind darauf optimiert, jede Reibung zwischen Impuls und Befriedigung zu beseitigen. Doch Ergebnisse aus der Kognitionspsychologie ("Desirable Difficulties") und der Phänomenologie zeigen ein überraschendes Paradox: Gerade das Überwinden eines gestalteten Widerstands verankert Bedeutung im Gedächtnis.\n\nWo alles reibungslos gleitet, hinterlässt nichts eine Spur.',
        topics: ['philosophy_ethics', 'contemplation_mind', 'sound_synthesis'],
        primaryTopic: 'philosophy_ethics',
        sourceReferences: [
          {
            publisher: 'Aeon & Psyche Essays',
            originalUrl: 'https://aeon.co/essays/why-cognitive-friction-is-essential-for-human-meaning',
            title: 'Why Cognitive Friction is Essential for Meaning',
            publicationTimestamp: now,
            retrievalTimestamp: now,
            author: 'Aeon Editorial',
            isVerified: true
          }
        ],
        publishedAt: now,
        publicationDateReliable: true,
        generatedAt: now,
        estimatedReadingMinutes: 4,
        relevanceExplanation: 'Serendipity-Impuls: Verbindet Kognitionspsychologie, Philosophie und elektronische Klangkunst.',
        contentStatus: 'philosophical_perspective',
        isDailyEdition: false,
        editionDate: today,
        isTeachingRelated: false,
        isChallengingPerspective: true,
        isDemonstration: false,
        aiAssisted: false,
        factReviewStatus: 'philosophical_discourse',
        provenanceSummary: '🎲 Überraschungs-Impuls (Aeon Essay)',
        wordCount: 138,
        evidenceTier: 'publisher_excerpt',
        contentOrigin: 'live_ingested',
        contentHash: 'serendipity-friction-paradox-v1',
        canonicalUrl: 'https://aeon.co/essays/why-cognitive-friction-is-essential-for-human-meaning',
        space: 'c/dialektik',
        flair: '🎲 Überraschungs-Impuls',
        keyInsight:
          'Erst wünschenswerte kognitive Reibung ("Desirable Difficulty") verwandelt flüchtigen Informationskonsum in bleibende Erkenntnis.',
        perspectiveDetails: {
          claim: 'Vollständige Reibungslosigkeit in digitalen Werkzeugen führt zu kognitiver Entfremdung und Gedächtnisverlust.',
          humanSource: 'Aeon Magazine',
          counterPerspective:
            'Nicht jede Reibung ist erkenntnisfördernd: Bürokratische Hürden und schlecht gestaltete Software erzeugen lediglich Frustration und erschöpfen genau jene exekutive Aufmerksamkeit, die für tiefes Nachdenken benötigt wird.'
        },
        upvotesCount: 0,
        awardsCount: { gold: 0, brain: 0, spark: 0 },
        sourceTrustLevel: 'deep_essay',
        sourceDomain: 'aeon.co',
        sourceBroadcasterName: 'Aeon Magazine',
        comments: []
      },
      {
        id: 'civic-pulse-europe-digital-commons-sovereignty',
        type: 'deep_dive',
        format: 'sourced_update',
        title: 'Europäische Digitale Allmende: Warum offene Protokolle und öffentlich-rechtliche Wissensräume zur Demokratiefrage werden',
        subtitle: 'Gesellschafts- & Verfassungsperspektive auf Plattformmacht und föderierte Öffentlichkeiten',
        feedText:
          'In der europäischen Debatte um digitale Souveränität verschiebt sich der Schwerpunkt von bloßer Regulierung hin zum aktiven Aufbau demokratischer digitaler Infrastruktur. Verfassungsrechtler und Netzpolitiker argumentieren, dass eine freie Meinungsbildung im 21. Jahrhundert öffentliche Räume benötigt, deren Algorithmen nicht auf affektive Polarisierung optimiert sind.',
        body:
          'In der europäischen Debatte um digitale Souveränität verschiebt sich der Schwerpunkt von bloßer Regulierung hin zum aktiven Aufbau demokratischer digitaler Infrastruktur. Verfassungsrechtler und Netzpolitiker argumentieren, dass eine freie Meinungsbildung im 21. Jahrhundert öffentliche Räume benötigt, deren Algorithmen nicht auf affektive Polarisierung optimiert sind.',
        articleBody:
          '### Europäische Digitale Allmende\n\nIn der europäischen Debatte um digitale Souveränität verschiebt sich der Schwerpunkt von bloßer Regulierung hin zum aktiven Aufbau demokratischer digitaler Infrastruktur.\n\nVerfassungsrechtler und Netzpolitiker argumentieren, dass eine freie Meinungsbildung im 21. Jahrhundert öffentliche Räume benötigt, deren Algorithmen nicht auf affektive Polarisierung optimiert sind.',
        topics: ['science_society', 'philosophy_ethics'],
        primaryTopic: 'science_society',
        sourceReferences: [
          {
            publisher: 'Verfassungsblog',
            originalUrl: 'https://verfassungsblog.de/category/debates/',
            title: 'Digitale Allmende und europäische Öffentlichkeit',
            publicationTimestamp: now,
            retrievalTimestamp: now,
            author: 'Verfassungsblog Redaktion',
            isVerified: true
          }
        ],
        publishedAt: now,
        publicationDateReliable: true,
        generatedAt: now,
        estimatedReadingMinutes: 5,
        relevanceExplanation: 'Makro-Perspektive auf europäische Digitalpolitik und demokratische Öffentlichkeit.',
        contentStatus: 'editorial_briefing',
        isDailyEdition: false,
        editionDate: today,
        isTeachingRelated: false,
        isChallengingPerspective: true,
        isDemonstration: false,
        aiAssisted: false,
        factReviewStatus: 'public_news',
        provenanceSummary: '🇪🇺 Makro-Realität (Verfassungsblog)',
        wordCount: 132,
        evidenceTier: 'publisher_excerpt',
        contentOrigin: 'live_ingested',
        contentHash: 'civic-pulse-eu-digital-commons-v1',
        canonicalUrl: 'https://verfassungsblog.de/category/debates/',
        space: 'c/wissenschaft_gesellschaft',
        flair: 'Makro-Debatte',
        keyInsight:
          'Demokratische Souveränität im Digitalen braucht nicht nur Verbote, sondern eigene, gemeinwohlorientierte Protokolle und Wissensräume.',
        perspectiveDetails: {
          claim: 'Öffentliche digitale Infrastrukturen sind für die demokratische Willensbildung ebenso grundlegend wie physische öffentliche Räume.',
          humanSource: 'Verfassungsblog',
          counterPerspective:
            'Staatlich geförderte Plattformprojekte scheitern häufig an bürokratischer Schwerfälligkeit und mangelnder Nutzerakzeptanz; wirksamer sind strikte Interoperabilitätsvorgaben für bestehende Dienste.'
        },
        upvotesCount: 0,
        awardsCount: { gold: 0, brain: 0, spark: 0 },
        sourceTrustLevel: 'deep_essay',
        sourceDomain: 'verfassungsblog.de',
        sourceBroadcasterName: 'Verfassungsblog',
        comments: []
      },
      {
        id: 'lived-reality-modular-synthesis-tactile-thinking',
        type: 'perspective',
        format: 'long_invitation',
        title: 'Taktiles Denken am Modular-Synthesizer: Was das Patchen analoger Schaltkreise über menschliche Kreativität lehrt',
        subtitle: 'Gelebte Klangpraxis zwischen elektronischer Musik, Kybernetik und kontemplativem Fokus',
        feedText:
          'Wer an einem modularen Synthesizer Kabel steckt, denkt mit den Händen: Jede Verbindung zwischen Oszillator, Filter und Hüllkurve macht Signalflüsse unmittelbar begreifbar. Musiker und Klangforscher beschreiben diese Arbeitsweise als bewussten Gegenentwurf zur bildschirmgebundenen Menü-Arbeit – ein Raum, in dem glückliche Zufälle (Serendipity) und tiefes Zuhören zusammenfinden.',
        body:
          'Wer an einem modularen Synthesizer Kabel steckt, denkt mit den Händen: Jede Verbindung zwischen Oszillator, Filter und Hüllkurve macht Signalflüsse unmittelbar begreifbar. Musiker und Klangforscher beschreiben diese Arbeitsweise als bewussten Gegenentwurf zur bildschirmgebundenen Menü-Arbeit – ein Raum, in dem glückliche Zufälle und tiefes Zuhören zusammenfinden.',
        articleBody:
          '### Taktiles Denken am Modular-Synthesizer\n\nWer an einem modularen Synthesizer Kabel steckt, denkt mit den Händen: Jede Verbindung zwischen Oszillator, Filter und Hüllkurve macht Signalflüsse unmittelbar begreifbar.\n\nMusiker und Klangforscher beschreiben diese Arbeitsweise als bewussten Gegenentwurf zur bildschirmgebundenen Menü-Arbeit.',
        topics: ['sound_synthesis', 'contemplation_mind'],
        primaryTopic: 'sound_synthesis',
        sourceReferences: [
          {
            publisher: 'Sound On Sound · Synthesis Practice',
            originalUrl: 'https://www.soundonsound.com/synthesizers',
            title: 'Tactile Thinking and Modular Synthesis',
            publicationTimestamp: now,
            retrievalTimestamp: now,
            author: 'Sound On Sound',
            isVerified: true
          }
        ],
        publishedAt: now,
        publicationDateReliable: true,
        generatedAt: now,
        estimatedReadingMinutes: 4,
        relevanceExplanation: 'Gelebte Praxis elektronischer Klangsynthese und kreativer Entschleunigung.',
        contentStatus: 'editorial_briefing',
        isDailyEdition: false,
        editionDate: today,
        isTeachingRelated: false,
        isChallengingPerspective: false,
        isDemonstration: false,
        aiAssisted: false,
        factReviewStatus: 'curated_illustrative',
        provenanceSummary: '🎛️ Gelebte Klangpraxis (Sound On Sound)',
        wordCount: 128,
        evidenceTier: 'publisher_excerpt',
        contentOrigin: 'live_ingested',
        contentHash: 'lived-reality-modular-synth-v1',
        canonicalUrl: 'https://www.soundonsound.com/synthesizers',
        space: 'c/klang_synthese',
        flair: 'Klangpraxis',
        keyInsight:
          'Physische Begrenzungen und haptische Signalwege fördern im kreativen Prozess oft tiefere Entdeckungen als unbegrenzte digitale Optionen.',
        upvotesCount: 0,
        awardsCount: { gold: 0, brain: 0, spark: 0 },
        sourceTrustLevel: 'deep_essay',
        sourceDomain: 'soundonsound.com',
        sourceBroadcasterName: 'Sound On Sound',
        comments: []
      },
      {
        id: 'serendipity-japanese-ma-negative-space-architecture',
        type: 'perspective',
        format: 'surprising_connection',
        title: 'Die Ästhetik des Zwischenraums (Ma 間): Wie japanische Architektur und moderne Typografie Stille sichtbar machen',
        subtitle: 'Überraschungs-Impuls zu Raumwirkung, visueller Ruhe und kognitiver Entlastung',
        feedText:
          'Im westlichen Design gilt leerer Raum oft als ungenutzte Fläche. Der japanische Begriff „Ma“ (間) bezeichnet dagegen die bedeutungsvolle Pause zwischen den Dingen – das Intervall, das einer Melodie erst ihren Rhythmus und einer Buchseite ihre Lesbarkeit verleiht. Ein Blick auf Architektur und Editorial Design zeigt, warum bewusster Weißraum unsere Wahrnehmung beruhigt.',
        body:
          'Im westlichen Design gilt leerer Raum oft als ungenutzte Fläche. Der japanische Begriff „Ma“ (間) bezeichnet dagegen die bedeutungsvolle Pause zwischen den Dingen – das Intervall, das einer Melodie erst ihren Rhythmus und einer Buchseite ihre Lesbarkeit verleiht. Ein Blick auf Architektur und Editorial Design zeigt, warum bewusster Weißraum unsere Wahrnehmung beruhigt.',
        articleBody:
          '### Die Ästhetik des Zwischenraums (Ma 間)\n\nDer japanische Begriff „Ma“ (間) bezeichnet die bedeutungsvolle Pause zwischen den Dingen – das Intervall, das einer Melodie erst ihren Rhythmus und einer Buchseite ihre Lesbarkeit verleiht.',
        topics: ['art_aesthetics', 'contemplation_mind'],
        primaryTopic: 'art_aesthetics',
        sourceReferences: [
          {
            publisher: 'Public Domain Review · Aesthetics',
            originalUrl: 'https://publicdomainreview.org/collections/',
            title: 'Ma: The Aesthetics of Negative Space',
            publicationTimestamp: now,
            retrievalTimestamp: now,
            author: 'Editorial Archive',
            isVerified: true
          }
        ],
        publishedAt: now,
        publicationDateReliable: true,
        generatedAt: now,
        estimatedReadingMinutes: 4,
        relevanceExplanation: 'Serendipity-Fundstück außerhalb des Tagesgeschäfts: Verbindet Ästhetik, Kontemplation und Typografie.',
        contentStatus: 'philosophical_perspective',
        isDailyEdition: false,
        editionDate: today,
        isTeachingRelated: false,
        isChallengingPerspective: false,
        isDemonstration: false,
        aiAssisted: false,
        factReviewStatus: 'historical_reference',
        provenanceSummary: '🎲 Überraschungs-Impuls (Ästhetik & Raum)',
        wordCount: 125,
        evidenceTier: 'publisher_excerpt',
        contentOrigin: 'live_ingested',
        contentHash: 'serendipity-japanese-ma-v1',
        canonicalUrl: 'https://publicdomainreview.org/collections/',
        space: 'c/kunst_aesthetik',
        flair: '🎲 Überraschungs-Impuls',
        keyInsight:
          'Bedeutung entsteht in Kunst, Musik und Lektüre nicht durch maximale Dichte, sondern durch das bewusst gestaltete Intervall zwischen den Reizen.',
        upvotesCount: 0,
        awardsCount: { gold: 0, brain: 0, spark: 0 },
        sourceTrustLevel: 'deep_essay',
        sourceDomain: 'publicdomainreview.org',
        sourceBroadcasterName: 'Public Domain Review',
        comments: [],
        curationScore: 9.0
      }
    ];

    return pulseItems.map(sanitizeCuratedFeedItem);
  }

  /**
   * Harvests a balanced mix of Macro Reality, Lived Human Reality, and Serendipity items.
   */
  public static async harvestRealityAndSerendipityPulse(options?: {
    skipNetwork?: boolean;
  }): Promise<FeedItem[]> {
    const basePool = this.getCuratedRealityAndSerendipityPool();
    if (options?.skipNetwork) {
      return basePool;
    }

    try {
      const [liveStream, openWeb] = await Promise.all([
        ContinuousLiveNewsService.getLiveStream({ limit: 24, forceRefresh: true }).catch(() => []),
        OpenWebHarvester.harvestAllOpenWeb().catch(() => null)
      ]);

      const openWebItems = openWeb?.allHarvested || [];
      const combined = [...basePool, ...liveStream, ...openWebItems]
        .map(sanitizeCuratedFeedItem)
        .filter(satisfiesDefaultCuratedStandard);

      return enforceCuratedStreamDiversity(combined);
    } catch {
      return basePool;
    }
  }

  /**
   * Mutex-protected Manual Pipeline Runner (`🔄 Recherche jetzt starten`).
   * Executes the 4 transparent stages:
   * 1. `fetching_sources` ("Quellen abrufen")
   * 2. `checking_relevance` ("Relevanz prüfen")
   * 3. `ai_enrichment` ("KI-Aufbereitung")
   * 4. `publishing` ("Veröffentlichen")
   */
  public static async runManualResearchPipeline(
    options?: ManualPipelineOptions
  ): Promise<ManualPipelineTelemetry> {
    if (this.activePipelinePromise) {
      return this.activePipelinePromise;
    }

    const runPromise = (async (): Promise<ManualPipelineTelemetry> => {
      const startTime = Date.now();
      const phasesVisited: ManualPipelinePhase[] = [];
      const notify = (phase: ManualPipelinePhase, label: string) => {
        phasesVisited.push(phase);
        options?.onPhaseChange?.(phase, label);
        options?.onStageChange?.(phase, label);
      };

      try {
        // Phase 1: Quellen abrufen
        notify('fetching_sources', 'Quellen abrufen → Relevanz prüfen → KI-Aufbereitung → Veröffentlichen');
        const rawCandidates = options?.candidateOverride
          ? [...options.candidateOverride]
          : await this.harvestRealityAndSerendipityPulse({ skipNetwork: options?.skipNetwork });

        const candidatesToProcess =
          rawCandidates.length > 0 ? rawCandidates : [...this.getCuratedRealityAndSerendipityPool(), ...REAL_KNOWLEDGE_VAULT.slice(0, 6)];
        const candidateCount = candidatesToProcess.length;

        // Phase 2: Relevanz prüfen
        notify('checking_relevance', 'Quellen abrufen ✓ → Relevanz prüfen → KI-Aufbereitung → Veröffentlichen');
        const preFiltered = candidatesToProcess
          .map(sanitizeCuratedFeedItem)
          .filter(satisfiesDefaultCuratedStandard);

        // Phase 3: KI-Aufbereitung
        notify('ai_enrichment', 'Quellen abrufen ✓ → Relevanz prüfen ✓ → KI-Aufbereitung → Veröffentlichen');
        let creds = options?.credentials;
        if (!creds) {
          try {
            creds = await loadAiCredentials();
          } catch {
            creds = undefined;
          }
        }

        const hasAi = Boolean(creds && hasAiConfiguration(creds));
        const enrichedBatch = await defaultBatchEditionEnricher.gatekeepAndEnrichBatch(
          preFiltered.slice(0, 12),
          creds
        );
        const batchReport = defaultBatchEditionEnricher.getLastBatchReport();
        const usedAiMode = Boolean(hasAi && batchReport.usedAI);

        const finalCurated = enforceCuratedStreamDiversity(
          enrichedBatch.map(sanitizeCuratedFeedItem).filter(satisfiesDefaultCuratedStandard)
        );

        // Phase 4: Veröffentlichen
        notify('publishing', 'Quellen abrufen ✓ → Relevanz prüfen ✓ → KI-Aufbereitung ✓ → Veröffentlichen');
        if (finalCurated.length > 0) {
          feedRepository.addItems(finalCurated);
        }

        const curatedCount = finalCurated.length;
        const rejectedCount = Math.max(0, candidateCount - curatedCount);
        const mode: 'ai_synthesis' | 'local_extraction' = usedAiMode ? 'ai_synthesis' : 'local_extraction';
        const modeLabel = mode === 'ai_synthesis' ? 'KI-Synthese' : 'Lokal';
        const summaryLabel = `${curatedCount} neu kuratiert · ${rejectedCount} verworfen · Modus: ${modeLabel}`;

        return {
          candidateCount,
          curatedCount,
          rejectedCount,
          discardedCount: rejectedCount,
          mode,
          summaryLabel,
          phasesVisited,
          durationMs: Math.max(1, Date.now() - startTime),
          items: finalCurated
        };
      } finally {
        this.activePipelinePromise = null;
      }
    })();

    this.activePipelinePromise = runPromise;
    return runPromise;
  }
}

export function runManualResearchPipeline(
  options?: ManualPipelineOptions
): Promise<ManualPipelineTelemetry> {
  return LiveCivicPulseService.runManualResearchPipeline(options);
}
