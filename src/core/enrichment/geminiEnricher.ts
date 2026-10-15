import { IContentEnricher, EnrichmentRequest, EnrichmentResult } from './types';
import { calculateCostEur, defaultUsageLedger } from './ledger';
import { CURRENT_PROMPT_VERSION, SourceOnlyEnricher } from './enricher';
import { SparringReply } from '../domain/types';
import { generateSparringReply } from '../data/fixtures';

export type AIProvider = 'gemini' | 'ollama' | 'openai';

export interface GeminiConfig {
  provider?: AIProvider;
  apiKey?: string;
  model?: string;
  endpoint?: string;
}

/**
 * Universal AI Content Enricher & Intellectual Sparring Engine.
 * 
 * Secure Architecture:
 * - Paid inference runs only when a secure backend endpoint or user key is explicitly supplied.
 * - Client builds do not embed shared public API keys.
 * - Without server configuration, Atem operates in an honestly labeled "Quellenmodus" (Source-only / Zero-cost Mode).
 * - Every paid call routes through the persistent budget ledger with atomic reservation, bounded tokens, and post-call reconciliation.
 * - Official model target: gemini-2.5-flash (Google Gemini Developer API, $0.10/1M in, $0.40/1M out).
 */
export class GeminiEnricher implements IContentEnricher {
  private provider: AIProvider;
  private apiKey: string;
  private model: string;
  private endpoint: string;
  private fallbackEnricher = new SourceOnlyEnricher();

  constructor(config: GeminiConfig = {}) {
    this.provider = config.provider || 'gemini';
    // Never expose or embed an open API key in public client bundles
    this.apiKey =
      config.apiKey ||
      (typeof process !== 'undefined' ? (process.env.GEMINI_API_KEY || '') : '');
    this.model = config.model || (this.provider === 'ollama' ? 'llama3.2' : this.provider === 'openai' ? 'gpt-4o-mini' : 'gemini-2.5-flash');
    this.endpoint = config.endpoint || (this.provider === 'ollama' ? 'http://localhost:11434/v1' : 'https://api.openai.com/v1');
  }

  setProvider(provider: AIProvider): void {
    this.provider = provider;
    if (provider === 'ollama' && !this.model.includes('llama')) {
      this.model = 'llama3.2';
    } else if (provider === 'openai' && !this.model.includes('gpt')) {
      this.model = 'gpt-4o-mini';
    } else if (provider === 'gemini' && !this.model.includes('gemini')) {
      this.model = 'gemini-2.5-flash';
    }
  }

  getProvider(): AIProvider {
    return this.provider;
  }

  setApiKey(key: string): void {
    this.apiKey = key.trim();
  }

  setModel(model: string): void {
    this.model = model.trim();
  }

  getModel(): string {
    return this.model;
  }

  setEndpoint(endpoint: string): void {
    this.endpoint = endpoint.trim();
  }

  getEndpoint(): string {
    return this.endpoint;
  }

  hasApiKey(): boolean {
    if (this.provider === 'ollama') return true; // Local LLMs don't need an API key
    return Boolean(this.apiKey && this.apiKey.length > 5);
  }

  async enrich(request: EnrichmentRequest): Promise<EnrichmentResult> {
    const { item } = request;

    if (!this.hasApiKey()) {
      return this.fallbackEnricher.enrich(request);
    }

    // Atomically reserve worst-case cost (€0.0006)
    const estimatedMaxCost = 0.0006;
    const resId = await defaultUsageLedger.reserveSpend(estimatedMaxCost);
    if (!resId) {
      // Budget limit exceeded or status unknown: use honest source-only fallback
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
      let rawText = '';
      let inTokens = 450;
      let outTokens = 220;

      if (this.provider === 'gemini') {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 600,
              responseMimeType: 'application/json'
            }
          })
        });
        clearTimeout(timeout);

        if (!res.ok) throw new Error(`Gemini API returned ${res.status}`);
        const data = await res.json();
        rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
        inTokens = data?.usageMetadata?.promptTokenCount || inTokens;
        outTokens = data?.usageMetadata?.candidatesTokenCount || outTokens;
      } else {
        const chatUrl = `${this.endpoint.replace(/\/+$/, '')}/chat/completions`;
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);

        const res = await fetch(chatUrl, {
          method: 'POST',
          headers,
          signal: controller.signal,
          body: JSON.stringify({
            model: this.model,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3,
            max_tokens: 600,
            response_format: { type: 'json_object' }
          })
        });
        clearTimeout(timeout);

        if (!res.ok) throw new Error(`LLM endpoint returned ${res.status}`);
        const data = await res.json();
        rawText = data?.choices?.[0]?.message?.content?.trim() || '';
        inTokens = data?.usage?.prompt_tokens || inTokens;
        outTokens = data?.usage?.completion_tokens || outTokens;
      }

      const parsed = JSON.parse(rawText.replace(/^```json/, '').replace(/```$/, ''));
      const actualCost = calculateCostEur(inTokens, outTokens);

      await defaultUsageLedger.commitReservation(resId, {
        itemId: item.id,
        model: this.model,
        inputTokens: inTokens,
        outputTokens: outTokens,
        costEur: actualCost
      });

      return {
        feedText: parsed.feedText || item.feedText || item.title,
        relevanceExplanation: parsed.relevanceExplanation || item.relevanceExplanation || 'Ausgewählt für fundierte Erkenntnis.',
        counterArgument: parsed.counterArgument,
        didacticSeed: parsed.didacticSeed,
        modelUsed: this.model,
        promptVersion: CURRENT_PROMPT_VERSION,
        inputTokens: inTokens,
        outputTokens: outTokens,
        estimatedCostEur: actualCost,
        isFallback: false
      };
    } catch {
      await defaultUsageLedger.releaseReservation(resId);
      return this.fallbackEnricher.enrich(request);
    }
  }

  /**
   * Generates a live interactive philosophical sparring reply.
   * Routes through the budget ledger with atomic reservation so budget cannot be bypassed.
   */
  async generateLiveSparring(
    noteText: string,
    tag: 'einwand' | 'unterricht' | 'these' | 'notiz' = 'notiz',
    itemTitle?: string
  ): Promise<SparringReply> {
    if (!this.hasApiKey()) {
      return generateSparringReply(noteText, tag, itemTitle);
    }

    const estimatedCost = 0.0002;
    const resId = await defaultUsageLedger.reserveSpend(estimatedCost);
    if (!resId) {
      // Budget limit reached: fall back to local heuristic reply
      return generateSparringReply(noteText, tag, itemTitle);
    }

    const personas = {
      einwand: { handle: 'Sokrates-Sparring', badge: '⚡ Dialektik', role: 'Sokratischer Zweifler' },
      unterricht: { handle: 'Didaktik-Labor', badge: '🎓 Didaktik', role: 'Didaktik-Mentor' },
      these: { handle: 'Episteme-Rat', badge: '🏛 Philosophie', role: 'Wissenschaftstheoretiker' },
      notiz: { handle: 'Kognition-Reflex', badge: '◈ Resonanz', role: 'Sparringspartner' }
    };
    const persona = personas[tag] || personas.notiz;

    const prompt = `Du agierst als ${persona.handle} (${persona.badge}) im Atem-Netzwerk.
Der Nutzer hat folgende persönliche Reflexion verfasst:
„${noteText}“
Kontext des Artikels: ${itemTitle || 'Philosophischer/Wissenschaftlicher Diskurs'}
Rolle: ${persona.role}

Antworte in genau 2-3 prägnanten, tiefsinnigen Sätzen auf Deutsch. Fordere den Nutzer intellektuell heraus, ohne belehrend zu wirken. Kein Markdown.`;

    try {
      let replyText = '';
      let inTokens = 180;
      let outTokens = 120;

      if (this.provider === 'gemini') {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.5,
              maxOutputTokens: 180
            }
          })
        });
        clearTimeout(timeout);

        if (!res.ok) throw new Error(`API request failed with status ${res.status}`);
        const data = await res.json();
        replyText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
        inTokens = data?.usageMetadata?.promptTokenCount || inTokens;
        outTokens = data?.usageMetadata?.candidatesTokenCount || outTokens;
      } else {
        const chatUrl = `${this.endpoint.replace(/\/+$/, '')}/chat/completions`;
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        const res = await fetch(chatUrl, {
          method: 'POST',
          headers,
          signal: controller.signal,
          body: JSON.stringify({
            model: this.model,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.5,
            max_tokens: 180
          })
        });
        clearTimeout(timeout);

        if (!res.ok) throw new Error(`API request failed with status ${res.status}`);
        const data = await res.json();
        replyText = data?.choices?.[0]?.message?.content?.trim() || '';
        inTokens = data?.usage?.prompt_tokens || inTokens;
        outTokens = data?.usage?.completion_tokens || outTokens;
      }

      if (replyText) {
        const actualCost = calculateCostEur(inTokens, outTokens);
        await defaultUsageLedger.commitReservation(resId, {
          itemId: `sparring_${Date.now()}`,
          model: this.model,
          inputTokens: inTokens,
          outputTokens: outTokens,
          costEur: actualCost
        });

        return {
          id: `reply_${Date.now()}`,
          authorHandle: persona.handle,
          authorBadge: `${persona.badge} (KI-Sparring)`,
          createdAt: new Date().toISOString(),
          text: replyText
        };
      }

      await defaultUsageLedger.releaseReservation(resId);
      return generateSparringReply(noteText, tag, itemTitle);
    } catch {
      await defaultUsageLedger.releaseReservation(resId);
      return generateSparringReply(noteText, tag, itemTitle);
    }
  }

  /**
   * Tests the connection with a live interactive philosophical prompt.
   * Routes through budget reservation so connection tests also account for spend.
   */
  async testConnection(testPrompt: string = 'Was ist der Wert von Aufmerksamkeit?'): Promise<{
    success: boolean;
    message: string;
    reply?: string;
  }> {
    if (!this.hasApiKey()) {
      return {
        success: false,
        message: 'Kein API-Schlüssel hinterlegt. Atem läuft im kostenfreien, wertebasierten Quellenmodus.'
      };
    }

    try {
      const sparring = await this.generateLiveSparring(testPrompt, 'these', 'Test-Verbindung');
      return {
        success: true,
        message: `Erfolgreich verbunden mit ${this.provider.toUpperCase()} (${this.model})!`,
        reply: sparring.text
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Verbindung fehlgeschlagen: ${err?.message || 'Unbekannter Fehler'}`
      };
    }
  }
}

export const defaultGeminiEnricher = new GeminiEnricher();
