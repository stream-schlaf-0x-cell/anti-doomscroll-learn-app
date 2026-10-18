export type FeedOperationType =
  | 'manual_refresh'
  | 'ai_curation'
  | 'hivemind_generation'
  | 'topic_generation'
  | 'background_sync'
  | 'import_document';

export type FeedOperationStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'partial'
  | 'failed'
  | 'cancelled';

export interface FeedOperationResult {
  operationId: string;
  operationType: FeedOperationType;
  status: FeedOperationStatus;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;

  fetchedCount: number;
  candidateCount: number;
  insertedCount: number;
  updatedCount: number;
  duplicateCount: number;
  rejectedCount: number;

  insertedIds: string[];
  updatedIds: string[];
  rejectedReasons?: Record<string, number>;

  usedAI: boolean;
  usedFallback: boolean;
  cacheHits: number;
  errors: string[];
}

/** Measurements from the curation stage before the approved items reach the merge. */
export interface FeedOperationTelemetry {
  candidateCount: number;
  approvedCount: number;
  rejectedCount: number;
  usedAI: boolean;
  usedFallback: boolean;
  cacheHits: number;
}

export type OperationProgressCallback = (stage: string, progressFraction: number) => void;

/**
 * FeedOperationManager: Orchestrates all content insertion flows and tracks operation telemetry.
 * Provides guaranteed top-pinning for newly inserted user-initiated items.
 */
export class FeedOperationManager {
  private operationHistory: FeedOperationResult[] = [];
  private pinnedItemIds = new Set<string>();
  private pinnedItemTimestampMap = new Map<string, number>();
  private pinnedItemOrder: string[] = [];
  private listeners = new Set<(lastResult: FeedOperationResult) => void>();
  private activeOperation: FeedOperationResult | null = null;

  /**
   * Starts tracking a new feed operation.
   */
  public startOperation(type: FeedOperationType, operationId?: string): FeedOperationResult {
    const id = operationId || `op-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const op: FeedOperationResult = {
      operationId: id,
      operationType: type,
      status: 'running',
      startedAt: new Date().toISOString(),
      fetchedCount: 0,
      candidateCount: 0,
      insertedCount: 0,
      updatedCount: 0,
      duplicateCount: 0,
      rejectedCount: 0,
      insertedIds: [],
      updatedIds: [],
      rejectedReasons: {},
      usedAI: false,
      usedFallback: false,
      cacheHits: 0,
      errors: []
    };
    this.activeOperation = op;
    return op;
  }

  /**
   * Finalizes an operation and notifies listeners.
   */
  public completeOperation(
    resultUpdates: Partial<FeedOperationResult>,
    options?: { pinNewItems?: boolean }
  ): FeedOperationResult {
    const current = this.activeOperation || this.startOperation('manual_refresh');
    const now = Date.now();
    const startTime = new Date(current.startedAt).getTime() || now;
    const completedAt = new Date(now).toISOString();

    const finalized: FeedOperationResult = {
      ...current,
      ...resultUpdates,
      status: resultUpdates.status || (resultUpdates.errors && resultUpdates.errors.length > 0 ? 'partial' : 'completed'),
      completedAt,
      durationMs: now - startTime
    };

    // Manual re-curation can improve existing articles without creating new IDs.
    if (options?.pinNewItems !== false && finalized.operationType !== 'background_sync') {
      const changedIds = [...new Set([...finalized.insertedIds, ...finalized.updatedIds])];
      this.pinnedItemOrder = [...changedIds, ...this.pinnedItemOrder.filter(id => !changedIds.includes(id))];
      for (const id of changedIds) {
        this.pinnedItemIds.add(id);
        this.pinnedItemTimestampMap.set(id, now);
      }
    }

    this.operationHistory.unshift(finalized);
    if (this.operationHistory.length > 50) {
      this.operationHistory.pop();
    }
    this.activeOperation = null;

    this.notifyListeners(finalized);
    return finalized;
  }

  /**
   * Records a failed operation safely.
   */
  public failOperation(error: string | Error): FeedOperationResult {
    const current = this.activeOperation || this.startOperation('manual_refresh');
    const errMsg = typeof error === 'string' ? error : error.message || 'Operation failed';
    return this.completeOperation({
      status: 'failed',
      errors: [...(current.errors || []), errMsg]
    });
  }

  /**
   * Returns whether an item is currently in the active top-pinned set.
   */
  public isItemPinned(id: string): boolean {
    return this.pinnedItemIds.has(id);
  }

  /**
   * Returns all pinned item IDs sorted by newest first.
   */
  public getPinnedItemIds(): string[] {
    this.expireOldPins();
    return this.pinnedItemOrder.filter(id => this.pinnedItemIds.has(id));
  }

  /**
   * Cleans up pins older than the specified max age (default: 30 minutes) to avoid permanent pinning.
   */
  public expireOldPins(maxAgeMs: number = 30 * 60 * 1000): void {
    const cutoff = Date.now() - maxAgeMs;
    for (const [id, timestamp] of this.pinnedItemTimestampMap.entries()) {
      if (timestamp < cutoff) {
        this.pinnedItemIds.delete(id);
        this.pinnedItemTimestampMap.delete(id);
      }
    }
  }

  /**
   * Unpins a specific item.
   */
  public unpinItem(id: string): void {
    this.pinnedItemIds.delete(id);
    this.pinnedItemTimestampMap.delete(id);
    this.pinnedItemOrder = this.pinnedItemOrder.filter(pinnedId => pinnedId !== id);
  }

  /**
   * Clears all pinned items.
   */
  public clearPins(): void {
    this.pinnedItemIds.clear();
    this.pinnedItemTimestampMap.clear();
    this.pinnedItemOrder = [];
  }

  /**
   * Get the last completed operation result.
   */
  public getLastResult(): FeedOperationResult | null {
    return this.operationHistory[0] || null;
  }

  /**
   * Get operation history for observability & diagnostics.
   */
  public getHistory(): FeedOperationResult[] {
    return [...this.operationHistory];
  }

  public subscribe(listener: (lastResult: FeedOperationResult) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(result: FeedOperationResult): void {
    for (const listener of this.listeners) {
      try {
        listener(result);
      } catch {
        // Safe listener failure isolation
      }
    }
  }
}

export const defaultFeedOperationManager = new FeedOperationManager();
