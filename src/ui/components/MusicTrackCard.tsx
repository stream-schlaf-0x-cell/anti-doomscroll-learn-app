import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MusicTrackItem, MusicRecommendationService } from '../../core/music/musicRecommendationService';
import { useApp } from '../../core/context/AppContext';
import { radius, spacing } from '../theme';

interface MusicTrackCardProps {
  track: MusicTrackItem;
}

export const MusicTrackCard: React.FC<MusicTrackCardProps> = ({ track }) => {
  const { colors } = useApp();
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const togglePlayback = () => {
    if (typeof window === 'undefined') return;

    if (isPlaying) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setIsPlaying(false);
    } else {
      if (!audioRef.current) {
        audioRef.current = new window.Audio(track.previewUrl);
        audioRef.current.onended = () => setIsPlaying(false);
        audioRef.current.onerror = () => setIsPlaying(false);
      }
      audioRef.current.play().catch(() => setIsPlaying(false));
      setIsPlaying(true);
    }
  };

  const openAppleMusic = () => {
    if (typeof window !== 'undefined' && window.open) {
      window.open(track.appleMusicUrl, '_blank', 'noopener,noreferrer');
    } else {
      Linking.openURL(track.appleMusicUrl);
    }
  };

  const openSpotify = () => {
    if (typeof window !== 'undefined' && window.open) {
      window.open(track.spotifyUrl, '_blank', 'noopener,noreferrer');
    } else {
      Linking.openURL(track.spotifyUrl);
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
      {/* Header with Artwork & Playback */}
      <View style={styles.topRow}>
        <View style={styles.artworkContainer}>
          <Image
            source={{ uri: track.artworkUrl }}
            style={styles.artwork}
            resizeMode="cover"
          />
          <TouchableOpacity
            onPress={togglePlayback}
            style={[styles.playOverlayBtn, { backgroundColor: colors.accent }]}
            activeOpacity={0.85}
            accessibilityLabel={isPlaying ? 'Pausieren' : '30s Audio-Vorschau abspielen'}
          >
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={18}
              color="#FFFFFF"
              style={{ marginLeft: isPlaying ? 0 : 2 }}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.metaCol}>
          <View style={styles.badgeRow}>
            <View style={[styles.sourceBadge, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}>
              <Ionicons name="musical-notes" size={11} color="#EF4444" style={{ marginRight: 4 }} />
              <Text style={styles.sourceBadgeText}>iTunes & Spotify Audio-Basis</Text>
            </View>
            <Text style={[styles.durationText, { color: colors.textMuted }]}>
              {isPlaying ? '▶ Spielt 30s Vorschau' : MusicRecommendationService.formatDuration(track.durationSeconds)}
            </Text>
          </View>

          <Text style={[styles.trackTitle, { color: colors.textPrimary }]} numberOfLines={1}>
            {track.title}
          </Text>
          <Text style={[styles.artistName, { color: colors.textSecondary }]} numberOfLines={1}>
            {track.artist} • <Text style={{ fontStyle: 'italic', color: colors.textMuted }}>{track.album}</Text>
          </Text>

          <Text style={[styles.acousticProfile, { color: colors.accent }]} numberOfLines={1}>
            ◎ {track.acousticProfile}
          </Text>
        </View>
      </View>

      {/* Rationale / Why Recommended */}
      <View style={[styles.whyBox, { backgroundColor: colors.surface, borderLeftColor: colors.accent }]}>
        <Text style={[styles.whyText, { color: colors.textPrimary }]}>
          <Text style={{ fontWeight: '700', color: colors.accent }}>Kognitiver Nutzen: </Text>
          {track.whyRecommended}
        </Text>
      </View>

      {/* External Streaming Provider Actions */}
      <View style={[styles.actionsRow, { borderTopColor: colors.borderSubtle }]}>
        <TouchableOpacity
          onPress={openAppleMusic}
          style={[styles.providerBtn, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
          activeOpacity={0.8}
        >
          <Ionicons name="logo-apple" size={14} color={colors.textPrimary} style={{ marginRight: 5 }} />
          <Text style={[styles.providerBtnText, { color: colors.textPrimary }]}>Apple Music ↗</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={openSpotify}
          style={[styles.providerBtn, { backgroundColor: 'rgba(16, 185, 129, 0.12)', borderColor: 'rgba(16, 185, 129, 0.3)' }]}
          activeOpacity={0.8}
        >
          <Ionicons name="radio-outline" size={14} color="#10B981" style={{ marginRight: 5 }} />
          <Text style={[styles.providerBtnText, { color: '#10B981' }]}>Spotify ↗</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    marginVertical: spacing.sm
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  artworkContainer: {
    position: 'relative',
    width: 68,
    height: 68,
    borderRadius: radius.md,
    overflow: 'hidden',
    marginRight: spacing.md,
    boxShadow: '0 4px 10px rgba(0,0,0,0.2)'
  },
  artwork: {
    width: '100%',
    height: '100%'
  },
  playOverlayBtn: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
  },
  metaCol: {
    flex: 1
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  sourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.full
  },
  sourceBadgeText: {
    color: '#EF4444',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3
  },
  durationText: {
    fontSize: 11,
    fontWeight: '500'
  },
  trackTitle: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20
  },
  artistName: {
    fontSize: 13,
    marginBottom: 2
  },
  acousticProfile: {
    fontSize: 11,
    fontWeight: '600'
  },
  whyBox: {
    padding: 10,
    borderRadius: radius.sm,
    borderLeftWidth: 3,
    marginVertical: spacing.sm
  },
  whyText: {
    fontSize: 12,
    lineHeight: 18
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 1
  },
  providerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1
  },
  providerBtnText: {
    fontSize: 12,
    fontWeight: '600'
  }
});
