import React from 'react';
import { View, Image, StyleSheet, StyleProp, ViewStyle, ImageStyle } from 'react-native';

export interface AtmenSymbolProps {
  /** Size in pixels (width & height). Defaults to 24. */
  size?: number;
  /** Whether dark mode is active. If true, displays luminous cyan/azure glow; if false, crisp deep royal sapphire. */
  isDark?: boolean;
  /** Custom container style */
  style?: StyleProp<ViewStyle>;
  /** Custom image style */
  imageStyle?: StyleProp<ImageStyle>;
}

/**
 * Official Atmen Brand Emblem (The Blue "A" Chevron Arch)
 *
 * Represents the rhythm of breath (inhale/exhale curve) and the letter "A".
 * - Night Mode: Vivid cyan/azure glow (#38BDF8) with subtle ambient backlighting.
 * - Day Mode: Rich royal/sapphire blue (#0284C7) with crisp contrast against light surfaces.
 */
export const AtmenSymbol: React.FC<AtmenSymbolProps> = ({
  size = 24,
  isDark = true,
  style,
  imageStyle
}) => {
  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          shadowColor: isDark ? '#38BDF8' : '#0284C7',
          shadowOpacity: isDark ? 0.45 : 0.2,
          shadowRadius: isDark ? Math.max(3, size * 0.25) : 2,
          shadowOffset: { width: 0, height: 1 }
        },
        style
      ]}
      accessibilityRole="image"
      accessibilityLabel="Atmen Logo"
    >
      <Image
        source={require('../../../assets/android-icon-foreground.png')}
        style={[
          styles.image,
          {
            width: size,
            height: size,
            opacity: isDark ? 0.98 : 0.92
          },
          imageStyle
        ]}
        resizeMode="contain"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center'
  },
  image: {
    // Sharp vector-like rendering on Web
  }
});

export default AtmenSymbol;
