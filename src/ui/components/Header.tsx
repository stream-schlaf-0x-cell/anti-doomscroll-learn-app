import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../core/context/AppContext';
import { typography, spacing } from '../theme';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  showThemeToggle?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  title = 'ATEM',
  subtitle = 'Atem Network • Raum für Erkenntnis',
  showThemeToggle = true
}) => {
  const { colors, isDark, setThemePreference } = useApp();

  const handleToggleTheme = () => {
    setThemePreference(isDark ? 'light' : 'dark');
  };

  return (
    <View style={[styles.headerContainer, { borderBottomColor: colors.borderSubtle }]}>
      <View style={styles.headerInner}>
        <View style={styles.titleColumn}>
          <View style={styles.titleRow}>
            <Text style={[styles.logoText, { color: colors.textPrimary }]}>
              {title}
            </Text>
            <View style={[styles.demoTag, { backgroundColor: colors.accentSubtle, borderColor: colors.borderSubtle }]}>
              <Text style={[styles.demoTagText, { color: colors.accent }]}>COMMUNITY</Text>
            </View>
          </View>
          <Text style={[styles.subtitleText, { color: colors.textMuted }]}>
            {subtitle}
          </Text>
        </View>

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
