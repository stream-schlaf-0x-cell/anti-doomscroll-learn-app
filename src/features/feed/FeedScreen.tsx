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
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TopicTag, FeedItem, DayEditionType, DAY_EDITIONS_META } from '../../core/domain/types';
import { useApp } from '../../core/context/AppContext';
import { Header } from '../../ui/components/Header';
import { DesktopRedditHeader } from '../../ui/components/DesktopRedditHeader';
import { DesktopSidebar } from '../../ui/components/DesktopSidebar';
import { FeedCard } from '../../ui/components/FeedCard';
import { typography, radius, spacing } from '../../ui/theme';
import { ScoredFeedItem, scoreFeedItem } from '../../core/domain/ranking';
import { Subchannel, defaultSpaceRepository } from '../../core/spaces/spaceRepository';
import { UltraMasterModal } from '../../ui/components/UltraMasterModal';
import { OnTheFlyStreamService } from '../../core/synthesis/onTheFlyStreamService';
import { StreamGenerationProgressModal } from '../../ui/components/StreamGenerationProgressModal';
import { AtemBreathingModal } from '../../ui/components/AtemBreathingModal';
import { ContinuousLiveNewsService, NewsHubFilterCategory } from '../../core/data/continuousLiveNewsService';
import { NewsHubModal } from '../../ui/components/NewsHubModal';

export const FeedScreen: React.FC = () => {
  const {
    dailyEdition,
    discoveryItems,
    colors,
    refreshFeed,
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
    setSearchQuery
  } = useApp();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 960;

  type SortMode = 'hot' | 'new' | 'top' | 'gems';
  const [sortMode, setSortMode] = useState<SortMode>('hot');
  const [visibleDiscoveryCount, setVisibleDiscoveryCount] = useState<number>(10);
  const [refreshing, setRefreshing] = useState<boolean>(false);
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

  // Live News Hub & Classics State
  const [liveNewsCategory, setLiveNewsCategory] = useState<NewsHubFilterCategory>('all');
  const [liveNewsItems, setLiveNewsItems] = useState<FeedItem[]>([]);
  const [liveNewsLoading, setLiveNewsLoading] = useState<boolean>(false);
  const [liveNewsLimit, setLiveNewsLimit] = useState<number>(25);
  const [showNewsHubSettingsModal, setShowNewsHubSettingsModal] = useState<boolean>(false);
  const [classicsItems, setClassicsItems] = useState<FeedItem[]>([]);

  const loadLiveNews = useCallback(async () => {
    setLiveNewsLoading(true);
    try {
      const items = await ContinuousLiveNewsService.getLiveStream({
        category: liveNewsCategory,
        query: searchQuery,
        limit: liveNewsLimit
      });
      setLiveNewsItems(items);
    } catch {
      // Non-fatal
    } finally {
      setLiveNewsLoading(false);
    }
  }, [liveNewsCategory, searchQuery, liveNewsLimit]);

  React.useEffect(() => {
    if (activeFeedOption === 'live_news') {
      void loadLiveNews();
    } else if (activeFeedOption === 'classics') {
      setClassicsItems(ContinuousLiveNewsService.getEvergreenClassics());
    }
  }, [activeFeedOption, loadLiveNews]);

  const scoredLiveItems = useMemo(() => {
    return liveNewsItems.map(item => scoreFeedItem(item, profile, interactions));
  }, [liveNewsItems, profile, interactions]);

  const scoredClassicsItems = useMemo(() => {
    return classicsItems.map(item => scoreFeedItem(item, profile, interactions));
  }, [classicsItems, profile, interactions]);

  const loadSubchannels = useCallback(async () => {
    const all = await defaultSpaceRepository.getAllSpaces();
    setSubchannels(all);
  }, []);


  React.useEffect(() => {
    void loadSubchannels();
  }, [loadSubchannels]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshFeed();
    await loadSubchannels();
    if (activeFeedOption === 'live_news') {
      await loadLiveNews();
    } else if (activeFeedOption === 'classics') {
      setClassicsItems(ContinuousLiveNewsService.getEvergreenClassics());
    }
    setVisibleDiscoveryCount(10);
    setRefreshing(false);
  };

  const handleGenerateEmptyPocket = async () => {
    const targetSpace = selectedFilter === 'all'
      ? (searchQuery ? `c/${searchQuery.toLowerCase().replace(/[^a-z0-9_]/g, '_')}` : 'c/persoenlicher_focus')
      : selectedFilter;

    setProgressSpaceName(targetSpace);
    setStreamProgress(5);
    setStreamStatusText('Recherche vorbereiten…');
    setStreamError(null);
    setStreamFinished(false);
    setShowProgressModal(true);
    setIsGeneratingPocket(true);

    try {
      await OnTheFlyStreamService.generateStreamForPocket({
        space: targetSpace,
        includeAiSynthesis: true,
        includeMemes: true,
        count: 4,
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
    setVisibleDiscoveryCount(10);
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

  // Filter daily edition items
  const filteredDaily = useMemo(() => {
    const spaceFiltered = selectedFilter === 'all'
      ? dailyEdition
      : dailyEdition.filter(item => {
          if (selectedFilter.startsWith('c/')) {
            const raw = selectedFilter.slice(2).toLowerCase();
            const matchesSpace = item.space?.toLowerCase() === selectedFilter.toLowerCase();
            const matchesTopic = item.primaryTopic?.toLowerCase().includes(raw) || item.topics.some(t => t.toLowerCase().includes(raw));
            const matchesSingularity = (raw.includes('singularity') || raw.includes('beschleunigung') || raw.includes('ai')) && (item.primaryTopic === 'ai_apple' || item.topics.includes('ai_apple'));
            const matchesDidaktik = raw.includes('didaktik') && (item.primaryTopic === 'german_didactics' || item.topics.includes('german_didactics'));
            const matchesKlang = (raw.includes('klang') || raw.includes('musik')) && (item.primaryTopic === 'sound_synthesis' || item.topics.includes('sound_synthesis'));
            const matchesPhil = raw.includes('philosoph') && (item.primaryTopic === 'philosophy_ethics' || item.topics.includes('philosophy_ethics'));
            const matchesWiss = raw.includes('wiss') && (item.primaryTopic === 'science_society' || item.topics.includes('science_society'));
            const matchesBuch = (raw.includes('buch') || raw.includes('buecher')) && (item.primaryTopic === 'book_mastery' || item.topics.includes('book_mastery'));
            const matchesYT = (raw.includes('youtube') || raw.includes('video')) && (item.primaryTopic === 'youtube_gems' || item.topics.includes('youtube_gems'));
            const matchesMeme = (raw.includes('meme') || raw.includes('satire')) && (item.primaryTopic === 'memes_satire' || item.topics.includes('memes_satire'));
            return matchesSpace || matchesTopic || matchesSingularity || matchesDidaktik || matchesKlang || matchesPhil || matchesWiss || matchesBuch || matchesYT || matchesMeme;
          }
          return item.primaryTopic === selectedFilter || item.topics.includes(selectedFilter as TopicTag);
        });
    return filterByQuery(spaceFiltered);
  }, [dailyEdition, selectedFilter, filterByQuery]);

  // Filter discovery pool items
  const filteredDiscovery = useMemo(() => {
    const spaceFiltered = selectedFilter === 'all'
      ? discoveryItems
      : discoveryItems.filter(item => {
          if (selectedFilter.startsWith('c/')) {
            const raw = selectedFilter.slice(2).toLowerCase();
            const matchesSpace = item.space?.toLowerCase() === selectedFilter.toLowerCase();
            const matchesTopic = item.primaryTopic?.toLowerCase().includes(raw) || item.topics.some(t => t.toLowerCase().includes(raw));
            const matchesSingularity = (raw.includes('singularity') || raw.includes('beschleunigung') || raw.includes('ai')) && (item.primaryTopic === 'ai_apple' || item.topics.includes('ai_apple'));
            const matchesDidaktik = raw.includes('didaktik') && (item.primaryTopic === 'german_didactics' || item.topics.includes('german_didactics'));
            const matchesKlang = (raw.includes('klang') || raw.includes('musik')) && (item.primaryTopic === 'sound_synthesis' || item.topics.includes('sound_synthesis'));
            const matchesPhil = raw.includes('philosoph') && (item.primaryTopic === 'philosophy_ethics' || item.topics.includes('philosophy_ethics'));
            const matchesWiss = raw.includes('wiss') && (item.primaryTopic === 'science_society' || item.topics.includes('science_society'));
            const matchesBuch = (raw.includes('buch') || raw.includes('buecher')) && (item.primaryTopic === 'book_mastery' || item.topics.includes('book_mastery'));
            const matchesYT = (raw.includes('youtube') || raw.includes('video')) && (item.primaryTopic === 'youtube_gems' || item.topics.includes('youtube_gems'));
            const matchesMeme = (raw.includes('meme') || raw.includes('satire')) && (item.primaryTopic === 'memes_satire' || item.topics.includes('memes_satire'));
            return matchesSpace || matchesTopic || matchesSingularity || matchesDidaktik || matchesKlang || matchesPhil || matchesWiss || matchesBuch || matchesYT || matchesMeme;
          }
          return item.primaryTopic === selectedFilter || item.topics.includes(selectedFilter as TopicTag);
        });
    return filterByQuery(spaceFiltered);
  }, [discoveryItems, selectedFilter, filterByQuery]);

  // Reddit sorting algorithms
  const applySort = useCallback((items: ScoredFeedItem[], mode: SortMode) => {
    const list = [...items];
    switch (mode) {
      case 'new':
        return list.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
      case 'top':
        return list.sort((a, b) => {
          const scoreA = (a.upvotesCount || 42) + ((a.awardsCount?.gold || 0) * 5) + ((a.awardsCount?.brain || 0) * 3);
          const scoreB = (b.upvotesCount || 42) + ((b.awardsCount?.gold || 0) * 5) + ((b.awardsCount?.brain || 0) * 3);
          return scoreB - scoreA;
        });
      case 'gems':
        return list.sort((a, b) => {
          const isGemA = a.format === 'youtube_gem' || a.format === 'book_masterpiece' || a.format === 'meme' || a.format === 'opportunity_radar';
          const isGemB = b.format === 'youtube_gem' || b.format === 'book_masterpiece' || b.format === 'meme' || b.format === 'opportunity_radar';
          if (isGemA && !isGemB) return -1;
          if (!isGemA && isGemB) return 1;
          return (b.score || 0) - (a.score || 0);
        });
      case 'hot':
      default:
        return list.sort((a, b) => {
          const hotA = (a.score || 0) * 10 + (a.upvotesCount || 42) + (a.comments?.length || 0) * 4;
          const hotB = (b.score || 0) * 10 + (b.upvotesCount || 42) + (b.comments?.length || 0) * 4;
          return hotB - hotA;
        });
    }
  }, []);

  const sortedDaily = useMemo(() => applySort(filteredDaily, sortMode), [filteredDaily, sortMode, applySort]);
  const sortedDiscovery = useMemo(() => applySort(filteredDiscovery, sortMode), [filteredDiscovery, sortMode, applySort]);

  // Appended discovery items for smooth infinite mind-scroll (cycles infinitely)
  const renderedDiscovery = useMemo(() => {
    if (sortedDiscovery.length === 0) return [];
    if (visibleDiscoveryCount <= sortedDiscovery.length) {
      return sortedDiscovery.slice(0, visibleDiscoveryCount);
    }
    // Infinite loop mode: cycle through items with cloned IDs so React keys remain unique
    const result: ScoredFeedItem[] = [...sortedDiscovery];
    let cycle = 1;
    while (result.length < visibleDiscoveryCount && cycle < 15) {
      for (const item of sortedDiscovery) {
        if (result.length >= visibleDiscoveryCount) break;
        result.push({
          ...item,
          id: `${item.id}-cycle-${cycle}`
        });
      }
      cycle++;
    }
    return result;
  }, [sortedDiscovery, visibleDiscoveryCount]);

  // Seamless infinite mind-scroll listener (triggers next items as user scrolls down)
  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = 800;
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom) {
      setVisibleDiscoveryCount(prev => prev + 6);
    }
  }, []);

  const handleLoadMoreDiscovery = () => {
    setVisibleDiscoveryCount(prev => prev + 10);
  };

  // Combine items into a seamless stream
  const allStreamItems = useMemo(() => {
    return [...sortedDaily, ...renderedDiscovery];
  }, [sortedDaily, renderedDiscovery]);

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

      {/* Main Feed Scroll (Desktop Centered & Two-Column Layout) */}
      <ScrollView
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
          {/* Feed Column (Center) */}
          <View style={[styles.feedColumn, isDesktop && styles.desktopFeedColumn]}>
            {/* 1. Primary Feed Mode Segmented Switcher */}
            <View style={[styles.feedModeSwitcher, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
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
                  📰 Tagesausgabe
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
            </View>

            {/* 2. MODE: LIVE NEWS HUB */}
            {activeFeedOption === 'live_news' && (
              <View style={styles.modeSectionContainer}>
                {/* News Hub Sub-Bar: Ticker headline & Settings button */}
                <View style={[styles.liveNewsSubBar, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
                  <View style={styles.liveNewsTopRow}>
                    <View style={styles.liveNewsTitleRow}>
                      <View style={styles.liveGreenDot} />
                      <Text style={[styles.liveNewsTitle, { color: colors.textPrimary }]}>
                        Echtzeit-Ticker ({scoredLiveItems.length} verifizierte Meldungen)
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setShowNewsHubSettingsModal(true)}
                      style={[styles.hubSettingsBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}
                      accessibilityRole="button"
                      accessibilityLabel="Quellen- und Scraper-Setup öffnen"
                    >
                      <Ionicons name="options-outline" size={13} color={colors.accent} style={{ marginRight: 4 }} />
                      <Text style={[styles.hubSettingsBtnText, { color: colors.textPrimary }]}>
                        ⚙️ Quellen & Setup
                      </Text>
                    </TouchableOpacity>
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
                </View>

                {/* Live News Items */}
                {liveNewsLoading && liveNewsItems.length === 0 ? (
                  <View style={[styles.loadingBox, { backgroundColor: colors.surface }]}>
                    <ActivityIndicator size="large" color={colors.accent} />
                    <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                      Lade verifizierte Echtzeit-Feeds…
                    </Text>
                  </View>
                ) : (
                  <>
                    {scoredLiveItems.map((item, index) => (
                      <FeedCard
                        key={item.id}
                        item={item}
                        isHero={index === 0 && !searchQuery}
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
                  />
                ))}
              </View>
            )}

            {/* 4. MODE: DAILY FINITE EDITION (DEFAULT) */}
            {activeFeedOption === 'daily' && (
              <>
                {/* Desktop Spaces Selector Bar */}
                {isDesktop && (
                  <View style={[styles.desktopSpaceCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
                    {renderSpacePills()}
                  </View>
                )}

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
                </View>

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
                      Heiß
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
                      Perlen & Memes
                    </Text>
                  </TouchableOpacity>

                  <View style={styles.sortRightInfo}>
                    <Ionicons name="sparkles-outline" size={13} color={colors.accent} style={{ marginRight: 4 }} />
                    <Text style={[styles.sortInfoText, { color: colors.textMuted }]}>
                      Kuratierte Entdeckung
                    </Text>
                  </View>
                </View>

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
                  <React.Fragment key={item.id}>
                    <FeedCard
                      item={item}
                      isHero={index === 0 && selectedFilter === 'all' && !searchQuery}
                    />

                    {/* Mindfulness Milestone after item 5 in daily edition */}
                    {index === 4 && (
                      <View style={[styles.milestoneCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
                        <Ionicons name="leaf-outline" size={20} color="#10B981" style={{ marginRight: 10, marginTop: 2 }} />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.milestoneTitle, { color: colors.textPrimary }]}>
                            Kognitive Atempause
                          </Text>
                          <Text style={[styles.milestoneSubtitle, { color: colors.textMuted }]}>
                            5 Gedanken aufgenommen. Nimm dir 3 tiefe Atemzüge, um das Gelesene kognitiv zu verarbeiten.
                          </Text>
                          <TouchableOpacity
                            onPress={() => setShowBreathingModal(true)}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              alignSelf: 'flex-start',
                              marginTop: 8,
                              backgroundColor: 'rgba(16, 185, 129, 0.15)',
                              paddingHorizontal: 12,
                              paddingVertical: 6,
                              borderRadius: radius.full
                            }}
                          >
                            <Ionicons name="leaf-outline" size={13} color="#10B981" style={{ marginRight: 5 }} />
                            <Text style={{ fontSize: 12, fontWeight: '600', color: '#10B981' }}>
                              Atem-Simulator starten (4-4-4-4)
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </React.Fragment>
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
                {renderedDiscovery.map((item, index) => (
                  <React.Fragment key={item.id}>
                    <FeedCard item={item} isHero={false} />

                    {/* Periodic Mindfulness Milestone every 8 discovery cards */}
                    {(index + 1) % 8 === 0 && (
                      <View style={[styles.milestoneCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
                        <Ionicons name="water-outline" size={20} color="#06B6D4" style={{ marginRight: 10, marginTop: 2 }} />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.milestoneTitle, { color: colors.textPrimary }]}>
                            Kognitive Weite & Atempause
                          </Text>
                          <Text style={[styles.milestoneSubtitle, { color: colors.textMuted }]}>
                            {index + 1 + sortedDaily.length} Erkenntnisse gesammelt. Atme durch, um das Rauschen der Welt loszulassen.
                          </Text>
                          <TouchableOpacity
                            onPress={() => setShowBreathingModal(true)}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              alignSelf: 'flex-start',
                              marginTop: 8,
                              backgroundColor: 'rgba(6, 182, 212, 0.15)',
                              paddingHorizontal: 12,
                              paddingVertical: 6,
                              borderRadius: radius.full
                            }}
                          >
                            <Ionicons name="leaf-outline" size={13} color="#06B6D4" style={{ marginRight: 5 }} />
                            <Text style={{ fontSize: 12, fontWeight: '600', color: '#06B6D4' }}>
                              Atempause nehmen (4-4-4-4)
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </React.Fragment>
                ))}

                {/* End of Section / Conscious Discovery Trigger */}
                {visibleDiscoveryCount < allStreamItems.length ? (
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
              <DesktopSidebar articleCount={allStreamItems.length} />
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

      {/* Kognitive Atempause & Mindful Breathing Simulator */}
      <AtemBreathingModal
        visible={showBreathingModal}
        onClose={() => setShowBreathingModal(false)}
        targetRounds={3}
      />

      {/* News-Hub Sources, Gatherer & Settings Modal */}
      <NewsHubModal
        visible={showNewsHubSettingsModal}
        onClose={() => {
          setShowNewsHubSettingsModal(false);
          void loadLiveNews();
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1
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
  feedModeSwitcher: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.md,
    gap: 4
  },
  feedModeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
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
    justifyContent: 'space-between'
  },
  liveNewsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  liveNewsTitle: {
    fontSize: 14,
    fontWeight: '700'
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
  }
});
