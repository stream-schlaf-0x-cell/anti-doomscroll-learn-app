import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { stripMarkdownFormatting } from '../src/core/utils/markdownUtils';
import { extractSalientConcepts, RabbitHoleService } from '../src/core/synthesis/rabbitHoleService';
import { synthesizeEditorialAbstract } from '../src/core/synthesis/backgroundResearchPipeline';
import { FeedItem } from '../src/core/domain/types';

describe('Markdown Readability & Rabbit Hole Intelligence', () => {
  const bauhausItem: FeedItem = {
    id: 'test-bauhaus-dessau-1926',
    type: 'deep_dive',
    format: 'art_showcase',
    title: 'Bauhaus Dessau: Die transparente Vorhangfassade und das Licht der Vernunft',
    subtitle: 'Walter Gropius (1926) • Stiftung Bauhaus Dessau • Klassische Moderne',
    feedText: 'Als Walter Gropius das Werkstattgebäude des Bauhauses in Dessau entwarf, schuf er das Manifest einer neuen Zeit.',
    body: 'Als Walter Gropius das Werkstattgebäude des Bauhauses in Dessau entwarf, schuf er das Manifest einer neuen Zeit.',
    articleBody: `### Die Entmaterialisierung der Architektur\n\nAls Walter Gropius das Werkstattgebäude des Bauhauses in Dessau entwarf, schuf er das Manifest einer neuen Zeit.\n\n#### 1. Die Curtain Wall (Vorhangfassade)\nIndem die tragenden Stahlbetonstützen nach innen gerückt wurden, konnte die Außenhaut vollständig aus Glas und zierlichen Stahlprofilen konstruiert werden.\n\n#### 2. Demokratie aus Licht und Raum\nGropius wollte keine Paläste für Fürsten bauen, sondern lichtdurchflutete Werkstätten für Handwerker und Gestalter.`,
    topics: ['art_aesthetics'],
    primaryTopic: 'art_aesthetics',
    sourceReferences: [
      {
        publisher: 'Stiftung Bauhaus Dessau',
        originalUrl: 'https://www.bauhaus-dessau.de/de/architektur/bauhausgebaeude.html',
        title: 'Das Bauhausgebäude in Dessau',
        publicationTimestamp: '1926-01-01T00:00:00.000Z',
        retrievalTimestamp: new Date().toISOString(),
        author: 'Walter Gropius',
        isVerified: true
      }
    ],
    artMeta: {
      artist: 'Walter Gropius',
      year: '1926',
      medium: 'Architektur (Stahl, Glas, Beton)',
      styleMovement: 'Klassische Moderne / Neues Bauen',
      museum: 'Bauhaus Dessau / Stiftung Bauhaus',
      highResImageUrl: 'https://upload.wikimedia.org/wikipedia/commons/3/30/Bauhaus_Dessau_Werkstattfluegel_2012.jpg',
      aestheticImpulse: 'Funktion und Klarheit'
    },
    publishedAt: '1926-01-01T00:00:00.000Z',
    generatedAt: new Date().toISOString(),
    estimatedReadingMinutes: 4,
    relevanceExplanation: 'Meilenstein der modernen Architektur und des integralen Gestaltungsbegriffs.',
    contentStatus: 'editorial_briefing',
    isDailyEdition: false,
    editionDate: '2026-10-17',
    isDemonstration: false,
    aiAssisted: false,
    factReviewStatus: 'historical_reference',
    provenanceSummary: 'Stiftung Bauhaus Dessau Archiv',
    wordCount: 380,
    evidenceTier: 'permitted_full_text',
    contentOrigin: 'demo_fixture',
    contentHash: 'hash-bauhaus-1926',
    canonicalUrl: 'https://www.bauhaus-dessau.de/de/architektur/bauhausgebaeude.html',
    space: 'c/kunst_galerie',
    flair: 'Baukunst & Moderne',
    keyInsight: 'Die Curtain Wall entmaterialisiert die Fassade und macht Licht zum demokratischen Baustoff.',
    upvotesCount: 0,
    awardsCount: { gold: 0, brain: 0, spark: 0 },
    sourceTrustLevel: 'museum_collection',
    isTeachingRelated: false,
    isChallengingPerspective: false,
    comments: []
  };

  it('1. Strips raw markdown tokens cleanly from text', () => {
    const raw = '### Die Entmaterialisierung der Architektur\n\n**Walter Gropius** baute `Curtain Wall` mit *Glas* und Stahl.';
    const cleaned = stripMarkdownFormatting(raw);
    assert.ok(!cleaned.includes('###'));
    assert.ok(!cleaned.includes('**'));
    assert.ok(!cleaned.includes('`'));
    assert.ok(!cleaned.includes('*'));
    assert.ok(cleaned.includes('Die Entmaterialisierung der Architektur'));
    assert.ok(cleaned.includes('Walter Gropius baute Curtain Wall mit Glas und Stahl.'));
  });

  it('2. synthesizeEditorialAbstract removes raw markdown hashes from overview and key findings', () => {
    const abstract = synthesizeEditorialAbstract(bauhausItem);
    assert.ok(!abstract.overview.startsWith('###'), 'Overview must not start with ###');
    assert.ok(!abstract.keyFinding.startsWith('####'), 'Key finding must not start with ####');
    assert.ok(abstract.overview.length > 20);
    assert.ok(abstract.keyFinding.length > 20);
  });

  it('3. Extracts salient concepts accurately from item (creator, movement, salient keywords)', () => {
    const concepts = extractSalientConcepts(bauhausItem);
    assert.ok(concepts.includes('Walter Gropius'), 'Should extract creator name');
    assert.ok(concepts.includes('Klassische Moderne / Neues Bauen') || concepts.some(c => c.includes('Moderne')), 'Should extract artistic movement');
    assert.ok(concepts.some(c => c.toLowerCase().includes('bauhaus') || c.toLowerCase().includes('vorhangfassade')), 'Should extract key architectural terms');
  });

  it('4. RabbitHoleService discovers conceptually linked companion reads without throwing', async () => {
    const rabbitHole = await RabbitHoleService.discoverRabbitHole(bauhausItem, { maxItems: 3, allowLiveResearch: false });
    assert.ok(Array.isArray(rabbitHole));
    assert.ok(rabbitHole.every(r => r.item.id !== bauhausItem.id), 'Must not recommend the same article to itself');
    for (const entry of rabbitHole) {
      assert.ok(entry.conceptPill.length > 0, 'Every entry must have a conceptual hook');
      assert.ok(entry.relevanceReason.length > 0, 'Every entry must explain why it is relevant');
    }
  });
});
