import { FeedItem, TopicTag, EditorialAbstract } from '../domain/types';
import { REAL_KNOWLEDGE_VAULT } from '../data/realKnowledgeVault';
import { TOPIC_DIALECTICS } from './dialecticTemplates';

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
 * Synthesizes an Ebene 2 Editorial Abstract for items that do not yet have one:
 * - overview: Worum geht es? (ca. 25-45 Wörter)
 * - keyFinding: Was ist die zentrale Aussage / neue Entwicklung? (ca. 30-50 Wörter)
 * - relevanceWhy: Warum könnte das für mich interessant sein? (ca. 25-45 Wörter)
 * - limitation: Wichtige Einschränkung / Caveat / Gültigkeitsgrenze (ca. 15-30 Wörter)
 */
export function synthesizeEditorialAbstract(item: FeedItem): EditorialAbstract {
  const primaryTopic = item.primaryTopic || 'philosophy_ethics';
  const subtitle = item.subtitle || '';
  const feedText = item.feedText || item.body || '';
  const insight = item.keyInsight || synthesizeKeyInsight(item.title, feedText, primaryTopic);

  const overview = subtitle.trim().length > 20
    ? `${item.title}: ${subtitle}`
    : `Eine quellengestützte Untersuchung zu „${item.title}“, die den aktuellen Sachverhalt und nötigen Hintergrund beleuchtet.`;

  const keyFinding = insight.length > 25
    ? insight
    : `Die Analyse verdeutlicht, dass die Tragweite dieser Entwicklung vor allem in den zugrundeliegenden methodischen und strukturellen Bedingungen liegt.`;

  const relevanceWhy = item.relevanceExplanation && item.relevanceExplanation.length > 20
    ? item.relevanceExplanation
    : `Eröffnet eine differenzierte Orientierung jenseits oberflächlicher Schlagzeilen und verbindet theoretischen Hintergrund mit persönlicher Urteilskraft.`;

  const limitation = item.isChallengingPerspective
    ? `Formuliert eine pointierte Gegenposition; methodische Unsicherheiten und alternative Interpretationen müssen im Diskurs sorgfältig abgewogen werden.`
    : `Gültig im Rahmen der untersuchten Datenbasis; weitergehende Schlüsse verlangen eine fortlaufende Prüfung künftiger Evidenz.`;

  return {
    overview,
    keyFinding,
    relevanceWhy,
    limitation
  };
}

/**
 * Synthesizes an engaging, multi-paragraph Level 3 Deep Reader article
 * when the original RSS/feed source only delivers a brief 2-3 sentence summary.
 * 
 * Uses natural, curiosity-driven Reddit/community language with 4 clear subheadings:
 * 1. ### Worum es geht
 * 2. ### Warum das wichtig ist
 * 3. ### Die Gegenperspektive
 * 4. ### Zum Weiterdenken & Ausprobieren
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
    `Die Berichterstattung von **${authorCitation}** zu „${title}“ greift eine Entwicklung auf, die über die unmittelbare Tagesmeldung hinausreicht. Im Kern geht es um die Frage, wie sich bestehende Annahmen verändern, wenn neue Beobachtungen oder methodische Ansätze das gewohnte Bild herausfordern.`,
    ``,
    `### Warum das wichtig ist`,
    `Die Relevanz dieses Beitrags liegt vor allem in den Folgewirkungen: ${effectiveInsight}`,
    ``,
    `Die Quelle **${sourceName}** gilt in diesem Themenfeld als fundierter Indikator für Verschiebungen im Diskurs. Anstatt bei der oberflächlichen Schlagzeile stehenzubleiben, lohnt sich der Blick auf die Mechanismen dahinter: Wie belastbar sind die zugrundeliegenden Daten und welche systemischen Trends zeichnen sich hier ab?`,
    ``,
    `### Die Gegenperspektive`,
    `${effectiveCounter}`,
    ``,
    `Kritische Stimmen mahnen zu Recht zur Vorsicht: Wer zu schnell eindeutige Schlüsse zieht, übersieht oft gegenläufige Effekte oder institutionelle Trägheit. Erst im Abgleich mit widersprüchlichen Erfahrungen zeigt sich, wo die Grenzen dieser Perspektive verlaufen.`,
    ``,
    `### Zum Weiterdenken & Ausprobieren`,
    `**Impuls für die eigene Praxis:** ${dialectic.actionableTransfer}`,
    ``,
    `**Die Leitfrage zum Weiterforschen:** *„${effectivePrompt}“*`
  ].join('\n');
}

/**
 * Enriches any raw feed item with the complete, pristine Atem quality standard:
 * - 💡 Key Insight
 * - 🎓 Didactic / Learning Partner Transfer
 * - ⚡️ Socratic Challenge Prompt
 * - 📑 Ebene 2 Editorial Abstract
 * - 📖 Ebene 3 Substantive Deep Reader Article (auto-expanded when brief)
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

  // Ebene 3 Substantive Deep Reader expansion:
  // Detect if articleBody/body is short (< 550 chars) or identical to the brief feedText preview
  const rawBody = item.articleBody || item.body || '';
  const isShortOrDuplicate = rawBody.length < 550 || rawBody.trim() === (item.feedText || '').trim();

  let articleBody = item.articleBody;
  let expandedBody = item.body;

  if (isShortOrDuplicate) {
    const synthesized = synthesizeDeepeningArticle({
      title: item.title,
      summary: item.feedText || item.subtitle || item.title,
      topic: primaryTopic,
      sourceName: item.sourceReferences?.[0]?.publisher || 'Redaktioneller Feed',
      author: item.sourceReferences?.[0]?.author,
      isTeachingRelated: item.isTeachingRelated,
      keyInsight,
      counterPerspective: item.perspectiveDetails?.counterPerspective || TOPIC_DIALECTICS[primaryTopic]?.counterPerspective,
      challengePrompt
    });
    articleBody = synthesized;
    expandedBody = item.body && item.body.length > synthesized.length ? item.body : synthesized;
  }

  return {
    ...item,
    articleBody,
    body: expandedBody,
    keyInsight,
    didacticTransfer,
    didacticSeed: didacticTransfer,
    challengePrompt,
    evergreenContext,
    editorialAbstract,
    editorialSynthesisType,
    // Only mark as teaching-related if it genuinely belongs to didactics/pedagogy
    isTeachingRelated: Boolean(item.isTeachingRelated || primaryTopic === 'german_didactics' || item.topics?.includes('german_didactics'))
  };
}
