import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

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
    startupState,
    errorMessage,
    retryStartup,
    resetCorruptedData,
    clearError,
    activeTab,
    setActiveTab,
    selectedArticleId,
    colors,
    isDark,
    interactions
  } = useApp();

  const insets = useSafeAreaInsets();

  // Startup loading indicator
  if (startupState.status === 'loading') {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Tagesausgabe wird vorbereitet…
        </Text>
      </View>
    );
  }

  // Startup error state with visible recovery
  if (startupState.status === 'error') {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.danger} style={{ marginBottom: 12 }} />
        <Text style={[styles.errorTitle, { color: colors.textPrimary }]}>
          Ladefehler
        </Text>
        <Text style={[styles.errorDesc, { color: colors.textSecondary }]}>
          {startupState.message}
        </Text>
        <TouchableOpacity
          onPress={retryStartup}
          style={[styles.retryBtn, { backgroundColor: colors.accent }]}
          accessibilityRole="button"
          accessibilityLabel="Erneut versuchen"
        >
          <Text style={styles.retryBtnText}>Erneut versuchen</Text>
        </TouchableOpacity>
        {startupState.canReset && (
          <TouchableOpacity
            onPress={resetCorruptedData}
            style={[styles.resetDataBtn, { borderColor: colors.borderSubtle }]}
            accessibilityRole="button"
            accessibilityLabel="Auf Standardwerte zurücksetzen"
          >
            <Text style={[styles.resetDataBtnText, { color: colors.danger }]}>Auf Standardwerte zurücksetzen</Text>
          </TouchableOpacity>
        )}
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

  // Count saved items for badge
  const savedCount = Object.values(interactions).filter(i => i.saved).length;

  return (
    <SafeAreaView
      style={[styles.mainSafeArea, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right']}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Ephemeral Error Banner if non-fatal */}
      {errorMessage && (
        <View style={[styles.errorBanner, { backgroundColor: colors.cardHighlight, borderColor: colors.danger }]}>
          <Text style={[styles.errorBannerText, { color: colors.danger }]}>
            {errorMessage}
          </Text>
          <TouchableOpacity onPress={clearError} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={16} color={colors.danger} />
          </TouchableOpacity>
        </View>
      )}

      {/* Screen Body: Always mounted to preserve feed scroll position and topic filters! */}
      <View style={styles.screenContainer}>
        {activeTab === 'feed' && <FeedScreen />}
        {activeTab === 'library' && <LibraryScreen />}
        {activeTab === 'settings' && <SettingsScreen />}
      </View>

      {/* Fullscreen Reader Overlay: Renders on top of tabs so originating tab & scroll are preserved */}
      {selectedArticleId && (
        <View style={styles.readerOverlay}>
          <ReaderScreen />
        </View>
      )}

      {/* Transparent "Why This" Modal */}
      <WhyThisModal />

      {/* Bottom Tab Bar with Inset Padding */}
      <View
        style={[
          styles.tabBar,
          {
            backgroundColor: colors.surface,
            borderTopColor: colors.borderSubtle,
            paddingBottom: Math.max(insets.bottom, 10)
          }
        ]}
      >
        <View style={styles.tabBarInner}>
          {/* Tab 1: Feed / Network */}
          <TouchableOpacity
            accessibilityRole="tab"
            accessibilityLabel="Entdecken"
            accessibilityState={{ selected: activeTab === 'feed' }}
            onPress={() => setActiveTab('feed')}
            style={styles.tabItem}
            activeOpacity={0.7}
          >
            <Ionicons
              name={activeTab === 'feed' ? 'compass' : 'compass-outline'}
              size={22}
              color={activeTab === 'feed' ? colors.accent : colors.textMuted}
            />
            <Text
              style={[
                styles.tabLabel,
                { color: activeTab === 'feed' ? colors.accent : colors.textMuted }
              ]}
            >
              Entdecken
            </Text>
          </TouchableOpacity>

          {/* Tab 2: Library & Notebook */}
          <TouchableOpacity
            accessibilityRole="tab"
            accessibilityLabel="Bibliothek"
            accessibilityState={{ selected: activeTab === 'library' }}
            onPress={() => setActiveTab('library')}
            style={styles.tabItem}
            activeOpacity={0.7}
          >
            <View style={styles.iconBadgeWrapper}>
              <Ionicons
                name={activeTab === 'library' ? 'bookmarks' : 'bookmarks-outline'}
                size={22}
                color={activeTab === 'library' ? colors.accent : colors.textMuted}
              />
              {savedCount > 0 && (
                <View style={[styles.badge, { backgroundColor: colors.accent }]}>
                  <Text style={styles.badgeText}>{savedCount}</Text>
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
            accessibilityRole="tab"
            accessibilityLabel="Einstellungen"
            accessibilityState={{ selected: activeTab === 'settings' }}
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
              Steuerung
            </Text>
          </TouchableOpacity>
        </View>
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
  mainSafeArea: {
    flex: 1
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24
  },
  loadingText: {
    marginTop: 16,
    fontSize: typography.sizes.bodySmall,
    fontWeight: '500'
  },
  errorTitle: {
    fontSize: typography.sizes.title1,
    fontWeight: '800',
    marginBottom: 8
  },
  errorDesc: {
    fontSize: typography.sizes.body,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
    maxWidth: 320
  },
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    minHeight: 48,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center'
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontSize: typography.sizes.body,
    fontWeight: '600'
  },
  resetDataBtn: {
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  resetDataBtnText: {
    fontSize: typography.sizes.bodySmall,
    fontWeight: '600'
  },
  errorBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1
  },
  errorBannerText: {
    fontSize: typography.sizes.bodySmall,
    fontWeight: '500',
    flex: 1,
    marginRight: 8
  },
  screenContainer: {
    flex: 1
  },
  readerOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999
  },
  tabBar: {
    borderTopWidth: 0.5,
    paddingTop: 8,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4
  },
  tabBarInner: {
    flexDirection: 'row',
    maxWidth: 780,
    width: '100%',
    alignSelf: 'center'
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    paddingVertical: 4
  },
  tabLabel: {
    fontSize: typography.sizes.micro,
    fontWeight: '600',
    marginTop: 4
  },
  iconBadgeWrapper: {
    position: 'relative'
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800'
  }
});
