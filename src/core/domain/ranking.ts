import {
  FeedItem,
  UserProfile,
  TopicTag,
  ReadingInteraction,
  PersonalGoal,
  DayEditionType,
  TOPIC_SPACE_MAP
} from './types';
import { SeenImpressionRecord } from '../data/seenImpressionsService';
import { isSupportedFeedLanguage, IRRELEVANT_WETLAB_OR_NICHE_ACADEMIC_REGEX } from '../enrichment/batchEnricher';
import { isBrightWebFlagshipItem } from '../ingestion/brightWebAdapters';
import { RecursiveLearningEngine } from '../recommendations/recursiveLearningEngine';

export interface ScoreBreakdown {
  topicMatch: number;
  topicAffinity: number;
  goalAlignment: number;
  readingTimeFit: number;
  durationMatch: number;
  freshness: number;
  editorialValue: number;
  depthBonus: number;
  serendipity: number;
  feedbackAdjustment: number;
  behavioralAdjustment: number;
  authorBoost: number;
  credibilityBonus?: number;
  manipulativeDampener?: number;
  totalScore: number;
  explanation: string;
  primaryReason: string;
  secondaryReason: string;
  whyFactors: string[];
}

export interface ScoredFeedItem extends FeedItem {
  score: number;
  scoreBreakdown: ScoreBreakdown;
}

const GOAL_TOPIC_AFFINITY: Record<PersonalGoal, Partial<Record<TopicTag, number>>> = {
  understand_tech: {
    ai_apple: 1.0,
    science_society: 0.75,
    philosophy_ethics: 0.5
  },
  creative_music: {
    sound_synthesis: 1.0,
    ai_apple: 0.5,
    contemplation_mind: 0.6,
    art_aesthetics: 0.65
  },
  deepen_attention: {
    contemplation_mind: 1.0,
    german_didactics: 0.85,
    philosophy_ethics: 0.65,
    health_biohacking: 0.75
  },
  philosophical_clarity: {
    philosophy_ethics: 1.0,
    contemplation_mind: 0.8,
    science_society: 0.65,
    book_mastery: 0.75
  },
  society_and_ethics: {
    science_society: 1.0,
    philosophy_ethics: 0.9,
    german_didactics: 0.75
  }
};

const TOPIC_PRIMARY_GOAL: Record<TopicTag, PersonalGoal> = {
  ai_apple: 'understand_tech',
  sound_synthesis: 'creative_music',
  contemplation_mind: 'deepen_attention',
  german_didactics: 'deepen_attention',
  philosophy_ethics: 'philosophical_clarity',
  science_society: 'society_and_ethics',
  memes_satire: 'philosophical_clarity',
  youtube_gems: 'understand_tech',
  book_mastery: 'philosophical_clarity',
  health_biohacking: 'deepen_attention',
  opportunities_growth: 'understand_tech',
  art_aesthetics: 'creative_music'
};

/**
 * Returns the effective weight for a topic, preferring learned derivedWeights over explicitInterests.
 */
export function getEffectiveTopicWeight(profile?: UserProfile, topic?: TopicTag): number {
  if (!profile || !topic) return 0.5;
  const derived = profile.derivedWeights?.[topic];
  if (typeof derived === 'number') {
    return derived;
  }
  return profile.explicitInterests?.[topic] ?? 0.5;
}

/**
 * Normalizes a publisher or domain identifier for diversity tracking.
 */
export function getNormalizedPublisherKey(item: FeedItem): string {
  const pub = item.sourceReferences?.[0]?.publisher || item.sourceBroadcasterName || item.sourceDomain || 'unknown';
  const clean = pub.toLowerCase().trim();
  if (clean.includes('guardian')) return 'the guardian';
  if (clean.includes('politico')) return 'politico europe';
  if (clean.includes('monde') || clean.includes('eurozine')) return 'le monde / eurozine';
  if (clean.includes('verfassungsblog')) return 'verfassungsblog';
  if (clean.includes('schulportal')) return 'deutsches schulportal';
  if (clean.includes('deutschlandfunk') || clean.includes('dlf')) return 'deutschlandfunk';
  if (clean.includes('tagesschau') || /(^|[^a-z])ard([^a-z]|$)/.test(clean)) return 'ard tagesschau';
  if (clean.includes('wikipedia') || clean.includes('wikimedia')) return 'wikipedia / wikimedia';
  if (clean.includes('arxiv')) return 'arxiv';
  if (clean.includes('spektrum') || clean.includes('gehirn')) return 'spektrum';
  if (clean.includes('aeon') || clean.includes('psyche')) return 'aeon / psyche';
  return clean;
}

/**
 * Detects whether an item originates from ARD / Tagesschau / ARD subsidiaries.
 */
export function isArdSource(item: FeedItem): boolean {
  const pub = (item.sourceReferences?.[0]?.publisher || item.sourceBroadcasterName || '').toLowerCase().trim();
  const dom = (item.sourceDomain || '').toLowerCase();
  const url = (item.canonicalUrl || item.sourceReferences?.[0]?.originalUrl || '').toLowerCase();
  return (
    pub.includes('tagesschau') ||
    pub.includes('ard-aktuell') ||
    /(^|[^a-z])ard([^a-z]|$)/.test(pub) ||
    dom.includes('tagesschau.de') ||
    dom.includes('ard.de') ||
    url.includes('tagesschau.de') ||
    url.includes('ard.de')
  );
}

/**
 * Checks whether an item represents an international or high-value balancing source.
 */
export function isBalancingSource(item: FeedItem): boolean {
  const text = `${item.sourceReferences?.[0]?.publisher || ''} ${item.sourceBroadcasterName || ''} ${item.sourceDomain || ''} ${item.canonicalUrl || ''}`.toLowerCase();
  return (
    text.includes('deutschlandfunk') ||
    text.includes('dlf') ||
    text.includes('zeit') ||
    text.includes('spiegel') ||
    text.includes('sueddeutsche') ||
    text.includes('süddeutsche') ||
    text.includes('guardian') ||
    text.includes('politico') ||
    text.includes('monde') ||
    text.includes('eurozine') ||
    text.includes('verfassungsblog') ||
    text.includes('schulportal')
  );
}

const SAXONY_REGIONAL_REGEX =
  /sachsen|dresden|leipzig|mdr|neustadt-gefl[üu]ster|neustadt-ticker\.de|leipziger zeitung|l-iz\.de|\bl-iz\b|kreuzer leipzig|kreuzer-leipzig\.de|leipziger volkszeitung|lvz\.de|\blvz\b|chemnitz|lausitz|erzgebirge|regions=14/i;

/**
 * Detects Dresden, Leipzig & Saxony regional news and local editorial outlets.
 */
export function isSaxonyRegionalItem(
  item: Pick<
    FeedItem,
    | 'title'
    | 'subtitle'
    | 'feedText'
    | 'body'
    | 'sourceBroadcasterName'
    | 'sourceDomain'
    | 'canonicalUrl'
    | 'sourceReferences'
  >
): boolean {
  const publisher = item.sourceReferences?.[0]?.publisher;
  return Boolean(
    (item.sourceDomain && SAXONY_REGIONAL_REGEX.test(item.sourceDomain)) ||
    (item.sourceBroadcasterName && SAXONY_REGIONAL_REGEX.test(item.sourceBroadcasterName)) ||
    (publisher && SAXONY_REGIONAL_REGEX.test(publisher)) ||
    (item.canonicalUrl && SAXONY_REGIONAL_REGEX.test(item.canonicalUrl)) ||
    (item.title && SAXONY_REGIONAL_REGEX.test(item.title)) ||
    (item.subtitle && SAXONY_REGIONAL_REGEX.test(item.subtitle)) ||
    (item.feedText && SAXONY_REGIONAL_REGEX.test(item.feedText)) ||
    (item.body && SAXONY_REGIONAL_REGEX.test(item.body))
  );
}

/**
 * Checks whether an item anchors regional Saxony / Dresden / Leipzig focus.
 */
export function matchesSaxonyRegion(item: FeedItem): boolean {
  return isSaxonyRegionalItem(item);
}

export const DISCOURSE_CONCEPTS: { topic: TopicTag; concept: string; framework: string }[] = [
  {
    topic: 'philosophy_ethics',
    concept: 'Diskursethik & Normenbegründung (Jürgen Habermas)',
    framework: 'Hinterfragt die unausgesprochenen Geltungsansprüche und moralischen Voraussetzungen der Kontroverse.'
  },
  {
    topic: 'science_society',
    concept: 'Institutionenökonomik & Pfadabhängigkeit (Douglass North)',
    framework: 'Verbindet tagesaktuelle Dynamiken mit trägen systemischen Anreizstrukturen und historischen Pfaden.'
  },
  {
    topic: 'german_didactics',
    concept: 'Bildungsgerechtigkeit & Kognitive Aktivierung (Hattie / Klieme)',
    framework: 'Hebt bildungspolitische Reflexionen von Symptomdebatten auf empirische Tiefenstrukturen.'
  },
  {
    topic: 'ai_apple',
    concept: 'Technologische Kybernetik & Aufmerksamkeitsökonomie (Norbert Wiener / Neil Postman)',
    framework: 'Analysiert die strukturelle Rückkopplung digitaler Infrastrukturen auf gesellschaftliche Willensbildung.'
  },
  {
    topic: 'contemplation_mind',
    concept: 'Resonanztheorie & Kognitive Entschleunigung (Hartmut Rosa)',
    framework: 'Eröffnet einen kontemplativen Metaraum gegenüber getriebener Reaktionslogik.'
  }
];

export function enrichItemWithDiscourseConcept<T extends FeedItem>(item: T): T {
  if (item.feedText && (item.feedText.includes('Wissensvorsprung:') || item.keyInsight?.includes('Strukturelle Einordnung:'))) {
    return item;
  }
  const match = DISCOURSE_CONCEPTS.find(c => c.topic === item.primaryTopic) || DISCOURSE_CONCEPTS[0];
  const conceptText = ` [Wissensvorsprung: Verknüpft mit ${match.concept} – ${match.framework}]`;
  const newFeedText = `${(item.feedText || item.title).trim()}${conceptText}`;
  const newInsight = item.keyInsight
    ? `${item.keyInsight} (Strukturelle Einordnung: ${match.concept})`
    : `Strukturelle Einordnung: ${match.concept}`;

  return {
    ...item,
    feedText: newFeedText,
    keyInsight: newInsight
  };
}

/**
 * Transparent Personalized Scoring Formula (Bloomscrolling Edition):
 * - Explicit Feedback (`more_like_this`, `less_like_this`, `voteScore`, `boostedTopics`/`penalizedTopics`)
 *   weighs significantly stronger than passive behavioral signals (opening or dwell time).
 */
export function scoreFeedItem(
  item: FeedItem,
  profile: UserProfile,
  interactions: Record<string, ReadingInteraction> = {},
  domainTrustOverride?: Record<string, number>
): ScoredFeedItem {
  const interaction = interactions[item.id];

  // 1. Topic Match (Effective Weight)
  const primaryWeight = getEffectiveTopicWeight(profile, item.primaryTopic);

  const secondaryWeights = item.topics
    .filter(t => t !== item.primaryTopic)
    .map(t => getEffectiveTopicWeight(profile, t));

  const avgSecondary = secondaryWeights.length > 0
    ? secondaryWeights.reduce((a, b) => a + b, 0) / secondaryWeights.length
    : primaryWeight;

  const topicMatch = Math.min(1, primaryWeight * 0.8 + avgSecondary * 0.2);

  // 2. Goal Alignment
  const primaryGoalKey = TOPIC_PRIMARY_GOAL[item.primaryTopic];
  const goals = profile.explicitGoals || {};
  let goalAlignment = 0.7;
  if (primaryGoalKey && typeof goals[primaryGoalKey] === 'number') {
    goalAlignment = goals[primaryGoalKey];
  } else {
    let goalScoreSum = 0;
    let goalWeightSum = 0;
    for (const [goalKey, goalWeight] of Object.entries(goals)) {
      const affinities = GOAL_TOPIC_AFFINITY[goalKey as PersonalGoal];
      if (affinities) {
        const affinity = affinities[item.primaryTopic] ?? 0.3;
        goalScoreSum += affinity * goalWeight;
        goalWeightSum += goalWeight;
      }
    }
    if (goalWeightSum > 0) {
      goalAlignment = Math.min(1, goalScoreSum / goalWeightSum);
    }
  }

  // 3. Reading Time Fit (Duration Match)
  let readingTimeFit = 0.85;
  const pref = profile?.readingPreferences?.preferredDuration || 'balanced';
  const mins = item.estimatedReadingMinutes;

  if (pref === 'quick') {
    readingTimeFit = mins <= 2 ? 1.0 : mins <= 4 ? 0.65 : 0.30;
  } else if (pref === 'balanced') {
    readingTimeFit = mins >= 1 && mins <= 5 ? 1.0 : 0.8;
  } else if (pref === 'deep') {
    readingTimeFit = mins >= 4 ? 1.0 : mins >= 2 ? 0.65 : 0.30;
  }
  const durationMatch = readingTimeFit;

  // 4. Freshness Score (70/30 Daily Freshness Gradient + 14-Day Relevance-Gated Window)
  const isReliableDate = item.publicationDateReliable !== false;
  const pubTime = isReliableDate ? new Date(item.publishedAt).getTime() : NaN;
  const nowTime = Date.now();
  const hoursOld = isNaN(pubTime) ? 140 : Math.max(0, (nowTime - pubTime) / (1000 * 60 * 60));
  let freshness = 0.65;
  if (!isReliableDate) {
    freshness = item.isEvergreenGem ? 0.70 : 0.56;
  } else if (hoursOld <= 18) {
    freshness = 1.00;
  } else if (hoursOld <= 36) {
    freshness = 0.96;
  } else if (hoursOld <= 48) {
    freshness = 0.91;
  } else if (hoursOld <= 96) {
    freshness = 0.78;
  } else if (hoursOld <= 168) {
    freshness = 0.66;
  } else if (hoursOld <= 336) {
    freshness = 0.54;
  } else {
    freshness = item.isEvergreenGem ? 0.45 : 0.22;
  }

  // 5. Editorial & Source Value (substance over raw recency + Tier A/B Credibility Bonus)
  let editorialValue = 0.82;
  if (item.contentOrigin === 'live_ingested') editorialValue += 0.10;
  if (item.evidenceTier === 'permitted_full_text' || item.evidenceTier === 'multiple_sources') {
    editorialValue += 0.08;
  }
  if ((item.wordCount || 0) >= 180) {
    editorialValue += 0.05;
  }

  // Tier A / B Credibility bonus: public service broadcasting, wire services, science journals, fact checkers
  const pubNorm = (item.sourceReferences?.[0]?.publisher || item.sourceBroadcasterName || item.sourceDomain || '').toLowerCase();
  let credibilityBonus = 0;
  if (
    pubNorm.includes('tagesschau') ||
    pubNorm.includes('deutschlandfunk') ||
    pubNorm.includes('zdf') ||
    pubNorm.includes('br24') ||
    pubNorm.includes('dpa') ||
    pubNorm.includes('reuters') ||
    pubNorm.includes('correctiv') ||
    pubNorm.includes('mimikama') ||
    pubNorm.includes('nature') ||
    pubNorm.includes('science') ||
    pubNorm.includes('arxiv') ||
    pubNorm.includes('pubmed') ||
    pubNorm.includes('destatis') ||
    pubNorm.includes('eurostat') ||
    pubNorm.includes('rki') ||
    pubNorm.includes('who') ||
    pubNorm.includes('edpb') ||
    pubNorm.includes('eff')
  ) {
    credibilityBonus = 0.12;
  } else if (
    pubNorm.includes('heise') ||
    pubNorm.includes('spektrum') ||
    pubNorm.includes('quanta') ||
    pubNorm.includes('aeon') ||
    pubNorm.includes('psyche') ||
    pubNorm.includes('mit tech') ||
    pubNorm.includes('stanford')
  ) {
    credibilityBonus = 0.06;
  }
  editorialValue = Math.min(1, editorialValue + credibilityBonus);

  // Manipulative / Sensationalist Signals Dampener (Anti-Doomscroll Multi-Objective Engine)
  const titleAndTeaser = `${item.title || ''} ${item.subtitle || ''}`.trim();
  let manipulativeDampener = 0;
  const clickbaitRegex = /(schockierend|unglaublich|unfassbar|must see|you won't believe|mind-blowing|sprachlos|das musst du|enthüllung des jahrhunderts|shocking truth)/i;
  const punctuationRegex = /[!?]{2,}/;
  if (clickbaitRegex.test(titleAndTeaser) || punctuationRegex.test(titleAndTeaser)) {
    manipulativeDampener = 0.22;
  }

  // 6. Serendipity & Format Discovery
  const serendipity = item.type === 'discovery' || item.format === 'surprising_connection' || item.format === 'meme'
    ? 0.95
    : 0.65;

  // 7. EXPLICIT Feedback Memory (Strong Weight: +/- 0.45)
  let feedbackAdjustment = 0.5;
  let authorBoost = 0;
  const memory = profile.feedbackMemory;
  if (memory) {
    const boostT = memory.boostedTopics?.[item.primaryTopic] ?? 0;
    const penT = memory.penalizedTopics?.[item.primaryTopic] ?? 0;
    feedbackAdjustment += Math.min(0.35, boostT * 0.12) - Math.min(0.40, penT * 0.15);

    const author = item.sourceReferences[0]?.author || item.sourceReferences[0]?.publisher || '';
    if (author) {
      const boostA = memory.boostedAuthors?.[author] ?? 0;
      const penA = memory.penalizedAuthors?.[author] ?? 0;
      authorBoost = Math.min(0.25, boostA * 0.12) - Math.min(0.30, penA * 0.15);
      feedbackAdjustment += authorBoost;
    }

    const domain = (item.sourceDomain || item.sourceReferences[0]?.publisher || '').toLowerCase();
    if (domain) {
      const boostD = memory.boostedDomains?.[domain] ?? 0;
      const penD = memory.penalizedDomains?.[domain] ?? 0;
      feedbackAdjustment += Math.min(0.25, boostD * 0.10) - Math.min(0.30, penD * 0.15);
    }

    if (item.space) {
      const spaceKey = item.space.toLowerCase();
      const boostS = memory.boostedSpaces?.[spaceKey] ?? 0;
      const penS = memory.penalizedSpaces?.[spaceKey] ?? 0;
      feedbackAdjustment += Math.min(0.20, boostS * 0.10) - Math.min(0.25, penS * 0.12);
    }

    if (memory.boostedKeywords) {
      const titleLower = item.title.toLowerCase();
      for (const [kw, count] of Object.entries(memory.boostedKeywords)) {
        if (titleLower.includes(kw.toLowerCase())) {
          feedbackAdjustment += Math.min(0.15, (count || 1) * 0.06);
        }
      }
    }

    if (memory.penalizedKeywords) {
      const textLower = `${item.title} ${item.subtitle || ''} ${item.keyInsight || ''}`.toLowerCase();
      for (const [kw, count] of Object.entries(memory.penalizedKeywords)) {
        if (textLower.includes(kw.toLowerCase())) {
          feedbackAdjustment -= Math.min(0.25, (count || 1) * 0.10);
        }
      }
    }
  }

  // Upvote / Downvote Concept & Keyword Similarity Boost across unseen articles
  const similarityDelta = computeUpvoteSimilarityBoost(item, profile, interactions);
  feedbackAdjustment += similarityDelta;

  // Learned Domain / Publisher Trust Multiplier
  const trustMap = domainTrustOverride ?? RecursiveLearningEngine.getCachedDomainTrustScores();
  const normDomain = (item.sourceDomain || '').toLowerCase().replace(/^www\./, '').trim();
  let urlHost = '';
  const rawTrustUrl = item.canonicalUrl || item.sourceReferences?.[0]?.originalUrl || '';
  if (rawTrustUrl) {
    try {
      urlHost = new URL(rawTrustUrl).hostname.toLowerCase().replace(/^www\./, '').trim();
    } catch {
      // Ignore malformed URLs
    }
  }
  const rawPublisher = (item.sourceReferences?.[0]?.publisher || '').trim();
  const lowerPublisher = rawPublisher.toLowerCase();

  let learnedTrust: number | undefined;
  const trustCandidates: (number | undefined)[] = [
    normDomain ? trustMap[normDomain] : undefined,
    urlHost ? trustMap[urlHost] : undefined,
    lowerPublisher ? trustMap[lowerPublisher] : undefined,
    rawPublisher ? trustMap[rawPublisher] : undefined
  ];
  const explicitMuteTrust = trustCandidates.find(
    (val): val is number => typeof val === 'number' && val <= 0.15
  );
  if (typeof explicitMuteTrust === 'number') {
    learnedTrust = explicitMuteTrust;
  } else if (normDomain && typeof trustMap[normDomain] === 'number') {
    learnedTrust = trustMap[normDomain];
  } else if (urlHost && typeof trustMap[urlHost] === 'number') {
    learnedTrust = trustMap[urlHost];
  } else if (lowerPublisher && typeof trustMap[lowerPublisher] === 'number') {
    learnedTrust = trustMap[lowerPublisher];
  } else if (rawPublisher && typeof trustMap[rawPublisher] === 'number') {
    learnedTrust = trustMap[rawPublisher];
  } else if (lowerPublisher) {
    for (const [key, val] of Object.entries(trustMap)) {
      if (key.toLowerCase().trim() === lowerPublisher && typeof val === 'number') {
        learnedTrust = val;
        break;
      }
    }
  }

  let trustDelta = 0;
  const isMutedByTrust = typeof learnedTrust === 'number' && learnedTrust <= 0.15;
  if (typeof learnedTrust === 'number' && learnedTrust !== 1.0) {
    trustDelta = Math.max(-0.22, Math.min(0.24, (learnedTrust - 1.0) * 0.28));
    feedbackAdjustment += trustDelta;
  }

  if (interaction?.feedback === 'more_like_this') feedbackAdjustment += 0.40;
  if (interaction?.feedback === 'less_like_this') feedbackAdjustment -= 0.50;
  if (interaction?.voteScore === 1) feedbackAdjustment += 0.25;
  if (interaction?.voteScore === -1) feedbackAdjustment -= 0.40;
  feedbackAdjustment = Math.max(0, Math.min(1, feedbackAdjustment));

  // 8. Passive Behavioral Signals ( deliberately lighter than explicit feedback )
  let behavioralAdjustment = 0.5;
  const signals = profile.behavioralSignals;
  if (signals) {
    if (signals.completedReadIds?.includes(item.id)) {
      behavioralAdjustment -= 0.20; // Already finished reading
    } else if (signals.recentOpenedIds?.includes(item.id)) {
      behavioralAdjustment -= 0.05; // Gently deprioritize already opened items
    }
  }
  behavioralAdjustment = Math.max(0, Math.min(1, behavioralAdjustment));

  // Weighted Composite Score (Daily freshness + organic feedback & similarity carry strong leverage)
  let rawScore =
    topicMatch * 0.23 +
    goalAlignment * 0.13 +
    freshness * 0.18 +
    readingTimeFit * 0.14 +
    editorialValue * 0.06 +
    feedbackAdjustment * 0.22 +
    behavioralAdjustment * 0.04 +
    similarityDelta * 0.45 +
    trustDelta * 0.35;

  // Direct explicit interaction overrides on the item itself
  if (isMutedByTrust) {
    rawScore *= 0.25;
  }
  if (interaction?.feedback === 'less_like_this' || interaction?.voteScore === -1) {
    rawScore *= 0.45;
  } else if (interaction?.feedback === 'more_like_this' || interaction?.voteScore === 1) {
    rawScore *= 1.22;
  } else if (interaction?.completedAt) {
    rawScore *= 0.72;
  }

  // Feed Mix Ratio (Algorithmus-Spiegel: Fokus vs. Sokratische Reibung vs. Serendipity)
  if (profile.feedMixRatio) {
    if (item.isChallengingPerspective) {
      rawScore *= (0.75 + profile.feedMixRatio.socraticRatio * 1.25);
    } else if (item.isDemonstration || item.space === 'c/serendipity' || item.format === 'art_showcase' || item.format === 'meme') {
      rawScore *= (0.75 + profile.feedMixRatio.serendipityRatio * 1.25);
    } else {
      rawScore *= (0.75 + profile.feedMixRatio.focusRatio * 0.45);
    }
  }

  // Regional Dresden / Leipzig / Saxony relevance boost
  const weatherCity = (profile?.editionPreferences?.weatherCity || '').trim().toLowerCase();
  const isSaxonyCityOrDefault = !weatherCity || weatherCity === 'dresden' || weatherCity === 'leipzig';
  const hasSaxonyRegionalBoost = isSaxonyCityOrDefault && isSaxonyRegionalItem(item);
  if (hasSaxonyRegionalBoost) {
    rawScore += 0.14;
  }

  const totalScore = Math.round(rawScore * 1000) / 1000;

  const topicLabel = getTopicLabel(item.primaryTopic);
  const publisherName = item.sourceReferences[0]?.publisher || 'Verifizierte Quelle';
  const primaryReason = `Affinität zu ${topicLabel} (${Math.round(primaryWeight * 100)}%)`;
  const secondaryReason = `${publisherName} • ~${mins} Min. Lesezeit`;
  const explanation = `${primaryReason} • ${secondaryReason}`;

  const whyFactors: string[] = [
    `Themen-Resonanz (${topicLabel}): ${Math.round(topicMatch * 100)}%`,
    `Aktualität & Quelle (${publisherName}): ${Math.round(freshness * 100)}%`,
    `Explizites Feedback-Signal: ${Math.round(feedbackAdjustment * 100)}%`,
    `Format & Lesezeit (~${mins} Min.): ${Math.round(readingTimeFit * 100)}%`
  ];

  if (hasSaxonyRegionalBoost) {
    whyFactors.push('Regionaler Fokus (Dresden / Leipzig / Sachsen): +14%');
  }

  if (credibilityBonus >= 0.08) {
    whyFactors.push(`Hohe Quellen-Reliabilität: Tier A Verifikation (+${Math.round(credibilityBonus * 100)}%)`);
  }
  if (typeof learnedTrust === 'number' && Math.abs(learnedTrust - 1.0) >= 0.08) {
    const pct = Math.round((learnedTrust - 1.0) * 100);
    const sign = pct > 0 ? '+' : '';
    whyFactors.push(`Gelerntes Quellen-Vertrauen: ${sign}${pct}%`);
  }
  if (manipulativeDampener > 0) {
    whyFactors.push(`Sensationalismus-Dämpfung (-${Math.round(manipulativeDampener * 100)}%)`);
  }

  return {
    ...item,
    relevanceExplanation: item.relevanceExplanation || explanation,
    score: totalScore,
    scoreBreakdown: {
      topicMatch,
      topicAffinity: topicMatch,
      goalAlignment,
      readingTimeFit,
      durationMatch,
      freshness,
      editorialValue,
      depthBonus: Math.max(0, Math.round((editorialValue - 0.5) * 100) / 100),
      serendipity,
      feedbackAdjustment,
      behavioralAdjustment,
      authorBoost,
      credibilityBonus,
      manipulativeDampener,
      totalScore,
      explanation,
      primaryReason,
      secondaryReason,
      whyFactors
    }
  };
}

function getCardRhythmFormat(item: FeedItem): 'quick_20s' | 'visual_art' | 'deep_essay' | 'sourced_briefing' | 'community_pulse' {
  if (item.format === 'art_showcase' || item.primaryTopic === 'art_aesthetics') {
    return 'visual_art';
  }
  if (item.externalCommunityScore || item.sourceTrustLevel === 'community_curated') {
    return 'community_pulse';
  }
  if (item.format === 'meme' || item.primaryTopic === 'memes_satire' || item.wordCount <= 90 || item.estimatedReadingMinutes <= 1) {
    return 'quick_20s';
  }
  if (item.type === 'deep_dive' || item.format === 'long_invitation' || item.format === 'book_masterpiece' || item.estimatedReadingMinutes >= 4) {
    return 'deep_essay';
  }
  return 'sourced_briefing';
}

/**
 * Sliding-Window Bloom-Ranking Algorithm (`rankBloomScrollFeed`):
 *
 * Replaces the rigid 5-slot cycle with a dynamic sliding-window selector over the candidate pool:
 * - Publisher Diversity: Max 20% (<= 4 cards) per publisher in any 30-card window;
 *   strong bonus for publishers not yet seen in the current 30-card window (guarantees >= 12+ publishers per 30 cards).
 * - Topic Balance: AI/Acceleration (`ai_apple`) is important (~15-20%) but never dominates;
 *   Teaching (`isTeachingRelated` / `german_didactics`) and Counter-Perspectives (`isChallengingPerspective`)
 *   are each steered toward ~10% (~3 cards per 30).
 * - Format Pacing: Smoothly alternates between 20-second quick insights, sourced briefings,
 *   deep essays, visual artworks, contemplative thoughts, music/synthesis, and playful finds.
 */
export function enforceArdsSpacing<T extends FeedItem>(items: T[], minGap = 7): T[] {
  const nonArd: T[] = [];
  const ardList: T[] = [];

  for (const item of items) {
    if (isArdSource(item)) {
      ardList.push(item);
    } else {
      nonArd.push(item);
    }
  }

  if (ardList.length === 0) return [...nonArd];
  if (nonArd.length === 0) return [...ardList];

  const result: T[] = [];
  let ardIndex = 0;
  let lastArdDist = Infinity;

  for (let i = 0; i < nonArd.length; i++) {
    if (ardIndex < ardList.length && lastArdDist >= minGap) {
      result.push(ardList[ardIndex++]);
      lastArdDist = 0;
    }
    result.push(nonArd[i]);
    lastArdDist++;
  }

  // If there are still ARD items left, distribute into slots where neither neighbor is an ARD
  while (ardIndex < ardList.length) {
    const ard = ardList[ardIndex++];
    let bestSlot = -1;
    let maxDist = -1;

    for (let slot = 0; slot <= result.length; slot++) {
      const prevIsArd = slot > 0 ? isArdSource(result[slot - 1]) : false;
      const nextIsArd = slot < result.length ? isArdSource(result[slot]) : false;
      if (!prevIsArd && !nextIsArd) {
        let leftDist = Infinity;
        for (let l = slot - 1; l >= 0; l--) {
          if (isArdSource(result[l])) { leftDist = slot - 1 - l; break; }
        }
        let rightDist = Infinity;
        for (let r = slot; r < result.length; r++) {
          if (isArdSource(result[r])) { rightDist = r - slot; break; }
        }
        const minDist = Math.min(leftDist, rightDist);
        if (minDist > maxDist) {
          maxDist = minDist;
          bestSlot = slot;
        }
      }
    }

    if (bestSlot !== -1) {
      result.splice(bestSlot, 0, ard);
    } else {
      result.push(ard);
    }
  }

  return result;
}

const MULTI_CREATOR_DOMAINS = new Set(['youtube.com', 'm.youtube.com', 'youtu.be', 'reddit.com']);
const GENERIC_CREATOR_LABELS = new Set([
  'youtube',
  'reddit',
  'unknown',
  'verifizierte quelle',
  'test publisher'
]);

function resolveNormalizedCreatorOrSubreddit(item: FeedItem, resolvedDomain: string, urlStr: string): string | null {
  const rawCandidates = [
    item.youtubeMeta?.channelTitle,
    item.sourceBroadcasterName,
    item.sourceReferences?.[0]?.publisher,
    item.externalCommunityScore?.platform
  ];

  for (const raw of rawCandidates) {
    if (!raw) continue;
    let normalized = raw.toLowerCase().replace(/\s+/g, ' ').trim();
    if (!normalized) continue;
    if (resolvedDomain === 'reddit.com' && normalized.startsWith('reddit r/')) {
      normalized = normalized.slice('reddit '.length).trim();
    }
    if (GENERIC_CREATOR_LABELS.has(normalized)) continue;
    return normalized;
  }

  if (resolvedDomain === 'reddit.com' && urlStr) {
    const subMatch = urlStr.match(/\/r\/([^/?#]+)/i);
    if (subMatch?.[1]) {
      return `r/${subMatch[1].toLowerCase()}`;
    }
  }

  return null;
}

/**
 * Returns a normalized domain/publisher key for sliding-window diversity enforcement.
 * Differentiates multi-creator/aggregator domains (YouTube, Reddit) by channel or subreddit.
 */
export function getDomainDiversityKey(item: FeedItem): string {
  if (isArdSource(item)) return 'ard-tagesschau';
  const urlStr = item.canonicalUrl || item.sourceReferences?.[0]?.originalUrl || '';
  let resolvedDomain: string | null = null;

  if (item.sourceDomain && item.sourceDomain.trim().length > 0) {
    const cleanDom = item.sourceDomain.toLowerCase().replace(/^www\./, '').trim();
    if (cleanDom !== 'example.com' && cleanDom !== 'example.org') {
      resolvedDomain = cleanDom;
    }
  }
  if (!resolvedDomain && urlStr) {
    try {
      const host = new URL(urlStr).hostname.toLowerCase().replace(/^www\./, '');
      if (host && host !== 'example.com' && host !== 'example.org') {
        resolvedDomain = host;
      }
    } catch {
      // Fallback to publisher key
    }
  }

  if (resolvedDomain) {
    if (MULTI_CREATOR_DOMAINS.has(resolvedDomain)) {
      const canonicalMultiDomain = resolvedDomain === 'reddit.com' ? 'reddit.com' : 'youtube.com';
      const creatorKey = resolveNormalizedCreatorOrSubreddit(item, canonicalMultiDomain, urlStr);
      if (creatorKey) {
        return `${canonicalMultiDomain}:${creatorKey}`;
      }
      return canonicalMultiDomain;
    }
    return resolvedDomain;
  }

  const pubKey = getNormalizedPublisherKey(item);
  if (pubKey === 'test publisher' || pubKey === 'unknown' || pubKey === 'verifizierte quelle') {
    return `item:${item.id}`;
  }
  return pubKey;
}

export function isArtShowcaseItem(item: Pick<FeedItem, 'format' | 'primaryTopic' | 'space'>): boolean {
  return (
    item.format === 'art_showcase' ||
    item.primaryTopic === 'art_aesthetics' ||
    item.space === 'c/kunst_galerie'
  );
}

/**
 * Identifies static non-art archive items from `REAL_KNOWLEDGE_VAULT` (e.g. `vault-gem-*`
 * historical essays from 1945-2011 or non-art `vault-*` entries) that belong in `timeless` / `gems`
 * or pure offline fallback — never in populated `for_you`, `today`, `discourse`, or `top` streams.
 */
export function isNonArtVaultItem(
  item: Pick<FeedItem, 'id' | 'format' | 'primaryTopic' | 'space'>
): boolean {
  const id = String(item.id || '');
  if (id.startsWith('vault-gem-')) return true;
  if (id.startsWith('vault-') && !isArtShowcaseItem(item)) return true;
  return false;
}

function countNonVaultLiveItems(
  items: readonly Pick<FeedItem, 'id' | 'isStaticFallback'>[]
): number {
  let count = 0;
  for (const item of items) {
    if (item.isStaticFallback === true) continue;
    const id = String(item.id || '');
    if (id.startsWith('vault-') || id.startsWith('init-')) continue;
    count++;
  }
  return count;
}

export function isDailyDigestNewsletter(
  item: Pick<FeedItem, 'id' | 'sourceReferences' | 'sourceBroadcasterName'>
): boolean {
  const pub = `${item.id || ''} ${item.sourceBroadcasterName || ''} ${item.sourceReferences?.[0]?.publisher || ''}`.toLowerCase();
  return /\b(techpresso|tldr|ben'?s\s*bites|bens-bites|rundown\s*ai|import\s*ai|ahead\s*of\s*ai)\b/i.test(pub);
}

function getDailyDigestPublisherKey(
  item: Pick<FeedItem, 'id' | 'sourceReferences' | 'sourceBroadcasterName'>
): string {
  const pub = `${item.id || ''} ${item.sourceBroadcasterName || ''} ${item.sourceReferences?.[0]?.publisher || ''}`.toLowerCase();
  if (/techpresso/.test(pub)) return 'techpresso';
  if (/tldr/.test(pub)) return 'tldr';
  if (/ben'?s\s*bites|bens-bites/.test(pub)) return 'bens-bites';
  if (/rundown\s*ai/.test(pub)) return 'rundown-ai';
  if (/import\s*ai/.test(pub)) return 'import-ai';
  if (/ahead\s*of\s*ai/.test(pub)) return 'ahead-of-ai';
  return getNormalizedPublisherKey(item as FeedItem);
}

/**
 * Keeps at most 1 newest issue (<= maxAgeDays old) per daily digest newsletter publisher.
 */
export function dedupeDailyDigestNewsletters<T extends FeedItem>(
  items: T[],
  maxAgeDays = 7
): T[] {
  const nowMs = Date.now();
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
  const newestByDigest = new Map<string, { item: T; timeMs: number; idx: number }>();

  items.forEach((item, idx) => {
    if (!isDailyDigestNewsletter(item)) return;
    const rawTime = item.publishedAt ? new Date(item.publishedAt).getTime() : NaN;
    const timeMs = isNaN(rawTime) ? nowMs : rawTime;
    if (!isNaN(rawTime) && (nowMs - rawTime) > maxAgeMs) {
      return;
    }
    const key = getDailyDigestPublisherKey(item);
    const prev = newestByDigest.get(key);
    if (!prev || timeMs > prev.timeMs) {
      newestByDigest.set(key, { item, timeMs, idx });
    }
  });

  const winningIds = new Set<string>();
  for (const entry of newestByDigest.values()) {
    winningIds.add(entry.item.id);
  }

  return items.filter(item => !isDailyDigestNewsletter(item) || winningIds.has(item.id));
}

export function getEffectiveSpaceHandle(
  item: Pick<FeedItem, 'space' | 'primaryTopic'>
): string {
  const mapped = TOPIC_SPACE_MAP[item.primaryTopic as TopicTag]?.space;
  const rawSpace = (item.space || '').trim().toLowerCase();
  if (!rawSpace) {
    return (mapped || `c/${item.primaryTopic}`).toLowerCase();
  }
  if (
    (rawSpace === 'c/dialektik' || rawSpace === 'c/philosophie') &&
    item.primaryTopic &&
    item.primaryTopic !== 'philosophy_ethics' &&
    mapped
  ) {
    return mapped.toLowerCase();
  }
  return rawSpace;
}

export function isAggregatorItem(
  item: Pick<FeedItem, 'id' | 'sourceReferences' | 'sourceBroadcasterName' | 'externalCommunityScore'> &
    Partial<Pick<FeedItem, 'format' | 'space' | 'primaryTopic'>>
): boolean {
  if (
    item.format === 'youtube_gem' ||
    item.space === 'c/youtube' ||
    item.primaryTopic === 'youtube_gems'
  ) {
    return false;
  }
  const pub = `${item.sourceBroadcasterName || ''} ${item.sourceReferences?.[0]?.publisher || ''}`.toLowerCase();
  const platform = (item.externalCommunityScore?.platform || '').toLowerCase();
  return (
    /^(?:openweb-)?(?:hn|reddit)-/i.test(item.id || '') ||
    /\((?:via\s+)?(?:hn|hacker news|reddit)\)|^r\//i.test(pub) ||
    platform === 'hn' ||
    platform === 'hacker news'
  );
}

/**
 * Hard Sliding-Window Diversity & Anti-ARD Filter (`enforceCuratedStreamDiversity`):
 * - Max 1 newest issue (<= 7d) per daily digest newsletter publisher.
 * - Strictly no consecutive cards from the same space (`c/...`) when multi-space candidates exist.
 * - Aggregators (`HN` / `Reddit`) spaced by >= 3 intervening cards when alternatives exist.
 * - Max 1 ARD/Tagesschau item per 10 cards (<= 10% of the resulting stream).
 * - Never two items from the same domain within 4 cards of each other (minimum index gap >= 4).
 * - Museum & Artwork diversity in mixed streams.
 */
export function enforceCuratedStreamDiversity<T extends FeedItem>(items: T[]): T[] {
  const deduped = dedupeDailyDigestNewsletters(items, 7);
  if (deduped.length <= 2) {
    return deduped;
  }

  const enforceArdCap = deduped.length > 6;
  const nonArdTotal = deduped.filter(i => !isArdSource(i)).length;
  // Guarantee ARD <= 10% of the final stream: ARD / (nonArd + ARD) <= 0.10 => ARD <= floor(nonArd / 9)
  const maxArdAllowed = enforceArdCap ? Math.max(0, Math.floor(nonArdTotal / 9)) : deduped.length;

  const nonArtTotal = deduped.filter(i => !isArtShowcaseItem(i)).length;
  const enforceMixedArtCap = nonArtTotal >= deduped.length * 0.45 && deduped.length >= 10;
  const maxArtAllowed = enforceMixedArtCap
    ? Math.max(2, Math.floor(nonArtTotal / 7))
    : deduped.length;

  const pool = [...deduped];
  const result: T[] = [];
  let ardPlaced = 0;
  let artPlaced = 0;

  while (pool.length > 0) {
    let pickedIdx = -1;
    const recent9 = result.slice(-9);
    const recent4 = result.slice(-4); // at least 4 intervening cards => >= 5 card gap for artworks
    const recent3 = result.slice(-3); // 3 intervening cards => index difference >= 4
    const lastSpace = result.length > 0 ? getEffectiveSpaceHandle(result[result.length - 1]) : null;
    const secondLastSpace = result.length > 1 ? getEffectiveSpaceHandle(result[result.length - 2]) : null;
    const twoConsecutiveSameSpace = Boolean(lastSpace && secondLastSpace && lastSpace === secondLastSpace);
    const lastWasAgg = result.length > 0 && isAggregatorItem(result[result.length - 1]);
    const ardInRecent9 = recent9.some(x => isArdSource(x));
    const artInRecent4 = recent4.some(x => isArtShowcaseItem(x));
    const aggInRecent3 = recent3.some(x => isAggregatorItem(x));
    const isNonVault = (x: T) => !x.isStaticFallback && !x.id.startsWith('vault-gem-');
    const hasNonArtLeft = pool.some(x => !isArtShowcaseItem(x));
    const hasAltNonVaultSpaceLeft = lastSpace
      ? pool.some(x => isNonVault(x) && getEffectiveSpaceHandle(x) !== lastSpace)
      : false;
    const hasAltAnySpaceLeft = lastSpace
      ? pool.some(x => getEffectiveSpaceHandle(x) !== lastSpace)
      : false;
    const hasNonAggLeft = (lastWasAgg || aggInRecent3) ? pool.some(x => !isAggregatorItem(x)) : false;

    const recent3Keys = new Set(recent3.map(x => getDomainDiversityKey(x)));
    let hasNonCollidingDomainLeft: boolean | null = null;

    for (let i = 0; i < pool.length; i++) {
      const cand = pool[i];
      const candIsArd = isArdSource(cand);
      const candIsArt = isArtShowcaseItem(cand);
      const candIsVaultOrStatic = !isNonVault(cand);
      const candSpace = getEffectiveSpaceHandle(cand);

      if (candIsArd) {
        if (ardPlaced >= maxArdAllowed || (enforceArdCap && ardInRecent9)) {
          continue;
        }
      }

      if (enforceMixedArtCap && candIsArt && hasNonArtLeft) {
        if (
          artPlaced >= maxArtAllowed ||
          artInRecent4 ||
          (nonArtTotal >= 10 && (result.length < 3 || (result.length < 10 && artPlaced >= 1)))
        ) {
          continue;
        }
      }

      const relevantAltSpaceLeft = candIsVaultOrStatic ? hasAltAnySpaceLeft : hasAltNonVaultSpaceLeft;
      if (lastSpace && relevantAltSpaceLeft && candSpace === lastSpace) {
        continue;
      }
      if (twoConsecutiveSameSpace && hasAltAnySpaceLeft && candSpace === lastSpace) {
        continue;
      }

      if ((lastWasAgg || aggInRecent3) && hasNonAggLeft && isAggregatorItem(cand)) {
        continue;
      }

      const domKey = getDomainDiversityKey(cand);
      const domainCollisionIn4 = recent3Keys.has(domKey);
      if (domainCollisionIn4) {
        if (hasNonCollidingDomainLeft === null) {
          hasNonCollidingDomainLeft = pool.some(x => !recent3Keys.has(getDomainDiversityKey(x)));
        }
        if (hasNonCollidingDomainLeft) {
          continue;
        }
      }

      pickedIdx = i;
      break;
    }

    if (pickedIdx === -1) {
      // Remaining pool could not satisfy all soft/window constraints (e.g. homogeneous channel or blocked ARD tail):
      // fall back to picking the first candidate that does not violate the hard ARD cap.
      const isArdViolating = (cand: T) =>
        isArdSource(cand) && (ardPlaced >= maxArdAllowed || (enforceArdCap && ardInRecent9));
      if (enforceMixedArtCap && hasNonArtLeft) {
        pickedIdx = pool.findIndex(cand => !isArdViolating(cand) && !isArtShowcaseItem(cand));
      }
      if (pickedIdx === -1) {
        pickedIdx = pool.findIndex(cand => !isArdViolating(cand));
      }
      if (pickedIdx === -1) {
        break;
      }
    }

    const [chosen] = pool.splice(pickedIdx, 1);
    if (isArdSource(chosen)) {
      ardPlaced++;
    }
    if (isArtShowcaseItem(chosen)) {
      artPlaced++;
    }
    result.push(chosen);
  }

  // Final safety check: ensure ardPlaced / result.length <= 0.10
  if (enforceArdCap) {
    while (result.length > 0) {
      const currentArdCount = result.filter(i => isArdSource(i)).length;
      if (currentArdCount / result.length <= 0.100001) {
        break;
      }
      // Remove the last ARD item if truncated tail pushed ratio above 10%
      for (let k = result.length - 1; k >= 0; k--) {
        if (isArdSource(result[k])) {
          result.splice(k, 1);
          break;
        }
      }
    }
  }

  return result;
}

/**
 * Strict evaluation if an item formats to "gestern" or older relative time.
 * Used to ensure ⚡ Heute never outputs "gestern" or "vor X Tagen".
 */
export function isFormattingToGesternOrOlder(isoString?: string, now: Date = new Date()): boolean {
  if (!isoString) return false;
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return false;
  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 0) return false;
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours >= 18) return true;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays >= 1) return true;
  if (date.getDate() !== now.getDate() && diffHours >= 16) return true;
  return false;
}

/**
 * Enforces the 14-day (336h) relevance-gated recency contract for `Für dich`:
 * - Timeless formats (art showcases, comics/memes, reliable=false gems) remain eligible.
 * - Articles > 14 days (336h) are strictly excluded from the active Discovery stream.
 * - Short breaking-news ticker dispatches (< 110 words) cap at 5 days (120h).
 * - Days 4..14 (72h..336h) remain eligible only when they carry high personal relevance (score >= 0.72 or evergreenGem).
 */
export function isWithin14DayRelevanceWindow(
  item: Pick<
    FeedItem,
    | 'id'
    | 'publishedAt'
    | 'firstSeenAt'
    | 'publicationDateReliable'
    | 'format'
    | 'primaryTopic'
    | 'space'
    | 'isEvergreenGem'
    | 'pinnedManualRunAt'
    | 'wordCount'
    | 'sourceReferences'
    | 'sourceBroadcasterName'
  > & { score?: number },
  nowMs = Date.now()
): boolean {
  if (typeof item.pinnedManualRunAt === 'number' && (nowMs - item.pinnedManualRunAt) <= 30 * 60 * 1000) {
    return true;
  }

  const isVisualTimeless =
    item.format === 'art_showcase' ||
    item.format === 'meme' ||
    item.primaryTopic === 'art_aesthetics' ||
    item.primaryTopic === 'memes_satire' ||
    item.space === 'c/kunst_galerie' ||
    item.space === 'c/memes';
  if (isVisualTimeless) return true;

  const isYoutubeGem =
    item.format === 'youtube_gem' ||
    item.space === 'c/youtube' ||
    item.primaryTopic === 'youtube_gems';
  if (isYoutubeGem && item.isEvergreenGem === true) {
    return true;
  }

  // Undated non-visual entries fall back to firstSeenAt / publishedAt so undated RSS essays still age out after 14 days
  const refDateStr =
    item.publicationDateReliable === false
      ? (item.firstSeenAt || item.publishedAt)
      : item.publishedAt;
  const pubTime = refDateStr ? new Date(refDateStr).getTime() : NaN;
  if (isNaN(pubTime)) return isYoutubeGem || Boolean(item.isEvergreenGem);

  const hoursOld = Math.max(0, (nowMs - pubTime) / (1000 * 60 * 60));
  if (isYoutubeGem) {
    return hoursOld <= 1080; // 45 days for curated YouTube video-essays
  }
  if (hoursOld > 336) return false;

  const wordCount = item.wordCount || 0;
  if (isArdSource(item as FeedItem) && wordCount < 110) {
    return hoursOld <= 120;
  }

  // Days 4..14 require genuine learned high relevance (or explicit evergreen gem status), never low-substance filler
  if (hoursOld > 72 && typeof item.score === 'number') {
    if (item.isEvergreenGem) return true;
    const minScore = hoursOld > 168 ? 0.81 : 0.79;
    return item.score >= minScore;
  }

  return true;
}

export function rankBloomScrollFeed(
  items: ScoredFeedItem[],
  options?: {
    seenItemIds?: ReadonlySet<string>;
    seenRecords?: ReadonlyMap<string, SeenImpressionRecord>;
  }
): ScoredFeedItem[] {
  if (items.length <= 2) return [...items];

  // Pre-filter daily digest newsletters (max 1 newest issue <= 7d per publisher) & deduplicate by id
  const nowMs = Date.now();
  const freshDigests = dedupeDailyDigestNewsletters(items, 7);
  const nonVaultCount = countNonVaultLiveItems(freshDigests);
  const excludeNonArtVault = nonVaultCount >= 15;
  const fresh14dPoolCount = freshDigests.filter(it => {
    if (
      isNonArtVaultItem(it) ||
      it.publicationDateReliable === false ||
      isArtShowcaseItem(it) ||
      it.format === 'meme'
    ) {
      return false;
    }
    const pub = new Date(it.publishedAt).getTime();
    return !isNaN(pub) && Math.max(0, (nowMs - pub) / (1000 * 60 * 60)) <= 336;
  }).length;
  const apply14DayWindow = fresh14dPoolCount >= 6;

  const seenKeys = new Set<string>();
  const remaining: ScoredFeedItem[] = [];
  for (const item of freshDigests) {
    if (excludeNonArtVault && isNonArtVaultItem(item)) {
      continue;
    }
    if (apply14DayWindow && !isNonArtVaultItem(item) && !isWithin14DayRelevanceWindow(item, nowMs)) {
      continue;
    }
    const key = item.id;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    remaining.push(item);
  }

  // Sort initial candidates by personal score + freshness
  remaining.sort((a, b) => (b.score || 0) - (a.score || 0));

  const nonArtFreshCount = remaining.filter(it => {
    if (isArtShowcaseItem(it) || it.format === 'meme' || isNonArtVaultItem(it)) {
      return false;
    }
    if (it.publicationDateReliable === false) return false;
    const t = new Date(it.publishedAt).getTime();
    return !isNaN(t) && t > 0 && (nowMs - t) <= 14 * 24 * 3600 * 1000;
  }).length;
  const guardTopArtSlots = nonArtFreshCount >= 10;

  const selected: ScoredFeedItem[] = [];
  const SLIDING_WINDOW = 6;
  const DIVERSITY_WINDOW = 30;

  const isFresh48hItem = (it: ScoredFeedItem): boolean => {
    if (it.publicationDateReliable === false || isArtShowcaseItem(it) || it.format === 'meme') {
      return false;
    }
    const t = new Date(it.publishedAt).getTime();
    return !isNaN(t) && t > 0 && (nowMs - t) <= 48 * 3600 * 1000;
  };

  while (remaining.length > 0) {
    const pos = selected.length;
    const recentWindow = selected.slice(Math.max(0, pos - SLIDING_WINDOW));
    const window10 = selected.slice(Math.max(0, pos - 10));
    const window30 = selected.slice(Math.max(0, pos - DIVERSITY_WINDOW));
    const lastCard = pos > 0 ? selected[pos - 1] : null;
    const secondLastCard = pos > 1 ? selected[pos - 2] : null;
    const freshInWindow10 = window10.filter(isFresh48hItem).length;
    const targetFreshIn10 = Math.ceil(Math.min(10, window10.length + 1) * 0.70);
    const needsFreshAnchor = freshInWindow10 < targetFreshIn10 && remaining.some(isFresh48hItem);

    // Count publishers & spaces in the last 30 cards
    const pubCounts30 = new Map<string, number>();
    const spaceCounts30 = new Map<string, number>();
    for (const s of window30) {
      const pk = getNormalizedPublisherKey(s);
      pubCounts30.set(pk, (pubCounts30.get(pk) || 0) + 1);
      const sk = getEffectiveSpaceHandle(s);
      spaceCounts30.set(sk, (spaceCounts30.get(sk) || 0) + 1);
    }

    // Count topics in recent 6-card window & 30-card window
    const topicCounts6 = new Map<TopicTag, number>();
    for (const s of recentWindow) {
      topicCounts6.set(s.primaryTopic, (topicCounts6.get(s.primaryTopic) || 0) + 1);
    }
    const topicCounts30 = new Map<TopicTag, number>();
    let teachingCount30 = 0;
    let challengingCount30 = 0;
    let artCount30 = 0;
    let memeCount30 = 0;
    for (const s of window30) {
      topicCounts30.set(s.primaryTopic, (topicCounts30.get(s.primaryTopic) || 0) + 1);
      if (s.isTeachingRelated || s.primaryTopic === 'german_didactics') teachingCount30++;
      if (s.isChallengingPerspective) challengingCount30++;
      if (isArtShowcaseItem(s) || getCardRhythmFormat(s) === 'visual_art') artCount30++;
      if (s.primaryTopic === 'memes_satire' || s.format === 'meme' || s.format === 'comic' || getEffectiveSpaceHandle(s) === 'c/memes') {
        memeCount30++;
      }
    }
    const aiCount30 = topicCounts30.get('ai_apple') || 0;

    const lastRhythm = lastCard ? getCardRhythmFormat(lastCard) : null;
    const lastPub = lastCard ? getNormalizedPublisherKey(lastCard) : null;
    const lastSpace = lastCard ? getEffectiveSpaceHandle(lastCard) : null;
    const secondLastPub = secondLastCard ? getNormalizedPublisherKey(secondLastCard) : null;
    const recent3Domains = selected.slice(-3).map(s => getDomainDiversityKey(s));
    const recent3HasAggregator = selected.slice(-3).some(s => isAggregatorItem(s));
    const recent9HasArd = selected.slice(-9).some(s => isArdSource(s));
    const artInTop10 = selected.slice(0, 10).filter(s => isArtShowcaseItem(s)).length;
    const hasNonArtRemaining = guardTopArtSlots && remaining.some(r => !isArtShowcaseItem(r));

    let bestIdx = 0;
    let bestWindowScore = -Infinity;

    // Evaluate top candidates in remaining pool (plus top challenging/teaching/AI/meme candidates if under target)
    const evalLimit = Math.min(remaining.length, 120);
    const candidateIndices: number[] = [];
    for (let i = 0; i < evalLimit; i++) {
      candidateIndices.push(i);
    }
    if (challengingCount30 < 2 || teachingCount30 < 2 || aiCount30 < 3 || memeCount30 < 2) {
      let extraChall = 0;
      let extraTeach = 0;
      let extraAi = 0;
      let extraMeme = 0;
      for (let i = evalLimit; i < remaining.length; i++) {
        const c = remaining[i];
        if (challengingCount30 < 2 && c.isChallengingPerspective && extraChall < 10) {
          candidateIndices.push(i);
          extraChall++;
        } else if (teachingCount30 < 2 && (c.isTeachingRelated || c.primaryTopic === 'german_didactics') && extraTeach < 10) {
          candidateIndices.push(i);
          extraTeach++;
        } else if (aiCount30 < 3 && c.primaryTopic === 'ai_apple' && extraAi < 10) {
          candidateIndices.push(i);
          extraAi++;
        } else if (
          memeCount30 < 2 &&
          (c.primaryTopic === 'memes_satire' || c.format === 'meme' || c.format === 'comic' || getEffectiveSpaceHandle(c) === 'c/memes') &&
          extraMeme < 4
        ) {
          candidateIndices.push(i);
          extraMeme++;
        }
        if (extraChall >= 10 && extraTeach >= 10 && extraAi >= 10 && extraMeme >= 4) break;
      }
    }

    for (const i of candidateIndices) {
      const cand = remaining[i];
      const pubKey = getNormalizedPublisherKey(cand);
      const domKey = getDomainDiversityKey(cand);
      const candSpace = getEffectiveSpaceHandle(cand);
      const pubCountIn30 = pubCounts30.get(pubKey) || 0;
      const spaceCountIn30 = spaceCounts30.get(candSpace) || 0;
      const topicCountIn6 = topicCounts6.get(cand.primaryTopic) || 0;
      const topicCountIn30 = topicCounts30.get(cand.primaryTopic) || 0;
      const candRhythm = getCardRhythmFormat(cand);
      const isCandArd = isArdSource(cand);
      const isCandAgg = isAggregatorItem(cand);
      const isLastArd = lastCard ? isArdSource(lastCard) : false;

      let utility = (cand.score || 0.7) * 2.5;

      // 0. Main-feed choreography: strictly avoid consecutive identical space & cap aggregators
      if (lastSpace && candSpace === lastSpace) {
        utility -= 300.0;
      }
      if (isCandAgg && recent3HasAggregator) {
        utility -= 220.0;
      }
      if (spaceCountIn30 === 0) {
        utility += 0.55;
      } else if (spaceCountIn30 >= 4) {
        utility -= 2.2;
      }

      // 1. Strict ARD Cap: Max 10% (at most 1 per 10 cards), NEVER consecutive
      if (isCandArd) {
        if (isLastArd) {
          utility -= 250.0; // Strictly never consecutive!
        }
        if (recent9HasArd) {
          utility -= 150.0; // Enforce at least 9 non-ARD cards spacing (1 in 10)
        }
        const ardCount30 = window30.filter(c => isArdSource(c)).length;
        if (ardCount30 >= 3) {
          utility -= 180.0; // Max 3 per 30 cards (<= 10%)
        }
      }

      // Hard 4-card domain spacing penalty
      if (recent3Domains.includes(domKey)) {
        utility -= 80.0;
      }

      // Publisher Diversity & <= 2 per 30-card publisher cap
      if (pubKey === lastPub) {
        utility -= 15.0; // Never repeat same publisher back-to-back if avoidable
      } else if (pubKey === secondLastPub) {
        utility -= 8.0;
      }
      if (pubCountIn30 === 0) {
        utility += 0.35; // Balanced bonus for bringing a fresh voice without overriding strong relevance
      } else if (pubCountIn30 === 1) {
        utility += 0.10;
      } else if (pubCountIn30 >= 2) {
        utility -= 80.0; // Strictly cap normal publishers at <= 2 per 30 cards
      }

      // Balancing international & quality source boost (DLF, ZEIT, Spiegel, Guardian, Politico, Eurozine, etc.)
      if (isBalancingSource(cand)) {
        utility += 0.08;
      }

      // Regional Saxony (Dresden / Leipzig) boost
      if (matchesSaxonyRegion(cand)) {
        utility += 0.05;
      }

      // Permanent Seen Quarantine Penalty & Pre-2016 Archive Demotion (Pillar 4)
      const seenRecord = options?.seenRecords?.get(cand.id);
      if (seenRecord) {
        const firstSeenMs = new Date(seenRecord.firstSeenAt).getTime();
        const ageSinceFirstSeenMs = Date.now() - firstSeenMs;
        if (ageSinceFirstSeenMs > 20 * 60 * 1000) {
          utility -= 450.0;
        }
      }
      if (options?.seenItemIds?.has(cand.id)) {
        utility -= 500.0;
      }
      if (isNonArtVaultItem(cand) || (!isArtShowcaseItem(cand) && cand.isStaticFallback)) {
        const pubYear = cand.publishedAt ? new Date(cand.publishedAt).getUTCFullYear() : NaN;
        if (cand.isStaticFallback || isNonArtVaultItem(cand) || (!isNaN(pubYear) && pubYear < 2016)) {
          utility -= 24.0;
        }
      }

      // Exponential freshness decay for breaking / daily news items older than 36 hours
      const isBreakingOrDailyNews =
        cand.format === 'sourced_update' ||
        cand.isDailyEdition ||
        cand.sourceTrustLevel === 'public_broadcaster' ||
        cand.sourceDomain === 'tagesschau.de';

      if (isBreakingOrDailyNews && cand.publishedAt) {
        const pubTime = new Date(cand.publishedAt).getTime();
        if (!isNaN(pubTime) && pubTime > 0) {
          const ageHours = (Date.now() - pubTime) / (3600 * 1000);
          if (ageHours > 36) {
            const decay = Math.min(6.0, ((ageHours - 36) / 24) * 2.0);
            utility -= decay;
          }
        }
      }

      // 2. Topic Transition & Anti-Dominance
      if (lastCard && cand.primaryTopic === lastCard.primaryTopic) {
        utility -= 25.0; // Strictly prevent consecutive identical primaryTopic
      }
      if (topicCountIn6 >= 2) {
        utility -= 1.5;
      }
      // Keep AI/Acceleration vibrant (~16-20%) without dominating
      if (cand.primaryTopic === 'ai_apple') {
        if (topicCountIn6 >= 1) utility -= 1.1;
        if (topicCountIn30 >= 6) utility -= 3.0;
        else if (aiCount30 < 3 && topicCountIn6 === 0 && pos >= 2) utility += 0.68;
      }
      // Keep Wikipedia / Encyclopedia, Memes & Artworks balanced (never crowd out intellectually rich reading)
      if (cand.sourceTrustLevel === 'encyclopedia' && pubCountIn30 >= 2) {
        utility -= 2.5;
      }
      if (cand.primaryTopic === 'memes_satire' || cand.format === 'meme' || cand.format === 'comic' || candSpace === 'c/memes') {
        const recentMemeCount = recentWindow.filter(
          x =>
            x.primaryTopic === 'memes_satire' ||
            x.format === 'meme' ||
            x.format === 'comic' ||
            getEffectiveSpaceHandle(x) === 'c/memes'
        ).length;
        if (recentMemeCount >= 1) utility -= 2.2;
        else if (memeCount30 >= 3) utility -= 3.2;
        else if (pos >= 3 && pos % 7 >= 5 && memeCount30 < 2) {
          utility += 2.6;
        } else if (pos >= 4 && memeCount30 === 0) {
          utility += 1.9;
        }
      }
      if (candRhythm === 'visual_art' || isArtShowcaseItem(cand)) {
        const recentArtCount = recentWindow.filter(
          x => getCardRhythmFormat(x) === 'visual_art' || isArtShowcaseItem(x)
        ).length;
        if (guardTopArtSlots && hasNonArtRemaining && pos < 3) {
          utility -= 400.0; // Never occupy Slot #1-#3 when >= 10 non-art fresh articles are available
        } else if (guardTopArtSlots && hasNonArtRemaining && pos < 10 && artInTop10 >= 1) {
          utility -= 400.0; // Max 1 artwork in top 10 when >= 10 non-art fresh articles exist
        } else if (artCount30 >= 3) {
          utility -= 3.2;
        } else if (recentArtCount >= 1) {
          utility -= 1.8;
        } else if (pos >= 3) {
          utility += 0.22;
        }
      }

      // 3. ~10% Teaching & ~10% Counter-Perspective Target Steering
      const isTeach = cand.isTeachingRelated || cand.primaryTopic === 'german_didactics';
      const isChall = cand.isChallengingPerspective;
      const targetTeachCount = Math.max(1, Math.round((window30.length + 1) * 0.10));
      const targetChallCount = Math.max(1, Math.round((window30.length + 1) * 0.10));

      if (isTeach) {
        if (teachingCount30 < targetTeachCount && (pos % 9 === 3 || pos % 9 === 4 || (pos >= 14 && teachingCount30 < 2))) {
          utility += 2.4;
        } else if (teachingCount30 > targetTeachCount + 1) {
          utility -= 1.1;
        }
      }

      if (isChall) {
        if (
          pos >= 3 &&
          challengingCount30 < targetChallCount &&
          (pos % 6 === 4 || pos % 6 === 5 || (pos >= 12 && challengingCount30 < 2))
        ) {
          utility += 2.4;
        } else if (challengingCount30 > targetChallCount + 2) {
          utility -= 0.75;
        }
      }

      // 4. Broad Domain Coverage
      if (topicCountIn30 === 0) {
        utility += 0.42;
      } else if (topicCountIn6 === 0) {
        utility += 0.18;
      }

      // 5. Format Rhythm Transition
      if (lastRhythm && candRhythm !== lastRhythm) {
        utility += 0.15;
      }
      if (candRhythm === 'quick_20s' && lastRhythm === 'deep_essay') {
        utility += 0.15;
      }

      // 0a. 70/30 Daily Freshness Choreography (~70% < 48h fresh dispatches + ~30% high-relevance 3-14d deep essays)
      const candReliablePub =
        cand.publicationDateReliable !== false && cand.publishedAt
          ? new Date(cand.publishedAt).getTime()
          : NaN;
      const candAgeHours = !isNaN(candReliablePub) && candReliablePub > 0
        ? Math.max(0, (nowMs - candReliablePub) / 3600_000)
        : Infinity;
      const candIsFresh48h =
        !isArtShowcaseItem(cand) &&
        cand.format !== 'meme' &&
        candAgeHours <= 48;

      if (candIsFresh48h) {
        utility += candAgeHours <= 24 ? 1.85 : 1.15;
        if (needsFreshAnchor) {
          utility += 2.25;
        }
      } else if (!isArtShowcaseItem(cand) && cand.format !== 'meme') {
        if (needsFreshAnchor) {
          utility -= 1.60;
        } else if ((cand.score || 0) >= 0.82 && (cand.wordCount || 0) >= 140) {
          // Earned 30% Deep-Essay Slot for genuinely high-relevance 3-14d essays
          utility += 0.85;
        }
      }

      // 6. Visual Rhythm & Image Emphasis (balanced pacing without letting old thumbnails crush fresh text)
      const candHasAuthenticImg = Boolean(
        cand.imageUrl &&
        cand.hasAuthenticImage !== false &&
        !cand.imageUrl.includes('images.unsplash.com')
      );
      const lastHasAuthenticImg = Boolean(
        lastCard?.imageUrl &&
        lastCard?.hasAuthenticImage !== false &&
        !lastCard?.imageUrl.includes('images.unsplash.com')
      );
      if (candHasAuthenticImg) {
        utility += 0.65;
        if (lastCard && !lastHasAuthenticImg) {
          utility += 0.95;
        }
      } else if (lastCard && !lastHasAuthenticImg) {
        utility -= 1.25;
      }

      if (utility > bestWindowScore) {
        bestWindowScore = utility;
        bestIdx = i;
      }
    }

    const [chosen] = remaining.splice(bestIdx, 1);
    selected.push(chosen);
  }

  return enforceCuratedStreamDiversity(selected);
}

/**
 * Interleaves a genuine "Überraschungs-Impuls" (Serendipity Slot) every 5th-6th card
 * (indices 5, 11, 17, 23...) in the `for_you` stream: a high-substance (`curationScore >= 7.5`)
 * mind-expanding item outside the dominant top 2 topics of the preceding window.
 */
export function interleaveSerendipitySlot(
  items: ScoredFeedItem[],
  seenItemIds?: ReadonlySet<string>
): ScoredFeedItem[] {
  if (items.length < 6) return items;

  const isEligibleSerendipityCandidate = (cand: ScoredFeedItem): boolean => {
    if (seenItemIds?.has(cand.id)) return false;
    if (cand.isStaticFallback) return false;
    if (isNonArtVaultItem(cand)) return false;
    return true;
  };

  const result = [...items];

  // Determine the two most frequent topics in the top 10 items (the user's dominant top 2 topics)
  const topWindow = result.slice(0, Math.min(10, result.length));
  const topicFrequency = new Map<string, number>();
  for (const item of topWindow) {
    topicFrequency.set(item.primaryTopic, (topicFrequency.get(item.primaryTopic) ?? 0) + 1);
  }
  const dominantTop2Topics = new Set(
    [...topicFrequency.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([t]) => t)
  );

  for (let slotIdx = 5; slotIdx < result.length; slotIdx += 6) {
    const recentSlice = result.slice(Math.max(0, slotIdx - 4), slotIdx);
    const recentTopics = new Set(recentSlice.map(x => x.primaryTopic));
    const currentAtSlot = result[slotIdx];

    const isAlreadySerendipitous =
      isEligibleSerendipityCandidate(currentAtSlot) &&
      (currentAtSlot.curationScore ?? 7.8) >= 7.5 &&
      !dominantTop2Topics.has(currentAtSlot.primaryTopic) &&
      !recentTopics.has(currentAtSlot.primaryTopic);

    if (isAlreadySerendipitous) {
      continue;
    }

    // Look ahead for a high-quality mind-expanding unseen item outside dominantTop2Topics and recentTopics
    const prevSpace = slotIdx > 0 ? getEffectiveSpaceHandle(result[slotIdx - 1]) : null;
    const nextSpace = slotIdx < result.length ? getEffectiveSpaceHandle(result[slotIdx]) : null;
    const hasOtherArtInTop10 = (excludeIdx: number): boolean =>
      slotIdx < 10 &&
      result.slice(0, Math.min(10, result.length)).some((x, idx) => idx !== excludeIdx && isArtShowcaseItem(x));
    let swapCandidateIdx = -1;
    for (let j = slotIdx + 1; j < result.length; j++) {
      const cand = result[j];
      if (!isEligibleSerendipityCandidate(cand)) continue;
      if (isArtShowcaseItem(cand) && hasOtherArtInTop10(j)) continue;
      const candSpace = getEffectiveSpaceHandle(cand);
      if (candSpace === prevSpace || candSpace === nextSpace) continue;
      const score = cand.curationScore ?? 7.8;
      const isSerendipitousFormat =
        cand.format === 'surprising_connection' ||
        cand.format === 'art_showcase' ||
        cand.format === 'long_invitation' ||
        cand.isEvergreenGem === true ||
        cand.isChallengingPerspective === true;

      if (
        score >= 7.5 &&
        !dominantTop2Topics.has(cand.primaryTopic) &&
        !recentTopics.has(cand.primaryTopic) &&
        (isSerendipitousFormat || score >= 8.0)
      ) {
        swapCandidateIdx = j;
        break;
      }
    }

    // Fallback 1: any eligible unseen item with score >= 7.5 not in recentTopics avoiding space collision
    if (swapCandidateIdx === -1) {
      for (let j = slotIdx + 1; j < result.length; j++) {
        const cand = result[j];
        if (!isEligibleSerendipityCandidate(cand)) continue;
        if (isArtShowcaseItem(cand) && hasOtherArtInTop10(j)) continue;
        const candSpace = getEffectiveSpaceHandle(cand);
        if (candSpace === prevSpace || candSpace === nextSpace) continue;
        const score = cand.curationScore ?? 7.8;
        if (score >= 7.5 && !recentTopics.has(cand.primaryTopic)) {
          swapCandidateIdx = j;
          break;
        }
      }
    }

    // Fallback 2: if no space-distinct candidate exists, still place eligible serendipity outside dominantTop2/recentTopics
    if (swapCandidateIdx === -1) {
      for (let j = slotIdx + 1; j < result.length; j++) {
        const cand = result[j];
        if (!isEligibleSerendipityCandidate(cand)) continue;
        if (isArtShowcaseItem(cand) && hasOtherArtInTop10(j)) continue;
        const score = cand.curationScore ?? 7.8;
        if (score >= 7.5 && !dominantTop2Topics.has(cand.primaryTopic) && !recentTopics.has(cand.primaryTopic)) {
          swapCandidateIdx = j;
          break;
        }
      }
    }

    if (swapCandidateIdx !== -1) {
      const [serendipityItem] = result.splice(swapCandidateIdx, 1);
      result.splice(slotIdx, 0, serendipityItem);
    }
  }

  return result;
}

/**
 * Alias kept for backward compatibility across components and tests.
 * Uses the sliding-window Bloom-Ranking algorithm.
 */
export function interleaveForAddictiveLearning(items: ScoredFeedItem[], pinnedIds: readonly string[] = []): ScoredFeedItem[] {
  return sortFeedForDisplay(items, 'for_you', { pinnedIds, interleave: true });
}

export type FeedSortMode =
  | 'for_you'
  | 'today'
  | 'discourse'
  | 'discourse_14d'
  | 'top'
  | 'top_30d'
  | 'timeless'
  | 'hot'
  | 'new'
  | 'gems';

export interface SortFeedOptions {
  pinnedIds?: readonly string[];
  interleave?: boolean;
  ignorePins?: boolean;
  seenItemIds?: ReadonlySet<string>;
  seenRecords?: ReadonlyMap<string, SeenImpressionRecord>;
}

/** The final presentation boundary: pin order wins over every score and diversity rule unless ignorePins is true. */
const DISJOINT_HORIZON_TOP_N = 10;
const DISJOINT_HORIZON_MIN_POOL = 24;

const DISCOURSE_FLAGSHIP_ESSAY_DOMAINS: readonly string[] = [
  'aeon.co',
  'psyche.co',
  'quantamagazine.org',
  'spektrum.de',
  'deutschlandfunkkultur.de',
  '54books.de',
  'fs.blog',
  'publicdomainreview.org',
  'themarginalian.org',
  'dailynous.com',
  'plato.stanford.edu',
  'philosophynow.org',
  'asteriskmag.com',
  'construction-physics.com',
  'daily.bandcamp.com'
];

function isDiscourseFlagshipEssayPublisher(item: FeedItem): boolean {
  const candidates: string[] = [];
  if (item.sourceDomain) {
    candidates.push(item.sourceDomain.toLowerCase().replace(/^www\./, '').trim());
  }
  for (const rawUrl of [item.canonicalUrl, item.sourceReferences?.[0]?.originalUrl]) {
    if (!rawUrl) continue;
    try {
      candidates.push(new URL(rawUrl).hostname.toLowerCase().replace(/^www\./, '').trim());
    } catch {
      candidates.push(rawUrl.toLowerCase());
    }
  }
  for (const candidate of candidates) {
    if (!candidate) continue;
    for (const domain of DISCOURSE_FLAGSHIP_ESSAY_DOMAINS) {
      if (candidate === domain || candidate.endsWith(`.${domain}`)) {
        return true;
      }
    }
  }
  return false;
}

function hasSubstantivePerspective(item: FeedItem): boolean {
  return Boolean(
    item.isChallengingPerspective ||
    (item.perspectiveDetails && Object.keys(item.perspectiveDetails).length > 0)
  );
}

/**
 * Disjoint Horizon Tabs: moves items that already lead another horizon's top-N to the back,
 * so ⚡ Heute, 🧭 Diskurs, 🏆 Top and 💎 Zeitlos present genuinely different leaderboards.
 */
function demoteItemsLeadingOtherHorizons(
  sorted: ScoredFeedItem[],
  pool: ScoredFeedItem[],
  otherModes: FeedSortMode[],
  seenItemIds?: ReadonlySet<string>,
  seenRecords?: ReadonlyMap<string, SeenImpressionRecord>,
  config?: { minPool?: number; topN?: number }
): ScoredFeedItem[] {
  const minPool = config?.minPool ?? DISJOINT_HORIZON_MIN_POOL;
  const topN = config?.topN ?? DISJOINT_HORIZON_TOP_N;
  if (pool.length < minPool || otherModes.length === 0) return sorted;

  const collectLeaderIds = (modes: FeedSortMode[], limit: number): Set<string> => {
    const ids = new Set<string>();
    for (const other of modes) {
      const otherTop = sortFeedForDisplay(pool, other, { ignorePins: true, interleave: true, seenItemIds, seenRecords })
        .slice(0, limit);
      for (const it of otherTop) ids.add(it.id);
    }
    return ids;
  };

  let leaderIds = collectLeaderIds(otherModes, topN);
  let fresh = sorted.filter(it => !leaderIds.has(it.id));

  // If combining multiple modes exhausts a medium pool, still guarantee top-5 disjointness from the primary mode
  if (fresh.length < topN && (otherModes.length > 1 || topN > 5)) {
    const fallbackTopN = Math.min(5, topN);
    leaderIds = collectLeaderIds([otherModes[0]], fallbackTopN);
    fresh = sorted.filter(it => !leaderIds.has(it.id));
    if (fresh.length < fallbackTopN) return sorted;
  } else if (fresh.length < topN) {
    return sorted;
  }

  const demoted = sorted.filter(it => leaderIds.has(it.id));
  return [...fresh, ...demoted];
}

export function isHivemindLearningCard(item: Pick<FeedItem, 'space' | 'hivemindMeta' | 'memeMeta' | 'factReviewStatus'>): boolean {
  return Boolean(
    item.hivemindMeta?.trackId ||
    item.memeMeta?.trackId ||
    item.space === 'c/hivemind' ||
    item.factReviewStatus === 'pedagogical_concept'
  );
}

function hasVerifiedFeedImage(item: FeedItem): boolean {
  return Boolean(
    item.imageUrl &&
    item.hasAuthenticImage !== false &&
    !item.imageUrl.includes('images.unsplash.com')
  );
}

/**
 * Eligibility contract for "⚡ Heute":
 * Strict current news & recent dispatches ONLY — excludes Hivemind cards, art showcases,
 * evergreen vaults, old academic DOAJ/Crossref/OpenAlex papers, foreign titles, and wet-lab protocols.
 */
function isEligibleForTodayNews(
  item: ScoredFeedItem,
  nowMs: number,
  maxAgeMs: number,
  precomputedPubTime?: number
): boolean {
  if (item.publicationDateReliable === false) return false;
  if (isHivemindLearningCard(item)) return false;
  if (isArtShowcaseItem(item) || item.isEvergreenGem || isNonArtVaultItem(item) || item.isStaticFallback) return false;

  // Fast timestamp gate BEFORE expensive language/regex checks so stale items exit in O(1)
  const pubTime = precomputedPubTime !== undefined ? precomputedPubTime : Date.parse(item.publishedAt);
  if (isNaN(pubTime) || pubTime <= 0) return false;
  const futureToleranceMs = 24 * 3600 * 1000;
  const ageMs = nowMs - pubTime;
  if (ageMs < -futureToleranceMs || ageMs > maxAgeMs) return false;

  if (
    item.sourceTrustLevel === 'peer_reviewed' ||
    item.sourceDomain === 'openalex.org' ||
    item.sourceDomain === 'doaj.org' ||
    item.id.startsWith('openweb-openalex-') ||
    item.id.startsWith('openweb-doaj-') ||
    item.id.startsWith('openweb-crossref-')
  ) {
    return false;
  }

  const langContext = `${item.subtitle || ''} ${item.feedText || ''}`;
  if (!isSupportedFeedLanguage(item.title || '', langContext)) {
    return false;
  }
  if (IRRELEVANT_WETLAB_OR_NICHE_ACADEMIC_REGEX.test(`${item.title || ''} ${langContext}`)) {
    return false;
  }

  return true;
}

/**
 * Interleaves news domains in "⚡ Heute" with true source diversity ("Quellenvielfalt"):
 * - Caps ARD/Tagesschau to at most ~20-25% (max 5 total when diverse non-ARD sources exist)
 *   and enforces at least 3 non-ARD items between any two ARD items.
 * - Enforces round-robin domain rotation (no consecutive identical domains, max 2 per domain
 *   in the top 12 and max 3 per domain overall while other domains remain).
 */
export function interleaveTodayNewsStream<T extends FeedItem>(items: T[]): T[] {
  if (items.length <= 2) return items;

  const rawNonArd: T[] = [];
  const rawArd: T[] = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (isArdSource(it)) {
      rawArd.push(it);
    } else {
      rawNonArd.push(it);
    }
  }

  if (rawNonArd.length === 0) {
    return rawArd.slice(0, 8);
  }

  // Round-robin domain interleave for all non-ARD sources (never back-to-back identical domain).
  // Precompute domain keys ONCE and inspect only each domain queue's head (O(N * D) instead of O(N^2)).
  const domainQueues = new Map<string, { items: { item: T; origIdx: number }[]; head: number; count: number }>();
  for (let i = 0; i < rawNonArd.length; i++) {
    const item = rawNonArd[i];
    const dom = getDomainDiversityKey(item);
    let q = domainQueues.get(dom);
    if (!q) {
      q = { items: [], head: 0, count: 0 };
      domainQueues.set(dom, q);
    }
    q.items.push({ item, origIdx: i });
  }

  const distinctNonArdDomains = domainQueues.size;
  const activeDomains = Array.from(domainQueues.keys());
  const wovenNonArd: T[] = [];
  const wovenDomains: string[] = [];
  const windowSize = Math.min(3, Math.max(1, distinctNonArdDomains - 1));

  while (activeDomains.length > 0) {
    const maxPerDomainNow = wovenNonArd.length < 12 ? 2 : 3;
    const recentStart = Math.max(0, wovenDomains.length - windowSize);

    let bestActivePos = 0;
    let bestScore = -Infinity;
    for (let dIdx = 0; dIdx < activeDomains.length; dIdx++) {
      const dom = activeDomains[dIdx];
      const q = domainQueues.get(dom)!;
      const headEntry = q.items[q.head];
      let score = -headEntry.origIdx * 0.35 - q.count * 30;

      let inRecent = false;
      for (let r = recentStart; r < wovenDomains.length; r++) {
        if (wovenDomains[r] === dom) {
          inRecent = true;
          break;
        }
      }
      if (inRecent) score -= 140;
      if (distinctNonArdDomains >= 4 && q.count >= maxPerDomainNow) score -= 240;

      if (score > bestScore) {
        bestScore = score;
        bestActivePos = dIdx;
      }
    }

    const chosenDom = activeDomains[bestActivePos];
    const chosenQueue = domainQueues.get(chosenDom)!;
    const picked = chosenQueue.items[chosenQueue.head++].item;
    chosenQueue.count++;
    if (chosenQueue.head >= chosenQueue.items.length) {
      activeDomains.splice(bestActivePos, 1);
    }
    wovenNonArd.push(picked);
    wovenDomains.push(chosenDom);
  }

  // Cap ARD/Tagesschau strictly based on available non-ARD items so ARD never forms clusters or tails
  const maxArdAllowed =
    wovenNonArd.length >= 6
      ? Math.min(5, Math.max(2, Math.floor(wovenNonArd.length / 3)))
      : Math.min(wovenNonArd.length + 1, 4);
  const keptArd = rawArd.slice(0, maxArdAllowed);
  if (keptArd.length === 0) return wovenNonArd;

  // Deterministic spacing: >= 3 non-ARD items between any 2 ARD items when wovenNonArd >= 6
  const minGap = wovenNonArd.length >= 6 ? 3 : 1;
  const evenGap = Math.max(minGap, Math.floor(wovenNonArd.length / keptArd.length));
  const result: T[] = [];

  let nonIdx = 0;
  let ardIdx = 0;

  // Only put ARD first if it's a Saxony local breaking lead and there are non-ARD items to follow
  if (matchesSaxonyRegion(keptArd[0]) || wovenNonArd.length < 2) {
    result.push(keptArd[ardIdx++]);
  } else {
    const leadCount = Math.min(2, wovenNonArd.length);
    for (let c = 0; c < leadCount; c++) {
      result.push(wovenNonArd[nonIdx++]);
    }
    result.push(keptArd[ardIdx++]);
  }

  while (nonIdx < wovenNonArd.length) {
    for (let step = 0; step < evenGap && nonIdx < wovenNonArd.length; step++) {
      result.push(wovenNonArd[nonIdx++]);
    }
    if (ardIdx < keptArd.length) {
      // Only place trailing ARD item if either more non-ARD items follow OR previous card wasn't ARD
      const prevWasArd = result.length > 0 && isArdSource(result[result.length - 1]);
      if (!prevWasArd) {
        result.push(keptArd[ardIdx++]);
      }
    }
  }

  return result;
}

/**
 * Enforces strict anti-clustering even across pinned / newly arrived items:
 * - Never places > 2 items of the same space consecutively (when any alternative exists)
 * - Never places > 1 (HN) / aggregator item back-to-back (when any alternative exists)
 * Preserves pin priority order as closely as possible without violating clustering guards.
 */
function enforcePinAndStreamAntiClustering<T extends FeedItem>(pins: T[], body: T[]): T[] {
  const totalLen = pins.length + body.length;
  if (totalLen <= 1) return totalLen === 0 ? [] : [...pins, ...body];

  const items: T[] = new Array(totalLen);
  const spaces: string[] = new Array(totalLen);
  const isAggs = new Uint8Array(totalLen);
  const used = new Uint8Array(totalLen);

  let idx = 0;
  for (let i = 0; i < pins.length; i++, idx++) {
    items[idx] = pins[i];
    spaces[idx] = getEffectiveSpaceHandle(pins[i]);
    isAggs[idx] = isAggregatorItem(pins[i]) ? 1 : 0;
  }
  for (let i = 0; i < body.length; i++, idx++) {
    items[idx] = body[i];
    spaces[idx] = getEffectiveSpaceHandle(body[i]);
    isAggs[idx] = isAggregatorItem(body[i]) ? 1 : 0;
  }

  const result: T[] = new Array(totalLen);
  let last1Space: string | null = null;
  let last2Space: string | null = null;
  let lastWasAgg = false;
  let firstUnused = 0;

  for (let out = 0; out < totalLen; out++) {
    while (firstUnused < totalLen && used[firstUnused] === 1) {
      firstUnused++;
    }
    const twoConsecutiveSameSpace = Boolean(last1Space && last2Space && last1Space === last2Space);

    let chosenIdx = -1;
    // Fast path: check head candidate first (most items already satisfy both guards)
    if (
      firstUnused < totalLen &&
      !(twoConsecutiveSameSpace && spaces[firstUnused] === last1Space) &&
      !(lastWasAgg && isAggs[firstUnused] === 1)
    ) {
      chosenIdx = firstUnused;
    } else {
      // Pass 1: satisfy both anti-clustering constraints
      for (let i = firstUnused; i < totalLen; i++) {
        if (used[i] === 1) continue;
        const violatesSpace = twoConsecutiveSameSpace && spaces[i] === last1Space;
        const violatesAgg = lastWasAgg && isAggs[i] === 1;
        if (!violatesSpace && !violatesAgg) {
          chosenIdx = i;
          break;
        }
      }
      // Pass 2: if all remaining violate at least one constraint, avoid back-to-back aggregators first
      if (chosenIdx === -1 && lastWasAgg) {
        for (let i = firstUnused; i < totalLen; i++) {
          if (used[i] === 1) continue;
          if (isAggs[i] === 0) {
            chosenIdx = i;
            break;
          }
        }
      }
      // Pass 3: avoid > 2 consecutive same space
      if (chosenIdx === -1 && twoConsecutiveSameSpace) {
        for (let i = firstUnused; i < totalLen; i++) {
          if (used[i] === 1) continue;
          if (spaces[i] !== last1Space) {
            chosenIdx = i;
            break;
          }
        }
      }
      if (chosenIdx === -1) chosenIdx = firstUnused;
    }

    used[chosenIdx] = 1;
    result[out] = items[chosenIdx];
    last2Space = last1Space;
    last1Space = spaces[chosenIdx];
    lastWasAgg = isAggs[chosenIdx] === 1;
  }

  return result;
}

export function sortFeedForDisplay(
  items: ScoredFeedItem[],
  requestedMode: FeedSortMode,
  options: SortFeedOptions = {}
): ScoredFeedItem[] {
  const mode: FeedSortMode =
    requestedMode === 'discourse_14d' ? 'discourse' : requestedMode === 'top_30d' ? 'top' : requestedMode;
  const unique = new Map(items.map(item => [item.id, item]));
  const pinned = (options.ignorePins ? [] : (options.pinnedIds ?? [])).flatMap(id => {
    const item = unique.get(id);
    if (!item) return [];
    unique.delete(id);
    return [item];
  });

  // Pin-to-Top Guarantee: items with recent pinnedManualRunAt (within 15 minutes) sort to index 0, 1, 2...
  const nowMs = Date.now();
  const FIFTEEN_MIN_MS = 15 * 60 * 1000;
  const manualPinned: ScoredFeedItem[] = [];
  if (!options.ignorePins) {
    for (const item of [...unique.values()]) {
      if (typeof item.pinnedManualRunAt === 'number' && (nowMs - item.pinnedManualRunAt) <= FIFTEEN_MIN_MS) {
        manualPinned.push(item);
        unique.delete(item.id);
      }
    }
    manualPinned.sort((a, b) => (b.pinnedManualRunAt || 0) - (a.pinnedManualRunAt || 0));
  }
  const remaining = [...unique.values()];
  const effectiveTopPins = [...manualPinned, ...pinned];

  const isGem = (item: ScoredFeedItem) =>
    Boolean(item.isEvergreenGem) ||
    ['art_showcase', 'youtube_gem', 'book_masterpiece', 'meme', 'opportunity_radar', 'long_invitation', 'surprising_connection'].includes(item.format) ||
    ['museum_collection', 'encyclopedia', 'peer_reviewed'].includes(item.sourceTrustLevel || '');

  const excludeNonArtVaultInLiveHorizons = countNonVaultLiveItems(remaining) >= 15;
  const liveHorizonTopPins = excludeNonArtVaultInLiveHorizons
    ? effectiveTopPins.filter(item => !isNonArtVaultItem(item))
    : effectiveTopPins;

  // 1. "🔥 Für dich" (Default Smart Mix): Bloom-Ranking + Seen-Rotation + Serendipity Slot + Strict Diversity Caps
  if (mode === 'for_you' || (mode === 'hot' && options.interleave)) {
    const ranked = rankBloomScrollFeed(remaining, {
      seenItemIds: options.seenItemIds,
      seenRecords: options.seenRecords
    });
    const withSerendipity = interleaveSerendipitySlot(ranked, options.seenItemIds);
    return enforcePinAndStreamAntiClustering(liveHorizonTopPins, withSerendipity);
  }

  // 2a. "⚡ Heute" (True Today News Contract: diverse current news <= 18h / <= 36h, NEVER Hivemind or old papers, capped ARD)
  if (mode === 'today') {
    const nowDate = new Date(nowMs);
    const nowDay = nowDate.getDate();
    const eighteenHoursMs = 18 * 3600 * 1000;
    const thirtySixHoursMs = 36 * 3600 * 1000;
    const fortyEightHoursMs = 48 * 3600 * 1000;
    const futureToleranceMs = 24 * 3600 * 1000;

    const todayTopPins = effectiveTopPins.filter(item =>
      isEligibleForTodayNews(item, nowMs, thirtySixHoursMs)
    );

    // Fast-path pre-filter: isolate <= 48h dated candidates in a single cheap timestamp pass
    // before running language/regex eligibility, scoring, or clustering over 650+ items.
    const fresh48hEntries: { item: ScoredFeedItem; pubTime: number }[] = [];
    for (let i = 0; i < remaining.length; i++) {
      const item = remaining[i];
      if (item.publicationDateReliable === false) continue;
      const pubTime = Date.parse(item.publishedAt);
      if (isNaN(pubTime) || pubTime <= 0) continue;
      const ageMs = nowMs - pubTime;
      if (ageMs >= -futureToleranceMs && ageMs <= fortyEightHoursMs) {
        fresh48hEntries.push({ item, pubTime });
      }
    }

    const strictlyTodayEntries: { item: ScoredFeedItem; pubTime: number }[] = [];
    for (let i = 0; i < fresh48hEntries.length; i++) {
      const entry = fresh48hEntries[i];
      if (!isEligibleForTodayNews(entry.item, nowMs, eighteenHoursMs, entry.pubTime)) continue;
      const diffMs = nowMs - entry.pubTime;
      if (diffMs >= 0) {
        const diffHours = Math.floor(diffMs / 3600_000);
        if (diffHours >= 18) continue;
        if (diffHours >= 16 && new Date(entry.pubTime).getDate() !== nowDay) continue;
      }
      strictlyTodayEntries.push(entry);
    }

    let todayCandidateEntries = [...strictlyTodayEntries];

    // Anti-monoculture safeguard: when ARD Tagesschau heavily dominates the strict < 18h slice
    // (e.g. >= 4 ARD items while < 8 non-ARD items exist under 18h), blend in recent non-ARD
    // dispatches up to 36h so "⚡ Heute" preserves multi-source diversity.
    let ardStrictCount = 0;
    let nonArdStrictCount = 0;
    for (let i = 0; i < strictlyTodayEntries.length; i++) {
      if (isArdSource(strictlyTodayEntries[i].item)) ardStrictCount++;
      else nonArdStrictCount++;
    }
    if (ardStrictCount >= 4 && nonArdStrictCount < 8) {
      const strictIds = new Set(todayCandidateEntries.map(x => x.item.id));
      for (let i = 0; i < fresh48hEntries.length; i++) {
        const entry = fresh48hEntries[i];
        if (
          !strictIds.has(entry.item.id) &&
          !isArdSource(entry.item) &&
          isEligibleForTodayNews(entry.item, nowMs, thirtySixHoursMs, entry.pubTime)
        ) {
          todayCandidateEntries.push(entry);
        }
      }
    }

    // Progressive freshness fallback ONLY when 0 items are strictly < 18h (e.g. before live RSS resolves or offline)
    if (todayCandidateEntries.length === 0 && todayTopPins.length === 0) {
      const recent48h = fresh48hEntries.filter(entry =>
        isEligibleForTodayNews(entry.item, nowMs, fortyEightHoursMs, entry.pubTime) &&
        (entry.item.type === 'briefing' || entry.item.contentOrigin === 'live_ingested' || entry.item.format !== 'long_invitation')
      );
      if (recent48h.length > 0) {
        todayCandidateEntries = recent48h;
      } else {
        const sevenDaysMs = 7 * 24 * 3600 * 1000;
        const recentWeekEntries: { item: ScoredFeedItem; pubTime: number }[] = [];
        for (let i = 0; i < remaining.length && recentWeekEntries.length < 20; i++) {
          const item = remaining[i];
          if (item.publicationDateReliable === false) continue;
          const pubTime = Date.parse(item.publishedAt);
          if (
            isEligibleForTodayNews(item, nowMs, sevenDaysMs, pubTime) &&
            (
              item.type === 'briefing' ||
              item.type === 'quick_insight' ||
              item.contentOrigin === 'live_ingested' ||
              item.format === 'sourced_update' ||
              item.format === 'concise_insight'
            )
          ) {
            recentWeekEntries.push({ item, pubTime: isNaN(pubTime) ? nowMs : pubTime });
          }
        }
        todayCandidateEntries = recentWeekEntries;
      }
    }

    // Precompute priority score ONCE per candidate before sorting (avoids O(N log N) regex/string scans)
    const scoredCandidates = todayCandidateEntries.map(({ item, pubTime }) => {
      const ageHours = Math.max(0, (nowMs - pubTime) / 3600_000);
      let pts = Math.max(0, 36 - ageHours) * 1.4;
      if (hasVerifiedFeedImage(item)) pts += 10;
      if (matchesSaxonyRegion(item)) pts += 8;
      if (
        item.sourceTrustLevel === 'community_curated' ||
        item.sourceTrustLevel === 'deep_essay' ||
        item.sourceTrustLevel === 'verified_creator'
      ) {
        pts += 5;
      }
      pts += Math.min(8, (item.curationScore ?? 7.5) * 0.7);
      return { item, pts, pubTime };
    });

    scoredCandidates.sort((a, b) => {
      const diff = b.pts - a.pts;
      if (Math.abs(diff) > 0.01) return diff;
      if (b.pubTime !== a.pubTime) return b.pubTime - a.pubTime;
      return b.item.id.localeCompare(a.item.id);
    });

    const sorted = scoredCandidates.map(entry => entry.item);
    return enforcePinAndStreamAntiClustering(todayTopPins, interleaveTodayNewsStream(sorted));
  }

  // 2b. Legacy 'new' sort mode (fast-path pre-filters 48h/7d fresh pool before clustering when >= 8 fresh items exist;
  // preserves full pool ordering on smaller or historical pools for backward-compatible unit tests)
  if (mode === 'new') {
    const fortyEightHoursMs = 48 * 3600 * 1000;
    const sevenDaysMs = 7 * 24 * 3600 * 1000;
    const futureToleranceMs = 24 * 3600 * 1000;

    const fresh48h: ScoredFeedItem[] = [];
    const fresh7d: ScoredFeedItem[] = [];
    const datedOnly: ScoredFeedItem[] = [];

    for (let i = 0; i < remaining.length; i++) {
      const item = remaining[i];
      if (item.publicationDateReliable === false) continue;
      datedOnly.push(item);
      const pubTime = new Date(item.publishedAt).getTime();
      if (isNaN(pubTime) || pubTime <= 0) continue;
      const ageMs = nowMs - pubTime;
      if (ageMs >= -futureToleranceMs && ageMs <= fortyEightHoursMs) {
        fresh48h.push(item);
      }
      if (ageMs >= -futureToleranceMs && ageMs <= sevenDaysMs) {
        fresh7d.push(item);
      }
    }

    const pool =
      fresh48h.length >= 8
        ? fresh48h
        : fresh7d.length >= 8
        ? fresh7d
        : datedOnly.length >= 4
        ? datedOnly
        : remaining;

    const annotated = pool.map(item => {
      const isReliable = item.publicationDateReliable !== false;
      const saxony = matchesSaxonyRegion(item) ? 1 : 0;
      const time = new Date(item.publishedAt).getTime();
      const validTime = !isNaN(time) && time > 0;
      const seen = item.firstSeenAt ? new Date(item.firstSeenAt).getTime() : 0;
      return { item, isReliable, saxony, time, validTime, seen };
    });

    annotated.sort((a, b) => {
      if (a.isReliable !== b.isReliable) {
        return a.isReliable ? -1 : 1;
      }
      if (a.saxony !== b.saxony) return b.saxony - a.saxony;
      if (a.validTime && b.validTime && b.time !== a.time) return b.time - a.time;
      if (a.validTime && !b.validTime) return -1;
      if (!a.validTime && b.validTime) return 1;
      if (b.seen !== a.seen) return b.seen - a.seen;
      return b.item.id.localeCompare(a.item.id);
    });

    const sorted = annotated.map(entry => entry.item);
    return enforcePinAndStreamAntiClustering(effectiveTopPins, enforceArdsSpacing(sorted, 7));
  }

  // 3. "🧭 Diskurs" (1-14d Deep Debates, Long-Form Essays & Counter-Perspectives)
  if (mode === 'discourse') {
    const now = Date.now();
    const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;
    const discourseBase = excludeNonArtVaultInLiveHorizons
      ? remaining.filter(item => !isNonArtVaultItem(item))
      : remaining;
    // Focus on substantive essays, philosophy & debates from the last 1-14 days
    const discourseCandidates = discourseBase
      .filter(item => {
        const time = new Date(item.publishedAt).getTime();
        const isRecent = isNaN(time) || (now - time) <= fourteenDaysMs + (48 * 3600 * 1000);
        const textLen = (item.feedText || item.body || '').trim().length;
        const isSubstantive =
          (item.wordCount ?? 0) >= 60 ||
          textLen >= 140 ||
          item.format !== 'sourced_update' ||
          hasSubstantivePerspective(item);
        return isRecent && isSubstantive;
      })
      .map(item => enrichItemWithDiscourseConcept(item));

    const pool = discourseCandidates.length >= 3 ? discourseCandidates : discourseBase.map(item => enrichItemWithDiscourseConcept(item));

    const isLightweightForDiscourse = (item: ScoredFeedItem): boolean => {
      const hasPersp = hasSubstantivePerspective(item);
      if (item.format === 'meme' || item.format === 'comic' || item.primaryTopic === 'memes_satire') {
        return true;
      }
      if ((item.wordCount ?? 0) < 80 && !hasPersp) {
        return true;
      }
      if (item.format === 'sourced_update' && (item.wordCount ?? 0) < 110 && !hasPersp) {
        return true;
      }
      return false;
    };

    const substantiveCount = pool.reduce((acc, item) => acc + (isLightweightForDiscourse(item) ? 0 : 1), 0);
    const demoteLightweight = substantiveCount >= 6;

    const scoreDiscourse = (item: ScoredFeedItem): number => {
      const hasPerspDetails = Boolean(item.perspectiveDetails && Object.keys(item.perspectiveDetails).length > 0);
      const hasPersp = hasPerspDetails || Boolean(item.isChallengingPerspective);
      const wc = item.wordCount ?? 0;

      let pts = (item.curationScore ?? 7) * 10;
      if (isDiscourseFlagshipEssayPublisher(item)) pts += 34;
      if (item.sourceTrustLevel === 'deep_essay') pts += 24;
      if (item.type === 'deep_dive' || item.format === 'long_invitation' || item.format === 'book_masterpiece') {
        pts += 14;
      }
      if (
        item.primaryTopic === 'philosophy_ethics' ||
        item.primaryTopic === 'science_society' ||
        item.primaryTopic === 'german_didactics' ||
        item.primaryTopic === 'contemplation_mind'
      ) {
        pts += 8;
      }
      if (hasPerspDetails) pts += 22;
      if (item.isChallengingPerspective) pts += 18;
      if (wc >= 300) pts += 18;
      else if (wc >= 180) pts += 12;
      if (isBalancingSource(item)) pts += 14;

      if (demoteLightweight) {
        if (item.format === 'meme' || item.format === 'comic' || item.primaryTopic === 'memes_satire') {
          pts -= 120;
        } else if (wc < 80 && !hasPersp) {
          pts -= 100;
        } else if (item.format === 'sourced_update' && wc < 110 && !hasPersp) {
          pts -= 70;
        }
      }
      return pts;
    };

    const scoredPool = pool.map(item => ({ item, pts: scoreDiscourse(item) }));
    scoredPool.sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      return b.item.id.localeCompare(a.item.id);
    });
    const sorted = scoredPool.map(entry => entry.item);
    const disjoint = demoteItemsLeadingOtherHorizons(sorted, discourseBase, ['today'], options.seenItemIds, options.seenRecords);
    return enforcePinAndStreamAntiClustering(liveHorizonTopPins, enforceCuratedStreamDiversity(disjoint));
  }

  // 4. "🏆 Top" (Highest Impact: Community Points, User Upvotes, Bright-Web Flagship & Verified Trust)
  if (mode === 'top') {
    const topBase = excludeNonArtVaultInLiveHorizons
      ? remaining.filter(item => !isNonArtVaultItem(item))
      : remaining;

    const scoreTopImpact = (item: ScoredFeedItem): number => {
      const communityPts = item.externalCommunityScore?.points ?? 0;
      const communityComments = item.externalCommunityScore?.commentsCount ?? 0;
      const upvotePts = (item.upvotesCount ?? 0) * 14;
      const combinedPoints = communityPts + communityComments * 0.5 + upvotePts;
      const personalVoteBoost =
        (item.upvotesCount ?? 0) > 0 || (item.scoreBreakdown?.feedbackAdjustment ?? 0.5) >= 0.72
          ? 14
          : 0;
      const flagshipBonus = isBrightWebFlagshipItem(item) ? 16 : 0;

      let trustBonus = 4;
      if (item.sourceTrustLevel === 'peer_reviewed') trustBonus = 16;
      else if (item.sourceTrustLevel === 'deep_essay') trustBonus = 15;
      else if (item.sourceTrustLevel === 'museum_collection') trustBonus = 14;
      else if (item.sourceTrustLevel === 'verified_creator') trustBonus = 14;
      else if (item.sourceTrustLevel === 'public_broadcaster') trustBonus = 10;
      else if (item.sourceTrustLevel === 'community_curated') trustBonus = 10;

      return (
        (item.curationScore ?? 7) * 10 +
        (combinedPoints > 0 ? Math.min(60, Math.log10(combinedPoints + 1) * 24) : 0) +
        personalVoteBoost +
        flagshipBonus +
        (item.evidenceTier === 'permitted_full_text' ? 12 : item.evidenceTier === 'multiple_sources' ? 10 : 0) +
        trustBonus +
        (item.editorialAbstract ? 8 : 0)
      );
    };

    const scoredTop = topBase.map(item => ({
      item,
      quality: scoreTopImpact(item),
      time: item.publicationDateReliable !== false ? (new Date(item.publishedAt).getTime() || 0) : 0
    }));

    scoredTop.sort((a, b) => {
      if (b.quality !== a.quality) return b.quality - a.quality;
      if (b.time !== a.time) return b.time - a.time;
      return b.item.id.localeCompare(a.item.id);
    });
    const sorted = scoredTop.map(entry => entry.item);
    const disjoint =
      topBase.length >= 15
        ? demoteItemsLeadingOtherHorizons(
            sorted,
            topBase,
            ['for_you', 'today'],
            options.seenItemIds,
            options.seenRecords,
            { minPool: 15, topN: topBase.length >= 24 ? 10 : 5 }
          )
        : sorted;
    return enforcePinAndStreamAntiClustering(liveHorizonTopPins, enforceCuratedStreamDiversity(disjoint));
  }

  // 5. "💎 Zeitlos" (Timeless essays, art, literature, music, evergreen concepts)
  if (mode === 'timeless' || mode === 'gems') {
    const sorted = [...remaining].sort((a, b) => {
      const gemA = isGem(a);
      const gemB = isGem(b);
      if (gemA !== gemB) return gemA ? -1 : 1;
      const bridgeBonusA = (a.format === 'surprising_connection' || (a.topics && a.topics.length >= 2)) ? 10 : 0;
      const bridgeBonusB = (b.format === 'surprising_connection' || (b.topics && b.topics.length >= 2)) ? 10 : 0;
      const scoreA = (a.curationScore ?? 7) * 10 + (a.isEvergreenGem ? 25 : 0) + (a.format === 'art_showcase' ? 20 : 0) + (a.wordCount >= 200 ? 10 : 0) + bridgeBonusA;
      const scoreB = (b.curationScore ?? 7) * 10 + (b.isEvergreenGem ? 25 : 0) + (b.format === 'art_showcase' ? 20 : 0) + (b.wordCount >= 200 ? 10 : 0) + bridgeBonusB;
      if (scoreB !== scoreA) return scoreB - scoreA;
      return b.id.localeCompare(a.id);
    });
    const disjoint = demoteItemsLeadingOtherHorizons(sorted, remaining, ['today', 'discourse'], options.seenItemIds, options.seenRecords);
    return enforcePinAndStreamAntiClustering(effectiveTopPins, disjoint);
  }

  // Fallback: Default hot/score order
  const sorted = [...remaining].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.id.localeCompare(a.id);
  });
  return enforcePinAndStreamAntiClustering(effectiveTopPins, sorted);
}

/**
 * Scores and ranks a candidate pool using the sliding-window Bloom-Ranking algorithm.
 */
export function rankAndInterleaveFeed(
  items: FeedItem[],
  profile: UserProfile,
  interactions: Record<string, ReadingInteraction> = {},
  options?: { batchSize?: number }
): ScoredFeedItem[] {
  if (items.length === 0) return [];
  const scored = items.map(item => scoreFeedItem(item, profile, interactions));
  const ranked = rankBloomScrollFeed(scored);

  const batchSize = options?.batchSize ?? 5;
  if (ranked.length > batchSize) {
    const topBatch = ranked.slice(0, batchSize);
    const rest = ranked.slice(batchSize);

    const insertSafelyIntoRest = (item: ScoredFeedItem) => {
      const lastTopTopic = topBatch[topBatch.length - 1]?.primaryTopic;
      if (
        rest.length > 0 &&
        (rest[0].primaryTopic === item.primaryTopic || lastTopTopic === item.primaryTopic)
      ) {
        const nextDiffIdx = rest.findIndex(r => r.primaryTopic !== item.primaryTopic && r.primaryTopic !== lastTopTopic);
        if (nextDiffIdx !== -1) {
          rest.splice(nextDiffIdx, 0, item);
          return;
        }
      }
      rest.unshift(item);
    };

    if (!topBatch.some(i => i.isTeachingRelated || i.primaryTopic === 'german_didactics')) {
      const tIdx = rest.findIndex(i => i.isTeachingRelated || i.primaryTopic === 'german_didactics');
      if (tIdx !== -1) {
        const [teachItem] = rest.splice(tIdx, 1);
        const displaced = topBatch[batchSize - 1];
        topBatch[batchSize - 1] = teachItem;
        insertSafelyIntoRest(displaced);
      }
    }

    if (!topBatch.some(i => i.isChallengingPerspective || i.type === 'perspective')) {
      const cIdx = rest.findIndex(i => i.isChallengingPerspective || i.type === 'perspective');
      if (cIdx !== -1 && batchSize >= 2) {
        const [challItem] = rest.splice(cIdx, 1);
        const replacePos = topBatch[batchSize - 2]?.isTeachingRelated ? batchSize - 3 : batchSize - 2;
        const pos = Math.max(0, replacePos);
        const displaced = topBatch[pos];
        topBatch[pos] = challItem;
        insertSafelyIntoRest(displaced);
      }
    }

    // Final sweep across topBatch and rest boundary to ensure no consecutive duplicate topics
    for (let i = 0; i < topBatch.length - 1; i++) {
      if (topBatch[i].primaryTopic === topBatch[i + 1].primaryTopic) {
        const swapIdx = topBatch.findIndex((x, idx) => idx > i + 1 && x.primaryTopic !== topBatch[i].primaryTopic);
        if (swapIdx !== -1) {
          const temp = topBatch[i + 1];
          topBatch[i + 1] = topBatch[swapIdx];
          topBatch[swapIdx] = temp;
        }
      }
    }
    if (rest.length > 0 && topBatch[topBatch.length - 1].primaryTopic === rest[0].primaryTopic) {
      const swapRestIdx = rest.findIndex(r => r.primaryTopic !== topBatch[topBatch.length - 1].primaryTopic);
      if (swapRestIdx !== -1) {
        const [nonDup] = rest.splice(swapRestIdx, 1);
        rest.unshift(nonDup);
      }
    }

    return [...topBatch, ...rest];
  }

  return ranked;
}

function getTopicLabel(topic: TopicTag): string {
  switch (topic) {
    case 'philosophy_ethics': return 'Ethik & Philosophie';
    case 'german_didactics': return 'Didaktik & Schule';
    case 'ai_apple': return 'KI & Apple';
    case 'contemplation_mind': return 'Geist & Kontemplation';
    case 'science_society': return 'Wissenschaft & Ideen';
    case 'sound_synthesis': return 'Klang & Synthese';
    case 'memes_satire': return 'Spielerisches & Satire';
    case 'youtube_gems': return 'YouTube Gems';
    case 'book_mastery': return 'Essays & Bücher';
    case 'health_biohacking': return 'Gesundheit & Fokus';
    case 'opportunities_growth': return 'Chancen & Hebel';
    case 'art_aesthetics': return 'Kunst & Ästhetik';
  }
}

/**
 * Determines the appropriate daily edition (morning, midday, evening) based on current hour in user's timezone.
 */
export function determineCurrentEditionType(
  date: Date = new Date(),
  profile?: UserProfile
): DayEditionType {
  const morningStart = profile?.editionPreferences?.morningStartHour ?? 5;
  const middayStart = profile?.editionPreferences?.middayStartHour ?? 12;
  const eveningStart = profile?.editionPreferences?.eveningStartHour ?? 18;

  let hour = date.getHours();
  try {
    const tz = profile?.editionPreferences?.timezone || 'Europe/Berlin';
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      hour12: false
    });
    const parts = formatter.formatToParts(date);
    const hourPart = parts.find(p => p.type === 'hour');
    if (hourPart) {
      hour = parseInt(hourPart.value, 10);
    }
  } catch {
    hour = date.getHours();
  }

  if (hour >= morningStart && hour < middayStart) {
    return 'morning';
  } else if (hour >= middayStart && hour < eveningStart) {
    return 'midday';
  } else {
    return 'evening';
  }
}

function scoreForEdition(
  item: FeedItem,
  editionType: DayEditionType,
  profile: UserProfile,
  interactions: Record<string, ReadingInteraction>,
  seed: string,
  shuffleOffset: number = 0
): ScoredFeedItem {
  const base = scoreFeedItem(item, profile, interactions);

  let hash = 0;
  const str = `${seed}_s${shuffleOffset}_${editionType}_${item.id}`;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const variationFactor = 0.92 + (Math.abs(hash) % 160) / 1000;

  let editionMultiplier = 1.0;

  if (editionType === 'morning') {
    if (item.sourceTrustLevel === 'public_broadcaster' || item.format === 'sourced_update') editionMultiplier += 0.35;
    if (item.primaryTopic === 'science_society') editionMultiplier += 0.30;
    if (item.primaryTopic === 'ai_apple') editionMultiplier += 0.20;
    if (item.estimatedReadingMinutes <= 3) editionMultiplier += 0.20;
  } else if (editionType === 'midday') {
    if (item.isTeachingRelated || item.primaryTopic === 'german_didactics') editionMultiplier += 0.35;
    if (item.primaryTopic === 'opportunities_growth' || item.primaryTopic === 'health_biohacking') editionMultiplier += 0.30;
    if (item.primaryTopic === 'memes_satire' || item.format === 'meme') editionMultiplier += 0.30;
    if (item.primaryTopic === 'youtube_gems' || item.format === 'youtube_gem') editionMultiplier += 0.25;
  } else if (editionType === 'evening') {
    if (item.format === 'long_invitation' || item.estimatedReadingMinutes >= 4) editionMultiplier += 0.35;
    if (item.primaryTopic === 'philosophy_ethics' || item.primaryTopic === 'contemplation_mind') editionMultiplier += 0.30;
    if (item.primaryTopic === 'book_mastery' || item.format === 'book_masterpiece') editionMultiplier += 0.30;
    if (item.primaryTopic === 'sound_synthesis' || item.primaryTopic === 'art_aesthetics') editionMultiplier += 0.25;
    if (item.isEvergreenGem) editionMultiplier += 0.25;
  }

  if (item.targetEditions && item.targetEditions.length > 0) {
    if (item.targetEditions.includes(editionType)) {
      editionMultiplier += 0.20;
    } else {
      editionMultiplier -= 0.30;
    }
  }

  const adjustedScore = Math.round(base.score * variationFactor * Math.max(0.1, editionMultiplier) * 1000) / 1000;
  return {
    ...base,
    score: adjustedScore
  };
}

/**
 * Allocates disjoint, zero-repetition batches for morning, midday, and evening.
 */
export function allocateDailyEditions(
  pool: FeedItem[],
  profile: UserProfile,
  interactions: Record<string, ReadingInteraction> = {},
  dateSeed?: string,
  shuffleOffset: number = 0,
  previouslyShownIds?: Set<string>
): Record<DayEditionType, ScoredFeedItem[]> {
  const seed = dateSeed || new Date().toISOString().slice(0, 10);
  const targetPerEdition = 8;
  const assignedIds = new Set<string>();

  const editions: DayEditionType[] = ['morning', 'midday', 'evening'];
  const allocations: Record<DayEditionType, ScoredFeedItem[]> = {
    morning: [],
    midday: [],
    evening: []
  };

  // Prioritize fresh candidates that haven't been shown in recent mixes
  const unshownPool = previouslyShownIds && previouslyShownIds.size > 0
    ? pool.filter(item => !previouslyShownIds.has(item.id))
    : [];

  for (const edition of editions) {
    let availablePool = unshownPool.length > 0
      ? unshownPool.filter(item => !assignedIds.has(item.id))
      : pool.filter(item => !assignedIds.has(item.id));

    if (availablePool.length < targetPerEdition) {
      // Backfill from full pool if unshown pool is exhausted
      const currentAvailableIds = new Set(availablePool.map(i => i.id));
      const backfill = pool.filter(item => !assignedIds.has(item.id) && !currentAvailableIds.has(item.id));
      availablePool = [...availablePool, ...backfill];
    }
    const scored = availablePool.map(item => scoreForEdition(item, edition, profile, interactions, seed, shuffleOffset));
    const bloomRanked = rankBloomScrollFeed(scored);

    const count = Math.min(targetPerEdition, bloomRanked.length);
    const topBatch = bloomRanked.slice(0, count);
    const remainder = bloomRanked.slice(count);

    // Ensure at least 1 teaching-related card in morning/midday if available
    if ((edition === 'morning' || edition === 'midday') && !topBatch.some(i => i.isTeachingRelated || i.primaryTopic === 'german_didactics')) {
      const tIdx = remainder.findIndex(i => i.isTeachingRelated || i.primaryTopic === 'german_didactics');
      if (tIdx !== -1 && topBatch.length > 0) {
        const [elevated] = remainder.splice(tIdx, 1);
        topBatch[topBatch.length - 1] = elevated;
      }
    }

    // Ensure at least 1 challenging perspective in each edition if available
    if (!topBatch.some(i => i.isChallengingPerspective)) {
      const cIdx = remainder.findIndex(i => i.isChallengingPerspective);
      if (cIdx !== -1 && topBatch.length > 1) {
        const [elevated] = remainder.splice(cIdx, 1);
        topBatch[topBatch.length - 2] = elevated;
      } else {
        const pIdx = remainder.findIndex(i => i.type === 'perspective');
        if (pIdx !== -1 && topBatch.length > 1) {
          const [elevated] = remainder.splice(pIdx, 1);
          topBatch[topBatch.length - 2] = elevated;
        }
      }
    }

    for (const item of topBatch) {
      assignedIds.add(item.id);
    }

    allocations[edition] = topBatch;
  }

  return allocations;
}

export function rankEditionFeed(
  items: FeedItem[],
  editionType: DayEditionType,
  profile: UserProfile,
  interactions: Record<string, ReadingInteraction> = {},
  dateSeed?: string,
  shuffleOffset: number = 0,
  previouslyShownIds?: Set<string>
): ScoredFeedItem[] {
  if (items.length === 0) return [];
  const allAllocations = allocateDailyEditions(items, profile, interactions, dateSeed, shuffleOffset, previouslyShownIds);
  return allAllocations[editionType] || [];
}

/**
 * Pure helper that computes updated profile weights and muted source indicators
 * when a user triggers "🚫 Weniger davon" on an item.
 */
export function applyDismissFeedbackToProfile(
  profile: UserProfile,
  item: FeedItem
): UserProfile {
  const topic = item.primaryTopic;
  const currentExplicit = profile.explicitInterests[topic] ?? 0.5;
  const nextExplicit = Math.max(0.05, Math.round((currentExplicit - 0.12) * 100) / 100);

  const currentDerived = profile.derivedWeights?.[topic] ?? currentExplicit;
  const nextDerived = Math.max(0.05, Math.round((currentDerived - 0.15) * 100) / 100);

  const sourceId = (
    item.sourceDomain ||
    item.sourceReferences?.[0]?.publisher ||
    item.sourceBroadcasterName ||
    ''
  )
    .toLowerCase()
    .trim();

  const existingMuted = profile.mutedSources || [];
  const nextMuted =
    sourceId && !existingMuted.includes(sourceId)
      ? [...existingMuted, sourceId]
      : existingMuted;

  return {
    ...profile,
    explicitInterests: {
      ...profile.explicitInterests,
      [topic]: nextExplicit
    },
    derivedWeights: {
      ...(profile.derivedWeights || profile.explicitInterests),
      [topic]: nextDerived
    },
    mutedSources: nextMuted
  };
}

/**
 * Pure helper that reverts a previous "🚫 Weniger davon" action ("Rückgängig").
 */
export function revertDismissFeedbackFromProfile(
  profile: UserProfile,
  item: FeedItem
): UserProfile {
  const topic = item.primaryTopic;
  const currentExplicit = profile.explicitInterests[topic] ?? 0.5;
  const nextExplicit = Math.min(1.0, Math.round((currentExplicit + 0.12) * 100) / 100);

  const currentDerived = profile.derivedWeights?.[topic] ?? currentExplicit;
  const nextDerived = Math.min(1.0, Math.round((currentDerived + 0.15) * 100) / 100);

  const sourceId = (
    item.sourceDomain ||
    item.sourceReferences?.[0]?.publisher ||
    item.sourceBroadcasterName ||
    ''
  )
    .toLowerCase()
    .trim();

  const existingMuted = profile.mutedSources || [];
  const nextMuted = sourceId
    ? existingMuted.filter(s => s !== sourceId)
    : existingMuted;

  return {
    ...profile,
    explicitInterests: {
      ...profile.explicitInterests,
      [topic]: nextExplicit
    },
    derivedWeights: {
      ...(profile.derivedWeights || profile.explicitInterests),
      [topic]: nextDerived
    },
    mutedSources: nextMuted
  };
}

const CONCEPT_STOPWORDS = new Set([
  'eine', 'einer', 'eines', 'einem', 'einen', 'oder', 'aber', 'wenn', 'dann', 'weil',
  'dass', 'dies', 'diese', 'dieser', 'dieses', 'über', 'unter', 'nach', 'vor',
  'nicht', 'auch', 'noch', 'schon', 'durch', 'für', 'gegen', 'ohne', 'beim',
  'sind', 'wird', 'werden', 'wurde', 'wurden', 'haben', 'hatte', 'kann', 'können',
  'mehr', 'sehr', 'hier', 'dort', 'alle', 'viele', 'neue', 'neuen', 'neuer',
  'warum', 'wieso', 'weshalb', 'sowie', 'zwischen', 'ihre', 'ihren', 'ihrem',
  'what', 'with', 'from', 'this', 'that', 'about', 'into', 'over', 'after',
  'their', 'there', 'where', 'which', 'while', 'would', 'could', 'should',
  'have', 'been', 'were', 'they', 'them', 'some', 'more', 'most', 'other'
]);

/**
 * Extracts 4-6 salient concept/subject keywords from an item's title, subtitle, and keyInsight.
 */
export function extractConceptKeywords(
  input: Pick<FeedItem, 'title' | 'subtitle' | 'keyInsight' | 'feedText'> | string
): string[] {
  const combined =
    typeof input === 'string'
      ? input
      : `${input.title || ''} ${input.subtitle || ''} ${input.keyInsight || ''}`;

  const tokens = combined
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .map(w => w.replace(/^-+|-+$/g, ''))
    .filter(w => w.length >= 4 && !CONCEPT_STOPWORDS.has(w));

  const unique: string[] = [];
  for (const token of tokens) {
    if (!unique.includes(token)) {
      unique.push(token);
      if (unique.length >= 6) break;
    }
  }
  return unique;
}

/**
 * Applies an explicit upvote or downvote signal to a UserProfile's feedbackMemory and derivedWeights
 * so unseen articles sharing concepts, subchannels, or domains immediately adapt.
 */
export function applyVoteFeedbackToProfile(
  profile: UserProfile,
  item: FeedItem,
  direction: 'up' | 'down'
): UserProfile {
  const isUp = direction === 'up';
  const primaryTopic = item.primaryTopic || 'philosophy_ethics';
  const secondaryTopics = (item.topics || []).filter(t => t !== primaryTopic);
  const author = (item.sourceReferences?.[0]?.author || item.sourceReferences?.[0]?.publisher || '').trim();
  const domain = (item.sourceDomain || item.sourceReferences?.[0]?.publisher || '').toLowerCase().trim();
  const space = item.space ? item.space.toLowerCase().trim() : '';
  const keywords = extractConceptKeywords(item);

  const mem = {
    boostedTopics: { ...(profile.feedbackMemory?.boostedTopics || {}) },
    penalizedTopics: { ...(profile.feedbackMemory?.penalizedTopics || {}) },
    boostedAuthors: { ...(profile.feedbackMemory?.boostedAuthors || {}) },
    penalizedAuthors: { ...(profile.feedbackMemory?.penalizedAuthors || {}) },
    boostedDomains: { ...(profile.feedbackMemory?.boostedDomains || {}) },
    penalizedDomains: { ...(profile.feedbackMemory?.penalizedDomains || {}) },
    boostedSpaces: { ...(profile.feedbackMemory?.boostedSpaces || {}) },
    penalizedSpaces: { ...(profile.feedbackMemory?.penalizedSpaces || {}) },
    boostedKeywords: { ...(profile.feedbackMemory?.boostedKeywords || {}) },
    penalizedKeywords: { ...(profile.feedbackMemory?.penalizedKeywords || {}) }
  };

  const decayKey = (map: Record<string, number>, key: string, step = 1) => {
    if (!key || !(key in map)) return;
    const next = (map[key] || 0) - step;
    if (next <= 0) delete map[key];
    else map[key] = next;
  };

  const baseWeights: Record<TopicTag, number> = {
    ...(profile.explicitInterests || {}),
    ...(profile.derivedWeights || {})
  } as Record<TopicTag, number>;
  const clampWeight = (w: number) => Math.max(0.10, Math.min(0.98, Math.round(w * 1000) / 1000));

  if (isUp) {
    mem.boostedTopics[primaryTopic] = (mem.boostedTopics[primaryTopic] || 0) + 2;
    decayKey(mem.penalizedTopics, primaryTopic, 1);
    baseWeights[primaryTopic] = clampWeight((baseWeights[primaryTopic] ?? 0.5) + 0.04);

    for (const sec of secondaryTopics) {
      mem.boostedTopics[sec] = (mem.boostedTopics[sec] || 0) + 1;
      decayKey(mem.penalizedTopics, sec, 1);
      baseWeights[sec] = clampWeight((baseWeights[sec] ?? 0.5) + 0.02);
    }
    if (author) {
      mem.boostedAuthors[author] = (mem.boostedAuthors[author] || 0) + 1;
      decayKey(mem.penalizedAuthors, author, 1);
    }
    if (domain) {
      mem.boostedDomains[domain] = (mem.boostedDomains[domain] || 0) + 2;
      decayKey(mem.penalizedDomains, domain, 1);
    }
    if (space) {
      mem.boostedSpaces[space] = (mem.boostedSpaces[space] || 0) + 2;
      decayKey(mem.penalizedSpaces, space, 1);
    }
    for (const kw of keywords) {
      mem.boostedKeywords[kw] = (mem.boostedKeywords[kw] || 0) + 2;
      decayKey(mem.penalizedKeywords, kw, 1);
    }
  } else {
    mem.penalizedTopics[primaryTopic] = (mem.penalizedTopics[primaryTopic] || 0) + 2;
    decayKey(mem.boostedTopics, primaryTopic, 1);
    baseWeights[primaryTopic] = clampWeight((baseWeights[primaryTopic] ?? 0.5) - 0.05);

    for (const sec of secondaryTopics) {
      mem.penalizedTopics[sec] = (mem.penalizedTopics[sec] || 0) + 1;
      decayKey(mem.boostedTopics, sec, 1);
      baseWeights[sec] = clampWeight((baseWeights[sec] ?? 0.5) - 0.025);
    }
    if (author) {
      mem.penalizedAuthors[author] = (mem.penalizedAuthors[author] || 0) + 1;
      decayKey(mem.boostedAuthors, author, 1);
    }
    if (domain) {
      mem.penalizedDomains[domain] = (mem.penalizedDomains[domain] || 0) + 2;
      decayKey(mem.boostedDomains, domain, 1);
    }
    if (space) {
      mem.penalizedSpaces[space] = (mem.penalizedSpaces[space] || 0) + 2;
      decayKey(mem.boostedSpaces, space, 1);
    }
    for (const kw of keywords) {
      mem.penalizedKeywords[kw] = (mem.penalizedKeywords[kw] || 0) + 2;
      decayKey(mem.boostedKeywords, kw, 1);
    }
  }

  return {
    ...profile,
    derivedWeights: baseWeights,
    feedbackMemory: mem
  };
}

/**
 * Computes a concept, keyword, subchannel, author, and domain similarity adjustment for an unseen article
 * based on the user's upvoted/downvoted feedbackMemory and mutedSources.
 * Organic accumulation strengthens relevant themes/authors/domains over time without perturbing unrelated items (0).
 */
export function computeUpvoteSimilarityBoost(
  item: FeedItem,
  userProfile: UserProfile,
  _interactions: Record<string, ReadingInteraction> = {}
): number {
  const memory = userProfile.feedbackMemory;
  const mutedSources = userProfile.mutedSources || [];
  const domain = (item.sourceDomain || item.sourceReferences?.[0]?.publisher || '').toLowerCase().trim();
  const space = item.space ? item.space.toLowerCase().trim() : '';

  let boost = 0;
  let penalty = 0;

  if (domain && mutedSources.some(m => domain.includes(m.toLowerCase()))) {
    penalty += 0.42;
  }

  if (!memory) {
    return -penalty;
  }

  const itemKeywords = extractConceptKeywords(item);
  const fullSearchText = `${item.title || ''} ${item.subtitle || ''} ${item.keyInsight || ''} ${item.feedText || ''}`.toLowerCase();

  let matchedBoostKeywords = 0;
  let matchedBoostWeight = 0;
  if (memory.boostedKeywords) {
    for (const [kw, count] of Object.entries(memory.boostedKeywords)) {
      if ((count || 0) <= 0) continue;
      const kwNorm = kw.toLowerCase();
      if (itemKeywords.includes(kwNorm) || fullSearchText.includes(kwNorm)) {
        matchedBoostKeywords += 1;
        matchedBoostWeight += Math.min(4, count || 1);
      }
    }
  }

  let matchedPenaltyKeywords = 0;
  let matchedPenaltyWeight = 0;
  if (memory.penalizedKeywords) {
    for (const [kw, count] of Object.entries(memory.penalizedKeywords)) {
      if ((count || 0) <= 0) continue;
      const kwNorm = kw.toLowerCase();
      if (itemKeywords.includes(kwNorm) || fullSearchText.includes(kwNorm)) {
        matchedPenaltyKeywords += 1;
        matchedPenaltyWeight += Math.min(4, count || 1);
      }
    }
  }

  const spaceBoostCount = space ? (memory.boostedSpaces?.[space] ?? 0) : 0;
  const domainBoostCount = domain ? (memory.boostedDomains?.[domain] ?? 0) : 0;
  const spacePenCount = space ? (memory.penalizedSpaces?.[space] ?? 0) : 0;
  const domainPenCount = domain ? (memory.penalizedDomains?.[domain] ?? 0) : 0;

  if (matchedBoostKeywords >= 2) {
    boost += Math.min(0.30, 0.14 + (matchedBoostKeywords - 2) * 0.04 + (matchedBoostWeight > matchedBoostKeywords * 2 ? 0.04 : 0));
  } else if (matchedBoostKeywords === 1) {
    boost += (spaceBoostCount > 0 || domainBoostCount > 0) ? 0.15 : 0.08;
  }

  if (spaceBoostCount > 0) {
    boost += Math.min(0.12, spaceBoostCount * 0.04);
  }
  if (domainBoostCount > 0) {
    boost += Math.min(0.16, domainBoostCount * 0.045);
  }

  if (matchedPenaltyKeywords >= 2) {
    penalty += Math.min(0.42, 0.26 + (matchedPenaltyKeywords - 2) * 0.05 + (matchedPenaltyWeight > matchedPenaltyKeywords * 2 ? 0.04 : 0));
  } else if (matchedPenaltyKeywords === 1) {
    penalty += 0.16;
  }

  if (spacePenCount > 0) {
    penalty += Math.min(0.24, spacePenCount * 0.08);
  }
  if (domainPenCount > 0) {
    penalty += Math.min(0.35, domainPenCount * 0.13);
  }

  const net = Math.min(0.42, boost) - Math.min(0.60, penalty);
  return Math.round(net * 1000) / 1000;
}

export interface FeedCardMemoComparableProps {
  item: { id: string; upvotesCount?: number; feedText?: string; aiAssisted?: boolean };
  interaction?: ReadingInteraction;
  isDark?: boolean;
  palette?: string;
  enableSoundGrounding?: boolean;
  isHero?: boolean;
  isEagerImage?: boolean;
  isFocused?: boolean;
  isExpanded?: boolean;
  cardWidth?: number;
  viewportWidth?: number;
  hivemindTrackProgressPercent?: number;
  hivemindProgressPercent?: number;
  isHivemindStepCompleted?: boolean;
  isCompletedHivemindStep?: boolean;
}

/**
 * Strict React.memo comparator for FeedCard.
 * Prevents sibling cards from re-rendering when a single card is upvoted, bookmarked, or scrolled past.
 * Intentionally ignores `isEagerImage` transitions on an already-mounted card so index shifts never trigger
 * unnecessary mid-scroll re-renders.
 */
export function areFeedCardPropsEqual<T extends FeedCardMemoComparableProps>(prev: T, next: T): boolean {
  if (prev.item.id !== next.item.id) return false;
  if ((prev.item.upvotesCount ?? 0) !== (next.item.upvotesCount ?? 0)) return false;
  if ((prev.item.feedText?.length ?? 0) !== (next.item.feedText?.length ?? 0)) return false;
  if (Boolean(prev.item.aiAssisted) !== Boolean(next.item.aiAssisted)) return false;
  const prevVote = (prev.interaction as any)?.vote ?? prev.interaction?.voteScore ?? 0;
  const nextVote = (next.interaction as any)?.vote ?? next.interaction?.voteScore ?? 0;
  if (prevVote !== nextVote) return false;
  if (Boolean(prev.interaction?.saved) !== Boolean(next.interaction?.saved)) return false;
  if ((prev.interaction?.feedback ?? 'neutral') !== (next.interaction?.feedback ?? 'neutral')) return false;
  if ((prev.interaction?.progressPercent ?? 0) !== (next.interaction?.progressPercent ?? 0)) return false;
  if (Boolean(prev.isDark) !== Boolean(next.isDark)) return false;
  if ((prev.palette ?? 'tidalglass') !== (next.palette ?? 'tidalglass')) return false;
  if (Boolean(prev.enableSoundGrounding ?? true) !== Boolean(next.enableSoundGrounding ?? true)) return false;
  if (prev.cardWidth !== next.cardWidth) return false;
  if (prev.viewportWidth !== next.viewportWidth) return false;
  if (
    (prev.hivemindTrackProgressPercent ?? prev.hivemindProgressPercent) !==
    (next.hivemindTrackProgressPercent ?? next.hivemindProgressPercent)
  ) {
    return false;
  }
  if (
    Boolean(prev.isHivemindStepCompleted ?? prev.isCompletedHivemindStep) !==
    Boolean(next.isHivemindStepCompleted ?? next.isCompletedHivemindStep)
  ) {
    return false;
  }
  if (Boolean(prev.isHero) !== Boolean(next.isHero)) return false;
  if (Boolean(prev.isFocused) !== Boolean(next.isFocused)) return false;
  if (Boolean(prev.isExpanded) !== Boolean(next.isExpanded)) return false;
  return true;
}

/**
 * Pure, synchronous 0ms state updater for optimistic voting.
 * Updates interaction state immediately and adjusts upvotesCount in-place without reordering items.
 */
export function computeOptimisticVoteState<T extends FeedItem>(
  prevInteractions: Record<string, ReadingInteraction>,
  items: T[],
  itemId: string,
  direction: 'up' | 'down' | 'clear'
): {
  nextInteractions: Record<string, ReadingInteraction>;
  nextItems: T[];
  deltaUpvotes: number;
} {
  const prevInt: ReadingInteraction = prevInteractions[itemId] ?? {
    itemId,
    saved: false,
    progressPercent: 0,
    furthestPositionPercent: 0,
    userNotes: []
  };
  const prevVoteScore = prevInt.voteScore ?? 0;
  const nextVoteScore: -1 | 0 | 1 = direction === 'up' ? 1 : direction === 'down' ? -1 : 0;
  const deltaUpvotes = (nextVoteScore === 1 ? 1 : 0) - (prevVoteScore === 1 ? 1 : 0);

  const nextFeedback =
    direction === 'up'
      ? 'more_like_this'
      : direction === 'down'
      ? 'less_like_this'
      : prevInt.feedback;

  const nextInteraction: ReadingInteraction = {
    ...prevInt,
    voteScore: nextVoteScore,
    feedback: nextFeedback
  };

  const nextInteractions: Record<string, ReadingInteraction> = {
    ...prevInteractions,
    [itemId]: nextInteraction
  };

  if (deltaUpvotes === 0) {
    return { nextInteractions, nextItems: items, deltaUpvotes: 0 };
  }

  let changed = false;
  const nextItems = items.map(item => {
    if (item.id !== itemId) return item;
    changed = true;
    return {
      ...item,
      upvotesCount: Math.max(0, (item.upvotesCount ?? 0) + deltaUpvotes)
    };
  });

  return {
    nextInteractions,
    nextItems: changed ? nextItems : items,
    deltaUpvotes
  };
}

/**
 * Formats the personal vote pill label without fake or confusing external upvote numbers.
 */
export function formatPersonalVoteLabel(voteScore: number): string {
  if (voteScore > 0) return '+1';
  if (voteScore < 0) return '-1';
  return 'Vote';
}
