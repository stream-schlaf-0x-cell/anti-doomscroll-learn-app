import { UserProfile, UserProfileSchema } from '../domain/types';
import { DEFAULT_USER_PROFILE } from './fixtures';
import { AtemStorage, appStorage, CorruptedDataError } from './storage';

export const USER_PROFILE_STORAGE_KEY = '@atem:user_profile:v1';

export interface IUserProfileRepository {
  getProfile(): Promise<UserProfile>;
  saveProfile(profile: UserProfile): Promise<UserProfile>;
  updateProfile(mutator: (current: UserProfile) => UserProfile): Promise<UserProfile>;
  resetProfile(): Promise<UserProfile>;
  quarantineAndReset(): Promise<UserProfile>;
}

export class LocalUserProfileRepository implements IUserProfileRepository {
  constructor(private storage: AtemStorage = appStorage) {}

  /**
   * Retrieves user profile from storage.
   * Distinguishes missing data (fresh install) from corrupt/incompatible data.
   * Throws CorruptedDataError on malformed JSON or schema violation rather than silently overwriting.
   */
  async getProfile(): Promise<UserProfile> {
    const raw = await this.storage.getItem(USER_PROFILE_STORAGE_KEY);
    if (!raw) {
      // Fresh install: return default profile with onboarding incomplete
      return {
        ...DEFAULT_USER_PROFILE,
        isOnboarded: false
      };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (parseErr) {
      throw new CorruptedDataError(
        'Die gespeicherten Profileinstellungen sind syntaktisch ungültig.',
        raw,
        parseErr
      );
    }

    if (!parsed || typeof parsed !== 'object') {
      throw new CorruptedDataError(
        'Die gespeicherten Profileinstellungen haben ein ungültiges Format.',
        raw
      );
    }

    const safe = UserProfileSchema.safeParse(parsed);
    if (!safe.success) {
      throw new CorruptedDataError(
        'Die gespeicherten Profileinstellungen entsprechen nicht dem aktuellen Daten-Schema.',
        raw,
        safe.error
      );
    }

    return safe.data;
  }

  /**
   * Updates user profile atomically using a mutator function.
   * Acquires the lock once and reads the latest committed state before modifying,
   * guaranteeing that stale React state snapshots cannot overwrite newer committed choices.
   */
  async updateProfile(mutator: (current: UserProfile) => UserProfile): Promise<UserProfile> {
    return this.storage.runTransaction(USER_PROFILE_STORAGE_KEY, async (tx) => {
      const raw = await tx.get();
      let current: UserProfile;

      if (!raw) {
        current = {
          ...DEFAULT_USER_PROFILE,
          isOnboarded: false
        };
      } else {
        let parsed: unknown;
        try {
          parsed = JSON.parse(raw);
        } catch (parseErr) {
          throw new CorruptedDataError(
            'Die gespeicherten Profileinstellungen sind syntaktisch ungültig.',
            raw,
            parseErr
          );
        }
        if (!parsed || typeof parsed !== 'object') {
          throw new CorruptedDataError(
            'Die gespeicherten Profileinstellungen haben ein ungültiges Format.',
            raw
          );
        }
        const safe = UserProfileSchema.safeParse(parsed);
        if (!safe.success) {
          throw new CorruptedDataError(
            'Die gespeicherten Profileinstellungen entsprechen nicht dem aktuellen Daten-Schema.',
            raw,
            safe.error
          );
        }
        current = safe.data;
      }

      const modified = mutator(current);
      const validated = UserProfileSchema.parse(modified);
      await tx.set(JSON.stringify(validated));
      return validated;
    });
  }

  /**
   * Full profile overwrite within a serialized transaction.
   */
  async saveProfile(profile: UserProfile): Promise<UserProfile> {
    return this.storage.runTransaction(USER_PROFILE_STORAGE_KEY, async (tx) => {
      const validated = UserProfileSchema.parse(profile);
      await tx.set(JSON.stringify(validated));
      return validated;
    });
  }

  /**
   * Resets profile: removes persisted profile and returns fresh default with isOnboarded: false.
   */
  async resetProfile(): Promise<UserProfile> {
    return this.storage.runTransaction(USER_PROFILE_STORAGE_KEY, async (tx) => {
      await tx.remove();
      return {
        ...DEFAULT_USER_PROFILE,
        isOnboarded: false
      };
    });
  }

  /**
   * Safely preserves corrupt bytes into a quarantine key before resetting to fresh default.
   */
  async quarantineAndReset(): Promise<UserProfile> {
    return this.storage.runTransaction(USER_PROFILE_STORAGE_KEY, async (tx) => {
      const raw = await tx.get();
      if (raw) {
        const quarantineKey = `@atem:quarantine:user_profile:${Date.now()}`;
        await this.storage.setItem(quarantineKey, raw);
      }
      await tx.remove();
      return {
        ...DEFAULT_USER_PROFILE,
        isOnboarded: false
      };
    });
  }
}

export const userProfileRepository = new LocalUserProfileRepository();
