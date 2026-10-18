import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  NativeSyntheticEvent,
  NativeScrollEvent,
  useWindowDimensions,
  ActivityIndicator,
  Platform,
  TextInput,
  Linking
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TopicTag, FeedItem, DayEditionType, DAY_EDITIONS_META, TOPIC_SPACE_MAP } from '../../core/domain/types';
import { useApp } from '../../core/context/AppContext';
import { Header } from '../../ui/components/Header';
import { DesktopRedditHeader } from '../../ui/components/DesktopRedditHeader';
import { DesktopSidebar } from '../../ui/components/DesktopSidebar';
import { FeedCard } from '../../ui/components/FeedCard';
import { typography, radius, spacing } from '../../ui/theme';
import { ScoredFeedItem, scoreFeedItem, sortFeedForDisplay, FeedSortMode } from '../../core/domain/ranking';
import { Subchannel, defaultSpaceRepository } from '../../core/spaces/spaceRepository';
import { UltraMasterModal } from '../../ui/components/UltraMasterModal';
import { OnTheFlyStreamService } from '../../core/synthesis/onTheFlyStreamService';
import { StreamGenerationProgressModal } from '../../ui/components/StreamGenerationProgressModal';
import { AtmenBreathingPortal } from '../breathing/AtmenBreathingPortal';
import { QuizCheckpointCard } from '../../ui/components/QuizCheckpointCard';
import { generateQuizForArticle } from '../../core/quiz/quizGenerator';
import { HivemindStreamModal } from '../../ui/components/HivemindStreamModal';
import { isFeatureEnabled } from '../../core/modules/featureRegistry';
import { ContinuousLiveNewsService, NewsHubFilterCategory } from '../../core/data/continuousLiveNewsService';
import { NewsHubModal } from '../../ui/components/NewsHubModal';
import { defaultSourceRepository } from '../../core/data/sourceRepository';
import { defaultBatchEditionEnricher } from '../../core/enrichment/batchEnricher';
import { loadAiCredentials } from '../../core/ai/atmenAiClient';
import { feedRepository } from '../../core/data/feedRepository';
import { FeedOperationBanner } from '../../ui/components/FeedOperationBanner';
import { FeedOperationReportModal } from '../../ui/components/FeedOperationReportModal';
import { FeedOperationResult, defaultFeedOperationManager } from '../../core/feed/FeedOperationManager';
import { holdFeedPresentation } from '../../core/feed/feedPresentation';
import { NewsEvolutionModal } from '../../ui/components/NewsEvolutionModal';
import { NewsEvolutionService, NewsEvolutionBriefing } from '../../core/news/newsEvolutionService';

function useReadingStableFeed(items: ScoredFeedItem[], reading: boolean, scope: string): ScoredFeedItem[] {
  const latest = useMemo(() => ({ items, scope }), [items, scope]);
  const [previous, setPrevious] = useState(latest);
  const presented = holdFeedPresentation(previous, latest, reading);
  React.useEffect(() => setPrevious(presented), [presented]);
  return presented.items;
}

export const FeedScreen: React.FC = () => {
  const {
    dailyEdition,
    discoveryItems,
    openWebItems,
    historyItems,
    historySortOrder,
    setHistorySortOrder,
    clearAppearanceHistory,
    recordCardAppearances,
    colors,
    isDark,
    refreshFeed,
    recomputeFeed,
    refreshLiveFeed,
    snapshotSyncInfo,
    activeFeedOption,
    setActiveFeedOption,
    selectedEditionType,
    currentEditionType,
    setSelectedEditionType,
    weatherData,
    profile,
    interactions,
    selectedFilter,
    setSelectedFilter,
    searchQuery,
    setSearchQuery,
    openArticle,
    toggleSaveItem,
    simulateDailyGeneration,
    shuffleFeed,
    updateTopicWeight
  } = useApp();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 960;

  const [sortMode, setSortMode] = useState<FeedSortMode>('hot');
  const [isScrolledDown, setIsScrolledDown] = useState<boolean>(false);
  const scrollYRef = React.useRef<number>(0);
  const [pinnedIds, setPinnedIds] = useState<string[]>(() => defaultFeedOperationManager.getPinnedItemIds());
  const [pendingChangeIds, setPendingChangeIds] = useState<string[]>([]);
  const [lastOperationResult, setLastOperationResult] = useState<FeedOperationResult | null>(null);
  React.useEffect(() => defaultFeedOperationManager.subscribe(result => {
    setLastOperationResult(result);
    setPinnedIds(defaultFeedOperationManager.getPinnedItemIds());
    if (scrollYRef.current > 180) {
      setPendingChangeIds(previous => [...new Set([...previous, ...result.insertedIds, ...result.updatedIds])]);
    }
  }), []);
  React.useEffect(() => {
    if (!isScrolledDown) setPendingChangeIds([]);
  }, [isScrolledDown]);
  const presentationScope = `${activeFeedOption}:${selectedFilter}:${searchQuery}:${sortMode}:${selectedEditionType}`;
  const [visibleDiscoveryCount, setVisibleDiscoveryCount] = useState<number>(10);
  const [visibleInfiniteCount, setVisibleInfiniteCount] = useState<number>(24);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [simulatingDay, setSimulatingDay] = useState<boolean>(false);
  const [simToast, setSimToast] = useState<string | null>(null);
  const [subchannels, setSubchannels] = useState<Subchannel[]>([]);
  const [showMasterModal, setShowMasterModal] = useState<boolean>(false);
  const [isGeneratingPocket, setIsGeneratingPocket] = useState<boolean>(false);
  const [showProgressModal, setShowProgressModal] = useState<boolean>(false);
  const [progressSpaceName, setProgressSpaceName] = useState<string>('');
  const [streamProgress, setStreamProgress] = useState<number>(0);
  const [streamStatusText, setStreamStatusText] = useState<string>('');
  const [streamError, setStreamError] = useState<string | null>(null);
  const [streamFinished, setStreamFinished] = useState<boolean>(false);
  const [showBreathingModal, setShowBreathingModal] = useState<boolean>(false);
  const [showHivemindModal, setShowHivemindModal] = useState<boolean>(false);

  // Live News Hub & Classics State
  const [liveNewsCategory, setLiveNewsCategory] = useState<NewsHubFilterCategory>('all');
  const [liveNewsWindowMode, setLiveNewsWindowMode] = useState<'7d_quality' | '48h_fresh' | 'chronological'>('chronological');
  const [newsSearchQuery, setNewsSearchQuery] = useState<string>('');
  const [liveNewsItems, setLiveNewsItems] = useState<FeedItem[]>([]);
  const [liveNewsLoading, setLiveNewsLoading] = useState<boolean>(false);
  const [liveNewsLimit, setLiveNewsLimit] = useState<number>(40);
  const [showNewsHubSettingsModal, setShowNewsHubSettingsModal] = useState<boolean>(false);
  const [classicsItems, setClassicsItems] = useState<FeedItem[]>([]);
  const [showEvolutionModal, setShowEvolutionModal] = useState<boolean>(false);
  const [evolutionLoading, setEvolutionLoading] = useState<boolean>(false);
  const [evolutionBriefing, setEvolutionBriefing] = useState<NewsEvolutionBriefing | null>(null);

  const handleOpenEvolution = useCallback(async (forceRefresh = false) => {
    setShowEvolutionModal(true);
    if (!evolutionBriefing || forceRefresh) {
      setEvolutionLoading(true);
      try {
        const briefing = await NewsEvolutionService.generateEvolutionBriefing(liveNewsItems, { forceRefresh });
        setEvolutionBriefing(briefing);
      } catch (err) {
        console.warn('News evolution briefing generation failed:', err);
      } finally {
        setEvolutionLoading(false);
      }
    }
  }, [evolutionBriefing, liveNewsItems]);

  // Progressive live news provider updates: when Tagesschau completes in ~200ms, display immediately!
  React.useEffect(() => {
    const unsubscribe = ContinuousLiveNewsService.subscribe(event => {
      if (activeFeedOption === 'live_news' && event.items.length > 0) {
        setLiveNewsItems(event.items);
      }
    });
    return unsubscribe;
  }, [activeFeedOption]);

  const activeTopic: TopicTag | undefined = useMemo(() => {
    if (selectedFilter === 'all') return undefined;
    const sub = subchannels.find(
      s => s.handle.toLowerCase() === selectedFilter.toLowerCase() || s.primaryTopic === selectedFilter
    );
    if (sub?.primaryTopic) return sub.primaryTopic;
    const entry = (Object.entries(TOPIC_SPACE_MAP) as [TopicTag, (typeof TOPIC_SPACE_MAP)[TopicTag]][]).find(
      ([_, meta]) => meta.space.toLowerCase() === selectedFilter.toLowerCase()
    );
    if (entry) return entry[0] as TopicTag;
    if (selectedFilter in profile.explicitInterests) return selectedFilter as TopicTag;
    return OnTheFlyStreamService.inferTopicFromSpace(selectedFilter);
  }, [selectedFilter, subchannels, profile.explicitInterests]);

  const loadLiveNews = useCallback(async (forceRefresh = false) => {
    setLiveNewsLoading(true);
    try {
      const items = await ContinuousLiveNewsService.getLiveStream({
        category: liveNewsCategory,
        query: newsSearchQuery.trim() || undefined,
        limit: liveNewsLimit,
        forceRefresh,
        windowMode: liveNewsWindowMode
      });
      setLiveNewsItems(items);
    } catch {
      // Non-fatal
    } finally {
      setLiveNewsLoading(false);
    }
  }, [liveNewsCategory, newsSearchQuery, liveNewsLimit, liveNewsWindowMode]);

  React.useEffect(() => {
    if (activeFeedOption === 'live_news') {
      void loadLiveNews();
    } else if (activeFeedOption === 'classics') {
      setClassicsItems(ContinuousLiveNewsService.getEvergreenClassics());
    }
  }, [activeFeedOption, loadLiveNews]);

  const matchesSelectedSpace = useCallback((item: FeedItem): boolean => {
    if (selectedFilter === 'all') return true;
    const filterLower = selectedFilter.toLowerCase();
    if (item.space && item.space.toLowerCase() === filterLower) return true;
    if (activeTopic) {
      if (item.primaryTopic === activeTopic || item.topics.includes(activeTopic)) {
        return true;
      }
    }
    const raw = filterLower.replace(/^c\//, '');
    if (raw.length > 2) {
      const hay = `${item.title} ${item.subtitle || ''} ${item.feedText || ''} ${item.primaryTopic} ${item.topics.join(' ')}`.toLowerCase();
      if (hay.includes(raw)) return true;
    }
    return false;
  }, [selectedFilter, activeTopic]);

  const loadSubchannels = useCallback(async () => {
    const all = await defaultSpaceRepository.getAllSpaces();
    setSubchannels(all);
  }, []);

  React.useEffect(() => {
    void loadSubchannels();
  }, [loadSubchannels]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshLiveFeed();
    await loadSubchannels();
    if (activeFeedOption === 'live_news') {
      await loadLiveNews();
    } else if (activeFeedOption === 'classics') {
      setClassicsItems(ContinuousLiveNewsService.getEvergreenClassics());
    }
    setVisibleDiscoveryCount(10);
    setRefreshing(false);
  };

  const handleSimulateToday = async () => {
    setSimulatingDay(true);
    try {
      const res = await simulateDailyGeneration(0);
      setSimToast(`Ausgabe für ${res.simulatedDate} neu durchmischt & Live-Feeds synchronisiert`);
      setTimeout(() => setSimToast(null), 3000);
    } catch {
      setSimToast('Simulation fehlgeschlagen.');
      setTimeout(() => setSimToast(null), 3000);
    } finally {
      setSimulatingDay(false);
    }
  };

  const handleSimulateNextDay = async () => {
    setSimulatingDay(true);
    try {
      const res = await simulateDailyGeneration(1);
      setSimToast(`Nächster Tag simuliert: ${res.simulatedDate} (${res.itemCount} frische Artikel)`);
      setTimeout(() => setSimToast(null), 3500);
    } catch {
      setSimToast('Simulation fehlgeschlagen.');
      setTimeout(() => setSimToast(null), 3000);
    } finally {
      setSimulatingDay(false);
    }
  };

  const handleShuffle = async () => {
    setSimulatingDay(true);
    try {
      const renderedIds = currentFeedItems.slice(0, visibleInfiniteCount).map(i => i.id);
      const res = await shuffleFeed(renderedIds);
      setVisibleInfiniteCount(24);
      setActiveCardIndex(0);
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      if (res?.isPoolExhausted) {
        setSimToast('Fundus vollständig gezeigt · mische aus allen Beiträgen neu');
      } else {
        const toastText = res?.pinnedCount && res.pinnedCount > 0
          ? `${res.freshCount} neue Beiträge, ${res.pinnedCount} angeheftete behalten`
          : `${res.freshCount} neue Beiträge kuratiert`;
        setSimToast(toastText);
      }
      setTimeout(() => setSimToast(null), 2500);
    } catch {
      setSimToast('Mischen fehlgeschlagen.');
      setTimeout(() => setSimToast(null), 2500);
    } finally {
      setSimulatingDay(false);
    }
  };

  const handleGenerateEmptyPocket = async () => {
    const targetSpace = selectedFilter === 'all'
      ? (searchQuery ? `c/${searchQuery.toLowerCase().replace(/[^a-z0-9_]/g, '_')}` : 'c/serendipity')
      : selectedFilter;

    setProgressSpaceName(targetSpace);
    setStreamProgress(10);
    setStreamStatusText('Live-Forschung & Primärquellen abfragen…');
    setStreamError(null);
    setStreamFinished(false);
    setShowProgressModal(true);
    setIsGeneratingPocket(true);

    try {
      await OnTheFlyStreamService.generateStreamForPocket({
        space: targetSpace,
        topic: activeTopic,
        searchTerm: searchQuery.trim() || undefined,
        includeAiSynthesis: false,
        includeMemes: false,
        count: 10,
        onProgress: (p, label) => {
          setStreamProgress(p);
          setStreamStatusText(label);
        }
      });
      setStreamFinished(true);
      await refreshFeed();
      await loadSubchannels();
      if (selectedFilter !== targetSpace) {
        setSelectedFilter(targetSpace);
      }
    } catch (e: any) {
      console.error('Error generating pocket stream:', e);
      setStreamError(e?.message || 'Fehler beim Generieren des Streams.');
    } finally {
      setIsGeneratingPocket(false);
    }
  };

  const handleFilterChange = (filter: string | 'all') => {
    setSelectedFilter(filter);
    setVisibleDiscoveryCount(12);
    setVisibleInfiniteCount(16);
    if (filter !== 'all' && (activeFeedOption === 'live_news' || activeFeedOption === 'classics')) {
      setActiveFeedOption('infinite');
    }
  };

  // Helper to filter items by search query
  const filterByQuery = useCallback((items: ScoredFeedItem[]) => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase().trim();
    return items.filter(item =>
      item.title.toLowerCase().includes(q) ||
      (item.subtitle && item.subtitle.toLowerCase().includes(q)) ||
      (item.feedText && item.feedText.toLowerCase().includes(q)) ||
      (item.sourceReferences[0]?.publisher && item.sourceReferences[0].publisher.toLowerCase().includes(q)) ||
      (item.space && item.space.toLowerCase().includes(q)) ||
      item.topics.some(t => t.toLowerCase().includes(q))
    );
  }, [searchQuery]);

  const latestScoredLiveItems = useMemo(() => {
    let items = liveNewsItems;
    if (newsSearchQuery.trim()) {
      const q = newsSearchQuery.toLowerCase().trim();
      items = items.filter(item =>
        item.title.toLowerCase().includes(q) ||
        (item.subtitle && item.subtitle.toLowerCase().includes(q)) ||
        (item.feedText && item.feedText.toLowerCase().includes(q)) ||
        (item.sourceReferences[0]?.publisher && item.sourceReferences[0].publisher.toLowerCase().includes(q))
      );
    }
    if (liveNewsWindowMode === 'chronological') {
      // In chronological mode, strictly preserve publication timestamp order without user interest re-sorting
      return items.map(item => {
        const scored = scoreFeedItem(item, profile, interactions);
        return {
          ...scored,
          score: 1.0
        };
      });
    }
    return items.map(item => scoreFeedItem(item, profile, interactions));
  }, [liveNewsItems, newsSearchQuery, liveNewsWindowMode, profile, interactions]);
  const scoredLiveItems = useReadingStableFeed(latestScoredLiveItems, isScrolledDown, `${presentationScope}:${liveNewsCategory}:${liveNewsWindowMode}:${newsSearchQuery}`);

  const scoredClassicsItems = useMemo(() => {
    const scored = classicsItems.filter(matchesSelectedSpace).map(item => scoreFeedItem(item, profile, interactions));
    return filterByQuery(scored);
  }, [classicsItems, matchesSelectedSpace, profile, interactions, filterByQuery]);

  // Filter daily edition items
  const filteredDaily = useMemo(() => {
    const spaceFiltered = dailyEdition.filter(matchesSelectedSpace);
    return filterByQuery(spaceFiltered);
  }, [dailyEdition, matchesSelectedSpace, filterByQuery]);

  // Filter discovery pool items
  const filteredDiscovery = useMemo(() => {
    const spaceFiltered = discoveryItems.filter(matchesSelectedSpace);
    return filterByQuery(spaceFiltered);
  }, [discoveryItems, matchesSelectedSpace, filterByQuery]);

  const latestSortedDaily = useMemo(() => sortFeedForDisplay(filteredDaily, sortMode, { pinnedIds }), [filteredDaily, sortMode, pinnedIds]);
  const sortedDaily = useReadingStableFeed(latestSortedDaily, isScrolledDown, presentationScope);
  const latestSortedDiscovery = useMemo(() => {
    const dailyIds = new Set(sortedDaily.map(item => item.id));
    return sortFeedForDisplay(filteredDiscovery.filter(item => !dailyIds.has(item.id)), sortMode, { pinnedIds });
  }, [filteredDiscovery, sortedDaily, sortMode, pinnedIds]);
  const sortedDiscovery = useReadingStableFeed(latestSortedDiscovery, isScrolledDown, presentationScope);

  // OpenWeb harvested candidates scored and filtered
  const scoredOpenWebItems = useMemo(() => {
    return openWebItems.map(item => scoreFeedItem(item, profile, interactions));
  }, [openWebItems, profile, interactions]);

  const filteredOpenWeb = useMemo(() => {
    const spaceFiltered = scoredOpenWebItems.filter(matchesSelectedSpace);
    return filterByQuery(spaceFiltered);
  }, [scoredOpenWebItems, matchesSelectedSpace, filterByQuery]);

  // Combined endless stream with Sliding-Window Bloom-Ranking (never clones IDs)
  const latestInfiniteInterleavedBase = useMemo(() => {
    const combined = [...filteredDaily, ...filteredOpenWeb, ...filteredDiscovery];
    const seen = new Set<string>();
    const unique = combined.filter(item => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
    return sortFeedForDisplay(unique, sortMode, { pinnedIds, interleave: true });
  }, [filteredDaily, filteredOpenWeb, filteredDiscovery, sortMode, pinnedIds]);
  const infiniteInterleavedBase = useReadingStableFeed(latestInfiniteInterleavedBase, isScrolledDown, presentationScope);

  // Evergreen & Archive fallback items when fresh items are exhausted (never recycles cloned IDs)
  const evergreenFallbackItems = useMemo(() => {
    const freshIds = new Set(infiniteInterleavedBase.map(i => i.id));
    const rawClassics = ContinuousLiveNewsService.getEvergreenClassics();
    const scored = rawClassics
      .filter(item => !freshIds.has(item.id))
      .filter(matchesSelectedSpace)
      .map(item => scoreFeedItem(item, profile, interactions));
    return filterByQuery(scored);
  }, [infiniteInterleavedBase, profile, interactions, matchesSelectedSpace, filterByQuery]);

  const renderedInfiniteFreshItems = useMemo(() => {
    return infiniteInterleavedBase.slice(0, Math.min(visibleInfiniteCount, infiniteInterleavedBase.length));
  }, [infiniteInterleavedBase, visibleInfiniteCount]);

  const renderedInfiniteEvergreenItems = useMemo(() => {
    if (visibleInfiniteCount <= infiniteInterleavedBase.length) return [];
    const needed = visibleInfiniteCount - infiniteInterleavedBase.length;
    return evergreenFallbackItems.slice(0, needed);
  }, [infiniteInterleavedBase.length, evergreenFallbackItems, visibleInfiniteCount]);

  const renderedInfiniteItems = useMemo(() => {
    return [...renderedInfiniteFreshItems, ...renderedInfiniteEvergreenItems];
  }, [renderedInfiniteFreshItems, renderedInfiniteEvergreenItems]);

  // Appended discovery items in Daily mode (never clones IDs)
  const renderedDiscovery = useMemo(() => {
    if (sortedDiscovery.length === 0) return [];
    return sortedDiscovery.slice(0, Math.min(visibleDiscoveryCount, sortedDiscovery.length));
  }, [sortedDiscovery, visibleDiscoveryCount]);

  // Combine items into a seamless stream for Daily mode
  const allStreamItems = useMemo(() => {
    return [...sortedDaily, ...renderedDiscovery];
  }, [sortedDaily, renderedDiscovery]);

  // Active items array depending on selected feed option
  const currentFeedItems = useMemo((): ScoredFeedItem[] => {
    if (activeFeedOption === 'infinite') return renderedInfiniteItems;
    if (activeFeedOption === 'daily') return allStreamItems;
    if (activeFeedOption === 'live_news') return scoredLiveItems;
    if (activeFeedOption === 'classics') return scoredClassicsItems;
    if (activeFeedOption === 'history') {
      return historyItems.map(h => scoreFeedItem(h.item, profile, interactions));
    }
    return renderedInfiniteItems;
  }, [activeFeedOption, renderedInfiniteItems, allStreamItems, scoredLiveItems, scoredClassicsItems, historyItems, profile, interactions]);

  // Viewport-Accurate Chronik Tracking: only records cards that have genuinely entered the visible viewport
  const cardLayoutsRef = React.useRef<Record<string, { y: number; height: number }>>({});
  const scrollViewRef = React.useRef<ScrollView>(null);
  const viewportHeightRef = React.useRef<number>(820);
  const recordedViewportIdsRef = React.useRef<Set<string>>(new Set());

  const [curationStage, setCurationStage] = useState<string>('');
  const [showReportModal, setShowReportModal] = useState<boolean>(false);

  const flushVisibleCardsToChronik = useCallback(() => {
    if (activeFeedOption === 'history') return;
    const vTop = scrollYRef.current;
    const vBottom = vTop + viewportHeightRef.current;
    const newlyVisibleIds: string[] = [];

    for (const item of currentFeedItems) {
      if (recordedViewportIdsRef.current.has(item.id)) continue;
      const layout = cardLayoutsRef.current[item.id];
      if (!layout) continue;
      // Card is visible if at least 45px of the card is inside the current viewport window
      const cardTop = layout.y;
      const cardBottom = layout.y + Math.max(layout.height, 80);
      if (cardTop + 45 <= vBottom && cardBottom - 45 >= vTop) {
        recordedViewportIdsRef.current.add(item.id);
        newlyVisibleIds.push(item.id);
      }
    }

    if (newlyVisibleIds.length > 0) {
      void recordCardAppearances(newlyVisibleIds);
    }
  }, [activeFeedOption, currentFeedItems, recordCardAppearances]);

  const handleCardLayout = useCallback((itemId: string, y: number, height: number) => {
    cardLayoutsRef.current[itemId] = { y, height };
    flushVisibleCardsToChronik();
  }, [flushVisibleCardsToChronik]);

  const totalInfiniteAvailable = infiniteInterleavedBase.length + evergreenFallbackItems.length;

  // Seamless infinite mind-scroll listener (triggers next items & flushes viewport Chronik as user scrolls)
  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    scrollYRef.current = contentOffset.y;
    if (layoutMeasurement.height > 0) {
      viewportHeightRef.current = layoutMeasurement.height;
    }

    const isDown = contentOffset.y > 180;
    setIsScrolledDown(isDown);

    flushVisibleCardsToChronik();

    const paddingToBottom = 800;
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom) {
      if (activeFeedOption === 'daily') {
        setVisibleDiscoveryCount(prev => Math.min(prev + 6, Math.max(10, sortedDiscovery.length)));
      }
    }
  }, [activeFeedOption, flushVisibleCardsToChronik, sortedDiscovery.length]);

  const [isCuratingLiveAi, setIsCuratingLiveAi] = useState<boolean>(false);

  const handleLiveAiCurate = async () => {
    if (isCuratingLiveAi) return;
    setIsCuratingLiveAi(true);
    setCurationStage('1/3: Artikelkandidaten prüfen …');
    try {
      const creds = await loadAiCredentials();
      const pool = (renderedInfiniteItems.length > 0 ? renderedInfiniteItems : discoveryItems).slice(0, 15);
      if (pool.length === 0) {
        setSimToast('Keine Artikel im aktuellen Feed-Pool zum Kuratieren gefunden.');
        setTimeout(() => setSimToast(null), 3000);
        return;
      }

      setCurationStage('2/3: Duplikate und Rauschen filtern …');
      const enriched = await defaultBatchEditionEnricher.gatekeepAndEnrichBatch(pool, creds);
      const telemetry = defaultBatchEditionEnricher.getLastBatchReport();

      setCurationStage('3/3: Ergebnisse bewerten und einfügen …');
      if (feedRepository.executeContentOperation) {
        const opResult = await feedRepository.executeContentOperation('ai_curation', enriched, { pinInserted: true, telemetry });
        setLastOperationResult(opResult);
      } else {
        feedRepository.addItems?.(enriched);
      }

      await recomputeFeed();
    } catch (e) {
      console.warn('Live AI Curation failed:', e);
      setSimToast('Fehler bei der Live-KI-Kuration.');
      setTimeout(() => setSimToast(null), 3000);
    } finally {
      setIsCuratingLiveAi(false);
      setCurationStage('');
    }
  };

  const handleLoadMoreDiscovery = () => {
    setVisibleDiscoveryCount(prev => Math.min(prev + 10, sortedDiscovery.length));
  };

  const handleLoadMoreInfinite = () => {
    setVisibleInfiniteCount(prev => Math.min(prev + 12, totalInfiniteAvailable));
  };

  const healthOverview = defaultSourceRepository.getHealthOverview();

  const [activeCardIndex, setActiveCardIndex] = useState<number>(0);
  const [expandedCardIds, setExpandedCardIds] = useState<Record<string, boolean>>({});

  // Reddit Web Keyboard Navigation: j/k to navigate, x for Kurz-Check, Enter to read, s to bookmark
  React.useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === 'j' || e.key === 'J') {
        e.preventDefault();
        setActiveCardIndex(prev => Math.min(prev + 1, Math.max(0, currentFeedItems.length - 1)));
      } else if (e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        setActiveCardIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'x' || e.key === 'X') {
        e.preventDefault();
        const activeItem = currentFeedItems[activeCardIndex];
        if (activeItem) {
          setExpandedCardIds(prev => ({
            ...prev,
            [activeItem.id]: !prev[activeItem.id]
          }));
        }
      } else if (e.key === 'Enter') {
        const activeItem = currentFeedItems[activeCardIndex];
        if (activeItem) {
          e.preventDefault();
          openArticle(activeItem.id);
        }
      } else if (e.key === 's' || e.key === 'S') {
        const activeItem = currentFeedItems[activeCardIndex];
        if (activeItem) {
          e.preventDefault();
          toggleSaveItem(activeItem.id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentFeedItems, activeCardIndex, openArticle, toggleSaveItem]);

  const activeSpaceName = selectedFilter === 'all'
    ? 'Alle Spaces'
    : (subchannels.find(s => s.handle === selectedFilter || s.primaryTopic === selectedFilter)?.handle || selectedFilter);

  const renderSpacePills = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.filterScroll}
    >
      {/* All Spaces Tab */}
      <TouchableOpacity
        onPress={() => handleFilterChange('all')}
        style={[
          styles.spacePill,
          {
            backgroundColor: selectedFilter === 'all' ? colors.accent : colors.surfaceSecondary,
            borderColor: selectedFilter === 'all' ? colors.accent : colors.borderSubtle
          }
        ]}
      >
        <Ionicons
          name="compass-outline"
          size={13}
          color={selectedFilter === 'all' ? '#FFFFFF' : colors.textSecondary}
          style={{ marginRight: 5 }}
        />
        <Text
          style={[
            styles.spacePillText,
            { color: selectedFilter === 'all' ? '#FFFFFF' : colors.textSecondary }
          ]}
        >
          🌟 Alle Spaces
        </Text>
      </TouchableOpacity>

      {/* Subchannels from Space Repository */}
      {subchannels.map(s => {
        const isSelected = selectedFilter === s.handle || selectedFilter === s.primaryTopic;

        return (
          <TouchableOpacity
            key={s.id}
            onPress={() => handleFilterChange(s.handle)}
            style={[
              styles.spacePill,
              {
                backgroundColor: isSelected ? s.accentColor : colors.surfaceSecondary,
                borderColor: isSelected ? s.accentColor : colors.borderSubtle
              }
            ]}
          >
            <Ionicons
              name={(s.icon as any) || 'planet-outline'}
              size={13}
              color={isSelected ? '#FFFFFF' : s.accentColor}
              style={{ marginRight: 5 }}
            />
            <Text
              style={[
                styles.spacePillText,
                { color: isSelected ? '#FFFFFF' : colors.textPrimary }
              ]}
            >
              {s.handle}
            </Text>
          </TouchableOpacity>
        );
      })}

      {/* Persistent "+ Neuer Raum" Button */}
      <TouchableOpacity
        onPress={() => setShowMasterModal(true)}
        style={[
          styles.spacePill,
          {
            backgroundColor: '#F59E0B' + '20',
            borderColor: '#F59E0B'
          }
        ]}
      >
        <Ionicons
          name="add-circle-outline"
          size={13}
          color="#F59E0B"
          style={{ marginRight: 5 }}
        />
        <Text style={[styles.spacePillText, { color: '#F59E0B' }]}>
          + Neuer Raum
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Header: Reddit Desktop Header vs Mobile Header */}
      {isDesktop ? (
        <DesktopRedditHeader
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          activeSpaceName={activeSpaceName}
          selectedFilter={selectedFilter}
          onSelectSpace={handleFilterChange}
        />
      ) : (
        <Header />
      )}

      {/* Mobile Community Space Selector Bar (Only on mobile as global bar) */}
      {!isDesktop && (
        <View style={[styles.filterBarContainer, { backgroundColor: colors.surface, borderBottomColor: colors.borderSubtle }]}>
          <View style={styles.filterBarInner}>
            {renderSpacePills()}
          </View>
        </View>
      )}

      <View style={styles.operationStatusArea} pointerEvents="box-none">
        <View style={styles.operationStatusOverlay} pointerEvents="box-none">
        <FeedOperationBanner
          isRunning={isCuratingLiveAi}
          currentStage={curationStage}
          lastResult={lastOperationResult}
          pendingChangeCount={pendingChangeIds.length}
          isScrolledDown={isScrolledDown}
          onOpenReport={() => setShowReportModal(true)}
          onScrollToTop={() => {
            setPendingChangeIds([]);
            setIsScrolledDown(false);
            scrollViewRef.current?.scrollTo({ y: 0, animated: false });
          }}
          colors={colors}
          isDark={isDark}
        />
        </View>
      </View>

      {/* Main Feed Scroll (Desktop Centered & Two-Column Layout) */}
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
      >
        <View style={[styles.mainLayoutWrapper, isDesktop && styles.desktopLayoutWrapper]}>
          {/* Feed Column (Center) */}
          <View style={[styles.feedColumn, isDesktop && styles.desktopFeedColumn]}>
            {snapshotSyncInfo && (
              <View style={[styles.snapshotSyncBanner, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
                <Ionicons name="sparkles" size={12} color={colors.accent} style={{ marginRight: 6 }} />
                <Text style={[styles.snapshotSyncText, { color: colors.textSecondary }]}>
                  {snapshotSyncInfo}
                </Text>
              </View>
            )}

            {/* 1. Primary Feed Mode Segmented Switcher */}
            <View style={[styles.feedModeSwitcherWrapper, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.feedModeSwitcher}>
                <TouchableOpacity
                  onPress={() => setActiveFeedOption('infinite')}
                  style={[
                    styles.feedModeBtn,
                    activeFeedOption === 'infinite' && { backgroundColor: colors.accentSubtle, borderColor: colors.accent }
                  ]}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: activeFeedOption === 'infinite' }}
                >
                  <Ionicons
                    name="infinite"
                    size={15}
                    color={activeFeedOption === 'infinite' ? colors.accent : colors.textSecondary}
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={[
                      styles.feedModeText,
                      {
                        color: activeFeedOption === 'infinite' ? colors.accent : colors.textPrimary,
                        fontWeight: activeFeedOption === 'infinite' ? '700' : '600'
                      }
                    ]}
                  >
                    ♾️ Endlos-Stream
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setActiveFeedOption('daily')}
                  style={[
                    styles.feedModeBtn,
                    activeFeedOption === 'daily' && { backgroundColor: colors.accentSubtle, borderColor: colors.accent }
                  ]}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: activeFeedOption === 'daily' }}
                >
                  <Ionicons
                    name="newspaper-outline"
                    size={15}
                    color={activeFeedOption === 'daily' ? colors.accent : colors.textSecondary}
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={[
                      styles.feedModeText,
                      {
                        color: activeFeedOption === 'daily' ? colors.accent : colors.textPrimary,
                        fontWeight: activeFeedOption === 'daily' ? '700' : '600'
                      }
                    ]}
                  >
                    🌅 Tagesausgaben
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setActiveFeedOption('history')}
                  style={[
                    styles.feedModeBtn,
                    activeFeedOption === 'history' && { backgroundColor: colors.accentSubtle, borderColor: colors.accent }
                  ]}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: activeFeedOption === 'history' }}
                >
                  <Ionicons
                    name="time-outline"
                    size={15}
                    color={activeFeedOption === 'history' ? colors.accent : colors.textSecondary}
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={[
                      styles.feedModeText,
                      {
                        color: activeFeedOption === 'history' ? colors.accent : colors.textPrimary,
                        fontWeight: activeFeedOption === 'history' ? '700' : '600'
                      }
                    ]}
                  >
                    🕓 Chronik
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setActiveFeedOption('live_news')}
                  style={[
                    styles.feedModeBtn,
                    activeFeedOption === 'live_news' && { backgroundColor: colors.accentSubtle, borderColor: colors.accent }
                  ]}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: activeFeedOption === 'live_news' }}
                >
                  <View style={styles.livePulseDot} />
                  <Text
                    style={[
                      styles.feedModeText,
                      {
                        color: activeFeedOption === 'live_news' ? colors.accent : colors.textPrimary,
                        fontWeight: activeFeedOption === 'live_news' ? '700' : '600'
                      }
                    ]}
                  >
                    ⚡ Live News Hub
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setActiveFeedOption('classics')}
                  style={[
                    styles.feedModeBtn,
                    activeFeedOption === 'classics' && { backgroundColor: colors.accentSubtle, borderColor: colors.accent }
                  ]}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: activeFeedOption === 'classics' }}
                >
                  <Ionicons
                    name="library-outline"
                    size={15}
                    color={activeFeedOption === 'classics' ? colors.accent : colors.textSecondary}
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={[
                      styles.feedModeText,
                      {
                        color: activeFeedOption === 'classics' ? colors.accent : colors.textPrimary,
                        fontWeight: activeFeedOption === 'classics' ? '700' : '600'
                      }
                    ]}
                  >
                    🏛 Klassiker
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </View>

            {/* Global Active Space / Channel Banner */}
            {selectedFilter !== 'all' && (
              <View
                style={[
                  styles.activeFilterBanner,
                  { backgroundColor: colors.surface, borderColor: colors.borderSubtle }
                ]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: colors.accent
                    }}
                  />
                  <Ionicons name="filter" size={14} color={colors.accent} />
                  <Text style={[styles.activeFilterBannerTitle, { color: colors.textPrimary }]}>
                    Kanal aktiv:{' '}
                    <Text style={{ color: colors.accent, fontWeight: '700' }}>
                      {activeSpaceName}
                    </Text>
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleFilterChange('all')}
                  style={[
                    styles.activeFilterBannerReset,
                    { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Filter aufheben"
                >
                  <Ionicons name="close-circle-outline" size={13} color={colors.textSecondary} style={{ marginRight: 4 }} />
                  <Text style={[styles.activeFilterBannerResetText, { color: colors.textSecondary }]}>
                    Alle Spaces
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* MODE: ENDLESS DISCOVERY STREAM */}
            {activeFeedOption === 'infinite' && (
              <>
                {searchQuery.trim().length > 0 && (
                  <View style={[styles.searchNoticeCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
                    <Ionicons name="search" size={14} color={colors.accent} style={{ marginRight: 6 }} />
                    <Text style={[styles.searchNoticeText, { color: colors.textPrimary }]}>
                      Ergebnisse für „{searchQuery}“ ({renderedInfiniteItems.length} Treffer)
                    </Text>
                    <TouchableOpacity onPress={() => setSearchQuery('')} style={{ marginLeft: 'auto' }}>
                      <Text style={[styles.searchNoticeClear, { color: colors.accent }]}>Filter aufheben</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Reddit Sort Filter Bar: Hot, New, Top, Gems */}
                <View style={[styles.sortBar, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
                  <TouchableOpacity
                    onPress={() => setSortMode('hot')}
                    style={[
                      styles.sortTab,
                      sortMode === 'hot' && { backgroundColor: colors.accentSubtle, borderColor: colors.accent }
                    ]}
                  >
                    <Text style={styles.sortEmoji}>🔥</Text>
                    <Text style={[styles.sortTabText, { color: sortMode === 'hot' ? colors.accent : colors.textSecondary }]}>
                      Bloom
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setSortMode('new')}
                    style={[
                      styles.sortTab,
                      sortMode === 'new' && { backgroundColor: colors.accentSubtle, borderColor: colors.accent }
                    ]}
                  >
                    <Text style={styles.sortEmoji}>⚡</Text>
                    <Text style={[styles.sortTabText, { color: sortMode === 'new' ? colors.accent : colors.textSecondary }]}>
                      Neu
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setSortMode('top')}
                    style={[
                      styles.sortTab,
                      sortMode === 'top' && { backgroundColor: colors.accentSubtle, borderColor: colors.accent }
                    ]}
                  >
                    <Text style={styles.sortEmoji}>🏆</Text>
                    <Text style={[styles.sortTabText, { color: sortMode === 'top' ? colors.accent : colors.textSecondary }]}>
                      Top
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setSortMode('gems')}
                    style={[
                      styles.sortTab,
                      sortMode === 'gems' && { backgroundColor: colors.accentSubtle, borderColor: colors.accent }
                    ]}
                  >
                    <Text style={styles.sortEmoji}>💎</Text>
                    <Text style={[styles.sortTabText, { color: sortMode === 'gems' ? colors.accent : colors.textSecondary }]}>
                      Perlen & Kunst
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setShowHivemindModal(true)}
                    style={[
                      styles.sortTab,
                      { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Hivemind Stream generieren"
                  >
                    <Ionicons name="git-network-outline" size={13} color={colors.accent} style={{ marginRight: 4 }} />
                    <Text style={[styles.sortTabText, { color: colors.textPrimary, fontWeight: '700' }]}>
                      + Hivemind
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleLiveAiCurate}
                    disabled={isCuratingLiveAi}
                    style={[
                      styles.sortTab,
                      { backgroundColor: 'rgba(16, 185, 129, 0.12)', borderColor: '#10B981' }
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Live KI-Kuration starten"
                  >
                    {isCuratingLiveAi ? (
                      <ActivityIndicator size="small" color="#10B981" style={{ marginRight: 4 }} />
                    ) : (
                      <Ionicons name="sparkles" size={13} color="#10B981" style={{ marginRight: 4 }} />
                    )}
                    <Text style={[styles.sortTabText, { color: '#10B981', fontWeight: '700' }]}>
                      ✨ Live KI-Kuration
                    </Text>
                  </TouchableOpacity>

                  <View style={styles.sortRightInfo}>
                    <Ionicons name="sparkles-outline" size={13} color={colors.accent} style={{ marginRight: 4 }} />
                    <Text style={[styles.sortInfoText, { color: colors.textMuted }]}>
                      {healthOverview.deliveringCount}/{healthOverview.totalSources} Quellen aktiv
                    </Text>
                  </View>
                </View>

                {/* Subchannel Quick Tuning Header */}
                {selectedFilter !== 'all' && activeTopic && (
                  <View style={[styles.subchannelTuningHeader, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name="funnel-outline" size={14} color={colors.accent} />
                        <Text style={[styles.subchannelTuningTitle, { color: colors.textPrimary }]}>
                          Kanal {selectedFilter}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
                        Relevanz in deinem Feed: {Math.round((profile.derivedWeights?.[activeTopic] ?? profile.explicitInterests[activeTopic] ?? 0.5) * 100)}%
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <TouchableOpacity
                        onPress={() => {
                          const curr = profile.explicitInterests[activeTopic] ?? 0.5;
                          updateTopicWeight(activeTopic, Math.min(1.0, Math.round((curr + 0.15) * 100) / 100));
                          setSimToast(`✓ Fokus auf ${selectedFilter} erhöht!`);
                          setTimeout(() => setSimToast(null), 2000);
                        }}
                        style={[styles.tuningBtn, { backgroundColor: colors.accentSubtle, borderColor: colors.accent }]}
                        accessibilityRole="button"
                        accessibilityLabel="Fokus für dieses Thema erhöhen"
                      >
                        <Ionicons name="arrow-up" size={13} color={colors.accent} style={{ marginRight: 3 }} />
                        <Text style={[styles.tuningBtnText, { color: colors.accent, fontWeight: '700' }]}>+ Fokus</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => {
                          const curr = profile.explicitInterests[activeTopic] ?? 0.5;
                          updateTopicWeight(activeTopic, Math.max(0.1, Math.round((curr - 0.15) * 100) / 100));
                          setSimToast(`✓ Fokus auf ${selectedFilter} verringert.`);
                          setTimeout(() => setSimToast(null), 2000);
                        }}
                        style={[styles.tuningBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}
                        accessibilityRole="button"
                        accessibilityLabel="Fokus für dieses Thema verringern"
                      >
                        <Ionicons name="arrow-down" size={13} color={colors.textMuted} style={{ marginRight: 3 }} />
                        <Text style={[styles.tuningBtnText, { color: colors.textSecondary }]}>- Weniger</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => handleFilterChange('all')}
                        style={[styles.tuningBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}
                        accessibilityRole="button"
                        accessibilityLabel="Alle Spaces anzeigen"
                      >
                        <Text style={[styles.tuningBtnText, { color: colors.textMuted }]}>✕ Alle</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {renderedInfiniteItems.length === 0 ? (
                  <View style={[styles.emptyPocketCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
                    <View style={[styles.emptyPocketBadge, { backgroundColor: colors.accentSubtle }]}>
                      <Ionicons name="sparkles" size={15} color={colors.accent} />
                      <Text style={[styles.emptyPocketBadgeText, { color: colors.accent }]}>
                        Epistemischer Raum • On-the-Fly Entdeckung
                      </Text>
                    </View>

                    <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                      {selectedFilter !== 'all'
                        ? `Raum ${selectedFilter} erschließen`
                        : (searchQuery ? `Erkenntnis-Stream zu „${searchQuery}“ generieren` : 'Neuen Erkenntnis-Stream generieren')}
                    </Text>

                    <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
                      Dieser Wissensraum enthält noch keine kuratierten Beiträge. Du kannst hier auf Knopfdruck eine fundierte Recherche aus offenen Primärquellen (Wikipedia REST, OpenAlex & arXiv) generieren.
                    </Text>

                    <View style={styles.pocketActionsRow}>
                      <TouchableOpacity
                        onPress={handleGenerateEmptyPocket}
                        disabled={isGeneratingPocket}
                        style={[styles.generatePocketButton, { backgroundColor: colors.accent, opacity: isGeneratingPocket ? 0.6 : 1 }]}
                        accessibilityRole="button"
                        accessibilityLabel="Stream jetzt generieren"
                      >
                        <Ionicons name="sparkles" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                        <Text style={styles.generatePocketButtonText}>
                          {isGeneratingPocket ? 'Erschließe Primärquellen…' : 'Raum mit Live-Forschung erschließen'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => {
                          handleFilterChange('all');
                          setSearchQuery('');
                        }}
                        style={[styles.resetFilterButton, { borderColor: colors.borderSubtle }]}
                      >
                        <Text style={[styles.resetFilterButtonText, { color: colors.textMuted }]}>
                          Filter zurücksetzen
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <>
                    {renderedInfiniteFreshItems.map((item, index) => (
                      <View
                        key={item.id}
                        onLayout={(e) => handleCardLayout(item.id, e.nativeEvent.layout.y, e.nativeEvent.layout.height)}
                      >
                        <FeedCard
                          item={item}
                          isHero={index === 0 && selectedFilter === 'all' && !searchQuery}
                          isFocused={index === activeCardIndex}
                          isExpanded={Boolean(expandedCardIds[item.id])}
                          onToggleKurzCheck={() => {
                            setExpandedCardIds(prev => ({
                              ...prev,
                              [item.id]: !prev[item.id]
                            }));
                          }}
                          onInvestigateTopic={(topic) => setSelectedFilter(`c/${topic}`)}
                        />

                        {/* Bloomscrolling Quiz Checkpoint every 3 cards */}
                        {(index + 1) % 3 === 0 && isFeatureEnabled(profile, 'bloomscroll_quizzes') && (
                          <View style={{ marginVertical: spacing.md }}>
                            <QuizCheckpointCard
                              questions={renderedInfiniteFreshItems
                                .slice(Math.max(0, index - 2), index + 1)
                                .map(a => a.quiz || generateQuizForArticle(a))}
                              title={`Wissens-Checkpoint #${Math.floor((index + 1) / 3)}`}
                              subtitle="Überprüfe deine Erkenntnis der letzten 3 Beiträge"
                            />
                          </View>
                        )}
                      </View>
                    ))}

                    {/* Clean Transition to Evergreen / Archive when fresh pool is exhausted */}
                    {renderedInfiniteEvergreenItems.length > 0 && (
                      <>
                        <View style={[styles.streamDividerCard, { backgroundColor: colors.surface, borderColor: '#D97706' }]}>
                          <View style={[styles.sparkleIconBox, { backgroundColor: 'rgba(217, 119, 6, 0.14)' }]}>
                            <Ionicons name="library" size={20} color="#D97706" />
                          </View>
                          <Text style={[styles.streamDividerTitle, { color: colors.textPrimary }]}>
                            Frische Beiträge gelesen • Zeitlose Klassiker & Archiv
                          </Text>
                          <Text style={[styles.streamDividerText, { color: colors.textSecondary }]}>
                            Kein künstliches Recycling bereits gezeigter Karten: Hier geht es nahtlos weiter mit zeitlosen Ur-Essays und Archiv-Schätzen.
                          </Text>
                        </View>

                        {renderedInfiniteEvergreenItems.map((item, idx) => {
                          const globalIdx = renderedInfiniteFreshItems.length + idx;
                          return (
                            <View
                              key={item.id}
                              onLayout={(e) => handleCardLayout(item.id, e.nativeEvent.layout.y, e.nativeEvent.layout.height)}
                            >
                              <FeedCard
                                item={item}
                                isHero={false}
                                isFocused={globalIdx === activeCardIndex}
                                isExpanded={Boolean(expandedCardIds[item.id])}
                                onToggleKurzCheck={() => {
                                  setExpandedCardIds(prev => ({
                                    ...prev,
                                    [item.id]: !prev[item.id]
                                  }));
                                }}
                                onInvestigateTopic={(topic) => setSelectedFilter(`c/${topic}`)}
                              />

                              {/* Bloomscrolling Quiz Checkpoint every 3 cards */}
                              {(idx + 1) % 3 === 0 && isFeatureEnabled(profile, 'bloomscroll_quizzes') && (
                                <View style={{ marginVertical: spacing.md }}>
                                  <QuizCheckpointCard
                                    questions={renderedInfiniteEvergreenItems
                                      .slice(Math.max(0, idx - 2), idx + 1)
                                      .map(a => a.quiz || generateQuizForArticle(a))}
                                    title={`Wissens-Checkpoint #${Math.floor((globalIdx + 1) / 3)}`}
                                    subtitle="Überprüfe deine Erkenntnis der letzten 3 Beiträge"
                                  />
                                </View>
                              )}
                            </View>
                          );
                        })}
                      </>
                    )}

                    {/* End-of-Edition Reflection Gate: Inline Atmen Breathing Portal */}
                    {isFeatureEnabled(profile, 'breathing_portal') && (
                      <View style={{ marginVertical: spacing.lg }}>
                        <AtmenBreathingPortal mode="inline" height={380} />
                      </View>
                    )}

                    {/* Finite Feed Peaceful Ending Card */}
                    <View style={[styles.finiteEndingCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
                      <View style={styles.finiteEndingHeader}>
                        <View style={[styles.finiteEndingIconBox, { backgroundColor: colors.accentSubtle }]}>
                          <Ionicons name="sparkles" size={20} color={colors.accent} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.finiteEndingTitle, { color: colors.textPrimary }]}>
                            🌱 Das war deine Auswahl für jetzt
                          </Text>
                          <Text style={[styles.finiteEndingSubtitle, { color: colors.textSecondary }]}>
                            Du hast {renderedInfiniteItems.length} kuratierte Beiträge erkundet. Ein bewusster Moment zum Innehalten — oder für den nächsten Impuls:
                          </Text>
                        </View>
                      </View>

                      <View style={styles.finiteEndingActionsRow}>
                        <TouchableOpacity
                          onPress={handleShuffle}
                          style={[styles.finiteEndingBtn, { backgroundColor: colors.accent, borderColor: colors.accent }]}
                          accessibilityRole="button"
                          accessibilityLabel="Neuer Mix: 24 frische Beiträge laden"
                        >
                          <Ionicons name="shuffle-outline" size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                          <Text style={[styles.finiteEndingBtnText, { color: '#FFFFFF', fontWeight: '700' }]}>
                            🔄 Neuer Mix
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() => setActiveFeedOption('live_news')}
                          style={[styles.finiteEndingBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}
                          accessibilityRole="button"
                          accessibilityLabel="Zu den aktuellen Live-Nachrichten springen"
                        >
                          <Ionicons name="flash-outline" size={15} color="#F59E0B" style={{ marginRight: 6 }} />
                          <Text style={[styles.finiteEndingBtnText, { color: colors.textPrimary, fontWeight: '600' }]}>
                            ⚡ Zu den aktuellen Nachrichten
                          </Text>
                        </TouchableOpacity>

                        {visibleInfiniteCount < totalInfiniteAvailable ? (
                          <TouchableOpacity
                            onPress={handleLoadMoreInfinite}
                            style={[styles.finiteEndingBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}
                            accessibilityRole="button"
                            accessibilityLabel="12 weitere Beiträge der aktuellen Auswahl anzeigen"
                          >
                            <Ionicons name="arrow-down-circle-outline" size={15} color={colors.accent} style={{ marginRight: 6 }} />
                            <Text style={[styles.finiteEndingBtnText, { color: colors.accent, fontWeight: '600' }]}>
                              ⬇️ 12 weitere anzeigen
                            </Text>
                          </TouchableOpacity>
                        ) : (
                          <View style={[styles.finiteEndingBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle, opacity: 0.75 }]}>
                            <Ionicons name="checkmark-circle-outline" size={15} color={colors.textMuted} style={{ marginRight: 6 }} />
                            <Text style={[styles.finiteEndingBtnText, { color: colors.textMuted, fontWeight: '500' }]}>
                              Alle {totalInfiniteAvailable} Beiträge durchstöbert
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </>
                )}
              </>
            )}

            {/* 2. MODE: LIVE NEWS HUB */}
            {activeFeedOption === 'live_news' && (
              <View style={styles.modeSectionContainer}>
                {/* News Hub Sub-Bar: Ticker headline, refresh button, search & transparent status */}
                <View style={[styles.liveNewsSubBar, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
                  <View style={styles.liveNewsTopRow}>
                    <View style={styles.liveNewsTitleRow}>
                      {(() => {
                        const status = ContinuousLiveNewsService.getNewsStatusInfo();
                        const dotColor = status.fetchStatus === 'live'
                          ? '#10B981'
                          : status.fetchStatus === 'snapshot'
                          ? '#0EA5E9'
                          : status.fetchStatus === 'cached'
                          ? '#F59E0B'
                          : '#94A3B8';
                        return (
                          <>
                            <View style={[styles.liveGreenDot, { backgroundColor: dotColor }]} />
                            <Text style={[styles.liveNewsTitle, { color: colors.textPrimary }]}>
                              Echtzeit-Ticker ({scoredLiveItems.length} Meldungen)
                            </Text>
                            <Text style={[styles.liveNewsLastUpdatedText, { color: colors.textMuted }]}>
                              • {status.statusLabel} • Geprüft: {status.lastFetchTimeFormatted}
                            </Text>
                          </>
                        );
                      })()}
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <TouchableOpacity
                        onPress={() => void handleOpenEvolution()}
                        style={[styles.hubRefreshBtn, { backgroundColor: colors.accentSubtle, borderColor: colors.accent }]}
                        accessibilityRole="button"
                        accessibilityLabel="Was hat sich verändert? Analyse öffnen"
                      >
                        <Ionicons name="compass-outline" size={13} color={colors.accent} style={{ marginRight: 4 }} />
                        <Text style={[styles.hubRefreshBtnText, { color: colors.accent, fontWeight: '700' }]}>
                          🧭 Was hat sich verändert?
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => void loadLiveNews(true)}
                        disabled={liveNewsLoading}
                        style={[styles.hubRefreshBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}
                        accessibilityRole="button"
                        accessibilityLabel="Live-Feeds jetzt aktualisieren"
                      >
                        <Ionicons
                          name={liveNewsLoading ? 'hourglass-outline' : 'refresh'}
                          size={13}
                          color={colors.textPrimary}
                          style={{ marginRight: 4 }}
                        />
                        <Text style={[styles.hubRefreshBtnText, { color: colors.textPrimary }]}>
                          {liveNewsLoading ? 'Lädt…' : '🔄 Aktualisieren'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => setShowNewsHubSettingsModal(true)}
                        style={[styles.hubSettingsBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}
                        accessibilityRole="button"
                        accessibilityLabel="Quellen- und Themen-Setup öffnen"
                      >
                        <Ionicons name="options-outline" size={13} color={colors.accent} style={{ marginRight: 4 }} />
                        <Text style={[styles.hubSettingsBtnText, { color: colors.textPrimary }]}>
                          ⚙️ Setup
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Inline News Search Bar */}
                  <View style={[styles.newsSearchBar, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
                    <Ionicons name="search" size={13} color={colors.textMuted} style={{ marginRight: 6 }} />
                    <TextInput
                      value={newsSearchQuery}
                      onChangeText={setNewsSearchQuery}
                      placeholder="In aktuellen Ticker-Meldungen suchen…"
                      placeholderTextColor={colors.textMuted}
                      style={[styles.newsSearchInput, { color: colors.textPrimary }]}
                      autoCapitalize="none"
                    />
                    {newsSearchQuery.length > 0 && (
                      <TouchableOpacity onPress={() => setNewsSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="close-circle" size={14} color={colors.textMuted} />
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Filter Chips for Live News */}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.liveNewsCategoriesScroll}>
                    {[
                      { id: 'all', label: '🌟 Alle Meldungen' },
                      { id: 'oerr', label: '🛡 Tagesschau & DLF' },
                      { id: 'tech', label: '⚡️ Tech & KI-Grenzen' },
                      { id: 'science', label: '🔬 Wissenschaft' },
                      { id: 'didactic', label: '🏫 Didaktik-Labor' },
                      { id: 'culture', label: '📚 Philosophie & Bücher' }
                    ].map(cat => {
                      const isSelected = liveNewsCategory === cat.id;
                      return (
                        <TouchableOpacity
                          key={cat.id}
                          onPress={() => setLiveNewsCategory(cat.id as NewsHubFilterCategory)}
                          style={[
                            styles.liveNewsCategoryChip,
                            {
                              backgroundColor: isSelected ? colors.accent : colors.surfaceSecondary,
                              borderColor: isSelected ? colors.accent : colors.borderSubtle
                            }
                          ]}
                        >
                          <Text style={[styles.liveNewsCategoryText, { color: isSelected ? '#FFFFFF' : colors.textSecondary }]}>
                            {cat.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  {/* Window Mode Selector */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 4 }}>
                    {[
                      { id: 'chronological' as const, label: '⏱ Chronologisch (Neueste zuerst)' },
                      { id: '48h_fresh' as const, label: '⚡️ 48h Frisch' },
                      { id: '7d_quality' as const, label: '🎯 7-Tage Qualität' }
                    ].map(mode => {
                      const isModeActive = liveNewsWindowMode === mode.id;
                      return (
                        <TouchableOpacity
                          key={mode.id}
                          onPress={() => setLiveNewsWindowMode(mode.id)}
                          style={[
                            styles.liveNewsCategoryChip,
                            {
                              paddingVertical: 3,
                              paddingHorizontal: 8,
                              backgroundColor: isModeActive ? colors.accentSubtle : colors.surfaceSecondary,
                              borderColor: isModeActive ? colors.accent : colors.borderSubtle
                            }
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel={mode.label}
                        >
                          <Text style={[styles.liveNewsCategoryText, { fontSize: 11, color: isModeActive ? colors.accent : colors.textMuted }]}>
                            {mode.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Strict 24h Window Adherence Button */}
                  {liveNewsWindowMode === 'chronological' && scoredLiveItems.length < 5 && (
                    <View style={{ marginTop: 8, padding: 8, borderRadius: 8, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.borderSubtle, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 12, color: colors.textSecondary, flex: 1, marginRight: 8 }}>
                        Im 24-Stunden-Fenster liegen {scoredLiveItems.length} Meldungen vor. Ältere Meldungen laden?
                      </Text>
                      <TouchableOpacity
                        onPress={() => setLiveNewsWindowMode('48h_fresh')}
                        style={{ paddingVertical: 4, paddingHorizontal: 10, borderRadius: 6, backgroundColor: colors.accent }}
                        accessibilityRole="button"
                        accessibilityLabel="Letzte 48 Stunden anzeigen"
                      >
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#FFFFFF' }}>
                          ⚡ Letzte 48 Stunden anzeigen
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* Live News Items */}
                {liveNewsLoading && liveNewsItems.length === 0 ? (
                  <View style={[styles.loadingBox, { backgroundColor: colors.surface }]}>
                    <ActivityIndicator size="large" color={colors.accent} />
                    <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                      Lade verifizierte Echtzeit-Feeds…
                    </Text>
                  </View>
                ) : scoredLiveItems.length === 0 ? (
                  <View style={[styles.emptyPocketCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle, marginTop: 12 }]}>
                    <Ionicons name="radio-outline" size={32} color={colors.accent} style={{ marginBottom: 8 }} />
                    <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                      {selectedFilter !== 'all'
                        ? `Keine aktuellen Ticker-Meldungen in ${activeSpaceName}`
                        : 'Keine Live-Meldungen gefunden'}
                    </Text>
                    <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
                      {selectedFilter !== 'all'
                        ? `Im Echtzeit-Nachrichtenticker liegen gerade keine Meldungen für ${activeSpaceName} vor. Im Wissens-Stream findest du zeitlose Primärtexte und Analysen.`
                        : 'Setze die Filter zurück oder aktualisiere die Live-Feeds.'}
                    </Text>

                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
                      {selectedFilter !== 'all' && (
                        <TouchableOpacity
                          onPress={() => setActiveFeedOption('infinite')}
                          style={[styles.emptyActionBtn, { backgroundColor: colors.accent }]}
                        >
                          <Ionicons name="infinite" size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
                          <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>
                            Zu {activeSpaceName} im Stream
                          </Text>
                        </TouchableOpacity>
                      )}

                      <TouchableOpacity
                        onPress={() => handleFilterChange('all')}
                        style={[styles.emptyActionBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle, borderWidth: 1 }]}
                      >
                        <Ionicons name="refresh" size={14} color={colors.textPrimary} style={{ marginRight: 6 }} />
                        <Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 13 }}>
                          Alle Live-Nachrichten zeigen
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <>
                    {scoredLiveItems.map((item, index) => (
                      <FeedCard
                        key={item.id}
                        item={item}
                        isHero={index === 0 && !searchQuery}
                        isFocused={index === activeCardIndex}
                        isExpanded={Boolean(expandedCardIds[item.id])}
                        onToggleKurzCheck={() => {
                          setExpandedCardIds(prev => ({
                            ...prev,
                            [item.id]: !prev[item.id]
                          }));
                        }}
                        onInvestigateTopic={(topic) => setSelectedFilter(`c/${topic}`)}
                      />
                    ))}

                    <TouchableOpacity
                      onPress={() => setLiveNewsLimit(prev => prev + 20)}
                      disabled={liveNewsLoading}
                      style={[styles.loadMoreLiveBtn, { backgroundColor: colors.surface, borderColor: colors.accent }]}
                    >
                      <Ionicons name="arrow-down-circle-outline" size={16} color={colors.accent} style={{ marginRight: 6 }} />
                      <Text style={[styles.loadMoreLiveText, { color: colors.accent }]}>
                        {liveNewsLoading ? 'Lade weitere Meldungen…' : 'Weitere Live-Meldungen laden (+20)'}
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            )}

            {/* 3. MODE: EVERGREEN CLASSICS & GEMS */}
            {activeFeedOption === 'classics' && (
              <View style={styles.modeSectionContainer}>
                <View style={[styles.classicsNoticeCard, { backgroundColor: colors.surface, borderColor: '#D97706' }]}>
                  <View style={styles.classicsNoticeHeader}>
                    <Ionicons name="library" size={20} color="#D97706" style={{ marginRight: 8 }} />
                    <Text style={[styles.classicsNoticeTitle, { color: colors.textPrimary }]}>
                      Zeitlose Internet-Klassiker & Ur-Essays
                    </Text>
                  </View>
                  <Text style={[styles.classicsNoticeDesc, { color: colors.textSecondary }]}>
                    Gedanken, die auch in 50 Jahren noch Bestand haben. Von Vannevar Bushs Memex (1945) über Claude Shannons Informationstheorie (1948) bis zu Ted Chiangs scharfsinniger KI-Kritik (2023).
                  </Text>
                </View>

                {scoredClassicsItems.map((item, index) => (
                  <FeedCard
                    key={item.id}
                    item={item}
                    isHero={index === 0}
                    isFocused={index === activeCardIndex}
                    isExpanded={Boolean(expandedCardIds[item.id])}
                    onToggleKurzCheck={() => {
                      setExpandedCardIds(prev => ({
                        ...prev,
                        [item.id]: !prev[item.id]
                      }));
                    }}
                    onInvestigateTopic={(topic) => setSelectedFilter(`c/${topic}`)}
                  />
                ))}
              </View>
            )}

            {/* MODE: CHRONIK (HISTORY) */}
            {activeFeedOption === 'history' && (
              <View style={styles.modeSectionContainer}>
                <View style={[styles.historyHeaderCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
                  <View style={styles.historyTopRow}>
                    <View style={styles.historyTitleRow}>
                      <Ionicons name="time" size={20} color={colors.accent} style={{ marginRight: 8 }} />
                      <Text style={[styles.historyMainTitle, { color: colors.textPrimary }]}>
                        Deine Lesereise & Chronik
                      </Text>
                    </View>
                    <View style={styles.historyActionsRow}>
                      <TouchableOpacity
                        onPress={() => setHistorySortOrder(historySortOrder === 'recent' ? 'chronological' : 'recent')}
                        style={[styles.historySortBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}
                        accessibilityRole="button"
                        accessibilityLabel="Sortierung der Chronik ändern"
                      >
                        <Ionicons
                          name={historySortOrder === 'recent' ? 'arrow-down' : 'arrow-up'}
                          size={13}
                          color={colors.accent}
                          style={{ marginRight: 4 }}
                        />
                        <Text style={[styles.historySortBtnText, { color: colors.textPrimary }]}>
                          {historySortOrder === 'recent' ? 'Zuletzt gesehen ⬇️' : 'Chronologisch ⬆️'}
                        </Text>
                      </TouchableOpacity>

                      {historyItems.length > 0 && (
                        <TouchableOpacity
                          onPress={async () => {
                            await clearAppearanceHistory();
                          }}
                          style={[styles.historyClearBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}
                          accessibilityRole="button"
                          accessibilityLabel="Chronik leeren"
                        >
                          <Ionicons name="trash-outline" size={13} color={colors.textMuted} style={{ marginRight: 4 }} />
                          <Text style={[styles.historyClearBtnText, { color: colors.textMuted }]}>
                            Leeren
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                  <Text style={[styles.historySubText, { color: colors.textSecondary }]}>
                    Jeder Beitrag, den du je gesehen hast, bleibt hier dauerhaft erhalten – ohne algorithmische Manipulation ({historyItems.length} gespeicherte Wegmarken).
                  </Text>
                </View>

                {historyItems.length === 0 ? (
                  <View style={[styles.emptyBox, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
                    <Ionicons name="compass-outline" size={36} color={colors.textMuted} style={{ marginBottom: 12 }} />
                    <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                      Noch keine Chronik-Einträge
                    </Text>
                    <Text style={[styles.emptySubtitle, { color: colors.textMuted, textAlign: 'center', marginBottom: 16 }]}>
                      Scrolle durch den Endlos-Stream oder die Tagesausgaben, um deine persönliche Lesereise aufzuzeichnen.
                    </Text>
                    <TouchableOpacity
                      onPress={() => setActiveFeedOption('infinite')}
                      style={[styles.generatePocketButton, { backgroundColor: colors.accent }]}
                    >
                      <Ionicons name="infinite" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                      <Text style={styles.generatePocketButtonText}>Zum Endlos-Stream</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  historyItems.map(({ item, record }, index) => {
                    const seenDate = new Date(record.lastSeenAt || record.firstSeenAt);
                    const formattedDate = seenDate.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
                    const formattedTime = seenDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
                    const scoredItem = scoreFeedItem(item, profile, interactions);
                    return (
                      <View key={`${item.id}-hist-${index}`} style={styles.historyItemWrapper}>
                        <View style={[styles.historyItemBadge, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
                          <Ionicons name="checkmark-circle-outline" size={12} color={colors.accent} style={{ marginRight: 5 }} />
                          <Text style={[styles.historyItemBadgeText, { color: colors.textMuted }]}>
                            Gesehen {formattedDate}, {formattedTime} Uhr • #{record.sequenceNumber} deiner Lesereise
                          </Text>
                        </View>
                        <FeedCard
                          item={scoredItem}
                          isHero={false}
                          isFocused={index === activeCardIndex}
                          isExpanded={Boolean(expandedCardIds[item.id])}
                          onToggleKurzCheck={() => {
                            setExpandedCardIds(prev => ({
                              ...prev,
                              [item.id]: !prev[item.id]
                            }));
                          }}
                          onInvestigateTopic={(topic) => setSelectedFilter(`c/${topic}`)}
                        />
                      </View>
                    );
                  })
                )}
              </View>
            )}

            {/* 4. MODE: DAILY FINITE EDITION (DEFAULT) */}
            {activeFeedOption === 'daily' && (
              <>
                {searchQuery.trim().length > 0 && (
                  <View style={[styles.searchNoticeCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
                    <Ionicons name="search" size={14} color={colors.accent} style={{ marginRight: 6 }} />
                    <Text style={[styles.searchNoticeText, { color: colors.textPrimary }]}>
                      Ergebnisse für „{searchQuery}“ ({allStreamItems.length} Treffer)
                    </Text>
                    <TouchableOpacity onPress={() => setSearchQuery('')} style={{ marginLeft: 'auto' }}>
                      <Text style={[styles.searchNoticeClear, { color: colors.accent }]}>Filter aufheben</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* 3-Editions Bar (Morgen, Mittendrin, Abend) */}
                <View style={[styles.editionsContainer, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
                  <View style={styles.editionsHeaderRow}>
                    <Text style={[styles.editionsTitle, { color: colors.textPrimary }]}>
                      {DAY_EDITIONS_META[selectedEditionType].label}
                    </Text>
                    <Text style={[styles.editionsSubtitle, { color: colors.textMuted }]}>
                      {DAY_EDITIONS_META[selectedEditionType].tagline}
                    </Text>
                  </View>

                  <View style={styles.editionsPillsRow}>
                    {(['morning', 'midday', 'evening'] as DayEditionType[]).map(edition => {
                      const meta = DAY_EDITIONS_META[edition];
                      const isSelected = selectedEditionType === edition;
                      const isCurrent = currentEditionType === edition;
                      return (
                        <TouchableOpacity
                          key={edition}
                          onPress={() => setSelectedEditionType(edition)}
                          style={[
                            styles.editionPill,
                            {
                              backgroundColor: isSelected ? colors.accent : colors.surfaceSecondary,
                              borderColor: isSelected ? colors.accent : colors.borderSubtle
                            }
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel={`Ausgabe ${meta.label} anzeigen`}
                        >
                          <Ionicons
                            name={meta.icon as any}
                            size={14}
                            color={isSelected ? '#FFFFFF' : colors.textPrimary}
                          />
                          <Text
                            style={[
                              styles.editionPillText,
                              {
                                color: isSelected ? '#FFFFFF' : colors.textPrimary,
                                fontWeight: isSelected ? '700' : '600'
                              }
                            ]}
                          >
                            {meta.label}
                          </Text>
                          {isCurrent && (
                            <View style={[styles.currentEditionDot, { backgroundColor: isSelected ? '#FFFFFF' : colors.accent }]} />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Feed-Kurator & Live-Sync Bar */}
                  <View style={[styles.devSimRow, { borderTopColor: colors.borderSubtle }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                      <Ionicons name="sync-outline" size={13} color={colors.accent} style={{ marginRight: 2 }} />
                      <Text style={[styles.devSimDateText, { color: colors.textPrimary, fontWeight: '700' }]}>
                        Quellen-Pool:
                      </Text>
                      <Text style={[styles.devSimDateText, { color: colors.textMuted }]}>
                        {healthOverview.deliveringCount}/{healthOverview.totalSources} aktiv • {healthOverview.totalItems} Beiträge • €0.00
                      </Text>
                    </View>

                    <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                      <TouchableOpacity
                        onPress={handleShuffle}
                        disabled={simulatingDay}
                        style={[styles.devSimPill, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}
                        accessibilityRole="button"
                        accessibilityLabel="Frischen Wind würfeln (Shuffle)"
                      >
                        <Ionicons name="shuffle" size={11} color={colors.accent} style={{ marginRight: 3 }} />
                        <Text style={[styles.devSimPillText, { color: colors.textPrimary }]}>
                          {simulatingDay ? 'Lädt…' : '🔄 Frischer Wind'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={handleSimulateToday}
                        disabled={simulatingDay}
                        style={[styles.devSimPill, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}
                        accessibilityRole="button"
                        accessibilityLabel="Live-Sync & Feeds aktualisieren"
                      >
                        <Ionicons name="refresh" size={11} color={colors.accent} style={{ marginRight: 3 }} />
                        <Text style={[styles.devSimPillText, { color: colors.textPrimary }]}>
                          Live-Sync
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={handleSimulateNextDay}
                        disabled={simulatingDay}
                        style={[styles.devSimPill, { backgroundColor: colors.accentSubtle, borderColor: colors.accent }]}
                        accessibilityRole="button"
                        accessibilityLabel="Nächsten Tag kuratieren"
                      >
                        <Ionicons name="calendar-outline" size={11} color={colors.accent} style={{ marginRight: 3 }} />
                        <Text style={[styles.devSimPillText, { color: colors.accent, fontWeight: '700' }]}>
                          +1 Tag
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                {simToast && (
                  <View style={[styles.simToastContainer, { backgroundColor: colors.accent }]}>
                    <Text style={styles.simToastText}>{simToast}</Text>
                  </View>
                )}

                {/* Open-Meteo Weather Card for Morning Edition (collapses cleanly if weatherData is null) */}
                {selectedEditionType === 'morning' && weatherData && (
                  <View style={[styles.weatherCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
                    <View style={styles.weatherMainRow}>
                      <View style={styles.weatherLeft}>
                        <Ionicons name={weatherData.iconName as any || 'sunny-outline'} size={26} color={colors.accent} />
                        <View style={{ marginLeft: 10 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                            <Text style={[styles.weatherTemp, { color: colors.textPrimary }]}>
                              {Math.round(weatherData.temperatureCelsius)}°C
                            </Text>
                            <Text style={[styles.weatherCity, { color: colors.textSecondary }]}>
                              in {weatherData.locationName}
                            </Text>
                          </View>
                          <Text style={[styles.weatherDesc, { color: colors.textMuted }]}>
                            {weatherData.weatherDescription}{weatherData.practicalNote ? ` • ${weatherData.practicalNote}` : ''}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.weatherSourceTag}>
                        <Ionicons name="shield-checkmark-outline" size={12} color={colors.accent} style={{ marginRight: 4 }} />
                        <Text style={[styles.weatherSourceText, { color: colors.textMuted }]}>
                          Open-Meteo
                        </Text>
                      </View>
                    </View>
                  </View>
                )}

                {/* Reddit Sort Filter Bar: Hot, New, Top, Gems */}
                <View style={[styles.sortBar, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
                  <TouchableOpacity
                    onPress={() => setSortMode('hot')}
                    style={[
                      styles.sortTab,
                      sortMode === 'hot' && { backgroundColor: colors.accentSubtle, borderColor: colors.accent }
                    ]}
                  >
                    <Text style={styles.sortEmoji}>🔥</Text>
                    <Text style={[styles.sortTabText, { color: sortMode === 'hot' ? colors.accent : colors.textSecondary }]}>
                      Bloom
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setSortMode('new')}
                    style={[
                      styles.sortTab,
                      sortMode === 'new' && { backgroundColor: colors.accentSubtle, borderColor: colors.accent }
                    ]}
                  >
                    <Text style={styles.sortEmoji}>⚡</Text>
                    <Text style={[styles.sortTabText, { color: sortMode === 'new' ? colors.accent : colors.textSecondary }]}>
                      Neu
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setSortMode('top')}
                    style={[
                      styles.sortTab,
                      sortMode === 'top' && { backgroundColor: colors.accentSubtle, borderColor: colors.accent }
                    ]}
                  >
                    <Text style={styles.sortEmoji}>🏆</Text>
                    <Text style={[styles.sortTabText, { color: sortMode === 'top' ? colors.accent : colors.textSecondary }]}>
                      Top
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setSortMode('gems')}
                    style={[
                      styles.sortTab,
                      sortMode === 'gems' && { backgroundColor: colors.accentSubtle, borderColor: colors.accent }
                    ]}
                  >
                    <Text style={styles.sortEmoji}>💎</Text>
                    <Text style={[styles.sortTabText, { color: sortMode === 'gems' ? colors.accent : colors.textSecondary }]}>
                      Perlen & Kunst
                    </Text>
                  </TouchableOpacity>

                  <View style={styles.sortRightInfo}>
                    <Ionicons name="sparkles-outline" size={13} color={colors.accent} style={{ marginRight: 4 }} />
                    <Text style={[styles.sortInfoText, { color: colors.textMuted }]}>
                      Kuratierte Ausgabe
                    </Text>
                  </View>
                </View>

                {/* Subchannel Quick Tuning Header */}
                {selectedFilter !== 'all' && activeTopic && (
                  <View style={[styles.subchannelTuningHeader, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name="funnel-outline" size={14} color={colors.accent} />
                        <Text style={[styles.subchannelTuningTitle, { color: colors.textPrimary }]}>
                          Kanal {selectedFilter}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
                        Relevanz in deinem Feed: {Math.round((profile.derivedWeights?.[activeTopic] ?? profile.explicitInterests[activeTopic] ?? 0.5) * 100)}%
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <TouchableOpacity
                        onPress={() => {
                          const curr = profile.explicitInterests[activeTopic] ?? 0.5;
                          updateTopicWeight(activeTopic, Math.min(1.0, Math.round((curr + 0.15) * 100) / 100));
                          setSimToast(`✓ Fokus auf ${selectedFilter} erhöht!`);
                          setTimeout(() => setSimToast(null), 2000);
                        }}
                        style={[styles.tuningBtn, { backgroundColor: colors.accentSubtle, borderColor: colors.accent }]}
                        accessibilityRole="button"
                        accessibilityLabel="Fokus für dieses Thema erhöhen"
                      >
                        <Ionicons name="arrow-up" size={13} color={colors.accent} style={{ marginRight: 3 }} />
                        <Text style={[styles.tuningBtnText, { color: colors.accent, fontWeight: '700' }]}>+ Fokus</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => {
                          const curr = profile.explicitInterests[activeTopic] ?? 0.5;
                          updateTopicWeight(activeTopic, Math.max(0.1, Math.round((curr - 0.15) * 100) / 100));
                          setSimToast(`✓ Fokus auf ${selectedFilter} verringert.`);
                          setTimeout(() => setSimToast(null), 2000);
                        }}
                        style={[styles.tuningBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}
                        accessibilityRole="button"
                        accessibilityLabel="Fokus für dieses Thema verringern"
                      >
                        <Ionicons name="arrow-down" size={13} color={colors.textMuted} style={{ marginRight: 3 }} />
                        <Text style={[styles.tuningBtnText, { color: colors.textSecondary }]}>- Weniger</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => handleFilterChange('all')}
                        style={[styles.tuningBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}
                        accessibilityRole="button"
                        accessibilityLabel="Alle Spaces anzeigen"
                      >
                        <Text style={[styles.tuningBtnText, { color: colors.textMuted }]}>✕ Alle</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

            {allStreamItems.length === 0 ? (
              <View style={[styles.emptyPocketCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
                <View style={[styles.emptyPocketBadge, { backgroundColor: colors.accentSubtle }]}>
                  <Ionicons name="sparkles" size={15} color={colors.accent} />
                  <Text style={[styles.emptyPocketBadgeText, { color: colors.accent }]}>
                    Epistemischer Raum • On-the-Fly Entdeckung
                  </Text>
                </View>

                <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                  {selectedFilter !== 'all'
                    ? `Raum ${selectedFilter} erschließen`
                    : (searchQuery ? `Erkenntnis-Stream zu „${searchQuery}“ generieren` : 'Neuen Erkenntnis-Stream generieren')}
                </Text>

                <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
                  Dieser Wissensraum enthält noch keine kuratierten Beiträge. Du kannst hier auf Knopfdruck eine fundierte Recherche, eine dialektische KI-Synthese (mit sichtbarem Banner), menschliche Memes und Kanon-Literatur generieren — und direkt im Bibliotheka-Archiv speichern.
                </Text>

                <View style={styles.pocketFeaturesRow}>
                  <View style={[styles.pocketFeaturePill, { backgroundColor: colors.surfaceSecondary }]}>
                    <Text style={styles.pocketFeatureEmoji}>🔬</Text>
                    <Text style={[styles.pocketFeatureText, { color: colors.textSecondary }]}>Wissenschaft & Quellen</Text>
                  </View>
                  <View style={[styles.pocketFeaturePill, { backgroundColor: colors.surfaceSecondary }]}>
                    <Text style={styles.pocketFeatureEmoji}>🤖</Text>
                    <Text style={[styles.pocketFeatureText, { color: colors.textSecondary }]}>KI-Synthese Banner</Text>
                  </View>
                  <View style={[styles.pocketFeaturePill, { backgroundColor: colors.surfaceSecondary }]}>
                    <Text style={styles.pocketFeatureEmoji}>🎭</Text>
                    <Text style={[styles.pocketFeatureText, { color: colors.textSecondary }]}>Menschliche Memes</Text>
                  </View>
                  <View style={[styles.pocketFeaturePill, { backgroundColor: colors.surfaceSecondary }]}>
                    <Text style={styles.pocketFeatureEmoji}>🏛</Text>
                    <Text style={[styles.pocketFeatureText, { color: colors.textSecondary }]}>Bibliotheka-Archiv</Text>
                  </View>
                </View>

                <View style={styles.pocketActionsRow}>
                  <TouchableOpacity
                    onPress={handleGenerateEmptyPocket}
                    disabled={isGeneratingPocket}
                    style={[
                      styles.generatePocketButton,
                      { backgroundColor: colors.accent, opacity: isGeneratingPocket ? 0.7 : 1 }
                    ]}
                  >
                    <Ionicons
                      name={isGeneratingPocket ? 'hourglass-outline' : 'flash-outline'}
                      size={16}
                      color="#FFFFFF"
                      style={{ marginRight: 6 }}
                    />
                    <Text style={styles.generatePocketButtonText}>
                      {isGeneratingPocket ? 'Recherchiere & synthetisiere Stream…' : '⚡ Stream on-the-fly generieren'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      setSelectedFilter('all');
                      setSearchQuery('');
                    }}
                    style={[styles.resetFilterButton, { borderColor: colors.borderSubtle }]}
                  >
                    <Text style={[styles.resetFilterButtonText, { color: colors.textMuted }]}>Alle Spaces anzeigen</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <>
                {/* Daily Edition Primary Items */}
                {sortedDaily.map((item, index) => (
                  <View
                    key={item.id}
                    onLayout={(e) => handleCardLayout(item.id, e.nativeEvent.layout.y, e.nativeEvent.layout.height)}
                  >
                    <FeedCard
                      item={item}
                      isHero={index === 0 && selectedFilter === 'all' && !searchQuery}
                      isFocused={index === activeCardIndex}
                      isExpanded={Boolean(expandedCardIds[item.id])}
                      onToggleKurzCheck={() => {
                        setExpandedCardIds(prev => ({
                          ...prev,
                          [item.id]: !prev[item.id]
                        }));
                      }}
                      onInvestigateTopic={(topic) => setSelectedFilter(`c/${topic}`)}
                    />

                    {/* Bloomscrolling Quiz Checkpoint every 3 cards */}
                    {(index + 1) % 3 === 0 && isFeatureEnabled(profile, 'bloomscroll_quizzes') && (
                      <View style={{ marginVertical: spacing.md }}>
                        <QuizCheckpointCard
                          questions={sortedDaily
                            .slice(Math.max(0, index - 2), index + 1)
                            .map(a => a.quiz || generateQuizForArticle(a))}
                          title={`Tagesausgabe: Wissens-Checkpoint #${Math.floor((index + 1) / 3)}`}
                          subtitle="Überprüfe deine Erkenntnis der letzten 3 Beiträge"
                        />
                      </View>
                    )}
                  </View>
                ))}

                {/* Transition Milestone between Daily Edition and Discovery Pool */}
                {sortedDaily.length > 0 && renderedDiscovery.length > 0 && (
                  <View style={[styles.streamDividerCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
                    <View style={[styles.sparkleIconBox, { backgroundColor: colors.accentSubtle }]}>
                      <Ionicons name="sparkles" size={20} color={colors.accent} />
                    </View>
                    <Text style={[styles.streamDividerTitle, { color: colors.textPrimary }]}>
                      Tagesausgabe abgeschlossen
                    </Text>
                    <Text style={[styles.streamDividerText, { color: colors.textSecondary }]}>
                      Hier beginnt der endlose Mind-Scroll. Entdecke tiefer gehende Recherchen, Gegenpositionen und Praxis-Impulse.
                    </Text>
                  </View>
                )}

                {/* Appended Discovery Items */}
                {renderedDiscovery.map((item, index) => {
                  const globalIndex = sortedDaily.length + index;
                  return (
                    <View
                      key={item.id}
                      onLayout={(e) => handleCardLayout(item.id, e.nativeEvent.layout.y, e.nativeEvent.layout.height)}
                    >
                      <FeedCard
                        item={item}
                        isHero={false}
                        isFocused={globalIndex === activeCardIndex}
                        isExpanded={Boolean(expandedCardIds[item.id])}
                        onToggleKurzCheck={() => {
                          setExpandedCardIds(prev => ({
                            ...prev,
                            [item.id]: !prev[item.id]
                          }));
                        }}
                        onInvestigateTopic={(topic) => setSelectedFilter(`c/${topic}`)}
                      />

                      {/* Bloomscrolling Quiz Checkpoint every 3 cards */}
                      {(index + 1) % 3 === 0 && isFeatureEnabled(profile, 'bloomscroll_quizzes') && (
                        <View style={{ marginVertical: spacing.md }}>
                          <QuizCheckpointCard
                            questions={renderedDiscovery
                              .slice(Math.max(0, index - 2), index + 1)
                              .map(a => a.quiz || generateQuizForArticle(a))}
                            title={`Discovery: Wissens-Checkpoint #${Math.floor((index + 1) / 3)}`}
                            subtitle="Überprüfe deine Erkenntnis der letzten 3 Beiträge"
                          />
                        </View>
                      )}
                    </View>
                  );
                })}

                {/* End-of-Edition Reflection Gate: Inline Atmen Breathing Portal */}
                {isFeatureEnabled(profile, 'breathing_portal') && (
                  <View style={{ marginVertical: spacing.lg }}>
                    <AtmenBreathingPortal mode="inline" height={380} />
                  </View>
                )}

                {/* End of Section / Conscious Discovery Trigger */}
                {visibleDiscoveryCount < sortedDiscovery.length ? (
                  <TouchableOpacity
                    onPress={handleLoadMoreDiscovery}
                    style={[styles.loadMoreButton, { borderColor: colors.accent, backgroundColor: colors.surface }]}
                  >
                    <Ionicons name="compass-outline" size={18} color={colors.accent} style={{ marginRight: 6 }} />
                    <Text style={[styles.loadMoreButtonText, { color: colors.accent }]}>
                      Weiter entdecken (+10 Beiträge)
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <View style={[styles.loadMoreButton, { borderColor: colors.borderSubtle, backgroundColor: colors.surfaceSecondary, opacity: 0.85 }]}>
                    <Ionicons name="checkmark-circle-outline" size={18} color={colors.textMuted} style={{ marginRight: 6 }} />
                    <Text style={[styles.loadMoreButtonText, { color: colors.textMuted }]}>
                      Alle verfügbaren Beiträge dieser Ausgabe gelesen
                    </Text>
                  </View>
                )}
              </>
            )}
            </>
          )}
          </View>

          {/* Right Column: Sticky Desktop Community Sidebar */}
          {isDesktop && (
            <View style={styles.desktopSidebarColumn}>
              <DesktopSidebar
                articleCount={infiniteInterleavedBase.length}
                selectedTopicFilter={selectedFilter}
                onSelectTopicFilter={handleFilterChange}
              />
            </View>
          )}
        </View>
      </ScrollView>

      {/* Ultra Master Studio Modal */}
      <UltraMasterModal
        visible={showMasterModal}
        onClose={() => {
          setShowMasterModal(false);
          void loadSubchannels();
        }}
      />

      {/* Epistemic On-The-Fly Stream Progress Modal */}
      <StreamGenerationProgressModal
        visible={showProgressModal}
        spaceName={progressSpaceName}
        progress={streamProgress}
        statusMessage={streamStatusText}
        isFinished={streamFinished}
        error={streamError}
        onCompleted={() => setShowProgressModal(false)}
        onCancel={() => setShowProgressModal(false)}
      />

      {/* Atmen Breathing Portal Modal */}
      <AtmenBreathingPortal
        visible={showBreathingModal}
        onClose={() => setShowBreathingModal(false)}
        mode="modal"
      />

      {/* Hivemind Epistemic Stream Modal */}
      <HivemindStreamModal
        visible={showHivemindModal}
        onClose={() => setShowHivemindModal(false)}
      />

      {/* News-Hub Sources, Gatherer & Settings Modal */}
      <NewsHubModal
        visible={showNewsHubSettingsModal}
        onClose={() => {
          setShowNewsHubSettingsModal(false);
          void loadLiveNews();
        }}
      />

      {/* News Evolution 3-Point Briefing Modal */}
      <NewsEvolutionModal
        visible={showEvolutionModal}
        onClose={() => setShowEvolutionModal(false)}
        briefing={evolutionBriefing}
        loading={evolutionLoading}
        onRefresh={() => void handleOpenEvolution(true)}
        onOpenArticle={(urlOrId) => {
          setShowEvolutionModal(false);
          if (urlOrId.startsWith('http')) {
            void Linking.openURL(urlOrId).catch(() => {});
          } else {
            void openArticle(urlOrId);
          }
        }}
        colors={colors}
        isDark={isDark}
      />

      {/* Inspectable Curation Operation Telemetry Modal */}
      <FeedOperationReportModal
        visible={showReportModal}
        onClose={() => setShowReportModal(false)}
        result={lastOperationResult}
        colors={colors}
        isDark={isDark}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  operationStatusArea: {
    width: '100%',
    maxWidth: 780,
    alignSelf: 'center',
    height: 0,
    zIndex: 20
  },
  operationStatusOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0
  },
  filterBarContainer: {
    borderBottomWidth: 0.5,
    paddingVertical: spacing.xs
  },
  filterBarInner: {
    width: '100%',
    alignSelf: 'center',
    maxWidth: 780,
    paddingHorizontal: spacing.pageHorizontal
  },
  desktopSpaceCard: {
    borderRadius: radius.md,
    borderWidth: 0.5,
    paddingVertical: 8,
    paddingHorizontal: 8,
    marginBottom: spacing.sm
  },
  filterScroll: {
    gap: 8,
    alignItems: 'center',
    paddingVertical: 2
  },
  spacePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 0.5
  },
  spacePillText: {
    fontSize: typography.sizes.caption,
    fontWeight: '700'
  },
  scrollContent: {
    paddingHorizontal: spacing.pageHorizontal,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl
  },
  mainLayoutWrapper: {
    width: '100%',
    alignSelf: 'center',
    maxWidth: 780
  },
  desktopLayoutWrapper: {
    maxWidth: 1140,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 24
  },
  feedColumn: {
    width: '100%'
  },
  desktopFeedColumn: {
    flex: 1,
    maxWidth: 760
  },
  desktopSidebarColumn: {
    width: 310
  },
  searchNoticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 0.5,
    marginBottom: spacing.md
  },
  searchNoticeText: {
    fontSize: typography.sizes.caption,
    fontWeight: '600'
  },
  searchNoticeClear: {
    fontSize: typography.sizes.caption,
    fontWeight: '700'
  },
  emptyPocketCard: {
    padding: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    marginVertical: spacing.xl
  },
  emptyPocketBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.pill,
    marginBottom: spacing.md,
    gap: 6
  },
  emptyPocketBadgeText: {
    fontSize: 12,
    fontWeight: '700'
  },
  emptyTitle: {
    fontSize: typography.sizes.title2,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center'
  },
  emptySubtitle: {
    fontSize: typography.sizes.bodySmall,
    textAlign: 'center',
    marginBottom: spacing.md,
    maxWidth: 520,
    lineHeight: 20
  },
  pocketFeaturesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginVertical: spacing.md
  },
  pocketFeaturePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.md,
    gap: 6
  },
  pocketFeatureEmoji: {
    fontSize: 13
  },
  pocketFeatureText: {
    fontSize: 12,
    fontWeight: '600'
  },
  pocketActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: spacing.sm,
    flexWrap: 'wrap',
    justifyContent: 'center'
  },
  generatePocketButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: radius.pill
  },
  generatePocketButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700'
  },
  resetFilterButton: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: radius.pill,
    borderWidth: 1
  },
  resetFilterButtonText: {
    fontSize: 13,
    fontWeight: '600'
  },
  emptyBox: {
    padding: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    marginVertical: spacing.xl
  },
  emptyButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.pill
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: typography.sizes.caption,
    fontWeight: '600'
  },
  milestoneCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 0.5,
    marginVertical: spacing.md
  },
  milestoneTitle: {
    fontSize: 13,
    fontWeight: '700'
  },
  milestoneSubtitle: {
    fontSize: 11,
    marginTop: 2
  },
  streamDividerCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    alignItems: 'center',
    textAlign: 'center',
    marginVertical: spacing.lg
  },
  sparkleIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8
  },
  streamDividerTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4
  },
  streamDividerText: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    maxWidth: 480
  },
  loadMoreButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    marginVertical: spacing.md
  },
  loadMoreButtonText: {
    fontSize: typography.sizes.bodySmall,
    fontWeight: '700'
  },
  allReadBanner: {
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 0.5,
    alignItems: 'center',
    marginVertical: spacing.lg
  },
  allReadTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4
  },
  allReadSubtitle: {
    fontSize: 12,
    textAlign: 'center',
    maxWidth: 420
  },
  sortBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 6,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.md,
    gap: 6,
    flexWrap: 'wrap'
  },
  sortTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'transparent',
    gap: 5
  },
  sortEmoji: {
    fontSize: 13
  },
  sortTabText: {
    fontSize: 12,
    fontWeight: '700'
  },
  sortRightInfo: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 6
  },
  sortInfoText: {
    fontSize: 11,
    fontWeight: '500'
  },
  feedModeSwitcherWrapper: {
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.md,
    overflow: 'hidden'
  },
  feedModeSwitcher: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
    gap: 4
  },
  feedModeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'transparent'
  },
  feedModeText: {
    fontSize: 13
  },
  livePulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10B981',
    marginRight: 6
  },
  liveGreenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 8
  },
  modeSectionContainer: {
    gap: spacing.md,
    marginBottom: spacing.xl
  },
  liveNewsSubBar: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.sm
  },
  liveNewsTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8
  },
  liveNewsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  liveNewsTitle: {
    fontSize: 14,
    fontWeight: '700'
  },
  liveNewsLastUpdatedText: {
    fontSize: 11,
    marginLeft: 6
  },
  hubRefreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1
  },
  hubRefreshBtnText: {
    fontSize: 12,
    fontWeight: '700'
  },
  historyHeaderCard: {
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.xs
  },
  historyTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8
  },
  historyTitleRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  historyMainTitle: {
    fontSize: 16,
    fontWeight: '700'
  },
  historyActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  historySortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1
  },
  historySortBtnText: {
    fontSize: 12,
    fontWeight: '600'
  },
  historyClearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1
  },
  historyClearBtnText: {
    fontSize: 12,
    fontWeight: '600'
  },
  historySubText: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4
  },
  historyItemWrapper: {
    marginBottom: spacing.sm
  },
  historyItemBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 0.5,
    marginBottom: 6,
    marginLeft: 4
  },
  historyItemBadgeText: {
    fontSize: 11,
    fontWeight: '600'
  },
  hubSettingsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1
  },
  hubSettingsBtnText: {
    fontSize: 12,
    fontWeight: '600'
  },
  liveNewsCategoriesScroll: {
    flexDirection: 'row',
    marginTop: 4
  },
  liveNewsCategoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    marginRight: 8
  },
  liveNewsCategoryText: {
    fontSize: 12,
    fontWeight: '600'
  },
  loadingBox: {
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    gap: spacing.sm
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '500'
  },
  loadMoreLiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: spacing.xs
  },
  loadMoreLiveText: {
    fontSize: 14,
    fontWeight: '700'
  },
  classicsNoticeCard: {
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.xs
  },
  classicsNoticeHeader: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  classicsNoticeTitle: {
    fontSize: 16,
    fontWeight: '700'
  },
  classicsNoticeDesc: {
    fontSize: 13,
    lineHeight: 19
  },
  editionsContainer: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm
  },
  editionsHeaderRow: {
    marginBottom: spacing.sm
  },
  editionsTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2
  },
  editionsSubtitle: {
    fontSize: 12,
    marginTop: 2
  },
  editionsPillsRow: {
    flexDirection: 'row',
    gap: 8
  },
  editionPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: radius.sm,
    borderWidth: 1,
    gap: 5
  },
  editionPillIcon: {
    fontSize: 14
  },
  editionPillText: {
    fontSize: 12
  },
  currentEditionDot: {
    width: 5,
    height: 5,
    borderRadius: 3
  },
  weatherCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm
  },
  weatherMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  weatherLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  weatherEmoji: {
    fontSize: 26
  },
  weatherTemp: {
    fontSize: 18,
    fontWeight: '800'
  },
  weatherCity: {
    fontSize: 13,
    marginLeft: 6
  },
  weatherDesc: {
    fontSize: 12,
    marginTop: 2
  },
  weatherSourceTag: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  weatherSourceText: {
    fontSize: 11
  },
  devSimRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    marginTop: 8,
    borderTopWidth: 0.5
  },
  devSimDateText: {
    fontSize: 11,
    fontWeight: '600'
  },
  devSimPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 0.5
  },
  devSimPillText: {
    fontSize: 10
  },
  simToastContainer: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.pill,
    zIndex: 999
  },
  simToastText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700'
  },
  subchannelTuningHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: 10
  },
  subchannelTuningTitle: {
    fontSize: 13,
    fontWeight: '700'
  },
  tuningBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1
  },
  tuningBtnText: {
    fontSize: 11
  },
  activeFilterBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.sm
  },
  activeFilterBannerTitle: {
    fontSize: 13,
    fontWeight: '600'
  },
  activeFilterBannerReset: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1
  },
  activeFilterBannerResetText: {
    fontSize: 11,
    fontWeight: '600'
  },
  emptyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.md
  },
  snapshotSyncBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    marginBottom: spacing.sm,
    alignSelf: 'center'
  },
  snapshotSyncText: {
    fontSize: 12,
    fontWeight: '600'
  },
  newsSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: 4
  },
  newsSearchInput: {
    flex: 1,
    fontSize: 12,
    padding: 0
  },
  finiteEndingCard: {
    padding: 20,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginTop: 16,
    marginBottom: 24,
    gap: 16
  },
  finiteEndingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14
  },
  finiteEndingIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center'
  },
  finiteEndingTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4
  },
  finiteEndingSubtitle: {
    fontSize: 13,
    lineHeight: 18
  },
  finiteEndingActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10
  },
  finiteEndingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1
  },
  finiteEndingBtnText: {
    fontSize: 13
  }
});
