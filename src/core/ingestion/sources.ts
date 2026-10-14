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
  },

  // 6. Öffentlich-Rechtliche Berichterstattung (Vertrauenswürdige Nachrichten & Wissenschaft)
  {
    id: 'tagesschau-wissen',
    name: 'Tagesschau Wissen & Forschung',
    url: 'https://www.tagesschau.de/wissen/index~rss2.xml',
    primaryTopic: 'science_society',
    topics: ['science_society', 'philosophy_ethics'],
    defaultEvidenceTier: 'publisher_excerpt',
    defaultAuthor: 'ARD / Tagesschau Wissen',
    language: 'de'
  },
  {
    id: 'tagesschau-inland',
    name: 'Tagesschau Inland & Gesellschaft',
    url: 'https://www.tagesschau.de/inland/index~rss2.xml',
    primaryTopic: 'science_society',
    topics: ['science_society', 'german_didactics'],
    defaultEvidenceTier: 'publisher_excerpt',
    defaultAuthor: 'ARD-aktuell / Tagesschau',
    language: 'de',
    isTeachingRelated: true
  },
  {
    id: 'zdf-heute',
    name: 'ZDFheute Nachrichten',
    url: 'https://www.zdfheute.de/rss/zdf/nachrichten',
    primaryTopic: 'science_society',
    topics: ['science_society', 'philosophy_ethics'],
    defaultEvidenceTier: 'publisher_excerpt',
    defaultAuthor: 'ZDFheute Redaktion',
    language: 'de'
  },
  {
    id: 'deutschlandfunk-nachrichten',
    name: 'Deutschlandfunk Aktuell',
    url: 'https://www.deutschlandfunk.de/nachrichten-100.rss',
    primaryTopic: 'science_society',
    topics: ['science_society', 'german_didactics', 'philosophy_ethics'],
    defaultEvidenceTier: 'publisher_excerpt',
    defaultAuthor: 'Deutschlandfunk Redaktion',
    language: 'de'
  },
  {
    id: 'aeon-essays',
    name: 'Aeon Essays & Ideas',
    url: 'https://aeon.co/feed.rss',
    primaryTopic: 'philosophy_ethics',
    topics: ['philosophy_ethics', 'contemplation_mind', 'science_society'],
    defaultEvidenceTier: 'publisher_excerpt',
    defaultAuthor: 'Aeon Editorial',
    language: 'en',
    isChallengingPerspective: true
  },
  {
    id: 'heise-developer',
    name: 'Heise Developer & AI',
    url: 'https://www.heise.de/developer/rss/news-atom.xml',
    primaryTopic: 'ai_apple',
    topics: ['ai_apple', 'science_society'],
    defaultEvidenceTier: 'publisher_excerpt',
    defaultAuthor: 'Heise Medien',
    language: 'de'
  },
  {
    id: 'tricycle',
    name: 'Tricycle: Contemplation & Mind',
    url: 'https://tricycle.org/feed/',
    primaryTopic: 'contemplation_mind',
    topics: ['contemplation_mind', 'philosophy_ethics'],
    defaultEvidenceTier: 'publisher_excerpt',
    defaultAuthor: 'Tricycle Editorial',
    language: 'en'
  },
  {
    id: 'lines-modular',
    name: 'Lines Modular & Sound Experiments',
    url: 'https://llllllll.co/latest.rss',
    primaryTopic: 'sound_synthesis',
    topics: ['sound_synthesis', 'science_society'],
    defaultEvidenceTier: 'publisher_excerpt',
    defaultAuthor: 'Lines Community',
    language: 'en'
  },

  // 7. YouTube Masterpieces & Visual Essays (Native YouTube XML Feeds)
  {
    id: 'yt-3blue1brown',
    name: '3Blue1Brown',
    url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCYO_jab_esuFRV4b17AJtAw',
    primaryTopic: 'youtube_gems',
    topics: ['youtube_gems', 'science_society', 'german_didactics'],
    defaultEvidenceTier: 'permitted_full_text',
    defaultAuthor: 'Grant Sanderson',
    language: 'en'
  },
  {
    id: 'yt-veritasium',
    name: 'Veritasium',
    url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCHnyfMqiRRG1u-2MsSQLbXA',
    primaryTopic: 'youtube_gems',
    topics: ['youtube_gems', 'science_society', 'philosophy_ethics'],
    defaultEvidenceTier: 'permitted_full_text',
    defaultAuthor: 'Derek Muller',
    language: 'en'
  },
  {
    id: 'yt-kurzgesagt',
    name: 'Kurzgesagt – In a Nutshell',
    url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCsXVk37bltHxD1rDPwtNM8Q',
    primaryTopic: 'youtube_gems',
    topics: ['youtube_gems', 'science_society', 'contemplation_mind'],
    defaultEvidenceTier: 'permitted_full_text',
    defaultAuthor: 'Kurzgesagt Redaktion',
    language: 'en'
  },
  {
    id: 'yt-huberman',
    name: 'Huberman Lab',
    url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UC2D2CMWXMOVWx7giW1n3LIg',
    primaryTopic: 'health_biohacking',
    topics: ['health_biohacking', 'youtube_gems', 'contemplation_mind'],
    defaultEvidenceTier: 'permitted_full_text',
    defaultAuthor: 'Dr. Andrew Huberman',
    language: 'en'
  },

  // 8. Bücher, Literatur & Kulturkritik (Feuilleton & Reviews)
  {
    id: 'perlentaucher-magazin',
    name: 'Perlentaucher Das Kulturmagazin',
    url: 'https://www.perlentaucher.de/index.rss',
    primaryTopic: 'book_mastery',
    topics: ['book_mastery', 'philosophy_ethics', 'german_didactics'],
    defaultEvidenceTier: 'publisher_excerpt',
    defaultAuthor: 'Perlentaucher Redaktion',
    language: 'de'
  },
  {
    id: 'dlf-buechermarkt',
    name: 'Deutschlandfunk Büchermarkt',
    url: 'https://www.deutschlandfunk.de/buechermarkt-100.rss',
    primaryTopic: 'book_mastery',
    topics: ['book_mastery', 'german_didactics', 'philosophy_ethics'],
    defaultEvidenceTier: 'publisher_excerpt',
    defaultAuthor: 'Deutschlandfunk Redaktion',
    language: 'de'
  },
  {
    id: 'spektrum-wissenschaft',
    name: 'Spektrum der Wissenschaft',
    url: 'https://www.spektrum.de/alias/rss/spektrum-der-wissenschaft-rss-feed/982623',
    primaryTopic: 'science_society',
    topics: ['science_society', 'book_mastery', 'ai_apple'],
    defaultEvidenceTier: 'publisher_excerpt',
    defaultAuthor: 'Spektrum Verlag',
    language: 'de'
  },
  {
    id: 'gehirn-und-geist',
    name: 'Gehirn & Geist (Kognition & Psychologie)',
    url: 'https://www.spektrum.de/alias/rss/gehirn-und-geist-rss-feed/982626',
    primaryTopic: 'health_biohacking',
    topics: ['health_biohacking', 'contemplation_mind', 'science_society'],
    defaultEvidenceTier: 'publisher_excerpt',
    defaultAuthor: 'Spektrum Verlag',
    language: 'de'
  },

  // 9. Schule, Fachdidaktik & Bildungsdiskurs
  {
    id: 'deutscher-bildungsserver',
    name: 'Deutscher Bildungsserver',
    url: 'https://www.bildungsserver.de/rss.xml',
    primaryTopic: 'german_didactics',
    topics: ['german_didactics', 'science_society'],
    defaultEvidenceTier: 'publisher_excerpt',
    defaultAuthor: 'DBS Redaktion',
    language: 'de',
    isTeachingRelated: true
  },
  {
    id: 'bpb-themen',
    name: 'Bundeszentrale für politische Bildung (bpb)',
    url: 'https://www.bpb.de/rss-feed/133223.rss',
    primaryTopic: 'german_didactics',
    topics: ['german_didactics', 'philosophy_ethics', 'science_society'],
    defaultEvidenceTier: 'publisher_excerpt',
    defaultAuthor: 'BPB Redaktion',
    language: 'de',
    isTeachingRelated: true
  },

  // 10. High-IQ Satire & Memes
  {
    id: 'xkcd-comics',
    name: 'xkcd Comics & Satire',
    url: 'https://xkcd.com/rss.xml',
    primaryTopic: 'memes_satire',
    topics: ['memes_satire', 'science_society', 'ai_apple'],
    defaultEvidenceTier: 'permitted_full_text',
    defaultAuthor: 'Randall Munroe',
    language: 'en'
  }
];
