import { RawFeedSource } from "./types";
import { GLOBAL_CORPUS_RESERVE_SOURCES } from "./globalCorpusSources";

/**
 * 380 Active, Verified DE & EN Sources across all 12 Knowledge Domains.
 */
const ACTIVE_CORE_SOURCES: RawFeedSource[] = [
  {
    "id": "tagesschau-wissen",
    "name": "ARD Tagesschau Wissen",
    "url": "https://www.tagesschau.de/wissen/index~rss2.xml",
    "primaryTopic": "science_society",
    "topics": [
      "science_society",
      "health_biohacking"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ARD Wissenschaftsredaktion",
    "language": "de"
  },
  {
    "id": "deutschlandfunk-nachrichten",
    "name": "Deutschlandfunk Nachrichten",
    "url": "https://www.deutschlandfunk.de/nachrichten-100.rss",
    "primaryTopic": "science_society",
    "topics": [
      "science_society",
      "philosophy_ethics"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Deutschlandfunk Redaktion",
    "language": "de"
  },
  {
    "id": "tagesschau-inland",
    "name": "ARD Tagesschau",
    "url": "https://www.tagesschau.de/infoservices/alle-meldungen-100~rss2.xml",
    "primaryTopic": "science_society",
    "topics": [
      "science_society",
      "philosophy_ethics"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ARD-aktuell",
    "language": "de"
  },
  {
    "id": "spektrum-wissenschaft",
    "name": "Spektrum der Wissenschaft",
    "url": "https://www.spektrum.de/alias/rss/spektrum-de-rss-feed/996406",
    "primaryTopic": "science_society",
    "topics": [
      "science_society",
      "contemplation_mind",
      "health_biohacking"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Spektrum Redaktion",
    "language": "de"
  },
  {
    "id": "br24-wissen",
    "name": "BR24 Wissen",
    "url": "https://nachrichtenfeeds.br.de/rdf/boards/QXAPkQJ",
    "primaryTopic": "science_society",
    "topics": [
      "science_society",
      "health_biohacking"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "BR Wissenschaft",
    "language": "de"
  },
  {
    "id": "dlf-forschung-aktuell",
    "name": "Deutschlandfunk Forschung Aktuell",
    "url": "https://www.deutschlandfunk.de/forschung-aktuell-100.rss",
    "primaryTopic": "science_society",
    "topics": [
      "science_society",
      "ai_apple"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "DLF Wissenschaft",
    "language": "de"
  },
  {
    "id": "nature-news",
    "name": "Nature News & Research",
    "url": "https://www.nature.com/nature.rss",
    "primaryTopic": "science_society",
    "topics": [
      "science_society",
      "health_biohacking"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Nature Portfolio",
    "language": "en"
  },
  {
    "id": "dlf-kultur-sein-und-streit",
    "name": "Deutschlandfunk Kultur",
    "url": "https://www.deutschlandfunkkultur.de/sein-und-streit-100.rss",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "DLF Kultur Philosophie",
    "language": "de",
    "isChallengingPerspective": true
  },
  {
    "id": "simon-willison",
    "name": "Simon Willison Weblog",
    "url": "https://simonwillison.net/atom/everything/",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple",
      "opportunities_growth"
    ],
    "defaultEvidenceTier": "permitted_full_text",
    "defaultAuthor": "Simon Willison",
    "language": "en"
  },
  {
    "id": "ars-technica",
    "name": "Ars Technica Science & Tech",
    "url": "https://feeds.arstechnica.com/arstechnica/index",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Ars Technica",
    "language": "en"
  },
  {
    "id": "lilian-weng-lillog",
    "name": "Lil'Log (Lilian Weng AI Research)",
    "url": "https://lilianweng.github.io/index.xml",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple",
      "science_society"
    ],
    "defaultEvidenceTier": "permitted_full_text",
    "defaultAuthor": "Lilian Weng",
    "language": "en"
  },
  {
    "id": "arxiv-cs-ai",
    "name": "arXiv CS.AI & Computation",
    "url": "https://rss.arxiv.org/rss/cs.AI",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "arXiv Preprint Authors",
    "language": "en"
  },
  {
    "id": "mit-tech-review",
    "name": "MIT Technology Review",
    "url": "https://www.technologyreview.com/feed/",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple",
      "science_society",
      "philosophy_ethics"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "MIT Technology Review",
    "language": "en"
  },
  {
    "id": "huggingface-blog",
    "name": "Hugging Face Open-Source AI",
    "url": "https://huggingface.co/blog/feed.xml",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple",
      "opportunities_growth"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Hugging Face Research",
    "language": "en"
  },
  {
    "id": "import-ai-clark",
    "name": "Import AI (Jack Clark)",
    "url": "https://importai.substack.com/feed",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple",
      "philosophy_ethics"
    ],
    "defaultEvidenceTier": "permitted_full_text",
    "defaultAuthor": "Jack Clark",
    "language": "en",
    "isChallengingPerspective": true
  },
  {
    "id": "sciencedaily-mind-brain",
    "name": "ScienceDaily Mind & Brain",
    "url": "https://www.sciencedaily.com/rss/mind_brain.xml",
    "primaryTopic": "health_biohacking",
    "topics": [
      "health_biohacking",
      "contemplation_mind",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ScienceDaily Research",
    "language": "en"
  },
  {
    "id": "scinexx-wissen",
    "name": "scinexx Das Wissensmagazin",
    "url": "https://www.scinexx.de/feed/",
    "primaryTopic": "science_society",
    "topics": [
      "science_society",
      "health_biohacking"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "scinexx Redaktion",
    "language": "de"
  },
  {
    "id": "aeon-essays",
    "name": "Aeon Magazine",
    "url": "https://aeon.co/feed.rss",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "contemplation_mind",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Aeon Authors",
    "language": "en",
    "isChallengingPerspective": true
  },
  {
    "id": "zdf-heute",
    "name": "ZDFheute Wissen & Politik",
    "url": "https://www.zdf.de/rss/zdf/nachrichten",
    "primaryTopic": "science_society",
    "topics": [
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ZDFheute Redaktion",
    "language": "de"
  },
  {
    "id": "public-domain-review",
    "name": "The Public Domain Review",
    "url": "https://publicdomainreview.org/rss.xml",
    "primaryTopic": "book_mastery",
    "topics": [
      "book_mastery",
      "art_aesthetics",
      "philosophy_ethics"
    ],
    "defaultEvidenceTier": "permitted_full_text",
    "defaultAuthor": "Public Domain Review",
    "language": "en"
  },
  {
    "id": "psyche-magazine",
    "name": "Psyche (by Aeon)",
    "url": "https://psyche.co/feed.rss",
    "primaryTopic": "contemplation_mind",
    "topics": [
      "contemplation_mind",
      "philosophy_ethics",
      "health_biohacking"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Psyche Editorial",
    "language": "en"
  },
  {
    "id": "daily-nous",
    "name": "Daily Nous Philosophy",
    "url": "https://dailynous.com/feed/",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "ai_apple",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Justin Weinberg",
    "language": "en",
    "isChallengingPerspective": true
  },
  {
    "id": "lobsters-community",
    "name": "Lobsters Computing Community",
    "url": "https://lobste.rs/rss",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple",
      "opportunities_growth"
    ],
    "defaultEvidenceTier": "metadata_only",
    "defaultAuthor": "Lobsters Community",
    "language": "en"
  },
  {
    "id": "netzpolitik-org",
    "name": "netzpolitik.org",
    "url": "https://netzpolitik.org/feed/",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "ai_apple",
      "science_society"
    ],
    "defaultEvidenceTier": "permitted_full_text",
    "defaultAuthor": "netzpolitik.org Redaktion",
    "language": "de",
    "isChallengingPerspective": true
  },
  {
    "id": "sep-whats-new",
    "name": "Stanford Encyclopedia of Philosophy",
    "url": "https://plato.stanford.edu/rss/sep.xml",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Stanford Philosophy Dept.",
    "language": "en",
    "isChallengingPerspective": true
  },
  {
    "id": "astral-codex-ten",
    "name": "Astral Codex Ten",
    "url": "https://www.astralcodexten.com/feed",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "science_society",
      "ai_apple"
    ],
    "defaultEvidenceTier": "permitted_full_text",
    "defaultAuthor": "Scott Alexander",
    "language": "en",
    "isChallengingPerspective": true
  },
  {
    "id": "quanta-magazine",
    "name": "Quanta Magazine",
    "url": "https://api.quantamagazine.org/feed/",
    "primaryTopic": "science_society",
    "topics": [
      "science_society",
      "ai_apple",
      "philosophy_ethics"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Quanta Editorial",
    "language": "en"
  },
  {
    "id": "heise-developer",
    "name": "Heise Developer & KI",
    "url": "https://www.heise.de/developer/rss/news-atom.xml",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Heise Redaktion",
    "language": "de"
  },
  {
    "id": "philosophy-now",
    "name": "Philosophy Now",
    "url": "https://philosophynow.org/rss",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "book_mastery"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Philosophy Now",
    "language": "en",
    "isChallengingPerspective": true
  },
  {
    "id": "the-marginalian",
    "name": "The Marginalian (Maria Popova)",
    "url": "https://www.themarginalian.org/feed/",
    "primaryTopic": "book_mastery",
    "topics": [
      "book_mastery",
      "philosophy_ethics",
      "art_aesthetics"
    ],
    "defaultEvidenceTier": "permitted_full_text",
    "defaultAuthor": "Maria Popova",
    "language": "en"
  },
  {
    "id": "monopol-kunst",
    "name": "Monopol Magazin für Kunst und Leben",
    "url": "https://www.monopol-magazin.de/rss.xml",
    "primaryTopic": "art_aesthetics",
    "topics": [
      "art_aesthetics",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Monopol Redaktion",
    "language": "de"
  },
  {
    "id": "dlf-buechermarkt",
    "name": "Deutschlandfunk Büchermarkt",
    "url": "https://www.deutschlandfunk.de/buechermarkt-100.rss",
    "primaryTopic": "book_mastery",
    "topics": [
      "book_mastery",
      "philosophy_ethics",
      "german_didactics"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Deutschlandfunk Kultur",
    "language": "de",
    "isTeachingRelated": true
  },
  {
    "id": "cdm-music",
    "name": "Create Digital Music (CDM)",
    "url": "https://cdm.link/feed/",
    "primaryTopic": "sound_synthesis",
    "topics": [
      "sound_synthesis",
      "ai_apple"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Peter Kirn",
    "language": "en"
  },
  {
    "id": "tagesschau-ausland",
    "name": "ARD Tagesschau Ausland",
    "url": "https://www.tagesschau.de/ausland/index~rss2.xml",
    "primaryTopic": "science_society",
    "topics": [
      "science_society",
      "philosophy_ethics"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ARD Auslandsredaktion",
    "language": "de"
  },
  {
    "id": "lions-roar-buddhism",
    "name": "Lion's Roar Buddhist Wisdom",
    "url": "https://www.lionsroar.com/feed/",
    "primaryTopic": "contemplation_mind",
    "topics": [
      "contemplation_mind",
      "philosophy_ethics",
      "health_biohacking"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Lion's Roar",
    "language": "en"
  },
  {
    "id": "tagesschau-wirtschaft",
    "name": "ARD Tagesschau Wirtschaft",
    "url": "https://www.tagesschau.de/wirtschaft/index~rss2.xml",
    "primaryTopic": "opportunities_growth",
    "topics": [
      "opportunities_growth",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ARD Wirtschaftsredaktion",
    "language": "de"
  },
  {
    "id": "xkcd-comics",
    "name": "xkcd: Wissenschafts- & Tech-Satire",
    "url": "https://xkcd.com/atom.xml",
    "primaryTopic": "memes_satire",
    "topics": [
      "memes_satire",
      "ai_apple",
      "science_society"
    ],
    "defaultEvidenceTier": "permitted_full_text",
    "defaultAuthor": "Randall Munroe",
    "language": "en"
  },
  {
    "id": "synthtopia-modular",
    "name": "Synthtopia Modular & Electronic Music",
    "url": "https://www.synthtopia.com/feed/",
    "primaryTopic": "sound_synthesis",
    "topics": [
      "sound_synthesis"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Synthtopia",
    "language": "en"
  },
  {
    "id": "bandcamp-daily",
    "name": "Bandcamp Daily Music Essays",
    "url": "https://daily.bandcamp.com/feed",
    "primaryTopic": "sound_synthesis",
    "topics": [
      "sound_synthesis",
      "art_aesthetics"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Bandcamp Daily",
    "language": "en"
  },
  {
    "id": "tagesschau-wissen-klima",
    "name": "ARD Tagesschau Klima & Umwelt",
    "url": "https://www.tagesschau.de/wissen/klima/index~rss2.xml",
    "primaryTopic": "science_society",
    "topics": [
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ARD Klimaredaktion",
    "language": "de"
  },
  {
    "id": "tagesschau-faktenfinder",
    "name": "ARD faktenfinder (Verifikation & Analyse)",
    "url": "https://www.tagesschau.de/faktenfinder/index~rss2.xml",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "science_society",
      "german_didactics"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ARD faktenfinder",
    "language": "de",
    "isTeachingRelated": true,
    "isChallengingPerspective": true
  },
  {
    "id": "yt-3blue1brown",
    "name": "3Blue1Brown",
    "url": "https://www.youtube.com/feeds/videos.xml?channel_id=UCYO_jab_esuFRV4b17AJtAw",
    "primaryTopic": "youtube_gems",
    "topics": [
      "youtube_gems",
      "ai_apple",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Grant Sanderson",
    "language": "en"
  },
  {
    "id": "yt-veritasium",
    "name": "Veritasium (Dr. Derek Muller)",
    "url": "https://www.youtube.com/feeds/videos.xml?channel_id=UCHnyfMqiRRG1u-2MsSQLbXA",
    "primaryTopic": "youtube_gems",
    "topics": [
      "youtube_gems",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Veritasium",
    "language": "en"
  },
  {
    "id": "yt-kurzgesagt-de",
    "name": "Kurzgesagt – Dinge Erklärt",
    "url": "https://www.youtube.com/feeds/videos.xml?channel_id=UCwRH985XgMYXQ6NxXDo8npw",
    "primaryTopic": "youtube_gems",
    "topics": [
      "youtube_gems",
      "science_society",
      "philosophy_ethics"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Kurzgesagt Team",
    "language": "de"
  },
  {
    "id": "deutsches-schulportal",
    "name": "Das Deutsche Schulportal",
    "url": "https://deutsches-schulportal.de/feed/",
    "primaryTopic": "german_didactics",
    "topics": [
      "german_didactics",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Robert Bosch Stiftung",
    "language": "de",
    "isTeachingRelated": true
  },
  {
    "id": "yt-huberman-lab",
    "name": "Huberman Lab (Stanford Neurobiology)",
    "url": "https://www.youtube.com/feeds/videos.xml?channel_id=UC2D2CMWXMOVWx7giW1n3LIg",
    "primaryTopic": "youtube_gems",
    "topics": [
      "youtube_gems",
      "health_biohacking",
      "contemplation_mind"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Prof. Andrew Huberman",
    "language": "en"
  },
  {
    "id": "smbc-comics",
    "name": "Saturday Morning Breakfast Cereal (SMBC)",
    "url": "https://www.smbc-comics.com/comic/rss",
    "primaryTopic": "memes_satire",
    "topics": [
      "memes_satire",
      "philosophy_ethics",
      "science_society"
    ],
    "defaultEvidenceTier": "permitted_full_text",
    "defaultAuthor": "Zach Weinersmith",
    "language": "en"
  },
  {
    "id": "colossal-art",
    "name": "Colossal Art, Design & Visual Culture",
    "url": "https://www.thisiscolossal.com/feed/",
    "primaryTopic": "art_aesthetics",
    "topics": [
      "art_aesthetics",
      "contemplation_mind"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Colossal Editorial",
    "language": "en"
  },
  {
    "id": "dlf-essay-und-diskurs",
    "name": "Deutschlandfunk Essay und Diskurs",
    "url": "https://www.deutschlandfunk.de/essay-und-diskurs-100.rss",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "book_mastery",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "DLF Essay & Diskurs",
    "language": "de",
    "isChallengingPerspective": true
  },
  {
    "id": "rest-of-world-tech",
    "name": "Rest of World (Global Technology & Culture)",
    "url": "https://restofworld.org/feed/latest/",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Rest of World",
    "language": "en",
    "isChallengingPerspective": true
  },
  {
    "id": "hyperallergic-art",
    "name": "Hyperallergic Art & Perspectives",
    "url": "https://hyperallergic.com/feed/",
    "primaryTopic": "art_aesthetics",
    "topics": [
      "art_aesthetics",
      "philosophy_ethics"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Hyperallergic",
    "language": "en",
    "isChallengingPerspective": true
  },
  {
    "id": "dlf-kultur-sozialwissenschaften",
    "name": "DLF Aus Kultur- und Sozialwissenschaften",
    "url": "https://www.deutschlandfunk.de/aus-kultur-und-sozialwissenschaften-100.rss",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "science_society",
      "german_didactics"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "DLF Kulturwissenschaften",
    "language": "de",
    "isTeachingRelated": true
  },
  {
    "id": "tagesschau-wissen-gesundheit",
    "name": "ARD Tagesschau Gesundheit",
    "url": "https://www.tagesschau.de/wissen/gesundheit/index~rss2.xml",
    "primaryTopic": "health_biohacking",
    "topics": [
      "health_biohacking",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ARD Gesundheitsredaktion",
    "language": "de"
  },
  {
    "id": "tricycle-buddhist",
    "name": "Tricycle: The Buddhist Review",
    "url": "https://tricycle.org/feed/",
    "primaryTopic": "contemplation_mind",
    "topics": [
      "contemplation_mind",
      "philosophy_ethics"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Tricycle Editorial",
    "language": "en"
  },
  {
    "id": "tagesschau-wissen-technologie",
    "name": "ARD Tagesschau Technologie",
    "url": "https://www.tagesschau.de/wissen/technologie/index~rss2.xml",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ARD Technologieredaktion",
    "language": "de"
  },
  {
    "id": "sketchplanations",
    "name": "Sketchplanations (Visual Mental Models)",
    "url": "https://sketchplanations.com/rss",
    "primaryTopic": "memes_satire",
    "topics": [
      "memes_satire",
      "science_society",
      "german_didactics"
    ],
    "defaultEvidenceTier": "permitted_full_text",
    "defaultAuthor": "Jono Hey",
    "language": "en",
    "isTeachingRelated": true
  },
  {
    "id": "pbf-comics",
    "name": "The Perry Bible Fellowship (PBF Comics)",
    "url": "https://pbfcomics.com/feed/",
    "primaryTopic": "memes_satire",
    "topics": [
      "memes_satire",
      "art_aesthetics"
    ],
    "defaultEvidenceTier": "permitted_full_text",
    "defaultAuthor": "Nicholas Gurewitch",
    "language": "en"
  },
  {
    "id": "lines-community",
    "name": "Lines (llllllll.co) Sound Community",
    "url": "https://llllllll.co/latest.rss",
    "primaryTopic": "sound_synthesis",
    "topics": [
      "sound_synthesis"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Lines Community",
    "language": "en"
  },
  {
    "id": "tagesschau-investigativ",
    "name": "ARD Investigativ",
    "url": "https://www.tagesschau.de/investigativ/index~rss2.xml",
    "primaryTopic": "science_society",
    "topics": [
      "science_society",
      "philosophy_ethics"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ARD Rechercheverbund",
    "language": "de",
    "isChallengingPerspective": true
  },
  {
    "id": "forschung-und-wissen",
    "name": "Forschung und Wissen",
    "url": "https://www.forschung-und-wissen.de/feed.rss",
    "primaryTopic": "science_society",
    "topics": [
      "science_society",
      "health_biohacking",
      "philosophy_ethics"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Forschung und Wissen Redaktion",
    "language": "de"
  },
  {
    "id": "existential-comics",
    "name": "Existential Comics (Philosophy Webcomic)",
    "url": "https://existentialcomics.com/rss.xml",
    "primaryTopic": "memes_satire",
    "topics": [
      "memes_satire",
      "philosophy_ethics"
    ],
    "defaultEvidenceTier": "permitted_full_text",
    "defaultAuthor": "Corey Mohler",
    "language": "en"
  },
  {
    "id": "dlf-hintergrund",
    "name": "Deutschlandfunk Hintergrund (Tiefenanalyse)",
    "url": "https://www.deutschlandfunk.de/hintergrund-100.rss",
    "primaryTopic": "science_society",
    "topics": [
      "science_society",
      "philosophy_ethics",
      "german_didactics"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "DLF Hintergrund",
    "language": "de",
    "isTeachingRelated": true,
    "isChallengingPerspective": true
  },
  {
    "id": "nautilus-magazine",
    "name": "Nautilus Magazine (Science Connected)",
    "url": "https://nautil.us/feed/",
    "primaryTopic": "science_society",
    "topics": [
      "science_society",
      "philosophy_ethics",
      "art_aesthetics"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Nautilus Editorial",
    "language": "en"
  },
  {
    "id": "dlfkultur-zeitfragen",
    "name": "Deutschlandfunk Kultur Zeitfragen",
    "url": "https://www.deutschlandfunkkultur.de/zeitfragen-100.rss",
    "primaryTopic": "science_society",
    "topics": [
      "science_society",
      "philosophy_ethics"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "DLF Kultur Zeitfragen",
    "language": "de",
    "isChallengingPerspective": true
  },
  {
    "id": "tagesschau-wissen-forschung",
    "name": "ARD Tagesschau Forschung",
    "url": "https://www.tagesschau.de/wissen/forschung/index~rss2.xml",
    "primaryTopic": "science_society",
    "topics": [
      "science_society",
      "health_biohacking"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ARD Wissenschaft",
    "language": "de"
  },
  {
    "id": "dlf-musikjournal",
    "name": "Deutschlandfunk Musikjournal",
    "url": "https://www.deutschlandfunk.de/musikjournal-100.rss",
    "primaryTopic": "sound_synthesis",
    "topics": [
      "sound_synthesis",
      "art_aesthetics"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "DLF Musikredaktion",
    "language": "de"
  },
  {
    "id": "geschichte-der-gegenwart",
    "name": "Geschichte der Gegenwart",
    "url": "https://geschichtedergegenwart.ch/feed/",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "science_society",
      "book_mastery"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Geschichte der Gegenwart",
    "language": "de",
    "isChallengingPerspective": true
  },
  {
    "id": "dlf-tag-fuer-tag",
    "name": "Deutschlandfunk Tag für Tag (Religion & Kontemplation)",
    "url": "https://www.deutschlandfunk.de/tag-fuer-tag-100.rss",
    "primaryTopic": "contemplation_mind",
    "topics": [
      "contemplation_mind",
      "philosophy_ethics"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "DLF Tag für Tag",
    "language": "de"
  },
  {
    "id": "dlf-corso",
    "name": "Deutschlandfunk Corso (Kunst & Popkultur)",
    "url": "https://www.deutschlandfunk.de/corso-100.rss",
    "primaryTopic": "art_aesthetics",
    "topics": [
      "art_aesthetics",
      "sound_synthesis"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "DLF Corso",
    "language": "de"
  },
  {
    "id": "dlf-computer-kommunikation",
    "name": "Deutschlandfunk Computer und Kommunikation",
    "url": "https://www.deutschlandfunk.de/computer-und-kommunikation-100.rss",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "DLF Digitalredaktion",
    "language": "de"
  },
  {
    "id": "dlfkultur-buchkritik",
    "name": "Deutschlandfunk Kultur Buchkritik",
    "url": "https://www.deutschlandfunkkultur.de/buchkritik-100.rss",
    "primaryTopic": "book_mastery",
    "topics": [
      "book_mastery",
      "philosophy_ethics"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "DLF Kultur Buchkritik",
    "language": "de"
  },
  {
    "id": "plum-village-mindfulness",
    "name": "Plum Village (Thich Nhat Hanh Monastery)",
    "url": "https://plumvillage.org/feed/",
    "primaryTopic": "contemplation_mind",
    "topics": [
      "contemplation_mind",
      "health_biohacking",
      "philosophy_ethics"
    ],
    "defaultEvidenceTier": "permitted_full_text",
    "defaultAuthor": "Plum Village Sangha",
    "language": "en"
  },
  {
    "id": "dlf-sprechstunde",
    "name": "Deutschlandfunk Sprechstunde (Medizin & Gesundheit)",
    "url": "https://www.deutschlandfunk.de/sprechstunde-100.rss",
    "primaryTopic": "health_biohacking",
    "topics": [
      "health_biohacking",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "DLF Medizinredaktion",
    "language": "de"
  },
  {
    "id": "dlfkultur-breitband",
    "name": "Deutschlandfunk Kultur Breitband (Netz & Digitale Kultur)",
    "url": "https://www.deutschlandfunkkultur.de/breitband-100.rss",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple",
      "philosophy_ethics",
      "german_didactics"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "DLF Kultur Breitband",
    "language": "de",
    "isTeachingRelated": true
  },
  {
    "id": "sd-top-science",
    "name": "ScienceDaily Top Science",
    "url": "https://www.sciencedaily.com/rss/top/science.xml",
    "primaryTopic": "science_society",
    "topics": [
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ScienceDaily",
    "language": "en"
  },
  {
    "id": "dlfkultur-politisches-feuilleton",
    "name": "Deutschlandfunk Kultur Politisches Feuilleton",
    "url": "https://www.deutschlandfunkkultur.de/politisches-feuilleton-100.rss",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "DLF Kultur Feuilleton",
    "language": "de",
    "isChallengingPerspective": true
  },
  {
    "id": "futility-closet",
    "name": "Futility Closet (Curiosities & Paradoxes)",
    "url": "https://www.futilitycloset.com/feed/",
    "primaryTopic": "memes_satire",
    "topics": [
      "memes_satire",
      "science_society",
      "philosophy_ethics"
    ],
    "defaultEvidenceTier": "permitted_full_text",
    "defaultAuthor": "Greg Ross",
    "language": "en"
  },
  {
    "id": "sd-top-env",
    "name": "ScienceDaily Top Environment",
    "url": "https://www.sciencedaily.com/rss/top/environment.xml",
    "primaryTopic": "science_society",
    "topics": [
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ScienceDaily",
    "language": "en"
  },
  {
    "id": "sd-top-society",
    "name": "ScienceDaily Science & Society",
    "url": "https://www.sciencedaily.com/rss/top/society.xml",
    "primaryTopic": "science_society",
    "topics": [
      "science_society",
      "philosophy_ethics"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ScienceDaily",
    "language": "en"
  },
  {
    "id": "sd-psychology",
    "name": "ScienceDaily Cognitive Psychology",
    "url": "https://www.sciencedaily.com/rss/mind_brain/psychology.xml",
    "primaryTopic": "contemplation_mind",
    "topics": [
      "contemplation_mind",
      "german_didactics"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ScienceDaily Psychology",
    "language": "en",
    "isTeachingRelated": true
  },
  {
    "id": "sd-creativity",
    "name": "ScienceDaily Neuroscience of Creativity",
    "url": "https://www.sciencedaily.com/rss/mind_brain/creativity.xml",
    "primaryTopic": "art_aesthetics",
    "topics": [
      "art_aesthetics",
      "sound_synthesis",
      "contemplation_mind"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ScienceDaily",
    "language": "en"
  },
  {
    "id": "dlfkultur-echtzeit",
    "name": "Deutschlandfunk Kultur Echtzeit (Alltagskultur & Gesellschaft)",
    "url": "https://www.deutschlandfunkkultur.de/echtzeit-100.rss",
    "primaryTopic": "contemplation_mind",
    "topics": [
      "contemplation_mind",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "DLF Kultur Echtzeit",
    "language": "de"
  },
  {
    "id": "low-tech-magazine",
    "name": "Low-Tech Magazine (Critical Technology)",
    "url": "https://solar.lowtechmagazine.com/feeds/all.atom.xml",
    "primaryTopic": "science_society",
    "topics": [
      "science_society",
      "philosophy_ethics",
      "ai_apple"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Kris De Decker",
    "language": "en",
    "isChallengingPerspective": true
  },
  {
    "id": "sd-top-tech",
    "name": "ScienceDaily Top Technology",
    "url": "https://www.sciencedaily.com/rss/top/technology.xml",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ScienceDaily",
    "language": "en"
  },
  {
    "id": "sd-intelligence",
    "name": "ScienceDaily Human Intelligence",
    "url": "https://www.sciencedaily.com/rss/mind_brain/intelligence.xml",
    "primaryTopic": "german_didactics",
    "topics": [
      "german_didactics",
      "contemplation_mind"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ScienceDaily",
    "language": "en",
    "isTeachingRelated": true
  },
  {
    "id": "dlfkultur-lesart",
    "name": "Deutschlandfunk Kultur Lesart (Literaturmagazin)",
    "url": "https://www.deutschlandfunkkultur.de/lesart-100.rss",
    "primaryTopic": "book_mastery",
    "topics": [
      "book_mastery",
      "german_didactics"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "DLF Kultur Lesart",
    "language": "de",
    "isTeachingRelated": true
  },
  {
    "id": "sd-child-development",
    "name": "ScienceDaily Learning & Child Development",
    "url": "https://www.sciencedaily.com/rss/mind_brain/child_development.xml",
    "primaryTopic": "german_didactics",
    "topics": [
      "german_didactics"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ScienceDaily",
    "language": "en",
    "isTeachingRelated": true
  },
  {
    "id": "dlfkultur-kompressor",
    "name": "Deutschlandfunk Kultur Kompressor (Ästhetik & Popkultur)",
    "url": "https://www.deutschlandfunkkultur.de/kompressor-100.rss",
    "primaryTopic": "art_aesthetics",
    "topics": [
      "art_aesthetics",
      "sound_synthesis"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "DLF Kultur Kompressor",
    "language": "de"
  },
  {
    "id": "dlfkultur-tonart",
    "name": "Deutschlandfunk Kultur Tonart (Klang & Musik)",
    "url": "https://www.deutschlandfunkkultur.de/tonart-100.rss",
    "primaryTopic": "sound_synthesis",
    "topics": [
      "sound_synthesis",
      "art_aesthetics"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "DLF Kultur Tonart",
    "language": "de"
  },
  {
    "id": "sd-vr",
    "name": "ScienceDaily Virtual Reality & Spatial Computing",
    "url": "https://www.sciencedaily.com/rss/computers_math/virtual_reality.xml",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple",
      "art_aesthetics"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ScienceDaily",
    "language": "en"
  },
  {
    "id": "sd-stress",
    "name": "ScienceDaily Stress & Nervous System Regulation",
    "url": "https://www.sciencedaily.com/rss/mind_brain/stress.xml",
    "primaryTopic": "contemplation_mind",
    "topics": [
      "contemplation_mind",
      "health_biohacking"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ScienceDaily",
    "language": "en"
  },
  {
    "id": "sd-materials-science",
    "name": "ScienceDaily Materials Science",
    "url": "https://www.sciencedaily.com/rss/matter_energy/materials_science.xml",
    "primaryTopic": "science_society",
    "topics": [
      "science_society",
      "opportunities_growth"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ScienceDaily",
    "language": "en"
  },
  {
    "id": "sd-top-health",
    "name": "ScienceDaily Top Health & Medicine",
    "url": "https://www.sciencedaily.com/rss/top/health.xml",
    "primaryTopic": "health_biohacking",
    "topics": [
      "health_biohacking",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ScienceDaily",
    "language": "en"
  },
  {
    "id": "sd-neural-interfaces",
    "name": "ScienceDaily Neural Interfaces & BCI",
    "url": "https://www.sciencedaily.com/rss/computers_math/neural_interfaces.xml",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple",
      "health_biohacking"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ScienceDaily BCI",
    "language": "en"
  },
  {
    "id": "sd-biochemistry",
    "name": "ScienceDaily Biochemistry",
    "url": "https://www.sciencedaily.com/rss/matter_energy/biochemistry.xml",
    "primaryTopic": "health_biohacking",
    "topics": [
      "health_biohacking",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ScienceDaily",
    "language": "en"
  },
  {
    "id": "techpresso-daily",
    "name": "Techpresso (Daily AI & Tech Digest)",
    "url": "https://rss.beehiiv.com/feeds/ez2zQOMePQ.xml",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple",
      "science_society",
      "opportunities_growth"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Dupple Techpresso",
    "language": "en"
  },
  {
    "id": "sd-neuroscience",
    "name": "ScienceDaily Neuroscience",
    "url": "https://www.sciencedaily.com/rss/mind_brain/neuroscience.xml",
    "primaryTopic": "health_biohacking",
    "topics": [
      "health_biohacking",
      "contemplation_mind"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ScienceDaily Neuroscience",
    "language": "en"
  },
  {
    "id": "sd-perception",
    "name": "ScienceDaily Perception & Senses",
    "url": "https://www.sciencedaily.com/rss/mind_brain/perception.xml",
    "primaryTopic": "contemplation_mind",
    "topics": [
      "contemplation_mind",
      "art_aesthetics"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ScienceDaily",
    "language": "en"
  },
  {
    "id": "sd-language-acquisition",
    "name": "ScienceDaily Language Acquisition & Linguistics",
    "url": "https://www.sciencedaily.com/rss/mind_brain/language_acquisition.xml",
    "primaryTopic": "german_didactics",
    "topics": [
      "german_didactics",
      "book_mastery"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ScienceDaily",
    "language": "en",
    "isTeachingRelated": true
  },
  {
    "id": "sd-memory",
    "name": "ScienceDaily Memory & Retention",
    "url": "https://www.sciencedaily.com/rss/mind_brain/memory.xml",
    "primaryTopic": "german_didactics",
    "topics": [
      "german_didactics",
      "health_biohacking"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ScienceDaily",
    "language": "en",
    "isTeachingRelated": true
  },
  {
    "id": "sd-educational-psychology",
    "name": "ScienceDaily Educational Psychology",
    "url": "https://www.sciencedaily.com/rss/mind_brain/educational_psychology.xml",
    "primaryTopic": "german_didactics",
    "topics": [
      "german_didactics",
      "contemplation_mind"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ScienceDaily",
    "language": "en",
    "isTeachingRelated": true
  },
  {
    "id": "sd-physics",
    "name": "ScienceDaily Physics",
    "url": "https://www.sciencedaily.com/rss/matter_energy/physics.xml",
    "primaryTopic": "science_society",
    "topics": [
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ScienceDaily Physics",
    "language": "en"
  },
  {
    "id": "sd-astronomy",
    "name": "ScienceDaily Astronomy",
    "url": "https://www.sciencedaily.com/rss/space_time/astronomy.xml",
    "primaryTopic": "science_society",
    "topics": [
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ScienceDaily Space",
    "language": "en"
  },
  {
    "id": "sd-cosmology",
    "name": "ScienceDaily Cosmology",
    "url": "https://www.sciencedaily.com/rss/space_time/cosmology.xml",
    "primaryTopic": "science_society",
    "topics": [
      "science_society",
      "philosophy_ethics"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ScienceDaily Space",
    "language": "en"
  },
  {
    "id": "sd-molecular-biology",
    "name": "ScienceDaily Molecular Biology",
    "url": "https://www.sciencedaily.com/rss/plants_animals/molecular_biology.xml",
    "primaryTopic": "health_biohacking",
    "topics": [
      "health_biohacking",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ScienceDaily",
    "language": "en"
  },
  {
    "id": "sd-ai",
    "name": "ScienceDaily Artificial Intelligence",
    "url": "https://www.sciencedaily.com/rss/computers_math/artificial_intelligence.xml",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ScienceDaily AI",
    "language": "en"
  },
  {
    "id": "sd-chemistry",
    "name": "ScienceDaily Chemistry",
    "url": "https://www.sciencedaily.com/rss/matter_energy/chemistry.xml",
    "primaryTopic": "science_society",
    "topics": [
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ScienceDaily",
    "language": "en"
  },
  {
    "id": "sd-genetics",
    "name": "ScienceDaily Genetics & Genomics",
    "url": "https://www.sciencedaily.com/rss/plants_animals/genetics.xml",
    "primaryTopic": "health_biohacking",
    "topics": [
      "health_biohacking",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ScienceDaily Genetics",
    "language": "en"
  },
  {
    "id": "sd-astrophysics",
    "name": "ScienceDaily Astrophysics",
    "url": "https://www.sciencedaily.com/rss/space_time/astrophysics.xml",
    "primaryTopic": "science_society",
    "topics": [
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ScienceDaily Space",
    "language": "en"
  },
  {
    "id": "sd-black-holes",
    "name": "ScienceDaily Black Holes & Relativity",
    "url": "https://www.sciencedaily.com/rss/space_time/black_holes.xml",
    "primaryTopic": "science_society",
    "topics": [
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ScienceDaily Space",
    "language": "en"
  },
  {
    "id": "sd-ecology",
    "name": "ScienceDaily Ecology & Ecosystems",
    "url": "https://www.sciencedaily.com/rss/plants_animals/ecology.xml",
    "primaryTopic": "science_society",
    "topics": [
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ScienceDaily",
    "language": "en"
  },
  {
    "id": "sd-anthropology",
    "name": "ScienceDaily Cultural & Biological Anthropology",
    "url": "https://www.sciencedaily.com/rss/fossils_ruins/anthropology.xml",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ScienceDaily",
    "language": "en"
  },
  {
    "id": "sd-fitness",
    "name": "ScienceDaily Exercise Physiology & Fitness",
    "url": "https://www.sciencedaily.com/rss/health_medicine/fitness.xml",
    "primaryTopic": "health_biohacking",
    "topics": [
      "health_biohacking"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ScienceDaily Health",
    "language": "en"
  },
  {
    "id": "sd-nutrition",
    "name": "ScienceDaily Clinical Nutrition & Metabolism",
    "url": "https://www.sciencedaily.com/rss/health_medicine/nutrition.xml",
    "primaryTopic": "health_biohacking",
    "topics": [
      "health_biohacking"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ScienceDaily Health",
    "language": "en"
  },
  {
    "id": "sd-social-psychology",
    "name": "ScienceDaily Social Psychology",
    "url": "https://www.sciencedaily.com/rss/mind_brain/social_psychology.xml",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ScienceDaily",
    "language": "en",
    "isChallengingPerspective": true
  },
  {
    "id": "sd-robotics",
    "name": "ScienceDaily Robotics & Autonomous Systems",
    "url": "https://www.sciencedaily.com/rss/computers_math/robotics.xml",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple",
      "opportunities_growth"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ScienceDaily Robotics",
    "language": "en"
  },
  {
    "id": "sd-climate",
    "name": "ScienceDaily Global Climate Research",
    "url": "https://www.sciencedaily.com/rss/earth_climate/climate.xml",
    "primaryTopic": "science_society",
    "topics": [
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ScienceDaily Earth",
    "language": "en"
  },
  {
    "id": "sd-quantum-physics",
    "name": "ScienceDaily Quantum Physics",
    "url": "https://www.sciencedaily.com/rss/matter_energy/quantum_physics.xml",
    "primaryTopic": "science_society",
    "topics": [
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ScienceDaily Physics",
    "language": "en"
  },
  {
    "id": "sd-quantum-computers",
    "name": "ScienceDaily Quantum Computing",
    "url": "https://www.sciencedaily.com/rss/computers_math/quantum_computers.xml",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ScienceDaily Quantum",
    "language": "en"
  },
  {
    "id": "nature-neuroscience-subj",
    "name": "Nature Neuroscience Research",
    "url": "https://www.nature.com/subjects/neuroscience.rss",
    "primaryTopic": "health_biohacking",
    "topics": [
      "health_biohacking",
      "contemplation_mind"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Nature Portfolio",
    "language": "en"
  },
  {
    "id": "sd-human-evolution",
    "name": "ScienceDaily Human Evolution",
    "url": "https://www.sciencedaily.com/rss/fossils_ruins/human_evolution.xml",
    "primaryTopic": "science_society",
    "topics": [
      "science_society",
      "philosophy_ethics"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ScienceDaily",
    "language": "en"
  },
  {
    "id": "nature-astro",
    "name": "Nature Astronomy & Astrophysics",
    "url": "https://www.nature.com/subjects/astronomy-and-astrophysics.rss",
    "primaryTopic": "science_society",
    "topics": [
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Nature Portfolio",
    "language": "en"
  },
  {
    "id": "nature-philosophy",
    "name": "Nature Philosophy of Science",
    "url": "https://www.nature.com/subjects/philosophy.rss",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Nature Portfolio",
    "language": "en",
    "isChallengingPerspective": true
  },
  {
    "id": "nature-quantum",
    "name": "Nature Quantum Physics",
    "url": "https://www.nature.com/subjects/quantum-physics.rss",
    "primaryTopic": "science_society",
    "topics": [
      "science_society",
      "ai_apple"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Nature Portfolio",
    "language": "en"
  },
  {
    "id": "nature-chemistry",
    "name": "Nature Chemistry Research",
    "url": "https://www.nature.com/subjects/chemistry.rss",
    "primaryTopic": "science_society",
    "topics": [
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Nature Portfolio",
    "language": "en"
  },
  {
    "id": "sd-mathematics",
    "name": "ScienceDaily Pure & Applied Mathematics",
    "url": "https://www.sciencedaily.com/rss/computers_math/mathematics.xml",
    "primaryTopic": "science_society",
    "topics": [
      "science_society",
      "ai_apple"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ScienceDaily Math",
    "language": "en"
  },
  {
    "id": "sd-statistics",
    "name": "ScienceDaily Statistics & Data Science",
    "url": "https://www.sciencedaily.com/rss/computers_math/statistics.xml",
    "primaryTopic": "science_society",
    "topics": [
      "science_society",
      "ai_apple"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ScienceDaily",
    "language": "en"
  },
  {
    "id": "sd-acoustics",
    "name": "ScienceDaily Acoustics & Sound Physics",
    "url": "https://www.sciencedaily.com/rss/matter_energy/acoustics.xml",
    "primaryTopic": "sound_synthesis",
    "topics": [
      "sound_synthesis",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ScienceDaily Acoustics",
    "language": "en"
  },
  {
    "id": "nature-genetics",
    "name": "Nature Genetics & Epigenetics",
    "url": "https://www.nature.com/subjects/genetics.rss",
    "primaryTopic": "health_biohacking",
    "topics": [
      "health_biohacking",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Nature Portfolio",
    "language": "en"
  },
  {
    "id": "sd-computer-science",
    "name": "ScienceDaily Computer Science",
    "url": "https://www.sciencedaily.com/rss/computers_math/computer_science.xml",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ScienceDaily CS",
    "language": "en"
  },
  {
    "id": "nature-physics-journal",
    "name": "Nature Physics Journal",
    "url": "https://www.nature.com/nphys.rss",
    "primaryTopic": "science_society",
    "topics": [
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Nature Physics",
    "language": "en"
  },
  {
    "id": "nature-hum-behav",
    "name": "Nature Human Behaviour",
    "url": "https://www.nature.com/nathumbehav.rss",
    "primaryTopic": "contemplation_mind",
    "topics": [
      "contemplation_mind",
      "philosophy_ethics",
      "german_didactics"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Nature Human Behaviour",
    "language": "en",
    "isTeachingRelated": true
  },
  {
    "id": "nature-neuro-journal",
    "name": "Nature Neuroscience Journal",
    "url": "https://www.nature.com/neuro.rss",
    "primaryTopic": "health_biohacking",
    "topics": [
      "health_biohacking",
      "contemplation_mind"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Nature Neuroscience",
    "language": "en"
  },
  {
    "id": "nature-biotech-journal",
    "name": "Nature Biotechnology Journal",
    "url": "https://www.nature.com/nbt.rss",
    "primaryTopic": "opportunities_growth",
    "topics": [
      "opportunities_growth",
      "health_biohacking"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Nature Biotechnology",
    "language": "en"
  },
  {
    "id": "nature-materials",
    "name": "Nature Materials Science",
    "url": "https://www.nature.com/subjects/materials-science.rss",
    "primaryTopic": "science_society",
    "topics": [
      "science_society",
      "opportunities_growth"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Nature Portfolio",
    "language": "en"
  },
  {
    "id": "nature-climate",
    "name": "Nature Climate Sciences",
    "url": "https://www.nature.com/subjects/climate-sciences.rss",
    "primaryTopic": "science_society",
    "topics": [
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Nature Portfolio",
    "language": "en"
  },
  {
    "id": "nature-evolution",
    "name": "Nature Evolutionary Biology",
    "url": "https://www.nature.com/subjects/evolution.rss",
    "primaryTopic": "science_society",
    "topics": [
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Nature Portfolio",
    "language": "en"
  },
  {
    "id": "sd-archaeology",
    "name": "ScienceDaily Archaeology & Ancient Civilizations",
    "url": "https://www.sciencedaily.com/rss/fossils_ruins/archaeology.xml",
    "primaryTopic": "book_mastery",
    "topics": [
      "book_mastery",
      "science_society",
      "art_aesthetics"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ScienceDaily",
    "language": "en"
  },
  {
    "id": "nature-ecology",
    "name": "Nature Ecology & Biodiversity",
    "url": "https://www.nature.com/subjects/ecology.rss",
    "primaryTopic": "science_society",
    "topics": [
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Nature Portfolio",
    "language": "en"
  },
  {
    "id": "sd-stem-education",
    "name": "ScienceDaily STEM Didactics",
    "url": "https://www.sciencedaily.com/rss/science_society/stem_education.xml",
    "primaryTopic": "german_didactics",
    "topics": [
      "german_didactics",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ScienceDaily Education",
    "language": "en",
    "isTeachingRelated": true
  },
  {
    "id": "sd-immune",
    "name": "ScienceDaily Immunology",
    "url": "https://www.sciencedaily.com/rss/health_medicine/immune_system.xml",
    "primaryTopic": "health_biohacking",
    "topics": [
      "health_biohacking",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ScienceDaily Health",
    "language": "en"
  },
  {
    "id": "nature-biotech-subj",
    "name": "Nature Biotechnology Subject",
    "url": "https://www.nature.com/subjects/biotechnology.rss",
    "primaryTopic": "opportunities_growth",
    "topics": [
      "opportunities_growth",
      "health_biohacking"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Nature Portfolio",
    "language": "en"
  },
  {
    "id": "sd-nanotech",
    "name": "ScienceDaily Nanotechnology",
    "url": "https://www.sciencedaily.com/rss/matter_energy/nanotechnology.xml",
    "primaryTopic": "science_society",
    "topics": [
      "science_society",
      "opportunities_growth"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ScienceDaily",
    "language": "en"
  },
  {
    "id": "nature-immunology",
    "name": "Nature Immunology Research",
    "url": "https://www.nature.com/subjects/immunology.rss",
    "primaryTopic": "health_biohacking",
    "topics": [
      "health_biohacking"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Nature Portfolio",
    "language": "en"
  },
  {
    "id": "nature-social-sciences",
    "name": "Nature Social Sciences",
    "url": "https://www.nature.com/subjects/social-sciences.rss",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Nature Portfolio",
    "language": "en",
    "isChallengingPerspective": true
  },
  {
    "id": "sd-biotech",
    "name": "ScienceDaily Biotechnology",
    "url": "https://www.sciencedaily.com/rss/plants_animals/biotechnology.xml",
    "primaryTopic": "opportunities_growth",
    "topics": [
      "opportunities_growth",
      "health_biohacking"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ScienceDaily",
    "language": "en"
  },
  {
    "id": "nature-education",
    "name": "Nature Higher Education & Pedagogy",
    "url": "https://www.nature.com/subjects/education.rss",
    "primaryTopic": "german_didactics",
    "topics": [
      "german_didactics",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Nature Portfolio",
    "language": "en",
    "isTeachingRelated": true
  },
  {
    "id": "nature-math-comp",
    "name": "Nature Mathematics & Computing",
    "url": "https://www.nature.com/subjects/mathematics-and-computing.rss",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Nature Portfolio",
    "language": "en"
  },
  {
    "id": "nature-psychology",
    "name": "Nature Psychology & Behavior",
    "url": "https://www.nature.com/subjects/psychology.rss",
    "primaryTopic": "contemplation_mind",
    "topics": [
      "contemplation_mind",
      "health_biohacking"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Nature Portfolio",
    "language": "en"
  },
  {
    "id": "sd-evolution",
    "name": "ScienceDaily Evolutionary Biology",
    "url": "https://www.sciencedaily.com/rss/plants_animals/evolution.xml",
    "primaryTopic": "science_society",
    "topics": [
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ScienceDaily Biology",
    "language": "en"
  },
  {
    "id": "sd-sustainability",
    "name": "ScienceDaily Sustainability & Clean Tech",
    "url": "https://www.sciencedaily.com/rss/earth_climate/sustainability.xml",
    "primaryTopic": "opportunities_growth",
    "topics": [
      "opportunities_growth",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ScienceDaily",
    "language": "en"
  },
  {
    "id": "3quarksdaily",
    "name": "3 Quarks Daily (Science, Arts & Philosophy)",
    "url": "https://www.3quarksdaily.com/feed",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "science_society",
      "book_mastery"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "3 Quarks Daily Curators",
    "language": "en",
    "isChallengingPerspective": true
  },
  {
    "id": "sd-economics",
    "name": "ScienceDaily Behavioral Economics",
    "url": "https://www.sciencedaily.com/rss/science_society/economics.xml",
    "primaryTopic": "opportunities_growth",
    "topics": [
      "opportunities_growth",
      "philosophy_ethics"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ScienceDaily",
    "language": "en",
    "isChallengingPerspective": true
  },
  {
    "id": "sd-ethics",
    "name": "ScienceDaily Research Ethics & Bioethics",
    "url": "https://www.sciencedaily.com/rss/science_society/ethics.xml",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ScienceDaily",
    "language": "en",
    "isChallengingPerspective": true
  },
  {
    "id": "nature-comms",
    "name": "Nature Communications",
    "url": "https://www.nature.com/ncomms.rss",
    "primaryTopic": "science_society",
    "topics": [
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Nature Communications",
    "language": "en"
  },
  {
    "id": "nature-climate-journal",
    "name": "Nature Climate Change Journal",
    "url": "https://www.nature.com/nclimate.rss",
    "primaryTopic": "science_society",
    "topics": [
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Nature Climate Change",
    "language": "en"
  },
  {
    "id": "lobsters-ai",
    "name": "Lobsters AI & Machine Learning",
    "url": "https://lobste.rs/t/ai.rss",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Lobsters AI",
    "language": "en"
  },
  {
    "id": "lobsters-art",
    "name": "Lobsters Art & Creative Coding",
    "url": "https://lobste.rs/t/art.rss",
    "primaryTopic": "art_aesthetics",
    "topics": [
      "art_aesthetics",
      "ai_apple"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Lobsters Art",
    "language": "en"
  },
  {
    "id": "lobsters-philosophy",
    "name": "Lobsters Philosophy of Computing",
    "url": "https://lobste.rs/t/philosophy.rss",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "ai_apple"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Lobsters Philosophy",
    "language": "en",
    "isChallengingPerspective": true
  },
  {
    "id": "lobsters-science",
    "name": "Lobsters Science & Research",
    "url": "https://lobste.rs/t/science.rss",
    "primaryTopic": "science_society",
    "topics": [
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Lobsters Science",
    "language": "en"
  },
  {
    "id": "lobsters-math",
    "name": "Lobsters Mathematics",
    "url": "https://lobste.rs/t/math.rss",
    "primaryTopic": "science_society",
    "topics": [
      "science_society",
      "ai_apple"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Lobsters Math",
    "language": "en"
  },
  {
    "id": "lobsters-ios",
    "name": "Lobsters iOS & Mobile Engineering",
    "url": "https://lobste.rs/t/ios.rss",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Lobsters iOS",
    "language": "en"
  },
  {
    "id": "lobsters-visualization",
    "name": "Lobsters Data Visualization",
    "url": "https://lobste.rs/t/visualization.rss",
    "primaryTopic": "art_aesthetics",
    "topics": [
      "art_aesthetics",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Lobsters Viz",
    "language": "en"
  },
  {
    "id": "lobsters-mac",
    "name": "Lobsters macOS & Apple Ecosystem",
    "url": "https://lobste.rs/t/mac.rss",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Lobsters Mac",
    "language": "en"
  },
  {
    "id": "heise-top",
    "name": "Heise Online Top-News",
    "url": "https://www.heise.de/rss/heise-top-atom.xml",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Heise Redaktion",
    "language": "de"
  },
  {
    "id": "lobsters-culture",
    "name": "Lobsters Tech Culture & Society",
    "url": "https://lobste.rs/t/culture.rss",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "ai_apple"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Lobsters Culture",
    "language": "en",
    "isChallengingPerspective": true
  },
  {
    "id": "lobsters-satire",
    "name": "Lobsters Computing Satire & Humor",
    "url": "https://lobste.rs/t/satire.rss",
    "primaryTopic": "memes_satire",
    "topics": [
      "memes_satire",
      "ai_apple"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Lobsters Satire",
    "language": "en"
  },
  {
    "id": "lobsters-web",
    "name": "Lobsters Open Web Architecture",
    "url": "https://lobste.rs/t/web.rss",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple",
      "opportunities_growth"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Lobsters Web",
    "language": "en"
  },
  {
    "id": "lobsters-rust",
    "name": "Lobsters Systems Engineering (Rust)",
    "url": "https://lobste.rs/t/rust.rss",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Lobsters Rust",
    "language": "en"
  },
  {
    "id": "lobsters-performance",
    "name": "Lobsters High-Performance Engineering",
    "url": "https://lobste.rs/t/performance.rss",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple",
      "opportunities_growth"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Lobsters Perf",
    "language": "en"
  },
  {
    "id": "lobsters-security",
    "name": "Lobsters Security & Privacy",
    "url": "https://lobste.rs/t/security.rss",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple",
      "philosophy_ethics"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Lobsters Security",
    "language": "en"
  },
  {
    "id": "heise-mac-and-i",
    "name": "Mac & i (Heise Apple Magazin)",
    "url": "https://www.heise.de/mac-and-i/news-atom.xml",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Mac & i Redaktion",
    "language": "de"
  },
  {
    "id": "heise-ix",
    "name": "iX Magazin für professionelle IT",
    "url": "https://www.heise.de/ix/rss/news-atom.xml",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple",
      "opportunities_growth"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "iX Redaktion",
    "language": "de"
  },
  {
    "id": "heise-security",
    "name": "Heise Security (IT-Sicherheit & Kryptographie)",
    "url": "https://www.heise.de/security/rss/news-atom.xml",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple",
      "philosophy_ethics"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Heise Security",
    "language": "de"
  },
  {
    "id": "heise-ct",
    "name": "c't Magazin für Computertechnik",
    "url": "https://www.heise.de/ct/rss/artikel-atom.xml",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple",
      "opportunities_growth"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "c't Redaktion",
    "language": "de"
  },
  {
    "id": "lobsters-distributed",
    "name": "Lobsters Distributed Systems",
    "url": "https://lobste.rs/t/distributed.rss",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Lobsters Distributed",
    "language": "en"
  },
  {
    "id": "t3n-digital",
    "name": "t3n Digital Pioneers & KI",
    "url": "https://t3n.de/rss.xml",
    "primaryTopic": "opportunities_growth",
    "topics": [
      "opportunities_growth",
      "ai_apple"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "t3n Redaktion",
    "language": "de"
  },
  {
    "id": "hn-best",
    "name": "Hacker News Best of the Week",
    "url": "https://hnrss.org/best",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple",
      "opportunities_growth"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Hacker News Best",
    "language": "en"
  },
  {
    "id": "golem-it",
    "name": "Golem.de IT-News für Profis",
    "url": "https://rss.golem.de/rss.php?feed=ATOM1.0",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Golem Redaktion",
    "language": "de"
  },
  {
    "id": "stadt-bremerhaven-caschy",
    "name": "Caschys Blog (Digitale Welt & Apple)",
    "url": "https://stadt-bremerhaven.de/feed/",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Caschy",
    "language": "de"
  },
  {
    "id": "macerkopf-apple",
    "name": "Macerkopf (Apple, Mac & iPad News)",
    "url": "https://www.macerkopf.de/feed/",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Macerkopf",
    "language": "de"
  },
  {
    "id": "9to5mac",
    "name": "9to5Mac (Apple Intelligence & Hardware)",
    "url": "https://9to5mac.com/feed/",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "9to5Mac",
    "language": "en"
  },
  {
    "id": "macrumors",
    "name": "MacRumors (Apple Hardware & OS)",
    "url": "https://feeds.macrumors.com/MacRumors-All",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "MacRumors",
    "language": "en"
  },
  {
    "id": "the-verge",
    "name": "The Verge (Tech, Science & Culture)",
    "url": "https://www.theverge.com/rss/index.xml",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "The Verge",
    "language": "en"
  },
  {
    "id": "macstories",
    "name": "MacStories (iPadOS, Workflows & Automation)",
    "url": "https://www.macstories.net/feed/",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple",
      "opportunities_growth"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Federico Viticci",
    "language": "en"
  },
  {
    "id": "wired-top",
    "name": "WIRED Science & Frontier Tech",
    "url": "https://www.wired.com/feed/rss",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "WIRED",
    "language": "en"
  },
  {
    "id": "apfelpage-de",
    "name": "Apfelpage (Apple & Tech Analysen)",
    "url": "https://www.apfelpage.de/feed/",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Apfelpage",
    "language": "de"
  },
  {
    "id": "daring-fireball",
    "name": "Daring Fireball (John Gruber)",
    "url": "https://daringfireball.net/feeds/main",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple",
      "art_aesthetics"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "John Gruber",
    "language": "en",
    "isChallengingPerspective": true
  },
  {
    "id": "deskmodder-tech",
    "name": "Deskmodder Tech & Software",
    "url": "https://www.deskmodder.de/blog/feed/",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Deskmodder",
    "language": "de"
  },
  {
    "id": "six-colors",
    "name": "Six Colors (Jason Snell – Apple & Media)",
    "url": "https://feedpress.me/sixcolors",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Jason Snell",
    "language": "en"
  },
  {
    "id": "ieee-spectrum",
    "name": "IEEE Spectrum (Engineering & AI)",
    "url": "https://spectrum.ieee.org/feeds/feed.rss",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "IEEE Spectrum",
    "language": "en"
  },
  {
    "id": "mit-news-research",
    "name": "MIT Research Breakthroughs",
    "url": "https://news.mit.edu/rss/research",
    "primaryTopic": "science_society",
    "topics": [
      "science_society",
      "opportunities_growth"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "MIT Research",
    "language": "en"
  },
  {
    "id": "ifun-apple",
    "name": "iPhone-Ticker.de (Apple Ökosystem)",
    "url": "https://www.iphone-ticker.de/feed/",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "iPhone-Ticker",
    "language": "de"
  },
  {
    "id": "astronomy-com",
    "name": "Astronomy Magazine",
    "url": "https://www.astronomy.com/feed/",
    "primaryTopic": "science_society",
    "topics": [
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Astronomy Magazine",
    "language": "en"
  },
  {
    "id": "phys-org-news",
    "name": "Phys.org (Physics, Space & Nanotech)",
    "url": "https://phys.org/rss-feed/",
    "primaryTopic": "science_society",
    "topics": [
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Phys.org",
    "language": "en"
  },
  {
    "id": "mit-news-ai",
    "name": "MIT News (Artificial Intelligence & CS)",
    "url": "https://news.mit.edu/rss/topic/artificial-intelligence2",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "MIT News Office",
    "language": "en"
  },
  {
    "id": "techxplore",
    "name": "Tech Xplore (Engineering & Computer Science)",
    "url": "https://techxplore.com/rss-feed/",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple",
      "opportunities_growth"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Tech Xplore",
    "language": "en"
  },
  {
    "id": "scientific-american",
    "name": "Scientific American",
    "url": "http://rss.sciam.com/ScientificAmerican-Global",
    "primaryTopic": "science_society",
    "topics": [
      "science_society",
      "health_biohacking"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Scientific American",
    "language": "en"
  },
  {
    "id": "medicalxpress",
    "name": "Medical Xpress (Clinical & Brain Research)",
    "url": "https://medicalxpress.com/rss-feed/",
    "primaryTopic": "health_biohacking",
    "topics": [
      "health_biohacking",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Medical Xpress",
    "language": "en"
  },
  {
    "id": "nasa-breaking",
    "name": "NASA Breaking Science & Missions",
    "url": "https://www.nasa.gov/news-release/feed/",
    "primaryTopic": "science_society",
    "topics": [
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "NASA",
    "language": "en"
  },
  {
    "id": "esa-space",
    "name": "European Space Agency (ESA Science)",
    "url": "https://www.esa.int/rssfeed/Our_Activities/Space_Science",
    "primaryTopic": "science_society",
    "topics": [
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ESA",
    "language": "en"
  },
  {
    "id": "wissenschaftskommunikation-de",
    "name": "Wissenschaftskommunikation.de (Didaktik & Forschung)",
    "url": "https://www.wissenschaftskommunikation.de/feed/",
    "primaryTopic": "german_didactics",
    "topics": [
      "german_didactics",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Wissenschaft im Dialog",
    "language": "de",
    "isTeachingRelated": true
  },
  {
    "id": "cult-of-pedagogy",
    "name": "Cult of Pedagogy (Teaching & Didactics)",
    "url": "https://www.cultofpedagogy.com/feed/",
    "primaryTopic": "german_didactics",
    "topics": [
      "german_didactics"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Jennifer Gonzalez",
    "language": "en",
    "isTeachingRelated": true
  },
  {
    "id": "space-com",
    "name": "Space.com (Space Exploration & Astronomy)",
    "url": "https://www.space.com/feeds/all",
    "primaryTopic": "science_society",
    "topics": [
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Space.com",
    "language": "en"
  },
  {
    "id": "blätter-politik",
    "name": "Blätter für deutsche und internationale Politik",
    "url": "https://www.blaetter.de/rss.xml",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Blätter Redaktion",
    "language": "de",
    "isChallengingPerspective": true
  },
  {
    "id": "universe-today",
    "name": "Universe Today (Space & Astrophysics)",
    "url": "https://www.universetoday.com/feed/",
    "primaryTopic": "science_society",
    "topics": [
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Fraser Cain",
    "language": "en"
  },
  {
    "id": "heise-telepolis",
    "name": "Telepolis (Medien-, Netz- & Gesellschaftskritik)",
    "url": "https://www.heise.de/tp/rss/news-atom.xml",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Telepolis",
    "language": "de",
    "isChallengingPerspective": true
  },
  {
    "id": "the-paris-review",
    "name": "The Paris Review (Writers, Craft & Literature)",
    "url": "https://www.theparisreview.org/blog/feed/",
    "primaryTopic": "book_mastery",
    "topics": [
      "book_mastery",
      "art_aesthetics"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "The Paris Review",
    "language": "en"
  },
  {
    "id": "lithub-books",
    "name": "Literary Hub (Essays, Criticism & Books)",
    "url": "https://lithub.com/feed/",
    "primaryTopic": "book_mastery",
    "topics": [
      "book_mastery",
      "philosophy_ethics"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "LitHub",
    "language": "en"
  },
  {
    "id": "makronom-wirtschaft",
    "name": "Makronom (Ökonomie & Gesellschaftspolitik)",
    "url": "https://makronom.de/feed",
    "primaryTopic": "opportunities_growth",
    "topics": [
      "opportunities_growth",
      "philosophy_ethics",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Makronom",
    "language": "de",
    "isChallengingPerspective": true
  },
  {
    "id": "verfassungsblog-de",
    "name": "Verfassungsblog (Rechtsphilosophie & Demokratie)",
    "url": "https://verfassungsblog.de/feed/",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Verfassungsblog",
    "language": "de",
    "isChallengingPerspective": true
  },
  {
    "id": "learning-scientists",
    "name": "The Learning Scientists (Cognitive Psychology of Learning)",
    "url": "https://www.learningscientists.org/blog?format=rss",
    "primaryTopic": "german_didactics",
    "topics": [
      "german_didactics",
      "contemplation_mind"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "The Learning Scientists",
    "language": "en",
    "isTeachingRelated": true
  },
  {
    "id": "new-scientist",
    "name": "New Scientist (Global Science Discoveries)",
    "url": "https://www.newscientist.com/feed/home/",
    "primaryTopic": "science_society",
    "topics": [
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "New Scientist",
    "language": "en"
  },
  {
    "id": "imperfect-cognitions",
    "name": "Imperfect Cognitions (Epistemology & Mind)",
    "url": "https://imperfectcognitions.blogspot.com/feeds/posts/default?alt=rss",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "contemplation_mind"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Lisa Bortolotti",
    "language": "en"
  },
  {
    "id": "teachthought",
    "name": "TeachThought (Critical Thinking & Pedagogy)",
    "url": "https://www.teachthought.com/feed/",
    "primaryTopic": "german_didactics",
    "topics": [
      "german_didactics",
      "philosophy_ethics"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "TeachThought",
    "language": "en",
    "isTeachingRelated": true
  },
  {
    "id": "dezeen-design",
    "name": "Dezeen (Architecture, Design & Interiors)",
    "url": "https://www.dezeen.com/feed/",
    "primaryTopic": "art_aesthetics",
    "topics": [
      "art_aesthetics"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Dezeen",
    "language": "en"
  },
  {
    "id": "petapixel-photography",
    "name": "PetaPixel (Fine Art Photography & Optics)",
    "url": "https://petapixel.com/feed/",
    "primaryTopic": "art_aesthetics",
    "topics": [
      "art_aesthetics",
      "ai_apple"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "PetaPixel",
    "language": "en"
  },
  {
    "id": "designboom-art",
    "name": "designboom (Art, Architecture & Technology)",
    "url": "https://www.designboom.com/feed/",
    "primaryTopic": "art_aesthetics",
    "topics": [
      "art_aesthetics",
      "ai_apple"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "designboom",
    "language": "en"
  },
  {
    "id": "bobblume-bildung",
    "name": "Bob Blume – Netzlehrer (Bildung & Didaktik)",
    "url": "https://bobblume.de/feed/",
    "primaryTopic": "german_didactics",
    "topics": [
      "german_didactics",
      "philosophy_ethics"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Bob Blume",
    "language": "de",
    "isTeachingRelated": true,
    "isChallengingPerspective": true
  },
  {
    "id": "juxtapoz-art",
    "name": "Juxtapoz Art & Culture Magazine",
    "url": "https://www.juxtapoz.com/news/?format=feed&type=rss",
    "primaryTopic": "art_aesthetics",
    "topics": [
      "art_aesthetics"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Juxtapoz",
    "language": "en"
  },
  {
    "id": "booooooom-art",
    "name": "BOOOOOOOM! (Contemporary Visual Art)",
    "url": "https://www.booooooom.com/feed/",
    "primaryTopic": "art_aesthetics",
    "topics": [
      "art_aesthetics"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Jeff Hamada",
    "language": "en"
  },
  {
    "id": "artnews-global",
    "name": "ARTnews (Museum Exhibitions & Art History)",
    "url": "https://www.artnews.com/feed/",
    "primaryTopic": "art_aesthetics",
    "topics": [
      "art_aesthetics",
      "book_mastery"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ARTnews",
    "language": "en"
  },
  {
    "id": "the-art-newspaper",
    "name": "The Art Newspaper",
    "url": "https://www.theartnewspaper.com/rss.xml",
    "primaryTopic": "art_aesthetics",
    "topics": [
      "art_aesthetics"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "The Art Newspaper",
    "language": "en"
  },
  {
    "id": "attack-magazine",
    "name": "Attack Magazine (Synth Programming, Rhythm & Production)",
    "url": "https://www.attackmagazine.com/feed/",
    "primaryTopic": "sound_synthesis",
    "topics": [
      "sound_synthesis"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Attack Magazine",
    "language": "en"
  },
  {
    "id": "headphone-commute",
    "name": "Headphone Commute (Ambient, Modern Classical & Field Recordings)",
    "url": "https://headphonecommute.com/feed/",
    "primaryTopic": "sound_synthesis",
    "topics": [
      "sound_synthesis",
      "contemplation_mind"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Headphone Commute",
    "language": "en"
  },
  {
    "id": "open-culture",
    "name": "Open Culture (Free Philosophy, Books, Art & Cinema)",
    "url": "https://www.openculture.com/feed",
    "primaryTopic": "book_mastery",
    "topics": [
      "book_mastery",
      "art_aesthetics",
      "philosophy_ethics",
      "german_didactics"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Open Culture",
    "language": "en",
    "isTeachingRelated": true
  },
  {
    "id": "wissenschaft-de",
    "name": "wissenschaft.de (Forschung & Gesellschaft)",
    "url": "https://www.wissenschaft.de/feed/",
    "primaryTopic": "science_society",
    "topics": [
      "science_society",
      "german_didactics"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "wissenschaft.de",
    "language": "de",
    "isTeachingRelated": true
  },
  {
    "id": "musictech-net",
    "name": "MusicTech (Sound Design & Studio Craft)",
    "url": "https://musictech.com/feed/",
    "primaryTopic": "sound_synthesis",
    "topics": [
      "sound_synthesis"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "MusicTech",
    "language": "en"
  },
  {
    "id": "cal-newport-deep-work",
    "name": "Cal Newport (Deep Work, Digital Minimalism & Slow Productivity)",
    "url": "https://calnewport.com/feed/",
    "primaryTopic": "contemplation_mind",
    "topics": [
      "contemplation_mind",
      "ai_apple",
      "opportunities_growth"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Cal Newport",
    "language": "en",
    "isChallengingPerspective": true
  },
  {
    "id": "my-modern-met",
    "name": "My Modern Met (Art, Photography & Visual Culture)",
    "url": "https://mymodernmet.com/feed/",
    "primaryTopic": "art_aesthetics",
    "topics": [
      "art_aesthetics"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "My Modern Met",
    "language": "en"
  },
  {
    "id": "archdaily-architecture",
    "name": "ArchDaily (World Architecture & Spatial Aesthetics)",
    "url": "https://www.archdaily.com/feed",
    "primaryTopic": "art_aesthetics",
    "topics": [
      "art_aesthetics"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ArchDaily",
    "language": "en"
  },
  {
    "id": "a-closer-listen",
    "name": "A Closer Listen (Ambient, Post-Rock & Experimental Sound)",
    "url": "https://acloserlisten.com/feed/",
    "primaryTopic": "sound_synthesis",
    "topics": [
      "sound_synthesis",
      "contemplation_mind"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "A Closer Listen",
    "language": "en"
  },
  {
    "id": "modern-stoicism",
    "name": "Modern Stoicism (Stoic Ethics & Psychology)",
    "url": "https://modernstoicism.com/feed/",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "contemplation_mind"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Modern Stoicism",
    "language": "en"
  },
  {
    "id": "farnam-street",
    "name": "Farnam Street (Shane Parrish – Mental Models & Decision Making)",
    "url": "https://fs.blog/feed/",
    "primaryTopic": "opportunities_growth",
    "topics": [
      "opportunities_growth",
      "philosophy_ethics",
      "book_mastery"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Shane Parrish",
    "language": "en"
  },
  {
    "id": "schwitzgebel-splintered-mind",
    "name": "The Splintered Mind (Eric Schwitzgebel – Philosophy)",
    "url": "https://schwitzsplinters.blogspot.com/feeds/posts/default?alt=rss",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "contemplation_mind"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Eric Schwitzgebel",
    "language": "en",
    "isChallengingPerspective": true
  },
  {
    "id": "gearnews-de",
    "name": "Gearnews.de (Synthesizer, Studio & Musikproduktion)",
    "url": "https://www.gearnews.de/feed/",
    "primaryTopic": "sound_synthesis",
    "topics": [
      "sound_synthesis"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Gearnews Redaktion",
    "language": "de"
  },
  {
    "id": "lesswrong-curated",
    "name": "LessWrong Curated (Epistemology, Rationality & AI Alignment)",
    "url": "https://www.lesswrong.com/feed.xml?view=curated-rss",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "ai_apple"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "LessWrong Curated",
    "language": "en",
    "isChallengingPerspective": true
  },
  {
    "id": "overcoming-bias",
    "name": "Overcoming Bias (Robin Hanson – Counter-Intuitive Social Science)",
    "url": "https://www.overcomingbias.com/feed",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "opportunities_growth"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Robin Hanson",
    "language": "en",
    "isChallengingPerspective": true
  },
  {
    "id": "wait-but-why",
    "name": "Wait But Why (Visual Longform Explainers)",
    "url": "https://waitbutwhy.com/feed",
    "primaryTopic": "science_society",
    "topics": [
      "science_society",
      "memes_satire",
      "ai_apple"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Tim Urban",
    "language": "en"
  },
  {
    "id": "marginal-revolution",
    "name": "Marginal Revolution (Tyler Cowen & Alex Tabarrok)",
    "url": "https://marginalrevolution.com/feed",
    "primaryTopic": "opportunities_growth",
    "topics": [
      "opportunities_growth",
      "book_mastery",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Tyler Cowen",
    "language": "en",
    "isChallengingPerspective": true
  },
  {
    "id": "noahpinion",
    "name": "Noahpinion (Economics, Technology & Global Shifts)",
    "url": "https://www.noahpinion.blog/feed",
    "primaryTopic": "opportunities_growth",
    "topics": [
      "opportunities_growth",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Noah Smith",
    "language": "en"
  },
  {
    "id": "construction-physics",
    "name": "Construction Physics (Brian Potter – How Civilization Builds)",
    "url": "https://www.construction-physics.com/feed",
    "primaryTopic": "opportunities_growth",
    "topics": [
      "opportunities_growth",
      "science_society",
      "art_aesthetics"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Brian Potter",
    "language": "en"
  },
  {
    "id": "dynomight-essays",
    "name": "DYNOMIGHT (Independent Empirical Investigations)",
    "url": "https://dynomight.net/feed.xml",
    "primaryTopic": "science_society",
    "topics": [
      "science_society",
      "philosophy_ethics"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Dynomight",
    "language": "en"
  },
  {
    "id": "interconnects-lambert",
    "name": "Interconnects (Nathan Lambert – Open-Weight RLHF & AI)",
    "url": "https://www.interconnects.ai/feed",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Nathan Lambert",
    "language": "en"
  },
  {
    "id": "amazona-de",
    "name": "AMAZONA.de (Synthesizer, Tonstudio & Sounddesign)",
    "url": "https://www.amazona.de/feed/",
    "primaryTopic": "sound_synthesis",
    "topics": [
      "sound_synthesis"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "AMAZONA.de",
    "language": "de"
  },
  {
    "id": "experimental-history",
    "name": "Experimental History (Adam Mastroianni – Psychology & Science)",
    "url": "https://www.experimental-history.com/feed",
    "primaryTopic": "science_society",
    "topics": [
      "science_society",
      "philosophy_ethics",
      "german_didactics"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Adam Mastroianni",
    "language": "en",
    "isTeachingRelated": true,
    "isChallengingPerspective": true
  },
  {
    "id": "distill-pub",
    "name": "Distill.pub (Visual Interactive Machine Learning)",
    "url": "https://distill.pub/rss.xml",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple",
      "art_aesthetics",
      "german_didactics"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Distill Collective",
    "language": "en",
    "isTeachingRelated": true
  },
  {
    "id": "one-useful-thing-mollick",
    "name": "One Useful Thing (Ethan Mollick – AI in Education & Work)",
    "url": "https://www.oneusefulthing.org/feed",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple",
      "german_didactics",
      "opportunities_growth"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Ethan Mollick",
    "language": "en",
    "isTeachingRelated": true
  },
  {
    "id": "latent-space-ai",
    "name": "Latent Space (AI Engineering & Agents)",
    "url": "https://www.latent.space/feed",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple",
      "opportunities_growth"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Swyx & Alessio",
    "language": "en"
  },
  {
    "id": "ahead-of-ai-raschka",
    "name": "Ahead of AI (Sebastian Raschka – Deep LLM Research)",
    "url": "https://magazine.sebastianraschka.com/feed",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Sebastian Raschka",
    "language": "en"
  },
  {
    "id": "colah-blog",
    "name": "colah's blog (Chris Olah – Mechanistic Interpretability)",
    "url": "https://colah.github.io/rss.xml",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Chris Olah",
    "language": "en"
  },
  {
    "id": "ness-labs",
    "name": "Ness Labs (Anne-Laure Le Cunff – Mindful Productivity & Neuroscience)",
    "url": "https://nesslabs.com/feed",
    "primaryTopic": "contemplation_mind",
    "topics": [
      "contemplation_mind",
      "german_didactics",
      "health_biohacking"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Anne-Laure Le Cunff",
    "language": "en",
    "isTeachingRelated": true
  },
  {
    "id": "54books-feuilleton",
    "name": "54books (Literatur, Feuilleton & Theorie)",
    "url": "https://www.54books.de/feed/",
    "primaryTopic": "book_mastery",
    "topics": [
      "book_mastery",
      "philosophy_ethics",
      "german_didactics"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "54books",
    "language": "de",
    "isTeachingRelated": true
  },
  {
    "id": "jay-alammar-visual-ml",
    "name": "Jay Alammar (Visualizing Machine Learning & Transformers)",
    "url": "https://jalammar.github.io/feed.xml",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple",
      "german_didactics"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Jay Alammar",
    "language": "en",
    "isTeachingRelated": true
  },
  {
    "id": "bonedo-de",
    "name": "Bonedo (Musik-Workshops, Sound & Recording)",
    "url": "https://www.bonedo.de/feed/",
    "primaryTopic": "sound_synthesis",
    "topics": [
      "sound_synthesis",
      "german_didactics"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Bonedo",
    "language": "de"
  },
  {
    "id": "deepmind-blog",
    "name": "Google DeepMind Blog",
    "url": "https://deepmind.google/blog/rss.xml",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Google DeepMind",
    "language": "en"
  },
  {
    "id": "openai-news",
    "name": "OpenAI Research & Updates",
    "url": "https://openai.com/news/rss.xml",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "OpenAI",
    "language": "en"
  },
  {
    "id": "apple-ml-research",
    "name": "Apple Machine Learning Research",
    "url": "https://machinelearning.apple.com/rss.xml",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Apple ML Research",
    "language": "en"
  },
  {
    "id": "chip-huyen-ml",
    "name": "Chip Huyen (AI Engineering & Systems)",
    "url": "https://huyenchip.com/feed.xml",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Chip Huyen",
    "language": "en"
  },
  {
    "id": "google-research-blog",
    "name": "Google Research Blog (Science & AI)",
    "url": "https://research.google/blog/rss/",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Google Research",
    "language": "en"
  },
  {
    "id": "julia-evans-jvns",
    "name": "Julia Evans (Systems Zines & joyful Computing)",
    "url": "https://jvns.ca/atom.xml",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple",
      "german_didactics",
      "memes_satire"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Julia Evans",
    "language": "en",
    "isTeachingRelated": true
  },
  {
    "id": "dan-luu",
    "name": "Dan Luu (Deep Systems & Hardware Engineering)",
    "url": "https://danluu.com/atom.xml",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Dan Luu",
    "language": "en"
  },
  {
    "id": "flowingdata",
    "name": "FlowingData (Nathan Yau – Visual Information Design)",
    "url": "https://flowingdata.com/feed",
    "primaryTopic": "art_aesthetics",
    "topics": [
      "art_aesthetics",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Nathan Yau",
    "language": "en"
  },
  {
    "id": "bair-berkeley-ai",
    "name": "Berkeley Artificial Intelligence Research (BAIR)",
    "url": "https://bair.berkeley.edu/blog/feed.xml",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "UC Berkeley BAIR",
    "language": "en"
  },
  {
    "id": "pudding-cool",
    "name": "The Pudding (Visual Essays in Culture & Data)",
    "url": "https://pudding.cool/rss.xml",
    "primaryTopic": "art_aesthetics",
    "topics": [
      "art_aesthetics",
      "science_society",
      "sound_synthesis"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "The Pudding",
    "language": "en"
  },
  {
    "id": "red-blob-games",
    "name": "Red Blob Games (Amit Patel – Interactive Algorithms)",
    "url": "https://www.redblobgames.com/blog/posts.xml",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple",
      "german_didactics"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Amit Patel",
    "language": "en",
    "isTeachingRelated": true
  },
  {
    "id": "swift-org-blog",
    "name": "Swift.org Blog (Apple Swift Language)",
    "url": "https://www.swift.org/atom.xml",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Swift Team",
    "language": "en"
  },
  {
    "id": "our-world-in-data",
    "name": "Our World in Data (Global Empirical Progress)",
    "url": "https://ourworldindata.org/atom.xml",
    "primaryTopic": "science_society",
    "topics": [
      "science_society",
      "opportunities_growth",
      "german_didactics"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Max Roser & OWID",
    "language": "en",
    "isTeachingRelated": true
  },
  {
    "id": "ciechanowski-interactive",
    "name": "Bartosz Ciechanowski (Interactive Visual Physics & Mechanics)",
    "url": "https://ciechanow.ski/atom.xml",
    "primaryTopic": "science_society",
    "topics": [
      "science_society",
      "art_aesthetics",
      "german_didactics"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Bartosz Ciechanowski",
    "language": "en",
    "isTeachingRelated": true
  },
  {
    "id": "craig-mod",
    "name": "Craig Mod (Books, Walking, Photography & Craft)",
    "url": "https://craigmod.com/index.xml",
    "primaryTopic": "book_mastery",
    "topics": [
      "book_mastery",
      "art_aesthetics",
      "contemplation_mind"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Craig Mod",
    "language": "en"
  },
  {
    "id": "silver-bulletin",
    "name": "Silver Bulletin (Nate Silver – Probability & Statistical Thinking)",
    "url": "https://www.natesilver.net/feed",
    "primaryTopic": "science_society",
    "topics": [
      "science_society",
      "opportunities_growth"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Nate Silver",
    "language": "en"
  },
  {
    "id": "sasha-chapin",
    "name": "Sasha Chapin (Writing, Meditation & Aesthetics)",
    "url": "https://sashachapin.substack.com/feed",
    "primaryTopic": "contemplation_mind",
    "topics": [
      "contemplation_mind",
      "book_mastery"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Sasha Chapin",
    "language": "en"
  },
  {
    "id": "robin-sloan",
    "name": "Robin Sloan (Literature, Media & Olive Oil)",
    "url": "https://www.robinsloan.com/feed.xml",
    "primaryTopic": "book_mastery",
    "topics": [
      "book_mastery",
      "ai_apple"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Robin Sloan",
    "language": "en"
  },
  {
    "id": "erik-hoel-intrinsic-perspective",
    "name": "The Intrinsic Perspective (Erik Hoel – Neuroscience & Consciousness)",
    "url": "https://www.theintrinsicperspective.com/feed",
    "primaryTopic": "contemplation_mind",
    "topics": [
      "contemplation_mind",
      "philosophy_ethics",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Erik Hoel",
    "language": "en",
    "isChallengingPerspective": true
  },
  {
    "id": "slow-boring-yglesias",
    "name": "Slow Boring (Policy, Urbanism & Economics)",
    "url": "https://www.slowboring.com/feed",
    "primaryTopic": "opportunities_growth",
    "topics": [
      "opportunities_growth",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Matthew Yglesias",
    "language": "en",
    "isChallengingPerspective": true
  },
  {
    "id": "ccc-chaos-computer-club",
    "name": "Chaos Computer Club (CCC Updates & Digitale Ethik)",
    "url": "https://www.ccc.de/de/rss/updates.rdf",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "ai_apple"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Chaos Computer Club",
    "language": "de",
    "isChallengingPerspective": true
  },
  {
    "id": "henrik-karlsson-escaping-flatland",
    "name": "Escaping Flatland (Henrik Karlsson – Deep Essays)",
    "url": "https://www.henrikkarlsson.xyz/feed",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "book_mastery",
      "contemplation_mind"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Henrik Karlsson",
    "language": "en"
  },
  {
    "id": "paulgraham-essays",
    "name": "Paul Graham Essays (Startups, Thinking & Writing)",
    "url": "http://www.aaronsw.com/2002/feeds/pgessays.rss",
    "primaryTopic": "opportunities_growth",
    "topics": [
      "opportunities_growth",
      "philosophy_ethics",
      "book_mastery"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Paul Graham",
    "language": "en"
  },
  {
    "id": "tarnkappe-info",
    "name": "Tarnkappe.info (Netzpolitik, Urheberrecht & IT)",
    "url": "https://tarnkappe.info/feed",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple",
      "philosophy_ethics"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Tarnkappe",
    "language": "de"
  },
  {
    "id": "asimov-press",
    "name": "Asimov Press (Biotechnology & Scientific Essays)",
    "url": "https://www.asimov.press/feed",
    "primaryTopic": "science_society",
    "topics": [
      "science_society",
      "health_biohacking",
      "opportunities_growth"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Asimov Press",
    "language": "en"
  },
  {
    "id": "bits-about-money",
    "name": "Bits about Money (Patrick McKenzie – Financial Infrastructure)",
    "url": "https://www.bitsaboutmoney.com/archive/rss/",
    "primaryTopic": "opportunities_growth",
    "topics": [
      "opportunities_growth",
      "ai_apple"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Patrick McKenzie",
    "language": "en"
  },
  {
    "id": "eff-deeplinks",
    "name": "Electronic Frontier Foundation (EFF Digital Freedom)",
    "url": "https://www.eff.org/rss/updates.xml",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "ai_apple"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "EFF",
    "language": "en",
    "isChallengingPerspective": true
  },
  {
    "id": "webkit-blog",
    "name": "WebKit Blog (Safari & Apple Web Engine)",
    "url": "https://webkit.org/feed/atom/",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Apple WebKit Team",
    "language": "en"
  },
  {
    "id": "rob-henderson",
    "name": "Rob Henderson (Psychology, Luxury Beliefs & Society)",
    "url": "https://www.robkhenderson.com/feed",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Rob Henderson",
    "language": "en",
    "isChallengingPerspective": true
  },
  {
    "id": "kuketz-security",
    "name": "Kuketz IT-Security Blog (Datenschutz & Digitale Souveränität)",
    "url": "https://www.kuketz-blog.de/feed/",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple",
      "philosophy_ethics"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Mike Kuketz",
    "language": "de"
  },
  {
    "id": "information-is-beautiful",
    "name": "Information is Beautiful (Visual Knowledge)",
    "url": "https://informationisbeautiful.net/feed/",
    "primaryTopic": "art_aesthetics",
    "topics": [
      "art_aesthetics",
      "science_society",
      "german_didactics"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "David McCandless",
    "language": "en",
    "isTeachingRelated": true
  },
  {
    "id": "monkeyuser-comics",
    "name": "MonkeyUser (Software Engineering Comics)",
    "url": "https://www.monkeyuser.com/index.xml",
    "primaryTopic": "memes_satire",
    "topics": [
      "memes_satire",
      "ai_apple"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "MonkeyUser",
    "language": "en"
  },
  {
    "id": "commitstrip-comics",
    "name": "CommitStrip (Developer Humor)",
    "url": "https://www.commitstrip.com/en/feed/",
    "primaryTopic": "memes_satire",
    "topics": [
      "memes_satire",
      "ai_apple"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "CommitStrip",
    "language": "en"
  },
  {
    "id": "the-oatmeal",
    "name": "The Oatmeal (Matthew Inman – Illustrated Humor)",
    "url": "https://feeds.feedburner.com/oatmealfeed",
    "primaryTopic": "memes_satire",
    "topics": [
      "memes_satire"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Matthew Inman",
    "language": "en"
  },
  {
    "id": "daily-stoic",
    "name": "Daily Stoic (Ancient Stoic Philosophy & Resilience)",
    "url": "https://dailystoic.com/feed/",
    "primaryTopic": "contemplation_mind",
    "topics": [
      "contemplation_mind",
      "philosophy_ethics"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Daily Stoic",
    "language": "en"
  },
  {
    "id": "asterisk-magazine",
    "name": "Asterisk Magazine (Deep Science & Policy Essays)",
    "url": "https://asteriskmag.com/feed",
    "primaryTopic": "science_society",
    "topics": [
      "science_society",
      "opportunities_growth"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Asterisk Magazine",
    "language": "en"
  },
  {
    "id": "postillon-satire",
    "name": "Der Postillon (Nachrichten-Satire)",
    "url": "https://follow.it/der-postillon-abo/rss",
    "primaryTopic": "memes_satire",
    "topics": [
      "memes_satire",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Der Postillon",
    "language": "de"
  },
  {
    "id": "boingboing-curiosities",
    "name": "Boing Boing (Wonderful Things & Counterculture)",
    "url": "https://boingboing.net/feed",
    "primaryTopic": "memes_satire",
    "topics": [
      "memes_satire",
      "art_aesthetics"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Boing Boing",
    "language": "en"
  },
  {
    "id": "austin-kleon",
    "name": "Austin Kleon (Steal Like an Artist – Creative Notebooks)",
    "url": "https://austinkleon.com/feed/",
    "primaryTopic": "art_aesthetics",
    "topics": [
      "art_aesthetics",
      "book_mastery",
      "sound_synthesis"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Austin Kleon",
    "language": "en"
  },
  {
    "id": "acko-net-unconed",
    "name": "Acko.net (Steven Wittens – Mathematical Art & Graphics)",
    "url": "https://acko.net/atom.xml",
    "primaryTopic": "art_aesthetics",
    "topics": [
      "art_aesthetics",
      "ai_apple",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Steven Wittens",
    "language": "en"
  },
  {
    "id": "neatorama-curiosities",
    "name": "Neatorama (Fascinating Trivia & Science Oddities)",
    "url": "https://www.neatorama.com/feed/",
    "primaryTopic": "memes_satire",
    "topics": [
      "memes_satire",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Neatorama",
    "language": "en"
  },
  {
    "id": "laughing-squid",
    "name": "Laughing Squid (Art, Culture & Web Curiosities)",
    "url": "https://laughingsquid.com/feed/",
    "primaryTopic": "memes_satire",
    "topics": [
      "memes_satire",
      "art_aesthetics"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Laughing Squid",
    "language": "en"
  },
  {
    "id": "yt-computerphile",
    "name": "Computerphile (Computer Science Explained)",
    "url": "https://www.youtube.com/feeds/videos.xml?channel_id=UC9-y-6csu5WGm29I7JiwpnA",
    "primaryTopic": "youtube_gems",
    "topics": [
      "youtube_gems",
      "ai_apple",
      "german_didactics"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Computerphile",
    "language": "en",
    "isTeachingRelated": true
  },
  {
    "id": "yt-two-minute-papers",
    "name": "Two Minute Papers (Károly Zsolnai-Fehér – AI & Graphics)",
    "url": "https://www.youtube.com/feeds/videos.xml?channel_id=UCbfYPyITQ-7l4upoX8nvctg",
    "primaryTopic": "youtube_gems",
    "topics": [
      "youtube_gems",
      "ai_apple"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Two Minute Papers",
    "language": "en"
  },
  {
    "id": "yt-pbs-eons",
    "name": "PBS Eons (Deep Time & Evolutionary History)",
    "url": "https://www.youtube.com/feeds/videos.xml?channel_id=UCzR-rom72PHN9Zg7RML9EbA",
    "primaryTopic": "youtube_gems",
    "topics": [
      "youtube_gems",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "PBS Eons",
    "language": "en"
  },
  {
    "id": "yt-numberphile",
    "name": "Numberphile (Mathematics Video Essays)",
    "url": "https://www.youtube.com/feeds/videos.xml?channel_id=UCoxcjq-8xIDTYp3uz647V5A",
    "primaryTopic": "youtube_gems",
    "topics": [
      "youtube_gems",
      "science_society",
      "german_didactics"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Brady Haran / Numberphile",
    "language": "en",
    "isTeachingRelated": true
  },
  {
    "id": "yt-minutephysics",
    "name": "MinutePhysics (Henry Reich – Visual Physics)",
    "url": "https://www.youtube.com/feeds/videos.xml?channel_id=UCUHW94eEFW7hkUMVaZz4eDg",
    "primaryTopic": "youtube_gems",
    "topics": [
      "youtube_gems",
      "science_society",
      "german_didactics"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Henry Reich",
    "language": "en",
    "isTeachingRelated": true
  },
  {
    "id": "yt-terrax-lesch",
    "name": "Terra X Lesch & Co (Harald Lesch – Physik & Philosophie)",
    "url": "https://www.youtube.com/feeds/videos.xml?channel_id=UC5E9-r42JlymhLPnDv2wHuA",
    "primaryTopic": "youtube_gems",
    "topics": [
      "youtube_gems",
      "science_society",
      "philosophy_ethics",
      "german_didactics"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Harald Lesch / ZDF",
    "language": "de",
    "isTeachingRelated": true
  },
  {
    "id": "yt-smartereveryday",
    "name": "SmarterEveryDay (Destin Sandlin – Physics & Engineering)",
    "url": "https://www.youtube.com/feeds/videos.xml?channel_id=UC6107grRI4m0o2-emgoDnAA",
    "primaryTopic": "youtube_gems",
    "topics": [
      "youtube_gems",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Destin Sandlin",
    "language": "en"
  },
  {
    "id": "yt-arte-de",
    "name": "ARTEde (Dokumentationen, Kultur & Wissenschaft)",
    "url": "https://www.youtube.com/feeds/videos.xml?channel_id=UCLLibJTCy3sXjHLVaDimnpQ",
    "primaryTopic": "youtube_gems",
    "topics": [
      "youtube_gems",
      "science_society",
      "art_aesthetics"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ARTEde",
    "language": "de"
  },
  {
    "id": "yt-lex-fridman",
    "name": "Lex Fridman Podcast (AI, Science & Philosophy)",
    "url": "https://www.youtube.com/feeds/videos.xml?channel_id=UCSHZKyawb77ixDdsGog4iWA",
    "primaryTopic": "youtube_gems",
    "topics": [
      "youtube_gems",
      "ai_apple",
      "philosophy_ethics"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Lex Fridman",
    "language": "en"
  },
  {
    "id": "yt-pbs-spacetime",
    "name": "PBS Space Time (Astrophysics & Quantum Mechanics)",
    "url": "https://www.youtube.com/feeds/videos.xml?channel_id=UC7_gcs09iThXybpVgjHZ_7g",
    "primaryTopic": "youtube_gems",
    "topics": [
      "youtube_gems",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Matt O’Dowd / PBS",
    "language": "en"
  },
  {
    "id": "yt-crashcourse",
    "name": "CrashCourse (World History, Philosophy & Literature)",
    "url": "https://www.youtube.com/feeds/videos.xml?channel_id=UCX6b17PVsYBQ0ip5gyeme-Q",
    "primaryTopic": "youtube_gems",
    "topics": [
      "youtube_gems",
      "german_didactics",
      "book_mastery"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "John & Hank Green",
    "language": "en",
    "isTeachingRelated": true
  },
  {
    "id": "yt-mrwissen2go",
    "name": "MrWissen2go (Mirko Drotschmann – Geschichte & Politik)",
    "url": "https://www.youtube.com/feeds/videos.xml?channel_id=UCZHpIFMfoJJ_1QxNGLJTzyA",
    "primaryTopic": "youtube_gems",
    "topics": [
      "youtube_gems",
      "german_didactics",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Mirko Drotschmann",
    "language": "de",
    "isTeachingRelated": true
  },
  {
    "id": "yt-maithink-x",
    "name": "MAITHINK X (Dr. Mai Thi Nguyen-Kim – Wissenschaft)",
    "url": "https://www.youtube.com/feeds/videos.xml?channel_id=UCyHDQ5C6z1NDmJ4g6SerW8g",
    "primaryTopic": "youtube_gems",
    "topics": [
      "youtube_gems",
      "science_society",
      "german_didactics"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Mai Thi Nguyen-Kim",
    "language": "de",
    "isTeachingRelated": true
  },
  {
    "id": "yt-hainbach",
    "name": "Hainbach (Tape Loops, Test Equipment & Experimental Ambient)",
    "url": "https://www.youtube.com/feeds/videos.xml?channel_id=UCeovElJP0n0i8ADaPsRSd8g",
    "primaryTopic": "youtube_gems",
    "topics": [
      "youtube_gems",
      "sound_synthesis",
      "art_aesthetics"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Hainbach",
    "language": "en"
  },
  {
    "id": "yt-welch-labs",
    "name": "Welch Labs (Visualizing Math, AI & Physics)",
    "url": "https://www.youtube.com/feeds/videos.xml?channel_id=UConVfxXodg78Tzh5nNu85Ew",
    "primaryTopic": "youtube_gems",
    "topics": [
      "youtube_gems",
      "ai_apple",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Stephen Welch",
    "language": "en"
  },
  {
    "id": "yt-standup-maths",
    "name": "Stand-up Maths (Matt Parker)",
    "url": "https://www.youtube.com/feeds/videos.xml?channel_id=UCSju5G2aFaWMqn-_0YBtq5A",
    "primaryTopic": "youtube_gems",
    "topics": [
      "youtube_gems",
      "science_society",
      "memes_satire"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Matt Parker",
    "language": "en"
  },
  {
    "id": "yt-practical-engineering",
    "name": "Practical Engineering (Grady Hillhouse – Civil Infrastructure)",
    "url": "https://www.youtube.com/feeds/videos.xml?channel_id=UCMOqf8ab-42UUQIdVoKwjlQ",
    "primaryTopic": "youtube_gems",
    "topics": [
      "youtube_gems",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Grady Hillhouse",
    "language": "en"
  },
  {
    "id": "yt-reducible",
    "name": "Reducible (Visual Computer Science & Algorithms)",
    "url": "https://www.youtube.com/feeds/videos.xml?channel_id=UCK8XIGR5kRidIw2fWqwyHRA",
    "primaryTopic": "youtube_gems",
    "topics": [
      "youtube_gems",
      "ai_apple",
      "german_didactics"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Reducible",
    "language": "en",
    "isTeachingRelated": true
  },
  {
    "id": "yt-simplicissimus",
    "name": "Simplicissimus (Investigative Video-Essays DE)",
    "url": "https://www.youtube.com/feeds/videos.xml?channel_id=UCKGMHVipEvuZudhHD05FOYA",
    "primaryTopic": "youtube_gems",
    "topics": [
      "youtube_gems",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Simplicissimus",
    "language": "de"
  },
  {
    "id": "yt-real-engineering",
    "name": "Real Engineering (Aerospace, Energy & Megaprojects)",
    "url": "https://www.youtube.com/feeds/videos.xml?channel_id=UCR1IuLEqb6UEA_zQ81kwXfg",
    "primaryTopic": "youtube_gems",
    "topics": [
      "youtube_gems",
      "science_society",
      "opportunities_growth"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Real Engineering",
    "language": "en"
  },
  {
    "id": "yt-wendover",
    "name": "Wendover Productions (Logistics, Geography & Economics)",
    "url": "https://www.youtube.com/feeds/videos.xml?channel_id=UC9RM-iSvTu1uPJb8X5yp3EQ",
    "primaryTopic": "youtube_gems",
    "topics": [
      "youtube_gems",
      "opportunities_growth",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Sam Denby",
    "language": "en"
  },
  {
    "id": "poorly-drawn-lines",
    "name": "Poorly Drawn Lines (Absurdist Webcomic)",
    "url": "https://poorlydrawnlines.com/feed/",
    "primaryTopic": "memes_satire",
    "topics": [
      "memes_satire",
      "art_aesthetics"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Reza Farazmand",
    "language": "en"
  },
  {
    "id": "yt-polymatter",
    "name": "PolyMatter (Global Economics & Geopolitics)",
    "url": "https://www.youtube.com/feeds/videos.xml?channel_id=UCgNg3vwj3xt7QOrcIDaHdFg",
    "primaryTopic": "youtube_gems",
    "topics": [
      "youtube_gems",
      "opportunities_growth",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "PolyMatter",
    "language": "en"
  },
  {
    "id": "yt-sabine-hossenfelder",
    "name": "Sabine Hossenfelder (Critical Physics & Science News)",
    "url": "https://www.youtube.com/feeds/videos.xml?channel_id=UC1yNl2E66ZzKApQdRuTQ4tw",
    "primaryTopic": "youtube_gems",
    "topics": [
      "youtube_gems",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Sabine Hossenfelder",
    "language": "en",
    "isChallengingPerspective": true
  },
  {
    "id": "yt-cleo-abram",
    "name": "Cleo Abram (Optimistic Science & Frontier Tech)",
    "url": "https://www.youtube.com/feeds/videos.xml?channel_id=UC415bOPUcGSamy543abLmRA",
    "primaryTopic": "youtube_gems",
    "topics": [
      "youtube_gems",
      "science_society",
      "ai_apple"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Cleo Abram",
    "language": "en"
  },
  {
    "id": "yt-anton-petrov",
    "name": "Anton Petrov (Daily Astronomy & Space Papers)",
    "url": "https://www.youtube.com/feeds/videos.xml?channel_id=UCciQ8wFcVoIIMi-lfu8-cjQ",
    "primaryTopic": "youtube_gems",
    "topics": [
      "youtube_gems",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Anton Petrov",
    "language": "en"
  },
  {
    "id": "yt-branch-education",
    "name": "Branch Education (3D Microchips & Hardware Architecture)",
    "url": "https://www.youtube.com/feeds/videos.xml?channel_id=UCdp4_l1vPmpN-gDbUwhaRUQ",
    "primaryTopic": "youtube_gems",
    "topics": [
      "youtube_gems",
      "ai_apple",
      "german_didactics"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Branch Education",
    "language": "en",
    "isTeachingRelated": true
  },
  {
    "id": "yt-nerdwriter1",
    "name": "Nerdwriter1 (Evan Puschak – Video Essays on Art & Cinema)",
    "url": "https://www.youtube.com/feeds/videos.xml?channel_id=UCJkMlOu7faDgqh4PfzbpLdg",
    "primaryTopic": "youtube_gems",
    "topics": [
      "youtube_gems",
      "art_aesthetics",
      "book_mastery"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Evan Puschak",
    "language": "en"
  },
  {
    "id": "yt-technology-connections",
    "name": "Technology Connections (Alec Watson – Everyday Engineering)",
    "url": "https://www.youtube.com/feeds/videos.xml?channel_id=UCy0tKL1T7wFoYcxCe0xjN6Q",
    "primaryTopic": "youtube_gems",
    "topics": [
      "youtube_gems",
      "ai_apple",
      "sound_synthesis"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Alec Watson",
    "language": "en"
  },
  {
    "id": "dinosaur-comics",
    "name": "Dinosaur Comics (Ryan North – Philosophical Comedy)",
    "url": "https://www.qwantz.com/rssfeed.php",
    "primaryTopic": "memes_satire",
    "topics": [
      "memes_satire",
      "philosophy_ethics"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Ryan North",
    "language": "en"
  },
  {
    "id": "yt-scishow",
    "name": "SciShow (Daily Science Explainers)",
    "url": "https://www.youtube.com/feeds/videos.xml?channel_id=UCZYTClx2T1of7BRZ86-8fow",
    "primaryTopic": "youtube_gems",
    "topics": [
      "youtube_gems",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Hank Green / SciShow",
    "language": "en"
  },
  {
    "id": "mcstories-kottke",
    "name": "kottke.org (Jason Kottke – Curated Web Gems & Curiosities)",
    "url": "https://feeds.kottke.org/main",
    "primaryTopic": "memes_satire",
    "topics": [
      "memes_satire",
      "art_aesthetics",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Jason Kottke",
    "language": "en"
  },
  {
    "id": "savage-chickens",
    "name": "Savage Chickens (Sticky-Note Cartoons)",
    "url": "https://www.savagechickens.com/feed",
    "primaryTopic": "memes_satire",
    "topics": [
      "memes_satire"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Doug Savage",
    "language": "en"
  },
  {
    "id": "yt-benn-jordan",
    "name": "Benn Jordan (The Flashbulb – Sound Science & Modular Synths)",
    "url": "https://www.youtube.com/feeds/videos.xml?channel_id=UCshObcm-nLhbu8MY50EZ5Ng",
    "primaryTopic": "youtube_gems",
    "topics": [
      "youtube_gems",
      "sound_synthesis"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Benn Jordan",
    "language": "en"
  },
  {
    "id": "yt-andrew-huang",
    "name": "Andrew Huang (Music Production & Sound Exploration)",
    "url": "https://www.youtube.com/feeds/videos.xml?channel_id=UCdcemy56JtVTrsFIOoqvV8g",
    "primaryTopic": "youtube_gems",
    "topics": [
      "youtube_gems",
      "sound_synthesis"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Andrew Huang",
    "language": "en"
  },
  {
    "id": "sd-galaxies",
    "name": "ScienceDaily Galaxies & Deep Space",
    "url": "https://www.sciencedaily.com/rss/space_time/galaxies.xml",
    "primaryTopic": "science_society",
    "topics": [
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ScienceDaily",
    "language": "en"
  },
  {
    "id": "phd-comics",
    "name": "Piled Higher and Deeper (PhD Comics – Academia Satire)",
    "url": "http://phdcomics.com/gradfeed.php",
    "primaryTopic": "memes_satire",
    "topics": [
      "memes_satire",
      "science_society",
      "german_didactics"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Jorge Cham",
    "language": "en"
  },
  {
    "id": "yt-academy-of-ideas",
    "name": "Academy of Ideas (Philosophy, Jung, Nietzsche & Freedom)",
    "url": "https://www.youtube.com/feeds/videos.xml?channel_id=UCiRiQGCHGjDLT9FQXFW0I3A",
    "primaryTopic": "youtube_gems",
    "topics": [
      "youtube_gems",
      "philosophy_ethics",
      "contemplation_mind"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Academy of Ideas",
    "language": "en",
    "isChallengingPerspective": true
  },
  {
    "id": "sd-dark-matter",
    "name": "ScienceDaily Dark Matter & Dark Energy",
    "url": "https://www.sciencedaily.com/rss/space_time/dark_matter.xml",
    "primaryTopic": "science_society",
    "topics": [
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ScienceDaily",
    "language": "en"
  },
  {
    "id": "sd-epigenetics",
    "name": "ScienceDaily Epigenetics & Gene Expression",
    "url": "https://www.sciencedaily.com/rss/plants_animals/epigenetics.xml",
    "primaryTopic": "health_biohacking",
    "topics": [
      "health_biohacking",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ScienceDaily",
    "language": "en"
  },
  {
    "id": "sd-botany",
    "name": "ScienceDaily Plant Science & Botany",
    "url": "https://www.sciencedaily.com/rss/plants_animals/botany.xml",
    "primaryTopic": "science_society",
    "topics": [
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ScienceDaily",
    "language": "en"
  },
  {
    "id": "sd-modeling",
    "name": "ScienceDaily Computer Modeling & Simulation",
    "url": "https://www.sciencedaily.com/rss/computers_math/computer_modeling.xml",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ScienceDaily",
    "language": "en"
  },
  {
    "id": "atlas-obscura",
    "name": "Atlas Obscura (Hidden Wonders of the World)",
    "url": "https://www.atlasobscura.com/feeds/latest",
    "primaryTopic": "art_aesthetics",
    "topics": [
      "art_aesthetics",
      "science_society",
      "memes_satire"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Atlas Obscura",
    "language": "en"
  },
  {
    "id": "sd-mental-health",
    "name": "ScienceDaily Mental Health & Resilience",
    "url": "https://www.sciencedaily.com/rss/mind_brain/mental_health.xml",
    "primaryTopic": "contemplation_mind",
    "topics": [
      "contemplation_mind",
      "health_biohacking"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ScienceDaily",
    "language": "en"
  },
  {
    "id": "sd-heart-disease",
    "name": "ScienceDaily Cardiovascular Health & VO2 Max",
    "url": "https://www.sciencedaily.com/rss/health_medicine/heart_disease.xml",
    "primaryTopic": "health_biohacking",
    "topics": [
      "health_biohacking"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ScienceDaily",
    "language": "en"
  },
  {
    "id": "postillon-feedburner",
    "name": "Der Postillon (Ehrliche Nachrichten)",
    "url": "https://feeds.feedburner.com/blogspot/rkEL",
    "primaryTopic": "memes_satire",
    "topics": [
      "memes_satire"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Der Postillon",
    "language": "de"
  },
  {
    "id": "sd-animal-behavior",
    "name": "ScienceDaily Animal Cognition & Behavior",
    "url": "https://www.sciencedaily.com/rss/plants_animals/behavior.xml",
    "primaryTopic": "contemplation_mind",
    "topics": [
      "contemplation_mind",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ScienceDaily",
    "language": "en"
  },
  {
    "id": "sd-relationships",
    "name": "ScienceDaily Human Connection & Relationships",
    "url": "https://www.sciencedaily.com/rss/mind_brain/relationships.xml",
    "primaryTopic": "contemplation_mind",
    "topics": [
      "contemplation_mind",
      "philosophy_ethics"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ScienceDaily",
    "language": "en"
  },
  {
    "id": "sd-oceanography",
    "name": "ScienceDaily Oceanography",
    "url": "https://www.sciencedaily.com/rss/earth_climate/oceanography.xml",
    "primaryTopic": "science_society",
    "topics": [
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ScienceDaily",
    "language": "en"
  },
  {
    "id": "sd-space-telescopes",
    "name": "ScienceDaily James Webb & Space Telescopes",
    "url": "https://www.sciencedaily.com/rss/space_time/space_telescopes.xml",
    "primaryTopic": "science_society",
    "topics": [
      "science_society",
      "art_aesthetics"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ScienceDaily",
    "language": "en"
  },
  {
    "id": "sd-stem-cells",
    "name": "ScienceDaily Stem Cells & Regenerative Medicine",
    "url": "https://www.sciencedaily.com/rss/health_medicine/stem_cells.xml",
    "primaryTopic": "health_biohacking",
    "topics": [
      "health_biohacking",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ScienceDaily",
    "language": "en"
  },
  {
    "id": "sd-solar-system",
    "name": "ScienceDaily Solar System & Planetary Science",
    "url": "https://www.sciencedaily.com/rss/space_time/solar_system.xml",
    "primaryTopic": "science_society",
    "topics": [
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ScienceDaily",
    "language": "en"
  },
  {
    "id": "sd-marine-biology",
    "name": "ScienceDaily Marine Biology",
    "url": "https://www.sciencedaily.com/rss/plants_animals/marine_biology.xml",
    "primaryTopic": "science_society",
    "topics": [
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ScienceDaily",
    "language": "en"
  },
  {
    "id": "sd-renewable-energy",
    "name": "ScienceDaily Solar & Renewable Energy",
    "url": "https://www.sciencedaily.com/rss/matter_energy/alternative_fuels.xml",
    "primaryTopic": "opportunities_growth",
    "topics": [
      "opportunities_growth",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ScienceDaily",
    "language": "en"
  },
  {
    "id": "sd-optics",
    "name": "ScienceDaily Optics & Photonics",
    "url": "https://www.sciencedaily.com/rss/matter_energy/nature_of_light.xml",
    "primaryTopic": "science_society",
    "topics": [
      "science_society",
      "art_aesthetics"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ScienceDaily",
    "language": "en"
  },
  {
    "id": "sd-microbiome",
    "name": "ScienceDaily Microbiome & Gut-Brain Axis",
    "url": "https://www.sciencedaily.com/rss/plants_animals/microbiology.xml",
    "primaryTopic": "health_biohacking",
    "topics": [
      "health_biohacking",
      "contemplation_mind"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ScienceDaily",
    "language": "en"
  },
  {
    "id": "sd-paleontology",
    "name": "ScienceDaily Paleontology & Fossils",
    "url": "https://www.sciencedaily.com/rss/fossils_ruins/paleontology.xml",
    "primaryTopic": "science_society",
    "topics": [
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ScienceDaily",
    "language": "en"
  },
  {
    "id": "wondermark-comics",
    "name": "Wondermark (Victorian Woodcut Satire)",
    "url": "https://wondermark.com/feed/",
    "primaryTopic": "memes_satire",
    "topics": [
      "memes_satire",
      "art_aesthetics"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "David Malki",
    "language": "en"
  },
  {
    "id": "sd-graphene",
    "name": "ScienceDaily Graphene & 2D Materials",
    "url": "https://www.sciencedaily.com/rss/matter_energy/graphene.xml",
    "primaryTopic": "science_society",
    "topics": [
      "science_society",
      "opportunities_growth"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ScienceDaily",
    "language": "en"
  },
  {
    "id": "sd-video-games",
    "name": "ScienceDaily Cognitive Effects of Interactive Media",
    "url": "https://www.sciencedaily.com/rss/computers_math/video_games.xml",
    "primaryTopic": "german_didactics",
    "topics": [
      "german_didactics",
      "ai_apple"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ScienceDaily",
    "language": "en",
    "isTeachingRelated": true
  },
  {
    "id": "sd-brain-injury",
    "name": "ScienceDaily Neuroplasticity & Brain Recovery",
    "url": "https://www.sciencedaily.com/rss/mind_brain/brain_injury.xml",
    "primaryTopic": "health_biohacking",
    "topics": [
      "health_biohacking"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ScienceDaily",
    "language": "en"
  },
  {
    "id": "sd-batteries",
    "name": "ScienceDaily Energy Technology & Batteries",
    "url": "https://www.sciencedaily.com/rss/matter_energy/energy_technology.xml",
    "primaryTopic": "opportunities_growth",
    "topics": [
      "opportunities_growth",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ScienceDaily",
    "language": "en"
  },
  {
    "id": "sd-software",
    "name": "ScienceDaily Software & Algorithms",
    "url": "https://www.sciencedaily.com/rss/computers_math/software.xml",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ScienceDaily",
    "language": "en"
  },
  {
    "id": "sd-spintronics",
    "name": "ScienceDaily Spintronics & Quantum Matter",
    "url": "https://www.sciencedaily.com/rss/matter_energy/spintronics.xml",
    "primaryTopic": "science_society",
    "topics": [
      "science_society",
      "ai_apple"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ScienceDaily",
    "language": "en"
  },
  {
    "id": "sd-geology",
    "name": "ScienceDaily Geology & Earth History",
    "url": "https://www.sciencedaily.com/rss/earth_climate/geology.xml",
    "primaryTopic": "science_society",
    "topics": [
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ScienceDaily",
    "language": "en"
  },
  {
    "id": "sd-music-brain",
    "name": "ScienceDaily Music & The Brain",
    "url": "https://www.sciencedaily.com/rss/mind_brain/music.xml",
    "primaryTopic": "sound_synthesis",
    "topics": [
      "sound_synthesis",
      "contemplation_mind",
      "health_biohacking"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ScienceDaily",
    "language": "en"
  },
  {
    "id": "sd-ancient-dna",
    "name": "ScienceDaily Ancient Civilizations",
    "url": "https://www.sciencedaily.com/rss/fossils_ruins/ancient_civilizations.xml",
    "primaryTopic": "book_mastery",
    "topics": [
      "book_mastery",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ScienceDaily",
    "language": "en"
  },
  {
    "id": "sd-literacy",
    "name": "ScienceDaily Reading Comprehension & Literacy",
    "url": "https://www.sciencedaily.com/rss/mind_brain/literacy.xml",
    "primaryTopic": "german_didactics",
    "topics": [
      "german_didactics",
      "book_mastery"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ScienceDaily",
    "language": "en",
    "isTeachingRelated": true
  },
  {
    "id": "sd-Vitamin-nutrients",
    "name": "ScienceDaily Micronutrients & Vitamins",
    "url": "https://www.sciencedaily.com/rss/health_medicine/vitamins.xml",
    "primaryTopic": "health_biohacking",
    "topics": [
      "health_biohacking"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ScienceDaily",
    "language": "en"
  },
  {
    "id": "sd-sports-medicine",
    "name": "ScienceDaily Sports Science & Recovery",
    "url": "https://www.sciencedaily.com/rss/health_medicine/sports_medicine.xml",
    "primaryTopic": "health_biohacking",
    "topics": [
      "health_biohacking"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ScienceDaily",
    "language": "en"
  },
  {
    "id": "lobsters-linux",
    "name": "Lobsters Linux Kernel & Open Source",
    "url": "https://lobste.rs/t/linux.rss",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple",
      "opportunities_growth"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Lobsters Linux",
    "language": "en"
  },
  {
    "id": "lobsters-go",
    "name": "Lobsters Go & Cloud Infrastructure",
    "url": "https://lobste.rs/t/go.rss",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Lobsters Go",
    "language": "en"
  },
  {
    "id": "lobsters-c",
    "name": "Lobsters Low-Level C & Systems",
    "url": "https://lobste.rs/t/c.rss",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Lobsters C",
    "language": "en"
  },
  {
    "id": "lobsters-privacy",
    "name": "Lobsters Digital Privacy & Sovereignty",
    "url": "https://lobste.rs/t/privacy.rss",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "ai_apple"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Lobsters Privacy",
    "language": "en",
    "isChallengingPerspective": true
  },
  {
    "id": "lobsters-networking",
    "name": "Lobsters Internet Protocols & Networking",
    "url": "https://lobste.rs/t/networking.rss",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Lobsters Net",
    "language": "en"
  },
  {
    "id": "lobsters-javascript",
    "name": "Lobsters TypeScript & Modern Web",
    "url": "https://lobste.rs/t/javascript.rss",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Lobsters JS",
    "language": "en"
  },
  {
    "id": "lobsters-practices",
    "name": "Lobsters Engineering Craft & Practices",
    "url": "https://lobste.rs/t/practices.rss",
    "primaryTopic": "opportunities_growth",
    "topics": [
      "opportunities_growth",
      "ai_apple"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Lobsters Craft",
    "language": "en"
  },
  {
    "id": "sd-dementia",
    "name": "ScienceDaily Brain Aging & Alzheimer Research",
    "url": "https://www.sciencedaily.com/rss/mind_brain/alzheimer's.xml",
    "primaryTopic": "health_biohacking",
    "topics": [
      "health_biohacking"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "ScienceDaily",
    "language": "en"
  },
  {
    "id": "lobsters-retro",
    "name": "Lobsters Retrocomputing & History",
    "url": "https://lobste.rs/t/retrocomputing.rss",
    "primaryTopic": "book_mastery",
    "topics": [
      "book_mastery",
      "ai_apple"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Lobsters Retro",
    "language": "en"
  },
  {
    "id": "lobsters-osdev",
    "name": "Lobsters Operating Systems Design",
    "url": "https://lobste.rs/t/osdev.rss",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Lobsters OS",
    "language": "en"
  },
  {
    "id": "derek-sivers",
    "name": "Derek Sivers (Philosophy of Creative Independence)",
    "url": "https://sive.rs/en.atom",
    "primaryTopic": "opportunities_growth",
    "topics": [
      "opportunities_growth",
      "contemplation_mind",
      "sound_synthesis"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Derek Sivers",
    "language": "en"
  },
  {
    "id": "pluralistic-doctorow",
    "name": "Pluralistic (Cory Doctorow – Enshittification & Digital Rights)",
    "url": "https://pluralistic.net/feed/",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "ai_apple"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Cory Doctorow",
    "language": "en",
    "isChallengingPerspective": true
  },
  {
    "id": "lobsters-law",
    "name": "Lobsters Tech Law & Regulation",
    "url": "https://lobste.rs/t/law.rss",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "ai_apple"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "defaultAuthor": "Lobsters Law",
    "language": "en",
    "isChallengingPerspective": true
  }
];

/**
 * Total Deduplicated Global Sources Catalog (655 sources).
 * - 380 Active Core Sources (defaultEnabled: true)
 * - 275 Reserve & Research Sources (defaultEnabled: false, on-demand in News Hub)
 */
export const VERIFIED_FEED_SOURCES: RawFeedSource[] = [
  ...ACTIVE_CORE_SOURCES,
  ...GLOBAL_CORPUS_RESERVE_SOURCES
];
