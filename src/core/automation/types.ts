import { z } from 'zod';

export const AutomationTemplateSchema = z.enum([
  'thematic_question_collector', // Neue Quellen zu einer spezifischen Frage oder Thema sammeln
  'collection_curator',          // Ausgewählte Sammlung regelmäßig mit Primärquellen ergänzen
  'connection_suggester',        // Mögliche Brücken zwischen eigenen Notizen und Beiträgen vorschlagen
  'thought_retrospective'        // Editierbaren Rückblick über Gedanken und Quellen erstellen
]);
export type AutomationTemplate = z.infer<typeof AutomationTemplateSchema>;

export const AutomationTriggerSchema = z.enum([
  'manual',            // Nur manueller Probelauf / Trigger
  'session_start',     // Beim Start der App
  'scheduled_edition'  // Zu den Tagesausgaben
]);
export type AutomationTrigger = z.infer<typeof AutomationTriggerSchema>;

export const AutomationRunLogSchema = z.object({
  id: z.string(),
  runAt: z.string(),
  status: z.enum(['success', 'empty', 'error']),
  itemsProcessed: z.number().int().nonnegative(),
  summary: z.string(),
  dryRun: z.boolean().default(false)
});
export type AutomationRunLog = z.infer<typeof AutomationRunLogSchema>;

export const AutomationRuleSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  description: z.string().default(''),
  template: AutomationTemplateSchema,
  trigger: AutomationTriggerSchema.default('manual'),
  scope: z.object({
    topic: z.string().optional(),
    space: z.string().optional(),
    question: z.string().optional(),
    maxItems: z.number().int().min(1).max(20).default(5)
  }),
  dataAccess: z.array(z.string()).default(['read_feed']),
  outputTarget: z.enum(['thought_nodes', 'collection', 'reading_list']).default('thought_nodes'),
  enabled: z.boolean().default(false), // Neue Regeln beginnen strikt deaktiviert (Masterplan §7)
  createdAt: z.string(),
  updatedAt: z.string(),
  lastRunAt: z.string().optional(),
  lastResultSummary: z.string().optional(),
  history: z.array(AutomationRunLogSchema).default([])
});
export type AutomationRule = z.infer<typeof AutomationRuleSchema>;

export interface AutomationExecutionResult {
  ruleId: string;
  status: 'success' | 'empty' | 'error';
  itemsCreated: number;
  summary: string;
  dryRun: boolean;
  affectedItemTitles: string[];
}
