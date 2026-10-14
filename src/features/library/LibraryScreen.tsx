import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../core/context/AppContext';
import { TopicBadge } from '../../ui/components/TopicBadge';
import { ReadingTimeBadge } from '../../ui/components/ReadingTimeBadge';
import { typography, radius, spacing } from '../../ui/theme';

export const LibraryScreen: React.FC = () => {
  const {
    dailyEdition,
    discoveryItems,
    interactions,
    colors,
    openArticle,
    toggleSaveItem,
    setActiveTab
  } = useApp();

  const [filter, setFilter] = useState<'all' | 'unread' | 'completed'>('all');

  // Find all items that are saved
  const allItems = [...dailyEdition, ...discoveryItems];
  const savedItems = allItems.filter(item => interactions[item.id]?.saved);

  // Apply sub-filter
  const filteredSaved = savedItems.filter(item => {
    const isCompleted = (interactions[item.id]?.completedAt !== undefined) ||
      (interactions[item.id]?.progressPercent ?? 0) >= 95;

    if (filter === 'unread') return !isCompleted;
    if (filter === 'completed') return isCompleted;
    return true;
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.borderSubtle }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          Bibliothek
        </Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          {savedItems.length} {savedItems.length === 1 ? 'Artikel' : 'Artikel'} gemerkt
        </Text>
      </View>

      {/* Filter Tabs */}
      {savedItems.length > 0 && (
        <View style={styles.filterRow}>
          {[
            { id: 'all', label: 'Alle' },
            { id: 'unread', label: 'Ungelesen' },
            { id: 'completed', label: 'Gelesen' }
          ].map(f => (
            <TouchableOpacity
              key={f.id}
              onPress={() => setFilter(f.id as any)}
              style={[
                styles.filterPill,
                {
                  backgroundColor: filter === f.id ? colors.accent : colors.surface,
                  borderColor: filter === f.id ? colors.accent : colors.borderSubtle
                }
              ]}
            >
              <Text
                style={[
                  styles.filterText,
                  { color: filter === f.id ? '#FFFFFF' : colors.textSecondary }
                ]}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* List */}
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {savedItems.length === 0 ? (
          <View style={[styles.emptyContainer, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
            <Ionicons name="bookmark-outline" size={38} color={colors.textMuted} style={{ marginBottom: spacing.md }} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
              Noch keine Artikel gemerkt
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              Tippe in der Tagesausgabe auf das Lesezeichen-Symbol, um lesenswerte Gedanken dauerhaft in deiner Bibliothek zu sichern.
            </Text>
            <TouchableOpacity
              onPress={() => setActiveTab('feed')}
              style={[styles.feedButton, { backgroundColor: colors.accent }]}
            >
              <Text style={styles.feedButtonText}>Zur Tagesausgabe</Text>
            </TouchableOpacity>
          </View>
        ) : filteredSaved.length === 0 ? (
          <View style={[styles.emptyContainer, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
              Keine Treffer im Filter
            </Text>
            <TouchableOpacity onPress={() => setFilter('all')}>
              <Text style={[styles.resetFilterText, { color: colors.accent }]}>Filter zurücksetzen</Text>
            </TouchableOpacity>
          </View>
        ) : (
          filteredSaved.map(item => {
            const progress = interactions[item.id]?.progressPercent ?? 0;
            const isCompleted = (interactions[item.id]?.completedAt !== undefined) || progress >= 95;

            return (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.85}
                onPress={() => openArticle(item.id)}
                style={[styles.itemCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
              >
                <View style={styles.cardHeader}>
                  <TopicBadge topic={item.primaryTopic} size="sm" />
                  <View style={{ width: 6 }} />
                  <ReadingTimeBadge minutes={item.estimatedReadingMinutes} />
                  <View style={{ flex: 1 }} />
                  <TouchableOpacity
                    onPress={() => toggleSaveItem(item.id)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="bookmark" size={17} color={colors.accent} />
                  </TouchableOpacity>
                </View>

                <Text style={[styles.itemTitle, { color: colors.textPrimary }]}>
                  {item.title}
                </Text>

                <Text style={[styles.itemSubtitle, { color: colors.textSecondary }]} numberOfLines={2}>
                  {item.subtitle}
                </Text>

                <View style={[styles.cardFooter, { borderTopColor: colors.borderSubtle }]}>
                  {isCompleted ? (
                    <View style={styles.statusRow}>
                      <Ionicons name="checkmark-circle" size={13} color={colors.success} style={{ marginRight: 4 }} />
                      <Text style={[styles.statusText, { color: colors.success }]}>Vollständig gelesen</Text>
                    </View>
                  ) : progress > 0 ? (
                    <View style={styles.statusRow}>
                      <Ionicons name="time-outline" size={13} color={colors.accent} style={{ marginRight: 4 }} />
                      <Text style={[styles.statusText, { color: colors.accent }]}>{progress}% gelesen</Text>
                    </View>
                  ) : (
                    <Text style={[styles.statusText, { color: colors.textMuted }]}>Noch nicht gelesen</Text>
                  )}

                  <Text style={[styles.publisherText, { color: colors.textMuted }]}>
                    {item.sourceReferences[0]?.publisher ?? ''}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  header: {
    paddingHorizontal: spacing.pageHorizontal,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 0.5
  },
  title: {
    fontSize: typography.sizes.title1,
    fontWeight: '800'
  },
  subtitle: {
    fontSize: typography.sizes.micro,
    marginTop: 2
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.pageHorizontal,
    paddingVertical: spacing.sm,
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
  emptyContainer: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.xxl,
    alignItems: 'center',
    marginTop: spacing.xl
  },
  emptyTitle: {
    fontSize: typography.sizes.title2,
    fontWeight: '700',
    marginBottom: spacing.xs,
    textAlign: 'center'
  },
  emptySubtitle: {
    fontSize: typography.sizes.bodySmall,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: spacing.lg,
    maxWidth: 320
  },
  feedButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: radius.md
  },
  feedButtonText: {
    color: '#FFFFFF',
    fontSize: typography.sizes.bodySmall,
    fontWeight: '600'
  },
  resetFilterText: {
    fontSize: typography.sizes.bodySmall,
    fontWeight: '600',
    marginTop: spacing.sm
  },
  itemCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    marginBottom: spacing.md
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs
  },
  itemTitle: {
    fontSize: typography.sizes.title2,
    fontWeight: '700',
    lineHeight: typography.lineHeights.title2,
    marginBottom: 4
  },
  itemSubtitle: {
    fontSize: typography.sizes.bodySmall,
    lineHeight: 19,
    marginBottom: spacing.sm
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.xs,
    borderTopWidth: 0.5
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  statusText: {
    fontSize: typography.sizes.micro,
    fontWeight: '600'
  },
  publisherText: {
    fontSize: typography.sizes.micro
  }
});
