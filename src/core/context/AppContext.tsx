import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useColorScheme, Platform, AppState, AppStateStatus } from 'react-native';
import {
  UserProfile,
  ReadingInteraction,
  TopicTag,
  ReadingPreferenceDuration,
  FeedItem,
  DayEditionType,
  EditionPreferences,
  TOPIC_SPACE_MAP,
  applyOptimisticReadingPreference
} from '../domain/types';
import {
  Subchannel,
  SubchannelFeedPriority,
  defaultSpaceRepository,
  normalizeSpaceHandle
} from '../spaces/spaceRepository';
import {
  ScoredFeedItem,
  determineCurrentEditionType,
  extractConceptKeywords,
  applyVoteFeedbackToProfile
} from '../domain/ranking';
import { feedRepository, isStaticFallbackItem } from '../data/feedRepository';
import { libraryRepository } from '../data/libraryRepository';
import { userProfileRepository } from '../data/userProfileRepository';
import { DEFAULT_USER_PROFILE, DEFAULT_STARTER_INTERESTS } from '../data/fixtures';
import { appStorage, CorruptedDataError, StorageUnavailableError } from '../data/storage';
import { RecursiveLearningEngine, applyGentleFeedbackDecay, LearningTelemetryEvent } from '../recommendations/recursiveLearningEngine';
import { WeatherService, WeatherData } from '../weather/weatherService';
import { DailyGenerationService } from '../daily/dailyGenerationService';
import { ContinuousLiveNewsService } from '../data/continuousLiveNewsService';
import { ThemeColors, ThemePalette, getThemeColors } from '../../ui/theme';
import { OpenWebHarvester } from '../ingestion/openWebHarvester';
import { appearanceHistoryService, AppearanceRecord } from '../data/appearanceHistoryService';
import { BackupService } from '../data/backupService';
import { RaindropService } from '../raindrop/raindropService';
import { FeatureModuleId } from '../modules/featureRegistry';
import { refreshLocalEdition } from './localFeedRefresh';
import { cloudSyncService, CloudSyncConfig } from '../sync/cloudSyncService';
import { defaultGraphRepository } from '../graph/graphRepository';
import { BoundedIdSet } from '../feed/boundedIdSet';
import { defaultFeedOperationManager } from '../feed/FeedOperationManager';
import { runInPlaceDataMigration } from '../data/migrationService';
import {
  satisfiesDefaultCuratedStandard,
  sanitizeCuratedFeedItem,
  runBackgroundEditorialNewsroomBatch
} from '../enrichment/batchEnricher';
import { hasAiConfiguration, loadAiCredentials } from '../ai/atmenAiClient';
import { harvestRabbitHoleForItem } from '../synthesis/rabbitHoleService';
import { seenImpressionsService } from '../data/seenImpressionsService';
import { hivemindLearningService } from '../learning/hivemindLearningService';
import { BackgroundCoordinator, countFreshUnseenItems } from './backgroundCoordinator';
import { useReadingProgressController } from './useReadingProgressController';
import { useCloudSyncController, MergedCloudSnapshotUpdate } from './useCloudSyncController';
import { ExternalBrowserPreference, setCachedExternalBrowserPref } from '../utils/externalBrowser';

export { applyOptimisticReadingPreference };

export function extractSalientKeywords(titleOrItem: string | Pick<FeedItem, 'title' | 'subtitle' | 'keyInsight' | 'feedText'>): string[] {
  return extractConceptKeywords(titleOrItem);
}

/**
 * Pure helper for 1-Tap "🚫 Weniger davon" (`dismissItem`).
 * Penalizes the item's source domain and salient sub-keywords in `feedbackMemory`.
 */
export function applyDismissFeedbackToProfile(
  profile: UserProfile,
  item: FeedItem
): { updatedProfile: UserProfile; domain: string; keywords: string[] } {
  const primaryTopic = item.primaryTopic || 'philosophy_ethics';
  const author = (item.sourceReferences?.[0]?.author || item.sourceReferences?.[0]?.publisher || '').trim();
  const domain = (item.sourceDomain || item.sourceReferences?.[0]?.publisher || '').toLowerCase().trim();
  const space = item.space ? item.space.toLowerCase() : '';
  const keywords = extractSalientKeywords(item);

  const mem = { ...profile.feedbackMemory };
  mem.penalizedTopics = { ...mem.penalizedTopics, [primaryTopic]: (mem.penalizedTopics[primaryTopic] || 0) + 2 };
  if (author) {
    mem.penalizedAuthors = { ...mem.penalizedAuthors, [author]: (mem.penalizedAuthors[author] || 0) + 2 };
  }
  if (domain) {
    mem.penalizedDomains = { ...mem.penalizedDomains, [domain]: (mem.penalizedDomains[domain] || 0) + 3 };
  }
  if (space) {
    mem.penalizedSpaces = { ...mem.penalizedSpaces, [space]: (mem.penalizedSpaces[space] || 0) + 2 };
  }
  if (keywords.length > 0) {
    const kwMap = { ...mem.penalizedKeywords };
    keywords.forEach(kw => {
      kwMap[kw] = (kwMap[kw] || 0) + 3;
    });
    mem.penalizedKeywords = kwMap;
  }

  const nextDerivedWeights = {
    ...(profile.explicitInterests || {}),
    ...(profile.derivedWeights || {})
  } as Record<TopicTag, number>;
  const currentTopicWeight = nextDerivedWeights[primaryTopic] ?? 0.5;
  nextDerivedWeights[primaryTopic] = Math.max(0.10, Math.round((currentTopicWeight - 0.05) * 1000) / 1000);

  return {
    updatedProfile: {
      ...profile,
      derivedWeights: nextDerivedWeights,
      feedbackMemory: mem
    },
    domain,
    keywords
  };
}

export function revertDismissFeedbackFromProfile(profile: UserProfile, item: FeedItem): UserProfile {
  const primaryTopic = item.primaryTopic || 'philosophy_ethics';
  const author = (item.sourceReferences?.[0]?.author || item.sourceReferences?.[0]?.publisher || '').trim();
  const domain = (item.sourceDomain || item.sourceReferences?.[0]?.publisher || '').toLowerCase().trim();
  const space = item.space ? item.space.toLowerCase() : '';
  const keywords = extractSalientKeywords(item);

  const mem = { ...profile.feedbackMemory };
  const dec = (rec: Record<string, number>, k: string, delta: number) => {
    const next = { ...rec };
    const val = (next[k] || 0) - delta;
    if (val <= 0) delete next[k];
    else next[k] = val;
    return next;
  };
  mem.penalizedTopics = dec(mem.penalizedTopics, primaryTopic, 2);
  if (author) mem.penalizedAuthors = dec(mem.penalizedAuthors, author, 2);
  if (domain) mem.penalizedDomains = dec(mem.penalizedDomains, domain, 3);
  if (space) mem.penalizedSpaces = dec(mem.penalizedSpaces, space, 2);
  if (keywords.length > 0) {
    let kwMap = { ...mem.penalizedKeywords };
    keywords.forEach(kw => {
      kwMap = dec(kwMap, kw, 3);
    });
    mem.penalizedKeywords = kwMap;
  }

  const nextDerivedWeights = {
    ...(profile.explicitInterests || {}),
    ...(profile.derivedWeights || {})
  } as Record<TopicTag, number>;
  const currentTopicWeight = nextDerivedWeights[primaryTopic] ?? 0.5;
  nextDerivedWeights[primaryTopic] = Math.min(0.98, Math.round((currentTopicWeight + 0.05) * 1000) / 1000);

  return {
    ...profile,
    derivedWeights: nextDerivedWeights,
    feedbackMemory: mem
  };
}

export function buildItemSnapshot(item: FeedItem): NonNullable<ReadingInteraction['itemSnapshot']> {
  return {
    title: item.title,
    subtitle: item.subtitle || undefined,
    publisher: item.sourceReferences?.[0]?.publisher || item.sourceBroadcasterName || undefined,
    sourceDomain: item.sourceDomain || undefined,
    space: item.space || undefined,
    primaryTopic: item.primaryTopic,
    canonicalUrl: item.canonicalUrl || item.sourceReferences?.[0]?.originalUrl || undefined,
    estimatedReadingMinutes: item.estimatedReadingMinutes
  };
}

/**
 * Pure, synchronous 0ms state updater for optimistic voting.
 * Updates interaction state immediately and adjusts upvotesCount in-place without reordering items.
 */
export function computeOptimisticVoteState<T extends FeedItem>(
  prevInteractions: Record<string, ReadingInteraction>,
  items: T[],
  itemId: string,
  direction: 'up' | 'down' | 'clear',
  itemSnapshot?: ReadingInteraction['itemSnapshot']
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
    userNotes: [],
    voteScore: 0
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
    feedback: nextFeedback,
    upvotedAt: direction === 'up' ? (prevInt.upvotedAt ?? new Date().toISOString()) : undefined,
    itemSnapshot: itemSnapshot ?? prevInt.itemSnapshot
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

export { harvestRabbitHoleForItem } from '../synthesis/rabbitHoleService';

export type StartupState =
  | { status: 'loading' }
  | { status: 'ready' }
  | { status: 'error'; message: string; isCorrupt?: boolean; canReset?: boolean };

export type FeedOption = 'infinite' | 'daily' | 'live_news' | 'classics' | 'history';

export interface OnboardingExtraOptions {
  teachingTargetRatio?: number;
  languageMix?: 'bilingual' | 'de_focus' | 'en_focus';
  theme?: 'system' | 'light' | 'dark';
  palette?: ThemePalette;
  weatherCity?: string;
  raindropToken?: string;
}

interface AppContextValue {
  isHydrated: boolean;
  profile: UserProfile;
  interactions: Record<string, ReadingInteraction>;
  dailyEdition: ScoredFeedItem[];
  discoveryItems: ScoredFeedItem[];
  savedArticles: FeedItem[];
  startupState: StartupState;
  errorMessage: string | null;
  clearError: () => void;
  colors: ThemeColors;
  isDark: boolean;
  palette: ThemePalette;
  activeTab: 'feed' | 'library' | 'settings' | 'network';
  setActiveTab: (tab: 'feed' | 'library' | 'settings' | 'network') => void;
  activeFeedOption: FeedOption;
  setActiveFeedOption: (option: FeedOption) => void;
  openWebItems: FeedItem[];
  historyItems: { item: FeedItem; record: AppearanceRecord }[];
  historySortOrder: 'recent' | 'chronological';
  setHistorySortOrder: (order: 'recent' | 'chronological') => void;
  refreshHistory: (customOrder?: 'recent' | 'chronological') => Promise<void>;
  clearAppearanceHistory: () => Promise<void>;
  recordCardAppearances: (itemIds: string[]) => Promise<void>;
  selectedEditionType: DayEditionType;
  currentEditionType: DayEditionType;
  setSelectedEditionType: (edition: DayEditionType) => void;
  weatherData: WeatherData | null;
  selectedFilter: string | 'all';
  setSelectedFilter: (filter: string | 'all') => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedArticleId: string | null;
  selectedArticle: FeedItem | null;
  openArticle: (id: string, fallbackItem?: FeedItem) => Promise<void>;
  closeArticle: () => void;
  goHome: () => void;
  feedScrollToTopSignal: number;
  requestFeedScrollToTop: () => void;
  wakeRefreshSignal: number;
  lastWakeWasNewDay: boolean;
  whyModalItem: ScoredFeedItem | null;
  openWhyModal: (item: ScoredFeedItem) => void;
  closeWhyModal: () => void;
  isInvestigationOpen: boolean;
  investigationTargetArticle: FeedItem | null;
  investigationInitialQuestion: string | null;
  openInvestigation: (article?: FeedItem | null, question?: string | null) => void;
  closeInvestigation: () => void;
  toggleSaveItem: (id: string) => Promise<void>;
  updateReadingProgress: (id: string, percent: number) => Promise<void>;
  flushReadingProgress: () => Promise<void>;
  setFeedback: (
    id: string,
    feedback: 'more_like_this' | 'less_like_this' | 'neutral' | 'already_known' | 'more_depth',
    timeWorthFeedback?: 'very_worthwhile' | 'worthwhile' | 'neutral' | 'not_worthwhile'
  ) => Promise<void>;
  addNote: (id: string, text: string, tag?: 'einwand' | 'unterricht' | 'these' | 'notiz') => Promise<void>;
  voteItem: (id: string, direction: 'up' | 'down' | 'clear') => Promise<void>;
  updateTopicWeight: (topic: TopicTag, weight: number) => Promise<void>;
  updateDurationPreference: (pref: ReadingPreferenceDuration) => Promise<void>;
  setFontSize: (size: 'sm' | 'md' | 'lg' | 'xl') => Promise<void>;
  setThemePreference: (theme: 'system' | 'light' | 'dark') => Promise<void>;
  setPalettePreference: (palette: ThemePalette) => Promise<void>;
  setExternalBrowserPreference: (pref: ExternalBrowserPreference) => Promise<void>;
  toggleFeatureModule: (moduleId: FeatureModuleId) => Promise<void>;
  completeOnboarding: (
    interests: Record<TopicTag, number>,
    duration: ReadingPreferenceDuration,
    extra?: OnboardingExtraOptions
  ) => Promise<void>;
  repeatOnboarding: () => Promise<void>;
  clearAllLocalData: () => Promise<void>;
  refreshFeed: () => Promise<void>;
  recomputeFeed: () => Promise<void>;
  shuffleSeed: number;
  shuffleFeed: (currentlyRenderedIds?: string[]) => Promise<{ freshCount: number; pinnedCount: number; isPoolExhausted: boolean }>;
  updateEditionPreferences: (prefs: Partial<EditionPreferences>) => Promise<void>;
  simulateDailyGeneration: (daysOffset?: number, customDate?: string) => Promise<{ simulatedDate: string; itemCount: number }>;
  activeDateSeed: string;
  retryStartup: () => Promise<void>;
  resetCorruptedData: () => Promise<void>;
  reloadFromStorage: () => Promise<void>;
  remoteSnapshotUrl: string;
  setRemoteSnapshotUrl: (url: string) => Promise<void>;
  refreshLiveFeed: () => Promise<{ success: boolean; itemCount: number; dateText: string }>;
  snapshotSyncInfo: string | null;
  spaces: Subchannel[];
  createSpace: (data: Parameters<typeof defaultSpaceRepository.createSubchannel>[0]) => Promise<Subchannel>;
  updateSpace: (oldHandle: string, data: Parameters<typeof defaultSpaceRepository.updateSubchannel>[1]) => Promise<Subchannel | null>;
  deleteSpace: (id: string) => Promise<boolean>;
  togglePinSpace: (id: string) => Promise<Subchannel[]>;
  setSpaceFeedPriority: (id: string, priority: SubchannelFeedPriority) => Promise<void>;
  selectSpace: (handleOrTag: string) => void;
  removeFeedbackBoost: (category: 'topic' | 'author' | 'keyword' | 'domain' | 'space', key: string) => Promise<void>;
  removeFeedbackPenalty: (category: 'topic' | 'author' | 'keyword' | 'domain' | 'space', key: string) => Promise<void>;
  updateFeedMixRatio: (focusRatio: number, socraticRatio: number, serendipityRatio: number) => Promise<void>;
  clearFeedbackMemory: () => Promise<void>;
  dismissedItemIds: string[];
  dismissItem: (id: string, itemOverride?: FeedItem) => Promise<{ item: FeedItem | null; domain: string; keywords: string[] }>;
  undoDismissItem: (id: string, itemOverride?: FeedItem) => Promise<void>;
  cloudSyncConfig: CloudSyncConfig;
  isSyncing: boolean;
  syncStatusMessage: string | null;
  triggerCloudSync: (forcePush?: boolean) => Promise<boolean>;
  updateCloudSyncConfig: (patch: Partial<CloudSyncConfig>) => Promise<void>;
  activateCloudSync: (token: string, passphrase?: string) => Promise<{ success: boolean; error?: string; gistId?: string }>;
  applyPairingCode: (code: string) => Promise<boolean>;
  getPairingBundle: () => Promise<{ pairingCode: string; pairingUrl: string; qrDataUrl: string }>;
  scheduleCloudSyncPush: () => void;
}

const DISMISSED_ITEMS_STORAGE_KEY = '@atem:dismissed_items:v1';

export interface AppActionsContextValue {
  openArticle: (id: string, fallbackItem?: FeedItem) => Promise<void>;
  toggleSaveItem: (id: string) => Promise<void>;
  voteItem: (id: string, direction: 'up' | 'down' | 'clear') => Promise<void>;
  dismissItem: (id: string, itemOverride?: FeedItem) => Promise<{ item: FeedItem | null; domain: string; keywords: string[] }>;
  scheduleCloudSyncPush: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);
const AppActionsContext = createContext<AppActionsContextValue | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemScheme = useColorScheme();
  const [isHydrated, setIsHydrated] = useState<boolean>(false);
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_USER_PROFILE);
  const [interactions, setInteractions] = useState<Record<string, ReadingInteraction>>({});
  const [dailyEdition, setDailyEdition] = useState<ScoredFeedItem[]>([]);
  const [discoveryItems, setDiscoveryItems] = useState<ScoredFeedItem[]>([]);
  const [savedArticles, setSavedArticles] = useState<FeedItem[]>([]);
  const [startupState, setStartupState] = useState<StartupState>({ status: 'loading' });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'feed' | 'library' | 'settings' | 'network'>('feed');
  const [activeFeedOption, setActiveFeedOption] = useState<FeedOption>('infinite');
  const [openWebItems] = useState<FeedItem[]>([]);
  const [historyItems, setHistoryItems] = useState<{ item: FeedItem; record: AppearanceRecord }[]>([]);
  const [historySortOrder, setHistorySortOrder] = useState<'recent' | 'chronological'>('recent');
  const [selectedFilter, setSelectedFilter] = useState<string | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [feedScrollToTopSignal, setFeedScrollToTopSignal] = useState<number>(0);
  const requestFeedScrollToTop = useCallback(() => {
    setFeedScrollToTopSignal(s => s + 1);
  }, []);
  const [wakeRefreshSignal, setWakeRefreshSignal] = useState<number>(0);
  const [lastWakeWasNewDay, setLastWakeWasNewDay] = useState<boolean>(false);
  const lastForegroundRefreshAtRef = useRef<number>(Date.now());
  const lastActiveCalendarDayRef = useRef<string>(new Date().toISOString().slice(0, 10));
  const wakeRefreshInFlightRef = useRef<boolean>(false);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<FeedItem | null>(null);
  const [whyModalItem, setWhyModalItem] = useState<ScoredFeedItem | null>(null);
  const [isInvestigationOpen, setIsInvestigationOpen] = useState<boolean>(false);
  const [investigationTargetArticle, setInvestigationTargetArticle] = useState<FeedItem | null>(null);
  const [investigationInitialQuestion, setInvestigationInitialQuestion] = useState<string | null>(null);
  const [selectedEditionType, setSelectedEditionTypeState] = useState<DayEditionType>(() => {
    return determineCurrentEditionType(new Date(), DEFAULT_USER_PROFILE);
  });
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [activeDateSeed, setActiveDateSeed] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [shuffleSeed, setShuffleSeed] = useState<number>(0);
  const [remoteSnapshotUrl, setRemoteSnapshotUrlState] = useState<string>('');
  const [snapshotSyncInfo, setSnapshotSyncInfo] = useState<string | null>(null);
  const [spaces, setSpaces] = useState<Subchannel[]>([]);
  const [dismissedItemIds, setDismissedItemIds] = useState<string[]>([]);

  const selectedEditionTypeRef = useRef<DayEditionType>(selectedEditionType);
  selectedEditionTypeRef.current = selectedEditionType;
  const activeDateSeedRef = useRef<string>(activeDateSeed);
  activeDateSeedRef.current = activeDateSeed;
  const shuffleSeedRef = useRef<number>(0);
  shuffleSeedRef.current = shuffleSeed;
  const remoteSnapshotUrlRef = useRef<string>(remoteSnapshotUrl);
  remoteSnapshotUrlRef.current = remoteSnapshotUrl;
  const sessionServedIdsRef = useRef<BoundedIdSet>(new BoundedIdSet(200));

  // References to track latest committed state and prevent stale closures
  const latestProfileRef = useRef<UserProfile>(profile);
  const latestInteractionsRef = useRef<Record<string, ReadingInteraction>>(interactions);
  const latestDailyEditionRef = useRef<ScoredFeedItem[]>(dailyEdition);
  const latestDiscoveryItemsRef = useRef<ScoredFeedItem[]>(discoveryItems);
  const latestSavedArticlesRef = useRef<FeedItem[]>(savedArticles);
  const latestOpenWebItemsRef = useRef<FeedItem[]>(openWebItems);
  const latestSelectedArticleRef = useRef<FeedItem | null>(selectedArticle);
  latestProfileRef.current = profile;
  latestInteractionsRef.current = interactions;
  latestDailyEditionRef.current = dailyEdition;
  latestDiscoveryItemsRef.current = discoveryItems;
  latestSavedArticlesRef.current = savedArticles;
  latestOpenWebItemsRef.current = openWebItems;
  latestSelectedArticleRef.current = selectedArticle;

  const feedRecomputeVersion = useRef<number>(0);
  const storageGenerationRef = useRef<number>(0);
  const backgroundCoordinatorRef = useRef<BackgroundCoordinator | null>(null);

  const resolveFeedItemById = useCallback(async (id: string): Promise<FeedItem | null> => {
    const fromRefs =
      latestDailyEditionRef.current.find(i => i.id === id) ??
      latestDiscoveryItemsRef.current.find(i => i.id === id) ??
      latestOpenWebItemsRef.current.find(i => i.id === id) ??
      (latestSelectedArticleRef.current?.id === id ? latestSelectedArticleRef.current : null) ??
      latestSavedArticlesRef.current.find(i => i.id === id) ??
      null;
    if (fromRefs) return fromRefs;
    const fromFeed = await feedRepository.getItemById(id);
    if (fromFeed) return fromFeed;
    return libraryRepository.getSavedArticle(id);
  }, []);

  const handleArticleCompleted = useCallback((id: string) => {
    void (async () => {
      try {
        const item = await resolveFeedItemById(id);
        let learnedRes: { updatedProfile: UserProfile; event: LearningTelemetryEvent | null } | null = null;
        if (item) {
          learnedRes = await RecursiveLearningEngine.recordInteractionEvent(
            latestProfileRef.current,
            item,
            'completed_reading'
          );
        }
        const committed = await userProfileRepository.updateProfile(curr => {
          const existingCompleted = curr.behavioralSignals?.completedReadIds || [];
          const nextCompleted = [id, ...existingCompleted.filter(x => x !== id)].slice(0, 200);
          const baseProfile = learnedRes?.event
            ? {
                ...curr,
                derivedWeights: {
                  ...(curr.derivedWeights || {}),
                  ...(learnedRes.updatedProfile.derivedWeights || {})
                },
                feedbackMemory: learnedRes.updatedProfile.feedbackMemory
              }
            : curr;
          return {
            ...baseProfile,
            behavioralSignals: {
              recentOpenedIds: baseProfile.behavioralSignals?.recentOpenedIds || [],
              recentSavedIds: baseProfile.behavioralSignals?.recentSavedIds || [],
              completedReadIds: nextCompleted
            }
          };
        });
        latestProfileRef.current = committed;
        setProfile(committed);
      } catch {
        // Non-fatal background completion learning
      }
    })();
  }, [resolveFeedItemById]);

  // Extracted controller: debounced reading progress persistence
  const {
    updateReadingProgress,
    flushReadingProgress,
    cancelPendingReadingProgress
  } = useReadingProgressController({
    latestInteractionsRef,
    setInteractions,
    storageGenerationRef,
    onArticleCompleted: handleArticleCompleted
  });

  // Extracted controller: Cloud Sync, pairing & debounced push
  const handleMergedCloudSnapshot = useCallback((snapshot: MergedCloudSnapshotUpdate) => {
    if (snapshot.profile) {
      latestProfileRef.current = snapshot.profile;
      setProfile(snapshot.profile);
      setCachedExternalBrowserPref(snapshot.profile.readingPreferences?.externalBrowser ?? 'safari');
    }
    if (snapshot.interactions) {
      latestInteractionsRef.current = snapshot.interactions;
      setInteractions(snapshot.interactions);
    }
    if (snapshot.savedArticles) {
      setSavedArticles(snapshot.savedArticles);
    }
    if (snapshot.dismissedItemIds) {
      setDismissedItemIds(snapshot.dismissedItemIds);
    }
    if (snapshot.spaces) {
      setSpaces(snapshot.spaces);
    }
  }, []);

  const {
    cloudSyncConfig,
    isSyncing,
    syncStatusMessage,
    triggerCloudSync,
    updateCloudSyncConfig,
    activateCloudSync,
    applyPairingCode,
    getPairingBundle,
    scheduleCloudSyncPush
  } = useCloudSyncController({
    onMergedSnapshot: handleMergedCloudSnapshot,
    onError: setErrorMessage
  });

  const scheduleCloudSyncPushRef = useRef(scheduleCloudSyncPush);
  const triggerCloudSyncRef = useRef(triggerCloudSync);
  scheduleCloudSyncPushRef.current = scheduleCloudSyncPush;
  triggerCloudSyncRef.current = triggerCloudSync;

  // Atomic Hydration: hard safety unlock if storage/cold-boot snapshot fetch is sluggish (warm boot unlocks <50ms)
  useEffect(() => {
    const fallbackTimer = setTimeout(() => {
      setIsHydrated(true);
    }, 1800);
    return () => clearTimeout(fallbackTimer);
  }, []);

  useEffect(() => {
    return () => {
      backgroundCoordinatorRef.current?.stop();
      backgroundCoordinatorRef.current = null;
    };
  }, []);

  useEffect(() => {
    void appStorage.getItem(DISMISSED_ITEMS_STORAGE_KEY).then(raw => {
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) setDismissedItemIds(parsed);
        } catch {}
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    void defaultSpaceRepository.getAllSpaces().then(setSpaces);
    return defaultSpaceRepository.subscribe(setSpaces);
  }, []);

  const selectSpace = useCallback((handleOrTag: string) => {
    const normalized = handleOrTag === 'all'
      ? 'all'
      : (handleOrTag.startsWith('c/')
        ? handleOrTag
        : (handleOrTag in TOPIC_SPACE_MAP ? handleOrTag : normalizeSpaceHandle(handleOrTag)));
    setSelectedFilter(normalized);
    setActiveTab('feed');
    if (activeFeedOption === 'history') {
      setActiveFeedOption('infinite');
    }
  }, [activeFeedOption]);

  const createSpace = useCallback(async (data: Parameters<typeof defaultSpaceRepository.createSubchannel>[0]) => {
    const newChan = await defaultSpaceRepository.createSubchannel(data);
    selectSpace(newChan.handle);
    scheduleCloudSyncPushRef.current();
    return newChan;
  }, [selectSpace]);

  const updateSpace = useCallback(async (oldHandle: string, data: Parameters<typeof defaultSpaceRepository.updateSubchannel>[1]) => {
    const updated = await defaultSpaceRepository.updateSubchannel(oldHandle, data);
    if (updated && selectedFilter.toLowerCase() === normalizeSpaceHandle(oldHandle).toLowerCase()) {
      selectSpace(updated.handle);
    }
    scheduleCloudSyncPushRef.current();
    return updated;
  }, [selectSpace, selectedFilter]);

  const deleteSpace = useCallback(async (id: string) => {
    const allSpaces = await defaultSpaceRepository.getAllSpaces();
    const target = allSpaces.find(s => s.id === id || s.handle.toLowerCase() === id.toLowerCase());
    const targetHandle = target?.handle || id;
    const ok = await defaultSpaceRepository.deleteSubchannel(id);
    if (ok) {
      if (selectedFilter.toLowerCase() === normalizeSpaceHandle(targetHandle).toLowerCase()) {
        setSelectedFilter('all');
      }
      scheduleCloudSyncPushRef.current();
    }
    return ok;
  }, [selectedFilter]);

  const togglePinSpace = useCallback(async (id: string) => {
    const updated = await defaultSpaceRepository.togglePin(id);
    scheduleCloudSyncPushRef.current();
    return updated;
  }, []);

  const setSpaceFeedPriority = useCallback(async (id: string, priority: SubchannelFeedPriority) => {
    const updated = await defaultSpaceRepository.setFeedPriority(id, priority);
    setSpaces(updated);
    scheduleCloudSyncPushRef.current();
  }, []);

  const currentEditionType = useMemo(() => {
    return determineCurrentEditionType(new Date(), profile);
  }, [profile]);

  const isDark = useMemo(() => {
    const themePref = profile.readingPreferences.theme;
    if (themePref === 'dark') return true;
    if (themePref === 'light') return false;
    return systemScheme === 'dark';
  }, [profile.readingPreferences.theme, systemScheme]);

  const palette: ThemePalette = (profile.readingPreferences as any).palette || 'tidalglass';

  const colors = useMemo(() => {
    return getThemeColors(isDark ? 'dark' : 'light', palette);
  }, [isDark, palette]);

  // Keep external browser preference cache synchronized with active profile
  useEffect(() => {
    setCachedExternalBrowserPref(profile.readingPreferences?.externalBrowser ?? 'safari');
  }, [profile.readingPreferences?.externalBrowser]);

  // Sync web document background and iOS theme-color meta tag
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      try {
        document.body.style.backgroundColor = colors.background;
        const html = document.documentElement;
        if (html) html.style.backgroundColor = colors.background;
        const meta = document.getElementById('theme-color-meta') as HTMLMetaElement | null;
        if (meta) {
          meta.content = colors.background;
        }
      } catch {
        // Non-browser fallback
      }
    }
  }, [colors.background]);

  // Sequenced single-pass feed recomputation: newest committed call always wins
  const scheduleFeedRecompute = useCallback(async (
    prof: UserProfile,
    inter: Record<string, ReadingInteraction>,
    targetEdition?: DayEditionType,
    customDateSeed?: string,
    customShuffleOffset?: number,
    customPreviouslyShownIds?: Set<string>
  ) => {
    const currentVersion = ++feedRecomputeVersion.current;
    const isCurrent = () => currentVersion === feedRecomputeVersion.current;
    try {
      const edition = targetEdition ?? selectedEditionTypeRef.current;
      const seed = customDateSeed ?? activeDateSeedRef.current;
      const offset = customShuffleOffset ?? shuffleSeedRef.current;
      const prevIds = customPreviouslyShownIds ?? sessionServedIdsRef.current.toSet();

      const shouldLoadWeather = edition === 'morning' && prof.editionPreferences?.weatherEnabled !== false;
      const city = prof.editionPreferences?.weatherCity || 'dresden';

      const singlePassPromise = feedRepository.getEditionAndDiscovery
        ? feedRepository.getEditionAndDiscovery(edition, prof, inter, seed, offset, prevIds)
        : null;

      await refreshLocalEdition({
        loadDaily: () =>
          singlePassPromise
            ? singlePassPromise.then(res => res.daily)
            : feedRepository.getEditionFeed(edition, prof, inter, seed, offset, prevIds),
        loadDiscovery: () =>
          singlePassPromise
            ? singlePassPromise.then(res => res.discovery)
            : feedRepository.getDiscoveryItems(prof, inter, undefined, offset, prevIds),
        onFeed: ({ daily, discovery }) => {
          setDailyEdition(daily as ScoredFeedItem[]);
          setDiscoveryItems(discovery as ScoredFeedItem[]);
        },
        loadWeather: shouldLoadWeather ? () => WeatherService.getWeatherForCity(city) : undefined,
        onWeather: weather => {
          setWeatherData(weather as WeatherData | null);
        },
        isCurrent
      });
    } catch (err) {
      console.warn('Feed-Berechnung fehlgeschlagen:', err);
    }
  }, []);

  const recomputeFeed = useCallback(async () => {
    await scheduleFeedRecompute(latestProfileRef.current, latestInteractionsRef.current);
  }, [scheduleFeedRecompute]);

  const shuffleFeed = useCallback(async (currentlyRenderedIds?: string[]) => {
    const nextOffset = shuffleSeedRef.current + 1;
    setShuffleSeed(nextOffset);
    shuffleSeedRef.current = nextOffset;

    const previouslyServed = sessionServedIdsRef.current;
    if (currentlyRenderedIds && currentlyRenderedIds.length > 0) {
      previouslyServed.addMany(currentlyRenderedIds);
    } else {
      dailyEdition.forEach(i => previouslyServed.add(i.id));
      discoveryItems.slice(0, 24).forEach(i => previouslyServed.add(i.id));
      openWebItems.forEach(i => previouslyServed.add(i.id));
    }

    const prevSnapshotSet = previouslyServed.toSet();

    await scheduleFeedRecompute(
      latestProfileRef.current,
      latestInteractionsRef.current,
      selectedEditionTypeRef.current,
      `${activeDateSeedRef.current}-shuffle-${nextOffset}`,
      nextOffset,
      prevSnapshotSet
    );

    const allRepoItems = feedRepository.getAllItems ? feedRepository.getAllItems() : [];
    const totalPoolCount = allRepoItems.length + openWebItems.length;
    const isPoolExhausted = previouslyServed.size >= totalPoolCount && totalPoolCount > 0;

    const pinnedIds = defaultFeedOperationManager.getPinnedItemIds();
    const pinnedCount = pinnedIds.length;
    const estimatedFresh = Math.max(0, Math.min(24 - pinnedCount, totalPoolCount - previouslyServed.size));
    const freshCount = isPoolExhausted
      ? Math.max(1, totalPoolCount - pinnedCount)
      : (estimatedFresh > 0 ? estimatedFresh : 24 - pinnedCount);

    return { freshCount, pinnedCount, isPoolExhausted };
  }, [dailyEdition, discoveryItems, openWebItems, scheduleFeedRecompute]);

  const updateEditionPreferences = useCallback(async (prefs: Partial<EditionPreferences>) => {
    try {
      const committed = await userProfileRepository.updateProfile(curr => ({
        ...curr,
        editionPreferences: {
          ...curr.editionPreferences,
          ...prefs
        }
      }));
      latestProfileRef.current = committed;
      setProfile(committed);
      await scheduleFeedRecompute(committed, latestInteractionsRef.current);
    } catch {
      setErrorMessage('Ausgaben-Einstellungen konnten nicht gespeichert werden.');
    }
  }, [scheduleFeedRecompute]);

  const setSelectedEditionType = useCallback((edition: DayEditionType) => {
    setSelectedEditionTypeState(edition);
    selectedEditionTypeRef.current = edition;
    void scheduleFeedRecompute(latestProfileRef.current, latestInteractionsRef.current, edition);
  }, [scheduleFeedRecompute]);

  const refreshHistory = useCallback(async (customOrder?: 'recent' | 'chronological') => {
    try {
      const allPool = feedRepository.getAllItems ? feedRepository.getAllItems() : [];
      const combinedPool = [...allPool, ...openWebItems];
      const order = customOrder ?? historySortOrder;
      const history = await appearanceHistoryService.getHistoryOrderedItems(combinedPool, order);
      setHistoryItems(history);
    } catch (err) {
      console.warn('Fehler beim Laden der Chronik:', err);
    }
  }, [historySortOrder, openWebItems]);

  const recordCardAppearances = useCallback(async (itemIds: string[]) => {
    try {
      await appearanceHistoryService.recordAppearances(itemIds);
    } catch {
      // Ignored
    }
  }, []);

  const clearAppearanceHistory = useCallback(async () => {
    try {
      await appearanceHistoryService.clearHistory();
      setHistoryItems([]);
    } catch {
      setErrorMessage('Chronik konnte nicht gelöscht werden.');
    }
  }, []);

  useEffect(() => {
    if (activeFeedOption === 'history') {
      void refreshHistory();
    }
  }, [activeFeedOption, refreshHistory]);

  // Wake-on-Focus & New-Day Auto-Refresh
  const runForegroundWakeCheck = useCallback(async () => {
    try {
      const cfg = await cloudSyncService.getConfig();
      if (cfg.enabled && cfg.autoSync) {
        await triggerCloudSyncRef.current();
      }
    } catch {
      // Non-fatal
    }

    const nowMs = Date.now();
    const todayIso = new Date(nowMs).toISOString().slice(0, 10);
    const isNewDay = todayIso !== lastActiveCalendarDayRef.current;
    const isIdleOver25Min = nowMs - lastForegroundRefreshAtRef.current >= 25 * 60 * 1000;

    if (!isNewDay && !isIdleOver25Min) return;
    if (wakeRefreshInFlightRef.current) return;

    wakeRefreshInFlightRef.current = true;
    lastForegroundRefreshAtRef.current = nowMs;
    lastActiveCalendarDayRef.current = todayIso;

    try {
      if (isNewDay) {
        setActiveDateSeed(todayIso);
        activeDateSeedRef.current = todayIso;
        const nextEdition = determineCurrentEditionType(new Date(nowMs), latestProfileRef.current);
        setSelectedEditionTypeState(nextEdition);
        selectedEditionTypeRef.current = nextEdition;
      }

      const [snapRes, liveRes] = await Promise.allSettled([
        feedRepository.hydrateFromPublicSnapshot?.(remoteSnapshotUrlRef.current, { forceRefresh: true }),
        ContinuousLiveNewsService.refreshLiveFeeds(true)
      ]);

      if (snapRes.status === 'fulfilled' && snapRes.value?.success) {
        const syncText = `Stand ${snapRes.value.snapshotDate || new Date(nowMs).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })} • ${snapRes.value.itemCount} Impulse`;
        setSnapshotSyncInfo(syncText);
      }

      const seenIds = await seenImpressionsService.getSeenIds().catch(() => new Set<string>());
      if (liveRes.status === 'fulfilled' && Array.isArray(liveRes.value) && liveRes.value.length > 0) {
        const curatedLive = liveRes.value
          .map(sanitizeCuratedFeedItem)
          .filter(satisfiesDefaultCuratedStandard)
          .map(item => {
            if (item.isStaticFallback || seenIds.has(item.id)) {
              const { pinnedManualRunAt, ...rest } = item;
              return rest;
            }
            return item;
          });
        if (curatedLive.length > 0 && feedRepository.addItems) {
          feedRepository.addItems(curatedLive, { operationType: 'background_sync', pinInserted: false });
        }
      }

      // Only touch deep reservoir on wake if fresh unseen pool is running low
      const currentRepoItems = feedRepository.getAllItems ? feedRepository.getAllItems() : [];
      if (countFreshUnseenItems(currentRepoItems, seenIds) < 40) {
        await feedRepository.hydrateFromReservoir?.(remoteSnapshotUrlRef.current).catch(() => {});
      }

      await scheduleFeedRecompute(
        latestProfileRef.current,
        latestInteractionsRef.current,
        selectedEditionTypeRef.current,
        activeDateSeedRef.current
      );
      setLastWakeWasNewDay(isNewDay);
      setWakeRefreshSignal(s => s + 1);
    } catch {
      // Non-fatal wake refresh fallback
    } finally {
      wakeRefreshInFlightRef.current = false;
    }
  }, [scheduleFeedRecompute]);

  // Flush progress when app moves to background; pull sync & wake-refresh when returning to active
  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'background' || nextState === 'inactive') {
        void flushReadingProgress();
        void seenImpressionsService.flush();
      } else if (nextState === 'active') {
        void runForegroundWakeCheck();
      }
    };
    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => sub.remove();
  }, [flushReadingProgress, runForegroundWakeCheck]);

  // Web visibilitychange listener for instant multi-tab sync & overnight PWA wake refresh
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const handleVisChange = () => {
        if (document.visibilityState === 'visible') {
          void runForegroundWakeCheck();
        }
      };
      document.addEventListener('visibilitychange', handleVisChange);
      return () => document.removeEventListener('visibilitychange', handleVisChange);
    }
  }, [runForegroundWakeCheck]);

  // Load initial data on startup with explicit typed error recovery
  const loadInitialData = useCallback(async () => {
    setStartupState({ status: 'loading' });
    setErrorMessage(null);
    backgroundCoordinatorRef.current?.stop();

    try {
      let loadedProfile: UserProfile;
      try {
        loadedProfile = await userProfileRepository.getProfile();
      } catch (profileErr) {
        if (profileErr instanceof CorruptedDataError) {
          setStartupState({
            status: 'error',
            message: 'Beschädigte Profileinstellungen festgestellt. Deine bisherigen Daten konnten nicht gelesen werden.',
            isCorrupt: true,
            canReset: true
          });
          return;
        }
        if (profileErr instanceof StorageUnavailableError) {
          setStartupState({
            status: 'error',
            message: 'Lokaler Speicher ist derzeit nicht erreichbar. Bitte starte die App neu.',
            canReset: false
          });
          return;
        }
        throw profileErr;
      }

      let loadedInteractions: Record<string, ReadingInteraction> = {};
      try {
        loadedInteractions = await libraryRepository.getInteractions();
      } catch (libErr) {
        if (libErr instanceof CorruptedDataError) {
          setStartupState({
            status: 'error',
            message: 'Beschädigte Bibliotheksdaten festgestellt. Deine Lesezeichen konnten nicht geladen werden.',
            isCorrupt: true,
            canReset: true
          });
          return;
        }
        throw libErr;
      }

      // Prime RecursiveLearningEngine cache & apply gentle feedback decay if >24h elapsed
      await RecursiveLearningEngine.getEngineState().catch(() => null);
      const decayedProfile = applyGentleFeedbackDecay(loadedProfile);
      if (decayedProfile !== loadedProfile) {
        try {
          loadedProfile = await userProfileRepository.updateProfile(curr => applyGentleFeedbackDecay(curr));
        } catch {
          loadedProfile = decayedProfile;
        }
      }

      setProfile(loadedProfile);
      setInteractions(loadedInteractions);
      latestProfileRef.current = loadedProfile;
      latestInteractionsRef.current = loadedInteractions;
      setCachedExternalBrowserPref(loadedProfile.readingPreferences?.externalBrowser ?? 'safari');

      let loadedSavedArticles: FeedItem[] = [];
      try {
        loadedSavedArticles = await libraryRepository.getSavedArticles();
      } catch {
        loadedSavedArticles = [];
      }
      setSavedArticles(loadedSavedArticles);

      const initialEdition = determineCurrentEditionType(new Date(), loadedProfile);
      setSelectedEditionTypeState(initialEdition);
      selectedEditionTypeRef.current = initialEdition;
      let currentSnapshotUrl = '';
      try {
        const storedUrl = await appStorage.getItem('@atem:remote_snapshot_url:v1');
        if (storedUrl) {
          currentSnapshotUrl = storedUrl;
          setRemoteSnapshotUrlState(storedUrl);
        }
        const storedSync = await appStorage.getItem('@atem:snapshot_sync_info:v1');
        if (storedSync) {
          setSnapshotSyncInfo(storedSync);
        }
      } catch {
        // Non-fatal
      }

      // 1. Hydrate local stores, run in-place migration, and pull public snapshot BEFORE Frame 1 renders
      // so startupState stays on 'loading' until the initial feed is ready (zero boot-flicker).
      await Promise.allSettled([
        feedRepository.hydrateFromBootDeck?.(),
        feedRepository.ensureInitialized?.(),
        seenImpressionsService.getSeenIds(),
        hivemindLearningService.getTracks()
      ]);

      try {
        await runInPlaceDataMigration(appStorage, feedRepository);
      } catch (migErr) {
        console.warn('In-place auto-migration skipped:', migErr);
      }

      const preHydrateItems = feedRepository.getAllItems ? feedRepository.getAllItems() : [];
      const realCount = preHydrateItems.filter(item => !isStaticFallbackItem(item)).length;
      const snapshotBudgetMs = realCount < 15 ? 1500 : 900;

      try {
        const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
        await Promise.race([
          (async () => {
            const res = await feedRepository.hydrateFromPublicSnapshot?.(currentSnapshotUrl);
            if (res?.success) {
              const syncText = `Stand ${res.snapshotDate || new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })} • ${res.itemCount} Impulse`;
              setSnapshotSyncInfo(syncText);
              await appStorage.setItem('@atem:snapshot_sync_info:v1', syncText).catch(() => {});
            }
          })().catch(() => {}),
          sleep(snapshotBudgetMs)
        ]);
      } catch {
        // Non-blocking snapshot hydration fallback
      }

      await scheduleFeedRecompute(loadedProfile, loadedInteractions, initialEdition);
      setStartupState({ status: 'ready' });
      setIsHydrated(true);

      // 3. Single consolidated idle BackgroundCoordinator (>= 15s quiet settle; skips completely if >= 40 fresh unseen items exist)
      const coordinator = new BackgroundCoordinator({
        getRepoItems: () => (feedRepository.getAllItems ? feedRepository.getAllItems() : []),
        getSeenIds: () => seenImpressionsService.getSeenIds(),
        hydrateReservoir: () => feedRepository.hydrateFromReservoir?.(currentSnapshotUrl),
        runLiveReplenishment: async ({ existingIds, seenIds }) => {
          const liveItems = await ContinuousLiveNewsService.refreshLiveFeeds(true);
          const safeLive = liveItems
            .map(sanitizeCuratedFeedItem)
            .filter(satisfiesDefaultCuratedStandard)
            .map(item => {
              if (item.isStaticFallback || seenIds.has(item.id)) {
                const { pinnedManualRunAt, ...rest } = item;
                return rest;
              }
              return item;
            });

          let autoHarvested: FeedItem[] = [];
          try {
            const creds = await loadAiCredentials(appStorage).catch(() => undefined);
            const discovery = await OpenWebHarvester.harvestMultiLaneInternetDiscovery({
              existingIds,
              seenIds,
              targetNewCount: 8,
              credentials: creds
            });
            autoHarvested = discovery.items
              .map(sanitizeCuratedFeedItem)
              .filter(satisfiesDefaultCuratedStandard)
              .map(item => {
                const { pinnedManualRunAt, ...rest } = item;
                return rest;
              });
          } catch {
            // Non-fatal auto-discovery fallback
          }
          return [...safeLive, ...autoHarvested];
        },
        runAiNewsroom: async repoItems => {
          const creds = await loadAiCredentials();
          if (!hasAiConfiguration(creds)) return [];
          const batchRes = await runBackgroundEditorialNewsroomBatch(repoItems, {
            batchSize: 4,
            credentials: creds
          });
          return batchRes.enrichedItems;
        },
        runPeriodicLiveCheck: async () => {
          const liveItems = await ContinuousLiveNewsService.refreshLiveFeeds(false);
          return liveItems.map(sanitizeCuratedFeedItem).filter(satisfiesDefaultCuratedStandard);
        },
        onItemsAdded: async (items, shouldRecompute) => {
          if (items.length > 0 && feedRepository.addItems) {
            feedRepository.addItems(items);
          }
          if (shouldRecompute) {
            await scheduleFeedRecompute(latestProfileRef.current, latestInteractionsRef.current);
          }
        }
      });
      backgroundCoordinatorRef.current = coordinator;
      coordinator.start();

      // On Web: check initial URL query for ?article=<id>
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        try {
          const params = new URLSearchParams(window.location.search);
          const urlArticleId = params.get('article');
          if (urlArticleId) {
            let item = await feedRepository.getItemById(urlArticleId);
            if (!item) {
              item = await libraryRepository.getSavedArticle(urlArticleId);
            }
            setSelectedArticleId(urlArticleId);
            setSelectedArticle(item);
          }
        } catch {
          // Ignore URL query parsing errors on web
        }
      }
      void defaultSpaceRepository.notify();
    } catch (err: any) {
      setStartupState({
        status: 'error',
        message: err?.message || 'Die Tagesausgabe konnte nicht initialisiert werden. Bitte tippe auf Wiederholen.',
        canReset: true
      });
      setIsHydrated(true);
    }
  }, [scheduleFeedRecompute]);

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  // Quarantines corrupt bytes and resets to fresh defaults
  const resetCorruptedData = useCallback(async () => {
    try {
      storageGenerationRef.current++;
      backgroundCoordinatorRef.current?.stop();
      cancelPendingReadingProgress();
      setSavedArticles([]);
      await userProfileRepository.quarantineAndReset();
      await libraryRepository.quarantineAndReset();
      await loadInitialData();
    } catch {
      setErrorMessage('Zurücksetzen fehlgeschlagen. Bitte versuche es erneut.');
    }
  }, [cancelPendingReadingProgress, loadInitialData]);

  const setRemoteSnapshotUrl = useCallback(async (url: string) => {
    setRemoteSnapshotUrlState(url);
    await appStorage.setItem('@atem:remote_snapshot_url:v1', url);
  }, []);

  const harvestSnapshotAndLiveDiscovery = useCallback(async (prefixLabel: 'Ausgabe vom' | 'Stand') => {
    let snapshotCount = 0;
    const fallbackDate = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
    let dateText = `${prefixLabel} ${fallbackDate}`;
    const activeSnapshotUrl = remoteSnapshotUrlRef.current;

    const [snapRes, liveRes] = await Promise.allSettled([
      feedRepository.hydrateFromPublicSnapshot?.(activeSnapshotUrl, { forceRefresh: true }),
      ContinuousLiveNewsService.refreshLiveFeeds(true)
    ]);

    if (snapRes.status === 'fulfilled' && snapRes.value?.success) {
      snapshotCount = snapRes.value.itemCount;
      dateText = `${prefixLabel} ${snapRes.value.snapshotDate || fallbackDate} • ${snapRes.value.itemCount} Impulse`;
      setSnapshotSyncInfo(dateText);
      await appStorage.setItem('@atem:snapshot_sync_info:v1', dateText).catch(() => {});
    } else if (snapRes.status === 'rejected' && prefixLabel === 'Stand') {
      console.warn('Live Snapshot Sync failed:', snapRes.reason);
    }

    const seenIds = await seenImpressionsService.getSeenIds().catch(() => new Set<string>());
    if (liveRes.status === 'fulfilled' && Array.isArray(liveRes.value) && liveRes.value.length > 0) {
      const curatedLive = liveRes.value
        .map(sanitizeCuratedFeedItem)
        .filter(satisfiesDefaultCuratedStandard)
        .map(item => {
          if (item.isStaticFallback || seenIds.has(item.id)) {
            const { pinnedManualRunAt, ...rest } = item;
            return rest;
          }
          return item;
        });
      if (curatedLive.length > 0 && feedRepository.addItems) {
        feedRepository.addItems(curatedLive, { operationType: 'background_sync', pinInserted: false });
      }
    }

    try {
      const existingIds = new Set((feedRepository.getAllItems ? feedRepository.getAllItems() : []).map(i => i.id));
      const discoveryResult = await OpenWebHarvester.harvestMultiLaneInternetDiscovery({
        existingIds,
        seenIds,
        targetNewCount: 18
      });
      const sanitizedDiscovery = discoveryResult.items
        .map(sanitizeCuratedFeedItem)
        .filter(satisfiesDefaultCuratedStandard);
      if (sanitizedDiscovery.length > 0 && feedRepository.addItems) {
        feedRepository.addItems(sanitizedDiscovery);
      }
    } catch (err) {
      if (prefixLabel === 'Stand') {
        console.warn('Live multi-lane harvest fallback:', err);
      }
    }

    await scheduleFeedRecompute(latestProfileRef.current, latestInteractionsRef.current);
    return { success: true, itemCount: snapshotCount || 24, dateText };
  }, [scheduleFeedRecompute]);

  const refreshFeed = useCallback(async () => {
    try {
      await harvestSnapshotAndLiveDiscovery('Ausgabe vom');
    } catch (err) {
      console.warn('Feed-Aktualisierung fehlgeschlagen:', err);
    }
  }, [harvestSnapshotAndLiveDiscovery]);

  const refreshLiveFeed = useCallback(async () => {
    return harvestSnapshotAndLiveDiscovery('Stand');
  }, [harvestSnapshotAndLiveDiscovery]);

  const simulateDailyGeneration = useCallback(async (daysOffset: number = 0, customDate?: string) => {
    const res = await DailyGenerationService.simulateDailyGeneration({
      profile: latestProfileRef.current,
      daysOffset,
      targetDate: customDate,
      fetchLiveNews: true
    });
    setActiveDateSeed(res.simulatedDate);
    activeDateSeedRef.current = res.simulatedDate;
    await scheduleFeedRecompute(
      latestProfileRef.current,
      latestInteractionsRef.current,
      selectedEditionTypeRef.current,
      res.simulatedDate
    );
    return { simulatedDate: res.simulatedDate, itemCount: res.generatedItems.length };
  }, [scheduleFeedRecompute]);

  const openArticle = useCallback(async (id: string, fallbackItem?: FeedItem) => {
    void appearanceHistoryService.recordAppearances([id]);
    let item = await feedRepository.getItemById(id);
    const foundInFeedRepo = Boolean(item);
    if (!item) {
      item = await libraryRepository.getSavedArticle(id);
    }
    if (!item) {
      item = latestSavedArticlesRef.current.find(a => a.id === id) ?? null;
    }
    if (!item) {
      item = latestDailyEditionRef.current.find(i => i.id === id) ?? null;
    }
    if (!item) {
      item = latestDiscoveryItemsRef.current.find(i => i.id === id) ?? null;
    }
    if (!item) {
      item = latestOpenWebItemsRef.current.find(i => i.id === id) ?? null;
    }
    if (!item) {
      const liveCache = (ContinuousLiveNewsService as unknown as { liveIngestedItems?: readonly FeedItem[] }).liveIngestedItems;
      if (Array.isArray(liveCache)) {
        item = liveCache.find(i => i.id === id) ?? null;
      }
      if (!item) {
        item = ContinuousLiveNewsService.getEvergreenClassics().find(i => i.id === id) ?? null;
      }
    }
    if (!item) {
      try {
        const tracks = await hivemindLearningService.getTracks();
        for (const t of tracks) {
          const found = t.items.find(i => i.id === id);
          if (found) {
            item = found;
            break;
          }
        }
      } catch {
        // Non-fatal
      }
    }
    if (!item && fallbackItem) {
      item = fallbackItem;
    }
    if (item && !foundInFeedRepo) {
      try {
        feedRepository.addItems?.([item], { operationType: 'background_sync', pinInserted: false });
      } catch {
        // Non-fatal
      }
    }
    void hivemindLearningService.markItemCompletedByItemId(id).then(updatedTrack => {
      if (updatedTrack) {
        scheduleCloudSyncPushRef.current();
      }
    }).catch(() => {});
    setSelectedArticleId(id);
    setSelectedArticle(item);

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        if (window.location.search !== `?article=${id}`) {
          window.history.pushState({ articleId: id }, '', `?article=${id}`);
        }
      } catch {
        // Ignored
      }
    }
  }, []);

  const closeArticle = useCallback(() => {
    void flushReadingProgress();
    setSelectedArticleId(null);
    setSelectedArticle(null);

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        const historyState = window.history.state as { articleId?: string } | null;
        if (historyState?.articleId || window.location.search.includes('article=')) {
          window.history.replaceState({}, '', window.location.pathname);
        }
      } catch {
        // Ignored
      }
    }
  }, [flushReadingProgress]);

  const goHome = useCallback(() => {
    void flushReadingProgress();
    requestFeedScrollToTop();
    setSelectedArticleId(null);
    setSelectedArticle(null);
    setWhyModalItem(null);
    setActiveTab('feed');
    setActiveFeedOption('infinite');
    setSelectedFilter('all');
    setSearchQuery('');
    const autoEdition = determineCurrentEditionType(new Date(), latestProfileRef.current);
    const needsEditionSwitch = autoEdition !== selectedEditionTypeRef.current;
    const needsRecompute = needsEditionSwitch || latestDailyEditionRef.current.length === 0;
    if (needsEditionSwitch) {
      setSelectedEditionTypeState(autoEdition);
      selectedEditionTypeRef.current = autoEdition;
    }
    if (needsRecompute) {
      void scheduleFeedRecompute(latestProfileRef.current, latestInteractionsRef.current, autoEdition);
    }

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        if (window.location.search.includes('article=')) {
          window.history.pushState({}, '', window.location.pathname);
        }
      } catch {
        // Ignored
      }
    }
  }, [flushReadingProgress, scheduleFeedRecompute, requestFeedScrollToTop]);

  // Web Browser History Navigation (back / forward / direct URL)
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const onPopState = async (e: PopStateEvent) => {
        const params = new URLSearchParams(window.location.search);
        const articleIdFromUrl = params.get('article') || e.state?.articleId;

        if (articleIdFromUrl) {
          let item = await feedRepository.getItemById(articleIdFromUrl);
          if (!item) {
            item = await libraryRepository.getSavedArticle(articleIdFromUrl);
          }
          setSelectedArticleId(articleIdFromUrl);
          setSelectedArticle(item);
        } else {
          void flushReadingProgress();
          setSelectedArticleId(null);
          setSelectedArticle(null);
        }
      };

      window.addEventListener('popstate', onPopState);
      return () => window.removeEventListener('popstate', onPopState);
    }
  }, [flushReadingProgress]);

  const openWhyModal = useCallback((item: ScoredFeedItem) => {
    setWhyModalItem(item);
  }, []);

  const closeWhyModal = useCallback(() => {
    setWhyModalItem(null);
  }, []);

  const openInvestigation = useCallback((article?: FeedItem | null, question?: string | null) => {
    setInvestigationTargetArticle(article || null);
    setInvestigationInitialQuestion(question || null);
    setIsInvestigationOpen(true);
  }, []);

  const closeInvestigation = useCallback(() => {
    setIsInvestigationOpen(false);
    setInvestigationTargetArticle(null);
    setInvestigationInitialQuestion(null);
  }, []);

  const toggleSaveItem = useCallback(async (id: string) => {
    const prevInt = latestInteractionsRef.current[id] ?? {
      itemId: id,
      saved: false,
      progressPercent: 0,
      furthestPositionPercent: 0
    };
    const isCurrentlySaved = Boolean(prevInt.saved);

    // 1. Instant 0ms optimistic state update BEFORE any async storage I/O
    const optimisticInt: ReadingInteraction = {
      ...prevInt,
      saved: !isCurrentlySaved,
      savedAt: !isCurrentlySaved ? new Date().toISOString() : undefined
    };
    const optimisticInteractions = { ...latestInteractionsRef.current, [id]: optimisticInt };
    latestInteractionsRef.current = optimisticInteractions;
    setInteractions(optimisticInteractions);

    try {
      if (isCurrentlySaved) {
        setSavedArticles(prev => prev.filter(a => a.id !== id));
        const updated = await libraryRepository.unsaveArticle(id);
        setInteractions(prev => {
          const next = { ...prev, [id]: updated };
          latestInteractionsRef.current = next;
          return next;
        });
        void BackupService.saveAutoBackup();
        scheduleCloudSyncPushRef.current();
      } else {
        const articleToSave: FeedItem | null =
          latestDailyEditionRef.current.find(i => i.id === id) ??
          latestDiscoveryItemsRef.current.find(i => i.id === id) ??
          latestOpenWebItemsRef.current.find(i => i.id === id) ??
          (latestSelectedArticleRef.current?.id === id ? latestSelectedArticleRef.current : null) ??
          (await feedRepository.getItemById(id));

        if (articleToSave) {
          setSavedArticles(prev => {
            const exists = prev.some(a => a.id === id);
            return exists ? prev : [articleToSave, ...prev];
          });
          const updated = await libraryRepository.saveArticle(articleToSave);
          setInteractions(prev => {
            const next = { ...prev, [id]: updated };
            latestInteractionsRef.current = next;
            return next;
          });
          const timer = setTimeout(() => {
            void (async () => {
              try {
                const res = await RecursiveLearningEngine.recordInteractionEvent(
                  latestProfileRef.current,
                  articleToSave,
                  'bookmark_saved'
                );
                const committed = await userProfileRepository.updateProfile(curr => {
                  const existingSaved = curr.behavioralSignals?.recentSavedIds || [];
                  const nextSaved = [id, ...existingSaved.filter(x => x !== id)].slice(0, 200);
                  const base = res.event
                    ? {
                        ...curr,
                        derivedWeights: {
                          ...(curr.derivedWeights || {}),
                          ...(res.updatedProfile.derivedWeights || {})
                        },
                        feedbackMemory: res.updatedProfile.feedbackMemory
                      }
                    : curr;
                  return {
                    ...base,
                    behavioralSignals: {
                      recentOpenedIds: base.behavioralSignals?.recentOpenedIds || [],
                      recentSavedIds: nextSaved,
                      completedReadIds: base.behavioralSignals?.completedReadIds || []
                    }
                  };
                });
                latestProfileRef.current = committed;
                setProfile(committed);
              } catch {
                // Non-fatal bookmark learning
              }
            })();
            void RaindropService.syncArticleIfConnected(articleToSave);
            void BackupService.saveAutoBackup();
            scheduleCloudSyncPushRef.current();
            void harvestRabbitHoleForItem(articleToSave).catch(() => {});
          }, 50);
          if (timer && typeof (timer as any).unref === 'function') (timer as any).unref();
        } else {
          const updated = await libraryRepository.saveItem(id);
          setInteractions(prev => {
            const next = { ...prev, [id]: updated };
            latestInteractionsRef.current = next;
            return next;
          });
          void BackupService.saveAutoBackup();
          scheduleCloudSyncPushRef.current();
        }
      }
    } catch {
      setErrorMessage('Lesezeichen konnte nicht gespeichert werden.');
    }
  }, []);

  const setFeedback = useCallback(async (
    id: string,
    feedback: 'more_like_this' | 'less_like_this' | 'neutral' | 'already_known' | 'more_depth',
    timeWorthFeedback?: 'very_worthwhile' | 'worthwhile' | 'neutral' | 'not_worthwhile'
  ) => {
    const prevInt = latestInteractionsRef.current[id] ?? {
      itemId: id,
      saved: false,
      progressPercent: 0,
      furthestPositionPercent: 0
    };
    const optimisticInt: ReadingInteraction = {
      ...prevInt,
      feedback,
      timeWorthFeedback: timeWorthFeedback ?? prevInt.timeWorthFeedback
    };
    const optimisticInteractions = { ...latestInteractionsRef.current, [id]: optimisticInt };
    latestInteractionsRef.current = optimisticInteractions;
    setInteractions(optimisticInteractions);

    try {
      const updated = await libraryRepository.setFeedback(id, feedback, timeWorthFeedback);
      const nextInteractions = { ...latestInteractionsRef.current, [id]: updated };
      latestInteractionsRef.current = nextInteractions;
      setInteractions(nextInteractions);

      const timer = setTimeout(async () => {
        try {
          let item = await feedRepository.getItemById(id);
          if (!item) {
            item = await libraryRepository.getSavedArticle(id);
          }
          if (item && (feedback === 'more_like_this' || feedback === 'less_like_this' || feedback === 'already_known' || feedback === 'more_depth')) {
            const eventType =
              feedback === 'less_like_this'
                ? 'feedback_negative'
                : feedback === 'already_known'
                ? 'feedback_already_known'
                : feedback === 'more_depth'
                ? 'feedback_more_depth'
                : 'feedback_positive';
            const res = await RecursiveLearningEngine.recordInteractionEvent(latestProfileRef.current, item, eventType);
            if (res.event) {
              latestProfileRef.current = res.updatedProfile;
              setProfile(res.updatedProfile);
              await userProfileRepository.saveProfile(res.updatedProfile);
            }
          }
        } catch {
          // Non-fatal background profile adjustment
        }
      }, 50);
      if (timer && typeof (timer as any).unref === 'function') (timer as any).unref();
    } catch {
      setErrorMessage('Feedback konnte nicht gespeichert werden.');
    }
  }, []);

  const addNote = useCallback(async (id: string, text: string, tag?: 'einwand' | 'unterricht' | 'these' | 'notiz') => {
    try {
      const updated = await libraryRepository.addNote(id, text, tag);
      const nextInteractions = { ...latestInteractionsRef.current, [id]: updated };
      latestInteractionsRef.current = nextInteractions;
      setInteractions(nextInteractions);

      let item = await feedRepository.getItemById(id);
      if (!item) {
        item = await libraryRepository.getSavedArticle(id);
      }
      if (item) {
        const res = await RecursiveLearningEngine.recordInteractionEvent(latestProfileRef.current, item, 'note_created');
        if (res.event) {
          const updatedProfile = await userProfileRepository.updateProfile(fresh => ({
            ...fresh,
            derivedWeights: res.updatedProfile.derivedWeights,
            feedbackMemory: res.updatedProfile.feedbackMemory
          }));
          latestProfileRef.current = updatedProfile;
          setProfile(updatedProfile);
        }
      }

      try {
        const thoughtType = tag === 'these' || tag === 'einwand' ? 'thesis' : tag === 'unterricht' ? 'concept' : 'article_note';
        const thought = await defaultGraphRepository.addThought({
          type: thoughtType,
          title: text.length > 50 ? text.slice(0, 47) + '…' : text,
          body: text,
          sourceArticleId: id,
          sourceArticleTitle: item?.title,
          space: item?.space,
          tags: tag ? [tag] : ['notiz'],
          status: 'crystallized'
        });
        if (item) {
          const relation = tag === 'einwand' ? 'contradicts' : tag === 'unterricht' ? 'belongs_to' : 'cites';
          await defaultGraphRepository.connectNodes({
            sourceId: item.id,
            targetId: thought.id,
            relation,
            annotation: `Erstellt im Reader (${tag || 'notiz'})`,
            provenance: 'user_curated'
          });
        }
      } catch {
        // Non-fatal mirror
      }

      scheduleCloudSyncPushRef.current();
    } catch {
      setErrorMessage('Notiz konnte nicht gespeichert werden.');
    }
  }, []);

  const voteItem = useCallback(async (id: string, direction: 'up' | 'down' | 'clear') => {
    let foundItem: FeedItem | null =
      latestDailyEditionRef.current.find(i => i.id === id) ??
      latestDiscoveryItemsRef.current.find(i => i.id === id) ??
      latestOpenWebItemsRef.current.find(i => i.id === id) ??
      (latestSelectedArticleRef.current?.id === id ? latestSelectedArticleRef.current : null) ??
      latestSavedArticlesRef.current.find(i => i.id === id) ??
      null;
    const syncSnapshot = foundItem
      ? buildItemSnapshot(foundItem)
      : latestInteractionsRef.current[id]?.itemSnapshot;

    const { nextInteractions } = computeOptimisticVoteState(
      latestInteractionsRef.current,
      [],
      id,
      direction,
      syncSnapshot
    );
    latestInteractionsRef.current = nextInteractions;
    setInteractions(nextInteractions);

    try {
      if (!foundItem) {
        foundItem = (await feedRepository.getItemById(id)) ?? (await libraryRepository.getSavedArticle(id));
      }
      const itemSnapshot = foundItem
        ? buildItemSnapshot(foundItem)
        : latestInteractionsRef.current[id]?.itemSnapshot;
      const updated = await libraryRepository.voteItem(id, direction, itemSnapshot);
      const committedInteractions = { ...latestInteractionsRef.current, [id]: updated };
      latestInteractionsRef.current = committedInteractions;
      setInteractions(committedInteractions);

      const timer = setTimeout(async () => {
        try {
          const item = foundItem ?? (await resolveFeedItemById(id));
          if (item && (direction === 'up' || direction === 'down')) {
            const isUp = direction === 'up';
            const eventType = isUp ? 'upvote' : 'downvote';
            const votedPreview = applyVoteFeedbackToProfile(latestProfileRef.current, item, direction);
            const res = await RecursiveLearningEngine.recordInteractionEvent(votedPreview, item, eventType);

            const committed = await userProfileRepository.updateProfile(curr => {
              const voted = applyVoteFeedbackToProfile(curr, item, direction);
              return res.event
                ? { ...voted, derivedWeights: res.updatedProfile.derivedWeights }
                : voted;
            });

            latestProfileRef.current = committed;
            setProfile(committed);

            if (isUp) {
              void harvestRabbitHoleForItem(item).catch(() => {});
            }
          }
          scheduleCloudSyncPushRef.current();
        } catch {
          // Non-fatal background profile adjustment
        }
      }, 50);
      if (timer && typeof (timer as any).unref === 'function') (timer as any).unref();
    } catch {
      setErrorMessage('Bewertung konnte nicht gespeichert werden.');
    }
  }, [resolveFeedItemById]);

  const dismissItem = useCallback(async (id: string, itemOverride?: FeedItem) => {
    setDismissedItemIds(prev => {
      const next = prev.includes(id) ? prev : [...prev, id];
      void appStorage.setItem(DISMISSED_ITEMS_STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });

    try {
      const updatedInteraction = await libraryRepository.setFeedback(id, 'less_like_this');
      const nextInteractions = { ...latestInteractionsRef.current, [id]: updatedInteraction };
      latestInteractionsRef.current = nextInteractions;
      setInteractions(nextInteractions);

      const item: FeedItem | null =
        itemOverride ??
        latestDailyEditionRef.current.find(i => i.id === id) ??
        latestDiscoveryItemsRef.current.find(i => i.id === id) ??
        latestOpenWebItemsRef.current.find(i => i.id === id) ??
        (await feedRepository.getItemById(id));

      if (item) {
        let domainOut = '';
        let keywordsOut: string[] = [];
        const committed = await userProfileRepository.updateProfile(curr => {
          const res = applyDismissFeedbackToProfile(curr, item);
          domainOut = res.domain;
          keywordsOut = res.keywords;
          return res.updatedProfile;
        });
        latestProfileRef.current = committed;
        setProfile(committed);
        await scheduleFeedRecompute(committed, nextInteractions);
        scheduleCloudSyncPushRef.current();
        return { item, domain: domainOut, keywords: keywordsOut };
      }

      await scheduleFeedRecompute(latestProfileRef.current, nextInteractions);
      scheduleCloudSyncPushRef.current();
      return { item: null, domain: '', keywords: [] };
    } catch {
      return { item: itemOverride ?? null, domain: '', keywords: [] };
    }
  }, [scheduleFeedRecompute]);

  const undoDismissItem = useCallback(async (id: string, itemOverride?: FeedItem) => {
    setDismissedItemIds(prev => {
      const next = prev.filter(x => x !== id);
      void appStorage.setItem(DISMISSED_ITEMS_STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });

    try {
      const updatedInteraction = await libraryRepository.setFeedback(id, 'neutral');
      const nextInteractions = { ...latestInteractionsRef.current, [id]: updatedInteraction };
      latestInteractionsRef.current = nextInteractions;
      setInteractions(nextInteractions);

      const item: FeedItem | null =
        itemOverride ??
        latestDailyEditionRef.current.find(i => i.id === id) ??
        latestDiscoveryItemsRef.current.find(i => i.id === id) ??
        latestOpenWebItemsRef.current.find(i => i.id === id) ??
        (await feedRepository.getItemById(id));

      if (item) {
        const committed = await userProfileRepository.updateProfile(curr =>
          revertDismissFeedbackFromProfile(curr, item)
        );
        latestProfileRef.current = committed;
        setProfile(committed);
        await scheduleFeedRecompute(committed, nextInteractions);
      } else {
        await scheduleFeedRecompute(latestProfileRef.current, nextInteractions);
      }
      scheduleCloudSyncPushRef.current();
    } catch {}
  }, [scheduleFeedRecompute]);

  const removeFeedbackMemoryEntry = useCallback(async (
    kind: 'boost' | 'penalty',
    category: 'topic' | 'author' | 'keyword' | 'domain' | 'space',
    key: string
  ) => {
    const fieldMap =
      kind === 'boost'
        ? ({
            topic: 'boostedTopics',
            author: 'boostedAuthors',
            keyword: 'boostedKeywords',
            domain: 'boostedDomains',
            space: 'boostedSpaces'
          } as const)
        : ({
            topic: 'penalizedTopics',
            author: 'penalizedAuthors',
            keyword: 'penalizedKeywords',
            domain: 'penalizedDomains',
            space: 'penalizedSpaces'
          } as const);
    try {
      const targetField = fieldMap[category];
      const committed = await userProfileRepository.updateProfile(curr => {
        const nextMemory = { ...curr.feedbackMemory };
        const record = { ...(nextMemory[targetField] || {}) };
        delete record[key];
        (nextMemory as any)[targetField] = record;
        return { ...curr, feedbackMemory: nextMemory };
      });
      latestProfileRef.current = committed;
      setProfile(committed);
      await scheduleFeedRecompute(committed, latestInteractionsRef.current);
    } catch {
      setErrorMessage(
        kind === 'boost'
          ? 'Boost konnte nicht entfernt werden.'
          : 'Dämpfung konnte nicht zurückgesetzt werden.'
      );
    }
  }, [scheduleFeedRecompute]);

  const removeFeedbackBoost = useCallback(
    (category: 'topic' | 'author' | 'keyword' | 'domain' | 'space', key: string) =>
      removeFeedbackMemoryEntry('boost', category, key),
    [removeFeedbackMemoryEntry]
  );

  const removeFeedbackPenalty = useCallback(
    (category: 'topic' | 'author' | 'keyword' | 'domain' | 'space', key: string) =>
      removeFeedbackMemoryEntry('penalty', category, key),
    [removeFeedbackMemoryEntry]
  );

  const updateFeedMixRatio = useCallback(async (
    focusRatio: number,
    socraticRatio: number,
    serendipityRatio: number
  ) => {
    try {
      const total = focusRatio + socraticRatio + serendipityRatio;
      const normFocus = total > 0 ? focusRatio / total : 0.6;
      const normSocratic = total > 0 ? socraticRatio / total : 0.2;
      const normSerendipity = total > 0 ? serendipityRatio / total : 0.2;

      const committed = await userProfileRepository.updateProfile(curr => ({
        ...curr,
        feedMixRatio: {
          focusRatio: Math.round(normFocus * 100) / 100,
          socraticRatio: Math.round(normSocratic * 100) / 100,
          serendipityRatio: Math.round(normSerendipity * 100) / 100
        }
      }));
      latestProfileRef.current = committed;
      setProfile(committed);
      await scheduleFeedRecompute(committed, latestInteractionsRef.current);
    } catch {
      setErrorMessage('Feed-Mischverhältnis konnte nicht gespeichert werden.');
    }
  }, [scheduleFeedRecompute]);

  const clearFeedbackMemory = useCallback(async () => {
    try {
      await RecursiveLearningEngine.resetState();
      const committed = await userProfileRepository.updateProfile(curr => ({
        ...curr,
        derivedWeights: {},
        feedbackMemory: {
          boostedTopics: {},
          penalizedTopics: {},
          boostedAuthors: {},
          penalizedAuthors: {},
          boostedKeywords: {},
          penalizedKeywords: {},
          boostedDomains: {},
          penalizedDomains: {},
          boostedSpaces: {},
          penalizedSpaces: {}
        }
      }));
      latestProfileRef.current = committed;
      setProfile(committed);
      await scheduleFeedRecompute(committed, latestInteractionsRef.current);
    } catch {
      setErrorMessage('Algorithmus-Spiegel konnte nicht zurückgesetzt werden.');
    }
  }, [scheduleFeedRecompute]);

  const updateTopicWeight = useCallback(async (topic: TopicTag, weight: number) => {
    try {
      const clamped = Math.max(0, Math.min(1, weight));
      const committed = await userProfileRepository.updateProfile(curr => ({
        ...curr,
        explicitInterests: {
          ...curr.explicitInterests,
          [topic]: clamped
        },
        derivedWeights: {
          ...(curr.derivedWeights || {}),
          [topic]: clamped
        }
      }));
      latestProfileRef.current = committed;
      setProfile(committed);
      await scheduleFeedRecompute(committed, latestInteractionsRef.current);
    } catch {
      setErrorMessage('Themengewichtung konnte nicht gespeichert werden.');
    }
  }, [scheduleFeedRecompute]);

  const updateDurationPreference = useCallback(async (pref: ReadingPreferenceDuration) => {
    try {
      const committed = await userProfileRepository.updateProfile(curr => ({
        ...curr,
        readingPreferences: {
          ...curr.readingPreferences,
          preferredDuration: pref
        }
      }));
      latestProfileRef.current = committed;
      setProfile(committed);
      await scheduleFeedRecompute(committed, latestInteractionsRef.current);
    } catch {
      setErrorMessage('Lesezeit-Präferenz konnte nicht gespeichert werden.');
    }
  }, [scheduleFeedRecompute]);

  const updateReadingPrefOptimistic = useCallback(async (
    patch: Partial<UserProfile['readingPreferences']>,
    errorLabel: string
  ) => {
    const prevProfile = latestProfileRef.current;
    const optimistic = applyOptimisticReadingPreference(prevProfile, patch);
    latestProfileRef.current = optimistic;
    setProfile(optimistic);
    if (patch.externalBrowser !== undefined) {
      setCachedExternalBrowserPref(patch.externalBrowser);
    }
    try {
      const committed = await userProfileRepository.updateProfile(curr =>
        applyOptimisticReadingPreference(curr, patch)
      );
      latestProfileRef.current = committed;
      setProfile(committed);
      if (patch.externalBrowser !== undefined) {
        setCachedExternalBrowserPref(committed.readingPreferences?.externalBrowser ?? 'safari');
      }
    } catch {
      latestProfileRef.current = prevProfile;
      setProfile(prevProfile);
      if (patch.externalBrowser !== undefined) {
        setCachedExternalBrowserPref(prevProfile.readingPreferences?.externalBrowser ?? 'safari');
      }
      setErrorMessage(errorLabel);
    }
  }, []);

  const setFontSize = useCallback(async (fontSize: 'sm' | 'md' | 'lg' | 'xl') => {
    await updateReadingPrefOptimistic({ fontSize }, 'Schriftgröße konnte nicht gespeichert werden.');
  }, [updateReadingPrefOptimistic]);

  const setThemePreference = useCallback(async (theme: 'system' | 'light' | 'dark') => {
    await updateReadingPrefOptimistic({ theme }, 'Erscheinungsbild konnte nicht gespeichert werden.');
  }, [updateReadingPrefOptimistic]);

  const setPalettePreference = useCallback(async (newPalette: ThemePalette) => {
    await updateReadingPrefOptimistic({ palette: newPalette }, 'Farbpalette konnte nicht gespeichert werden.');
  }, [updateReadingPrefOptimistic]);

  const setExternalBrowserPreference = useCallback(async (externalBrowser: ExternalBrowserPreference) => {
    await updateReadingPrefOptimistic({ externalBrowser }, 'Browser-Präferenz konnte nicht gespeichert werden.');
  }, [updateReadingPrefOptimistic]);

  const toggleFeatureModule = useCallback(async (moduleId: FeatureModuleId) => {
    try {
      const committed = await userProfileRepository.updateProfile(curr => {
        const currentModules = curr.enabledModules || {};
        const currentVal = currentModules[moduleId] ?? true;
        return {
          ...curr,
          enabledModules: { ...currentModules, [moduleId]: !currentVal }
        };
      });
      latestProfileRef.current = committed;
      setProfile(committed);
    } catch {
      setErrorMessage('Modul-Status konnte nicht gespeichert werden.');
    }
  }, []);

  const completeOnboarding = useCallback(async (
    interests: Record<TopicTag, number>,
    duration: ReadingPreferenceDuration,
    extra?: OnboardingExtraOptions
  ) => {
    try {
      if (extra?.raindropToken !== undefined) {
        await RaindropService.setStoredToken(extra.raindropToken);
      }
      const committed = await userProfileRepository.updateProfile(curr => ({
        ...curr,
        explicitInterests: interests,
        editorialTargets: {
          ...curr.editorialTargets,
          teachingTargetRatio:
            typeof extra?.teachingTargetRatio === 'number'
              ? extra.teachingTargetRatio
              : curr.editorialTargets.teachingTargetRatio
        },
        readingPreferences: {
          ...curr.readingPreferences,
          preferredDuration: duration,
          languageMix: extra?.languageMix ?? (curr.readingPreferences as any).languageMix ?? 'bilingual',
          theme: extra?.theme ?? curr.readingPreferences.theme,
          palette: extra?.palette ?? curr.readingPreferences.palette
        },
        editionPreferences: {
          ...curr.editionPreferences,
          weatherCity: extra?.weatherCity ?? curr.editionPreferences.weatherCity
        },
        isOnboarded: true
      }));
      latestProfileRef.current = committed;
      setProfile(committed);
      void BackupService.saveAutoBackup();
      await scheduleFeedRecompute(committed, latestInteractionsRef.current);
    } catch {
      setErrorMessage('Onboarding konnte nicht gespeichert werden.');
    }
  }, [scheduleFeedRecompute]);

  const repeatOnboarding = useCallback(async () => {
    try {
      const committed = await userProfileRepository.updateProfile(curr => ({
        ...curr,
        isOnboarded: false
      }));
      latestProfileRef.current = committed;
      setProfile(committed);
      setActiveTab('feed');
    } catch {
      setErrorMessage('Onboarding-Start fehlgeschlagen.');
    }
  }, []);

  // Destructive reset: wipes only @atem: keys + IndexedDB cache and restores clean state
  const clearAllLocalData = useCallback(async () => {
    try {
      storageGenerationRef.current++;
      backgroundCoordinatorRef.current?.stop();
      cancelPendingReadingProgress();
      setSavedArticles([]);

      await Promise.all([
        appStorage.clearAtemKeys(),
        feedRepository.clearCache?.().catch(() => {})
      ]);
      const cleanProfile: UserProfile = {
        ...DEFAULT_USER_PROFILE,
        explicitInterests: { ...DEFAULT_STARTER_INTERESTS },
        isOnboarded: false
      };
      latestProfileRef.current = cleanProfile;
      latestInteractionsRef.current = {};
      setProfile(cleanProfile);
      setInteractions({});
      await scheduleFeedRecompute(cleanProfile, {});
      setActiveTab('feed');
    } catch {
      setErrorMessage('Löschen der lokalen Daten fehlgeschlagen.');
    }
  }, [cancelPendingReadingProgress, scheduleFeedRecompute]);

  const clearError = useCallback(() => {
    setErrorMessage(null);
  }, []);

  const contextValue = useMemo<AppContextValue>(
    () => ({
      isHydrated,
      profile,
      interactions,
      dailyEdition,
      discoveryItems,
      savedArticles,
      startupState,
      errorMessage,
      clearError,
      colors,
      isDark,
      palette,
      activeTab,
      setActiveTab,
      activeFeedOption,
      setActiveFeedOption,
      openWebItems,
      historyItems,
      historySortOrder,
      setHistorySortOrder,
      refreshHistory,
      clearAppearanceHistory,
      recordCardAppearances,
      selectedEditionType,
      currentEditionType,
      setSelectedEditionType,
      weatherData,
      selectedFilter,
      setSelectedFilter,
      searchQuery,
      setSearchQuery,
      selectedArticleId,
      selectedArticle,
      openArticle,
      closeArticle,
      goHome,
      feedScrollToTopSignal,
      requestFeedScrollToTop,
      wakeRefreshSignal,
      lastWakeWasNewDay,
      whyModalItem,
      openWhyModal,
      closeWhyModal,
      isInvestigationOpen,
      investigationTargetArticle,
      investigationInitialQuestion,
      openInvestigation,
      closeInvestigation,
      toggleSaveItem,
      updateReadingProgress,
      flushReadingProgress,
      setFeedback,
      addNote,
      voteItem,
      updateTopicWeight,
      updateDurationPreference,
      setFontSize,
      setThemePreference,
      setPalettePreference,
      setExternalBrowserPreference,
      toggleFeatureModule,
      completeOnboarding,
      repeatOnboarding,
      clearAllLocalData,
      refreshFeed,
      recomputeFeed,
      shuffleSeed,
      shuffleFeed,
      updateEditionPreferences,
      simulateDailyGeneration,
      activeDateSeed,
      retryStartup: loadInitialData,
      resetCorruptedData,
      reloadFromStorage: loadInitialData,
      remoteSnapshotUrl,
      setRemoteSnapshotUrl,
      refreshLiveFeed,
      snapshotSyncInfo,
      spaces,
      createSpace,
      updateSpace,
      deleteSpace,
      togglePinSpace,
      setSpaceFeedPriority,
      selectSpace,
      removeFeedbackBoost,
      removeFeedbackPenalty,
      updateFeedMixRatio,
      clearFeedbackMemory,
      dismissedItemIds,
      dismissItem,
      undoDismissItem,
      cloudSyncConfig,
      isSyncing,
      syncStatusMessage,
      triggerCloudSync,
      updateCloudSyncConfig,
      activateCloudSync,
      applyPairingCode,
      getPairingBundle,
      scheduleCloudSyncPush
    }),
    [
      isHydrated,
      profile,
      interactions,
      dailyEdition,
      discoveryItems,
      savedArticles,
      startupState,
      errorMessage,
      clearError,
      colors,
      isDark,
      palette,
      activeTab,
      setActiveTab,
      activeFeedOption,
      setActiveFeedOption,
      openWebItems,
      historyItems,
      historySortOrder,
      setHistorySortOrder,
      refreshHistory,
      clearAppearanceHistory,
      recordCardAppearances,
      selectedEditionType,
      currentEditionType,
      setSelectedEditionType,
      weatherData,
      selectedFilter,
      setSelectedFilter,
      searchQuery,
      setSearchQuery,
      selectedArticleId,
      selectedArticle,
      openArticle,
      closeArticle,
      goHome,
      feedScrollToTopSignal,
      requestFeedScrollToTop,
      wakeRefreshSignal,
      lastWakeWasNewDay,
      whyModalItem,
      openWhyModal,
      closeWhyModal,
      isInvestigationOpen,
      investigationTargetArticle,
      investigationInitialQuestion,
      openInvestigation,
      closeInvestigation,
      toggleSaveItem,
      updateReadingProgress,
      flushReadingProgress,
      setFeedback,
      addNote,
      voteItem,
      updateTopicWeight,
      updateDurationPreference,
      setFontSize,
      setThemePreference,
      setPalettePreference,
      setExternalBrowserPreference,
      toggleFeatureModule,
      completeOnboarding,
      repeatOnboarding,
      clearAllLocalData,
      refreshFeed,
      recomputeFeed,
      shuffleSeed,
      shuffleFeed,
      updateEditionPreferences,
      simulateDailyGeneration,
      activeDateSeed,
      loadInitialData,
      resetCorruptedData,
      remoteSnapshotUrl,
      setRemoteSnapshotUrl,
      refreshLiveFeed,
      snapshotSyncInfo,
      spaces,
      createSpace,
      updateSpace,
      deleteSpace,
      togglePinSpace,
      setSpaceFeedPriority,
      selectSpace,
      removeFeedbackBoost,
      removeFeedbackPenalty,
      updateFeedMixRatio,
      clearFeedbackMemory,
      dismissedItemIds,
      dismissItem,
      undoDismissItem,
      cloudSyncConfig,
      isSyncing,
      syncStatusMessage,
      triggerCloudSync,
      updateCloudSyncConfig,
      activateCloudSync,
      applyPairingCode,
      getPairingBundle,
      scheduleCloudSyncPush
    ]
  );

  const actionsContextValue = useMemo<AppActionsContextValue>(
    () => ({
      openArticle,
      toggleSaveItem,
      voteItem,
      dismissItem,
      scheduleCloudSyncPush
    }),
    [openArticle, toggleSaveItem, voteItem, dismissItem, scheduleCloudSyncPush]
  );

  return (
    <AppActionsContext.Provider value={actionsContextValue}>
      <AppContext.Provider value={contextValue}>
        {children}
      </AppContext.Provider>
    </AppActionsContext.Provider>
  );
};

export const useAppActions = (): AppActionsContextValue => {
  const context = useContext(AppActionsContext);
  if (!context) {
    throw new Error('useAppActions must be used within an AppProvider');
  }
  return context;
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
