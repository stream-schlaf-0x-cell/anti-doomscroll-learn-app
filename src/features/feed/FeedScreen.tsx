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
  useWindowDimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TopicTag, TOPIC_SPACE_MAP } from '../../core/domain/types';
import { useApp } from '../../core/context/AppContext';
import { Header } from '../../ui/components/Header';
import { DesktopRedditHeader } from '../../ui/components/DesktopRedditHeader';
import { DesktopSidebar } from '../../ui/components/DesktopSidebar';
import { FeedCard } from '../../ui/components/FeedCard';
import { typography, radius, spacing } from '../../ui/theme';
import { ScoredFeedItem } from '../../core/domain/ranking';

export const FeedScreen: React.FC = () => {
  const { dailyEdition, discoveryItems, colors, refreshFeed } = useApp();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 960;

  type SortMode = 'hot' | 'new' | 'top' | 'gems';
  const [selectedFilter, setSelectedFilter] = useState<TopicTag | 'all'>('all');
  const [sortMode, setSortMode] = useState<SortMode>('hot');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [visibleDiscoveryCount, setVisibleDiscoveryCount] = useState<number>(10);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshFeed();
    setVisibleDiscoveryCount(10);
    setRefreshing(false);
  };

  const handleFilterChange = (tag: TopicTag | 'all') => {
    setSelectedFilter(tag);
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
      : dailyEdition.filter(item => item.primaryTopic === selectedFilter || item.topics.includes(selectedFilter));
    return filterByQuery(spaceFiltered);
  }, [dailyEdition, selectedFilter, filterByQuery]);

  // Filter discovery pool items
  const filteredDiscovery = useMemo(() => {
    const spaceFiltered = selectedFilter === 'all'
      ? discoveryItems
      : discoveryItems.filter(item => item.primaryTopic === selectedFilter || item.topics.includes(selectedFilter));
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
    : (TOPIC_SPACE_MAP[selectedFilter]?.space || selectedFilter);

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

      {/* Community Space Selector Bar */}
      <View style={[styles.filterBarContainer, { backgroundColor: colors.surface, borderBottomColor: colors.borderSubtle }]}>
        <View style={[styles.filterBarInner, isDesktop && styles.desktopFilterBarInner]}>
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

            {/* Individual Spaces */}
            {(Object.keys(TOPIC_SPACE_MAP) as TopicTag[]).map(tag => {
              const isSelected = selectedFilter === tag;
              const meta = TOPIC_SPACE_MAP[tag];

              return (
                <TouchableOpacity
                  key={tag}
                  onPress={() => handleFilterChange(tag)}
                  style={[
                    styles.spacePill,
                    {
                      backgroundColor: isSelected ? meta.color : colors.surfaceSecondary,
                      borderColor: isSelected ? meta.color : colors.borderSubtle
                    }
                  ]}
                >
                  <Ionicons
                    name={(meta.icon as any) || 'planet-outline'}
                    size={13}
                    color={isSelected ? '#FFFFFF' : meta.color}
                    style={{ marginRight: 5 }}
                  />
                  <Text
                    style={[
                      styles.spacePillText,
                      { color: isSelected ? '#FFFFFF' : colors.textPrimary }
                    ]}
                  >
                    {meta.space}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>

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
          <View style={[styles.feedColumn, isDesktop && styles.desktopFeedColumn]}>
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
                <Ionicons name="infinite-outline" size={13} color={colors.accent} style={{ marginRight: 4 }} />
                <Text style={[styles.sortInfoText, { color: colors.textMuted }]}>
                  Endlos-Stream
                </Text>
              </View>
            </View>

            {allStreamItems.length === 0 ? (
              <View style={[styles.emptyBox, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
                <Ionicons name="filter-outline" size={32} color={colors.textMuted} style={{ marginBottom: spacing.sm }} />
                <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                  Keine Beiträge gefunden
                </Text>
                <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
                  {searchQuery ? 'Versuche einen anderen Suchbegriff.' : 'Wähle „Alle Spaces“ oder wechsle den Themenfilter.'}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setSelectedFilter('all');
                    setSearchQuery('');
                  }}
                  style={[styles.emptyButton, { backgroundColor: colors.accent }]}
                >
                  <Text style={styles.emptyButtonText}>Filter zurücksetzen</Text>
                </TouchableOpacity>
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
                        <Ionicons name="leaf-outline" size={18} color={colors.accent} style={{ marginRight: 8 }} />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.milestoneTitle, { color: colors.textPrimary }]}>
                            Innehalten & Nachdenken
                          </Text>
                          <Text style={[styles.milestoneSubtitle, { color: colors.textMuted }]}>
                            5 Gedanken aufgenommen. Nimm dir einen Moment, bevor du weiter scrollst.
                          </Text>
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
                        <Ionicons name="water-outline" size={18} color={colors.accent} style={{ marginRight: 8 }} />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.milestoneTitle, { color: colors.textPrimary }]}>
                            Bewusstes Weiterlernen
                          </Text>
                          <Text style={[styles.milestoneSubtitle, { color: colors.textMuted }]}>
                            {index + 1 + sortedDaily.length} Erkenntnisse gesammelt. Dein Geist wächst mit jedem bewussten Gedanken.
                          </Text>
                        </View>
                      </View>
                    )}
                  </React.Fragment>
                ))}

                {/* End of Stream / Manual Load More Trigger */}
                <TouchableOpacity
                  onPress={handleLoadMoreDiscovery}
                  style={[styles.loadMoreButton, { borderColor: colors.accent, backgroundColor: colors.surface }]}
                >
                  <Ionicons name="infinite-outline" size={18} color={colors.accent} style={{ marginRight: 6 }} />
                  <Text style={[styles.loadMoreButtonText, { color: colors.accent }]}>
                    Endlos weiter scrollen (+10 Gedanken & Gems)
                  </Text>
                </TouchableOpacity>
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
  desktopFilterBarInner: {
    maxWidth: 1140
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
  emptyBox: {
    padding: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    marginVertical: spacing.xl
  },
  emptyTitle: {
    fontSize: typography.sizes.title2,
    fontWeight: '700',
    marginBottom: 6
  },
  emptySubtitle: {
    fontSize: typography.sizes.bodySmall,
    textAlign: 'center',
    marginBottom: spacing.md
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
  }
});
