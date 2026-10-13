import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  NativeSyntheticEvent,
  NativeScrollEvent
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../core/context/AppContext';
import { TopicBadge } from '../../ui/components/TopicBadge';
import { ReadingTimeBadge } from '../../ui/components/ReadingTimeBadge';
import { DeepeningCard } from '../../ui/components/DeepeningCard';
import { typography, radius, spacing } from '../../ui/theme';

export const ReaderScreen: React.FC = () => {
  const {
    selectedArticle,
    closeArticle,
    colors,
    isDark,
    setThemePreference,
    profile,
    setFontSize,
    interactions,
    toggleSaveItem,
    updateReadingProgress,
    setFeedback
  } = useApp();

  const [scrollPercent, setScrollPercent] = useState<number>(0);

  if (!selectedArticle) return null;

  const isSaved = interactions[selectedArticle.id]?.saved ?? false;
  const currentFeedback = interactions[selectedArticle.id]?.feedback;

  // Font sizing calculations
  const fontPref = profile.readingPreferences.fontSize;
  let bodyFontSize = 17;
  let bodyLineHeight = 27;

  if (fontPref === 'sm') {
    bodyFontSize = 15;
    bodyLineHeight = 24;
  } else if (fontPref === 'lg') {
    bodyFontSize = 19;
    bodyLineHeight = 30;
  } else if (fontPref === 'xl') {
    bodyFontSize = 21;
    bodyLineHeight = 33;
  }

  const cycleFontSize = () => {
    if (fontPref === 'sm') setFontSize('md');
    else if (fontPref === 'md') setFontSize('lg');
    else if (fontPref === 'lg') setFontSize('xl');
    else setFontSize('sm');
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = 20;
    const totalScrollable = contentSize.height - layoutMeasurement.height - paddingToBottom;
    if (totalScrollable > 0) {
      const pct = Math.min(100, Math.max(0, Math.round((contentOffset.y / totalScrollable) * 100)));
      setScrollPercent(pct);
      updateReadingProgress(selectedArticle.id, pct);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      {/* Pinned Reading Progress Bar */}
      <View style={[styles.progressTrack, { backgroundColor: colors.surfaceSecondary }]}>
        <View style={[styles.progressBar, { width: `${scrollPercent}%`, backgroundColor: colors.accent }]} />
      </View>

      {/* Reader Top Action Bar */}
      <View style={[styles.navBar, { borderBottomColor: colors.borderSubtle }]}>
        <TouchableOpacity
          onPress={closeArticle}
          style={[styles.navButton, { backgroundColor: colors.surfaceSecondary }]}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.navRight}>
          {/* Font Size Adjuster */}
          <TouchableOpacity
            onPress={cycleFontSize}
            style={[styles.navButton, { backgroundColor: colors.surfaceSecondary, marginRight: 8 }]}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={[styles.fontBtnText, { color: colors.textPrimary }]}>
              {fontPref.toUpperCase()}
            </Text>
          </TouchableOpacity>

          {/* Theme Toggle */}
          <TouchableOpacity
            onPress={() => setThemePreference(isDark ? 'light' : 'dark')}
            style={[styles.navButton, { backgroundColor: colors.surfaceSecondary, marginRight: 8 }]}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name={isDark ? 'sunny-outline' : 'moon-outline'} size={18} color={colors.textPrimary} />
          </TouchableOpacity>

          {/* Save / Bookmark Button */}
          <TouchableOpacity
            onPress={() => toggleSaveItem(selectedArticle.id)}
            style={[styles.navButton, { backgroundColor: isSaved ? colors.accentSubtle : colors.surfaceSecondary }]}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons
              name={isSaved ? 'bookmark' : 'bookmark-outline'}
              size={18}
              color={isSaved ? colors.accent : colors.textPrimary}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Article Body Scroll */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={32}
      >
        {/* Meta Header */}
        <View style={styles.metaRow}>
          <TopicBadge topic={selectedArticle.primaryTopic} size="md" />
          <View style={{ width: 8 }} />
          <ReadingTimeBadge minutes={selectedArticle.estimatedReadingMinutes} />
        </View>

        {/* Headline */}
        <Text style={[styles.headline, { color: colors.textPrimary }]}>
          {selectedArticle.title}
        </Text>

        {/* Subtitle / Dek */}
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {selectedArticle.subtitle}
        </Text>

        {/* Editorial Divider */}
        <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />

        {/* Article Body Paragraphs */}
        <View style={styles.bodyContainer}>
          {selectedArticle.body.split('\n\n').map((paragraph, index) => {
            // Editorial lead paragraph styling
            const isFirst = index === 0;

            return (
              <Text
                key={index}
                style={[
                  styles.paragraph,
                  {
                    color: colors.textPrimary,
                    fontSize: bodyFontSize,
                    lineHeight: bodyLineHeight,
                    fontWeight: isFirst ? '500' : '400'
                  }
                ]}
              >
                {paragraph}
              </Text>
            );
          })}
        </View>

        {/* Interactive Reflection / Deepening */}
        <DeepeningCard options={selectedArticle.deepeningOptions} />

        {/* Source Provenance Box */}
        <View style={[styles.provenanceBox, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
          <View style={styles.provenanceHeader}>
            <Ionicons name="shield-checkmark" size={16} color={colors.accent} style={{ marginRight: 6 }} />
            <Text style={[styles.provenanceTitle, { color: colors.textPrimary }]}>
              Verifizierte Quellenherkunft
            </Text>
          </View>

          {selectedArticle.sourceReferences.map((ref, idx) => (
            <View key={idx} style={[styles.sourceItem, { borderTopColor: colors.borderSubtle }]}>
              <Text style={[styles.sourcePublisher, { color: colors.accent }]}>
                {ref.publisher} {ref.author ? `• ${ref.author}` : ''}
              </Text>
              <Text style={[styles.sourceArticleTitle, { color: colors.textPrimary }]}>
                {ref.title}
              </Text>
              <Text style={[styles.sourceUrl, { color: colors.textMuted }]} numberOfLines={1}>
                {ref.originalUrl}
              </Text>
            </View>
          ))}

          <View style={styles.provenanceFooter}>
            <Text style={[styles.retrievalText, { color: colors.textMuted }]}>
              Abgerufen: {new Date(selectedArticle.generatedAt).toLocaleDateString('de-DE', { dateStyle: 'medium' })} • Status: Verifiziert
            </Text>
          </View>
        </View>

        {/* Feedback Section */}
        <View style={[styles.feedbackBox, { backgroundColor: colors.surfaceSecondary }]}>
          <Text style={[styles.feedbackPrompt, { color: colors.textPrimary }]}>
            War dieser Beitrag für Ihre Interessen relevant?
          </Text>
          <View style={styles.feedbackButtonsRow}>
            <TouchableOpacity
              onPress={() => setFeedback(selectedArticle.id, 'more_like_this')}
              style={[
                styles.feedbackPill,
                currentFeedback === 'more_like_this' && { backgroundColor: colors.accent }
              ]}
            >
              <Ionicons
                name="thumbs-up-outline"
                size={14}
                color={currentFeedback === 'more_like_this' ? '#FFFFFF' : colors.textSecondary}
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  styles.feedbackPillText,
                  { color: currentFeedback === 'more_like_this' ? '#FFFFFF' : colors.textPrimary }
                ]}
              >
                Mehr davon
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setFeedback(selectedArticle.id, 'less_like_this')}
              style={[
                styles.feedbackPill,
                currentFeedback === 'less_like_this' && { backgroundColor: colors.danger }
              ]}
            >
              <Ionicons
                name="thumbs-down-outline"
                size={14}
                color={currentFeedback === 'less_like_this' ? '#FFFFFF' : colors.textSecondary}
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  styles.feedbackPillText,
                  { color: currentFeedback === 'less_like_this' ? '#FFFFFF' : colors.textPrimary }
                ]}
              >
                Weniger
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1
  },
  progressTrack: {
    height: 3,
    width: '100%'
  },
  progressBar: {
    height: '100%'
  },
  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.pageHorizontal,
    paddingVertical: spacing.sm,
    borderBottomWidth: 0.5
  },
  navButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center'
  },
  navRight: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  fontBtnText: {
    fontSize: typography.sizes.micro,
    fontWeight: '800'
  },
  scrollContent: {
    paddingHorizontal: spacing.pageHorizontal,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl * 2
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md
  },
  headline: {
    fontFamily: typography.fontFamilies.serif,
    fontSize: typography.sizes.hero,
    lineHeight: typography.lineHeights.hero,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginBottom: spacing.sm
  },
  subtitle: {
    fontSize: typography.sizes.title2,
    lineHeight: typography.lineHeights.title2,
    fontWeight: '400',
    marginBottom: spacing.lg
  },
  divider: {
    height: 1,
    width: '100%',
    marginBottom: spacing.lg
  },
  bodyContainer: {
    marginBottom: spacing.lg
  },
  paragraph: {
    marginBottom: spacing.lg,
    letterSpacing: -0.1
  },
  provenanceBox: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.xl
  },
  provenanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm
  },
  provenanceTitle: {
    fontSize: typography.sizes.bodySmall,
    fontWeight: '700'
  },
  sourceItem: {
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
    borderTopWidth: 0.5
  },
  sourcePublisher: {
    fontSize: typography.sizes.micro,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  sourceArticleTitle: {
    fontSize: typography.sizes.bodySmall,
    fontWeight: '600',
    marginTop: 2
  },
  sourceUrl: {
    fontSize: typography.sizes.micro,
    marginTop: 2
  },
  provenanceFooter: {
    marginTop: spacing.sm,
    paddingTop: spacing.xs
  },
  retrievalText: {
    fontSize: typography.sizes.micro
  },
  feedbackBox: {
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center'
  },
  feedbackPrompt: {
    fontSize: typography.sizes.bodySmall,
    fontWeight: '600',
    marginBottom: spacing.sm
  },
  feedbackButtonsRow: {
    flexDirection: 'row',
    gap: 12
  },
  feedbackPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0,0,0,0.06)'
  },
  feedbackPillText: {
    fontSize: typography.sizes.bodySmall,
    fontWeight: '600'
  }
});
