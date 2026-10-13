import { UserProfile, UserProfileSchema } from '../domain/types';
import { DEFAULT_USER_PROFILE } from './fixtures';
import { appStorage } from './storage';

const USER_PROFILE_STORAGE_KEY = '@atem:user_profile:v1';

export interface IUserProfileRepository {
  getProfile(): Promise<UserProfile>;
  saveProfile(profile: UserProfile): Promise<UserProfile>;
  resetProfile(): Promise<UserProfile>;
}

export class LocalUserProfileRepository implements IUserProfileRepository {
  async getProfile(): Promise<UserProfile> {
    try {
      const raw = await appStorage.getItem(USER_PROFILE_STORAGE_KEY);
      if (!raw) {
        return DEFAULT_USER_PROFILE;
      }
      const parsed = JSON.parse(raw);
      const safe = UserProfileSchema.safeParse(parsed);
      if (safe.success) {
        return safe.data;
      }
      return DEFAULT_USER_PROFILE;
    } catch {
      return DEFAULT_USER_PROFILE;
    }
  }

  async saveProfile(profile: UserProfile): Promise<UserProfile> {
    const validated = UserProfileSchema.parse(profile);
    await appStorage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(validated));
    return validated;
  }

  async resetProfile(): Promise<UserProfile> {
    await appStorage.removeItem(USER_PROFILE_STORAGE_KEY);
    return DEFAULT_USER_PROFILE;
  }
}

export const userProfileRepository = new LocalUserProfileRepository();
