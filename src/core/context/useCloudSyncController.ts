import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { FeedItem, ReadingInteraction, UserProfile } from '../domain/types';
import { Subchannel } from '../spaces/spaceRepository';
import {
  cloudSyncService,
  CloudSyncConfig,
  DEFAULT_CLOUD_SYNC_CONFIG
} from '../sync/cloudSyncService';

export interface MergedCloudSnapshotUpdate {
  profile?: UserProfile;
  interactions?: Record<string, ReadingInteraction>;
  savedArticles?: FeedItem[];
  dismissedItemIds?: string[];
  spaces?: Subchannel[];
}

export interface UseCloudSyncControllerParams {
  onMergedSnapshot: (snapshot: MergedCloudSnapshotUpdate) => void;
  onError: (message: string) => void;
}

export interface CloudSyncController {
  cloudSyncConfig: CloudSyncConfig;
  isSyncing: boolean;
  syncStatusMessage: string | null;
  triggerCloudSync: (forcePush?: boolean) => Promise<boolean>;
  updateCloudSyncConfig: (patch: Partial<CloudSyncConfig>) => Promise<void>;
  activateCloudSync: (
    token: string,
    passphrase?: string
  ) => Promise<{ success: boolean; error?: string; gistId?: string }>;
  applyPairingCode: (code: string) => Promise<boolean>;
  getPairingBundle: () => Promise<{ pairingCode: string; pairingUrl: string; qrDataUrl: string }>;
  scheduleCloudSyncPush: () => void;
}

/**
 * Encapsulates Cloud Sync configuration, debounced push scheduling, QR/URL pairing auto-ingest,
 * and bidirectional merged-snapshot reconciliation extracted from AppContext.
 */
export function useCloudSyncController({
  onMergedSnapshot,
  onError
}: UseCloudSyncControllerParams): CloudSyncController {
  const [cloudSyncConfig, setCloudSyncConfig] = useState<CloudSyncConfig>(DEFAULT_CLOUD_SYNC_CONFIG);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncStatusMessage, setSyncStatusMessage] = useState<string | null>(null);

  const syncDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onMergedSnapshotRef = useRef(onMergedSnapshot);
  const onErrorRef = useRef(onError);
  onMergedSnapshotRef.current = onMergedSnapshot;
  onErrorRef.current = onError;

  const showTransientSyncStatus = useCallback((message: string) => {
    setSyncStatusMessage(message);
    if (statusClearTimer.current) {
      clearTimeout(statusClearTimer.current);
    }
    statusClearTimer.current = setTimeout(() => {
      statusClearTimer.current = null;
      setSyncStatusMessage(null);
    }, 5000);
  }, []);

  const triggerCloudSync = useCallback(async (forcePush?: boolean): Promise<boolean> => {
    setIsSyncing(true);
    try {
      const res = await cloudSyncService.sync({ forcePush });
      const cfg = await cloudSyncService.getConfig();
      setCloudSyncConfig(cfg);
      if (res.success && res.mergedSnapshot) {
        onMergedSnapshotRef.current(res.mergedSnapshot);
      }
      setIsSyncing(false);
      return res.success;
    } catch {
      setIsSyncing(false);
      return false;
    }
  }, []);

  const scheduleCloudSyncPush = useCallback(() => {
    if (syncDebounceTimer.current) {
      clearTimeout(syncDebounceTimer.current);
    }
    syncDebounceTimer.current = setTimeout(() => {
      syncDebounceTimer.current = null;
      void (async () => {
        try {
          const cfg = await cloudSyncService.getConfig();
          if (cfg.enabled && cfg.autoSync) {
            await triggerCloudSync(true);
          }
        } catch {
          // Non-fatal
        }
      })();
    }, 1500);
  }, [triggerCloudSync]);

  const updateCloudSyncConfig = useCallback(
    async (patch: Partial<CloudSyncConfig>) => {
      const updated = await cloudSyncService.saveConfig(patch);
      setCloudSyncConfig(updated);
      if (updated.enabled) {
        void triggerCloudSync();
      }
    },
    [triggerCloudSync]
  );

  const activateCloudSync = useCallback(async (token: string, passphrase?: string) => {
    setIsSyncing(true);
    try {
      const res = await cloudSyncService.activateCloudSync(token, passphrase);
      const cfg = await cloudSyncService.getConfig();
      setCloudSyncConfig(cfg);
      setIsSyncing(false);
      return res;
    } catch (err: any) {
      setIsSyncing(false);
      return { success: false, error: err?.message || String(err) };
    }
  }, []);

  const applyPairingCode = useCallback(
    async (code: string): Promise<boolean> => {
      try {
        const ok = await cloudSyncService.applyPairingCode(code);
        const cfg = await cloudSyncService.getConfig();
        setCloudSyncConfig(cfg);
        if (ok) {
          showTransientSyncStatus('✅ Gerät erfolgreich gekoppelt & synchronisiert!');
          void triggerCloudSync();
        }
        return ok;
      } catch (err: any) {
        onErrorRef.current(err?.message || 'Koppel-Code ungültig.');
        return false;
      }
    },
    [showTransientSyncStatus, triggerCloudSync]
  );

  const getPairingBundle = useCallback(async () => {
    return cloudSyncService.getPairingBundle();
  }, []);

  // Initialize Cloud Sync & Handle URL Pairing Auto-Ingest (?pair=...)
  useEffect(() => {
    void (async () => {
      try {
        const cfg = await cloudSyncService.getConfig();
        setCloudSyncConfig(cfg);

        if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.search) {
          const params = new URLSearchParams(window.location.search);
          const pairCode = params.get('pair');
          if (pairCode) {
            const ok = await cloudSyncService.applyPairingCode(pairCode);
            const freshCfg = await cloudSyncService.getConfig();
            setCloudSyncConfig(freshCfg);
            const cleanUrl = window.location.pathname + window.location.hash;
            window.history.replaceState({}, document.title, cleanUrl);
            showTransientSyncStatus('✅ Gerät erfolgreich gekoppelt & synchronisiert!');
            if (ok) {
              await triggerCloudSync();
            }
            return;
          }
        }

        if (cfg.enabled && cfg.autoSync) {
          await triggerCloudSync();
        }
      } catch (err: any) {
        console.warn('[Sync] Init failed:', err);
      }
    })();
  }, [showTransientSyncStatus, triggerCloudSync]);

  // Clean up pending timers on unmount
  useEffect(() => {
    return () => {
      if (syncDebounceTimer.current) {
        clearTimeout(syncDebounceTimer.current);
        syncDebounceTimer.current = null;
      }
      if (statusClearTimer.current) {
        clearTimeout(statusClearTimer.current);
        statusClearTimer.current = null;
      }
    };
  }, []);

  return {
    cloudSyncConfig,
    isSyncing,
    syncStatusMessage,
    triggerCloudSync,
    updateCloudSyncConfig,
    activateCloudSync,
    applyPairingCode,
    getPairingBundle,
    scheduleCloudSyncPush
  };
}
