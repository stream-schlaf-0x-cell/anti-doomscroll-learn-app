import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Switch,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../core/context/AppContext';
import {
  defaultSourceRepository,
  FeedSourceItem,
  SourceCategory,
  CATEGORY_METADATA
} from '../../core/data/sourceRepository';
import { TopicTag, TOPIC_SPACE_MAP } from '../../core/domain/types';
import { typography, radius, spacing } from '../theme';
import { copyToClipboard, downloadMarkdownFile } from '../../core/export/craftExport';
import { MusicTrackCard } from './MusicTrackCard';
import {
  MusicRecommendationService,
  MusicTrackItem,
  CURATED_SOUND_MASTERS
} from '../../core/music/musicRecommendationService';

interface NewsHubModalProps {
  visible: boolean;
  onClose: () => void;
}

type HubTab = 'sources' | 'import' | 'music' | 'sync';

export const NewsHubModal: React.FC<NewsHubModalProps> = ({ visible, onClose }) => {
  const { colors, refreshFeed } = useApp();

  const [activeTab, setActiveTab] = useState<HubTab>('sources');
  const [musicQuery, setMusicQuery] = useState<string>('');
  const [musicResults, setMusicResults] = useState<MusicTrackItem[]>(CURATED_SOUND_MASTERS);
  const [isSearchingMusic, setIsSearchingMusic] = useState<boolean>(false);
  const [sources, setSources] = useState<FeedSourceItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<SourceCategory | 'all'>('all');

  // Add custom feed state
  const [customUrl, setCustomUrl] = useState<string>('');
  const [customName, setCustomName] = useState<string>('');
  const [customTopic, setCustomTopic] = useState<TopicTag>('science_society');
  const [opmlInput, setOpmlInput] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Status & Feedback toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadSources = async () => {
    try {
      setIsLoading(true);
      const data = await defaultSourceRepository.getAllSources();
      setSources(data);
    } catch (e) {
      console.warn('Failed to load sources:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      void loadSources();
    }
  }, [visible]);

  const handleToggle = async (id: string) => {
    const newStatus = await defaultSourceRepository.toggleSource(id);
    setSources(prev => prev.map(s => s.id === id ? { ...s, enabled: newStatus } : s));
    showToast(newStatus ? '✓ Quelle aktiviert' : 'Quelle pausiert');
  };

  const handleAddCustom = async () => {
    if (!customUrl.trim()) {
      showToast('Bitte eine gültige RSS- oder Atom-URL eingeben');
      return;
    }
    setIsSubmitting(true);
    try {
      const added = await defaultSourceRepository.addCustomSource({
        name: customName.trim(),
        url: customUrl.trim(),
        primaryTopic: customTopic,
        category: 'custom'
      });
      setSources(prev => [...prev, added]);
      setCustomUrl('');
      setCustomName('');
      showToast(`✓ Feed „${added.name}“ hinzugefügt`);
      setActiveTab('sources');
    } catch (err: any) {
      showToast(err.message || 'Fehler beim Hinzufügen des Feeds');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCustom = async (id: string, name: string) => {
    try {
      await defaultSourceRepository.removeCustomSource(id);
      setSources(prev => prev.filter(s => s.id !== id));
      showToast(`✓ Quelle „${name}“ entfernt`);
    } catch {
      showToast('Löschen fehlgeschlagen');
    }
  };

  const handleImportOPML = async () => {
    if (!opmlInput.trim()) {
      showToast('Bitte OPML-XML-Text einfügen');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await defaultSourceRepository.importOPML(opmlInput);
      await loadSources();
      setOpmlInput('');
      showToast(`✓ ${res.added.length} Feeds importiert (${res.skippedCount} übersprungen)`);
      setActiveTab('sources');
    } catch {
      showToast('OPML-Import fehlgeschlagen: Ungültiges XML');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExportOPML = async () => {
    try {
      const xml = defaultSourceRepository.exportOPML(sources);
      const ok = await copyToClipboard(xml);
      if (ok) {
        showToast('✓ OPML in Zwischenablage kopiert!');
      } else {
        showToast('Kopieren fehlgeschlagen');
      }
    } catch {
      showToast('Export-Fehler');
    }
  };

  const handleDownloadOPML = () => {
    try {
      const xml = defaultSourceRepository.exportOPML(sources);
      const filename = `atmen-subscriptions-${new Date().toISOString().slice(0, 10)}.opml`;
      const ok = downloadMarkdownFile(filename, xml);
      if (ok) {
        showToast(`✓ Datei ${filename} heruntergeladen`);
      }
    } catch {
      showToast('Download fehlgeschlagen');
    }
  };

  const handleApplyPreset = async (preset: 'all' | 'oerr_only' | 'science_culture') => {
    await defaultSourceRepository.applyPreset(preset);
    await loadSources();
    if (preset === 'all') showToast('✓ Alle 29 Quellen aktiviert');
    if (preset === 'oerr_only') showToast('✓ Nur Öffentlich-Rechtliche aktiviert');
    if (preset === 'science_culture') showToast('✓ Fokus auf Wissenschaft & Kultur');
  };

  const handleMusicSearch = async (query: string) => {
    setMusicQuery(query);
    if (!query.trim()) {
      setMusicResults(CURATED_SOUND_MASTERS);
      return;
    }
    setIsSearchingMusic(true);
    try {
      const results = await MusicRecommendationService.searchITunesTracks(query.trim(), 8);
      setMusicResults(results.length > 0 ? results : CURATED_SOUND_MASTERS);
    } catch {
      setMusicResults(CURATED_SOUND_MASTERS);
    } finally {
      setIsSearchingMusic(false);
    }
  };

  const handleSyncNow = async () => {
    setIsSubmitting(true);
    try {
      await defaultSourceRepository.recordSync();
      await refreshFeed();
      await loadSources();
      showToast('✓ Live-Synchronisation erfolgreich abgeschlossen');
    } catch {
      showToast('Sync fehlgeschlagen');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered sources
  const filteredSources = useMemo(() => {
    return sources.filter(s => {
      if (selectedCategory !== 'all' && s.category !== selectedCategory) return false;
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase();
        return s.name.toLowerCase().includes(q)
          || s.url.toLowerCase().includes(q)
          || (s.defaultAuthor && s.defaultAuthor.toLowerCase().includes(q));
      }
      return true;
    });
  }, [sources, selectedCategory, searchQuery]);

  const enabledCount = sources.filter(s => s.enabled).length;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.borderSubtle }]}>
            <View style={styles.headerLeft}>
              <View style={[styles.iconEmblem, { backgroundColor: colors.accentSubtle }]}>
                <Ionicons name="radio-outline" size={18} color={colors.accent} />
              </View>
              <View>
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
                  News-Hub & Quellen-Zentrale
                </Text>
                <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
                  {enabledCount} von {sources.length} Quellen aktiv • Tagesschau, ZDF, Spektrum, Quanta, YT & Import
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: colors.surfaceSecondary }]}
              accessibilityRole="button"
              accessibilityLabel="News-Hub schließen"
            >
              <Ionicons name="close" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Toast Notice */}
          {toastMessage && (
            <View style={[styles.toast, { backgroundColor: colors.accent }]}>
              <Text style={styles.toastText}>{toastMessage}</Text>
            </View>
          )}

          {/* Nav Tabs */}
          <View style={[styles.tabBar, { borderBottomColor: colors.borderSubtle, backgroundColor: colors.surfaceSecondary }]}>
            <TouchableOpacity
              onPress={() => setActiveTab('sources')}
              style={[
                styles.tabItem,
                activeTab === 'sources' && { borderBottomColor: colors.accent, backgroundColor: colors.surface }
              ]}
            >
              <Ionicons
                name="list-outline"
                size={14}
                color={activeTab === 'sources' ? colors.accent : colors.textMuted}
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  styles.tabItemText,
                  { color: activeTab === 'sources' ? colors.accent : colors.textSecondary }
                ]}
              >
                Quellen-Katalog ({sources.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActiveTab('import')}
              style={[
                styles.tabItem,
                activeTab === 'import' && { borderBottomColor: colors.accent, backgroundColor: colors.surface }
              ]}
            >
              <Ionicons
                name="cloud-upload-outline"
                size={14}
                color={activeTab === 'import' ? colors.accent : colors.textMuted}
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  styles.tabItemText,
                  { color: activeTab === 'import' ? colors.accent : colors.textSecondary }
                ]}
              >
                Import & OPML
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActiveTab('music')}
              style={[
                styles.tabItem,
                activeTab === 'music' && { borderBottomColor: '#EF4444', backgroundColor: colors.surface }
              ]}
            >
              <Ionicons
                name="musical-notes-outline"
                size={14}
                color={activeTab === 'music' ? '#EF4444' : colors.textMuted}
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  styles.tabItemText,
                  { color: activeTab === 'music' ? '#EF4444' : colors.textSecondary }
                ]}
              >
                Musik & Audio
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActiveTab('sync')}
              style={[
                styles.tabItem,
                activeTab === 'sync' && { borderBottomColor: colors.accent, backgroundColor: colors.surface }
              ]}
            >
              <Ionicons
                name="sync-outline"
                size={14}
                color={activeTab === 'sync' ? colors.accent : colors.textMuted}
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  styles.tabItemText,
                  { color: activeTab === 'sync' ? colors.accent : colors.textSecondary }
                ]}
              >
                Status & Sync
              </Text>
            </TouchableOpacity>
          </View>

          {/* Tab Content */}
          <View style={styles.contentContainer}>
            {/* TAB 1: Sources Catalog */}
            {activeTab === 'sources' && (
              <View style={{ flex: 1 }}>
                {/* Search & Category Filter */}
                <View style={[styles.filterBar, { borderBottomColor: colors.borderSubtle }]}>
                  <View style={[styles.searchBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
                    <Ionicons name="search" size={14} color={colors.textMuted} style={{ marginRight: 6 }} />
                    <TextInput
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                      placeholder="Quellen durchsuchen (z.B. Tagesschau, Spektrum, YouTube)…"
                      placeholderTextColor={colors.textMuted}
                      style={[styles.searchInput, { color: colors.textPrimary }]}
                    />
                    {searchQuery.length > 0 && (
                      <TouchableOpacity onPress={() => setSearchQuery('')}>
                        <Ionicons name="close-circle" size={14} color={colors.textMuted} />
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Preset Buttons */}
                  <View style={styles.presetRow}>
                    <TouchableOpacity
                      onPress={() => handleApplyPreset('all')}
                      style={[styles.presetPill, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}
                    >
                      <Text style={[styles.presetPillText, { color: colors.textPrimary }]}>🌐 Alle an</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleApplyPreset('oerr_only')}
                      style={[styles.presetPill, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}
                    >
                      <Text style={[styles.presetPillText, { color: colors.accent }]}>🏛️ Nur ÖRR</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleApplyPreset('science_culture')}
                      style={[styles.presetPill, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}
                    >
                      <Text style={[styles.presetPillText, { color: colors.textPrimary }]}>🔬 Wissenschaft & Kultur</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Category Pills Bar */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.categoryScroll}
                  style={[styles.categoryScrollBar, { borderBottomColor: colors.borderSubtle }]}
                >
                  <TouchableOpacity
                    onPress={() => setSelectedCategory('all')}
                    style={[
                      styles.categoryChip,
                      {
                        backgroundColor: selectedCategory === 'all' ? colors.accent : colors.surfaceSecondary,
                        borderColor: colors.borderSubtle
                      }
                    ]}
                  >
                    <Text
                      style={[
                        styles.categoryChipText,
                        { color: selectedCategory === 'all' ? '#FFFFFF' : colors.textPrimary }
                      ]}
                    >
                      Alle ({sources.length})
                    </Text>
                  </TouchableOpacity>

                  {(Object.keys(CATEGORY_METADATA) as SourceCategory[]).map(catKey => {
                    const catMeta = CATEGORY_METADATA[catKey];
                    const count = sources.filter(s => s.category === catKey).length;
                    const isSelected = selectedCategory === catKey;

                    return (
                      <TouchableOpacity
                        key={catKey}
                        onPress={() => setSelectedCategory(catKey)}
                        style={[
                          styles.categoryChip,
                          {
                            backgroundColor: isSelected ? catMeta.color : colors.surfaceSecondary,
                            borderColor: colors.borderSubtle
                          }
                        ]}
                      >
                        <Ionicons
                          name={catMeta.icon as any}
                          size={12}
                          color={isSelected ? '#FFFFFF' : catMeta.color}
                          style={{ marginRight: 4 }}
                        />
                        <Text
                          style={[
                            styles.categoryChipText,
                            { color: isSelected ? '#FFFFFF' : colors.textPrimary }
                          ]}
                        >
                          {catMeta.label} ({count})
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* Sources List */}
                {isLoading ? (
                  <View style={styles.centerContainer}>
                    <ActivityIndicator size="small" color={colors.accent} />
                    <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Lade Quellen-Katalog…</Text>
                  </View>
                ) : (
                  <ScrollView style={styles.sourceScroll} contentContainerStyle={styles.sourceScrollContent}>
                    {filteredSources.map(source => {
                      const catMeta = CATEGORY_METADATA[source.category] || { label: source.category, color: colors.accent, icon: 'newspaper-outline' };

                      return (
                        <View
                          key={source.id}
                          style={[
                            styles.sourceRow,
                            {
                              backgroundColor: colors.surfaceSecondary,
                              borderColor: source.enabled ? colors.borderSubtle : 'transparent',
                              opacity: source.enabled ? 1 : 0.6
                            }
                          ]}
                        >
                          <View style={styles.sourceInfo}>
                            <View style={styles.sourceHeaderLine}>
                              <Text style={[styles.sourceName, { color: colors.textPrimary }]} numberOfLines={1}>
                                {source.name}
                              </Text>

                              {source.trustBadge && (
                                <View style={[styles.trustTag, { backgroundColor: colors.accentSubtle, borderColor: colors.borderSubtle }]}>
                                  <Ionicons name="checkmark-circle" size={10} color={colors.accent} style={{ marginRight: 3 }} />
                                  <Text style={[styles.trustTagText, { color: colors.accent }]}>{source.trustBadge}</Text>
                                </View>
                              )}
                            </View>

                            <Text style={[styles.sourceMeta, { color: colors.textMuted }]} numberOfLines={1}>
                              {catMeta.label} • {source.defaultAuthor || 'Redaktion'} • {source.url}
                            </Text>
                          </View>

                          <View style={styles.sourceActions}>
                            {source.isCustom && (
                              <TouchableOpacity
                                onPress={() => handleDeleteCustom(source.id, source.name)}
                                style={[styles.deleteBtn, { backgroundColor: colors.surface }]}
                                accessibilityRole="button"
                                accessibilityLabel={`Eigene Quelle ${source.name} löschen`}
                              >
                                <Ionicons name="trash-outline" size={14} color={colors.danger} />
                              </TouchableOpacity>
                            )}

                            <Switch
                              value={source.enabled}
                              onValueChange={() => handleToggle(source.id)}
                              trackColor={{ false: '#767577', true: colors.accent }}
                              thumbColor="#FFFFFF"
                            />
                          </View>
                        </View>
                      );
                    })}
                  </ScrollView>
                )}
              </View>
            )}

            {/* TAB 2: Import & OPML */}
            {activeTab === 'import' && (
              <ScrollView style={styles.tabScroll} contentContainerStyle={styles.tabScrollContent}>
                {/* 1. Direkte RSS Feed URL hinzufügen */}
                <View style={[styles.sectionBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
                  <View style={styles.sectionHeaderRow}>
                    <Ionicons name="add-circle-outline" size={18} color={colors.accent} style={{ marginRight: 8 }} />
                    <View>
                      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                        1. Beliebigen RSS / Atom Feed hinzufügen
                      </Text>
                      <Text style={[styles.sectionDesc, { color: colors.textMuted }]}>
                        Gib eine beliebige öffentliche Feed-URL ein (z.B. Substack, Heise, Medium, Uni-Blogs, Arxiv).
                      </Text>
                    </View>
                  </View>

                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Feed-URL (XML / RSS / Atom):</Text>
                  <TextInput
                    value={customUrl}
                    onChangeText={setCustomUrl}
                    placeholder="https://beispiel.de/feed.xml"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="none"
                    style={[styles.textInput, { backgroundColor: colors.surface, color: colors.textPrimary, borderColor: colors.borderSubtle }]}
                  />

                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Name der Publikation (optional):</Text>
                  <TextInput
                    value={customName}
                    onChangeText={setCustomName}
                    placeholder="z.B. Heise Developer oder Mein Lieblings-Blog"
                    placeholderTextColor={colors.textMuted}
                    style={[styles.textInput, { backgroundColor: colors.surface, color: colors.textPrimary, borderColor: colors.borderSubtle }]}
                  />

                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Themen-Space zuweisen:</Text>
                  <View style={styles.topicSelectRow}>
                    {(['science_society', 'ai_apple', 'book_mastery', 'philosophy_ethics', 'memes_satire'] as TopicTag[]).map(t => {
                      const spaceMeta = TOPIC_SPACE_MAP[t];
                      const isSel = customTopic === t;
                      return (
                        <TouchableOpacity
                          key={t}
                          onPress={() => setCustomTopic(t)}
                          style={[
                            styles.topicSelectChip,
                            {
                              backgroundColor: isSel ? colors.accent : colors.surface,
                              borderColor: colors.borderSubtle
                            }
                          ]}
                        >
                          <Text style={[styles.topicSelectText, { color: isSel ? '#FFFFFF' : colors.textPrimary }]}>
                            {spaceMeta?.space || t}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <TouchableOpacity
                    onPress={handleAddCustom}
                    disabled={isSubmitting}
                    style={[styles.primaryActionBtn, { backgroundColor: colors.accent }]}
                    accessibilityRole="button"
                    accessibilityLabel="Feed abonnieren"
                  >
                    {isSubmitting ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="add" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                        <Text style={styles.primaryActionBtnText}>Feed zu atmen hinzufügen</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>

                {/* 2. Universal OPML Import */}
                <View style={[styles.sectionBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
                  <View style={styles.sectionHeaderRow}>
                    <Ionicons name="document-text-outline" size={18} color={colors.accent} style={{ marginRight: 8 }} />
                    <View>
                      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                        2. OPML-Import (Feedly, Inoreader, NetNewsWire)
                      </Text>
                      <Text style={[styles.sectionDesc, { color: colors.textMuted }]}>
                        Kopiere den Inhalt deiner exportierten .opml Datei hierhin, um alle Abos in einem Schritt zu übertragen.
                      </Text>
                    </View>
                  </View>

                  <TextInput
                    value={opmlInput}
                    onChangeText={setOpmlInput}
                    placeholder={`<opml version="2.0">\n  <body>\n    <outline type="rss" xmlUrl="https://..." text="..." />\n  </body>\n</opml>`}
                    placeholderTextColor={colors.textMuted}
                    multiline
                    numberOfLines={4}
                    style={[styles.codeTextArea, { backgroundColor: colors.surface, color: colors.textPrimary, borderColor: colors.borderSubtle }]}
                  />

                  <TouchableOpacity
                    onPress={handleImportOPML}
                    disabled={isSubmitting}
                    style={[styles.secondaryActionBtn, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
                    accessibilityRole="button"
                    accessibilityLabel="OPML importieren"
                  >
                    <Ionicons name="download-outline" size={15} color={colors.accent} style={{ marginRight: 6 }} />
                    <Text style={[styles.secondaryActionBtnText, { color: colors.accent }]}>OPML jetzt importieren</Text>
                  </TouchableOpacity>
                </View>

                {/* 3. OPML Export für Datensouveränität */}
                <View style={[styles.sectionBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
                  <View style={styles.sectionHeaderRow}>
                    <Ionicons name="shield-checkmark-outline" size={18} color={colors.accent} style={{ marginRight: 8 }} />
                    <View>
                      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                        3. Digitale Souveränität & OPML Export
                      </Text>
                      <Text style={[styles.sectionDesc, { color: colors.textMuted }]}>
                        Deine Abonnements gehören dir. Exportiere alle aktiven Feeds jederzeit als offenes OPML-Dokument.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.exportBtnRow}>
                    <TouchableOpacity
                      onPress={handleDownloadOPML}
                      style={[styles.exportHalfBtn, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
                    >
                      <Ionicons name="arrow-down-circle-outline" size={15} color={colors.accent} style={{ marginRight: 6 }} />
                      <Text style={[styles.secondaryActionBtnText, { color: colors.accent }]}>.opml herunterladen</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={handleExportOPML}
                      style={[styles.exportHalfBtn, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
                    >
                      <Ionicons name="copy-outline" size={15} color={colors.textPrimary} style={{ marginRight: 6 }} />
                      <Text style={[styles.secondaryActionBtnText, { color: colors.textPrimary }]}>In Zwischenablage</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>
            )}

            {/* TAB: Music & Audio Grounding (iTunes & Spotify) */}
            {activeTab === 'music' && (
              <ScrollView style={styles.tabScroll} contentContainerStyle={styles.tabScrollContent}>
                {/* Intro / Explanation Box */}
                <View style={[styles.sectionBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
                  <View style={styles.sectionHeaderRow}>
                    <Ionicons name="musical-notes" size={20} color="#EF4444" style={{ marginRight: 8 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                        iTunes Search API & Spotify als Empfehlungs-Datenbasis
                      </Text>
                      <Text style={[styles.sectionDesc, { color: colors.textMuted }]}>
                        Nutzt die offene Apple iTunes Datenbank (kostenlos, 30s Audio-Vorschau) und Spotify, um fokussierende Akustik, Ambient und Sound-Synthese in atmen zu erden.
                      </Text>
                    </View>
                  </View>

                  {/* Search Bar */}
                  <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.borderSubtle, marginTop: spacing.md }]}>
                    <Ionicons name="search" size={14} color={colors.textMuted} style={{ marginRight: 6 }} />
                    <TextInput
                      value={musicQuery}
                      onChangeText={handleMusicSearch}
                      placeholder="Künstler oder Track suchen (z.B. Brian Eno, Nils Frahm, Aphex Twin)…"
                      placeholderTextColor={colors.textMuted}
                      style={[styles.searchInput, { color: colors.textPrimary }]}
                    />
                    {isSearchingMusic && <ActivityIndicator size="small" color={colors.accent} />}
                  </View>

                  {/* Preset Pioneer Pills */}
                  <View style={[styles.presetRow, { marginTop: 10 }]}>
                    {[
                      'Brian Eno',
                      'Nils Frahm',
                      'Jon Hopkins',
                      'Suzanne Ciani',
                      'Aphex Twin',
                      'Max Richter'
                    ].map(artist => (
                      <TouchableOpacity
                        key={artist}
                        onPress={() => void handleMusicSearch(artist)}
                        style={[
                          styles.presetPill,
                          {
                            backgroundColor: musicQuery === artist ? '#EF4444' : colors.surface,
                            borderColor: musicQuery === artist ? '#EF4444' : colors.borderSubtle
                          }
                        ]}
                      >
                        <Text style={[styles.presetPillText, { color: musicQuery === artist ? '#FFFFFF' : colors.textPrimary }]}>
                          {artist}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Track Results List */}
                <View style={{ marginTop: spacing.md }}>
                  <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginBottom: 8 }]}>
                    Empfohlene Klang-Referenzen ({musicResults.length})
                  </Text>
                  {musicResults.map(track => (
                    <MusicTrackCard key={track.id} track={track} />
                  ))}
                </View>
              </ScrollView>
            )}

            {/* TAB 3: Status & Sync */}
            {activeTab === 'sync' && (
              <ScrollView style={styles.tabScroll} contentContainerStyle={styles.tabScrollContent}>
                <View style={styles.metricsGrid}>
                  <View style={[styles.metricCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
                    <Text style={[styles.metricValue, { color: colors.accent }]}>{sources.length}</Text>
                    <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Verifizierte Quellen</Text>
                    <Text style={[styles.metricSub, { color: colors.textMuted }]}>ÖRR, Universitäten & Creator</Text>
                  </View>

                  <View style={[styles.metricCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
                    <Text style={[styles.metricValue, { color: '#10B981' }]}>110</Text>
                    <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Kuratierte Artikel</Text>
                    <Text style={[styles.metricSub, { color: colors.textMuted }]}>100% Schema- & Bild-Garantie</Text>
                  </View>

                  <View style={[styles.metricCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
                    <Text style={[styles.metricValue, { color: '#8B5CF6' }]}>0,00 €</Text>
                    <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>Laufende Kosten</Text>
                    <Text style={[styles.metricSub, { color: colors.textMuted }]}>Offline-first & lokale Heuristik</Text>
                  </View>
                </View>

                {/* Live Sync Trigger Box */}
                <View style={[styles.sectionBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle, marginTop: spacing.md }]}>
                  <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                    Manuelle Live-Synchronisation
                  </Text>
                  <Text style={[styles.sectionDesc, { color: colors.textMuted }]}>
                    Synchronisiert die 29 verifizierten RSS- und Atom-Feeds unmittelbar mit der lokalen Datenbank und aktualisiert die Rangordnung.
                  </Text>

                  <TouchableOpacity
                    onPress={handleSyncNow}
                    disabled={isSubmitting}
                    style={[styles.primaryActionBtn, { backgroundColor: colors.accent, marginTop: spacing.md }]}
                  >
                    {isSubmitting ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="refresh" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                        <Text style={styles.primaryActionBtnText}>Live-Feeds jetzt synchronisieren</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>

                {/* Sovereignty & Privacy Principles */}
                <View style={[styles.sectionBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle, marginTop: spacing.md }]}>
                  <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                    Souveränitäts- & Datenschutz-Garantie
                  </Text>
                  <Text style={[styles.privacyText, { color: colors.textSecondary }]}>
                    • <Text style={{ fontWeight: '700' }}>Kein Tracking & keine Werbe-Pixel:</Text> Atem lädt RSS-Feeds direkt ohne Benutzerprofile an Werbenetzwerke zu verkaufen.
                  </Text>
                  <Text style={[styles.privacyText, { color: colors.textSecondary }]}>
                    • <Text style={{ fontWeight: '700' }}>Öffentlich-Rechtliche Priorität:</Text> Qualitätsjournalismus von ARD, ZDF und DLF steht im Zentrum.
                  </Text>
                  <Text style={[styles.privacyText, { color: colors.textSecondary }]}>
                    • <Text style={{ fontWeight: '700' }}>Vollständige Exportierbarkeit:</Text> Alle Notizen exportierst du als Craft-Markdown, alle Feeds als OPML.
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
    maxWidth: 820,
    height: '88%',
    maxHeight: 760,
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
    borderBottomWidth: 0.5
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1
  },
  iconEmblem: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center'
  },
  headerTitle: {
    fontSize: typography.sizes.title2,
    fontWeight: '800'
  },
  headerSubtitle: {
    fontSize: typography.sizes.micro,
    marginTop: 2
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center'
  },
  toast: {
    position: 'absolute',
    top: 64,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: radius.pill,
    zIndex: 99,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: typography.sizes.caption,
    fontWeight: '700'
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 0.5
  },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
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
  filterBar: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 0.5,
    gap: spacing.xs
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 0.5
  },
  searchInput: {
    flex: 1,
    fontSize: typography.sizes.caption,
    padding: 0
  },
  presetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  presetPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 0.5
  },
  presetPillText: {
    fontSize: typography.sizes.micro,
    fontWeight: '700'
  },
  categoryScrollBar: {
    maxHeight: 46,
    borderBottomWidth: 0.5
  },
  categoryScroll: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 8,
    gap: 6
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 0.5
  },
  categoryChipText: {
    fontSize: typography.sizes.micro,
    fontWeight: '700'
  },
  sourceScroll: {
    flex: 1
  },
  sourceScrollContent: {
    padding: spacing.lg,
    gap: 8
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 0.5
  },
  sourceInfo: {
    flex: 1,
    marginRight: spacing.md
  },
  sourceHeaderLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3
  },
  sourceName: {
    fontSize: typography.sizes.bodySmall,
    fontWeight: '700'
  },
  trustTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
    borderWidth: 0.5
  },
  trustTagText: {
    fontSize: 9,
    fontWeight: '800'
  },
  sourceMeta: {
    fontSize: typography.sizes.micro
  },
  sourceActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  deleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center'
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm
  },
  loadingText: {
    fontSize: typography.sizes.caption
  },
  tabScroll: {
    flex: 1
  },
  tabScrollContent: {
    padding: spacing.lg,
    gap: spacing.lg
  },
  sectionBox: {
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 0.5
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md
  },
  sectionTitle: {
    fontSize: typography.sizes.body,
    fontWeight: '800',
    marginBottom: 3
  },
  sectionDesc: {
    fontSize: typography.sizes.caption,
    lineHeight: 18
  },
  inputLabel: {
    fontSize: typography.sizes.micro,
    fontWeight: '700',
    marginBottom: 4,
    marginTop: spacing.sm
  },
  textInput: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm,
    borderWidth: 0.5,
    fontSize: typography.sizes.bodySmall
  },
  codeTextArea: {
    padding: 10,
    borderRadius: radius.sm,
    borderWidth: 0.5,
    fontSize: typography.sizes.micro,
    fontFamily: 'monospace',
    height: 90,
    marginBottom: spacing.sm
  },
  topicSelectRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: spacing.md
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
    paddingVertical: 9,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 0.5
  },
  secondaryActionBtnText: {
    fontSize: typography.sizes.caption,
    fontWeight: '700'
  },
  exportBtnRow: {
    flexDirection: 'row',
    gap: spacing.sm
  },
  exportHalfBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 0.5
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
  }
});
