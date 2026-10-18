import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GraphRepository } from '../src/core/graph/graphRepository';
import { AtemStorage, MemoryStorageDriver } from '../src/core/data/storage';

function createTestRepo(): GraphRepository {
  return new GraphRepository(new AtemStorage(new MemoryStorageDriver()));
}

describe('GraphRepository & Personal Knowledge Graph (Masterplan v3)', () => {
  it('1. Adds thought and validates schema fields', async () => {
    const repo = createTestRepo();
    const thought = await repo.addThought({
      type: 'thesis',
      title: 'Die Entschleunigung des Denkens vertieft Erkenntnis',
      body: 'Algorithmen belohnen Reaktivität; tiefe Synthese erfordert Verweilen.',
      tags: ['erkenntnistheorie', 'kontemplation'],
      space: 'c/dialektik'
    });

    assert.ok(thought.id.startsWith('thought-'));
    assert.strictEqual(thought.type, 'thesis');
    assert.strictEqual(thought.status, 'draft');
    assert.strictEqual(thought.tags.length, 2);

    const retrieved = await repo.getThought(thought.id);
    assert.ok(retrieved);
    assert.strictEqual(retrieved.title, thought.title);
  });

  it('2. Updates thought and bumps updatedAt', async () => {
    const repo = createTestRepo();
    const created = await repo.addThought({
      title: 'Erster Entwurf',
      body: 'Start'
    });

    const updated = await repo.updateThought(created.id, {
      title: 'Geschliffene These',
      status: 'crystallized'
    });

    assert.ok(updated);
    assert.strictEqual(updated.title, 'Geschliffene These');
    assert.strictEqual(updated.status, 'crystallized');
    assert.ok(new Date(updated.updatedAt).getTime() >= new Date(created.updatedAt).getTime());
  });

  it('3. Connects two thoughts and retrieves connections for a node', async () => {
    const repo = createTestRepo();
    const t1 = await repo.addThought({ title: 'These A: Emergenz in LLMs' });
    const t2 = await repo.addThought({ title: 'These B: Grenzen symbolischer Repräsentation' });

    const conn = await repo.connectNodes({
      sourceId: t1.id,
      targetId: t2.id,
      relation: 'contradicts',
      annotation: 'Spannungsfeld zwischen Konnektionismus und Logik',
      provenance: 'user_curated'
    });

    assert.ok(conn.id.startsWith('conn-'));
    assert.strictEqual(conn.relation, 'contradicts');

    const connectionsForT1 = await repo.getConnectionsForNode(t1.id);
    assert.strictEqual(connectionsForT1.length, 1);
    assert.strictEqual(connectionsForT1[0].targetId, t2.id);

    const connectionsForT2 = await repo.getConnectionsForNode(t2.id);
    assert.strictEqual(connectionsForT2.length, 1);
    assert.strictEqual(connectionsForT2[0].sourceId, t1.id);
  });

  it('4. Prevents duplicate connections between the same nodes and relation', async () => {
    const repo = createTestRepo();
    const t1 = await repo.addThought({ title: 'Node 1' });
    const t2 = await repo.addThought({ title: 'Node 2' });

    const first = await repo.connectNodes({
      sourceId: t1.id,
      targetId: t2.id,
      relation: 'inspires'
    });

    const second = await repo.connectNodes({
      sourceId: t1.id,
      targetId: t2.id,
      relation: 'inspires'
    });

    assert.strictEqual(first.id, second.id);
    const all = await repo.getAllConnections();
    assert.strictEqual(all.length, 1);
  });

  it('5. Deletes thought and cascades connection deletion', async () => {
    const repo = createTestRepo();
    const t1 = await repo.addThought({ title: 'Node to keep' });
    const t2 = await repo.addThought({ title: 'Node to delete' });

    await repo.connectNodes({
      sourceId: t1.id,
      targetId: t2.id,
      relation: 'belongs_to'
    });

    assert.strictEqual((await repo.getAllConnections()).length, 1);

    const deleted = await repo.deleteThought(t2.id);
    assert.strictEqual(deleted, true);

    const remainingThoughts = await repo.getAllThoughts();
    assert.strictEqual(remainingThoughts.length, 1);
    assert.strictEqual(remainingThoughts[0].id, t1.id);

    // Cascaded connection cleanup
    const remainingConns = await repo.getAllConnections();
    assert.strictEqual(remainingConns.length, 0);
  });

  it('6. Exports graph as Markdown with wikilinks and YAML metadata', async () => {
    const repo = createTestRepo();
    const t1 = await repo.addThought({
      title: 'Kants Imperativ',
      body: 'Handle so, dass die Maxime deines Willens jederzeit als Prinzip einer allgemeinen Gesetzgebung gelten könne.',
      tags: ['philosophie', 'ethik']
    });
    const t2 = await repo.addThought({
      title: 'Verantwortungsethik bei Hans Jonas',
      body: 'Das Prinzip Verantwortung im Zeitalter der Technologie.',
      tags: ['ethik', 'zukunft']
    });

    await repo.connectNodes({
      sourceId: t1.id,
      targetId: t2.id,
      relation: 'inspires',
      annotation: 'Erweiterung auf zukünftige Generationen'
    });

    const markdown = await repo.exportGraphAsMarkdown();
    assert.ok(markdown.includes('# Atmen Personal Knowledge Graph'));
    assert.ok(markdown.includes('## Kants Imperativ'));
    assert.ok(markdown.includes('## Verantwortungsethik bei Hans Jonas'));
    assert.ok(markdown.includes('[[Verantwortungsethik bei Hans Jonas]]'));
    assert.ok(markdown.includes('#philosophie'));
  });

  it('7. Calculates graph telemetry accurately', async () => {
    const repo = createTestRepo();
    const t1 = await repo.addThought({ title: 'A' });
    const t2 = await repo.addThought({ title: 'B' });
    const t3 = await repo.addThought({ title: 'C' });

    await repo.connectNodes({ sourceId: t1.id, targetId: t2.id, relation: 'belongs_to' });
    await repo.connectNodes({ sourceId: t2.id, targetId: t3.id, relation: 'belongs_to' });

    const telemetry = await repo.getGraphTelemetry();
    assert.strictEqual(telemetry.nodeCount, 3);
    assert.strictEqual(telemetry.edgeCount, 2);
    // maxEdges for 3 nodes = 3 * 2 / 2 = 3. density = 2/3 = 0.6667
    assert.strictEqual(telemetry.density, 0.6667);
  });
});
