import { FeedItem, FeedItemSchema } from '../domain/types';
import { FeedOperationResult, defaultFeedOperationManager, FeedOperationType, FeedOperationTelemetry } from './FeedOperationManager';

export interface MergeOptions {
  operationType?: FeedOperationType;
  pinInserted?: boolean;
  telemetry?: FeedOperationTelemetry;
  onProgress?: (stage: string, progressFraction: number) => void;
}

export interface MergeExecutionResult {
  mergedItems: FeedItem[];
  operationResult: FeedOperationResult;
}

/**
 * FeedMergeService: Performs atomic, idempotent feed ingestion with strict validation,
 * deduplication, and accurate operation result reporting.
 */
export class FeedMergeService {
  /**
   * Merges incoming candidate items into current items.
   * Guarantees that:
   * 1. Genuinely new items are counted as inserted.
   * 2. Existing identical items are counted as duplicate.
   * 3. Existing items with fresh updates are counted as updated.
   * 4. Corrupted / invalid items are counted as rejected.
   * 5. Newly inserted items appear at the top when pinned.
   */
  public static merge(
    currentItems: FeedItem[],
    candidates: FeedItem[],
    options: MergeOptions = {}
  ): MergeExecutionResult {
    const opType = options.operationType || 'manual_refresh';
    const opManager = defaultFeedOperationManager;
    opManager.startOperation(opType);

    options.onProgress?.('1/3: Artikelkandidaten prüfen …', 0.33);

    const existingMap = new Map<string, FeedItem>();
    const existingUrlMap = new Map<string, string>(); // canonicalUrl -> id
    const existingTitleMap = new Map<string, string>(); // clean title -> id

    for (const item of currentItems) {
      existingMap.set(item.id, item);
      if (item.canonicalUrl) {
        existingUrlMap.set(item.canonicalUrl.toLowerCase(), item.id);
      }
      const cleanTitle = item.title.trim().toLowerCase();
      if (cleanTitle.length > 5) {
        existingTitleMap.set(cleanTitle, item.id);
      }
    }

    const inserted: FeedItem[] = [];
    const updated: FeedItem[] = [];
    const insertedIds: string[] = [];
    const updatedIds: string[] = [];
    const rejectedReasons: Record<string, number> = options.telemetry?.rejectedCount
      ? { gatekeeper: options.telemetry.rejectedCount }
      : {};
    let duplicateCount = 0;
    let rejectedCount = options.telemetry?.rejectedCount ?? 0;

    options.onProgress?.('2/3: Duplikate und Rauschen filtern …', 0.66);

    for (const cand of candidates) {
      // 1. Schema Validation
      const safeParsed = FeedItemSchema.safeParse(cand);
      if (!safeParsed.success) {
        rejectedCount++;
        rejectedReasons['schema_invalid'] = (rejectedReasons['schema_invalid'] || 0) + 1;
        continue;
      }
      const validatedItem = safeParsed.data;

      // 2. Exact or Canonical Match Check
      const existingById = existingMap.get(validatedItem.id);
      const existingByUrl = validatedItem.canonicalUrl
        ? existingMap.get(existingUrlMap.get(validatedItem.canonicalUrl.toLowerCase()) || '')
        : undefined;
      const existingByTitle = existingMap.get(existingTitleMap.get(validatedItem.title.trim().toLowerCase()) || '');

      const existingMatch = existingById || existingByUrl || existingByTitle;

      if (existingMatch) {
        // Check if content genuinely changed
        const isContentChanged =
          validatedItem.articleBody !== existingMatch.articleBody ||
          validatedItem.body !== existingMatch.body ||
          validatedItem.title !== existingMatch.title ||
          validatedItem.subtitle !== existingMatch.subtitle ||
          validatedItem.feedText !== existingMatch.feedText ||
          validatedItem.keyInsight !== existingMatch.keyInsight ||
          validatedItem.didacticTransfer !== existingMatch.didacticTransfer ||
          validatedItem.primaryTopic !== existingMatch.primaryTopic ||
          validatedItem.topics.join('|') !== existingMatch.topics.join('|') ||
          validatedItem.curationScore !== existingMatch.curationScore;

        if (isContentChanged) {
          const mergedItem: FeedItem = {
            ...existingMatch,
            ...validatedItem,
            id: existingMatch.id, // Keep established ID
            isNewlyCurated: true,
            curatedAt: new Date().toISOString()
          };
          existingMap.set(existingMatch.id, mergedItem);
          updated.push(mergedItem);
          updatedIds.push(existingMatch.id);
        } else {
          duplicateCount++;
        }
      } else {
        // Truly New Item!
        const nowIso = new Date().toISOString();
        const flaggedItem: FeedItem = {
          ...validatedItem,
          isNewlyCurated: true,
          curatedAt: nowIso
        };

        existingMap.set(flaggedItem.id, flaggedItem);
        if (flaggedItem.canonicalUrl) {
          existingUrlMap.set(flaggedItem.canonicalUrl.toLowerCase(), flaggedItem.id);
        }
        existingTitleMap.set(flaggedItem.title.trim().toLowerCase(), flaggedItem.id);

        inserted.push(flaggedItem);
        insertedIds.push(flaggedItem.id);
      }
    }

    options.onProgress?.('3/3: Ergebnisse bewerten und einfügen …', 1.0);

    // Order: If user-initiated, place newly inserted items at the very top
    const remainingItems = currentItems
      .filter(item => !insertedIds.includes(item.id))
      .map(item => existingMap.get(item.id) || item);

    const mergedItems = [...inserted.map(item => existingMap.get(item.id) || item), ...remainingItems];

    const operationResult = opManager.completeOperation(
      {
        fetchedCount: options.telemetry?.candidateCount ?? candidates.length,
        candidateCount: options.telemetry?.candidateCount ?? candidates.length,
        insertedCount: inserted.length,
        updatedCount: updated.length,
        duplicateCount,
        rejectedCount,
        insertedIds,
        updatedIds,
        rejectedReasons,
        usedAI: options.telemetry?.usedAI ?? false,
        usedFallback: options.telemetry?.usedFallback ?? false,
        cacheHits: options.telemetry?.cacheHits ?? 0,
        errors: []
      },
      { pinNewItems: options.pinInserted !== false }
    );

    return {
      mergedItems,
      operationResult
    };
  }
}
