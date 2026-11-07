import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  areFeedCardPropsEqual,
  computeOptimisticVoteState,
  FeedCardMemoComparableProps,
  ScoredFeedItem
} from '../src/core/domain/ranking';
import { SeenImpressionsService } from '../src/core/data/seenImpressionsService';
import { AtemStorage, MemoryStorageDriver } from '../src/core/data/storage';
import { ReadingInteraction } from '../src/core/domain/types';

function makeMockScoredItem(id: string, upvotesCount = 12): ScoredFeedItem {
  return {
    id,
    title: `Epistemische Analyse #${id}`,
    subtitle: 'Wissenschaftliche Einordnung',
    feedText:
      'Eine fundierte Untersuchung zur Erkenntnistheorie und Kognitionswissenschaft mit klaren Primärbelegen.',
    articleBody:
      'Eine fundierte Untersuchung zur Erkenntnistheorie und Kognitionswissenschaft mit klaren Primärbelegen und ausführlicher Argumentation.',
    format: 'concise_insight',
    primaryTopic: 'philosophy_ethics',
    topics: ['philosophy_ethics', 'science_society'],
    space: 'c/epistemologie',
    estimatedMinutes: 5,
    publishedAt: '2026-11-07T08:00:00.000Z',
    sourceTrustLevel: 'peer_reviewed',
    sourceReferences: [
      {
        title: 'Stanford Encyclopedia of Philosophy',
        publisher: 'plato.stanford.edu',
        originalUrl: `https://plato.stanford.edu/entries/${id}`,
        retrievalTimestamp: '2026-11-07T08:00:00.000Z',
        isVerified: true
      }
    ],
    upvotesCount,
    score: 0.92,
    explanation: {
      summary: 'Relevant für Erkenntnistheorie',
      matchedTopics: ['philosophy_ethics'],
      trustBonus: 0.2,
      freshnessScore: 0.9,
      diversityAdjusted: false
    }
  } as unknown as ScoredFeedItem;
}

describe('Performance & 60fps UI Responsiveness (v5.2)', () => {
  it('1. App.tsx keeps FeedScreen mounted while conditionally mounting LibraryScreen, SettingsScreen, and NetworkScreen only when active', () => {
    const appPath = path.resolve(__dirname, '../App.tsx');
    const source = fs.readFileSync(appPath, 'utf-8');

    // FeedScreen stays mounted with display toggle so scroll position is preserved
    assert.ok(
      source.includes("display: activeTab === 'feed' ? 'flex' : 'none'"),
      'FeedScreen container must keep display toggle to preserve scroll offset'
    );
    assert.ok(source.includes('<FeedScreen />'), 'FeedScreen must be rendered');

    // Heavy background tabs must be conditionally rendered only when active
    assert.ok(
      source.includes("activeTab === 'library' &&"),
      'LibraryScreen must only mount when activeTab === library'
    );
    assert.ok(
      source.includes("activeTab === 'settings' &&"),
      'SettingsScreen must only mount when activeTab === settings'
    );
    assert.ok(
      source.includes("activeTab === 'network' &&"),
      'NetworkScreen (including HyperspaceCanvas) must only mount when activeTab === network'
    );
    assert.ok(
      !source.includes("display: activeTab === 'network' ? 'flex' : 'none'"),
      'NetworkScreen must no longer stay hidden in background with display:none'
    );
  });

  it('2. FeedCard is wrapped in React.memo and areFeedCardPropsEqual prevents unnecessary re-renders across sibling cards', () => {
    const feedCardSource = fs.readFileSync(
      path.resolve(__dirname, '../src/ui/components/FeedCard.tsx'),
      'utf-8'
    );
    assert.ok(
      feedCardSource.includes('export const FeedCard = React.memo(FeedCardInner, areFeedCardPropsEqual)'),
      'FeedCard must be wrapped in React.memo with areFeedCardPropsEqual comparator'
    );

    const itemA = makeMockScoredItem('card-1', 10);
    const interactionA: ReadingInteraction = {
      itemId: 'card-1',
      saved: false,
      progressPercent: 0,
      furthestPositionPercent: 0,
      voteScore: 0,
      feedback: 'neutral',
      userNotes: []
    };

    const baseProps: FeedCardMemoComparableProps & Record<string, unknown> = {
      item: itemA,
      interaction: interactionA,
      isDark: true,
      isHero: true,
      isFocused: false,
      isExpanded: false,
      hivemindTrackProgressPercent: 25,
      isHivemindStepCompleted: false
    };

    // Unrelated parent re-render with fresh callback references or cloned objects with identical values -> MUST NOT re-render (returns true)
    assert.equal(
      areFeedCardPropsEqual(baseProps, {
        ...baseProps,
        item: { ...itemA },
        interaction: { ...interactionA },
        onInvestigateTopic: () => {},
        onDismissItem: () => {}
      }),
      true,
      'areFeedCardPropsEqual must return true when card-relevant state has not changed'
    );

    // Changing voteScore -> MUST re-render (returns false)
    assert.equal(
      areFeedCardPropsEqual(baseProps, {
        ...baseProps,
        interaction: { ...interactionA, voteScore: 1 }
      }),
      false,
      'areFeedCardPropsEqual must return false when voteScore changes'
    );

    // Changing saved -> MUST re-render (returns false)
    assert.equal(
      areFeedCardPropsEqual(baseProps, {
        ...baseProps,
        interaction: { ...interactionA, saved: true }
      }),
      false,
      'areFeedCardPropsEqual must return false when saved bookmark state changes'
    );

    // Changing upvotesCount -> MUST re-render (returns false)
    assert.equal(
      areFeedCardPropsEqual(baseProps, {
        ...baseProps,
        item: { ...itemA, upvotesCount: 11 }
      }),
      false,
      'areFeedCardPropsEqual must return false when upvotesCount changes'
    );

    // Changing isDark -> MUST re-render (returns false)
    assert.equal(
      areFeedCardPropsEqual(baseProps, {
        ...baseProps,
        isDark: false
      }),
      false,
      'areFeedCardPropsEqual must return false when theme (isDark) changes'
    );

    // Changing Hivemind progress or completion -> MUST re-render (returns false)
    assert.equal(
      areFeedCardPropsEqual(baseProps, {
        ...baseProps,
        hivemindTrackProgressPercent: 50
      }),
      false,
      'areFeedCardPropsEqual must return false when Hivemind track progress changes'
    );
    assert.equal(
      areFeedCardPropsEqual(baseProps, {
        ...baseProps,
        isHivemindStepCompleted: true
      }),
      false,
      'areFeedCardPropsEqual must return false when Hivemind step completion changes'
    );
  });

  it('3. Optimistic voteItem updates interaction state and upvotesCount in 0ms without reordering the feed array', () => {
    const items = [
      makeMockScoredItem('item-1', 5),
      makeMockScoredItem('item-2', 20),
      makeMockScoredItem('item-3', 8)
    ];
    const initialInteractions: Record<string, ReadingInteraction> = {};

    const startMs = performance.now();
    const afterUpvote = computeOptimisticVoteState(initialInteractions, items, 'item-2', 'up');
    const elapsedMs = performance.now() - startMs;

    assert.ok(elapsedMs < 5, `Optimistic vote state update must complete in <5ms (took ${elapsedMs.toFixed(2)}ms)`);
    assert.equal(afterUpvote.nextInteractions['item-2']?.voteScore, 1);
    assert.equal(afterUpvote.nextInteractions['item-2']?.feedback, 'more_like_this');
    assert.equal(afterUpvote.deltaUpvotes, 1);

    // Array order MUST remain 100% identical (no feed jump on upvote!)
    assert.deepEqual(
      afterUpvote.nextItems.map(i => i.id),
      ['item-1', 'item-2', 'item-3'],
      'Optimistic upvote must never reorder the active feed array'
    );
    assert.equal(afterUpvote.nextItems[1].upvotesCount, 21);
    // Unchanged sibling items preserve exact object reference
    assert.strictEqual(afterUpvote.nextItems[0], items[0]);
    assert.strictEqual(afterUpvote.nextItems[2], items[2]);

    // Clearing the upvote restores upvotesCount in 0ms without reordering
    const afterClear = computeOptimisticVoteState(
      afterUpvote.nextInteractions,
      afterUpvote.nextItems,
      'item-2',
      'clear'
    );
    assert.equal(afterClear.nextInteractions['item-2']?.voteScore, 0);
    assert.equal(afterClear.nextItems[1].upvotesCount, 20);
    assert.deepEqual(
      afterClear.nextItems.map(i => i.id),
      ['item-1', 'item-2', 'item-3']
    );
  });

  it('4. SeenImpressionsService updates in-memory state in 0ms while debouncing persistent storage writes', async () => {
    const driver = new MemoryStorageDriver();
    const backingStore = new AtemStorage(driver);
    let setItemCalls = 0;
    const origSetItem = driver.setItem.bind(driver);
    driver.setItem = async (key: string, value: string): Promise<void> => {
      setItemCalls += 1;
      return origSetItem(key, value);
    };

    const service = new SeenImpressionsService(backingStore);

    // Rapid scroll simulation: 3 consecutive batches of seen cards
    const t0 = performance.now();
    await service.recordSeen(['scroll-card-1', 'scroll-card-2']);
    await service.recordSeen(['scroll-card-3', 'scroll-card-4']);
    await service.recordSeen(['scroll-card-5']);
    const elapsedMs = performance.now() - t0;

    // 1. In-memory state is updated immediately in 0ms
    assert.ok(elapsedMs < 10, `In-memory seen recording must be instant (<10ms, took ${elapsedMs.toFixed(2)}ms)`);
    const syncIds = service.getSeenIdsSync();
    assert.equal(syncIds.has('scroll-card-1'), true);
    assert.equal(syncIds.has('scroll-card-5'), true);
    assert.equal(syncIds.size, 5);

    const asyncIds = await service.getSeenIds();
    assert.equal(asyncIds.size, 5);

    // 2. Persistent storage has NOT been spammed synchronously during scrolling (0 writes before debounce window/flush)
    assert.equal(
      setItemCalls,
      0,
      'Storage setItem must be debounced and not called synchronously on every scroll event'
    );

    // 3. Flushing writes all accumulated records in a single batch
    await service.flush();
    assert.equal(setItemCalls, 1, 'Flush must write all accumulated seen records in a single storage operation');

    const storedRaw = await backingStore.getItem(SeenImpressionsService.STORAGE_KEY);
    assert.ok(storedRaw);
    const parsed = JSON.parse(storedRaw);
    assert.equal(parsed.length, 5);
  });
});
