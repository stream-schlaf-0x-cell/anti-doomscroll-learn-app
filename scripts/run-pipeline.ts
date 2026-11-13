import * as fs from 'fs';
import * as path from 'path';
import { VERIFIED_FEED_SOURCES } from '../src/core/ingestion/sources';
import { FeedItem } from '../src/core/domain/types';
import { fetchAllFeeds } from '../src/core/ingestion/feedFetcher';
import { deduplicateFeedItems } from '../src/core/ingestion/deduplicator';
import { normalizePipelineResults } from '../src/core/ingestion/pipelineCandidates';
import { parseSnapshotPayload } from '../src/core/feed/snapshotPayload';
import { SourceHealthInfo } from '../src/core/ingestion/sourceHealth';
import {
  BatchEditionEnricher,
  isSupportedFeedLanguage,
  satisfiesDefaultCuratedStandard,
  sanitizeCuratedFeedItem
} from '../src/core/enrichment/batchEnricher';
import { enrichStubItemWithFulltext, harvestWebPageContent } from '../src/core/ingestion/webContentExtractor';
import { enforceCuratedStreamDiversity } from '../src/core/domain/ranking';
import { defaultUsageLedger } from '../src/core/enrichment/ledger';
import { DEFAULT_GEMINI_MODEL, DEFAULT_OPENROUTER_MODEL } from '../src/core/ai/atmenAiClient';

export type SourceHealthRecord = SourceHealthInfo;

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

  const { normalizedCandidates, sourceHealth: sourceHealthMap, totalRawEntries, successFeedCount } = normalizePipelineResults(fetchResults, previousHealth, editionDate);
  for (const result of fetchResults) {
    const health = sourceHealthMap[result.source.id];
    console.log(`  [${health.fetchSuccess ? 'OK' : 'INFO'}] ${result.source.name} -> ${health.itemCount} valid items${health.lastError ? ` (${health.lastError})` : ''}`);
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

    console.log('\nApplying Fulltext Web Harvesting (Scrapling + HTML) & Batch Edition Enrichment...');
    const STUB_HARVEST_CONCURRENCY = 6;
    const MAX_SCRAPLING_HARVESTS = 28;
    const fulltextEnriched = [...interleavedItems];
    const shortStubIndices: number[] = [];
    for (let i = 0; i < fulltextEnriched.length && shortStubIndices.length < MAX_SCRAPLING_HARVESTS; i++) {
      const it = fulltextEnriched[i];
      const url = it.canonicalUrl || it.sourceReferences?.[0]?.originalUrl;
      if (url && /^https?:\/\//i.test(url) && ((it.feedText || '').trim().length < 220 || (it.body || '').trim().length < 500)) {
        shortStubIndices.push(i);
      }
    }
    for (let i = 0; i < shortStubIndices.length; i += STUB_HARVEST_CONCURRENCY) {
      const batchIndices = shortStubIndices.slice(i, i + STUB_HARVEST_CONCURRENCY);
      await Promise.allSettled(
        batchIndices.map(async idx => {
          const it = fulltextEnriched[idx];
          const url = it.canonicalUrl || it.sourceReferences?.[0]?.originalUrl;
          let updated = enrichStubItemWithFulltext(it);
          if (url && /^https?:\/\//i.test(url)) {
            try {
              const harvested = await harvestWebPageContent(url);
              if (harvested?.fullMarkdownBody && harvested.fullMarkdownBody.trim().length > (updated.articleBody || '').trim().length) {
                const richBody = harvested.fullMarkdownBody.trim();
                const richLead = (harvested.essenceText || richBody.slice(0, 420)).trim();
                updated = {
                  ...updated,
                  articleBody: richBody,
                  body: richBody,
                  feedText: updated.feedText && updated.feedText.length >= 160 ? updated.feedText : richLead,
                  wordCount: Math.max(updated.wordCount || 0, harvested.wordCount || richBody.split(/\s+/).length),
                  estimatedReadingMinutes: Math.max(
                    updated.estimatedReadingMinutes || 1,
                    harvested.estimatedReadingMinutes || Math.ceil(richBody.split(/\s+/).length / 180)
                  ),
                  evidenceTier: 'permitted_full_text'
                };
              }
            } catch {
              // Individual timeout falls back to deterministic fulltext stub cleanup
            }
          }
          fulltextEnriched[idx] = updated;
        })
      );
    }

    const preCurated = fulltextEnriched
      .filter(i => isSupportedFeedLanguage(i.title || '', `${i.subtitle || ''} ${i.feedText || ''} ${i.body || ''}`))
      .map(sanitizeCuratedFeedItem)
      .map(item => enrichStubItemWithFulltext(item))
      .filter(satisfiesDefaultCuratedStandard);
    const itemsToEnrich = preCurated.slice(0, 30);
    const tailItems = preCurated.slice(30);
    const enriched = await enricher.enrichBatch(itemsToEnrich);
    const combinedCurated = [...enriched, ...tailItems]
      .map(sanitizeCuratedFeedItem)
      .filter(item => !String(item.publishedAt).startsWith('2026-10-18') && item.id !== 'live-schwitzgebel-splintered-mind-1238336654')
      .filter(satisfiesDefaultCuratedStandard);
    const finalItems = enforceCuratedStreamDiversity(combinedCurated);

    fs.mkdirSync(path.dirname(PIPELINE_OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(PIPELINE_OUTPUT_PATH, JSON.stringify(finalItems, null, 2), 'utf-8');
    console.log(`Wrote ${finalItems.length} items to ${PIPELINE_OUTPUT_PATH}`);

    fs.mkdirSync(path.dirname(PUBLIC_SNAPSHOT_PATH), { recursive: true });
    const snapshotPayload = parseSnapshotPayload({
      generatedAt: nowIso,
      totalCandidateSources: VERIFIED_FEED_SOURCES.length,
      activeDeliveringSources: successFeedCount,
      items: finalItems,
      sourceHealth: sourceHealthMap
    });
    if (!snapshotPayload) throw new Error('No valid items fit the startup snapshot budget');
    fs.writeFileSync(PUBLIC_SNAPSHOT_PATH, JSON.stringify(snapshotPayload), 'utf-8');
    console.log(`Wrote public snapshot to ${PUBLIC_SNAPSHOT_PATH}`);
  } else {
    console.warn('\nNo live items fetched (offline environment). Existing pipeline-output.json preserved.');
  }
}

runIngestionPipeline().catch(err => {
  console.error('Fatal pipeline error:', err);
  process.exit(1);
});
