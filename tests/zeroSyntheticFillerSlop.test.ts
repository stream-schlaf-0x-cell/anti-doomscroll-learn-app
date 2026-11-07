import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  stripSyntheticFillerSentences,
  sanitizeCuratedFeedItem,
  synthesizeConceptualPodcastSummary
} from '../src/core/enrichment/batchEnricher';
import { FeedItem } from '../src/core/domain/types';
import { INITIAL_FIXTURES } from '../src/core/data/fixtures';

test('stripSyntheticFillerSentences cleans image_6.png dance company teaser down to genuine RSS sentence', () => {
  const dirtyTeaser =
    'Die Dresden Frankfurt Dance Company zeigt einen Klassiker und eine Uraufführung in Frankfurts Bockenheimer Depot: Auf Cyril Baldys „Body Me“ folgt „N.N.N.N“ von William Forsythe aus dem Jahr 2002. In diesem Beitrag zu „Frankfurter ballettpremiere der dresden frankfurt dance company mit down the road 201659086.html“ werden die zentralen Thesen und Hintergründe systematisch aufgeschlüsselt. Die Argumentation beleuchtet wesentliche Perspektiven, hinterfragt verbreitete Grundannahmen und liefert empirische sowie theoretische Einordnungen. Die detaillierten Analysen stehen zur vertiefenden Lektüre bereit.';

  const cleaned = stripSyntheticFillerSentences(dirtyTeaser);
  assert.equal(
    cleaned,
    'Die Dresden Frankfurt Dance Company zeigt einen Klassiker und eine Uraufführung in Frankfurts Bockenheimer Depot: Auf Cyril Baldys „Body Me“ folgt „N.N.N.N“ von William Forsythe aus dem Jahr 2002.'
  );
});

test('stripSyntheticFillerSentences strips markdown filler sections and quotes', () => {
  const dirtyBody = `# Test Artikel

Hier ist der echte erste Absatz des Artikels mit wichtigen Fakten.

## Erkenntnisdimensionen & Kernbefunde

Die detaillierte Untersuchung widmet sich den Kernmechanismen und Ursachen des Phänomens. Besonderes Augenmerk gilt dabei den Wechselwirkungen zwischen individuellen Entscheidungen und übergeordneten systemischen Strukturen.

> „Eine differenzierte Betrachtung erfordert den Mut, einfache Antworten zugunsten epistemischer Redlichkeit zu hinterfragen.“

## Didaktische Relevanz & Ausblick

Für Schule, Lehre und gesellschaftliche Diskurse eröffnet dieser Befund neue Perspektiven: Statt bloßer Informationsvermittlung steht die Förderung kritischer Urteilskraft und nachhaltiger Reflexion im Mittelpunkt.`;

  const cleaned = stripSyntheticFillerSentences(dirtyBody);
  assert.ok(!cleaned.includes('Erkenntnisdimensionen & Kernbefunde'));
  assert.ok(!cleaned.includes('Didaktische Relevanz & Ausblick'));
  assert.ok(!cleaned.includes('epistemischer Redlichkeit'));
  assert.ok(cleaned.includes('Hier ist der echte erste Absatz'));
});

test('sanitizeCuratedFeedItem does not pad authentic short RSS excerpts with synthetic filler', () => {
  const genuineItem: FeedItem = {
    ...INITIAL_FIXTURES[0],
    id: 'dance-company-genuine-1',
    title: 'Frankfurter Ballettpremiere',
    subtitle: 'Dresden Frankfurt Dance Company zeigt Klassiker und Uraufführung',
    feedText:
      'Die Dresden Frankfurt Dance Company zeigt einen Klassiker und eine Uraufführung in Frankfurts Bockenheimer Depot: Auf Cyril Baldys „Body Me“ folgt „N.N.N.N“ von William Forsythe aus dem Jahr 2002.',
    body:
      'Die Dresden Frankfurt Dance Company zeigt einen Klassiker und eine Uraufführung in Frankfurts Bockenheimer Depot: Auf Cyril Baldys „Body Me“ folgt „N.N.N.N“ von William Forsythe aus dem Jahr 2002.',
    canonicalUrl: 'https://example.com/ballett.html',
    publishedAt: new Date().toISOString(),
    primaryTopic: 'art_aesthetics',
    space: 'c/kultur',
    format: 'long_invitation',
    sourceReferences: [{
      originalUrl: 'https://example.com/ballett.html',
      publisher: 'FAZ',
      title: 'Frankfurter Ballettpremiere',
      retrievalTimestamp: new Date().toISOString(),
      isVerified: true
    }]
  };

  const sanitized = sanitizeCuratedFeedItem(genuineItem);
  assert.ok(!sanitized.feedText.includes('werden die zentralen Thesen und Hintergründe'));
  assert.ok(!sanitized.body.includes('Erkenntnisdimensionen & Kernbefunde'));
  assert.equal(
    sanitized.feedText,
    'Die Dresden Frankfurt Dance Company zeigt einen Klassiker und eine Uraufführung in Frankfurts Bockenheimer Depot: Auf Cyril Baldys „Body Me“ folgt „N.N.N.N“ von William Forsythe aus dem Jahr 2002.'
  );
});

test('synthesizeConceptualPodcastSummary returns empty string for general topics without inventing philosophical filler', () => {
  const result = synthesizeConceptualPodcastSummary('Kants Kritik der reinen Vernunft', 'philosophy_ethics', '');
  assert.equal(result, '');
});

test('Snapshot JSON files contain 0 instances of synthetic filler sentences', () => {
  const snapshotPath = path.resolve(__dirname, '../public/feed-snapshot.json');
  const pipelinePath = path.resolve(__dirname, '../src/core/data/pipeline-output.json');

  const snapshotContent = fs.readFileSync(snapshotPath, 'utf8');
  const pipelineContent = fs.readFileSync(pipelinePath, 'utf8');

  const forbiddenStrings = [
    'werden die zentralen Thesen und Hintergründe',
    'Die Argumentation beleuchtet wesentliche Perspektiven',
    'Erkenntnisdimensionen & Kernbefunde',
    'Didaktische Relevanz & Ausblick',
    'Core Dimensions & Key Findings',
    'Didactic Relevance & Outlook',
    'widmet sich den ethischen und erkenntnistheoretischen'
  ];

  for (const forbidden of forbiddenStrings) {
    assert.equal(
      snapshotContent.includes(forbidden),
      false,
      `public/feed-snapshot.json must not contain "${forbidden}"`
    );
    assert.equal(
      pipelineContent.includes(forbidden),
      false,
      `src/core/data/pipeline-output.json must not contain "${forbidden}"`
    );
  }
});
