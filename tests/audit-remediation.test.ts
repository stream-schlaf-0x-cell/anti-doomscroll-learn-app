import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { stripHtml, sanitizeImageUrl, ZERO_WIDTH_REGEX } from '../src/core/ingestion/rssParser';
import {
  splitSentencesAware,
  isSubstantialSubtitle,
  stripBoilerplate,
  normalizeFeedEntry
} from '../src/core/ingestion/normalizer';
import { findRelatedNetworkPosts } from '../src/core/synthesis/backgroundResearchPipeline';
import {
  FEATURE_MODULES,
  DEFAULT_ENABLED_MODULES,
  isFeatureEnabled
} from '../src/core/modules/featureRegistry';
import { FeedItem, UserProfile } from '../src/core/domain/types';
import { DEFAULT_USER_PROFILE } from '../src/core/data/fixtures';
import { RawFeedEntry, RawFeedSource } from '../src/core/ingestion/types';

describe('Audit Remediation & Verification Suite (Master Execution Plan)', () => {
  it('1. Zero-width character stripping: strips invisible chars from titles, HTML, and text', () => {
    const rawWithInvisible = '\u200B\u200BKommentar: Eine \uFEFFruhige \u00ADZukunft für das digitale Lesen.\u200C';
    const cleaned = stripHtml(rawWithInvisible);
    assert.strictEqual(cleaned, 'Kommentar: Eine ruhige Zukunft für das digitale Lesen.');
    assert.strictEqual(ZERO_WIDTH_REGEX.test(cleaned), false);

    const rawEntry: RawFeedEntry = {
      id: 'test-zero-width-1',
      sourceId: 'test-source',
      title: '\u200B\u200BKommentar: Neuer Bildungsansatz\u200E',
      link: 'https://example.com/artikel',
      publishedAt: '2026-10-17T12:00:00Z',
      summary: 'Ein substantieller Beitrag über moderne Lernmethoden und Konzentration im Alltag.'
    };

    const dummySource: RawFeedSource = {
      id: 'test-source',
      name: 'Test Redaktion',
      url: 'https://example.com/rss',
      primaryTopic: 'philosophy_ethics',
      topics: ['philosophy_ethics'],
      language: 'de',
      defaultEvidenceTier: 'publisher_excerpt'
    };

    const normalized = normalizeFeedEntry(rawEntry, dummySource);
    assert.strictEqual(normalized.title, 'Kommentar: Neuer Bildungsansatz');
    assert.strictEqual(ZERO_WIDTH_REGEX.test(normalized.title), false);
    assert.strictEqual(ZERO_WIDTH_REGEX.test(normalized.sourceReferences[0].title), false);
  });

  it('2. German ordinal date & abbreviation sentence splitting preservation', () => {
    const text = 'Seit dem 21. September 2026 läuft die Testphase. Dr. Müller war anwesend. Wir planen u.a. neue Räume.';
    const sentences = splitSentencesAware(text);

    assert.strictEqual(sentences.length, 3);
    assert.strictEqual(sentences[0], 'Seit dem 21. September 2026 läuft die Testphase.');
    assert.strictEqual(sentences[1], 'Dr. Müller war anwesend.');
    assert.strictEqual(sentences[2], 'Wir planen u.a. neue Räume.');
  });

  it('3. Tracking pixel rejection & image URL entity decoding', () => {
    // Decode HTML entities like &amp; and upgrade to https
    const dirtyUrl = 'http://example.com/images/hero.jpg?width=1200&amp;quality=85';
    assert.strictEqual(
      sanitizeImageUrl(dirtyUrl),
      'https://example.com/images/hero.jpg?width=1200&quality=85'
    );

    // Reject known tracking pixels and spacer images
    assert.strictEqual(sanitizeImageUrl('https://cpx.golem.de/cpx.php?class=12&id=99'), undefined);
    assert.strictEqual(sanitizeImageUrl('https://api.follow.it/track-rss-story-click/v3/abc'), undefined);
    assert.strictEqual(sanitizeImageUrl('https://ad.doubleclick.net/pixel/track.gif'), undefined);
    assert.strictEqual(sanitizeImageUrl('https://example.com/assets/1x1.png'), undefined);
    assert.strictEqual(sanitizeImageUrl('https://example.com/assets/pixel.gif'), undefined);
    assert.strictEqual(sanitizeImageUrl('https://example.com/assets/vector-placeholder.svg'), undefined);

    // Keep clean genuine hero images
    assert.strictEqual(
      sanitizeImageUrl('https://images.tagesschau.de/image/hero-1024.jpg'),
      'https://images.tagesschau.de/image/hero-1024.jpg'
    );
  });

  it('4. Cross-reference token-exact matching without substring false positives', () => {
    const mainItem: FeedItem = {
      id: 'item-main',
      type: 'deep_dive',
      format: 'sourced_update',
      title: 'Moderne Genetik und LLM Modelle in der Wissenschaft',
      subtitle: 'Ein Einblick in moderne genetische Forschung.',
      feedText: 'Die Forschung liefert neue Einblicke.',
      articleBody: 'Ausführliche Betrachtung genetischer Forschung.',
      body: 'Ausführliche Betrachtung genetischer Forschung.',
      topics: ['science_society'],
      primaryTopic: 'science_society',
      sourceReferences: [{ publisher: 'Wissenschafts-Redaktion', originalUrl: 'https://science.org/1', title: 'Genetik', retrievalTimestamp: '2026-10-17T00:00:00Z', publicationTimestamp: '2026-10-17T00:00:00Z', isVerified: true }],
      publishedAt: '2026-10-17T00:00:00Z',
      generatedAt: '2026-10-17T00:00:00Z',
      estimatedReadingMinutes: 4,
      relevanceExplanation: 'Forschung',
      contentStatus: 'editorial_briefing',
      isDailyEdition: true,
      editionDate: '2026-10-17',
      isDemonstration: false,
      aiAssisted: false,
      factReviewStatus: 'scientific_paper',
      provenanceSummary: 'Wissenschaftlicher Primärnachweis',
      isTeachingRelated: false,
      isChallengingPerspective: false,
      wordCount: 300,
      evidenceTier: 'publisher_excerpt',
      contentOrigin: 'live_ingested',
      contentHash: 'hash-main',
      canonicalUrl: 'https://science.org/1',
      upvotesCount: 0,
      awardsCount: { gold: 0, brain: 0, spark: 0 },
      comments: [],
      sourceTrustLevel: 'peer_reviewed',
      sourceBroadcasterName: 'Wissenschaft'
    };

    // Candidate A contains "generieren" (which shares letters with "genetik", but is NOT the token "genetik")
    // and "vollkommen" (which contains "llm" as substring, but is NOT the token "llm")
    const candidateA: FeedItem = {
      ...mainItem,
      id: 'item-candidate-a',
      title: 'Wie vollkommen autonome Systeme Code generieren',
      subtitle: 'Ein Bericht über Codegenerierung.',
      feedText: 'Systeme die Code generieren.',
      topics: ['ai_apple'],
      primaryTopic: 'ai_apple',
      canonicalUrl: 'https://ai.org/1'
    };

    // Candidate B contains the genuine exact token "Genetik" (>=5 chars) and "LLM" (acronym whitelist)
    const candidateB: FeedItem = {
      ...mainItem,
      id: 'item-candidate-b',
      title: 'Wissenschaftliche Durchbrüche: Wie Genetik und LLM zusammenwirken',
      subtitle: 'Forschung zu Genetik.',
      feedText: 'Genetik und LLM im Fokus.',
      topics: ['science_society'],
      primaryTopic: 'science_society',
      canonicalUrl: 'https://science.org/2'
    };

    const results = findRelatedNetworkPosts(mainItem, [candidateA, candidateB]);

    // Candidate A must NOT match with connectionReason for "genetik" or "llm"
    const candidateARef = results.find(r => r.id === candidateA.id);
    if (candidateARef) {
      assert.ok(
        !candidateARef.connectionReason.includes('„genetik“') && !candidateARef.connectionReason.includes('„llm“'),
        `False positive substring match detected: ${candidateARef.connectionReason}`
      );
    }

    // Candidate B must match with exact token "genetik" or "llm"
    const candidateBRef = results.find(r => r.id === candidateB.id);
    assert.ok(candidateBRef, 'Candidate B with genuine token match should be discovered');
    assert.ok(
      candidateBRef.connectionReason.includes('„genetik“') || candidateBRef.connectionReason.includes('„llm“'),
      `Candidate B should match exact token: ${candidateBRef?.connectionReason}`
    );
  });

  it('5. Feature registry default state and toggling', () => {
    // All 9 modules must be registered (6 original + 3 Phase 3 bloomscrolling modules)
    assert.strictEqual(FEATURE_MODULES.length, 9);

    // All must be enabled by default
    for (const mod of FEATURE_MODULES) {
      assert.strictEqual(DEFAULT_ENABLED_MODULES[mod.id], true);
      assert.strictEqual(isFeatureEnabled(DEFAULT_USER_PROFILE, mod.id), true);
    }

    // Toggling off one module works correctly
    const modifiedProfile: UserProfile = {
      ...DEFAULT_USER_PROFILE,
      enabledModules: {
        ...DEFAULT_USER_PROFILE.enabledModules,
        socratic_sparring: false
      }
    };

    assert.strictEqual(isFeatureEnabled(modifiedProfile, 'socratic_sparring'), false);
    assert.strictEqual(isFeatureEnabled(modifiedProfile, 'sound_grounding'), true);
  });

  it('6. Subtitle substance guard: rejects stubs like "Comments" in favor of substantial sentences', () => {
    assert.strictEqual(isSubstantialSubtitle('Comments'), false);
    assert.strictEqual(isSubstantialSubtitle('Comments (42)'), false);
    assert.strictEqual(isSubstantialSubtitle('Kommentare'), false);
    assert.strictEqual(isSubstantialSubtitle('Zu kurz.'), false);
    assert.strictEqual(
      isSubstantialSubtitle('Ein fundierter und substantieller Satz mit mindestens sechs Worten für eine klare Einordnung.'),
      true
    );

    const stubEntry: RawFeedEntry = {
      id: 'test-stub-entry',
      sourceId: 'arch-source',
      title: 'Neue archäologische Entdeckungen in Pergamon',
      link: 'https://example.com/archaeologie',
      publishedAt: '2026-10-17T12:00:00Z',
      summary: 'Comments. Bei Ausgrabungen im antiken Pergamon entdeckten Forscher eine bemerkenswerte römische Thermenanlage mit intakten Mosaikböden.'
    };

    const dummySource: RawFeedSource = {
      id: 'arch-source',
      name: 'Archäologie Aktuell',
      url: 'https://example.com/rss',
      primaryTopic: 'science_society',
      topics: ['science_society'],
      language: 'de',
      defaultEvidenceTier: 'publisher_excerpt'
    };

    const item = normalizeFeedEntry(stubEntry, dummySource);
    assert.ok(
      !item.subtitle.startsWith('Comments'),
      `Subtitle should not start with stub word "Comments", got: "${item.subtitle}"`
    );
    assert.ok(
      item.subtitle.includes('Pergamon entdeckten Forscher eine bemerkenswerte'),
      `Subtitle should fall back to substantial sentence, got: "${item.subtitle}"`
    );
  });
});
