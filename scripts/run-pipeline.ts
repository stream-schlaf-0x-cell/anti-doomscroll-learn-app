import fs from 'node:fs/promises';
import path from 'node:path';
import { VERIFIED_FEED_SOURCES } from '../src/core/ingestion/sources';
import { fetchFeedXml } from '../src/core/ingestion/feedFetcher';
import { parseFeedXml } from '../src/core/ingestion/rssParser';
import { normalizeFeedEntry } from '../src/core/ingestion/normalizer';
import { deduplicateFeedItems } from '../src/core/ingestion/deduplicator';
import { FeedItem, FeedItemSchema } from '../src/core/domain/types';

const OUTPUT_FILE = path.resolve(__dirname, '../src/core/data/pipeline-output.json');

async function runPipeline() {
  console.log('=== Atem Pipeline: Live Content Ingestion ===\n');
  console.log(`Datum: ${new Date().toISOString()}`);
  console.log(`Quellen konfiguriert: ${VERIFIED_FEED_SOURCES.length}\n`);

  const collectedItems: FeedItem[] = [];
  const report: Array<{ source: string; status: string; fetched: number; valid: number }> = [];

  for (const source of VERIFIED_FEED_SOURCES) {
    process.stdout.write(`Fetching ${source.name} (${source.url})... `);
    try {
      const fetchRes = await fetchFeedXml(source.url, { timeoutMs: 12000 });
      const rawEntries = parseFeedXml(fetchRes.content, source.id);

      // Limit to 4 freshest entries per source
      const freshest = rawEntries.slice(0, 4);
      let validCount = 0;

      for (const entry of freshest) {
        try {
          const item = normalizeFeedEntry(entry, source);
          const parsed = FeedItemSchema.safeParse(item);
          if (parsed.success) {
            collectedItems.push(parsed.data);
            validCount++;
          } else {
            console.warn(`\n  Schema-Warnung für "${entry.title}": ${parsed.error.message}`);
          }
        } catch (normErr: any) {
          console.warn(`\n  Normalisierungsfehler: ${normErr?.message}`);
        }
      }

      console.log(`[OK] (${validCount} Einträge)`);
      report.push({
        source: source.name,
        status: 'OK',
        fetched: rawEntries.length,
        valid: validCount
      });
    } catch (err: any) {
      console.log(`[FEHLER: ${err?.message}]`);
      report.push({
        source: source.name,
        status: `FEHLER (${err?.message})`,
        fetched: 0,
        valid: 0
      });
    }
  }

  // Deduplication
  const { uniqueItems, duplicateCount } = deduplicateFeedItems(collectedItems);

  console.log('\n--- Zusammenfassung ---');
  console.table(report);
  console.log(`Roh erfasst: ${collectedItems.length}`);
  console.log(`Duplikate entfernt: ${duplicateCount}`);
  console.log(`Einzigartige Artikel bereitgestellt: ${uniqueItems.length}`);

  // Persist output
  await fs.writeFile(OUTPUT_FILE, JSON.stringify(uniqueItems, null, 2), 'utf8');
  console.log(`\nGespeichert in: ${OUTPUT_FILE}`);
  console.log('=== Pipeline erfolgreich abgeschlossen ===\n');
}

runPipeline().catch((err) => {
  console.error('Fataler Pipeline-Fehler:', err);
  process.exit(1);
});
