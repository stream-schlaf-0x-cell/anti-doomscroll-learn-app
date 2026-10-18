import * as fs from 'fs';
import * as path from 'path';
import { VERIFIED_FEED_SOURCES } from '../src/core/ingestion/sources';
import { fetchAllFeeds } from '../src/core/ingestion/feedFetcher';
import { normalizeFeedEntry } from '../src/core/ingestion/normalizer';
import { deduplicateFeedItems } from '../src/core/ingestion/deduplicator';
import { FeedItem, FeedItemSchema } from '../src/core/domain/types';
import { BatchEditionEnricher } from '../src/core/enrichment/batchEnricher';
import { defaultUsageLedger } from '../src/core/enrichment/ledger';
import { DEFAULT_GEMINI_MODEL, DEFAULT_OPENROUTER_MODEL } from '../src/core/ai/atmenAiClient';

export interface SourceHealthRecord {
  sourceId: string;
  name: string;
  url: string;
  fetchSuccess: boolean;
  lastSuccessAt?: string;
  lastError?: string;
  itemCount: number;
  durationMs: number;
}

const PIPELINE_OUTPUT_PATH = path.resolve(__dirname, '../src/core/data/pipeline-output.json');
const SOURCE_HEALTH_PATH = path.resolve(__dirname, '../src/core/data/source-health.json');
const PUBLIC_SNAPSHOT_PATH = path.resolve(__dirname, '../public/feed-snapshot.json');

async function runIngestionPipeline() {
  console.log('=== atmen Bloomscrolling Content Ingestion & Snapshot Pipeline ===');
  console.log(`Configured concrete candidate sources: ${VERIFIED_FEED_SOURCES.length}`);

  const startTime = Date.now();
  const editionDate = new Date().toISOString().slice(0, 10);
  const nowIso = new Date().toISOString();

  // Load previous source health to preserve lastSuccessAt when a feed temporarily fails
  let previousHealth: Record<string, SourceHealthRecord> = {};
  try {
    if (fs.existsSync(SOURCE_HEALTH_PATH)) {
      previousHealth = JSON.parse(fs.readFileSync(SOURCE_HEALTH_PATH, 'utf-8'));
    }
  } catch {
    previousHealth = {};
  }

  // 1. Fetch all RSS/Atom feeds concurrently with high throughput for 350+ sources
  const fetchResults = await fetchAllFeeds(VERIFIED_FEED_SOURCES, 25, 6500);

  let successFeedCount = 0;
  let totalRawEntries = 0;
  const normalizedCandidates: FeedItem[] = [];
  const sourceHealthMap: Record<string, SourceHealthRecord> = {};

  for (const res of fetchResults) {
    const prev = previousHealth[res.source.id];
    if (res.success && res.entries.length > 0) {
      successFeedCount++;
      totalRawEntries += res.entries.length;
      console.log(`  [OK]   ${res.source.name.padEnd(42)} -> ${res.entries.length} entries (${res.durationMs}ms)`);

      // Take up to 4 newest items per source so no single feed dominates the pool
      const topEntries = res.entries.slice(0, 4);
      let validForSource = 0;

      for (const entry of topEntries) {
        try {
          const item = normalizeFeedEntry(entry, res.source, editionDate);
          const validated = FeedItemSchema.safeParse(item);
          if (validated.success) {
            normalizedCandidates.push(validated.data);
            validForSource++;
          }
        } catch {
          // Skip malformed individual item
        }
      }

      sourceHealthMap[res.source.id] = {
        sourceId: res.source.id,
        name: res.source.name,
        url: res.source.url,
        fetchSuccess: validForSource > 0,
        lastSuccessAt: validForSource > 0 ? res.fetchedAt : prev?.lastSuccessAt,
        lastError: validForSource === 0 ? 'Keine validen Einträge nach Normalisierung' : undefined,
        itemCount: validForSource,
        durationMs: res.durationMs
      };
    } else {
      console.warn(`  [WARN] ${res.source.name.padEnd(42)} -> FAILED: ${res.error}`);
      sourceHealthMap[res.source.id] = {
        sourceId: res.source.id,
        name: res.source.name,
        url: res.source.url,
        fetchSuccess: false,
        lastSuccessAt: prev?.lastSuccessAt,
        lastError: res.error || 'Abruf fehlgeschlagen',
        itemCount: 0,
        durationMs: res.durationMs
      };
    }
  }

  // 2. Deduplicate across canonical URL, content hash & normalized title
  const deduped = deduplicateFeedItems(normalizedCandidates);

  // 3. Sort by publishedAt descending first, then interleave by sourceDomain so the snapshot is balanced
  const sortedByDate = [...deduped.uniqueItems].sort((a, b) => {
    const tA = new Date(a.publishedAt).getTime() || 0;
    const tB = new Date(b.publishedAt).getTime() || 0;
    return tB - tA;
  });

  // Interleave by publisher so no source clumps at the top of the snapshot
  const byPublisher = new Map<string, FeedItem[]>();
  for (const item of sortedByDate) {
    const pub = item.sourceReferences[0]?.publisher || item.sourceDomain || 'unknown';
    if (!byPublisher.has(pub)) byPublisher.set(pub, []);
    byPublisher.get(pub)!.push(item);
  }

  const interleavedItems: FeedItem[] = [];
  let added = true;
  while (added) {
    added = false;
    for (const [, queue] of byPublisher.entries()) {
      if (queue.length > 0) {
        interleavedItems.push(queue.shift()!);
        added = true;
      }
    }
  }

  console.log('\n--- Pipeline Summary ---');
  console.log(`Sources succeeded:   ${successFeedCount} / ${VERIFIED_FEED_SOURCES.length}`);
  console.log(`Raw entries fetched: ${totalRawEntries}`);
  console.log(`Normalized valid:    ${normalizedCandidates.length}`);
  console.log(`Duplicates removed:  ${deduped.duplicateCount}`);
  console.log(`Final unique items:  ${interleavedItems.length}`);
  console.log(`Total duration:      ${Date.now() - startTime}ms`);

  // Always save source health telemetry
  fs.mkdirSync(path.dirname(SOURCE_HEALTH_PATH), { recursive: true });
  fs.writeFileSync(SOURCE_HEALTH_PATH, JSON.stringify(sourceHealthMap, null, 2), 'utf-8');
  console.log(`\nWrote source health telemetry to ${SOURCE_HEALTH_PATH}`);

  if (interleavedItems.length > 0) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.OPENROUTER_API_KEY || '';
    const provider = process.env.OPENROUTER_API_KEY ? 'openrouter' : 'gemini';
    const model = provider === 'openrouter' ? DEFAULT_OPENROUTER_MODEL : DEFAULT_GEMINI_MODEL;
    const enricher = new BatchEditionEnricher(
      defaultUsageLedger,
      async () => ({ provider, apiKey, model })
    );

    console.log('\nApplying Batch Edition Enrichment (semantic classification & German synthesis)...');
    const itemsToEnrich = interleavedItems.slice(0, 30);
    const tailItems = interleavedItems.slice(30);
    const enriched = await enricher.enrichBatch(itemsToEnrich);
    const finalItems = [...enriched, ...tailItems];

    fs.mkdirSync(path.dirname(PIPELINE_OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(PIPELINE_OUTPUT_PATH, JSON.stringify(finalItems, null, 2), 'utf-8');
    console.log(`Wrote ${finalItems.length} items to ${PIPELINE_OUTPUT_PATH}`);

    fs.mkdirSync(path.dirname(PUBLIC_SNAPSHOT_PATH), { recursive: true });
    const snapshotPayload = {
      generatedAt: nowIso,
      totalCandidateSources: VERIFIED_FEED_SOURCES.length,
      activeDeliveringSources: successFeedCount,
      items: finalItems,
      sourceHealth: sourceHealthMap
    };
    fs.writeFileSync(PUBLIC_SNAPSHOT_PATH, JSON.stringify(snapshotPayload, null, 2), 'utf-8');
    console.log(`Wrote public snapshot to ${PUBLIC_SNAPSHOT_PATH}`);
  } else {
    console.warn('\nNo live items fetched (offline environment). Existing pipeline-output.json preserved.');
  }
}

runIngestionPipeline().catch(err => {
  console.error('Fatal pipeline error:', err);
  process.exit(1);
});
