import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { SpaceRepository, normalizeSpaceHandle } from '../src/core/spaces/spaceRepository';
import { AtemStorage, MemoryStorageDriver } from '../src/core/data/storage';
import { feedRepository } from '../src/core/data/feedRepository';
import { satisfiesCuratedBodyContract, getCardRenderableText } from '../src/core/enrichment/batchEnricher';
import { FeedItem } from '../src/core/domain/types';
import { INITIAL_FIXTURES } from '../src/core/data/fixtures';
import { generateHivemindStream } from '../src/core/synthesis/onTheFlyStreamService';

function createMockItem(id: string, overrides: Partial<FeedItem> = {}): FeedItem {
  return {
    ...INITIAL_FIXTURES[0],
    id,
    title: `Artikel ${id}`,
    canonicalUrl: `https://example.org/article-${id}`,
    publishedAt: '2026-10-18T10:00:00Z',
    topics: ['philosophy_ethics'],
    primaryTopic: 'philosophy_ethics',
    ...overrides
  };
}

describe('Custom Channel Curation & Deadlock Prevention Suite', () => {
  let storage: AtemStorage;
  let spaceRepo: SpaceRepository;

  beforeEach(() => {
    storage = new AtemStorage(new MemoryStorageDriver());
    spaceRepo = new SpaceRepository(storage);
  });

  it('satisfiesCuratedBodyContract rejects empty or boilerplate Hacker News link stubs', () => {
    const hnStub = createMockItem('hn-stub-1', {
      title: 'Show HN: A new tool for learning',
      subtitle: 'Hacker News Thread',
      feedText: 'Diskutiert auf Hacker News. 42 Punkte und 15 Kommentare.',
      body: 'Diskutiert auf Hacker News. 42 Punkte und 15 Kommentare.',
      keyInsight: undefined,
      topics: ['ai_apple'],
      primaryTopic: 'ai_apple',
      sourceReferences: [{
        publisher: 'Hacker News',
        originalUrl: 'https://news.ycombinator.com/item?id=123',
        title: 'Show HN',
        retrievalTimestamp: new Date().toISOString(),
        isVerified: false
      }],
      publishedAt: '2026-10-18T10:00:00Z',
      evidenceTier: 'publisher_excerpt',
      sourceTrustLevel: 'community_curated'
    });

    assert.equal(satisfiesCuratedBodyContract(hnStub), false);
    assert.ok(getCardRenderableText(hnStub).length < 120);

    const richArticle = createMockItem('rich-article-1', {
      title: 'Visible Learning: The Science of Effective Instruction',
      subtitle: 'Meta-Analysis by John Hattie',
      feedText: 'John Hatties monumentale Meta-Analyse von über 800 Studien zeigt deutlich, welche Faktoren den größten Einfluss auf schulisches Lernen haben: Feedback, formative Selbsteinschätzung und reziprokes Lehren erzielen Effektstärken von d > 0.70.',
      body: 'John Hatties monumentale Meta-Analyse von über 800 Studien zeigt deutlich, welche Faktoren den größten Einfluss auf schulisches Lernen haben: Feedback, formative Selbsteinschätzung und reziprokes Lehren erzielen Effektstärken von d > 0.70.',
      keyInsight: 'Feedback und formative Selbsteinschätzung erzielen signifikant höhere Lerneffekte als strukturelle Maßnahmen.',
      topics: ['german_didactics'],
      primaryTopic: 'german_didactics',
      sourceReferences: [{
        publisher: 'Educational Research Review',
        originalUrl: 'https://example.com/hattie',
        title: 'Hattie Review',
        retrievalTimestamp: new Date().toISOString(),
        isVerified: true
      }],
      publishedAt: '2026-10-18T10:00:00Z',
      evidenceTier: 'multiple_sources',
      sourceTrustLevel: 'peer_reviewed'
    });

    assert.equal(satisfiesCuratedBodyContract(richArticle), true);
    assert.ok(getCardRenderableText(richArticle).length >= 120);
  });

  it('updateSubchannel correctly updates typo handle and migrates items in feedRepository', async () => {
    // 1. Create channel with typo handle: c/visivle_learning
    const initial = await spaceRepo.createSubchannel({
      title: 'Visible Learning',
      handle: 'c/visivle_learning',
      description: 'Didaktik und Hattie-Forschung'
    });
    assert.equal(initial.handle, 'c/visivle_learning');

    // 2. Add feed items with the old handle
    const item1 = createMockItem('hattie-study-1', {
      title: 'Hattie Effect Sizes in Practice',
      subtitle: 'Visible Learning',
      feedText: 'Eine tiefgehende Betrachtung der Effektstärken in der Didaktik nach John Hattie mit Fokus auf Feedback.',
      body: 'Eine tiefgehende Betrachtung der Effektstärken in der Didaktik nach John Hattie mit Fokus auf Feedback.',
      topics: ['german_didactics'],
      primaryTopic: 'german_didactics',
      space: 'c/visivle_learning',
      sourceReferences: [{
        publisher: 'Didactics Journal',
        originalUrl: 'https://example.com/1',
        title: 'Didactics Journal',
        retrievalTimestamp: new Date().toISOString(),
        isVerified: true
      }],
      publishedAt: '2026-10-18T10:00:00Z',
      evidenceTier: 'multiple_sources',
      sourceTrustLevel: 'peer_reviewed'
    });
    feedRepository.addItems([item1]);

    const storedBefore = feedRepository.getAllItems().find(i => i.id === 'hattie-study-1');
    assert.equal(storedBefore?.space, 'c/visivle_learning');

    // 3. Rename/fix typo: c/visivle_learning -> c/visible_learning
    const updated = await spaceRepo.updateSubchannel('c/visivle_learning', {
      title: 'Visible Learning',
      handle: 'c/visible_learning',
      description: 'Evidenzbasierte Didaktik und Lehrforschung'
    });

    assert.ok(updated);
    assert.equal(updated?.handle, 'c/visible_learning');
    assert.equal(updated?.description, 'Evidenzbasierte Didaktik und Lehrforschung');

    // 4. Verify feedRepository items were automatically migrated
    const storedAfter = feedRepository.getAllItems().find(i => i.id === 'hattie-study-1');
    assert.equal(storedAfter?.space, 'c/visible_learning');
  });

  it('generateHivemindStream assigns the requested channel space to all generated items', async () => {
    const result = await generateHivemindStream({
      seedTopicOrQuestion: 'Visible Learning John Hattie',
      targetCount: 3,
      preferredLanguage: 'de',
      space: 'c/visible_learning'
    });

    assert.ok(result.items.length > 0);
    for (const item of result.items) {
      assert.equal(item.space, 'c/visible_learning');
      assert.ok(item.title.length > 0);
      assert.ok((item.feedText || item.body || '').length > 0);
    }
  });

  it('normalizeSpaceHandle guarantees c/ prefix and lowercase underscores', () => {
    assert.equal(normalizeSpaceHandle('visible learning'), 'c/visible_learning');
    assert.equal(normalizeSpaceHandle('c/visivle_learning'), 'c/visivle_learning');
    assert.equal(normalizeSpaceHandle('Tibetischer Buddhismus!'), 'c/tibetischer_buddhismus');
    assert.equal(normalizeSpaceHandle('c/ableton-ambient'), 'c/ableton-ambient');
  });
});
