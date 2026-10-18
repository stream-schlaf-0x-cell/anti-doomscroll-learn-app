/**
 * Rabbit Hole Exploration Service
 * 
 * Deepens intellectual engagement by discovering highly specific, conceptually linked
 * companion reads for any opened card.
 * 
 * Strategy:
 * 1. Extract concrete entities & concepts (names, theories, movements, proper nouns).
 * 2. Multi-token conceptual scoring against the sovereign local pool (1,280+ items).
 * 3. On-demand live research via OpenAlex & Wikipedia REST when deeper companion reads are needed.
 */

import { FeedItem, TopicTag } from '../domain/types';
import { feedRepository } from '../data/feedRepository';
import { OnTheFlyStreamService } from './onTheFlyStreamService';

export interface RabbitHoleEntry {
  item: FeedItem;
  conceptPill: string;
  relevanceReason: string;
  isLiveDiscovered?: boolean;
}

const STOP_WORDS = new Set([
  'der', 'die', 'das', 'ein', 'eine', 'einer', 'einem', 'einen', 'eines',
  'und', 'oder', 'aber', 'denn', 'weil', 'dass', 'daß', 'wie', 'als',
  'für', 'mit', 'von', 'aus', 'bei', 'nach', 'über', 'unter', 'vor', 'zwischen',
  'the', 'and', 'for', 'with', 'from', 'about', 'into', 'over', 'after',
  'eine', 'neue', 'neuer', 'neues', 'jahr', 'zeit', 'mehr', 'immer', 'wieder'
]);

/**
 * Extracts salient conceptual entities from a FeedItem.
 */
export function extractSalientConcepts(item: FeedItem): string[] {
  const concepts: string[] = [];

  // Artist / Author proper names
  if (item.artMeta?.artist && item.artMeta.artist.length > 2) {
    concepts.push(item.artMeta.artist.trim());
  }
  const author = item.sourceReferences?.[0]?.author;
  if (author && author.length > 2 && !author.toLowerCase().includes('redaktion') && !author.toLowerCase().includes('autoren')) {
    concepts.push(author.trim());
  }

  // Museum / Epoch / Movement
  if (item.artMeta?.styleMovement) {
    concepts.push(item.artMeta.styleMovement.trim());
  }
  if (item.artMeta?.museum) {
    concepts.push(item.artMeta.museum.trim());
  }

  // Salient title phrases and keywords
  const titleClean = item.title.replace(/[„“"':,\-–—()!?]/g, ' ');
  const words = titleClean.split(/\s+/).filter(w => w.length >= 4 && !STOP_WORDS.has(w.toLowerCase()));

  // Collocations & capitalized nouns (German capitalized terms or English titles)
  for (let i = 0; i < words.length - 1; i++) {
    const pair = `${words[i]} ${words[i + 1]}`;
    if (!STOP_WORDS.has(words[i].toLowerCase()) && !STOP_WORDS.has(words[i + 1].toLowerCase())) {
      concepts.push(pair);
    }
  }

  for (const word of words) {
    if (/^[A-ZÄÖÜ]/.test(word) && !concepts.includes(word)) {
      concepts.push(word);
    }
  }

  return Array.from(new Set(concepts)).slice(0, 8);
}

export class RabbitHoleService {
  /**
   * Discovers 3-4 conceptually targeted companion reads for a given FeedItem.
   */
  public static async discoverRabbitHole(
    currentItem: FeedItem,
    options?: { maxItems?: number; allowLiveResearch?: boolean }
  ): Promise<RabbitHoleEntry[]> {
    const maxItems = options?.maxItems ?? 4;
    const allowLiveResearch = options?.allowLiveResearch ?? true;
    const concepts = extractSalientConcepts(currentItem);
    const allLocal = feedRepository.getAllItems().filter(i => i.id !== currentItem.id);

    const scored: { item: FeedItem; score: number; matchedConcept: string }[] = [];

    for (const cand of allLocal) {
      let score = 0;
      let topMatched = '';
      const candHaystack = `${cand.title} ${cand.subtitle || ''} ${cand.keyInsight || ''} ${cand.feedText || ''} ${cand.artMeta?.artist || ''} ${cand.artMeta?.styleMovement || ''}`.toLowerCase();

      // Check artist/author match (very strong signal)
      if (currentItem.artMeta?.artist && cand.artMeta?.artist && currentItem.artMeta.artist.toLowerCase() === cand.artMeta.artist.toLowerCase()) {
        score += 25;
        topMatched = currentItem.artMeta.artist;
      }

      // Check concepts
      for (const concept of concepts) {
        const cLower = concept.toLowerCase();
        if (candHaystack.includes(cLower)) {
          const weight = concept.includes(' ') ? 12 : 6;
          score += weight;
          if (!topMatched) topMatched = concept;
        }
      }

      // Format & Topic alignment bonuses
      if (cand.primaryTopic === currentItem.primaryTopic) {
        score += 2;
      }
      if (cand.format === currentItem.format) {
        score += 1.5;
      }
      if (cand.evidenceTier === 'permitted_full_text' || cand.isEvergreenGem) {
        score += 2;
      }

      if (score >= 8) {
        scored.push({ item: cand, score, matchedConcept: topMatched || concepts[0] || 'Themenfeld' });
      }
    }

    scored.sort((a, b) => b.score - a.score);

    const results: RabbitHoleEntry[] = scored.slice(0, maxItems).map(({ item, matchedConcept }) => ({
      item,
      conceptPill: matchedConcept ? `Konzept: ${matchedConcept}` : 'Verwandte Lektüre',
      relevanceReason: `Hohe gedankliche Schnittmenge mit „${matchedConcept || currentItem.title.slice(0, 30)}“.`
    }));

    // If local matches are sparse (< 3) and live research is permitted, fetch live encyclopedic & peer-reviewed companion reads
    if (results.length < 3 && allowLiveResearch && concepts.length > 0) {
      const topQuery = concepts[0];
      const today = new Date().toISOString().slice(0, 10);
      const primaryTopic: TopicTag = currentItem.primaryTopic || 'science_society';
      const spaceHandle = currentItem.space || 'c/archiv';

      try {
        const [wikiHits, openAlexHits] = await Promise.all([
          OnTheFlyStreamService.searchWikipedia(topQuery, primaryTopic, spaceHandle, today),
          OnTheFlyStreamService.searchOpenAlex(topQuery, primaryTopic, spaceHandle, today)
        ]);

        const liveCombined = [...wikiHits, ...openAlexHits];
        for (const liveItem of liveCombined) {
          if (results.length >= maxItems) break;
          if (liveItem.title.toLowerCase() !== currentItem.title.toLowerCase()) {
            feedRepository.addItems([liveItem]);
            results.push({
              item: liveItem,
              conceptPill: liveItem.sourceTrustLevel === 'peer_reviewed' ? 'Wissenschaftliche Studie' : 'Enzyklopädischer Überblick',
              relevanceReason: `Gezielte Vertiefungsrecherche zu „${topQuery}“.`,
              isLiveDiscovered: true
            });
          }
        }
      } catch {
        // Non-fatal, local fallback is already present
      }
    }

    return results;
  }
}
