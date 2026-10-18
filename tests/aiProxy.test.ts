import assert from 'node:assert/strict';
import { afterEach, test, mock } from 'node:test';
import { handleAiProxyRequest } from '../server/ai/proxy';

const request = (overrides: Record<string, unknown> = {}) => ({ method: 'POST', url: '/api/ai/curate', headers: { 'x-provider-api-key': 'fake-byok-key' }, clientIp: '192.0.2.1', body: { prompt: 'hello', model: 'gemini-2.5-flash', provider: 'gemini', maxTokens: 41 }, ...overrides });
const upstreamResult = () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'ok' }] } }], usageMetadata: { promptTokenCount: 2, candidatesTokenCount: 1 } }));
afterEach(() => mock.restoreAll());

test('server master key cannot fund unauthenticated requests', async () => {
  const previous = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'fake-server-master';
  const fetchMock = mock.method(globalThis, 'fetch', async () => upstreamResult());
  try {
    const result = await handleAiProxyRequest(request({ headers: {} }));
    assert.equal(result.statusCode, 401);
    assert.equal(fetchMock.mock.calls.length, 0);
  } finally { if (previous === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previous; }
});

test('BYOK takes precedence over a server master and never consumes its budget', async () => {
  const previous = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'fake-server-master';
  let headers = new Headers();
  mock.method(globalThis, 'fetch', async (_url: string | URL | Request, init?: RequestInit) => { headers = new Headers(init?.headers); return upstreamResult(); });
  try {
    const result = await handleAiProxyRequest(request());
    assert.equal(result.statusCode, 200);
    assert.equal(headers.get('x-goog-api-key'), 'fake-byok-key');
  } finally { if (previous === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previous; }
});

test('only allowlisted routes, methods, models and a valid request schema reach upstream', async () => {
  const fetchMock = mock.method(globalThis, 'fetch', async () => upstreamResult());
  for (const [override, expected] of [
    [{ url: '/api/ai/arbitrary' }, 404],
    [{ method: 'GET' }, 405],
    [{ body: '{invalid' }, 400],
    [{ body: { prompt: 'hello', model: 'expensive-arbitrary-model' } }, 400],
    [{ body: { prompt: '', model: 'gemini-2.5-flash' } }, 400],
    [{ body: { prompt: ['hello'], model: 'gemini-2.5-flash' } }, 400],
    [{ body: { prompt: 'hello', model: 'gemini-2.5-flash', maxTokens: -5 } }, 400]
  ] as const) {
    assert.equal((await handleAiProxyRequest(request(override))).statusCode, expected);
  }
  assert.equal(fetchMock.mock.calls.length, 0);
});

test('UTF-8 byte limit rejects a multibyte body below the JavaScript character ceiling', async () => {
  const fetchMock = mock.method(globalThis, 'fetch', async () => upstreamResult());
  const body = JSON.stringify({ prompt: '漢'.repeat(66_667) });
  assert.ok(body.length < 120 * 1024);
  assert.equal((await handleAiProxyRequest(request({ body }))).statusCode, 413);
  assert.equal(fetchMock.mock.calls.length, 0);
});

test('Gemini upstream output tokens are capped even when the client requests more', async () => {
  let body: Record<string, unknown> = {};
  mock.method(globalThis, 'fetch', async (_url: string | URL | Request, init?: RequestInit) => { body = JSON.parse(init!.body as string); return upstreamResult(); });
  const result = await handleAiProxyRequest(request({ body: { prompt: 'hello', model: 'gemini-2.5-flash', maxTokens: 99_999 } }));
  assert.equal(result.statusCode, 200);
  assert.equal((body.generationConfig as Record<string, unknown>).maxOutputTokens, 4096);
});

test('OpenRouter BYOK uses its own endpoint and Authorization header', async () => {
  let endpoint = '';
  let requestInit: RequestInit | undefined;
  mock.method(globalThis, 'fetch', async (url: string | URL | Request, init?: RequestInit) => {
    endpoint = String(url); requestInit = init;
    return new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }], usage: { prompt_tokens: 2, completion_tokens: 1 } }));
  });
  const result = await handleAiProxyRequest(request({ body: { prompt: 'hello', provider: 'openrouter', model: 'openai/gpt-4o-mini', maxTokens: 87 } }));
  assert.equal(result.statusCode, 200);
  assert.equal(endpoint, 'https://openrouter.ai/api/v1/chat/completions');
  assert.equal(new Headers(requestInit!.headers).get('Authorization'), 'Bearer fake-byok-key');
  assert.equal(JSON.parse(requestInit!.body as string).max_tokens, 87);
  assert.equal((result.body.usage as { candidatesTokenCount: number }).candidatesTokenCount, 1);
});

test('CORS rejects unknown origins and only echoes explicitly permitted origins', async () => {
  mock.method(globalThis, 'fetch', async () => upstreamResult());
  const rejected = await handleAiProxyRequest(request({ headers: { origin: 'https://evil.example', 'x-provider-api-key': 'fake-key' } }));
  assert.equal(rejected.statusCode, 403);
  assert.notEqual(rejected.headers['Access-Control-Allow-Origin'], '*');
  const allowed = await handleAiProxyRequest(request({ method: 'OPTIONS', headers: { origin: 'https://reader.example' } }), { allowedOrigins: ['https://reader.example'] });
  assert.equal(allowed.statusCode, 204);
  assert.equal(allowed.headers['Access-Control-Allow-Origin'], 'https://reader.example');
});

test('forwarded headers cannot evade rate limiting when no trusted client IP is supplied', async () => {
  let count = 0;
  mock.method(globalThis, 'fetch', async () => upstreamResult());
  const seenKeys: string[] = [];
  const rateLimiter = { isAllowed(key: string) { seenKeys.push(key); return ++count <= 1; } };
  const first = await handleAiProxyRequest(request({ clientIp: undefined, headers: { 'x-provider-api-key': 'fake-key', 'x-forwarded-for': '192.0.2.10' } }), { rateLimiter });
  const second = await handleAiProxyRequest(request({ clientIp: undefined, headers: { 'x-provider-api-key': 'fake-key', 'x-forwarded-for': '192.0.2.20' } }), { rateLimiter });
  assert.equal(first.statusCode, 200);
  assert.equal(second.statusCode, 429);
  assert.deepEqual(seenKeys, ['unidentified-client', 'unidentified-client']);
});

test('proxy timeout includes response body, and upstream failures never echo secrets', async () => {
  mock.method(globalThis, 'fetch', async () => ({ ok: true, status: 200, json: () => new Promise(() => {}) } as Response));
  assert.equal((await handleAiProxyRequest(request(), { timeoutMs: 15 })).statusCode, 504);
  mock.restoreAll();
  mock.method(globalThis, 'fetch', async () => new Response('fake-byok-key echoed', { status: 401 }));
  const rejected = await handleAiProxyRequest(request());
  assert.equal(rejected.statusCode, 401);
  assert.ok(!JSON.stringify(rejected.body).includes('fake-byok-key'));
});
