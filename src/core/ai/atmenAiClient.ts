import { appStorage, AtemStorage } from '../data/storage';
import {
  EnrichmentUsageLedger,
  defaultUsageLedger,
  calculateCostEur,
  MONTHLY_BUDGET_CEILING_EUR
} from '../enrichment/ledger';

import {
  ModelCategory,
  ModelStatus,
  GEMINI_MODEL_CATALOG,
  validateModelChoice
} from './geminiModelRegistry';

export * from './geminiModelRegistry';

export const AI_CREDENTIALS_STORAGE_KEY = '@atem:ai_credentials:v1';

export type AiProvider = 'gemini' | 'openrouter';

export interface AiCredentials {
  provider: AiProvider;
  apiKey?: string;
  model?: string;
  proxyUrl?: string;
}

export const DEFAULT_AI_CREDENTIALS: AiCredentials = {
  provider: 'gemini',
  apiKey: '',
  model: 'gemini-3.8-flash'
};

export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';
export const DEFAULT_OPENROUTER_MODEL = 'google/gemini-3.8-flash';

export interface SelectableAiModel {
  id: string;
  label: string;
  provider: AiProvider;
  category?: ModelCategory;
  status?: ModelStatus;
  description: string;
  recommended?: boolean;
  legacy?: boolean;
}

export const AVAILABLE_AI_MODELS: SelectableAiModel[] = [
  // Curated modern Gemini models (active/recommended first)
  ...GEMINI_MODEL_CATALOG.filter(m => !m.legacy).map(m => ({
    id: m.id,
    label: m.label,
    provider: 'gemini' as const,
    category: m.category,
    status: m.status,
    description: m.description,
    recommended: m.recommended,
    legacy: m.legacy
  })),
  // Legacy Gemini models (available when toggled)
  ...GEMINI_MODEL_CATALOG.filter(m => m.legacy).map(m => ({
    id: m.id,
    label: m.label,
    provider: 'gemini' as const,
    category: m.category,
    status: m.status,
    description: m.description,
    recommended: m.recommended,
    legacy: m.legacy
  })),
  // OpenRouter models
  {
    id: 'google/gemini-2.5-flash',
    label: 'OpenRouter: Gemini 2.5 Flash',
    provider: 'openrouter',
    category: 'text',
    status: 'stable',
    description: 'Über OpenRouter API',
    recommended: false,
    legacy: false
  },
  {
    id: 'anthropic/claude-3.5-sonnet',
    label: 'OpenRouter: Claude 3.5 Sonnet',
    provider: 'openrouter',
    category: 'text',
    status: 'stable',
    description: 'Exzellent für Essay-Stil & Dialektik',
    recommended: true,
    legacy: false
  }
];

export interface ModelPreset {
  id: string;
  label: string;
  provider?: AiProvider;
  description?: string;
}

export const GEMINI_MODEL_PRESETS: ModelPreset[] = AVAILABLE_AI_MODELS.filter(m => m.provider === 'gemini');

export const OPENROUTER_MODEL_PRESETS: ModelPreset[] = [
  ...AVAILABLE_AI_MODELS.filter(m => m.provider === 'openrouter'),
  { id: 'google/gemini-3.8-flash', label: 'google/gemini-3.8-flash', provider: 'openrouter', description: 'Gemini 3.8 über OpenRouter' },
  { id: 'openai/gpt-4o-mini', label: 'openai/gpt-4o-mini', provider: 'openrouter', description: 'Schnelles, sparsames OpenAI-Modell' },
  { id: 'meta-llama/llama-3.3-70b-instruct', label: 'meta-llama/llama-3.3-70b-instruct', provider: 'openrouter', description: 'Führendes Open-Source-Modell' }
];

export class AiBudgetExceededError extends Error {
  constructor(message = 'Monatliches KI-Budget von 5,00 € erreicht.') {
    super(message);
    this.name = 'AiBudgetExceededError';
  }
}

export class AiCredentialsMissingError extends Error {
  constructor(message = 'Kein API-Schlüssel für KI-Anfragen konfiguriert.') {
    super(message);
    this.name = 'AiCredentialsMissingError';
  }
}

export async function loadAiCredentials(storage: AtemStorage = appStorage): Promise<AiCredentials> {
  const raw = await storage.getItem(AI_CREDENTIALS_STORAGE_KEY);
  if (!raw) return { ...DEFAULT_AI_CREDENTIALS };
  try {
    const parsed = JSON.parse(raw);
    return {
      provider: parsed.provider === 'openrouter' ? 'openrouter' : 'gemini',
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : '',
      model: typeof parsed.model === 'string' && parsed.model ? parsed.model : (
        parsed.provider === 'openrouter' ? DEFAULT_OPENROUTER_MODEL : DEFAULT_GEMINI_MODEL
      )
    };
  } catch {
    return { ...DEFAULT_AI_CREDENTIALS };
  }
}

export async function saveAiCredentials(
  credentials: AiCredentials,
  storage: AtemStorage = appStorage
): Promise<void> {
  await storage.setItem(AI_CREDENTIALS_STORAGE_KEY, JSON.stringify(credentials));
}

export async function clearAiCredentials(storage: AtemStorage = appStorage): Promise<void> {
  await storage.removeItem(AI_CREDENTIALS_STORAGE_KEY);
}

export interface AiCallResponse {
  text: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    costEur: number;
  };
  modelUsed?: string;
}

export interface AiCallOptions {
  systemInstruction?: string;
  jsonMode?: boolean;
  maxTokens?: number;
  credentials?: AiCredentials;
  ledger?: EnrichmentUsageLedger;
  itemId?: string;
}

/**
 * Tests connection to configured provider with a minimal request.
 */
export async function testAiConnection(
  credentials: AiCredentials
): Promise<{ ok: boolean; message: string; latencyMs?: number }> {
  if (!credentials.apiKey?.trim()) {
    return { ok: false, message: 'Bitte gib einen gültigen API-Schlüssel ein.' };
  }

  const start = Date.now();
  try {
    const res = await callAiModel('Antworte nur mit: {"status": "ok"}', {
      jsonMode: true,
      credentials,
      itemId: 'connection-test',
      // We pass an isolated in-memory ledger for connection testing so test calls don't block
      ledger: new EnrichmentUsageLedger('', false)
    });

    const latencyMs = Date.now() - start;
    if (res.text.includes('ok')) {
      const providerName = credentials.provider === 'openrouter' ? 'OpenRouter' : 'Gemini';
      return {
        ok: true,
        message: `🟢 Verbunden mit ${providerName} (Antwort in ${latencyMs}ms)`,
        latencyMs
      };
    }
    return {
      ok: true,
      message: `🟢 Antwort erhalten (${latencyMs}ms)`,
      latencyMs
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      message: `🔴 Verbindungsfehler: ${errorMsg}`
    };
  }
}

/**
 * Unified AI call method strictly governed by EnrichmentUsageLedger.
 */
export async function callAiModel(
  prompt: string,
  options: AiCallOptions = {}
): Promise<AiCallResponse> {
  const credentials = options.credentials ?? (await loadAiCredentials());
  const apiKey = credentials.apiKey?.trim();
  const effectiveProxyUrl = credentials.proxyUrl?.trim() || (typeof process !== 'undefined' ? process.env.ATMEN_AI_PROXY_URL : undefined);

  if (!apiKey && !effectiveProxyUrl) {
    throw new AiCredentialsMissingError();
  }

  const ledger = options.ledger ?? defaultUsageLedger;

  // 1. Check budget ceiling and reserve
  const estimatedInputTokens = Math.ceil(prompt.length / 3.5);
  const estimatedOutputTokens = options.maxTokens ?? 500;
  const estimatedCost = calculateCostEur(estimatedInputTokens, estimatedOutputTokens);

  const reservationId = await ledger.reserveSpend(estimatedCost);
  if (!reservationId) {
    throw new AiBudgetExceededError(
      `Monatliches KI-Budget-Limit (${MONTHLY_BUDGET_CEILING_EUR.toFixed(2)} €) erreicht oder gesperrt.`
    );
  }

  const model = credentials.model?.trim() || (
    credentials.provider === 'openrouter' ? DEFAULT_OPENROUTER_MODEL : DEFAULT_GEMINI_MODEL
  );

  if (credentials.provider === 'gemini') {
    const val = validateModelChoice(model, 'text');
    if (!val.valid) {
      await ledger.releaseReservation(reservationId);
      throw new Error(val.reason || `Das Modell „${model}“ ist nicht für Text-Generierung unterstützt.`);
    }
  }

  try {
    let resultText = '';
    let inTokens = estimatedInputTokens;
    let outTokens = estimatedOutputTokens;
    let effectiveModel = model;

    // Optional proxy dispatch if configured
    if (effectiveProxyUrl) {
      try {
        const proxyRes = await fetch(`${effectiveProxyUrl}/curate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(apiKey ? { 'x-gemini-key': apiKey } : {})
          },
          body: JSON.stringify({
            prompt,
            systemInstruction: options.systemInstruction,
            jsonMode: options.jsonMode,
            model
          })
        });
        if (proxyRes.ok) {
          const json = await proxyRes.json();
          if (json.text) {
            resultText = json.text;
            if (json.usage) {
              inTokens = json.usage.promptTokenCount ?? inTokens;
              outTokens = json.usage.candidatesTokenCount ?? outTokens;
            }
            const actualCost = calculateCostEur(inTokens, outTokens);
            await ledger.commitReservation(reservationId, {
              itemId: options.itemId ?? 'live-ai-call',
              model: effectiveModel,
              inputTokens: inTokens,
              outputTokens: outTokens,
              costEur: actualCost
            });
            return {
              text: resultText,
              usage: {
                inputTokens: inTokens,
                outputTokens: outTokens,
                costEur: actualCost
              },
              modelUsed: effectiveModel
            };
          }
        }
      } catch {
        // Fall back to direct call
      }
    }

    if (credentials.provider === 'gemini') {
      if (!apiKey) {
        throw new AiCredentialsMissingError();
      }
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

      const requestBody: Record<string, unknown> = {
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }]
          }
        ]
      };

      if (options.systemInstruction) {
        requestBody.systemInstruction = {
          parts: [{ text: options.systemInstruction }]
        };
      }

      if (options.jsonMode) {
        requestBody.generationConfig = {
          responseMimeType: 'application/json'
        };
      }

      let response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      // Guardrail: Automatic retry fallback to gemini-2.5-flash if HTTP 404 returned
      if (response.status === 404 && model !== 'gemini-2.5-flash') {
        effectiveModel = 'gemini-2.5-flash';
        const fallbackEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
        response = await fetch(fallbackEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        });
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API Fehler (${response.status}): ${errorText.slice(0, 300)}`);
      }

      const json = await response.json();
      resultText = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      if (json?.usageMetadata) {
        inTokens = json.usageMetadata.promptTokenCount ?? inTokens;
        outTokens = json.usageMetadata.candidatesTokenCount ?? outTokens;
      }
    } else {
      // OpenRouter provider
      const endpoint = 'https://openrouter.ai/api/v1/chat/completions';
      const messages: { role: string; content: string }[] = [];

      if (options.systemInstruction) {
        messages.push({ role: 'system', content: options.systemInstruction });
      }
      messages.push({ role: 'user', content: prompt });

      const requestBody: Record<string, unknown> = {
        model,
        messages
      };

      if (options.jsonMode) {
        requestBody.response_format = { type: 'json_object' };
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://atmen.app',
          'X-Title': 'Atmen'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenRouter API Fehler (${response.status}): ${errorText.slice(0, 300)}`);
      }

      const json = await response.json();
      resultText = json?.choices?.[0]?.message?.content ?? '';
      if (json?.usage) {
        inTokens = json.usage.prompt_tokens ?? inTokens;
        outTokens = json.usage.completion_tokens ?? outTokens;
      }
    }

    // 2. Commit actual spend against reservation
    const costEur = calculateCostEur(inTokens, outTokens);
    await ledger.commitReservation(reservationId, {
      itemId: options.itemId ?? 'live-ai-call',
      model: effectiveModel,
      inputTokens: inTokens,
      outputTokens: outTokens,
      costEur
    });

    return {
      text: resultText,
      usage: {
        inputTokens: inTokens,
        outputTokens: outTokens,
        costEur
      },
      modelUsed: effectiveModel
    };
  } catch (err) {
    // Release reserved funds if network or API failed
    await ledger.releaseReservation(reservationId);
    throw err;
  }
}
