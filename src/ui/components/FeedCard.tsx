import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScoredFeedItem } from '../../core/domain/ranking';
import { useApp } from '../../core/context/AppContext';
import { TopicBadge } from './TopicBadge';
import { ReadingTimeBadge } from './ReadingTimeBadge';
import { typography, radius, spacing } from '../theme';

interface FeedCardProps {
  item: ScoredFeedItem;
  isHero?: boolean;
}

export const FeedCard: React.FC<FeedCardProps> = ({ item, isHero = false }) => {
  const { colors, interactions, toggleSaveItem, openArticle, openWhyModal } = useApp();

  const isSaved = interactions[item.id]?.saved ?? false;
  const progress = interactions[item.id]?.progressPercent ?? 0;
  const isCompleted = (interactions[item.id]?.completedAt !== undefined) || progress >= 95;

  const handleCardPress = () => {
    openArticle(item.id);
  };

  const handleSavePress = () => {
    toggleSaveItem(item.id);
  };

  const handleWhyPress = () => {
    openWhyModal(item);
  };

  // Determine card format badge text
  const formatBadge = getFormatBadge(item.type);

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={handleCardPress}
      style={[
        styles.card,
        {
          backgroundColor: isHero ? colors.cardHighlight : colors.surface,
          borderColor: isHero ? colors.accent : colors.borderSubtle
        },
        isHero && styles.heroCard
      ]}
    >
      {/* Top Meta Row */}
      <View style={styles.metaRow}>
        <View style={styles.metaLeft}>
          <TopicBadge topic={item.primaryTopic} size="sm" />
          <View style={{ width: 6 }} />
          <ReadingTimeBadge minutes={item.estimatedReadingMinutes} />
        </View>

        <TouchableOpacity
          onPress={handleSavePress}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={[styles.iconButton, { backgroundColor: colors.surfaceSecondary }]}
        >
          <Ionicons
            name={isSaved ? 'bookmark' : 'bookmark-outline'}
            size={16}
            color={isSaved ? colors.accent : colors.textMuted}
          />
        </TouchableOpacity>
      </View>

      {/* Format Label if Perspective / Deep Dive / Connection */}
      {formatBadge && (
        <View style={styles.formatBadgeRow}>
          <Text style={[styles.formatBadgeText, { color: colors.accent }]}>
            {formatBadge}
          </Text>
        </View>
      )}

      {/* Title */}
      <Text
        style={[
          styles.title,
          isHero ? styles.heroTitle : styles.standardTitle,
          { color: colors.textPrimary }
        ]}
      >
        {item.title}
      </Text>

      {/* Subtitle / Dek */}
      <Text
        style={[
          styles.subtitle,
          { color: colors.textSecondary }
        ]}
        numberOfLines={isHero ? 3 : 2}
      >
        {item.subtitle}
      </Text>

      {/* Progress Bar if started */}
      {progress > 0 && !isCompleted && (
        <View style={[styles.progressTrack, { backgroundColor: colors.surfaceSecondary }]}>
          <View
            style={[
              styles.progressBar,
              { width: `${progress}%`, backgroundColor: colors.accent }
            ]}
          />
        </View>
      )}

      {/* Bottom Footer Row */}
      <View style={[styles.footerRow, { borderTopColor: colors.borderSubtle }]}>
        <TouchableOpacity
          onPress={handleWhyPress}
          style={styles.whyPill}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="sparkles-outline" size={12} color={colors.accent} style={{ marginRight: 4 }} />
          <Text style={[styles.whyText, { color: colors.textMuted }]}>
            Warum sehe ich das?
          </Text>
        </TouchableOpacity>

        {isCompleted ? (
          <View style={styles.completedBadge}>
            <Ionicons name="checkmark-circle" size={13} color={colors.success} style={{ marginRight: 3 }} />
            <Text style={[styles.completedText, { color: colors.success }]}>Gelesen</Text>
          </View>
        ) : (
          <Text style={[styles.sourceText, { color: colors.textMuted }]} numberOfLines={1}>
            {item.sourceReferences[0]?.publisher ?? 'Redaktion'}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

function getFormatBadge(type: string): string | null {
  switch (type) {
    case 'perspective': return '✦ Philosophischer Diskurs';
    case 'deep_dive': return '◈ Tiefgang & Forschung';
    case 'connection': return '☍ Interdisziplinäre Brücke';
    case 'quick_insight': return '⚡︎ Kompaktimpuls';
    default: return null;
  }
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2
  },
  heroCard: {
    borderWidth: 1.5,
    padding: spacing.xl,
    marginBottom: spacing.lg
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm
  },
  metaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap'
  },
  iconButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center'
  },
  formatBadgeRow: {
    marginBottom: 4
  },
  formatBadgeText: {
    fontSize: typography.sizes.micro,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase'
  },
  title: {
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: spacing.xs
  },
  heroTitle: {
    fontSize: typography.sizes.hero,
    lineHeight: typography.lineHeights.hero
  },
  standardTitle: {
    fontSize: typography.sizes.title2,
    lineHeight: typography.lineHeights.title2
  },
  subtitle: {
    fontSize: typography.sizes.bodySmall,
    lineHeight: typography.lineHeights.bodySmall,
    marginBottom: spacing.md
  },
  progressTrack: {
    height: 3,
    borderRadius: 1.5,
    width: '100%',
    marginBottom: spacing.sm,
    overflow: 'hidden'
  },
  progressBar: {
    height: '100%',
    borderRadius: 1.5
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.sm,
    borderTopWidth: 0.5
  },
  whyPill: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  whyText: {
    fontSize: typography.sizes.micro,
    fontWeight: '500'
  },
  sourceText: {
    fontSize: typography.sizes.micro,
    maxWidth: '45%'
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  completedText: {
    fontSize: typography.sizes.micro,
    fontWeight: '600'
  }
});
