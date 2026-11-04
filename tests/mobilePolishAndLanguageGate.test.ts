import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  isSupportedFeedLanguage,
  satisfiesDefaultCuratedStandard,
  sanitizeCuratedFeedItem
} from '../src/core/enrichment/batchEnricher';
import {
  scoreFeedItem,
  computeUpvoteSimilarityBoost,
  applyVoteFeedbackToProfile,
  extractConceptKeywords
} from '../src/core/domain/ranking';
import { RecursiveLearningEngine } from '../src/core/recommendations/recursiveLearningEngine';
import { DEFAULT_USER_PROFILE } from '../src/core/data/fixtures';
import { FeedItem } from '../src/core/domain/types';

function makeArticle(overrides: Partial<FeedItem> = {}): FeedItem {
  return {
    id: overrides.id || 'test-article-1',
    title: overrides.title || 'Kognitive Souveränität und Urteilskraft im digitalen Diskurs',
    subtitle:
      overrides.subtitle ||
      'Warum epistemische Autonomie im Zeitalter generativer Sprachmodelle bewusste Reflexionsräume erfordert.',
    body:
      overrides.body ||
      'Die Fähigkeit zur kritischen Urteilskraft hängt maßgeblich davon ab, ob Leserinnen und Leser Primärquellen und dialektische Gegenpositionen eigenständig prüfen.',
    feedText:
      overrides.feedText ||
      'Generative Systeme beschleunigen die Textproduktion, doch sie ersetzen nicht das eigenständige philosophische Urteil. Erst die Auseinandersetzung mit Primärquellen und begründeten Gegenargumenten schafft belastbares Wissen.',
    articleBody:
      overrides.articleBody ||
      'Generative Systeme beschleunigen die Textproduktion, doch sie ersetzen nicht das eigenständige philosophische Urteil. Erst die Auseinandersetzung mit Primärquellen und begründeten Gegenargumenten schafft belastbares Wissen im Unterricht und Alltag.',
    format: overrides.format || 'deep_dive',
    primaryTopic: overrides.primaryTopic || 'philosophy_ethics',
    topics: overrides.topics || ['philosophy_ethics'],
    space: overrides.space || 'c/philosophie',
    publishedAt: overrides.publishedAt || new Date().toISOString(),
    publicationDateReliable: overrides.publicationDateReliable ?? true,
    estimatedReadingMinutes: overrides.estimatedReadingMinutes || 5,
    wordCount: overrides.wordCount || 180,
    sourceTrustLevel: overrides.sourceTrustLevel || 'deep_essay',
    factReviewStatus: overrides.factReviewStatus || 'editorial_synthesis',
    evidenceTier: overrides.evidenceTier || 'publisher_excerpt',
    curationScore: overrides.curationScore ?? 8.5,
    sourceDomain: overrides.sourceDomain || 'philarchive.org',
    sourceReferences: overrides.sourceReferences || [
      {
        title: 'Kognitive Souveränität',
        publisher: 'PhilArchive',
        originalUrl: 'https://philarchive.org/rec/test-1'
      }
    ],
    ...overrides
  } as FeedItem;
}

test('Work Package 1: Strict DE/EN Language Gate rejects Czech, Polish & untranslated foreign articles while keeping German & English', () => {
  // 1. Exact Czech article reported in user screenshot ("Nepsat dějiny podle vítězů")
  const czechTitle = 'Nepsat dějiny podle vítězů';
  const czechBody =
    'V žádném z politických režimů, které zažil, však nepsal příběhy v souladu s výklady minulosti, o něž se opírala moc. Platilo to i pro témata protinacistického odboje.';
  assert.equal(
    isSupportedFeedLanguage(czechTitle, czechBody),
    false,
    'Expected Czech article "Nepsat dějiny podle vítězů" to be rejected by isSupportedFeedLanguage'
  );

  const czechItem = makeArticle({
    id: 'live-fc-eurozine-network-5ce7cfda19',
    title: czechTitle,
    subtitle: czechBody,
    feedText: czechBody,
    body: czechBody,
    articleBody: czechBody
  });
  assert.equal(
    satisfiesDefaultCuratedStandard(czechItem),
    false,
    'Expected satisfiesDefaultCuratedStandard to reject Czech article'
  );
  const sanitizedCzech = sanitizeCuratedFeedItem(czechItem);
  assert.equal(
    (sanitizedCzech.curationScore ?? 10) <= 2.0,
    true,
    'Expected sanitizeCuratedFeedItem to downgrade non-DE/EN item curationScore'
  );

  // 2. Polish article
  assert.equal(
    isSupportedFeedLanguage(
      'Jak sztuczna inteligencja zmienia edukację w Polsce',
      'Współczesne społeczeństwo stoi przed wieloma wyzwaniami związanymi z rozwojem nowych technologii oraz edukacji.'
    ),
    false,
    'Expected Polish article to be rejected'
  );

  // 3. Untranslated French article
  assert.equal(
    isSupportedFeedLanguage(
      'Les nouvelles frontières de la démocratie européenne',
      'Dans cette analyse approfondie, nous examinons comment les institutions publiques sont transformées pour tous les citoyens.'
    ),
    false,
    'Expected untranslated French article to be rejected'
  );

  // 4. Valid German and English articles pass cleanly
  assert.equal(
    isSupportedFeedLanguage(
      'Warum digitale Souveränität in Schulen beginnt',
      'Eine fundierte Auseinandersetzung mit Medienkompetenz, Erkenntnistheorie und der Rolle von Lehrkräften im Unterricht.'
    ),
    true,
    'Expected German article to pass'
  );
  assert.equal(
    isSupportedFeedLanguage(
      'How Epistemic Humility Shapes Scientific Discovery',
      'Understanding the limits of formal models is essential for rigorous scientific inquiry and democratic discourse.'
    ),
    true,
    'Expected English article to pass'
  );

  // 5. Verify shipped snapshot contains zero Czech/non-DE/EN articles
  const snapshotPath = path.resolve(__dirname, '../public/feed-snapshot.json');
  const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
  const hasCzechLeak = snapshot.items.some(
    (item: any) =>
      item.id === 'live-fc-eurozine-network-5ce7cfda19' ||
      /Nepsat dějiny/i.test(item.title || '') ||
      !isSupportedFeedLanguage(item.title || '', `${item.subtitle || ''} ${item.feedText || ''}`)
  );
  assert.equal(hasCzechLeak, false, 'Expected public/feed-snapshot.json to contain zero non-DE/EN articles');
});

test('Work Package 2: Mobile Header, "Stream" bottom tab & Single-Row FeedCard layout invariants', () => {
  const appTsx = fs.readFileSync(path.resolve(__dirname, '../App.tsx'), 'utf8');
  assert.match(appTsx, />\s*Stream\s*<\/Text>/, 'Expected first bottom tab in App.tsx to be labeled "Stream"');

  const headerTsx = fs.readFileSync(path.resolve(__dirname, '../src/ui/components/Header.tsx'), 'utf8');
  assert.match(
    headerTsx,
    /isCompactMobile\s*=\s*width\s*<\s*768/,
    'Expected Header.tsx to detect mobile viewport (width < 768)'
  );
  assert.match(
    headerTsx,
    /!isCompactMobile\s*&&\s*subtitle/,
    'Expected Header.tsx to hide the multi-line subtitle on mobile'
  );

  const badgeTsx = fs.readFileSync(path.resolve(__dirname, '../src/ui/components/SubchannelBadge.tsx'), 'utf8');
  assert.match(badgeTsx, /flexShrink:\s*0/, 'Expected SubchannelBadge pill to enforce flexShrink: 0');

  const cardTsx = fs.readFileSync(path.resolve(__dirname, '../src/ui/components/FeedCard.tsx'), 'utf8');
  assert.doesNotMatch(
    cardTsx,
    /📄 Originalauszug/,
    'Expected duplicate "📄 Originalauszug" badge to be removed from FeedCard.tsx'
  );
  assert.doesNotMatch(
    cardTsx,
    /redditTextHookCallout/,
    'Expected inline Kernthese callout box to be removed from stream FeedCard.tsx (deferred to ReaderScreen)'
  );
  assert.match(
    cardTsx,
    /flexWrap:\s*'nowrap'/,
    'Expected FeedCard actionBar to enforce a single non-wrapping row'
  );
});

test('Work Package 3: PWA Option A App Icons & manifest.json are generated and linked in public/index.html', () => {
  const publicDir = path.resolve(__dirname, '../public');
  const appleIconPath = path.join(publicDir, 'apple-touch-icon.png');
  const icon192Path = path.join(publicDir, 'icon-192.png');
  const icon512Path = path.join(publicDir, 'icon-512.png');
  const manifestPath = path.join(publicDir, 'manifest.json');
  const indexHtmlPath = path.join(publicDir, 'index.html');

  assert.equal(fs.existsSync(appleIconPath), true, 'Expected public/apple-touch-icon.png to exist');
  assert.equal(fs.existsSync(icon192Path), true, 'Expected public/icon-192.png to exist');
  assert.equal(fs.existsSync(icon512Path), true, 'Expected public/icon-512.png to exist');
  assert.equal(fs.existsSync(manifestPath), true, 'Expected public/manifest.json to exist');

  // Verify PNG signature & IHDR dimensions (180x180) on apple-touch-icon.png
  const applePng = fs.readFileSync(appleIconPath);
  assert.equal(applePng[0], 0x89);
  assert.equal(applePng.toString('ascii', 1, 4), 'PNG');
  assert.equal(applePng.readUInt32BE(16), 180, 'Expected apple-touch-icon.png width to be 180');
  assert.equal(applePng.readUInt32BE(20), 180, 'Expected apple-touch-icon.png height to be 180');

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.equal(manifest.name, 'Atmen');
  assert.equal(manifest.display, 'standalone');
  assert.ok(manifest.background_color === '#0E1424' || manifest.background_color === '#0A0E1A');

  const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
  assert.match(indexHtml, /rel="apple-touch-icon"\s+sizes="180x180"\s+href="(?:\.\/)?apple-touch-icon\.png"/);
  assert.match(indexHtml, /rel="manifest"\s+href="(?:\.\/)?manifest\.json"/);
  assert.match(indexHtml, /name="apple-mobile-web-app-capable"\s+content="yes"/);
});

test('Work Package 4: Upvoting an item measurably boosts unseen articles sharing core concepts/keywords and channel affinity', async () => {
  const upvotedArticle = makeArticle({
    id: 'upvoted-quantum-1',
    title: 'Quantenverschränkung und Dekohärenz in supraleitenden Qubits',
    subtitle: 'Neue Experimente zur Fehlerkorrektur in Quantencomputern.',
    keyInsight: 'Supraleitende Qubits erreichen durch topologische Abschirmung längere Kohärenzzeiten.',
    primaryTopic: 'science_society',
    topics: ['science_society', 'ai_apple'],
    space: 'c/quantenphysik',
    sourceDomain: 'quantamagazine.org'
  });

  const matchingUnseenArticle = makeArticle({
    id: 'unseen-quantum-2',
    title: 'Durchbruch bei supraleitenden Qubits und Quantenverschränkung',
    subtitle: 'Wie Dekohärenz in modernen Quantencomputern überwunden wird.',
    keyInsight: 'Fehlerkorrektur stabilisiert verschränkte Zustände über längere Zeiträume.',
    primaryTopic: 'science_society',
    topics: ['science_society'],
    space: 'c/quantenphysik',
    sourceDomain: 'quantamagazine.org'
  });

  const unrelatedUnseenArticle = makeArticle({
    id: 'unseen-unrelated-3',
    title: 'Agrarpolitik und kommunale Wasserwirtschaft im Mittelalter',
    subtitle: 'Historische Quellen zur mittelalterlichen Dreifelderwirtschaft.',
    keyInsight: 'Genossenschaftliche Bewässerungssysteme prägten die Dorfgemeinschaft.',
    primaryTopic: 'science_society',
    topics: ['science_society'],
    space: 'c/geschichte',
    sourceDomain: 'historicum.net'
  });

  const extracted = extractConceptKeywords(upvotedArticle);
  assert.ok(extracted.length >= 4, 'Expected at least 4 concept keywords extracted from upvoted article');

  // Score before upvote
  const matchingBefore = scoreFeedItem(matchingUnseenArticle, DEFAULT_USER_PROFILE, {}).score;
  const unrelatedBefore = scoreFeedItem(unrelatedUnseenArticle, DEFAULT_USER_PROFILE, {}).score;

  // Apply upvote via RecursiveLearningEngine (which also calls applyVoteFeedbackToProfile)
  const { updatedProfile } = await RecursiveLearningEngine.recordInteractionEvent(
    DEFAULT_USER_PROFILE,
    upvotedArticle,
    'upvote'
  );

  const simBoostMatching = computeUpvoteSimilarityBoost(matchingUnseenArticle, updatedProfile);
  const simBoostUnrelated = computeUpvoteSimilarityBoost(unrelatedUnseenArticle, updatedProfile);
  assert.ok(
    simBoostMatching >= 0.15,
    `Expected strong positive similarity boost (>= 0.15) for matching unseen article, got ${simBoostMatching}`
  );
  assert.equal(simBoostUnrelated, 0, 'Expected 0 similarity boost for unrelated unseen article');

  const matchingAfter = scoreFeedItem(matchingUnseenArticle, updatedProfile, {}).score;
  const unrelatedAfter = scoreFeedItem(unrelatedUnseenArticle, updatedProfile, {}).score;

  assert.ok(
    matchingAfter - matchingBefore > unrelatedAfter - unrelatedBefore + 0.05,
    `Expected upvoting to elevate matching unseen article (${matchingBefore} -> ${matchingAfter}) significantly more than unrelated article (${unrelatedBefore} -> ${unrelatedAfter})`
  );
  assert.ok(
    matchingAfter > unrelatedAfter,
    'Expected matching unseen article to rank clearly higher than unrelated article after upvote'
  );

  // Verify downvote penalty
  const downvotedProfile = applyVoteFeedbackToProfile(DEFAULT_USER_PROFILE, unrelatedUnseenArticle, 'down');
  const penalty = computeUpvoteSimilarityBoost(unrelatedUnseenArticle, downvotedProfile);
  assert.ok(penalty <= -0.25, `Expected decisive negative penalty (<= -0.25) on downvoted concepts/domain, got ${penalty}`);
});
