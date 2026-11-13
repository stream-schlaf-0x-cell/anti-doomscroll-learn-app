import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Modal,
  ActivityIndicator,
  Switch,
  TextInput,
  Platform,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TopicTag, TOPIC_METADATA, ReadingPreferenceDuration } from '../../core/domain/types';
import { useApp } from '../../core/context/AppContext';
import { typography, radius, spacing } from '../../ui/theme';
import { generateCraftMarkdown, copyToClipboard, downloadMarkdownFile } from '../../core/export/craftExport';
import { NewsHubModal } from '../../ui/components/NewsHubModal';
import { GeminiModelSelector } from '../../ui/components/GeminiModelSelector';
import { FEATURE_MODULES, isFeatureEnabled } from '../../core/modules/featureRegistry';
import {
  onAiCredentialsChange,
  AiCredentials,
  DEFAULT_AI_CREDENTIALS,
  DEFAULT_GEMINI_MODEL,
  DEFAULT_OPENROUTER_MODEL,
  OPENROUTER_MODEL_PRESETS,
  loadAiCredentials,
  saveAiCredentials,
  hasAiConfiguration,
  testAiConnection
} from '../../core/ai/atmenAiClient';
import { defaultUsageLedger, getEffectiveBudgetCeilingEur } from '../../core/enrichment/ledger';
import { EnrichmentLedgerSummary } from '../../core/enrichment/types';
import { BackupService } from '../../core/data/backupService';

type SettingsSubTab = 'ai_sync' | 'appearance' | 'focus' | 'data';

const SUB_TABS: { id: SettingsSubTab; label: string }[] = [
  { id: 'ai_sync', label: '🔑 KI & Sync' },
  { id: 'appearance', label: '🎨 Ansicht' },
  { id: 'focus', label: '🧭 Fokus' },
  { id: 'data', label: '📦 Daten' }
];

export const SettingsScreen: React.FC = () => {
  const {
    profile,
    interactions,
    savedArticles,
    spaces,
    removeFeedbackBoost,
    removeFeedbackPenalty,
    updateFeedMixRatio,
    clearFeedbackMemory,
    updateTopicWeight,
    updateDurationPreference,
    setFontSize,
    setThemePreference,
    toggleFeatureModule,
    repeatOnboarding,
    clearAllLocalData,
    updateEditionPreferences,
    colors,
    setActiveTab,
    remoteSnapshotUrl,
    setRemoteSnapshotUrl,
    refreshLiveFeed,
    snapshotSyncInfo,
    cloudSyncConfig,
    isSyncing,
    syncStatusMessage,
    triggerCloudSync,
    activateCloudSync,
    applyPairingCode,
    getPairingBundle
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<SettingsSubTab>('ai_sync');
  const [resetMemoryNotice, setResetMemoryNotice] = useState<string | null>(null);
  const [githubTokenInput, setGithubTokenInput] = useState<string>('');
  const [passphraseInput, setPassphraseInput] = useState<string>('');
  const [pairingCodeInput, setPairingCodeInput] = useState<string>('');
  const [pairingBundle, setPairingBundle] = useState<{ pairingCode: string; pairingUrl: string; qrDataUrl: string } | null>(null);
  const [isActivatingSync, setIsActivatingSync] = useState<boolean>(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [syncNoticeType, setSyncNoticeType] = useState<'success' | 'error'>('success');
  const [syncMode, setSyncMode] = useState<'primary' | 'secondary'>('primary');

  const interactionList = Object.values(interactions || {});
  const upvoteCount = interactionList.filter(i => (i.voteScore || 0) > 0).length;
  const downvoteCount = interactionList.filter(i => (i.voteScore || 0) < 0).length;
  const readCount = interactionList.filter(i => (i.progressPercent && i.progressPercent >= 20) || (i.furthestPositionPercent && i.furthestPositionPercent >= 20)).length;
  const notesCount = interactionList.reduce((acc, i) => acc + (i.userNotes?.length || 0), 0);
  const savedCount = (savedArticles || []).length;
  const customChannelsCount = (spaces || []).filter(s => s.isCustom).length;

  const currentMix = profile?.feedMixRatio || { focusRatio: 0.60, socraticRatio: 0.20, serendipityRatio: 0.20 };
  const focusPct = Math.round(currentMix.focusRatio * 100);
  const socraticPct = Math.round(currentMix.socraticRatio * 100);
  const serendipityPct = Math.round(currentMix.serendipityRatio * 100);

  const feedbackMem = profile?.feedbackMemory || {};
  const boostedItems: { category: 'topic' | 'author' | 'keyword' | 'domain' | 'space'; key: string; label: string; count: number }[] = [];
  Object.entries(feedbackMem.boostedTopics || {}).forEach(([k, v]) => {
    boostedItems.push({ category: 'topic', key: k, label: `Thema: ${TOPIC_METADATA[k as TopicTag]?.label || k}`, count: v });
  });
  Object.entries(feedbackMem.boostedAuthors || {}).forEach(([k, v]) => {
    boostedItems.push({ category: 'author', key: k, label: `Autor: ${k}`, count: v });
  });
  Object.entries(feedbackMem.boostedDomains || {}).forEach(([k, v]) => {
    boostedItems.push({ category: 'domain', key: k, label: `Quelle: ${k}`, count: v });
  });
  Object.entries(feedbackMem.boostedSpaces || {}).forEach(([k, v]) => {
    boostedItems.push({ category: 'space', key: k, label: `Kanal: ${k}`, count: v });
  });
  Object.entries(feedbackMem.boostedKeywords || {}).forEach(([k, v]) => {
    boostedItems.push({ category: 'keyword', key: k, label: `#${k}`, count: v });
  });

  const penalizedItems: { category: 'topic' | 'author' | 'keyword' | 'domain' | 'space'; key: string; label: string; count: number }[] = [];
  Object.entries(feedbackMem.penalizedTopics || {}).forEach(([k, v]) => {
    penalizedItems.push({ category: 'topic', key: k, label: `Thema: ${TOPIC_METADATA[k as TopicTag]?.label || k}`, count: v });
  });
  Object.entries(feedbackMem.penalizedAuthors || {}).forEach(([k, v]) => {
    penalizedItems.push({ category: 'author', key: k, label: `Autor: ${k}`, count: v });
  });
  Object.entries(feedbackMem.penalizedDomains || {}).forEach(([k, v]) => {
    penalizedItems.push({ category: 'domain', key: k, label: `Quelle: ${k}`, count: v });
  });
  Object.entries(feedbackMem.penalizedSpaces || {}).forEach(([k, v]) => {
    penalizedItems.push({ category: 'space', key: k, label: `Kanal: ${k}`, count: v });
  });
  Object.entries(feedbackMem.penalizedKeywords || {}).forEach(([k, v]) => {
    penalizedItems.push({ category: 'keyword', key: k, label: `#${k}`, count: v });
  });

  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);
  const [showNewsHub, setShowNewsHub] = useState<boolean>(false);
  const [isClearing, setIsClearing] = useState<boolean>(false);
  const [craftNotice, setCraftNotice] = useState<string | null>(null);

  // BYOK AI Credentials & Ledger State
  const [aiCreds, setAiCreds] = useState<AiCredentials>(DEFAULT_AI_CREDENTIALS);
  const [proxyUrlInput, setProxyUrlInput] = useState('');
  const [showApiKey, setShowApiKey] = useState<boolean>(false);
  const [isTestingAi, setIsTestingAi] = useState<boolean>(false);
  const [aiTestResult, setAiTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [ledgerSummary, setLedgerSummary] = useState<EnrichmentLedgerSummary | null>(null);

  // Serverless Remote Snapshot URL State
  const [remoteUrlInput, setRemoteUrlInput] = useState<string>(remoteSnapshotUrl || '');
  const [remoteUrlSavedNotice, setRemoteUrlSavedNotice] = useState<string | null>(null);
  const [isSyncingSnapshot, setIsSyncingSnapshot] = useState<boolean>(false);

  useEffect(() => {
    let active = true;
    const refreshCredsAndSummary = async (creds: AiCredentials) => {
      if (!active) return;
      setAiCreds(creds);
      setProxyUrlInput(creds.proxyUrl ?? '');
      const ceilingEur = getEffectiveBudgetCeilingEur(Boolean(creds.apiKey?.trim()));
      const summary = await defaultUsageLedger.getSummary(undefined, ceilingEur);
      if (active) setLedgerSummary(summary);
    };
    void loadAiCredentials().then(refreshCredsAndSummary);
    const unsub = onAiCredentialsChange(creds => {
      void refreshCredsAndSummary(creds);
    });
    return () => {
      active = false;
      unsub();
    };
  }, []);

  useEffect(() => {
    if (remoteSnapshotUrl) {
      setRemoteUrlInput(remoteSnapshotUrl);
    }
  }, [remoteSnapshotUrl]);

  const handleSelectProvider = async (provider: 'gemini' | 'openrouter') => {
    const defaultModel = provider === 'openrouter' ? DEFAULT_OPENROUTER_MODEL : DEFAULT_GEMINI_MODEL;
    const next: AiCredentials = {
      ...aiCreds,
      provider,
      model: defaultModel
    };
    setAiCreds(next);
    try {
      await saveAiCredentials(next);
      setAiTestResult(null);
    } catch {
      setAiTestResult({ ok: false, message: 'KI-Einstellungen konnten nicht gespeichert werden.' });
    }
  };

  const handleSelectModel = async (model: string) => {
    const next: AiCredentials = {
      ...aiCreds,
      model: model.trim()
    };
    setAiCreds(next);
    try {
      await saveAiCredentials(next);
      setAiTestResult(null);
    } catch {
      setAiTestResult({ ok: false, message: 'KI-Einstellungen konnten nicht gespeichert werden.' });
    }
  };

  const handleChangeCustomModel = async (text: string) => {
    const next: AiCredentials = {
      ...aiCreds,
      model: text
    };
    setAiCreds(next);
    try {
      await saveAiCredentials(next);
      setAiTestResult(null);
    } catch {
      setAiTestResult({ ok: false, message: 'KI-Einstellungen konnten nicht gespeichert werden.' });
    }
  };

  const handleChangeApiKey = async (text: string) => {
    const trimmed = text.trim();
    // Persist non-empty user keys by default so settings survive PWA reloads
    const next: AiCredentials = {
      ...aiCreds,
      apiKey: trimmed,
      persistApiKey: trimmed.length > 0
    };
    setAiCreds(next);
    try {
      await saveAiCredentials(next);
      setAiTestResult(null);
    } catch {
      setAiTestResult({ ok: false, message: 'KI-Einstellungen konnten nicht gespeichert werden.' });
    }
  };

  const handleClearApiKey = async () => {
    const next: AiCredentials = {
      ...aiCreds,
      apiKey: ''
    };
    setAiCreds(next);
    try {
      await saveAiCredentials(next);
      setAiTestResult({ ok: true, message: 'API-Schlüssel aus Sitzung und lokalem Speicher gelöscht.' });
    } catch {
      setAiTestResult({ ok: false, message: 'Schlüssel konnte nicht gelöscht werden. Bitte erneut versuchen.' });
    }
  };

  const handlePersistApiKey = async (persistApiKey: boolean) => {
    const next = { ...aiCreds, persistApiKey };
    try {
      await saveAiCredentials(next);
      setAiCreds(next);
      setAiTestResult(null);
    } catch {
      setAiTestResult({ ok: false, message: 'Speicherwahl konnte nicht übernommen werden.' });
    }
  };

  const handleSaveProxyUrl = async () => {
    try {
      await saveAiCredentials({ ...aiCreds, proxyUrl: proxyUrlInput });
      const saved = await loadAiCredentials();
      setAiCreds(saved);
      setProxyUrlInput(saved.proxyUrl ?? '');
      setAiTestResult({ ok: true, message: saved.proxyUrl ? 'Proxy-Adresse gespeichert. Anfragen laufen ausschließlich über diesen Proxy.' : 'Direkter BYOK-Zugriff ausgewählt.' });
    } catch (error) {
      setAiTestResult({ ok: false, message: error instanceof Error ? error.message : 'Proxy-Adresse konnte nicht gespeichert werden.' });
    }
  };

  useEffect(() => {
    if (cloudSyncConfig.githubToken) {
      setGithubTokenInput(cloudSyncConfig.githubToken);
    }
    if (cloudSyncConfig.encryptionPassphrase) {
      setPassphraseInput(cloudSyncConfig.encryptionPassphrase);
    }
    void getPairingBundle().then(setPairingBundle).catch(() => {});
  }, [cloudSyncConfig, getPairingBundle]);

  const handleActivateLiveSync = async () => {
    if (!githubTokenInput.trim()) {
      setSyncNotice('Bitte gib ein persönliches GitHub Access Token (mit gist Scope) ein.');
      setSyncNoticeType('error');
      return;
    }
    setIsActivatingSync(true);
    setSyncNotice(null);
    try {
      const res = await activateCloudSync(githubTokenInput.trim(), passphraseInput.trim());
      if (res.success) {
        setSyncNotice('✅ Live-Sync erfolgreich verbunden & Remote-Schlüssel synchronisiert!');
        setSyncNoticeType('success');
        const bundle = await getPairingBundle();
        setPairingBundle(bundle);
        const creds = await loadAiCredentials();
        setAiCreds(creds);
      } else {
        setSyncNotice(`Fehler bei Gist-Verbindung: ${res.error}`);
        setSyncNoticeType('error');
      }
    } catch (err: any) {
      setSyncNotice(`Fehler bei Gist-Verbindung: ${err?.message || err}`);
      setSyncNoticeType('error');
    } finally {
      setIsActivatingSync(false);
    }
  };

  const handleApplyPairingCode = async () => {
    if (!pairingCodeInput.trim()) {
      setSyncNotice('Bitte gib einen Koppel-Code ein.');
      setSyncNoticeType('error');
      return;
    }
    setIsActivatingSync(true);
    setSyncNotice(null);
    try {
      const ok = await applyPairingCode(pairingCodeInput.trim());
      if (ok) {
        setSyncNotice('✅ Gerät erfolgreich gekoppelt und synchronisiert!');
        setSyncNoticeType('success');
        setPairingCodeInput('');
      } else {
        setSyncNotice('Koppel-Code konnte nicht angewendet werden.');
        setSyncNoticeType('error');
      }
    } catch (err: any) {
      setSyncNotice(`Kopplung fehlgeschlagen: ${err?.message || err}`);
      setSyncNoticeType('error');
    } finally {
      setIsActivatingSync(false);
    }
  };

  const handlePasteFromClipboardAndConnect = async () => {
    try {
      let code = '';
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.readText) {
        code = await navigator.clipboard.readText();
      }
      if (!code.trim()) {
        setSyncNotice('Kein Koppel-Code in der Zwischenablage gefunden. Bitte Code manuell einfügen.');
        setSyncNoticeType('error');
        return;
      }
      setPairingCodeInput(code.trim());
      setIsActivatingSync(true);
      setSyncNotice(null);
      const ok = await applyPairingCode(code.trim());
      if (ok) {
        setSyncNotice('✅ Gerät erfolgreich gekoppelt und synchronisiert!');
        setSyncNoticeType('success');
        setPairingCodeInput('');
      } else {
        setSyncNotice('Koppel-Code konnte nicht angewendet werden.');
        setSyncNoticeType('error');
      }
    } catch (err: any) {
      setSyncNotice(`Zwischenablage konnte nicht gelesen werden: ${err?.message || err}`);
      setSyncNoticeType('error');
    } finally {
      setIsActivatingSync(false);
    }
  };

  const handleCopyPairingCode = async () => {
    if (!pairingBundle?.pairingCode) return;
    const ok = await copyToClipboard(pairingBundle.pairingCode);
    if (ok) {
      setSyncNotice('📋 Koppel-Code in die Zwischenablage kopiert!');
      setSyncNoticeType('success');
      setTimeout(() => setSyncNotice(null), 4000);
    }
  };

  const handleTestAiConnection = async () => {
    setIsTestingAi(true);
    setAiTestResult(null);
    try {
      const res = await testAiConnection(aiCreds);
      setAiTestResult(res);
      const summary = await defaultUsageLedger.getSummary();
      setLedgerSummary(summary);
    } catch (err: any) {
      setAiTestResult({ ok: false, message: err?.message || 'Verbindungstest fehlgeschlagen.' });
    } finally {
      setIsTestingAi(false);
    }
  };

  const handleSaveRemoteUrl = async () => {
    await setRemoteSnapshotUrl(remoteUrlInput.trim());
    setRemoteUrlSavedNotice('✓ Gespeichert');
    setTimeout(() => setRemoteUrlSavedNotice(null), 2500);
  };

  const handleSyncRemoteNow = async () => {
    setIsSyncingSnapshot(true);
    try {
      await refreshLiveFeed();
    } finally {
      setIsSyncingSnapshot(false);
    }
  };

  const handleAdjustWeight = (topic: TopicTag, delta: number) => {
    const current = profile.explicitInterests[topic] ?? 0.5;
    const next = Math.max(0, Math.min(1.0, Math.round((current + delta) * 10) / 10));
    updateTopicWeight(topic, next);
  };

  const handleRepeatOnboarding = async () => {
    await repeatOnboarding();
  };

  const handleConfirmClearAll = async () => {
    setIsClearing(true);
    try {
      await clearAllLocalData();
    } finally {
      setIsClearing(false);
      setShowClearConfirm(false);
    }
  };

  const handleCopyCraftMarkdown = async () => {
    const md = generateCraftMarkdown(savedArticles, interactions);
    const ok = await copyToClipboard(md);
    if (ok) {
      setCraftNotice('✓ Als Craft-Markdown in Zwischenablage kopiert!');
      setTimeout(() => setCraftNotice(null), 3000);
    } else {
      setCraftNotice('Kopieren fehlgeschlagen.');
      setTimeout(() => setCraftNotice(null), 3000);
    }
  };

  const handleDownloadCraftMarkdown = () => {
    const md = generateCraftMarkdown(savedArticles, interactions);
    const ok = downloadMarkdownFile(`atem-archiv-${new Date().toISOString().slice(0, 10)}.md`, md);
    if (ok) {
      setCraftNotice('✓ Download gestartet (atem-archiv.md)');
      setTimeout(() => setCraftNotice(null), 3000);
    }
  };

  // Backup V2 State & Handlers
  const [backupNotice, setBackupNotice] = useState<string | null>(null);
  const [isExportingBackup, setIsExportingBackup] = useState<boolean>(false);
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [importJsonText, setImportJsonText] = useState<string>('');
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importStatus, setImportStatus] = useState<{ ok?: boolean; message?: string } | null>(null);

  const handleExportBackupJson = async () => {
    setIsExportingBackup(true);
    try {
      await BackupService.exportBackupJson(true);
      setBackupNotice('✓ V2-Backup heruntergeladen (atmen-backup-v2-*.json)');
      setTimeout(() => setBackupNotice(null), 4000);
    } catch {
      setBackupNotice('Export fehlgeschlagen.');
      setTimeout(() => setBackupNotice(null), 3000);
    } finally {
      setIsExportingBackup(false);
    }
  };

  const handleImportBackupJson = async () => {
    if (!importJsonText.trim()) {
      setImportStatus({ ok: false, message: 'Bitte füge den Inhalt deiner Backup-JSON-Datei ein.' });
      return;
    }
    setIsImporting(true);
    try {
      const result = await BackupService.importBackupJson(importJsonText.trim());
      if (result.success) {
        setImportStatus({
          ok: true,
          message: `✓ Backup erfolgreich wiederhergestellt: ${result.restoredSavedCount} Artikel, ${result.restoredNotesCount} Notizen${result.restoredThoughtsCount ? `, ${result.restoredThoughtsCount} Gedanken` : ''}.`
        });
        setTimeout(() => {
          setShowImportModal(false);
          setImportJsonText('');
          setImportStatus(null);
          void refreshLiveFeed();
        }, 2200);
      } else {
        setImportStatus({ ok: false, message: result.error || 'Wiederherstellung fehlgeschlagen.' });
      }
    } catch (e: any) {
      setImportStatus({ ok: false, message: e?.message || 'Ungültiges JSON-Format.' });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header with 1-Click Back to Feed & Close Button */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.borderSubtle }]}>
        <View style={styles.headerInner}>
          <View style={styles.headerTopRow}>
            <TouchableOpacity
              onPress={() => setActiveTab('feed')}
              style={[styles.backBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}
              accessibilityRole="button"
              accessibilityLabel="Zurück zum Feed"
            >
              <Ionicons name="arrow-back" size={15} color={colors.accent} style={{ marginRight: 6 }} />
              <Text style={[styles.backBtnText, { color: colors.accent }]}>Zurück zum Feed</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setActiveTab('feed')}
              style={[styles.closeIconBtn, { backgroundColor: colors.surfaceSecondary }]}
              accessibilityRole="button"
              accessibilityLabel="Einstellungen schließen"
            >
              <Ionicons name="close" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.title, { color: colors.textPrimary }]}>
            Einstellungen & Feed-Kontrolle
          </Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Transparente Steuerung deiner intellektuellen Umgebung & Themen-Gewichtung
          </Text>
        </View>
      </View>

      {/* Sub-Tab Navigation Bar */}
      <View style={[styles.subTabBarContainer, { backgroundColor: colors.surface, borderBottomColor: colors.borderSubtle }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.subTabBarInner}
        >
          {SUB_TABS.map(tab => {
            const isActive = activeSubTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setActiveSubTab(tab.id)}
                style={[
                  styles.subTabButton,
                  {
                    backgroundColor: isActive ? colors.accentSubtle : colors.surfaceSecondary,
                    borderColor: isActive ? colors.accent : colors.borderSubtle
                  }
                ]}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={tab.label}
              >
                <Text
                  style={[
                    styles.subTabText,
                    {
                      color: isActive ? colors.accent : colors.textSecondary,
                      fontWeight: isActive ? '700' : '600'
                    }
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        style={[
          { flex: 1, minHeight: 0 },
          Platform.OS === 'web' ? ({ touchAction: 'pan-y', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' } as any) : undefined
        ]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {activeSubTab === 'ai_sync' && (
          <>
        {/* Section: AI Brain & Model Selector (BYOK Gemini / OpenRouter) */}
        <View style={styles.section}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="sparkles" size={20} color={colors.accent} />
              <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginBottom: 0 }]}>
                KI-Gehirn & Modell-Auswahl (Gemini / OpenRouter)
              </Text>
            </View>
            <View style={[
              styles.syncStatusBadge,
              {
                backgroundColor: hasAiConfiguration(aiCreds) ? 'rgba(16, 185, 129, 0.16)' : 'rgba(245, 158, 11, 0.16)',
                borderColor: hasAiConfiguration(aiCreds) ? '#10B981' : '#F59E0B'
              }
            ]}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: hasAiConfiguration(aiCreds) ? '#10B981' : '#F59E0B' }}>
                {hasAiConfiguration(aiCreds) ? '✅ API-Key aktiv' : '⚠️ Kein Key hinterlegt'}
              </Text>
            </View>
          </View>
          <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
            Bring Your Own Key (BYOK): Die veröffentlichte Web-App hat keinen eigenen KI-Server. Mit deinem Schlüssel werden Anfragen direkt an den gewählten Anbieter gesendet; dort können Kosten entstehen. Ohne KI-Konfiguration bleibt der lokale Lesemodus verfügbar.
          </Text>

          <View style={[styles.box, { backgroundColor: colors.surface, borderColor: colors.borderSubtle, padding: spacing.md }]}>
            {/* Provider Picker */}
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>KI-Anbieter wählen:</Text>
            <View style={styles.providerRow}>
              <TouchableOpacity
                onPress={() => void handleSelectProvider('gemini')}
                style={[
                  styles.providerBtn,
                  aiCreds.provider === 'gemini'
                    ? { backgroundColor: colors.accentSubtle, borderColor: colors.accent }
                    : { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }
                ]}
                accessibilityRole="button"
                accessibilityLabel="Gemini Direct wählen"
              >
                <Ionicons
                  name="sparkles-outline"
                  size={14}
                  color={aiCreds.provider === 'gemini' ? colors.accent : colors.textSecondary}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.providerBtnText,
                    { color: aiCreds.provider === 'gemini' ? colors.accent : colors.textPrimary }
                  ]}
                >
                  Gemini Direct
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => void handleSelectProvider('openrouter')}
                style={[
                  styles.providerBtn,
                  aiCreds.provider === 'openrouter'
                    ? { backgroundColor: colors.accentSubtle, borderColor: colors.accent }
                    : { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }
                ]}
                accessibilityRole="button"
                accessibilityLabel="OpenRouter wählen"
              >
                <Ionicons
                  name="shuffle-outline"
                  size={14}
                  color={aiCreds.provider === 'openrouter' ? colors.accent : colors.textSecondary}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.providerBtnText,
                    { color: aiCreds.provider === 'openrouter' ? colors.accent : colors.textPrimary }
                  ]}
                >
                  OpenRouter
                </Text>
              </TouchableOpacity>
            </View>

            {/* Model Selector */}
            {aiCreds.provider === 'gemini' ? (
              <View style={{ marginVertical: 10 }}>
                <GeminiModelSelector
                  selectedModelId={aiCreds.model || DEFAULT_GEMINI_MODEL}
                  onSelectModel={async mId => {
                    void handleSelectModel(mId);
                  }}
                  apiKey={aiCreds.apiKey}
                  workflow="text"
                />
              </View>
            ) : (
              <View style={{ marginVertical: 10 }}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                  OpenRouter Modell-Auswahl:
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 6 }}>
                  {OPENROUTER_MODEL_PRESETS.map(preset => {
                    const currentModel = aiCreds.model || DEFAULT_OPENROUTER_MODEL;
                    const isSelected = currentModel === preset.id;
                    return (
                      <TouchableOpacity
                        key={preset.id}
                        onPress={() => void handleSelectModel(preset.id)}
                        style={[
                          styles.smallPill,
                          {
                            backgroundColor: isSelected ? colors.accent : colors.surfaceSecondary,
                            borderColor: isSelected ? colors.accent : colors.borderSubtle,
                            borderWidth: 1,
                            paddingHorizontal: 10,
                            paddingVertical: 6
                          }
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`Modell ${preset.id} auswählen`}
                      >
                        <Text
                          style={[
                            styles.smallPillText,
                            {
                              color: isSelected ? '#FFFFFF' : colors.textPrimary,
                              fontWeight: isSelected ? '700' : '500'
                            }
                          ]}
                        >
                          {isSelected ? `✓ ${preset.id}` : preset.id}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <View style={[styles.keyInputRow, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
                  <Ionicons name="cube-outline" size={15} color={colors.textMuted} style={{ marginLeft: 4, marginRight: 6 }} />
                  <TextInput
                    style={[styles.keyInput, { color: colors.textPrimary, fontSize: 13 }]}
                    value={aiCreds.model}
                    onChangeText={text => void handleChangeCustomModel(text)}
                    placeholder={DEFAULT_OPENROUTER_MODEL}
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>
            )}

            {/* API Key Input */}
            <Text style={[styles.inputLabel, { color: colors.textSecondary, marginTop: 14 }]}>
              {aiCreds.provider === 'gemini' ? 'Google AI Studio API-Key:' : 'OpenRouter API-Key:'}
            </Text>
            <View style={[styles.keyInputRow, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
              <TextInput
                style={[styles.keyInput, { color: colors.textPrimary }]}
                value={aiCreds.apiKey}
                onChangeText={handleChangeApiKey}
                placeholder={aiCreds.provider === 'gemini' ? 'AIzaSy...' : 'sk-or-v1-...'}
                placeholderTextColor={colors.textMuted}
                secureTextEntry={!showApiKey}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                onPress={async () => {
                  try {
                    if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
                      const clip = await navigator.clipboard.readText();
                      if (clip?.trim()) {
                        await handleChangeApiKey(clip.trim());
                      }
                    }
                  } catch {
                    // Clipboard error
                  }
                }}
                style={styles.keyActionBtn}
                accessibilityLabel="Aus Zwischenablage einfügen"
              >
                <Ionicons name="clipboard-outline" size={18} color={colors.accent} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShowApiKey(!showApiKey)}
                style={styles.keyActionBtn}
                accessibilityLabel={showApiKey ? 'Schlüssel verbergen' : 'Schlüssel anzeigen'}
              >
                <Ionicons name={showApiKey ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textMuted} />
              </TouchableOpacity>
              {Boolean(aiCreds.apiKey) && (
                <TouchableOpacity
                  onPress={handleClearApiKey}
                  style={styles.keyActionBtn}
                  accessibilityLabel="Schlüssel löschen"
                >
                  <Ionicons name="close-circle-outline" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            <View style={[styles.toggleRow, { marginTop: 12 }]}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>Schlüssel auf diesem Gerät merken</Text>
                <Text style={{ fontSize: typography.sizes.micro, color: colors.textMuted, lineHeight: 17 }}>
                  {aiCreds.persistApiKey
                    ? 'Aktiv: Der Schlüssel wird unverschlüsselt im lokalen App- bzw. Browserspeicher abgelegt. Nur auf einem eigenen, vertrauenswürdigen Gerät verwenden.'
                    : 'Standard: nur im Arbeitsspeicher dieser Sitzung. Nach Neuladen oder App-Neustart erneut eingeben. Früher gespeicherte Schlüssel werden beim Laden in diese Sitzung übernommen und aus dem dauerhaften Speicher entfernt.'}
                </Text>
              </View>
              <Switch
                value={aiCreds.persistApiKey === true}
                onValueChange={value => void handlePersistApiKey(value)}
                accessibilityLabel="API-Schlüssel unverschlüsselt auf diesem Gerät speichern"
              />
            </View>

            <Text style={[styles.inputLabel, { color: colors.textSecondary, marginTop: 16 }]}>Eigener KI-Proxy (optional, HTTPS-Basisadresse):</Text>
            <View style={[styles.keyInputRow, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
              <TextInput
                style={[styles.keyInput, { color: colors.textPrimary }]}
                value={proxyUrlInput}
                onChangeText={setProxyUrlInput}
                placeholder="https://dein-server.example/api/ai"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel="Eigene KI-Proxy-Basisadresse"
              />
            </View>
            <Text style={{ fontSize: typography.sizes.micro, color: colors.textMuted, lineHeight: 17, marginTop: 6 }}>
              Ein eigener Proxy erhält Anfrage und ggf. deinen API-Schlüssel. Er muss separat eingerichtet sein. Bei Proxy-Fehlern erfolgt kein direkter Anbieteraufruf. Leere Adresse wählt direkten BYOK-Zugriff.
            </Text>
            <TouchableOpacity
              onPress={() => void handleSaveProxyUrl()}
              style={[styles.testConnectionBtn, { backgroundColor: colors.surfaceSecondary, marginTop: 8, alignSelf: 'flex-start' }]}
              accessibilityLabel="KI-Proxy-Adresse speichern"
            >
              <Text style={[styles.testConnectionBtnText, { color: colors.textPrimary }]}>Proxy-Adresse speichern</Text>
            </TouchableOpacity>

            {/* Test Connection Button */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 10, flexWrap: 'wrap' }}>
              <TouchableOpacity
                onPress={handleTestAiConnection}
                disabled={isTestingAi || !hasAiConfiguration(aiCreds)}
                style={[
                  styles.testConnectionBtn,
                  {
                    backgroundColor: hasAiConfiguration(aiCreds) ? colors.accent : colors.surfaceSecondary,
                    opacity: isTestingAi || !hasAiConfiguration(aiCreds) ? 0.6 : 1
                  }
                ]}
              >
                {isTestingAi ? (
                  <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 6 }} />
                ) : (
                  <Ionicons name="flash-outline" size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
                )}
                <Text style={styles.testConnectionBtnText}>Verbindung testen (API-Aufruf)</Text>
              </TouchableOpacity>

              {aiTestResult && (
                <View
                  style={[
                    styles.testResultPill,
                    {
                      backgroundColor: aiTestResult.ok ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      borderColor: aiTestResult.ok ? '#10B981' : '#EF4444'
                    }
                  ]}
                >
                  <Ionicons
                    name={aiTestResult.ok ? 'checkmark-circle' : 'alert-circle'}
                    size={14}
                    color={aiTestResult.ok ? '#10B981' : '#EF4444'}
                    style={{ marginRight: 5 }}
                  />
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '600',
                      color: aiTestResult.ok ? '#10B981' : '#EF4444'
                    }}
                  >
                    {aiTestResult.message}
                  </Text>
                </View>
              )}
            </View>

            {/* Monatsbudget Ledger Display */}
            <View style={[styles.ledgerBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle, marginTop: 16 }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ fontSize: typography.sizes.bodySmall, fontWeight: '700', color: colors.textPrimary }}>
                  KI-Monatsbudget (Schätzung)
                </Text>
                <View style={[styles.badgeActive, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                  <Text style={[styles.badgeActiveText, { color: '#10B981' }]}>
                    {ledgerSummary?.isBudgetExceeded ? 'Budget erreicht' : 'Schätzlimit aktiv'}
                  </Text>
                </View>
              </View>

              {(() => {
                const effectiveCeilingEur =
                  ledgerSummary?.budgetLimitEur ?? getEffectiveBudgetCeilingEur(Boolean(aiCreds.apiKey?.trim()));
                const currentCostEur = ledgerSummary?.totalCostEur ?? 0;
                const usagePct = Math.min(100, Math.round((currentCostEur / effectiveCeilingEur) * 100));
                return (
                  <>
                    <View style={[styles.budgetTrack, { backgroundColor: colors.background }]}>
                      <View
                        style={[
                          styles.budgetFill,
                          {
                            width: `${usagePct}%`,
                            backgroundColor: ledgerSummary?.isBudgetExceeded ? '#EF4444' : colors.accent
                          }
                        ]}
                      />
                    </View>

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, marginBottom: 8 }}>
                      <Text style={{ fontSize: typography.sizes.micro, color: colors.textMuted }}>
                        Geschätzt: {currentCostEur.toFixed(2)} € ({usagePct}%)
                      </Text>
                      <Text style={{ fontSize: typography.sizes.micro, color: colors.accent, fontWeight: '600' }}>
                        Schätzlimit: {effectiveCeilingEur.toFixed(2)} € / Monat
                      </Text>
                    </View>
                  </>
                );
              })()}

              <Text style={{ fontSize: typography.sizes.micro, color: colors.textSecondary, lineHeight: 17 }}>
                • Anfragen diesen Monat: {ledgerSummary?.totalCalls ?? 0} Aufrufe ({((ledgerSummary?.totalInputTokens ?? 0) + (ledgerSummary?.totalOutputTokens ?? 0)).toLocaleString()} Tokens).{'\n'}
                • Die App begrenzt Anfragen anhand pauschaler Kostenschätzungen. Preise und Abrechnung hängen vom Anbieter und Modell ab; dies ist keine verbindliche Ausgabenobergrenze. Setze ein Kostenlimit auch beim Anbieter. Ohne KI-Konfiguration oder bei Fehlern nutzt Atmen lokale Verarbeitung.
              </Text>
            </View>
          </View>
        </View>

        {/* Section: Live-Sync & Geräte koppeln (Eine Instanz) */}
        <View style={styles.section}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="cloud-done" size={20} color="#10B981" />
              <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginBottom: 0 }]}>
                ⚡ Live-Sync & Geräte koppeln (Eine Instanz)
              </Text>
            </View>
            <View style={[
              styles.syncStatusBadge,
              {
                backgroundColor: cloudSyncConfig.enabled ? 'rgba(16, 185, 129, 0.16)' : colors.surfaceSecondary,
                borderColor: cloudSyncConfig.enabled ? '#10B981' : colors.borderSubtle
              }
            ]}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: cloudSyncConfig.enabled ? '#10B981' : colors.textSecondary }}>
                {isSyncing ? '🔄 Synchronisiere…' : cloudSyncConfig.enabled ? '🟢 Live-Sync aktiv' : '⚪ Nicht gekoppelt'}
              </Text>
            </View>
          </View>

          <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
            Verbindet Mac, iPhone und iPad zu einer einzigen synchronen ATMEN-Instanz. Lesezeichen, Lesefortschritt, API-Keys, Channels & gesehene Artikel werden verschlüsselt abgeglichen.
          </Text>

          {syncStatusMessage && (
            <View style={[styles.syncNoticeCard, { backgroundColor: 'rgba(16, 185, 129, 0.14)', borderColor: '#10B981' }]}>
              <Ionicons name="checkmark-circle" size={16} color="#10B981" />
              <Text style={{ color: '#10B981', fontSize: 12.5, fontWeight: '600', flex: 1, marginLeft: 6 }}>
                {syncStatusMessage}
              </Text>
            </View>
          )}

          {syncNotice && (
            <View style={[
              styles.syncNoticeCard,
              {
                backgroundColor: syncNoticeType === 'success' ? 'rgba(16, 185, 129, 0.14)' : 'rgba(239, 68, 68, 0.14)',
                borderColor: syncNoticeType === 'success' ? '#10B981' : '#EF4444'
              }
            ]}>
              <Ionicons
                name={syncNoticeType === 'success' ? 'checkmark-circle' : 'alert-circle'}
                size={16}
                color={syncNoticeType === 'success' ? '#10B981' : '#EF4444'}
              />
              <Text style={{
                color: syncNoticeType === 'success' ? '#10B981' : '#EF4444',
                fontSize: 12.5,
                fontWeight: '600',
                flex: 1,
                marginLeft: 6
              }}>
                {syncNotice}
              </Text>
            </View>
          )}

          <View style={[styles.box, { backgroundColor: colors.surface, borderColor: colors.borderSubtle, padding: spacing.md }]}>
            {/* Telemetry info when enabled */}
            {cloudSyncConfig.enabled && (
              <View style={[styles.syncTelemetryRow, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>
                    ☁️ Gist-ID: {cloudSyncConfig.gistId}
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                    Zuletzt synchronisiert: {cloudSyncConfig.lastSyncAt ? new Date(cloudSyncConfig.lastSyncAt).toLocaleTimeString() : 'noch nicht'} · {readCount} Artikel, {customChannelsCount} Channels synchron
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => triggerCloudSync(true)}
                  disabled={isSyncing}
                  style={[styles.smallActionBtn, { backgroundColor: colors.accentSubtle, borderColor: colors.accent }]}
                  accessibilityRole="button"
                  accessibilityLabel="Jetzt synchronisieren"
                >
                  <Ionicons name="refresh" size={13} color={colors.accent} style={{ marginRight: 4 }} />
                  <Text style={{ fontSize: 11.5, fontWeight: '700', color: colors.accent }}>
                    {isSyncing ? 'Sync…' : 'Jetzt synchronisieren'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Mode Selector: Primärgerät (Mac) vs Zweitgerät (iPad/iPhone) */}
            <View style={styles.syncModeSelector}>
              <TouchableOpacity
                onPress={() => setSyncMode('primary')}
                style={[
                  styles.syncModeTab,
                  syncMode === 'primary' && { backgroundColor: colors.accentSubtle, borderColor: colors.accent }
                ]}
              >
                <Text style={[styles.syncModeTabText, { color: syncMode === 'primary' ? colors.accent : colors.textSecondary }]}>
                  🖥️ Primärgerät (Mac / 1-Klick Setup)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setSyncMode('secondary')}
                style={[
                  styles.syncModeTab,
                  syncMode === 'secondary' && { backgroundColor: colors.accentSubtle, borderColor: colors.accent }
                ]}
              >
                <Text style={[styles.syncModeTabText, { color: syncMode === 'secondary' ? colors.accent : colors.textSecondary }]}>
                  📲 iPad & iPhone koppeln
                </Text>
              </TouchableOpacity>
            </View>

            {syncMode === 'primary' ? (
              <View style={{ marginTop: 12 }}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                  GitHub Access Token (PAT mit gist-Berechtigung):
                </Text>
                <TextInput
                  value={githubTokenInput}
                  onChangeText={setGithubTokenInput}
                  placeholder="ghp_... oder github_pat_..."
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry
                  style={[styles.textInput, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle, color: colors.textPrimary }]}
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                <Text style={[styles.inputLabel, { color: colors.textSecondary, marginTop: 10 }]}>
                  Verschlüsselungs-Passphrase (Client-Side Encryption):
                </Text>
                <TextInput
                  value={passphraseInput}
                  onChangeText={setPassphraseInput}
                  placeholder="Passphrase für Ende-zu-Ende-Verschlüsselung (optional)"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry
                  style={[styles.textInput, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle, color: colors.textPrimary }]}
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                <TouchableOpacity
                  onPress={handleActivateLiveSync}
                  disabled={isActivatingSync}
                  style={[styles.primaryActionBtn, { backgroundColor: colors.accent, marginTop: 14 }]}
                  accessibilityRole="button"
                  accessibilityLabel="Live-Sync aktivieren"
                >
                  {isActivatingSync ? (
                    <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 6 }} />
                  ) : (
                    <Ionicons name="sync" size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                  )}
                  <Text style={styles.primaryActionBtnText}>
                    {isActivatingSync ? 'Verbinde Gist…' : cloudSyncConfig.enabled ? 'Live-Sync neu verbinden' : '🔄 Live-Sync aktivieren'}
                  </Text>
                </TouchableOpacity>

                {/* Instant Pairing Code & QR for secondary devices */}
                {pairingBundle && (
                  <View style={[styles.pairingCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle, marginTop: 16 }]}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 }}>
                      📲 Zweitgerät (iPad / iPhone) koppeln:
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 10 }}>
                      Scanne diesen QR-Code mit der iPhone-Kamera oder kopiere den Koppel-Code, um das iPad in 1 Sekunde synchron zu verbinden.
                    </Text>

                    {pairingBundle.qrDataUrl ? (
                      <View style={{ alignItems: 'center', marginVertical: 8 }}>
                        <Image
                          source={{ uri: pairingBundle.qrDataUrl }}
                          style={{ width: 180, height: 180, borderRadius: 8, backgroundColor: '#FFFFFF' }}
                          resizeMode="contain"
                        />
                      </View>
                    ) : null}

                    <TextInput
                      value={pairingBundle.pairingCode}
                      editable={false}
                      selectTextOnFocus
                      multiline
                      numberOfLines={2}
                      style={[
                        styles.textInput,
                        {
                          backgroundColor: colors.background,
                          borderColor: colors.borderSubtle,
                          color: colors.textPrimary,
                          fontSize: 11,
                          height: 54,
                          marginVertical: 8,
                          textAlignVertical: 'top'
                        }
                      ]}
                    />

                    <TouchableOpacity
                      onPress={handleCopyPairingCode}
                      style={[styles.smallActionBtn, { backgroundColor: colors.accentSubtle, borderColor: colors.accent, alignSelf: 'center', marginTop: 8 }]}
                      accessibilityRole="button"
                      accessibilityLabel="Koppel-Code kopieren"
                    >
                      <Ionicons name="copy-outline" size={14} color={colors.accent} style={{ marginRight: 5 }} />
                      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.accent }}>
                        📋 Koppel-Code kopieren
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ) : (
              <View style={{ marginTop: 12 }}>
                <Text style={{ fontSize: 12.5, color: colors.textSecondary, marginBottom: 12, lineHeight: 18 }}>
                  Füge hier den Koppel-Code ein, den du auf deinem Mac generiert hast, um dieses iPad oder iPhone dauerhaft mit derselben synchronen ATMEN-Instanz zu verknüpfen.
                </Text>

                <TouchableOpacity
                  onPress={handlePasteFromClipboardAndConnect}
                  disabled={isActivatingSync}
                  style={[styles.primaryActionBtn, { backgroundColor: '#10B981', marginBottom: 12 }]}
                  accessibilityRole="button"
                  accessibilityLabel="Koppel-Code aus Zwischenablage einfügen und verbinden"
                >
                  <Ionicons name="clipboard-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.primaryActionBtnText}>
                    📲 Koppel-Code aus Zwischenablage einfügen & verbinden
                  </Text>
                </TouchableOpacity>

                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                  Oder Koppel-Code manuell einfügen:
                </Text>
                <TextInput
                  value={pairingCodeInput}
                  onChangeText={setPairingCodeInput}
                  placeholder="atmen-pair-v1:..."
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={3}
                  style={[styles.textInput, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle, color: colors.textPrimary, height: 75, textAlignVertical: 'top' }]}
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                <TouchableOpacity
                  onPress={handleApplyPairingCode}
                  disabled={isActivatingSync || !pairingCodeInput.trim()}
                  style={[
                    styles.primaryActionBtn,
                    {
                      backgroundColor: pairingCodeInput.trim() ? colors.accent : colors.surfaceSecondary,
                      marginTop: 10
                    }
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Verbinden"
                >
                  <Ionicons name="link" size={15} color={pairingCodeInput.trim() ? '#FFFFFF' : colors.textMuted} style={{ marginRight: 6 }} />
                  <Text style={[styles.primaryActionBtnText, !pairingCodeInput.trim() && { color: colors.textMuted }]}>
                    Koppeln & Synchronisieren
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

          </>
        )}

        {activeSubTab === 'appearance' && (
          <>
        {/* Section: Typography & Appearance */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Darstellung & Lesekomfort
          </Text>
          <View style={[styles.box, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
            {/* Theme */}
            <View style={styles.settingItemRow}>
              <Text style={[styles.settingItemLabel, { color: colors.textPrimary }]}>
                Erscheinungsbild
              </Text>
              <View style={styles.subToggleRow}>
                {[
                  { id: 'system', label: 'Auto' },
                  { id: 'light', label: 'Hell' },
                  { id: 'dark', label: 'Dunkel' }
                ].map(t => (
                  <TouchableOpacity
                    key={t.id}
                    onPress={() => setThemePreference(t.id as any)}
                    style={[
                      styles.smallPill,
                      {
                        backgroundColor: profile.readingPreferences.theme === t.id ? colors.accent : colors.surfaceSecondary
                      }
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Erscheinungsbild ${t.label} aktivieren`}
                  >
                    <Text
                      style={[
                        styles.smallPillText,
                        { color: profile.readingPreferences.theme === t.id ? '#FFFFFF' : colors.textPrimary }
                      ]}
                    >
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Font Size */}
            <View style={[styles.settingItemRow, { borderTopWidth: 0.5, borderTopColor: colors.borderSubtle }]}>
              <Text style={[styles.settingItemLabel, { color: colors.textPrimary }]}>
                Schriftgröße im Reader
              </Text>
              <View style={styles.subToggleRow}>
                {(['sm', 'md', 'lg', 'xl'] as const).map(size => (
                  <TouchableOpacity
                    key={size}
                    onPress={() => setFontSize(size)}
                    style={[
                      styles.smallPill,
                      {
                        backgroundColor: profile.readingPreferences.fontSize === size ? colors.accent : colors.surfaceSecondary
                      }
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Schriftgröße ${size.toUpperCase()} wählen`}
                  >
                    <Text
                      style={[
                        styles.smallPillText,
                        { color: profile.readingPreferences.fontSize === size ? '#FFFFFF' : colors.textPrimary }
                      ]}
                    >
                      {size.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* Section: Reading Format */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Lesezeit-Präferenz
          </Text>
          <View style={styles.toggleRow}>
            {[
              { id: 'quick', label: 'Kompakt (1–2m)' },
              { id: 'balanced', label: 'Ausgewogen (3–5m)' },
              { id: 'deep', label: 'Tiefgang (5m+)' }
            ].map(d => (
              <TouchableOpacity
                key={d.id}
                onPress={() => updateDurationPreference(d.id as ReadingPreferenceDuration)}
                style={[
                  styles.togglePill,
                  {
                    backgroundColor: profile.readingPreferences.preferredDuration === d.id ? colors.accent : colors.surface,
                    borderColor: colors.borderSubtle
                  }
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Lesezeit ${d.label} wählen`}
              >
                <Text
                  style={[
                    styles.toggleText,
                    { color: profile.readingPreferences.preferredDuration === d.id ? '#FFFFFF' : colors.textPrimary }
                  ]}
                >
                  {d.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Section: Modular Feature Registry (Atmen Baukasten) */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Modulare Funktionen (Atmen Baukasten)
          </Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
            Schalte einzelne Module nach deinen persönlichen Lern- und Konzentrationsbedürfnissen ein oder aus.
          </Text>
          <View style={[styles.box, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
            {FEATURE_MODULES.map((mod, index) => {
              const enabled = isFeatureEnabled(profile, mod.id);
              return (
                <View
                  key={mod.id}
                  style={[
                    styles.settingItemRow,
                    index > 0 && { borderTopWidth: 0.5, borderTopColor: colors.borderSubtle }
                  ]}
                >
                  <View style={{ flex: 1, paddingRight: spacing.md }}>
                    <Text style={[styles.settingItemLabel, { color: colors.textPrimary }]}>
                      {mod.title}
                    </Text>
                    <Text style={{ fontSize: typography.sizes.micro, color: colors.textMuted, marginTop: 2 }}>
                      {mod.description}
                    </Text>
                  </View>
                  <Switch
                    value={enabled}
                    onValueChange={() => void toggleFeatureModule(mod.id)}
                    trackColor={{ false: colors.borderSubtle, true: colors.accent }}
                    thumbColor="#FFFFFF"
                    accessibilityRole="switch"
                    accessibilityLabel={`${mod.title} umschalten`}
                  />
                </View>
              );
            })}
          </View>
        </View>

        {/* Section: Daily Editions & Weather Location */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Tagesausgaben & Wetter-Ort
          </Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
            Honeste Wetterlage (Open-Meteo & DWD) für deinen morgendlichen Fokus-Start ohne Standort-Tracking.
          </Text>
          <View style={[styles.box, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
            {/* Weather Toggle */}
            <View style={styles.settingItemRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingItemLabel, { color: colors.textPrimary }]}>
                  Morgenwetter anzeigen
                </Text>
                <Text style={{ fontSize: typography.sizes.micro, color: colors.textMuted, marginTop: 2 }}>
                  Echtes WMO-Wetter in der Guten-Morgen-Ausgabe
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => updateEditionPreferences({
                  weatherEnabled: profile.editionPreferences?.weatherEnabled === false ? true : false
                })}
                style={[
                  styles.smallPill,
                  {
                    backgroundColor: profile.editionPreferences?.weatherEnabled !== false ? colors.accent : colors.surfaceSecondary
                  }
                ]}
                accessibilityRole="button"
                accessibilityLabel="Wetteranzeige umschalten"
              >
                <Text
                  style={[
                    styles.smallPillText,
                    { color: profile.editionPreferences?.weatherEnabled !== false ? '#FFFFFF' : colors.textPrimary }
                  ]}
                >
                  {profile.editionPreferences?.weatherEnabled !== false ? 'Aktiv' : 'Aus'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* City Selector */}
            <View style={[styles.settingItemRow, { borderTopWidth: 0.5, borderTopColor: colors.borderSubtle, flexDirection: 'column', alignItems: 'flex-start', gap: 8 }]}>
              <Text style={[styles.settingItemLabel, { color: colors.textPrimary }]}>
                Wetter-Stadt:
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, width: '100%' }}>
                {[
                  { id: 'dresden', label: 'Dresden' },
                  { id: 'leipzig', label: 'Leipzig' },
                  { id: 'berlin', label: 'Berlin' },
                  { id: 'muenchen', label: 'München' },
                  { id: 'hamburg', label: 'Hamburg' },
                  { id: 'wien', label: 'Wien' },
                  { id: 'zuerich', label: 'Zürich' }
                ].map(c => {
                  const currentCity = (profile.editionPreferences?.weatherCity || 'dresden').toLowerCase();
                  const isSelected = currentCity === c.id;
                  return (
                    <TouchableOpacity
                      key={c.id}
                      onPress={() => updateEditionPreferences({ weatherCity: c.id })}
                      style={[
                        styles.smallPill,
                        {
                          backgroundColor: isSelected ? colors.accent : colors.surfaceSecondary,
                          borderColor: isSelected ? colors.accent : colors.borderSubtle,
                          borderWidth: 1,
                          paddingHorizontal: 12,
                          paddingVertical: 6
                        }
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`Stadt ${c.label} wählen`}
                    >
                      <Text
                        style={[
                          styles.smallPillText,
                          {
                            color: isSelected ? '#FFFFFF' : colors.textPrimary,
                            fontWeight: isSelected ? '700' : '500'
                          }
                        ]}
                      >
                        {isSelected ? `✓ ${c.label}` : c.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>
        </View>

          </>
        )}

        {activeSubTab === 'focus' && (
          <>
        {/* Section: Topic Weights */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Themengewichtung für die Tagesausgabe
          </Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
            Passe die Relevanz an. Änderungen wirken sich sofort spürbar auf die Reihung deines Feeds aus.
          </Text>

          <View style={[styles.box, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
            {(Object.keys(TOPIC_METADATA) as TopicTag[]).map((tag, idx) => {
              const meta = TOPIC_METADATA[tag];
              const weight = profile.explicitInterests[tag] ?? 0.5;
              const weightPct = Math.round(weight * 100);

              return (
                <View
                  key={tag}
                  style={[
                    styles.weightRow,
                    idx > 0 && { borderTopWidth: 0.5, borderTopColor: colors.borderSubtle }
                  ]}
                >
                  <View style={styles.weightInfo}>
                    <View style={styles.labelRow}>
                      <Ionicons name={meta.icon as any} size={15} color={colors.accent} style={{ marginRight: 6 }} />
                      <Text style={[styles.weightLabel, { color: colors.textPrimary }]}>
                        {meta.label}
                      </Text>
                    </View>
                    <Text style={[styles.weightPercent, { color: colors.accent }]}>
                      {weightPct}% Priorität
                    </Text>
                  </View>

                  <View style={styles.stepperContainer}>
                    <TouchableOpacity
                      onPress={() => handleAdjustWeight(tag, -0.1)}
                      style={[styles.stepperButton, { backgroundColor: colors.surfaceSecondary }]}
                      disabled={weight <= 0.05}
                      accessibilityRole="button"
                      accessibilityLabel={`${meta.label} Priorität verringern`}
                    >
                      <Ionicons name="remove" size={16} color={weight <= 0.05 ? colors.border : colors.textPrimary} />
                    </TouchableOpacity>

                    {/* Visual Progress Pill */}
                    <View style={[styles.weightBarTrack, { backgroundColor: colors.surfaceSecondary }]}>
                      <View
                        style={[
                          styles.weightBarFill,
                          { width: `${weightPct}%`, backgroundColor: colors.accent }
                        ]}
                      />
                    </View>

                    <TouchableOpacity
                      onPress={() => handleAdjustWeight(tag, 0.1)}
                      style={[styles.stepperButton, { backgroundColor: colors.surfaceSecondary }]}
                      disabled={weight >= 0.95}
                      accessibilityRole="button"
                      accessibilityLabel={`${meta.label} Priorität erhöhen`}
                    >
                      <Ionicons name="add" size={16} color={weight >= 0.95 ? colors.border : colors.textPrimary} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Section: Algorithmus-Spiegel (Live-Profil) */}
        <View style={styles.section}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="sparkles" size={18} color={colors.accent} />
              <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginBottom: 0 }]}>
                Dein Algorithmus-Spiegel (Live-Profil)
              </Text>
            </View>
          </View>
          <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
            Transparente Einsicht in alle gelernten Signale deiner Interaktionen. 100% lokal, ohne geheime Tracker.
          </Text>

          <View style={[styles.box, { backgroundColor: colors.surface, borderColor: colors.borderSubtle, padding: spacing.md }]}>
            {/* Live Interaction Counters */}
            <View style={styles.mirrorStatsGrid}>
              <View style={[styles.mirrorStatCard, { backgroundColor: colors.surfaceSecondary }]}>
                <Text style={[styles.mirrorStatNumber, { color: colors.accent }]}>{readCount}</Text>
                <Text style={[styles.mirrorStatLabel, { color: colors.textSecondary }]}>📖 Gelesen</Text>
              </View>
              <View style={[styles.mirrorStatCard, { backgroundColor: colors.surfaceSecondary }]}>
                <Text style={[styles.mirrorStatNumber, { color: '#10B981' }]}>{upvoteCount}</Text>
                <Text style={[styles.mirrorStatLabel, { color: colors.textSecondary }]}>▲ Upvotes</Text>
              </View>
              <View style={[styles.mirrorStatCard, { backgroundColor: colors.surfaceSecondary }]}>
                <Text style={[styles.mirrorStatNumber, { color: '#EF4444' }]}>{downvoteCount}</Text>
                <Text style={[styles.mirrorStatLabel, { color: colors.textSecondary }]}>▼ Downvotes</Text>
              </View>
              <View style={[styles.mirrorStatCard, { backgroundColor: colors.surfaceSecondary }]}>
                <Text style={[styles.mirrorStatNumber, { color: '#38BDF8' }]}>{savedCount}</Text>
                <Text style={[styles.mirrorStatLabel, { color: colors.textSecondary }]}>★ Gespeichert</Text>
              </View>
              <View style={[styles.mirrorStatCard, { backgroundColor: colors.surfaceSecondary }]}>
                <Text style={[styles.mirrorStatNumber, { color: '#F59E0B' }]}>{notesCount}</Text>
                <Text style={[styles.mirrorStatLabel, { color: colors.textSecondary }]}>✍️ Notizen</Text>
              </View>
              <View style={[styles.mirrorStatCard, { backgroundColor: colors.surfaceSecondary }]}>
                <Text style={[styles.mirrorStatNumber, { color: '#8B5CF6' }]}>{customChannelsCount}</Text>
                <Text style={[styles.mirrorStatLabel, { color: colors.textSecondary }]}>🪐 Spaces</Text>
              </View>
            </View>

            {/* Feed-Mischverhältnis Bar & Presets */}
            <View style={{ marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 0.5, borderTopColor: colors.borderSubtle }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
                  Feed-Mischverhältnis (Fokus / Reibung / Entdeckung)
                </Text>
                <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textMuted }}>
                  {focusPct}% / {socraticPct}% / {serendipityPct}%
                </Text>
              </View>

              {/* Multi-color ratio bar */}
              <View style={styles.ratioBarTrack}>
                <View style={[styles.ratioBarSegment, { width: `${focusPct}%`, backgroundColor: '#10B981' }]} />
                <View style={[styles.ratioBarSegment, { width: `${socraticPct}%`, backgroundColor: '#F59E0B' }]} />
                <View style={[styles.ratioBarSegment, { width: `${serendipityPct}%`, backgroundColor: '#8B5CF6' }]} />
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, marginBottom: 10 }}>
                <Text style={{ fontSize: 10, color: '#10B981', fontWeight: '600' }}>● Fokus ({focusPct}%)</Text>
                <Text style={{ fontSize: 10, color: '#F59E0B', fontWeight: '600' }}>● Sokratisch ({socraticPct}%)</Text>
                <Text style={{ fontSize: 10, color: '#8B5CF6', fontWeight: '600' }}>● Entdecker ({serendipityPct}%)</Text>
              </View>

              {/* Preset buttons */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                <TouchableOpacity
                  onPress={() => updateFeedMixRatio(0.60, 0.20, 0.20)}
                  style={[
                    styles.presetPill,
                    { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle },
                    focusPct === 60 && socraticPct === 20 && { borderColor: colors.accent, backgroundColor: colors.accentSubtle }
                  ]}
                >
                  <Text style={[styles.presetPillText, { color: colors.textPrimary }]}>⚖️ Ausgewogen (60/20/20)</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => updateFeedMixRatio(0.80, 0.10, 0.10)}
                  style={[
                    styles.presetPill,
                    { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle },
                    focusPct === 80 && socraticPct === 10 && { borderColor: colors.accent, backgroundColor: colors.accentSubtle }
                  ]}
                >
                  <Text style={[styles.presetPillText, { color: colors.textPrimary }]}>🎯 Tiefer Fokus (80/10/10)</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => updateFeedMixRatio(0.40, 0.40, 0.20)}
                  style={[
                    styles.presetPill,
                    { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle },
                    focusPct === 40 && socraticPct === 40 && { borderColor: colors.accent, backgroundColor: colors.accentSubtle }
                  ]}
                >
                  <Text style={[styles.presetPillText, { color: colors.textPrimary }]}>⚡ Sokratische Reibung (40/40/20)</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => updateFeedMixRatio(0.40, 0.20, 0.40)}
                  style={[
                    styles.presetPill,
                    { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle },
                    focusPct === 40 && socraticPct === 20 && serendipityPct === 40 && { borderColor: colors.accent, backgroundColor: colors.accentSubtle }
                  ]}
                >
                  <Text style={[styles.presetPillText, { color: colors.textPrimary }]}>🧭 Entdecker (40/20/40)</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* ▲ Boosted Signals Section */}
            <View style={{ marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 0.5, borderTopColor: colors.borderSubtle }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <Ionicons name="arrow-up-circle" size={16} color="#10B981" />
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
                  ▲ Verstärkte Signale ({boostedItems.length})
                </Text>
              </View>
              {boostedItems.length === 0 ? (
                <Text style={{ fontSize: 11, color: colors.textMuted, fontStyle: 'italic', marginVertical: 4 }}>
                  Noch keine aktiven Verstärkungen. Mit ▲ aufgewertete Beiträge verankern Themen, Autoren & Quellen hier.
                </Text>
              ) : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                  {boostedItems.map((item, idx) => (
                    <View
                      key={`${item.category}-${item.key}-${idx}`}
                      style={[styles.signalPill, { backgroundColor: 'rgba(16, 185, 129, 0.12)', borderColor: 'rgba(16, 185, 129, 0.3)' }]}
                    >
                      <Text style={[styles.signalPillText, { color: '#059669' }]}>
                        ▲ {item.label} (+{item.count})
                      </Text>
                      <TouchableOpacity
                        onPress={() => removeFeedbackBoost(item.category, item.key)}
                        style={styles.signalRemoveBtn}
                        accessibilityLabel={`${item.label} Verstärkung aufheben`}
                      >
                        <Ionicons name="close" size={12} color="#059669" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* ▼ Penalized Signals Section */}
            <View style={{ marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 0.5, borderTopColor: colors.borderSubtle }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <Ionicons name="arrow-down-circle" size={16} color="#EF4444" />
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>
                  ▼ Gedämpfte Signale ({penalizedItems.length})
                </Text>
              </View>
              {penalizedItems.length === 0 ? (
                <Text style={{ fontSize: 11, color: colors.textMuted, fontStyle: 'italic', marginVertical: 4 }}>
                  Keine Dämpfungen aktiv. Mit ▼ abgewertete Beiträge dämpfen Relevanz deterministisch.
                </Text>
              ) : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                  {penalizedItems.map((item, idx) => (
                    <View
                      key={`${item.category}-${item.key}-${idx}`}
                      style={[styles.signalPill, { backgroundColor: 'rgba(239, 68, 68, 0.12)', borderColor: 'rgba(239, 68, 68, 0.3)' }]}
                    >
                      <Text style={[styles.signalPillText, { color: '#DC2626' }]}>
                        ▼ {item.label} (-{item.count})
                      </Text>
                      <TouchableOpacity
                        onPress={() => removeFeedbackPenalty(item.category, item.key)}
                        style={styles.signalRemoveBtn}
                        accessibilityLabel={`${item.label} Dämpfung aufheben`}
                      >
                        <Ionicons name="close" size={12} color="#DC2626" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Reset feedback memory button */}
            {(boostedItems.length > 0 || penalizedItems.length > 0) && (
              <View style={{ marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 0.5, borderTopColor: colors.borderSubtle }}>
                <TouchableOpacity
                  onPress={async () => {
                    await clearFeedbackMemory();
                    setResetMemoryNotice('✓ Lern-Historie & Signale zurückgesetzt');
                    setTimeout(() => setResetMemoryNotice(null), 3000);
                  }}
                  style={[styles.resetMemoryBtn, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}
                >
                  <Ionicons name="refresh-outline" size={14} color={colors.textSecondary} style={{ marginRight: 6 }} />
                  <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary }}>
                    Lern-Historie & Signale zurücksetzen
                  </Text>
                </TouchableOpacity>
                {resetMemoryNotice && (
                  <Text style={{ fontSize: 11, color: colors.accent, marginTop: 4, fontWeight: '600' }}>
                    {resetMemoryNotice}
                  </Text>
                )}
              </View>
            )}
          </View>
        </View>

        {/* Section: News-Hub & Quellen-Zentrale */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            News-Hub & Quellen-Zentrale
          </Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
            Verwalte 29 verifizierte RSS-Feeds (ÖRR, Spektrum, Quanta, YouTube) und importiere eigene Feeds oder OPML-Dateien.
          </Text>

          <View style={[styles.box, { backgroundColor: colors.surface, borderColor: colors.borderSubtle, padding: spacing.md }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <View style={{ flex: 1, minWidth: 200 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <Ionicons name="radio-outline" size={16} color={colors.accent} />
                  <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 14 }}>
                    29 Aktive Primärquellen & Import-Center
                  </Text>
                </View>
                <Text style={{ fontSize: 12, color: colors.textMuted, lineHeight: 16 }}>
                  Öffentlich-Rechtliche (Tagesschau, ZDF, DLF), Wissenschaft, Kultur & OPML-Export für maximale Datensouveränität.
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => setShowNewsHub(true)}
                style={[styles.manageSourcesBtn, { backgroundColor: colors.accent }]}
                accessibilityRole="button"
                accessibilityLabel="News-Hub öffnen"
              >
                <Ionicons name="options-outline" size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 12 }}>News-Hub öffnen</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

          </>
        )}

        {activeSubTab === 'data' && (
          <>
        {/* Section: Serverless Live-Sync & GitHub Snapshot URL */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Serverless Live-Sync & Snapshot-Pipeline
          </Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
            Atmen läuft ohne Home-Server über autonome GitHub-Actions-Snapshots. Konfiguriere hier eine eigene Remote-URL oder nutze den Standard.
          </Text>

          <View style={[styles.box, { backgroundColor: colors.surface, borderColor: colors.borderSubtle, padding: spacing.md }]}>
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
              Remote-Snapshot-URL (JSON):
            </Text>
            <View style={[styles.keyInputRow, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
              <TextInput
                style={[styles.keyInput, { color: colors.textPrimary }]}
                value={remoteUrlInput}
                onChangeText={setRemoteUrlInput}
                placeholder="https://raw.githubusercontent.com/.../feed-snapshot.json"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 10, flexWrap: 'wrap' }}>
              <TouchableOpacity
                onPress={handleSaveRemoteUrl}
                style={[styles.testConnectionBtn, { backgroundColor: colors.accent }]}
              >
                <Text style={styles.testConnectionBtnText}>URL speichern</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSyncRemoteNow}
                disabled={isSyncingSnapshot}
                style={[styles.testConnectionBtn, { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.borderSubtle }]}
              >
                {isSyncingSnapshot ? (
                  <ActivityIndicator size="small" color={colors.accent} style={{ marginRight: 6 }} />
                ) : (
                  <Ionicons name="refresh-outline" size={14} color={colors.accent} style={{ marginRight: 6 }} />
                )}
                <Text style={[styles.testConnectionBtnText, { color: colors.textPrimary }]}>Jetzt synchronisieren</Text>
              </TouchableOpacity>

              {remoteUrlSavedNotice && (
                <Text style={{ fontSize: 12, color: '#10B981', fontWeight: '600' }}>{remoteUrlSavedNotice}</Text>
              )}
            </View>

            {snapshotSyncInfo && (
              <View style={{ marginTop: 12, padding: 8, borderRadius: radius.sm, backgroundColor: colors.surfaceSecondary }}>
                <Text style={{ fontSize: 11, color: colors.textMuted }}>
                  Letzter Sync: <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>{snapshotSyncInfo}</Text>
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Section: Craft Docs & Markdown Export */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Datensouveränität & Craft Docs Export
          </Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
            Exportiere alle gemerkten Lese-Entdeckungen, dialektischen Einwände und Sparring-Dialoge in dein persönliches Craft- oder Obsidian-Archiv.
          </Text>
          <View style={[styles.box, { backgroundColor: colors.surface, borderColor: colors.borderSubtle, padding: spacing.md }]}>
            {craftNotice && (
              <View style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', padding: 10, borderRadius: radius.md, marginBottom: 12 }}>
                <Text style={{ fontSize: typography.sizes.micro, color: '#10B981', fontWeight: '700', textAlign: 'center' }}>
                  {craftNotice}
                </Text>
              </View>
            )}

            <Text style={{ fontSize: typography.sizes.micro, color: colors.textSecondary, lineHeight: 18, marginBottom: 12 }}>
              Bereit für <Text style={{ fontWeight: '700', color: colors.textPrimary }}>Craft Docs</Text>, <Text style={{ fontWeight: '700', color: colors.textPrimary }}>Obsidian</Text>, <Text style={{ fontWeight: '700', color: colors.textPrimary }}>Notion</Text> oder <Text style={{ fontWeight: '700', color: colors.textPrimary }}>Bear</Text>. Enthält vollständige Quellenverweise, Kern-Erkenntnisse und deine verfassten Unterrichtsnotizen.
            </Text>

            <View style={styles.exportButtonRow}>
              <TouchableOpacity
                onPress={handleCopyCraftMarkdown}
                style={[styles.exportActionBtn, { backgroundColor: colors.accent }]}
                accessibilityRole="button"
                accessibilityLabel="Bibliothek als Craft-Markdown in Zwischenablage kopieren"
              >
                <Ionicons name="copy-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.exportActionBtnText}>In Zwischenablage kopieren</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleDownloadCraftMarkdown}
                style={[styles.exportActionBtn, { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.borderSubtle }]}
                accessibilityRole="button"
                accessibilityLabel="Bibliothek als Markdown-Datei herunterladen"
              >
                <Ionicons name="download-outline" size={16} color={colors.textPrimary} style={{ marginRight: 6 }} />
                <Text style={[styles.exportActionBtnText, { color: colors.textPrimary }]}>Als .md herunterladen</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Section: Datensicherung & Portabilität (V2 Backup) */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Datensicherung & Portabilität (V2 Backup)
          </Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
            Sichere dein gesamtes lokales Wissen (Profil, Notizen, Lese-Chronik, gespeicherte Artikel, Gedanken, Wissensverbindungen und Regeln) als portable JSON-Datei.
            API-Schlüssel und Tokens werden aus Datenschutzgründen niemals exportiert.
          </Text>
          <View style={[styles.box, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
            <View style={{ padding: spacing.md }}>
              <Text style={{ fontSize: typography.sizes.bodySmall, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 }}>
                Lokales Wissen portieren oder sichern
              </Text>
              <Text style={{ fontSize: typography.sizes.micro, color: colors.textSecondary, lineHeight: 18, marginBottom: 12 }}>
                Vollständig abwärtskompatibles V2-JSON-Format. Funktioniert geräte- und browserübergreifend.
              </Text>

              {backupNotice && (
                <View style={{ backgroundColor: colors.accentSubtle, padding: 10, borderRadius: radius.md, marginBottom: 12, flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="checkmark-circle-outline" size={16} color={colors.accent} style={{ marginRight: 6 }} />
                  <Text style={{ fontSize: typography.sizes.micro, color: colors.accent, fontWeight: '700' }}>{backupNotice}</Text>
                </View>
              )}

              <View style={styles.exportButtonRow}>
                <TouchableOpacity
                  onPress={handleExportBackupJson}
                  disabled={isExportingBackup}
                  style={[styles.exportActionBtn, { backgroundColor: colors.accent }]}
                  accessibilityRole="button"
                  accessibilityLabel="V2 Backup als JSON-Datei herunterladen"
                >
                  <Ionicons name="download-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.exportActionBtnText}>
                    {isExportingBackup ? 'Exportiere…' : 'Backup herunterladen (.json)'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setShowImportModal(true)}
                  style={[styles.exportActionBtn, { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.borderSubtle }]}
                  accessibilityRole="button"
                  accessibilityLabel="Backup-JSON wiederherstellen"
                >
                  <Ionicons name="cloud-upload-outline" size={16} color={colors.textPrimary} style={{ marginRight: 6 }} />
                  <Text style={[styles.exportActionBtnText, { color: colors.textPrimary }]}>Backup wiederherstellen</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        {/* Section: Verified Quality Sources */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Öffentlich-Rechtliche & Geprüfte Qualitätsquellen
          </Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
            Verlässlicher deutscher Journalismus & intellektuelle Tiefenquellen ohne Clickbait-Algorithmen.
          </Text>
          <View style={[styles.box, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
            <View style={{ padding: spacing.md, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {[
                { name: 'ARD Tagesschau Wissen', icon: 'newspaper-outline' },
                { name: 'ARD Tagesschau Inland', icon: 'globe-outline' },
                { name: 'ZDFheute Wissen & Kultur', icon: 'tv-outline' },
                { name: 'Stanford Encyclopedia', icon: 'book-outline' },
                { name: 'Daily Nous (Philosophie)', icon: 'chatbubbles-outline' },
                { name: 'Deutsches Schulportal', icon: 'school-outline' },
                { name: 'Quanta Magazine', icon: 'analytics-outline' },
                { name: 'Simon Willison AI', icon: 'code-slash-outline' },
                { name: 'Lines Modular Audio', icon: 'hardware-chip-outline' }
              ].map(source => (
                <View key={source.name} style={[styles.sourceTag, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]}>
                  <Ionicons name={source.icon as any} size={14} color={colors.accent} style={{ marginRight: 5 }} />
                  <Text style={[styles.sourceTagText, { color: colors.textPrimary }]}>{source.name}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Section: Ecosystem Roadmap */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Weitere Ökosystem-Anbindungen (Roadmap)
          </Text>
          <View style={[styles.box, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
            <View style={styles.roadmapItem}>
              <Ionicons name="bookmark-outline" size={20} color={colors.accent} style={{ marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.roadmapTitle, { color: colors.textPrimary }]}>Raindrop.io Lesezeichen</Text>
                <Text style={[styles.roadmapDesc, { color: colors.textMuted }]}>
                  Intelligente Synchronisation mit deinen kuratierten Sammlungen (Phase 5).
                </Text>
              </View>
              <View style={[styles.badgePlanned, { backgroundColor: colors.surfaceSecondary }]}>
                <Text style={[styles.badgePlannedText, { color: colors.textMuted }]}>Geplant</Text>
              </View>
            </View>

            <View style={[styles.roadmapItem, { borderTopWidth: 0.5, borderTopColor: colors.borderSubtle }]}>
              <Ionicons name="flash-outline" size={20} color={colors.accent} style={{ marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.roadmapTitle, { color: colors.textPrimary }]}>Apple Kurzbefehle & Widgets</Text>
                <Text style={[styles.roadmapDesc, { color: colors.textMuted }]}>
                  Tagesausgabe direkt per Action Button oder Widget auf dem iPhone 15 Pro starten (Phase 6).
                </Text>
              </View>
              <View style={[styles.badgePlanned, { backgroundColor: colors.surfaceSecondary }]}>
                <Text style={[styles.badgePlannedText, { color: colors.textMuted }]}>Geplant</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Section: Privacy & Reset */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Datenschutz & Speicherverwaltung
          </Text>
          <View style={[styles.box, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
            <View style={{ padding: spacing.md }}>
              <Text style={[styles.privacyText, { color: colors.textSecondary }]}>
                Alle Daten, Lesezeichen und Interessensprofile sind lokal auf diesem Gerät gespeichert (Local-First). Es erfolgt keine ungefragte Weitergabe an Cloud-Server oder Werbenetzwerke.
              </Text>
            </View>

            {/* Repeat Onboarding Option (Non-destructive) */}
            <TouchableOpacity
              onPress={handleRepeatOnboarding}
              style={[styles.resetButton, { borderTopColor: colors.borderSubtle }]}
              accessibilityRole="button"
              accessibilityLabel="Onboarding wiederholen, Daten bleiben erhalten"
            >
              <Ionicons name="sparkles-outline" size={16} color={colors.accent} style={{ marginRight: 8 }} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.actionRowTitle, { color: colors.textPrimary }]}>
                  Onboarding wiederholen
                </Text>
                <Text style={[styles.actionRowSubtitle, { color: colors.textMuted }]}>
                  Passe Themen und Lesezeit neu an. Deine Lesezeichen und Lesefortschritte bleiben erhalten.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </TouchableOpacity>

            {/* Destructive Clear All Data Option */}
            <TouchableOpacity
              onPress={() => setShowClearConfirm(true)}
              style={[styles.resetButton, { borderTopColor: colors.borderSubtle }]}
              accessibilityRole="button"
              accessibilityLabel="Alle lokalen Daten löschen und App zurücksetzen"
            >
              <Ionicons name="trash-outline" size={16} color={colors.danger} style={{ marginRight: 8 }} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.actionRowTitle, { color: colors.danger }]}>
                  Alle lokalen Daten löschen
                </Text>
                <Text style={[styles.actionRowSubtitle, { color: colors.textMuted }]}>
                  Setzt die gesamte Datenbank zurück: Lesezeichen, Leseverlauf und Profile werden gelöscht.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.danger} />
            </TouchableOpacity>
          </View>
        </View>
          </>
        )}
      </ScrollView>

      {/* Confirmation Modal for Destructive Reset */}
      <Modal
        visible={showClearConfirm}
        transparent={true}
        animationType="fade"
        onRequestClose={() => !isClearing && setShowClearConfirm(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            accessibilityLabel="Hintergrund schließen"
            onPress={() => !isClearing && setShowClearConfirm(false)}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
            onStartShouldSetResponder={() => true}
            // @ts-ignore - web click propagation guard
            onClick={(e: any) => {
              if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
            }}
          >
            <View style={styles.modalHeader}>
              <View style={[styles.warningIconCircle, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                <Ionicons name="warning" size={24} color={colors.danger} />
              </View>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                Alle lokalen Daten löschen?
              </Text>
            </View>

            <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>
              Bist du sicher? Diese Aktion setzt Atem vollständig in den Auslieferungszustand zurück:
            </Text>

            <View style={[styles.deleteItemsBox, { backgroundColor: colors.surfaceSecondary }]}>
              <Text style={[styles.deleteItemText, { color: colors.textPrimary }]}>
                • Alle gespeicherten Lesezeichen & die Bibliothek
              </Text>
              <Text style={[styles.deleteItemText, { color: colors.textPrimary }]}>
                • Vollständiger Lesefortschritt aller Artikel
              </Text>
              <Text style={[styles.deleteItemText, { color: colors.textPrimary }]}>
                • Alle Feedback-Bewertungen („Mehr davon / Weniger“)
              </Text>
              <Text style={[styles.deleteItemText, { color: colors.textPrimary }]}>
                • Persönliche Themengewichtungen & Lesezeit-Präferenzen
              </Text>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setShowClearConfirm(false)}
                disabled={isClearing}
                style={[styles.modalCancelBtn, { backgroundColor: colors.surfaceSecondary }]}
                accessibilityRole="button"
                accessibilityLabel="Abbrechen"
              >
                <Text style={[styles.modalCancelBtnText, { color: colors.textPrimary }]}>
                  Abbrechen
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleConfirmClearAll}
                disabled={isClearing}
                style={[styles.modalConfirmBtn, { backgroundColor: colors.danger }]}
                accessibilityRole="button"
                accessibilityLabel="Unwiderruflich löschen"
              >
                {isClearing ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.modalConfirmBtnText}>
                    Unwiderruflich löschen
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal for Backup JSON Import */}
      <Modal
        visible={showImportModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => !isImporting && setShowImportModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            accessibilityLabel="Hintergrund schließen"
            onPress={() => !isImporting && setShowImportModal(false)}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle, maxHeight: '80%' }]}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.modalHeader}>
              <View style={[styles.warningIconCircle, { backgroundColor: colors.accentSubtle }]}>
                <Ionicons name="cloud-upload" size={24} color={colors.accent} />
              </View>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                Backup wiederherstellen
              </Text>
            </View>

            <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>
              Füge hier den Inhalt deiner gesicherten Atmen-Backup-Datei (.json) ein. Daten werden vor dem Überschreiben schema-geprüft:
            </Text>

            <TextInput
              style={[
                styles.keyInput,
                {
                  backgroundColor: colors.surfaceSecondary,
                  borderColor: colors.borderSubtle,
                  borderWidth: 1,
                  borderRadius: radius.md,
                  color: colors.textPrimary,
                  height: 120,
                  textAlignVertical: 'top',
                  fontSize: 12,
                  fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                  padding: 8
                }
              ]}
              multiline
              numberOfLines={6}
              placeholder='{"version": 2, "profile": { ... }, ...}'
              placeholderTextColor={colors.textMuted}
              value={importJsonText}
              onChangeText={setImportJsonText}
              editable={!isImporting}
            />

            {importStatus && (
              <View
                style={{
                  backgroundColor: importStatus.ok ? colors.accentSubtle : 'rgba(239, 68, 68, 0.1)',
                  borderColor: importStatus.ok ? colors.accent : colors.danger,
                  borderWidth: 1,
                  borderRadius: radius.md,
                  padding: 10,
                  marginTop: 10,
                  flexDirection: 'row',
                  alignItems: 'center'
                }}
              >
                <Ionicons
                  name={importStatus.ok ? 'checkmark-circle-outline' : 'alert-circle-outline'}
                  size={16}
                  color={importStatus.ok ? colors.accent : colors.danger}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={{
                    fontSize: typography.sizes.micro,
                    color: importStatus.ok ? colors.accent : colors.danger,
                    fontWeight: '700',
                    flex: 1
                  }}
                >
                  {importStatus.message}
                </Text>
              </View>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => {
                  setShowImportModal(false);
                  setImportJsonText('');
                  setImportStatus(null);
                }}
                disabled={isImporting}
                style={[styles.modalCancelBtn, { backgroundColor: colors.surfaceSecondary }]}
                accessibilityRole="button"
                accessibilityLabel="Abbrechen"
              >
                <Text style={[styles.modalCancelBtnText, { color: colors.textPrimary }]}>
                  Abbrechen
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleImportBackupJson}
                disabled={isImporting || !importJsonText.trim()}
                style={[styles.modalConfirmBtn, { backgroundColor: colors.accent, opacity: !importJsonText.trim() ? 0.5 : 1 }]}
                accessibilityRole="button"
                accessibilityLabel="Wiederherstellen"
              >
                {isImporting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.modalConfirmBtnText}>
                    Wiederherstellen
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* News-Hub Modal */}
      <NewsHubModal
        visible={showNewsHub}
        onClose={() => setShowNewsHub(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  subTabBarContainer: {
    borderBottomWidth: 0.5,
    paddingHorizontal: spacing.pageHorizontal,
    paddingVertical: 8,
  },
  subTabBarInner: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    maxWidth: 860,
    width: '100%',
    alignSelf: 'center',
  },
  subTabButton: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  subTabText: {
    fontSize: typography.sizes.caption,
  },
  container: {
    flex: 1,
    minHeight: 0,
    ...(Platform.OS === 'web' ? ({ overflow: 'hidden' } as any) : {})
  },
  manageSourcesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill
  },
  header: {
    paddingHorizontal: spacing.pageHorizontal,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 0.5
  },
  headerInner: {
    maxWidth: 860,
    width: '100%',
    alignSelf: 'center'
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 0.5
  },
  backBtnText: {
    fontSize: typography.sizes.caption,
    fontWeight: '700'
  },
  closeIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center'
  },
  title: {
    fontSize: typography.sizes.title1,
    fontWeight: '800'
  },
  subtitle: {
    fontSize: typography.sizes.micro,
    marginTop: 2
  },
  scrollContent: {
    maxWidth: 860,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: spacing.pageHorizontal,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl * 2
  },
  section: {
    marginBottom: spacing.xl
  },
  sectionTitle: {
    fontSize: typography.sizes.body,
    fontWeight: '700',
    marginBottom: 4
  },
  sectionSubtitle: {
    fontSize: typography.sizes.micro,
    lineHeight: 16,
    marginBottom: spacing.sm
  },
  box: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden'
  },
  weightRow: {
    padding: spacing.md
  },
  weightInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  weightLabel: {
    fontSize: typography.sizes.bodySmall,
    fontWeight: '600'
  },
  weightPercent: {
    fontSize: typography.sizes.micro,
    fontWeight: '700'
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  stepperButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center'
  },
  weightBarTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden'
  },
  weightBarFill: {
    height: '100%',
    borderRadius: 3
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8
  },
  togglePill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 0.5,
    alignItems: 'center'
  },
  toggleText: {
    fontSize: typography.sizes.micro,
    fontWeight: '600'
  },
  settingItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md
  },
  settingItemLabel: {
    fontSize: typography.sizes.bodySmall,
    fontWeight: '600'
  },
  subToggleRow: {
    flexDirection: 'row',
    gap: 6
  },
  smallPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill
  },
  smallPillText: {
    fontSize: typography.sizes.micro,
    fontWeight: '700'
  },
  roadmapItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md
  },
  roadmapTitle: {
    fontSize: typography.sizes.bodySmall,
    fontWeight: '600',
    marginBottom: 2
  },
  roadmapDesc: {
    fontSize: typography.sizes.micro,
    lineHeight: 15
  },
  badgePlanned: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill
  },
  badgePlannedText: {
    fontSize: typography.sizes.micro,
    fontWeight: '600'
  },
  privacyText: {
    fontSize: typography.sizes.micro,
    lineHeight: 18
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderTopWidth: 0.5
  },
  resetButtonText: {
    fontSize: typography.sizes.bodySmall,
    fontWeight: '600'
  },
  actionRowTitle: {
    fontSize: typography.sizes.bodySmall,
    fontWeight: '600',
    marginBottom: 2
  },
  actionRowSubtitle: {
    fontSize: typography.sizes.micro,
    lineHeight: 16
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.pageHorizontal
  },
  modalCard: {
    width: '100%',
    maxWidth: 460,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md
  },
  warningIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm
  },
  modalTitle: {
    flex: 1,
    fontSize: typography.sizes.title2,
    fontWeight: '700'
  },
  modalMessage: {
    fontSize: typography.sizes.bodySmall,
    lineHeight: 20,
    marginBottom: spacing.md
  },
  deleteItemsBox: {
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: 6
  },
  deleteItemText: {
    fontSize: typography.sizes.micro,
    lineHeight: 18
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-end'
  },
  modalCancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center'
  },
  modalCancelBtnText: {
    fontSize: typography.sizes.bodySmall,
    fontWeight: '600'
  },
  modalConfirmBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 140
  },
  modalConfirmBtnText: {
    color: '#FFFFFF',
    fontSize: typography.sizes.bodySmall,
    fontWeight: '600'
  },
  badgeActive: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill
  },
  badgeActiveText: {
    fontSize: typography.sizes.micro,
    fontWeight: '700'
  },
  budgetTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    width: '100%'
  },
  budgetFill: {
    height: '100%',
    borderRadius: 4
  },
  exportButtonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6
  },
  exportActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.md
  },
  exportActionBtnText: {
    fontSize: typography.sizes.micro,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  sourceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 0.5
  },
  sourceTagText: {
    fontSize: typography.sizes.micro,
    fontWeight: '500'
  },
  inputLabel: {
    fontSize: typography.sizes.caption,
    fontWeight: '600',
    marginBottom: 6
  },
  providerRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 6
  },
  providerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1
  },
  providerBtnText: {
    fontSize: 12,
    fontWeight: '600'
  },
  modelSubtext: {
    fontSize: typography.sizes.micro,
    marginBottom: 4
  },
  keyInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: 10
  },
  keyInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 13
  },
  keyActionBtn: {
    padding: 8
  },
  testConnectionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: radius.md
  },
  testConnectionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600'
  },
  testResultPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    borderWidth: 1
  },
  ledgerBox: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1
  },
  mirrorStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 6
  },
  mirrorStatCard: {
    flex: 1,
    minWidth: '28%',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center'
  },
  mirrorStatNumber: {
    fontSize: 18,
    fontWeight: '800'
  },
  mirrorStatLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2
  },
  ratioBarTrack: {
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    flexDirection: 'row',
    width: '100%',
    backgroundColor: '#E5E7EB'
  },
  ratioBarSegment: {
    height: '100%'
  },
  presetPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1
  },
  presetPillText: {
    fontSize: 11,
    fontWeight: '600'
  },
  signalPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 10,
    paddingRight: 6,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1
  },
  signalPillText: {
    fontSize: 11,
    fontWeight: '600'
  },
  signalRemoveBtn: {
    padding: 3,
    marginLeft: 4,
    borderRadius: 8
  },
  resetMemoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1
  },
  syncStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 0.5
  },
  syncNoticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: 10
  },
  syncTelemetryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: radius.md,
    borderWidth: 0.5,
    marginBottom: 12,
    gap: 10
  },
  smallActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.md,
    borderWidth: 1
  },
  syncModeSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6
  },
  syncModeTab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  syncModeTabText: {
    fontSize: 12,
    fontWeight: '700'
  },
  pairingCard: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1
  },
  textInput: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    fontSize: 13,
    marginBottom: 6
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: radius.md
  },
  primaryActionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700'
  }
});
