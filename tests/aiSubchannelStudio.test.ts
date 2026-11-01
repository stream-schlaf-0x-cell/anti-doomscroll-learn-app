import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryStorageDriver, AtemStorage } from '../src/core/data/storage';
import { SpaceRepository, resolveItemSpaceHandle, canonicalSpaceHandle } from '../src/core/spaces/spaceRepository';
import {
  generateDeterministicSubchannelDraft,
  generateSubchannelDraft,
  SUBCHANNEL_VIBES,
  SubchannelVibe
} from '../src/core/studio/subchannelAssistant';
import { FeedItem, FeedItemSchema } from '../src/core/domain/types';
import { REAL_KNOWLEDGE_VAULT } from '../src/core/data/realKnowledgeVault';

describe('AI Studio & Subchannel Streamlining', () => {
  let storage: AtemStorage;
  let repo: SpaceRepository;

  beforeEach(() => {
    storage = new AtemStorage(new MemoryStorageDriver());
    repo = new SpaceRepository(storage);
  });

  describe('One-Input Deterministic Subchannel Draft Generator', () => {
    it('generates consistent drafts for all 5 explicit vibes', () => {
      const vibes: SubchannelVibe[] = ['contemplation', 'debate', 'research', 'visual', 'tech'];

      for (const vibe of vibes) {
        const draft = generateDeterministicSubchannelDraft('Test Raum', vibe);
        assert.ok(draft.handle.startsWith('c/'));
        assert.ok(draft.flair.length > 0);
        assert.ok(draft.description.length > 0);
        assert.ok(Array.isArray(draft.seedSources) && draft.seedSources.length > 0);
        assert.equal(draft.accentColor, SUBCHANNEL_VIBES[vibe].accentColor);
        assert.equal(draft.icon, SUBCHANNEL_VIBES[vibe].icon);
        assert.ok(draft.suggestedAntithesis && draft.suggestedAntithesis.length > 0);
        assert.equal(draft.isAiGenerated, false);
      }
    });

    it('correctly auto-detects vibes from title keywords when no vibe is specified', () => {
      const visualDraft = generateDeterministicSubchannelDraft('Bauhaus Design & Architektur');
      assert.equal(visualDraft.primaryTopic, 'art_aesthetics');
      assert.ok(visualDraft.flair.startsWith('🎨'));

      const techDraft = generateDeterministicSubchannelDraft('Rust Linux Systems');
      assert.equal(techDraft.primaryTopic, 'ai_apple');
      assert.ok(techDraft.flair.startsWith('🛠️'));

      const researchDraft = generateDeterministicSubchannelDraft('Didaktik und Schulforschung');
      assert.equal(researchDraft.primaryTopic, 'german_didactics');
      assert.ok(researchDraft.flair.startsWith('🔬'));

      const debateDraft = generateDeterministicSubchannelDraft('Hegel und Kant Dialektik Streit');
      assert.equal(debateDraft.primaryTopic, 'philosophy_ethics');
      assert.ok(debateDraft.flair.startsWith('⚖️'));

      const contemplationDraft = generateDeterministicSubchannelDraft('Stoa und Achtsamkeit');
      assert.equal(contemplationDraft.primaryTopic, 'contemplation_mind');
      assert.ok(contemplationDraft.flair.startsWith('🌱'));
    });

    it('gracefully handles empty or fallback titles in generateSubchannelDraft', async () => {
      const draft = await generateSubchannelDraft('', 'contemplation', {
        provider: 'gemini',
        apiKey: '',
        model: 'gemini-1.5-flash'
      });
      assert.ok(draft.handle.startsWith('c/'));
      assert.equal(draft.isAiGenerated, false);
    });
  });

  describe('Subchannel Feed Priority & Pin Synchronization', () => {
    it('sets feed priority to high and automatically pins the channel', async () => {
      const initialSpaces = await repo.getAllSpaces();
      const dialektik = initialSpaces.find(s => s.handle === 'c/dialektik')!;

      const updated = await repo.setFeedPriority(dialektik.id, 'high');
      const found = updated.find(s => s.id === dialektik.id);
      assert.ok(found);
      assert.equal(found?.feedPriority, 'high');
      assert.equal(found?.pinned, true);

      // Verify persistence across new query
      const reloaded = await repo.getAllSpaces();
      const reloadedTarget = reloaded.find(s => s.id === dialektik.id);
      assert.equal(reloadedTarget?.feedPriority, 'high');
      assert.equal(reloadedTarget?.pinned, true);
    });

    it('sets feed priority to channel_only and unpins the channel', async () => {
      const initialSpaces = await repo.getAllSpaces();
      const dialektik = initialSpaces.find(s => s.handle === 'c/dialektik')!;

      // Make sure it was pinned
      assert.equal(dialektik.pinned, true);

      const updated = await repo.setFeedPriority(dialektik.id, 'channel_only');
      const found = updated.find(s => s.id === dialektik.id);
      assert.ok(found);
      assert.equal(found?.feedPriority, 'channel_only');
      assert.equal(found?.pinned, false);

      const reloaded = await repo.getAllSpaces();
      const reloadedTarget = reloaded.find(s => s.id === dialektik.id);
      assert.equal(reloadedTarget?.feedPriority, 'channel_only');
      assert.equal(reloadedTarget?.pinned, false);
    });

    it('creates custom subchannel with optional antithesisPrompt and specified priority', async () => {
      // 1. Without antithesisPrompt (Kill Mandatory Antithesis)
      const createdWithoutAntithesis = await repo.createSubchannel({
        title: 'Minimaler Raum',
        description: 'Ein Raum ohne sokratische Pflicht-Antithese',
        feedPriority: 'channel_only'
      });

      assert.equal(createdWithoutAntithesis.antithesisPrompt, undefined);
      assert.equal(createdWithoutAntithesis.feedPriority, 'channel_only');
      assert.equal(createdWithoutAntithesis.pinned, false); // channel_only initial is not pinned

      // 2. With normal priority
      const createdNormal = await repo.createSubchannel({
        title: 'Normaler Raum',
        description: 'Ein normaler Raum',
        feedPriority: 'normal'
      });
      assert.equal(createdNormal.feedPriority, 'normal');
      assert.equal(createdNormal.pinned, true);

      const all = await repo.getAllSpaces();
      assert.ok(all.some(s => s.id === createdWithoutAntithesis.id));
      assert.ok(all.some(s => s.id === createdNormal.id));
    });
  });

  describe('Feed Filtering Logic with channel_only Priority', () => {
    it('excludes channel_only items from general stream but allows them in channel-specific view', async () => {
      const channelOnlySpace = await repo.createSubchannel({
        title: 'Nischen Archiv',
        description: 'Nur bei manuellem Klick sichtbar',
        feedPriority: 'channel_only'
      });

      const normalSpace = await repo.createSubchannel({
        title: 'Standard Raum',
        description: 'Standardmäßig im Feed',
        feedPriority: 'normal'
      });

      const spaces = await repo.getAllSpaces();

      const itemInChannelOnly: FeedItem = FeedItemSchema.parse({
        ...REAL_KNOWLEDGE_VAULT[0],
        id: 'item-nische-1',
        title: 'Nischen Spezialartikel',
        feedText: 'Nur für Nischen-Liebhaber',
        space: channelOnlySpace.handle
      });

      const itemInNormal: FeedItem = FeedItemSchema.parse({
        ...REAL_KNOWLEDGE_VAULT[0],
        id: 'item-normal-1',
        title: 'Hauptstrom Artikel',
        feedText: 'Für alle Leser',
        space: normalSpace.handle
      });

      // General feed filter simulation ('all')
      const filterAll = (item: FeedItem) => {
        const itemSpace = resolveItemSpaceHandle(item);
        if (itemSpace) {
          const space = spaces.find(s => canonicalSpaceHandle(s.handle) === itemSpace);
          if (space?.feedPriority === 'channel_only') {
            return false;
          }
        }
        return true;
      };

      assert.equal(filterAll(itemInChannelOnly), false, 'channel_only item must not appear in general feed');
      assert.equal(filterAll(itemInNormal), true, 'normal item must appear in general feed');

      // Channel-specific view simulation ('c/nischen_archiv')
      const targetHandle = canonicalSpaceHandle(channelOnlySpace.handle);
      const filterChannel = (item: FeedItem) => resolveItemSpaceHandle(item) === targetHandle;

      assert.equal(filterChannel(itemInChannelOnly), true, 'channel_only item MUST appear inside its own channel');
      assert.equal(filterChannel(itemInNormal), false, 'normal item must not appear inside unrelated channel');
    });
  });
});
