import * as fs from 'fs';
import * as path from 'path';
import { FeedItem, FeedItemSchema, TOPIC_SPACE_MAP, TopicTag } from '../src/core/domain/types';
import { REAL_KNOWLEDGE_VAULT } from '../src/core/data/realKnowledgeVault';
import { resolveItemSpaceHandle } from '../src/core/spaces/spaceRepository';
import { ZERO_WIDTH_REGEX, sanitizeImageUrl } from '../src/core/ingestion/rssParser';
import { stripBoilerplate, splitSentencesAware, isSubstantialSubtitle } from '../src/core/ingestion/normalizer';
import {
  sanitizeCuratedFeedItem,
  stripSyntheticFillerSentences,
  isSupportedFeedLanguage,
  satisfiesDefaultCuratedStandard
} from '../src/core/enrichment/batchEnricher';

const PUBLIC_SNAPSHOT_PATH = path.resolve(__dirname, '../public/feed-snapshot.json');
const PIPELINE_OUTPUT_PATH = path.resolve(__dirname, '../src/core/data/pipeline-output.json');

function deepCleanZeroWidth<T>(obj: T): T {
  if (typeof obj === 'string') {
    return obj.replace(ZERO_WIDTH_REGEX, '').trim() as unknown as T;
  }
  if (Array.isArray(obj)) {
    return obj.map(deepCleanZeroWidth) as unknown as T;
  }
  if (obj && typeof obj === 'object') {
    const res: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) {
      res[k] = deepCleanZeroWidth(v);
    }
    return res as T;
  }
  return obj;
}

function sanitizeItem(rawItem: FeedItem): FeedItem | null {
  try {
    const item = deepCleanZeroWidth(rawItem);
    const cleanTitle = (item.title || '').replace(ZERO_WIDTH_REGEX, '').trim();
    if (!cleanTitle) return null;

    const rawBody = (item.articleBody || item.body || item.feedText || '').replace(ZERO_WIDTH_REGEX, '').trim();
    const cleanBody = stripSyntheticFillerSentences(stripBoilerplate(rawBody));

    let subtitle = (item.subtitle || '').replace(ZERO_WIDTH_REGEX, '').trim();
    subtitle = stripSyntheticFillerSentences(stripBoilerplate(subtitle));

    let feedText = (item.feedText || '').replace(ZERO_WIDTH_REGEX, '').trim();
    feedText = stripSyntheticFillerSentences(stripBoilerplate(feedText));

    const isVisual =
      item.format === 'art_showcase' ||
      item.format === 'meme' ||
      item.primaryTopic === 'memes_satire' ||
      item.primaryTopic === 'art_aesthetics' ||
      item.space === 'c/memes' ||
      item.space === 'c/kunst_galerie';

    if (!isVisual && feedText.length < 90) {
      if (cleanBody.length >= 90) {
        feedText = cleanBody.slice(0, 500);
      } else {
        return null;
      }
    }

    // Subtitle substance guard
    if (!isSubstantialSubtitle(subtitle)) {
      const sentences = splitSentencesAware(cleanBody || feedText).filter(Boolean);
      const substantialSentence = sentences.find(s => isSubstantialSubtitle(s));
      if (substantialSentence) {
        subtitle = substantialSentence.length > 150 ? substantialSentence.slice(0, 147).trim() + '…' : substantialSentence;
      } else {
        const publisher = item.sourceReferences?.[0]?.publisher || 'Redaktion';
        subtitle = `${publisher} • Redaktion`;
      }
    }

    const cleanImg = sanitizeImageUrl(item.imageUrl);
    const sourceReferences = (item.sourceReferences || []).map(ref => ({
      ...ref,
      title: (ref.title || '').replace(ZERO_WIDTH_REGEX, '').trim()
    }));

    const cleanKeyInsight = item.keyInsight
      ? stripSyntheticFillerSentences(stripBoilerplate(item.keyInsight))
      : undefined;
    const rawCleanTransfer = item.didacticTransfer
      ? stripSyntheticFillerSentences(stripBoilerplate(item.didacticTransfer))
      : undefined;
    // Strip legacy boilerplate didacticTransfer strings so snapshots only carry genuine impulses
    const legacyTransferRegex =
      /^(?:Bezug für Schule & Unterricht zu|Technologische Einordnung zu|Philosophische Einordnung zu|Klang- & Praxisbezug zu|Kontemplative Einordnung zu|Ästhetische Betrachtung zu|Spielerischer Perspektivwechsel zu|Inhaltliche Einordnung zu)\s+„/i;
    const cleanTransfer =
      rawCleanTransfer &&
      rawCleanTransfer.length >= 30 &&
      !rawCleanTransfer.endsWith(':') &&
      !legacyTransferRegex.test(rawCleanTransfer)
        ? rawCleanTransfer
        : undefined;

    const { didacticTransfer: _dropDt, didacticSeed: _dropDs, ...restItem } = item;

    const resolvedSpace =
      item.space ||
      resolveItemSpaceHandle(item) ||
      TOPIC_SPACE_MAP[item.primaryTopic]?.space ||
      'c/philosophie';

    const cleaned: FeedItem = {
      ...restItem,
      title: cleanTitle,
      subtitle,
      space: resolvedSpace,
      feedText: feedText || cleanBody.slice(0, 500),
      articleBody: cleanBody || feedText,
      body: cleanBody || feedText,
      ...(cleanKeyInsight && cleanKeyInsight.length >= 15 ? { keyInsight: cleanKeyInsight } : {}),
      ...(cleanTransfer ? { didacticTransfer: cleanTransfer, didacticSeed: cleanTransfer } : {}),
      imageUrl: cleanImg,
      hasAuthenticImage: Boolean(cleanImg),
      sourceReferences
    };

    if (item.perspectiveDetails) {
      cleaned.perspectiveDetails = {
        ...item.perspectiveDetails,
        claim: stripSyntheticFillerSentences(stripBoilerplate((item.perspectiveDetails.claim || '').replace(ZERO_WIDTH_REGEX, '') || subtitle))
      };
    }

    const fullyCurated = sanitizeCuratedFeedItem(cleaned);
    return FeedItemSchema.parse(fullyCurated);
  } catch {
    return null;
  }
}

function pruneAndBalanceItems(items: FeedItem[], targetLimit = 140): FeedItem[] {
  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();
  const validItems: FeedItem[] = [];

  for (const item of items) {
    const normTitle = (item.title || '').trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
    const canonical = (item.canonicalUrl || item.sourceReferences?.[0]?.originalUrl || '').trim().toLowerCase();

    if (!normTitle || seenTitles.has(normTitle)) continue;
    if (canonical && seenUrls.has(canonical)) continue;

    if (!isSupportedFeedLanguage(item.title || '', `${item.subtitle || ''} ${item.feedText || ''}`)) {
      continue;
    }

    seenTitles.add(normTitle);
    if (canonical) seenUrls.add(canonical);
    validItems.push(item);
  }

  // Group by primary topic / space to ensure balanced representation
  const byTopic = new Map<string, FeedItem[]>();
  for (const item of validItems) {
    const key = item.space || item.primaryTopic || 'general';
    const list = byTopic.get(key) || [];
    list.push(item);
    byTopic.set(key, list);
  }

  // Sort within each topic by substance and recency
  for (const [key, list] of byTopic.entries()) {
    list.sort((a, b) => {
      const aScore = (a.feedText?.length || 0) + (a.articleBody?.length || 0) * 0.2;
      const bScore = (b.feedText?.length || 0) + (b.articleBody?.length || 0) * 0.2;
      return bScore - aScore;
    });
  }

  // Round-robin selection across topics up to targetLimit with strict per-domain diversity cap (<= 4 per domain)
  const selected: FeedItem[] = [];
  const domainCounts = new Map<string, number>();
  const keys = Array.from(byTopic.keys());
  let addedInRound = true;
  let roundIdx = 0;

  while (selected.length < targetLimit && addedInRound) {
    addedInRound = false;
    for (const key of keys) {
      if (selected.length >= targetLimit) break;
      const list = byTopic.get(key);
      if (list && roundIdx < list.length) {
        const candidate = list[roundIdx];
        const dom = (candidate.sourceDomain || candidate.sourceReferences?.[0]?.publisher || candidate.id).toLowerCase().replace(/^www\./, '');
        const maxPerDom = candidate.format === 'art_showcase' ? 3 : 5;
        if ((domainCounts.get(dom) || 0) < maxPerDom) {
          selected.push(candidate);
          domainCounts.set(dom, (domainCounts.get(dom) || 0) + 1);
        }
        addedInRound = true;
      }
    }
    roundIdx++;
  }

  return selected;
}

function runSanitization() {
  console.log('Sanitizing and trimming snapshot files...');

  let pipelineCandidates: FeedItem[] = [];

  if (fs.existsSync(PIPELINE_OUTPUT_PATH)) {
    const raw = fs.readFileSync(PIPELINE_OUTPUT_PATH, 'utf8');
    const data = JSON.parse(raw);
    const arr = Array.isArray(data) ? data : (Array.isArray(data.items) ? data.items : []);
    for (const rawItem of arr) {
      if (rawItem.id?.startsWith('vault-')) continue;
      const sanitized = sanitizeItem(rawItem);
      if (sanitized) pipelineCandidates.push(sanitized);
    }
  }

  if (fs.existsSync(PUBLIC_SNAPSHOT_PATH)) {
    const raw = fs.readFileSync(PUBLIC_SNAPSHOT_PATH, 'utf8');
    const data = JSON.parse(raw);
    const arr = Array.isArray(data.items) ? data.items : [];
    for (const rawItem of arr) {
      if (rawItem.id?.startsWith('vault-')) continue;
      const sanitized = sanitizeItem(rawItem);
      if (sanitized) pipelineCandidates.push(sanitized);
    }
  }

  // 1. Write clean pipeline output (135 articles, zero vault items, article at [0])
  const prunedPipeline = pruneAndBalanceItems(pipelineCandidates, 135);
  fs.writeFileSync(PIPELINE_OUTPUT_PATH, JSON.stringify(prunedPipeline, null, 2), 'utf8');
  console.log(`✓ src/core/data/pipeline-output.json written (${prunedPipeline.length} items).`);

  // 2. Build public snapshot: pipeline articles + 20 diverse museum artworks (round-robin across museums)
  const seenInPipelineIds = new Set(prunedPipeline.map(i => i.id));
  const seenInPipelineUrls = new Set(
    prunedPipeline.map(i => (i.canonicalUrl || '').trim().toLowerCase()).filter(Boolean)
  );
  const existingGalleryCount = prunedPipeline.filter(i => resolveItemSpaceHandle(i) === 'c/kunst_galerie').length;
  const neededVaultArtworks = Math.max(22 - existingGalleryCount, 15);

  const byMuseum = new Map<string, FeedItem[]>();
  for (const vaultItem of REAL_KNOWLEDGE_VAULT) {
    if (vaultItem.space !== 'c/kunst_galerie') continue;
    const sanitized = sanitizeItem(vaultItem);
    if (!sanitized) continue;
    const normUrl = (sanitized.canonicalUrl || '').trim().toLowerCase();
    if (seenInPipelineIds.has(sanitized.id) || (normUrl && seenInPipelineUrls.has(normUrl))) continue;
    const museumDom = (sanitized.sourceDomain || sanitized.sourceReferences?.[0]?.publisher || 'museum')
      .toLowerCase()
      .replace(/^www\./, '');
    const list = byMuseum.get(museumDom) || [];
    list.push(sanitized);
    byMuseum.set(museumDom, list);
  }

  const galleryArtworks: FeedItem[] = [];
  const museumKeys = Array.from(byMuseum.keys());
  let round = 0;
  let added = true;
  while (galleryArtworks.length < neededVaultArtworks && added) {
    added = false;
    for (const mKey of museumKeys) {
      if (galleryArtworks.length >= neededVaultArtworks) break;
      const list = byMuseum.get(mKey);
      if (list && round < list.length) {
        galleryArtworks.push(list[round]);
        added = true;
      }
    }
    round++;
  }

  const snapshotItems: FeedItem[] = [...prunedPipeline, ...galleryArtworks];
  const snapshotDate = new Date().toISOString().slice(0, 10);
  const snapshotData = {
    generatedAt: new Date().toISOString(),
    snapshotDate,
    itemCount: snapshotItems.length,
    items: snapshotItems
  };
  fs.writeFileSync(PUBLIC_SNAPSHOT_PATH, JSON.stringify(snapshotData, null, 2), 'utf8');
  console.log(`✓ public/feed-snapshot.json written (${snapshotItems.length} items).`);
}

runSanitization();
