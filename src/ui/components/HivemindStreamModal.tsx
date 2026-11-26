import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  generateNextHivemindChapter,
  extractTextFromUploadedFile,
  buildChaptersForTrack,
  buildMultiDocumentChapterSpecs
} from '../../core/learning/hivemindLearningService';

export interface HivemindStreamModalProps {
  visible: boolean;
  onClose: () => void;
  onStreamGenerated?: (items: FeedItem[]) => void;
  onStartFocusTrack?: (trackId: string) => void;
}

type CreatorSourceMode = 'topic_book' | 'pdf_file' | 'url_wiki';

interface UploadedDocumentEntry {
  id: string;
  name: string;
  text: string;
  wordCount: number;
  status: 'ready' | 'error';
  errorMessage?: string;
}

interface WebHistoryModalState {
  atemModal?: string;
}

function cleanUploadedFileTitle(fileName: string): string {
  return String(fileName || '')
    .replace(/\.(pdf|txt|md|json)$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function buildCombinedTitleFromDocuments(docs: UploadedDocumentEntry[]): string {
  const readyOrAll = docs.filter(d => d.status === 'ready');
  const sourceList = readyOrAll.length > 0 ? readyOrAll : docs;
  const cleanNames = sourceList
    .map(d => cleanUploadedFileTitle(d.name))
    .filter(Boolean);
  if (cleanNames.length === 0) return '';
  if (cleanNames.length === 1) return cleanNames[0];
  if (cleanNames.length === 2) return `${cleanNames[0]} & ${cleanNames[1]}`;
  if (cleanNames.length === 3) return `${cleanNames[0]} & ${cleanNames[1]} & ${cleanNames[2]}`;
  return `${cleanNames[0]} & ${cleanNames[1]} (+${cleanNames.length - 2} weitere)`;
}

const QUICK_SUGGESTIONS = [
  { label: 'Kants Erkenntnistheorie', value: 'Kants Kritik der reinen Vernunft' },
  { label: 'Platon: Höhlengleichnis', value: 'Platons Höhlengleichnis & Ideenlehre' },
  { label: 'Hartmann von Aue: Erec', value: 'Hartmann von Aue: Erec (Mittelhochdeutsche Epik)' },
  { label: 'Ableton & Klangsynthese', value: 'Modulare Klangsynthese & Frequenz-Architektur' }
];

export const HivemindStreamModal: React.FC<HivemindStreamModalProps> = ({
  visible,
  onClose,
  onStreamGenerated,
  onStartFocusTrack
}) => {
  const { colors, recomputeFeed, scheduleCloudSyncPush } = useApp();

  const [sourceMode, setSourceMode] = useState<CreatorSourceMode>('topic_book');
  const [titleInput, setTitleInput] = useState<string>('');
  const [documentTextInput, setDocumentTextInput] = useState<string>('');
  const [urlInput, setUrlInput] = useState<string>('');
  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedDocumentEntry[]>([]);
  const [isParsingFiles, setIsParsingFiles] = useState<boolean>(false);
  const [mixNewTrackIntoMainFeed, setMixNewTrackIntoMainFeed] = useState<boolean>(true);

  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [expandingTrackId, setExpandingTrackId] = useState<string | null>(null);
  const [progressStage, setProgressStage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [tracks, setTracks] = useState<HivemindLearningTrack[]>(() =>
    hivemindLearningService.getCachedTracks()
  );

  const hasCustomTitleRef = useRef<boolean>(false);
  const pushedHistoryEntryRef = useRef<boolean>(false);
  const closedViaPopStateRef = useRef<boolean>(false);
  const isClosingRef = useRef<boolean>(false);

  const handleTitleInputChange = useCallback((nextText: string) => {
    setTitleInput(nextText);
    hasCustomTitleRef.current = nextText.trim().length > 0;
  }, []);

  const handleCloseModal = useCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;

    if (
      Platform.OS === 'web' &&
      typeof window !== 'undefined' &&
      pushedHistoryEntryRef.current &&
      !closedViaPopStateRef.current
    ) {
      pushedHistoryEntryRef.current = false;
      const historyState = window.history.state as WebHistoryModalState | null;
      if (historyState?.atemModal === 'hivemind') {
        try {
          window.history.back();
        } catch {
          // Ignored
        }
      }
    } else {
      pushedHistoryEntryRef.current = false;
    }

    onClose();
  }, [onClose]);

  const handleCloseForFocusTrack = useCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;

    if (
      Platform.OS === 'web' &&
      typeof window !== 'undefined' &&
      pushedHistoryEntryRef.current
    ) {
      pushedHistoryEntryRef.current = false;
      const historyState = window.history.state as WebHistoryModalState | null;
      if (historyState?.atemModal === 'hivemind') {
        try {
          window.history.replaceState({}, '', window.location.href);
        } catch {
          // Ignored
        }
      }
    }

    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!visible) {
      pushedHistoryEntryRef.current = false;
      closedViaPopStateRef.current = false;
      isClosingRef.current = false;
      return;
    }

    isClosingRef.current = false;
    closedViaPopStateRef.current = false;

    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return;
    }

    if (!pushedHistoryEntryRef.current) {
      try {
        window.history.pushState({ atemModal: 'hivemind' }, '', window.location.href);
        pushedHistoryEntryRef.current = true;
      } catch {
        // Ignored
      }
    }

    const onPopState = (event: PopStateEvent) => {
      const currentState =
        (window.history.state as WebHistoryModalState | null) ??
        (event.state as WebHistoryModalState | null);
      if (currentState?.atemModal !== 'hivemind') {
        closedViaPopStateRef.current = true;
        pushedHistoryEntryRef.current = false;
        if (!isClosingRef.current) {
          isClosingRef.current = true;
          onClose();
        }
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleCloseModal();
      }
    };

    window.addEventListener('popstate', onPopState);
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [visible, onClose, handleCloseModal]);

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

  const handleWebFilePick = (append: boolean = false) => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.pdf,.txt,.md,.json';
    fileInput.multiple = true;
    fileInput.onchange = async (e: Event) => {
      const target = e.target as HTMLInputElement | null;
      const selectedFiles = target?.files ? Array.from(target.files) : [];
      if (selectedFiles.length === 0) return;

      setError(null);
      setIsParsingFiles(true);

      const extractedEntries: UploadedDocumentEntry[] = [];
      try {
        for (let idx = 0; idx < selectedFiles.length; idx++) {
          const file = selectedFiles[idx];
          const entryId = `doc-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`;
          try {
            const extracted = await extractTextFromUploadedFile(file, file.name);
            const trimmed = (extracted || '').trim();
            if (trimmed.length >= 20) {
              const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
              extractedEntries.push({
                id: entryId,
                name: file.name,
                text: trimmed,
                wordCount,
                status: 'ready'
              });
            } else {
              extractedEntries.push({
                id: entryId,
                name: file.name,
                text: '',
                wordCount: 0,
                status: 'error',
                errorMessage: 'Wenig oder kein auslesbarer Text erkannt (evtl. gescanntes PDF).'
              });
            }
          } catch (err: unknown) {
            extractedEntries.push({
              id: entryId,
              name: file.name,
              text: '',
              wordCount: 0,
              status: 'error',
              errorMessage:
                err instanceof Error && err.message
                  ? err.message
                  : 'Datei konnte nicht gelesen werden.'
            });
          }
        }

        setUploadedDocuments(prev => {
          const nextDocs = append ? [...prev, ...extractedEntries] : extractedEntries;
          if (!hasCustomTitleRef.current) {
            const autoTitle = buildCombinedTitleFromDocuments(nextDocs);
            if (autoTitle) {
              setTitleInput(autoTitle);
            }
          }
          return nextDocs;
        });

        const readyCount = extractedEntries.filter(d => d.status === 'ready').length;
        const failedCount = extractedEntries.length - readyCount;
        if (readyCount === 0 && failedCount > 0) {
          setError(
            failedCount === 1
              ? extractedEntries[0].errorMessage || 'Aus der Datei konnte kein Text extrahiert werden.'
              : 'Aus den ausgewählten Dateien konnte kein Text extrahiert werden. Du kannst den Text auch direkt unten einfügen.'
          );
        }
      } finally {
        setIsParsingFiles(false);
      }
    };
    fileInput.click();
  };

  const handleRemoveUploadedDocument = (docId: string) => {
    setUploadedDocuments(prev => {
      const nextDocs = prev.filter(doc => doc.id !== docId);
      if (!hasCustomTitleRef.current) {
        setTitleInput(buildCombinedTitleFromDocuments(nextDocs));
      }
      return nextDocs;
    });
    setError(null);
  };

  const handleGenerateTrack = async (customTopic?: string) => {
    const readyUploadedDocs = uploadedDocuments.filter(
      d => d.status === 'ready' && d.text.trim().length > 0
    );
    const manualText = sourceMode === 'pdf_file' ? documentTextInput.trim() : '';
    const sourceDocumentsPayload =
      sourceMode === 'pdf_file'
        ? [
            ...readyUploadedDocs.map(d => ({ name: d.name, text: d.text })),
            ...(manualText
              ? [{ name: titleInput.trim() || 'Manueller Text', text: manualText }]
              : [])
          ]
        : [];

    const fallbackTitleFromDocs = buildCombinedTitleFromDocuments(readyUploadedDocs);
    const effectiveTitle = (
      customTopic ??
      (sourceMode === 'url_wiki'
        ? titleInput.trim() || urlInput.trim()
        : titleInput.trim() || fallbackTitleFromDocs)
    ).trim();

    if (sourceMode === 'pdf_file' && uploadedDocuments.length > 0 && sourceDocumentsPayload.length === 0) {
      setError(
        'Keine der hochgeladenen Dateien enthält auslesbaren Text. Bitte entferne fehlerhafte Dateien oder füge den Text manuell unten ein.'
      );
      return;
    }

    if (!effectiveTitle && sourceDocumentsPayload.length === 0 && !manualText) {
      setError('Bitte gib ein Thema, einen Buchtitel oder einen Quelltext ein.');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setProgressStage('Starte Hivemind Lern-Synthese…');

    try {
      const creds = await loadAiCredentials().catch(() => undefined);
      const sourceLabel =
        sourceMode === 'pdf_file' && readyUploadedDocs.length > 0
          ? readyUploadedDocs.length === 1
            ? `Datei: ${readyUploadedDocs[0].name}`
            : `${readyUploadedDocs.length} Dokumente: ${readyUploadedDocs.map(d => d.name).slice(0, 3).join(', ')}${readyUploadedDocs.length > 3 ? '…' : ''}`
          : undefined;

      const track = await generateHivemindLearningTrack({
        titleOrTopic: effectiveTitle || 'Dokument-Lernpfad',
        sourceType:
          sourceMode === 'pdf_file'
            ? 'pdf_document'
            : sourceMode === 'url_wiki'
            ? 'url'
            : 'topic',
        sourceLabel,
        rawDocumentText: sourceMode === 'pdf_file' && sourceDocumentsPayload.length === 0 ? manualText : undefined,
        sourceDocuments: sourceDocumentsPayload.length > 0 ? sourceDocumentsPayload : undefined,
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
      scheduleCloudSyncPush();

      setTitleInput('');
      hasCustomTitleRef.current = false;
      setDocumentTextInput('');
      setUrlInput('');
      setUploadedDocuments([]);

      // Immediately open the newly created track in Focus Mode if handler provided
      if (onStartFocusTrack) {
        handleCloseForFocusTrack();
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

  const handleGenerateNextChapter = async (trackId: string) => {
    if (expandingTrackId) return;
    setExpandingTrackId(trackId);
    setError(null);
    try {
      const creds = await loadAiCredentials();
      const updated = await generateNextHivemindChapter(trackId, { credentials: creds });
      if (updated.items.length > 0) {
        feedRepository.addItems(updated.items);
      }
      await recomputeFeed();
      scheduleCloudSyncPush();
    } catch (e: unknown) {
      setError(e instanceof Error && e.message ? e.message : 'Nächstes Kapitel konnte nicht geladen werden.');
    } finally {
      setExpandingTrackId(null);
    }
  };

  const handleOpenFocusMode = (track: HivemindLearningTrack) => {
    if (track.items.length > 0) {
      feedRepository.addItems(track.items);
    }
    if (onStartFocusTrack) {
      handleCloseForFocusTrack();
      onStartFocusTrack(track.id);
    } else {
      handleCloseModal();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={handleCloseModal}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Top Cockpit Header */}
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.borderSubtle }]}>
          <View style={styles.headerTopBar}>
            <TouchableOpacity
              onPress={handleCloseModal}
              style={[
                styles.backToStreamBtn,
                { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }
              ]}
              accessibilityRole="button"
              accessibilityLabel="Zurück zum Stream"
            >
              <Text style={[styles.backToStreamText, { color: colors.textPrimary }]}>
                ← Zurück zum Stream
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleCloseModal}
              style={[styles.closeButton, { backgroundColor: colors.surfaceSecondary }]}
              accessibilityRole="button"
              accessibilityLabel="Hivemind schließen"
            >
              <Ionicons name="close" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
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
        </View>

        <ScrollView
          style={{ flex: 1, minHeight: 0 }}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
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
                  placeholder="z. B. Kants Erkenntnistheorie, Faust, Ableton Mixing, Sokrates…"
                  placeholderTextColor={colors.textMuted}
                  value={titleInput}
                  onChangeText={handleTitleInputChange}
                />

                <View style={styles.suggestionsWrap}>
                  {QUICK_SUGGESTIONS.map(s => (
                    <TouchableOpacity
                      key={s.label}
                      onPress={() => {
                        handleTitleInputChange(s.value);
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

            {sourceMode === 'pdf_file' && (() => {
              const readyDocs = uploadedDocuments.filter(d => d.status === 'ready' && d.text.trim().length > 0);
              const trimmedManual = documentTextInput.trim();
              const combinedReadyWordCount =
                readyDocs.reduce((sum, d) => sum + d.wordCount, 0) +
                (trimmedManual ? trimmedManual.split(/\s+/).filter(Boolean).length : 0);
              const allReadySources = [
                ...readyDocs.map(d => ({ name: d.name, text: d.text })),
                ...(trimmedManual ? [{ name: titleInput.trim() || 'Manueller Text', text: trimmedManual }] : [])
              ];
              const estimatedChapters =
                allReadySources.length >= 2
                  ? buildMultiDocumentChapterSpecs(titleInput.trim() || 'Dokument-Lernpfad', allReadySources).length
                  : allReadySources.length === 1
                  ? buildChaptersForTrack(titleInput.trim() || allReadySources[0].name, allReadySources[0].text).length
                  : 0;

              return (
                <View style={{ gap: 10 }}>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.surfaceSecondary, color: colors.textPrimary, borderColor: colors.borderSubtle, minHeight: 44 }]}
                    placeholder="Titel des Lernpfads (wird bei mehreren PDFs automatisch kombiniert)"
                    placeholderTextColor={colors.textMuted}
                    value={titleInput}
                    onChangeText={handleTitleInputChange}
                  />

                  {Platform.OS === 'web' && (
                    <TouchableOpacity
                      onPress={() => handleWebFilePick(uploadedDocuments.length > 0)}
                      disabled={isParsingFiles}
                      style={[
                        styles.fileUploadBtn,
                        { backgroundColor: colors.accentSubtle, borderColor: colors.accent, opacity: isParsingFiles ? 0.7 : 1 }
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel="PDF, TXT oder Markdown Dateien auswählen"
                    >
                      {isParsingFiles ? (
                        <ActivityIndicator size="small" color={colors.accent} style={{ marginRight: 8 }} />
                      ) : (
                        <Ionicons name="document-attach-outline" size={18} color={colors.accent} style={{ marginRight: 8 }} />
                      )}
                      <Text style={[styles.fileUploadBtnText, { color: colors.accent }]}>
                        {isParsingFiles
                          ? 'Lese Dokumente aus…'
                          : uploadedDocuments.length > 0
                          ? `${readyDocs.length} von ${uploadedDocuments.length} Dokumenten bereit (${combinedReadyWordCount.toLocaleString('de-DE')} Wörter)`
                          : 'PDF(s), .txt oder .md Dateien vom Gerät auswählen…'}
                      </Text>
                    </TouchableOpacity>
                  )}

                  {uploadedDocuments.length > 0 && (
                    <View
                      style={[
                        styles.uploadedDocsContainer,
                        { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }
                      ]}
                    >
                      <View style={styles.uploadedDocsHeader}>
                        <Text style={[styles.uploadedDocsHeading, { color: colors.textPrimary }]}>
                          Hochgeladene Dokumente ({uploadedDocuments.length})
                        </Text>
                        {estimatedChapters > 0 && (
                          <Text style={[styles.uploadedDocsMeta, { color: colors.textMuted }]}>
                            {combinedReadyWordCount.toLocaleString('de-DE')} Wörter · {estimatedChapters} Kapitel
                          </Text>
                        )}
                      </View>

                      {uploadedDocuments.map(doc => {
                        const isReady = doc.status === 'ready';
                        return (
                          <View
                            key={doc.id}
                            style={[
                              styles.uploadedDocRow,
                              {
                                backgroundColor: colors.surface,
                                borderColor: isReady ? colors.borderSubtle : 'rgba(239, 68, 68, 0.45)'
                              }
                            ]}
                          >
                            <Ionicons
                              name={isReady ? 'document-text-outline' : 'alert-circle-outline'}
                              size={16}
                              color={isReady ? colors.accent : '#EF4444'}
                              style={{ marginRight: 8, marginTop: 1 }}
                            />
                            <View style={{ flex: 1 }}>
                              <Text
                                style={[styles.uploadedDocName, { color: colors.textPrimary }]}
                                numberOfLines={1}
                              >
                                {doc.name}
                              </Text>
                              <Text
                                style={[
                                  styles.uploadedDocStatus,
                                  { color: isReady ? colors.textMuted : '#EF4444' }
                                ]}
                              >
                                {isReady
                                  ? `${doc.wordCount.toLocaleString('de-DE')} Wörter · Bereit`
                                  : doc.errorMessage || 'Fehler beim Auslesen'}
                              </Text>
                            </View>
                            <TouchableOpacity
                              onPress={() => handleRemoveUploadedDocument(doc.id)}
                              style={[styles.removeDocBtn, { backgroundColor: colors.surfaceSecondary }]}
                              accessibilityRole="button"
                              accessibilityLabel={`Dokument ${doc.name} entfernen`}
                            >
                              <Ionicons name="close" size={14} color={colors.textSecondary} />
                            </TouchableOpacity>
                          </View>
                        );
                      })}

                      {Platform.OS === 'web' && (
                        <TouchableOpacity
                          onPress={() => handleWebFilePick(true)}
                          disabled={isParsingFiles}
                          style={[
                            styles.appendDocsBtn,
                            { borderColor: colors.accent, backgroundColor: colors.surface }
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel="Weitere PDFs oder Dokumente hinzufügen"
                        >
                          <Ionicons name="add-circle-outline" size={15} color={colors.accent} style={{ marginRight: 6 }} />
                          <Text style={[styles.appendDocsBtnText, { color: colors.accent }]}>
                            + Weitere PDFs / Dokumente hinzufügen
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
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

                  {trimmedManual.length > 0 && (() => {
                    const charCount = trimmedManual.length;
                    const wordCount = trimmedManual.split(/\s+/).filter(Boolean).length;
                    const manualChapters = buildChaptersForTrack(
                      titleInput.trim() || 'Dokument',
                      trimmedManual
                    ).length;
                    const compactExcerpt = trimmedManual.replace(/\s+/g, ' ');
                    const previewExcerpt = compactExcerpt.length > 320
                      ? `${compactExcerpt.slice(0, 320)}…`
                      : compactExcerpt;

                    return (
                      <View
                        style={[
                          styles.textPreviewCard,
                          { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }
                        ]}
                      >
                        <View style={styles.textPreviewHeader}>
                          <View style={styles.textPreviewTitleRow}>
                            <Ionicons
                              name="document-text-outline"
                              size={15}
                              color={colors.accent}
                              style={{ marginRight: 6 }}
                            />
                            <Text style={[styles.textPreviewTitle, { color: colors.textPrimary }]}>
                              Text-Vorschau
                            </Text>
                          </View>
                          <TouchableOpacity
                            onPress={() => {
                              setDocumentTextInput('');
                              setError(null);
                            }}
                            style={[
                              styles.clearPreviewBtn,
                              { borderColor: colors.borderSubtle, backgroundColor: colors.surface }
                            ]}
                            accessibilityRole="button"
                            accessibilityLabel="Text leeren"
                          >
                            <Text style={[styles.clearPreviewBtnText, { color: colors.textSecondary }]}>
                              Text leeren
                            </Text>
                          </TouchableOpacity>
                        </View>
                        <Text style={[styles.textPreviewMeta, { color: colors.textMuted }]}>
                          {charCount.toLocaleString('de-DE')} Zeichen · {wordCount.toLocaleString('de-DE')} Wörter · ca. {manualChapters} Kapitel
                        </Text>
                        <Text style={[styles.textPreviewExcerpt, { color: colors.textSecondary }]} numberOfLines={4}>
                          {previewExcerpt}
                        </Text>
                      </View>
                    );
                  })()}
                </View>
              );
            })()}

            {sourceMode === 'url_wiki' && (
              <View style={{ gap: 10 }}>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surfaceSecondary, color: colors.textPrimary, borderColor: colors.borderSubtle, minHeight: 44 }]}
                  placeholder="Wikipedia-Artikel oder Thema (z. B. Stoa, Relativitätstheorie)"
                  placeholderTextColor={colors.textMuted}
                  value={titleInput}
                  onChangeText={handleTitleInputChange}
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
                      <Ionicons
                        name={
                          track.sourceType === 'pdf_document'
                            ? 'document-text-outline'
                            : track.sourceType === 'book'
                            ? 'book-outline'
                            : track.sourceType === 'url'
                            ? 'globe-outline'
                            : 'school-outline'
                        }
                        size={20}
                        color={colors.accent}
                      />
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

                  {track.usedAi === false && Boolean(track.fallbackReason) && (
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: radius.sm,
                        backgroundColor: 'rgba(245, 158, 11, 0.12)',
                        marginTop: 8
                      }}
                    >
                      <Ionicons name="information-circle-outline" size={14} color="#D97706" style={{ marginRight: 6 }} />
                      <Text style={{ flex: 1, fontSize: 11, color: colors.textSecondary }}>
                        {track.fallbackReason}
                      </Text>
                    </View>
                  )}

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
                          ? 'Komplett gemeistert'
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

                  {/* Multi-Chapter Progressive Expansion Button */}
                  {(() => {
                    const nextPendingChapter = (track.chapters || []).find(ch => !ch.isGenerated);
                    const nextChapterLabel = nextPendingChapter
                      ? nextPendingChapter.title
                      : `Kapitel ${(track.chapters?.length || 1) + 1}: Weiterführende Vertiefung`;
                    const isExpandingThis = expandingTrackId === track.id;

                    return (
                      <TouchableOpacity
                        onPress={() => void handleGenerateNextChapter(track.id)}
                        disabled={Boolean(expandingTrackId)}
                        style={{
                          marginTop: 10,
                          paddingVertical: 9,
                          paddingHorizontal: 12,
                          borderRadius: radius.md,
                          borderWidth: 1,
                          borderColor: colors.borderSubtle,
                          backgroundColor: colors.surfaceSecondary,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`Nächstes Kapitel laden für ${track.title}`}
                      >
                        {isExpandingThis ? (
                          <>
                            <ActivityIndicator size="small" color={colors.accent} style={{ marginRight: 8 }} />
                            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textPrimary }}>
                              Generiere nächstes Kapitel (+12 Karten)…
                            </Text>
                          </>
                        ) : (
                          <>
                            <Ionicons name="add-circle-outline" size={15} color={colors.accent} style={{ marginRight: 6 }} />
                            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textPrimary }} numberOfLines={1}>
                              Nächstes Kapitel laden ({nextChapterLabel} · +12 Karten)
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                    );
                  })()}
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
    flex: 1,
    minHeight: 0
  },
  header: {
    flexDirection: 'column',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    gap: 10
  },
  headerTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12
  },
  backToStreamBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1
  },
  backToStreamText: {
    fontSize: 13,
    fontWeight: '700'
  },
  headerTitleGroup: {
    width: '100%'
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
    justifyContent: 'center'
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
  uploadedDocsContainer: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.sm,
    gap: 8
  },
  uploadedDocsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 4
  },
  uploadedDocsHeading: {
    fontSize: 12.5,
    fontWeight: '800'
  },
  uploadedDocsMeta: {
    fontSize: 11.5,
    fontWeight: '600'
  },
  uploadedDocRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radius.sm,
    borderWidth: 1,
    gap: 6
  },
  uploadedDocName: {
    fontSize: 12.5,
    fontWeight: '700'
  },
  uploadedDocStatus: {
    fontSize: 11,
    marginTop: 1
  },
  removeDocBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center'
  },
  appendDocsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm,
    borderWidth: 1
  },
  appendDocsBtnText: {
    fontSize: 12,
    fontWeight: '700'
  },
  textPreviewCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    gap: 6
  },
  textPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8
  },
  textPreviewTitleRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  textPreviewTitle: {
    fontSize: 13,
    fontWeight: '700'
  },
  clearPreviewBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1
  },
  clearPreviewBtnText: {
    fontSize: 11.5,
    fontWeight: '600'
  },
  textPreviewMeta: {
    fontSize: 11.5,
    fontWeight: '600'
  },
  textPreviewExcerpt: {
    fontSize: 12.5,
    lineHeight: 18
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
