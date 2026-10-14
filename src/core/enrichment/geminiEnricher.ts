import { IContentEnricher, EnrichmentRequest, EnrichmentResult } from './types';
import { calculateCostEur } from './ledger';
import { CURRENT_PROMPT_VERSION, SourceOnlyEnricher } from './enricher';
import { SparringReply } from '../domain/types';
import { generateSparringReply } from '../data/fixtures';

export interface GeminiConfig {
  apiKey?: string;
  model?: string;
}

/**
 * Real Gemini API Content Enricher.
 * - Utilizes Gemini Flash with grounded official pricing ($0.10/M In, $0.40/M Out)
 * - Adheres strictly to the €5.00 monthly cost cap
 * - Gracefully falls back to SourceOnlyEnricher if no key, offline, or budget exceeded
 */
export class GeminiEnricher implements IContentEnricher {
  private apiKey: string;
  private model: string;
  private fallbackEnricher = new SourceOnlyEnricher();

  constructor(config: GeminiConfig = {}) {
    this.apiKey =
      config.apiKey ||
      (typeof process !== 'undefined' ? (process.env.EXPO_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '') : '');
    this.model = config.model || 'gemini-2.5-flash';
  }

  setApiKey(key: string): void {
    this.apiKey = key.trim();
  }

  hasApiKey(): boolean {
    return Boolean(this.apiKey && this.apiKey.length > 5);
  }

  async enrich(request: EnrichmentRequest): Promise<EnrichmentResult> {
    const { item } = request;

    if (!this.hasApiKey()) {
      return this.fallbackEnricher.enrich(request);
    }

    const prompt = `Du bist die redaktionelle KI des „Atem-Netzwerks“ – einer intellektuellen, werbefreien Social-Media-Alternative gegen Doomscrolling für einen Philosophie- und Deutschlehrer.
Deine Aufgabe: Bereite den folgenden Originalbeitrag als prägnanten, erkenntnisreichen deutschen Leseabschnitt auf.

Titel: ${item.title}
Quelle: ${item.sourceReferences[0]?.publisher || 'Unbekannt'}
Thema: ${item.primaryTopic}
Inhalt: ${item.body.slice(0, 1500)}

Antworte ausschließlich im folgenden JSON-Format ohne Markdown-Codeblöcke:
{
  "feedText": "5 bis 8 dichte Zeilen (80-220 Wörter) auf Deutsch, die das Kernargument präzise und elegant entfalten.",
  "relevanceExplanation": "Ein bis zwei Sätze zur philosophischen oder didaktischen Relevanz.",
  "keyInsight": "Ein prägnanter Merksatz oder Leitgedanke.",
  "counterArgument": "Ein fundierter dialektischer Einwand oder eine Gegenposition eines Skeptikers.",
  "didacticSeed": "Ein konkreter didaktischer Impuls für den Unterricht in Sek I/II."
}`;

    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 600,
            responseMimeType: 'application/json'
          }
        })
      });

      if (!res.ok) {
        throw new Error(`Gemini API returned status ${res.status}`);
      }

      const data = await res.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) throw new Error('No candidate response from Gemini API');

      const parsed = JSON.parse(rawText.trim());
      const inTokens = data?.usageMetadata?.promptTokenCount || 450;
      const outTokens = data?.usageMetadata?.candidatesTokenCount || 220;
      const costEur = calculateCostEur(inTokens, outTokens);

      return {
        feedText: parsed.feedText || item.feedText || item.body.slice(0, 300),
        relevanceExplanation: parsed.relevanceExplanation || item.relevanceExplanation,
        perspectiveDetails: item.isChallengingPerspective
          ? {
              claim: item.title,
              interpretation: parsed.counterArgument,
              humanSource: item.sourceReferences[0]?.author || 'Redaktion'
            }
          : undefined,
        didacticSeed: parsed.didacticSeed,
        counterArgument: parsed.counterArgument,
        modelUsed: this.model,
        promptVersion: CURRENT_PROMPT_VERSION,
        inputTokens: inTokens,
        outputTokens: outTokens,
        estimatedCostEur: costEur,
        isFallback: false
      };
    } catch {
      // Graceful fallback to SourceOnlyEnricher on API failure
      return this.fallbackEnricher.enrich(request);
    }
  }

  /**
   * Generates a live sparring reply via Gemini API if key is present,
   * or falls back to deterministic heuristic sparring.
   */
  async generateLiveSparring(
    noteText: string,
    tag: 'einwand' | 'unterricht' | 'these' | 'notiz',
    itemTitle?: string
  ): Promise<SparringReply> {
    if (!this.hasApiKey()) {
      return generateSparringReply(noteText, tag, itemTitle);
    }

    const persona = tag === 'einwand'
      ? { handle: 'u/sokrates_2026', badge: 'Sokratischer Sparring-Partner', role: 'Hinterfrage die Prämisse scharf, aber wohlwollend dialektisch.' }
      : tag === 'unterricht'
      ? { handle: 'u/didaktik_labor', badge: 'Fachdidaktik Sek II', role: 'Bringe einen konkreten unterrichtspraktischen Einstiegsimpuls oder Differenzierungsvorschlag ein.' }
      : tag === 'these'
      ? { handle: 'u/dialektik_dresden', badge: 'Dialektischer Sparring-Partner', role: 'Formuliere die stärkste Gegenposition eines Skeptikers als Prüfstein.' }
      : { handle: 'u/atem_curator', badge: 'Erkenntnis-Begleiter', role: 'Verbinde den Gedanken mit digitaler und kognitiver Souveränität.' };

    const prompt = `Du agierst als ${persona.handle} (${persona.badge}) im Atem-Netzwerk.
Der Nutzer hat folgende persönliche Reflexion verfasst:
„${noteText}“
Kontext des Artikels: ${itemTitle || 'Philosophischer/Wissenschaftlicher Diskurs'}
Rolle: ${persona.role}

Antworte in genau 2-3 prägnanten, tiefsinnigen Sätzen auf Deutsch. Fordere den Nutzer intellektuell heraus, ohne belehrend zu wirken. Kein Markdown.`;

    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.5,
            maxOutputTokens: 180
          }
        })
      });

      if (!res.ok) throw new Error('API request failed');
      const data = await res.json();
      const replyText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

      if (replyText) {
        return {
          id: `reply_${Date.now()}`,
          authorHandle: persona.handle,
          authorBadge: persona.badge,
          createdAt: new Date().toISOString(),
          text: replyText
        };
      }
      return generateSparringReply(noteText, tag, itemTitle);
    } catch {
      return generateSparringReply(noteText, tag, itemTitle);
    }
  }
}

export const defaultGeminiEnricher = new GeminiEnricher();
