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

export interface SourceHealthInfo {
  sourceId: string;
  name: string;
  url: string;
  fetchSuccess: boolean;
  lastSuccessAt?: string;
  lastError?: string;
  itemCount: number;
  durationMs?: number;
}

let bundledSourceHealth: Record<string, SourceHealthInfo> = {};
try {
  const loaded = require('./source-health.json');
  if (loaded && typeof loaded === 'object') {
    bundledSourceHealth = loaded as Record<string, SourceHealthInfo>;
  }
} catch {
  bundledSourceHealth = {};
}

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
  // Per-source health telemetry
  fetchSuccess?: boolean;
  lastSuccessAt?: string;
  lastError?: string;
  isDelivering?: boolean;
  itemCount?: number;
  health?: SourceHealthInfo;
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
    description: 'Tagesschau, ZDFheute, Deutschlandfunk, BR24 – werbefrei & redaktionell geprüft'
  },
  science: {
    label: 'Wissenschaft & Kognition',
    icon: 'flask',
    color: '#8B5CF6',
    description: 'Quanta Magazine, Nature, Spektrum, ScienceDaily, scinexx, arXiv'
  },
  youtube: {
    label: 'YouTube Meisterkurse',
    icon: 'logo-youtube',
    color: '#EF4444',
    description: 'Veritasium, Kurzgesagt, 3Blue1Brown, Huberman Lab'
  },
  culture: {
    label: 'Philosophie, Essays & Kontemplation',
    icon: 'book',
    color: '#F59E0B',
    description: 'Stanford SEP, Aeon, Psyche, Tricycle, Plum Village, Public Domain Review, Colossal'
  },
  education: {
    label: 'Didaktik & Schule',
    icon: 'school',
    color: '#10B981',
    description: 'Deutsches Schulportal, Bildungsserver, bpb, Edutopia'
  },
  tech: {
    label: 'KI, Tech & Klangsynthese',
    icon: 'hardware-chip',
    color: '#3B82F6',
    description: 'Simon Willison, Hugging Face, Heise, MIT Tech Review, Lobsters, CDM, Lines'
  },
  memes: {
    label: 'Spielerisches, Humor & Kurioses',
    icon: 'happy',
    color: '#EC4899',
    description: 'xkcd, SMBC Comics & Futility Closet'
  },
  custom: {
    label: 'Eigene RSS-Feeds',
    icon: 'add-circle',
    color: '#6366F1',
    description: 'Von dir manuell oder per OPML importierte Quellen'
  }
};

function categorizeVerifiedSource(source: RawFeedSource): { category: SourceCategory; trustBadge: string } {
  const id = source.id.toLowerCase();
  if (
    id.startsWith('tagesschau') ||
    id === 'zdf-heute' ||
    id.startsWith('deutschlandfunk') ||
    id.startsWith('dlf-forschung') ||
    id.startsWith('dlf-kultur') ||
    id.startsWith('br24') ||
    id.startsWith('dw-') ||
    id === 'bpb-themen'
  ) {
    return { category: 'oerr', trustBadge: 'Öffentlich-Rechtlich' };
  }
  if (id.startsWith('yt-')) {
    return { category: 'youtube', trustBadge: 'Video-Essay' };
  }
  if (
    id.includes('spektrum') ||
    id.includes('gehirn') ||
    id === 'quanta-magazine' ||
    id === 'forschung-und-wissen' ||
    id === 'idw-wissenschaft' ||
    id === 'nautilus-magazine' ||
    id === 'nature-news' ||
    id.startsWith('sciencedaily') ||
    id === 'mpg-forschung' ||
    id === 'scinexx-wissen' ||
    id.startsWith('arxiv-')
  ) {
    return { category: 'science', trustBadge: 'Wissenschaft & Forschung' };
  }
  if (
    id === 'sep-whats-new' ||
    id === 'perlentaucher-magazin' ||
    id === 'dlf-buechermarkt' ||
    id === 'aeon-essays' ||
    id === 'psyche-magazine' ||
    id === 'daily-nous' ||
    id === 'netzpolitik-org' ||
    id === 'philosophy-now' ||
    id === 'the-marginalian' ||
    id === 'public-domain-review' ||
    id === 'astral-codex-ten' ||
    id === 'works-in-progress' ||
    id === 'tricycle-buddhist' ||
    id === 'lions-roar-buddhism' ||
    id === 'plum-village-mindfulness' ||
    id === 'zen-habits-focus' ||
    id === 'colossal-art' ||
    id === 'hyperallergic-art' ||
    id === 'monopol-kunst' ||
    id === '3quarksdaily' ||
    id === 'geschichte-der-gegenwart' ||
    id === 'praefaktisch-philosophie'
  ) {
    return { category: 'culture', trustBadge: 'Essay, Kunst & Kontemplation' };
  }
  if (id === 'deutsches-schulportal' || id === 'deutscher-bildungsserver' || id === 'edutopia-learning') {
    return { category: 'education', trustBadge: 'Bildung & Didaktik' };
  }
  if (
    id === 'xkcd-comics' ||
    id === 'smbc-comics' ||
    id === 'futility-closet' ||
    id === 'existential-comics' ||
    id === 'pbf-comics' ||
    id === 'sketchplanations'
  ) {
    return { category: 'memes', trustBadge: 'Comics & Denkmodelle' };
  }
  return { category: 'tech', trustBadge: 'KI, Tech & Klang' };
}

const SOURCES_STATE_KEY = '@atem:sources_state';

interface SourcesStatePayload {
  disabledIds: string[];
  customSources: FeedSourceItem[];
  lastSyncTimestamp?: string;
  sourceHealthOverrides?: Record<string, SourceHealthInfo>;
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
          lastSyncTimestamp: parsed.lastSyncTimestamp,
          sourceHealthOverrides: parsed.sourceHealthOverrides || {}
        };
      }
    } catch (e) {
      console.warn('Could not read sources state:', e);
    }
    return { disabledIds: [], customSources: [], sourceHealthOverrides: {} };
  }

  private async saveState(state: SourcesStatePayload): Promise<void> {
    await this.storage.setItem(SOURCES_STATE_KEY, JSON.stringify(state));
  }

  /**
   * Synchronous summary of candidate source health across the catalog.
   */
  getHealthOverview(): {
    totalSources: number;
    deliveringCount: number;
    failingCount: number;
    totalItems: number;
    deliveringSources: number;
    failingSources: number;
    totalItemsHarvested: number;
  } {
    const totalSources = VERIFIED_FEED_SOURCES.length;
    let deliveringCount = 0;
    let failingCount = 0;
    let totalItems = 0;

    for (const s of VERIFIED_FEED_SOURCES) {
      const h = bundledSourceHealth[s.id];
      const ok = h ? (h.fetchSuccess && h.itemCount > 0) : true;
      if (ok) {
        deliveringCount++;
        totalItems += h ? h.itemCount : 4;
      } else {
        failingCount++;
      }
    }

    return {
      totalSources,
      deliveringCount,
      failingCount,
      totalItems,
      deliveringSources: deliveringCount,
      failingSources: failingCount,
      totalItemsHarvested: totalItems
    };
  }

  /**
   * Retrieves all verified sources + custom user sources with live enabled/disabled status
   * and per-source delivery health telemetry.
   */
  async getAllSources(): Promise<FeedSourceItem[]> {
    const state = await this.loadState();
    const disabledSet = new Set(state.disabledIds);
    const overrides = state.sourceHealthOverrides || {};

    const verifiedItems: FeedSourceItem[] = VERIFIED_FEED_SOURCES.map(s => {
      const { category, trustBadge } = categorizeVerifiedSource(s);
      const health = overrides[s.id] || bundledSourceHealth[s.id];
      const fetchSuccess = health ? health.fetchSuccess : true;
      const itemCount = health ? health.itemCount : 4;
      const isDelivering = fetchSuccess && itemCount > 0;
      const lastSuccessFormatted = health?.lastSuccessAt
        ? new Date(health.lastSuccessAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
        : undefined;

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
        articleCount: itemCount,
        itemCount,
        lastSynced: isDelivering
          ? (lastSuccessFormatted || state.lastSyncTimestamp || 'Liefert aktiv')
          : `Abruf-Fehler: ${health?.lastError || 'Nicht erreichbar'}`,
        fetchSuccess,
        lastSuccessAt: health?.lastSuccessAt,
        lastError: health?.lastError,
        isDelivering,
        health
      };
    });

    const customItems: FeedSourceItem[] = state.customSources.map(c => ({
      ...c,
      enabled: !disabledSet.has(c.id),
      fetchSuccess: c.fetchSuccess ?? true,
      isDelivering: c.isDelivering ?? true
    }));

    return [...verifiedItems, ...customItems];
  }

  /**
   * Returns only sources that are both enabled by the user AND actually delivering items.
   */
  async getActiveDeliveringSources(): Promise<FeedSourceItem[]> {
    const all = await this.getAllSources();
    return all.filter(s => s.enabled && s.isDelivering !== false);
  }

  /**
   * Returns lowercase domain hostnames of currently disabled sources.
   */
  async getDisabledDomains(): Promise<string[]> {
    const all = await this.getAllSources();
    const disabled = all.filter(s => !s.enabled);
    const domains = new Set<string>();
    for (const s of disabled) {
      try {
        const host = new URL(s.url).hostname.replace(/^www\./, '').toLowerCase();
        domains.add(host);
      } catch {
        // Ignore invalid URL
      }
    }
    return Array.from(domains);
  }

  /**
   * Returns lowercase names of currently disabled sources.
   */
  async getDisabledNames(): Promise<string[]> {
    const all = await this.getAllSources();
    return all.filter(s => !s.enabled).map(s => s.name.toLowerCase());
  }

  /**
   * Updates health telemetry for a specific source after a fetch attempt.
   */
  async recordSourceHealth(info: SourceHealthInfo): Promise<void> {
    const state = await this.loadState();
    const overrides = state.sourceHealthOverrides || {};
    overrides[info.sourceId] = info;
    state.sourceHealthOverrides = overrides;
    await this.saveState(state);
  }

  /**
   * Toggles a source on or off.
   */
  async toggleSource(sourceId: string, forceStatus?: boolean): Promise<boolean> {
    const state = await this.loadState();
    const disabledSet = new Set(state.disabledIds);
    let isNowEnabled: boolean;

    if (typeof forceStatus === 'boolean') {
      isNowEnabled = forceStatus;
      if (isNowEnabled) {
        disabledSet.delete(sourceId);
      } else {
        disabledSet.add(sourceId);
      }
    } else {
      if (disabledSet.has(sourceId)) {
        disabledSet.delete(sourceId);
        isNowEnabled = true;
      } else {
        disabledSet.add(sourceId);
        isNowEnabled = false;
      }
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
      createdAt: new Date().toISOString(),
      fetchSuccess: true,
      isDelivering: true
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
        createdAt: new Date().toISOString(),
        fetchSuccess: true,
        isDelivering: true
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
   * - 'all': Enables all verified sources
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
