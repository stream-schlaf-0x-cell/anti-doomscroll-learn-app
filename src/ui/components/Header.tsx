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
  subtitle = 'Tagesausgabe • 13. Oktober 2026',
  showThemeToggle = true
}) => {
  const { colors, isDark, setThemePreference } = useApp();

  const handleToggleTheme = () => {
    setThemePreference(isDark ? 'light' : 'dark');
  };

  return (
    <View style={[styles.headerContainer, { borderBottomColor: colors.borderSubtle }]}>
      <View style={styles.titleColumn}>
        <Text style={[styles.logoText, { color: colors.textPrimary }]}>
          {title}
        </Text>
        <Text style={[styles.subtitleText, { color: colors.textMuted }]}>
          {subtitle}
        </Text>
      </View>

      {showThemeToggle && (
        <TouchableOpacity
          onPress={handleToggleTheme}
          style={[styles.themeToggle, { backgroundColor: colors.surfaceSecondary }]}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons
            name={isDark ? 'sunny-outline' : 'moon-outline'}
            size={18}
            color={colors.textSecondary}
          />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.pageHorizontal,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 0.5
  },
  titleColumn: {
    flex: 1
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
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center'
  }
});
