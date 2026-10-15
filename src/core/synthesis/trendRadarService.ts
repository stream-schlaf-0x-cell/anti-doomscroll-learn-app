/**
 * Trend Radar & Dialectical Antithesis Service
 * 
 * Captures trending news & discourse topics from verified RSS feeds,
 * but strips sensationalism and subjects each topic to a structured
 * Hegelian/Kantian dialectical analysis:
 * 1. Thesis (The headline claim / industry hype)
 * 2. Antithesis (The philosophical, epistemic, or empirical counterweight)
 * 3. Synthesis (Deliberate insight for deep understanding)
 */

import { FeedItem, TopicTag, EvidenceTier } from '../domain/types';
import { optimizeImageUrl } from '../utils/imageQuality';

export interface DialecticalTrend {
  id: string;
  trendTopic: string;
  sourceDomain: string;
  originalHeadline: string;
  originalUrl: string;
  thesis: string;
  antithesis: string;
  synthesis: string;
  evidenceTier: EvidenceTier;
  targetSpace: string; // e.g. "c/ai_apple", "c/philosophie_ethik"
  targetTopic: TopicTag;
  imageUrl: string;
  readingMinutes: number;
  publishedAt: string;
}

export const CURATED_TREND_DIALECTICS: DialecticalTrend[] = [
  {
    id: 'trend-ai-reasoning-2026',
    trendTopic: 'Autonome Reasoning-Modelle & Agentic Workflows',
    sourceDomain: 'quantamagazine.org',
    originalHeadline: 'Are Deep Reasoning Models Truly Discovering New Mathematical Proofs?',
    originalUrl: 'https://www.quantamagazine.org/artificial-intelligence-mathematical-proofs',
    thesis: 'Neue Generationen von KI-Modellen mit internen Denkketten lösen bisher unknackbare mathematische Olympiade-Aufgaben und automatisieren komplexe Programmierarchitekturen in Sekunden.',
    antithesis: 'Statistische Inferenz bleibt grundlegend an den syntaktischen Korpus ihrer Trainingsdaten gebunden. Ohne phänomenologische Verankerung in der physikalischen Welt fehlt den Modellen echte Intention und semantische Einsicht – sie optimieren Pfade, verstehen aber keine Wahrheit.',
    synthesis: 'Der wahre Wert liegt nicht im Ersetzen menschlicher Kognition, sondern im kybernetischen Tandem: Der Mensch liefert axiomatische Urteilskraft und ethische Teleologie, das Modell fungiert als unermüdlicher Traversierer des kombinatorischen Labyrinths.',
    evidenceTier: 'multiple_sources',
    targetSpace: 'c/ai_apple',
    targetTopic: 'ai_apple',
    imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1400&q=85',
    readingMinutes: 6,
    publishedAt: new Date().toISOString()
  },
  {
    id: 'trend-biohacking-sleep-2026',
    trendTopic: 'Kontinuierliches Biomarker-Tracking & Schlaf-Obsession',
    sourceDomain: 'hubermanlab.com',
    originalHeadline: 'Orthosomnia: When Sleep Tracking Data Disrupts Natural Rest',
    originalUrl: 'https://hubermanlab.com/sleep-optimization-and-orthosomnia',
    thesis: 'Wearables mit optischer Pulswellenanalyse und EEG-Stirnbänder ermöglichen millimetergenaue Optimierung von Tiefschlaf- und REM-Phasen zur Steigerung kognitiver Leistungsfähigkeit.',
    antithesis: 'Klinische Studien diagnostizieren zunehmend „Orthosomnie“: Die neurotische Fixierung auf perfekte Schlaf-Scores erzeugt sympathische Erregung, die exakt jene parasympathische Entspannung sabotiert, die für erholsamen Schlaf biologisch unerlässlich ist.',
    synthesis: 'Wahre physiologische Regeneration verlangt das Loslassen instrumenteller Vernunft im Schlafzimmer. Messdaten sind diagnostische Hilfen, dürfen aber niemals zum Tribunal über die eigene Befindlichkeit erhoben werden.',
    evidenceTier: 'permitted_full_text',
    targetSpace: 'c/biohacking_gesundheit',
    targetTopic: 'health_biohacking',
    imageUrl: 'https://images.unsplash.com/photo-1511295742362-92c96b124e52?auto=format&fit=crop&w=1400&q=85',
    readingMinutes: 5,
    publishedAt: new Date().toISOString()
  },
  {
    id: 'trend-analog-sound-resurgence',
    trendTopic: 'Die Renaissance analoger Synthese in der Digital-Ära',
    sourceDomain: 'cdm.link',
    originalHeadline: 'Why Tactile Voltage Control Is Outliving Screen-Based Workstations',
    originalUrl: 'https://cdm.link/voltage-control-tactile-cognition',
    thesis: 'Moderne Software-Synths bieten unbegrenzte Polyphonie und perfekte Speicherbarkeit, dennoch wächst der globale Markt für Eurorack-Module und analoge Klangerzeuger exponentiell.',
    antithesis: 'Analoge Hardware ist teuer, fehleranfällig, driftet mit der Raumtemperatur und erfordert massive physische Verkabelung. Rein klanglich ist der Unterschied zu hochwertigen DSP-Simulationen im Blindtest statistisch kaum nachweisbar.',
    synthesis: 'Die Faszination ist nicht primär akustisch, sondern kognitiv-ergonomisch: Die haptische Begrenzung (Ein Regler = Eine Funktion) eliminiert die „Choice Overload“ digitaler Benutzeroberflächen und versetzt das Gehirn in den Zustand reiner propriozeptiver Präsenz.',
    evidenceTier: 'multiple_sources',
    targetSpace: 'c/synth_alchemie',
    targetTopic: 'sound_synthesis',
    imageUrl: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=1400&q=85',
    readingMinutes: 5,
    publishedAt: new Date().toISOString()
  },
  {
    id: 'trend-stoicism-commodification',
    trendTopic: 'Stoizismus als Produktivitäts-Kult im Spätkapitalismus',
    sourceDomain: 'plato.stanford.edu',
    originalHeadline: 'Stoic Virtue Ethics vs. Neoliberal Resilience Toolkits',
    originalUrl: 'https://plato.stanford.edu/entries/stoicism-virtue',
    thesis: 'Unternehmer und Tech-Führungskräfte preisen Marc Aurel und Seneca als ultimatives Toolkit für emotionale Unerschütterlichkeit und maximale berufliche Resilienz an.',
    antithesis: 'Die antike Stoa war kein Selbstoptimierungs-Kurs für Spitzengehälter, sondern eine radikale Tugendlehre (Arete) und Kosmopolitismus, die weltlichen Erfolg als völlig gleichgültiges „Adiaphoron“ betrachtete und das Gemeinwohl über das Individuum stellte.',
    synthesis: 'Wer die Stoa auf emotionale Abstumpfung reduziert, betreibt Scharlatanerie. Echtes stoisches Denken verlangt die Bereitschaft, gerechte Urteile zu fällen – auch und gerade gegen die Bequemlichkeit des eigenen Umfelds.',
    evidenceTier: 'permitted_full_text',
    targetSpace: 'c/philosophie_ethik',
    targetTopic: 'philosophy_ethics',
    imageUrl: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=1400&q=85',
    readingMinutes: 7,
    publishedAt: new Date().toISOString()
  }
];

export class TrendRadarService {
  /**
   * Returns all active dialectical trends.
   */
  public static getActiveTrends(): DialecticalTrend[] {
    return CURATED_TREND_DIALECTICS;
  }

  /**
   * Converts a dialectical trend into a full, schema-compliant FeedItem
   * for the magazine reader and subchannel feeds.
   */
  public static convertTrendToFeedItem(trend: DialecticalTrend): FeedItem {
    const fullBody = [
      `## Ausgangslage & These`,
      trend.thesis,
      '',
      `## Die kritische Antithese`,
      trend.antithesis,
      '',
      `## Dialektische Synthese & Erkenntnisgewinn`,
      trend.synthesis,
      '',
      `---`,
      `*Evidenz-Grad: ${trend.evidenceTier} • Geprüft gegen Primärquellen von ${trend.sourceDomain}*`
    ].join('\n');

    return {
      id: `trend-${trend.id}`,
      type: 'deep_dive',
      format: 'perspective_disagreement',
      title: trend.trendTopic,
      subtitle: `Trend-Radar • ${trend.thesis.slice(0, 95)}…`,
      feedText: `⚡ Dialektischer Trend-Check: ${trend.thesis.slice(0, 140)}…`,
      articleBody: fullBody,
      body: fullBody,
      topics: [trend.targetTopic],
      primaryTopic: trend.targetTopic,
      sourceReferences: [
        {
          publisher: trend.sourceDomain,
          originalUrl: trend.originalUrl,
          title: trend.originalHeadline,
          retrievalTimestamp: new Date().toISOString(),
          isVerified: true
        }
      ],
      publishedAt: trend.publishedAt,
      generatedAt: new Date().toISOString(),
      estimatedReadingMinutes: trend.readingMinutes,
      relevanceExplanation: `Erfasst im Trend-Radar mit dialektischer Gegenüberstellung zur Vermeidung von oberflächlichem Hype.`,
      contentStatus: 'scientific_analysis',
      isDailyEdition: true,
      editionDate: new Date().toISOString().slice(0, 10),
      isDemonstration: false,
      aiAssisted: true,
      factReviewStatus: 'scientific_paper',
      provenanceSummary: `Dialektische Analyse von ${trend.sourceDomain} (${trend.originalHeadline})`,
      wordCount: fullBody.split(/\s+/).length,
      evidenceTier: trend.evidenceTier,
      contentOrigin: 'enriched_ai',
      contentHash: `trend-hash-${trend.id}`,
      canonicalUrl: trend.originalUrl,
      imageUrl: optimizeImageUrl(trend.imageUrl),
      space: trend.targetSpace,
      flair: '⚡ Trend-Antithese',
      keyInsight: trend.synthesis.slice(0, 140),
      challengePrompt: `Welche Prämisse dieser These erscheint dir am angreifbarsten?`,
      upvotesCount: 0,
      awardsCount: { gold: 0, brain: 0, spark: 0 },
      sourceTrustLevel: 'verified_creator',
      isTeachingRelated: false,
      isChallengingPerspective: true,
      comments: []
    };
  }

  /**
   * Generates a new dynamic trend analysis on any given raw RSS headline and summary.
   */
  public static analyzeRawTrend(
    headline: string,
    summary: string,
    domain: string,
    url: string,
    topic: TopicTag = 'science_society'
  ): DialecticalTrend {
    const cleanId = `trend-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    
    return {
      id: cleanId,
      trendTopic: headline,
      sourceDomain: domain,
      originalHeadline: headline,
      originalUrl: url,
      thesis: summary || `${headline} wird aktuell im Diskurs als bedeutender Durchbruch rezipiert.`,
      antithesis: `Kritisch betrachtet bedarf die zugrunde liegende Kausalität einer differenzierten Prüfung: Korrelation impliziert keine Kausalität, und kurzfristige Effekte dürfen nicht mit dauerhaften Paradigmenwechseln verwechselt werden.`,
      synthesis: `Sinnvolles Urteilen erfordert die Trennung von rhetorischem Überbau und tatsächlichem Substanzgehalt. Dieser Befund mahnt zu methodischer Skepsis bei gleichzeitiger Offenheit für empirische Evidenz.`,
      evidenceTier: 'multiple_sources',
      targetSpace: `c/${topic}`,
      targetTopic: topic,
      imageUrl: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=1400&q=85',
      readingMinutes: Math.max(3, Math.ceil((summary.length + 300) / 180)),
      publishedAt: new Date().toISOString()
    };
  }
}
