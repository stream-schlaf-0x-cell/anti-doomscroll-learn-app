import {
  UserProfile,
  UserProfileSchema,
  ReadingInteraction,
  ReadingInteractionSchema,
  FeedItem,
  FeedItemSchema
} from '../domain/types';
import { appStorage, AtemStorage } from './storage';
import { USER_PROFILE_STORAGE_KEY } from './userProfileRepository';
import { INTERACTIONS_STORAGE_KEY, SAVED_ARTICLES_STORAGE_KEY } from './libraryRepository';
import { defaultSpaceRepository } from '../spaces/spaceRepository';

export const AUTO_BACKUP_STORAGE_KEY = '@atem:auto_backup:v1';

export interface AtemBackupSnapshot {
  version: number;
  exportedAt: string;
  profile: UserProfile;
  interactions: Record<string, ReadingInteraction>;
  savedArticles: FeedItem[];
  thoughts?: any[];
  connections?: any[];
  investigations?: any[];
  rules?: any[];
  customSpacesRaw?: string | null;
  pinnedSpacesRaw?: string | null;
  spaces?: any[];
  raindropToken?: string | null;
}

/**
 * BackupService
 *
 * Ensures that local user progress (profile, reading notes, saved bookmarks,
 * custom spaces, thoughts, connections, investigations, and automation rules)
 * is automatically backed up locally on every session and can be exported/imported
 * as a portable JSON file across updates and devices.
 * Strict Privacy & Safety: Never exports API keys or third-party service tokens.
 */
export class BackupService {
  /**
   * Creates an automatic rolling local backup under `@atem:auto_backup:v1`.
   */
  public static async saveAutoBackup(storage: AtemStorage = appStorage): Promise<AtemBackupSnapshot | null> {
    try {
      const [
        rawProfile,
        rawInteractions,
        rawSaved,
        customSpacesRaw,
        pinnedSpacesRaw,
        rawThoughts,
        rawConnections,
        rawInvestigations,
        rawRules
      ] = await Promise.all([
        storage.getItem(USER_PROFILE_STORAGE_KEY),
        storage.getItem(INTERACTIONS_STORAGE_KEY),
        storage.getItem(SAVED_ARTICLES_STORAGE_KEY),
        storage.getItem('@atem:custom_subchannels'),
        storage.getItem('@atem:pinned_space_ids'),
        storage.getItem('@atem:user_thoughts:v1'),
        storage.getItem('@atem:knowledge_connections:v1'),
        storage.getItem('@atem:investigations:v1'),
        storage.getItem('@atem:automation_rules:v1')
      ]);

      if (!rawProfile && !rawInteractions && !rawSaved) {
        return null;
      }

      const profileParsed = rawProfile ? UserProfileSchema.safeParse(JSON.parse(rawProfile)) : null;
      if (!profileParsed || !profileParsed.success) {
        return null;
      }

      const interactions: Record<string, ReadingInteraction> = {};
      if (rawInteractions) {
        const parsedInter = JSON.parse(rawInteractions);
        if (parsedInter && typeof parsedInter === 'object') {
          for (const [k, v] of Object.entries(parsedInter)) {
            const safe = ReadingInteractionSchema.safeParse(v);
            if (safe.success) interactions[k] = safe.data;
          }
        }
      }

      const savedArticles: FeedItem[] = [];
      if (rawSaved) {
        const parsedSaved = JSON.parse(rawSaved);
        if (Array.isArray(parsedSaved)) {
          for (const item of parsedSaved) {
            const safe = FeedItemSchema.safeParse(item);
            if (safe.success) savedArticles.push(safe.data);
          }
        }
      }

      let thoughts: any[] | undefined = undefined;
      if (rawThoughts) {
        try {
          const parsed = JSON.parse(rawThoughts);
          if (Array.isArray(parsed)) thoughts = parsed;
        } catch {}
      }

      let connections: any[] | undefined = undefined;
      if (rawConnections) {
        try {
          const parsed = JSON.parse(rawConnections);
          if (Array.isArray(parsed)) connections = parsed;
        } catch {}
      }

      let investigations: any[] | undefined = undefined;
      if (rawInvestigations) {
        try {
          const parsed = JSON.parse(rawInvestigations);
          if (Array.isArray(parsed)) investigations = parsed;
        } catch {}
      }

      let rules: any[] | undefined = undefined;
      if (rawRules) {
        try {
          const parsed = JSON.parse(rawRules);
          if (Array.isArray(parsed)) rules = parsed;
        } catch {}
      }

      let spacesList: any[] = [];
      if (customSpacesRaw) {
        try {
          const parsed = JSON.parse(customSpacesRaw);
          if (Array.isArray(parsed)) spacesList = parsed;
        } catch {}
      }

      const snapshot: AtemBackupSnapshot = {
        version: 2,
        exportedAt: new Date().toISOString(),
        profile: profileParsed.data,
        interactions,
        savedArticles,
        customSpacesRaw,
        pinnedSpacesRaw,
        spaces: spacesList,
        thoughts,
        connections,
        investigations,
        rules
      };

      await storage.setItem(AUTO_BACKUP_STORAGE_KEY, JSON.stringify(snapshot));
      return snapshot;
    } catch {
      return null;
    }
  }

  /**
   * Returns metadata about the latest local auto-backup if available.
   */
  public static async getLastAutoBackupMeta(storage: AtemStorage = appStorage): Promise<{
    exportedAt: string;
    savedCount: number;
    notesCount: number;
  } | null> {
    try {
      const raw = await storage.getItem(AUTO_BACKUP_STORAGE_KEY);
      if (!raw) return null;
      const parsed: AtemBackupSnapshot = JSON.parse(raw);
      if (!parsed || !parsed.exportedAt) return null;
      const notesCount = Object.values(parsed.interactions || {}).reduce(
        (acc, curr) => acc + (curr.userNotes?.length || 0),
        0
      );
      return {
        exportedAt: parsed.exportedAt,
        savedCount: Array.isArray(parsed.savedArticles) ? parsed.savedArticles.length : 0,
        notesCount
      };
    } catch {
      return null;
    }
  }

  /**
   * Exports all user data as a formatted JSON string and triggers a file download on Web if requested.
   */
  public static async exportBackupJson(
    triggerBrowserDownload: boolean = false,
    storage: AtemStorage = appStorage
  ): Promise<string> {
    const snap = await this.saveAutoBackup(storage);
    const payload: AtemBackupSnapshot = snap || {
      version: 2,
      exportedAt: new Date().toISOString(),
      profile: UserProfileSchema.parse({ explicitInterests: {} }),
      interactions: {},
      savedArticles: []
    };

    const jsonString = JSON.stringify(payload, null, 2);

    if (triggerBrowserDownload && typeof window !== 'undefined' && typeof document !== 'undefined') {
      try {
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const dateStr = new Date().toISOString().slice(0, 10);
        a.href = url;
        a.download = `atmen-backup-v2-${dateStr}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch {
        // Ignore browser download error
      }
    }

    return jsonString;
  }

  /**
   * Restores a backup JSON string into local storage and updates the rolling auto-backup.
   */
  public static async importBackupJson(
    rawJson: string,
    storage: AtemStorage = appStorage
  ): Promise<{
    success: boolean;
    restoredSavedCount: number;
    restoredNotesCount: number;
    restoredThoughtsCount?: number;
    restoredConnectionsCount?: number;
    restoredInvestigationsCount?: number;
    restoredRulesCount?: number;
    error?: string;
  }> {
    try {
      const parsed = JSON.parse(rawJson);
      if (!parsed || typeof parsed !== 'object' || !parsed.profile) {
        return {
          success: false,
          restoredSavedCount: 0,
          restoredNotesCount: 0,
          error: 'Ungültiges Backup-Format: Profil-Daten fehlen.'
        };
      }

      const profileSafe = UserProfileSchema.safeParse(parsed.profile);
      if (!profileSafe.success) {
        return {
          success: false,
          restoredSavedCount: 0,
          restoredNotesCount: 0,
          error: 'Profil im Backup entspricht nicht dem erwarteten Schema.'
        };
      }

      const validInteractions: Record<string, ReadingInteraction> = {};
      let restoredNotesCount = 0;
      if (parsed.interactions && typeof parsed.interactions === 'object') {
        for (const [k, v] of Object.entries(parsed.interactions)) {
          const safe = ReadingInteractionSchema.safeParse(v);
          if (safe.success) {
            validInteractions[k] = safe.data;
            restoredNotesCount += safe.data.userNotes?.length || 0;
          }
        }
      }

      const validSaved: FeedItem[] = [];
      if (Array.isArray(parsed.savedArticles)) {
        for (const item of parsed.savedArticles) {
          const safe = FeedItemSchema.safeParse(item);
          if (safe.success) {
            validSaved.push(safe.data);
          }
        }
      }

      await storage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(profileSafe.data));
      await storage.setItem(INTERACTIONS_STORAGE_KEY, JSON.stringify(validInteractions));
      await storage.setItem(SAVED_ARTICLES_STORAGE_KEY, JSON.stringify(validSaved));

      if (typeof parsed.customSpacesRaw === 'string') {
        await storage.setItem('@atem:custom_subchannels', parsed.customSpacesRaw);
      } else if (Array.isArray(parsed.spaces)) {
        await storage.setItem('@atem:custom_subchannels', JSON.stringify(parsed.spaces));
      } else if (Array.isArray(parsed.customSpaces)) {
        await storage.setItem('@atem:custom_subchannels', JSON.stringify(parsed.customSpaces));
      }

      if (typeof parsed.pinnedSpacesRaw === 'string') {
        await storage.setItem('@atem:pinned_space_ids', parsed.pinnedSpacesRaw);
      } else if (Array.isArray(parsed.pinnedSpaceIds)) {
        await storage.setItem('@atem:pinned_space_ids', JSON.stringify(parsed.pinnedSpaceIds));
      }

      try {
        await defaultSpaceRepository.notify();
      } catch {}

      let restoredThoughtsCount = 0;
      if (Array.isArray(parsed.thoughts)) {
        await storage.setItem('@atem:user_thoughts:v1', JSON.stringify(parsed.thoughts));
        restoredThoughtsCount = parsed.thoughts.length;
      }

      let restoredConnectionsCount = 0;
      if (Array.isArray(parsed.connections)) {
        await storage.setItem('@atem:knowledge_connections:v1', JSON.stringify(parsed.connections));
        restoredConnectionsCount = parsed.connections.length;
      }

      let restoredInvestigationsCount = 0;
      if (Array.isArray(parsed.investigations)) {
        await storage.setItem('@atem:investigations:v1', JSON.stringify(parsed.investigations));
        restoredInvestigationsCount = parsed.investigations.length;
      }

      let restoredRulesCount = 0;
      if (Array.isArray(parsed.rules)) {
        await storage.setItem('@atem:automation_rules:v1', JSON.stringify(parsed.rules));
        restoredRulesCount = parsed.rules.length;
      }

      await this.saveAutoBackup(storage);

      return {
        success: true,
        restoredSavedCount: validSaved.length,
        restoredNotesCount,
        restoredThoughtsCount,
        restoredConnectionsCount,
        restoredInvestigationsCount,
        restoredRulesCount
      };
    } catch (e: any) {
      return {
        success: false,
        restoredSavedCount: 0,
        restoredNotesCount: 0,
        error: e?.message || 'Backup-JSON konnte nicht gelesen werden.'
      };
    }
  }
}
