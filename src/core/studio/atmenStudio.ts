import { TopicTag } from '../domain/types';
import { AiCredentials, callAiModel, loadAiCredentials } from '../ai/atmenAiClient';
import { EnrichmentUsageLedger, defaultUsageLedger } from '../enrichment/ledger';

export type StudioLens = 'didactics' | 'contemplation' | 'sound_alchemy';

export interface StudioLensMeta {
  id: StudioLens;
  name: string;
  title: string;
  badge: string;
  description: string;
  icon: string;
}

export const STUDIO_LENSES: Record<StudioLens, StudioLensMeta> = {
  didactics: {
    id: 'didactics',
    name: 'Didaktik & Unterricht',
    title: 'Didaktik & Unterricht',
    badge: '🏫 Pädagogik & Schule',
    description: 'Didaktische Reduktion, Problemorientierung und handlungsorientierte Leitfragen.',
    icon: 'school-outline'
  },
  contemplation: {
    id: 'contemplation',
    name: 'Kontemplation & Stoa',
    title: 'Kontemplation & Stoa',
    badge: '🌿 Achtsamkeit & Philosophie',
    description: 'Philosophische Entschleunigung, Dichotomie der Kontrolle und mentale Klarheit.',
    icon: 'flower-outline'
  },
  sound_alchemy: {
    id: 'sound_alchemy',
    name: 'Klang-Alchemie & Synthese',
    title: 'Klang-Alchemie & Synthese',
    badge: '🎛️ Akustik & Sound Design',
    description: 'Akustische Erdung, Frequenzmodulation, Synthesizer-Patch-Ideen und Entschleunigung durch Hören.',
    icon: 'radio-outline'
  }
};

export const STUDIO_LENSES_LIST: StudioLensMeta[] = Object.values(STUDIO_LENSES);

export interface StudioRequest {
  lens: StudioLens;
  title: string;
  text: string;
  topic?: TopicTag;
  credentials?: AiCredentials;
  ledger?: EnrichmentUsageLedger;
}

export interface StudioOutput {
  lens: StudioLens;
  title: string;
  heading: string;
  coreThesis: string;
  insights: string[];
  reflectionQuestions: string[];
  practicalImpulse: string;
  formattedMarkdown: string;
  isAiGenerated: boolean;
  modelUsed?: string;
}

/**
 * Deterministic generator providing rich, profound outputs for all 3 lenses without external tokens.
 */
export function generateStudioOutputDeterministic(
  lens: StudioLens,
  title: string,
  text: string,
  _topic: TopicTag = 'philosophy_ethics'
): StudioOutput {
  const cleanTitle = title.trim() || 'Unbenannter Impuls';
  const snippet = text.slice(0, 180).trim() || 'Ein substantieller Gedanke für die Vertiefung.';

  if (lens === 'didactics') {
    const heading = `Didaktische Reduktion & Unterrichtstransfer: ${cleanTitle}`;
    const coreThesis = `Jeder digitale oder gesellschaftliche Wandel fordert die Urteilsbildung heraus: Nicht das passive Wissen zählt, sondern die methodische Einordnung.`;
    const insights = [
      `Didaktische Reduktion: Das Thema "${cleanTitle}" lässt sich im Ethik-, Philosophie- oder Deutschunterricht auf den Grundkonflikt zwischen Effizienz und menschlicher Autonomie zuspitzen.`,
      `Lebensweltbezug: Schüler:innen und Studierende sind täglich mit Algorithmen und Informationsfluten konfrontiert; dieses Beispiel bietet einen konkreten Anker zur Dekonstruktion von Mechanismen.`,
      `Differenzierung: Leistungsstarke Lernende analysieren Primärquellen und ethische Implikationen, während Grundlagenarbeitsphasen die Begriffsdefinition schärfen.`
    ];
    const reflectionQuestions = [
      `Welche Grundannahmen werden in "${cleanTitle}" als selbstverständlich vorausgesetzt – und wie lassen sich Gegenstimmen hörbar machen?`,
      `Inwiefern stärkt oder schwächt dieser Aspekt die kognitive Frustrationstoleranz und Urteilsfähigkeit junger Menschen?`,
      `Mit welcher handlungsorientierten Leitfrage können Lernende in eine sokratische Debatte einsteigen?`
    ];
    const practicalImpulse = `Unterrichtsaufgabe: Bildet ein Pro-und-Contra-Panel. Gruppe A verteidigt den technischen Fortschritt, Gruppe B die humanistische Entschleunigung. Schreibt ein 3-Punkte-Manifest für souveränes Handeln.`;

    const formattedMarkdown = `# ${heading}

> **Ausgangspunkt**: „${snippet}“
>
> **Kernüberlegung**: ${coreThesis}

## 🏫 Pädagogische & Didaktische Dimensionen
${insights.map(i => `- ${i}`).join('\n')}

## ❓ Sokratische Leitfragen für das Seminar
${reflectionQuestions.map((q, idx) => `${idx + 1}. ${q}`).join('\n')}

## 💡 Handlungsorientierter Praxisimpuls
${practicalImpulse}
`;

    return {
      lens,
      title: cleanTitle,
      heading,
      coreThesis,
      insights,
      reflectionQuestions,
      practicalImpulse,
      formattedMarkdown,
      isAiGenerated: false
    };
  }

  if (lens === 'contemplation') {
    const heading = `Stoische Kontemplation & Innere Ruhe: ${cleanTitle}`;
    const coreThesis = `Was uns verwirrt, sind nicht die Dinge an sich, sondern unsere Urteile über die Dinge (Epiktet).`;
    const insights = [
      `Dichotomie der Kontrolle: Die äußere Geschwindigkeit der Welt und der mediale Lärm liegen außerhalb deiner Macht. Deine Aufmerksamkeit und deine Reaktion gehören vollkommen dir.`,
      `Entschleunigung als Haltung: "${cleanTitle}" löst im ersten Moment Informationsdrang oder Reaktivität aus. Kontemplation verwandelt diesen Impuls in bewusstes Innehalten.`,
      `Memento Temporis: Zeit ist unser einziges wahres Gut. Jede Minute, die wir nicht dem Reaktionsrausch opfern, vertieft unser Denken.`
    ];
    const reflectionQuestions = [
      `Welcher Teil dieser Nachricht betrifft mein unmittelbares Handeln heute – und welcher Teil ist reines Hintergrundrauschen?`,
      `Wie würde ein stoischer Philosoph (Marc Aurel oder Seneca) auf diese Entwicklung reagieren, ohne in Zynismus zu verfallen?`,
      `Wo kann ich heute bewusst eine Pause einlegen, um meine Gedanken zu ordnen und tief durchzuatmen?`
    ];
    const practicalImpulse = `5-Minuten-Praxis: Schließe die Augen. Atme viermal im 4-7-8-Rhythmus ein und aus. Lass den Gedanken an "${cleanTitle}" wie eine Wolke am Himmel vorüberziehen, ohne danach zu greifen.`;

    const formattedMarkdown = `# ${heading}

> **Ausgangspunkt**: „${snippet}“
>
> **Stoische Maxime**: ${coreThesis}

## 🧘 Kontemplative Einordnung
${insights.map(i => `- ${i}`).join('\n')}

## 🏛️ Fragen zur Selbstprüfung
${reflectionQuestions.map((q, idx) => `${idx + 1}. ${q}`).join('\n')}

## 🍃 Achtsamkeits-Impuls für den Alltag
${practicalImpulse}
`;

    return {
      lens,
      title: cleanTitle,
      heading,
      coreThesis,
      insights,
      reflectionQuestions,
      practicalImpulse,
      formattedMarkdown,
      isAiGenerated: false
    };
  }

  // sound_alchemy
  const heading = `Klang-Alchemie & Akustische Resonanz: ${cleanTitle}`;
  const coreThesis = `Akustische Kontemplation schult dieselben Hirnareale wie tiefes Lesen: Vom Rauschen der Information zur Resonanz des Klangs.`;
  const insights = [
    `Synthesizer-Metapher: Betrachte die Hektik von "${cleanTitle}" als ungefilterten Sägezahn mit schneidenden Obertönen. Unsere Aufgabe ist es, den Tiefpassfilter behutsam auf 450 Hz zu senken.`,
    `Frequenzraum & Textur: Ein sanft drifter LFO moduliert das Stereopanorama. Was im Text als scharfer Konflikt erscheint, wird klanglich zu einer schwebenden Dissonanz, die sich langsam auflöst.`,
    `Akustische Erdung: Anstelle von digitaler Dauerbeschallung nutzen wir warme Sub-Bässe und Tape-Sättigung, um das Nervensystem zu beruhigen.`
  ];
  const reflectionQuestions = [
    `Welche Klangfarbe (Timbre) hat das Thema "${cleanTitle}" – kalt metallisch, analog warm oder wie eine verwehte Hallfahne?`,
    `Wie verändert sich meine Konzentration, wenn ich Hintergrundlärm durch einen monotonen 55-Hz-Grundton (A1) ersetze?`,
    `Kann ich beim Zuhören den Drang loslassen, sofort Worte finden zu müssen?`
  ];
  const practicalImpulse = `Patch-Idee: Nimm einen Moog- oder Buchla-Oszillator. Stimme Sinus und Dreieck leicht gegeneinander ab (2 Hz Beat Frequency). Drehe das Reverb auf 60% Wet und verweile 7 Minuten im puren Klang.`;

  const formattedMarkdown = `# ${heading}

> **Ausgangspunkt**: „${snippet}“
>
> **Klang-Philosophie**: ${coreThesis}

## 🎛️ Akustische Modulation & Sound Design
${insights.map(i => `- ${i}`).join('\n')}

## 🎧 Auditive Reflexionsfragen
${reflectionQuestions.map((q, idx) => `${idx + 1}. ${q}`).join('\n')}

## 🎹 Patch- & Hörpraxis
${practicalImpulse}
`;

  return {
    lens,
    title: cleanTitle,
    heading,
    coreThesis,
    insights,
    reflectionQuestions,
    practicalImpulse,
    formattedMarkdown,
    isAiGenerated: false
  };
}

export class AtmenStudioService {
  constructor(
    private readonly ledger: EnrichmentUsageLedger = defaultUsageLedger,
    private readonly credentialsLoader: () => Promise<AiCredentials> = loadAiCredentials
  ) {}

  /**
   * Generates a lens-specific reflection card, attempting BYOK AI first and falling back cleanly to deterministic synthesis.
   */
  async generateLensOutput(request: StudioRequest): Promise<StudioOutput> {
    const { lens, title, text, topic = 'philosophy_ethics' } = request;

    let credentials: AiCredentials | undefined = request.credentials;
    if (!credentials) {
      try {
        credentials = await this.credentialsLoader();
      } catch {
        credentials = undefined;
      }
    }

    if (!credentials?.apiKey?.trim()) {
      return generateStudioOutputDeterministic(lens, title, text, topic);
    }

    const ledger = request.ledger ?? this.ledger;
    const canSpend = await ledger.canSpend(0.002);
    if (!canSpend) {
      return generateStudioOutputDeterministic(lens, title, text, topic);
    }

    const lensMeta = STUDIO_LENSES[lens] || STUDIO_LENSES.contemplation;

    const systemInstruction = `Du bist der Meister des "Atmen Studio". Deine Aufgabe ist es, einen Gedanken oder Artikel durch eine von drei geistigen Linsen zu betrachten:
- 'didactics': Didaktische Reduktion für Schule/Seminare, sokratische Fragen, Handlungsimpulse.
- 'contemplation': Stoische Weisheit (Epiktet, Marc Aurel, Seneca), Entschleunigung, Dichotomie der Kontrolle.
- 'sound_alchemy': Sound-Design-Metapher (Synthesizer, Frequenzraum, Filter, Ambient), akustische Erdung.

Aktuelle Linse: ${lensMeta.name} (${lensMeta.description})
Sprache: Deutsch.
Antworte AUSSCHLIESSLICH im JSON-Format mit folgenden Feldern:
{
  "heading": "Prägnante Überschrift",
  "coreThesis": "Eine tiefe Kernthese in 1-2 Sätzen",
  "insights": ["3 tiefgründige Einsichten/Beobachtungen"],
  "reflectionQuestions": ["3 sokratische Fragen"],
  "practicalImpulse": "Ein konkreter Handlungs- oder Meditationsimpuls"
}`;

    const prompt = `Thema: ${title}\nInhalt: ${text.slice(0, 1500)}`;

    try {
      const response = await callAiModel(prompt, {
        systemInstruction,
        jsonMode: true,
        maxTokens: 1200,
        credentials,
        ledger,
        itemId: `studio-${lens}-${Date.now()}`
      });

      const parsed = JSON.parse(response.text);
      if (parsed && typeof parsed === 'object') {
        const heading = typeof parsed.heading === 'string' ? parsed.heading : `Atmen Studio: ${title}`;
        const coreThesis = typeof parsed.coreThesis === 'string' ? parsed.coreThesis : '';
        const insights = Array.isArray(parsed.insights) ? parsed.insights.filter((i: unknown) => typeof i === 'string') : [];
        const reflectionQuestions = Array.isArray(parsed.reflectionQuestions)
          ? parsed.reflectionQuestions.filter((q: unknown) => typeof q === 'string')
          : [];
        const practicalImpulse = typeof parsed.practicalImpulse === 'string' ? parsed.practicalImpulse : '';

        const formattedMarkdown = `# ${heading}

> **Kernüberlegung**: ${coreThesis}

## 🔍 Vertiefende Dimensionen
${insights.map((i: string) => `- ${i}`).join('\n')}

## ❓ Reflexionsfragen
${reflectionQuestions.map((q: string, idx: number) => `${idx + 1}. ${q}`).join('\n')}

## ✨ Konkreter Impuls
${practicalImpulse}
`;

        return {
          lens,
          title,
          heading,
          coreThesis,
          insights: insights.length > 0 ? insights : ['Tiefe Reflexion zur Thematik.'],
          reflectionQuestions: reflectionQuestions.length > 0 ? reflectionQuestions : ['Wie ordnest du diesen Gedanken ein?'],
          practicalImpulse: practicalImpulse || 'Verweile 5 Minuten in Stille.',
          formattedMarkdown,
          isAiGenerated: true,
          modelUsed: response.modelUsed
        };
      }
    } catch {
      // Fallback cleanly on API error
    }

    return generateStudioOutputDeterministic(lens, title, text, topic);
  }

  formatStudioOutputMarkdown(output: StudioOutput): string {
    return formatStudioOutputMarkdown(output);
  }
}

export function formatStudioOutputMarkdown(output: StudioOutput): string {
  if (output.formattedMarkdown) {
    return output.formattedMarkdown;
  }
  return `# ${output.heading}

> **Kernthese**: ${output.coreThesis}

## Erkenntnisse
${output.insights.map(i => `- ${i}`).join('\n')}

## Reflexions-Fragen
${output.reflectionQuestions.map((q, idx) => `${idx + 1}. ${q}`).join('\n')}

## Praktischer Impuls
${output.practicalImpulse}
`;
}

export const defaultAtmenStudioService = new AtmenStudioService();
