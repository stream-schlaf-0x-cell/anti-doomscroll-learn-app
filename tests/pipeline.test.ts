import { describe, it } from 'node:test';
import assert from 'node:assert';
import { parseFeedXml, stripHtml, decodeXmlEntities, unwrapCdata } from '../src/core/ingestion/rssParser';
import { canonicalizeUrl, generateContentHash, normalizeFeedEntry } from '../src/core/ingestion/normalizer';
import { deduplicateFeedItems, normalizeTitle } from '../src/core/ingestion/deduplicator';
import { RawFeedEntry, RawFeedSource } from '../src/core/ingestion/types';
import { FeedItemSchema } from '../src/core/domain/types';

describe('Content Ingestion Pipeline: Parser, Normalizer & Deduplication', () => {
  const sampleSource: RawFeedSource = {
    id: 'test-source',
    name: 'Test Publisher',
    url: 'https://example.com/feed.xml',
    primaryTopic: 'philosophy_ethics',
    topics: ['philosophy_ethics', 'science_society'],
    defaultEvidenceTier: 'publisher_excerpt',
    defaultAuthor: 'Test Author',
    language: 'de'
  };

  it('1. Parses standard RSS 2.0 XML correctly', () => {
    const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
    <rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/">
      <channel>
        <title>Philosophie Aktuell</title>
        <link>https://example.com</link>
        <item>
          <title><![CDATA[Die Zukunft der dialektischen Vernunft]]></title>
          <link>https://example.com/articles/vernunft?utm_source=rss&amp;utm_medium=feed</link>
          <description><![CDATA[<p>Ein Essay &uuml;ber <b>Hegel</b> und moderne Systemtheorie.</p>]]></description>
          <dc:creator>Dr. Elena Weber</dc:creator>
          <pubDate>Wed, 14 Oct 2026 08:30:00 GMT</pubDate>
          <guid>https://example.com/articles/vernunft</guid>
        </item>
      </channel>
    </rss>`;

    const entries = parseFeedXml(rssXml, 'test-source');
    assert.strictEqual(entries.length, 1);
    assert.strictEqual(entries[0].title, 'Die Zukunft der dialektischen Vernunft');
    assert.strictEqual(entries[0].link, 'https://example.com/articles/vernunft?utm_source=rss&utm_medium=feed');
    assert.strictEqual(entries[0].summary, 'Ein Essay über Hegel und moderne Systemtheorie.');
    assert.strictEqual(entries[0].author, 'Dr. Elena Weber');
    assert.strictEqual(entries[0].sourceId, 'test-source');
  });

  it('2. Parses Atom 1.0 XML correctly', () => {
    const atomXml = `<?xml version="1.0" encoding="utf-8"?>
    <feed xmlns="http://www.w3.org/2005/Atom">
      <title>Tech Insights</title>
      <entry>
        <title>Frontier LLMs and Cognitive Apprenticeship</title>
        <id>urn:uuid:1234-5678-9012</id>
        <link rel="alternate" type="text/html" href="https://example.org/entry/llms-apprenticeship/" />
        <summary type="html">&lt;p&gt;How generative AI changes learning in the humanities.&lt;/p&gt;</summary>
        <author><name>Prof. Sarah Miller</name></author>
        <published>2026-10-14T09:15:00Z</published>
      </entry>
    </feed>`;

    const entries = parseFeedXml(atomXml, 'test-source');
    assert.strictEqual(entries.length, 1);
    assert.strictEqual(entries[0].title, 'Frontier LLMs and Cognitive Apprenticeship');
    assert.strictEqual(entries[0].link, 'https://example.org/entry/llms-apprenticeship/');
    assert.strictEqual(entries[0].summary, 'How generative AI changes learning in the humanities.');
    assert.strictEqual(entries[0].author, 'Prof. Sarah Miller');
  });

  it('3. Safely strips HTML tags and decodes entities', () => {
    const dirty = '<p>First paragraph with <a href="http://foo">link</a>.</p><br/><p>Second &amp; &#39;quoted&#39; text &gt; test.</p>';
    const cleaned = stripHtml(dirty);
    assert.strictEqual(cleaned, "First paragraph with link.\n\nSecond & 'quoted' text > test.");
  });

  it('4. Canonicalizes URLs by stripping marketing and tracking query parameters', () => {
    const dirtyUrl = 'https://example.com/posts/deep-thought/?utm_source=twitter&utm_medium=social&ref=feed&fbclid=xyz123#';
    const cleanUrl = canonicalizeUrl(dirtyUrl);
    assert.strictEqual(cleanUrl, 'https://example.com/posts/deep-thought');
  });

  it('5. Generates deterministic SHA-256 content hashes', () => {
    const hash1 = generateContentHash('https://example.com/a', 'Titel 1', 'Zusammenfassung Text');
    const hash2 = generateContentHash('https://example.com/a', 'Titel 1', 'Zusammenfassung Text');
    const hash3 = generateContentHash('https://example.com/b', 'Titel 1', 'Zusammenfassung Text');

    assert.strictEqual(hash1, hash2, 'Identical inputs must yield identical hash');
    assert.notStrictEqual(hash1, hash3, 'Different URLs must yield different hash');
    assert.strictEqual(hash1.length, 64, 'SHA-256 hex digest must be 64 characters');
  });

  it('6. Normalizes RawFeedEntry into schema-valid FeedItem', () => {
    const raw: RawFeedEntry = {
      id: 'entry-01',
      title: 'Die Pädagogik der kognitiven Dissonanz im Ethikunterricht',
      link: 'https://schulportal.de/didaktik/dissonanz?utm_source=rss',
      summary: 'Lernende wachsen durch Reibung an ungelösten ethischen Fragestellungen. Eine Unterrichtsreflexion.',
      author: 'Maria Schmidt',
      publishedAt: '2026-10-14T08:00:00Z',
      sourceId: 'deutsches-schulportal'
    };

    const source: RawFeedSource = {
      id: 'deutsches-schulportal',
      name: 'Das Deutsche Schulportal',
      url: 'https://deutsches-schulportal.de/feed/',
      primaryTopic: 'german_didactics',
      topics: ['german_didactics', 'philosophy_ethics'],
      defaultEvidenceTier: 'publisher_excerpt',
      language: 'de',
      isTeachingRelated: true
    };

    const feedItem = normalizeFeedEntry(raw, source);

    // Verify FeedItemSchema validation
    const parsed = FeedItemSchema.safeParse(feedItem);
    assert.strictEqual(parsed.success, true, `Normalizer output must pass FeedItemSchema: ${parsed.error?.message}`);

    assert.strictEqual(feedItem.contentOrigin, 'live_ingested');
    assert.strictEqual(feedItem.isDemonstration, false);
    assert.strictEqual(feedItem.isTeachingRelated, true);
    assert.strictEqual(feedItem.canonicalUrl, 'https://schulportal.de/didaktik/dissonanz');
    assert.ok(feedItem.feedText.length > 20);
    assert.strictEqual(feedItem.sourceReferences[0].publisher, 'Das Deutsche Schulportal');
  });

  it('7. Deduplicates feed items by canonical URL, hash and title', () => {
    const source: RawFeedSource = {
      id: 'source-1',
      name: 'Source',
      url: 'https://example.com/rss',
      primaryTopic: 'ai_apple',
      topics: ['ai_apple'],
      defaultEvidenceTier: 'publisher_excerpt',
      language: 'en'
    };

    const itemA = normalizeFeedEntry({
      id: 'item-1',
      title: 'Apple Neural Engine Architecture',
      link: 'https://example.com/ane?utm_source=rss',
      summary: 'Detailed look at low-level NNE tensor execution.',
      publishedAt: '2026-10-14T08:00:00Z',
      sourceId: 'source-1'
    }, source);

    const itemADuplicateUrl = normalizeFeedEntry({
      id: 'item-1-dup',
      title: 'Apple Neural Engine Architecture (Updated)',
      link: 'https://example.com/ane?utm_source=twitter',
      summary: 'Different summary text.',
      publishedAt: '2026-10-14T09:00:00Z',
      sourceId: 'source-1'
    }, source);

    const itemB = normalizeFeedEntry({
      id: 'item-2',
      title: 'Modalities of Synthesis in Max MSP',
      link: 'https://example.com/max-msp',
      summary: 'Exploring granular clouds and FFT cross-synthesis.',
      publishedAt: '2026-10-14T10:00:00Z',
      sourceId: 'source-1'
    }, source);

    const result = deduplicateFeedItems([itemA, itemADuplicateUrl, itemB]);
    assert.strictEqual(result.uniqueItems.length, 2, 'Must discard duplicate item with identical canonical URL');
    assert.strictEqual(result.duplicateCount, 1);
  });

  it('8. Handles empty or malformed XML gracefully without throwing', () => {
    const entriesFromGarbage = parseFeedXml('<<<< NOT XML >>>>', 'src');
    assert.deepStrictEqual(entriesFromGarbage, []);

    const entriesFromEmpty = parseFeedXml('', 'src');
    assert.deepStrictEqual(entriesFromEmpty, []);
  });
});
