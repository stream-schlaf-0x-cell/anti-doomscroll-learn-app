import { z } from 'zod';

export const ContentTypeSchema = z.enum([
  'quick_insight',    // ~30-60 sec
  'briefing',         // ~1-3 min
  'deep_dive',        // ~4-8 min
  'perspective',      // philosophical dilemma / competing arguments
  'connection',       // interdisciplinary bridge
  'personal_update',  // project/followed topic
  'discovery'         // outside established preferences
]);
export type ContentType = z.infer<typeof ContentTypeSchema>;

export const TopicTagSchema = z.enum([
  'philosophy_ethics',   // Ethik & Erkenntnistheorie
  'german_didactics',    // Deutschunterricht & Fachdidaktik
  'ai_apple',            // KI-Systeme & Apple-Technologie
  'contemplation_mind',  // Buddhismus, Meditation & Kognition
  'science_society',     // Wissenschaft, Gesellschaft & Politik
  'sound_synthesis'      // Elektronische Musik & kreative Synthese
]);
export type TopicTag = z.infer<typeof TopicTagSchema>;

export const TOPIC_METADATA: Record<TopicTag, { label: string; icon: string; description: string }> = {
  philosophy_ethics: {
    label: 'Ethik & Philosophie',
    icon: 'compass-outline',
    description: 'Erkenntnistheorie, Moralphilosophie, Philosophie des Geistes & Existenzialismus'
  },
  german_didactics: {
    label: 'Didaktik & Schule',
    icon: 'school-outline',
    description: 'Deutschunterricht Sek. I, Lernpsychologie, Unterrichtskonzepte & Bildungspolitik'
  },
  ai_apple: {
    label: 'KI & Apple Ökosystem',
    icon: 'hardware-chip-outline',
    description: 'Emergente KI-Architekturen, Personal Computing, iOS & kreative Werkzeuge'
  },
  contemplation_mind: {
    label: 'Geist & Kontemplation',
    icon: 'leaf-outline',
    description: 'Buddhismus, Achtsamkeitspraxis, Neurokognition & kontemplative Psychologie'
  },
  science_society: {
    label: 'Wissenschaft & Ideen',
    icon: 'planet-outline',
    description: 'Naturwissenschaftliche Durchbrüche, Kulturphilosophie & gesellschaftliche Fragen'
  },
  sound_synthesis: {
    label: 'Klang & Synthese',
    icon: 'musical-notes-outline',
    description: 'Modulare Synthese, Sounddesign, Ambient, Ableton & algorithmische Komposition'
  }
};

export const SourceReferenceSchema = z.object({
  publisher: z.string(),
  originalUrl: z.string().url(),
  title: z.string(),
  publicationTimestamp: z.string().optional(),
  retrievalTimestamp: z.string(),
  author: z.string().optional(),
  isVerified: z.boolean().default(false)
});
export type SourceReference = z.infer<typeof SourceReferenceSchema>;

export const ContentStatusSchema = z.enum([
  'verified_fact',
  'scientific_analysis',
  'philosophical_perspective',
  'editorial_briefing',
  'demonstration_fixture'
]);
export type ContentStatus = z.infer<typeof ContentStatusSchema>;

export const FactReviewStatusSchema = z.enum([
  'curated_illustrative',     // Redaktionell kuratierte Beispieldaten
  'historical_reference',     // Historisch belegte Quelle/Analyse
  'pedagogical_concept',      // Fachdidaktisches Unterrichtskonzept
  'philosophical_discourse',  // Philosophischer Diskurs/Primärtext
  'scientific_paper'          // Wissenschaftliche Publikation
]);
export type FactReviewStatus = z.infer<typeof FactReviewStatusSchema>;

export function formatFactReviewStatus(status?: FactReviewStatus): string {
  switch (status) {
    case 'philosophical_discourse': return 'Philosophischer Primärdiskurs';
    case 'scientific_paper': return 'Fachwissenschaftliche Publikation';
    case 'pedagogical_concept': return 'Fachdidaktisches Unterrichtskonzept';
    case 'historical_reference': return 'Historische Quelle & Kontext';
    case 'curated_illustrative': return 'Redaktionelles Anschauungsbeispiel';
    default: return 'Redaktionell geprüft';
  }
}

export const DeepeningOptionsSchema = z.object({
  didacticSeed: z.string().optional(),
  counterArgument: z.string().optional(),
  philosophicalContext: z.string().optional(),
  reflectionPrompt: z.string().optional()
});
export type DeepeningOptions = z.infer<typeof DeepeningOptionsSchema>;

// Phase 2 Editorial Formats for rich in-feed reading
export const FeedItemFormatSchema = z.enum([
  'concise_insight',         // Kurzimpuls, in sich abgeschlossen
  'sourced_update',          // Aktuelle Entwicklung mit Quellenbeleg
  'creative_idea',           // Praktischer schöpferischer Impuls / Musik
  'intriguing_question',     // Denkfrage mit Erläuterung
  'surprising_connection',   // Unerwartete interdisziplinäre Brücke
  'perspective_disagreement',// Kontroverse, dialektischer Einwand
  'long_invitation'          // Einladung in vertiefende Langform
]);
export type FeedItemFormat = z.infer<typeof FeedItemFormatSchema>;

export function formatFeedItemFormat(format?: FeedItemFormat): string {
  switch (format) {
    case 'concise_insight': return '⚡︎ Kompaktimpuls';
    case 'sourced_update': return '◈ Recherche & Update';
    case 'creative_idea': return '💡 Kreativer Impuls';
    case 'intriguing_question': return '❓ Denkfrage';
    case 'surprising_connection': return '☍ Interdisziplinäre Brücke';
    case 'perspective_disagreement': return '✦ Philosophische Gegenposition';
    case 'long_invitation': return '📖 Vertiefender Essay';
    default: return '✦ Lese-Entdeckung';
  }
}

// Phase 2 Evidence Tiers
export const EvidenceTierSchema = z.enum([
  'metadata_only',        // Nur Titel/Link/Metadaten verfügbar
  'publisher_excerpt',    // Auszug / Abstract des Herausgebers
  'permitted_full_text',  // Genehmigter/öffentlicher Volltext
  'multiple_sources'      // Synthese aus mehreren belegten Quellen
]);
export type EvidenceTier = z.infer<typeof EvidenceTierSchema>;

export function formatEvidenceTier(tier?: EvidenceTier): string {
  switch (tier) {
    case 'permitted_full_text': return 'Volltext verfügbar';
    case 'multiple_sources': return 'Quellensynthese';
    case 'publisher_excerpt': return 'Herausgeber-Auszug';
    case 'metadata_only': return 'Quellnotiz';
    default: return 'Verifizierte Quelle';
  }
}

// Phase 2 Content Origin
export const ContentOriginSchema = z.enum([
  'live_ingested',    // Frisch aus verifizierten RSS/Atom-Quellen bezogen
  'enriched_ai',      // Quellgebunden mit KI didaktisch aufbereitet
  'demo_fixture'      // Kuratierte lokale Demonstrationsausgabe
]);
export type ContentOrigin = z.infer<typeof ContentOriginSchema>;

// Phase 2 Human Perspective Details
export const PerspectiveDetailsSchema = z.object({
  claim: z.string(),
  interpretation: z.string().optional(),
  prediction: z.string().optional(),
  counterPerspective: z.string().optional(),
  humanSource: z.string(), // Echter Autor, Experte oder Quelltext
  uncertaintyNote: z.string().optional()
});
export type PerspectiveDetails = z.infer<typeof PerspectiveDetailsSchema>;

export const FeedItemSchema = z.object({
  id: z.string(),
  type: ContentTypeSchema,
  format: FeedItemFormatSchema.default('concise_insight'),
  title: z.string(),
  subtitle: z.string(),
  feedText: z.string().default(''), // Standalone-Leseinhalt direkt auf der Feed-Karte
  articleBody: z.string().optional(), // Optionaler Langform-Text für den Reader
  body: z.string(), // Volltext / Reader-Inhalt (Abwärtskompatibilität)
  topics: z.array(TopicTagSchema).min(1),
  primaryTopic: TopicTagSchema,
  sourceReferences: z.array(SourceReferenceSchema),
  publishedAt: z.string(),
  updatedAt: z.string().optional(),
  generatedAt: z.string(),
  estimatedReadingMinutes: z.number().int().positive(),
  relevanceExplanation: z.string(),
  contentStatus: ContentStatusSchema,
  isDailyEdition: z.boolean().default(true),
  editionDate: z.string(),
  editorialNote: z.string().optional(),
  deepeningOptions: DeepeningOptionsSchema.optional(),
  score: z.number().optional(), // computed dynamically by ranking engine

  // Honest Editorial Provenance Metadata (Phase 1.1 / 1.2)
  isDemonstration: z.boolean().default(true),
  aiAssisted: z.boolean().default(true),
  factReviewStatus: FactReviewStatusSchema.default('curated_illustrative'),
  provenanceSummary: z.string(),
  wordCount: z.number().int().positive(),

  // Phase 2 Pipeline & Personalization Attributes
  evidenceTier: EvidenceTierSchema.default('publisher_excerpt'),
  contentOrigin: ContentOriginSchema.default('demo_fixture'),
  contentHash: z.string().default(''),
  canonicalUrl: z.string().url().optional(),
  isTeachingRelated: z.boolean().default(false),
  isChallengingPerspective: z.boolean().default(false),
  perspectiveDetails: PerspectiveDetailsSchema.optional(),
  imageUrl: z.string().url().optional(),

  // Atem Network & Social Discovery Additions
  space: z.string().optional(),
  flair: z.string().optional(),
  keyInsight: z.string().optional(),
  challengePrompt: z.string().optional(),
  didacticSeed: z.string().optional(),
  upvotesCount: z.number().int().default(42)
});
export type FeedItem = z.infer<typeof FeedItemSchema>;

export const TOPIC_SPACE_MAP: Record<TopicTag, {
  space: string;
  name: string;
  flair: string;
  icon: string;
  color: string;
  bgTint: string;
}> = {
  ai_apple: {
    space: 'c/acceleration',
    name: 'Frontier AI & Apple',
    flair: '⚡️ Frontier AI',
    icon: 'hardware-chip-outline',
    color: '#3B82F6',
    bgTint: 'rgba(59, 130, 246, 0.12)'
  },
  german_didactics: {
    space: 'c/didaktik_labor',
    name: 'Deutsch & Didaktik-Labor',
    flair: '🔬 Unterrichts-Labor',
    icon: 'school-outline',
    color: '#10B981',
    bgTint: 'rgba(16, 185, 129, 0.12)'
  },
  philosophy_ethics: {
    space: 'c/dialektik',
    name: 'Philosophie & Streitfragen',
    flair: '✦ Streitfrage',
    icon: 'compass-outline',
    color: '#8B5CF6',
    bgTint: 'rgba(139, 92, 246, 0.12)'
  },
  sound_synthesis: {
    space: 'c/synth_alchemie',
    name: 'Klangforschung & Modular',
    flair: '🎛 Klangforschung',
    icon: 'musical-notes-outline',
    color: '#F59E0B',
    bgTint: 'rgba(245, 158, 11, 0.12)'
  },
  contemplation_mind: {
    space: 'c/kontemplation',
    name: 'Geist & Kontemplation',
    flair: '🌿 Geist & Fokus',
    icon: 'leaf-outline',
    color: '#06B6D4',
    bgTint: 'rgba(6, 182, 212, 0.12)'
  },
  science_society: {
    space: 'c/serendipity',
    name: 'Filterblasen-Brecher',
    flair: '🔭 Serendipity',
    icon: 'planet-outline',
    color: '#EC4899',
    bgTint: 'rgba(236, 72, 153, 0.12)'
  }
};

export const ReadingPreferenceDurationSchema = z.enum(['all', 'quick', 'balanced', 'deep']);
export type ReadingPreferenceDuration = z.infer<typeof ReadingPreferenceDurationSchema>;

// Phase 2 Founder Goals
export const PersonalGoalSchema = z.enum([
  'understand_tech',         // KI- & Tech-Fortschritt tief verstehen
  'creative_music',          // Musikalische & schöpferische Projekte voranbringen
  'deepen_attention',        // Aufmerksamkeitsspanne & Lernpraxis stärken
  'philosophical_clarity',   // Philosophische Grundfragen durchdringen
  'society_and_ethics'       // Gesellschaftliche & ethische Fragen verstehen
]);
export type PersonalGoal = z.infer<typeof PersonalGoalSchema>;

export const PERSONAL_GOALS_METADATA: Record<PersonalGoal, { label: string; description: string }> = {
  understand_tech: {
    label: 'Technologie & KI verstehen',
    description: 'Frontier AI, Beschleunigung, emergente Architekturen und Personal Computing'
  },
  creative_music: {
    label: 'Kreativprojekte & Musik',
    description: 'Modulare Synthese, Sounddesign, Ambient und kreatives Schaffen'
  },
  deepen_attention: {
    label: 'Aufmerksamkeit & Lernpraxis',
    description: 'Achtsamkeit, Kontemplation, Kognitionswissenschaft und Didaktik'
  },
  philosophical_clarity: {
    label: 'Philosophische Tiefe',
    description: 'Erkenntnistheorie, Phänomenologie, Ethik und dialektisches Denken'
  },
  society_and_ethics: {
    label: 'Gesellschaft & Diskurs',
    description: 'Demokratie, Bildungspolitik, Medienökologie und zeitgenössische Kultur'
  }
};

export const UserProfileSchema = z.object({
  language: z.enum(['de', 'en']).default('de'),
  region: z.enum(['de', 'eu', 'global']).default('de'),
  explicitInterests: z.record(TopicTagSchema, z.number().min(0).max(1)),
  explicitGoals: z.record(z.string(), z.number().min(0).max(1)).default({
    understand_tech: 0.90,
    creative_music: 0.85,
    deepen_attention: 0.80,
    philosophical_clarity: 0.95,
    society_and_ethics: 0.75
  }),
  editorialTargets: z.object({
    teachingTargetRatio: z.number().min(0).max(1).default(0.10),
    challengingTargetRatio: z.number().min(0).max(1).default(0.10)
  }).default({
    teachingTargetRatio: 0.10,
    challengingTargetRatio: 0.10
  }),
  feedbackMemory: z.object({
    boostedTopics: z.record(z.string(), z.number()).default({}),
    penalizedTopics: z.record(z.string(), z.number()).default({}),
    boostedAuthors: z.record(z.string(), z.number()).default({}),
    penalizedAuthors: z.record(z.string(), z.number()).default({}),
    boostedKeywords: z.record(z.string(), z.number()).default({}),
    penalizedKeywords: z.record(z.string(), z.number()).default({})
  }).default({
    boostedTopics: {},
    penalizedTopics: {},
    boostedAuthors: {},
    penalizedAuthors: {},
    boostedKeywords: {},
    penalizedKeywords: {}
  }),
  behavioralSignals: z.object({
    recentOpenedIds: z.array(z.string()).default([]),
    recentSavedIds: z.array(z.string()).default([]),
    completedReadIds: z.array(z.string()).default([])
  }).default({
    recentOpenedIds: [],
    recentSavedIds: [],
    completedReadIds: []
  }),
  readingPreferences: z.object({
    preferredDuration: ReadingPreferenceDurationSchema.default('balanced'),
    theme: z.enum(['system', 'light', 'dark']).default('system'),
    fontSize: z.enum(['sm', 'md', 'lg', 'xl']).default('md')
  }),
  isOnboarded: z.boolean().default(false),
  lastActiveDate: z.string().optional()
});
export type UserProfile = z.infer<typeof UserProfileSchema>;

export const UserNoteSchema = z.object({
  id: z.string(),
  text: z.string(),
  createdAt: z.string(),
  tag: z.enum(['einwand', 'unterricht', 'these', 'notiz']).default('notiz')
});
export type UserNote = z.infer<typeof UserNoteSchema>;

export const ReadingInteractionSchema = z.object({
  itemId: z.string(),
  saved: z.boolean().default(false),
  savedAt: z.string().optional(),
  progressPercent: z.number().min(0).max(100).default(0), // resume position
  furthestPositionPercent: z.number().min(0).max(100).default(0), // furthest position reached
  completedAt: z.string().optional(),
  feedback: z.enum(['more_like_this', 'less_like_this', 'neutral']).optional(),
  userNotes: z.array(UserNoteSchema).default([]),
  voteScore: z.number().default(0) // +1 for upvote, -1 for downvote
});
export type ReadingInteraction = z.infer<typeof ReadingInteractionSchema>;

