import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PullToRefreshPhase, PULL_REFRESH_MAX } from '../../core/feed/scrollUxController';
import { ThemeColors, typography, radius, spacing } from '../theme';

export interface PullToRefreshIndicatorProps {
  pullDistance: number;
  progress: number;
  phase: PullToRefreshPhase;
  onTriggerRefresh: () => void;
  colors: ThemeColors;
  isDark: boolean;
}

export const PullToRefreshIndicator: React.FC<PullToRefreshIndicatorProps> = ({
  pullDistance,
  progress,
  phase,
  onTriggerRefresh,
  colors,
  isDark
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: phase === 'ready' ? 1.04 : 1,
      friction: 7,
      tension: 160,
      useNativeDriver: Platform.OS !== 'web'
    }).start();
  }, [phase, scaleAnim]);

  if (phase === 'idle') {
    return null;
  }

  const isReady = phase === 'ready';
  const isRefreshing = phase === 'refreshing';

  const containerHeight = isRefreshing
    ? 60
    : Math.max(52, Math.min(PULL_REFRESH_MAX + 8, Math.round(pullDistance + 12)));

  const rotationDeg = `${Math.round(Math.max(0, Math.min(1, progress)) * 180)}deg`;
  const pillOpacity = isRefreshing || isReady ? 1 : Math.min(1, 0.45 + progress * 0.55);

  const label = isRefreshing
    ? 'Lade frische Inhalte…'
    : isReady
    ? 'Loslassen zum Neu-Laden'
    : 'Ziehen für neue Inhalte';

  const pillBackground = isReady
    ? colors.accent
    : isRefreshing
    ? colors.accentSubtle
    : colors.surface;

  const pillBorderColor = isReady || isRefreshing ? colors.accent : colors.border;
  const textColor = isReady ? '#FFFFFF' : isRefreshing ? colors.accent : colors.textPrimary;
  const iconColor = isReady ? '#FFFFFF' : colors.accent;

  return (
    <View
      style={[
        styles.wrapper,
        {
          height: containerHeight
        }
      ]}
    >
      <Animated.View
        style={{
          opacity: pillOpacity,
          transform: [{ scale: scaleAnim }]
        }}
      >
        <TouchableOpacity
          onPress={onTriggerRefresh}
          disabled={isRefreshing}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityState={{ busy: isRefreshing }}
          style={[
            styles.pillButton,
            {
              backgroundColor: pillBackground,
              borderColor: pillBorderColor,
              shadowColor: isDark ? '#000000' : colors.accent,
              shadowOpacity: isReady ? 0.24 : 0.08
            }
          ]}
        >
          {isRefreshing ? (
            <ActivityIndicator size="small" color={colors.accent} style={styles.iconSpacer} />
          ) : (
            <View
              style={[
                styles.iconCircle,
                {
                  backgroundColor: isReady ? 'rgba(255, 255, 255, 0.2)' : colors.accentSubtle,
                  transform: [{ rotate: rotationDeg }]
                }
              ]}
            >
              <Ionicons name="refresh" size={16} color={iconColor} />
            </View>
          )}
          <Text
            accessibilityLiveRegion="polite"
            style={[
              styles.labelText,
              { color: textColor }
            ]}
            numberOfLines={1}
          >
            {label}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    paddingHorizontal: spacing.pageHorizontal
  },
  pillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    gap: 8,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    elevation: 3
  },
  iconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center'
  },
  iconSpacer: {
    marginRight: 2
  },
  labelText: {
    fontFamily: typography.fontFamilies.sans,
    fontSize: typography.sizes.caption + 1,
    fontWeight: '700',
    letterSpacing: 0.1
  }
});
