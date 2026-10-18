import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Linking
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NewsEvolutionBriefing } from '../../core/news/newsEvolutionService';
import { ThemeColors, typography, radius, spacing } from '../theme';

interface NewsEvolutionModalProps {
  visible: boolean;
  onClose: () => void;
  briefing: NewsEvolutionBriefing | null;
  loading: boolean;
  onRefresh: () => void;
  onOpenArticle?: (urlOrId: string) => void;
  colors: ThemeColors;
  isDark: boolean;
}

export const NewsEvolutionModal: React.FC<NewsEvolutionModalProps> = ({
  visible,
  onClose,
  briefing,
  loading,
  onRefresh,
  onOpenArticle,
  colors,
  isDark
}) => {
  if (!visible) return null;

  const handleCitationPress = (url?: string) => {
    if (!url) return;
    if (onOpenArticle && !url.startsWith('http')) {
      onOpenArticle(url);
    } else {
      void Linking.openURL(url).catch(() => {});
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.dialog, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.borderSubtle }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <View style={[styles.headerIconContainer, { backgroundColor: colors.accentSubtle }]}>
                <Ionicons name="compass" size={20} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: colors.textPrimary }]}>
                  Was hat sich verändert?
                </Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                  Entwicklung, Quellenbelege und offene Fragen im Ticker
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeButton, { backgroundColor: colors.surfaceSecondary }]}
              accessibilityRole="button"
              accessibilityLabel="Schließen"
            >
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
            {loading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color={colors.accent} />
                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                  Meldungen werden abgeglichen und Neuerungen extrahiert…
                </Text>
                <Text style={[styles.loadingSubtext, { color: colors.textMuted }]}>
                  Prüfung auf Fakten, Quellen und offene Widersprüche
                </Text>
              </View>
            ) : briefing ? (
              <View style={styles.briefingContainer}>
                {/* Meta Badge Bar */}
                <View style={styles.metaRow}>
                  <View
                    style={[
                      styles.provenanceBadge,
                      {
                        backgroundColor: briefing.isAiGenerated ? colors.accentSubtle : colors.surfaceSecondary,
                        borderColor: briefing.isAiGenerated ? colors.accent : colors.borderSubtle
                      }
                    ]}
                  >
                    <Text
                      style={[
                        styles.provenanceBadgeText,
                        { color: briefing.isAiGenerated ? colors.accent : colors.textSecondary }
                      ]}
                    >
                      {briefing.isAiGenerated ? '✨ KI-Synthese (Gemini Flash)' : '⚡ Lokaler Abgleich (ohne KI)'}
                      {briefing.cached ? ' · Cache' : ''}
                    </Text>
                  </View>
                  <Text style={[styles.metaCountText, { color: colors.textMuted }]}>
                    {briefing.analyzedArticlesCount} Meldungen analysiert
                  </Text>
                </View>

                {/* Headline Banner */}
                <View style={[styles.headlineBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
                  <Text style={[styles.headlineText, { color: colors.textPrimary }]}>
                    {briefing.headline}
                  </Text>
                </View>

                {/* 3 Structured Points */}
                <View style={styles.pointsList}>
                  {briefing.points.map((pt, idx) => (
                    <View
                      key={idx}
                      style={[
                        styles.pointCard,
                        { backgroundColor: colors.surface, borderColor: colors.borderSubtle }
                      ]}
                    >
                      <View style={styles.pointHeader}>
                        <View style={[styles.pointIndexCircle, { backgroundColor: colors.accentSubtle }]}>
                          <Text style={[styles.pointIndexNumber, { color: colors.accent }]}>
                            {pt.index}
                          </Text>
                        </View>
                        <Text style={[styles.pointLabel, { color: colors.textPrimary }]}>
                          {pt.label}
                        </Text>
                      </View>

                      <Text style={[styles.pointText, { color: colors.textSecondary }]}>
                        {pt.text}
                      </Text>

                      {/* Citations */}
                      {pt.citations && pt.citations.length > 0 && (
                        <View style={styles.citationsContainer}>
                          <Text style={[styles.citationsTitle, { color: colors.textMuted }]}>
                            Stützende Quellen:
                          </Text>
                          <View style={styles.citationChips}>
                            {pt.citations.map((c, cIdx) => (
                              <TouchableOpacity
                                key={cIdx}
                                onPress={() => handleCitationPress(c.url)}
                                style={[
                                  styles.citationChip,
                                  { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }
                                ]}
                                accessibilityRole="button"
                                accessibilityLabel={`Quelle öffnen: ${c.publisher}`}
                              >
                                <Ionicons name="link-outline" size={12} color={colors.accent} style={{ marginRight: 4 }} />
                                <Text style={[styles.citationChipText, { color: colors.textPrimary }]} numberOfLines={1}>
                                  <Text style={{ fontWeight: '600' }}>{c.publisher}</Text>: {c.title}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>
                      )}

                      {/* Open Questions if present */}
                      {pt.openQuestions && pt.openQuestions.length > 0 && (
                        <View style={[styles.openQuestionsBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
                          <Text style={[styles.openQuestionsTitle, { color: colors.accent }]}>
                            ❓ Offene Fragen & nächste Klärungspunkte:
                          </Text>
                          {pt.openQuestions.map((q, qIdx) => (
                            <View key={qIdx} style={styles.questionItem}>
                              <Text style={[styles.bullet, { color: colors.accent }]}>•</Text>
                              <Text style={[styles.questionText, { color: colors.textSecondary }]}>
                                {q}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </ScrollView>

          {/* Footer */}
          <View style={[styles.footer, { borderTopColor: colors.borderSubtle }]}>
            <TouchableOpacity
              onPress={onRefresh}
              disabled={loading}
              style={[styles.refreshButton, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}
              accessibilityRole="button"
              accessibilityLabel="Briefing erneut analysieren"
            >
              <Ionicons name="refresh" size={14} color={colors.textPrimary} style={{ marginRight: 6 }} />
              <Text style={[styles.refreshButtonText, { color: colors.textPrimary }]}>
                Neu analysieren
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onClose}
              style={[styles.doneButton, { backgroundColor: colors.accent }]}
              accessibilityRole="button"
              accessibilityLabel="Schließen"
            >
              <Text style={styles.doneButtonText}>
                Verstanden
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md
  },
  dialog: {
    width: '100%',
    maxWidth: 620,
    maxHeight: '88%',
    borderRadius: radius.xl,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 12
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1
  },
  headerIconContainer: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center'
  },
  title: {
    fontFamily: typography.fontFamilies.sans,
    fontSize: 18,
    fontWeight: '700'
  },
  subtitle: {
    fontFamily: typography.fontFamilies.sans,
    fontSize: 12,
    marginTop: 2
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center'
  },
  scrollArea: {
    flex: 1
  },
  scrollContent: {
    padding: spacing.lg
  },
  loadingBox: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm
  },
  loadingText: {
    fontFamily: typography.fontFamilies.sans,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center'
  },
  loadingSubtext: {
    fontFamily: typography.fontFamilies.sans,
    fontSize: 12,
    textAlign: 'center'
  },
  briefingContainer: {
    gap: spacing.md
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.xs
  },
  provenanceBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
    borderWidth: 1
  },
  provenanceBadgeText: {
    fontFamily: typography.fontFamilies.sans,
    fontSize: 11,
    fontWeight: '600'
  },
  metaCountText: {
    fontFamily: typography.fontFamilies.sans,
    fontSize: 11
  },
  headlineBox: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1
  },
  headlineText: {
    fontFamily: typography.fontFamilies.sans,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21
  },
  pointsList: {
    gap: spacing.md,
    marginTop: spacing.xs
  },
  pointCard: {
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.sm
  },
  pointHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  pointIndexCircle: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center'
  },
  pointIndexNumber: {
    fontSize: 12,
    fontWeight: '700'
  },
  pointLabel: {
    fontFamily: typography.fontFamilies.sans,
    fontSize: 14,
    fontWeight: '700'
  },
  pointText: {
    fontFamily: typography.fontFamilies.sans,
    fontSize: 13,
    lineHeight: 20
  },
  citationsContainer: {
    marginTop: spacing.xs,
    gap: 4
  },
  citationsTitle: {
    fontFamily: typography.fontFamilies.sans,
    fontSize: 11,
    fontWeight: '600'
  },
  citationChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  citationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
    maxWidth: '100%'
  },
  citationChipText: {
    fontFamily: typography.fontFamilies.sans,
    fontSize: 11
  },
  openQuestionsBox: {
    marginTop: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 4
  },
  openQuestionsTitle: {
    fontFamily: typography.fontFamilies.sans,
    fontSize: 11,
    fontWeight: '700'
  },
  questionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6
  },
  bullet: {
    fontSize: 14,
    lineHeight: 18
  },
  questionText: {
    fontFamily: typography.fontFamilies.sans,
    fontSize: 12,
    lineHeight: 17,
    flex: 1
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    gap: spacing.md
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1
  },
  refreshButtonText: {
    fontFamily: typography.fontFamilies.sans,
    fontSize: 13,
    fontWeight: '600'
  },
  doneButton: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: radius.md
  },
  doneButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600'
  }
});
