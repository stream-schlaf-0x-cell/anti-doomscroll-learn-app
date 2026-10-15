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
import { ReadingTimeBadge } from '../../ui/components/ReadingTimeBadge';
import { DeepeningCard } from '../../ui/components/DeepeningCard';
import { typography, radius, spacing } from '../../ui/theme';
import { LinkPreviewModal } from '../../ui/components/LinkPreviewModal';
import { optimizeImageUrl } from '../../core/utils/imageQuality';
import { RaindropService } from '../../core/raindrop/raindropService';

export const ReaderScreen: React.FC = () => {
  const {
    selectedArticle,
    closeArticle,
    goHome,
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
  const [isRaindropSaved, setIsRaindropSaved] = useState<boolean>(false);
  const [layoutHeight, setLayoutHeight] = useState<number>(0);
  const [previewTarget, setPreviewTarget] = useState<{ visible: boolean; url: string; title: string; publisher: string } | null>(null);
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

  // Magazine Font sizing calculations: generous leading & golden measure
  const fontPref = profile.readingPreferences.fontSize;
  let bodyFontSize = 18;
  let bodyLineHeight = 32;

  if (fontPref === 'sm') {
    bodyFontSize = 16;
    bodyLineHeight = 28;
  } else if (fontPref === 'lg') {
    bodyFontSize = 20;
    bodyLineHeight = 35;
  } else if (fontPref === 'xl') {
    bodyFontSize = 22;
    bodyLineHeight = 38;
  }

  const cycleFontSize = () => {
    if (fontPref === 'sm') setFontSize('md');
    else if (fontPref === 'md') setFontSize('lg');
    else if (fontPref === 'lg') setFontSize('xl');
    else setFontSize('sm');
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = 30;
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

  const handleSaveToRaindrop = async () => {
    if (!selectedArticle) return;
    try {
      const originalUrl = selectedArticle.sourceReferences[0]?.originalUrl || selectedArticle.canonicalUrl;
      const res = await RaindropService.saveToRaindrop('demo', {
        title: selectedArticle.title,
        link: originalUrl || `https://atmen.app/article/${selectedArticle.id}`,
        excerpt: selectedArticle.keyInsight || selectedArticle.subtitle,
        tags: [selectedArticle.primaryTopic || 'philosophy', 'atmen', 'focus']
      });
      if (res.success) {
        setIsRaindropSaved(true);
      }
    } catch {
      // non-fatal
    }
  };

  const authorDisplay = selectedArticle.sourceReferences[0]?.author
    || selectedArticle.sourceBroadcasterName
    || 'Redaktion atmen';

  const publisherDisplay = selectedArticle.sourceReferences[0]?.publisher
    || selectedArticle.sourceBroadcasterName
    || 'Fachpublikation';

  const remainingMinutes = Math.max(1, Math.round((1 - scrollPercent / 100) * selectedArticle.estimatedReadingMinutes));

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      {/* Pinned Reading Progress Bar */}
      <View style={[styles.progressTrack, { backgroundColor: colors.surfaceSecondary }]}>
        <View style={[styles.progressBar, { width: `${scrollPercent}%`, backgroundColor: colors.accent }]} />
      </View>

      {/* Magazine Editorial Top Action Bar */}
      <View style={[styles.navBar, { backgroundColor: colors.surface, borderBottomColor: colors.borderSubtle }]}>
        <View style={styles.navBarInner}>
          {/* Back Pill with originating Space */}
          <TouchableOpacity
            onPress={handleClose}
            style={[styles.backPill, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Zurück zur Übersicht"
          >
            <Ionicons name="arrow-back" size={15} color={colors.accent} style={{ marginRight: 6 }} />
            <Text style={[styles.backPillText, { color: colors.textPrimary }]} numberOfLines={1}>
              {selectedArticle.space || 'Zurück'}
            </Text>
          </TouchableOpacity>

          {/* Center Magazine Brand - Always Clickable to go Home */}
          <TouchableOpacity
            onPress={goHome}
            style={styles.centerBrand}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Zurück zur Startseite"
          >
            <View style={[styles.brandEmblem, { backgroundColor: colors.accent }]}>
              <Text style={styles.brandEmblemGlyph}>◎</Text>
            </View>
            <Text style={[styles.brandTitle, { color: colors.textPrimary }]}>
              atmen <Text style={{ fontWeight: '400', fontStyle: 'italic', color: colors.textMuted }}>magazin</Text>
            </Text>
          </TouchableOpacity>

          {/* Right Tools: Progress, Font Size, Theme, Home & Save */}
          <View style={styles.navRight}>
            {/* Direct Home Button */}
            <TouchableOpacity
              onPress={goHome}
              style={[styles.navButton, { backgroundColor: colors.surfaceSecondary }]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Zur Startseite"
            >
              <Ionicons name="home-outline" size={16} color={colors.accent} />
            </TouchableOpacity>

            {/* Reading Progress Pill */}
            <View style={[styles.readingProgressPill, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
              <Text style={[styles.readingProgressText, { color: colors.textSecondary }]}>
                {scrollPercent}% • noch {remainingMinutes}m
              </Text>
            </View>

            {/* Font Size Adjuster */}
            <TouchableOpacity
              onPress={cycleFontSize}
              style={[styles.navButton, { backgroundColor: colors.surfaceSecondary }]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel={`Schriftgröße ändern, aktuell: ${fontPref}`}
            >
              <Text style={[styles.fontBtnText, { color: colors.textPrimary }]}>
                A{fontPref === 'sm' ? '-' : fontPref === 'xl' ? '++' : '+'}
              </Text>
            </TouchableOpacity>

            {/* Theme Toggle */}
            <TouchableOpacity
              onPress={() => setThemePreference(isDark ? 'light' : 'dark')}
              style={[styles.navButton, { backgroundColor: colors.surfaceSecondary }]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel={isDark ? 'Helles Erscheinungsbild aktivieren' : 'Dunkles Erscheinungsbild aktivieren'}
            >
              <Ionicons name={isDark ? 'sunny-outline' : 'moon-outline'} size={16} color={colors.textSecondary} />
            </TouchableOpacity>

            {/* Save / Bookmark Button */}
            <TouchableOpacity
              onPress={() => toggleSaveItem(selectedArticle.id)}
              style={[styles.navButton, { backgroundColor: isSaved ? colors.accentSubtle : colors.surfaceSecondary }]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel={isSaved ? 'Aus Bibliothek entfernen' : 'In Bibliothek speichern'}
            >
              <Ionicons
                name={isSaved ? 'bookmark' : 'bookmark-outline'}
                size={16}
                color={isSaved ? colors.accent : colors.textPrimary}
              />
            </TouchableOpacity>

            {/* Raindrop.io 1-Click Export Button */}
            <TouchableOpacity
              onPress={handleSaveToRaindrop}
              style={[styles.navButton, { backgroundColor: isRaindropSaved ? '#0284C7' + '22' : colors.surfaceSecondary }]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="In Raindrop.io speichern"
            >
              <Ionicons
                name={isRaindropSaved ? 'water' : 'water-outline'}
                size={16}
                color={isRaindropSaved ? '#0284C7' : colors.textPrimary}
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
          {/* Magazine Kicker Header */}
          <View style={styles.kickerRow}>
            <Text style={[styles.kickerText, { color: colors.accent }]}>
              {(selectedArticle.space || 'C/RECHERCHE').toUpperCase()} • ESSAY & ANALYSE
            </Text>

            <View style={[styles.trustBadge, { backgroundColor: colors.accentSubtle, borderColor: colors.borderSubtle }]}>
              <Ionicons name="shield-checkmark" size={11} color={colors.accent} style={{ marginRight: 4 }} />
              <Text style={[styles.trustBadgeText, { color: colors.accent }]}>Verifizierte Fachquelle</Text>
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
              <Ionicons name="bookmark" size={15} color={colors.accent} style={{ marginRight: 8 }} />
              <Text style={[styles.resumeCardText, { color: colors.textPrimary }]}>
                Zuletzt bei <Text style={{ fontWeight: '700', color: colors.accent }}>{savedProgress}%</Text> gelesen
              </Text>
              <View style={{ flex: 1 }} />
              <Text style={[styles.resumeActionText, { color: colors.accent }]}>Fortsetzen →</Text>
            </TouchableOpacity>
          )}

          {/* Magazine Editorial Headline */}
          <Text style={[styles.headline, { color: colors.textPrimary }]}>
            {selectedArticle.title}
          </Text>

          {/* Magazine Subtitle / Deck */}
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {selectedArticle.subtitle}
          </Text>

          {/* Editorial Byline & Provenance Strip */}
          <View style={[styles.bylineCard, { borderTopColor: colors.borderSubtle, borderBottomColor: colors.borderSubtle }]}>
            <View style={styles.bylineLeft}>
              <Text style={[styles.bylineAuthor, { color: colors.textPrimary }]}>
                Von <Text style={{ fontWeight: '700' }}>{authorDisplay}</Text>
              </Text>
              <Text style={[styles.bylinePublisher, { color: colors.textMuted }]}>
                Publiziert in {publisherDisplay} {selectedArticle.sourceReferences[0]?.publicationTimestamp ? `• ${selectedArticle.sourceReferences[0].publicationTimestamp}` : ''}
              </Text>
            </View>

            <View style={styles.bylineRight}>
              <ReadingTimeBadge minutes={selectedArticle.estimatedReadingMinutes} />
              <Text style={[styles.bylineMetrics, { color: colors.textMuted }]}>
                ca. {selectedArticle.wordCount ?? Math.round(selectedArticle.body.split(/\s+/).length)} Wörter
              </Text>
            </View>
          </View>

          {/* Hero Visual Image */}
          {selectedArticle.imageUrl && (
            <View style={[styles.readerImageContainer, { borderColor: colors.borderSubtle }]}>
              <Image
                source={{ uri: optimizeImageUrl(selectedArticle.imageUrl) || selectedArticle.imageUrl }}
                style={styles.readerHeroImage}
                resizeMode="cover"
              />
              <View style={[styles.imageCaptionBar, { backgroundColor: colors.surfaceSecondary }]}>
                <Ionicons name="camera-outline" size={12} color={colors.textMuted} style={{ marginRight: 6 }} />
                <Text style={[styles.imageCaptionText, { color: colors.textMuted }]} numberOfLines={1}>
                  Titel-Illustration • Quelle: {publisherDisplay}
                </Text>
              </View>
            </View>
          )}

          {/* Key Insight Pull Quote (Aeon style) */}
          {selectedArticle.keyInsight && (
            <View style={[styles.pullQuoteBox, { borderLeftColor: colors.accent, backgroundColor: colors.surfaceSecondary }]}>
              <Text style={[styles.pullQuoteText, { color: colors.textPrimary }]}>
                „{selectedArticle.keyInsight}“
              </Text>
              <Text style={[styles.pullQuoteAttribution, { color: colors.accent }]}>
                — Leitgedanke der Publikation
              </Text>
            </View>
          )}

          {/* Article Body Paragraphs with Lede Styling */}
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
                      fontSize: isFirst ? bodyFontSize + 2 : bodyFontSize,
                      lineHeight: isFirst ? bodyLineHeight + 5 : bodyLineHeight,
                      fontWeight: isFirst ? '500' : '400',
                      letterSpacing: -0.15
                    }
                  ]}
                >
                  {paragraph}
                </Text>
              );
            })}
          </View>

          {/* Breath Rhythm & Intellectual Pause Ornament */}
          <View style={styles.breathOrnament}>
            <View style={[styles.ornamentLine, { backgroundColor: colors.borderSubtle }]} />
            <View style={[styles.ornamentCenter, { borderColor: colors.borderSubtle, backgroundColor: colors.surfaceSecondary }]}>
              <Text style={[styles.ornamentGlyph, { color: colors.accent }]}>◎</Text>
            </View>
            <View style={[styles.ornamentLine, { backgroundColor: colors.borderSubtle }]} />
          </View>

          {/* Interactive Socratic Sparring Salon (Vertiefung & Didaktik) */}
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
              <View
                key={idx}
                style={[styles.sourceCardBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}
              >
                <View style={styles.sourceCardTop}>
                  <View style={[styles.sourcePublisherBadge, { backgroundColor: colors.accentSubtle }]}>
                    <Ionicons name="newspaper-outline" size={13} color={colors.accent} style={{ marginRight: 5 }} />
                    <Text style={[styles.sourcePublisher, { color: colors.accent }]}>
                      {ref.publisher} {ref.author ? `• ${ref.author}` : ''}
                    </Text>
                  </View>
                  {ref.publicationTimestamp && (
                    <Text style={[styles.sourcePublishedDate, { color: colors.textMuted }]}>
                      {ref.publicationTimestamp}
                    </Text>
                  )}
                </View>

                <Text style={[styles.sourceArticleTitle, { color: colors.textPrimary }]}>
                  {ref.title}
                </Text>

                <Text style={[styles.sourceUrl, { color: colors.textMuted }]} numberOfLines={1}>
                  {ref.originalUrl}
                </Text>

                <View style={[styles.sourceCardActions, { borderTopColor: colors.borderSubtle }]}>
                  <TouchableOpacity
                    onPress={() => setPreviewTarget({
                      visible: true,
                      url: ref.originalUrl,
                      title: ref.title,
                      publisher: ref.publisher
                    })}
                    style={[styles.sourcePreviewActionBtn, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="eye-outline" size={13} color={colors.accent} style={{ marginRight: 5 }} />
                    <Text style={[styles.sourcePreviewActionBtnText, { color: colors.textPrimary }]}>Schnell-Vorschau</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleOpenSource(ref.originalUrl)}
                    style={[styles.sourceOpenActionBtn, { backgroundColor: colors.accent }]}
                    activeOpacity={0.85}
                    accessibilityRole="link"
                  >
                    <Text style={styles.sourceOpenActionBtnText}>Original lesen ↗</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}

            <View style={[styles.provenanceFooter, { borderTopColor: colors.borderSubtle }]}>
              <Text style={[styles.retrievalText, { color: colors.textMuted }]}>
                Erfasst in atmen: {new Date(selectedArticle.generatedAt).toLocaleDateString('de-DE', { dateStyle: 'medium' })}
              </Text>
              <Text style={[styles.retrievalDisclaimer, { color: colors.textMuted }]}>
                Hinweis: Alle Quellverweise sind echte Fachbeiträge aus dem atmen News-Hub (Öffentlich-Rechtliche, Universitäten, Fachverlage).
              </Text>
            </View>
          </View>

          {/* Feedback Section */}
          <View style={[styles.feedbackBox, { backgroundColor: colors.surfaceSecondary }]}>
            <Text style={[styles.feedbackPrompt, { color: colors.textPrimary }]}>
              War dieser Beitrag für deine intellektuellen Interessen relevant?
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

      {/* In-App Quick Source Preview Modal */}
      {previewTarget && (
        <LinkPreviewModal
          visible={previewTarget.visible}
          onClose={() => setPreviewTarget(null)}
          url={previewTarget.url}
          title={previewTarget.title}
          publisher={previewTarget.publisher}
          snippet={selectedArticle?.feedText || selectedArticle?.subtitle}
          estimatedMinutes={selectedArticle?.estimatedReadingMinutes}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1
  },
  notFoundContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl
  },
  notFoundTitle: {
    fontSize: typography.sizes.title1,
    fontWeight: '800',
    marginBottom: spacing.xs
  },
  notFoundSubtitle: {
    fontSize: typography.sizes.body,
    textAlign: 'center',
    marginBottom: spacing.lg
  },
  notFoundButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.pill
  },
  notFoundButtonText: {
    color: '#FFFFFF',
    fontWeight: '700'
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
    paddingVertical: 8,
    borderBottomWidth: 0.5
  },
  navBarInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    maxWidth: 760,
    width: '100%',
    alignSelf: 'center',
    gap: spacing.sm
  },
  backPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 0.5,
    maxWidth: 150
  },
  backPillText: {
    fontSize: typography.sizes.caption,
    fontWeight: '700'
  },
  centerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  brandEmblem: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center'
  },
  brandEmblemGlyph: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 13,
    lineHeight: 14
  },
  brandTitle: {
    fontFamily: typography.fontFamilies.serif,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  navRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  readingProgressPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 0.5
  },
  readingProgressText: {
    fontSize: 11,
    fontWeight: '700'
  },
  navButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center'
  },
  fontBtnText: {
    fontSize: 11,
    fontWeight: '800'
  },
  scrollContent: {
    paddingHorizontal: spacing.pageHorizontal,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl * 2
  },
  scrollInner: {
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center'
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm
  },
  kickerText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2
  },
  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 0.5
  },
  trustBadgeText: {
    fontSize: 10,
    fontWeight: '700'
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
    fontSize: 34,
    lineHeight: 44,
    fontWeight: '800',
    letterSpacing: -0.6,
    marginBottom: spacing.sm
  },
  subtitle: {
    fontFamily: typography.fontFamilies.serif,
    fontSize: 20,
    lineHeight: 30,
    fontStyle: 'italic',
    fontWeight: '400',
    marginBottom: spacing.md
  },
  bylineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderTopWidth: 0.5,
    borderBottomWidth: 0.5,
    marginBottom: spacing.lg
  },
  bylineLeft: {
    flex: 1
  },
  bylineAuthor: {
    fontSize: typography.sizes.bodySmall,
    marginBottom: 2
  },
  bylinePublisher: {
    fontSize: typography.sizes.micro
  },
  bylineRight: {
    alignItems: 'flex-end',
    gap: 4
  },
  bylineMetrics: {
    fontSize: typography.sizes.micro
  },
  readerImageContainer: {
    width: '100%',
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 0.5,
    marginBottom: spacing.lg
  },
  readerHeroImage: {
    width: '100%',
    height: 380
  },
  imageCaptionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs
  },
  imageCaptionText: {
    fontSize: 11
  },
  pullQuoteBox: {
    borderLeftWidth: 3,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    marginVertical: spacing.lg
  },
  pullQuoteText: {
    fontFamily: typography.fontFamilies.serif,
    fontSize: 20,
    lineHeight: 32,
    fontStyle: 'italic'
  },
  pullQuoteAttribution: {
    fontSize: typography.sizes.micro,
    fontWeight: '700',
    marginTop: 6
  },
  bodyContainer: {
    marginBottom: spacing.lg
  },
  paragraph: {
    fontFamily: typography.fontFamilies.serif,
    marginBottom: 24
  },
  breathOrnament: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.xl,
    gap: spacing.md
  },
  ornamentLine: {
    flex: 1,
    height: 0.5
  },
  ornamentCenter: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 0.5,
    justifyContent: 'center',
    alignItems: 'center'
  },
  ornamentGlyph: {
    fontSize: 14,
    fontWeight: '900'
  },
  provenanceBox: {
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 0.5,
    marginTop: spacing.xl
  },
  provenanceHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md
  },
  provenanceTitle: {
    fontSize: typography.sizes.body,
    fontWeight: '800',
    marginBottom: 2
  },
  provenanceSubtitle: {
    fontSize: typography.sizes.caption
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
    fontWeight: '700'
  },
  sourceListHeader: {
    fontSize: typography.sizes.caption,
    fontWeight: '800',
    marginBottom: spacing.sm
  },
  sourceCardBox: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm
  },
  sourceCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6
  },
  sourcePublisherBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full
  },
  sourcePublisher: {
    fontSize: 11,
    fontWeight: '700'
  },
  sourceArticleTitle: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    marginBottom: 4
  },
  sourcePublishedDate: {
    fontSize: 11
  },
  sourceUrl: {
    fontSize: 10,
    marginBottom: 8
  },
  sourceCardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 0.5,
    gap: 8
  },
  sourcePreviewActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.sm,
    borderWidth: 0.5
  },
  sourcePreviewActionBtnText: {
    fontSize: 11,
    fontWeight: '600'
  },
  sourceOpenActionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.sm
  },
  sourceOpenActionBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700'
  },
  provenanceFooter: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 0.5
  },
  retrievalText: {
    fontSize: typography.sizes.micro,
    marginBottom: 2
  },
  retrievalDisclaimer: {
    fontSize: 10,
    lineHeight: 14
  },
  feedbackBox: {
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center'
  },
  feedbackPrompt: {
    fontSize: typography.sizes.bodySmall,
    fontWeight: '700',
    marginBottom: spacing.md,
    textAlign: 'center'
  },
  feedbackButtonsRow: {
    flexDirection: 'row',
    gap: spacing.md
  },
  feedbackPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0,0,0,0.06)'
  },
  feedbackPillText: {
    fontSize: typography.sizes.caption,
    fontWeight: '700'
  }
});
