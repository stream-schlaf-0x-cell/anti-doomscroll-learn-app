import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'qrcode';
import { useApp } from '../../core/context/AppContext';
import { typography, radius, spacing } from '../theme';
import { copyToClipboard } from '../../core/export/craftExport';

interface MobilePublishModalProps {
  visible: boolean;
  onClose: () => void;
}

export const MobilePublishModal: React.FC<MobilePublishModalProps> = ({ visible, onClose }) => {
  const { colors } = useApp();
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  // Determine local LAN IP URL
  const defaultLanUrl = 'http://192.168.178.31:8081';
  const accessUrl = typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
    ? `${window.location.protocol}//${window.location.host}`
    : defaultLanUrl;

  useEffect(() => {
    if (visible) {
      QRCode.toDataURL(accessUrl, {
        width: 320,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      })
        .then(url => setQrDataUrl(url))
        .catch(err => console.warn('QR Code generation error:', err));
    }
  }, [visible, accessUrl]);

  const handleCopy = async () => {
    const ok = await copyToClipboard(accessUrl);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.borderSubtle }]}>
            <View style={styles.headerLeft}>
              <View style={[styles.iconEmblem, { backgroundColor: '#10B981' + '1A' }]}>
                <Ionicons name="phone-portrait-outline" size={18} color="#10B981" />
              </View>
              <View>
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
                  Auf dem Smartphone nutzen
                </Text>
                <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
                  Lokal im WLAN bereitgestellt • Funktioniert jederzeit & dauerhaft
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: colors.surfaceSecondary }]}
              accessibilityRole="button"
              accessibilityLabel="Schließen"
            >
              <Ionicons name="close" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
            {/* Top QR & URL Hero */}
            <View style={[styles.qrHeroBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
              {qrDataUrl ? (
                <View style={styles.qrWrapper}>
                  <Image source={{ uri: qrDataUrl }} style={styles.qrImage} resizeMode="contain" />
                </View>
              ) : (
                <View style={[styles.qrPlaceholder, { backgroundColor: colors.surface }]}>
                  <Text style={{ color: colors.textMuted }}>QR-Code wird generiert…</Text>
                </View>
              )}

              <View style={styles.urlBox}>
                <Text style={[styles.urlLabel, { color: colors.textMuted }]}>Lokale Netzwerk-Adresse:</Text>
                <Text style={[styles.urlValue, { color: colors.accent }]}>{accessUrl}</Text>
                <TouchableOpacity
                  onPress={handleCopy}
                  style={[styles.copyPill, { backgroundColor: copied ? '#10B981' : colors.accent }]}
                >
                  <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                  <Text style={styles.copyPillText}>{copied ? 'Kopiert!' : 'Link kopieren'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* 3-Step Setup Instructions */}
            <View style={{ marginTop: spacing.lg }}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                In 3 Schritten als Vollbild-App auf dem Smartphone:
              </Text>

              <View style={styles.stepsList}>
                <View style={[styles.stepCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
                  <View style={[styles.stepNumberBadge, { backgroundColor: colors.accent }]}>
                    <Text style={styles.stepNumberText}>1</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.stepHeading, { color: colors.textPrimary }]}>Gleiches WLAN verbinden</Text>
                    <Text style={[styles.stepDesc, { color: colors.textSecondary }]}>
                      Stelle sicher, dass dein Smartphone mit demselben WLAN-Netzwerk verbunden ist wie dein Mac.
                    </Text>
                  </View>
                </View>

                <View style={[styles.stepCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
                  <View style={[styles.stepNumberBadge, { backgroundColor: colors.accent }]}>
                    <Text style={styles.stepNumberText}>2</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.stepHeading, { color: colors.textPrimary }]}>Kamera scannen lassen</Text>
                    <Text style={[styles.stepDesc, { color: colors.textSecondary }]}>
                      Öffne deine Kamera-App, richte sie auf den QR-Code und tippe auf das gelbe Banner, um Atem im Browser zu öffnen.
                    </Text>
                  </View>
                </View>

                <View style={[styles.stepCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
                  <View style={[styles.stepNumberBadge, { backgroundColor: '#10B981' }]}>
                    <Text style={styles.stepNumberText}>3</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.stepHeading, { color: colors.textPrimary }]}>Zum Home-Bildschirm hinzufügen</Text>
                    <Text style={[styles.stepDesc, { color: colors.textSecondary }]}>
                      • <Text style={{ fontWeight: '700' }}>iOS (Safari):</Text> Teilen-Symbol (Viereck mit Pfeil) tippen → „Zum Home-Bildschirm“.{'\n'}
                      • <Text style={{ fontWeight: '700' }}>Android (Chrome):</Text> Drei-Punkte-Menü → „App installieren“ oder „Zum Startbildschirm hinzufügen“.
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Offline & Continuous Learning Notice */}
            <View style={[styles.noticeBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                <Ionicons name="infinite-outline" size={16} color={colors.accent} style={{ marginRight: 6 }} />
                <Text style={[styles.noticeTitle, { color: colors.textPrimary }]}>Dauerbetrieb & Lokale Autonomie</Text>
              </View>
              <Text style={[styles.noticeText, { color: colors.textMuted }]}>
                Die Web-App speichert deine Lesefortschritte, Lesezeichen und Notizen direkt auf deinem Smartphone (IndexedDB / LocalStorage). Selbst wenn du den Mac kurz in den Ruhezustand versetzt, bleiben deine geladenen Artikel und Notizen vollständig verfügbar.
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md
  },
  card: {
    width: '100%',
    maxWidth: 680,
    maxHeight: '90%',
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1
  },
  iconEmblem: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center'
  },
  headerTitle: {
    fontSize: typography.sizes.body,
    fontWeight: '700'
  },
  headerSubtitle: {
    fontSize: typography.sizes.caption,
    marginTop: 1
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    justifyContent: 'center',
    alignItems: 'center'
  },
  content: {
    flex: 1
  },
  contentContainer: {
    padding: spacing.lg
  },
  qrHeroBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.lg,
    flexWrap: 'wrap'
  },
  qrWrapper: {
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: radius.md,
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
  },
  qrImage: {
    width: 160,
    height: 160
  },
  qrPlaceholder: {
    width: 160,
    height: 160,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center'
  },
  urlBox: {
    flex: 1,
    minWidth: 200
  },
  urlLabel: {
    fontSize: typography.sizes.caption,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4
  },
  urlValue: {
    fontSize: typography.sizes.body,
    fontWeight: '700',
    marginBottom: spacing.md
  },
  copyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill
  },
  copyPillText: {
    color: '#FFFFFF',
    fontSize: typography.sizes.bodySmall,
    fontWeight: '600'
  },
  sectionTitle: {
    fontSize: typography.sizes.bodySmall,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.md
  },
  stepsList: {
    gap: spacing.sm
  },
  stepCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.md
  },
  stepNumberBadge: {
    width: 26,
    height: 26,
    borderRadius: radius.full,
    justifyContent: 'center',
    alignItems: 'center'
  },
  stepNumberText: {
    color: '#FFFFFF',
    fontSize: typography.sizes.caption,
    fontWeight: '700'
  },
  stepHeading: {
    fontSize: typography.sizes.bodySmall,
    fontWeight: '700',
    marginBottom: 2
  },
  stepDesc: {
    fontSize: typography.sizes.caption,
    lineHeight: 18
  },
  noticeBox: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1
  },
  noticeTitle: {
    fontSize: typography.sizes.caption,
    fontWeight: '700'
  },
  noticeText: {
    fontSize: typography.sizes.caption,
    lineHeight: 17
  }
});
