import { TopicTag } from '../domain/types';
import { appStorage, AtemStorage } from '../data/storage';

export interface Subchannel {
  id: string;
  handle: string; // e.g. "c/quanten_sprung"
  title: string;
  description: string;
  icon: string; // Ionicons name
  flair: string;
  primaryTopic: TopicTag;
  accentColor: string;
  isCustom: boolean;
  createdAt: string;
  pinned: boolean;
  rssFeeds?: string[];
  antithesisPrompt?: string;
  memberCount: number;
}

export const DEFAULT_SUBCHANNELS: Subchannel[] = [
  {
    id: 'space-science',
    handle: 'c/serendipity',
    title: 'Wissenschaft & Gesellschaft',
    description: 'Grundlagenforschung, Astrophysik, Biologie und gesellschaftliche Transformation.',
    icon: 'planet-outline',
    flair: 'Wissenschaft',
    primaryTopic: 'science_society',
    accentColor: '#5C7FA3',
    isCustom: false,
    createdAt: '2026-10-01T00:00:00.000Z',
    pinned: true,
    antithesisPrompt: 'Welche Replikationskrise oder methodische Grenze schränkt diese Studie ein?',
    memberCount: 1840
  },
  {
    id: 'space-ai',
    handle: 'c/acceleration',
    title: 'Frontier AI & Systeme',
    description: 'Maschinelles Lernen, Architektur großer Modelle, Open Source und digitale Souveränität.',
    icon: 'hardware-chip-outline',
    flair: 'Frontier AI',
    primaryTopic: 'ai_apple',
    accentColor: '#5282B8',
    isCustom: false,
    createdAt: '2026-10-01T00:00:00.000Z',
    pinned: true,
    antithesisPrompt: 'Wo liegt der unauflösbare semantische Bruch zwischen statistischer Imitation und Verstehen?',
    memberCount: 2890
  },
  {
    id: 'space-philosophy',
    handle: 'c/dialektik',
    title: 'Philosophie & Streitfragen',
    description: 'Kritische Erkenntnistheorie, antike Lebenskunst und ethische Grenzfragen der Spätmoderne.',
    icon: 'compass-outline',
    flair: 'Streitfrage',
    primaryTopic: 'philosophy_ethics',
    accentColor: '#7E72B5',
    isCustom: false,
    createdAt: '2026-10-01T00:00:00.000Z',
    pinned: true,
    antithesisPrompt: 'Welches stärkste ontologische Gegenargument erschüttert diese Prämisse?',
    memberCount: 1420
  },
  {
    id: 'space-art',
    handle: 'c/kunst_galerie',
    title: 'Kunst & Visuelle Kultur',
    description: 'Malerei, Fotografie, Architektur & visuelle Philosophie aus offenen Museumssammlungen.',
    icon: 'color-palette-outline',
    flair: 'Kunst & Kultur',
    primaryTopic: 'art_aesthetics',
    accentColor: '#B0855B',
    isCustom: false,
    createdAt: '2026-10-01T00:00:00.000Z',
    pinned: true,
    antithesisPrompt: 'Inwiefern transformiert diese ästhetische Form unsere Wahrnehmung der Wirklichkeit?',
    memberCount: 1680
  },
  {
    id: 'space-synth',
    handle: 'c/synth_alchemie',
    title: 'Klangforschung & Modular',
    description: 'Modulare Synthese, Psychoakustik, Ambient-Architektur und elektronische Komposition.',
    icon: 'musical-notes-outline',
    flair: 'Klangforschung',
    primaryTopic: 'sound_synthesis',
    accentColor: '#B58952',
    isCustom: false,
    createdAt: '2026-10-01T00:00:00.000Z',
    pinned: true,
    antithesisPrompt: 'Welche physikalische Unschärfe unterscheidet analoge Schwingung von diskreter Abtastung?',
    memberCount: 970
  },
  {
    id: 'space-books',
    handle: 'c/books',
    title: 'Bücher & Essays',
    description: 'Sorgfältige Essays über epochemachende Sachbücher, Literaturkritik und Primärtexte.',
    icon: 'book-outline',
    flair: 'Buch & Essay',
    primaryTopic: 'book_mastery',
    accentColor: '#7A6BA8',
    isCustom: false,
    createdAt: '2026-10-01T00:00:00.000Z',
    pinned: true,
    antithesisPrompt: 'Inwiefern ist die Grundhypothese des Werkes zeitgebunden oder falsifizierbar?',
    memberCount: 890
  },
  {
    id: 'space-contemplation',
    handle: 'c/kontemplation',
    title: 'Geist & Kontemplation',
    description: 'Buddhismus, Qi Gong, Achtsamkeitspraktiken und Neurobiologie der Ruhe.',
    icon: 'leaf-outline',
    flair: 'Geist & Fokus',
    primaryTopic: 'contemplation_mind',
    accentColor: '#4B8E9D',
    isCustom: false,
    createdAt: '2026-10-01T00:00:00.000Z',
    pinned: false,
    antithesisPrompt: 'Ist Rückzug in Stille Privileg oder notwendige Voraussetzung für Handlungsfähigkeit?',
    memberCount: 1120
  },
  {
    id: 'space-health',
    handle: 'c/health_longevity',
    title: 'Gesundheit & Neurobiologie',
    description: 'Zirkadiane Rhythmen, Schlafarchitektur, Stoffwechsel und evidenzbasierte Langlebigkeit.',
    icon: 'fitness-outline',
    flair: 'Neurobiologie',
    primaryTopic: 'health_biohacking',
    accentColor: '#4C917D',
    isCustom: false,
    createdAt: '2026-10-01T00:00:00.000Z',
    pinned: false,
    antithesisPrompt: 'Wo endet sinnvolle physiologische Selbstoptimierung und beginnt neurotische Kontrolle?',
    memberCount: 1310
  },
  {
    id: 'space-memes',
    handle: 'c/memes',
    title: 'Comics & Satire',
    description: 'xkcd, SMBC, akademische Satire und feinsinnige Dekonstruktion digitaler Widersprüche.',
    icon: 'happy-outline',
    flair: 'Satire & Comics',
    primaryTopic: 'memes_satire',
    accentColor: '#B87B5C',
    isCustom: false,
    createdAt: '2026-10-01T00:00:00.000Z',
    pinned: false,
    antithesisPrompt: 'Welche reale Absurdität wird durch diese Pointe auf den Punkt gebracht?',
    memberCount: 2150
  },
  {
    id: 'space-youtube',
    handle: 'c/youtube',
    title: 'Video-Essays & Doku',
    description: 'Kuratierte Video-Essays aus Wissenschaft, Philosophie, Technik und Kultur.',
    icon: 'play-circle-outline',
    flair: 'Video-Essay',
    primaryTopic: 'youtube_gems',
    accentColor: '#A8646B',
    isCustom: false,
    createdAt: '2026-10-01T00:00:00.000Z',
    pinned: false,
    antithesisPrompt: 'Welche analytische Tiefe bleibt hinter der visuellen Inszenierung verborgen?',
    memberCount: 1540
  },
  {
    id: 'space-opportunities',
    handle: 'c/chancen',
    title: 'Chancen- & Hebel-Radar',
    description: 'Forschungsförderung, Open-Source-Ökosysteme, Fellowships und strategische Hebel.',
    icon: 'trending-up-outline',
    flair: 'Hebel & Grants',
    primaryTopic: 'opportunities_growth',
    accentColor: '#548C9C',
    isCustom: false,
    createdAt: '2026-10-01T00:00:00.000Z',
    pinned: false,
    antithesisPrompt: 'Welcher langfristige Hebel unterscheidet echte Substanz von kurzfristigem Hype?',
    memberCount: 780
  },
  {
    id: 'space-didactics',
    handle: 'c/didaktik_labor',
    title: 'Didaktik & Bildungsarchitektur',
    description: 'Lernpsychologie, sokratische Gesprächsführung und zeitgemäße Wissensvermittlung.',
    icon: 'school-outline',
    flair: 'Didaktik-Labor',
    primaryTopic: 'german_didactics',
    accentColor: '#4D947A',
    isCustom: false,
    createdAt: '2026-10-01T00:00:00.000Z',
    pinned: false,
    antithesisPrompt: 'Wie verhindert man, dass didaktische Reduktion in triviale Verflachung kippt?',
    memberCount: 650
  }
];

export function normalizeSpaceHandle(raw: string): string {
  const trimmed = (raw || '').trim().toLowerCase();
  const withoutPrefix = trimmed.replace(/^c\//, '');
  const clean = withoutPrefix.replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
  return `c/${clean || 'channel'}`;
}

export class SpaceRepository {
  private static STORAGE_KEY = '@atem:custom_subchannels';
  private static PINNED_IDS_KEY = '@atem:pinned_space_ids';
  private listeners = new Set<(spaces: Subchannel[]) => void>();

  constructor(private storage: AtemStorage = appStorage) {}

  public subscribe(listener: (spaces: Subchannel[]) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public async notify(): Promise<void> {
    const spaces = await this.getAllSpaces();
    for (const listener of this.listeners) {
      try {
        listener(spaces);
      } catch {
        // Safe isolation
      }
    }
  }

  public async getAllSpaces(): Promise<Subchannel[]> {
    try {
      const [rawCustom, rawPinned] = await Promise.all([
        this.storage.getItem(SpaceRepository.STORAGE_KEY),
        this.storage.getItem(SpaceRepository.PINNED_IDS_KEY)
      ]);
      const pinnedIds: string[] | null = rawPinned ? JSON.parse(rawPinned) : null;
      const custom: Subchannel[] = rawCustom ? JSON.parse(rawCustom) : [];

      const map = new Map<string, Subchannel>();
      for (const d of DEFAULT_SUBCHANNELS) {
        map.set(d.id, {
          ...d,
          pinned: pinnedIds ? pinnedIds.includes(d.id) : d.pinned
        });
      }
      for (const c of custom) {
        if (c.isCustom) {
          map.set(c.id, {
            ...c,
            pinned: pinnedIds ? pinnedIds.includes(c.id) : c.pinned
          });
        }
      }
      return Array.from(map.values());
    } catch {
      return DEFAULT_SUBCHANNELS;
    }
  }

  public async createSubchannel(data: {
    title: string;
    handle?: string;
    description: string;
    icon?: string;
    flair?: string;
    primaryTopic?: TopicTag;
    accentColor?: string;
    antithesisPrompt?: string;
    rssFeeds?: string[];
  }): Promise<Subchannel> {
    const spaces = await this.getAllSpaces();

    // Sanitize handle to start with "c/" and use alphanumeric/underscores
    const cleanHandle = normalizeSpaceHandle(data.handle || data.title);

    const newChannel: Subchannel = {
      id: `custom-space-${Date.now()}`,
      handle: cleanHandle,
      title: data.title.trim(),
      description: data.description.trim() || 'Persönlicher Subchannel für vertiefte Dialektik.',
      icon: data.icon || 'layers-outline',
      flair: data.flair || data.title.trim(),
      primaryTopic: data.primaryTopic || 'science_society',
      accentColor: data.accentColor || '#5282B8',
      isCustom: true,
      createdAt: new Date().toISOString(),
      pinned: true,
      rssFeeds: data.rssFeeds || [],
      antithesisPrompt: data.antithesisPrompt || 'Welche kritische Gegenperspektive muss hier bedacht werden?',
      memberCount: 1
    };

    const customOnly = spaces.filter(s => s.isCustom);
    customOnly.push(newChannel);
    await this.storage.setItem(SpaceRepository.STORAGE_KEY, JSON.stringify(customOnly));

    const pinnedIds = [...spaces.filter(s => s.pinned).map(s => s.id), newChannel.id];
    await this.storage.setItem(SpaceRepository.PINNED_IDS_KEY, JSON.stringify(pinnedIds));

    // Verify written data can be read back safely
    const verified = await this.storage.getItem(SpaceRepository.STORAGE_KEY);
    if (!verified) {
      throw new Error(`Persistenzfehler: Channel ${cleanHandle} konnte nicht im lokalen Speicher verifiziert werden.`);
    }

    await this.notify();
    return newChannel;
  }

  public async deleteSubchannel(id: string): Promise<boolean> {
    try {
      const raw = await this.storage.getItem(SpaceRepository.STORAGE_KEY);
      if (!raw) return false;
      const custom: Subchannel[] = JSON.parse(raw);
      const filtered = custom.filter(s => s.id !== id);
      await this.storage.setItem(SpaceRepository.STORAGE_KEY, JSON.stringify(filtered));
      await this.notify();
      return true;
    } catch {
      return false;
    }
  }

  public async togglePin(id: string): Promise<Subchannel[]> {
    const all = await this.getAllSpaces();
    const updated = all.map(s => s.id === id ? { ...s, pinned: !s.pinned } : s);
    const customOnly = updated.filter(s => s.isCustom);
    const pinnedIds = updated.filter(s => s.pinned).map(s => s.id);
    await Promise.all([
      this.storage.setItem(SpaceRepository.STORAGE_KEY, JSON.stringify(customOnly)),
      this.storage.setItem(SpaceRepository.PINNED_IDS_KEY, JSON.stringify(pinnedIds))
    ]);
    await this.notify();
    return updated;
  }
}

export const defaultSpaceRepository = new SpaceRepository();
