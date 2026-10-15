import { FeedItem, ReadingInteraction, TOPIC_SPACE_MAP, TopicTag } from '../domain/types';

/**
 * Formats saved articles, reflections and sparring dialogues into clean,
 * structured Markdown ready for Craft Docs, Obsidian, Notion or Bear.
 */
export function generateCraftMarkdown(
  articles: FeedItem[],
  interactions: Record<string, ReadingInteraction>
): string {
  const dateStr = new Date().toLocaleDateString('de-DE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  let md = `# 🌿 Atem — Mein persönliches Erkenntnis-Archiv\n`;
  md += `*Exportiert am ${dateStr} • 100% Lokale Datensouveränität*\n\n`;
  md += `> Dieses Dokument enthält deine gespeicherten Lese-Entdeckungen, dialektischen Einwände, Unterrichtsideen und sokratischen Reflexionen aus dem Atem-Netzwerk.\n\n`;
  md += `---\n\n`;

  if (articles.length === 0) {
    md += `*Noch keine Artikel in der Bibliothek gespeichert. Sobald du Artikel merkst oder Notizen verfasst, erscheinen sie hier für Craft Docs.*\n`;
    return md;
  }

  // Group by topic space
  const grouped: Record<string, FeedItem[]> = {};
  for (const item of articles) {
    const space = item.space || TOPIC_SPACE_MAP[item.primaryTopic as TopicTag]?.space || 'c/allgemein';
    if (!grouped[space]) grouped[space] = [];
    grouped[space].push(item);
  }

  for (const [space, items] of Object.entries(grouped)) {
    md += `## 🌐 Space: \`${space}\`\n\n`;

    for (const item of items) {
      const interaction = interactions[item.id];
      const publisher = item.sourceReferences[0]?.publisher || 'Originalquelle';
      const author = item.sourceReferences[0]?.author || publisher;
      const url = item.canonicalUrl || item.sourceReferences[0]?.originalUrl || '';

      md += `### ${item.title}\n`;
      md += `**Quelle**: [${publisher}](${url}) • **Autor**: ${author} • **Gelesen**: ${item.estimatedReadingMinutes} Min.\n\n`;

      if (item.keyInsight) {
        md += `> **💡 Kern-Erkenntnis**: „${item.keyInsight}“\n\n`;
      }

      if (item.feedText) {
        md += `#### Zusammenfassung / Feed-Auszug\n${item.feedText}\n\n`;
      }

      if (item.perspectiveDetails?.claim) {
        md += `> **✦ Philosophische Streitfrage**: ${item.perspectiveDetails.claim}\n\n`;
      }

      if (item.didacticSeed) {
        md += `> **🏫 Didaktik-Labor**: ${item.didacticSeed}\n\n`;
      }

      // User notes & sparring
      const userNotes = interaction?.userNotes || [];
      if (userNotes.length > 0) {
        md += `#### ✍️ Eigene Reflexionen & Sparring\n\n`;
        for (const note of userNotes) {
          const tagLabel = note.tag === 'einwand'
            ? '⚡️ Einwand'
            : note.tag === 'unterricht'
            ? '🏫 Unterricht'
            : note.tag === 'these'
            ? '💡 Eigene These'
            : '📝 Notiz';

          const noteDate = new Date(note.createdAt).toLocaleDateString('de-DE', {
            hour: '2-digit',
            minute: '2-digit',
            day: '2-digit',
            month: '2-digit'
          });

          md += `- **[${tagLabel}]** (${noteDate}):\n  ${note.text}\n`;

          if (note.sparringReply) {
            md += `  - *${note.sparringReply.authorHandle} (${note.sparringReply.authorBadge || 'Sparring'})*:\n    > ${note.sparringReply.text}\n`;
          }
          md += `\n`;
        }
      }

      md += `---\n\n`;
    }
  }

  md += `\n*Erstellt mit [Atem](https://github.com/atem-network) — Anti-Doomscroll Knowledge Environment.*\n`;
  return md;
}

/**
 * Copies text to system clipboard across Web, iOS and Android safely.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    return false;
  } catch (err) {
    console.warn('Clipboard copy failed:', err);
    return false;
  }
}

/**
 * Triggers a browser download of the Markdown file on Web.
 */
export function downloadMarkdownFile(filename: string, content: string): boolean {
  try {
    if (typeof document !== 'undefined') {
      const blob = new Blob([content], { type: 'text/markdown;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', filename.endsWith('.md') ? filename : `${filename}.md`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return true;
    }
    return false;
  } catch (err) {
    console.warn('File download failed:', err);
    return false;
  }
}

/**
 * Triggers a browser download of a JSON file on Web.
 */
export function downloadJsonFile(filename: string, content: string): boolean {
  try {
    if (typeof document !== 'undefined') {
      const blob = new Blob([content], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', filename.endsWith('.json') ? filename : `${filename}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return true;
    }
    return false;
  } catch (err) {
    console.warn('JSON file download failed:', err);
    return false;
  }
}
