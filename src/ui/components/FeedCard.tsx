import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScoredFeedItem } from '../../core/domain/ranking';
import { formatFeedItemFormat, formatEvidenceTier } from '../../core/domain/types';
import { useApp } from '../../core/context/AppContext';
import { TopicBadge } from './TopicBadge';
import { ReadingTimeBadge } from './ReadingTimeBadge';
import { typography, radius, spacing } from '../theme';

interface FeedCardProps {
  item: ScoredFeedItem;
  isHero?: boolean;
}

export const FeedCard: React.FC<FeedCardProps> = ({ item, isHero = false }) => {
  const { colors, interactions, toggleSaveItem, openArticle, openWhyModal, setFeedback } = useApp();

  const isSaved = interactions[item.id]?.saved ?? false;
  const progress = interactions[item.id]?.progressPercent ?? 0;
  const isCompleted = (interactions[item.id]?.completedAt !== undefined) || progress >= 95;
  const currentFeedback = interactions[item.id]?.feedback;

  const handleCardPress = () => {
    openArticle(item.id);
  };

  const handleSavePress = () => {
    toggleSaveItem(item.id);
  };

  const handleWhyPress = () => {
    openWhyModal(item);
  };

  const handleFeedback = (type: 'more_like_this' | 'less_like_this') => {
    setFeedback(item.id, currentFeedback === type ? 'neutral' : type);
  };

  // Determine format and evidence tier text
  const formatText = item.format ? formatFeedItemFormat(item.format) : getLegacyFormatBadge(item.type);
  const evidenceText = formatEvidenceTier(item.evidenceTier);

  // Check if article has substantial longform text beyond the card's feedText
  const hasExpandedBody = Boolean(
    (item.articleBody && item.articleBody.trim().length > (item.feedText?.trim().length || 0) + 40) ||
    (item.body && item.body.trim().length > (item.feedText?.trim().length || 0) + 40)
  );

  const displayFeedText = item.feedText && item.feedText.trim().length > 0
    ? item.feedText
    : item.body;

  return (
    <TouchableOpacity
      activeOpacity={0.92}
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
          <View style={{ width: 6 }} />
          <View style={[styles.evidenceBadge, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
            <Text style={[styles.evidenceBadgeText, { color: colors.textMuted }]}>
              {evidenceText}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={handleSavePress}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={[styles.iconButton, { backgroundColor: colors.surfaceSecondary }]}
          accessibilityLabel={isSaved ? 'Aus Bibliothek entfernen' : 'In Bibliothek speichern'}
        >
          <Ionicons
            name={isSaved ? 'bookmark' : 'bookmark-outline'}
            size={16}
            color={isSaved ? colors.accent : colors.textMuted}
          />
        </TouchableOpacity>
      </View>

      {/* Editorial Formats & Specialized Tags */}
      <View style={styles.formatBadgeRow}>
        {formatText && (
          <Text style={[styles.formatBadgeText, { color: colors.accent }]}>
            {formatText}
          </Text>
        )}

        {item.isTeachingRelated && (
          <View style={[styles.quotaTag, { backgroundColor: colors.accentSubtle }]}>
            <Ionicons name="school-outline" size={11} color={colors.accent} style={{ marginRight: 3 }} />
            <Text style={[styles.quotaTagText, { color: colors.accent }]}>Didaktik-Bezug</Text>
          </View>
        )}

        {item.isChallengingPerspective && (
          <View style={[styles.quotaTag, { backgroundColor: colors.surfaceSecondary }]}>
            <Ionicons name="swap-horizontal-outline" size={11} color={colors.textSecondary} style={{ marginRight: 3 }} />
            <Text style={[styles.quotaTagText, { color: colors.textSecondary }]}>Gegenposition</Text>
          </View>
        )}
      </View>

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

      {/* Subtitle / Editorial Dek */}
      {item.subtitle && item.subtitle.trim().length > 0 && (
        <Text
          style={[
            styles.subtitle,
            { color: colors.textSecondary }
          ]}
          numberOfLines={2}
        >
          {item.subtitle}
        </Text>
      )}

      {/* Standalone Substantive Feed Reading (Rich in-feed reading experience) */}
      <Text
        style={[
          styles.feedText,
          { color: colors.textPrimary }
        ]}
        numberOfLines={isHero ? 7 : 5}
      >
        {displayFeedText}
      </Text>

      {/* Progressive Reader Action (Only shown when full article body exists) */}
      {hasExpandedBody && (
        <TouchableOpacity
          onPress={handleCardPress}
          activeOpacity={0.75}
          style={[styles.expandButton, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}
        >
          <View style={styles.expandButtonLeft}>
            <Ionicons name="book-outline" size={14} color={colors.accent} style={{ marginRight: 6 }} />
            <Text style={[styles.expandButtonText, { color: colors.accent }]}>
              Im Lesemodus vertiefen
            </Text>
          </View>
          <Text style={[styles.expandButtonMeta, { color: colors.textMuted }]}>
            {item.wordCount} Wörter →
          </Text>
        </TouchableOpacity>
      )}

      {/* Reading Progress Track (if started) */}
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

      {/* Bottom Footer Row: Why-Pill, Thumbs Feedback, Source/Completion */}
      <View style={[styles.footerRow, { borderTopColor: colors.borderSubtle }]}>
        <View style={styles.footerLeft}>
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

          {/* Feedback buttons */}
          <View style={styles.feedbackRow}>
            <TouchableOpacity
              onPress={() => handleFeedback('more_like_this')}
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              style={[
                styles.feedbackButton,
                currentFeedback === 'more_like_this' && { backgroundColor: colors.accentSubtle }
              ]}
              accessibilityLabel="Mehr Beiträge wie dieser"
            >
              <Ionicons
                name={currentFeedback === 'more_like_this' ? 'thumbs-up' : 'thumbs-up-outline'}
                size={13}
                color={currentFeedback === 'more_like_this' ? colors.accent : colors.textMuted}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleFeedback('less_like_this')}
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              style={[
                styles.feedbackButton,
                currentFeedback === 'less_like_this' && { backgroundColor: colors.surfaceSecondary }
              ]}
              accessibilityLabel="Weniger Beiträge wie dieser"
            >
              <Ionicons
                name={currentFeedback === 'less_like_this' ? 'thumbs-down' : 'thumbs-down-outline'}
                size={13}
                color={currentFeedback === 'less_like_this' ? colors.danger : colors.textMuted}
              />
            </TouchableOpacity>
          </View>
        </View>

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

function getLegacyFormatBadge(type: string): string | null {
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
    marginBottom: spacing.xs
  },
  metaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4
  },
  evidenceBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
    borderWidth: 0.5
  },
  evidenceBadgeText: {
    fontSize: 10,
    fontWeight: '500'
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center'
  },
  formatBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
    marginBottom: 6
  },
  formatBadgeText: {
    fontSize: typography.sizes.micro,
    fontWeight: '700',
    letterSpacing: 0.3
  },
  quotaTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill
  },
  quotaTagText: {
    fontSize: 10,
    fontWeight: '600'
  },
  title: {
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 4
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
    fontStyle: 'italic',
    marginBottom: spacing.sm
  },
  feedText: {
    fontSize: typography.sizes.bodySmall + 0.5,
    lineHeight: 21,
    letterSpacing: -0.1,
    marginBottom: spacing.md
  },
  expandButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 0.5,
    marginBottom: spacing.md
  },
  expandButtonLeft: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  expandButtonText: {
    fontSize: typography.sizes.caption,
    fontWeight: '600'
  },
  expandButtonMeta: {
    fontSize: typography.sizes.micro,
    fontWeight: '500'
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
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  whyPill: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  whyText: {
    fontSize: typography.sizes.micro,
    fontWeight: '500'
  },
  feedbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  feedbackButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center'
  },
  sourceText: {
    fontSize: typography.sizes.micro,
    maxWidth: 140
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
