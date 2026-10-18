import { FeedItem, TopicTag, EditorialAbstract, RelatedCrossReference } from '../domain/types';
import { REAL_KNOWLEDGE_VAULT } from '../data/realKnowledgeVault';
import { INITIAL_FIXTURES } from '../data/fixtures';
import { TOPIC_DIALECTICS } from './dialecticTemplates';

// Lightweight pool items (decoupled from massive compile-time JSON)
const cachedPipelineItems: FeedItem[] = [];

/**
 * Background Research & Content-Specific Contextualization Pipeline
 *
 * Provides concrete, content-specific orientation without generic template padding:
 * 1. Originalauszug (`articleBody` / `feedText`) remains 100% faithful to the source.
 * 2. `atmen-Abstract` (`editorialAbstract`) distills concrete sentences from the item.
 * 3. `Eigene Einordnung` (`keyInsight`, `didacticTransfer`, `challengePrompt`) illuminates the specific topic and text.
 * 4. Cross-references (`relatedCrossReferences`) link genuinely related network items.
 */

const KEY_INSIGHT_PATTERNS = [
  /erweist sich als/i,
  /entscheidend ist/i,
  /im kern zeigt/i,
  /das fundament/i,
  /die konsequenz/i,
  /wichtigste erkenntnis/i,
  /bedeutet/i,
  /verdeutlicht/i,
  /die ursache/i,
  /das problem/i,
  /shows that/i,
  /demonstrates/i,
  /reveals/i,
  /key finding/i,
  /suggests that/i
];

/**
 * Extracts a concrete 1-2 sentence insight directly from the article's actual text.
 */
export function synthesizeKeyInsight(title: string, bodyText: string, topic: TopicTag): string {
  const cleaned = (bodyText || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  if (cleaned.length < 30) {
    return `${title} — Quell-Fundstück im Bereich ${TOPIC_DIALECTICS[topic]?.title || topic}.`;
  }

  const sentences = cleaned
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length >= 35 && s.length <= 240);

  for (const sentence of sentences) {
    if (KEY_INSIGHT_PATTERNS.some(pat => pat.test(sentence))) {
      if (!/^(und|oder|aber|denn|weil|er|sie|es|wir)\s/i.test(sentence)) {
        return sentence;
      }
    }
  }

  const candidates = sentences.slice(0, 5).filter(s =>
    !s.toLowerCase().includes('foto:') &&
    !s.toLowerCase().includes('dpa') &&
    !s.toLowerCase().includes('quelle:') &&
    !s.toLowerCase().includes('abonniere') &&
    !s.toLowerCase().includes('newsletter')
  );

  if (candidates.length > 1) {
    return candidates[1];
  }
  if (candidates.length === 1) {
    return candidates[0];
  }

  return cleaned.length > 200 ? cleaned.slice(0, 197).trim() + '…' : cleaned;
}

/**
 * Synthesizes a content-anchored contextual thought ("Eigene Einordnung") that references the specific item.
 */
export function synthesizeDidacticTransfer(
  title: string,
  bodyText: string,
  topic: TopicTag,
  isTeachingRelated?: boolean
): string {
  const cleaned = (bodyText || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  const sentences = cleaned.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length >= 30);
  const coreDetail = sentences.length > 2
    ? sentences[sentences.length - 1]
    : (sentences[0] || title);
  const shortDetail = coreDetail.length > 160 ? coreDetail.slice(0, 157) + '…' : coreDetail;

  if (isTeachingRelated || topic === 'german_didactics') {
    return `Bezug für Schule & Unterricht zu „${title}“: ${shortDetail} — Prüfe, welche konkrete Frage daraus als Diskussions- oder Schreibanlass im Unterricht taugt.`;
  }

  switch (topic) {
    case 'ai_apple':
      return `Technologische Einordnung zu „${title}“: ${shortDetail} — Entscheidend ist, ob hier echte Werkzeug-Qualität entsteht oder lediglich kurzfristige Aufmerksamkeit gebunden wird.`;
    case 'philosophy_ethics':
      return `Philosophische Einordnung zu „${title}“: ${shortDetail} — Welche unausgesprochene Grundannahme trägt dieses Argument, und wo liegt sein stärkster Einwand?`;
    case 'sound_synthesis':
      return `Klang- & Praxisbezug zu „${title}“: ${shortDetail} — Überlege, welche klangliche oder kompositorische Idee du daraus direkt im eigenen Setup ausprobieren kannst.`;
    case 'contemplation_mind':
      return `Kontemplative Einordnung zu „${title}“: ${shortDetail} — Ein Impuls, um Geistesklarheit und wache Aufmerksamkeit im eigenen Alltag zu schärfen.`;
    case 'art_aesthetics':
      return `Ästhetische Betrachtung zu „${title}“: ${shortDetail} — Nimm dir einen ruhigen Moment für Komposition, Lichtführung und handwerkliche Details.`;
    case 'memes_satire':
      return `Spielerischer Perspektivwechsel zu „${title}“: ${shortDetail} — Humor legt oft genau jene blinden Flecken frei, die in ernsten Fachdebatten übersehen werden.`;
    default:
      return `Inhaltliche Einordnung zu „${title}“: ${shortDetail} — Prüfe die genannte Primärquelle und gleichen den Befund mit deinem bisherigen Weltbild ab.`;
  }
}

/**
 * Synthesizes a concrete reflection question anchored in the item's title and domain.
 */
export function synthesizeChallengePrompt(title: string, topic: TopicTag): string {
  switch (topic) {
    case 'german_didactics':
      return `Welche Beobachtung aus deinem eigenen Unterricht stützt oder widerspricht dem Ansatz in „${title}“?`;
    case 'ai_apple':
      return `Was ändert sich konkret in deinem Arbeits- oder Denkalltag, wenn sich die Entwicklung aus „${title}“ durchsetzt?`;
    case 'philosophy_ethics':
      return `Welches Gegenargument würde die zentrale These von „${title}“ am stärksten auf die Probe stellen?`;
    case 'sound_synthesis':
      return `Wie ließe sich der Ansatz aus „${title}“ in ein konkretes musikalisches Experiment übersetzen?`;
    case 'contemplation_mind':
      return `Welche Gewohnheit im Alltag wird durch den Gedanken aus „${title}“ hinterfragt?`;
    default:
      return `Welche weiterführende Frage wirft „${title}“ für deine eigene Einschätzung auf?`;
  }
}

/**
 * Finds a related timeless classic ONLY when there is a genuine keyword match (never random fallback).
 */
export function findRelatedEvergreenGem(topic: TopicTag, title: string): FeedItem | undefined {
  const candidates = REAL_KNOWLEDGE_VAULT.filter(item =>
    item.isEvergreenGem === true && (item.primaryTopic === topic || item.topics.includes(topic))
  );
  if (candidates.length === 0) return undefined;

  const stopWords = new Set(['über', 'unter', 'einer', 'einem', 'einen', 'nicht', 'warum', 'wieso', 'durch', 'gegen', 'about', 'under', 'their', 'where', 'which']);
  const titleWords = title
    .toLowerCase()
    .replace(/[^a-zäöüß0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 5 && !stopWords.has(w));

  if (titleWords.length === 0) return undefined;

  return candidates.find(c => {
    const text = `${c.title} ${c.subtitle} ${c.feedText}`.toLowerCase();
    return titleWords.some(w => text.includes(w));
  });
}

/**
 * Cleans markdown formatting and artifacts for fluid plain-text summary distillation.
 */
function cleanMarkdownForSummary(text: string): string {
  return (text || '')
    .replace(/<[^>]*>/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/^\s*>\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Synthesizes an honest, content-derived Editorial Abstract for the Reader view.
 */
export function synthesizeEditorialAbstract(item: FeedItem): EditorialAbstract {
  const primaryTopic = item.primaryTopic || 'philosophy_ethics';
  const rawText = cleanMarkdownForSummary(item.articleBody || item.feedText || item.body || '');
  const sentences = rawText
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length >= 20 && !/^#+\s/.test(s));

  const overview = sentences[0] && sentences[0].length >= 25
    ? sentences[0]
    : `${cleanMarkdownForSummary(item.title)} (${item.sourceReferences[0]?.publisher || 'Originalquelle'}).`;

  const keyFinding = sentences.length > 1
    ? sentences.slice(1, 3).join(' ')
    : cleanMarkdownForSummary(item.keyInsight || synthesizeKeyInsight(item.title, rawText, primaryTopic));

  const relevanceWhy = item.relevanceExplanation && item.relevanceExplanation.length > 15
    ? cleanMarkdownForSummary(item.relevanceExplanation)
    : `Ausgewählter Beitrag aus ${item.sourceReferences[0]?.publisher || 'verifizierter Quelle'} im Themenraum ${item.space || primaryTopic}.`;

  const limitation = item.evidenceTier === 'metadata_only'
    ? 'Kompakter Quell-Hinweis (Metadaten / Kurznotiz). Für den vollständigen Beitrag bitte direkt die Originalquelle öffnen.'
    : item.evidenceTier === 'publisher_excerpt'
    ? 'Autorisierter Herausgeber-Auszug (RSS/API). Der vollständige Artikel ist über den Direktlink bei der Quelle abrufbar.'
    : undefined;

  return {
    overview,
    keyFinding,
    relevanceWhy,
    limitation
  };
}

/**
 * Builds structured knowledge context for a normalized feed entry without inflating articleBody.
 */
export function buildKnowledgeContextForEntry(options: {
  title: string;
  summary: string;
  topic: TopicTag;
  sourceName: string;
  isTeachingRelated?: boolean;
}): {
  keyInsight: string;
  challengePrompt: string;
  actionableTransfer: string;
  counterPerspective: string;
  relatedCrossReferences: RelatedCrossReference[];
} {
  const { title, summary, topic, sourceName, isTeachingRelated } = options;
  const dialectic = TOPIC_DIALECTICS[topic] || TOPIC_DIALECTICS.philosophy_ethics;
  const keyInsight = synthesizeKeyInsight(title, summary, topic);
  const challengePrompt = synthesizeChallengePrompt(title, topic);
  const actionableTransfer = synthesizeDidacticTransfer(title, summary, topic, isTeachingRelated);
  const counterPerspective = dialectic.counterPerspective;

  const mockItemForCrossRef = {
    id: `temp-${title.slice(0, 16)}`,
    title,
    subtitle: sourceName,
    feedText: summary,
    primaryTopic: topic,
    topics: [topic]
  } as unknown as FeedItem;

  const relatedCrossReferences = findRelatedNetworkPosts(mockItemForCrossRef);

  return {
    keyInsight,
    challengePrompt,
    actionableTransfer,
    counterPerspective,
    relatedCrossReferences
  };
}

/**
 * Legacy helper kept for explicit on-demand deepening tests (`tests/masterExecutionPlan.test.ts`).
 * Never used to inflate `articleBody` of ingested RSS items.
 */
export function synthesizeDeepeningArticle(options: {
  title: string;
  summary: string;
  topic: TopicTag;
  sourceName: string;
  author?: string;
  isTeachingRelated?: boolean;
  keyInsight?: string;
  counterPerspective?: string;
  challengePrompt?: string;
}): string {
  const { title, summary, topic, sourceName, author, keyInsight, counterPerspective, challengePrompt } = options;
  const dialectic = TOPIC_DIALECTICS[topic] || TOPIC_DIALECTICS.philosophy_ethics;
  const authorCitation = author ? `${author} (${sourceName})` : sourceName;
  const cleanedSummary = summary.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  const effectiveInsight = keyInsight || dialectic.keyInsight;
  const effectiveCounter = counterPerspective || dialectic.counterPerspective;
  const effectivePrompt = challengePrompt || dialectic.challengePrompt;

  return [
    `### Worum es geht`,
    `${cleanedSummary}`,
    ``,
    `Die Berichterstattung von **${authorCitation}** zu „${title}“ greift eine Entwicklung auf, die über die unmittelbare Tagesmeldung hinausreicht.`,
    ``,
    `### Warum das wichtig ist`,
    `Die Relevanz dieses Beitrags liegt vor allem in den Folgewirkungen: ${effectiveInsight}`,
    ``,
    `### Die Gegenperspektive`,
    `${effectiveCounter}`,
    ``,
    `### Zum Weiterdenken & Ausprobieren`,
    `**Impuls für die eigene Praxis:** ${dialectic.actionableTransfer}`,
    ``,
    `**Die Leitfrage zum Weiterforschen:** *„${effectivePrompt}“*`
  ].join('\n');
}

/**
 * Enriches any raw feed item with content-specific orientation while preserving 100% honest source text.
 */
export function enrichItemWithInstantResearch(item: FeedItem): FeedItem {
  const primaryTopic = item.primaryTopic || 'philosophy_ethics';
  const rawContent = item.articleBody || item.feedText || item.body || item.title;

  const keyInsight = item.keyInsight || synthesizeKeyInsight(item.title, rawContent, primaryTopic);
  const didacticTransfer = item.didacticTransfer || item.didacticSeed || synthesizeDidacticTransfer(
    item.title,
    rawContent,
    primaryTopic,
    item.isTeachingRelated
  );
  const challengePrompt = item.challengePrompt || synthesizeChallengePrompt(item.title, primaryTopic);

  // Only attach evergreenContext if there is a genuine keyword match (never a random fallback)
  const relatedGem = findRelatedEvergreenGem(primaryTopic, item.title);
  const evergreenContext = item.evergreenContext || (
    relatedGem && relatedGem.id !== item.id
      ? `Thematisch verwandter Klassiker: „${relatedGem.title}“ (${relatedGem.sourceReferences[0]?.publisher || 'Archiv'})`
      : undefined
  );

  const editorialAbstract = item.editorialAbstract || synthesizeEditorialAbstract({
    ...item,
    keyInsight
  });

  const editorialSynthesisType = item.editorialSynthesisType || (
    item.evidenceTier === 'permitted_full_text' ? 'original_text' :
    item.evidenceTier === 'publisher_excerpt' ? 'publisher_excerpt' :
    item.factReviewStatus === 'scientific_paper' ? 'scientific_synthesis' :
    'editorial_deepening'
  );

  const articleBody = item.articleBody || item.body || item.feedText || item.title;
  const body = item.body || articleBody;

  const relatedCrossReferences = item.relatedCrossReferences && item.relatedCrossReferences.length > 0
    ? item.relatedCrossReferences
    : findRelatedNetworkPosts(item);

  return {
    ...item,
    articleBody,
    body,
    relatedCrossReferences,
    keyInsight,
    didacticTransfer,
    didacticSeed: didacticTransfer,
    challengePrompt,
    evergreenContext,
    editorialAbstract,
    editorialSynthesisType,
    isTeachingRelated: Boolean(item.isTeachingRelated || primaryTopic === 'german_didactics' || item.topics?.includes('german_didactics'))
  };
}

const CROSS_REF_STOPWORDS = new Set([
  'auch', 'über', 'unter', 'nach', 'vor', 'beim', 'diese', 'dieser', 'dieses', 'diesem', 'diesen',
  'einem', 'einer', 'eines', 'einen', 'einig', 'einige', 'einigen', 'mehr', 'oder', 'aber', 'sehr',
  'hier', 'dort', 'wird', 'werden', 'wurde', 'wurden', 'kann', 'können', 'konnte', 'könnten',
  'soll', 'sollen', 'sollte', 'sollten', 'muss', 'müssen', 'musste', 'durch', 'gegen', 'ohne',
  'zwischen', 'nicht', 'warum', 'wieso', 'weshalb', 'welche', 'welcher', 'welches', 'welchen',
  'damit', 'dabei', 'dafür', 'davon', 'darüber', 'darum', 'alle', 'aller', 'allen', 'alles',
  'sein', 'seine', 'seiner', 'seinem', 'seinen', 'ihre', 'ihrer', 'ihrem', 'ihren', 'ihres',
  'wenn', 'weil', 'dass', 'denn', 'doch', 'schon', 'selbst', 'wieder', 'immer', 'jedoch',
  'der', 'die', 'das', 'den', 'dem', 'des', 'und', 'von', 'zur', 'zum', 'mit', 'auf', 'aus',
  'für', 'wie', 'bei', 'ein', 'eine',
  // English common words
  'with', 'from', 'that', 'this', 'what', 'when', 'where', 'which', 'about', 'after', 'before',
  'between', 'into', 'through', 'over', 'more', 'some', 'other', 'their', 'there', 'these', 'those',
  'have', 'been', 'were', 'will', 'would', 'could', 'should', 'they', 'them', 'your', 'ours'
]);

const ACRONYM_WHITELIST = new Set([
  'ki', 'ai', 'llm', 'llms', 'mlx', 'midi', 'daz', 'dna', 'rna', 'gpu', 'npu', 'tpu'
]);

/**
 * Discovers up to 2-3 genuine cross-reference connections in the local knowledge pool.
 * Uses whole-word tokenization and strict stopword filtering to prevent substring false positives.
 */
const candidateTokenCache = new Map<string, Set<string>>();

export function findRelatedNetworkPosts(item: FeedItem, customPool?: FeedItem[]): RelatedCrossReference[] {
  const pool = customPool && customPool.length > 0
    ? customPool
    : [...REAL_KNOWLEDGE_VAULT, ...INITIAL_FIXTURES, ...cachedPipelineItems];

  const topic = item.primaryTopic || 'philosophy_ethics';
  const titleWords = item.title
    .toLowerCase()
    .replace(/[^a-zäöüß0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => (w.length >= 5 || ACRONYM_WHITELIST.has(w)) && !CROSS_REF_STOPWORDS.has(w));

  const seenIds = new Set<string>([item.id]);
  const scoredCandidates: { ref: RelatedCrossReference; score: number }[] = [];

  for (const candidate of pool) {
    if (seenIds.has(candidate.id) || candidate.title === item.title) continue;

    const sharesPrimary = candidate.primaryTopic === topic;
    const sharesSecondary = candidate.topics?.includes(topic);

    let candidateTokens = candidateTokenCache.get(candidate.id);
    if (!candidateTokens) {
      candidateTokens = new Set(
        `${candidate.title} ${candidate.subtitle || ''} ${candidate.feedText || ''}`
          .toLowerCase()
          .replace(/[^a-zäöüß0-9\s]/g, ' ')
          .split(/\s+/)
          .filter(Boolean)
      );
      candidateTokenCache.set(candidate.id, candidateTokens);
    }
    const matchedWords = titleWords.filter(w => candidateTokens.has(w));

    if (!sharesPrimary && !sharesSecondary && matchedWords.length === 0) continue;

    seenIds.add(candidate.id);
    const score = matchedWords.length * 3 + (sharesPrimary ? 2 : 0) + (sharesSecondary ? 1 : 0);
    const publisher = candidate.sourceReferences?.[0]?.publisher || 'Archiv';
    const insight = candidate.subtitle || candidate.keyInsight || candidate.feedText?.slice(0, 120) || candidate.title;
    const connectionReason = matchedWords.length > 0
      ? `Gemeinsamer Fokus auf „${matchedWords[0]}“ (${publisher})`
      : `Verwandte Perspektive im Bereich ${candidate.space || topic}`;

    scoredCandidates.push({
      score,
      ref: {
        id: candidate.id,
        title: candidate.title,
        publisher,
        insight,
        connectionReason
      }
    });
  }

  scoredCandidates.sort((a, b) => b.score - a.score);
  return scoredCandidates.slice(0, 3).map(c => c.ref);
}
