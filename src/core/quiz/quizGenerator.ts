import { FeedItem, FeedQuizQuestion, FeedQuizQuestionSchema } from '../domain/types';
import { AiCredentials, callAiModel, loadAiCredentials } from '../ai/atmenAiClient';
import { EnrichmentUsageLedger, defaultUsageLedger } from '../enrichment/ledger';

const BANNED_QUIZ_PATTERNS = [
  /wer hat diesen (artikel|beitrag) veröffentlicht/i,
  /welches medium hat diesen beitrag publiziert/i,
  /wann wurde dieser artikel veröffentlicht/i,
  /oberflächliche sensationsmeldung ohne nachhaltigen informationswert/i,
  /widerspricht allen bisherigen erkenntnissen ohne begründung/i,
  /keine der aussagen ist handlungsrelevant oder überprüfbar/i,
  /vollständige vermeidung jeglicher informationsaufnahme/i,
  /einzelne anekdoten sind aussagekräftiger als reproduzierbare/i
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

/**
 * Deterministically synthesizes a Socratic comprehension or conceptual transfer question
 * with 4 nuanced, domain-plausible options (zero metadata trivia, zero silly distractors).
 */
export function generateQuizForArticle(item: FeedItem): FeedQuizQuestion {
  const title = item.title.trim() || 'Diesen Beitrag';
  const anchor = extractAnchorConcept(item);
  const rawBody = `${item.feedText || ''} ${item.articleBody || ''} ${item.body || ''}`
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const sentences = rawBody
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length >= 40 && s.length <= 190);

  const primaryClaim = ensureSentencePeriod(
    item.keyInsight?.trim() ||
    item.perspectiveDetails?.claim?.trim() ||
    sentences[0] ||
    item.subtitle?.trim() ||
    `Die Analyse zu „${anchor}“ verbindet empirische Befunde mit strukturellen Rahmenbedingungen.`
  );

  const counterClaim = item.perspectiveDetails?.counterPerspective?.trim() ||
    item.deepeningOptions?.counterArgument?.trim();

  let questionText = '';
  let correctOption = '';
  let distractor1 = '';
  let distractor2 = '';
  let distractor3 = '';
  let explanation = '';

  if (item.perspectiveDetails?.claim && counterClaim) {
    questionText = `Worin liegt das zentrale dialektische Spannungsfeld in der Debatte um „${anchor}“?`;
    correctOption = ensureSentencePeriod(
      `Zwischen der Hauptthese (${item.perspectiveDetails.claim.slice(0, 85).trim()}) und dem strukturellen Einwand (${counterClaim.slice(0, 85).trim()})`
    );
    distractor1 = `In der Frage, ob kurzfristige Effizienzgewinne bei „${anchor}“ allein durch Deregulierung ohne institutionelle Leitplanken erreicht werden können.`;
    distractor2 = `In einem rein methodischen Streit über Messinstrumente, während über die normativen Zielsetzungen von „${anchor}“ bereits vollständige Einigkeit herrscht.`;
    distractor3 = `In der Annahme, dass historische Pfadabhängigkeiten bei „${anchor}“ gegenüber individuellen Präferenzen keinerlei erklärende Kraft mehr besitzen.`;
    explanation = `Der Beitrag zeigt, dass „${anchor}“ erst durch die Abwägung zwischen der Hauptthese und dem Gegenargument in seiner vollen Tragweite verständlich wird. Eine einseitige Verkürzung auf bloße Effizienz oder reine Methodik greift zu kurz.`;
  } else if (item.primaryTopic === 'philosophy_ethics' || item.primaryTopic === 'contemplation_mind') {
    questionText = `Welche erkenntnistheoretische oder ethische Konsequenz ergibt sich aus der Argumentation in „${title}“?`;
    correctOption = primaryClaim;
    distractor1 = `Urteilskraft entsteht bei „${anchor}“ primär durch die Maximierung kognitiver Verarbeitungsgeschwindigkeit statt durch bewusste begriffliche Differenzierung.`;
    distractor2 = `Normative Fragen rund um „${anchor}“ lassen sich vollständig in formale Nutzenkalküle auflösen, sobald genügend empirische Verhaltensdaten vorliegen.`;
    distractor3 = `Subjektive Aufmerksamkeit und institutionelle Rahmenbedingungen sind bei „${anchor}“ strikt voneinander getrennt und beeinflussen sich wechselseitig nicht.`;
    explanation = `Im Zentrum steht die Einsicht: ${primaryClaim} Philosophische Urteilskraft verlangt genau diese Differenzierung zwischen bloßer Reizverarbeitung und begründeter Erkenntnis.`;
  } else if (item.primaryTopic === 'ai_apple' || item.primaryTopic === 'sound_synthesis') {
    questionText = `Welcher systemische Zusammenhang prägt die technologische Einordnung von „${title}“?`;
    correctOption = primaryClaim;
    distractor1 = `Die Architektur von „${anchor}“ skaliert linear allein über zusätzliche Rechenleistung, ohne dass Schnittstellen-Design oder menschliche Kognition begrenzend wirken.`;
    distractor2 = `Neue Werkzeuge im Bereich „${anchor}“ ersetzen menschliche Kuratierung und Domänenkompetenz vollständig durch unüberwachte End-to-End-Automatisierung.`;
    distractor3 = `Die langfristige Qualität bei „${anchor}“ hängt ausschließlich von proprietären Algorithmen ab, nicht von offenen Standards oder der Güte der Trainings- und Ausgangsdaten.`;
    explanation = `Technologische Souveränität bei „${anchor}“ beruht auf dem Zusammenspiel aus Werkzeugarchitektur und bewusster menschlicher Steuerung: ${primaryClaim}`;
  } else if (item.primaryTopic === 'german_didactics') {
    questionText = `Welcher didaktische Transfer lässt sich aus der Analyse „${title}“ für Bildungsprozesse ableiten?`;
    correctOption = primaryClaim;
    distractor1 = `Komplexe Text- und Urteilskompetenz zu „${anchor}“ entwickelt sich am zuverlässigsten durch standardisierte Reproduktionsaufgaben ohne offenen Diskursraum.`;
    distractor2 = `Digitale Hilfsmittel im Umfeld von „${anchor}“ machen die eigenständige Begriffsbildung und Lektüre längerer Primärtexte didaktisch überflüssig.`;
    distractor3 = `Motivation und kognitive Tiefe im Unterricht hängen bei „${anchor}“ primär von kleinschrittiger Gamification ab, nicht von echten Problemstellungen.`;
    explanation = `Didaktisch entscheidend ist: ${primaryClaim} Nachhaltiges Lernen entsteht durch kognitive Aktivierung und diskursive Auseinandersetzung am konkreten Gegenstand.`;
  } else {
    questionText = `Welche strukturelle Kernaussage arbeitet der Beitrag „${title}“ heraus?`;
    correctOption = primaryClaim;
    distractor1 = `Die Entwicklungen rund um „${anchor}“ sind ein kurzfristiges Einzelphänomen ohne Rückkopplung an tiefere gesellschaftliche oder institutionelle Strukturen.`;
    distractor2 = `Bei „${anchor}“ reichen isolierte Einzelmaßnahmen vollkommen aus, da Zielkonflikte zwischen verschiedenen gesellschaftlichen Akteuren kaum auftreten.`;
    distractor3 = `Die empirischen Befunde zu „${anchor}“ belegen, dass externe Rahmenbedingungen gegenüber individuellen Einzelentscheidungen vernachlässigbar sind.`;
    explanation = `Der Beitrag verdeutlicht den strukturellen Kern: ${primaryClaim} Erst der Blick auf systemische Wechselwirkungen und Zielkonflikte ermöglicht eine fundierte Einordnung.`;
  }

  // Deterministic rotation so the correct answer is evenly distributed across A/B/C/D
  const options = [correctOption, distractor1, distractor2, distractor3];
  const shift = (title.length + (item.id.length || 0)) % 4;
  const rotatedOptions = [
    ...options.slice(shift),
    ...options.slice(0, shift)
  ];
  const correctIndex = rotatedOptions.indexOf(correctOption);

  return FeedQuizQuestionSchema.parse({
    id: `quiz-${item.id}`,
    question: questionText,
    options: rotatedOptions,
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

  if (!creds?.apiKey?.trim()) {
    return items.map(generateQuizForArticle);
  }

  const canSpend = await ledger.canSpend(0.002);
  if (!canSpend) {
    return items.map(generateQuizForArticle);
  }

  const systemInstruction = `Du bist ein sokratischer Erkenntnis- und Lern-Assistent für die souveräne Wissens-App ATMEN.
Erstelle für jeden übergebenen Beitrag GENAU 1 anspruchsvolle Multiple-Choice-Frage (Verständnis-, Struktur- oder Transferfrage).
STRIKTE QUALITÄTSREGELN:
1. NIEMALS triviale Metadaten-Fragen stellen (z. B. "Wer hat diesen Artikel veröffentlicht?", "Wie heißt die Quelle?").
2. NIEMALS alberne oder offensichtlich falsche Scherz-Optionen verwenden (z. B. "Es handelt sich um eine oberflächliche Sensationsmeldung").
3. Alle 4 Antwortoptionen (A, B, C, D) müssen sprachlich präzise, inhaltlich nuanciert und auf den ersten Blick plausibel klingen, sodass echtes Nachdenken über die Argumentation des Textes nötig ist.
4. Genau 1 Option ist richtig (correctIndex: 0 bis 3).
5. Liefere eine prägnante, kluge Erklärung (2 Sätze), warum diese Option zutrifft und worin der Denkfehler der plausiblen Alternativen liegt.
6. Sprache: Deutsch.
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
      credentials: creds,
      ledger,
      itemId: `quiz-batch-${Date.now()}`
    });

    const cleanedJson = response.text
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();
    const parsed = JSON.parse(cleanedJson);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const validated: FeedQuizQuestion[] = [];
      for (const rawQ of parsed) {
        const safe = FeedQuizQuestionSchema.safeParse(rawQ);
        if (safe.success && isPlausibleNonMetadataQuiz(safe.data)) {
          validated.push(safe.data);
        }
      }
      if (validated.length > 0) {
        return validated;
      }
    }
  } catch {
    // Fall back cleanly to deterministic conceptual synthesis
  }

  return items.map(generateQuizForArticle);
}
