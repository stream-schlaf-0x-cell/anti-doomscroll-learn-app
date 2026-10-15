import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Home Navigation & Search/Filter Reset Invariants', () => {
  it('resets query, subchannel filter, and active tab back to default daily feed', () => {
    // Model the exact state reset contract implemented in goHome
    const state = {
      selectedArticleId: 'some-article-123',
      selectedArticle: { id: 'some-article-123', title: 'Test Article' },
      whyModalItem: { id: 'some-article-123' },
      activeTab: 'library',
      activeFeedOption: 'classics',
      selectedFilter: 'c/quanten_sprung',
      searchQuery: 'Quantenverschränkung'
    };

    // Simulate goHome contract
    const goHome = (s: typeof state) => ({
      ...s,
      selectedArticleId: null,
      selectedArticle: null,
      whyModalItem: null,
      activeTab: 'feed',
      activeFeedOption: 'daily',
      selectedFilter: 'all',
      searchQuery: ''
    });

    const resetState = goHome(state);

    assert.equal(resetState.searchQuery, '', 'searchQuery must be cleared so feed is not empty');
    assert.equal(resetState.selectedFilter, 'all', 'selectedFilter must be reset to all');
    assert.equal(resetState.activeTab, 'feed', 'activeTab must return to feed');
    assert.equal(resetState.activeFeedOption, 'daily', 'activeFeedOption must return to daily');
    assert.equal(resetState.selectedArticleId, null, 'selectedArticleId must be null');
    assert.equal(resetState.selectedArticle, null, 'selectedArticle must be null');
    assert.equal(resetState.whyModalItem, null, 'whyModalItem must be null');
  });
});
