/**
 * Rebuilds public/feed-snapshot.json from the full pipeline pool + verified knowledge vault.
 * - Cleans RSS formatting artifacts (bylines, raw dates, photo captions, agency credits, blank gaps)
 * - Applies the 100% default curated quality gate (incl. visual gallery image contract)
 * - Caps per-domain items and ARD/Tagesschau share (anti-monoculture)
 * - Selects up to STARTUP_SNAPSHOT_MAX_ITEMS within STARTUP_SNAPSHOT_MAX_BYTES
 *
 * Usage: npx tsx scripts/rebuild-startup-snapshot.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { FeedItem, FeedItemSchema } from '../src/core/domain/types';
import {
  cleanArticleBodyFormatting,
  sanitizeCuratedFeedItem,
  satisfiesDefaultCuratedStandard
} from '../src/core/enrichment/batchEnricher';
import { REAL_KNOWLEDGE_VAULT } from '../src/core/data/realKnowledgeVault';
import { selectStartupItems, STARTUP_SNAPSHOT_MAX_BYTES } from '../src/core/feed/snapshotPayload';

const PUBLIC_SNAPSHOT_PATH = path.resolve(__dirname, '../public/feed-snapshot.json');
const PIPELINE_OUTPUT_PATH = path.resolve(__dirname, '../src/core/data/pipeline-output.json');

const PER_DOMAIN_CAP = 8;
const ARD_SHARE_CAP = 0.08;

function cleanTextFields(item: FeedItem): FeedItem {
  const title = item.title || '';
  return {
    ...item,
    subtitle: item.subtitle ? cleanArticleBodyFormatting(item.subtitle, title) : item.subtitle,
    feedText: item.feedText ? cleanArticleBodyFormatting(item.feedText, title) : item.feedText,
    body: item.body ? cleanArticleBodyFormatting(item.body, title) : item.body,
    ...(item.articleBody ? { articleBody: cleanArticleBodyFormatting(item.articleBody, title) } : {})
  };
}

function isArd(item: FeedItem): boolean {
  const hay = `${item.sourceDomain || ''} ${item.sourceBroadcasterName || ''} ${item.sourceReferences?.[0]?.publisher || ''}`.toLowerCase();
  return /tagesschau|\bard\b|ardmediathek|ndr\.de|mdr\.de|br\.de|wdr\.de|swr\.de|hr\.de|rbb/.test(hay);
}

function qualityKey(item: FeedItem): number {
  const time = new Date(item.publishedAt).getTime() || 0;
  const recencyDays = Math.max(0, (Date.now() - time) / 86_400_000);
  const recency = item.publicationDateReliable === false ? 0 : Math.max(0, 30 - recencyDays);
  return (item.curationScore ?? 7) * 10 + recency + (item.imageUrl ? 4 : 0) + (item.isEvergreenGem ? 6 : 0);
}

function main() {
  const pipeline: unknown[] = JSON.parse(fs.readFileSync(PIPELINE_OUTPUT_PATH, 'utf8'));
  const snapshot = JSON.parse(fs.readFileSync(PUBLIC_SNAPSHOT_PATH, 'utf8'));
  const existing: unknown[] = Array.isArray(snapshot.items) ? snapshot.items : [];

  // 1. Clean pipeline-output formatting in place
  const cleanedPipeline: FeedItem[] = [];
  for (const raw of pipeline) {
    const parsed = FeedItemSchema.safeParse(raw);
    if (!parsed.success) continue;
    cleanedPipeline.push(cleanTextFields(parsed.data));
  }
  fs.writeFileSync(PIPELINE_OUTPUT_PATH, JSON.stringify(cleanedPipeline, null, 2), 'utf8');
  console.log(`✓ pipeline-output.json cleaned (${cleanedPipeline.length} items)`);

  // 2. Merge candidates: verified vault + fresh snapshot + full pipeline pool
  const candidates: FeedItem[] = [];
  const seen = new Set<string>();
  const pushCandidate = (raw: unknown) => {
    const parsed = FeedItemSchema.safeParse(raw);
    if (!parsed.success) return;
    const item = sanitizeCuratedFeedItem(cleanTextFields(parsed.data));
    const key = (item.canonicalUrl || item.id).toLowerCase();
    if (seen.has(key) || seen.has(item.id)) return;
    if (!satisfiesDefaultCuratedStandard(item)) return;
    seen.add(key);
    seen.add(item.id);
    candidates.push(item);
  };
  REAL_KNOWLEDGE_VAULT.forEach(pushCandidate);
  existing.forEach(pushCandidate);
  cleanedPipeline.forEach(pushCandidate);

  // 3. Diversity caps (per-domain + ARD share)
  candidates.sort((a, b) => qualityKey(b) - qualityKey(a));
  const perDomain = new Map<string, number>();
  const capped: FeedItem[] = [];
  for (const item of candidates) {
    const isVault = item.id.startsWith('vault-');
    const domain = (item.sourceDomain || item.sourceReferences?.[0]?.publisher || item.id).toLowerCase();
    const count = perDomain.get(domain) || 0;
    if (!isVault && count >= PER_DOMAIN_CAP) continue;
    perDomain.set(domain, count + 1);
    capped.push(item);
  }
  const ardBudget = Math.floor(capped.length * ARD_SHARE_CAP);
  let ardCount = 0;
  const diversified = capped.filter(item => {
    if (!isArd(item)) return true;
    ardCount++;
    return ardCount <= ardBudget;
  });

  // 4. Select within byte/item budget
  const metadata = {
    generatedAt: new Date().toISOString(),
    totalCandidateSources: snapshot.totalCandidateSources ?? Object.keys(snapshot.sourceHealth || {}).length,
    activeDeliveringSources: snapshot.activeDeliveringSources ?? 0,
    totalAvailableItems: 0,
    items: [] as FeedItem[],
    sourceHealth: snapshot.sourceHealth || {}
  };
  const metaBytes = Buffer.byteLength(JSON.stringify(metadata), 'utf8');
  const selected = selectStartupItems(diversified, STARTUP_SNAPSHOT_MAX_BYTES - metaBytes - 50_000);
  metadata.items = selected;
  metadata.totalAvailableItems = Math.max(selected.length, diversified.length);

  fs.writeFileSync(PUBLIC_SNAPSHOT_PATH, JSON.stringify(metadata), 'utf8');

  const bySpace: Record<string, number> = {};
  for (const item of selected) {
    const key = item.space || `(topic:${item.primaryTopic})`;
    bySpace[key] = (bySpace[key] || 0) + 1;
  }
  const ardSelected = selected.filter(isArd).length;
  console.log(`✓ feed-snapshot.json: ${selected.length} items, ARD ${ardSelected} (${((ardSelected / selected.length) * 100).toFixed(1)}%), ${Buffer.byteLength(JSON.stringify(metadata), 'utf8')} bytes`);
  console.log(bySpace);
}

main();
