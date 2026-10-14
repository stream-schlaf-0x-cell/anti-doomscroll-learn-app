import fs from 'node:fs/promises';
import path from 'node:path';
import { EnrichmentLedgerEntry, EnrichmentLedgerSummary } from './types';

// Grounded in official Gemini Flash pricing ($0.10/1M input, $0.40/1M output converted to EUR at 0.95 EUR/USD)
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

export class EnrichmentUsageLedger {
  private inMemorySummary: Record<string, EnrichmentLedgerSummary> = {};

  constructor(
    private readonly filePath: string = path.resolve(__dirname, '../data/usage-ledger.json'),
    private readonly useFilePersistence: boolean = true
  ) {}

  private async loadLedger(): Promise<Record<string, EnrichmentLedgerSummary>> {
    if (!this.useFilePersistence) {
      return this.inMemorySummary;
    }

    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        this.inMemorySummary = parsed;
        return parsed;
      }
      return {};
    } catch {
      return this.inMemorySummary;
    }
  }

  private async saveLedger(): Promise<void> {
    if (!this.useFilePersistence) return;
    try {
      await fs.writeFile(this.filePath, JSON.stringify(this.inMemorySummary, null, 2), 'utf8');
    } catch {
      // Non-fatal if storage write fails
    }
  }

  async getSummary(monthKey: string = getCurrentMonthKey()): Promise<EnrichmentLedgerSummary> {
    const all = await this.loadLedger();
    return (
      all[monthKey] ?? {
        monthKey,
        totalCalls: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCostEur: 0,
        budgetLimitEur: MONTHLY_BUDGET_CEILING_EUR,
        isBudgetExceeded: false,
        entries: []
      }
    );
  }

  async canSpend(estimatedEur: number = 0.001, monthKey: string = getCurrentMonthKey()): Promise<boolean> {
    const summary = await this.getSummary(monthKey);
    return summary.totalCostEur + estimatedEur <= MONTHLY_BUDGET_CEILING_EUR;
  }

  async recordUsage(
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
    if (this.useFilePersistence) {
      try {
        await fs.unlink(this.filePath);
      } catch {
        // Ignored
      }
    }
  }
}

export const defaultUsageLedger = new EnrichmentUsageLedger();
