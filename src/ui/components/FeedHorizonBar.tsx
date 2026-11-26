import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Animated
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FeedSortMode } from '../../core/domain/ranking';
import { FeedOperationResult } from '../../core/feed/FeedOperationManager';
import { ThemeColors, radius, spacing } from '../theme';

export interface FeedHorizonBarProps {
  activeSortMode: FeedSortMode;
  onSortChange: (mode: FeedSortMode) => void;
  isDesktop: boolean;
  isScrolledDown: boolean;
  horizonBarVisible: boolean;
  horizonBarAnim: Animated.Value;
  stickyHorizonBarHeight: number;
  onFocus?: () => void;
  onBlur?: (event: unknown) => void;
  isRunningManualPipeline: boolean;
  manualPipelineStageLabel: string;
  onRunManualResearchPipeline: () => void;
  lastOperationResult: FeedOperationResult | null;
  onOpenReport: () => void;
  refreshing: boolean;
  onRefresh: () => void;
  colors: ThemeColors;
}

interface HorizonTabDefinition {
  mode: FeedSortMode;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  isSelected: (mode: FeedSortMode) => boolean;
}

const HORIZON_TABS: HorizonTabDefinition[] = [
  {
    mode: 'for_you',
    label: 'Für dich',
    icon: 'flame-outline',
    isSelected: (mode) => mode === 'for_you' || mode === 'hot'
  },
  {
    mode: 'today',
    label: 'Heute',
    icon: 'flash-outline',
    isSelected: (mode) => mode === 'today' || mode === 'new'
  },
  {
    mode: 'discourse',
    label: 'Diskurs',
    icon: 'compass-outline',
    isSelected: (mode) => mode === 'discourse'
  },
  {
    mode: 'top',
    label: 'Top',
    icon: 'trophy-outline',
    isSelected: (mode) => mode === 'top'
  },
  {
    mode: 'timeless',
    label: 'Zeitlos',
    icon: 'diamond-outline',
    isSelected: (mode) => mode === 'timeless' || mode === 'gems'
  }
];

const FeedHorizonBarInner: React.FC<FeedHorizonBarProps> = ({
  activeSortMode,
  onSortChange,
  isDesktop,
  isScrolledDown,
  horizonBarVisible,
  horizonBarAnim,
  stickyHorizonBarHeight,
  onFocus,
  onBlur,
  isRunningManualPipeline,
  manualPipelineStageLabel,
  onRunManualResearchPipeline,
  lastOperationResult,
  onOpenReport,
  refreshing,
  onRefresh,
  colors
}) => {
  const webFocusProps: Record<string, unknown> =
    Platform.OS === 'web'
      ? {
          onFocus,
          onBlur
        }
      : {};

  return (
    <Animated.View
      pointerEvents={horizonBarVisible ? 'auto' : 'none'}
      style={[
        styles.stickyHorizonBarOuter,
        {
          backgroundColor: colors.background,
          borderBottomColor: isScrolledDown ? colors.borderSubtle : 'transparent',
          paddingHorizontal: isDesktop ? 0 : spacing.pageHorizontal,
          opacity: horizonBarAnim,
          transform: [
            {
              translateY: horizonBarAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [-(stickyHorizonBarHeight + 12), 0]
              })
            }
          ]
        },
        isScrolledDown && styles.stickyHorizonBarElevated
      ]}
      {...webFocusProps}
    >
      <View style={[styles.stickyHorizonBarInner, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizonScrollRow}
          style={styles.horizonScrollView}
        >
          {HORIZON_TABS.map((tab) => {
            const selected = tab.isSelected(activeSortMode);
            const activeTint = selected ? colors.accent : colors.textSecondary;

            return (
              <TouchableOpacity
                key={tab.mode}
                onPress={() => onSortChange(tab.mode)}
                style={[
                  styles.sortTab,
                  !isDesktop && styles.sortTabTouchTarget,
                  selected && { backgroundColor: colors.accentSubtle, borderColor: colors.accent }
                ]}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
              >
                <Ionicons name={tab.icon} size={14} color={activeTint} />
                <Text style={[styles.sortTabText, { color: activeTint }]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}

          <View style={[styles.horizonBarDivider, { backgroundColor: colors.borderSubtle }]} />

          <TouchableOpacity
            onPress={onRunManualResearchPipeline}
            disabled={isRunningManualPipeline}
            style={[
              styles.sortTab,
              !isDesktop && styles.sortTabTouchTarget,
              {
                backgroundColor: isRunningManualPipeline ? colors.accentSubtle : colors.surfaceSecondary,
                borderColor: isRunningManualPipeline ? colors.accent : colors.borderSubtle
              }
            ]}
            accessibilityRole="button"
            accessibilityLabel="Recherche jetzt starten"
          >
            {isRunningManualPipeline ? (
              <ActivityIndicator size="small" color={colors.accent} style={styles.inlineSpinner} />
            ) : (
              <Ionicons name="sparkles-outline" size={13} color={colors.accent} />
            )}
            <Text
              style={[
                styles.sortTabText,
                styles.actionTabText,
                { color: isRunningManualPipeline ? colors.accent : colors.textPrimary }
              ]}
              numberOfLines={1}
            >
              {isRunningManualPipeline
                ? `Pipeline: ${manualPipelineStageLabel || 'Läuft…'}`
                : 'Recherche jetzt starten'}
            </Text>
          </TouchableOpacity>

          {lastOperationResult && (
            <TouchableOpacity
              onPress={onOpenReport}
              style={[
                styles.sortTab,
                !isDesktop && styles.sortTabTouchTarget,
                {
                  backgroundColor: colors.accentSubtle,
                  borderColor: colors.accent
                }
              ]}
              accessibilityRole="button"
              accessibilityLabel="Recherchereport öffnen"
            >
              <Ionicons name="document-text-outline" size={13} color={colors.accent} />
              <Text style={[styles.sortTabText, styles.actionTabText, { color: colors.accent }]} numberOfLines={1}>
                Bericht ({lastOperationResult.insertedCount} neu)
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        {/* Compact 1-Tap Reload Button (WCAG 2.5.1 clickable equivalent for pull-to-refresh) */}
        <TouchableOpacity
          onPress={onRefresh}
          disabled={refreshing}
          style={[
            styles.compactReloadBtn,
            !isDesktop && styles.compactReloadBtnTouch,
            {
              backgroundColor: refreshing ? colors.accentSubtle : colors.surfaceSecondary,
              borderColor: refreshing ? colors.accent : colors.borderSubtle
            }
          ]}
          accessibilityRole="button"
          accessibilityLabel="Feed mit frischen Inhalten neu laden"
          accessibilityState={{ busy: refreshing }}
        >
          {refreshing ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <Ionicons name="refresh-outline" size={16} color={colors.textPrimary} />
          )}
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

export const FeedHorizonBar = React.memo(FeedHorizonBarInner);
FeedHorizonBar.displayName = 'FeedHorizonBar';

const styles = StyleSheet.create({
  stickyHorizonBarOuter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 25,
    paddingTop: 6,
    paddingBottom: 4,
    borderBottomWidth: 0.5
  },
  stickyHorizonBarElevated: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4
  },
  stickyHorizonBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 6
  },
  horizonScrollView: {
    flex: 1,
    minWidth: 0
  },
  horizonScrollRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingRight: 4
  },
  sortTab: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 36,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'transparent',
    gap: 5
  },
  sortTabTouchTarget: {
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  horizonBarDivider: {
    width: 1,
    height: 20,
    marginHorizontal: 2
  },
  compactReloadBtn: {
    minWidth: 36,
    minHeight: 36,
    paddingHorizontal: 9,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  compactReloadBtnTouch: {
    minWidth: 44,
    minHeight: 44,
    paddingHorizontal: 10
  },
  sortTabText: {
    fontSize: 12,
    fontWeight: '700'
  },
  actionTabText: {
    fontSize: 11.5
  },
  inlineSpinner: {
    marginRight: 4
  }
});
