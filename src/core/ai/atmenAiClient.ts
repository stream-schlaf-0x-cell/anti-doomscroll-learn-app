import { appStorage, AtemStorage } from '../data/storage';
import { AiHttpError, boundedOutputTokens, fetchAiJson, normalizeAiProxyUrl, parseAiResult, ParsedAiResult } from './aiTransport';
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
  /** Deliberate opt-in to unencrypted local persistence. Session memory is the default. */
  persistApiKey?: boolean;
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

// Keys are scoped to this application session. Metadata remains in local storage.
const sessionApiKeys = new WeakMap<AtemStorage, string>();
let sessionEffectiveGeminiModel: string | null = null;
let sessionEffectiveOpenRouterModel: string | null = null;

export function resetSessionEffectiveModels(): void {
  sessionEffectiveGeminiModel = null;
  sessionEffectiveOpenRouterModel = null;
}

export function hasAiConfiguration(credentials: AiCredentials): boolean {
  return Boolean(credentials.apiKey?.trim() || credentials.proxyUrl?.trim());
}

function normalizeCredentials(credentials: AiCredentials): AiCredentials {
  return {
    provider: credentials.provider === 'openrouter' ? 'openrouter' : 'gemini',
    apiKey: credentials.apiKey?.trim() ?? '',
    model: credentials.model?.trim() || (credentials.provider === 'openrouter' ? DEFAULT_OPENROUTER_MODEL : DEFAULT_GEMINI_MODEL),
    proxyUrl: normalizeAiProxyUrl(credentials.proxyUrl),
    persistApiKey: credentials.persistApiKey === true
  };
}

export async function loadAiCredentials(storage: AtemStorage = appStorage): Promise<AiCredentials> {
  const raw = await storage.getItem(AI_CREDENTIALS_STORAGE_KEY);
  if (!raw) {
    sessionApiKeys.delete(storage);
    return { ...DEFAULT_AI_CREDENTIALS };
  }
  let parsed: Record<string, unknown>;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...DEFAULT_AI_CREDENTIALS };
    parsed = value as Record<string, unknown>;
  } catch {
    return { ...DEFAULT_AI_CREDENTIALS };
  }
  const persistedKey = typeof parsed.apiKey === 'string' ? parsed.apiKey.trim() : '';
  const credentials: AiCredentials = {
    provider: parsed.provider === 'openrouter' ? 'openrouter' : 'gemini',
    apiKey: persistedKey || sessionApiKeys.get(storage) || '',
    model: typeof parsed.model === 'string' && parsed.model ? parsed.model : (parsed.provider === 'openrouter' ? DEFAULT_OPENROUTER_MODEL : DEFAULT_GEMINI_MODEL),
    // Preserve invalid legacy configuration so calls fail closed until the user corrects it.
    proxyUrl: typeof parsed.proxyUrl === 'string' ? parsed.proxyUrl : undefined,
    persistApiKey: parsed.persistApiKey === true
  };
  if (persistedKey && !credentials.persistApiKey) {
    // Migrate legacy plaintext keys without making them unusable during this session.
    sessionApiKeys.set(storage, persistedKey);
    await storage.setItem(AI_CREDENTIALS_STORAGE_KEY, JSON.stringify({ ...credentials, apiKey: '' }));
  }
  return credentials;
}

export async function saveAiCredentials(credentials: AiCredentials, storage: AtemStorage = appStorage): Promise<void> {
  const normalized = normalizeCredentials(credentials);
  await storage.setItem(AI_CREDENTIALS_STORAGE_KEY, JSON.stringify({ ...normalized, apiKey: normalized.persistApiKey ? normalized.apiKey : '' }));
  if (normalized.apiKey) sessionApiKeys.set(storage, normalized.apiKey);
  else sessionApiKeys.delete(storage);
}

export async function clearAiCredentials(storage: AtemStorage = appStorage): Promise<void> {
  await storage.removeItem(AI_CREDENTIALS_STORAGE_KEY);
  sessionApiKeys.delete(storage);
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
  /** May shorten the 15-second transport deadline, but cannot extend it. */
  timeoutMs?: number;
}

/**
 * Tests connection to configured provider with a minimal request.
 */
export async function testAiConnection(
  credentials: AiCredentials
): Promise<{ ok: boolean; message: string; latencyMs?: number }> {
  if (!hasAiConfiguration(credentials)) {
    return { ok: false, message: 'Bitte gib einen API-Schlüssel oder eine eigene HTTPS-Proxy-Adresse ein.' };
  }

  const start = Date.now();
  try {
    const res = await callAiModel('Antworte nur mit: {"status": "ok"}', {
      jsonMode: true,
      credentials,
      itemId: 'connection-test',
      maxTokens: 128,
      // We pass an isolated in-memory ledger for connection testing so test calls don't block
      ledger: new EnrichmentUsageLedger('', false)
    });

    const latencyMs = Date.now() - start;
    const textLower = res.text.toLowerCase();
    if (textLower.includes('ok') || textLower.includes('status')) {
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
export async function callAiModel(prompt: string, options: AiCallOptions = {}): Promise<AiCallResponse> {
  const credentials = options.credentials ?? await loadAiCredentials();
  const apiKey = credentials.apiKey?.trim();
  // No hidden environment fallback: transport selection is explicit and persisted in settings.
  const proxyUrl = normalizeAiProxyUrl(credentials.proxyUrl);
  if (!apiKey && !proxyUrl) throw new AiCredentialsMissingError();
  const maxTokens = boundedOutputTokens(options.maxTokens);
  const model = credentials.model?.trim() || (credentials.provider === 'openrouter' ? DEFAULT_OPENROUTER_MODEL : DEFAULT_GEMINI_MODEL);
  if (credentials.provider === 'gemini') {
    const validation = validateModelChoice(model, 'text');
    if (!validation.valid) throw new Error(validation.reason || 'Das gewählte Modell unterstützt diese Textanfrage nicht.');
  }
  const ledger = options.ledger ?? defaultUsageLedger;
  const estimatedInputTokens = Math.ceil((prompt.length + (options.systemInstruction?.length ?? 0)) / 3.5);
  const reservationId = await ledger.reserveSpend(calculateCostEur(estimatedInputTokens, maxTokens));
  if (!reservationId) throw new AiBudgetExceededError(`Monatliches KI-Budget-Limit (${MONTHLY_BUDGET_CEILING_EUR.toFixed(2)} €) erreicht oder gesperrt.`);

  try {
    let result: ParsedAiResult;
    let effectiveModel = model;
    if (proxyUrl) {
      const json = await fetchAiJson(`${proxyUrl}/curate`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...(apiKey ? { 'x-provider-api-key': apiKey } : {}) },
        body: JSON.stringify({ provider: credentials.provider, prompt, systemInstruction: options.systemInstruction, jsonMode: options.jsonMode, model, maxTokens })
      }, options.timeoutMs);
      // A configured proxy is the exclusive route. Failure never triggers a direct paid call.
      result = parseAiResult(json, 'proxy');
      effectiveModel = result.model || model;
    } else if (credentials.provider === 'gemini') {
      const body = JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        ...(options.systemInstruction ? { systemInstruction: { parts: [{ text: options.systemInstruction }] } } : {}),
        generationConfig: { maxOutputTokens: maxTokens, ...(options.jsonMode ? { responseMimeType: 'application/json' } : {}) }
      });
      const sendGemini = (chosenModel: string) => fetchAiJson(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(chosenModel)}:generateContent`,
        { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey! }, body },
        options.timeoutMs
      );
      let json: unknown;
      const geminiCandidateModels = Array.from(new Set([
        ...(sessionEffectiveGeminiModel ? [sessionEffectiveGeminiModel] : []),
        model,
        'gemini-2.5-flash',
        'gemini-2.0-flash',
        'gemini-1.5-flash'
      ]));

      let lastError: unknown;
      let callSuccess = false;
      for (const candidate of geminiCandidateModels) {
        try {
          json = await sendGemini(candidate);
          effectiveModel = candidate;
          sessionEffectiveGeminiModel = candidate;
          callSuccess = true;
          break;
        } catch (error) {
          lastError = error;
          if (error instanceof AiHttpError && error.status === 404) {
            continue;
          }
          throw error;
        }
      }
      if (!callSuccess) {
        throw (lastError || new Error(`Kein kompatibles Gemini-Modell erreichbar.`));
      }
      result = parseAiResult(json, 'gemini');
    } else {
      const messages = [
        ...(options.systemInstruction ? [{ role: 'system', content: options.systemInstruction }] : []),
        { role: 'user', content: prompt }
      ];
      const sendOpenRouter = (chosenModel: string) => fetchAiJson('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://atmen.app', 'X-Title': 'Atmen' },
        body: JSON.stringify({ model: chosenModel, messages, max_tokens: maxTokens, ...(options.jsonMode ? { response_format: { type: 'json_object' } } : {}) })
      }, options.timeoutMs);

      let json: unknown;
      const openRouterCandidates = Array.from(new Set([
        ...(sessionEffectiveOpenRouterModel ? [sessionEffectiveOpenRouterModel] : []),
        model,
        'google/gemini-2.5-flash',
        'openai/gpt-4o-mini'
      ]));

      let lastError: unknown;
      let callSuccess = false;
      for (const candidate of openRouterCandidates) {
        try {
          json = await sendOpenRouter(candidate);
          effectiveModel = candidate;
          sessionEffectiveOpenRouterModel = candidate;
          callSuccess = true;
          break;
        } catch (error) {
          lastError = error;
          if (error instanceof AiHttpError && (error.status === 404 || error.status === 400)) {
            continue;
          }
          throw error;
        }
      }
      if (!callSuccess) {
        throw (lastError || new Error(`Kein kompatibles OpenRouter-Modell erreichbar.`));
      }
      result = parseAiResult(json, 'openrouter');
    }
    const inputTokens = result.inputTokens ?? estimatedInputTokens;
    const outputTokens = result.outputTokens ?? maxTokens;
    const costEur = calculateCostEur(inputTokens, outputTokens);
    await ledger.commitReservation(reservationId, { itemId: options.itemId ?? 'live-ai-call', model: effectiveModel, inputTokens, outputTokens, costEur });
    return { text: result.text, usage: { inputTokens, outputTokens, costEur }, modelUsed: effectiveModel };
  } catch (error) {
    await ledger.releaseReservation(reservationId);
    throw error;
  }
}
