import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  AtemStorage,
  MemoryStorageDriver,
  CorruptedDataError,
  StorageWriteError
} from '../src/core/data/storage';
import {
  LocalUserProfileRepository,
  USER_PROFILE_STORAGE_KEY
} from '../src/core/data/userProfileRepository';
import {
  LocalLibraryRepository,
  INTERACTIONS_STORAGE_KEY
} from '../src/core/data/libraryRepository';
import { DEFAULT_USER_PROFILE } from '../src/core/data/fixtures';
import { UserProfile } from '../src/core/domain/types';

// Helper to assert an async task completes within maxMs (deadlock detector)
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number = 2000, label: string = 'Operation'): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`DEADLOCK_DETECTED: ${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timer!);
  }
}

describe('Storage Mutex & Persistence Architecture', () => {
  it('1. Profile save settles and invokes the persistent driver', async () => {
    const driver = new MemoryStorageDriver();
    const storage = new AtemStorage(driver);
    const repo = new LocalUserProfileRepository(storage);

    const testProfile: UserProfile = {
      ...DEFAULT_USER_PROFILE,
      explicitInterests: {
        ...DEFAULT_USER_PROFILE.explicitInterests,
        philosophy_ethics: 0.99
      },
      isOnboarded: true
    };

    const saved = await withTimeout(repo.saveProfile(testProfile), 1000, 'saveProfile');
    assert.strictEqual(saved.explicitInterests.philosophy_ethics, 0.99);

    const rawInDriver = await driver.getItem(USER_PROFILE_STORAGE_KEY);
    assert.ok(rawInDriver !== null, 'Raw data must be present in storage driver');
    const parsed = JSON.parse(rawInDriver!);
    assert.strictEqual(parsed.explicitInterests.philosophy_ethics, 0.99);
    assert.strictEqual(parsed.isOnboarded, true);
  });

  it('2. Save, unsave, progress, feedback, and reset settle without deadlocking', async () => {
    const driver = new MemoryStorageDriver();
    const storage = new AtemStorage(driver);
    const repo = new LocalLibraryRepository(storage);

    const artId = 'art-test-01';

    // Save
    const saved = await withTimeout(repo.saveItem(artId), 1000, 'saveItem');
    assert.strictEqual(saved.saved, true);

    // Update progress
    const progressed = await withTimeout(repo.updateProgress(artId, 45), 1000, 'updateProgress');
    assert.strictEqual(progressed.progressPercent, 45);
    assert.strictEqual(progressed.saved, true, 'Saved state must remain true');

    // Feedback
    const feedbacked = await withTimeout(repo.setFeedback(artId, 'more_like_this'), 1000, 'setFeedback');
    assert.strictEqual(feedbacked.feedback, 'more_like_this');

    // Unsave
    const unsaved = await withTimeout(repo.unsaveItem(artId), 1000, 'unsaveItem');
    assert.strictEqual(unsaved.saved, false);
    assert.strictEqual(unsaved.progressPercent, 45, 'Progress must be preserved after unsave');

    // Reset library
    await withTimeout(repo.clearLibrary(), 1000, 'clearLibrary');
    const emptyInteractions = await repo.getInteractions();
    assert.deepStrictEqual(emptyInteractions, {});
  });

  it('3. Concurrent updates to different articles preserve both changes', async () => {
    const driver = new MemoryStorageDriver();
    // Add artificial delay to simulate realistic storage I/O and expose races
    driver.delayMs = 15;
    const storage = new AtemStorage(driver);
    const repo = new LocalLibraryRepository(storage);

    // Launch concurrent operations to two different articles simultaneously
    const opA = repo.saveItem('art-A');
    const opB = repo.saveItem('art-B');

    await withTimeout(Promise.all([opA, opB]), 2000, 'concurrent saves');

    const all = await repo.getInteractions();
    assert.ok(all['art-A'], 'art-A must exist');
    assert.ok(all['art-B'], 'art-B must exist');
    assert.strictEqual(all['art-A'].saved, true);
    assert.strictEqual(all['art-B'].saved, true);
  });

  it('4. Progress and bookmark updates on the same article preserve both fields', async () => {
    const driver = new MemoryStorageDriver();
    driver.delayMs = 10;
    const storage = new AtemStorage(driver);
    const repo = new LocalLibraryRepository(storage);

    const artId = 'art-combined';

    // Interleave simultaneous save and progress updates on the SAME article
    const saveOp = repo.saveItem(artId);
    const progressOp = repo.updateProgress(artId, 80);

    await withTimeout(Promise.all([saveOp, progressOp]), 2000, 'combined operations');

    const result = await repo.getInteraction(artId);
    assert.ok(result !== null);
    assert.strictEqual(result.saved, true, 'Saved flag must be true');
    assert.strictEqual(result.progressPercent, 80, 'Progress must be 80%');
  });

  it('5. A failed operation releases its lock and later operations can succeed', async () => {
    const driver = new MemoryStorageDriver();
    const storage = new AtemStorage(driver);
    const repo = new LocalLibraryRepository(storage);

    // Configure driver to fail writes
    driver.shouldFailWrites = true;

    // Operation should fail
    await assert.rejects(
      () => repo.saveItem('art-fail'),
      StorageWriteError,
      'Should throw StorageWriteError'
    );

    // Lock manager should not have locked the key permanently
    assert.strictEqual(storage.getLockManager().isKeyLocked(INTERACTIONS_STORAGE_KEY), false);

    // Re-enable driver
    driver.shouldFailWrites = false;

    // Subsequent operation on the same key must now succeed without hanging
    const successResult = await withTimeout(
      repo.saveItem('art-recover'),
      1000,
      'subsequent save after failure'
    );
    assert.strictEqual(successResult.saved, true);

    const item = await repo.getInteraction('art-recover');
    assert.ok(item !== null);
    assert.strictEqual(item.saved, true);
  });

  it('6. A new repository instance can read committed data', async () => {
    const driver = new MemoryStorageDriver();
    const storage = new AtemStorage(driver);

    // Instance 1 commits data
    const repo1 = new LocalUserProfileRepository(storage);
    await repo1.saveProfile({
      ...DEFAULT_USER_PROFILE,
      isOnboarded: true,
      readingPreferences: {
        ...DEFAULT_USER_PROFILE.readingPreferences,
        fontSize: 'xl'
      }
    });

    // Instance 2 reads data
    const repo2 = new LocalUserProfileRepository(storage);
    const read = await repo2.getProfile();
    assert.strictEqual(read.isOnboarded, true);
    assert.strictEqual(read.readingPreferences.fontSize, 'xl');
  });

  it('7. Older asynchronous work cannot overwrite newer user choices', async () => {
    const driver = new MemoryStorageDriver();
    const storage = new AtemStorage(driver);
    const repo = new LocalUserProfileRepository(storage);

    // Initial state
    await repo.saveProfile({
      ...DEFAULT_USER_PROFILE,
      isOnboarded: true,
      readingPreferences: { ...DEFAULT_USER_PROFILE.readingPreferences, fontSize: 'md' }
    });

    // Emulate an older async update (e.g. user selected 'lg')
    // followed by a newer async update (user quickly changed to 'xl')
    // Using updateProfile with mutator functions ensures the second mutator runs on the committed state of the first
    const firstUpdate = repo.updateProfile(curr => ({
      ...curr,
      readingPreferences: { ...curr.readingPreferences, fontSize: 'lg' }
    }));

    const secondUpdate = repo.updateProfile(curr => ({
      ...curr,
      readingPreferences: { ...curr.readingPreferences, fontSize: 'xl' }
    }));

    const [, finalProfile] = await Promise.all([firstUpdate, secondUpdate]);
    assert.strictEqual(finalProfile.readingPreferences.fontSize, 'xl');

    const persisted = await repo.getProfile();
    assert.strictEqual(persisted.readingPreferences.fontSize, 'xl');
  });

  it('8. Distinguishes missing vs corrupt data and throws CorruptedDataError', async () => {
    const driver = new MemoryStorageDriver();
    const storage = new AtemStorage(driver);
    const repo = new LocalUserProfileRepository(storage);

    // Missing data returns default un-onboarded profile
    const freshProfile = await repo.getProfile();
    assert.strictEqual(freshProfile.isOnboarded, false);

    // Corrupt JSON string
    await driver.setItem(USER_PROFILE_STORAGE_KEY, '{ invalid json syntax !!! ');

    await assert.rejects(
      () => repo.getProfile(),
      (err: any) => {
        assert.ok(err instanceof CorruptedDataError);
        assert.ok(err.raw.includes('invalid json'));
        return true;
      },
      'Corrupt data must raise CorruptedDataError rather than silent overwrite'
    );

    // Quarantine and reset restores clean state and preserves corrupted bytes
    const cleanProfile = await repo.quarantineAndReset();
    assert.strictEqual(cleanProfile.isOnboarded, false);

    const keys = await driver.getAllKeys();
    const quarantineKey = keys.find(k => k.startsWith('@atem:quarantine:user_profile:'));
    assert.ok(quarantineKey !== undefined, 'Quarantine backup key must exist');
    const quarantinedRaw = await driver.getItem(quarantineKey!);
    assert.ok(quarantinedRaw!.includes('invalid json'));
  });
});
