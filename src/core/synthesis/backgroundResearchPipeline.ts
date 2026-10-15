import { FeedItem, TopicTag } from '../domain/types';
import { REAL_KNOWLEDGE_VAULT } from '../data/realKnowledgeVault';

/**
 * Background Research & Epistemic Synthesis Pipeline
 * 
 * Automatically analyses raw ingested articles, RSS feeds, or on-the-fly streams
 * and synthesizes the exact high-caliber educational framing requested by the user:
 * 1. 💡 Kern-Erkenntnis (Key Insight): A distilled, non-trivial conceptual summary.
 * 2. 🎓 Lern-Partner & Didaktik-Transfer: Pedagogical & cognitive transfer for learning.
 * 3. ⚡️ Sokratischer Denkimpuls (Challenge Prompt): Critical inquiry question.
 * 4. 🏛 Evergreen Gem Alignment: Cross-references timeless classics of the internet.
 */

// Heuristic keyword patterns for extracting high-value sentences
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
  /das problem/i
];

/**
 * Extracts or synthesizes a profound, sharp 1-2 sentence Key Insight from article content.
 */
export function synthesizeKeyInsight(title: string, bodyText: string, topic: TopicTag): string {
  if (!bodyText || bodyText.trim().length === 0) {
    return generateFallbackInsight(title, topic);
  }

  // Clean and split text into sentences
  const cleaned = bodyText.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ');
  const sentences = cleaned
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length >= 35 && s.length <= 220);

  // 1. Look for sentences matching insight indicators
  for (const sentence of sentences) {
    if (KEY_INSIGHT_PATTERNS.some(pat => pat.test(sentence))) {
      // Ensure sentence doesn't start with raw pronoun or junk
      if (!/^(und|oder|aber|denn|weil|er|sie|es|wir)\s/i.test(sentence)) {
        return sentence;
      }
    }
  }

  // 2. Select the most substantive sentence from the first three paragraphs
  const candidates = sentences.slice(0, 5).filter(s => 
    !s.toLowerCase().includes('foto:') &&
    !s.toLowerCase().includes('dpa') &&
    !s.toLowerCase().includes('quelle:') &&
    !s.toLowerCase().includes('abonniere') &&
    !s.toLowerCase().includes('newsletter')
  );

  if (candidates.length > 0) {
    // Pick the candidate with the highest information density (longer, distinct words)
    const sorted = [...candidates].sort((a, b) => b.length - a.length);
    return sorted[0];
  }

  return generateFallbackInsight(title, topic);
}

function generateFallbackInsight(title: string, topic: TopicTag): string {
  switch (topic) {
    case 'german_didactics':
      return `Effektive Didaktik setzt auf aktive Konstruktion und sokratische Reibung statt passivem Konsum: „${title}“ eröffnet neue Handlungspfade für den Unterricht.`;
    case 'ai_apple':
      return `Technologischer Fortschritt misst sich nicht an theoretischen Benchmarks, sondern an der physischen Beherrschbarkeit und der Souveränität des Nutzers über seine Werkzeuge.`;
    case 'philosophy_ethics':
      return `Wahre Erkenntnis verlangt das gedankliche Durchdringen von Widersprüchen: Erst wer die Gegenposition präzise formulieren kann, besitzt ein echtes Urteil.`;
    case 'sound_synthesis':
      return `Klangformung ist kybernetische Kommunikation: Die Struktur des Instruments und die Modulationsmatrix bestimmen den kognitiven Gestaltungsraum.`;
    case 'science_society':
      return `Wissenschaftlicher Erkenntnisfortschritt vollzieht sich an den Schnittstellen etablierter Disziplinen, wo bestehende Dogmen durch neue Messverfahren herausgefordert werden.`;
    case 'book_mastery':
      return `Ein Buch entfaltet seinen wahren Wert nicht im reinen Überfliegen, sondern als lebenslanger Resonanzkörper für die eigene Urteilsbildung.`;
    case 'youtube_gems':
      return `Komplexe Ideen verlangen visuelle Eleganz und methodische Reduktion: Wahres Verstehen beginnt, wo abstrakte Formeln in greifbare Zusammenhänge übergehen.`;
    case 'memes_satire':
      return `Satire ist das schärfste Skalpell der Aufklärung: Sie entlarvt die Absurditäten technologischer und gesellschaftlicher Moden durch treffsichere Zuspitzung.`;
    case 'contemplation_mind':
      return `Aufmerksamkeit ist die knappste Ressource des 21. Jahrhunderts: Wer seinen Fokus nicht selbst kultiviert, wird zum Spielball fremder Algorithmen.`;
    case 'health_biohacking':
      return `Körperliche und geistige Resilienz beruht auf biologischen Rhythmen und gezielten Reizen, nicht auf kurzfristigen Heilsversprechen.`;
    case 'opportunities_growth':
      return `Echte Hebelwirkung entsteht dort, wo individuelles Können mit autonomen Werkzeugen und offenen Standards multipliziert wird.`;
    default:
      return `Zentraler Impuls: „${title}“ liefert eine fundamentale Perspektive für selbstbestimmtes Denken und Handeln.`;
  }
}

/**
 * Synthesizes the 🎓 Lern-Partner & Didaktik-Transfer reflection box.
 */
export function synthesizeDidacticTransfer(
  title: string,
  bodyText: string,
  topic: TopicTag,
  isTeachingRelated?: boolean
): string {
  if (isTeachingRelated || topic === 'german_didactics') {
    return `Didaktischer Praxistransfer: Wie lässt sich die Kernfrage aus „${title}“ als sokratische Kontroverse oder forschendes Lernen im Unterricht und Seminar verankern?`;
  }

  switch (topic) {
    case 'ai_apple':
      return `Lern-Partner & Transfer: Reflektiere, an welcher Stelle du generative Systeme als passiven Ersatz nutzt – und wie du sie stattdessen als Sparringspartner für eigene Thesen einsetzen kannst.`;
    case 'philosophy_ethics':
      return `Lern-Partner & Transfer: Baue den stärksten denkbaren „Steel Man“ für die hier vertretene Position auf: Welcher Einwand würde dein eigenes Urteil am stärksten herausfordern?`;
    case 'sound_synthesis':
      return `Kreativer Praxistransfer: Erprobe, wie sich die hier beschriebene Signalarchitektur oder Modulationsmethode in deinem eigenen Arbeitsablauf oder Klangkonzept übersetzen lässt.`;
    case 'science_society':
      return `Erkenntnistheoretischer Transfer: Welche stillschweigende Prämisse liegt dieser Argumentation zugrunde, und wie ließe sie sich empirisch überprüfen?`;
    case 'book_mastery':
      return `Lern-Partner & Transfer: Welche konkrete Verhaltensänderung oder welches Denkmodell aus diesem Klassiker lässt sich direkt auf ein aktuelles Projekt anwenden?`;
    case 'contemplation_mind':
      return `Atem & Achtsamkeits-Transfer: Nimm diesen Gedanken als Anlass für einen 60-Sekunden-Atemraum: Was verändert sich im Körpergefühl, wenn du das Tempo bewusst drosselst?`;
    default:
      return `Lern-Partner & Transfer: Welcher Gedanke aus diesem Beitrag widersteht einer schnellen Einordnung und verdient eine bewusste Vertiefung in deiner persönlichen Bibliothek?`;
  }
}

/**
 * Synthesizes a challenging Socratic sparring prompt.
 */
export function synthesizeChallengePrompt(title: string, topic: TopicTag): string {
  switch (topic) {
    case 'german_didactics':
      return 'Welche strukturelle Hürde im Schulalltag verhindert die Umsetzung dieses didaktischen Ansatzes am stärksten?';
    case 'ai_apple':
      return 'Wo übersieht der gegenwärtige KI-Hype die unumstößlichen Grenzen von Hardware, Energie und menschlicher Urteilskraft?';
    case 'philosophy_ethics':
      return 'Welcher historische Denker hätte dieser Argumentation am radikalsten widersprochen – und mit welcher Begründung?';
    case 'sound_synthesis':
      return 'Ist Klangästhetik rein subjektiver Geschmack oder gibt es physikalisch-harmonische Gesetzmäßigkeiten für wahrhaft berührenden Klang?';
    case 'science_society':
      return 'Welches Risiko besteht, wenn diese wissenschaftliche Erkenntnis unkritisch auf politische Entscheidungen übertragen wird?';
    default:
      return 'Welches Gegenargument aus deiner eigenen Lebenserfahrung stellt diese Perspektive auf die Probe?';
  }
}

/**
 * Finds a related "Old Gem of the Internet" (timeless classic) from the vault.
 */
export function findRelatedEvergreenGem(topic: TopicTag, title: string): FeedItem | undefined {
  // Only consider genuinely timeless classics that share this topic
  const candidates = REAL_KNOWLEDGE_VAULT.filter(item => 
    item.isEvergreenGem === true && (item.primaryTopic === topic || item.topics.includes(topic))
  );

  if (candidates.length === 0) {
    return undefined;
  }

  // Find candidate with topical/semantic keyword relevance
  const titleWords = title.toLowerCase().split(/\s+/).filter(w => w.length > 4);
  const matched = candidates.find(c => {
    const text = `${c.title} ${c.feedText}`.toLowerCase();
    return titleWords.some(w => text.includes(w));
  });

  return matched || candidates[0];
}

/**
 * Enriches any raw feed item with the complete, pristine Atem quality standard:
 * - 💡 Key Insight
 * - 🎓 Didactic / Learning Partner Transfer
 * - ⚡️ Socratic Challenge Prompt
 * - High-contrast domain branding and metadata
 */
export function enrichItemWithInstantResearch(item: FeedItem): FeedItem {
  const primaryTopic = item.primaryTopic || 'philosophy_ethics';
  const body = item.articleBody || item.feedText || item.body || item.title;

  const keyInsight = item.keyInsight || synthesizeKeyInsight(item.title, body, primaryTopic);
  const didacticTransfer = item.didacticTransfer || item.didacticSeed || synthesizeDidacticTransfer(
    item.title,
    body,
    primaryTopic,
    item.isTeachingRelated
  );
  const challengePrompt = item.challengePrompt || synthesizeChallengePrompt(item.title, primaryTopic);

  // Cross-reference related evergreen gem context if available
  const relatedGem = findRelatedEvergreenGem(primaryTopic, item.title);
  const evergreenContext = item.evergreenContext || (
    relatedGem && relatedGem.id !== item.id
      ? `Historische Wurzel & Klassiker: „${relatedGem.title}“ (${relatedGem.sourceReferences[0]?.publisher || 'Kanon'})`
      : undefined
  );

  return {
    ...item,
    keyInsight,
    didacticTransfer,
    didacticSeed: didacticTransfer,
    challengePrompt,
    evergreenContext,
    // Only mark as teaching-related if it genuinely belongs to didactics/pedagogy
    isTeachingRelated: Boolean(item.isTeachingRelated || primaryTopic === 'german_didactics' || item.topics?.includes('german_didactics'))
  };
}
