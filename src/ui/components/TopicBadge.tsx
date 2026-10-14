import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TopicTag, TOPIC_METADATA } from '../../core/domain/types';
import { useApp } from '../../core/context/AppContext';
import { typography, radius } from '../theme';

interface TopicBadgeProps {
  topic: TopicTag;
  size?: 'sm' | 'md';
}

export const TopicBadge: React.FC<TopicBadgeProps> = ({ topic, size = 'sm' }) => {
  const { colors } = useApp();
  const meta = TOPIC_METADATA[topic] ?? {
    label: topic,
    icon: 'bookmark-outline'
  };

  const isSmall = size === 'sm';

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: colors.badgeBg,
          borderColor: colors.borderSubtle,
          paddingVertical: isSmall ? 3 : 5,
          paddingHorizontal: isSmall ? 8 : 12
        }
      ]}
    >
      <Ionicons
        name={meta.icon as any}
        size={isSmall ? 11 : 14}
        color={colors.accent}
        style={{ marginRight: 4 }}
      />
      <Text
        style={[
          styles.text,
          {
            color: colors.badgeText,
            fontSize: isSmall ? typography.sizes.micro : typography.sizes.caption
          }
        ]}
        numberOfLines={1}
      >
        {meta.label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 0.5,
    alignSelf: 'flex-start'
  },
  text: {
    fontWeight: '600',
    letterSpacing: 0.3
  }
});
