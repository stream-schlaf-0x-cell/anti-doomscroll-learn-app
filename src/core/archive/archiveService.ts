/**
 * Archive & Permanent Knowledge Library Service
 * 
 * Preserves every generated daily edition, deep-dive dossier, user notes,
 * and bookmarked insights in a permanent, local-first archive.
 * 
 * Invariants:
 * - Thread-safe / Mutex-protected read-modify-write via storage.runTransaction.
 * - Distinct, permanently addressable units: daily editions and additional research sessions
 *   coexist on the same date without data loss.
 * - Non-destructive corruption handling: invalid JSON triggers a CorruptedDataError
 *   rather than silently wiping the archive.
 */

import { FeedItem, TopicTag } from '../domain/types';
import { appStorage, AtemStorage, CorruptedDataError } from '../data/storage';

export type ArchiveSessionType = 'daily' | 'pocket_stream' | 'deep_dive';

export interface ArchivedEdition {
  id: string; // Unique addressable ID: e.g. "daily_2026-10-15" or "session_2026-10-15_pocket-didaktik"
  sessionType: ArchiveSessionType;
  sessionId?: string;
  label?: string;
  date: string; // YYYY-MM-DD
  generatedAt: string;
  itemCount: number;
  topics: TopicTag[];
  items: FeedItem[];
  leadArticleTitle: string;
}

export interface ArchiveRecordOptions {
  sessionType?: ArchiveSessionType;
  sessionId?: string;
  label?: string;
}

export interface ArchiveSearchQuery {
  term?: string;
  topic?: TopicTag;
  space?: string;
  sessionType?: ArchiveSessionType;
  from?: string;
  to?: string;
}

export class ArchiveService {
  public static STORAGE_KEY = '@atem:archive_editions';

  /**
   * Persists a daily edition or research session into the permanent archive using
   * atomic read-modify-write serialization.
   * Multiple sessions on the same date are preserved under distinct permanent IDs.
   */
  public static async recordEdition(
    items: FeedItem[],
    date?: string,
    options: ArchiveRecordOptions = {},
    storage: AtemStorage = appStorage
  ): Promise<ArchivedEdition> {
    const targetDate = date || new Date().toISOString().slice(0, 10);
    const sessionType = options.sessionType || 'daily';
    const uniqueTopics = Array.from(new Set(items.flatMap(i => i.topics || [i.primaryTopic])));
    const leadItem = items[0] || { title: 'Erkenntnis-Sammlung' };

    const permanentId = sessionType === 'daily'
      ? `daily_${targetDate}`
      : `session_${targetDate}_${options.sessionId || Math.random().toString(36).slice(2, 9)}`;

    const edition: ArchivedEdition = {
      id: permanentId,
      sessionType,
      sessionId: options.sessionId,
      label: options.label,
      date: targetDate,
      generatedAt: new Date().toISOString(),
      itemCount: items.length,
      topics: uniqueTopics,
      items,
      leadArticleTitle: leadItem.title
    };

    await storage.runTransaction(this.STORAGE_KEY, async (tx) => {
      const raw = await tx.get();
      let existingEditions: ArchivedEdition[] = [];

      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (!Array.isArray(parsed)) {
            throw new CorruptedDataError('Archiv-Daten sind kein gültiges Array.', raw);
          }
          existingEditions = parsed.map(this.migrateLegacyRecord);
        } catch (err) {
          if (err instanceof CorruptedDataError) throw err;
          throw new CorruptedDataError('Archiv-Speicher konnte nicht geparst werden.', raw, err);
        }
      }

      // Replace only the matching unique unit ID, preserving all other sessions on that date!
      const updated = existingEditions.filter(e => e.id !== permanentId);
      updated.unshift(edition);

      // Keep chronological order descending
      updated.sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));

      await tx.set(JSON.stringify(updated));
      return updated;
    });

    return edition;
  }

  /**
   * Retrieves all saved historical editions and sessions.
   * Throws CorruptedDataError on malformed storage instead of silently wiping.
   */
  public static async getAllArchivedEditions(storage: AtemStorage = appStorage): Promise<ArchivedEdition[]> {
    const raw = await storage.getItem(this.STORAGE_KEY);
    if (!raw) return [];

    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        throw new CorruptedDataError('Archiv-Inhalt ist kein Array.', raw);
      }
      return parsed.map(this.migrateLegacyRecord);
    } catch (err) {
      if (err instanceof CorruptedDataError) throw err;
      throw new CorruptedDataError('Archiv-Daten beschädigt.', raw, err);
    }
  }

  /**
   * Alias for getAllArchivedEditions.
   */
  public static async getAllEditions(storage: AtemStorage = appStorage): Promise<ArchivedEdition[]> {
    return this.getAllArchivedEditions(storage);
  }

  /**
   * Safely isolates corrupted archive data into a backup key and restores an empty archive.
   */
  public static async recoverCorruptedArchive(storage: AtemStorage = appStorage): Promise<{ backupKey: string }> {
    const raw = await storage.getItem(this.STORAGE_KEY);
    const backupKey = `@atem:archive_editions:corrupted_backup:${Date.now()}`;
    if (raw) {
      await storage.setItem(backupKey, raw);
    }
    await storage.setItem(this.STORAGE_KEY, JSON.stringify([]));
    return { backupKey };
  }

  /**
   * Retrieves a single historical edition by its YYYY-MM-DD date and optional sessionType.
   */
  public static async getEditionByDate(
    date: string,
    sessionType: ArchiveSessionType = 'daily',
    storage: AtemStorage = appStorage
  ): Promise<ArchivedEdition | null> {
    const editions = await this.getAllArchivedEditions(storage);
    return editions.find(e => e.date === date && e.sessionType === sessionType) || null;
  }

  /**
   * Retrieves an edition by its permanent unique ID.
   */
  public static async getEditionById(
    id: string,
    storage: AtemStorage = appStorage
  ): Promise<ArchivedEdition | null> {
    const editions = await this.getAllArchivedEditions(storage);
    return editions.find(e => e.id === id) || null;
  }

  /**
   * Full-text search across all archived editions and articles.
   */
  public static async searchArchive(
    query: ArchiveSearchQuery,
    storage: AtemStorage = appStorage
  ): Promise<FeedItem[]> {
    const editions = await this.getAllArchivedEditions(storage);
    const filteredEditions = query.sessionType
      ? editions.filter(e => e.sessionType === query.sessionType)
      : editions;

    const allItems = filteredEditions.flatMap(e => e.items);

    // Deduplicate items across editions by ID
    const itemMap = new Map<string, FeedItem>();
    for (const item of allItems) {
      if (!itemMap.has(item.id)) {
        itemMap.set(item.id, item);
      }
    }
    let list = Array.from(itemMap.values());

    if (query.topic) {
      list = list.filter(item => item.topics.includes(query.topic!) || item.primaryTopic === query.topic);
    }

    if (query.space) {
      list = list.filter(item => item.space === query.space);
    }

    if (query.from) {
      list = list.filter(item => (item.editionDate || item.publishedAt) >= query.from!);
    }

    if (query.to) {
      list = list.filter(item => (item.editionDate || item.publishedAt) <= query.to!);
    }

    if (query.term && query.term.trim()) {
      const q = query.term.toLowerCase().trim();
      list = list.filter(item =>
        item.title.toLowerCase().includes(q) ||
        (item.subtitle && item.subtitle.toLowerCase().includes(q)) ||
        item.body.toLowerCase().includes(q) ||
        (item.keyInsight && item.keyInsight.toLowerCase().includes(q))
      );
    }

    return list;
  }

  /**
   * Formats an archived edition as a formatted Craft/Obsidian Markdown document.
   */
  public static exportEditionToMarkdown(edition: ArchivedEdition): string {
    const typeLabel = edition.sessionType === 'daily'
      ? 'Tagesausgabe'
      : (edition.label || 'Recherche-Session');

    const lines: string[] = [
      `# atmen ${typeLabel}: ${edition.date}`,
      `*Erstellt am ${edition.generatedAt} • ${edition.itemCount} kuratierte Artikel*`,
      '',
      `## Überblick & Leitartikel`,
      `**${edition.leadArticleTitle}**`,
      '',
      `---`,
      ''
    ];

    edition.items.forEach((item, index) => {
      lines.push(`### ${index + 1}. ${item.title}`);
      if (item.subtitle) lines.push(`*${item.subtitle}*`);
      lines.push('');
      lines.push(`- **Raum / Channel:** ${item.space || 'c/philosophie_ethik'}`);
      lines.push(`- **Lesezeit:** ${item.estimatedReadingMinutes} Minuten`);
      if (item.keyInsight) lines.push(`- **Kernaussage:** ${item.keyInsight}`);
      lines.push('');
      lines.push(item.articleBody || item.body);
      lines.push('');
      if (item.sourceReferences && item.sourceReferences.length > 0) {
        lines.push('**Quellen & Verifikation:**');
        item.sourceReferences.forEach(src => {
          lines.push(`- [${src.publisher || 'Quelle'}](${src.originalUrl}) - ${src.title || ''}`);
        });
      }
      lines.push('');
      lines.push('---');
      lines.push('');
    });

    return lines.join('\n');
  }

  /**
   * Calculates overall archive statistics.
   */
  public static async getArchiveStats(storage: AtemStorage = appStorage): Promise<{
    totalEditions: number;
    totalArticles: number;
    totalEstimatedReadingHours: number;
    availableDates: string[];
  }> {
    const editions = await this.getAllArchivedEditions(storage);
    const allItems = editions.flatMap(e => e.items);
    const totalMinutes = allItems.reduce((acc, curr) => acc + (curr.estimatedReadingMinutes || 4), 0);

    return {
      totalEditions: editions.length,
      totalArticles: allItems.length,
      totalEstimatedReadingHours: Math.round((totalMinutes / 60) * 10) / 10,
      availableDates: Array.from(new Set(editions.map(e => e.date)))
    };
  }

  private static migrateLegacyRecord(record: any): ArchivedEdition {
    return {
      id: record.id || `daily_${record.date}`,
      sessionType: record.sessionType || 'daily',
      sessionId: record.sessionId,
      label: record.label,
      date: record.date || new Date().toISOString().slice(0, 10),
      generatedAt: record.generatedAt || new Date().toISOString(),
      itemCount: record.itemCount || (record.items ? record.items.length : 0),
      topics: record.topics || [],
      items: record.items || [],
      leadArticleTitle: record.leadArticleTitle || (record.items?.[0]?.title ?? 'Archiv-Ausgabe')
    };
  }
}
