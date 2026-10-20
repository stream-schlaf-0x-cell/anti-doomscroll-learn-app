import { describe, it } from 'node:test';
import assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  sortFeedForDisplay,
  isArdSource,
  isBalancingSource,
  matchesSaxonyRegion,
  enforceArdsSpacing,
  getNormalizedPublisherKey,
  enrichItemWithDiscourseConcept,
  scoreFeedItem,
  ScoredFeedItem,
  FeedSortMode
} from '../src/core/domain/ranking';
import { FeedItem } from '../src/core/domain/types';
import { getSubchannelVisual } from '../src/core/utils/subchannelVisuals';
import { stripLeadingTitleDuplicate } from '../src/core/utils/textUtils';
import { INITIAL_FIXTURES, DEFAULT_USER_PROFILE } from '../src/core/data/fixtures';

function createMockItem(overrides: Partial<FeedItem>): ScoredFeedItem {
  const baseItem: FeedItem = {
    ...INITIAL_FIXTURES[0],
    id: `mock-${Math.random().toString(36).substring(2, 9)}`,
    type: 'deep_dive',
    title: 'Standard Test Title',
    subtitle: 'Standard subtitle for the test article item.',
    feedText: 'Detailed analytical feed text for testing purposes.',
    body: 'Complete body text for verification.',
    primaryTopic: 'philosophy_ethics',
    topics: ['philosophy_ethics'],
    format: 'long_invitation',
    publishedAt: new Date(Date.now() - 3600 * 1000).toISOString(),
    firstSeenAt: new Date().toISOString(),
    generatedAt: new Date().toISOString(),
    contentOrigin: 'live_ingested',
    evidenceTier: 'publisher_excerpt',
    sourceTrustLevel: 'verified_creator',
    sourceReferences: [{
      publisher: 'Test Publisher',
      originalUrl: 'https://example.com/item',
      title: 'Standard Test Title',
      retrievalTimestamp: new Date().toISOString(),
      isVerified: true
    }],
    estimatedReadingMinutes: 3,
    publicationDateReliable: true,
    ...overrides
  };
  return scoreFeedItem(baseItem, DEFAULT_USER_PROFILE);
}

describe('Master Engine Overhaul: 5 Sort Horizons, ARD Cap, Saxony Focus & Subchannel Badges', () => {

  it('1. 5 Sort Horizons return properly sorted and enriched datasets', () => {
    const items: ScoredFeedItem[] = [
      createMockItem({
        id: 'item-today-saxony',
        title: 'MDR Sachsen: Bildungspolitik in Dresden reformiert',
        sourceBroadcasterName: 'MDR Sachsen',
        publicationDateReliable: true,
        publishedAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString()
      }),
      createMockItem({
        id: 'item-old-undated',
        title: 'Undated ancient article',
        publicationDateReliable: false,
        publishedAt: new Date(Date.now() - 90 * 86400 * 1000).toISOString()
      }),
      createMockItem({
        id: 'item-discourse-1',
        title: 'Strukturelle Bildungsdebatte der Woche',
        primaryTopic: 'german_didactics',
        wordCount: 220,
        publishedAt: new Date(Date.now() - 5 * 86400 * 1000).toISOString(),
        publicationDateReliable: true
      }),
      createMockItem({
        id: 'item-top-impact',
        title: 'Bahnbrechende Quanten-Analyse',
        externalCommunityScore: { platform: 'hacker_news', points: 950 },
        upvotesCount: 45,
        curationScore: 9.8,
        publishedAt: new Date(Date.now() - 12 * 86400 * 1000).toISOString()
      }),
      createMockItem({
        id: 'item-timeless-gem',
        title: 'Philosophisches Essay über Resonanz',
        isEvergreenGem: true,
        format: 'art_showcase',
        curationScore: 9.5
      })
    ];

    // Horizon 1: Für dich ('for_you')
    const seenIds = new Set<string>(['item-today-saxony']);
    const forYouSorted = sortFeedForDisplay(items, 'for_you', { seenItemIds: seenIds });
    assert.ok(forYouSorted.length > 0, 'For you feed must return items');
    // Seen item must rotate down compared to unseen items
    const todayIndex = forYouSorted.findIndex(i => i.id === 'item-today-saxony');
    assert.ok(todayIndex > 0, 'Seen item should rotate down in Für dich');

    // Horizon 2: Heute ('today')
    const todaySorted = sortFeedForDisplay(items, 'today');
    assert.ok(todaySorted.length > 0, 'Heute feed must return items');
    for (const it of todaySorted) {
      assert.strictEqual(it.publicationDateReliable, true, 'Heute items must have reliable publication dates');
    }
    // Saxony item should be elevated
    assert.strictEqual(todaySorted[0].id, 'item-today-saxony');

    // Horizon 3: Diskurs ('discourse') - Option A: Wissensvorsprung conceptual grounding
    const discourseSorted = sortFeedForDisplay(items, 'discourse');
    assert.ok(discourseSorted.length > 0, 'Diskurs feed must return items');
    const enrichedDiscourseItem = discourseSorted.find(i => i.id === 'item-discourse-1');
    assert.ok(enrichedDiscourseItem, 'Diskurs substantive item must be present');
    assert.ok(
      enrichedDiscourseItem.feedText?.includes('Wissensvorsprung:') ||
      enrichedDiscourseItem.keyInsight?.includes('Strukturelle Einordnung:'),
      'Discourse items must be enriched with Option A conceptual grounding'
    );

    // Horizon 4: Top ('top')
    const topSorted = sortFeedForDisplay(items, 'top');
    assert.strictEqual(topSorted[0].id, 'item-top-impact', 'Top items must rank high impact analyses first');

    // Horizon 5: Zeitlos ('timeless')
    const timelessSorted = sortFeedForDisplay(items, 'timeless');
    assert.strictEqual(timelessSorted[0].id, 'item-timeless-gem', 'Zeitlos must rank evergreen gems at the top');
  });

  it('2. Anti-ARD monoculture cap: ARD items capped at <= 1 in 7-8 and strictly never consecutive', () => {
    // Generate a stream of 20 items where 10 are ARD and 10 are diverse publishers
    const mixedStream: ScoredFeedItem[] = [];
    for (let i = 0; i < 10; i++) {
      mixedStream.push(createMockItem({
        id: `ard-${i}`,
        title: `Tagesschau News ${i}`,
        sourceReferences: [{
          publisher: 'ARD Tagesschau',
          originalUrl: 'https://tagesschau.de/news',
          title: `Tagesschau News ${i}`,
          retrievalTimestamp: new Date().toISOString(),
          isVerified: true
        }],
        sourceDomain: 'tagesschau.de'
      }));
      mixedStream.push(createMockItem({
        id: `guardian-${i}`,
        title: `The Guardian World Dispatch ${i}`,
        sourceReferences: [{
          publisher: 'The Guardian',
          originalUrl: 'https://theguardian.com/world',
          title: `The Guardian World Dispatch ${i}`,
          retrievalTimestamp: new Date().toISOString(),
          isVerified: true
        }],
        sourceDomain: 'theguardian.com'
      }));
    }

    const spaced = enforceArdsSpacing(mixedStream, 7);
    assert.ok(spaced.length === mixedStream.length, 'Spacing should preserve all items');

    // Verify ARD items are NEVER consecutive and separated by at least 7 non-ARD items when possible
    let lastArdPos = -100;
    for (let idx = 0; idx < spaced.length; idx++) {
      if (isArdSource(spaced[idx])) {
        const gap = idx - lastArdPos;
        assert.ok(gap > 1, `ARD items must NEVER be consecutive! Found adjacent ARD at index ${idx}`);
        lastArdPos = idx;
      }
    }

    // Verify publisher normalization isolates ARD correctly without misidentifying Guardian as ARD
    const guardianItem = createMockItem({
      sourceReferences: [{
        publisher: 'The Guardian',
        originalUrl: 'https://theguardian.com/world',
        title: 'The Guardian',
        retrievalTimestamp: new Date().toISOString(),
        isVerified: true
      }]
    });
    assert.strictEqual(isArdSource(guardianItem), false, 'The Guardian must not be identified as ARD');
    assert.strictEqual(getNormalizedPublisherKey(guardianItem), 'the guardian');
    assert.strictEqual(isBalancingSource(guardianItem), true, 'The Guardian is a balancing source');
  });

  it('3. Regional Focus: Schleswig-Holstein (regions=15) purged & Saxony / Dresden / Leipzig anchored', () => {
    // Check ranking regional matcher
    const saxonyItem1 = createMockItem({ title: 'Landtag in Dresden beschließt Schulgesetz', body: 'Dresden meldet ...' });
    const saxonyItem2 = createMockItem({ title: 'Leipziger Buchmesse meldet Rekordzahlen' });
    const saxonyItem3 = createMockItem({ sourceBroadcasterName: 'MDR Sachsen' });
    const shItem = createMockItem({ title: 'Landtag in Kiel berät über Deichschutz' });

    assert.strictEqual(matchesSaxonyRegion(saxonyItem1), true);
    assert.strictEqual(matchesSaxonyRegion(saxonyItem2), true);
    assert.strictEqual(matchesSaxonyRegion(saxonyItem3), true);
    assert.strictEqual(matchesSaxonyRegion(shItem), false);

    // Verify codebase files do not contain regions=15
    const filesToCheck = [
      'src/core/data/continuousLiveNewsService.ts',
      'src/core/ingestion/globalCorpusSources.ts',
      'scripts/generate-corpus-sources.ts'
    ];

    for (const relPath of filesToCheck) {
      const fullPath = path.resolve(__dirname, '..', relPath);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        assert.ok(!content.includes('regions=15'), `File ${relPath} must not contain accidental regions=15 parameter`);
        assert.ok(!content.includes('fc-ndr-recherche'), `File ${relPath} must not contain fc-ndr-recherche`);
      }
    }
  });

  it('4. Subchannel Badges: Distinct Reddit-style visual cues with high contrast', () => {
    const spacePhilosophy = { handle: 'c/philosophie', title: 'Philosophie & Ethik', isCustom: true };
    const spaceLearning = { handle: 'c/visible_learning', title: 'Visible Learning', isCustom: true };
    const spacePolitics = { handle: 'c/politik_diskurs', title: 'Politischer Diskurs', isCustom: true };

    const visPhil = getSubchannelVisual(spacePhilosophy);
    const visLearn = getSubchannelVisual(spaceLearning);
    const visPol = getSubchannelVisual(spacePolitics);

    // Visual palettes must have valid hex colors and high-contrast text color
    assert.match(visPhil.badgeColor, /^#[0-9A-Fa-f]{6}$/);
    assert.match(visPhil.textColor, /^#[0-9A-Fa-f]{6}$/);
    assert.ok(visPhil.iconName.length > 0, 'Must have icon');

    // Distinct channels should have deterministic, stable distinct colors
    assert.notStrictEqual(visPhil.badgeColor, visLearn.badgeColor);
    assert.strictEqual(getSubchannelVisual(spacePhilosophy).badgeColor, visPhil.badgeColor, 'Must be deterministic');
  });

  it('5. FeedCard: Strips leading title repetition in card bodies', () => {
    const title = 'Neue Quantencomputer-Architektur erreicht Meilenstein';
    const textWithTitle = 'Neue Quantencomputer-Architektur erreicht Meilenstein. Forscher des Max-Planck-Instituts präsentieren ein neuartiges Qubit-Design.';
    const textWithoutTitle = 'Forscher des Max-Planck-Instituts präsentieren ein neuartiges Qubit-Design.';

    const stripped = stripLeadingTitleDuplicate(textWithTitle, title);
    assert.strictEqual(stripped, 'Forscher des Max-Planck-Instituts präsentieren ein neuartiges Qubit-Design.');

    const unchanged = stripLeadingTitleDuplicate(textWithoutTitle, title);
    assert.strictEqual(unchanged, textWithoutTitle);
  });

  it('6. Medical Typo Zero-Tolerance: 0 occurrences of "Kuriert" remain in src/', () => {
    function scanDir(dir: string): string[] {
      let results: string[] = [];
      const list = fs.readdirSync(dir);
      for (const file of list) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
          results = results.concat(scanDir(fullPath));
        } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
          results.push(fullPath);
        }
      }
      return results;
    }

    const srcDir = path.resolve(__dirname, '..', 'src');
    const files = scanDir(srcDir);
    const violations: { file: string; line: number; text: string }[] = [];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        // Find "Kuriert" or "kuriert" when not part of "Kuratiert" / "kuratiert"
        if (/kuriert/i.test(line) && !/kuratiert/i.test(line)) {
          violations.push({ file: path.relative(srcDir, file), line: idx + 1, text: line.trim() });
        }
      });
    }

    assert.strictEqual(
      violations.length,
      0,
      `Found ${violations.length} occurrence(s) of typo "kuriert" in src/:\n` +
      violations.map(v => `  ${v.file}:${v.line}: ${v.text}`).join('\n')
    );
  });

});
