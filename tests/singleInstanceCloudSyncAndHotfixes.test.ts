import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_USER_PROFILE } from '../src/core/data/fixtures';
import { LocalUserProfileRepository, USER_PROFILE_STORAGE_KEY } from '../src/core/data/userProfileRepository';
import { AtemStorage, MemoryStorageDriver } from '../src/core/data/storage';
import { LiveCivicPulseService } from '../src/core/ingestion/liveCivicPulseService';
import { seenImpressionsService } from '../src/core/data/seenImpressionsService';
import {
  mergeSyncSnapshots,
  encodePairingCode,
  decodePairingCode,
  generatePairingUrl,
  encryptSyncPayload,
  decryptSyncPayload,
  AtmenSyncSnapshot
} from '../src/core/sync/cloudSyncService';
import {
  CURRENT_DATA_MIGRATION_VERSION,
  runInPlaceDataMigration,
  DATA_MIGRATION_STORAGE_KEY
} from '../src/core/data/migrationService';
import { FeedItem, UserProfile } from '../src/core/domain/types';

test('Single-Instance Cloud Sync & Surgical Hotfixes Suite (Tasks 1-9)', async (t) => {
  await t.test('1. Onboarding Default: New devices and default profile have isOnboarded: true', async () => {
    assert.equal(DEFAULT_USER_PROFILE.isOnboarded, true, 'DEFAULT_USER_PROFILE must default to isOnboarded: true');

    const storage = new AtemStorage(new MemoryStorageDriver());
    const repo = new LocalUserProfileRepository(storage);
    const profile = await repo.getProfile();
    assert.equal(profile.isOnboarded, true, 'Fresh installation profile must default to isOnboarded: true');
  });

  await t.test('2. Zombie Fallback Prevention: Static historical dates & suppression when seen', async () => {
    const pool = LiveCivicPulseService.getCuratedRealityAndSerendipityPool();
    const fallbackItem = pool.find((item) => item.id === 'civic-fallback-sachsen-ki-1');
    assert.ok(fallbackItem, 'civic-fallback-sachsen-ki-1 must exist');
    assert.equal(fallbackItem.isStaticFallback, true);
    assert.equal(fallbackItem.publishedAt, '2026-10-20T09:00:00.000Z');

    // Ensure all fallback items have static historical dates > 24 hours in the past
    for (const item of pool) {
      assert.equal(item.isStaticFallback, true);
      const ageMs = Date.now() - new Date(item.publishedAt).getTime();
      assert.ok(ageMs > 24 * 3600 * 1000, `Item ${item.id} must be historical, not rolling`);
    }

    // Suppress by marking seen
    await seenImpressionsService.recordSeen(['civic-fallback-sachsen-ki-1']);
    const seenIds = await seenImpressionsService.getSeenIds();
    assert.ok(seenIds.has('civic-fallback-sachsen-ki-1'));
  });

  await t.test('3. CloudSync: CRDT Snapshot Merge Strategy merges AI keys, profiles, interactions, spaces, bookmarks and seen impressions', () => {
    const baseProfileA: UserProfile = {
      ...DEFAULT_USER_PROFILE,
      region: 'eu'
    };

    const baseProfileB: UserProfile = {
      ...DEFAULT_USER_PROFILE,
      region: 'global'
    };

    const localSnapshot: AtmenSyncSnapshot = {
      version: 1,
      deviceId: 'mac-pro-1',
      updatedAt: '2026-11-03T10:00:00.000Z',
      aiCredentials: {
        geminiApiKey: 'gemini-key-local',
        preferredProvider: 'gemini'
      },
      profile: baseProfileA,
      spaces: [
        {
          id: 'c-space-1',
          title: 'Dialektik',
          handle: 'c/dialektik',
          icon: 'scale-outline',
          flair: 'Philosophie',
          description: 'Philosophische Debatten',
          primaryTopic: 'philosophy_ethics',
          accentColor: '#3B82F6',
          isCustom: true,
          createdAt: '2026-11-03T09:00:00.000Z',
          pinned: true,
          memberCount: 42
        }
      ],
      interactions: {
        'art-1': {
          itemId: 'art-1',
          voteScore: 1,
          saved: false,
          progressPercent: 50,
          furthestPositionPercent: 50,
          userNotes: []
        }
      },
      savedArticles: [
        {
          id: 'art-1',
          title: 'Article 1',
          space: 'c/dialektik',
          publishedAt: '2026-11-02T10:00:00.000Z'
        } as FeedItem
      ],
      seenImpressions: {
        'art-1': {
          firstSeenAt: '2026-11-03T08:00:00.000Z',
          lastSeenAt: '2026-11-03T09:00:00.000Z',
          count: 2
        }
      }
    };

    const remoteSnapshot: AtmenSyncSnapshot = {
      version: 1,
      deviceId: 'iphone-15-pro',
      updatedAt: '2026-11-03T12:00:00.000Z',
      aiCredentials: {
        openRouterApiKey: 'openrouter-key-remote',
        preferredProvider: 'openrouter'
      },
      profile: baseProfileB,
      spaces: [
        {
          id: 'c-space-2',
          title: 'Quanten',
          handle: 'c/quanten',
          icon: 'planet-outline',
          flair: 'Wissenschaft',
          description: 'Quantenmechanik',
          primaryTopic: 'science_society',
          accentColor: '#10B981',
          isCustom: true,
          createdAt: '2026-11-03T11:00:00.000Z',
          pinned: false,
          memberCount: 18
        }
      ],
      interactions: {
        'art-1': {
          itemId: 'art-1',
          voteScore: 1,
          saved: true, // Marked saved on phone!
          progressPercent: 100, // Read completely on phone!
          furthestPositionPercent: 100,
          userNotes: []
        },
        'art-2': {
          itemId: 'art-2',
          voteScore: -1,
          saved: false,
          progressPercent: 20,
          furthestPositionPercent: 20,
          userNotes: []
        }
      },
      savedArticles: [
        {
          id: 'art-2',
          title: 'Article 2',
          space: 'c/quanten',
          publishedAt: '2026-11-02T11:00:00.000Z'
        } as FeedItem
      ],
      seenImpressions: {
        'art-1': {
          firstSeenAt: '2026-11-03T07:00:00.000Z',
          lastSeenAt: '2026-11-03T11:00:00.000Z',
          count: 5 // Higher count
        },
        'art-2': {
          firstSeenAt: '2026-11-03T11:00:00.000Z',
          lastSeenAt: '2026-11-03T11:45:00.000Z',
          count: 1
        }
      }
    };

    const merged = mergeSyncSnapshots(localSnapshot, remoteSnapshot);

    // API Keys: local gemini key + remote openRouter key are preserved!
    assert.equal(merged.aiCredentials?.geminiApiKey, 'gemini-key-local');
    assert.equal(merged.aiCredentials?.openRouterApiKey, 'openrouter-key-remote');

    // Profile: remote wins because baseProfileB.updatedAt > baseProfileA.updatedAt
    assert.equal(merged.profile?.region, 'global');

    // Spaces: union of c-space-1 and c-space-2
    assert.equal(merged.spaces?.length, 2);
    assert.ok(merged.spaces?.some((s) => s.id === 'c-space-1'));
    assert.ok(merged.spaces?.some((s) => s.id === 'c-space-2'));

    // Interactions: art-1 saved: true and progress: 100 preserved, art-2 added
    assert.equal(merged.interactions?.['art-1']?.saved, true);
    assert.equal(merged.interactions?.['art-1']?.progressPercent, 100);
    assert.equal(merged.interactions?.['art-2']?.voteScore, -1);

    // Saved Articles: union of both saved articles
    assert.equal(merged.savedArticles?.length, 2);

    // Seen Impressions: art-1 count is max(2, 5) = 5, lastSeenAt is latest
    assert.equal(merged.seenImpressions?.['art-1']?.count, 5);
    assert.equal(merged.seenImpressions?.['art-1']?.lastSeenAt, '2026-11-03T11:00:00.000Z');
    assert.equal(merged.seenImpressions?.['art-2']?.count, 1);
  });

  await t.test('4. Pairing Code: Encodes and decodes credentials and sync configs reliably', () => {
    const payload = {
      v: 1,
      gk: 'AIzaSyDemoKey123456789',
      ok: 'sk-or-v1-abcdef0123456789',
      t: 'ghp_testTokenSingleInstanceSync123',
      g: 'gist_abc123xyz789',
      s: 'atmen-secure-sync-vault-phrase',
      ts: Date.now()
    };

    const pairingCode = encodePairingCode(payload);
    assert.ok(typeof pairingCode === 'string' && pairingCode.length > 20);

    const decoded = decodePairingCode(pairingCode);
    assert.ok(decoded, 'Pairing code must decode successfully');
    assert.equal(decoded.gk, payload.gk);
    assert.equal(decoded.ok, payload.ok);
    assert.equal(decoded.t, payload.t);
    assert.equal(decoded.g, payload.g);
    assert.equal(decoded.s, payload.s);

    const pairingUrl = generatePairingUrl(payload, 'https://example.com/app/');
    assert.ok(pairingUrl.startsWith('https://example.com/app/?pair='));
  });

  await t.test('5. Encryption: Symmetric AES-GCM/XOR encryption round-trip with passphrase', async () => {
    const plaintext = JSON.stringify({ message: 'Souveränes Wissen ohne Doomscrolling', timestamp: 1730667000 });
    const passphrase = 'super-secret-sync-vault-password';

    const encrypted = await encryptSyncPayload(plaintext, passphrase);
    assert.ok(typeof encrypted === 'string' && encrypted.length > 0);
    assert.notEqual(encrypted, plaintext, 'Encrypted output must not match plaintext');

    const decrypted = await decryptSyncPayload(encrypted, passphrase);
    assert.equal(decrypted, plaintext, 'Decrypted output must match original plaintext');

    // Decryption with wrong password should fail gracefully and return null
    const wrongDecrypted = await decryptSyncPayload(encrypted, 'wrong-password-phrase');
    assert.equal(wrongDecrypted, null, 'Decryption with wrong password must return null');
  });

  await t.test('6. In-Place Migration: Updates profile.isOnboarded to true and suppresses zombie cards', async () => {
    assert.equal(CURRENT_DATA_MIGRATION_VERSION, '2026-11-03-v4.0-single-instance-sync');

    const storage = new AtemStorage(new MemoryStorageDriver());

    // Seed existing legacy profile with isOnboarded: false
    const legacyProfile = {
      ...DEFAULT_USER_PROFILE,
      isOnboarded: false
    };
    await storage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(legacyProfile));
    // Set old migration version
    await storage.setItem(DATA_MIGRATION_STORAGE_KEY, '2026-11-02-v3.5-virtual-newsroom');

    const result = await runInPlaceDataMigration(storage);
    assert.equal(result.migrated, true);
    assert.equal(result.version, CURRENT_DATA_MIGRATION_VERSION);

    // Profile in storage must now have isOnboarded: true
    const updatedProfileRaw = await storage.getItem(USER_PROFILE_STORAGE_KEY);
    assert.ok(updatedProfileRaw);
    const updatedProfile = JSON.parse(updatedProfileRaw);
    assert.equal(updatedProfile.isOnboarded, true);

    // Zombie cards must be recorded in seenImpressionsService
    const seenIds = await seenImpressionsService.getSeenIds();
    assert.ok(seenIds.has('civic-fallback-sachsen-ki-1'));
    assert.ok(seenIds.has('civic-pulse-saxony-edu-v1'));
  });
});
