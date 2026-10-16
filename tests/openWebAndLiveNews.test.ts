import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ContinuousLiveNewsService } from '../src/core/data/continuousLiveNewsService';
import { AppearanceHistoryService } from '../src/core/data/appearanceHistoryService';
import { AtemStorage, MemoryStorageDriver } from '../src/core/data/storage';
import { interleaveForAddictiveLearning, scoreFeedItem } from '../src/core/domain/ranking';
import { normalizeFeedEntry } from '../src/core/ingestion/normalizer';
import { RawFeedSource, RawFeedEntry } from '../src/core/ingestion/types';
import { DEFAULT_USER_PROFILE } from '../src/core/data/fixtures';
import { REAL_KNOWLEDGE_VAULT } from '../src/core/data/realKnowledgeVault';

describe('Open-Web Harvesters, Live News CORS Resilience & Anti-Doomscroll Pacing', () => {
  it('ContinuousLiveNewsService: prevents static Python 3.15 from being stuck at #1 and prioritizes fresh items', async () => {
    const liveStream = await ContinuousLiveNewsService.getLiveStream({ limit: 10, forceRefresh: true });
    assert.ok(liveStream.length > 0, 'Live stream should return candidate items');

    // Item 0 must NOT be the 3-day-old static Python 3.15 item
    const firstItem = liveStream[0];
    assert.notStrictEqual(
      firstItem.id,
      'news_hub_heise_1',
      'First item must not be the hardcoded static Python 3.15 item'
    );

    // Verify that the top items are genuinely fresh (today's items)
    const todayStr = new Date().toISOString().split('T')[0];
    const topItemDate = firstItem.publishedAt.split('T')[0];
    assert.strictEqual(
      topItemDate,
      todayStr,
      `Top item must be from today (${todayStr}), got ${topItemDate}`
    );
  });

  it('ContinuousLiveNewsService: interleaves publishers so consecutive clumping is prevented', async () => {
    const liveStream = await ContinuousLiveNewsService.getLiveStream({ limit: 12 });
    assert.ok(liveStream.length >= 2, 'Live stream has sufficient items');

    // Count consecutive domain matches
    let consecutiveMatches = 0;
    for (let i = 0; i < liveStream.length - 1; i++) {
      const d1 = (liveStream[i].sourceDomain || '').toLowerCase().replace(/^www\./, '');
      const d2 = (liveStream[i + 1].sourceDomain || '').toLowerCase().replace(/^www\./, '');
      if (d1 && d2 && d1 === d2) {
        consecutiveMatches++;
      }
    }

    // Domain interleaving should ensure minimal consecutive duplicates
    assert.ok(
      consecutiveMatches <= 2,
      `Expected domain interleaving to prevent publisher clumping, found ${consecutiveMatches} consecutive duplicates`
    );
  });

  it('ContinuousLiveNewsService: provides a readable last-updated timestamp', () => {
    const lastUpdated = ContinuousLiveNewsService.getLastUpdatedTime();
    assert.ok(typeof lastUpdated === 'string' && lastUpdated.length > 0);
  });

  it('normalizer: splits teaser into distinct subtitle and feedText so card headers never repeat the body', () => {
    const rawEntry: RawFeedEntry = {
      id: 'test-rss-entry-1',
      sourceId: 'src_heise',
      title: 'Python 3.15 bringt tiefgreifende Performance-Optimierungen',
      link: 'https://heise.de/news/python-3-15',
      publishedAt: new Date().toISOString(),
      summary: 'Python 3.15 ist da! Hier sind alle Neuerungen. Die neue Version beschleunigt den Interpreter um bis zu 25 Prozent durch verbesserte Bytecode-Ausführung. Das Team hat außerdem den Memory-Manager überarbeitet.',
      fullContent: 'Python 3.15 ist da! Hier sind alle Neuerungen. Die neue Version beschleunigt den Interpreter um bis zu 25 Prozent durch verbesserte Bytecode-Ausführung. Das Team hat außerdem den Memory-Manager überarbeitet.'
    };

    const rawSource: RawFeedSource = {
      id: 'src_heise',
      name: 'Heise Online',
      url: 'https://heise.de/rss',
      primaryTopic: 'ai_apple',
      topics: ['ai_apple', 'science_society'],
      defaultEvidenceTier: 'publisher_excerpt',
      language: 'de'
    };

    const item = normalizeFeedEntry(rawEntry, rawSource);

    // Subtitle must be distinct from the remaining feedText
    assert.ok(item.subtitle.length > 0, 'Subtitle must be extracted');
    assert.ok(item.feedText.length > 0, 'FeedText must be present');
    assert.notStrictEqual(
      item.subtitle.trim(),
      item.feedText.trim(),
      'Subtitle and feedText must not be identical strings'
    );
    // feedText must not start with the exact same sentence as subtitle
    assert.ok(
      !item.feedText.startsWith(item.subtitle),
      'feedText should not redundantly repeat the exact subtitle'
    );
  });

  it('AppearanceHistoryService: chronologically records seen cards idempotently with sequence numbering', async () => {
    const storage = new AtemStorage(new MemoryStorageDriver());
    const historyService = new AppearanceHistoryService(storage);

    // Initial state
    const emptyRecords = await historyService.getHistoryRecords();
    assert.strictEqual(emptyRecords.length, 0);

    // Record first wave of cards
    const wave1 = ['item-1', 'item-2', 'item-3'];
    const recordsWave1 = await historyService.recordAppearances(wave1);
    assert.strictEqual(recordsWave1.length, 3);
    assert.strictEqual(recordsWave1[0].sequenceNumber, 1);
    assert.strictEqual(recordsWave1[1].sequenceNumber, 2);
    assert.strictEqual(recordsWave1[2].sequenceNumber, 3);

    // Record second wave with overlap ('item-2' already seen, 'item-4' is new)
    const wave2 = ['item-2', 'item-4'];
    const recordsWave2 = await historyService.recordAppearances(wave2);
    assert.strictEqual(recordsWave2.length, 4);

    // item-2 preserves its original sequenceNumber 2
    const item2Record = recordsWave2.find(r => r.itemId === 'item-2');
    assert.ok(item2Record);
    assert.strictEqual(item2Record.sequenceNumber, 2);
    assert.ok(item2Record.lastSeenAt);

    // item-4 gets sequenceNumber 4
    const item4Record = recordsWave2.find(r => r.itemId === 'item-4');
    assert.ok(item4Record);
    assert.strictEqual(item4Record.sequenceNumber, 4);

    // Clear history
    await historyService.clearHistory();
    const recordsAfterClear = await historyService.getHistoryRecords();
    assert.strictEqual(recordsAfterClear.length, 0);
  });

  it('interleaveForAddictiveLearning: paces discovery into dynamic waves including visual art showcases', () => {
    const mockProfile = {
      ...DEFAULT_USER_PROFILE,
      explicitInterests: {
        ...DEFAULT_USER_PROFILE.explicitInterests,
        art_aesthetics: 0.9,
        philosophy_ethics: 0.9
      }
    };

    // Score vault items
    const scoredPool = REAL_KNOWLEDGE_VAULT.map(item => scoreFeedItem(item, mockProfile, {}));

    // Interleave
    const pacedStream = interleaveForAddictiveLearning(scoredPool);
    assert.ok(pacedStream.length > 0, 'Paced stream must not be empty');

    // Check that art items are present
    const hasArt = pacedStream.some(item => item.format === 'art_showcase' || item.primaryTopic === 'art_aesthetics');
    assert.ok(hasArt, 'Paced stream should include visual art showcases');
  });
});
