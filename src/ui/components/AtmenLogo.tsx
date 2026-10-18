import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle, TextStyle } from 'react-native';
import { AtmenSymbol } from './AtmenSymbol';
import { typography } from '../theme';

export interface AtmenLogoProps {
  /** Size of the emblem in pixels. Defaults to 26. */
  size?: number;
  /** Whether dark theme is active */
  isDark?: boolean;
  /** Presentation variant: 'full' (icon + wordmark), 'mark' (icon only), 'horizontal' (compact row) */
  variant?: 'full' | 'mark' | 'horizontal';
  /** Optional subtitle or tagline */
  showSubtitle?: boolean;
  subtitleText?: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

/**
 * Official Atmen Brand Identity Component
 *
 * Employs the canonical blue stylized "A" / breathing-curve emblem:
 * - Day Mode: Rich royal / sapphire blue (#0284C7 / #0369A1) with strong contrast.
 * - Night Mode: Vivid cyan / azure (#38BDF8 / #0284C7) with subtle ambient glow.
 */
export const AtmenLogo: React.FC<AtmenLogoProps> = ({
  size = 26,
  isDark = true,
  variant = 'horizontal',
  showSubtitle = false,
  subtitleText = 'Ruhiger Wissens-Feed',
  style,
  textStyle
}) => {
  const brandTextColor = isDark ? '#F1F5F9' : '#0F172A';
  const subtitleColor = isDark ? '#94A3B8' : '#64748B';

  if (variant === 'mark') {
    return (
      <View style={[styles.markContainer, style]}>
        <AtmenSymbol size={size} isDark={isDark} />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        variant === 'full' ? styles.columnLayout : styles.rowLayout,
        style
      ]}
      accessibilityRole="header"
      accessibilityLabel="Atmen Logo"
    >
      <AtmenSymbol size={size} isDark={isDark} style={variant === 'full' ? styles.symbolBottomSpacing : styles.symbolRightSpacing} />
      <View style={styles.textContainer}>
        <Text style={[styles.brandText, { color: brandTextColor, fontSize: Math.max(16, size * 0.85) }, textStyle]}>
          Atmen
        </Text>
        {showSubtitle && (
          <Text style={[styles.subtitleText, { color: subtitleColor, fontSize: Math.max(11, size * 0.45) }]}>
            {subtitleText}
          </Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center'
  },
  rowLayout: {
    flexDirection: 'row'
  },
  columnLayout: {
    flexDirection: 'column',
    justifyContent: 'center'
  },
  markContainer: {
    justifyContent: 'center',
    alignItems: 'center'
  },
  symbolRightSpacing: {
    marginRight: 8
  },
  symbolBottomSpacing: {
    marginBottom: 6
  },
  textContainer: {
    justifyContent: 'center'
  },
  brandText: {
    fontFamily: typography.fontFamilies.serif,
    fontWeight: '700',
    letterSpacing: -0.4
  },
  subtitleText: {
    fontFamily: typography.fontFamilies.sans,
    letterSpacing: 0.2,
    marginTop: -1
  }
});

export default AtmenLogo;
