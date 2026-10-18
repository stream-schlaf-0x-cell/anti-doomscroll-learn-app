import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  TouchableOpacity,
  Modal,
  Animated,
  Linking
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../core/context/AppContext';
import { typography, radius, spacing } from '../../ui/theme';

export interface AtmenBreathingPortalProps {
  visible?: boolean;
  mode: 'modal' | 'inline';
  onClose?: () => void;
  height?: number;
}

export const ATEM_APP_URL = 'https://stream-schlaf-0x-cell.github.io/atem/';

export const AtmenBreathingPortal: React.FC<AtmenBreathingPortalProps> = ({
  visible = true,
  mode,
  onClose,
  height = 420
}) => {
  const { colors } = useApp();
  const [phaseText, setPhaseText] = useState<'Einatmen' | 'Halten' | 'Ausatmen'>('Einatmen');
  const breathAnim = useRef(new Animated.Value(1)).current;

  // Native breathing cycle fallback for non-web platforms (4s Einatmen, 2s Halten, 6s Ausatmen)
  useEffect(() => {
    if (Platform.OS === 'web') return;

    let isMounted = true;
    const runCycle = () => {
      if (!isMounted) return;
      setPhaseText('Einatmen');
      Animated.timing(breathAnim, {
        toValue: 1.45,
        duration: 4000,
        useNativeDriver: true
      }).start(() => {
        if (!isMounted) return;
        setPhaseText('Halten');
        setTimeout(() => {
          if (!isMounted) return;
          setPhaseText('Ausatmen');
          Animated.timing(breathAnim, {
            toValue: 1.0,
            duration: 6000,
            useNativeDriver: true
          }).start(() => {
            if (isMounted) {
              runCycle();
            }
          });
        }, 2000);
      });
    };

    runCycle();
    return () => {
      isMounted = false;
    };
  }, [breathAnim]);

  const renderContent = () => {
    if (Platform.OS === 'web') {
      return React.createElement('iframe', {
        src: ATEM_APP_URL,
        title: 'Atmen App',
        allow: 'autoplay; fullscreen',
        style: {
          width: '100%',
          height: mode === 'inline' ? height : '100%',
          border: 'none',
          borderRadius: mode === 'inline' ? 16 : 0,
          backgroundColor: '#0B111E'
        }
      });
    }

    // Native fallback visualizer
    return (
      <View style={[styles.nativeContainer, { height: mode === 'inline' ? height : '100%', backgroundColor: '#0B111E' }]}>
        <Animated.View
          style={[
            styles.nativeBreathingCircle,
            {
              transform: [{ scale: breathAnim }],
              borderColor: colors.accent,
              backgroundColor: colors.accent + '22'
            }
          ]}
        >
          <Text style={styles.nativePhaseText}>{phaseText}</Text>
          <Text style={styles.nativeSubText}>4s • 2s • 6s</Text>
        </Animated.View>

        <TouchableOpacity
          onPress={() => Linking.openURL(ATEM_APP_URL)}
          style={[styles.nativeLinkBtn, { backgroundColor: colors.accent }]}
          accessibilityRole="button"
          accessibilityLabel="Atem-App im Browser öffnen"
        >
          <Ionicons name="open-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text style={styles.nativeLinkText}>Atmen Vollbild-Web-App öffnen</Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (mode === 'modal') {
    return (
      <Modal visible={visible} transparent={false} animationType="fade" onRequestClose={onClose}>
        <View style={styles.modalRoot}>
          {/* Top Bar */}
          <View style={[styles.modalHeader, { backgroundColor: '#0B111E', borderBottomColor: colors.borderSubtle }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={[styles.iconPill, { backgroundColor: colors.accent + '25' }]}>
                <Ionicons name="fitness-outline" size={16} color={colors.accent} />
              </View>
              <View>
                <Text style={styles.modalTitle}>Atmen • Bewusstes Innehalten</Text>
                <Text style={styles.modalSubtitle}>Geführte Atemrhythmen zur mentalen Zentrierung</Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: 'rgba(255,255,255,0.1)' }]}
              accessibilityRole="button"
              accessibilityLabel="Atem-Portal schließen"
            >
              <Ionicons name="close" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Body */}
          <View style={styles.modalBody}>
            {renderContent()}
          </View>
        </View>
      </Modal>
    );
  }

  // Inline mode
  return (
    <View style={[styles.inlineRoot, { height, borderColor: colors.borderSubtle }]}>
      {renderContent()}
    </View>
  );
};

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    backgroundColor: '#0B111E'
  },
  modalHeader: {
    height: 56,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1
  },
  iconPill: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: typography.sizes.bodySmall,
    fontWeight: '800'
  },
  modalSubtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: typography.sizes.micro
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalBody: {
    flex: 1
  },
  inlineRoot: {
    width: '100%',
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: '#0B111E'
  },
  nativeContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg
  },
  nativeBreathingCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg
  },
  nativePhaseText: {
    color: '#FFFFFF',
    fontSize: typography.sizes.body,
    fontWeight: '800',
    textAlign: 'center'
  },
  nativeSubText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: typography.sizes.micro,
    marginTop: 4
  },
  nativeLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.pill
  },
  nativeLinkText: {
    color: '#FFFFFF',
    fontSize: typography.sizes.caption,
    fontWeight: '700'
  }
});
