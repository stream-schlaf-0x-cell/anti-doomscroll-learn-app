import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  MusicRecommendationService,
  CURATED_SOUND_MASTERS
} from '../src/core/music/musicRecommendationService';

describe('MusicRecommendationService (iTunes & Spotify Grounding)', () => {
  it('loads curated sound and focus tracks with complete metadata', () => {
    const tracks = MusicRecommendationService.getCuratedTracks();
    assert.ok(tracks.length >= 6, `Expected at least 6 curated tracks, got ${tracks.length}`);

    // Verify key pioneers exist
    const eno = tracks.find(t => t.artist === 'Brian Eno');
    assert.ok(eno, 'Expected Brian Eno in curated sound masters');
    assert.ok(eno.previewUrl.includes('audio-ssl.itunes.apple.com'), 'Expected valid iTunes audio preview stream URL');
    assert.ok(eno.appleMusicUrl.includes('music.apple.com'), 'Expected Apple Music link');
    assert.ok(eno.spotifyUrl.includes('open.spotify.com'), 'Expected Spotify search link');
    assert.ok(eno.artworkUrl.includes('600x600'), 'Expected upscaled high-res artwork URL');

    const frahm = tracks.find(t => t.artist === 'Nils Frahm');
    assert.ok(frahm, 'Expected Nils Frahm in curated masters');
    assert.strictEqual(frahm.title, 'Says');

    const hopkins = tracks.find(t => t.artist.includes('Jon Hopkins'));
    assert.ok(hopkins, 'Expected Jon Hopkins in curated masters');

    const ciani = tracks.find(t => t.artist.includes('Suzanne Ciani'));
    assert.ok(ciani, 'Expected Buchla pioneer Suzanne Ciani in curated masters');
  });

  it('formats audio track duration correctly in MM:SS', () => {
    assert.strictEqual(MusicRecommendationService.formatDuration(266), '4:26');
    assert.strictEqual(MusicRecommendationService.formatDuration(502), '8:22');
    assert.strictEqual(MusicRecommendationService.formatDuration(65), '1:05');
    assert.strictEqual(MusicRecommendationService.formatDuration(undefined), '30s Vorschau');
  });

  it('searches for tracks and matches query against title and artist', async () => {
    const results = await MusicRecommendationService.searchITunesTracks('Eno', 5);
    assert.ok(results.length > 0, 'Expected results for query "Eno"');
    assert.ok(
      results.some(r => r.artist.toLowerCase().includes('eno') || r.title.toLowerCase().includes('eno')),
      'Expected Eno in result'
    );
  });
});
