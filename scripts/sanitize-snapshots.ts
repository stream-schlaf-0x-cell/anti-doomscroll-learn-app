import * as fs from 'fs';
import * as path from 'path';
import { FeedItem, FeedItemSchema } from '../src/core/domain/types';
import { ZERO_WIDTH_REGEX, sanitizeImageUrl } from '../src/core/ingestion/rssParser';
import { stripBoilerplate, splitSentencesAware, isSubstantialSubtitle } from '../src/core/ingestion/normalizer';

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

function sanitizeItem(rawItem: FeedItem): FeedItem {
  const item = deepCleanZeroWidth(rawItem);
  const cleanTitle = (item.title || '').replace(ZERO_WIDTH_REGEX, '').trim();
  const rawBody = (item.articleBody || item.body || item.feedText || '').replace(ZERO_WIDTH_REGEX, '').trim();
  const cleanBody = stripBoilerplate(rawBody);

  let subtitle = (item.subtitle || '').replace(ZERO_WIDTH_REGEX, '').trim();
  subtitle = stripBoilerplate(subtitle);

  let feedText = (item.feedText || '').replace(ZERO_WIDTH_REGEX, '').trim();
  feedText = stripBoilerplate(feedText);

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

  // Image sanitization
  const cleanImg = sanitizeImageUrl(item.imageUrl);

  // Clean sourceReferences
  const sourceReferences = (item.sourceReferences || []).map(ref => ({
    ...ref,
    title: (ref.title || '').replace(ZERO_WIDTH_REGEX, '').trim()
  }));

  const cleaned: FeedItem = {
    ...item,
    title: cleanTitle,
    subtitle,
    feedText: feedText || cleanBody.slice(0, 500),
    articleBody: cleanBody || feedText,
    body: cleanBody || feedText,
    imageUrl: cleanImg,
    hasAuthenticImage: Boolean(cleanImg),
    sourceReferences
  };

  if (item.perspectiveDetails) {
    cleaned.perspectiveDetails = {
      ...item.perspectiveDetails,
      claim: stripBoilerplate((item.perspectiveDetails.claim || '').replace(ZERO_WIDTH_REGEX, '') || subtitle)
    };
  }

  return FeedItemSchema.parse(cleaned);
}

function runSanitization() {
  console.log('Sanitizing snapshot files...');

  if (fs.existsSync(PUBLIC_SNAPSHOT_PATH)) {
    const raw = fs.readFileSync(PUBLIC_SNAPSHOT_PATH, 'utf8');
    const data = JSON.parse(raw);
    if (Array.isArray(data.items)) {
      console.log(`Sanitizing public/feed-snapshot.json (${data.items.length} items)...`);
      data.items = data.items.map(sanitizeItem);
      fs.writeFileSync(PUBLIC_SNAPSHOT_PATH, JSON.stringify(data, null, 2), 'utf8');
      console.log('✓ public/feed-snapshot.json successfully sanitized.');
    }
  }

  if (fs.existsSync(PIPELINE_OUTPUT_PATH)) {
    const raw = fs.readFileSync(PIPELINE_OUTPUT_PATH, 'utf8');
    const data = JSON.parse(raw);
    if (Array.isArray(data)) {
      console.log(`Sanitizing src/core/data/pipeline-output.json (${data.length} items)...`);
      const sanitized = data.map(sanitizeItem);
      fs.writeFileSync(PIPELINE_OUTPUT_PATH, JSON.stringify(sanitized, null, 2), 'utf8');
      console.log('✓ src/core/data/pipeline-output.json successfully sanitized.');
    }
  }
}

runSanitization();
