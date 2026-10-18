import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  TopicTag,
  TOPIC_METADATA,
  TOPIC_SPACE_MAP,
  ReadingPreferenceDuration
} from '../../core/domain/types';
import { useApp } from '../../core/context/AppContext';
import { DEFAULT_STARTER_INTERESTS } from '../../core/data/fixtures';
import { typography, radius, spacing, PALETTE_METADATA, ThemePalette } from '../../ui/theme';
import { RaindropService } from '../../core/raindrop/raindropService';
import { HowItWorksModal } from '../../ui/components/HowItWorksModal';
import { VERIFIED_FEED_SOURCES } from '../../core/ingestion/sources';
import { defaultSpaceRepository, Subchannel } from '../../core/spaces/spaceRepository';
import { OnTheFlyStreamService } from '../../core/synthesis/onTheFlyStreamService';

type StarterArchetypeId = 'all_balanced' | 'science_tech' | 'culture_philosophy' | 'education_mind';

const ARCHETYPES: {
  id: StarterArchetypeId;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  weights: Record<TopicTag, number>;
  includeDidactics: boolean;
}[] = [
  {
    id: 'all_balanced',
    title: 'Universal-Entdecker (Empfohlen)',
    subtitle: 'Ausgewogener Mix aus allen 12 Wissensräumen',
    icon: 'compass-outline',
    weights: { ...DEFAULT_STARTER_INTERESTS },
    includeDidactics: true
  },
  {
    id: 'science_tech',
    title: 'Wissenschaft, KI & Systeme',
    subtitle: 'Forschung, Frontier AI, Open Source, Chancen & Webcomics',
    icon: 'hardware-chip-outline',
    weights: {
      science_society: 0.95,
      ai_apple: 0.95,
      opportunities_growth: 0.85,
      health_biohacking: 0.80,
      youtube_gems: 0.80,
      memes_satire: 0.75,
      philosophy_ethics: 0.65,
      book_mastery: 0.60,
      sound_synthesis: 0.50,
      art_aesthetics: 0.50,
      contemplation_mind: 0.50,
      german_didactics: 0.15
    },
    includeDidactics: false
  },
  {
    id: 'culture_philosophy',
    title: 'Philosophie, Kunst, Bücher & Klang',
    subtitle: 'Essays, Erkenntnistheorie, Museumssammlungen, Musik & Kontemplation',
    icon: 'book-outline',
    weights: {
      philosophy_ethics: 0.95,
      book_mastery: 0.95,
      art_aesthetics: 0.90,
      sound_synthesis: 0.90,
      contemplation_mind: 0.85,
      science_society: 0.75,
      youtube_gems: 0.70,
      memes_satire: 0.65,
      ai_apple: 0.45,
      health_biohacking: 0.55,
      opportunities_growth: 0.40,
      german_didactics: 0.20
    },
    includeDidactics: false
  },
  {
    id: 'education_mind',
    title: 'Didaktik, Gesellschaft & Achtsamkeit',
    subtitle: 'Unterrichts-Impulse, Kognitionspsychologie, Ethik & Fokus',
    icon: 'school-outline',
    weights: {
      german_didactics: 0.95,
      philosophy_ethics: 0.90,
      contemplation_mind: 0.90,
      science_society: 0.85,
      book_mastery: 0.85,
      health_biohacking: 0.80,
      art_aesthetics: 0.70,
      youtube_gems: 0.70,
      ai_apple: 0.60,
      memes_satire: 0.60,
      sound_synthesis: 0.50,
      opportunities_growth: 0.55
    },
    includeDidactics: true
  }
];

export const OnboardingScreen: React.FC = () => {
  const {
    colors,
    isDark,
    palette,
    setThemePreference,
    setPalettePreference,
    completeOnboarding
  } = useApp();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedArchetype, setSelectedArchetype] = useState<StarterArchetypeId>('all_balanced');
  const [interests, setInterests] = useState<Record<TopicTag, number>>(DEFAULT_STARTER_INTERESTS);
  const [duration, setDuration] = useState<ReadingPreferenceDuration>('balanced');
  const [languageMix, setLanguageMix] = useState<'bilingual' | 'de_focus' | 'en_focus'>('bilingual');
  const [includeDidactics, setIncludeDidactics] = useState<boolean>(true);
  const [weatherCity, setWeatherCity] = useState<string>('dresden');
  const [raindropToken, setRaindropToken] = useState<string>('');
  const [raindropStatus, setRaindropStatus] = useState<string | null>(null);
  const [showHowItWorks, setShowHowItWorks] = useState<boolean>(false);
  const [newSpaceInput, setNewSpaceInput] = useState<string>('');
  const [isCreatingSpace, setIsCreatingSpace] = useState<boolean>(false);
  const [customSpaces, setCustomSpaces] = useState<Subchannel[]>([]);
  const [customSpaceFeedback, setCustomSpaceFeedback] = useState<string | null>(null);

  const handleSelectArchetype = (arch: typeof ARCHETYPES[number]) => {
    setSelectedArchetype(arch.id);
    setInterests({ ...arch.weights });
    setIncludeDidactics(arch.includeDidactics);
  };

  const handleToggleTopic = (tag: TopicTag) => {
    setInterests(prev => ({
      ...prev,
      [tag]: (prev[tag] ?? 0.5) > 0.45 ? 0.15 : 0.9
    }));
  };

  const handleAddCustomSpace = async () => {
    const trimmed = newSpaceInput.trim();
    if (!trimmed) return;
    setIsCreatingSpace(true);
    setCustomSpaceFeedback(null);
    try {
      const cleanHandle = `c/${trimmed.toLowerCase().replace(/[^a-z0-9äöüß]+/gi, '_').replace(/^_+|_+$/g, '')}`;
      const created = await defaultSpaceRepository.createSubchannel({
        title: trimmed,
        handle: cleanHandle,
        description: `Individueller Wissensraum für ${trimmed}.`,
        icon: 'sparkles-outline',
        flair: trimmed
      });
      setCustomSpaces(prev => [...prev, created]);
      setNewSpaceInput('');
      setCustomSpaceFeedback(`Raum ${created.handle} erfolgreich erstellt!`);
      // Trigger background stream generation on the fly so it is ready when onboarding finishes
      void OnTheFlyStreamService.generateStreamForPocket({
        space: created.handle,
        count: 10,
        searchTerm: trimmed
      });
    } catch {
      setCustomSpaceFeedback('Konnte Raum nicht erstellen.');
    } finally {
      setIsCreatingSpace(false);
    }
  };

  const handleVerifyRaindrop = async () => {
    if (!raindropToken.trim()) {
      setRaindropStatus('Bitte gib einen Raindrop.io Token ein (oder „demo“ zum Testen).');
      return;
    }
    const res = await RaindropService.verifyToken(raindropToken.trim());
    if (res.success) {
      setRaindropStatus(`Verbunden als ${res.user?.name || 'Raindrop Nutzer'}`);
    } else {
      setRaindropStatus(res.error || 'Token konnte nicht verifiziert werden.');
    }
  };

  const handleFinish = () => {
    const finalInterests = {
      ...interests,
      german_didactics: includeDidactics ? Math.max(0.65, interests.german_didactics || 0.75) : 0.05
    };
    void completeOnboarding(finalInterests, duration, {
      teachingTargetRatio: includeDidactics ? 0.10 : 0.0,
      languageMix,
      theme: isDark ? 'dark' : 'light',
      palette,
      weatherCity,
      raindropToken: raindropToken.trim() || undefined
    });
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right', 'bottom']}
    >
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Top Bar with Step Indicator & Explainer Button */}
        <View style={styles.topRow}>
          <View style={styles.stepDotsRow}>
            {[1, 2, 3].map(s => (
              <TouchableOpacity
                key={s}
                onPress={() => setStep(s as 1 | 2 | 3)}
                style={[
                  styles.stepDot,
                  {
                    backgroundColor: step === s ? colors.accent : colors.surfaceSecondary,
                    borderColor: step === s ? colors.accent : colors.borderSubtle
                  }
                ]}
              >
                <Text
                  style={[
                    styles.stepDotText,
                    { color: step === s ? '#FFFFFF' : colors.textSecondary }
                  ]}
                >
                  {s}
                </Text>
              </TouchableOpacity>
            ))}
            <Text style={[styles.stepLabel, { color: colors.textSecondary }]}>
              Schritt {step} von 3
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => setShowHowItWorks(true)}
            style={[
              styles.explainerButton,
              { backgroundColor: colors.surface, borderColor: colors.borderSubtle }
            ]}
          >
            <Ionicons name="help-circle-outline" size={16} color={colors.accent} />
            <Text style={[styles.explainerButtonText, { color: colors.textPrimary }]}>
              Wie es funktioniert
            </Text>
          </TouchableOpacity>
        </View>

        {/* Brand Header */}
        <View style={styles.header}>
          <Text style={[styles.eyebrow, { color: colors.accent }]}>
            BLOOMSCROLLING STATT DOOMSCROLLING
          </Text>
          <Text style={[styles.brandTitle, { color: colors.textPrimary }]}>
            atmen
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Dein persönlicher Reddit-Ersatz für Wissenschaft, KI, Philosophie, Kultur und echte Entdeckungen – aus {VERIFIED_FEED_SOURCES.length} verifizierten Quellen.
          </Text>
        </View>

        {step === 1 && (
          <>
            {/* Quick Starter Archetypes */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                1. Wähle dein Start-Profil
              </Text>
              <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
                Wähle eine Kuratierungs-Vorlage oder passe einzelne Wissens-Spaces direkt darunter an:
              </Text>

              <View style={styles.archetypeList}>
                {ARCHETYPES.map(arch => {
                  const active = selectedArchetype === arch.id;
                  return (
                    <TouchableOpacity
                      key={arch.id}
                      activeOpacity={0.85}
                      onPress={() => handleSelectArchetype(arch)}
                      style={[
                        styles.archetypeCard,
                        {
                          backgroundColor: active ? colors.cardHighlight : colors.surface,
                          borderColor: active ? colors.accent : colors.borderSubtle
                        }
                      ]}
                    >
                      <View
                        style={[
                          styles.archetypeIconWrap,
                          { backgroundColor: active ? colors.accent : colors.surfaceSecondary }
                        ]}
                      >
                        <Ionicons
                          name={arch.icon}
                          size={18}
                          color={active ? '#FFFFFF' : colors.textSecondary}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.archetypeTitle, { color: colors.textPrimary }]}>
                          {arch.title}
                        </Text>
                        <Text style={[styles.archetypeSub, { color: colors.textSecondary }]}>
                          {arch.subtitle}
                        </Text>
                      </View>
                      <Ionicons
                        name={active ? 'radio-button-on' : 'radio-button-off'}
                        size={20}
                        color={active ? colors.accent : colors.textMuted}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* 12 Spaces Grid */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                Deine 12 Wissens-Spaces feinjustieren
              </Text>
              <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
                Tippe auf einzelne Spaces, um sie zu aktivieren oder in den Hintergrund zu rücken:
              </Text>

              <View style={styles.topicsGrid}>
                {(Object.keys(TOPIC_METADATA) as TopicTag[]).map(tag => {
                  const meta = TOPIC_METADATA[tag];
                  const spaceMeta = TOPIC_SPACE_MAP[tag];
                  const isHigh = (interests[tag] ?? 0.5) > 0.45;

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
                        <View style={styles.topicHandleRow}>
                          <Ionicons
                            name={meta.icon as any}
                            size={16}
                            color={isHigh ? colors.accent : colors.textMuted}
                          />
                          <Text
                            style={[
                              styles.spaceHandleText,
                              { color: isHigh ? colors.accent : colors.textMuted }
                            ]}
                          >
                            {spaceMeta.space}
                          </Text>
                        </View>
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
                      <Text style={[styles.topicDesc, { color: colors.textSecondary }]} numberOfLines={2}>
                        {meta.description}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Custom Subchannel Creator */}
            <View
              style={[
                styles.inputCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.borderSubtle,
                  marginBottom: spacing.xl
                }
              ]}
            >
              <View style={styles.inputCardHeader}>
                <Ionicons name="sparkles" size={18} color={colors.accent} />
                <Text style={[styles.inputCardTitle, { color: colors.textPrimary }]}>
                  Eigenen Wissensraum hinzufügen
                </Text>
              </View>
              <Text style={[styles.inputCardDesc, { color: colors.textSecondary }]}>
                Vermissst du ein Spezialthema? Gib ein Thema ein (z. B. „Quantenphysik“, „Stoizismus“, „Synthesizer“) und atmen erschließt automatisch passende Primärquellen:
              </Text>
              <View style={styles.tokenInputRow}>
                <TextInput
                  style={[
                    styles.tokenInput,
                    {
                      backgroundColor: colors.surfaceSecondary,
                      borderColor: colors.border,
                      color: colors.textPrimary
                    }
                  ]}
                  placeholder="Thema (z. B. Epigenetik oder Kognition)"
                  placeholderTextColor={colors.textMuted}
                  value={newSpaceInput}
                  onChangeText={setNewSpaceInput}
                  onSubmitEditing={handleAddCustomSpace}
                  returnKeyType="done"
                />
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleAddCustomSpace}
                  disabled={isCreatingSpace || !newSpaceInput.trim()}
                  style={[
                    styles.verifyBtn,
                    {
                      backgroundColor: newSpaceInput.trim() ? colors.accent : colors.surfaceSecondary,
                      opacity: isCreatingSpace ? 0.6 : 1
                    }
                  ]}
                >
                  <Text
                    style={[
                      styles.verifyBtnText,
                      { color: newSpaceInput.trim() ? '#FFFFFF' : colors.textMuted }
                    ]}
                  >
                    {isCreatingSpace ? 'Erstelle…' : '+ Erstellen'}
                  </Text>
                </TouchableOpacity>
              </View>

              {customSpaceFeedback && (
                <Text style={[styles.statusNote, { color: colors.accent }]}>
                  {customSpaceFeedback}
                </Text>
              )}

              {customSpaces.length > 0 && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                  {customSpaces.map(cs => (
                    <View
                      key={cs.id}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        backgroundColor: colors.cardHighlight,
                        borderColor: colors.accent,
                        borderWidth: 1,
                        borderRadius: radius.pill,
                        paddingHorizontal: 10,
                        paddingVertical: 5
                      }}
                    >
                      <Ionicons name="sparkles" size={12} color={colors.accent} />
                      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
                        {cs.handle}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleFinish}
                style={[
                  styles.secondaryButton,
                  { backgroundColor: colors.surface, borderColor: colors.border }
                ]}
              >
                <Text style={[styles.secondaryButtonText, { color: colors.textPrimary }]}>
                  Sofort starten
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setStep(2)}
                style={[styles.primaryButton, { backgroundColor: colors.accent }]}
              >
                <Text style={styles.primaryButtonText}>Weiter: Rhythmus & Design</Text>
                <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </>
        )}

        {step === 2 && (
          <>
            {/* Reading Duration */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                2. Lese-Rhythmus & Tiefe
              </Text>
              <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
                Wie lang sollen die meisten Beiträge im Stream sein?
              </Text>
              <View style={styles.durationRow}>
                {[
                  { id: 'quick', label: 'Kompakt (20s–2m)', icon: 'flash-outline' as const },
                  { id: 'balanced', label: 'Ausgewogen (2–5m)', icon: 'layers-outline' as const },
                  { id: 'deep', label: 'Tiefgang (Essays)', icon: 'book-outline' as const }
                ].map(item => {
                  const active = duration === item.id;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      onPress={() => setDuration(item.id as ReadingPreferenceDuration)}
                      style={[
                        styles.durationPill,
                        {
                          backgroundColor: active ? colors.accent : colors.surface,
                          borderColor: active ? colors.accent : colors.borderSubtle
                        }
                      ]}
                    >
                      <Ionicons
                        name={item.icon}
                        size={15}
                        color={active ? '#FFFFFF' : colors.textSecondary}
                      />
                      <Text
                        style={[
                          styles.durationText,
                          { color: active ? '#FFFFFF' : colors.textPrimary }
                        ]}
                      >
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Language Mix */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                Sprach-Mischung der Quellen
              </Text>
              <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
                Wähle zwischen dem vollen zweisprachigen Pool (DE & EN) oder einem Sprachschwerpunkt:
              </Text>
              <View style={styles.durationRow}>
                {[
                  { id: 'bilingual', label: 'Deutsch & Englisch' },
                  { id: 'de_focus', label: 'Fokus Deutsch' },
                  { id: 'en_focus', label: 'Fokus Englisch' }
                ].map(item => {
                  const active = languageMix === item.id;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      onPress={() => setLanguageMix(item.id as any)}
                      style={[
                        styles.durationPill,
                        {
                          backgroundColor: active ? colors.accent : colors.surface,
                          borderColor: active ? colors.accent : colors.borderSubtle
                        }
                      ]}
                    >
                      <Text
                        style={[
                          styles.durationText,
                          { color: active ? '#FFFFFF' : colors.textPrimary }
                        ]}
                      >
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Didactics / Teaching Toggle */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                Didaktik- & Unterrichtsimpulse (c/didaktik_labor)
              </Text>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setIncludeDidactics(prev => !prev)}
                style={[
                  styles.archetypeCard,
                  {
                    backgroundColor: includeDidactics ? colors.cardHighlight : colors.surface,
                    borderColor: includeDidactics ? colors.accent : colors.borderSubtle
                  }
                ]}
              >
                <Ionicons
                  name="school-outline"
                  size={20}
                  color={includeDidactics ? colors.accent : colors.textSecondary}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.archetypeTitle, { color: colors.textPrimary }]}>
                    {includeDidactics
                      ? 'Unterrichts- & Lernimpulse aktiv (~10 % im Feed)'
                      : 'Unterrichtsimpulse ausgeblendet (0 %)'}
                  </Text>
                  <Text style={[styles.archetypeSub, { color: colors.textSecondary }]}>
                    Ideal für Lehrende und Wissensvermittler – oder mit einem Tipp deaktivierbar.
                  </Text>
                </View>
                <Ionicons
                  name={includeDidactics ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={includeDidactics ? colors.accent : colors.textMuted}
                />
              </TouchableOpacity>
            </View>

            {/* Cool Dark & Light Mode + Palette */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                Erscheinungsbild & Kühle Farbpalette
              </Text>
              <View style={[styles.durationRow, { marginBottom: spacing.md }]}>
                {[
                  { id: 'dark', label: 'Dark Mode (Schiefer)', icon: 'moon-outline' as const },
                  { id: 'light', label: 'Light Mode (Nordic)', icon: 'sunny-outline' as const }
                ].map(m => {
                  const active = (m.id === 'dark' && isDark) || (m.id === 'light' && !isDark);
                  return (
                    <TouchableOpacity
                      key={m.id}
                      onPress={() => setThemePreference(m.id as 'dark' | 'light')}
                      style={[
                        styles.durationPill,
                        {
                          backgroundColor: active ? colors.accent : colors.surface,
                          borderColor: active ? colors.accent : colors.borderSubtle
                        }
                      ]}
                    >
                      <Ionicons
                        name={m.icon}
                        size={15}
                        color={active ? '#FFFFFF' : colors.textSecondary}
                      />
                      <Text
                        style={[
                          styles.durationText,
                          { color: active ? '#FFFFFF' : colors.textPrimary }
                        ]}
                      >
                        {m.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.paletteGrid}>
                {(Object.keys(PALETTE_METADATA) as ThemePalette[]).map(pKey => {
                  const meta = PALETTE_METADATA[pKey];
                  const active = palette === pKey;
                  return (
                    <TouchableOpacity
                      key={pKey}
                      onPress={() => setPalettePreference(pKey)}
                      style={[
                        styles.palettePill,
                        {
                          backgroundColor: active ? colors.cardHighlight : colors.surface,
                          borderColor: active ? colors.accent : colors.borderSubtle
                        }
                      ]}
                    >
                      <View style={[styles.colorSwatch, { backgroundColor: meta.accent }]} />
                      <Text style={[styles.paletteLabel, { color: colors.textPrimary }]}>
                        {meta.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity
                onPress={() => setStep(1)}
                style={[
                  styles.secondaryButton,
                  { backgroundColor: colors.surface, borderColor: colors.border }
                ]}
              >
                <Ionicons name="arrow-back" size={16} color={colors.textPrimary} />
                <Text style={[styles.secondaryButtonText, { color: colors.textPrimary }]}>
                  Zurück
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setStep(3)}
                style={[styles.primaryButton, { backgroundColor: colors.accent }]}
              >
                <Text style={styles.primaryButtonText}>Weiter: Backup & Raindrop</Text>
                <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </>
        )}

        {step === 3 && (
          <>
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                3. Lokale Souveränität, Raindrop.io & Apple Vollbild
              </Text>

              <View
                style={[
                  styles.principlesBox,
                  { backgroundColor: colors.surface, borderColor: colors.borderSubtle }
                ]}
              >
                <View style={styles.principleRow}>
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={18}
                    color={colors.accent}
                    style={styles.principleIcon}
                  />
                  <Text style={[styles.principleText, { color: colors.textPrimary }]}>
                    <Text style={{ fontWeight: '700' }}>Lokales Gedächtnis & Auto-Backup:</Text> Alle Gewichtungen, Lesezeichen und Notizen wachsen lokal auf deinem Gerät und überstehen App-Updates automatisch.
                  </Text>
                </View>
                <View style={styles.principleRow}>
                  <Ionicons
                    name="phone-portrait-outline"
                    size={18}
                    color={colors.accent}
                    style={styles.principleIcon}
                  />
                  <Text style={[styles.principleText, { color: colors.textPrimary }]}>
                    <Text style={{ fontWeight: '700' }}>Vollbild auf iPhone & iPad + Spotify:</Text> Füge atmen in Safari über „Teilen → Zum Home-Bildschirm“ hinzu. Spotify spielt im Hintergrund unterbrechungsfrei weiter.
                  </Text>
                </View>
              </View>

              {/* Optional Raindrop Token */}
              <View
                style={[
                  styles.inputCard,
                  { backgroundColor: colors.surface, borderColor: colors.borderSubtle }
                ]}
              >
                <View style={styles.inputCardHeader}>
                  <Ionicons name="cloud-upload-outline" size={18} color={colors.accent} />
                  <Text style={[styles.inputCardTitle, { color: colors.textPrimary }]}>
                    Optional: 1-Tap Raindrop.io Lesezeichen-Sync
                  </Text>
                </View>
                <Text style={[styles.inputCardDesc, { color: colors.textSecondary }]}>
                  Wenn du deinen Raindrop.io Test-Token eingibst, landet jedes Lesezeichen beim Antippen automatisch auch in deiner Raindrop.io-Sammlung:
                </Text>
                <View style={styles.tokenInputRow}>
                  <TextInput
                    value={raindropToken}
                    onChangeText={setRaindropToken}
                    placeholder="Raindrop.io API Token (optional)"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={[
                      styles.tokenInput,
                      {
                        backgroundColor: colors.background,
                        color: colors.textPrimary,
                        borderColor: colors.border
                      }
                    ]}
                  />
                  <TouchableOpacity
                    onPress={handleVerifyRaindrop}
                    style={[styles.verifyBtn, { backgroundColor: colors.surfaceSecondary }]}
                  >
                    <Text style={[styles.verifyBtnText, { color: colors.textPrimary }]}>
                      Prüfen
                    </Text>
                  </TouchableOpacity>
                </View>
                {raindropStatus && (
                  <Text style={[styles.statusNote, { color: colors.accent }]}>
                    {raindropStatus}
                  </Text>
                )}
              </View>

              {/* Optional Weather City */}
              <View
                style={[
                  styles.inputCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.borderSubtle,
                    marginTop: spacing.md
                  }
                ]}
              >
                <View style={styles.inputCardHeader}>
                  <Ionicons name="partly-sunny-outline" size={18} color={colors.accent} />
                  <Text style={[styles.inputCardTitle, { color: colors.textPrimary }]}>
                    Ort für deine Morgenausgabe
                  </Text>
                </View>
                <View style={[styles.paletteGrid, { marginTop: 8 }]}>
                  {['dresden', 'berlin', 'muenchen', 'hamburg', 'wien', 'zuerich'].map(city => {
                    const active = weatherCity === city;
                    const label =
                      city === 'muenchen'
                        ? 'München'
                        : city === 'zuerich'
                        ? 'Zürich'
                        : city.charAt(0).toUpperCase() + city.slice(1);
                    return (
                      <TouchableOpacity
                        key={city}
                        onPress={() => setWeatherCity(city)}
                        style={[
                          styles.palettePill,
                          {
                            backgroundColor: active ? colors.accent : colors.background,
                            borderColor: active ? colors.accent : colors.borderSubtle
                          }
                        ]}
                      >
                        <Text
                          style={[
                            styles.paletteLabel,
                            { color: active ? '#FFFFFF' : colors.textPrimary }
                          ]}
                        >
                          {label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity
                onPress={() => setStep(2)}
                style={[
                  styles.secondaryButton,
                  { backgroundColor: colors.surface, borderColor: colors.border }
                ]}
              >
                <Ionicons name="arrow-back" size={16} color={colors.textPrimary} />
                <Text style={[styles.secondaryButtonText, { color: colors.textPrimary }]}>
                  Zurück
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleFinish}
                style={[styles.primaryButton, { backgroundColor: colors.accent }]}
              >
                <Text style={styles.primaryButtonText}>Persönlichen Feed starten</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </>
        )}

        <Text style={[styles.disclaimer, { color: colors.textMuted }]}>
          Kein Account erforderlich. Alle Einstellungen sind jederzeit in den Einstellungen anpassbar.
        </Text>
      </ScrollView>

      <HowItWorksModal visible={showHowItWorks} onClose={() => setShowHowItWorks(false)} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1
  },
  container: {
    paddingHorizontal: spacing.pageHorizontal,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
    maxWidth: 760,
    width: '100%',
    alignSelf: 'center'
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg
  },
  stepDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  stepDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  stepDotText: {
    fontSize: 12,
    fontWeight: '700'
  },
  stepLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4
  },
  explainerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1
  },
  explainerButtonText: {
    fontSize: 12,
    fontWeight: '600'
  },
  header: {
    marginBottom: spacing.lg,
    alignItems: 'center'
  },
  eyebrow: {
    fontSize: typography.sizes.micro,
    fontWeight: '800',
    letterSpacing: 1.8,
    marginBottom: 4,
    textTransform: 'uppercase'
  },
  brandTitle: {
    fontFamily: typography.fontFamilies.serif,
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 6
  },
  subtitle: {
    fontSize: typography.sizes.bodySmall,
    lineHeight: 21,
    textAlign: 'center',
    maxWidth: 520
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
    marginBottom: spacing.md,
    lineHeight: 19
  },
  archetypeList: {
    gap: 10
  },
  archetypeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1
  },
  archetypeIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center'
  },
  archetypeTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2
  },
  archetypeSub: {
    fontSize: 12,
    lineHeight: 17
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
    marginBottom: 6
  },
  topicHandleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  spaceHandleText: {
    fontSize: 11,
    fontWeight: '700'
  },
  checkboxPill: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  topicTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 3
  },
  topicDesc: {
    fontSize: 11,
    lineHeight: 15
  },
  durationRow: {
    flexDirection: 'row',
    gap: 8
  },
  durationPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    paddingHorizontal: 10,
    borderRadius: radius.md,
    borderWidth: 1
  },
  durationText: {
    fontSize: 12,
    fontWeight: '600'
  },
  paletteGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  palettePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: radius.md,
    borderWidth: 1
  },
  colorSwatch: {
    width: 12,
    height: 12,
    borderRadius: 6
  },
  paletteLabel: {
    fontSize: 12,
    fontWeight: '600'
  },
  principlesBox: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md
  },
  principleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8
  },
  principleIcon: {
    marginRight: 8,
    marginTop: 2
  },
  principleText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18
  },
  inputCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md
  },
  inputCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4
  },
  inputCardTitle: {
    fontSize: 14,
    fontWeight: '700'
  },
  inputCardDesc: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 10
  },
  tokenInputRow: {
    flexDirection: 'row',
    gap: 8
  },
  tokenInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13
  },
  verifyBtn: {
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderRadius: radius.sm
  },
  verifyBtnText: {
    fontSize: 12,
    fontWeight: '700'
  },
  statusNote: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: spacing.sm,
    marginBottom: spacing.lg
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderRadius: radius.md,
    borderWidth: 1
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: '600'
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: radius.md
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700'
  },
  disclaimer: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16
  }
});
