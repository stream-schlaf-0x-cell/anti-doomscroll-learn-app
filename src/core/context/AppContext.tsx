import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useColorScheme, Platform, AppState, AppStateStatus } from 'react-native';
import {
  UserProfile,
  ReadingInteraction,
  TopicTag,
  ReadingPreferenceDuration,
  FeedItem,
  DayEditionType,
  EditionPreferences
} from '../domain/types';
import { ScoredFeedItem, determineCurrentEditionType } from '../domain/ranking';
import { feedRepository } from '../data/feedRepository';
import { libraryRepository } from '../data/libraryRepository';
import { userProfileRepository } from '../data/userProfileRepository';
import { DEFAULT_USER_PROFILE, DEFAULT_STARTER_INTERESTS } from '../data/fixtures';
import { appStorage, CorruptedDataError, StorageUnavailableError } from '../data/storage';
import { RecursiveLearningEngine } from '../recommendations/recursiveLearningEngine';
import { WeatherService, WeatherData } from '../weather/weatherService';
import { DailyGenerationService } from '../daily/dailyGenerationService';
import { ContinuousLiveNewsService } from '../data/continuousLiveNewsService';
import { ThemeColors, ThemePalette, getThemeColors } from '../../ui/theme';

export type StartupState =
  | { status: 'loading' }
  | { status: 'ready' }
  | { status: 'error'; message: string; isCorrupt?: boolean; canReset?: boolean };

interface AppContextValue {
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
  activeTab: 'feed' | 'library' | 'settings';
  setActiveTab: (tab: 'feed' | 'library' | 'settings') => void;
  activeFeedOption: 'daily' | 'live_news' | 'classics';
  setActiveFeedOption: (option: 'daily' | 'live_news' | 'classics') => void;
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
  openArticle: (id: string) => Promise<void>;
  closeArticle: () => void;
  goHome: () => void;
  whyModalItem: ScoredFeedItem | null;
  openWhyModal: (item: ScoredFeedItem) => void;
  closeWhyModal: () => void;
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
  completeOnboarding: (interests: Record<TopicTag, number>, duration: ReadingPreferenceDuration) => Promise<void>;
  repeatOnboarding: () => Promise<void>;
  clearAllLocalData: () => Promise<void>;
  refreshFeed: () => Promise<void>;
  shuffleSeed: number;
  shuffleFeed: () => Promise<void>;
  updateEditionPreferences: (prefs: Partial<EditionPreferences>) => Promise<void>;
  simulateDailyGeneration: (daysOffset?: number, customDate?: string) => Promise<{ simulatedDate: string; itemCount: number }>;
  activeDateSeed: string;
  retryStartup: () => Promise<void>;
  resetCorruptedData: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemScheme = useColorScheme();
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_USER_PROFILE);
  const [interactions, setInteractions] = useState<Record<string, ReadingInteraction>>({});
  const [dailyEdition, setDailyEdition] = useState<ScoredFeedItem[]>([]);
  const [discoveryItems, setDiscoveryItems] = useState<ScoredFeedItem[]>([]);
  const [savedArticles, setSavedArticles] = useState<FeedItem[]>([]);
  const [startupState, setStartupState] = useState<StartupState>({ status: 'loading' });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'feed' | 'library' | 'settings'>('feed');
  const [activeFeedOption, setActiveFeedOption] = useState<'daily' | 'live_news' | 'classics'>('daily');
  const [selectedFilter, setSelectedFilter] = useState<string | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<FeedItem | null>(null);
  const [whyModalItem, setWhyModalItem] = useState<ScoredFeedItem | null>(null);
  const [selectedEditionType, setSelectedEditionTypeState] = useState<DayEditionType>(() => {
    return determineCurrentEditionType(new Date(), DEFAULT_USER_PROFILE);
  });
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [activeDateSeed, setActiveDateSeed] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [shuffleSeed, setShuffleSeed] = useState<number>(0);

  const selectedEditionTypeRef = useRef<DayEditionType>(selectedEditionType);
  selectedEditionTypeRef.current = selectedEditionType;

  const activeDateSeedRef = useRef<string>(activeDateSeed);
  activeDateSeedRef.current = activeDateSeed;

  const shuffleSeedRef = useRef<number>(0);
  shuffleSeedRef.current = shuffleSeed;

  // References to track latest committed state and prevent stale closures
  const latestProfileRef = useRef<UserProfile>(profile);
  const latestInteractionsRef = useRef<Record<string, ReadingInteraction>>(interactions);
  latestProfileRef.current = profile;
  latestInteractionsRef.current = interactions;

  const currentEditionType = useMemo(() => {
    return determineCurrentEditionType(new Date(), profile);
  }, [profile]);

  // Sequencing token to discard stale asynchronous feed recomputations
  const feedRecomputeVersion = useRef<number>(0);

  // Generation counter to invalidate pending background writes on reset
  const storageGenerationRef = useRef<number>(0);

  // Pending throttled reading progress buffer
  const pendingProgressRef = useRef<{ id: string; percent: number } | null>(null);
  const progressDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Compute active theme colors and palette
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

  // Sequenced feed recomputation: newest committed call always wins
  const scheduleFeedRecompute = useCallback(async (
    prof: UserProfile,
    inter: Record<string, ReadingInteraction>,
    targetEdition?: DayEditionType,
    customDateSeed?: string,
    customShuffleOffset?: number
  ) => {
    const currentVersion = ++feedRecomputeVersion.current;
    try {
      const edition = targetEdition ?? selectedEditionTypeRef.current;
      const seed = customDateSeed ?? activeDateSeedRef.current;
      const offset = customShuffleOffset ?? shuffleSeedRef.current;
      const [daily, disc] = await Promise.all([
        feedRepository.getEditionFeed(edition, prof, inter, seed, offset),
        feedRepository.getDiscoveryItems(prof, inter)
      ]);
      if (currentVersion === feedRecomputeVersion.current) {
        setDailyEdition(daily);
        setDiscoveryItems(disc);
      }

      if (edition === 'morning' && prof.editionPreferences?.weatherEnabled !== false) {
        const city = prof.editionPreferences?.weatherCity || 'dresden';
        const weather = await WeatherService.getWeatherForCity(city);
        if (currentVersion === feedRecomputeVersion.current) {
          setWeatherData(weather);
        }
      } else {
        if (currentVersion === feedRecomputeVersion.current) {
          setWeatherData(null);
        }
      }
    } catch (err) {
      console.warn('Feed-Berechnung fehlgeschlagen:', err);
    }
  }, []);

  const shuffleFeed = useCallback(async () => {
    const nextOffset = shuffleSeedRef.current + 1;
    setShuffleSeed(nextOffset);
    shuffleSeedRef.current = nextOffset;
    await scheduleFeedRecompute(
      latestProfileRef.current,
      latestInteractionsRef.current,
      selectedEditionTypeRef.current,
      `${activeDateSeedRef.current}-shuffle-${nextOffset}`,
      nextOffset
    );
  }, [scheduleFeedRecompute]);

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

  // Flush pending reading progress immediately to persistent storage
  const flushReadingProgress = useCallback(async () => {
    if (progressDebounceTimerRef.current) {
      clearTimeout(progressDebounceTimerRef.current);
      progressDebounceTimerRef.current = null;
    }
    const pending = pendingProgressRef.current;
    if (pending) {
      pendingProgressRef.current = null;
      try {
        const updated = await libraryRepository.updateProgress(pending.id, pending.percent);
        setInteractions(prev => {
          const next = { ...prev, [pending.id]: updated };
          latestInteractionsRef.current = next;
          return next;
        });
      } catch (err) {
        console.warn('Lesefortschritt konnte nicht persistiert werden:', err);
      }
    }
  }, []);

  // Flush progress when app moves to background
  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'background' || nextState === 'inactive') {
        flushReadingProgress();
      }
    };
    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => sub.remove();
  }, [flushReadingProgress]);

  // Load initial data on startup with explicit typed error recovery
  const loadInitialData = useCallback(async () => {
    setStartupState({ status: 'loading' });
    setErrorMessage(null);

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

      setProfile(loadedProfile);
      setInteractions(loadedInteractions);
      latestProfileRef.current = loadedProfile;
      latestInteractionsRef.current = loadedInteractions;

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
      await scheduleFeedRecompute(loadedProfile, loadedInteractions, initialEdition);
      setStartupState({ status: 'ready' });

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
    } catch (err: any) {
      setStartupState({
        status: 'error',
        message: err?.message || 'Die Tagesausgabe konnte nicht initialisiert werden. Bitte tippe auf Wiederholen.',
        canReset: true
      });
    }
  }, [scheduleFeedRecompute]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Quarantines corrupt bytes and resets to fresh defaults
  const resetCorruptedData = useCallback(async () => {
    try {
      storageGenerationRef.current++;
      if (progressDebounceTimerRef.current) {
        clearTimeout(progressDebounceTimerRef.current);
        progressDebounceTimerRef.current = null;
      }
      pendingProgressRef.current = null;
      setSavedArticles([]);
      await userProfileRepository.quarantineAndReset();
      await libraryRepository.quarantineAndReset();
      await loadInitialData();
    } catch {
      setErrorMessage('Zurücksetzen fehlgeschlagen. Bitte versuche es erneut.');
    }
  }, [loadInitialData]);

  const refreshFeed = useCallback(async () => {
    try {
      try {
        const liveItems = await ContinuousLiveNewsService.refreshLiveFeeds(true);
        if (liveItems.length > 0 && (feedRepository as any).addItems) {
          (feedRepository as any).addItems(liveItems);
        }
      } catch {
        // Fallback
      }
      try {
        const fresh = require('../data/pipeline-output.json');
        if (Array.isArray(fresh) && (feedRepository as any).setItems) {
          (feedRepository as any).setItems(fresh);
        }
      } catch {
        // Fallback
      }
      await scheduleFeedRecompute(latestProfileRef.current, latestInteractionsRef.current);
    } catch (err) {
      console.warn('Feed-Aktualisierung fehlgeschlagen:', err);
    }
  }, [scheduleFeedRecompute]);

  const simulateDailyGeneration = useCallback(async (daysOffset: number = 0, customDate?: string) => {
    const res = await DailyGenerationService.simulateDailyGeneration({
      profile: latestProfileRef.current,
      daysOffset,
      targetDate: customDate,
      fetchLiveNews: true
    });
    setActiveDateSeed(res.simulatedDate);
    activeDateSeedRef.current = res.simulatedDate;
    await scheduleFeedRecompute(latestProfileRef.current, latestInteractionsRef.current, selectedEditionTypeRef.current, res.simulatedDate);
    return { simulatedDate: res.simulatedDate, itemCount: res.generatedItems.length };
  }, [scheduleFeedRecompute]);

  const openArticle = useCallback(async (id: string) => {
    let item = await feedRepository.getItemById(id);
    if (!item) {
      item = await libraryRepository.getSavedArticle(id);
    }
    if (!item) {
      item = savedArticles.find(a => a.id === id) ?? null;
    }
    setSelectedArticleId(id);
    setSelectedArticle(item); // item can be null if missing; ReaderScreen gracefully displays fallback

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        if (window.location.search !== `?article=${id}`) {
          window.history.pushState({ articleId: id }, '', `?article=${id}`);
        }
      } catch {
        // Ignored
      }
    }
  }, [savedArticles]);

  const closeArticle = useCallback(() => {
    flushReadingProgress();
    setSelectedArticleId(null);
    setSelectedArticle(null);

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        if (window.location.search.includes('article=')) {
          window.history.pushState({}, '', window.location.pathname);
        }
      } catch {
        // Ignored
      }
    }
  }, [flushReadingProgress]);

  const goHome = useCallback(() => {
    void flushReadingProgress();
    setSelectedArticleId(null);
    setSelectedArticle(null);
    setWhyModalItem(null);
    setActiveTab('feed');
    setActiveFeedOption('daily');
    setSelectedFilter('all');
    setSearchQuery('');
    const autoEdition = determineCurrentEditionType(new Date(), latestProfileRef.current);
    setSelectedEditionTypeState(autoEdition);
    selectedEditionTypeRef.current = autoEdition;
    void scheduleFeedRecompute(latestProfileRef.current, latestInteractionsRef.current, autoEdition);

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        if (window.location.search.includes('article=')) {
          window.history.pushState({}, '', window.location.pathname);
        }
      } catch {
        // Ignored
      }
    }
  }, [flushReadingProgress, scheduleFeedRecompute]);

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
          flushReadingProgress();
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

  const toggleSaveItem = useCallback(async (id: string) => {
    try {
      const isCurrentlySaved = latestInteractionsRef.current[id]?.saved ?? false;
      if (isCurrentlySaved) {
        const updated = await libraryRepository.unsaveArticle(id);
        setInteractions(prev => {
          const next = { ...prev, [id]: updated };
          latestInteractionsRef.current = next;
          return next;
        });
        setSavedArticles(prev => prev.filter(a => a.id !== id));
      } else {
        let articleToSave: FeedItem | null =
          dailyEdition.find(i => i.id === id) ??
          discoveryItems.find(i => i.id === id) ??
          (selectedArticle?.id === id ? selectedArticle : null) ??
          (await feedRepository.getItemById(id));

        if (articleToSave) {
          const updated = await libraryRepository.saveArticle(articleToSave);
          setInteractions(prev => {
            const next = { ...prev, [id]: updated };
            latestInteractionsRef.current = next;
            return next;
          });
          setSavedArticles(prev => {
            const exists = prev.some(a => a.id === id);
            return exists ? prev : [articleToSave!, ...prev];
          });
        } else {
          const updated = await libraryRepository.saveItem(id);
          setInteractions(prev => {
            const next = { ...prev, [id]: updated };
            latestInteractionsRef.current = next;
            return next;
          });
        }
      }
    } catch {
      setErrorMessage('Lesezeichen konnte nicht gespeichert werden.');
    }
  }, [dailyEdition, discoveryItems, selectedArticle]);

  // Throttled reading progress write (bounds write rate to max 1 write / 800ms while scrolling)
  const updateReadingProgress = useCallback(async (id: string, percent: number) => {
    // Keep in pending buffer
    pendingProgressRef.current = { id, percent };
    const currentGen = storageGenerationRef.current;

    // Update React state optimistically so progress bar is instant
    setInteractions(prev => {
      const existing = prev[id] ?? { itemId: id, saved: false, progressPercent: 0, furthestPositionPercent: 0 };
      const next = {
        ...prev,
        [id]: {
          ...existing,
          progressPercent: Math.max(existing.progressPercent, percent),
          furthestPositionPercent: Math.max(existing.furthestPositionPercent ?? 0, percent)
        }
      };
      latestInteractionsRef.current = next;
      return next;
    });

    if (progressDebounceTimerRef.current) {
      clearTimeout(progressDebounceTimerRef.current);
    }

    progressDebounceTimerRef.current = setTimeout(async () => {
      progressDebounceTimerRef.current = null;
      if (currentGen !== storageGenerationRef.current) return;
      const pending = pendingProgressRef.current;
      if (pending) {
        pendingProgressRef.current = null;
        try {
          const updated = await libraryRepository.updateProgress(pending.id, pending.percent);
          if (currentGen === storageGenerationRef.current) {
            setInteractions(prev => {
              const next = { ...prev, [pending.id]: updated };
              latestInteractionsRef.current = next;
              return next;
            });
          }
        } catch {
          // Non-fatal background write
        }
      }
    }, 800);
  }, []);

  const setFeedback = useCallback(async (
    id: string,
    feedback: 'more_like_this' | 'less_like_this' | 'neutral' | 'already_known' | 'more_depth',
    timeWorthFeedback?: 'very_worthwhile' | 'worthwhile' | 'neutral' | 'not_worthwhile'
  ) => {
    try {
      const updated = await libraryRepository.setFeedback(id, feedback, timeWorthFeedback);
      const nextInteractions = { ...latestInteractionsRef.current, [id]: updated };
      latestInteractionsRef.current = nextInteractions;
      setInteractions(nextInteractions);

      let item = await feedRepository.getItemById(id);
      if (!item) {
        item = await libraryRepository.getSavedArticle(id);
      }
      if (item && (feedback === 'more_like_this' || feedback === 'less_like_this' || feedback === 'already_known' || feedback === 'more_depth')) {
        let eventType: 'feedback_positive' | 'feedback_negative' | 'feedback_already_known' | 'feedback_more_depth' = 'feedback_positive';
        if (feedback === 'less_like_this') {
          eventType = 'feedback_negative';
        } else if (feedback === 'already_known') {
          eventType = 'feedback_already_known';
        } else if (feedback === 'more_depth') {
          eventType = 'feedback_more_depth';
        }
        const res = await RecursiveLearningEngine.recordInteractionEvent(latestProfileRef.current, item, eventType);
        if (res.event) {
          latestProfileRef.current = res.updatedProfile;
          setProfile(res.updatedProfile);
          await userProfileRepository.saveProfile(res.updatedProfile);
        }
      }

      await scheduleFeedRecompute(latestProfileRef.current, nextInteractions);
    } catch {
      setErrorMessage('Feedback konnte nicht gespeichert werden.');
    }
  }, [scheduleFeedRecompute]);

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
          latestProfileRef.current = res.updatedProfile;
          setProfile(res.updatedProfile);
          await userProfileRepository.saveProfile(res.updatedProfile);
          await scheduleFeedRecompute(res.updatedProfile, nextInteractions);
        }
      }
    } catch {
      setErrorMessage('Notiz konnte nicht gespeichert werden.');
    }
  }, [scheduleFeedRecompute]);

  const voteItem = useCallback(async (id: string, direction: 'up' | 'down' | 'clear') => {
    try {
      const updated = await libraryRepository.voteItem(id, direction);
      const nextInteractions = { ...latestInteractionsRef.current, [id]: updated };
      latestInteractionsRef.current = nextInteractions;
      setInteractions(nextInteractions);

      let item = await feedRepository.getItemById(id);
      if (!item) {
        item = await libraryRepository.getSavedArticle(id);
      }
      if (item && (direction === 'up' || direction === 'down')) {
        const eventType = direction === 'up' ? 'upvote' : 'downvote';
        const res = await RecursiveLearningEngine.recordInteractionEvent(latestProfileRef.current, item, eventType);
        if (res.event) {
          latestProfileRef.current = res.updatedProfile;
          setProfile(res.updatedProfile);
          await userProfileRepository.saveProfile(res.updatedProfile);
        }
      }

      await scheduleFeedRecompute(latestProfileRef.current, nextInteractions);
    } catch {
      setErrorMessage('Bewertung konnte nicht gespeichert werden.');
    }
  }, [scheduleFeedRecompute]);

  const updateTopicWeight = useCallback(async (topic: TopicTag, weight: number) => {
    try {
      const committed = await userProfileRepository.updateProfile(curr => ({
        ...curr,
        explicitInterests: {
          ...curr.explicitInterests,
          [topic]: Math.max(0, Math.min(1, weight))
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

  const setFontSize = useCallback(async (fontSize: 'sm' | 'md' | 'lg' | 'xl') => {
    try {
      const committed = await userProfileRepository.updateProfile(curr => ({
        ...curr,
        readingPreferences: {
          ...curr.readingPreferences,
          fontSize
        }
      }));
      latestProfileRef.current = committed;
      setProfile(committed);
    } catch {
      setErrorMessage('Schriftgröße konnte nicht gespeichert werden.');
    }
  }, []);

  const setThemePreference = useCallback(async (theme: 'system' | 'light' | 'dark') => {
    try {
      const committed = await userProfileRepository.updateProfile(curr => ({
        ...curr,
        readingPreferences: {
          ...curr.readingPreferences,
          theme
        }
      }));
      latestProfileRef.current = committed;
      setProfile(committed);
    } catch {
      setErrorMessage('Erscheinungsbild konnte nicht gespeichert werden.');
    }
  }, []);

  const setPalettePreference = useCallback(async (newPalette: ThemePalette) => {
    try {
      const committed = await userProfileRepository.updateProfile(curr => ({
        ...curr,
        readingPreferences: {
          ...curr.readingPreferences,
          palette: newPalette
        }
      }));
      latestProfileRef.current = committed;
      setProfile(committed);
    } catch {
      setErrorMessage('Farbpalette konnte nicht gespeichert werden.');
    }
  }, []);

  const completeOnboarding = useCallback(async (interests: Record<TopicTag, number>, duration: ReadingPreferenceDuration) => {
    try {
      const committed = await userProfileRepository.updateProfile(curr => ({
        ...curr,
        explicitInterests: interests,
        readingPreferences: {
          ...curr.readingPreferences,
          preferredDuration: duration
        },
        isOnboarded: true
      }));
      latestProfileRef.current = committed;
      setProfile(committed);
      await scheduleFeedRecompute(committed, latestInteractionsRef.current);
    } catch {
      setErrorMessage('Onboarding konnte nicht gespeichert werden.');
    }
  }, [scheduleFeedRecompute]);

  // Re-runs onboarding flow without destroying saved articles
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

  // Destructive reset: wipes only @atem: keys and restores clean state
  const clearAllLocalData = useCallback(async () => {
    try {
      storageGenerationRef.current++;
      if (progressDebounceTimerRef.current) {
        clearTimeout(progressDebounceTimerRef.current);
        progressDebounceTimerRef.current = null;
      }
      pendingProgressRef.current = null;
      setSavedArticles([]);

      await appStorage.clearAtemKeys();
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
  }, [scheduleFeedRecompute]);

  const clearError = useCallback(() => {
    setErrorMessage(null);
  }, []);

  return (
    <AppContext.Provider
      value={{
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
        whyModalItem,
        openWhyModal,
        closeWhyModal,
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
        completeOnboarding,
        repeatOnboarding,
        clearAllLocalData,
        refreshFeed,
        shuffleSeed,
        shuffleFeed,
        updateEditionPreferences,
        simulateDailyGeneration,
        activeDateSeed,
        retryStartup: loadInitialData,
        resetCorruptedData
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
