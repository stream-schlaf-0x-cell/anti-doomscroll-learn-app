import { IContentEnricher, EnrichmentRequest, EnrichmentResult } from './types';
import { EnrichmentUsageLedger, defaultUsageLedger, calculateCostEur } from './ledger';
import { EnrichmentCache, defaultEnrichmentCache } from './cache';
import { synthesizeDidacticTransfer } from '../synthesis/backgroundResearchPipeline';

export const CURRENT_PROMPT_VERSION = 'v2-oct2026-de';

/**
 * Heuristic zero-cost synthesizer.
 * Does not make external network requests or spend tokens.
 * Produces structured German content directly from source facts and metadata.
 */
export class SourceOnlyEnricher implements IContentEnricher {
  async enrich(request: EnrichmentRequest): Promise<EnrichmentResult> {
    const { item } = request;
    const paragraphs = item.body.split('\n\n').filter(p => p.trim().length > 0);

    // Standalone reading substance for the feed card: first two substantial paragraphs
    let feedText = paragraphs.slice(0, 2).join('\n\n');
    if (feedText.length < 80 && item.subtitle) {
      feedText = `${item.subtitle}\n\n${feedText}`;
    }
    if (!feedText || feedText.length < 30) {
      feedText = `${item.title}: Ein neuer Beitrag aus ${item.sourceReferences[0]?.publisher || 'der Fachquelle'}.`;
    }

    const publisher = item.sourceReferences[0]?.publisher || 'der Fachquelle';
    const author = item.sourceReferences[0]?.author || publisher;

    const relevanceExplanation = item.isTeachingRelated
      ? `Relevanter pädagogischer Impuls aus ${publisher} für Didaktik, Urteilsbildung und Unterrichtsreflexion.`
      : item.isChallengingPerspective
      ? `Herausfordernde Perspektive von ${author} (${publisher}), die gängige Annahmen hinterfragt.`
      : `Aktuelle Erkenntnis aus ${publisher} zum Themenbereich ${item.primaryTopic}.`;

    const perspectiveDetails = item.isChallengingPerspective
      ? {
          claim: item.title,
          interpretation: item.subtitle,
          humanSource: author
        }
      : undefined;

    const didacticSeed = item.didacticSeed || synthesizeDidacticTransfer(
      item.title,
      item.body,
      item.primaryTopic,
      item.isTeachingRelated
    );

    return {
      feedText,
      relevanceExplanation,
      perspectiveDetails,
      didacticSeed,
      counterArgument: undefined,
      modelUsed: 'source_only_heuristic',
      promptVersion: CURRENT_PROMPT_VERSION,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostEur: 0,
      isFallback: true
    };
  }
}

/**
 * Controllable Mock Enricher for deterministic unit and integration tests.
 */
export class MockEnricher implements IContentEnricher {
  constructor(
    public inputTokens: number = 850,
    public outputTokens: number = 220,
    public simulateBudgetExceeded: boolean = false
  ) {}

  async enrich(request: EnrichmentRequest): Promise<EnrichmentResult> {
    const { item } = request;
    const cost = calculateCostEur(this.inputTokens, this.outputTokens);

    return {
      feedText: `[KI-Synthese] ${item.title}: Standalone-Analyse des Kernarguments mit didaktischer Tiefe.`,
      relevanceExplanation: `Didaktisch und philosophisch relevant für das Themenfeld ${item.primaryTopic}.`,
      perspectiveDetails: item.isChallengingPerspective
        ? {
            claim: item.title,
            interpretation: 'Analytische Einordnung der Gegenposition.',
            counterPerspective: 'Pragmatische Einwandlinie.',
            humanSource: item.sourceReferences[0]?.author || 'Fachquelle'
          }
        : undefined,
      didacticSeed: item.isTeachingRelated ? 'Sokratische Fragestellung für den Unterricht.' : undefined,
      counterArgument: 'Möglicher systemischer Einwand.',
      modelUsed: 'gemini-3.8-flash',
      promptVersion: CURRENT_PROMPT_VERSION,
      inputTokens: this.inputTokens,
      outputTokens: this.outputTokens,
      estimatedCostEur: cost,
      isFallback: false
    };
  }
}

/**
 * Provider-Independent Content Enricher:
 * - Checks cache by contentHash + promptVersion first (0 cost on hit)
 * - Checks monthly budget ceiling via EnrichmentUsageLedger
 * - Uses active provider if budget allows, otherwise seamlessly falls back to SourceOnlyEnricher
 * - Records usage into ledger and writes to cache
 */
export class ProviderEnricher implements IContentEnricher {
  private fallbackEnricher = new SourceOnlyEnricher();

  constructor(
    private readonly ledger: EnrichmentUsageLedger = defaultUsageLedger,
    private readonly cache: EnrichmentCache = defaultEnrichmentCache,
    private readonly underlyingEnricher?: IContentEnricher,
    private readonly promptVersion: string = CURRENT_PROMPT_VERSION
  ) {}

  async enrich(request: EnrichmentRequest): Promise<EnrichmentResult> {
    const { item } = request;
    const contentHash = item.contentHash || item.id;

    // 1. Check cache
    const cached = await this.cache.get(contentHash, this.promptVersion);
    if (cached) {
      return cached;
    }

    // 2. Check and atomically reserve budget ceiling
    const estimatedCost = 0.001; // estimated upper-bound cost per call
    const reservationId = await this.ledger.reserveSpend(estimatedCost);
    if (!reservationId || !this.underlyingEnricher) {
      // Budget cap reached or zero-cost mode: use source-only fallback
      const fallbackResult = await this.fallbackEnricher.enrich(request);
      await this.cache.set(contentHash, this.promptVersion, fallbackResult);
      return fallbackResult;
    }

    // 3. Execute via underlying enricher
    try {
      const result = await this.underlyingEnricher.enrich(request);

      // Commit actual spend against reservation in persistent ledger
      await this.ledger.commitReservation(reservationId, {
        itemId: item.id,
        model: result.modelUsed,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        costEur: result.estimatedCostEur
      });

      // Cache result
      await this.cache.set(contentHash, this.promptVersion, result);
      return result;
    } catch {
      // Release reservation and use graceful fallback on error
      await this.ledger.releaseReservation(reservationId);
      const fallbackResult = await this.fallbackEnricher.enrich(request);
      return fallbackResult;
    }
  }
}
