/**
 * Archive & Permanent Knowledge Library Service
 * 
 * Preserves every generated daily edition, deep-dive dossier, user notes,
 * and bookmarked insights in a permanent, local-first archive.
 * Never loses history. Supports full-text search, calendar indexing,
 * and 1-click export to Markdown / Craft / Raindrop.
 */

import { FeedItem, TopicTag } from '../domain/types';
import { appStorage } from '../data/storage';

export interface ArchivedEdition {
  date: string; // YYYY-MM-DD
  generatedAt: string;
  itemCount: number;
  topics: TopicTag[];
  items: FeedItem[];
  leadArticleTitle: string;
}

export interface ArchiveSearchQuery {
  term?: string;
  topic?: TopicTag;
  space?: string;
  from?: string;
  to?: string;
}

export class ArchiveService {
  private static STORAGE_KEY = '@atem:archive_editions';

  /**
   * Persists a daily edition into the permanent archive.
   * If an edition for that date already exists, it updates it.
   */
  public static async recordEdition(items: FeedItem[], date?: string): Promise<ArchivedEdition> {
    const targetDate = date || new Date().toISOString().slice(0, 10);
    const existingEditions = await this.getAllArchivedEditions();

    const uniqueTopics = Array.from(new Set(items.flatMap(i => i.topics || [i.primaryTopic])));
    const leadItem = items[0] || { title: 'Tagesausgabe' };

    const edition: ArchivedEdition = {
      date: targetDate,
      generatedAt: new Date().toISOString(),
      itemCount: items.length,
      topics: uniqueTopics,
      items,
      leadArticleTitle: leadItem.title
    };

    const updated = existingEditions.filter(e => e.date !== targetDate);
    updated.unshift(edition);

    // Keep chronological order descending
    updated.sort((a, b) => b.date.localeCompare(a.date));

    await appStorage.setItem(this.STORAGE_KEY, JSON.stringify(updated));
    return edition;
  }

  /**
   * Retrieves all saved historical editions.
   */
  public static async getAllArchivedEditions(): Promise<ArchivedEdition[]> {
    try {
      const raw = await appStorage.getItem(this.STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  /**
   * Retrieves a single historical edition by its YYYY-MM-DD date.
   */
  public static async getEditionByDate(date: string): Promise<ArchivedEdition | null> {
    const editions = await this.getAllArchivedEditions();
    return editions.find(e => e.date === date) || null;
  }

  /**
   * Full-text search across all archived editions and articles.
   */
  public static async searchArchive(query: ArchiveSearchQuery): Promise<FeedItem[]> {
    const editions = await this.getAllArchivedEditions();
    const allItems = editions.flatMap(e => e.items);

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
   * Exports an archived edition as a formatted Craft/Obsidian Markdown document.
   */
  public static exportEditionToMarkdown(edition: ArchivedEdition): string {
    const lines: string[] = [
      `# atmen Tagesausgabe: ${edition.date}`,
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
  public static async getArchiveStats(): Promise<{
    totalEditions: number;
    totalArticles: number;
    totalEstimatedReadingHours: number;
    availableDates: string[];
  }> {
    const editions = await this.getAllArchivedEditions();
    const allItems = editions.flatMap(e => e.items);
    const totalMinutes = allItems.reduce((acc, curr) => acc + (curr.estimatedReadingMinutes || 4), 0);

    return {
      totalEditions: editions.length,
      totalArticles: allItems.length,
      totalEstimatedReadingHours: Math.round((totalMinutes / 60) * 10) / 10,
      availableDates: editions.map(e => e.date)
    };
  }
}
