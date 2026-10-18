import { z } from 'zod';

export const AI_REQUEST_TIMEOUT_MS = 15_000;
export const AI_MAX_OUTPUT_TOKENS = 4096;
export const AI_DEFAULT_OUTPUT_TOKENS = 500;
export const AI_MAX_REQUEST_BYTES = 120 * 1024;

export function normalizeAiProxyUrl(value?: string): string | undefined {
  if (!value?.trim()) return undefined;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error();
    return url.toString().replace(/\/+$/, '');
  } catch {
    throw new Error('Die KI-Proxy-URL muss eine gültige HTTPS-Adresse ohne Zugangsdaten, Query oder Fragment sein.');
  }
}

export function boundedOutputTokens(value = AI_DEFAULT_OUTPUT_TOKENS): number {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error('maxTokens muss eine positive ganze Zahl sein.');
  return Math.min(value, AI_MAX_OUTPUT_TOKENS);
}

/** Counts UTF-8 bytes without depending on Node Buffer or a native TextEncoder polyfill. */
export function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (const character of value) {
    const code = character.codePointAt(0)!;
    bytes += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
  }
  return bytes;
}

export class AiHttpError extends Error {
  constructor(public readonly status: number) {
    super(`KI-Anfrage fehlgeschlagen (HTTP ${status}).`);
    this.name = 'AiHttpError';
  }
}

/** The timer covers fetch AND body consumption, including transports which ignore abort. */
export async function fetchAiJson(url: string, init: RequestInit, timeoutMs = AI_REQUEST_TIMEOUT_MS): Promise<unknown> {
  const controller = new AbortController();
  const duration = Number.isFinite(timeoutMs) ? Math.min(AI_REQUEST_TIMEOUT_MS, Math.max(1, timeoutMs)) : AI_REQUEST_TIMEOUT_MS;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error('Zeitüberschreitung bei der KI-Anfrage.'));
    }, duration);
  });
  try {
    return await Promise.race([
      (async () => {
        const response = await fetch(url, { ...init, signal: controller.signal });
        // Do not echo or consume provider error bodies: they can contain credentials or prompts.
        if (!response.ok) throw new AiHttpError(response.status);
        return await response.json() as unknown;
      })(),
      timeout
    ]);
  } catch (error) {
    if (error instanceof AiHttpError) throw error;
    if (controller.signal.aborted) throw new Error('Zeitüberschreitung bei der KI-Anfrage.');
    // Network/JSON errors can include the full URL or request headers. Keep this boundary generic.
    throw new Error('Die KI-Anfrage konnte nicht abgeschlossen werden.');
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

const countSchema = z.number().finite().nonnegative().nullable().optional();

const partSchema = z.object({
  text: z.string().nullable().optional()
}).passthrough();

const contentSchema = z.object({
  parts: z.array(partSchema).optional(),
  role: z.string().optional()
}).passthrough().optional();

const candidateSchema = z.object({
  content: contentSchema,
  finishReason: z.string().optional()
}).passthrough();

const providerResultSchema = z.object({
  candidates: z.array(candidateSchema).optional(),
  choices: z.array(z.object({
    message: z.object({
      content: z.string().nullable().optional()
    }).passthrough().optional()
  }).passthrough()).optional(),
  usageMetadata: z.object({
    promptTokenCount: countSchema,
    candidatesTokenCount: countSchema,
    totalTokenCount: countSchema
  }).passthrough().optional(),
  usage: z.object({
    prompt_tokens: countSchema,
    completion_tokens: countSchema
  }).passthrough().optional()
}).passthrough();

const proxyResultSchema = z.object({
  text: z.string().trim().min(1),
  model: z.string().optional(),
  usage: z.object({
    promptTokenCount: countSchema,
    candidatesTokenCount: countSchema
  }).passthrough().optional()
}).passthrough();

export interface ParsedAiResult {
  text: string;
  inputTokens?: number;
  outputTokens?: number;
  model?: string;
}

export function parseAiResult(value: unknown, provider: 'gemini' | 'openrouter' | 'proxy'): ParsedAiResult {
  if (provider === 'proxy') {
    const parsed = proxyResultSchema.safeParse(value);
    if (!parsed.success) throw new Error('Ungültige oder leere Antwort des KI-Proxys.');
    return {
      text: parsed.data.text,
      inputTokens: parsed.data.usage?.promptTokenCount ?? undefined,
      outputTokens: parsed.data.usage?.candidatesTokenCount ?? undefined,
      model: parsed.data.model
    };
  }
  const parsed = providerResultSchema.safeParse(value);
  if (!parsed.success) throw new Error('Ungültige Antwort des KI-Anbieters.');
  const text = provider === 'gemini'
    ? parsed.data.candidates?.[0]?.content?.parts
        ?.map(part => part.text ?? '')
        ?.filter(Boolean)
        ?.join('') ?? ''
    : parsed.data.choices?.[0]?.message?.content ?? '';
  if (!text.trim()) throw new Error('Leere Antwort des KI-Anbieters.');
  return {
    text,
    inputTokens: (provider === 'gemini' ? parsed.data.usageMetadata?.promptTokenCount : parsed.data.usage?.prompt_tokens) ?? undefined,
    outputTokens: (provider === 'gemini' ? parsed.data.usageMetadata?.candidatesTokenCount : parsed.data.usage?.completion_tokens) ?? undefined
  };
}
