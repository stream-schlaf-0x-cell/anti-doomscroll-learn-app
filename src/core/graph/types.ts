import { z } from 'zod';

export const ThoughtNodeTypeSchema = z.enum([
  'thought',        // Freier Gedanke / Notiz
  'question',       // Offene Forschungsfrage
  'thesis',         // Behauptung / Hypothese
  'article_note',   // Notiz / Exzerpt zu einem Feed-Beitrag
  'concept'         // Schlüsselbegriff / Brücke
]);
export type ThoughtNodeType = z.infer<typeof ThoughtNodeTypeSchema>;

export const ConnectionRelationSchema = z.enum([
  'cites',            // Zitiert direkt
  'proves',           // Liefert Evidenz / stützt These
  'contradicts',      // Widerspricht / dialektische Antithese
  'raises_question',  // Wirft Frage auf
  'belongs_to',       // Gehört thematisch zu
  'inspires',         // Kreative Assoziation
  'resembles'         // Ähnelt strukturell
]);
export type ConnectionRelation = z.infer<typeof ConnectionRelationSchema>;

export const ConnectionProvenanceSchema = z.enum([
  'user_curated',       // Vom Nutzer bewusst gesetzt
  'source_documented',  // In den Primärquellen explizit belegt
  'ai_suggested'        // Vorschlag aus KI-Kontextsynthese
]);
export type ConnectionProvenance = z.infer<typeof ConnectionProvenanceSchema>;

export const UserThoughtNodeSchema = z.object({
  id: z.string(),
  type: ThoughtNodeTypeSchema.default('thought'),
  title: z.string().min(1),
  body: z.string().default(''),
  space: z.string().optional(),
  tags: z.array(z.string()).default([]),
  sourceArticleId: z.string().optional(),
  sourceArticleTitle: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  status: z.enum(['draft', 'crystallized', 'archived']).default('draft')
});
export type UserThoughtNode = z.infer<typeof UserThoughtNodeSchema>;

export const KnowledgeConnectionSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  targetId: z.string(),
  relation: ConnectionRelationSchema.default('belongs_to'),
  annotation: z.string().optional(),
  provenance: ConnectionProvenanceSchema.default('user_curated'),
  createdAt: z.string(),
  strength: z.number().min(0).max(1).default(1.0)
});
export type KnowledgeConnection = z.infer<typeof KnowledgeConnectionSchema>;

export interface GraphExportPayload {
  version: '1.0.0';
  exportedAt: string;
  thoughts: UserThoughtNode[];
  connections: KnowledgeConnection[];
}

export interface ThoughtNodeInput {
  id?: string;
  type?: ThoughtNodeType;
  title: string;
  body?: string;
  space?: string;
  tags?: string[];
  sourceArticleId?: string;
  sourceArticleTitle?: string;
  status?: 'draft' | 'crystallized' | 'archived';
}

export interface KnowledgeConnectionInput {
  id?: string;
  sourceId: string;
  targetId: string;
  relation?: ConnectionRelation;
  annotation?: string;
  provenance?: ConnectionProvenance;
  strength?: number;
}
