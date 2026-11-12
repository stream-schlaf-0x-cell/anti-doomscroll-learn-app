import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';
import {
  clearResolvedGeminiModelCache,
  isProOrReasoningModelId,
  mapGeminiModelIdToAvailable,
  resolveEffectiveGoogleApiModelId
} from '../src/core/ai/geminiModelRegistry';
import {
  AI_CONNECTION_TEST_TIMEOUT_MS,
  AI_MAX_REQUEST_TIMEOUT_MS
} from '../src/core/ai/aiTransport';
import {
  callAiModel,
  resetSessionEffectiveModels,
  testAiConnection
} from '../src/core/ai/atmenAiClient';
import { EnrichmentUsageLedger, getEffectiveBudgetCeilingEur, ACTIVE_KEY_MONTHLY_BUDGET_CEILING_EUR } from '../src/core/enrichment/ledger';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('Gemini Model Resolution & Pro/Argon/Carbon Timeout Hotfix', () => {
  afterEach(() => {
    mock.restoreAll();
    resetSessionEffectiveModels();
    clearResolvedGeminiModelCache();
  });

  it('1. resolves gemini-4-argon, gemini-4-carbon, and gemini-3.8-pro to the highest available -pro model on the key', async () => {
    const fetchMock = mock.method(globalThis, 'fetch', async () => {
      return new Response(
        JSON.stringify({
          models: [
            { name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] },
            { name: 'models/gemini-2.5-pro', supportedGenerationMethods: ['generateContent'] },
            { name: 'models/gemini-1.5-pro', supportedGenerationMethods: ['generateContent'] }
          ]
        }),
        { status: 200 }
      );
    });

    const resolvedArgon = await resolveEffectiveGoogleApiModelId('gemini-4-argon', 'test-pro-key-1');
    const resolvedCarbon = await resolveEffectiveGoogleApiModelId('gemini-4-carbon', 'test-pro-key-1');
    const resolved38Pro = await resolveEffectiveGoogleApiModelId('gemini-3.8-pro', 'test-pro-key-1');
    const resolved38Flash = await resolveEffectiveGoogleApiModelId('gemini-3.8-flash', 'test-pro-key-1');

    assert.equal(resolvedArgon, 'gemini-2.5-pro');
    assert.equal(resolvedCarbon, 'gemini-2.5-pro');
    assert.equal(resolved38Pro, 'gemini-2.5-pro');
    assert.equal(resolved38Flash, 'gemini-2.5-flash');

    // In-memory cache per API key ensures /v1beta/models was only queried once for all 4 resolutions!
    assert.equal(fetchMock.mock.calls.length, 1);
  });

  it('2. returns selectedModelId directly when the user account explicitly exposes that exact model', async () => {
    mock.method(globalThis, 'fetch', async () => {
      return new Response(
        JSON.stringify({
          models: [
            { name: 'models/gemini-4-argon', supportedGenerationMethods: ['generateContent'] },
            { name: 'models/gemini-2.5-pro', supportedGenerationMethods: ['generateContent'] }
          ]
        }),
        { status: 200 }
      );
    });

    const resolved = await resolveEffectiveGoogleApiModelId('gemini-4-argon', 'early-access-key');
    assert.equal(resolved, 'gemini-4-argon');
    assert.equal(isProOrReasoningModelId('gemini-4-argon'), true);
    assert.equal(mapGeminiModelIdToAvailable('gemini-4-carbon', ['gemini-1.5-pro', 'gemini-2.5-flash']), 'gemini-1.5-pro');
  });

  it('3. testAiConnection uses 25s timeout, maxOutputTokens >= 256, and reports resolved model endpoint for Gemini 4 Argon', async () => {
    assert.equal(AI_CONNECTION_TEST_TIMEOUT_MS, 25_000);
    assert.equal(AI_MAX_REQUEST_TIMEOUT_MS, 60_000);

    let capturedGenerateUrl = '';
    let capturedBody: any = null;

    mock.method(globalThis, 'fetch', async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = String(url);
      if (urlStr.includes('/v1beta/models?')) {
        return new Response(
          JSON.stringify({
            models: [
              { name: 'models/gemini-2.5-pro', supportedGenerationMethods: ['generateContent'] },
              { name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] }
            ]
          }),
          { status: 200 }
        );
      }
      capturedGenerateUrl = urlStr;
      capturedBody = JSON.parse(String(init?.body || '{}'));
      // Simulate a Gemini 2.5 Pro Thinking response that consumes 90 thinking tokens before emitting text
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: { parts: [{ text: '{"status": "ok"}' }] },
              finishReason: 'STOP'
            }
          ],
          usageMetadata: {
            promptTokenCount: 12,
            thoughtsTokenCount: 90,
            candidatesTokenCount: 8,
            totalTokenCount: 110
          }
        }),
        { status: 200 }
      );
    });

    const res = await testAiConnection({
      provider: 'gemini',
      apiKey: 'valid-argon-key',
      model: 'gemini-4-argon'
    });

    assert.equal(res.ok, true);
    assert.equal(res.selectedModel, 'gemini-4-argon');
    assert.equal(res.resolvedModel, 'gemini-2.5-pro');
    assert.ok(capturedGenerateUrl.includes('models/gemini-2.5-pro:generateContent'));
    assert.ok(capturedBody.generationConfig.maxOutputTokens >= 256);
    assert.equal(capturedBody.generationConfig.temperature, 0.2);
    assert.ok(res.message.includes('Gemini 4 Argon'));
    assert.ok(res.message.includes('via gemini-2.5-pro'));
  });

  it('4. fast-fails on HTTP 404/400 and retries on resolved -pro model without cascading timeouts', async () => {
    const calledUrls: string[] = [];

    mock.method(globalThis, 'fetch', async (url: string | URL | Request) => {
      const urlStr = String(url);
      calledUrls.push(urlStr);
      if (urlStr.includes('/v1beta/models?')) {
        return new Response(
          JSON.stringify({
            models: [{ name: 'models/gemini-2.5-pro', supportedGenerationMethods: ['generateContent'] }]
          }),
          { status: 200 }
        );
      }
      if (urlStr.includes('custom-unrecognized-pro:generateContent')) {
        return new Response('Not Found', { status: 404 });
      }
      return new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: 'Deep pro synthesis' }] } }],
          usageMetadata: { promptTokenCount: 20, candidatesTokenCount: 15 }
        }),
        { status: 200 }
      );
    });

    const response = await callAiModel('Analysiere Kants Erkenntnistheorie.', {
      credentials: {
        provider: 'gemini',
        apiKey: 'fast-fail-key',
        model: 'custom-unrecognized-pro'
      },
      ledger: new EnrichmentUsageLedger('', false)
    });

    assert.equal(response.text, 'Deep pro synthesis');
    assert.equal(response.modelUsed, 'gemini-2.5-pro');
    assert.ok(calledUrls.some(u => u.includes('gemini-2.5-pro:generateContent')));
  });

  it('5. honors 20 EUR personal-key ceiling, removes 18s client cap, and persists enrichmentTier=ai for Reader cache', async () => {
    assert.equal(getEffectiveBudgetCeilingEur(false), 5.0);
    assert.equal(getEffectiveBudgetCeilingEur(true), ACTIVE_KEY_MONTHLY_BUDGET_CEILING_EUR);
    assert.equal(ACTIVE_KEY_MONTHLY_BUDGET_CEILING_EUR, 20.0);

    const ledger = new EnrichmentUsageLedger('', false);
    await ledger.recordUsage({
      itemId: 'test-personal-budget-item',
      model: 'gemini-2.5-flash',
      inputTokens: 1000,
      outputTokens: 500,
      costEur: 8.5
    });
    assert.equal(
      await ledger.canSpend(0.5, undefined, getEffectiveBudgetCeilingEur(false)),
      false,
      'Default shared ceiling (5 EUR) must block further spend above 8.5 EUR'
    );
    assert.equal(
      await ledger.canSpend(0.5, undefined, getEffectiveBudgetCeilingEur(true)),
      true,
      'Personal key ceiling (20 EUR) must allow spend above 5 EUR up to 20 EUR'
    );

    const aiClientSrc = fs.readFileSync(
      path.resolve(__dirname, '../src/core/ai/atmenAiClient.ts'),
      'utf-8'
    );
    const batchEnricherSrc = fs.readFileSync(
      path.resolve(__dirname, '../src/core/enrichment/batchEnricher.ts'),
      'utf-8'
    );
    const readerSrc = fs.readFileSync(
      path.resolve(__dirname, '../src/features/reader/ReaderScreen.tsx'),
      'utf-8'
    );

    assert.equal(aiClientSrc.includes('Math.min(requestedTimeout, 18_000)'), false);
    assert.equal(batchEnricherSrc.includes("enrichmentTier: 'ai'"), true);
    assert.equal(batchEnricherSrc.includes('bypassBudgetCeiling: true'), false);
    assert.equal(readerSrc.includes("selectedArticle.enrichmentTier === 'ai'"), true);
  });
});
