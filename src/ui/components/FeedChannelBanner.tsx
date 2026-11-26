import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Subchannel } from '../../core/spaces/spaceRepository';
import { ThemeColors, radius, spacing } from '../theme';

export interface FeedChannelBannerProps {
  selectedFilter: string;
  activeSpace?: Subchannel;
  activeSpaceName: string;
  isFlourishingChannel: boolean;
  flourishStageText: string;
  onFlourishChannel: () => void;
  onEditChannel?: (space: Subchannel) => void;
  onResetFilter: () => void;
  colors: ThemeColors;
}

const FeedChannelBannerInner: React.FC<FeedChannelBannerProps> = ({
  selectedFilter,
  activeSpace,
  activeSpaceName,
  isFlourishingChannel,
  flourishStageText,
  onFlourishChannel,
  onEditChannel,
  onResetFilter,
  colors
}) => {
  const accentColor = activeSpace?.accentColor || colors.accent;
  const iconName = (activeSpace?.icon as keyof typeof Ionicons.glyphMap | undefined) || 'planet-outline';

  return (
    <View
      style={[
        styles.activeFilterBanner,
        { backgroundColor: colors.surface, borderColor: colors.borderSubtle }
      ]}
    >
      <View style={styles.identityRow}>
        <View style={[styles.iconBadge, { backgroundColor: `${accentColor}20` }]}>
          <Ionicons name={iconName} size={14} color={accentColor} />
        </View>
        <View style={styles.titleColumn}>
          <Text style={[styles.activeFilterBannerTitle, { color: colors.textPrimary }]}>
            <Text style={{ color: accentColor, fontWeight: '700' }}>
              {activeSpace?.handle || selectedFilter}
            </Text>
            {' · '}
            {activeSpaceName}
          </Text>
          {activeSpace?.description ? (
            <Text style={[styles.descriptionText, { color: colors.textMuted }]} numberOfLines={1}>
              {activeSpace.description}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.actionsRow}>
        <TouchableOpacity
          onPress={onFlourishChannel}
          disabled={isFlourishingChannel}
          style={[
            styles.activeFilterBannerReset,
            {
              backgroundColor: colors.accentSubtle,
              borderColor: colors.accent,
              opacity: isFlourishingChannel ? 0.65 : 1
            }
          ]}
          accessibilityRole="button"
          accessibilityLabel="Kanal aktualisieren"
        >
          {isFlourishingChannel ? (
            <ActivityIndicator size="small" color={colors.accent} style={styles.spinnerSpacing} />
          ) : (
            <Ionicons name="refresh-outline" size={13} color={colors.accent} style={styles.iconSpacingWide} />
          )}
          <Text style={[styles.activeFilterBannerResetText, { color: colors.accent, fontWeight: '700' }]}>
            {isFlourishingChannel ? (flourishStageText || 'Recherchiere…') : 'Kanal aktualisieren'}
          </Text>
        </TouchableOpacity>

        {activeSpace?.isCustom && onEditChannel && (
          <TouchableOpacity
            onPress={() => onEditChannel(activeSpace)}
            style={[
              styles.activeFilterBannerReset,
              { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }
            ]}
            accessibilityRole="button"
            accessibilityLabel="Kanal bearbeiten"
          >
            <Ionicons name="pencil-outline" size={13} color={colors.textSecondary} style={styles.iconSpacing} />
            <Text style={[styles.activeFilterBannerResetText, { color: colors.textSecondary }]}>
              Bearbeiten
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          onPress={onResetFilter}
          style={[
            styles.activeFilterBannerReset,
            { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }
          ]}
          accessibilityRole="button"
          accessibilityLabel="Filter aufheben"
        >
          <Ionicons name="close-circle-outline" size={13} color={colors.textSecondary} style={styles.iconSpacing} />
          <Text style={[styles.activeFilterBannerResetText, { color: colors.textSecondary }]}>
            Alle Spaces
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export const FeedChannelBanner = React.memo(FeedChannelBannerInner);
FeedChannelBanner.displayName = 'FeedChannelBanner';

const styles = StyleSheet.create({
  activeFilterBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.sm
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 200
  },
  iconBadge: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  titleColumn: {
    flex: 1
  },
  activeFilterBannerTitle: {
    fontSize: 13,
    fontWeight: '600'
  },
  descriptionText: {
    fontSize: 11,
    marginTop: 2
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap'
  },
  activeFilterBannerReset: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1
  },
  activeFilterBannerResetText: {
    fontSize: 11,
    fontWeight: '600'
  },
  spinnerSpacing: {
    marginRight: 6
  },
  iconSpacingWide: {
    marginRight: 5
  },
  iconSpacing: {
    marginRight: 4
  }
});
