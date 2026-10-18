import { FeedItem, RelatedCrossReference } from '../domain/types';
import { ArticleIndex } from './articleIndex';

/**
 * RelatedContentService: Discovers high-coherence conceptual cross-references
 * using an inverted index rather than O(N^2) pairwise comparisons.
 */
export class RelatedContentService {
  private index: ArticleIndex;
  private cache = new Map<string, RelatedCrossReference[]>();

  constructor(index: ArticleIndex) {
    this.index = index;
  }

  public setIndex(index: ArticleIndex): void {
    this.index = index;
    this.cache.clear();
  }

  /**
   * Lazily computes related cross references for an article.
   * Caches results so repeat lookups consume zero computation.
   */
  public getRelatedArticles(item: FeedItem, limit: number = 3): RelatedCrossReference[] {
    if (this.cache.has(item.id)) {
      return this.cache.get(item.id)!;
    }

    // If item already contains precomputed cross references, use them
    if (item.relatedCrossReferences && item.relatedCrossReferences.length > 0) {
      this.cache.set(item.id, item.relatedCrossReferences);
      return item.relatedCrossReferences;
    }

    const candidates = this.index.findRelatedCandidates(item, limit);
    const references: RelatedCrossReference[] = candidates.map(cand => {
      const pub = cand.sourceReferences?.[0]?.publisher || cand.sourceDomain || 'Archiv';
      const insight = cand.subtitle || cand.keyInsight || cand.feedText?.slice(0, 120) || cand.title;
      const connectionReason = cand.primaryTopic === item.primaryTopic
        ? `Gemeinsamer Fokus auf ${cand.space || cand.primaryTopic} (${pub})`
        : `Interdisziplinäre Ergänzung aus ${cand.space || cand.primaryTopic}`;

      return {
        id: cand.id,
        title: cand.title,
        publisher: pub,
        insight,
        connectionReason
      };
    });

    this.cache.set(item.id, references);
    return references;
  }

  public clearCache(): void {
    this.cache.clear();
  }
}
