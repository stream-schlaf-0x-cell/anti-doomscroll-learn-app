import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TopicTag, TOPIC_METADATA, ReadingPreferenceDuration } from '../../core/domain/types';
import { useApp } from '../../core/context/AppContext';
import { typography, radius, spacing } from '../../ui/theme';
import { generateCraftMarkdown, copyToClipboard, downloadMarkdownFile } from '../../core/export/craftExport';

export const SettingsScreen: React.FC = () => {
  const {
    profile,
    interactions,
    savedArticles,
    updateTopicWeight,
    updateDurationPreference,
    setFontSize,
    setThemePreference,
    repeatOnboarding,
    clearAllLocalData,
    colors
  } = useApp();

  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);
  const [isClearing, setIsClearing] = useState<boolean>(false);
  const [craftNotice, setCraftNotice] = useState<string | null>(null);

  const handleAdjustWeight = (topic: TopicTag, delta: number) => {
    const current = profile.explicitInterests[topic] ?? 0.5;
    const next = Math.max(0, Math.min(1.0, Math.round((current + delta) * 10) / 10));
    updateTopicWeight(topic, next);
  };

  const handleRepeatOnboarding = async () => {
    await repeatOnboarding();
  };

  const handleConfirmClearAll = async () => {
    setIsClearing(true);
    try {
      await clearAllLocalData();
    } finally {
      setIsClearing(false);
      setShowClearConfirm(false);
    }
  };

  const handleCopyCraftMarkdown = async () => {
    const md = generateCraftMarkdown(savedArticles, interactions);
    const ok = await copyToClipboard(md);
    if (ok) {
      setCraftNotice('✓ Als Craft-Markdown in Zwischenablage kopiert!');
      setTimeout(() => setCraftNotice(null), 3000);
    } else {
      setCraftNotice('Kopieren fehlgeschlagen.');
      setTimeout(() => setCraftNotice(null), 3000);
    }
  };

  const handleDownloadCraftMarkdown = () => {
    const md = generateCraftMarkdown(savedArticles, interactions);
    const ok = downloadMarkdownFile(`atem-archiv-${new Date().toISOString().slice(0, 10)}.md`, md);
    if (ok) {
      setCraftNotice('✓ Download gestartet (atem-archiv.md)');
      setTimeout(() => setCraftNotice(null), 3000);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.borderSubtle }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          Einstellungen
        </Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          Transparente Steuerung deiner intellektuellen Umgebung
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Section: Topic Weights */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Themengewichtung für die Tagesausgabe
          </Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
            Passe die Relevanz an. Änderungen wirken sich sofort spürbar auf die Reihung deines Feeds aus.
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
                      accessibilityRole="button"
                      accessibilityLabel={`${meta.label} Priorität verringern`}
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
                      accessibilityRole="button"
                      accessibilityLabel={`${meta.label} Priorität erhöhen`}
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
                accessibilityRole="button"
                accessibilityLabel={`Lesezeit ${d.label} wählen`}
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
                    accessibilityRole="button"
                    accessibilityLabel={`Erscheinungsbild ${t.label} aktivieren`}
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
                    accessibilityRole="button"
                    accessibilityLabel={`Schriftgröße ${size.toUpperCase()} wählen`}
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

        {/* Section: AI Sparring & Budget Control */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            KI-Sparring & Budgetkontrolle (€5.00 / Monat)
          </Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
            Intellektueller Gegenwind im Atem-Netzwerk. Strikte Kostenbegrenzung mit Zero-Risk-Garantie.
          </Text>
          <View style={[styles.box, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
            <View style={{ padding: spacing.md }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ fontSize: typography.sizes.bodySmall, fontWeight: '700', color: colors.textPrimary }}>
                  Monatlicher KI-Deckel: 5,00 €
                </Text>
                <View style={[styles.badgeActive, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                  <Text style={[styles.badgeActiveText, { color: '#10B981' }]}>Gedeckelt & Sicher</Text>
                </View>
              </View>

              {/* Budget Progress Bar */}
              <View style={[styles.budgetTrack, { backgroundColor: colors.surfaceSecondary }]}>
                <View style={[styles.budgetFill, { width: '8%', backgroundColor: colors.accent }]} />
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, marginBottom: 12 }}>
                <Text style={{ fontSize: typography.sizes.micro, color: colors.textMuted }}>
                  Verbraucht: ~0,38 € (7,6%)
                </Text>
                <Text style={{ fontSize: typography.sizes.micro, color: colors.accent, fontWeight: '600' }}>
                  Verbleibend: 4,62 €
                </Text>
              </View>

              <Text style={{ fontSize: typography.sizes.micro, color: colors.textSecondary, lineHeight: 18, marginBottom: 10 }}>
                • Modell: <Text style={{ fontWeight: '700', color: colors.textPrimary }}>Gemini 2.5 Flash</Text> ($0.10/M In, $0.40/M Out).{'\n'}
                • Sparring-Partner: <Text style={{ fontStyle: 'italic', color: colors.textPrimary }}>u/sokrates_2026</Text> (Dialektik), <Text style={{ fontStyle: 'italic', color: colors.textPrimary }}>u/didaktik_labor</Text> (Unterricht Sek II).{'\n'}
                • Null-Kosten-Garantie: Bei Erreichen des 5-€-Limits oder ohne hinterlegten Key schaltet Atem unterbrechungsfrei auf die lokale Heuristik um.
              </Text>
            </View>
          </View>
        </View>

        {/* Section: Craft Docs & Markdown Export */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Datensouveränität & Craft Docs Export
          </Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
            Exportiere alle gemerkten Lese-Entdeckungen, dialektischen Einwände und Sparring-Dialoge in dein persönliches Craft- oder Obsidian-Archiv.
          </Text>
          <View style={[styles.box, { backgroundColor: colors.surface, borderColor: colors.borderSubtle, padding: spacing.md }]}>
            {craftNotice && (
              <View style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', padding: 10, borderRadius: radius.md, marginBottom: 12 }}>
                <Text style={{ fontSize: typography.sizes.micro, color: '#10B981', fontWeight: '700', textAlign: 'center' }}>
                  {craftNotice}
                </Text>
              </View>
            )}

            <Text style={{ fontSize: typography.sizes.micro, color: colors.textSecondary, lineHeight: 18, marginBottom: 12 }}>
              Bereit für <Text style={{ fontWeight: '700', color: colors.textPrimary }}>Craft Docs</Text>, <Text style={{ fontWeight: '700', color: colors.textPrimary }}>Obsidian</Text>, <Text style={{ fontWeight: '700', color: colors.textPrimary }}>Notion</Text> oder <Text style={{ fontWeight: '700', color: colors.textPrimary }}>Bear</Text>. Enthält vollständige Quellenverweise, Kern-Erkenntnisse und deine verfassten Unterrichtsnotizen.
            </Text>

            <View style={styles.exportButtonRow}>
              <TouchableOpacity
                onPress={handleCopyCraftMarkdown}
                style={[styles.exportActionBtn, { backgroundColor: colors.accent }]}
                accessibilityRole="button"
                accessibilityLabel="Bibliothek als Craft-Markdown in Zwischenablage kopieren"
              >
                <Ionicons name="copy-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.exportActionBtnText}>In Zwischenablage kopieren</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleDownloadCraftMarkdown}
                style={[styles.exportActionBtn, { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.borderSubtle }]}
                accessibilityRole="button"
                accessibilityLabel="Bibliothek als Markdown-Datei herunterladen"
              >
                <Ionicons name="download-outline" size={16} color={colors.textPrimary} style={{ marginRight: 6 }} />
                <Text style={[styles.exportActionBtnText, { color: colors.textPrimary }]}>Als .md herunterladen</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Section: Verified Quality Sources */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Öffentlich-Rechtliche & Geprüfte Qualitätsquellen
          </Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
            Verlässlicher deutscher Journalismus & intellektuelle Tiefenquellen ohne Clickbait-Algorithmen.
          </Text>
          <View style={[styles.box, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
            <View style={{ padding: spacing.md, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {[
                { name: 'ARD Tagesschau Wissen', icon: 'newspaper-outline' },
                { name: 'ARD Tagesschau Inland', icon: 'globe-outline' },
                { name: 'ZDFheute Wissen & Kultur', icon: 'tv-outline' },
                { name: 'Stanford Encyclopedia', icon: 'book-outline' },
                { name: 'Daily Nous (Philosophie)', icon: 'chatbubbles-outline' },
                { name: 'Deutsches Schulportal', icon: 'school-outline' },
                { name: 'Quanta Magazine', icon: 'analytics-outline' },
                { name: 'Simon Willison AI', icon: 'code-slash-outline' },
                { name: 'Lines Modular Audio', icon: 'hardware-chip-outline' }
              ].map(source => (
                <View key={source.name} style={[styles.sourceTag, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
                  <Ionicons name={source.icon as any} size={14} color={colors.accent} style={{ marginRight: 5 }} />
                  <Text style={[styles.sourceTagText, { color: colors.textPrimary }]}>{source.name}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Section: Ecosystem Roadmap */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Weitere Ökosystem-Anbindungen (Roadmap)
          </Text>
          <View style={[styles.box, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
            <View style={styles.roadmapItem}>
              <Ionicons name="bookmark-outline" size={20} color={colors.accent} style={{ marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.roadmapTitle, { color: colors.textPrimary }]}>Raindrop.io Lesezeichen</Text>
                <Text style={[styles.roadmapDesc, { color: colors.textMuted }]}>
                  Intelligente Synchronisation mit deinen kuratierten Sammlungen (Phase 5).
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
            Datenschutz & Speicherverwaltung
          </Text>
          <View style={[styles.box, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
            <View style={{ padding: spacing.md }}>
              <Text style={[styles.privacyText, { color: colors.textSecondary }]}>
                Alle Daten, Lesezeichen und Interessensprofile sind lokal auf diesem Gerät gespeichert (Local-First). Es erfolgt keine ungefragte Weitergabe an Cloud-Server oder Werbenetzwerke.
              </Text>
            </View>

            {/* Repeat Onboarding Option (Non-destructive) */}
            <TouchableOpacity
              onPress={handleRepeatOnboarding}
              style={[styles.resetButton, { borderTopColor: colors.borderSubtle }]}
              accessibilityRole="button"
              accessibilityLabel="Onboarding wiederholen, Daten bleiben erhalten"
            >
              <Ionicons name="sparkles-outline" size={16} color={colors.accent} style={{ marginRight: 8 }} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.actionRowTitle, { color: colors.textPrimary }]}>
                  Onboarding wiederholen
                </Text>
                <Text style={[styles.actionRowSubtitle, { color: colors.textMuted }]}>
                  Passe Themen und Lesezeit neu an. Deine Lesezeichen und Lesefortschritte bleiben erhalten.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </TouchableOpacity>

            {/* Destructive Clear All Data Option */}
            <TouchableOpacity
              onPress={() => setShowClearConfirm(true)}
              style={[styles.resetButton, { borderTopColor: colors.borderSubtle }]}
              accessibilityRole="button"
              accessibilityLabel="Alle lokalen Daten löschen und App zurücksetzen"
            >
              <Ionicons name="trash-outline" size={16} color={colors.danger} style={{ marginRight: 8 }} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.actionRowTitle, { color: colors.danger }]}>
                  Alle lokalen Daten löschen
                </Text>
                <Text style={[styles.actionRowSubtitle, { color: colors.textMuted }]}>
                  Setzt die gesamte Datenbank zurück: Lesezeichen, Leseverlauf und Profile werden gelöscht.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.danger} />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Confirmation Modal for Destructive Reset */}
      <Modal
        visible={showClearConfirm}
        transparent={true}
        animationType="fade"
        onRequestClose={() => !isClearing && setShowClearConfirm(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
            <View style={styles.modalHeader}>
              <View style={[styles.warningIconCircle, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                <Ionicons name="warning" size={24} color={colors.danger} />
              </View>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                Alle lokalen Daten löschen?
              </Text>
            </View>

            <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>
              Bist du sicher? Diese Aktion setzt Atem vollständig in den Auslieferungszustand zurück:
            </Text>

            <View style={[styles.deleteItemsBox, { backgroundColor: colors.surfaceSecondary }]}>
              <Text style={[styles.deleteItemText, { color: colors.textPrimary }]}>
                • Alle gespeicherten Lesezeichen & die Bibliothek
              </Text>
              <Text style={[styles.deleteItemText, { color: colors.textPrimary }]}>
                • Vollständiger Lesefortschritt aller Artikel
              </Text>
              <Text style={[styles.deleteItemText, { color: colors.textPrimary }]}>
                • Alle Feedback-Bewertungen („Mehr davon / Weniger“)
              </Text>
              <Text style={[styles.deleteItemText, { color: colors.textPrimary }]}>
                • Persönliche Themengewichtungen & Lesezeit-Präferenzen
              </Text>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setShowClearConfirm(false)}
                disabled={isClearing}
                style={[styles.modalCancelBtn, { backgroundColor: colors.surfaceSecondary }]}
                accessibilityRole="button"
                accessibilityLabel="Abbrechen"
              >
                <Text style={[styles.modalCancelBtnText, { color: colors.textPrimary }]}>
                  Abbrechen
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleConfirmClearAll}
                disabled={isClearing}
                style={[styles.modalConfirmBtn, { backgroundColor: colors.danger }]}
                accessibilityRole="button"
                accessibilityLabel="Unwiderruflich löschen"
              >
                {isClearing ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.modalConfirmBtnText}>
                    Unwiderruflich löschen
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
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
    alignItems: 'center',
    padding: spacing.md,
    borderTopWidth: 0.5
  },
  resetButtonText: {
    fontSize: typography.sizes.bodySmall,
    fontWeight: '600'
  },
  actionRowTitle: {
    fontSize: typography.sizes.bodySmall,
    fontWeight: '600',
    marginBottom: 2
  },
  actionRowSubtitle: {
    fontSize: typography.sizes.micro,
    lineHeight: 16
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.pageHorizontal
  },
  modalCard: {
    width: '100%',
    maxWidth: 460,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md
  },
  warningIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm
  },
  modalTitle: {
    flex: 1,
    fontSize: typography.sizes.title2,
    fontWeight: '700'
  },
  modalMessage: {
    fontSize: typography.sizes.bodySmall,
    lineHeight: 20,
    marginBottom: spacing.md
  },
  deleteItemsBox: {
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: 6
  },
  deleteItemText: {
    fontSize: typography.sizes.micro,
    lineHeight: 18
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-end'
  },
  modalCancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center'
  },
  modalCancelBtnText: {
    fontSize: typography.sizes.bodySmall,
    fontWeight: '600'
  },
  modalConfirmBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 140
  },
  modalConfirmBtnText: {
    color: '#FFFFFF',
    fontSize: typography.sizes.bodySmall,
    fontWeight: '600'
  },
  badgeActive: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill
  },
  badgeActiveText: {
    fontSize: typography.sizes.micro,
    fontWeight: '700'
  },
  budgetTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    width: '100%'
  },
  budgetFill: {
    height: '100%',
    borderRadius: 4
  },
  exportButtonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6
  },
  exportActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.md
  },
  exportActionBtnText: {
    fontSize: typography.sizes.micro,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  sourceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 0.5
  },
  sourceTagText: {
    fontSize: typography.sizes.micro,
    fontWeight: '500'
  }
});
