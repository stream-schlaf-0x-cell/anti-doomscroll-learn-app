import { FeedItem, UserProfile, ReadingInteraction, TopicTag } from './types';

export interface ScoredFeedItem extends FeedItem {
  score: number;
  scoreBreakdown: {
    topicAffinity: number;
    durationMatch: number;
    depthBonus: number;
    feedbackMultiplier: number;
    explanation: string;
  };
}

/**
 * Computes deterministic score for a feed item based on user profile and past interactions.
 */
export function scoreFeedItem(
  item: FeedItem,
  profile: UserProfile,
  interactions: Record<string, ReadingInteraction> = {}
): ScoredFeedItem {
  const interaction = interactions[item.id];

  // 1. Topic Affinity Calculation
  let primaryWeight = profile.explicitInterests[item.primaryTopic] ?? 0.5;
  let secondaryBonus = 0;
  for (const topic of item.topics) {
    if (topic !== item.primaryTopic) {
      const w = profile.explicitInterests[topic] ?? 0.5;
      secondaryBonus += w * 0.2;
    }
  }
  const topicAffinity = Math.min(1.0, primaryWeight + secondaryBonus);

  // 2. Duration Matching
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

  // 3. Intellectual Depth Bonus (encourage thought and perspective over quick consumption)
  const depthBonus = (item.type === 'perspective' || item.type === 'deep_dive' || item.type === 'connection') ? 0.15 : 0;

  // 4. Feedback Adjustment
  let feedbackMultiplier = 1.0;
  if (interaction?.feedback === 'more_like_this') {
    feedbackMultiplier = 1.25;
  } else if (interaction?.feedback === 'less_like_this') {
    feedbackMultiplier = 0.40;
  }

  // 5. Unread / In-Progress Freshness
  const unreadBonus = interaction?.completedAt ? -0.15 : 0.10;

  // Normalized base score: topic (50%) + duration (25%) + depth (15%) + freshness (10%)
  const baseScore = topicAffinity * 0.50 + durationMatch * 0.25 + depthBonus + Math.max(0, unreadBonus);

  // Final deterministic composite score
  const finalScore = Math.max(0.01, Math.round((baseScore * feedbackMultiplier + (unreadBonus < 0 ? unreadBonus : 0)) * 1000) / 1000);

  // Human-readable explanation in German
  const affinityPercent = Math.round(topicAffinity * 100);
  let reason = `Affinität zu ${getTopicLabel(item.primaryTopic)}: ${affinityPercent}% • Lesezeit: ${mins} Min.`;
  if (depthBonus > 0) {
    reason += ` • Hohe inhaltliche Tiefe (${formatContentType(item.type)})`;
  }
  if (feedbackMultiplier > 1.0) {
    reason += ` • Positives Feedback vermerkt`;
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
      explanation: reason
    }
  };
}

/**
 * Re-ranks feed items with topic diversity interleaving.
 * Prevents identical primary topics from clumping together consecutively.
 */
export function rankAndInterleaveFeed(
  items: FeedItem[],
  profile: UserProfile,
  interactions: Record<string, ReadingInteraction> = {}
): ScoredFeedItem[] {
  // Score all items
  const scored = items.map(item => scoreFeedItem(item, profile, interactions));

  // Sort descending by score
  scored.sort((a, b) => b.score - a.score);

  // Apply diversity interleaving
  const result: ScoredFeedItem[] = [];
  const pool = [...scored];

  while (pool.length > 0) {
    const lastTopic = result.length > 0 ? result[result.length - 1].primaryTopic : null;

    // Find the highest scoring item whose primaryTopic is different from the last added item
    let nextIndex = pool.findIndex(item => item.primaryTopic !== lastTopic);

    // If no distinct topic exists (or only 1-2 items remaining), take the next highest
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
