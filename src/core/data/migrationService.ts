import { AtemStorage, appStorage } from './storage';
import { IFeedRepository, feedRepository } from './feedRepository';
import { defaultPersistentArticleStore } from '../feed/PersistentArticleStore';
import { INTERACTIONS_STORAGE_KEY, SAVED_ARTICLES_STORAGE_KEY } from './libraryRepository';
import { satisfiesCuratedBodyContract, sanitizeCuratedFeedItem } from '../enrichment/batchEnricher';
import { isArdSource } from '../domain/ranking';
import { REAL_KNOWLEDGE_VAULT } from './realKnowledgeVault';
import { MEME_VAULT_ENTRIES } from './memeVaultEntries';
import { FeedItem } from '../domain/types';

export const CURRENT_DATA_MIGRATION_VERSION = '2026-10-30-v3.1-infinite-curated';
export const DATA_MIGRATION_STORAGE_KEY = '@atem:data_migration_version:v1';

export interface MigrationResult {
  migrated: boolean;
  version: string;
  previousVersion: string | null;
  purgedStubsCount: number;
  preservedItemsCount: number;
  totalItemsCount: number;
}

/**
 * In-Place Data Migration Engine (Work Package 1)
 * 
 * Ensures already-onboarded devices (profile.isOnboarded === true) automatically upgrade
 * in-place on reload without requiring manual resets or repeat onboarding.
 * 
 * Invariants:
 * 1. 100% Personal Data Preservation:
 *    Never touches UserProfile, custom spaces, graph thoughts, or user interactions (bookmarks, votes, notes).
 * 2. In-Place Feed & Cache Upgrade:
 *    Purges legacy unbookmarked bare stubs failing `satisfiesCuratedBodyContract`,
 *    normalizes undated legacy timestamps (`publicationDateReliable: false`),
 *    and force-merges the latest REAL_KNOWLEDGE_VAULT and MEME_VAULT_ENTRIES.
 */
export async function runInPlaceDataMigration(
  storage: AtemStorage = appStorage,
  repo: IFeedRepository = feedRepository
): Promise<MigrationResult> {
  let storedVersion: string | null = null;
  try {
    storedVersion = await storage.getItem(DATA_MIGRATION_STORAGE_KEY);
  } catch {
    storedVersion = null;
  }

  if (storedVersion === CURRENT_DATA_MIGRATION_VERSION) {
    return {
      migrated: false,
      version: CURRENT_DATA_MIGRATION_VERSION,
      previousVersion: storedVersion,
      purgedStubsCount: 0,
      preservedItemsCount: 0,
      totalItemsCount: repo.getAllItems ? repo.getAllItems().length : 0
    };
  }

  // 1. Gather protected user item IDs from library interactions & saved articles
  const protectedUserItemIds = new Set<string>();
  try {
    const rawInteractions = await storage.getItem(INTERACTIONS_STORAGE_KEY);
    if (rawInteractions) {
      const parsedInteractions = JSON.parse(rawInteractions);
      if (parsedInteractions && typeof parsedInteractions === 'object' && !Array.isArray(parsedInteractions)) {
        for (const [id, interaction] of Object.entries(parsedInteractions)) {
          if (!id || typeof id !== 'string') continue;
          const inter = interaction as any;
          if (
            inter &&
            typeof inter === 'object' &&
            (
              (typeof inter.voteScore === 'number' && inter.voteScore !== 0) ||
              Boolean(inter.isFavorite) ||
              Boolean(inter.feedback) ||
              (Array.isArray(inter.userNotes) && inter.userNotes.length > 0) ||
              (Array.isArray(inter.notes) && inter.notes.length > 0) ||
              (typeof inter.progressPercent === 'number' && inter.progressPercent > 0) ||
              (typeof inter.progress === 'number' && inter.progress > 0)
            )
          ) {
            protectedUserItemIds.add(id);
          }
        }
      }
    }
  } catch {
    // Non-fatal
  }

  try {
    const rawSaved = await storage.getItem(SAVED_ARTICLES_STORAGE_KEY);
    if (rawSaved) {
      const parsedSaved = JSON.parse(rawSaved);
      if (Array.isArray(parsedSaved)) {
        for (const item of parsedSaved) {
          if (item && typeof item === 'object' && typeof item.id === 'string' && item.id.trim()) {
            protectedUserItemIds.add(item.id.trim());
          }
        }
      }
    }
  } catch {
    // Non-fatal
  }

  // 2. Load all cached articles across PersistentArticleStore, legacy keys, and current feed repository
  const candidateMap = new Map<string, FeedItem>();

  try {
    const persisted = await defaultPersistentArticleStore.loadArticles();
    if (Array.isArray(persisted)) {
      for (const item of persisted) {
        if (item && typeof item === 'object' && typeof item.id === 'string' && item.id.trim()) {
          candidateMap.set(item.id, item);
        }
      }
    }
  } catch {
    // Non-fatal
  }

  // Check legacy keys if present in storage
  for (const legacyKey of ['@atem:feed_items:v1', '@atem:persistent_articles:v1', '@atem:dynamic_items:v1']) {
    try {
      const raw = await storage.getItem(legacyKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (item && typeof item === 'object' && typeof item.id === 'string' && item.id.trim() && !candidateMap.has(item.id)) {
              candidateMap.set(item.id, item);
            }
          }
        }
      }
    } catch {
      // Non-fatal
    }
  }

  if (repo.getAllItems) {
    try {
      const allRepoItems = repo.getAllItems();
      if (Array.isArray(allRepoItems)) {
        for (const item of allRepoItems) {
          if (item && typeof item === 'object' && typeof item.id === 'string' && item.id.trim() && !candidateMap.has(item.id)) {
            candidateMap.set(item.id, item);
          }
        }
      }
    } catch {
      // Non-fatal
    }
  }

  // 3. Filter items: preserve protected user items, filter others through satisfiesCuratedBodyContract
  let purgedCount = 0;
  let preservedCount = 0;
  const cleanedMap = new Map<string, FeedItem>();

  for (const [id, item] of candidateMap.entries()) {
    const isUserProtected = protectedUserItemIds.has(id);

    if (!isUserProtected) {
      if (!satisfiesCuratedBodyContract(item)) {
        purgedCount++;
        continue;
      }
      // Purge stale unbookmarked mid-October ARD ticker filler (> 7 days old)
      if (isArdSource(item)) {
        const pubTime = new Date(item.publishedAt).getTime();
        if (!isNaN(pubTime) && Date.now() - pubTime > 7 * 86400 * 1000) {
          purgedCount++;
          continue;
        }
      }
    }

    // In-place timestamp, topic accuracy and provenance normalization
    const isUndatedVisual =
      item.format === 'art_showcase' ||
      item.format === 'meme' ||
      item.format === 'comic' ||
      item.space === 'c/memes' ||
      item.space === 'c/kunst_galerie' ||
      item.primaryTopic === 'memes_satire';

    const sanitized = isUserProtected ? item : sanitizeCuratedFeedItem(item);
    const normalizedItem: FeedItem = {
      ...sanitized,
      publicationDateReliable: isUndatedVisual ? false : (sanitized.publicationDateReliable ?? true),
      firstSeenAt: sanitized.firstSeenAt || sanitized.publishedAt || new Date().toISOString()
    };

    cleanedMap.set(id, normalizedItem);
    preservedCount++;
  }

  // 4. Force-merge latest REAL_KNOWLEDGE_VAULT and MEME_VAULT_ENTRIES
  for (const vaultItem of REAL_KNOWLEDGE_VAULT) {
    if (!cleanedMap.has(vaultItem.id)) {
      cleanedMap.set(vaultItem.id, vaultItem);
    }
  }

  for (const memeItem of MEME_VAULT_ENTRIES) {
    if (!cleanedMap.has(memeItem.id)) {
      cleanedMap.set(memeItem.id, memeItem);
    }
  }

  const finalItems = Array.from(cleanedMap.values());

  // 5. Save upgraded articles to PersistentArticleStore, storage and repository
  try {
    await storage.setItem('@atem:persistent_articles:v1', JSON.stringify(finalItems));
    await defaultPersistentArticleStore.saveArticles(finalItems);
  } catch {
    // Non-fatal
  }

  if (repo.setItems) {
    repo.setItems(finalItems);
  }

  // 6. Record completed migration version in storage
  try {
    await storage.setItem(DATA_MIGRATION_STORAGE_KEY, CURRENT_DATA_MIGRATION_VERSION);
  } catch {
    // Non-fatal
  }

  return {
    migrated: true,
    version: CURRENT_DATA_MIGRATION_VERSION,
    previousVersion: storedVersion,
    purgedStubsCount: purgedCount,
    preservedItemsCount: preservedCount,
    totalItemsCount: finalItems.length
  };
}
