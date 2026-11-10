import { appStorage, AtemStorage } from '../data/storage';
import {
  AI_CONNECTION_TEST_TIMEOUT_MS,
  AiHttpError,
  boundedOutputTokens,
  fetchAiJson,
  normalizeAiProxyUrl,
  parseAiResult,
  ParsedAiResult
} from './aiTransport';
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
  validateModelChoice,
  findGeminiModel,
  isProOrReasoningModelId,
  isGeminiCodenameAlias,
  mapGeminiModelIdToAvailable,
  resolveEffectiveGoogleApiModelId,
  clearResolvedGeminiModelCache
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
const sessionEffectiveGeminiModelBySelected = new Map<string, string>();
let sessionEffectiveOpenRouterModel: string | null = null;

export function resetSessionEffectiveModels(): void {
  sessionEffectiveGeminiModelBySelected.clear();
  sessionEffectiveOpenRouterModel = null;
  clearResolvedGeminiModelCache();
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

export type CredentialChangeListener = (creds: AiCredentials) => void;
const credentialListeners = new Set<CredentialChangeListener>();

export function onAiCredentialsChange(listener: CredentialChangeListener): () => void {
  credentialListeners.add(listener);
  return () => {
    credentialListeners.delete(listener);
  };
}

export function notifyAiCredentialsChange(creds: AiCredentials): void {
  for (const listener of credentialListeners) {
    try {
      listener(creds);
    } catch {
      // Non-fatal listener error
    }
  }
}

export async function saveAiCredentials(credentials: AiCredentials, storage: AtemStorage = appStorage): Promise<void> {
  const normalized = normalizeCredentials(credentials);
  await storage.setItem(AI_CREDENTIALS_STORAGE_KEY, JSON.stringify({ ...normalized, apiKey: normalized.persistApiKey ? normalized.apiKey : '' }));
  if (normalized.apiKey) sessionApiKeys.set(storage, normalized.apiKey);
  else sessionApiKeys.delete(storage);
  notifyAiCredentialsChange(normalized);
}

export async function getGeminiApiKey(storage: AtemStorage = appStorage): Promise<string> {
  const direct = await storage.getItem('@atem:gemini_api_key:v1');
  if (direct && direct.trim()) return direct.trim();
  const creds = await loadAiCredentials(storage);
  return (creds.provider === 'gemini' && creds.apiKey) ? creds.apiKey.trim() : '';
}

export async function getOpenRouterApiKey(storage: AtemStorage = appStorage): Promise<string> {
  const direct = await storage.getItem('@atem:openrouter_api_key:v1');
  if (direct && direct.trim()) return direct.trim();
  const creds = await loadAiCredentials(storage);
  return (creds.provider === 'openrouter' && creds.apiKey) ? creds.apiKey.trim() : '';
}

export async function getPreferredProvider(storage: AtemStorage = appStorage): Promise<'gemini' | 'openrouter'> {
  const direct = await storage.getItem('@atem:preferred_ai_provider:v1');
  if (direct === 'openrouter' || direct === 'gemini') return direct;
  const creds = await loadAiCredentials(storage);
  return creds.provider;
}

export async function getSelectedModelId(storage: AtemStorage = appStorage): Promise<string> {
  const direct = await storage.getItem('@atem:selected_model_id:v1');
  if (direct && direct.trim()) return direct.trim();
  const creds = await loadAiCredentials(storage);
  return creds.model || DEFAULT_GEMINI_MODEL;
}

export const atmenAiClient = {
  loadCredentials: loadAiCredentials,
  saveCredentials: saveAiCredentials,
  getGeminiApiKey,
  getOpenRouterApiKey,
  getPreferredProvider,
  getSelectedModelId,
  setApiKey: async (key: string, provider: 'gemini' | 'openrouter' = 'gemini', storage: AtemStorage = appStorage) => {
    const creds = await loadAiCredentials(storage);
    const trimmed = key.trim();
    await saveAiCredentials({
      ...creds,
      provider,
      apiKey: trimmed,
      persistApiKey: true
    }, storage);
    if (provider === 'gemini') {
      await storage.setItem('@atem:gemini_api_key:v1', trimmed);
    } else {
      await storage.setItem('@atem:openrouter_api_key:v1', trimmed);
    }
  }
};

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
  temperature?: number;
  credentials?: AiCredentials;
  ledger?: EnrichmentUsageLedger;
  itemId?: string;
  /** Custom deadline in milliseconds (up to 60s for Pro/Reasoning models). */
  timeoutMs?: number;
  bypassBudgetCeiling?: boolean;
}

export interface AiConnectionTestResult {
  ok: boolean;
  message: string;
  latencyMs?: number;
  selectedModel?: string;
  resolvedModel?: string;
}

/**
 * Tests connection to configured provider with a 25s reasoning-safe deadline and 256 maxOutputTokens
 * so Gemini Pro / Argon / Carbon / Thinking models never exhaust tokens during internal reasoning.
 */
export async function testAiConnection(
  credentials: AiCredentials
): Promise<AiConnectionTestResult> {
  if (!hasAiConfiguration(credentials)) {
    return { ok: false, message: 'Bitte gib einen API-Schlüssel oder eine eigene HTTPS-Proxy-Adresse ein.' };
  }

  const selectedModel = credentials.model?.trim() || (
    credentials.provider === 'openrouter' ? DEFAULT_OPENROUTER_MODEL : DEFAULT_GEMINI_MODEL
  );
  const selectedLabel = credentials.provider === 'gemini'
    ? (findGeminiModel(selectedModel)?.label || selectedModel)
    : selectedModel;

  const start = Date.now();
  try {
    const res = await callAiModel('Antworte nur mit: {"status": "ok"}', {
      jsonMode: false,
      temperature: 0.2,
      credentials,
      itemId: 'connection-test',
      maxTokens: 256,
      timeoutMs: AI_CONNECTION_TEST_TIMEOUT_MS,
      bypassBudgetCeiling: true,
      // We pass an isolated in-memory ledger for connection testing so test calls don't block
      ledger: new EnrichmentUsageLedger('', false)
    });

    const latencyMs = Date.now() - start;
    const resolvedModel = res.modelUsed || selectedModel;
    const secondsStr = `${(latencyMs / 1000).toFixed(1)}s`;
    const providerName = credentials.provider === 'openrouter' ? 'OpenRouter' : 'Gemini';

    return {
      ok: true,
      message: `✓ Verbunden mit ${providerName}: ${selectedLabel} (via ${resolvedModel} · ${secondsStr})`,
      latencyMs,
      selectedModel,
      resolvedModel
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      message: `🔴 Verbindungsfehler: ${errorMsg}`,
      selectedModel
    };
  }
}

export const testConnection = testAiConnection;

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
  const isPersonalByok = Boolean(apiKey && (credentials.persistApiKey === true || options.bypassBudgetCeiling === true));
  let reservationId = await ledger.reserveSpend(calculateCostEur(estimatedInputTokens, maxTokens));
  if (!reservationId) {
    // When the user has explicitly provided their own personal API key (BYOK), do not block requests.
    // They are paying for their own quota directly; usage tracking continues in the ledger.
    if (!isPersonalByok) {
      throw new AiBudgetExceededError(`Monatliches KI-Budget-Limit (${MONTHLY_BUDGET_CEILING_EUR.toFixed(2)} €) erreicht oder gesperrt.`);
    }
    reservationId = `byok_${Date.now()}`;
  }

  try {
    let result: ParsedAiResult | null = null;
    let effectiveModel = model;
    let proxySucceeded = false;

    // Detect static web hosts (e.g. GitHub Pages) where no server-side /api/ai proxy exists
    const isStaticHost = typeof window !== 'undefined' && Boolean(
      window.location?.hostname?.includes('github.io') ||
      window.location?.hostname?.endsWith('.pages.dev') ||
      window.location?.hostname?.endsWith('.vercel.app')
    );
    const isInternalOrStaticProxy = !proxyUrl || proxyUrl.startsWith('/') || (proxyUrl.includes('/api/ai') && isStaticHost);
    const shouldAttemptProxy = Boolean(proxyUrl && (!isStaticHost || !isInternalOrStaticProxy));

    if (shouldAttemptProxy && proxyUrl) {
      try {
        const json = await fetchAiJson(`${proxyUrl}/curate`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', ...(apiKey ? { 'x-provider-api-key': apiKey } : {}) },
          body: JSON.stringify({ provider: credentials.provider, prompt, systemInstruction: options.systemInstruction, jsonMode: options.jsonMode, model, maxTokens })
        }, options.timeoutMs);
        result = parseAiResult(json, 'proxy');
        effectiveModel = result.model || model;
        proxySucceeded = true;
      } catch (proxyError: any) {
        // GitHub Pages / static hosting direct BYOK fallback:
        // If proxy failed (e.g. 404/405 or network unreachable) and the user configured an apiKey,
        // seamlessly fall back to direct provider HTTPS call!
        // NOTE: If the proxy explicitly responded with 429 (rate limited / budget cap), fail closed without paid direct retry.
        const isRateLimited = proxyError instanceof AiHttpError && proxyError.status === 429;
        if (apiKey && !isRateLimited) {
          console.warn('AI proxy unavailable, falling back to direct provider BYOK HTTPS call:', proxyError);
        } else {
          throw proxyError;
        }
      }
    }

    if (!proxySucceeded) {
      if (credentials.provider === 'gemini') {
        const isProTier = isProOrReasoningModelId(model);
        const isConnectionTest = options.itemId === 'connection-test';
        const candidateTimeoutMs = isConnectionTest
          ? 8000
          : (options.timeoutMs ? Math.min(options.timeoutMs, 18000) : (isProTier ? 18000 : 15000));

        const body = JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          ...(options.systemInstruction ? { systemInstruction: { parts: [{ text: options.systemInstruction }] } } : {}),
          generationConfig: {
            maxOutputTokens: maxTokens,
            ...(typeof options.temperature === 'number' ? { temperature: options.temperature } : {}),
            ...(options.jsonMode ? { responseMimeType: 'application/json' } : {})
          }
        });
        const sendGemini = (chosenModel: string) => fetchAiJson(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(chosenModel)}:generateContent`,
          { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey! }, body },
          candidateTimeoutMs
        );

        // Pre-resolve codename aliases (e.g. gemini-4-argon, gemini-4-carbon, gemini-3.8-pro, gemini-3.8-flash)
        // against the user's live /v1beta/models list (cached in memory per API key).
        let primaryCandidate = sessionEffectiveGeminiModelBySelected.get(model) || model;
        if (!sessionEffectiveGeminiModelBySelected.has(model) && isGeminiCodenameAlias(model)) {
          if (candidateTimeoutMs >= 500) {
            primaryCandidate = await resolveEffectiveGoogleApiModelId(
              model,
              apiKey,
              Math.min(3000, candidateTimeoutMs)
            );
          } else {
            primaryCandidate = mapGeminiModelIdToAvailable(model, []);
          }
        }

        const tierFallbacks = isProTier
          ? ['gemini-2.5-pro', 'gemini-2.5-flash']
          : ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];

        const geminiCandidateModels = Array.from(new Set([
          primaryCandidate,
          ...tierFallbacks
        ]));

        let json: unknown;
        let lastError: unknown;
        let callSuccess = false;
        for (let idx = 0; idx < geminiCandidateModels.length; idx++) {
          const candidate = geminiCandidateModels[idx];
          try {
            json = await sendGemini(candidate);
            effectiveModel = candidate;
            sessionEffectiveGeminiModelBySelected.set(model, candidate);
            callSuccess = true;
            break;
          } catch (error) {
            lastError = error;
            // Immediate fatal stop ONLY if key is rejected as unauthorized (HTTP 401)
            if (error instanceof AiHttpError && error.status === 401) {
              throw error;
            }
            // Fail fast without candidate looping if network is completely unavailable / offline
            if (error instanceof Error && (
              error.message === 'Die KI-Anfrage konnte nicht abgeschlossen werden.' ||
              error.message.includes('Network unavailable') ||
              error.message.includes('fetch failed')
            )) {
              throw error;
            }
            // On ANY other error (timeout, 400, 404, 429, 500, 503): fall back to next candidate if available!
            if (idx < geminiCandidateModels.length - 1) {
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
  }

  if (!result) {
    throw new Error('Kein KI-Ergebnis erhalten.');
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
