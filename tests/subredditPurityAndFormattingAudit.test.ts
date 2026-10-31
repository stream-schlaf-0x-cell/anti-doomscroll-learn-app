import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import {
  detectChannelArchetype,
  SubchannelFlourishService
} from '../src/core/ingestion/subchannelFlourishService';
import {
  cleanArticleBodyFormatting,
  stripAiSlopPhrases,
  isDomesticPartyPolitics,
  isCelebrityFluff,
  evaluateSignalVsNoiseDeterministically,
  sanitizeCuratedFeedItem
} from '../src/core/enrichment/batchEnricher';
import {
  canonicalSpaceHandle,
  resolveItemSpaceHandle,
  DEFAULT_SUBCHANNELS
} from '../src/core/spaces/spaceRepository';
import {
  sortFeedForDisplay,
  ScoredFeedItem
} from '../src/core/domain/ranking';
import { FeedItem, FeedItemSchema } from '../src/core/domain/types';
import { REAL_KNOWLEDGE_VAULT } from '../src/core/data/realKnowledgeVault';

describe('Subreddit Purity, Visual Art Gallery & Formatting Sanitizer Audit', () => {
  it('1. Universal Archetype Detection classifies channels systematically', () => {
    // Visual gallery
    assert.equal(detectChannelArchetype('c/kunst_galerie'), 'visual_gallery');
    assert.equal(detectChannelArchetype({ handle: 'c/bauhaus_architektur', title: 'Architektur & Bauhaus' }), 'visual_gallery');
    assert.equal(detectChannelArchetype({ handle: 'c/street_photo', primaryTopic: 'art_aesthetics' }), 'visual_gallery');
    assert.equal(detectChannelArchetype('c/memes'), 'visual_gallery');

    // Tech & Craft
    assert.equal(detectChannelArchetype('c/acceleration'), 'tech_craft');
    assert.equal(detectChannelArchetype('c/synth_alchemie'), 'tech_craft');
    assert.equal(detectChannelArchetype({ handle: 'c/rust_systems', title: 'Rust & Systems Programming' }), 'tech_craft');

    // Research & Pedagogy
    assert.equal(detectChannelArchetype('c/visible_learning'), 'research_pedagogy');
    assert.equal(detectChannelArchetype('c/didaktik_labor'), 'research_pedagogy');
    assert.equal(detectChannelArchetype('c/health_longevity'), 'research_pedagogy');

    // Discourse & Philosophy
    assert.equal(detectChannelArchetype('c/dialektik'), 'discourse_essay');
    assert.equal(detectChannelArchetype('c/books'), 'discourse_essay');
    assert.equal(detectChannelArchetype('c/kontemplation'), 'discourse_essay');
  });

  it('2. Legacy typo c/visivle_learning automatically resolves to c/visible_learning', () => {
    assert.equal(canonicalSpaceHandle('c/visivle_learning'), 'c/visible_learning');
    assert.equal(canonicalSpaceHandle('visivle_learning'), 'c/visible_learning');
    assert.equal(detectChannelArchetype('c/visivle_learning'), 'research_pedagogy');
  });

  it('3. RSS Formatting Sanitizer cleans raw Kampfplatz Berlin artifacts', () => {
    const rawSnippet =
      'Kampfplatz Berlin: Die dämonisierte Linkskoalition als Türöffner für die AfD\n' +
      'Blätter Redaktion\n' +
      '28. Oktober 2026 - 14:22\n\n' +
      ' \n \n\n \n\n' +
      ' Bild:\n' +
      ' Steffen Krach (SPD), Elif Eralp (Linke) und Werner Graf (Bündnis 90 / Die Grünen) nach Vorgesprächen zur Regierungsbildung, 17.10.2026 (IMAGO / Anadolu Agency)\n' +
      ' \n\n \n\n' +
      ' \n \n\n' +
      'Wahrscheinlich wird es in Berlin nun doch keine Neuauflage von Schwarz-Rot geben.';

    const cleaned = cleanArticleBodyFormatting(
      rawSnippet,
      'Kampfplatz Berlin: Die dämonisierte Linkskoalition als Türöffner für die AfD'
    );

    // Assert duplicate title stripped
    assert.ok(!cleaned.includes('Kampfplatz Berlin: Die dämonisierte Linkskoalition'));
    // Assert byline stripped
    assert.ok(!cleaned.includes('Blätter Redaktion'));
    // Assert date stripped
    assert.ok(!cleaned.includes('28. Oktober 2026'));
    // Assert photo agency caption stripped
    assert.ok(!cleaned.includes('IMAGO / Anadolu Agency'));
    assert.ok(!cleaned.includes('Bild:'));
    assert.ok(!cleaned.includes('Steffen Krach'));
    // Assert clean body prose remains intact
    assert.ok(cleaned.includes('Wahrscheinlich wird es in Berlin'));
    // Assert no excessive newlines
    assert.ok(!cleaned.includes('\n\n\n'));
  });

  it('4. Zero AI-Slop filter strips banned editorial clichés', () => {
    const slopText =
      'In einer Welt, in der Information allgegenwärtig ist, zählt echte Tiefe. ' +
      'Zusammenfassend lässt sich sagen, dass kognitive Reibung Lernen ermöglicht. ' +
      'Tauchen wir ein in die Mechanismen. Dieses faszinierende Phänomen beleuchtet nicht nur ' +
      'die Theorie, sondern auch die Praxis.';

    const unslop = stripAiSlopPhrases(slopText);

    assert.ok(!unslop.includes('In einer Welt'));
    assert.ok(!unslop.includes('Zusammenfassend lässt sich sagen'));
    assert.ok(!unslop.includes('Tauchen wir ein'));
    assert.ok(!unslop.includes('faszinierende'));
    assert.ok(!unslop.includes('nicht nur'));
    assert.ok(unslop.includes('Kognitive Reibung') || unslop.includes('kognitive Reibung'));
  });

  it('5. Topic and Entity Safeguards: Party politics & celebrity fluff routing', () => {
    // Party politics
    const isPolitics = isDomesticPartyPolitics(
      'Kampfplatz Berlin: Koalition zwischen SPD, Linke und Grüne',
      'Regierungsbildung und Wahl'
    );
    assert.equal(isPolitics, true);

    const politicsItem: FeedItem = FeedItemSchema.parse({
      ...REAL_KNOWLEDGE_VAULT[0],
      id: 'test-pol-1',
      title: 'Kampfplatz Berlin: SPD und Linke in Koalitionsverhandlungen',
      feedText: 'Die Regierungsbildung in Berlin sorgt für Debatten im Bundestag.',
      body: 'Die Regierungsbildung in Berlin sorgt für Debatten im Bundestag.',
      topics: ['science_society'],
      primaryTopic: 'science_society',
      space: 'c/serendipity' // misrouted initially
    });

    const sanitizedPolitics = sanitizeCuratedFeedItem(politicsItem);
    // Routed away from c/serendipity to c/gesellschaft_politik
    assert.equal(sanitizedPolitics.space, 'c/gesellschaft_politik');

    // Celebrity birthday fluff
    assert.equal(isCelebrityFluff('Kurt Russell wird 75: Die Hollywood-Ikone im Interview'), true);
    assert.equal(isCelebrityFluff('Schauspieler feiert seinen 70. Geburtstag'), true);
    assert.equal(isCelebrityFluff('Quantenmechanik und Erkenntnistheorie'), false);

    const gateEval = evaluateSignalVsNoiseDeterministically({
      title: 'Kurt Russell wird 75: Hollywood-Star feiert Geburtstag',
      feedText: 'Der Schauspieler blickt auf seine Filmkarriere zurück.'
    });
    assert.equal(gateEval.passed, false);
  });

  it('6. Strict Subchannel Purity: c/kunst_galerie contains 100% visual artworks and zero unrelated items', () => {
    const snapshotPath = path.resolve(__dirname, '../public/feed-snapshot.json');
    assert.ok(fs.existsSync(snapshotPath));
    const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));

    const items: FeedItem[] = snapshot.items || [];
    assert.ok(items.length >= 300, `Expected snapshot to have >= 300 items, got ${items.length}`);

    const galleryItems = items.filter(i => resolveItemSpaceHandle(i) === 'c/kunst_galerie');
    assert.ok(galleryItems.length >= 20, `Expected c/kunst_galerie to have >= 20 items, got ${galleryItems.length}`);

    for (const art of galleryItems) {
      assert.ok(
        art.imageUrl && art.imageUrl.trim().length > 0,
        `Artwork "${art.title}" must have a valid imageUrl`
      );
      assert.ok(
        !art.space || art.space === 'c/kunst_galerie',
        `Artwork "${art.title}" must not belong to another explicit space (got ${art.space})`
      );
    }
  });

  it('7. Disjoint Horizon Tabs produce distinct top-10 sets with < 20% overlap', () => {
    const snapshotPath = path.resolve(__dirname, '../public/feed-snapshot.json');
    const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
    const items: ScoredFeedItem[] = (snapshot.items || []).map((it: FeedItem, idx: number) => ({
      ...it,
      score: 80 - (idx % 20),
      explanation: 'Test item'
    }));

    const topToday = sortFeedForDisplay(items, 'today').slice(0, 10);
    const topDiscourse = sortFeedForDisplay(items, 'discourse').slice(0, 10);
    const topTimeless = sortFeedForDisplay(items, 'timeless').slice(0, 10);

    const todayIds = new Set(topToday.map(i => i.id));
    const discourseIds = new Set(topDiscourse.map(i => i.id));
    const timelessIds = new Set(topTimeless.map(i => i.id));

    // Calculate overlap between today and discourse
    let todayDiscourseOverlap = 0;
    for (const id of discourseIds) {
      if (todayIds.has(id)) todayDiscourseOverlap++;
    }
    // Calculate overlap between today and timeless
    let todayTimelessOverlap = 0;
    for (const id of timelessIds) {
      if (todayIds.has(id)) todayTimelessOverlap++;
    }

    assert.ok(
      todayDiscourseOverlap <= 2,
      `Expected today vs discourse overlap <= 2 (< 20%), got ${todayDiscourseOverlap}`
    );
    assert.ok(
      todayTimelessOverlap <= 2,
      `Expected today vs timeless overlap <= 2 (< 20%), got ${todayTimelessOverlap}`
    );
  });

  it('8. Boot loading screen contains no legacy Tagesausgabe string', () => {
    const appTsx = fs.readFileSync(path.resolve(__dirname, '../App.tsx'), 'utf8');
    assert.ok(!appTsx.includes('Tagesausgabe wird vorbereitet'));
    assert.ok(appTsx.includes('Stream wird kuratiert'));
  });
});
