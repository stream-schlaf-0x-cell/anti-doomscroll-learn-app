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
import { appStorage } from '../data/storage';

export interface LearningTelemetryEvent {
  timestamp: string;
  type: 'upvote' | 'downvote' | 'completed_reading' | 'note_created' | 'feedback_positive' | 'feedback_negative' | 'feedback_already_known' | 'feedback_more_depth' | 'raindrop_sync';
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

export class RecursiveLearningEngine {
  private static STORAGE_KEY = '@atem:recursive_learning_state';
  private static DAMPENING_FACTOR = 0.85; // Bounded dampening to prevent abrupt swings
  private static MIN_WEIGHT = 0.10;
  private static MAX_WEIGHT = 0.98;

  /**
   * Retrieves the current telemetry and learning state.
   */
  public static async getEngineState(): Promise<LearningEngineState> {
    try {
      const raw = await appStorage.getItem(this.STORAGE_KEY);
      if (!raw) {
        return {
          events: [],
          domainTrustScores: {
            'plato.stanford.edu': 1.35,
            'quantamagazine.org': 1.30,
            'tagesschau.de': 1.20,
            'spektrum.de': 1.25,
            'aeon.co': 1.25,
            'cdm.link': 1.15
          },
          processedInteractions: {},
          appliedInteractions: {},
          totalLearningCycles: 0,
          lastTunedAt: new Date().toISOString()
        };
      }
      const parsed = JSON.parse(raw);
      if (!parsed.processedInteractions) {
        parsed.processedInteractions = {};
      }
      if (!parsed.appliedInteractions) {
        parsed.appliedInteractions = {};
        for (const [itemId, evt] of Object.entries(parsed.processedInteractions)) {
          if (typeof evt === 'string') {
            parsed.appliedInteractions[`${itemId}:${evt}`] = true;
          }
        }
      }
      return parsed;
    } catch {
      return {
        events: [],
        domainTrustScores: {},
        processedInteractions: {},
        appliedInteractions: {},
        totalLearningCycles: 0,
        lastTunedAt: new Date().toISOString()
      };
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
    eventType: 'upvote' | 'downvote' | 'completed_reading' | 'note_created' | 'feedback_positive' | 'feedback_negative' | 'feedback_already_known' | 'feedback_more_depth'
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
        delta = 0.06;
        reason = `Positives Votum für „${item.title.slice(0, 30)}…“`;
        break;
      case 'downvote':
        delta = -0.10;
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

    // Update domain trust
    const domain = item.sourceReferences?.[0]?.publisher || '';
    if (domain) {
      const currentTrust = state.domainTrustScores[domain] || 1.0;
      const trustDelta = delta > 0 ? 0.04 : -0.05;
      state.domainTrustScores[domain] = Math.max(0.5, Math.min(2.0, currentTrust + trustDelta));
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

    await appStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));

    // Update derivedWeights while keeping explicitInterests untouched
    const updatedProfile: UserProfile = {
      ...profile,
      derivedWeights: {
        ...(profile.derivedWeights || {}),
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
