/**
 * Recursive Learning Engine
 * 
 * Continuously adapts the user's cognitive vector and recommendation weights
 * based on reading behavior, feedback signals, and Raindrop curation.
 * 
 * The learning loop is transparent, inspectable by the Ultra Master,
 * and maintains epistemic diversity (preventing narrow algorithmic filter bubbles).
 */

import { TopicTag, UserProfile, FeedItem } from '../domain/types';
import { applyVoteFeedbackToProfile, extractConceptKeywords } from '../domain/ranking';
import { appStorage } from '../data/storage';

export interface LearningTelemetryEvent {
  timestamp: string;
  type:
    | 'upvote'
    | 'downvote'
    | 'completed_reading'
    | 'note_created'
    | 'bookmark_saved'
    | 'feedback_positive'
    | 'feedback_negative'
    | 'feedback_already_known'
    | 'feedback_more_depth'
    | 'raindrop_sync';
  topic: TopicTag;
  delta: number;
  reason: string;
}

export interface LearningEngineState {
  events: LearningTelemetryEvent[];
  domainTrustScores: Record<string, number>; // Domain -> trust multiplier (e.g. 1.25)
  processedInteractions: Record<string, string>; // Legacy compatibility: itemId -> last eventType
  appliedInteractions: Record<string, boolean>; // Composite idempotency key: `${itemId}:${eventType}` -> true
  totalLearningCycles: number;
  lastTunedAt: string;
}

const DEFAULT_DOMAIN_TRUST_SCORES: Record<string, number> = {
  'plato.stanford.edu': 1.35,
  'quantamagazine.org': 1.30,
  'tagesschau.de': 1.20,
  'spektrum.de': 1.25,
  'aeon.co': 1.25,
  'cdm.link': 1.15
};

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function decayFeedbackRecord(
  record: Record<string, number> | undefined,
  factor: number
): Record<string, number> {
  const next: Record<string, number> = {};
  if (!record) return next;
  for (const [key, value] of Object.entries(record)) {
    if (typeof value !== 'number' || Number.isNaN(value)) continue;
    const decayed = Math.round(value * factor * 100) / 100;
    if (decayed >= 0.15) {
      next[key] = decayed;
    }
  }
  return next;
}

/**
 * Pure helper that smoothly decays stale feedbackMemory boosts/penalties
 * (half-life 28 days) and relaxes derivedWeights gently back toward explicitInterests,
 * while leaving feedMixRatio completely untouched.
 */
export function applyGentleFeedbackDecay(
  profile: UserProfile,
  nowMs = Date.now()
): UserProfile {
  const mem = profile.feedbackMemory;
  const lastDecayRaw = mem?.lastFeedbackDecayAt;
  const lastDecayMs = lastDecayRaw ? new Date(lastDecayRaw).getTime() : NaN;

  if (!lastDecayRaw || Number.isNaN(lastDecayMs)) {
    return {
      ...profile,
      feedbackMemory: {
        boostedTopics: { ...(mem?.boostedTopics || {}) },
        penalizedTopics: { ...(mem?.penalizedTopics || {}) },
        boostedAuthors: { ...(mem?.boostedAuthors || {}) },
        penalizedAuthors: { ...(mem?.penalizedAuthors || {}) },
        boostedKeywords: { ...(mem?.boostedKeywords || {}) },
        penalizedKeywords: { ...(mem?.penalizedKeywords || {}) },
        boostedDomains: { ...(mem?.boostedDomains || {}) },
        penalizedDomains: { ...(mem?.penalizedDomains || {}) },
        boostedSpaces: { ...(mem?.boostedSpaces || {}) },
        penalizedSpaces: { ...(mem?.penalizedSpaces || {}) },
        lastFeedbackDecayAt: new Date(nowMs).toISOString()
      }
    };
  }

  const elapsedMs = nowMs - lastDecayMs;
  if (elapsedMs <= ONE_DAY_MS) {
    return profile;
  }

  const daysElapsed = elapsedMs / ONE_DAY_MS;
  const factor = Math.pow(0.5, daysElapsed / 28);

  const nextDerivedWeights: Record<string, number> = {};
  for (const [topic, derivedVal] of Object.entries(profile.derivedWeights || {})) {
    if (typeof derivedVal !== 'number' || Number.isNaN(derivedVal)) continue;
    const explicitVal = profile.explicitInterests?.[topic as TopicTag];
    if (typeof explicitVal === 'number' && !Number.isNaN(explicitVal)) {
      const relaxed = derivedVal + (explicitVal - derivedVal) * (1 - factor);
      nextDerivedWeights[topic] = Math.round(relaxed * 1000) / 1000;
    } else {
      nextDerivedWeights[topic] = derivedVal;
    }
  }

  return {
    ...profile,
    derivedWeights: nextDerivedWeights,
    feedbackMemory: {
      boostedTopics: decayFeedbackRecord(mem?.boostedTopics, factor),
      penalizedTopics: decayFeedbackRecord(mem?.penalizedTopics, factor),
      boostedAuthors: decayFeedbackRecord(mem?.boostedAuthors, factor),
      penalizedAuthors: decayFeedbackRecord(mem?.penalizedAuthors, factor),
      boostedKeywords: decayFeedbackRecord(mem?.boostedKeywords, factor),
      penalizedKeywords: decayFeedbackRecord(mem?.penalizedKeywords, factor),
      boostedDomains: decayFeedbackRecord(mem?.boostedDomains, factor),
      penalizedDomains: decayFeedbackRecord(mem?.penalizedDomains, factor),
      boostedSpaces: decayFeedbackRecord(mem?.boostedSpaces, factor),
      penalizedSpaces: decayFeedbackRecord(mem?.penalizedSpaces, factor),
      lastFeedbackDecayAt: new Date(nowMs).toISOString()
    }
  };
}

function applyPositiveSignalToFeedbackMemory(profile: UserProfile, item: FeedItem): UserProfile {
  const primaryTopic = item.primaryTopic || 'philosophy_ethics';
  const domain = (item.sourceDomain || item.sourceReferences?.[0]?.publisher || '').toLowerCase().trim();
  const author = (item.sourceReferences?.[0]?.author || item.sourceReferences?.[0]?.publisher || '').trim();
  const space = item.space ? item.space.toLowerCase().trim() : '';
  const keywords = extractConceptKeywords(item).slice(0, 2);

  const mem = profile.feedbackMemory;
  const nextMemory: UserProfile['feedbackMemory'] = {
    boostedTopics: {
      ...(mem?.boostedTopics || {}),
      [primaryTopic]: (mem?.boostedTopics?.[primaryTopic] || 0) + 1
    },
    penalizedTopics: { ...(mem?.penalizedTopics || {}) },
    boostedAuthors: { ...(mem?.boostedAuthors || {}) },
    penalizedAuthors: { ...(mem?.penalizedAuthors || {}) },
    boostedKeywords: { ...(mem?.boostedKeywords || {}) },
    penalizedKeywords: { ...(mem?.penalizedKeywords || {}) },
    boostedDomains: { ...(mem?.boostedDomains || {}) },
    penalizedDomains: { ...(mem?.penalizedDomains || {}) },
    boostedSpaces: { ...(mem?.boostedSpaces || {}) },
    penalizedSpaces: { ...(mem?.penalizedSpaces || {}) },
    ...(mem?.lastFeedbackDecayAt ? { lastFeedbackDecayAt: mem.lastFeedbackDecayAt } : {})
  };

  if (domain) {
    nextMemory.boostedDomains[domain] = (nextMemory.boostedDomains[domain] || 0) + 1;
  }
  if (author) {
    nextMemory.boostedAuthors[author] = (nextMemory.boostedAuthors[author] || 0) + 1;
  }
  for (const kw of keywords) {
    nextMemory.boostedKeywords[kw] = (nextMemory.boostedKeywords[kw] || 0) + 1;
  }
  if (space) {
    nextMemory.boostedSpaces[space] = (nextMemory.boostedSpaces[space] || 0) + 1;
  }

  return {
    ...profile,
    feedbackMemory: nextMemory
  };
}

export function normalizeDomainTrustKey(raw: string): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      return new URL(trimmed).hostname.toLowerCase().replace(/^www\./, '').trim();
    } catch {
      // Fallback to string cleanup below
    }
  }
  return trimmed
    .toLowerCase()
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
    .trim();
}

function extractNormalizedDomain(item: FeedItem): string {
  const direct = normalizeDomainTrustKey(item.sourceDomain || '');
  if (direct) return direct;
  const rawUrl = item.canonicalUrl || item.sourceReferences?.[0]?.originalUrl || '';
  if (!rawUrl) return '';
  return normalizeDomainTrustKey(rawUrl);
}

export class RecursiveLearningEngine {
  private static STORAGE_KEY = '@atem:recursive_learning_state';
  private static DAMPENING_FACTOR = 0.85; // Bounded dampening to prevent abrupt swings
  private static MIN_WEIGHT = 0.10;
  private static MAX_WEIGHT = 0.98;
  private static cachedState: LearningEngineState | null = null;

  private static createDefaultState(): LearningEngineState {
    return {
      events: [],
      domainTrustScores: { ...DEFAULT_DOMAIN_TRUST_SCORES },
      processedInteractions: {},
      appliedInteractions: {},
      totalLearningCycles: 0,
      lastTunedAt: new Date().toISOString()
    };
  }

  public static getCachedDomainTrustScores(): Record<string, number> {
    return this.cachedState?.domainTrustScores ?? { ...DEFAULT_DOMAIN_TRUST_SCORES };
  }

  public static async resetState(): Promise<void> {
    const fresh = this.createDefaultState();
    this.cachedState = fresh;
    await appStorage.setItem(this.STORAGE_KEY, JSON.stringify(fresh));
  }

  /**
   * Immediately suppresses a noisy source domain/publisher by setting its learned trust multiplier
   * to 0.1 and persisting the updated engine state via appStorage.
   */
  public static async muteSourceDomain(domain: string): Promise<void> {
    const normalizedDomain = normalizeDomainTrustKey(domain);
    if (!normalizedDomain) return;

    const state = await this.getEngineState();
    state.domainTrustScores[normalizedDomain] = 0.1;
    state.lastTunedAt = new Date().toISOString();
    this.cachedState = state;
    await appStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
  }

  /**
   * Retrieves the current telemetry and learning state.
   */
  public static async getEngineState(): Promise<LearningEngineState> {
    try {
      const raw = await appStorage.getItem(this.STORAGE_KEY);
      if (!raw) {
        const defaults = this.createDefaultState();
        this.cachedState = defaults;
        return defaults;
      }
      const parsed = JSON.parse(raw) as Partial<LearningEngineState>;
      const state: LearningEngineState = {
        events: Array.isArray(parsed.events) ? parsed.events : [],
        domainTrustScores:
          parsed.domainTrustScores && typeof parsed.domainTrustScores === 'object'
            ? parsed.domainTrustScores
            : { ...DEFAULT_DOMAIN_TRUST_SCORES },
        processedInteractions: parsed.processedInteractions || {},
        appliedInteractions: parsed.appliedInteractions || {},
        totalLearningCycles: typeof parsed.totalLearningCycles === 'number' ? parsed.totalLearningCycles : 0,
        lastTunedAt: typeof parsed.lastTunedAt === 'string' ? parsed.lastTunedAt : new Date().toISOString()
      };
      if (!parsed.appliedInteractions) {
        for (const [itemId, evt] of Object.entries(state.processedInteractions)) {
          if (typeof evt === 'string') {
            state.appliedInteractions[`${itemId}:${evt}`] = true;
          }
        }
      }
      this.cachedState = state;
      return state;
    } catch {
      const defaults = this.createDefaultState();
      this.cachedState = defaults;
      return defaults;
    }
  }

  /**
   * Records a learning event and recalculates updated topic weights.
   * Enforces idempotency per itemId: repeat triggers of the same event do not multiply deltas.
   * Keeps profile.explicitInterests immutable, writing learned adaptations into profile.derivedWeights.
   */
  public static async recordInteractionEvent(
    profile: UserProfile,
    item: FeedItem,
    eventType:
      | 'upvote'
      | 'downvote'
      | 'completed_reading'
      | 'note_created'
      | 'bookmark_saved'
      | 'feedback_positive'
      | 'feedback_negative'
      | 'feedback_already_known'
      | 'feedback_more_depth'
  ): Promise<{ updatedProfile: UserProfile; event: LearningTelemetryEvent | null }> {
    const state = await this.getEngineState();
    const primaryTopic = item.primaryTopic || 'philosophy_ethics';

    // Idempotency check: composite key ensures the same event type cannot be re-applied to the same item,
    // even if interleaving interactions (e.g. upvote -> note -> upvote) occur.
    const interactionKey = `${item.id}:${eventType}`;
    if (state.appliedInteractions?.[interactionKey]) {
      return { updatedProfile: profile, event: null };
    }

    // Base weight uses previous derived weight if present, otherwise explicit interest
    const currentBase = profile.derivedWeights?.[primaryTopic] ?? profile.explicitInterests[primaryTopic] ?? 0.50;

    let delta = 0;
    let reason = '';

    switch (eventType) {
      case 'upvote':
        delta = 0.10;
        reason = `Positives Votum für „${item.title.slice(0, 30)}…“`;
        break;
      case 'downvote':
        delta = -0.14;
        reason = `Kritisches Votum für „${item.title.slice(0, 30)}…“`;
        break;
      case 'completed_reading':
        delta = 0.08;
        reason = `Vollständige Lesezeit absolviert (${item.estimatedReadingMinutes} Min.)`;
        break;
      case 'note_created':
        delta = 0.12;
        reason = `Substantielle Notiz/Reflexion verfasst`;
        break;
      case 'bookmark_saved':
        delta = 0.09;
        reason = `Als Lesezeichen gesichert: „${item.title.slice(0, 30)}…“`;
        break;
      case 'feedback_positive':
        delta = 0.15;
        reason = `Direktes Feedback „Mehr davon“`;
        break;
      case 'feedback_negative':
        delta = -0.18;
        reason = `Direktes Feedback „Weniger davon“`;
        break;
      case 'feedback_already_known':
        delta = -0.06;
        reason = `Als bereits bekannt markiert (verhindert Wiederholungen)`;
        break;
      case 'feedback_more_depth':
        delta = 0.14;
        reason = `Bedarf nach mehr intellektueller Tiefe`;
        break;
    }

    // Apply bounded adaptive dampening [MIN_WEIGHT, MAX_WEIGHT]
    const newWeight = Math.max(
      this.MIN_WEIGHT,
      Math.min(this.MAX_WEIGHT, currentBase + delta * this.DAMPENING_FACTOR)
    );

    const event: LearningTelemetryEvent = {
      timestamp: new Date().toISOString(),
      type: eventType,
      topic: primaryTopic,
      delta: Math.round((newWeight - currentBase) * 100) / 100,
      reason
    };

    // Update domain trust for both normalized domain and publisher if present
    let trustDelta: number;
    let trustFloor = 0.3;
    let trustCap = 1.85;
    if (eventType === 'upvote') {
      trustDelta = 0.18;
      trustCap = 1.85;
    } else if (eventType === 'downvote') {
      trustDelta = -0.22;
      trustFloor = 0.3;
    } else if (eventType === 'feedback_positive') {
      trustDelta = 0.12;
      trustCap = 1.85;
    } else if (eventType === 'feedback_negative') {
      trustDelta = -0.16;
      trustFloor = 0.3;
    } else {
      trustDelta = delta > 0 ? 0.04 : -0.05;
      trustFloor = 0.3;
      trustCap = 1.85;
    }

    const normalizedDomain = extractNormalizedDomain(item);
    const publisher = (item.sourceReferences?.[0]?.publisher || '').trim();
    const trustKeys = new Set<string>();
    if (normalizedDomain) trustKeys.add(normalizedDomain);
    if (publisher && publisher.toLowerCase() !== normalizedDomain) {
      trustKeys.add(publisher);
    }
    for (const key of trustKeys) {
      const currentTrust = state.domainTrustScores[key] ?? 1.0;
      const effectiveFloor = trustDelta < 0 ? Math.min(currentTrust, trustFloor) : trustFloor;
      const effectiveCap = trustDelta > 0 ? Math.max(currentTrust, trustCap) : trustCap;
      const updatedTrust = Math.max(
        effectiveFloor,
        Math.min(effectiveCap, Math.round((currentTrust + trustDelta) * 1000) / 1000)
      );
      state.domainTrustScores[key] = updatedTrust;
    }

    // Record idempotency tokens
    if (!state.appliedInteractions) {
      state.appliedInteractions = {};
    }
    state.appliedInteractions[interactionKey] = true;
    if (!state.processedInteractions) {
      state.processedInteractions = {};
    }
    state.processedInteractions[item.id] = eventType;

    state.events.unshift(event);
    if (state.events.length > 50) {
      state.events = state.events.slice(0, 50); // Keep latest 50 events
    }
    state.totalLearningCycles++;
    state.lastTunedAt = new Date().toISOString();

    this.cachedState = state;
    await appStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));

    // Propagate concept, keyword, subchannel, and domain affinity into feedbackMemory
    let baseProfile = profile;
    if (eventType === 'upvote' || eventType === 'feedback_positive') {
      baseProfile = applyVoteFeedbackToProfile(profile, item, 'up');
    } else if (eventType === 'downvote' || eventType === 'feedback_negative') {
      baseProfile = applyVoteFeedbackToProfile(profile, item, 'down');
    } else if (
      eventType === 'bookmark_saved' ||
      eventType === 'completed_reading' ||
      eventType === 'note_created'
    ) {
      baseProfile = applyPositiveSignalToFeedbackMemory(profile, item);
    }

    // Update derivedWeights while keeping explicitInterests untouched
    const updatedProfile: UserProfile = {
      ...baseProfile,
      derivedWeights: {
        ...(baseProfile.derivedWeights || {}),
        [primaryTopic]: Math.round(newWeight * 100) / 100
      }
    };

    return { updatedProfile, event };
  }

  /**
   * Explains why a topic has its current weight based on learning history.
   */
  public static explainTopicEvolution(topic: TopicTag, events: LearningTelemetryEvent[]): string {
    const relevant = events.filter(e => e.topic === topic);
    if (relevant.length === 0) {
      return 'Grundkalibrierung aus dem Starter-Profil (noch keine individuellen Lesesignale).';
    }
    const positiveCount = relevant.filter(e => e.delta > 0).length;
    const negativeCount = relevant.filter(e => e.delta < 0).length;
    return `${relevant.length} Lernzyklen registriert (+${positiveCount} Bestätigungen, -${negativeCount} Korrekturen). Letzter Impuls: ${relevant[0].reason}.`;
  }
}
