import { VERIFIED_FEED_SOURCES } from '../ingestion/sources';
import { RawFeedSource, ReliabilityTier, SourceDomain } from '../ingestion/types';
import { TopicTag } from '../domain/types';
import { AtemStorage, appStorage } from './storage';
import { getSourceKind, isDeliveringHealth, parseSourceHealth, SourceHealthInfo, SourceHealthStatus, SourceKind } from '../ingestion/sourceHealth';
export type { SourceHealthInfo } from '../ingestion/sourceHealth';

export type SourceCategory =
  | 'oerr'
  | 'science'
  | 'youtube'
  | 'culture'
  | 'education'
  | 'tech'
  | 'memes'
  | 'fact_check'
  | 'wellbeing'
  | 'law_ethics'
  | 'official'
  | 'open_source'
  | 'custom';

let bundledSourceHealth: Record<string, SourceHealthInfo> = {};
try {
  const loaded = require('./source-health.json');
  if (loaded && typeof loaded === 'object') {
    bundledSourceHealth = parseSourceHealth(loaded);
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
  reliabilityTier?: ReliabilityTier;
  sourceDomain?: SourceDomain;
  homepageUrl?: string;
  description?: string;
  defaultEnabled?: boolean;
  // Per-source health telemetry
  fetchSuccess?: boolean;
  lastSuccessAt?: string;
  lastError?: string;
  isDelivering?: boolean;
  itemCount?: number;
  health?: SourceHealthInfo;
  healthStatus?: SourceHealthStatus;
  sourceKind?: SourceKind;
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
  fact_check: {
    label: 'Faktencheck & Medien',
    icon: 'checkmark-circle',
    color: '#14B8A6',
    description: 'Correctiv, dpa-Faktencheck, Mimikama, IFCN, Snopes, Full Fact'
  },
  science: {
    label: 'Wissenschaft & Kognition',
    icon: 'flask',
    color: '#8B5CF6',
    description: 'Quanta Magazine, Nature, Spektrum, ScienceDaily, scinexx, arXiv, PubMed'
  },
  wellbeing: {
    label: 'Mental Health & Wellbeing',
    icon: 'heart',
    color: '#EC4899',
    description: 'Center for Humane Tech, WHO Mental Health, DGPPN, Cochrane, Mindfulness'
  },
  law_ethics: {
    label: 'Recht, Ethik & Datenschutz',
    icon: 'scale',
    color: '#6366F1',
    description: 'EDPB, BfDI, AlgorithmWatch, EFF, Netzpolitik, AI Act & Privacy'
  },
  official: {
    label: 'Amtliche Referenzen',
    icon: 'business',
    color: '#0EA5E9',
    description: 'Destatis, Eurostat, RKI, EU Institutions, WHO'
  },
  open_source: {
    label: 'Open Source Software',
    icon: 'git-branch',
    color: '#10B981',
    description: 'FreshRSS, Miniflux, NewsBlur, uBlock Origin, LeechBlock, FSFE'
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
    label: 'KI, Tech & Standards',
    icon: 'hardware-chip',
    color: '#3B82F6',
    description: 'Simon Willison, Hugging Face, Heise, MIT Tech Review, W3C, Mozilla'
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
  // If explicitly categorized by global research domain
  if (source.sourceDomain) {
    const tierBadge = source.reliabilityTier === 'tier_a' ? 'Tier A (Primär/Referenz)' : 'Tier B (Qualität)';
    switch (source.sourceDomain) {
      case 'fact_check':
        return { category: 'fact_check', trustBadge: `Faktencheck • ${tierBadge}` };
      case 'mental_health_wellbeing':
        return { category: 'wellbeing', trustBadge: `Mental Health • ${tierBadge}` };
      case 'law_ethics_privacy':
        return { category: 'law_ethics', trustBadge: `Recht & Ethik • ${tierBadge}` };
      case 'official_reference':
        return { category: 'official', trustBadge: `Amtlich • ${tierBadge}` };
      case 'open_source':
        return { category: 'open_source', trustBadge: `Open Source • ${tierBadge}` };
      case 'science_research':
        return { category: 'science', trustBadge: `Wissenschaft • ${tierBadge}` };
      case 'datasets':
        return { category: 'science', trustBadge: `Datensatz • ${tierBadge}` };
      case 'tools_standards':
        return { category: 'tech', trustBadge: `Standard/Tool • ${tierBadge}` };
    }
  }

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
  enabledIds?: string[];
  customSources: FeedSourceItem[];
  lastSyncTimestamp?: string;
  sourceHealthOverrides?: Record<string, SourceHealthInfo>;
}

export class SourceRepository {
  private observedHealth: Record<string, SourceHealthInfo>;
  constructor(
    private storage: AtemStorage = appStorage,
    initialHealth?: Record<string, SourceHealthInfo>
  ) {
    this.observedHealth = initialHealth !== undefined ? { ...initialHealth } : { ...bundledSourceHealth };
  }

  private async loadState(): Promise<SourcesStatePayload> {
    try {
      const raw = await this.storage.getItem(SOURCES_STATE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const persistedHealth = parseSourceHealth(parsed.sourceHealthOverrides);
        this.observedHealth = { ...this.observedHealth, ...persistedHealth };
        return {
          disabledIds: Array.isArray(parsed.disabledIds) ? parsed.disabledIds : [],
          enabledIds: Array.isArray(parsed.enabledIds) ? parsed.enabledIds : [],
          customSources: Array.isArray(parsed.customSources) ? parsed.customSources : [],
          lastSyncTimestamp: parsed.lastSyncTimestamp,
          sourceHealthOverrides: persistedHealth
        };
      }
    } catch (e) {
      console.warn('Could not read sources state:', e);
    }
    return { disabledIds: [], enabledIds: [], customSources: [], sourceHealthOverrides: {} };
  }

  private async saveState(state: SourcesStatePayload): Promise<void> {
    await this.storage.setItem(SOURCES_STATE_KEY, JSON.stringify(state));
  }

  /**
   * Synchronous summary of candidate source health across the catalog.
   */
  getHealthOverview() {
    let deliveringCount = 0;
    let failingCount = 0;
    let unknownCount = 0;
    let referenceCount = 0;
    let totalItems = 0;
    for (const source of VERIFIED_FEED_SOURCES) {
      const health = this.observedHealth[source.id];
      if (getSourceKind(source) === 'reference') referenceCount++;
      else if (!health) unknownCount++;
      else if (isDeliveringHealth(health)) {
        deliveringCount++;
        totalItems += health.itemCount;
      } else failingCount++;
    }
    const activeDefaultSourcesCount = VERIFIED_FEED_SOURCES.filter(source => source.defaultEnabled !== false).length;
    return {
      totalSources: VERIFIED_FEED_SOURCES.length,
      deliveringCount, failingCount, unknownCount, referenceCount, totalItems,
      deliveringSources: deliveringCount, failingSources: failingCount,
      totalItemsHarvested: totalItems, activeDefaultSourcesCount,
      reserveSourcesCount: VERIFIED_FEED_SOURCES.length - activeDefaultSourcesCount
    };
  }

  /** Returns catalog candidates and custom feeds with measured or explicitly unknown health. */
  async getAllSources(): Promise<FeedSourceItem[]> {
    const state = await this.loadState();
    const disabledSet = new Set(state.disabledIds);
    const enabledSet = new Set(state.enabledIds || []);
    const catalogItems: FeedSourceItem[] = VERIFIED_FEED_SOURCES.map(source => {
      const { category, trustBadge } = categorizeVerifiedSource(source);
      const sourceKind = getSourceKind(source);
      const health = this.observedHealth[source.id];
      const isDelivering = sourceKind === 'feed' && isDeliveringHealth(health);
      const healthStatus: SourceHealthStatus = sourceKind === 'reference' ? 'reference'
        : !health ? 'unknown' : isDelivering ? 'delivering' : 'failing';
      const lastSynced = healthStatus === 'reference' ? 'Referenzseite · kein RSS-Feed'
        : healthStatus === 'unknown' ? 'Abruf noch nicht geprüft'
        : isDelivering ? `Letzter Erfolg: ${new Date(health!.lastSuccessAt!).toLocaleString('de-DE')}`
        : `Abruf-Fehler: ${health?.lastError || 'Keine gültigen Einträge'}`;
      return {
        ...source, category, trustBadge,
        enabled: source.defaultEnabled !== false ? !disabledSet.has(source.id) : enabledSet.has(source.id),
        isCustom: false, sourceKind, healthStatus, health,
        fetchSuccess: sourceKind === 'reference' ? undefined : health?.fetchSuccess,
        itemCount: sourceKind === 'reference' ? 0 : health?.itemCount ?? 0,
        articleCount: sourceKind === 'reference' ? 0 : health?.itemCount ?? 0,
        lastSynced, lastSuccessAt: health?.lastSuccessAt,
        lastError: health?.lastError, isDelivering
      };
    });
    const customItems: FeedSourceItem[] = state.customSources.map(source => {
      const health = this.observedHealth[source.id];
      return {
        ...source, enabled: !disabledSet.has(source.id), sourceKind: 'feed', health,
        fetchSuccess: health?.fetchSuccess, isDelivering: isDeliveringHealth(health),
        itemCount: health?.itemCount ?? 0,
        lastSuccessAt: health?.lastSuccessAt, lastError: health?.lastError,
        healthStatus: !health ? 'unknown' : isDeliveringHealth(health) ? 'delivering' : 'failing',
        lastSynced: !health ? 'Abruf noch nicht geprüft' : health.lastSuccessAt || health.lastError
      };
    });
    return [...catalogItems, ...customItems];
  }

  /**
   * Returns only sources that are both enabled by the user AND actually delivering items.
   */
  async getActiveDeliveringSources(): Promise<FeedSourceItem[]> {
    const all = await this.getAllSources();
    return all.filter(s => s.enabled && s.isDelivering === true);
  }

  /**
   * Returns lowercase domain hostnames of currently disabled sources.
   */
  async getDisabledDomains(): Promise<string[]> {
    const all = await this.getAllSources();
    const enabledDomains = new Set<string>();
    for (const s of all) {
      if (s.enabled && s.url) {
        try {
          const host = new URL(s.url).hostname.replace(/^www\./, '').toLowerCase();
          enabledDomains.add(host);
        } catch {
          // Ignore invalid URL
        }
      }
    }

    const state = await this.loadState();
    const disabledSet = new Set(state.disabledIds);
    const domains = new Set<string>();
    for (const s of all) {
      if (!s.enabled && disabledSet.has(s.id) && s.url) {
        try {
          const host = new URL(s.url).hostname.replace(/^www\./, '').toLowerCase();
          if (!enabledDomains.has(host)) {
            domains.add(host);
          }
        } catch {
          // Ignore invalid URL
        }
      }
    }
    return Array.from(domains);
  }

  /**
   * Returns lowercase names of currently disabled sources.
   */
  async getDisabledNames(): Promise<string[]> {
    const all = await this.getAllSources();
    const state = await this.loadState();
    const disabledSet = new Set(state.disabledIds);
    return all.filter(s => !s.enabled && disabledSet.has(s.id)).map(s => s.name.toLowerCase());
  }

  /**
   * Updates health telemetry for a specific source after a fetch attempt.
   */
  async recordSourceHealth(info: SourceHealthInfo): Promise<void> {
    await this.recordSnapshotHealth({ [info.sourceId]: info }, info.checkedAt);
  }

  /** One storage write per measured snapshot; reader hydration survives a storage quota failure. */
  async recordSnapshotHealth(value: unknown, checkedAt?: string): Promise<void> {
    const records = parseSourceHealth(value);
    const state = await this.loadState();
    for (const [id, info] of Object.entries(records)) {
      const next = { ...info, checkedAt: info.checkedAt || checkedAt };
      const previous = this.observedHealth[id];
      if (previous?.checkedAt && next.checkedAt && Date.parse(previous.checkedAt) > Date.parse(next.checkedAt)) continue;
      this.observedHealth[id] = next;
    }
    state.sourceHealthOverrides = { ...state.sourceHealthOverrides, ...this.observedHealth };
    try { await this.saveState(state); } catch { /* In-memory measured health remains available. */ }
  }

  /**
   * Toggles a source on or off.
   */
  async toggleSource(sourceId: string, forceStatus?: boolean): Promise<boolean> {
    const state = await this.loadState();
    const disabledSet = new Set(state.disabledIds);
    const enabledSet = new Set(state.enabledIds || []);
    const verified = VERIFIED_FEED_SOURCES.find(s => s.id === sourceId);
    const isDefaultActive = verified ? verified.defaultEnabled !== false : true;

    let isNowEnabled: boolean;

    if (typeof forceStatus === 'boolean') {
      isNowEnabled = forceStatus;
      if (isDefaultActive) {
        if (isNowEnabled) {
          disabledSet.delete(sourceId);
        } else {
          disabledSet.add(sourceId);
        }
      } else {
        if (isNowEnabled) {
          enabledSet.add(sourceId);
        } else {
          enabledSet.delete(sourceId);
        }
      }
    } else {
      const currentlyEnabled = isDefaultActive ? !disabledSet.has(sourceId) : enabledSet.has(sourceId);
      isNowEnabled = !currentlyEnabled;
      if (isDefaultActive) {
        if (isNowEnabled) {
          disabledSet.delete(sourceId);
        } else {
          disabledSet.add(sourceId);
        }
      } else {
        if (isNowEnabled) {
          enabledSet.add(sourceId);
        } else {
          enabledSet.delete(sourceId);
        }
      }
    }

    state.disabledIds = Array.from(disabledSet);
    state.enabledIds = Array.from(enabledSet);
    await this.saveState(state);
    return isNowEnabled;
  }

  /**
   * Toggles all sources belonging to a specific category at once.
   */
  async toggleCategory(category: SourceCategory, enable: boolean): Promise<void> {
    const state = await this.loadState();
    const disabledSet = new Set(state.disabledIds);
    const enabledSet = new Set(state.enabledIds || []);
    const all = await this.getAllSources();
    const categorySources = all.filter(s => s.category === category);

    for (const s of categorySources) {
      const isDefaultActive = s.defaultEnabled !== false;
      if (enable) {
        if (isDefaultActive) {
          disabledSet.delete(s.id);
        } else {
          enabledSet.add(s.id);
        }
      } else {
        if (isDefaultActive) {
          disabledSet.add(s.id);
        } else {
          enabledSet.delete(s.id);
        }
      }
    }

    state.disabledIds = Array.from(disabledSet);
    state.enabledIds = Array.from(enabledSet);
    await this.saveState(state);
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
      healthStatus: 'unknown',
      sourceKind: 'feed',
      isDelivering: false
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
        healthStatus: 'unknown',
        sourceKind: 'feed',
        isDelivering: false
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
      state.enabledIds = all.filter(s => s.defaultEnabled === false).map(s => s.id);
    } else if (preset === 'oerr_only') {
      state.disabledIds = all
        .filter(s => s.category !== 'oerr' && s.defaultEnabled !== false)
        .map(s => s.id);
      state.enabledIds = all
        .filter(s => s.category === 'oerr' && s.defaultEnabled === false)
        .map(s => s.id);
    } else if (preset === 'science_culture') {
      state.disabledIds = all
        .filter(s => s.category !== 'science' && s.category !== 'culture' && s.defaultEnabled !== false)
        .map(s => s.id);
      state.enabledIds = all
        .filter(s => (s.category === 'science' || s.category === 'culture') && s.defaultEnabled === false)
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
