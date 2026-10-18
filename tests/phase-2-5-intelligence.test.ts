import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  AtemStorage,
  MemoryStorageDriver
} from '../src/core/data/storage';
import {
  LocalLibraryRepository,
  SAVED_ARTICLES_STORAGE_KEY,
  ARTICLE_BODY_STORAGE_PREFIX
} from '../src/core/data/libraryRepository';
import {
  AI_CREDENTIALS_STORAGE_KEY,
  DEFAULT_GEMINI_MODEL,
  DEFAULT_OPENROUTER_MODEL,
  loadAiCredentials,
  saveAiCredentials,
  clearAiCredentials,
  testAiConnection,
  callAiModel,
  AiCredentialsMissingError,
  AiBudgetExceededError
} from '../src/core/ai/atmenAiClient';
import {
  AtmenStudioService,
  STUDIO_LENSES,
  STUDIO_LENSES_LIST,
  formatStudioOutputMarkdown
} from '../src/core/studio/atmenStudio';
import {
  BatchEditionEnricher,
  classifyTopicDeterministically,
  enrichDeterministically
} from '../src/core/enrichment/batchEnricher';
import { FeedItem } from '../src/core/domain/types';
import { INITIAL_FIXTURES } from '../src/core/data/fixtures';
import { EnrichmentUsageLedger } from '../src/core/enrichment/ledger';

describe('Phase 2.5: Intelligence, Studio & Body Sharding Architecture', () => {
  describe('1. AtmenAiClient & BYOK Credentials', () => {
    it('initializes with default models (Gemini 3.8 & OpenRouter 3.8)', async () => {
      const driver = new MemoryStorageDriver();
      const storage = new AtemStorage(driver);

      const creds = await loadAiCredentials(storage);
      assert.strictEqual(creds.provider, 'gemini');
      assert.strictEqual(creds.apiKey, '');
      assert.strictEqual(creds.model, DEFAULT_GEMINI_MODEL);
      assert.strictEqual(DEFAULT_GEMINI_MODEL, 'gemini-3.8-flash');
      assert.strictEqual(DEFAULT_OPENROUTER_MODEL, 'google/gemini-3.8-flash');
    });

    it('persists and clears credentials under @atem:ai_credentials:v1', async () => {
      const driver = new MemoryStorageDriver();
      const storage = new AtemStorage(driver);

      await saveAiCredentials(
        {
          provider: 'openrouter',
          apiKey: 'sk-or-test-key-12345',
          model: 'google/gemini-3.8-flash',
          persistApiKey: true
        },
        storage
      );

      const raw = await driver.getItem(AI_CREDENTIALS_STORAGE_KEY);
      assert.ok(raw !== null);
      const parsed = JSON.parse(raw!);
      assert.strictEqual(parsed.provider, 'openrouter');
      assert.strictEqual(parsed.apiKey, 'sk-or-test-key-12345');
      assert.strictEqual(parsed.model, 'google/gemini-3.8-flash');

      const loaded = await loadAiCredentials(storage);
      assert.strictEqual(loaded.apiKey, 'sk-or-test-key-12345');

      await clearAiCredentials(storage);
      const cleared = await loadAiCredentials(storage);
      assert.strictEqual(cleared.apiKey, '');
    });

    it('gracefully reports failure on testAiConnection without an API key', async () => {
      const result = await testAiConnection({
        provider: 'gemini',
        apiKey: ''
      });
      assert.strictEqual(result.ok, false);
      assert.ok(result.message.includes('API-Schlüssel'));
    });

    it('callAiModel throws AiCredentialsMissingError when unconfigured', async () => {
      await assert.rejects(
        async () => {
          await callAiModel('Define eudaimonia.', {
            credentials: { provider: 'gemini', apiKey: '' }
          });
        },
        AiCredentialsMissingError
      );
    });

    it('enforces monthly ledger budget ceiling before making AI requests', async () => {
      const ledger = new EnrichmentUsageLedger('', false);

      // Exhaust the budget on the ledger directly (€5.00 limit)
      await ledger.recordUsage({
        itemId: 'exhaust-budget',
        model: 'gemini-3.8-flash',
        inputTokens: 100000,
        outputTokens: 50000,
        costEur: 5.01
      });

      await assert.rejects(
        async () => {
          await callAiModel('Test prompt', {
            credentials: { provider: 'gemini', apiKey: 'AIzaSyFakeKeyForTest' },
            ledger
          });
        },
        AiBudgetExceededError
      );
    });
  });

  describe('2. LocalLibraryRepository Body Sharding', () => {
    it('shards articleBody into @atem:article_body:v1:<id> and keeps index lightweight', async () => {
      const driver = new MemoryStorageDriver();
      const storage = new AtemStorage(driver);
      const repo = new LocalLibraryRepository(storage);

      const longArticle: FeedItem = {
        ...INITIAL_FIXTURES[0],
        id: 'sharding-test-item-001',
        title: 'Sharded Article Test',
        articleBody: 'A'.repeat(8000) // 8KB text body
      };

      await repo.saveArticle(longArticle);

      // Verify the main index does NOT contain the heavy body
      const rawIndex = await driver.getItem(SAVED_ARTICLES_STORAGE_KEY);
      assert.ok(rawIndex !== null);
      const parsedIndex = JSON.parse(rawIndex!) as Record<string, FeedItem>;
      assert.ok(parsedIndex['sharding-test-item-001']);
      assert.strictEqual(parsedIndex['sharding-test-item-001'].articleBody, undefined);

      // Verify the shard key contains the body
      const shardKey = `${ARTICLE_BODY_STORAGE_PREFIX}sharding-test-item-001`;
      const rawShard = await driver.getItem(shardKey);
      assert.ok(rawShard !== null);
      assert.strictEqual(rawShard, 'A'.repeat(8000));

      // Transparent rehydration via getSavedArticleById
      const retrieved = await repo.getSavedArticleById('sharding-test-item-001');
      assert.ok(retrieved !== null);
      assert.strictEqual(retrieved?.articleBody, 'A'.repeat(8000));

      // Transparent rehydration via getSavedArticles
      const allSaved = await repo.getSavedArticles();
      assert.strictEqual(allSaved.length, 1);
      assert.strictEqual(allSaved[0].articleBody, 'A'.repeat(8000));
    });

    it('unsaveArticle removes both the index entry and the sharded body', async () => {
      const driver = new MemoryStorageDriver();
      const storage = new AtemStorage(driver);
      const repo = new LocalLibraryRepository(storage);

      const item: FeedItem = {
        ...INITIAL_FIXTURES[0],
        id: 'to-delete-001',
        articleBody: 'Short body to be deleted'
      };

      await repo.saveArticle(item);
      const shardKey = `${ARTICLE_BODY_STORAGE_PREFIX}to-delete-001`;
      assert.strictEqual(await driver.getItem(shardKey), 'Short body to be deleted');

      const interaction = await repo.unsaveArticle('to-delete-001');
      assert.strictEqual(interaction.saved, false);
      assert.strictEqual(await driver.getItem(shardKey), null);
      assert.strictEqual(await repo.getSavedArticle('to-delete-001'), null);
    });

    it('handles legacy unsharded articles gracefully (backward compatibility)', async () => {
      const driver = new MemoryStorageDriver();
      const storage = new AtemStorage(driver);

      // Directly write legacy format into SAVED_ARTICLES_STORAGE_KEY with embedded articleBody
      const legacyArticles: Record<string, FeedItem> = {
        'legacy-article-001': {
          ...INITIAL_FIXTURES[0],
          id: 'legacy-article-001',
          articleBody: 'Legacy embedded article body'
        }
      };
      await driver.setItem(SAVED_ARTICLES_STORAGE_KEY, JSON.stringify(legacyArticles));

      const repo = new LocalLibraryRepository(storage);
      const loaded = await repo.getSavedArticleById('legacy-article-001');
      assert.ok(loaded !== null);
      assert.strictEqual(loaded?.articleBody, 'Legacy embedded article body');
    });
  });

  describe('3. Atmen Studio: 3 Lenses & Transformation Service', () => {
    it('defines the 3 core contemplative lenses', () => {
      assert.ok(STUDIO_LENSES.didactics);
      assert.ok(STUDIO_LENSES.contemplation);
      assert.ok(STUDIO_LENSES.sound_alchemy);

      assert.strictEqual(STUDIO_LENSES.didactics.id, 'didactics');
      assert.strictEqual(STUDIO_LENSES.contemplation.id, 'contemplation');
      assert.strictEqual(STUDIO_LENSES.sound_alchemy.id, 'sound_alchemy');

      assert.strictEqual(STUDIO_LENSES_LIST.length, 3);
    });

    it('generates high-coherence deterministic output for all 3 lenses', async () => {
      const studio = new AtmenStudioService();

      const input = {
        title: 'Digitale Autonomie & Reizfilterung',
        text: 'Wie wir die Flut an Pings und Algorithmen reduzieren und Raum für tiefe Gedanken schaffen.'
      };

      for (const lens of ['didactics', 'contemplation', 'sound_alchemy'] as const) {
        const output = await studio.generateLensOutput({
          ...input,
          lens
        });

        assert.strictEqual(output.lens, lens);
        assert.ok(output.heading.length > 5);
        assert.ok(output.coreThesis.length > 15);
        assert.ok(Array.isArray(output.insights) && output.insights.length >= 2);
        assert.ok(Array.isArray(output.reflectionQuestions) && output.reflectionQuestions.length >= 2);
        assert.ok(output.practicalImpulse.length > 10);
      }
    });

    it('formats studio output into publication-ready Markdown', () => {
      const studio = new AtmenStudioService();
      const output = {
        lens: 'contemplation' as const,
        title: 'Stoische Ruhe in der Infoflut',
        heading: 'Stoische Ruhe in der Infoflut',
        coreThesis: 'Nicht die Pings stören den Geist, sondern unser Urteil darüber.',
        insights: [
          'Dichotomie der Kontrolle anwenden',
          'Aufmerksamkeitsdiät praktizieren'
        ],
        reflectionQuestions: [
          'Welche Information heute war wirklich handlungsrelevant?'
        ],
        practicalImpulse: 'Schalte Benachrichtigungen für 24 Stunden ab.',
        formattedMarkdown: '',
        isAiGenerated: false
      };

      const md = studio.formatStudioOutputMarkdown(output);
      assert.ok(md.includes('# Stoische Ruhe in der Infoflut'));
      assert.ok(md.includes('Nicht die Pings stören'));
      assert.ok(md.includes('Dichotomie der Kontrolle'));
      assert.ok(md.includes('Reflexions-Fragen'));
      assert.ok(md.includes('Praktischer Impuls'));

      const standaloneMd = formatStudioOutputMarkdown(output);
      assert.strictEqual(standaloneMd, md);
    });
  });

  describe('4. Batch Semantic Enrichment & Topic Classification', () => {
    it('classifies content deterministically into valid TopicTags', () => {
      const enricher = new BatchEditionEnricher();

      const topic1 = enricher.classifyTopicDeterministically(
        'Die Stoa von Marcus Aurelius und Seneca über Seelenfrieden',
        'Ethik, Tugend und Gelassenheit im antiken Rom.'
      );
      assert.strictEqual(topic1, 'philosophy_ethics');

      const topic2 = classifyTopicDeterministically(
        'Neues Apple MacBook Pro mit M4 Chip und KI-Funktionen',
        'Machine learning, neural engine und Hardware-Architektur.'
      );
      assert.strictEqual(topic2, 'ai_apple');

      const topic3 = enricher.classifyTopicDeterministically(
        'Synthesizer Klangsynthese und Ambient Frequenzen',
        'Modulare Synthesizer, Oszillatoren, Hall und Reverb-Klänge.'
      );
      assert.strictEqual(topic3, 'sound_synthesis');

      const topic4 = classifyTopicDeterministically(
        'Longevity, Schlaftracking und Kaltwasser-Immersion',
        'Biologische Biomarker, Fasten und Kognition.'
      );
      assert.strictEqual(topic4, 'health_biohacking');
    });

    it('enriches raw items deterministically generating clean German feedText and insights', () => {
      const enricher = new BatchEditionEnricher();

      const rawItem: FeedItem = {
        ...INITIAL_FIXTURES[0],
        title: 'Deep Mind Breakthrough in Protein Folding',
        feedText: 'Ein ausführlicher Überblick über neue Durchbrüche in der Biologie und Proteinfaltung.',
        topics: ['science_society']
      };

      const enriched = enricher.enrichDeterministically(rawItem);
      assert.ok(enriched.feedText.length > 20);
      assert.ok(enriched.keyInsight && enriched.keyInsight.length > 10);
      assert.ok(enriched.didacticTransfer && enriched.didacticTransfer.length > 10);
      assert.ok(enriched.topics.length >= 1);

      const standaloneEnriched = enrichDeterministically(rawItem);
      assert.strictEqual(standaloneEnriched.primaryTopic, enriched.primaryTopic);
    });
  });
});
