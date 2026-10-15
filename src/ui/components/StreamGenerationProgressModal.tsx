import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../core/context/AppContext';
import { typography, radius, spacing } from '../theme';

export interface StreamGenerationProgressModalProps {
  visible: boolean;
  spaceName: string;
  progress?: number;
  statusMessage?: string;
  isFinished?: boolean;
  error?: string | null;
  onCompleted?: () => void;
  onCancel?: () => void;
}

interface StepInfo {
  title: string;
  detail: string;
  icon: keyof typeof Ionicons.glyphMap;
  threshold: number;
}

const GENERATION_STEPS: StepInfo[] = [
  {
    title: 'Primärquellen & Evidenz scannen',
    detail: 'Stanford Encyclopedia, arXiv & verifizierte Wissenschaftsquellen',
    icon: 'search-outline',
    threshold: 20
  },
  {
    title: 'Epistemischer Kontrapunkt',
    detail: 'Dialektische Reibung & Sokratische Perspektive (mit 🤖 Banner)',
    icon: 'sparkles-outline',
    threshold: 50
  },
  {
    title: 'Didaktische Entlastung & Humor',
    detail: 'Kulturelle Selbstironie & Transfer gegen kognitive Ermüdung',
    icon: 'happy-outline',
    threshold: 75
  },
  {
    title: 'Bibliotheka-Archivierung',
    detail: 'Dauerhaft autark im persönlichen Wissens-Kanon verankern',
    icon: 'library-outline',
    threshold: 95
  }
];

export const StreamGenerationProgressModal: React.FC<StreamGenerationProgressModalProps> = ({
  visible,
  spaceName,
  progress: controlledProgress,
  statusMessage,
  isFinished: controlledFinished,
  error,
  onCompleted,
  onCancel
}) => {
  const { colors } = useApp();
  const [internalProgress, setInternalProgress] = useState<number>(0);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  const isFinished = controlledFinished ?? (controlledProgress !== undefined ? controlledProgress >= 100 : internalProgress >= 100);
  const currentProgress = controlledProgress !== undefined
    ? controlledProgress
    : (isFinished ? 100 : internalProgress);

  useEffect(() => {
    if (!visible) {
      setInternalProgress(0);
      setElapsedSeconds(0);
      return;
    }

    const timerInterval = setInterval(() => {
      setElapsedSeconds(prev => +(prev + 0.1).toFixed(1));
    }, 100);

    // If no controlled progress is provided, animate smoothly up to 85% while waiting for real completion
    let progressInterval: ReturnType<typeof setInterval> | null = null;
    if (controlledProgress === undefined && !controlledFinished) {
      let current = 0;
      progressInterval = setInterval(() => {
        if (current < 85) {
          current += Math.floor(Math.random() * 5) + 3;
          if (current > 85) current = 85;
          setInternalProgress(current);
        }
      }, 150);
    }

    return () => {
      clearInterval(timerInterval);
      if (progressInterval) clearInterval(progressInterval);
    };
  }, [visible, controlledProgress, controlledFinished]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.iconWrap, { backgroundColor: colors.accentSubtle }]}>
              <Ionicons name="flash" size={20} color={colors.accent} />
            </View>
            <View style={styles.headerTextWrap}>
              <Text style={[styles.title, { color: colors.textPrimary }]}>
                Stream on-the-fly synthetisieren
              </Text>
              <Text style={[styles.spaceLabel, { color: colors.accent }]}>
                {spaceName}
              </Text>
            </View>
          </View>

          {/* Big Progress Bar */}
          <View style={styles.progressContainer}>
            <View style={styles.progressHeaderRow}>
              <Text style={[styles.progressStatusText, { color: error ? '#EF4444' : colors.textSecondary }]}>
                {error ? `✕ ${error}` : (statusMessage || (isFinished ? '✓ Synthese abgeschlossen' : 'Recherchiere & baue Feed-Struktur…'))}
              </Text>
              <Text style={[styles.progressPercentText, { color: error ? '#EF4444' : colors.accent }]}>
                {currentProgress}%
              </Text>
            </View>

            {/* Track */}
            <View style={[styles.track, { backgroundColor: colors.surfaceSecondary }]}>
              <View
                style={[
                  styles.fill,
                  {
                    backgroundColor: error ? '#EF4444' : (isFinished ? '#10B981' : colors.accent),
                    width: `${currentProgress}%`
                  }
                ]}
              />
            </View>
          </View>

          {/* Stepped Process List */}
          <View style={styles.stepsList}>
            {GENERATION_STEPS.map((step, idx) => {
              const isCompleted = currentProgress >= step.threshold;
              const isCurrent = !isCompleted && !error && (idx === 0 || currentProgress >= GENERATION_STEPS[idx - 1].threshold);

              return (
                <View key={step.title} style={styles.stepRow}>
                  <View
                    style={[
                      styles.stepIndicator,
                      {
                        backgroundColor: isCompleted
                          ? '#10B981' + '22'
                          : isCurrent
                          ? colors.accentSubtle
                          : colors.surfaceSecondary,
                        borderColor: isCompleted
                          ? '#10B981'
                          : isCurrent
                          ? colors.accent
                          : colors.borderSubtle
                      }
                    ]}
                  >
                    {isCompleted ? (
                      <Ionicons name="checkmark" size={13} color="#10B981" />
                    ) : isCurrent ? (
                      <ActivityIndicator size="small" color={colors.accent} style={{ transform: [{ scale: 0.6 }] }} />
                    ) : (
                      <Ionicons name={step.icon} size={12} color={colors.textMuted} />
                    )}
                  </View>

                  <View style={styles.stepTextWrap}>
                    <Text
                      style={[
                        styles.stepTitle,
                        {
                          color: isCompleted
                            ? colors.textPrimary
                            : isCurrent
                            ? colors.accent
                            : colors.textMuted,
                          fontWeight: isCurrent ? '600' : '500'
                        }
                      ]}
                    >
                      {step.title}
                    </Text>
                    <Text style={[styles.stepDetail, { color: colors.textMuted }]}>
                      {step.detail}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>

          {/* Footer Info */}
          <View style={[styles.footer, { borderTopColor: colors.borderSubtle }]}>
            <View style={styles.timeInfoRow}>
              <Ionicons name="time-outline" size={13} color={colors.textMuted} style={{ marginRight: 4 }} />
              <Text style={[styles.timeText, { color: colors.textMuted }]}>
                Dauer: {elapsedSeconds}s • 4 Wissenseinheiten
              </Text>
            </View>

            {error ? (
              <TouchableOpacity
                onPress={onCancel}
                style={[styles.readyButton, { backgroundColor: colors.surfaceSecondary }]}
                activeOpacity={0.8}
              >
                <Text style={[styles.readyButtonText, { color: colors.textPrimary }]}>Schließen</Text>
              </TouchableOpacity>
            ) : isFinished ? (
              <TouchableOpacity
                onPress={onCompleted}
                style={[styles.readyButton, { backgroundColor: '#10B981' }]}
                activeOpacity={0.8}
              >
                <Text style={styles.readyButtonText}>Jetzt öffnen ✓</Text>
              </TouchableOpacity>
            ) : onCancel ? (
              <TouchableOpacity
                onPress={onCancel}
                style={{ paddingVertical: 6, paddingHorizontal: 12 }}
                activeOpacity={0.7}
              >
                <Text style={{ color: colors.textMuted, fontSize: 13 }}>Abbrechen</Text>
              </TouchableOpacity>
            ) : null}
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
  card: {
    width: '100%',
    maxWidth: 480,
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.lg,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 10
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm
  },
  headerTextWrap: {
    flex: 1
  },
  title: {
    fontSize: typography.sizes.body,
    fontWeight: '700',
    letterSpacing: -0.2
  },
  spaceLabel: {
    fontSize: typography.sizes.caption,
    fontWeight: '600',
    marginTop: 2
  },
  progressContainer: {
    marginVertical: spacing.sm
  },
  progressHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs
  },
  progressStatusText: {
    fontSize: 12,
    fontWeight: '500'
  },
  progressPercentText: {
    fontSize: 14,
    fontWeight: '700'
  },
  track: {
    height: 8,
    borderRadius: radius.full,
    overflow: 'hidden'
  },
  fill: {
    height: '100%',
    borderRadius: radius.full
  },
  stepsList: {
    marginTop: spacing.md,
    gap: spacing.sm
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start'
  },
  stepIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
    marginTop: 1
  },
  stepTextWrap: {
    flex: 1
  },
  stepTitle: {
    fontSize: 13,
    marginBottom: 1
  },
  stepDetail: {
    fontSize: 11,
    lineHeight: 14
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: 1
  },
  timeInfoRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  timeText: {
    fontSize: 11
  },
  readyButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full
  },
  readyButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600'
  }
});
