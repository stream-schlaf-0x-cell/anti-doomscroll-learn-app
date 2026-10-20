import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TOPIC_SPACE_MAP, TopicTag } from '../../core/domain/types';
export { getSubchannelVisual, getChannelIconName, SubchannelVisualInfo } from '../../core/utils/subchannelVisuals';

interface SubchannelBadgeProps {
  space: string;
  primaryTopic?: TopicTag;
  accentColor?: string;
  icon?: string;
  size?: 'sm' | 'md';
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

const PALETTE_COLORS = [
  '#2563EB', // Blue
  '#059669', // Emerald
  '#7C3AED', // Purple
  '#D97706', // Amber
  '#DB2777', // Pink
  '#0891B2', // Cyan
  '#4F46E5', // Indigo
  '#EA580C', // Orange
  '#0D9488', // Teal
  '#DC2626'  // Red
];

export function getSubchannelTheme(space: string, primaryTopic?: TopicTag, customColor?: string, customIcon?: string): {
  color: string;
  bgTint: string;
  icon: string;
  formattedHandle: string;
} {
  const cleanHandle = space.startsWith('c/') ? space : `c/${space}`;

  // 1. Check topic map if primaryTopic given
  const topicMeta = primaryTopic ? TOPIC_SPACE_MAP[primaryTopic] : undefined;

  // 2. Determine base color
  let color = customColor || topicMeta?.color;
  if (!color) {
    let hash = 0;
    for (let i = 0; i < cleanHandle.length; i++) {
      hash = cleanHandle.charCodeAt(i) + ((hash << 5) - hash);
    }
    const idx = Math.abs(hash) % PALETTE_COLORS.length;
    color = PALETTE_COLORS[idx];
  }

  // 3. Determine icon
  let icon = customIcon || topicMeta?.icon;
  if (!icon) {
    const lower = cleanHandle.toLowerCase();
    if (lower.includes('learn') || lower.includes('didaktik') || lower.includes('schule') || lower.includes('wissen')) {
      icon = 'school-outline';
    } else if (lower.includes('politik') || lower.includes('diskurs') || lower.includes('debatte')) {
      icon = 'chatbubbles-outline';
    } else if (lower.includes('tech') || lower.includes('ai') || lower.includes('code') || lower.includes('apple')) {
      icon = 'hardware-chip-outline';
    } else if (lower.includes('atem') || lower.includes('mind') || lower.includes('zen') || lower.includes('geist')) {
      icon = 'leaf-outline';
    } else if (lower.includes('sound') || lower.includes('musik') || lower.includes('synth')) {
      icon = 'musical-notes-outline';
    } else if (lower.includes('kunst') || lower.includes('art') || lower.includes('galerie')) {
      icon = 'color-palette-outline';
    } else if (lower.includes('meme') || lower.includes('satire')) {
      icon = 'sparkles-outline';
    } else {
      icon = 'planet-outline';
    }
  }

  const bgTint = `${color}18`; // ~10% opacity for subtle, elegant tint

  return {
    color,
    bgTint,
    icon,
    formattedHandle: cleanHandle
  };
}

export const SubchannelBadge: React.FC<SubchannelBadgeProps> = ({
  space,
  primaryTopic,
  accentColor,
  icon: customIcon,
  size = 'sm',
  onPress,
  style
}) => {
  const { color, bgTint, icon, formattedHandle } = getSubchannelTheme(space, primaryTopic, accentColor, customIcon);

  const isSmall = size === 'sm';
  const iconSize = isSmall ? 11 : 13;

  const content = (
    <View
      style={[
        styles.badgeBase,
        isSmall ? styles.badgeSm : styles.badgeMd,
        {
          backgroundColor: bgTint,
          borderColor: `${color}40`,
        },
        style
      ]}
    >
      <Ionicons name={icon as any} size={iconSize} color={color} style={styles.icon} />
      <Text
        style={[
          styles.textBase,
          isSmall ? styles.textSm : styles.textMd,
          { color }
        ]}
        numberOfLines={1}
      >
        {formattedHandle}
      </Text>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel={`Kanal ${formattedHandle} filtern`}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return content;
};

const styles = StyleSheet.create({
  badgeBase: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  badgeSm: {
    paddingHorizontal: 7,
    paddingVertical: 2.5,
  },
  badgeMd: {
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  icon: {
    marginRight: 4,
  },
  textBase: {
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  textSm: {
    fontSize: 11,
    lineHeight: 14,
  },
  textMd: {
    fontSize: 12,
    lineHeight: 16,
  },
});
