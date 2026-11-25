import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
import { getEffectiveTopicWeight } from '../../core/domain/ranking';
import {
  Subchannel,
  SubchannelFeedPriority,
  normalizeSpaceHandle
} from '../../core/spaces/spaceRepository';
import {
  SUBCHANNEL_VIBES,
  SubchannelVibe,
  STUDIO_QUICK_THEMES,
  generateSubchannelDraft,
  stripLeadingDecorativeEmoji
} from '../../core/studio/subchannelAssistant';
import {
  RecursiveLearningEngine,
  LearningEngineState
} from '../../core/recommendations/recursiveLearningEngine';
import { appStorage } from '../../core/data/storage';

export type MasterTab = 'channels' | 'feed_control' | 'new_space' | 'taste';
type InternalStudioTab = 'new_space' | 'channels' | 'taste';

interface UltraMasterModalProps {
  visible: boolean;
  onClose: () => void;
  initialTab?: MasterTab | string;
}

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const LEARNING_STATE_STORAGE_KEY = '@atem:recursive_learning_state';

const PRIORITY_OPTIONS: readonly { id: SubchannelFeedPriority; label: string }[] = [
  { id: 'high', label: 'Oft' },
  { id: 'normal', label: 'Normal' },
  { id: 'channel_only', label: 'Nur im Tab' }
];

const MIX_PRESETS: readonly {
  id: string;
  label: string;
  focus: number;
  socratic: number;
  serendipity: number;
}[] = [
  { id: 'balanced', label: 'Ausgewogen (60 / 20 / 20)', focus: 0.6, socratic: 0.2, serendipity: 0.2 },
  { id: 'deep_focus', label: 'Fokus (80 / 10 / 10)', focus: 0.8, socratic: 0.1, serendipity: 0.1 },
  { id: 'open_horizon', label: 'Entdeckung (40 / 30 / 30)', focus: 0.4, socratic: 0.3, serendipity: 0.3 }
];

const TOPIC_OPTIONS: readonly TopicTag[] = [
  'contemplation_mind',
  'philosophy_ethics',
  'german_didactics',
  'ai_apple',
  'science_society',
  'art_aesthetics',
  'sound_synthesis'
];

function resolveInitialTab(initialTab?: MasterTab | string): InternalStudioTab {
  if (initialTab === 'feed_control' || initialTab === 'learning' || initialTab === 'taste') {
    return 'taste';
  }
  if (initialTab === 'channels') {
    return 'channels';
  }
  return 'new_space';
}

function toIoniconName(name?: string, fallback: IoniconName = 'layers-outline'): IoniconName {
  return (name && name.trim().length > 0 ? name : fallback) as IoniconName;
}

export const UltraMasterModal: React.FC<UltraMasterModalProps> = ({
  visible,
  onClose,
  initialTab
}) => {
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

  const [activeTab, setActiveTab] = useState<InternalStudioTab>(() => resolveInitialTab(initialTab));
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Bereich 1: Neuer Raum
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
  const [draftTitle, setDraftTitle] = useState<string>('');
  const [draftIcon, setDraftIcon] = useState<string>('layers-outline');
  const [draftAccentColor, setDraftAccentColor] = useState<string>('');
  const [showAdvancedOptions, setShowAdvancedOptions] = useState<boolean>(false);
  const [hasGeneratedDraft, setHasGeneratedDraft] = useState<boolean>(false);
  const [isAiGeneratedBadge, setIsAiGeneratedBadge] = useState<boolean>(false);
  const [isGeneratingAiDraft, setIsGeneratingAiDraft] = useState<boolean>(false);
  const [isCreatingChannel, setIsCreatingChannel] = useState<boolean>(false);

  // Bereich 3: Mein Geschmack
  const [engineState, setEngineState] = useState<LearningEngineState | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);

  useEffect(() => {
    if (visible) {
      setActiveTab(resolveInitialTab(initialTab));
      setShowClearConfirm(false);
    }
  }, [visible, initialTab]);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    RecursiveLearningEngine.getEngineState()
      .then(state => {
        if (active) {
          setEngineState(state);
        }
      })
      .catch(() => {
        // Non-fatal: keep existing state
      });
    return () => {
      active = false;
    };
  }, [visible]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const showToast = useCallback((msg: string) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToastMessage(msg);
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
      toastTimerRef.current = null;
    }, 3200);
  }, []);

  const resetCreationForm = useCallback(() => {
    setNewChannelTitle('');
    setNewChannelHandle('');
    setHasCustomHandle(false);
    setNewChannelDesc('');
    setNewChannelFlair('');
    setNewChannelSources('');
    setNewChannelPrompt('');
    setNewChannelPriority('normal');
    setDraftTitle('');
    setDraftIcon('layers-outline');
    setDraftAccentColor('');
    setHasGeneratedDraft(false);
    setIsAiGeneratedBadge(false);
    setShowAdvancedOptions(false);
  }, []);

  const handleTitleChange = (text: string) => {
    setNewChannelTitle(text);
    if (!hasCustomHandle) {
      setNewChannelHandle(normalizeSpaceHandle(text));
    }
  };

  const handleQuickThemeSelect = (themeLabel: string) => {
    setNewChannelTitle(themeLabel);
    if (!hasCustomHandle) {
      setNewChannelHandle(normalizeSpaceHandle(themeLabel));
    }
    if (hasGeneratedDraft) {
      setHasGeneratedDraft(false);
    }
  };

  const handleGenerateAiDraft = async () => {
    if (!newChannelTitle.trim()) {
      showToast('Bitte zuerst ein Thema eingeben');
      return;
    }
    setIsGeneratingAiDraft(true);
    try {
      const draft = await generateSubchannelDraft(newChannelTitle, newChannelVibe);
      setDraftTitle(draft.suggestedTitle || newChannelTitle.trim());
      setNewChannelHandle(draft.handle);
      setNewChannelFlair(stripLeadingDecorativeEmoji(draft.flair));
      setNewChannelDesc(draft.description);
      setNewChannelTopic(draft.primaryTopic);
      setNewChannelSources(draft.seedSources.join(', '));
      setDraftIcon(draft.icon);
      setDraftAccentColor(draft.accentColor);
      setNewChannelPrompt(draft.suggestedAntithesis || '');
      setHasGeneratedDraft(true);
      setIsAiGeneratedBadge(draft.isAiGenerated);
    } catch {
      showToast('Vorschlag konnte nicht erstellt werden');
    } finally {
      setIsGeneratingAiDraft(false);
    }
  };

  const handleCreateChannel = async () => {
    const titleToUse = (newChannelTitle || draftTitle).trim();
    if (!titleToUse) {
      showToast('Bitte einen Namen für den Raum eingeben');
      return;
    }
    setIsCreatingChannel(true);
    try {
      const seedSources = newChannelSources
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      const cleanFlair = stripLeadingDecorativeEmoji(newChannelFlair);

      const created = await createSpace({
        title: titleToUse,
        handle: newChannelHandle.trim() || undefined,
        description: newChannelDesc.trim() || undefined,
        flair: cleanFlair || undefined,
        icon: draftIcon || 'layers-outline',
        accentColor: draftAccentColor || colors.accent,
        primaryTopic: newChannelTopic,
        rssFeeds: seedSources,
        antithesisPrompt: newChannelPrompt.trim() || undefined,
        feedPriority: newChannelPriority
      });

      resetCreationForm();
      showToast(`Raum ${created.handle} aktiviert`);
      await refreshFeed();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Fehler beim Aktivieren des Raums';
      showToast(msg);
    } finally {
      setIsCreatingChannel(false);
    }
  };

  const handleDeleteChannel = async (id: string, handle: string) => {
    const ok = await deleteSpace(id);
    if (ok) {
      showToast(`Raum ${handle} entfernt`);
      await refreshFeed();
    }
  };

  const handlePriorityChange = async (id: string, priority: SubchannelFeedPriority) => {
    await setSpaceFeedPriority(id, priority);
    showToast('Stream-Präsenz aktualisiert');
    await refreshFeed();
  };

  const handleResetDomainTrust = useCallback(async (domain: string) => {
    try {
      const current = await RecursiveLearningEngine.getEngineState();
      const nextState: LearningEngineState = {
        ...current,
        domainTrustScores: {
          ...current.domainTrustScores,
          [domain]: 1.0
        }
      };
      await appStorage.setItem(LEARNING_STATE_STORAGE_KEY, JSON.stringify(nextState));
      setEngineState(nextState);
      showToast(`Quellen-Gewicht für ${domain} zurückgesetzt`);
      await refreshFeed();
    } catch {
      showToast('Quellen-Gewicht konnte nicht entfernt werden');
    }
  }, [refreshFeed, showToast]);

  const handleResetTasteProfile = useCallback(async () => {
    try {
      await clearFeedbackMemory();
      const neutralState: LearningEngineState = {
        events: [],
        domainTrustScores: {},
        processedInteractions: {},
        appliedInteractions: {},
        totalLearningCycles: 0,
        lastTunedAt: new Date().toISOString()
      };
      await appStorage.setItem(LEARNING_STATE_STORAGE_KEY, JSON.stringify(neutralState));
      setEngineState(neutralState);
      setShowClearConfirm(false);
      showToast('Geschmacksprofil zurückgesetzt');
      await refreshFeed();
    } catch {
      showToast('Geschmacksprofil konnte nicht zurückgesetzt werden');
    }
  }, [clearFeedbackMemory, refreshFeed, showToast]);

  // Derived collections
  const customSpaces = useMemo(() => spaces.filter(s => s.isCustom), [spaces]);
  const defaultSpaces = useMemo(() => spaces.filter(s => !s.isCustom), [spaces]);

  const parsedSeedDomains = useMemo(
    () =>
      newChannelSources
        .split(',')
        .map(s => s.trim())
        .filter(Boolean),
    [newChannelSources]
  );

  // Feed mix calculations
  const currentMix = profile?.feedMixRatio || {
    focusRatio: 0.6,
    socraticRatio: 0.2,
    serendipityRatio: 0.2
  };
  const focusPct = Math.round(currentMix.focusRatio * 100);
  const socraticPct = Math.round(currentMix.socraticRatio * 100);
  const serendipityPct = Math.max(0, 100 - focusPct - socraticPct);

  // Live learned topic weights sorted descending
  const sortedTopicWeights = useMemo(() => {
    const keys = new Set<TopicTag>(Object.keys(TOPIC_METADATA) as TopicTag[]);
    for (const k of Object.keys(profile?.explicitInterests || {})) {
      if (k in TOPIC_METADATA) keys.add(k as TopicTag);
    }
    for (const k of Object.keys(profile?.derivedWeights || {})) {
      if (k in TOPIC_METADATA) keys.add(k as TopicTag);
    }

    return Array.from(keys)
      .map(topic => {
        const effective = getEffectiveTopicWeight(profile, topic);
        const explicit = profile?.explicitInterests?.[topic] ?? 0.5;
        const derived = profile?.derivedWeights?.[topic];
        const deltaPct = typeof derived === 'number' ? Math.round((derived - explicit) * 100) : 0;
        const meta = TOPIC_METADATA[topic];
        return {
          topic,
          label: meta?.label || stripLeadingDecorativeEmoji(TOPIC_SPACE_MAP[topic]?.flair || topic),
          effective,
          effectivePct: Math.round(effective * 100),
          deltaPct
        };
      })
      .sort((a, b) => b.effective - a.effective);
  }, [profile]);

  // Learning engine trust scores + feedback memory signals
  const boostedTrustDomains = useMemo(
    () =>
      Object.entries(engineState?.domainTrustScores || {})
        .filter(([, score]) => score > 1.03)
        .sort((a, b) => b[1] - a[1]),
    [engineState?.domainTrustScores]
  );
  const dampenedTrustDomains = useMemo(
    () =>
      Object.entries(engineState?.domainTrustScores || {})
        .filter(([, score]) => score < 0.97)
        .sort((a, b) => a[1] - b[1]),
    [engineState?.domainTrustScores]
  );

  const feedbackMem = profile?.feedbackMemory || {};
  const boostedDomains = useMemo(
    () => Object.entries(feedbackMem.boostedDomains || {}),
    [feedbackMem.boostedDomains]
  );
  const penalizedDomains = useMemo(
    () => Object.entries(feedbackMem.penalizedDomains || {}),
    [feedbackMem.penalizedDomains]
  );
  const boostedKeywords = useMemo(
    () => Object.entries(feedbackMem.boostedKeywords || {}),
    [feedbackMem.boostedKeywords]
  );
  const penalizedKeywords = useMemo(
    () => Object.entries(feedbackMem.penalizedKeywords || {}),
    [feedbackMem.penalizedKeywords]
  );

  const renderSpaceCard = (s: Subchannel) => {
    const currentPriority: SubchannelFeedPriority = s.feedPriority || (s.pinned ? 'high' : 'normal');
    const spaceColor = s.accentColor || colors.accent;
    const cleanFlair = stripLeadingDecorativeEmoji(s.flair);

    return (
      <View
        key={s.id}
        style={[
          styles.roomCard,
          { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }
        ]}
      >
        <View style={styles.roomTopRow}>
          <View style={[styles.roomIconBox, { backgroundColor: spaceColor + '1A' }]}>
            <Ionicons name={toIoniconName(s.icon)} size={18} color={spaceColor} />
          </View>

          <View style={styles.roomMetaCol}>
            <View style={styles.roomHeaderLine}>
              <Text style={[styles.roomTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                {s.title}
              </Text>
              <Text style={[styles.roomHandle, { color: spaceColor }]}>{s.handle}</Text>
            </View>
            {cleanFlair.length > 0 && cleanFlair.toLowerCase() !== s.title.toLowerCase() && (
              <Text style={[styles.roomFlair, { color: colors.textMuted }]} numberOfLines={1}>
                {cleanFlair}
              </Text>
            )}
            <Text style={[styles.roomDesc, { color: colors.textSecondary }]} numberOfLines={2}>
              {s.description}
            </Text>
          </View>

          <View style={styles.roomActions}>
            <TouchableOpacity
              onPress={() => void togglePinSpace(s.id)}
              style={[
                styles.iconActionBtn,
                {
                  backgroundColor: s.pinned ? colors.accentSubtle : colors.surface,
                  borderColor: s.pinned ? colors.accent : colors.borderSubtle
                }
              ]}
              accessibilityRole="button"
              accessibilityLabel={s.pinned ? 'Raum lösen' : 'Raum anpinnen'}
            >
              <Ionicons
                name={s.pinned ? 'pin' : 'pin-outline'}
                size={15}
                color={s.pinned ? colors.accent : colors.textMuted}
              />
            </TouchableOpacity>

            {s.isCustom && (
              <TouchableOpacity
                onPress={() => void handleDeleteChannel(s.id, s.handle)}
                style={[
                  styles.iconActionBtn,
                  { backgroundColor: colors.surface, borderColor: colors.borderSubtle }
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Eigenen Raum ${s.title} löschen`}
              >
                <Ionicons name="trash-outline" size={15} color={colors.danger} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View
          style={[
            styles.prioritySegmentTrack,
            { backgroundColor: colors.surface, borderColor: colors.borderSubtle }
          ]}
        >
          {PRIORITY_OPTIONS.map(option => {
            const isSelected = currentPriority === option.id;
            return (
              <TouchableOpacity
                key={option.id}
                onPress={() => void handlePriorityChange(s.id, option.id)}
                style={[
                  styles.prioritySegmentBtn,
                  isSelected && { backgroundColor: colors.accent }
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
              >
                <Text
                  style={[
                    styles.prioritySegmentText,
                    { color: isSelected ? '#FFFFFF' : colors.textSecondary }
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  const hasPositiveSignals =
    boostedTrustDomains.length > 0 || boostedDomains.length > 0 || boostedKeywords.length > 0;
  const hasDampenedSignals =
    dampenedTrustDomains.length > 0 || penalizedDomains.length > 0 || penalizedKeywords.length > 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable
          accessibilityLabel="Studio schließen"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />

        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border }
          ]}
          onStartShouldSetResponder={() => true}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.borderSubtle }]}>
            <View style={styles.headerLeft}>
              <View style={[styles.headerEmblem, { backgroundColor: colors.accentSubtle }]}>
                <Ionicons name="sparkles-outline" size={18} color={colors.accent} />
              </View>
              <View style={styles.headerTextWrap}>
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
                  AI Studio
                </Text>
                <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
                  Räume gestalten und deinen Geschmack steuern
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={[
                styles.closeBtn,
                { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }
              ]}
              accessibilityRole="button"
              accessibilityLabel="Studio schließen"
            >
              <Ionicons name="close" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* 3-Tab Segmented Switcher */}
          <View style={[styles.segmentedBarWrap, { borderBottomColor: colors.borderSubtle }]}>
            <View
              style={[
                styles.segmentedTrack,
                { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }
              ]}
            >
              {(
                [
                  {
                    id: 'new_space' as InternalStudioTab,
                    label: 'Neuer Raum',
                    icon: 'add-circle-outline' as IoniconName
                  },
                  {
                    id: 'channels' as InternalStudioTab,
                    label: `Meine Räume (${spaces.length})`,
                    icon: 'layers-outline' as IoniconName
                  },
                  {
                    id: 'taste' as InternalStudioTab,
                    label: 'Mein Geschmack',
                    icon: 'options-outline' as IoniconName
                  }
                ] as const
              ).map(tab => {
                const isActive = activeTab === tab.id;
                return (
                  <TouchableOpacity
                    key={tab.id}
                    onPress={() => setActiveTab(tab.id)}
                    style={[
                      styles.segmentedItem,
                      isActive && {
                        backgroundColor: colors.surface,
                        borderColor: colors.border
                      }
                    ]}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: isActive }}
                  >
                    <Ionicons
                      name={tab.icon}
                      size={15}
                      color={isActive ? colors.accent : colors.textMuted}
                    />
                    <Text
                      style={[
                        styles.segmentedItemText,
                        { color: isActive ? colors.textPrimary : colors.textSecondary }
                      ]}
                      numberOfLines={1}
                    >
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Toast */}
          {toastMessage && (
            <View
              style={[
                styles.toast,
                { backgroundColor: colors.surfaceSecondary, borderColor: colors.accent }
              ]}
            >
              <Ionicons name="checkmark-circle-outline" size={15} color={colors.accent} />
              <Text style={[styles.toastText, { color: colors.textPrimary }]}>{toastMessage}</Text>
            </View>
          )}

          {/* Content Area */}
          <View style={styles.contentContainer}>
            {/* BEREICH 1: Neuer Raum (1-Step Magic) */}
            {activeTab === 'new_space' && (
              <ScrollView
                style={styles.tabScroll}
                contentContainerStyle={styles.tabScrollContent}
                keyboardShouldPersistTaps="handled"
              >
                <View style={styles.creationBlock}>
                  <Text style={[styles.promptHeading, { color: colors.textPrimary }]}>
                    Welches Thema möchtest du als eigenen Raum?
                  </Text>

                  <TextInput
                    value={newChannelTitle}
                    onChangeText={handleTitleChange}
                    placeholder="z. B. Erkenntnistheorie, Bauhaus-Architektur, Modulare Synthese…"
                    placeholderTextColor={colors.textMuted}
                    style={[
                      styles.spaciousInput,
                      {
                        backgroundColor: colors.surfaceSecondary,
                        borderColor: colors.border,
                        color: colors.textPrimary
                      }
                    ]}
                    returnKeyType="done"
                    onSubmitEditing={() => void handleGenerateAiDraft()}
                  />

                  <View style={styles.quickChipsRow}>
                    {STUDIO_QUICK_THEMES.map(themeName => {
                      const isPicked = newChannelTitle.trim().toLowerCase() === themeName.toLowerCase();
                      return (
                        <TouchableOpacity
                          key={themeName}
                          onPress={() => handleQuickThemeSelect(themeName)}
                          style={[
                            styles.quickChip,
                            {
                              backgroundColor: isPicked ? colors.accentSubtle : colors.surfaceSecondary,
                              borderColor: isPicked ? colors.accent : colors.borderSubtle
                            }
                          ]}
                        >
                          <Text
                            style={[
                              styles.quickChipText,
                              { color: isPicked ? colors.accent : colors.textSecondary }
                            ]}
                          >
                            {themeName}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <TouchableOpacity
                    onPress={() => void handleGenerateAiDraft()}
                    disabled={isGeneratingAiDraft || !newChannelTitle.trim()}
                    style={[
                      styles.primaryBtn,
                      {
                        backgroundColor: colors.accent,
                        opacity: newChannelTitle.trim() ? 1 : 0.48
                      }
                    ]}
                    accessibilityRole="button"
                  >
                    {isGeneratingAiDraft ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="sparkles-outline" size={16} color="#FFFFFF" />
                        <Text style={styles.primaryBtnText}>Vorschlag erstellen</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>

                {/* Vorschau-Karte (nur nach Generierung sichtbar) */}
                {hasGeneratedDraft && (
                  <View
                    style={[
                      styles.previewCard,
                      { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }
                    ]}
                  >
                    <View style={styles.previewHeaderRow}>
                      <View
                        style={[
                          styles.previewIconBox,
                          { backgroundColor: (draftAccentColor || colors.accent) + '1F' }
                        ]}
                      >
                        <Ionicons
                          name={toIoniconName(draftIcon)}
                          size={19}
                          color={draftAccentColor || colors.accent}
                        />
                      </View>

                      <View style={styles.previewTitleCol}>
                        <Text style={[styles.previewTitle, { color: colors.textPrimary }]}>
                          {newChannelTitle.trim() || draftTitle}
                        </Text>
                        <Text style={[styles.previewHandle, { color: draftAccentColor || colors.accent }]}>
                          {newChannelHandle || normalizeSpaceHandle(newChannelTitle)}
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.originTag,
                          { backgroundColor: colors.surface, borderColor: colors.borderSubtle }
                        ]}
                      >
                        <Text style={[styles.originTagText, { color: colors.textSecondary }]}>
                          {isAiGeneratedBadge ? 'KI-Entwurf' : 'Kuratiert'}
                        </Text>
                      </View>
                    </View>

                    {newChannelDesc.trim().length > 0 && (
                      <Text style={[styles.previewDesc, { color: colors.textSecondary }]}>
                        {newChannelDesc}
                      </Text>
                    )}

                    {parsedSeedDomains.length > 0 && (
                      <View style={styles.seedDomainsRow}>
                        {parsedSeedDomains.map(domain => (
                          <View
                            key={domain}
                            style={[
                              styles.seedDomainPill,
                              { backgroundColor: colors.surface, borderColor: colors.borderSubtle }
                            ]}
                          >
                            <Text style={[styles.seedDomainText, { color: colors.textSecondary }]}>
                              {domain}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}

                    <TouchableOpacity
                      onPress={() => void handleCreateChannel()}
                      disabled={isCreatingChannel || !newChannelTitle.trim()}
                      style={[
                        styles.primaryBtn,
                        { backgroundColor: colors.success, marginTop: spacing.md }
                      ]}
                      accessibilityRole="button"
                    >
                      {isCreatingChannel ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <Ionicons name="checkmark-circle-outline" size={17} color="#FFFFFF" />
                          <Text style={styles.primaryBtnText}>Raum aktivieren</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                {/* Collapsed-by-default Erweiterte Optionen Accordion */}
                <View
                  style={[
                    styles.accordionBox,
                    { backgroundColor: colors.surface, borderColor: colors.borderSubtle }
                  ]}
                >
                  <TouchableOpacity
                    onPress={() => setShowAdvancedOptions(prev => !prev)}
                    style={styles.accordionHeader}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: showAdvancedOptions }}
                  >
                    <Text style={[styles.accordionTitle, { color: colors.textSecondary }]}>
                      Erweiterte Optionen
                    </Text>
                    <Ionicons
                      name={showAdvancedOptions ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color={colors.textMuted}
                    />
                  </TouchableOpacity>

                  {showAdvancedOptions && (
                    <View style={styles.accordionBody}>
                      <View>
                        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                          Handle
                        </Text>
                        <TextInput
                          value={newChannelHandle}
                          onChangeText={text => {
                            setNewChannelHandle(text);
                            setHasCustomHandle(true);
                          }}
                          placeholder="c/thema"
                          placeholderTextColor={colors.textMuted}
                          style={[
                            styles.fieldInput,
                            {
                              backgroundColor: colors.surfaceSecondary,
                              borderColor: colors.borderSubtle,
                              color: colors.textPrimary
                            }
                          ]}
                        />
                      </View>

                      <View>
                        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                          Tonalität
                        </Text>
                        <View style={styles.chipWrap}>
                          {(Object.keys(SUBCHANNEL_VIBES) as SubchannelVibe[]).map(vibeKey => {
                            const vMeta = SUBCHANNEL_VIBES[vibeKey];
                            const isSelected = newChannelVibe === vibeKey;
                            return (
                              <TouchableOpacity
                                key={vibeKey}
                                onPress={() => setNewChannelVibe(vibeKey)}
                                style={[
                                  styles.optionChip,
                                  {
                                    backgroundColor: isSelected
                                      ? colors.accent
                                      : colors.surfaceSecondary,
                                    borderColor: isSelected ? colors.accent : colors.borderSubtle
                                  }
                                ]}
                              >
                                <Ionicons
                                  name={toIoniconName(vMeta.icon)}
                                  size={13}
                                  color={isSelected ? '#FFFFFF' : colors.textSecondary}
                                />
                                <Text
                                  style={[
                                    styles.optionChipText,
                                    { color: isSelected ? '#FFFFFF' : colors.textPrimary }
                                  ]}
                                >
                                  {stripLeadingDecorativeEmoji(vMeta.label)}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>

                      <View>
                        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                          Wissensgebiet
                        </Text>
                        <View style={styles.chipWrap}>
                          {TOPIC_OPTIONS.map(topicKey => {
                            const isSelected = newChannelTopic === topicKey;
                            const label =
                              TOPIC_METADATA[topicKey]?.label ||
                              stripLeadingDecorativeEmoji(TOPIC_SPACE_MAP[topicKey]?.flair || topicKey);
                            return (
                              <TouchableOpacity
                                key={topicKey}
                                onPress={() => setNewChannelTopic(topicKey)}
                                style={[
                                  styles.optionChip,
                                  {
                                    backgroundColor: isSelected
                                      ? colors.accent
                                      : colors.surfaceSecondary,
                                    borderColor: isSelected ? colors.accent : colors.borderSubtle
                                  }
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.optionChipText,
                                    { color: isSelected ? '#FFFFFF' : colors.textSecondary }
                                  ]}
                                >
                                  {label}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>

                      <View>
                        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                          Quellen-Domains
                        </Text>
                        <TextInput
                          value={newChannelSources}
                          onChangeText={setNewChannelSources}
                          placeholder="plato.stanford.edu, aeon.co, spektrum.de"
                          placeholderTextColor={colors.textMuted}
                          style={[
                            styles.fieldInput,
                            {
                              backgroundColor: colors.surfaceSecondary,
                              borderColor: colors.borderSubtle,
                              color: colors.textPrimary
                            }
                          ]}
                        />
                      </View>

                      <View>
                        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                          Optionale Leitfrage
                        </Text>
                        <TextInput
                          value={newChannelPrompt}
                          onChangeText={setNewChannelPrompt}
                          placeholder="Welche kritische Gegenfrage soll diesen Raum begleiten?"
                          placeholderTextColor={colors.textMuted}
                          style={[
                            styles.fieldInput,
                            {
                              backgroundColor: colors.surfaceSecondary,
                              borderColor: colors.borderSubtle,
                              color: colors.textPrimary
                            }
                          ]}
                        />
                      </View>

                      <View>
                        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                          Präsenz im Stream
                        </Text>
                        <View
                          style={[
                            styles.prioritySegmentTrack,
                            { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }
                          ]}
                        >
                          {PRIORITY_OPTIONS.map(option => {
                            const isSelected = newChannelPriority === option.id;
                            return (
                              <TouchableOpacity
                                key={option.id}
                                onPress={() => setNewChannelPriority(option.id)}
                                style={[
                                  styles.prioritySegmentBtn,
                                  isSelected && { backgroundColor: colors.accent }
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.prioritySegmentText,
                                    { color: isSelected ? '#FFFFFF' : colors.textSecondary }
                                  ]}
                                >
                                  {option.label}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>

                      {!hasGeneratedDraft && newChannelTitle.trim().length > 0 && (
                        <TouchableOpacity
                          onPress={() => void handleCreateChannel()}
                          disabled={isCreatingChannel}
                          style={[
                            styles.secondaryBtn,
                            { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }
                          ]}
                        >
                          <Text style={[styles.secondaryBtnText, { color: colors.textPrimary }]}>
                            Direkt ohne Vorschlag aktivieren
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              </ScrollView>
            )}

            {/* BEREICH 2: Meine Räume */}
            {activeTab === 'channels' && (
              <ScrollView style={styles.tabScroll} contentContainerStyle={styles.tabScrollContent}>
                <View style={styles.groupSection}>
                  <Text style={[styles.groupHeading, { color: colors.textPrimary }]}>
                    Eigene Räume
                  </Text>
                  {customSpaces.length === 0 ? (
                    <View
                      style={[
                        styles.emptyBox,
                        { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }
                      ]}
                    >
                      <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                        Du hast noch keine eigenen Räume angelegt.
                      </Text>
                      <TouchableOpacity
                        onPress={() => setActiveTab('new_space')}
                        style={[
                          styles.secondaryBtn,
                          { borderColor: colors.border, backgroundColor: colors.surface }
                        ]}
                      >
                        <Ionicons name="add-circle-outline" size={15} color={colors.accent} />
                        <Text style={[styles.secondaryBtnText, { color: colors.accent }]}>
                          Ersten Raum gestalten
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.roomList}>{customSpaces.map(renderSpaceCard)}</View>
                  )}
                </View>

                <View style={styles.groupSection}>
                  <Text style={[styles.groupHeading, { color: colors.textPrimary }]}>
                    Standard-Räume
                  </Text>
                  <View style={styles.roomList}>{defaultSpaces.map(renderSpaceCard)}</View>
                </View>
              </ScrollView>
            )}

            {/* BEREICH 3: Mein Geschmack (Live Learned Mirror) */}
            {activeTab === 'taste' && (
              <ScrollView style={styles.tabScroll} contentContainerStyle={styles.tabScrollContent}>
                {/* Stream-Balance: Fokus · Kritisch · Entdeckung */}
                <View
                  style={[
                    styles.tasteSection,
                    { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }
                  ]}
                >
                  <Text style={[styles.groupHeading, { color: colors.textPrimary }]}>
                    Stream-Balance
                  </Text>
                  <Text style={[styles.sectionSubcopy, { color: colors.textMuted }]}>
                    Verhältnis zwischen deinen Kernthemen, kritischer Reibung und offenen Entdeckungen.
                  </Text>

                  <View style={[styles.proportionalBar, { backgroundColor: colors.surface }]}>
                    {focusPct > 0 && (
                      <View style={{ flex: focusPct, backgroundColor: colors.success }} />
                    )}
                    {socraticPct > 0 && (
                      <View style={{ flex: socraticPct, backgroundColor: colors.accent }} />
                    )}
                    {serendipityPct > 0 && (
                      <View style={{ flex: serendipityPct, backgroundColor: '#7E72B5' }} />
                    )}
                  </View>

                  <View style={styles.mixLegendRow}>
                    <View style={styles.mixLegendItem}>
                      <View style={[styles.mixDot, { backgroundColor: colors.success }]} />
                      <Text style={[styles.mixLegendLabel, { color: colors.textSecondary }]}>
                        Fokus {focusPct}%
                      </Text>
                    </View>
                    <View style={styles.mixLegendItem}>
                      <View style={[styles.mixDot, { backgroundColor: colors.accent }]} />
                      <Text style={[styles.mixLegendLabel, { color: colors.textSecondary }]}>
                        Kritisch {socraticPct}%
                      </Text>
                    </View>
                    <View style={styles.mixLegendItem}>
                      <View style={[styles.mixDot, { backgroundColor: '#7E72B5' }]} />
                      <Text style={[styles.mixLegendLabel, { color: colors.textSecondary }]}>
                        Entdeckung {serendipityPct}%
                      </Text>
                    </View>
                  </View>

                  <View style={styles.presetRow}>
                    {MIX_PRESETS.map(preset => {
                      const isActive =
                        Math.round(preset.focus * 100) === focusPct &&
                        Math.round(preset.socratic * 100) === socraticPct;
                      return (
                        <TouchableOpacity
                          key={preset.id}
                          onPress={async () => {
                            await updateFeedMixRatio(
                              preset.focus,
                              preset.socratic,
                              preset.serendipity
                            );
                            showToast(`Mischverhältnis: ${preset.label}`);
                          }}
                          style={[
                            styles.presetBtn,
                            {
                              backgroundColor: isActive ? colors.accentSubtle : colors.surface,
                              borderColor: isActive ? colors.accent : colors.borderSubtle
                            }
                          ]}
                        >
                          <Text
                            style={[
                              styles.presetBtnText,
                              { color: isActive ? colors.accent : colors.textPrimary }
                            ]}
                          >
                            {preset.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Live Learned Topic Weights */}
                <View
                  style={[
                    styles.tasteSection,
                    { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }
                  ]}
                >
                  <Text style={[styles.groupHeading, { color: colors.textPrimary }]}>
                    Themen-Gewichte
                  </Text>
                  <Text style={[styles.sectionSubcopy, { color: colors.textMuted }]}>
                    Effektive Gewichtung aus deinen Voreinstellungen und gelernten Lesesignalen.
                  </Text>

                  <View style={styles.topicList}>
                    {sortedTopicWeights.map(row => (
                      <View key={row.topic} style={styles.topicRow}>
                        <View style={styles.topicHeaderRow}>
                          <View style={styles.topicLabelGroup}>
                            <Text style={[styles.topicLabel, { color: colors.textPrimary }]}>
                              {row.label}
                            </Text>
                            {row.deltaPct !== 0 && (
                              <View
                                style={[
                                  styles.deltaPill,
                                  {
                                    backgroundColor:
                                      row.deltaPct > 0
                                        ? colors.success + '1F'
                                        : colors.danger + '1F'
                                  }
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.deltaPillText,
                                    { color: row.deltaPct > 0 ? colors.success : colors.danger }
                                  ]}
                                >
                                  {row.deltaPct > 0 ? `+${row.deltaPct}%` : `${row.deltaPct}%`} gelernt
                                </Text>
                              </View>
                            )}
                          </View>

                          <View style={styles.topicControls}>
                            <Text style={[styles.topicPct, { color: colors.textSecondary }]}>
                              {row.effectivePct}%
                            </Text>
                            <TouchableOpacity
                              onPress={() => {
                                const next = Math.max(
                                  0.05,
                                  Math.round((row.effective - 0.1) * 100) / 100
                                );
                                void updateTopicWeight(row.topic, next);
                              }}
                              style={[
                                styles.stepBtn,
                                { backgroundColor: colors.surface, borderColor: colors.borderSubtle }
                              ]}
                              accessibilityLabel={`Gewicht für ${row.label} verringern`}
                            >
                              <Ionicons name="remove" size={14} color={colors.textPrimary} />
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => {
                                const next = Math.min(
                                  1.0,
                                  Math.round((row.effective + 0.1) * 100) / 100
                                );
                                void updateTopicWeight(row.topic, next);
                              }}
                              style={[
                                styles.stepBtn,
                                { backgroundColor: colors.surface, borderColor: colors.borderSubtle }
                              ]}
                              accessibilityLabel={`Gewicht für ${row.label} erhöhen`}
                            >
                              <Ionicons name="add" size={14} color={colors.textPrimary} />
                            </TouchableOpacity>
                          </View>
                        </View>

                        <View style={[styles.barTrack, { backgroundColor: colors.surface }]}>
                          <View
                            style={[
                              styles.barFill,
                              { width: `${row.effectivePct}%`, backgroundColor: colors.accent }
                            ]}
                          />
                        </View>
                      </View>
                    ))}
                  </View>
                </View>

                {/* Learned Signals: Boosted & Dampened Domains & Keywords */}
                <View
                  style={[
                    styles.tasteSection,
                    { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }
                  ]}
                >
                  <Text style={[styles.groupHeading, { color: colors.textPrimary }]}>
                    Gelernte Signale
                  </Text>
                  <Text style={[styles.sectionSubcopy, { color: colors.textMuted }]}>
                    Vertrauenswerte und Feedback-Muster aus deinen Reaktionen. Ein Tippen entfernt das Signal.
                  </Text>

                  <View style={styles.signalBlock}>
                    <View style={styles.signalGroupHeader}>
                      <Ionicons name="arrow-up-circle-outline" size={15} color={colors.success} />
                      <Text style={[styles.signalGroupTitle, { color: colors.textPrimary }]}>
                        Bevorzugte Quellen & Themen
                      </Text>
                    </View>

                    {!hasPositiveSignals ? (
                      <Text style={[styles.emptySignalText, { color: colors.textMuted }]}>
                        Noch keine verstärkten Quellen oder Schlagworte gespeichert.
                      </Text>
                    ) : (
                      <View style={styles.chipWrap}>
                        {boostedTrustDomains.map(([domain, score]) => {
                          const pctBoost = Math.round((score - 1.0) * 100);
                          return (
                            <TouchableOpacity
                              key={`trust-up-${domain}`}
                              onPress={() => void handleResetDomainTrust(domain)}
                              style={[
                                styles.signalChip,
                                {
                                  backgroundColor: colors.success + '18',
                                  borderColor: colors.success + '44'
                                }
                              ]}
                              accessibilityLabel={`Vertrauen für ${domain} entfernen`}
                            >
                              <Text style={[styles.signalChipText, { color: colors.success }]}>
                                {domain} (+{pctBoost}%)
                              </Text>
                              <Ionicons name="close" size={13} color={colors.success} />
                            </TouchableOpacity>
                          );
                        })}

                        {boostedDomains.map(([dom, count]) => (
                          <TouchableOpacity
                            key={`mem-dom-up-${dom}`}
                            onPress={() => void removeFeedbackBoost('domain', dom)}
                            style={[
                              styles.signalChip,
                              {
                                backgroundColor: colors.success + '18',
                                borderColor: colors.success + '44'
                              }
                            ]}
                            accessibilityLabel={`Bevorzugung für ${dom} entfernen`}
                          >
                            <Text style={[styles.signalChipText, { color: colors.success }]}>
                              {dom} ({count >= 0 ? `+${count}` : count})
                            </Text>
                            <Ionicons name="close" size={13} color={colors.success} />
                          </TouchableOpacity>
                        ))}

                        {boostedKeywords.map(([kw, count]) => (
                          <TouchableOpacity
                            key={`mem-kw-up-${kw}`}
                            onPress={() => void removeFeedbackBoost('keyword', kw)}
                            style={[
                              styles.signalChip,
                              {
                                backgroundColor: colors.accentSubtle,
                                borderColor: colors.accent + '44'
                              }
                            ]}
                            accessibilityLabel={`Schlagwort ${kw} entfernen`}
                          >
                            <Text style={[styles.signalChipText, { color: colors.accent }]}>
                              #{kw} (+{count})
                            </Text>
                            <Ionicons name="close" size={13} color={colors.accent} />
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>

                  <View style={[styles.signalBlock, { marginTop: spacing.md }]}>
                    <View style={styles.signalGroupHeader}>
                      <Ionicons name="remove-circle-outline" size={15} color={colors.danger} />
                      <Text style={[styles.signalGroupTitle, { color: colors.textPrimary }]}>
                        Gedämpfte Quellen & Themen
                      </Text>
                    </View>

                    {!hasDampenedSignals ? (
                      <Text style={[styles.emptySignalText, { color: colors.textMuted }]}>
                        Keine gedämpften Quellen oder Schlagworte aktiv.
                      </Text>
                    ) : (
                      <View style={styles.chipWrap}>
                        {dampenedTrustDomains.map(([domain, score]) => {
                          const pctDrop = Math.round((score - 1.0) * 100);
                          return (
                            <TouchableOpacity
                              key={`trust-down-${domain}`}
                              onPress={() => void handleResetDomainTrust(domain)}
                              style={[
                                styles.signalChip,
                                {
                                  backgroundColor: colors.danger + '18',
                                  borderColor: colors.danger + '44'
                                }
                              ]}
                              accessibilityLabel={`Dämpfung für ${domain} aufheben`}
                            >
                              <Text style={[styles.signalChipText, { color: colors.danger }]}>
                                {domain} ({pctDrop}%)
                              </Text>
                              <Ionicons name="close" size={13} color={colors.danger} />
                            </TouchableOpacity>
                          );
                        })}

                        {penalizedDomains.map(([dom, count]) => (
                          <TouchableOpacity
                            key={`mem-dom-down-${dom}`}
                            onPress={() => void removeFeedbackPenalty('domain', dom)}
                            style={[
                              styles.signalChip,
                              {
                                backgroundColor: colors.danger + '18',
                                borderColor: colors.danger + '44'
                              }
                            ]}
                            accessibilityLabel={`Dämpfung für ${dom} entfernen`}
                          >
                            <Text style={[styles.signalChipText, { color: colors.danger }]}>
                              {dom} (-{Math.abs(count)})
                            </Text>
                            <Ionicons name="close" size={13} color={colors.danger} />
                          </TouchableOpacity>
                        ))}

                        {penalizedKeywords.map(([kw, count]) => (
                          <TouchableOpacity
                            key={`mem-kw-down-${kw}`}
                            onPress={() => void removeFeedbackPenalty('keyword', kw)}
                            style={[
                              styles.signalChip,
                              {
                                backgroundColor: colors.danger + '18',
                                borderColor: colors.danger + '44'
                              }
                            ]}
                            accessibilityLabel={`Gedämpftes Schlagwort ${kw} entfernen`}
                          >
                            <Text style={[styles.signalChipText, { color: colors.danger }]}>
                              #{kw} (-{Math.abs(count)})
                            </Text>
                            <Ionicons name="close" size={13} color={colors.danger} />
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                </View>

                {/* Geschmacksprofil zurücksetzen */}
                <View
                  style={[
                    styles.tasteSection,
                    { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }
                  ]}
                >
                  <Text style={[styles.groupHeading, { color: colors.textPrimary }]}>
                    Geschmacksprofil zurücksetzen
                  </Text>
                  <Text style={[styles.sectionSubcopy, { color: colors.textMuted }]}>
                    Entfernt alle gelernten Quellen-Gewichte, Themen-Deltas und Feedback-Signale.
                  </Text>

                  {showClearConfirm ? (
                    <View style={styles.confirmRow}>
                      <TouchableOpacity
                        onPress={() => void handleResetTasteProfile()}
                        style={[styles.dangerBtn, { backgroundColor: colors.danger }]}
                      >
                        <Text style={styles.primaryBtnText}>Jetzt zurücksetzen</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setShowClearConfirm(false)}
                        style={[
                          styles.secondaryBtn,
                          { borderColor: colors.border, backgroundColor: colors.surface }
                        ]}
                      >
                        <Text style={[styles.secondaryBtnText, { color: colors.textPrimary }]}>
                          Abbrechen
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      onPress={() => setShowClearConfirm(true)}
                      style={[
                        styles.secondaryBtn,
                        { borderColor: colors.border, backgroundColor: colors.surface, alignSelf: 'flex-start' }
                      ]}
                    >
                      <Ionicons name="refresh-outline" size={15} color={colors.textPrimary} />
                      <Text style={[styles.secondaryBtnText, { color: colors.textPrimary }]}>
                        Geschmacksprofil zurücksetzen
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
    backgroundColor: 'rgba(6, 10, 18, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md
  },
  card: {
    width: '100%',
    maxWidth: 780,
    maxHeight: '92%',
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    flexDirection: 'column'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1
  },
  headerEmblem: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center'
  },
  headerTextWrap: {
    flex: 1
  },
  headerTitle: {
    fontSize: typography.sizes.title2,
    fontWeight: '700',
    letterSpacing: -0.2
  },
  headerSubtitle: {
    fontSize: typography.sizes.caption,
    marginTop: 2
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  segmentedBarWrap: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderBottomWidth: 1
  },
  segmentedTrack: {
    flexDirection: 'row',
    borderRadius: radius.md,
    borderWidth: 1,
    padding: 3,
    gap: 4
  },
  segmentedItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'transparent'
  },
  segmentedItemText: {
    fontSize: typography.sizes.caption,
    fontWeight: '600'
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: spacing.xl,
    marginTop: spacing.md,
    paddingVertical: 9,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1
  },
  toastText: {
    fontSize: typography.sizes.caption,
    fontWeight: '600'
  },
  contentContainer: {
    flex: 1
  },
  tabScroll: {
    flex: 1
  },
  tabScrollContent: {
    padding: spacing.xl,
    gap: spacing.xl
  },
  creationBlock: {
    gap: spacing.md
  },
  promptHeading: {
    fontSize: typography.sizes.body,
    fontWeight: '700',
    lineHeight: typography.lineHeights.body
  },
  spaciousInput: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    fontSize: typography.sizes.body
  },
  quickChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm
  },
  quickChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1
  },
  quickChipText: {
    fontSize: typography.sizes.caption,
    fontWeight: '600'
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: typography.sizes.bodySmall,
    fontWeight: '700'
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1
  },
  secondaryBtnText: {
    fontSize: typography.sizes.caption,
    fontWeight: '600'
  },
  dangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md
  },
  previewCard: {
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.md
  },
  previewHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md
  },
  previewIconBox: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center'
  },
  previewTitleCol: {
    flex: 1
  },
  previewTitle: {
    fontSize: typography.sizes.body,
    fontWeight: '700'
  },
  previewHandle: {
    fontSize: typography.sizes.caption,
    fontWeight: '600',
    marginTop: 2
  },
  originTag: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1
  },
  originTagText: {
    fontSize: typography.sizes.micro,
    fontWeight: '600'
  },
  previewDesc: {
    fontSize: typography.sizes.bodySmall,
    lineHeight: typography.lineHeights.bodySmall
  },
  seedDomainsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  seedDomainPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1
  },
  seedDomainText: {
    fontSize: typography.sizes.micro,
    fontWeight: '600'
  },
  accordionBox: {
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: 'hidden'
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md
  },
  accordionTitle: {
    fontSize: typography.sizes.bodySmall,
    fontWeight: '600'
  },
  accordionBody: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.md
  },
  fieldLabel: {
    fontSize: typography.sizes.caption,
    fontWeight: '600',
    marginBottom: 6
  },
  fieldInput: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: typography.sizes.bodySmall
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm
  },
  optionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1
  },
  optionChipText: {
    fontSize: typography.sizes.caption,
    fontWeight: '600'
  },
  groupSection: {
    gap: spacing.md
  },
  groupHeading: {
    fontSize: typography.sizes.body,
    fontWeight: '700'
  },
  sectionSubcopy: {
    fontSize: typography.sizes.caption,
    lineHeight: typography.lineHeights.caption,
    marginTop: 2
  },
  emptyBox: {
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'flex-start',
    gap: spacing.md
  },
  emptyText: {
    fontSize: typography.sizes.bodySmall
  },
  roomList: {
    gap: spacing.md
  },
  roomCard: {
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.md
  },
  roomTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md
  },
  roomIconBox: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2
  },
  roomMetaCol: {
    flex: 1,
    gap: 3
  },
  roomHeaderLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: spacing.sm
  },
  roomTitle: {
    fontSize: typography.sizes.bodySmall,
    fontWeight: '700'
  },
  roomHandle: {
    fontSize: typography.sizes.caption,
    fontWeight: '600'
  },
  roomFlair: {
    fontSize: typography.sizes.micro,
    fontWeight: '500'
  },
  roomDesc: {
    fontSize: typography.sizes.caption,
    lineHeight: typography.lineHeights.caption,
    marginTop: 2
  },
  roomActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  iconActionBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  prioritySegmentTrack: {
    flexDirection: 'row',
    borderRadius: radius.sm,
    borderWidth: 1,
    padding: 3,
    gap: 4
  },
  prioritySegmentBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: radius.xs
  },
  prioritySegmentText: {
    fontSize: typography.sizes.caption,
    fontWeight: '600'
  },
  tasteSection: {
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.md
  },
  proportionalBar: {
    height: 10,
    borderRadius: radius.pill,
    overflow: 'hidden',
    flexDirection: 'row',
    gap: 2
  },
  mixLegendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg
  },
  mixLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  mixDot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  mixLegendLabel: {
    fontSize: typography.sizes.caption,
    fontWeight: '600',
    fontVariant: ['tabular-nums']
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm
  },
  presetBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1
  },
  presetBtnText: {
    fontSize: typography.sizes.caption,
    fontWeight: '600'
  },
  topicList: {
    gap: spacing.md,
    marginTop: spacing.xs
  },
  topicRow: {
    gap: 6
  },
  topicHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm
  },
  topicLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    flex: 1
  },
  topicLabel: {
    fontSize: typography.sizes.bodySmall,
    fontWeight: '600'
  },
  deltaPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill
  },
  deltaPillText: {
    fontSize: typography.sizes.micro,
    fontWeight: '700',
    fontVariant: ['tabular-nums']
  },
  topicControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  topicPct: {
    fontSize: typography.sizes.caption,
    fontWeight: '700',
    minWidth: 36,
    textAlign: 'right',
    fontVariant: ['tabular-nums']
  },
  stepBtn: {
    width: 26,
    height: 26,
    borderRadius: radius.full,
    borderWidth: 1,
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
  signalBlock: {
    gap: spacing.sm
  },
  signalGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  signalGroupTitle: {
    fontSize: typography.sizes.bodySmall,
    fontWeight: '600'
  },
  emptySignalText: {
    fontSize: typography.sizes.caption
  },
  signalChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1
  },
  signalChipText: {
    fontSize: typography.sizes.caption,
    fontWeight: '600'
  },
  confirmRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    alignItems: 'center'
  }
});
