import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { OnTheFlyStreamService } from '../src/core/synthesis/onTheFlyStreamService';
import { FeedItemSchema } from '../src/core/domain/types';

describe('OnTheFlyStreamService (Empty Pocket & Stream Generation)', () => {
  it('generates a full bespoke stream for an empty pocket', async () => {
    const stream = await OnTheFlyStreamService.generateStreamForPocket({
      space: 'c/quanten_sprung',
      includeAiSynthesis: true,
      includeMemes: true
    });

    assert.ok(stream.length >= 3);

    // 1. Check research item
    const researchItem = stream.find(i => i.flair === '🔬 Fundierte Forschung');
    assert.ok(researchItem);
    assert.equal(researchItem?.space, 'c/quanten_sprung');
    assert.equal(researchItem?.evidenceTier, 'multiple_sources');
    assert.equal(researchItem?.sourceTrustLevel, 'peer_reviewed');

    // 2. Check AI synthesis item with explicit AI banner
    const aiItem = stream.find(i => i.flair === '🤖 KI-Sparring' || i.flair === '🤖 KI-Synthese');
    assert.ok(aiItem);
    assert.equal(aiItem?.aiAssisted, true);
    assert.ok(aiItem?.subtitle.includes('KI-Sparring') || aiItem?.subtitle.includes('KI-Synthese'));
    assert.ok(aiItem?.articleBody?.includes('Sparring-Transparenz') || aiItem?.articleBody?.includes('Transparenz-Banner'));

    // 3. Check human meme item
    const memeItem = stream.find(i => i.flair === '🎭 Menschliches Meme');
    assert.ok(memeItem);
    assert.ok(memeItem?.title.includes('5 Minuten'));
    assert.ok(memeItem?.articleBody?.includes('Rabbithole'));
  });

  it('validates every generated item against FeedItemSchema', async () => {
    const stream = await OnTheFlyStreamService.generateStreamForPocket({
      space: 'c/kognitive_kybernetik'
    });

    for (const item of stream) {
      const parsed = FeedItemSchema.safeParse(item);
      assert.equal(parsed.success, true, parsed.success ? undefined : parsed.error.message);
    }
  });

  it('allows generating stream without memes or without AI synthesis', async () => {
    const researchOnly = await OnTheFlyStreamService.generateStreamForPocket({
      space: 'c/reine_wissenschaft',
      includeAiSynthesis: false,
      includeMemes: false,
      count: 2
    });

    assert.ok(researchOnly.some(i => i.flair === '🔬 Fundierte Forschung'));
    assert.ok(!researchOnly.some(i => i.flair === '🤖 KI-Sparring' || i.flair === '🤖 KI-Synthese'));
    assert.ok(!researchOnly.some(i => i.flair === '🎭 Menschliches Meme'));
  });
});
