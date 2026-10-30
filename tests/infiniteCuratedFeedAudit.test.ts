import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { FeedItem } from '../src/core/domain/types';
import {
  scoreFeedItem,
  sortFeedForDisplay,
  enforceCuratedStreamDiversity,
  isArdSource,
  ScoredFeedItem,
} from '../src/core/domain/ranking';
import {
  satisfiesDefaultCuratedStandard,
  sanitizeCuratedFeedItem,
} from '../src/core/enrichment/batchEnricher';
import { DEFAULT_USER_PROFILE, INITIAL_FIXTURES } from '../src/core/data/fixtures';

function createCuratedMockItem(id: string, overrides: Partial<FeedItem> = {}): ScoredFeedItem {
  const domain = overrides.sourceDomain ?? `publisher-${id}.example.org`;
  const publisherName = overrides.sourceBroadcasterName ?? `Publisher ${id}`;
  const url = overrides.canonicalUrl ?? `https://${domain}/artikel-${id}`;

  const raw: FeedItem = {
    ...INITIAL_FIXTURES[0],
    id,
    title: `Analytischer Beitrag ${id}: Strukturwandel und Erkenntnistheorie im digitalen Diskurs`,
    subtitle: 'Eine vertiefte Untersuchung gesellschaftlicher und epistemischer Dynamiken.',
    feedText:
      'In dieser fundierten Analyse wird untersucht, wie sich öffentliche Debattenräume durch algorithmische Kuratierung verändern und welche strukturellen Konsequenzen dies für demokratische Urteilskraft und Bildungspolitik hat.',
    body:
      'In dieser fundierten Analyse wird untersucht, wie sich öffentliche Debattenräume durch algorithmische Kuratierung verändern und welche strukturellen Konsequenzen dies für demokratische Urteilskraft und Bildungspolitik hat. Dabei zeigt sich insbesondere, dass kuratierte Langformate einen nachhaltigeren Beitrag zum Verständnis komplexer gesellschaftlicher Zusammenhänge leisten als isolierte Kurzmeldungen.',
    keyInsight:
      'Kuratierte Langformate fördern strukturelle Urteilskraft und verhindern fragmentierte Informationsüberflutung.',
    canonicalUrl: url,
    sourceDomain: domain,
    sourceBroadcasterName: publisherName,
    sourceReferences: [
      {
        title: `Originalartikel ${id}`,
        publisher: publisherName,
        originalUrl: url,
        retrievalTimestamp: new Date().toISOString(),
        isVerified: true,
      },
    ],
    publishedAt: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
    publicationDateReliable: true,
    curationScore: 8.5,
    topics: ['science_society'],
    primaryTopic: 'science_society',
    ...overrides,
  };

  return scoreFeedItem(raw, DEFAULT_USER_PROFILE);
}

describe('Phase 5: Always-Curated Infinite Bloomscroll & Full Feed Audit Suite', () => {
  it('Test 1 (Zero "Tagesausgaben" & Zero Stop-Wall): FeedScreen contains no daily editions UI or 24-card batch stop wall', () => {
    const feedScreenPath = path.resolve(process.cwd(), 'src/features/feed/FeedScreen.tsx');
    const source = fs.readFileSync(feedScreenPath, 'utf-8');

    const forbiddenStrings = [
      'Tagesausgaben',
      'Tagesausgabe abgeschlossen',
      'Morgenausgabe',
      'Mittagsausgabe',
      'Abendausgabe',
      'Das war deine Auswahl für jetzt',
      '12 weitere anzeigen',
      "activeFeedOption === 'daily'",
      'DAY_EDITIONS_META',
    ];

    for (const forbidden of forbiddenStrings) {
      assert.equal(
        source.includes(forbidden),
        false,
        `Expected FeedScreen.tsx NOT to contain "${forbidden}", but it was found.`
      );
    }

    // Verify continuous infinite scroll replenishment exists in handleScroll
    assert.ok(
      source.includes("void curateNextStreamBatch('scroll')"),
      'Expected handleScroll in FeedScreen.tsx to trigger curateNextStreamBatch("scroll") automatically'
    );
    assert.ok(
      source.includes('prev + 15'),
      'Expected handleScroll in FeedScreen.tsx to smoothly increment visibleInfiniteCount by 15'
    );
  });

  it('Test 2 (Strict "Heute" 48-Hour Contract): sortFeedForDisplay(..., "today") returns 0 articles from Oct 18 and strictly enforces age <= 48h', () => {
    const nowMs = Date.now();
    const sixHoursAgo = new Date(nowMs - 6 * 3600 * 1000).toISOString();
    const twentyHoursAgo = new Date(nowMs - 20 * 3600 * 1000).toISOString();
    const oct18Stale = '2026-10-18T14:30:00.000Z';
    const fiveDaysAgo = new Date(nowMs - 5 * 24 * 3600 * 1000).toISOString();

    const pool: ScoredFeedItem[] = [
      createCuratedMockItem('fresh-1', { publishedAt: sixHoursAgo, publicationDateReliable: true }),
      createCuratedMockItem('fresh-2', { publishedAt: twentyHoursAgo, publicationDateReliable: true }),
      createCuratedMockItem('stale-oct18-1', { publishedAt: oct18Stale, publicationDateReliable: true }),
      createCuratedMockItem('stale-oct18-2', { publishedAt: oct18Stale, publicationDateReliable: true }),
      createCuratedMockItem('stale-5d', { publishedAt: fiveDaysAgo, publicationDateReliable: true }),
      createCuratedMockItem('unreliable-date', { publishedAt: sixHoursAgo, publicationDateReliable: false }),
    ];

    const todayResult = sortFeedForDisplay(pool, 'today');
    const returnedIds = todayResult.map((item) => item.id);

    assert.deepEqual(returnedIds.sort(), ['fresh-1', 'fresh-2']);
    assert.equal(
      todayResult.some((item) => item.publishedAt.startsWith('2026-10-18')),
      false,
      'Heute filter must return 0 articles from 2026-10-18'
    );

    // Even if only 1 fresh article exists, Heute must NEVER fall back to Oct 18 items
    const singleFreshPool = [
      createCuratedMockItem('only-fresh', { publishedAt: sixHoursAgo, publicationDateReliable: true }),
      createCuratedMockItem('stale-oct18-fallback-trap', { publishedAt: oct18Stale, publicationDateReliable: true }),
    ];
    const singleTodayResult = sortFeedForDisplay(singleFreshPool, 'today');
    assert.equal(singleTodayResult.length, 1);
    assert.equal(singleTodayResult[0].id, 'only-fresh');
  });

  it('Test 3 (Always-Curated ARD & Publisher Diversity Cap): enforces <= 10% ARD cap and 4-card domain spacing across all stream views', () => {
    const ardItems: ScoredFeedItem[] = Array.from({ length: 20 }, (_, i) =>
      createCuratedMockItem(`ard-${i + 1}`, {
        curationScore: 9.2,
        canonicalUrl: `https://www.tagesschau.de/inland/meldung-${i + 1}.html`,
        sourceDomain: 'tagesschau.de',
        sourceBroadcasterName: 'tagesschau.de',
      })
    );

    const diverseItems: ScoredFeedItem[] = Array.from({ length: 30 }, (_, i) =>
      createCuratedMockItem(`diverse-${i + 1}`, {
        curationScore: 8.8 - i * 0.03,
        canonicalUrl: `https://journal-${i + 1}.org/essay-${i + 1}`,
        sourceDomain: `journal-${i + 1}.org`,
        sourceBroadcasterName: `Journal ${i + 1}`,
      })
    );

    const mixedPool = [...ardItems, ...diverseItems];

    for (const mode of ['for_you', 'today', 'discourse', 'top'] as const) {
      const sorted = sortFeedForDisplay(mixedPool, mode);
      const ardCount = sorted.filter((item) => isArdSource(item)).length;
      const maxAllowedArd = Math.max(1, Math.floor(sorted.length / 10));

      assert.ok(
        ardCount <= maxAllowedArd,
        `Mode "${mode}" allowed ${ardCount} ARD items out of ${sorted.length} (max allowed <= 10%: ${maxAllowedArd})`
      );

      // Verify no two items from the same domain appear within 4 cards of each other
      for (let i = 0; i < sorted.length; i++) {
        const domainA = sorted[i].sourceDomain;
        for (let j = i + 1; j < Math.min(sorted.length, i + 4); j++) {
          const domainB = sorted[j].sourceDomain;
          assert.notEqual(
            domainA,
            domainB,
            `Mode "${mode}" placed duplicate domain "${domainA}" at indices ${i} and ${j} (must have at least 3 other domains in between)`
          );
        }
      }
    }
  });

  it('Test 4 (Default Stream Curation Quality & Snapshot Hygiene): rejects stubs/gossip/boilerplate and verifies clean public/feed-snapshot.json', () => {
    // 1. Bare "Schlagzeilen" stub must be rejected
    const schlagzeilenStub = createCuratedMockItem('stub-zdf', {
      title: 'Schlagzeilen',
      body: 'Kurze Meldung.',
      feedText: 'Kurze Meldung.',
    });
    assert.equal(satisfiesDefaultCuratedStandard(schlagzeilenStub), false);

    // 2. Football match preview must be rejected
    const footballItem = createCuratedMockItem('football-1', {
      title: 'Eintracht Frankfurt gegen Hamburger SV: Aufstellung und Bundesliga-Vorschau',
      feedText:
        'Am Samstagabend trifft Eintracht Frankfurt im Stadion auf den Hamburger SV. Trainer und Mannschaft hoffen auf drei Punkte im Kampf um die Tabelle.',
    });
    assert.equal(satisfiesDefaultCuratedStandard(footballItem), false);

    // 3. Clinical pathology/oncology jargon in contemplation_mind must be rejected
    const oncologyInMindfulness = createCuratedMockItem('oncology-mind', {
      title: 'Metastasierter Brustkrebs und Chemotherapie-Protokolle in der Onkologie',
      primaryTopic: 'contemplation_mind',
      topics: ['contemplation_mind'],
      feedText:
        'Neue klinische Daten zur Behandlung von Karzinomen und Tumoren zeigen veränderte Überlebensraten in der stationären Onkologie.',
    });
    assert.equal(satisfiesDefaultCuratedStandard(oncologyInMindfulness), false);

    // 4. Affiliate & donation boilerplate is stripped cleanly by sanitizeCuratedFeedItem
    const dirtyItem = createCuratedMockItem('dirty-boilerplate', {
      feedText:
        'Eine tiefgehende Untersuchung über digitale Souveränität, offene Standards und europäische Bildungsinfrastruktur im 21. Jahrhundert zeigt, warum öffentliche Institutionen unabhängige Software-Architekturen benötigen. Wenn ihr über folgende Links kauft, erhalten wir eine Provision. Unterstütze unabhängigen Journalismus.',
      keyInsight: 'Originalbeitrag veröffentlicht bei Deskmodder.',
    });
    const sanitized = sanitizeCuratedFeedItem(dirtyItem);
    assert.equal(sanitized.feedText?.includes('Provision'), false);
    assert.equal(sanitized.keyInsight?.includes('Originalbeitrag veröffentlicht bei'), false);
    assert.ok(satisfiesDefaultCuratedStandard(sanitized));

    // 5. Inspect shipped public/feed-snapshot.json
    const snapshotPath = path.resolve(process.cwd(), 'public/feed-snapshot.json');
    const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf-8'));
    assert.ok(Array.isArray(snapshot.items) && snapshot.items.length >= 50, 'Snapshot should have >= 50 curated items');

    const oct18Items = snapshot.items.filter((i: FeedItem) => String(i.publishedAt).startsWith('2026-10-18'));
    assert.equal(oct18Items.length, 0, 'public/feed-snapshot.json must contain 0 stale Oct 18 items');

    const ardSnapshotItems = snapshot.items.filter((i: FeedItem) => isArdSource(i));
    assert.ok(
      ardSnapshotItems.length <= Math.max(1, Math.floor(snapshot.items.length / 10)),
      `Snapshot ARD count (${ardSnapshotItems.length}) must be <= 10% of ${snapshot.items.length}`
    );

    const diverseEnforced = enforceCuratedStreamDiversity(snapshot.items);
    assert.ok(diverseEnforced.length >= 50);
  });
});
