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
  'sound_synthesis',     // Elektronische Musik & kreative Synthese
  'memes_satire',        // High-IQ Memes, Tech- & Philosophie-Satire
  'youtube_gems',        // Kuratierte Video-Essays & Deep Dives
  'book_mastery',        // Buch-Empfehlungen & Erkenntnis-Kompression
  'health_biohacking',   // Schlaf, Neuroplastizität, Fokus & Longevity
  'opportunities_growth', // Karriere-Hebel, Open-Source & Stipendien
  'art_aesthetics'       // Malerei, Fotografie, Architektur & visuelle Kultur
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
  },
  memes_satire: {
    label: 'Memes & Satire',
    icon: 'happy-outline',
    description: 'High-IQ Tech- & Philosophie-Memes, Internetkultur & sokratische Satire'
  },
  youtube_gems: {
    label: 'YouTube Gems',
    icon: 'play-circle-outline',
    description: 'Kuratierte Video-Essays (Veritasium, 3Blue1Brown, Kurzgesagt, Huberman)'
  },
  book_mastery: {
    label: 'Buch-Empfehlungen',
    icon: 'book-outline',
    description: 'Geistig transformative Sachbücher mit Kern-Thesen und Praxis-Lektionen'
  },
  health_biohacking: {
    label: 'Gesundheit & Fokus',
    icon: 'fitness-outline',
    description: 'Evidenzbasierter Schlaf, Neurokognition, Atemprotokolle & Biohacking'
  },
  opportunities_growth: {
    label: 'Chancen & Hebel',
    icon: 'trending-up-outline',
    description: 'Stipendien, AI Builder Grants, Open Source Projekte & Hebelpotenziale'
  },
  art_aesthetics: {
    label: 'Kunst & Ästhetik',
    icon: 'color-palette-outline',
    description: 'Malerei, Fotografie, Architektur & visuelle Philosophie aus offenen Museumssammlungen'
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
  'curated_illustrative',     // Redaktionell kuratierte Beispieldaten / RSS-Auszug
  'historical_reference',     // Historisch belegte Quelle/Analyse
  'pedagogical_concept',      // Fachdidaktisches Unterrichtskonzept
  'philosophical_discourse',  // Philosophischer Diskurs/Primärtext
  'scientific_paper',         // Wissenschaftliche Publikation
  'encyclopedia_entry',       // Enzyklopädischer Artikel
  'public_news',              // Öffentlich-rechtliche / journalistische Meldung
  'community_discussion'      // Offene Fach- & Community-Diskussion
]);
export type FactReviewStatus = z.infer<typeof FactReviewStatusSchema>;

export function formatFactReviewStatus(status?: FactReviewStatus): string {
  switch (status) {
    case 'philosophical_discourse': return 'Philosophischer Primärdiskurs';
    case 'scientific_paper': return 'Fachwissenschaftliche Publikation';
    case 'pedagogical_concept': return 'Fachdidaktisches Unterrichtskonzept';
    case 'historical_reference': return 'Historische Quelle & Kontext';
    case 'encyclopedia_entry': return 'Enzyklopädischer Überblick';
    case 'public_news': return 'Journalistische Redaktionsmeldung';
    case 'community_discussion': return 'Offene Fach- & Community-Debatte';
    case 'curated_illustrative': return 'Autorisierter Herausgeber-Auszug';
    default: return 'Verifizierte Quelle';
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
  'concise_insight',          // Kurzimpuls, in sich abgeschlossen
  'sourced_update',           // Aktuelle Entwicklung mit Quellenbeleg
  'creative_idea',            // Praktischer schöpferischer Impuls / Musik
  'intriguing_question',      // Denkfrage mit Erläuterung
  'surprising_connection',    // Unerwartete interdisziplinäre Brücke
  'perspective_disagreement', // Kontroverse, dialektischer Einwand
  'long_invitation',          // Einladung in vertiefende Langform
  'meme',                     // High-IQ Meme & Satire
  'comic',                    // Cartoons, xkcd & Visual Comics
  'youtube_gem',              // Kuratierter YouTube Video-Essay
  'book_masterpiece',         // Buch-Empfehlung & Kern-These
  'opportunity_radar',        // Chancen-, Gesundheits- & Hebel-Radar
  'art_showcase'              // Meisterwerke, Gemälde, Fotografie & Bildende Kunst
]);
export type FeedItemFormat = z.infer<typeof FeedItemFormatSchema>;

export const FORMAT_BADGE_MAP: Record<FeedItemFormat, { label: string; icon: string }> = {
  concise_insight: { label: 'Kompaktimpuls', icon: 'flash-outline' },
  sourced_update: { label: 'Recherche & Update', icon: 'newspaper-outline' },
  creative_idea: { label: 'Kreativer Impuls', icon: 'bulb-outline' },
  intriguing_question: { label: 'Denkfrage', icon: 'help-circle-outline' },
  surprising_connection: { label: 'Interdisziplinäre Brücke', icon: 'git-network-outline' },
  perspective_disagreement: { label: 'Gegenposition', icon: 'compass-outline' },
  long_invitation: { label: 'Vertiefender Essay', icon: 'book-outline' },
  meme: { label: 'Satire & Meme', icon: 'happy-outline' },
  comic: { label: 'Comic & Cartoon', icon: 'sparkles-outline' },
  youtube_gem: { label: 'Video-Essay', icon: 'play-circle-outline' },
  book_masterpiece: { label: 'Buch-Empfehlung', icon: 'library-outline' },
  opportunity_radar: { label: 'Chancen-Radar', icon: 'trending-up-outline' },
  art_showcase: { label: 'Kunst & Visuelles', icon: 'color-palette-outline' }
};

export function formatFeedItemFormat(format?: FeedItemFormat): string {
  if (format && format in FORMAT_BADGE_MAP) {
    return FORMAT_BADGE_MAP[format].label;
  }
  return 'Lese-Entdeckung';
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

// Simulated Reddit Community Discussion Comments
export const CommunityCommentSchema = z.object({
  id: z.string(),
  authorHandle: z.string(), // e.g. "u/dialektik_dresden", "u/didaktik_labor", "u/synth_alchemie"
  authorBadge: z.string().optional(), // e.g. "Philosophie Sek II", "Gymnasiallehrer", "Modular Alchemist"
  timeAgo: z.string(),
  score: z.number().int().default(1),
  text: z.string(),
  commentType: z.enum(['dialectic_critique', 'didactic_transfer', 'creative_synthesis', 'sparring_reply']).default('dialectic_critique')
});
export type CommunityComment = z.infer<typeof CommunityCommentSchema>;

// Three Daily Editions (Morgen, Mittendrin, Abend)
export const DayEditionTypeSchema = z.enum(['morning', 'midday', 'evening']);
export type DayEditionType = z.infer<typeof DayEditionTypeSchema>;

export const DAY_EDITIONS_META: Record<DayEditionType, {
  id: DayEditionType;
  label: string;
  periodLabel: string;
  tagline: string;
  icon: string;
  targetMinCount: number;
  targetMaxCount: number;
}> = {
  morning: {
    id: 'morning',
    label: 'Guten Morgen',
    periodLabel: 'Morgenausgabe',
    tagline: 'Frisch, neugierig, orientierend',
    icon: 'sunny-outline',
    targetMinCount: 6,
    targetMaxCount: 8
  },
  midday: {
    id: 'midday',
    label: 'Mittendrin',
    periodLabel: 'Tagesausgabe',
    tagline: 'Lebendig, Werkzeuge, Ideen & Entdeckungen',
    icon: 'flash-outline',
    targetMinCount: 4,
    targetMaxCount: 6
  },
  evening: {
    id: 'evening',
    label: 'Guten Abend',
    periodLabel: 'Abendausgabe',
    tagline: 'Ruhig, vertiefend, Kultur & Klang',
    icon: 'moon-outline',
    targetMinCount: 4,
    targetMaxCount: 6
  }
};

// Ebene 2: Editorial Abstract (Orientierung beim Öffnen)
export const EditorialAbstractSchema = z.object({
  overview: z.string(), // Worum geht es? (ca. 25-45 Wörter)
  keyFinding: z.string(), // Was ist die zentrale Aussage oder neue Entwicklung? (ca. 30-50 Wörter)
  relevanceWhy: z.string(), // Warum könnte das interessant sein? (ca. 25-45 Wörter)
  limitation: z.string().optional() // Welche wichtige Einschränkung / Caveat muss ich kennen? (ca. 15-30 Wörter)
});
export type EditorialAbstract = z.infer<typeof EditorialAbstractSchema>;

// Querverbindungen & Einordnung im lokalen Wissensnetzwerk
export const RelatedCrossReferenceSchema = z.object({
  id: z.string(),
  title: z.string(),
  publisher: z.string(),
  insight: z.string(),
  connectionReason: z.string()
});
export type RelatedCrossReference = z.infer<typeof RelatedCrossReferenceSchema>;

// Ebene 3: Art der redaktionellen Aufbereitung
export const EditorialSynthesisTypeSchema = z.enum([
  'original_text',            // Ungekürzter Primärtext / Autorenaufsatz
  'publisher_excerpt',        // Autorisierter Auszug des Verlags / Herausgebers
  'editorial_deepening',      // Redaktionell kuratierte & geprüfte Vertiefung
  'scientific_synthesis'      // Wissenschaftliche Quellensynthese & Einordnung
]);
export type EditorialSynthesisType = z.infer<typeof EditorialSynthesisTypeSchema>;

export function formatEditorialSynthesisType(type?: EditorialSynthesisType): string {
  switch (type) {
    case 'original_text': return 'Authentischer Primärtext';
    case 'publisher_excerpt': return 'Autorisierter Herausgeber-Auszug';
    case 'scientific_synthesis': return 'Wissenschaftliche Quellensynthese';
    case 'editorial_deepening':
    default:
      return 'Redaktionell aufbereitete Vertiefung';
  }
}

export const FeedQuizQuestionSchema = z.object({
  id: z.string(),
  question: z.string(),
  options: z.array(z.string()).min(2).max(4),
  correctIndex: z.number().int().min(0),
  explanation: z.string(),
  sourceArticleId: z.string().optional(),
  sourceArticleTitle: z.string().optional()
});
export type FeedQuizQuestion = z.infer<typeof FeedQuizQuestionSchema>;

export const FeedItemSchema = z.object({
  id: z.string(),
  type: ContentTypeSchema,
  format: FeedItemFormatSchema.default('concise_insight'),
  title: z.string(),
  subtitle: z.string(),
  quiz: FeedQuizQuestionSchema.optional(),
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
  didacticTransfer: z.string().optional(),
  isEvergreenGem: z.boolean().optional(),
  evergreenContext: z.string().optional(),
  upvotesCount: z.number().int().default(0),
  comments: z.array(CommunityCommentSchema).default([]),

  // Specialized Content Metadata
  youtubeMeta: z.object({
    videoId: z.string(),
    channelTitle: z.string(),
    duration: z.string(),
    viewCount: z.string().optional(),
    keyTakeaways: z.array(z.string()).default([])
  }).optional(),

  bookMeta: z.object({
    author: z.string(),
    pages: z.number().int().optional(),
    rating: z.number().min(1).max(5).default(4.9),
    coverUrl: z.string().url().optional(),
    oneSentenceThesis: z.string(),
    whyRead: z.string()
  }).optional(),

  memeMeta: z.object({
    templateName: z.string(),
    punchline: z.string(),
    satireContext: z.string().optional()
  }).optional(),

  opportunityMeta: z.object({
    category: z.string(),
    deadline: z.string().optional(),
    impactScore: z.number().min(1).max(10).default(9),
    actionStep: z.string()
  }).optional(),

  artMeta: z.object({
    artist: z.string(),
    year: z.string().optional(),
    medium: z.string().optional(),
    museum: z.string(),
    highResImageUrl: z.string(),
    styleMovement: z.string().optional(),
    aestheticImpulse: z.string()
  }).optional(),

  awardsCount: z.object({
    gold: z.number().int().default(0),
    brain: z.number().int().default(0),
    spark: z.number().int().default(0)
  }).default({ gold: 0, brain: 0, spark: 0 }),

  sourceTrustLevel: z.enum([
    'public_broadcaster',
    'peer_reviewed',
    'verified_creator',
    'deep_essay',
    'community_curated',
    'encyclopedia',
    'museum_collection'
  ]).default('verified_creator'),
  sourceDomain: z.string().optional(),
  sourceBroadcasterName: z.string().optional(),
  editorialAbstract: EditorialAbstractSchema.optional(),
  editorialSynthesisType: EditorialSynthesisTypeSchema.optional(),
  targetEditions: z.array(DayEditionTypeSchema).optional(),
  imageCredit: z.string().optional(),
  relatedCrossReferences: z.array(RelatedCrossReferenceSchema).optional(),
  hasAuthenticImage: z.boolean().optional(),
  externalCommunityScore: z.object({
    platform: z.string(),
    points: z.number().int().nonnegative(),
    commentsCount: z.number().int().nonnegative().optional(),
    discussionUrl: z.string().url().optional()
  }).optional(),
  curationScore: z.number().min(0).max(10).optional(),
  curationReason: z.string().optional(),
  isNewlyCurated: z.boolean().optional(),
  curatedAt: z.string().optional(),
  publicationDateReliable: z.boolean().optional(),
  firstSeenAt: z.string().optional(),
  historicalYearOrEra: z.string().optional()
});
export const ArtMetaSchema = z.object({
  artist: z.string(),
  year: z.string().optional(),
  medium: z.string().optional(),
  museum: z.string(),
  highResImageUrl: z.string(),
  styleMovement: z.string().optional(),
  aestheticImpulse: z.string()
});
export type ArtMeta = z.infer<typeof ArtMetaSchema>;

export type FeedItem = z.infer<typeof FeedItemSchema>;

export function formatVerifiedProvenanceLabel(item: {
  sourceTrustLevel?: FeedItem['sourceTrustLevel'];
  evidenceTier?: EvidenceTier;
  factReviewStatus?: FactReviewStatus;
  format?: FeedItemFormat;
  sourceDomain?: string;
  externalCommunityScore?: FeedItem['externalCommunityScore'];
}): string {
  const domain = (item.sourceDomain || '').toLowerCase();
  if (
    item.sourceTrustLevel === 'museum_collection' ||
    item.format === 'art_showcase' ||
    domain.includes('artic.edu')
  ) {
    return 'Kunstsammlung';
  }
  if (domain.includes('wikimedia.org')) {
    return 'Wikimedia Bildarchiv';
  }
  if (
    item.sourceTrustLevel === 'encyclopedia' ||
    domain.includes('wikipedia.org') ||
    item.factReviewStatus === 'encyclopedia_entry'
  ) {
    return 'Enzyklopädie';
  }
  if (item.externalCommunityScore) {
    return `${item.externalCommunityScore.points} ${item.externalCommunityScore.platform}-Punkte`;
  }
  if (item.sourceTrustLevel === 'community_curated' || item.factReviewStatus === 'community_discussion') {
    return 'Community-Fundstück';
  }
  if (item.sourceTrustLevel === 'public_broadcaster') {
    return 'Öffentlich-Rechtlich';
  }
  if (item.sourceTrustLevel === 'peer_reviewed' || item.factReviewStatus === 'scientific_paper') {
    return 'Wissenschaft & Forschung';
  }
  if (item.sourceTrustLevel === 'deep_essay') {
    return 'Essay & Feuilleton';
  }
  if (item.evidenceTier === 'metadata_only') {
    return 'Quell-Fundstück';
  }
  return 'RSS-Originalauszug';
}

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
    name: 'Frontier AI & Systeme',
    flair: 'Frontier AI',
    icon: 'hardware-chip-outline',
    color: '#5282B8',
    bgTint: 'rgba(82, 130, 184, 0.11)'
  },
  german_didactics: {
    space: 'c/didaktik_labor',
    name: 'Didaktik & Bildungsarchitektur',
    flair: 'Didaktik-Labor',
    icon: 'school-outline',
    color: '#4D947A',
    bgTint: 'rgba(77, 148, 122, 0.11)'
  },
  philosophy_ethics: {
    space: 'c/dialektik',
    name: 'Philosophie & Streitfragen',
    flair: 'Streitfrage',
    icon: 'compass-outline',
    color: '#7E72B5',
    bgTint: 'rgba(126, 114, 181, 0.11)'
  },
  sound_synthesis: {
    space: 'c/synth_alchemie',
    name: 'Klangforschung & Modular',
    flair: 'Klangforschung',
    icon: 'musical-notes-outline',
    color: '#B58952',
    bgTint: 'rgba(181, 137, 82, 0.11)'
  },
  contemplation_mind: {
    space: 'c/kontemplation',
    name: 'Geist & Kontemplation',
    flair: 'Geist & Fokus',
    icon: 'leaf-outline',
    color: '#4B8E9D',
    bgTint: 'rgba(75, 142, 157, 0.11)'
  },
  science_society: {
    space: 'c/serendipity',
    name: 'Wissenschaft & Gesellschaft',
    flair: 'Wissenschaft',
    icon: 'planet-outline',
    color: '#5C7FA3',
    bgTint: 'rgba(92, 127, 163, 0.11)'
  },
  memes_satire: {
    space: 'c/memes',
    name: 'Comics & Satire',
    flair: 'Satire & Comics',
    icon: 'happy-outline',
    color: '#B87B5C',
    bgTint: 'rgba(184, 123, 92, 0.11)'
  },
  youtube_gems: {
    space: 'c/youtube',
    name: 'Video-Essays & Doku',
    flair: 'Video-Essay',
    icon: 'play-circle-outline',
    color: '#A8646B',
    bgTint: 'rgba(168, 100, 107, 0.11)'
  },
  book_mastery: {
    space: 'c/books',
    name: 'Bücher & Essays',
    flair: 'Buch & Essay',
    icon: 'book-outline',
    color: '#7A6BA8',
    bgTint: 'rgba(122, 107, 168, 0.11)'
  },
  health_biohacking: {
    space: 'c/health_longevity',
    name: 'Gesundheit & Neurobiologie',
    flair: 'Neurobiologie',
    icon: 'fitness-outline',
    color: '#4C917D',
    bgTint: 'rgba(76, 145, 125, 0.11)'
  },
  opportunities_growth: {
    space: 'c/chancen',
    name: 'Chancen- & Hebel-Radar',
    flair: 'Hebel & Grants',
    icon: 'trending-up-outline',
    color: '#548C9C',
    bgTint: 'rgba(84, 140, 156, 0.11)'
  },
  art_aesthetics: {
    space: 'c/kunst_galerie',
    name: 'Kunst & Visuelle Kultur',
    flair: 'Kunst & Kultur',
    icon: 'color-palette-outline',
    color: '#B0855B',
    bgTint: 'rgba(176, 133, 91, 0.11)'
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

export const ThemePaletteSchema = z.enum([
  'tidalglass',
  'mosspulse',
  'oxford',
  'cyberpunk',
  'monochrome'
]).default('tidalglass');
export type ThemePalette = z.infer<typeof ThemePaletteSchema>;

export const LanguageMixSchema = z.enum(['bilingual', 'de_focus', 'en_focus']).default('bilingual');
export type LanguageMix = z.infer<typeof LanguageMixSchema>;

export const UserProfileSchema = z.object({
  language: z.enum(['de', 'en']).default('de'),
  region: z.enum(['de', 'eu', 'global']).default('de'),
  explicitInterests: z.record(TopicTagSchema, z.number().min(0).max(1)),
  derivedWeights: z.record(z.string(), z.number().min(0).max(1)).optional().default({}),
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
    penalizedKeywords: z.record(z.string(), z.number()).default({}),
    boostedDomains: z.record(z.string(), z.number()).default({}),
    penalizedDomains: z.record(z.string(), z.number()).default({}),
    boostedSpaces: z.record(z.string(), z.number()).default({}),
    penalizedSpaces: z.record(z.string(), z.number()).default({})
  }).default({
    boostedTopics: {},
    penalizedTopics: {},
    boostedAuthors: {},
    penalizedAuthors: {},
    boostedKeywords: {},
    penalizedKeywords: {},
    boostedDomains: {},
    penalizedDomains: {},
    boostedSpaces: {},
    penalizedSpaces: {}
  }),
  feedMixRatio: z.object({
    focusRatio: z.number().min(0).max(1).default(0.60),
    socraticRatio: z.number().min(0).max(1).default(0.20),
    serendipityRatio: z.number().min(0).max(1).default(0.20)
  }).default({
    focusRatio: 0.60,
    socraticRatio: 0.20,
    serendipityRatio: 0.20
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
    theme: z.enum(['system', 'light', 'dark']).default('dark'),
    palette: ThemePaletteSchema.default('tidalglass'),
    fontSize: z.enum(['sm', 'md', 'lg', 'xl']).default('md'),
    languageMix: LanguageMixSchema.default('bilingual')
  }),
  editionPreferences: z.object({
    timezone: z.string().default('Europe/Berlin'),
    morningStartHour: z.number().default(5),
    middayStartHour: z.number().default(12),
    eveningStartHour: z.number().default(18),
    weatherEnabled: z.boolean().default(true),
    weatherCity: z.string().default('dresden')
  }).default({
    timezone: 'Europe/Berlin',
    morningStartHour: 5,
    middayStartHour: 12,
    eveningStartHour: 18,
    weatherEnabled: true,
    weatherCity: 'dresden'
  }),
  enabledModules: z.record(z.string(), z.boolean()).default({
    socratic_sparring: true,
    didactic_transfer: true,
    cross_references: true,
    sound_grounding: true,
    craft_obsidian_export: true,
    why_this_transparency: true
  }),
  isOnboarded: z.boolean().default(false),
  lastActiveDate: z.string().optional()
});
export type UserProfile = z.infer<typeof UserProfileSchema>;
export type EditionPreferences = UserProfile['editionPreferences'];

export const SparringReplySchema = z.object({
  id: z.string(),
  authorHandle: z.string(), // e.g. "u/sokrates_2026", "u/didaktik_labor", "u/dialektik_dresden"
  authorBadge: z.string().optional(), // e.g. "Sokratischer Sparring-Partner"
  text: z.string(),
  createdAt: z.string()
});
export type SparringReply = z.infer<typeof SparringReplySchema>;

export const UserNoteSchema = z.object({
  id: z.string(),
  text: z.string(),
  createdAt: z.string(),
  tag: z.enum(['einwand', 'unterricht', 'these', 'notiz']).default('notiz'),
  sparringReply: SparringReplySchema.optional()
});
export type UserNote = z.infer<typeof UserNoteSchema>;

export const ReadingInteractionSchema = z.object({
  itemId: z.string(),
  saved: z.boolean().default(false),
  savedAt: z.string().optional(),
  progressPercent: z.number().min(0).max(100).default(0), // resume position
  furthestPositionPercent: z.number().min(0).max(100).default(0), // furthest position reached
  completedAt: z.string().optional(),
  feedback: z.enum(['more_like_this', 'less_like_this', 'neutral', 'already_known', 'more_depth']).optional(),
  timeWorthFeedback: z.enum(['very_worthwhile', 'worthwhile', 'neutral', 'not_worthwhile']).optional(),
  userNotes: z.array(UserNoteSchema).default([]),
  voteScore: z.number().default(0) // +1 for upvote, -1 for downvote
});
export type ReadingInteraction = z.infer<typeof ReadingInteractionSchema>;

