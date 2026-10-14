import React, { useState } from 'react';
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
  const [showDiscovery, setShowDiscovery] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshFeed();
    setRefreshing(false);
  };

  // Filter daily items
  const filteredDaily = selectedFilter === 'all'
    ? dailyEdition
    : dailyEdition.filter(item => item.topics.includes(selectedFilter));

  // Filter discovery items
  const filteredDiscovery = selectedFilter === 'all'
    ? discoveryItems
    : discoveryItems.filter(item => item.topics.includes(selectedFilter));

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header />

      {/* Filter Category Bar */}
      <View style={styles.filterBarContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          <TouchableOpacity
            onPress={() => setSelectedFilter('all')}
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
                onPress={() => setSelectedFilter(tag)}
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
        {filteredDaily.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
            <Ionicons name="filter-outline" size={32} color={colors.textMuted} style={{ marginBottom: spacing.sm }} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
              Keine Artikel in dieser Kategorie
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
              Wähle „Alle Themen“ oder passe deine Interessen in den Einstellungen an.
            </Text>
            <TouchableOpacity
              onPress={() => setSelectedFilter('all')}
              style={[styles.emptyButton, { backgroundColor: colors.accent }]}
            >
              <Text style={styles.emptyButtonText}>Filter zurücksetzen</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Daily Edition List */}
            {filteredDaily.map((item, index) => (
              <FeedCard
                key={item.id}
                item={item}
                isHero={index === 0 && selectedFilter === 'all'}
              />
            ))}

            {/* Finite Edition Completion Banner (Anti-Doomscroll stopping point) */}
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

              {!showDiscovery ? (
                <TouchableOpacity
                  onPress={() => setShowDiscovery(true)}
                  style={[styles.discoveryToggle, { borderColor: colors.accent, backgroundColor: colors.surfaceSecondary }]}
                >
                  <Ionicons name="compass-outline" size={16} color={colors.accent} style={{ marginRight: 6 }} />
                  <Text style={[styles.discoveryToggleText, { color: colors.accent }]}>
                    Erweiterte Entdeckungen laden ({discoveryItems.length})
                  </Text>
                </TouchableOpacity>
              ) : (
                <View style={[styles.dividerPill, { backgroundColor: colors.surfaceSecondary }]}>
                  <Text style={[styles.dividerText, { color: colors.textMuted }]}>
                    — WEITERE ENTDECKUNGEN —
                  </Text>
                </View>
              )}
            </View>

            {/* Extended Discovery Items */}
            {showDiscovery && (
              <View style={styles.discoverySection}>
                {filteredDiscovery.map(item => (
                  <FeedCard key={item.id} item={item} isHero={false} />
                ))}
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
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0,0,0,0.05)'
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
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.pill,
    marginTop: spacing.xs
  },
  dividerText: {
    fontSize: typography.sizes.micro,
    fontWeight: '700',
    letterSpacing: 1
  },
  discoverySection: {
    marginTop: spacing.md
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
