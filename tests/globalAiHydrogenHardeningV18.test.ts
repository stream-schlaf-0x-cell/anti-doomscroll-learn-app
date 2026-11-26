import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterEach, describe, it, mock } from 'node:test';
import {
  AI_CREDENTIALS_STORAGE_KEY,
  HYDROGEN_DEFAULT_MIGRATED_KEY,
  SELECTED_MODEL_ID_STORAGE_KEY,
  clearAiCredentials,
  extractJsonFromAiResponse,
  getSelectedModelId,
  loadAiCredentials,
  resetSessionEffectiveModels,
  saveAiCredentials,
  setSelectedModelId,
  testAiConnection
} from '../src/core/ai/atmenAiClient';
import { clearResolvedGeminiModelCache } from '../src/core/ai/geminiModelRegistry';
import { AtemStorage, MemoryStorageDriver } from '../src/core/data/storage';
import { CloudSyncService, mergeSyncSnapshots, AtmenSyncSnapshot } from '../src/core/sync/cloudSyncService';
import { InvestigationEngine } from '../src/core/investigation/investigationEngine';
import { NewsEvolutionService } from '../src/core/news/newsEvolutionService';
import { generateQuizWithAi } from '../src/core/quiz/quizGenerator';
import { INITIAL_FIXTURES } from '../src/core/data/fixtures';
import { EnrichmentUsageLedger } from '../src/core/enrichment/ledger';

describe('Global AI Hydrogen Hardening v18', () => {
  afterEach(() => {
    mock.restoreAll();
    resetSessionEffectiveModels();
    clearResolvedGeminiModelCache();
  });

  it('1. performs one-time migration from legacy gemini-3.8-flash / google/gemini-3.8-flash to gemini-4-hydrogen / google/gemini-4-hydrogen', async () => {
    // 1a. Gemini legacy credentials on loadAiCredentials
    const geminiStorage = new AtemStorage(new MemoryStorageDriver());
    await geminiStorage.setItem(
      AI_CREDENTIALS_STORAGE_KEY,
      JSON.stringify({
        provider: 'gemini',
        apiKey: 'test-key-mig-1',
        model: 'gemini-3.8-flash',
        persistApiKey: true
      })
    );
    await geminiStorage.setItem(SELECTED_MODEL_ID_STORAGE_KEY, 'gemini-3.8-flash');

    const loadedGemini = await loadAiCredentials(geminiStorage);
    assert.equal(loadedGemini.model, 'gemini-4-hydrogen');
    assert.equal(await geminiStorage.getItem(SELECTED_MODEL_ID_STORAGE_KEY), 'gemini-4-hydrogen');
    assert.equal(await geminiStorage.getItem(HYDROGEN_DEFAULT_MIGRATED_KEY), '1');

    // 1b. OpenRouter legacy credentials on loadAiCredentials
    const orStorage = new AtemStorage(new MemoryStorageDriver());
    await orStorage.setItem(
      AI_CREDENTIALS_STORAGE_KEY,
      JSON.stringify({
        provider: 'openrouter',
        apiKey: 'sk-or-test-mig-2',
        model: 'google/gemini-3.8-flash',
        persistApiKey: true
      })
    );
    const loadedOr = await loadAiCredentials(orStorage);
    assert.equal(loadedOr.model, 'google/gemini-4-hydrogen');
    assert.equal(await orStorage.getItem(SELECTED_MODEL_ID_STORAGE_KEY), 'google/gemini-4-hydrogen');
    assert.equal(await orStorage.getItem(HYDROGEN_DEFAULT_MIGRATED_KEY), '1');

    // 1c. Standalone @atem:selected_model_id:v1 via getSelectedModelId
    const directStorage = new AtemStorage(new MemoryStorageDriver());
    await directStorage.setItem(SELECTED_MODEL_ID_STORAGE_KEY, 'gemini-3.8-flash');
    const migratedId = await getSelectedModelId(directStorage);
    assert.equal(migratedId, 'gemini-4-hydrogen');
    assert.equal(await directStorage.getItem(HYDROGEN_DEFAULT_MIGRATED_KEY), '1');
  });

  it('2. preserves explicit user model selection via saveAiCredentials and setSelectedModelId', async () => {
    const storage = new AtemStorage(new MemoryStorageDriver());

    // Explicit saveAiCredentials to legacy model must be preserved forever afterward
    await saveAiCredentials(
      {
        provider: 'gemini',
        apiKey: 'test-explicit-key',
        model: 'gemini-3.8-flash',
        persistApiKey: true
      },
      storage
    );
    assert.equal(await storage.getItem(HYDROGEN_DEFAULT_MIGRATED_KEY), '1');
    assert.equal(await storage.getItem(SELECTED_MODEL_ID_STORAGE_KEY), 'gemini-3.8-flash');

    const reloaded = await loadAiCredentials(storage);
    assert.equal(reloaded.model, 'gemini-3.8-flash');
    assert.equal(await getSelectedModelId(storage), 'gemini-3.8-flash');

    // Subsequent explicit switch via setSelectedModelId is also strictly preserved
    await setSelectedModelId('gemini-2.5-pro', storage);
    assert.equal(await getSelectedModelId(storage), 'gemini-2.5-pro');
    assert.equal((await loadAiCredentials(storage)).model, 'gemini-2.5-pro');

    // Even intentionally switching back to gemini-3.8-flash via setSelectedModelId is preserved
    await setSelectedModelId('gemini-3.8-flash', storage);
    assert.equal(await getSelectedModelId(storage), 'gemini-3.8-flash');
    assert.equal((await loadAiCredentials(storage)).model, 'gemini-3.8-flash');
  });

  it('3. CloudSyncService never lets legacy remote gemini-3.8-flash downgrade local gemini-4-hydrogen', async () => {
    const localSnap: AtmenSyncSnapshot = {
      version: 1,
      deviceId: 'local-mac',
      updatedAt: '2026-11-25T10:00:00.000Z',
      aiCredentials: {
        geminiApiKey: 'key-local',
        preferredProvider: 'gemini',
        selectedGeminiModelId: 'gemini-4-hydrogen'
      }
    };
    const newerLegacyRemoteSnap: AtmenSyncSnapshot = {
      version: 1,
      deviceId: 'old-iphone',
      updatedAt: '2026-11-25T12:00:00.000Z',
      aiCredentials: {
        geminiApiKey: 'key-remote',
        preferredProvider: 'gemini',
        selectedGeminiModelId: 'gemini-3.8-flash'
      }
    };

    const merged = mergeSyncSnapshots(localSnap, newerLegacyRemoteSnap);
    assert.equal(merged.aiCredentials?.selectedGeminiModelId, 'gemini-4-hydrogen');

    // Also test applySnapshot directly against local Hydrogen state
    const storage = new AtemStorage(new MemoryStorageDriver());
    await saveAiCredentials(
      {
        provider: 'gemini',
        apiKey: 'key-local',
        model: 'gemini-4-hydrogen',
        persistApiKey: true
      },
      storage
    );
    const syncService = new CloudSyncService(storage);
    await syncService.applySnapshot(newerLegacyRemoteSnap);

    const credsAfterApply = await loadAiCredentials(storage);
    assert.equal(credsAfterApply.model, 'gemini-4-hydrogen');
    assert.equal(await getSelectedModelId(storage), 'gemini-4-hydrogen');
  });

  it('4. extractJsonFromAiResponse handles markdown fences, BOM/prose, arrays, and invalid input cleanly', () => {
    // 4a. Fenced JSON object with BOM and prose
    const fencedWithProse =
      '\uFEFFHier ist deine Analyse:\n```json\n{"status": "ok", "count": 3, "note": "Klammer {innen} ignoriert"}\n```\nViel Erfolg!';
    const obj = extractJsonFromAiResponse<{ status: string; count: number; note: string }>(fencedWithProse);
    assert.equal(obj.status, 'ok');
    assert.equal(obj.count, 3);
    assert.equal(obj.note, 'Klammer {innen} ignoriert');

    // 4b. Unfenced prose around JSON array
    const proseWithArray = 'Hinweis [vorab]: Hier sind die Einträge: [{"id": "a1"}, {"id": "a2"}] — Ende.';
    const arr = extractJsonFromAiResponse<{ id: string }[]>(proseWithArray);
    assert.equal(Array.isArray(arr), true);
    assert.equal(arr.length, 2);
    assert.equal(arr[1].id, 'a2');

    // 4c. Throws clear German SyntaxError on invalid or empty input
    assert.throws(() => extractJsonFromAiResponse(''), SyntaxError);
    assert.throws(() => extractJsonFromAiResponse('Keine JSON-Daten vorhanden.'), SyntaxError);
  });

  it('5. investigationEngine uses timeoutMs >= 30000 and parses fenced JSON with accurate modelUsed', async () => {
    const engineSrc = fs.readFileSync(
      path.resolve(__dirname, '../src/core/investigation/investigationEngine.ts'),
      'utf8'
    );
    assert.match(engineSrc, /timeoutMs:\s*(?:35_?000|3[0-9]_?\d{3})/);

    const storage = new AtemStorage(new MemoryStorageDriver());
    await saveAiCredentials(
      {
        provider: 'gemini',
        apiKey: 'inv-test-key',
        model: 'gemini-4-hydrogen',
        persistApiKey: true
      },
      storage
    );

    mock.method(globalThis, 'fetch', async (url: string | URL | Request) => {
      const u = String(url);
      if (u.includes('/v1beta/models?')) {
        return new Response(
          JSON.stringify({
            models: [{ name: 'models/gemini-4-hydrogen', supportedGenerationMethods: ['generateContent'] }]
          }),
          { status: 200 }
        );
      }
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: 'Analyse:\n```json\n{"synthesisSummary":"Klare Synthese.","groundedClaims":[{"id":"c1","claim":"Beleg 1","exactQuote":"Wörtliches Zitat.","sourceId":"s1","sourceTitle":"Quelle 1","evidenceType":"observation","confidence":"direct_quote"}],"limitationsAndCounterpoints":["Grenze A"],"openQuestions":["Frage B"],"suggestedNextSteps":[]}\n```'
                  }
                ]
              }
            }
          ],
          usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 60 }
        }),
        { status: 200 }
      );
    });

    const testRes = await testAiConnection({
      provider: 'gemini',
      apiKey: 'inv-test-key',
      model: 'gemini-4-hydrogen'
    });
    assert.equal(testRes.ok, true);
    assert.ok(testRes.message.includes('Verbunden · Modell: gemini-4-hydrogen'));

    await saveAiCredentials({
      provider: 'gemini',
      apiKey: 'inv-test-key',
      model: 'gemini-4-hydrogen',
      persistApiKey: true
    });
    try {
      const engine = new InvestigationEngine(storage);
      const invResult = await engine.runInvestigation('inv-v18-test', {
        question: 'Was zeigen die Quellen?',
        sources: [
          {
            id: 's1',
            title: 'Quelle 1',
            contentSnippet: 'Wörtliches Zitat. Weiterer Kontext über Methodik und Ergebnisse.',
            fullTextAvailable: true,
            wordCount: 25
          }
        ]
      });
      assert.equal(invResult.executionMode, 'ai_real');
      assert.equal(invResult.modelUsed, 'gemini-4-hydrogen');
      assert.equal(invResult.synthesisSummary, 'Klare Synthese.');
      assert.equal(invResult.groundedClaims[0].exactQuote, 'Wörtliches Zitat.');
    } finally {
      await clearAiCredentials();
    }
  });

  it('6. newsEvolutionService uses maxTokens >= 800, parses fenced JSON, and quizGenerator uses timeoutMs 25000', async () => {
    const evoSrc = fs.readFileSync(
      path.resolve(__dirname, '../src/core/news/newsEvolutionService.ts'),
      'utf8'
    );
    const maxTokensMatch = evoSrc.match(/maxTokens:\s*(\d+)/);
    assert.ok(maxTokensMatch && Number(maxTokensMatch[1]) >= 800, 'newsEvolutionService must use maxTokens >= 800');

    const quizSrc = fs.readFileSync(
      path.resolve(__dirname, '../src/core/quiz/quizGenerator.ts'),
      'utf8'
    );
    assert.match(quizSrc, /timeoutMs:\s*25_?000/);

    let capturedMaxTokens = 0;
    mock.method(globalThis, 'fetch', async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url);
      if (u.includes('/v1beta/models?')) {
        return new Response(
          JSON.stringify({
            models: [{ name: 'models/gemini-4-hydrogen', supportedGenerationMethods: ['generateContent'] }]
          }),
          { status: 200 }
        );
      }
      const body = JSON.parse(String(init?.body || '{}')) as {
        generationConfig?: { maxOutputTokens?: number };
        contents?: { parts?: { text?: string }[] }[];
      };
      capturedMaxTokens = body.generationConfig?.maxOutputTokens ?? 0;
      const promptText = body.contents?.[0]?.parts?.[0]?.text || '';
      if (promptText.includes('Beiträge für das sokratische Erkenntnis-Quiz')) {
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text:
                        '```json\n' +
                        JSON.stringify([
                          {
                            id: 'quiz-1',
                            question: 'Welche Hauptthese vertritt der vorliegende Beitrag zur Erkenntnistheorie?',
                            options: [
                              'Wahrnehmung strukturiert empirische Daten aktiv durch Vorannahmen.',
                              'Erkenntnis entsteht ausschließlich ohne jede begriffliche Vorstruktur.',
                              'Beobachtungen widerlegen grundsätzlich jede theoretische Modellbildung.',
                              'Begriffe und Sinnesdaten stehen in keinerlei Wechselwirkung zueinander.'
                            ],
                            correctIndex: 0,
                            explanation: 'Der Text betont die aktive Strukturierung empirischer Daten. Die anderen Optionen verneinen diese Wechselwirkung.'
                          }
                        ]) +
                        '\n```'
                    }
                  ]
                }
              }
            ],
            usageMetadata: { promptTokenCount: 90, candidatesTokenCount: 80 }
          }),
          { status: 200 }
        );
      }
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: 'Hier ist das Briefing:\n```json\n{"headline":"Neue Dynamik","point1":"Punkt 1 entwickelt sich.","point2":"Punkt 2 ist relevant.","point3":"Punkt 3 belegt Quellen.","openQuestions":["Was folgt daraus?"]}\n```'
                  }
                ]
              }
            }
          ],
          usageMetadata: { promptTokenCount: 80, candidatesTokenCount: 90 }
        }),
        { status: 200 }
      );
    });

    const storage = new AtemStorage(new MemoryStorageDriver());
    const briefing = await NewsEvolutionService.generateEvolutionBriefing(
      INITIAL_FIXTURES.slice(0, 3),
      {
        storage,
        forceRefresh: true,
        credentials: {
          provider: 'gemini',
          apiKey: 'evo-hydrogen-key',
          model: 'gemini-4-hydrogen',
          persistApiKey: true
        }
      }
    );

    assert.ok(capturedMaxTokens >= 800, `Expected maxOutputTokens >= 800, got ${capturedMaxTokens}`);
    assert.equal(briefing.isAiGenerated, true);
    assert.equal(briefing.modelUsed, 'gemini-4-hydrogen');
    assert.equal(briefing.headline, 'Neue Dynamik');
    assert.equal(briefing.points[0].text, 'Punkt 1 entwickelt sich.');

    const quiz = await generateQuizWithAi(
      [INITIAL_FIXTURES[0]],
      {
        provider: 'gemini',
        apiKey: 'quiz-hydrogen-key',
        model: 'gemini-4-hydrogen',
        persistApiKey: true
      },
      new EnrichmentUsageLedger('', false)
    );
    assert.equal(quiz.length, 1);
    assert.equal(quiz[0].question, 'Welche Hauptthese vertritt der vorliegende Beitrag zur Erkenntnistheorie?');
  });
});
