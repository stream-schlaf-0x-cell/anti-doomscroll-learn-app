import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Linking,
  Modal,
  ScrollView,
  useWindowDimensions,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScoredFeedItem, areFeedCardPropsEqual } from '../../core/domain/ranking';
import {
  formatVerifiedProvenanceLabel,
  ReadingInteraction,
  TOPIC_SPACE_MAP,
  TopicTag
} from '../../core/domain/types';
import { getCardRenderableText } from '../../core/enrichment/batchEnricher';
import { useAppActions } from '../../core/context/AppContext';
import { getThemeColors, ThemePalette, typography, radius, spacing } from '../theme';
import { stripLeadingTitleDuplicate } from '../../core/utils/textUtils';
import { MusicTrackCard } from './MusicTrackCard';
import { CURATED_SOUND_MASTERS, MusicTrackItem } from '../../core/music/musicRecommendationService';
import {
  optimizeImageUrl,
  upgradeImageResolutionUrl,
  assessEditorialImage,
  isTrustedMuseumOrArtDomain
} from '../../core/utils/imageQuality';
import { detectChannelArchetype } from '../../core/ingestion/subchannelFlourishService';
import { SubchannelBadge } from './SubchannelBadge';
import { formatRelativeTime } from '../../core/feed/feedPresentation';
import { hivemindLearningService } from '../../core/learning/hivemindLearningService';
import { QuizCheckpointCard } from './QuizCheckpointCard';

export { areFeedCardPropsEqual, stripLeadingTitleDuplicate, formatRelativeTime };

const ESCALATION_VISUAL_THEMES: Record<1 | 2 | 3 | 4, {
  bg: string;
  border: string;
  accent: string;
  glowBg: string;
  icon: string;
  badgeText: string;
  energyTitle: string;
}> = {
  1: {
    bg: '#141833',
    border: '#6366F1',
    accent: '#818CF8',
    glowBg: 'rgba(99, 102, 241, 0.22)',
    icon: 'sparkles-outline',
    badgeText: 'Stufe 1',
    energyTitle: 'Indigo-Funke'
  },
  2: {
    bg: '#092B3A',
    border: '#06B6D4',
    accent: '#22D3EE',
    glowBg: 'rgba(6, 182, 212, 0.24)',
    icon: 'git-network-outline',
    badgeText: 'Stufe 2',
    energyTitle: 'Cyan-Synapse'
  },
  3: {
    bg: '#2A1048',
    border: '#A855F7',
    accent: '#C084FC',
    glowBg: 'rgba(168, 85, 247, 0.26)',
    icon: 'planet-outline',
    badgeText: 'Stufe 3',
    energyTitle: 'Violett-Kortex'
  },
  4: {
    bg: '#3B1A06',
    border: '#F59E0B',
    accent: '#FBBF24',
    glowBg: 'rgba(245, 158, 11, 0.30)',
    icon: 'sunny',
    badgeText: 'Stufe 4',
    energyTitle: 'Supernova-Erwachen'
  }
};

export interface FeedCardProps {
  item: ScoredFeedItem;
  interaction?: ReadingInteraction;
  isDark?: boolean;
  palette?: ThemePalette;
  enableSoundGrounding?: boolean;
  isHero?: boolean;
  isFocused?: boolean;
  isExpanded?: boolean;
  onToggleKurzCheck?: () => void;
  onInvestigateTopic?: (topic: TopicTag) => void;
  onDismissItem?: (item: ScoredFeedItem) => void;
  onOpenHivemindTrack?: (trackId: string) => void;
  onCompleteHivemindStep?: (trackId: string, itemId: string) => void;
  hivemindTrackProgressPercent?: number;
  hivemindProgressPercent?: number;
  isHivemindStepCompleted?: boolean;
  isCompletedHivemindStep?: boolean;
}

export function formatHonestTimeLabel(item: ScoredFeedItem): string {
  if (item.publicationDateReliable === false || item.format === 'art_showcase' || item.format === 'meme' || item.space === 'c/memes') {
    if (item.historicalYearOrEra) return item.historicalYearOrEra;
    if (item.artMeta?.year) return `Werk · ${item.artMeta.year}`;
    if (item.format === 'art_showcase') return 'Meisterwerk';
    if (item.format === 'meme' || item.space === 'c/memes') return 'Klassiker';
    if (item.firstSeenAt) {
      try {
        return `In Atmen seit ${new Date(item.firstSeenAt).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })}`;
      } catch {
        return 'Zeitlos';
      }
    }
    return 'Zeitlos';
  }
  return formatRelativeTime(item.publishedAt);
}

export function formatCuratedLabel(curatedAt?: string): string {
  if (!curatedAt) return '✨ Frisch kuratiert';
  try {
    const diffMs = Date.now() - new Date(curatedAt).getTime();
    if (diffMs < 0 || diffMs < 1000 * 60 * 2) return '✨ Frisch kuratiert · gerade eben';
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    if (diffMinutes < 60) return `✨ Kuratiert vor ${diffMinutes} Min.`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `✨ Kuratiert vor ${diffHours} Std.`;
    return `✨ Kuratiert am ${new Date(curatedAt).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })}`;
  } catch {
    return '✨ Frisch kuratiert';
  }
}

function isAuthenticCardImage(item: ScoredFeedItem): boolean {
  if (!item.imageUrl || item.imageUrl.trim().length === 0) return false;
  if (item.hasAuthenticImage === false) return false;
  // Never treat generic Unsplash stock placeholders as authentic article images
  if (item.imageUrl.includes('images.unsplash.com')) return false;
  return true;
}

const FeedCardInner: React.FC<FeedCardProps> = ({
  item,
  interaction: propInteraction,
  isDark = false,
  palette = 'tidalglass',
  enableSoundGrounding = true,
  isHero = false,
  isFocused = false,
  onInvestigateTopic,
  onDismissItem,
  onOpenHivemindTrack,
  onCompleteHivemindStep,
  hivemindTrackProgressPercent,
  hivemindProgressPercent,
  isHivemindStepCompleted,
  isCompletedHivemindStep
}) => {
  const resolvedTrackProgress = hivemindTrackProgressPercent ?? hivemindProgressPercent;
  const resolvedStepCompleted = isHivemindStepCompleted ?? isCompletedHivemindStep;
  const { width } = useWindowDimensions();
  const isDesktop = width >= 960;
  const colors = useMemo(() => getThemeColors(isDark ? 'dark' : 'light', palette), [isDark, palette]);
  const {
    toggleSaveItem,
    openArticle,
    voteItem,
    dismissItem,
    scheduleCloudSyncPush
  } = useAppActions();

  const [imageError, setImageError] = useState(false);
  const [imageRejected, setImageRejected] = useState(false);
  const [usedFallbackUrl, setUsedFallbackUrl] = useState(false);
  const [showImageLightbox, setShowImageLightbox] = useState(false);
  const [naturalAspectRatio, setNaturalAspectRatio] = useState<number | null>(null);
  const [showSimulatedReplies, setShowSimulatedReplies] = useState(false);
  const [markedHivemindDone, setMarkedHivemindDone] = useState<boolean>(Boolean(resolvedStepCompleted));
  const [dynamicTrackProgress, setDynamicTrackProgress] = useState<number | undefined>(resolvedTrackProgress);

  const hivemindTrackId = item.hivemindMeta?.trackId || item.memeMeta?.trackId;
  const hivemindTrackTitle = item.hivemindMeta?.trackTitle || item.sourceBroadcasterName?.replace(/^Lernpfad:\s*/i, '') || 'Lernpfad';
  const hivemindStepIndex = item.hivemindMeta?.stepIndex || item.memeMeta?.stepIndex || 1;
  const hivemindTotalSteps = item.hivemindMeta?.totalSteps || item.memeMeta?.totalSteps || 12;
  const hivemindArchetype = item.hivemindMeta?.cardArchetype || item.memeMeta?.cardArchetype;
  const escalationStages = item.hivemindMeta?.escalationStages || item.memeMeta?.escalationStages;
  const simulatedReplies = item.hivemindMeta?.simulatedReplies || item.memeMeta?.simulatedReplies;

  useEffect(() => {
    setMarkedHivemindDone(Boolean(resolvedStepCompleted));
  }, [resolvedStepCompleted, item.id]);

  useEffect(() => {
    setDynamicTrackProgress(resolvedTrackProgress);
  }, [resolvedTrackProgress]);

  const handleMarkHivemindCompleted = async () => {
    if (!hivemindTrackId) return;
    setMarkedHivemindDone(true);
    if (onCompleteHivemindStep) {
      onCompleteHivemindStep(hivemindTrackId, item.id);
    }
    const updatedTrack = await hivemindLearningService.markItemCompleted(hivemindTrackId, item.id);
    if (updatedTrack) {
      setDynamicTrackProgress(updatedTrack.progressPercent);
    }
    scheduleCloudSyncPush();
  };

  useEffect(() => {
    setImageError(false);
    setImageRejected(false);
    setUsedFallbackUrl(false);
  }, [item.imageUrl, item.id]);

  // Web Escape key listener to exit fullscreen lightbox effortlessly
  useEffect(() => {
    if (!showImageLightbox || Platform.OS !== 'web' || typeof window === 'undefined') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowImageLightbox(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showImageLightbox]);

  const originalUrl = item.canonicalUrl || item.sourceReferences[0]?.originalUrl;

  const matchedMusicTrack: MusicTrackItem | undefined =
    item.primaryTopic === 'sound_synthesis'
      ? CURATED_SOUND_MASTERS[
          Math.abs(item.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)) %
            CURATED_SOUND_MASTERS.length
        ]
      : undefined;

  const handleOpenOriginalSource = () => {
    if (!originalUrl) return;
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.open) {
      window.open(originalUrl, '_blank', 'noopener,noreferrer');
    } else {
      void Linking.openURL(originalUrl).catch(() => {});
    }
  };

  const interaction = propInteraction;
  const isSaved = interaction?.saved ?? false;
  const progress = interaction?.progressPercent ?? 0;
  const isCompleted = interaction?.completedAt !== undefined || progress >= 95;
  const voteScore = interaction?.voteScore ?? 0;

  // Space metadata (colorful Reddit-like community identity)
  const spaceMeta = TOPIC_SPACE_MAP[item.primaryTopic as TopicTag];
  const spaceName = item.space || spaceMeta?.space || `c/${item.primaryTopic}`;
  const spaceColor = spaceMeta?.color || colors.accent;

  const rawPublisherName =
    item.sourceBroadcasterName ||
    item.sourceReferences[0]?.publisher ||
    item.sourceReferences[0]?.author ||
    'Fachquelle';
  const publisherName = rawPublisherName.replace(/^www\./i, '');
  const timeAgo = formatHonestTimeLabel(item);
  const provenanceLabel = formatVerifiedProvenanceLabel(item);

  const displayFeedText = useMemo(() => {
    const raw = getCardRenderableText(item);
    return stripLeadingTitleDuplicate(raw, item.title);
  }, [item]);

  // Determine whether this card is a 20-second quick card (readable in full right on the card)
  const isMemeCard = item.format === 'meme' || item.space === 'c/memes' || item.primaryTopic === 'memes_satire' || Boolean(item.memeMeta);
  // Universal archetype detection: any visual_gallery channel renders artwork-first (never hardcoded to one channel)
  const isVisualGalleryArchetype =
    !isMemeCard &&
    Boolean(item.imageUrl) &&
    detectChannelArchetype({ handle: spaceName, primaryTopic: item.primaryTopic }) === 'visual_gallery';
  const isArtCard = item.format === 'art_showcase' || isVisualGalleryArchetype || Boolean(item.artMeta);
  const isTrustedArtImage = isTrustedMuseumOrArtDomain(item.artMeta?.highResImageUrl || item.imageUrl);
  const isQuick20sCard =
    !isArtCard &&
    (isMemeCard ||
      item.format === 'concise_insight' ||
      (item.wordCount !== undefined && item.wordCount <= 95) ||
      (displayFeedText.length <= 420 && (item.articleBody || displayFeedText).length <= 460));

  const editorialAssessment = useMemo(() => {
    return assessEditorialImage(item.imageUrl, {
      format: item.format,
      title: item.title,
      isMeme: isMemeCard
    });
  }, [item.imageUrl, item.format, item.title, isMemeCard]);

  const rawArtUri = item.artMeta?.highResImageUrl || item.imageUrl || '';
  const rawItemUri = item.imageUrl || '';
  const upgradedItemUri = useMemo(() => {
    if (!rawItemUri) return undefined;
    return isMemeCard ? optimizeImageUrl(rawItemUri) : upgradeImageResolutionUrl(rawItemUri, 1080);
  }, [rawItemUri, isMemeCard]);

  const showAuthenticImage =
    !isArtCard &&
    !imageError &&
    !imageRejected &&
    isAuthenticCardImage(item) &&
    editorialAssessment.isValid &&
    Boolean(upgradedItemUri);

  const activeVisualUri = isArtCard
    ? (usedFallbackUrl ? rawArtUri : (optimizeImageUrl(rawArtUri, 1200) || rawArtUri))
    : showAuthenticImage
    ? (usedFallbackUrl ? rawItemUri : (upgradedItemUri || rawItemUri))
    : '';

  const hasValidImage = Boolean(activeVisualUri) && !imageError && !imageRejected;

  const handleImageError = () => {
    const rawUri = isArtCard ? rawArtUri : rawItemUri;
    if (!usedFallbackUrl && rawUri && activeVisualUri !== rawUri) {
      setUsedFallbackUrl(true);
    } else {
      setImageError(true);
      setImageRejected(true);
    }
  };

  // Dynamically measure real image dimensions; reject blurry low-res thumbnails (< 380x200)
  useEffect(() => {
    if (!activeVisualUri) return;
    let cancelled = false;
    Image.getSize(
      activeVisualUri,
      (w, h) => {
        if (!cancelled && w > 0 && h > 0) {
          if (!isMemeCard && !isArtCard && !isTrustedArtImage && (w < 380 || h < 200)) {
            setImageRejected(true);
            return;
          }
          setNaturalAspectRatio(w / h);
        }
      },
      () => {
        // Handled by onError / onLoad on <Image>
      }
    );
    return () => {
      cancelled = true;
    };
  }, [activeVisualUri, isMemeCard, isArtCard, isTrustedArtImage]);

  // Defensive check: hide subtitle if feedText, title, or metadata already says the same thing
  const isSubtitleRedundant = useMemo(() => {
    if (!item.subtitle) return true;
    const cleanSub = item.subtitle.replace(/[.…\s]+$/, '').trim().toLowerCase();
    if (cleanSub.length < 12) return true;
    if (cleanSub.includes('hn-punkte') || cleanSub.includes('hacker news') || cleanSub.includes('redaktion')) {
      return true;
    }
    const cleanTitle = item.title.trim().toLowerCase();
    if (cleanTitle.includes(cleanSub.slice(0, Math.min(30, cleanSub.length)))) return true;
    if (!displayFeedText) return false;
    const cleanFeed = displayFeedText.trim().toLowerCase();
    const prefixLen = Math.min(36, cleanSub.length);
    return cleanFeed.startsWith(cleanSub.slice(0, prefixLen));
  }, [item.subtitle, item.title, displayFeedText]);

  // Essence + Key Takeaway Highlight: Distinct keyInsight that does not duplicate title or feedText
  const distinctKeyInsight = useMemo(() => {
    if (!item.keyInsight || typeof item.keyInsight !== 'string') return null;
    const cleanKey = item.keyInsight.trim();
    if (cleanKey.length < 15) return null;
    if (/^(Begutachtete\s+Open-Access-Studie|Open-Access-Forschungsarbeit|Peer-Reviewed\s+(Open-Access|Study)|Aus\s+(der\s+)?Zeitschrift\b|Originalbeitrag\s+veröffentlicht\s+bei)/i.test(cleanKey)) {
      return null;
    }
    const normKey = cleanKey.toLowerCase();
    const normTitle = (item.title || '').toLowerCase();
    const normFeed = (displayFeedText || '').toLowerCase();
    if (normTitle.includes(normKey) || normKey.includes(normTitle)) return null;
    if (normFeed.includes(normKey) || (normKey.length > 25 && normFeed.slice(0, 80).includes(normKey.slice(0, 30)))) return null;
    return cleanKey;
  }, [item.keyInsight, item.title, displayFeedText]);

  // Hide boilerplate feedText when it merely repeats HN metadata or comic alt-text punchline
  const shouldShowBodyText = Boolean(displayFeedText);

  const handleCardPress = () => {
    openArticle(item.id);
  };

  const handleUpvote = () => {
    if (voteScore === 1) {
      void voteItem(item.id, 'clear');
    } else {
      void voteItem(item.id, 'up');
    }
  };

  const handleDownvote = () => {
    if (voteScore === -1) {
      void voteItem(item.id, 'clear');
    } else {
      void voteItem(item.id, 'down');
    }
  };

  // Single compact badge only when meaningful (never duplicate "Originalauszug" + "RSS-Originalauszug")
  const compactBadge = useMemo(() => {
    if (item.aiAssisted) {
      return { label: '🤖 KI', color: '#10B981', bg: 'rgba(16, 185, 129, 0.14)' };
    }
    if (item.sourceTrustLevel === 'peer_reviewed') {
      return { label: '🔬 Studie', color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.12)' };
    }
    if (item.sourceTrustLevel === 'museum_collection') {
      return { label: '🏛️ Museum', color: '#D97706', bg: 'rgba(245, 158, 11, 0.14)' };
    }
    return null;
  }, [item.aiAssisted, item.sourceTrustLevel]);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: isHero ? colors.cardHighlight : colors.surface,
          borderColor: isFocused ? spaceColor : isHero ? spaceColor : colors.borderSubtle,
          borderLeftColor: spaceColor,
          borderLeftWidth: 3.5
        },
        isHero && styles.heroCard
      ]}
    >
      {/* 1. SINGLE-LINE REDDIT HEADER: [c/space] (flexShrink: 0) • Publisher • Time */}
      <View style={styles.topHeaderRow}>
        <View style={styles.topLeftMeta}>
          <SubchannelBadge
            space={spaceName}
            primaryTopic={item.primaryTopic as TopicTag}
            accentColor={item.space ? undefined : spaceColor}
            onPress={() => onInvestigateTopic && onInvestigateTopic(item.primaryTopic)}
          />

          {!hivemindTrackId && (
            <>
              <Text style={[styles.dotSeparator, { color: colors.textMuted }]}>•</Text>
              <Text style={[styles.publisherText, { color: colors.textPrimary }]} numberOfLines={1}>
                {publisherName}
              </Text>
            </>
          )}
          <Text style={[styles.dotSeparator, { color: colors.textMuted }]}>•</Text>
          <Text style={[styles.timeText, { color: colors.textMuted }]} numberOfLines={1}>
            {timeAgo}
            {!isQuick20sCard && item.estimatedReadingMinutes > 1 ? ` · ${item.estimatedReadingMinutes}m` : ''}
          </Text>

          {(Boolean(item.isNewlyArrived) ||
            (typeof item.pinnedManualRunAt === 'number' && (Date.now() - item.pinnedManualRunAt) <= 30 * 60 * 1000)) && (
            <>
              <Text style={[styles.dotSeparator, { color: colors.textMuted }]}>•</Text>
              <View style={[styles.neuBadge, { backgroundColor: colors.accentSubtle, borderColor: colors.accent }]}>
                <Text style={[styles.neuBadgeText, { color: colors.accent }]}>✨ Neu</Text>
              </View>
            </>
          )}
        </View>

        {compactBadge && (
          <View style={styles.topRightActions}>
            <View
              style={[
                styles.provenancePill,
                {
                  backgroundColor: compactBadge.bg,
                  borderColor: colors.borderSubtle
                }
              ]}
            >
              <Text
                style={[
                  styles.provenancePillText,
                  { color: compactBadge.color }
                ]}
                numberOfLines={1}
              >
                {compactBadge.label}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Virtual Newsroom / Editorial Origin Badges */}
      {hivemindTrackId && (
        <TouchableOpacity
          activeOpacity={0.82}
          onPress={() => {
            if (onOpenHivemindTrack) {
              onOpenHivemindTrack(hivemindTrackId);
            }
          }}
          style={[
            styles.hivemindTrackPill,
            {
              backgroundColor: markedHivemindDone ? 'rgba(16, 185, 129, 0.14)' : colors.accentSubtle,
              borderColor: markedHivemindDone ? '#10B981' : colors.accent
            }
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Lernpfad ${hivemindTrackTitle} im Fokus-Modus öffnen`}
        >
          <Text style={{ fontSize: 12, marginRight: 5 }}>🧠</Text>
          <Text
            style={[
              styles.hivemindTrackPillText,
              { color: markedHivemindDone ? '#10B981' : colors.accent }
            ]}
            numberOfLines={1}
          >
            Lernpfad: {hivemindTrackTitle} · Schritt {hivemindStepIndex}/{hivemindTotalSteps}
            {typeof dynamicTrackProgress === 'number'
              ? ` (${dynamicTrackProgress}%)`
              : ` (${Math.round(((hivemindStepIndex - 1) / Math.max(1, hivemindTotalSteps)) * 100)}%)`}
          </Text>
          <Ionicons
            name="chevron-forward"
            size={12}
            color={markedHivemindDone ? '#10B981' : colors.accent}
            style={{ marginLeft: 4 }}
          />
        </TouchableOpacity>
      )}

      {Boolean(item.recommendedBecauseOfTitle) && (
        <View style={[styles.editorialBadgeRow, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
          <Ionicons name="link-outline" size={12} color={colors.accent} style={{ marginRight: 4 }} />
          <Text style={[styles.editorialBadgeText, { color: colors.textSecondary }]} numberOfLines={1}>
            🔗 Vertiefung zu deinem Upvote: „{item.recommendedBecauseOfTitle}“
          </Text>
        </View>
      )}

      {Boolean(item.isStoryDossier && item.corroboratingSources && item.corroboratingSources.length > 0) && (
        <View
          style={[
            styles.editorialBadgeRow,
            {
              backgroundColor: colors.surfaceSecondary,
              borderColor: colors.borderSubtle,
              maxWidth: '100%',
              flexShrink: 1,
              overflow: 'hidden',
              alignSelf: 'flex-start'
            }
          ]}
        >
          <Ionicons name="newspaper-outline" size={12} color={colors.accent} style={{ marginRight: 4, flexShrink: 0 }} />
          <Text
            style={[styles.editorialBadgeText, { color: colors.textSecondary, flexShrink: 1 }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            Themen-Dossier · Auch beleuchtet von: {item.corroboratingSources!.map(s => s.publisher).join(', ')}
          </Text>
        </View>
      )}

      {/* 2. HEADLINE & NON-REDUNDANT SUBTITLE */}
      <TouchableOpacity activeOpacity={0.85} onPress={handleCardPress}>
        <Text
          style={[
            styles.title,
            isHero ? styles.heroTitle : styles.standardTitle,
            { color: colors.textPrimary }
          ]}
        >
          {item.title}
        </Text>

        {!isSubtitleRedundant && item.subtitle && (hasValidImage || !shouldShowBodyText) && (
          <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={2}>
            {item.subtitle}
          </Text>
        )}
      </TouchableOpacity>

      {/* 3. AUTHENTIC VISUALS: Uncropped Comics, Museum Artworks & High-Res Science/Editorial Photos */}
      {isArtCard && (item.artMeta?.highResImageUrl || item.imageUrl) && !imageError && (
        <View style={[styles.artContainer, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
          <TouchableOpacity
            activeOpacity={0.95}
            onPress={() => setShowImageLightbox(true)}
            style={[
              styles.artImageWrapper,
              naturalAspectRatio
                ? { aspectRatio: naturalAspectRatio, maxHeight: isDesktop ? 520 : 420 }
                : { height: isDesktop ? 400 : 320 }
            ]}
          >
            <Image
              source={{ uri: activeVisualUri }}
              style={styles.artImage}
              resizeMode="contain"
              onError={handleImageError}
            />
            <View style={styles.zoomBadgeOverlay}>
              <Ionicons name="expand-outline" size={12} color="#FFFFFF" style={{ marginRight: 4 }} />
              <Text style={styles.zoomBadgeText}>Vollbild</Text>
            </View>
            <View style={styles.artMuseumPlaque}>
              <Ionicons name="color-palette" size={14} color="#F59E0B" style={{ marginRight: 6 }} />
              <Text style={styles.artMuseumPlaqueText} numberOfLines={1}>
                {item.artMeta?.artist || publisherName}{' '}
                {item.artMeta?.year ? `(${item.artMeta.year})` : ''} •{' '}
                {item.artMeta?.museum || 'Museums-Sammlung'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {showAuthenticImage && (
        <TouchableOpacity
          activeOpacity={0.92}
          onPress={() => (isMemeCard ? setShowImageLightbox(true) : handleCardPress())}
          style={[
            isMemeCard ? styles.comicStageContainer : styles.imageContainer,
            isMemeCard
              ? { aspectRatio: naturalAspectRatio || 1.25 }
              : naturalAspectRatio
              ? naturalAspectRatio >= 1.15
                ? { height: undefined, aspectRatio: Math.min(2.2, naturalAspectRatio), maxHeight: isDesktop ? 400 : 320 }
                : naturalAspectRatio >= 0.85
                ? { height: undefined, aspectRatio: naturalAspectRatio, maxHeight: 340, width: '100%', alignSelf: 'center' }
                : { height: undefined, aspectRatio: Math.max(0.65, naturalAspectRatio), maxHeight: 380, width: '100%', alignSelf: 'center' }
              : { height: undefined, aspectRatio: 16 / 9, maxHeight: 300, backgroundColor: colors.surfaceSecondary }
          ]}
        >
          <Image
            source={{ uri: activeVisualUri }}
            style={[
              styles.cardImage,
              isMemeCard && styles.comicImage,
              { objectPosition: editorialAssessment.objectPosition || 'top center' } as any
            ]}
            resizeMode={isMemeCard || isArtCard || editorialAssessment.category === 'comic' || editorialAssessment.category === 'square_photo' ? 'contain' : 'cover'}
            onLoad={(e) => {
              const { width: loadedW, height: loadedH } = e.nativeEvent.source;
              if (loadedW > 0 && loadedH > 0) {
                if (!isMemeCard && !isArtCard && !isTrustedArtImage && (loadedW < 380 || loadedH < 200)) {
                  setImageRejected(true);
                  return;
                }
                setNaturalAspectRatio(loadedW / loadedH);
              }
            }}
            onError={handleImageError}
          />
          {isMemeCard && (
            <View style={styles.zoomBadgeOverlay}>
              <Ionicons name="expand-outline" size={12} color="#FFFFFF" style={{ marginRight: 4 }} />
              <Text style={styles.zoomBadgeText}>Comic vergrößern</Text>
            </View>
          )}
          {item.imageCredit && (
            <View style={styles.imageCreditOverlay}>
              <Text style={styles.imageCreditText} numberOfLines={1}>
                {item.imageCredit}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      )}

      {/* 4. ADAPTIVE CARD BODY: Clean 3-4 line readable excerpt (AI Summary & Deep Tools open on click in ReaderScreen) */}
      {shouldShowBodyText && Boolean(displayFeedText) && (
        <TouchableOpacity activeOpacity={0.92} onPress={handleCardPress}>
          <Text
            style={[
              styles.feedText,
              isQuick20sCard && styles.quick20sFeedText,
              { color: colors.textPrimary }
            ]}
            numberOfLines={isQuick20sCard ? 3 : hasValidImage ? 3 : 4}
          >
            {displayFeedText}
          </Text>
        </TouchableOpacity>
      )}

      {/* Essence + Key Takeaway Highlight Bar */}
      {distinctKeyInsight && (
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={handleCardPress}
          style={[
            styles.keyInsightCallout,
            { backgroundColor: colors.accentSubtle, borderLeftWidth: 3, borderLeftColor: colors.accent }
          ]}
        >
          <Text style={[styles.keyInsightLabel, { color: colors.accent }]}>
            💡 Kernaussage
          </Text>
          <Text style={[styles.keyInsightText, { color: colors.textPrimary }]} numberOfLines={2}>
            {distinctKeyInsight}
          </Text>
        </TouchableOpacity>
      )}

      {/* Native 4-Stage Visual Concept-Meme Grid (Work Package 2) */}
      {escalationStages && escalationStages.length >= 3 && (
        <View style={[styles.escalationGridContainer, { borderColor: colors.borderSubtle }]}>
          {escalationStages.map((stage, sIdx) => {
            const levelKey = (Math.min(4, Math.max(1, stage.visualLevel || (sIdx + 1))) as 1 | 2 | 3 | 4);
            const vTheme = ESCALATION_VISUAL_THEMES[levelKey];
            return (
              <View
                key={`${item.id}-esc-${sIdx}`}
                style={[
                  styles.escalationRow,
                  {
                    borderBottomWidth: sIdx < escalationStages.length - 1 ? 1 : 0,
                    borderBottomColor: colors.borderSubtle,
                    backgroundColor: colors.surface
                  }
                ]}
              >
                {/* Left Column (62% width): Bold editorial statement */}
                <View style={styles.escalationLeftCol}>
                  <Text style={[styles.escalationStageLabel, { color: vTheme.accent }]}>
                    {stage.stageLabel || `${vTheme.badgeText} · ${vTheme.energyTitle}`}
                  </Text>
                  <Text style={[styles.escalationCaptionText, { color: colors.textPrimary }]}>
                    {stage.caption}
                  </Text>
                </View>

                {/* Right Column (38% width): Luminous Cosmic / Neural Stage Panel */}
                <View
                  style={[
                    styles.escalationRightCol,
                    {
                      backgroundColor: vTheme.bg,
                      borderLeftColor: vTheme.border
                    }
                  ]}
                >
                  <View style={[styles.escalationGlowOrb, { backgroundColor: vTheme.glowBg, borderColor: vTheme.border }]}>
                    <Ionicons name={vTheme.icon as any} size={22} color={vTheme.accent} />
                  </View>
                  <Text style={[styles.escalationVisualBadge, { color: vTheme.accent }]}>
                    {vTheme.badgeText}
                  </Text>
                  <Text style={styles.escalationVisualSubtitle} numberOfLines={1}>
                    {vTheme.energyTitle}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Inline Milestone Quiz on Hivemind Milestone Cards */}
      {hivemindArchetype === 'milestone_quiz' && item.quiz && (
        <View style={{ marginVertical: 6 }}>
          <QuizCheckpointCard
            questions={[item.quiz]}
            compact={true}
          />
        </View>
      )}

      {/* Inline Expandable Community Replies (💬 X Antworten anzeigen) */}
      {simulatedReplies && simulatedReplies.length > 0 && (
        <View style={styles.simulatedRepliesWrapper}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setShowSimulatedReplies(prev => !prev)}
            style={[
              styles.simulatedRepliesToggleBtn,
              {
                backgroundColor: colors.surfaceSecondary,
                borderColor: showSimulatedReplies ? colors.accent : colors.borderSubtle
              }
            ]}
            accessibilityRole="button"
            accessibilityLabel={`${simulatedReplies.length} Antworten anzeigen`}
          >
            <Text style={{ fontSize: 13, marginRight: 6 }}>💬</Text>
            <Text style={[styles.simulatedRepliesToggleText, { color: colors.textPrimary }]}>
              {simulatedReplies.length} Antworten aus dem Lern-Salon anzeigen
            </Text>
            <Ionicons
              name={showSimulatedReplies ? 'chevron-up' : 'chevron-down'}
              size={15}
              color={colors.accent}
              style={{ marginLeft: 'auto' }}
            />
          </TouchableOpacity>

          {showSimulatedReplies && (
            <View style={styles.simulatedRepliesList}>
              {simulatedReplies.map((rep, rIdx) => (
                <View
                  key={`${item.id}-rep-${rIdx}`}
                  style={[
                    styles.simulatedReplyCard,
                    {
                      backgroundColor: colors.surfaceSecondary,
                      borderColor: colors.borderSubtle,
                      borderLeftColor: colors.accent
                    }
                  ]}
                >
                  <View style={styles.simulatedReplyHeader}>
                    <Text style={[styles.simulatedReplyHandle, { color: colors.textPrimary }]}>
                      {rep.handle}
                    </Text>
                    <View style={[styles.simulatedReplyBadge, { backgroundColor: colors.accentSubtle }]}>
                      <Text style={[styles.simulatedReplyBadgeText, { color: colors.accent }]}>
                        {rep.roleBadge}
                      </Text>
                    </View>
                    <Text style={[styles.simulatedReplyUpvotes, { color: colors.textMuted }]}>
                      ▲ {rep.upvotes}
                    </Text>
                  </View>
                  <Text style={[styles.simulatedReplyBody, { color: colors.textPrimary }]}>
                    {rep.text}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Special Format Compact Callout: Comic Alt-Text Bonus Punchline / Book Thesis / Sound Track */}
      {item.memeMeta && !(escalationStages && escalationStages.length >= 3) && (
        <View style={[styles.compactCallout, { backgroundColor: colors.surfaceSecondary, borderLeftColor: spaceColor }]}>
          <Text style={[styles.compactCalloutLabel, { color: spaceColor }]}>
            🎁 {item.memeMeta.satireContext || 'Bonus-Punchline (Alt-Text)'}
          </Text>
          <Text style={[styles.compactCalloutText, { color: colors.textPrimary }]}>
            „{item.memeMeta.punchline}“
          </Text>
        </View>
      )}

      {item.bookMeta && (
        <View style={[styles.compactCallout, { backgroundColor: colors.surfaceSecondary, borderLeftColor: '#A855F7' }]}>
          <Text style={[styles.compactCalloutLabel, { color: '#A855F7' }]}>
            📚 {item.bookMeta.author} • ★ {item.bookMeta.rating}/5
          </Text>
          <Text style={[styles.compactCalloutText, { color: colors.textPrimary, fontStyle: 'italic' }]}>
            „{item.bookMeta.oneSentenceThesis}“
          </Text>
        </View>
      )}

      {matchedMusicTrack && enableSoundGrounding && <MusicTrackCard track={matchedMusicTrack} />}

      {/* 8. READING PROGRESS BAR (When partially read) */}
      {progress > 0 && !isCompleted && (
        <View style={[styles.progressTrack, { backgroundColor: colors.surfaceSecondary }]}>
          <View style={[styles.progressBar, { width: `${progress}%`, backgroundColor: spaceColor }]} />
        </View>
      )}

      {/* 9. SINGLE-ROW CARD FOOTER: [ ↑ Vote ↓ ] · [ domain.de ↗ ] · [ 🚫 Weniger ] · [ 🔖 ] */}
      <View style={[styles.actionBar, { borderTopColor: colors.borderSubtle }]}>
        {/* Left: Compact Vote Pill */}
        <View style={[styles.votePill, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
          <TouchableOpacity
            onPress={handleUpvote}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }}
            style={styles.voteBtn}
            accessibilityLabel="Mehr davon (Upvote)"
          >
            <Ionicons
              name={voteScore === 1 ? 'arrow-up-circle' : 'arrow-up-outline'}
              size={17}
              color={voteScore === 1 ? '#FF4500' : colors.textMuted}
            />
          </TouchableOpacity>

          <Text
            style={[
              styles.voteLabel,
              {
                color:
                  voteScore === 1
                    ? '#FF4500'
                    : voteScore === -1
                    ? '#7193FF'
                    : colors.textSecondary
              }
            ]}
            numberOfLines={1}
          >
            {item.externalCommunityScore && item.externalCommunityScore.points > 0
              ? `${item.externalCommunityScore.points + voteScore}`
              : ((item.upvotesCount ?? 0) > 0 || voteScore !== 0)
              ? `${Math.max(0, (item.upvotesCount ?? 0) + (voteScore === 1 ? 1 : voteScore === -1 ? -1 : 0))}`
              : 'Vote'}
          </Text>

          <TouchableOpacity
            onPress={handleDownvote}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
            style={styles.voteBtn}
            accessibilityLabel="Weniger davon (Downvote)"
          >
            <Ionicons
              name={voteScore === -1 ? 'arrow-down-circle' : 'arrow-down-outline'}
              size={17}
              color={voteScore === -1 ? '#7193FF' : colors.textMuted}
            />
          </TouchableOpacity>
        </View>

        {/* Center: Direct Source Domain Link (or Reader fallback) */}
        {originalUrl ? (
          <TouchableOpacity
            onPress={handleOpenOriginalSource}
            style={[styles.domainChip, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}
            accessibilityRole="link"
            accessibilityLabel="Originalquelle im Browser öffnen"
          >
            <Text style={[styles.actionChipText, { color: colors.textSecondary }]} numberOfLines={1}>
              {(item.sourceDomain ? item.sourceDomain.replace(/^www\./i, '') : 'Quelle')} ↗
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={handleCardPress}
            style={[styles.domainChip, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}
            accessibilityRole="button"
            accessibilityLabel="Im Reader öffnen"
          >
            <Text style={[styles.actionChipText, { color: colors.textSecondary }]} numberOfLines={1}>
              Lesen →
            </Text>
          </TouchableOpacity>
        )}

        {/* Right: [ ✓ Verstanden (Hivemind) ] + [ 🚫 Weniger ] + [ 🔖 Bookmark ] */}
        <View style={styles.footerRightGroup}>
          {hivemindTrackId && (
            <TouchableOpacity
              onPress={() => void handleMarkHivemindCompleted()}
              style={[
                styles.hivemindDoneChip,
                {
                  backgroundColor: markedHivemindDone ? 'rgba(16, 185, 129, 0.16)' : colors.accent,
                  borderColor: markedHivemindDone ? '#10B981' : colors.accent
                }
              ]}
              accessibilityRole="button"
              accessibilityLabel={markedHivemindDone ? 'Schritt bereits gelernt' : 'Verstanden (+Fortschritt)'}
            >
              <Text
                style={[
                  styles.hivemindDoneChipText,
                  { color: markedHivemindDone ? '#10B981' : '#FFFFFF' }
                ]}
                numberOfLines={1}
              >
                {markedHivemindDone ? '✓ Gelernt' : '✓ Verstanden (+Fortschritt)'}
              </Text>
            </TouchableOpacity>
          )}

          {!hivemindTrackId && (
            <TouchableOpacity
              onPress={() => {
                if (onDismissItem) {
                  onDismissItem(item);
                } else {
                  void dismissItem(item.id, item);
                }
              }}
              style={[styles.wenigerChip, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}
              accessibilityRole="button"
              accessibilityLabel="Weniger davon"
            >
              <Text style={[styles.actionChipText, { color: colors.textMuted }]} numberOfLines={1}>
                🚫 Weniger
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={() => toggleSaveItem(item.id)}
            hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
            style={[
              styles.bookmarkBtn,
              {
                backgroundColor: isSaved ? colors.accentSubtle : colors.surfaceSecondary,
                borderColor: isSaved ? colors.accent : colors.borderSubtle
              }
            ]}
            accessibilityLabel={isSaved ? 'Aus Bibliothek entfernen' : 'Merken'}
          >
            <Ionicons
              name={isSaved ? 'bookmark' : 'bookmark-outline'}
              size={15}
              color={isSaved ? colors.accent : colors.textSecondary}
            />
          </TouchableOpacity>

          {isCompleted && (
            <View style={styles.completedBadge}>
              <Ionicons name="checkmark-circle" size={14} color={colors.success} />
            </View>
          )}
        </View>
      </View>

      {/* Fullscreen Comic & Artwork Zoom Lightbox */}
      {Boolean(activeVisualUri) && (
        <Modal
          visible={showImageLightbox}
          transparent
          animationType="fade"
          onRequestClose={() => setShowImageLightbox(false)}
        >
          <View style={styles.lightboxBackdrop}>
            {/* Top-Right Reachable Close Pill (well below iPhone Dynamic Island / Status Bar) */}
            <TouchableOpacity
              onPress={() => setShowImageLightbox(false)}
              style={styles.lightboxTopClosePill}
              hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
              accessibilityRole="button"
              accessibilityLabel="Vollbild schließen"
            >
              <Ionicons name="close" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.lightboxClosePillText}>✕ Schließen</Text>
            </TouchableOpacity>

            <View style={styles.lightboxTopBar} pointerEvents="box-none">
              <View style={{ flex: 1, paddingRight: 130 }}>
                <Text style={styles.lightboxTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.lightboxSub} numberOfLines={1}>
                  {publisherName} • {provenanceLabel}
                </Text>
              </View>
            </View>

            {/* Tap anywhere on backdrop or image to close */}
            <ScrollView
              contentContainerStyle={styles.lightboxScrollContent}
              maximumZoomScale={3}
              minimumZoomScale={1}
              centerContent
            >
              <TouchableOpacity
                activeOpacity={0.95}
                onPress={() => setShowImageLightbox(false)}
                style={[
                  styles.lightboxCanvas,
                  isMemeCard && { backgroundColor: '#FFFFFF', padding: 16, borderRadius: radius.md }
                ]}
                accessibilityRole="button"
                accessibilityLabel="Vollbild durch Antippen schließen"
              >
                <Image
                  source={{ uri: activeVisualUri }}
                  style={[
                    styles.lightboxImage,
                    naturalAspectRatio ? { aspectRatio: naturalAspectRatio } : { height: 540 }
                  ]}
                  resizeMode="contain"
                />
              </TouchableOpacity>

              {item.memeMeta?.punchline && (
                <View style={styles.lightboxPunchlineBox}>
                  <Text style={styles.lightboxPunchlineLabel}>🎁 Bonus-Punchline (Alt-Text):</Text>
                  <Text style={styles.lightboxPunchlineText}>„{item.memeMeta.punchline}“</Text>
                </View>
              )}
            </ScrollView>

            {/* Prominent Bottom Close Pill (Always thumb-reachable on iPhone) */}
            <View style={styles.lightboxBottomBar} pointerEvents="box-none">
              <TouchableOpacity
                onPress={() => setShowImageLightbox(false)}
                style={styles.lightboxBottomClosePill}
                hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                accessibilityRole="button"
                accessibilityLabel="Vollbild schließen"
              >
                <Ionicons name="close-circle" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.lightboxBottomCloseText}>✕ Vollbild schließen</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

export const FeedCard = React.memo(FeedCardInner, areFeedCardPropsEqual);

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2
  },
  heroCard: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    marginBottom: spacing.lg
  },
  topHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8
  },
  topLeftMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    overflow: 'hidden'
  },
  spacePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1
  },
  spaceText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2
  },
  dotSeparator: {
    marginHorizontal: 6,
    fontSize: 11
  },
  publisherText: {
    fontSize: 12,
    fontWeight: '700',
    flexShrink: 1,
    maxWidth: 175
  },
  timeText: {
    fontSize: 11,
    flexShrink: 0
  },
  topRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  provenancePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 0.5,
    maxWidth: 185
  },
  provenancePillText: {
    fontSize: 10,
    fontWeight: '700'
  },
  bookmarkBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 0.5,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0
  },
  title: {
    fontFamily: typography.fontFamilies.serif,
    fontWeight: '700',
    letterSpacing: -0.2,
    marginBottom: 6
  },
  heroTitle: {
    fontSize: 22,
    lineHeight: 29
  },
  standardTitle: {
    fontSize: 18.5,
    lineHeight: 25
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    marginBottom: 8
  },
  imageContainer: {
    width: '100%',
    borderRadius: radius.md,
    overflow: 'hidden',
    marginVertical: 8,
    backgroundColor: '#0F172A',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center'
  },
  comicStageContainer: {
    width: '100%',
    minHeight: 240,
    maxHeight: 640,
    borderRadius: radius.md,
    overflow: 'hidden',
    marginVertical: 8,
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.28)',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center'
  },
  cardImage: {
    width: '100%',
    height: '100%'
  },
  comicImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#FFFFFF'
  },
  zoomBadgeOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center'
  },
  zoomBadgeText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '700'
  },
  imageCreditOverlay: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    maxWidth: '85%'
  },
  imageCreditText: {
    color: '#FFFFFF',
    fontSize: 10
  },
  artContainer: {
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: 'hidden',
    marginVertical: 8
  },
  artImageWrapper: {
    width: '100%',
    minHeight: 280,
    position: 'relative',
    backgroundColor: '#0F172A'
  },
  artImage: {
    width: '100%',
    height: '100%'
  },
  neuBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: radius.pill,
    borderWidth: 0.5,
    alignItems: 'center',
    justifyContent: 'center'
  },
  neuBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.2
  },
  lightboxBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(9, 13, 22, 0.94)',
    position: 'relative'
  },
  lightboxTopClosePill: {
    position: 'absolute',
    top: 56,
    right: 20,
    zIndex: 100,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    borderColor: 'rgba(255, 255, 255, 0.25)',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 8
  },
  lightboxClosePillText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700'
  },
  lightboxBottomBar: {
    position: 'absolute',
    bottom: 48,
    left: 0,
    right: 0,
    zIndex: 100,
    alignItems: 'center',
    justifyContent: 'center'
  },
  lightboxBottomClosePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderWidth: 1.5,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: radius.pill,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10
  },
  lightboxBottomCloseText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
    letterSpacing: 0.3
  },
  lightboxTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.12)'
  },
  lightboxTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700'
  },
  lightboxSub: {
    color: 'rgba(255, 255, 255, 0.68)',
    fontSize: 12,
    marginTop: 2
  },
  lightboxCloseBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12
  },
  lightboxScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  lightboxCanvas: {
    width: '100%',
    maxWidth: 1040,
    justifyContent: 'center',
    alignItems: 'center'
  },
  lightboxImage: {
    width: '100%',
    maxHeight: 820
  },
  lightboxPunchlineBox: {
    marginTop: 16,
    maxWidth: 820,
    width: '100%',
    backgroundColor: 'rgba(30, 41, 59, 0.92)',
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.25)'
  },
  lightboxPunchlineLabel: {
    color: '#38BDF8',
    fontSize: 11.5,
    fontWeight: '700',
    marginBottom: 4
  },
  lightboxPunchlineText: {
    color: '#F8FAFC',
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic'
  },
  artMuseumPlaque: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center'
  },
  artMuseumPlaqueText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
    flex: 1
  },
  editorialBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: radius.sm,
    borderWidth: 1,
    marginBottom: 8
  },
  editorialBadgeText: {
    fontSize: 11.5,
    fontWeight: '600'
  },
  feedText: {
    fontSize: 14.5,
    lineHeight: 22,
    marginBottom: 8
  },
  quick20sFeedText: {
    fontSize: 15,
    lineHeight: 23.5
  },
  keyInsightCallout: {
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 8
  },
  keyInsightLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 2
  },
  keyInsightText: {
    fontSize: 13,
    lineHeight: 18.5,
    fontWeight: '500'
  },
  compactCallout: {
    borderLeftWidth: 3,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8
  },
  compactCalloutLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 2
  },
  compactCalloutText: {
    fontSize: 13,
    lineHeight: 19
  },
  compactCalloutSub: {
    fontSize: 11.5,
    lineHeight: 17,
    marginTop: 3
  },
  kurzCheckBox: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    marginTop: 4,
    marginBottom: 10
  },
  kurzCheckHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  kurzCheckHeaderTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.3,
    textTransform: 'uppercase'
  },
  kurzCheckSection: {
    marginTop: 6
  },
  kurzCheckLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    marginBottom: 2
  },
  kurzCheckText: {
    fontSize: 13,
    lineHeight: 19
  },
  kurzCheckFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10
  },
  tieferGrabenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill
  },
  tieferGrabenBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700'
  },
  composerContainer: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: 10,
    marginTop: 4,
    marginBottom: 10
  },
  composerBox: {
    gap: 8
  },
  composerTitle: {
    fontSize: 12.5,
    fontWeight: '700'
  },
  tagSelectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  tagButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1
  },
  tagButtonText: {
    fontSize: 11,
    fontWeight: '600'
  },
  composerInput: {
    borderRadius: radius.sm,
    borderWidth: 1,
    padding: 8,
    fontSize: 13,
    minHeight: 60,
    textAlignVertical: 'top'
  },
  composerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 10
  },
  composerCancelButton: {
    paddingHorizontal: 8,
    paddingVertical: 5
  },
  composerCancelText: {
    fontSize: 12,
    fontWeight: '600'
  },
  composerSaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill
  },
  composerSaveText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700'
  },
  savedNotesList: {
    gap: 6,
    marginTop: 6
  },
  userNoteItem: {
    padding: 8,
    borderRadius: radius.sm,
    borderWidth: 0.5
  },
  userNoteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 3
  },
  userNoteTagText: {
    fontSize: 11,
    fontWeight: '700'
  },
  userNoteDate: {
    fontSize: 10
  },
  userNoteContent: {
    fontSize: 12.5,
    lineHeight: 18
  },
  progressTrack: {
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8
  },
  progressBar: {
    height: '100%'
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'nowrap',
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 0.5
  },
  votePill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 0.5,
    paddingHorizontal: 7,
    paddingVertical: 3,
    gap: 4,
    flexShrink: 0
  },
  voteBtn: {
    padding: 1
  },
  voteLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    minWidth: 26,
    textAlign: 'center'
  },
  domainChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 0.5,
    flexShrink: 1,
    maxWidth: 175
  },
  footerRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0
  },
  wenigerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 0.5,
    flexShrink: 0
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 0.5,
    maxWidth: 150
  },
  actionChipText: {
    fontSize: 11.5,
    fontWeight: '600',
    maxWidth: 175,
    flexShrink: 1
  },
  completedBadge: {
    marginLeft: 2
  },
  hivemindTrackPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    marginBottom: 8,
    maxWidth: '100%'
  },
  hivemindTrackPillText: {
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.2,
    flexShrink: 1
  },
  escalationGridContainer: {
    width: '100%',
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: 'hidden',
    marginVertical: 8
  },
  escalationRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 88
  },
  escalationLeftCol: {
    width: '62%',
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'center'
  },
  escalationStageLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 4
  },
  escalationCaptionText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
    letterSpacing: 0.15
  },
  escalationRightCol: {
    width: '38%',
    borderLeftWidth: 2,
    paddingHorizontal: 8,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  escalationGlowOrb: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 5
  },
  escalationVisualBadge: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase'
  },
  escalationVisualSubtitle: {
    color: 'rgba(255, 255, 255, 0.78)',
    fontSize: 9.5,
    fontWeight: '600',
    marginTop: 1
  },
  simulatedRepliesWrapper: {
    marginTop: 4,
    marginBottom: 8
  },
  simulatedRepliesToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1
  },
  simulatedRepliesToggleText: {
    fontSize: 12.5,
    fontWeight: '700'
  },
  simulatedRepliesList: {
    marginTop: 8,
    gap: 8
  },
  simulatedReplyCard: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: radius.sm,
    borderWidth: 0.5,
    borderLeftWidth: 3
  },
  simulatedReplyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
    flexWrap: 'wrap'
  },
  simulatedReplyHandle: {
    fontSize: 11.5,
    fontWeight: '700'
  },
  simulatedReplyBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill
  },
  simulatedReplyBadgeText: {
    fontSize: 10,
    fontWeight: '700'
  },
  simulatedReplyUpvotes: {
    fontSize: 10.5,
    fontWeight: '600',
    marginLeft: 'auto'
  },
  simulatedReplyBody: {
    fontSize: 13,
    lineHeight: 18.5
  },
  hivemindDoneChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexShrink: 0
  },
  hivemindDoneChipText: {
    fontSize: 11.5,
    fontWeight: '800'
  }
});
