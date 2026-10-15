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
    id: 'space-philosophy',
    handle: 'c/philosophie_ethik',
    title: 'Philosophie & Ethik',
    description: 'Kritische Erkenntnistheorie, antike Lebenskunst und ethische Grenzfragen der Spätmoderne.',
    icon: 'school-outline',
    flair: '◈ Philosophie',
    primaryTopic: 'philosophy_ethics',
    accentColor: '#8B5CF6',
    isCustom: false,
    createdAt: '2026-10-01T00:00:00.000Z',
    pinned: true,
    antithesisPrompt: 'Welches stärkste ontologische Gegenargument erschüttert diese Prämisse?',
    memberCount: 1420
  },
  {
    id: 'space-ai',
    handle: 'c/ai_apple',
    title: 'Künstliche Intelligenz & Systeme',
    description: 'Maschinelles Lernen, Architektur großer Modelle und soziotechnische Resonanzen.',
    icon: 'hardware-chip-outline',
    flair: '◈ KI & Kognition',
    primaryTopic: 'ai_apple',
    accentColor: '#3B82F6',
    isCustom: false,
    createdAt: '2026-10-01T00:00:00.000Z',
    pinned: true,
    antithesisPrompt: 'Wo liegt der unauflösbare semantische Bruch zwischen statistischer Imitation und Verstehen?',
    memberCount: 2890
  },
  {
    id: 'space-synth',
    handle: 'c/synth_alchemie',
    title: 'Klang-Synthese & Akustik',
    description: 'Modulare Synthese, Psychoakustik, Ambient-Architektur und Frequenz-Alchemie.',
    icon: 'musical-notes-outline',
    flair: '◈ Klang-Synthese',
    primaryTopic: 'sound_synthesis',
    accentColor: '#EC4899',
    isCustom: false,
    createdAt: '2026-10-01T00:00:00.000Z',
    pinned: true,
    antithesisPrompt: 'Welche physikalische Unschärfe unterscheidet analoge Schwingung von diskreter Abtastung?',
    memberCount: 970
  },
  {
    id: 'space-science',
    handle: 'c/quanten_kosmos',
    title: 'Wissenschaft & Epistemologie',
    description: 'Grundlagenforschung, Astrophysik, Biologie und gesellschaftliche Transformation.',
    icon: 'flask-outline',
    flair: '◈ Wissenschaft',
    primaryTopic: 'science_society',
    accentColor: '#06B6D4',
    isCustom: false,
    createdAt: '2026-10-01T00:00:00.000Z',
    pinned: true,
    antithesisPrompt: 'Welche Replikationskrise oder methodische Grenze schränkt diese Studie ein?',
    memberCount: 1840
  },
  {
    id: 'space-contemplation',
    handle: 'c/kontemplation_stille',
    title: 'Kontemplation & Stille',
    description: 'Achtsamkeitspraktiken, Neurobiologie der Ruhe und bewusste Entschleunigung.',
    icon: 'leaf-outline',
    flair: '◈ Kontemplation',
    primaryTopic: 'contemplation_mind',
    accentColor: '#10B981',
    isCustom: false,
    createdAt: '2026-10-01T00:00:00.000Z',
    pinned: false,
    antithesisPrompt: 'Ist Rückzug in Stille Privileg oder notwendige Voraussetzung für Handlungsfähigkeit?',
    memberCount: 1120
  },
  {
    id: 'space-didactics',
    handle: 'c/didaktik_labor',
    title: 'Didaktik & Bildungsarchitektur',
    description: 'Lernpsychologie, sokratische Gesprächsführung und zeitgemäße Wissensvermittlung.',
    icon: 'book-outline',
    flair: '◈ Didaktik',
    primaryTopic: 'german_didactics',
    accentColor: '#F59E0B',
    isCustom: false,
    createdAt: '2026-10-01T00:00:00.000Z',
    pinned: false,
    antithesisPrompt: 'Wie verhindert man, dass didaktische Reduktion in triviale Verflachung kippt?',
    memberCount: 650
  },
  {
    id: 'space-health',
    handle: 'c/biohacking_gesundheit',
    title: 'Neurobiologie & Vitalität',
    description: 'Zirkadiane Rhythmen, Schlafarchitektur, Stoffwechsel und evidenzbasierte Langlebigkeit.',
    icon: 'fitness-outline',
    flair: '◈ Neurobiologie',
    primaryTopic: 'health_biohacking',
    accentColor: '#14B8A6',
    isCustom: false,
    createdAt: '2026-10-01T00:00:00.000Z',
    pinned: false,
    antithesisPrompt: 'Wo endet sinnvolle physiologische Selbstoptimierung und beginnt neurotische Kontrolle?',
    memberCount: 1310
  },
  {
    id: 'space-books',
    handle: 'c/buecher_meisterwerke',
    title: 'Bücher-Bibliothek & Meisterwerke',
    description: 'Sorgfältige Essays über epochemachende Sachbücher, Traktate und Primärtexte.',
    icon: 'library-outline',
    flair: '◈ Buch-Meisterwerk',
    primaryTopic: 'book_mastery',
    accentColor: '#6366F1',
    isCustom: false,
    createdAt: '2026-10-01T00:00:00.000Z',
    pinned: false,
    antithesisPrompt: 'Inwiefern ist die Grundhypothese des Werkes zeitgebunden oder falsifizierbar?',
    memberCount: 890
  },
  {
    id: 'space-memes',
    handle: 'c/memes_dialektik',
    title: 'Intellektuelle Meme-Dialektik',
    description: 'xkcd, akademische Satire und feinsinnige Dekonstruktion digitaler Widersprüche.',
    icon: 'sparkles-outline',
    flair: '◈ Meme-Dialektik',
    primaryTopic: 'philosophy_ethics',
    accentColor: '#F43F5E',
    isCustom: false,
    createdAt: '2026-10-01T00:00:00.000Z',
    pinned: false,
    antithesisPrompt: 'Welche reale Absurdität wird durch diese Pointe auf den Punkt gebracht?',
    memberCount: 2150
  }
];

export class SpaceRepository {
  private static STORAGE_KEY = '@atem:custom_subchannels';

  constructor(private storage: AtemStorage = appStorage) {}

  public async getAllSpaces(): Promise<Subchannel[]> {
    try {
      const raw = await this.storage.getItem(SpaceRepository.STORAGE_KEY);
      if (!raw) return DEFAULT_SUBCHANNELS;
      const custom: Subchannel[] = JSON.parse(raw);
      // Merge defaults with custom channels (custom takes precedence on ID match)
      const map = new Map<string, Subchannel>();
      for (const d of DEFAULT_SUBCHANNELS) {
        map.set(d.id, d);
      }
      for (const c of custom) {
        map.set(c.id, c);
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
    const rawHandle = data.handle || data.title.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const cleanHandle = rawHandle.startsWith('c/')
      ? rawHandle.toLowerCase()
      : `c/${rawHandle.toLowerCase().replace(/^c\//, '')}`;

    const newChannel: Subchannel = {
      id: `custom-space-${Date.now()}`,
      handle: cleanHandle,
      title: data.title.trim(),
      description: data.description.trim() || 'Persönlicher Subchannel für vertiefte Dialektik.',
      icon: data.icon || 'layers-outline',
      flair: data.flair || `◈ ${data.title.trim()}`,
      primaryTopic: data.primaryTopic || 'science_society',
      accentColor: data.accentColor || '#6366F1',
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

    return newChannel;
  }

  public async deleteSubchannel(id: string): Promise<boolean> {
    try {
      const raw = await this.storage.getItem(SpaceRepository.STORAGE_KEY);
      if (!raw) return false;
      const custom: Subchannel[] = JSON.parse(raw);
      const filtered = custom.filter(s => s.id !== id);
      await this.storage.setItem(SpaceRepository.STORAGE_KEY, JSON.stringify(filtered));
      return true;
    } catch {
      return false;
    }
  }

  public async togglePin(id: string): Promise<Subchannel[]> {
    const all = await this.getAllSpaces();
    const updated = all.map(s => s.id === id ? { ...s, pinned: !s.pinned } : s);
    const customOnly = updated.filter(s => s.isCustom);
    await this.storage.setItem(SpaceRepository.STORAGE_KEY, JSON.stringify(customOnly));
    return updated;
  }
}

export const defaultSpaceRepository = new SpaceRepository();
