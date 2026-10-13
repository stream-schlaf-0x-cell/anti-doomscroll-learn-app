import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../core/context/AppContext';
import { typography, radius } from '../theme';

interface ReadingTimeBadgeProps {
  minutes: number;
}

export const ReadingTimeBadge: React.FC<ReadingTimeBadgeProps> = ({ minutes }) => {
  const { colors } = useApp();

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceSecondary }]}>
      <Ionicons name="time-outline" size={11} color={colors.textMuted} style={{ marginRight: 3 }} />
      <Text style={[styles.text, { color: colors.textSecondary }]}>
        {minutes} Min.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.pill
  },
  text: {
    fontSize: typography.sizes.micro,
    fontWeight: '500'
  }
});
