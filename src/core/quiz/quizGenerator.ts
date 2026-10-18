import { FeedItem, FeedQuizQuestion, FeedQuizQuestionSchema } from '../domain/types';
import { AiCredentials, callAiModel, loadAiCredentials } from '../ai/atmenAiClient';
import { EnrichmentUsageLedger, defaultUsageLedger } from '../enrichment/ledger';

/**
 * Deterministically generates a high-quality German comprehension or transfer question
 * based on an article's key insight, perspective details, or feed text.
 */
export function generateQuizForArticle(item: FeedItem): FeedQuizQuestion {
  const title = item.title.trim() || 'Diesen Beitrag';
  const insight = item.keyInsight?.trim() || item.subtitle?.trim() || item.feedText.slice(0, 160).trim();

  let questionText = '';
  let correctOption = '';
  let distractor1 = '';
  let distractor2 = '';
  let distractor3 = '';
  let explanation = '';

  if (item.perspectiveDetails?.claim && item.perspectiveDetails?.counterPerspective) {
    questionText = `Welcher dialektische Konflikt steht bei „${title}“ im Mittelpunkt?`;
    correctOption = `${item.perspectiveDetails.claim.slice(0, 110)} vs. ${item.perspectiveDetails.counterPerspective.slice(0, 110)}.`;
    distractor1 = 'Es handelt sich um einen rein formalen Konsens ohne konträre Positionen oder ethische Reibung.';
    distractor2 = 'Die Thematik wurde durch technologische Automatisierung bereits vollständig und widerspruchsfrei gelöst.';
    distractor3 = 'Weder These noch Antithese spielen eine Rolle; es geht ausschließlich um ökonomische Kennzahlen.';
    explanation = `Richtig! Der Beitrag beleuchtet das Spannungsfeld zwischen „${item.perspectiveDetails.claim.slice(0, 90)}“ und dem Einwand „${item.perspectiveDetails.counterPerspective.slice(0, 90)}“.`;
  } else if (item.primaryTopic === 'philosophy_ethics' || item.primaryTopic === 'contemplation_mind') {
    questionText = `Was ist die zentrale philosophische bzw. kontemplative Essenz von „${title}“?`;
    correctOption = insight.length > 15
      ? (insight.endsWith('.') ? insight : `${insight}.`)
      : 'Bewusste Entschleunigung und kritische Reflexion eigener Urteile.';
    distractor1 = 'Möglichst schnelle Reaktivität und unkritische Übernahme dominanter digitaler Meinungen.';
    distractor2 = 'Vollständige Vermeidung jeglicher Informationsaufnahme ohne kognitive Strukturierung.';
    distractor3 = 'Auslagerung sämtlicher Denkprozesse an automatisierte Feedback-Schleifen.';
    explanation = `Exakt! Die philosophische Kernaussage lautet: „${insight}“.`;
  } else if (item.primaryTopic === 'science_society' || item.primaryTopic === 'health_biohacking') {
    questionText = `Welche evidenzbasierte Erkenntnis hebt der Beitrag „${title}“ hervor?`;
    correctOption = insight.length > 15
      ? (insight.endsWith('.') ? insight : `${insight}.`)
      : 'Differenzierte wissenschaftliche Methodik und systemische Zusammenhänge.';
    distractor1 = 'Einzelne Anekdoten sind aussagekräftiger als reproduzierbare empirische Studien.';
    distractor2 = 'Kurzfristige Dopamin-Reize fördern langfristiges Wohlbefinden nachhaltiger als Ruhephasen.';
    distractor3 = 'Biologische und ökologische Systeme verhalten sich stets linear und isoliert voneinander.';
    explanation = `Korrekt! Wissenschaftlich fundiert: „${insight}“.`;
  } else {
    questionText = `Welche Kernaussage fasst den Beitrag „${title}“ am präzisesten zusammen?`;
    correctOption = insight.length > 15
      ? (insight.endsWith('.') ? insight : `${insight}.`)
      : `Substantieller Einblick in ${item.primaryTopic.replace('_', ' ')}.`;
    distractor1 = 'Es handelt sich um eine oberflächliche Sensationsmeldung ohne nachhaltigen Informationswert.';
    distractor2 = 'Der Kontext widerspricht allen bisherigen Erkenntnissen ohne Begründung.';
    distractor3 = 'Keine der Aussagen ist handlungsrelevant oder überprüfbar.';
    explanation = `Richtig gelöst! Der Kern lautet: „${insight}“.`;
  }

  // Shuffle options deterministically based on title length
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

  const systemInstruction = `Du bist ein didaktischer Lern-Assistent für die Bildungs-App Atmen.
Erstelle für die übergebenen Beiträge jeweils eine anspruchsvolle Multiple-Choice-Frage (Verständnis oder Transfer).
Regeln:
1. Genau 4 plausible Optionen pro Frage, keine offensichtlich absurden Scherz-Optionen.
2. Genau 1 korrekte Antwort (correctIndex: 0-3).
3. Eine verständliche, lernfördernde Erklärung (1-2 Sätze).
4. Sprache: Deutsch.
Antworte AUSSCHLIESSLICH als JSON-Array von Objekten mit den Feldern:
[
  {
    "id": "quiz-<articleId>",
    "question": "Fragestellung...",
    "options": ["A", "B", "C", "D"],
    "correctIndex": 0,
    "explanation": "Erklärung...",
    "sourceArticleId": "<articleId>",
    "sourceArticleTitle": "<articleTitle>"
  }
]`;

  const prompt = `Beiträge zum Testen:\n` + items.slice(0, 5).map(item => (
    `- ID: ${item.id}\n  Titel: ${item.title}\n  Thema: ${item.primaryTopic}\n  Kernaussage: ${item.keyInsight || item.feedText.slice(0, 200)}`
  )).join('\n\n');

  try {
    const response = await callAiModel(prompt, {
      systemInstruction,
      jsonMode: true,
      credentials: creds,
      ledger,
      itemId: `quiz-batch-${Date.now()}`
    });

    const parsed = JSON.parse(response.text);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const validated: FeedQuizQuestion[] = [];
      for (const rawQ of parsed) {
        const safe = FeedQuizQuestionSchema.safeParse(rawQ);
        if (safe.success) {
          validated.push(safe.data);
        }
      }
      if (validated.length > 0) {
        return validated;
      }
    }
  } catch {
    // Fall back cleanly to deterministic synthesis
  }

  return items.map(generateQuizForArticle);
}
