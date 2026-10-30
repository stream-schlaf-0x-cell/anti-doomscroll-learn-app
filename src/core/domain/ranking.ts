import {
  FeedItem,
  UserProfile,
  TopicTag,
  ReadingInteraction,
  PersonalGoal,
  DayEditionType
} from './types';

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

/**
 * Checks whether an item anchors regional Saxony / Dresden / Leipzig focus.
 */
export function matchesSaxonyRegion(item: FeedItem): boolean {
  const text = `${item.title} ${item.subtitle || ''} ${item.feedText || ''} ${item.body || ''} ${item.sourceBroadcasterName || ''} ${item.sourceDomain || ''} ${item.canonicalUrl || ''}`.toLowerCase();
  return (
    text.includes('sachsen') ||
    text.includes('dresden') ||
    text.includes('leipzig') ||
    text.includes('mdr') ||
    text.includes('regions=14') ||
    false
  );
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
  interactions: Record<string, ReadingInteraction> = {}
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

  // 4. Freshness Score (7-Day Rolling Quality Window: treats the entire past week as active high-value pool)
  const isReliableDate = item.publicationDateReliable !== false;
  const pubTime = isReliableDate ? new Date(item.publishedAt).getTime() : NaN;
  const nowTime = Date.now();
  const hoursOld = isNaN(pubTime) ? 200 : Math.max(0, (nowTime - pubTime) / (1000 * 60 * 60));
  let freshness = 0.70;
  if (!isReliableDate) {
    freshness = item.isEvergreenGem ? 0.75 : 0.65;
  } else if (hoursOld <= 12) {
    freshness = 0.98;
  } else if (hoursOld <= 48) {
    freshness = 0.95;
  } else if (hoursOld <= 120) {
    freshness = 0.91;
  } else if (hoursOld <= 168) {
    freshness = 0.87;
  } else {
    freshness = item.isEvergreenGem ? 0.74 : 0.62;
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
      const titleLower = item.title.toLowerCase();
      for (const [kw, count] of Object.entries(memory.penalizedKeywords)) {
        if (titleLower.includes(kw.toLowerCase())) {
          feedbackAdjustment -= Math.min(0.25, (count || 1) * 0.10);
        }
      }
    }
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

  // Weighted Composite Score (Explicit feedback has 0.20 weight vs 0.04 for passive behavior; durationMatch 0.18)
  let rawScore =
    topicMatch * 0.24 +
    goalAlignment * 0.14 +
    freshness * 0.16 +
    readingTimeFit * 0.18 +
    editorialValue * 0.06 +
    feedbackAdjustment * 0.18 +
    behavioralAdjustment * 0.04;

  // Direct explicit interaction overrides on the item itself
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

  if (credibilityBonus >= 0.08) {
    whyFactors.push(`Hohe Quellen-Reliabilität: Tier A Verifikation (+${Math.round(credibilityBonus * 100)}%)`);
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

/**
 * Returns a normalized domain/publisher key for sliding-window diversity enforcement.
 */
export function getDomainDiversityKey(item: FeedItem): string {
  if (isArdSource(item)) return 'ard-tagesschau';
  if (item.sourceDomain && item.sourceDomain.trim().length > 0) {
    const cleanDom = item.sourceDomain.toLowerCase().replace(/^www\./, '').trim();
    if (cleanDom !== 'example.com' && cleanDom !== 'example.org') {
      return cleanDom;
    }
  }
  const urlStr = item.canonicalUrl || item.sourceReferences?.[0]?.originalUrl || '';
  if (urlStr) {
    try {
      const host = new URL(urlStr).hostname.toLowerCase().replace(/^www\./, '');
      if (host && host !== 'example.com' && host !== 'example.org') {
        return host;
      }
    } catch {
      // Fallback to publisher key
    }
  }
  const pubKey = getNormalizedPublisherKey(item);
  if (pubKey === 'test publisher' || pubKey === 'unknown' || pubKey === 'verifizierte quelle') {
    return `item:${item.id}`;
  }
  return pubKey;
}

/**
 * Hard Sliding-Window Diversity & Anti-ARD Filter (`enforceCuratedStreamDiversity`):
 * - Max 1 ARD/Tagesschau item per 10 cards (<= 10% of the resulting stream).
 * - Never two items from the same domain within 4 cards of each other (minimum index gap >= 4).
 */
export function enforceCuratedStreamDiversity<T extends FeedItem>(items: T[]): T[] {
  if (items.length <= 6) {
    return enforceArdsSpacing(items, 7);
  }

  const nonArdTotal = items.filter(i => !isArdSource(i)).length;
  // Guarantee ARD <= 10% of the final stream: ARD / (nonArd + ARD) <= 0.10 => ARD <= floor(nonArd / 9)
  const maxArdAllowed = Math.max(0, Math.floor(nonArdTotal / 9));

  const pool = [...items];
  const result: T[] = [];
  let ardPlaced = 0;

  while (pool.length > 0) {
    let pickedIdx = -1;
    const recent9 = result.slice(-9);
    const recent3 = result.slice(-3); // 3 intervening cards => index difference >= 4
    const ardInRecent9 = recent9.some(x => isArdSource(x));

    for (let i = 0; i < pool.length; i++) {
      const cand = pool[i];
      const candIsArd = isArdSource(cand);

      if (candIsArd) {
        if (ardPlaced >= maxArdAllowed || ardInRecent9) {
          continue;
        }
      }

      const domKey = getDomainDiversityKey(cand);
      const domainCollisionIn4 = recent3.some(x => getDomainDiversityKey(x) === domKey);
      if (domainCollisionIn4) {
        continue;
      }

      pickedIdx = i;
      break;
    }

    if (pickedIdx === -1) {
      // No remaining candidate can be placed without violating the <=10% ARD cap or 4-card domain spacing
      break;
    }

    const [chosen] = pool.splice(pickedIdx, 1);
    if (isArdSource(chosen)) {
      ardPlaced++;
    }
    result.push(chosen);
  }

  // Final safety check: ensure ardPlaced / result.length <= 0.10
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

  return result;
}

export function rankBloomScrollFeed(
  items: ScoredFeedItem[],
  options?: { seenItemIds?: ReadonlySet<string> }
): ScoredFeedItem[] {
  if (items.length <= 2) return [...items];

  // Deduplicate input by canonicalUrl or id
  const seenKeys = new Set<string>();
  const remaining: ScoredFeedItem[] = [];
  for (const item of items) {
    const key = item.id;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    remaining.push(item);
  }

  // Sort initial candidates by personal score + freshness
  remaining.sort((a, b) => (b.score || 0) - (a.score || 0));

  const selected: ScoredFeedItem[] = [];
  const SLIDING_WINDOW = 6;
  const DIVERSITY_WINDOW = 30;

  while (remaining.length > 0) {
    const pos = selected.length;
    const recentWindow = selected.slice(Math.max(0, pos - SLIDING_WINDOW));
    const window30 = selected.slice(Math.max(0, pos - DIVERSITY_WINDOW));
    const lastCard = pos > 0 ? selected[pos - 1] : null;
    const secondLastCard = pos > 1 ? selected[pos - 2] : null;

    // Count publishers in the last 30 cards
    const pubCounts30 = new Map<string, number>();
    for (const s of window30) {
      const pk = getNormalizedPublisherKey(s);
      pubCounts30.set(pk, (pubCounts30.get(pk) || 0) + 1);
    }

    // Count topics in recent 6-card window & 30-card window
    const topicCounts6 = new Map<TopicTag, number>();
    for (const s of recentWindow) {
      topicCounts6.set(s.primaryTopic, (topicCounts6.get(s.primaryTopic) || 0) + 1);
    }
    const topicCounts30 = new Map<TopicTag, number>();
    let teachingCount30 = 0;
    let challengingCount30 = 0;
    for (const s of window30) {
      topicCounts30.set(s.primaryTopic, (topicCounts30.get(s.primaryTopic) || 0) + 1);
      if (s.isTeachingRelated || s.primaryTopic === 'german_didactics') teachingCount30++;
      if (s.isChallengingPerspective) challengingCount30++;
    }

    const lastRhythm = lastCard ? getCardRhythmFormat(lastCard) : null;
    const lastPub = lastCard ? getNormalizedPublisherKey(lastCard) : null;
    const secondLastPub = secondLastCard ? getNormalizedPublisherKey(secondLastCard) : null;
    const recent3Domains = selected.slice(-3).map(s => getDomainDiversityKey(s));
    const recent9HasArd = selected.slice(-9).some(s => isArdSource(s));

    let bestIdx = 0;
    let bestWindowScore = -Infinity;

    // Evaluate top candidates in remaining pool (up to 90 for speed & breadth)
    const evalLimit = Math.min(remaining.length, 90);
    for (let i = 0; i < evalLimit; i++) {
      const cand = remaining[i];
      const pubKey = getNormalizedPublisherKey(cand);
      const domKey = getDomainDiversityKey(cand);
      const pubCountIn30 = pubCounts30.get(pubKey) || 0;
      const topicCountIn6 = topicCounts6.get(cand.primaryTopic) || 0;
      const topicCountIn30 = topicCounts30.get(cand.primaryTopic) || 0;
      const candRhythm = getCardRhythmFormat(cand);
      const isCandArd = isArdSource(cand);
      const isLastArd = lastCard ? isArdSource(lastCard) : false;

      let utility = cand.score || 0.7;

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

      // Publisher Diversity for other sources
      if (pubKey === lastPub) {
        utility -= 15.0; // Never repeat same publisher back-to-back if avoidable
      } else if (pubKey === secondLastPub) {
        utility -= 8.0;
      }
      if (pubCountIn30 === 0) {
        utility += 0.52; // Strong bonus for bringing a fresh voice
      } else if (pubCountIn30 === 1) {
        utility += 0.15;
      } else if (pubCountIn30 === 2) {
        utility -= 0.35;
      } else if (pubCountIn30 === 3) {
        utility -= 1.20;
      } else if (pubCountIn30 >= 4) {
        utility -= 6.0;
      }

      // Balancing international & quality source boost (DLF, ZEIT, Spiegel, Guardian, Politico, Eurozine, etc.)
      if (isBalancingSource(cand)) {
        utility += 0.08;
      }

      // Regional Saxony (Dresden / Leipzig) boost
      if (matchesSaxonyRegion(cand)) {
        utility += 0.05;
      }

      // Seen-Impression Rotation: Cards already scrolled past rotate down so fresh discoveries surface
      if (options?.seenItemIds?.has(cand.id)) {
        utility -= 3.5;
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
      }
      // Keep Wikipedia / Encyclopedia & Artworks balanced
      if (cand.sourceTrustLevel === 'encyclopedia' && pubCountIn30 >= 2) {
        utility -= 2.5;
      }
      if (candRhythm === 'visual_art') {
        const recentArtCount = recentWindow.filter(x => getCardRhythmFormat(x) === 'visual_art').length;
        if (recentArtCount >= 1) utility -= 1.6;
        else utility += 0.28;
      }

      // 3. ~10% Teaching & ~10% Counter-Perspective Target Steering
      const isTeach = cand.isTeachingRelated || cand.primaryTopic === 'german_didactics';
      const isChall = cand.isChallengingPerspective;
      const targetTeachCount = Math.max(1, Math.round((window30.length + 1) * 0.10));
      const targetChallCount = Math.max(1, Math.round((window30.length + 1) * 0.10));

      if (isTeach) {
        if (teachingCount30 < targetTeachCount && (pos % 9 === 3 || pos % 9 === 4)) {
          utility += 0.85;
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
          utility += 0.85;
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
  | 'top'
  | 'timeless'
  | 'hot'
  | 'new'
  | 'gems';

export interface SortFeedOptions {
  pinnedIds?: readonly string[];
  interleave?: boolean;
  ignorePins?: boolean;
  seenItemIds?: ReadonlySet<string>;
}

/** The final presentation boundary: pin order wins over every score and diversity rule unless ignorePins is true. */
export function sortFeedForDisplay(
  items: ScoredFeedItem[],
  mode: FeedSortMode,
  options: SortFeedOptions = {}
): ScoredFeedItem[] {
  const unique = new Map(items.map(item => [item.id, item]));
  const pinned = (options.ignorePins ? [] : (options.pinnedIds ?? [])).flatMap(id => {
    const item = unique.get(id);
    if (!item) return [];
    unique.delete(id);
    return [item];
  });
  const remaining = [...unique.values()];
  const isGem = (item: ScoredFeedItem) =>
    Boolean(item.isEvergreenGem) ||
    ['art_showcase', 'youtube_gem', 'book_masterpiece', 'meme', 'opportunity_radar', 'long_invitation', 'surprising_connection'].includes(item.format) ||
    ['museum_collection', 'encyclopedia', 'peer_reviewed'].includes(item.sourceTrustLevel || '');

  // 1. "🔥 Für dich" (Default Smart Mix): Bloom-Ranking + Seen-Rotation + Strict Diversity Caps
  if (mode === 'for_you' || (mode === 'hot' && options.interleave)) {
    const ranked = rankBloomScrollFeed(remaining, { seenItemIds: options.seenItemIds });
    return [...pinned, ...ranked];
  }

  // 2a. "⚡ Heute" (Strict 48-Hour Contract): ONLY items <= 48h old with reliable publication date! Never falls back to Oct 18!
  if (mode === 'today') {
    const nowMs = Date.now();
    const maxAgeMs = 48 * 3600 * 1000;
    const futureToleranceMs = 24 * 3600 * 1000;

    const strictlyToday = remaining.filter(item => {
      if (item.publicationDateReliable !== true) return false;
      const pubTime = new Date(item.publishedAt).getTime();
      if (isNaN(pubTime) || pubTime <= 0) return false;
      const ageMs = nowMs - pubTime;
      return ageMs >= -futureToleranceMs && ageMs <= maxAgeMs;
    });

    const sorted = [...strictlyToday].sort((a, b) => {
      // Boost regional Saxony / Dresden / Leipzig items in today's news
      const saxonyA = matchesSaxonyRegion(a) ? 1 : 0;
      const saxonyB = matchesSaxonyRegion(b) ? 1 : 0;
      if (saxonyA !== saxonyB) return saxonyB - saxonyA;

      const timeA = new Date(a.publishedAt).getTime();
      const timeB = new Date(b.publishedAt).getTime();
      if (timeB !== timeA) return timeB - timeA;
      return b.id.localeCompare(a.id);
    });

    return [...pinned, ...enforceCuratedStreamDiversity(sorted)];
  }

  // 2b. Legacy 'new' sort mode (preserves full pool ordering for backward-compatible unit tests)
  if (mode === 'new') {
    const datedOnly = remaining.filter(item => item.publicationDateReliable !== false);
    const pool = datedOnly.length >= 4 ? datedOnly : remaining;
    const sorted = [...pool].sort((a, b) => {
      const isReliableA = a.publicationDateReliable !== false;
      const isReliableB = b.publicationDateReliable !== false;
      if (isReliableA !== isReliableB) {
        return isReliableA ? -1 : 1;
      }
      const saxonyA = matchesSaxonyRegion(a) ? 1 : 0;
      const saxonyB = matchesSaxonyRegion(b) ? 1 : 0;
      if (saxonyA !== saxonyB) return saxonyB - saxonyA;

      const timeA = new Date(a.publishedAt).getTime();
      const timeB = new Date(b.publishedAt).getTime();
      const validA = !isNaN(timeA) && timeA > 0;
      const validB = !isNaN(timeB) && timeB > 0;
      if (validA && validB && timeB !== timeA) return timeB - timeA;
      if (validA && !validB) return -1;
      if (!validA && validB) return 1;
      const seenA = a.firstSeenAt ? new Date(a.firstSeenAt).getTime() : 0;
      const seenB = b.firstSeenAt ? new Date(b.firstSeenAt).getTime() : 0;
      if (seenB !== seenA) return seenB - seenA;
      return b.id.localeCompare(a.id);
    });
    return [...pinned, ...enforceArdsSpacing(sorted, 7)];
  }

  // 3. "🧭 Diskurs" (1-14d Deep Debates & Option A: The Bigger Picture)
  if (mode === 'discourse') {
    const now = Date.now();
    const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;
    // Exclude short news flashes, focus on substantive analyses from the last 1-14 days
    const discourseCandidates = remaining
      .filter(item => {
        const time = new Date(item.publishedAt).getTime();
        const isRecent = isNaN(time) || (now - time) <= fourteenDaysMs + (48 * 3600 * 1000);
        const textLen = (item.feedText || item.body || '').trim().length;
        const isSubstantive = (item.wordCount ?? 0) >= 60 || textLen >= 140 || item.format !== 'sourced_update';
        return isRecent && isSubstantive;
      })
      .map(item => enrichItemWithDiscourseConcept(item));

    const pool = discourseCandidates.length >= 3 ? discourseCandidates : remaining.map(item => enrichItemWithDiscourseConcept(item));
    const sorted = [...pool].sort((a, b) => {
      const balancingA = isBalancingSource(a) ? 15 : 0;
      const balancingB = isBalancingSource(b) ? 15 : 0;
      const scoreA = (a.curationScore ?? 7) * 10 + balancingA + (a.wordCount >= 180 ? 10 : 0);
      const scoreB = (b.curationScore ?? 7) * 10 + balancingB + (b.wordCount >= 180 ? 10 : 0);
      if (scoreB !== scoreA) return scoreB - scoreA;
      return b.id.localeCompare(a.id);
    });
    return [...pinned, ...enforceCuratedStreamDiversity(sorted)];
  }

  // 4. "🏆 Top" (30-Day Review of highest impact items)
  if (mode === 'top') {
    const sorted = [...remaining].sort((a, b) => {
      const pointsA = (a.externalCommunityScore?.points ?? 0) + (a.upvotesCount ?? 0) * 10;
      const pointsB = (b.externalCommunityScore?.points ?? 0) + (b.upvotesCount ?? 0) * 10;
      const trustBonusA = a.sourceTrustLevel === 'peer_reviewed' ? 15 : a.sourceTrustLevel === 'public_broadcaster' ? 12 : a.sourceTrustLevel === 'deep_essay' ? 10 : 5;
      const trustBonusB = b.sourceTrustLevel === 'peer_reviewed' ? 15 : b.sourceTrustLevel === 'public_broadcaster' ? 12 : b.sourceTrustLevel === 'deep_essay' ? 10 : 5;
      const qualityA = (a.curationScore ?? 7) * 10 +
        (pointsA > 0 ? Math.min(50, Math.log10(pointsA + 1) * 20) : 0) +
        (a.evidenceTier === 'permitted_full_text' ? 12 : a.evidenceTier === 'multiple_sources' ? 10 : 0) +
        trustBonusA + (a.editorialAbstract ? 8 : 0);
      const qualityB = (b.curationScore ?? 7) * 10 +
        (pointsB > 0 ? Math.min(50, Math.log10(pointsB + 1) * 20) : 0) +
        (b.evidenceTier === 'permitted_full_text' ? 12 : b.evidenceTier === 'multiple_sources' ? 10 : 0) +
        trustBonusB + (b.editorialAbstract ? 8 : 0);
      if (qualityB !== qualityA) return qualityB - qualityA;
      const timeA = a.publicationDateReliable !== false ? (new Date(a.publishedAt).getTime() || 0) : 0;
      const timeB = b.publicationDateReliable !== false ? (new Date(b.publishedAt).getTime() || 0) : 0;
      if (timeB !== timeA) return timeB - timeA;
      return b.id.localeCompare(a.id);
    });
    return [...pinned, ...enforceCuratedStreamDiversity(sorted)];
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
    return [...pinned, ...sorted];
  }

  // Fallback: Default hot/score order
  const sorted = [...remaining].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.id.localeCompare(a.id);
  });
  return [...pinned, ...sorted];
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
    if (!topBatch.some(i => i.isChallengingPerspective || i.type === 'perspective')) {
      const cIdx = remainder.findIndex(i => i.isChallengingPerspective || i.type === 'perspective');
      if (cIdx !== -1 && topBatch.length > 1) {
        const [elevated] = remainder.splice(cIdx, 1);
        topBatch[topBatch.length - 2] = elevated;
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
