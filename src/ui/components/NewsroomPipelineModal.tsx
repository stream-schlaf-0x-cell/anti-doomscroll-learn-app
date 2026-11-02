import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView
} from 'react-native';
import { useApp } from '../../core/context/AppContext';
import {
  LiveCivicPulseService,
  VirtualNewsroomTelemetry
} from '../../core/ingestion/liveCivicPulseService';

interface NewsroomPipelineModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectArticle?: (id: string) => void;
}

export const NewsroomPipelineModal: React.FC<NewsroomPipelineModalProps> = ({
  visible,
  onClose,
  onSelectArticle
}) => {
  const { colors, isDark } = useApp();
  const telemetry: VirtualNewsroomTelemetry | null =
    LiveCivicPulseService.getLastNewsroomTelemetry();

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <SafeAreaView
        style={[
          styles.modalOverlay,
          { backgroundColor: isDark ? 'rgba(5, 8, 16, 0.88)' : 'rgba(15, 23, 42, 0.65)' }
        ]}
      >
        <View
          style={[
            styles.modalContainer,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border
            }
          ]}
        >
          {/* Header */}
          <View style={[styles.headerRow, { borderBottomColor: colors.border }]}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                🏛️ Redaktions-Protokoll
              </Text>
              <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                Transparenz der 5-Stufen-Newsroom-Architektur
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeButton, { backgroundColor: colors.background }]}
              accessibilityRole="button"
              accessibilityLabel="Schließen"
            >
              <Text style={[styles.closeButtonText, { color: colors.textPrimary }]}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.contentScroll} contentContainerStyle={styles.scrollContent}>
            {!telemetry ? (
              <View style={styles.emptyContainer}>
                <Text style={{ fontSize: 36, marginBottom: 12 }}>📡</Text>
                <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                  Noch kein Pipeline-Lauf protokolliert
                </Text>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  Tippe auf „🔄 Recherche jetzt starten“, um die 5-Stufen-Redaktion live auszuführen und hier detaillierte Telemetriedaten einzusehen.
                </Text>
              </View>
            ) : (
              <>
                {/* Run summary badge */}
                <View
                  style={[
                    styles.summaryBanner,
                    {
                      backgroundColor: isDark ? 'rgba(99, 102, 241, 0.12)' : 'rgba(99, 102, 241, 0.08)',
                      borderColor: colors.accent
                    }
                  ]}
                >
                  <Text style={[styles.summaryTitle, { color: colors.accent }]}>
                    ⏱️ Laufzeit: {(telemetry.totalDurationMs / 1000).toFixed(2)}s · Abgeschlossen {new Date(telemetry.completedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </Text>
                  <Text style={[styles.summaryDescription, { color: colors.textSecondary }]}>
                    Alle 5 Redaktions-Schritte wurden regelkonform durchlaufen.
                  </Text>
                </View>

                {/* Stufe 1 */}
                <View style={[styles.stageCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <View style={styles.stageHeader}>
                    <Text style={styles.stageNumber}>1</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.stageTitle, { color: colors.textPrimary }]}>
                        Korrespondenten-Abruf
                      </Text>
                      <Text style={[styles.stageSub, { color: colors.textSecondary }]}>
                        Welt-Desk, Forschung, Community & Kultur
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.stageMetric, { color: colors.textPrimary }]}>
                    📡 {telemetry.stage1.sourcesChecked} Quellen in {(telemetry.stage1.durationMs / 1000).toFixed(2)}s abgefragt
                  </Text>
                  <View style={styles.deskTagsRow}>
                    {telemetry.stage1.desks.map(desk => (
                      <View key={desk} style={[styles.deskTag, { backgroundColor: colors.surface }]}>
                        <Text style={[styles.deskTagText, { color: colors.textSecondary }]}>
                          {desk}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>

                {/* Stufe 2 */}
                <View style={[styles.stageCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <View style={styles.stageHeader}>
                    <Text style={styles.stageNumber}>2</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.stageTitle, { color: colors.textPrimary }]}>
                        Newsdesk & Dubletten-Bündelung
                      </Text>
                      <Text style={[styles.stageSub, { color: colors.textSecondary }]}>
                        Themen-Dossiers, Entitäten-Cluster & Anti-Stub-Filter
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.stageMetric, { color: colors.textPrimary }]}>
                    🧹 {telemetry.stage2.rawTextsChecked} Rohtexte geprüft
                  </Text>
                  <Text style={[styles.stageMetricDetail, { color: colors.textSecondary }]}>
                    • {telemetry.stage2.storiesBundled} Themen gebündelt & als Dossier verdichtet{'\n'}
                    • {telemetry.stage2.stubsDiscarded} irrelevante, inhaltsarme oder Werbe-Stubs verworfen
                  </Text>
                </View>

                {/* Stufe 3 */}
                <View style={[styles.stageCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <View style={styles.stageHeader}>
                    <Text style={styles.stageNumber}>3</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.stageTitle, { color: colors.textPrimary }]}>
                        KI-Ressort-Redaktion
                      </Text>
                      <Text style={[styles.stageSub, { color: colors.textSecondary }]}>
                        5 spezialisierte Redaktions-DNAs (Ressort-Archetypen)
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.stageMetric, { color: colors.textPrimary }]}>
                    {telemetry.stage3.mode === 'ai_synthesis'
                      ? `🤖 Paid LLM API (${telemetry.stage3.modelUsed || 'Gemini Pro/Flash'})`
                      : '⚡ Lokale Synthese (Deterministiche Offline-Garantie)'}
                  </Text>
                  {Object.keys(telemetry.stage3.assignedRessorts).length > 0 && (
                    <View style={{ marginTop: 8 }}>
                      <Text style={[styles.subSectionTitle, { color: colors.textSecondary }]}>
                        Ressort-Verteilung:
                      </Text>
                      <View style={styles.deskTagsRow}>
                        {Object.entries(telemetry.stage3.assignedRessorts).map(([ressort, count]) => (
                          <View key={ressort} style={[styles.deskTag, { backgroundColor: colors.surface }]}>
                            <Text style={[styles.deskTagText, { color: colors.textPrimary }]}>
                              {ressort}: {count}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                </View>

                {/* Stufe 4 */}
                <View style={[styles.stageCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <View style={styles.stageHeader}>
                    <Text style={styles.stageNumber}>4</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.stageTitle, { color: colors.textPrimary }]}>
                        Sokratischer Salon
                      </Text>
                      <Text style={[styles.stageSub, { color: colors.textSecondary }]}>
                        Tiefen-Diskurs nach Vorbild von r/DepthHub & r/AskScience
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.stageMetric, { color: colors.textPrimary }]}>
                    💬 {telemetry.stage4.perspectivesGenerated} Perspektiven-Kommentare generiert
                  </Text>
                  <Text style={[styles.stageMetricDetail, { color: colors.textSecondary }]}>
                    {telemetry.stage4.socraticPairsCount} triadische Synthesen (Kontext, Blinder Fleck, Praxisimpuls) für ReaderScreen bereitgestellt.
                  </Text>
                </View>

                {/* Stufe 5 */}
                <View style={[styles.stageCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <View style={styles.stageHeader}>
                    <Text style={styles.stageNumber}>5</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.stageTitle, { color: colors.textPrimary }]}>
                        Chefredaktion · An die Spitze gepinnt
                      </Text>
                      <Text style={[styles.stageSub, { color: colors.textSecondary }]}>
                        Garantierte Platzierung an Position 1, 2, 3…
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.stageMetric, { color: colors.textPrimary, marginBottom: 8 }]}>
                    ✨ {telemetry.stage5.pinnedTopItems.length} Beiträge frisch aus der Redaktion:
                  </Text>
                  {telemetry.stage5.pinnedTopItems.map((item, idx) => (
                    <TouchableOpacity
                      key={item.id}
                      activeOpacity={0.7}
                      onPress={() => {
                        onClose();
                        onSelectArticle?.(item.id);
                      }}
                      style={[styles.pinnedItemRow, { borderBottomColor: colors.border }]}
                    >
                      <Text style={[styles.pinnedIndex, { color: colors.accent }]}>#{idx + 1}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.pinnedTitle, { color: colors.textPrimary }]} numberOfLines={2}>
                          {item.title}
                        </Text>
                        {item.space && (
                          <Text style={[styles.pinnedSpace, { color: colors.textSecondary }]}>
                            {item.space}
                          </Text>
                        )}
                      </View>
                      <Text style={{ color: colors.accent, fontSize: 13, marginLeft: 8 }}>→</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  modalContainer: {
    width: '100%',
    maxWidth: 620,
    maxHeight: '90%',
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 12
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3
  },
  modalSubtitle: {
    fontSize: 12.5,
    marginTop: 2
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center'
  },
  closeButtonText: {
    fontSize: 15,
    fontWeight: '600'
  },
  contentScroll: {
    flex: 1
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 32
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 20,
    textAlign: 'center'
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center'
  },
  emptyText: {
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 400
  },
  summaryBanner: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16
  },
  summaryTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 3
  },
  summaryDescription: {
    fontSize: 12,
    lineHeight: 16
  },
  stageCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12
  },
  stageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10
  },
  stageNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#6366F1',
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 26,
    marginRight: 10
  },
  stageTitle: {
    fontSize: 14,
    fontWeight: '700'
  },
  stageSub: {
    fontSize: 11.5,
    marginTop: 1
  },
  stageMetric: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18
  },
  stageMetricDetail: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4
  },
  deskTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8
  },
  deskTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6
  },
  deskTagText: {
    fontSize: 11,
    fontWeight: '500'
  },
  subSectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4
  },
  pinnedItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  pinnedIndex: {
    fontSize: 12,
    fontWeight: '800',
    width: 28
  },
  pinnedTitle: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 17
  },
  pinnedSpace: {
    fontSize: 11,
    marginTop: 2
  }
});
