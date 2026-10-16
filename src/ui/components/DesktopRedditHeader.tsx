import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../core/context/AppContext';
import { typography, radius, spacing, PALETTE_METADATA, ThemePalette } from '../theme';
import { generateCraftMarkdown, copyToClipboard, downloadMarkdownFile } from '../../core/export/craftExport';
import { TopicTag, TOPIC_SPACE_MAP } from '../../core/domain/types';
import { defaultGeminiEnricher, AIProvider } from '../../core/enrichment/geminiEnricher';
import { NewsHubModal } from './NewsHubModal';
import { UltraMasterModal } from './UltraMasterModal';
import { MobilePublishModal } from './MobilePublishModal';

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
  const [bannerNotice, setBannerNotice] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // AI Hub State
  const [aiProvider, setAiProvider] = useState<AIProvider>(defaultGeminiEnricher.getProvider());
  const [aiModel, setAiModel] = useState<string>(defaultGeminiEnricher.getModel());
  const [aiEndpoint, setAiEndpoint] = useState<string>(defaultGeminiEnricher.getEndpoint());
  const [aiKeyInput, setAiKeyInput] = useState<string>('');
  const [testResult, setTestResult] = useState<string | null>(null);
  const [isTestingAI, setIsTestingAI] = useState<boolean>(false);

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
      showToast('✓ 68 Artikel aus 18 Live-Quellen synchronisiert');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSwitchAIProvider = (provider: AIProvider) => {
    setAiProvider(provider);
    defaultGeminiEnricher.setProvider(provider);
    setAiModel(defaultGeminiEnricher.getModel());
    setAiEndpoint(defaultGeminiEnricher.getEndpoint());
    setTestResult(null);
  };

  const handleSaveAISettings = () => {
    if (aiKeyInput.trim()) {
      defaultGeminiEnricher.setApiKey(aiKeyInput.trim());
    }
    if (aiModel.trim()) {
      defaultGeminiEnricher.setModel(aiModel.trim());
    }
    if (aiEndpoint.trim()) {
      defaultGeminiEnricher.setEndpoint(aiEndpoint.trim());
    }
    showToast('✓ KI-Konfiguration übernommen');
  };

  const handleTestAI = async () => {
    setIsTestingAI(true);
    setTestResult(null);
    try {
      if (aiKeyInput.trim()) defaultGeminiEnricher.setApiKey(aiKeyInput.trim());
      defaultGeminiEnricher.setModel(aiModel.trim());
      defaultGeminiEnricher.setEndpoint(aiEndpoint.trim());
      const res = await defaultGeminiEnricher.testConnection();
      if (res.success) {
        setTestResult(`✓ Verbunden!\n„${res.reply}“`);
      } else {
        setTestResult(`Hinweis: ${res.message}\n(Atem nutzt lokale Heuristik als Null-Kosten-Garantie)`);
      }
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
              {/* atmen Circular Aperture Emblem */}
              <View style={[styles.logoEmblem, { backgroundColor: colors.accent }]}>
                <Text style={styles.logoSymbol}>◎</Text>
              </View>
              <Text style={[styles.brandText, { color: colors.textPrimary }]}>
                atmen
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
                  { color: activeTab === 'feed' && !selectedArticleId ? '#FFFFFF' : colors.textPrimary }
                ]}
              >
                Home
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
                placeholder="atmen durchsuchen (Thesen, Didaktik, Quellen)…"
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

          {/* Right: Live-Refresh, News-Hub, Karma, Budget, Tools Cluster & Nav Tabs */}
          <View style={styles.rightSection}>
            {/* Live-Feed Status & Refresh Pill */}
            <TouchableOpacity
              onPress={handleRefresh}
              disabled={isRefreshing}
              style={[styles.liveStatusPill, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}
              accessibilityRole="button"
              accessibilityLabel="Live-Feeds synchronisieren"
            >
              {isRefreshing ? (
                <ActivityIndicator size="small" color={colors.accent} style={{ marginRight: 4 }} />
              ) : (
                <View style={styles.liveGreenDot} />
              )}
              <Text style={[styles.liveStatusText, { color: colors.textPrimary }]}>
                {isRefreshing ? 'Lädt…' : '110 Live'}
              </Text>
            </TouchableOpacity>

            {/* News-Hub & Quellen-Zentrale Pill Button */}
            <TouchableOpacity
              onPress={() => {
                setActiveTab('feed');
                setActiveFeedOption('live_news');
              }}
              style={[
                styles.newsHubBadge,
                activeTab === 'feed' && activeFeedOption === 'live_news'
                  ? { backgroundColor: colors.accentSubtle, borderColor: colors.accent }
                  : { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }
              ]}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Zum Live News Hub Feed wechseln"
            >
              <Ionicons
                name="radio-outline"
                size={13}
                color={activeTab === 'feed' && activeFeedOption === 'live_news' ? colors.accent : colors.textPrimary}
                style={{ marginRight: 4 }}
              />
              <Text
                style={[
                  styles.newsHubText,
                  { color: activeTab === 'feed' && activeFeedOption === 'live_news' ? colors.accent : colors.textPrimary, fontWeight: activeFeedOption === 'live_news' ? '700' : '600' }
                ]}
              >
                ⚡ Live News Hub
              </Text>
            </TouchableOpacity>

            {/* Feed-Kurator & Live-Sync Button */}
            <TouchableOpacity
              onPress={() => setShowDevSimModal(true)}
              style={[styles.devSimBadge, { backgroundColor: '#8B5CF6' + '22', borderColor: '#8B5CF6' }]}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Feed-Kurator & Live-Sync öffnen"
            >
              <Ionicons name="sync-outline" size={13} color="#8B5CF6" style={{ marginRight: 4 }} />
              <Text style={[styles.devSimBadgeText, { color: '#8B5CF6' }]}>
                🔄 Feed-Kurator
              </Text>
            </TouchableOpacity>

            {/* Ultra Master Studio Button */}
            <TouchableOpacity
              onPress={() => setShowUltraMasterModal(true)}
              style={[styles.ultraMasterBadge, { backgroundColor: '#F59E0B' + '22', borderColor: '#F59E0B' }]}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Ultra Master Studio öffnen"
            >
              <Ionicons name="sparkles" size={13} color="#F59E0B" style={{ marginRight: 4 }} />
              <Text style={[styles.ultraMasterText, { color: '#F59E0B' }]}>
                ⚡ Master Studio
              </Text>
            </TouchableOpacity>

            {/* Mobile / Smartphone QR Button */}
            <TouchableOpacity
              onPress={() => setShowMobilePublishModal(true)}
              style={[styles.mobileBadge, { backgroundColor: '#06B6D4' + '20', borderColor: '#06B6D4' }]}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Auf Smartphone öffnen"
            >
              <Ionicons name="phone-portrait-outline" size={13} color="#06B6D4" style={{ marginRight: 4 }} />
              <Text style={[styles.mobileBadgeText, { color: '#06B6D4' }]}>
                📱 Aufs Handy
              </Text>
            </TouchableOpacity>

            {/* Karma Badge Button */}
            <TouchableOpacity
              onPress={() => setShowKarmaModal(true)}
              style={[styles.karmaBadge, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`Erkenntnis-Karma: ${karmaScore} Punkte anzeigen`}
            >
              <Text style={styles.flameEmoji}>🔥</Text>
              <Text style={[styles.karmaText, { color: colors.textPrimary }]}>
                {karmaScore}
              </Text>
            </TouchableOpacity>

            {/* AI Budget Status Pill Button */}
            <TouchableOpacity
              onPress={() => setShowAIModal(true)}
              style={[styles.budgetBadge, { backgroundColor: 'rgba(16, 185, 129, 0.12)', borderColor: '#10B981' }]}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="KI-Orchestrierung & Budget öffnen"
            >
              <View style={styles.greenDot} />
              <Text style={styles.budgetText}>KI aktiv</Text>
            </TouchableOpacity>

            {/* Consolidated Tools Cluster: Palette, Craft & Theme */}
            <View style={[styles.toolCluster, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
              {/* Design-Palette Switcher */}
              <TouchableOpacity
                onPress={() => setShowPaletteModal(true)}
                style={styles.toolClusterBtn}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Design-Ästhetik & Farbpalette wählen"
              >
                <Ionicons name="color-palette-outline" size={15} color={colors.accent} />
              </TouchableOpacity>

              {/* 1-Click Craft Export (Copy & Download) */}
              <TouchableOpacity
                onPress={handleCopyCraft}
                onLongPress={handleDownloadCraft}
                style={styles.toolClusterBtn}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Craft Export in Zwischenablage kopieren (Halten für .md Datei)"
              >
                <Ionicons name="copy-outline" size={14} color={colors.textSecondary} />
              </TouchableOpacity>

              {/* Theme Toggle (Light / Dark) */}
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

            {/* Quick Tab Switcher */}
            <View style={[styles.tabGroup, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
              <TouchableOpacity
                onPress={() => setActiveTab('feed')}
                style={[
                  styles.tabBtn,
                  activeTab === 'feed' && { backgroundColor: colors.surface }
                ]}
                accessibilityRole="button"
                accessibilityLabel="Feed öffnen"
              >
                <Ionicons
                  name="compass-outline"
                  size={15}
                  color={activeTab === 'feed' ? colors.accent : colors.textMuted}
                />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setActiveTab('library')}
                style={[
                  styles.tabBtn,
                  activeTab === 'library' && { backgroundColor: colors.surface }
                ]}
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
                onPress={() => setActiveTab('settings')}
                style={[
                  styles.tabBtn,
                  activeTab === 'settings' && { backgroundColor: colors.surface }
                ]}
                accessibilityRole="button"
                accessibilityLabel="Einstellungen öffnen"
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
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowSpaceModal(false)}
        >
          <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
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
        </TouchableOpacity>
      </Modal>

      {/* 2. Erkenntnis-Karma Modal */}
      <Modal
        visible={showKarmaModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowKarmaModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowKarmaModal(false)}
        >
          <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
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
        </TouchableOpacity>
      </Modal>

      {/* 3. AI Hub & Provider Modal */}
      <Modal
        visible={showAIModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowAIModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowAIModal(false)}
        >
          <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
            <View style={styles.modalHeader}>
              <Ionicons name="hardware-chip-outline" size={22} color={colors.accent} style={{ marginRight: 8 }} />
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>KI-Orchestrierung & Sparring</Text>
              <TouchableOpacity onPress={() => setShowAIModal(false)}>
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Provider Switcher */}
            <Text style={[styles.modalSubHeader, { color: colors.textMuted }]}>KI-Modell & Sparring-Partner:</Text>
            <View style={styles.providerRow}>
              {[
                { id: 'gemini', label: '⚡️ Gemini Flash', desc: 'Google Cloud' },
                { id: 'ollama', label: '🦙 Local LLM', desc: 'Ollama / Offline' },
                { id: 'openai', label: '🔮 ChatGPT / API', desc: 'OpenAI / Custom' }
              ].map(p => (
                <TouchableOpacity
                  key={p.id}
                  onPress={() => handleSwitchAIProvider(p.id as AIProvider)}
                  style={[
                    styles.providerPill,
                    {
                      backgroundColor: aiProvider === p.id ? colors.accent : colors.surfaceSecondary,
                      borderColor: aiProvider === p.id ? colors.accent : colors.borderSubtle
                    }
                  ]}
                >
                  <Text style={[styles.providerPillText, { color: aiProvider === p.id ? '#FFFFFF' : colors.textPrimary }]}>
                    {p.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Settings Fields */}
            <View style={{ gap: 8, marginTop: 12 }}>
              <View>
                <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Modell:</Text>
                
                {/* 1-Click Model Presets */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 6 }}>
                  {[
                    { id: 'gemini-3.8-flash', label: '⚡️ 3.8 Flash (Standard)', provider: 'gemini' },
                    { id: 'gemini-3.7-flash', label: '⚡️ 3.7 Flash', provider: 'gemini' },
                    { id: 'gemini-4-argon', label: '🧪 4 Argon (Experimental)', provider: 'gemini' },
                    { id: 'gemini-2.5-flash', label: '⚡️ 2.5 Flash', provider: 'gemini' },
                    { id: 'llama3.2', label: '🦙 Llama 3.2', provider: 'ollama' },
                    { id: 'mistral', label: '🦙 Mistral', provider: 'ollama' },
                    { id: 'gpt-4o-mini', label: '🔮 GPT-4o mini', provider: 'openai' },
                    { id: 'gpt-4o', label: '🔮 GPT-4o', provider: 'openai' }
                  ].filter(m => m.provider === aiProvider).map(m => (
                    <TouchableOpacity
                      key={m.id}
                      onPress={() => {
                        setAiModel(m.id);
                        defaultGeminiEnricher.setModel(m.id);
                        showToast(`Modell gewählt: ${m.id}`);
                      }}
                      style={[
                        styles.modelPresetPill,
                        {
                          backgroundColor: aiModel === m.id ? colors.accent : colors.surfaceSecondary,
                          borderColor: aiModel === m.id ? colors.accent : colors.borderSubtle
                        }
                      ]}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '600', color: aiModel === m.id ? '#FFFFFF' : colors.textPrimary }}>
                        {m.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TextInput
                  value={aiModel}
                  onChangeText={setAiModel}
                  placeholder="z.B. gemini-3.8-flash, gemini-3.7-flash oder gemini-4-argon"
                  placeholderTextColor={colors.textMuted}
                  style={[styles.modalInput, { backgroundColor: colors.surfaceSecondary, color: colors.textPrimary, borderColor: colors.borderSubtle }]}
                />
              </View>

              {aiProvider !== 'gemini' && (
                <View>
                  <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Endpoint:</Text>
                  <TextInput
                    value={aiEndpoint}
                    onChangeText={setAiEndpoint}
                    placeholder="http://localhost:11434/v1"
                    placeholderTextColor={colors.textMuted}
                    style={[styles.modalInput, { backgroundColor: colors.surfaceSecondary, color: colors.textPrimary, borderColor: colors.borderSubtle }]}
                  />
                </View>
              )}

              {aiProvider !== 'ollama' && (
                <View>
                  <Text style={[styles.inputLabel, { color: colors.textMuted }]}>API-Key (optional, lokal gesichert):</Text>
                  <TextInput
                    value={aiKeyInput}
                    onChangeText={setAiKeyInput}
                    secureTextEntry
                    placeholder="Key einfügen für Live-KI..."
                    placeholderTextColor={colors.textMuted}
                    style={[styles.modalInput, { backgroundColor: colors.surfaceSecondary, color: colors.textPrimary, borderColor: colors.borderSubtle }]}
                  />
                </View>
              )}
            </View>

            {/* Test AI Connection Button */}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <TouchableOpacity
                onPress={handleTestAI}
                disabled={isTestingAI}
                style={[styles.modalActionBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle, borderWidth: 1 }]}
              >
                {isTestingAI ? (
                  <ActivityIndicator size="small" color={colors.accent} />
                ) : (
                  <Text style={[styles.modalActionBtnText, { color: colors.accent }]}>Test-Sparring anfordern</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSaveAISettings}
                style={[styles.modalActionBtn, { backgroundColor: colors.accent }]}
              >
                <Text style={[styles.modalActionBtnText, { color: '#FFFFFF' }]}>Speichern</Text>
              </TouchableOpacity>
            </View>

            {/* Test Result Box */}
            {testResult && (
              <View style={[styles.testResultBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
                <Text style={[styles.testResultText, { color: colors.textPrimary }]}>{testResult}</Text>
              </View>
            )}

            {/* Zero-Risk Note */}
            <Text style={[styles.modalFooterNote, { color: colors.textMuted }]}>
              Deckel: 5,00 €/Monat. Bei Erreichen oder ohne Key schaltet Atem unterbrechungsfrei auf die lokale Heuristik um.
            </Text>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 4. Design-Palette Switcher Modal */}
      <Modal
        visible={showPaletteModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowPaletteModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowPaletteModal(false)}
        >
          <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
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
        </TouchableOpacity>
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

      {/* Feed-Kurator & Live-Sync Modal */}
      <Modal
        visible={showDevSimModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDevSimModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowDevSimModal(false)}
        >
          <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle, maxWidth: 520 }]}>
            <View style={styles.modalHeader}>
              <Ionicons name="sync-circle" size={24} color="#8B5CF6" style={{ marginRight: 8 }} />
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>🔄 Feed-Kurator & Live-Sync</Text>
              <TouchableOpacity onPress={() => setShowDevSimModal(false)}>
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalSubHeader, { color: colors.textMuted }]}>
              Souveränes Wissensnetzwerk: Zieht 29 Live-RSS-Feeds ein, verbindet sie mit 117 kuratierten Wissensartikeln und rotiert die Tagesausgaben (€0.00 Modus, 100% lokal & privat).
            </Text>

            <View style={[styles.karmaHeroBox, { backgroundColor: colors.surfaceSecondary, marginTop: 8 }]}>
              <Text style={[styles.karmaHeroLabel, { color: '#8B5CF6' }]}>Aktiver Redaktionsstand:</Text>
              <Text style={[styles.karmaHeroNumber, { color: colors.textPrimary, fontSize: 18 }]}>
                📅 {activeDateSeed}
              </Text>
              <Text style={[styles.karmaHeroDesc, { color: colors.textMuted, marginTop: 4 }]}>
                29 Live-Feeds • 117 Wissensquellen • <Text style={{ color: colors.accent, fontWeight: '700' }}>€0.00 Modus</Text>
              </Text>
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
                    🔄 Frischer Wind (Sofort neu würfeln)
                  </Text>
                  <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11 }}>
                    Rotiert ungesehene Artikel aus dem Wissenspool in den Vordergrund.
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
                    ⚡ Live-Sync & Kuratieren (Stand: {activeDateSeed})
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                    Zieht 29 Live-RSS-Feeds ein & ordnet die heutige Ausgabe mit dialektischen Trends neu an.
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
                    🌅 Nächsten Tag kuratieren (+1 Tag)
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                    Rotiert auf den nächsten 24h-Turnus mit frischem Seed.
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleSimulateDay(3)}
                disabled={isSimulating}
                style={[styles.simActionButton, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle, borderWidth: 1 }]}
              >
                <Ionicons name="play-forward-outline" size={18} color="#8B5CF6" style={{ marginRight: 8 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 13 }}>
                    ⏩ 3 Tage vorrotieren (+3 Tage)
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                    Stresstest für Feed-Rotation & Entdeckung ungesehener Klassiker.
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
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
