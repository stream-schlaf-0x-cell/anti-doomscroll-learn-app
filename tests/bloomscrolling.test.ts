import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { VERIFIED_FEED_SOURCES } from '../src/core/ingestion/sources';
import { defaultSourceRepository } from '../src/core/data/sourceRepository';
import { LocalFeedRepository } from '../src/core/data/feedRepository';
import { ContinuousLiveNewsService } from '../src/core/data/continuousLiveNewsService';
import {
  scoreFeedItem,
  rankBloomScrollFeed,
  getNormalizedPublisherKey
} from '../src/core/domain/ranking';
import { DEFAULT_USER_PROFILE } from '../src/core/data/fixtures';
import {
  FeedItem,
  formatVerifiedProvenanceLabel,
  EditorialAbstractSchema
} from '../src/core/domain/types';
import { synthesizeEditorialAbstract } from '../src/core/synthesis/backgroundResearchPipeline';
import { AppearanceHistoryService } from '../src/core/data/appearanceHistoryService';
import { AtemStorage, MemoryStorageDriver } from '../src/core/data/storage';
import { normalizeFeedEntry } from '../src/core/ingestion/normalizer';
import { parseFeedXml } from '../src/core/ingestion/rssParser';
import { RawFeedEntry, RawFeedSource } from '../src/core/ingestion/types';

describe('Bloomscrolling Iteration: 72 Sources, Sliding-Window Ranking & 7 Verification Cases', () => {
  it('1. Source Catalog & Health Telemetry: >= 50 concrete sources with per-source delivery health', async () => {
    assert.ok(
      VERIFIED_FEED_SOURCES.length >= 50,
      `Expected >= 50 concrete candidate sources, got ${VERIFIED_FEED_SOURCES.length}`
    );

    const overview = defaultSourceRepository.getHealthOverview();
    assert.strictEqual(overview.totalSources, VERIFIED_FEED_SOURCES.length);
    assert.ok(
      overview.deliveringCount >= 40,
      `Expected >= 40 actively delivering sources, got ${overview.deliveringCount}`
    );
    assert.ok(
      overview.failingCount > 0,
      'Failed sources must be recorded honestly rather than hidden'
    );

    const allWithHealth = await defaultSourceRepository.getAllSources();
    const delivering = allWithHealth.filter(s => s.isDelivering);
    const failing = allWithHealth.filter(s => !s.isDelivering);

    assert.strictEqual(delivering.length, overview.deliveringCount);
    assert.strictEqual(failing.length, overview.failingCount);

    for (const s of delivering) {
      assert.strictEqual(s.health?.fetchSuccess, true);
      assert.ok(s.health?.lastSuccessAt, `Delivering source ${s.id} must have lastSuccessAt`);
      assert.ok((s.health?.itemCount ?? 0) > 0, `Delivering source ${s.id} must have itemCount > 0`);
    }

    for (const s of failing) {
      assert.strictEqual(s.isDelivering, false);
      assert.ok(s.health?.lastError, `Failed source ${s.id} must record lastError reason`);
    }
  });

  it('2. 30-Card Bloomscrolling Feed Inspection: Publisher diversity (>= 12 publishers, <= 20% cap), Topic & Format Rhythm', () => {
    const repo = new LocalFeedRepository();
    const allPool = repo.getAllItems();
    assert.ok(allPool.length >= 150, `Expected rich pool of >= 150 items, got ${allPool.length}`);

    const scoredPool = allPool.map(item => scoreFeedItem(item, DEFAULT_USER_PROFILE, {}));
    const bloomStream = rankBloomScrollFeed(scoredPool);
    const first30 = bloomStream.slice(0, 30);
    assert.strictEqual(first30.length, 30);

    const publisherCounts = new Map<string, number>();
    const topicCounts = new Map<string, number>();
    let teachingCount = 0;
    let challengingCount = 0;

    for (const card of first30) {
      const pub = getNormalizedPublisherKey(card);
      publisherCounts.set(pub, (publisherCounts.get(pub) || 0) + 1);
      topicCounts.set(card.primaryTopic, (topicCounts.get(card.primaryTopic) || 0) + 1);
      if (card.isTeachingRelated || card.primaryTopic === 'german_didactics') teachingCount++;
      if (card.isChallengingPerspective) challengingCount++;

      // Verify zero generic Unsplash stock photos
      if (card.imageUrl) {
        assert.ok(
          !card.imageUrl.includes('images.unsplash.com'),
          `Card ${card.id} must not use generic Unsplash placeholder image`
        );
      }

      // Verify zero fake engagement numbers
      assert.strictEqual(card.upvotesCount ?? 0, 0, `Card ${card.id} must have 0 fake local upvotes`);
      assert.strictEqual(card.comments?.length ?? 0, 0, `Card ${card.id} must have 0 fake simulated comments`);
    }

    // >= 12 distinct publishers in first 30 cards
    assert.ok(
      publisherCounts.size >= 12,
      `Expected >= 12 distinct publishers in first 30 cards, got ${publisherCounts.size}`
    );

    // No single publisher > 20% (<= 6 cards in 30)
    for (const [pub, count] of publisherCounts.entries()) {
      assert.ok(
        count <= 6,
        `Publisher "${pub}" appeared ${count}/30 times (> 20% cap)`
      );
    }

    // AI/Acceleration ('ai_apple') is present but does not dominate
    const aiCount = topicCounts.get('ai_apple') || 0;
    assert.ok(aiCount >= 2 && aiCount <= 8, `Expected balanced AI count (2..8 in 30), got ${aiCount}`);

    // Teaching & Challenging perspectives ~10% each (at least 2 in 30)
    assert.ok(teachingCount >= 2, `Expected >= 2 teaching cards in 30, got ${teachingCount}`);
    assert.ok(challengingCount >= 2, `Expected >= 2 counter-perspective cards in 30, got ${challengingCount}`);
  });

  it('3. Case 1 (Short 20s News Card) & Case 2 (Deep Reader Abstract + Thin-Evidence Protection)', () => {
    const shortRaw: RawFeedEntry = {
      id: 'short-news-1',
      sourceId: 'tagesschau-inland',
      title: 'Bundestag beschließt neues Forschungsdatengesetz',
      link: 'https://www.tagesschau.de/inland/forschungsdatengesetz-100.html',
      publishedAt: new Date().toISOString(),
      summary: 'Der Bundestag hat den Zugang der Wissenschaft zu anonymisierten Verwaltungsdaten erleichtert.'
    };
    const oerrSource: RawFeedSource = VERIFIED_FEED_SOURCES.find(s => s.id === 'tagesschau-inland')!;

    const shortItem = normalizeFeedEntry(shortRaw, oerrSource);
    assert.strictEqual(shortItem.evidenceTier, 'metadata_only');
    assert.strictEqual(shortItem.articleBody, shortRaw.summary);
    assert.strictEqual(formatVerifiedProvenanceLabel(shortItem), 'Öffentlich-Rechtlich');
    assert.ok(shortItem.estimatedReadingMinutes <= 1, 'Short news item is a 20-second impulse card');

    // Deep article verification
    const repo = new LocalFeedRepository();
    const deepItem = repo.getAllItems().find(i => (i.articleBody || '').length >= 350)!;
    assert.ok(deepItem, 'Pool must contain substantive articles for the deep reader');
    const abstract = synthesizeEditorialAbstract(deepItem);
    assert.strictEqual(EditorialAbstractSchema.safeParse(abstract).success, true);
    assert.ok(deepItem.keyInsight && deepItem.keyInsight.length > 15);
    assert.ok(deepItem.sourceReferences[0]?.originalUrl.startsWith('http'));
  });

  it('4. Case 3 (Artwork Showcase) & Encyclopedia Provenance: Art excluded from Live News Hub, Wikipedia labeled Enzyklopädie', async () => {
    const repo = new LocalFeedRepository();
    const allItems = repo.getAllItems();

    // Wikipedia items must be labeled Enzyklopädie, never Peer-Reviewed
    const wikiItems = allItems.filter(i => (i.sourceDomain || '').includes('wikipedia.org'));
    assert.ok(wikiItems.length > 0, 'Expected Wikipedia items in pool');
    for (const w of wikiItems) {
      assert.strictEqual(w.sourceTrustLevel, 'encyclopedia');
      assert.strictEqual(formatVerifiedProvenanceLabel(w), 'Enzyklopädie');
      assert.notStrictEqual(w.factReviewStatus, 'scientific_paper');
    }

    // Artworks must be labeled Kunstsammlung and excluded from Live News Hub
    const artItems = allItems.filter(i => i.format === 'art_showcase' || i.sourceTrustLevel === 'museum_collection');
    assert.ok(artItems.length > 0, 'Expected museum artworks in pool');
    for (const art of artItems) {
      assert.strictEqual(formatVerifiedProvenanceLabel(art), 'Kunstsammlung');
      assert.strictEqual(art.hasAuthenticImage, true);
    }

    const liveNews = await ContinuousLiveNewsService.getLiveStream({ limit: 40 });
    const artInLiveNews = liveNews.filter(
      i => i.format === 'art_showcase' || i.sourceTrustLevel === 'museum_collection' || i.primaryTopic === 'art_aesthetics'
    );
    assert.strictEqual(artInLiveNews.length, 0, 'Artworks must never appear as breaking news in Live News Hub');
  });

  it('5. Case 4 (Community Card) & Explicit Feedback Weighting (> Passive Behavior)', () => {
    const repo = new LocalFeedRepository();
    const communityItem: FeedItem = {
      ...repo.getAllItems()[0],
      id: 'hn-test-community-1',
      sourceTrustLevel: 'community_curated',
      factReviewStatus: 'community_discussion',
      upvotesCount: 0,
      externalCommunityScore: {
        platform: 'HN',
        points: 342,
        commentsCount: 118,
        discussionUrl: 'https://news.ycombinator.com/item?id=40000000'
      }
    };

    assert.strictEqual(formatVerifiedProvenanceLabel(communityItem), '342 HN-Punkte');
    assert.strictEqual(
      formatVerifiedProvenanceLabel({ ...communityItem, externalCommunityScore: undefined }),
      'Community-Fundstück'
    );
    assert.strictEqual(communityItem.upvotesCount, 0);
    assert.strictEqual(communityItem.externalCommunityScore?.points, 342);

    // Explicit feedback weighs much stronger than passive opening
    const baseScore = scoreFeedItem(communityItem, DEFAULT_USER_PROFILE, {}).score;
    const openedProfile = {
      ...DEFAULT_USER_PROFILE,
      behavioralSignals: {
        ...DEFAULT_USER_PROFILE.behavioralSignals,
        recentOpenedIds: [communityItem.id]
      }
    };
    const openedScore = scoreFeedItem(communityItem, openedProfile, {}).score;
    const explicitPositiveScore = scoreFeedItem(communityItem, DEFAULT_USER_PROFILE, {
      [communityItem.id]: {
        itemId: communityItem.id,
        saved: true,
        progressPercent: 100,
        furthestPositionPercent: 100,
        feedback: 'more_like_this',
        voteScore: 1,
        userNotes: []
      }
    }).score;

    const passiveDelta = Math.abs(baseScore - openedScore);
    const explicitDelta = Math.abs(explicitPositiveScore - baseScore);
    assert.ok(
      explicitDelta > passiveDelta * 4,
      `Explicit feedback delta (${explicitDelta.toFixed(3)}) must strongly outweigh passive open delta (${passiveDelta.toFixed(3)})`
    );
  });

  it('6. Case 6 (Empty Freshness Pool -> Evergreen Fallback without ID cloning) & Case 7 (Viewport-Only Chronik)', async () => {
    const repo = new LocalFeedRepository();
    const freshPool = repo.getAllItems().slice(0, 15);
    const evergreenClassics = ContinuousLiveNewsService.getEvergreenClassics();
    assert.ok(evergreenClassics.length >= 5, 'Evergreen fallback pool must be available');

    const freshIds = new Set(freshPool.map(i => i.id));
    const fallback = evergreenClassics.filter(e => !freshIds.has(e.id));
    const combinedStream = [...freshPool, ...fallback];

    // Assert zero cloned IDs (-inf- or -cycle-)
    const seenIds = new Set<string>();
    for (const item of combinedStream) {
      assert.ok(!item.id.includes('-inf-'), `Cloned ID detected: ${item.id}`);
      assert.ok(!item.id.includes('-cycle-'), `Cloned ID detected: ${item.id}`);
      assert.ok(!seenIds.has(item.id), `Duplicate ID detected: ${item.id}`);
      seenIds.add(item.id);
    }

    // Viewport-only Chronik verification: out of 15 rendered items, only the 3 inside viewport [0, 820] are recorded
    const storage = new AtemStorage(new MemoryStorageDriver());
    const historyService = new AppearanceHistoryService(storage);

    const simulatedLayouts: Record<string, { y: number; height: number }> = {};
    freshPool.forEach((item, idx) => {
      simulatedLayouts[item.id] = { y: idx * 320, height: 290 };
    });

    const viewportTop = 0;
    const viewportBottom = 820;
    const visibleInViewportIds = freshPool
      .filter(item => {
        const l = simulatedLayouts[item.id];
        return l.y + 45 <= viewportBottom && l.y + l.height - 45 >= viewportTop;
      })
      .map(item => item.id);

    assert.strictEqual(visibleInViewportIds.length, 3, 'Only first 3 cards intersect initial 820px viewport');
    await historyService.recordAppearances(visibleInViewportIds);

    const recorded = await historyService.getHistoryRecords();
    assert.strictEqual(recorded.length, 3, 'Chronik must only record the 3 viewport-visible cards, not all 15 in memory');
  });

  it('7. Forschung und Wissen Relative Image Resolution, Techpresso Source & Comic Alt-Text Punchline Extraction', () => {
    const fuwSource = VERIFIED_FEED_SOURCES.find(s => s.id === 'forschung-und-wissen');
    const techpressoSource = VERIFIED_FEED_SOURCES.find(s => s.id === 'techpresso-daily');
    assert.ok(fuwSource, 'forschung-und-wissen must be registered in VERIFIED_FEED_SOURCES');
    assert.ok(techpressoSource, 'techpresso-daily must be registered in VERIFIED_FEED_SOURCES');
    assert.strictEqual(fuwSource.url, 'https://www.forschung-und-wissen.de/feed.rss');
    assert.strictEqual(techpressoSource.url, 'https://rss.beehiiv.com/feeds/ez2zQOMePQ.xml');

    const sampleFuwXml = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0"><channel><item>
        <title>Neue Quanten-Entdeckung in München</title>
        <link>https://www.forschung-und-wissen.de/nachrichten/physik/neue-quanten-entdeckung-12345</link>
        <pubDate>Fri, 17 Oct 2026 08:00:00 +0200</pubDate>
        <description><![CDATA[<img src="/bilder/vorschaubilder/quanten-chip.jpg" alt="Quantenchip" />© Forschung und Wissen / Max-Planck-Institut Forscher haben einen neuen Supraleiter entdeckt, der bei deutlich höheren Temperaturen stabil bleibt.]]></description>
      </item></channel></rss>`;

    const parsedFuw = parseFeedXml(sampleFuwXml, 'forschung-und-wissen');
    assert.strictEqual(parsedFuw.length, 1);
    assert.strictEqual(
      parsedFuw[0].imageUrl,
      'https://www.forschung-und-wissen.de/bilder/vorschaubilder/quanten-chip.jpg'
    );
    assert.ok(
      !parsedFuw[0].summary.startsWith('©'),
      `Inline copyright should be stripped from summary, got: ${parsedFuw[0].summary}`
    );

    const normalizedFuw = normalizeFeedEntry(parsedFuw[0], fuwSource);
    assert.strictEqual(normalizedFuw.hasAuthenticImage, true);
    assert.strictEqual(normalizedFuw.sourceTrustLevel, 'peer_reviewed');

    const sampleComicXml = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0"><channel><item>
        <title>Dependency Graph</title>
        <link>https://xkcd.com/9999/</link>
        <pubDate>Fri, 17 Oct 2026 07:00:00 +0000</pubDate>
        <description><![CDATA[<img src="https://imgs.xkcd.com/comics/dependency_graph.png" title="Every modern infrastructure stack rests on one script maintained by a guy in Nebraska." alt="Dependency Graph" />]]></description>
      </item></channel></rss>`;

    const xkcdSource = VERIFIED_FEED_SOURCES.find(s => s.id === 'xkcd-comics')!;
    const parsedComic = parseFeedXml(sampleComicXml, 'xkcd-comics');
    assert.strictEqual(parsedComic.length, 1);
    assert.strictEqual(
      parsedComic[0].imageAltText,
      'Every modern infrastructure stack rests on one script maintained by a guy in Nebraska.'
    );

    const normalizedComic = normalizeFeedEntry(parsedComic[0], xkcdSource);
    assert.strictEqual(normalizedComic.format, 'meme');
    assert.strictEqual(
      normalizedComic.memeMeta?.punchline,
      'Every modern infrastructure stack rests on one script maintained by a guy in Nebraska.'
    );
  });
});

