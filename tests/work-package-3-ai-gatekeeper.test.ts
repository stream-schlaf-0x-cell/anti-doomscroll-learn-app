import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  BatchEditionEnricher,
  evaluateSignalVsNoiseDeterministically,
  detectLanguage,
  defaultBatchEditionEnricher
} from '../src/core/enrichment/batchEnricher';
import {
  DEFAULT_AI_CREDENTIALS,
  DEFAULT_GEMINI_MODEL,
  DEFAULT_OPENROUTER_MODEL,
  GEMINI_MODEL_PRESETS,
  OPENROUTER_MODEL_PRESETS,
  loadAiCredentials,
  saveAiCredentials,
  clearAiCredentials
} from '../src/core/ai/atmenAiClient';
import {
  OFFICIAL_GEMINI_MODELS,
  DEFAULT_GEMINI_TEXT_MODEL,
  DISCONTINUED_GEMINI_MODEL_IDS,
  validateModelChoice,
  filterModelsForWorkflow,
  discoverLiveGeminiModels,
  findGeminiModel
} from '../src/core/ai/geminiModelRegistry';
import { FeedItem } from '../src/core/domain/types';
import { INITIAL_FIXTURES } from '../src/core/data/fixtures';
import { LocalFeedRepository } from '../src/core/data/feedRepository';
import { AtemStorage, MemoryStorageDriver } from '../src/core/data/storage';

describe('Work Package 3: AI Gatekeeper, Batch Intelligence & Model Selection', () => {
  describe('1. Deterministic Signal-vs-Noise Gatekeeper Heuristics', () => {
    it('approves substantive scientific or philosophical articles with score >= 7', () => {
      const goodArticle = {
        title: 'Epistemologische Grundlagen kognitiver Modelle',
        subtitle: 'Wie unser Gehirn sensorische Daten in kohärente Weltmodelle übersetzt',
        feedText: 'Eine tiefgehende philosophische und neurowissenschaftliche Abhandlung über Wahrnehmung, Bayessche Inferenz und die Grenzen menschlicher Erkenntnis.',
        publisher: 'Stanford Encyclopedia of Philosophy'
      };

      const evaluation = evaluateSignalVsNoiseDeterministically(goodArticle);
      assert.strictEqual(evaluation.passed, true);
      assert.ok(evaluation.score >= 7, `Expected score >= 7, got ${evaluation.score}`);
      assert.ok(evaluation.reason.length > 0);
    });

    it('rejects pure affiliate deals, shopping vouchers and commercial promo (score < 7)', () => {
      const affiliateDeal = {
        title: 'Mega Deal: Die besten Schnäppchen und Rabattcodes am Black Friday sichern',
        subtitle: 'Jetzt sparen beim Kauf der neuen Smartwatches und Gadgets',
        feedText: 'Hier sind alle Deals, Rabatt-Aktionen und Gutscheine im großen Preisvergleich zum Bestellen.',
        publisher: 'Schnäppchen-Blog'
      };

      const evaluation = evaluateSignalVsNoiseDeterministically(affiliateDeal);
      assert.strictEqual(evaluation.passed, false);
      assert.ok(evaluation.score < 7, `Expected score < 7, got ${evaluation.score}`);
      assert.strictEqual(evaluation.reason, 'Kommerzielles Angebot / Affiliate-Deal');
    });

    it('rejects one-line stubs and minimal text (< 40 chars) without context', () => {
      const stub = {
        title: 'Kurzmeldung zum Tag',
        feedText: 'Mehr dazu später im Ticker.',
        publisher: 'News Blog'
      };

      const evaluation = evaluateSignalVsNoiseDeterministically(stub);
      assert.strictEqual(evaluation.passed, false);
      assert.ok(evaluation.score < 7);
      assert.strictEqual(evaluation.reason, 'Einzeiliger Stub / Unzureichender Kontext');
    });

    it('rejects sensationalist clickbait and outrage headlines', () => {
      const clickbait = {
        title: 'Unglaublich: Promi rastet völlig aus und dieser Skandal schockt das Netz',
        subtitle: 'Niemand hat damit gerechnet was jetzt enthüllt wurde',
        feedText: 'Ein peinlicher Vorfall sorgt für helle Aufregung in den sozialen Medien und alle reden darüber.',
        publisher: 'Boulevard Aktuell'
      };

      const evaluation = evaluateSignalVsNoiseDeterministically(clickbait);
      assert.strictEqual(evaluation.passed, false);
      assert.ok(evaluation.score < 7);
      assert.strictEqual(evaluation.reason, 'Clickbait / Trivialer Boulevard');
    });
  });

  describe('2. Source Language Preservation', () => {
    it('accurately identifies English vs German articles', () => {
      const englishText = 'The quick brown fox jumps over the lazy dog and explains quantum mechanics in depth.';
      const germanText = 'Die sokratische Methode ist eine didaktische Kunst des gemeinsamen Fragens und Denkens.';

      assert.strictEqual(detectLanguage(englishText), 'en');
      assert.strictEqual(detectLanguage(germanText), 'de');
    });

    it('preserves English language without injecting German didactic boilerplate', () => {
      const englishItem: FeedItem = {
        ...INITIAL_FIXTURES[0],
        id: 'test-english-item-1',
        title: 'Attention Mechanisms in Transformer Networks',
        subtitle: 'A foundational look at self-attention architectures',
        feedText: 'Transformers rely on scaled dot-product attention to dynamically weigh token representations without recurrent inductive bias.',
        body: 'Transformers rely on scaled dot-product attention to dynamically weigh token representations without recurrent inductive bias.',
        topics: ['ai_apple']
      };

      const enriched = defaultBatchEditionEnricher.enrichDeterministically(englishItem);

      // Must preserve English feedText
      assert.ok(enriched.feedText.includes('Transformers rely on'));
      // Must synthesize English didactic prompt
      assert.ok(
        enriched.didacticTransfer?.startsWith('Reflective inquiry:'),
        `Expected English reflective prompt, got: "${enriched.didacticTransfer}"`
      );
      assert.ok(!enriched.didacticTransfer?.includes('Didaktischer Transfer:'));
    });
  });

  describe('3. BatchEditionEnricher Gatekeeping Pipeline', () => {
    it('filters out low-score items and keeps high-score items during gatekeepAndEnrichBatch', async () => {
      const goodItem: FeedItem = {
        ...INITIAL_FIXTURES[0],
        id: 'gatekeeper-good-1',
        title: 'Neurowissenschaften des Tiefschlafs',
        subtitle: 'Warum REM-Phasen und Deltawellen für neuronale Konsolidierung unerlässlich sind',
        feedText: 'Schlafforscher zeigen, wie während des slow-wave sleep synaptische Plastizität reguliert und metabolische Stoffwechselprodukte aus dem Gehirn gespült werden.',
        body: 'Schlafforscher zeigen, wie während des slow-wave sleep synaptische Plastizität reguliert und metabolische Stoffwechselprodukte aus dem Gehirn gespült werden.',
        topics: ['health_biohacking']
      };

      const badDealItem: FeedItem = {
        ...INITIAL_FIXTURES[1],
        id: 'gatekeeper-deal-1',
        title: 'Mega Deal: Rabattcode für Kaffeemaschinen sichern',
        subtitle: 'Jetzt günstig online kaufen mit unserem exklusiven Gutschein',
        feedText: 'Hier gibt es alle Deals und Rabatte zum Black Friday im Preisvergleich zum Bestellen.',
        body: 'Hier gibt es alle Deals und Rabatte zum Black Friday im Preisvergleich zum Bestellen.',
        topics: ['opportunities_growth']
      };

      const stubItem: FeedItem = {
        ...INITIAL_FIXTURES[2],
        id: 'gatekeeper-stub-1',
        title: 'Update',
        subtitle: 'Kurzinfo',
        feedText: 'Zu kurz.',
        body: 'Zu kurz.',
        topics: ['science_society']
      };

      const enricher = new BatchEditionEnricher();
      const results = await enricher.gatekeepAndEnrichBatch([goodItem, badDealItem, stubItem]);

      // Only the good item should pass the gatekeeper!
      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].id, goodItem.id);
      assert.ok((results[0].curationScore ?? 0) >= 7);
    });

    it('LocalFeedRepository.curateAndAddItems passes candidates through gatekeeper before storing', async () => {
      const memoryStorage = new AtemStorage(new MemoryStorageDriver());
      const repo = new LocalFeedRepository([], memoryStorage);

      const goodItem: FeedItem = {
        ...INITIAL_FIXTURES[0],
        id: 'repo-curated-1',
        title: 'Kants Kritik der reinen Vernunft im 21. Jahrhundert',
        subtitle: 'Synthetische Urteile a priori und die Struktur menschlicher Kognition',
        feedText: 'Die transzendentale Deduktion liefert auch in Zeiten algorithmischer Systeme tiefe Einsichten in die Bedingungen möglicher Erfahrung.',
        body: 'Die transzendentale Deduktion liefert auch in Zeiten algorithmischer Systeme tiefe Einsichten in die Bedingungen möglicher Erfahrung.',
        topics: ['philosophy_ethics']
      };

      const dealItem: FeedItem = {
        ...INITIAL_FIXTURES[1],
        id: 'repo-deal-1',
        title: 'Black Friday Deals: Die besten Gutscheine und Rabattcodes',
        subtitle: 'Sparen beim Onlinekauf',
        feedText: 'Hier sind alle Schnäppchen und Gutscheine zum Kaufen.',
        body: 'Hier sind alle Schnäppchen und Gutscheine zum Kaufen.',
        topics: ['opportunities_growth']
      };

      const curated = await repo.curateAndAddItems([goodItem, dealItem]);

      assert.strictEqual(curated.length, 1);
      assert.strictEqual(curated[0].id, goodItem.id);

      const foundGood = await repo.getItemById(goodItem.id);
      const foundDeal = await repo.getItemById(dealItem.id);

      assert.ok(foundGood !== null, 'Good item must be in repository');
      assert.strictEqual(foundDeal, null, 'Deal item must NOT be stored in repository');
    });
  });

  describe('4. Model Selector & BYOK AI Settings Configuration', () => {
    it('defines standard recommended models for Gemini and OpenRouter', () => {
      assert.strictEqual(DEFAULT_GEMINI_MODEL, 'gemini-3.8-flash');
      assert.strictEqual(DEFAULT_OPENROUTER_MODEL, 'google/gemini-3.8-flash');

      assert.ok(GEMINI_MODEL_PRESETS.some(m => m.id === 'gemini-3.8-flash'));
      assert.ok(OPENROUTER_MODEL_PRESETS.some(m => m.id === 'anthropic/claude-3.5-sonnet'));
      assert.ok(OPENROUTER_MODEL_PRESETS.some(m => m.id === 'google/gemini-3.8-flash'));
    });

    it('persists and loads chosen models and providers cleanly', async () => {
      const memoryStorage = new AtemStorage(new MemoryStorageDriver());

      // Default
      const initial = await loadAiCredentials(memoryStorage);
      assert.strictEqual(initial.provider, 'gemini');
      assert.strictEqual(initial.model, 'gemini-3.8-flash');

      // Update to OpenRouter with Claude 3.5 Sonnet
      await saveAiCredentials(
        {
          provider: 'openrouter',
          apiKey: 'sk-or-v1-test-key',
          model: 'anthropic/claude-3.5-sonnet'
        },
        memoryStorage
      );

      const loaded = await loadAiCredentials(memoryStorage);
      assert.strictEqual(loaded.provider, 'openrouter');
      assert.strictEqual(loaded.apiKey, 'sk-or-v1-test-key');
      assert.strictEqual(loaded.model, 'anthropic/claude-3.5-sonnet');

      // Clear
      await clearAiCredentials(memoryStorage);
      const afterClear = await loadAiCredentials(memoryStorage);
      assert.strictEqual(afterClear.apiKey, '');
    });
  });

  describe('5. Google Gemini Model Registry & Live Discovery (October 2026 Source of Truth)', () => {
    it('contains all official verified models across all 8 functional categories', () => {
      assert.strictEqual(DEFAULT_GEMINI_TEXT_MODEL, 'gemini-3.8-flash');

      // Text / Reasoning
      assert.ok(findGeminiModel('gemini-4-argon'), 'Gemini 4 Argon must exist');
      assert.ok(findGeminiModel('gemini-3.8-flash'), 'Gemini 3.8 Flash must exist');
      assert.ok(findGeminiModel('gemini-3.6-flash'), 'Gemini 3.6 Flash must exist');
      assert.ok(findGeminiModel('gemini-3.5-flash-lite'), 'Gemini 3.5 Flash-Lite must exist');
      assert.ok(findGeminiModel('gemini-3.1-flash-lite'), 'Gemini 3.1 Flash-Lite must exist');
      assert.ok(findGeminiModel('gemini-3.1-pro-preview'), 'Gemini 3.1 Pro Preview must exist');
      assert.ok(findGeminiModel('gemini-3-flash-preview'), 'Gemini 3 Flash Preview must exist');

      // Image generation
      assert.ok(findGeminiModel('gemini-nano-banana-2.1'), 'Nano Banana 2.1 must exist');
      assert.ok(findGeminiModel('gemini-3.1-flash-image'), 'Nano Banana 2 must exist');
      assert.ok(findGeminiModel('gemini-3.1-flash-lite-image'), 'Nano Banana 2 Lite must exist');
      assert.ok(findGeminiModel('gemini-3-pro-image'), 'Nano Banana Pro must exist');

      // Video generation
      assert.ok(findGeminiModel('veo-3.1-generate-preview'), 'Veo 3.1 must exist');
      assert.ok(findGeminiModel('veo-3.1-lite-generate-preview'), 'Veo 3.1 Lite must exist');
      assert.ok(findGeminiModel('gemini-omni-1.1-flash'), 'Gemini Omni Flash must exist');

      // Audio / Speech
      assert.ok(findGeminiModel('gemini-3.8-live'), 'Gemini 3.8 Live must exist');
      assert.ok(findGeminiModel('gemini-3.8-live-extended-thinking'), 'Gemini 3.8 Live Extended Thinking must exist');
      assert.ok(findGeminiModel('gemini-3.8-flash-tts'), 'Gemini 3.8 Flash TTS must exist');
      assert.ok(findGeminiModel('gemini-3.8-flash-lite-tts'), 'Gemini 3.8 Flash-Lite TTS must exist');
      assert.ok(findGeminiModel('gemini-3.5-transcribe'), 'Gemini 3.5 Transcribe must exist');
      assert.ok(findGeminiModel('gemini-3.5-transcribe-live'), 'Gemini 3.5 Transcribe Live must exist');
      assert.ok(findGeminiModel('gemini-3.5-live-translate-preview'), 'Gemini 3.5 Live Translate Preview must exist');

      // Music generation
      assert.ok(findGeminiModel('lyria-3.5'), 'Lyria 3.5 must exist');
      assert.ok(findGeminiModel('lyria-3-clip-preview'), 'Lyria 3 Clip Preview must exist');
      assert.ok(findGeminiModel('lyria-3-pro-preview'), 'Lyria 3 Pro Preview must exist');
      assert.ok(findGeminiModel('lyria-realtime-exp'), 'Lyria RealTime Exp must exist');

      // Agents / Research
      assert.ok(findGeminiModel('deep-research-preview-04-2026'), 'Deep Research must exist');
      assert.ok(findGeminiModel('deep-research-max-preview-04-2026'), 'Deep Research Max must exist');
      assert.ok(findGeminiModel('antigravity-preview-09-2026'), 'Antigravity Agent must exist');

      // Embeddings
      assert.ok(findGeminiModel('gemini-embedding-2-preview'), 'Embedding 2 must exist');
      assert.ok(findGeminiModel('gemini-embedding-001'), 'Embedding 001 must exist');

      // Robotics
      assert.ok(findGeminiModel('gemini-robotics-er-2-preview'), 'Robotics ER 2 must exist');
      assert.ok(findGeminiModel('gemini-robotics-er-1.6-preview'), 'Robotics ER 1.6 must exist');
    });

    it('rejects discontinued models with informative error', () => {
      for (const discontinued of DISCONTINUED_GEMINI_MODEL_IDS) {
        const validation = validateModelChoice(discontinued, 'text');
        assert.strictEqual(validation.valid, false);
        assert.ok(validation.reason?.includes('eingestellt') || validation.reason?.includes('discontinued'));
      }
    });

    it('filters models strictly by current workflow and isolates legacy models', () => {
      const textModels = filterModelsForWorkflow('text', false);
      assert.ok(textModels.length > 0);
      assert.ok(textModels.every(m => m.category === 'text' && !m.legacy));

      // With legacy enabled
      const textModelsWithLegacy = filterModelsForWorkflow('text', true);
      assert.ok(textModelsWithLegacy.length > textModels.length);
      assert.ok(textModelsWithLegacy.some(m => m.id === 'gemini-2.5-flash'));

      // Image models workflow isolation
      const imageModels = filterModelsForWorkflow('image', false);
      assert.ok(imageModels.every(m => m.category === 'image'));
      assert.ok(!imageModels.some(m => m.id === 'gemini-3.8-flash'));

      // Video models workflow isolation
      const videoModels = filterModelsForWorkflow('video', false);
      assert.ok(videoModels.every(m => m.category === 'video'));

      // Audio models workflow isolation
      const audioModels = filterModelsForWorkflow('audio', false);
      assert.ok(audioModels.every(m => m.category === 'audio'));
    });

    it('validates workflow compatibility and rejects incompatible cross-workflow models', () => {
      // Veo 3.1 is video, not text
      const videoForText = validateModelChoice('veo-3.1-generate-preview', 'text');
      assert.strictEqual(videoForText.valid, false);
      assert.ok(videoForText.reason?.includes('nicht mit dem Workflow'));

      // Gemini 3.8 Flash is text, valid for text workflow
      const flashForText = validateModelChoice('gemini-3.8-flash', 'text');
      assert.strictEqual(flashForText.valid, true);
    });

    it('discovers live models and caches them in storage safely without throwing on empty credentials', async () => {
      const memoryStorage = new AtemStorage(new MemoryStorageDriver());

      const res = await discoverLiveGeminiModels('', {
        storage: memoryStorage
      });

      assert.strictEqual(res.accountVerified, false);
      assert.strictEqual(res.fromCache, false);
      assert.ok(res.models.length >= OFFICIAL_GEMINI_MODELS.length);
    });

    it('gatekeepAndEnrichBatch supports overrideCredentials parameter', async () => {
      const enricher = defaultBatchEditionEnricher;
      const rawCandidates: FeedItem[] = [INITIAL_FIXTURES[0] as FeedItem];

      const result = await enricher.gatekeepAndEnrichBatch(rawCandidates, {
        provider: 'gemini',
        apiKey: '',
        model: 'gemini-3.8-flash'
      });

      assert.ok(Array.isArray(result));
      assert.ok(result.length <= 1);
    });
  });
});
