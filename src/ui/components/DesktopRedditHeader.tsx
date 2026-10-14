import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../core/context/AppContext';
import { typography, radius, spacing } from '../theme';
import { generateCraftMarkdown, copyToClipboard } from '../../core/export/craftExport';

interface DesktopRedditHeaderProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  activeSpaceName?: string;
  onSelectSpacePress?: () => void;
}

export const DesktopRedditHeader: React.FC<DesktopRedditHeaderProps> = ({
  searchQuery,
  onSearchChange,
  activeSpaceName = 'Alle Spaces',
  onSelectSpacePress
}) => {
  const {
    colors,
    isDark,
    setThemePreference,
    activeTab,
    setActiveTab,
    savedArticles,
    interactions
  } = useApp();

  // Calculate dynamic Erkenntnis-Karma:
  // Base 42 + (notes count * 10) + (saved count * 5) + (upvotes count * 2)
  const userNotesCount = Object.values(interactions).reduce(
    (acc, curr) => acc + (curr.userNotes?.length || 0),
    0
  );
  const savedCount = Object.values(interactions).filter(i => i.saved).length;
  const upvotesCount = Object.values(interactions).filter(i => i.voteScore === 1).length;
  const karmaScore = 42 + (userNotesCount * 10) + (savedCount * 5) + (upvotesCount * 2);

  const handleCopyCraft = async () => {
    const md = generateCraftMarkdown(savedArticles, interactions);
    await copyToClipboard(md);
  };

  const handleToggleTheme = () => {
    setThemePreference(isDark ? 'light' : 'dark');
  };

  return (
    <View style={[styles.headerContainer, { backgroundColor: colors.surface, borderBottomColor: colors.borderSubtle }]}>
      <View style={styles.headerInner}>
        {/* Left: Brand + Reddit Space Selector */}
        <View style={styles.leftSection}>
          <TouchableOpacity
            onPress={() => setActiveTab('feed')}
            activeOpacity={0.8}
            style={styles.brandRow}
          >
            {/* Reddit-like Circular Emblem */}
            <View style={[styles.logoEmblem, { backgroundColor: '#FF4500' }]}>
              <Text style={styles.logoSymbol}>Ψ</Text>
            </View>
            <Text style={[styles.brandText, { color: colors.textPrimary }]}>
              atem
            </Text>
          </TouchableOpacity>

          {/* Space Dropdown Selector Button */}
          <TouchableOpacity
            onPress={onSelectSpacePress}
            style={[styles.spaceDropdown, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}
            activeOpacity={0.7}
          >
            <Ionicons name="planet-outline" size={14} color={colors.accent} style={{ marginRight: 6 }} />
            <Text style={[styles.spaceDropdownText, { color: colors.textPrimary }]} numberOfLines={1}>
              {activeSpaceName}
            </Text>
            <Ionicons name="chevron-down" size={13} color={colors.textMuted} style={{ marginLeft: 4 }} />
          </TouchableOpacity>
        </View>

        {/* Center: Reddit-style Rounded Search Bar */}
        <View style={styles.centerSection}>
          <View style={[styles.searchBar, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
            <Ionicons name="search" size={15} color={colors.textMuted} style={{ marginRight: 8 }} />
            <TextInput
              value={searchQuery}
              onChangeText={onSearchChange}
              placeholder="Atem Network durchsuchen (Thesen, Didaktik, Quellen)…"
              placeholderTextColor={colors.textMuted}
              style={[styles.searchInput, { color: colors.textPrimary }]}
              autoCapitalize="none"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => onSearchChange('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Right: Karma, Budget, Craft Export, Tabs & Theme */}
        <View style={styles.rightSection}>
          {/* Karma Badge */}
          <View
            style={[styles.karmaBadge, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}
            accessibilityLabel={`Erkenntnis-Karma: ${karmaScore} Punkte`}
          >
            <Ionicons name="flame" size={14} color="#FF4500" style={{ marginRight: 4 }} />
            <Text style={[styles.karmaText, { color: colors.textPrimary }]}>
              {karmaScore} <Text style={{ fontSize: 10, color: colors.textMuted }}>Karma</Text>
            </Text>
          </View>

          {/* AI Budget Status Pill */}
          <View style={[styles.budgetBadge, { backgroundColor: 'rgba(16, 185, 129, 0.12)', borderColor: '#10B981' }]}>
            <View style={styles.greenDot} />
            <Text style={styles.budgetText}>KI aktiv • €0.14/€5</Text>
          </View>

          {/* 1-Click Craft Export Shortcut */}
          <TouchableOpacity
            onPress={handleCopyCraft}
            style={[styles.craftBtn, { backgroundColor: colors.accentSubtle, borderColor: colors.borderSubtle }]}
            activeOpacity={0.8}
            accessibilityLabel="Craft Export in Zwischenablage kopieren"
          >
            <Ionicons name="copy-outline" size={13} color={colors.accent} style={{ marginRight: 5 }} />
            <Text style={[styles.craftBtnText, { color: colors.accent }]}>Craft</Text>
          </TouchableOpacity>

          {/* Quick Tab Switcher */}
          <View style={[styles.tabGroup, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
            <TouchableOpacity
              onPress={() => setActiveTab('feed')}
              style={[
                styles.tabBtn,
                activeTab === 'feed' && { backgroundColor: colors.surface }
              ]}
            >
              <Ionicons
                name="compass-outline"
                size={15}
                color={activeTab === 'feed' ? colors.accent : colors.textMuted}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActiveTab('library')}
              style={[
                styles.tabBtn,
                activeTab === 'library' && { backgroundColor: colors.surface }
              ]}
            >
              <Ionicons
                name="bookmarks-outline"
                size={15}
                color={activeTab === 'library' ? colors.accent : colors.textMuted}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActiveTab('settings')}
              style={[
                styles.tabBtn,
                activeTab === 'settings' && { backgroundColor: colors.surface }
              ]}
            >
              <Ionicons
                name="options-outline"
                size={15}
                color={activeTab === 'settings' ? colors.accent : colors.textMuted}
              />
            </TouchableOpacity>
          </View>

          {/* Theme Toggle */}
          <TouchableOpacity
            onPress={handleToggleTheme}
            style={[styles.iconBtn, { backgroundColor: colors.surfaceSecondary }]}
            accessibilityLabel={isDark ? 'Helles Design' : 'Dunkles Design'}
          >
            <Ionicons name={isDark ? 'sunny-outline' : 'moon-outline'} size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    height: 52,
    borderBottomWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    zIndex: 10
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    maxWidth: 1140,
    width: '100%',
    alignSelf: 'center',
    gap: spacing.md
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7
  },
  logoEmblem: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center'
  },
  logoSymbol: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 16,
    lineHeight: 18
  },
  brandText: {
    fontFamily: typography.fontFamilies.serif,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 1
  },
  spaceDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 0.5,
    maxWidth: 150
  },
  spaceDropdownText: {
    fontSize: typography.sizes.micro,
    fontWeight: '700'
  },
  centerSection: {
    flex: 1,
    maxWidth: 460
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 0.5
  },
  searchInput: {
    flex: 1,
    fontSize: typography.sizes.caption,
    padding: 0
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs
  },
  karmaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 0.5
  },
  karmaText: {
    fontSize: typography.sizes.caption,
    fontWeight: '700'
  },
  budgetBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 0.5
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 5
  },
  budgetText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#10B981'
  },
  craftBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 0.5
  },
  craftBtnText: {
    fontSize: 11,
    fontWeight: '700'
  },
  tabGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.pill,
    padding: 2,
    borderWidth: 0.5
  },
  tabBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.pill
  },
  iconBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center'
  }
});
