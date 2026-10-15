import { EnrichmentLedgerEntry, EnrichmentLedgerSummary } from './types';
import { appStorage, AtemStorage, KeyLockManager, CorruptedDataError } from '../data/storage';

// Grounded in official Google Gemini Flash pricing:
// Input: $0.10 / 1M tokens ($0.00000010/token)
// Output: $0.40 / 1M tokens ($0.00000040/token)
// Converted to EUR at 0.95 EUR/USD:
export const EUR_PER_INPUT_TOKEN = 0.000000095;
export const EUR_PER_OUTPUT_TOKEN = 0.00000038;

// Hard monthly budget ceiling for one personal user
export const MONTHLY_BUDGET_CEILING_EUR = 5.00;

export function calculateCostEur(inputTokens: number, outputTokens: number): number {
  const cost = inputTokens * EUR_PER_INPUT_TOKEN + outputTokens * EUR_PER_OUTPUT_TOKEN;
  // Round to 6 decimal places
  return Math.round(cost * 1000000) / 1000000;
}

export function getCurrentMonthKey(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export interface ActiveReservation {
  id: string;
  amountEur: number;
  monthKey: string;
  createdAt: number;
}

export interface ILedgerStorage {
  load(): Promise<Record<string, EnrichmentLedgerSummary>>;
  save(data: Record<string, EnrichmentLedgerSummary>): Promise<void>;
  clear(): Promise<void>;
  loadReservations?(): Promise<ActiveReservation[]>;
  saveReservations?(reservations: ActiveReservation[]): Promise<void>;
}

export class MemoryLedgerStorage implements ILedgerStorage {
  private data: Record<string, EnrichmentLedgerSummary> = {};
  private reservations: ActiveReservation[] = [];

  async load(): Promise<Record<string, EnrichmentLedgerSummary>> {
    return { ...this.data };
  }

  async save(data: Record<string, EnrichmentLedgerSummary>): Promise<void> {
    this.data = { ...data };
  }

  async clear(): Promise<void> {
    this.data = {};
    this.reservations = [];
  }

  async loadReservations(): Promise<ActiveReservation[]> {
    return [...this.reservations];
  }

  async saveReservations(reservations: ActiveReservation[]): Promise<void> {
    this.reservations = [...reservations];
  }
}

export class StorageDriverLedgerStorage implements ILedgerStorage {
  private static STORAGE_KEY = '@atem:usage_ledger:v1';
  private static RESERVATIONS_KEY = '@atem:usage_ledger_reservations:v1';

  constructor(private readonly storage: AtemStorage = appStorage) {}

  async load(): Promise<Record<string, EnrichmentLedgerSummary>> {
    const raw = await this.storage.getItem(StorageDriverLedgerStorage.STORAGE_KEY);
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed;
      }
      throw new CorruptedDataError('Ledger-Daten sind fehlerhaft (kein Objekt).', raw);
    } catch (err) {
      if (err instanceof CorruptedDataError) throw err;
      throw new CorruptedDataError('Ledger-JSON ist beschädigt.', raw, err);
    }
  }

  async save(data: Record<string, EnrichmentLedgerSummary>): Promise<void> {
    try {
      await this.storage.setItem(StorageDriverLedgerStorage.STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Non-fatal fallback
    }
  }

  async clear(): Promise<void> {
    try {
      await this.storage.removeItem(StorageDriverLedgerStorage.STORAGE_KEY);
      await this.storage.removeItem(StorageDriverLedgerStorage.RESERVATIONS_KEY);
    } catch {
      // Non-fatal fallback
    }
  }

  async loadReservations(): Promise<ActiveReservation[]> {
    try {
      const raw = await this.storage.getItem(StorageDriverLedgerStorage.RESERVATIONS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async saveReservations(reservations: ActiveReservation[]): Promise<void> {
    try {
      await this.storage.setItem(StorageDriverLedgerStorage.RESERVATIONS_KEY, JSON.stringify(reservations));
    } catch {
      // Non-fatal
    }
  }
}

export class EnrichmentUsageLedger {
  private inMemorySummary: Record<string, EnrichmentLedgerSummary> = {};
  private activeReservations: Map<string, ActiveReservation> = new Map();
  private lockManager: KeyLockManager = new KeyLockManager();
  private storage: ILedgerStorage;
  private isStorageCorrupted: boolean = false;

  constructor(
    _filePathOrStorage?: string | ILedgerStorage,
    useFilePersistence?: boolean,
    storageOverride?: ILedgerStorage
  ) {
    if (typeof _filePathOrStorage === 'object' && _filePathOrStorage !== null && 'load' in _filePathOrStorage) {
      this.storage = _filePathOrStorage;
    } else if (storageOverride) {
      this.storage = storageOverride;
    } else if (useFilePersistence === false) {
      this.storage = new MemoryLedgerStorage();
    } else {
      this.storage = new StorageDriverLedgerStorage();
    }
  }

  private async loadLedger(): Promise<Record<string, EnrichmentLedgerSummary>> {
    try {
      const loaded = await this.storage.load();
      this.isStorageCorrupted = false;
      if (loaded && Object.keys(loaded).length > 0) {
        this.inMemorySummary = loaded;
      }
      return this.inMemorySummary;
    } catch (err) {
      if (err instanceof CorruptedDataError) {
        // FAIL-SAFE CLOSED: corrupt stored data strictly locks budget to prevent spending
        this.isStorageCorrupted = true;
      }
      return this.inMemorySummary;
    }
  }

  private async saveLedger(): Promise<void> {
    try {
      await this.storage.save(this.inMemorySummary);
    } catch {
      // Non-fatal
    }
  }

  private async syncReservations(): Promise<void> {
    if (this.storage.loadReservations) {
      try {
        const stored = await this.storage.loadReservations();
        const now = Date.now();
        for (const r of stored) {
          if (now - r.createdAt <= 60000 && !this.activeReservations.has(r.id)) {
            this.activeReservations.set(r.id, r);
          }
        }
      } catch {
        // Non-fatal
      }
    }
  }

  private async persistReservations(): Promise<void> {
    if (this.storage.saveReservations) {
      try {
        const active = Array.from(this.activeReservations.values());
        await this.storage.saveReservations(active);
      } catch {
        // Non-fatal
      }
    }
  }

  private async getReservedAmountForMonth(monthKey: string): Promise<number> {
    await this.syncReservations();
    let reserved = 0;
    const now = Date.now();
    // Reservations expire after 60 seconds if abandoned
    for (const [id, res] of this.activeReservations.entries()) {
      if (now - res.createdAt > 60000) {
        this.activeReservations.delete(id);
      } else if (res.monthKey === monthKey) {
        reserved += res.amountEur;
      }
    }
    return Math.round(reserved * 1000000) / 1000000;
  }

  async getSummary(monthKey: string = getCurrentMonthKey()): Promise<EnrichmentLedgerSummary> {
    return this.lockManager.acquire(monthKey, async () => {
      const all = await this.loadLedger();
      if (this.isStorageCorrupted) {
        return {
          monthKey,
          totalCalls: 0,
          totalInputTokens: 0,
          totalOutputTokens: 0,
          totalCostEur: MONTHLY_BUDGET_CEILING_EUR,
          budgetLimitEur: MONTHLY_BUDGET_CEILING_EUR,
          isBudgetExceeded: true,
          entries: []
        };
      }
      const summary = all[monthKey] ?? {
        monthKey,
        totalCalls: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCostEur: 0,
        budgetLimitEur: MONTHLY_BUDGET_CEILING_EUR,
        isBudgetExceeded: false,
        entries: []
      };
      return summary;
    });
  }

  async canSpend(estimatedEur: number = 0.001, monthKey: string = getCurrentMonthKey()): Promise<boolean> {
    return this.lockManager.acquire(monthKey, async () => {
      if (this.isStorageCorrupted) {
        return false;
      }
      const all = await this.loadLedger();
      if (this.isStorageCorrupted) {
        return false;
      }
      const summary = all[monthKey];
      const committed = summary ? summary.totalCostEur : 0;
      const reserved = await this.getReservedAmountForMonth(monthKey);
      return committed + reserved + estimatedEur <= MONTHLY_BUDGET_CEILING_EUR;
    });
  }

  /**
   * Atomically reserves an estimated budget chunk.
   * Prevents race conditions where concurrent calls bypass the monthly budget ceiling.
   */
  async reserveSpend(estimatedEur: number, monthKey: string = getCurrentMonthKey()): Promise<string | null> {
    return this.lockManager.acquire(monthKey, async () => {
      if (this.isStorageCorrupted) {
        return null;
      }
      const all = await this.loadLedger();
      if (this.isStorageCorrupted) {
        return null;
      }
      const summary = all[monthKey];
      const committed = summary ? summary.totalCostEur : 0;
      const reserved = await this.getReservedAmountForMonth(monthKey);

      if (committed + reserved + estimatedEur > MONTHLY_BUDGET_CEILING_EUR) {
        return null; // Budget exceeded or unknown status, reject reservation
      }

      const reservationId = `res_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      this.activeReservations.set(reservationId, {
        id: reservationId,
        amountEur: estimatedEur,
        monthKey,
        createdAt: Date.now()
      });
      await this.persistReservations();
      return reservationId;
    });
  }

  /**
   * Releases an unconsumed reservation (e.g. if the API call failed or was aborted).
   */
  async releaseReservation(reservationId: string): Promise<void> {
    const res = this.activeReservations.get(reservationId);
    if (!res) return;
    await this.lockManager.acquire(res.monthKey, async () => {
      this.activeReservations.delete(reservationId);
      await this.persistReservations();
    });
  }

  /**
   * Commits the actual spend against a previously held reservation.
   */
  async commitReservation(
    reservationId: string,
    entry: Omit<EnrichmentLedgerEntry, 'timestamp' | 'costEur'> & { costEur?: number },
    monthKey: string = getCurrentMonthKey()
  ): Promise<EnrichmentLedgerSummary> {
    return this.lockManager.acquire(monthKey, async () => {
      this.activeReservations.delete(reservationId);
      await this.persistReservations();
      return this.recordUsageInternal(entry, monthKey);
    });
  }

  async recordUsage(
    entry: Omit<EnrichmentLedgerEntry, 'timestamp' | 'costEur'> & { costEur?: number },
    monthKey: string = getCurrentMonthKey()
  ): Promise<EnrichmentLedgerSummary> {
    return this.lockManager.acquire(monthKey, async () => {
      return this.recordUsageInternal(entry, monthKey);
    });
  }

  private async recordUsageInternal(
    entry: Omit<EnrichmentLedgerEntry, 'timestamp' | 'costEur'> & { costEur?: number },
    monthKey: string = getCurrentMonthKey()
  ): Promise<EnrichmentLedgerSummary> {
    const all = await this.loadLedger();
    const current = all[monthKey] ?? {
      monthKey,
      totalCalls: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCostEur: 0,
      budgetLimitEur: MONTHLY_BUDGET_CEILING_EUR,
      isBudgetExceeded: false,
      entries: []
    };

    const costEur = entry.costEur ?? calculateCostEur(entry.inputTokens, entry.outputTokens);
    const completeEntry: EnrichmentLedgerEntry = {
      timestamp: new Date().toISOString(),
      itemId: entry.itemId,
      model: entry.model,
      inputTokens: entry.inputTokens,
      outputTokens: entry.outputTokens,
      costEur
    };

    const nextCost = Math.round((current.totalCostEur + costEur) * 1000000) / 1000000;
    const updatedSummary: EnrichmentLedgerSummary = {
      monthKey,
      totalCalls: current.totalCalls + 1,
      totalInputTokens: current.totalInputTokens + entry.inputTokens,
      totalOutputTokens: current.totalOutputTokens + entry.outputTokens,
      totalCostEur: nextCost,
      budgetLimitEur: MONTHLY_BUDGET_CEILING_EUR,
      isBudgetExceeded: nextCost >= MONTHLY_BUDGET_CEILING_EUR,
      entries: [...current.entries, completeEntry]
    };

    all[monthKey] = updatedSummary;
    this.inMemorySummary = all;
    await this.saveLedger();
    return updatedSummary;
  }

  async resetLedger(): Promise<void> {
    this.inMemorySummary = {};
    this.activeReservations.clear();
    await this.storage.clear();
  }
}

export const defaultUsageLedger = new EnrichmentUsageLedger();
