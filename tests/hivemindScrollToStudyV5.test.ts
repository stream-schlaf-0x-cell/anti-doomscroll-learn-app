import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AtemStorage, MemoryStorageDriver } from '../src/core/data/storage';
import { FeedItemSchema } from '../src/core/domain/types';
import {
  HivemindLearningService,
  HIVEMIND_TRACKS_STORAGE_KEY,
  generateHivemindLearningTrack,
  extractTextFromUploadedFile,
  parsePdfBufferTextFallback,
  buildShowcaseStarterTracks
} from '../src/core/learning/hivemindLearningService';
import { mergeSyncSnapshots, AtmenSyncSnapshot } from '../src/core/sync/cloudSyncService';
import { satisfiesDefaultCuratedStandard, satisfiesCuratedBodyContract } from '../src/core/enrichment/batchEnricher';

describe('Atmen Hivemind — Scroll to Study V5 (Learning Tracks, 4-Tier Memes, Dual Modes & Cloud Sync)', () => {
  it('1. Starts Hivemind clean/empty with zero pre-seeded demo tracks and purges legacy demo tracks while keeping user tracks', async () => {
    const storage = new AtemStorage(new MemoryStorageDriver());
    const service = new HivemindLearningService();
    const initialTracks = await service.getTracks(storage);
    assert.equal(initialTracks.length, 0, 'Hivemind must start empty with 0 pre-seeded demo tracks');

    // Showcase track builders still produce valid 12-card schemas if needed in unit helpers
    const legacyDemoTracks = buildShowcaseStarterTracks();
    assert.equal(legacyDemoTracks.length, 2);
    const romanTrack = legacyDemoTracks[0];
    assert.equal(romanTrack.items.length, 12);
    for (const item of romanTrack.items) {
      const parsed = FeedItemSchema.safeParse(item);
      assert.equal(parsed.success, true, `Card ${item.id} must validate against FeedItemSchema`);
      assert.equal(satisfiesCuratedBodyContract(item), true);
      assert.equal(satisfiesDefaultCuratedStandard(item), true);
    }

    const memeCards = romanTrack.items.filter(
      i => (i.hivemindMeta?.cardArchetype || i.memeMeta?.cardArchetype) === 'expanding_brain_meme'
    );
    assert.ok(memeCards.length >= 2, 'Should include 4-tier escalation concept memes');
    const stages = memeCards[0].hivemindMeta?.escalationStages || memeCards[0].memeMeta?.escalationStages || [];
    assert.equal(stages.length, 4, 'Expanding brain meme must have 4 escalation stages');

    // Verify seeding legacy demo tracks + a user track results in ONLY the user track surviving getTracks()
    const userTrack = {
      ...romanTrack,
      id: 'track-user-kant-epistemologie',
      title: 'Kants Epistemologie',
      items: romanTrack.items.map((it, idx) => ({
        ...it,
        id: `user-kant-step-${idx + 1}`,
        hivemindMeta: it.hivemindMeta ? { ...it.hivemindMeta, trackId: 'track-user-kant-epistemologie' } : undefined
      }))
    };
    await storage.setItem(HIVEMIND_TRACKS_STORAGE_KEY, JSON.stringify([...legacyDemoTracks, userTrack]));
    const cleaned = await service.getTracks(storage);
    assert.equal(cleaned.length, 1, 'Legacy Rome & Quantum demo tracks must be purged automatically');
    assert.equal(cleaned[0].id, 'track-user-kant-epistemologie');
  });

  it('2. Generates a >= 10 card HivemindLearningTrack from a topic/book or uploaded PDF/text buffer across all 4 archetypes', async () => {
    // Test pure-TS PDF buffer text extraction fallback
    const samplePdfContent = `%PDF-1.4
1 0 obj
<< /Length 200 >>
stream
BT
/F1 12 Tf
(Epistemologie und Kuenstliche Intelligenz: Wie Sprachmodelle Wissen konstruieren und warum kritische Urteilskraft im Unterricht unverzichtbar bleibt.) Tj
(Zweiter Abschnitt: Sokrates trifft auf statistische Mustererkennung und hinterfragt scheinbare Gewissheiten durch gezielte Gegenbeispiele.) Tj
ET
endstream
endobj`;
    const pdfBytes = new TextEncoder().encode(samplePdfContent);
    const extractedPdfText = parsePdfBufferTextFallback(pdfBytes);
    assert.ok(
      extractedPdfText.includes('Epistemologie und Kuenstliche Intelligenz'),
      'PDF fallback parser should extract text operators from PDF stream'
    );

    const extractedFromFile = await extractTextFromUploadedFile(pdfBytes, 'epistemologie-ki.pdf');
    assert.ok(extractedFromFile.includes('Sokrates trifft auf statistische Mustererkennung'));

    // Generate learning track deterministically without requiring live API key
    const track = await generateHivemindLearningTrack({
      titleOrTopic: 'Epistemologie & KI im Unterricht',
      sourceType: 'pdf_document',
      sourceLabel: 'epistemologie-ki.pdf',
      rawText: extractedFromFile,
      mixIntoMainFeed: true,
      cardCount: 12
    });

    assert.ok(track.items.length >= 10, `Expected >= 10 cards, got ${track.items.length}`);
    assert.equal(track.totalItemsCount, track.items.length);
    assert.equal(track.progressPercent, 0);

    const archetypes = new Set(
      track.items.map(i => i.hivemindMeta?.cardArchetype || i.memeMeta?.cardArchetype)
    );
    assert.ok(archetypes.has('story_thread'), 'Must contain story_thread cards');
    assert.ok(archetypes.has('expanding_brain_meme'), 'Must contain expanding_brain_meme cards');
    assert.ok(archetypes.has('discourse_replies'), 'Must contain discourse_replies cards');
    assert.ok(archetypes.has('milestone_quiz'), 'Must contain milestone_quiz cards');

    for (const item of track.items) {
      const parsed = FeedItemSchema.safeParse(item);
      assert.equal(parsed.success, true, `Generated card ${item.id} must pass Zod schema`);
      const meta = item.hivemindMeta || item.memeMeta;
      assert.ok(meta?.trackId === track.id);
      assert.ok((meta?.stepIndex ?? 0) >= 1);
      assert.equal(meta?.totalSteps, track.items.length);

      if (meta?.cardArchetype === 'expanding_brain_meme') {
        assert.equal(meta.escalationStages?.length, 4);
      }
      if (meta?.cardArchetype === 'discourse_replies') {
        assert.ok((meta.simulatedReplies?.length ?? 0) >= 2);
      }
      if (meta?.cardArchetype === 'milestone_quiz') {
        assert.ok(item.quiz, 'Milestone quiz card must include an interactive quiz object');
        assert.equal(item.quiz?.options.length, 4);
      }
    }
  });

  it('3. Accurately updates completedItemIds and progressPercent (0% -> ... -> 100%) when steps are marked completed', async () => {
    const storage = new AtemStorage(new MemoryStorageDriver());
    const service = new HivemindLearningService();
    const baseTemplate = buildShowcaseStarterTracks()[0];
    const customTrack = {
      ...baseTemplate,
      id: 'track-user-progress-test',
      title: 'Benutzer-Lernpfad Ethik',
      items: baseTemplate.items.map((it, idx) => ({
        ...it,
        id: `user-progress-step-${idx + 1}`,
        hivemindMeta: it.hivemindMeta ? { ...it.hivemindMeta, trackId: 'track-user-progress-test' } : undefined
      }))
    };
    await service.saveTrack(customTrack, storage);

    const tracks = await service.getTracks(storage);
    const track = tracks[0];
    assert.equal(track.progressPercent, 0);
    assert.equal(track.completedItemIds.length, 0);

    // Complete 3 of 12 steps -> 25%
    await service.markItemCompleted(track.id, track.items[0].id, storage);
    await service.markItemCompleted(track.id, track.items[1].id, storage);
    const after3 = await service.markItemCompleted(track.id, track.items[2].id, storage);

    assert.ok(after3);
    assert.equal(after3.completedItemIds.length, 3);
    assert.equal(after3.progressPercent, 25);

    // Duplicate completion should be idempotent
    const afterDup = await service.markItemCompleted(track.id, track.items[0].id, storage);
    assert.equal(afterDup?.completedItemIds.length, 3);
    assert.equal(afterDup?.progressPercent, 25);

    // Complete all remaining steps -> 100%
    let latest: Awaited<ReturnType<typeof service.markItemCompletedByItemId>> = after3;
    for (const item of track.items.slice(3)) {
      latest = await service.markItemCompletedByItemId(item.id, storage);
    }
    assert.ok(latest);
    assert.equal(latest.completedItemIds.length, 12);
    assert.equal(latest.progressPercent, 100);
  });

  it('4. Mode 2 (mixIntoMainFeed: true) interleaves unread learning cards into the main stream without duplicating completed cards', async () => {
    const storage = new AtemStorage(new MemoryStorageDriver());
    const service = new HivemindLearningService();
    const baseTemplate = buildShowcaseStarterTracks()[0];
    const customTrack = {
      ...baseTemplate,
      id: 'track-user-interleave-test',
      title: 'Benutzer-Lernpfad Erkenntnistheorie',
      items: baseTemplate.items.map((it, idx) => ({
        ...it,
        id: `user-interleave-step-${idx + 1}`,
        hivemindMeta: it.hivemindMeta ? { ...it.hivemindMeta, trackId: 'track-user-interleave-test' } : undefined
      }))
    };
    await service.saveTrack(customTrack, storage);

    const tracks = await service.getTracks(storage);
    const track = tracks.find(t => t.id === 'track-user-interleave-test')!;

    // Mark step 1 and step 2 as already completed
    await service.markItemCompleted(track.id, track.items[0].id, storage);
    await service.markItemCompleted(track.id, track.items[1].id, storage);

    const updatedTracks = await service.getTracks(storage);
    const dripCards = service.getAmbientDripCards(updatedTracks, 2);

    // Must pick unread step 3 and step 4, never already completed step 1 or 2
    assert.equal(dripCards.length, 2);
    assert.equal(dripCards[0].id, track.items[2].id);
    assert.equal(dripCards[1].id, track.items[3].id);

    // Create 15 dummy main stream cards
    const dummyStream = Array.from({ length: 15 }, (_, idx) => ({
      ...track.items[0],
      id: `main-stream-card-${idx + 1}`,
      hivemindMeta: undefined,
      memeMeta: undefined,
      score: 10 - idx * 0.1
    }));

    const interleaved = service.interleaveAmbientDripCards(
      dummyStream,
      updatedTracks,
      item => ({ ...item, score: 9.5 }),
      5
    );

    assert.equal(interleaved.length, 17, 'Should weave 2 unread drip cards into the 15-card stream');
    const interleavedIds = interleaved.map(i => i.id);
    assert.equal(interleavedIds.includes(track.items[0].id), false, 'Completed card 1 must NOT be interleaved');
    assert.equal(interleavedIds.includes(track.items[1].id), false, 'Completed card 2 must NOT be interleaved');
    assert.equal(interleavedIds.includes(track.items[2].id), true, 'Unread card 3 MUST be interleaved');
    assert.equal(interleavedIds.includes(track.items[3].id), true, 'Unread card 4 MUST be interleaved');
  });

  it('5. Deterministically merges hivemindTracks and unions completedItemIds across devices in cloudSyncService', () => {
    const starter = buildShowcaseStarterTracks();
    const trackA = starter[0]; // 12 items

    const localSnap: AtmenSyncSnapshot = {
      version: 1,
      deviceId: 'device-iphone',
      updatedAt: '2026-11-07T15:00:00.000Z',
      hivemindTracks: [
        {
          ...trackA,
          completedItemIds: [trackA.items[0].id, trackA.items[1].id],
          progressPercent: 17,
          mixIntoMainFeed: true,
          updatedAt: '2026-11-07T15:00:00.000Z'
        }
      ],
      deletedHivemindTrackIds: []
    };

    const remoteSnap: AtmenSyncSnapshot = {
      version: 1,
      deviceId: 'device-macbook',
      updatedAt: '2026-11-07T16:00:00.000Z',
      hivemindTracks: [
        {
          ...trackA,
          completedItemIds: [trackA.items[1].id, trackA.items[2].id, trackA.items[3].id],
          progressPercent: 25,
          mixIntoMainFeed: false,
          updatedAt: '2026-11-07T16:00:00.000Z'
        },
        starter[1]
      ],
      deletedHivemindTrackIds: []
    };

    const merged = mergeSyncSnapshots(localSnap, remoteSnap);
    assert.ok(merged.hivemindTracks);
    assert.equal(merged.hivemindTracks.length, 2);

    const mergedRoman = merged.hivemindTracks.find(t => t.id === trackA.id)!;
    assert.ok(mergedRoman);
    // Union of [0, 1] and [1, 2, 3] => 4 completed items out of 12 => 33%
    assert.equal(mergedRoman.completedItemIds.length, 4);
    assert.equal(mergedRoman.progressPercent, 33);
    assert.equal(mergedRoman.mixIntoMainFeed, false, 'Newer timestamp should win for mixIntoMainFeed toggle');
  });

  it('6. Decompresses FlateDecode PDF streams via DecompressionStream and throws an honest error on unreadable/scanned PDFs', async () => {
    const zlib = await import('zlib');
    const { extractTextFromUploadedFile } = await import('../src/core/learning/hivemindLearningService');

    const streamContent = 'BT /F1 12 Tf 72 712 Td (Kant und die Kritik der reinen Vernunft untersucht apriorische Erkenntnisformen in aller Tiefe.) Tj ET';
    const compressed = zlib.deflateSync(Buffer.from(streamContent, 'latin1'));
    const header = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Length ' + compressed.length + ' /Filter /FlateDecode >>\nstream\n', 'latin1');
    const footer = Buffer.from('\nendstream\nendobj\n%%EOF', 'latin1');
    const pdfBytes = Uint8Array.from(Buffer.concat([header, compressed, footer]));

    const extracted = await extractTextFromUploadedFile(pdfBytes, 'kant_skript.pdf');
    assert.ok(extracted.includes('Kritik der reinen Vernunft'), `Expected decompressed PDF text, got: ${extracted}`);

    // Compressed stream containing only graphics/scan binary -> explicit honest error
    const scanCompressed = zlib.deflateSync(Buffer.from('q 1 0 0 1 0 0 cm /Im0 Do Q', 'latin1'));
    const scanPdf = Uint8Array.from(Buffer.concat([
      Buffer.from('%PDF-1.4\n1 0 obj\n<< /Length ' + scanCompressed.length + ' /Filter /FlateDecode >>\nstream\n', 'latin1'),
      scanCompressed,
      Buffer.from('\nendstream\nendobj\n%%EOF', 'latin1')
    ]));
    await assert.rejects(
      () => extractTextFromUploadedFile(scanPdf, 'scan.pdf'),
      /kein auslesbarer Text/i
    );
  });
});
