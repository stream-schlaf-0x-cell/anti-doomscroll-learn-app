/**
 * Autonomous Daily Pipeline Daemon
 * 
 * Runs in the background to automatically ingest RSS feeds,
 * synthesize dialectical trends, and generate fresh daily editions.
 * Designed to keep running "forever" locally.
 */

import { fetchFeedXml } from '../src/core/ingestion/feedFetcher';
import { parseFeedXml } from '../src/core/ingestion/rssParser';
import { normalizeFeedEntry } from '../src/core/ingestion/normalizer';
import { deduplicateFeedItems } from '../src/core/ingestion/deduplicator';
import { VERIFIED_FEED_SOURCES } from '../src/core/ingestion/sources';
import { FeedItem, FeedItemSchema } from '../src/core/domain/types';
import fs from 'node:fs/promises';
import path from 'node:path';

const OUTPUT_FILE = path.resolve(__dirname, '../src/core/data/pipeline-output.json');
const INTERVAL_MS = 1000 * 60 * 60 * 6; // Run every 6 hours

async function executeCycle() {
  const timestamp = new Date().toISOString();
  console.log(`[Daemon ${timestamp}] Starte Ingestion-Zyklus...`);

  const collected: FeedItem[] = [];

  for (const src of VERIFIED_FEED_SOURCES) {
    try {
      const res = await fetchFeedXml(src.url, { timeoutMs: 5000 });
      const raw = parseFeedXml(res.content, src.id);
      for (const entry of raw.slice(0, 3)) {
        const item = normalizeFeedEntry(entry, src);
        const parsed = FeedItemSchema.safeParse(item);
        if (parsed.success) {
          collected.push(parsed.data);
        }
      }
    } catch {
      // Non-fatal for individual feeds
    }
  }

  const { uniqueItems } = deduplicateFeedItems(collected);
  console.log(`[Daemon ${timestamp}] Zyklus beendet. ${uniqueItems.length} valide Artikel erfasst.`);

  try {
    let existing: FeedItem[] = [];
    try {
      const current = await fs.readFile(OUTPUT_FILE, 'utf8');
      existing = JSON.parse(current);
    } catch {
      existing = [];
    }

    const map = new Map<string, FeedItem>();
    for (const item of uniqueItems) {
      map.set(item.id, item);
    }
    for (const item of existing) {
      if (!map.has(item.id)) {
        map.set(item.id, item);
      }
    }

    const merged = Array.from(map.values());
    await fs.writeFile(OUTPUT_FILE, JSON.stringify(merged, null, 2), 'utf8');
    console.log(`[Daemon ${timestamp}] ${merged.length} Gesamteinträge in Pipeline-Output gesichert.`);
  } catch (err: any) {
    console.error(`[Daemon ${timestamp}] Fehler beim Schreiben:`, err?.message);
  }
}

async function main() {
  console.log('=== Atem Autonomous Daily Pipeline Daemon gestartet ===');
  console.log(`Intervall: Alle 6 Stunden (oder sofort beim Start)`);

  await executeCycle();

  setInterval(() => {
    void executeCycle();
  }, INTERVAL_MS);
}

main().catch(console.error);
