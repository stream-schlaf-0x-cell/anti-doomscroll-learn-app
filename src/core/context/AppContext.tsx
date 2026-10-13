import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import {
  UserProfile,
  ReadingInteraction,
  TopicTag,
  ReadingPreferenceDuration,
  FeedItem
} from '../domain/types';
import { ScoredFeedItem } from '../domain/ranking';
import { feedRepository } from '../data/feedRepository';
import { libraryRepository } from '../data/libraryRepository';
import { userProfileRepository } from '../data/userProfileRepository';
import { DEFAULT_USER_PROFILE } from '../data/fixtures';
import { lightColors, darkColors, ThemeColors } from '../../ui/theme';

interface AppContextValue {
  profile: UserProfile;
  interactions: Record<string, ReadingInteraction>;
  dailyEdition: ScoredFeedItem[];
  discoveryItems: ScoredFeedItem[];
  isLoading: boolean;
  colors: ThemeColors;
  isDark: boolean;
  activeTab: 'feed' | 'library' | 'settings';
  setActiveTab: (tab: 'feed' | 'library' | 'settings') => void;
  selectedArticleId: string | null;
  selectedArticle: FeedItem | null;
  openArticle: (id: string) => void;
  closeArticle: () => void;
  whyModalItem: ScoredFeedItem | null;
  openWhyModal: (item: ScoredFeedItem) => void;
  closeWhyModal: () => void;
  toggleSaveItem: (id: string) => Promise<void>;
  updateReadingProgress: (id: string, percent: number) => Promise<void>;
  setFeedback: (id: string, feedback: 'more_like_this' | 'less_like_this' | 'neutral') => Promise<void>;
  updateTopicWeight: (topic: TopicTag, weight: number) => Promise<void>;
  updateDurationPreference: (pref: ReadingPreferenceDuration) => Promise<void>;
  setFontSize: (size: 'sm' | 'md' | 'lg' | 'xl') => Promise<void>;
  setThemePreference: (theme: 'system' | 'light' | 'dark') => Promise<void>;
  completeOnboarding: (interests: Record<TopicTag, number>, duration: ReadingPreferenceDuration) => Promise<void>;
  resetOnboarding: () => Promise<void>;
  refreshFeed: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemScheme = useColorScheme();
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_USER_PROFILE);
  const [interactions, setInteractions] = useState<Record<string, ReadingInteraction>>({});
  const [dailyEdition, setDailyEdition] = useState<ScoredFeedItem[]>([]);
  const [discoveryItems, setDiscoveryItems] = useState<ScoredFeedItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'feed' | 'library' | 'settings'>('feed');
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<FeedItem | null>(null);
  const [whyModalItem, setWhyModalItem] = useState<ScoredFeedItem | null>(null);

  // Compute active theme colors
  const isDark = useMemo(() => {
    const themePref = profile.readingPreferences.theme;
    if (themePref === 'dark') return true;
    if (themePref === 'light') return false;
    return systemScheme === 'dark';
  }, [profile.readingPreferences.theme, systemScheme]);

  const colors = useMemo(() => (isDark ? darkColors : lightColors), [isDark]);

  // Load initial data
  const loadInitialData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [loadedProfile, loadedInteractions] = await Promise.all([
        userProfileRepository.getProfile(),
        libraryRepository.getInteractions()
      ]);
      setProfile(loadedProfile);
      setInteractions(loadedInteractions);

      const [daily, disc] = await Promise.all([
        feedRepository.getDailyEdition(loadedProfile, loadedInteractions),
        feedRepository.getDiscoveryItems(loadedProfile, loadedInteractions)
      ]);
      setDailyEdition(daily);
      setDiscoveryItems(disc);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Re-rank feed whenever profile or interactions change
  const recomputeFeed = useCallback(async (prof: UserProfile, inter: Record<string, ReadingInteraction>) => {
    const [daily, disc] = await Promise.all([
      feedRepository.getDailyEdition(prof, inter),
      feedRepository.getDiscoveryItems(prof, inter)
    ]);
    setDailyEdition(daily);
    setDiscoveryItems(disc);
  }, []);

  const refreshFeed = useCallback(async () => {
    await recomputeFeed(profile, interactions);
  }, [recomputeFeed, profile, interactions]);

  const openArticle = useCallback(async (id: string) => {
    setSelectedArticleId(id);
    const item = await feedRepository.getItemById(id);
    setSelectedArticle(item);
  }, []);

  const closeArticle = useCallback(() => {
    setSelectedArticleId(null);
    setSelectedArticle(null);
  }, []);

  const openWhyModal = useCallback((item: ScoredFeedItem) => {
    setWhyModalItem(item);
  }, []);

  const closeWhyModal = useCallback(() => {
    setWhyModalItem(null);
  }, []);

  const toggleSaveItem = useCallback(async (id: string) => {
    const isCurrentlySaved = interactions[id]?.saved ?? false;
    const updated = isCurrentlySaved
      ? await libraryRepository.unsaveItem(id)
      : await libraryRepository.saveItem(id);

    setInteractions(prev => {
      const next = { ...prev, [id]: updated };
      return next;
    });
  }, [interactions]);

  const updateReadingProgress = useCallback(async (id: string, percent: number) => {
    const updated = await libraryRepository.updateProgress(id, percent);
    setInteractions(prev => ({ ...prev, [id]: updated }));
  }, []);

  const setFeedback = useCallback(async (id: string, feedback: 'more_like_this' | 'less_like_this' | 'neutral') => {
    const updated = await libraryRepository.setFeedback(id, feedback);
    setInteractions(prev => {
      const next = { ...prev, [id]: updated };
      recomputeFeed(profile, next);
      return next;
    });
  }, [profile, recomputeFeed]);

  const updateTopicWeight = useCallback(async (topic: TopicTag, weight: number) => {
    const updatedProfile: UserProfile = {
      ...profile,
      explicitInterests: {
        ...profile.explicitInterests,
        [topic]: Math.max(0, Math.min(1, weight))
      }
    };
    setProfile(updatedProfile);
    await userProfileRepository.saveProfile(updatedProfile);
    await recomputeFeed(updatedProfile, interactions);
  }, [profile, interactions, recomputeFeed]);

  const updateDurationPreference = useCallback(async (pref: ReadingPreferenceDuration) => {
    const updatedProfile: UserProfile = {
      ...profile,
      readingPreferences: {
        ...profile.readingPreferences,
        preferredDuration: pref
      }
    };
    setProfile(updatedProfile);
    await userProfileRepository.saveProfile(updatedProfile);
    await recomputeFeed(updatedProfile, interactions);
  }, [profile, interactions, recomputeFeed]);

  const setFontSize = useCallback(async (fontSize: 'sm' | 'md' | 'lg' | 'xl') => {
    const updatedProfile: UserProfile = {
      ...profile,
      readingPreferences: {
        ...profile.readingPreferences,
        fontSize
      }
    };
    setProfile(updatedProfile);
    await userProfileRepository.saveProfile(updatedProfile);
  }, [profile]);

  const setThemePreference = useCallback(async (theme: 'system' | 'light' | 'dark') => {
    const updatedProfile: UserProfile = {
      ...profile,
      readingPreferences: {
        ...profile.readingPreferences,
        theme
      }
    };
    setProfile(updatedProfile);
    await userProfileRepository.saveProfile(updatedProfile);
  }, [profile]);

  const completeOnboarding = useCallback(async (interests: Record<TopicTag, number>, duration: ReadingPreferenceDuration) => {
    const updatedProfile: UserProfile = {
      ...profile,
      explicitInterests: interests,
      readingPreferences: {
        ...profile.readingPreferences,
        preferredDuration: duration
      },
      isOnboarded: true
    };
    setProfile(updatedProfile);
    await userProfileRepository.saveProfile(updatedProfile);
    await recomputeFeed(updatedProfile, interactions);
  }, [profile, interactions, recomputeFeed]);

  const resetOnboarding = useCallback(async () => {
    const reset = await userProfileRepository.resetProfile();
    const cleanProfile: UserProfile = { ...reset, isOnboarded: false };
    setProfile(cleanProfile);
    await userProfileRepository.saveProfile(cleanProfile);
    await libraryRepository.clearLibrary();
    setInteractions({});
    await recomputeFeed(cleanProfile, {});
    setActiveTab('feed');
  }, [recomputeFeed]);

  return (
    <AppContext.Provider
      value={{
        profile,
        interactions,
        dailyEdition,
        discoveryItems,
        isLoading,
        colors,
        isDark,
        activeTab,
        setActiveTab,
        selectedArticleId,
        selectedArticle,
        openArticle,
        closeArticle,
        whyModalItem,
        openWhyModal,
        closeWhyModal,
        toggleSaveItem,
        updateReadingProgress,
        setFeedback,
        updateTopicWeight,
        updateDurationPreference,
        setFontSize,
        setThemePreference,
        completeOnboarding,
        resetOnboarding,
        refreshFeed
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
