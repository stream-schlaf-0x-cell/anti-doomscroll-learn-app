import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../core/context/AppContext';
import { typography, spacing } from '../theme';
import { UltraMasterModal } from './UltraMasterModal';
import { MobilePublishModal } from './MobilePublishModal';
import { AtmenBreathingPortal } from '../../features/breathing/AtmenBreathingPortal';
import { AtmenSymbol } from './AtmenSymbol';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  showThemeToggle?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  title = 'atmen',
  subtitle = 'atmen network • Raum für Erkenntnis & Souveränität',
  showThemeToggle = true
}) => {
  const { colors, isDark, setThemePreference, goHome } = useApp();
  const [showMaster, setShowMaster] = useState<boolean>(false);
  const [showMobile, setShowMobile] = useState<boolean>(false);
  const [showBreathing, setShowBreathing] = useState<boolean>(false);

  const handleToggleTheme = () => {
    setThemePreference(isDark ? 'light' : 'dark');
  };

  return (
    <>
      <View style={[styles.headerContainer, { borderBottomColor: colors.borderSubtle }]}>
        <View style={styles.headerInner}>
          <View style={styles.titleColumn}>
            <TouchableOpacity
              onPress={goHome}
              activeOpacity={0.7}
              style={styles.titleRow}
              accessibilityRole="button"
              accessibilityLabel="Zurück zur Home Startseite"
            >
              <AtmenSymbol size={22} isDark={isDark} style={{ marginRight: 6 }} />
              <Text style={[styles.logoText, { color: colors.textPrimary }]}>
                {title}
              </Text>
              <View style={[styles.demoTag, { backgroundColor: colors.accentSubtle, borderColor: colors.borderSubtle }]}>
                <Text style={[styles.demoTagText, { color: colors.accent }]}>COMMUNITY</Text>
              </View>
            </TouchableOpacity>
            <Text style={[styles.subtitleText, { color: colors.textMuted }]}>
              {subtitle}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <TouchableOpacity
              onPress={goHome}
              style={[styles.themeToggle, { backgroundColor: colors.accentSubtle }]}
              accessibilityRole="button"
              accessibilityLabel="Home Menü öffnen"
            >
              <Ionicons name="home" size={16} color={colors.accent} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowMaster(true)}
              style={[styles.themeToggle, { backgroundColor: '#F59E0B' + '22' }]}
              accessibilityRole="button"
              accessibilityLabel="Ultra Master Studio öffnen"
            >
              <Ionicons name="sparkles" size={16} color="#F59E0B" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowBreathing(true)}
              style={[styles.themeToggle, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}
              accessibilityRole="button"
              accessibilityLabel="Kognitive Atempause & Atem-Simulator starten"
            >
              <Ionicons name="leaf-outline" size={16} color="#10B981" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowMobile(true)}
              style={[styles.themeToggle, { backgroundColor: '#06B6D4' + '22' }]}
              accessibilityRole="button"
              accessibilityLabel="Auf Smartphone öffnen"
            >
              <Ionicons name="phone-portrait-outline" size={16} color="#06B6D4" />
            </TouchableOpacity>

            {showThemeToggle && (
              <TouchableOpacity
                onPress={handleToggleTheme}
                style={[styles.themeToggle, { backgroundColor: colors.surfaceSecondary }]}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel={isDark ? "Helles Erscheinungsbild aktivieren" : "Dunkles Erscheinungsbild aktivieren"}
              >
                <Ionicons
                  name={isDark ? 'sunny-outline' : 'moon-outline'}
                  size={18}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      <UltraMasterModal visible={showMaster} onClose={() => setShowMaster(false)} />
      <MobilePublishModal visible={showMobile} onClose={() => setShowMobile(false)} />
      <AtmenBreathingPortal visible={showBreathing} onClose={() => setShowBreathing(false)} mode="modal" />
    </>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    paddingHorizontal: spacing.pageHorizontal,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 0.5
  },
  headerInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    maxWidth: 780,
    width: '100%',
    alignSelf: 'center'
  },
  titleColumn: {
    flex: 1
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  demoTag: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 0.5
  },
  demoTagText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6
  },
  logoText: {
    fontFamily: typography.fontFamilies.serif,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 2.5
  },
  subtitleText: {
    fontSize: typography.sizes.micro,
    fontWeight: '500',
    letterSpacing: 0.3,
    marginTop: 2
  },
  themeToggle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center'
  }
});
