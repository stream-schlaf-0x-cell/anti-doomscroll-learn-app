import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { SpaceRepository, DEFAULT_SUBCHANNELS } from '../src/core/spaces/spaceRepository';
import { MemoryStorageDriver, AtemStorage } from '../src/core/data/storage';

describe('SpaceRepository (Modular Reddit-like Subchannels)', () => {
  let storage: AtemStorage;
  let repo: SpaceRepository;

  beforeEach(() => {
    storage = new AtemStorage(new MemoryStorageDriver());
    repo = new SpaceRepository(storage);
  });

  it('loads all 12 default curated subchannels matching TOPIC_SPACE_MAP', async () => {
    const spaces = await repo.getAllSpaces();
    assert.equal(spaces.length, 12);
    assert.ok(spaces.some(s => s.handle === 'c/dialektik'));
    assert.ok(spaces.some(s => s.handle === 'c/acceleration'));
    assert.ok(spaces.some(s => s.handle === 'c/synth_alchemie'));
    assert.ok(spaces.some(s => s.handle === 'c/serendipity'));
  });

  it('creates a new custom subchannel on the go with sanitized handle', async () => {
    const created = await repo.createSubchannel({
      title: 'Kognitive Kybernetik',
      description: 'Systemtheorie und Feedback-Schleifen des Geistes',
      flair: '◈ Kybernetik',
      primaryTopic: 'philosophy_ethics',
      antithesisPrompt: 'Wo scheitert die kybernetische Reduktion des Bewusstseins?'
    });

    assert.ok(created.id.startsWith('custom-space-'));
    assert.equal(created.handle, 'c/kognitive_kybernetik');
    assert.equal(created.isCustom, true);
    assert.equal(created.pinned, true);

    const all = await repo.getAllSpaces();
    const found = all.find(s => s.id === created.id);
    assert.ok(found);
    assert.equal(found?.title, 'Kognitive Kybernetik');
  });

  it('toggles pin status on a subchannel', async () => {
    const created = await repo.createSubchannel({
      title: 'Quanten-Kosmos',
      description: 'Verschränkung und Realität'
    });

    assert.equal(created.pinned, true);
    const updated = await repo.togglePin(created.id);
    const found = updated.find(s => s.id === created.id);
    assert.equal(found?.pinned, false);
  });

  it('deletes a custom subchannel', async () => {
    const created = await repo.createSubchannel({
      title: 'Temporärer Test-Raum',
      description: 'Wird gelöscht'
    });

    const deleted = await repo.deleteSubchannel(created.id);
    assert.equal(deleted, true);

    const all = await repo.getAllSpaces();
    assert.equal(all.some(s => s.id === created.id), false);
  });
});
