import { appStorage, AtemStorage } from '../data/storage';

export type ModelCategory =
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'music'
  | 'research'
  | 'embeddings'
  | 'robotics';

export type ModelStatus = 'stable' | 'preview' | 'experimental' | 'legacy';

export interface GeminiModelEntry {
  id: string;
  label: string;
  category: ModelCategory;
  status: ModelStatus;
  description: string;
  recommended: boolean;
  legacy: boolean;
  supportedMethods: ('generateContent' | 'generateImages' | 'generateVideos' | 'bidiStreaming' | 'embedContent' | 'research' | 'audio' | 'predict')[];
  contextWindow?: number;
  liveVerified?: boolean;
}

export const CATEGORY_LABELS: Record<ModelCategory, { label: string; icon: string; description: string }> = {
  text: {
    label: 'Text & Reasoning',
    icon: 'chatbubble-ellipses-outline',
    description: 'Dialektische Analyse, Kuration, Studio-Linsen & Wissens-Quizze'
  },
  image: {
    label: 'Bild-Generierung',
    icon: 'image-outline',
    description: 'Multimodale Visualisierungen, Begleitbilder & illustrative Graphiken'
  },
  video: {
    label: 'Video-Synthese',
    icon: 'videocam-outline',
    description: 'Cinematische Sequenzen, Ambient-Loops & visuelle Atemführungen'
  },
  audio: {
    label: 'Audio & Sprache',
    icon: 'mic-outline',
    description: 'Live-Streaming-Audio (VAD), Transkription & ausdrucksstarkes Vorlesen'
  },
  music: {
    label: 'Musik-Generierung',
    icon: 'musical-notes-outline',
    description: 'Harmonische Soundscapes, Frequenzmodulation & kontemplative Klangteppiche'
  },
  research: {
    label: 'Agenten & Recherche',
    icon: 'telescope-outline',
    description: 'Autonome Quellen-Triangulation, Literatur-Reviews & Epistemic Agenten'
  },
  embeddings: {
    label: 'Embeddings & Semantik',
    icon: 'git-network-outline',
    description: 'Semantische Vektoren für Clusterbildung und Ähnlichkeitssuche'
  },
  robotics: {
    label: 'Robotik & Spezial',
    icon: 'hardware-chip-outline',
    description: 'Räumliche Repräsentation und physikalische Aktions-Modelle'
  }
};

/**
 * Verified Official Google Gemini Model Catalog (October 18, 2026).
 * Source of truth: https://ai.google.dev/gemini-api/docs/models?hl=de
 */
export const GEMINI_MODEL_CATALOG: GeminiModelEntry[] = [
  // ================= TEXT / REASONING =================
  {
    id: 'gemini-4-argon',
    label: 'Gemini 4 Argon',
    category: 'text',
    status: 'experimental',
    description: 'Next-Gen Reasoning-Architektur für komplexe philosophische Dialektik und mehrstufige Ableitungen.',
    recommended: false,
    legacy: false,
    supportedMethods: ['generateContent'],
    contextWindow: 2097152
  },
  {
    id: 'gemini-3.8-flash',
    label: 'Gemini 3.8 Flash (Standard)',
    category: 'text',
    status: 'stable',
    description: 'Offizielles Google Produktions-Modell: Höchste Geschwindigkeit, exzellente Kuration, Studio-Linsen & Quizze.',
    recommended: true,
    legacy: false,
    supportedMethods: ['generateContent'],
    contextWindow: 1048576
  },
  {
    id: 'gemini-3.6-flash',
    label: 'Gemini 3.6 Flash',
    category: 'text',
    status: 'stable',
    description: 'Sehr hohe Durchsatzrate und ausgewogene kognitive Tiefe für alltägliche Informationsfilterung.',
    recommended: false,
    legacy: false,
    supportedMethods: ['generateContent'],
    contextWindow: 1048576
  },
  {
    id: 'gemini-3.5-flash-lite',
    label: 'Gemini 3.5 Flash-Lite',
    category: 'text',
    status: 'stable',
    description: 'Extrem sparsames Modell für blitzschnelle Signal-vs-Noise Extraktionen und Metadaten-Normalisierung.',
    recommended: true,
    legacy: false,
    supportedMethods: ['generateContent'],
    contextWindow: 524288
  },
  {
    id: 'gemini-3.1-flash-lite',
    label: 'Gemini 3.1 Flash-Lite',
    category: 'text',
    status: 'stable',
    description: 'Kompaktes Modell mit minimalem Token-Fußabdruck für leichtgewichtige Vorsortierung.',
    recommended: false,
    legacy: false,
    supportedMethods: ['generateContent'],
    contextWindow: 524288
  },
  {
    id: 'gemini-3.1-pro-preview',
    label: 'Gemini 3.1 Pro Preview',
    category: 'text',
    status: 'preview',
    description: 'Maximale analytische Tiefe für sokratisches Sparring, didaktische Curricula und epistemische Synthese.',
    recommended: true,
    legacy: false,
    supportedMethods: ['generateContent'],
    contextWindow: 2097152
  },
  {
    id: 'gemini-3-flash-preview',
    label: 'Gemini 3 Flash Preview',
    category: 'text',
    status: 'preview',
    description: 'Frühe Vorschauversion der Gemini 3 Architektur.',
    recommended: false,
    legacy: false,
    supportedMethods: ['generateContent'],
    contextWindow: 1048576
  },

  // ================= IMAGE GENERATION =================
  {
    id: 'gemini-nano-banana-2.1',
    label: 'Nano Banana 2.1',
    category: 'image',
    status: 'stable',
    description: 'Modernste multimodale Bildsynthese mit hoher typographischer und ästhetischer Genauigkeit.',
    recommended: true,
    legacy: false,
    supportedMethods: ['generateImages', 'generateContent']
  },
  {
    id: 'gemini-3.1-flash-image',
    label: 'Nano Banana 2',
    category: 'image',
    status: 'stable',
    description: 'Schnelle Bildgenerierung für redaktionelle Begleitgraphiken und Artikel-Vignetten.',
    recommended: false,
    legacy: false,
    supportedMethods: ['generateImages', 'generateContent']
  },
  {
    id: 'gemini-3.1-flash-lite-image',
    label: 'Nano Banana 2 Lite',
    category: 'image',
    status: 'stable',
    description: 'Leichtgewichtige Bildgenerierung für schnelle visuelle Entwürfe und Thumbnails.',
    recommended: false,
    legacy: false,
    supportedMethods: ['generateImages']
  },
  {
    id: 'gemini-3-pro-image',
    label: 'Nano Banana Pro',
    category: 'image',
    status: 'preview',
    description: 'Professionelle High-Fidelity-Bildsynthese für tiefgreifende Bildwelten und Kunst-Impulse.',
    recommended: true,
    legacy: false,
    supportedMethods: ['generateImages']
  },

  // ================= VIDEO GENERATION =================
  {
    id: 'veo-3.1-generate-preview',
    label: 'Veo 3.1',
    category: 'video',
    status: 'preview',
    description: 'Cinematische Videogenerierung mit physikalischer Kohärenz und Kamerasteuerung.',
    recommended: true,
    legacy: false,
    supportedMethods: ['generateVideos']
  },
  {
    id: 'veo-3.1-lite-generate-preview',
    label: 'Veo 3.1 Lite',
    category: 'video',
    status: 'preview',
    description: 'Schnellere Videovorschau für meditative Hintergrundschleifen und Rhythmen.',
    recommended: false,
    legacy: false,
    supportedMethods: ['generateVideos']
  },
  {
    id: 'gemini-omni-1.1-flash',
    label: 'Gemini Omni Flash',
    category: 'video',
    status: 'stable',
    description: 'Echtzeit-Videoverarbeitung, Turn-by-Turn-Editing und audiosynchrone Animationen.',
    recommended: true,
    legacy: false,
    supportedMethods: ['generateVideos', 'generateContent']
  },

  // ================= AUDIO / SPEECH =================
  {
    id: 'gemini-3.8-live',
    label: 'Gemini 3.8 Live',
    category: 'audio',
    status: 'stable',
    description: 'Bidirektionales Audio-Streaming mit natürlicher Sprachaktivitäts-Erkennung (VAD).',
    recommended: true,
    legacy: false,
    supportedMethods: ['bidiStreaming', 'audio']
  },
  {
    id: 'gemini-3.8-live-extended-thinking',
    label: 'Gemini 3.8 Live Extended Thinking',
    category: 'audio',
    status: 'preview',
    description: 'Echtzeit-Audio mit Hintergrund-Reflexion für tiefgründige sokratische Gespräche.',
    recommended: true,
    legacy: false,
    supportedMethods: ['bidiStreaming', 'audio']
  },
  {
    id: 'gemini-3.8-flash-tts',
    label: 'Gemini 3.8 Flash TTS',
    category: 'audio',
    status: 'stable',
    description: 'Natürliche, ausdrucksstarke Text-zu-Sprache-Synthese für Artikel-Vorlesefunktionen.',
    recommended: true,
    legacy: false,
    supportedMethods: ['audio']
  },
  {
    id: 'gemini-3.8-flash-lite-tts',
    label: 'Gemini 3.8 Flash-Lite TTS',
    category: 'audio',
    status: 'stable',
    description: 'Niedriglatente Sprachausgabe für kurze Audio-Impulse und Zitate.',
    recommended: false,
    legacy: false,
    supportedMethods: ['audio']
  },
  {
    id: 'gemini-3.5-transcribe',
    label: 'Gemini 3.5 Transcribe',
    category: 'audio',
    status: 'stable',
    description: 'Präzise Sprachtranskription mit Zeitstempelmarkern und Sprecherunterscheidung.',
    recommended: true,
    legacy: false,
    supportedMethods: ['audio', 'generateContent']
  },
  {
    id: 'gemini-3.5-transcribe-live',
    label: 'Gemini 3.5 Transcribe Live',
    category: 'audio',
    status: 'preview',
    description: 'Laufende Live-Transkription für Mitschnitte und Gedankennotizen.',
    recommended: false,
    legacy: false,
    supportedMethods: ['bidiStreaming', 'audio']
  },
  {
    id: 'gemini-3.5-live-translate-preview',
    label: 'Gemini 3.5 Live Translate Preview',
    category: 'audio',
    status: 'preview',
    description: 'Direkte simultane Sprachübersetzung bei minimaler Latenz.',
    recommended: false,
    legacy: false,
    supportedMethods: ['bidiStreaming', 'audio']
  },

  // ================= MUSIC GENERATION =================
  {
    id: 'lyria-3.5',
    label: 'Lyria 3.5',
    category: 'music',
    status: 'stable',
    description: 'Vollständige musikalische Komposition für kontemplative Klangreisen und Fokus-Phasen.',
    recommended: true,
    legacy: false,
    supportedMethods: ['audio']
  },
  {
    id: 'lyria-3-clip-preview',
    label: 'Lyria 3 Clip Preview',
    category: 'music',
    status: 'preview',
    description: 'Kurze akustische Ambient-Loops und Glockenimpulse für Atemübergänge.',
    recommended: false,
    legacy: false,
    supportedMethods: ['audio']
  },
  {
    id: 'lyria-3-pro-preview',
    label: 'Lyria 3 Pro Preview',
    category: 'music',
    status: 'preview',
    description: 'Mehrspurige Synthese mit feiner Kontrolle über Timbre, Filter und Raumakustik.',
    recommended: true,
    legacy: false,
    supportedMethods: ['audio']
  },
  {
    id: 'lyria-realtime-exp',
    label: 'Lyria RealTime Experimental',
    category: 'music',
    status: 'experimental',
    description: 'Interaktive, sich synchron zum Atemrhythmus anpassende Klanglandschaften.',
    recommended: false,
    legacy: false,
    supportedMethods: ['bidiStreaming', 'audio']
  },

  // ================= AGENTS / RESEARCH =================
  {
    id: 'deep-research-preview-04-2026',
    label: 'Gemini Deep Research',
    category: 'research',
    status: 'preview',
    description: 'Autonome Quellen-Triangulation, Literatur-Recherchen und Evidenz-Überprüfung.',
    recommended: true,
    legacy: false,
    supportedMethods: ['research']
  },
  {
    id: 'deep-research-max-preview-04-2026',
    label: 'Gemini Deep Research Max',
    category: 'research',
    status: 'preview',
    description: 'Umfassende wissenschaftliche Synthese mit formalen Quellennachweisen und Gegenargumenten.',
    recommended: true,
    legacy: false,
    supportedMethods: ['research']
  },
  {
    id: 'antigravity-preview-09-2026',
    label: 'Antigravity Agent',
    category: 'research',
    status: 'preview',
    description: 'Autonomer agentischer Partner für Systemdesign, Code-Reflexion und Workflow-Automatisierung.',
    recommended: false,
    legacy: false,
    supportedMethods: ['research', 'generateContent']
  },

  // ================= EMBEDDINGS =================
  {
    id: 'gemini-embedding-2-preview',
    label: 'Gemini Embedding 2',
    category: 'embeddings',
    status: 'preview',
    description: 'Hochdimensionale semantische Vektoren für epistemische Clusteranalyse und Wissensnetze.',
    recommended: true,
    legacy: false,
    supportedMethods: ['embedContent']
  },
  {
    id: 'gemini-embedding-001',
    label: 'Gemini Embedding',
    category: 'embeddings',
    status: 'stable',
    description: 'Bewährtes Produktions-Embedding für Textvergleiche und Ähnlichkeitssuche.',
    recommended: false,
    legacy: false,
    supportedMethods: ['embedContent']
  },

  // ================= ROBOTICS / SPECIALIZED =================
  {
    id: 'gemini-robotics-er-2-preview',
    label: 'Gemini Robotics ER 2',
    category: 'robotics',
    status: 'preview',
    description: 'Spezialmodell für räumliche Wahrnehmung und physikalisches Weltverständnis.',
    recommended: false,
    legacy: false,
    supportedMethods: ['predict']
  },
  {
    id: 'gemini-robotics-er-1.6-preview',
    label: 'Gemini Robotics ER 1.6',
    category: 'robotics',
    status: 'preview',
    description: 'Kompakte physikalische Aktions- und Orientierungs-Modelle.',
    recommended: false,
    legacy: false,
    supportedMethods: ['predict']
  },

  // ================= LEGACY MODELS (Hidden by default) =================
  {
    id: 'gemini-2.5-pro',
    label: 'Gemini 2.5 Pro (Vorgänger)',
    category: 'text',
    status: 'legacy',
    description: 'Früheres Flaggschiff-Modell für tiefes logisches Reasoning (Gemini 2.5 Pro).',
    recommended: false,
    legacy: true,
    supportedMethods: ['generateContent']
  },
  {
    id: 'gemini-2.5-flash',
    label: 'Gemini 2.5 Flash (Vorgänger)',
    category: 'text',
    status: 'legacy',
    description: 'Früheres Produktions-Modell (Gemini 2.5 Flash). Zuverlässiger Fallback.',
    recommended: false,
    legacy: true,
    supportedMethods: ['generateContent']
  },
  {
    id: 'gemini-2.5-flash-lite',
    label: 'Gemini 2.5 Flash-Lite (Vorgänger)',
    category: 'text',
    status: 'legacy',
    description: 'Früheres Leichtgewicht-Modell für einfache Filteraufgaben.',
    recommended: false,
    legacy: true,
    supportedMethods: ['generateContent']
  },
  {
    id: 'gemini-2.5-flash-image',
    label: 'Gemini 2.5 Flash Image (Vorgänger)',
    category: 'image',
    status: 'legacy',
    description: 'Früheres Bildgenerierungs-Modell.',
    recommended: false,
    legacy: true,
    supportedMethods: ['generateImages']
  },
  {
    id: 'gemini-2.5-flash-native-audio-preview-12-2025',
    label: 'Gemini 2.5 Native Audio Preview',
    category: 'audio',
    status: 'legacy',
    description: 'Frühes nativer Audio-Preview Stand Ende 2025.',
    recommended: false,
    legacy: true,
    supportedMethods: ['audio']
  },
  {
    id: 'gemini-2.5-flash-preview-tts',
    label: 'Gemini 2.5 Flash TTS Preview',
    category: 'audio',
    status: 'legacy',
    description: 'Früher Sprachgenerierungs-Preview.',
    recommended: false,
    legacy: true,
    supportedMethods: ['audio']
  },
  {
    id: 'gemini-2.5-pro-preview-tts',
    label: 'Gemini 2.5 Pro TTS Preview',
    category: 'audio',
    status: 'legacy',
    description: 'Früher Pro-Sprachgenerierungs-Preview.',
    recommended: false,
    legacy: true,
    supportedMethods: ['audio']
  },
  {
    id: 'gemini-3.1-flash-live-preview',
    label: 'Gemini 3.1 Flash Live Preview',
    category: 'audio',
    status: 'legacy',
    description: 'Früher Live-Audio-Streaming-Preview (ersetzt durch 3.8 Live).',
    recommended: false,
    legacy: true,
    supportedMethods: ['bidiStreaming', 'audio']
  },
  {
    id: 'gemini-3.1-flash-tts-preview',
    label: 'Gemini 3.1 Flash TTS Preview',
    category: 'audio',
    status: 'legacy',
    description: 'Früher 3.1 Sprachausgabe-Preview (ersetzt durch 3.8 Flash TTS).',
    recommended: false,
    legacy: true,
    supportedMethods: ['audio']
  }
];

export const DISCONTINUED_MODEL_IDS = new Set<string>([
  'gemini-2.0-flash',
  'gemini-3-pro-preview'
]);
export const DISCONTINUED_GEMINI_MODEL_IDS = DISCONTINUED_MODEL_IDS;

export const OFFICIAL_GEMINI_MODELS = GEMINI_MODEL_CATALOG;
export const DEFAULT_GEMINI_TEXT_MODEL = 'gemini-3.8-flash';

export function findGeminiModel(
  modelId: string,
  catalog: GeminiModelEntry[] = GEMINI_MODEL_CATALOG
): GeminiModelEntry | undefined {
  return catalog.find(m => m.id === modelId);
}

export const DISCOVERY_STORAGE_KEY = '@atem:discovered_gemini_models:v1';

export interface DiscoveryCache {
  timestamp: string;
  models: GeminiModelEntry[];
  accountVerified: boolean;
}

/**
 * Filter models for a specific workflow (e.g. text generation vs audio).
 */
export function filterModelsForWorkflow(
  workflow: ModelCategory | 'all',
  includeLegacy = false,
  catalog: GeminiModelEntry[] = GEMINI_MODEL_CATALOG
): GeminiModelEntry[] {
  return catalog.filter(m => {
    // Exclude discontinued models unconditionally
    if (DISCONTINUED_MODEL_IDS.has(m.id)) return false;
    // Handle legacy filtering
    if (m.legacy && !includeLegacy) return false;
    // Category match
    if (workflow === 'all') return true;
    return m.category === workflow;
  });
}

/**
 * Checks if a model ID is compatible with a given workflow category.
 */
export function isModelCompatibleWithWorkflow(
  modelId: string,
  workflow: ModelCategory,
  catalog: GeminiModelEntry[] = GEMINI_MODEL_CATALOG
): boolean {
  const model = catalog.find(m => m.id === modelId);
  if (!model) {
    // If unknown model string (e.g. custom user model), allow it for text workflows if not obviously non-text
    return workflow === 'text';
  }
  if (workflow === 'text') {
    return model.category === 'text' || model.supportedMethods.includes('generateContent');
  }
  return model.category === workflow;
}

/**
 * Validates a model choice for the requested workflow.
 */
export function validateModelChoice(
  modelId: string,
  workflow: ModelCategory,
  catalog: GeminiModelEntry[] = GEMINI_MODEL_CATALOG
): { valid: boolean; reason?: string; suggestedModelId?: string } {
  if (DISCONTINUED_MODEL_IDS.has(modelId)) {
    return {
      valid: false,
      reason: `Das Modell „${modelId}“ wurde dauerhaft eingestellt (discontinued) und ist nicht mehr verfügbar.`,
      suggestedModelId: 'gemini-3.8-flash'
    };
  }

  const model = catalog.find(m => m.id === modelId);
  if (!model) {
    return {
      valid: true // Custom model allowed
    };
  }

  if (!isModelCompatibleWithWorkflow(modelId, workflow, catalog)) {
    return {
      valid: false,
      reason: `„${model.label}“ ist ein ${CATEGORY_LABELS[model.category]?.label || model.category}-Modell und nicht mit dem Workflow „${CATEGORY_LABELS[workflow]?.label || workflow}“ kompatibel.`,
      suggestedModelId: workflow === 'text' ? 'gemini-3.8-flash' : undefined
    };
  }

  return { valid: true };
}

/**
 * Dynamically queries Google's official Models API (GET /v1beta/models) to discover
 * which models are available and verified for the user's API key.
 *
 * Implements pagination via nextPageToken, rate-limit safety, and merges live
 * availability with the curated metadata catalog.
 */
export async function discoverLiveGeminiModels(
  apiKey?: string,
  options: { forceRefresh?: boolean; storage?: AtemStorage } = {}
): Promise<{
  models: GeminiModelEntry[];
  accountVerified: boolean;
  fromCache: boolean;
  error?: string;
}> {
  const storage = options.storage ?? appStorage;

  // 1. Check cache first if not forced
  if (!options.forceRefresh) {
    try {
      const raw = await storage.getItem(DISCOVERY_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as DiscoveryCache;
        const cacheAgeMs = Date.now() - new Date(parsed.timestamp).getTime();
        // Cache valid for 30 minutes
        if (cacheAgeMs < 30 * 60 * 1000 && Array.isArray(parsed.models) && parsed.models.length > 0) {
          return {
            models: parsed.models,
            accountVerified: parsed.accountVerified,
            fromCache: true
          };
        }
      }
    } catch {
      // Ignore cache reading error
    }
  }

  // 2. If no API key provided, return curated catalog as offline fallback
  const cleanKey = apiKey?.trim();
  if (!cleanKey) {
    return {
      models: GEMINI_MODEL_CATALOG.map(m => ({ ...m, liveVerified: false })),
      accountVerified: false,
      fromCache: false
    };
  }

  // 3. Fetch from Google Models API with pagination handling
  try {
    const discoveredIds = new Set<string>();
    const discoveredRaw: {
      name?: string;
      displayName?: string;
      description?: string;
      supportedGenerationMethods?: string[];
    }[] = [];

    let pageToken: string | undefined = undefined;
    let pageCount = 0;
    const maxPages = 5; // Guard against infinite pagination loops

    do {
      pageCount++;
      const url = new URL('https://generativelanguage.googleapis.com/v1beta/models');
      url.searchParams.set('key', cleanKey);
      url.searchParams.set('pageSize', '100');
      if (pageToken) {
        url.searchParams.set('pageToken', pageToken);
      }

      const res = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Google Models API Fehler (${res.status}): ${errText.slice(0, 200)}`);
      }

      const data = await res.json();
      if (Array.isArray(data?.models)) {
        for (const item of data.models) {
          const rawId = (item.name || '').replace(/^models\//, '').trim();
          if (rawId) {
            discoveredIds.add(rawId);
            discoveredRaw.push(item);
          }
        }
      }

      pageToken = typeof data?.nextPageToken === 'string' && data.nextPageToken ? data.nextPageToken : undefined;
    } while (pageToken && pageCount < maxPages);

    // 4. Merge discovered models with curated catalog
    const mergedList: GeminiModelEntry[] = [];

    // Add all curated catalog models, updating liveVerified flag
    for (const catalogItem of GEMINI_MODEL_CATALOG) {
      const isAvailableInAccount = discoveredIds.has(catalogItem.id);
      mergedList.push({
        ...catalogItem,
        liveVerified: isAvailableInAccount
      });
    }

    // Add any unknown models discovered from API that aren't in our curated catalog yet
    for (const raw of discoveredRaw) {
      const rawId = (raw.name || '').replace(/^models\//, '').trim();
      if (!rawId || DISCONTINUED_MODEL_IDS.has(rawId)) continue;

      const alreadyMerged = mergedList.some(m => m.id === rawId);
      if (!alreadyMerged) {
        // Infer category from supported generation methods
        const methods = raw.supportedGenerationMethods || [];
        let category: ModelCategory = 'text';
        if (methods.some(m => m.toLowerCase().includes('image'))) {
          category = 'image';
        } else if (methods.some(m => m.toLowerCase().includes('video'))) {
          category = 'video';
        } else if (methods.some(m => m.toLowerCase().includes('embed'))) {
          category = 'embeddings';
        } else if (methods.some(m => m.toLowerCase().includes('audio') || m.toLowerCase().includes('bidi'))) {
          category = 'audio';
        }

        mergedList.push({
          id: rawId,
          label: raw.displayName || rawId,
          category,
          status: 'preview',
          description: raw.description || `Live verifiziertes Gemini Modell (${rawId})`,
          recommended: false,
          legacy: false,
          supportedMethods: methods as any,
          liveVerified: true
        });
      }
    }

    // 5. Cache result
    const cachePayload: DiscoveryCache = {
      timestamp: new Date().toISOString(),
      models: mergedList,
      accountVerified: true
    };
    await storage.setItem(DISCOVERY_STORAGE_KEY, JSON.stringify(cachePayload));

    return {
      models: mergedList,
      accountVerified: true,
      fromCache: false
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    // Return curated catalog as fallback
    return {
      models: GEMINI_MODEL_CATALOG.map(m => ({ ...m, liveVerified: false })),
      accountVerified: false,
      fromCache: false,
      error: errorMsg
    };
  }
}
