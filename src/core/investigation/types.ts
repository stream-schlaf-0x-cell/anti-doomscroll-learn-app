export type EvidenceType = 'observation' | 'interpretation' | 'causal_claim' | 'normative_statement';

export type ClaimConfidence = 'direct_quote' | 'reasonable_inference' | 'unverified_claim';

export interface GroundedClaim {
  id: string;
  claim: string;
  exactQuote: string;
  sourceId: string;
  sourceTitle: string;
  sourceUrl?: string;
  evidenceType: EvidenceType;
  confidence: ClaimConfidence;
  paragraphIndex?: number;
}

export type ActionType = 'trace' | 'challenge' | 'connect' | 'create';

export interface SuggestedAction {
  id: string;
  type: ActionType;
  label: string;
  promptOrAction: string;
  rationale: string;
}

export type InvestigationUpdateCategory =
  | 'new_evidence'
  | 'counter_argument'
  | 'methodological_difference'
  | 'correction'
  | 'repetition';

export interface InvestigationDiff {
  category: InvestigationUpdateCategory;
  summary: string;
  details: string[];
  impactOnPreviousClaims: string;
}

export interface InvestigationResult {
  version: number;
  timestamp: string;
  synthesisSummary: string;
  groundedClaims: GroundedClaim[];
  limitationsAndCounterpoints: string[];
  openQuestions: string[];
  suggestedNextSteps: SuggestedAction[];
  diffFromPreviousVersion?: InvestigationDiff;
  modelUsed: string;
  promptVersion: string;
  executionMode: 'ai_real' | 'deterministic_fallback' | 'cached';
  tokenUsage?: {
    inputTokens: number;
    outputTokens: number;
    costEur?: number;
  };
}

export interface InvestigationSource {
  id: string;
  title: string;
  publisher?: string;
  author?: string;
  url?: string;
  publishedAt?: string;
  fullTextAvailable: boolean;
  wordCount: number;
  evidenceTier?: string;
  contentSnippet: string;
}

export type InvestigationStatus = 'idle' | 'analyzing' | 'completed' | 'error' | 'cancelled';

export interface Investigation {
  id: string;
  title: string;
  question: string;
  scope: 'single_source' | 'multi_source' | 'deep_dive';
  sources: InvestigationSource[];
  status: InvestigationStatus;
  currentResult?: InvestigationResult;
  historyVersions: InvestigationResult[];
  userVerdict?: string;
  userNotes: string[];
  connectedThoughtNodeIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface InvestigationRequest {
  question: string;
  sources: InvestigationSource[];
  scope?: 'single_source' | 'multi_source' | 'deep_dive';
  additionalUserNote?: string;
  compareWithPreviousResult?: InvestigationResult;
}
