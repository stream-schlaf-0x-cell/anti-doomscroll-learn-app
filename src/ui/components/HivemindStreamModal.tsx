import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../core/context/AppContext';
import { TOPIC_METADATA, FeedItem } from '../../core/domain/types';
import { radius, spacing } from '../theme';
import { generateHivemindStream, HivemindStreamResult } from '../../core/synthesis/onTheFlyStreamService';
import { feedRepository } from '../../core/data/feedRepository';
import { loadAiCredentials } from '../../core/ai/atmenAiClient';
import { QuizCheckpointCard } from './QuizCheckpointCard';

interface HivemindStreamModalProps {
  visible: boolean;
  onClose: () => void;
  onStreamGenerated?: (items: FeedItem[]) => void;
}

const SUGGESTIONS = [
  'Wie verändert Agentic AI das Bildungssystem?',
  'Erkenntnistheorie des Radikalen Konstruktivismus',
  'Neurokognition und Tiefschlaf-Atemprotokolle',
  'Dialektik von Beschleunigung und digitaler Souveränität',
  'Modulare Klangsynthese als kontemplative Praxis'
];

export const HivemindStreamModal: React.FC<HivemindStreamModalProps> = ({
  visible,
  onClose,
  onStreamGenerated
}) => {
  const { colors, refreshFeed, openArticle, selectedFilter } = useApp();
  const [queryInput, setQueryInput] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [result, setResult] = useState<HivemindStreamResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async (customPrompt?: string) => {
    const prompt = (customPrompt ?? queryInput).trim();
    if (!prompt) return;

    setIsGenerating(true);
    setError(null);
    try {
      const creds = await loadAiCredentials();
      const res = await generateHivemindStream({
        seedTopicOrQuestion: prompt,
        targetCount: 4,
        preferredLanguage: 'de',
        credentials: creds,
        space: selectedFilter !== 'all' ? selectedFilter : undefined
      });
      setResult(res);
      if (onStreamGenerated) {
        onStreamGenerated(res.items);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Fehler bei der Synthese.';
      setError(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleIntegrateIntoFeed = async () => {
    if (result && result.items.length > 0) {
      feedRepository.addItems(result.items);
    }
    await refreshFeed();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.borderSubtle }]}>
          <View style={styles.headerTitleGroup}>
            <View style={styles.headerBadgeRow}>
              <Ionicons name="git-network-outline" size={18} color={colors.accent} style={{ marginRight: 6 }} />
              <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Hivemind Epistemic Stream</Text>
            </View>
            <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
              4-stufige dialektische Tiefensynthese: Kernthese → Mechanik → Antithese → Synthese
            </Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            style={[styles.closeButton, { backgroundColor: colors.surfaceSecondary }]}
            accessibilityRole="button"
            accessibilityLabel="Hivemind-Stream schließen"
          >
            <Ionicons name="close" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {!result ? (
            /* Input & Prompt Step */
            <View style={styles.promptSection}>
              <View style={[styles.promptCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
                <Text style={[styles.promptLabel, { color: colors.textPrimary }]}>
                  Zu welchem Thema oder welcher Leitfrage möchtest du einen epistemischen Stream generieren?
                </Text>

                <TextInput
                  style={[styles.input, { backgroundColor: colors.surfaceSecondary, color: colors.textPrimary, borderColor: colors.borderSubtle }]}
                  placeholder="z. B. Wie verändert Agentic AI das Bildungssystem?"
                  placeholderTextColor={colors.textMuted}
                  value={queryInput}
                  onChangeText={setQueryInput}
                  multiline
                  numberOfLines={3}
                />

                <TouchableOpacity
                  onPress={() => handleGenerate()}
                  disabled={isGenerating || !queryInput.trim()}
                  style={[
                    styles.generateButton,
                    { backgroundColor: queryInput.trim() ? colors.accent : colors.surfaceSecondary }
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Hivemind Stream jetzt generieren"
                >
                  {isGenerating ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="sparkles-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                      <Text style={[styles.generateButtonText, { color: queryInput.trim() ? '#FFFFFF' : colors.textMuted }]}>
                        Stream jetzt generieren
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                {error && (
                  <Text style={[styles.errorText, { color: '#EF4444' }]}>{error}</Text>
                )}
              </View>

              {/* Suggestions */}
              <View style={styles.suggestionsContainer}>
                <Text style={[styles.suggestionsTitle, { color: colors.textMuted }]}>Inspirierende Impulse:</Text>
                <View style={styles.suggestionsList}>
                  {SUGGESTIONS.map(s => (
                    <TouchableOpacity
                      key={s}
                      onPress={() => {
                        setQueryInput(s);
                        void handleGenerate(s);
                      }}
                      style={[styles.suggestionChip, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
                    >
                      <Ionicons name="arrow-forward-circle-outline" size={14} color={colors.accent} style={{ marginRight: 6 }} />
                      <Text style={[styles.suggestionText, { color: colors.textPrimary }]}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          ) : (
            /* Results Display Step */
            <View style={styles.resultSection}>
              {/* Summary Banner */}
              <View style={[styles.summaryBanner, { backgroundColor: colors.accentSubtle, borderColor: colors.accent }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.summaryTopic, { color: colors.accent }]}>
                    {TOPIC_METADATA[result.topic]?.label || result.topic} • 4 Stufen
                  </Text>
                  <Text style={[styles.summaryTitle, { color: colors.textPrimary }]}>{result.synthesisTitle}</Text>
                  {result.isAiGenerated ? (
                    <View style={{ backgroundColor: '#10B98118', borderColor: '#10B981', borderWidth: 1, paddingHorizontal: 7, paddingVertical: 3, borderRadius: radius.sm, flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginTop: 4 }}>
                      <Ionicons name="sparkles" size={12} color="#10B981" />
                      <Text style={{ fontSize: 11, color: '#10B981', fontWeight: '700' }}>
                        🟢 Live Gemini KI ({result.modelUsed || 'Gemini'})
                      </Text>
                    </View>
                  ) : (
                    <View style={{ backgroundColor: colors.surface, borderColor: colors.borderSubtle, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 3, borderRadius: radius.sm, flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginTop: 4 }}>
                      <Ionicons name="hardware-chip-outline" size={12} color={colors.textMuted} />
                      <Text style={{ fontSize: 11, color: colors.textMuted, fontWeight: '600' }}>
                        ⚪ Lokaler Offline-Generator
                      </Text>
                    </View>
                  )}
                </View>
                <TouchableOpacity
                  onPress={() => setResult(null)}
                  style={[styles.resetButton, { backgroundColor: colors.surface }]}
                >
                  <Ionicons name="refresh-outline" size={14} color={colors.textPrimary} style={{ marginRight: 4 }} />
                  <Text style={[styles.resetButtonText, { color: colors.textPrimary }]}>Neues Thema</Text>
                </TouchableOpacity>
              </View>

              {/* 4 Cards */}
              <View style={styles.cardsList}>
                {result.items.map((item, index) => (
                  <View
                    key={item.id}
                    style={[styles.stageCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
                  >
                    <View style={styles.stageHeader}>
                      <View style={[styles.stageBadge, { backgroundColor: colors.accentSubtle }]}>
                        <Text style={[styles.stageBadgeText, { color: colors.accent }]}>{item.flair || `Stufe ${index + 1}`}</Text>
                      </View>
                      <Text style={[styles.readingTime, { color: colors.textMuted }]}>
                        {item.estimatedReadingMinutes} Min. Lesezeit
                      </Text>
                    </View>

                    <Text style={[styles.itemTitle, { color: colors.textPrimary }]}>{item.title}</Text>
                    <Text style={[styles.itemSubtitle, { color: colors.textSecondary }]}>{item.subtitle}</Text>
                    <Text style={[styles.itemText, { color: colors.textPrimary }]}>{item.feedText}</Text>

                    {item.keyInsight ? (
                      <View style={[styles.insightBox, { backgroundColor: colors.surfaceSecondary, borderLeftColor: colors.accent }]}>
                        <Ionicons name="bulb-outline" size={16} color={colors.accent} style={{ marginRight: 6, marginTop: 1 }} />
                        <Text style={[styles.insightText, { color: colors.textPrimary }]}>{item.keyInsight}</Text>
                      </View>
                    ) : null}

                    {/* Quiz Checkpoint Card */}
                    {item.quiz && (
                      <View style={{ marginTop: spacing.md }}>
                        <QuizCheckpointCard questions={[item.quiz]} compact={true} />
                      </View>
                    )}

                    <TouchableOpacity
                      onPress={() => {
                        onClose();
                        void openArticle(item.id);
                      }}
                      style={[styles.readButton, { borderTopColor: colors.borderSubtle }]}
                    >
                      <Ionicons name="book-outline" size={14} color={colors.accent} style={{ marginRight: 4 }} />
                      <Text style={[styles.readButtonText, { color: colors.accent }]}>Vollständigen Text im Reader öffnen →</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>

              {/* Action Buttons */}
              <View style={styles.actionRow}>
                <TouchableOpacity
                  onPress={handleIntegrateIntoFeed}
                  style={[styles.integrateButton, { backgroundColor: colors.accent }]}
                  accessibilityRole="button"
                  accessibilityLabel="In Feed einbinden"
                >
                  <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.integrateButtonText}>In Feed einbinden & schließen</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
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
  headerBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2
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
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl
  },
  promptSection: {
    gap: spacing.lg
  },
  promptCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md
  },
  promptLabel: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21
  },
  input: {
    minHeight: 80,
    borderRadius: radius.sm,
    borderWidth: 1,
    padding: spacing.md,
    fontSize: 14,
    textAlignVertical: 'top'
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: radius.sm
  },
  generateButtonText: {
    fontWeight: '700',
    fontSize: 14
  },
  errorText: {
    fontSize: 12,
    marginTop: 4
  },
  suggestionsContainer: {
    gap: spacing.xs
  },
  suggestionsTitle: {
    fontSize: 12,
    fontWeight: '600'
  },
  suggestionsList: {
    gap: spacing.xs
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1
  },
  suggestionText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1
  },
  resultSection: {
    gap: spacing.lg
  },
  summaryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1
  },
  summaryTopic: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase'
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 2
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill
  },
  resetButtonText: {
    fontSize: 12,
    fontWeight: '600'
  },
  cardsList: {
    gap: spacing.lg
  },
  stageCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.lg
  },
  stageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs
  },
  stageBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.xs
  },
  stageBadgeText: {
    fontSize: 11,
    fontWeight: '700'
  },
  readingTime: {
    fontSize: 11
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 4
  },
  itemSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
    marginBottom: spacing.sm
  },
  itemText: {
    fontSize: 14,
    lineHeight: 22
  },
  insightBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
    borderRadius: radius.xs,
    borderLeftWidth: 3,
    marginTop: spacing.md
  },
  insightText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    flex: 1
  },
  readButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth
  },
  readButtonText: {
    fontSize: 12,
    fontWeight: '700'
  },
  actionRow: {
    marginTop: spacing.md
  },
  integrateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: radius.md
  },
  integrateButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15
  }
});
