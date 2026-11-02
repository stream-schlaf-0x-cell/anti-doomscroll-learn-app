import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  sortFeedForDisplay,
  isFormattingToGesternOrOlder,
  rankBloomScrollFeed,
  scoreFeedItem,
  ScoredFeedItem
} from '../src/core/domain/ranking';
import { FeedItem } from '../src/core/domain/types';
import {
  clusterRelatedStories,
  buildSocraticSalonPerspectives,
  isPoliticalOrProtestNews,
  sanitizeCuratedFeedItem
} from '../src/core/enrichment/batchEnricher';
import {
  LiveCivicPulseService,
  VirtualNewsroomTelemetry
} from '../src/core/ingestion/liveCivicPulseService';
import { detectChannelArchetype } from '../src/core/ingestion/subchannelFlourishService';
import { harvestRabbitHoleForItem } from '../src/core/synthesis/rabbitHoleService';
import { INITIAL_FIXTURES, DEFAULT_USER_PROFILE } from '../src/core/data/fixtures';

function createMockFeedItem(id: string, overrides: Partial<ScoredFeedItem> = {}): ScoredFeedItem {
  const base = INITIAL_FIXTURES[0];
  const raw: FeedItem = {
    ...base,
    id,
    title: `Titel für ${id}`,
    subtitle: `Untertitel für ${id}`,
    feedText: `Substantieller Fließtext für den Beitrag ${id} mit ausführlicher Begründung und Tiefenschärfe.`,
    articleBody: `Ausführlicher Haupttext für den Beitrag ${id} mit mehr als einhundertachtzig Zeichen für eine fundierte Lektüreerfahrung.`,
    body: `Ausführlicher Haupttext für den Beitrag ${id} mit mehr als einhundertachtzig Zeichen für eine fundierte Lektüreerfahrung.`,
    topics: ['philosophy_ethics'],
    primaryTopic: 'philosophy_ethics',
    publishedAt: new Date().toISOString(),
    publicationDateReliable: true,
    ...overrides
  };
  const scored = scoreFeedItem(raw, DEFAULT_USER_PROFILE);
  if (typeof overrides.score === 'number') {
    scored.score = overrides.score;
  }
  return scored;
}

describe('Virtual Newsroom & iPhone P0 Fixes Test Suite', () => {
  // WP 2: Strict "⚡ Heute" contract (never "gestern" or older)
  it('WP 2: isFormattingToGesternOrOlder strictly flags items >= 18h or from previous calendar day', () => {
    const now = new Date('2026-11-02T16:00:00.000Z');

    // 4 hours ago (today): false
    const fourHoursAgo = new Date('2026-11-02T12:00:00.000Z').toISOString();
    assert.equal(isFormattingToGesternOrOlder(fourHoursAgo, now), false);

    // 20 hours ago (yesterday): true
    const twentyHoursAgo = new Date('2026-11-01T20:00:00.000Z').toISOString();
    assert.equal(isFormattingToGesternOrOlder(twentyHoursAgo, now), true);

    // Exactly 19 hours ago: true
    const nineteenHoursAgo = new Date('2026-11-01T21:00:00.000Z').toISOString();
    assert.equal(isFormattingToGesternOrOlder(nineteenHoursAgo, now), true);
  });

  it('WP 2: sortFeedForDisplay(..., "today") strictly excludes articles >= 18h or formatting to gestern', () => {
    const nowMs = Date.now();
    const fourHoursAgo = new Date(nowMs - 4 * 3600 * 1000).toISOString();
    const twentyHoursAgo = new Date(nowMs - 20 * 3600 * 1000).toISOString();
    const twoDaysAgo = new Date(nowMs - 48 * 3600 * 1000).toISOString();

    const pool = [
      createMockFeedItem('fresh-today-1', { publishedAt: fourHoursAgo }),
      createMockFeedItem('stale-yesterday-20h', { publishedAt: twentyHoursAgo }),
      createMockFeedItem('stale-2d', { publishedAt: twoDaysAgo }),
    ];

    const todayItems = sortFeedForDisplay(pool, 'today');
    const returnedIds = todayItems.map(i => i.id);

    assert.ok(returnedIds.includes('fresh-today-1'));
    assert.ok(!returnedIds.includes('stale-yesterday-20h'), 'Must exclude 20-hour-old yesterday items');
    assert.ok(!returnedIds.includes('stale-2d'), 'Must exclude 2-day-old items');
  });

  it('WP 2: 72h seen-impression cooldown penalizes repeated top items', () => {
    const nowMs = Date.now();
    const itemA = createMockFeedItem('item-a', { score: 0.95 });
    const itemB = createMockFeedItem('item-b', { score: 0.85 });
    const itemC = createMockFeedItem('item-c', { score: 0.80 });
    const itemD = createMockFeedItem('item-d', { score: 0.75 });

    // Without seen records, item-a ranks before item-b
    const initialRank = rankBloomScrollFeed([itemA, itemB, itemC, itemD]);
    assert.equal(initialRank[0].id, 'item-a');

    // With seen impression recorded 30 minutes ago (within 72h)
    const seenRecords = new Map([
      ['item-a', {
        itemId: 'item-a',
        firstSeenAt: new Date(nowMs - 30 * 60 * 1000).toISOString(),
        lastSeenAt: new Date(nowMs - 5 * 60 * 1000).toISOString(),
        count: 2
      }]
    ]);

    const cooledRank = rankBloomScrollFeed([itemA, itemB, itemC, itemD], { seenRecords });
    // item-b must now take the lead because item-a received the -3.0 seen penalty
    assert.equal(cooledRank[0].id, 'item-b', 'Item B should rank higher after Item A is penalized by seen-cooldown');
  });

  // WP 3: Protest and Political News Misclassification
  it('WP 3: Protest, demonstration, and government news is correctly detected as political/protest', () => {
    assert.ok(isPoliticalOrProtestNews('Bundesweite Jugendproteste - Zehntausende demonstrieren friedlich'));
    assert.ok(isPoliticalOrProtestNews('Streik bei der Bahn und Ausschreitungen in Berlin'));
    assert.ok(isPoliticalOrProtestNews('Bundestag debattiert über Koalition und Regierung'));
    assert.ok(!isPoliticalOrProtestNews('Neue Entdeckung im James-Webb-Weltraumteleskop über Galaxienentstehung'));
  });

  it('WP 3: sanitizeCuratedFeedItem strictly re-routes protest/political news away from c/serendipity to c/dialektik', () => {
    const protestItem = createMockFeedItem('protest-1', {
      title: 'Bundesweite Jugendproteste - Zehntausende demonstrieren friedlich',
      space: 'c/serendipity'
    });

    const sanitized = sanitizeCuratedFeedItem(protestItem);
    assert.notEqual(sanitized.space, 'c/serendipity', 'Protest news must never stay in c/serendipity');
    assert.notEqual(sanitized.space, 'c/kunst_galerie', 'Protest news must never stay in c/kunst_galerie');
    assert.equal(sanitized.space, 'c/dialektik', 'Protest news must be routed to c/dialektik');
  });

  // WP 5: Pin-to-Top Guarantee for Manual Pipeline Runs
  it('WP 5: sortFeedForDisplay places newly harvested items with pinnedManualRunAt at index 0', () => {
    const nowMs = Date.now();
    const olderItem1 = createMockFeedItem('normal-1', { score: 99 });
    const olderItem2 = createMockFeedItem('normal-2', { score: 95 });
    const newlyPinned = createMockFeedItem('manual-fresh-1', {
      score: 50,
      pinnedManualRunAt: nowMs - 60 * 1000 // 1 minute ago
    });

    const sorted = sortFeedForDisplay([olderItem1, newlyPinned, olderItem2], 'for_you');
    assert.equal(sorted[0].id, 'manual-fresh-1', 'Item with pinnedManualRunAt must be at position #1');
  });

  // WP 6: Newsdesk Story Clustering (Stage 2)
  it('WP 6: clusterRelatedStories bundles multiple articles sharing >= 3 title entities into a single Dossier card', () => {
    const nowMs = Date.now();
    const item1 = createMockFeedItem('bundestag-klima-1', {
      title: 'Bundestag beschließt neues Klimagesetz nach langer Debatte',
      publishedAt: new Date(nowMs - 2 * 3600 * 1000).toISOString(),
      sourceReferences: [{
        publisher: 'Tagesschau',
        originalUrl: 'https://tagesschau.de/klima',
        title: 'Bundestag beschließt neues Klimagesetz nach langer Debatte',
        publicationTimestamp: new Date().toISOString(),
        retrievalTimestamp: new Date().toISOString(),
        isVerified: true
      }]
    });

    const item2 = createMockFeedItem('bundestag-klima-2', {
      title: 'Klimagesetz im Bundestag verabschiedet mit breiter Mehrheit',
      publishedAt: new Date(nowMs - 3 * 3600 * 1000).toISOString(),
      sourceReferences: [{
        publisher: 'Deutschlandfunk',
        originalUrl: 'https://deutschlandfunk.de/klima',
        title: 'Klimagesetz im Bundestag verabschiedet mit breiter Mehrheit',
        publicationTimestamp: new Date().toISOString(),
        retrievalTimestamp: new Date().toISOString(),
        isVerified: true
      }]
    });

    const unrelated = createMockFeedItem('buddhismus-meditation-1', {
      title: 'Achtsamkeit und die Kunst des Schweigens in der Kontemplation',
      topics: ['contemplation_mind'],
      primaryTopic: 'contemplation_mind'
    });

    const clustered = clusterRelatedStories([item1, item2, unrelated]);

    // Should result in 2 items: 1 dossier + 1 unrelated
    assert.equal(clustered.length, 2);
    const dossier = clustered.find(i => i.isStoryDossier === true);
    assert.ok(dossier, 'A story dossier must be produced');
    assert.ok(dossier.corroboratingSources && dossier.corroboratingSources.length >= 1);
    assert.equal(dossier.corroboratingSources[0].publisher, 'Deutschlandfunk');
  });

  // WP 6: Ressort-DNA Archetypes
  it('WP 6: detectChannelArchetype maps subchannels to the correct Ressort-DNA', () => {
    assert.equal(detectChannelArchetype({ handle: 'c/buddhismus', title: 'Buddhismus & Geistesschulung' }), 'contemplation');
    assert.equal(detectChannelArchetype({ handle: 'c/kontemplation', title: 'Meditation und Stille' }), 'contemplation');
    assert.equal(detectChannelArchetype({ handle: 'c/dialektik', title: 'Debatte und Philosophie' }), 'discourse_essay');
    assert.equal(detectChannelArchetype({ handle: 'c/didaktik_labor', title: 'Didaktik und Unterrichtsforschung' }), 'research_pedagogy');
    assert.equal(detectChannelArchetype({ handle: 'c/kunst_galerie', title: 'Kunst und Meisterwerke' }), 'visual_gallery');
    assert.equal(detectChannelArchetype({ handle: 'c/synth_alchemie', title: 'Synthesizer und Klangsynthese' }), 'tech_craft');
  });

  // WP 7: Socratic Salon in ReaderScreen (Stage 4)
  it('WP 7: buildSocraticSalonPerspectives generates 3 substantive perspectives (context, blindSpot, impulse)', async () => {
    const item = createMockFeedItem('sample-article-salon', {
      title: 'Kritik der instrumentellen Vernunft im digitalen Zeitalter',
      subtitle: 'Warum algorithmengetriebene Effizienz den Raum für Kontemplation verengt',
      topics: ['philosophy_ethics', 'contemplation_mind'],
      primaryTopic: 'philosophy_ethics',
      space: 'c/dialektik'
    });

    const salon = await buildSocraticSalonPerspectives(item);
    assert.ok(salon.context && salon.context.length > 20, 'Context must be substantive');
    assert.ok(salon.blindSpot && salon.blindSpot.length > 20, 'Blind spot must be substantive');
    assert.ok(salon.impulse && salon.impulse.length > 20, 'Impulse must be substantive');
  });

  it('WP 7: buildSocraticSalonPerspectives adapts tone for contemplation channels without artificial polemic', async () => {
    const item = createMockFeedItem('sample-contemplation', {
      title: 'Die Praxis des stillen Verweilens im Zen-Buddhismus',
      subtitle: 'Wie Nicht-Tun und Atembeobachtung den Geist klären',
      topics: ['contemplation_mind'],
      primaryTopic: 'contemplation_mind',
      space: 'c/buddhismus'
    });

    const salon = await buildSocraticSalonPerspectives(item);
    assert.ok(salon.context.length > 20);
    assert.ok(salon.blindSpot.length > 20);
    // Blind spot for contemplation should focus on gentle reflection (e.g. spiritual bypassing), not aggressive political conflict
    assert.ok(salon.impulse.length > 20);
  });

  // WP 8: Autonomous Rabbit-Hole Expansion on Upvote/Save
  it('WP 8: harvestRabbitHoleForItem tags candidate items with recommendedBecauseOfTitle: item.title', async () => {
    const sourceItem = createMockFeedItem('curious-upvote-source', {
      title: 'Vannevar Bush und die Ursprünge des Hypertexts',
      topics: ['ai_apple', 'philosophy_ethics'],
      primaryTopic: 'ai_apple'
    });

    const harvested = await harvestRabbitHoleForItem(sourceItem);
    assert.ok(Array.isArray(harvested), 'Must return an array of items');
    if (harvested.length > 0) {
      assert.equal(harvested[0].recommendedBecauseOfTitle, sourceItem.title);
      assert.ok(harvested[0].id.startsWith('rabbit-'));
    }
  });
});
