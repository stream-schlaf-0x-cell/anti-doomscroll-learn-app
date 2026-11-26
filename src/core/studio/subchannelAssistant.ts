import { TopicTag } from '../domain/types';
import {
  AiCredentials,
  callAiModel,
  extractJsonFromAiResponse,
  hasAiConfiguration,
  loadAiCredentials
} from '../ai/atmenAiClient';
import { normalizeSpaceHandle } from '../spaces/spaceRepository';

export type SubchannelVibe = 'contemplation' | 'debate' | 'research' | 'visual' | 'tech';

export interface SubchannelVibeMeta {
  id: SubchannelVibe;
  label: string;
  icon: string;
  description: string;
  defaultTopic: TopicTag;
  accentColor: string;
}

export const SUBCHANNEL_VIBES: Record<SubchannelVibe, SubchannelVibeMeta> = {
  contemplation: {
    id: 'contemplation',
    label: '🌱 Inspiration & Kontemplation',
    icon: 'leaf-outline',
    description: 'Achtsamkeit, Meditation, Stoa & Geistesruhe',
    defaultTopic: 'contemplation_mind',
    accentColor: '#4B8E9D'
  },
  debate: {
    id: 'debate',
    label: '⚖️ Debatte & Streitfrage',
    icon: 'compass-outline',
    description: 'Dialektik, Erkenntnistheorie & ethischer Diskurs',
    defaultTopic: 'philosophy_ethics',
    accentColor: '#7E72B5'
  },
  research: {
    id: 'research',
    label: '🔬 Forschung & Praxis',
    icon: 'school-outline',
    description: 'Evidenz, Didaktik, Wissenschaft & Kognition',
    defaultTopic: 'german_didactics',
    accentColor: '#4D947A'
  },
  visual: {
    id: 'visual',
    label: '🎨 Visuell & Ästhetik',
    icon: 'color-palette-outline',
    description: 'Kunstsammlungen, Fotografie, Design & Architektur',
    defaultTopic: 'art_aesthetics',
    accentColor: '#B0855B'
  },
  tech: {
    id: 'tech',
    label: '🛠️ Tech & Craft',
    icon: 'hardware-chip-outline',
    description: 'Systeme, Deep Tech, Open Source & Audio-Alchemie',
    defaultTopic: 'ai_apple',
    accentColor: '#5282B8'
  }
};

export const STUDIO_QUICK_THEMES: readonly string[] = [
  'Erkenntnistheorie',
  'Bauhaus-Architektur',
  'Modulare Synthese',
  'Didaktik-Forschung',
  'Stoische Praxis',
  'Quantenphysik'
];

/**
 * Strips leading decorative emojis/variation selectors so flairs and vibe labels
 * render cleanly alongside single Ionicons in the UI.
 */
export function stripLeadingDecorativeEmoji(input: string): string {
  return (input || '')
    .replace(/^[\p{Extended_Pictographic}\uFE0F\u200D\s]+/gu, '')
    .trim();
}

export interface AiAssistedSubchannelDraft {
  suggestedTitle?: string;
  handle: string;
  flair: string;
  description: string;
  primaryTopic: TopicTag;
  seedSources: string[];
  accentColor: string;
  icon: string;
  suggestedAntithesis?: string;
  isAiGenerated: boolean;
}

/**
 * Deterministic Fallback Engine:
 * Generates tailored, high-signal subchannel parameters based on title keywords and selected vibe
 * when no LLM API key is present or offline.
 */
export function generateDeterministicSubchannelDraft(
  title: string,
  vibe?: SubchannelVibe
): AiAssistedSubchannelDraft {
  const cleanTitle = (title || '').trim();
  const lower = cleanTitle.toLowerCase();
  const handle = normalizeSpaceHandle(cleanTitle);

  // 1. Detect Vibe if not explicitly chosen
  let effectiveVibe: SubchannelVibe = vibe || 'contemplation';
  if (!vibe) {
    if (/\b(kunst|art|malerei|museum|foto|photo|architektur|bauhaus|design|galerie)\b/i.test(lower)) {
      effectiveVibe = 'visual';
    } else if (/\b(code|tech|rust|systems|ai|ki|software|linux|modular|audio|synth)\b/i.test(lower)) {
      effectiveVibe = 'tech';
    } else if (/\b(didaktik|schule|lernen|bildung|unterricht|studie|forschung|paper|science)\b/i.test(lower)) {
      effectiveVibe = 'research';
    } else if (/\b(ethik|moral|streit|debatte|politik|philosophie|kant|hegel|diskurs)\b/i.test(lower)) {
      effectiveVibe = 'debate';
    } else {
      effectiveVibe = 'contemplation';
    }
  }

  const meta = SUBCHANNEL_VIBES[effectiveVibe];

  // 2. Derive tailored flair, description and seed sources
  switch (effectiveVibe) {
    case 'visual':
      return {
        suggestedTitle: cleanTitle,
        handle,
        flair: `🎨 ${cleanTitle.slice(0, 18)}`,
        description: `Visuelle Kultur, Ästhetik und historische Primärwerke rund um ${cleanTitle}. Offene Museumssammlungen und Bildanalysen.`,
        primaryTopic: 'art_aesthetics',
        seedSources: ['artic.edu', 'metmuseum.org', 'publicdomainreview.org', 'rijksmuseum.nl'],
        accentColor: meta.accentColor,
        icon: meta.icon,
        suggestedAntithesis: `Inwiefern transformiert diese ästhetische Form unsere Wahrnehmung der Wirklichkeit?`,
        isAiGenerated: false
      };

    case 'tech':
      return {
        suggestedTitle: cleanTitle,
        handle,
        flair: `🛠️ ${cleanTitle.slice(0, 18)}`,
        description: `Technische Tiefenbohrungen, Systemarchitektur und handwerkliche Meisterschaft in ${cleanTitle}.`,
        primaryTopic: 'ai_apple',
        seedSources: ['arxiv.org', 'hackernews.com', 'lobste.rs', 'github.blog'],
        accentColor: meta.accentColor,
        icon: meta.icon,
        suggestedAntithesis: `Welche versteckte Komplexität oder systemische Fragilität wird hinter der eleganten Abstraktion übersehen?`,
        isAiGenerated: false
      };

    case 'research':
      return {
        suggestedTitle: cleanTitle,
        handle,
        flair: `🔬 ${cleanTitle.slice(0, 18)}`,
        description: `Evidenzbasierte Studien, kognitionswissenschaftliche Grundlagen und konkrete Praxistransfers zu ${cleanTitle}.`,
        primaryTopic: /\b(schule|didaktik|unterricht|bildung)\b/i.test(lower) ? 'german_didactics' : 'science_society',
        seedSources: ['visible-learning.org', 'nature.com', 'spektrum.de', 'edutopia.org'],
        accentColor: meta.accentColor,
        icon: meta.icon,
        suggestedAntithesis: `Welche methodische Grenze oder Replikationsunsicherheit schränkt die Übertragbarkeit dieser Befunde ein?`,
        isAiGenerated: false
      };

    case 'debate':
      return {
        suggestedTitle: cleanTitle,
        handle,
        flair: `⚖️ ${cleanTitle.slice(0, 18)}`,
        description: `Dialektische Streitfragen, erkenntnistheoretische Begründungen und werteorientierte Gegenperspektiven zu ${cleanTitle}.`,
        primaryTopic: 'philosophy_ethics',
        seedSources: ['plato.stanford.edu', 'aeon.co', 'faz.net', 'theatlantic.com'],
        accentColor: meta.accentColor,
        icon: meta.icon,
        suggestedAntithesis: `Welches stärkste ontologische oder ethische Gegenargument bringt diese Prämisse ins Wanken?`,
        isAiGenerated: false
      };

    case 'contemplation':
    default:
      return {
        suggestedTitle: cleanTitle,
        handle,
        flair: `🌱 ${cleanTitle.slice(0, 18)}`,
        description: `Achtsame Sammlung, kontemplative Praxis und philosophische Selbstreflexion im Themenraum ${cleanTitle}.`,
        primaryTopic: 'contemplation_mind',
        seedSources: ['plumvillage.org', 'tricycle.org', 'buddhistdoor.net', 'iep.utm.edu'],
        accentColor: meta.accentColor,
        icon: meta.icon,
        suggestedAntithesis: `Wo endet heilsame Geistesruhe und wo beginnt das Ausblenden der konkreten Weltverantwortung?`,
        isAiGenerated: false
      };
  }
}

/**
 * LLM-Powered Subchannel Assistant:
 * Uses Google Gemini or OpenRouter to synthesize rich descriptions, clean badges, and verified
 * seed sources based on a single topic input + optional vibe.
 */
export async function generateSubchannelDraft(
  title: string,
  vibe?: SubchannelVibe,
  overrideCredentials?: AiCredentials
): Promise<AiAssistedSubchannelDraft> {
  const cleanTitle = (title || '').trim();
  if (!cleanTitle) {
    return generateDeterministicSubchannelDraft('Neuer Raum', vibe);
  }

  const creds = overrideCredentials || (await loadAiCredentials());
  if (!hasAiConfiguration(creds)) {
    return generateDeterministicSubchannelDraft(cleanTitle, vibe);
  }

  const vibeLabel = vibe ? SUBCHANNEL_VIBES[vibe].label : 'Ausgewogene Erkenntnis';
  const prompt = `Du bist der Kognitive Kurator von "Atem" (dem AI-Native Feed gegen Doomscrolling).
Ein Nutzer möchte einen neuen Subchannel erstellen:
Titel: "${cleanTitle}"
Vibe / Tonalität: "${vibeLabel}"

Erstelle eine maßgeschneiderte Konfiguration für diesen Channel.
Regeln:
- Kein PR-Slop, keine Marketing-Floskeln ("Tauche ein in die faszinierende Welt...").
- Beschreibung: 1 bis maximal 2 prägnante, tiefgründige Sätze auf Deutsch.
- Handle: prägnanter lowercase c/... Identifier (z.B. c/geopolitik, c/literatur, c/kybernetik).
- Flair: kurzes 2-3 Wort Badge mit führendem Emoji (z.B. "🌱 Stoa & Zen", "⚡ Systems", "🏛️ Bauhaus").
- primaryTopic: wähle das exakteste aus: "philosophy_ethics", "german_didactics", "ai_apple", "contemplation_mind", "science_society", "sound_synthesis", "memes_satire", "youtube_gems", "book_mastery", "health_biohacking", "opportunities_growth", "art_aesthetics".
- seedSources: 2 bis 4 reale, seriöse Quellen-Domains (z.B. "plato.stanford.edu", "plumvillage.org", "arxiv.org", "artic.edu").
- suggestedAntithesis: eine scharfe sokratische Leitfrage, die blinde Flecken des Themas hinterfragt.

Antworte ausschließlich im JSON-Format:
{
  "handle": "c/...",
  "flair": "...",
  "description": "...",
  "primaryTopic": "...",
  "seedSources": ["...", "..."],
  "accentColor": "#...",
  "icon": "...",
  "suggestedAntithesis": "..."
}`;

  try {
    const res = await callAiModel(prompt, {
      jsonMode: true,
      maxTokens: 500,
      timeoutMs: 25_000,
      credentials: creds
    });

    const rawParsed = extractJsonFromAiResponse<unknown>(res.text);
    if (!rawParsed || typeof rawParsed !== 'object' || Array.isArray(rawParsed)) {
      throw new SyntaxError('Subchannel-Assistent lieferte kein gültiges JSON-Objekt.');
    }
    const parsed = rawParsed as Record<string, unknown>;
    const validTopics: TopicTag[] = [
      'philosophy_ethics',
      'german_didactics',
      'ai_apple',
      'contemplation_mind',
      'science_society',
      'sound_synthesis',
      'memes_satire',
      'youtube_gems',
      'book_mastery',
      'health_biohacking',
      'opportunities_growth',
      'art_aesthetics'
    ];

    const fallback = generateDeterministicSubchannelDraft(cleanTitle, vibe);
    const primaryTopic =
      typeof parsed.primaryTopic === 'string' && validTopics.includes(parsed.primaryTopic as TopicTag)
        ? (parsed.primaryTopic as TopicTag)
        : fallback.primaryTopic;

    const parsedHandle = typeof parsed.handle === 'string' ? parsed.handle : '';
    const parsedFlair = typeof parsed.flair === 'string' && parsed.flair.trim() ? parsed.flair : fallback.flair;
    const parsedDesc = typeof parsed.description === 'string' && parsed.description.trim()
      ? parsed.description
      : fallback.description;
    const parsedSeeds = Array.isArray(parsed.seedSources)
      ? parsed.seedSources.filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
      : [];

    return {
      suggestedTitle: typeof parsed.title === 'string' && parsed.title.trim() ? parsed.title.trim() : cleanTitle,
      handle: normalizeSpaceHandle(parsedHandle || cleanTitle),
      flair: parsedFlair.slice(0, 24),
      description: parsedDesc.slice(0, 300),
      primaryTopic,
      seedSources: parsedSeeds.length > 0 ? parsedSeeds.slice(0, 4) : fallback.seedSources,
      accentColor: typeof parsed.accentColor === 'string' && parsed.accentColor.startsWith('#')
        ? parsed.accentColor
        : fallback.accentColor,
      icon: typeof parsed.icon === 'string' && parsed.icon.trim() ? parsed.icon.trim() : fallback.icon,
      suggestedAntithesis:
        typeof parsed.suggestedAntithesis === 'string' && parsed.suggestedAntithesis.trim()
          ? parsed.suggestedAntithesis.trim()
          : fallback.suggestedAntithesis,
      isAiGenerated: true
    };
  } catch (err) {
    console.warn('generateSubchannelDraft error, falling back to deterministic:', err);
    return generateDeterministicSubchannelDraft(cleanTitle, vibe);
  }
}
