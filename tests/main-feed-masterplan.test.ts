import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  FeedItem,
  FeedItemSchema
} from '../src/core/domain/types';
import {
  ScoredFeedItem,
  ScoreBreakdown,
  formatPersonalVoteLabel,
  getEffectiveSpaceHandle,
  isAggregatorItem,
  isDailyDigestNewsletter,
  enforceCuratedStreamDiversity,
  sortFeedForDisplay
} from '../src/core/domain/ranking';
import {
  classifyTopicDeterministically,
  sanitizeCuratedFeedItem,
  satisfiesDefaultCuratedStandard,
  isIncomprehensibleWetLabPaper
} from '../src/core/enrichment/batchEnricher';
import { stripHtml, parseFeedXml } from '../src/core/ingestion/rssParser';
import { normalizeFeedEntry } from '../src/core/ingestion/normalizer';
import {
  buildSubstantiveHackerNewsCopy,
  isEditorialQualityHackerNewsStory
} from '../src/core/data/continuousLiveNewsService';
import { isLikelyBannerOrLogoUrl } from '../src/core/utils/imageQuality';
import { RawFeedEntry, RawFeedSource } from '../src/core/ingestion/types';

function makeSourceRef(title: string, publisher: string, url: string, ts = new Date().toISOString()) {
  return {
    title,
    publisher,
    originalUrl: url,
    publicationTimestamp: ts,
    retrievalTimestamp: ts,
    isVerified: true
  };
}

function makeTestItem(overrides: Partial<FeedItem> & { id: string; title: string }): FeedItem {
  const nowIso = new Date().toISOString();
  return FeedItemSchema.parse({
    subtitle: '',
    feedText:
      'Eine substanzielle, gut belegte Analyse zu Philosophie, Wissenschaft und gesellschaftlichen Entwicklungen mit klaren Perspektiven.',
    articleBody:
      'Eine substanzielle, gut belegte Analyse zu Philosophie, Wissenschaft und gesellschaftlichen Entwicklungen mit klaren Perspektiven, empirischen Befunden und historischem Kontext über mehrere Absätze.',
    body:
      'Eine substanzielle, gut belegte Analyse zu Philosophie, Wissenschaft und gesellschaftlichen Entwicklungen mit klaren Perspektiven.',
    keyInsight: 'Fundierte Einordnung der zentralen Thesen und empirischen Befunde.',
    format: 'concise_insight',
    type: 'deep_dive',
    primaryTopic: 'philosophy_ethics',
    topics: ['philosophy_ethics'],
    space: 'c/dialektik',
    publishedAt: nowIso,
    generatedAt: nowIso,
    relevanceExplanation: 'Themenrelevanz für fundierte Lektüre.',
    contentStatus: 'editorial_briefing',
    editionDate: nowIso.slice(0, 10),
    provenanceSummary: 'Redaktionell kuratiert',
    sourceTrustLevel: 'deep_essay',
    sourceDomain: 'example-journal.org',
    sourceReferences: [
      makeSourceRef(overrides.title, 'Example Journal', `https://example-journal.org/${overrides.id}`)
    ],
    evidenceTier: 'publisher_excerpt',
    wordCount: 220,
    estimatedReadingMinutes: 4,
    curationScore: 8.2,
    upvotesCount: 0,
    ...overrides
  });
}

function makeScoredTestItem(overrides: Partial<FeedItem> & { id: string; title: string; score?: number }): ScoredFeedItem {
  const { score, ...rest } = overrides;
  const finalScore = score ?? 0.82;
  const scoreBreakdown: ScoreBreakdown = {
    topicMatch: 0.8,
    topicAffinity: 0.8,
    goalAlignment: 0.6,
    readingTimeFit: 0.8,
    durationMatch: 0.8,
    freshness: 0.9,
    editorialValue: 0.9,
    depthBonus: 0.5,
    serendipity: 0.2,
    feedbackAdjustment: 0,
    behavioralAdjustment: 0,
    authorBoost: 0,
    totalScore: finalScore,
    explanation: 'Test Fixture',
    primaryReason: 'Themenrelevanz',
    secondaryReason: 'Kuratiert',
    whyFactors: ['Test']
  };
  return {
    ...makeTestItem(rest),
    score: finalScore,
    scoreBreakdown
  };
}

describe('Main Feed Masterplan: Clean Parsing, Honest Channels, Choreography & Zero Fake Metrics', () => {
  it('1. Strips Beehiiv CSS gibberish, In today\'s newsletter preambles & rejects Techpresso banner logos', () => {
    const dirtyHtml = `
      <style>.bh__table, .bh__table_header, .bh__table_cell { border: 1px solid #C0C0C0; }</style>
      <p>.bh__table_cell { padding: 2px; background-color: #FFFFFF; } In today's newsletter: Apple bans AI 'nudify' apps while OpenAI opens enterprise reasoning APIs for developers.</p>
    `;
    const cleanText = stripHtml(dirtyHtml);
    assert.ok(!cleanText.includes('.bh__table'), 'stripHtml must remove .bh__table CSS rules');
    assert.ok(!cleanText.includes('{ border:'), 'stripHtml must remove inline CSS rule blocks');
    assert.ok(!cleanText.toLowerCase().includes("in today's newsletter"), 'stripHtml must remove newsletter preamble');
    assert.ok(cleanText.includes("Apple bans AI 'nudify' apps"), 'stripHtml must preserve article summary text');

    const rssXml = `<?xml version="1.0" encoding="UTF-8" ?>
      <rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
        <channel>
          <title>Techpresso</title>
          <item>
            <guid>tp-xml-1</guid>
            <title>Apple bans AI 'nudify' apps</title>
            <link>https://techpresso.dupple.com/p/apple-bans</link>
            <pubDate>Fri, 13 Nov 2026 08:00:00 GMT</pubDate>
            <description><![CDATA[
              <img src="https://media.beehiiv.com/uploads/asset/techpresso_banner_header.png" width="1200" height="180" />
              <img src="https://cdn.example-tech.com/articles/apple-policy-photo.jpg" width="960" height="540" />
              <p>.bh__table_cell { padding: 2px; background-color: #FFFFFF; } In today's newsletter: Apple bans AI 'nudify' apps across iOS.</p>
            ]]></description>
          </item>
        </channel>
      </rss>`;
    const parsedEntries = parseFeedXml(rssXml, 'techpresso-daily');
    assert.strictEqual(parsedEntries.length, 1);
    assert.strictEqual(
      parsedEntries[0].imageUrl,
      'https://cdn.example-tech.com/articles/apple-policy-photo.jpg',
      'parseFeedXml must skip Beehiiv banner/header logo and select article photo'
    );
    assert.strictEqual(
      isLikelyBannerOrLogoUrl('https://media.beehiiv.com/uploads/techpresso_logo.png', 'Techpresso (Daily AI & Tech Digest)'),
      true
    );

    const source: RawFeedSource = {
      id: 'techpresso-daily',
      name: 'Techpresso (Daily AI & Tech Digest)',
      url: 'https://rss.beehiiv.com/feeds/ez2zQOMePQ.xml',
      primaryTopic: 'ai_apple',
      topics: ['ai_apple', 'science_society'],
      defaultEvidenceTier: 'publisher_excerpt',
      defaultAuthor: 'Dupple Techpresso',
      language: 'en'
    };
    const rawEntry: RawFeedEntry = {
      id: 'techpresso-entry-1',
      sourceId: 'techpresso-daily',
      title: "Apple bans AI 'nudify' apps",
      link: 'https://techpresso.dupple.com/p/apple-bans-ai-nudify',
      publishedAt: new Date().toISOString(),
      summary: ".bh__table, .bh__table_header { border: 1px solid #C0C0C0; } In today's newsletter: Apple bans AI 'nudify' apps and tightens App Store review guidelines worldwide.",
      fullContent: "In today's newsletter: Apple bans AI 'nudify' apps and tightens App Store review guidelines for synthetic imagery across developer accounts.",
      imageUrl: 'https://media.beehiiv.com/uploads/techpresso_logo.png'
    };
    const normalized = normalizeFeedEntry(rawEntry, source);
    assert.ok(normalized, 'Techpresso entry with valid summary after preamble must normalize');
    assert.ok(!normalized.subtitle.includes('.bh__table'), 'normalized subtitle must contain no .bh__table');
    assert.strictEqual(normalized.imageUrl, undefined, 'normalized Techpresso banner URL must be suppressed');

    const sanitized = sanitizeCuratedFeedItem(
      makeTestItem({
        id: 'techpresso-cached-bug',
        title: "☕️ Apple bans AI 'nudify' apps",
        subtitle: '.bh__table, .bh__table_header { border: 1px solid #C0C0C0; }',
        feedText: "In today's newsletter: Apple bans harmful deepfake utilities across iOS and macOS platforms.",
        articleBody: "In today's newsletter: Apple bans harmful deepfake utilities across iOS and macOS platforms worldwide with stricter review checks.",
        keyInsight: "🍎 Apple bans AI 'nudify' apps...",
        imageUrl: 'https://media.beehiiv.com/uploads/techpresso_banner.png',
        hasAuthenticImage: true,
        primaryTopic: 'ai_apple',
        space: 'c/acceleration',
        sourceReferences: [
          makeSourceRef("Apple bans AI 'nudify' apps", 'Techpresso (Daily AI & Tech Digest)', 'https://techpresso.dupple.com/p/test')
        ]
      })
    );
    assert.ok(!sanitized.subtitle.includes('.bh__table'), 'sanitized subtitle must have zero CSS');
    assert.ok(!sanitized.feedText.toLowerCase().includes("in today's newsletter"), 'sanitized feedText must strip newsletter preamble');
    assert.strictEqual(sanitized.keyInsight, '', 'digest newsletters should not show noisy keyInsight');
    assert.strictEqual(sanitized.hasAuthenticImage, false, 'Techpresso banner image must be suppressed');
    assert.strictEqual(sanitized.imageUrl, undefined, 'Techpresso banner URL must be cleared');
  });

  it('2. Never misroutes HN software/cell/protein titles to c/kontemplation while preserving genuine Buddhist/wisdom items', () => {
    assert.notStrictEqual(
      classifyTopicDeterministically('Ggml v1.0.0', 'Aktuelle Analyse bei github.com', 'ai_apple'),
      'contemplation_mind'
    );
    assert.notStrictEqual(
      classifyTopicDeterministically("Terminal borders that don't cost a cell", 'Rendering TUI frames fast in Rust', 'ai_apple'),
      'contemplation_mind'
    );
    assert.notStrictEqual(
      classifyTopicDeterministically('Found: A protein that drives ageing without unleashing inflammation', 'nature.com', 'science_society'),
      'contemplation_mind'
    );
    assert.notStrictEqual(
      classifyTopicDeterministically('AMD Zen 5 Architecture and Micro-Op Cache Analysis', 'Hardware engineering deep dive', 'ai_apple'),
      'contemplation_mind'
    );

    assert.strictEqual(
      classifyTopicDeterministically(
        'Vipassana Meditation and Mindfulness in the Pali Canon',
        'A contemplative look at Buddhist ethics and sangha practice in everyday life.',
        'philosophy_ethics'
      ),
      'contemplation_mind'
    );

    const legacyMisroutedHn = sanitizeCuratedFeedItem(
      makeTestItem({
        id: 'openweb-hn-99999',
        title: "Terminal borders that don't cost a cell",
        feedText: 'Originalbeitrag bei joshka.net zum Thema „Terminal borders“. Der Fokus liegt auf den strukturellen Hintergründen.',
        primaryTopic: 'contemplation_mind',
        space: 'c/kontemplation',
        sourceReferences: [
          makeSourceRef("Terminal borders that don't cost a cell", 'joshka.net (HN)', 'https://joshka.net/post')
        ]
      })
    );
    assert.notStrictEqual(legacyMisroutedHn.space, 'c/kontemplation', 'legacy misrouted HN item must escape c/kontemplation');
    assert.ok(!legacyMisroutedHn.feedText.includes('Originalbeitrag bei'), 'legacy boilerplate must be stripped');
    assert.ok(!legacyMisroutedHn.feedText.includes('Der Fokus liegt auf'), 'legacy Fokus sentence must be stripped');
  });

  it('3. Filters cryptic HN release stubs & incomprehensible wet-lab protein papers, and avoids robotic HN boilerplate', () => {
    assert.strictEqual(isEditorialQualityHackerNewsStory('Ggml v1.0.0', 'github.com'), false);
    assert.strictEqual(isEditorialQualityHackerNewsStory("Terminal borders that don't cost a cell", 'joshka.net'), false);
    assert.strictEqual(
      isEditorialQualityHackerNewsStory('Found: A protein that drives ageing without unleashing inflammation', 'nature.com'),
      false
    );
    assert.strictEqual(
      isEditorialQualityHackerNewsStory('Tracing Interpretability Circuits in Modern Open-Weight Transformers', 'transformer-circuits.pub'),
      true
    );

    const hnCopy = buildSubstantiveHackerNewsCopy({
      title: 'Tracing Interpretability Circuits in Modern Open-Weight Transformers',
      domain: 'transformer-circuits.pub',
      targetUrl: 'https://transformer-circuits.pub/2026/circuits',
      hnUrl: 'https://news.ycombinator.com/item?id=42000',
      points: 240,
      commentsCount: 84
    });
    assert.ok(hnCopy.feedText.length >= 160, 'HN copy must stay >= 160 chars');
    assert.ok(hnCopy.articleBody.length >= 260, 'HN articleBody must stay >= 260 chars');
    assert.ok(!hnCopy.feedText.includes('Originalbeitrag bei'), 'HN copy must not use "Originalbeitrag bei" template');
    assert.ok(!hnCopy.feedText.includes('Der Fokus liegt auf'), 'HN copy must not use "Der Fokus liegt auf" template');

    const wetLabLongevityItem = makeTestItem({
      id: 'wetlab-protein-1',
      title: 'Found: A protein that drives ageing without unleashing inflammation in murine IL-11 pathways',
      feedText:
        'A dense molecular biology assay studying interleukin-11 signalling pathway knockdown and lipid droplets in Saccharomyces cerevisiae models.',
      primaryTopic: 'health_biohacking',
      space: 'c/health_longevity'
    });
    assert.strictEqual(isIncomprehensibleWetLabPaper(wetLabLongevityItem.title, wetLabLongevityItem.feedText), true);
    assert.strictEqual(satisfiesDefaultCuratedStandard(wetLabLongevityItem), false);

    const practicalHealthItem = makeTestItem({
      id: 'practical-sleep-1',
      title: 'Warum tiefer Schlaf, Nasenatmung und Tageslicht unsere Regenerationsfähigkeit steuern',
      feedText:
        'Neue Erkenntnisse zur Schlafarchitektur zeigen, wie regelmäßige Lichtexposition am Morgen und ruhige Nasenatmung am Abend die Erholung im Alltag spürbar verbessern.',
      primaryTopic: 'health_biohacking',
      space: 'c/health_longevity'
    });
    assert.strictEqual(satisfiesDefaultCuratedStandard(practicalHealthItem), true);
  });

  it('4. Personal Vote Pill never renders fake or external community upvote numbers', () => {
    assert.strictEqual(formatPersonalVoteLabel(0), 'Vote');
    assert.strictEqual(formatPersonalVoteLabel(1), '+1');
    assert.strictEqual(formatPersonalVoteLabel(-1), '-1');

    const feedCardSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/ui/components/FeedCard.tsx'),
      'utf8'
    );
    assert.ok(feedCardSource.includes('formatPersonalVoteLabel(voteScore)'), 'FeedCard must use formatPersonalVoteLabel(voteScore)');
    assert.ok(
      !feedCardSource.includes('item.externalCommunityScore.points + voteScore'),
      'FeedCard must not render externalCommunityScore points inside the personal Vote pill'
    );
  });

  it('5. Enforces main-feed choreography: max 1 newest Techpresso issue, zero consecutive spaces, spaced aggregators, while keeping single-channel views intact', () => {
    const now = Date.now();
    const hoursAgo = (h: number) => new Date(now - h * 3600 * 1000).toISOString();
    const daysAgo = (d: number) => new Date(now - d * 24 * 3600 * 1000).toISOString();

    const pool: ScoredFeedItem[] = [
      makeScoredTestItem({
        id: 'techpresso-newest',
        title: 'Techpresso Heute: Apple Intelligence & Local Models',
        space: 'c/acceleration',
        primaryTopic: 'ai_apple',
        sourceDomain: 'techpresso.dupple.com',
        publishedAt: hoursAgo(2),
        sourceReferences: [makeSourceRef('TP', 'Techpresso (Daily AI & Tech Digest)', 'https://tp.example/1', hoursAgo(2))],
        score: 0.99
      }),
      makeScoredTestItem({
        id: 'techpresso-yesterday',
        title: 'Techpresso Gestern: Chip-Allianzen',
        space: 'c/acceleration',
        primaryTopic: 'ai_apple',
        sourceDomain: 'techpresso.dupple.com',
        publishedAt: hoursAgo(28),
        sourceReferences: [makeSourceRef('TP2', 'Techpresso (Daily AI & Tech Digest)', 'https://tp.example/2', hoursAgo(28))],
        score: 0.98
      }),
      makeScoredTestItem({
        id: 'techpresso-oct17',
        title: 'Techpresso Altes Archiv vom Oktober',
        space: 'c/acceleration',
        primaryTopic: 'ai_apple',
        sourceDomain: 'techpresso.dupple.com',
        publishedAt: daysAgo(28),
        sourceReferences: [makeSourceRef('TP3', 'Techpresso (Daily AI & Tech Digest)', 'https://tp.example/3', daysAgo(28))],
        score: 0.97
      }),
      makeScoredTestItem({ id: 'hn-1', title: 'Tracing Interpretability Circuits in Open-Weight Models', space: 'c/acceleration', primaryTopic: 'ai_apple', sourceDomain: 'circuits.org', sourceReferences: [makeSourceRef('HN1', 'circuits.org (HN)', 'https://circuits.org/1', hoursAgo(4))], score: 0.95 }),
      makeScoredTestItem({ id: 'hn-2', title: 'Formal Verification of Distributed Consensus Protocols', space: 'c/dialektik', primaryTopic: 'philosophy_ethics', sourceDomain: 'formal.org', sourceReferences: [makeSourceRef('HN2', 'formal.org (HN)', 'https://formal.org/2', hoursAgo(5))], score: 0.94 }),
      makeScoredTestItem({ id: 'hn-3', title: 'Economic History of European Railway Timetables', space: 'c/serendipity', primaryTopic: 'science_society', sourceDomain: 'history.org', sourceReferences: [makeSourceRef('HN3', 'history.org (HN)', 'https://history.org/3', hoursAgo(6))], score: 0.93 }),
      makeScoredTestItem({ id: 'kont-1', title: 'Buddhist Mindfulness in Secular Classrooms', space: 'c/kontemplation', primaryTopic: 'contemplation_mind', sourceDomain: 'tricycle.org', score: 0.92 }),
      makeScoredTestItem({ id: 'kont-2', title: 'Silent Sitting and Compassion Training in Zen Traditions', space: 'c/kontemplation', primaryTopic: 'contemplation_mind', sourceDomain: 'lionsroar.com', score: 0.91 }),
      makeScoredTestItem({ id: 'kont-3', title: 'Thich Nhat Hanh on Interbeing and Deep Listening', space: 'c/kontemplation', primaryTopic: 'contemplation_mind', sourceDomain: 'plumvillage.org', score: 0.90 }),
      makeScoredTestItem({ id: 'did-1', title: 'Sokrates-Seminare im Ethikunterricht der Oberstufe', space: 'c/didaktik_labor', primaryTopic: 'german_didactics', isTeachingRelated: true, sourceDomain: 'didaktik.de', score: 0.89 }),
      makeScoredTestItem({ id: 'health-1', title: 'Schlafdruck, Adenosin und erholsame Morgenroutinen', space: 'c/health_longevity', primaryTopic: 'health_biohacking', sourceDomain: 'health-science.de', score: 0.88 }),
      makeScoredTestItem({ id: 'synth-1', title: 'Buchla West-Coast Synthesis and Harmonic Folded Waves', space: 'c/synth_alchemie', primaryTopic: 'sound_synthesis', sourceDomain: 'soundonsound.com', score: 0.87 }),
      makeScoredTestItem({ id: 'dial-1', title: 'Kants kategorischer Imperativ im Zeitalter autonomer Systeme', space: 'c/dialektik', primaryTopic: 'philosophy_ethics', isChallengingPerspective: true, sourceDomain: 'zeitschrift-ethik.de', score: 0.86 }),
      makeScoredTestItem({ id: 'ser-1', title: 'Wie Städte durch Entsiegelung im Sommer abkühlen', space: 'c/serendipity', primaryTopic: 'science_society', sourceDomain: 'spektrum.de', score: 0.85 })
    ];

    const ranked = sortFeedForDisplay(pool, 'for_you');
    const techpressoItems = ranked.filter(isDailyDigestNewsletter);
    assert.strictEqual(techpressoItems.length, 1, 'for_you feed must keep at most 1 daily digest newsletter issue');
    assert.strictEqual(techpressoItems[0].id, 'techpresso-newest', 'for_you feed must keep only the newest Techpresso issue');

    for (let i = 1; i < ranked.length; i++) {
      assert.notStrictEqual(
        getEffectiveSpaceHandle(ranked[i]),
        getEffectiveSpaceHandle(ranked[i - 1]),
        `Consecutive items at index ${i - 1} and ${i} must never share space (${getEffectiveSpaceHandle(ranked[i])})`
      );
    }

    const aggIndices = ranked
      .map((item, idx) => (isAggregatorItem(item) ? idx : -1))
      .filter(idx => idx !== -1);
    for (let i = 1; i < aggIndices.length; i++) {
      assert.ok(
        aggIndices[i] - aggIndices[i - 1] >= 4,
        `Aggregators at indices ${aggIndices[i - 1]} and ${aggIndices[i]} must be separated by >= 3 intervening cards`
      );
    }

    // Single-channel view must preserve all cards even though they share one space
    const singleChannel: ScoredFeedItem[] = [
      makeScoredTestItem({ id: 'sc-1', title: 'Zen Sutra Essay 1', space: 'c/kontemplation', primaryTopic: 'contemplation_mind', sourceDomain: 'tricycle.org' }),
      makeScoredTestItem({ id: 'sc-2', title: 'Vipassana Breathwork 2', space: 'c/kontemplation', primaryTopic: 'contemplation_mind', sourceDomain: 'lionsroar.com' }),
      makeScoredTestItem({ id: 'sc-3', title: 'Buddhistdoor Dharma 3', space: 'c/kontemplation', primaryTopic: 'contemplation_mind', sourceDomain: 'buddhistdoor.net' }),
      makeScoredTestItem({ id: 'sc-4', title: 'Plum Village Bell 4', space: 'c/kontemplation', primaryTopic: 'contemplation_mind', sourceDomain: 'plumvillage.org' })
    ];
    const singleOut = enforceCuratedStreamDiversity(singleChannel);
    assert.strictEqual(singleOut.length, 4, 'Single-space channel filter must keep all cards instead of dropping');
  });

  it('6. Bundled pipeline-output.json and public/feed-snapshot.json contain zero legacy CSS/HN-slop bugs', () => {
    const pipelinePath = path.resolve(process.cwd(), 'src/core/data/pipeline-output.json');
    const snapshotPath = path.resolve(process.cwd(), 'public/feed-snapshot.json');

    const checkItems = (label: string, items: FeedItem[]) => {
      assert.ok(items.length > 0, `${label} must not be empty`);
      let techpressoCount = 0;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const joined = `${item.title || ''} ${item.subtitle || ''} ${item.feedText || ''} ${item.keyInsight || ''}`;
        assert.ok(!joined.includes('.bh__table'), `${label} item ${item.id} still contains .bh__table`);
        assert.ok(!joined.includes('{ border:'), `${label} item ${item.id} still contains "{ border:" CSS`);
        assert.ok(!joined.toLowerCase().includes("in today's newsletter:"), `${label} item ${item.id} still contains "In today's newsletter:"`);
        assert.ok(!joined.includes('Originalbeitrag bei '), `${label} item ${item.id} still contains legacy "Originalbeitrag bei "`);
        if (i > 0) {
          assert.notStrictEqual(
            getEffectiveSpaceHandle(item),
            getEffectiveSpaceHandle(items[i - 1]),
            `${label} has consecutive items sharing space ${getEffectiveSpaceHandle(item)} at indices ${i - 1}, ${i}`
          );
        }
        if (isDailyDigestNewsletter(item)) {
          techpressoCount += 1;
        }
      }
      assert.ok(techpressoCount <= 1, `${label} must have at most 1 daily digest issue (found ${techpressoCount})`);
    };

    const pipelineItems = JSON.parse(fs.readFileSync(pipelinePath, 'utf8')) as FeedItem[];
    checkItems('pipeline-output.json', pipelineItems);

    const snapshotJson = JSON.parse(fs.readFileSync(snapshotPath, 'utf8')) as { items?: FeedItem[] } | FeedItem[];
    const snapshotItems = Array.isArray(snapshotJson) ? snapshotJson : (snapshotJson.items || []);
    checkItems('public/feed-snapshot.json', snapshotItems);
  });
});
