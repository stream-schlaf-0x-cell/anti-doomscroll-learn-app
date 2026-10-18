import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AutomationEngine } from '../src/core/automation/automationEngine';
import { GraphRepository } from '../src/core/graph/graphRepository';
import { LocalFeedRepository } from '../src/core/data/feedRepository';
import { AtemStorage, MemoryStorageDriver } from '../src/core/data/storage';
import { FeedItemSchema } from '../src/core/domain/types';
import { REAL_KNOWLEDGE_VAULT } from '../src/core/data/realKnowledgeVault';

function setupEngine() {
  const storage = new AtemStorage(new MemoryStorageDriver());
  const graphRepo = new GraphRepository(storage);
  const items = REAL_KNOWLEDGE_VAULT.map(i => FeedItemSchema.parse(i));
  const feedRepo = new LocalFeedRepository(items, storage);
  const engine = new AutomationEngine(storage, graphRepo, feedRepo);
  return { engine, graphRepo, feedRepo, storage };
}

describe('AutomationEngine & Research Collector (Masterplan v3)', () => {
  it('1. Initializes default templates with enabled=false (safe start)', async () => {
    const { engine } = setupEngine();
    const rules = await engine.getRules();
    assert.ok(rules.length >= 2);
    for (const rule of rules) {
      assert.strictEqual(rule.enabled, false, `Rule "${rule.title}" must start disabled`);
      assert.strictEqual(rule.trigger, 'manual');
    }
  });

  it('2. Dry-run previews matching sources without modifying graph or storage', async () => {
    const { engine, graphRepo } = setupEngine();
    const rules = await engine.getRules();
    const rule = rules[0];

    const result = await engine.executeRule(rule.id, { dryRun: true });
    assert.strictEqual(result.status, 'success');
    assert.strictEqual(result.dryRun, true);
    assert.ok(result.summary.includes('Probelauf:'));
    assert.ok(result.affectedItemTitles.length > 0);

    // Verify zero thoughts created in graph
    const thoughts = await graphRepo.getAllThoughts();
    assert.strictEqual(thoughts.length, 0);
  });

  it('3. Real run creates organizing thought node and connects source articles', async () => {
    const { engine, graphRepo } = setupEngine();
    const rules = await engine.getRules();
    const rule = rules[0];

    const result = await engine.executeRule(rule.id, { dryRun: false });
    assert.strictEqual(result.status, 'success');
    assert.strictEqual(result.dryRun, false);

    // Verify thought node created
    const thoughts = await graphRepo.getAllThoughts();
    assert.strictEqual(thoughts.length, 1);
    assert.strictEqual(thoughts[0].type, 'question');
    assert.strictEqual(thoughts[0].title, rule.scope.question || rule.title);

    // Verify connections created linking sources to this question
    const connections = await graphRepo.getAllConnections();
    assert.ok(connections.length > 0);
    for (const c of connections) {
      assert.strictEqual(c.targetId, thoughts[0].id);
      assert.strictEqual(c.relation, 'belongs_to');
    }

    // Verify run history updated
    const updatedRule = await engine.getRule(rule.id);
    assert.ok(updatedRule?.lastRunAt);
    assert.strictEqual(updatedRule?.history.length, 1);
    assert.strictEqual(updatedRule?.history[0].status, 'success');
  });

  it('4. Handles rules with zero matching candidates gracefully', async () => {
    const { engine } = setupEngine();
    const customRule = await engine.saveRule({
      title: 'Unmatchable search',
      template: 'thematic_question_collector',
      trigger: 'manual',
      scope: {
        topic: 'non_existent_topic' as any,
        maxItems: 3
      },
      dataAccess: ['read_feed'],
      outputTarget: 'thought_nodes',
      enabled: false
    });

    const result = await engine.executeRule(customRule.id, { dryRun: false });
    assert.strictEqual(result.status, 'empty');
    assert.strictEqual(result.itemsCreated, 0);
    assert.ok(result.summary.includes('Keine passenden Beiträge'));
  });
});
