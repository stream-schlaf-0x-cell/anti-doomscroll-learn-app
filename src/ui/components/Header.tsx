import React, { Suspense, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../core/context/AppContext';
import { typography, spacing } from '../theme';
import { AtmenSymbol } from './AtmenSymbol';

const UltraMasterModal = React.lazy(() =>
  import('./UltraMasterModal').then(m => ({ default: m.UltraMasterModal }))
);
const MobilePublishModal = React.lazy(() =>
  import('./MobilePublishModal').then(m => ({ default: m.MobilePublishModal }))
);
const AtmenBreathingPortal = React.lazy(() =>
  import('../../features/breathing/AtmenBreathingPortal').then(m => ({ default: m.AtmenBreathingPortal }))
);

interface HeaderProps {
  title?: string;
  subtitle?: string;
  showThemeToggle?: boolean;
  onOpenHivemind?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  title = 'atmen',
  subtitle,
  showThemeToggle = true,
  onOpenHivemind
}) => {
  const { width } = useWindowDimensions();
  const isCompactMobile = width < 768;
  const { colors, isDark, setThemePreference, goHome, setActiveTab, cloudSyncConfig, isSyncing } = useApp();
  const [showMaster, setShowMaster] = useState<boolean>(false);
  const [showMobile, setShowMobile] = useState<boolean>(false);
  const [showBreathing, setShowBreathing] = useState<boolean>(false);

  const handleToggleTheme = () => {
    setThemePreference(isDark ? 'light' : 'dark');
  };

  return (
    <>
      <View style={[styles.headerContainer, { borderBottomColor: colors.borderSubtle }]}>
        <View style={styles.headerInner}>
          <View style={styles.titleColumn}>
            <TouchableOpacity
              onPress={goHome}
              activeOpacity={0.7}
              style={styles.titleRow}
              accessibilityRole="button"
              accessibilityLabel="Zurück zur Home Startseite"
            >
              <AtmenSymbol size={21} isDark={isDark} style={{ marginRight: 6 }} />
              <Text style={[styles.logoText, { color: colors.textPrimary }]}>
                {title}
              </Text>
            </TouchableOpacity>
            {!isCompactMobile && subtitle ? (
              <Text style={[styles.subtitleText, { color: colors.textMuted }]} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>

          <View style={styles.rightActionsRow}>
            {/* Live Cloud Sync Indicator & Quick Connect */}
            <TouchableOpacity
              onPress={() => setActiveTab('settings')}
              style={[
                styles.syncPill,
                {
                  backgroundColor: colors.surfaceSecondary,
                  borderColor: colors.borderSubtle
                }
              ]}
              accessibilityRole="button"
              accessibilityLabel={cloudSyncConfig.enabled ? 'Live-Sync verbunden' : 'Geräte koppeln'}
            >
              <Ionicons
                name={cloudSyncConfig.enabled ? 'cloud-done-outline' : 'cloud-outline'}
                size={14}
                color={cloudSyncConfig.enabled ? colors.success : colors.textSecondary}
              />
              {!isCompactMobile && (
                <Text
                  style={[
                    styles.syncPillText,
                    { color: cloudSyncConfig.enabled ? colors.success : colors.textSecondary }
                  ]}
                >
                  {isSyncing ? 'Sync…' : cloudSyncConfig.enabled ? 'Synchronisiert' : 'Koppeln'}
                </Text>
              )}
            </TouchableOpacity>

            {onOpenHivemind && (
              <TouchableOpacity
                onPress={onOpenHivemind}
                style={[styles.themeToggle, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}
                accessibilityRole="button"
                accessibilityLabel="Hivemind Lern-Feed öffnen"
              >
                <Ionicons name="school-outline" size={15} color={colors.accent} />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={() => setShowMaster(true)}
              style={[styles.themeToggle, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}
              accessibilityRole="button"
              accessibilityLabel="AI Studio & Subchannel-Erstellung öffnen"
            >
              <Ionicons name="sparkles-outline" size={15} color={colors.accent} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowBreathing(true)}
              style={[styles.themeToggle, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}
              accessibilityRole="button"
              accessibilityLabel="Atmen Portal öffnen"
            >
              <Ionicons name="leaf-outline" size={15} color={colors.success} />
            </TouchableOpacity>

            {showThemeToggle && (
              <TouchableOpacity
                onPress={handleToggleTheme}
                style={[styles.themeToggle, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel={isDark ? 'Helles Erscheinungsbild aktivieren' : 'Dunkles Erscheinungsbild aktivieren'}
              >
                <Ionicons
                  name={isDark ? 'sunny-outline' : 'moon-outline'}
                  size={15}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {showMaster && (
        <Suspense fallback={null}>
          <UltraMasterModal visible={true} onClose={() => setShowMaster(false)} />
        </Suspense>
      )}
      {showMobile && (
        <Suspense fallback={null}>
          <MobilePublishModal visible={true} onClose={() => setShowMobile(false)} />
        </Suspense>
      )}
      {showBreathing && (
        <Suspense fallback={null}>
          <AtmenBreathingPortal visible={true} onClose={() => setShowBreathing(false)} mode="modal" />
        </Suspense>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    paddingHorizontal: spacing.pageHorizontal,
    paddingTop: 8,
    paddingBottom: 8,
    borderBottomWidth: 0.5
  },
  headerInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    maxWidth: 780,
    width: '100%',
    alignSelf: 'center'
  },
  titleColumn: {
    flex: 1,
    justifyContent: 'center'
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  logoText: {
    fontFamily: typography.fontFamilies.serif,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 2.0
  },
  subtitleText: {
    fontSize: typography.sizes.micro,
    fontWeight: '500',
    letterSpacing: 0.3,
    marginTop: 2
  },
  rightActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0
  },
  syncPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 17,
    borderWidth: 1
  },
  syncPillText: {
    fontSize: 11,
    fontWeight: '600'
  },
  themeToggle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center'
  }
});
