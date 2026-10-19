import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../core/context/AppContext';
import { typography, radius, spacing } from '../theme';
import { generateCraftMarkdown, copyToClipboard, downloadMarkdownFile } from '../../core/export/craftExport';
import { defaultUsageLedger } from '../../core/enrichment/ledger';
import { EnrichmentLedgerSummary } from '../../core/enrichment/types';
import { defaultSourceRepository } from '../../core/data/sourceRepository';
import { TOPIC_SPACE_MAP, TopicTag } from '../../core/domain/types';
import { NewsHubModal } from './NewsHubModal';
import { UltraMasterModal } from './UltraMasterModal';
import { AtmenSymbol } from './AtmenSymbol';

interface DesktopSidebarProps {
  articleCount?: number;
  selectedTopicFilter?: TopicTag | 'all' | string;
  onSelectTopicFilter?: (topic: TopicTag | 'all' | string) => void;
}

export const DesktopSidebar: React.FC<DesktopSidebarProps> = ({
  articleCount = 68,
  selectedTopicFilter = 'all',
  onSelectTopicFilter
}) => {
  const { colors, savedArticles, interactions, refreshFeed, shuffleFeed, spaces } = useApp();
  const [showUltraMasterModal, setShowUltraMasterModal] = useState<boolean>(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [budgetSummary, setBudgetSummary] = useState<EnrichmentLedgerSummary | null>(null);
  const [showNewsHubModal, setShowNewsHubModal] = useState<boolean>(false);

  const healthOverview = defaultSourceRepository.getHealthOverview();

  React.useEffect(() => {
    void defaultUsageLedger.getSummary().then(setBudgetSummary);
  }, []);

  const handleShuffleAndRefresh = async () => {
    setIsRefreshing(true);
    try {
      await shuffleFeed();
      await refreshFeed();
      setCopyFeedback(`✓ Frischer Wind aus ${healthOverview.deliveringSources} aktiven Quellen!`);
      setTimeout(() => setCopyFeedback(null), 3000);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCopyCraft = async () => {
    const md = generateCraftMarkdown(savedArticles, interactions);
    const success = await copyToClipboard(md);
    if (success) {
      setCopyFeedback('✓ In Zwischenablage kopiert (Craft Markdown)!');
      setTimeout(() => setCopyFeedback(null), 3000);
    }
  };

  const handleDownloadMarkdown = () => {
    const md = generateCraftMarkdown(savedArticles, interactions);
    const dateStr = new Date().toISOString().split('T')[0];
    const success = downloadMarkdownFile(`atmen-erkenntnisarchiv-${dateStr}.md`, md);
    if (success) {
      setCopyFeedback('✓ Datei heruntergeladen (.md)!');
      setTimeout(() => setCopyFeedback(null), 3000);
    }
  };

  return (
    <View style={styles.sidebarContainer}>
      {/* 1. c/atmen Bloomscrolling Community Card */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
        <View style={[styles.communityBanner, { backgroundColor: colors.accent }]}>
          <AtmenSymbol size={22} isDark={true} style={{ marginRight: 8 }} />
          <Text style={styles.bannerTag}>BLOOMSCROLLING</Text>
        </View>

        <View style={styles.communityBody}>
          <View style={styles.communityTitleRow}>
            <Text style={[styles.communityHandle, { color: colors.textPrimary }]}>c/atmen</Text>
            <View style={[styles.badgePill, { backgroundColor: 'rgba(16, 185, 129, 0.14)' }]}>
              <Text style={[styles.badgeText, { color: '#10B981' }]}>
                {healthOverview.deliveringSources} AKTIVE QUELLEN
              </Text>
            </View>
          </View>

          <Text style={[styles.communityDesc, { color: colors.textSecondary }]}>
            Dein lebendiger Reddit-Ersatz zum Lesen: echte Stimmen, Forschung, KI, Philosophie, Kultur, Musik & Kunst. Endlos scrollbar, ohne künstliche Dopamin-Fallen.
          </Text>

          <View style={[styles.statsRow, { borderTopColor: colors.borderSubtle, borderBottomColor: colors.borderSubtle }]}>
            <View style={styles.statCol}>
              <Text style={[styles.statNumber, { color: colors.textPrimary }]}>{articleCount}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Im Pool</Text>
            </View>
            <View style={styles.statCol}>
              <Text style={[styles.statNumber, { color: '#10B981' }]}>
                {healthOverview.deliveringSources}/{healthOverview.totalSources}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Quellen live</Text>
            </View>
            <View style={styles.statCol}>
              <Text style={[styles.statNumber, { color: colors.textPrimary }]}>{savedArticles.length}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Gemerkt</Text>
            </View>
          </View>

          <View style={{ gap: 8, marginTop: 12 }}>
            <TouchableOpacity
              onPress={handleShuffleAndRefresh}
              disabled={isRefreshing}
              style={[styles.primarySidebarBtn, { backgroundColor: colors.accent }]}
              activeOpacity={0.85}
            >
              <Ionicons name="shuffle-outline" size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.primarySidebarBtnText}>
                {isRefreshing ? 'Mische neuen Stream…' : '🔄 Frischer Wind (Neu mischen)'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowNewsHubModal(true)}
              style={[styles.secondarySidebarBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}
              activeOpacity={0.8}
            >
              <Ionicons name="radio-outline" size={13} color={colors.textPrimary} style={{ marginRight: 6 }} />
              <Text style={[styles.secondarySidebarBtnText, { color: colors.textPrimary }]}>
                Quellen-Katalog & Health ({healthOverview.deliveringSources}/{healthOverview.totalSources})
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* 2. Colorful Reddit-Style Communities / Spaces */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
        <View style={styles.cardHeader}>
          <Ionicons name="planet-outline" size={16} color={colors.accent} style={{ marginRight: 6 }} />
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Spaces & Communities</Text>
        </View>

        <View style={styles.spacesGrid}>
          <TouchableOpacity
            onPress={() => onSelectTopicFilter && onSelectTopicFilter('all')}
            style={[
              styles.spaceChip,
              {
                backgroundColor: selectedTopicFilter === 'all' ? colors.accent : colors.surfaceSecondary,
                borderColor: selectedTopicFilter === 'all' ? colors.accent : colors.borderSubtle
              }
            ]}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.spaceChipText,
                { color: selectedTopicFilter === 'all' ? '#FFFFFF' : colors.textPrimary }
              ]}
            >
              🌈 Alle Spaces (Bloom-Mix)
            </Text>
          </TouchableOpacity>

          {/* Meine Custom Channels */}
          {spaces.filter(s => s.isCustom).length > 0 && (
            <View style={{ marginTop: 6, marginBottom: 2 }}>
              <Text style={{ fontSize: 10, fontWeight: '800', color: colors.accent, letterSpacing: 0.8, paddingVertical: 4 }}>
                MEINE CHANNELS
              </Text>
              {spaces.filter(s => s.isCustom).map(s => {
                const isSelected = selectedTopicFilter === s.handle;
                return (
                  <TouchableOpacity
                    key={s.id}
                    onPress={() => onSelectTopicFilter && onSelectTopicFilter(isSelected ? 'all' : s.handle)}
                    style={[
                      styles.spaceRowItem,
                      {
                        backgroundColor: isSelected ? colors.accentSubtle : colors.surfaceSecondary,
                        borderColor: isSelected ? s.accentColor : colors.borderSubtle,
                        borderLeftColor: s.accentColor,
                        borderLeftWidth: 3
                      }
                    ]}
                    activeOpacity={0.8}
                  >
                    <Ionicons name={(s.icon as any) || 'layers-outline'} size={14} color={s.accentColor} style={{ marginRight: 8 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.spaceRowTitle, { color: isSelected ? s.accentColor : colors.textPrimary }]}>
                        {s.handle}
                      </Text>
                      <Text style={[styles.spaceRowSub, { color: colors.textMuted }]} numberOfLines={1}>
                        {s.title}
                      </Text>
                    </View>
                    {isSelected && <Ionicons name="checkmark-circle" size={15} color={s.accentColor} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <TouchableOpacity
            onPress={() => setShowUltraMasterModal(true)}
            style={[
              styles.spaceRowItem,
              {
                backgroundColor: colors.surfaceSecondary,
                borderColor: colors.borderSubtle,
                borderStyle: 'dashed',
                borderWidth: 1
              }
            ]}
            activeOpacity={0.8}
          >
            <Ionicons name="add-circle-outline" size={15} color={colors.accent} style={{ marginRight: 8 }} />
            <Text style={[styles.spaceRowTitle, { color: colors.accent, fontWeight: '700' }]}>
              + Neuer Channel
            </Text>
          </TouchableOpacity>

          {(Object.keys(TOPIC_SPACE_MAP) as TopicTag[]).map(topic => {
            const meta = TOPIC_SPACE_MAP[topic];
            const isSelected = selectedTopicFilter === topic;
            return (
              <TouchableOpacity
                key={topic}
                onPress={() => onSelectTopicFilter && onSelectTopicFilter(isSelected ? 'all' : topic)}
                style={[
                  styles.spaceRowItem,
                  {
                    backgroundColor: isSelected ? meta.bgTint : colors.surfaceSecondary,
                    borderColor: isSelected ? meta.color : colors.borderSubtle,
                    borderLeftColor: meta.color,
                    borderLeftWidth: 3
                  }
                ]}
                activeOpacity={0.8}
              >
                <Ionicons name={meta.icon as any} size={14} color={meta.color} style={{ marginRight: 8 }} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.spaceRowTitle, { color: isSelected ? meta.color : colors.textPrimary }]}>
                    {meta.space}
                  </Text>
                  <Text style={[styles.spaceRowSub, { color: colors.textMuted }]} numberOfLines={1}>
                    {meta.name}
                  </Text>
                </View>
                {isSelected && <Ionicons name="checkmark-circle" size={15} color={meta.color} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* 3. Craft Export & Honest KI-Budget Card */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
        <View style={styles.cardHeader}>
          <Ionicons name="document-text-outline" size={16} color={colors.accent} style={{ marginRight: 6 }} />
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Souveränes Archiv & Budget</Text>
        </View>

        <View style={styles.budgetBody}>
          <View style={styles.budgetRow}>
            <Text style={[styles.budgetLabel, { color: colors.textSecondary }]}>
              KI-Budget ({budgetSummary?.monthKey || 'Monat'}):
            </Text>
            <Text style={[styles.budgetValue, { color: colors.textPrimary }]}>
              {budgetSummary
                ? `€${budgetSummary.totalCostEur.toFixed(4)} / €${budgetSummary.budgetLimitEur.toFixed(2)}`
                : '€0.00 / €5.00'}
            </Text>
          </View>

          <View style={[styles.budgetTrack, { backgroundColor: colors.surfaceSecondary }]}>
            <View
              style={[
                styles.budgetFill,
                {
                  width: `${Math.min(
                    100,
                    Math.max(1, Math.round(((budgetSummary?.totalCostEur ?? 0) / (budgetSummary?.budgetLimitEur ?? 5)) * 100))
                  )}%`,
                  backgroundColor: (budgetSummary?.totalCostEur ?? 0) >= 4.5 ? '#EF4444' : '#10B981'
                }
              ]}
            />
          </View>

          <View style={styles.exportActions}>
            <TouchableOpacity
              onPress={handleCopyCraft}
              style={[styles.exportBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}
              activeOpacity={0.8}
            >
              <Ionicons name="copy-outline" size={13} color={colors.accent} style={{ marginRight: 5 }} />
              <Text style={[styles.exportBtnText, { color: colors.textPrimary }]}>Craft Markdown</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleDownloadMarkdown}
              style={[styles.exportBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}
              activeOpacity={0.8}
            >
              <Ionicons name="download-outline" size={13} color={colors.textSecondary} style={{ marginRight: 5 }} />
              <Text style={[styles.exportBtnText, { color: colors.textPrimary }]}>.md Datei</Text>
            </TouchableOpacity>
          </View>

          {copyFeedback && (
            <View style={[styles.feedbackBanner, { backgroundColor: colors.accentSubtle }]}>
              <Text style={[styles.feedbackText, { color: colors.accent }]}>{copyFeedback}</Text>
            </View>
          )}
        </View>
      </View>

      <NewsHubModal visible={showNewsHubModal} onClose={() => setShowNewsHubModal(false)} />
      <UltraMasterModal visible={showUltraMasterModal} onClose={() => setShowUltraMasterModal(false)} />
    </View>
  );
};

const styles = StyleSheet.create({
  sidebarContainer: {
    width: 300,
    gap: spacing.md
  },
  card: {
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: 'hidden'
  },
  communityBanner: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md
  },
  bannerEmoji: {
    fontSize: 20,
    color: '#FFFFFF',
    fontWeight: '900'
  },
  bannerTag: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: 1
  },
  communityBody: {
    padding: spacing.md
  },
  communityTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs
  },
  communityHandle: {
    fontSize: typography.sizes.title2,
    fontWeight: '800',
    fontFamily: typography.fontFamilies.serif
  },
  badgePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4
  },
  communityDesc: {
    fontSize: 12,
    lineHeight: 17.5,
    marginBottom: spacing.sm
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderTopWidth: 0.5,
    borderBottomWidth: 0.5
  },
  statCol: {
    alignItems: 'center'
  },
  statNumber: {
    fontSize: 14,
    fontWeight: '800'
  },
  statLabel: {
    fontSize: 10,
    marginTop: 2
  },
  primarySidebarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: radius.sm
  },
  primarySidebarBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700'
  },
  secondarySidebarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: radius.sm,
    borderWidth: 1
  },
  secondarySidebarBtnText: {
    fontSize: 11.5,
    fontWeight: '600'
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700'
  },
  spacesGrid: {
    padding: spacing.sm,
    gap: 5
  },
  spaceChip: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 2
  },
  spaceChipText: {
    fontSize: 12,
    fontWeight: '700'
  },
  spaceRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    borderWidth: 0.5
  },
  spaceRowTitle: {
    fontSize: 12,
    fontWeight: '700'
  },
  spaceRowSub: {
    fontSize: 10
  },
  budgetBody: {
    padding: spacing.md,
    gap: 8
  },
  budgetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  budgetLabel: {
    fontSize: 11.5
  },
  budgetValue: {
    fontSize: 11.5,
    fontWeight: '700'
  },
  budgetTrack: {
    height: 5,
    borderRadius: 3,
    overflow: 'hidden'
  },
  budgetFill: {
    height: '100%',
    borderRadius: 3
  },
  exportActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4
  },
  exportBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: radius.sm,
    borderWidth: 1
  },
  exportBtnText: {
    fontSize: 11.5,
    fontWeight: '600'
  },
  feedbackBanner: {
    padding: 6,
    borderRadius: radius.sm,
    alignItems: 'center',
    marginTop: 4
  },
  feedbackText: {
    fontSize: 11,
    fontWeight: '600'
  }
});
