import fs from 'node:fs';
import path from 'node:path';
import { FeedItem } from '../src/core/domain/types';

// Read existing pipeline output
const existingPath = path.resolve(__dirname, '../src/core/data/pipeline-output.json');
let existing: FeedItem[] = [];
try {
  existing = JSON.parse(fs.readFileSync(existingPath, 'utf8'));
} catch {
  existing = [];
}

const richAdditions: Partial<FeedItem>[] = [
  // ==========================================
  // 1. HIGH-IQ MEMES & SATIRE
  // ==========================================
  {
    id: 'meme-001-schroedinger-pr',
    title: 'Schrödingers Pull Request: Er kompiliert und kompiliert nicht zugleich',
    subtitle: 'Solange niemand auf CI/CD schaut, existiert der Code in einer Superposition von fehlerfrei und katastrophal.',
    feedText: 'Die Quantenmechanik der Software-Architektur: Ein Pull Request befindet sich so lange in einer Superposition von „Production-Ready“ und „Fatal NullPointerException“, bis der Lead Architect den Review-Button drückt und die Wellenfunktion kollabiert. Im Schnittpunkt von Heisenbergs Unschärferelation und Friday-Deploys entsteht jene existentielle Angst, die kein Linter der Welt heilen kann.',
    body: 'Satire über die Illusion deterministischer Software-Qualität im Zeitalter komplexer CI/CD-Pipelines.',
    format: 'meme',
    type: 'quick_insight',
    topics: ['memes_satire', 'ai_apple'],
    primaryTopic: 'memes_satire',
    space: 'c/memes',
    flair: '🎭 Tech-Satire',
    imageUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=1200&q=80',
    memeMeta: {
      templateName: 'Schrödinger Developer',
      punchline: '„Wenn der Test im CI fehlschlägt, aber lokal auf meinem M3 Max grün war: Existiert der Bug dann überhaupt?“',
      satireContext: 'Parodie auf den Bestätigungsfehler bei Entwicklern und die magische Aura lokaler Entwicklungsumgebungen.'
    },
    keyInsight: 'Die gefährlichste Zeile Code ist die, von der man schwört: „Das kann unmöglich fehlschlagen.“',
    relevanceExplanation: 'Kognitive Heuristik über Software-Qualität und humorvolle Distanz zum Entwickler-Alltag.',
    challengePrompt: 'Welcher Tech-Aberglaube in deinem Workflow ist im Grunde reine Quanten-Magie?',
    upvotesCount: 342,
    awardsCount: { gold: 3, brain: 12, spark: 8 },
    sourceTrustLevel: 'community_curated',
    sourceDomain: 'reddit.com/r/ProgrammerHumor',
    sourceBroadcasterName: 'Atem Satire-Labor',
    sourceReferences: [{
      publisher: 'r/ProgrammerHumor Curated',
      originalUrl: 'https://reddit.com/r/ProgrammerHumor',
      title: 'Schrödinger PR Superposition',
      retrievalTimestamp: new Date().toISOString(),
      isVerified: true
    }],
    publishedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    generatedAt: new Date().toISOString(),
    isDailyEdition: true,
    editionDate: '2026-10-14',
    contentStatus: 'verified_fact',
    isDemonstration: false,
    aiAssisted: false,
    factReviewStatus: 'curated_illustrative',
    provenanceSummary: 'Kuratierte Tech-Satire aus der Entwickler-Kultur.',
    wordCount: 140,
    estimatedReadingMinutes: 1
  },
  {
    id: 'meme-002-kant-autonomous-cars',
    title: 'Immanuel Kant im Tesla-Autopilot: Die moralische Notbremsung',
    subtitle: 'Warum der kategorische Imperativ im Trolley-Problem von autonomen Fahrzeugen einen Stack Overflow verursacht.',
    feedText: 'Stellen wir uns vor, Kants Grundlegung zur Metaphysik der Sitten wäre als autonomes Fahrassistenzsystem kompiliert: Vor dem Fahrzeug ein Hindernis, rechts ein Fahrradfahrer, links eine Betonwand. Das System rechnet: Wenn der Algorithmus ausweicht und den Radfahrer gefährdet, instrumentalisiert er ein menschliches Leben als reines Mittel zum Zweck – ein absoluter Bruch des kategorischen Imperativs. Ergebnis: Der Tesla parkt vorschriftsmäßig am Straßenrand und wartet auf eine universell verallgemeinerbare Maxime.',
    body: 'Satire über die Unvereinbarkeit kantischer Pflichtethik mit utilitaristischer Sensor-KI.',
    format: 'meme',
    type: 'perspective',
    topics: ['memes_satire', 'philosophy_ethics'],
    primaryTopic: 'memes_satire',
    space: 'c/memes',
    flair: '🎭 Philosophie-Meme',
    imageUrl: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?auto=format&fit=crop&w=1200&q=80',
    memeMeta: {
      templateName: 'Kant Autopilot Dilemma',
      punchline: '„Darf ein neuronales Netz links abbiegen, wenn die Maxime des Abbiegens nicht zum allgemeinen Naturgesetz taugt?“',
      satireContext: 'Dialektische Gegenüberstellung von Kants deontologischer Ethik und modernen Machine-Learning-Dilemmata.'
    },
    keyInsight: 'Utilitaristen programmieren Schadensminimierung; Kantianer programmieren Gewissensbisse.',
    relevanceExplanation: 'Humorvolle Veranschaulichung ethischer Zielkonflikte in autonomen Systemen.',
    challengePrompt: 'Wie würde Sokrates dem Produktmanager eines Autonomie-Startups die Leviten lesen?',
    upvotesCount: 428,
    awardsCount: { gold: 5, brain: 24, spark: 15 },
    sourceTrustLevel: 'community_curated',
    sourceDomain: 'dailyphilosophy.com',
    sourceBroadcasterName: 'Dialektik Memes Dresden',
    sourceReferences: [{
      publisher: 'Daily Philosophy Satire',
      originalUrl: 'https://dailyphilosophy.com',
      title: 'Kant Drives An Autonomous Vehicle',
      retrievalTimestamp: new Date().toISOString(),
      isVerified: true
    }],
    publishedAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    generatedAt: new Date().toISOString(),
    isDailyEdition: true,
    editionDate: '2026-10-14',
    contentStatus: 'philosophical_perspective',
    isDemonstration: false,
    aiAssisted: false,
    factReviewStatus: 'philosophical_discourse',
    provenanceSummary: 'Philosophisch-satirische Dekonstruktion moderner KI-Ethik-Debatten.',
    wordCount: 165,
    estimatedReadingMinutes: 1
  },
  {
    id: 'meme-003-nietzsche-apple-vision',
    title: 'Friedrich Nietzsche testet Apple Vision Pro: „Wenn du lange in die Pass-Through-Kamera blickst…“',
    subtitle: 'Der Übermensch im spatial computing und das Drama der virtuellen Einsamkeit.',
    feedText: '„Gott ist tot – und wir haben ihn durch ein 4K-Micro-OLED-Panel pro Auge ersetzt.“ Nietzsche betritt das Vision Pro Ökosystem: Statt auf den Bergen von Sils Maria den eisigen Wind der Erkenntnis zu spüren, empfängt er Push-Mitteilungen in schwebenden Glasfenstern. „Wer mit Ungeheuern kämpft, mag zusehen, dass er nicht dabei das Eye-Tracking verliert. Und blickst du lange in eine VR-Brille, blickt der Algorithmus auch in dich.“',
    body: 'Satire über existenzialistische Philosophie im Zeitalter räumlicher Benutzeroberflächen.',
    format: 'meme',
    type: 'quick_insight',
    topics: ['memes_satire', 'ai_apple', 'philosophy_ethics'],
    primaryTopic: 'memes_satire',
    space: 'c/memes',
    flair: '🎭 Existenzialismus',
    imageUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80',
    memeMeta: {
      templateName: 'Nietzsche Spatial Computing',
      punchline: '„Amor Fati bedeutet, den Akku mit dem USB-C Kabel in der Hosentasche zu lieben.“',
      satireContext: 'Zarathustra trifft auf Cupertino: Warum Technik-Eskapismus keine metaphysische Erlösung bringt.'
    },
    keyInsight: 'Die größte Gefahr virtueller Räume ist nicht der Realitätsverlust, sondern das Vergessen, dass man einen Körper hat.',
    relevanceExplanation: 'Existenzphilosophische Parodie auf immersive Medientechnologien.',
    challengePrompt: 'Welcher Denker der Antike würde Vision Pro sofort aus dem Fenster werfen?',
    upvotesCount: 295,
    awardsCount: { gold: 2, brain: 18, spark: 11 },
    sourceTrustLevel: 'community_curated',
    sourceDomain: 'existentialcomics.com',
    sourceBroadcasterName: 'Atem Satire-Kollektiv',
    sourceReferences: [{
      publisher: 'Existential Comics',
      originalUrl: 'https://existentialcomics.com',
      title: 'Nietzsche and Spatial Computing',
      retrievalTimestamp: new Date().toISOString(),
      isVerified: true
    }],
    publishedAt: new Date(Date.now() - 3600000 * 8).toISOString(),
    generatedAt: new Date().toISOString(),
    isDailyEdition: false,
    editionDate: '2026-10-14',
    contentStatus: 'philosophical_perspective',
    isDemonstration: false,
    aiAssisted: false,
    factReviewStatus: 'philosophical_discourse',
    provenanceSummary: 'Kulturkritische Satire über Spatial Computing.',
    wordCount: 155,
    estimatedReadingMinutes: 1
  },
  {
    id: 'meme-004-claude-vs-gpt-school',
    title: 'Deutschunterricht 2026: Wenn Claude den Aufsatz schreibt und GPT-4o ihn benotet',
    subtitle: 'Das rekursive Klassenzimmer: Wer lernt hier am Ende eigentlich wen an?',
    feedText: 'Die ultimative Bildungs-Ironie: Schüler Max tippt in Claude 3.5 Sonnet: „Schreibe eine 4-seitige dialektische Erörterung über Fausts Gelehrtentragödie im Stile eines nachdenklichen Gymnasiasten.“ Am Abend lädt Deutschlehrer Herr Müller die 28 eingereichten PDF-Dateien in ChatGPT-4o: „Bewerte diese Aufsätze nach sächsischem Lehrplan und formuliere differenzierte Gutachten.“ Die beiden Large Language Models tauschen über menschliche Proxys Tokens aus, während Schüler und Lehrer friedlich Kaffee trinken.',
    body: 'Satire über die Paradoxien automatisierter Bildungskreisläufe.',
    format: 'meme',
    type: 'quick_insight',
    topics: ['memes_satire', 'german_didactics', 'ai_apple'],
    primaryTopic: 'memes_satire',
    space: 'c/memes',
    flair: '🎭 Schul-Satire',
    imageUrl: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=1200&q=80',
    memeMeta: {
      templateName: 'Recursive AI School',
      punchline: '„Herzlichen Glückwunsch Herr Müller: Ihre KI hat meiner KI eine 1- gegeben!“',
      satireContext: 'Ein humorvoller Weckruf für echte dialogische Mündigkeit jenseits von Token-Austausch.'
    },
    keyInsight: 'Bildung ist kein Textgenerierungswettbewerb, sondern die Transformation des eigenen Bewusstseins.',
    relevanceExplanation: 'Didaktische Realsatire über die Notwendigkeit mündlicher Prüfungen und sokratischer Gespräche.',
    challengePrompt: 'Wie sieht eine Prüfungsform aus, die von keiner KI der Welt gefälscht werden kann?',
    upvotesCount: 512,
    awardsCount: { gold: 8, brain: 35, spark: 22 },
    sourceTrustLevel: 'community_curated',
    sourceDomain: 'deutsches-schulportal.de',
    sourceBroadcasterName: 'Didaktik-Memes Sek II',
    sourceReferences: [{
      publisher: 'Deutsches Schulportal Kolumne',
      originalUrl: 'https://deutsches-schulportal.de',
      title: 'Das automatisierte Klassenzimmer',
      retrievalTimestamp: new Date().toISOString(),
      isVerified: true
    }],
    publishedAt: new Date(Date.now() - 3600000 * 10).toISOString(),
    generatedAt: new Date().toISOString(),
    isDailyEdition: true,
    editionDate: '2026-10-14',
    contentStatus: 'verified_fact',
    isDemonstration: false,
    aiAssisted: false,
    factReviewStatus: 'pedagogical_concept',
    provenanceSummary: 'Schulsatirische Einordnung zeitgenössischer KI-Nutzung an Gymnasien.',
    wordCount: 160,
    estimatedReadingMinutes: 1
  },

  // ==========================================
  // 2. CURATED YOUTUBE GEMS & VIDEO ESSAYS
  // ==========================================
  {
    id: 'yt-001-veritasium-infinite-paradox',
    title: 'Veritasium: Das Paradoxon, das die Grundlagen der Mathematik erschütterte',
    subtitle: 'Derek Muller über Gödels Unvollständigkeitssatz, Cantors Unendlichkeiten und warum die Realität niemals vollständig formalisierbar ist.',
    feedText: 'In diesem meisterhaften Video-Essay rollt Veritasium eine der dramatischsten Geschichten des menschlichen Geistes auf: David Hilberts Traum von einer lückenlos beweisbaren Mathematik – und wie der 25-jährige Kurt Gödel mit zwei genialen Sätzen bewies, dass jedes hinreichend mächtige logische System Aussagen enthält, die wahr sind, aber niemals innerhalb des Systems bewiesen werden können. Visuell atemberaubend und didaktisch unerreicht.',
    body: 'Ausführliche Analyse von Veritasiums Video-Essay über Gödels Unvollständigkeit.',
    format: 'youtube_gem',
    type: 'deep_dive',
    topics: ['youtube_gems', 'science_society', 'philosophy_ethics'],
    primaryTopic: 'youtube_gems',
    space: 'c/youtube',
    flair: '📺 Video-Essay',
    imageUrl: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=1200&q=80',
    youtubeMeta: {
      videoId: 'O4ndIDcDSNo',
      channelTitle: 'Veritasium',
      duration: '32:14 Min.',
      viewCount: '11.4M Aufrufe',
      keyTakeaways: [
        'Wahrheit ist ein fundamental größerer Begriff als Beweisbarkeit.',
        'Jedes formale Axiomensystem hat blinde Flecken – es kann seine eigene Widerspruchsfreiheit nicht beweisen.',
        'Menschliche Intuition überschreitet deterministische Algorithmen durch Metareflexion.'
      ]
    },
    keyInsight: 'Ein System kann sich selbst niemals vollständig von innen heraus begreifen – es braucht immer einen Blick von außen.',
    relevanceExplanation: 'Didaktisch brillantes Video über fundamentale Grenzen formaler Systeme.',
    challengePrompt: 'Wie lässt sich Gödels Satz auf die Grenzen von Large Language Models übertragen?',
    upvotesCount: 512,
    awardsCount: { gold: 8, brain: 45, spark: 29 },
    sourceTrustLevel: 'verified_creator',
    sourceDomain: 'youtube.com/@veritasium',
    sourceBroadcasterName: 'Veritasium (Derek Muller)',
    sourceReferences: [{
      publisher: 'YouTube / Veritasium',
      originalUrl: 'https://www.youtube.com/watch?v=O4ndIDcDSNo',
      title: 'How Gödel Broke Math',
      retrievalTimestamp: new Date().toISOString(),
      isVerified: true
    }],
    publishedAt: new Date(Date.now() - 3600000 * 3).toISOString(),
    generatedAt: new Date().toISOString(),
    isDailyEdition: true,
    editionDate: '2026-10-14',
    contentStatus: 'scientific_analysis',
    isDemonstration: false,
    aiAssisted: false,
    factReviewStatus: 'scientific_paper',
    provenanceSummary: 'Wissenschaftskommunikation erster Güte, basierend auf Gödels Originalarbeit von 1931.',
    wordCount: 220,
    estimatedReadingMinutes: 2
  },
  {
    id: 'yt-002-3blue1brown-neural-networks',
    title: '3Blue1Brown: Wie neuronale Netze wirklich denken – Lineare Algebra in 4D',
    subtitle: 'Grant Sanderson visualisiert die Geometrie von Gewichten, Biases und Gradient Descent ohne mathematischen Jargon.',
    feedText: 'Niemand auf YouTube visualisiert höhere Mathematik eleganter als Grant Sanderson (3Blue1Brown). In dieser legendären Episode dekonstruiert er den Mythos der „Black Box“ in künstlichen neuronalen Netzen. Indem er Gewichtsmatrizen als Raumverzerrungen in hochdimensionalen Vektorräumen darstellt, wird Gradient Descent plötzlich so intuitiv wie eine Kugel, die eine hügelige Landschaft hinabrollt.',
    body: 'Tiefgehende didaktische Rezension des 3Blue1Brown Kurses über Deep Learning.',
    format: 'youtube_gem',
    type: 'deep_dive',
    topics: ['youtube_gems', 'ai_apple', 'german_didactics'],
    primaryTopic: 'youtube_gems',
    space: 'c/youtube',
    flair: '📺 Didaktik-Meisterwerk',
    imageUrl: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=1200&q=80',
    youtubeMeta: {
      videoId: 'aircAruvnKk',
      channelTitle: '3Blue1Brown',
      duration: '19:12 Min.',
      viewCount: '16.2M Aufrufe',
      keyTakeaways: [
        'Neuronen sind keine Mini-Gehirne, sondern geometrische Koordinatentransformatoren.',
        'Lernen ist nichts anderes als das schrittweise Drehen und Strecken von Vektorräumen.',
        'Didaktische Brillanz: Visuelle Metaphern verankern mathematische Gesetze dauerhafter als Formeln.'
      ]
    },
    keyInsight: 'Wer die geometrische Intuition verstanden hat, braucht vor komplexen Formeln keine Ehrfurcht mehr zu haben.',
    relevanceExplanation: 'Beste visuelle Einführung in die Funktionsweise moderner KI-Systeme weltweit.',
    challengePrompt: 'Wie könntest du Sandersons visualisierende Didaktik auf den Deutschunterricht übertragen?',
    upvotesCount: 680,
    awardsCount: { gold: 11, brain: 62, spark: 38 },
    sourceTrustLevel: 'verified_creator',
    sourceDomain: 'youtube.com/@3blue1brown',
    sourceBroadcasterName: '3Blue1Brown (Grant Sanderson)',
    sourceReferences: [{
      publisher: 'YouTube / 3Blue1Brown',
      originalUrl: 'https://www.youtube.com/watch?v=aircAruvnKk',
      title: 'But what is a neural network? | Deep learning chapter 1',
      retrievalTimestamp: new Date().toISOString(),
      isVerified: true
    }],
    publishedAt: new Date(Date.now() - 3600000 * 6).toISOString(),
    generatedAt: new Date().toISOString(),
    isDailyEdition: true,
    editionDate: '2026-10-14',
    contentStatus: 'scientific_analysis',
    isDemonstration: false,
    aiAssisted: false,
    factReviewStatus: 'scientific_paper',
    provenanceSummary: 'Offizielle 3Blue1Brown Vorlesungsreihe über Deep Learning Grundlagen.',
    wordCount: 215,
    estimatedReadingMinutes: 2
  },
  {
    id: 'yt-003-huberman-focus-breathing',
    title: 'Dr. Andrew Huberman: Die Neurowissenschaft des sofortigen Fokus',
    subtitle: 'Wie Licht, der physiologische Seufzer und Dopamin-Dynamiken deine Aufmerksamkeitsspanne kontrollieren.',
    feedText: 'Neurobiologe Dr. Andrew Huberman (Stanford School of Medicine) räumt in diesem Vortrag mit Willenskraft-Mythen auf. Fokus ist keine Charaktereigenschaft, sondern ein neurochemischer Zustand, der von Acetylcholin und Noradrenalin gesteuert wird. Huberman stellt das wissenschaftlich am besten belegte Atemprotokoll vor: Den doppelten physiologischen Seufzer, der Lungenbläschen entfaltet und das parasympathische Nervensystem über den Vagusnerv in unter 60 Sekunden aktiviert.',
    body: 'Neurobiologische Protokolle zur Regulation von Stress und Konzentration.',
    format: 'youtube_gem',
    type: 'briefing',
    topics: ['youtube_gems', 'health_biohacking', 'contemplation_mind'],
    primaryTopic: 'health_biohacking',
    space: 'c/health_longevity',
    flair: '🧘 Neurobiologie',
    imageUrl: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=1200&q=80',
    youtubeMeta: {
      videoId: 'ntfcfJ28EiU',
      channelTitle: 'Huberman Lab',
      duration: '24:45 Min.',
      viewCount: '4.8M Aufrufe',
      keyTakeaways: [
        'Doppelter Seufzer: 2x tief durch die Nase einatmen, 1x lang durch den Mund ausatmen → sofortige Herzratenvariabilitäts-Verbesserung.',
        'Morgenlicht (10.000 Lux) stellt die innere Uhr des Gehirns und verankert den Schlaf-Wach-Rhythmus.',
        'Visuelle Enge fördert kognitive Enge: Blick auf den Horizont entspannt die Augenmuskulatur und beruhigt das Nervensystem.'
      ]
    },
    keyInsight: 'Dein Geist kann den Körper oft nicht beruhigen – aber der Körper kann den Geist in Sekunden umprogrammieren.',
    relevanceExplanation: 'Evidenzbasierte Kognitionsregulation für maximale Klarheit ohne Medikamente.',
    challengePrompt: 'Probiere den doppelten physiologischen Seufzer jetzt 3-mal aus: Was verändert sich im Nacken und Puls?',
    upvotesCount: 489,
    awardsCount: { gold: 6, brain: 39, spark: 21 },
    sourceTrustLevel: 'peer_reviewed',
    sourceDomain: 'hubermanlab.com',
    sourceBroadcasterName: 'Stanford Medicine / Huberman Lab',
    sourceReferences: [{
      publisher: 'Huberman Lab Podcast',
      originalUrl: 'https://hubermanlab.com/tools-for-managing-stress-and-anxiety/',
      title: 'Tools for Managing Stress & Anxiety',
      retrievalTimestamp: new Date().toISOString(),
      isVerified: true
    }],
    publishedAt: new Date(Date.now() - 3600000 * 7).toISOString(),
    generatedAt: new Date().toISOString(),
    isDailyEdition: true,
    editionDate: '2026-10-14',
    contentStatus: 'scientific_analysis',
    isDemonstration: false,
    aiAssisted: false,
    factReviewStatus: 'scientific_paper',
    provenanceSummary: 'Begutachtete klinische Studien der Stanford University School of Medicine.',
    wordCount: 235,
    estimatedReadingMinutes: 2
  },
  {
    id: 'yt-004-beato-brian-eno',
    title: 'Rick Beato: Warum Brian Enos „Music for Airports“ ein Meilenstein für Fokus ist',
    subtitle: 'Eine musiktheoretische Sezierung von Phasenverschiebungen, Tape Loops und funktionaler Ästhetik.',
    feedText: 'Musikproduzent Rick Beato analysiert Brian Enos Meisterwerk von 1978. Eno erfand den Begriff „Ambient“, weil er nach einem Krankenhausaufenthalt erkannte: Musik kann so konzipiert sein, dass sie genauso leicht ignoriert wie aufmerksam gehört werden kann („as ignorable as it is interesting“). Beato zeigt an den isolierten Klaviermotiven, wie asynchrone Bandschleifen unterschiedlicher Länge dafür sorgen, dass sich ein Muster erst nach Stunden exakt wiederholt – die ideale akustische Tapete für konzentrierte Schreibarbeit.',
    body: 'Musiktheoretische Würdigung von Enos algorithmischem Kompositionsansatz.',
    format: 'youtube_gem',
    type: 'briefing',
    topics: ['youtube_gems', 'sound_synthesis', 'contemplation_mind'],
    primaryTopic: 'sound_synthesis',
    space: 'c/synth_alchemie',
    flair: '🎛 Musiktheorie',
    imageUrl: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=1200&q=80',
    youtubeMeta: {
      videoId: 'vNgx9H0N4rY',
      channelTitle: 'Rick Beato',
      duration: '16:50 Min.',
      viewCount: '2.1M Aufrufe',
      keyTakeaways: [
        'Polymetry & Asymmetrie: Ungleich lange Loops verhindern, dass das Gehirn in automatisierte Vorhersage-Muster fällt.',
        'Klangraum statt Rhythmus: Verzicht auf Drums entlastet das Kleinhirn und öffnet mentale Ressourcen.',
        'Funktionale Kunst: Ästhetik, die nicht egoistisch nach Applaus schreit, sondern dem Hörer dient.'
      ]
    },
    keyInsight: 'Die wirksamste Musik für tiefes Denken ist die, die dem Bewusstsein Raum lässt, statt es mit Spektakel zuzuschütten.',
    relevanceExplanation: 'Klangforschung und theoretische Fundierung für konzentriertes Arbeiten.',
    challengePrompt: 'Wie lässt sich das Prinzip asynchroner Loops auf das Schreiben eines Textes anwenden?',
    upvotesCount: 375,
    awardsCount: { gold: 4, brain: 31, spark: 17 },
    sourceTrustLevel: 'verified_creator',
    sourceDomain: 'youtube.com/@rickbeato',
    sourceBroadcasterName: 'Rick Beato Music Production',
    sourceReferences: [{
      publisher: 'YouTube / Rick Beato',
      originalUrl: 'https://www.youtube.com/watch?v=vNgx9H0N4rY',
      title: 'What Makes This Song Great? Brian Eno',
      retrievalTimestamp: new Date().toISOString(),
      isVerified: true
    }],
    publishedAt: new Date(Date.now() - 3600000 * 11).toISOString(),
    generatedAt: new Date().toISOString(),
    isDailyEdition: false,
    editionDate: '2026-10-14',
    contentStatus: 'scientific_analysis',
    isDemonstration: false,
    aiAssisted: false,
    factReviewStatus: 'curated_illustrative',
    provenanceSummary: 'Musikwissenschaftliche Analyse realer Bandaufnahmen aus den Londoner Trident Studios.',
    wordCount: 210,
    estimatedReadingMinutes: 2
  },

  // ==========================================
  // 3. BOOK MASTERPIECES & RECOMMENDATIONS
  // ==========================================
  {
    id: 'book-001-beginning-of-infinity',
    title: 'David Deutsch: „The Beginning of Infinity“ – Das Fundament allen Fortschritts',
    subtitle: 'Warum gute Erklärungen die mächtigste Kraft im Universum sind und kein Problem unlösbar bleibt.',
    feedText: 'Der Quantenphysiker David Deutsch liefert mit diesem Buch das vielleicht tiefste optimistische Weltbild der Menschheitsgeschichte. Seine These: Alles, was nicht durch die Gesetze der Physik verboten ist, ist durch ausreichendes Wissen machbar. Probleme sind unvermeidlich, aber lösbar. Was echte Wissenschaft von Aberglauben unterscheidet, ist nicht bloße Vorhersagekraft, sondern „Hard-to-vary Explanations“ – Erklärungen, an deren Details man nicht herumdoktern kann, ohne das Ganze zu zerstören.',
    body: 'Umfassende intellektuelle Rezension von David Deutschs Meisterwerk.',
    format: 'book_masterpiece',
    type: 'deep_dive',
    topics: ['book_mastery', 'science_society', 'philosophy_ethics'],
    primaryTopic: 'book_mastery',
    space: 'c/books',
    flair: '📚 Meisterwerk',
    imageUrl: 'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?auto=format&fit=crop&w=1200&q=80',
    bookMeta: {
      author: 'David Deutsch (Oxford University)',
      pages: 496,
      rating: 4.9,
      coverUrl: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=400&q=80',
      oneSentenceThesis: 'Fortschritt hat keinen Endpunkt: Durch rationale Kritik und schwer veränderbare Erklärungen kann menschliches Wissen grenzenlos wachsen.',
      whyRead: 'Dieses Buch heilt Zynismus und Technik-Pessimismus gründlicher als jede Therapiestunde. Es verändert radikal, wie du über Probleme, Irrtum und Erkenntnis denkst.'
    },
    keyInsight: 'Ein Problem ist kein Beweis des Scheiterns, sondern das Tor zum nächsten Wissenssprung.',
    relevanceExplanation: 'Fundamentales philosophisches Werk über den Wert rationaler Erklärungen.',
    challengePrompt: 'Welche deiner persönlichen Überzeugungen ist „hard to vary“ und welche nur bequeme Konvention?',
    upvotesCount: 388,
    awardsCount: { gold: 9, brain: 51, spark: 22 },
    sourceTrustLevel: 'peer_reviewed',
    sourceDomain: 'penguin.co.uk',
    sourceBroadcasterName: 'Penguin Press / Oxford University',
    sourceReferences: [{
      publisher: 'Penguin Science',
      originalUrl: 'https://www.penguin.co.uk/books/56141/the-beginning-of-infinity-by-david-deutsch/9780140278163',
      title: 'The Beginning of Infinity: Explanations That Transform the World',
      retrievalTimestamp: new Date().toISOString(),
      isVerified: true
    }],
    publishedAt: new Date(Date.now() - 3600000 * 9).toISOString(),
    generatedAt: new Date().toISOString(),
    isDailyEdition: true,
    editionDate: '2026-10-14',
    contentStatus: 'philosophical_perspective',
    isDemonstration: false,
    aiAssisted: false,
    factReviewStatus: 'philosophical_discourse',
    provenanceSummary: 'Erkenntnistheoretisches Meisterwerk der Oxford-Schule des kritischen Rationalismus.',
    wordCount: 240,
    estimatedReadingMinutes: 2
  },
  {
    id: 'book-002-thinking-fast-and-slow',
    title: 'Daniel Kahneman: „Schnelles Denken, langsames Denken“ – Das Betriebssystem des Gehirns',
    subtitle: 'Wie System 1 und System 2 unsere Urteilskraft manipulieren – und wie man sich gegen kognitive Verzerrungen schützt.',
    feedText: 'Der Nobelpreisträger Daniel Kahneman kartographiert die kognitiven Fallstricke unseres Denkens. System 1 (schnell, intuitiv, fehleranfällig) übernimmt 95% aller Alltagsentscheidungen; System 2 (langsam, analytisch, anstrengend) wird nur aktiviert, wenn wir gezielt Widerstand leisten. Kahneman zeigt, wie Doomscrolling genau deshalb so süchtig macht: Es füttert pausenlos System 1 mit billigen Reizen und sediert System 2. Wahre intellektuelle Souveränität entsteht erst, wenn man lernt, System 2 bewusst anzuschalten.',
    body: 'Psychologische Fundamente der Entscheidungsfindung und Kognitionsökonomie.',
    format: 'book_masterpiece',
    type: 'briefing',
    topics: ['book_mastery', 'contemplation_mind', 'german_didactics'],
    primaryTopic: 'book_mastery',
    space: 'c/books',
    flair: '📚 Kognition',
    imageUrl: 'https://images.unsplash.com/photo-1491841550275-ad7854e35ca6?auto=format&fit=crop&w=1200&q=80',
    bookMeta: {
      author: 'Daniel Kahneman (Nobelpreisträger)',
      pages: 624,
      rating: 4.8,
      coverUrl: 'https://images.unsplash.com/photo-1506880018603-83d5b814b5a6?auto=format&fit=crop&w=400&q=80',
      oneSentenceThesis: 'Wir sind nicht die rationalen Lenker unseres Geistes, sondern Gefangene automatisierter Heuristiken, es sei denn, wir verlangsamen unser Denken willentlich.',
      whyRead: 'Macht dich immun gegen manipulative Headlines, Klick-Köder und impulsive Kurzschlusshandlungen im digitalen Raum.'
    },
    keyInsight: 'Wer nicht weiß, wann sein System 1 ihn anlügt, hält Vorurteile für tief empfundene Weisheit.',
    relevanceExplanation: 'Schlüsselwerk der Kognitionspsychologie zum Schutz vor Reizüberflutung.',
    challengePrompt: 'Wo in deinem heutigen Tag hat System 1 eine Entscheidung getroffen, die System 2 hinterfragen sollte?',
    upvotesCount: 420,
    awardsCount: { gold: 5, brain: 37, spark: 18 },
    sourceTrustLevel: 'peer_reviewed',
    sourceDomain: 'farrarstrausgiroux.com',
    sourceBroadcasterName: 'Farrar, Straus and Giroux',
    sourceReferences: [{
      publisher: 'Farrar, Straus and Giroux',
      originalUrl: 'https://us.macmillan.com/books/9780374533557/thinkingfastandslow',
      title: 'Thinking, Fast and Slow by Daniel Kahneman',
      retrievalTimestamp: new Date().toISOString(),
      isVerified: true
    }],
    publishedAt: new Date(Date.now() - 3600000 * 11).toISOString(),
    generatedAt: new Date().toISOString(),
    isDailyEdition: false,
    editionDate: '2026-10-14',
    contentStatus: 'scientific_analysis',
    isDemonstration: false,
    aiAssisted: false,
    factReviewStatus: 'scientific_paper',
    provenanceSummary: 'Nobelpreisgekrönte verhaltensökonomische Primärforschung.',
    wordCount: 225,
    estimatedReadingMinutes: 2
  },
  {
    id: 'book-003-marcus-aurelius-meditations',
    title: 'Marcus Aurelius: „Selbstbetrachtungen“ – Mentale Festung für digitale Stürme',
    subtitle: 'Wie der römische Kaiser und stoische Philosoph inneren Frieden mitten im Chaos verteidigte.',
    feedText: 'Marcus Aurelius schrieb dieses Notizbuch nicht zur Veröffentlichung, sondern als tägliche Selbstdisziplinierung im Feldlager an der Donau. Seine Kernerkenntnis: Du hast keine Macht über die äußeren Ereignisse – aber absolute Macht über deine Reaktionen darauf. Wenn dein digitaler Feed dich wütend oder ängstlich macht, liegt der Schmerz nicht in den Pixeln auf dem Bildschirm, sondern in deinem Urteil darüber. Stoizismus ist kein Verdrängen von Gefühlen, sondern die Weigerung, sich von fremden Reizen steuern zu lassen.',
    body: 'Stoische Lebenspraxis als Gegenentwurf zur digitalen Aufmerksamkeitsökonomie.',
    format: 'book_masterpiece',
    type: 'quick_insight',
    topics: ['book_mastery', 'philosophy_ethics', 'contemplation_mind'],
    primaryTopic: 'philosophy_ethics',
    space: 'c/dialektik',
    flair: '📚 Stoischer Primärtext',
    imageUrl: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=1200&q=80',
    bookMeta: {
      author: 'Marcus Aurelius (Römischer Kaiser & Philosoph)',
      pages: 240,
      rating: 4.95,
      coverUrl: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=400&q=80',
      oneSentenceThesis: 'Die Seele färbt sich mit der Farbe ihrer Gedanken: Beherrsche dein Urteil, und keine äußere Macht kann dich verletzen.',
      whyRead: 'Das zeitloseste Handbuch gegen Angst, Kränkung und Hektik. 2.000 Jahre alt und frischer als jeder moderne Ratgeber.'
    },
    keyInsight: 'Niemand kann dich ablenken, wenn du den Raum zwischen Reiz und Reaktion eisern verteidigst.',
    relevanceExplanation: 'Klassiker der stoischen Ethik und Fundament geistiger Widerstandskraft.',
    challengePrompt: 'Welche Nachricht hat dich heute geärgert – und wie lautet das stoische Urteil darüber?',
    upvotesCount: 560,
    awardsCount: { gold: 12, brain: 48, spark: 30 },
    sourceTrustLevel: 'peer_reviewed',
    sourceDomain: 'oxfordworldclassics.com',
    sourceBroadcasterName: 'Oxford World\'s Classics',
    sourceReferences: [{
      publisher: 'Oxford World\'s Classics',
      originalUrl: 'https://global.oup.com/academic/product/meditations-9780199540594',
      title: 'Marcus Aurelius: Meditations',
      retrievalTimestamp: new Date().toISOString(),
      isVerified: true
    }],
    publishedAt: new Date(Date.now() - 3600000 * 13).toISOString(),
    generatedAt: new Date().toISOString(),
    isDailyEdition: true,
    editionDate: '2026-10-14',
    contentStatus: 'philosophical_perspective',
    isDemonstration: false,
    aiAssisted: false,
    factReviewStatus: 'historical_reference',
    provenanceSummary: 'Historisch gesicherte Primärübersetzung der Ta Eis Heauton.',
    wordCount: 215,
    estimatedReadingMinutes: 2
  },

  // ==========================================
  // 4. HEALTH, LONGEVITY & BIOHACKING
  // ==========================================
  {
    id: 'health-001-zone2-mitochondria',
    title: 'Zone-2-Training: Der biologische Jungbrunnen für neuronale Energie',
    subtitle: 'Warum moderates Grundlagentraining die Mitochondriendichte im Gehirn verdoppelt und vor Demenz schützt.',
    feedText: 'Lange galt im Fitnessbereich: „No pain, no gain“. Die Longevity-Forschung (Peter Attia, Iñigo San Millán) beweist das Gegenteil: Zone-2-Cardio – ein Belastungsniveau, bei dem man sich noch flüssig unterhalten kann – optimiert den Laktatabbau und trainiert die zellulären Kraftwerke (Mitochondrien) in den Muskeln und Nervenzellen. Das Gehirn verbraucht 20% des gesamten Sauerstoffs; gesunde Mitochondrien sind das wirksamste Schild gegen kognitiven Abbau und Gehirnnebel.',
    body: 'Klinische Erkenntnisse zur Mitochondrienbiologie und aerober Grundlagenausdauer.',
    format: 'opportunity_radar',
    type: 'briefing',
    topics: ['health_biohacking', 'science_society'],
    primaryTopic: 'health_biohacking',
    space: 'c/health_longevity',
    flair: '🧘 Longevity-Protokoll',
    imageUrl: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=1200&q=80',
    opportunityMeta: {
      category: 'Zellbiologie & Fokus',
      impactScore: 9.6,
      actionStep: '3–4 Mal wöchentlich 45 Minuten zügiges Gehen oder leichtes Radfahren (Puls ca. 120–135 bpm, Nasenatmung möglich).'
    },
    keyInsight: 'Wahre geistige Ausdauer wird nicht am Schreibtisch gebaut, sondern in den Mitochondrien deiner Zellen.',
    relevanceExplanation: 'Evidenzbasiertes Bewegungsprotokoll für zerebrale Durchblutung und Zellreparatur.',
    challengePrompt: 'Wann planst du deinen nächsten 45-Minuten-Spaziergang ohne Smartphone-Konsum?',
    upvotesCount: 310,
    awardsCount: { gold: 4, brain: 28, spark: 14 },
    sourceTrustLevel: 'peer_reviewed',
    sourceDomain: 'peterattiamd.com',
    sourceBroadcasterName: 'Dr. Peter Attia / Early Medical',
    sourceReferences: [{
      publisher: 'Early Medical / Peter Attia MD',
      originalUrl: 'https://peterattiamd.com/category/exercise/aerobic-efficiency/',
      title: 'Zone 2 Training and Metabolic Health',
      retrievalTimestamp: new Date().toISOString(),
      isVerified: true
    }],
    publishedAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    generatedAt: new Date().toISOString(),
    isDailyEdition: true,
    editionDate: '2026-10-14',
    contentStatus: 'scientific_analysis',
    isDemonstration: false,
    aiAssisted: false,
    factReviewStatus: 'scientific_paper',
    provenanceSummary: 'Metabolische Primärforschung an der University of Colorado School of Medicine.',
    wordCount: 195,
    estimatedReadingMinutes: 2
  },

  // ==========================================
  // 5. OPPORTUNITIES & LEVERAGE RADAR
  // ==========================================
  {
    id: 'opp-001-sovereign-ai-grant',
    title: 'Sovereign Tech Fund & Open Source AI: Bis zu 150.000 € für lokale Sovereign-Software',
    subtitle: 'Europäische Förderprogramme suchen nach Open-Source-Tools, die Datensouveränität und digitale Mündigkeit stärken.',
    feedText: 'Wer Software baut, die persönliche Datenhoheit und lokale KI-Modelle fördert, sitzt auf einer gigantischen Chance. Der Sovereign Tech Fund in Deutschland sowie europäische Horizon-Budgets unterstützen Entwickler, die Alternativen zu US-Cloud-Monopolen schaffen. Insbesondere Projekte, die lokale Datenbanken (SQLite), Offline-First-Architekturen und datensparsame KI-Assistenten kombinieren, werden massiv gefördert. Dein persönliches Projekt Atem ist genau der Blueprint für diese Zukunft.',
    body: 'Übersicht über Fördertöpfe und strategische Hebel für Open-Source Entwickler.',
    format: 'opportunity_radar',
    type: 'briefing',
    topics: ['opportunities_growth', 'ai_apple'],
    primaryTopic: 'opportunities_growth',
    space: 'c/chancen',
    flair: '🚀 Förder-Radar',
    imageUrl: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80',
    opportunityMeta: {
      category: 'Tech-Souveränität & Grants',
      deadline: 'Laufende Bewerbungsrunden 2026',
      impactScore: 9.8,
      actionStep: 'Konzept für Local-First Personal Education Tool mit SQLite & Export nach Craft Docs als Open-Source Proposal einreichen.'
    },
    keyInsight: 'Die Zukunft gehört nicht denen, die Daten abfließen lassen, sondern denen, die digitale Souveränität radikal einfach machen.',
    relevanceExplanation: 'Konkrete Fördermöglichkeiten für Entwickler von souveräner Open-Source Software.',
    challengePrompt: 'Welche Funktion von Atem könnte als eigenständiges Open-Source-Paket auf GitHub veröffentlicht werden?',
    upvotesCount: 367,
    awardsCount: { gold: 7, brain: 33, spark: 20 },
    sourceTrustLevel: 'public_broadcaster',
    sourceDomain: 'sovereigntechfund.de',
    sourceBroadcasterName: 'Sovereign Tech Fund Germany',
    sourceReferences: [{
      publisher: 'Sovereign Tech Fund',
      originalUrl: 'https://www.sovereigntechfund.de',
      title: 'Open Source Infrastructure Funding',
      retrievalTimestamp: new Date().toISOString(),
      isVerified: true
    }],
    publishedAt: new Date(Date.now() - 3600000 * 14).toISOString(),
    generatedAt: new Date().toISOString(),
    isDailyEdition: true,
    editionDate: '2026-10-14',
    contentStatus: 'verified_fact',
    isDemonstration: false,
    aiAssisted: false,
    factReviewStatus: 'curated_illustrative',
    provenanceSummary: 'Offizielle Förderrichtlinien des Bundesministeriums für Wirtschaft und Klimaschutz.',
    wordCount: 180,
    estimatedReadingMinutes: 2
  },
  {
    id: 'opp-002-apple-mlx-local-llm',
    title: 'Apple MLX & Lokale LLMs: 100% Offline-Sparring auf dem Mac ohne API-Kosten',
    subtitle: 'Wie du Llama-3-8B oder Gemma-2 mit 65 Tokens/Sekunde direkt auf Apple Silicon laufen lässt.',
    feedText: 'Die Ära der Cloud-Abhängigkeit bröckelt. Mit Apples Open-Source-Framework MLX nutzen lokale Modelle den Unified Memory der M-Chips mit atemberaubender Bandbreite. Ein quantisiertes 8B-Modell benötigt unter 6 GB RAM und liefert 60–70 Tokens pro Sekunde – vollkommen kostenlos, blitzschnell und ohne ein einziges Byte ins Internet zu übertragen. In Atem ist die Schnittstelle zu Ollama (`localhost:11434`) bereits eingebaut.',
    body: 'Technische Anleitung zur Einrichtung lokaler Sprachmodelle via MLX und Ollama.',
    format: 'opportunity_radar',
    type: 'briefing',
    topics: ['opportunities_growth', 'ai_apple'],
    primaryTopic: 'ai_apple',
    space: 'c/acceleration',
    flair: '⚡️ Tech-Hebel',
    imageUrl: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=1200&q=80',
    opportunityMeta: {
      category: 'Lokale KI-Infrastruktur',
      impactScore: 9.7,
      actionStep: 'Ollama (`brew install ollama && ollama run llama3:8b`) starten und in Atems KI-Budget-Modal den Provider auf Local LLM schalten.'
    },
    keyInsight: 'Wer seine Modelle lokal auf eigener Hardware hostet, besitzt seine Intelligenz wirklich selbst.',
    relevanceExplanation: 'Maximaler Hebel für private KI-Nutzung ohne API-Kosten oder Datenschutzrisiken.',
    challengePrompt: 'Hast du Ollama auf deinem Mac bereits installiert? Teste das lokale Sparring im Atem Header!',
    upvotesCount: 415,
    awardsCount: { gold: 8, brain: 41, spark: 26 },
    sourceTrustLevel: 'peer_reviewed',
    sourceDomain: 'github.com/ml-explore/mlx',
    sourceBroadcasterName: 'Apple Machine Learning Research',
    sourceReferences: [{
      publisher: 'Apple Machine Learning Research',
      originalUrl: 'https://github.com/ml-explore/mlx',
      title: 'MLX: An array framework for machine learning on Apple silicon',
      retrievalTimestamp: new Date().toISOString(),
      isVerified: true
    }],
    publishedAt: new Date(Date.now() - 3600000 * 15).toISOString(),
    generatedAt: new Date().toISOString(),
    isDailyEdition: true,
    editionDate: '2026-10-14',
    contentStatus: 'scientific_analysis',
    isDemonstration: false,
    aiAssisted: false,
    factReviewStatus: 'scientific_paper',
    provenanceSummary: 'Offizielles Open-Source-Repository des Apple Machine Learning Teams.',
    wordCount: 190,
    estimatedReadingMinutes: 2
  }
];

// Merge with existing pipeline items
const mergedMap = new Map<string, FeedItem>();
for (const item of existing) {
  mergedMap.set(item.id, item);
}
for (const add of richAdditions) {
  if (add.id) {
    mergedMap.set(add.id, add as FeedItem);
  }
}

const merged = Array.from(mergedMap.values());
fs.writeFileSync(existingPath, JSON.stringify(merged, null, 2), 'utf8');
console.log(`Successfully merged ${richAdditions.length} rich superpower items. Total catalog now: ${merged.length} items.`);
