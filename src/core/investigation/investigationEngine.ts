import {
  InvestigationRequest,
  InvestigationResult,
  InvestigationSource,
  GroundedClaim,
  SuggestedAction,
  InvestigationDiff,
  EvidenceType
} from './types';
import { callAiModel, DEFAULT_GEMINI_MODEL, extractJsonFromAiResponse } from '../ai/atmenAiClient';
import { appStorage, AtemStorage } from '../data/storage';

export const INVESTIGATION_PROMPT_VERSION = '2026-10-18-v1';
export const INVESTIGATION_CACHE_KEY = '@atem:investigation_cache:v1';

/**
 * Sanitizes untrusted source text to neutralize prompt injection attempts
 * while preserving legitimate informational content.
 */
export function sanitizeSourceText(text: string): string {
  if (!text) return '';
  return text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/(?:ignore|disregard|forget)\s+(?:all\s+)?(?:previous|prior)\s+instructions/gi, '[Gefilterter Befehlstext]')
    .replace(/system\s*:\s*/gi, '')
    .replace(/\b(API_KEY|BEARER_TOKEN|SECRET_KEY)\b/gi, '[Gefiltertes Token]')
    .trim();
}

/**
 * Deterministic hash for caching query and source content.
 */
export function computeInvestigationCacheKey(
  question: string,
  sources: InvestigationSource[],
  modelId = 'default'
): string {
  const sourcePayload = sources
    .map(s => `${s.id}:${s.contentSnippet.slice(0, 160)}`)
    .sort()
    .join('|');
  const normalizedQuestion = question.trim().toLowerCase();
  return `${normalizedQuestion}:::${sourcePayload}:::${INVESTIGATION_PROMPT_VERSION}:::${modelId}`;
}

export class InvestigationEngine {
  private activeControllers = new Map<string, AbortController>();

  constructor(private readonly storage: AtemStorage = appStorage) {}

  /**
   * Cancel an in-flight investigation run.
   */
  cancelInvestigation(investigationId: string): void {
    const controller = this.activeControllers.get(investigationId);
    if (controller) {
      controller.abort();
      this.activeControllers.delete(investigationId);
    }
  }

  /**
   * Run an investigation for a given question and set of sources.
   */
  async runInvestigation(
    investigationId: string,
    request: InvestigationRequest
  ): Promise<InvestigationResult> {
    const controller = new AbortController();
    this.activeControllers.set(investigationId, controller);

    try {
      // 1. Check local cache
      const cacheKey = computeInvestigationCacheKey(request.question, request.sources);
      const cached = await this.getCachedResult(cacheKey);
      if (cached && !request.compareWithPreviousResult) {
        return {
          ...cached,
          executionMode: 'cached'
        };
      }

      // 2. Prepare and sanitize sources (max 3 sources per initial run to respect user limits)
      const allowedSources = request.sources.slice(0, 3);
      const sanitizedSources = allowedSources.map(s => ({
        ...s,
        contentSnippet: sanitizeSourceText(s.contentSnippet)
      }));

      // Check abort
      if (controller.signal.aborted) {
        throw new Error('Untersuchung wurde vom Nutzer abgebrochen.');
      }

      // 3. Attempt AI run using existing atmenAiClient
      try {
        const aiResult = await this.runAiInvestigation(
          request.question,
          sanitizedSources,
          request.additionalUserNote,
          request.compareWithPreviousResult,
          controller.signal
        );

        // Cache the successful AI result
        await this.setCachedResult(cacheKey, aiResult);
        return aiResult;
      } catch {
        if (controller.signal.aborted) {
          throw new Error('Untersuchung wurde vom Nutzer abgebrochen.');
        }
        // If AI call failed due to offline/missing key/rate limit, fall back to deterministic extraction
        return this.runDeterministicFallback(
          request.question,
          sanitizedSources,
          request.compareWithPreviousResult
        );
      }
    } finally {
      this.activeControllers.delete(investigationId);
    }
  }

  private async runAiInvestigation(
    question: string,
    sources: InvestigationSource[],
    userNote?: string,
    previousResult?: InvestigationResult,
    signal?: AbortSignal
  ): Promise<InvestigationResult> {
    const systemInstruction = `Du bist die epistemische Recherche- und Analyse-Engine von Atmen.
Deine Aufgabe ist eine streng belegte, nüchterne und differenzierte Untersuchung zu einer Leitfrage anhand des bereitgestellten Quellenmaterials.

VERBINDLICHE REGELN:
1. Erfinde KEINE Zitate und KEINE Belege. Jedes Zitat MUSS wörtlich im Quellentext vorkommen.
2. Unterscheide sauber nach Evidenz-Typ:
   - 'observation': Unmittelbare empirische Beobachtung, Zahl, Messergebnis.
   - 'interpretation': Theoretische Schlussfolgerung der Autoren.
   - 'causal_claim': Behauptung einer Ursache-Wirkungs-Beziehung.
   - 'normative_statement': Werturteil oder Handlungsempfehlung.
3. Benenne methodische Grenzen, kleine Stichproben oder alternative Erklärungen.
4. Gib das Ergebnis AUSSCHLIESSLICH als valides JSON zurück mit folgender Struktur:
{
  "synthesisSummary": "Kompakte, präzise Synthese (2-4 Absätze)",
  "groundedClaims": [
    {
      "id": "c1",
      "claim": "Präzise formulierte Einzelaussage",
      "exactQuote": "Wörtliches Zitat aus der Quelle",
      "sourceId": "id-der-quelle",
      "sourceTitle": "Titel der Quelle",
      "evidenceType": "observation" | "interpretation" | "causal_claim" | "normative_statement",
      "confidence": "direct_quote" | "reasonable_inference" | "unverified_claim"
    }
  ],
  "limitationsAndCounterpoints": ["Grenze 1", "Möglicher Gegenbeweis 2"],
  "openQuestions": ["Offener Punkt 1", "Was die Quellen nicht beantworten"],
  "suggestedNextSteps": [
    {
      "id": "s1",
      "type": "trace" | "challenge" | "connect" | "create",
      "label": "Kurze Aktionsbezeichnung",
      "promptOrAction": "Konkreter Schritt",
      "rationale": "Warum dieser Schritt lohnend ist"
    }
  ]
}`;

    let prompt = `LEITFRAGE: "${question}"\n\n`;
    if (userNote?.trim()) {
      prompt += `EIGENE NUTZER-NOTIZ (vom Nutzer ausdrücklich zur Analyse freigegeben):\n"${userNote.trim()}"\n\n`;
    }

    prompt += `VERFÜGBARE QUELLEN:\n`;
    for (const s of sources) {
      prompt += `---
QUELLE ID: ${s.id}
TITEL: ${s.title}
HERKUNFT / AUTOR: ${s.publisher || s.author || 'Unbekannt'}
URL: ${s.url || 'Keine'}
VOLLTEXT / AUSZUG:
${s.contentSnippet.slice(0, 4000)}
---\n`;
    }

    if (previousResult) {
      prompt += `\nVORHERIGER UNTERSUCHUNGSSTAND (Prüfe, was die neuen Quellen verändern):\n`;
      prompt += `Bisherige Synthese: ${previousResult.synthesisSummary}\n`;
      prompt += `Bisherige Belege: ${previousResult.groundedClaims.map(c => c.claim).join('; ')}\n`;
    }

    if (signal?.aborted) throw new Error('Abgebrochen');

    const response = await callAiModel(prompt, {
      systemInstruction,
      jsonMode: true,
      maxTokens: 2500,
      timeoutMs: 35_000
    });

    let parsedObj: Record<string, unknown>;
    try {
      const extracted = extractJsonFromAiResponse<unknown>(response.text);
      if (!extracted || typeof extracted !== 'object' || Array.isArray(extracted)) {
        throw new SyntaxError('Antwort war kein JSON-Objekt.');
      }
      parsedObj = extracted as Record<string, unknown>;
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      throw new Error(`Antwort konnte nicht als strukturiertes JSON interpretiert werden (${detail}).`);
    }

    const versionNum = previousResult ? previousResult.version + 1 : 1;
    const rawClaims = Array.isArray(parsedObj.groundedClaims) ? parsedObj.groundedClaims : [];
    const groundedClaims: GroundedClaim[] = rawClaims
      .filter((c): c is Record<string, unknown> => Boolean(c && typeof c === 'object'))
      .map((c, idx) => ({
        id: typeof c.id === 'string' && c.id ? c.id : `claim-${versionNum}-${idx + 1}`,
        claim: typeof c.claim === 'string' && c.claim ? c.claim : 'Belegte Aussage',
        exactQuote: typeof c.exactQuote === 'string' ? c.exactQuote : '',
        sourceId: typeof c.sourceId === 'string' && c.sourceId ? c.sourceId : sources[0]?.id || 'src-1',
        sourceTitle: typeof c.sourceTitle === 'string' && c.sourceTitle ? c.sourceTitle : sources[0]?.title || 'Quelle',
        sourceUrl: typeof c.sourceUrl === 'string' ? c.sourceUrl : sources[0]?.url,
        evidenceType: (['observation', 'interpretation', 'causal_claim', 'normative_statement'].includes(String(c.evidenceType))
          ? c.evidenceType
          : 'interpretation') as EvidenceType,
        confidence: (['direct_quote', 'reasonable_inference', 'unverified_claim'].includes(String(c.confidence))
          ? c.confidence
          : 'reasonable_inference') as GroundedClaim['confidence']
      }));

    let diff: InvestigationDiff | undefined;
    if (previousResult) {
      diff = this.calculateDiff(previousResult, groundedClaims, sources);
    }

    const rawNextSteps = Array.isArray(parsedObj.suggestedNextSteps) ? parsedObj.suggestedNextSteps : [];

    return {
      version: versionNum,
      timestamp: new Date().toISOString(),
      synthesisSummary:
        typeof parsedObj.synthesisSummary === 'string' && parsedObj.synthesisSummary.trim()
          ? parsedObj.synthesisSummary.trim()
          : 'Synthese konnte erstellt werden.',
      groundedClaims,
      limitationsAndCounterpoints: Array.isArray(parsedObj.limitationsAndCounterpoints)
        ? parsedObj.limitationsAndCounterpoints.map(String)
        : [],
      openQuestions: Array.isArray(parsedObj.openQuestions)
        ? parsedObj.openQuestions.map(String)
        : [],
      suggestedNextSteps: rawNextSteps
        .filter((s): s is Record<string, unknown> => Boolean(s && typeof s === 'object'))
        .slice(0, 3)
        .map((s, idx) => ({
          id: typeof s.id === 'string' && s.id ? s.id : `step-${idx + 1}`,
          type: (['trace', 'challenge', 'connect', 'create'].includes(String(s.type))
            ? s.type
            : 'trace') as SuggestedAction['type'],
          label: typeof s.label === 'string' && s.label ? s.label : 'Nächster Schritt',
          promptOrAction: typeof s.promptOrAction === 'string' ? s.promptOrAction : '',
          rationale: typeof s.rationale === 'string' ? s.rationale : ''
        })),
      diffFromPreviousVersion: diff,
      modelUsed: response.modelUsed || DEFAULT_GEMINI_MODEL,
      promptVersion: INVESTIGATION_PROMPT_VERSION,
      executionMode: 'ai_real',
      tokenUsage: {
        inputTokens: response.usage.inputTokens,
        outputTokens: response.usage.outputTokens,
        costEur: response.usage.costEur
      }
    };
  }

  /**
   * Deterministic local fallback when offline, no API key, or network blocked.
   * Extracts verbatim quotes and structure without faking AI generation.
   */
  runDeterministicFallback(
    question: string,
    sources: InvestigationSource[],
    previousResult?: InvestigationResult
  ): InvestigationResult {
    const claims: GroundedClaim[] = [];
    const limitations: string[] = [];
    const openQuestions: string[] = [];

    const primarySource = sources[0];

    for (const currentSource of sources) {
      const text = currentSource?.contentSnippet || '';
      const rawSentences = text
        .split(/(?<=[.!?])\s+/)
        .map(s => s.trim())
        .filter(s => s.length > 15 && s.length < 350);

      for (let i = 0; i < rawSentences.length; i++) {
        const sentence = rawSentences[i];
        const lower = sentence.toLowerCase();

        // Check for counter / contradiction words
        const isCounter = /(widerlegt|falsifiziert|widerspricht|gegenteil|kein effekt|nicht signifikant|keinen unterschied)/i.test(sentence);

        if (isCounter && claims.length < 6) {
          claims.push({
            id: `claim-det-${claims.length + 1}`,
            claim: sentence.length > 100 ? `${sentence.slice(0, 96)}…` : sentence,
            exactQuote: sentence,
            sourceId: currentSource.id,
            sourceTitle: currentSource.title,
            sourceUrl: currentSource.url,
            evidenceType: 'observation',
            confidence: 'direct_quote',
            paragraphIndex: i
          });
        } else if (
          (/\d+%|\d+\s*(prozent|studie|teilnehmer|jahre|daten|probanden)/i.test(sentence) ||
            lower.includes('fanden heraus') ||
            lower.includes('ergab') ||
            lower.includes('zeigte')) &&
          claims.length < 6
        ) {
          claims.push({
            id: `claim-det-${claims.length + 1}`,
            claim: sentence.length > 100 ? `${sentence.slice(0, 96)}…` : sentence,
            exactQuote: sentence,
            sourceId: currentSource.id,
            sourceTitle: currentSource.title,
            sourceUrl: currentSource.url,
            evidenceType: 'observation',
            confidence: 'direct_quote',
            paragraphIndex: i
          });
        } else if (
          (lower.includes('jedoch') ||
            lower.includes('allerdings') ||
            lower.includes('grenze') ||
            lower.includes('eingeschränkt') ||
            lower.includes('widerspruch')) &&
          limitations.length < 3
        ) {
          limitations.push(`Aus „${currentSource.title}“: „${sentence}“`);
        }
      }
    }

    // Ensure at least one claim
    if (claims.length === 0 && primarySource) {
      const fallbackSnippet = primarySource.contentSnippet.trim();
      const firstSentence = fallbackSnippet.split(/(?<=[.!?])\s+/)[0] || fallbackSnippet.slice(0, 100);
      claims.push({
        id: 'claim-det-1',
        claim: firstSentence,
        exactQuote: firstSentence,
        sourceId: primarySource.id,
        sourceTitle: primarySource.title,
        sourceUrl: primarySource.url,
        evidenceType: 'interpretation',
        confidence: 'direct_quote'
      });
    }

    if (limitations.length === 0) {
      limitations.push(
        primarySource?.fullTextAvailable
          ? 'Die Analyse beruht ausschließlich auf dem bereitgestellten Primärtext ohne Zugriff auf Rohdaten.'
          : 'Nur ein Textauszug verfügbar (kein vollständiger Open-Access-Volltext). Methodische Details liegen hinter der Quelle.'
      );
    }

    openQuestions.push(
      `Inwieweit lässt sich der Befund („${claims[0]?.claim.slice(0, 60)}…“) auf andere Kontexte oder Populationen übertragen?`,
      'Welche unabhängigen Replikationen oder Gegenuntersuchungen existieren?'
    );

    const nextSteps: SuggestedAction[] = [
      {
        id: 'step-det-1',
        type: 'trace',
        label: 'Belegstelle im Original nachlesen',
        promptOrAction: primarySource?.url || '#',
        rationale: 'Prüfe den Originalkontext der zitierten Passage.'
      },
      {
        id: 'step-det-2',
        type: 'challenge',
        label: 'Gegenstimme recherchieren',
        promptOrAction: `Gegenposition zu: ${question}`,
        rationale: 'Identifiziere methodische Einwände oder alternative Auslegungen.'
      },
      {
        id: 'step-det-3',
        type: 'connect',
        label: 'Ins persönliche Netzwerk übernehmen',
        promptOrAction: claims[0]?.claim || question,
        rationale: 'Verbinde diese Erkenntnis mit deinen bestehenden Notizen.'
      }
    ];

    const versionNum = previousResult ? previousResult.version + 1 : 1;
    let diff: InvestigationDiff | undefined;
    if (previousResult) {
      diff = this.calculateDiff(previousResult, claims, sources);
    }

    return {
      version: versionNum,
      timestamp: new Date().toISOString(),
      synthesisSummary: `[Deterministische Primärtext-Extraktion]: Auf Basis der verfügbaren Quelle „${primarySource?.title || 'Unbekannt'}“ wurden zentrale Kernaussagen zur Frage „${question}“ isoliert. Da kein aktiver KI-Zugang besteht oder gewählt wurde, erfolgte die Textstellen-Filterung regelbasiert ohne generative Interpolation.`,
      groundedClaims: claims,
      limitationsAndCounterpoints: limitations,
      openQuestions,
      suggestedNextSteps: nextSteps,
      diffFromPreviousVersion: diff,
      modelUsed: 'deterministic-extractor-v1',
      promptVersion: INVESTIGATION_PROMPT_VERSION,
      executionMode: 'deterministic_fallback'
    };
  }

  /**
   * Distinguish semantic difference between version N and N+1.
   */
  private calculateDiff(
    previous: InvestigationResult,
    newClaims: GroundedClaim[],
    sources: InvestigationSource[]
  ): InvestigationDiff {
    const prevQuotes = new Set(previous.groundedClaims.map(c => c.exactQuote.toLowerCase().trim()));
    const completelyNewQuotes = newClaims.filter(c => !prevQuotes.has(c.exactQuote.toLowerCase().trim()));

    // Check if new source introduces counter argument
    const hasCounterWords = newClaims.some(c =>
      /(widerspricht|widerlegt|falsifiziert|jedoch|gegenteil|nicht belegt|inkonsistent)/i.test(c.claim)
    );

    if (sources.length > 1 && hasCounterWords) {
      return {
        category: 'counter_argument',
        summary: 'Zweite Quelle bringt substantielle Gegenbelege oder methodische Einschränkungen ein.',
        details: completelyNewQuotes.map(c => `Neuer Einwand: „${c.claim}“`),
        impactOnPreviousClaims: 'Die frühere Einschätzung muss relativiert werden: Der gefundene Effekt ist nicht universell.'
      };
    }

    if (completelyNewQuotes.length > 0) {
      return {
        category: 'new_evidence',
        summary: `${completelyNewQuotes.length} neue Belegstellen zur bisherigen Argumentation hinzugefügt.`,
        details: completelyNewQuotes.map(c => `Zusätzlicher Beleg: „${c.claim}“`),
        impactOnPreviousClaims: 'Verstärkt die bisherige Einordnung durch zusätzliche Fundstellen.'
      };
    }

    return {
      category: 'repetition',
      summary: 'Die neuen Quellen enthalten weitgehend redundante Aussagen zum bisherigen Stand.',
      details: ['Keine neuen empirischen Messergebnisse oder abweichenden Interpretationen gefunden.'],
      impactOnPreviousClaims: 'Der bisherige Stand bleibt unverändert gültig.'
    };
  }

  private async getCachedResult(cacheKey: string): Promise<InvestigationResult | null> {
    try {
      const raw = await this.storage.getItem(INVESTIGATION_CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed[cacheKey] || null;
    } catch {
      return null;
    }
  }

  private async setCachedResult(cacheKey: string, result: InvestigationResult): Promise<void> {
    try {
      const raw = await this.storage.getItem(INVESTIGATION_CACHE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      parsed[cacheKey] = result;
      // Cap cache size to 50 items
      const keys = Object.keys(parsed);
      if (keys.length > 50) {
        delete parsed[keys[0]];
      }
      await this.storage.setItem(INVESTIGATION_CACHE_KEY, JSON.stringify(parsed));
    } catch {
      // Non-fatal
    }
  }
}

export const defaultInvestigationEngine = new InvestigationEngine();
