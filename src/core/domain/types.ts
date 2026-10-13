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
  isVerified: z.boolean().default(true)
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

export const DeepeningOptionsSchema = z.object({
  didacticSeed: z.string().optional(),
  counterArgument: z.string().optional(),
  philosophicalContext: z.string().optional(),
  reflectionPrompt: z.string().optional()
});
export type DeepeningOptions = z.infer<typeof DeepeningOptionsSchema>;

export const FeedItemSchema = z.object({
  id: z.string(),
  type: ContentTypeSchema,
  title: z.string(),
  subtitle: z.string(),
  body: z.string(),
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
  score: z.number().optional() // computed dynamically by ranking engine
});
export type FeedItem = z.infer<typeof FeedItemSchema>;

export const ReadingPreferenceDurationSchema = z.enum(['all', 'quick', 'balanced', 'deep']);
export type ReadingPreferenceDuration = z.infer<typeof ReadingPreferenceDurationSchema>;

export const UserProfileSchema = z.object({
  language: z.enum(['de', 'en']).default('de'),
  region: z.enum(['de', 'eu', 'global']).default('de'),
  explicitInterests: z.record(TopicTagSchema, z.number().min(0).max(1)),
  readingPreferences: z.object({
    preferredDuration: ReadingPreferenceDurationSchema.default('balanced'),
    theme: z.enum(['system', 'light', 'dark']).default('system'),
    fontSize: z.enum(['sm', 'md', 'lg', 'xl']).default('md')
  }),
  isOnboarded: z.boolean().default(false),
  lastActiveDate: z.string().optional()
});
export type UserProfile = z.infer<typeof UserProfileSchema>;

export const ReadingInteractionSchema = z.object({
  itemId: z.string(),
  saved: z.boolean().default(false),
  savedAt: z.string().optional(),
  progressPercent: z.number().min(0).max(100).default(0),
  completedAt: z.string().optional(),
  feedback: z.enum(['more_like_this', 'less_like_this', 'neutral']).optional()
});
export type ReadingInteraction = z.infer<typeof ReadingInteractionSchema>;
