import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TOPIC_DIALECTICS } from '../src/core/synthesis/dialecticTemplates';
import { TopicTag, TOPIC_SPACE_MAP } from '../src/core/domain/types';
import { RawFeedEntry, RawFeedSource } from '../src/core/ingestion/types';
import { synthesizeDeepeningArticle } from '../src/core/synthesis/backgroundResearchPipeline';
import { pureJsSha256, normalizeFeedEntry } from '../src/core/ingestion/normalizer';
import { ContinuousLiveNewsService } from '../src/core/data/continuousLiveNewsService';
import { INITIAL_FIXTURES } from '../src/core/data/fixtures';
import { feedRepository } from '../src/core/data/feedRepository';

describe('Master Execution Plan: Editorial Depth, Authentic Community & Provenance', () => {
  it('1. TOPIC_DIALECTICS covers all 11 topics with unique, domain-specific arguments', () => {
    const allTopics = Object.keys(TOPIC_SPACE_MAP) as TopicTag[];
    assert.strictEqual(allTopics.length, 11);

    const seenInsights = new Set<string>();
    const seenCounters = new Set<string>();

    for (const topic of allTopics) {
      const d = TOPIC_DIALECTICS[topic];
      assert.ok(d, `Dialectic entry missing for topic: ${topic}`);
      assert.ok(d.title.length > 15, `Title too short for topic: ${topic}`);
      assert.ok(d.feedText.length > 20, `feedText too short for topic: ${topic}`);
      assert.ok(d.articleBody.length > 50, `articleBody too short for topic: ${topic}`);
      assert.ok(d.keyInsight.length > 20, `keyInsight too short for topic: ${topic}`);
      assert.ok(d.counterPerspective.length > 20, `counterPerspective too short for topic: ${topic}`);
      assert.ok(d.challengePrompt.length > 20, `challengePrompt too short for topic: ${topic}`);
      assert.ok(d.actionableTransfer.length > 20, `actionableTransfer too short for topic: ${topic}`);

      // Ensure no generic duplicate templates across topics
      assert.ok(!seenInsights.has(d.keyInsight), `Duplicate keyInsight detected: ${d.keyInsight}`);
      assert.ok(!seenCounters.has(d.counterPerspective), `Duplicate counterPerspective detected: ${d.counterPerspective}`);
      seenInsights.add(d.keyInsight);
      seenCounters.add(d.counterPerspective);
    }
  });

  it('2. synthesizeDeepeningArticle structures articles with 4 substantive subheadings', () => {
    const summary = 'Künstliche Intelligenz verändert Schulen und Lehre grundlegend.';
    const article = synthesizeDeepeningArticle({
      title: 'KI im Deutschunterricht',
      summary,
      topic: 'german_didactics',
      sourceName: 'Didaktik Forum'
    });

    assert.ok(article.includes('### Worum es geht'));
    assert.ok(article.includes('### Warum das wichtig ist'));
    assert.ok(article.includes('### Die Gegenperspektive'));
    assert.ok(article.includes('### Zum Weiterdenken & Ausprobieren'));
    assert.ok(article.length > summary.length * 2);
  });

  it('3. pureJsSha256 generates exact 64-char hex SHA-256 digests without Node builtins', () => {
    const input = 'atmen anti-doomscroll pure js hashing test';
    const hash = pureJsSha256(input);
    assert.strictEqual(hash.length, 64);
    assert.match(hash, /^[0-9a-f]{64}$/);

    // Verify determinism
    const hash2 = pureJsSha256(input);
    assert.strictEqual(hash, hash2);

    // Verify change sensitivity
    const hash3 = pureJsSha256(input + '!');
    assert.notStrictEqual(hash, hash3);
  });

  it('4. normalizeFeedEntry preserves faithful source text without fake boilerplate inflation', () => {
    const raw: RawFeedEntry = {
      id: 'entry-test-01',
      title: 'Neuer Durchbruch in der Fusionsforschung',
      link: 'https://science.example.com/fusion-breakthrough',
      summary: 'Wissenschaftler am National Ignition Facility erreichen einen Netto-Energiegewinn im Plasma. Die Laserfusion erzeugte mehr Fusionsenergie als die eingestrahlte Energie.',
      publishedAt: '2026-10-15T12:00:00Z',
      sourceId: 'science-source'
    };

    const source: RawFeedSource = {
      id: 'science-source',
      name: 'Science Daily',
      url: 'https://science.example.com/feed',
      primaryTopic: 'science_society',
      topics: ['science_society'],
      defaultEvidenceTier: 'publisher_excerpt',
      language: 'de'
    };

    const item = normalizeFeedEntry(raw, source);
    assert.ok(item.articleBody);
    // Verbatim fidelity: articleBody contains the exact honest source text without fake boilerplate
    assert.strictEqual(item.articleBody, raw.summary);
    assert.strictEqual(item.evidenceTier, 'publisher_excerpt');
    assert.strictEqual(item.factReviewStatus, 'curated_illustrative');
    // Knowledge cross-references are attached separately, not injected into articleBody
    assert.ok(Array.isArray(item.relatedCrossReferences));
    assert.ok(item.relatedCrossReferences.length > 0);

    // Ultra-short snippet (< 120 chars) accurately classified as metadata_only
    const shortRaw: RawFeedEntry = { ...raw, summary: 'Kurzer Ticker-Satz.' };
    const shortItem = normalizeFeedEntry(shortRaw, source);
    assert.strictEqual(shortItem.evidenceTier, 'metadata_only');
    assert.strictEqual(shortItem.articleBody, 'Kurzer Ticker-Satz.');
  });

  it('5. ContinuousLiveNewsService fetches live feeds with timeout safety and fallback', async () => {
    const items = await ContinuousLiveNewsService.refreshLiveFeeds();
    assert.ok(Array.isArray(items));
    assert.ok(items.length > 0);

    // Items must have schema-valid properties
    const first = items[0];
    assert.ok(first.id);
    assert.ok(first.title);
    assert.ok(first.space);
  });

  it('6. Fixtures and initial feeds start with authentic community scores (0 upvotes)', () => {
    // Assert all fixtures have upvotesCount 0 and authentic community comments
    for (const item of INITIAL_FIXTURES) {
      assert.strictEqual(item.upvotesCount, 0, `Item ${item.id} should have authentic 0 upvotesCount`);
      if (item.comments && item.comments.length > 0) {
        for (const c of item.comments) {
          assert.strictEqual(c.score, 0, `Comment ${c.id} should have authentic 0 score`);
        }
      }
    }

    // Repository getAllItems initializes items with authentic 0 votes
    const stream = feedRepository.getAllItems();
    assert.ok(stream.length > 0);
    for (const item of stream.slice(0, 20)) {
      assert.strictEqual(item.upvotesCount, 0, `Repo item ${item.id} should have authentic 0 upvotesCount`);
    }
  });
});
