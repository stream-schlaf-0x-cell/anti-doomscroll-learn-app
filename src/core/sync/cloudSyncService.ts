import QRCode from 'qrcode';
import { AtemStorage, appStorage } from '../data/storage';
import { UserProfile, FeedItem, FeedItemSchema, ReadingInteraction, ReadingInteractionSchema } from '../domain/types';
import { DEFAULT_USER_PROFILE } from '../data/fixtures';
import { userProfileRepository } from '../data/userProfileRepository';
import { defaultSpaceRepository, Subchannel } from '../spaces/spaceRepository';
import { INTERACTIONS_STORAGE_KEY, SAVED_ARTICLES_STORAGE_KEY } from '../data/libraryRepository';
import { seenImpressionsService, SeenImpressionRecord } from '../data/seenImpressionsService';
import {
  AiCredentials,
  DEFAULT_AI_CREDENTIALS,
  loadAiCredentials,
  saveAiCredentials
} from '../ai/atmenAiClient';

export type Space = Subchannel;

export const CLOUD_SYNC_CONFIG_KEY = '@atem:cloud_sync_config:v1';
export const SYNC_DEVICE_ID_KEY = '@atem:sync_device_id:v1';
export const GIST_SYNC_FILENAME = 'atmen-single-instance-sync.json';
export const DISMISSED_ITEMS_KEY = '@atem:dismissed_items:v1';

export interface CloudSyncConfig {
  enabled: boolean;
  githubToken?: string;
  gistId?: string;
  encryptionPassphrase?: string;
  lastSyncAt?: string;
  lastSyncStatus?: 'idle' | 'in_progress' | 'success' | 'error';
  lastSyncError?: string;
  autoSync: boolean;
}

export const DEFAULT_CLOUD_SYNC_CONFIG: CloudSyncConfig = {
  enabled: false,
  autoSync: true,
  lastSyncStatus: 'idle'
};

export interface AtmenSyncSnapshot {
  version: number;
  deviceId: string;
  updatedAt: string;
  aiCredentials?: {
    geminiApiKey?: string;
    openRouterApiKey?: string;
    preferredProvider?: 'gemini' | 'openrouter';
    selectedGeminiModelId?: string;
  };
  profile?: UserProfile;
  spaces?: Subchannel[];
  deletedSpaceIds?: string[];
  interactions?: Record<string, ReadingInteraction>;
  savedArticles?: FeedItem[];
  dismissedItemIds?: string[];
  seenImpressions?: Record<string, { firstSeenAt: string; lastSeenAt: string; count: number }>;
}

export interface PairingPayload {
  v: number;
  t?: string; // githubToken
  g?: string; // gistId
  s?: string; // encryptionSecret / passphrase
  gk?: string; // geminiApiKey
  ok?: string; // openRouterApiKey
  m?: string; // selectedGeminiModelId
  p?: 'gemini' | 'openrouter'; // preferredProvider
  ts: number;
}

// ---------------------------------------------------------------------------
// Cryptographic Helpers (Client-Side Encryption / Obfuscation)
// ---------------------------------------------------------------------------

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(b64, 'base64'));
  }
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function xorTransform(data: Uint8Array, key: Uint8Array): Uint8Array {
  const result = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    result[i] = data[i] ^ key[i % key.length];
  }
  return result;
}

export async function encryptSyncPayload(plaintext: string, secret: string): Promise<string> {
  if (!secret) {
    return plaintext;
  }

  const enc = new TextEncoder();
  const rawPlain = enc.encode(plaintext);

  try {
    const subtle = globalThis.crypto?.subtle;
    if (subtle && typeof subtle.digest === 'function' && typeof subtle.importKey === 'function') {
      const keyData = await subtle.digest('SHA-256', enc.encode(secret));
      const cryptoKey = await subtle.importKey('raw', keyData, { name: 'AES-GCM' }, false, ['encrypt']);
      const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
      const encrypted = await subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, rawPlain);
      const ivB64 = bytesToBase64(iv);
      const cipherB64 = bytesToBase64(new Uint8Array(encrypted));
      return `v1:aes_gcm:${ivB64}:${cipherB64}`;
    }
  } catch {
    // Non-fatal fallback to deterministic XOR
  }

  // Fallback XOR-Base64
  const keyBytes = enc.encode(secret || 'atmen-single-instance-default-key');
  const xorBytes = xorTransform(rawPlain, keyBytes);
  return `v1:xor:${bytesToBase64(xorBytes)}`;
}

export async function decryptSyncPayload(ciphertext: string, secret: string): Promise<string | null> {
  if (!ciphertext) return '';

  const trimmed = ciphertext.trim();
  // Plain JSON check
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    return trimmed;
  }

  const enc = new TextEncoder();
  const dec = new TextDecoder();

  if (trimmed.startsWith('v1:aes_gcm:')) {
    const parts = trimmed.split(':');
    if (parts.length >= 4) {
      try {
        const iv = base64ToBytes(parts[2]);
        const cipherBytes = base64ToBytes(parts[3]);
        const subtle = globalThis.crypto?.subtle;
        if (subtle && typeof subtle.digest === 'function' && typeof subtle.importKey === 'function') {
          const keyData = await subtle.digest('SHA-256', enc.encode(secret));
          const cryptoKey = await subtle.importKey('raw', keyData, { name: 'AES-GCM' }, false, ['decrypt']);
          const decrypted = await subtle.decrypt({ name: 'AES-GCM', iv: iv as any }, cryptoKey, cipherBytes as any);
          return dec.decode(decrypted);
        }
      } catch {
        return null; // Decryption failed (e.g. wrong passphrase or corrupted payload)
      }
    }
  }

  if (trimmed.startsWith('v1:xor:')) {
    try {
      const b64 = trimmed.slice('v1:xor:'.length);
      const cipherBytes = base64ToBytes(b64);
      const keyBytes = enc.encode(secret || 'atmen-single-instance-default-key');
      const plainBytes = xorTransform(cipherBytes, keyBytes);
      return dec.decode(plainBytes);
    } catch {
      return null;
    }
  }

  // Fallback if no matching prefix
  return trimmed;
}

// ---------------------------------------------------------------------------
// 1-Tap QR & Magic Sync Code Encoding / Decoding
// ---------------------------------------------------------------------------

export function encodePairingCode(payload: PairingPayload): string {
  const json = JSON.stringify(payload);
  const b64 = typeof Buffer !== 'undefined'
    ? Buffer.from(json, 'utf8').toString('base64url')
    : btoa(unescape(encodeURIComponent(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `atmen-pair-v1:${b64}`;
}

export function decodePairingCode(code: string): PairingPayload {
  if (!code || typeof code !== 'string') {
    throw new Error('Ungültiger Koppel-Code.');
  }

  let clean = code.trim();
  if (clean.startsWith('atmen-pair-v1:')) {
    clean = clean.slice('atmen-pair-v1:'.length);
  }

  // Restore base64 standard padding
  let b64 = clean.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4 !== 0) {
    b64 += '=';
  }

  let jsonStr: string;
  if (typeof Buffer !== 'undefined') {
    jsonStr = Buffer.from(b64, 'base64').toString('utf8');
  } else {
    jsonStr = decodeURIComponent(escape(atob(b64)));
  }

  const parsed = JSON.parse(jsonStr);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Koppel-Code konnte nicht geparst werden.');
  }
  return parsed as PairingPayload;
}

export function generatePairingUrl(payload: PairingPayload, customBaseUrl?: string): string {
  const code = encodePairingCode(payload);
  let base = customBaseUrl;
  if (!base && typeof window !== 'undefined' && window.location) {
    base = window.location.origin + window.location.pathname;
  }
  if (!base) {
    base = 'https://stream-schlaf-0x-cell.github.io/anti-doomscroll-learn-app/';
  }
  // Strip trailing hash/query
  base = base.split('#')[0].split('?')[0];
  return `${base}?pair=${encodeURIComponent(code)}`;
}

export async function generatePairingQrDataUrl(pairingUrl: string): Promise<string> {
  return QRCode.toDataURL(pairingUrl, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 280,
    color: {
      dark: '#000000',
      light: '#FFFFFF'
    }
  });
}

// ---------------------------------------------------------------------------
// Deterministic CRDT-Style Merge Strategy
// ---------------------------------------------------------------------------

type FeedbackMem = NonNullable<UserProfile['feedbackMemory']>;

export function mergeSyncSnapshots(
  local: AtmenSyncSnapshot,
  remote: AtmenSyncSnapshot
): AtmenSyncSnapshot {
  const localTime = new Date(local.updatedAt).getTime() || 0;
  const remoteTime = new Date(remote.updatedAt).getTime() || 0;
  const isRemoteNewer = remoteTime >= localTime;
  const latestTimestamp = new Date(Math.max(localTime, remoteTime, Date.now())).toISOString();

  // 1. AI Credentials: latest timestamp wins, non-empty always preserved over empty
  const localCreds = local.aiCredentials;
  const remoteCreds = remote.aiCredentials;
  let mergedAiCredentials: AtmenSyncSnapshot['aiCredentials'] = undefined;

  if (localCreds || remoteCreds) {
    const pickKey = (localVal?: string, remoteVal?: string): string | undefined => {
      if (localVal && !remoteVal) return localVal;
      if (!localVal && remoteVal) return remoteVal;
      if (localVal && remoteVal) return isRemoteNewer ? remoteVal : localVal;
      return undefined;
    };

    mergedAiCredentials = {
      geminiApiKey: pickKey(localCreds?.geminiApiKey, remoteCreds?.geminiApiKey),
      openRouterApiKey: pickKey(localCreds?.openRouterApiKey, remoteCreds?.openRouterApiKey),
      preferredProvider: isRemoteNewer
        ? (remoteCreds?.preferredProvider || localCreds?.preferredProvider)
        : (localCreds?.preferredProvider || remoteCreds?.preferredProvider),
      selectedGeminiModelId: isRemoteNewer
        ? (remoteCreds?.selectedGeminiModelId || localCreds?.selectedGeminiModelId)
        : (localCreds?.selectedGeminiModelId || remoteCreds?.selectedGeminiModelId)
    };
  }

  // 2. Profile: latest timestamp wins, always isOnboarded: true, feedback memory merged
  const baseProfile = (isRemoteNewer && remote.profile)
    ? remote.profile
    : (local.profile || remote.profile || DEFAULT_USER_PROFILE);

  const localFeedback = (local.profile?.feedbackMemory || {}) as Partial<FeedbackMem>;
  const remoteFeedback = (remote.profile?.feedbackMemory || {}) as Partial<FeedbackMem>;

  const mergeCountMap = (m1?: Record<string, number>, m2?: Record<string, number>): Record<string, number> => {
    const res: Record<string, number> = { ...(m1 || {}) };
    for (const [k, v] of Object.entries(m2 || {})) {
      res[k] = Math.max(res[k] || 0, v);
    }
    return res;
  };

  const mergedFeedbackMemory: FeedbackMem = {
    boostedTopics: mergeCountMap(localFeedback.boostedTopics, remoteFeedback.boostedTopics),
    penalizedTopics: mergeCountMap(localFeedback.penalizedTopics, remoteFeedback.penalizedTopics),
    boostedAuthors: mergeCountMap(localFeedback.boostedAuthors, remoteFeedback.boostedAuthors),
    penalizedAuthors: mergeCountMap(localFeedback.penalizedAuthors, remoteFeedback.penalizedAuthors),
    boostedKeywords: mergeCountMap(localFeedback.boostedKeywords, remoteFeedback.boostedKeywords),
    penalizedKeywords: mergeCountMap(localFeedback.penalizedKeywords, remoteFeedback.penalizedKeywords),
    boostedDomains: mergeCountMap(localFeedback.boostedDomains, remoteFeedback.boostedDomains),
    penalizedDomains: mergeCountMap(localFeedback.penalizedDomains, remoteFeedback.penalizedDomains),
    boostedSpaces: mergeCountMap(localFeedback.boostedSpaces, remoteFeedback.boostedSpaces),
    penalizedSpaces: mergeCountMap(localFeedback.penalizedSpaces, remoteFeedback.penalizedSpaces)
  };

  const mergedProfile: UserProfile = {
    ...baseProfile,
    isOnboarded: true,
    feedbackMemory: mergedFeedbackMemory
  };

  // 3. Spaces (Subchannels): Union by id / handle, respecting deletedSpaceIds tombstones
  const deletedSet = new Set<string>([
    ...(local.deletedSpaceIds || []),
    ...(remote.deletedSpaceIds || [])
  ]);

  const spacesMap = new Map<string, Subchannel>();
  for (const s of local.spaces || []) {
    if (!deletedSet.has(s.id) && !deletedSet.has(s.handle)) {
      spacesMap.set(s.id, s);
    }
  }

  for (const s of remote.spaces || []) {
    if (deletedSet.has(s.id) || deletedSet.has(s.handle)) {
      continue;
    }
    const existing = spacesMap.get(s.id);
    if (!existing) {
      spacesMap.set(s.id, s);
    } else if (isRemoteNewer) {
      spacesMap.set(s.id, s);
    }
  }

  const mergedSpaces = Array.from(spacesMap.values());

  // 4. Interactions & Bookmarks: Per articleId by latest update, union userNotes
  const interactionsMap: Record<string, ReadingInteraction> = {};
  const allInteractionKeys = new Set<string>([
    ...Object.keys(local.interactions || {}),
    ...Object.keys(remote.interactions || {})
  ]);

  for (const id of allInteractionKeys) {
    const li = local.interactions?.[id];
    const ri = remote.interactions?.[id];

    if (li && !ri) {
      interactionsMap[id] = li;
    } else if (!li && ri) {
      interactionsMap[id] = ri;
    } else if (li && ri) {
      // Notes union
      const notesMap = new Map<string, any>();
      for (const n of li.userNotes || []) notesMap.set(n.id, n);
      for (const n of ri.userNotes || []) notesMap.set(n.id, n);

      interactionsMap[id] = {
        itemId: id,
        saved: Boolean(li.saved || ri.saved),
        savedAt: (li.savedAt && ri.savedAt)
          ? (li.savedAt > ri.savedAt ? li.savedAt : ri.savedAt)
          : (li.savedAt || ri.savedAt),
        progressPercent: Math.max(li.progressPercent || 0, ri.progressPercent || 0),
        furthestPositionPercent: Math.max(li.furthestPositionPercent || 0, ri.furthestPositionPercent || 0),
        completedAt: li.completedAt || ri.completedAt,
        feedback: isRemoteNewer ? (ri.feedback || li.feedback) : (li.feedback || ri.feedback),
        timeWorthFeedback: isRemoteNewer ? (ri.timeWorthFeedback || li.timeWorthFeedback) : (li.timeWorthFeedback || ri.timeWorthFeedback),
        userNotes: Array.from(notesMap.values()),
        voteScore: isRemoteNewer ? (ri.voteScore ?? li.voteScore ?? 0) : (li.voteScore ?? ri.voteScore ?? 0)
      };
    }
  }

  // Saved Articles (Bibliothek): Union by id
  const savedArticlesMap = new Map<string, FeedItem>();
  for (const a of local.savedArticles || []) savedArticlesMap.set(a.id, a);
  for (const a of remote.savedArticles || []) {
    if (!savedArticlesMap.has(a.id) || isRemoteNewer) {
      savedArticlesMap.set(a.id, a);
    }
  }
  const mergedSavedArticles = Array.from(savedArticlesMap.values());

  // Dismissed items union
  const mergedDismissedItemIds = Array.from(new Set([
    ...(local.dismissedItemIds || []),
    ...(remote.dismissedItemIds || [])
  ]));

  // 5. Seen Impressions: Union by itemId, keeping highest count, earliest firstSeenAt, latest lastSeenAt
  const impressionsMap: Record<string, { firstSeenAt: string; lastSeenAt: string; count: number }> = {};
  const allImpressionKeys = new Set<string>([
    ...Object.keys(local.seenImpressions || {}),
    ...Object.keys(remote.seenImpressions || {})
  ]);

  for (const id of allImpressionKeys) {
    const lImp = local.seenImpressions?.[id];
    const rImp = remote.seenImpressions?.[id];

    if (lImp && !rImp) {
      impressionsMap[id] = lImp;
    } else if (!lImp && rImp) {
      impressionsMap[id] = rImp;
    } else if (lImp && rImp) {
      impressionsMap[id] = {
        firstSeenAt: lImp.firstSeenAt < rImp.firstSeenAt ? lImp.firstSeenAt : rImp.firstSeenAt,
        lastSeenAt: lImp.lastSeenAt > rImp.lastSeenAt ? lImp.lastSeenAt : rImp.lastSeenAt,
        count: Math.max(lImp.count, rImp.count)
      };
    }
  }

  // Limit seen impressions to top 500 newest
  const sortedImpressionEntries = Object.entries(impressionsMap)
    .sort((a, b) => new Date(b[1].lastSeenAt).getTime() - new Date(a[1].lastSeenAt).getTime())
    .slice(0, 500);
  const cappedImpressions = Object.fromEntries(sortedImpressionEntries);

  return {
    version: 1,
    deviceId: isRemoteNewer ? remote.deviceId : local.deviceId,
    updatedAt: latestTimestamp,
    aiCredentials: mergedAiCredentials,
    profile: mergedProfile,
    spaces: mergedSpaces,
    deletedSpaceIds: Array.from(deletedSet),
    interactions: interactionsMap,
    savedArticles: mergedSavedArticles,
    dismissedItemIds: mergedDismissedItemIds,
    seenImpressions: cappedImpressions
  };
}

// ---------------------------------------------------------------------------
// GitHub Gist Transport
// ---------------------------------------------------------------------------

export async function findOrCreateSyncGist(
  token: string,
  initialEncryptedContent?: string
): Promise<{ gistId: string; isNew: boolean }> {
  const cleanToken = token.trim();
  const headers = {
    Authorization: `Bearer ${cleanToken}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'Atmen-Single-Instance-Sync'
  };

  // 1. Search existing gists
  const listResp = await fetch('https://api.github.com/gists?per_page=100', {
    method: 'GET',
    headers
  });

  if (!listResp.ok) {
    const errText = await listResp.text().catch(() => '');
    throw new Error(`GitHub Gist-Abruf fehlgeschlagen (${listResp.status}): ${errText || listResp.statusText}`);
  }

  const gists = (await listResp.json()) as any[];
  if (Array.isArray(gists)) {
    const existing = gists.find(g => g.files && g.files[GIST_SYNC_FILENAME]);
    if (existing && existing.id) {
      return { gistId: existing.id, isNew: false };
    }
  }

  // 2. Create new secret Gist
  const createResp = await fetch('https://api.github.com/gists', {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      description: 'ATMEN Single-Instance Live Sync Vault',
      public: false,
      files: {
        [GIST_SYNC_FILENAME]: {
          content: initialEncryptedContent || '{"version":1,"initialized":true}'
        }
      }
    })
  });

  if (!createResp.ok) {
    const errText = await createResp.text().catch(() => '');
    throw new Error(`Erstellung des Secret-Gists fehlgeschlagen (${createResp.status}): ${errText || createResp.statusText}`);
  }

  const created = (await createResp.json()) as any;
  if (!created || !created.id) {
    throw new Error('Gist-ID konnte nicht aus der GitHub-Antwort gelesen werden.');
  }

  return { gistId: created.id, isNew: true };
}

export async function pullSnapshotFromGist(
  token: string,
  gistId: string,
  secret: string
): Promise<AtmenSyncSnapshot | null> {
  const headers = {
    Authorization: `Bearer ${token.trim()}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'Atmen-Single-Instance-Sync'
  };

  const resp = await fetch(`https://api.github.com/gists/${gistId.trim()}`, {
    method: 'GET',
    headers
  });

  if (!resp.ok) {
    if (resp.status === 404) return null;
    const errText = await resp.text().catch(() => '');
    throw new Error(`Gist-Abruf fehlgeschlagen (${resp.status}): ${errText || resp.statusText}`);
  }

  const gist = (await resp.json()) as any;
  const file = gist.files?.[GIST_SYNC_FILENAME];
  if (!file || typeof file.content !== 'string') {
    return null;
  }

  const rawContent = file.content;
  const decrypted = await decryptSyncPayload(rawContent, secret);
  if (!decrypted) return null;

  try {
    const parsed = JSON.parse(decrypted);
    if (parsed && typeof parsed === 'object') {
      return parsed as AtmenSyncSnapshot;
    }
  } catch {
    return null;
  }
  return null;
}

export async function pushSnapshotToGist(
  token: string,
  gistId: string,
  secret: string,
  snapshot: AtmenSyncSnapshot
): Promise<void> {
  const headers = {
    Authorization: `Bearer ${token.trim()}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
    'User-Agent': 'Atmen-Single-Instance-Sync'
  };

  const plainJson = JSON.stringify(snapshot, null, 2);
  const encrypted = await encryptSyncPayload(plainJson, secret);

  const resp = await fetch(`https://api.github.com/gists/${gistId.trim()}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      description: 'ATMEN Single-Instance Live Sync Vault',
      files: {
        [GIST_SYNC_FILENAME]: {
          content: encrypted
        }
      }
    })
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new Error(`Gist-Aktualisierung fehlgeschlagen (${resp.status}): ${errText || resp.statusText}`);
  }
}

// ---------------------------------------------------------------------------
// CloudSyncService
// ---------------------------------------------------------------------------

export class CloudSyncService {
  private configCache: CloudSyncConfig | null = null;
  private deviceIdCache: string | null = null;
  private syncInProgress = false;

  constructor(private storage: AtemStorage = appStorage) {}

  public async getConfig(): Promise<CloudSyncConfig> {
    if (this.configCache) {
      return this.configCache;
    }
    const raw = await this.storage.getItem(CLOUD_SYNC_CONFIG_KEY);
    if (!raw) {
      this.configCache = { ...DEFAULT_CLOUD_SYNC_CONFIG };
      return this.configCache;
    }
    try {
      const parsed = JSON.parse(raw);
      this.configCache = {
        ...DEFAULT_CLOUD_SYNC_CONFIG,
        ...parsed
      };
      return this.configCache!;
    } catch {
      this.configCache = { ...DEFAULT_CLOUD_SYNC_CONFIG };
      return this.configCache;
    }
  }

  public async saveConfig(patch: Partial<CloudSyncConfig>): Promise<CloudSyncConfig> {
    const current = await this.getConfig();
    const updated: CloudSyncConfig = {
      ...current,
      ...patch
    };
    await this.storage.setItem(CLOUD_SYNC_CONFIG_KEY, JSON.stringify(updated));
    this.configCache = updated;
    return updated;
  }

  public async getDeviceId(): Promise<string> {
    if (this.deviceIdCache) return this.deviceIdCache;
    let id = await this.storage.getItem(SYNC_DEVICE_ID_KEY);
    if (!id) {
      id = `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      await this.storage.setItem(SYNC_DEVICE_ID_KEY, id);
    }
    this.deviceIdCache = id;
    return id;
  }

  /**
   * Builds full sync snapshot from current local state.
   */
  public async buildLocalSnapshot(): Promise<AtmenSyncSnapshot> {
    const deviceId = await this.getDeviceId();
    const nowIso = new Date().toISOString();

    const [
      profile,
      spaces,
      rawInteractions,
      rawSavedArticles,
      seenRecordsMap,
      aiCreds,
      rawDismissed
    ] = await Promise.all([
      userProfileRepository.getProfile().catch(() => DEFAULT_USER_PROFILE),
      defaultSpaceRepository.getAllSpaces().catch(() => []),
      this.storage.getItem(INTERACTIONS_STORAGE_KEY).catch(() => null),
      this.storage.getItem(SAVED_ARTICLES_STORAGE_KEY).catch(() => null),
      seenImpressionsService.getSeenRecordMap().catch(() => new Map<string, SeenImpressionRecord>()),
      loadAiCredentials().catch(() => DEFAULT_AI_CREDENTIALS),
      this.storage.getItem(DISMISSED_ITEMS_KEY).catch(() => null)
    ]);

    const interactions: Record<string, ReadingInteraction> = {};
    if (rawInteractions) {
      try {
        const parsed = JSON.parse(rawInteractions);
        if (parsed && typeof parsed === 'object') {
          for (const [k, v] of Object.entries(parsed)) {
            const safe = ReadingInteractionSchema.safeParse(v);
            if (safe.success) interactions[k] = safe.data;
          }
        }
      } catch {
        // Non-fatal
      }
    }

    const savedArticles: FeedItem[] = [];
    if (rawSavedArticles) {
      try {
        const parsed = JSON.parse(rawSavedArticles);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            const safe = FeedItemSchema.safeParse(item);
            if (safe.success) savedArticles.push(safe.data);
          }
        }
      } catch {
        // Non-fatal
      }
    }

    const seenImpressions: Record<string, { firstSeenAt: string; lastSeenAt: string; count: number }> = {};
    for (const [k, v] of seenRecordsMap.entries()) {
      seenImpressions[k] = {
        firstSeenAt: v.firstSeenAt,
        lastSeenAt: v.lastSeenAt,
        count: v.count
      };
    }

    let dismissedItemIds: string[] = [];
    if (rawDismissed) {
      try {
        const parsed = JSON.parse(rawDismissed);
        if (Array.isArray(parsed)) dismissedItemIds = parsed.map(String);
      } catch {
        // Non-fatal
      }
    }

    return {
      version: 1,
      deviceId,
      updatedAt: nowIso,
      aiCredentials: {
        geminiApiKey: aiCreds?.provider === 'gemini' ? aiCreds.apiKey : undefined,
        openRouterApiKey: aiCreds?.provider === 'openrouter' ? aiCreds.apiKey : undefined,
        preferredProvider: aiCreds?.provider,
        selectedGeminiModelId: aiCreds?.model
      },
      profile,
      spaces,
      deletedSpaceIds: [],
      interactions,
      savedArticles,
      dismissedItemIds,
      seenImpressions
    };
  }

  /**
   * Applies a merged snapshot into local storage atomically.
   */
  public async applySnapshot(snapshot: AtmenSyncSnapshot): Promise<void> {
    const writes: Promise<any>[] = [];

    // 1. Profile
    if (snapshot.profile) {
      writes.push(userProfileRepository.saveProfile({
        ...snapshot.profile,
        isOnboarded: true
      }));
    }

    // 2. AI Credentials
    if (snapshot.aiCredentials) {
      const current = await loadAiCredentials().catch(() => DEFAULT_AI_CREDENTIALS);
      const preferred = snapshot.aiCredentials.preferredProvider || current.provider || 'gemini';
      const effectiveKey = preferred === 'openrouter'
        ? (snapshot.aiCredentials.openRouterApiKey || current.apiKey)
        : (snapshot.aiCredentials.geminiApiKey || current.apiKey);

      const updatedCreds: AiCredentials = {
        ...current,
        provider: preferred,
        apiKey: effectiveKey || '',
        model: snapshot.aiCredentials.selectedGeminiModelId || current.model
      };
      writes.push(saveAiCredentials(updatedCreds));
    }

    // 3. Interactions
    if (snapshot.interactions) {
      writes.push(this.storage.setItem(INTERACTIONS_STORAGE_KEY, JSON.stringify(snapshot.interactions)));
    }

    // 4. Saved Articles
    if (snapshot.savedArticles) {
      writes.push(this.storage.setItem(SAVED_ARTICLES_STORAGE_KEY, JSON.stringify(snapshot.savedArticles)));
    }

    // 5. Dismissed Items
    if (snapshot.dismissedItemIds) {
      writes.push(this.storage.setItem(DISMISSED_ITEMS_KEY, JSON.stringify(snapshot.dismissedItemIds)));
    }

    // 6. Seen Impressions
    if (snapshot.seenImpressions) {
      const idsToRecord = Object.keys(snapshot.seenImpressions);
      if (idsToRecord.length > 0) {
        writes.push(seenImpressionsService.recordSeen(idsToRecord));
      }
    }

    // 7. Custom Subchannels
    if (snapshot.spaces) {
      const customSpaces = snapshot.spaces.filter(s => s.isCustom);
      const pinnedIds = snapshot.spaces.filter(s => Boolean(s.pinned)).map(s => s.id);
      const priorities: Record<string, string> = {};
      for (const s of snapshot.spaces) {
        if (s.feedPriority) priorities[s.id] = s.feedPriority;
      }

      writes.push(this.storage.setItem('@atem:custom_subchannels', JSON.stringify(customSpaces)));
      writes.push(this.storage.setItem('@atem:pinned_space_ids', JSON.stringify(pinnedIds)));
      writes.push(this.storage.setItem('@atem:subchannel_priorities', JSON.stringify(priorities)));
    }

    await Promise.all(writes);

    // Notify space listeners so UI updates instantly
    try {
      await defaultSpaceRepository.notify();
    } catch {
      // Non-fatal
    }
  }

  /**
   * Main sync workflow: pulls remote, merges with local, pushes merged snapshot, saves telemetry.
   */
  public async sync(options?: { forcePush?: boolean }): Promise<{
    success: boolean;
    error?: string;
    mergedSnapshot?: AtmenSyncSnapshot;
  }> {
    if (this.syncInProgress) {
      return { success: false, error: 'Sync bereits im Gange.' };
    }

    const config = await this.getConfig();
    if (!config.enabled || !config.githubToken || !config.gistId) {
      return { success: false, error: 'Live-Sync ist noch nicht vollständig eingerichtet.' };
    }

    this.syncInProgress = true;
    await this.saveConfig({ lastSyncStatus: 'in_progress', lastSyncError: undefined });

    try {
      const secret = config.encryptionPassphrase || 'atmen-single-instance-default-key';
      const localSnap = await this.buildLocalSnapshot();

      // Pull remote
      const remoteSnap = await pullSnapshotFromGist(config.githubToken, config.gistId, secret);

      let finalSnap: AtmenSyncSnapshot;
      if (!remoteSnap) {
        // First push
        finalSnap = localSnap;
      } else {
        // CRDT merge
        finalSnap = mergeSyncSnapshots(localSnap, remoteSnap);
      }

      // Apply locally if remote provided updates
      if (remoteSnap) {
        await this.applySnapshot(finalSnap);
      }

      // Push merged back to Gist
      await pushSnapshotToGist(config.githubToken, config.gistId, secret, finalSnap);

      const nowIso = new Date().toISOString();
      await this.saveConfig({
        lastSyncAt: nowIso,
        lastSyncStatus: 'success',
        lastSyncError: undefined
      });

      this.syncInProgress = false;
      return { success: true, mergedSnapshot: finalSnap };
    } catch (err: any) {
      const msg = err?.message || String(err);
      await this.saveConfig({
        lastSyncStatus: 'error',
        lastSyncError: msg
      });
      this.syncInProgress = false;
      return { success: false, error: msg };
    }
  }

  /**
   * Generates pairing bundle (token code, pairing url, qr data url) for this device.
   */
  public async getPairingBundle(): Promise<{
    pairingCode: string;
    pairingUrl: string;
    qrDataUrl: string;
  }> {
    const config = await this.getConfig();
    const aiCreds = await loadAiCredentials().catch(() => DEFAULT_AI_CREDENTIALS);

    const payload: PairingPayload = {
      v: 1,
      t: config.githubToken,
      g: config.gistId,
      s: config.encryptionPassphrase,
      gk: aiCreds?.provider === 'gemini' ? aiCreds.apiKey : undefined,
      ok: aiCreds?.provider === 'openrouter' ? aiCreds.apiKey : undefined,
      m: aiCreds?.model,
      p: aiCreds?.provider,
      ts: Date.now()
    };

    const pairingCode = encodePairingCode(payload);
    const pairingUrl = generatePairingUrl(payload);
    const qrDataUrl = await generatePairingQrDataUrl(pairingUrl);

    return { pairingCode, pairingUrl, qrDataUrl };
  }

  /**
   * Imports pairing payload from a scanned QR or pasted code and connects instantly.
   */
  public async applyPairingCode(code: string): Promise<boolean> {
    const payload = decodePairingCode(code);

    const configPatch: Partial<CloudSyncConfig> = {
      enabled: Boolean(payload.t && payload.g),
      githubToken: payload.t,
      gistId: payload.g,
      encryptionPassphrase: payload.s,
      autoSync: true
    };
    await this.saveConfig(configPatch);

    // Also import API keys if present
    if (payload.gk || payload.ok || payload.m || payload.p) {
      const current = await loadAiCredentials().catch(() => DEFAULT_AI_CREDENTIALS);
      const preferred = payload.p || (payload.ok && !payload.gk ? 'openrouter' : 'gemini');
      const effectiveKey = preferred === 'openrouter'
        ? (payload.ok || payload.gk || '')
        : (payload.gk || payload.ok || '');

      await saveAiCredentials({
        ...current,
        provider: preferred,
        apiKey: effectiveKey,
        model: payload.m || current.model
      });
    }

    // If Gist is configured, trigger initial sync pull immediately
    if (configPatch.enabled) {
      void this.sync();
    }

    return true;
  }
}

export const cloudSyncService = new CloudSyncService();
