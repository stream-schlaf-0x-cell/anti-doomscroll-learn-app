/**
 * Raindrop.io Integration Service
 * Connects atmen with Raindrop.io (REST API v1) for:
 * 1. Importing bookmarks & collections directly into the reading feed
 * 2. Deriving topic affinity & interest weights from Raindrop tags
 * 3. 1-Click saving of atmen articles to Raindrop.io
 * 4. Zero-credential Demo Mode for instant exploration
 */

import { FeedItem, TopicTag } from '../domain/types';
import { optimizeImageUrl } from '../utils/imageQuality';
import { appStorage, AtemStorage } from '../data/storage';

export interface RaindropUser {
  _id: number;
  name: string;
  email?: string;
  pro: boolean;
}

export interface RaindropCollection {
  _id: number;
  title: string;
  count: number;
  color?: string;
}

export interface RaindropItem {
  _id: number;
  title: string;
  excerpt: string;
  link: string;
  domain: string;
  tags: string[];
  cover: string;
  created: string;
  type: string;
  collectionId?: number;
}

export interface RaindropSyncResult {
  success: boolean;
  user?: RaindropUser;
  collections: RaindropCollection[];
  importedItems: FeedItem[];
  derivedInterests: Partial<Record<TopicTag, number>>;
  boostedDomains: string[];
  error?: string;
}

// Tag-to-Topic mapping heuristics for Raindrop
const TAG_TOPIC_MAPPING: Record<string, TopicTag> = {
  // Philosophy & Ethics
  philosophy: 'philosophy_ethics',
  philosophie: 'philosophy_ethics',
  ethik: 'philosophy_ethics',
  ethics: 'philosophy_ethics',
  stoizismus: 'philosophy_ethics',
  mind: 'philosophy_ethics',

  // AI & Tech
  ai: 'ai_apple',
  ki: 'ai_apple',
  llm: 'ai_apple',
  apple: 'ai_apple',
  machinelearning: 'ai_apple',
  software: 'ai_apple',
  tech: 'ai_apple',

  // Sound & Synthesis
  music: 'sound_synthesis',
  sound: 'sound_synthesis',
  synth: 'sound_synthesis',
  ambient: 'sound_synthesis',
  audio: 'sound_synthesis',
  modular: 'sound_synthesis',

  // Science & Ideas
  science: 'science_society',
  wissenschaft: 'science_society',
  physics: 'science_society',
  biology: 'science_society',
  society: 'science_society',
  politik: 'science_society',

  // Contemplation & Meditation
  meditation: 'contemplation_mind',
  mindfulness: 'contemplation_mind',
  achtsamkeit: 'contemplation_mind',
  buddhism: 'contemplation_mind',
  fokus: 'contemplation_mind',
  focus: 'contemplation_mind',

  // Education & Didactics
  education: 'german_didactics',
  schule: 'german_didactics',
  unterricht: 'german_didactics',
  didaktik: 'german_didactics',
  pedagogy: 'german_didactics',
  lernen: 'german_didactics',

  // Health & Biohacking
  health: 'health_biohacking',
  gesundheit: 'health_biohacking',
  biohacking: 'health_biohacking',
  sleep: 'health_biohacking',
  neuroscience: 'health_biohacking',

  // Books
  books: 'book_mastery',
  buecher: 'book_mastery',
  reading: 'book_mastery',
  sachbuch: 'book_mastery'
};

export const DEMO_RAINDROP_BOOKMARKS: RaindropItem[] = [
  {
    _id: 801,
    title: 'How Continuous Attention Fractures Modern Thought',
    excerpt: 'An investigation into cognitive fragmentation in digital environments and the philosophical architecture required to reclaim prolonged attention.',
    link: 'https://aeon.co/essays/how-continuous-attention-fractures-thought',
    domain: 'aeon.co',
    tags: ['philosophy', 'mindfulness', 'focus', 'attention'],
    cover: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=1400&q=85',
    created: new Date().toISOString(),
    type: 'article',
    collectionId: 10
  },
  {
    _id: 802,
    title: 'The Harmonic Physics of Modular Sound Synthesis',
    excerpt: 'Exploring Don Buchla and Bob Moog’s divergent epistemologies of synthesis, and how voltage-controlled timbre sculpts listening awareness.',
    link: 'https://cdm.link/2024/03/harmonic-physics-modular-synthesis',
    domain: 'cdm.link',
    tags: ['synth', 'sound', 'modular', 'ambient'],
    cover: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=1400&q=85',
    created: new Date().toISOString(),
    type: 'article',
    collectionId: 20
  },
  {
    _id: 803,
    title: 'Frontier AI Reasoning Models and the Semantic Grounding Problem',
    excerpt: 'Can transformer architectures build true ontological understanding, or are they high-dimensional statistical mimics? A deep dive with cognitive science benchmarks.',
    link: 'https://www.quantamagazine.org/frontier-ai-reasoning-semantic-grounding',
    domain: 'quantamagazine.org',
    tags: ['ai', 'science', 'llm', 'tech'],
    cover: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1400&q=85',
    created: new Date().toISOString(),
    type: 'article',
    collectionId: 30
  },
  {
    _id: 804,
    title: 'Circadian Neuroscience: Adenosine Clearance and Deep Rest',
    excerpt: 'Evidence-based protocols from Stanford neurobiology on optimising slow-wave sleep cycles and using deliberate physiological sighs for acute stress regulation.',
    link: 'https://hubermanlab.com/circadian-neuroscience-deep-rest',
    domain: 'hubermanlab.com',
    tags: ['health', 'biohacking', 'sleep', 'neuroscience'],
    cover: 'https://images.unsplash.com/photo-1511295742362-92c96b124e52?auto=format&fit=crop&w=1400&q=85',
    created: new Date().toISOString(),
    type: 'article',
    collectionId: 40
  }
];

export class RaindropService {
  public static STORAGE_KEY_TOKEN = '@atem:raindrop_api_token:v1';
  private static API_BASE = 'https://api.raindrop.io/rest/v1';

  public static async getStoredToken(storage: AtemStorage = appStorage): Promise<string | null> {
    try {
      const token = await storage.getItem(this.STORAGE_KEY_TOKEN);
      return token && token.trim() ? token.trim() : null;
    } catch {
      return null;
    }
  }

  public static async setStoredToken(token: string, storage: AtemStorage = appStorage): Promise<void> {
    const clean = token.trim();
    if (!clean) {
      await storage.removeItem(this.STORAGE_KEY_TOKEN);
    } else {
      await storage.setItem(this.STORAGE_KEY_TOKEN, clean);
    }
  }

  public static async clearStoredToken(storage: AtemStorage = appStorage): Promise<void> {
    await storage.removeItem(this.STORAGE_KEY_TOKEN);
  }

  /**
   * Automatically pushes a bookmarked FeedItem to Raindrop.io if a token is configured.
   */
  public static async syncArticleIfConnected(
    article: FeedItem,
    storage: AtemStorage = appStorage
  ): Promise<{ synced: boolean; error?: string }> {
    const token = await this.getStoredToken(storage);
    if (!token) {
      return { synced: false };
    }
    const link = article.sourceReferences?.[0]?.originalUrl || article.canonicalUrl || 'https://atmen.app';
    const tags = Array.from(new Set([
      'atmen',
      article.primaryTopic,
      ...(article.space ? [article.space.replace(/^c\//, '')] : [])
    ]));
    const res = await this.saveToRaindrop(token, {
      title: article.title,
      link,
      excerpt: article.feedText || article.subtitle,
      tags
    });
    return { synced: res.success, error: res.error };
  }

  /**
   * Verifies a Raindrop Personal Access Token against the /user endpoint.
   */
  public static async verifyToken(token: string): Promise<{ success: boolean; user?: RaindropUser; error?: string }> {
    if (!token.trim()) {
      return { success: false, error: 'Kein Token übergeben' };
    }

    // Demo token fast-path
    if (token.trim() === 'demo' || token.trim() === 'test') {
      return {
        success: true,
        user: {
          _id: 42,
          name: 'Atem Explorer (Demo)',
          email: 'explorer@atmen.app',
          pro: true
        }
      };
    }

    try {
      const res = await fetch(`${this.API_BASE}/user`, {
        headers: {
          Authorization: `Bearer ${token.trim()}`
        }
      });

      if (!res.ok) {
        return {
          success: false,
          error: `Ungültiger Raindrop-Token (HTTP ${res.status}). Bitte prüfe den Token in den Raindrop-Einstellungen.`
        };
      }

      const json = await res.json();
      if (json.result && json.user) {
        return {
          success: true,
          user: {
            _id: json.user._id,
            name: json.user.name || 'Raindrop User',
            email: json.user.email,
            pro: Boolean(json.user.pro)
          }
        };
      }

      return { success: false, error: 'Unerwartetes Raindrop-Antwortformat' };
    } catch (e: any) {
      return {
        success: false,
        error: `Verbindungsfehler zu Raindrop: ${e.message || 'Netzwerkfehler'}`
      };
    }
  }

  /**
   * Fetches all user collections from Raindrop.
   */
  public static async getCollections(token: string): Promise<RaindropCollection[]> {
    if (token === 'demo' || token === 'test') {
      return [
        { _id: 0, title: 'Alle Lesezeichen', count: 4 },
        { _id: 10, title: 'Philosophie & Geist', count: 1, color: '#7E72B5' },
        { _id: 20, title: 'Klang & Modular', count: 1, color: '#B58952' },
        { _id: 30, title: 'KI & Wissenschaft', count: 1, color: '#5282B8' },
        { _id: 40, title: 'Gesundheit & Fokus', count: 1, color: '#4C917D' }
      ];
    }

    try {
      const res = await fetch(`${this.API_BASE}/collections`, {
        headers: { Authorization: `Bearer ${token.trim()}` }
      });
      if (!res.ok) return [];
      const json = await res.json();
      if (!json.items) return [];

      return json.items.map((c: any) => ({
        _id: c._id,
        title: c.title,
        count: c.count || 0,
        color: c.color
      }));
    } catch {
      return [];
    }
  }

  /**
   * Fetches bookmarks from Raindrop.
   */
  public static async getRaindrops(
    token: string,
    collectionId: number = 0,
    perpage: number = 25
  ): Promise<RaindropItem[]> {
    if (token === 'demo' || token === 'test') {
      return collectionId === 0
        ? DEMO_RAINDROP_BOOKMARKS
        : DEMO_RAINDROP_BOOKMARKS.filter(b => b.collectionId === collectionId);
    }

    try {
      const res = await fetch(`${this.API_BASE}/raindrops/${collectionId}?perpage=${perpage}`, {
        headers: { Authorization: `Bearer ${token.trim()}` }
      });
      if (!res.ok) return [];
      const json = await res.json();
      if (!json.items) return [];

      return json.items.map((r: any) => ({
        _id: r._id,
        title: r.title,
        excerpt: r.excerpt || '',
        link: r.link,
        domain: r.domain || (() => {
          try { return new URL(r.link).hostname.replace(/^www\./, ''); } catch { return 'raindrop.io'; }
        })(),
        tags: Array.isArray(r.tags) ? r.tags : [],
        cover: optimizeImageUrl(r.cover),
        created: r.created || new Date().toISOString(),
        type: r.type || 'link',
        collectionId: r.collection?.$id
      }));
    } catch {
      return [];
    }
  }

  /**
   * Analyzes tag frequencies and domains from Raindrop bookmarks to derive an
   * intentional profile vector for the atmen recommendation engine.
   */
  public static deriveProfileFromRaindrop(bookmarks: RaindropItem[]): {
    interests: Partial<Record<TopicTag, number>>;
    boostedDomains: string[];
    tagCounts: Record<string, number>;
  } {
    const topicScores: Record<string, number> = {};
    const domainCounts: Record<string, number> = {};
    const tagCounts: Record<string, number> = {};

    for (const b of bookmarks) {
      if (b.domain) {
        domainCounts[b.domain] = (domainCounts[b.domain] || 0) + 1;
      }

      for (const t of b.tags) {
        const clean = t.toLowerCase().trim();
        tagCounts[clean] = (tagCounts[clean] || 0) + 1;
        const mappedTopic = TAG_TOPIC_MAPPING[clean];
        if (mappedTopic) {
          topicScores[mappedTopic] = (topicScores[mappedTopic] || 0) + 1;
        }
      }
    }

    // Convert raw counts into calibrated weights between 0.65 and 0.95
    const interests: Partial<Record<TopicTag, number>> = {};
    const maxScore = Math.max(1, ...Object.values(topicScores));

    for (const [topic, score] of Object.entries(topicScores)) {
      const normalized = 0.65 + (score / maxScore) * 0.30;
      interests[topic as TopicTag] = Math.round(normalized * 100) / 100;
    }

    // Identify top bookmarked domains (at least 1 bookmark)
    const boostedDomains = Object.entries(domainCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([domain]) => domain);

    return {
      interests,
      boostedDomains,
      tagCounts
    };
  }

  /**
   * Converts a Raindrop bookmark into a schema-valid atmen FeedItem
   * so users can read their saved bookmarks in the editorial magazine reader.
   */
  public static convertRaindropToFeedItem(b: RaindropItem, index: number = 0): FeedItem {
    // Determine best matching primary topic from tags
    let primaryTopic: TopicTag = 'science_society';
    for (const t of b.tags) {
      const mapped = TAG_TOPIC_MAPPING[t.toLowerCase().trim()];
      if (mapped) {
        primaryTopic = mapped;
        break;
      }
    }

    const readingMinutes = Math.max(2, Math.min(10, Math.ceil((b.excerpt.length + 300) / 150)));

    return {
      id: `raindrop-${b._id || index}`,
      type: 'deep_dive',
      format: 'concise_insight',
      title: b.title || 'Lesezeichen ohne Titel',
      subtitle: `Gespeichert in Raindrop.io • ${b.tags.map(t => `#${t}`).join(' ') || b.domain}`,
      feedText: b.excerpt || 'Lesezeichen aus deiner persönlichen Raindrop.io Sammlung.',
      articleBody: `${b.excerpt}\n\nDieser Beitrag stammt aus deiner persönlichen Raindrop.io Bibliothek. Du kannst den Originalartikel direkt bei ${b.domain} im Volltext vertiefen.`,
      body: b.excerpt || 'Lesezeichen aus deiner Raindrop.io Bibliothek.',
      topics: [primaryTopic],
      primaryTopic,
      sourceReferences: [
        {
          publisher: b.domain,
          originalUrl: b.link,
          title: b.title,
          retrievalTimestamp: new Date().toISOString(),
          isVerified: true
        }
      ],
      publishedAt: b.created,
      generatedAt: new Date().toISOString(),
      estimatedReadingMinutes: readingMinutes,
      relevanceExplanation: `Aus deiner persönlichen Raindrop.io Sammlung importiert (${b.tags.join(', ') || b.domain}).`,
      contentStatus: 'scientific_analysis',
      isDailyEdition: true,
      editionDate: new Date().toISOString().slice(0, 10),
      isDemonstration: false,
      aiAssisted: false,
      factReviewStatus: 'scientific_paper',
      provenanceSummary: `Persönliches Lesezeichen via Raindrop.io (${b.domain})`,
      wordCount: (b.excerpt?.split(/\s+/).length || 40) + 120,
      evidenceTier: 'permitted_full_text',
      contentOrigin: 'live_ingested',
      contentHash: `raindrop-${b._id}`,
      canonicalUrl: b.link,
      imageUrl: optimizeImageUrl(b.cover),
      space: `c/${primaryTopic}`,
      flair: '💧 Raindrop Bookmark',
      keyInsight: b.excerpt?.slice(0, 120) || 'Lesezeichen aus Raindrop.io',
      upvotesCount: 88,
      awardsCount: { gold: 0, brain: 0, spark: 0 },
      sourceTrustLevel: 'community_curated',
      isTeachingRelated: false,
      isChallengingPerspective: false,
      comments: []
    };
  }

  /**
   * Saves an atmen article directly to the user's Raindrop.io account.
   */
  public static async saveToRaindrop(
    token: string,
    article: { title: string; link: string; excerpt?: string; tags?: string[] }
  ): Promise<{ success: boolean; error?: string }> {
    if (token === 'demo' || token === 'test') {
      return { success: true };
    }

    try {
      const res = await fetch(`${this.API_BASE}/raindrop`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token.trim()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: article.title,
          link: article.link,
          excerpt: article.excerpt || '',
          tags: article.tags || ['atmen', 'focus'],
          pleaseParse: {}
        })
      });

      if (!res.ok) {
        return { success: false, error: `Speichern fehlgeschlagen (HTTP ${res.status})` };
      }

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message || 'Netzwerkfehler' };
    }
  }
}
