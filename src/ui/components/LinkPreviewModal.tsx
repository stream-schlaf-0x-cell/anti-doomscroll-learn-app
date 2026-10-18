import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Pressable, ScrollView, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../core/context/AppContext';
import { radius, spacing } from '../theme';

interface LinkPreviewModalProps {
  visible: boolean;
  onClose: () => void;
  url: string;
  title?: string;
  publisher?: string;
  domain?: string;
  snippet?: string;
  estimatedMinutes?: number;
}

export const LinkPreviewModal: React.FC<LinkPreviewModalProps> = ({
  visible,
  onClose,
  url,
  title,
  publisher,
  domain,
  snippet,
  estimatedMinutes
}) => {
  const { colors } = useApp();
  const [activeTab, setActiveTab] = useState<'summary' | 'web'>('summary');
  const [copied, setCopied] = useState(false);

  if (!visible) return null;

  const displayDomain = domain || (() => {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return 'Fachquelle';
    }
  })();

  const handleOpenBrowser = () => {
    if (typeof window !== 'undefined' && window.open) {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      Linking.openURL(url);
    }
  };

  const handleCopyLink = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <Pressable
          accessibilityLabel="Hintergrund schließen"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <View
          style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
          onStartShouldSetResponder={() => true}
          // @ts-ignore - web click propagation guard
          onClick={(e: any) => {
            if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
          }}
        >
          
          {/* Header Bar */}
          <View style={[styles.headerBar, { borderBottomColor: colors.borderSubtle }]}>
            <View style={styles.headerLeft}>
              <View style={[styles.domainBadge, { backgroundColor: colors.accentSubtle }]}>
                <Ionicons name="globe-outline" size={14} color={colors.accent} style={{ marginRight: 5 }} />
                <Text style={[styles.domainBadgeText, { color: colors.accent }]}>
                  {displayDomain}
                </Text>
              </View>
              <Text style={[styles.dotSep, { color: colors.textMuted }]}>•</Text>
              <View style={styles.verifiedRow}>
                <Ionicons name="shield-checkmark" size={13} color="#10B981" style={{ marginRight: 4 }} />
                <Text style={[styles.verifiedText, { color: colors.textSecondary }]}>
                  {publisher || 'Geprüfte Quelle'}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: colors.surfaceSecondary }]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel="Vorschau schließen"
            >
              <Ionicons name="close" size={18} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Title & URL Subhead */}
          <View style={styles.titleContainer}>
            <Text style={[styles.articleTitle, { color: colors.textPrimary }]} numberOfLines={2}>
              {title || 'Vorschau der Originalquelle'}
            </Text>
            <View style={styles.urlRow}>
              <Ionicons name="link-outline" size={12} color={colors.textMuted} style={{ marginRight: 4 }} />
              <Text style={[styles.urlText, { color: colors.textMuted }]} numberOfLines={1}>
                {url}
              </Text>
            </View>
          </View>

          {/* Tab Selector */}
          <View style={[styles.tabRow, { backgroundColor: colors.surfaceSecondary }]}>
            <TouchableOpacity
              onPress={() => setActiveTab('summary')}
              style={[
                styles.tabBtn,
                activeTab === 'summary' && [styles.tabBtnActive, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]
              ]}
            >
              <Ionicons
                name="document-text-outline"
                size={14}
                color={activeTab === 'summary' ? colors.accent : colors.textMuted}
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  styles.tabBtnText,
                  { color: activeTab === 'summary' ? colors.textPrimary : colors.textMuted }
                ]}
              >
                Inhalts-Extrakt & Relevanz
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActiveTab('web')}
              style={[
                styles.tabBtn,
                activeTab === 'web' && [styles.tabBtnActive, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]
              ]}
            >
              <Ionicons
                name="browsers-outline"
                size={14}
                color={activeTab === 'web' ? colors.accent : colors.textMuted}
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  styles.tabBtnText,
                  { color: activeTab === 'web' ? colors.textPrimary : colors.textMuted }
                ]}
              >
                Web-Vorschau
              </Text>
            </TouchableOpacity>
          </View>

          {/* Body Content */}
          <View style={styles.bodyContainer}>
            {activeTab === 'summary' ? (
              <ScrollView style={styles.summaryScroll} showsVerticalScrollIndicator={false}>
                {estimatedMinutes && (
                  <View style={[styles.metaBadgeRow, { marginBottom: 12 }]}>
                    <View style={[styles.metaBadge, { backgroundColor: colors.surfaceSecondary }]}>
                      <Ionicons name="time-outline" size={12} color={colors.accent} style={{ marginRight: 4 }} />
                      <Text style={[styles.metaBadgeText, { color: colors.textSecondary }]}>
                        ca. {estimatedMinutes} Min. Originallesezeit
                      </Text>
                    </View>
                  </View>
                )}

                <View style={[styles.cardExcerptBox, { backgroundColor: colors.surfaceSecondary, borderLeftColor: colors.accent }]}>
                  <Text style={[styles.cardExcerptLabel, { color: colors.accent }]}>
                    Worum geht es im Originalbeitrag?
                  </Text>
                  <Text style={[styles.cardExcerptText, { color: colors.textPrimary }]}>
                    {snippet || 'Dieser Fachbeitrag stammt direkt aus dem verifizierten News-Hub. Er wurde redaktionell geprüft und auf methodische Qualität sowie intellektuellen Erkenntnisgewinn hin bewertet.'}
                  </Text>
                </View>

                <View style={styles.whyProvenanceBox}>
                  <View style={styles.whyHeaderRow}>
                    <Ionicons name="sparkles" size={14} color="#F59E0B" style={{ marginRight: 6 }} />
                    <Text style={[styles.whyTitle, { color: colors.textPrimary }]}>
                      Warum dieser Link im Feed erscheint
                    </Text>
                  </View>
                  <Text style={[styles.whyExplanation, { color: colors.textSecondary }]}>
                    • Vollständig werbefrei und ohne Clickbait-Tracker erfasst.{'\n'}
                    • Passt zu deinen gewählten Themenschwerpunkten und Zielen.{'\n'}
                    • Liefert primäre Fachquellen für vertieftes Verständnis.
                  </Text>
                </View>
              </ScrollView>
            ) : (
              <View style={styles.webContainer}>
                {typeof window !== 'undefined' ? (
                  <iframe
                    src={url}
                    title={title || 'Web-Vorschau'}
                    style={{
                      width: '100%',
                      height: '100%',
                      border: 'none',
                      borderRadius: radius.md,
                      backgroundColor: '#FFFFFF'
                    }}
                    sandbox="allow-scripts allow-same-origin allow-popups"
                  />
                ) : (
                  <View style={styles.iframeFallback}>
                    <Ionicons name="globe-outline" size={32} color={colors.accent} />
                    <Text style={[styles.fallbackTitle, { color: colors.textPrimary }]}>
                      Externe Web-Vorschau
                    </Text>
                    <Text style={[styles.fallbackText, { color: colors.textSecondary }]}>
                      Tippe auf den Button unten, um den Artikel direkt im Standardbrowser zu öffnen.
                    </Text>
                  </View>
                )}
                
                <View style={[styles.webNoticeBar, { backgroundColor: colors.surfaceSecondary }]}>
                  <Ionicons name="information-circle-outline" size={13} color={colors.textMuted} style={{ marginRight: 5 }} />
                  <Text style={[styles.webNoticeText, { color: colors.textMuted }]} numberOfLines={1}>
                    Hinweis: Einige Verlage blockieren die Einbettung (X-Frame-Options). Nutze in diesem Fall »Original öffnen«.
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Footer Action Row */}
          <View style={[styles.footerBar, { borderTopColor: colors.borderSubtle, backgroundColor: colors.surfaceSecondary }]}>
            <TouchableOpacity
              onPress={handleCopyLink}
              style={[styles.copyBtn, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={14} color={copied ? '#10B981' : colors.textSecondary} style={{ marginRight: 5 }} />
              <Text style={[styles.copyBtnText, { color: copied ? '#10B981' : colors.textSecondary }]}>
                {copied ? 'Kopiert!' : 'Link kopieren'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleOpenBrowser}
              style={[styles.primaryOpenBtn, { backgroundColor: colors.accent }]}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryOpenBtnText}>Original im Browser öffnen</Text>
              <Ionicons name="open-outline" size={14} color="#FFFFFF" style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          </View>

        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md
  },
  modalCard: {
    width: '100%',
    maxWidth: 720,
    height: '82%',
    maxHeight: 700,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 20px 45px rgba(0,0,0,0.45)'
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.sm
  },
  domainBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full
  },
  domainBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2
  },
  dotSep: {
    marginHorizontal: 8,
    fontSize: 12
  },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  verifiedText: {
    fontSize: 12,
    fontWeight: '500'
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center'
  },
  titleContainer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm
  },
  articleTitle: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
    marginBottom: 6
  },
  urlRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  urlText: {
    fontSize: 12,
    flex: 1
  },
  tabRow: {
    flexDirection: 'row',
    padding: 4,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radius.md
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: radius.sm - 2
  },
  tabBtnActive: {
    borderWidth: 1,
    boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '600'
  },
  bodyContainer: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm
  },
  summaryScroll: {
    flex: 1,
    paddingTop: 4
  },
  metaBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full
  },
  metaBadgeText: {
    fontSize: 11,
    fontWeight: '600'
  },
  cardExcerptBox: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderLeftWidth: 3,
    marginBottom: spacing.md
  },
  cardExcerptLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6
  },
  cardExcerptText: {
    fontSize: 14,
    lineHeight: 22
  },
  whyProvenanceBox: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)'
  },
  whyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6
  },
  whyTitle: {
    fontSize: 13,
    fontWeight: '700'
  },
  whyExplanation: {
    fontSize: 12,
    lineHeight: 19
  },
  webContainer: {
    flex: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
    position: 'relative'
  },
  iframeFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl
  },
  fallbackTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 6
  },
  fallbackText: {
    fontSize: 13,
    textAlign: 'center',
    maxWidth: 320
  },
  webNoticeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 4,
    borderRadius: radius.sm
  },
  webNoticeText: {
    fontSize: 11,
    flex: 1
  },
  footerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1
  },
  copyBtnText: {
    fontSize: 12,
    fontWeight: '600'
  },
  primaryOpenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: radius.md,
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
  },
  primaryOpenBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700'
  }
});
