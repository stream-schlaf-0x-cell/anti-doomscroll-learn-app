import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../core/context/AppContext';
import { typography, radius, spacing } from '../theme';

interface AtemBreathingModalProps {
  visible: boolean;
  onClose: () => void;
  targetRounds?: number;
}

type BreathPhase = 'inhale' | 'hold_in' | 'exhale' | 'hold_out';

const PHASE_CONFIG: Record<BreathPhase, { label: string; sub: string; durationMs: number; targetScale: number; color: string }> = {
  inhale: {
    label: 'Einatmen',
    sub: 'Nimm frische geistige Klarheit auf...',
    durationMs: 4000,
    targetScale: 1.45,
    color: '#06B6D4'
  },
  hold_in: {
    label: 'Halten',
    sub: 'Spüre die Ruhe im Gedanken...',
    durationMs: 4000,
    targetScale: 1.45,
    color: '#38BDF8'
  },
  exhale: {
    label: 'Ausatmen',
    sub: 'Lass das digitale Rauschen los...',
    durationMs: 4000,
    targetScale: 0.9,
    color: '#818CF8'
  },
  hold_out: {
    label: 'Stille',
    sub: 'Kognitive Weite und Gelassenheit...',
    durationMs: 4000,
    targetScale: 0.9,
    color: '#A78BFA'
  }
};

export const AtemBreathingModal: React.FC<AtemBreathingModalProps> = ({
  visible,
  onClose,
  targetRounds = 3
}) => {
  const { colors } = useApp();
  const [phase, setPhase] = useState<BreathPhase>('inhale');
  const [round, setRound] = useState<number>(1);
  const [secondsLeft, setSecondsLeft] = useState<number>(4);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    if (!visible) {
      setPhase('inhale');
      setRound(1);
      setSecondsLeft(4);
      scaleAnim.setValue(1);
      return;
    }

    let isMounted = true;
    let timer: NodeJS.Timeout;

    // Countdown timer for second-by-second indicator
    timer = setInterval(() => {
      setSecondsLeft(prev => (prev > 1 ? prev - 1 : 4));
    }, 1000);

    const runPhase = (currentPhase: BreathPhase, currentRound: number) => {
      if (!isMounted) return;
      setPhase(currentPhase);
      setSecondsLeft(4);

      const config = PHASE_CONFIG[currentPhase];

      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: config.targetScale,
          duration: config.durationMs,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true
        }),
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.8,
            duration: config.durationMs / 2,
            useNativeDriver: true
          }),
          Animated.timing(pulseAnim, {
            toValue: 0.4,
            duration: config.durationMs / 2,
            useNativeDriver: true
          })
        ])
      ]).start(() => {
        if (!isMounted) return;

        // Transition to next phase
        if (currentPhase === 'inhale') {
          runPhase('hold_in', currentRound);
        } else if (currentPhase === 'hold_in') {
          runPhase('exhale', currentRound);
        } else if (currentPhase === 'exhale') {
          runPhase('hold_out', currentRound);
        } else if (currentPhase === 'hold_out') {
          if (currentRound < targetRounds) {
            setRound(currentRound + 1);
            runPhase('inhale', currentRound + 1);
          } else {
            // Completed cycle
            setRound(targetRounds);
          }
        }
      });
    };

    runPhase('inhale', 1);

    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [visible, targetRounds, scaleAnim, pulseAnim]);

  const currentConfig = PHASE_CONFIG[phase];
  const isCompleted = round >= targetRounds && phase === 'hold_out' && secondsLeft <= 1;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={[styles.iconWrap, { backgroundColor: 'rgba(6, 182, 212, 0.15)' }]}>
                <Ionicons name="leaf-outline" size={20} color="#06B6D4" />
              </View>
              <View>
                <Text style={[styles.title, { color: colors.textPrimary }]}>
                  Kognitive Atempause
                </Text>
                <Text style={[styles.roundLabel, { color: colors.textMuted }]}>
                  Quadratatmung (4-4-4-4) • Runde {round} von {targetRounds}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeButton, { backgroundColor: colors.surfaceSecondary }]}
              accessibilityLabel="Atempause beenden"
            >
              <Ionicons name="close" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Central Breathing Orb */}
          <View style={styles.orbStage}>
            {/* Outer soft glowing ring */}
            <Animated.View
              style={[
                styles.glowRing,
                {
                  borderColor: currentConfig.color,
                  opacity: pulseAnim,
                  transform: [{ scale: scaleAnim }]
                }
              ]}
            />

            {/* Inner breathing orb */}
            <Animated.View
              style={[
                styles.breathingOrb,
                {
                  backgroundColor: currentConfig.color,
                  transform: [{ scale: scaleAnim }]
                }
              ]}
            >
              <Text style={styles.orbCountdown}>
                {secondsLeft}s
              </Text>
            </Animated.View>
          </View>

          {/* Dynamic Mindful Text */}
          <View style={styles.textContainer}>
            <Text style={[styles.phaseTitle, { color: currentConfig.color }]}>
              {currentConfig.label}
            </Text>
            <Text style={[styles.phaseSub, { color: colors.textSecondary }]}>
              {currentConfig.sub}
            </Text>
          </View>

          {/* Action / Done Button */}
          <View style={styles.footer}>
            <TouchableOpacity
              onPress={onClose}
              style={[
                styles.finishBtn,
                { backgroundColor: isCompleted ? '#10B981' : colors.surfaceSecondary }
              ]}
            >
              <Ionicons
                name={isCompleted ? "checkmark-circle" : "arrow-back"}
                size={16}
                color={isCompleted ? "#FFFFFF" : colors.textPrimary}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.finishBtnText, { color: isCompleted ? "#FFFFFF" : colors.textPrimary }]}>
                {isCompleted ? 'Erfrischt zum Feed zurück' : 'Atempause beenden'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md
  },
  container: {
    width: '100%',
    maxWidth: 420,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm
  },
  title: {
    fontSize: typography.sizes.body,
    fontWeight: '700',
    letterSpacing: -0.2
  },
  roundLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center'
  },
  orbStage: {
    width: 220,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.md
  },
  glowRing: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    borderWidth: 2
  },
  breathingOrb: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#06B6D4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 15,
    elevation: 8
  },
  orbCountdown: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF'
  },
  textContainer: {
    alignItems: 'center',
    marginVertical: spacing.md
  },
  phaseTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: 4
  },
  phaseSub: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: spacing.md
  },
  footer: {
    width: '100%',
    marginTop: spacing.md
  },
  finishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: radius.md
  },
  finishBtnText: {
    fontSize: 14,
    fontWeight: '600'
  }
});
