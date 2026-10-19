import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Pressable,
  ScrollView,
  TextInput,
  Image,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'qrcode';
import { useApp } from '../../core/context/AppContext';
import { Subchannel, defaultSpaceRepository } from '../../core/spaces/spaceRepository';
import { TrendRadarService, DialecticalTrend } from '../../core/synthesis/trendRadarService';
import { ArchiveService, ArchivedEdition } from '../../core/archive/archiveService';
import {
  FoundationalCanonService,
  FoundationalCanon
} from '../../core/archive/foundationalCanonService';
import {
  RecursiveLearningEngine,
  LearningEngineState
} from '../../core/recommendations/recursiveLearningEngine';
import { DailyGenerationService, DailyGenerationStatus } from '../../core/daily/dailyGenerationService';
import { copyToClipboard, downloadMarkdownFile, downloadJsonFile } from '../../core/export/craftExport';
import { typography, radius, spacing } from '../theme';
import { TopicTag, TOPIC_SPACE_MAP } from '../../core/domain/types';
import {
  STUDIO_LENSES,
  StudioLens,
  StudioOutput,
  defaultAtmenStudioService
} from '../../core/studio/atmenStudio';

export type MasterTab = 'studio' | 'channels' | 'trends' | 'daily' | 'learning' | 'archive' | 'mobile';

interface UltraMasterModalProps {
  visible: boolean;
  onClose: () => void;
  initialTab?: MasterTab;
}

export const UltraMasterModal: React.FC<UltraMasterModalProps> = ({ visible, onClose, initialTab }) => {
  const { colors, profile, refreshFeed, spaces, createSpace, deleteSpace, togglePinSpace } = useApp();

  const [activeTab, setActiveTab] = useState<MasterTab>(initialTab || 'studio');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (visible && initialTab) {
      setActiveTab(initialTab);
    }
  }, [visible, initialTab]);

  // Atmen Studio 3 Lenses state
  const [studioLens, setStudioLens] = useState<StudioLens>('contemplation');
  const [studioTitle, setStudioTitle] = useState<string>('Digitale Reizüberflutung & Souveränität');
  const [studioText, setStudioText] = useState<string>('Wie wir in einer Welt permanenter Dopamin-Pings unsere kognitive Autonomie bewahren und Raum für tiefes Denken schaffen.');
  const [isTransformingLens, setIsTransformingLens] = useState<boolean>(false);
  const [studioOutput, setStudioOutput] = useState<StudioOutput | null>(null);

  // Subchannels state
  const [newChannelTitle, setNewChannelTitle] = useState<string>('');
  const [newChannelHandle, setNewChannelHandle] = useState<string>('');
  const [newChannelDesc, setNewChannelDesc] = useState<string>('');
  const [newChannelFlair, setNewChannelFlair] = useState<string>('');
  const [newChannelPrompt, setNewChannelPrompt] = useState<string>('');
  const [newChannelTopic, setNewChannelTopic] = useState<TopicTag>('philosophy_ethics');
  const [isCreatingChannel, setIsCreatingChannel] = useState<boolean>(false);

  // Trends state
  const [trends, setTrends] = useState<DialecticalTrend[]>([]);

  // Daily Generation state
  const [dailyStatus, setDailyStatus] = useState<DailyGenerationStatus | null>(null);
  const [isGeneratingDaily, setIsGeneratingDaily] = useState<boolean>(false);

  // Learning Engine state
  const [learningState, setLearningState] = useState<LearningEngineState | null>(null);

  // Archive state
  const [archivedEditions, setArchivedEditions] = useState<ArchivedEdition[]>([]);
  const [selectedArchiveEdition, setSelectedArchiveEdition] = useState<ArchivedEdition | null>(null);
  const [archiveSearchTerm, setArchiveSearchTerm] = useState<string>('');
  const [canon, setCanon] = useState<FoundationalCanon | null>(null);

  // Mobile QR state
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  const defaultLanUrl = 'http://192.168.178.31:8081';
  const accessUrl = typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
    ? `${window.location.protocol}//${window.location.host}`
    : defaultLanUrl;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadData = async () => {
    try {
      const [status, learn, editions, baseCanon] = await Promise.all([
        DailyGenerationService.getStatus(),
        RecursiveLearningEngine.getEngineState(),
        ArchiveService.getAllArchivedEditions(),
        FoundationalCanonService.getCanon()
      ]);
      setDailyStatus(status);
      setLearningState(learn);
      setArchivedEditions(editions);
      setCanon(baseCanon);
      if (editions.length > 0 && !selectedArchiveEdition) {
        setSelectedArchiveEdition(editions[0]);
      }
      setTrends(TrendRadarService.getActiveTrends());
    } catch (e) {
      console.warn('UltraMasterModal load error:', e);
    }
  };

  const handleExportCanonMarkdown = () => {
    if (!canon) return;
    const md = FoundationalCanonService.exportCanonToMarkdown(canon);
    downloadMarkdownFile('atmen-ur-fundament.md', md);
    showToast('✓ Ur-Fundament als Markdown exportiert!');
  };

  const handleExportCanonJson = () => {
    if (!canon) return;
    const json = FoundationalCanonService.exportCanonToJson(canon);
    downloadJsonFile('atmen-ur-fundament.json', json);
    showToast('✓ Ur-Fundament als JSON exportiert!');
  };

  useEffect(() => {
    if (visible) {
      void loadData();
      QRCode.toDataURL(accessUrl, {
        width: 280,
        margin: 2,
        color: { dark: '#000000', light: '#FFFFFF' }
      })
        .then(setQrDataUrl)
        .catch(console.warn);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, accessUrl]);

  // Channel Creation
  const handleCreateChannel = async () => {
    if (!newChannelTitle.trim()) {
      showToast('Bitte einen Namen für den Subchannel eingeben');
      return;
    }
    setIsCreatingChannel(true);
    try {
      const created = await createSpace({
        title: newChannelTitle.trim(),
        handle: newChannelHandle.trim() || undefined,
        description: newChannelDesc.trim(),
        flair: newChannelFlair.trim() || undefined,
        antithesisPrompt: newChannelPrompt.trim() || undefined,
        primaryTopic: newChannelTopic
      });
      setNewChannelTitle('');
      setNewChannelHandle('');
      setNewChannelDesc('');
      setNewChannelFlair('');
      setNewChannelPrompt('');
      showToast(`✓ Subchannel „${created.handle}“ erfolgreich erstellt und geöffnet!`);
      await refreshFeed();
      onClose();
    } catch (err: any) {
      showToast(err?.message || 'Fehler beim Erstellen des Subchannels');
    } finally {
      setIsCreatingChannel(false);
    }
  };

  const handleDeleteChannel = async (id: string, handle: string) => {
    const ok = await deleteSpace(id);
    if (ok) {
      showToast(`Subchannel ${handle} entfernt`);
      await refreshFeed();
    }
  };

  const handleTogglePin = async (id: string) => {
    await togglePinSpace(id);
  };

  // Daily Generation
  const handleTriggerDaily = async () => {
    setIsGeneratingDaily(true);
    try {
      const res = await DailyGenerationService.generateDailyEdition(profile, undefined, true);
      await loadData();
      await refreshFeed();
      showToast(`✓ Tagesausgabe mit ${res.generatedItems.length} Artikeln erfolgreich generiert!`);
    } catch {
      showToast('Fehler bei der Tagesausgaben-Generierung');
    } finally {
      setIsGeneratingDaily(false);
    }
  };

  // Trend Action
  const handleAdoptTrend = async (trend: DialecticalTrend) => {
    const _item = TrendRadarService.convertTrendToFeedItem(trend);
    void _item;
    await DailyGenerationService.generateDailyEdition(profile);
    await refreshFeed();
    showToast(`✓ Trend „${trend.trendTopic}“ als dialektischer Artikel im Feed verankert!`);
  };

  // Archive Export
  const handleExportArchiveMarkdown = (edition: ArchivedEdition) => {
    const md = ArchiveService.exportEditionToMarkdown(edition);
    const filename = `atmen-tagesausgabe-${edition.date}.md`;
    downloadMarkdownFile(filename, md);
    showToast(`✓ Datei ${filename} exportiert!`);
  };

  const handleCopyLink = async () => {
    const ok = await copyToClipboard(accessUrl);
    if (ok) {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 3000);
    }
  };

  // Atmen Studio Handlers
  const handleTransformStudioLens = async () => {
    if (!studioTitle.trim() || !studioText.trim()) {
      showToast('Bitte Titel und Text für die Studio-Transformation eingeben');
      return;
    }
    setIsTransformingLens(true);
    try {
      const output = await defaultAtmenStudioService.generateLensOutput({
        title: studioTitle.trim(),
        text: studioText.trim(),
        lens: studioLens
      });
      setStudioOutput(output);
      showToast(`✓ Linse „${STUDIO_LENSES[studioLens].title}“ erfolgreich berechnet!`);
    } catch {
      showToast('Fehler bei der Studio-Transformation');
    } finally {
      setIsTransformingLens(false);
    }
  };

  const handleExportStudioMarkdown = () => {
    if (!studioOutput) return;
    const md = defaultAtmenStudioService.formatStudioOutputMarkdown(studioOutput);
    const filename = `atmen-studio-${studioLens}-${Date.now()}.md`;
    downloadMarkdownFile(filename, md);
    showToast(`✓ Studio-Output als ${filename} exportiert!`);
  };

  const handleCopyStudioMarkdown = async () => {
    if (!studioOutput) return;
    const md = defaultAtmenStudioService.formatStudioOutputMarkdown(studioOutput);
    const ok = await copyToClipboard(md);
    if (ok) {
      showToast('✓ Markdown in die Zwischenablage kopiert!');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable
          accessibilityLabel="Hintergrund schließen"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <View
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
          onStartShouldSetResponder={() => true}
          // @ts-ignore - web click propagation guard
          onClick={(e: any) => {
            if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
          }}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.borderSubtle }]}>
            <View style={styles.headerLeft}>
              <View style={[styles.iconEmblem, { backgroundColor: '#F59E0B' + '22' }]}>
                <Ionicons name="sparkles" size={18} color="#F59E0B" />
              </View>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
                    AI Ultra Master Studio
                  </Text>
                  <View style={styles.ultraPill}>
                    <Text style={styles.ultraPillText}>ULTRA MASTER</Text>
                  </View>
                </View>
                <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
                  Dialektische Kuration, Subchannels on the Go, Rekursives Lernen & Dauer-Archiv
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: colors.surfaceSecondary }]}
              accessibilityRole="button"
              accessibilityLabel="Studio schließen"
            >
              <Ionicons name="close" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Toast */}
          {toastMessage && (
            <View style={[styles.toast, { backgroundColor: colors.accent }]}>
              <Text style={styles.toastText}>{toastMessage}</Text>
            </View>
          )}

          {/* Navigation Bar */}
          <View style={[styles.tabBar, { borderBottomColor: colors.borderSubtle, backgroundColor: colors.surfaceSecondary }]}>
            <TouchableOpacity
              onPress={() => setActiveTab('studio')}
              style={[styles.tabItem, activeTab === 'studio' && { borderBottomColor: '#EC4899', backgroundColor: colors.surface }]}
            >
              <Ionicons name="sparkles" size={14} color={activeTab === 'studio' ? '#EC4899' : colors.textMuted} style={{ marginRight: 6 }} />
              <Text style={[styles.tabItemText, { color: activeTab === 'studio' ? '#EC4899' : colors.textSecondary }]}>
                ✨ Studio (3 Linsen)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActiveTab('channels')}
              style={[styles.tabItem, activeTab === 'channels' && { borderBottomColor: '#F59E0B', backgroundColor: colors.surface }]}
            >
              <Ionicons name="layers-outline" size={14} color={activeTab === 'channels' ? '#F59E0B' : colors.textMuted} style={{ marginRight: 6 }} />
              <Text style={[styles.tabItemText, { color: activeTab === 'channels' ? '#F59E0B' : colors.textSecondary }]}>
                Subchannels ({spaces.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActiveTab('trends')}
              style={[styles.tabItem, activeTab === 'trends' && { borderBottomColor: '#EF4444', backgroundColor: colors.surface }]}
            >
              <Ionicons name="trending-up-outline" size={14} color={activeTab === 'trends' ? '#EF4444' : colors.textMuted} style={{ marginRight: 6 }} />
              <Text style={[styles.tabItemText, { color: activeTab === 'trends' ? '#EF4444' : colors.textSecondary }]}>
                Trend-Radar & Dialektik
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActiveTab('daily')}
              style={[styles.tabItem, activeTab === 'daily' && { borderBottomColor: '#10B981', backgroundColor: colors.surface }]}
            >
              <Ionicons name="calendar-outline" size={14} color={activeTab === 'daily' ? '#10B981' : colors.textMuted} style={{ marginRight: 6 }} />
              <Text style={[styles.tabItemText, { color: activeTab === 'daily' ? '#10B981' : colors.textSecondary }]}>
                Tages-Generator & Daemon
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActiveTab('learning')}
              style={[styles.tabItem, activeTab === 'learning' && { borderBottomColor: '#8B5CF6', backgroundColor: colors.surface }]}
            >
              <Ionicons name="bulb-outline" size={14} color={activeTab === 'learning' ? '#8B5CF6' : colors.textMuted} style={{ marginRight: 6 }} />
              <Text style={[styles.tabItemText, { color: activeTab === 'learning' ? '#8B5CF6' : colors.textSecondary }]}>
                Rekursives Lernen
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActiveTab('archive')}
              style={[styles.tabItem, activeTab === 'archive' && { borderBottomColor: '#3B82F6', backgroundColor: colors.surface }]}
            >
              <Ionicons name="library-outline" size={14} color={activeTab === 'archive' ? '#3B82F6' : colors.textMuted} style={{ marginRight: 6 }} />
              <Text style={[styles.tabItemText, { color: activeTab === 'archive' ? '#3B82F6' : colors.textSecondary }]}>
                Bibliothek & Archiv
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActiveTab('mobile')}
              style={[styles.tabItem, activeTab === 'mobile' && { borderBottomColor: '#06B6D4', backgroundColor: colors.surface }]}
            >
              <Ionicons name="phone-portrait-outline" size={14} color={activeTab === 'mobile' ? '#06B6D4' : colors.textMuted} style={{ marginRight: 6 }} />
              <Text style={[styles.tabItemText, { color: activeTab === 'mobile' ? '#06B6D4' : colors.textSecondary }]}>
                Smartphone QR
              </Text>
            </TouchableOpacity>
          </View>

          {/* Content Area */}
          <View style={styles.contentContainer}>
            {/* TAB 0: Atmen Studio 3 Lenses */}
            {activeTab === 'studio' && (
              <ScrollView style={styles.tabScroll} contentContainerStyle={styles.tabScrollContent}>
                <View style={[styles.sectionBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                    <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                      ✨ Atmen Studio: Kognitive Transformation (3 Linsen)
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#EC4899' + '18', paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.sm }}>
                      <Ionicons name="hardware-chip-outline" size={12} color="#EC4899" />
                      <Text style={{ fontSize: typography.sizes.micro, color: '#EC4899', fontWeight: '700' }}>
                        Gemini 3.8 / OpenRouter + Deterministic Fallback
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.sectionDesc, { color: colors.textMuted, marginTop: 4 }]}>
                    Betrachte beliebige Texte oder Gedanken durch drei fundamentale erkenntnistheoretische Linsen: Didaktik (First-Principles), Kontemplation (Stoa/Zen) oder Klang-Alchemie (Resonanz).
                  </Text>

                  {/* 3 Lenses Selector */}
                  <View style={{ marginTop: spacing.md }}>
                    <Text style={[styles.inputLabel, { color: colors.textSecondary, marginBottom: 8 }]}>
                      Wähle eine transformative Linse:
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                      {(Object.keys(STUDIO_LENSES) as StudioLens[]).map(lensKey => {
                        const lensInfo = STUDIO_LENSES[lensKey];
                        const isSelected = studioLens === lensKey;
                        const lensColor = lensKey === 'didactics' ? '#3B82F6' : lensKey === 'contemplation' ? '#10B981' : '#8B5CF6';
                        return (
                          <TouchableOpacity
                            key={lensKey}
                            onPress={() => setStudioLens(lensKey)}
                            style={[
                              styles.lensCard,
                              {
                                backgroundColor: isSelected ? lensColor + '15' : colors.surface,
                                borderColor: isSelected ? lensColor : colors.borderSubtle
                              }
                            ]}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                              <Text style={{ fontSize: 16 }}>{lensInfo.badge.split(' ')[0]}</Text>
                              <Text style={[styles.lensTitle, { color: isSelected ? lensColor : colors.textPrimary }]}>
                                {lensInfo.title}
                              </Text>
                            </View>
                            <Text style={[styles.lensDesc, { color: colors.textMuted }]} numberOfLines={2}>
                              {lensInfo.description}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {/* Input Fields */}
                  <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
                    <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Titel oder Kern-Fragestellung:</Text>
                    <TextInput
                      value={studioTitle}
                      onChangeText={setStudioTitle}
                      placeholder="z.B. Informationsüberlastung & Aufmerksamkeit"
                      placeholderTextColor={colors.textMuted}
                      style={[styles.textInput, { backgroundColor: colors.surface, borderColor: colors.borderSubtle, color: colors.textPrimary }]}
                    />

                    <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Textkörper, Notiz oder Gedankenfragment:</Text>
                    <TextInput
                      value={studioText}
                      onChangeText={setStudioText}
                      multiline
                      numberOfLines={4}
                      placeholder="Füge hier deinen Text, Notizen oder Artikelabschnitt ein..."
                      placeholderTextColor={colors.textMuted}
                      style={[styles.textInput, { backgroundColor: colors.surface, borderColor: colors.borderSubtle, color: colors.textPrimary, minHeight: 90, textAlignVertical: 'top' }]}
                    />

                    <TouchableOpacity
                      onPress={handleTransformStudioLens}
                      disabled={isTransformingLens}
                      style={[
                        styles.primaryActionBtn,
                        {
                          backgroundColor: studioLens === 'didactics' ? '#3B82F6' : studioLens === 'contemplation' ? '#10B981' : '#8B5CF6',
                          marginTop: spacing.sm
                        }
                      ]}
                    >
                      {isTransformingLens ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <Ionicons name="sparkles" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                          <Text style={styles.primaryActionBtnText}>
                            Durch Linse „{STUDIO_LENSES[studioLens].title}“ transformieren
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Studio Transformation Output */}
                {studioOutput && (
                  <View style={[styles.sectionBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle, marginTop: spacing.md }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={[styles.customBadge, { backgroundColor: colors.accent + '20' }]}>
                          <Text style={styles.customBadgeText}>
                            {STUDIO_LENSES[studioOutput.lens].badge}
                          </Text>
                        </View>
                        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                          {studioOutput.heading}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity
                          onPress={handleCopyStudioMarkdown}
                          style={[styles.secondaryActionBtn, { borderColor: colors.borderSubtle, backgroundColor: colors.surface }]}
                        >
                          <Ionicons name="copy-outline" size={14} color={colors.textSecondary} style={{ marginRight: 4 }} />
                          <Text style={[styles.secondaryActionBtnText, { color: colors.textSecondary }]}>Kopieren</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={handleExportStudioMarkdown}
                          style={[styles.secondaryActionBtn, { borderColor: colors.borderSubtle, backgroundColor: colors.surface }]}
                        >
                          <Ionicons name="download-outline" size={14} color={colors.textSecondary} style={{ marginRight: 4 }} />
                          <Text style={[styles.secondaryActionBtnText, { color: colors.textSecondary }]}>Export .md</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* AI Generation Status Badge */}
                    <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center' }}>
                      {studioOutput.isAiGenerated ? (
                        <View style={{ backgroundColor: '#10B98118', borderColor: '#10B981', borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.sm, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                          <Ionicons name="sparkles" size={13} color="#10B981" />
                          <Text style={{ fontSize: typography.sizes.micro, color: '#10B981', fontWeight: '700' }}>
                            🟢 Live generiert mit {studioOutput.modelUsed || 'Gemini'}
                          </Text>
                        </View>
                      ) : (
                        <View style={{ backgroundColor: colors.surface, borderColor: colors.borderSubtle, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.sm, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                          <Ionicons name="hardware-chip-outline" size={13} color={colors.textMuted} />
                          <Text style={{ fontSize: typography.sizes.micro, color: colors.textMuted, fontWeight: '600' }}>
                            ⚪ Lokale Synthese (Deterministisch)
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Core Thesis Card */}
                    <View style={[styles.thesisCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle, marginTop: spacing.md }]}>
                      <Text style={[styles.thesisLabel, { color: colors.textMuted }]}>KERNTHESE / ESSENZ</Text>
                      <Text style={[styles.thesisText, { color: colors.textPrimary }]}>
                        {studioOutput.coreThesis}
                      </Text>
                    </View>

                    {/* Insights */}
                    <View style={{ marginTop: spacing.md }}>
                      <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginBottom: 6 }]}>
                        Erkenntnisbausteine ({studioOutput.insights.length}):
                      </Text>
                      {studioOutput.insights.map((insight, idx) => (
                        <View key={idx} style={{ flexDirection: 'row', gap: 8, marginBottom: 6, alignItems: 'flex-start' }}>
                          <Text style={{ color: colors.accent, fontWeight: '700' }}>•</Text>
                          <Text style={{ flex: 1, color: colors.textSecondary, fontSize: typography.sizes.bodySmall, lineHeight: 20 }}>
                            {insight}
                          </Text>
                        </View>
                      ))}
                    </View>

                    {/* Reflection Questions */}
                    <View style={{ marginTop: spacing.md }}>
                      <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginBottom: 6 }]}>
                        Reflexions-Fragen:
                      </Text>
                      {studioOutput.reflectionQuestions.map((q, idx) => (
                        <View key={idx} style={{ flexDirection: 'row', gap: 8, marginBottom: 6, alignItems: 'flex-start' }}>
                          <Text style={{ color: '#F59E0B', fontWeight: '700' }}>?</Text>
                          <Text style={{ flex: 1, color: colors.textSecondary, fontSize: typography.sizes.bodySmall, fontStyle: 'italic', lineHeight: 20 }}>
                            {q}
                          </Text>
                        </View>
                      ))}
                    </View>

                    {/* Practical Impulse */}
                    <View style={[styles.impulseCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle, marginTop: spacing.md }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <Ionicons name="compass-outline" size={16} color="#10B981" />
                        <Text style={[styles.impulseLabel, { color: '#10B981' }]}>PRAKTISCHER IMPULS</Text>
                      </View>
                      <Text style={[styles.impulseText, { color: colors.textPrimary }]}>
                        {studioOutput.practicalImpulse}
                      </Text>
                    </View>
                  </View>
                )}
              </ScrollView>
            )}

            {/* TAB 1: Subchannels */}
            {activeTab === 'channels' && (
              <ScrollView style={styles.tabScroll} contentContainerStyle={styles.tabScrollContent}>
                {/* Channel Creator Box */}
                <View style={[styles.sectionBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
                  <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                    + Neuen Subchannel on the go erstellen
                  </Text>
                  <Text style={[styles.sectionDesc, { color: colors.textMuted }]}>
                    Erstelle beliebig viele thematische Räume nach Reddit-Vorbild. Definiere Handle, Flair und eine sokratische Antithese-Leitfrage.
                  </Text>

                  <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
                    <View style={{ flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' }}>
                      <View style={{ flex: 1, minWidth: 200 }}>
                        <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Titel des Raumes:</Text>
                        <TextInput
                          value={newChannelTitle}
                          onChangeText={setNewChannelTitle}
                          placeholder="z.B. Kognitive Kybernetik oder Quanten-Kosmos"
                          placeholderTextColor={colors.textMuted}
                          style={[styles.textInput, { backgroundColor: colors.surface, borderColor: colors.borderSubtle, color: colors.textPrimary }]}
                        />
                      </View>

                      <View style={{ flex: 1, minWidth: 200 }}>
                        <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Handle (z.B. c/kybernetik):</Text>
                        <TextInput
                          value={newChannelHandle}
                          onChangeText={setNewChannelHandle}
                          placeholder="c/kybernetik"
                          placeholderTextColor={colors.textMuted}
                          style={[styles.textInput, { backgroundColor: colors.surface, borderColor: colors.borderSubtle, color: colors.textPrimary }]}
                        />
                      </View>
                    </View>

                    <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Beschreibung & Fokus-Mission:</Text>
                    <TextInput
                      value={newChannelDesc}
                      onChangeText={setNewChannelDesc}
                      placeholder="Worin besteht die kognitive Vertiefung dieses Channels?"
                      placeholderTextColor={colors.textMuted}
                      style={[styles.textInput, { backgroundColor: colors.surface, borderColor: colors.borderSubtle, color: colors.textPrimary }]}
                    />

                    <View style={{ flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' }}>
                      <View style={{ flex: 1, minWidth: 200 }}>
                        <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Badge Flair:</Text>
                        <TextInput
                          value={newChannelFlair}
                          onChangeText={setNewChannelFlair}
                          placeholder="z.B. ◈ Kybernetik"
                          placeholderTextColor={colors.textMuted}
                          style={[styles.textInput, { backgroundColor: colors.surface, borderColor: colors.borderSubtle, color: colors.textPrimary }]}
                        />
                      </View>

                      <View style={{ flex: 1, minWidth: 200 }}>
                        <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Primäres Wissensgebiet:</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                          {(['philosophy_ethics', 'ai_apple', 'sound_synthesis', 'science_society', 'health_biohacking'] as TopicTag[]).map(t => (
                            <TouchableOpacity
                              key={t}
                              onPress={() => setNewChannelTopic(t)}
                              style={[
                                styles.topicSelectChip,
                                {
                                  backgroundColor: newChannelTopic === t ? colors.accent : colors.surface,
                                  borderColor: colors.borderSubtle
                                }
                              ]}
                            >
                              <Text style={[styles.topicSelectText, { color: newChannelTopic === t ? '#FFFFFF' : colors.textSecondary }]}>
                                {TOPIC_SPACE_MAP[t]?.flair || t}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    </View>

                    <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Kritische Antithese-Leitfrage:</Text>
                    <TextInput
                      value={newChannelPrompt}
                      onChangeText={setNewChannelPrompt}
                      placeholder="Welche Grundannahme dieses Channels muss radikal hinterfragt werden?"
                      placeholderTextColor={colors.textMuted}
                      style={[styles.textInput, { backgroundColor: colors.surface, borderColor: colors.borderSubtle, color: colors.textPrimary }]}
                    />

                    <TouchableOpacity
                      onPress={handleCreateChannel}
                      disabled={isCreatingChannel}
                      style={[styles.primaryActionBtn, { backgroundColor: '#F59E0B', marginTop: spacing.sm }]}
                    >
                      {isCreatingChannel ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <Ionicons name="add-circle" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                          <Text style={styles.primaryActionBtnText}>Subchannel jetzt aktivieren</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Subchannels List */}
                <View style={{ marginTop: spacing.lg }}>
                  <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginBottom: 8 }]}>
                    Verfügbare Subchannels ({spaces.length})
                  </Text>

                  {spaces.map(s => (
                    <View
                      key={s.id}
                      style={[styles.channelCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                        <View style={[styles.channelIconBox, { backgroundColor: s.accentColor + '20' }]}>
                          <Ionicons name={s.icon as any || 'layers-outline'} size={18} color={s.accentColor} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Text style={[styles.channelHandle, { color: s.accentColor }]}>{s.handle}</Text>
                            <View style={[styles.flairBadge, { backgroundColor: s.accentColor + '18' }]}>
                              <Text style={[styles.flairBadgeText, { color: s.accentColor }]}>{s.flair}</Text>
                            </View>
                            {s.isCustom && (
                              <View style={[styles.customBadge, { backgroundColor: '#F59E0B' + '20' }]}>
                                <Text style={styles.customBadgeText}>CUSTOM</Text>
                              </View>
                            )}
                          </View>
                          <Text style={[styles.channelTitle, { color: colors.textPrimary }]}>{s.title}</Text>
                          <Text style={[styles.channelDesc, { color: colors.textMuted }]}>{s.description}</Text>
                          {s.antithesisPrompt && (
                            <Text style={[styles.channelPrompt, { color: colors.textSecondary }]}>
                              ⚖️ Antithese: {s.antithesisPrompt}
                            </Text>
                          )}
                        </View>
                      </View>

                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <TouchableOpacity
                          onPress={() => void handleTogglePin(s.id)}
                          style={[styles.iconActionBtn, { backgroundColor: colors.surface }]}
                        >
                          <Ionicons name={s.pinned ? 'pin' : 'pin-outline'} size={16} color={s.pinned ? '#F59E0B' : colors.textMuted} />
                        </TouchableOpacity>

                        {s.isCustom && (
                          <TouchableOpacity
                            onPress={() => void handleDeleteChannel(s.id, s.handle)}
                            style={[styles.iconActionBtn, { backgroundColor: colors.surface }]}
                          >
                            <Ionicons name="trash-outline" size={16} color="#EF4444" />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              </ScrollView>
            )}

            {/* TAB 2: Trend Radar & Dialektik */}
            {activeTab === 'trends' && (
              <ScrollView style={styles.tabScroll} contentContainerStyle={styles.tabScrollContent}>
                <View style={[styles.sectionBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
                  <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                    ⚡ Hegelscher Trend-Radar & Dialektik-Filter
                  </Text>
                  <Text style={[styles.sectionDesc, { color: colors.textMuted }]}>
                    Erfasst akute Trends und zerlegt sie in These (Hype), Antithese (kritische Grenze) und Synthese (Erkenntnis).
                  </Text>
                </View>

                {trends.map(t => (
                  <View key={t.id} style={[styles.trendCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <Text style={[styles.trendDomain, { color: colors.accent }]}>{t.sourceDomain} • {t.targetSpace}</Text>
                      <View style={[styles.tierBadge, { backgroundColor: '#10B981' + '18' }]}>
                        <Text style={[styles.tierBadgeText, { color: '#10B981' }]}>{t.evidenceTier}</Text>
                      </View>
                    </View>

                    <Text style={[styles.trendHeadline, { color: colors.textPrimary }]}>{t.trendTopic}</Text>

                    <View style={[styles.dialecticBlock, { backgroundColor: colors.surfaceSecondary }]}>
                      <Text style={[styles.dialecticLabel, { color: colors.accent }]}>📌 THESE (Der Hype):</Text>
                      <Text style={[styles.dialecticBody, { color: colors.textSecondary }]}>{t.thesis}</Text>

                      <Text style={[styles.dialecticLabel, { color: '#EF4444', marginTop: 8 }]}>⚖️ ANTITHESE (Kritische Gegenperspektive):</Text>
                      <Text style={[styles.dialecticBody, { color: colors.textSecondary }]}>{t.antithesis}</Text>

                      <Text style={[styles.dialecticLabel, { color: '#10B981', marginTop: 8 }]}>💡 SYNTHESE (Erkenntnisgewinn):</Text>
                      <Text style={[styles.dialecticBody, { color: colors.textPrimary, fontWeight: '600' }]}>{t.synthesis}</Text>
                    </View>

                    <TouchableOpacity
                      onPress={() => void handleAdoptTrend(t)}
                      style={[styles.primaryActionBtn, { backgroundColor: colors.accent, marginTop: spacing.md }]}
                    >
                      <Ionicons name="sparkles-outline" size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
                      <Text style={styles.primaryActionBtnText}>Als vertieften Artikel in Feed übernehmen</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}

            {/* TAB 3: Daily Generation & Daemon */}
            {activeTab === 'daily' && (
              <ScrollView style={styles.tabScroll} contentContainerStyle={styles.tabScrollContent}>
                <View style={styles.metricsGrid}>
                  <View style={[styles.metricCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
                    <Text style={[styles.metricValue, { color: '#10B981' }]}>AKTIV</Text>
                    <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Autonomer Daemon</Text>
                    <Text style={[styles.metricSub, { color: colors.textMuted }]}>Läuft lokal & unbegrenzt</Text>
                  </View>

                  <View style={[styles.metricCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
                    <Text style={[styles.metricValue, { color: colors.accent }]}>
                      {dailyStatus?.totalDailyItems || 12}
                    </Text>
                    <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Heutige Artikel</Text>
                    <Text style={[styles.metricSub, { color: colors.textMuted }]}>{dailyStatus?.lastGeneratedDate || 'Heute'}</Text>
                  </View>

                  <View style={[styles.metricCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
                    <Text style={[styles.metricValue, { color: '#F59E0B' }]}>00:00 Uhr</Text>
                    <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Nächster Zyklus</Text>
                    <Text style={[styles.metricSub, { color: colors.textMuted }]}>Mitternachts-Automatisierung</Text>
                  </View>
                </View>

                {/* Daily Action Box */}
                <View style={[styles.sectionBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle, marginTop: spacing.md }]}>
                  <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                    Manuelle Sofort-Generierung
                  </Text>
                  <Text style={[styles.sectionDesc, { color: colors.textMuted }]}>
                    Erzeugt auf Knopfdruck eine neue, ranggeordnete Tagesausgabe. Führt RSS-Rohdaten, Trend-Antithesen und Raindrop-Lesezeichen zusammen.
                  </Text>

                  <TouchableOpacity
                    onPress={handleTriggerDaily}
                    disabled={isGeneratingDaily}
                    style={[styles.primaryActionBtn, { backgroundColor: '#10B981', marginTop: spacing.md }]}
                  >
                    {isGeneratingDaily ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="refresh" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                        <Text style={styles.primaryActionBtnText}>⚡ Neue Tagesausgabe jetzt sofort generieren</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>

                {/* Permanent Autonomy Principles */}
                <View style={[styles.sectionBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle, marginTop: spacing.md }]}>
                  <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                    Wie Atem „für immer“ autonom funktioniert:
                  </Text>
                  <Text style={[styles.privacyText, { color: colors.textSecondary }]}>
                    1. <Text style={{ fontWeight: '700' }}>Lokaler Hintergrund-Daemon (`npm run daemon`):</Text> Läuft auf deinem Mac und synchronisiert alle 6 Stunden RSS-Feeds in die lokale SQLite/JSON-Datenbank.
                  </Text>
                  <Text style={[styles.privacyText, { color: colors.textSecondary }]}>
                    2. <Text style={{ fontWeight: '700' }}>In-App Client-Generator:</Text> Selbst ohne Terminal-Daemon erkennt Atem beim Öffnen im Browser einen Datumswechsel und stellt eine frische Ausgabe bereit.
                  </Text>
                  <Text style={[styles.privacyText, { color: colors.textSecondary }]}>
                    3. <Text style={{ fontWeight: '700' }}>Zero Cloud Lock-in:</Text> Funktioniert offline-first ohne externe Abo-Dienste.
                  </Text>
                </View>
              </ScrollView>
            )}

            {/* TAB 4: Recursive Learning */}
            {activeTab === 'learning' && (
              <ScrollView style={styles.tabScroll} contentContainerStyle={styles.tabScrollContent}>
                <View style={[styles.sectionBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
                  <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                    🧠 Rekursive Lern-Matrix & Kognitives Benutzer-Profil
                  </Text>
                  <Text style={[styles.sectionDesc, { color: colors.textMuted }]}>
                    Atem passt die Gewichtung von Themen und Herausgebern bei jedem Lese-Event, Upvote, Notiz und Raindrop-Tag an.
                  </Text>
                </View>

                {/* Topic Weights Bars */}
                <View style={[styles.sectionBox, { backgroundColor: colors.surface, borderColor: colors.borderSubtle, marginTop: spacing.md }]}>
                  <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginBottom: 12 }]}>
                    Aktuell gelernte Themen-Affinitäten:
                  </Text>
                  {Object.entries(profile.explicitInterests).map(([topic, weight]) => {
                    const pct = Math.round((weight as number) * 100);
                    const meta = TOPIC_SPACE_MAP[topic as TopicTag];
                    return (
                      <View key={topic} style={{ marginBottom: 10 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
                          <Text style={[styles.topicBarLabel, { color: colors.textPrimary }]}>
                            {meta?.flair || topic}
                          </Text>
                          <Text style={[styles.topicBarValue, { color: colors.accent }]}>{pct}%</Text>
                        </View>
                        <View style={[styles.barTrack, { backgroundColor: colors.surfaceSecondary }]}>
                          <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: colors.accent }]} />
                        </View>
                      </View>
                    );
                  })}
                </View>

                {/* Domain Trust Multipliers */}
                {learningState && (
                  <View style={[styles.sectionBox, { backgroundColor: colors.surface, borderColor: colors.borderSubtle, marginTop: spacing.md }]}>
                    <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginBottom: 8 }]}>
                      Gelehrte Quellen-Reputation (Vertrauens-Multiplikatoren):
                    </Text>
                    {Object.entries(learningState.domainTrustScores).map(([dom, trust]) => (
                      <View key={dom} style={styles.domainTrustRow}>
                        <Text style={[styles.domainTrustDomain, { color: colors.textPrimary }]}>{dom}</Text>
                        <Text style={[styles.domainTrustScore, { color: trust >= 1.2 ? '#10B981' : colors.textMuted }]}>
                          {trust.toFixed(2)}x
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </ScrollView>
            )}

            {/* TAB 5: Archive & Library */}
            {activeTab === 'archive' && (
              <ScrollView style={styles.tabScroll} contentContainerStyle={styles.tabScrollContent}>
                <View style={[styles.sectionBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
                  <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                    📚 Wissens-Archiv & Dauer-Bibliothek
                  </Text>
                  <Text style={[styles.sectionDesc, { color: colors.textMuted }]}>
                    Alle historischen Tagesausgaben und Tiefenbohrungen dauerhaft archiviert und durchsuchbar.
                  </Text>
                </View>

                {/* Foundational Knowledge Canon Card */}
                {canon && (
                  <View style={[styles.sectionBox, { backgroundColor: colors.surface, borderColor: colors.borderSubtle, marginTop: spacing.md }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={{ fontSize: 16 }}>🏛️</Text>
                        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                          {canon.name}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        <TouchableOpacity
                          onPress={handleExportCanonMarkdown}
                          style={[styles.secondaryActionBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}
                        >
                          <Ionicons name="document-text-outline" size={13} color={colors.accent} style={{ marginRight: 4 }} />
                          <Text style={[styles.secondaryActionBtnText, { color: colors.accent, fontSize: typography.sizes.micro }]}>MD</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={handleExportCanonJson}
                          style={[styles.secondaryActionBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}
                        >
                          <Ionicons name="code-download-outline" size={13} color={colors.accent} style={{ marginRight: 4 }} />
                          <Text style={[styles.secondaryActionBtnText, { color: colors.accent, fontSize: typography.sizes.micro }]}>JSON</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    <Text style={[styles.sectionDesc, { color: colors.textSecondary, marginBottom: spacing.sm }]}>
                      {canon.description}
                    </Text>

                    <Text style={{ fontSize: typography.sizes.micro, color: colors.textMuted, marginBottom: spacing.sm }}>
                      Herkunft: {canon.provenance} • Stand: {canon.savedAt.slice(0, 10)} • {canon.totalBookmarks} Lesezeichen
                    </Text>

                    {/* Bookmarks Summary */}
                    <View style={{ gap: 6, marginTop: 4 }}>
                      {canon.bookmarks.map(b => (
                        <View key={b._id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle }}>
                          <Text style={{ fontSize: typography.sizes.caption, color: colors.textPrimary, flex: 1, marginRight: 8 }} numberOfLines={1}>
                            {b.title}
                          </Text>
                          <Text style={{ fontSize: typography.sizes.micro, color: colors.accent }}>
                            {b.domain}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Editions History */}
                <View style={{ marginTop: spacing.md }}>
                  <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginBottom: 8 }]}>
                    Archivierte Ausgaben ({archivedEditions.length})
                  </Text>

                  <TextInput
                    value={archiveSearchTerm}
                    onChangeText={setArchiveSearchTerm}
                    placeholder="Archiv durchsuchen (z.B. Datum oder Titel)..."
                    placeholderTextColor={colors.textMuted}
                    style={[styles.textInput, { backgroundColor: colors.surface, borderColor: colors.borderSubtle, color: colors.textPrimary, marginBottom: spacing.md }]}
                  />

                  {archivedEditions
                    .filter(ed => !archiveSearchTerm.trim() || ed.date.includes(archiveSearchTerm) || ed.leadArticleTitle.toLowerCase().includes(archiveSearchTerm.toLowerCase()))
                    .map(ed => (
                    <View
                      key={ed.date}
                      style={[styles.archiveEditionCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
                    >
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                          <Text style={[styles.archiveDate, { color: colors.accent }]}>{ed.date}</Text>
                          <Text style={[styles.archiveCount, { color: colors.textMuted }]}>• {ed.itemCount} Artikel</Text>
                        </View>
                        <Text style={[styles.archiveLeadTitle, { color: colors.textPrimary }]}>
                          {ed.leadArticleTitle}
                        </Text>
                      </View>

                      <TouchableOpacity
                        onPress={() => handleExportArchiveMarkdown(ed)}
                        style={[styles.secondaryActionBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}
                      >
                        <Ionicons name="download-outline" size={14} color={colors.accent} style={{ marginRight: 4 }} />
                        <Text style={[styles.secondaryActionBtnText, { color: colors.accent }]}>Als Craft-MD exportieren</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </ScrollView>
            )}

            {/* TAB 6: Mobile QR Code */}
            {activeTab === 'mobile' && (
              <ScrollView style={styles.tabScroll} contentContainerStyle={styles.tabScrollContent}>
                <View style={[styles.qrHeroBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
                  {qrDataUrl ? (
                    <View style={styles.qrWrapper}>
                      <Image source={{ uri: qrDataUrl }} style={styles.qrImage} resizeMode="contain" />
                    </View>
                  ) : (
                    <View style={[styles.qrPlaceholder, { backgroundColor: colors.surface }]}>
                      <ActivityIndicator size="large" color={colors.accent} />
                    </View>
                  )}

                  <View style={styles.urlBox}>
                    <Text style={[styles.urlLabel, { color: colors.textMuted }]}>Lokale Netzwerk-Adresse:</Text>
                    <Text style={[styles.urlValue, { color: colors.accent }]}>{accessUrl}</Text>
                    <TouchableOpacity
                      onPress={handleCopyLink}
                      style={[styles.copyPill, { backgroundColor: copiedLink ? '#10B981' : colors.accent }]}
                    >
                      <Ionicons name={copiedLink ? 'checkmark' : 'copy-outline'} size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                      <Text style={styles.copyPillText}>{copiedLink ? 'Kopiert!' : 'Link kopieren'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* 3 Step Instructions */}
                <View style={[styles.sectionBox, { backgroundColor: colors.surface, borderColor: colors.borderSubtle, marginTop: spacing.md }]}>
                  <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                    Als vollwertige Vollbild-App auf deinem Smartphone:
                  </Text>
                  <Text style={[styles.stepDesc, { color: colors.textSecondary, marginTop: 8 }]}>
                    1. <Text style={{ fontWeight: '700' }}>Im selben WLAN sein:</Text> Smartphone mit dem Heim-WLAN verbinden.{'\n'}
                    2. <Text style={{ fontWeight: '700' }}>QR-Code mit Kamera scannen:</Text> Adresse im Safari oder Chrome öffnen.{'\n'}
                    3. <Text style={{ fontWeight: '700' }}>„Zum Home-Bildschirm“ antippen:</Text> Schon hast du Atem als native App ohne App Store direkt auf deinem Phone.
                  </Text>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md
  },
  card: {
    width: '100%',
    maxWidth: 880,
    height: '92%',
    maxHeight: 820,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1
  },
  iconEmblem: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center'
  },
  headerTitle: {
    fontSize: typography.sizes.body,
    fontWeight: '800'
  },
  headerSubtitle: {
    fontSize: typography.sizes.micro,
    marginTop: 1
  },
  ultraPill: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.pill
  },
  ultraPillText: {
    color: '#000000',
    fontSize: 9,
    fontWeight: '900'
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    justifyContent: 'center',
    alignItems: 'center'
  },
  toast: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    zIndex: 9999,
    paddingHorizontal: spacing.lg,
    paddingVertical: 8,
    borderRadius: radius.pill,
    boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
  },
  toastText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: typography.sizes.caption
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    overflow: 'scroll'
  },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent'
  },
  tabItemText: {
    fontSize: typography.sizes.caption,
    fontWeight: '700'
  },
  contentContainer: {
    flex: 1
  },
  tabScroll: {
    flex: 1
  },
  tabScrollContent: {
    padding: spacing.lg,
    gap: spacing.md
  },
  sectionBox: {
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 0.5
  },
  sectionTitle: {
    fontSize: typography.sizes.bodySmall,
    fontWeight: '800',
    marginBottom: 2
  },
  sectionDesc: {
    fontSize: typography.sizes.caption,
    lineHeight: 18
  },
  inputLabel: {
    fontSize: typography.sizes.micro,
    fontWeight: '700',
    marginBottom: 4
  },
  textInput: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm,
    borderWidth: 0.5,
    fontSize: typography.sizes.bodySmall
  },
  topicSelectChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 0.5
  },
  topicSelectText: {
    fontSize: typography.sizes.micro,
    fontWeight: '700'
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill
  },
  primaryActionBtnText: {
    color: '#FFFFFF',
    fontSize: typography.sizes.caption,
    fontWeight: '700'
  },
  secondaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 0.5
  },
  secondaryActionBtnText: {
    fontSize: typography.sizes.micro,
    fontWeight: '700'
  },
  channelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 0.5,
    marginBottom: spacing.sm
  },
  channelIconBox: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center'
  },
  channelHandle: {
    fontSize: typography.sizes.caption,
    fontWeight: '800'
  },
  channelTitle: {
    fontSize: typography.sizes.bodySmall,
    fontWeight: '700',
    marginTop: 1
  },
  channelDesc: {
    fontSize: typography.sizes.micro,
    lineHeight: 16
  },
  channelPrompt: {
    fontSize: typography.sizes.micro,
    fontStyle: 'italic',
    marginTop: 2
  },
  flairBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.sm
  },
  flairBadgeText: {
    fontSize: 9,
    fontWeight: '800'
  },
  customBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: radius.sm
  },
  customBadgeText: {
    color: '#F59E0B',
    fontSize: 8,
    fontWeight: '900'
  },
  iconActionBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    justifyContent: 'center',
    alignItems: 'center'
  },
  trendCard: {
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 0.5,
    marginBottom: spacing.md
  },
  trendDomain: {
    fontSize: typography.sizes.micro,
    fontWeight: '800',
    textTransform: 'uppercase'
  },
  tierBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill
  },
  tierBadgeText: {
    fontSize: 9,
    fontWeight: '800'
  },
  trendHeadline: {
    fontSize: typography.sizes.body,
    fontWeight: '800',
    marginBottom: spacing.sm
  },
  dialecticBlock: {
    padding: spacing.md,
    borderRadius: radius.sm,
    gap: 4
  },
  dialecticLabel: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  dialecticBody: {
    fontSize: typography.sizes.caption,
    lineHeight: 19
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: spacing.sm
  },
  metricCard: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 0.5,
    alignItems: 'center'
  },
  metricValue: {
    fontSize: typography.sizes.title1,
    fontWeight: '900',
    marginBottom: 2
  },
  metricLabel: {
    fontSize: typography.sizes.caption,
    fontWeight: '700',
    textAlign: 'center'
  },
  metricSub: {
    fontSize: typography.sizes.micro,
    textAlign: 'center',
    marginTop: 2
  },
  privacyText: {
    fontSize: typography.sizes.caption,
    lineHeight: 20,
    marginTop: 6
  },
  topicBarLabel: {
    fontSize: typography.sizes.caption,
    fontWeight: '600'
  },
  topicBarValue: {
    fontSize: typography.sizes.caption,
    fontWeight: '800'
  },
  barTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden'
  },
  barFill: {
    height: '100%',
    borderRadius: 3
  },
  domainTrustRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(128,128,128,0.1)'
  },
  domainTrustDomain: {
    fontSize: typography.sizes.bodySmall,
    fontWeight: '600'
  },
  domainTrustScore: {
    fontSize: typography.sizes.bodySmall,
    fontWeight: '800'
  },
  archiveEditionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 0.5,
    marginBottom: spacing.sm,
    gap: spacing.md
  },
  archiveDate: {
    fontSize: typography.sizes.caption,
    fontWeight: '800'
  },
  archiveCount: {
    fontSize: typography.sizes.micro
  },
  archiveLeadTitle: {
    fontSize: typography.sizes.bodySmall,
    fontWeight: '700'
  },
  qrHeroBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.lg,
    flexWrap: 'wrap'
  },
  qrWrapper: {
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: radius.md
  },
  qrImage: {
    width: 160,
    height: 160
  },
  qrPlaceholder: {
    width: 160,
    height: 160,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center'
  },
  urlBox: {
    flex: 1,
    minWidth: 200
  },
  urlLabel: {
    fontSize: typography.sizes.micro,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4
  },
  urlValue: {
    fontSize: typography.sizes.body,
    fontWeight: '800',
    marginBottom: spacing.md
  },
  copyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill
  },
  copyPillText: {
    color: '#FFFFFF',
    fontSize: typography.sizes.caption,
    fontWeight: '700'
  },
  stepDesc: {
    fontSize: typography.sizes.caption,
    lineHeight: 20
  },
  lensCard: {
    flex: 1,
    minWidth: 160,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5
  },
  lensTitle: {
    fontSize: typography.sizes.bodySmall,
    fontWeight: '700'
  },
  lensDesc: {
    fontSize: typography.sizes.micro,
    lineHeight: 16
  },
  thesisCard: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1
  },
  thesisLabel: {
    fontSize: typography.sizes.micro,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 4
  },
  thesisText: {
    fontSize: typography.sizes.body,
    fontWeight: '600',
    lineHeight: 22
  },
  impulseCard: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1
  },
  impulseLabel: {
    fontSize: typography.sizes.micro,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  impulseText: {
    fontSize: typography.sizes.bodySmall,
    lineHeight: 20
  }
});
