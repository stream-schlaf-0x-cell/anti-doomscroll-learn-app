import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../core/context/AppContext';
import { typography, radius, spacing } from '../theme';
import { TopicTag, TOPIC_SPACE_MAP, TOPIC_METADATA } from '../../core/domain/types';
import { SubchannelFeedPriority, normalizeSpaceHandle } from '../../core/spaces/spaceRepository';
import {
  SUBCHANNEL_VIBES,
  SubchannelVibe,
  generateSubchannelDraft
} from '../../core/studio/subchannelAssistant';

export type MasterTab = 'channels' | 'feed_control';

interface UltraMasterModalProps {
  visible: boolean;
  onClose: () => void;
  initialTab?: MasterTab | string;
}

export const UltraMasterModal: React.FC<UltraMasterModalProps> = ({ visible, onClose, initialTab }) => {
  const {
    colors,
    profile,
    refreshFeed,
    spaces,
    createSpace,
    deleteSpace,
    togglePinSpace,
    setSpaceFeedPriority,
    removeFeedbackBoost,
    removeFeedbackPenalty,
    updateTopicWeight,
    updateFeedMixRatio,
    clearFeedbackMemory
  } = useApp();

  const [activeTab, setActiveTab] = useState<MasterTab>('channels');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (visible && initialTab) {
      if (initialTab === 'feed_control' || initialTab === 'learning') {
        setActiveTab('feed_control');
      } else {
        setActiveTab('channels');
      }
    }
  }, [visible, initialTab]);

  // One-Input Subchannel Assistant State
  const [newChannelTitle, setNewChannelTitle] = useState<string>('');
  const [newChannelHandle, setNewChannelHandle] = useState<string>('');
  const [hasCustomHandle, setHasCustomHandle] = useState<boolean>(false);
  const [newChannelVibe, setNewChannelVibe] = useState<SubchannelVibe>('contemplation');
  const [newChannelDesc, setNewChannelDesc] = useState<string>('');
  const [newChannelFlair, setNewChannelFlair] = useState<string>('');
  const [newChannelTopic, setNewChannelTopic] = useState<TopicTag>('contemplation_mind');
  const [newChannelSources, setNewChannelSources] = useState<string>('');
  const [newChannelPrompt, setNewChannelPrompt] = useState<string>('');
  const [newChannelPriority, setNewChannelPriority] = useState<SubchannelFeedPriority>('normal');
  const [isGeneratingAiDraft, setIsGeneratingAiDraft] = useState<boolean>(false);
  const [isCreatingChannel, setIsCreatingChannel] = useState<boolean>(false);
  const [hasGeneratedDraft, setHasGeneratedDraft] = useState<boolean>(false);
  const [isAiGeneratedBadge, setIsAiGeneratedBadge] = useState<boolean>(false);

  // Learning Engine Telemetry State
  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Handle title change: auto-derive handle unless user typed a custom one
  const handleTitleChange = (text: string) => {
    setNewChannelTitle(text);
    if (!hasCustomHandle) {
      setNewChannelHandle(normalizeSpaceHandle(text));
    }
  };

  // AI-Assisted Subchannel Draft Generation
  const handleGenerateAiDraft = async () => {
    if (!newChannelTitle.trim()) {
      showToast('Bitte zuerst einen Titel für den Subchannel eingeben');
      return;
    }
    setIsGeneratingAiDraft(true);
    try {
      const draft = await generateSubchannelDraft(newChannelTitle, newChannelVibe);
      setNewChannelHandle(draft.handle);
      setNewChannelFlair(draft.flair);
      setNewChannelDesc(draft.description);
      setNewChannelTopic(draft.primaryTopic);
      setNewChannelSources(draft.seedSources.join(', '));
      if (draft.suggestedAntithesis) {
        setNewChannelPrompt(draft.suggestedAntithesis);
      }
      setHasGeneratedDraft(true);
      setIsAiGeneratedBadge(draft.isAiGenerated);
      showToast(
        draft.isAiGenerated
          ? '✓ KI-Vorschlag & kuratierte Quellen geladen!'
          : '✓ Vorschlag & kuratierte Quellen geladen!'
      );
    } catch {
      showToast('Fehler bei der KI-Vorschlagsgenerierung');
    } finally {
      setIsGeneratingAiDraft(false);
    }
  };

  // Channel Creation
  const handleCreateChannel = async () => {
    if (!newChannelTitle.trim()) {
      showToast('Bitte einen Namen für den Subchannel eingeben');
      return;
    }
    setIsCreatingChannel(true);
    try {
      const seedSources = newChannelSources
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      const created = await createSpace({
        title: newChannelTitle.trim(),
        handle: newChannelHandle.trim() || undefined,
        description: newChannelDesc.trim() || undefined,
        flair: newChannelFlair.trim() || undefined,
        primaryTopic: newChannelTopic,
        rssFeeds: seedSources,
        antithesisPrompt: newChannelPrompt.trim() || undefined,
        feedPriority: newChannelPriority
      });

      // Reset form
      setNewChannelTitle('');
      setNewChannelHandle('');
      setHasCustomHandle(false);
      setNewChannelDesc('');
      setNewChannelFlair('');
      setNewChannelSources('');
      setNewChannelPrompt('');
      setHasGeneratedDraft(false);

      showToast(`✓ Subchannel „${created.handle}“ erfolgreich erstellt und aktiviert!`);
      await refreshFeed();
    } catch (err: any) {
      showToast(err?.message || 'Fehler beim Erstellen des Subchannels');
    } finally {
      setIsCreatingChannel(false);
    }
  };

  const handleDeleteChannel = async (id: string, handle: string) => {
    const ok = await deleteSpace(id);
    if (ok) {
      showToast(`Subchannel ${handle} entfernt`);
      await refreshFeed();
    }
  };

  const handlePriorityChange = async (id: string, priority: SubchannelFeedPriority) => {
    await setSpaceFeedPriority(id, priority);
    showToast(`Priorität aktualisiert`);
    await refreshFeed();
  };

  // Feed Mix calculation
  const currentMix = profile?.feedMixRatio || { focusRatio: 0.60, socraticRatio: 0.20, serendipityRatio: 0.20 };
  const focusPct = Math.round(currentMix.focusRatio * 100);
  const socraticPct = Math.round(currentMix.socraticRatio * 100);
  const serendipityPct = Math.round(currentMix.serendipityRatio * 100);

  // Feedback Memory signals
  const feedbackMem = profile?.feedbackMemory || {};
  const boostedDomains = useMemo(() => Object.entries(feedbackMem.boostedDomains || {}), [feedbackMem.boostedDomains]);
  const penalizedDomains = useMemo(() => Object.entries(feedbackMem.penalizedDomains || {}), [feedbackMem.penalizedDomains]);
  const boostedKeywords = useMemo(() => Object.entries(feedbackMem.boostedKeywords || {}), [feedbackMem.boostedKeywords]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable
          accessibilityLabel="Hintergrund schließen"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <View
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
          onStartShouldSetResponder={() => true}
          // @ts-ignore - web click propagation guard
          onClick={(e: any) => {
            if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
          }}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.borderSubtle }]}>
            <View style={styles.headerLeft}>
              <View style={[styles.iconEmblem, { backgroundColor: '#F59E0B' + '22' }]}>
                <Ionicons name="sparkles" size={18} color="#F59E0B" />
              </View>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
                    ✨ AI Studio & Subchannels
                  </Text>
                  <View style={styles.ultraPill}>
                    <Text style={styles.ultraPillText}>SOUVERÄN</Text>
                  </View>
                </View>
                <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
                  Eigene Räume mit 1 Klick anlegen & deinen kognitiven Feed steuern
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: colors.surfaceSecondary }]}
              accessibilityRole="button"
              accessibilityLabel="Studio schließen"
            >
              <Ionicons name="close" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Toast */}
          {toastMessage && (
            <View style={[styles.toast, { backgroundColor: colors.accent }]}>
              <Text style={styles.toastText}>{toastMessage}</Text>
            </View>
          )}

          {/* Clean 2-Tab Navigation Bar */}
          <View style={[styles.tabBar, { borderBottomColor: colors.borderSubtle, backgroundColor: colors.surfaceSecondary }]}>
            <TouchableOpacity
              onPress={() => setActiveTab('channels')}
              style={[
                styles.tabItem,
                activeTab === 'channels' && { borderBottomColor: '#F59E0B', backgroundColor: colors.surface }
              ]}
              accessibilityRole="tab"
              accessibilityLabel="Subchannels verwalten"
            >
              <Ionicons
                name="compass-outline"
                size={15}
                color={activeTab === 'channels' ? '#F59E0B' : colors.textMuted}
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  styles.tabItemText,
                  { color: activeTab === 'channels' ? '#F59E0B' : colors.textSecondary, fontWeight: '700' }
                ]}
              >
                🧭 Subchannels verwalten ({spaces.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActiveTab('feed_control')}
              style={[
                styles.tabItem,
                activeTab === 'feed_control' && { borderBottomColor: '#3B82F6', backgroundColor: colors.surface }
              ]}
              accessibilityRole="tab"
              accessibilityLabel="Feed-Steuerung und Geschmack"
            >
              <Ionicons
                name="options-outline"
                size={15}
                color={activeTab === 'feed_control' ? '#3B82F6' : colors.textMuted}
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  styles.tabItemText,
                  { color: activeTab === 'feed_control' ? '#3B82F6' : colors.textSecondary, fontWeight: '700' }
                ]}
              >
                🎚️ Feed-Steuerung & Geschmack
              </Text>
            </TouchableOpacity>
          </View>

          {/* Content Area */}
          <View style={styles.contentContainer}>
            {/* TAB 1: Subchannels verwalten */}
            {activeTab === 'channels' && (
              <ScrollView style={styles.tabScroll} contentContainerStyle={styles.tabScrollContent}>
                {/* One-Input AI Assisted Subchannel Creator Box */}
                <View style={[styles.sectionBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                    <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                      ✨ Neuen Subchannel anlegen (1-Klick KI-Assistent)
                    </Text>
                    {hasGeneratedDraft && (
                      <View style={[styles.flairBadge, { backgroundColor: isAiGeneratedBadge ? '#10B98120' : colors.surface }]}>
                        <Text style={{ fontSize: 10, fontWeight: '800', color: isAiGeneratedBadge ? '#10B981' : colors.textMuted }}>
                          {isAiGeneratedBadge ? '🟢 KI-Vorschlag aktiv' : '⚪ Vorschlag aktiv'}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.sectionDesc, { color: colors.textMuted }]}>
                    Gib einfach den Titel deines Wunsch-Raumes ein. Die KI ergänzt auf Knopfdruck Beschreibung, Flair, Quellen und Themengebiet.
                  </Text>

                  <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
                    {/* Row 1: Title and Handle */}
                    <View style={{ flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' }}>
                      <View style={{ flex: 1, minWidth: 220 }}>
                        <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                          Titel des Raumes (Erforderlich):
                        </Text>
                        <TextInput
                          value={newChannelTitle}
                          onChangeText={handleTitleChange}
                          placeholder="Thema oder Raum eingeben, z.B. Geopolitik, Literatur, Kybernetik …"
                          placeholderTextColor={colors.textMuted}
                          style={[styles.textInput, { backgroundColor: colors.surface, borderColor: colors.borderSubtle, color: colors.textPrimary }]}
                        />
                      </View>

                      <View style={{ flex: 1, minWidth: 200 }}>
                        <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                          Handle (z.B. c/geopolitik):
                        </Text>
                        <TextInput
                          value={newChannelHandle}
                          onChangeText={text => {
                            setNewChannelHandle(text);
                            setHasCustomHandle(true);
                          }}
                          placeholder="c/..."
                          placeholderTextColor={colors.textMuted}
                          style={[styles.textInput, { backgroundColor: colors.surface, borderColor: colors.borderSubtle, color: colors.textPrimary }]}
                        />
                      </View>
                    </View>

                    {/* Vibe Selector */}
                    <View style={{ marginTop: 2 }}>
                      <Text style={[styles.inputLabel, { color: colors.textSecondary, marginBottom: 6 }]}>
                        Tonalität & Vibe wählen:
                      </Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                        {(Object.keys(SUBCHANNEL_VIBES) as SubchannelVibe[]).map(vibeKey => {
                          const vMeta = SUBCHANNEL_VIBES[vibeKey];
                          const isSelected = newChannelVibe === vibeKey;
                          return (
                            <TouchableOpacity
                              key={vibeKey}
                              onPress={() => setNewChannelVibe(vibeKey)}
                              style={[
                                styles.vibeChip,
                                {
                                  backgroundColor: isSelected ? colors.accent : colors.surface,
                                  borderColor: isSelected ? colors.accent : colors.borderSubtle
                                }
                              ]}
                            >
                              <Text style={[styles.vibeChipText, { color: isSelected ? '#FFFFFF' : colors.textPrimary }]}>
                                {vMeta.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>

                    {/* AI Autofill Button */}
                    <TouchableOpacity
                      onPress={handleGenerateAiDraft}
                      disabled={isGeneratingAiDraft || !newChannelTitle.trim()}
                      style={[
                        styles.aiAssistantBtn,
                        {
                          backgroundColor: newChannelTitle.trim() ? '#8B5CF6' : colors.surface,
                          borderColor: '#8B5CF6',
                          opacity: newChannelTitle.trim() ? 1 : 0.6
                        }
                      ]}
                    >
                      {isGeneratingAiDraft ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <Ionicons name="sparkles" size={15} color={newChannelTitle.trim() ? '#FFFFFF' : colors.textMuted} style={{ marginRight: 6 }} />
                          <Text style={[styles.aiAssistantBtnText, { color: newChannelTitle.trim() ? '#FFFFFF' : colors.textMuted }]}>
                            ✨ Von KI ausfüllen & kuratierte Quellen finden
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>

                    {/* Editable Details (Freely adjustable before activation) */}
                    <View style={{ marginTop: spacing.xs, gap: spacing.xs }}>
                      <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                        Beschreibung & Fokus:
                      </Text>
                      <TextInput
                        value={newChannelDesc}
                        onChangeText={setNewChannelDesc}
                        placeholder="Kurze kognitive Ausrichtung des Channels..."
                        placeholderTextColor={colors.textMuted}
                        style={[styles.textInput, { backgroundColor: colors.surface, borderColor: colors.borderSubtle, color: colors.textPrimary }]}
                      />

                      <View style={{ flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' }}>
                        <View style={{ flex: 1, minWidth: 160 }}>
                          <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                            Badge Flair:
                          </Text>
                          <TextInput
                            value={newChannelFlair}
                            onChangeText={setNewChannelFlair}
                            placeholder="z.B. 🌱 Achtsamkeit"
                            placeholderTextColor={colors.textMuted}
                            style={[styles.textInput, { backgroundColor: colors.surface, borderColor: colors.borderSubtle, color: colors.textPrimary }]}
                          />
                        </View>

                        <View style={{ flex: 2, minWidth: 220 }}>
                          <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                            Kuratierte Seed-Quellen (Domains):
                          </Text>
                          <TextInput
                            value={newChannelSources}
                            onChangeText={setNewChannelSources}
                            placeholder="z.B. plumvillage.org, tricycle.org"
                            placeholderTextColor={colors.textMuted}
                            style={[styles.textInput, { backgroundColor: colors.surface, borderColor: colors.borderSubtle, color: colors.textPrimary }]}
                          />
                        </View>
                      </View>

                      {/* Primary Topic Chips */}
                      <View style={{ marginTop: 2 }}>
                        <Text style={[styles.inputLabel, { color: colors.textSecondary, marginBottom: 4 }]}>
                          Primäres Wissensgebiet:
                        </Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                          {(['contemplation_mind', 'philosophy_ethics', 'german_didactics', 'ai_apple', 'science_society', 'art_aesthetics', 'sound_synthesis'] as TopicTag[]).map(t => (
                            <TouchableOpacity
                              key={t}
                              onPress={() => setNewChannelTopic(t)}
                              style={[
                                styles.topicSelectChip,
                                {
                                  backgroundColor: newChannelTopic === t ? colors.accent : colors.surface,
                                  borderColor: colors.borderSubtle
                                }
                              ]}
                            >
                              <Text style={[styles.topicSelectText, { color: newChannelTopic === t ? '#FFFFFF' : colors.textSecondary }]}>
                                {TOPIC_SPACE_MAP[t]?.flair || t}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>

                      {/* Optional Antithesis Prompt */}
                      <View style={{ marginTop: 2 }}>
                        <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                          Optionale Leitfrage / Antithese (Optional):
                        </Text>
                        <TextInput
                          value={newChannelPrompt}
                          onChangeText={setNewChannelPrompt}
                          placeholder="Welche kritische Grundannahme hinterfragt dieser Raum?"
                          placeholderTextColor={colors.textMuted}
                          style={[styles.textInput, { backgroundColor: colors.surface, borderColor: colors.borderSubtle, color: colors.textPrimary }]}
                        />
                      </View>

                      {/* Feed Priority for new channel */}
                      <View style={{ marginTop: 2 }}>
                        <Text style={[styles.inputLabel, { color: colors.textSecondary, marginBottom: 4 }]}>
                          Standard-Präsenz im Stream:
                        </Text>
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                          {[
                            { id: 'high' as SubchannelFeedPriority, label: '🔥 Oft im Feed' },
                            { id: 'normal' as SubchannelFeedPriority, label: 'Normal' },
                            { id: 'channel_only' as SubchannelFeedPriority, label: 'Nur im Channel-Tab' }
                          ].map(p => (
                            <TouchableOpacity
                              key={p.id}
                              onPress={() => setNewChannelPriority(p.id)}
                              style={[
                                styles.priorityPill,
                                {
                                  backgroundColor: newChannelPriority === p.id ? colors.accent : colors.surface,
                                  borderColor: newChannelPriority === p.id ? colors.accent : colors.borderSubtle
                                }
                              ]}
                            >
                              <Text style={[styles.priorityPillText, { color: newChannelPriority === p.id ? '#FFFFFF' : colors.textSecondary }]}>
                                {p.label}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    </View>

                    {/* Activation Button */}
                    <TouchableOpacity
                      onPress={handleCreateChannel}
                      disabled={isCreatingChannel || !newChannelTitle.trim()}
                      style={[
                        styles.primaryActionBtn,
                        {
                          backgroundColor: '#F59E0B',
                          marginTop: spacing.sm,
                          opacity: newChannelTitle.trim() ? 1 : 0.6
                        }
                      ]}
                    >
                      {isCreatingChannel ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <Ionicons name="add-circle" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                          <Text style={styles.primaryActionBtnText}>Subchannel jetzt aktivieren</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Subchannels List & Priority Adjuster */}
                <View style={{ marginTop: spacing.lg }}>
                  <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginBottom: 4 }]}>
                    Verfügbare Subchannels ({spaces.length})
                  </Text>
                  <Text style={[styles.sectionDesc, { color: colors.textMuted, marginBottom: spacing.md }]}>
                    Steuere die Priorität jedes Channels: „🔥 Oft im Feed“, „Normal“ oder „Nur im Channel-Tab“ (aus dem Hauptfeed ausgeschlossen).
                  </Text>

                  {spaces.map(s => {
                    const currentPriority: SubchannelFeedPriority = s.feedPriority || (s.pinned ? 'high' : 'normal');
                    return (
                      <View
                        key={s.id}
                        style={[styles.channelCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, flex: 1 }}>
                          <View style={[styles.channelIconBox, { backgroundColor: (s.accentColor || '#5282B8') + '20' }]}>
                            <Ionicons name={(s.icon as any) || 'layers-outline'} size={18} color={s.accentColor || '#5282B8'} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <Text style={[styles.channelHandle, { color: s.accentColor || '#5282B8' }]}>{s.handle}</Text>
                              <View style={[styles.flairBadge, { backgroundColor: (s.accentColor || '#5282B8') + '18' }]}>
                                <Text style={[styles.flairBadgeText, { color: s.accentColor || '#5282B8' }]}>{s.flair}</Text>
                              </View>
                              {s.isCustom && (
                                <View style={[styles.customBadge, { backgroundColor: '#F59E0B20' }]}>
                                  <Text style={styles.customBadgeText}>CUSTOM</Text>
                                </View>
                              )}
                            </View>
                            <Text style={[styles.channelTitle, { color: colors.textPrimary }]}>{s.title}</Text>
                            <Text style={[styles.channelDesc, { color: colors.textMuted }]}>{s.description}</Text>

                            {/* 3-State Feed Priority Selector */}
                            <View style={{ flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                              {[
                                { id: 'high' as SubchannelFeedPriority, label: '🔥 Oft im Feed' },
                                { id: 'normal' as SubchannelFeedPriority, label: 'Normal' },
                                { id: 'channel_only' as SubchannelFeedPriority, label: 'Nur im Channel-Tab' }
                              ].map(p => {
                                const isCurrent = currentPriority === p.id;
                                return (
                                  <TouchableOpacity
                                    key={p.id}
                                    onPress={() => handlePriorityChange(s.id, p.id)}
                                    style={[
                                      styles.priorityChip,
                                      {
                                        backgroundColor: isCurrent ? colors.accent : colors.surface,
                                        borderColor: isCurrent ? colors.accent : colors.borderSubtle
                                      }
                                    ]}
                                  >
                                    <Text style={[styles.priorityChipText, { color: isCurrent ? '#FFFFFF' : colors.textSecondary }]}>
                                      {p.label}
                                    </Text>
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                          </View>
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 8 }}>
                          <TouchableOpacity
                            onPress={() => void togglePinSpace(s.id)}
                            style={[styles.iconActionBtn, { backgroundColor: colors.surface }]}
                            accessibilityLabel={s.pinned ? 'Channel lösen' : 'Channel anpinnen'}
                          >
                            <Ionicons name={s.pinned ? 'pin' : 'pin-outline'} size={15} color={s.pinned ? '#F59E0B' : colors.textMuted} />
                          </TouchableOpacity>

                          {s.isCustom && (
                            <TouchableOpacity
                              onPress={() => void handleDeleteChannel(s.id, s.handle)}
                              style={[styles.iconActionBtn, { backgroundColor: colors.surface }]}
                              accessibilityLabel="Custom Channel löschen"
                            >
                              <Ionicons name="trash-outline" size={15} color="#EF4444" />
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            )}

            {/* TAB 2: Feed-Steuerung & Geschmack */}
            {activeTab === 'feed_control' && (
              <ScrollView style={styles.tabScroll} contentContainerStyle={styles.tabScrollContent}>
                {/* Intro / Transparency Banner */}
                <View style={[styles.sectionBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
                  <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                    🧠 Kognitive Feed-Steuerung & Geschmack
                  </Text>
                  <Text style={[styles.sectionDesc, { color: colors.textMuted }]}>
                    Atem passt Empfehlungen transparent an deine Upvotes (▲), Downvotes (▼) und „🚫 Weniger davon“-Signale an. Hier kannst du alle gelernten Gewichte einsehen, feintunen oder gezielt zurücksetzen.
                  </Text>
                </View>

                {/* Feed-Mix Ratio (Sovereign Dial) */}
                <View style={[styles.sectionBox, { backgroundColor: colors.surface, borderColor: colors.borderSubtle, marginTop: spacing.md }]}>
                  <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginBottom: 4 }]}>
                    Souveränes Mischverhältnis des Streams
                  </Text>
                  <Text style={[styles.sectionDesc, { color: colors.textMuted, marginBottom: spacing.md }]}>
                    Bestimme die Balance zwischen deinen gelernten Schwerpunkten, kritischer Reibung und überraschenden Entdeckungen.
                  </Text>

                  <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
                    <View style={[styles.mixMetricCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
                      <Text style={[styles.mixMetricValue, { color: '#10B981' }]}>{focusPct}%</Text>
                      <Text style={[styles.mixMetricLabel, { color: colors.textSecondary }]}>🎯 Fokus</Text>
                      <Text style={[styles.mixMetricSub, { color: colors.textMuted }]}>Kerninteressen</Text>
                    </View>
                    <View style={[styles.mixMetricCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
                      <Text style={[styles.mixMetricValue, { color: '#F59E0B' }]}>{socraticPct}%</Text>
                      <Text style={[styles.mixMetricLabel, { color: colors.textSecondary }]}>⚖️ Sokratisch</Text>
                      <Text style={[styles.mixMetricSub, { color: colors.textMuted }]}>Kritische Reibung</Text>
                    </View>
                    <View style={[styles.mixMetricCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
                      <Text style={[styles.mixMetricValue, { color: '#3B82F6' }]}>{serendipityPct}%</Text>
                      <Text style={[styles.mixMetricLabel, { color: colors.textSecondary }]}>🌌 Serendipity</Text>
                      <Text style={[styles.mixMetricSub, { color: colors.textMuted }]}>Offene Funde</Text>
                    </View>
                  </View>

                  <Text style={[styles.inputLabel, { color: colors.textSecondary, marginBottom: 6 }]}>
                    Mischverhältnis auf Knopfdruck anpassen:
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {[
                      { label: 'Ausgewogen (60 / 20 / 20)', focus: 0.60, socratic: 0.20, serendipity: 0.20 },
                      { label: 'Tiefgang & Fokus (80 / 10 / 10)', focus: 0.80, socratic: 0.10, serendipity: 0.10 },
                      { label: 'Offener Horizont (40 / 30 / 30)', focus: 0.40, socratic: 0.30, serendipity: 0.30 }
                    ].map(preset => (
                      <TouchableOpacity
                        key={preset.label}
                        onPress={async () => {
                          await updateFeedMixRatio(preset.focus, preset.socratic, preset.serendipity);
                          showToast(`✓ Mischverhältnis gesetzt: ${preset.label}`);
                        }}
                        style={[styles.smallPill, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle, borderWidth: 1 }]}
                      >
                        <Text style={[styles.smallPillText, { color: colors.textPrimary }]}>
                          {preset.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Learned Topic Affinities */}
                <View style={[styles.sectionBox, { backgroundColor: colors.surface, borderColor: colors.borderSubtle, marginTop: spacing.md }]}>
                  <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginBottom: 8 }]}>
                    Aktuell gelernte Themen-Affinitäten (Interessen-Gewichte):
                  </Text>
                  {Object.entries(profile.explicitInterests || {}).map(([topic, weight]) => {
                    const pct = Math.round((weight as number) * 100);
                    const meta = TOPIC_SPACE_MAP[topic as TopicTag];
                    return (
                      <View key={topic} style={{ marginBottom: 12 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <Text style={[styles.topicBarLabel, { color: colors.textPrimary }]}>
                            {meta?.flair || TOPIC_METADATA[topic as TopicTag]?.label || topic}
                          </Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Text style={[styles.topicBarValue, { color: colors.accent }]}>{pct}%</Text>
                            <TouchableOpacity
                              onPress={() => updateTopicWeight(topic as TopicTag, Math.max(0.05, (weight as number) - 0.1))}
                              style={[styles.adjustWeightBtn, { backgroundColor: colors.surfaceSecondary }]}
                              accessibilityLabel={`Gewicht für ${topic} verringern`}
                            >
                              <Text style={{ fontSize: 13, color: colors.textPrimary, fontWeight: '800' }}>-</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => updateTopicWeight(topic as TopicTag, Math.min(1.0, (weight as number) + 0.1))}
                              style={[styles.adjustWeightBtn, { backgroundColor: colors.surfaceSecondary }]}
                              accessibilityLabel={`Gewicht für ${topic} erhöhen`}
                            >
                              <Text style={{ fontSize: 13, color: colors.textPrimary, fontWeight: '800' }}>+</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                        <View style={[styles.barTrack, { backgroundColor: colors.surfaceSecondary }]}>
                          <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: colors.accent }]} />
                        </View>
                      </View>
                    );
                  })}
                </View>

                {/* Favored Sources & Domains */}
                <View style={[styles.sectionBox, { backgroundColor: colors.surface, borderColor: colors.borderSubtle, marginTop: spacing.md }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <Ionicons name="arrow-up-circle" size={16} color="#10B981" />
                    <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                      ▲ Bevorzugte Quellen & Domains ({boostedDomains.length})
                    </Text>
                  </View>
                  <Text style={[styles.sectionDesc, { color: colors.textMuted, marginBottom: 8 }]}>
                    Quellen, die du durch Upvotes gestärkt hast. Klicke auf ✕, um die Bevorzugung zu entfernen.
                  </Text>
                  {boostedDomains.length === 0 ? (
                    <Text style={{ fontSize: 12, color: colors.textMuted, fontStyle: 'italic' }}>
                      Noch keine Quellen aktiv verstärkt.
                    </Text>
                  ) : (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {boostedDomains.map(([dom, count]) => (
                        <View key={dom} style={[styles.signalPill, { backgroundColor: 'rgba(16, 185, 129, 0.12)', borderColor: 'rgba(16, 185, 129, 0.3)' }]}>
                          <Text style={[styles.signalPillText, { color: '#059669' }]}>
                            {dom} ({count >= 0 ? `+${count}` : count})
                          </Text>
                          <TouchableOpacity
                            onPress={() => void removeFeedbackBoost('domain', dom)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            style={{ marginLeft: 6 }}
                          >
                            <Ionicons name="close" size={13} color="#059669" />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                </View>

                {/* Top Upvoted Concepts & Keywords */}
                <View style={[styles.sectionBox, { backgroundColor: colors.surface, borderColor: colors.borderSubtle, marginTop: spacing.md }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <Ionicons name="pricetag-outline" size={16} color="#3B82F6" />
                    <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                      ▲ Verstärkte Schlagworte & Themen ({boostedKeywords.length})
                    </Text>
                  </View>
                  {boostedKeywords.length === 0 ? (
                    <Text style={{ fontSize: 12, color: colors.textMuted, fontStyle: 'italic' }}>
                      Noch keine Schlagworte durch Upvotes hervorgehoben.
                    </Text>
                  ) : (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {boostedKeywords.map(([kw, count]) => (
                        <View key={kw} style={[styles.signalPill, { backgroundColor: 'rgba(59, 130, 246, 0.12)', borderColor: 'rgba(59, 130, 246, 0.3)' }]}>
                          <Text style={[styles.signalPillText, { color: '#2563EB' }]}>
                            #{kw} (+{count})
                          </Text>
                          <TouchableOpacity
                            onPress={() => void removeFeedbackBoost('keyword', kw)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            style={{ marginLeft: 6 }}
                          >
                            <Ionicons name="close" size={13} color="#2563EB" />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                </View>

                {/* Blocked / Downvoted Domains & "Weniger davon" */}
                <View style={[styles.sectionBox, { backgroundColor: colors.surface, borderColor: colors.borderSubtle, marginTop: spacing.md }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <Ionicons name="ban-outline" size={16} color="#EF4444" />
                    <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                      ▼ Abgestrafte Quellen & „🚫 Weniger davon“ ({penalizedDomains.length})
                    </Text>
                  </View>
                  <Text style={[styles.sectionDesc, { color: colors.textMuted, marginBottom: 8 }]}>
                    Quellen oder Themen, die du mit „🚫 Weniger davon“ oder Downvotes belegt hast.
                  </Text>
                  {penalizedDomains.length === 0 ? (
                    <Text style={{ fontSize: 12, color: colors.textMuted, fontStyle: 'italic' }}>
                      Keine Quellen blockiert.
                    </Text>
                  ) : (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {penalizedDomains.map(([dom, count]) => (
                        <View key={dom} style={[styles.signalPill, { backgroundColor: 'rgba(239, 68, 68, 0.12)', borderColor: 'rgba(239, 68, 68, 0.3)' }]}>
                          <Text style={[styles.signalPillText, { color: '#DC2626' }]}>
                            {dom} ({count})
                          </Text>
                          <TouchableOpacity
                            onPress={() => void removeFeedbackPenalty('domain', dom)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            style={{ marginLeft: 6 }}
                          >
                            <Ionicons name="close" size={13} color="#DC2626" />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                </View>

                {/* Sovereign Reset Action */}
                <View style={[styles.sectionBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle, marginTop: spacing.md }]}>
                  <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                    Lern-Historie zurücksetzen
                  </Text>
                  <Text style={[styles.sectionDesc, { color: colors.textMuted, marginBottom: spacing.md }]}>
                    Löscht alle erfassten Signal-Verstärkungen, Downvote-Strafen und setzt die Themen-Gewichtung auf die Standard-Werte zurück.
                  </Text>

                  {showClearConfirm ? (
                    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                      <TouchableOpacity
                        onPress={async () => {
                          await clearFeedbackMemory();
                          setShowClearConfirm(false);
                          showToast('✓ Feedback-Gedächtnis vollständig zurückgesetzt');
                          await refreshFeed();
                        }}
                        style={[styles.primaryActionBtn, { backgroundColor: '#EF4444' }]}
                      >
                        <Text style={styles.primaryActionBtnText}>Ja, jetzt unwiderruflich zurücksetzen</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setShowClearConfirm(false)}
                        style={[styles.secondaryActionBtn, { borderColor: colors.borderSubtle }]}
                      >
                        <Text style={[styles.secondaryActionBtnText, { color: colors.textPrimary }]}>Abbrechen</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      onPress={() => setShowClearConfirm(true)}
                      style={[styles.secondaryActionBtn, { borderColor: colors.borderSubtle }]}
                    >
                      <Ionicons name="refresh-outline" size={15} color={colors.textPrimary} style={{ marginRight: 6 }} />
                      <Text style={[styles.secondaryActionBtnText, { color: colors.textPrimary }]}>
                        🔄 Feedback-Gedächtnis & Geschmack zurücksetzen
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md
  },
  card: {
    width: '100%',
    maxWidth: 820,
    maxHeight: '92%',
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1
  },
  iconEmblem: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center'
  },
  headerTitle: {
    fontSize: typography.sizes.body,
    fontWeight: '800'
  },
  ultraPill: {
    backgroundColor: '#F59E0B22',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.sm
  },
  ultraPillText: {
    color: '#F59E0B',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  headerSubtitle: {
    fontSize: typography.sizes.micro,
    marginTop: 2
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    justifyContent: 'center',
    alignItems: 'center'
  },
  toast: {
    position: 'absolute',
    top: 65,
    left: 20,
    right: 20,
    zIndex: 999,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: typography.sizes.caption,
    fontWeight: '700'
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent'
  },
  tabItemText: {
    fontSize: typography.sizes.caption
  },
  contentContainer: {
    flex: 1
  },
  tabScroll: {
    flex: 1
  },
  tabScrollContent: {
    padding: spacing.lg
  },
  sectionBox: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 0.5
  },
  sectionTitle: {
    fontSize: typography.sizes.bodySmall,
    fontWeight: '800'
  },
  sectionDesc: {
    fontSize: typography.sizes.caption,
    marginTop: 3,
    lineHeight: 18
  },
  inputLabel: {
    fontSize: typography.sizes.micro,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3
  },
  textInput: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    fontSize: typography.sizes.bodySmall,
    marginTop: 4
  },
  vibeChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1
  },
  vibeChipText: {
    fontSize: 11,
    fontWeight: '600'
  },
  aiAssistantBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    marginTop: 4
  },
  aiAssistantBtnText: {
    fontSize: 12,
    fontWeight: '700'
  },
  topicSelectChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 0.5
  },
  topicSelectText: {
    fontSize: 10,
    fontWeight: '700'
  },
  priorityPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1
  },
  priorityPillText: {
    fontSize: 11,
    fontWeight: '600'
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill
  },
  primaryActionBtnText: {
    color: '#FFFFFF',
    fontSize: typography.sizes.caption,
    fontWeight: '700'
  },
  secondaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 0.5
  },
  secondaryActionBtnText: {
    fontSize: typography.sizes.micro,
    fontWeight: '700'
  },
  channelCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 0.5,
    marginBottom: spacing.sm
  },
  channelIconBox: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center'
  },
  channelHandle: {
    fontSize: typography.sizes.caption,
    fontWeight: '800'
  },
  channelTitle: {
    fontSize: typography.sizes.bodySmall,
    fontWeight: '700',
    marginTop: 1
  },
  channelDesc: {
    fontSize: typography.sizes.micro,
    lineHeight: 16,
    marginTop: 2
  },
  flairBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.sm
  },
  flairBadgeText: {
    fontSize: 9,
    fontWeight: '800'
  },
  customBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: radius.sm
  },
  customBadgeText: {
    color: '#F59E0B',
    fontSize: 8,
    fontWeight: '900'
  },
  priorityChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1
  },
  priorityChipText: {
    fontSize: 10,
    fontWeight: '700'
  },
  iconActionBtn: {
    width: 30,
    height: 30,
    borderRadius: radius.full,
    justifyContent: 'center',
    alignItems: 'center'
  },
  topicBarLabel: {
    fontSize: typography.sizes.caption,
    fontWeight: '600'
  },
  topicBarValue: {
    fontSize: typography.sizes.caption,
    fontWeight: '800'
  },
  adjustWeightBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center'
  },
  barTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden'
  },
  barFill: {
    height: '100%',
    borderRadius: 3
  },
  mixMetricCard: {
    flex: 1,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 0.5,
    alignItems: 'center'
  },
  mixMetricValue: {
    fontSize: typography.sizes.title1,
    fontWeight: '900',
    marginBottom: 2
  },
  mixMetricLabel: {
    fontSize: typography.sizes.caption,
    fontWeight: '700'
  },
  mixMetricSub: {
    fontSize: typography.sizes.micro,
    marginTop: 1
  },
  smallPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill
  },
  smallPillText: {
    fontSize: 11,
    fontWeight: '600'
  },
  signalPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 0.5
  },
  signalPillText: {
    fontSize: 11,
    fontWeight: '700'
  }
});
