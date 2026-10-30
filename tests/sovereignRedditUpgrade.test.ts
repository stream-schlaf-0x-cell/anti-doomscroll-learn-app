import test from 'node:test';
import assert from 'node:assert/strict';
import {
  upgradeImageResolutionUrl,
  isRejectedLowResOrLogoUrl
} from '../src/core/utils/imageQuality';
import {
  hasSubstantiveEditorialSection,
  sanitizeCuratedFeedItem
} from '../src/core/enrichment/batchEnricher';
import { SubchannelFlourishService } from '../src/core/ingestion/subchannelFlourishService';
import { LiveCivicPulseService, ManualPipelineStage } from '../src/core/ingestion/liveCivicPulseService';
import {
  generateQuizForArticle,
  isPlausibleNonMetadataQuiz
} from '../src/core/quiz/quizGenerator';
import {
  interleaveSerendipitySlot,
  scoreFeedItem,
  applyDismissFeedbackToProfile,
  revertDismissFeedbackFromProfile
} from '../src/core/domain/ranking';
import { DEFAULT_USER_PROFILE } from '../src/core/data/fixtures';
import { FeedItem } from '../src/core/domain/types';

function makeTestFeedItem(overrides: Partial<FeedItem> = {}): FeedItem {
  return {
    id: overrides.id || 'test-item-1',
    title: overrides.title || 'Epistemische Souveränität im Zeitalter generativer Systeme',
    subtitle: overrides.subtitle || 'Warum menschliche Urteilskraft und Primärquellen-Arbeit unersetzlich bleiben.',
    body: overrides.body || 'Ein ausführlicher Essay über Erkenntnistheorie, kognitive Architektur und digitale Mündigkeit im 21. Jahrhundert.',
    feedText:
      overrides.feedText ||
      'Generative Sprachmodelle verändern die Verfügbarkeit von Texten fundamental, doch sie ersetzen nicht die normative Urteilskraft. Erst die kritische Prüfung von Prämissen, empirischer Evidenz und dialektischen Gegenargumenten verwandelt bloße Information in belastbares Wissen.',
    articleBody:
      overrides.articleBody ||
      'Generative Sprachmodelle verändern die Verfügbarkeit von Texten fundamental, doch sie ersetzen nicht die normative Urteilskraft. Erst die kritische Prüfung von Prämissen, empirischer Evidenz und dialektischen Gegenargumenten verwandelt bloße Information in belastbares Wissen. Wer komplexe Probleme durchdringen will, benötigt Zeiten bewusster Kontemplation und begrifflicher Schärfe.',
    format: overrides.format || 'deep_dive',
    primaryTopic: overrides.primaryTopic || 'philosophy_ethics',
    topics: overrides.topics || ['philosophy_ethics'],
    space: overrides.space || 'c/philosophie',
    publishedAt: overrides.publishedAt || new Date().toISOString(),
    publicationDateReliable: overrides.publicationDateReliable ?? true,
    estimatedReadingMinutes: overrides.estimatedReadingMinutes || 5,
    wordCount: overrides.wordCount || 180,
    sourceTrustLevel: overrides.sourceTrustLevel || 'deep_essay',
    factReviewStatus: overrides.factReviewStatus || 'editorial_ synthesis',
    evidenceTier: overrides.evidenceTier || 'publisher_excerpt',
    curationScore: overrides.curationScore ?? 8.6,
    sourceReferences: overrides.sourceReferences || [
      {
        title: 'Epistemische Souveränität',
        publisher: 'PhilArchive',
        originalUrl: 'https://philarchive.org/rec/test-epistemic'
      }
    ],
    ...overrides
  } as FeedItem;
}

test('Work Package 1: upgradeImageResolutionUrl rewrites low-res CDN params & Wikimedia thumbs and rejects logos/favicons', () => {
  // 1. Rewrite query parameters w=200, width=240, size=small, quality=50 -> w=1080 / width=1080 / size=large / quality=85
  const lowResCdn = 'https://cdn.example.org/photos/article-hero.jpg?w=200&quality=50&size=small';
  const upgradedCdn = upgradeImageResolutionUrl(lowResCdn);
  assert.ok(upgradedCdn, 'Expected valid image URL to be returned');
  assert.match(upgradedCdn!, /w=1080/);
  assert.match(upgradedCdn!, /quality=85/);
  assert.match(upgradedCdn!, /size=large/);

  // 2. Rewrite Wikimedia /thumb/.../200px-... to /800px-...
  const wikiThumb = 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Camponotus_flavomarginatus_ant.jpg/220px-Camponotus_flavomarginatus_ant.jpg';
  const upgradedWiki = upgradeImageResolutionUrl(wikiThumb);
  assert.ok(upgradedWiki, 'Expected Wikimedia thumbnail URL to be upgraded');
  assert.match(upgradedWiki!, /\/800px-Camponotus_flavomarginatus_ant\.jpg$/);

  // 3. Reject favicons, publisher logos, tracking pixels, and placeholder SVGs
  assert.equal(upgradeImageResolutionUrl('https://example.com/favicon.ico'), undefined);
  assert.equal(upgradeImageResolutionUrl('https://example.com/assets/site-logo.svg'), undefined);
  assert.equal(upgradeImageResolutionUrl('https://example.com/1x1-pixel.gif'), undefined);
  assert.equal(isRejectedLowResOrLogoUrl('https://example.com/apple-touch-icon.png'), true);
});

test('Work Package 2: SubchannelFlourishService builds multi-lane query profiles and returns >= 5 channel-matched cards for arbitrary custom channels', async () => {
  for (const channelHandle of ['c/elektronische_musik', 'c/quantenphysik', 'c/visible_learning']) {
    const profile = SubchannelFlourishService.buildQueryProfile(channelHandle);
    assert.equal(profile.handle, channelHandle);
    assert.ok(profile.academicQueries.length >= 2, `Expected academic queries for ${channelHandle}`);
    assert.ok(profile.subreddits.length >= 2, `Expected subreddit targets for ${channelHandle}`);
    assert.ok(profile.wikipediaQueries.length >= 2, `Expected Wikipedia queries for ${channelHandle}`);

    const result = await SubchannelFlourishService.flourishChannel(channelHandle, {
      targetCount: 6,
      // Pass empty credentials so test runs deterministically without external network requirement
      credentials: { provider: 'gemini', apiKey: '', model: 'gemini-2.5-flash' }
    });

    assert.ok(
      result.items.length >= 5,
      `Expected at least 5 flourished cards for ${channelHandle}, got ${result.items.length}`
    );
    for (const card of result.items) {
      assert.equal(card.space?.toLowerCase(), channelHandle.toLowerCase());
      assert.ok((card.feedText || '').length >= 120, 'Expected substantive feedText on flourished card');
    }
  }
});

test('Work Package 3: Serendipity Slot interleaves a genuine Überraschungs-Impuls at every 6th card (index 5) and LiveCivicPulseService provides macro + lived reality + serendipity', () => {
  const realityPool = LiveCivicPulseService.getCuratedRealityAndSerendipityPool();
  assert.ok(realityPool.length >= 5, 'Expected curated reality & serendipity pool to have >= 5 items');

  // Create 8 items where top items are dominated by philosophy_ethics and ai_apple, plus 1 art_aesthetics serendipity gem
  const dominantItems = Array.from({ length: 7 }, (_, idx) =>
    scoreFeedItem(
      makeTestFeedItem({
        id: `dom-${idx}`,
        title: `Dominantes Thema #${idx}`,
        primaryTopic: idx % 2 === 0 ? 'philosophy_ethics' : 'ai_apple',
        topics: [idx % 2 === 0 ? 'philosophy_ethics' : 'ai_apple'],
        curationScore: 8.2
      }),
      DEFAULT_USER_PROFILE,
      {}
    )
  );

  const serendipityGem = scoreFeedItem(
    makeTestFeedItem({
      id: 'serendipity-gem-1',
      title: 'Bauhaus und die Geometrie der Stille',
      primaryTopic: 'art_aesthetics',
      topics: ['art_aesthetics'],
      format: 'surprising_connection',
      isEvergreenGem: true,
      curationScore: 9.1
    }),
    DEFAULT_USER_PROFILE,
    {}
  );

  const interleaved = interleaveSerendipitySlot([...dominantItems, serendipityGem]);
  assert.equal(
    interleaved[5].id,
    'serendipity-gem-1',
    'Expected the 6th card (index 5) to be the high-scoring serendipity item outside the dominant top 2 topics'
  );
});

test('Work Package 4: Quiz generator never produces metadata trivia or silly boilerplate distractors, and Reader section gate suppresses boilerplate strings', () => {
  const sampleItems: FeedItem[] = [
    makeTestFeedItem({
      id: 'q-phil',
      primaryTopic: 'philosophy_ethics',
      perspectiveDetails: {
        claim: 'Kognitive Autonomie erfordert bewusste Reibung am Originaltext.',
        humanSource: 'Philosophischer Diskurs',
        counterPerspective: 'Automatisierte Zusammenfassungen erhöhen die Zugänglichkeit komplexer Forschungsfelder für breite Schichten.'
      }
    }),
    makeTestFeedItem({
      id: 'q-ai',
      title: 'Lokale Sprachmodelle auf Apple Silicon',
      primaryTopic: 'ai_apple'
    }),
    makeTestFeedItem({
      id: 'q-didactics',
      title: 'Sokratisches Gespräch im Ethikunterricht',
      primaryTopic: 'german_didactics'
    }),
    makeTestFeedItem({
      id: 'q-science',
      title: 'Resilienz europäischer Stromnetze in der Energiewende',
      primaryTopic: 'science_society'
    })
  ];

  for (const item of sampleItems) {
    const quiz = generateQuizForArticle(item);
    assert.equal(quiz.options.length, 4);
    assert.equal(isPlausibleNonMetadataQuiz(quiz), true, `Quiz failed non-metadata/non-boilerplate check: ${JSON.stringify(quiz)}`);
    assert.doesNotMatch(quiz.question, /wer hat diesen artikel veröffentlicht/i);
    for (const opt of quiz.options) {
      assert.doesNotMatch(opt, /oberflächliche sensationsmeldung ohne nachhaltigen informationswert/i);
    }
  }

  // Reader section gate: reject boilerplate strings and short < 35-word placeholders
  assert.equal(
    hasSubstantiveEditorialSection('Originalbeitrag veröffentlicht bei Tagesschau.de am 30.10.2026.', 10),
    false,
    'Expected boilerplate "Originalbeitrag veröffentlicht bei..." to be rejected'
  );
  assert.equal(
    hasSubstantiveEditorialSection('Zu kurzer Platzhalter ohne echte dialektische Tiefe.', 35),
    false,
    'Expected < 35 word section to be rejected for deep Reader sections'
  );

  const valid38Words =
    'Ein gewichtiger struktureller Einwand lautet, dass rein individuelle Entschleunigung die ökonomischen Anreizsysteme der Plattformökonomie unangetastet lässt: Solange Geschäftsmodelle primär auf Verweildauer und affektive Empörung optimiert sind, bedarf es zusätzlich institutioneller Transparenzpflichten und interoperabler offener Protokolle für digitale Öffentlichkeiten.';
  assert.equal(
    hasSubstantiveEditorialSection(valid38Words, 35),
    true,
    'Expected genuine >= 35 word dialectical argument to pass Reader section gate'
  );

  // sanitizeCuratedFeedItem strips boilerplate keyInsight
  const sanitized = sanitizeCuratedFeedItem(
    makeTestFeedItem({
      keyInsight: 'Originalbeitrag veröffentlicht bei Deutschlandfunk.'
    })
  );
  assert.notEqual(sanitized.keyInsight, 'Originalbeitrag veröffentlicht bei Deutschlandfunk.');
});

test('Work Package 5: 1-Tap "Weniger davon" down-weights topic & source with clean Undo, and Manual Research Pipeline enforces mutex & 4 stages', async () => {
  const item = makeTestFeedItem({
    id: 'dismiss-target-1',
    primaryTopic: 'science_society',
    sourceDomain: 'boulevard-example.de',
    sourceReferences: [
      {
        title: 'Test',
        publisher: 'Boulevard Example',
        originalUrl: 'https://boulevard-example.de/story-1',
        retrievalTimestamp: new Date().toISOString(),
        isVerified: true
      }
    ]
  });

  const beforeWeight = DEFAULT_USER_PROFILE.explicitInterests.science_society;
  const afterDismissProfile = applyDismissFeedbackToProfile(DEFAULT_USER_PROFILE, item);

  assert.ok(
    afterDismissProfile.explicitInterests.science_society < beforeWeight,
    'Expected dismiss action to down-weight the item primaryTopic'
  );
  assert.ok(
    (afterDismissProfile.mutedSources || []).includes('boulevard-example.de'),
    'Expected dismiss action to record source in mutedSources'
  );

  const restoredProfile = revertDismissFeedbackFromProfile(afterDismissProfile, item);
  assert.ok(
    restoredProfile.explicitInterests.science_society > afterDismissProfile.explicitInterests.science_society,
    'Expected undo to restore topic weight'
  );
  assert.equal(
    (restoredProfile.mutedSources || []).includes('boulevard-example.de'),
    false,
    'Expected undo to remove source from mutedSources'
  );

  // Verify Manual Research Pipeline 4 stages & mutex lock
  const observedStages: ManualPipelineStage[] = [];
  const [run1, run2] = await Promise.all([
    LiveCivicPulseService.runManualResearchPipeline({
      skipNetwork: true,
      credentials: { provider: 'gemini', apiKey: '', model: 'gemini-2.5-flash' },
      onStageChange: (stage) => {
        observedStages.push(stage);
      }
    }),
    LiveCivicPulseService.runManualResearchPipeline({
      skipNetwork: true,
      credentials: { provider: 'gemini', apiKey: '', model: 'gemini-2.5-flash' }
    })
  ]);

  assert.deepEqual(
    observedStages,
    ['fetching_sources', 'checking_relevance', 'ai_enrichment', 'publishing'],
    'Expected manual pipeline to transition through all 4 telemetry stages in order'
  );
  assert.ok(run1.curatedCount > 0, 'Expected manual pipeline to curate items');
  assert.deepEqual(run2.items, run1.items, 'Expected concurrent duplicate trigger to share mutex result');
});
