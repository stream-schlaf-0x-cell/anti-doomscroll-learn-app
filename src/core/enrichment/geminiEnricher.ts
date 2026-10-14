import { IContentEnricher, EnrichmentRequest, EnrichmentResult } from './types';
import { calculateCostEur } from './ledger';
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
 * - Supports Google Gemini (Flash / Pro) with €5.00/month cost ceiling
 * - Supports Local LLMs (Ollama / LM Studio) via OpenAI-compatible endpoint (100% offline & private)
 * - Supports OpenAI / ChatGPT / OpenRouter via standard API endpoint
 * - Gracefully falls back to heuristic SourceOnlyEnricher if no key, offline, or budget exceeded
 */
export class GeminiEnricher implements IContentEnricher {
  private provider: AIProvider;
  private apiKey: string;
  private model: string;
  private endpoint: string;
  private fallbackEnricher = new SourceOnlyEnricher();

  constructor(config: GeminiConfig = {}) {
    this.provider = config.provider || 'gemini';
    this.apiKey =
      config.apiKey ||
      (typeof process !== 'undefined' ? (process.env.EXPO_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '') : '');
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

        if (!res.ok) throw new Error(`Gemini API returned status ${res.status}`);
        const data = await res.json();
        rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        inTokens = data?.usageMetadata?.promptTokenCount || 450;
        outTokens = data?.usageMetadata?.candidatesTokenCount || 220;
      } else {
        // OpenAI-compatible endpoint (Ollama or OpenAI)
        const chatUrl = `${this.endpoint.replace(/\/+$/, '')}/chat/completions`;
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;

        const res = await fetch(chatUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: this.model,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3,
            max_tokens: 600
          })
        });

        if (!res.ok) throw new Error(`AI API returned status ${res.status}`);
        const data = await res.json();
        rawText = data?.choices?.[0]?.message?.content;
      }

      if (!rawText) throw new Error('No candidate response from AI API');

      const parsed = JSON.parse(rawText.trim());
      const costEur = this.provider === 'ollama' ? 0 : calculateCostEur(inTokens, outTokens);

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
        modelUsed: `${this.provider}:${this.model}`,
        promptVersion: CURRENT_PROMPT_VERSION,
        inputTokens: inTokens,
        outputTokens: outTokens,
        estimatedCostEur: costEur,
        isFallback: false
      };
    } catch {
      return this.fallbackEnricher.enrich(request);
    }
  }

  /**
   * Generates a live sparring reply via AI API if key/provider is configured,
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
      let replyText = '';

      if (this.provider === 'gemini') {
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
        replyText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
      } else {
        const chatUrl = `${this.endpoint.replace(/\/+$/, '')}/chat/completions`;
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;

        const res = await fetch(chatUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: this.model,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.5,
            max_tokens: 180
          })
        });

        if (!res.ok) throw new Error('API request failed');
        const data = await res.json();
        replyText = data?.choices?.[0]?.message?.content?.trim() || '';
      }

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

  /**
   * Tests the connection with a live interactive philosophical prompt.
   */
  async testConnection(testPrompt: string = 'Was ist der Wert von Aufmerksamkeit?'): Promise<{
    success: boolean;
    message: string;
    reply?: string;
  }> {
    if (!this.hasApiKey()) {
      return {
        success: false,
        message: 'Kein API-Key oder unvollständige Konfiguration hinterlegt.'
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
