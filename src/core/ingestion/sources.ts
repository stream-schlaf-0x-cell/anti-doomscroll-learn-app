import { RawFeedSource } from './types';

/**
 * Verifiable Catalog of 56 Concrete Candidate Sources across:
 * - News & Public Broadcasters (ÖRR)
 * - Science & Research
 * - AI, Tech & Digital Sovereignty
 * - Philosophy, Ethics & Society
 * - Essays, Literature & Books
 * - Music, Sound Synthesis & Creativity
 * - Visual Art & Aesthetics
 * - Contemplation, Buddhism, Mindfulness & Qi Gong
 * - Didactics & Teaching
 * - Playful Wit, Comics & Curiosities
 * - Curated Video Essays
 */
export const VERIFIED_FEED_SOURCES: RawFeedSource[] = [
  // ============================================================================
  // 1. ÖFFENTLICH-RECHTLICHE & NACHRICHTEN (9 Quellen)
  // ============================================================================
  {
    id: 'tagesschau-wissen',
    name: 'ARD Tagesschau Wissen',
    url: 'https://www.tagesschau.de/wissen/index~rss2.xml',
    primaryTopic: 'science_society',
    topics: ['science_society', 'health_biohacking'],
    defaultEvidenceTier: 'publisher_excerpt',
    defaultAuthor: 'ARD Wissenschaftsredaktion',
    language: 'de'
  },
  {
    id: 'tagesschau-inland',
    name: 'ARD Tagesschau',
    url: 'https://www.tagesschau.de/infoservices/alle-meldungen-100~rss2.xml',
    primaryTopic: 'science_society',
    topics: ['science_society', 'philosophy_ethics'],
    defaultEvidenceTier: 'publisher_excerpt',
    defaultAuthor: 'ARD-aktuell',
    language: 'de'
  },
  {
    id: 'deutschlandfunk-nachrichten',
    name: 'Deutschlandfunk Nachrichten',
    url: 'https://www.deutschlandfunk.de/nachrichten-100.rss',
    primaryTopic: 'science_society',
    topics: ['science_society', 'philosophy_ethics'],
    defaultEvidenceTier: 'publisher_excerpt',
    defaultAuthor: 'Deutschlandfunk Redaktion',
    language: 'de'
  },
  {
    id: 'dlf-forschung-aktuell',
    name: 'Deutschlandfunk Forschung Aktuell',
    url: 'https://www.deutschlandfunk.de/forschung-aktuell-100.rss',
    primaryTopic: 'science_society',
    topics: ['science_society', 'ai_apple'],
    defaultEvidenceTier: 'publisher_excerpt',
    defaultAuthor: 'DLF Wissenschaft',
    language: 'de'
  },
  {
    id: 'dlf-kultur-sein-und-streit',
    name: 'Deutschlandfunk Kultur',
    url: 'https://www.deutschlandfunkkultur.de/sein-und-streit-100.rss',
    primaryTopic: 'philosophy_ethics',
    topics: ['philosophy_ethics', 'science_society'],
    defaultEvidenceTier: 'publisher_excerpt',
    defaultAuthor: 'DLF Kultur Philosophie',
    language: 'de',
    isChallengingPerspective: true
  },
  {
    id: 'zdf-heute',
    name: 'ZDFheute Wissen & Politik',
    url: 'https://www.zdf.de/rss/zdf/nachrichten',
    primaryTopic: 'science_society',
    topics: ['science_society'],
    defaultEvidenceTier: 'publisher_excerpt',
    defaultAuthor: 'ZDFheute Redaktion',
    language: 'de'
  },
  {
    id: 'br24-wissen',
    name: 'BR24 Wissen',
    url: 'https://nachrichtenfeeds.br.de/rdf/boards/QXAPkQJ',
    primaryTopic: 'science_society',
    topics: ['science_society', 'health_biohacking'],
    defaultEvidenceTier: 'publisher_excerpt',
    defaultAuthor: 'BR Wissenschaft',
    language: 'de'
  },
  {
    id: 'dw-wissenschaft',
    name: 'Deutsche Welle Wissenschaft',
    url: 'https://rss.dw.com/xml/rss-de-wiss',
    primaryTopic: 'science_society',
    topics: ['science_society', 'opportunities_growth'],
    defaultEvidenceTier: 'publisher_excerpt',
    defaultAuthor: 'DW Wissenschaft',
    language: 'de'
  },
  {
    id: 'bpb-themen',
    name: 'Bundeszentrale für politische Bildung (bpb)',
    url: 'https://www.bpb.de/rss-feed/230860.rss',
    primaryTopic: 'science_society',
    topics: ['science_society', 'philosophy_ethics', 'german_didactics'],
    defaultEvidenceTier: 'permitted_full_text',
    defaultAuthor: 'bpb Redaktion',
    language: 'de',
    isTeachingRelated: true,
    isChallengingPerspective: true
  },

  // ============================================================================
  // 2. WISSENSCHAFT, KOGNITION & FORSCHUNG (9 Quellen)
  // ============================================================================
  {
    id: 'quanta-magazine',
    name: 'Quanta Magazine',
    url: 'https://api.quantamagazine.org/feed/',
    primaryTopic: 'science_society',
    topics: ['science_society', 'ai_apple', 'philosophy_ethics'],
    defaultEvidenceTier: 'publisher_excerpt',
    defaultAuthor: 'Quanta Editorial',
    language: 'en'
  },
  {
    id: 'spektrum-wissenschaft',
    name: 'Spektrum der Wissenschaft',
    url: 'https://www.spektrum.de/alias/rss/spektrum-de-rss-feed/996406',
    primaryTopic: 'science_society',
    topics: ['science_society', 'contemplation_mind', 'health_biohacking'],
    defaultEvidenceTier: 'publisher_excerpt',
    defaultAuthor: 'Spektrum Redaktion',
    language: 'de'
  },
  {
    id: 'gehirn-und-geist',
    name: 'Gehirn & Geist (Spektrum)',
    url: 'https://www.spektrum.de/alias/rss/gehirn-und-geist-rss-feed/996408',
    primaryTopic: 'contemplation_mind',
    topics: ['contemplation_mind', 'health_biohacking', 'german_didactics'],
    defaultEvidenceTier: 'publisher_excerpt',
    defaultAuthor: 'Gehirn & Geist',
    language: 'de',
    isTeachingRelated: true
  },
  {
    id: 'nature-news',
    name: 'Nature News & Research',
    url: 'https://www.nature.com/nature.rss',
    primaryTopic: 'science_society',
    topics: ['science_society', 'health_biohacking'],
    defaultEvidenceTier: 'publisher_excerpt',
    defaultAuthor: 'Nature Portfolio',
    language: 'en'
  },
  {
    id: 'sciencedaily-mind-brain',
    name: 'ScienceDaily Mind & Brain',
    url: 'https://www.sciencedaily.com/rss/mind_brain.xml',
    primaryTopic: 'health_biohacking',
    topics: ['health_biohacking', 'contemplation_mind', 'science_society'],
    defaultEvidenceTier: 'publisher_excerpt',
    defaultAuthor: 'ScienceDaily Research',
    language: 'en'
  },
  {
    id: 'mpg-forschung',
    name: 'Max-Planck-Gesellschaft Forschung',
    url: 'https://www.mpg.de/podcasts.rss',
    primaryTopic: 'science_society',
    topics: ['science_society', 'philosophy_ethics'],
    defaultEvidenceTier: 'publisher_excerpt',
    defaultAuthor: 'Max-Planck-Gesellschaft',
    language: 'de'
  },
  {
    id: 'scinexx-wissen',
    name: 'scinexx Das Wissensmagazin',
    url: 'https://www.scinexx.de/feed/',
    primaryTopic: 'science_society',
    topics: ['science_society', 'health_biohacking'],
    defaultEvidenceTier: 'publisher_excerpt',
    defaultAuthor: 'scinexx Redaktion',
    language: 'de'
  },
  {
    id: 'arxiv-cs-ai',
    name: 'arXiv CS.AI & Computation',
    url: 'https://rss.arxiv.org/rss/cs.AI',
    primaryTopic: 'ai_apple',
    topics: ['ai_apple', 'science_society'],
    defaultEvidenceTier: 'publisher_excerpt',
    defaultAuthor: 'arXiv Preprint Authors',
    language: 'en'
  },
  {
    id: 'arxiv-q-bio-nc',
    name: 'arXiv Neurons & Cognition',
    url: 'https://rss.arxiv.org/rss/q-bio.NC',
    primaryTopic: 'contemplation_mind',
    topics: ['contemplation_mind', 'science_society', 'health_biohacking'],
    defaultEvidenceTier: 'publisher_excerpt',
    defaultAuthor: 'arXiv Neurobiology',
    language: 'en'
  },

  // ============================================================================
  // 3. KI, TECH & DIGITALE SOUVERÄNITÄT (9 Quellen)
  // ============================================================================
  {
    id: 'simon-willison',
    name: 'Simon Willison Weblog',
    url: 'https://simonwillison.net/atom/everything/',
    primaryTopic: 'ai_apple',
    topics: ['ai_apple', 'opportunities_growth'],
    defaultEvidenceTier: 'permitted_full_text',
    defaultAuthor: 'Simon Willison',
    language: 'en'
  },
  {
    id: 'huggingface-blog',
    name: 'Hugging Face Open-Source AI',
    url: 'https://huggingface.co/blog/feed.xml',
    primaryTopic: 'ai_apple',
    topics: ['ai_apple', 'opportunities_growth'],
    defaultEvidenceTier: 'publisher_excerpt',
    defaultAuthor: 'Hugging Face Research',
    language: 'en'
  },
  {
    id: 'heise-developer',
    name: 'Heise Developer & KI',
    url: 'https://www.heise.de/developer/rss/news-atom.xml',
    primaryTopic: 'ai_apple',
    topics: ['ai_apple', 'science_society'],
    defaultEvidenceTier: 'publisher_excerpt',
    defaultAuthor: 'Heise Redaktion',
    language: 'de'
  },
  {
    id: 'ars-technica',
    name: 'Ars Technica Science & Tech',
    url: 'https://feeds.arstechnica.com/arstechnica/index',
    primaryTopic: 'ai_apple',
    topics: ['ai_apple', 'science_society'],
    defaultEvidenceTier: 'publisher_excerpt',
    defaultAuthor: 'Ars Technica',
    language: 'en'
  },
  {
    id: 'mit-tech-review',
    name: 'MIT Technology Review',
    url: 'https://www.technologyreview.com/feed/',
    primaryTopic: 'ai_apple',
    topics: ['ai_apple', 'science_society', 'philosophy_ethics'],
    defaultEvidenceTier: 'publisher_excerpt',
    defaultAuthor: 'MIT Technology Review',
    language: 'en'
  },
  {
    id: 'lilian-weng-lillog',
    name: "Lil'Log (Lilian Weng AI Research)",
    url: 'https://lilianweng.github.io/index.xml',
    primaryTopic: 'ai_apple',
    topics: ['ai_apple', 'science_society'],
    defaultEvidenceTier: 'permitted_full_text',
    defaultAuthor: 'Lilian Weng',
    language: 'en'
  },
  {
    id: 'import-ai-clark',
    name: 'Import AI (Jack Clark)',
    url: 'https://importai.substack.com/feed',
    primaryTopic: 'ai_apple',
    topics: ['ai_apple', 'philosophy_ethics'],
    defaultEvidenceTier: 'permitted_full_text',
    defaultAuthor: 'Jack Clark',
    language: 'en',
    isChallengingPerspective: true
  },
  {
    id: 'lobsters-community',
    name: 'Lobsters Computing Community',
    url: 'https://lobste.rs/rss',
    primaryTopic: 'ai_apple',
    topics: ['ai_apple', 'opportunities_growth'],
    defaultEvidenceTier: 'metadata_only',
    defaultAuthor: 'Lobsters Community',
    language: 'en'
  },
  {
    id: 'hn-frontpage-rss',
    name: 'Hacker News Frontpage',
    url: 'https://hnrss.org/frontpage',
    primaryTopic: 'ai_apple',
    topics: ['ai_apple', 'science_society', 'opportunities_growth'],
    defaultEvidenceTier: 'metadata_only',
    defaultAuthor: 'HN Community',
    language: 'en'
  },

  // ============================================================================
  // 4. PHILOSOPHIE, ETHIK & GESELLSCHAFT (6 Quellen)
  // ============================================================================
  {
    id: 'sep-whats-new',
    name: 'Stanford Encyclopedia of Philosophy',
    url: 'https://plato.stanford.edu/rss/sep.xml',
    primaryTopic: 'philosophy_ethics',
    topics: ['philosophy_ethics', 'science_society'],
    defaultEvidenceTier: 'publisher_excerpt',
    defaultAuthor: 'Stanford Philosophy Dept.',
    language: 'en',
    isChallengingPerspective: true
  },
  {
    id: 'daily-nous',
    name: 'Daily Nous Philosophy',
    url: 'https://dailynous.com/feed/',
    primaryTopic: 'philosophy_ethics',
    topics: ['philosophy_ethics', 'ai_apple', 'science_society'],
    defaultEvidenceTier: 'publisher_excerpt',
    defaultAuthor: 'Justin Weinberg',
    language: 'en',
    isChallengingPerspective: true
  },
  {
    id: 'aeon-essays',
    name: 'Aeon Magazine',
    url: 'https://aeon.co/feed.rss',
    primaryTopic: 'philosophy_ethics',
    topics: ['philosophy_ethics', 'contemplation_mind', 'science_society'],
    defaultEvidenceTier: 'publisher_excerpt',
    defaultAuthor: 'Aeon Authors',
    language: 'en',
    isChallengingPerspective: true
  },
  {
    id: 'psyche-magazine',
    name: 'Psyche (by Aeon)',
    url: 'https://psyche.co/feed.rss',
    primaryTopic: 'contemplation_mind',
    topics: ['contemplation_mind', 'philosophy_ethics', 'health_biohacking'],
    defaultEvidenceTier: 'publisher_excerpt',
    defaultAuthor: 'Psyche Editorial',
    language: 'en'
  },
  {
    id: 'netzpolitik-org',
    name: 'netzpolitik.org',
    url: 'https://netzpolitik.org/feed/',
    primaryTopic: 'philosophy_ethics',
    topics: ['philosophy_ethics', 'ai_apple', 'science_society'],
    defaultEvidenceTier: 'permitted_full_text',
    defaultAuthor: 'netzpolitik.org Redaktion',
    language: 'de',
    isChallengingPerspective: true
  },
  {
    id: 'philosophy-now',
    name: 'Philosophy Now',
    url: 'https://philosophynow.org/rss',
    primaryTopic: 'philosophy_ethics',
    topics: ['philosophy_ethics', 'book_mastery'],
    defaultEvidenceTier: 'publisher_excerpt',
    defaultAuthor: 'Philosophy Now',
    language: 'en',
    isChallengingPerspective: true
  },

  // ============================================================================
  // 5. ESSAYS, LITERATUR & BÜCHER (6 Quellen)
  // ============================================================================
  {
    id: 'perlentaucher-magazin',
    name: 'Perlentaucher Kulturmagazin',
    url: 'https://www.perlentaucher.de/rss/feuilleton.xml',
    primaryTopic: 'book_mastery',
    topics: ['book_mastery', 'philosophy_ethics', 'science_society'],
    defaultEvidenceTier: 'publisher_excerpt',
    defaultAuthor: 'Perlentaucher Redaktion',
    language: 'de',
    isChallengingPerspective: true
  },
  {
    id: 'dlf-buechermarkt',
    name: 'Deutschlandfunk Büchermarkt',
    url: 'https://www.deutschlandfunk.de/buechermarkt-100.rss',
    primaryTopic: 'book_mastery',
    topics: ['book_mastery', 'philosophy_ethics', 'german_didactics'],
    defaultEvidenceTier: 'publisher_excerpt',
    defaultAuthor: 'Deutschlandfunk Kultur',
    language: 'de',
    isTeachingRelated: true
  },
  {
    id: 'the-marginalian',
    name: 'The Marginalian (Maria Popova)',
    url: 'https://www.themarginalian.org/feed/',
    primaryTopic: 'book_mastery',
    topics: ['book_mastery', 'philosophy_ethics', 'art_aesthetics'],
    defaultEvidenceTier: 'permitted_full_text',
    defaultAuthor: 'Maria Popova',
    language: 'en'
  },
  {
    id: 'public-domain-review',
    name: 'The Public Domain Review',
    url: 'https://publicdomainreview.org/rss.xml',
    primaryTopic: 'book_mastery',
    topics: ['book_mastery', 'art_aesthetics', 'philosophy_ethics'],
    defaultEvidenceTier: 'permitted_full_text',
    defaultAuthor: 'Public Domain Review',
    language: 'en'
  },
  {
    id: 'astral-codex-ten',
    name: 'Astral Codex Ten',
    url: 'https://www.astralcodexten.com/feed',
    primaryTopic: 'philosophy_ethics',
    topics: ['philosophy_ethics', 'science_society', 'ai_apple'],
    defaultEvidenceTier: 'permitted_full_text',
    defaultAuthor: 'Scott Alexander',
    language: 'en',
    isChallengingPerspective: true
  },
  {
    id: 'works-in-progress',
    name: 'Works in Progress Magazine',
    url: 'https://worksinprogress.co/feed/',
    primaryTopic: 'science_society',
    topics: ['science_society', 'opportunities_growth', 'book_mastery'],
    defaultEvidenceTier: 'permitted_full_text',
    defaultAuthor: 'Works in Progress',
    language: 'en'
  },

  // ============================================================================
  // 6. KONTEMPLATION, BUDDHISMUS, ACHTSAMKEIT & QI GONG (4 Quellen)
  // ============================================================================
  {
    id: 'tricycle-buddhist',
    name: 'Tricycle: The Buddhist Review',
    url: 'https://tricycle.org/feed/',
    primaryTopic: 'contemplation_mind',
    topics: ['contemplation_mind', 'philosophy_ethics'],
    defaultEvidenceTier: 'publisher_excerpt',
    defaultAuthor: 'Tricycle Editorial',
    language: 'en'
  },
  {
    id: 'lions-roar-buddhism',
    name: "Lion's Roar Buddhist Wisdom",
    url: 'https://www.lionsroar.com/feed/',
    primaryTopic: 'contemplation_mind',
    topics: ['contemplation_mind', 'philosophy_ethics', 'health_biohacking'],
    defaultEvidenceTier: 'publisher_excerpt',
    defaultAuthor: "Lion's Roar",
    language: 'en'
  },
  {
    id: 'plum-village-mindfulness',
    name: 'Plum Village (Thich Nhat Hanh Monastery)',
    url: 'https://plumvillage.org/feed/',
    primaryTopic: 'contemplation_mind',
    topics: ['contemplation_mind', 'health_biohacking', 'philosophy_ethics'],
    defaultEvidenceTier: 'permitted_full_text',
    defaultAuthor: 'Plum Village Sangha',
    language: 'en'
  },
  {
    id: 'zen-habits-focus',
    name: 'Zen Habits (Mindful Simplicity)',
    url: 'https://zenhabits.net/feed/',
    primaryTopic: 'contemplation_mind',
    topics: ['contemplation_mind', 'health_biohacking'],
    defaultEvidenceTier: 'permitted_full_text',
    defaultAuthor: 'Leo Babauta',
    language: 'en'
  },

  // ============================================================================
  // 7. MUSIK, KLANGSYNTHESE & KREATIVITÄT (4 Quellen)
  // ============================================================================
  {
    id: 'cdm-music',
    name: 'Create Digital Music (CDM)',
    url: 'https://cdm.link/feed/',
    primaryTopic: 'sound_synthesis',
    topics: ['sound_synthesis', 'ai_apple'],
    defaultEvidenceTier: 'publisher_excerpt',
    defaultAuthor: 'Peter Kirn',
    language: 'en'
  },
  {
    id: 'lines-community',
    name: 'Lines (llllllll.co) Sound Community',
    url: 'https://llllllll.co/latest.rss',
    primaryTopic: 'sound_synthesis',
    topics: ['sound_synthesis'],
    defaultEvidenceTier: 'publisher_excerpt',
    defaultAuthor: 'Lines Community',
    language: 'en'
  },
  {
    id: 'synthtopia-modular',
    name: 'Synthtopia Modular & Electronic Music',
    url: 'https://www.synthtopia.com/feed/',
    primaryTopic: 'sound_synthesis',
    topics: ['sound_synthesis'],
    defaultEvidenceTier: 'publisher_excerpt',
    defaultAuthor: 'Synthtopia',
    language: 'en'
  },
  {
    id: 'bandcamp-daily',
    name: 'Bandcamp Daily Music Essays',
    url: 'https://daily.bandcamp.com/feed',
    primaryTopic: 'sound_synthesis',
    topics: ['sound_synthesis', 'art_aesthetics'],
    defaultEvidenceTier: 'publisher_excerpt',
    defaultAuthor: 'Bandcamp Daily',
    language: 'en'
  },

  // ============================================================================
  // 8. KUNST, ÄSTHETIK & VISUELLE KULTUR (3 Quellen + ArtIC / Commons OpenWeb)
  // ============================================================================
  {
    id: 'colossal-art',
    name: 'Colossal Art, Design & Visual Culture',
    url: 'https://www.thisiscolossal.com/feed/',
    primaryTopic: 'art_aesthetics',
    topics: ['art_aesthetics', 'contemplation_mind'],
    defaultEvidenceTier: 'publisher_excerpt',
    defaultAuthor: 'Colossal Editorial',
    language: 'en'
  },
  {
    id: 'hyperallergic-art',
    name: 'Hyperallergic Art & Perspectives',
    url: 'https://hyperallergic.com/feed/',
    primaryTopic: 'art_aesthetics',
    topics: ['art_aesthetics', 'philosophy_ethics'],
    defaultEvidenceTier: 'publisher_excerpt',
    defaultAuthor: 'Hyperallergic',
    language: 'en',
    isChallengingPerspective: true
  },
  {
    id: 'monopol-kunst',
    name: 'Monopol Magazin für Kunst und Leben',
    url: 'https://www.monopol-magazin.de/rss.xml',
    primaryTopic: 'art_aesthetics',
    topics: ['art_aesthetics', 'science_society'],
    defaultEvidenceTier: 'publisher_excerpt',
    defaultAuthor: 'Monopol Redaktion',
    language: 'de'
  },

  // ============================================================================
  // 9. DIDAKTIK, SCHULE & BILDUNG (3 Quellen)
  // ============================================================================
  {
    id: 'deutsches-schulportal',
    name: 'Das Deutsche Schulportal',
    url: 'https://deutsches-schulportal.de/feed/',
    primaryTopic: 'german_didactics',
    topics: ['german_didactics', 'science_society'],
    defaultEvidenceTier: 'publisher_excerpt',
    defaultAuthor: 'Robert Bosch Stiftung',
    language: 'de',
    isTeachingRelated: true
  },
  {
    id: 'deutscher-bildungsserver',
    name: 'Deutscher Bildungsserver (DIPF)',
    url: 'https://www.bildungsserver.de/rss/aktuelles_de.xml',
    primaryTopic: 'german_didactics',
    topics: ['german_didactics', 'science_society'],
    defaultEvidenceTier: 'publisher_excerpt',
    defaultAuthor: 'DIPF Bildungsforschung',
    language: 'de',
    isTeachingRelated: true
  },
  {
    id: 'edutopia-learning',
    name: 'Edutopia Learning Research',
    url: 'https://www.edutopia.org/rss.xml',
    primaryTopic: 'german_didactics',
    topics: ['german_didactics', 'contemplation_mind'],
    defaultEvidenceTier: 'publisher_excerpt',
    defaultAuthor: 'George Lucas Educational Foundation',
    language: 'en',
    isTeachingRelated: true
  },

  // ============================================================================
  // 10. SPIELERISCHES, HUMOR, COMICS & KURIOSES (3 Quellen)
  // ============================================================================
  {
    id: 'xkcd-comics',
    name: 'xkcd: Wissenschafts- & Tech-Satire',
    url: 'https://xkcd.com/atom.xml',
    primaryTopic: 'memes_satire',
    topics: ['memes_satire', 'ai_apple', 'science_society'],
    defaultEvidenceTier: 'permitted_full_text',
    defaultAuthor: 'Randall Munroe',
    language: 'en'
  },
  {
    id: 'smbc-comics',
    name: 'Saturday Morning Breakfast Cereal (SMBC)',
    url: 'https://www.smbc-comics.com/comic/rss',
    primaryTopic: 'memes_satire',
    topics: ['memes_satire', 'philosophy_ethics', 'science_society'],
    defaultEvidenceTier: 'permitted_full_text',
    defaultAuthor: 'Zach Weinersmith',
    language: 'en'
  },
  {
    id: 'futility-closet',
    name: 'Futility Closet (Curiosities & Paradoxes)',
    url: 'https://www.futilitycloset.com/feed/',
    primaryTopic: 'memes_satire',
    topics: ['memes_satire', 'science_society', 'philosophy_ethics'],
    defaultEvidenceTier: 'permitted_full_text',
    defaultAuthor: 'Greg Ross',
    language: 'en'
  },

  // ============================================================================
  // 11. YOUTUBE MEISTERKURSE (4 Quellen)
  // ============================================================================
  {
    id: 'yt-veritasium',
    name: 'Veritasium (Dr. Derek Muller)',
    url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCHnyfMqiRRG1u-2MsSQLbXA',
    primaryTopic: 'youtube_gems',
    topics: ['youtube_gems', 'science_society'],
    defaultEvidenceTier: 'publisher_excerpt',
    defaultAuthor: 'Veritasium',
    language: 'en'
  },
  {
    id: 'yt-3blue1brown',
    name: '3Blue1Brown',
    url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCYO_jab_esuFRV4b17AJtAw',
    primaryTopic: 'youtube_gems',
    topics: ['youtube_gems', 'ai_apple', 'science_society'],
    defaultEvidenceTier: 'publisher_excerpt',
    defaultAuthor: 'Grant Sanderson',
    language: 'en'
  },
  {
    id: 'yt-kurzgesagt-de',
    name: 'Kurzgesagt – Dinge Erklärt',
    url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCwRH985XgMYXQ6NxXDo8npw',
    primaryTopic: 'youtube_gems',
    topics: ['youtube_gems', 'science_society', 'philosophy_ethics'],
    defaultEvidenceTier: 'publisher_excerpt',
    defaultAuthor: 'Kurzgesagt Team',
    language: 'de'
  },
  {
    id: 'yt-huberman-lab',
    name: 'Huberman Lab (Stanford Neurobiology)',
    url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UC2D2CMWXMOVWx7giW1n3LIg',
    primaryTopic: 'youtube_gems',
    topics: ['youtube_gems', 'health_biohacking', 'contemplation_mind'],
    defaultEvidenceTier: 'publisher_excerpt',
    defaultAuthor: 'Prof. Andrew Huberman',
    language: 'en'
  },

  // ============================================================================
  // 12. ERWEITERUNG: FORSCHUNG UND WISSEN, TECHPRESSO, COMICS & BILINGUALER KANON (12 Quellen)
  // ============================================================================
  {
    id: 'forschung-und-wissen',
    name: 'Forschung und Wissen',
    url: 'https://www.forschung-und-wissen.de/feed.rss',
    primaryTopic: 'science_society',
    topics: ['science_society', 'health_biohacking', 'philosophy_ethics'],
    defaultEvidenceTier: 'publisher_excerpt',
    defaultAuthor: 'Forschung und Wissen Redaktion',
    language: 'de'
  },
  {
    id: 'techpresso-daily',
    name: 'Techpresso (Daily AI & Tech Digest)',
    url: 'https://rss.beehiiv.com/feeds/ez2zQOMePQ.xml',
    primaryTopic: 'ai_apple',
    topics: ['ai_apple', 'science_society', 'opportunities_growth'],
    defaultEvidenceTier: 'publisher_excerpt',
    defaultAuthor: 'Dupple Techpresso',
    language: 'en'
  },
  {
    id: 'idw-wissenschaft',
    name: 'Informationsdienst Wissenschaft (idw)',
    url: 'https://idw-online.de/de/news.rss',
    primaryTopic: 'science_society',
    topics: ['science_society', 'german_didactics', 'health_biohacking'],
    defaultEvidenceTier: 'publisher_excerpt',
    defaultAuthor: 'idw Forschungs-Pressemitteilungen',
    language: 'de'
  },
  {
    id: 'nautilus-magazine',
    name: 'Nautilus Magazine (Science Connected)',
    url: 'https://nautil.us/feed/',
    primaryTopic: 'science_society',
    topics: ['science_society', 'philosophy_ethics', 'art_aesthetics'],
    defaultEvidenceTier: 'publisher_excerpt',
    defaultAuthor: 'Nautilus Editorial',
    language: 'en'
  },
  {
    id: 'existential-comics',
    name: 'Existential Comics (Philosophy Webcomic)',
    url: 'https://existentialcomics.com/rss.xml',
    primaryTopic: 'memes_satire',
    topics: ['memes_satire', 'philosophy_ethics'],
    defaultEvidenceTier: 'permitted_full_text',
    defaultAuthor: 'Corey Mohler',
    language: 'en'
  },
  {
    id: 'pbf-comics',
    name: 'The Perry Bible Fellowship (PBF Comics)',
    url: 'https://pbfcomics.com/feed/',
    primaryTopic: 'memes_satire',
    topics: ['memes_satire', 'art_aesthetics'],
    defaultEvidenceTier: 'permitted_full_text',
    defaultAuthor: 'Nicholas Gurewitch',
    language: 'en'
  },
  {
    id: 'sketchplanations',
    name: 'Sketchplanations (Visual Mental Models)',
    url: 'https://sketchplanations.com/rss',
    primaryTopic: 'memes_satire',
    topics: ['memes_satire', 'science_society', 'german_didactics'],
    defaultEvidenceTier: 'permitted_full_text',
    defaultAuthor: 'Jono Hey',
    language: 'en',
    isTeachingRelated: true
  },
  {
    id: '3quarksdaily',
    name: '3 Quarks Daily (Science, Arts & Philosophy)',
    url: 'https://www.3quarksdaily.com/feed',
    primaryTopic: 'philosophy_ethics',
    topics: ['philosophy_ethics', 'science_society', 'book_mastery'],
    defaultEvidenceTier: 'publisher_excerpt',
    defaultAuthor: '3 Quarks Daily Curators',
    language: 'en',
    isChallengingPerspective: true
  },
  {
    id: 'geschichte-der-gegenwart',
    name: 'Geschichte der Gegenwart',
    url: 'https://geschichtedergegenwart.ch/feed/',
    primaryTopic: 'philosophy_ethics',
    topics: ['philosophy_ethics', 'science_society', 'book_mastery'],
    defaultEvidenceTier: 'publisher_excerpt',
    defaultAuthor: 'Geschichte der Gegenwart',
    language: 'de',
    isChallengingPerspective: true
  },
  {
    id: 'praefaktisch-philosophie',
    name: 'Praefaktisch – Ein Philosophieblog',
    url: 'https://www.praefaktisch.de/feed/',
    primaryTopic: 'philosophy_ethics',
    topics: ['philosophy_ethics', 'german_didactics', 'science_society'],
    defaultEvidenceTier: 'publisher_excerpt',
    defaultAuthor: 'Praefaktisch Redaktion',
    language: 'de',
    isTeachingRelated: true,
    isChallengingPerspective: true
  },
  {
    id: 'rest-of-world-tech',
    name: 'Rest of World (Global Technology & Culture)',
    url: 'https://restofworld.org/feed/latest/',
    primaryTopic: 'ai_apple',
    topics: ['ai_apple', 'science_society'],
    defaultEvidenceTier: 'publisher_excerpt',
    defaultAuthor: 'Rest of World',
    language: 'en',
    isChallengingPerspective: true
  },
  {
    id: 'low-tech-magazine',
    name: 'Low-Tech Magazine (Critical Technology)',
    url: 'https://solar.lowtechmagazine.com/feeds/all.atom.xml',
    primaryTopic: 'science_society',
    topics: ['science_society', 'philosophy_ethics', 'ai_apple'],
    defaultEvidenceTier: 'publisher_excerpt',
    defaultAuthor: 'Kris De Decker',
    language: 'en',
    isChallengingPerspective: true
  }
];

