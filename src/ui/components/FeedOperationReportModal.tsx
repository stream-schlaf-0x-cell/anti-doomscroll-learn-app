import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FeedOperationResult } from '../../core/feed/FeedOperationManager';
import { ThemeColors, typography, radius, spacing } from '../theme';

export interface FeedOperationReportModalProps {
  visible: boolean;
  onClose: () => void;
  result: FeedOperationResult | null;
  colors: ThemeColors;
  isDark: boolean;
}

export const FeedOperationReportModal: React.FC<FeedOperationReportModalProps> = ({
  visible,
  onClose,
  result,
  colors,
  isDark
}) => {
  if (!result) return null;

  const durationSec = ((result.durationMs ?? 0) / 1000).toFixed(1);
  const operationTitle =
    result.operationType === 'ai_curation'
      ? 'Live-Kuration abgeschlossen'
      : result.operationType === 'hivemind_generation'
      ? 'Hivemind-Synthese abgeschlossen'
      : result.operationType === 'manual_refresh'
      ? 'Feed-Aktualisierung abgeschlossen'
      : 'Synchronisation abgeschlossen';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
          {/* Header */}
          <View style={[styles.headerRow, { borderBottomColor: colors.borderSubtle }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons
                name={result.status === 'failed' ? 'alert-circle' : 'sparkles'}
                size={20}
                color={result.status === 'failed' ? colors.danger : colors.accent}
              />
              <Text style={[styles.title, { color: colors.textPrimary }]}>{operationTitle}</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Stats Grid */}
            <View style={styles.statsGrid}>
              <View style={[styles.statBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
                <Text style={[styles.statNumber, { color: colors.accent }]}>{result.updatedCount}</Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Aktualisiert</Text>
              </View>

              <View style={[styles.statBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
                <Text style={[styles.statNumber, { color: colors.accent }]}>{result.candidateCount}</Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Artikel geprüft</Text>
              </View>

              <View style={[styles.statBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
                <Text style={[styles.statNumber, { color: colors.success || '#10B981' }]}>{result.insertedCount}</Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Neu hinzugefügt</Text>
              </View>

              <View style={[styles.statBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
                <Text style={[styles.statNumber, { color: colors.textPrimary }]}>{result.duplicateCount}</Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Bereits vorhanden</Text>
              </View>

              <View style={[styles.statBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
                <Text style={[styles.statNumber, { color: colors.textMuted }]}>{result.rejectedCount}</Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Aussortiert</Text>
              </View>
            </View>

            {/* Telemetry Details */}
            <View style={[styles.detailSection, { borderTopColor: colors.borderSubtle }]}>
              <View style={styles.detailRow}>
                <Text style={[styles.detailKey, { color: colors.textSecondary }]}>KI verwendet</Text>
                <Text style={[styles.detailValue, { color: colors.textPrimary }]}>
                  {result.usedAI ? 'Ja, in diesem Durchlauf' : 'Nein, in diesem Durchlauf'}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={[styles.detailKey, { color: colors.textSecondary }]}>Lokal wiederverwendet</Text>
                <Text style={[styles.detailValue, { color: colors.textPrimary }]}>{result.cacheHits} Ergebnisse</Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={[styles.detailKey, { color: colors.textSecondary }]}>Ersatzverfahren verwendet</Text>
                <Text style={[styles.detailValue, { color: colors.textPrimary }]}>{result.usedFallback ? 'Ja' : 'Nein'}</Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={[styles.detailKey, { color: colors.textSecondary }]}>Dauer</Text>
                <Text style={[styles.detailValue, { color: colors.textPrimary }]}>{durationSec} Sekunden</Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={[styles.detailKey, { color: colors.textSecondary }]}>Status</Text>
                <Text
                  style={[
                    styles.detailValue,
                    {
                      color:
                        result.status === 'completed'
                          ? colors.success || '#10B981'
                          : result.status === 'fallback'
                          ? '#F59E0B'
                          : result.status === 'partial'
                          ? '#F59E0B'
                          : colors.danger
                    }
                  ]}
                >
                  {result.status === 'completed'
                    ? 'Erfolgreich'
                    : result.status === 'fallback'
                    ? 'Ersatzverfahren (Lokal)'
                    : result.status === 'partial'
                    ? 'Teilweise'
                    : 'Fehlgeschlagen'}
                </Text>
              </View>

              {result.modelUsed && (
                <View style={styles.detailRow}>
                  <Text style={[styles.detailKey, { color: colors.textSecondary }]}>Modell</Text>
                  <Text style={[styles.detailValue, { color: colors.textPrimary }]}>{result.modelUsed}</Text>
                </View>
              )}

              {result.errorMessage && (
                <View style={[styles.errorBox, { backgroundColor: colors.surfaceSecondary, borderColor: '#F59E0B', marginTop: 10 }]}>
                  <Text style={[styles.errorTitle, { color: '#F59E0B' }]}>Hinweis zur Ausführung:</Text>
                  <Text style={[styles.errorText, { color: colors.textSecondary }]}>{result.errorMessage}</Text>
                </View>
              )}

              {result.rejectedReasons && Object.keys(result.rejectedReasons).length > 0 && (
                <View style={{ marginTop: 8 }}>
                  <Text style={[styles.detailKey, { color: colors.textSecondary, marginBottom: 4 }]}>
                    Aussortierungsgründe:
                  </Text>
                  {Object.entries(result.rejectedReasons).map(([reason, count]) => (
                    <Text key={reason} style={[styles.reasonItem, { color: colors.textMuted }]}>
                      • {reason === 'schema_invalid' ? 'Ungültiges Datenformat' : reason === 'gatekeeper' ? 'Inhaltliche Vorauswahl' : reason}: {count}
                    </Text>
                  ))}
                </View>
              )}

              {result.errors && result.errors.length > 0 && (
                <View style={[styles.errorBox, { backgroundColor: colors.cardHighlight, borderColor: colors.danger }]}>
                  <Text style={[styles.errorTitle, { color: colors.danger }]}>Fehler-Protokoll:</Text>
                  {result.errors.map((err, idx) => (
                    <Text key={idx} style={[styles.errorText, { color: colors.danger }]}>
                      • {err}
                    </Text>
                  ))}
                </View>
              )}
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={[styles.footerRow, { borderTopColor: colors.borderSubtle }]}>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: colors.accent }]}
              accessibilityRole="button"
              accessibilityLabel="Schließen"
            >
              <Text style={styles.closeBtnText}>Verstanden</Text>
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
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md
  },
  modalCard: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '85%',
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden'
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1
  },
  title: {
    fontFamily: typography.fontFamilies.serif,
    fontSize: typography.sizes.title2,
    fontWeight: '700'
  },
  body: {
    padding: spacing.lg
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg
  },
  statBox: {
    flex: 1,
    minWidth: '45%',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center'
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    fontFamily: typography.fontFamilies.sans,
    marginBottom: 2
  },
  statLabel: {
    fontSize: typography.sizes.caption,
    fontFamily: typography.fontFamilies.sans
  },
  detailSection: {
    borderTopWidth: 1,
    paddingTop: spacing.md,
    gap: spacing.xs
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3
  },
  detailKey: {
    fontSize: typography.sizes.bodySmall,
    fontFamily: typography.fontFamilies.sans
  },
  detailValue: {
    fontSize: typography.sizes.bodySmall,
    fontWeight: '600',
    fontFamily: typography.fontFamilies.sans
  },
  reasonItem: {
    fontSize: typography.sizes.caption,
    paddingLeft: 4,
    paddingVertical: 1
  },
  errorBox: {
    marginTop: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1
  },
  errorTitle: {
    fontSize: typography.sizes.caption,
    fontWeight: '700',
    marginBottom: 2
  },
  errorText: {
    fontSize: typography.sizes.caption
  },
  footerRow: {
    padding: spacing.md,
    borderTopWidth: 1,
    alignItems: 'flex-end'
  },
  closeBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full
  },
  closeBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: typography.sizes.bodySmall
  }
});

export default FeedOperationReportModal;
