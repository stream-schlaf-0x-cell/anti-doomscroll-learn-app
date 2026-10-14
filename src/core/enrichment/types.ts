import { FeedItem, PerspectiveDetails } from '../domain/types';

export interface EnrichmentRequest {
  item: FeedItem;
  targetLanguage?: 'de' | 'en';
}

export interface EnrichmentResult {
  feedText: string;
  relevanceExplanation: string;
  perspectiveDetails?: PerspectiveDetails;
  didacticSeed?: string;
  counterArgument?: string;
  modelUsed: string;
  promptVersion: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostEur: number;
  isFallback: boolean;
}

export interface EnrichmentLedgerEntry {
  timestamp: string;
  itemId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costEur: number;
}

export interface EnrichmentLedgerSummary {
  monthKey: string; // e.g. '2026-10'
  totalCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostEur: number;
  budgetLimitEur: number;
  isBudgetExceeded: boolean;
  entries: EnrichmentLedgerEntry[];
}

export interface IContentEnricher {
  enrich(request: EnrichmentRequest): Promise<EnrichmentResult>;
}
