import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DeepeningOptions } from '../../core/domain/types';
import { useApp } from '../../core/context/AppContext';
import { typography, radius, spacing } from '../theme';

interface DeepeningCardProps {
  options?: DeepeningOptions;
}

type DeepeningTab = 'didactic' | 'counter' | 'context' | 'reflection';

export const DeepeningCard: React.FC<DeepeningCardProps> = ({ options }) => {
  const { colors } = useApp();
  const [activeTab, setActiveTab] = useState<DeepeningTab>('didactic');

  if (!options) return null;

  const hasDidactic = !!options.didacticSeed;
  const hasCounter = !!options.counterArgument;
  const hasContext = !!options.philosophicalContext;
  const hasReflection = !!options.reflectionPrompt;

  let activeContent = '';
  let activeTitle = '';
  let activeIcon: any = 'bulb-outline';

  if (activeTab === 'didactic' && hasDidactic) {
    activeTitle = 'Didaktischer Impuls für den Unterricht';
    activeContent = options.didacticSeed!;
    activeIcon = 'school-outline';
  } else if (activeTab === 'counter' && hasCounter) {
    activeTitle = 'Dialektische Gegenposition';
    activeContent = options.counterArgument!;
    activeIcon = 'swap-horizontal-outline';
  } else if (activeTab === 'context' && hasContext) {
    activeTitle = 'Philosophischer & Historischer Kontext';
    activeContent = options.philosophicalContext!;
    activeIcon = 'compass-outline';
  } else if (activeTab === 'reflection' && hasReflection) {
    activeTitle = 'Persönliche Reflexionsfrage';
    activeContent = options.reflectionPrompt!;
    activeIcon = 'sparkles-outline';
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
      <View style={styles.headerRow}>
        <Ionicons name="sparkles" size={15} color={colors.accent} style={{ marginRight: 6 }} />
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          Lektüre vertiefen
        </Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        {hasDidactic && (
          <TouchableOpacity
            style={[
              styles.tabPill,
              activeTab === 'didactic' && { backgroundColor: colors.surface, borderColor: colors.accent }
            ]}
            onPress={() => setActiveTab('didactic')}
          >
            <Text
              style={[
                styles.tabText,
                { color: activeTab === 'didactic' ? colors.accent : colors.textMuted }
              ]}
            >
              Unterricht
            </Text>
          </TouchableOpacity>
        )}

        {hasCounter && (
          <TouchableOpacity
            style={[
              styles.tabPill,
              activeTab === 'counter' && { backgroundColor: colors.surface, borderColor: colors.accent }
            ]}
            onPress={() => setActiveTab('counter')}
          >
            <Text
              style={[
                styles.tabText,
                { color: activeTab === 'counter' ? colors.accent : colors.textMuted }
              ]}
            >
              Gegenposition
            </Text>
          </TouchableOpacity>
        )}

        {hasContext && (
          <TouchableOpacity
            style={[
              styles.tabPill,
              activeTab === 'context' && { backgroundColor: colors.surface, borderColor: colors.accent }
            ]}
            onPress={() => setActiveTab('context')}
          >
            <Text
              style={[
                styles.tabText,
                { color: activeTab === 'context' ? colors.accent : colors.textMuted }
              ]}
            >
              Kontext
            </Text>
          </TouchableOpacity>
        )}

        {hasReflection && (
          <TouchableOpacity
            style={[
              styles.tabPill,
              activeTab === 'reflection' && { backgroundColor: colors.surface, borderColor: colors.accent }
            ]}
            onPress={() => setActiveTab('reflection')}
          >
            <Text
              style={[
                styles.tabText,
                { color: activeTab === 'reflection' ? colors.accent : colors.textMuted }
              ]}
            >
              Reflexion
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Tab Content Box */}
      <View style={[styles.contentBox, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
        <View style={styles.contentHeader}>
          <Ionicons name={activeIcon} size={15} color={colors.accent} style={{ marginRight: 6 }} />
          <Text style={[styles.contentTitle, { color: colors.textPrimary }]}>
            {activeTitle}
          </Text>
        </View>
        <Text style={[styles.contentText, { color: colors.textSecondary }]}>
          {activeContent}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginTop: spacing.xl,
    marginBottom: spacing.xl
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm
  },
  headerTitle: {
    fontSize: typography.sizes.bodySmall,
    fontWeight: '700',
    letterSpacing: 0.3
  },
  tabBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: spacing.sm
  },
  tabPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'transparent'
  },
  tabText: {
    fontSize: typography.sizes.micro,
    fontWeight: '600'
  },
  contentBox: {
    borderRadius: radius.md,
    borderWidth: 0.5,
    padding: spacing.md
  },
  contentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6
  },
  contentTitle: {
    fontSize: typography.sizes.bodySmall,
    fontWeight: '600'
  },
  contentText: {
    fontSize: typography.sizes.bodySmall,
    lineHeight: 20
  }
});
