import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  htmlToEditorialMarkdown,
  hasEditorialMarkdownStructure,
  parseFeedXml,
  decodeXmlEntities
} from '../src/core/ingestion/rssParser';
import {
  stripPublisherBoilerplate,
  stripLeadingImageCredit,
  isShoppingDealTitle
} from '../src/core/enrichment/batchEnricher';
import {
  upgradeImageResolutionUrl,
  isRejectedLowResOrLogoUrl,
  extractLoadedImageDimensions,
  isLowResolutionEditorialImage
} from '../src/core/utils/imageQuality';
import {
  buildTextGroundedQuiz,
  generateQuizForArticle,
  isPlausibleNonMetadataQuiz,
  falsifyStatement
} from '../src/core/quiz/quizGenerator';
import { selectEssenceSentences, isTemplatedEditorialText } from '../src/core/synthesis/backgroundResearchPipeline';
import { parseInlineFormatting, buildMarkdownBlocks } from '../src/core/utils/markdownUtils';
import { FeedItem } from '../src/core/domain/types';
import { INITIAL_FIXTURES } from '../src/core/data/fixtures';

const ROOT = path.resolve(__dirname, '..');

const TECHPRESSO_HTML = `
<p>Saturday 14 November 2026 | <a href="https://dupple.com/techpresso">Join Free</a> | <a href="https://dupple.com/x">Upgrade</a></p>
<p>Hi there, this is your daily ☕️ Techpresso.</p>
<p>In today's newsletter:</p>
<p>✈️ Software update likely caused US flight halt</p>
<p>🚀 Starship reaches orbit despite booster failure</p>
<p><b>Plus:</b> 🎁 14 more stories you might like</p>
<table><tr><td><p id="main-ad-partner-label" style="font-weight: bold;"><b>FROM OUR PARTNER</b></p>
<div id="main-ad-headline"><a data-ad-link="main" href="https://aws.example.com"><strong>Three AI patterns, one layer to evaluate</strong></a></div>
<div id="main-ad-copy"><p>RAG grounds your model in your data. Learn what to evaluate.</p></div></td></tr></table>
<table><tr><td style="padding-top: 30px; font-family: 'Inter', Arial; font-weight: bold; font-size: 17px;"> ✈️ Software update likely caused US flight halt <a href="https://www.securityweek.com/faa-ground-stop/"><span>LINK</span></a></td></tr></table>
<ul><li>A software update is the likely cause of the nationwide US flight ground stop on Friday, officials believe.</li>
<li>The FAA lifted the order at 8:15 pm ET more than four hours later, with delays expected for several days.</li></ul>
<table><tr><td><p style="font-weight: bold;"><b>FROM OUR PARTNER</b></p>
<div id="spotlight-ad-copy"><p>We're constantly expanding the SerpApi ecosystem. Try SerpApi for free -&gt;</p></div></td></tr></table>
<table><tr><td style="font-family: 'Inter'; font-weight: bold;"> 🚀 Starship reaches orbit despite booster failure <a href="https://www.newsbytesapp.com/starship">LINK</a></td></tr></table>
<ul><li>SpaceX's Starship reached orbit on its 15th test flight even though the Super Heavy booster failed during its return.</li></ul>
<p>💬 How did you find today's edition?</p><p>Not subscribed to ☕️ Techpresso yet? <a href="https://x.com/subscribe">Subscribe for free</a></p>
`;

function makeItem(overrides: Partial<FeedItem>): FeedItem {
  return { ...INITIAL_FIXTURES[0], comments: [], ...overrides } as FeedItem;
}

describe('Reader Quality V5 — gap, newsletter full text, images, quiz, magazine reader', () => {
  it('1. index.html never pins the fixed body to 100dvh (iOS standalone bottom gap)', () => {
    const html = fs.readFileSync(path.join(ROOT, 'public/index.html'), 'utf8');
    const bodyRule = html.match(/\n\s*body\s*\{([^}]*)\}/);
    assert.ok(bodyRule, 'index.html must contain a dedicated body rule');
    assert.equal(/height:\s*100dvh/.test(bodyRule![1]), false, 'body must not use height: 100dvh');
    assert.ok(/position:\s*fixed/.test(bodyRule![1]) && /bottom:\s*0/.test(bodyRule![1]), 'body must be fixed and stretched to bottom: 0');
  });

  it('2. Newsletter digest: ads removed surgically, every story kept with heading + primary source link', () => {
    const md = htmlToEditorialMarkdown(TECHPRESSO_HTML);
    assert.equal(/serpapi|FROM OUR PARTNER|Three AI patterns|RAG grounds/i.test(md), false, `ads must be removed:\n${md}`);
    assert.ok(md.includes('### ✈️ Software update likely caused US flight halt'), md);
    assert.ok(md.includes('### 🚀 Starship reaches orbit despite booster failure'), md);
    assert.ok(md.includes('[↗ Primärquelle: securityweek.com](https://www.securityweek.com/faa-ground-stop/)'), md);
    assert.ok(md.includes('- SpaceX\'s Starship reached orbit on its 15th test flight'), md);
    assert.equal(/Join Free|Hi there|How did you find|Subscribe for free|In today's newsletter/i.test(md), false, md);
    assert.equal(hasEditorialMarkdownStructure(md), true);
  });

  it('3. Plain-text sponsor stripping never swallows the stories between two ad boxes', () => {
    const plain =
      'FROM OUR PARTNER\nThree AI patterns. Download the evaluation guide\n\nSoftware update likely caused US flight halt\nA software update is the likely cause of the ground stop.\n\nFROM OUR PARTNER\nWe are constantly expanding the SerpApi ecosystem. Try SerpApi for free ->\n\nStarship reaches orbit despite booster failure.';
    const cleaned = stripPublisherBoilerplate(plain, 'Techpresso');
    assert.ok(cleaned.includes('A software update is the likely cause of the ground stop.'), cleaned);
    assert.ok(cleaned.includes('Starship reaches orbit despite booster failure.'), cleaned);
    assert.equal(/SerpApi/i.test(cleaned), false, cleaned);
  });

  it('4. RSS parser exposes a structure-preserving Markdown body next to plain text', () => {
    const xml = `<rss><channel><item><title>Digest</title><link>https://example.com/a</link>
      <description>Short teaser text for the digest card.</description>
      <content:encoded><![CDATA[<h2>Erster Abschnitt</h2><p>Ein <strong>wichtiger</strong> Absatz mit <a href="https://quelle.de/x">Studie</a>.</p><blockquote><p>Ein starkes Zitat.</p></blockquote><ul><li>Punkt eins</li><li>Punkt zwei</li></ul>]]></content:encoded>
      </item></channel></rss>`;
    const [entry] = parseFeedXml(xml, 'test');
    assert.ok(entry.fullContentMarkdown);
    const md = entry.fullContentMarkdown!;
    assert.ok(md.includes('## Erster Abschnitt'), md);
    assert.ok(md.includes('**wichtiger**'), md);
    assert.ok(md.includes('[Studie](https://quelle.de/x)'), md);
    assert.ok(md.includes('> Ein starkes Zitat.'), md);
    assert.ok(md.includes('- Punkt eins\n- Punkt zwei'), md);
    assert.equal(decodeXmlEntities('&copy; NASA'), '© NASA');
  });

  it('5. Image desk: thumbnails upgraded to verified HD paths, placeholders & shop icons rejected', () => {
    assert.equal(
      upgradeImageResolutionUrl('https://scx1.b-cdn.net/csz/news/tmb/2026/black-hole.jpg'),
      'https://scx1.b-cdn.net/csz/news/800a/2026/black-hole.jpg'
    );
    assert.equal(
      upgradeImageResolutionUrl('https://www.scinexx.de/wp-content/uploads/D/i/Fundstaette-300x164.webp'),
      'https://www.scinexx.de/wp-content/uploads/D/i/Fundstaette.webp'
    );
    assert.ok(upgradeImageResolutionUrl('https://images.adsttc.com/media/images/1/newsletter/house.jpg?1')!.includes('/large_jpg/'));
    assert.ok(upgradeImageResolutionUrl('https://www.zdfheute.de/assets/auto-100~384x216?cb=1')!.includes('~1280x720'));
    assert.equal(isRejectedLowResOrLogoUrl('https://stadt-bremerhaven.de/404bild.jpg'), true);
    assert.equal(isRejectedLowResOrLogoUrl('https://m.media-amazon.com/images/I/41x4zBwpn9L._SL160_.jpg'), true);
    assert.equal(isRejectedLowResOrLogoUrl('https://example.com/uploads/piano-image.jpg'), false);

    // Web (react-native-web passes the DOM load event) and native payloads are both understood
    assert.deepEqual(extractLoadedImageDimensions({ nativeEvent: { target: { naturalWidth: 300, naturalHeight: 200 } } }), { width: 300, height: 200 });
    assert.deepEqual(extractLoadedImageDimensions({ nativeEvent: { source: { width: 1200, height: 800 } } }), { width: 1200, height: 800 });
    assert.equal(extractLoadedImageDimensions({ nativeEvent: {} }), null);
    assert.equal(isLowResolutionEditorialImage(300, 200), true);
    assert.equal(isLowResolutionEditorialImage(1200, 675), false);
  });

  it('6. Quiz is built from the article itself: verbatim correct answer, near-miss distractors, same language', () => {
    const body = [
      'Die Stadt Dresden hat im vergangenen Jahr 120 neue Lehrkräfte eingestellt.',
      'Laut Kultusministerium ist die Zahl der Bewerbungen deutlich gestiegen.',
      'Besonders gefragt waren Fächer wie Ethik, Deutsch und Informatik an Oberschulen.',
      'Die Ausbildung im Referendariat dauert in Sachsen derzeit 18 Monate.',
      'Viele Schulen berichten zugleich von mehr Teilzeitwünschen im Kollegium.',
      'Der Lehrerverband fordert daher kleinere Klassen und mehr Zeit für Vorbereitung.'
    ].join(' ');
    const item = makeItem({ id: 'quiz-v5-de', title: 'Dresden stellt mehr Lehrkräfte ein', articleBody: body, feedText: body, keyInsight: '' });
    const quiz = buildTextGroundedQuiz(item);
    assert.ok(quiz, 'a substantive German article must yield a text-grounded quiz');
    assert.equal(isPlausibleNonMetadataQuiz(quiz!), true);
    const correct = quiz!.options[quiz!.correctIndex];
    assert.ok(body.includes(correct), 'correct option must be a verbatim statement from the text');
    for (const [i, opt] of quiz!.options.entries()) {
      if (i === quiz!.correctIndex) continue;
      assert.equal(body.includes(opt), false, `distractor must not be a true sentence: ${opt}`);
      assert.doesNotMatch(opt, /skaliert linear|kurzfristiges Einzelphänomen|Nutzenkalküle/i);
    }
    assert.match(quiz!.question, /Aussage|Text|Angaben/);

    const enBody =
      'The FAA lifted the nationwide ground stop after more than four hours on Friday evening. Officials said a software update caused the outage at 22 control centers. Investigators found no sign that hackers were involved in the failure. Airlines warned that delays would continue for several days across the country. The agency plans a review of its update procedures within 30 days. Lawmakers called for higher investment in the aging air traffic system.';
    const enItem = makeItem({ id: 'quiz-v5-en', title: 'Software update caused US flight halt', articleBody: enBody, feedText: enBody, keyInsight: '' });
    const enQuiz = buildTextGroundedQuiz(enItem);
    assert.ok(enQuiz);
    assert.match(enQuiz!.question, /statement|claim|article|text/i, 'English articles get an English question');

    const thin = makeItem({ id: 'quiz-v5-thin', title: 'Kurzmeldung', articleBody: 'Kurzer Ticker-Satz.', feedText: 'Kurzer Ticker-Satz.' });
    assert.equal(buildTextGroundedQuiz(thin), null, 'thin texts get no quiz in the Reader');
    assert.equal(isPlausibleNonMetadataQuiz(generateQuizForArticle(thin)), true, 'fallback quiz stays structurally valid');

    assert.equal(falsifyStatement('Die Zahl der Bewerbungen ist deutlich gestiegen.', 'de', 1, false), 'Die Zahl der Bewerbungen ist deutlich gesunken.');
  });

  it('7. Summary box uses real core sentences from the whole text and hides canned template copy', () => {
    const sentences = Array.from({ length: 8 }, (_, i) => `Satz Nummer ${i + 1} beschreibt einen konkreten Befund aus der Studie mit ${i * 10} Teilnehmenden.`);
    const item = makeItem({ id: 'essence-v5', title: 'Studie', subtitle: sentences[0], articleBody: sentences.join(' ') });
    const essence = selectEssenceSentences(item, 3);
    assert.ok(essence.length >= 2 && essence.length <= 3);
    assert.equal(essence.includes(sentences[0]), false, 'the lede is never repeated in the summary');
    assert.equal(selectEssenceSentences(makeItem({ id: 'short', articleBody: 'Nur ein kurzer Absatz mit wenig Inhalt.' })).length, 0);
    assert.equal(isTemplatedEditorialText('Gedankengang zur ethischen & philosophischen Vertiefung (Tagesschau).'), true);
    assert.equal(isTemplatedEditorialText('Autorisierter Herausgeber-Auszug (RSS/API). Der vollständige Artikel ist abrufbar.'), true);
    assert.equal(isTemplatedEditorialText('Die Studie zeigt, dass Schlafmangel die Gedächtnisbildung um ein Drittel reduziert.'), false);
  });

  it('8. Magazine reader: links are tappable tokens, bold lines become sub-headings, headings split from text', () => {
    const tokens = parseInlineFormatting('Mehr bei [Quelle](https://quelle.de/a) und **fett**.');
    assert.ok(tokens.some(t => t.url === 'https://quelle.de/a' && t.text === 'Quelle'));
    assert.ok(tokens.some(t => t.bold && t.text === 'fett'));
    const blocks = buildMarkdownBlocks('**Neue Erkenntnisse**\nDer erste Absatz folgt direkt.\n\n### Abschnitt\nText darunter.');
    assert.deepEqual(blocks.slice(0, 4), ['### Neue Erkenntnisse', 'Der erste Absatz folgt direkt.', '### Abschnitt', 'Text darunter.']);
  });

  it('9. Teaser hygiene: photo credits and shopping-deal posts are removed', () => {
    assert.equal(
      stripLeadingImageCredit("© NOAA's National Ocean Service / Wikimedia Commons Zwei Mantelzonen am Erdkern stehen mit Vulkanismus in Verbindung."),
      'Zwei Mantelzonen am Erdkern stehen mit Vulkanismus in Verbindung.'
    );
    assert.equal(
      stripPublisherBoilerplate('Ein Silberschatz wurde gefunden. &copy; National Museums Scotland / National Museums Scotland'),
      'Ein Silberschatz wurde gefunden.'
    );
    assert.equal(isShoppingDealTitle('Amazon Blitzangebote: Powerbanks, Flexispot und mehr'), true);
    assert.equal(isShoppingDealTitle("LG's budget-friendly B6E OLED TV is up to 50 percent off this weekend"), true);
    assert.equal(isShoppingDealTitle('Warum Lehrkräfte die Verbeamtung ablehnen'), false);
  });
});
