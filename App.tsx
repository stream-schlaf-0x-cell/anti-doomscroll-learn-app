import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text, SafeAreaView, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppProvider, useApp } from './src/core/context/AppContext';
import { OnboardingScreen } from './src/features/onboarding/OnboardingScreen';
import { FeedScreen } from './src/features/feed/FeedScreen';
import { ReaderScreen } from './src/features/reader/ReaderScreen';
import { LibraryScreen } from './src/features/library/LibraryScreen';
import { SettingsScreen } from './src/features/settings/SettingsScreen';
import { WhyThisModal } from './src/ui/components/WhyThisModal';
import { typography, radius } from './src/ui/theme';

const MainNavigator: React.FC = () => {
  const {
    profile,
    isLoading,
    activeTab,
    setActiveTab,
    selectedArticleId,
    colors,
    isDark,
    interactions
  } = useApp();

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  // If user has not completed onboarding, show onboarding screen
  if (!profile.isOnboarded) {
    return (
      <>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <OnboardingScreen />
      </>
    );
  }

  // If an article is open in the reader, show reader screen
  if (selectedArticleId) {
    return (
      <>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <ReaderScreen />
      </>
    );
  }

  // Count saved items for badge
  const savedCount = Object.values(interactions).filter(i => i.saved).length;

  return (
    <SafeAreaView style={[styles.mainSafeArea, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Screen Body */}
      <View style={styles.screenContainer}>
        {activeTab === 'feed' && <FeedScreen />}
        {activeTab === 'library' && <LibraryScreen />}
        {activeTab === 'settings' && <SettingsScreen />}
      </View>

      {/* Transparent "Why This" Modal */}
      <WhyThisModal />

      {/* Bottom Tab Bar */}
      <View style={[styles.tabBar, { backgroundColor: colors.surface, borderTopColor: colors.borderSubtle }]}>
        {/* Tab 1: Feed */}
        <TouchableOpacity
          onPress={() => setActiveTab('feed')}
          style={styles.tabItem}
          activeOpacity={0.7}
        >
          <Ionicons
            name={activeTab === 'feed' ? 'book' : 'book-outline'}
            size={22}
            color={activeTab === 'feed' ? colors.accent : colors.textMuted}
          />
          <Text
            style={[
              styles.tabLabel,
              { color: activeTab === 'feed' ? colors.accent : colors.textMuted }
            ]}
          >
            Ausgabe
          </Text>
        </TouchableOpacity>

        {/* Tab 2: Library */}
        <TouchableOpacity
          onPress={() => setActiveTab('library')}
          style={styles.tabItem}
          activeOpacity={0.7}
        >
          <View>
            <Ionicons
              name={activeTab === 'library' ? 'bookmark' : 'bookmark-outline'}
              size={22}
              color={activeTab === 'library' ? colors.accent : colors.textMuted}
            />
            {savedCount > 0 && (
              <View style={[styles.badgePill, { backgroundColor: colors.accent }]}>
                <Text style={styles.badgeCount}>{savedCount}</Text>
              </View>
            )}
          </View>
          <Text
            style={[
              styles.tabLabel,
              { color: activeTab === 'library' ? colors.accent : colors.textMuted }
            ]}
          >
            Bibliothek
          </Text>
        </TouchableOpacity>

        {/* Tab 3: Settings */}
        <TouchableOpacity
          onPress={() => setActiveTab('settings')}
          style={styles.tabItem}
          activeOpacity={0.7}
        >
          <Ionicons
            name={activeTab === 'settings' ? 'options' : 'options-outline'}
            size={22}
            color={activeTab === 'settings' ? colors.accent : colors.textMuted}
          />
          <Text
            style={[
              styles.tabLabel,
              { color: activeTab === 'settings' ? colors.accent : colors.textMuted }
            ]}
          >
            Themen
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default function App() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <MainNavigator />
      </AppProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  mainSafeArea: {
    flex: 1
  },
  screenContainer: {
    flex: 1
  },
  tabBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 0.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 4
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingVertical: 2
  },
  tabLabel: {
    fontSize: typography.sizes.micro,
    fontWeight: '600',
    marginTop: 3
  },
  badgePill: {
    position: 'absolute',
    top: -4,
    right: -10,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3
  },
  badgeCount: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800'
  }
});
