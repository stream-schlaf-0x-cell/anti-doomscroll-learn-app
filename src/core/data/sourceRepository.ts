import { VERIFIED_FEED_SOURCES } from '../ingestion/sources';
import { RawFeedSource } from '../ingestion/types';
import { TopicTag } from '../domain/types';
import { AtemStorage, appStorage } from './storage';

export type SourceCategory =
  | 'oerr'
  | 'science'
  | 'youtube'
  | 'culture'
  | 'education'
  | 'tech'
  | 'memes'
  | 'custom';

export interface FeedSourceItem {
  id: string;
  name: string;
  url: string;
  category: SourceCategory;
  primaryTopic: TopicTag;
  topics: TopicTag[];
  defaultAuthor?: string;
  language: 'de' | 'en';
  enabled: boolean;
  isCustom?: boolean;
  trustBadge?: string;
  articleCount?: number;
  lastSynced?: string;
  createdAt?: string;
}

export const CATEGORY_METADATA: Record<SourceCategory, {
  label: string;
  icon: string;
  color: string;
  description: string;
}> = {
  oerr: {
    label: 'Öffentlich-Rechtliche',
    icon: 'shield-checkmark',
    color: '#06B6D4',
    description: 'Tagesschau, ZDFheute, Deutschlandfunk – werbefrei, staatsfern & verifiziert'
  },
  science: {
    label: 'Wissenschaft & Kognition',
    icon: 'flask',
    color: '#8B5CF6',
    description: 'Spektrum, Gehirn & Geist, Quanta Magazine, Stanford SEP, arXiv'
  },
  youtube: {
    label: 'YouTube Meisterkurse',
    icon: 'logo-youtube',
    color: '#EF4444',
    description: 'Veritasium, Kurzgesagt, 3Blue1Brown, Huberman Lab'
  },
  culture: {
    label: 'Bücher & Kultur',
    icon: 'book',
    color: '#F59E0B',
    description: 'Perlentaucher Kulturmagazin, DLF Büchermarkt, Aeon Essays'
  },
  education: {
    label: 'Didaktik & Schule',
    icon: 'school',
    color: '#10B981',
    description: 'Deutsches Schulportal, Bildungsserver, Bundeszentrale für pol. Bildung'
  },
  tech: {
    label: 'Tech & KI-Souveränität',
    icon: 'hardware-chip',
    color: '#3B82F6',
    description: 'Simon Willison, Heise Developer, Hugging Face, CDM, Lines'
  },
  memes: {
    label: 'Satire & Memes',
    icon: 'happy',
    color: '#EC4899',
    description: 'xkcd Comics & intelligente Wissenschaftssatire'
  },
  custom: {
    label: 'Eigene RSS-Feeds',
    icon: 'add-circle',
    color: '#6366F1',
    description: 'Von dir manuell oder per OPML importierte Quellen'
  }
};

function categorizeVerifiedSource(source: RawFeedSource): { category: SourceCategory; trustBadge: string } {
  if (source.id.startsWith('tagesschau') || source.id === 'zdf-heute' || source.id === 'deutschlandfunk-nachrichten' || source.id === 'bpb-themen') {
    return { category: 'oerr', trustBadge: 'ÖRR Verifiziert' };
  }
  if (source.id.startsWith('yt-')) {
    return { category: 'youtube', trustBadge: 'Video-Masterclass' };
  }
  if (source.id.includes('spektrum') || source.id.includes('gehirn') || source.id === 'quanta-magazine' || source.id === 'sep-whats-new' || source.id === 'arxiv-cs-ai') {
    return { category: 'science', trustBadge: 'Peer-Reviewed / Fachverlag' };
  }
  if (source.id === 'perlentaucher-magazin' || source.id === 'dlf-buechermarkt' || source.id === 'aeon-essays' || source.id === 'daily-nous') {
    return { category: 'culture', trustBadge: 'Feuilleton & Essays' };
  }
  if (source.id === 'deutsches-schulportal' || source.id === 'deutscher-bildungsserver') {
    return { category: 'education', trustBadge: 'Stiftung / Bildungsportal' };
  }
  if (source.id === 'xkcd-comics') {
    return { category: 'memes', trustBadge: 'Kult-Satire' };
  }
  return { category: 'tech', trustBadge: 'Open Web & Tech' };
}

const SOURCES_STATE_KEY = '@atem:sources_state';

interface SourcesStatePayload {
  disabledIds: string[];
  customSources: FeedSourceItem[];
  lastSyncTimestamp?: string;
}

export class SourceRepository {
  constructor(private storage: AtemStorage = appStorage) {}

  private async loadState(): Promise<SourcesStatePayload> {
    try {
      const raw = await this.storage.getItem(SOURCES_STATE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          disabledIds: Array.isArray(parsed.disabledIds) ? parsed.disabledIds : [],
          customSources: Array.isArray(parsed.customSources) ? parsed.customSources : [],
          lastSyncTimestamp: parsed.lastSyncTimestamp
        };
      }
    } catch (e) {
      console.warn('Could not read sources state:', e);
    }
    return { disabledIds: [], customSources: [] };
  }

  private async saveState(state: SourcesStatePayload): Promise<void> {
    await this.storage.setItem(SOURCES_STATE_KEY, JSON.stringify(state));
  }

  /**
   * Retrieves all verified sources + custom user sources with live enabled/disabled status.
   */
  async getAllSources(): Promise<FeedSourceItem[]> {
    const state = await this.loadState();
    const disabledSet = new Set(state.disabledIds);

    const verifiedItems: FeedSourceItem[] = VERIFIED_FEED_SOURCES.map(s => {
      const { category, trustBadge } = categorizeVerifiedSource(s);
      return {
        id: s.id,
        name: s.name,
        url: s.url,
        category,
        primaryTopic: s.primaryTopic,
        topics: s.topics,
        defaultAuthor: s.defaultAuthor,
        language: s.language,
        enabled: !disabledSet.has(s.id),
        isCustom: false,
        trustBadge,
        articleCount: 4, // Average harvested articles per source in pipeline
        lastSynced: state.lastSyncTimestamp || 'Heute, live'
      };
    });

    const customItems: FeedSourceItem[] = state.customSources.map(c => ({
      ...c,
      enabled: !disabledSet.has(c.id)
    }));

    return [...verifiedItems, ...customItems];
  }

  /**
   * Toggles a source on or off. Returns new enabled status.
   */
  async toggleSource(sourceId: string): Promise<boolean> {
    const state = await this.loadState();
    const disabledSet = new Set(state.disabledIds);
    let isNowEnabled: boolean;

    if (disabledSet.has(sourceId)) {
      disabledSet.delete(sourceId);
      isNowEnabled = true;
    } else {
      disabledSet.add(sourceId);
      isNowEnabled = false;
    }

    state.disabledIds = Array.from(disabledSet);
    await this.saveState(state);
    return isNowEnabled;
  }

  /**
   * Adds a custom user RSS/Atom feed source.
   */
  async addCustomSource(params: {
    name: string;
    url: string;
    primaryTopic?: TopicTag;
    category?: SourceCategory;
  }): Promise<FeedSourceItem> {
    const state = await this.loadState();
    const topic = params.primaryTopic || 'science_society';
    const category = params.category || 'custom';
    const cleanUrl = params.url.trim();

    // Prevent duplicate URLs
    const existing = state.customSources.find(s => s.url.toLowerCase() === cleanUrl.toLowerCase())
      || VERIFIED_FEED_SOURCES.find(s => s.url.toLowerCase() === cleanUrl.toLowerCase());

    if (existing) {
      throw new Error(`Der Feed "${cleanUrl}" ist bereits in deinen Quellen vorhanden.`);
    }

    const id = `custom-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newSource: FeedSourceItem = {
      id,
      name: params.name.trim() || cleanUrl.replace(/^https?:\/\//i, '').split('/')[0],
      url: cleanUrl,
      category,
      primaryTopic: topic,
      topics: [topic],
      language: 'de',
      enabled: true,
      isCustom: true,
      trustBadge: 'Eigene Quelle',
      createdAt: new Date().toISOString()
    };

    state.customSources.push(newSource);
    await this.saveState(state);
    return newSource;
  }

  /**
   * Removes a custom source by ID.
   */
  async removeCustomSource(sourceId: string): Promise<void> {
    const state = await this.loadState();
    state.customSources = state.customSources.filter(s => s.id !== sourceId);
    state.disabledIds = state.disabledIds.filter(id => id !== sourceId);
    await this.saveState(state);
  }

  /**
   * Imports feeds from an OPML XML string.
   */
  async importOPML(opmlXml: string): Promise<{ added: FeedSourceItem[]; skippedCount: number }> {
    const state = await this.loadState();
    const existingUrls = new Set([
      ...VERIFIED_FEED_SOURCES.map(s => s.url.toLowerCase()),
      ...state.customSources.map(s => s.url.toLowerCase())
    ]);

    const added: FeedSourceItem[] = [];
    let skippedCount = 0;

    // Standard regex to parse OPML outlines: <outline ... xmlUrl="..." ... />
    const outlineRegex = /<outline\b([^>]+)\/?>/gi;
    let match: RegExpExecArray | null;

    while ((match = outlineRegex.exec(opmlXml)) !== null) {
      const attrsStr = match[1];
      const xmlUrlMatch = attrsStr.match(/xmlUrl=["']([^"']+)["']/i);
      if (!xmlUrlMatch) continue;

      const xmlUrl = xmlUrlMatch[1].trim();
      if (!xmlUrl || existingUrls.has(xmlUrl.toLowerCase())) {
        skippedCount++;
        continue;
      }

      // Title or text
      const titleMatch = attrsStr.match(/title=["']([^"']+)["']/i) || attrsStr.match(/text=["']([^"']+)["']/i);
      const name = titleMatch ? titleMatch[1].trim() : xmlUrl.replace(/^https?:\/\//i, '').split('/')[0];

      const id = `opml-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const newSource: FeedSourceItem = {
        id,
        name,
        url: xmlUrl,
        category: 'custom',
        primaryTopic: 'science_society',
        topics: ['science_society'],
        language: 'de',
        enabled: true,
        isCustom: true,
        trustBadge: 'OPML Import',
        createdAt: new Date().toISOString()
      };

      state.customSources.push(newSource);
      existingUrls.add(xmlUrl.toLowerCase());
      added.push(newSource);
    }

    if (added.length > 0) {
      await this.saveState(state);
    }

    return { added, skippedCount };
  }

  /**
   * Generates a standard OPML 2.0 XML string for all currently active feeds.
   */
  exportOPML(sources: FeedSourceItem[]): string {
    const timestamp = new Date().toUTCString();
    let bodyOutlines = '';

    // Group by category
    const grouped = new Map<SourceCategory, FeedSourceItem[]>();
    for (const s of sources) {
      if (!grouped.has(s.category)) grouped.set(s.category, []);
      grouped.get(s.category)!.push(s);
    }

    for (const [category, items] of grouped.entries()) {
      const meta = CATEGORY_METADATA[category] || { label: category };
      bodyOutlines += `    <outline text="${escapeXml(meta.label)}" title="${escapeXml(meta.label)}">\n`;
      for (const item of items) {
        bodyOutlines += `      <outline type="rss" text="${escapeXml(item.name)}" title="${escapeXml(item.name)}" xmlUrl="${escapeXml(item.url)}" />\n`;
      }
      bodyOutlines += `    </outline>\n`;
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>atmen RSS Subscriptions</title>
    <dateCreated>${timestamp}</dateCreated>
    <docs>https://atmen.app</docs>
  </head>
  <body>
${bodyOutlines}  </body>
</opml>`;
  }

  /**
   * Applies a curated preset:
   * - 'oerr_only': Enables only ÖRR sources
   * - 'science_culture': Enables Science, Culture & Books
   * - 'all': Enables all 29 verified sources
   */
  async applyPreset(preset: 'all' | 'oerr_only' | 'science_culture'): Promise<void> {
    const state = await this.loadState();
    const all = await this.getAllSources();

    if (preset === 'all') {
      state.disabledIds = [];
    } else if (preset === 'oerr_only') {
      state.disabledIds = all
        .filter(s => s.category !== 'oerr')
        .map(s => s.id);
    } else if (preset === 'science_culture') {
      state.disabledIds = all
        .filter(s => s.category !== 'science' && s.category !== 'culture')
        .map(s => s.id);
    }

    await this.saveState(state);
  }

  /**
   * Updates last sync timestamp.
   */
  async recordSync(): Promise<string> {
    const state = await this.loadState();
    const nowStr = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    state.lastSyncTimestamp = `Heute, ${nowStr} Uhr`;
    await this.saveState(state);
    return state.lastSyncTimestamp;
  }
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export const defaultSourceRepository = new SourceRepository();
