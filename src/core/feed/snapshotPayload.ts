import { FeedItem, FeedItemSchema } from '../domain/types';
import { isDeliveringHealth, parseSourceHealth, SourceHealthInfo } from '../ingestion/sourceHealth';

export const STARTUP_SNAPSHOT_MAX_ITEMS = 200;
export const STARTUP_SNAPSHOT_MAX_BYTES = 1_500_000;

export interface SnapshotPayload {
  generatedAt?: string;
  totalCandidateSources: number;
  activeDeliveringSources: number;
  totalAvailableItems: number;
  items: FeedItem[];
  sourceHealth: Record<string, SourceHealthInfo>;
}

export function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (const character of value) {
    const code = character.codePointAt(0)!;
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
  }
  return bytes;
}

/** Keeps complete reader bodies, taking one item per publisher before a second pass. */
export function selectStartupItems(items: FeedItem[], byteBudget = STARTUP_SNAPSHOT_MAX_BYTES): FeedItem[] {
  const buckets = new Map<string, FeedItem[]>();
  for (const item of items) {
    const publisher = item.sourceDomain || item.sourceReferences[0]?.publisher || item.id;
    const queue = buckets.get(publisher) || [];
    queue.push(item);
    buckets.set(publisher, queue);
  }
  const result: FeedItem[] = [];
  let bytes = 2;
  const seen = new Set<string>();
  let pending = true;
  while (pending && result.length < STARTUP_SNAPSHOT_MAX_ITEMS) {
    pending = false;
    for (const queue of buckets.values()) {
      const item = queue.shift();
      if (!item) continue;
      pending = true;
      const key = item.canonicalUrl || item.id;
      if (seen.has(key)) continue;
      seen.add(key);
      const itemBytes = utf8ByteLength(JSON.stringify(item)) + (result.length ? 1 : 0);
      if (bytes + itemBytes > byteBudget) continue;
      result.push(item);
      bytes += itemBytes;
      if (result.length === STARTUP_SNAPSHOT_MAX_ITEMS) break;
    }
  }
  return result;
}

export function parseSnapshotPayload(value: unknown): SnapshotPayload | null {
  if (!value || typeof value !== 'object') return null;
  const object = value as Record<string, unknown>;
  const rawItems = Array.isArray(value) ? value : object.items;
  if (!Array.isArray(rawItems)) return null;
  const validItems: FeedItem[] = [];
  for (const raw of rawItems) {
    const parsed = FeedItemSchema.safeParse(raw);
    if (parsed.success) validItems.push(parsed.data);
  }
  if (!validItems.length) return null;
  const sourceHealth = parseSourceHealth(object.sourceHealth);
  const generatedAt = typeof object.generatedAt === 'string' && Number.isFinite(Date.parse(object.generatedAt))
    ? object.generatedAt : undefined;
  const payload: SnapshotPayload = {
    generatedAt,
    totalCandidateSources: typeof object.totalCandidateSources === 'number' && Number.isInteger(object.totalCandidateSources) && object.totalCandidateSources >= 0
      ? object.totalCandidateSources : Object.keys(sourceHealth).length,
    activeDeliveringSources: Object.values(sourceHealth).filter(isDeliveringHealth).length,
    totalAvailableItems: typeof object.totalAvailableItems === 'number' && Number.isInteger(object.totalAvailableItems) && object.totalAvailableItems >= validItems.length
      ? object.totalAvailableItems : validItems.length,
    items: [], sourceHealth
  };
  const metadataBytes = utf8ByteLength(JSON.stringify(payload));
  payload.items = selectStartupItems(validItems, Math.max(0, STARTUP_SNAPSHOT_MAX_BYTES - metadataBytes));
  return payload.items.length ? payload : null;
}
