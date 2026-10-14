import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../core/context/AppContext';
import { formatFactReviewStatus } from '../../core/domain/types';
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
    flushReadingProgress,
    setFeedback
  } = useApp();

  const [scrollPercent, setScrollPercent] = useState<number>(0);
  const [contentHeight, setContentHeight] = useState<number>(0);
  const [layoutHeight, setLayoutHeight] = useState<number>(0);
  const scrollViewRef = useRef<ScrollView>(null);

  // Flush throttled progress on unmount
  useEffect(() => {
    return () => {
      void flushReadingProgress();
    };
  }, [flushReadingProgress]);

  const handleClose = async () => {
    await flushReadingProgress();
    closeArticle();
  };

  if (!selectedArticle) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.notFoundContainer}>
          <Ionicons name="document-text-outline" size={54} color={colors.textMuted} style={{ marginBottom: spacing.md }} />
          <Text style={[styles.notFoundTitle, { color: colors.textPrimary }]}>
            Artikel nicht gefunden
          </Text>
          <Text style={[styles.notFoundSubtitle, { color: colors.textSecondary }]}>
            Der angeforderte Beitrag existiert nicht oder wurde in dieser Ausgabe entfernt.
          </Text>
          <TouchableOpacity
            style={[styles.notFoundButton, { backgroundColor: colors.accent }]}
            onPress={handleClose}
            accessibilityRole="button"
            accessibilityLabel="Zurück zur Tagesausgabe"
          >
            <Text style={styles.notFoundButtonText}>Zurück zur Tagesausgabe</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isSaved = interactions[selectedArticle.id]?.saved ?? false;
  const currentFeedback = interactions[selectedArticle.id]?.feedback;
  const savedProgress = interactions[selectedArticle.id]?.progressPercent ?? 0;

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

  const handleResumeReading = () => {
    if (contentHeight > layoutHeight && savedProgress > 0) {
      const targetY = (savedProgress / 100) * (contentHeight - layoutHeight);
      scrollViewRef.current?.scrollTo({ y: targetY, animated: true });
    }
  };

  const handleOpenSource = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        console.warn('Cannot open url:', url);
      }
    } catch (e) {
      console.warn('Error opening external link:', e);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      {/* Pinned Reading Progress Bar */}
      <View style={[styles.progressTrack, { backgroundColor: colors.surfaceSecondary }]}>
        <View style={[styles.progressBar, { width: `${scrollPercent}%`, backgroundColor: colors.accent }]} />
      </View>

      {/* Reader Top Action Bar */}
      <View style={[styles.navBar, { borderBottomColor: colors.borderSubtle }]}>
        <View style={styles.navBarInner}>
          <TouchableOpacity
            onPress={handleClose}
            style={[styles.navButton, { backgroundColor: colors.surfaceSecondary }]}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Zurück zur vorherigen Ansicht"
          >
            <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
          </TouchableOpacity>

          <View style={styles.navRight}>
            {/* Font Size Adjuster */}
            <TouchableOpacity
              onPress={cycleFontSize}
              style={[styles.navButton, { backgroundColor: colors.surfaceSecondary, marginRight: 8 }]}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel={`Schriftgröße ändern, aktuell: ${fontPref}`}
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
              accessibilityRole="button"
              accessibilityLabel={isDark ? 'Helles Erscheinungsbild aktivieren' : 'Dunkles Erscheinungsbild aktivieren'}
            >
              <Ionicons name={isDark ? 'sunny-outline' : 'moon-outline'} size={18} color={colors.textPrimary} />
            </TouchableOpacity>

            {/* Save / Bookmark Button */}
            <TouchableOpacity
              onPress={() => toggleSaveItem(selectedArticle.id)}
              style={[styles.navButton, { backgroundColor: isSaved ? colors.accentSubtle : colors.surfaceSecondary }]}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel={isSaved ? 'Aus Bibliothek entfernen' : 'In Bibliothek speichern'}
            >
              <Ionicons
                name={isSaved ? 'bookmark' : 'bookmark-outline'}
                size={18}
                color={isSaved ? colors.accent : colors.textPrimary}
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Article Body Scroll */}
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={32}
        onContentSizeChange={(_w, h) => setContentHeight(h)}
        onLayout={(e) => setLayoutHeight(e.nativeEvent.layout.height)}
      >
        <View style={styles.scrollInner}>
          {/* Meta Header */}
          <View style={styles.metaRow}>
            <TopicBadge topic={selectedArticle.primaryTopic} size="md" />
            <View style={{ width: 8 }} />
            <ReadingTimeBadge minutes={selectedArticle.estimatedReadingMinutes} />
            <View style={{ width: 8 }} />
            <View style={[styles.demoPill, { backgroundColor: colors.accentSubtle, borderColor: colors.borderSubtle }]}>
              <Text style={[styles.demoPillText, { color: colors.accent }]}>COMMUNITY</Text>
            </View>
          </View>

          {/* Reopen Bookmark / Resume Banner */}
          {savedProgress > 5 && savedProgress < 95 && (
            <TouchableOpacity
              style={[styles.resumeCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.accent }]}
              onPress={handleResumeReading}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={`An gespeicherte Leseposition bei ${savedProgress} Prozent springen`}
            >
              <Ionicons name="bookmark" size={16} color={colors.accent} style={{ marginRight: 8 }} />
              <Text style={[styles.resumeCardText, { color: colors.textPrimary }]}>
                Zuletzt bei <Text style={{ fontWeight: '700', color: colors.accent }}>{savedProgress}%</Text> gelesen
              </Text>
              <View style={{ flex: 1 }} />
              <Text style={[styles.resumeActionText, { color: colors.accent }]}>Fortsetzen →</Text>
            </TouchableOpacity>
          )}

          {/* Headline */}
          <Text style={[styles.headline, { color: colors.textPrimary }]}>
            {selectedArticle.title}
          </Text>

          {/* Subtitle / Dek */}
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {selectedArticle.subtitle}
          </Text>

          {/* Hero Visual Image */}
          {selectedArticle.imageUrl && (
            <View style={styles.readerImageContainer}>
              <Image
                source={{ uri: selectedArticle.imageUrl }}
                style={styles.readerHeroImage}
                resizeMode="cover"
              />
            </View>
          )}

          {/* Word count & Reading rate honest indicator */}
          <View style={styles.editorialMetricsRow}>
            <Text style={[styles.editorialMetricsText, { color: colors.textMuted }]}>
              {selectedArticle.wordCount ?? Math.round(selectedArticle.body.split(/\s+/).length)} Wörter • ca. {selectedArticle.estimatedReadingMinutes} Min. Lesezeit (220 W/Min.)
            </Text>
          </View>

          {/* Editorial Divider */}
          <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />

        {/* Article Body Paragraphs */}
        <View style={styles.bodyContainer}>
          {selectedArticle.body.split('\n\n').map((paragraph, index) => {
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

        {/* Honest Source Provenance Box */}
        <View style={[styles.provenanceBox, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
          <View style={styles.provenanceHeader}>
            <Ionicons name="shield-checkmark" size={18} color={colors.accent} style={{ marginRight: 8 }} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.provenanceTitle, { color: colors.textPrimary }]}>
                Redaktionelle Herkunft & Transparenz
              </Text>
              <Text style={[styles.provenanceSubtitle, { color: colors.textMuted }]}>
                {selectedArticle.provenanceSummary ?? 'Kuratierter Fachbeitrag für deine persönliche Ausgabe'}
              </Text>
            </View>
          </View>

          {/* Editorial / Fact Review Badge */}
          <View style={styles.provenanceBadgeRow}>
            <View style={[styles.reviewBadge, { backgroundColor: colors.surfaceSecondary }]}>
              <Text style={[styles.reviewBadgeText, { color: colors.textSecondary }]}>
                Status: {formatFactReviewStatus(selectedArticle.factReviewStatus)}
              </Text>
            </View>
            <View style={[styles.reviewBadge, { backgroundColor: colors.surfaceSecondary }]}>
              <Text style={[styles.reviewBadgeText, { color: colors.textSecondary }]}>
                {selectedArticle.aiAssisted ? 'KI-gestützt & didaktisch kuratiert' : 'Didaktische Kuration'}
              </Text>
            </View>
          </View>

          {/* Sources List with active Links */}
          <Text style={[styles.sourceListHeader, { color: colors.textPrimary }]}>
            Referenzierte Fachquellen:
          </Text>

          {selectedArticle.sourceReferences.map((ref, idx) => (
            <TouchableOpacity
              key={idx}
              onPress={() => handleOpenSource(ref.originalUrl)}
              activeOpacity={0.7}
              style={[styles.sourceItem, { borderTopColor: colors.borderSubtle }]}
              accessibilityRole="link"
              accessibilityLabel={`Quelle ${ref.publisher} im Browser öffnen`}
            >
              <View style={styles.sourceItemTop}>
                <Text style={[styles.sourcePublisher, { color: colors.accent }]}>
                  {ref.publisher} {ref.author ? `• ${ref.author}` : ''}
                </Text>
                <Ionicons name="open-outline" size={14} color={colors.accent} />
              </View>
              <Text style={[styles.sourceArticleTitle, { color: colors.textPrimary }]}>
                {ref.title}
              </Text>
              {ref.publicationTimestamp && (
                <Text style={[styles.sourcePublishedDate, { color: colors.textMuted }]}>
                  Original-Publikation: {ref.publicationTimestamp}
                </Text>
              )}
              <Text style={[styles.sourceUrl, { color: colors.textMuted }]} numberOfLines={1}>
                {ref.originalUrl}
              </Text>
            </TouchableOpacity>
          ))}

          <View style={[styles.provenanceFooter, { borderTopColor: colors.borderSubtle }]}>
            <Text style={[styles.retrievalText, { color: colors.textMuted }]}>
              Erfasst in Atem (Demo-Abruf): {new Date(selectedArticle.generatedAt).toLocaleDateString('de-DE', { dateStyle: 'medium' })}
            </Text>
            <Text style={[styles.retrievalDisclaimer, { color: colors.textMuted }]}>
              Hinweis: Dies ist ein redaktionelles Demonstrations-Exemplar für Phase 1.2. Alle Quellverweise sind reale Fachbeiträge, die Kuration und didaktischen Vertiefungen dienen der Erprobung.
            </Text>
          </View>
        </View>

        {/* Feedback Section */}
        <View style={[styles.feedbackBox, { backgroundColor: colors.surfaceSecondary }]}>
          <Text style={[styles.feedbackPrompt, { color: colors.textPrimary }]}>
            War dieser Beitrag für deine Interessen relevant?
          </Text>
          <View style={styles.feedbackButtonsRow}>
            <TouchableOpacity
              onPress={() => setFeedback(selectedArticle.id, 'more_like_this')}
              style={[
                styles.feedbackPill,
                currentFeedback === 'more_like_this' && { backgroundColor: colors.accent }
              ]}
              accessibilityRole="button"
              accessibilityLabel="Mehr Beiträge wie diesen anzeigen"
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
              accessibilityRole="button"
              accessibilityLabel="Weniger Beiträge wie diesen anzeigen"
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
    paddingHorizontal: spacing.pageHorizontal,
    paddingVertical: spacing.sm,
    borderBottomWidth: 0.5
  },
  navBarInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    maxWidth: 740,
    width: '100%',
    alignSelf: 'center'
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
  scrollInner: {
    maxWidth: 740,
    width: '100%',
    alignSelf: 'center'
  },
  readerImageContainer: {
    width: '100%',
    height: 240,
    borderRadius: radius.md,
    overflow: 'hidden',
    marginVertical: spacing.md
  },
  readerHeroImage: {
    width: '100%',
    height: '100%'
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: spacing.md
  },
  demoPill: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 0.5
  },
  demoPillText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  resumeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.md
  },
  resumeCardText: {
    fontSize: typography.sizes.bodySmall
  },
  resumeActionText: {
    fontSize: typography.sizes.bodySmall,
    fontWeight: '700'
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
    marginBottom: spacing.sm
  },
  editorialMetricsRow: {
    marginBottom: spacing.md
  },
  editorialMetricsText: {
    fontSize: typography.sizes.micro,
    fontWeight: '500'
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
  provenanceSubtitle: {
    fontSize: typography.sizes.micro,
    marginTop: 2
  },
  provenanceBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: spacing.md
  },
  reviewBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm
  },
  reviewBadgeText: {
    fontSize: typography.sizes.micro,
    fontWeight: '600'
  },
  sourceListHeader: {
    fontSize: typography.sizes.bodySmall,
    fontWeight: '700',
    marginTop: spacing.xs,
    marginBottom: spacing.xs
  },
  sourceItem: {
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
    borderTopWidth: 0.5
  },
  sourceItemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
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
  sourcePublishedDate: {
    fontSize: typography.sizes.micro,
    marginTop: 2
  },
  sourceUrl: {
    fontSize: typography.sizes.micro,
    marginTop: 2,
    textDecorationLine: 'underline'
  },
  provenanceFooter: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 0.5
  },
  retrievalText: {
    fontSize: typography.sizes.micro,
    fontWeight: '600',
    marginBottom: 4
  },
  retrievalDisclaimer: {
    fontSize: typography.sizes.micro,
    lineHeight: 15
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
    paddingVertical: 10,
    minHeight: 44,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0,0,0,0.06)'
  },
  feedbackPillText: {
    fontSize: typography.sizes.bodySmall,
    fontWeight: '600'
  },
  notFoundContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.pageHorizontal * 2
  },
  notFoundTitle: {
    fontSize: typography.sizes.title1,
    fontWeight: '700',
    marginBottom: spacing.xs,
    textAlign: 'center'
  },
  notFoundSubtitle: {
    fontSize: typography.sizes.body,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.lg
  },
  notFoundButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    minHeight: 48,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center'
  },
  notFoundButtonText: {
    color: '#FFFFFF',
    fontSize: typography.sizes.body,
    fontWeight: '600'
  }
});
