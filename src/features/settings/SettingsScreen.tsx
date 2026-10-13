import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TopicTag, TOPIC_METADATA, ReadingPreferenceDuration } from '../../core/domain/types';
import { useApp } from '../../core/context/AppContext';
import { typography, radius, spacing } from '../../ui/theme';

export const SettingsScreen: React.FC = () => {
  const {
    profile,
    updateTopicWeight,
    updateDurationPreference,
    setFontSize,
    setThemePreference,
    resetOnboarding,
    colors,
    isDark
  } = useApp();

  const handleAdjustWeight = (topic: TopicTag, delta: number) => {
    const current = profile.explicitInterests[topic] ?? 0.5;
    const next = Math.max(0, Math.min(1.0, Math.round((current + delta) * 10) / 10));
    updateTopicWeight(topic, next);
  };

  const handleReset = () => {
    // In React Native / Expo web, alert confirmation
    resetOnboarding();
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.borderSubtle }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          Einstellungen
        </Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          Transparente Steuerung Ihrer intellektuellen Umgebung
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Section: Topic Weights */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Themengewichtung für die Tagesausgabe
          </Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
            Passen Sie die Relevanz an. Änderungen wirken sich sofort spürbar auf die Reihung Ihres Feeds aus.
          </Text>

          <View style={[styles.box, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
            {(Object.keys(TOPIC_METADATA) as TopicTag[]).map((tag, idx) => {
              const meta = TOPIC_METADATA[tag];
              const weight = profile.explicitInterests[tag] ?? 0.5;
              const weightPct = Math.round(weight * 100);

              return (
                <View
                  key={tag}
                  style={[
                    styles.weightRow,
                    idx > 0 && { borderTopWidth: 0.5, borderTopColor: colors.borderSubtle }
                  ]}
                >
                  <View style={styles.weightInfo}>
                    <View style={styles.labelRow}>
                      <Ionicons name={meta.icon as any} size={15} color={colors.accent} style={{ marginRight: 6 }} />
                      <Text style={[styles.weightLabel, { color: colors.textPrimary }]}>
                        {meta.label}
                      </Text>
                    </View>
                    <Text style={[styles.weightPercent, { color: colors.accent }]}>
                      {weightPct}% Priorität
                    </Text>
                  </View>

                  <View style={styles.stepperContainer}>
                    <TouchableOpacity
                      onPress={() => handleAdjustWeight(tag, -0.1)}
                      style={[styles.stepperButton, { backgroundColor: colors.surfaceSecondary }]}
                      disabled={weight <= 0.05}
                    >
                      <Ionicons name="remove" size={16} color={weight <= 0.05 ? colors.border : colors.textPrimary} />
                    </TouchableOpacity>

                    {/* Visual Progress Pill */}
                    <View style={[styles.weightBarTrack, { backgroundColor: colors.surfaceSecondary }]}>
                      <View
                        style={[
                          styles.weightBarFill,
                          { width: `${weightPct}%`, backgroundColor: colors.accent }
                        ]}
                      />
                    </View>

                    <TouchableOpacity
                      onPress={() => handleAdjustWeight(tag, 0.1)}
                      style={[styles.stepperButton, { backgroundColor: colors.surfaceSecondary }]}
                      disabled={weight >= 0.95}
                    >
                      <Ionicons name="add" size={16} color={weight >= 0.95 ? colors.border : colors.textPrimary} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Section: Reading Format */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Lesezeit-Präferenz
          </Text>
          <View style={styles.toggleRow}>
            {[
              { id: 'quick', label: 'Kompakt (1–2m)' },
              { id: 'balanced', label: 'Ausgewogen (3–5m)' },
              { id: 'deep', label: 'Tiefgang (5m+)' }
            ].map(d => (
              <TouchableOpacity
                key={d.id}
                onPress={() => updateDurationPreference(d.id as ReadingPreferenceDuration)}
                style={[
                  styles.togglePill,
                  {
                    backgroundColor: profile.readingPreferences.preferredDuration === d.id ? colors.accent : colors.surface,
                    borderColor: colors.borderSubtle
                  }
                ]}
              >
                <Text
                  style={[
                    styles.toggleText,
                    { color: profile.readingPreferences.preferredDuration === d.id ? '#FFFFFF' : colors.textPrimary }
                  ]}
                >
                  {d.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Section: Typography & Appearance */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Darstellung & Lesekomfort
          </Text>
          <View style={[styles.box, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
            {/* Theme */}
            <View style={styles.settingItemRow}>
              <Text style={[styles.settingItemLabel, { color: colors.textPrimary }]}>
                Erscheinungsbild
              </Text>
              <View style={styles.subToggleRow}>
                {[
                  { id: 'system', label: 'Auto' },
                  { id: 'light', label: 'Hell' },
                  { id: 'dark', label: 'Dunkel' }
                ].map(t => (
                  <TouchableOpacity
                    key={t.id}
                    onPress={() => setThemePreference(t.id as any)}
                    style={[
                      styles.smallPill,
                      {
                        backgroundColor: profile.readingPreferences.theme === t.id ? colors.accent : colors.surfaceSecondary
                      }
                    ]}
                  >
                    <Text
                      style={[
                        styles.smallPillText,
                        { color: profile.readingPreferences.theme === t.id ? '#FFFFFF' : colors.textPrimary }
                      ]}
                    >
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Font Size */}
            <View style={[styles.settingItemRow, { borderTopWidth: 0.5, borderTopColor: colors.borderSubtle }]}>
              <Text style={[styles.settingItemLabel, { color: colors.textPrimary }]}>
                Schriftgröße im Reader
              </Text>
              <View style={styles.subToggleRow}>
                {(['sm', 'md', 'lg', 'xl'] as const).map(size => (
                  <TouchableOpacity
                    key={size}
                    onPress={() => setFontSize(size)}
                    style={[
                      styles.smallPill,
                      {
                        backgroundColor: profile.readingPreferences.fontSize === size ? colors.accent : colors.surfaceSecondary
                      }
                    ]}
                  >
                    <Text
                      style={[
                        styles.smallPillText,
                        { color: profile.readingPreferences.fontSize === size ? '#FFFFFF' : colors.textPrimary }
                      ]}
                    >
                      {size.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* Section: Ecosystem Roadmap */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Ökosystem-Anbindungen (Roadmap)
          </Text>
          <View style={[styles.box, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
            <View style={styles.roadmapItem}>
              <Ionicons name="document-text-outline" size={20} color={colors.accent} style={{ marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.roadmapTitle, { color: colors.textPrimary }]}>Craft Notizen & Dokumente</Text>
                <Text style={[styles.roadmapDesc, { color: colors.textMuted }]}>
                  Verknüpfung von Lektüre mit Ihren eigenen Unterrichts- und Denkprojekten (Phase 5).
                </Text>
              </View>
              <View style={[styles.badgePlanned, { backgroundColor: colors.surfaceSecondary }]}>
                <Text style={[styles.badgePlannedText, { color: colors.textMuted }]}>Geplant</Text>
              </View>
            </View>

            <View style={[styles.roadmapItem, { borderTopWidth: 0.5, borderTopColor: colors.borderSubtle }]}>
              <Ionicons name="bookmark-outline" size={20} color={colors.accent} style={{ marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.roadmapTitle, { color: colors.textPrimary }]}>Raindrop.io Lesezeichen</Text>
                <Text style={[styles.roadmapDesc, { color: colors.textMuted }]}>
                  Intelligente Integration Ihrer gespeicherten Artikel (Phase 5).
                </Text>
              </View>
              <View style={[styles.badgePlanned, { backgroundColor: colors.surfaceSecondary }]}>
                <Text style={[styles.badgePlannedText, { color: colors.textMuted }]}>Geplant</Text>
              </View>
            </View>

            <View style={[styles.roadmapItem, { borderTopWidth: 0.5, borderTopColor: colors.borderSubtle }]}>
              <Ionicons name="flash-outline" size={20} color={colors.accent} style={{ marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.roadmapTitle, { color: colors.textPrimary }]}>Apple Kurzbefehle & Widgets</Text>
                <Text style={[styles.roadmapDesc, { color: colors.textMuted }]}>
                  Tagesausgabe direkt per Action Button oder Widget auf dem iPhone 15 Pro starten (Phase 6).
                </Text>
              </View>
              <View style={[styles.badgePlanned, { backgroundColor: colors.surfaceSecondary }]}>
                <Text style={[styles.badgePlannedText, { color: colors.textMuted }]}>Geplant</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Section: Privacy & Reset */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Datenschutz & Speicher
          </Text>
          <View style={[styles.box, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
            <View style={{ padding: spacing.md }}>
              <Text style={[styles.privacyText, { color: colors.textSecondary }]}>
                Alle Daten, Lesezeichen und Interessensprofile sind lokal auf diesem Gerät gespeichert (Local-First). Es erfolgt keine ungefragte Weitergabe an Cloud-Server oder Werbenetzwerke.
              </Text>
            </View>

            <TouchableOpacity
              onPress={handleReset}
              style={[styles.resetButton, { borderTopColor: colors.borderSubtle }]}
            >
              <Ionicons name="refresh-outline" size={16} color={colors.danger} style={{ marginRight: 6 }} />
              <Text style={[styles.resetButtonText, { color: colors.danger }]}>
                App zurücksetzen & Onboarding neu starten
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1
  },
  header: {
    paddingHorizontal: spacing.pageHorizontal,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 0.5
  },
  title: {
    fontSize: typography.sizes.title1,
    fontWeight: '800'
  },
  subtitle: {
    fontSize: typography.sizes.micro,
    marginTop: 2
  },
  scrollContent: {
    paddingHorizontal: spacing.pageHorizontal,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl * 2
  },
  section: {
    marginBottom: spacing.xl
  },
  sectionTitle: {
    fontSize: typography.sizes.body,
    fontWeight: '700',
    marginBottom: 4
  },
  sectionSubtitle: {
    fontSize: typography.sizes.micro,
    lineHeight: 16,
    marginBottom: spacing.sm
  },
  box: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden'
  },
  weightRow: {
    padding: spacing.md
  },
  weightInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  weightLabel: {
    fontSize: typography.sizes.bodySmall,
    fontWeight: '600'
  },
  weightPercent: {
    fontSize: typography.sizes.micro,
    fontWeight: '700'
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  stepperButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center'
  },
  weightBarTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden'
  },
  weightBarFill: {
    height: '100%',
    borderRadius: 3
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8
  },
  togglePill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 0.5,
    alignItems: 'center'
  },
  toggleText: {
    fontSize: typography.sizes.micro,
    fontWeight: '600'
  },
  settingItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md
  },
  settingItemLabel: {
    fontSize: typography.sizes.bodySmall,
    fontWeight: '600'
  },
  subToggleRow: {
    flexDirection: 'row',
    gap: 6
  },
  smallPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill
  },
  smallPillText: {
    fontSize: typography.sizes.micro,
    fontWeight: '700'
  },
  roadmapItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md
  },
  roadmapTitle: {
    fontSize: typography.sizes.bodySmall,
    fontWeight: '600',
    marginBottom: 2
  },
  roadmapDesc: {
    fontSize: typography.sizes.micro,
    lineHeight: 15
  },
  badgePlanned: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill
  },
  badgePlannedText: {
    fontSize: typography.sizes.micro,
    fontWeight: '600'
  },
  privacyText: {
    fontSize: typography.sizes.micro,
    lineHeight: 18
  },
  resetButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 0.5
  },
  resetButtonText: {
    fontSize: typography.sizes.bodySmall,
    fontWeight: '600'
  }
});
