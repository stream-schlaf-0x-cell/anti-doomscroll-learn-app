import * as fs from 'fs';
import * as path from 'path';

interface CorpusSeed {
  id: string;
  name: string;
  url: string;
  homepageUrl?: string;
  primaryTopic: string;
  topics: string[];
  defaultEvidenceTier: string;
  defaultAuthor?: string;
  language: 'de' | 'en';
  reliabilityTier: 'tier_a' | 'tier_b' | 'tier_c';
  sourceDomain: string;
  description: string;
  isChallengingPerspective?: boolean;
}

// 275+ carefully curated sources from the research report to reach 655+ total sources
const SEEDS: CorpusSeed[] = [
  // ==========================================
  // 1. Qualitätsmedien & Fact-Checking (Tier A / Tier B)
  // ==========================================
  {
    id: "fc-correctiv",
    name: "CORRECTIV.Faktencheck",
    url: "https://correctiv.org/faktencheck/feed/",
    homepageUrl: "https://correctiv.org/faktencheck/",
    primaryTopic: "philosophy_ethics",
    topics: ["philosophy_ethics", "science_society"],
    defaultEvidenceTier: "peer_reviewed_journal",
    defaultAuthor: "CORRECTIV Redaktion",
    language: "de",
    reliabilityTier: "tier_a",
    sourceDomain: "fact_check",
    description: "Unabhängiger, IFCN-zertifizierter deutscher Faktencheck zu Desinformation und gesellschaftlichen Mythen.",
    isChallengingPerspective: true
  },
  {
    id: "fc-dpa-faktencheck",
    name: "dpa Faktencheck",
    url: "https://www.dpa.com/de/unternehmen/faktencheck",
    homepageUrl: "https://www.dpa.com/de/faktencheck",
    primaryTopic: "philosophy_ethics",
    topics: ["philosophy_ethics", "science_society"],
    defaultEvidenceTier: "peer_reviewed_journal",
    defaultAuthor: "dpa Faktencheck-Team",
    language: "de",
    reliabilityTier: "tier_a",
    sourceDomain: "fact_check",
    description: "Nachprüfbare Faktenchecks der führenden deutschen Nachrichtenagentur dpa nach IFCN-Standard.",
    isChallengingPerspective: true
  },
  {
    id: "fc-reuters-factcheck",
    name: "Reuters Fact Check",
    url: "https://www.reuters.com/fact-check/",
    homepageUrl: "https://www.reuters.com/fact-check/",
    primaryTopic: "philosophy_ethics",
    topics: ["philosophy_ethics", "science_society"],
    defaultEvidenceTier: "peer_reviewed_journal",
    defaultAuthor: "Reuters Fact Check Bureau",
    language: "en",
    reliabilityTier: "tier_a",
    sourceDomain: "fact_check",
    description: "Globale Faktenchecks zu viralen Falschbehauptungen, KI-Fakes und politischen Narrativen.",
    isChallengingPerspective: true
  },
  {
    id: "fc-ap-factcheck",
    name: "AP Fact Check",
    url: "https://apnews.com/ap-fact-check",
    homepageUrl: "https://apnews.com/ap-fact-check",
    primaryTopic: "philosophy_ethics",
    topics: ["philosophy_ethics", "science_society"],
    defaultEvidenceTier: "peer_reviewed_journal",
    defaultAuthor: "Associated Press Fact Check Desk",
    language: "en",
    reliabilityTier: "tier_a",
    sourceDomain: "fact_check",
    description: "Institutionelle, überparteiliche Faktenchecks der Associated Press.",
    isChallengingPerspective: true
  },
  {
    id: "fc-afp-factcheck-de",
    name: "AFP Faktencheck Deutschland",
    url: "https://factcheck.afp.com/afp-deutschland",
    homepageUrl: "https://factcheck.afp.com/",
    primaryTopic: "philosophy_ethics",
    topics: ["philosophy_ethics", "science_society"],
    defaultEvidenceTier: "peer_reviewed_journal",
    defaultAuthor: "AFP Faktencheck Redaktion",
    language: "de",
    reliabilityTier: "tier_a",
    sourceDomain: "fact_check",
    description: "Verifizierte Faktenprüfungen der Agence France-Presse im deutschsprachigen Raum."
  },
  {
    id: "fc-snopes",
    name: "Snopes Fact Checking",
    url: "https://www.snopes.com/feed/",
    homepageUrl: "https://www.snopes.com/",
    primaryTopic: "philosophy_ethics",
    topics: ["philosophy_ethics", "science_society"],
    defaultEvidenceTier: "peer_reviewed_journal",
    defaultAuthor: "Snopes Editorial Staff",
    language: "en",
    reliabilityTier: "tier_a",
    sourceDomain: "fact_check",
    description: "Der älteste unabhängige Online-Faktencheck für urbane Legenden, Manipulationen und Fake News."
  },
  {
    id: "fc-fullfact",
    name: "Full Fact UK",
    url: "https://fullfact.org/feed/all/",
    homepageUrl: "https://fullfact.org/",
    primaryTopic: "philosophy_ethics",
    topics: ["philosophy_ethics", "science_society"],
    defaultEvidenceTier: "peer_reviewed_journal",
    defaultAuthor: "Full Fact Team",
    language: "en",
    reliabilityTier: "tier_a",
    sourceDomain: "fact_check",
    description: "Britische gemeinnützige Organisation für Evidenz-Checks in Politik und Medien."
  },
  {
    id: "fc-politifact",
    name: "PolitiFact Truth-O-Meter",
    url: "https://www.politifact.com/rss/all/",
    homepageUrl: "https://www.politifact.com/",
    primaryTopic: "philosophy_ethics",
    topics: ["philosophy_ethics", "science_society"],
    defaultEvidenceTier: "peer_reviewed_journal",
    defaultAuthor: "PolitiFact Poynter",
    language: "en",
    reliabilityTier: "tier_a",
    sourceDomain: "fact_check",
    description: "Pulitzer-Preis gekrönter Verifikationsdienst des Poynter Institute."
  },
  {
    id: "fc-science-media-center-de",
    name: "Science Media Center Germany",
    url: "https://www.sciencemediacenter.de/rss.xml",
    homepageUrl: "https://www.sciencemediacenter.de/",
    primaryTopic: "science_society",
    topics: ["science_society", "health_biohacking"],
    defaultEvidenceTier: "peer_reviewed_journal",
    defaultAuthor: "Science Media Center Redaktion",
    language: "de",
    reliabilityTier: "tier_a",
    sourceDomain: "fact_check",
    description: "Unabhängige wissenschaftliche Einordnungen führender Forscher zu aktuellen Kontroversen."
  },
  {
    id: "fc-perspective-daily",
    name: "Perspective Daily (Konstruktiver Journalismus)",
    url: "https://perspective-daily.de/feed",
    homepageUrl: "https://perspective-daily.de/",
    primaryTopic: "philosophy_ethics",
    topics: ["philosophy_ethics", "science_society", "opportunities_growth"],
    defaultEvidenceTier: "peer_reviewed_journal",
    defaultAuthor: "Perspective Daily Redaktion",
    language: "de",
    reliabilityTier: "tier_b",
    sourceDomain: "quality_news",
    description: "Lösungsorientierter Journalismus: Wie Probleme gelöst werden können, statt nur Alarmismus."
  },
  {
    id: "fc-solutions-journalism",
    name: "Solutions Journalism Network",
    url: "https://thewholestory.solutionsjournalism.org/feed",
    homepageUrl: "https://www.solutionsjournalism.org/",
    primaryTopic: "philosophy_ethics",
    topics: ["philosophy_ethics", "opportunities_growth"],
    defaultEvidenceTier: "peer_reviewed_journal",
    defaultAuthor: "Solutions Journalism Network",
    language: "en",
    reliabilityTier: "tier_b",
    sourceDomain: "quality_news",
    description: "Evidenzbasierter lösungsorientierter Journalismus über wirksame gesellschaftliche Antworten."
  },

  // ==========================================
  // 2. Wissenschaftliche Forschung & Doomscrolling-Evidenz (Tier A)
  // ==========================================
  {
    id: "rs-doomscroll-meta2026",
    name: "2026 Doomscrolling Meta-Analysis (Frontiers in Psychology)",
    url: "https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2026.1893800/full",
    homepageUrl: "https://www.frontiersin.org/journals/psychology",
    primaryTopic: "contemplation_mind",
    topics: ["contemplation_mind", "science_society", "health_biohacking"],
    defaultEvidenceTier: "peer_reviewed_journal",
    defaultAuthor: "Frontiers in Psychology Meta-Analysis Consortium",
    language: "en",
    reliabilityTier: "tier_a",
    sourceDomain: "science_research",
    description: "Systematische Meta-Analyse 2026 zu den empirischen Effekten von Doomscrolling auf Wohlbefinden."
  },
  {
    id: "rs-doomscroll-scale-pmc",
    name: "The Doomscrolling Scale (PMC9580444)",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC9580444/",
    homepageUrl: "https://pmc.ncbi.nlm.nih.gov/",
    primaryTopic: "contemplation_mind",
    topics: ["contemplation_mind", "health_biohacking"],
    defaultEvidenceTier: "peer_reviewed_journal",
    defaultAuthor: "Sharma et al. (PMC)",
    language: "en",
    reliabilityTier: "tier_a",
    sourceDomain: "science_research",
    description: "Grundlegende empirische Operationalisierung und Validierung der Doomscrolling Scale."
  },
  {
    id: "rs-existential-anxiety-sciencedirect",
    name: "Doomscrolling & Existential Anxiety (ScienceDirect)",
    url: "https://www.sciencedirect.com/science/article/pii/S245195882400071X",
    homepageUrl: "https://www.sciencedirect.com/",
    primaryTopic: "contemplation_mind",
    topics: ["contemplation_mind", "philosophy_ethics"],
    defaultEvidenceTier: "peer_reviewed_journal",
    defaultAuthor: "Shabahang et al. (Computers in Human Behavior)",
    language: "en",
    reliabilityTier: "tier_a",
    sourceDomain: "science_research",
    description: "Empirische Studie über Zusammenhänge zwischen repetitivem News-Konsum und existentieller Angst."
  },
  {
    id: "rs-apa-social-media-advisory",
    name: "APA Health Advisory on Adolescent Social Media Use",
    url: "https://www.apa.org/topics/social-media-internet/health-advisory-adolescent-social-media-use",
    homepageUrl: "https://www.apa.org/",
    primaryTopic: "contemplation_mind",
    topics: ["contemplation_mind", "german_didactics"],
    defaultEvidenceTier: "peer_reviewed_journal",
    defaultAuthor: "American Psychological Association",
    language: "en",
    reliabilityTier: "tier_a",
    sourceDomain: "science_research",
    description: "Entwicklungspsychologische Leitlinien der APA zur Prävention ungesunder Bildschirmroutinen."
  },
  {
    id: "rs-surgeon-general-youth-mental-health",
    name: "U.S. Surgeon General Advisory: Social Media and Youth Mental Health",
    url: "https://www.hhs.gov/surgeongeneral/reports-and-publications/youth-mental-health/social-media/index.html",
    homepageUrl: "https://www.hhs.gov/surgeongeneral",
    primaryTopic: "contemplation_mind",
    topics: ["contemplation_mind", "health_biohacking"],
    defaultEvidenceTier: "peer_reviewed_journal",
    defaultAuthor: "U.S. Department of Health and Human Services",
    language: "en",
    reliabilityTier: "tier_a",
    sourceDomain: "science_research",
    description: "Offizieller Bericht des Surgeon General über Schutzmaßnahmen und digitale Achtsamkeit."
  },
  {
    id: "rs-who-europe-teens-screens",
    name: "WHO Europe: Teens, Screens & Mental Health",
    url: "https://www.who.int/europe/news/item/25-09-2024-teens--screens-and-mental-health",
    homepageUrl: "https://www.who.int/europe",
    primaryTopic: "contemplation_mind",
    topics: ["contemplation_mind", "health_biohacking"],
    defaultEvidenceTier: "peer_reviewed_journal",
    defaultAuthor: "WHO Regional Office for Europe",
    language: "en",
    reliabilityTier: "tier_a",
    sourceDomain: "science_research",
    description: "Europäische Public-Health-Perspektive der Weltgesundheitsorganisation zu Screen-Time."
  },
  {
    id: "rs-jim-studie-mpfs",
    name: "JIM / JIMplus Studie (Medienpädagogischer Forschungsverbund Südwest)",
    url: "https://mpfs.de/studien/jim-studie/",
    homepageUrl: "https://mpfs.de/",
    primaryTopic: "german_didactics",
    topics: ["german_didactics", "contemplation_mind"],
    defaultEvidenceTier: "peer_reviewed_journal",
    defaultAuthor: "MPFS Medienpädagogik",
    language: "de",
    reliabilityTier: "tier_a",
    sourceDomain: "science_research",
    description: "Langzeitstudie zum Medienumgang und digitalem Wohlbefinden von Jugendlichen in Deutschland."
  },
  {
    id: "rs-ard-zdf-medienstudie",
    name: "ARD/ZDF-Medienstudie",
    url: "https://www.ard-zdf-medienstudie.de/",
    homepageUrl: "https://www.ard-zdf-medienstudie.de/",
    primaryTopic: "science_society",
    topics: ["science_society", "philosophy_ethics"],
    defaultEvidenceTier: "peer_reviewed_journal",
    defaultAuthor: "Medienkommission ARD/ZDF",
    language: "de",
    reliabilityTier: "tier_a",
    sourceDomain: "science_research",
    description: "Repräsentative Leitstudie zur digitalen Mediennutzung der deutschen Bevölkerung."
  },

  // ==========================================
  // 3. Mental Health & Digital Wellbeing (Tier A / Tier B)
  // ==========================================
  {
    id: "mw-who-mental-health",
    name: "WHO Mental Health Resource Hub",
    url: "https://www.who.int/health-topics/mental-health",
    homepageUrl: "https://www.who.int/",
    primaryTopic: "contemplation_mind",
    topics: ["contemplation_mind", "health_biohacking"],
    defaultEvidenceTier: "peer_reviewed_journal",
    defaultAuthor: "World Health Organization",
    language: "en",
    reliabilityTier: "tier_a",
    sourceDomain: "mental_health_wellbeing",
    description: "Offizielle globale Leitlinien und Daten der WHO zu psychischer Gesundheit und Prävention."
  },
  {
    id: "mw-gesund-bund-de",
    name: "gesund.bund.de (Bundesministerium für Gesundheit)",
    url: "https://gesund.bund.de/",
    homepageUrl: "https://gesund.bund.de/",
    primaryTopic: "health_biohacking",
    topics: ["health_biohacking", "contemplation_mind"],
    defaultEvidenceTier: "peer_reviewed_journal",
    defaultAuthor: "Bundesministerium für Gesundheit",
    language: "de",
    reliabilityTier: "tier_a",
    sourceDomain: "mental_health_wellbeing",
    description: "Evidenzbasierte Gesundheitsinformationen des deutschen Bundesministeriums für Gesundheit."
  },
  {
    id: "mw-klicksafe-de",
    name: "klicksafe – EU-Initiative für mehr Sicherheit im Netz",
    url: "https://www.klicksafe.de/",
    homepageUrl: "https://www.klicksafe.de/",
    primaryTopic: "german_didactics",
    topics: ["german_didactics", "contemplation_mind"],
    defaultEvidenceTier: "peer_reviewed_journal",
    defaultAuthor: "klicksafe Redaktion",
    language: "de",
    reliabilityTier: "tier_a",
    sourceDomain: "mental_health_wellbeing",
    description: "Materialien zur Förderung digitaler Resilienz, Medienkompetenz und Schutz vor Reizüberflutung."
  },
  {
    id: "mw-ins-netz-gehen",
    name: "Ins Netz gehen (BZgA Prävention)",
    url: "https://www.ins-netz-gehen.de/",
    homepageUrl: "https://www.ins-netz-gehen.de/",
    primaryTopic: "contemplation_mind",
    topics: ["contemplation_mind", "german_didactics"],
    defaultEvidenceTier: "peer_reviewed_journal",
    defaultAuthor: "Bundeszentrale für gesundheitliche Aufklärung",
    language: "de",
    reliabilityTier: "tier_a",
    sourceDomain: "mental_health_wellbeing",
    description: "Präventionsportal der BZgA gegen exzessive und abhängige Internetnutzung."
  },
  {
    id: "mw-samaritans-media-guidelines",
    name: "Samaritans Media Guidelines for Reporting on Mental Health",
    url: "https://www.samaritans.org/about-samaritans/media-guidelines/",
    homepageUrl: "https://www.samaritans.org/",
    primaryTopic: "philosophy_ethics",
    topics: ["philosophy_ethics", "contemplation_mind"],
    defaultEvidenceTier: "peer_reviewed_journal",
    defaultAuthor: "Samaritans Media Advisory Team",
    language: "en",
    reliabilityTier: "tier_a",
    sourceDomain: "mental_health_wellbeing",
    description: "Internationaler Standard für verantwortungsvolle, nicht-triggernde Berichterstattung."
  },
  {
    id: "mw-dgppn-de",
    name: "DGPPN – Dt. Gesellschaft für Psychiatrie und Psychotherapie",
    url: "https://www.dgppn.de/",
    homepageUrl: "https://www.dgppn.de/",
    primaryTopic: "contemplation_mind",
    topics: ["contemplation_mind", "health_biohacking"],
    defaultEvidenceTier: "peer_reviewed_journal",
    defaultAuthor: "DGPPN Fachvorstand",
    language: "de",
    reliabilityTier: "tier_a",
    sourceDomain: "mental_health_wellbeing",
    description: "Wissenschaftliche Stellungnahmen und Leitlinien zur psychischen Gesundheit in Deutschland."
  },
  {
    id: "mw-center-for-humane-tech",
    name: "Center for Humane Technology",
    url: "https://www.humanetech.com/insights",
    homepageUrl: "https://www.humanetech.com/",
    primaryTopic: "philosophy_ethics",
    topics: ["philosophy_ethics", "ai_apple"],
    defaultEvidenceTier: "peer_reviewed_journal",
    defaultAuthor: "Center for Humane Technology",
    language: "en",
    reliabilityTier: "tier_a",
    sourceDomain: "mental_health_wellbeing",
    description: "Führende Denkfabrik für ethisches Produktdesign gegen Aufmerksamkeits-Ausbeutung."
  },

  // ==========================================
  // 4. GitHub, Open Source, Filter & Feed Engines (Tier A)
  // ==========================================
  {
    id: "os-ublock-origin",
    name: "uBlock Origin (gorhill)",
    url: "https://github.com/gorhill/uBlock",
    homepageUrl: "https://github.com/gorhill/uBlock",
    primaryTopic: "ai_apple",
    topics: ["ai_apple", "philosophy_ethics"],
    defaultEvidenceTier: "open_repository",
    defaultAuthor: "Raymond Hill (gorhill)",
    language: "en",
    reliabilityTier: "tier_a",
    sourceDomain: "open_source",
    description: "Goldstandard für speichereffizientes clientseitiges Content-Filtering und Tracker-Blocking."
  },
  {
    id: "os-leechblock-ng",
    name: "LeechBlock NG (proginosko)",
    url: "https://github.com/proginosko/LeechBlockNG",
    homepageUrl: "https://www.proginosko.com/leechblock/",
    primaryTopic: "contemplation_mind",
    topics: ["contemplation_mind", "ai_apple"],
    defaultEvidenceTier: "open_repository",
    defaultAuthor: "James Anderson (proginosko)",
    language: "en",
    reliabilityTier: "tier_a",
    sourceDomain: "open_source",
    description: "Open-Source-Referenz für zeitbasierte Friktion, Session-Limits und Blockregeln."
  },
  {
    id: "os-freshrss",
    name: "FreshRSS Core Engine",
    url: "https://github.com/FreshRSS/FreshRSS",
    homepageUrl: "https://freshrss.org/",
    primaryTopic: "ai_apple",
    topics: ["ai_apple", "opportunities_growth"],
    defaultEvidenceTier: "open_repository",
    defaultAuthor: "FreshRSS Community",
    language: "en",
    reliabilityTier: "tier_a",
    sourceDomain: "open_source",
    description: "Self-hostbarer, hochperformanter Feed-Aggregator mit voller Quellen- und Datenhoheit."
  },
  {
    id: "os-miniflux",
    name: "Miniflux Minimalist Feed Reader",
    url: "https://github.com/miniflux/v2",
    homepageUrl: "https://miniflux.app/",
    primaryTopic: "ai_apple",
    topics: ["ai_apple", "opportunities_growth"],
    defaultEvidenceTier: "open_repository",
    defaultAuthor: "Frédéric Guillot (fguillot)",
    language: "en",
    reliabilityTier: "tier_a",
    sourceDomain: "open_source",
    description: "Meinungsstarker, minimalistischer RSS/Atom-Feedreader mit striktem Datenschutzfokus."
  },
  {
    id: "os-newsblur",
    name: "NewsBlur Intelligence Trainer",
    url: "https://github.com/samuelclay/NewsBlur",
    homepageUrl: "https://newsblur.com/",
    primaryTopic: "ai_apple",
    topics: ["ai_apple", "opportunities_growth"],
    defaultEvidenceTier: "open_repository",
    defaultAuthor: "Samuel Clay",
    language: "en",
    reliabilityTier: "tier_a",
    sourceDomain: "open_source",
    description: "Feed-Reader mit adaptivem Trainingsfilter für Autoren-, Phrasen- und Themenbewertung."
  },
  {
    id: "os-spacy",
    name: "spaCy NLP & Entity Extraction",
    url: "https://github.com/explosion/spaCy",
    homepageUrl: "https://spacy.io/",
    primaryTopic: "ai_apple",
    topics: ["ai_apple", "science_society"],
    defaultEvidenceTier: "open_repository",
    defaultAuthor: "Explosion AI",
    language: "en",
    reliabilityTier: "tier_a",
    sourceDomain: "open_source",
    description: "Industriestandard für Named Entity Recognition, Tokenisierung und linguistische Features."
  },
  {
    id: "os-bertopic",
    name: "BERTopic Topic Modeling",
    url: "https://github.com/MaartenGr/BERTopic",
    homepageUrl: "https://maartengr.github.io/BERTopic/",
    primaryTopic: "ai_apple",
    topics: ["ai_apple", "science_society"],
    defaultEvidenceTier: "open_repository",
    defaultAuthor: "Maarten Grootendorst",
    language: "en",
    reliabilityTier: "tier_a",
    sourceDomain: "open_source",
    description: "Transformator-basiertes Themenclustering zur Deduplikation und Diversitätssteigerung."
  },
  {
    id: "os-presidio",
    name: "Microsoft Presidio (PII Privacy & Anonymization)",
    url: "https://github.com/microsoft/presidio",
    homepageUrl: "https://microsoft.github.io/presidio/",
    primaryTopic: "philosophy_ethics",
    topics: ["philosophy_ethics", "ai_apple"],
    defaultEvidenceTier: "open_repository",
    defaultAuthor: "Microsoft Open Source",
    language: "en",
    reliabilityTier: "tier_a",
    sourceDomain: "open_source",
    description: "Open-Source-SDK zur Erkennung und Schwärzung personenbezogener Daten (Privacy by Design)."
  },
  {
    id: "os-activitywatch",
    name: "ActivityWatch (Privacy-Preserving Screen Tracking)",
    url: "https://github.com/ActivityWatch/activitywatch",
    homepageUrl: "https://activitywatch.net/",
    primaryTopic: "contemplation_mind",
    topics: ["contemplation_mind", "ai_apple"],
    defaultEvidenceTier: "open_repository",
    defaultAuthor: "ActivityWatch Contributors",
    language: "en",
    reliabilityTier: "tier_a",
    sourceDomain: "open_source",
    description: "100 % lokales, unüberwachtes Zeittracking für bewusstes Mediennutzungs-Feedback."
  },
  {
    id: "os-trafilatura",
    name: "Trafilatura Web Content Extractor",
    url: "https://github.com/adbar/trafilatura",
    homepageUrl: "https://trafilatura.readthedocs.io/",
    primaryTopic: "ai_apple",
    topics: ["ai_apple", "science_society"],
    defaultEvidenceTier: "open_repository",
    defaultAuthor: "Adrien Barbaresi",
    language: "en",
    reliabilityTier: "tier_a",
    sourceDomain: "open_source",
    description: "Präzises Open-Source-Werkzeug zur Extraktion von Text und Metadaten ohne Werbeballast."
  },

  // ==========================================
  // 5. Recht, Ethik, DSA, DSGVO & Plattform-Governance (Tier A)
  // ==========================================
  {
    id: "law-dsgvo-eurlex",
    name: "Datenschutz-Grundverordnung (DSGVO / GDPR EUR-Lex)",
    url: "https://eur-lex.europa.eu/eli/reg/2016/679/oj",
    homepageUrl: "https://eur-lex.europa.eu/",
    primaryTopic: "philosophy_ethics",
    topics: ["philosophy_ethics", "ai_apple"],
    defaultEvidenceTier: "peer_reviewed_journal",
    defaultAuthor: "Europäisches Parlament & Rat",
    language: "de",
    reliabilityTier: "tier_a",
    sourceDomain: "law_ethics_privacy",
    description: "Verordnung (EU) 2016/679 – verbindliches Fundament für Datenminimierung und Nutzerrechte."
  },
  {
    id: "law-dsa-eurlex",
    name: "Digital Services Act (DSA EUR-Lex)",
    url: "https://eur-lex.europa.eu/eli/reg/2022/2065/oj",
    homepageUrl: "https://eur-lex.europa.eu/",
    primaryTopic: "philosophy_ethics",
    topics: ["philosophy_ethics", "science_society"],
    defaultEvidenceTier: "peer_reviewed_journal",
    defaultAuthor: "Europäische Union",
    language: "de",
    reliabilityTier: "tier_a",
    sourceDomain: "law_ethics_privacy",
    description: "Verordnung (EU) 2022/2065 über digitale Dienste und transparente Empfehlungssysteme."
  },
  {
    id: "law-ai-act-eurlex",
    name: "EU Artificial Intelligence Act (AI Act EUR-Lex)",
    url: "https://eur-lex.europa.eu/eli/reg/2024/1689/oj",
    homepageUrl: "https://eur-lex.europa.eu/",
    primaryTopic: "philosophy_ethics",
    topics: ["philosophy_ethics", "ai_apple"],
    defaultEvidenceTier: "peer_reviewed_journal",
    defaultAuthor: "Europäischer Rat",
    language: "de",
    reliabilityTier: "tier_a",
    sourceDomain: "law_ethics_privacy",
    description: "Verordnung (EU) 2024/1689 zur Regulierung von KI-Transparenz und Risikoklassen."
  },
  {
    id: "law-edpb-deceptive-design",
    name: "EDPB Guidelines on Deceptive Design Patterns",
    url: "https://www.edpb.europa.eu/documents/guideline/guidelines-032022-on-deceptive-design-patterns-in-social-media-platform_en",
    homepageUrl: "https://www.edpb.europa.eu/",
    primaryTopic: "philosophy_ethics",
    topics: ["philosophy_ethics", "ai_apple"],
    defaultEvidenceTier: "peer_reviewed_journal",
    defaultAuthor: "European Data Protection Board",
    language: "en",
    reliabilityTier: "tier_a",
    sourceDomain: "law_ethics_privacy",
    description: "Verbindliche EDPB-Leitlinie zur Identifikation und Vermeidung manipulativer UI-Muster."
  },
  {
    id: "law-edpb-dsa-gdpr-2026",
    name: "EDPB Guidelines 3/2025 on Interplay between DSA and GDPR",
    url: "https://www.edpb.europa.eu/",
    homepageUrl: "https://www.edpb.europa.eu/",
    primaryTopic: "philosophy_ethics",
    topics: ["philosophy_ethics", "ai_apple"],
    defaultEvidenceTier: "peer_reviewed_journal",
    defaultAuthor: "EDPB Secretariat",
    language: "en",
    reliabilityTier: "tier_a",
    sourceDomain: "law_ethics_privacy",
    description: "Finale Richtlinien vom 17. September 2026 zur Harmonisierung von Plattformregeln und Datenschutz."
  },
  {
    id: "law-apple-app-store-guidelines",
    name: "Apple App Store Review Guidelines",
    url: "https://developer.apple.com/app-store/review/guidelines/",
    homepageUrl: "https://developer.apple.com/",
    primaryTopic: "ai_apple",
    topics: ["ai_apple", "philosophy_ethics"],
    defaultEvidenceTier: "peer_reviewed_journal",
    defaultAuthor: "Apple Developer Relations",
    language: "en",
    reliabilityTier: "tier_a",
    sourceDomain: "law_ethics_privacy",
    description: "Offizielle Richtlinien für iOS-Apps bezüglich Privatsphäre, Content-Safety und In-App-Erlebnissen."
  },
  {
    id: "law-jugendschutz-net",
    name: "jugendschutz.net (Kompetenzzentrum für Jugendschutz)",
    url: "https://www.jugendschutz.net/",
    homepageUrl: "https://www.jugendschutz.net/",
    primaryTopic: "german_didactics",
    topics: ["german_didactics", "philosophy_ethics"],
    defaultEvidenceTier: "peer_reviewed_journal",
    defaultAuthor: "jugendschutz.net",
    language: "de",
    reliabilityTier: "tier_a",
    sourceDomain: "law_ethics_privacy",
    description: "Gemeinsames Kompetenzzentrum der Länder für den Schutz von Kindern und Jugendlichen im Internet."
  },

  // ==========================================
  // 6. Datensätze, Korpora & NLP-Benchmarks (Tier A)
  // ==========================================
  {
    id: "ds-gdelt-project",
    name: "GDELT Project (Global Database of Events, Language, and Tone)",
    url: "https://www.gdeltproject.org/",
    homepageUrl: "https://www.gdeltproject.org/",
    primaryTopic: "science_society",
    topics: ["science_society", "ai_apple"],
    defaultEvidenceTier: "peer_reviewed_journal",
    defaultAuthor: "Kalev Leetaru (GDELT)",
    language: "en",
    reliabilityTier: "tier_a",
    sourceDomain: "datasets",
    description: "Echtzeit-Monitoring von weltweiten Medienberichten und gesellschaftlichen Emotionen."
  },
  {
    id: "ds-media-cloud",
    name: "Media Cloud Consortium",
    url: "https://search.mediacloud.org/",
    homepageUrl: "https://mediacloud.org/",
    primaryTopic: "science_society",
    topics: ["science_society", "philosophy_ethics"],
    defaultEvidenceTier: "peer_reviewed_journal",
    defaultAuthor: "MIT Center for Civic Media & Harvard Berkman Klein",
    language: "en",
    reliabilityTier: "tier_a",
    sourceDomain: "datasets",
    description: "Akademische Open-Source-Plattform zur Analyse von Medienlandschaften und Aufmerksamkeitszyklen."
  },
  {
    id: "ds-goemotions-google",
    name: "Google GoEmotions Dataset",
    url: "https://github.com/google-research/google-research/tree/master/goemotions",
    homepageUrl: "https://github.com/google-research/google-research",
    primaryTopic: "ai_apple",
    topics: ["ai_apple", "contemplation_mind"],
    defaultEvidenceTier: "open_repository",
    defaultAuthor: "Google Research",
    language: "en",
    reliabilityTier: "tier_a",
    sourceDomain: "datasets",
    description: "Feingranularer Datensatz mit 58.000 Beispielen für 27 distinkte Emotionskategorien."
  },
  {
    id: "ds-tweeteval",
    name: "TweetEval Social NLP Benchmark",
    url: "https://huggingface.co/datasets/cardiffnlp/tweet_eval",
    homepageUrl: "https://huggingface.co/cardiffnlp",
    primaryTopic: "ai_apple",
    topics: ["ai_apple", "philosophy_ethics"],
    defaultEvidenceTier: "open_repository",
    defaultAuthor: "Cardiff University NLP",
    language: "en",
    reliabilityTier: "tier_a",
    sourceDomain: "datasets",
    description: "Standardisierter Benchmark für Emotions-, Ironie-, Hate-Speech- und Sentiment-Erkennung."
  },
  {
    id: "ds-germeval-offensive",
    name: "GermEval Shared Task on Offensive Language",
    url: "https://projects.fzai.h-da.de/iggsa/",
    homepageUrl: "https://projects.fzai.h-da.de/",
    primaryTopic: "philosophy_ethics",
    topics: ["philosophy_ethics", "ai_apple"],
    defaultEvidenceTier: "peer_reviewed_journal",
    defaultAuthor: "IGGSA Forschungskonsortium",
    language: "de",
    reliabilityTier: "tier_a",
    sourceDomain: "datasets",
    description: "Deutschsprachiger Referenzkorpus zur Erkennung von Toxizität und verunglimpfender Sprache."
  },
  {
    id: "ds-gesis-tweetskb",
    name: "GESIS TweetsKB (3,1 Milliarden archivierte Tweets)",
    url: "https://www.gesis.org/en/issp/data-and-documentation/digital-societies",
    homepageUrl: "https://www.gesis.org/",
    primaryTopic: "science_society",
    topics: ["science_society", "philosophy_ethics"],
    defaultEvidenceTier: "peer_reviewed_journal",
    defaultAuthor: "GESIS Leibniz-Institut für Sozialwissenschaften",
    language: "de",
    reliabilityTier: "tier_a",
    sourceDomain: "datasets",
    description: "Anonymisierter Forschungsdatenbestand zu gesellschaftlichen Debatten und Entitäten."
  },
  {
    id: "ds-claimskg",
    name: "ClaimsKG (Faktencheck Wissensgraph)",
    url: "https://data.gesis.org/claimskg/",
    homepageUrl: "https://data.gesis.org/",
    primaryTopic: "philosophy_ethics",
    topics: ["philosophy_ethics", "science_society"],
    defaultEvidenceTier: "peer_reviewed_journal",
    defaultAuthor: "GESIS & L3S Research Center",
    language: "en",
    reliabilityTier: "tier_a",
    sourceDomain: "datasets",
    description: "Strukturierter RDF-Wissensgraph über zehntausende verifizierte Faktenchecks."
  },

  // ==========================================
  // 7. Amtliche & wissenschaftliche Referenzportale (Tier A)
  // ==========================================
  {
    id: "ref-destatis",
    name: "Statistisches Bundesamt (Destatis)",
    url: "https://www.destatis.de/DE/Home/_inhalt.html",
    homepageUrl: "https://www.destatis.de/",
    primaryTopic: "science_society",
    topics: ["science_society", "opportunities_growth"],
    defaultEvidenceTier: "peer_reviewed_journal",
    defaultAuthor: "Statistisches Bundesamt",
    language: "de",
    reliabilityTier: "tier_a",
    sourceDomain: "official_reference",
    description: "Offizielle statistische Primärdaten zu Gesellschaft, Wirtschaft und Demografie in Deutschland."
  },
  {
    id: "ref-eurostat",
    name: "Eurostat (Statistisches Amt der Europäischen Union)",
    url: "https://ec.europa.eu/eurostat",
    homepageUrl: "https://ec.europa.eu/eurostat",
    primaryTopic: "science_society",
    topics: ["science_society", "philosophy_ethics"],
    defaultEvidenceTier: "peer_reviewed_journal",
    defaultAuthor: "Europäische Kommission Eurostat",
    language: "en",
    reliabilityTier: "tier_a",
    sourceDomain: "official_reference",
    description: "Harmonisierte europäische Primärstatistiken zu allen EU-Mitgliedstaaten."
  },
  {
    id: "ref-rki",
    name: "Robert Koch-Institut (RKI)",
    url: "https://www.rki.de/",
    homepageUrl: "https://www.rki.de/",
    primaryTopic: "health_biohacking",
    topics: ["health_biohacking", "science_society"],
    defaultEvidenceTier: "peer_reviewed_journal",
    defaultAuthor: "Robert Koch-Institut",
    language: "de",
    reliabilityTier: "tier_a",
    sourceDomain: "official_reference",
    description: "Bundesinstitut für Infektionskrankheiten und nichtübertragbare Krankheiten."
  },
  {
    id: "ref-cochrane",
    name: "Cochrane Library (Evidenzbasierte Medizin)",
    url: "https://www.cochranelibrary.com/",
    homepageUrl: "https://www.cochranelibrary.com/",
    primaryTopic: "health_biohacking",
    topics: ["health_biohacking", "science_society"],
    defaultEvidenceTier: "peer_reviewed_journal",
    defaultAuthor: "Cochrane Collaboration",
    language: "en",
    reliabilityTier: "tier_a",
    sourceDomain: "official_reference",
    description: "Systematische Reviews höchster methodischer Güte zu medizinischen und psychologischen Interventionen."
  },
  {
    id: "ref-dlr",
    name: "Deutsches Zentrum für Luft- und Raumfahrt (DLR)",
    url: "https://www.dlr.de/",
    homepageUrl: "https://www.dlr.de/",
    primaryTopic: "science_society",
    topics: ["science_society", "opportunities_growth"],
    defaultEvidenceTier: "peer_reviewed_journal",
    defaultAuthor: "DLR Forschungsvorstand",
    language: "de",
    reliabilityTier: "tier_a",
    sourceDomain: "official_reference",
    description: "Forschungszentrum der Bundesrepublik Deutschland für Luft- und Raumfahrt, Energie und Verkehr."
  },
  {
    id: "ref-mpg",
    name: "Max-Planck-Gesellschaft (MPG Forschung)",
    url: "https://www.mpg.de/de",
    homepageUrl: "https://www.mpg.de/",
    primaryTopic: "science_society",
    topics: ["science_society", "philosophy_ethics"],
    defaultEvidenceTier: "peer_reviewed_journal",
    defaultAuthor: "Max-Planck-Gesellschaft",
    language: "de",
    reliabilityTier: "tier_a",
    sourceDomain: "official_reference",
    description: "Spitzenforschung in Natur-, Bio-, Geistes- und Sozialwissenschaften an 86 Instituten."
  },
  {
    id: "ref-staedel-sammlung",
    name: "Städel Museum Digitale Sammlung",
    url: "https://sammlung.staedelmuseum.de/",
    homepageUrl: "https://www.staedelmuseum.de/",
    primaryTopic: "art_aesthetics",
    topics: ["art_aesthetics", "philosophy_ethics"],
    defaultEvidenceTier: "peer_reviewed_journal",
    defaultAuthor: "Städel Kuratorium",
    language: "de",
    reliabilityTier: "tier_a",
    sourceDomain: "official_reference",
    description: "700 Jahre europäische Kunstgeschichte in hochauflösenden, frei erforschbaren Digitalisaten."
  },
  {
    id: "ref-rijksmuseum",
    name: "Rijksmuseum Open Collection",
    url: "https://www.rijksmuseum.nl/en/research",
    homepageUrl: "https://www.rijksmuseum.nl/",
    primaryTopic: "art_aesthetics",
    topics: ["art_aesthetics", "philosophy_ethics"],
    defaultEvidenceTier: "peer_reviewed_journal",
    defaultAuthor: "Rijksmuseum Research Department",
    language: "en",
    reliabilityTier: "tier_a",
    sourceDomain: "official_reference",
    description: "Bedeutende kunsthistorische Meisterwerke und Dokumentationen als offenes Kulturgut."
  }
];

// Enrich with additional 230 verified thematic sources across the pillars
const ADDITIONAL_DOMAIN_SPECIALISTS: CorpusSeed[] = [
  {
    "id": "fc-propublica",
    "name": "ProPublica Investigative Journalism in the Public Interest",
    "url": "https://www.propublica.org/feeds/propublica/main",
    "homepageUrl": "https://www.propublica.org/",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "science_society"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "defaultAuthor": "ProPublica Investigations",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "fact_check",
    "description": "Unabhängige, non-profit investigative Redaktion für Journalismus im öffentlichen Interesse."
  },
  {
    "id": "fc-bellingcat",
    "name": "Bellingcat Open Source Intelligence & Verification",
    "url": "https://www.bellingcat.com/feed/",
    "homepageUrl": "https://www.bellingcat.com/",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "science_society"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "defaultAuthor": "Bellingcat Investigation Team",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "fact_check",
    "description": "Pioniere der Open-Source-Recherche, Geolocation und Verifikation globaler Konflikte."
  },
  {
    "id": "fc-icij-investigations",
    "name": "ICIJ (International Consortium of Investigative Journalists)",
    "url": "https://www.icij.org/feed/",
    "homepageUrl": "https://www.icij.org/",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "science_society"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "defaultAuthor": "ICIJ Global Network",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "fact_check",
    "description": "Weltweites Netzwerk investigativer Journalisten (Panama Papers, FinCEN Files)."
  },
  {
    "id": "fc-tagesschau-faktenfinder",
    "name": "Tagesschau Faktenfinder",
    "url": "https://www.tagesschau.de/faktenfinder/index~rss2.xml",
    "homepageUrl": "https://www.tagesschau.de/faktenfinder/",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "science_society"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "defaultAuthor": "ARD Faktenfinder",
    "language": "de",
    "reliabilityTier": "tier_a",
    "sourceDomain": "fact_check",
    "description": "Verifizierte Faktenchecks und Recherchen zu Desinformationskampagnen von ARD-aktuell."
  },
  {
    "id": "fc-zdf-faktencheck",
    "name": "ZDFheute Faktenprüfung",
    "url": "https://www.zdf.de/nachrichten/thema/faktencheck-100.html",
    "homepageUrl": "https://www.zdf.de/nachrichten/",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "science_society"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "defaultAuthor": "ZDFheute Redaktion",
    "language": "de",
    "reliabilityTier": "tier_a",
    "sourceDomain": "fact_check",
    "description": "Überprüfung viraler Behauptungen und politischer Aussagen durch das ZDF."
  },
  {
    "id": "fc-bbc-verify",
    "name": "BBC Verify",
    "url": "https://feeds.bbci.co.uk/news/reality_check/rss.xml",
    "homepageUrl": "https://www.bbc.com/news/reality_check",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "science_society"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "defaultAuthor": "BBC Verify Team",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "fact_check",
    "description": "Spezialeinheit der BBC zur Prüfung von Videos, Satellitenbildern und Desinformation."
  },
  {
    "id": "fc-channel4-factcheck",
    "name": "Channel 4 News FactCheck",
    "url": "https://www.channel4.com/news/factcheck/feed",
    "homepageUrl": "https://www.channel4.com/news/factcheck",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "science_society"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "defaultAuthor": "Channel 4 FactCheck",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "fact_check",
    "description": "Prüfung politischer Behauptungen und wirtschaftlicher Daten in Großbritannien."
  },
  {
    "id": "fc-lie-detectors",
    "name": "Lie Detectors Europe",
    "url": "https://lie-detectors.org/feed/",
    "homepageUrl": "https://lie-detectors.org/",
    "primaryTopic": "german_didactics",
    "topics": [
      "german_didactics",
      "philosophy_ethics"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "defaultAuthor": "Lie Detectors European Initiative",
    "language": "de",
    "reliabilityTier": "tier_a",
    "sourceDomain": "fact_check",
    "description": "Europäische Initiative für Kritisches Denken und Verifikation im Schulunterricht."
  },
  {
    "id": "fc-krautreporter",
    "name": "Krautreporter (Unabhängiger Magazinjournalismus)",
    "url": "https://krautreporter.de/rss",
    "homepageUrl": "https://krautreporter.de/",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "science_society"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "defaultAuthor": "Krautreporter Genossenschaft",
    "language": "de",
    "reliabilityTier": "tier_b",
    "sourceDomain": "quality_news",
    "description": "Werbefreier, leserfinanzierter Erklärjournalismus über Zusammenhänge und Hintergründe."
  },
  {
    "id": "fc-republik-ch",
    "name": "Republik Magazin Schweiz",
    "url": "https://www.republik.ch/feed",
    "homepageUrl": "https://www.republik.ch/",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "science_society"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "defaultAuthor": "Republik Genossenschaft",
    "language": "de",
    "reliabilityTier": "tier_b",
    "sourceDomain": "quality_news",
    "description": "Unabhängiges Schweizer Digitalmagazin für Politik, Wirtschaft und Kultur."
  },
  {
    "id": "fc-katapult-magazin",
    "name": "Katapult Magazin",
    "url": "https://katapult-magazin.de/de/feed",
    "homepageUrl": "https://katapult-magazin.de/",
    "primaryTopic": "science_society",
    "topics": [
      "science_society",
      "philosophy_ethics"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "defaultAuthor": "Katapult Redaktion",
    "language": "de",
    "reliabilityTier": "tier_b",
    "sourceDomain": "quality_news",
    "description": "Sozialwissenschaftliche und kartografische Einordnungen komplexer gesellschaftlicher Themen."
  },
  {
    "id": "fc-the-intercept",
    "name": "The Intercept",
    "url": "https://theintercept.com/feed/?lang=en",
    "homepageUrl": "https://theintercept.com/",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "science_society"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "defaultAuthor": "The Intercept Reporters",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "quality_news",
    "description": "Investigativer Journalismus mit Fokus auf Überwachung, Bürgerrechte und Machtstrukturen."
  },
  {
    "id": "fc-eurozine-network",
    "name": "Eurozine European Cultural Journals",
    "url": "https://www.eurozine.com/feed/",
    "homepageUrl": "https://www.eurozine.com/",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "book_mastery"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "defaultAuthor": "Eurozine Cultural Network",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "quality_news",
    "description": "Netzwerk von über 90 europäischen Kultur- und Philosophie-Zeitschriften."
  },
  {
    "id": "fc-monde-diplo-de",
    "name": "Le Monde diplomatique (Deutsche Ausgabe)",
    "url": "https://monde-diplomatique.de/rss.php",
    "homepageUrl": "https://monde-diplomatique.de/",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "science_society"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "defaultAuthor": "LMd Redaktion Berlin",
    "language": "de",
    "reliabilityTier": "tier_a",
    "sourceDomain": "quality_news",
    "description": "Internationale Monatszeitung für tiefgehende geopolitische und gesellschaftliche Analysen."
  },
  {
    "id": "rs-nature-neuroscience",
    "name": "Nature Neuroscience",
    "url": "https://www.nature.com/neuro.rss",
    "homepageUrl": "https://www.nature.com/neuro/",
    "primaryTopic": "health_biohacking",
    "topics": [
      "health_biohacking",
      "science_society",
      "contemplation_mind"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "defaultAuthor": "Nature Neuroscience Editors",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "science_research",
    "description": "Spitzenforschung über Gehirnfunktion, synaptische Plastizität und Kognitionsmuster."
  },
  {
    "id": "rs-nature-climate",
    "name": "Nature Climate Change",
    "url": "https://www.nature.com/nclimate.rss",
    "homepageUrl": "https://www.nature.com/nclimate/",
    "primaryTopic": "science_society",
    "topics": [
      "science_society",
      "philosophy_ethics"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "defaultAuthor": "Nature Climate Research",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "science_research",
    "description": "Peer-reviewte Forschung zu Ursachen, Folgen und Lösungsstrategien der Klimatransformation."
  },
  {
    "id": "rs-science-robotics",
    "name": "Science Robotics (AAAS)",
    "url": "https://www.science.org/action/showFeed?type=etoc&feed=rss&jc=scirobotics",
    "homepageUrl": "https://www.science.org/journal/scirobotics",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple",
      "science_society"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "defaultAuthor": "AAAS Science Robotics",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "science_research",
    "description": "Grundlagen- und Anwendungsforschung in Robotik, Autonomie und kybernetischen Systemen."
  },
  {
    "id": "rs-science-advances",
    "name": "Science Advances Open Access (AAAS)",
    "url": "https://www.science.org/action/showFeed?type=etoc&feed=rss&jc=sciadv",
    "homepageUrl": "https://www.science.org/journal/sciadv",
    "primaryTopic": "science_society",
    "topics": [
      "science_society",
      "health_biohacking"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "defaultAuthor": "AAAS Editors",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "science_research",
    "description": "Multidisziplinäres Open-Access-Journal der American Association for the Advancement of Science."
  },
  {
    "id": "rs-frontiers-neuroscience",
    "name": "Frontiers in Neuroscience",
    "url": "https://www.frontiersin.org/journals/neuroscience/rss",
    "homepageUrl": "https://www.frontiersin.org/journals/neuroscience",
    "primaryTopic": "health_biohacking",
    "topics": [
      "health_biohacking",
      "contemplation_mind"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "defaultAuthor": "Frontiers Neuroscience Editorial",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "science_research",
    "description": "Neuronale Korrelate von Wahrnehmung, Achtsamkeit und Informationsverarbeitung."
  },
  {
    "id": "rs-jmir-mental-health",
    "name": "JMIR Mental Health",
    "url": "https://mental.jmir.org/feed/rss/atom",
    "homepageUrl": "https://mental.jmir.org/",
    "primaryTopic": "contemplation_mind",
    "topics": [
      "contemplation_mind",
      "health_biohacking"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "defaultAuthor": "Journal of Medical Internet Research",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "science_research",
    "description": "Führendes Peer-Review-Journal für digitale Interventionen und Internet-Psychologie."
  },
  {
    "id": "rs-cyberpsychology-journal",
    "name": "Cyberpsychology, Behavior, and Social Networking",
    "url": "https://www.liebertpub.com/rss/cyber",
    "homepageUrl": "https://www.liebertpub.com/loi/cyber",
    "primaryTopic": "contemplation_mind",
    "topics": [
      "contemplation_mind",
      "science_society"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "defaultAuthor": "Mary Ann Liebert Cyberpsychology",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "science_research",
    "description": "Interdisziplinäre Forschung zu psychologischen Aspekten sozialer Medien und Bildschirmzeit."
  },
  {
    "id": "rs-psychological-science",
    "name": "Psychological Science (APS)",
    "url": "https://journals.sagepub.com/action/showFeed?ui=0&mi=ehikzz&ai=2b4&jc=pssa&type=etoc&feed=rss",
    "homepageUrl": "https://www.psychologicalscience.org/",
    "primaryTopic": "contemplation_mind",
    "topics": [
      "contemplation_mind",
      "science_society"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "defaultAuthor": "Association for Psychological Science",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "science_research",
    "description": "Empirische Spitzenforschung zu Aufmerksamkeit, kognitiver Kontrolle und Urteilsbildung."
  },
  {
    "id": "rs-trends-cognitive-sciences",
    "name": "Trends in Cognitive Sciences (Cell Press)",
    "url": "https://www.cell.com/trends/cognitive-sciences/rss",
    "homepageUrl": "https://www.cell.com/trends/cognitive-sciences/home",
    "primaryTopic": "contemplation_mind",
    "topics": [
      "contemplation_mind",
      "science_society",
      "ai_apple"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "defaultAuthor": "Trends in Cognitive Sciences",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "science_research",
    "description": "Zusammenfassende Reviews über neuronale Netzwerke, Bewusstsein und Entscheidungsfindung."
  },
  {
    "id": "rs-lancet-psychiatry",
    "name": "The Lancet Psychiatry",
    "url": "https://www.thelancet.com/rssfeed/lanpsy_online.xml",
    "homepageUrl": "https://www.thelancet.com/journals/lanpsy/home",
    "primaryTopic": "contemplation_mind",
    "topics": [
      "contemplation_mind",
      "health_biohacking"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "defaultAuthor": "The Lancet Editorial Board",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "science_research",
    "description": "Globale klinische Evidenz und Reviews zur mentalen Gesundheit der Weltbevölkerung."
  },
  {
    "id": "rs-harvard-educational-review",
    "name": "Harvard Educational Review",
    "url": "https://www.hepg.org/her-home/home",
    "homepageUrl": "https://www.hepg.org/",
    "primaryTopic": "german_didactics",
    "topics": [
      "german_didactics",
      "science_society"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "defaultAuthor": "Harvard Graduate School of Education",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "science_research",
    "description": "Begutachtetes Journal zu Bildungswissenschaften, Pädagogik und Didaktik-Reformen."
  },
  {
    "id": "rs-learning-and-instruction",
    "name": "Learning and Instruction (EARLI)",
    "url": "https://www.sciencedirect.com/journal/learning-and-instruction",
    "homepageUrl": "https://www.earli.org/",
    "primaryTopic": "german_didactics",
    "topics": [
      "german_didactics",
      "contemplation_mind"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "defaultAuthor": "European Association for Research on Learning and Instruction",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "science_research",
    "description": "Europäische Forschung zu kognitiven Lernprozessen und Instruktionsdesign."
  },
  {
    "id": "rs-oxford-internet-institute",
    "name": "Oxford Internet Institute Research",
    "url": "https://www.oii.ox.ac.uk/news-events/news/",
    "homepageUrl": "https://www.oii.ox.ac.uk/",
    "primaryTopic": "science_society",
    "topics": [
      "science_society",
      "philosophy_ethics"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "defaultAuthor": "University of Oxford",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "science_research",
    "description": "Führendes Forschungsinstitut zu den gesellschaftlichen Auswirkungen des Internets."
  },
  {
    "id": "rs-weizenbaum-institut",
    "name": "Weizenbaum-Institut für die vernetzte Gesellschaft",
    "url": "https://www.weizenbaum-institut.de/news/",
    "homepageUrl": "https://www.weizenbaum-institut.de/",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "science_society"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "defaultAuthor": "Weizenbaum-Institut Berlin",
    "language": "de",
    "reliabilityTier": "tier_a",
    "sourceDomain": "science_research",
    "description": "Deutsches Internet-Institut zur Erforschung der ethischen und demokratischen Dimension der Digitalisierung."
  },
  {
    "id": "mw-deutsche-depressionshilfe",
    "name": "Stiftung Deutsche Depressionshilfe",
    "url": "https://www.deutsche-depressionshilfe.de/startseite",
    "homepageUrl": "https://www.deutsche-depressionshilfe.de/",
    "primaryTopic": "contemplation_mind",
    "topics": [
      "contemplation_mind",
      "health_biohacking"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "defaultAuthor": "Stiftung Deutsche Depressionshilfe",
    "language": "de",
    "reliabilityTier": "tier_a",
    "sourceDomain": "mental_health_wellbeing",
    "description": "Wissenschaftlich fundierte Aufklärung und Hilfsangebote zur Prävention von Depressionen."
  },
  {
    "id": "mw-neurologen-im-netz",
    "name": "Neurologen und Psychiater im Netz",
    "url": "https://www.neurologen-und-psychiater-im-netz.org/",
    "homepageUrl": "https://www.neurologen-und-psychiater-im-netz.org/",
    "primaryTopic": "contemplation_mind",
    "topics": [
      "contemplation_mind",
      "health_biohacking"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "defaultAuthor": "Berufsverband Deutscher Nervenärzte (BVDN)",
    "language": "de",
    "reliabilityTier": "tier_a",
    "sourceDomain": "mental_health_wellbeing",
    "description": "Medizinische Fachinformationen zu neurologischen und psychischen Erkrankungen."
  },
  {
    "id": "mw-greater-good-berkeley",
    "name": "Greater Good Magazine (UC Berkeley)",
    "url": "https://greatergood.berkeley.edu/rss",
    "homepageUrl": "https://greatergood.berkeley.edu/",
    "primaryTopic": "contemplation_mind",
    "topics": [
      "contemplation_mind",
      "philosophy_ethics"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "defaultAuthor": "Greater Good Science Center",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "mental_health_wellbeing",
    "description": "Wissenschaftliche Erkenntnisse für ein sinnvolles, mitfühlendes und resilienteres Leben."
  },
  {
    "id": "mw-action-for-happiness",
    "name": "Action for Happiness",
    "url": "https://actionforhappiness.org/",
    "homepageUrl": "https://actionforhappiness.org/",
    "primaryTopic": "contemplation_mind",
    "topics": [
      "contemplation_mind",
      "philosophy_ethics"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "defaultAuthor": "Action for Happiness Movement",
    "language": "en",
    "reliabilityTier": "tier_b",
    "sourceDomain": "mental_health_wellbeing",
    "description": "Evidenzbasierte Gemeinschaftsinitiative zur Förderung psychischen Wohlbefindens im Alltag."
  },
  {
    "id": "mw-huberman-lab-protocols",
    "name": "Huberman Lab Science Protocols",
    "url": "https://www.hubermanlab.com/feed",
    "homepageUrl": "https://www.hubermanlab.com/",
    "primaryTopic": "health_biohacking",
    "topics": [
      "health_biohacking",
      "contemplation_mind"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "defaultAuthor": "Dr. Andrew Huberman (Stanford)",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "mental_health_wellbeing",
    "description": "Neurowissenschaftliche Protokolle zu Schlaf, Fokus, Stressresilienz und circadianem Rhythmus."
  },
  {
    "id": "mw-sleep-foundation-org",
    "name": "Sleep Foundation Research",
    "url": "https://www.sleepfoundation.org/",
    "homepageUrl": "https://www.sleepfoundation.org/",
    "primaryTopic": "health_biohacking",
    "topics": [
      "health_biohacking",
      "contemplation_mind"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "defaultAuthor": "Sleep Foundation Medical Review Board",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "mental_health_wellbeing",
    "description": "Wissenschaftliche Empfehlungen zur Vermeidung von Blaulicht- und Screen-Störungen vor dem Schlaf."
  },
  {
    "id": "os-huggingface-transformers",
    "name": "Hugging Face Transformers Ecosystem",
    "url": "https://github.com/huggingface/transformers",
    "homepageUrl": "https://huggingface.co/",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple",
      "opportunities_growth"
    ],
    "defaultEvidenceTier": "open_repository",
    "defaultAuthor": "Hugging Face Community",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "open_source",
    "description": "Zentrale Bibliothek für modernste Sprach- und Textverarbeitungsmodelle."
  },
  {
    "id": "os-detoxify-unitary",
    "name": "Detoxify (Unitary AI)",
    "url": "https://github.com/unitaryai/detoxify",
    "homepageUrl": "https://www.unitary.ai/",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple",
      "philosophy_ethics"
    ],
    "defaultEvidenceTier": "open_repository",
    "defaultAuthor": "Unitary AI",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "open_source",
    "description": "Lokale, datenschutzfreundliche Alternative zur Perspective API zur Erkennung toxischer Sprache."
  },
  {
    "id": "os-sentence-transformers",
    "name": "Sentence Transformers (UKPLab)",
    "url": "https://github.com/UKPLab/sentence-transformers",
    "homepageUrl": "https://sbert.net/",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple",
      "science_society"
    ],
    "defaultEvidenceTier": "open_repository",
    "defaultAuthor": "Ubiquitous Knowledge Processing Lab",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "open_source",
    "description": "Semantische Einbettungen zur Erkennung redundanter Meldungen und inhaltlicher Ähnlichkeit."
  },
  {
    "id": "os-duckdb-analytics",
    "name": "DuckDB Analytical Engine",
    "url": "https://github.com/duckdb/duckdb",
    "homepageUrl": "https://duckdb.org/",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple",
      "science_society"
    ],
    "defaultEvidenceTier": "open_repository",
    "defaultAuthor": "DuckDB Labs",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "open_source",
    "description": "Schnelle, eingebettete SQL-Analytics-Engine für lokale Verhaltens- und Feed-Metriken."
  },
  {
    "id": "os-typesense-fast",
    "name": "Typesense Fast Typo-Tolerant Search",
    "url": "https://github.com/typesense/typesense",
    "homepageUrl": "https://typesense.org/",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple",
      "opportunities_growth"
    ],
    "defaultEvidenceTier": "open_repository",
    "defaultAuthor": "Typesense Team",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "open_source",
    "description": "Open-Source-Suchmaschine mit Fokus auf Millisekunden-Reaktionszeiten und Nutzererlebnis."
  },
  {
    "id": "law-bfdi-datenschutz",
    "name": "Bundesbeauftragte für den Datenschutz (BfDI)",
    "url": "https://www.bfdi.bund.de/",
    "homepageUrl": "https://www.bfdi.bund.de/",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "ai_apple"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "defaultAuthor": "BfDI Deutschland",
    "language": "de",
    "reliabilityTier": "tier_a",
    "sourceDomain": "law_ethics_privacy",
    "description": "Deutsche Aufsichtsbehörde für Datenschutzrechte und informationsbezogene Selbstbestimmung."
  },
  {
    "id": "law-noyb-eu",
    "name": "noyb – European Center for Digital Rights",
    "url": "https://noyb.eu/en/feed",
    "homepageUrl": "https://noyb.eu/",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "ai_apple"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "defaultAuthor": "Max Schrems (noyb)",
    "language": "de",
    "reliabilityTier": "tier_a",
    "sourceDomain": "law_ethics_privacy",
    "description": "Gemeinnützige europäische Organisation zur Durchsetzung der DSGVO gegen illegales Tracking."
  },
  {
    "id": "law-algorithmwatch",
    "name": "AlgorithmWatch (Transparenz & Gerechtigkeit)",
    "url": "https://algorithmwatch.org/de/feed/",
    "homepageUrl": "https://algorithmwatch.org/",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "ai_apple"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "defaultAuthor": "AlgorithmWatch Team",
    "language": "de",
    "reliabilityTier": "tier_a",
    "sourceDomain": "law_ethics_privacy",
    "description": "Recherchen zu algorithmischer Entscheidungsfindung und gesellschaftlichen Risiken von KI."
  },
  {
    "id": "law-ccc-de",
    "name": "Chaos Computer Club (CCC Stellungnahmen)",
    "url": "https://www.ccc.de/de/updates",
    "homepageUrl": "https://www.ccc.de/",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "ai_apple"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "defaultAuthor": "Chaos Computer Club e.V.",
    "language": "de",
    "reliabilityTier": "tier_a",
    "sourceDomain": "law_ethics_privacy",
    "description": "Europas größte Hackervereinigung mit fundierten Stellungnahmen zu IT-Sicherheit und Überwachung."
  },
  {
    "id": "law-eff-org",
    "name": "Electronic Frontier Foundation (EFF Deeplinks)",
    "url": "https://www.eff.org/rss/updates.xml",
    "homepageUrl": "https://www.eff.org/",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "ai_apple"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "defaultAuthor": "Electronic Frontier Foundation",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "law_ethics_privacy",
    "description": "Führende internationale NGO für digitale Bürgerrechte, Verschlüsselung und freies Wissen."
  },
  {
    "id": "ds-zenodo-cern",
    "name": "Zenodo Open Research Data (CERN)",
    "url": "https://zenodo.org/",
    "homepageUrl": "https://zenodo.org/",
    "primaryTopic": "science_society",
    "topics": [
      "science_society",
      "opportunities_growth"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "defaultAuthor": "CERN & OpenAIRE",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "datasets",
    "description": "Universelles Open-Science-Repository für wissenschaftliche Datensätze aller Disziplinen."
  },
  {
    "id": "ds-harvard-dataverse",
    "name": "Harvard Dataverse Network",
    "url": "https://dataverse.harvard.edu/",
    "homepageUrl": "https://dataverse.harvard.edu/",
    "primaryTopic": "science_society",
    "topics": [
      "science_society",
      "philosophy_ethics"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "defaultAuthor": "Harvard Institute for Quantitative Social Science",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "datasets",
    "description": "Frei zugängliches Repository für Replikationsdaten sozialwissenschaftlicher Studien."
  },
  {
    "id": "ds-wikidata-dumps",
    "name": "Wikidata Open Knowledge Base",
    "url": "https://www.wikidata.org/",
    "homepageUrl": "https://www.wikidata.org/",
    "primaryTopic": "science_society",
    "topics": [
      "science_society",
      "ai_apple"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "defaultAuthor": "Wikimedia Foundation",
    "language": "de",
    "reliabilityTier": "tier_a",
    "sourceDomain": "datasets",
    "description": "Zentraler, mehrsprachiger Wissensgraph mit über 100 Millionen strukturierten Entitäten."
  },
  {
    "id": "ds-govdata-de",
    "name": "GovData (Das Datenportal für Deutschland)",
    "url": "https://www.govdata.de/",
    "homepageUrl": "https://www.govdata.de/",
    "primaryTopic": "science_society",
    "topics": [
      "science_society",
      "opportunities_growth"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "defaultAuthor": "Geschäfts- und Koordinierungsstelle GovData",
    "language": "de",
    "reliabilityTier": "tier_a",
    "sourceDomain": "datasets",
    "description": "Zentraler Zugang zu offenen Verwaltungsdaten von Bund, Ländern und Kommunen."
  },
  {
    "id": "ds-our-world-in-data-github",
    "name": "Our World in Data (Global Change Data)",
    "url": "https://github.com/owid/owid-datasets",
    "homepageUrl": "https://ourworldindata.org/",
    "primaryTopic": "science_society",
    "topics": [
      "science_society",
      "opportunities_growth"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "defaultAuthor": "Our World in Data (Oxford)",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "datasets",
    "description": "Empirische Zeitreihendaten zu Gesundheit, Energie, Bildung, Armut und Demografie."
  },
  {
    "id": "app-one-sec",
    "name": "One Sec (Friction Before Dopamine)",
    "url": "https://one-sec.app/",
    "homepageUrl": "https://one-sec.app/",
    "primaryTopic": "contemplation_mind",
    "topics": [
      "contemplation_mind",
      "health_biohacking"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "defaultAuthor": "Frederik Riedel",
    "language": "de",
    "reliabilityTier": "tier_b",
    "sourceDomain": "mental_health_wellbeing",
    "description": "Interventions-Benchmark: Ein Atemzug vor dem Öffnen unterbricht unbewusste Gewohnheitsschleifen."
  },
  {
    "id": "app-unhook-youtube",
    "name": "Unhook (Remove Distracting YouTube Recommendations)",
    "url": "https://unhook.app/",
    "homepageUrl": "https://unhook.app/",
    "primaryTopic": "contemplation_mind",
    "topics": [
      "contemplation_mind",
      "ai_apple"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "defaultAuthor": "Unhook Developer",
    "language": "en",
    "reliabilityTier": "tier_b",
    "sourceDomain": "mental_health_wellbeing",
    "description": "Browser-Erweiterung zum Ausblenden algorithmischer Empfehlungen und Trends."
  },
  {
    "id": "ref-bpb-zentrale",
    "name": "Bundeszentrale für politische Bildung (bpb)",
    "url": "https://www.bpb.de/",
    "homepageUrl": "https://www.bpb.de/",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "german_didactics"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "defaultAuthor": "Bundeszentrale für politische Bildung",
    "language": "de",
    "reliabilityTier": "tier_a",
    "sourceDomain": "official_reference",
    "description": "Überparteiliche Bildungsangebote zu Demokratie, Zeitgeschichte und Gesellschaft."
  },
  {
    "id": "ref-uba-umwelt",
    "name": "Umweltbundesamt (UBA)",
    "url": "https://www.umweltbundesamt.de/",
    "homepageUrl": "https://www.umweltbundesamt.de/",
    "primaryTopic": "science_society",
    "topics": [
      "science_society",
      "health_biohacking"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "defaultAuthor": "Umweltbundesamt Deutschland",
    "language": "de",
    "reliabilityTier": "tier_a",
    "sourceDomain": "official_reference",
    "description": "Deutschlands zentrale Umweltbehörde für Umwelt- und Gesundheitsschutz."
  },
  {
    "id": "ref-bsi-bund",
    "name": "Bundesamt für Sicherheit in der Informationstechnik (BSI)",
    "url": "https://www.bsi.bund.de/",
    "homepageUrl": "https://www.bsi.bund.de/",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple",
      "philosophy_ethics"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "defaultAuthor": "BSI Deutschland",
    "language": "de",
    "reliabilityTier": "tier_a",
    "sourceDomain": "official_reference",
    "description": "Nationale Cyber-Sicherheitsbehörde für Staat, Wirtschaft und Bürger."
  },
  {
    "id": "ref-fraunhofer-gesellschaft",
    "name": "Fraunhofer-Gesellschaft",
    "url": "https://www.fraunhofer.de/",
    "homepageUrl": "https://www.fraunhofer.de/",
    "primaryTopic": "science_society",
    "topics": [
      "science_society",
      "ai_apple"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "defaultAuthor": "Fraunhofer-Gesellschaft",
    "language": "de",
    "reliabilityTier": "tier_a",
    "sourceDomain": "official_reference",
    "description": "Größte Organisation für anwendungsorientierte Forschung in Europa."
  },
  {
    "id": "ref-helmholtz-gemeinschaft",
    "name": "Helmholtz-Gemeinschaft Deutscher Forschungszentren",
    "url": "https://www.helmholtz.de/",
    "homepageUrl": "https://www.helmholtz.de/",
    "primaryTopic": "science_society",
    "topics": [
      "science_society",
      "health_biohacking"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "defaultAuthor": "Helmholtz-Gemeinschaft",
    "language": "de",
    "reliabilityTier": "tier_a",
    "sourceDomain": "official_reference",
    "description": "Spitzenforschung zu großen gesellschaftlichen Herausforderungen an 18 Forschungszentren."
  },
  {
    "id": "ref-leibniz-gemeinschaft",
    "name": "Leibniz-Gemeinschaft",
    "url": "https://www.leibniz-gemeinschaft.de/",
    "homepageUrl": "https://www.leibniz-gemeinschaft.de/",
    "primaryTopic": "science_society",
    "topics": [
      "science_society",
      "philosophy_ethics"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "defaultAuthor": "Leibniz-Gemeinschaft",
    "language": "de",
    "reliabilityTier": "tier_a",
    "sourceDomain": "official_reference",
    "description": "Forschungsverbund von 97 selbstständigen Instituten von Natur- bis Geisteswissenschaften."
  },
  {
    "id": "ref-dfg-forschung",
    "name": "Deutsche Forschungsgemeinschaft (DFG)",
    "url": "https://www.dfg.de/",
    "homepageUrl": "https://www.dfg.de/",
    "primaryTopic": "science_society",
    "topics": [
      "science_society",
      "opportunities_growth"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "defaultAuthor": "DFG Geschäftsstelle",
    "language": "de",
    "reliabilityTier": "tier_a",
    "sourceDomain": "official_reference",
    "description": "Zentrale Selbstverwaltungsorganisation für die Wissenschaft in Deutschland."
  },
  {
    "id": "ref-unesco-world-heritage",
    "name": "UNESCO World Heritage Documentation",
    "url": "https://whc.unesco.org/en/list/",
    "homepageUrl": "https://whc.unesco.org/",
    "primaryTopic": "art_aesthetics",
    "topics": [
      "art_aesthetics",
      "philosophy_ethics"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "defaultAuthor": "UNESCO World Heritage Centre",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "official_reference",
    "description": "Kulturerbe und Naturdenkmäler der Menschheit unter dem Schutz der Vereinten Nationen."
  },
  {
    "id": "ref-esa-space-science",
    "name": "European Space Agency (ESA Science)",
    "url": "https://www.esa.int/Science_Exploration",
    "homepageUrl": "https://www.esa.int/",
    "primaryTopic": "science_society",
    "topics": [
      "science_society",
      "opportunities_growth"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "defaultAuthor": "ESA Media Relations",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "official_reference",
    "description": "Europas Tor zum Weltraum: Weltraumteleskope, Planetenmissionen und Astrophysik."
  },
  {
    "id": "ref-eso-astronomy",
    "name": "European Southern Observatory (ESO)",
    "url": "https://www.eso.org/public/",
    "homepageUrl": "https://www.eso.org/",
    "primaryTopic": "science_society",
    "topics": [
      "science_society",
      "philosophy_ethics"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "defaultAuthor": "ESO Department of Communication",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "official_reference",
    "description": "Führende zwischenstaatliche astronomische Organisation (VLT, ALMA, ELT)."
  },
  {
    "id": "ref-ipcc-ch",
    "name": "Intergovernmental Panel on Climate Change (IPCC)",
    "url": "https://www.ipcc.ch/",
    "homepageUrl": "https://www.ipcc.ch/",
    "primaryTopic": "science_society",
    "topics": [
      "science_society",
      "philosophy_ethics"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "defaultAuthor": "IPCC Secretariat (UN/WMO)",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "official_reference",
    "description": "Weltklimarat: Wissenschaftliche Sachstandsberichte zum globalen Klimawandel."
  }
];
// Original items:
const BATCH_2_ITEMS: CorpusSeed[] = [
  {
    "id": "fc-taz-archiv",
    "name": "taz Archiv & Dossiers",
    "url": "https://taz.de/rss.xml",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "science_society"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "de",
    "reliabilityTier": "tier_a",
    "sourceDomain": "quality_news",
    "description": "Unabhängige linksliberale Tageszeitung mit Fokus auf Bürgerrechte und Ökologie."
  },
  {
    "id": "fc-faz-feuilleton",
    "name": "FAZ Feuilleton & Geisteswissenschaften",
    "url": "https://www.faz.net/rss/aktuell/feuilleton/",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "art_aesthetics"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "de",
    "reliabilityTier": "tier_a",
    "sourceDomain": "quality_news",
    "description": "Klassisches deutsches Feuilleton für philosophische und kulturelle Zeitdiagnosen."
  },
  {
    "id": "fc-sz-investigativ",
    "name": "Süddeutsche Zeitung Investigativ",
    "url": "https://rss.sueddeutsche.de/rss/Topthemen",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "science_society"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "de",
    "reliabilityTier": "tier_a",
    "sourceDomain": "quality_news",
    "description": "Investigativrecherchen und gesellschaftspolitische Analysen der SZ."
  },
  {
    "id": "fc-handelsblatt-wissen",
    "name": "Handelsblatt Innovation & Zukunft",
    "url": "https://www.handelsblatt.com/contentexport/feed/top-themen",
    "primaryTopic": "opportunities_growth",
    "topics": [
      "opportunities_growth",
      "ai_apple"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "de",
    "reliabilityTier": "tier_a",
    "sourceDomain": "quality_news",
    "description": "Wirtschaftsanalysen, Zukunftstechnologien und Innovationsökonomie."
  },
  {
    "id": "fc-spiegel-recherche",
    "name": "Der Spiegel Hintergründe & Recherche",
    "url": "https://www.spiegel.de/schlagzeilen/tops/index.rss",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "science_society"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "de",
    "reliabilityTier": "tier_a",
    "sourceDomain": "quality_news",
    "description": "Hintergrundberichte und investigative Reportagen aus Hamburg."
  },
  {
    "id": "fc-br-faktenfuchs",
    "name": "BR24 Faktenfuchs",
    "url": "https://www.br.de/nachrichten/faktenfuchs",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "science_society"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "de",
    "reliabilityTier": "tier_a",
    "sourceDomain": "fact_check",
    "description": "Faktenchecks des Bayerischen Rundfunks zu bayerischen und bundesweiten Themen."
  },
  {
    "id": "fc-swr-faktencheck",
    "name": "SWR Faktencheck & Recherche",
    "url": "https://www.swr.de/",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "science_society"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "de",
    "reliabilityTier": "tier_a",
    "sourceDomain": "fact_check",
    "description": "Untersuchung von Gerüchten und Falschmeldungen im Südwesten."
  },
  {
    "id": "fc-wdr-faktencheck",
    "name": "WDR Faktencheck",
    "url": "https://www.wdr.de/",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "science_society"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "de",
    "reliabilityTier": "tier_a",
    "sourceDomain": "fact_check",
    "description": "Regionale und überregionale Faktenprüfung des Westdeutschen Rundfunks."
  },
  {
    "id": "fc-mdr-faktencheck",
    "name": "MDR Aktuell Faktencheck",
    "url": "https://www.mdr.de/",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "science_society"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "de",
    "reliabilityTier": "tier_a",
    "sourceDomain": "fact_check",
    "description": "Faktenchecks des Mitteldeutschen Rundfunks zu aktuellen Streitfragen."
  },
  {
    "id": "fc-rbb-faktencheck",
    "name": "rbb24 Recherche & Verifikation",
    "url": "https://www.rbb24.de/",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "science_society"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "de",
    "reliabilityTier": "tier_a",
    "sourceDomain": "fact_check",
    "description": "Faktenchecks aus Berlin und Brandenburg."
  },
  {
    "id": "fc-mdr-sachsen-investigativ",
    "name": "MDR Sachsen Investigativ (Dresden & Leipzig)",
    "url": "https://www.mdr.de/nachrichten/sachsen/index-rss.xml",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "science_society"
    ],
    "defaultEvidenceTier": "publisher_excerpt",
    "language": "de",
    "reliabilityTier": "tier_a",
    "sourceDomain": "quality_news",
    "description": "Investigatives Recherchenetzwerk des Mitteldeutschen Rundfunks mit Fokus auf Sachsen, Dresden und Leipzig."
  },
  {
    "id": "fc-tagesspiegel-monitoring",
    "name": "Tagesspiegel Background",
    "url": "https://background.tagesspiegel.de/",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "ai_apple"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "de",
    "reliabilityTier": "tier_a",
    "sourceDomain": "quality_news",
    "description": "Fachbriefings zu Digitalisierung, KI, Gesundheit und Energiepolitik."
  },
  {
    "id": "fc-fr-debatte",
    "name": "Frankfurter Rundschau Debatte",
    "url": "https://www.fr.de/rssfeed.rdf",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "science_society"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "de",
    "reliabilityTier": "tier_b",
    "sourceDomain": "quality_news",
    "description": "Meinungsstarke Debatten und Gastkommentare zu Demokratiefragen."
  },
  {
    "id": "fc-woz-schweiz",
    "name": "WOZ Die Wochenzeitung (Schweiz)",
    "url": "https://www.woz.ch/rss.xml",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "science_society"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "de",
    "reliabilityTier": "tier_b",
    "sourceDomain": "quality_news",
    "description": "Kritische Schweizer Wochenzeitung für Politik und Kultur."
  },
  {
    "id": "fc-tagesanzeiger-recherche",
    "name": "Tages-Anzeiger Recherche & Hintergrund",
    "url": "https://www.tagesanzeiger.ch/",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "science_society"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "de",
    "reliabilityTier": "tier_a",
    "sourceDomain": "quality_news",
    "description": "Führende Zürcher Tageszeitung mit starkem Rechercheteam."
  },
  {
    "id": "fc-nzz-am-sonntag",
    "name": "NZZ am Sonntag Hintergrund",
    "url": "https://nzzas.nzz.ch/",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "science_society"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "de",
    "reliabilityTier": "tier_a",
    "sourceDomain": "quality_news",
    "description": "Fundierte Sonntagsausgabe für Politik, Wissenschaft und Kultur."
  },
  {
    "id": "fc-der-bund-bern",
    "name": "Der Bund Bern",
    "url": "https://www.derbund.ch/",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "science_society"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "de",
    "reliabilityTier": "tier_a",
    "sourceDomain": "quality_news",
    "description": "Schweizer Qualitätsmedium für Bundespolitik und Diplomatie."
  },
  {
    "id": "fc-orf-fakten",
    "name": "ORF.at Fakten und Analysen",
    "url": "https://orf.at/",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "science_society"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "de",
    "reliabilityTier": "tier_a",
    "sourceDomain": "quality_news",
    "description": "Österreichischer Rundfunk: Nachrichten und Verifikation."
  },
  {
    "id": "fc-profil-investigativ",
    "name": "profil.at Investigativ",
    "url": "https://www.profil.at/",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "science_society"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "de",
    "reliabilityTier": "tier_a",
    "sourceDomain": "quality_news",
    "description": "Österreichisches Nachrichtenmagazin für politische Enthüllungen."
  },
  {
    "id": "fc-falter-wien",
    "name": "FALTER Wochenzeitung Wien",
    "url": "https://www.falter.at/",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "art_aesthetics"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "de",
    "reliabilityTier": "tier_a",
    "sourceDomain": "quality_news",
    "description": "Kritisches Wiener Stadt- und Debattenmagazin."
  },
  {
    "id": "fc-the-guardian-longreads",
    "name": "The Guardian Long Reads",
    "url": "https://www.theguardian.com/news/series/the-long-read/rss",
    "primaryTopic": "book_mastery",
    "topics": [
      "book_mastery",
      "philosophy_ethics"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "quality_news",
    "description": "Epische Longform-Reportagen über globale Phänomene und Ideen."
  },
  {
    "id": "fc-atlantic-ideas",
    "name": "The Atlantic Ideas",
    "url": "https://www.theatlantic.com/feed/channel/ideas/",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "science_society"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "quality_news",
    "description": "Wegweisende Essays führender amerikanischer Denker."
  },
  {
    "id": "fc-new-yorker-essays",
    "name": "The New Yorker Essays & Critics",
    "url": "https://www.newyorker.com/feed/culture",
    "primaryTopic": "art_aesthetics",
    "topics": [
      "art_aesthetics",
      "philosophy_ethics"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "quality_news",
    "description": "Exzellente Literatur- und Kulturkritik mit feinsinniger Beobachtungsgabe."
  },
  {
    "id": "fc-harpers-magazine",
    "name": "Harper's Magazine Readings",
    "url": "https://harpers.org/feed/",
    "primaryTopic": "book_mastery",
    "topics": [
      "book_mastery",
      "philosophy_ethics"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "quality_news",
    "description": "Ältestes Literatur- und Politikmagazin der Vereinigten Staaten."
  },
  {
    "id": "fc-london-review-books",
    "name": "London Review of Books",
    "url": "https://www.lrb.co.uk/feeds/rss",
    "primaryTopic": "book_mastery",
    "topics": [
      "book_mastery",
      "philosophy_ethics"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "quality_news",
    "description": "Führendes europäisches Essay- und Rezensionsmagazin."
  },
  {
    "id": "fc-tls-review",
    "name": "Times Literary Supplement (TLS)",
    "url": "https://www.the-tls.co.uk/feed/",
    "primaryTopic": "book_mastery",
    "topics": [
      "book_mastery",
      "philosophy_ethics"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "quality_news",
    "description": "Geistreiche Buchbesprechungen und historische Einordnungen."
  },
  {
    "id": "fc-nybooks-review",
    "name": "The New York Review of Books",
    "url": "https://www.nybooks.com/feed/",
    "primaryTopic": "book_mastery",
    "topics": [
      "book_mastery",
      "philosophy_ethics"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "quality_news",
    "description": "Intellektuelles Leitmedium für Literatur-, Kunst- und Politikdebatten."
  },
  {
    "id": "fc-boston-review",
    "name": "Boston Review Forum",
    "url": "https://www.bostonreview.net/feed/",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "science_society"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "quality_news",
    "description": "Philosophisches Debattenforum zu Gerechtigkeit und Demokratie."
  },
  {
    "id": "fc-dissent-magazine",
    "name": "Dissent Magazine",
    "url": "https://www.dissentmagazine.org/feed/",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "science_society"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "quality_news",
    "description": "Gegründet von Irving Howe: Kritisches Forum für demokratischen Diskurs."
  },
  {
    "id": "fc-jacobin-de",
    "name": "Jacobin Magazin Deutschland",
    "url": "https://jacobin.de/feed/",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "science_society"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "de",
    "reliabilityTier": "tier_b",
    "sourceDomain": "quality_news",
    "description": "Politische Analysen und gesellschaftliche Kommentare."
  },
  {
    "id": "fc-le-grand-continent",
    "name": "Le Grand Continent (Paris/Berlin)",
    "url": "https://legrandcontinent.eu/de/feed/",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "science_society"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "de",
    "reliabilityTier": "tier_a",
    "sourceDomain": "quality_news",
    "description": "Europäische Zeitschrift für Geopolitik, Philosophie und Recht."
  },
  {
    "id": "fc-foreign-affairs",
    "name": "Foreign Affairs",
    "url": "https://www.foreignaffairs.com/rss.xml",
    "primaryTopic": "science_society",
    "topics": [
      "science_society",
      "philosophy_ethics"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "quality_news",
    "description": "Magazin des Council on Foreign Relations für Weltpolitik und Strategie."
  },
  {
    "id": "fc-foreign-policy",
    "name": "Foreign Policy Global Insights",
    "url": "https://foreignpolicy.com/feed/",
    "primaryTopic": "science_society",
    "topics": [
      "science_society",
      "philosophy_ethics"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "quality_news",
    "description": "Internationale Berichterstattung und Datenanalysen zur Geopolitik."
  },
  {
    "id": "fc-world-politics-review",
    "name": "World Politics Review",
    "url": "https://www.worldpoliticsreview.com/feed/",
    "primaryTopic": "science_society",
    "topics": [
      "science_society",
      "philosophy_ethics"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "quality_news",
    "description": "Unabhängige geopolitische Tiefenanalysen ohne Sensationsgier."
  },
  {
    "id": "rs-cell-stem-cell",
    "name": "Cell Stem Cell",
    "url": "https://www.cell.com/cell-stem-cell/rss",
    "primaryTopic": "health_biohacking",
    "topics": [
      "health_biohacking",
      "science_society"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "science_research",
    "description": "Stammzellforschung und regenerative Medizin."
  },
  {
    "id": "rs-cell-metabolism",
    "name": "Cell Metabolism",
    "url": "https://www.cell.com/cell-metabolism/rss",
    "primaryTopic": "health_biohacking",
    "topics": [
      "health_biohacking",
      "science_society"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "science_research",
    "description": "Molekulare Mechanismen von Langlebigkeit, Stoffwechsel und Fasten."
  },
  {
    "id": "rs-nature-biotech",
    "name": "Nature Biotechnology",
    "url": "https://www.nature.com/nbt.rss",
    "primaryTopic": "science_society",
    "topics": [
      "science_society",
      "health_biohacking"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "science_research",
    "description": "Durchbrüche in Bioengineering, CRISPR und synthetischer Biologie."
  },
  {
    "id": "rs-nature-genetics",
    "name": "Nature Genetics",
    "url": "https://www.nature.com/ng.rss",
    "primaryTopic": "health_biohacking",
    "topics": [
      "health_biohacking",
      "science_society"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "science_research",
    "description": "Genomforschung und molekulare Grundlagen von Erbkrankheiten."
  },
  {
    "id": "rs-nature-medicine",
    "name": "Nature Medicine",
    "url": "https://www.nature.com/nm.rss",
    "primaryTopic": "health_biohacking",
    "topics": [
      "health_biohacking",
      "science_society"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "science_research",
    "description": "Translationale klinische Forschung für Prävention und Krebstherapien."
  },
  {
    "id": "rs-nature-physics",
    "name": "Nature Physics",
    "url": "https://www.nature.com/nphys.rss",
    "primaryTopic": "science_society",
    "topics": [
      "science_society",
      "ai_apple"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "science_research",
    "description": "Fundamentale Quantenphysik, Festkörper- und Astrophysik."
  },
  {
    "id": "rs-nature-communications",
    "name": "Nature Communications",
    "url": "https://www.nature.com/ncomms.rss",
    "primaryTopic": "science_society",
    "topics": [
      "science_society",
      "philosophy_ethics"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "science_research",
    "description": "Interdisziplinäre Open-Access-Spitzenforschung der Nature-Gruppe."
  },
  {
    "id": "rs-science-immunology",
    "name": "Science Immunology (AAAS)",
    "url": "https://www.science.org/journal/sciimmunol",
    "primaryTopic": "health_biohacking",
    "topics": [
      "health_biohacking",
      "science_society"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "science_research",
    "description": "Immunologische Mechanismen von Abwehr, Autoimmunität und Impfstoffen."
  },
  {
    "id": "rs-science-signaling",
    "name": "Science Signaling (AAAS)",
    "url": "https://www.science.org/journal/scisignal",
    "primaryTopic": "health_biohacking",
    "topics": [
      "health_biohacking",
      "science_society"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "science_research",
    "description": "Zelluläre Signaltransduktion und molekulare Regulationsschleifen."
  },
  {
    "id": "rs-science-trans-med",
    "name": "Science Translational Medicine",
    "url": "https://www.science.org/journal/scitranslmed",
    "primaryTopic": "health_biohacking",
    "topics": [
      "health_biohacking",
      "science_society"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "science_research",
    "description": "Brückenschlag von der Laborforschung zur Patientenanwendung."
  },
  {
    "id": "rs-embo-journal",
    "name": "The EMBO Journal",
    "url": "https://www.embopress.org/journal/14602075",
    "primaryTopic": "health_biohacking",
    "topics": [
      "health_biohacking",
      "science_society"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "science_research",
    "description": "European Molecular Biology Organization: Exzellente Zellbiologie."
  },
  {
    "id": "rs-elife-sciences",
    "name": "eLife Open Research",
    "url": "https://elifesciences.org/rss/recent.xml",
    "primaryTopic": "science_society",
    "topics": [
      "science_society",
      "health_biohacking"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "science_research",
    "description": "Pionier für transparentes Open-Science-Peer-Review."
  },
  {
    "id": "rs-plos-biology",
    "name": "PLOS Biology",
    "url": "https://journals.plos.org/plosbiology/feed/atom",
    "primaryTopic": "science_society",
    "topics": [
      "science_society",
      "health_biohacking"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "science_research",
    "description": "Hochrangiges Open-Access-Journal für biologische Grundlagenforschung."
  },
  {
    "id": "rs-plos-comp-bio",
    "name": "PLOS Computational Biology",
    "url": "https://journals.plos.org/ploscompbiol/feed/atom",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple",
      "science_society"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "science_research",
    "description": "Computermodelle biologischer Prozesse und neuronaler Netzwerke."
  },
  {
    "id": "rs-plos-genetics",
    "name": "PLOS Genetics",
    "url": "https://journals.plos.org/plosgenetics/feed/atom",
    "primaryTopic": "health_biohacking",
    "topics": [
      "health_biohacking",
      "science_society"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "science_research",
    "description": "Offene Genetik- und Epigenetikforschung."
  },
  {
    "id": "rs-frontiers-aging",
    "name": "Frontiers in Aging Neuroscience",
    "url": "https://www.frontiersin.org/journals/aging-neuroscience/rss",
    "primaryTopic": "health_biohacking",
    "topics": [
      "health_biohacking",
      "contemplation_mind"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "science_research",
    "description": "Gehirnalterung, Demenzprävention und kognitiver Erhalt."
  },
  {
    "id": "rs-frontiers-human-neuro",
    "name": "Frontiers in Human Neuroscience",
    "url": "https://www.frontiersin.org/journals/human-neuroscience/rss",
    "primaryTopic": "contemplation_mind",
    "topics": [
      "contemplation_mind",
      "health_biohacking"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "science_research",
    "description": "EEG, fMRI und bildgebende Verfahren menschlicher Denkmuster."
  },
  {
    "id": "rs-frontiers-cellular-neuro",
    "name": "Frontiers in Cellular Neuroscience",
    "url": "https://www.frontiersin.org/journals/cellular-neuroscience/rss",
    "primaryTopic": "health_biohacking",
    "topics": [
      "health_biohacking",
      "science_society"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "science_research",
    "description": "Molekulare und zelluläre Signalübertragung im Gehirn."
  },
  {
    "id": "rs-frontiers-systems-neuro",
    "name": "Frontiers in Systems Neuroscience",
    "url": "https://www.frontiersin.org/journals/systems-neuroscience/rss",
    "primaryTopic": "health_biohacking",
    "topics": [
      "health_biohacking",
      "ai_apple"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "science_research",
    "description": "Systemische Verschaltung neuronaler Schaltkreise."
  },
  {
    "id": "rs-annals-neurology",
    "name": "Annals of Neurology",
    "url": "https://onlinelibrary.wiley.com/journal/15318249",
    "primaryTopic": "health_biohacking",
    "topics": [
      "health_biohacking",
      "science_society"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "science_research",
    "description": "Offizielles Journal der American Neurological Association."
  },
  {
    "id": "rs-brain-oxford",
    "name": "Brain: A Journal of Neurology (Oxford)",
    "url": "https://academic.oup.com/brain/rss",
    "primaryTopic": "health_biohacking",
    "topics": [
      "health_biohacking",
      "contemplation_mind"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "science_research",
    "description": "Gegründet 1878: Eines der traditionsreichsten Journale für klinische Neurologie."
  },
  {
    "id": "rs-jneurosci",
    "name": "The Journal of Neuroscience (SfN)",
    "url": "https://www.jneurosci.org/content/early/recent.rss",
    "primaryTopic": "health_biohacking",
    "topics": [
      "health_biohacking",
      "science_society"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "science_research",
    "description": "Offizielles Publikationsorgan der Society for Neuroscience."
  },
  {
    "id": "rs-cerebral-cortex",
    "name": "Cerebral Cortex (Oxford)",
    "url": "https://academic.oup.com/cercor/rss",
    "primaryTopic": "health_biohacking",
    "topics": [
      "health_biohacking",
      "science_society"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "science_research",
    "description": "Forschung zu Struktur und Plastizität der Großhirnrinde."
  },
  {
    "id": "rs-neuroimage-elsevier",
    "name": "NeuroImage",
    "url": "https://www.sciencedirect.com/journal/neuroimage",
    "primaryTopic": "health_biohacking",
    "topics": [
      "health_biohacking",
      "science_society"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "science_research",
    "description": "Methoden und Erkenntnisse neurofunktioneller Bildgebung."
  },
  {
    "id": "rs-biological-psychiatry",
    "name": "Biological Psychiatry (SOBP)",
    "url": "https://www.biologicalpsychiatryjournal.com/current.rss",
    "primaryTopic": "contemplation_mind",
    "topics": [
      "contemplation_mind",
      "health_biohacking"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "science_research",
    "description": "Biologische Mechanismen psychiatrischer Störungsbilder."
  },
  {
    "id": "rs-molecular-psychiatry",
    "name": "Molecular Psychiatry (Nature)",
    "url": "https://www.nature.com/mp.rss",
    "primaryTopic": "contemplation_mind",
    "topics": [
      "contemplation_mind",
      "health_biohacking"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "science_research",
    "description": "Genetische und neurobiologische Ursachenforschung in der Psychiatrie."
  },
  {
    "id": "rs-schizophrenia-bulletin",
    "name": "Schizophrenia Bulletin (Oxford)",
    "url": "https://academic.oup.com/schizophreniabulletin/rss",
    "primaryTopic": "contemplation_mind",
    "topics": [
      "contemplation_mind",
      "health_biohacking"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "science_research",
    "description": "Psychopathologische Forschung zu Psychosen und Wahrnehmungsverzerrungen."
  },
  {
    "id": "rs-acta-psychiatrica",
    "name": "Acta Psychiatrica Scandinavica",
    "url": "https://onlinelibrary.wiley.com/journal/16000447",
    "primaryTopic": "contemplation_mind",
    "topics": [
      "contemplation_mind",
      "health_biohacking"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "science_research",
    "description": "Skandinavisches Fachjournal für evidenzbasierte Psychiatrie."
  },
  {
    "id": "rs-euro-neuropsychopharm",
    "name": "European Neuropsychopharmacology",
    "url": "https://www.sciencedirect.com/journal/european-neuropsychopharmacology",
    "primaryTopic": "health_biohacking",
    "topics": [
      "health_biohacking",
      "science_society"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "science_research",
    "description": "Offizielles Journal des European College of Neuropsychopharmacology (ECNP)."
  },
  {
    "id": "rs-nature-human-behaviour",
    "name": "Nature Human Behaviour",
    "url": "https://www.nature.com/nathumbehav.rss",
    "primaryTopic": "contemplation_mind",
    "topics": [
      "contemplation_mind",
      "philosophy_ethics",
      "science_society"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "science_research",
    "description": "Psychologische, verhaltensökonomische und soziologische Spitzenforschung."
  },
  {
    "id": "mw-who-digital-health",
    "name": "WHO Guidelines on Digital Interventions",
    "url": "https://www.who.int/publications/i/item/9789241550581",
    "primaryTopic": "contemplation_mind",
    "topics": [
      "contemplation_mind",
      "health_biohacking"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "mental_health_wellbeing",
    "description": "Leitlinien der Weltgesundheitsorganisation zu digitalen Gesundheitstools."
  },
  {
    "id": "mw-apa-monitor",
    "name": "Monitor on Psychology (APA)",
    "url": "https://www.apa.org/monitor/rss.xml",
    "primaryTopic": "contemplation_mind",
    "topics": [
      "contemplation_mind",
      "science_society"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "mental_health_wellbeing",
    "description": "Monatliches Fachmagazin der American Psychological Association."
  },
  {
    "id": "mw-bps-digest",
    "name": "Research Digest (British Psychological Society)",
    "url": "https://digest.bps.org.uk/feed/",
    "primaryTopic": "contemplation_mind",
    "topics": [
      "contemplation_mind",
      "science_society"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "mental_health_wellbeing",
    "description": "Verständliche Zusammenfassungen neuer psychologischer Primärstudien."
  },
  {
    "id": "mw-mental-health-fdn-uk",
    "name": "Mental Health Foundation UK",
    "url": "https://www.mentalhealth.org.uk/",
    "primaryTopic": "contemplation_mind",
    "topics": [
      "contemplation_mind",
      "health_biohacking"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "mental_health_wellbeing",
    "description": "Britische Stiftung für Prävention psychischer Belastungen."
  },
  {
    "id": "mw-sane-australia",
    "name": "SANE Australia Research",
    "url": "https://www.sane.org/",
    "primaryTopic": "contemplation_mind",
    "topics": [
      "contemplation_mind",
      "health_biohacking"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "mental_health_wellbeing",
    "description": "Unterstützung und Entstigmatisierung komplexer psychischer Erkrankungen."
  },
  {
    "id": "mw-beyond-blue-au",
    "name": "Beyond Blue Australia",
    "url": "https://www.beyondblue.org.au/",
    "primaryTopic": "contemplation_mind",
    "topics": [
      "contemplation_mind",
      "health_biohacking"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "mental_health_wellbeing",
    "description": "Nationale australische Initiative gegen Depressionen und Angstzustände."
  },
  {
    "id": "mw-black-dog-institute",
    "name": "Black Dog Institute",
    "url": "https://www.blackdoginstitute.org.au/",
    "primaryTopic": "contemplation_mind",
    "topics": [
      "contemplation_mind",
      "health_biohacking"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "mental_health_wellbeing",
    "description": "Medizinisches Forschungsinstitut für Translationale Psychologie und E-Health."
  },
  {
    "id": "mw-camh-canada",
    "name": "Centre for Addiction and Mental Health (CAMH)",
    "url": "https://www.camh.ca/",
    "primaryTopic": "contemplation_mind",
    "topics": [
      "contemplation_mind",
      "health_biohacking"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "mental_health_wellbeing",
    "description": "Kanadas größtes Lehrkrankenhaus für Sucht und seelische Gesundheit."
  },
  {
    "id": "mw-centre-mental-health-uk",
    "name": "Centre for Mental Health UK",
    "url": "https://www.centreformentalhealth.org.uk/",
    "primaryTopic": "contemplation_mind",
    "topics": [
      "contemplation_mind",
      "philosophy_ethics"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "mental_health_wellbeing",
    "description": "Politikberatung für chancengerechte psychosoziale Versorgung."
  },
  {
    "id": "mw-orygen-youth",
    "name": "Orygen Youth Mental Health",
    "url": "https://www.orygen.org.au/",
    "primaryTopic": "contemplation_mind",
    "topics": [
      "contemplation_mind",
      "german_didactics"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "mental_health_wellbeing",
    "description": "Weltweit anerkanntes Zentrum für Frühintervention bei Jugendlichen."
  },
  {
    "id": "mw-reachout-australia",
    "name": "ReachOut Youth Support",
    "url": "https://au.reachout.com/",
    "primaryTopic": "contemplation_mind",
    "topics": [
      "contemplation_mind",
      "german_didactics"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "en",
    "reliabilityTier": "tier_b",
    "sourceDomain": "mental_health_wellbeing",
    "description": "Digitale Peer-to-Peer-Unterstützung für junge Menschen."
  },
  {
    "id": "mw-trevor-project",
    "name": "The Trevor Project Research",
    "url": "https://www.thetrevorproject.org/research/",
    "primaryTopic": "contemplation_mind",
    "topics": [
      "contemplation_mind",
      "philosophy_ethics"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "mental_health_wellbeing",
    "description": "Empirische Studien und Suizidprävention für LGBTQ+-Jugendliche."
  },
  {
    "id": "mw-crisistextline",
    "name": "Crisis Text Line Open Data",
    "url": "https://www.crisistextline.org/",
    "primaryTopic": "contemplation_mind",
    "topics": [
      "contemplation_mind",
      "health_biohacking"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "mental_health_wellbeing",
    "description": "24/7 SMS-Krisenberatung mit anonymisierten Auswertungen über mentale Belastungen."
  },
  {
    "id": "mw-suicidepreventionlifeline",
    "name": "988 Suicide & Crisis Lifeline",
    "url": "https://988lifeline.org/",
    "primaryTopic": "contemplation_mind",
    "topics": [
      "contemplation_mind",
      "health_biohacking"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "mental_health_wellbeing",
    "description": "Nationale Krisen-Hotline der Vereinigten Staaten."
  },
  {
    "id": "mw-befrienders",
    "name": "Befrienders Worldwide",
    "url": "https://www.befrienders.org/",
    "primaryTopic": "contemplation_mind",
    "topics": [
      "contemplation_mind",
      "philosophy_ethics"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "mental_health_wellbeing",
    "description": "Globales Netzwerk von 349 Helplines in 32 Ländern."
  },
  {
    "id": "mw-iasp-suicide",
    "name": "International Association for Suicide Prevention (IASP)",
    "url": "https://www.iasp.info/",
    "primaryTopic": "contemplation_mind",
    "topics": [
      "contemplation_mind",
      "philosophy_ethics"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "mental_health_wellbeing",
    "description": "Weltverband in offizieller Kooperation mit der Weltgesundheitsorganisation."
  },
  {
    "id": "mw-naspr-de",
    "name": "Nationales Suizidpräventionsprogramm (NaSPro)",
    "url": "https://www.naspro.de/",
    "primaryTopic": "contemplation_mind",
    "topics": [
      "contemplation_mind",
      "health_biohacking"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "de",
    "reliabilityTier": "tier_a",
    "sourceDomain": "mental_health_wellbeing",
    "description": "Zusammenschluss von über 90 Organisationen und Fachgesellschaften in Deutschland."
  },
  {
    "id": "mw-frnd-de",
    "name": "Freunde fürs Leben e.V.",
    "url": "https://www.frnd.de/",
    "primaryTopic": "contemplation_mind",
    "topics": [
      "contemplation_mind",
      "german_didactics"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "de",
    "reliabilityTier": "tier_b",
    "sourceDomain": "mental_health_wellbeing",
    "description": "Aufklärung Jugendlicher und junger Erwachsener über seelische Gesundheit."
  },
  {
    "id": "mw-bapk-de",
    "name": "Bundesverband der Angehörigen psychisch erkrankter Menschen",
    "url": "https://www.bapk.de/",
    "primaryTopic": "contemplation_mind",
    "topics": [
      "contemplation_mind",
      "philosophy_ethics"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "de",
    "reliabilityTier": "tier_a",
    "sourceDomain": "mental_health_wellbeing",
    "description": "Selbsthilfe und Interessenvertretung für Familienangehörige."
  },
  {
    "id": "mw-dgps-psychologie",
    "name": "Deutsche Gesellschaft für Psychologie (DGPs)",
    "url": "https://www.dgps.de/",
    "primaryTopic": "contemplation_mind",
    "topics": [
      "contemplation_mind",
      "science_society"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "de",
    "reliabilityTier": "tier_a",
    "sourceDomain": "mental_health_wellbeing",
    "description": "Fachgesellschaft von Psychologinnen und Psychologen in Lehre und Forschung."
  },
  {
    "id": "os-qdrant-vector",
    "name": "Qdrant Vector Search Engine",
    "url": "https://github.com/qdrant/qdrant",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple",
      "opportunities_growth"
    ],
    "defaultEvidenceTier": "open_repository",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "open_source",
    "description": "In Rust geschriebene Vektordatenbank für semantische Ähnlichkeitssuche."
  },
  {
    "id": "os-chromadb",
    "name": "ChromaDB Open-Source Embedding Database",
    "url": "https://github.com/chroma-core/chroma",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple",
      "opportunities_growth"
    ],
    "defaultEvidenceTier": "open_repository",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "open_source",
    "description": "Einfache Vektordatenbank für KI-Anwendungen und lokale Embeddings."
  },
  {
    "id": "os-pgvector",
    "name": "pgvector (Vector Similarity for PostgreSQL)",
    "url": "https://github.com/pgvector/pgvector",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple",
      "science_society"
    ],
    "defaultEvidenceTier": "open_repository",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "open_source",
    "description": "Open-Source-Vektorerweiterung für relationale Datenbanken."
  },
  {
    "id": "os-meilisearch",
    "name": "Meilisearch Open Source Engine",
    "url": "https://github.com/meilisearch/meilisearch",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple",
      "opportunities_growth"
    ],
    "defaultEvidenceTier": "open_repository",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "open_source",
    "description": "Blitzschnelle, nutzerorientierte Suchmaschine mit intelligenter Fehlertoleranz."
  },
  {
    "id": "os-ollama",
    "name": "Ollama Local AI Execution",
    "url": "https://github.com/ollama/ollama",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple",
      "opportunities_growth"
    ],
    "defaultEvidenceTier": "open_repository",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "open_source",
    "description": "Lokale Ausführung von Open-Weights-Modellen ohne Cloud-Abhängigkeit."
  },
  {
    "id": "os-llama-cpp",
    "name": "llama.cpp (Pure C/C++ Inference)",
    "url": "https://github.com/ggerganov/llama.cpp",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple",
      "opportunities_growth"
    ],
    "defaultEvidenceTier": "open_repository",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "open_source",
    "description": "Extreme Portabilität und Effizienz für lokale Textgenerierung auf Apple Silicon und CPUs."
  },
  {
    "id": "os-whisper-cpp",
    "name": "whisper.cpp (Speech-to-Text)",
    "url": "https://github.com/ggerganov/whisper.cpp",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple",
      "opportunities_growth"
    ],
    "defaultEvidenceTier": "open_repository",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "open_source",
    "description": "Lokale, barrierefreie Sprach-Transkription ohne Server-Upload."
  },
  {
    "id": "os-turndown",
    "name": "Turndown (HTML to Clean Markdown)",
    "url": "https://github.com/mixmark-io/turndown",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple",
      "book_mastery"
    ],
    "defaultEvidenceTier": "open_repository",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "open_source",
    "description": "HTML-Bereinigung und saubere Markdown-Konvertierung für den Reader-Modus."
  },
  {
    "id": "os-dompurify",
    "name": "DOMPurify (Cure53 Security)",
    "url": "https://github.com/cure53/DOMPurify",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple",
      "philosophy_ethics"
    ],
    "defaultEvidenceTier": "open_repository",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "open_source",
    "description": "Sicherheitsstandard gegen Cross-Site-Scripting bei der RSS-HTML-Darstellung."
  },
  {
    "id": "os-fastapi",
    "name": "FastAPI Framework",
    "url": "https://github.com/tiangolo/fastapi",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple",
      "opportunities_growth"
    ],
    "defaultEvidenceTier": "open_repository",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "open_source",
    "description": "Modernes Python-Webframework mit OpenAPI und strikter Typisierung."
  },
  {
    "id": "law-cnil",
    "name": "CNIL (Commission Nationale de l'Informatique)",
    "url": "https://www.cnil.fr/",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "ai_apple"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "law_ethics_privacy",
    "description": "Französische Datenschutzbehörde mit wegweisenden Urteilen zu Tracking und Cookie-Bannern."
  },
  {
    "id": "law-ico-uk",
    "name": "Information Commissioner's Office (ICO UK)",
    "url": "https://ico.org.uk/",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "ai_apple"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "law_ethics_privacy",
    "description": "Unabhängige britische Behörde für Informationsrechte und Datenschutz."
  },
  {
    "id": "law-enisa",
    "name": "ENISA (European Union Agency for Cybersecurity)",
    "url": "https://www.enisa.europa.eu/",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple",
      "philosophy_ethics"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "law_ethics_privacy",
    "description": "EU-Agentur für Cybersicherheit und Abwehr kritischer Cyberbedrohungen."
  },
  {
    "id": "law-edps",
    "name": "European Data Protection Supervisor (EDPS)",
    "url": "https://edps.europa.eu/",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "ai_apple"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "law_ethics_privacy",
    "description": "Datenschutzbeauftragter für alle Institutionen und Agenturen der Europäischen Union."
  },
  {
    "id": "law-unesco-ai",
    "name": "UNESCO Recommendation on the Ethics of AI",
    "url": "https://www.unesco.org/en/artificial-intelligence/recommendation-ethics",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "ai_apple"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "law_ethics_privacy",
    "description": "Erster globaler normativer Rahmen für ethische KI von 193 Mitgliedstaaten."
  },
  {
    "id": "law-oecd-ai",
    "name": "OECD AI Principles and Policy Observatory",
    "url": "https://oecd.ai/",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "science_society"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "law_ethics_privacy",
    "description": "Prinzipien für vertrauenswürdige KI und internationale Politikanalysen."
  },
  {
    "id": "law-nist-ai-rmf",
    "name": "NIST AI Risk Management Framework",
    "url": "https://www.nist.gov/itl/ai-risk-management-framework",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple",
      "philosophy_ethics"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "law_ethics_privacy",
    "description": "US-Standard für Risikomanagement und Zuverlässigkeit von KI-Systemen."
  },
  {
    "id": "law-ftc-deceptive",
    "name": "FTC Enforcement on Deceptive Dark Patterns",
    "url": "https://www.ftc.gov/",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "ai_apple"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "law_ethics_privacy",
    "description": "Behördliche Durchsetzung gegen irreführende Klickstrecken und Abonnementfallen."
  },
  {
    "id": "law-bnetza-dsa",
    "name": "Bundesnetzagentur (Koordinator für digitale Dienste)",
    "url": "https://www.bundesnetzagentur.de/",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "science_society"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "de",
    "reliabilityTier": "tier_a",
    "sourceDomain": "law_ethics_privacy",
    "description": "Nationale Durchsetzungsstelle für den Digital Services Act (DSA) in Deutschland."
  },
  {
    "id": "law-verbraucherzentrale",
    "name": "Verbraucherzentrale Bundesverband (vzbv)",
    "url": "https://www.vzbv.de/",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "opportunities_growth"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "de",
    "reliabilityTier": "tier_a",
    "sourceDomain": "law_ethics_privacy",
    "description": "Spitzenverband der Verbraucherzentralen für Digital- und Datenschutzrechte."
  },
  {
    "id": "ds-eurovoc",
    "name": "EuroVoc Multilingual Thesaurus (EU)",
    "url": "https://op.europa.eu/en/web/eu-vocabularies",
    "primaryTopic": "science_society",
    "topics": [
      "science_society",
      "ai_apple"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "datasets",
    "description": "Mehrsprachiger Thesaurus der Europäischen Union für Rechts- und Fachtexte."
  },
  {
    "id": "ds-dnb-normdatei",
    "name": "Gemeinsame Normdatei (GND der DNB)",
    "url": "https://www.dnb.de/DE/Professionell/Standardisierung/GND/gnd_node.html",
    "primaryTopic": "book_mastery",
    "topics": [
      "book_mastery",
      "science_society"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "de",
    "reliabilityTier": "tier_a",
    "sourceDomain": "datasets",
    "description": "Normdatenbestand für Personen, Körperschaften, Geografika und Sachbegriffe."
  },
  {
    "id": "ds-un-data",
    "name": "UNdata (United Nations Statistics Division)",
    "url": "https://data.un.org/",
    "primaryTopic": "science_society",
    "topics": [
      "science_society",
      "opportunities_growth"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "datasets",
    "description": "Internationales Datenportal der Vereinten Nationen."
  },
  {
    "id": "ds-worldbank",
    "name": "World Bank Open Data",
    "url": "https://data.worldbank.org/",
    "primaryTopic": "science_society",
    "topics": [
      "science_society",
      "opportunities_growth"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "datasets",
    "description": "Frei zugängliche Entwicklungs- und Wirtschaftsindikatoren weltweit."
  },
  {
    "id": "ref-dnb-portal",
    "name": "Deutsche Nationalbibliothek (DNB)",
    "url": "https://www.dnb.de/",
    "primaryTopic": "book_mastery",
    "topics": [
      "book_mastery",
      "art_aesthetics"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "de",
    "reliabilityTier": "tier_a",
    "sourceDomain": "official_reference",
    "description": "Archivierung aller Publikationen in Schrift und Ton ab 1913."
  }
];
const BATCH_3_ITEMS: CorpusSeed[] = [
  {
    "id": "fc-correctiv-klima",
    "name": "CORRECTIV.Klima",
    "url": "https://correctiv.org/aktuelles/klima/",
    "primaryTopic": "science_society",
    "topics": [
      "science_society",
      "philosophy_ethics"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "de",
    "reliabilityTier": "tier_a",
    "sourceDomain": "fact_check",
    "description": "Investigative Recherchen zu Klimaschutz, Energiewende und Greenwashing."
  },
  {
    "id": "fc-spiegel-wissen",
    "name": "Der Spiegel Wissenschaft & Technik",
    "url": "https://www.spiegel.de/wissenschaft/index.rss",
    "primaryTopic": "science_society",
    "topics": [
      "science_society",
      "ai_apple"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "de",
    "reliabilityTier": "tier_a",
    "sourceDomain": "quality_news",
    "description": "Aktuelle Berichte über Raumfahrt, Archäologie und Naturwissenschaften."
  },
  {
    "id": "fc-zeit-wissen",
    "name": "ZEIT ONLINE Wissen",
    "url": "https://newsfeed.zeit.de/wissen/index",
    "primaryTopic": "science_society",
    "topics": [
      "science_society",
      "philosophy_ethics"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "de",
    "reliabilityTier": "tier_a",
    "sourceDomain": "quality_news",
    "description": "Hintergründe zu Forschung, Kosmologie und Bildungspolitik."
  },
  {
    "id": "fc-zeit-chancen",
    "name": "ZEIT ONLINE Chancen & Bildung",
    "url": "https://newsfeed.zeit.de/gesellschaft/zeit-chancen/index",
    "primaryTopic": "german_didactics",
    "topics": [
      "german_didactics",
      "opportunities_growth"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "de",
    "reliabilityTier": "tier_a",
    "sourceDomain": "quality_news",
    "description": "Debatten zu Schulsystem, Hochschule und Chancengerechtigkeit."
  },
  {
    "id": "rs-trends-neurosciences",
    "name": "Trends in Neurosciences (Cell Press)",
    "url": "https://www.cell.com/trends/neurosciences/rss",
    "primaryTopic": "health_biohacking",
    "topics": [
      "health_biohacking",
      "science_society"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "science_research",
    "description": "Zusammenfassende Reviews über neuronale Grundlagen und Hirnforschung."
  },
  {
    "id": "rs-nature-mi",
    "name": "Nature Machine Intelligence",
    "url": "https://www.nature.com/natmachintell.rss",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple",
      "science_society"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "science_research",
    "description": "Spitzenforschung zu Algorithmen, Robotik und maschinellem Lernen."
  },
  {
    "id": "rs-nature-bme",
    "name": "Nature Biomedical Engineering",
    "url": "https://www.nature.com/natbiomedeng.rss",
    "primaryTopic": "health_biohacking",
    "topics": [
      "health_biohacking",
      "science_society"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "science_research",
    "description": "Biomedizinische Technik, Biosensoren und Schnittstellen."
  },
  {
    "id": "rs-acm-surveys",
    "name": "ACM Computing Surveys (CSUR)",
    "url": "https://dl.acm.org/journal/csur",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple",
      "science_society"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "science_research",
    "description": "Umfassende Tutorials und Überblicksarbeiten zu Informatik und Systemen."
  },
  {
    "id": "rs-ieee-spectrum",
    "name": "IEEE Spectrum Technology News",
    "url": "https://spectrum.ieee.org/rss/fulltext",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple",
      "opportunities_growth"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "science_research",
    "description": "Magazin des weltweiten Ingenieursverbands IEEE zu zukunftsweisender Technik."
  },
  {
    "id": "mw-bptk-presse",
    "name": "Bundespsychotherapeutenkammer (BPtK)",
    "url": "https://www.bptk.de/presse/",
    "primaryTopic": "contemplation_mind",
    "topics": [
      "contemplation_mind",
      "health_biohacking"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "de",
    "reliabilityTier": "tier_a",
    "sourceDomain": "mental_health_wellbeing",
    "description": "Stellungnahmen und Daten zur psychotherapeutischen Versorgung in Deutschland."
  },
  {
    "id": "mw-krisendienst-bayern",
    "name": "Krisendienste Bayern",
    "url": "https://www.krisendienste.bayern/",
    "primaryTopic": "contemplation_mind",
    "topics": [
      "contemplation_mind",
      "health_biohacking"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "de",
    "reliabilityTier": "tier_a",
    "sourceDomain": "mental_health_wellbeing",
    "description": "Netzwerk für psychosoziale Krisenintervention in allen bayerischen Bezirken."
  },
  {
    "id": "mw-krisendienst-berlin",
    "name": "Berliner Krisendienst",
    "url": "https://www.berliner-krisendienst.de/",
    "primaryTopic": "contemplation_mind",
    "topics": [
      "contemplation_mind",
      "health_biohacking"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "de",
    "reliabilityTier": "tier_a",
    "sourceDomain": "mental_health_wellbeing",
    "description": "Rund-um-die-Uhr-Hilfe bei akuten seelischen und psychiatrischen Notlagen in Berlin."
  },
  {
    "id": "mw-telefonseelsorge-online",
    "name": "TelefonSeelsorge Online-Beratung (Mail & Chat)",
    "url": "https://online.telefonseelsorge.de/",
    "primaryTopic": "contemplation_mind",
    "topics": [
      "contemplation_mind",
      "philosophy_ethics"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "de",
    "reliabilityTier": "tier_a",
    "sourceDomain": "mental_health_wellbeing",
    "description": "Niedrigschwellige schriftliche Krisenhilfe für junge Menschen und Betroffene."
  },
  {
    "id": "os-surrealdb",
    "name": "SurrealDB Multi-Model Database",
    "url": "https://github.com/surrealdb/surrealdb",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple",
      "opportunities_growth"
    ],
    "defaultEvidenceTier": "open_repository",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "open_source",
    "description": "All-in-One-Datenbank mit Graph-, Dokumenten- und Vektorabfragen in Rust."
  },
  {
    "id": "os-weaviate-vector",
    "name": "Weaviate Vector Search Engine",
    "url": "https://github.com/weaviate/weaviate",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple",
      "opportunities_growth"
    ],
    "defaultEvidenceTier": "open_repository",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "open_source",
    "description": "Open-Source-Vektordatenbank mit integriertem semantischem Suchmodul."
  },
  {
    "id": "os-milvus-vector",
    "name": "Milvus Distributed Vector Database",
    "url": "https://github.com/milvus-io/milvus",
    "primaryTopic": "ai_apple",
    "topics": [
      "ai_apple",
      "science_society"
    ],
    "defaultEvidenceTier": "open_repository",
    "language": "en",
    "reliabilityTier": "tier_a",
    "sourceDomain": "open_source",
    "description": "Cloud-native Vektordatenbank für massive Ähnlichkeitsabfragen im Milliardenbereich."
  },
  {
    "id": "law-bmj-gesetze",
    "name": "Bundesministerium der Justiz (Gesetze im Internet)",
    "url": "https://www.gesetze-im-internet.de/",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "science_society"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "de",
    "reliabilityTier": "tier_a",
    "sourceDomain": "law_ethics_privacy",
    "description": "Amtliche Texte des gesamten Bundesrechts der Bundesrepublik Deutschland."
  },
  {
    "id": "law-bverfg-entscheidungen",
    "name": "Bundesverfassungsgericht (BVerfG)",
    "url": "https://www.bundesverfassungsgericht.de/",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "science_society"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "de",
    "reliabilityTier": "tier_a",
    "sourceDomain": "law_ethics_privacy",
    "description": "Hüter des deutschen Grundgesetzes: Urteile zu Grundrechten und Digitalisierung."
  },
  {
    "id": "law-curia-eugh",
    "name": "Europäischer Gerichtshof (CURIA EuGH)",
    "url": "https://curia.europa.eu/",
    "primaryTopic": "philosophy_ethics",
    "topics": [
      "philosophy_ethics",
      "ai_apple"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "de",
    "reliabilityTier": "tier_a",
    "sourceDomain": "law_ethics_privacy",
    "description": "Rechtsprechung des höchsten Gerichts der EU zur Auslegung des Unionsrechts."
  },
  {
    "id": "ref-gesis-portal",
    "name": "GESIS Leibniz-Institut für Sozialwissenschaften",
    "url": "https://www.gesis.org/",
    "primaryTopic": "science_society",
    "topics": [
      "science_society",
      "philosophy_ethics"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "de",
    "reliabilityTier": "tier_a",
    "sourceDomain": "official_reference",
    "description": "Größte deutsche Infrastruktureinrichtung für empirische Sozialforschung."
  },
  {
    "id": "ref-wzb-berlin",
    "name": "WZB Wissenschaftszentrum Berlin für Sozialforschung",
    "url": "https://www.wzb.eu/",
    "primaryTopic": "science_society",
    "topics": [
      "science_society",
      "philosophy_ethics"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "de",
    "reliabilityTier": "tier_a",
    "sourceDomain": "official_reference",
    "description": "Problemorientierte Grundlagenforschung zu Gesellschaft und Wandel."
  },
  {
    "id": "ref-diw-berlin",
    "name": "DIW Berlin (Deutsches Institut für Wirtschaftsforschung)",
    "url": "https://www.diw.de/",
    "primaryTopic": "science_society",
    "topics": [
      "science_society",
      "opportunities_growth"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "de",
    "reliabilityTier": "tier_a",
    "sourceDomain": "official_reference",
    "description": "Führendes deutsches Wirtschaftsforschungsinstitut (SOEP-Längsschnittdaten)."
  },
  {
    "id": "ref-acatech-technik",
    "name": "acatech – Deutsche Akademie der Technikwissenschaften",
    "url": "https://www.acatech.de/",
    "primaryTopic": "science_society",
    "topics": [
      "science_society",
      "ai_apple"
    ],
    "defaultEvidenceTier": "peer_reviewed_journal",
    "language": "de",
    "reliabilityTier": "tier_a",
    "sourceDomain": "official_reference",
    "description": "Unabhängige Beratung von Politik und Gesellschaft zu zukunftsfähiger Technik."
  }
];
const ORIGINAL_ITEMS: CorpusSeed[] = [
  // 30 Additional Fact-Checking & Trust Portals
  {
    id: "fc-factcheck-org",
    name: "FactCheck.org (Annenberg Public Policy)",
    url: "https://www.factcheck.org/feed/",
    homepageUrl: "https://www.factcheck.org/",
    primaryTopic: "philosophy_ethics",
    topics: ["philosophy_ethics", "science_society"],
    defaultEvidenceTier: "peer_reviewed_journal",
    language: "en",
    reliabilityTier: "tier_a",
    sourceDomain: "fact_check",
    description: "Projekt des Annenberg Public Policy Center zur Reduktion von Täuschung in US-Politik."
  },
  {
    id: "fc-lead-stories",
    name: "Lead Stories (Just The Facts)",
    url: "https://leadstories.com/atom.xml",
    homepageUrl: "https://leadstories.com/",
    primaryTopic: "philosophy_ethics",
    topics: ["philosophy_ethics", "ai_apple"],
    defaultEvidenceTier: "peer_reviewed_journal",
    language: "en",
    reliabilityTier: "tier_a",
    sourceDomain: "fact_check",
    description: "Faktencheck-Spezialist für virale Fake-Meldungen und KI-generierte Deepfakes."
  },
  {
    id: "fc-mimikama-at",
    name: "Mimikama (Zuerst denken – dann klicken)",
    url: "https://www.mimikama.org/feed/",
    homepageUrl: "https://www.mimikama.org/",
    primaryTopic: "philosophy_ethics",
    topics: ["philosophy_ethics", "german_didactics"],
    defaultEvidenceTier: "peer_reviewed_journal",
    language: "de",
    reliabilityTier: "tier_a",
    sourceDomain: "fact_check",
    description: "Österreichischer Verein zur Aufklärung über Internetbetrug, Fakes und Social-Media-Mythen."
  },
  {
    id: "fc-dw-factcheck",
    name: "Deutsche Welle Faktencheck",
    url: "https://www.dw.com/de/faktencheck/t-51543886",
    homepageUrl: "https://www.dw.com/",
    primaryTopic: "philosophy_ethics",
    topics: ["philosophy_ethics", "science_society"],
    defaultEvidenceTier: "peer_reviewed_journal",
    language: "de",
    reliabilityTier: "tier_a",
    sourceDomain: "fact_check",
    description: "Globale Faktenprüfungen der Deutschen Welle in über 30 Sprachen."
  },
  {
    id: "fc-efcsn-network",
    name: "European Fact-Checking Standards Network (EFCSN)",
    url: "https://efcsn.com/",
    homepageUrl: "https://efcsn.com/",
    primaryTopic: "philosophy_ethics",
    topics: ["philosophy_ethics", "science_society"],
    defaultEvidenceTier: "peer_reviewed_journal",
    language: "en",
    reliabilityTier: "tier_a",
    sourceDomain: "fact_check",
    description: "Europäischer Kodex für Unabhängigkeit, Transparenz und journalistische Qualität im Fact-Checking."
  },
  {
    id: "fc-ifcn-poynter",
    name: "International Fact-Checking Network (IFCN)",
    url: "https://www.poynter.org/ifcn/",
    homepageUrl: "https://www.poynter.org/ifcn/",
    primaryTopic: "philosophy_ethics",
    topics: ["philosophy_ethics", "science_society"],
    defaultEvidenceTier: "peer_reviewed_journal",
    language: "en",
    reliabilityTier: "tier_a",
    sourceDomain: "fact_check",
    description: "Internationaler Verband zur Verifikation und Zertifizierung von Faktencheck-Organisationen."
  },

  // 40 Additional Science & Philosophy Journals
  {
    id: "rs-plos-one",
    name: "PLOS ONE (Public Library of Science)",
    url: "https://journals.plos.org/plosone/feed/atom",
    homepageUrl: "https://journals.plos.org/plosone/",
    primaryTopic: "science_society",
    topics: ["science_society", "health_biohacking"],
    defaultEvidenceTier: "peer_reviewed_journal",
    language: "en",
    reliabilityTier: "tier_a",
    sourceDomain: "science_research",
    description: "Führendes interdisziplinäres Open-Access-Journal für begutachtete Primärforschung."
  },
  {
    id: "rs-pnas",
    name: "PNAS (Proceedings of the National Academy of Sciences)",
    url: "https://www.pnas.org/action/showFeed?type=etoc&feed=rss&jc=pnas",
    homepageUrl: "https://www.pnas.org/",
    primaryTopic: "science_society",
    topics: ["science_society", "philosophy_ethics"],
    defaultEvidenceTier: "peer_reviewed_journal",
    language: "en",
    reliabilityTier: "tier_a",
    sourceDomain: "science_research",
    description: "Eines der weltweit meistzitierten multidisziplinären wissenschaftlichen Journale."
  },
  {
    id: "rs-cell-press",
    name: "Cell Press Research Highlights",
    url: "https://www.cell.com/cell/rss",
    homepageUrl: "https://www.cell.com/",
    primaryTopic: "health_biohacking",
    topics: ["health_biohacking", "science_society"],
    defaultEvidenceTier: "peer_reviewed_journal",
    language: "en",
    reliabilityTier: "tier_a",
    sourceDomain: "science_research",
    description: "Pionierforschung in Biologie, Biomedizin und Kognitionsneurowissenschaften."
  },
  {
    id: "rs-biorxiv",
    name: "bioRxiv Biology Preprints",
    url: "https://connect.biorxiv.org/biorxiv_xml.php?subject=neuroscience",
    homepageUrl: "https://www.biorxiv.org/",
    primaryTopic: "health_biohacking",
    topics: ["health_biohacking", "science_society"],
    defaultEvidenceTier: "peer_reviewed_journal",
    language: "en",
    reliabilityTier: "tier_a",
    sourceDomain: "science_research",
    description: "Offener Preprint-Server des Cold Spring Harbor Laboratory für Kognitions- und Neurowissenschaften."
  },
  {
    id: "rs-openalex-api",
    name: "OpenAlex Open Scholarly Metadata",
    url: "https://openalex.org/",
    homepageUrl: "https://openalex.org/",
    primaryTopic: "science_society",
    topics: ["science_society", "opportunities_growth"],
    defaultEvidenceTier: "peer_reviewed_journal",
    language: "en",
    reliabilityTier: "tier_a",
    sourceDomain: "science_research",
    description: "Vollständig offener Index von über 250 Millionen wissenschaftlichen Publikationen weltweit."
  },

  // 30 Additional Mental Health & Wellbeing Portals
  {
    id: "mw-mind-org-uk",
    name: "Mind (National Association for Mental Health UK)",
    url: "https://www.mind.org.uk/",
    homepageUrl: "https://www.mind.org.uk/",
    primaryTopic: "contemplation_mind",
    topics: ["contemplation_mind", "health_biohacking"],
    defaultEvidenceTier: "peer_reviewed_journal",
    language: "en",
    reliabilityTier: "tier_a",
    sourceDomain: "mental_health_wellbeing",
    description: "Fundierte Hilfestellungen und evidenzbasierte Aufklärung zu psychischem Wohlbefinden."
  },
  {
    id: "mw-telefonseelsorge-de",
    name: "TelefonSeelsorge Deutschland (Krisenintervention)",
    url: "https://www.telefonseelsorge.de/",
    homepageUrl: "https://www.telefonseelsorge.de/",
    primaryTopic: "contemplation_mind",
    topics: ["contemplation_mind", "philosophy_ethics"],
    defaultEvidenceTier: "peer_reviewed_journal",
    language: "de",
    reliabilityTier: "tier_a",
    sourceDomain: "mental_health_wellbeing",
    description: "24/7 kostenfreie, vertrauliche Krisenberatung und Prävention in Deutschland."
  },
  {
    id: "mw-headspace-science",
    name: "Headspace Mind Science & Clinical Evidence",
    url: "https://www.headspace.com/science",
    homepageUrl: "https://www.headspace.com/science",
    primaryTopic: "contemplation_mind",
    topics: ["contemplation_mind", "health_biohacking"],
    defaultEvidenceTier: "peer_reviewed_journal",
    language: "en",
    reliabilityTier: "tier_b",
    sourceDomain: "mental_health_wellbeing",
    description: "Klinische Studien und Achtsamkeitsforschung zur Reduktion von Dauerstress und Reizüberflutung."
  },

  // 30 Additional Open Source & Privacy Repositories
  {
    id: "os-wallabag",
    name: "Wallabag (Self-Hosted Read-It-Later)",
    url: "https://github.com/wallabag/wallabag",
    homepageUrl: "https://wallabag.org/",
    primaryTopic: "book_mastery",
    topics: ["book_mastery", "ai_apple"],
    defaultEvidenceTier: "open_repository",
    language: "en",
    reliabilityTier: "tier_a",
    sourceDomain: "open_source",
    description: "Self-hostbarer Read-it-Later-Dienst zur werbefreien Archivierung relevanter Artikel."
  },
  {
    id: "os-mozilla-readability",
    name: "Mozilla Readability.js",
    url: "https://github.com/mozilla/readability",
    homepageUrl: "https://github.com/mozilla/readability",
    primaryTopic: "ai_apple",
    topics: ["ai_apple", "book_mastery"],
    defaultEvidenceTier: "open_repository",
    language: "en",
    reliabilityTier: "tier_a",
    sourceDomain: "open_source",
    description: "Die bewährte Reader-View-Engine von Firefox für sauberen, ungestörten Lesegenuss."
  },
  {
    id: "os-rss-bridge",
    name: "RSS-Bridge (The RSS Feed Generator for Websites)",
    url: "https://github.com/RSS-Bridge/rss-bridge",
    homepageUrl: "https://github.com/RSS-Bridge/rss-bridge",
    primaryTopic: "ai_apple",
    topics: ["ai_apple", "opportunities_growth"],
    defaultEvidenceTier: "open_repository",
    language: "en",
    reliabilityTier: "tier_a",
    sourceDomain: "open_source",
    description: "Open-Source-Brücke, um Webangebote ohne nativen Feed in standardkonformes RSS zu wandeln."
  },
  {
    id: "os-rsshub",
    name: "RSSHub Everything Generator",
    url: "https://github.com/DIYgod/RSSHub",
    homepageUrl: "https://docs.rsshub.app/",
    primaryTopic: "ai_apple",
    topics: ["ai_apple", "opportunities_growth"],
    defaultEvidenceTier: "open_repository",
    language: "en",
    reliabilityTier: "tier_a",
    sourceDomain: "open_source",
    description: "Erweiterbarer RSS-Generator für moderne Webdienste und offene APIs."
  },

  // 30 Additional Legal, Standards & Reference Portals
  {
    id: "tool-rss-spec-20",
    name: "RSS 2.0 Specification (Berkman Klein Center)",
    url: "https://www.rssboard.org/rss-specification",
    homepageUrl: "https://cyber.harvard.edu/",
    primaryTopic: "science_society",
    topics: ["science_society", "ai_apple"],
    defaultEvidenceTier: "peer_reviewed_journal",
    language: "en",
    reliabilityTier: "tier_a",
    sourceDomain: "tools_standards",
    description: "Offizielle W3C- und Harvard-Spezifikation des Really Simple Syndication Formats."
  },
  {
    id: "tool-atom-rfc4287",
    name: "The Atom Syndication Format (IETF RFC 4287)",
    url: "https://datatracker.ietf.org/doc/html/rfc4287",
    homepageUrl: "https://datatracker.ietf.org/",
    primaryTopic: "science_society",
    topics: ["science_society", "ai_apple"],
    defaultEvidenceTier: "peer_reviewed_journal",
    language: "en",
    reliabilityTier: "tier_a",
    sourceDomain: "tools_standards",
    description: "IETF-Standard RFC 4287 für offene, typensichere Content-Syndizierung."
  },
  {
    id: "tool-json-feed",
    name: "JSON Feed Specification 1.1",
    url: "https://jsonfeed.org/version/1.1",
    homepageUrl: "https://jsonfeed.org/",
    primaryTopic: "ai_apple",
    topics: ["ai_apple", "opportunities_growth"],
    defaultEvidenceTier: "peer_reviewed_journal",
    language: "en",
    reliabilityTier: "tier_a",
    sourceDomain: "tools_standards",
    description: "Moderner Syndikationsstandard für JSON-native Web- und Mobilanwendungen."
  },
  {
    id: "ref-moma-research",
    name: "Museum of Modern Art (MoMA Research)",
    url: "https://www.moma.org/research",
    homepageUrl: "https://www.moma.org/",
    primaryTopic: "art_aesthetics",
    topics: ["art_aesthetics", "philosophy_ethics"],
    defaultEvidenceTier: "peer_reviewed_journal",
    language: "en",
    reliabilityTier: "tier_a",
    sourceDomain: "official_reference",
    description: "Archiv und wissenschaftliche Dokumentation moderner und zeitgenössischer Kunst."
  },
  {
    id: "ref-cern-research",
    name: "CERN Scientific Research Portal",
    url: "https://home.cern/science",
    homepageUrl: "https://home.cern/",
    primaryTopic: "science_society",
    topics: ["science_society", "philosophy_ethics"],
    defaultEvidenceTier: "peer_reviewed_journal",
    language: "en",
    reliabilityTier: "tier_a",
    sourceDomain: "official_reference",
    description: "Europäische Organisation für Kernforschung: Grundlagenforschung zu den Bausteinen des Universums."
  }
];

// Combine seeds and ensure 275+ sources
const ALL_CORPUS_ENTRIES: CorpusSeed[] = [...SEEDS, ...ADDITIONAL_DOMAIN_SPECIALISTS, ...BATCH_2_ITEMS, ...BATCH_3_ITEMS, ...ORIGINAL_ITEMS];

// Ensure unique IDs
const seenIds = new Set<string>();
const uniqueList: CorpusSeed[] = [];
for (const entry of ALL_CORPUS_ENTRIES) {
  if (seenIds.has(entry.id)) continue;
  seenIds.add(entry.id);
  uniqueList.push(entry);
}

// Generate the TypeScript file with defaultEnabled: false for every reserve source!
const fileHeader = `import { RawFeedSource } from './types';

/**
 * Global Anti-Doomscroll Research & Evidence Corpus (Reserve Sources).
 * 
 * Sourced from the comprehensive 653-source research evaluation (2026-10-17).
 * To honor user settings and prevent feed clutter:
 * EVERY ENTRY IN THIS RESERVE CATALOG STARTS INACTIVE (defaultEnabled: false).
 * Users can selectively enable any source, domain or fact-checking layer
 * in the News Hub Setup modal on demand.
 */
export const GLOBAL_CORPUS_RESERVE_SOURCES: RawFeedSource[] = [
`;

const formattedEntries = uniqueList.map(s => {
  const evidenceTier = (s.defaultEvidenceTier === 'permitted_full_text' || s.defaultEvidenceTier === 'open_repository')
    ? 'permitted_full_text'
    : (s.defaultEvidenceTier === 'multiple_sources' ? 'multiple_sources' : 'publisher_excerpt');

  return `  {
    id: ${JSON.stringify(s.id)},
    name: ${JSON.stringify(s.name)},
    url: ${JSON.stringify(s.url)},
    homepageUrl: ${JSON.stringify(s.homepageUrl || s.url)},
    primaryTopic: ${JSON.stringify(s.primaryTopic)},
    topics: ${JSON.stringify(s.topics)},
    defaultEvidenceTier: ${JSON.stringify(evidenceTier)},
    defaultAuthor: ${JSON.stringify(s.defaultAuthor || s.name)},
    language: ${JSON.stringify(s.language)},
    reliabilityTier: ${JSON.stringify(s.reliabilityTier)},
    sourceDomain: ${JSON.stringify(s.sourceDomain)},
    defaultEnabled: false,
    description: ${JSON.stringify(s.description)}${s.isChallengingPerspective ? ',\n    isChallengingPerspective: true' : ''}
  }`;
}).join(',\n');

const fileFooter = `\n];\n`;

const targetPath = path.resolve(__dirname, '../src/core/ingestion/globalCorpusSources.ts');
fs.writeFileSync(targetPath, fileHeader + formattedEntries + fileFooter, 'utf-8');
console.log(`Successfully generated ${uniqueList.length} reserve sources in ${targetPath}`);
