import assert from 'node:assert/strict';
import { afterEach, test, mock } from 'node:test';
import { AtemStorage, MemoryStorageDriver } from '../src/core/data/storage';
import { EnrichmentUsageLedger } from '../src/core/enrichment/ledger';
import { AI_CREDENTIALS_STORAGE_KEY, callAiModel, clearAiCredentials, loadAiCredentials, saveAiCredentials, testAiConnection } from '../src/core/ai/atmenAiClient';

const makeLedger = () => new EnrichmentUsageLedger('', false);
const geminiResult = () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'ok' }] } }], usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 1 } }));
afterEach(() => mock.restoreAll());

test('credential metadata and proxy survive reload, while new keys are session-only by default', async () => {
  const driver = new MemoryStorageDriver();
  const storage = new AtemStorage(driver);
  await saveAiCredentials({ provider: 'openrouter', apiKey: 'fake-private-key', model: 'openai/gpt-4o-mini', proxyUrl: 'https://proxy.example/api/ai/' }, storage);
  assert.equal((await loadAiCredentials(storage)).apiKey, 'fake-private-key');
  assert.ok(!JSON.stringify(driver.dump()).includes('fake-private-key'));
  const reloaded = await loadAiCredentials(new AtemStorage(driver));
  assert.equal(reloaded.proxyUrl, 'https://proxy.example/api/ai');
  assert.equal(reloaded.apiKey, '');
  assert.equal(reloaded.model, 'openai/gpt-4o-mini');
});

test('legacy plaintext keys migrate out of durable storage but work for the current session', async () => {
  const storage = new AtemStorage(new MemoryStorageDriver());
  await storage.setItem(AI_CREDENTIALS_STORAGE_KEY, JSON.stringify({ provider: 'gemini', apiKey: 'fake-legacy-key', model: 'gemini-2.5-flash', proxyUrl: 'https://proxy.example/api/ai' }));
  assert.equal((await loadAiCredentials(storage)).apiKey, 'fake-legacy-key');
  assert.ok(!(await storage.getItem(AI_CREDENTIALS_STORAGE_KEY))!.includes('fake-legacy-key'));
  assert.equal((await loadAiCredentials(storage)).apiKey, 'fake-legacy-key');
});

test('deliberate persistence can be revoked, and clearing credentials removes the session key', async () => {
  const storage = new AtemStorage(new MemoryStorageDriver());
  await saveAiCredentials({ provider: 'gemini', apiKey: 'fake-opt-in-key', persistApiKey: true }, storage);
  assert.equal((await loadAiCredentials(new AtemStorage(storage.driver))).apiKey, 'fake-opt-in-key');
  await saveAiCredentials({ provider: 'gemini', apiKey: 'fake-opt-in-key', persistApiKey: false }, storage);
  assert.ok(!(await storage.getItem(AI_CREDENTIALS_STORAGE_KEY))!.includes('fake-opt-in-key'));
  await clearAiCredentials(storage);
  assert.equal((await loadAiCredentials(storage)).apiKey, '');
});

test('unsafe proxy URLs reject before credentials are saved or any network call is made', async () => {
  const storage = new AtemStorage(new MemoryStorageDriver());
  const fetchMock = mock.method(globalThis, 'fetch', async () => geminiResult());
  for (const proxyUrl of ['http://proxy.example/api/ai', 'https://user:pass@proxy.example', 'https://proxy.example/?key=secret', 'not-a-url']) {
    await assert.rejects(saveAiCredentials({ provider: 'gemini', apiKey: 'fake-key', proxyUrl }, storage), /HTTPS|Proxy/);
    await assert.rejects(callAiModel('hello', { credentials: { provider: 'gemini', apiKey: 'fake-key', proxyUrl }, ledger: makeLedger() }), /HTTPS|Proxy/);
  }
  assert.equal(fetchMock.mock.calls.length, 0);
});

test('configured proxy 429 fails closed and releases reserved budget without a paid direct retry', async () => {
  const fetchMock = mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ error: 'rate limited' }), { status: 429 }));
  const ledger = makeLedger();
  await assert.rejects(callAiModel('hello', { credentials: { provider: 'gemini', apiKey: 'fake-key', proxyUrl: 'https://proxy.example/api/ai' }, ledger }), /429/);
  assert.equal(fetchMock.mock.calls.length, 1);
  assert.equal((await ledger.getSummary()).totalCostEur, 0);
});

test('OpenRouter proxy forwards provider, provider-neutral BYOK header and bounded output tokens', async () => {
  let request: RequestInit | undefined;
  mock.method(globalThis, 'fetch', async (_url: string | URL | Request, init?: RequestInit) => {
    request = init;
    return new Response(JSON.stringify({ text: 'ok', model: 'openai/gpt-4o-mini', usage: { promptTokenCount: 2, candidatesTokenCount: 1 } }));
  });
  await callAiModel('hello', { credentials: { provider: 'openrouter', apiKey: 'fake-or-key', model: 'openai/gpt-4o-mini', proxyUrl: 'https://proxy.example/api/ai/' }, maxTokens: 99_999, ledger: makeLedger() });
  const body = JSON.parse(request!.body as string);
  assert.equal(body.provider, 'openrouter');
  assert.equal(body.maxTokens, 4096);
  assert.equal(new Headers(request!.headers).get('x-provider-api-key'), 'fake-or-key');
  assert.equal(new Headers(request!.headers).get('x-gemini-key'), null);
  assert.ok(request!.signal);
});

test('direct Gemini output is capped and its key travels in a header rather than the URL', async () => {
  let request: RequestInit | undefined;
  let endpoint = '';
  mock.method(globalThis, 'fetch', async (url: string | URL | Request, init?: RequestInit) => { endpoint = String(url); request = init; return geminiResult(); });
  await callAiModel('hello', { credentials: { provider: 'gemini', apiKey: 'fake-direct-key', model: 'gemini-2.5-flash' }, maxTokens: 37, ledger: makeLedger() });
  assert.equal(JSON.parse(request!.body as string).generationConfig.maxOutputTokens, 37);
  assert.equal(new Headers(request!.headers).get('x-goog-api-key'), 'fake-direct-key');
  assert.ok(!endpoint.includes('fake-direct-key'));
});

test('direct OpenRouter requests cap max_tokens and cannot send an undefined bearer key', async () => {
  let request: RequestInit | undefined;
  const fetchMock = mock.method(globalThis, 'fetch', async (_url: string | URL | Request, init?: RequestInit) => {
    request = init;
    return new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }));
  });
  await callAiModel('hello', { credentials: { provider: 'openrouter', apiKey: 'fake-or-key', model: 'openai/gpt-4o-mini' }, maxTokens: 73, ledger: makeLedger() });
  assert.equal(JSON.parse(request!.body as string).max_tokens, 73);
  await assert.rejects(callAiModel('hello', { credentials: { provider: 'openrouter', apiKey: '' }, ledger: makeLedger() }));
  assert.equal(fetchMock.mock.calls.length, 1);
});

test('timeout covers response body consumption and aborts the request', async () => {
  let signal: AbortSignal | null | undefined;
  mock.method(globalThis, 'fetch', async (_url: string | URL | Request, init?: RequestInit) => {
    signal = init?.signal;
    return { ok: true, status: 200, json: () => new Promise(() => {}) } as Response;
  });
  await assert.rejects(callAiModel('hello', { credentials: { provider: 'gemini', apiKey: 'fake-key' }, ledger: makeLedger(), timeoutMs: 15 }), /Zeitüberschreitung/);
  assert.equal(signal?.aborted, true);
});

test('provider errors never echo upstream text containing credentials', async () => {
  mock.method(globalThis, 'fetch', async () => new Response('fake-private-key accidentally echoed', { status: 401 }));
  await assert.rejects(callAiModel('hello', { credentials: { provider: 'gemini', apiKey: 'fake-private-key' }, ledger: makeLedger() }), error => error instanceof Error && !error.message.includes('fake-private-key') && error.message.includes('401'));
});

test('empty provider text is a failed call, and proxy-only connection tests are usable', async () => {
  mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ text: '' })));
  await assert.rejects(callAiModel('hello', { credentials: { provider: 'gemini', proxyUrl: 'https://proxy.example/api/ai' }, ledger: makeLedger() }), /leer|Antwort/);
  mock.restoreAll();
  mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ text: 'ok' })));
  assert.equal((await testAiConnection({ provider: 'gemini', proxyUrl: 'https://proxy.example/api/ai' })).ok, true);
});
