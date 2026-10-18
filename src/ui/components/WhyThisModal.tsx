import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../core/context/AppContext';
import { typography, radius, spacing } from '../theme';

export const WhyThisModal: React.FC = () => {
  const { whyModalItem, closeWhyModal, colors } = useApp();

  if (!whyModalItem) return null;

  const breakdown = whyModalItem.scoreBreakdown;
  const overallScorePercent = Math.round((whyModalItem.score ?? 0.8) * 100);
  const affinityPercent = Math.round(breakdown.topicAffinity * 100);

  return (
    <Modal
      visible={true}
      animationType="fade"
      transparent={true}
      onRequestClose={closeWhyModal}
    >
      <View style={styles.overlay}>
        <Pressable
          accessibilityLabel="Hintergrund schließen"
          onPress={closeWhyModal}
          style={StyleSheet.absoluteFill}
        />
        <View
          style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onStartShouldSetResponder={() => true}
          // @ts-ignore - web click propagation guard
          onClick={(e: any) => {
            if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
          }}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Ionicons name="sparkles-outline" size={18} color={colors.accent} style={{ marginRight: 6 }} />
              <Text style={[styles.title, { color: colors.textPrimary }]}>
                Warum sehe ich das?
              </Text>
            </View>
            <TouchableOpacity
              onPress={closeWhyModal}
              style={[styles.closeButton, { backgroundColor: colors.surfaceSecondary }]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Article Title */}
            <Text style={[styles.articleTitle, { color: colors.textPrimary }]} numberOfLines={2}>
              {whyModalItem.title}
            </Text>

            {/* Score Pill */}
            <View style={[styles.scoreBox, { backgroundColor: colors.accentSubtle, borderColor: colors.borderSubtle }]}>
              <Text style={[styles.scoreNumber, { color: colors.accent }]}>
                {overallScorePercent}%
              </Text>
              <View style={styles.scoreTextCol}>
                <Text style={[styles.scoreLabel, { color: colors.textPrimary }]}>
                  Relevanz-Score für diese Ausgabe
                </Text>
                <Text style={[styles.scoreSubtext, { color: colors.textSecondary }]}>
                  Deterministisch errechnet aus deinen Präferenzen
                </Text>
              </View>
            </View>

            {/* Factors */}
            <View style={styles.factorsList}>
              <View style={[styles.factorRow, { borderBottomColor: colors.borderSubtle }]}>
                <Ionicons name="compass-outline" size={18} color={colors.accent} style={styles.factorIcon} />
                <View style={styles.factorContent}>
                  <Text style={[styles.factorTitle, { color: colors.textPrimary }]}>
                    Themen-Affinität: {affinityPercent}%
                  </Text>
                  <Text style={[styles.factorDesc, { color: colors.textSecondary }]}>
                    Basiert auf deinen Einstellungen für das Hauptthema sowie Sekundärthemen.
                  </Text>
                </View>
              </View>

              <View style={[styles.factorRow, { borderBottomColor: colors.borderSubtle }]}>
                <Ionicons name="timer-outline" size={18} color={colors.accent} style={styles.factorIcon} />
                <View style={styles.factorContent}>
                  <Text style={[styles.factorTitle, { color: colors.textPrimary }]}>
                    Lesezeit-Passung ({whyModalItem.estimatedReadingMinutes} Min.)
                  </Text>
                  <Text style={[styles.factorDesc, { color: colors.textSecondary }]}>
                    Passt optimal zu deinem bevorzugten Leseformat.
                  </Text>
                </View>
              </View>

              {breakdown.depthBonus > 0 && (
                <View style={[styles.factorRow, { borderBottomColor: colors.borderSubtle }]}>
                  <Ionicons name="library-outline" size={18} color={colors.accent} style={styles.factorIcon} />
                  <View style={styles.factorContent}>
                    <Text style={[styles.factorTitle, { color: colors.textPrimary }]}>
                      Intellektueller Tiefgang-Bonus (+15%)
                    </Text>
                    <Text style={[styles.factorDesc, { color: colors.textSecondary }]}>
                      Philosophische Gegenüberstellungen und Deep Dives werden gezielt gefördert.
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {/* Philosophy Notice */}
            <View style={[styles.noticeBox, { backgroundColor: colors.surfaceSecondary }]}>
              <Ionicons name="shield-checkmark-outline" size={16} color={colors.accent} style={{ marginRight: 8, marginTop: 1 }} />
              <Text style={[styles.noticeText, { color: colors.textSecondary }]}>
                Atem verwendet keine verdeckten Verhaltens-Tracker oder Klickoptimierungs-Algorithmen. Du steuerst deine Gewichtungen jederzeit transparent in den Einstellungen.
              </Text>
            </View>
          </ScrollView>

          {/* Action button */}
          <TouchableOpacity
            style={[styles.doneButton, { backgroundColor: colors.accent }]}
            onPress={closeWhyModal}
          >
            <Text style={styles.doneButtonText}>Verstanden</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.pageHorizontal
  },
  modalCard: {
    width: '100%',
    maxHeight: '85%',
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 8
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  title: {
    fontSize: typography.sizes.title2,
    fontWeight: '700'
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center'
  },
  body: {
    marginBottom: spacing.md
  },
  articleTitle: {
    fontSize: typography.sizes.body,
    fontWeight: '600',
    lineHeight: typography.lineHeights.body,
    marginBottom: spacing.md
  },
  scoreBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 0.5,
    marginBottom: spacing.lg
  },
  scoreNumber: {
    fontSize: 28,
    fontWeight: '800',
    marginRight: spacing.md
  },
  scoreTextCol: {
    flex: 1
  },
  scoreLabel: {
    fontSize: typography.sizes.bodySmall,
    fontWeight: '600'
  },
  scoreSubtext: {
    fontSize: typography.sizes.micro,
    marginTop: 2
  },
  factorsList: {
    marginBottom: spacing.md
  },
  factorRow: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    borderBottomWidth: 0.5
  },
  factorIcon: {
    marginRight: spacing.md,
    marginTop: 2
  },
  factorContent: {
    flex: 1
  },
  factorTitle: {
    fontSize: typography.sizes.bodySmall,
    fontWeight: '600'
  },
  factorDesc: {
    fontSize: typography.sizes.micro,
    marginTop: 2,
    lineHeight: 16
  },
  noticeBox: {
    flexDirection: 'row',
    padding: spacing.md,
    borderRadius: radius.md,
    marginTop: spacing.sm
  },
  noticeText: {
    flex: 1,
    fontSize: typography.sizes.micro,
    lineHeight: 16
  },
  doneButton: {
    minHeight: 48,
    paddingVertical: 12,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center'
  },
  doneButtonText: {
    color: '#FFFFFF',
    fontSize: typography.sizes.body,
    fontWeight: '600'
  }
});
