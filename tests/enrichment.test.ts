import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  calculateCostEur,
  EnrichmentUsageLedger,
  MONTHLY_BUDGET_CEILING_EUR,
  StorageDriverLedgerStorage
} from '../src/core/enrichment/ledger';
import { EnrichmentCache } from '../src/core/enrichment/cache';
import {
  SourceOnlyEnricher,
  MockEnricher,
  ProviderEnricher,
  CURRENT_PROMPT_VERSION
} from '../src/core/enrichment/enricher';
import { INITIAL_FIXTURES } from '../src/core/data/fixtures';
import { MemoryStorageDriver, AtemStorage } from '../src/core/data/storage';

describe('Provider-Independent Enrichment & €5 Budget Enforcement', () => {
  it('1. Calculates token costs accurately using grounded Gemini Flash pricing', () => {
    // 10,000 input tokens = 10,000 * 0.000000095 = €0.00095
    // 2,500 output tokens = 2,500 * 0.00000038 = €0.00095
    // Total = €0.0019
    const cost = calculateCostEur(10000, 2500);
    assert.strictEqual(cost, 0.0019);
  });

  it('2. EnrichmentUsageLedger records calls and accumulates monthly totals in memory', async () => {
    const ledger = new EnrichmentUsageLedger('', false); // in-memory mode

    await ledger.recordUsage({
      itemId: 'art-01',
      model: 'gemini-3.8-flash',
      inputTokens: 1000,
      outputTokens: 300
    });

    await ledger.recordUsage({
      itemId: 'art-02',
      model: 'gemini-3.8-flash',
      inputTokens: 2000,
      outputTokens: 400
    });

    const summary = await ledger.getSummary();
    assert.strictEqual(summary.totalCalls, 2);
    assert.strictEqual(summary.totalInputTokens, 3000);
    assert.strictEqual(summary.totalOutputTokens, 700);
    assert.ok(summary.totalCostEur > 0);
    assert.strictEqual(summary.isBudgetExceeded, false);
    assert.strictEqual(summary.budgetLimitEur, MONTHLY_BUDGET_CEILING_EUR);
  });

  it('3. Enforces hard monthly ceiling (€5.00) and blocks further spend when exceeded', async () => {
    const ledger = new EnrichmentUsageLedger('', false);

    // Simulate reaching the €5.00 limit
    await ledger.recordUsage({
      itemId: 'art-heavy',
      model: 'gemini-3.8-flash',
      inputTokens: 1000,
      outputTokens: 1000,
      costEur: 5.01
    });

    const summary = await ledger.getSummary();
    assert.strictEqual(summary.isBudgetExceeded, true);

    const canSpendMore = await ledger.canSpend(0.001);
    assert.strictEqual(canSpendMore, false, 'canSpend must return false when budget exceeded');
  });

  it('4. EnrichmentCache stores and retrieves results keyed by contentHash + promptVersion', async () => {
    const cache = new EnrichmentCache('', false);
    const hash = 'abcd-1234-hash';

    const sampleResult = {
      feedText: 'Gecachter Standalone-Text für die Karte.',
      relevanceExplanation: 'Erklärung aus dem Cache.',
      modelUsed: 'gemini-3.8-flash',
      promptVersion: CURRENT_PROMPT_VERSION,
      inputTokens: 500,
      outputTokens: 150,
      estimatedCostEur: 0.0001,
      isFallback: false
    };

    assert.strictEqual(await cache.get(hash, CURRENT_PROMPT_VERSION), null);

    await cache.set(hash, CURRENT_PROMPT_VERSION, sampleResult);
    const retrieved = await cache.get(hash, CURRENT_PROMPT_VERSION);

    assert.ok(retrieved !== null);
    assert.strictEqual(retrieved!.feedText, 'Gecachter Standalone-Text für die Karte.');
  });

  it('5. SourceOnlyEnricher operates at zero cost and synthesizes German standalone reading', async () => {
    const enricher = new SourceOnlyEnricher();
    const item = INITIAL_FIXTURES[0];

    const result = await enricher.enrich({ item });

    assert.strictEqual(result.estimatedCostEur, 0);
    assert.strictEqual(result.inputTokens, 0);
    assert.strictEqual(result.outputTokens, 0);
    assert.strictEqual(result.isFallback, true);
    assert.strictEqual(result.modelUsed, 'source_only_heuristic');
    assert.ok(result.feedText.length > 50, 'feedText must be substantive');
    assert.ok(result.relevanceExplanation.includes(item.primaryTopic) || result.relevanceExplanation.length > 20);
  });

  it('6. ProviderEnricher uses active model when budget allows and records spend in ledger', async () => {
    const ledger = new EnrichmentUsageLedger('', false);
    const cache = new EnrichmentCache('', false);
    const mockModel = new MockEnricher(1200, 350);
    const providerEnricher = new ProviderEnricher(ledger, cache, mockModel);

    const item = INITIAL_FIXTURES[0];
    const result = await providerEnricher.enrich({ item });

    assert.strictEqual(result.isFallback, false);
    assert.strictEqual(result.modelUsed, 'gemini-3.8-flash');
    assert.strictEqual(result.inputTokens, 1200);

    const summary = await ledger.getSummary();
    assert.strictEqual(summary.totalCalls, 1);
    assert.strictEqual(summary.totalInputTokens, 1200);
  });

  it('7. ProviderEnricher serves cached results without re-spending budget', async () => {
    const ledger = new EnrichmentUsageLedger('', false);
    const cache = new EnrichmentCache('', false);
    const mockModel = new MockEnricher(1000, 300);
    const providerEnricher = new ProviderEnricher(ledger, cache, mockModel);

    const item = INITIAL_FIXTURES[0];

    // First call: spends tokens
    await providerEnricher.enrich({ item });
    let summary = await ledger.getSummary();
    assert.strictEqual(summary.totalCalls, 1);

    // Second call for same item: served from cache, totalCalls in ledger remains 1!
    const cachedResult = await providerEnricher.enrich({ item });
    assert.strictEqual(cachedResult.isFallback, false);
    summary = await ledger.getSummary();
    assert.strictEqual(summary.totalCalls, 1, 'Cache hit must not add additional ledger entry');
  });

  it('8. ProviderEnricher automatically falls back to SourceOnlyEnricher when monthly budget is exceeded', async () => {
    const ledger = new EnrichmentUsageLedger('', false);
    const cache = new EnrichmentCache('', false);
    const mockModel = new MockEnricher(1000, 300);

    // Exhaust budget
    await ledger.recordUsage({
      itemId: 'prior-spend',
      model: 'gemini-3.8-flash',
      inputTokens: 1000,
      outputTokens: 1000,
      costEur: 5.00
    });

    const providerEnricher = new ProviderEnricher(ledger, cache, mockModel);
    const item = INITIAL_FIXTURES[1];

    const result = await providerEnricher.enrich({ item });

    assert.strictEqual(result.isFallback, true, 'Must gracefully switch to zero-cost fallback');
    assert.strictEqual(result.modelUsed, 'source_only_heuristic');
    assert.strictEqual(result.estimatedCostEur, 0);
  });

  it('9. GeminiEnricher gracefully falls back when no API key is provided and generates sparring replies', async () => {
    const { GeminiEnricher } = await import('../src/core/enrichment/geminiEnricher');
    const enricher = new GeminiEnricher({ apiKey: '' });
    assert.strictEqual(enricher.hasApiKey(), false);

    const item = INITIAL_FIXTURES[0];
    const result = await enricher.enrich({ item });
    assert.strictEqual(result.isFallback, true);
    assert.ok(result.feedText.length > 20);

    // Test sparring reply generation
    const sparring = await enricher.generateLiveSparring('Das ist ein zu starker Anspruch an die Vernunft.', 'einwand', item.title);
    assert.strictEqual(sparring.authorHandle, '🤖 Gegenstimme');
    assert.strictEqual(sparring.authorBadge, 'Dialektischer Sparring-Partner');
    assert.ok(sparring.text.length > 30);
  });

  it('10. Atomic budget reservation guarantees race-free spending limits', async () => {
    const ledger = new EnrichmentUsageLedger('', false);

    // Reserve 4.99
    const res1 = await ledger.reserveSpend(4.99);
    assert.ok(res1, 'First reservation should succeed');

    // Second reservation for 0.05 would exceed 5.00 -> should fail
    const res2 = await ledger.reserveSpend(0.05);
    assert.strictEqual(res2, null, 'Second concurrent reservation exceeding 5.00 must fail');

    // Release first reservation
    await ledger.releaseReservation(res1);

    // Now reservation for 0.05 must succeed
    const res3 = await ledger.reserveSpend(0.05);
    assert.ok(res3, 'Reservation should succeed after release');

    // Commit reservation with actual spend
    await ledger.commitReservation(res3, {
      itemId: 'res-test',
      model: 'gemini-2.5-flash',
      inputTokens: 100,
      outputTokens: 50,
      costEur: 0.0001
    });

    const summary = await ledger.getSummary();
    assert.strictEqual(summary.totalCalls, 1);
    assert.ok(summary.totalCostEur > 0);
  });

  it('11. Fail-Safe Closed: Corrupted ledger storage locks budget and prevents further spend', async () => {
    const memoryDriver = new MemoryStorageDriver();
    // Simulate corrupt JSON in stored ledger
    await memoryDriver.setItem('@atem:usage_ledger:v1', '{invalid-json-bytes: corrupt!');
    const storage = new StorageDriverLedgerStorage(new AtemStorage(memoryDriver));
    const ledger = new EnrichmentUsageLedger(storage);

    // Summary must report budget exceeded / locked
    const summary = await ledger.getSummary();
    assert.strictEqual(summary.isBudgetExceeded, true, 'Corrupted ledger must report isBudgetExceeded = true');

    // canSpend and reserveSpend must fail-safe closed
    const canSpend = await ledger.canSpend(0.001);
    assert.strictEqual(canSpend, false, 'canSpend must return false on corrupted storage');

    const reservation = await ledger.reserveSpend(0.001);
    assert.strictEqual(reservation, null, 'reserveSpend must be rejected on corrupted storage');
  });

  it('12. Fail-Safe Closed on ALL Storage Errors: Storage unavailable or write error locks budget and falls back to SourceOnlyEnricher', async () => {
    const memoryDriver = new MemoryStorageDriver();
    // 1. Simulate read failure (StorageUnavailableError)
    memoryDriver.shouldFailReads = true;
    const storage = new StorageDriverLedgerStorage(new AtemStorage(memoryDriver));
    const ledger = new EnrichmentUsageLedger(storage);

    assert.strictEqual(await ledger.canSpend(0.001), false, 'canSpend must return false on read failure');
    assert.strictEqual(await ledger.reserveSpend(0.001), null, 'reserveSpend must return null on read failure');
    assert.strictEqual(ledger.isHealthy(), false, 'ledger must report unhealthy');

    const cache = new EnrichmentCache('', false);
    const mockProvider = new MockEnricher();
    const enricherWithFailingStorage = new ProviderEnricher(ledger, cache, mockProvider);

    const fallbackResult = await enricherWithFailingStorage.enrich({ item: INITIAL_FIXTURES[0] });
    assert.strictEqual(fallbackResult.isFallback, true, 'Enricher must fallback to SourceOnlyEnricher on storage read failure');

    // 2. Simulate write failure (StorageWriteError)
    const writeFailingDriver = new MemoryStorageDriver();
    writeFailingDriver.shouldFailWrites = true;
    const writeFailingStorage = new StorageDriverLedgerStorage(new AtemStorage(writeFailingDriver));
    const writeFailingLedger = new EnrichmentUsageLedger(writeFailingStorage);

    assert.strictEqual(await writeFailingLedger.reserveSpend(0.001), null, 'reserveSpend must return null when reservation write fails');
    assert.strictEqual(writeFailingLedger.isHealthy(), false, 'writeFailingLedger must report unhealthy');

    const enricherWithWriteFailure = new ProviderEnricher(writeFailingLedger, cache, mockProvider);
    const writeFallbackResult = await enricherWithWriteFailure.enrich({ item: INITIAL_FIXTURES[1] });
    assert.strictEqual(writeFallbackResult.isFallback, true, 'Enricher must fallback to SourceOnlyEnricher on storage write failure');
  });
});

