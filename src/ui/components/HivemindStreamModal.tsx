import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Platform,
  Switch
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../core/context/AppContext';
import { FeedItem } from '../../core/domain/types';
import { radius, spacing } from '../theme';
import { feedRepository } from '../../core/data/feedRepository';
import { loadAiCredentials } from '../../core/ai/atmenAiClient';
import {
  HivemindLearningTrack,
  hivemindLearningService,
  generateHivemindLearningTrack,
  extractTextFromUploadedFile
} from '../../core/learning/hivemindLearningService';

export interface HivemindStreamModalProps {
  visible: boolean;
  onClose: () => void;
  onStreamGenerated?: (items: FeedItem[]) => void;
  onStartFocusTrack?: (trackId: string) => void;
}

type CreatorSourceMode = 'topic_book' | 'pdf_file' | 'url_wiki';

const QUICK_SUGGESTIONS = [
  { label: 'Römisches Reich', value: 'Aufstieg & Fall Roms (Marius bis Augustus)' },
  { label: 'Quantenphysik', value: 'Quantenphysik & Realität' },
  { label: 'Kants Erkenntnistheorie', value: 'Kants Kritik der reinen Vernunft' },
  { label: 'Hartmann von Aue: Erec', value: 'Hartmann von Aue: Erec (Mittelhochdeutsche Epik)' },
  { label: 'Ableton & Klangsynthese', value: 'Modulare Klangsynthese & Frequenz-Architektur' }
];

export const HivemindStreamModal: React.FC<HivemindStreamModalProps> = ({
  visible,
  onClose,
  onStreamGenerated,
  onStartFocusTrack
}) => {
  const { colors, refreshFeed, recomputeFeed, scheduleCloudSyncPush } = useApp();

  const [sourceMode, setSourceMode] = useState<CreatorSourceMode>('topic_book');
  const [titleInput, setTitleInput] = useState<string>('');
  const [documentTextInput, setDocumentTextInput] = useState<string>('');
  const [urlInput, setUrlInput] = useState<string>('');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [mixNewTrackIntoMainFeed, setMixNewTrackIntoMainFeed] = useState<boolean>(true);

  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [progressStage, setProgressStage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [tracks, setTracks] = useState<HivemindLearningTrack[]>(() =>
    hivemindLearningService.getCachedTracks()
  );

  const loadTracks = useCallback(async () => {
    const loaded = await hivemindLearningService.getTracks();
    setTracks(loaded);
  }, []);

  useEffect(() => {
    if (visible) {
      void loadTracks();
    }
    return hivemindLearningService.subscribe(setTracks);
  }, [visible, loadTracks]);

  const handleWebFilePick = () => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.pdf,.txt,.md,.json';
    fileInput.onchange = async (e: any) => {
      const file = e?.target?.files?.[0];
      if (!file) return;
      setError(null);
      setUploadedFileName(file.name);
      if (!titleInput.trim()) {
        const baseName = String(file.name).replace(/\.(pdf|txt|md|json)$/i, '').replace(/[_-]+/g, ' ');
        setTitleInput(baseName);
      }
      try {
        const extracted = await extractTextFromUploadedFile(file, file.name);
        if (extracted && extracted.length >= 20) {
          setDocumentTextInput(extracted);
        } else {
          setError('Aus der Datei konnte nur wenig Text extrahiert werden. Du kannst den Text auch direkt unten einfügen.');
        }
      } catch {
        setError('Datei konnte nicht gelesen werden. Bitte Text direkt einfügen.');
      }
    };
    fileInput.click();
  };

  const handleGenerateTrack = async (customTopic?: string) => {
    const effectiveTitle = (
      customTopic ??
      (sourceMode === 'url_wiki' ? (titleInput.trim() || urlInput.trim()) : titleInput.trim())
    ).trim();

    if (!effectiveTitle && !documentTextInput.trim()) {
      setError('Bitte gib ein Thema, einen Buchtitel oder einen Quelltext ein.');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setProgressStage('Starte Hivemind Lern-Synthese…');

    try {
      const creds = await loadAiCredentials().catch(() => undefined);
      const track = await generateHivemindLearningTrack({
        titleOrTopic: effectiveTitle || uploadedFileName || 'Dokument-Lernpfad',
        sourceType:
          sourceMode === 'pdf_file'
            ? 'pdf_document'
            : sourceMode === 'url_wiki'
            ? 'url'
            : 'topic',
        sourceLabel: uploadedFileName ? `Datei: ${uploadedFileName}` : undefined,
        rawDocumentText: sourceMode === 'pdf_file' ? documentTextInput.trim() : undefined,
        sourceUrl: sourceMode === 'url_wiki' ? urlInput.trim() : undefined,
        targetCardCount: 12,
        mixIntoMainFeed: mixNewTrackIntoMainFeed,
        credentials: creds,
        onProgress: (_pct, label) => setProgressStage(label)
      });

      if (track.items.length > 0) {
        feedRepository.addItems(track.items);
        if (onStreamGenerated) {
          onStreamGenerated(track.items);
        }
      }

      await recomputeFeed();
      await refreshFeed();
      scheduleCloudSyncPush();

      setTitleInput('');
      setDocumentTextInput('');
      setUrlInput('');
      setUploadedFileName(null);

      // Immediately open the newly created track in Focus Mode if handler provided
      if (onStartFocusTrack) {
        onClose();
        onStartFocusTrack(track.id);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Fehler beim Generieren des Lern-Feeds.';
      setError(msg);
    } finally {
      setIsGenerating(false);
      setProgressStage('');
    }
  };

  const handleToggleMix = async (trackId: string, nextValue: boolean) => {
    const updated = await hivemindLearningService.toggleMixIntoMainFeed(trackId, nextValue);
    if (updated && nextValue && updated.items.length > 0) {
      feedRepository.addItems(updated.items);
    }
    await recomputeFeed();
    scheduleCloudSyncPush();
  };

  const handleDeleteTrack = async (trackId: string) => {
    await hivemindLearningService.deleteTrack(trackId);
    scheduleCloudSyncPush();
  };

  const handleOpenFocusMode = (track: HivemindLearningTrack) => {
    if (track.items.length > 0) {
      feedRepository.addItems(track.items);
    }
    onClose();
    if (onStartFocusTrack) {
      onStartFocusTrack(track.id);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Top Cockpit Header */}
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.borderSubtle }]}>
          <View style={styles.headerTitleGroup}>
            <View style={styles.headerBadgeRow}>
              <Ionicons name="school-outline" size={20} color={colors.accent} style={{ marginRight: 8 }} />
              <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
                Atmen Hivemind — Scroll to Study
              </Text>
            </View>
            <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
              Verwandle jedes Thema, Buch oder PDF in einen interaktiven Lern-Feed mit Fortschrittsbalken
            </Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            style={[styles.closeButton, { backgroundColor: colors.surfaceSecondary }]}
            accessibilityRole="button"
            accessibilityLabel="Hivemind schließen"
          >
            <Ionicons name="close" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* SECTION 1: Creator Box ("Was möchtest du heute durchdringen?") */}
          <View style={[styles.creatorCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              Was möchtest du heute durchdringen?
            </Text>

            {/* 3 Quick Source Mode Pills */}
            <View style={styles.sourceModeRow}>
              <TouchableOpacity
                onPress={() => setSourceMode('topic_book')}
                style={[
                  styles.sourceModePill,
                  {
                    backgroundColor: sourceMode === 'topic_book' ? colors.accent : colors.surfaceSecondary,
                    borderColor: sourceMode === 'topic_book' ? colors.accent : colors.borderSubtle
                  }
                ]}
                accessibilityRole="tab"
                accessibilityState={{ selected: sourceMode === 'topic_book' }}
              >
                <Ionicons
                  name="book-outline"
                  size={14}
                  color={sourceMode === 'topic_book' ? '#FFFFFF' : colors.textSecondary}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.sourceModePillText,
                    { color: sourceMode === 'topic_book' ? '#FFFFFF' : colors.textPrimary }
                  ]}
                >
                  Thema oder Buch
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setSourceMode('pdf_file')}
                style={[
                  styles.sourceModePill,
                  {
                    backgroundColor: sourceMode === 'pdf_file' ? colors.accent : colors.surfaceSecondary,
                    borderColor: sourceMode === 'pdf_file' ? colors.accent : colors.borderSubtle
                  }
                ]}
                accessibilityRole="tab"
                accessibilityState={{ selected: sourceMode === 'pdf_file' }}
              >
                <Ionicons
                  name="document-text-outline"
                  size={14}
                  color={sourceMode === 'pdf_file' ? '#FFFFFF' : colors.textSecondary}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.sourceModePillText,
                    { color: sourceMode === 'pdf_file' ? '#FFFFFF' : colors.textPrimary }
                  ]}
                >
                  PDF / Textdatei hochladen
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setSourceMode('url_wiki')}
                style={[
                  styles.sourceModePill,
                  {
                    backgroundColor: sourceMode === 'url_wiki' ? colors.accent : colors.surfaceSecondary,
                    borderColor: sourceMode === 'url_wiki' ? colors.accent : colors.borderSubtle
                  }
                ]}
                accessibilityRole="tab"
                accessibilityState={{ selected: sourceMode === 'url_wiki' }}
              >
                <Ionicons
                  name="globe-outline"
                  size={14}
                  color={sourceMode === 'url_wiki' ? '#FFFFFF' : colors.textSecondary}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.sourceModePillText,
                    { color: sourceMode === 'url_wiki' ? '#FFFFFF' : colors.textPrimary }
                  ]}
                >
                  Web-Link / Wikipedia
                </Text>
              </TouchableOpacity>
            </View>

            {/* Mode-Specific Inputs */}
            {sourceMode === 'topic_book' && (
              <>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surfaceSecondary, color: colors.textPrimary, borderColor: colors.borderSubtle }]}
                  placeholder="z. B. Römisches Reich, Quantenphysik, Faust, Ableton Mixing…"
                  placeholderTextColor={colors.textMuted}
                  value={titleInput}
                  onChangeText={setTitleInput}
                />

                <View style={styles.suggestionsWrap}>
                  {QUICK_SUGGESTIONS.map(s => (
                    <TouchableOpacity
                      key={s.label}
                      onPress={() => {
                        setTitleInput(s.value);
                      }}
                      style={[styles.suggestionChip, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}
                    >
                      <Text style={[styles.suggestionChipText, { color: colors.textSecondary }]}>
                        {s.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {sourceMode === 'pdf_file' && (
              <View style={{ gap: 10 }}>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surfaceSecondary, color: colors.textPrimary, borderColor: colors.borderSubtle, minHeight: 44 }]}
                  placeholder="Titel des Dokuments / Buches (z. B. Seminararbeit Erkenntnistheorie)"
                  placeholderTextColor={colors.textMuted}
                  value={titleInput}
                  onChangeText={setTitleInput}
                />

                {Platform.OS === 'web' && (
                  <TouchableOpacity
                    onPress={handleWebFilePick}
                    style={[
                      styles.fileUploadBtn,
                      { backgroundColor: colors.accentSubtle, borderColor: colors.accent }
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="PDF, TXT oder Markdown Datei auswählen"
                  >
                    <Ionicons name="document-attach-outline" size={18} color={colors.accent} style={{ marginRight: 8 }} />
                    <Text style={[styles.fileUploadBtnText, { color: colors.accent }]}>
                      {uploadedFileName
                        ? `Geladen: ${uploadedFileName} (${documentTextInput.length} Zeichen)`
                        : 'PDF, .txt oder .md Datei vom Gerät auswählen…'}
                    </Text>
                  </TouchableOpacity>
                )}

                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.surfaceSecondary,
                      color: colors.textPrimary,
                      borderColor: colors.borderSubtle,
                      minHeight: 110
                    }
                  ]}
                  placeholder="Oder füge hier beliebigen Buch-, PDF-, Skript- oder Notiztext direkt aus der Zwischenablage ein…"
                  placeholderTextColor={colors.textMuted}
                  value={documentTextInput}
                  onChangeText={setDocumentTextInput}
                  multiline
                  numberOfLines={5}
                />
              </View>
            )}

            {sourceMode === 'url_wiki' && (
              <View style={{ gap: 10 }}>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surfaceSecondary, color: colors.textPrimary, borderColor: colors.borderSubtle, minHeight: 44 }]}
                  placeholder="Wikipedia-Artikel oder Thema (z. B. Stoa, Relativitätstheorie)"
                  placeholderTextColor={colors.textMuted}
                  value={titleInput}
                  onChangeText={setTitleInput}
                />
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surfaceSecondary, color: colors.textPrimary, borderColor: colors.borderSubtle, minHeight: 44 }]}
                  placeholder="Optionaler Web-Link (https://…)"
                  placeholderTextColor={colors.textMuted}
                  value={urlInput}
                  onChangeText={setUrlInput}
                  autoCapitalize="none"
                />
              </View>
            )}

            {/* Ambient Drip Toggle for New Track */}
            <View style={[styles.ambientOptionRow, { borderTopColor: colors.borderSubtle }]}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="shuffle-outline" size={15} color={colors.accent} style={{ marginRight: 6 }} />
                  <Text style={[styles.ambientOptionTitle, { color: colors.textPrimary }]}>
                    Beiläufig im Haupt-Feed beimischen
                  </Text>
                </View>
                <Text style={[styles.ambientOptionSub, { color: colors.textMuted }]}>
                  Streut automatisch die nächsten 1–2 ungelesenen Lernkarten unter „Für dich“ ein
                </Text>
              </View>
              <Switch
                value={mixNewTrackIntoMainFeed}
                onValueChange={setMixNewTrackIntoMainFeed}
                trackColor={{ false: colors.surfaceSecondary, true: colors.accent }}
              />
            </View>

            {/* Lern-Feed generieren Button */}
            <TouchableOpacity
              onPress={() => void handleGenerateTrack()}
              disabled={isGenerating}
              style={[
                styles.generateButton,
                { backgroundColor: colors.accent, opacity: isGenerating ? 0.75 : 1 }
              ]}
              accessibilityRole="button"
              accessibilityLabel="Lern-Feed generieren"
            >
              {isGenerating ? (
                <>
                  <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.generateButtonText}>
                    {progressStage || 'Generiere Lern-Feed…'}
                  </Text>
                </>
              ) : (
                <>
                  <Ionicons name="sparkles" size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.generateButtonText}>
                    Lern-Feed generieren (12 Micro-Steps)
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {error && (
              <Text style={[styles.errorText, { color: '#EF4444' }]}>{error}</Text>
            )}
          </View>

          {/* SECTION 2: "Deine Lern-Pfade" (Visual Progress Cards like image_5.png) */}
          <View style={styles.tracksSection}>
            <View style={styles.tracksHeaderRow}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                Deine Lern-Pfade ({tracks.length})
              </Text>
              <Text style={[styles.tracksHeaderHint, { color: colors.textMuted }]}>
                Fokus-Stream oder beiläufig im Haupt-Feed
              </Text>
            </View>

            {tracks.map(track => {
              const completedCount = track.completedItemIds.length;
              const totalCount = track.totalItemsCount || track.items.length || 12;
              const pct = track.progressPercent;
              const nextStepIndex = Math.min(totalCount, completedCount + 1);
              const isFinished = pct >= 100;

              return (
                <View
                  key={track.id}
                  style={[
                    styles.trackCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: isFinished ? '#10B981' : colors.borderSubtle
                    }
                  ]}
                >
                  {/* Top Row: Icon + Title + Subtitle + Delete Button */}
                  <View style={styles.trackTopRow}>
                    <View style={[styles.trackEmojiBox, { backgroundColor: colors.surfaceSecondary }]}>
                      <Text style={{ fontSize: 22 }}>{track.iconEmoji || '🧠'}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.trackTitle, { color: colors.textPrimary }]}>
                        {track.title}
                      </Text>
                      <Text style={[styles.trackSubtitle, { color: colors.textMuted }]}>
                        {track.subtitle} • {completedCount}/{totalCount} Karten gelernt
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => void handleDeleteTrack(track.id)}
                      style={[styles.deleteTrackBtn, { backgroundColor: colors.surfaceSecondary }]}
                      accessibilityRole="button"
                      accessibilityLabel={`Lernpfad ${track.title} löschen`}
                    >
                      <Ionicons name="trash-outline" size={15} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>

                  {/* Visual Progress Bar (0% - 100%) */}
                  <View style={styles.progressSection}>
                    <View style={styles.progressLabelRow}>
                      <Text
                        style={[
                          styles.progressPercentLabel,
                          { color: isFinished ? '#10B981' : colors.accent }
                        ]}
                      >
                        {pct}% abgeschlossen
                      </Text>
                      <Text style={[styles.progressStepsLabel, { color: colors.textMuted }]}>
                        {isFinished
                          ? '✓ Komplett gemeistert'
                          : `Nächster Schritt: ${nextStepIndex} von ${totalCount}`}
                      </Text>
                    </View>
                    <View style={[styles.progressBarTrack, { backgroundColor: colors.surfaceSecondary }]}>
                      <View
                        style={[
                          styles.progressBarFill,
                          {
                            width: `${Math.max(pct, 2)}%`,
                            backgroundColor: isFinished ? '#10B981' : colors.accent
                          }
                        ]}
                      />
                    </View>
                  </View>

                  {/* Action Controls: 1. Focus Stream Button + 2. Ambient Drip Toggle */}
                  <View style={styles.trackActionsRow}>
                    <TouchableOpacity
                      onPress={() => handleOpenFocusMode(track)}
                      style={[styles.focusStartBtn, { backgroundColor: colors.accent }]}
                      accessibilityRole="button"
                      accessibilityLabel={`Fokus-Stream starten für ${track.title}`}
                    >
                      <Ionicons name="play" size={13} color="#FFFFFF" style={{ marginRight: 6 }} />
                      <Text style={styles.focusStartBtnText}>
                        {completedCount === 0
                          ? 'Fokus-Stream starten (Schritt 1)'
                          : isFinished
                          ? 'Fokus-Stream erneut öffnen'
                          : `Fokus-Stream fortsetzen (Schritt ${nextStepIndex})`}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => void handleToggleMix(track.id, !track.mixIntoMainFeed)}
                      style={[
                        styles.mixTogglePill,
                        {
                          backgroundColor: track.mixIntoMainFeed ? colors.accentSubtle : colors.surfaceSecondary,
                          borderColor: track.mixIntoMainFeed ? colors.accent : colors.borderSubtle
                        }
                      ]}
                      accessibilityRole="switch"
                      accessibilityState={{ checked: track.mixIntoMainFeed }}
                      accessibilityLabel="Im Haupt-Feed beimischen"
                    >
                      <Ionicons
                        name="shuffle-outline"
                        size={13}
                        color={track.mixIntoMainFeed ? colors.accent : colors.textSecondary}
                        style={{ marginRight: 5 }}
                      />
                      <Text
                        style={[
                          styles.mixToggleText,
                          { color: track.mixIntoMainFeed ? colors.accent : colors.textSecondary }
                        ]}
                      >
                        Im Haupt-Feed: {track.mixIntoMainFeed ? 'Aktiv' : 'Pausiert'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1
  },
  headerTitleGroup: {
    flex: 1
  },
  headerBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.md
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
    maxWidth: 780,
    width: '100%',
    alignSelf: 'center',
    gap: spacing.lg
  },
  creatorCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2
  },
  sourceModeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  sourceModePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1
  },
  sourceModePillText: {
    fontSize: 12.5,
    fontWeight: '700'
  },
  input: {
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 14,
    textAlignVertical: 'top'
  },
  suggestionsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  suggestionChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1
  },
  suggestionChipText: {
    fontSize: 12,
    fontWeight: '600'
  },
  fileUploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed'
  },
  fileUploadBtnText: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1
  },
  ambientOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 0.5
  },
  ambientOptionTitle: {
    fontSize: 13,
    fontWeight: '700'
  },
  ambientOptionSub: {
    fontSize: 11.5,
    marginTop: 2
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.md
  },
  generateButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13.5
  },
  errorText: {
    fontSize: 12.5,
    fontWeight: '600'
  },
  tracksSection: {
    gap: spacing.md
  },
  tracksHeaderRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6
  },
  tracksHeaderHint: {
    fontSize: 12
  },
  trackCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    gap: 12
  },
  trackTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  trackEmojiBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  trackTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2
  },
  trackSubtitle: {
    fontSize: 12,
    marginTop: 2
  },
  deleteTrackBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center'
  },
  progressSection: {
    gap: 6
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  progressPercentLabel: {
    fontSize: 12.5,
    fontWeight: '800'
  },
  progressStepsLabel: {
    fontSize: 11.5,
    fontWeight: '600'
  },
  progressBarTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    width: '100%'
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4
  },
  trackActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: 2
  },
  focusStartBtn: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.md,
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  focusStartBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '800'
  },
  mixTogglePill: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  mixToggleText: {
    fontSize: 12,
    fontWeight: '700'
  }
});
