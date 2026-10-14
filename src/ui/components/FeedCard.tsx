import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, TextInput } from 'react-native';
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

interface FeedCardProps {
  item: ScoredFeedItem;
  isHero?: boolean;
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

export const FeedCard: React.FC<FeedCardProps> = ({ item, isHero = false }) => {
  const { colors, interactions, toggleSaveItem, openArticle, openWhyModal, voteItem, addNote } = useApp();

  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [isDiscussionOpen, setIsDiscussionOpen] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [selectedTag, setSelectedTag] = useState<'einwand' | 'unterricht' | 'these' | 'notiz'>('einwand');
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  const [imageError, setImageError] = useState(false);

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
  const baseUpvotes = item.upvotesCount || 42;
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

  // Determine format and evidence tier text
  const formatText = item.flair || (item.format ? formatFeedItemFormat(item.format) : null);
  const evidenceText = formatEvidenceTier(item.evidenceTier);

  // Check if article has substantial longform text beyond the card's feedText
  const hasExpandedBody = Boolean(
    (item.articleBody && item.articleBody.trim().length > (item.feedText?.trim().length || 0) + 40) ||
    (item.body && item.body.trim().length > (item.feedText?.trim().length || 0) + 40)
  );

  const displayFeedText = item.feedText && item.feedText.trim().length > 0
    ? item.feedText
    : item.body;

  // Dialectic counter-argument or claim
  const counterClaim = item.perspectiveDetails?.claim || (item.isChallengingPerspective ? item.subtitle : null);
  const didacticTransfer = item.didacticSeed || (item.isTeachingRelated ? item.relevanceExplanation : null);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: isHero ? colors.cardHighlight : colors.surface,
          borderColor: isHero ? colors.accent : colors.borderSubtle
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

      {/* 2. Flairs & Evidence Row */}
      <View style={styles.flairsRow}>
        {formatText && (
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
            source={{ uri: item.imageUrl }}
            style={styles.cardImage}
            resizeMode="cover"
            onError={() => setImageError(true)}
          />
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

        {item.subtitle && item.subtitle.trim().length > 0 && (
          <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={2}>
            {item.subtitle}
          </Text>
        )}
      </TouchableOpacity>

      {/* 5. Substantive Standalone Feed Reading */}
      <Text style={[styles.feedText, { color: colors.textPrimary }]} numberOfLines={isHero ? 7 : 5}>
        {displayFeedText}
      </Text>

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

      {/* 7. Dialectic Skeptic's Counter-Argument (if present) */}
      {item.isChallengingPerspective && counterClaim && (
        <View style={[styles.dialecticBox, { backgroundColor: colors.surfaceSecondary, borderLeftColor: '#8B5CF6' }]}>
          <View style={styles.dialecticHeader}>
            <Ionicons name="git-compare-outline" size={14} color="#8B5CF6" style={{ marginRight: 5 }} />
            <Text style={[styles.dialecticLabel, { color: '#8B5CF6' }]}>Streitfrage & Skeptiker-Einwand</Text>
          </View>
          <Text style={[styles.dialecticText, { color: colors.textSecondary }]}>
            {counterClaim}
          </Text>
        </View>
      )}

      {/* 8. Didactic Laboratory Transfer (if present) */}
      {item.isTeachingRelated && didacticTransfer && (
        <View style={[styles.didacticBox, { backgroundColor: colors.surfaceSecondary, borderLeftColor: '#10B981' }]}>
          <View style={styles.didacticHeader}>
            <Ionicons name="school-outline" size={14} color="#10B981" style={{ marginRight: 5 }} />
            <Text style={[styles.didacticLabel, { color: '#10B981' }]}>Didaktik-Labor & Transfer</Text>
          </View>
          <Text style={[styles.didacticText, { color: colors.textSecondary }]}>
            {didacticTransfer}
          </Text>
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

      {/* 10. Progressive Reader Action (when longform body exists) */}
      {hasExpandedBody && (
        <TouchableOpacity
          onPress={handleCardPress}
          activeOpacity={0.75}
          style={[styles.expandButton, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}
        >
          <View style={styles.expandButtonLeft}>
            <Ionicons name="book-outline" size={14} color={colors.accent} style={{ marginRight: 6 }} />
            <Text style={[styles.expandButtonText, { color: colors.accent }]}>
              Im Lesemodus vertiefen
            </Text>
          </View>
          <Text style={[styles.expandButtonMeta, { color: colors.textMuted }]}>
            {item.wordCount} Wörter →
          </Text>
        </TouchableOpacity>
      )}

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
              <Ionicons name="people-outline" size={15} color={colors.accent} style={{ marginRight: 6 }} />
              <Text style={[styles.discussionTitle, { color: colors.textPrimary }]}>
                Atem Community Diskurs ({communityComments.length + userNotes.length})
              </Text>
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
                    {c.authorBadge && (
                      <View style={[styles.commentBadge, { backgroundColor: colors.surfaceSecondary }]}>
                        <Text style={[styles.commentBadgeText, { color: colors.textMuted }]}>
                          {c.authorBadge}
                        </Text>
                      </View>
                    )}
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
  }
});
