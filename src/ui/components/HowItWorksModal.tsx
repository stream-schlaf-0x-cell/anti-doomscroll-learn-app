import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Pressable,
  ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../core/context/AppContext';
import { spacing, radius } from '../theme';
import { VERIFIED_FEED_SOURCES } from '../../core/ingestion/sources';

interface HowItWorksModalProps {
  visible: boolean;
  onClose: () => void;
}

export const HowItWorksModal: React.FC<HowItWorksModalProps> = ({ visible, onClose }) => {
  const { colors } = useApp();

  const sections = [
    {
      icon: 'compass-outline' as const,
      title: '1. Was ist atmen? (Bloomscrolling statt Doomscrolling)',
      body: `atmen ist dein ruhiger, lebendiger Reddit-Ersatz für echte Erkenntnis. Statt Aufregungs-Algorithmen und Werbe-Timelines liest du aus ${VERIFIED_FEED_SOURCES.length} geprüften deutsch- und englischsprachigen Quellen: Forschung, KI & Systeme, Philosophie, Literatur, Klangkunst, Museen, Webcomics und echte Fach-Communities.`
    },
    {
      icon: 'layers-outline' as const,
      title: '2. Das 7-Tage-Qualitätsfenster (Kein „Newest Junk“)',
      body: 'In sozialen Netzwerken zeigt „Neu“ oft ungefilterten Minuten-Lärm. atmen nutzt im Live-Stream ein gleitendes 7-Tage-Qualitätsfenster: Gehaltvolle Essays, Peer-Review-Studien und tiefgründige Debatten der gesamten letzten Woche werden nach Substanz und Quellenvielfalt gemischt. Außerdem kannst du in jedem Themen-Space (c/...) jederzeit live neue Forschung via OpenAlex, Wikipedia und Hacker News abrufen.'
    },
    {
      icon: 'shield-checkmark-outline' as const,
      title: '3. 100 % Lokale Datensouveränität & Auto-Backup',
      body: 'Der öffentliche Nachrichten- und Wissenspool wird über GitHub bereitgestellt – aber dein persönliches Profil, deine Gewichtungen, deine Lese-Chronik und deine Notizen bleiben zu 100 % lokal auf deinem Gerät. Bei jeder Nutzung aktualisiert atmen automatisch ein lokales Sicherheits-Backup (@atem:auto_backup:v1), sodass dein Fortschritt bei App-Updates erhalten bleibt. In den Einstellungen kannst du dein Wissen zudem jederzeit mit einem Klick als JSON-Datei sichern.'
    },
    {
      icon: 'cloud-upload-outline' as const,
      title: '4. 1-Tap Raindrop.io Lesezeichen-Sync',
      body: 'Wenn du im Onboarding oder in den Einstellungen deinen persönlichen Raindrop.io Test-Token hinterlegst, wird jedes Lesezeichen beim Antippen automatisch lokal in deiner atmen-Bibliotheka UND mitsamt Themen-Tags in deiner Raindrop.io-Sammlung gespeichert.'
    },
    {
      icon: 'phone-portrait-outline' as const,
      title: '5. Vollbild auf iPhone & iPad + Spotify-kompatibel',
      body: 'Öffne atmen in Safari auf deinem iPhone oder iPad und wähle „Teilen → Zum Home-Bildschirm“. Die App startet im echten Vollbildmodus ohne Browser-Leisten. Da atmen keine Hintergrund-Audio-Session beansprucht, läuft dein Spotify- oder Apple-Music-Stream beim Lesen in der Bahn oder im Café völlig unterbrechungsfrei weiter.'
    }
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={[styles.backdrop, { backgroundColor: 'rgba(0,0,0,0.65)' }]}>
        <Pressable
          accessibilityLabel="Hintergrund schließen"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border
            }
          ]}
          onStartShouldSetResponder={() => true}
          // @ts-ignore - web click propagation guard
          onClick={(e: any) => {
            if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
          }}
        >
          <View style={[styles.header, { borderBottomColor: colors.borderSubtle }]}>
            <View style={styles.headerTitleRow}>
              <View style={[styles.iconBadge, { backgroundColor: colors.accentSubtle }]}>
                <Ionicons name="information-circle-outline" size={20} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: colors.textPrimary }]}>
                  Wie atmen funktioniert
                </Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                  Architektur, Datenschutz, 7-Tage-Kuratierung & Apple-Vollbild
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: colors.surfaceSecondary }]}
              accessibilityLabel="Erklärung schließen"
            >
              <Ionicons name="close" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {sections.map((sec, idx) => (
              <View
                key={idx}
                style={[
                  styles.card,
                  {
                    backgroundColor: colors.surfaceSecondary,
                    borderColor: colors.borderSubtle
                  }
                ]}
              >
                <View style={styles.cardHeader}>
                  <Ionicons name={sec.icon} size={18} color={colors.accent} />
                  <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
                    {sec.title}
                  </Text>
                </View>
                <Text style={[styles.cardBody, { color: colors.textSecondary }]}>
                  {sec.body}
                </Text>
              </View>
            ))}

            <View
              style={[
                styles.summaryBanner,
                {
                  backgroundColor: colors.accentSubtle,
                  borderColor: colors.borderSubtle
                }
              ]}
            >
              <Ionicons name="checkmark-circle-outline" size={18} color={colors.accent} />
              <Text style={[styles.summaryText, { color: colors.textPrimary }]}>
                Kurz gesagt: Öffentlicher Wissens-Snapshot von GitHub + Live-Forschungs-APIs + 100 % privates lokales Gedächtnis auf deinem Gerät.
              </Text>
            </View>
          </ScrollView>

          <View style={[styles.footer, { borderTopColor: colors.borderSubtle }]}>
            <TouchableOpacity
              style={[styles.doneButton, { backgroundColor: colors.accent }]}
              onPress={onClose}
              activeOpacity={0.85}
            >
              <Text style={styles.doneButtonText}>Verstanden & Weiterlesen</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md
  },
  sheet: {
    width: '100%',
    maxWidth: 640,
    maxHeight: '88%',
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center'
  },
  title: {
    fontSize: 17,
    fontWeight: '700'
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center'
  },
  scrollArea: {
    flexGrow: 0
  },
  scrollContent: {
    padding: spacing.lg,
    gap: spacing.md
  },
  card: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    flex: 1
  },
  cardBody: {
    fontSize: 13,
    lineHeight: 20
  },
  summaryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1
  },
  summaryText: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
    flex: 1
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    alignItems: 'flex-end'
  },
  doneButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: radius.md
  },
  doneButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700'
  }
});
