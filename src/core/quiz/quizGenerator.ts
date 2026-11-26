import { FeedItem, FeedQuizQuestion, FeedQuizQuestionSchema } from '../domain/types';
import {
  AiCredentials,
  callAiModel,
  extractJsonFromAiResponse,
  hasAiConfiguration,
  loadAiCredentials
} from '../ai/atmenAiClient';
import {
  EnrichmentUsageLedger,
  defaultUsageLedger,
  getEffectiveBudgetCeilingEur
} from '../enrichment/ledger';
import { EnrichmentCache, StorageDriverCacheStorage } from '../enrichment/cache';
import { appStorage } from '../data/storage';
import { pureJsSha256 } from '../ingestion/normalizer';

const defaultQuizAiCache = new EnrichmentCache<FeedQuizQuestion>(
  undefined,
  undefined,
  new StorageDriverCacheStorage<FeedQuizQuestion>(appStorage, '@atem:quiz_ai_cache:v1')
);

export async function clearQuizAiCache(): Promise<void> {
  await defaultQuizAiCache.clear();
}

const BANNED_QUIZ_PATTERNS = [
  /wer hat diesen (artikel|beitrag) veröffentlicht/i,
  /welches medium hat diesen beitrag publiziert/i,
  /wann wurde dieser artikel veröffentlicht/i,
  /oberflächliche sensationsmeldung ohne nachhaltigen informationswert/i,
  /widerspricht allen bisherigen erkenntnissen ohne begründung/i,
  /keine der aussagen ist handlungsrelevant oder überprüfbar/i,
  /vollständige vermeidung jeglicher informationsaufnahme/i,
  /einzelne anekdoten sind aussagekräftiger als reproduzierbare/i,
  // Legacy canned distractors (identical for every article of a topic) — never show them again
  /skaliert linear allein über zusätzliche rechenleistung/i,
  /ersetzen menschliche kuratierung und domänenkompetenz vollständig/i,
  /hängt ausschließlich von proprietären algorithmen ab/i,
  /primär durch die maximierung kognitiver verarbeitungsgeschwindigkeit/i,
  /vollständig in formale nutzenkalküle auflösen/i,
  /strikt voneinander getrennt und beeinflussen sich wechselseitig nicht/i,
  /standardisierte reproduktionsaufgaben ohne offenen diskursraum/i,
  /lektüre längerer primärtexte didaktisch überflüssig/i,
  /kleinschrittiger gamification ab, nicht von echten problemstellungen/i,
  /kurzfristiges einzelphänomen ohne rückkopplung/i,
  /isolierte einzelmaßnahmen vollkommen aus/i,
  /externe rahmenbedingungen gegenüber individuellen einzelentscheidungen vernachlässigbar/i,
  /allein durch deregulierung ohne institutionelle leitplanken/i,
  /rein methodischen streit über messinstrumente/i,
  /historische pfadabhängigkeiten .* keinerlei erklärende kraft/i
];

/**
 * Validates that a quiz question is a genuine conceptual comprehension/transfer question
 * and not a trivial metadata question or silly boilerplate distractor set.
 */
export function isPlausibleNonMetadataQuiz(quiz: FeedQuizQuestion): boolean {
  if (!quiz || !quiz.question || !Array.isArray(quiz.options) || quiz.options.length !== 4) {
    return false;
  }
  const combined = `${quiz.question} ${quiz.options.join(' ')} ${quiz.explanation}`;
  for (const pat of BANNED_QUIZ_PATTERNS) {
    if (pat.test(combined)) {
      return false;
    }
  }
  // All 4 options must be distinct and substantive (>= 20 chars)
  const uniqueOpts = new Set(quiz.options.map(o => o.trim().toLowerCase()));
  if (uniqueOpts.size !== 4) return false;
  return quiz.options.every(o => o.trim().length >= 20);
}

function extractAnchorConcept(item: FeedItem): string {
  const cleanedTitle = item.title
    .replace(/^[„"']|[“"']$/g, '')
    .split(/[:–—|]/)[0]
    .trim();
  return cleanedTitle.length > 65 ? `${cleanedTitle.slice(0, 62).trim()}…` : cleanedTitle;
}

function ensureSentencePeriod(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  if (!trimmed) return '';
  const capped = trimmed.length > 180 ? `${trimmed.slice(0, 177).trim()}…` : trimmed;
  return /[.!?…]$/.test(capped) ? capped : `${capped}.`;
}

export type QuizLanguage = 'de' | 'en';

function detectQuizLanguage(text: string): QuizLanguage {
  const en = (text.match(/\b(the|and|of|to|is|that|with|for|this|from|are|was|were|has|have|it|its|which)\b/gi) || []).length;
  const de = (text.match(/\b(der|die|das|und|ist|nicht|mit|für|dass|eine|einer|auf|sich|von|wird|wurde|auch|im|zum|zur)\b/gi) || []).length;
  return en > de * 1.15 ? 'en' : 'de';
}

function stableHash(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function cleanQuizSourceText(raw: string): string {
  return (raw || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '$1')
    .replace(/^#{1,6}\s+.*$/gm, ' ')
    .replace(/^\s*[-*•]\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/↗[^\n]*/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Splits text into self-contained, quiz-worthy statements (no questions, no URLs, no fragments). */
export function extractQuizStatements(text: string): string[] {
  const cleaned = cleanQuizSourceText(text);
  if (!cleaned) return [];
  const parts = cleaned
    .split(/(?<=[.!?])\s+(?=[A-ZÄÖÜ0-9„"“])/)
    .map(s => s.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of parts) {
    if (s.length < 45 || s.length > 180) continue;
    if (/[?:]$/.test(s) || !/[.!]$/.test(s)) continue;
    if (/(©|foto:|bild:|credit|subscribe|newsletter|cookie|javascript|anzeige|werbung|sponsored|bei amazon|eur\b|€|\.\.\.|…|appeared first on|first appeared on|erschien zuerst)/i.test(s)) continue;
    // Fragments created by ordinal dates ("15. November in …") or lower-case starts are not self-contained
    if (/^(januar|februar|märz|april|mai|juni|juli|august|september|oktober|november|dezember)\b/i.test(s)) continue;
    if (/^[a-zäöü]/.test(s)) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

const POLARITY_PAIRS: Record<QuizLanguage, [string, string][]> = {
  de: [
    ['mehr', 'weniger'], ['höher', 'niedriger'], ['steigt', 'sinkt'], ['steigen', 'sinken'],
    ['gestiegen', 'gesunken'], ['wächst', 'schrumpft'], ['wachsen', 'schrumpfen'], ['zunehmend', 'abnehmend'],
    ['Anstieg', 'Rückgang'], ['größer', 'kleiner'], ['stärker', 'schwächer'], ['früher', 'später'],
    ['besser', 'schlechter'], ['schneller', 'langsamer'], ['länger', 'kürzer'], ['günstiger', 'teurer'],
    ['billiger', 'teurer'], ['Mehrheit', 'Minderheit'], ['gewonnen', 'verloren'], ['positiv', 'negativ'],
    ['erlaubt', 'verbietet'], ['erhöht', 'senkt'], ['erstmals', 'erneut'], ['alle', 'nur wenige'],
    ['immer', 'selten'], ['deutlich', 'kaum'], ['zugestimmt', 'abgelehnt'], ['Zustimmung', 'Ablehnung']
  ],
  en: [
    ['more', 'less'], ['higher', 'lower'], ['increase', 'decrease'], ['increases', 'decreases'],
    ['increased', 'decreased'], ['rise', 'fall'], ['rises', 'falls'], ['rose', 'fell'], ['grew', 'shrank'],
    ['larger', 'smaller'], ['bigger', 'smaller'], ['stronger', 'weaker'], ['faster', 'slower'],
    ['earlier', 'later'], ['better', 'worse'], ['won', 'lost'], ['banned', 'allowed'], ['bans', 'allows'],
    ['likely', 'unlikely'], ['majority', 'minority'], ['cheaper', 'more expensive'],
    ['longer', 'shorter'], ['positive', 'negative'], ['first', 'last'], ['approved', 'rejected'],
    ['all', 'only a few'], ['always', 'rarely'], ['above', 'below']
  ]
};

function matchCase(original: string, replacement: string): string {
  if (original[0] && original[0] === original[0].toUpperCase() && original[0] !== original[0].toLowerCase()) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

function mutateNumber(sentence: string, salt: number): string | null {
  const re = /(?<![\w.,/])(\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d+)?)(?![\w/])/;
  const m = sentence.match(re);
  if (!m || m.index === undefined) return null;
  const token = m[1];
  const isThousands = /^\d{1,3}(?:[.,]\d{3})+$/.test(token);
  const decimalSep = !isThousands && token.includes(',') ? ',' : '.';
  const numeric = isThousands ? parseInt(token.replace(/[.,]/g, ''), 10) : parseFloat(token.replace(',', '.'));
  if (!isFinite(numeric)) return null;
  let next: number;
  if (!isThousands && Number.isInteger(numeric) && numeric >= 1800 && numeric <= 2100 && token.length === 4) {
    next = numeric + (salt % 2 === 0 ? 1 : -1) * (4 + (salt % 6));
  } else if (numeric === 0) {
    next = 3 + (salt % 5);
  } else if (numeric < 10 && Number.isInteger(numeric)) {
    next = numeric + 2 + (salt % 4);
  } else {
    next = salt % 2 === 0 ? numeric * 2 : numeric / 2;
  }
  let formatted: string;
  if (isThousands) {
    const sep = token.includes('.') ? '.' : ',';
    formatted = Math.round(next).toString().replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  } else if (token.includes('.') || token.includes(',')) {
    const decimals = (token.split(/[.,]/)[1] || '').length;
    formatted = next.toFixed(Math.max(1, decimals)).replace('.', decimalSep);
  } else {
    formatted = String(Math.round(next));
  }
  if (formatted === token) return null;
  return sentence.slice(0, m.index) + formatted + sentence.slice(m.index + token.length);
}

function mutatePolarity(sentence: string, lang: QuizLanguage): string | null {
  for (const [a, b] of POLARITY_PAIRS[lang]) {
    for (const [from, to] of [[a, b], [b, a]] as const) {
      const re = new RegExp(`(^|[^\\p{L}])(${from})(?=[^\\p{L}]|$)`, 'iu');
      const m = sentence.match(re);
      if (m && m.index !== undefined) {
        const start = m.index + m[1].length;
        const original = sentence.slice(start, start + from.length);
        return sentence.slice(0, start) + matchCase(original, to) + sentence.slice(start + from.length);
      }
    }
  }
  return null;
}

function mutateNegation(sentence: string, lang: QuizLanguage): string | null {
  if (lang === 'en') {
    if (/\b(?:is|are|was|were|does|did|has|have|will|can) not\b/i.test(sentence)) {
      return sentence.replace(/\b(is|are|was|were|does|did|has|have|will|can) not\b/i, '$1');
    }
    if (/\bcannot\b/i.test(sentence)) return sentence.replace(/\bcannot\b/i, 'can');
    const m = sentence.match(/\s(is|are|was|were|will|can)\s/i);
    if (m && m.index !== undefined) {
      const verb = m[1];
      const replacement = verb.toLowerCase() === 'can' ? ' cannot ' : ` ${verb} not `;
      return sentence.slice(0, m.index) + replacement + sentence.slice(m.index + m[0].length);
    }
    return null;
  }
  if (/\snicht\s/i.test(sentence)) {
    return sentence.replace(/\snicht\s/i, ' ');
  }
  const m = sentence.match(/\s(ist|sind|war|waren|wird|werden|kann|können|soll|sollen)\s/);
  if (m && m.index !== undefined) {
    return sentence.slice(0, m.index) + ` ${m[1]} nicht ` + sentence.slice(m.index + m[0].length);
  }
  return null;
}

/** Produces a plausible-but-false near-miss of a true statement (changed number, flipped direction, or negation). */
export function falsifyStatement(sentence: string, lang: QuizLanguage, salt = 0, allowNegation = true): string | null {
  // Order matters: changed figures and flipped directions make the best near-misses; negation is the last resort.
  const ops = [
    () => mutateNumber(sentence, salt),
    () => mutatePolarity(sentence, lang),
    ...(allowNegation ? [() => mutateNegation(sentence, lang)] : [])
  ];
  for (let i = 0; i < ops.length; i++) {
    const candidate = ops[i]();
    if (candidate && candidate.trim() !== sentence.trim()) {
      return candidate.replace(/\s+/g, ' ').trim();
    }
  }
  return null;
}

function scoreQuizStatement(s: string, idx: number, total: number, titleWords: string[] = []): number {
  let score = 0;
  const lower = s.toLowerCase();
  const titleHits = titleWords.filter(w => lower.includes(w)).length;
  score += Math.min(3, titleHits);
  if (/^["„“'»]/.test(s)) score -= 2;
  if (/\b(i|my|mine|me|we|our|ich|mein|meine|mir|mich|wir|unser)\b/i.test(s)) score -= 4;
  if (/\d/.test(s)) score += 2;
  if (/(zeigt|belegt|ergab|fand|entscheidend|zentral|bedeutet|laut|shows|found|reveals|according|means|key|because|weil|daher|therefore)/i.test(s)) score += 2;
  if (s.length >= 70 && s.length <= 160) score += 1;
  if (idx > 0 && idx < total - 1) score += 1;
  if (/^(er|sie|es|dies|das|he|she|it|they|this|these|those|but|aber|und|and)\b/i.test(s)) score -= 3;
  return score;
}

const QUESTION_VARIANTS: Record<QuizLanguage, string[]> = {
  de: [
    'Welche Aussage gibt den Beitrag korrekt wieder?',
    'Was steht tatsächlich so im Text?',
    'Welche dieser Angaben stimmt laut Beitrag?'
  ],
  en: [
    'Which statement accurately reflects the article?',
    'Which of these claims is actually made in the text?',
    'According to the article, which statement is correct?'
  ]
};

function rotateOptions(correct: string, distractors: string[], seed: number): { options: string[]; correctIndex: number } {
  const options = [correct, ...distractors.slice(0, 3)];
  const shift = seed % 4;
  const rotated = [...options.slice(shift), ...options.slice(0, shift)];
  return { options: rotated, correctIndex: rotated.indexOf(correct) };
}

/**
 * Builds a quiz entirely from the article's own statements:
 * the correct answer is a verbatim sentence, the three distractors are near-miss falsifications
 * of other sentences (changed figures, flipped direction, inserted/removed negation) — in the article's language.
 * Returns null when the text is too thin for a meaningful question (the Reader then hides the quiz).
 */
export function buildTextGroundedQuiz(item: FeedItem): FeedQuizQuestion | null {
  const source = (item.articleBody && item.articleBody.trim().length > 40 ? item.articleBody : `${item.feedText || ''} ${item.body || ''}`).trim();
  const statements = extractQuizStatements(source);
  if (statements.length < 3) return null;
  const words = cleanQuizSourceText(source).split(/\s+/).filter(Boolean).length;
  if (words < 60) return null;

  const lang = detectQuizLanguage(source);
  const seed = stableHash(item.id || item.title);
  const titleWords = (item.title || '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(w => w.length >= 5);
  const ranked = statements
    .map((s, idx) => ({ s, score: scoreQuizStatement(s, idx, statements.length, titleWords) }))
    .sort((a, b) => b.score - a.score);

  const keyInsight = (item.keyInsight || '').trim();
  const correct = (keyInsight && statements.find(s => s === keyInsight)) || ranked[0].s;
  const statementSet = new Set(statements.map(s => s.toLowerCase()));

  const distractors: string[] = [];
  const pushIfValid = (candidate: string | null) => {
    if (!candidate) return;
    const lower = candidate.toLowerCase();
    if (statementSet.has(lower) || lower === correct.toLowerCase()) return;
    if (distractors.some(d => d.toLowerCase() === lower)) return;
    if (candidate.length < 20 || candidate.length > 200) return;
    distractors.push(candidate);
  };

  // 1. Near-miss of the correct statement itself (changed figure / flipped direction only — no cheap negation)
  pushIfValid(falsifyStatement(correct, lang, seed, false));
  // 2. Falsified versions of other statements: first figures & directions, negation only as last resort
  let salt = seed + 1;
  for (const allowNegation of [false, true]) {
    for (const { s } of ranked) {
      if (distractors.length >= 3) break;
      if (s === correct) continue;
      pushIfValid(falsifyStatement(s, lang, salt++, allowNegation));
    }
  }
  if (distractors.length < 3) return null;

  const { options, correctIndex } = rotateOptions(correct, distractors, seed);
  const question = QUESTION_VARIANTS[lang][seed % QUESTION_VARIANTS[lang].length];
  const explanation =
    lang === 'en'
      ? `The article states: "${correct}" The other options sound similar but twist one detail — a figure, a direction or a negation.`
      : `Im Text heißt es: „${correct}“ Die anderen Optionen klingen ähnlich, verdrehen aber ein Detail – eine Zahl, eine Richtung oder eine Verneinung.`;

  const parsed = FeedQuizQuestionSchema.safeParse({
    id: `quiz-${item.id}`,
    question,
    options,
    correctIndex: correctIndex >= 0 ? correctIndex : 0,
    explanation,
    sourceArticleId: item.id,
    sourceArticleTitle: item.title
  });
  if (!parsed.success || !isPlausibleNonMetadataQuiz(parsed.data)) return null;
  return parsed.data;
}

/**
 * Deterministic quiz for an article. Prefers the text-grounded near-miss quiz; for very short items it falls back
 * to a compact comprehension check built from the item's own claim, still in the article's language.
 */
export function generateQuizForArticle(item: FeedItem): FeedQuizQuestion {
  const grounded = buildTextGroundedQuiz(item);
  if (grounded) return grounded;

  const title = item.title.trim() || 'Diesen Beitrag';
  const anchor = extractAnchorConcept(item);
  const rawBody = cleanQuizSourceText(`${item.feedText || ''} ${item.articleBody || ''} ${item.body || ''}`);
  const lang = detectQuizLanguage(`${title} ${rawBody}`);
  const sentences = extractQuizStatements(rawBody);
  const seed = stableHash(item.id || title);

  const primaryClaim = ensureSentencePeriod(
    item.keyInsight?.trim() ||
    item.perspectiveDetails?.claim?.trim() ||
    sentences[0] ||
    item.subtitle?.trim() ||
    (lang === 'en'
      ? `The piece on "${anchor}" connects concrete observations with their wider context.`
      : `Der Beitrag zu „${anchor}“ verbindet konkrete Beobachtungen mit ihrem größeren Zusammenhang.`)
  );

  const distractors: string[] = [];
  const add = (candidate: string | null) => {
    if (!candidate) return;
    const c = ensureSentencePeriod(candidate);
    if (c.length < 20 || c.toLowerCase() === primaryClaim.toLowerCase()) return;
    if (distractors.some(d => d.toLowerCase() === c.toLowerCase())) return;
    distractors.push(c);
  };
  for (let i = 0; i < 3; i++) add(falsifyStatement(primaryClaim, lang, seed + i));
  for (const s of sentences) {
    if (distractors.length >= 3) break;
    if (s !== primaryClaim) add(falsifyStatement(s, lang, seed + distractors.length + 3));
  }
  const lastResort =
    lang === 'en'
      ? [
          `The article presents "${anchor}" as settled, with no open questions left.`,
          `According to the article, "${anchor}" makes no practical difference to anyone involved.`,
          `The text treats "${anchor}" as an unconfirmed rumour without any verifiable facts.`
        ]
      : [
          `Der Beitrag stellt „${anchor}“ als abgeschlossene Sache ohne offene Fragen dar.`,
          `Laut Beitrag hat „${anchor}“ für die Beteiligten keinerlei praktische Folgen.`,
          `Der Text behandelt „${anchor}“ als unbestätigtes Gerücht ohne überprüfbare Fakten.`
        ];
  for (const s of lastResort) {
    if (distractors.length >= 3) break;
    add(s);
  }

  const { options, correctIndex } = rotateOptions(primaryClaim, distractors, seed);
  const questionText =
    lang === 'en'
      ? `Which statement matches the piece "${anchor}"?`
      : `Welche Aussage passt zum Beitrag „${anchor}“?`;
  const explanation =
    lang === 'en'
      ? `The piece says: ${primaryClaim} The alternatives change a detail or overstate the claim.`
      : `Der Beitrag sagt: ${primaryClaim} Die Alternativen verändern ein Detail oder überziehen die Aussage.`;

  return FeedQuizQuestionSchema.parse({
    id: `quiz-${item.id}`,
    question: questionText,
    options,
    correctIndex: correctIndex >= 0 ? correctIndex : 0,
    explanation,
    sourceArticleId: item.id,
    sourceArticleTitle: item.title
  });
}

/**
 * Generates a single thought-provoking Socratic comprehension/transfer quiz for an article
 * using the configured paid LLM API key, falling back cleanly to the upgraded non-boilerplate
 * conceptual generator if offline or unconfigured.
 */
export async function generateSingleArticleQuizWithAi(
  item: FeedItem,
  credentials?: AiCredentials,
  ledger: EnrichmentUsageLedger = defaultUsageLedger
): Promise<FeedQuizQuestion> {
  if (
    item.quiz &&
    isPlausibleNonMetadataQuiz(item.quiz) &&
    (item.aiAssisted || item.enrichmentTier === 'ai')
  ) {
    return item.quiz;
  }
  const results = await generateQuizWithAi([item], credentials, ledger);
  return results[0] || generateQuizForArticle(item);
}

/**
 * Generates quiz questions for a batch of feed items using live AI (BYOK) if available,
 * falling back cleanly to deterministic synthesis when offline or budget-capped.
 */
export async function generateQuizWithAi(
  items: FeedItem[],
  credentials?: AiCredentials,
  ledger: EnrichmentUsageLedger = defaultUsageLedger
): Promise<FeedQuizQuestion[]> {
  if (items.length === 0) return [];

  let creds = credentials;
  if (!creds) {
    try {
      creds = await loadAiCredentials();
    } catch {
      creds = undefined;
    }
  }

  if (!creds || !hasAiConfiguration(creds)) {
    return items.map(generateQuizForArticle);
  }

  const useSharedCache = !credentials && ledger === defaultUsageLedger;
  const cachedSingleItem = items.length === 1 ? items[0] : null;
  const singleCacheKey = cachedSingleItem
    ? {
        contentHash: pureJsSha256(
          `${cachedSingleItem.id}|${cachedSingleItem.title}|${(cachedSingleItem.feedText || '').slice(0, 300)}`
        ),
        task: 'reader_quiz_v2',
        modelId: creds.model || 'default'
      }
    : null;

  if (useSharedCache && singleCacheKey) {
    const cachedQuiz = await defaultQuizAiCache.get(singleCacheKey);
    if (cachedQuiz && isPlausibleNonMetadataQuiz(cachedQuiz)) {
      return [cachedQuiz];
    }
  }

  const budgetCeilingEur = getEffectiveBudgetCeilingEur(Boolean(creds.apiKey?.trim()));
  const isPersonalByok = Boolean(creds.apiKey?.trim() && creds.persistApiKey === true);
  const canSpend = isPersonalByok || (await ledger.canSpend(0.002, undefined, budgetCeilingEur));
  if (!canSpend) {
    return items.map(generateQuizForArticle);
  }

  const systemInstruction = `Du bist ein sokratischer Erkenntnis- und Lern-Assistent für die souveräne Wissens-App ATMEN.
Erstelle für jeden übergebenen Beitrag GENAU 1 anspruchsvolle Multiple-Choice-Frage (Verständnis-, Struktur- oder Transferfrage).
STRIKTE QUALITÄTSREGELN:
1. NIEMALS triviale Metadaten-Fragen stellen (z. B. "Wer hat diesen Artikel veröffentlicht?", "Wie heißt die Quelle?").
2. NIEMALS alberne oder offensichtlich falsche Scherz-Optionen verwenden (z. B. "Es handelt sich um eine oberflächliche Sensationsmeldung").
3. Alle 4 Antwortoptionen (A, B, C, D) müssen sich auf KONKRETE Inhalte genau dieses Textes beziehen (Zahlen, Akteure, Ursachen, Thesen) und auf den ersten Blick plausibel klingen.
4. Die 3 falschen Optionen sind "Beinahe-Treffer": Sie verdrehen jeweils ein konkretes Detail des Textes (falsche Zahl, vertauschter Akteur, umgekehrte Ursache-Wirkung, übertriebene Verallgemeinerung). VERBOTEN sind allgemeine Floskeln, die zu jedem Artikel passen würden (z. B. "skaliert linear über Rechenleistung", "ist ein kurzfristiges Einzelphänomen").
5. Genau 1 Option ist richtig (correctIndex: 0 bis 3). Alle Optionen ähnlich lang.
6. Liefere eine prägnante Erklärung (2 Sätze), warum diese Option zutrifft und welches Detail die Alternativen verdrehen.
7. Sprache: Frage, Optionen und Erklärung auf Deutsch – bei englischsprachigen Artikeln komplett auf Englisch.
Antworte AUSSCHLIESSLICH als valides JSON-Array von Objekten:
[
  {
    "id": "quiz-<articleId>",
    "question": "Fragestellung...",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctIndex": 0,
    "explanation": "Zwei Sätze Erklärung...",
    "sourceArticleId": "<articleId>",
    "sourceArticleTitle": "<articleTitle>"
  }
]`;

  const prompt = `Beiträge für das sokratische Erkenntnis-Quiz:\n` + items.slice(0, 5).map(item => (
    `- ID: ${item.id}
  Titel: ${item.title}
  Thema: ${item.primaryTopic}
  Kernaussage: ${item.keyInsight || item.subtitle || ''}
  Gegenperspektive: ${item.perspectiveDetails?.counterPerspective || item.deepeningOptions?.counterArgument || ''}
  Textauszug: ${(item.articleBody || item.feedText || '').slice(0, 900)}`
  )).join('\n\n');

  try {
    const response = await callAiModel(prompt, {
      systemInstruction,
      jsonMode: true,
      timeoutMs: 25_000,
      credentials: creds,
      ledger,
      itemId: `quiz-batch-${Date.now()}`
    });

    const rawParsed = extractJsonFromAiResponse<unknown>(response.text);
    const parsed = Array.isArray(rawParsed)
      ? rawParsed
      : (rawParsed && typeof rawParsed === 'object' && Array.isArray((rawParsed as { questions?: unknown[] }).questions))
      ? (rawParsed as { questions: unknown[] }).questions
      : null;
    if (Array.isArray(parsed) && parsed.length > 0) {
      const validated: FeedQuizQuestion[] = [];
      for (const rawQ of parsed) {
        const safe = FeedQuizQuestionSchema.safeParse(rawQ);
        if (safe.success && isPlausibleNonMetadataQuiz(safe.data)) {
          validated.push(safe.data);
        }
      }
      if (validated.length > 0) {
        if (useSharedCache && singleCacheKey && items.length === 1) {
          await defaultQuizAiCache.set(singleCacheKey, validated[0]);
        }
        return validated;
      }
    }
  } catch {
    // Fall back cleanly to deterministic conceptual synthesis
  }

  return items.map(generateQuizForArticle);
}
