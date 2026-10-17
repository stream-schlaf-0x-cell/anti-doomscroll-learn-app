import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  Linking,
  Modal,
  ScrollView,
  useWindowDimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScoredFeedItem } from '../../core/domain/ranking';
import {
  formatVerifiedProvenanceLabel,
  TOPIC_SPACE_MAP,
  TopicTag,
  UserNote
} from '../../core/domain/types';
import { useApp } from '../../core/context/AppContext';
import { typography, radius, spacing } from '../theme';
import { LinkPreviewModal } from './LinkPreviewModal';
import { MusicTrackCard } from './MusicTrackCard';
import { CURATED_SOUND_MASTERS, MusicTrackItem } from '../../core/music/musicRecommendationService';
import { optimizeImageUrl } from '../../core/utils/imageQuality';

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
    if (diffMs < 0) return 'Gerade eben';
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    if (diffMinutes < 5) return 'Gerade eben';
    if (diffMinutes < 60) return `vor ${diffMinutes} Min.`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `vor ${diffHours} Std.`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'gestern';
    if (diffDays < 7) return `vor ${diffDays} Tagen`;
    return new Date(isoString).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
  } catch {
    return 'Heute';
  }
}

function isAuthenticCardImage(item: ScoredFeedItem): boolean {
  if (!item.imageUrl || item.imageUrl.trim().length === 0) return false;
  if (item.hasAuthenticImage === false) return false;
  // Never treat generic Unsplash stock placeholders as authentic article images
  if (item.imageUrl.includes('images.unsplash.com')) return false;
  return true;
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
  const {
    colors,
    interactions,
    toggleSaveItem,
    openArticle,
    openWhyModal,
    voteItem,
    setFeedback,
    addNote
  } = useApp();

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
  const [noteText, setNoteText] = useState('');
  const [selectedTag, setSelectedTag] = useState<'einwand' | 'unterricht' | 'these' | 'notiz'>('einwand');
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [showLinkPreview, setShowLinkPreview] = useState(false);
  const [showImageLightbox, setShowImageLightbox] = useState(false);
  const [naturalAspectRatio, setNaturalAspectRatio] = useState<number | null>(null);

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
    if (typeof window !== 'undefined' && window.open) {
      window.open(originalUrl, '_blank', 'noopener,noreferrer');
    } else {
      Linking.openURL(originalUrl);
    }
  };

  const interaction = interactions[item.id];
  const isSaved = interaction?.saved ?? false;
  const progress = interaction?.progressPercent ?? 0;
  const isCompleted = interaction?.completedAt !== undefined || progress >= 95;
  const voteScore = interaction?.voteScore ?? 0;
  const currentFeedback = interaction?.feedback ?? 'neutral';
  const userNotes: UserNote[] = interaction?.userNotes ?? [];

  // Space metadata (colorful Reddit-like community identity)
  const spaceMeta = TOPIC_SPACE_MAP[item.primaryTopic as TopicTag];
  const spaceName = item.space || spaceMeta?.space || `c/${item.primaryTopic}`;
  const spaceColor = spaceMeta?.color || colors.accent;
  const spaceBgTint = spaceMeta?.bgTint || colors.accentSubtle;

  const publisherName =
    item.sourceBroadcasterName ||
    item.sourceReferences[0]?.publisher ||
    item.sourceReferences[0]?.author ||
    'Fachquelle';
  const timeAgo = formatRelativeTime(item.publishedAt);
  const provenanceLabel = formatVerifiedProvenanceLabel(item);

  const displayFeedText =
    item.feedText && item.feedText.trim().length > 0 ? item.feedText.trim() : (item.body || '').trim();

  // Determine whether this card is a 20-second quick card (readable in full right on the card)
  const isArtCard = item.format === 'art_showcase' || Boolean(item.artMeta);
  const isMemeCard = item.format === 'meme' || Boolean(item.memeMeta);
  const isQuick20sCard =
    !isArtCard &&
    (isMemeCard ||
      item.format === 'concise_insight' ||
      (item.wordCount !== undefined && item.wordCount <= 95) ||
      (displayFeedText.length <= 420 && (item.articleBody || displayFeedText).length <= 460));

  const showAuthenticImage = !isArtCard && !imageError && isAuthenticCardImage(item);
  const activeVisualUri = isArtCard
    ? optimizeImageUrl(item.artMeta?.highResImageUrl || item.imageUrl || '', 1200)
    : showAuthenticImage
    ? optimizeImageUrl(item.imageUrl!) || item.imageUrl!
    : '';

  // Dynamically measure real image dimensions so comics & diagrams are NEVER cropped
  useEffect(() => {
    if (!activeVisualUri) return;
    let cancelled = false;
    Image.getSize(
      activeVisualUri,
      (w, h) => {
        if (!cancelled && w > 0 && h > 0) {
          setNaturalAspectRatio(Math.max(0.45, Math.min(2.6, w / h)));
        }
      },
      () => {
        // Fallback handled by default aspectRatio
      }
    );
    return () => {
      cancelled = true;
    };
  }, [activeVisualUri]);

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

  // Hide boilerplate feedText when it merely repeats HN metadata or comic alt-text punchline
  const shouldShowBodyText = useMemo(() => {
    if (!displayFeedText) return false;
    const lower = displayFeedText.toLowerCase();
    if (
      lower.startsWith('diskutiert auf hacker news') ||
      lower.startsWith('aktuelle fachdiskussion auf hacker news') ||
      lower.startsWith('top-thema auf hacker news')
    ) {
      return false;
    }
    if (isMemeCard) {
      if (item.memeMeta?.punchline && displayFeedText.trim() === item.memeMeta.punchline.trim()) {
        return false;
      }
      if (lower.includes('originalbeitrag veröffentlicht bei')) {
        return false;
      }
    }
    return true;
  }, [displayFeedText, isMemeCard, item.memeMeta]);

  const handleCardPress = () => {
    openArticle(item.id);
  };

  const handleUpvote = () => {
    if (voteScore === 1) {
      voteItem(item.id, 'clear');
    } else {
      voteItem(item.id, 'up');
      if (currentFeedback === 'neutral') {
        setFeedback(item.id, 'more_like_this');
      }
    }
  };

  const handleDownvote = () => {
    if (voteScore === -1) {
      voteItem(item.id, 'clear');
    } else {
      voteItem(item.id, 'down');
      if (currentFeedback === 'neutral') {
        setFeedback(item.id, 'less_like_this');
      }
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

  // Single high-signal callout (only when it adds real value beyond the feedText)
  const counterClaim =
    item.perspectiveDetails?.counterPerspective ||
    item.deepeningOptions?.counterArgument ||
    null;
  const didacticTransfer =
    item.didacticTransfer || item.didacticSeed || null;

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
      {/* 1. SINGLE-LINE REDDIT HEADER: [c/space] • Publisher • Time • ~Min + [Provenance] [Bookmark] */}
      <View style={styles.topHeaderRow}>
        <View style={styles.topLeftMeta}>
          <TouchableOpacity
            onPress={() => onInvestigateTopic && onInvestigateTopic(item.primaryTopic)}
            activeOpacity={0.75}
            style={[styles.spacePill, { backgroundColor: spaceBgTint, borderColor: spaceColor }]}
          >
            <Ionicons
              name={(spaceMeta?.icon as any) || 'planet-outline'}
              size={12}
              color={spaceColor}
              style={{ marginRight: 4 }}
            />
            <Text style={[styles.spaceText, { color: spaceColor }]}>{spaceName}</Text>
          </TouchableOpacity>

          <Text style={[styles.dotSeparator, { color: colors.textMuted }]}>•</Text>
          <Text style={[styles.publisherText, { color: colors.textPrimary }]} numberOfLines={1}>
            {publisherName}
          </Text>
          <Text style={[styles.dotSeparator, { color: colors.textMuted }]}>•</Text>
          <Text style={[styles.timeText, { color: colors.textMuted }]}>
            {timeAgo}
            {!isQuick20sCard && item.estimatedReadingMinutes > 1 ? ` • ${item.estimatedReadingMinutes} Min.` : ''}
          </Text>
        </View>

        <View style={styles.topRightActions}>
          {/* Honest Provenance Pill */}
          <View
            style={[
              styles.provenancePill,
              {
                backgroundColor:
                  item.sourceTrustLevel === 'public_broadcaster'
                    ? 'rgba(16, 185, 129, 0.12)'
                    : item.sourceTrustLevel === 'peer_reviewed'
                    ? 'rgba(59, 130, 246, 0.12)'
                    : item.sourceTrustLevel === 'museum_collection'
                    ? 'rgba(245, 158, 11, 0.14)'
                    : colors.surfaceSecondary,
                borderColor: colors.borderSubtle
              }
            ]}
          >
            <Text
              style={[
                styles.provenancePillText,
                {
                  color:
                    item.sourceTrustLevel === 'public_broadcaster'
                      ? '#10B981'
                      : item.sourceTrustLevel === 'peer_reviewed'
                      ? '#3B82F6'
                      : item.sourceTrustLevel === 'museum_collection'
                      ? '#D97706'
                      : colors.textSecondary
                }
              ]}
              numberOfLines={1}
            >
              {provenanceLabel}
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => toggleSaveItem(item.id)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={[styles.bookmarkBtn, { backgroundColor: isSaved ? colors.accentSubtle : 'transparent' }]}
            accessibilityLabel={isSaved ? 'Aus Bibliothek entfernen' : 'Merken'}
          >
            <Ionicons
              name={isSaved ? 'bookmark' : 'bookmark-outline'}
              size={16}
              color={isSaved ? colors.accent : colors.textMuted}
            />
          </TouchableOpacity>
        </View>
      </View>

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

        {!isSubtitleRedundant && item.subtitle && (
          <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={2}>
            {item.subtitle}
          </Text>
        )}
      </TouchableOpacity>

      {/* 3. AUTHENTIC VISUALS: Uncropped Comics, Museum Artworks & Science Photos */}
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
              onError={() => setImageError(true)}
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
              ? { height: undefined, aspectRatio: Math.max(1.2, Math.min(2.2, naturalAspectRatio)), maxHeight: 340 }
              : null
          ]}
        >
          <Image
            source={{ uri: activeVisualUri }}
            style={[styles.cardImage, isMemeCard && styles.comicImage]}
            resizeMode={isMemeCard ? 'contain' : 'cover'}
            onError={() => setImageError(true)}
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

      {/* 4. ADAPTIVE CARD BODY (Hidden if redundant comic/HN boilerplate) */}
      {shouldShowBodyText && (
        <TouchableOpacity activeOpacity={0.92} onPress={handleCardPress}>
          <Text
            style={[
              styles.feedText,
              isQuick20sCard && styles.quick20sFeedText,
              { color: colors.textPrimary }
            ]}
            numberOfLines={isQuick20sCard ? undefined : isHero ? 6 : 4}
          >
            {displayFeedText}
          </Text>
        </TouchableOpacity>
      )}

      {/* Special Format Compact Callout: Comic Alt-Text Bonus Punchline / Book Thesis / Sound Track */}
      {item.memeMeta && (
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

      {matchedMusicTrack && <MusicTrackCard track={matchedMusicTrack} />}

      {/* 5. INLINE REDDIT EXPANDO: Kurz-Check (Abstract, Gegenstimme & Praxis-Transfer on demand) */}
      {isKurzCheckOpen && (
        <View style={[styles.kurzCheckBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
          <View style={styles.kurzCheckHeader}>
            <Text style={[styles.kurzCheckHeaderTitle, { color: spaceColor }]}>
              ⚡ Kompakt-Einordnung & Perspektive
            </Text>
            <TouchableOpacity onPress={toggleKurzCheck} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle-outline" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {item.keyInsight && (
            <View style={styles.kurzCheckSection}>
              <Text style={[styles.kurzCheckLabel, { color: colors.accent }]}>💡 Kernaussage</Text>
              <Text style={[styles.kurzCheckText, { color: colors.textPrimary }]}>{item.keyInsight}</Text>
            </View>
          )}

          {counterClaim && (
            <View style={styles.kurzCheckSection}>
              <Text style={[styles.kurzCheckLabel, { color: '#8B5CF6' }]}>⚖️ Gegenperspektive</Text>
              <Text style={[styles.kurzCheckText, { color: colors.textSecondary }]}>{counterClaim}</Text>
            </View>
          )}

          {didacticTransfer && (
            <View style={styles.kurzCheckSection}>
              <Text style={[styles.kurzCheckLabel, { color: '#10B981' }]}>🏫 Transfer & Praxis</Text>
              <Text style={[styles.kurzCheckText, { color: colors.textSecondary }]}>{didacticTransfer}</Text>
            </View>
          )}

          <View style={styles.kurzCheckFooterRow}>
            <TouchableOpacity
              onPress={handleCardPress}
              style={[styles.tieferGrabenBtn, { backgroundColor: colors.accent }]}
            >
              <Ionicons name="book-outline" size={13} color="#FFFFFF" style={{ marginRight: 5 }} />
              <Text style={styles.tieferGrabenBtnText}>Vollständige Lektüre & Einordnung öffnen →</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* 7. ON-DEMAND INLINE NOTE & SPARRING COMPOSER (Only visible when clicked or when user has notes) */}
      {(isComposerOpen || userNotes.length > 0) && (
        <View style={[styles.composerContainer, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
          {isComposerOpen && (
            <View style={styles.composerBox}>
              <Text style={[styles.composerTitle, { color: colors.textPrimary }]}>
                {item.challengePrompt || 'Eigene Notiz, Einwand oder Unterrichts-Idee festhalten:'}
              </Text>
              <View style={styles.tagSelectorRow}>
                {[
                  { id: 'einwand', label: '⚡ Einwand' },
                  { id: 'unterricht', label: '🏫 Unterricht' },
                  { id: 'these', label: '💡 These' },
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

              <TextInput
                value={noteText}
                onChangeText={setNoteText}
                placeholder="Deinen Gedanken oder Widerspruch lokal notieren…"
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

              <View style={styles.composerActions}>
                <TouchableOpacity
                  onPress={() => {
                    setNoteText('');
                    setIsComposerOpen(false);
                  }}
                  style={styles.composerCancelButton}
                >
                  <Text style={[styles.composerCancelText, { color: colors.textMuted }]}>Schließen</Text>
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
                    {isSubmittingNote ? 'Speichern…' : 'Notiz sichern'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {userNotes.length > 0 && (
            <View style={styles.savedNotesList}>
              {userNotes.map(n => (
                <View
                  key={n.id}
                  style={[styles.userNoteItem, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
                >
                  <View style={styles.userNoteHeader}>
                    <Text style={[styles.userNoteTagText, { color: colors.accent }]}>
                      {n.tag === 'einwand'
                        ? '⚡ Dein Einwand'
                        : n.tag === 'unterricht'
                        ? '🏫 Unterrichtsidee'
                        : n.tag === 'these'
                        ? '💡 Deine These'
                        : '📝 Deine Notiz'}
                    </Text>
                    <Text style={[styles.userNoteDate, { color: colors.textMuted }]}>
                      {formatRelativeTime(n.createdAt)}
                    </Text>
                  </View>
                  <Text style={[styles.userNoteContent, { color: colors.textPrimary }]}>{n.text}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* 8. READING PROGRESS BAR (When partially read) */}
      {progress > 0 && !isCompleted && (
        <View style={[styles.progressTrack, { backgroundColor: colors.surfaceSecondary }]}>
          <View style={[styles.progressBar, { width: `${progress}%`, backgroundColor: spaceColor }]} />
        </View>
      )}

      {/* 9. CLEAN REDDIT-STYLE ACTION BAR (Direct, Playful, Zero Duplication) */}
      <View style={[styles.actionBar, { borderTopColor: colors.borderSubtle }]}>
        {/* 9.1 Vote Pill (Local relevance signal + Honest external HN score if present) */}
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
          >
            {item.externalCommunityScore && item.externalCommunityScore.points > 0
              ? `${item.externalCommunityScore.points + voteScore} ${item.externalCommunityScore.platform === 'Hacker News' ? 'HN' : item.externalCommunityScore.platform}`
              : voteScore > 0
              ? '+1'
              : voteScore < 0
              ? '-1'
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

        {/* 9.2 Primary Reader Button */}
        <TouchableOpacity
          onPress={handleCardPress}
          style={[styles.primaryReadBtn, { backgroundColor: colors.accentSubtle, borderColor: colors.accent }]}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Im Reader öffnen"
        >
          <Ionicons name="book-outline" size={13} color={colors.accent} style={{ marginRight: 5 }} />
          <Text style={[styles.primaryReadBtnText, { color: colors.accent }]}>
            {isQuick20sCard ? 'Einordnung' : `Lesen (${item.estimatedReadingMinutes}m)`}
          </Text>
        </TouchableOpacity>

        {/* 9.3 Reddit-style Inline Expando (⚡ Abstract / Kurz-Check) */}
        {(Boolean(item.keyInsight) || Boolean(counterClaim) || Boolean(didacticTransfer)) && (
          <TouchableOpacity
            onPress={toggleKurzCheck}
            style={[
              styles.actionChip,
              {
                backgroundColor: isKurzCheckOpen ? colors.accentSubtle : colors.surfaceSecondary,
                borderColor: isKurzCheckOpen ? colors.accent : colors.borderSubtle
              }
            ]}
            accessibilityRole="button"
            accessibilityLabel="Kompakt-Einordnung aufklappen"
          >
            <Ionicons
              name={isKurzCheckOpen ? 'flash' : 'flash-outline'}
              size={13}
              color={isKurzCheckOpen ? colors.accent : colors.textSecondary}
              style={{ marginRight: 4 }}
            />
            <Text
              style={[
                styles.actionChipText,
                { color: isKurzCheckOpen ? colors.accent : colors.textSecondary }
              ]}
            >
              Abstract
            </Text>
          </TouchableOpacity>
        )}

        {/* 9.4 Local Note / Reflection Toggle */}
        <TouchableOpacity
          onPress={() => setIsComposerOpen(prev => !prev)}
          style={[
            styles.actionChip,
            {
              backgroundColor:
                isComposerOpen || userNotes.length > 0 ? colors.accentSubtle : colors.surfaceSecondary,
              borderColor:
                isComposerOpen || userNotes.length > 0 ? colors.accent : colors.borderSubtle
            }
          ]}
          accessibilityRole="button"
          accessibilityLabel="Eigene Notiz schreiben"
        >
          <Ionicons
            name="chatbubble-outline"
            size={12}
            color={isComposerOpen || userNotes.length > 0 ? colors.accent : colors.textSecondary}
            style={{ marginRight: 4 }}
          />
          <Text
            style={[
              styles.actionChipText,
              { color: isComposerOpen || userNotes.length > 0 ? colors.accent : colors.textSecondary }
            ]}
          >
            {userNotes.length > 0 ? `${userNotes.length} Notiz` : 'Notiz'}
          </Text>
        </TouchableOpacity>

        {/* 9.5 Direct Source Link */}
        {originalUrl && (
          <TouchableOpacity
            onPress={handleOpenOriginalSource}
            onLongPress={() => setShowLinkPreview(true)}
            style={[styles.actionChip, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}
            accessibilityRole="link"
            accessibilityLabel="Originalquelle im Browser öffnen"
          >
            <Ionicons name="open-outline" size={12} color={colors.textSecondary} style={{ marginRight: 3 }} />
            <Text style={[styles.actionChipText, { color: colors.textSecondary }]} numberOfLines={1}>
              {item.sourceDomain || 'Quelle'} ↗
            </Text>
          </TouchableOpacity>
        )}

        {/* 9.6 Right-Aligned Why? Info */}
        <TouchableOpacity
          onPress={() => openWhyModal(item)}
          style={styles.whyIconBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Warum sehe ich diesen Beitrag?"
        >
          <Ionicons name="sparkles-outline" size={14} color={colors.textMuted} />
        </TouchableOpacity>

        {isCompleted && (
          <View style={styles.completedBadge}>
            <Ionicons name="checkmark-circle" size={14} color={colors.success} />
          </View>
        )}
      </View>

      {/* Quick Link Preview Modal (on long-press of source link) */}
      {originalUrl && (
        <LinkPreviewModal
          visible={showLinkPreview}
          onClose={() => setShowLinkPreview(false)}
          url={originalUrl}
          title={item.sourceReferences[0]?.title || item.title}
          publisher={publisherName}
          domain={item.sourceDomain}
          snippet={displayFeedText.slice(0, 240)}
          estimatedMinutes={item.estimatedReadingMinutes}
        />
      )}

      {/* Fullscreen Comic & Artwork Zoom Lightbox */}
      {Boolean(activeVisualUri) && (
        <Modal
          visible={showImageLightbox}
          transparent
          animationType="fade"
          onRequestClose={() => setShowImageLightbox(false)}
        >
          <View style={styles.lightboxBackdrop}>
            <View style={styles.lightboxTopBar}>
              <View style={{ flex: 1 }}>
                <Text style={styles.lightboxTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.lightboxSub} numberOfLines={1}>
                  {publisherName} • {provenanceLabel}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowImageLightbox(false)}
                style={styles.lightboxCloseBtn}
                accessibilityLabel="Vollbild schließen"
              >
                <Ionicons name="close" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={styles.lightboxScrollContent}
              maximumZoomScale={3}
              minimumZoomScale={1}
              centerContent
            >
              <View
                style={[
                  styles.lightboxCanvas,
                  isMemeCard && { backgroundColor: '#FFFFFF', padding: 16, borderRadius: radius.md }
                ]}
              >
                <Image
                  source={{ uri: activeVisualUri }}
                  style={[
                    styles.lightboxImage,
                    naturalAspectRatio ? { aspectRatio: naturalAspectRatio } : { height: 540 }
                  ]}
                  resizeMode="contain"
                />
              </View>

              {item.memeMeta?.punchline && (
                <View style={styles.lightboxPunchlineBox}>
                  <Text style={styles.lightboxPunchlineLabel}>🎁 Bonus-Punchline (Alt-Text):</Text>
                  <Text style={styles.lightboxPunchlineText}>„{item.memeMeta.punchline}“</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </Modal>
      )}
    </View>
  );
};

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
    flexShrink: 1
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
    justifyContent: 'center',
    alignItems: 'center'
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
    height: 250,
    borderRadius: radius.md,
    overflow: 'hidden',
    marginVertical: 8,
    backgroundColor: '#0F172A',
    position: 'relative'
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
    position: 'relative',
    backgroundColor: '#0F172A'
  },
  artImage: {
    width: '100%',
    height: '100%'
  },
  lightboxBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(9, 13, 22, 0.94)'
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
  feedText: {
    fontSize: 14.5,
    lineHeight: 22,
    marginBottom: 8
  },
  quick20sFeedText: {
    fontSize: 15,
    lineHeight: 23.5
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
    flexWrap: 'wrap',
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 0.5
  },
  votePill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 0.5,
    paddingHorizontal: 6,
    paddingVertical: 3,
    gap: 4
  },
  voteBtn: {
    padding: 1
  },
  voteLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    minWidth: 28,
    textAlign: 'center'
  },
  primaryReadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1
  },
  primaryReadBtnText: {
    fontSize: 11.5,
    fontWeight: '700'
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
    fontWeight: '600'
  },
  whyIconBtn: {
    marginLeft: 'auto',
    padding: 4
  },
  completedBadge: {
    marginLeft: 2
  }
});
