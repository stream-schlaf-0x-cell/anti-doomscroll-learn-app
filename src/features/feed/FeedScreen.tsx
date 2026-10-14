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

  const [selectedFilter, setSelectedFilter] = useState<TopicTag | 'all'>('all');
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

  // Appended discovery items for smooth infinite mind-scroll
  const renderedDiscovery = useMemo(() => {
    return filteredDiscovery.slice(0, visibleDiscoveryCount);
  }, [filteredDiscovery, visibleDiscoveryCount]);

  const remainingDiscoveryCount = Math.max(0, filteredDiscovery.length - visibleDiscoveryCount);
  const nextBatchSize = Math.min(10, remainingDiscoveryCount);

  // Seamless infinite mind-scroll listener
  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = 700;
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom) {
      if (visibleDiscoveryCount < filteredDiscovery.length) {
        setVisibleDiscoveryCount(prev => Math.min(filteredDiscovery.length, prev + 8));
      }
    }
  }, [visibleDiscoveryCount, filteredDiscovery.length]);

  const handleLoadMoreDiscovery = () => {
    setVisibleDiscoveryCount(prev => Math.min(filteredDiscovery.length, prev + 10));
  };

  // Combine items into a seamless stream
  const allStreamItems = useMemo(() => {
    return [...filteredDaily, ...renderedDiscovery];
  }, [filteredDaily, renderedDiscovery]);

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
          onSelectSpacePress={() => handleFilterChange('all')}
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
                {filteredDaily.map((item, index) => (
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
                {filteredDaily.length > 0 && renderedDiscovery.length > 0 && (
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
                            {index + 1 + filteredDaily.length} Erkenntnisse gesammelt. Dein Geist wächst mit jedem bewussten Gedanken.
                          </Text>
                        </View>
                      </View>
                    )}
                  </React.Fragment>
                ))}

                {/* End of Stream / Manual Load More Trigger */}
                {remainingDiscoveryCount > 0 ? (
                  <TouchableOpacity
                    onPress={handleLoadMoreDiscovery}
                    style={[styles.loadMoreButton, { borderColor: colors.accent, backgroundColor: colors.surface }]}
                  >
                    <Ionicons name="compass-outline" size={18} color={colors.accent} style={{ marginRight: 6 }} />
                    <Text style={[styles.loadMoreButtonText, { color: colors.accent }]}>
                      Weitere Entdeckungen laden (+{nextBatchSize} von {remainingDiscoveryCount})
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <View style={[styles.allReadBanner, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
                    <Ionicons name="checkmark-circle-outline" size={22} color={colors.accent} style={{ marginBottom: 6 }} />
                    <Text style={[styles.allReadTitle, { color: colors.textPrimary }]}>
                      Du bist auf dem neuesten Stand
                    </Text>
                    <Text style={[styles.allReadSubtitle, { color: colors.textMuted }]}>
                      Alle verfügbaren Beiträge aus deinen abonnierten Spaces wurden gelesen. Zeit für eine Pause.
                    </Text>
                  </View>
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
  }
});
