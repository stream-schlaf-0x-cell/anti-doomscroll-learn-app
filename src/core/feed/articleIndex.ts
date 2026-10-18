import { FeedItem, TopicTag } from '../domain/types';

/**
 * Stopwords for English and German to prevent indexing noise.
 */
const INDEX_STOPWORDS = new Set([
  // German
  'der', 'die', 'das', 'den', 'dem', 'des', 'und', 'von', 'zur', 'zum', 'mit', 'auf', 'aus',
  'für', 'wie', 'bei', 'ein', 'eine', 'einer', 'eines', 'einem', 'einen', 'auch', 'über',
  'unter', 'nach', 'vor', 'beim', 'diese', 'dieser', 'dieses', 'diesem', 'diesen', 'mehr',
  'oder', 'aber', 'sehr', 'hier', 'dort', 'wird', 'werden', 'wurde', 'wurden', 'kann', 'können',
  'konnte', 'könnten', 'soll', 'sollen', 'sollte', 'sollten', 'muss', 'müssen', 'musste',
  'durch', 'gegen', 'ohne', 'zwischen', 'nicht', 'warum', 'wieso', 'weshalb', 'welche',
  'welcher', 'welches', 'welchen', 'damit', 'dabei', 'dafür', 'davon', 'darüber', 'darum',
  'sein', 'seine', 'seiner', 'seinem', 'seinen', 'ihre', 'ihrer', 'ihrem', 'ihren', 'ihres',
  'wenn', 'weil', 'dass', 'denn', 'doch', 'schon', 'selbst', 'wieder', 'immer', 'jedoch',
  // English
  'the', 'and', 'with', 'from', 'that', 'this', 'what', 'when', 'where', 'which', 'about',
  'after', 'before', 'between', 'into', 'through', 'over', 'more', 'some', 'other', 'their',
  'there', 'these', 'those', 'have', 'been', 'were', 'will', 'would', 'could', 'should',
  'they', 'them', 'your', 'ours', 'for', 'are', 'was'
]);

const ACRONYM_WHITELIST = new Set([
  'ki', 'ai', 'llm', 'llms', 'mlx', 'midi', 'daz', 'dna', 'rna', 'gpu', 'npu', 'tpu'
]);

/**
 * ArticleIndex: Precomputed inverted index and topic registry.
 * Replaces O(N^2) pairwise comparisons with sub-millisecond candidate lookup.
 */
export class ArticleIndex {
  private topicMap = new Map<string, Set<string>>();
  private publisherMap = new Map<string, Set<string>>();
  private invertedTokenMap = new Map<string, Set<string>>();
  private itemMap = new Map<string, FeedItem>();
  private itemTokens = new Map<string, Set<string>>();

  constructor(items?: FeedItem[]) {
    if (items && items.length > 0) {
      this.buildIndex(items);
    }
  }

  /**
   * Tokenizes text into searchable clean keywords.
   */
  public tokenize(text: string): string[] {
    return (text || '')
      .toLowerCase()
      .replace(/[^a-zäöüß0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => (w.length >= 4 || ACRONYM_WHITELIST.has(w)) && !INDEX_STOPWORDS.has(w));
  }

  /**
   * Indexes a collection of items.
   */
  public buildIndex(items: FeedItem[]): void {
    this.clear();
    for (const item of items) {
      this.addItem(item);
    }
  }

  /**
   * Dynamically adds or updates an item in the index.
   */
  public addItem(item: FeedItem): void {
    this.itemMap.set(item.id, item);

    // 1. Topic Indexing
    const primaryTopic = item.primaryTopic || 'philosophy_ethics';
    if (!this.topicMap.has(primaryTopic)) {
      this.topicMap.set(primaryTopic, new Set());
    }
    this.topicMap.get(primaryTopic)!.add(item.id);

    if (item.topics) {
      for (const t of item.topics) {
        if (!this.topicMap.has(t)) {
          this.topicMap.set(t, new Set());
        }
        this.topicMap.get(t)!.add(item.id);
      }
    }

    // 2. Publisher Indexing
    const publisher = (item.sourceReferences?.[0]?.publisher || item.sourceDomain || 'unknown').toLowerCase();
    if (!this.publisherMap.has(publisher)) {
      this.publisherMap.set(publisher, new Set());
    }
    this.publisherMap.get(publisher)!.add(item.id);

    // 3. Inverted Keyword Indexing (Title + KeyInsight + Excerpt)
    const content = `${item.title} ${item.subtitle || ''} ${item.keyInsight || ''} ${item.feedText?.slice(0, 200) || ''}`;
    const tokens = this.tokenize(content);
    const tokenSet = new Set(tokens);
    this.itemTokens.set(item.id, tokenSet);

    for (const token of tokenSet) {
      if (!this.invertedTokenMap.has(token)) {
        this.invertedTokenMap.set(token, new Set());
      }
      this.invertedTokenMap.get(token)!.add(item.id);
    }
  }

  /**
   * Removes an item from the index.
   */
  public removeItem(itemId: string): void {
    const item = this.itemMap.get(itemId);
    if (!item) return;

    this.itemMap.delete(itemId);
    this.itemTokens.delete(itemId);

    for (const set of this.topicMap.values()) {
      set.delete(itemId);
    }
    for (const set of this.publisherMap.values()) {
      set.delete(itemId);
    }
    for (const set of this.invertedTokenMap.values()) {
      set.delete(itemId);
    }
  }

  /**
   * Fast candidate retrieval: finds items that share keywords or topics with the target item.
   * Runs in O(tokens) rather than O(archive_size).
   */
  public findRelatedCandidates(item: FeedItem, limit: number = 3): FeedItem[] {
    const candidateScores = new Map<string, number>();
    const titleTokens = this.tokenize(item.title);
    const primaryTopic = item.primaryTopic || 'philosophy_ethics';

    // 1. Keyword match lookup via inverted index
    for (const token of titleTokens) {
      const matchingIds = this.invertedTokenMap.get(token);
      if (matchingIds) {
        for (const candId of matchingIds) {
          if (candId === item.id) continue;
          candidateScores.set(candId, (candidateScores.get(candId) || 0) + 3);
        }
      }
    }

    // 2. Topic match lookup
    const topicMatchingIds = this.topicMap.get(primaryTopic);
    if (topicMatchingIds) {
      for (const candId of topicMatchingIds) {
        if (candId === item.id) continue;
        candidateScores.set(candId, (candidateScores.get(candId) || 0) + 1);
      }
    }

    // 3. Sort candidates by score
    const sortedIds = Array.from(candidateScores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(entry => entry[0]);

    const results: FeedItem[] = [];
    for (const id of sortedIds) {
      const match = this.itemMap.get(id);
      if (match) results.push(match);
    }
    return results;
  }

  /**
   * Retrieve all items by topic.
   */
  public getItemsByTopic(topic: TopicTag | string): FeedItem[] {
    const ids = this.topicMap.get(topic);
    if (!ids) return [];
    const items: FeedItem[] = [];
    for (const id of ids) {
      const it = this.itemMap.get(id);
      if (it) items.push(it);
    }
    return items;
  }

  public getItem(id: string): FeedItem | undefined {
    return this.itemMap.get(id);
  }

  public getAll(): FeedItem[] {
    return Array.from(this.itemMap.values());
  }

  public size(): number {
    return this.itemMap.size;
  }

  public clear(): void {
    this.topicMap.clear();
    this.publisherMap.clear();
    this.invertedTokenMap.clear();
    this.itemMap.clear();
    this.itemTokens.clear();
  }
}
