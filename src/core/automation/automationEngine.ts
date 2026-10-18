import { AtemStorage, appStorage } from '../data/storage';
import { IFeedRepository, LocalFeedRepository } from '../data/feedRepository';
import { GraphRepository, defaultGraphRepository } from '../graph/graphRepository';
import {
  AutomationRule,
  AutomationRuleSchema,
  AutomationExecutionResult,
  AutomationRunLog
} from './types';
import { FeedItem } from '../domain/types';

const AUTOMATION_RULES_STORAGE_KEY = '@atem:automation_rules:v1';

export const DEFAULT_AUTOMATION_TEMPLATES: Omit<AutomationRule, 'id' | 'createdAt' | 'updatedAt' | 'history'>[] = [
  {
    title: 'Recherche-Sammler: Erkenntnistheorie & Denken',
    description: 'Sammelt neue Primärquellen und Essays zur Frage des menschlichen Fokus und der Aufmerksamkeit.',
    template: 'thematic_question_collector',
    trigger: 'manual',
    scope: {
      topic: 'philosophy_ethics',
      question: 'Wie bewahren wir epistemische Autonomie im Zeitalter algorithmischer Feeds?',
      maxItems: 4
    },
    dataAccess: ['read_feed', 'read_thoughts'],
    outputTarget: 'thought_nodes',
    enabled: false
  },
  {
    title: 'Didaktik-Transfer: Unterrichtskonzepte',
    description: 'Verbindet aktuelle didaktische Entwicklungen mit eigenen Unterrichtsfragen.',
    template: 'thematic_question_collector',
    trigger: 'manual',
    scope: {
      topic: 'german_didactics',
      space: 'c/didaktik_labor',
      question: 'Welche Methoden fördern textanalytische Tiefenschärfe bei Schülerinnen und Schülern?',
      maxItems: 3
    },
    dataAccess: ['read_feed'],
    outputTarget: 'thought_nodes',
    enabled: false
  }
];

export class AutomationEngine {
  private rules: Map<string, AutomationRule> = new Map();
  private isLoaded = false;
  private loadPromise: Promise<void> | null = null;

  constructor(
    private storage: AtemStorage = appStorage,
    private graphRepo: GraphRepository = defaultGraphRepository,
    private feedRepo: IFeedRepository = new LocalFeedRepository()
  ) {}

  private async ensureLoaded(): Promise<void> {
    if (this.isLoaded) return;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = (async () => {
      try {
        const raw = await this.storage.getItem(AUTOMATION_RULES_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            for (const item of parsed) {
              const res = AutomationRuleSchema.safeParse(item);
              if (res.success) {
                this.rules.set(res.data.id, res.data);
              }
            }
          }
        }

        // Initialize default templates if storage is empty
        if (this.rules.size === 0) {
          const now = new Date().toISOString();
          for (let i = 0; i < DEFAULT_AUTOMATION_TEMPLATES.length; i++) {
            const t = DEFAULT_AUTOMATION_TEMPLATES[i];
            const rule: AutomationRule = {
              ...t,
              id: `rule-default-${i + 1}`,
              createdAt: now,
              updatedAt: now,
              history: []
            };
            this.rules.set(rule.id, rule);
          }
          await this.persist();
        }
      } catch {
        // Fallback to defaults in-memory
      } finally {
        this.isLoaded = true;
      }
    })();

    return this.loadPromise;
  }

  private async persist(): Promise<void> {
    try {
      const arr = Array.from(this.rules.values());
      await this.storage.setItem(AUTOMATION_RULES_STORAGE_KEY, JSON.stringify(arr));
    } catch {
      // Memory persistence survives storage failure
    }
  }

  public async getRules(): Promise<AutomationRule[]> {
    await this.ensureLoaded();
    return Array.from(this.rules.values());
  }

  public async getRule(id: string): Promise<AutomationRule | null> {
    await this.ensureLoaded();
    return this.rules.get(id) || null;
  }

  public async saveRule(
    ruleInput: Omit<AutomationRule, 'id' | 'createdAt' | 'updatedAt' | 'history' | 'description'> & {
      id?: string;
      description?: string;
    }
  ): Promise<AutomationRule> {
    await this.ensureLoaded();
    const now = new Date().toISOString();
    const existing = ruleInput.id ? this.rules.get(ruleInput.id) : null;
    const id = ruleInput.id || `rule-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    const rule: AutomationRule = {
      description: '',
      ...ruleInput,
      id,
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now,
      history: existing ? existing.history : []
    };

    const validated = AutomationRuleSchema.parse(rule);
    this.rules.set(validated.id, validated);
    await this.persist();
    return validated;
  }

  public async toggleRule(id: string, forceStatus?: boolean): Promise<boolean> {
    await this.ensureLoaded();
    const rule = this.rules.get(id);
    if (!rule) return false;

    rule.enabled = typeof forceStatus === 'boolean' ? forceStatus : !rule.enabled;
    rule.updatedAt = new Date().toISOString();
    await this.persist();
    return rule.enabled;
  }

  public async deleteRule(id: string): Promise<boolean> {
    await this.ensureLoaded();
    if (!this.rules.has(id)) return false;
    this.rules.delete(id);
    await this.persist();
    return true;
  }

  /**
   * Executes an automation rule.
   * If dryRun is true, it identifies candidates and produces a summary WITHOUT creating or modifying any records.
   */
  public async executeRule(ruleId: string, options?: { dryRun?: boolean }): Promise<AutomationExecutionResult> {
    await this.ensureLoaded();
    const rule = this.rules.get(ruleId);
    if (!rule) {
      return {
        ruleId,
        status: 'error',
        itemsCreated: 0,
        summary: `Regel "${ruleId}" nicht gefunden.`,
        dryRun: Boolean(options?.dryRun),
        affectedItemTitles: []
      };
    }

    const dryRun = Boolean(options?.dryRun);
    const now = new Date().toISOString();

    try {
      // 1. Gather all candidates from FeedRepository
      const allItems: FeedItem[] = this.feedRepo.getAllItems ? this.feedRepo.getAllItems() : [];

      // 2. Filter items according to rule scope
      const matched = allItems.filter(item => {
        if (rule.scope.topic && item.primaryTopic !== rule.scope.topic && !item.topics.includes(rule.scope.topic as any)) {
          return false;
        }
        if (rule.scope.space && item.space && item.space.toLowerCase() !== rule.scope.space.toLowerCase()) {
          return false;
        }
        return true;
      });

      const maxItems = rule.scope.maxItems || 4;
      const targetItems = matched.slice(0, maxItems);
      const affectedTitles = targetItems.map(i => i.title);

      if (targetItems.length === 0) {
        const summary = `Keine passenden Beiträge im aktuellen Feed gefunden (Filter: ${rule.scope.topic || rule.scope.space || 'alle'}).`;
        this.recordRun(rule, {
          id: `log-${Date.now()}`,
          runAt: now,
          status: 'empty',
          itemsProcessed: 0,
          summary,
          dryRun
        });
        await this.persist();
        return {
          ruleId,
          status: 'empty',
          itemsCreated: 0,
          summary,
          dryRun,
          affectedItemTitles: []
        };
      }

      if (dryRun) {
        const summary = `Probelauf: ${targetItems.length} passende Quellen identifiziert für Frage "${rule.scope.question || rule.title}". Keine Daten verändert.`;
        return {
          ruleId,
          status: 'success',
          itemsCreated: targetItems.length,
          summary,
          dryRun: true,
          affectedItemTitles: affectedTitles
        };
      }

      // Real execution: create an organizing UserThoughtNode and link sources
      const rootThought = await this.graphRepo.addThought({
        type: 'question',
        title: rule.scope.question || rule.title,
        body: `Automatisch gesammelt durch Regel "${rule.title}" am ${new Date().toLocaleDateString('de-DE')}.\n\nRecherche-Rahmen: ${rule.description}`,
        space: rule.scope.space,
        tags: rule.scope.topic ? [rule.scope.topic, 'recherche'] : ['recherche'],
        status: 'draft'
      });

      for (const item of targetItems) {
        await this.graphRepo.connectNodes({
          sourceId: item.id,
          targetId: rootThought.id,
          relation: 'belongs_to',
          annotation: `Quelle von ${item.sourceReferences[0]?.publisher || 'Originalpublikation'}`,
          provenance: 'user_curated'
        });
      }

      const summary = `Erfolgreich ausgeführt: 1 Forschungsfrage angelegt und mit ${targetItems.length} Quellen im persönlichen Netzwerk verknüpft.`;

      this.recordRun(rule, {
        id: `log-${Date.now()}`,
        runAt: now,
        status: 'success',
        itemsProcessed: targetItems.length,
        summary,
        dryRun: false
      });

      rule.lastRunAt = now;
      rule.lastResultSummary = summary;
      rule.updatedAt = now;
      await this.persist();

      return {
        ruleId,
        status: 'success',
        itemsCreated: targetItems.length + 1,
        summary,
        dryRun: false,
        affectedItemTitles: affectedTitles
      };
    } catch (err: any) {
      const summary = `Fehler bei Regelausführung: ${err?.message || 'Unbekannter Fehler'}`;
      this.recordRun(rule, {
        id: `log-${Date.now()}`,
        runAt: now,
        status: 'error',
        itemsProcessed: 0,
        summary,
        dryRun
      });
      await this.persist();
      return {
        ruleId,
        status: 'error',
        itemsCreated: 0,
        summary,
        dryRun,
        affectedItemTitles: []
      };
    }
  }

  private recordRun(rule: AutomationRule, log: AutomationRunLog): void {
    rule.history = [log, ...rule.history.slice(0, 9)];
  }
}

export const defaultAutomationEngine = new AutomationEngine();
