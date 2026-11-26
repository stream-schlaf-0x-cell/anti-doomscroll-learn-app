import * as fs from 'fs';
import * as path from 'path';
import { VERIFIED_FEED_SOURCES } from '../src/core/ingestion/sources';
import { FeedItem, TOPIC_SPACE_MAP } from '../src/core/domain/types';
import { fetchAllFeeds } from '../src/core/ingestion/feedFetcher';
import { deduplicateFeedItems } from '../src/core/ingestion/deduplicator';
import { normalizePipelineResults } from '../src/core/ingestion/pipelineCandidates';
import {
  compactItemForSnapshot,
  compactSourceHealthForSnapshot,
  parseSnapshotPayload,
  parseReservoirPayload
} from '../src/core/feed/snapshotPayload';
import { SourceHealthInfo, getSourceKind } from '../src/core/ingestion/sourceHealth';
import {
  BatchEditionEnricher,
  isSupportedFeedLanguage,
  satisfiesDefaultCuratedStandard,
  sanitizeCuratedFeedItem
} from '../src/core/enrichment/batchEnricher';
import { enrichStubItemWithFulltext, harvestWebPageContent } from '../src/core/ingestion/webContentExtractor';
import { enforceCuratedStreamDiversity, isSaxonyRegionalItem, isWithin14DayRelevanceWindow } from '../src/core/domain/ranking';
import { defaultUsageLedger } from '../src/core/enrichment/ledger';
import { DEFAULT_GEMINI_MODEL, DEFAULT_OPENROUTER_MODEL } from '../src/core/ai/atmenAiClient';

export type SourceHealthRecord = SourceHealthInfo;

const PIPELINE_OUTPUT_PATH = path.resolve(__dirname, '../src/core/data/pipeline-output.json');
const SOURCE_HEALTH_PATH = path.resolve(__dirname, '../src/core/data/source-health.json');
const PUBLIC_SNAPSHOT_PATH = path.resolve(__dirname, '../public/feed-snapshot.json');
const PUBLIC_RESERVOIR_PATH = path.resolve(__dirname, '../public/feed-reservoir.json');

export const STARTUP_SNAPSHOT_CAP = 136; // Rich, diverse startup edition across all 13 spaces (< 1 MB compacted)
export const DEEP_RESERVOIR_CAP = 650;   // Rolling 14-day deep endless reservoir lazy-loaded as user scrolls (< 4.5 MB compacted)
const SNAPSHOT_MAX_BODY_CHARS = 6000;
const RESERVOIR_MAX_BODY_CHARS = 7000;

export const PRIORITY_SPACES = [
  'c/didaktik_labor',
  'c/books',
  'c/kontemplation',
  'c/synth_alchemie',
  'c/acceleration',
  'c/dialektik',
  'c/serendipity',
  'c/health_longevity',
  'c/chancen',
  'c/youtube',
  'c/memes',
  'c/gesellschaft_politik'
] as const;

export function selectBalancedStartupItems(pool: FeedItem[], nowMs: number, cap = STARTUP_SNAPSHOT_CAP): FeedItem[] {
  const gallerySourcePool = pool.filter(i => i.space === 'c/kunst_galerie');
  const galleryKeep = gallerySourcePool.slice(0, Math.min(22, Math.max(1, Math.floor(cap * 0.18))));
  const editorialCandidates = pool.filter(
    i => i.space !== 'c/kunst_galerie' && isWithin14DayRelevanceWindow(i, nowMs)
  );

  const sortByFreshness = (a: FeedItem, b: FeedItem) => {
    const relA = a.publicationDateReliable !== false ? 1 : 0;
    const relB = b.publicationDateReliable !== false ? 1 : 0;
    if (relA !== relB) return relB - relA;
    return (new Date(b.publishedAt).getTime() || 0) - (new Date(a.publishedAt).getTime() || 0);
  };

  // Reserve floor slots for all 12 editorial knowledge spaces so every built-in channel flourishes
  const floorSelected: FeedItem[] = [];
  const floorIds = new Set<string>();
  for (const sp of PRIORITY_SPACES) {
    const quota = sp === 'c/gesellschaft_politik' ? 6 : 8;
    const matching = editorialCandidates
      .filter(i => i.space === sp)
      .sort(sortByFreshness)
      .slice(0, quota);
    for (const m of matching) {
      if (!floorIds.has(m.id)) {
        floorIds.add(m.id);
        floorSelected.push(m);
      }
    }
  }

  // Guarantee >= 6 Dresden / Leipzig / Saxony regional items
  const existingSaxonyCount = floorSelected.filter(i => isSaxonyRegionalItem(i)).length;
  if (existingSaxonyCount < 6) {
    const needed = 6 - existingSaxonyCount;
    const saxonyExtras = editorialCandidates
      .filter(i => !floorIds.has(i.id) && isSaxonyRegionalItem(i))
      .sort(sortByFreshness)
      .slice(0, needed);
    for (const sx of saxonyExtras) {
      floorIds.add(sx.id);
      floorSelected.push(sx);
    }
  }

  const remainingFreshFirst = editorialCandidates
    .filter(i => !floorIds.has(i.id))
    .sort(sortByFreshness);

  const targetEditorialCount = Math.max(0, cap - galleryKeep.length);
  const editorialDiversified = enforceCuratedStreamDiversity([
    ...interleaveByPublisherAndSpace(floorSelected),
    ...remainingFreshFirst
  ]).slice(0, targetEditorialCount);

  const finalItems: FeedItem[] = [];
  const stride = galleryKeep.length > 0 ? Math.max(3, Math.floor(editorialDiversified.length / galleryKeep.length)) : 999;
  let gIdx = 0;
  for (let idx = 0; idx < editorialDiversified.length; idx++) {
    finalItems.push(editorialDiversified[idx]);
    if (
      (idx + 1) % stride === 0 &&
      gIdx < galleryKeep.length &&
      finalItems[finalItems.length - 1]?.space !== 'c/kunst_galerie'
    ) {
      finalItems.push(galleryKeep[gIdx++]);
    }
  }
  while (gIdx < galleryKeep.length && finalItems.length < cap) {
    if (finalItems[finalItems.length - 1]?.space === 'c/kunst_galerie') break;
    finalItems.push(galleryKeep[gIdx++]);
  }
  return finalItems.slice(0, cap);
}

export function selectCappedReservoirItems(pool: FeedItem[], cap = DEEP_RESERVOIR_CAP): FeedItem[] {
  const reservoirGallery = pool.filter(i => i.space === 'c/kunst_galerie').slice(0, 60);
  const editorialAll = pool.filter(i => i.space !== 'c/kunst_galerie');
  const isProtected = (i: FeedItem) =>
    i.space === 'c/youtube' || i.space === 'c/memes' || isSaxonyRegionalItem(i);
  const protectedEditorial = interleaveByPublisherAndSpace(editorialAll.filter(isProtected));
  const otherEditorial = interleaveByPublisherAndSpace(editorialAll.filter(i => !isProtected(i)));
  const maxEditorial = Math.max(0, cap - reservoirGallery.length);
  return [
    ...[...protectedEditorial, ...otherEditorial].slice(0, maxEditorial),
    ...reservoirGallery
  ].slice(0, cap);
}

function normalizeTitleKey(title: string): string {
  return (title || '').trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

function normalizeUrlKey(url?: string): string {
  return (url || '').trim().toLowerCase().replace(/\/+$/, '');
}

function interleaveByPublisherAndSpace(items: FeedItem[]): FeedItem[] {
  const byPub = new Map<string, FeedItem[]>();
  for (const item of items) {
    const pub = (item.sourceDomain || item.sourceReferences?.[0]?.publisher || item.id).toLowerCase();
    const list = byPub.get(pub) || [];
    list.push(item);
    byPub.set(pub, list);
  }
  const out: FeedItem[] = [];
  let added = true;
  while (added) {
    added = false;
    for (const queue of byPub.values()) {
      if (queue.length > 0) {
        out.push(queue.shift()!);
        added = true;
      }
    }
  }
  return out;
}

async function runIngestionPipeline() {
  console.log('=== atmen Living Endless Bloomscroll — 2-Tier Ingestion & Reservoir Pipeline ===');
  const feedCapableSources = VERIFIED_FEED_SOURCES.filter(s => getSourceKind(s) === 'feed');
  console.log(`Total catalog sources: ${VERIFIED_FEED_SOURCES.length} (RSS/Atom endpoints: ${feedCapableSources.length})`);

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

  // 1. Fetch all RSS/Atom endpoints concurrently (skipping pure reference homepages)
  const fetchResults = await fetchAllFeeds(feedCapableSources, 28, 6500);

  const { normalizedCandidates, sourceHealth: sourceHealthMap, totalRawEntries, successFeedCount } =
    normalizePipelineResults(fetchResults, previousHealth, editionDate);

  // Record reference-only catalog entries cleanly without hitting network
  for (const src of VERIFIED_FEED_SOURCES) {
    if (!sourceHealthMap[src.id]) {
      sourceHealthMap[src.id] = {
        sourceId: src.id,
        name: src.name,
        url: src.url,
        fetchSuccess: false,
        itemCount: 0,
        checkedAt: nowIso,
        lastError: 'Referenzseite oder Homepage – kein RSS-/Atom-Endpunkt',
        durationMs: 0
      };
    }
  }

  for (const result of fetchResults) {
    const health = sourceHealthMap[result.source.id];
    console.log(
      `  [${health.fetchSuccess ? 'OK' : 'INFO'}] ${result.source.name} -> ${health.itemCount} valid items${
        health.lastError ? ` (${health.lastError})` : ''
      }`
    );
  }

  // 2. Deduplicate across canonical URL, content hash & normalized title
  const deduped = deduplicateFeedItems(normalizedCandidates);

  // 3. Honest Date Sort: reliable publication dates strictly precede undated archive entries, then newest first
  const sortedByDate = [...deduped.uniqueItems].sort((a, b) => {
    const relA = a.publicationDateReliable !== false ? 1 : 0;
    const relB = b.publicationDateReliable !== false ? 1 : 0;
    if (relA !== relB) return relB - relA;
    const tA = new Date(a.publishedAt).getTime() || 0;
    const tB = new Date(b.publishedAt).getTime() || 0;
    return tB - tA;
  });

  const interleavedItems = interleaveByPublisherAndSpace(sortedByDate);

  console.log('\n--- Pipeline Summary ---');
  console.log(`RSS feeds succeeded: ${successFeedCount} / ${feedCapableSources.length}`);
  console.log(`Raw entries fetched: ${totalRawEntries}`);
  console.log(`Normalized valid:    ${normalizedCandidates.length}`);
  console.log(`Duplicates removed:  ${deduped.duplicateCount}`);
  console.log(`Final unique items:  ${interleavedItems.length}`);
  console.log(`Fetch duration:      ${Date.now() - startTime}ms`);

  fs.mkdirSync(path.dirname(SOURCE_HEALTH_PATH), { recursive: true });
  fs.writeFileSync(SOURCE_HEALTH_PATH, JSON.stringify(sourceHealthMap, null, 2), 'utf-8');
  console.log(`\nWrote source health telemetry to ${SOURCE_HEALTH_PATH}`);

  if (interleavedItems.length === 0) {
    console.warn('\nNo live items fetched (offline environment). Existing snapshots preserved.');
    return;
  }

  // 4. Expanded Fulltext Web Harvesting (Scrapling + HTML) on up to 110 short excerpts
  console.log('\nApplying Fulltext Web Harvesting (Scrapling + HTML) & Batch Edition Enrichment...');
  const STUB_HARVEST_CONCURRENCY = 10;
  const MAX_SCRAPLING_HARVESTS = 110;
  const fulltextEnriched = [...interleavedItems];
  const shortStubIndices: number[] = [];
  for (let i = 0; i < fulltextEnriched.length && shortStubIndices.length < MAX_SCRAPLING_HARVESTS; i++) {
    const it = fulltextEnriched[i];
    const url = it.canonicalUrl || it.sourceReferences?.[0]?.originalUrl;
    if (url && /^https?:\/\//i.test(url) && ((it.feedText || '').trim().length < 240 || (it.body || '').trim().length < 550)) {
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

  // 5. Resilient Server-Side AI Enrichment (with automatic Gemini stable-flash fallback in stateless CI)
  const apiKey = (process.env.GEMINI_API_KEY || process.env.OPENROUTER_API_KEY || '').trim();
  const provider = process.env.OPENROUTER_API_KEY ? 'openrouter' : 'gemini';
  const primaryModel = provider === 'openrouter' ? DEFAULT_OPENROUTER_MODEL : DEFAULT_GEMINI_MODEL;

  const itemsToEnrich = preCurated.slice(0, 36);
  const tailItems = preCurated.slice(36);
  let enriched = itemsToEnrich;

  if (apiKey) {
    const primaryEnricher = new BatchEditionEnricher(
      defaultUsageLedger,
      async () => ({ provider, apiKey, model: primaryModel })
    );
    enriched = await primaryEnricher.enrichBatch(itemsToEnrich);
    const anyAiAssisted = enriched.some(it => it.aiAssisted);
    if (!anyAiAssisted && provider === 'gemini') {
      console.log(`Primary model (${primaryModel}) produced 0 AI enrichments in CI; retrying with gemini-2.5-flash...`);
      const fallbackEnricher = new BatchEditionEnricher(
        defaultUsageLedger,
        async () => ({ provider: 'gemini', apiKey, model: 'gemini-2.5-flash' })
      );
      enriched = await fallbackEnricher.enrichBatch(itemsToEnrich);
    }
    console.log(`AI-assisted items in front batch: ${enriched.filter(i => i.aiAssisted).length} / ${itemsToEnrich.length}`);
  } else {
    console.log('No GEMINI_API_KEY / OPENROUTER_API_KEY in environment — using deterministic fulltext curation.');
  }

  const nowMs = Date.now();
  const combinedCurated = [...enriched, ...tailItems]
    .map(sanitizeCuratedFeedItem)
    .map(item => ({
      ...item,
      space:
        item.space && String(item.space).startsWith('c/')
          ? item.space
          : TOPIC_SPACE_MAP[item.primaryTopic]?.space || 'c/serendipity'
    }))
    .filter(
      item =>
        !String(item.publishedAt).startsWith('2026-10-18') &&
        item.id !== 'live-schwitzgebel-splintered-mind-1238336654'
    )
    .filter(satisfiesDefaultCuratedStandard);

  // 6. Build Tier-2 Rolling 14-Day Deep Endless Reservoir (`public/feed-reservoir.json`, up to 900 items)
  let previousReservoirItems: FeedItem[] = [];
  try {
    if (fs.existsSync(PUBLIC_RESERVOIR_PATH)) {
      const prevParsed = parseReservoirPayload(JSON.parse(fs.readFileSync(PUBLIC_RESERVOIR_PATH, 'utf-8')));
      if (prevParsed?.items) {
        previousReservoirItems = prevParsed.items;
      }
    } else if (fs.existsSync(PUBLIC_SNAPSHOT_PATH)) {
      const prevSnap = parseSnapshotPayload(JSON.parse(fs.readFileSync(PUBLIC_SNAPSHOT_PATH, 'utf-8')));
      if (prevSnap?.items) {
        previousReservoirItems = prevSnap.items;
      }
    }
  } catch {
    previousReservoirItems = [];
  }

  const reservoirIds = new Set<string>();
  const reservoirUrls = new Set<string>();
  const reservoirTitles = new Set<string>();
  const mergedReservoirPool: FeedItem[] = [];

  for (const candidate of [...combinedCurated, ...previousReservoirItems]) {
    const clean = sanitizeCuratedFeedItem(candidate);
    if (!satisfiesDefaultCuratedStandard(clean)) continue;
    if (clean.space !== 'c/kunst_galerie' && !isWithin14DayRelevanceWindow(clean, nowMs)) continue;
    if (reservoirIds.has(clean.id)) continue;
    const uKey = normalizeUrlKey(clean.canonicalUrl);
    if (uKey && reservoirUrls.has(uKey)) continue;
    const tKey = normalizeTitleKey(clean.title);
    if (tKey.length >= 8 && reservoirTitles.has(tKey)) continue;

    reservoirIds.add(clean.id);
    if (uKey) reservoirUrls.add(uKey);
    if (tKey.length >= 8) reservoirTitles.add(tKey);
    mergedReservoirPool.push({
      ...clean,
      space:
        clean.space && String(clean.space).startsWith('c/')
          ? clean.space
          : TOPIC_SPACE_MAP[clean.primaryTopic]?.space || 'c/serendipity'
    });
  }

  const cappedReservoirItems = selectCappedReservoirItems(mergedReservoirPool, DEEP_RESERVOIR_CAP);
  const compactReservoirItems = cappedReservoirItems.map(item =>
    compactItemForSnapshot(item, { maxBodyChars: RESERVOIR_MAX_BODY_CHARS })
  );

  fs.mkdirSync(path.dirname(PUBLIC_RESERVOIR_PATH), { recursive: true });
  const reservoirPayload = parseReservoirPayload({
    generatedAt: nowIso,
    totalCandidateSources: VERIFIED_FEED_SOURCES.length,
    activeDeliveringSources: successFeedCount,
    totalAvailableItems: mergedReservoirPool.length,
    items: compactReservoirItems,
    sourceHealth: {}
  });
  if (reservoirPayload) {
    const reservoirAllowedIds = new Set(reservoirPayload.items.map(p => p.id));
    const serializedReservoir = {
      ...reservoirPayload,
      items: compactReservoirItems.filter(it => reservoirAllowedIds.has(it.id))
    };
    const serializedJson = JSON.stringify(serializedReservoir);
    fs.writeFileSync(PUBLIC_RESERVOIR_PATH, serializedJson, 'utf-8');
    console.log(
      `Wrote Tier-2 Deep Endless Reservoir (${serializedReservoir.items.length} items, ${(Buffer.byteLength(serializedJson, 'utf8') / 1024).toFixed(1)} KB) to ${PUBLIC_RESERVOIR_PATH}`
    );
  }

  // 7. Build Tier-1 Fast Startup Snapshot (`public/feed-snapshot.json` & `pipeline-output.json`, ~120 items)
  // Guarantee strong representation across Founder core spaces + >= 22 gallery artworks + 70% < 48h freshness
  const cappedFinalItems = selectBalancedStartupItems(mergedReservoirPool, nowMs, STARTUP_SNAPSHOT_CAP);

  fs.mkdirSync(path.dirname(PIPELINE_OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(PIPELINE_OUTPUT_PATH, JSON.stringify(cappedFinalItems, null, 2), 'utf-8');
  console.log(`Wrote Tier-1 Startup Edition (${cappedFinalItems.length} items) to ${PIPELINE_OUTPUT_PATH}`);

  fs.mkdirSync(path.dirname(PUBLIC_SNAPSHOT_PATH), { recursive: true });
  const compactHealth = compactSourceHealthForSnapshot(sourceHealthMap);
  const compactSnapshotItems = cappedFinalItems.map(item =>
    compactItemForSnapshot(item, { maxBodyChars: SNAPSHOT_MAX_BODY_CHARS })
  );
  const snapshotPayload = parseSnapshotPayload({
    generatedAt: nowIso,
    totalCandidateSources: VERIFIED_FEED_SOURCES.length,
    activeDeliveringSources: successFeedCount,
    totalAvailableItems: reservoirPayload?.items.length ?? cappedFinalItems.length,
    items: compactSnapshotItems,
    sourceHealth: compactHealth
  });
  if (!snapshotPayload) throw new Error('No valid items fit the startup snapshot budget');
  const snapshotAllowedIds = new Set(snapshotPayload.items.map(p => p.id));
  const serializedSnapshot = {
    ...snapshotPayload,
    sourceHealth: compactHealth,
    items: compactSnapshotItems.filter(it => snapshotAllowedIds.has(it.id))
  };
  const serializedSnapshotJson = JSON.stringify(serializedSnapshot);
  fs.writeFileSync(PUBLIC_SNAPSHOT_PATH, serializedSnapshotJson, 'utf-8');
  console.log(
    `Wrote Tier-1 Public Snapshot (${serializedSnapshot.items.length} items, ${(Buffer.byteLength(serializedSnapshotJson, 'utf8') / 1024).toFixed(1)} KB) to ${PUBLIC_SNAPSHOT_PATH}`
  );
}

/**
 * Offline compaction pass for existing public/feed-snapshot.json and public/feed-reservoir.json.
 * Preserves today's fresh items and generatedAt timestamps without running a live 460-feed scrape.
 */
function compactExistingPublicSnapshots(): void {
  console.log('=== atmen Offline Snapshot & Reservoir Compaction ===');

  let compactedReservoirCount = 0;

  if (fs.existsSync(PUBLIC_RESERVOIR_PATH)) {
    const beforeRaw = fs.readFileSync(PUBLIC_RESERVOIR_PATH, 'utf-8');
    const beforeBytes = Buffer.byteLength(beforeRaw, 'utf8');
    const parsedRaw = JSON.parse(beforeRaw) as Record<string, unknown>;
    const parsedRes = parseReservoirPayload(parsedRaw, { skipByteBudget: true });
    if (parsedRes && parsedRes.items.length > 0) {
      const refMs = parsedRes.generatedAt ? Date.parse(parsedRes.generatedAt) : Date.now();
      const freshPool = parsedRes.items.filter(
        it => it.space === 'c/kunst_galerie' || isWithin14DayRelevanceWindow(it, refMs)
      );
      const selectedRes = selectCappedReservoirItems(freshPool, DEEP_RESERVOIR_CAP);
      const compactResItems = selectedRes.map(item =>
        compactItemForSnapshot(item, { maxBodyChars: RESERVOIR_MAX_BODY_CHARS })
      );
      const validatedRes = parseReservoirPayload({
        generatedAt: parsedRes.generatedAt,
        totalCandidateSources: parsedRes.totalCandidateSources,
        activeDeliveringSources: parsedRes.activeDeliveringSources,
        totalAvailableItems: parsedRes.totalAvailableItems,
        items: compactResItems,
        sourceHealth: {}
      });
      if (validatedRes) {
        const allowed = new Set(validatedRes.items.map(i => i.id));
        const finalResItems = compactResItems.filter(i => allowed.has(i.id));
        const outRes = {
          generatedAt: parsedRes.generatedAt,
          totalCandidateSources: parsedRes.totalCandidateSources,
          activeDeliveringSources: parsedRes.activeDeliveringSources,
          totalAvailableItems: Math.max(parsedRes.totalAvailableItems, finalResItems.length),
          items: finalResItems,
          sourceHealth: {}
        };
        const outJson = JSON.stringify(outRes);
        const afterBytes = Buffer.byteLength(outJson, 'utf8');
        fs.writeFileSync(PUBLIC_RESERVOIR_PATH, outJson, 'utf-8');
        compactedReservoirCount = finalResItems.length;
        console.log(
          `✓ feed-reservoir.json: ${parsedRes.items.length} -> ${finalResItems.length} items | ${(beforeBytes / 1024).toFixed(1)} KB -> ${(afterBytes / 1024).toFixed(1)} KB (${(afterBytes / (1024 * 1024)).toFixed(2)} MB)`
        );
      }
    }
  }

  if (fs.existsSync(PUBLIC_SNAPSHOT_PATH)) {
    const beforeRaw = fs.readFileSync(PUBLIC_SNAPSHOT_PATH, 'utf-8');
    const beforeBytes = Buffer.byteLength(beforeRaw, 'utf8');
    const parsedRaw = JSON.parse(beforeRaw) as Record<string, unknown>;
    const parsedSnap = parseSnapshotPayload(parsedRaw, { skipByteBudget: true });
    if (parsedSnap && parsedSnap.items.length > 0) {
      const refMs = parsedSnap.generatedAt ? Date.parse(parsedSnap.generatedAt) : Date.now();
      const selectedSnap = selectBalancedStartupItems(parsedSnap.items, refMs, STARTUP_SNAPSHOT_CAP);
      const compactHealth = compactSourceHealthForSnapshot(parsedSnap.sourceHealth);
      const compactSnapItems = selectedSnap.map(item =>
        compactItemForSnapshot(item, { maxBodyChars: SNAPSHOT_MAX_BODY_CHARS })
      );
      const validatedSnap = parseSnapshotPayload({
        generatedAt: parsedSnap.generatedAt,
        totalCandidateSources: parsedSnap.totalCandidateSources,
        activeDeliveringSources: parsedSnap.activeDeliveringSources,
        totalAvailableItems: compactedReservoirCount || parsedSnap.totalAvailableItems,
        items: compactSnapItems,
        sourceHealth: compactHealth
      });
      if (!validatedSnap) {
        throw new Error('Offline compaction produced no valid startup snapshot items');
      }
      const allowed = new Set(validatedSnap.items.map(i => i.id));
      const finalSnapItems = compactSnapItems.filter(i => allowed.has(i.id));
      const outSnap = {
        generatedAt: validatedSnap.generatedAt,
        totalCandidateSources: validatedSnap.totalCandidateSources,
        activeDeliveringSources: validatedSnap.activeDeliveringSources,
        totalAvailableItems: Math.max(compactedReservoirCount || validatedSnap.totalAvailableItems, finalSnapItems.length),
        items: finalSnapItems,
        sourceHealth: compactHealth
      };
      const outJson = JSON.stringify(outSnap);
      const afterBytes = Buffer.byteLength(outJson, 'utf8');
      fs.writeFileSync(PUBLIC_SNAPSHOT_PATH, outJson, 'utf-8');
      console.log(
        `✓ feed-snapshot.json:  ${parsedSnap.items.length} -> ${finalSnapItems.length} items | ${(beforeBytes / 1024).toFixed(1)} KB -> ${(afterBytes / 1024).toFixed(1)} KB`
      );
    }
  }
}

const isMainModule =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  Boolean(process.argv[1]) &&
  process.argv[1].replace(/\\/g, '/').endsWith('scripts/run-pipeline.ts');

if (isMainModule) {
  if (process.argv.includes('--compact-existing')) {
    try {
      compactExistingPublicSnapshots();
    } catch (err) {
      console.error('Fatal offline compaction error:', err);
      process.exit(1);
    }
  } else {
    runIngestionPipeline().catch(err => {
      console.error('Fatal pipeline error:', err);
      process.exit(1);
    });
  }
}
