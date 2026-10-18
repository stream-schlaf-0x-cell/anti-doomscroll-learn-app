import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FeedOperationResult } from '../../core/feed/FeedOperationManager';
import { ThemeColors, typography, radius, spacing } from '../theme';

export interface FeedOperationBannerProps {
  /** If operation is currently executing */
  isRunning?: boolean;
  /** Progress stage text (e.g. "1/3: Artikelkandidaten prüfen …") */
  currentStage?: string;
  /** The most recent operation result */
  lastResult?: FeedOperationResult | null;
  /** Whether the user is currently scrolled down */
  isScrolledDown?: boolean;
  /** Unique inserted or updated articles waiting while the reader stays in place. */
  pendingChangeCount?: number;
  /** Triggered when the user taps "Details/Bericht ansehen" */
  onOpenReport?: () => void;
  /** Triggered when the user taps the floating scroll-to-top button */
  onScrollToTop?: () => void;
  colors: ThemeColors;
  isDark: boolean;
}

export const FeedOperationBanner: React.FC<FeedOperationBannerProps> = ({
  isRunning = false,
  currentStage,
  lastResult,
  isScrolledDown = false,
  pendingChangeCount = 0,
  onOpenReport,
  onScrollToTop,
  colors,
  isDark
}) => {
  const [showToast, setShowToast] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>('');

  // Handle toast appearance on new completed result
  useEffect(() => {
    if (!lastResult) return;
    if (lastResult.status === 'completed' || lastResult.status === 'partial' || lastResult.status === 'failed') {
      const count = lastResult.insertedCount;

      if (lastResult.status === 'failed') {
        setToastMessage('Aktualisierung fehlgeschlagen. Details im Bericht.');
      } else if (count > 0) {
        setToastMessage(`${count} neue Artikel hinzugefügt${lastResult.updatedCount ? ` · ${lastResult.updatedCount} aktualisiert` : ''}`);
      } else if (lastResult.updatedCount > 0) {
        setToastMessage(`✓ ${lastResult.updatedCount} Artikel aktualisiert`);
      } else {
        setToastMessage(lastResult.rejectedCount > 0
          ? `${lastResult.candidateCount} Artikel geprüft · keine Änderungen`
          : `${lastResult.duplicateCount} Artikel geprüft · bereits vorhanden`);
      }

      setShowToast(true);
      const timer = setTimeout(() => {
        setShowToast(false);
      }, 4200);

      return () => clearTimeout(timer);
    }
  }, [lastResult]);

  return (
    <>
      {/* 1. Active Ingestion / Curation Progress Banner */}
      {isRunning && !isScrolledDown && (
        <View style={[styles.progressBanner, { backgroundColor: colors.surface, borderColor: colors.accent }]}>
          <ActivityIndicator size="small" color={colors.accent} style={{ marginRight: 10 }} />
          <View style={{ flex: 1 }}>
            <Text accessibilityLiveRegion="polite" style={[styles.progressTitle, { color: colors.textPrimary }]}>
              {currentStage || 'Artikel werden kuratiert …'}
            </Text>
            <Text style={[styles.progressSubtitle, { color: colors.textMuted }]}>
              Signalprüfung • Deduplizierung • Themeneinordnung
            </Text>
          </View>
        </View>
      )}

      {/* 2. Success Toast with Inspectable Report Link */}
      {!isRunning && showToast && !isScrolledDown && (
        <View style={[styles.toastContainer, { backgroundColor: colors.surface, borderColor: colors.accent }]}>
          <View style={styles.toastContent}>
            <Text accessibilityLiveRegion="polite" style={[styles.toastText, { color: colors.textPrimary }]}>{toastMessage}</Text>
            {onOpenReport && (
              <TouchableOpacity
                onPress={onOpenReport}
                style={[styles.reportBtn, { backgroundColor: colors.accentSubtle }]}
                accessibilityRole="button"
                accessibilityLabel="Kurationsbericht ansehen"
              >
                <Text style={[styles.reportBtnText, { color: colors.accent }]}>Bericht</Text>
                <Ionicons name="chevron-forward" size={13} color={colors.accent} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            onPress={() => setShowToast(false)}
            accessibilityRole="button"
            accessibilityLabel="Statusmeldung schließen"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.dismissBtn}
          >
            <Ionicons name="close" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      )}

      {/* 3. Floating "Neue Beiträge anzeigen ↑" Pill when Scrolled Down */}
      {isScrolledDown && pendingChangeCount > 0 && onScrollToTop && (
        <TouchableOpacity
          onPress={onScrollToTop}
          activeOpacity={0.9}
          style={[styles.floatingPill, { backgroundColor: colors.accent, shadowColor: isDark ? '#38BDF8' : '#0284C7' }]}
          accessibilityRole="button"
          accessibilityLabel={`${pendingChangeCount} neue oder aktualisierte Beiträge am Anfang anzeigen`}
        >
          <Ionicons name="arrow-up" size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text accessibilityLiveRegion="polite" style={styles.floatingPillText}>{pendingChangeCount} neue / aktualisierte Beiträge anzeigen</Text>
        </TouchableOpacity>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  progressBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1
  },
  progressTitle: {
    fontFamily: typography.fontFamilies.sans,
    fontSize: typography.sizes.bodySmall,
    fontWeight: '600'
  },
  progressSubtitle: {
    fontFamily: typography.fontFamilies.sans,
    fontSize: typography.sizes.caption,
    marginTop: 2
  },
  toastContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3
  },
  toastContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  toastText: {
    flex: 1,
    fontFamily: typography.fontFamilies.sans,
    fontSize: typography.sizes.bodySmall,
    fontWeight: '600'
  },
  reportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    minHeight: 44,
    borderRadius: radius.full,
    marginLeft: spacing.sm
  },
  reportBtnText: {
    fontSize: typography.sizes.caption,
    fontWeight: '600',
    marginRight: 2
  },
  floatingPill: {
    alignSelf: 'center',
    zIndex: 9999,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    minHeight: 44,
    maxWidth: '95%',
    marginTop: spacing.sm,
    borderRadius: radius.full,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8
  },
  floatingPillText: {
    flexShrink: 1,
    color: '#FFFFFF',
    fontFamily: typography.fontFamilies.sans,
    fontSize: typography.sizes.bodySmall,
    fontWeight: '700'
  },
  dismissBtn: {
    width: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6
  }
});

export default FeedOperationBanner;
