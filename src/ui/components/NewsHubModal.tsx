import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  FeedSourceItem
} from '../../core/data/sourceRepository';
import { TopicTag, TOPIC_METADATA } from '../../core/domain/types';
import { radius, spacing } from '../theme';

interface NewsHubModalProps {
  visible: boolean;
  onClose: () => void;
  initialTopicFilter?: TopicTag | 'all';
}

const ALL_TOPICS: TopicTag[] = [
  'philosophy_ethics',
  'german_didactics',
  'ai_apple',
  'contemplation_mind',
  'science_society',
  'sound_synthesis',
  'art_aesthetics',
  'book_mastery',
  'health_biohacking',
  'opportunities_growth',
  'memes_satire',
  'youtube_gems'
];

type HubTab = 'topics' | 'sources';

export const NewsHubModal: React.FC<NewsHubModalProps> = ({
  visible,
  onClose,
  initialTopicFilter = 'all'
}) => {
  const { colors, profile, updateTopicWeight, refreshFeed, setActiveTab: setGlobalActiveTab, setActiveFeedOption } = useApp();

  const [activeTab, setActiveTab] = useState<HubTab>('topics');
  const [sources, setSources] = useState<FeedSourceItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTopicFilter, setSelectedTopicFilter] = useState<TopicTag | 'all'>(initialTopicFilter);

  // Custom source form
  const [customName, setCustomName] = useState<string>('');
  const [customUrl, setCustomUrl] = useState<string>('');
  const [customTopic, setCustomTopic] = useState<TopicTag>('philosophy_ethics');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  }, []);

  const loadSources = useCallback(async () => {
    setIsLoading(true);
    try {
      const all = await defaultSourceRepository.getAllSources();
      setSources(all);
    } catch {
      showToast('Quellen konnten nicht geladen werden.');
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (visible) {
      void loadSources();
      if (initialTopicFilter !== 'all') {
        setSelectedTopicFilter(initialTopicFilter);
      }
    }
  }, [visible, initialTopicFilter, loadSources]);

  // Derived counts
  const totalCount = sources.length;
  const activeCount = useMemo(() => sources.filter(s => s.enabled).length, [sources]);

  // Topic weights map
  const topicWeights = useMemo(() => {
    const weights: Record<TopicTag, number> = {} as Record<TopicTag, number>;
    for (const t of ALL_TOPICS) {
      const explicit = profile.explicitInterests?.[t];
      const derived = profile.derivedWeights?.[t];
      weights[t] = typeof explicit === 'number' ? explicit : (typeof derived === 'number' ? derived : 0.6);
    }
    return weights;
  }, [profile.explicitInterests, profile.derivedWeights]);

  // Count active sources per topic
  const sourcesPerTopic = useMemo(() => {
    const counts: Record<TopicTag, number> = {} as Record<TopicTag, number>;
    for (const t of ALL_TOPICS) {
      counts[t] = sources.filter(s => s.enabled && (s.primaryTopic === t || s.topics?.includes(t))).length;
    }
    return counts;
  }, [sources]);

  // Handle source toggle
  const handleToggleSource = async (sourceId: string, currentEnabled: boolean) => {
    const nextStatus = !currentEnabled;
    setSources(prev => prev.map(s => (s.id === sourceId ? { ...s, enabled: nextStatus } : s)));
    try {
      await defaultSourceRepository.toggleSource(sourceId, nextStatus);
      void refreshFeed();
    } catch {
      setSources(prev => prev.map(s => (s.id === sourceId ? { ...s, enabled: currentEnabled } : s)));
      showToast('Status konnte nicht gespeichert werden.');
    }
  };

  // Bulk activate/pause
  const handleBulkToggle = async (enable: boolean) => {
    setIsLoading(true);
    try {
      for (const s of filteredSources) {
        if (s.enabled !== enable) {
          await defaultSourceRepository.toggleSource(s.id, enable);
        }
      }
      await loadSources();
      void refreshFeed();
      showToast(enable ? 'Alle sichtbaren Quellen aktiviert' : 'Alle sichtbaren Quellen pausiert');
    } catch {
      showToast('Massen-Aktualisierung fehlgeschlagen.');
    } finally {
      setIsLoading(false);
    }
  };

  // Add custom source
  const handleAddCustomSource = async () => {
    if (!customUrl.trim()) {
      showToast('Bitte eine gültige RSS/Atom-URL eingeben.');
      return;
    }
    setIsSubmitting(true);
    try {
      await defaultSourceRepository.addCustomSource({
        name: customName.trim() || customUrl.trim(),
        url: customUrl.trim(),
        primaryTopic: customTopic
      });
      setCustomName('');
      setCustomUrl('');
      await loadSources();
      void refreshFeed();
      showToast('✓ Eigene Quelle erfolgreich hinzugefügt!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Fehler beim Hinzufügen.';
      showToast(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete custom source
  const handleDeleteCustomSource = async (sourceId: string) => {
    try {
      await defaultSourceRepository.removeCustomSource(sourceId);
      await loadSources();
      void refreshFeed();
      showToast('Quelle entfernt.');
    } catch {
      showToast('Entfernen fehlgeschlagen.');
    }
  };

  // Filtered sources for Tab 2
  const filteredSources = useMemo(() => {
    return sources.filter(s => {
      if (selectedTopicFilter !== 'all') {
        const matchesTopic = s.primaryTopic === selectedTopicFilter || s.topics?.includes(selectedTopicFilter);
        if (!matchesTopic) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = s.name.toLowerCase().includes(q);
        const matchesUrl = s.url.toLowerCase().includes(q);
        if (!matchesName && !matchesUrl) return false;
      }
      return true;
    });
  }, [sources, selectedTopicFilter, searchQuery]);

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.borderSubtle }]}>
          <View style={styles.headerTitleGroup}>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Quellen & Themen</Text>
            <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
              {activeCount} von {totalCount} Quellen aktiv • Feed-Kuration & Themengewichtung
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity
              onPress={() => {
                setGlobalActiveTab('feed');
                setActiveFeedOption('live_news');
                onClose();
              }}
              style={[styles.jumpToNewsBtn, { backgroundColor: colors.accentSubtle, borderColor: colors.accent }]}
              accessibilityRole="button"
              accessibilityLabel="Zu den Live-Nachrichten wechseln"
            >
              <Ionicons name="flash" size={14} color={colors.accent} style={{ marginRight: 4 }} />
              <Text style={[styles.jumpToNewsBtnText, { color: colors.accent }]}>
                ⚡ Zum Live-News-Feed
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeButton, { backgroundColor: colors.surfaceSecondary }]}
              accessibilityRole="button"
              accessibilityLabel="News-Hub schließen"
            >
              <Ionicons name="close" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Tab Bar (Only 2 Tabs) */}
        <View style={[styles.tabBar, { backgroundColor: colors.surface, borderBottomColor: colors.borderSubtle }]}>
          <TouchableOpacity
            onPress={() => setActiveTab('topics')}
            style={[
              styles.tabItem,
              activeTab === 'topics' && [styles.activeTabItem, { borderBottomColor: colors.accent }]
            ]}
            accessibilityRole="button"
            accessibilityLabel="Themen wählen"
          >
            <Ionicons
              name="compass-outline"
              size={18}
              color={activeTab === 'topics' ? colors.accent : colors.textMuted}
              style={{ marginRight: 8 }}
            />
            <Text
              style={[
                styles.tabText,
                { color: activeTab === 'topics' ? colors.accent : colors.textMuted, fontWeight: activeTab === 'topics' ? '700' : '500' }
              ]}
            >
              Themen wählen
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab('sources')}
            style={[
              styles.tabItem,
              activeTab === 'sources' && [styles.activeTabItem, { borderBottomColor: colors.accent }]
            ]}
            accessibilityRole="button"
            accessibilityLabel="Quellen & Eigene Feeds"
          >
            <Ionicons
              name="options-outline"
              size={18}
              color={activeTab === 'sources' ? colors.accent : colors.textMuted}
              style={{ marginRight: 8 }}
            />
            <Text
              style={[
                styles.tabText,
                { color: activeTab === 'sources' ? colors.accent : colors.textMuted, fontWeight: activeTab === 'sources' ? '700' : '500' }
              ]}
            >
              Quellen & Eigene Feeds
            </Text>
          </TouchableOpacity>
        </View>

        {/* Toast Feedback */}
        {toastMessage && (
          <View style={[styles.toast, { backgroundColor: colors.accent }]}>
            <Text style={styles.toastText}>{toastMessage}</Text>
          </View>
        )}

        {/* Content Area */}
        {isLoading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={[styles.loadingText, { color: colors.textMuted }]}>Quellen werden geladen…</Text>
          </View>
        ) : activeTab === 'topics' ? (
          /* TAB 1: Themen wählen */
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.topicsGrid}>
              {ALL_TOPICS.map(topic => {
                const meta = TOPIC_METADATA[topic];
                const weight = topicWeights[topic];
                const isActive = weight > 0;
                const activeSourcesInTopic = sourcesPerTopic[topic] || 0;

                return (
                  <View
                    key={topic}
                    style={[
                      styles.topicCard,
                      {
                        backgroundColor: colors.surface,
                        borderColor: isActive ? colors.accent : colors.borderSubtle
                      }
                    ]}
                  >
                    <View style={styles.topicCardHeader}>
                      <View style={styles.topicIconTitleRow}>
                        <Ionicons
                          name={(meta?.icon as any) || 'compass-outline'}
                          size={20}
                          color={isActive ? colors.accent : colors.textMuted}
                          style={{ marginRight: 8 }}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.topicTitle, { color: colors.textPrimary }]}>{meta?.label || topic}</Text>
                          <Text style={[styles.topicSourcesCount, { color: colors.textMuted }]}>
                            {activeSourcesInTopic} aktive Quellen
                          </Text>
                        </View>
                      </View>
                      <Switch
                        value={isActive}
                        onValueChange={async nextVal => {
                          const newWeight = nextVal ? 0.6 : 0;
                          await updateTopicWeight(topic, newWeight);
                          showToast(nextVal ? `✓ ${meta?.label || topic} aktiviert` : `${meta?.label || topic} pausiert`);
                        }}
                        trackColor={{ false: colors.borderSubtle, true: colors.accent }}
                      />
                    </View>

                    {meta?.description ? (
                      <Text style={[styles.topicDescription, { color: colors.textSecondary }]} numberOfLines={2}>
                        {meta.description}
                      </Text>
                    ) : null}

                    {/* Weight Presets */}
                    <View style={styles.presetsRow}>
                      <TouchableOpacity
                        onPress={async () => {
                          await updateTopicWeight(topic, 0);
                          showToast(`${meta?.label || topic}: Aus (0%)`);
                        }}
                        style={[
                          styles.presetPill,
                          {
                            backgroundColor: weight === 0 ? colors.borderSubtle : colors.surfaceSecondary,
                            borderColor: colors.borderSubtle
                          }
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`${meta?.label || topic} ausschalten`}
                      >
                        <Text style={[styles.presetText, { color: weight === 0 ? colors.textPrimary : colors.textMuted }]}>
                          Aus (0%)
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={async () => {
                          await updateTopicWeight(topic, 0.6);
                          showToast(`${meta?.label || topic}: Normal (60%)`);
                        }}
                        style={[
                          styles.presetPill,
                          {
                            backgroundColor: weight > 0 && weight <= 0.75 ? colors.accentSubtle : colors.surfaceSecondary,
                            borderColor: weight > 0 && weight <= 0.75 ? colors.accent : colors.borderSubtle
                          }
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`${meta?.label || topic} auf Normal (60%) setzen`}
                      >
                        <Text
                          style={[
                            styles.presetText,
                            { color: weight > 0 && weight <= 0.75 ? colors.accent : colors.textMuted }
                          ]}
                        >
                          Normal (60%)
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={async () => {
                          await updateTopicWeight(topic, 0.95);
                          showToast(`${meta?.label || topic}: Fokus (95%)`);
                        }}
                        style={[
                          styles.presetPill,
                          {
                            backgroundColor: weight > 0.75 ? colors.accentSubtle : colors.surfaceSecondary,
                            borderColor: weight > 0.75 ? colors.accent : colors.borderSubtle
                          }
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`${meta?.label || topic} auf Fokus (95%) setzen`}
                      >
                        <Text
                          style={[
                            styles.presetText,
                            { color: weight > 0.75 ? colors.accent : colors.textMuted }
                          ]}
                        >
                          Fokus (95%)
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Jump to sources filtered by this topic */}
                    <TouchableOpacity
                      onPress={() => {
                        setSelectedTopicFilter(topic);
                        setActiveTab('sources');
                      }}
                      style={[styles.jumpButton, { borderTopColor: colors.borderSubtle }]}
                      accessibilityRole="button"
                      accessibilityLabel={`Quellen für ${meta?.label || topic} im Detail ansehen`}
                    >
                      <Text style={[styles.jumpButtonText, { color: colors.accent }]}>Quellen im Detail →</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        ) : (
          /* TAB 2: Quellen & Eigene Feeds */
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Top Card: Eigene Quelle hinzufügen */}
            <View style={[styles.addCustomCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
              <View style={styles.addCustomHeader}>
                <Ionicons name="add-circle-outline" size={20} color={colors.accent} style={{ marginRight: 8 }} />
                <Text style={[styles.addCustomTitle, { color: colors.textPrimary }]}>Eigene Quelle hinzufügen</Text>
              </View>

              <TextInput
                style={[styles.input, { backgroundColor: colors.surfaceSecondary, color: colors.textPrimary, borderColor: colors.borderSubtle }]}
                placeholder="Name der Quelle (z. B. Mein Blog)"
                placeholderTextColor={colors.textMuted}
                value={customName}
                onChangeText={setCustomName}
              />

              <TextInput
                style={[styles.input, { backgroundColor: colors.surfaceSecondary, color: colors.textPrimary, borderColor: colors.borderSubtle }]}
                placeholder="RSS/Atom Feed-URL (https://…)"
                placeholderTextColor={colors.textMuted}
                value={customUrl}
                onChangeText={setCustomUrl}
                autoCapitalize="none"
                keyboardType="url"
              />

              {/* Topic Selector Pills */}
              <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>Themenbereich:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalPills}>
                {ALL_TOPICS.map(topic => (
                  <TouchableOpacity
                    key={topic}
                    onPress={() => setCustomTopic(topic)}
                    style={[
                      styles.filterPill,
                      {
                        backgroundColor: customTopic === topic ? colors.accent : colors.surfaceSecondary,
                        borderColor: customTopic === topic ? colors.accent : colors.borderSubtle
                      }
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterPillText,
                        { color: customTopic === topic ? '#FFFFFF' : colors.textPrimary }
                      ]}
                    >
                      {TOPIC_METADATA[topic]?.label || topic}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <TouchableOpacity
                onPress={handleAddCustomSource}
                disabled={isSubmitting}
                style={[styles.submitButton, { backgroundColor: colors.accent }]}
                accessibilityRole="button"
                accessibilityLabel="Quelle speichern"
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.submitButtonText}>Quelle speichern</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Filter Row: Search & Topic Filter Pills & Bulk Actions */}
            <View style={styles.filterSection}>
              {/* Search input */}
              <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
                <Ionicons name="search-outline" size={16} color={colors.textMuted} style={{ marginRight: 8 }} />
                <TextInput
                  style={[styles.searchInput, { color: colors.textPrimary }]}
                  placeholder="Quelle oder Domain suchen…"
                  placeholderTextColor={colors.textMuted}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Topic Filter Pills */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalPills}>
                <TouchableOpacity
                  onPress={() => setSelectedTopicFilter('all')}
                  style={[
                    styles.filterPill,
                    {
                      backgroundColor: selectedTopicFilter === 'all' ? colors.accent : colors.surfaceSecondary,
                      borderColor: selectedTopicFilter === 'all' ? colors.accent : colors.borderSubtle
                    }
                  ]}
                >
                  <Text
                    style={[
                      styles.filterPillText,
                      { color: selectedTopicFilter === 'all' ? '#FFFFFF' : colors.textPrimary }
                    ]}
                  >
                    Alle ({sources.length})
                  </Text>
                </TouchableOpacity>

                {ALL_TOPICS.map(topic => (
                  <TouchableOpacity
                    key={topic}
                    onPress={() => setSelectedTopicFilter(topic)}
                    style={[
                      styles.filterPill,
                      {
                        backgroundColor: selectedTopicFilter === topic ? colors.accent : colors.surfaceSecondary,
                        borderColor: selectedTopicFilter === topic ? colors.accent : colors.borderSubtle
                      }
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterPillText,
                        { color: selectedTopicFilter === topic ? '#FFFFFF' : colors.textPrimary }
                      ]}
                    >
                      {TOPIC_METADATA[topic]?.label || topic} ({sourcesPerTopic[topic] || 0})
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Bulk Action Buttons */}
              <View style={styles.bulkActionRow}>
                <TouchableOpacity
                  onPress={() => handleBulkToggle(true)}
                  style={[styles.bulkButton, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}
                  accessibilityRole="button"
                  accessibilityLabel="Alle sichtbaren Quellen aktivieren"
                >
                  <Ionicons name="checkmark-done-outline" size={15} color={colors.accent} style={{ marginRight: 4 }} />
                  <Text style={[styles.bulkButtonText, { color: colors.accent }]}>Alle aktivieren</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handleBulkToggle(false)}
                  style={[styles.bulkButton, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}
                  accessibilityRole="button"
                  accessibilityLabel="Alle sichtbaren Quellen pausieren"
                >
                  <Ionicons name="pause-outline" size={15} color={colors.textMuted} style={{ marginRight: 4 }} />
                  <Text style={[styles.bulkButtonText, { color: colors.textMuted }]}>Alle pausieren</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Sources List */}
            <View style={styles.sourcesList}>
              {filteredSources.length === 0 ? (
                <View style={[styles.emptyContainer, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
                  <Ionicons name="search-outline" size={32} color={colors.textMuted} style={{ marginBottom: 8 }} />
                  <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Keine Quellen gefunden</Text>
                  <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
                    Passe den Suchfilter oder die Themenauswahl an.
                  </Text>
                </View>
              ) : (
                filteredSources.map(source => {
                  let domain = '';
                  try {
                    domain = new URL(source.url).hostname.replace(/^www\./, '');
                  } catch {
                    domain = source.url;
                  }

                  const topicLabel = TOPIC_METADATA[source.primaryTopic]?.label || source.primaryTopic;

                  return (
                    <View
                      key={source.id}
                      style={[
                        styles.sourceCard,
                        {
                          backgroundColor: colors.surface,
                          borderColor: source.enabled ? colors.borderSubtle : colors.borderSubtle,
                          opacity: source.enabled ? 1 : 0.6
                        }
                      ]}
                    >
                      <View style={styles.sourceCardLeft}>
                        <View style={styles.sourceTitleRow}>
                          <Text style={[styles.sourceName, { color: colors.textPrimary }]} numberOfLines={1}>
                            {source.name}
                          </Text>
                          {source.isCustom && (
                            <View style={[styles.badge, { backgroundColor: colors.accentSubtle }]}>
                              <Text style={[styles.badgeText, { color: colors.accent }]}>Eigene</Text>
                            </View>
                          )}
                        </View>

                        <Text style={[styles.sourceDomain, { color: colors.textMuted }]} numberOfLines={1}>
                          {domain}
                        </Text>

                        <View style={styles.badgesRow}>
                          <View style={[styles.badge, { backgroundColor: colors.surfaceSecondary }]}>
                            <Text style={[styles.badgeText, { color: colors.textSecondary }]}>
                              {source.language?.toUpperCase() || 'DE'}
                            </Text>
                          </View>
                          <View style={[styles.badge, { backgroundColor: colors.surfaceSecondary }]}>
                            <Text style={[styles.badgeText, { color: colors.textSecondary }]} numberOfLines={1}>
                              {topicLabel}
                            </Text>
                          </View>
                        </View>
                      </View>

                      <View style={styles.sourceCardRight}>
                        {source.isCustom && (
                          <TouchableOpacity
                            onPress={() => handleDeleteCustomSource(source.id)}
                            style={styles.deleteButton}
                            accessibilityRole="button"
                            accessibilityLabel={`Eigene Quelle ${source.name} löschen`}
                          >
                            <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
                          </TouchableOpacity>
                        )}
                        <Switch
                          value={source.enabled}
                          onValueChange={() => handleToggleSource(source.id, source.enabled)}
                          trackColor={{ false: colors.borderSubtle, true: colors.accent }}
                        />
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </ScrollView>
        )}
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
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3
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
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent'
  },
  activeTabItem: {},
  tabText: {
    fontSize: 14
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: 14
  },
  toast: {
    position: 'absolute',
    top: 110,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.pill,
    zIndex: 999
  },
  toastText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12
  },
  // Tab 1: Topics
  topicsGrid: {
    gap: spacing.md
  },
  topicCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md
  },
  topicCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  topicIconTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.sm
  },
  topicTitle: {
    fontSize: 15,
    fontWeight: '700'
  },
  topicSourcesCount: {
    fontSize: 11,
    marginTop: 1
  },
  topicDescription: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: spacing.xs,
    marginBottom: spacing.sm
  },
  presetsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: spacing.xs
  },
  presetPill: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  presetText: {
    fontSize: 11,
    fontWeight: '600'
  },
  jumpButton: {
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    alignItems: 'flex-end'
  },
  jumpButtonText: {
    fontSize: 12,
    fontWeight: '700'
  },
  // Tab 2: Sources
  addCustomCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md
  },
  addCustomHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm
  },
  addCustomTitle: {
    fontSize: 15,
    fontWeight: '700'
  },
  input: {
    height: 40,
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    fontSize: 13,
    marginBottom: spacing.xs
  },
  sectionSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: spacing.xs,
    marginBottom: 4
  },
  horizontalPills: {
    flexDirection: 'row',
    marginBottom: spacing.sm
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    marginRight: 8
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600'
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 38,
    borderRadius: radius.sm,
    marginTop: 4
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13
  },
  filterSection: {
    marginBottom: spacing.md,
    gap: spacing.xs
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.xs
  },
  searchInput: {
    flex: 1,
    fontSize: 13
  },
  bulkActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4
  },
  bulkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1
  },
  bulkButtonText: {
    fontSize: 12,
    fontWeight: '600'
  },
  sourcesList: {
    gap: spacing.xs
  },
  sourceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1
  },
  sourceCardLeft: {
    flex: 1,
    marginRight: spacing.sm
  },
  sourceTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  sourceName: {
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 1
  },
  sourceDomain: {
    fontSize: 11,
    marginTop: 1
  },
  badgesRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.xs
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600'
  },
  sourceCardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  deleteButton: {
    padding: 4
  },
  emptyContainer: {
    padding: spacing.xl,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700'
  },
  emptySubtitle: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center'
  },
  jumpToNewsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1
  },
  jumpToNewsBtnText: {
    fontSize: 12,
    fontWeight: '700'
  }
});
