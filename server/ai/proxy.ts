/**
 * Optional AI HTTP handler. GitHub Pages does not execute or deploy this server code.
 * BYOK requests always use the caller's key. Shared server keys require an explicit
 * server-side authenticator (or a service-to-service opaque bearer token).
 * HTTP adapters must enforce the same byte ceiling before buffering the request,
 * supply clientIp only from their trusted connection, and use a distributed limiter
 * across workers in production. The default limiter protects one process only.
 */
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { AI_MAX_REQUEST_BYTES, AI_REQUEST_TIMEOUT_MS, AiHttpError, boundedOutputTokens, fetchAiJson, parseAiResult, utf8ByteLength } from '../../src/core/ai/aiTransport';

export interface ProxyRequestContext {
  method: string;
  url: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
  /** Trusted adapter value, never an unvalidated forwarded header. */
  clientIp?: string;
}

export interface ProxyResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

export interface ProxyRateLimiter {
  isAllowed(clientKey: string): boolean | Promise<boolean>;
}

export interface AiProxyOptions {
  allowedOrigins?: readonly string[];
  /** Authenticate the actual user/session server-side before permitting shared-key spend. */
  authenticate?: (ctx: ProxyRequestContext) => boolean | Promise<boolean>;
  /** A server-only service token; never embed in static browser code. */
  accessToken?: string;
  rateLimiter?: ProxyRateLimiter;
  timeoutMs?: number;
  /** Provider/model allowlists may be narrowed by the deployment. */
  allowedModels?: Partial<Record<'gemini' | 'openrouter', readonly string[]>>;
}

class InMemoryRateLimiter implements ProxyRateLimiter {
  private readonly requests = new Map<string, number[]>();
  constructor(private readonly maxRequestsPerMinute = 45) {}

  public isAllowed(clientKey: string): boolean {
    const now = Date.now();
    // Bound memory and expire inactive clients on every request.
    for (const [key, timestamps] of this.requests) {
      const recent = timestamps.filter(timestamp => timestamp > now - 60_000);
      if (recent.length) this.requests.set(key, recent);
      else this.requests.delete(key);
    }
    if (!this.requests.has(clientKey) && this.requests.size >= 10_000) return false;
    const recent = this.requests.get(clientKey) ?? [];
    if (recent.length >= this.maxRequestsPerMinute) return false;
    recent.push(now);
    this.requests.set(clientKey, recent);
    return true;
  }
}

export const defaultProxyRateLimiter = new InMemoryRateLimiter();

// Explicit text-only defaults; unknown IDs cannot bill a shared server key.
const DEFAULT_ALLOWED_MODELS = {
  gemini: ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro', 'gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.1-pro-preview'],
  openrouter: ['google/gemini-2.5-flash', 'google/gemini-3.8-flash', 'anthropic/claude-3.5-sonnet', 'openai/gpt-4o-mini', 'meta-llama/llama-3.3-70b-instruct']
} as const;

const requestSchema = z.object({
  provider: z.enum(['gemini', 'openrouter']).default('gemini'),
  model: z.string().min(1).max(160).optional(),
  prompt: z.string().trim().min(1),
  systemInstruction: z.string().optional(),
  jsonMode: z.boolean().optional(),
  maxTokens: z.number().int().positive().optional()
}).strict();

function header(ctx: ProxyRequestContext, name: string): string | undefined {
  const match = Object.entries(ctx.headers).find(([key]) => key.toLowerCase() === name);
  // Reject ambiguous duplicate credentials rather than guessing which one to use.
  return typeof match?.[1] === 'string' ? match[1].trim() : undefined;
}

function tokenMatches(actual: string | undefined, expected: string | undefined): boolean {
  if (!actual || !expected) return false;
  const actualBytes = Buffer.from(actual);
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

export async function handleAiProxyRequest(ctx: ProxyRequestContext, options: AiProxyOptions = {}): Promise<ProxyResponse> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', Vary: 'Origin' };
  const respond = (statusCode: number, body: Record<string, unknown>): ProxyResponse => ({ statusCode, headers, body });
  const origin = header(ctx, 'origin');
  const allowedOrigins = options.allowedOrigins ?? (process.env.ATMEN_AI_ALLOWED_ORIGINS ?? '').split(',').map(value => value.trim()).filter(Boolean);
  if (origin && !allowedOrigins.includes(origin)) return respond(403, { error: 'Dieser Ursprung ist für den KI-Proxy nicht freigegeben.' });
  if (origin) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Credentials'] = 'true';
  }
  const pathname = new URL(ctx.url, 'http://localhost').pathname;
  if (!['/api/ai/capabilities', '/api/ai/curate'].includes(pathname)) return respond(404, { error: 'Unbekannter KI-Endpunkt.' });
  if (ctx.method === 'OPTIONS') {
    headers['Access-Control-Allow-Methods'] = pathname.endsWith('/capabilities') ? 'GET, OPTIONS' : 'POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, x-provider-api-key, x-gemini-key';
    return respond(204, {});
  }
  if (pathname === '/api/ai/capabilities') {
    if (ctx.method !== 'GET') return respond(405, { error: 'Methode nicht erlaubt.' });
    const masterKeyConfigured = Boolean(process.env.GEMINI_API_KEY?.trim() || process.env.OPENROUTER_API_KEY?.trim());
    return respond(200, {
      serverProxyActive: true,
      masterKeyConfigured,
      sharedKeyAccessEnabled: masterKeyConfigured && Boolean(options.authenticate || options.accessToken || process.env.ATMEN_AI_PROXY_ACCESS_TOKEN),
      sharedKeyAuthenticationRequired: true,
      byokSupported: true,
      supportedProviders: ['gemini', 'openrouter'],
      supportedEndpoints: ['/api/ai/curate'],
      defaultModel: 'gemini-2.5-flash',
      allowedModels: options.allowedModels ?? DEFAULT_ALLOWED_MODELS,
      rateLimitPerMinute: options.rateLimiter ? null : 45,
      rateLimitScope: options.rateLimiter ? 'deployment-adapter' : 'single-process',
      maxRequestBytes: AI_MAX_REQUEST_BYTES,
      maxOutputTokens: 4096
    });
  }
  if (ctx.method !== 'POST') return respond(405, { error: 'Methode nicht erlaubt.' });
  if (!ctx.body) return respond(400, { error: 'Ungültiger oder leerer Anfrage-Body.' });

  let body: unknown;
  try {
    const serialized = typeof ctx.body === 'string' ? ctx.body : JSON.stringify(ctx.body);
    if (!serialized) return respond(400, { error: 'Ungültiger oder leerer Anfrage-Body.' });
    if (utf8ByteLength(serialized) > AI_MAX_REQUEST_BYTES) return respond(413, { error: 'Payload zu groß (maximal 120 KB erlaubt).' });
    body = typeof ctx.body === 'string' ? JSON.parse(ctx.body) as unknown : ctx.body;
  } catch {
    return respond(400, { error: 'Ungültiger JSON-Anfrage-Body.' });
  }
  const validated = requestSchema.safeParse(body);
  if (!validated.success) return respond(400, { error: 'Ungültiges KI-Anfrageschema.' });
  const { provider, prompt, systemInstruction, jsonMode } = validated.data;
  const model = validated.data.model ?? (provider === 'gemini' ? 'gemini-2.5-flash' : 'google/gemini-2.5-flash');
  const allowlist = options.allowedModels?.[provider] ?? DEFAULT_ALLOWED_MODELS[provider];
  if (!allowlist.includes(model)) return respond(400, { error: 'Das gewählte Modell ist für diesen KI-Proxy nicht freigegeben.' });
  const maxTokens = boundedOutputTokens(validated.data.maxTokens);

  // BYOK never falls through to the server master, even if the user's key is rejected upstream.
  const providerKey = header(ctx, 'x-provider-api-key');
  const legacyGeminiKey = header(ctx, 'x-gemini-key');
  if (legacyGeminiKey && provider !== 'gemini') return respond(400, { error: 'Der API-Schlüssel passt nicht zum gewählten Anbieter.' });
  const byokKey = providerKey || legacyGeminiKey;
  const anyByokHeader = Object.keys(ctx.headers).some(key => ['x-provider-api-key', 'x-gemini-key'].includes(key.toLowerCase()));
  if (anyByokHeader && !byokKey) return respond(401, { error: 'Ungültiger BYOK-API-Schlüssel.' });
  if (byokKey && (byokKey.length > 4096 || /[\r\n]/.test(byokKey))) return respond(400, { error: 'Ungültiger BYOK-API-Schlüssel.' });
  let effectiveKey = byokKey;
  if (!effectiveKey) {
    let authenticated = false;
    try {
      authenticated = options.authenticate
        ? await options.authenticate(ctx)
        : tokenMatches(header(ctx, 'authorization')?.replace(/^Bearer /i, ''), options.accessToken ?? process.env.ATMEN_AI_PROXY_ACCESS_TOKEN);
    } catch {
      authenticated = false;
    }
    if (!authenticated) return respond(401, { error: 'Für den Server-Schlüssel ist eine authentifizierte Sitzung erforderlich. Alternativ eigenen API-Schlüssel verwenden.' });
    effectiveKey = (provider === 'gemini' ? process.env.GEMINI_API_KEY : process.env.OPENROUTER_API_KEY)?.trim();
    if (!effectiveKey) return respond(503, { error: 'Für diesen Anbieter ist kein Server-Schlüssel konfiguriert.' });
  }
  // HTTP adapters must derive clientIp from a trusted socket/platform, not user headers.
  const clientKey = ctx.clientIp?.trim() || 'unidentified-client';
  if (!await (options.rateLimiter ?? defaultProxyRateLimiter).isAllowed(clientKey)) {
    headers['Retry-After'] = '60';
    return respond(429, { error: 'Zu viele KI-Anfragen. Bitte warte einen Moment.', retryAfterSeconds: 60 });
  }

  try {
    const upstream = provider === 'gemini'
      ? await fetchAiJson(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': effectiveKey },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          ...(systemInstruction ? { systemInstruction: { parts: [{ text: systemInstruction }] } } : {}),
          generationConfig: { maxOutputTokens: maxTokens, ...(jsonMode ? { responseMimeType: 'application/json' } : {}) }
        })
      }, options.timeoutMs)
      : await fetchAiJson('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${effectiveKey}` },
        body: JSON.stringify({
          model,
          messages: [...(systemInstruction ? [{ role: 'system', content: systemInstruction }] : []), { role: 'user', content: prompt }],
          max_tokens: maxTokens,
          ...(jsonMode ? { response_format: { type: 'json_object' } } : {})
        })
      }, options.timeoutMs);
    const result = parseAiResult(upstream, provider);
    return respond(200, { success: true, text: result.text, model, usage: { promptTokenCount: result.inputTokens, candidatesTokenCount: result.outputTokens } });
  } catch (error) {
    if (error instanceof AiHttpError) return respond(error.status, { error: `KI-Anbieter meldet HTTP ${error.status}.` });
    const isTimeout = error instanceof Error && error.message.includes('Zeitüberschreitung');
    return respond(isTimeout ? 504 : 502, { error: isTimeout ? `Zeitüberschreitung bei der KI-Anfrage (${AI_REQUEST_TIMEOUT_MS / 1000}s maximal).` : 'Die Antwort des KI-Anbieters konnte nicht verarbeitet werden.' });
  }
}
