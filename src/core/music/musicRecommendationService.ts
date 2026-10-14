/**
 * Music & Sound Recommendation Service
 * Leverages the public Apple iTunes Search API (100% free, no API key required)
 * and Spotify web integrations to ground the atmen recommendation engine
 * with focus, ambient, and modular synthesis acoustics.
 */

export interface MusicTrackItem {
  id: string;
  title: string;
  artist: string;
  album: string;
  artworkUrl: string;
  previewUrl: string; // 30-second AAC audio preview stream
  appleMusicUrl: string;
  spotifyUrl: string;
  durationSeconds?: number;
  acousticProfile: string;
  whyRecommended: string;
  genre?: string;
  releaseYear?: string;
}

export const CURATED_SOUND_MASTERS: MusicTrackItem[] = [
  {
    id: 'music-eno-ending-ascent',
    title: 'An Ending (Ascent)',
    artist: 'Brian Eno',
    album: 'Apollo: Atmospheres and Soundtracks',
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/08/9d/5e/089d5e38-fc33-6535-6e44-d8904791a87e/00602577607753.rgb.jpg/600x600bb.jpg',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/bf/20/df/bf20df6d-55e1-887e-e2e7-d250c95029a7/mzaf_13506140026244793664.plus.aac.p.m4a',
    appleMusicUrl: 'https://music.apple.com/album/an-ending-ascent/1458928421?i=1458928433',
    spotifyUrl: 'https://open.spotify.com/search/Brian%20Eno%20An%20Ending%20Ascent',
    durationSeconds: 266,
    acousticProfile: 'Ambient Masterpiece • Zero-Beat Kognition • Tiefenentspannung',
    whyRecommended: 'Reduziert kortikale Erregung und fördert Alpha-Wellen im Gehirn für tiefste Kontemplation.',
    genre: 'Ambient / Electronic',
    releaseYear: '1983'
  },
  {
    id: 'music-nils-frahm-says',
    title: 'Says',
    artist: 'Nils Frahm',
    album: 'Spaces',
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music114/v4/80/7e/76/807e7616-e41c-2c96-6169-dc3498807d88/4050486987483_3000.jpg/600x600bb.jpg',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/e5/2d/e9/e52de934-297c-7a32-cf95-9fb9bdf232b6/mzaf_16489390231940984920.plus.aac.p.m4a',
    appleMusicUrl: 'https://music.apple.com/album/says/717462158?i=717462319',
    spotifyUrl: 'https://open.spotify.com/search/Nils%20Frahm%20Says',
    durationSeconds: 518,
    acousticProfile: 'Analoger Synthesizer (Juno 60) • Arpeggio-Meditation • Fokus',
    whyRecommended: 'Wunderschöne mikrotonale Steigerung, die kognitive Monotonie durchbricht ohne abzulenken.',
    genre: 'Neoklassik / Ambient',
    releaseYear: '2013'
  },
  {
    id: 'music-hopkins-sit-around-fire',
    title: 'Sit Around the Fire',
    artist: 'Jon Hopkins, Ram Dass & East Forest',
    album: 'Music for Psychedelic Therapy',
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/91/9f/e6/919fe6a9-83bc-23ff-6916-2c1b1c3c90e9/887828045663.rgb.jpg/600x600bb.jpg',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/6b/6a/c5/6b6ac596-f645-a764-77e4-20fc4569df8b/mzaf_11300995166401099684.plus.aac.p.m4a',
    appleMusicUrl: 'https://music.apple.com/album/sit-around-the-fire/1582297177?i=1582297380',
    spotifyUrl: 'https://open.spotify.com/search/Jon%20Hopkins%20Sit%20Around%20the%20Fire',
    durationSeconds: 502,
    acousticProfile: 'Klang-Resonanz • Achtsamkeit • Sokratische Gelassenheit',
    whyRecommended: 'Kombiniert meditative Raumakustik mit Ram Dass’ zeitloser Reflexion über das Loslassen.',
    genre: 'Electronic / Contemplation',
    releaseYear: '2021'
  },
  {
    id: 'music-ciani-quadraphonic',
    title: 'Morning Spring',
    artist: 'Suzanne Ciani',
    album: 'Seven Waves',
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/02/76/8a/02768a35-1d67-6ec7-91f8-8a82753a6db6/888831613768.jpg/600x600bb.jpg',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview114/v4/d5/d3/18/d5d31872-9112-939e-2895-4674d8520c15/mzaf_16864190805177002075.plus.aac.p.m4a',
    appleMusicUrl: 'https://music.apple.com/album/morning-spring/1078713214?i=1078713589',
    spotifyUrl: 'https://open.spotify.com/search/Suzanne%20Ciani%20Morning%20Spring',
    durationSeconds: 384,
    acousticProfile: 'Buchla 200 Modular Synthese • Wellenphysik • Organischer Klang',
    whyRecommended: 'Pionierarbeit der analogen Klangerzeugung – moduliert natürliche Wellenmuster für Flow-Zustände.',
    genre: 'Modular Synth / Ambient',
    releaseYear: '1982'
  },
  {
    id: 'music-aphex-stone-in-focus',
    title: 'Rhubarb (#3)',
    artist: 'Aphex Twin',
    album: 'Selected Ambient Works Volume II',
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/d8/d5/b6/d8d5b6ee-5cb9-8979-2426-5b4c05342a35/801061802131.png/600x600bb.jpg',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/db/c1/96/dbc196ce-63c6-eb4f-3765-b1a8d56b0d91/mzaf_17724838426027376785.plus.aac.p.m4a',
    appleMusicUrl: 'https://music.apple.com/album/rhubarb/282478726?i=282478738',
    spotifyUrl: 'https://open.spotify.com/search/Aphex%20Twin%20Rhubarb',
    durationSeconds: 464,
    acousticProfile: 'Mikrotonale Drones • Zeitdilatation • Tiefenreflexion',
    whyRecommended: 'Minimalistische Synthesizer-Chöre erzeugen einen mentalen Schutzraum gegen digitale Reizüberflutung.',
    genre: 'IDM / Ambient',
    releaseYear: '1994'
  },
  {
    id: 'music-richter-dream-3',
    title: 'Dream 3 (in the midst of my life)',
    artist: 'Max Richter',
    album: 'From Sleep',
    artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/cb/43/0e/cb430ec2-03f1-d009-17d4-eebaa16a30eb/00028947952930.rgb.jpg/600x600bb.jpg',
    previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/44/14/d6/4414d642-e160-c3d3-7d9a-c11956aa4172/mzaf_15629471714578912959.plus.aac.p.m4a',
    appleMusicUrl: 'https://music.apple.com/album/dream-3-in-the-midst-of-my-life/1440854449?i=1440854452',
    spotifyUrl: 'https://open.spotify.com/search/Max%20Richter%20Dream%203',
    durationSeconds: 604,
    acousticProfile: 'Schlafforschung • Streicher & Sub-Bass • Theta-Frequenz',
    whyRecommended: 'Entwickelt in Zusammenarbeit mit Neurowissenschaftlern zur Beruhigung des vegetativen Nervensystems.',
    genre: 'Modern Classical',
    releaseYear: '2015'
  }
];

export class MusicRecommendationService {
  /**
   * Searches Apple iTunes Search API for tracks matching an acoustic query.
   * Free public API, no authentication token required.
   */
  public static async searchITunesTracks(query: string, limit: number = 8): Promise<MusicTrackItem[]> {
    try {
      const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=${limit}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`iTunes API returned status ${res.status}`);
      const data = await res.json();

      if (!data.results || !Array.isArray(data.results)) {
        return [];
      }

      return data.results
        .filter((r: any) => r.previewUrl) // only tracks with playable 30s audio previews
        .map((r: any) => ({
          id: `itunes-${r.trackId}`,
          title: r.trackName,
          artist: r.artistName,
          album: r.collectionName || 'Single / EP',
          artworkUrl: (r.artworkUrl100 || '').replace('100x100bb.jpg', '600x600bb.jpg'),
          previewUrl: r.previewUrl,
          appleMusicUrl: r.trackViewUrl || `https://music.apple.com/search?term=${encodeURIComponent(r.trackName + ' ' + r.artistName)}`,
          spotifyUrl: `https://open.spotify.com/search/${encodeURIComponent(r.trackName + ' ' + r.artistName)}`,
          durationSeconds: r.trackTimeMillis ? Math.round(r.trackTimeMillis / 1000) : undefined,
          acousticProfile: `${r.primaryGenreName || 'Klang'} • iTunes & Spotify Empfehlung`,
          whyRecommended: `Akustisch passende Referenz für vertieftes Arbeiten und Sound-Synthese.`,
          genre: r.primaryGenreName,
          releaseYear: r.releaseDate ? new Date(r.releaseDate).getFullYear().toString() : undefined
        }));
    } catch {
      // Fallback to curated tracks filtered by query
      const lower = query.toLowerCase();
      return CURATED_SOUND_MASTERS.filter(m =>
        m.title.toLowerCase().includes(lower) ||
        m.artist.toLowerCase().includes(lower) ||
        m.genre?.toLowerCase().includes(lower)
      );
    }
  }

  /**
   * Returns curated focus & ambient sound recommendations
   */
  public static getCuratedTracks(): MusicTrackItem[] {
    return CURATED_SOUND_MASTERS;
  }

  /**
   * Formats duration in MM:SS
   */
  public static formatDuration(seconds?: number): string {
    if (!seconds) return '30s Vorschau';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }
}
