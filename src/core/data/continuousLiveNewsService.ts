import { FeedItem, TopicTag } from '../domain/types';
import { REAL_KNOWLEDGE_VAULT } from './realKnowledgeVault';
import { enrichItemWithInstantResearch } from '../synthesis/backgroundResearchPipeline';
import { optimizeImageUrl } from '../utils/imageQuality';
import { defaultSourceRepository } from './sourceRepository';

// Safely load real-world ingested pipeline items
let rawPipelineItems: FeedItem[] = [];
try {
  const loaded = require('./pipeline-output.json');
  if (Array.isArray(loaded)) {
    rawPipelineItems = loaded as FeedItem[];
  }
} catch {
  rawPipelineItems = [];
}

export type NewsHubFilterCategory = 'all' | 'oerr' | 'tech' | 'science' | 'didactic' | 'culture';

export interface ContinuousNewsOptions {
  category?: NewsHubFilterCategory;
  query?: string;
  topic?: TopicTag;
  limit?: number;
  offset?: number;
}

/**
 * Continuous Live News Service
 * 
 * Delivers an ongoing, high-velocity stream of verified real-world news from
 * public broadcasters and established science/tech publications (Tagesschau,
 * Deutschlandfunk, Ars Technica, Quanta Magazine, Heise, Stanford SEP, etc.).
 * 
 * Every article is elevated into an active learning moment:
 * - 💡 Distilled Key Insight (Kern-Erkenntnis)
 * - 🎓 Didactic & Learning Partner Transfer (Lern-Partner & Didaktik-Labor)
 * - ⚡️ Socratic Challenge Prompt (Sokratischer Denkimpuls)
 * - 🏛 Evergreen Internet Gem cross-reference
 * - High-definition visual hero imagery & in-app live preview
 */
export class ContinuousLiveNewsService {
  /**
   * Retrieves enriched, live real-world news stream.
   */
  public static async getLiveStream(options: ContinuousNewsOptions = {}): Promise<FeedItem[]> {
    const { category = 'all', query = '', limit = 30, offset = 0 } = options;

    // 1. Gather all authentic real-world news candidates
    const pool = rawPipelineItems.length > 0 ? rawPipelineItems : REAL_KNOWLEDGE_VAULT;

    // Filter out disabled sources according to user settings in NewsHub
    const disabledDomains = new Set<string>();
    const disabledTokens: string[] = [];
    try {
      const allSources = await defaultSourceRepository.getAllSources();
      for (const s of allSources.filter(src => !src.enabled)) {
        disabledTokens.push(s.name.toLowerCase());
        disabledTokens.push(s.id.toLowerCase());
        try {
          const parsedUrl = new URL(s.url);
          const host = parsedUrl.hostname.replace(/^www\./, '').toLowerCase();
          disabledDomains.add(host);
        } catch {
          // ignore
        }
      }
    } catch {
      // Non-fatal
    }

    // 2. Filter by category and enabled sources
    let filtered = pool.filter(item => {
      const publisher = (item.sourceReferences?.[0]?.publisher || '').toLowerCase();
      const domain = (item.sourceDomain || '').replace(/^www\./, '').toLowerCase();

      if (domain && disabledDomains.has(domain)) {
        return false;
      }
      for (const token of disabledTokens) {
        if (token && (publisher.includes(token) || item.id.toLowerCase().includes(token))) {
          return false;
        }
      }

      if (category === 'all') return true;

      const topic = item.primaryTopic;

      switch (category) {
        case 'oerr':
          return (
            domain.includes('tagesschau') ||
            domain.includes('deutschlandfunk') ||
            domain.includes('zdf') ||
            domain.includes('bpb') ||
            domain.includes('br.de') ||
            item.sourceTrustLevel === 'public_broadcaster'
          );
        case 'tech':
          return (
            topic === 'ai_apple' ||
            domain.includes('arstechnica') ||
            domain.includes('heise') ||
            domain.includes('simonwillison') ||
            domain.includes('transformer') ||
            domain.includes('cdm')
          );
        case 'science':
          return (
            topic === 'science_society' ||
            domain.includes('quanta') ||
            domain.includes('nature') ||
            domain.includes('spektrum') ||
            domain.includes('arxiv')
          );
        case 'didactic':
          return (
            topic === 'german_didactics' ||
            item.isTeachingRelated ||
            domain.includes('bildungsserver') ||
            domain.includes('schulportal')
          );
        case 'culture':
          return (
            topic === 'philosophy_ethics' ||
            topic === 'sound_synthesis' ||
            topic === 'book_mastery' ||
            topic === 'contemplation_mind' ||
            domain.includes('plato.stanford') ||
            domain.includes('aeon')
          );
        default:
          return true;
      }
    });

    // 3. Filter by search query if present
    if (query.trim().length > 0) {
      const q = query.toLowerCase().trim();
      filtered = filtered.filter(item =>
        item.title.toLowerCase().includes(q) ||
        (item.subtitle && item.subtitle.toLowerCase().includes(q)) ||
        (item.feedText && item.feedText.toLowerCase().includes(q)) ||
        (item.sourceDomain && item.sourceDomain.toLowerCase().includes(q)) ||
        (item.sourceReferences[0]?.publisher && item.sourceReferences[0].publisher.toLowerCase().includes(q))
      );
    }

    // 4. Slice batch
    const paged = filtered.slice(offset, offset + limit);

    // 5. Enrich with instant research, didactic transfer, and optimized imagery
    return paged.map(item => {
      const enriched = enrichItemWithInstantResearch(item);
      const imageUrl = enriched.imageUrl ? optimizeImageUrl(enriched.imageUrl) : undefined;
      return {
        ...enriched,
        imageUrl: imageUrl || enriched.imageUrl
      };
    });
  }

  /**
   * Retrieves all timeless masterpieces ("old gems of the internet") from the vault.
   */
  public static getEvergreenClassics(): FeedItem[] {
    const classicsOnly = REAL_KNOWLEDGE_VAULT.filter(item => item.isEvergreenGem === true);
    return classicsOnly.map(item => {
      const enriched = enrichItemWithInstantResearch(item);
      return {
        ...enriched,
        isEvergreenGem: true,
        imageUrl: enriched.imageUrl ? optimizeImageUrl(enriched.imageUrl) : enriched.imageUrl
      };
    });
  }
}
