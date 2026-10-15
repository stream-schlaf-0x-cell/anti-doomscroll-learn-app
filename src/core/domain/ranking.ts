import {
  FeedItem,
  UserProfile,
  ReadingInteraction,
  TopicTag,
  PersonalGoal,
  DayEditionType
} from './types';

export interface ScoredFeedItem extends FeedItem {
  score: number;
  scoreBreakdown: {
    topicAffinity: number;
    durationMatch: number;
    depthBonus: number;
    feedbackMultiplier: number;
    goalAlignment: number;
    authorBoost: number;
    explanation: string;
  };
}

const TOPIC_GOAL_MAP: Record<TopicTag, PersonalGoal> = {
  ai_apple: 'understand_tech',
  sound_synthesis: 'creative_music',
  contemplation_mind: 'deepen_attention',
  philosophy_ethics: 'philosophical_clarity',
  science_society: 'society_and_ethics',
  german_didactics: 'deepen_attention',
  memes_satire: 'philosophical_clarity',
  youtube_gems: 'society_and_ethics',
  book_mastery: 'philosophical_clarity',
  health_biohacking: 'deepen_attention',
  opportunities_growth: 'understand_tech'
};

export function getEffectiveTopicWeight(profile: UserProfile, topic: TopicTag): number {
  return profile.derivedWeights?.[topic] ?? profile.explicitInterests[topic] ?? 0.5;
}

/**
 * Computes deterministic multi-dimensional score for a feed item based on user profile,
 * personal goals, explicit feedback memory, and past interactions.
 */
export function scoreFeedItem(
  item: FeedItem,
  profile: UserProfile,
  interactions: Record<string, ReadingInteraction> = {}
): ScoredFeedItem {
  const interaction = interactions[item.id];

  // 1. Topic Affinity Calculation (considering both explicit and learned adaptive weights)
  const primaryWeight = getEffectiveTopicWeight(profile, item.primaryTopic);
  let secondaryBonus = 0;
  for (const topic of item.topics) {
    if (topic !== item.primaryTopic) {
      const w = getEffectiveTopicWeight(profile, topic);
      secondaryBonus += w * 0.2;
    }
  }
  const topicAffinity = Math.min(1.0, primaryWeight + secondaryBonus);

  // 2. Personal Goal Alignment
  const targetGoal = TOPIC_GOAL_MAP[item.primaryTopic];
  const goalAlignment = profile.explicitGoals?.[targetGoal] ?? 0.80;

  // 3. Duration Matching
  let durationMatch = 0.5;
  const pref = profile.readingPreferences.preferredDuration;
  const mins = item.estimatedReadingMinutes;

  if (pref === 'quick') {
    if (mins <= 2) durationMatch = 1.0;
    else if (mins <= 4) durationMatch = 0.6;
    else durationMatch = 0.2;
  } else if (pref === 'deep') {
    if (mins >= 4) durationMatch = 1.0;
    else if (mins >= 3) durationMatch = 0.7;
    else durationMatch = 0.3;
  } else if (pref === 'balanced') {
    if (mins >= 2 && mins <= 5) durationMatch = 1.0;
    else durationMatch = 0.7;
  } else {
    durationMatch = 0.8;
  }

  // 4. Intellectual Depth Bonus (encourage thought and perspective over quick consumption)
  const depthBonus = (
    item.type === 'perspective' ||
    item.type === 'deep_dive' ||
    item.type === 'connection' ||
    item.isChallengingPerspective
  ) ? 0.15 : 0;

  // 4.1 Evergreen Classic Bonus (reward timeless masterpieces)
  const evergreenBonus = item.isEvergreenGem ? 0.12 : 0;

  // 5. Author and Topic Feedback Memory
  let authorBoost = 0;
  const author = item.sourceReferences[0]?.author;
  if (author && profile.feedbackMemory?.boostedAuthors?.[author]) {
    authorBoost += 0.20;
  }
  if (author && profile.feedbackMemory?.penalizedAuthors?.[author]) {
    authorBoost -= 0.30;
  }

  let topicMemoryDelta = 0;
  if (profile.feedbackMemory?.boostedTopics?.[item.primaryTopic]) {
    topicMemoryDelta += 0.15;
  }
  if (profile.feedbackMemory?.penalizedTopics?.[item.primaryTopic]) {
    topicMemoryDelta -= 0.25;
  }

  // 6. Explicit Feedback Multiplier
  let feedbackMultiplier = 1.0;
  if (interaction?.feedback === 'more_like_this') {
    feedbackMultiplier = 1.30;
  } else if (interaction?.feedback === 'less_like_this') {
    feedbackMultiplier = 0.40;
  }

  // 7. Behavioral signals & Freshness
  let behaviorDelta = 0;
  if (profile.behavioralSignals?.completedReadIds?.includes(item.id) || interaction?.completedAt) {
    behaviorDelta -= 0.25;
  } else if (profile.behavioralSignals?.recentSavedIds?.includes(item.id) || interaction?.saved) {
    behaviorDelta += 0.15;
  } else if (profile.behavioralSignals?.recentOpenedIds?.includes(item.id)) {
    behaviorDelta -= 0.05;
  }

  // Composite score: topic (40%) + goal (20%) + duration (20%) + depth (10%) + evergreen & memory
  const baseScore =
    topicAffinity * 0.40 +
    goalAlignment * 0.20 +
    durationMatch * 0.20 +
    depthBonus +
    evergreenBonus +
    topicMemoryDelta +
    authorBoost +
    behaviorDelta;

  const finalScore = Math.max(
    0.01,
    Math.round((baseScore * feedbackMultiplier) * 1000) / 1000
  );

  // Human-readable German explanation
  const affinityPercent = Math.round(topicAffinity * 100);
  let reason = `Affinität zu ${getTopicLabel(item.primaryTopic)}: ${affinityPercent}% • Lesezeit: ${mins} Min.`;
  if (item.isEvergreenGem) {
    reason += ` • 🏛 Zeitloser Internet-Klassiker`;
  }
  if (item.isTeachingRelated) {
    reason += ` • Didaktischer Impuls für Schule & Unterricht`;
  }

  if (item.isChallengingPerspective) {
    reason += ` • Hinterfragt etablierte Sichtweisen`;
  }
  if (depthBonus > 0 && !item.isChallengingPerspective) {
    reason += ` • Hohe inhaltliche Tiefe (${formatContentType(item.type)})`;
  }
  if (feedbackMultiplier > 1.0) {
    reason += ` • Positives Feedback vermerkt`;
  }
  if (authorBoost > 0) {
    reason += ` • Bevorzugte Quelle`;
  }

  return {
    ...item,
    score: finalScore,
    relevanceExplanation: reason,
    scoreBreakdown: {
      topicAffinity,
      durationMatch,
      depthBonus,
      feedbackMultiplier,
      goalAlignment,
      authorBoost,
      explanation: reason
    }
  };
}

/**
 * Re-ranks feed items with soft editorial quota enforcement and topic diversity interleaving.
 * Guarantees ~10% teaching-related items and ~10% challenging perspectives in the primary batch,
 * and prevents identical primary topics from clumping together consecutively.
 */
export function rankAndInterleaveFeed(
  items: FeedItem[],
  profile: UserProfile,
  interactions: Record<string, ReadingInteraction> = {},
  options?: { batchSize?: number; targetTeachingRatio?: number; targetChallengingRatio?: number }
): ScoredFeedItem[] {
  // Score all items
  const scored = items.map(item => scoreFeedItem(item, profile, interactions));
  scored.sort((a, b) => b.score - a.score);

  const batchSize = options?.batchSize ?? Math.min(12, scored.length);
  const teachingTarget = options?.targetTeachingRatio ?? profile.editorialTargets?.teachingTargetRatio ?? 0.10;
  const challengingTarget = options?.targetChallengingRatio ?? profile.editorialTargets?.challengingTargetRatio ?? 0.10;

  // Split into active candidate batch and overflow pool
  const topBatch = scored.slice(0, batchSize);
  const remainder = scored.slice(batchSize);

  // Soft quota 1: Teaching related (~10% -> at least 1 item in batch of 10-12)
  if (teachingTarget > 0 && !topBatch.some(i => i.isTeachingRelated || i.primaryTopic === 'german_didactics')) {
    const teachingIndex = remainder.findIndex(i => i.isTeachingRelated || i.primaryTopic === 'german_didactics');
    if (teachingIndex !== -1) {
      const [elevated] = remainder.splice(teachingIndex, 1);
      const replaceIdx = topBatch.findIndex(i => !i.isChallengingPerspective && !i.isTeachingRelated);
      if (replaceIdx !== -1) {
        remainder.push(topBatch[replaceIdx]);
        topBatch.splice(replaceIdx, 1, elevated);
      }
    }
  }

  // Soft quota 2: Challenging perspective (~10% -> at least 1 item in batch of 10-12)
  if (challengingTarget > 0 && !topBatch.some(i => i.isChallengingPerspective || i.type === 'perspective')) {
    const challengingIndex = remainder.findIndex(i => i.isChallengingPerspective || i.type === 'perspective');
    if (challengingIndex !== -1) {
      const [elevated] = remainder.splice(challengingIndex, 1);
      const replaceIdx = topBatch.findIndex(i => !i.isChallengingPerspective && !i.isTeachingRelated);
      if (replaceIdx !== -1) {
        remainder.push(topBatch[replaceIdx]);
        topBatch.splice(replaceIdx, 1, elevated);
      }
    }
  }

  // Soft quota 3: Evergreen Classics & Internet Gems (~10-15% -> at least 1 timeless gem in primary batch)
  if (!topBatch.some(i => i.isEvergreenGem || i.format === 'book_masterpiece')) {
    const gemIndex = remainder.findIndex(i => i.isEvergreenGem || i.format === 'book_masterpiece');
    if (gemIndex !== -1) {
      const [elevated] = remainder.splice(gemIndex, 1);
      const replaceIdx = topBatch.findIndex(i => !i.isChallengingPerspective && !i.isTeachingRelated && !i.isEvergreenGem);
      if (replaceIdx !== -1) {
        remainder.push(topBatch[replaceIdx]);
        topBatch.splice(replaceIdx, 1, elevated);
      }
    }
  }

  // Interleave topics to prevent clumping
  const combined = [...topBatch, ...remainder];
  const result: ScoredFeedItem[] = [];
  const pool = [...combined];

  while (pool.length > 0) {
    const lastTopic = result.length > 0 ? result[result.length - 1].primaryTopic : null;
    let nextIndex = pool.findIndex(item => item.primaryTopic !== lastTopic);
    if (nextIndex === -1) {
      nextIndex = 0;
    }
    const [chosen] = pool.splice(nextIndex, 1);
    result.push(chosen);
  }

  return result;
}

function getTopicLabel(topic: TopicTag): string {
  switch (topic) {
    case 'philosophy_ethics': return 'Ethik & Philosophie';
    case 'german_didactics': return 'Didaktik & Schule';
    case 'ai_apple': return 'KI & Apple';
    case 'contemplation_mind': return 'Geist & Kontemplation';
    case 'science_society': return 'Wissenschaft & Ideen';
    case 'sound_synthesis': return 'Klang & Synthese';
    case 'memes_satire': return 'High-IQ Memes & Satire';
    case 'youtube_gems': return 'YouTube Gems';
    case 'book_mastery': return 'Buch-Meisterwerke';
    case 'health_biohacking': return 'Gesundheit & Biohacking';
    case 'opportunities_growth': return 'Chancen & Hebel';
  }
}

function formatContentType(type: string): string {
  switch (type) {
    case 'quick_insight': return 'Kompakter Einblick';
    case 'briefing': return 'Überblick';
    case 'deep_dive': return 'Tiefgang';
    case 'perspective': return 'Diskurs & Perspektiven';
    case 'connection': return 'Interdisziplinär';
    case 'personal_update': return 'Themen-Update';
    default: return 'Entdeckung';
  }
}

/**
 * Determines the appropriate daily edition (morning, midday, evening) based on current hour in user's timezone.
 * Defaults to Europe/Berlin.
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

/**
 * Ranks items for a specific edition (Guten Morgen, Mittendrin, Guten Abend).
 * Applies edition-specific affinities, batch sizes (6-8 for morning, 4-6 for midday/evening),
 * soft editorial quotas, interleaving, and reproducible variation based on dateSeed.
 */
export function rankEditionFeed(
  items: FeedItem[],
  editionType: DayEditionType,
  profile: UserProfile,
  interactions: Record<string, ReadingInteraction> = {},
  dateSeed?: string
): ScoredFeedItem[] {
  const seed = dateSeed || new Date().toISOString().slice(0, 10);
  const targetCount = editionType === 'morning' ? 7 : 5;

  // Compute reproducible hash variation factor per item
  const scored = items.map(item => {
    const base = scoreFeedItem(item, profile, interactions);

    // Deterministic pseudo-random variation [0.94, 1.06] based on seed + item.id + editionType
    let hash = 0;
    const str = `${seed}_${editionType}_${item.id}`;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    const variationFactor = 0.94 + (Math.abs(hash) % 120) / 1000;

    // Edition-specific affinity boosts
    let editionMultiplier = 1.0;
    if (editionType === 'morning') {
      if (
        item.primaryTopic === 'science_society' ||
        item.primaryTopic === 'opportunities_growth' ||
        item.format === 'sourced_update' ||
        item.format === 'intriguing_question'
      ) {
        editionMultiplier = 1.15;
      }
    } else if (editionType === 'midday') {
      if (
        item.primaryTopic === 'memes_satire' ||
        item.primaryTopic === 'health_biohacking' ||
        item.format === 'creative_idea' ||
        item.format === 'concise_insight'
      ) {
        editionMultiplier = 1.18;
      }
    } else if (editionType === 'evening') {
      if (
        item.primaryTopic === 'sound_synthesis' ||
        item.primaryTopic === 'book_mastery' ||
        item.primaryTopic === 'contemplation_mind' ||
        item.isEvergreenGem ||
        item.format === 'long_invitation'
      ) {
        editionMultiplier = 1.20;
      }
    }

    // Explicit item targetEditions matching
    if (item.targetEditions && item.targetEditions.length > 0) {
      if (item.targetEditions.includes(editionType)) {
        editionMultiplier += 0.10;
      } else {
        editionMultiplier -= 0.15;
      }
    }

    const adjustedScore = Math.round(base.score * variationFactor * editionMultiplier * 1000) / 1000;
    return {
      ...base,
      score: adjustedScore
    };
  });

  scored.sort((a, b) => b.score - a.score);

  // Soft quotas according to edition
  const topBatch = scored.slice(0, targetCount);
  const remainder = scored.slice(targetCount);

  // Quota 1: Teaching related (~10% across editions, at least 1 in morning if available)
  if (editionType === 'morning' && !topBatch.some(i => i.isTeachingRelated || i.primaryTopic === 'german_didactics')) {
    const tIdx = remainder.findIndex(i => i.isTeachingRelated || i.primaryTopic === 'german_didactics');
    if (tIdx !== -1) {
      const [elevated] = remainder.splice(tIdx, 1);
      const repIdx = topBatch.findIndex(i => !i.isChallengingPerspective && !i.isTeachingRelated);
      if (repIdx !== -1) {
        remainder.push(topBatch[repIdx]);
        topBatch.splice(repIdx, 1, elevated);
      }
    }
  }

  // Quota 2: Challenging perspective (~10% across editions)
  if (!topBatch.some(i => i.isChallengingPerspective || i.type === 'perspective')) {
    const cIdx = remainder.findIndex(i => i.isChallengingPerspective || i.type === 'perspective');
    if (cIdx !== -1) {
      const [elevated] = remainder.splice(cIdx, 1);
      const repIdx = topBatch.findIndex(i => !i.isChallengingPerspective && !i.isTeachingRelated);
      if (repIdx !== -1) {
        remainder.push(topBatch[repIdx]);
        topBatch.splice(repIdx, 1, elevated);
      }
    }
  }

  // Interleave topics to prevent clumping
  const result: ScoredFeedItem[] = [];
  const pool = [...topBatch];

  while (pool.length > 0) {
    const lastTopic = result.length > 0 ? result[result.length - 1].primaryTopic : null;
    let nextIndex = pool.findIndex(item => item.primaryTopic !== lastTopic);
    if (nextIndex === -1) {
      nextIndex = 0;
    }
    const [chosen] = pool.splice(nextIndex, 1);
    result.push(chosen);
  }

  return result;
}
