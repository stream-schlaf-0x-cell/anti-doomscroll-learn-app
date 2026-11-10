import { describe, it } from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import {
  isGeminiCodenameAlias,
  mapGeminiModelIdToAvailable
} from '../src/core/ai/geminiModelRegistry';
import { testAiConnection, callAiModel } from '../src/core/ai/atmenAiClient';
import { stripSyntheticFillerSentences, satisfiesDefaultCuratedStandard } from '../src/core/enrichment/batchEnricher';
import { FeedItem } from '../src/core/domain/types';

describe('Gordian Knot Master Architectural Fix v6.3', () => {
  it('1. Model resolution and fallback succeeds for Argon, Carbon, Pro, and Flash codenames', async () => {
    // Assert codename alias identification
    assert.strictEqual(isGeminiCodenameAlias('gemini-4-argon'), true);
    assert.strictEqual(isGeminiCodenameAlias('gemini-4-carbon'), true);
    assert.strictEqual(isGeminiCodenameAlias('gemini-3.8-pro'), true);
    assert.strictEqual(isGeminiCodenameAlias('gemini-3.6-flash'), true);
    assert.strictEqual(isGeminiCodenameAlias('gemini-2.5-pro'), false);
    assert.strictEqual(isGeminiCodenameAlias('gemini-2.5-flash'), false);

    // Mock global.fetch to simulate candidate 1 timing out / 404ing, candidate 2 succeeding with gemini-2.5-pro / flash
    const originalFetch = global.fetch;
    try {
      global.fetch = async (url: any, init: any) => {
        const urlStr = String(url);
        if (urlStr.includes('/v1beta/models?')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              models: [
                { name: 'models/gemini-2.5-pro', supportedGenerationMethods: ['generateContent'] },
                { name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] }
              ]
            })
          } as any;
        }

        // If trying an unavailable candidate, simulate timeout/404
        if (urlStr.includes('gemini-4-argon') || urlStr.includes('gemini-3.1-pro-preview')) {
          return {
            ok: false,
            status: 404,
            json: async () => ({ error: { message: 'models/gemini-4-argon not found' } })
          } as any;
        }

        // Fallback target succeeds immediately
        return {
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [
              {
                content: {
                  parts: [{ text: '{"status": "ok"}' }]
                },
                finishReason: 'STOP'
              }
            ],
            usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 }
          })
        } as any;
      };

      const resArgon = await testAiConnection({
        provider: 'gemini',
        apiKey: 'test-fake-key-12345',
        model: 'gemini-4-argon',
        persistApiKey: true
      });

      assert.strictEqual(resArgon.ok, true, `Expected Argon test to succeed via fallback: ${resArgon.message}`);
      assert.ok(resArgon.resolvedModel?.includes('pro') || resArgon.resolvedModel?.includes('flash'));

      const resProPreview = await testAiConnection({
        provider: 'gemini',
        apiKey: 'test-fake-key-12345',
        model: 'gemini-3.1-pro-preview',
        persistApiKey: true
      });
      assert.strictEqual(resProPreview.ok, true, `Expected Pro-Preview test to succeed: ${resProPreview.message}`);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('2. scheduleFeedRecompute in AppContext does not trigger OpenWebHarvester', () => {
    const appContextSrc = fs.readFileSync(path.resolve(__dirname, '../src/core/context/AppContext.tsx'), 'utf8');
    const scheduleRecomputeMatch = appContextSrc.match(/const scheduleFeedRecompute = useCallback\(async \([\s\S]*?\}, \[\]\);/);
    assert.ok(scheduleRecomputeMatch, 'scheduleFeedRecompute must exist in AppContext.tsx');
    const body = scheduleRecomputeMatch[0];
    assert.strictEqual(body.includes('OpenWebHarvester.harvestAllOpenWeb'), false, 'scheduleFeedRecompute must NOT call OpenWebHarvester');
  });

  it('3. All modals in FeedScreen.tsx and App.tsx are lazily mounted with conditional checks', () => {
    const feedScreenSrc = fs.readFileSync(path.resolve(__dirname, '../src/features/feed/FeedScreen.tsx'), 'utf8');
    const appSrc = fs.readFileSync(path.resolve(__dirname, '../App.tsx'), 'utf8');

    // FeedScreen modals
    assert.ok(feedScreenSrc.includes('{showMasterModal && ('), 'UltraMasterModal must be lazily mounted');
    assert.ok(feedScreenSrc.includes('{showProgressModal && ('), 'StreamGenerationProgressModal must be lazily mounted');
    assert.ok(feedScreenSrc.includes('{showBreathingModal && ('), 'AtmenBreathingPortal must be lazily mounted');
    assert.ok(feedScreenSrc.includes('{showHivemindModal && ('), 'HivemindStreamModal must be lazily mounted');
    assert.ok(feedScreenSrc.includes('{showNewsHubSettingsModal && ('), 'NewsHubModal must be lazily mounted');
    assert.ok(feedScreenSrc.includes('{showEvolutionModal && ('), 'NewsEvolutionModal must be lazily mounted');
    assert.ok(feedScreenSrc.includes('{showReportModal && ('), 'FeedOperationReportModal must be lazily mounted');
    assert.ok(feedScreenSrc.includes('{showPipelineModal && ('), 'NewsroomPipelineModal must be lazily mounted');
    assert.strictEqual(feedScreenSrc.includes('<LinkPreviewModal'), false, 'LinkPreviewModal must NOT be mounted in FeedScreen');

    // App modals
    assert.ok(appSrc.includes('{whyModalItem && <WhyThisModal />}'), 'WhyThisModal must be lazily mounted in App.tsx');
    assert.ok(appSrc.includes('{isInvestigationOpen && ('), 'InvestigationModal must be lazily mounted in App.tsx');
  });

  it('4. public/feed-snapshot.json and pipeline-output.json are trimmed to <= 160 clean items with zero synthetic filler', () => {
    const snapRaw = fs.readFileSync(path.resolve(__dirname, '../public/feed-snapshot.json'), 'utf8');
    const snap = JSON.parse(snapRaw);
    const pipeRaw = fs.readFileSync(path.resolve(__dirname, '../src/core/data/pipeline-output.json'), 'utf8');
    const pipe = JSON.parse(pipeRaw);

    const snapItems: FeedItem[] = snap.items;
    const pipeItems: FeedItem[] = pipe;

    assert.ok(snapItems.length <= 160, `public/feed-snapshot.json must have <= 160 items, got ${snapItems.length}`);
    assert.ok(pipeItems.length <= 160, `pipeline-output.json must have <= 160 items, got ${pipeItems.length}`);
    assert.ok(snapItems.length >= 100, `public/feed-snapshot.json should have >= 100 items, got ${snapItems.length}`);

    // Verify zero synthetic filler sentences remain in snapshot items
    for (const item of snapItems) {
      const feedText = item.feedText || '';
      assert.strictEqual(feedText.includes('In diesem Beitrag zu'), false, `Item ${item.id} contains synthetic filler`);
      assert.strictEqual(feedText.includes('werden die zentralen Thesen'), false, `Item ${item.id} contains synthetic filler`);
      assert.strictEqual(feedText.includes('Die Argumentation beleuchtet wesentliche Perspektiven'), false, `Item ${item.id} contains synthetic filler`);
    }
  });

  it('5. satisfiesDefaultCuratedStandard rejects non-meme stubs < 80 characters or title echoes', () => {
    const stubItem: FeedItem = {
      id: 'stub-1',
      title: 'Ein kurzer Titel',
      subtitle: 'Redaktion',
      feedText: 'Ein kurzer Titel',
      body: 'Ein kurzer Titel',
      format: 'concise_insight',
      topics: ['philosophy_ethics'],
      primaryTopic: 'philosophy_ethics',
      sourceReferences: []
    } as any;

    assert.strictEqual(satisfiesDefaultCuratedStandard(stubItem), false, 'Title echo stub must be rejected');

    const shortStub: FeedItem = {
      id: 'stub-2',
      title: 'Valid Long Title for Didactic Purposes',
      subtitle: 'Redaktion',
      feedText: 'Zu kurz fuer Stream',
      body: 'Zu kurz fuer Stream',
      format: 'concise_insight',
      topics: ['philosophy_ethics'],
      primaryTopic: 'philosophy_ethics',
      sourceReferences: []
    } as any;

    assert.strictEqual(satisfiesDefaultCuratedStandard(shortStub), false, 'Sub-80 character stub must be rejected');
  });
});
