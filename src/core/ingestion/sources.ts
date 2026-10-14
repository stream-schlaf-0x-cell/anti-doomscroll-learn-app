import { RawFeedSource } from './types';

/**
 * 10 live public RSS/Atom feeds matching the founder profile:
 * - AI & Frontier Computing (accelerated understanding, open architectures)
 * - Philosophy & Ethics (foundational epistemology, dialectics)
 * - German Didactics & School Pedagogy (teaching, moral aporia)
 * - Sound Synthesis & Electronic Music (creative craft, modular audio)
 * - Science, Technology & Society (quantum biology, media ecology, digital rights)
 */
export const VERIFIED_FEED_SOURCES: RawFeedSource[] = [
  // 1. AI & Computing
  {
    id: 'simon-willison',
    name: 'Simon Willison’s Weblog',
    url: 'https://simonwillison.net/atom/entries/',
    primaryTopic: 'ai_apple',
    topics: ['ai_apple', 'science_society'],
    defaultEvidenceTier: 'permitted_full_text',
    defaultAuthor: 'Simon Willison',
    language: 'en'
  },
  {
    id: 'huggingface-blog',
    name: 'Hugging Face Blog',
    url: 'https://huggingface.co/blog/feed.xml',
    primaryTopic: 'ai_apple',
    topics: ['ai_apple', 'science_society'],
    defaultEvidenceTier: 'publisher_excerpt',
    defaultAuthor: 'Hugging Face Community',
    language: 'en'
  },
  {
    id: 'arxiv-cs-ai',
    name: 'arXiv Computer Science / AI',
    url: 'http://export.arxiv.org/rss/cs.AI',
    primaryTopic: 'ai_apple',
    topics: ['ai_apple', 'science_society'],
    defaultEvidenceTier: 'metadata_only',
    defaultAuthor: 'arXiv AI Researchers',
    language: 'en'
  },

  // 2. Philosophy & Ethics
  {
    id: 'sep-whats-new',
    name: 'Stanford Encyclopedia of Philosophy',
    url: 'https://plato.stanford.edu/rss/sep.xml',
    primaryTopic: 'philosophy_ethics',
    topics: ['philosophy_ethics', 'contemplation_mind'],
    defaultEvidenceTier: 'metadata_only',
    defaultAuthor: 'Stanford Encyclopedia of Philosophy',
    language: 'en',
    isChallengingPerspective: true
  },
  {
    id: 'daily-nous',
    name: 'Daily Nous',
    url: 'https://dailynous.com/feed/',
    primaryTopic: 'philosophy_ethics',
    topics: ['philosophy_ethics', 'science_society'],
    defaultEvidenceTier: 'publisher_excerpt',
    defaultAuthor: 'Justin Weinberg',
    language: 'en',
    isChallengingPerspective: true
  },

  // 3. German Didactics & Education (~10% editorial quota)
  {
    id: 'deutsches-schulportal',
    name: 'Das Deutsche Schulportal',
    url: 'https://deutsches-schulportal.de/feed/',
    primaryTopic: 'german_didactics',
    topics: ['german_didactics', 'philosophy_ethics', 'science_society'],
    defaultEvidenceTier: 'publisher_excerpt',
    defaultAuthor: 'Robert Bosch Stiftung / Deutsches Schulportal',
    language: 'de',
    isTeachingRelated: true
  },

  // 4. Creative Sound & Synthesis
  {
    id: 'cdm-link',
    name: 'Create Digital Music (CDM)',
    url: 'https://cdm.link/feed/',
    primaryTopic: 'sound_synthesis',
    topics: ['sound_synthesis', 'ai_apple'],
    defaultEvidenceTier: 'publisher_excerpt',
    defaultAuthor: 'Peter Kirn',
    language: 'en'
  },
  {
    id: 'synthtopia',
    name: 'Synthtopia',
    url: 'https://www.synthtopia.com/feed/',
    primaryTopic: 'sound_synthesis',
    topics: ['sound_synthesis', 'science_society'],
    defaultEvidenceTier: 'publisher_excerpt',
    defaultAuthor: 'Synthtopia Editorial',
    language: 'en'
  },

  // 5. Science, Culture & Digital Society
  {
    id: 'quanta-magazine',
    name: 'Quanta Magazine',
    url: 'https://api.quantamagazine.org/feed/',
    primaryTopic: 'science_society',
    topics: ['science_society', 'contemplation_mind'],
    defaultEvidenceTier: 'publisher_excerpt',
    defaultAuthor: 'Simons Foundation / Quanta Magazine',
    language: 'en'
  },
  {
    id: 'netzpolitik-org',
    name: 'Netzpolitik.org',
    url: 'https://netzpolitik.org/feed/',
    primaryTopic: 'science_society',
    topics: ['science_society', 'philosophy_ethics'],
    defaultEvidenceTier: 'permitted_full_text',
    defaultAuthor: 'Netzpolitik.org Redaktion',
    language: 'de'
  }
];
