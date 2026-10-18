import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  TextInput,
  Modal,
  ActivityIndicator,
  ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../core/context/AppContext';
import { typography, radius, spacing, PALETTE_METADATA, ThemePalette } from '../theme';
import { generateCraftMarkdown, copyToClipboard, downloadMarkdownFile } from '../../core/export/craftExport';
import { TopicTag, TOPIC_SPACE_MAP } from '../../core/domain/types';
import { defaultSourceRepository } from '../../core/data/sourceRepository';
import {
  loadAiCredentials,
  saveAiCredentials,
  testAiConnection,
  AiCredentials,
  AiProvider,
  DEFAULT_GEMINI_MODEL,
  DEFAULT_OPENROUTER_MODEL,
  OPENROUTER_MODEL_PRESETS
} from '../../core/ai/atmenAiClient';
import { GeminiModelSelector } from './GeminiModelSelector';
import { AtmenSymbol } from './AtmenSymbol';
import { NewsHubModal } from './NewsHubModal';
import { UltraMasterModal } from './UltraMasterModal';
import { MobilePublishModal } from './MobilePublishModal';
import { AtmenBreathingPortal } from '../../features/breathing/AtmenBreathingPortal';
import { HivemindStreamModal } from './HivemindStreamModal';

interface DesktopRedditHeaderProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  activeSpaceName?: string;
  selectedFilter?: TopicTag | 'all' | string;
  onSelectSpace?: (space: TopicTag | 'all' | string) => void;
}

export const DesktopRedditHeader: React.FC<DesktopRedditHeaderProps> = ({
  searchQuery,
  onSearchChange,
  activeSpaceName = 'Alle Spaces',
  selectedFilter = 'all',
  onSelectSpace
}) => {
  const {
    colors,
    isDark,
    palette,
    setThemePreference,
    setPalettePreference,
    activeTab,
    setActiveTab,
    activeFeedOption,
    setActiveFeedOption,
    goHome,
    selectedArticleId,
    savedArticles,
    interactions,
    refreshFeed,
    shuffleFeed,
    simulateDailyGeneration,
    activeDateSeed
  } = useApp();

  // Modals state
  const [showKarmaModal, setShowKarmaModal] = useState<boolean>(false);
  const [showAIModal, setShowAIModal] = useState<boolean>(false);
  const [showDevSimModal, setShowDevSimModal] = useState<boolean>(false);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [showPaletteModal, setShowPaletteModal] = useState<boolean>(false);
  const [showSpaceModal, setShowSpaceModal] = useState<boolean>(false);
  const [showNewsHubModal, setShowNewsHubModal] = useState<boolean>(false);
  const [showUltraMasterModal, setShowUltraMasterModal] = useState<boolean>(false);
  const [showMobilePublishModal, setShowMobilePublishModal] = useState<boolean>(false);
  const [showBreathingPortal, setShowBreathingPortal] = useState<boolean>(false);
  const [showHivemindModal, setShowHivemindModal] = useState<boolean>(false);
  const [bannerNotice, setBannerNotice] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // AI Hub State - Strictly synced with loadAiCredentials & saveAiCredentials (@atem:ai_credentials:v1)
  const [aiCreds, setAiCreds] = useState<AiCredentials>({
    provider: 'gemini',
    apiKey: '',
    model: DEFAULT_GEMINI_MODEL
  });
  const [showApiKey, setShowApiKey] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [isTestingAI, setIsTestingAI] = useState<boolean>(false);

  useEffect(() => {
    if (showAIModal) {
      void (async () => {
        const creds = await loadAiCredentials();
        setAiCreds({ ...creds, persistApiKey: true });
      })();
    }
  }, [showAIModal]);

  const healthOverview = defaultSourceRepository.getHealthOverview();

  // Calculate dynamic Erkenntnis-Karma:
  const userNotesCount = Object.values(interactions).reduce(
    (acc, curr) => acc + (curr.userNotes?.length || 0),
    0
  );
  const savedCount = Object.values(interactions).filter(i => i.saved).length;
  const upvotesCount = Object.values(interactions).filter(i => i.voteScore === 1).length;
  const karmaScore = 42 + (userNotesCount * 10) + (savedCount * 5) + (upvotesCount * 2);

  const showToast = (msg: string) => {
    setBannerNotice(msg);
    setTimeout(() => setBannerNotice(null), 3500);
  };

  const handleCopyCraft = async () => {
    const md = generateCraftMarkdown(savedArticles, interactions);
    const ok = await copyToClipboard(md);
    if (ok) {
      showToast('✓ Als Craft-Markdown in die Zwischenablage kopiert!');
    } else {
      showToast('Kopieren fehlgeschlagen.');
    }
  };

  const handleDownloadCraft = () => {
    const md = generateCraftMarkdown(savedArticles, interactions);
    const ok = downloadMarkdownFile(`atem-archiv-${new Date().toISOString().slice(0, 10)}.md`, md);
    if (ok) {
      showToast('✓ Download gestartet (.md)!');
    }
  };

  const handleToggleTheme = () => {
    setThemePreference(isDark ? 'light' : 'dark');
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshFeed();
      showToast(`✓ Inhaltspool aus ${healthOverview.deliveringSources} aktiven Quellen aktualisiert`);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSwitchAIProvider = async (provider: AiProvider) => {
    const defaultModel = provider === 'openrouter' ? DEFAULT_OPENROUTER_MODEL : DEFAULT_GEMINI_MODEL;
    const next: AiCredentials = {
      ...aiCreds,
      provider,
      model: defaultModel
    };
    setAiCreds(next);
    await saveAiCredentials(next);
    setTestResult(null);
  };

  const handleSaveAISettings = async () => {
    await saveAiCredentials(aiCreds);
    showToast('✓ KI-Konfiguration dauerhaft gesichert');
  };

  const handleTestAI = async () => {
    setIsTestingAI(true);
    setTestResult(null);
    try {
      const trimmed = aiCreds.apiKey?.trim() ?? '';
      const toTest = { ...aiCreds, apiKey: trimmed, persistApiKey: true };
      setAiCreds(toTest);
      await saveAiCredentials(toTest);
      const res = await testAiConnection(toTest);
      setTestResult(res);
      showToast(res.ok ? '✓ Verbindung erfolgreich' : 'Verbindungsfehler');
    } finally {
      setIsTestingAI(false);
    }
  };

  const handleSimulateDay = async (daysOffset: number = 0, targetDate?: string) => {
    setIsSimulating(true);
    try {
      const res = await simulateDailyGeneration(daysOffset, targetDate);
      showToast(`✓ Neue Tagesausgabe generiert für ${res.simulatedDate} (${res.itemCount} kuratierte Artikel)!`);
      setShowDevSimModal(false);
    } catch (e: any) {
      showToast(`Fehler bei Simulation: ${e?.message || 'Unbekannt'}`);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleShuffle = async () => {
    setIsSimulating(true);
    try {
      await shuffleFeed();
      showToast('✓ Frischer Wind: Ausgabe neu rotiert!');
      setShowDevSimModal(false);
    } catch (e: any) {
      showToast(`Fehler beim Mischen: ${e?.message || 'Unbekannt'}`);
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <>
      <View style={[styles.headerContainer, { backgroundColor: colors.surface, borderBottomColor: colors.borderSubtle }]}>
        <View style={styles.headerInner}>
          {/* Left: Brand + Reddit Space Selector */}
          <View style={styles.leftSection}>
            {/* 1. Brand: Always returns to Home Center */}
            <TouchableOpacity
              onPress={() => {
                goHome();
                if (onSelectSpace) onSelectSpace('all');
              }}
              activeOpacity={0.7}
              style={styles.brandRow}
              accessibilityRole="button"
              accessibilityLabel="Zurück zur Home Startseite"
            >
              {/* atmen Blue Chevron Arch Emblem */}
              <AtmenSymbol size={28} isDark={isDark} style={{ marginRight: 8 }} />
              <Text style={[styles.brandText, { color: colors.textPrimary }]}>
                Atmen
              </Text>
            </TouchableOpacity>

            {/* 2. Center of App: Dedicated Home Pill */}
            <TouchableOpacity
              onPress={() => {
                goHome();
                if (onSelectSpace) onSelectSpace('all');
              }}
              style={[
                styles.homeCenterPill,
                {
                  backgroundColor: activeTab === 'feed' && !selectedArticleId ? colors.accent : colors.surfaceSecondary,
                  borderColor: activeTab === 'feed' && !selectedArticleId ? colors.accent : colors.borderSubtle
                }
              ]}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Home Menü und Feed öffnen"
            >
              <Ionicons
                name={activeTab === 'feed' && !selectedArticleId ? 'home' : 'home-outline'}
                size={14}
                color={activeTab === 'feed' && !selectedArticleId ? '#FFFFFF' : colors.textPrimary}
                style={{ marginRight: 5 }}
              />
              <Text
                style={[
                  styles.homeCenterPillText,
                  { color: activeTab === 'feed' && !selectedArticleId && activeFeedOption !== 'live_news' ? '#FFFFFF' : colors.textPrimary }
                ]}
              >
                Home
              </Text>
            </TouchableOpacity>

            {/* Direct 1-Click News Entry */}
            <TouchableOpacity
              onPress={() => {
                setActiveTab('feed');
                setActiveFeedOption('live_news');
                if (onSelectSpace) onSelectSpace('all');
              }}
              style={[
                styles.homeCenterPill,
                {
                  backgroundColor: activeTab === 'feed' && !selectedArticleId && activeFeedOption === 'live_news' ? colors.accent : colors.surfaceSecondary,
                  borderColor: activeTab === 'feed' && !selectedArticleId && activeFeedOption === 'live_news' ? colors.accent : colors.borderSubtle
                }
              ]}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Echtzeit-Nachrichten öffnen"
            >
              <Ionicons
                name="flash"
                size={14}
                color={activeTab === 'feed' && !selectedArticleId && activeFeedOption === 'live_news' ? '#FFFFFF' : '#F59E0B'}
                style={{ marginRight: 5 }}
              />
              <Text
                style={[
                  styles.homeCenterPillText,
                  { color: activeTab === 'feed' && !selectedArticleId && activeFeedOption === 'live_news' ? '#FFFFFF' : colors.textPrimary }
                ]}
              >
                News
              </Text>
            </TouchableOpacity>

            {/* Space Dropdown Selector Button */}
            <TouchableOpacity
              onPress={() => setShowSpaceModal(true)}
              style={[styles.spaceDropdown, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Space wechseln: ${activeSpaceName}`}
            >
              <Ionicons name="planet-outline" size={14} color={colors.accent} style={{ marginRight: 6 }} />
              <Text style={[styles.spaceDropdownText, { color: colors.textPrimary }]} numberOfLines={1}>
                {activeSpaceName}
              </Text>
              <Ionicons name="chevron-down" size={13} color={colors.textMuted} style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          </View>

          {/* Center: Reddit-style Rounded Search Bar */}
          <View style={styles.centerSection}>
            <View style={[styles.searchBar, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
              <Ionicons name="search" size={15} color={colors.textMuted} style={{ marginRight: 8 }} />
              <TextInput
                value={searchQuery}
                onChangeText={onSearchChange}
                placeholder="Atmen durchsuchen (Thesen, Didaktik, Quellen)…"
                placeholderTextColor={colors.textMuted}
                style={[styles.searchInput, { color: colors.textPrimary }]}
                autoCapitalize="none"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => onSearchChange('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Right: Clean Reddit-style Action Cluster (Quellen Status, Frischer Wind, Studio, Theme & Nav Tabs) */}
          <View style={styles.rightSection}>
            {/* 1. Active Sources Pill -> Opens Quellen- und Themenverwaltung */}
            <TouchableOpacity
              onPress={() => setShowNewsHubModal(true)}
              style={[styles.liveStatusPill, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}
              accessibilityRole="button"
              accessibilityLabel="Quellen- und Themenverwaltung öffnen"
            >
              <View style={styles.liveGreenDot} />
              <Text style={[styles.liveStatusText, { color: colors.textPrimary }]}>
                Quellen & Themen ({healthOverview.deliveringSources}/{healthOverview.totalSources})
              </Text>
            </TouchableOpacity>

            {/* 2. Instant Shuffle / Frischer Wind Button */}
            <TouchableOpacity
              onPress={handleShuffle}
              disabled={isSimulating || isRefreshing}
              style={[styles.newsHubBadge, { backgroundColor: colors.accentSubtle, borderColor: colors.accent }]}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Frischer Wind: Feed neu mischen"
            >
              {isSimulating || isRefreshing ? (
                <ActivityIndicator size="small" color={colors.accent} style={{ marginRight: 4 }} />
              ) : (
                <Ionicons name="shuffle-outline" size={14} color={colors.accent} style={{ marginRight: 4 }} />
              )}
              <Text style={[styles.newsHubText, { color: colors.accent, fontWeight: '700' }]}>
                Frischer Wind
              </Text>
            </TouchableOpacity>

            {/* 3. Atmen Breathing Portal Pill */}
            <TouchableOpacity
              onPress={() => setShowBreathingPortal(true)}
              style={[styles.breathingPill, { backgroundColor: 'rgba(16, 185, 129, 0.12)', borderColor: '#10B981' }]}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Atmen Portal öffnen"
            >
              <Ionicons name="leaf-outline" size={14} color="#10B981" style={{ marginRight: 4 }} />
              <Text style={[styles.breathingPillText, { color: '#10B981', fontWeight: '700' }]}>
                Atmen
              </Text>
            </TouchableOpacity>

            {/* 4. Hivemind-Stream Trigger */}
            <TouchableOpacity
              onPress={() => setShowHivemindModal(true)}
              style={[styles.hivemindBadge, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Hivemind Stream generieren"
            >
              <Ionicons name="git-network-outline" size={13} color={colors.accent} style={{ marginRight: 4 }} />
              <Text style={[styles.hivemindBadgeText, { color: colors.textPrimary, fontWeight: '600' }]}>
                + Hivemind-Stream
              </Text>
            </TouchableOpacity>

            {/* 3. Studio & Tools Hub Button (consolidates Kurator, Master Studio, KI, Mobile QR & Karma) */}
            <TouchableOpacity
              onPress={() => setShowDevSimModal(true)}
              style={[styles.devSimBadge, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Studio, Kurator und Werkzeuge öffnen"
            >
              <Ionicons name="sparkles-outline" size={13} color={colors.accent} style={{ marginRight: 4 }} />
              <Text style={[styles.devSimBadgeText, { color: colors.textPrimary }]}>
                Studio & Tools
              </Text>
            </TouchableOpacity>

            {/* 4. Compact Aesthetics Cluster: Palette & Theme Toggle */}
            <View style={[styles.toolCluster, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
              <TouchableOpacity
                onPress={() => setShowPaletteModal(true)}
                style={styles.toolClusterBtn}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Farbpalette wählen"
              >
                <Ionicons name="color-palette-outline" size={15} color={colors.accent} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleToggleTheme}
                style={styles.toolClusterBtn}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={isDark ? 'Helles Design' : 'Dunkles Design'}
              >
                <Ionicons name={isDark ? 'sunny-outline' : 'moon-outline'} size={15} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* 5. Primary Tab Switcher */}
            <View style={[styles.tabGroup, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
              <TouchableOpacity
                onPress={() => setActiveTab('feed')}
                style={[styles.tabBtn, activeTab === 'feed' && { backgroundColor: colors.surface }]}
                accessibilityRole="button"
                accessibilityLabel="Ausgabe öffnen"
              >
                <Ionicons
                  name="newspaper-outline"
                  size={15}
                  color={activeTab === 'feed' ? colors.accent : colors.textMuted}
                />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setActiveTab('library')}
                style={[styles.tabBtn, activeTab === 'library' && { backgroundColor: colors.surface }]}
                accessibilityRole="button"
                accessibilityLabel="Bibliothek öffnen"
              >
                <Ionicons
                  name="bookmarks-outline"
                  size={15}
                  color={activeTab === 'library' ? colors.accent : colors.textMuted}
                />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setActiveTab('network')}
                style={[styles.tabBtn, activeTab === 'network' && { backgroundColor: colors.surface }]}
                accessibilityRole="button"
                accessibilityLabel="Netzwerk & Hyperspace öffnen"
              >
                <Ionicons
                  name="planet-outline"
                  size={15}
                  color={activeTab === 'network' ? colors.accent : colors.textMuted}
                />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setActiveTab('settings')}
                style={[styles.tabBtn, activeTab === 'settings' && { backgroundColor: colors.surface }]}
                accessibilityRole="button"
                accessibilityLabel="Steuerung öffnen"
              >
                <Ionicons
                  name="options-outline"
                  size={15}
                  color={activeTab === 'settings' ? colors.accent : colors.textMuted}
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>

      {/* Floating Toast Notification */}
      {bannerNotice && (
        <View style={[styles.toastContainer, { backgroundColor: colors.accent }]}>
          <Text style={styles.toastText}>{bannerNotice}</Text>
        </View>
      )}

      {/* 1. Space Picker Modal */}
      <Modal
        visible={showSpaceModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSpaceModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            accessibilityLabel="Hintergrund schließen"
            onPress={() => setShowSpaceModal(false)}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
            onStartShouldSetResponder={() => true}
            // @ts-ignore - web click propagation guard
            onClick={(e: any) => {
              if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
            }}
          >
            <View style={styles.modalHeader}>
              <Ionicons name="planet-outline" size={20} color={colors.accent} style={{ marginRight: 8 }} />
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Themen-Space wählen</Text>
              <TouchableOpacity onPress={() => setShowSpaceModal(false)}>
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={() => {
                if (onSelectSpace) onSelectSpace('all');
                setShowSpaceModal(false);
              }}
              style={[
                styles.spaceItemRow,
                selectedFilter === 'all' && { backgroundColor: colors.accentSubtle }
              ]}
            >
              <Text style={styles.spaceItemIcon}>🌟</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.spaceItemTitle, { color: colors.textPrimary }]}>Alle Spaces</Text>
                <Text style={[styles.spaceItemSub, { color: colors.textMuted }]}>Vollständiger kuratierter Feed aller 6 Wissensbereiche</Text>
              </View>
              {selectedFilter === 'all' && (
                <Ionicons name="checkmark-circle" size={18} color={colors.accent} />
              )}
            </TouchableOpacity>

            {(Object.keys(TOPIC_SPACE_MAP) as TopicTag[]).map(tag => {
              const meta = TOPIC_SPACE_MAP[tag];
              const isSelected = selectedFilter === tag;
              return (
                <TouchableOpacity
                  key={tag}
                  onPress={() => {
                    if (onSelectSpace) onSelectSpace(tag);
                    setShowSpaceModal(false);
                  }}
                  style={[
                    styles.spaceItemRow,
                    isSelected && { backgroundColor: colors.accentSubtle }
                  ]}
                >
                  <Ionicons name={meta.icon as any} size={18} color={meta.color} style={{ marginRight: 10 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.spaceItemTitle, { color: colors.textPrimary }]}>{meta.space}</Text>
                    <Text style={[styles.spaceItemSub, { color: colors.textMuted }]}>{meta.name}</Text>
                  </View>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={18} color={colors.accent} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Modal>

      {/* 2. Erkenntnis-Karma Modal */}
      <Modal
        visible={showKarmaModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowKarmaModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            accessibilityLabel="Hintergrund schließen"
            onPress={() => setShowKarmaModal(false)}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
            onStartShouldSetResponder={() => true}
            // @ts-ignore - web click propagation guard
            onClick={(e: any) => {
              if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
            }}
          >
            <View style={styles.modalHeader}>
              <Ionicons name="flame" size={22} color="#FF4500" style={{ marginRight: 8 }} />
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Erkenntnis-Karma</Text>
              <TouchableOpacity onPress={() => setShowKarmaModal(false)}>
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={[styles.karmaHeroBox, { backgroundColor: colors.surfaceSecondary }]}>
              <Text style={[styles.karmaHeroNumber, { color: colors.textPrimary }]}>{karmaScore}</Text>
              <Text style={[styles.karmaHeroLabel, { color: colors.accent }]}>Stufe: Dialektischer Forscher</Text>
              <Text style={[styles.karmaHeroDesc, { color: colors.textMuted }]}>
                Anti-Doomscroll-Ersparnis: ~128 Minuten fokussiertes Lesen statt Social-Media-Schleifen.
              </Text>
            </View>

            <View style={styles.karmaRulesBox}>
              <Text style={[styles.karmaRulesHeader, { color: colors.textPrimary }]}>Wie du Erkenntnis-Karma aufbaust:</Text>
              <Text style={[styles.karmaRuleLine, { color: colors.textSecondary }]}>• +10 Punkte für jeden dialektischen Einwand ([⚡️ Einwand])</Text>
              <Text style={[styles.karmaRuleLine, { color: colors.textSecondary }]}>• +15 Punkte für didaktische Unterrichtsentwürfe ([🏫 Unterricht])</Text>
              <Text style={[styles.karmaRuleLine, { color: colors.textSecondary }]}>• +5 Punkte für gespeicherte Artikel im Archiv</Text>
              <Text style={[styles.karmaRuleLine, { color: colors.textSecondary }]}>• +2 Punkte für sachliche Upvotes</Text>
              <Text style={[styles.karmaRuleLine, { color: colors.textMuted, fontStyle: 'italic', marginTop: 4 }]}>
                0 Punkte für hastiges Weiterscrollen – Atem belohnt Tiefe vor Tempo.
              </Text>
            </View>
          </View>
        </View>
      </Modal>

      {/* 3. AI Hub & Provider Modal */}
      <Modal
        visible={showAIModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowAIModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            accessibilityLabel="Hintergrund schließen"
            onPress={() => setShowAIModal(false)}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.borderSubtle,
                maxWidth: 600,
                width: '92%',
                maxHeight: '88%',
                display: 'flex',
                flexDirection: 'column'
              }
            ]}
            onStartShouldSetResponder={() => true}
            // @ts-ignore - web click propagation guard
            onClick={(e: any) => {
              if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
            }}
          >
            {/* Fixed Header */}
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <Ionicons name="hardware-chip-outline" size={20} color={colors.accent} style={{ marginRight: 8 }} />
                <View>
                  <Text style={[styles.modalTitle, { color: colors.textPrimary, fontSize: 16 }]}>KI-Orchestrierung & Modelle</Text>
                  <Text style={{ fontSize: 11, color: colors.textMuted }}>API-Key konfigurieren & Modell wählen</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setShowAIModal(false)}
                style={{ padding: 4 }}
                accessibilityRole="button"
                accessibilityLabel="Dialog schließen"
              >
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Scrollable Modal Content */}
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingVertical: 6, gap: 10 }}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
            >
              {/* 1. Provider Switcher */}
              <View>
                <Text style={[styles.inputLabel, { color: colors.textSecondary, marginBottom: 4 }]}>1. KI-Provider:</Text>
                <View style={styles.providerRow}>
                  {[
                    { id: 'gemini' as const, label: '⚡️ Google Gemini', desc: 'Offiziell (3.8 Flash, Argon, Nano)' },
                    { id: 'openrouter' as const, label: '🔮 OpenRouter', desc: 'Claude 3.5 Sonnet, Llama 3.3 & mehr' }
                  ].map(p => (
                    <TouchableOpacity
                      key={p.id}
                      onPress={() => void handleSwitchAIProvider(p.id)}
                      style={[
                        styles.providerPill,
                        {
                          backgroundColor: aiCreds.provider === p.id ? colors.accent : colors.surfaceSecondary,
                          borderColor: aiCreds.provider === p.id ? colors.accent : colors.borderSubtle
                        }
                      ]}
                    >
                      <Text style={[styles.providerPillText, { color: aiCreds.provider === p.id ? '#FFFFFF' : colors.textPrimary }]}>
                        {p.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* 2. API Key Section (IMMEDIATELY VISIBLE & ACCESSIBLE!) */}
              <View style={{ backgroundColor: colors.surfaceSecondary, padding: 10, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSubtle }}>
                <Text style={[styles.inputLabel, { color: colors.textPrimary, fontWeight: '700', fontSize: 12, marginBottom: 4 }]}>
                  {aiCreds.provider === 'gemini'
                    ? '2. Google AI Studio API-Key (lokal im Browser gesichert):'
                    : '2. OpenRouter API-Key:'}
                </Text>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <TextInput
                    value={aiCreds.apiKey}
                    onChangeText={async text => {
                      const trimmed = text.trim();
                      const next = { ...aiCreds, apiKey: trimmed, persistApiKey: true };
                      setAiCreds(next);
                      await saveAiCredentials(next);
                    }}
                    secureTextEntry={!showApiKey}
                    placeholder={aiCreds.provider === 'gemini' ? 'AIzaSy... (von aistudio.google.com)' : 'sk-or-v1-...'}
                    placeholderTextColor={colors.textMuted}
                    style={[
                      styles.modalInput,
                      {
                        flex: 1,
                        backgroundColor: colors.surface,
                        color: colors.textPrimary,
                        borderColor: colors.borderSubtle
                      }
                    ]}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {/* Paste from clipboard button */}
                  <TouchableOpacity
                    onPress={async () => {
                      try {
                        if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
                          const clip = await navigator.clipboard.readText();
                          if (clip?.trim()) {
                            const trimmed = clip.trim();
                            const next = { ...aiCreds, apiKey: trimmed, persistApiKey: true };
                            setAiCreds(next);
                            await saveAiCredentials(next);
                            showToast('✓ Aus Zwischenablage eingefügt');
                          }
                        }
                      } catch {
                        // Clipboard permission or availability
                      }
                    }}
                    style={[
                      styles.keyActionBtn,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.borderSubtle,
                        borderWidth: 1,
                        borderRadius: radius.md,
                        padding: 8
                      }
                    ]}
                    accessibilityLabel="Aus Zwischenablage einfügen"
                  >
                    <Ionicons name="clipboard-outline" size={18} color={colors.accent} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setShowApiKey(!showApiKey)}
                    style={[
                      styles.keyActionBtn,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.borderSubtle,
                        borderWidth: 1,
                        borderRadius: radius.md,
                        padding: 8
                      }
                    ]}
                    accessibilityLabel={showApiKey ? 'API-Key verbergen' : 'API-Key anzeigen'}
                  >
                    <Ionicons name={showApiKey ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>

                {/* Connection Test Button */}
                <TouchableOpacity
                  onPress={handleTestAI}
                  disabled={isTestingAI}
                  style={[
                    styles.modalActionBtn,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.accent,
                      borderWidth: 1,
                      marginTop: 8,
                      paddingVertical: 7
                    }
                  ]}
                >
                  {isTestingAI ? (
                    <ActivityIndicator size="small" color={colors.accent} />
                  ) : (
                    <Text style={[styles.modalActionBtnText, { color: colors.accent, fontWeight: '700', fontSize: 12 }]}>
                      🔑 Verbindung testen & Key validieren
                    </Text>
                  )}
                </TouchableOpacity>

                {/* Test Result Box */}
                {testResult && (
                  <View
                    style={[
                      styles.testResultBox,
                      {
                        backgroundColor: testResult.ok ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                        borderColor: testResult.ok ? '#10B981' : '#EF4444',
                        borderWidth: 1,
                        marginTop: 8,
                        borderRadius: radius.md,
                        padding: 8
                      }
                    ]}
                  >
                    <Text style={{ color: testResult.ok ? '#10B981' : '#EF4444', fontSize: 12, fontWeight: '600' }}>
                      {testResult.message}
                    </Text>
                  </View>
                )}
              </View>

              {/* 3. Model Selector Section */}
              <View>
                <Text style={[styles.inputLabel, { color: colors.textPrimary, fontWeight: '700', fontSize: 12, marginBottom: 4 }]}>
                  3. Modell auswählen:
                </Text>

                {aiCreds.provider === 'gemini' ? (
                  <GeminiModelSelector
                    selectedModelId={aiCreds.model || DEFAULT_GEMINI_MODEL}
                    onSelectModel={async mId => {
                      const next = { ...aiCreds, model: mId };
                      setAiCreds(next);
                      await saveAiCredentials(next);
                    }}
                    apiKey={aiCreds.apiKey}
                    workflow="text"
                  />
                ) : (
                  /* OpenRouter Model Selection */
                  <View style={{ marginVertical: 4 }}>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 4 }}>
                      {OPENROUTER_MODEL_PRESETS.map(preset => {
                        const isSelected = (aiCreds.model || DEFAULT_OPENROUTER_MODEL) === preset.id;
                        return (
                          <TouchableOpacity
                            key={preset.id}
                            onPress={async () => {
                              const next = { ...aiCreds, model: preset.id };
                              setAiCreds(next);
                              await saveAiCredentials(next);
                            }}
                            style={[
                              styles.modelPresetPill,
                              {
                                backgroundColor: isSelected ? colors.accent : colors.surfaceSecondary,
                                borderColor: isSelected ? colors.accent : colors.borderSubtle
                              }
                            ]}
                          >
                            <Text style={{ fontSize: 11, fontWeight: '600', color: isSelected ? '#FFFFFF' : colors.textPrimary }}>
                              {preset.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    <TextInput
                      value={aiCreds.model}
                      onChangeText={async text => {
                        const next = { ...aiCreds, model: text };
                        setAiCreds(next);
                        await saveAiCredentials(next);
                      }}
                      placeholder={DEFAULT_OPENROUTER_MODEL}
                      placeholderTextColor={colors.textMuted}
                      style={[styles.modalInput, { backgroundColor: colors.surfaceSecondary, color: colors.textPrimary, borderColor: colors.borderSubtle }]}
                    />
                  </View>
                )}
              </View>

              {/* Zero-Risk Note */}
              <Text style={[styles.modalFooterNote, { color: colors.textMuted, marginTop: 4 }]}>
                Deckel: 5,00 €/Monat. Ohne Key oder bei Budgetlimit schaltet Atem unterbrechungsfrei auf die lokale Heuristik um.
              </Text>
            </ScrollView>

            {/* Fixed Footer with Action Buttons */}
            <View style={{ flexDirection: 'row', gap: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.borderSubtle }}>
              <TouchableOpacity
                onPress={() => setShowAIModal(false)}
                style={[styles.modalActionBtn, { flex: 1, backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle, borderWidth: 1 }]}
              >
                <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Schließen</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSaveAISettings}
                style={[styles.modalActionBtn, { flex: 1, backgroundColor: colors.accent }]}
              >
                <Text style={[styles.modalActionBtnText, { color: '#FFFFFF', fontWeight: '700' }]}>✓ Speichern</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 4. Design-Palette Switcher Modal */}
      <Modal
        visible={showPaletteModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowPaletteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            accessibilityLabel="Hintergrund schließen"
            onPress={() => setShowPaletteModal(false)}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
            onStartShouldSetResponder={() => true}
            // @ts-ignore - web click propagation guard
            onClick={(e: any) => {
              if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
            }}
          >
            <View style={styles.modalHeader}>
              <Ionicons name="color-palette-outline" size={22} color={colors.accent} style={{ marginRight: 8 }} />
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Design-Ästhetik wählen</Text>
              <TouchableOpacity onPress={() => setShowPaletteModal(false)}>
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalSubHeader, { color: colors.textMuted }]}>
              Passe die visuelle Atmosphäre des Atem-Netzwerks sofort an:
            </Text>

            <View style={{ gap: 8, marginTop: 8 }}>
              {(Object.keys(PALETTE_METADATA) as ThemePalette[]).map(pKey => {
                const meta = PALETTE_METADATA[pKey];
                const isSelected = palette === pKey;
                return (
                  <TouchableOpacity
                    key={pKey}
                    onPress={() => {
                      setPalettePreference(pKey);
                      setShowPaletteModal(false);
                      showToast(`✓ Ästhetik gewechselt: ${meta.name}`);
                    }}
                    style={[
                      styles.paletteCard,
                      {
                        backgroundColor: isSelected ? colors.accentSubtle : colors.surfaceSecondary,
                        borderColor: isSelected ? colors.accent : colors.borderSubtle
                      }
                    ]}
                  >
                    <View style={[styles.paletteColorChip, { backgroundColor: meta.accent }]}>
                      <Ionicons name={meta.icon as any} size={15} color="#FFFFFF" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.paletteName, { color: colors.textPrimary }]}>{meta.name}</Text>
                      <Text style={[styles.paletteDesc, { color: colors.textMuted }]}>{meta.subtitle}</Text>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={20} color={colors.accent} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>

      {/* Ultra Master Studio Modal */}
      <UltraMasterModal
        visible={showUltraMasterModal}
        onClose={() => setShowUltraMasterModal(false)}
      />

      {/* Mobile Publish & QR Modal */}
      <MobilePublishModal
        visible={showMobilePublishModal}
        onClose={() => setShowMobilePublishModal(false)}
      />

      {/* News-Hub & Quellen-Zentrale Modal */}
      <NewsHubModal
        visible={showNewsHubModal}
        onClose={() => setShowNewsHubModal(false)}
      />

      {/* Atmen Breathing Portal Modal */}
      <AtmenBreathingPortal
        visible={showBreathingPortal}
        onClose={() => setShowBreathingPortal(false)}
        mode="modal"
      />

      {/* Hivemind Epistemic Stream Modal */}
      <HivemindStreamModal
        visible={showHivemindModal}
        onClose={() => setShowHivemindModal(false)}
      />

      {/* Feed-Kurator & Live-Sync Modal */}
      <Modal
        visible={showDevSimModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDevSimModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            accessibilityLabel="Hintergrund schließen"
            onPress={() => setShowDevSimModal(false)}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle, maxWidth: 520 }]}
            onStartShouldSetResponder={() => true}
            // @ts-ignore - web click propagation guard
            onClick={(e: any) => {
              if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
            }}
          >
            <View style={styles.modalHeader}>
              <Ionicons name="sparkles" size={22} color={colors.accent} style={{ marginRight: 8 }} />
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Studio, Kurator & Werkzeuge</Text>
              <TouchableOpacity onPress={() => setShowDevSimModal(false)}>
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalSubHeader, { color: colors.textMuted }]}>
              Souveränes Wissensnetzwerk: {healthOverview.deliveringSources} von {healthOverview.totalSources} geprüften Quellen liefern aktuell Beiträge. Persönliches Profil und Notizen bleiben lokal.
            </Text>

            <View style={[styles.karmaHeroBox, { backgroundColor: colors.surfaceSecondary, marginTop: 8 }]}>
              <Text style={[styles.karmaHeroLabel, { color: colors.accent }]}>Aktiver Redaktionsstand:</Text>
              <Text style={[styles.karmaHeroNumber, { color: colors.textPrimary, fontSize: 18 }]}>
                {activeDateSeed}
              </Text>
              <Text style={[styles.karmaHeroDesc, { color: colors.textMuted, marginTop: 4 }]}>
                {healthOverview.deliveringSources} aktive Quellen • {healthOverview.totalItemsHarvested} Artikel im Snapshot • {karmaScore} Erkenntnis-Karma
              </Text>
            </View>

            {/* Quick Tool Grid */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              <TouchableOpacity
                onPress={() => {
                  setShowDevSimModal(false);
                  setShowNewsHubModal(true);
                }}
                style={[styles.modelPresetPill, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle, paddingVertical: 7, paddingHorizontal: 10 }]}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
                  Quellen-Zentrale ({healthOverview.deliveringSources}/{healthOverview.totalSources})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setShowDevSimModal(false);
                  setShowUltraMasterModal(true);
                }}
                style={[styles.modelPresetPill, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle, paddingVertical: 7, paddingHorizontal: 10 }]}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
                  Master Studio
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setShowDevSimModal(false);
                  setShowAIModal(true);
                }}
                style={[styles.modelPresetPill, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle, paddingVertical: 7, paddingHorizontal: 10 }]}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
                  KI & Budget
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setShowDevSimModal(false);
                  setShowMobilePublishModal(true);
                }}
                style={[styles.modelPresetPill, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle, paddingVertical: 7, paddingHorizontal: 10 }]}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
                  Aufs Handy
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setShowDevSimModal(false);
                  void handleCopyCraft();
                }}
                style={[styles.modelPresetPill, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle, paddingVertical: 7, paddingHorizontal: 10 }]}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
                  Craft-Export
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setShowDevSimModal(false);
                  handleDownloadCraft();
                }}
                style={[styles.modelPresetPill, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle, paddingVertical: 7, paddingHorizontal: 10 }]}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
                  Craft-Download (.md)
                </Text>
              </TouchableOpacity>
            </View>

            <View style={{ gap: 10, marginTop: 14 }}>
              <TouchableOpacity
                onPress={handleShuffle}
                disabled={isSimulating}
                style={[styles.simActionButton, { backgroundColor: colors.accent }]}
              >
                {isSimulating ? (
                  <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                ) : (
                  <Ionicons name="shuffle" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>
                    Frischer Wind (Sofort neu mischen)
                  </Text>
                  <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11 }}>
                    Rotiert ungesehene Beiträge aus dem Bloomscrolling-Pool in den Vordergrund.
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleSimulateDay(0)}
                disabled={isSimulating}
                style={[styles.simActionButton, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle, borderWidth: 1 }]}
              >
                <Ionicons name="refresh" size={18} color={colors.accent} style={{ marginRight: 8 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 13 }}>
                    Live-Sync & Kuratieren (Stand: {activeDateSeed})
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                    Aktualisiert den öffentlichen Feed-Snapshot und die Live-Quellen.
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleSimulateDay(1)}
                disabled={isSimulating}
                style={[styles.simActionButton, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle, borderWidth: 1 }]}
              >
                <Ionicons name="sunny-outline" size={18} color="#8B5CF6" style={{ marginRight: 8 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 13 }}>
                    Nächsten Tag kuratieren (+1 Tag)
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                    Rotiert auf den nächsten 24h-Turnus mit neuem Seed.
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  void handleRefresh();
                }}
                disabled={isRefreshing}
                style={[styles.simActionButton, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle, borderWidth: 1 }]}
              >
                {isRefreshing ? (
                  <ActivityIndicator size="small" color={colors.accent} style={{ marginRight: 8 }} />
                ) : (
                  <Ionicons name="cloud-download-outline" size={18} color={colors.accent} style={{ marginRight: 8 }} />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 13 }}>
                    Quellen-Feeds jetzt synchronisieren
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                    Ruft alle {healthOverview.totalSources} RSS-, Atom- und JSON-Feeds direkt ab.
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    height: 52,
    borderBottomWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    zIndex: 10
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    maxWidth: 1140,
    width: '100%',
    alignSelf: 'center',
    gap: spacing.md
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7
  },
  logoEmblem: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center'
  },
  logoSymbol: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 16,
    lineHeight: 18
  },
  brandText: {
    fontFamily: typography.fontFamilies.serif,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 1
  },
  homeCenterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1
  },
  homeCenterPillText: {
    fontSize: typography.sizes.caption,
    fontWeight: '800',
    letterSpacing: 0.3
  },
  spaceDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 0.5,
    maxWidth: 160
  },
  spaceDropdownText: {
    fontSize: typography.sizes.micro,
    fontWeight: '700'
  },
  centerSection: {
    flex: 1,
    maxWidth: 440
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 0.5
  },
  searchInput: {
    flex: 1,
    fontSize: typography.sizes.caption,
    padding: 0
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  liveStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 0.5
  },
  liveGreenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 5
  },
  liveStatusText: {
    fontSize: 11,
    fontWeight: '700'
  },
  flameEmoji: {
    fontSize: 12,
    marginRight: 3
  },
  karmaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 0.5
  },
  karmaText: {
    fontSize: typography.sizes.caption,
    fontWeight: '700'
  },
  budgetBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 0.5
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 5
  },
  budgetText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#10B981'
  },
  newsHubBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 0.5
  },
  newsHubText: {
    fontSize: 11,
    fontWeight: '700'
  },
  breathingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 0.5
  },
  breathingPillText: {
    fontSize: 11
  },
  hivemindBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 0.5
  },
  hivemindBadgeText: {
    fontSize: 11
  },
  ultraMasterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    height: 30,
    borderRadius: radius.pill,
    borderWidth: 1
  },
  ultraMasterText: {
    fontSize: 11,
    fontWeight: '800'
  },
  mobileBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    height: 30,
    borderRadius: radius.pill,
    borderWidth: 1
  },
  mobileBadgeText: {
    fontSize: 11,
    fontWeight: '800'
  },
  devSimBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    height: 30,
    borderRadius: radius.pill,
    borderWidth: 1
  },
  devSimBadgeText: {
    fontSize: 11,
    fontWeight: '800'
  },
  simActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: radius.md
  },
  modelPresetPill: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1
  },
  toolCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 0.5,
    padding: 2
  },
  toolClusterBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center'
  },
  tabGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.pill,
    padding: 2,
    borderWidth: 0.5
  },
  tabBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.pill
  },
  iconBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center'
  },
  toastContainer: {
    position: 'absolute',
    top: 58,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.pill,
    zIndex: 999,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: typography.sizes.caption,
    fontWeight: '700'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.pageHorizontal
  },
  modalCard: {
    width: '100%',
    maxWidth: 480,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm
  },
  modalTitle: {
    flex: 1,
    fontSize: typography.sizes.bodyLarge,
    fontWeight: '700'
  },
  modalSubHeader: {
    fontSize: typography.sizes.micro,
    marginBottom: 6
  },
  spaceItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: radius.md,
    marginTop: 4
  },
  spaceItemIcon: {
    fontSize: 18,
    marginRight: 10
  },
  spaceItemTitle: {
    fontSize: typography.sizes.bodySmall,
    fontWeight: '700'
  },
  spaceItemSub: {
    fontSize: typography.sizes.micro
  },
  karmaHeroBox: {
    padding: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    marginBottom: spacing.md
  },
  karmaHeroNumber: {
    fontSize: 32,
    fontWeight: '900',
    marginBottom: 2
  },
  karmaHeroLabel: {
    fontSize: typography.sizes.bodySmall,
    fontWeight: '700',
    marginBottom: 4
  },
  karmaHeroDesc: {
    fontSize: typography.sizes.micro,
    textAlign: 'center'
  },
  karmaRulesBox: {
    gap: 4
  },
  karmaRulesHeader: {
    fontSize: typography.sizes.caption,
    fontWeight: '700',
    marginBottom: 4
  },
  karmaRuleLine: {
    fontSize: typography.sizes.micro,
    lineHeight: 18
  },
  providerRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8
  },
  providerPill: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: radius.md,
    borderWidth: 0.5,
    alignItems: 'center'
  },
  providerPillText: {
    fontSize: typography.sizes.micro,
    fontWeight: '700',
    textAlign: 'center'
  },
  inputLabel: {
    fontSize: typography.sizes.micro,
    fontWeight: '600',
    marginBottom: 3
  },
  modalInput: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radius.md,
    borderWidth: 0.5,
    fontSize: typography.sizes.micro
  },
  keyActionBtn: {
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalActionBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center'
  },
  modalActionBtnText: {
    fontSize: typography.sizes.caption,
    fontWeight: '700'
  },
  testResultBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: radius.md,
    borderWidth: 0.5
  },
  testResultText: {
    fontSize: typography.sizes.micro,
    lineHeight: 16
  },
  modalFooterNote: {
    fontSize: 10,
    marginTop: 10,
    textAlign: 'center'
  },
  paletteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: radius.md,
    borderWidth: 1
  },
  paletteColorChip: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10
  },
  paletteName: {
    fontSize: typography.sizes.bodySmall,
    fontWeight: '700'
  },
  paletteDesc: {
    fontSize: typography.sizes.micro
  }
});
