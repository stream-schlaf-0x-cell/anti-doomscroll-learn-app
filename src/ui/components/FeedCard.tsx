import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, TextInput, Linking, Modal, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScoredFeedItem } from '../../core/domain/ranking';
import {
  formatFeedItemFormat,
  formatEvidenceTier,
  TOPIC_SPACE_MAP,
  TopicTag,
  UserNote,
  CommunityComment
} from '../../core/domain/types';
import { useApp } from '../../core/context/AppContext';
import { ReadingTimeBadge } from './ReadingTimeBadge';
import { typography, radius, spacing } from '../theme';
import { LinkPreviewModal } from './LinkPreviewModal';
import { MusicTrackCard } from './MusicTrackCard';
import { CURATED_SOUND_MASTERS, MusicTrackItem } from '../../core/music/musicRecommendationService';
import { optimizeImageUrl } from '../../core/utils/imageQuality';
import { RaindropService } from '../../core/raindrop/raindropService';
import { getCuratedImageForTopic } from '../../core/data/fixtures';

interface FeedCardProps {
  item: ScoredFeedItem;
  isHero?: boolean;
  isFocused?: boolean;
  isExpanded?: boolean;
  onToggleKurzCheck?: () => void;
  onInvestigateTopic?: (topic: TopicTag) => void;
}

function formatRelativeTime(isoString?: string): string {
  if (!isoString) return 'Heute';
  try {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours < 1) return 'vor kurzem';
    if (diffHours < 24) return `vor ${diffHours} Std.`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'gestern';
    if (diffDays < 7) return `vor ${diffDays} Tagen`;
    return new Date(isoString).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
  } catch {
    return 'Heute';
  }
}

export const FeedCard: React.FC<FeedCardProps> = ({
  item,
  isHero = false,
  isFocused = false,
  isExpanded,
  onToggleKurzCheck,
  onInvestigateTopic
}) => {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 960;
  const { colors, interactions, toggleSaveItem, openArticle, openWhyModal, voteItem, addNote } = useApp();

  const [localKurzCheckOpen, setLocalKurzCheckOpen] = useState(false);
  const isKurzCheckOpen = isExpanded !== undefined ? isExpanded : localKurzCheckOpen;
  const toggleKurzCheck = () => {
    if (onToggleKurzCheck) {
      onToggleKurzCheck();
    } else {
      setLocalKurzCheckOpen(prev => !prev);
    }
  };

  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [isDiscussionOpen, setIsDiscussionOpen] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [selectedTag, setSelectedTag] = useState<'einwand' | 'unterricht' | 'these' | 'notiz'>('einwand');
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [awards, setAwards] = useState(item.awardsCount || { gold: 0, brain: 0, spark: 0 });
  const [showAwardModal, setShowAwardModal] = useState(false);
  const [awardToast, setAwardToast] = useState<string | null>(null);
  const [showLinkPreview, setShowLinkPreview] = useState(false);
  const [showDidactic, setShowDidactic] = useState<boolean>(Boolean(item.isTeachingRelated || item.primaryTopic === 'german_didactics' || isHero));

  const originalUrl = item.canonicalUrl || item.sourceReferences[0]?.originalUrl;

  // Music Recommendation from iTunes & Spotify for Sound Synthesis (c/klang)
  const matchedMusicTrack: MusicTrackItem | undefined = item.primaryTopic === 'sound_synthesis'
    ? CURATED_SOUND_MASTERS[Math.abs(item.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)) % CURATED_SOUND_MASTERS.length]
    : undefined;

  const handleOpenOriginalSource = () => {
    if (!originalUrl) return;
    if (typeof window !== 'undefined' && window.open) {
      window.open(originalUrl, '_blank', 'noopener,noreferrer');
    } else {
      Linking.openURL(originalUrl);
    }
  };

  const handleGiveAward = (type: 'gold' | 'brain' | 'spark') => {
    setAwards(prev => ({
      ...prev,
      [type]: (prev[type] || 0) + 1
    }));
    setShowAwardModal(false);
    const label = type === 'gold' ? '🥇 Goldener Gedanke' : type === 'brain' ? '🧠 Tiefgang-Award' : '💎 Geistesblitz';
    setAwardToast(`✓ Auszeichnung verliehen: ${label}`);
    setTimeout(() => setAwardToast(null), 3000);
  };

  const interaction = interactions[item.id];
  const isSaved = interaction?.saved ?? false;
  const progress = interaction?.progressPercent ?? 0;
  const isCompleted = (interaction?.completedAt !== undefined) || progress >= 95;
  const voteScore = interaction?.voteScore ?? 0;
  const userNotes: UserNote[] = interaction?.userNotes ?? [];
  const communityComments: CommunityComment[] = item.comments || [];

  // Space information
  const spaceMeta = TOPIC_SPACE_MAP[item.primaryTopic as TopicTag];
  const spaceName = item.space || spaceMeta?.space || `c/${item.primaryTopic}`;
  const spaceColor = spaceMeta?.color || colors.accent;
  const spaceBgTint = spaceMeta?.bgTint || colors.accentSubtle;

  // Author and publisher
  const authorName = item.sourceReferences[0]?.author || item.sourceReferences[0]?.publisher || 'Redaktion';
  const timeAgo = formatRelativeTime(item.publishedAt);

  // Score calculation
  const baseUpvotes = item.upvotesCount ?? 0;
  const displayScore = baseUpvotes + voteScore;

  const handleCardPress = () => {
    openArticle(item.id);
  };

  const handleSavePress = () => {
    toggleSaveItem(item.id);
  };

  const handleWhyPress = () => {
    openWhyModal(item);
  };

  const handleUpvote = () => {
    if (voteScore === 1) {
      voteItem(item.id, 'clear');
    } else {
      voteItem(item.id, 'up');
    }
  };

  const handleDownvote = () => {
    if (voteScore === -1) {
      voteItem(item.id, 'clear');
    } else {
      voteItem(item.id, 'down');
    }
  };

  const handleSaveNote = async () => {
    if (!noteText.trim()) return;
    setIsSubmittingNote(true);
    try {
      await addNote(item.id, noteText.trim(), selectedTag);
      setNoteText('');
      setIsComposerOpen(false);
    } finally {
      setIsSubmittingNote(false);
    }
  };

  const [isRaindropSaved, setIsRaindropSaved] = useState<boolean>(false);

  const handleSaveToRaindrop = async () => {
    try {
      const res = await RaindropService.saveToRaindrop('demo', {
        title: item.title,
        link: originalUrl || `https://atmen.app/article/${item.id}`,
        excerpt: item.keyInsight || item.subtitle,
        tags: [item.primaryTopic || 'philosophy', 'atmen', 'focus']
      });
      if (res.success) {
        setIsRaindropSaved(true);
      }
    } catch {
      // non-fatal
    }
  };

  // Determine format and evidence tier text
  const formatText = item.flair || (item.format ? formatFeedItemFormat(item.format) : null);
  const evidenceText = formatEvidenceTier(item.evidenceTier);

  const displayFeedText = item.feedText && item.feedText.trim().length > 0
    ? item.feedText
    : item.body;

  // Dialectic counter-argument or claim
  const counterClaim = item.perspectiveDetails?.claim || (item.isChallengingPerspective ? item.subtitle : null);
  const didacticTransfer = item.didacticTransfer || item.didacticSeed || (item.isTeachingRelated ? item.relevanceExplanation : null);

  // Defensive check: hide subtitle if feedText starts with identical opening words
  const isSubtitleRedundant = useMemo(() => {
    if (!item.subtitle || !displayFeedText) return false;
    const cleanSub = item.subtitle.replace(/[.…\s]+$/, '').trim().toLowerCase();
    const cleanFeed = displayFeedText.trim().toLowerCase();
    const prefixLen = Math.min(40, cleanSub.length);
    if (prefixLen < 15) return false;
    return cleanFeed.startsWith(cleanSub.slice(0, prefixLen));
  }, [item.subtitle, displayFeedText]);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: isHero ? colors.cardHighlight : colors.surface,
          borderColor: isFocused ? colors.accent : (isHero ? colors.accent : colors.borderSubtle),
          borderWidth: isFocused ? 2 : (isHero ? 1.5 : 1)
        },
        isHero && styles.heroCard
      ]}
    >
      {/* 1. Header: Community Space Badge + Author + Bookmark */}
      <View style={styles.communityHeader}>
        <View style={styles.spaceLeftRow}>
          <View style={[styles.spacePill, { backgroundColor: spaceBgTint, borderColor: spaceColor }]}>
            <Ionicons name={(spaceMeta?.icon as any) || 'planet-outline'} size={13} color={spaceColor} style={{ marginRight: 4 }} />
            <Text style={[styles.spaceText, { color: spaceColor }]}>
              {spaceName}
            </Text>
          </View>
          <Text style={[styles.dotSeparator, { color: colors.textMuted }]}>•</Text>
          <Text style={[styles.authorText, { color: colors.textSecondary }]} numberOfLines={1}>
            {authorName}
          </Text>
          <Text style={[styles.dotSeparator, { color: colors.textMuted }]}>•</Text>
          <Text style={[styles.timeText, { color: colors.textMuted }]}>
            {timeAgo}
          </Text>
        </View>

        <TouchableOpacity
          onPress={handleSavePress}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={[styles.bookmarkButton, { backgroundColor: colors.surfaceSecondary }]}
          accessibilityLabel={isSaved ? 'Aus Bibliothek entfernen' : 'In Bibliothek speichern'}
        >
          <Ionicons
            name={isSaved ? 'bookmark' : 'bookmark-outline'}
            size={16}
            color={isSaved ? colors.accent : colors.textMuted}
          />
        </TouchableOpacity>
      </View>

      {/* 1.1 Crystal-Clear Source & Trust Banner */}
      <View style={[styles.sourceClearBanner, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
        <View style={styles.sourceClearLeft}>
          <Ionicons
            name={
              item.sourceTrustLevel === 'public_broadcaster' ? 'shield-checkmark' :
              item.format === 'youtube_gem' ? 'logo-youtube' :
              item.format === 'book_masterpiece' ? 'book' :
              item.sourceTrustLevel === 'peer_reviewed' ? 'school' : 'newspaper-outline'
            }
            size={13}
            color={
              item.sourceTrustLevel === 'public_broadcaster' ? '#10B981' :
              item.format === 'youtube_gem' ? '#EF4444' :
              item.format === 'book_masterpiece' ? '#A855F7' :
              colors.accent
            }
            style={{ marginRight: 5 }}
          />
          <Text style={[styles.sourceClearName, { color: colors.textPrimary }]} numberOfLines={1}>
            {item.sourceBroadcasterName || item.sourceReferences[0]?.publisher || 'Geprüfte Quelle'}
          </Text>
          <View style={[styles.trustLevelBadge, { backgroundColor: colors.surface }]}>
            <Text style={[styles.trustLevelText, { color: colors.textSecondary }]}>
              {item.sourceTrustLevel === 'public_broadcaster' ? 'Öffentlich-Rechtlich' :
               item.sourceTrustLevel === 'peer_reviewed' ? 'Peer-Reviewed' :
               item.format === 'youtube_gem' ? 'Video-Essay' :
               item.format === 'book_masterpiece' ? 'Buch-Klassiker' :
               item.format === 'meme' ? 'Satire-Labor' : 'Verifiziert'}
            </Text>
          </View>
        </View>

        {originalUrl && (
          <View style={styles.sourceClearActions}>
            <TouchableOpacity
              onPress={() => setShowLinkPreview(true)}
              style={[styles.sourcePreviewChip, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              accessibilityLabel="Schnell-Vorschau öffnen"
            >
              <Ionicons name="eye-outline" size={11} color={colors.accent} style={{ marginRight: 3 }} />
              <Text style={[styles.sourcePreviewChipText, { color: colors.textPrimary }]}>
                Vorschau
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleOpenOriginalSource}
              style={[styles.openSourceBtn, { backgroundColor: colors.accentSubtle, borderColor: colors.accent }]}
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              accessibilityRole="link"
              accessibilityLabel="Originalquelle im neuen Tab öffnen"
            >
              <Ionicons name="open-outline" size={10} color={colors.accent} style={{ marginRight: 3 }} />
              <Text style={[styles.openSourceBtnText, { color: colors.accent }]}>
                {item.sourceDomain || 'Quelle'} ↗
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* 2. Flairs & Archetype Row */}
      <View style={styles.flairsRow}>
        {/* Archetype 2: Magazine Full Text */}
        {(item.evidenceTier === 'permitted_full_text' || item.format === 'long_invitation') && (
          <View style={[styles.flairBadge, { backgroundColor: 'rgba(59, 130, 246, 0.15)', borderColor: '#3B82F6', borderWidth: 0.5 }]}>
            <Text style={[styles.flairBadgeText, { color: '#3B82F6', fontWeight: '700' }]}>
              📖 Volltext • {item.estimatedReadingMinutes} Min.
            </Text>
          </View>
        )}
        {/* Archetype 1: Publisher Excerpt */}
        {(item.evidenceTier === 'publisher_excerpt' || item.evidenceTier === 'metadata_only') && (
          <View style={[styles.flairBadge, { backgroundColor: 'rgba(234, 88, 12, 0.12)', borderColor: '#EA580C', borderWidth: 0.5 }]}>
            <Text style={[styles.flairBadgeText, { color: '#EA580C', fontWeight: '600' }]}>
              📰 Auszug • {item.sourceDomain || 'Original'}
            </Text>
          </View>
        )}
        {/* Archetype 3: Dialectic Impuls */}
        {(item.type === 'perspective' || item.isChallengingPerspective || Boolean(item.perspectiveDetails?.counterPerspective)) && (
          <View style={[styles.flairBadge, { backgroundColor: 'rgba(139, 92, 246, 0.15)', borderColor: '#8B5CF6', borderWidth: 0.5 }]}>
            <Text style={[styles.flairBadgeText, { color: '#8B5CF6', fontWeight: '700' }]}>
              💬 Gegenstimme & Diskurs
            </Text>
          </View>
        )}
        {item.isEvergreenGem && (
          <View style={[styles.flairBadge, { backgroundColor: 'rgba(217, 119, 6, 0.15)', borderColor: '#D97706', borderWidth: 0.5 }]}>
            <Text style={[styles.flairBadgeText, { color: '#D97706', fontWeight: '700' }]}>
              🏛 Netz-Klassiker
            </Text>
          </View>
        )}
        {formatText && !item.isEvergreenGem && (
          <View style={[styles.flairBadge, { backgroundColor: colors.accentSubtle }]}>
            <Text style={[styles.flairBadgeText, { color: colors.accent }]}>
              {formatText}
            </Text>
          </View>
        )}
        <ReadingTimeBadge minutes={item.estimatedReadingMinutes} />
        <View style={[styles.evidenceBadge, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
          <Text style={[styles.evidenceBadgeText, { color: colors.textMuted }]}>
            {evidenceText}
          </Text>
        </View>
      </View>

      {/* 3. Hero Visual Image (if present & valid) */}
      {item.imageUrl && !imageError && (
        <TouchableOpacity activeOpacity={0.9} onPress={handleCardPress} style={styles.imageContainer}>
          <Image
            source={{ uri: optimizeImageUrl(item.imageUrl) || item.imageUrl }}
            style={styles.cardImage}
            resizeMode="cover"
            onError={() => setImageError(true)}
          />
          {item.imageCredit && (
            <View style={styles.imageCreditOverlay}>
              <Text style={styles.imageCreditText} numberOfLines={1}>
                Bild: {item.imageCredit}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      )}

      {/* 4. Title & Lead */}
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

        {item.subtitle && item.subtitle.trim().length > 0 && !isSubtitleRedundant && (
          <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={2}>
            {item.subtitle}
          </Text>
        )}
      </TouchableOpacity>

      {/* 5. Substantive Standalone Feed Reading */}
      <Text style={[styles.feedText, { color: colors.textPrimary }]} numberOfLines={isHero ? 7 : 5}>
        {displayFeedText}
      </Text>

      {/* Archetype 1 Compact Excerpt Pill Bar */}
      {(item.evidenceTier === 'publisher_excerpt' || item.evidenceTier === 'metadata_only') && !isKurzCheckOpen && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, marginBottom: 8, flexWrap: 'wrap' }}>
          <TouchableOpacity
            onPress={toggleKurzCheck}
            style={[styles.sourcePreviewChip, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}
            accessibilityRole="button"
            accessibilityLabel="Kurz-Check einblenden"
          >
            <Ionicons name="flash-outline" size={11} color={colors.accent} style={{ marginRight: 4 }} />
            <Text style={[styles.sourcePreviewChipText, { color: colors.accent }]}>⚡ Kurz-Check</Text>
          </TouchableOpacity>
          {originalUrl && (
            <TouchableOpacity
              onPress={handleOpenOriginalSource}
              style={[styles.openSourceBtn, { backgroundColor: colors.accentSubtle, borderColor: colors.accent }]}
              accessibilityRole="link"
              accessibilityLabel="Originalartikel öffnen"
            >
              <Ionicons name="open-outline" size={10} color={colors.accent} style={{ marginRight: 4 }} />
              <Text style={[styles.openSourceBtnText, { color: colors.accent }]}>
                {item.sourceDomain || 'Quelle'} ↗
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* 5.1 Inline Kurz-Check Expando (Ebene 2 Peek) */}
      {isKurzCheckOpen && (
        <View style={[styles.kurzCheckBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
          <View style={styles.kurzCheckHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="flash" size={14} color={colors.accent} style={{ marginRight: 6 }} />
              <Text style={[styles.kurzCheckHeaderTitle, { color: colors.accent }]}>⚡ Kurz-Check (Ebene 2)</Text>
            </View>
            <TouchableOpacity onPress={toggleKurzCheck} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle-outline" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {item.keyInsight ? (
            <View style={styles.kurzCheckSection}>
              <Text style={[styles.kurzCheckLabel, { color: colors.accent }]}>💡 Kernpunkt</Text>
              <Text style={[styles.kurzCheckText, { color: colors.textPrimary }]}>{item.keyInsight}</Text>
            </View>
          ) : null}

          {(item.perspectiveDetails?.counterPerspective || item.deepeningOptions?.counterArgument) ? (
            <View style={styles.kurzCheckSection}>
              <Text style={[styles.kurzCheckLabel, { color: '#8B5CF6' }]}>⚖️ Gegenstimme</Text>
              <Text style={[styles.kurzCheckText, { color: colors.textSecondary }]}>
                {item.perspectiveDetails?.counterPerspective || item.deepeningOptions?.counterArgument}
              </Text>
            </View>
          ) : null}

          {(item.challengePrompt || item.didacticSeed) ? (
            <View style={styles.kurzCheckSection}>
              <Text style={[styles.kurzCheckLabel, { color: '#10B981' }]}>🎯 Impuls & Praxis-Idee</Text>
              <Text style={[styles.kurzCheckText, { color: colors.textPrimary }]}>
                {item.challengePrompt || item.didacticSeed}
              </Text>
            </View>
          ) : null}

          <View style={styles.kurzCheckFooterRow}>
            <TouchableOpacity
              onPress={() => onInvestigateTopic ? onInvestigateTopic(item.primaryTopic) : openArticle(item.id)}
              style={[styles.tieferGrabenBtn, { backgroundColor: colors.accent }]}
              accessibilityRole="button"
              accessibilityLabel="Tiefer graben zu diesem Thema"
            >
              <Ionicons name="compass-outline" size={13} color="#FFFFFF" style={{ marginRight: 5 }} />
              <Text style={styles.tieferGrabenBtnText}>🔍 Tiefer graben ({spaceName})</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleCardPress}
              style={[styles.fullReaderBtn, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
              accessibilityRole="button"
              accessibilityLabel="Volltext und Sokratik im Reader öffnen"
            >
              <Text style={[styles.fullReaderBtnText, { color: colors.textPrimary }]}>Im Thread lesen →</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* 6. Key Insight Box (if present) */}
      {item.keyInsight && (
        <View style={[styles.insightBox, { backgroundColor: colors.surfaceSecondary, borderLeftColor: colors.accent }]}>
          <View style={styles.insightHeader}>
            <Ionicons name="bulb-outline" size={14} color={colors.accent} style={{ marginRight: 5 }} />
            <Text style={[styles.insightLabel, { color: colors.accent }]}>Kern-Erkenntnis</Text>
          </View>
          <Text style={[styles.insightText, { color: colors.textPrimary }]}>
            „{item.keyInsight}“
          </Text>
        </View>
      )}

      {/* 7. Archetype 3: Dialectic Central Thesis & Thread Counter-Argument */}
      {(item.isChallengingPerspective || item.type === 'perspective' || Boolean(item.perspectiveDetails?.counterPerspective)) && (
        <View style={[styles.dialecticBox, { backgroundColor: colors.surfaceSecondary, borderLeftColor: '#8B5CF6' }]}>
          <View style={styles.dialecticHeader}>
            <Ionicons name="chatbubbles-outline" size={14} color="#8B5CF6" style={{ marginRight: 5 }} />
            <Text style={[styles.dialecticLabel, { color: '#8B5CF6' }]}>Streitfrage & Skeptiker-Einwand</Text>
          </View>
          <Text style={[styles.dialecticText, { color: colors.textPrimary, fontWeight: '600', marginBottom: 4 }]}>
            „{counterClaim || item.title}“
          </Text>
          {item.perspectiveDetails?.counterPerspective && (
            <Text style={{ fontSize: 12, color: colors.textSecondary, fontStyle: 'italic', marginTop: 2 }}>
              ↳ Gegenstimme: {item.perspectiveDetails.counterPerspective}
            </Text>
          )}
        </View>
      )}

      {/* 8. Didactic / Learning Partner Transfer (on-demand to prevent card-overload) */}
      {didacticTransfer && (
        showDidactic ? (
          <View style={[styles.didacticBox, { backgroundColor: colors.surfaceSecondary, borderLeftColor: '#10B981' }]}>
            <TouchableOpacity
              onPress={() => setShowDidactic(false)}
              style={styles.didacticHeader}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Didaktik-Transfer einklappen"
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <Ionicons name="school-outline" size={14} color="#10B981" style={{ marginRight: 5 }} />
                <Text style={[styles.didacticLabel, { color: '#10B981' }]}>
                  {item.primaryTopic === 'german_didactics' || item.isTeachingRelated ? 'Didaktik-Labor & Transfer' : '🎓 Lern-Partner & Transfer'}
                </Text>
              </View>
              <Ionicons name="chevron-up" size={14} color={colors.textMuted} />
            </TouchableOpacity>
            <Text style={[styles.didacticText, { color: colors.textSecondary }]}>
              {didacticTransfer}
            </Text>
          </View>
        ) : (
          <TouchableOpacity
            onPress={() => setShowDidactic(true)}
            style={[styles.didacticToggleChip, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Lernimpuls & Didaktik-Transfer einblenden"
          >
            <Ionicons name="school-outline" size={13} color="#10B981" style={{ marginRight: 6 }} />
            <Text style={[styles.didacticToggleText, { color: colors.textSecondary }]}>
              {item.primaryTopic === 'german_didactics' || item.isTeachingRelated ? 'Didaktik-Transfer einblenden' : '🎓 Lernimpuls & Transfer prüfen'}
            </Text>
            <Ionicons name="chevron-down" size={13} color={colors.textMuted} style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>
        )
      )}

      {/* 8.0 Evergreen Internet Gem Cross-Reference */}
      {item.evergreenContext && (
        <View style={[styles.evergreenBox, { backgroundColor: colors.surfaceSecondary, borderLeftColor: '#D97706' }]}>
          <View style={styles.evergreenHeader}>
            <Ionicons name="library-outline" size={13} color="#D97706" style={{ marginRight: 5 }} />
            <Text style={[styles.evergreenLabel, { color: '#D97706' }]}>Zeitloses Netz-Meisterwerk</Text>
          </View>
          <Text style={[styles.evergreenText, { color: colors.textSecondary }]}>
            {item.evergreenContext}
          </Text>
        </View>
      )}

      {/* 8.1 YouTube Video Essay Gem */}
      {item.youtubeMeta && (
        <View style={[styles.youtubeContainer, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={handleOpenOriginalSource}
            style={styles.youtubeVideoBanner}
          >
            <Image
              source={{ uri: item.imageUrl || 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?auto=format&fit=crop&w=1200&q=80' }}
              style={styles.youtubeThumbnail}
              resizeMode="cover"
            />
            <View style={styles.youtubePlayOverlay}>
              <View style={styles.youtubePlayBtn}>
                <Ionicons name="play" size={24} color="#FFFFFF" style={{ marginLeft: 3 }} />
              </View>
              <View style={styles.youtubeDurationBadge}>
                <Text style={styles.youtubeDurationText}>{item.youtubeMeta.duration}</Text>
              </View>
            </View>
          </TouchableOpacity>

          <View style={styles.youtubeMetaBar}>
            <View style={styles.youtubeChannelRow}>
              <Ionicons name="logo-youtube" size={16} color="#EF4444" style={{ marginRight: 6 }} />
              <Text style={[styles.youtubeChannelTitle, { color: colors.textPrimary }]}>{item.youtubeMeta.channelTitle}</Text>
              {item.youtubeMeta.viewCount && (
                <Text style={[styles.youtubeViewsText, { color: colors.textMuted }]}> • {item.youtubeMeta.viewCount}</Text>
              )}
            </View>
            <TouchableOpacity onPress={handleOpenOriginalSource} style={[styles.watchOnYtBtn, { backgroundColor: colors.surface }]}>
              <Text style={[styles.watchOnYtText, { color: colors.accent }]}>Auf YouTube ansehen ↗</Text>
            </TouchableOpacity>
          </View>

          {item.youtubeMeta.keyTakeaways && item.youtubeMeta.keyTakeaways.length > 0 && (
            <View style={styles.takeawaysContainer}>
              <Text style={[styles.takeawaysHeader, { color: colors.textPrimary }]}>3 Schlüssel-Erkenntnisse:</Text>
              {item.youtubeMeta.keyTakeaways.map((point, idx) => (
                <View key={idx} style={styles.takeawayRow}>
                  <Ionicons name="checkmark-circle" size={14} color="#38BDF8" style={{ marginRight: 6, marginTop: 2 }} />
                  <Text style={[styles.takeawayText, { color: colors.textSecondary }]}>{point}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* 8.2 High-IQ Meme & Satire */}
      {item.memeMeta && (
        <View style={[styles.memeContainer, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
          <View style={[styles.punchlineBar, { backgroundColor: colors.accentSubtle, borderLeftColor: colors.accent }]}>
            <Ionicons name="chatbubbles" size={16} color={colors.accent} style={{ marginRight: 8, marginTop: 2 }} />
            <Text style={[styles.punchlineText, { color: colors.textPrimary }]}>
              {item.memeMeta.punchline}
            </Text>
          </View>

          {item.memeMeta.satireContext && (
            <View style={styles.satireContextRow}>
              <Ionicons name="information-circle-outline" size={13} color={colors.textMuted} style={{ marginRight: 5 }} />
              <Text style={[styles.satireContextText, { color: colors.textSecondary }]}>
                {item.memeMeta.satireContext}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* 8.3 Book Masterpiece Recommendation */}
      {item.bookMeta && (
        <View style={[styles.bookContainer, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
          <View style={styles.bookHeaderRow}>
            <View style={{ flex: 1 }}>
              <View style={styles.bookRatingRow}>
                <Text style={styles.bookStars}>★★★★★</Text>
                <Text style={[styles.bookRatingNumber, { color: colors.accent }]}> {item.bookMeta.rating} / 5</Text>
                {item.bookMeta.pages && (
                  <Text style={[styles.bookPages, { color: colors.textMuted }]}> • {item.bookMeta.pages} Seiten</Text>
                )}
              </View>
              <Text style={[styles.bookAuthor, { color: colors.textSecondary }]}>
                Autor: <Text style={{ fontWeight: '700', color: colors.textPrimary }}>{item.bookMeta.author}</Text>
              </Text>
            </View>
          </View>

          <View style={[styles.bookThesisBox, { backgroundColor: colors.surface, borderLeftColor: '#A855F7' }]}>
            <Text style={[styles.bookThesisLabel, { color: '#A855F7' }]}>Kern-These in einem Satz:</Text>
            <Text style={[styles.bookThesisText, { color: colors.textPrimary }]}>
              „{item.bookMeta.oneSentenceThesis}“
            </Text>
          </View>

          <View style={styles.bookWhyBox}>
            <Ionicons name="sparkles" size={13} color="#F59E0B" style={{ marginRight: 6, marginTop: 2 }} />
            <Text style={[styles.bookWhyText, { color: colors.textSecondary }]}>
              <Text style={{ fontWeight: '700', color: colors.textPrimary }}>Warum lesen? </Text>
              {item.bookMeta.whyRead}
            </Text>
          </View>
        </View>
      )}

      {/* 8.4 Opportunity & Health Radar */}
      {item.opportunityMeta && (
        <View style={[styles.oppContainer, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
          <View style={styles.oppHeaderRow}>
            <View style={[styles.oppCategoryPill, { backgroundColor: colors.accentSubtle }]}>
              <Ionicons name="flash" size={12} color={colors.accent} style={{ marginRight: 4 }} />
              <Text style={[styles.oppCategoryText, { color: colors.accent }]}>
                {item.opportunityMeta.category}
              </Text>
            </View>
            <View style={[styles.oppScoreBadge, { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderColor: '#10B981' }]}>
              <Text style={[styles.oppScoreText, { color: '#10B981' }]}>
                Hebelwirkung: {item.opportunityMeta.impactScore}/10
              </Text>
            </View>
          </View>

          <View style={[styles.oppActionBox, { backgroundColor: colors.surface, borderLeftColor: '#10B981' }]}>
            <Text style={[styles.oppActionLabel, { color: '#10B981' }]}>Konkrete Umsetzung & Hebel:</Text>
            <Text style={[styles.oppActionText, { color: colors.textPrimary }]}>
              {item.opportunityMeta.actionStep}
            </Text>
          </View>
        </View>
      )}

      {/* 8.5 Museum-Grade Visual Art & Aesthetics Showcase */}
      {(item.primaryTopic === 'art_aesthetics' || item.format === 'art_showcase' || !!item.artMeta) && (
        <View style={[styles.artContainer, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
          <TouchableOpacity
            activeOpacity={0.95}
            onPress={handleCardPress}
            style={[styles.artImageWrapper, { height: isDesktop ? 440 : 360 }]}
          >
            <Image
              source={{ uri: optimizeImageUrl(item.artMeta?.highResImageUrl || item.imageUrl || getCuratedImageForTopic('art_aesthetics', item.id), 1200) }}
              style={styles.artImage}
              resizeMode="cover"
            />
            <View style={styles.artImageOverlay} />
            <View style={styles.artMuseumPlaque}>
              <Ionicons name="color-palette" size={14} color="#F59E0B" style={{ marginRight: 6 }} />
              <Text style={styles.artMuseumPlaqueText} numberOfLines={1}>
                {item.artMeta?.artist || authorName} {item.artMeta?.year ? `(${item.artMeta.year})` : ''} • {item.artMeta?.museum || 'Museums-Sammlung'}
              </Text>
            </View>
          </TouchableOpacity>

          {(item.artMeta?.aestheticImpulse || item.keyInsight) && (
            <View style={[styles.artImpulseBox, { backgroundColor: colors.surface, borderLeftColor: '#F59E0B' }]}>
              <View style={styles.artImpulseHeader}>
                <Ionicons name="sparkles" size={13} color="#F59E0B" style={{ marginRight: 5 }} />
                <Text style={[styles.artImpulseLabel, { color: '#F59E0B' }]}>Ästhetischer Impuls & Kontemplation:</Text>
              </View>
              <Text style={[styles.artImpulseText, { color: colors.textPrimary }]}>
                {item.artMeta?.aestheticImpulse || item.keyInsight}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* 8.6 Music & Synthesis Gem from iTunes & Spotify (c/klang) */}
      {matchedMusicTrack && (
        <MusicTrackCard track={matchedMusicTrack} />
      )}

      {/* 8.6 Prominent Rich Link Preview Card */}
      {originalUrl && (
        <View style={[styles.richLinkCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
          <View style={styles.richLinkHeader}>
            <View style={styles.richLinkHeaderLeft}>
              <View style={[styles.richLinkFavicon, { backgroundColor: colors.accentSubtle }]}>
                <Ionicons
                  name={
                    item.format === 'youtube_gem' ? 'logo-youtube' :
                    item.primaryTopic === 'sound_synthesis' ? 'musical-notes' :
                    item.sourceTrustLevel === 'public_broadcaster' ? 'shield-checkmark' :
                    'globe-outline'
                  }
                  size={15}
                  color={item.format === 'youtube_gem' ? '#EF4444' : colors.accent}
                />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.richLinkDomainRow}>
                  <Text style={[styles.richLinkDomain, { color: colors.accent }]}>
                    {item.sourceDomain || 'fachquelle'}
                  </Text>
                  <Text style={[styles.richLinkDot, { color: colors.textMuted }]}>•</Text>
                  <Text style={[styles.richLinkPublisher, { color: colors.textSecondary }]} numberOfLines={1}>
                    {item.sourceBroadcasterName || item.sourceReferences[0]?.publisher || 'Verifizierte Quelle'}
                  </Text>
                </View>
                <Text style={[styles.richLinkUrl, { color: colors.textMuted }]} numberOfLines={1}>
                  {originalUrl}
                </Text>
              </View>
            </View>
          </View>

          {/* Action Row */}
          <View style={[styles.richLinkActions, { borderTopColor: colors.borderSubtle }]}>
            <TouchableOpacity
              onPress={() => setShowLinkPreview(true)}
              style={[styles.richLinkPreviewBtn, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
              activeOpacity={0.8}
            >
              <Ionicons name="eye-outline" size={13} color={colors.accent} style={{ marginRight: 5 }} />
              <Text style={[styles.richLinkPreviewBtnText, { color: colors.textPrimary }]}>
                Schnell-Vorschau
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleOpenOriginalSource}
              style={[styles.richLinkOpenBtn, { backgroundColor: colors.accent }]}
              activeOpacity={0.85}
            >
              <Text style={styles.richLinkOpenBtnText}>
                Originalartikel lesen ↗
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* 9. Interactive Reflection Challenge (Mini-Composer) */}
      <View style={[styles.challengeContainer, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
        {!isComposerOpen ? (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setIsComposerOpen(true)}
            style={styles.challengePromptButton}
          >
            <Ionicons name="pencil-outline" size={15} color={colors.accent} style={{ marginRight: 8 }} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.challengePromptTitle, { color: colors.textPrimary }]}>
                {item.challengePrompt || 'Eigene Replik oder Unterrichts-Idee verfassen'}
              </Text>
              <Text style={[styles.challengePromptSub, { color: colors.textMuted }]}>
                Festhalten, widersprechen oder Praxistransfer notieren →
              </Text>
            </View>
          </TouchableOpacity>
        ) : (
          <View style={styles.composerBox}>
            <Text style={[styles.composerTitle, { color: colors.textPrimary }]}>
              {item.challengePrompt || 'Dein Gedanke zu diesem Beitrag:'}
            </Text>

            {/* Tag Selection Row */}
            <View style={styles.tagSelectorRow}>
              {[
                { id: 'einwand', label: '⚡️ Einwand' },
                { id: 'unterricht', label: '🏫 Unterricht' },
                { id: 'these', label: '💡 Eigene These' },
                { id: 'notiz', label: '📝 Notiz' }
              ].map(tag => (
                <TouchableOpacity
                  key={tag.id}
                  onPress={() => setSelectedTag(tag.id as any)}
                  style={[
                    styles.tagButton,
                    {
                      backgroundColor: selectedTag === tag.id ? colors.accent : colors.surface,
                      borderColor: selectedTag === tag.id ? colors.accent : colors.borderSubtle
                    }
                  ]}
                >
                  <Text
                    style={[
                      styles.tagButtonText,
                      { color: selectedTag === tag.id ? '#FFFFFF' : colors.textSecondary }
                    ]}
                  >
                    {tag.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Text Input */}
            <TextInput
              value={noteText}
              onChangeText={setNoteText}
              placeholder="Formuliere deinen Einwand, eine Unterrichtsidee oder Gedanken…"
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={3}
              style={[
                styles.composerInput,
                {
                  color: colors.textPrimary,
                  backgroundColor: colors.surface,
                  borderColor: colors.borderSubtle
                }
              ]}
            />

            {/* Action Buttons */}
            <View style={styles.composerActions}>
              <TouchableOpacity
                onPress={() => {
                  setNoteText('');
                  setIsComposerOpen(false);
                }}
                style={styles.composerCancelButton}
              >
                <Text style={[styles.composerCancelText, { color: colors.textMuted }]}>Abbrechen</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSaveNote}
                disabled={!noteText.trim() || isSubmittingNote}
                style={[
                  styles.composerSaveButton,
                  { backgroundColor: noteText.trim() ? colors.accent : colors.borderSubtle }
                ]}
              >
                <Ionicons name="checkmark" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                <Text style={styles.composerSaveText}>
                  {isSubmittingNote ? 'Speichern…' : 'Gedanken sichern'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Render already saved user notes with AI sparring replies */}
        {userNotes.length > 0 && (
          <View style={styles.savedNotesList}>
            {userNotes.map(n => (
              <View key={n.id} style={[styles.userNoteItem, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
                <View style={styles.userNoteHeader}>
                  <View style={[styles.userNoteTag, { backgroundColor: colors.accentSubtle }]}>
                    <Text style={[styles.userNoteTagText, { color: colors.accent }]}>
                      {n.tag === 'einwand' ? '⚡️ Dein Einwand' : n.tag === 'unterricht' ? '🏫 Dein Unterrichtsentwurf' : n.tag === 'these' ? '💡 Deine These' : '📝 Deine Notiz'}
                    </Text>
                  </View>
                  <Text style={[styles.userNoteDate, { color: colors.textMuted }]}>
                    {formatRelativeTime(n.createdAt)}
                  </Text>
                </View>
                <Text style={[styles.userNoteContent, { color: colors.textPrimary }]}>
                  {n.text}
                </Text>

                {/* Indented AI Sparring Partner Response */}
                {n.sparringReply && (
                  <View style={[styles.sparringReplyBox, { backgroundColor: colors.surfaceSecondary, borderLeftColor: colors.accent }]}>
                    <View style={styles.sparringHeader}>
                      <Ionicons name="chatbubbles-outline" size={13} color={colors.accent} style={{ marginRight: 5 }} />
                      <Text style={[styles.sparringHandle, { color: colors.accent }]}>
                        {n.sparringReply.authorHandle}
                      </Text>
                      <View style={[styles.sparringBadge, { backgroundColor: colors.accentSubtle }]}>
                        <Text style={[styles.sparringBadgeText, { color: colors.accent }]}>
                          {n.sparringReply.authorBadge || 'Sparring'}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.sparringText, { color: colors.textPrimary }]}>
                      {n.sparringReply.text}
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </View>

      {/* 10. Progressive Reader Action (Ebene 2 Abstract & Ebene 3 Artikel) */}
      <TouchableOpacity
        onPress={handleCardPress}
        activeOpacity={0.75}
        style={[styles.expandButton, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}
        accessibilityRole="button"
        accessibilityLabel="Abstract und ausführliche Lektüre öffnen"
      >
        <View style={styles.expandButtonLeft}>
          <Ionicons name="reader-outline" size={14} color={colors.accent} style={{ marginRight: 6 }} />
          <Text style={[styles.expandButtonText, { color: colors.accent }]}>
            Abstract & Artikel lesen
          </Text>
        </View>
        <Text style={[styles.expandButtonMeta, { color: colors.textMuted }]}>
          {item.wordCount ? `${item.wordCount} Wörter` : `${item.estimatedReadingMinutes} Min.`} →
        </Text>
      </TouchableOpacity>

      {/* 11. Reading Progress Track (if started) */}
      {progress > 0 && !isCompleted && (
        <View style={[styles.progressTrack, { backgroundColor: colors.surfaceSecondary }]}>
          <View
            style={[
              styles.progressBar,
              { width: `${progress}%`, backgroundColor: colors.accent }
            ]}
          />
        </View>
      )}

      {/* 12. Bottom Social Action Bar: Upvote/Downvote, Discussion Pill, Why Sparkle, Completion Status */}
      <View style={[styles.footerRow, { borderTopColor: colors.borderSubtle }]}>
        {/* Reddit-style Upvote/Downvote Pill */}
        <View style={[styles.voteContainer, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
          <TouchableOpacity
            onPress={handleUpvote}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }}
            style={styles.voteArrow}
            accessibilityLabel="Beitrag aufwerten (Upvote)"
          >
            <Ionicons
              name={voteScore === 1 ? 'arrow-up-circle' : 'arrow-up-outline'}
              size={18}
              color={voteScore === 1 ? '#FF4500' : colors.textMuted}
            />
          </TouchableOpacity>

          <Text
            style={[
              styles.voteScoreText,
              {
                color: voteScore === 1 ? '#FF4500' : voteScore === -1 ? '#7193FF' : colors.textPrimary
              }
            ]}
          >
            {displayScore}
          </Text>

          <TouchableOpacity
            onPress={handleDownvote}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
            style={styles.voteArrow}
            accessibilityLabel="Beitrag abwerten (Downvote)"
          >
            <Ionicons
              name={voteScore === -1 ? 'arrow-down-circle' : 'arrow-down-outline'}
              size={18}
              color={voteScore === -1 ? '#7193FF' : colors.textMuted}
            />
          </TouchableOpacity>
        </View>

        {/* Reddit-style Kurz-Check Inline Expando Button */}
        <TouchableOpacity
          onPress={toggleKurzCheck}
          style={[
            styles.kurzCheckPill,
            {
              backgroundColor: isKurzCheckOpen ? colors.accentSubtle : colors.surfaceSecondary,
              borderColor: isKurzCheckOpen ? colors.accent : colors.borderSubtle
            }
          ]}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          accessibilityLabel="Kurz-Check (Ebene 2) ein- oder ausblenden"
        >
          <Ionicons
            name={isKurzCheckOpen ? 'flash' : 'flash-outline'}
            size={13}
            color={isKurzCheckOpen ? colors.accent : colors.textMuted}
            style={{ marginRight: 4 }}
          />
          <Text style={[styles.kurzCheckPillText, { color: isKurzCheckOpen ? colors.accent : colors.textPrimary }]}>
            Kurz-Check
          </Text>
        </TouchableOpacity>

        {/* Reddit-style Comments & Sparring Toggle */}
        <TouchableOpacity
          onPress={() => setIsDiscussionOpen(prev => !prev)}
          style={[styles.commentsButton, { backgroundColor: isDiscussionOpen ? colors.accentSubtle : colors.surfaceSecondary }]}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          accessibilityLabel="Community-Diskussion öffnen"
        >
          <Ionicons
            name="chatbubble-ellipses-outline"
            size={13}
            color={isDiscussionOpen ? colors.accent : colors.textMuted}
            style={{ marginRight: 5 }}
          />
          <Text style={[styles.commentsButtonText, { color: isDiscussionOpen ? colors.accent : colors.textPrimary }]}>
            {communityComments.length + userNotes.length}
          </Text>
          <Ionicons
            name={isDiscussionOpen ? 'chevron-up' : 'chevron-down'}
            size={11}
            color={isDiscussionOpen ? colors.accent : colors.textMuted}
            style={{ marginLeft: 3 }}
          />
        </TouchableOpacity>

        {/* Reddit-style Awards Button */}
        <TouchableOpacity
          onPress={() => setShowAwardModal(true)}
          style={[styles.awardsBtn, { backgroundColor: colors.surfaceSecondary }]}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          accessibilityLabel="Auszeichnung verleihen"
        >
          <Text style={styles.awardsBtnIcon}>🏆</Text>
          <Text style={[styles.awardsBtnText, { color: (awards.gold + awards.brain + awards.spark) > 0 ? '#F59E0B' : colors.textMuted }]}>
            {(awards.gold + awards.brain + awards.spark) > 0 ? `${awards.gold + awards.brain + awards.spark}` : 'Award'}
          </Text>
        </TouchableOpacity>

        {/* Why this post pill */}
        <TouchableOpacity
          onPress={handleWhyPress}
          style={[styles.whyPill, { backgroundColor: colors.surfaceSecondary }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="sparkles-outline" size={12} color={colors.accent} style={{ marginRight: 4 }} />
          <Text style={[styles.whyText, { color: colors.textMuted }]}>
            Warum?
          </Text>
        </TouchableOpacity>

        {/* External Quelle Direct Pill if available */}
        {originalUrl && (
          <TouchableOpacity
            onPress={handleOpenOriginalSource}
            style={[styles.sourceLinkPill, { backgroundColor: colors.surfaceSecondary }]}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            accessibilityLabel="Originalquelle öffnen"
          >
            <Ionicons name="open-outline" size={11} color={colors.accent} style={{ marginRight: 3 }} />
            <Text style={[styles.sourceLinkPillText, { color: colors.accent }]} numberOfLines={1}>
              {item.sourceDomain || 'Quelle'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Raindrop 1-Click Save */}
        <TouchableOpacity
          onPress={handleSaveToRaindrop}
          style={[styles.sourceLinkPill, { backgroundColor: isRaindropSaved ? '#0284C7' + '20' : colors.surfaceSecondary }]}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          accessibilityLabel="In Raindrop.io speichern"
        >
          <Ionicons
            name={isRaindropSaved ? 'water' : 'water-outline'}
            size={11}
            color={isRaindropSaved ? '#0284C7' : colors.textMuted}
            style={{ marginRight: 3 }}
          />
          <Text style={[styles.sourceLinkPillText, { color: isRaindropSaved ? '#0284C7' : colors.textMuted }]}>
            {isRaindropSaved ? 'In Raindrop' : 'Raindrop'}
          </Text>
        </TouchableOpacity>

        {/* Completed status or publisher */}
        {isCompleted ? (
          <View style={styles.completedBadge}>
            <Ionicons name="checkmark-circle" size={13} color={colors.success} style={{ marginRight: 3 }} />
            <Text style={[styles.completedText, { color: colors.success }]}>Gelesen</Text>
          </View>
        ) : (
          <Text style={[styles.sourceText, { color: colors.textMuted }]} numberOfLines={1}>
            {item.sourceReferences[0]?.publisher ?? 'Redaktion'}
          </Text>
        )}
      </View>

      {/* 13. Simulated Reddit Community Discussion Thread */}
      {isDiscussionOpen && (
        <View style={[styles.discussionContainer, { backgroundColor: colors.surfaceSecondary, borderTopColor: colors.borderSubtle }]}>
          <View style={styles.discussionHeader}>
            <View style={styles.discussionHeaderLeft}>
              <Ionicons name="sparkles" size={15} color={colors.accent} style={{ marginRight: 6 }} />
              <View>
                <Text style={[styles.discussionTitle, { color: colors.textPrimary }]}>
                  Dialektisches Sparring & Diskurs ({communityComments.length + userNotes.length})
                </Text>
                <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 1 }}>
                  🤖 Transparente KI-Dialektik: Sokratische Reibung & didaktische Gegenpositionen
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => setIsComposerOpen(true)}>
              <Text style={[styles.replyLink, { color: colors.accent }]}>+ Replik wagen</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.commentsList}>
            {communityComments.map(c => (
              <View key={c.id} style={[styles.commentCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
                <View style={styles.commentHeader}>
                  <View style={styles.commentAuthorRow}>
                    <View style={[styles.commentAvatar, { backgroundColor: colors.accentSubtle }]}>
                      <Text style={[styles.commentAvatarText, { color: colors.accent }]}>
                        {c.authorHandle.charAt(2).toUpperCase()}
                      </Text>
                    </View>
                    <Text style={[styles.commentHandle, { color: colors.textPrimary }]}>
                      {c.authorHandle}
                    </Text>
                    <View style={[styles.commentBadge, { backgroundColor: colors.surfaceSecondary }]}>
                      <Text style={[styles.commentBadgeText, { color: colors.textMuted }]}>
                        {c.commentType === 'didactic_transfer' ? '🏫 Didaktik' : c.commentType === 'creative_synthesis' ? '☍ Synthese' : '⚡️ Dialektik'} • {c.authorBadge || 'Sparring'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.commentMetaRight}>
                    <Text style={[styles.commentScore, { color: colors.textMuted }]}>
                      ▲ {c.score}
                    </Text>
                    <Text style={[styles.commentTime, { color: colors.textMuted }]}>
                      {c.timeAgo}
                    </Text>
                  </View>
                </View>

                <Text style={[styles.commentBody, { color: colors.textPrimary }]}>
                  {c.text}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* 14. Reddit Awards Interactive Modal */}
      <Modal
        visible={showAwardModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAwardModal(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowAwardModal(false)}
        >
          <View
            style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                  Beitrag auszeichnen
                </Text>
                <Text style={[styles.modalSubtitle, { color: colors.textMuted }]}>
                  Würdige exzellente Recherche, Tiefe oder Inspiration
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowAwardModal(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={styles.awardsGrid}>
              <TouchableOpacity
                style={[styles.awardOptionCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}
                onPress={() => handleGiveAward('gold')}
                activeOpacity={0.8}
              >
                <Text style={styles.awardOptionIcon}>🥇</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.awardOptionTitle, { color: colors.textPrimary }]}>Goldener Gedanke</Text>
                  <Text style={[styles.awardOptionDesc, { color: colors.textSecondary }]}>Für fundamentale Klarheit und intellektuellen Wert</Text>
                </View>
                <View style={[styles.awardBadge, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                  <Text style={[styles.awardBadgeText, { color: '#F59E0B' }]}>+{awards.gold || 0}</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.awardOptionCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}
                onPress={() => handleGiveAward('brain')}
                activeOpacity={0.8}
              >
                <Text style={styles.awardOptionIcon}>🧠</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.awardOptionTitle, { color: colors.textPrimary }]}>Tiefgang-Award</Text>
                  <Text style={[styles.awardOptionDesc, { color: colors.textSecondary }]}>Für tiefgründige Argumentation und Dialektik</Text>
                </View>
                <View style={[styles.awardBadge, { backgroundColor: 'rgba(139, 92, 246, 0.15)' }]}>
                  <Text style={[styles.awardBadgeText, { color: '#8B5CF6' }]}>+{awards.brain || 0}</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.awardOptionCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}
                onPress={() => handleGiveAward('spark')}
                activeOpacity={0.8}
              >
                <Text style={styles.awardOptionIcon}>💎</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.awardOptionTitle, { color: colors.textPrimary }]}>Geistesblitz</Text>
                  <Text style={[styles.awardOptionDesc, { color: colors.textSecondary }]}>Für überraschende Ideen und Praxis-Transfer</Text>
                </View>
                <View style={[styles.awardBadge, { backgroundColor: 'rgba(56, 189, 248, 0.15)' }]}>
                  <Text style={[styles.awardBadgeText, { color: '#38BDF8' }]}>+{awards.spark || 0}</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 15. Award Toast Banner */}
      {awardToast && (
        <View style={[styles.awardToastBanner, { backgroundColor: colors.accent }]}>
          <Text style={styles.awardToastText}>{awardToast}</Text>
        </View>
      )}

      {/* 16. In-App Quick Link Preview Modal */}
      {originalUrl && (
        <LinkPreviewModal
          visible={showLinkPreview}
          onClose={() => setShowLinkPreview(false)}
          url={originalUrl}
          title={item.sourceReferences[0]?.title || item.title}
          publisher={item.sourceBroadcasterName || item.sourceReferences[0]?.publisher}
          domain={item.sourceDomain}
          snippet={item.feedText || item.subtitle || item.body?.slice(0, 200)}
          estimatedMinutes={item.estimatedReadingMinutes}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2
  },
  heroCard: {
    borderWidth: 1.5,
    padding: spacing.xl,
    marginBottom: spacing.lg
  },
  communityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs
  },
  spaceLeftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    flexWrap: 'nowrap',
    overflow: 'hidden'
  },
  spacePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 0.5
  },
  spaceText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2
  },
  dotSeparator: {
    marginHorizontal: 6,
    fontSize: 11
  },
  authorText: {
    fontSize: 12,
    fontWeight: '600',
    maxWidth: 130
  },
  timeText: {
    fontSize: 11
  },
  bookmarkButton: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8
  },
  flairsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
    marginBottom: spacing.sm
  },
  flairBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm
  },
  flairBadgeText: {
    fontSize: 11,
    fontWeight: '700'
  },
  evidenceBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
    borderWidth: 0.5
  },
  evidenceBadgeText: {
    fontSize: 10,
    fontWeight: '500'
  },
  imageContainer: {
    width: '100%',
    height: 190,
    borderRadius: radius.md,
    overflow: 'hidden',
    marginVertical: spacing.sm
  },
  cardImage: {
    width: '100%',
    height: '100%'
  },
  imageCreditOverlay: {
    position: 'absolute',
    bottom: 6,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.xs
  },
  imageCreditText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '500'
  },
  title: {
    fontFamily: typography.fontFamilies.serif,
    fontWeight: '700',
    letterSpacing: -0.2,
    marginBottom: 6
  },
  standardTitle: {
    fontSize: 20,
    lineHeight: 27
  },
  heroTitle: {
    fontSize: 24,
    lineHeight: 31
  },
  subtitle: {
    fontSize: typography.sizes.bodySmall,
    lineHeight: 20,
    fontStyle: 'italic',
    marginBottom: spacing.sm
  },
  feedText: {
    fontSize: 15,
    lineHeight: 23,
    letterSpacing: 0.1,
    marginBottom: spacing.sm
  },
  insightBox: {
    borderLeftWidth: 3,
    padding: spacing.sm,
    borderRadius: radius.sm,
    marginVertical: 6
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3
  },
  insightLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase'
  },
  insightText: {
    fontSize: 13,
    lineHeight: 19,
    fontStyle: 'italic'
  },
  dialecticBox: {
    borderLeftWidth: 3,
    padding: spacing.sm,
    borderRadius: radius.sm,
    marginVertical: 6
  },
  dialecticHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3
  },
  dialecticLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase'
  },
  dialecticText: {
    fontSize: 13,
    lineHeight: 19
  },
  didacticBox: {
    borderLeftWidth: 3,
    padding: spacing.sm,
    borderRadius: radius.sm,
    marginVertical: 6
  },
  didacticHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3
  },
  didacticLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase'
  },
  didacticText: {
    fontSize: 13,
    lineHeight: 19
  },
  didacticToggleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    borderWidth: 0.5,
    marginVertical: 4
  },
  didacticToggleText: {
    fontSize: 12,
    fontWeight: '600'
  },
  evergreenBox: {
    borderLeftWidth: 3,
    padding: spacing.sm,
    borderRadius: radius.sm,
    marginVertical: 6
  },
  evergreenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3
  },
  evergreenLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase'
  },
  evergreenText: {
    fontSize: 13,
    lineHeight: 19
  },
  challengeContainer: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.sm,
    marginVertical: spacing.sm
  },
  challengePromptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4
  },
  challengePromptTitle: {
    fontSize: 13,
    fontWeight: '700'
  },
  challengePromptSub: {
    fontSize: 11,
    marginTop: 2
  },
  composerBox: {
    paddingVertical: 2
  },
  composerTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8
  },
  tagSelectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8
  },
  tagButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 0.5
  },
  tagButtonText: {
    fontSize: 11,
    fontWeight: '600'
  },
  composerInput: {
    borderRadius: radius.sm,
    borderWidth: 1,
    padding: 10,
    fontSize: 13,
    minHeight: 70,
    textAlignVertical: 'top',
    marginBottom: 8
  },
  composerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8
  },
  composerCancelButton: {
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  composerCancelText: {
    fontSize: 12,
    fontWeight: '500'
  },
  composerSaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.pill
  },
  composerSaveText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700'
  },
  savedNotesList: {
    marginTop: 8,
    gap: 6
  },
  userNoteItem: {
    padding: 8,
    borderRadius: radius.sm,
    borderWidth: 0.5
  },
  userNoteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  userNoteTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  userNoteTagText: {
    fontSize: 10,
    fontWeight: '700'
  },
  userNoteDate: {
    fontSize: 10
  },
  userNoteContent: {
    fontSize: 12,
    lineHeight: 17
  },
  expandButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    borderWidth: 0.5,
    marginVertical: 4
  },
  expandButtonLeft: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  expandButtonText: {
    fontSize: typography.sizes.caption,
    fontWeight: '600'
  },
  expandButtonMeta: {
    fontSize: typography.sizes.micro,
    fontWeight: '500'
  },
  progressTrack: {
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: spacing.sm,
    marginBottom: 4
  },
  progressBar: {
    height: '100%',
    borderRadius: 2
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 0.5,
    paddingTop: spacing.sm,
    marginTop: 6
  },
  voteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 0.5,
    gap: 4
  },
  voteArrow: {
    padding: 2
  },
  voteScoreText: {
    fontSize: 12,
    fontWeight: '700',
    minWidth: 20,
    textAlign: 'center'
  },
  whyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill
  },
  whyText: {
    fontSize: typography.sizes.micro,
    fontWeight: '500'
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  completedText: {
    fontSize: typography.sizes.micro,
    fontWeight: '600'
  },
  sourceText: {
    fontSize: typography.sizes.micro,
    fontWeight: '500',
    maxWidth: 110
  },
  sparringReplyBox: {
    marginTop: 8,
    paddingLeft: 10,
    borderLeftWidth: 2,
    paddingVertical: 4
  },
  sparringHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2
  },
  sparringHandle: {
    fontSize: 11,
    fontWeight: '700'
  },
  sparringBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4
  },
  sparringBadgeText: {
    fontSize: 9,
    fontWeight: '700'
  },
  sparringText: {
    fontSize: 11,
    lineHeight: 16,
    fontStyle: 'italic'
  },
  commentsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill
  },
  commentsButtonText: {
    fontSize: 12,
    fontWeight: '700'
  },
  discussionContainer: {
    borderTopWidth: 0.5,
    padding: spacing.md,
    marginTop: spacing.sm,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg
  },
  discussionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm
  },
  discussionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  discussionTitle: {
    fontSize: 12,
    fontWeight: '700'
  },
  replyLink: {
    fontSize: 11,
    fontWeight: '700'
  },
  commentsList: {
    gap: 8
  },
  commentCard: {
    padding: 10,
    borderRadius: radius.md,
    borderWidth: 0.5
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  commentAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  commentAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center'
  },
  commentAvatarText: {
    fontSize: 10,
    fontWeight: '800'
  },
  commentHandle: {
    fontSize: 11,
    fontWeight: '700'
  },
  commentBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3
  },
  commentBadgeText: {
    fontSize: 9
  },
  commentMetaRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  commentScore: {
    fontSize: 11,
    fontWeight: '600'
  },
  commentTime: {
    fontSize: 10
  },
  commentBody: {
    fontSize: 12,
    lineHeight: 17
  },

  // Crystal-Clear Source & Trust Banner
  sourceClearBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.sm,
    borderWidth: 0.5,
    marginBottom: spacing.xs
  },
  sourceClearLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 6
  },
  sourceClearName: {
    fontSize: 11,
    fontWeight: '700',
    maxWidth: 150
  },
  trustLevelBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4
  },
  trustLevelText: {
    fontSize: 9,
    fontWeight: '600'
  },
  sourceClearActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  sourcePreviewChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
    borderWidth: 0.5
  },
  sourcePreviewChipText: {
    fontSize: 10,
    fontWeight: '700'
  },
  openSourceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
    borderWidth: 0.5
  },
  openSourceBtnText: {
    fontSize: 11,
    fontWeight: '700'
  },

  // Prominent Rich Link Preview Card (OpenGraph / Provenance style)
  richLinkCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: 'hidden',
    marginVertical: spacing.sm
  },
  richLinkHeader: {
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center'
  },
  richLinkHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10
  },
  richLinkFavicon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center'
  },
  richLinkDomainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 2
  },
  richLinkDomain: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2
  },
  richLinkDot: {
    fontSize: 10
  },
  richLinkPublisher: {
    fontSize: 11,
    fontWeight: '600'
  },
  richLinkUrl: {
    fontSize: 10
  },
  richLinkActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderTopWidth: 0.5,
    gap: 8
  },
  richLinkPreviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.sm,
    borderWidth: 0.5
  },
  richLinkPreviewBtnText: {
    fontSize: 11,
    fontWeight: '600'
  },
  richLinkOpenBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.sm
  },
  richLinkOpenBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700'
  },

  // YouTube Video Essay Gem
  youtubeContainer: {
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: 'hidden',
    marginVertical: spacing.sm
  },
  youtubeVideoBanner: {
    position: 'relative',
    width: '100%',
    height: 180,
    backgroundColor: '#000000'
  },
  youtubeThumbnail: {
    width: '100%',
    height: '100%'
  },
  youtubePlayOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  youtubePlayBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  youtubeDurationBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  youtubeDurationText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700'
  },
  youtubeMetaBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)'
  },
  youtubeChannelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  youtubeChannelTitle: {
    fontSize: 12,
    fontWeight: '700'
  },
  youtubeViewsText: {
    fontSize: 11
  },
  watchOnYtBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm
  },
  watchOnYtText: {
    fontSize: 11,
    fontWeight: '700'
  },
  takeawaysContainer: {
    padding: 10,
    gap: 6
  },
  takeawaysHeader: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 2
  },
  takeawayRow: {
    flexDirection: 'row',
    alignItems: 'flex-start'
  },
  takeawayText: {
    fontSize: 12,
    lineHeight: 17,
    flex: 1
  },

  // High-IQ Meme & Satire
  memeContainer: {
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: 'hidden',
    marginVertical: spacing.sm,
    padding: 10
  },
  punchlineBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 10,
    borderRadius: radius.sm,
    borderLeftWidth: 3,
    marginBottom: 6
  },
  punchlineText: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
    flex: 1
  },
  satireContextRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 4
  },
  satireContextText: {
    fontSize: 11,
    lineHeight: 16,
    fontStyle: 'italic',
    flex: 1
  },

  // Book Masterpiece Recommendation
  bookContainer: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: 12,
    marginVertical: spacing.sm,
    gap: 8
  },
  bookHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  bookRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3
  },
  bookStars: {
    color: '#F59E0B',
    fontSize: 13
  },
  bookRatingNumber: {
    fontSize: 12,
    fontWeight: '700'
  },
  bookPages: {
    fontSize: 11
  },
  bookAuthor: {
    fontSize: 12
  },
  bookThesisBox: {
    borderLeftWidth: 3,
    padding: 8,
    borderRadius: radius.sm
  },
  bookThesisLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 2
  },
  bookThesisText: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
    fontStyle: 'italic'
  },
  bookWhyBox: {
    flexDirection: 'row',
    alignItems: 'flex-start'
  },
  bookWhyText: {
    fontSize: 11,
    lineHeight: 16,
    flex: 1
  },

  // Opportunity & Growth Radar
  oppContainer: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: 12,
    marginVertical: spacing.sm,
    gap: 8
  },
  oppHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  oppCategoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill
  },
  oppCategoryText: {
    fontSize: 11,
    fontWeight: '700'
  },
  oppScoreBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1
  },
  oppScoreText: {
    fontSize: 11,
    fontWeight: '800'
  },
  oppActionBox: {
    borderLeftWidth: 3,
    padding: 8,
    borderRadius: radius.sm
  },
  oppActionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 2
  },
  oppActionText: {
    fontSize: 12,
    lineHeight: 17
  },

  // Museum-Grade Visual Art & Aesthetics Showcase
  artContainer: {
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: 'hidden',
    marginVertical: spacing.sm
  },
  artImageWrapper: {
    width: '100%',
    position: 'relative',
    backgroundColor: '#0F172A',
    overflow: 'hidden'
  },
  artImage: {
    width: '100%',
    height: '100%'
  },
  artImageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.12)'
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
    fontSize: 11,
    fontWeight: '700',
    flex: 1
  },
  artImpulseBox: {
    borderLeftWidth: 3,
    padding: 10,
    borderRadius: radius.sm,
    margin: 10
  },
  artImpulseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4
  },
  artImpulseLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase'
  },
  artImpulseText: {
    fontSize: 12,
    lineHeight: 18,
    fontStyle: 'italic'
  },

  // Social Footer Extra Buttons
  awardsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    gap: 4
  },
  awardsBtnIcon: {
    fontSize: 12
  },
  awardsBtnText: {
    fontSize: 11,
    fontWeight: '700'
  },
  sourceLinkPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: radius.pill,
    maxWidth: 95
  },
  sourceLinkPillText: {
    fontSize: 10,
    fontWeight: '700'
  },

  // Award Toast
  awardToastBanner: {
    position: 'absolute',
    top: 12,
    left: 16,
    right: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6
  },
  awardToastText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center'
  },

  // Reddit Awards Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800'
  },
  modalSubtitle: {
    fontSize: 12,
    marginTop: 2
  },
  awardsGrid: {
    gap: 10
  },
  awardOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 12
  },
  awardOptionIcon: {
    fontSize: 26
  },
  awardOptionTitle: {
    fontSize: 13,
    fontWeight: '700'
  },
  awardOptionDesc: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15
  },
  awardBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill
  },
  awardBadgeText: {
    fontSize: 11,
    fontWeight: '800'
  },
  kurzCheckBox: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  kurzCheckHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  kurzCheckHeaderTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  kurzCheckSection: {
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  kurzCheckLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  kurzCheckText: {
    fontSize: 13,
    lineHeight: 19,
  },
  kurzCheckFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    gap: 8,
  },
  tieferGrabenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
  },
  tieferGrabenBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  fullReaderBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  fullReaderBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  kurzCheckPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    marginRight: 6,
  },
  kurzCheckPillText: {
    fontSize: 11,
    fontWeight: '600',
  }
});
