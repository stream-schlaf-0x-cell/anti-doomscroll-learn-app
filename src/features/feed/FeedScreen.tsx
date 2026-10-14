import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TopicTag, TOPIC_METADATA } from '../../core/domain/types';
import { useApp } from '../../core/context/AppContext';
import { Header } from '../../ui/components/Header';
import { FeedCard } from '../../ui/components/FeedCard';
import { typography, radius, spacing } from '../../ui/theme';

export const FeedScreen: React.FC = () => {
  const { dailyEdition, discoveryItems, colors, refreshFeed } = useApp();
  const [selectedFilter, setSelectedFilter] = useState<TopicTag | 'all'>('all');
  const [visibleDiscoveryCount, setVisibleDiscoveryCount] = useState<number>(0);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshFeed();
    setVisibleDiscoveryCount(0);
    setRefreshing(false);
  };

  const handleFilterChange = (tag: TopicTag | 'all') => {
    setSelectedFilter(tag);
    // Keep discovery count bounded to available items in new category
    setVisibleDiscoveryCount(0);
  };

  // Filter daily edition items
  const filteredDaily = useMemo(() => {
    return selectedFilter === 'all'
      ? dailyEdition
      : dailyEdition.filter(item => item.topics.includes(selectedFilter));
  }, [dailyEdition, selectedFilter]);

  // Filter discovery pool items
  const filteredDiscovery = useMemo(() => {
    return selectedFilter === 'all'
      ? discoveryItems
      : discoveryItems.filter(item => item.topics.includes(selectedFilter));
  }, [discoveryItems, selectedFilter]);

  // Appended discovery items
  const renderedDiscovery = useMemo(() => {
    return filteredDiscovery.slice(0, visibleDiscoveryCount);
  }, [filteredDiscovery, visibleDiscoveryCount]);

  const remainingDiscoveryCount = Math.max(0, filteredDiscovery.length - visibleDiscoveryCount);
  const nextBatchSize = Math.min(10, remainingDiscoveryCount);

  const handleLoadMoreDiscovery = () => {
    setVisibleDiscoveryCount(prev => Math.min(filteredDiscovery.length, prev + 10));
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header />

      {/* Filter Category Bar */}
      <View style={[styles.filterBarContainer, { borderBottomColor: colors.borderSubtle }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          <TouchableOpacity
            onPress={() => handleFilterChange('all')}
            style={[
              styles.filterPill,
              {
                backgroundColor: selectedFilter === 'all' ? colors.accent : colors.surface,
                borderColor: selectedFilter === 'all' ? colors.accent : colors.borderSubtle
              }
            ]}
          >
            <Text
              style={[
                styles.filterText,
                { color: selectedFilter === 'all' ? '#FFFFFF' : colors.textSecondary }
              ]}
            >
              Alle Themen
            </Text>
          </TouchableOpacity>

          {(Object.keys(TOPIC_METADATA) as TopicTag[]).map(tag => {
            const isSelected = selectedFilter === tag;
            const meta = TOPIC_METADATA[tag];

            return (
              <TouchableOpacity
                key={tag}
                onPress={() => handleFilterChange(tag)}
                style={[
                  styles.filterPill,
                  {
                    backgroundColor: isSelected ? colors.accent : colors.surface,
                    borderColor: isSelected ? colors.accent : colors.borderSubtle
                  }
                ]}
              >
                <Text
                  style={[
                    styles.filterText,
                    { color: isSelected ? '#FFFFFF' : colors.textSecondary }
                  ]}
                >
                  {meta.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Main Feed Scroll */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
      >
        {filteredDaily.length === 0 && renderedDiscovery.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
            <Ionicons name="filter-outline" size={32} color={colors.textMuted} style={{ marginBottom: spacing.sm }} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
              Keine Beiträge in dieser Kategorie
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
              Wähle „Alle Themen“ oder passe deine Interessen in den Einstellungen an.
            </Text>
            <TouchableOpacity
              onPress={() => handleFilterChange('all')}
              style={[styles.emptyButton, { backgroundColor: colors.accent }]}
            >
              <Text style={styles.emptyButtonText}>Filter zurücksetzen</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Finite Daily Edition Cards */}
            {filteredDaily.map((item, index) => (
              <FeedCard
                key={item.id}
                item={item}
                isHero={index === 0 && selectedFilter === 'all'}
              />
            ))}

            {/* Finite Edition Completion Banner (Anti-Doomscroll deliberate pause) */}
            <View style={[styles.completionBanner, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
              <View style={[styles.iconCircle, { backgroundColor: colors.accentSubtle }]}>
                <Ionicons name="sparkles" size={24} color={colors.accent} />
              </View>

              <Text style={[styles.completionTitle, { color: colors.textPrimary }]}>
                Ende dieser Ausgabe
              </Text>

              <Text style={[styles.completionText, { color: colors.textSecondary }]}>
                Du hast alle kuratierten Beiträge der heutigen Ausgabe erreicht. Gönne deinem Geist eine Atempause – oder erkunde bewusst weitere Entdeckungen.
              </Text>

              {remainingDiscoveryCount > 0 && visibleDiscoveryCount === 0 && (
                <TouchableOpacity
                  onPress={handleLoadMoreDiscovery}
                  style={[styles.discoveryToggle, { borderColor: colors.accent, backgroundColor: colors.surfaceSecondary }]}
                >
                  <Ionicons name="compass-outline" size={16} color={colors.accent} style={{ marginRight: 6 }} />
                  <Text style={[styles.discoveryToggleText, { color: colors.accent }]}>
                    Weiter entdecken (+{nextBatchSize} von {remainingDiscoveryCount} Beiträgen)
                  </Text>
                </TouchableOpacity>
              )}

              {visibleDiscoveryCount > 0 && (
                <View style={[styles.dividerPill, { backgroundColor: colors.surfaceSecondary }]}>
                  <Text style={[styles.dividerText, { color: colors.textMuted }]}>
                    — WEITERE ENTDECKUNGEN ({renderedDiscovery.length} GELADEN) —
                  </Text>
                </View>
              )}
            </View>

            {/* Appended Discovery Items (Appended without shifting previous cards) */}
            {renderedDiscovery.length > 0 && (
              <View style={styles.discoverySection}>
                {renderedDiscovery.map(item => (
                  <FeedCard key={item.id} item={item} isHero={false} />
                ))}

                {/* Next Batch Button if more discovery items remain */}
                {remainingDiscoveryCount > 0 ? (
                  <TouchableOpacity
                    onPress={handleLoadMoreDiscovery}
                    style={[styles.loadMoreButton, { borderColor: colors.accent, backgroundColor: colors.surface }]}
                  >
                    <Ionicons name="add-circle-outline" size={18} color={colors.accent} style={{ marginRight: 6 }} />
                    <Text style={[styles.loadMoreButtonText, { color: colors.accent }]}>
                      Weitere Entdeckungen laden (+{nextBatchSize} von {remainingDiscoveryCount})
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <View style={[styles.allReadBanner, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
                    <Ionicons name="checkmark-circle-outline" size={20} color={colors.accent} style={{ marginBottom: 4 }} />
                    <Text style={[styles.allReadTitle, { color: colors.textPrimary }]}>
                      Alle Entdeckungen durchstöbert
                    </Text>
                    <Text style={[styles.allReadSubtitle, { color: colors.textMuted }]}>
                      Du hast alle verfügbaren Beiträge gesehen. Ein guter Moment für eine echte Pause.
                    </Text>
                  </View>
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  filterBarContainer: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 0.5
  },
  filterScroll: {
    paddingHorizontal: spacing.pageHorizontal,
    gap: 8
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 0.5
  },
  filterText: {
    fontSize: typography.sizes.micro,
    fontWeight: '600'
  },
  scrollContent: {
    paddingHorizontal: spacing.pageHorizontal,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl
  },
  completionBanner: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.xl,
    alignItems: 'center',
    textAlign: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.lg
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm
  },
  completionTitle: {
    fontSize: typography.sizes.title2,
    fontWeight: '700',
    marginBottom: 6
  },
  completionText: {
    fontSize: typography.sizes.bodySmall,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: spacing.md,
    maxWidth: 320
  },
  discoveryToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    borderWidth: 1
  },
  discoveryToggleText: {
    fontSize: typography.sizes.bodySmall,
    fontWeight: '600'
  },
  dividerPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.pill,
    marginTop: spacing.xs
  },
  dividerText: {
    fontSize: typography.sizes.micro,
    fontWeight: '700',
    letterSpacing: 0.8
  },
  discoverySection: {
    marginTop: spacing.xs
  },
  loadMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: spacing.sm,
    marginBottom: spacing.lg
  },
  loadMoreButtonText: {
    fontSize: typography.sizes.bodySmall,
    fontWeight: '600'
  },
  allReadBanner: {
    borderRadius: radius.md,
    borderWidth: 0.5,
    padding: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.lg
  },
  allReadTitle: {
    fontSize: typography.sizes.bodySmall,
    fontWeight: '700',
    marginBottom: 2
  },
  allReadSubtitle: {
    fontSize: typography.sizes.caption,
    textAlign: 'center'
  },
  emptyBox: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.xxl,
    alignItems: 'center',
    marginTop: spacing.xl
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
    lineHeight: 20,
    marginBottom: spacing.lg
  },
  emptyButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.md
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: typography.sizes.bodySmall,
    fontWeight: '600'
  }
});
