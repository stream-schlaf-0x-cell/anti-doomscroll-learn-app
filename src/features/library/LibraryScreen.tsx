import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../core/context/AppContext';
import { TopicBadge } from '../../ui/components/TopicBadge';
import { ReadingTimeBadge } from '../../ui/components/ReadingTimeBadge';
import { typography, radius, spacing } from '../../ui/theme';
import { generateCraftMarkdown, copyToClipboard } from '../../core/export/craftExport';

function formatRelativeTime(isoString?: string): string {
  if (!isoString) return 'Heute';
  try {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours < 1) return 'vor kurzem';
    if (diffHours < 24) return `vor ${diffHours} Std.`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'gestern';
    if (diffDays < 7) return `vor ${diffDays} Tagen`;
    return new Date(isoString).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
  } catch {
    return 'Heute';
  }
}

export const LibraryScreen: React.FC = () => {
  const {
    savedArticles,
    dailyEdition,
    discoveryItems,
    interactions,
    colors,
    openArticle,
    toggleSaveItem,
    setActiveTab
  } = useApp();

  const [activeSection, setActiveSection] = useState<'saved' | 'notes'>('saved');
  const [filter, setFilter] = useState<'all' | 'unread' | 'completed'>('all');
  const [copied, setCopied] = useState<boolean>(false);

  const handleExportCraft = async () => {
    const md = generateCraftMarkdown(savedItems, interactions);
    const success = await copyToClipboard(md);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  // Map of all known articles
  const allArticlesMap = useMemo(() => {
    const map = new Map<string, any>();
    for (const art of savedArticles) {
      map.set(art.id, art);
    }
    for (const item of [...dailyEdition, ...discoveryItems]) {
      if (!map.has(item.id)) {
        map.set(item.id, item);
      }
    }
    return map;
  }, [savedArticles, dailyEdition, discoveryItems]);

  // Decoupled library: persistent saved articles
  const savedItems = useMemo(() => {
    const map = new Map<string, any>();
    for (const art of savedArticles) {
      if (interactions[art.id]?.saved !== false) {
        map.set(art.id, art);
      }
    }
    for (const item of [...dailyEdition, ...discoveryItems]) {
      if (interactions[item.id]?.saved) {
        map.set(item.id, item);
      }
    }
    return Array.from(map.values());
  }, [savedArticles, dailyEdition, discoveryItems, interactions]);

  // Items with user notes
  const itemsWithNotes = useMemo(() => {
    const list: { article: any; notes: any[] }[] = [];
    for (const [id, interaction] of Object.entries(interactions)) {
      if (interaction.userNotes && interaction.userNotes.length > 0) {
        const article = allArticlesMap.get(id);
        if (article) {
          list.push({ article, notes: interaction.userNotes });
        }
      }
    }
    return list;
  }, [interactions, allArticlesMap]);

  // Apply sub-filter to saved articles
  const filteredSaved = savedItems.filter(item => {
    const isCompleted = (interactions[item.id]?.completedAt !== undefined) ||
      (interactions[item.id]?.progressPercent ?? 0) >= 95;

    if (filter === 'unread') return !isCompleted;
    if (filter === 'completed') return isCompleted;
    return true;
  });

  const totalNotesCount = itemsWithNotes.reduce((sum, item) => sum + item.notes.length, 0);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.borderSubtle }]}>
        <View style={styles.headerInner}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              Bibliothek & Notizbuch
            </Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              {savedItems.length} gemerkt • {totalNotesCount} eigene Reflexionen
            </Text>
          </View>

          <TouchableOpacity
            onPress={handleExportCraft}
            style={[styles.exportCraftBtn, { backgroundColor: colors.accentSubtle, borderColor: colors.borderSubtle }]}
            activeOpacity={0.8}
            accessibilityLabel="Gedanken für Craft Docs exportieren"
          >
            <Ionicons name={copied ? 'checkmark-circle' : 'copy-outline'} size={14} color={colors.accent} style={{ marginRight: 5 }} />
            <Text style={[styles.exportCraftBtnText, { color: colors.accent }]}>
              {copied ? 'Kopiert!' : 'Craft Export'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Section Switcher: Gemerkt vs Meine Gedanken */}
      <View style={[styles.sectionRow, { borderBottomColor: colors.borderSubtle }]}>
        <View style={styles.sectionRowInner}>
          <TouchableOpacity
            onPress={() => setActiveSection('saved')}
            style={[
              styles.sectionTab,
              activeSection === 'saved' && { borderBottomColor: colors.accent, borderBottomWidth: 2 }
            ]}
          >
            <Ionicons
              name={activeSection === 'saved' ? 'bookmark' : 'bookmark-outline'}
              size={16}
              color={activeSection === 'saved' ? colors.accent : colors.textMuted}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.sectionTabText,
                { color: activeSection === 'saved' ? colors.accent : colors.textMuted }
              ]}
            >
              Gemerkt ({savedItems.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveSection('notes')}
            style={[
              styles.sectionTab,
              activeSection === 'notes' && { borderBottomColor: colors.accent, borderBottomWidth: 2 }
            ]}
          >
            <Ionicons
              name={activeSection === 'notes' ? 'create' : 'create-outline'}
              size={16}
              color={activeSection === 'notes' ? colors.accent : colors.textMuted}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.sectionTabText,
                { color: activeSection === 'notes' ? colors.accent : colors.textMuted }
              ]}
            >
              Meine Gedanken ({totalNotesCount})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter Tabs for Saved Articles */}
      {activeSection === 'saved' && savedItems.length > 0 && (
        <View style={styles.filterRow}>
          <View style={styles.filterRowInner}>
            {[
              { id: 'all', label: 'Alle' },
              { id: 'unread', label: 'Ungelesen' },
              { id: 'completed', label: 'Gelesen' }
            ].map(f => (
              <TouchableOpacity
                key={f.id}
                onPress={() => setFilter(f.id as any)}
                style={[
                  styles.filterPill,
                  {
                    backgroundColor: filter === f.id ? colors.accent : colors.surface,
                    borderColor: filter === f.id ? colors.accent : colors.borderSubtle
                  }
                ]}
              >
                <Text
                  style={[
                    styles.filterText,
                    { color: filter === f.id ? '#FFFFFF' : colors.textSecondary }
                  ]}
                >
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Scrollable Content */}
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.contentInner}>
          {activeSection === 'saved' ? (
            savedItems.length === 0 ? (
              <View style={[styles.emptyContainer, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
                <Ionicons name="bookmark-outline" size={38} color={colors.textMuted} style={{ marginBottom: spacing.md }} />
                <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                  Noch keine Artikel gemerkt
                </Text>
                <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                  Tippe im Atem-Feed auf das Lesezeichen-Symbol, um lesenswerte Gedanken dauerhaft in deiner Offline-Bibliothek zu sichern.
                </Text>
                <TouchableOpacity
                  onPress={() => setActiveTab('feed')}
                  style={[styles.feedButton, { backgroundColor: colors.accent }]}
                >
                  <Text style={styles.feedButtonText}>Zum Entdecken-Feed</Text>
                </TouchableOpacity>
              </View>
            ) : filteredSaved.length === 0 ? (
              <View style={[styles.emptyContainer, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
                <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                  Keine Treffer im Filter
                </Text>
                <TouchableOpacity onPress={() => setFilter('all')}>
                  <Text style={[styles.resetFilterText, { color: colors.accent }]}>Filter zurücksetzen</Text>
                </TouchableOpacity>
              </View>
            ) : (
              filteredSaved.map(item => {
                const progress = interactions[item.id]?.progressPercent ?? 0;
                const isCompleted = (interactions[item.id]?.completedAt !== undefined) || progress >= 95;

                return (
                  <TouchableOpacity
                    key={item.id}
                    activeOpacity={0.85}
                    onPress={() => openArticle(item.id)}
                    style={[styles.itemCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
                  >
                    <View style={styles.cardHeader}>
                      <TopicBadge topic={item.primaryTopic} size="sm" />
                      <View style={{ width: 6 }} />
                      <ReadingTimeBadge minutes={item.estimatedReadingMinutes} />
                      <View style={{ flex: 1 }} />
                      <TouchableOpacity
                        onPress={() => toggleSaveItem(item.id)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Ionicons name="bookmark" size={17} color={colors.accent} />
                      </TouchableOpacity>
                    </View>

                    <Text style={[styles.itemTitle, { color: colors.textPrimary }]}>
                      {item.title}
                    </Text>

                    <Text style={[styles.itemSubtitle, { color: colors.textSecondary }]} numberOfLines={2}>
                      {item.subtitle}
                    </Text>

                    <View style={[styles.cardFooter, { borderTopColor: colors.borderSubtle }]}>
                      {isCompleted ? (
                        <View style={styles.statusRow}>
                          <Ionicons name="checkmark-circle" size={13} color={colors.success} style={{ marginRight: 4 }} />
                          <Text style={[styles.statusText, { color: colors.success }]}>Vollständig gelesen</Text>
                        </View>
                      ) : progress > 0 ? (
                        <View style={styles.statusRow}>
                          <Ionicons name="time-outline" size={13} color={colors.accent} style={{ marginRight: 4 }} />
                          <Text style={[styles.statusText, { color: colors.accent }]}>{progress}% gelesen</Text>
                        </View>
                      ) : (
                        <Text style={[styles.statusText, { color: colors.textMuted }]}>Noch nicht gelesen</Text>
                      )}

                      <Text style={[styles.publisherText, { color: colors.textMuted }]}>
                        {item.sourceReferences[0]?.publisher ?? ''}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            )
          ) : (
            /* Notes Section */
            itemsWithNotes.length === 0 ? (
              <View style={[styles.emptyContainer, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
                <Ionicons name="create-outline" size={38} color={colors.textMuted} style={{ marginBottom: spacing.md }} />
                <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                  Noch keine Gedanken festgehalten
                </Text>
                <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                  Nutze das „✍️ Replik schreiben“-Feld auf den Feed-Karten, um Einwände, Unterrichtsideen oder eigene Thesen direkt beim Lesen zu notieren.
                </Text>
                <TouchableOpacity
                  onPress={() => setActiveTab('feed')}
                  style={[styles.feedButton, { backgroundColor: colors.accent }]}
                >
                  <Text style={styles.feedButtonText}>Zum Entdecken-Feed</Text>
                </TouchableOpacity>
              </View>
            ) : (
              itemsWithNotes.map(({ article, notes }) => (
                <View
                  key={article.id}
                  style={[styles.itemCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
                >
                  <TouchableOpacity activeOpacity={0.85} onPress={() => openArticle(article.id)}>
                    <View style={styles.cardHeader}>
                      <TopicBadge topic={article.primaryTopic} size="sm" />
                      <View style={{ flex: 1 }} />
                      <Text style={[styles.publisherText, { color: colors.accent }]}>
                        Artikel öffnen →
                      </Text>
                    </View>
                    <Text style={[styles.itemTitle, { color: colors.textPrimary }]}>
                      {article.title}
                    </Text>
                  </TouchableOpacity>

                  {/* Render Notes */}
                  <View style={styles.notesGroup}>
                    {notes.map(n => (
                      <View
                        key={n.id}
                        style={[styles.noteBubble, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}
                      >
                        <View style={styles.noteBubbleHeader}>
                          <View style={[styles.noteTagBadge, { backgroundColor: colors.accentSubtle }]}>
                            <Text style={[styles.noteTagText, { color: colors.accent }]}>
                              {n.tag === 'einwand' ? '⚡️ Einwand' : n.tag === 'unterricht' ? '🏫 Unterricht' : n.tag === 'these' ? '💡 Eigene These' : '📝 Notiz'}
                            </Text>
                          </View>
                          <Text style={[styles.noteTime, { color: colors.textMuted }]}>
                            {formatRelativeTime(n.createdAt)}
                          </Text>
                        </View>
                        <Text style={[styles.noteBody, { color: colors.textPrimary }]}>
                          {n.text}
                        </Text>

                        {/* Sparring Reply if present */}
                        {n.sparringReply && (
                          <View style={[styles.noteSparringBox, { backgroundColor: colors.surface, borderLeftColor: colors.accent }]}>
                            <View style={styles.noteSparringHeader}>
                              <Ionicons name="chatbubbles-outline" size={12} color={colors.accent} style={{ marginRight: 4 }} />
                              <Text style={[styles.noteSparringHandle, { color: colors.accent }]}>
                                {n.sparringReply.authorHandle} ({n.sparringReply.authorBadge || 'Sparring'})
                              </Text>
                            </View>
                            <Text style={[styles.noteSparringText, { color: colors.textSecondary }]}>
                              {n.sparringReply.text}
                            </Text>
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                </View>
              ))
            )
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  header: {
    paddingHorizontal: spacing.pageHorizontal,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 0.5
  },
  headerInner: {
    maxWidth: 780,
    width: '100%',
    alignSelf: 'center'
  },
  title: {
    fontSize: typography.sizes.title1,
    fontWeight: '800'
  },
  subtitle: {
    fontSize: typography.sizes.micro,
    marginTop: 2
  },
  sectionRow: {
    borderBottomWidth: 0.5
  },
  sectionRowInner: {
    flexDirection: 'row',
    maxWidth: 780,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: spacing.pageHorizontal
  },
  sectionTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    marginRight: 24,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent'
  },
  sectionTabText: {
    fontSize: 13,
    fontWeight: '700'
  },
  filterRow: {
    paddingVertical: spacing.sm
  },
  filterRowInner: {
    flexDirection: 'row',
    maxWidth: 780,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: spacing.pageHorizontal,
    gap: 8
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 0.5
  },
  filterText: {
    fontSize: typography.sizes.micro,
    fontWeight: '600'
  },
  scrollContent: {
    paddingHorizontal: spacing.pageHorizontal,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl
  },
  contentInner: {
    maxWidth: 780,
    width: '100%',
    alignSelf: 'center'
  },
  emptyContainer: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.xxl,
    alignItems: 'center',
    marginTop: spacing.xl
  },
  emptyTitle: {
    fontSize: typography.sizes.title2,
    fontWeight: '700',
    marginBottom: spacing.xs,
    textAlign: 'center'
  },
  emptySubtitle: {
    fontSize: typography.sizes.bodySmall,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: spacing.lg,
    maxWidth: 320
  },
  feedButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: radius.md
  },
  feedButtonText: {
    color: '#FFFFFF',
    fontSize: typography.sizes.bodySmall,
    fontWeight: '600'
  },
  resetFilterText: {
    fontSize: typography.sizes.bodySmall,
    fontWeight: '600',
    marginTop: spacing.sm
  },
  itemCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    marginBottom: spacing.md
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs
  },
  itemTitle: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
    marginBottom: 4
  },
  itemSubtitle: {
    fontSize: typography.sizes.bodySmall,
    lineHeight: 19,
    marginBottom: spacing.sm
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.xs,
    borderTopWidth: 0.5
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  statusText: {
    fontSize: typography.sizes.micro,
    fontWeight: '600'
  },
  publisherText: {
    fontSize: typography.sizes.micro,
    fontWeight: '600'
  },
  notesGroup: {
    marginTop: spacing.sm,
    gap: 8
  },
  noteBubble: {
    padding: 10,
    borderRadius: radius.md,
    borderWidth: 0.5
  },
  noteBubbleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  noteTagBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  noteTagText: {
    fontSize: 10,
    fontWeight: '700'
  },
  noteTime: {
    fontSize: 10
  },
  noteBody: {
    fontSize: 13,
    lineHeight: 18
  },
  exportCraftBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 0.5
  },
  exportCraftBtnText: {
    fontSize: typography.sizes.caption,
    fontWeight: '700'
  },
  noteSparringBox: {
    marginTop: 8,
    paddingLeft: 10,
    borderLeftWidth: 2,
    paddingVertical: 4,
    borderRadius: 4
  },
  noteSparringHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2
  },
  noteSparringHandle: {
    fontSize: 11,
    fontWeight: '700'
  },
  noteSparringText: {
    fontSize: 12,
    lineHeight: 17,
    fontStyle: 'italic'
  }
});
