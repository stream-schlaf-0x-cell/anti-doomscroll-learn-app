/**
 * Foundational Canon Service (Ur-Fundament & Unabhängiger Wissens-Kanon)
 * 
 * Preserves the exact bookmarks, topics, and cognitive weights imported
 * from Raindrop.io as a permanent, standalone foundation.
 * 
 * Completely decouples atmen from Raindrop.io:
 * Even if tokens expire, APIs change, or offline, this foundational canon
 * serves as the immutable ground-truth of what the recommendation engine
 * and editorial magazine were originally built upon.
 */

import { FeedItem, TopicTag } from '../domain/types';
import { RaindropItem } from '../raindrop/raindropService';
import { appStorage, CorruptedDataError } from '../data/storage';

export interface FoundationalCanon {
  id: string;
  name: string;
  savedAt: string;
  description: string;
  provenance: string;
  totalBookmarks: number;
  totalArticles: number;
  boostedDomains: string[];
  derivedWeights: Partial<Record<TopicTag, number>>;
  bookmarks: RaindropItem[];
  canonicalItems: FeedItem[];
  epistemicManifesto: string;
}

export const INITIAL_FOUNDATIONAL_CANON: FoundationalCanon = {
  id: 'canon-seed-2026',
  name: 'atmen Ur-Fundament (Vorbereiteter Seed-Datensatz)',
  savedAt: '2026-10-14T20:00:00.000Z',
  description: 'Epistemischer Initialbestand zur Orientierung vor einer persönlichen Raindrop-Synchronisation.',
  provenance: 'Vorbereiteter Basis-Kanon (Initialer Seed-Datensatz vor Raindrop-Synchronisation)',
  totalBookmarks: 4,
  totalArticles: 4,
  boostedDomains: ['aeon.co', 'cdm.link', 'quantamagazine.org', 'hubermanlab.com'],
  derivedWeights: {
    philosophy_ethics: 0.95,
    sound_synthesis: 0.90,
    ai_apple: 0.88,
    health_biohacking: 0.85,
    contemplation_mind: 0.80
  },
  bookmarks: [
    {
      _id: 801,
      title: 'How Continuous Attention Fractures Modern Thought',
      excerpt: 'An investigation into cognitive fragmentation in digital environments and the philosophical architecture required to reclaim prolonged attention.',
      link: 'https://aeon.co/essays/how-continuous-attention-fractures-thought',
      domain: 'aeon.co',
      tags: ['philosophy', 'mindfulness', 'focus', 'attention'],
      cover: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=1400&q=85',
      created: '2026-10-14T20:00:00.000Z',
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
      created: '2026-10-14T20:30:00.000Z',
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
      created: '2026-10-14T21:00:00.000Z',
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
      created: '2026-10-14T21:30:00.000Z',
      type: 'article',
      collectionId: 40
    }
  ],
  canonicalItems: [],
  epistemicManifesto: 'Dieses Fundament sichert die ursprünglichen Quellen und Kognitionsgewichte der Seed-Phase. Es garantiert, dass atmen auf verlässliche, tiefgründige Denktraditionen aufbaut, ohne jemals von externen APIs oder Datenverlust abhängig zu sein.'
};

export class FoundationalCanonService {
  private static STORAGE_KEY = '@atem:foundational_canon';
  private static CORRUPTED_BACKUP_KEY_PREFIX = '@atem:foundational_canon:corrupted:';

  /**
   * Saves a foundational canon snapshot to persistent local storage.
   */
  public static async saveCanon(canon: FoundationalCanon): Promise<void> {
    await appStorage.setItem(this.STORAGE_KEY, JSON.stringify(canon));
  }

  /**
   * Retrieves the foundational canon. If none has been saved, returns the initial seed canon.
   * Throws CorruptedDataError when existing data cannot be parsed, preserving the raw content.
   */
  public static async getCanon(): Promise<FoundationalCanon> {
    const raw = await appStorage.getItem(this.STORAGE_KEY);
    if (!raw) return INITIAL_FOUNDATIONAL_CANON;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.bookmarks)) {
        throw new Error('Ungültige Kanon-Struktur.');
      }
      return parsed as FoundationalCanon;
    } catch (err) {
      if (err instanceof CorruptedDataError) throw err;
      throw new CorruptedDataError(
        `Kanon-Speicherdaten beschädigt. Das rohe Abbild wurde erhalten.`,
        raw,
        err
      );
    }
  }

  /**
   * Safely recovers from a corrupted canon by preserving the raw corrupted payload
   * under a timestamped backup key, and replacing the active canon with a valid snapshot.
   */
  public static async recoverCanon(validReplacement: FoundationalCanon = INITIAL_FOUNDATIONAL_CANON): Promise<void> {
    const raw = await appStorage.getItem(this.STORAGE_KEY);
    if (raw) {
      const backupKey = `${this.CORRUPTED_BACKUP_KEY_PREFIX}${Date.now()}`;
      await appStorage.setItem(backupKey, raw);
    }
    await this.saveCanon(validReplacement);
  }

  /**
   * Creates a snapshot from active bookmarks and profile state.
   */
  public static createSnapshot(params: {
    name?: string;
    description?: string;
    bookmarks: RaindropItem[];
    feedItems: FeedItem[];
    derivedWeights: Partial<Record<TopicTag, number>>;
    boostedDomains: string[];
  }): FoundationalCanon {
    return {
      id: `canon-${Date.now()}`,
      name: params.name || `atmen Fundament (${new Date().toISOString().slice(0, 10)})`,
      savedAt: new Date().toISOString(),
      description: params.description || 'Als unabhängiges Wissens-Fundament aus Raindrop.io archiviert.',
      provenance: 'Raindrop.io Snapshotted Canon',
      totalBookmarks: params.bookmarks.length,
      totalArticles: params.feedItems.length,
      boostedDomains: params.boostedDomains,
      derivedWeights: params.derivedWeights,
      bookmarks: params.bookmarks,
      canonicalItems: params.feedItems,
      epistemicManifesto: INITIAL_FOUNDATIONAL_CANON.epistemicManifesto
    };
  }

  /**
   * Formats the foundational canon as human-readable Markdown for Obsidian / Craft.
   */
  public static exportCanonToMarkdown(canon: FoundationalCanon): string {
    const lines: string[] = [];
    lines.push(`# 🏛️ ${canon.name}`);
    lines.push(`> ${canon.description}`);
    lines.push('');
    lines.push(`- **Gespeichert am:** ${canon.savedAt}`);
    lines.push(`- **Herkunft:** ${canon.provenance}`);
    lines.push(`- **Anzahl Lesezeichen:** ${canon.totalBookmarks}`);
    lines.push(`- **Geförderte Stamm-Domains:** ${canon.boostedDomains.join(', ')}`);
    lines.push('');
    lines.push('## 🧭 Kalibrierte Kognitions-Gewichte');
    lines.push('');
    lines.push('| Thema | Gewicht (0.0 - 1.0) |');
    lines.push('| :--- | :--- |');
    for (const [topic, weight] of Object.entries(canon.derivedWeights)) {
      lines.push(`| \`${topic}\` | **${Number(weight).toFixed(2)}** |`);
    }
    lines.push('');
    lines.push('## 📚 Gesicherte Fundament-Quellen');
    lines.push('');
    for (const b of canon.bookmarks) {
      lines.push(`### ${b.title}`);
      lines.push(`- **Quelle:** [${b.domain}](${b.link})`);
      lines.push(`- **Tags:** ${b.tags.map(t => `#${t}`).join(' ')}`);
      lines.push(`- **Auszug:** ${b.excerpt}`);
      lines.push('');
    }
    lines.push('---');
    lines.push(`*${canon.epistemicManifesto}*`);
    return lines.join('\n');
  }

  /**
   * Exports the canon as JSON for cold storage backup.
   */
  public static exportCanonToJson(canon: FoundationalCanon): string {
    return JSON.stringify(canon, null, 2);
  }
}
