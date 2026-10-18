import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Image,
  Platform,
  useWindowDimensions,
  TextInput,
  Modal
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../core/context/AppContext';
import {
  formatFactReviewStatus,
  formatVerifiedProvenanceLabel
} from '../../core/domain/types';
import { synthesizeEditorialAbstract } from '../../core/synthesis/backgroundResearchPipeline';
import { ReadingTimeBadge } from '../../ui/components/ReadingTimeBadge';
import { DeepeningCard } from '../../ui/components/DeepeningCard';
import { typography, radius, spacing } from '../../ui/theme';
import { LinkPreviewModal } from '../../ui/components/LinkPreviewModal';
import { optimizeImageUrl } from '../../core/utils/imageQuality';
import { RaindropService } from '../../core/raindrop/raindropService';
import { copyToClipboard } from '../../core/export/craftExport';
import { MarkdownContent } from '../../ui/components/MarkdownContent';
import { RabbitHoleService, RabbitHoleEntry } from '../../core/synthesis/rabbitHoleService';
import { isFeatureEnabled } from '../../core/modules/featureRegistry';
import { QuizCheckpointCard } from '../../ui/components/QuizCheckpointCard';
import { generateQuizForArticle } from '../../core/quiz/quizGenerator';

export const ReaderScreen: React.FC = () => {
  const {
    selectedArticle,
    closeArticle,
    openArticle,
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
    setFeedback,
    addNote
  } = useApp();

  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isDesktop = width >= 1024;

  const [scrollPercent, setScrollPercent] = useState<number>(0);
  const [contentHeight, setContentHeight] = useState<number>(0);
  const [isRaindropSaved, setIsRaindropSaved] = useState<boolean>(false);
  const [craftCopied, setCraftCopied] = useState<boolean>(false);
  const [layoutHeight, setLayoutHeight] = useState<number>(0);
  const [previewTarget, setPreviewTarget] = useState<{ visible: boolean; url: string; title: string; publisher: string } | null>(null);
  const [noteText, setNoteText] = useState<string>('');
  const [selectedTag, setSelectedTag] = useState<'einwand' | 'unterricht' | 'these' | 'notiz'>('einwand');
  const [isSubmittingNote, setIsSubmittingNote] = useState<boolean>(false);
  const [readerImageAspectRatio, setReaderImageAspectRatio] = useState<number | null>(null);
  const [showReaderImageLightbox, setShowReaderImageLightbox] = useState<boolean>(false);
  const [rabbitHoleEntries, setRabbitHoleEntries] = useState<RabbitHoleEntry[]>([]);
  const [loadingRabbitHole, setLoadingRabbitHole] = useState<boolean>(false);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    const uri = selectedArticle?.artMeta?.highResImageUrl || selectedArticle?.imageUrl;
    if (!uri) {
      setReaderImageAspectRatio(null);
      return;
    }
    let cancelled = false;
    Image.getSize(
      uri,
      (w, h) => {
        if (!cancelled && w > 0 && h > 0) {
          setReaderImageAspectRatio(w / h);
        }
      },
      () => {
        // Fallback handled by onLoad on <Image>
      }
    );
    return () => {
      cancelled = true;
    };
  }, [selectedArticle?.id, selectedArticle?.imageUrl, selectedArticle?.artMeta?.highResImageUrl]);

  // Load conceptually targeted companion reads (Rabbit Hole)
  useEffect(() => {
    if (!selectedArticle) return;
    let isMounted = true;
    setLoadingRabbitHole(true);
    RabbitHoleService.discoverRabbitHole(selectedArticle, { maxItems: 4, allowLiveResearch: true })
      .then((entries) => {
        if (isMounted) {
          setRabbitHoleEntries(entries);
          setLoadingRabbitHole(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setLoadingRabbitHole(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, [selectedArticle]);

  // Flush throttled progress on unmount
  useEffect(() => {
    return () => {
      void flushReadingProgress();
    };
  }, [flushReadingProgress]);

  const handleClose = useCallback(async () => {
    await flushReadingProgress();
    closeArticle();
  }, [flushReadingProgress, closeArticle]);

  // Web Keyboard Shortcuts: Escape to close, s to save/bookmark
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        void handleClose();
      } else if (e.key === 's' || e.key === 'S') {
        if (selectedArticle) {
          e.preventDefault();
          toggleSaveItem(selectedArticle.id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedArticle, toggleSaveItem, handleClose]);

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

  const currentInteraction = interactions[selectedArticle.id];
  const isSaved = currentInteraction?.saved ?? false;
  const currentFeedback = currentInteraction?.feedback;
  const savedProgress = currentInteraction?.progressPercent ?? 0;

  const abstract = selectedArticle.editorialAbstract ?? synthesizeEditorialAbstract(selectedArticle);
  const fullArticleText = (selectedArticle.articleBody && selectedArticle.articleBody.trim().length > 20)
    ? selectedArticle.articleBody.trim()
    : (selectedArticle.feedText || selectedArticle.body || '').trim();
  const originalUrl = selectedArticle.canonicalUrl || selectedArticle.sourceReferences?.[0]?.originalUrl;
  const isExcerpt = selectedArticle.evidenceTier === 'publisher_excerpt' || selectedArticle.evidenceTier === 'metadata_only';
  const isThinEvidence = selectedArticle.evidenceTier === 'metadata_only' || fullArticleText.length < 180;
  const hasAuthenticReaderImage = Boolean(
    selectedArticle.imageUrl &&
      selectedArticle.hasAuthenticImage !== false &&
      !selectedArticle.imageUrl.includes('images.unsplash.com')
  );
  const provenanceLabel = formatVerifiedProvenanceLabel(selectedArticle);

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

  const handleCopyToCraft = async () => {
    if (!selectedArticle) return;
    const publisher = selectedArticle.sourceReferences[0]?.publisher || 'Fachpublikation';
    const author = selectedArticle.sourceReferences[0]?.author || selectedArticle.sourceBroadcasterName || 'Redaktion atmen';
    const originalUrl = selectedArticle.sourceReferences[0]?.originalUrl || selectedArticle.canonicalUrl || '';
    const dateStr = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

    let md = `# ${selectedArticle.title}\n`;
    if (selectedArticle.subtitle) {
      md += `*${selectedArticle.subtitle}*\n\n`;
    }
    md += `**Quelle**: [${publisher}](${originalUrl}) • **Autor**: ${author} • **Thema**: ${selectedArticle.primaryTopic || 'allgemein'} • **Gelesen**: ${dateStr}\n\n`;

    if (selectedArticle.keyInsight) {
      md += `> **💡 Kernpunkt**: „${selectedArticle.keyInsight}“\n\n`;
    }

    if (selectedArticle.feedText) {
      md += `## ⚡ Kurz-Check\n${selectedArticle.feedText}\n\n`;
    }

    md += `## 📖 Ausführliche Lektüre\n${fullArticleText}\n\n`;

    if (selectedArticle.deepeningOptions?.counterArgument) {
      md += `> **⚖️ Dialektische Gegenposition**: ${selectedArticle.deepeningOptions.counterArgument}\n\n`;
    }

    if (selectedArticle.deepeningOptions?.didacticSeed) {
      md += `> **🏫 Unterrichts-Impuls**: ${selectedArticle.deepeningOptions.didacticSeed}\n\n`;
    }

    const userNotes = currentInteraction?.userNotes || [];
    if (userNotes.length > 0) {
      md += `## ✍️ Eigene Reflexionen & Sparring\n\n`;
      for (const note of userNotes) {
        const tagLabel = note.tag === 'einwand'
          ? '⚡ Einwand'
          : note.tag === 'unterricht'
          ? '🏫 Unterricht'
          : note.tag === 'these'
          ? '💡 Eigene These'
          : '📝 Notiz';
        const noteDate = new Date(note.createdAt).toLocaleDateString('de-DE', {
          hour: '2-digit',
          minute: '2-digit',
          day: '2-digit',
          month: '2-digit'
        });
        md += `### [${tagLabel}] (${noteDate})\n${note.text}\n\n`;
        if (note.sparringReply) {
          md += `> **${note.sparringReply.authorHandle}** (${note.sparringReply.authorBadge || 'Sparring'}):\n> ${note.sparringReply.text}\n\n`;
        }
      }
    }

    md += `---\n*Exportiert aus [atmen](https://atmen.app) — Anti-Doomscroll Knowledge Environment*\n`;

    const ok = await copyToClipboard(md);
    if (ok) {
      setCraftCopied(true);
      setTimeout(() => setCraftCopied(false), 2500);
    }
  };

  const handleSaveNote = async () => {
    if (!noteText.trim() || !selectedArticle) return;
    setIsSubmittingNote(true);
    try {
      await addNote(selectedArticle.id, noteText.trim(), selectedTag);
      setNoteText('');
    } finally {
      setIsSubmittingNote(false);
    }
  };

  const userNotes = currentInteraction?.userNotes || [];

  const renderDiscussionThread = () => {
    const comments = selectedArticle.comments || [];
    if (comments.length === 0) return null;

    return (
      <View style={[styles.discussionBox, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
        <View style={styles.discussionHeaderRow}>
          <Ionicons name="chatbubbles-outline" size={17} color={colors.accent} style={{ marginRight: 8 }} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.discussionTitle, { color: colors.textPrimary }]}>
              Dialektischer Diskurs & Sparring ({comments.length})
            </Text>
            <Text style={[styles.discussionSubtitle, { color: colors.textMuted }]}>
              Transparente Sparring-Beiträge aus unterschiedlichen Fachperspektiven (ohne künstliche Upvotes).
            </Text>
          </View>
        </View>

        <View style={styles.commentsList}>
          {comments.map((comment) => (
            <View
              key={comment.id}
              style={[styles.commentCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}
            >
              <View style={styles.commentHeader}>
                <View style={styles.commentAuthorRow}>
                  <Text style={[styles.commentAuthor, { color: colors.textPrimary }]}>
                    {comment.authorHandle}
                  </Text>
                  {comment.authorBadge && (
                    <View style={[styles.commentBadge, { backgroundColor: colors.accentSubtle }]}>
                      <Text style={[styles.commentBadgeText, { color: colors.accent }]}>
                        {comment.authorBadge}
                      </Text>
                    </View>
                  )}
                </View>
                <View style={styles.commentMetaRight}>
                  <Text style={[styles.commentScore, { color: colors.textMuted }]}>
                    ▲ {comment.score}
                  </Text>
                  <Text style={[styles.commentTime, { color: colors.textMuted }]}>
                    {comment.timeAgo}
                  </Text>
                </View>
              </View>
              <Text style={[styles.commentText, { color: colors.textSecondary }]}>
                {comment.text}
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderNotesAndCraftSidebar = () => {
    return (
      <View style={styles.sidebarStickyWrapper}>
        {/* Craft 1-Click Export Card */}
        {isFeatureEnabled(profile, 'craft_obsidian_export') && (
          <View style={[styles.craftExportCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
            <View style={styles.craftExportHeader}>
              <View style={[styles.craftExportIconBox, { backgroundColor: craftCopied ? '#10B98120' : colors.accentSubtle }]}>
                <Ionicons
                  name={craftCopied ? 'checkmark-circle' : 'clipboard-outline'}
                  size={18}
                  color={craftCopied ? '#10B981' : colors.accent}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.craftExportTitle, { color: colors.textPrimary }]}>
                  Wissen für Craft & PKM
                </Text>
                <Text style={[styles.craftExportSubtitle, { color: colors.textMuted }]}>
                  Sauberes Markdown inkl. Thesen & Sparring
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={handleCopyToCraft}
              style={[
                styles.craftExportBtn,
                {
                  backgroundColor: craftCopied ? '#10B981' : colors.accent,
                  borderColor: craftCopied ? '#10B981' : colors.accent
                }
              ]}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Artikel strukturiert für Craft in die Zwischenablage kopieren"
            >
              <Ionicons
                name={craftCopied ? 'checkmark' : 'copy-outline'}
                size={15}
                color="#FFFFFF"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.craftExportBtnText}>
                {craftCopied ? 'In Zwischenablage kopiert!' : '📋 Für Craft kopieren'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Quick Note Composer */}
        <View style={[styles.composerCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
          <View style={styles.composerHeader}>
            <Ionicons name="pencil-outline" size={17} color={colors.accent} style={{ marginRight: 6 }} />
            <Text style={[styles.composerTitle, { color: colors.textPrimary }]}>
              Reflexion & Sparring
            </Text>
          </View>
          <Text style={[styles.composerSubtitle, { color: colors.textMuted }]}>
            Formuliere einen Einwand oder Unterrichtsimpuls. Das Sparring-Modell antwortet sokratisch.
          </Text>

          {/* Tag Selector */}
          <View style={styles.tagSelectorRow}>
            {(
              [
                { id: 'einwand', label: '⚡ Einwand' },
                { id: 'unterricht', label: '🏫 Unterricht' },
                { id: 'these', label: '💡 These' },
                { id: 'notiz', label: '📝 Notiz' }
              ] as const
            ).map((t) => {
              const isSelected = selectedTag === t.id;
              return (
                <TouchableOpacity
                  key={t.id}
                  onPress={() => setSelectedTag(t.id)}
                  style={[
                    styles.tagSelectorPill,
                    {
                      backgroundColor: isSelected ? colors.accent : colors.surfaceSecondary,
                      borderColor: isSelected ? colors.accent : colors.borderSubtle
                    }
                  ]}
                >
                  <Text
                    style={[
                      styles.tagSelectorText,
                      { color: isSelected ? '#FFFFFF' : colors.textSecondary }
                    ]}
                  >
                    {t.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Note Input */}
          <TextInput
            style={[
              styles.composerInput,
              {
                color: colors.textPrimary,
                backgroundColor: colors.surfaceSecondary,
                borderColor: colors.borderSubtle
              }
            ]}
            placeholder="Kritischer Gedanke, These oder Praxisbezug…"
            placeholderTextColor={colors.textMuted}
            value={noteText}
            onChangeText={setNoteText}
            multiline
            numberOfLines={4}
          />

          <TouchableOpacity
            onPress={handleSaveNote}
            disabled={!noteText.trim() || isSubmittingNote}
            style={[
              styles.composerSubmitBtn,
              {
                backgroundColor: !noteText.trim() || isSubmittingNote ? colors.surfaceSecondary : colors.accent,
                opacity: !noteText.trim() || isSubmittingNote ? 0.6 : 1
              }
            ]}
          >
            <Text
              style={[
                styles.composerSubmitText,
                { color: !noteText.trim() || isSubmittingNote ? colors.textMuted : '#FFFFFF' }
              ]}
            >
              {isSubmittingNote ? 'Generiere Sparring…' : 'Speichern & Sparring anfordern'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* User Notes & Sparring Replies List */}
        {userNotes.length > 0 && (
          <View style={[styles.savedNotesCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
            <Text style={[styles.savedNotesHeader, { color: colors.textPrimary }]}>
              Gespeicherte Notizen ({userNotes.length})
            </Text>
            {userNotes.map((note) => {
              const tagLabel = note.tag === 'einwand'
                ? '⚡ Einwand'
                : note.tag === 'unterricht'
                ? '🏫 Unterricht'
                : note.tag === 'these'
                ? '💡 Eigene These'
                : '📝 Notiz';
              return (
                <View
                  key={note.id}
                  style={[styles.userNoteItem, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}
                >
                  <View style={styles.userNoteTop}>
                    <View style={[styles.userNoteTag, { backgroundColor: colors.accentSubtle }]}>
                      <Text style={[styles.userNoteTagText, { color: colors.accent }]}>{tagLabel}</Text>
                    </View>
                    <Text style={[styles.userNoteDate, { color: colors.textMuted }]}>
                      {new Date(note.createdAt).toLocaleDateString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                  <Text style={[styles.userNoteText, { color: colors.textPrimary }]}>{note.text}</Text>

                  {/* AI Sparring Reply Callout */}
                  {isFeatureEnabled(profile, 'socratic_sparring') && note.sparringReply && (
                    <View style={[styles.sparringReplyBox, { borderLeftColor: colors.accent, backgroundColor: colors.surface }]}>
                      <View style={styles.sparringAuthorRow}>
                        <Text style={[styles.sparringAuthor, { color: colors.accent }]}>
                          {note.sparringReply.authorHandle}
                        </Text>
                        <Text style={[styles.sparringBadge, { color: colors.textMuted }]}>
                          • {note.sparringReply.authorBadge || 'Sparring'}
                        </Text>
                      </View>
                      <Text style={[styles.sparringReplyText, { color: colors.textSecondary }]}>
                        {note.sparringReply.text}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      {/* Pinned Reading Progress Bar */}
      <View style={[styles.progressTrack, { backgroundColor: colors.surfaceSecondary }]}>
        <View style={[styles.progressBar, { width: `${scrollPercent}%`, backgroundColor: colors.accent }]} />
      </View>

      {/* Magazine Editorial Top Action Bar */}
      <View style={[styles.navBar, { backgroundColor: colors.surface, borderBottomColor: colors.borderSubtle }]}>
        <View style={[styles.navBarInner, isDesktop && styles.desktopNavBarInner]}>
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

            {/* Craft 1-Click Export Pill Button */}
            {isFeatureEnabled(profile, 'craft_obsidian_export') && (
              <TouchableOpacity
                onPress={handleCopyToCraft}
                style={[
                  styles.navCraftBtn,
                  {
                    backgroundColor: craftCopied ? '#10B98122' : colors.surfaceSecondary,
                    borderColor: craftCopied ? '#10B981' : colors.borderSubtle
                  }
                ]}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel="In Zwischenablage für Craft kopieren"
              >
                <Ionicons
                  name={craftCopied ? 'checkmark' : 'clipboard-outline'}
                  size={13}
                  color={craftCopied ? '#10B981' : colors.accent}
                  style={{ marginRight: 4 }}
                />
                <Text style={[styles.navCraftBtnText, { color: craftCopied ? '#10B981' : colors.textPrimary }]}>
                  {craftCopied ? 'Kopiert!' : 'Craft'}
                </Text>
              </TouchableOpacity>
            )}

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
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 16) + spacing.xxl * 2 }
        ]}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={32}
        onContentSizeChange={(_w, h) => setContentHeight(h)}
        onLayout={(e) => setLayoutHeight(e.nativeEvent.layout.height)}
      >
        <View style={[styles.scrollInner, isDesktop && styles.desktopScrollInner]}>
          <View style={isDesktop ? styles.desktopTwoColContainer : undefined}>
            <View style={isDesktop ? styles.desktopLeftCol : undefined}>
              {/* Magazine Kicker Header */}
              <View style={styles.kickerRow}>
                <Text style={[styles.kickerText, { color: colors.accent }]}>
                  {(selectedArticle.space || 'C/RECHERCHE').toUpperCase()} •{' '}
                  {isThinEvidence ? 'KOMPAKTER QUELLEN-FUND' : 'LEKTÜRE & EINORDNUNG'}
                </Text>

                <View style={[styles.trustBadge, { backgroundColor: colors.accentSubtle, borderColor: colors.borderSubtle }]}>
                  <Ionicons name="shield-checkmark" size={11} color={colors.accent} style={{ marginRight: 4 }} />
                  <Text style={[styles.trustBadgeText, { color: colors.accent }]}>{provenanceLabel}</Text>
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
              {selectedArticle.subtitle && selectedArticle.subtitle.trim() !== fullArticleText.trim() && (
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                  {selectedArticle.subtitle}
                </Text>
              )}

              {/* Editorial Byline & Provenance Strip */}
              <View style={[styles.bylineCard, { borderTopColor: colors.borderSubtle, borderBottomColor: colors.borderSubtle }]}>
                <View style={styles.bylineLeft}>
                  <Text style={[styles.bylineAuthor, { color: colors.textPrimary }]}>
                    Von <Text style={{ fontWeight: '700' }}>{authorDisplay}</Text>
                  </Text>
                  <Text style={[styles.bylinePublisher, { color: colors.textMuted }]}>
                    Quelle: {publisherDisplay}{' '}
                    {selectedArticle.sourceReferences[0]?.publicationTimestamp
                      ? `• ${selectedArticle.sourceReferences[0].publicationTimestamp}`
                      : ''}
                  </Text>
                </View>

                <View style={styles.bylineRight}>
                  <ReadingTimeBadge minutes={selectedArticle.estimatedReadingMinutes} />
                  <Text style={[styles.bylineMetrics, { color: colors.textMuted }]}>
                    ca. {selectedArticle.wordCount ?? Math.max(1, Math.round(fullArticleText.split(/\s+/).length))} Wörter
                  </Text>
                </View>
              </View>

              {/* Museum-Grade Artwork Showcase OR Authentic Article Image */}
              {(selectedArticle.format === 'art_showcase' || !!selectedArticle.artMeta) &&
              (selectedArticle.artMeta?.highResImageUrl || selectedArticle.imageUrl) ? (
                <TouchableOpacity
                  activeOpacity={0.95}
                  onPress={() => setShowReaderImageLightbox(true)}
                  style={[styles.readerArtShowcaseContainer, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
                >
                  <View style={[styles.readerArtImageWrapper, { height: isDesktop ? 520 : 380 }]}>
                    <Image
                      source={{
                        uri: optimizeImageUrl(
                          selectedArticle.artMeta?.highResImageUrl || selectedArticle.imageUrl || '',
                          1600
                        )
                      }}
                      style={styles.readerArtFullImage}
                      resizeMode="contain"
                      onLoad={(e) => {
                        const { width, height } = e.nativeEvent.source;
                        if (width > 0 && height > 0) {
                          setReaderImageAspectRatio(width / height);
                        }
                      }}
                    />
                    <View style={styles.readerImageZoomBadge}>
                      <Ionicons name="expand-outline" size={12} color="#FFFFFF" style={{ marginRight: 4 }} />
                      <Text style={styles.readerImageZoomText}>Vollbild</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ) : (
                hasAuthenticReaderImage && (
                  <View
                    style={[
                      styles.readerImageContainer,
                      {
                        borderColor: colors.borderSubtle,
                        backgroundColor:
                          selectedArticle.format === 'meme' || Boolean(selectedArticle.memeMeta)
                            ? '#FFFFFF'
                            : colors.surfaceSecondary
                      }
                    ]}
                  >
                    <TouchableOpacity
                      activeOpacity={0.95}
                      onPress={() => setShowReaderImageLightbox(true)}
                      style={[
                        selectedArticle.format === 'meme' || Boolean(selectedArticle.memeMeta)
                          ? {
                              width: '100%',
                              aspectRatio: readerImageAspectRatio || 1.2,
                              minHeight: 340,
                              maxHeight: 820,
                              padding: 16,
                              backgroundColor: '#FFFFFF',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }
                          : readerImageAspectRatio
                          ? readerImageAspectRatio >= 1.05
                            ? {
                                width: '100%',
                                aspectRatio: Math.min(2.4, readerImageAspectRatio),
                                maxHeight: isDesktop ? 520 : 400,
                                alignItems: 'center',
                                justifyContent: 'center'
                              }
                            : {
                                width: '100%',
                                height: isDesktop ? 480 : 380,
                                backgroundColor: colors.surfaceSecondary,
                                alignItems: 'center',
                                justifyContent: 'center'
                              }
                          : {
                              width: '100%',
                              height: isDesktop ? 440 : 340,
                              backgroundColor: colors.surfaceSecondary,
                              alignItems: 'center',
                              justifyContent: 'center'
                            }
                      ]}
                    >
                      <Image
                        source={{ uri: optimizeImageUrl(selectedArticle.imageUrl!) || selectedArticle.imageUrl! }}
                        style={{ width: '100%', height: '100%' }}
                        resizeMode="contain"
                        onLoad={(e) => {
                          const { width, height } = e.nativeEvent.source;
                          if (width > 0 && height > 0) {
                            setReaderImageAspectRatio(width / height);
                          }
                        }}
                      />
                      <View style={styles.readerImageZoomBadge}>
                        <Ionicons name="expand-outline" size={12} color="#FFFFFF" style={{ marginRight: 4 }} />
                        <Text style={styles.readerImageZoomText}>Vollbild</Text>
                      </View>
                    </TouchableOpacity>
                    {selectedArticle.memeMeta?.punchline && (
                      <View
                        style={{
                          paddingHorizontal: 16,
                          paddingVertical: 12,
                          backgroundColor: colors.surface,
                          borderTopWidth: 1,
                          borderTopColor: colors.borderSubtle
                        }}
                      >
                        <Text style={{ fontSize: 11, fontWeight: '700', color: colors.accent, marginBottom: 4 }}>
                          🎁 {selectedArticle.memeMeta.satireContext || 'Bonus-Punchline (Original-Alt-Text)'}
                        </Text>
                        <Text style={{ fontSize: 14, lineHeight: 20, color: colors.textPrimary, fontStyle: 'italic' }}>
                          „{selectedArticle.memeMeta.punchline}“
                        </Text>
                      </View>
                    )}
                    <View style={[styles.imageCaptionBar, { backgroundColor: colors.surfaceSecondary }]}>
                      <Ionicons name="camera-outline" size={12} color={colors.textMuted} style={{ marginRight: 6 }} />
                      <Text style={[styles.imageCaptionText, { color: colors.textMuted }]} numberOfLines={1}>
                        {selectedArticle.imageCredit
                          ? `Bildnachweis: ${selectedArticle.imageCredit} • Quelle: ${publisherDisplay}`
                          : `Originalbild • Quelle: ${publisherDisplay}`}
                      </Text>
                    </View>
                  </View>
                )
              )}

              {/* PRIMARY ACTION: Direkt unter dem Bild platziert für sofortigen Volltext-Zugriff */}
              {originalUrl && (
                <TouchableOpacity
                  onPress={() => handleOpenSource(originalUrl)}
                  style={[styles.primaryDirectSourceBtn, { backgroundColor: colors.accent }]}
                  activeOpacity={0.85}
                  accessibilityRole="link"
                  accessibilityLabel={`Originalbeitrag bei ${publisherDisplay} im Volltext öffnen`}
                >
                  <Ionicons name="open-outline" size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.primaryDirectSourceBtnText}>
                    Originalbeitrag bei {publisherDisplay} im Volltext öffnen ↗
                  </Text>
                </TouchableOpacity>
              )}

              {/* ELEGANTER ABSTRACT (REDAKTIONELLES ATMEN-ABSTRACT OHNE EMOJI-ÜBERLADUNG) */}
              {abstract && (
                <View style={[styles.abstractBox, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
                  <View style={styles.abstractHeaderRow}>
                    <View style={[styles.ebeneTag, { backgroundColor: colors.surfaceSecondary }]}>
                      <Ionicons name="sparkles-outline" size={12} color={colors.accent} style={{ marginRight: 5 }} />
                      <Text style={[styles.ebeneTagText, { color: colors.accent }]}>
                        REDAKTIONELLES ATMEN-ABSTRACT
                      </Text>
                    </View>
                    <Text style={[styles.abstractReadingEstimate, { color: colors.textMuted }]}>
                      Kompakte Orientierung & Kern-Synthese
                    </Text>
                  </View>

                  {abstract.overview ? (
                    <View style={styles.abstractSection}>
                      <View style={styles.abstractLabelRow}>
                        <View style={[styles.abstractIconBadge, { backgroundColor: colors.accentSubtle }]}>
                          <Ionicons name="compass-outline" size={13} color={colors.accent} />
                        </View>
                        <Text style={[styles.abstractLabel, { color: colors.textPrimary }]}>KERNAUSSAGE & FOKUS</Text>
                      </View>
                      <Text style={[styles.abstractText, { color: colors.textSecondary }]}>
                        {abstract.overview}
                      </Text>
                    </View>
                  ) : null}

                  {abstract.keyFinding ? (
                    <View style={styles.abstractSection}>
                      <View style={styles.abstractLabelRow}>
                        <View style={[styles.abstractIconBadge, { backgroundColor: '#F59E0B20' }]}>
                          <Ionicons name="bulb-outline" size={13} color="#D97706" />
                        </View>
                        <Text style={[styles.abstractLabel, { color: colors.textPrimary }]}>ZENTRALE ERKENNTNIS</Text>
                      </View>
                      <Text style={[styles.abstractText, { color: colors.textSecondary }]}>
                        {abstract.keyFinding}
                      </Text>
                    </View>
                  ) : null}

                  {abstract.relevanceWhy ? (
                    <View style={styles.abstractSection}>
                      <View style={styles.abstractLabelRow}>
                        <View style={[styles.abstractIconBadge, { backgroundColor: '#10B98120' }]}>
                          <Ionicons name="sparkles-outline" size={13} color="#10B981" />
                        </View>
                        <Text style={[styles.abstractLabel, { color: colors.textPrimary }]}>WARUM LESENSWERT</Text>
                      </View>
                      <Text style={[styles.abstractText, { color: colors.textSecondary }]}>
                        {abstract.relevanceWhy}
                      </Text>
                    </View>
                  ) : null}

                  {abstract.limitation ? (
                    <View style={styles.abstractSection}>
                      <View style={styles.abstractLabelRow}>
                        <View style={[styles.abstractIconBadge, { backgroundColor: colors.surfaceSecondary }]}>
                          <Ionicons name="shield-checkmark-outline" size={13} color={colors.textMuted} />
                        </View>
                        <Text style={[styles.abstractLabel, { color: colors.textMuted }]}>GÜLTIGKEITSGRENZE & KONTEXT</Text>
                      </View>
                      <Text style={[styles.abstractText, { color: colors.textMuted, fontSize: 13 }]}>
                        {abstract.limitation}
                      </Text>
                    </View>
                  ) : null}
                </View>
              )}

              {/* ABSCHNITT: ORIGINALAUSZUG MIT .MD-READABILITY */}
              {isThinEvidence ? (
                <View style={[styles.abstractBox, { backgroundColor: colors.surface, borderColor: colors.accent, borderWidth: 1.5 }]}>
                  <View style={styles.abstractHeaderRow}>
                    <View style={[styles.ebeneTag, { backgroundColor: colors.accentSubtle }]}>
                      <Text style={[styles.ebeneTagText, { color: colors.accent }]}>
                        KOMPAKTE QUELL-FUNDKARTE
                      </Text>
                    </View>
                    <Text style={[styles.abstractReadingEstimate, { color: colors.textMuted }]}>
                      Direkt-Verweis ohne künstliche Textstreckung
                    </Text>
                  </View>

                  <MarkdownContent
                    content={fullArticleText}
                    bodyFontSize={bodyFontSize}
                    bodyLineHeight={bodyLineHeight}
                    colors={colors}
                  />

                  {selectedArticle.externalCommunityScore && selectedArticle.externalCommunityScore.points > 0 && (
                    <View style={[styles.networkCardSection, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle, marginBottom: 12 }]}>
                      <Text style={[styles.networkCardLabel, { color: colors.accent }]}>
                        Community-Resonanz ({selectedArticle.externalCommunityScore.platform}):{' '}
                        {selectedArticle.externalCommunityScore.points} Punkte
                        {selectedArticle.externalCommunityScore.commentsCount
                          ? ` • ${selectedArticle.externalCommunityScore.commentsCount} Beiträge`
                          : ''}
                      </Text>
                      {selectedArticle.externalCommunityScore.discussionUrl && (
                        <TouchableOpacity
                          onPress={() => handleOpenSource(selectedArticle.externalCommunityScore!.discussionUrl!)}
                          style={{ marginTop: 6 }}
                        >
                          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.accent }}>
                            Externe Original-Diskussion öffnen ↗
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              ) : (
                <>
                  <View style={styles.ebene3Header}>
                    <View style={styles.ebene3BadgeRow}>
                      <View style={[styles.ebeneTag, { backgroundColor: colors.surfaceSecondary }]}>
                        <Text style={[styles.ebeneTagText, { color: colors.accent }]}>
                          ORIGINALAUSZUG ({publisherDisplay.toUpperCase()})
                        </Text>
                      </View>
                      <View style={[styles.synthesisTypeBadge, { backgroundColor: isExcerpt ? colors.accentSubtle : colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
                        <Ionicons
                          name={isExcerpt ? 'newspaper-outline' : 'book-outline'}
                          size={12}
                          color={isExcerpt ? colors.accent : colors.textPrimary}
                          style={{ marginRight: 4 }}
                        />
                        <Text style={[styles.synthesisTypeBadgeText, { color: isExcerpt ? colors.accent : colors.textPrimary, fontWeight: '700' }]}>
                          {selectedArticle.evidenceTier === 'permitted_full_text'
                            ? 'Verifizierter Volltext'
                            : 'Wortgetreuer Herausgeber-Auszug'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.bodyContainer}>
                    <MarkdownContent
                      content={fullArticleText}
                      bodyFontSize={bodyFontSize}
                      bodyLineHeight={bodyLineHeight}
                      colors={colors}
                    />
                  </View>
                </>
              )}

              {/* MUSEUM-GRADE KURATOREN-PLAKETTE: Dezent nach unten in den Archiv-Kontext versetzt */}
              {(selectedArticle.format === 'art_showcase' || !!selectedArticle.artMeta) && selectedArticle.artMeta && (
                <View style={[styles.readerArtCuratorialPlaqueStandalone, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
                  <View style={styles.readerArtPlaqueHeader}>
                    <Ionicons name="color-palette-outline" size={18} color="#D97706" style={{ marginRight: 8 }} />
                    <Text style={[styles.readerArtPlaqueArtist, { color: colors.textPrimary }]}>
                      {selectedArticle.artMeta.artist || authorDisplay}
                    </Text>
                    {selectedArticle.artMeta.year && (
                      <Text style={[styles.readerArtPlaqueYear, { color: colors.textMuted }]}>
                        • {selectedArticle.artMeta.year}
                      </Text>
                    )}
                  </View>

                  <View style={styles.readerArtDetailsGrid}>
                    <View style={styles.readerArtDetailCol}>
                      <Text style={[styles.readerArtDetailLabel, { color: colors.textMuted }]}>SAMMLUNG</Text>
                      <Text style={[styles.readerArtDetailVal, { color: colors.textPrimary }]}>
                        {selectedArticle.artMeta.museum || publisherDisplay}
                      </Text>
                    </View>
                    {selectedArticle.artMeta.medium && (
                      <View style={styles.readerArtDetailCol}>
                        <Text style={[styles.readerArtDetailLabel, { color: colors.textMuted }]}>MEDIUM / TECHNIK</Text>
                        <Text style={[styles.readerArtDetailVal, { color: colors.textPrimary }]}>
                          {selectedArticle.artMeta.medium}
                        </Text>
                      </View>
                    )}
                    {selectedArticle.artMeta.styleMovement && (
                      <View style={styles.readerArtDetailCol}>
                        <Text style={[styles.readerArtDetailLabel, { color: colors.textMuted }]}>EPOCHE / STIL</Text>
                        <Text style={[styles.readerArtDetailVal, { color: colors.textPrimary }]}>
                          {selectedArticle.artMeta.styleMovement}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              )}

              {/* ABSCHNITT 3: EIGENE EINORDNUNG & PERSPEKTIVE (Inhaltsbezogen, ohne Standardsatz-Ballast) */}
              <View style={[styles.networkContextBox, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
                <View style={styles.networkContextHeaderRow}>
                  <View style={[styles.networkIconBox, { backgroundColor: colors.accentSubtle }]}>
                    <Ionicons name="compass-outline" size={18} color={colors.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.networkContextTitle, { color: colors.textPrimary }]}>
                      3 • Eigene Einordnung & Perspektive
                    </Text>
                    <Text style={[styles.networkContextSubtitle, { color: colors.textMuted }]}>
                      Konkrete inhaltliche Beleuchtung, Praxis-Transfer & Querverbindungen
                    </Text>
                  </View>
                </View>

                {/* 3.1 Konkrete Kernaussage */}
                {selectedArticle.keyInsight && (
                  <View style={[styles.networkCardSection, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
                    <View style={styles.networkCardBadgeRow}>
                      <Text style={{ fontSize: 13, marginRight: 5 }}>💡</Text>
                      <Text style={[styles.networkCardLabel, { color: colors.accent }]}>Inhaltlicher Kernpunkt</Text>
                    </View>
                    <Text style={[styles.networkCardText, { color: colors.textPrimary }]}>
                      {selectedArticle.keyInsight}
                    </Text>
                  </View>
                )}

                {/* 3.2 Lehr- & Praxis-Transfer (wenn konkret vorhanden) */}
                {isFeatureEnabled(profile, 'didactic_transfer') && (selectedArticle.didacticTransfer || selectedArticle.didacticSeed) && (
                  <View style={[styles.networkCardSection, { backgroundColor: colors.surfaceSecondary, borderColor: '#10B98140', borderLeftColor: '#10B981', borderLeftWidth: 3 }]}>
                    <View style={styles.networkCardBadgeRow}>
                      <Text style={{ fontSize: 13, marginRight: 5 }}>🏫</Text>
                      <Text style={[styles.networkCardLabel, { color: '#10B981' }]}>Praxis- & Unterrichts-Transfer</Text>
                    </View>
                    <Text style={[styles.networkCardText, { color: colors.textSecondary }]}>
                      {selectedArticle.didacticTransfer || selectedArticle.didacticSeed}
                    </Text>
                  </View>
                )}

                {/* 3.3 Konkrete Gegenperspektive (nur wenn am Beitrag hinterlegt) */}
                {(selectedArticle.perspectiveDetails?.counterPerspective || selectedArticle.deepeningOptions?.counterArgument) && (
                  <View style={[styles.networkCardSection, { backgroundColor: colors.surfaceSecondary, borderColor: '#8B5CF640', borderLeftColor: '#8B5CF6', borderLeftWidth: 3 }]}>
                    <View style={styles.networkCardBadgeRow}>
                      <View style={styles.counterBadgePill}>
                        <Ionicons name="git-compare-outline" size={12} color="#8B5CF6" style={{ marginRight: 4 }} />
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#8B5CF6' }}>⚖️ Gegenperspektive & Einwand</Text>
                      </View>
                    </View>
                    <Text style={[styles.networkCardText, { color: colors.textSecondary }]}>
                      {selectedArticle.perspectiveDetails?.counterPerspective || selectedArticle.deepeningOptions?.counterArgument}
                    </Text>
                  </View>
                )}

                {/* 3.4 Zeitloser Klassiker-Verweis (nur bei echter inhaltlicher Übereinstimmung) */}
                {selectedArticle.evergreenContext && (
                  <View style={[styles.networkCardSection, { backgroundColor: colors.surfaceSecondary, borderColor: '#D9770640', borderLeftColor: '#D97706', borderLeftWidth: 3 }]}>
                    <View style={styles.networkCardBadgeRow}>
                      <Text style={{ fontSize: 13, marginRight: 5 }}>🏛</Text>
                      <Text style={[styles.networkCardLabel, { color: '#D97706' }]}>Inhaltlich verwandter Klassiker</Text>
                    </View>
                    <Text style={[styles.networkCardText, { color: colors.textSecondary }]}>
                      {selectedArticle.evergreenContext}
                    </Text>
                  </View>
                )}

                {/* 3.5 RABBIT HOLE: Konzeptionell hochgradig verwandte Vertiefungslektüren */}
                {isFeatureEnabled(profile, 'cross_references') && (
                  <View style={[styles.rabbitHoleContainer, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
                    <View style={styles.rabbitHoleHeaderRow}>
                      <View style={[styles.rabbitHoleIconBox, { backgroundColor: colors.accentSubtle }]}>
                        <Ionicons name="telescope-outline" size={17} color={colors.accent} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.rabbitHoleTitle, { color: colors.textPrimary }]}>
                          Rabbit Hole: Tiefer in dieses Thema einsteigen
                        </Text>
                        <Text style={[styles.rabbitHoleSubtitle, { color: colors.textMuted }]}>
                          Gezielte Vertiefungslektüren & Studien basierend auf den Kernkonzepten dieses Beitrags
                        </Text>
                      </View>
                    </View>

                    {rabbitHoleEntries.length > 0 ? (
                      <View style={styles.rabbitHoleList}>
                        {rabbitHoleEntries.map((entry, idx) => {
                          const entryPublisher = entry.item.sourceReferences?.[0]?.publisher || entry.item.sourceBroadcasterName || 'Quelle';
                          const entryUrl = entry.item.canonicalUrl || entry.item.sourceReferences?.[0]?.originalUrl;
                          return (
                            <View
                              key={entry.item.id || idx}
                              style={[styles.rabbitHoleCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
                            >
                              <View style={styles.rabbitHoleCardTop}>
                                <View style={[styles.rabbitHolePill, { backgroundColor: colors.accentSubtle }]}>
                                  <Ionicons name="git-network-outline" size={11} color={colors.accent} style={{ marginRight: 4 }} />
                                  <Text style={[styles.rabbitHolePillText, { color: colors.accent }]}>
                                    {entry.conceptPill}
                                  </Text>
                                </View>
                                <Text style={[styles.rabbitHolePublisher, { color: colors.textMuted }]}>
                                  {entryPublisher}
                                </Text>
                              </View>

                              <Text style={[styles.rabbitHoleCardTitle, { color: colors.textPrimary }]}>
                                {entry.item.title}
                              </Text>

                              <Text style={[styles.rabbitHoleCardReason, { color: colors.textSecondary }]} numberOfLines={2}>
                                {entry.relevanceReason}
                              </Text>

                              <View style={styles.rabbitHoleCardActions}>
                                <TouchableOpacity
                                  onPress={() => openArticle(entry.item.id)}
                                  style={[styles.rabbitHoleActionBtn, { backgroundColor: colors.accent }]}
                                  activeOpacity={0.8}
                                  accessibilityRole="button"
                                  accessibilityLabel={`In Atmen öffnen: ${entry.item.title}`}
                                >
                                  <Ionicons name="book-outline" size={12} color="#FFFFFF" style={{ marginRight: 5 }} />
                                  <Text style={styles.rabbitHoleActionBtnText}>In Atmen lesen</Text>
                                </TouchableOpacity>

                                {entryUrl && (
                                  <TouchableOpacity
                                    onPress={() => handleOpenSource(entryUrl)}
                                    style={[styles.rabbitHoleSourceBtn, { borderColor: colors.borderSubtle }]}
                                    activeOpacity={0.8}
                                  >
                                    <Ionicons name="open-outline" size={12} color={colors.textSecondary} style={{ marginRight: 4 }} />
                                    <Text style={[styles.rabbitHoleSourceBtnText, { color: colors.textSecondary }]}>
                                      Originalquelle ↗
                                    </Text>
                                  </TouchableOpacity>
                                )}
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    ) : (
                      <View style={{ paddingVertical: 14, alignItems: 'center' }}>
                        <Text style={{ fontSize: 13, color: colors.textMuted, fontStyle: 'italic' }}>
                          {loadingRabbitHole
                            ? 'Erschließe gedankliche Querbezüge und durchsuche den Wissenspool…'
                            : 'Vertiefungslektüren werden zusammengestellt…'}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>

              {/* Wissen testen / Bloomscrolling Quiz Checkpoint */}
              {isFeatureEnabled(profile, 'bloomscroll_quizzes') && (
                <View style={{ marginBottom: spacing.lg }}>
                  <QuizCheckpointCard
                    questions={[selectedArticle.quiz || generateQuizForArticle(selectedArticle)]}
                    title="Wissen testen: Kernverständnis"
                    subtitle="Überprüfe deine Erkenntnis aus diesem Beitrag mit einer schnellen Frage"
                  />
                </View>
              )}

              {/* Socratic Sparring Options */}
              {isFeatureEnabled(profile, 'socratic_sparring') && (
                <DeepeningCard options={selectedArticle.deepeningOptions} />
              )}

              {/* Dialectic Discussion Thread */}
              {renderDiscussionThread()}

              {/* ABSCHNITT 4: QUELLE & HERKUNFT (Klare Provenienz & Direktlinks) */}
              <View style={[styles.provenanceBox, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
                <View style={styles.provenanceHeader}>
                  <Ionicons name="shield-checkmark" size={18} color={colors.accent} style={{ marginRight: 8 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.provenanceTitle, { color: colors.textPrimary }]}>
                      4 • Quelle & Herkunftsnachweis
                    </Text>
                    <Text style={[styles.provenanceSubtitle, { color: colors.textMuted }]}>
                      {selectedArticle.provenanceSummary ?? `Originalquelle: ${publisherDisplay} (${provenanceLabel})`}
                    </Text>
                  </View>
                </View>

                <View style={styles.provenanceBadgeRow}>
                  <View style={[styles.reviewBadge, { backgroundColor: colors.surfaceSecondary }]}>
                    <Text style={[styles.reviewBadgeText, { color: colors.textSecondary }]}>
                      Herkunft: {provenanceLabel}
                    </Text>
                  </View>
                  <View style={[styles.reviewBadge, { backgroundColor: colors.surfaceSecondary }]}>
                    <Text style={[styles.reviewBadgeText, { color: colors.textSecondary }]}>
                      Status: {formatFactReviewStatus(selectedArticle.factReviewStatus)}
                    </Text>
                  </View>
                </View>

                <Text style={[styles.sourceListHeader, { color: colors.textPrimary }]}>
                  Primärquelle & Direktlink:
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
                        onPress={() =>
                          setPreviewTarget({
                            visible: true,
                            url: ref.originalUrl,
                            title: ref.title,
                            publisher: ref.publisher
                          })
                        }
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
                        <Text style={styles.sourceOpenActionBtnText}>Originalquelle öffnen ↗</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>

          {/* Feedback Section */}
          <View style={[styles.feedbackBox, { backgroundColor: colors.surfaceSecondary }]}>
            <Text style={[styles.feedbackPrompt, { color: colors.textPrimary }]}>
              Wie soll atmen diesen Beitrag für zukünftige Ausgaben einordnen?
            </Text>
            <View style={[styles.feedbackButtonsRow, { flexWrap: 'wrap', justifyContent: 'center' }]}>
              <TouchableOpacity
                onPress={() => setFeedback(selectedArticle.id, currentFeedback === 'more_like_this' ? 'neutral' : 'more_like_this')}
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
                onPress={() => setFeedback(selectedArticle.id, currentFeedback === 'less_like_this' ? 'neutral' : 'less_like_this')}
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

              <TouchableOpacity
                onPress={() => setFeedback(selectedArticle.id, currentFeedback === 'already_known' ? 'neutral' : 'already_known')}
                style={[
                  styles.feedbackPill,
                  currentFeedback === 'already_known' && { backgroundColor: colors.accent }
                ]}
                accessibilityRole="button"
                accessibilityLabel="Thema bereits bekannt"
              >
                <Ionicons
                  name="checkmark-done-outline"
                  size={14}
                  color={currentFeedback === 'already_known' ? '#FFFFFF' : colors.textSecondary}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.feedbackPillText,
                    { color: currentFeedback === 'already_known' ? '#FFFFFF' : colors.textPrimary }
                  ]}
                >
                  Schon bekannt
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setFeedback(selectedArticle.id, currentFeedback === 'more_depth' ? 'neutral' : 'more_depth')}
                style={[
                  styles.feedbackPill,
                  currentFeedback === 'more_depth' && { backgroundColor: colors.accent }
                ]}
                accessibilityRole="button"
                accessibilityLabel="Mehr intellektuelle Tiefe bevorzugen"
              >
                <Ionicons
                  name="book-outline"
                  size={14}
                  color={currentFeedback === 'more_depth' ? '#FFFFFF' : colors.textSecondary}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.feedbackPillText,
                    { color: currentFeedback === 'more_depth' ? '#FFFFFF' : colors.textPrimary }
                  ]}
                >
                  Mehr Tiefe
                </Text>
              </TouchableOpacity>
            </View>

            {/* Time-worth reflective feedback */}
            <View style={[styles.timeWorthBox, { borderTopColor: colors.borderSubtle }]}>
              <Text style={[styles.feedbackSubPrompt, { color: colors.textSecondary }]}>
                War die Lesezeit bereichernd investiert?
              </Text>
              <View style={[styles.feedbackButtonsRow, { marginTop: 6 }]}>
                <TouchableOpacity
                  onPress={() => setFeedback(selectedArticle.id, currentFeedback || 'neutral', 'very_worthwhile')}
                  style={[
                    styles.feedbackMiniPill,
                    currentInteraction?.timeWorthFeedback === 'very_worthwhile' && { backgroundColor: colors.accent }
                  ]}
                  accessibilityRole="button"
                >
                  <Text style={[styles.feedbackMiniPillText, { color: currentInteraction?.timeWorthFeedback === 'very_worthwhile' ? '#FFFFFF' : colors.textPrimary }]}>
                    ✨ Sehr wertvoll
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setFeedback(selectedArticle.id, currentFeedback || 'neutral', 'worthwhile')}
                  style={[
                    styles.feedbackMiniPill,
                    currentInteraction?.timeWorthFeedback === 'worthwhile' && { backgroundColor: colors.surface }
                  ]}
                  accessibilityRole="button"
                >
                  <Text style={[styles.feedbackMiniPillText, { color: colors.textPrimary }]}>
                    👍 Gut investiert
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
            </View>

            {/* Desktop Sticky Right Sidebar */}
            {isDesktop && (
              <View style={styles.desktopRightCol}>
                {renderNotesAndCraftSidebar()}
              </View>
            )}
          </View>

          {/* Mobile Notes & Craft Section below Article */}
          {!isDesktop && (
            <View style={styles.mobileNotesContainer}>
              {renderNotesAndCraftSidebar()}
            </View>
          )}
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

      {/* Lightbox Modal for Authentic Article Images and Museum Artworks */}
      {showReaderImageLightbox && (selectedArticle.artMeta?.highResImageUrl || selectedArticle.imageUrl) && (
        <Modal
          visible={showReaderImageLightbox}
          transparent
          animationType="fade"
          onRequestClose={() => setShowReaderImageLightbox(false)}
        >
          <View style={styles.readerLightboxBackdrop}>
            <View style={styles.readerLightboxTopBar}>
              <View style={{ flex: 1 }}>
                <Text style={styles.readerLightboxTitle} numberOfLines={1}>
                  {selectedArticle.title}
                </Text>
                <Text style={styles.readerLightboxSub} numberOfLines={1}>
                  {selectedArticle.imageCredit || selectedArticle.artMeta?.artist || publisherDisplay}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowReaderImageLightbox(false)}
                style={styles.readerLightboxCloseBtn}
                accessibilityLabel="Vollbild schließen"
              >
                <Ionicons name="close" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={styles.readerLightboxScrollContent}
              maximumZoomScale={3}
              minimumZoomScale={1}
              centerContent
            >
              <View
                style={[
                  styles.readerLightboxCanvas,
                  (selectedArticle.format === 'meme' || Boolean(selectedArticle.memeMeta)) && {
                    backgroundColor: '#FFFFFF',
                    padding: 16,
                    borderRadius: radius.md
                  }
                ]}
              >
                <Image
                  source={{
                    uri: optimizeImageUrl(
                      selectedArticle.artMeta?.highResImageUrl || selectedArticle.imageUrl || '',
                      1600
                    )
                  }}
                  style={[
                    styles.readerLightboxImage,
                    readerImageAspectRatio ? { aspectRatio: readerImageAspectRatio } : { height: 540 }
                  ]}
                  resizeMode="contain"
                />
              </View>

              {selectedArticle.memeMeta?.punchline && (
                <View style={styles.readerLightboxPunchlineBox}>
                  <Text style={styles.readerLightboxPunchlineLabel}>🎁 Bonus-Punchline (Alt-Text):</Text>
                  <Text style={styles.readerLightboxPunchlineText}>„{selectedArticle.memeMeta.punchline}“</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </Modal>
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
  },
  abstractBox: {
    marginVertical: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1
  },
  abstractHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    paddingBottom: spacing.xs,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(128,128,128,0.2)'
  },
  ebeneTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.xs
  },
  ebeneTagText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  abstractReadingEstimate: {
    fontSize: 11
  },
  abstractSection: {
    marginBottom: spacing.sm
  },
  abstractLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2
  },
  abstractIcon: {
    fontSize: 12,
    marginRight: 6
  },
  abstractLabel: {
    fontSize: 12,
    fontWeight: '700'
  },
  abstractText: {
    fontSize: 13,
    lineHeight: 18,
    paddingLeft: 18
  },
  ebene3Header: {
    marginTop: spacing.md,
    marginBottom: spacing.sm
  },
  ebene3BadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8
  },
  synthesisTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.xs,
    borderWidth: 0.5
  },
  synthesisTypeBadgeText: {
    fontSize: 11,
    fontWeight: '600'
  },
  timeWorthBox: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 0.5,
    alignItems: 'center',
    width: '100%'
  },
  feedbackSubPrompt: {
    fontSize: 12,
    marginBottom: spacing.xs
  },
  feedbackMiniPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 0.5,
    borderColor: 'rgba(128,128,128,0.2)'
  },
  feedbackMiniPillText: {
    fontSize: 11,
    fontWeight: '600'
  },
  desktopNavBarInner: {
    maxWidth: 1160
  },
  desktopScrollInner: {
    maxWidth: 1160
  },
  desktopTwoColContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xl,
    width: '100%'
  },
  desktopLeftCol: {
    flex: 1,
    maxWidth: 720
  },
  desktopRightCol: {
    width: 360,
    maxWidth: 380
  },
  sidebarStickyWrapper: {
    gap: spacing.lg,
    width: '100%'
  },
  mobileNotesContainer: {
    marginTop: spacing.xl,
    gap: spacing.lg,
    width: '100%'
  },
  navCraftBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 0.5
  },
  navCraftBtnText: {
    fontSize: 12,
    fontWeight: '700'
  },
  craftExportCard: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1
  },
  craftExportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm
  },
  craftExportIconBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10
  },
  craftExportTitle: {
    fontSize: 14,
    fontWeight: '800'
  },
  craftExportSubtitle: {
    fontSize: 11,
    marginTop: 1
  },
  craftExportBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    borderWidth: 1,
    marginTop: 4
  },
  craftExportBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700'
  },
  composerCard: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1
  },
  composerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4
  },
  composerTitle: {
    fontSize: 14,
    fontWeight: '800'
  },
  composerSubtitle: {
    fontSize: 11,
    lineHeight: 15,
    marginBottom: spacing.sm
  },
  tagSelectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: spacing.sm
  },
  tagSelectorPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1
  },
  tagSelectorText: {
    fontSize: 11,
    fontWeight: '600'
  },
  composerInput: {
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: spacing.sm,
    fontSize: 13,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: spacing.sm
  },
  composerSubmitBtn: {
    paddingVertical: 9,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center'
  },
  composerSubmitText: {
    fontSize: 12,
    fontWeight: '700'
  },
  savedNotesCard: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1
  },
  savedNotesHeader: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: spacing.sm
  },
  userNoteItem: {
    padding: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    marginBottom: spacing.sm
  },
  userNoteTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  userNoteTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.xs
  },
  userNoteTagText: {
    fontSize: 10,
    fontWeight: '700'
  },
  userNoteDate: {
    fontSize: 10
  },
  userNoteText: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 6
  },
  sparringReplyBox: {
    borderLeftWidth: 2.5,
    paddingLeft: 8,
    paddingVertical: 4,
    marginTop: 4,
    borderRadius: radius.xs
  },
  sparringAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2
  },
  sparringAuthor: {
    fontSize: 11,
    fontWeight: '800'
  },
  sparringBadge: {
    fontSize: 10,
    marginLeft: 4
  },
  sparringReplyText: {
    fontSize: 11,
    lineHeight: 15,
    fontStyle: 'italic'
  },
  discussionBox: {
    marginTop: spacing.xl,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1
  },
  discussionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md
  },
  discussionTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 2
  },
  discussionSubtitle: {
    fontSize: 11,
    lineHeight: 15
  },
  commentsList: {
    gap: spacing.sm
  },
  commentCard: {
    padding: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  commentAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  commentAuthor: {
    fontSize: 12,
    fontWeight: '800'
  },
  commentBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.xs
  },
  commentBadgeText: {
    fontSize: 10,
    fontWeight: '700'
  },
  commentMetaRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  commentScore: {
    fontSize: 11,
    fontWeight: '700'
  },
  commentTime: {
    fontSize: 11
  },
  commentText: {
    fontSize: 13,
    lineHeight: 19
  },
  repliesList: {
    marginTop: spacing.sm,
    paddingLeft: spacing.md,
    gap: spacing.xs
  },
  replyCard: {
    padding: spacing.sm,
    borderRadius: radius.xs,
    borderWidth: 0.5
  },
  openFullArticleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: radius.md,
    marginTop: spacing.md,
    marginBottom: spacing.xs
  },
  openFullArticleButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700'
  },
  networkContextBox: {
    marginTop: spacing.xl,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1
  },
  networkContextHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: 10
  },
  networkIconBox: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center'
  },
  networkContextTitle: {
    fontSize: 15,
    fontWeight: '800'
  },
  networkContextSubtitle: {
    fontSize: 11,
    marginTop: 2
  },
  networkCardSection: {
    padding: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    marginBottom: spacing.sm
  },
  networkCardBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6
  },
  networkCardLabel: {
    fontSize: 11,
    fontWeight: '800'
  },
  networkCardText: {
    fontSize: 13,
    lineHeight: 19
  },
  counterBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.pill,
    marginRight: 6
  },
  counterBadgeSub: {
    fontSize: 10
  },
  crossRefSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4
  },
  crossRefCard: {
    padding: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1
  },
  crossRefTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4
  },
  crossRefPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.xs
  },
  crossRefPillText: {
    fontSize: 10,
    fontWeight: '700'
  },
  crossRefReason: {
    fontSize: 10,
    flex: 1,
    textAlign: 'right',
    marginLeft: 8
  },
  crossRefTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4
  },
  crossRefInsight: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 6
  },
  crossRefActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end'
  },
  crossRefActionText: {
    fontSize: 11,
    fontWeight: '700'
  },
  readerArtShowcaseContainer: {
    marginVertical: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: 'hidden'
  },
  readerArtImageWrapper: {
    width: '100%',
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center'
  },
  readerArtFullImage: {
    width: '100%',
    height: '100%'
  },
  readerArtCuratorialPlaque: {
    padding: spacing.lg,
    borderTopWidth: 1
  },
  readerArtPlaqueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm
  },
  readerArtPlaqueArtist: {
    fontSize: 18,
    fontWeight: '800'
  },
  readerArtPlaqueYear: {
    fontSize: 14,
    marginLeft: 6
  },
  readerArtDetailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginVertical: spacing.sm
  },
  readerArtDetailCol: {
    marginRight: spacing.md
  },
  readerArtDetailLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 2
  },
  readerArtDetailVal: {
    fontSize: 13,
    fontWeight: '600'
  },
  readerArtImpulseBox: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.xs,
    borderLeftWidth: 3
  },
  readerArtImpulseLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 4
  },
  readerArtImpulseText: {
    fontSize: 13,
    lineHeight: 19,
    fontStyle: 'italic'
  },
  primaryDirectSourceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: radius.md,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4
  },
  primaryDirectSourceBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.1
  },
  abstractIconBadge: {
    width: 24,
    height: 24,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8
  },
  readerArtCuratorialPlaqueStandalone: {
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    marginVertical: spacing.lg
  },
  rabbitHoleContainer: {
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1
  },
  rabbitHoleHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.md
  },
  rabbitHoleIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center'
  },
  rabbitHoleTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2
  },
  rabbitHoleSubtitle: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2
  },
  rabbitHoleList: {
    gap: spacing.md,
    marginTop: spacing.xs
  },
  rabbitHoleCard: {
    padding: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1
  },
  rabbitHoleCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6
  },
  rabbitHolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.xs
  },
  rabbitHolePillText: {
    fontSize: 10,
    fontWeight: '700'
  },
  rabbitHolePublisher: {
    fontSize: 11
  },
  rabbitHoleCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    marginBottom: 4
  },
  rabbitHoleCardReason: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 10
  },
  rabbitHoleCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap'
  },
  rabbitHoleActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.xs
  },
  rabbitHoleActionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700'
  },
  rabbitHoleSourceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.xs,
    borderWidth: 1
  },
  rabbitHoleSourceBtnText: {
    fontSize: 11,
    fontWeight: '600'
  },
  readerImageZoomBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.25)'
  },
  readerImageZoomText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600'
  },
  readerLightboxBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(9, 13, 22, 0.95)'
  },
  readerLightboxTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.12)'
  },
  readerLightboxTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700'
  },
  readerLightboxSub: {
    color: 'rgba(255, 255, 255, 0.68)',
    fontSize: 12,
    marginTop: 2
  },
  readerLightboxCloseBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12
  },
  readerLightboxScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  readerLightboxCanvas: {
    width: '100%',
    maxWidth: 1040,
    justifyContent: 'center',
    alignItems: 'center'
  },
  readerLightboxImage: {
    width: '100%',
    maxHeight: 820
  },
  readerLightboxPunchlineBox: {
    marginTop: 16,
    maxWidth: 820,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)'
  },
  readerLightboxPunchlineLabel: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2
  },
  readerLightboxPunchlineText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontStyle: 'italic'
  }
});
