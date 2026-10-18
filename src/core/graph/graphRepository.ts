import { AtemStorage, appStorage } from '../data/storage';
import {
  UserThoughtNode,
  UserThoughtNodeSchema,
  KnowledgeConnection,
  KnowledgeConnectionSchema,
  GraphExportPayload,
  ThoughtNodeInput,
  KnowledgeConnectionInput
} from './types';

const THOUGHTS_STORAGE_KEY = '@atem:user_thoughts:v1';
const CONNECTIONS_STORAGE_KEY = '@atem:knowledge_connections:v1';

export class GraphRepository {
  private thoughts: Map<string, UserThoughtNode> = new Map();
  private connections: Map<string, KnowledgeConnection> = new Map();
  private isLoaded = false;
  private loadPromise: Promise<void> | null = null;

  constructor(private storage: AtemStorage = appStorage) {}

  private async ensureLoaded(): Promise<void> {
    if (this.isLoaded) return;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = (async () => {
      try {
        const [rawThoughts, rawConnections] = await Promise.all([
          this.storage.getItem(THOUGHTS_STORAGE_KEY),
          this.storage.getItem(CONNECTIONS_STORAGE_KEY)
        ]);

        if (rawThoughts) {
          const parsed = JSON.parse(rawThoughts);
          if (Array.isArray(parsed)) {
            for (const item of parsed) {
              const res = UserThoughtNodeSchema.safeParse(item);
              if (res.success) {
                this.thoughts.set(res.data.id, res.data);
              }
            }
          }
        }

        if (rawConnections) {
          const parsed = JSON.parse(rawConnections);
          if (Array.isArray(parsed)) {
            for (const item of parsed) {
              const res = KnowledgeConnectionSchema.safeParse(item);
              if (res.success) {
                this.connections.set(res.data.id, res.data);
              }
            }
          }
        }
      } catch {
        // Non-fatal fallback for storage errors
      } finally {
        this.isLoaded = true;
      }
    })();

    return this.loadPromise;
  }

  private async persist(): Promise<void> {
    try {
      const thoughtsArray = Array.from(this.thoughts.values());
      const connectionsArray = Array.from(this.connections.values());
      await Promise.all([
        this.storage.setItem(THOUGHTS_STORAGE_KEY, JSON.stringify(thoughtsArray)),
        this.storage.setItem(CONNECTIONS_STORAGE_KEY, JSON.stringify(connectionsArray))
      ]);
    } catch {
      // Memory state survives storage failure
    }
  }

  public async addThought(input: ThoughtNodeInput): Promise<UserThoughtNode> {
    await this.ensureLoaded();
    const now = new Date().toISOString();
    const id = input.id || `thought-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const thought: UserThoughtNode = {
      id,
      type: input.type || 'thought',
      title: input.title.trim(),
      body: input.body || '',
      space: input.space,
      tags: input.tags || [],
      sourceArticleId: input.sourceArticleId,
      sourceArticleTitle: input.sourceArticleTitle,
      createdAt: now,
      updatedAt: now,
      status: input.status || 'draft'
    };

    const validated = UserThoughtNodeSchema.parse(thought);
    this.thoughts.set(validated.id, validated);
    await this.persist();
    return validated;
  }

  public async updateThought(
    id: string,
    updates: Partial<Omit<UserThoughtNode, 'id' | 'createdAt'>>
  ): Promise<UserThoughtNode | null> {
    await this.ensureLoaded();
    const existing = this.thoughts.get(id);
    if (!existing) return null;

    const updated: UserThoughtNode = {
      ...existing,
      ...updates,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString()
    };

    const validated = UserThoughtNodeSchema.parse(updated);
    this.thoughts.set(id, validated);
    await this.persist();
    return validated;
  }

  public async deleteThought(id: string): Promise<boolean> {
    await this.ensureLoaded();
    if (!this.thoughts.has(id)) return false;

    this.thoughts.delete(id);

    // Cascade delete connections connected to this thought
    for (const [connId, conn] of this.connections.entries()) {
      if (conn.sourceId === id || conn.targetId === id) {
        this.connections.delete(connId);
      }
    }

    await this.persist();
    return true;
  }

  public async getThought(id: string): Promise<UserThoughtNode | null> {
    await this.ensureLoaded();
    return this.thoughts.get(id) || null;
  }

  public async getAllThoughts(): Promise<UserThoughtNode[]> {
    await this.ensureLoaded();
    return Array.from(this.thoughts.values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  public async connectNodes(input: KnowledgeConnectionInput): Promise<KnowledgeConnection> {
    await this.ensureLoaded();
    // Prevent duplicate connections with identical source, target and relation
    for (const existing of this.connections.values()) {
      if (
        existing.sourceId === input.sourceId &&
        existing.targetId === input.targetId &&
        existing.relation === input.relation
      ) {
        return existing;
      }
    }

    const now = new Date().toISOString();
    const id = input.id || `conn-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const connection: KnowledgeConnection = {
      id,
      sourceId: input.sourceId,
      targetId: input.targetId,
      relation: input.relation || 'belongs_to',
      annotation: input.annotation,
      provenance: input.provenance || 'user_curated',
      createdAt: now,
      strength: typeof input.strength === 'number' ? input.strength : 1.0
    };

    const validated = KnowledgeConnectionSchema.parse(connection);
    this.connections.set(validated.id, validated);
    await this.persist();
    return validated;
  }

  public async disconnectNodes(id: string): Promise<boolean> {
    await this.ensureLoaded();
    if (!this.connections.has(id)) return false;
    this.connections.delete(id);
    await this.persist();
    return true;
  }

  public async getConnectionsForNode(nodeId: string): Promise<KnowledgeConnection[]> {
    await this.ensureLoaded();
    const results: KnowledgeConnection[] = [];
    for (const conn of this.connections.values()) {
      if (conn.sourceId === nodeId || conn.targetId === nodeId) {
        results.push(conn);
      }
    }
    return results;
  }

  public async getAllConnections(): Promise<KnowledgeConnection[]> {
    await this.ensureLoaded();
    return Array.from(this.connections.values());
  }

  public async exportGraphAsMarkdown(): Promise<string> {
    await this.ensureLoaded();
    const thoughts = await this.getAllThoughts();
    const connections = await this.getAllConnections();

    let output = '# Atmen Personal Knowledge Graph\n\n';
    output += `Exported: ${new Date().toISOString()}\n`;
    output += `Nodes: ${thoughts.length} | Connections: ${connections.length}\n\n---\n\n`;

    for (const thought of thoughts) {
      const conns = connections.filter(c => c.sourceId === thought.id || c.targetId === thought.id);
      output += `## ${thought.title}\n`;
      output += `**Typ:** ${thought.type} | **Status:** ${thought.status} | **Raum:** ${thought.space || 'Universal'}\n`;
      if (thought.tags.length > 0) {
        output += `**Tags:** ${thought.tags.map(t => `#${t}`).join(' ')}\n`;
      }
      if (thought.sourceArticleTitle) {
        output += `**Quelle:** ${thought.sourceArticleTitle} (ID: \`${thought.sourceArticleId}\`)\n`;
      }
      output += `\n${thought.body}\n\n`;

      if (conns.length > 0) {
        output += `### Verknüpfungen\n`;
        for (const c of conns) {
          const isSource = c.sourceId === thought.id;
          const otherId = isSource ? c.targetId : c.sourceId;
          const otherThought = this.thoughts.get(otherId);
          const targetName = otherThought ? otherThought.title : otherId;
          const dir = isSource ? `--[${c.relation}]-->` : `<--[${c.relation}]--`;
          output += `- ${dir} [[${targetName}]]${c.annotation ? ` (${c.annotation})` : ''}\n`;
        }
        output += '\n';
      }
      output += '---\n\n';
    }

    return output;
  }

  public async exportAsJson(): Promise<GraphExportPayload> {
    await this.ensureLoaded();
    return {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      thoughts: await this.getAllThoughts(),
      connections: await this.getAllConnections()
    };
  }

  public async getGraphTelemetry(): Promise<{ nodeCount: number; edgeCount: number; density: number }> {
    await this.ensureLoaded();
    const nodeCount = this.thoughts.size;
    const edgeCount = this.connections.size;
    const maxEdges = nodeCount > 1 ? (nodeCount * (nodeCount - 1)) / 2 : 1;
    const density = nodeCount > 1 ? Number((edgeCount / maxEdges).toFixed(4)) : 0;
    return { nodeCount, edgeCount, density };
  }
}

export const defaultGraphRepository = new GraphRepository();
