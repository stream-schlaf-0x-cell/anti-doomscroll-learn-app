import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TopicTag, TOPIC_METADATA, ReadingPreferenceDuration } from '../../core/domain/types';
import { useApp } from '../../core/context/AppContext';
import { typography, radius, spacing } from '../../ui/theme';

export const OnboardingScreen: React.FC = () => {
  const { colors, completeOnboarding } = useApp();

  const [interests, setInterests] = useState<Record<TopicTag, number>>({
    philosophy_ethics: 0.95,
    german_didactics: 0.90,
    ai_apple: 0.85,
    contemplation_mind: 0.80,
    science_society: 0.70,
    sound_synthesis: 0.65
  });

  const [duration, setDuration] = useState<ReadingPreferenceDuration>('balanced');

  const handleToggleTopic = (tag: TopicTag) => {
    setInterests(prev => ({
      ...prev,
      [tag]: prev[tag] > 0.3 ? 0.2 : 0.9
    }));
  };

  const handleFinish = () => {
    completeOnboarding(interests, duration);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Ethos Header */}
        <View style={styles.header}>
          <Text style={[styles.eyebrow, { color: colors.accent }]}>
            DAS ANTIDOT ZUM DOOMSCROLLING
          </Text>
          <Text style={[styles.brandTitle, { color: colors.textPrimary }]}>
            ATEM
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Ein persönlicher intellektueller Resonanzraum. Kein Algorithmus, der Sie fesselt – sondern eine kuratierte Tagesausgabe, die Sie bereichert.
          </Text>
        </View>

        {/* Core Principles */}
        <View style={[styles.principlesBox, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
          <View style={styles.principleRow}>
            <Ionicons name="checkmark-circle-outline" size={18} color={colors.accent} style={styles.principleIcon} />
            <Text style={[styles.principleText, { color: colors.textPrimary }]}>
              <Text style={{ fontWeight: '700' }}>Endliche Ausgabe:</Text> Klare tägliche Lektüre statt bodenlosem Endlos-Feed.
            </Text>
          </View>
          <View style={styles.principleRow}>
            <Ionicons name="book-outline" size={18} color={colors.accent} style={styles.principleIcon} />
            <Text style={[styles.principleText, { color: colors.textPrimary }]}>
              <Text style={{ fontWeight: '700' }}>Echter Tiefgang:</Text> Erkenntnistheorie, Didaktik und Ideen statt Clickbait.
            </Text>
          </View>
          <View style={styles.principleRow}>
            <Ionicons name="shield-checkmark-outline" size={18} color={colors.accent} style={styles.principleIcon} />
            <Text style={[styles.principleText, { color: colors.textPrimary }]}>
              <Text style={{ fontWeight: '700' }}>Volle Privatsphäre:</Text> Lokale Daten auf Ihrem iPhone, keine Tracker.
            </Text>
          </View>
        </View>

        {/* Section: Your Focus Topics */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Ihre Interessensschwerpunkte
          </Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
            Tippen Sie auf Themen, um die Priorität für Ihre Tagesausgabe anzupassen:
          </Text>

          <View style={styles.topicsGrid}>
            {(Object.keys(TOPIC_METADATA) as TopicTag[]).map(tag => {
              const meta = TOPIC_METADATA[tag];
              const isHigh = (interests[tag] ?? 0.5) > 0.5;

              return (
                <TouchableOpacity
                  key={tag}
                  activeOpacity={0.8}
                  onPress={() => handleToggleTopic(tag)}
                  style={[
                    styles.topicCard,
                    {
                      backgroundColor: isHigh ? colors.cardHighlight : colors.surface,
                      borderColor: isHigh ? colors.accent : colors.borderSubtle
                    }
                  ]}
                >
                  <View style={styles.topicCardTop}>
                    <Ionicons
                      name={meta.icon as any}
                      size={20}
                      color={isHigh ? colors.accent : colors.textMuted}
                    />
                    <View
                      style={[
                        styles.checkboxPill,
                        {
                          backgroundColor: isHigh ? colors.accent : colors.surfaceSecondary,
                          borderColor: colors.borderSubtle
                        }
                      ]}
                    >
                      {isHigh && <Ionicons name="checkmark" size={12} color="#FFFFFF" />}
                    </View>
                  </View>
                  <Text style={[styles.topicTitle, { color: colors.textPrimary }]}>
                    {meta.label}
                  </Text>
                  <Text style={[styles.topicDesc, { color: colors.textMuted }]} numberOfLines={2}>
                    {meta.description}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Section: Reading Preference */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Bevorzugte Lesezeit
          </Text>
          <View style={styles.durationRow}>
            {[
              { id: 'quick', label: 'Kompakt (1–2m)' },
              { id: 'balanced', label: 'Ausgewogen (3–5m)' },
              { id: 'deep', label: 'Tiefgang (5m+)' }
            ].map(item => (
              <TouchableOpacity
                key={item.id}
                onPress={() => setDuration(item.id as any)}
                style={[
                  styles.durationPill,
                  {
                    backgroundColor: duration === item.id ? colors.accent : colors.surfaceSecondary,
                    borderColor: colors.borderSubtle
                  }
                ]}
              >
                <Text
                  style={[
                    styles.durationText,
                    { color: duration === item.id ? '#FFFFFF' : colors.textPrimary }
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Start Button */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleFinish}
          style={[styles.startButton, { backgroundColor: colors.accent }]}
        >
          <Text style={styles.startButtonText}>Tagesausgabe öffnen</Text>
          <Ionicons name="arrow-forward" size={18} color="#FFFFFF" style={{ marginLeft: 8 }} />
        </TouchableOpacity>

        <Text style={[styles.disclaimer, { color: colors.textMuted }]}>
          Kein Account erforderlich. Ihre Einstellungen bleiben lokal auf Ihrem iPhone gespeichert.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1
  },
  container: {
    paddingHorizontal: spacing.pageHorizontal,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl
  },
  header: {
    marginBottom: spacing.xl,
    alignItems: 'center',
    textAlign: 'center'
  },
  eyebrow: {
    fontSize: typography.sizes.micro,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 4,
    textTransform: 'uppercase'
  },
  brandTitle: {
    fontFamily: typography.fontFamilies.serif,
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: 4,
    marginBottom: spacing.sm
  },
  subtitle: {
    fontSize: typography.sizes.body,
    lineHeight: 23,
    textAlign: 'center',
    maxWidth: 360
  },
  principlesBox: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    marginBottom: spacing.xl
  },
  principleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm
  },
  principleIcon: {
    marginRight: spacing.sm,
    marginTop: 2
  },
  principleText: {
    flex: 1,
    fontSize: typography.sizes.bodySmall,
    lineHeight: 20
  },
  section: {
    marginBottom: spacing.xl
  },
  sectionTitle: {
    fontSize: typography.sizes.title2,
    fontWeight: '700',
    marginBottom: 4
  },
  sectionSubtitle: {
    fontSize: typography.sizes.bodySmall,
    marginBottom: spacing.md
  },
  topicsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  topicCard: {
    width: '48%',
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md
  },
  topicCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs
  },
  checkboxPill: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 0.5,
    justifyContent: 'center',
    alignItems: 'center'
  },
  topicTitle: {
    fontSize: typography.sizes.bodySmall,
    fontWeight: '700',
    marginBottom: 4
  },
  topicDesc: {
    fontSize: typography.sizes.micro,
    lineHeight: 15
  },
  durationRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: spacing.xs
  },
  durationPill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 0.5,
    alignItems: 'center'
  },
  durationText: {
    fontSize: typography.sizes.micro,
    fontWeight: '600'
  },
  startButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: radius.md,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: typography.sizes.body,
    fontWeight: '700'
  },
  disclaimer: {
    textAlign: 'center',
    fontSize: typography.sizes.micro,
    lineHeight: 16
  }
});
