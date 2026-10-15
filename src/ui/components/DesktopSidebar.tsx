import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../core/context/AppContext';
import { typography, radius, spacing } from '../theme';
import { generateCraftMarkdown, copyToClipboard, downloadMarkdownFile } from '../../core/export/craftExport';
import { defaultUsageLedger } from '../../core/enrichment/ledger';
import { EnrichmentLedgerSummary } from '../../core/enrichment/types';

interface DesktopSidebarProps {
  articleCount?: number;
}

export const DesktopSidebar: React.FC<DesktopSidebarProps> = ({ articleCount = 68 }) => {
  const { colors, savedArticles, interactions, refreshFeed } = useApp();
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [budgetSummary, setBudgetSummary] = useState<EnrichmentLedgerSummary | null>(null);

  React.useEffect(() => {
    void defaultUsageLedger.getSummary().then(setBudgetSummary);
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshFeed();
      setCopyFeedback('✓ Live-Feeds erfolgreich aktualisiert (68 Artikel)!');
      setTimeout(() => setCopyFeedback(null), 3000);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCopyCraft = async () => {
    const md = generateCraftMarkdown(savedArticles, interactions);
    const success = await copyToClipboard(md);
    if (success) {
      setCopyFeedback('In Zwischenablage kopiert! Bereit für Craft Docs.');
      setTimeout(() => setCopyFeedback(null), 3000);
    }
  };

  const handleDownloadMarkdown = () => {
    const md = generateCraftMarkdown(savedArticles, interactions);
    const dateStr = new Date().toISOString().split('T')[0];
    const success = downloadMarkdownFile(`atem-erkenntnisarchiv-${dateStr}.md`, md);
    if (success) {
      setCopyFeedback('Datei heruntergeladen (.md)!');
      setTimeout(() => setCopyFeedback(null), 3000);
    }
  };

  return (
    <View style={styles.sidebarContainer}>
      {/* 1. Community Card */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
        <View style={[styles.communityBanner, { backgroundColor: colors.accent }]}>
          <Text style={styles.bannerEmoji}>◎</Text>
        </View>

        <View style={styles.communityBody}>
          <View style={styles.communityTitleRow}>
            <Text style={[styles.communityHandle, { color: colors.textPrimary }]}>
              c/atmen
            </Text>
            <View style={[styles.badgePill, { backgroundColor: colors.accentSubtle }]}>
              <Text style={[styles.badgeText, { color: colors.accent }]}>SOUVERÄN</Text>
            </View>
          </View>

          <Text style={[styles.communityDesc, { color: colors.textSecondary }]}>
            Das private, intellektuelle Social-Network als Gegenentwurf zum reflexartigen Doomscrolling. Höchste Erkenntnisdichte pro Minute Aufmerksamkeit.
          </Text>

          {/* Community Stats */}
          <View style={[styles.statsRow, { borderTopColor: colors.borderSubtle, borderBottomColor: colors.borderSubtle }]}>
            <View style={styles.statCol}>
              <Text style={[styles.statNumber, { color: colors.textPrimary }]}>{articleCount}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Beiträge heute</Text>
            </View>
            <View style={styles.statCol}>
              <Text style={[styles.statNumber, { color: colors.textPrimary }]}>0</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Dopamin-Fallen</Text>
            </View>
            <View style={styles.statCol}>
              <Text style={[styles.statNumber, { color: colors.textPrimary }]}>100%</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Lokal & Sicher</Text>
            </View>
          </View>
        </View>
      </View>

      {/* 2. Atem Community Regeln */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
        <View style={styles.cardHeader}>
          <Ionicons name="shield-checkmark-outline" size={16} color={colors.accent} style={{ marginRight: 6 }} />
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Community-Regeln</Text>
        </View>

        <View style={styles.rulesList}>
          <View style={styles.ruleItem}>
            <Text style={[styles.ruleNumber, { color: colors.accent }]}>1.</Text>
            <View style={styles.ruleContent}>
              <Text style={[styles.ruleTitle, { color: colors.textPrimary }]}>Kein Doomscrollen</Text>
              <Text style={[styles.ruleSub, { color: colors.textSecondary }]}>
                Endliche Tagesausgabe. Bewusste Innehalte-Momente nach jedem Gedanken.
              </Text>
            </View>
          </View>

          <View style={styles.ruleItem}>
            <Text style={[styles.ruleNumber, { color: colors.accent }]}>2.</Text>
            <View style={styles.ruleContent}>
              <Text style={[styles.ruleTitle, { color: colors.textPrimary }]}>Erkenntnis vor Dopamin</Text>
              <Text style={[styles.ruleSub, { color: colors.textSecondary }]}>
                Geprüfte Primärquellen (Öffentlich-Rechtlich, Stanford, Didaktik). Kein Clickbait.
              </Text>
            </View>
          </View>

          <View style={styles.ruleItem}>
            <Text style={[styles.ruleNumber, { color: colors.accent }]}>3.</Text>
            <View style={styles.ruleContent}>
              <Text style={[styles.ruleTitle, { color: colors.textPrimary }]}>Eigene Thesen wagen</Text>
              <Text style={[styles.ruleSub, { color: colors.textSecondary }]}>
                Nutze den Mini-Composer für Einwände und sokratisches Sparring.
              </Text>
            </View>
          </View>

          <View style={styles.ruleItem}>
            <Text style={[styles.ruleNumber, { color: colors.accent }]}>4.</Text>
            <View style={styles.ruleContent}>
              <Text style={[styles.ruleTitle, { color: colors.textPrimary }]}>Absolute Souveränität</Text>
              <Text style={[styles.ruleSub, { color: colors.textSecondary }]}>
                Deine Gedanken gehören dir. Jederzeit 1-Klick-Export für Craft Docs & Markdown.
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* 3. Vertrauenswürdige Quellen */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
        <View style={styles.cardHeader}>
          <Ionicons name="checkmark-done-circle-outline" size={16} color="#10B981" style={{ marginRight: 6 }} />
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Geprüfte Quellen</Text>
        </View>

        <View style={styles.sourcesGrid}>
          {[
            { name: 'ARD Tagesschau', tag: 'Öffentlich-Rechtlich', icon: 'tv-outline' },
            { name: 'Deutschlandfunk', tag: 'Öffentlich-Rechtlich', icon: 'radio-outline' },
            { name: 'ZDFheute', tag: 'Öffentlich-Rechtlich', icon: 'newspaper-outline' },
            { name: 'Stanford Encyclopedia', tag: 'Philosophie', icon: 'book-outline' },
            { name: 'Aeon Essays', tag: 'Ideen & Kultur', icon: 'compass-outline' },
            { name: 'Deutsches Schulportal', tag: 'Didaktik Sek I/II', icon: 'school-outline' },
            { name: 'Quanta Magazine', tag: 'Wissenschaft', icon: 'flask-outline' },
            { name: 'Heise Developer', tag: 'Frontier AI & Code', icon: 'code-slash-outline' },
            { name: 'Tricycle', tag: 'Geist & Fokus', icon: 'leaf-outline' },
            { name: 'Lines Community', tag: 'Klangforschung', icon: 'hardware-chip-outline' }
          ].map(src => (
            <View key={src.name} style={[styles.sourceItem, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
              <Ionicons name={src.icon as any} size={13} color={colors.textSecondary} style={{ marginRight: 6 }} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.sourceName, { color: colors.textPrimary }]} numberOfLines={1}>{src.name}</Text>
                <Text style={[styles.sourceTag, { color: colors.textMuted }]}>{src.tag}</Text>
              </View>
            </View>
          ))}
        </View>

        <TouchableOpacity
          onPress={handleRefresh}
          disabled={isRefreshing}
          style={[styles.refreshSidebarBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}
        >
          <Ionicons name="reload-outline" size={13} color={colors.accent} style={{ marginRight: 6 }} />
          <Text style={[styles.refreshSidebarBtnText, { color: colors.accent }]}>
            {isRefreshing ? 'Feeds werden synchronisiert…' : '29 Live-Feeds synchronisieren'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 4. Monatliches KI-Budget Meter (€5.00 Cap) */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
        <View style={styles.cardHeader}>
          <Ionicons name="wallet-outline" size={16} color={colors.accent} style={{ marginRight: 6 }} />
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Monatliches KI-Budget</Text>
        </View>

        <View style={styles.budgetBody}>
          <View style={styles.budgetRow}>
            <Text style={[styles.budgetLabel, { color: colors.textSecondary }]}>
              {budgetSummary ? `Verbraucht (${budgetSummary.monthKey}):` : 'Verbraucht:'}
            </Text>
            <Text style={[styles.budgetValue, { color: colors.textPrimary }]}>
              {budgetSummary
                ? `€${budgetSummary.totalCostEur.toFixed(4)} / €${budgetSummary.budgetLimitEur.toFixed(2)}`
                : 'Noch nicht erfasst'}
            </Text>
          </View>

          {/* Progress bar */}
          <View style={[styles.budgetTrack, { backgroundColor: colors.surfaceSecondary }]}>
            <View
              style={[
                styles.budgetFill,
                {
                  width: `${Math.min(100, Math.max(1, Math.round(((budgetSummary?.totalCostEur ?? 0) / (budgetSummary?.budgetLimitEur ?? 5)) * 100)))}%`,
                  backgroundColor: (budgetSummary?.totalCostEur ?? 0) >= 4.50 ? '#EF4444' : '#10B981'
                }
              ]}
            />
          </View>

          <Text style={[styles.budgetNote, { color: colors.textMuted }]}>
            {budgetSummary && budgetSummary.totalCalls > 0
              ? `${budgetSummary.totalCalls} bezahlte Abrufe erfasst. Rechnungsprüfung via EnrichmentUsageLedger.`
              : 'Quellenmodus aktiv: 0 bezahlte Abrufe. Bei aktiviertem Provider automatisch auf €5.00/Monat gedeckelt.'}
          </Text>
        </View>
      </View>

      {/* 5. Craft Docs & Markdown Export */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
        <View style={styles.cardHeader}>
          <Ionicons name="document-text-outline" size={16} color={colors.accent} style={{ marginRight: 6 }} />
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Craft Docs & Souveränität</Text>
        </View>

        <Text style={[styles.exportDesc, { color: colors.textSecondary }]}>
          Sichere deine gelesenen Artikel, persönlichen Einwände und Sparring-Dialoge in strukturiertem Markdown:
        </Text>

        <View style={styles.exportActions}>
          <TouchableOpacity
            onPress={handleCopyCraft}
            style={[styles.exportBtn, { backgroundColor: colors.accent }]}
            activeOpacity={0.8}
          >
            <Ionicons name="copy-outline" size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.exportBtnText}>In Craft kopieren</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleDownloadMarkdown}
            style={[styles.exportOutlineBtn, { borderColor: colors.borderSubtle }]}
            activeOpacity={0.8}
          >
            <Ionicons name="download-outline" size={14} color={colors.textPrimary} style={{ marginRight: 6 }} />
            <Text style={[styles.exportOutlineBtnText, { color: colors.textPrimary }]}>.md herunterladen</Text>
          </TouchableOpacity>
        </View>

        {copyFeedback && (
          <View style={[styles.feedbackBanner, { backgroundColor: colors.accentSubtle }]}>
            <Text style={[styles.feedbackText, { color: colors.accent }]}>{copyFeedback}</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  sidebarContainer: {
    width: 310,
    gap: spacing.md
  },
  card: {
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: 'hidden'
  },
  communityBanner: {
    height: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.md
  },
  bannerEmoji: {
    fontSize: 22
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
    letterSpacing: 0.5
  },
  communityDesc: {
    fontSize: typography.sizes.caption,
    lineHeight: 18,
    marginBottom: spacing.md
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
    fontSize: typography.sizes.body,
    fontWeight: '700'
  },
  statLabel: {
    fontSize: 10,
    marginTop: 2
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs
  },
  cardTitle: {
    fontSize: typography.sizes.bodySmall,
    fontWeight: '700'
  },
  rulesList: {
    padding: spacing.md,
    gap: spacing.sm
  },
  ruleItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8
  },
  ruleNumber: {
    fontSize: typography.sizes.bodySmall,
    fontWeight: '800'
  },
  ruleContent: {
    flex: 1
  },
  ruleTitle: {
    fontSize: typography.sizes.caption,
    fontWeight: '700',
    marginBottom: 1
  },
  ruleSub: {
    fontSize: typography.sizes.micro,
    lineHeight: 15
  },
  sourcesGrid: {
    padding: spacing.md,
    gap: spacing.xs
  },
  sourceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 0.5
  },
  sourceName: {
    fontSize: typography.sizes.caption,
    fontWeight: '600'
  },
  sourceTag: {
    fontSize: 9
  },
  refreshSidebarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1
  },
  refreshSidebarBtnText: {
    fontSize: typography.sizes.micro,
    fontWeight: '700'
  },
  budgetBody: {
    padding: spacing.md,
    gap: spacing.xs
  },
  budgetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  budgetLabel: {
    fontSize: typography.sizes.caption
  },
  budgetValue: {
    fontSize: typography.sizes.caption,
    fontWeight: '700'
  },
  budgetTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginVertical: 4
  },
  budgetFill: {
    height: '100%',
    borderRadius: 3
  },
  budgetNote: {
    fontSize: typography.sizes.micro,
    lineHeight: 14
  },
  exportDesc: {
    fontSize: typography.sizes.caption,
    lineHeight: 17,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    marginBottom: spacing.sm
  },
  exportActions: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.xs
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: radius.sm
  },
  exportBtnText: {
    color: '#FFFFFF',
    fontSize: typography.sizes.caption,
    fontWeight: '700'
  },
  exportOutlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: radius.sm,
    borderWidth: 1
  },
  exportOutlineBtnText: {
    fontSize: typography.sizes.caption,
    fontWeight: '600'
  },
  feedbackBanner: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.xs,
    borderRadius: radius.sm,
    alignItems: 'center'
  },
  feedbackText: {
    fontSize: typography.sizes.micro,
    fontWeight: '600'
  }
});
