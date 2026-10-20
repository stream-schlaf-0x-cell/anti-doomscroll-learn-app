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
  const { colors, isDark, setThemePreference, goHome, activeTab, setActiveTab } = useApp();
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
              onPress={() => {
                setActiveTab('feed');
                goHome();
              }}
              style={[
                styles.themeToggle,
                { backgroundColor: activeTab === 'feed' ? colors.accent : colors.surfaceSecondary }
              ]}
              accessibilityRole="button"
              accessibilityLabel="Stream öffnen"
            >
              <Ionicons
                name="newspaper-outline"
                size={16}
                color={activeTab === 'feed' ? '#FFFFFF' : colors.textPrimary}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActiveTab('network')}
              style={[
                styles.themeToggle,
                { backgroundColor: activeTab === 'network' ? colors.accent : colors.surfaceSecondary }
              ]}
              accessibilityRole="button"
              accessibilityLabel="Kosmos öffnen"
            >
              <Ionicons
                name="planet-outline"
                size={16}
                color={activeTab === 'network' ? '#FFFFFF' : colors.textPrimary}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowMaster(true)}
              style={[styles.themeToggle, { backgroundColor: '#F59E0B' + '22' }]}
              accessibilityRole="button"
              accessibilityLabel="AI Studio & Subchannel-Erstellung öffnen"
            >
              <Ionicons name="sparkles" size={16} color="#F59E0B" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowBreathing(true)}
              style={[styles.themeToggle, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}
              accessibilityRole="button"
              accessibilityLabel="Atmen Portal öffnen"
            >
              <Text style={{ fontSize: 14 }}>🧘</Text>
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
                  size={16}
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
