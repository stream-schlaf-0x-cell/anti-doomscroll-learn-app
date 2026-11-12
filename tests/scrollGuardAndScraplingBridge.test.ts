import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import {
  extractCleanArticleFromHtml,
  harvestWebPageContent,
  enrichStubItemWithFulltext
} from '../src/core/ingestion/webContentExtractor';
import {
  sanitizeCuratedFeedItem,
  defaultBatchEditionEnricher
} from '../src/core/enrichment/batchEnricher';
import { applyScrollFreeze } from '../src/core/feed/feedPresentation';
import { FeedItem } from '../src/core/domain/types';
import { INITIAL_FIXTURES } from '../src/core/data/fixtures';

function createMockItem(id: string, overrides: Partial<FeedItem> = {}): FeedItem {
  return {
    ...INITIAL_FIXTURES[0],
    id,
    title: `Artikel ${id}`,
    canonicalUrl: `https://example.org/article-${id}`,
    publishedAt: '2026-11-05T10:00:00Z',
    topics: ['philosophy_ethics'],
    primaryTopic: 'philosophy_ethics',
    ...overrides
  };
}

describe('Scroll-Freeze & Python Scrapling Bridge Architecture Suite', () => {
  it('1. Dual-tier extraction produces 4-6 sentence essenceText (>= 220 chars) and structured fullMarkdownBody (>= 500 chars)', () => {
    const rawHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>The Architecture of Contemplative Epistemology — The Guardian</title>
          <meta property="og:title" content="The Architecture of Contemplative Epistemology">
          <script>console.log("analytics tracking code");</script>
          <style>body { font-size: 16px; }</style>
        </head>
        <body>
          <nav><a href="/">Home</a><a href="/news">News</a></nav>
          <article>
            <h1>The Architecture of Contemplative Epistemology</h1>
            <p>Modern cognitive psychology is increasingly converging with ancient contemplative traditions to examine how attention shapes our perception of reality. Recent empirical studies suggest that deliberate attentional stillness recalibrates prefrontal networks and reduces automatic affective biases.</p>
            <p>Support the Guardian with a monthly contribution to fund our independent reporting.</p>
            <p>By stepping back from habitual stimulus-response cycles, thinkers cultivate what epistemology refers to as epistemic humility. This perspective does not reject rigorous analytical inquiry; rather, it complements empirical scrutiny with experiential precision.</p>
            <h2>Empirical Findings and Systemic Implications</h2>
            <p>When educational environments incorporate systematic cognitive reflection, students demonstrate significantly higher resistance to algorithmic doomscrolling and sensationalist framing. The capacity to sustain prolonged focus correlates directly with nuanced dialectical thinking and emotional resilience.</p>
            <blockquote>The quiet mind does not seek refuge from the world, but learns to perceive its underlying structures with unclouded lucidity.</blockquote>
            <p>Subscribe now to receive our weekly long-read newsletter in your inbox.</p>
            <p>Ultimately, the synthesis of cognitive science and meditative discipline offers a practical antidote to digital fragmentation. Cultivating contemplative discernment is no longer an eccentric luxury, but an indispensable democratic competence for the 21st century.</p>
            <ul>
              <li>Enhanced working memory capacity and attentional filtering</li>
              <li>Reduced vulnerability to affective polarization and outrage cycles</li>
              <li>Deepened pedagogical understanding through deliberate slow reading</li>
            </ul>
          </article>
          <footer><p>Cookie settings &amp; All rights reserved.</p></footer>
        </body>
      </html>
    `;

    const harvested = extractCleanArticleFromHtml(rawHtml, 'https://example.com/contemplative-epistemology');

    // Title
    assert.equal(harvested.title, 'The Architecture of Contemplative Epistemology');

    // Tier A: Essence Text (FeedCard)
    assert.ok(harvested.essenceText.length >= 220, `Essence text must be >= 220 chars (got ${harvested.essenceText.length})`);
    assert.ok(!harvested.essenceText.includes('Support the Guardian'), 'Boilerplate must be stripped from essenceText');
    assert.ok(!harvested.essenceText.includes('Subscribe now'), 'Newsletter prompts must be stripped from essenceText');

    // Tier B: Full Markdown Body (ReaderScreen)
    assert.ok(harvested.fullMarkdownBody.length >= 500, `Full markdown body must be >= 500 chars (got ${harvested.fullMarkdownBody.length})`);
    assert.ok(harvested.fullMarkdownBody.includes('# The Architecture of Contemplative Epistemology'), 'Must include top level title');
    assert.ok(harvested.fullMarkdownBody.includes('## Empirical Findings and Systemic Implications'), 'Must convert h2 to Markdown heading');
    assert.ok(harvested.fullMarkdownBody.includes('> The quiet mind does not seek refuge'), 'Must preserve blockquote');
    assert.ok(harvested.fullMarkdownBody.includes('- Enhanced working memory capacity'), 'Must preserve list item');
    assert.ok(!harvested.fullMarkdownBody.includes('analytics tracking code'), 'Must strip script tags');

    // Word count & reading time
    assert.ok(harvested.wordCount >= 100, `Word count must be >= 100 (got ${harvested.wordCount})`);
    assert.ok(harvested.estimatedReadingMinutes >= 1, 'Estimated reading minutes must be at least 1');
  });

  it('2. HTML articles extract rich essence & body while bare teaser stubs remain honest with zero canned filler', () => {
    const rawStubItem = createMockItem('stub-guardian-longread-test', {
      title: 'Kognitive Resilienz im digitalen Zeitalter',
      feedText: 'Listen to the podcast. Brief teaser.',
      body: 'Short stub.',
      space: 'c/dialektik',
      primaryTopic: 'philosophy_ethics',
      topics: ['philosophy_ethics', 'science_society'],
      sourceDomain: 'theguardian.com',
      sourceReferences: [{
        originalUrl: 'https://theguardian.com/longread/cognitive-resilience',
        publisher: 'The Guardian',
        title: 'Kognitive Resilienz im digitalen Zeitalter',
        retrievalTimestamp: '2026-11-05T12:00:00.000Z',
        isVerified: true
      }],
      publishedAt: '2026-11-05T12:00:00.000Z',
      wordCount: 15,
      estimatedReadingMinutes: 1,
      isDailyEdition: true
    });

    // Bare stub MUST NOT be padded with fake philosophical boilerplate templates
    const sanitized = sanitizeCuratedFeedItem(rawStubItem);
    assert.equal(sanitized.feedText.includes('untersucht die kognitiven und psychologischen Mechanismen'), false);
    assert.equal(sanitized.body.includes('Kritische Urteilskraft entsteht'), false);
    assert.equal(sanitized.body.includes('Hintergrund & Vertiefung'), false);

    // Rich HTML input still produces >= 220 char essence & >= 500 char body deterministically
    const richHtmlItem = createMockItem('rich-html-longread-test', {
      title: 'Epistemische Wachsamkeit in digitalen Diskursräumen',
      feedText: 'Eine ausführliche Untersuchung zur digitalen Aufmerksamkeit.',
      body: `<html><body><article>
        <h1>Epistemische Wachsamkeit in digitalen Diskursräumen</h1>
        <p>Digitale Plattformen strukturieren unsere Aufmerksamkeit durch kurzgetaktete Belohnungsschleifen, die oft reflexive Tiefe zugunsten unmittelbarer Reaktion verdrängen.</p>
        <p>Langfristige Studien zeigen jedoch, dass gezielte Leseumgebungen mit klarer Quellenangabe und diskursiver Gegenperspektive das kritische Urteilsvermögen nachweislich stärken.</p>
        <p>Für Schule, Philosophieunterricht und politische Bildung ergeben sich daraus konkrete Gestaltungsprinzipien für entschleunigtes Arbeiten am Primärtext.</p>
      </article></body></html>`,
      space: 'c/dialektik',
      primaryTopic: 'philosophy_ethics',
      topics: ['philosophy_ethics'],
      sourceDomain: 'example.com',
      sourceReferences: [{
        originalUrl: 'https://example.com/epistemische-wachsamkeit',
        publisher: 'ZEIT',
        title: 'Epistemische Wachsamkeit in digitalen Diskursräumen',
        retrievalTimestamp: '2026-11-05T12:00:00.000Z',
        isVerified: true
      }],
      publishedAt: '2026-11-05T12:00:00.000Z',
      wordCount: 80,
      estimatedReadingMinutes: 1,
      isDailyEdition: true
    });

    const sanitizedRich = sanitizeCuratedFeedItem(richHtmlItem);
    assert.ok(sanitizedRich.feedText.length >= 220, `Sanitized HTML feedText must be >= 220 chars (got ${sanitizedRich.feedText.length})`);
    assert.ok(sanitizedRich.body.length >= 400, `Sanitized HTML body must preserve extracted prose (got ${sanitizedRich.body.length})`);
    const enriched = defaultBatchEditionEnricher.enrichDeterministically(sanitizedRich);
    assert.ok(enriched.wordCount >= 40, `Word count must be calculated (got ${enriched.wordCount})`);
    assert.ok(enriched.estimatedReadingMinutes >= 1, 'Estimated reading time must be at least 1 minute');
  });

  it('3. scripts/scrapling_harvester.py exists, is executable and is valid Python 3 syntax', () => {
    const scriptPath = path.resolve(__dirname, '../scripts/scrapling_harvester.py');
    assert.ok(fs.existsSync(scriptPath), 'scripts/scrapling_harvester.py must exist on disk');

    // Compile check Python syntax
    const compileOutput = execSync(`python3 -m py_compile "${scriptPath}"`, { encoding: 'utf-8' });
    assert.equal(compileOutput, '', 'py_compile must produce zero errors');

    // CLI --help check
    const helpOutput = execSync(`python3 "${scriptPath}" --help`, { encoding: 'utf-8' });
    assert.ok(helpOutput.includes('Usage: python3 scripts/scrapling_harvester.py'), 'Must output standard usage information');
  });

  it('4. Scroll-freeze prevents background arrivals from mutating top viewport order when scrollOffsetY > 80', () => {
    const cardA = createMockItem('card-a', {
      title: 'Erste verankerte Karte',
      feedText: 'Substanzielle Analyse zu epistemischen Standards und Bildung.',
      body: 'Ausführlicher Text...',
      space: 'c/dialektik',
      primaryTopic: 'philosophy_ethics',
      topics: ['philosophy_ethics'],
      sourceDomain: 'zeit.de',
      sourceReferences: [],
      publishedAt: '2026-11-05T10:00:00.000Z',
      wordCount: 300,
      estimatedReadingMinutes: 2
    });

    const cardB = createMockItem('card-b', {
      title: 'Zweite verankerte Karte',
      feedText: 'Weiterführende Reflexion über didaktische Ansätze und KI.',
      body: 'Ausführlicher Text...',
      space: 'c/didaktik',
      primaryTopic: 'german_didactics',
      topics: ['german_didactics'],
      sourceDomain: 'faz.net',
      sourceReferences: [],
      publishedAt: '2026-11-05T09:00:00.000Z',
      wordCount: 350,
      estimatedReadingMinutes: 2
    });

    const cardNew1 = createMockItem('card-new-1', {
      title: 'Frischer Hintergrund-Eilmeldung-Artikel',
      feedText: 'Gerade eben aus dem RSS-Feed eingetroffen.',
      body: 'Ausführlicher Text...',
      space: 'c/news',
      primaryTopic: 'science_society',
      topics: ['science_society'],
      sourceDomain: 'spiegel.de',
      sourceReferences: [],
      publishedAt: '2026-11-05T12:30:00.000Z',
      wordCount: 150,
      estimatedReadingMinutes: 1
    });

    const currentlyRendered = [cardA, cardB];
    const incomingWithNewArrival = [cardNew1, cardA, cardB];

    // Case 1: User is at the top of the feed (scrollOffsetY = 0 <= 80)
    const topResult = applyScrollFreeze(currentlyRendered, incomingWithNewArrival, 0, []);
    assert.equal(topResult.items.length, 3, 'When at top, new items are incorporated directly');
    assert.equal(topResult.items[0].id, 'card-new-1', 'New item placed at top');
    assert.equal(topResult.queuedArrivals.length, 0, 'No arrivals queued when at top');

    // Case 2: User is scrolled down reading (scrollOffsetY = 240 > 80)
    const scrolledResult = applyScrollFreeze(currentlyRendered, incomingWithNewArrival, 240, []);
    assert.equal(scrolledResult.items.length, 2, 'Rendered items count must stay strictly frozen');
    assert.equal(scrolledResult.items[0].id, 'card-a', 'First card MUST remain card-a (no jump!)');
    assert.equal(scrolledResult.items[1].id, 'card-b', 'Second card MUST remain card-b (no jump!)');
    assert.equal(scrolledResult.queuedArrivals.length, 1, 'Incoming new card must be queued');
    assert.equal(scrolledResult.queuedArrivals[0].id, 'card-new-1');

    // Case 3: In-place interaction update while scrolled down (e.g. upvote on card-b)
    const updatedCardB = { ...cardB, upvoted: true, isSaved: true };
    const incomingWithInteraction = [cardNew1, cardA, updatedCardB];

    const inPlaceResult = applyScrollFreeze(
      currentlyRendered,
      incomingWithInteraction,
      240,
      scrolledResult.queuedArrivals
    );
    assert.equal(inPlaceResult.items.length, 2, 'Count remains frozen');
    assert.equal(inPlaceResult.items[0].id, 'card-a');
    assert.equal(inPlaceResult.items[1].id, 'card-b');
    assert.equal((inPlaceResult.items[1] as any).upvoted, true, 'Card B in-place upvote state reflected');
    assert.equal((inPlaceResult.items[1] as any).isSaved, true, 'Card B in-place bookmark state reflected');
    assert.equal(inPlaceResult.queuedArrivals.length, 1, 'Queued arrivals not duplicated');
  });
});
