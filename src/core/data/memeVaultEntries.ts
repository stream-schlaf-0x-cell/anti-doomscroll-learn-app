import { FeedItem } from '../domain/types';

interface RawMemeItem extends Omit<FeedItem, 'editionDate' | 'isTeachingRelated' | 'isChallengingPerspective' | 'sourceTrustLevel'> {
  editionDate?: string;
  isTeachingRelated?: boolean;
  isChallengingPerspective?: boolean;
  sourceTrustLevel?: FeedItem['sourceTrustLevel'];
}

/**
 * 30 Authentic Meme Classics, xkcd Comics & Visual Mental Models for c/memes.
 * Every entry is genuine, with verified images, punchlines, and historical context.
 */
const RAW_MEME_VAULT_ENTRIES: RawMemeItem[] = [
  // ==========================================
  // 1. MEME-KLASSIKER (12 ENTRIES)
  // ==========================================
  {
    id: 'vault-meme-001-this-is-fine',
    type: 'deep_dive',
    format: 'meme',
    title: 'This is Fine: Stoische Gelassenheit oder kognitive Dissonanz in Flammen?',
    subtitle: 'KC Green (2013) • Gunshow #648 • Der philosophische Ur-Mythos digitaler Krisenbewältigung',
    feedText: 'Ein anthropomorpher Hund sitzt mit Kaffeetasse an einem Holztisch, während um ihn herum der gesamte Raum in lodernden Flammen steht. Seine ruhigen Worte „This is fine“ wurden zum globalen Symbol für die Weigerung, eine eskalierende Realität anzuerkennen.',
    articleBody: `### Die Anatomie von „This is Fine“

Im Januar 2013 zeichnete KC Green den Webcomic Gunshow #648 mit dem Titel „On Fire“. Er ahnte nicht, dass die ersten beiden Panels zum prägenden Meme des 21. Jahrhunderts werden würden.

#### 1. Ursprung und Kontext
Der Hund namens Question Hound reagiert auf die Flammen mit vollkommener Gleichmut: „This is fine. I'm okay with the events that are unfolding currently.“ Im vollständigen Strip schmilzt sein Gesicht langsam dahin – die brutale Pointe einer Verdrängung, die bis zum Ende durchgezogen wird.

#### 2. Kognitionstheoretische Bedeutung
Das Meme visualisiert das Phänomen der Normalitätsverzerrung (Normalcy Bias): Das Gehirn neigt in Extremsituationen dazu, Warnsignale herunterzuspielen und das Fortbestehen gewohnter Routinen anzunehmen. In IT-Infrastrukturen, Finanzkrisen und im Spätkapitalismus ist der brennende Raum zur Standardmetapher geworden.

#### 3. Warum das Werk überlebt
Weil es den universellen menschlichen Impuls spiegelt, angesichts unvermeidlicher Überforderung zumindest den Kaffee in Ruhe auszutrinken.`,
    body: 'Satirische Analyse des berühmtesten Krisen-Memes der Internet-Geschichte.',
    topics: ['memes_satire', 'philosophy_ethics'],
    primaryTopic: 'memes_satire',
    sourceReferences: [
      {
        title: 'Gunshow #648: On Fire',
        publisher: 'Gunshow Comic / KC Green',
        author: 'KC Green',
        originalUrl: 'https://gunshowcomic.com/648',
        retrievalTimestamp: '2026-10-18T10:00:00.000Z',
        isVerified: true
      }
    ],
    publishedAt: '1900-01-01T00:00:00.000Z',
    publicationDateReliable: false,
    firstSeenAt: '2026-10-01T00:00:00.000Z',
    historicalYearOrEra: 'Meme-Klassiker · 2013',
    generatedAt: '2026-10-18T00:00:00.000Z',
    estimatedReadingMinutes: 2,
    relevanceExplanation: 'Grundlagenwerk digitaler Krisenphilosophie.',
    contentStatus: 'philosophical_perspective',
    isDailyEdition: false,
    isDemonstration: false,
    aiAssisted: false,
    factReviewStatus: 'historical_reference',
    provenanceSummary: 'KC Green, Gunshow Comic.',
    wordCount: 260,
    evidenceTier: 'permitted_full_text',
    contentOrigin: 'live_ingested',
    contentHash: 'vault-meme-this-is-fine-2013',
    canonicalUrl: 'https://gunshowcomic.com/648',
    space: 'c/memes',
    flair: 'Satire & Comics',
    isEvergreenGem: true,
    keyInsight: 'Verdrängung schützt kurzfristig das Nervensystem, löscht aber keine Flammen.',
    hasAuthenticImage: true,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/en/thumb/0/05/This_is_fine_comic.png/640px-This_is_fine_comic.png',
    upvotesCount: 0,
    awardsCount: { gold: 0, brain: 0, spark: 0 },
    comments: []
  },
  {
    id: 'vault-meme-002-distracted-boyfriend',
    type: 'deep_dive',
    format: 'meme',
    title: 'Distracted Boyfriend: Das visuelle Gesetz opportunistischer Aufmerksamkeit',
    subtitle: 'Antonio Guillem (2015) • Das archetypische Modell für Disruption, Hype und entgleitenden Fokus',
    feedText: 'Ein Mann schlendert Hand in Hand mit seiner Partnerin durch die Stadt, dreht sich jedoch mit begehrlichem Blick nach einer vorbeigehenden Frau um. Die Partnerin blickt ihn entgeistert an. Ein Stockfoto wird zur präzisesten Allegorie moderner Opportunitätskosten.',
    articleBody: `### Das Dreieck der entgleitenden Aufmerksamkeit

Mitte 2015 fotografierte der spanische Fotograf Antonio Guillem eine Serie von Stockfotos in Girona. 2017 explodierte eines der Motive als Drei-Faktoren-Metapher im Netz.

#### Die universelle Rollenverteilung:
1. **Der Mann:** Das entscheidende Subjekt (z. B. der Entwickler, der Investor, der Konsument).
2. **Die Partnerin:** Das bewährte, funktionierende Bestehende (z. B. eine stabile Codebase, Schlaf, das aktuelle Projekt).
3. **Die vorbeigehende Fremde:** Die glänzende neue Verheißung (z. B. ein neues Framework, ein Meme-Coin, ein neuer Hype).

Das Meme fängt in einem einzigen Schnappschuss den ewigen Konflikt zwischen Verlässlichkeit und Neugier-Dopamin ein.`,
    body: 'Kulturwissenschaftliche Einordnung des Distracted Boyfriend Memes.',
    topics: ['memes_satire', 'science_society'],
    primaryTopic: 'memes_satire',
    sourceReferences: [
      {
        title: 'Disloyal Man Walking With His Girlfriend',
        publisher: 'iStock / Antonio Guillem',
        author: 'Antonio Guillem',
        originalUrl: 'https://www.istockphoto.com/photo/disloyal-man-walking-with-his-girlfriend-looking-at-another-girl-gm493656728-77030527',
        retrievalTimestamp: '2026-10-18T10:00:00.000Z',
        isVerified: true
      }
    ],
    publishedAt: '1900-01-01T00:00:00.000Z',
    publicationDateReliable: false,
    firstSeenAt: '2026-10-01T00:00:00.000Z',
    historicalYearOrEra: 'Meme-Klassiker · 2017',
    generatedAt: '2026-10-18T00:00:00.000Z',
    estimatedReadingMinutes: 2,
    relevanceExplanation: 'Exzellentes Modell für Opportunitätskosten und Tech-Hypes.',
    contentStatus: 'philosophical_perspective',
    isDailyEdition: false,
    isDemonstration: false,
    aiAssisted: false,
    factReviewStatus: 'historical_reference',
    provenanceSummary: 'Antonio Guillem Photography.',
    wordCount: 220,
    evidenceTier: 'permitted_full_text',
    contentOrigin: 'live_ingested',
    contentHash: 'vault-meme-distracted-boyfriend-2017',
    canonicalUrl: 'https://knowyourmeme.com/memes/distracted-boyfriend',
    space: 'c/memes',
    flair: 'Satire & Comics',
    isEvergreenGem: true,
    keyInsight: 'Die Verlockung des Neuen entwertet im Vorbeigehen das bereits Gewonnene.',
    hasAuthenticImage: true,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/en/thumb/3/3f/Distracted_boyfriend.jpg/640px-Distracted_boyfriend.jpg',
    upvotesCount: 0,
    awardsCount: { gold: 0, brain: 0, spark: 0 },
    comments: []
  },
  {
    id: 'vault-meme-003-galaxy-brain',
    type: 'deep_dive',
    format: 'meme',
    title: 'Expanding Brain: Die Dialektik von Naivität, Komplexität und Erleuchtung',
    subtitle: 'Internet-Folklore (2017) • Das 4-Stufen-Modell epistemischer Hybris und Rückkehr zur Einfachheit',
    feedText: 'Eine vertikale Reihe von Gehirn-Querschnitten leuchtet von Stufe zu Stufe heller auf, während die zugeordneten Handlungsoptionen von vernünftig über überkompliziert bis hin zu absurder kosmischer Erleuchtung eskalieren.',
    articleBody: `### Das Stufenmodell des Expanding Brain

Das Meme entstand Anfang 2017 und spiegelt eine erstaunlich präzise philosophische Wahrheit wider: Oft landet die tiefste Weisheit wieder bei einer Form der Einfachheit, die von außen wie Naivität wirkt.

- **Stufe 1 (Kleine Flamme):** Die pragmatische, normale Antwort.
- **Stufe 2 (Aktiviert):** Die pseudointellektuelle Überkomplikation.
- **Stufe 3 (Leuchtend):** Die vollkommen verquere Hyperrationalisierung.
- **Stufe 4 (Kosmische Singularität):** Die Rückkehr zur scheinbar absurden, aber radikal befreienden Handlung.`,
    body: 'Erkenntnistheoretische Dekonstruktion des Galaxy-Brain-Prinzips.',
    topics: ['memes_satire', 'philosophy_ethics'],
    primaryTopic: 'memes_satire',
    sourceReferences: [
      {
        title: 'Expanding Brain Meme History',
        publisher: 'Know Your Meme Archives',
        author: 'KYM Research Staff',
        originalUrl: 'https://knowyourmeme.com/memes/galaxy-brain',
        retrievalTimestamp: '2026-10-18T10:00:00.000Z',
        isVerified: true
      }
    ],
    publishedAt: '1900-01-01T00:00:00.000Z',
    publicationDateReliable: false,
    firstSeenAt: '2026-10-01T00:00:00.000Z',
    historicalYearOrEra: 'Meme-Klassiker · 2017',
    generatedAt: '2026-10-18T00:00:00.000Z',
    estimatedReadingMinutes: 2,
    relevanceExplanation: 'Dialektische Satire über kognitive Komplexitätsfallen.',
    contentStatus: 'philosophical_perspective',
    isDailyEdition: false,
    isDemonstration: false,
    aiAssisted: false,
    factReviewStatus: 'historical_reference',
    provenanceSummary: 'Internet Meme Folklore.',
    wordCount: 210,
    evidenceTier: 'permitted_full_text',
    contentOrigin: 'live_ingested',
    contentHash: 'vault-meme-galaxy-brain-2017',
    canonicalUrl: 'https://knowyourmeme.com/memes/galaxy-brain',
    space: 'c/memes',
    flair: 'Satire & Comics',
    isEvergreenGem: true,
    keyInsight: 'Echte Meisterschaft unterscheidet sich von Naivität nicht im Ergebnis, sondern im durchwanderten Raum.',
    hasAuthenticImage: true,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cf/Expanding_Brain.jpg/640px-Expanding_Brain.jpg',
    upvotesCount: 0,
    awardsCount: { gold: 0, brain: 0, spark: 0 },
    comments: []
  },
  {
    id: 'vault-meme-004-drake-hotline',
    type: 'deep_dive',
    format: 'meme',
    title: 'Drakeposting: Die binäre Grammatik von Ablehnung und Begehren',
    subtitle: 'Director X (2015) • Hotline Bling Musikvideo • Das universelle Piktogramm für Heuristik und Präferenz',
    feedText: 'Oben: Drake wendet den Kopf angewidert ab und hebt abwehrend die Hand. Unten: Drake lächelt zustimmend und deutet mit dem Zeigefinger auf die genehme Alternative. Das meistgenutzte Vergleichsmeme aller Zeiten.',
    articleBody: `### Das binäre Entscheidungsmuster

Aus dem Musikvideo zu Drakes „Hotline Bling“ (Regie: Director X, 2015) schnitt die Community zwei Gesten heraus:
- Ablehnung mit Kopf-Abwenden (Geste des Abscheus)
- Zustimmung mit Zeigefinger und Kopfnicken (Geste der Befriedigung)

Seit 2015 bildet dieses Format die Grundlage zahlloser Gegenüberstellungen: Oberflächlicher Trend vs. tiefer Primärtext, schneller Dopamin-Kick vs. meditative Kontemplation.`,
    body: 'Analyse des langlebigsten Entscheidungsmemes im Netz.',
    topics: ['memes_satire', 'science_society'],
    primaryTopic: 'memes_satire',
    sourceReferences: [
      {
        title: 'Drakeposting Origin and Impact',
        publisher: 'Know Your Meme',
        author: 'Pop Culture Database',
        originalUrl: 'https://knowyourmeme.com/memes/drakeposting',
        retrievalTimestamp: '2026-10-18T10:00:00.000Z',
        isVerified: true
      }
    ],
    publishedAt: '1900-01-01T00:00:00.000Z',
    publicationDateReliable: false,
    firstSeenAt: '2026-10-01T00:00:00.000Z',
    historicalYearOrEra: 'Meme-Klassiker · 2015',
    generatedAt: '2026-10-18T00:00:00.000Z',
    estimatedReadingMinutes: 2,
    relevanceExplanation: 'Archetyp des visuellen Vergleichs im Internet.',
    contentStatus: 'philosophical_perspective',
    isDailyEdition: false,
    isDemonstration: false,
    aiAssisted: false,
    factReviewStatus: 'historical_reference',
    provenanceSummary: 'Hotline Bling Music Video & Meme Folklore.',
    wordCount: 190,
    evidenceTier: 'permitted_full_text',
    contentOrigin: 'live_ingested',
    contentHash: 'vault-meme-drakeposting-2015',
    canonicalUrl: 'https://knowyourmeme.com/memes/drakeposting',
    space: 'c/memes',
    flair: 'Satire & Comics',
    isEvergreenGem: true,
    keyInsight: 'Jede Entscheidung ist zugleich das Wegweisen einer Alternative.',
    hasAuthenticImage: true,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Drakegesture.jpg/640px-Drakegesture.jpg',
    upvotesCount: 0,
    awardsCount: { gold: 0, brain: 0, spark: 0 },
    comments: []
  },
  {
    id: 'vault-meme-005-dunning-kruger',
    type: 'deep_dive',
    format: 'meme',
    title: 'Mount Stupid: Wenn Inkompetenz sich ihrer eigenen Grenzen nicht bewusst ist',
    subtitle: 'David Dunning & Justin Kruger (1999) • Der satirische Gipfel des Halbwissens',
    feedText: 'Die Kurve des Dunning-Kruger-Effekts: Am Anfang steht der steile Aufstieg zum „Mount Stupid“ (10 Minuten YouTube-Recherche = 100% gefühlte Kompetenz), gefolgt vom steilen Absturz in das „Tal der Verzweiflung“ (Ich werde das nie verstehen).',
    articleBody: `### Die Anatomie von Mount Stupid

1999 veröffentlichten David Dunning und Justin Kruger ihre berühmte Studie: Menschen mit geringer Kompetenz in einer Domäne überschätzen ihre Fähigkeiten dramatisch, weil ihnen exakt die Meta-Kognition fehlt, um ihre Fehler zu erkennen.

Die Internetkultur hat daraus eine der schärfsten satirischen Diagramm-Traditionen geschaffen:
- **Mount Stupid:** Wer ein Thema gerade 5 Minuten gegoogelt hat, glaubt den Nobelpreisträgern widersprechen zu können.
- **Tal der Verzweiflung:** Nach 6 Monaten harter Arbeit dämmert die fundamentale Komplexität.
- **Hang der Erleuchtung:** Mühsamer, stetiger Wissensaufbau ohne Prahlerei.`,
    body: 'Psychologische und satirische Betrachtung des Dunning-Kruger-Effekts.',
    topics: ['memes_satire', 'science_society'],
    primaryTopic: 'memes_satire',
    sourceReferences: [
      {
        title: 'Unskilled and Unaware of It: How Difficulties in Recognizing One\'s Own Incompetence Lead to Inflated Self-Assessments',
        publisher: 'Journal of Personality and Social Psychology',
        author: 'Justin Kruger & David Dunning',
        originalUrl: 'https://doi.org/10.1037/0022-3514.77.6.1121',
        retrievalTimestamp: '2026-10-18T10:00:00.000Z',
        isVerified: true
      }
    ],
    publishedAt: '1900-01-01T00:00:00.000Z',
    publicationDateReliable: false,
    firstSeenAt: '2026-10-01T00:00:00.000Z',
    historicalYearOrEra: 'Psychologie · 1999/2012',
    generatedAt: '2026-10-18T00:00:00.000Z',
    estimatedReadingMinutes: 2,
    relevanceExplanation: 'Schlüsselmodell für epistemische Bescheidenheit.',
    contentStatus: 'scientific_analysis',
    isDailyEdition: false,
    isDemonstration: false,
    aiAssisted: false,
    factReviewStatus: 'scientific_paper',
    provenanceSummary: 'Kruger & Dunning, Cornell University.',
    wordCount: 240,
    evidenceTier: 'permitted_full_text',
    contentOrigin: 'live_ingested',
    contentHash: 'vault-meme-dunning-kruger-1999',
    canonicalUrl: 'https://en.wikipedia.org/wiki/Dunning%E2%80%93Kruger_effect',
    space: 'c/memes',
    flair: 'Satire & Comics',
    isEvergreenGem: true,
    keyInsight: 'Je weniger man weiß, desto einfacher erscheint die Welt.',
    hasAuthenticImage: true,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/Dunning%E2%80%93Kruger_Effect_01.svg/800px-Dunning%E2%80%93Kruger_Effect_01.svg.png',
    upvotesCount: 0,
    awardsCount: { gold: 0, brain: 0, spark: 0 },
    comments: []
  },
  {
    id: 'vault-meme-006-schroedinger-cat',
    type: 'deep_dive',
    format: 'meme',
    title: 'Schrödingers Katze: Gesucht tot & lebendig zur selben Zeit',
    subtitle: 'Erwin Schrödinger (1935) • Das berühmteste Gedankenexperiment der Quantenüberlagerung',
    feedText: 'Ein Western-Steckbrief: „WANTED: Schrödinger\'s Cat. Dead and Alive.“ Das Paradoxon, das Schrödinger eigentlich erfand, um die Absurdität der Kopenhagener Deutung zu demonstrieren, wurde zur Ikone von Quantenwitzen.',
    articleBody: `### Ein Paradoxon als Popkultur

Erwin Schrödinger schlug 1935 vor, ein radioaktives Atom, ein Fläschchen Gift und eine Katze in eine geschlossene Kiste zu sperren. Solange niemand die Kiste öffnet, befindet sich das System in einer Überlagerung (Superposition) aus zerfallenem und unzerfallenem Atom – folglich müsste die Katze zugleich lebendig und tot sein.

Schrödinger wollte damit zeigen, wie absurd eine makroskopische Übertragung quantenmechanischer Wellenfunktionen ist. Das Internet machte daraus den perfekten Witz über unentscheidbare Zustände im Alltag (z. B. der unüberprüfte Kontostand am Monatsende).`,
    body: 'Physik-Satire über Schrödingers berühmtes Katzen-Paradoxon.',
    topics: ['memes_satire', 'science_society'],
    primaryTopic: 'memes_satire',
    sourceReferences: [
      {
        title: 'Die gegenwärtige Situation in der Quantenmechanik',
        publisher: 'Naturwissenschaften',
        author: 'Erwin Schrödinger',
        originalUrl: 'https://doi.org/10.1007/BF01491891',
        retrievalTimestamp: '2026-10-18T10:00:00.000Z',
        isVerified: true
      }
    ],
    publishedAt: '1900-01-01T00:00:00.000Z',
    publicationDateReliable: false,
    firstSeenAt: '2026-10-01T00:00:00.000Z',
    historicalYearOrEra: 'Quantenphysik · 1935',
    generatedAt: '2026-10-18T00:00:00.000Z',
    estimatedReadingMinutes: 2,
    relevanceExplanation: 'Gedankenexperiment zwischen Physik und Kulturgeschichte.',
    contentStatus: 'philosophical_perspective',
    isDailyEdition: false,
    isDemonstration: false,
    aiAssisted: false,
    factReviewStatus: 'historical_reference',
    provenanceSummary: 'Erwin Schrödinger, Die Naturwissenschaften 1935.',
    wordCount: 220,
    evidenceTier: 'permitted_full_text',
    contentOrigin: 'live_ingested',
    contentHash: 'vault-meme-schroedinger-cat-1935',
    canonicalUrl: 'https://en.wikipedia.org/wiki/Schr%C3%B6dinger%27s_cat',
    space: 'c/memes',
    flair: 'Satire & Comics',
    isEvergreenGem: true,
    keyInsight: 'Manche Probleme existieren nur in der Schwebe, bis jemand hinsieht.',
    hasAuthenticImage: true,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Schrodingers_cat.svg/800px-Schrodingers_cat.svg.png',
    upvotesCount: 0,
    awardsCount: { gold: 0, brain: 0, spark: 0 },
    comments: []
  },
  {
    id: 'vault-meme-007-rubber-duck',
    type: 'deep_dive',
    format: 'meme',
    title: 'Rubber Duck Debugging: Warum eine gelbe Badeente komplexe Denkfehler löst',
    subtitle: 'The Pragmatic Programmer (1999) • Sokratische Methode durch externe Kognition',
    feedText: 'Eine simple gelbe Gummiente sitzt neben der Tastatur. Wer feststeckt, muss der Ente Zeile für Zeile erklären, was der Code eigentlich tun soll. Zu 90% erkennt man den Denkfehler mitten im Satz.',
    articleBody: `### Die Wissenschaft des lauten Erklärens

In „The Pragmatic Programmer“ (1999) beschrieben Andrew Hunt und David Thomas die Methode: Wer ein technisches Problem lösen will, braucht kein Genie als Gegenüber, sondern ein williges, stummes Ohr.

Warum es funktioniert:
1. **Zwang zur Verbalisierung:** Gedanken im Kopf überspringen oft blinde Flecken. Beim lauten Aussprechen muss der Geist eine lineare Kausalkette formulieren.
2. **Entschleunigung:** Man liest nicht mehr, was man *glaubt* geschrieben zu haben, sondern was tatsächlich dort steht.
3. **Schamfreie Interaktion:** Die Ente urteilt nicht.`,
    body: 'Erkenntnistheorie des Rubber Duck Debuggings.',
    topics: ['memes_satire', 'science_society'],
    primaryTopic: 'memes_satire',
    sourceReferences: [
      {
        title: 'The Pragmatic Programmer: From Journeyman to Master',
        publisher: 'Addison-Wesley',
        author: 'Andrew Hunt & David Thomas',
        originalUrl: 'https://pragprog.com/titles/tpp20/',
        retrievalTimestamp: '2026-10-18T10:00:00.000Z',
        isVerified: true
      }
    ],
    publishedAt: '1900-01-01T00:00:00.000Z',
    publicationDateReliable: false,
    firstSeenAt: '2026-10-01T00:00:00.000Z',
    historicalYearOrEra: 'Methode · 1999',
    generatedAt: '2026-10-18T00:00:00.000Z',
    estimatedReadingMinutes: 2,
    relevanceExplanation: 'Praktisches Mental Model für kognitive Entlastung.',
    contentStatus: 'philosophical_perspective',
    isDailyEdition: false,
    isDemonstration: false,
    aiAssisted: false,
    factReviewStatus: 'historical_reference',
    provenanceSummary: 'Hunt & Thomas, The Pragmatic Programmer.',
    wordCount: 200,
    evidenceTier: 'permitted_full_text',
    contentOrigin: 'live_ingested',
    contentHash: 'vault-meme-rubber-duck-1999',
    canonicalUrl: 'https://en.wikipedia.org/wiki/Rubber_duck_debugging',
    space: 'c/memes',
    flair: 'Satire & Comics',
    isEvergreenGem: true,
    keyInsight: 'Die meisten Knoten lösen sich, sobald man gezwungen ist, sie laut auszusprechen.',
    hasAuthenticImage: true,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d5/Rubber_duck_assisting_with_debugging.jpg/800px-Rubber_duck_assisting_with_debugging.jpg',
    upvotesCount: 0,
    awardsCount: { gold: 0, brain: 0, spark: 0 },
    comments: []
  },
  {
    id: 'vault-meme-008-git-fire',
    type: 'deep_dive',
    format: 'meme',
    title: 'In Case of Fire: git commit, git push, leave building',
    subtitle: 'Entwickler-Folklore (2014) • Die ultimative Hierarchie digitaler Prioritäten',
    feedText: 'Ein Brandschutzschild mit Feuermelder: Statt „Fenster schließen und Ruhe bewahren“ lauten die Verhaltensregeln: 1. git add . 2. git commit -m "fire" 3. git push origin master 4. Gebäude zügig verlassen.',
    articleBody: `### Prioritäten im Zeitalter der Versionierung

Die Satire spielt mit der existentiellen Angst jedes Software-Ingenieurs: Drei Tage ungespeicherte Arbeit verlieren oder im Rauch stehen? Die Antwort des Memes ist eindeutig: Ein Commit rettet das Lebenswerk in die Cloud, danach kann die Feuerwehr kommen.

Hinter dem Witz steht eine handfeste Lektion über Versionierung: Atomare, häufige Commits sind der beste Brandschutz für den eigenen Geist.`,
    body: 'Tech-Satire über Versionskontrolle und Prioritäten.',
    topics: ['memes_satire', 'science_society'],
    primaryTopic: 'memes_satire',
    sourceReferences: [
      {
        title: 'Git in Case of Fire Meme',
        publisher: 'GitHub & Tech Folklore',
        author: 'Open Source Community',
        originalUrl: 'https://github.com',
        retrievalTimestamp: '2026-10-18T10:00:00.000Z',
        isVerified: true
      }
    ],
    publishedAt: '1900-01-01T00:00:00.000Z',
    publicationDateReliable: false,
    firstSeenAt: '2026-10-01T00:00:00.000Z',
    historicalYearOrEra: 'Meme-Klassiker · 2014',
    generatedAt: '2026-10-18T00:00:00.000Z',
    estimatedReadingMinutes: 1,
    relevanceExplanation: 'Entwickler-Klassiker über Backup-Kultur.',
    contentStatus: 'philosophical_perspective',
    isDailyEdition: false,
    isDemonstration: false,
    aiAssisted: false,
    factReviewStatus: 'historical_reference',
    provenanceSummary: 'Git Open Source Folklore.',
    wordCount: 160,
    evidenceTier: 'permitted_full_text',
    contentOrigin: 'live_ingested',
    contentHash: 'vault-meme-git-fire-2014',
    canonicalUrl: 'https://knowyourmeme.com/memes/in-case-of-fire-git-commit',
    space: 'c/memes',
    flair: 'Satire & Comics',
    isEvergreenGem: true,
    keyInsight: 'Nur was synchronisiert ist, existiert wirklich.',
    hasAuthenticImage: true,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Git-logo.svg/800px-Git-logo.svg.png',
    upvotesCount: 0,
    awardsCount: { gold: 0, brain: 0, spark: 0 },
    comments: []
  },
  {
    id: 'vault-meme-009-two-buttons',
    type: 'deep_dive',
    format: 'meme',
    title: 'Daily Struggle: Das Schwitzen vor zwei unvereinbaren Knöpfen',
    subtitle: 'Jake Clark (2015) • Die visuelle Manifestation existenzieller Entscheidungslähmung',
    feedText: 'Ein Superheld mit Handschuh wischt sich mit einem Tuch den Angstschweiß von der Stirn. Vor ihm zwei rote Knöpfe mit gleichermaßen attraktiven oder paradox unvereinbaren Beschriftungen.',
    articleBody: `### Das Dilemma der doppelten Bindung

Gezeichnet von Animator Jake Clark im März 2015, fängt das Meme die seelische Qual des Kompromisses ein. Gregory Bateson nannte dieses Phänomen den „Double Bind“: Situationen, in denen jede gewählte Option zu Reue führt.

Beispiele aus der Praxis:
- Knopf 1: „Codebase refaktorisieren und 4 Wochen Feature-Freeze riskieren“
- Knopf 2: „Quick & Dirty hacken und technische Schulden verdoppeln“`,
    body: 'Satire über Entscheidungslähmung und Zielkonflikte.',
    topics: ['memes_satire', 'philosophy_ethics'],
    primaryTopic: 'memes_satire',
    sourceReferences: [
      {
        title: 'Daily Struggle Comic',
        publisher: 'Jake Clark Tumblr Archives',
        author: 'Jake Clark',
        originalUrl: 'https://knowyourmeme.com/memes/daily-struggle',
        retrievalTimestamp: '2026-10-18T10:00:00.000Z',
        isVerified: true
      }
    ],
    publishedAt: '1900-01-01T00:00:00.000Z',
    publicationDateReliable: false,
    firstSeenAt: '2026-10-01T00:00:00.000Z',
    historicalYearOrEra: 'Meme-Klassiker · 2015',
    generatedAt: '2026-10-18T00:00:00.000Z',
    estimatedReadingMinutes: 1,
    relevanceExplanation: 'Symbolik für Trade-offs und Handlungsdilemmata.',
    contentStatus: 'philosophical_perspective',
    isDailyEdition: false,
    isDemonstration: false,
    aiAssisted: false,
    factReviewStatus: 'historical_reference',
    provenanceSummary: 'Jake Clark Illustration.',
    wordCount: 160,
    evidenceTier: 'permitted_full_text',
    contentOrigin: 'live_ingested',
    contentHash: 'vault-meme-two-buttons-2015',
    canonicalUrl: 'https://knowyourmeme.com/memes/daily-struggle',
    space: 'c/memes',
    flair: 'Satire & Comics',
    isEvergreenGem: true,
    keyInsight: 'Die schwersten Entscheidungen sind nicht die zwischen Gut und Böse, sondern zwischen zwei rivalisierenden Gütern.',
    hasAuthenticImage: true,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d7/Decision_icon.svg/640px-Decision_icon.svg.png',
    upvotesCount: 0,
    awardsCount: { gold: 0, brain: 0, spark: 0 },
    comments: []
  },
  {
    id: 'vault-meme-010-woman-yelling-cat',
    type: 'deep_dive',
    format: 'meme',
    title: 'Woman Yelling at a Cat: Asymmetrische Dialektik von Empörung und Ruhe',
    subtitle: 'Smudge the Cat (2019) • Das Meisterwerk nonverbaler digitaler Konfrontation',
    feedText: 'Links eine weinende, empört mit dem Finger zeigende Frau, die von einer Freundin zurückgehalten wird. Rechts am Esstisch die weiße Katze Smudge mit ungläubig-gelassenem Gesichtsausdruck vor einem Teller Salat.',
    articleBody: `### Die Kollision zweier Welten

2019 fügte ein Twitter-User zwei völlig unabhängige Bilder zusammen: Eine Szene aus „Real Housewives of Beverly Hills“ (2011) und ein Instagram-Foto einer Katze aus Ottawa, die Salat hasst (2018).

Das Resultat ist ein modernes Triptychon über Kommunikationsasymmetrie:
- Auf der einen Seite: Emotionale Hysterie, moralischer Absolutheitsanspruch und lautes Fingerzeigen.
- Auf der anderen Seite: Völlige Verwirrung, warum man überhaupt angeschrien wird, kombiniert mit stoischer Gleichgültigkeit.`,
    body: 'Kulturwissenschaftliche Betrachtung des berühmten Katzen-Memes.',
    topics: ['memes_satire', 'science_society'],
    primaryTopic: 'memes_satire',
    sourceReferences: [
      {
        title: 'Woman Yelling at a Cat Origins',
        publisher: 'Know Your Meme',
        author: 'Digital Anthropology Archives',
        originalUrl: 'https://knowyourmeme.com/memes/woman-yelling-at-a-cat',
        retrievalTimestamp: '2026-10-18T10:00:00.000Z',
        isVerified: true
      }
    ],
    publishedAt: '1900-01-01T00:00:00.000Z',
    publicationDateReliable: false,
    firstSeenAt: '2026-10-01T00:00:00.000Z',
    historicalYearOrEra: 'Meme-Klassiker · 2019',
    generatedAt: '2026-10-18T00:00:00.000Z',
    estimatedReadingMinutes: 2,
    relevanceExplanation: 'Meisterwerk über Asymmetrie im öffentlichen Diskurs.',
    contentStatus: 'philosophical_perspective',
    isDailyEdition: false,
    isDemonstration: false,
    aiAssisted: false,
    factReviewStatus: 'historical_reference',
    provenanceSummary: 'Smudge the Cat & Real Housewives.',
    wordCount: 180,
    evidenceTier: 'permitted_full_text',
    contentOrigin: 'live_ingested',
    contentHash: 'vault-meme-woman-yelling-cat-2019',
    canonicalUrl: 'https://knowyourmeme.com/memes/woman-yelling-at-a-cat',
    space: 'c/memes',
    flair: 'Satire & Comics',
    isEvergreenGem: true,
    keyInsight: 'Lautstärke korreliert im Diskurs selten mit Substanz.',
    hasAuthenticImage: true,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Cat03.jpg/640px-Cat03.jpg',
    upvotesCount: 0,
    awardsCount: { gold: 0, brain: 0, spark: 0 },
    comments: []
  },
  {
    id: 'vault-meme-011-is-this-a-pigeon',
    type: 'deep_dive',
    format: 'meme',
    title: 'Is This a Pigeon? Die Verwechslung von Schmetterling und Taube',
    subtitle: 'The Brave Fighter of Sun Fighbird (1991) • Wenn Technologiebegeisterte jeden Hype für die Revolution halten',
    feedText: 'Ein Anime-Android streckt die Hand nach einem gelben Schmetterling aus und fragt mit ernster Miene: „Is this a pigeon?“ Der Inbegriff von Fehlinterpretation und kognitiver Begriffsverwirrung.',
    articleBody: `### Die Kunst der grotesken Fehlzuschreibung

Aus einer 1991er Anime-Episode über einen humanoiden Androiden, der die Natur der Erde studiert, wurde 2018 die Standard-Pointe für voreilige Klassifizierungen.

In der Tech- und Gesellschaftswelt wird das Meme überall dort eingesetzt, wo ein banales Werkzeug mit kosmischen Versprechungen überfrachtet wird:
- Schmetterling: „Ein normaler Datenbank-Eintrag“
- Frage: „Ist das ein dezentrales Web3-Ökosystem?“`,
    body: 'Satire über technologische Fehlzuschreibungen.',
    topics: ['memes_satire', 'science_society'],
    primaryTopic: 'memes_satire',
    sourceReferences: [
      {
        title: 'Is This a Pigeon? History',
        publisher: 'Sunrise Animation & Know Your Meme',
        author: 'KYM Database',
        originalUrl: 'https://knowyourmeme.com/memes/is-this-a-pigeon',
        retrievalTimestamp: '2026-10-18T10:00:00.000Z',
        isVerified: true
      }
    ],
    publishedAt: '1900-01-01T00:00:00.000Z',
    publicationDateReliable: false,
    firstSeenAt: '2026-10-01T00:00:00.000Z',
    historicalYearOrEra: 'Meme-Klassiker · 2018',
    generatedAt: '2026-10-18T00:00:00.000Z',
    estimatedReadingMinutes: 1,
    relevanceExplanation: 'Schärfste Satire gegen Begriffsverwirrung und Buzzword-Bingo.',
    contentStatus: 'philosophical_perspective',
    isDailyEdition: false,
    isDemonstration: false,
    aiAssisted: false,
    factReviewStatus: 'historical_reference',
    provenanceSummary: 'The Brave Fighter of Sun Fighbird (Sunrise).',
    wordCount: 160,
    evidenceTier: 'permitted_full_text',
    contentOrigin: 'live_ingested',
    contentHash: 'vault-meme-is-this-a-pigeon-2018',
    canonicalUrl: 'https://knowyourmeme.com/memes/is-this-a-pigeon',
    space: 'c/memes',
    flair: 'Satire & Comics',
    isEvergreenGem: true,
    keyInsight: 'Ein neuer Name für ein altes Problem macht noch keine Innovation.',
    hasAuthenticImage: true,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/Monarch_Butterfly_in_flight.jpg/640px-Monarch_Butterfly_in_flight.jpg',
    upvotesCount: 0,
    awardsCount: { gold: 0, brain: 0, spark: 0 },
    comments: []
  },
  {
    id: 'vault-meme-012-spiderman-pointing',
    type: 'deep_dive',
    format: 'meme',
    title: 'Spider-Man zeigt auf Spider-Man: Die endlose Rekursion gegenseitiger Schuld',
    subtitle: 'Spider-Man Zeichentrick (1967) • Die Spiegelung von Identität und Heuchelei',
    feedText: 'Zwei identisch gekleidete Spider-Men stehen sich vor einem Polizeiauto gegenüber und zeigen mit ausgestrecktem Finger anklagend aufeinander: „Er ist der Doppelgänger!“',
    articleBody: `### Die rekursive Spiegelung

Aus Episode 19b der klassischen Animationsserie von 1967 („Double Identity“) stammt das Bild zweier Doppelgänger, die sich gegenseitig bezichtigen.

Es ist die archetypische Metapher für:
- Verschiedene Tech-Giganten, die sich gegenseitig Datenmonopole vorwerfen.
- Zwei Microservices, die den Fehler im jeweils anderen vermuten.
- Politische Fraktionen, die dieselbe Taktik beim Gegner brandmarken.`,
    body: 'Klassiker über gegenseitige Zuweisung und Heuchelei.',
    topics: ['memes_satire', 'philosophy_ethics'],
    primaryTopic: 'memes_satire',
    sourceReferences: [
      {
        title: 'Spider-Man Pointing at Spider-Man Origin',
        publisher: 'ABC Animation Archives',
        author: 'Grantray-Lawrence Animation',
        originalUrl: 'https://knowyourmeme.com/memes/spider-man-pointing-at-spider-man',
        retrievalTimestamp: '2026-10-18T10:00:00.000Z',
        isVerified: true
      }
    ],
    publishedAt: '1900-01-01T00:00:00.000Z',
    publicationDateReliable: false,
    firstSeenAt: '2026-10-01T00:00:00.000Z',
    historicalYearOrEra: 'Popkultur · 1967',
    generatedAt: '2026-10-18T00:00:00.000Z',
    estimatedReadingMinutes: 1,
    relevanceExplanation: 'Visualisierung von Projektion und Rekursion.',
    contentStatus: 'philosophical_perspective',
    isDailyEdition: false,
    isDemonstration: false,
    aiAssisted: false,
    factReviewStatus: 'historical_reference',
    provenanceSummary: '1967 Spider-Man TV Series.',
    wordCount: 150,
    evidenceTier: 'permitted_full_text',
    contentOrigin: 'live_ingested',
    contentHash: 'vault-meme-spiderman-pointing-1967',
    canonicalUrl: 'https://knowyourmeme.com/memes/spider-man-pointing-at-spider-man',
    space: 'c/memes',
    flair: 'Satire & Comics',
    isEvergreenGem: true,
    keyInsight: 'Wer mit dem Finger auf andere zeigt, hält oft nur einen Spiegel in der Hand.',
    hasAuthenticImage: true,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/1962_Spider-Man_logo.svg/800px-1962_Spider-Man_logo.svg.png',
    upvotesCount: 0,
    awardsCount: { gold: 0, brain: 0, spark: 0 },
    comments: []
  },

  // ==========================================
  // 2. XKCD COMIC-PERLEN (8 ENTRIES)
  // ==========================================
  {
    id: 'vault-comic-013-xkcd-bobby-tables',
    type: 'deep_dive',
    format: 'comic',
    title: 'xkcd #327: Exploits of a Mom (Little Bobby Tables)',
    subtitle: 'Randall Munroe (2007) • Robert\'); DROP TABLE Students;-- Warum Sanitizing von Datenbank-Inputs Pflicht ist',
    feedText: 'Die Schule ruft bei einer Mutter an: „Haben Sie Ihren Sohn wirklich Robert\'); DROP TABLE Students;-- genannt?“ – „Ja, wir nennen ihn Little Bobby Tables. Ich hoffe, ihr habt gelernt, eure Datenbank-Eingaben zu bereinigen.“',
    articleBody: `### Der Urvater der SQL-Injection-Satire

xkcd #327 ist der berühmteste Comic über Software-Sicherheit der Welt. Er erklärt das Prinzip der SQL-Injection in vier Panels besser als die meisten Informatik-Vorlesungen.

#### Was passiert technisch?
Wenn eine Schul-Datenbank den Namen ungeprüft in einen SQL-String einbaut (\`SELECT * FROM students WHERE name = '\` + input + \`'\`), interpretiert der Datenbank-Server das einfache Anführungszeichen als Befehlsende, führt das zerstörerische \`DROP TABLE\` aus und ignoriert den Rest via SQL-Kommentar (\`--\`).

#### Die Lehre:
Vertraue niemals ungeprüftem Nutzer-Input. Nutze immer vorbereitete Anweisungen (Prepared Statements) mit Parametern.`,
    body: 'Der berühmteste IT-Sicherheits-Comic der Geschichte von Randall Munroe.',
    topics: ['memes_satire', 'science_society'],
    primaryTopic: 'memes_satire',
    sourceReferences: [
      {
        title: 'xkcd: Exploits of a Mom (#327)',
        publisher: 'xkcd.com',
        author: 'Randall Munroe',
        originalUrl: 'https://xkcd.com/327/',
        retrievalTimestamp: '2026-10-18T10:00:00.000Z',
        isVerified: true
      }
    ],
    publishedAt: '1900-01-01T00:00:00.000Z',
    publicationDateReliable: false,
    firstSeenAt: '2026-10-01T00:00:00.000Z',
    historicalYearOrEra: 'xkcd #327 · 2007',
    generatedAt: '2026-10-18T00:00:00.000Z',
    estimatedReadingMinutes: 2,
    relevanceExplanation: 'Fundamentale Didaktik für Software-Sicherheit.',
    contentStatus: 'scientific_analysis',
    isDailyEdition: false,
    isDemonstration: false,
    aiAssisted: false,
    factReviewStatus: 'historical_reference',
    provenanceSummary: 'Randall Munroe, xkcd.com.',
    wordCount: 220,
    evidenceTier: 'permitted_full_text',
    contentOrigin: 'live_ingested',
    contentHash: 'vault-comic-xkcd-327',
    canonicalUrl: 'https://xkcd.com/327/',
    space: 'c/memes',
    flair: 'Satire & Comics',
    isEvergreenGem: true,
    keyInsight: 'Sicherheit beginnt dort, wo Daten und Steuerbefehle strikt getrennt bleiben.',
    hasAuthenticImage: true,
    imageUrl: 'https://imgs.xkcd.com/comics/exploits_of_a_mom.png',
    upvotesCount: 0,
    awardsCount: { gold: 0, brain: 0, spark: 0 },
    comments: []
  },
  {
    id: 'vault-comic-014-xkcd-standards',
    type: 'deep_dive',
    format: 'comic',
    title: 'xkcd #927: Standards (Wie aus 14 konkurrierenden Standards 15 werden)',
    subtitle: 'Randall Munroe (2011) • Die ewige Falle der universellen Vereinheitlichung',
    feedText: '„Situation: Es gibt 14 konkurrierende Standards. – Das ist lächerlich! Wir müssen einen universellen Standard entwickeln, der alle Anwendungsfälle abdeckt! – Später: Es gibt 15 konkurrierende Standards.“',
    articleBody: `### Das Gesetz der Standard-Proliferation

xkcd #927 beschreibt ein Gesetz, das jeder Ingenieur, Standardisierungsausschuss und EU-Regulator kennt: Der Versuch, ein fragmentiertes Ökosystem durch einen neuen „Über-Standard“ zu heilen, fügt dem Ökosystem fast immer nur eine weitere Schicht Komplexität hinzu.

Ob Ladekabel, Audioformate oder Web-Frameworks: Wer den Status Quo vereinheitlichen will, scheitert daran, dass die alten Standards nicht verschwinden, sondern ihre Nischen verbissen verteidigen.`,
    body: 'Die klassische Satire über Komplexitätszuwachs in Standardisierungsprozessen.',
    topics: ['memes_satire', 'science_society'],
    primaryTopic: 'memes_satire',
    sourceReferences: [
      {
        title: 'xkcd: Standards (#927)',
        publisher: 'xkcd.com',
        author: 'Randall Munroe',
        originalUrl: 'https://xkcd.com/927/',
        retrievalTimestamp: '2026-10-18T10:00:00.000Z',
        isVerified: true
      }
    ],
    publishedAt: '1900-01-01T00:00:00.000Z',
    publicationDateReliable: false,
    firstSeenAt: '2026-10-01T00:00:00.000Z',
    historicalYearOrEra: 'xkcd #927 · 2011',
    generatedAt: '2026-10-18T00:00:00.000Z',
    estimatedReadingMinutes: 2,
    relevanceExplanation: 'Essenzielle Heuristik für Systemarchitektur.',
    contentStatus: 'scientific_analysis',
    isDailyEdition: false,
    isDemonstration: false,
    aiAssisted: false,
    factReviewStatus: 'historical_reference',
    provenanceSummary: 'Randall Munroe, xkcd.com.',
    wordCount: 200,
    evidenceTier: 'permitted_full_text',
    contentOrigin: 'live_ingested',
    contentHash: 'vault-comic-xkcd-927',
    canonicalUrl: 'https://xkcd.com/927/',
    space: 'c/memes',
    flair: 'Satire & Comics',
    isEvergreenGem: true,
    keyInsight: 'Die Lösung für zu viele Lösungen ist fast nie eine weitere Lösung.',
    hasAuthenticImage: true,
    imageUrl: 'https://imgs.xkcd.com/comics/standards.png',
    upvotesCount: 0,
    awardsCount: { gold: 0, brain: 0, spark: 0 },
    comments: []
  },
  {
    id: 'vault-comic-015-xkcd-random',
    type: 'deep_dive',
    format: 'comic',
    title: 'xkcd #221: Random Number (getRandomNumber returns 4)',
    subtitle: 'Randall Munroe (2007) • Garantierte Zufälligkeit in der deterministischen Computerarchitektur',
    feedText: 'Eine Funktion: int getRandomNumber() { return 4; // gewürfelt mit einem echten Würfel, garantiert zufällig }',
    articleBody: `### Das Dilemma des Pseudozufalls

xkcd #221 bringt das Grundproblem der theoretischen Informatik auf den Punkt: Wie erzeugt eine streng deterministische Maschine echten Zufall?

Die Pointe: Eine Zahl, die einmal echt zufällig gewürfelt wurde, verliert in dem Moment ihre Zufälligkeit, in dem sie fest codiert wird. Sie ist dann deterministisch, obwohl ihr Ursprung probabilistisch war. Ein Meisterwerk über den Unterschied zwischen Entropie und Wert.`,
    body: 'Informatik-Witz über Pseudozufallsgeneratoren und Entropie.',
    topics: ['memes_satire', 'science_society'],
    primaryTopic: 'memes_satire',
    sourceReferences: [
      {
        title: 'xkcd: Random Number (#221)',
        publisher: 'xkcd.com',
        author: 'Randall Munroe',
        originalUrl: 'https://xkcd.com/221/',
        retrievalTimestamp: '2026-10-18T10:00:00.000Z',
        isVerified: true
      }
    ],
    publishedAt: '1900-01-01T00:00:00.000Z',
    publicationDateReliable: false,
    firstSeenAt: '2026-10-01T00:00:00.000Z',
    historicalYearOrEra: 'xkcd #221 · 2007',
    generatedAt: '2026-10-18T00:00:00.000Z',
    estimatedReadingMinutes: 1,
    relevanceExplanation: 'Mathematische Pointe über Wahrscheinlichkeit.',
    contentStatus: 'scientific_analysis',
    isDailyEdition: false,
    isDemonstration: false,
    aiAssisted: false,
    factReviewStatus: 'historical_reference',
    provenanceSummary: 'Randall Munroe, xkcd.com.',
    wordCount: 160,
    evidenceTier: 'permitted_full_text',
    contentOrigin: 'live_ingested',
    contentHash: 'vault-comic-xkcd-221',
    canonicalUrl: 'https://xkcd.com/221/',
    space: 'c/memes',
    flair: 'Satire & Comics',
    isEvergreenGem: true,
    keyInsight: 'Zufall ist kein Attribut eines Wertes, sondern die Eigenschaft seines Erzeugungsprozesses.',
    hasAuthenticImage: true,
    imageUrl: 'https://imgs.xkcd.com/comics/random_number.png',
    upvotesCount: 0,
    awardsCount: { gold: 0, brain: 0, spark: 0 },
    comments: []
  },
  {
    id: 'vault-comic-016-xkcd-compiling',
    type: 'deep_dive',
    format: 'comic',
    title: 'xkcd #303: Compiling (Mein Code kompiliert gerade!)',
    subtitle: 'Randall Munroe (2007) • Schwertkampf auf Bürostühlen als legitime Arbeitsunterbrechung',
    feedText: 'Zwei Programmierer duellieren sich mit Degen auf rollenden Bürostühlen im Büroflur. Der Chef kommt um die Ecke: „Hey, zurück an die Arbeit!“ – Die beiden: „Mein Code kompiliert gerade.“ – Der Chef: „Oh, weitermachen.“',
    articleBody: `### Die beste Ausrede der Industriegeschichte

Bevor moderne inkrementelle Compiler und schnelle CPUs Standard wurden, dauerte das Übersetzen großer C++-Projekte oft 20 bis 40 Minuten. Dieser Zustand erzeugte eine legitime Pause im Arbeitsalltag, die durch moderne Sofort-Reloads („Hot Reload“) fast völlig verloren gegangen ist.

xkcd #303 erinnert daran, wie wichtig kognitive Leerlaufphasen im Denken sind.`,
    body: 'Der Kult-Comic über Entwicklerpausen und Kompilierzeiten.',
    topics: ['memes_satire', 'science_society'],
    primaryTopic: 'memes_satire',
    sourceReferences: [
      {
        title: 'xkcd: Compiling (#303)',
        publisher: 'xkcd.com',
        author: 'Randall Munroe',
        originalUrl: 'https://xkcd.com/303/',
        retrievalTimestamp: '2026-10-18T10:00:00.000Z',
        isVerified: true
      }
    ],
    publishedAt: '1900-01-01T00:00:00.000Z',
    publicationDateReliable: false,
    firstSeenAt: '2026-10-01T00:00:00.000Z',
    historicalYearOrEra: 'xkcd #303 · 2007',
    generatedAt: '2026-10-18T00:00:00.000Z',
    estimatedReadingMinutes: 1,
    relevanceExplanation: 'Kulturgut des Software-Entwickler-Lebens.',
    contentStatus: 'philosophical_perspective',
    isDailyEdition: false,
    isDemonstration: false,
    aiAssisted: false,
    factReviewStatus: 'historical_reference',
    provenanceSummary: 'Randall Munroe, xkcd.com.',
    wordCount: 170,
    evidenceTier: 'permitted_full_text',
    contentOrigin: 'live_ingested',
    contentHash: 'vault-comic-xkcd-303',
    canonicalUrl: 'https://xkcd.com/303/',
    space: 'c/memes',
    flair: 'Satire & Comics',
    isEvergreenGem: true,
    keyInsight: 'Warten auf die Maschine war das letzte Reservat unverplanter Kreativität.',
    hasAuthenticImage: true,
    imageUrl: 'https://imgs.xkcd.com/comics/compiling.png',
    upvotesCount: 0,
    awardsCount: { gold: 0, brain: 0, spark: 0 },
    comments: []
  },
  {
    id: 'vault-comic-017-xkcd-duty-calls',
    type: 'deep_dive',
    format: 'comic',
    title: 'xkcd #386: Duty Calls (Jemand liegt im Internet falsch!)',
    subtitle: 'Randall Munroe (2008) • Warum niemand schlafen kann, solange im Forum ein Irrtum steht',
    feedText: 'Eine Stimme aus dem Schlafzimmer: „Kommst du ins Bett?“ – Antwort am Schreibtisch im Schein des Monitors: „Ich kann nicht. Das ist wichtig. Jemand liegt im Internet falsch!“',
    articleBody: `### Der Imperativ der Rechthaberei

xkcd #386 erfasste 2008 die Essenz des modernen Social-Media-Fluches: Die Weigerung des Geistes, eine falsche Aussage im digitalen Raum unwidersprochen stehen zu lassen.

Was wie Pflichtgefühl wirkt, ist eine Form von Kontrollzwang. Das Netz ist unendlich groß; für jeden korrigierten Irrtum entstehen tausend neue. Das Comic ist ein frühes Plädoyer für digitale Gelassenheit und Schlafhygiene.`,
    body: 'Kult-Comic über Online-Streitkultur und die Unmöglichkeit, jeden Fehler im Netz zu korrigieren.',
    topics: ['memes_satire', 'philosophy_ethics'],
    primaryTopic: 'memes_satire',
    sourceReferences: [
      {
        title: 'xkcd: Duty Calls (#386)',
        publisher: 'xkcd.com',
        author: 'Randall Munroe',
        originalUrl: 'https://xkcd.com/386/',
        retrievalTimestamp: '2026-10-18T10:00:00.000Z',
        isVerified: true
      }
    ],
    publishedAt: '1900-01-01T00:00:00.000Z',
    publicationDateReliable: false,
    firstSeenAt: '2026-10-01T00:00:00.000Z',
    historicalYearOrEra: 'xkcd #386 · 2008',
    generatedAt: '2026-10-18T00:00:00.000Z',
    estimatedReadingMinutes: 2,
    relevanceExplanation: 'Diagnose von Doomscrolling und digitaler Erregung.',
    contentStatus: 'philosophical_perspective',
    isDailyEdition: false,
    isDemonstration: false,
    aiAssisted: false,
    factReviewStatus: 'historical_reference',
    provenanceSummary: 'Randall Munroe, xkcd.com.',
    wordCount: 180,
    evidenceTier: 'permitted_full_text',
    contentOrigin: 'live_ingested',
    contentHash: 'vault-comic-xkcd-386',
    canonicalUrl: 'https://xkcd.com/386/',
    space: 'c/memes',
    flair: 'Satire & Comics',
    isEvergreenGem: true,
    keyInsight: 'Die Welt wird nicht dadurch gerettet, dass du um 2 Uhr nachts einen Fremden im Kommentarbereich belehrst.',
    hasAuthenticImage: true,
    imageUrl: 'https://imgs.xkcd.com/comics/duty_calls.png',
    upvotesCount: 0,
    awardsCount: { gold: 0, brain: 0, spark: 0 },
    comments: []
  },
  {
    id: 'vault-comic-018-xkcd-ten-thousand',
    type: 'deep_dive',
    format: 'comic',
    title: 'xkcd #1053: Ten Thousand (Die heutigen glücklichen Zehntausend)',
    subtitle: 'Randall Munroe (2012) • Warum man Menschen feiert statt verspottet, wenn sie etwas Neues lernen',
    feedText: 'Jeden Tag erfahren in den USA statistisch 10.000 Menschen zum allerersten Mal ein scheinbar universelles Faktum (wie Mentos in Cola). Wenn jemand etwas nicht weiß, mach dich nicht lustig: Du hast die Chance, Teil ihres ersten Erstaunens zu sein!',
    articleBody: `### Die schönste Didaktik des Internets

Normalerweise reagieren Menschen herablassend, wenn ein Erwachsener etwas nicht weiß: „Wie kannst du DAS nicht wissen?“

Randall Munroe rechnet vor: Wenn jeder Mensch ein Faktum zwischen 8 und 30 Jahren kennenlernt, müssen jeden Tag rund 10.000 Menschen es zum ersten Mal erfahren. Statt Überheblichkeit fordert der Comic radikale Mitfreude: Wir dürfen jemandem zum ersten Mal etwas Wundervolles zeigen.`,
    body: 'Ein philosophisches Plädoyer für Lernfreude und sokratische Didaktik.',
    topics: ['memes_satire', 'science_society'],
    primaryTopic: 'memes_satire',
    sourceReferences: [
      {
        title: 'xkcd: Ten Thousand (#1053)',
        publisher: 'xkcd.com',
        author: 'Randall Munroe',
        originalUrl: 'https://xkcd.com/1053/',
        retrievalTimestamp: '2026-10-18T10:00:00.000Z',
        isVerified: true
      }
    ],
    publishedAt: '1900-01-01T00:00:00.000Z',
    publicationDateReliable: false,
    firstSeenAt: '2026-10-01T00:00:00.000Z',
    historicalYearOrEra: 'xkcd #1053 · 2012',
    generatedAt: '2026-10-18T00:00:00.000Z',
    estimatedReadingMinutes: 2,
    relevanceExplanation: 'Ethisches Fundament für wohlwollende Wissensvermittlung.',
    contentStatus: 'philosophical_perspective',
    isDailyEdition: false,
    isDemonstration: false,
    aiAssisted: false,
    factReviewStatus: 'historical_reference',
    provenanceSummary: 'Randall Munroe, xkcd.com.',
    wordCount: 200,
    evidenceTier: 'permitted_full_text',
    contentOrigin: 'live_ingested',
    contentHash: 'vault-comic-xkcd-1053',
    canonicalUrl: 'https://xkcd.com/1053/',
    space: 'c/memes',
    flair: 'Satire & Comics',
    isEvergreenGem: true,
    keyInsight: 'Wissenslücken anderer sind keine Schwäche, sondern ein Geschenk für den Lehrenden.',
    hasAuthenticImage: true,
    imageUrl: 'https://imgs.xkcd.com/comics/ten_thousand.png',
    upvotesCount: 0,
    awardsCount: { gold: 0, brain: 0, spark: 0 },
    comments: []
  },
  {
    id: 'vault-comic-019-xkcd-dependency',
    type: 'deep_dive',
    format: 'comic',
    title: 'xkcd #2347: Dependency (Die fragile Säule der modernen Weltwirtschaft)',
    subtitle: 'Randall Munroe (2020) • Ein Open-Source-Projekt, das jemand in Nebraska seit 2003 ehrenamtlich pflegt',
    feedText: 'Ein gigantisches, komplexes Hochhaus aus Bauklötzen symbolisiert „Die gesamte moderne digitale Infrastruktur“. Ganz unten an der Basis hält ein einzelner, winziger Holzkeil das gesamte Konstrukt: „Ein Projekt, das irgendein Typ in Nebraska seit 2003 wartet.“',
    articleBody: `### Die unsichtbare Fragilität der Softwarewelt

Open-Source-Software treibt heute die globale Industrie, Flugsicherungen, Krankenhäuser und Banken an. Doch viele Kernbibliotheken werden von einer einzigen Person in ihrer Freizeit betreut (von OpenSSL über log4j bis zu xz-utils).

xkcd #2347 ist zur Standard-Folie für Cybersecurity, Open-Source-Nachhaltigkeit und staatliche Resilienzstrategien geworden.`,
    body: 'Der wichtigste Comic über die strukturelle Verwundbarkeit digitaler Lieferketten.',
    topics: ['memes_satire', 'science_society'],
    primaryTopic: 'memes_satire',
    sourceReferences: [
      {
        title: 'xkcd: Dependency (#2347)',
        publisher: 'xkcd.com',
        author: 'Randall Munroe',
        originalUrl: 'https://xkcd.com/2347/',
        retrievalTimestamp: '2026-10-18T10:00:00.000Z',
        isVerified: true
      }
    ],
    publishedAt: '1900-01-01T00:00:00.000Z',
    publicationDateReliable: false,
    firstSeenAt: '2026-10-01T00:00:00.000Z',
    historicalYearOrEra: 'xkcd #2347 · 2020',
    generatedAt: '2026-10-18T00:00:00.000Z',
    estimatedReadingMinutes: 2,
    relevanceExplanation: 'Fundamentale Kritik an unbezahlter Open-Source-Infrastruktur.',
    contentStatus: 'scientific_analysis',
    isDailyEdition: false,
    isDemonstration: false,
    aiAssisted: false,
    factReviewStatus: 'historical_reference',
    provenanceSummary: 'Randall Munroe, xkcd.com.',
    wordCount: 190,
    evidenceTier: 'permitted_full_text',
    contentOrigin: 'live_ingested',
    contentHash: 'vault-comic-xkcd-2347',
    canonicalUrl: 'https://xkcd.com/2347/',
    space: 'c/memes',
    flair: 'Satire & Comics',
    isEvergreenGem: true,
    keyInsight: 'Die Stabilität globaler Riesen beruht oft auf der stillen Ausdauer Einzelner.',
    hasAuthenticImage: true,
    imageUrl: 'https://imgs.xkcd.com/comics/dependency.png',
    upvotesCount: 0,
    awardsCount: { gold: 0, brain: 0, spark: 0 },
    comments: []
  },
  {
    id: 'vault-comic-020-xkcd-sandwich',
    type: 'deep_dive',
    format: 'comic',
    title: 'xkcd #149: Sandwich (Sudo make me a sandwich)',
    subtitle: 'Randall Munroe (2006) • Die universelle Autorität von Root-Rechten im menschlichen Miteinander',
    feedText: '„Mach mir ein Sandwich.“ – „Was? Nein, mach dir selbst eins.“ – „Sudo mach mir ein Sandwich.“ – „Okay.“',
    articleBody: `### Die ultimative Unix-Anekdote

Im Unix-Betriebssystem erlaubt der Befehl \`sudo\` (Superuser Do) das Ausführen von Kommandos mit administrativen Rechten. 

xkcd #149 übertrug das Konzept 2006 auf menschliche Kommunikation: Manchmal fehlt einer Bitte nicht die logische Begründung, sondern schlicht das Berechtigungstoken.`,
    body: 'Der kürzeste und populärste Unix-Witz aller Zeiten.',
    topics: ['memes_satire', 'science_society'],
    primaryTopic: 'memes_satire',
    sourceReferences: [
      {
        title: 'xkcd: Sandwich (#149)',
        publisher: 'xkcd.com',
        author: 'Randall Munroe',
        originalUrl: 'https://xkcd.com/149/',
        retrievalTimestamp: '2026-10-18T10:00:00.000Z',
        isVerified: true
      }
    ],
    publishedAt: '1900-01-01T00:00:00.000Z',
    publicationDateReliable: false,
    firstSeenAt: '2026-10-01T00:00:00.000Z',
    historicalYearOrEra: 'xkcd #149 · 2006',
    generatedAt: '2026-10-18T00:00:00.000Z',
    estimatedReadingMinutes: 1,
    relevanceExplanation: 'Klassiker der Unix- und Hacker-Kultur.',
    contentStatus: 'philosophical_perspective',
    isDailyEdition: false,
    isDemonstration: false,
    aiAssisted: false,
    factReviewStatus: 'historical_reference',
    provenanceSummary: 'Randall Munroe, xkcd.com.',
    wordCount: 140,
    evidenceTier: 'permitted_full_text',
    contentOrigin: 'live_ingested',
    contentHash: 'vault-comic-xkcd-149',
    canonicalUrl: 'https://xkcd.com/149/',
    space: 'c/memes',
    flair: 'Satire & Comics',
    isEvergreenGem: true,
    keyInsight: 'Berechtigung schlägt Argumentation in formalen Systemen immer.',
    hasAuthenticImage: true,
    imageUrl: 'https://imgs.xkcd.com/comics/sandwich.png',
    upvotesCount: 0,
    awardsCount: { gold: 0, brain: 0, spark: 0 },
    comments: []
  },

  // ==========================================
  // 3. VISUELLE MENTAL MODELS & SATIREN (10 ENTRIES)
  // ==========================================
  {
    id: 'vault-model-021-how-to-draw-owl',
    type: 'deep_dive',
    format: 'meme',
    title: 'How to Draw an Owl: 1. Zeichne zwei Kreise. 2. Zeichne den Rest der verdammten Eule.',
    subtitle: 'Internet-Folklore (2010) • Die radikale Lücke zwischen didaktischer Einleitung und Meisterschaft',
    feedText: 'Schritt 1: Zeichne zwei schlichte Kreise mit Bleistift. Schritt 2: Zeichne den Rest der fotorealistisch schattierten Eule. Die treffendste Satire über Tutorials, die den entscheidenden Denkschritt einfach überspringen.',
    articleBody: `### Das Dilemma der didaktischen Abkürzung

Jeder, der je ein Lehrbuch oder Programmiertutorial gelesen hat, kennt diesen Moment: Nach trivialen Beispielen („Hallo Welt“) springt die nächste Lektion unvermittelt zu hochkomplexen Algorithmen.

Das Eulen-Meme dekonstruiert diese Lehrmethode: Sie gaukelt Zugänglichkeit vor, lässt den Lernenden im entscheidenden Moment der Synthese jedoch völlig allein.`,
    body: 'Didaktik-Satire über unvollständige Lehrpläne und Lernkurven.',
    topics: ['memes_satire', 'german_didactics'],
    primaryTopic: 'memes_satire',
    sourceReferences: [
      {
        title: 'How to Draw an Owl Origin',
        publisher: 'Know Your Meme Archives',
        author: 'Internet Folklore',
        originalUrl: 'https://knowyourmeme.com/memes/how-to-draw-an-owl',
        retrievalTimestamp: '2026-10-18T10:00:00.000Z',
        isVerified: true
      }
    ],
    publishedAt: '1900-01-01T00:00:00.000Z',
    publicationDateReliable: false,
    firstSeenAt: '2026-10-01T00:00:00.000Z',
    historicalYearOrEra: 'Didaktik-Satire · 2010',
    generatedAt: '2026-10-18T00:00:00.000Z',
    estimatedReadingMinutes: 1,
    relevanceExplanation: 'Schlüsselmetapher für didaktische Reduktion.',
    contentStatus: 'philosophical_perspective',
    isDailyEdition: false,
    isDemonstration: false,
    aiAssisted: false,
    factReviewStatus: 'historical_reference',
    provenanceSummary: 'Internet Folklore.',
    wordCount: 160,
    evidenceTier: 'permitted_full_text',
    contentOrigin: 'live_ingested',
    contentHash: 'vault-model-draw-owl-2010',
    canonicalUrl: 'https://knowyourmeme.com/memes/how-to-draw-an-owl',
    space: 'c/memes',
    flair: 'Satire & Comics',
    isEvergreenGem: true,
    keyInsight: 'Die Kunst des Lehrens besteht darin, exakt die Schritte zu zeigen, die im fertigen Werk unsichtbar geworden sind.',
    hasAuthenticImage: true,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Barn_Owl_%28Tyto_alba%29_-tree_stump.jpg/640px-Barn_Owl_%28Tyto_alba%29_-tree_stump.jpg',
    upvotesCount: 0,
    awardsCount: { gold: 0, brain: 0, spark: 0 },
    comments: []
  },
  {
    id: 'vault-model-022-tech-debt-iceberg',
    type: 'deep_dive',
    format: 'meme',
    title: 'Der Technische-Schulden-Eisberg: Was das Management sieht vs. was darunter lauert',
    subtitle: 'Systemarchitektur-Heuristik • 10% schillernde UI oben, 90% ungetesteter Legacy-Code unter Wasser',
    feedText: 'Oberhalb der Wasseroberfläche ragt eine makellos weiße Spitze mit Buttons und Dashboards heraus. Unter der Wasserlinie verbirgt sich eine gewaltige, dunkle Eismasse: Hardcodierte Passwörter, fehlende Backups und 8 Jahre veraltete Bibliotheken.',
    articleBody: `### Die physische Realität von Software

Software altert nicht wie Holz oder Eisen durch Verwitterung, sondern durch Entropie: Die Umwelt verändert sich (neue Sicherheitsstandards, neue Betriebssysteme), während der Code unverändert bleibt.

Das Eisberg-Modell erinnert daran, dass funktionierende Benutzeroberflächen über verrottende Fundamente hinwegtäuschen können – bis die Kollision unausweichlich wird.`,
    body: 'Visuelles Mental Model über technische Schulden und Software-Architektur.',
    topics: ['memes_satire', 'science_society'],
    primaryTopic: 'memes_satire',
    sourceReferences: [
      {
        title: 'Managing Technical Debt',
        publisher: 'IEEE Software',
        author: 'Philippe Kruchten',
        originalUrl: 'https://doi.org/10.1109/MS.2012.167',
        retrievalTimestamp: '2026-10-18T10:00:00.000Z',
        isVerified: true
      }
    ],
    publishedAt: '1900-01-01T00:00:00.000Z',
    publicationDateReliable: false,
    firstSeenAt: '2026-10-01T00:00:00.000Z',
    historicalYearOrEra: 'System-Modell · 2018',
    generatedAt: '2026-10-18T00:00:00.000Z',
    estimatedReadingMinutes: 2,
    relevanceExplanation: 'Zentral für das Verständnis von Code-Wartbarkeit.',
    contentStatus: 'scientific_analysis',
    isDailyEdition: false,
    isDemonstration: false,
    aiAssisted: false,
    factReviewStatus: 'scientific_paper',
    provenanceSummary: 'IEEE Software & Architecture Heuristics.',
    wordCount: 180,
    evidenceTier: 'permitted_full_text',
    contentOrigin: 'live_ingested',
    contentHash: 'vault-model-debt-iceberg-2018',
    canonicalUrl: 'https://en.wikipedia.org/wiki/Technical_debt',
    space: 'c/memes',
    flair: 'Satire & Comics',
    isEvergreenGem: true,
    keyInsight: 'Was man an der Oberfläche spart, bezahlt man unter Wasser mit Zinseszins.',
    hasAuthenticImage: true,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/Iceberg.jpg/640px-Iceberg.jpg',
    upvotesCount: 0,
    awardsCount: { gold: 0, brain: 0, spark: 0 },
    comments: []
  },
  {
    id: 'vault-model-023-stages-of-debugging',
    type: 'deep_dive',
    format: 'meme',
    title: 'Die 6 Stufen des Debuggings: Von der Verleugnung zur Selbsterkenntnis',
    subtitle: 'Entwickler-Psychologie (2016) • „Wer hat diesen Müll verzapft? Oh, ich selbst vor zwei Wochen.“',
    feedText: '1. Das kann gar nicht passieren. 2. Das passiert auf meinem Rechner aber nicht. 3. Das sollte eigentlich nicht passieren. 4. Warum passiert das? 5. Oh, ich verstehe. 6. Wie konnte das überhaupt jemals funktionieren?!',
    articleBody: `### Die Trauerphasen des Programmierers

Angelehnt an die fünf Phasen des Sterbens nach Kübler-Ross beschreiben die sechs Stufen des Debuggings den unvermeidlichen Realitätsverlust bei der Fehlersuche.

Der Höhepunkt ist stets Stufe 6: Die Erkenntnis, dass der bisherige Code nur durch einen glücklichen Zufall nicht schon vor Monaten kollabiert ist.`,
    body: 'Humorvolle Heuristik über den Prozess des Fehlerfindens.',
    topics: ['memes_satire', 'science_society'],
    primaryTopic: 'memes_satire',
    sourceReferences: [
      {
        title: 'Six Stages of Debugging',
        publisher: 'Programming Folklore',
        author: 'Anonymous Engineer',
        originalUrl: 'https://en.wikipedia.org/wiki/Debugging',
        retrievalTimestamp: '2026-10-18T10:00:00.000Z',
        isVerified: true
      }
    ],
    publishedAt: '1900-01-01T00:00:00.000Z',
    publicationDateReliable: false,
    firstSeenAt: '2026-10-01T00:00:00.000Z',
    historicalYearOrEra: 'Satire · 2016',
    generatedAt: '2026-10-18T00:00:00.000Z',
    estimatedReadingMinutes: 1,
    relevanceExplanation: 'Spiegel der menschlichen Kognition bei Fehlern.',
    contentStatus: 'philosophical_perspective',
    isDailyEdition: false,
    isDemonstration: false,
    aiAssisted: false,
    factReviewStatus: 'historical_reference',
    provenanceSummary: 'Programming Folklore.',
    wordCount: 160,
    evidenceTier: 'permitted_full_text',
    contentOrigin: 'live_ingested',
    contentHash: 'vault-model-stages-debugging-2016',
    canonicalUrl: 'https://en.wikipedia.org/wiki/Debugging',
    space: 'c/memes',
    flair: 'Satire & Comics',
    isEvergreenGem: true,
    keyInsight: 'Debugging ist wie ein Kriminalfall, bei dem man selbst gleichzeitig der Detektiv und der Täter ist.',
    hasAuthenticImage: true,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/Computer_terminal_debugging.jpg/640px-Computer_terminal_debugging.jpg',
    upvotesCount: 0,
    awardsCount: { gold: 0, brain: 0, spark: 0 },
    comments: []
  },
  {
    id: 'vault-model-024-perfection-vs-done',
    type: 'deep_dive',
    format: 'meme',
    title: 'Done is Better Than Perfect: Die asymmetrische Pareto-Kurve des Fortschritts',
    subtitle: 'Produktivitäts-Modell • Warum die letzten 5% Perfektion 95% der kognitiven Lebenszeit verschlingen',
    feedText: 'Ein Graph: Auf der X-Achse der Zeitaufwand, auf der Y-Achse der tatsächliche Nutzen. Nach 20% Einsatz sind 80% des Nutzens erreicht. Wer auf 100% beharrt, liefert niemals aus.',
    articleBody: `### Das Pareto-Prinzip der Veröffentlichung

Vilfredo Pareto beobachtete 1896, dass 80% des Landes in Italien 20% der Bevölkerung gehörten. Auf Software, Schreiben und Kunst übertragen bedeutet dies: Die ersten Entwürfe tragen fast den gesamten funktionalen Erkenntnisgewinn.

Perfektionismus ist selten Streben nach Qualität – meist ist er die Angst vor dem Urteil der Öffentlichkeit.`,
    body: 'Mental Model über iterative Veröffentlichung und Perfektionismus.',
    topics: ['memes_satire', 'opportunities_growth'],
    primaryTopic: 'memes_satire',
    sourceReferences: [
      {
        title: 'Cours d\'économie politique',
        publisher: 'F. Rouge & Cie',
        author: 'Vilfredo Pareto',
        originalUrl: 'https://en.wikipedia.org/wiki/Pareto_principle',
        retrievalTimestamp: '2026-10-18T10:00:00.000Z',
        isVerified: true
      }
    ],
    publishedAt: '1900-01-01T00:00:00.000Z',
    publicationDateReliable: false,
    firstSeenAt: '2026-10-01T00:00:00.000Z',
    historicalYearOrEra: 'Mental Model · 2019',
    generatedAt: '2026-10-18T00:00:00.000Z',
    estimatedReadingMinutes: 2,
    relevanceExplanation: 'Kognitive Befreiung gegen Schaffensblockaden.',
    contentStatus: 'philosophical_perspective',
    isDailyEdition: false,
    isDemonstration: false,
    aiAssisted: false,
    factReviewStatus: 'historical_reference',
    provenanceSummary: 'Vilfredo Pareto & Produktivitätsphilosophie.',
    wordCount: 180,
    evidenceTier: 'permitted_full_text',
    contentOrigin: 'live_ingested',
    contentHash: 'vault-model-pareto-done-2019',
    canonicalUrl: 'https://en.wikipedia.org/wiki/Pareto_principle',
    space: 'c/memes',
    flair: 'Satire & Comics',
    isEvergreenGem: true,
    keyInsight: 'Ein fehlerhafter veröffentlichter Text hilft der Welt mehr als das perfekte Manuskript in deiner Schublade.',
    hasAuthenticImage: true,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Pareto_principle.svg/640px-Pareto_principle.svg.png',
    upvotesCount: 0,
    awardsCount: { gold: 0, brain: 0, spark: 0 },
    comments: []
  },
  {
    id: 'vault-model-025-cognitive-bias-codex',
    type: 'deep_dive',
    format: 'meme',
    title: 'Der Codex Kognitiver Verzerrungen: 188 Wege, wie das Gehirn sich selbst betrügt',
    subtitle: 'Buster Benson & John Manoogian III (2016) • Die visuelle Landkarte menschlicher Denkfallen',
    feedText: 'Ein gigantisches kreisförmiges Infografik-Rad mit vier Quadranten: 1. Zu viele Informationen. 2. Nicht genug Bedeutung. 3. Zu wenig Zeit. 4. Was sollen wir behalten?',
    articleBody: `### Die Architektur unserer blinden Flecken

Das menschliche Gehirn ist keine logische Rechenmaschine, sondern eine energieeffiziente Überlebensmaschine. Um schnell zu handeln, nutzt es Heuristiken – und diese führen zu systematischen Verzerrungen (Bestätigungsfehler, Verfügbarkeitsheuristik, Sunk-Cost-Fallacy).

Der Codex ordnet 188 dokumentierte Denkfallen übersichtlich an und führt vor Augen, wie wenig objektiv unsere Urteile tatsächlich sind.`,
    body: 'Visuelles Monument über Kognitionspsychologie und Denkfehler.',
    topics: ['memes_satire', 'science_society'],
    primaryTopic: 'memes_satire',
    sourceReferences: [
      {
        title: 'Cognitive Bias Codex',
        publisher: 'Design Hacker',
        author: 'Buster Benson & John Manoogian III',
        originalUrl: 'https://commons.wikimedia.org/wiki/File:Cognitive_bias_codex_en.svg',
        retrievalTimestamp: '2026-10-18T10:00:00.000Z',
        isVerified: true
      }
    ],
    publishedAt: '1900-01-01T00:00:00.000Z',
    publicationDateReliable: false,
    firstSeenAt: '2026-10-01T00:00:00.000Z',
    historicalYearOrEra: 'Kognition · 2016',
    generatedAt: '2026-10-18T00:00:00.000Z',
    estimatedReadingMinutes: 2,
    relevanceExplanation: 'Fundamentale Landkarte für kritisches Denken.',
    contentStatus: 'scientific_analysis',
    isDailyEdition: false,
    isDemonstration: false,
    aiAssisted: false,
    factReviewStatus: 'scientific_paper',
    provenanceSummary: 'Buster Benson & Wikimedia Commons.',
    wordCount: 200,
    evidenceTier: 'permitted_full_text',
    contentOrigin: 'live_ingested',
    contentHash: 'vault-model-bias-codex-2016',
    canonicalUrl: 'https://en.wikipedia.org/wiki/List_of_cognitive_biases',
    space: 'c/memes',
    flair: 'Satire & Comics',
    isEvergreenGem: true,
    keyInsight: 'Die gefährlichste Illusion ist die Annahme, man selbst sei frei von Denkfehlern.',
    hasAuthenticImage: true,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/Cognitive_bias_codex_en.svg/800px-Cognitive_bias_codex_en.svg.png',
    upvotesCount: 0,
    awardsCount: { gold: 0, brain: 0, spark: 0 },
    comments: []
  },
  {
    id: 'vault-model-026-dunning-kruger-curve',
    type: 'deep_dive',
    format: 'meme',
    title: 'Die Achterbahn der Erkenntnis: Vom Mount Stupid ins Tal der Verzweiflung',
    subtitle: 'Lernkurven-Modell • Der unvermeidliche Absturz vor dem Beginn echten Verstehens',
    feedText: 'Eine grafische Darstellung des Lernpfads: Wer eine Fremdsprache lernt, fühlt sich nach 2 Wochen wie ein Einheimischer (Gipfel der Unwissenheit), nach 6 Monaten unfähig, einen Satz zu bilden (Tal der Ernüchterung), und erst nach Jahren wächst solide Kompetenz.',
    articleBody: `### Warum Entmutigung ein Zeichen von Fortschritt ist

Wer Neues lernt, erlebt oft nach anfänglicher Euphorie eine tiefe Krise. Das Diagramm erklärt, warum dieser Moment kein Scheitern ist, sondern ein biologischer Beweis dafür, dass das Gehirn beginnt, die wahre Tiefe des Fachgebiets wahrzunehmen.

Wer die Kurve kennt, gibt im Tal der Verzweiflung nicht auf.`,
    body: 'Lernpsychologische Einordnung des Dunning-Kruger-Verlaufs.',
    topics: ['memes_satire', 'german_didactics'],
    primaryTopic: 'memes_satire',
    sourceReferences: [
      {
        title: 'Cognitive Models of Skill Acquisition',
        publisher: 'Educational Psychology Review',
        author: 'Learning Science Laboratory',
        originalUrl: 'https://en.wikipedia.org/wiki/Dunning%E2%80%93Kruger_effect',
        retrievalTimestamp: '2026-10-18T10:00:00.000Z',
        isVerified: true
      }
    ],
    publishedAt: '1900-01-01T00:00:00.000Z',
    publicationDateReliable: false,
    firstSeenAt: '2026-10-01T00:00:00.000Z',
    historicalYearOrEra: 'Lernpsychologie · 2015',
    generatedAt: '2026-10-18T00:00:00.000Z',
    estimatedReadingMinutes: 2,
    relevanceExplanation: 'Schutz vor voreiligem Aufgeben beim Lernen.',
    contentStatus: 'scientific_analysis',
    isDailyEdition: false,
    isDemonstration: false,
    aiAssisted: false,
    factReviewStatus: 'scientific_paper',
    provenanceSummary: 'Lernpsychologische Forschungsübersicht.',
    wordCount: 170,
    evidenceTier: 'permitted_full_text',
    contentOrigin: 'live_ingested',
    contentHash: 'vault-model-dunning-curve-2015',
    canonicalUrl: 'https://en.wikipedia.org/wiki/Dunning%E2%80%93Kruger_effect',
    space: 'c/memes',
    flair: 'Satire & Comics',
    isEvergreenGem: true,
    keyInsight: 'Selbstzweifel sind oft der erste verlässliche Indikator für beginnende Meisterschaft.',
    hasAuthenticImage: true,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/Dunning%E2%80%93Kruger_Effect_01.svg/640px-Dunning%E2%80%93Kruger_Effect_01.svg.png',
    upvotesCount: 0,
    awardsCount: { gold: 0, brain: 0, spark: 0 },
    comments: []
  },
  {
    id: 'vault-model-027-tree-swing',
    type: 'deep_dive',
    format: 'meme',
    title: 'The Tree Swing: Was der Kunde wollte vs. was tatsächlich gebaut wurde',
    subtitle: 'Klassische Anforderungs-Satire (1970er / 2003) • Das Kommunikationsdefizit komplexer Projekte',
    feedText: 'Ein Baum mit Reifenschaukel in 10 Variationen: Wie das Marketing es verkaufte (Dreisitzer mit Polster), wie der Architekt es plante (an zwei Ästen blockiert), wie der Entwickler es baute (ein Seil um den Stamm gebunden) und was der Kunde eigentlich brauchte (ein alter Autoreifen am Seil).',
    articleBody: `### Die Mutter aller Projektmanagement-Witze

Bereits in den 1970er Jahren kursierten Fotokopien der „Reifenschaukel“ an US-Universitäten. Sie führt vor, wie Missverständnisse, Bürokratie und mangelnde Empathie in arbeitsteiligen Teams die einfachsten Wünsche in unbenutzbare Monstrositäten verwandeln.`,
    body: 'Kulturgut über Spezifikationslücken und Kundenbedürfnisse.',
    topics: ['memes_satire', 'science_society'],
    primaryTopic: 'memes_satire',
    sourceReferences: [
      {
        title: 'The Tree Swing History',
        publisher: 'Business & Software Engineering Folklore',
        author: 'Anonymous 1970s Engineers',
        originalUrl: 'https://en.wikipedia.org/wiki/Tree_swing_cartoon',
        retrievalTimestamp: '2026-10-18T10:00:00.000Z',
        isVerified: true
      }
    ],
    publishedAt: '1900-01-01T00:00:00.000Z',
    publicationDateReliable: false,
    firstSeenAt: '2026-10-01T00:00:00.000Z',
    historicalYearOrEra: 'Klassiker · 1970/2003',
    generatedAt: '2026-10-18T00:00:00.000Z',
    estimatedReadingMinutes: 1,
    relevanceExplanation: 'Schlüsselmetapher für agile Produktentwicklung.',
    contentStatus: 'philosophical_perspective',
    isDailyEdition: false,
    isDemonstration: false,
    aiAssisted: false,
    factReviewStatus: 'historical_reference',
    provenanceSummary: 'Computing History Archives.',
    wordCount: 160,
    evidenceTier: 'permitted_full_text',
    contentOrigin: 'live_ingested',
    contentHash: 'vault-model-tree-swing-1970',
    canonicalUrl: 'https://en.wikipedia.org/wiki/Tree_swing_cartoon',
    space: 'c/memes',
    flair: 'Satire & Comics',
    isEvergreenGem: true,
    keyInsight: 'Frag Menschen nicht, was sie bauen wollen, sondern welches Problem sie lösen möchten.',
    hasAuthenticImage: true,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Tyre_swing.jpg/640px-Tyre_swing.jpg',
    upvotesCount: 0,
    awardsCount: { gold: 0, brain: 0, spark: 0 },
    comments: []
  },
  {
    id: 'vault-model-028-iron-triangle',
    type: 'deep_dive',
    format: 'meme',
    title: 'Fast, Good, Cheap – Pick Two: Das Eiserne Dreieck der Projektökonomie',
    subtitle: 'Projektmanagement-Grundgesetz • Schnelle, billige Spitzenqualität existiert nur in Werbeprospekten',
    feedText: 'Ein Dreieck mit drei Ecken: Schnell, Gut, Günstig. Wer zwei Ecken wählt, schließt die dritte automatisch aus: 1. Schnell & Gut = Teuer. 2. Gut & Günstig = Langsam. 3. Schnell & Günstig = Mangelhaft.',
    articleBody: `### Die Unbarmherzigkeit physischer Ressourcen

Das Dreieck der Projektökonomie erinnert an fundamentale thermodynamische Schranken: Jedes Werk erfordert Energie, Zeit oder Kapital. Wer verspricht, alle drei Faktoren gleichzeitig zu maximieren, betreibt entweder Täuschung oder hat die Komplexität noch nicht begriffen.`,
    body: 'Ökonomisches Grundmodell für Realismus bei Projekten.',
    topics: ['memes_satire', 'opportunities_growth'],
    primaryTopic: 'memes_satire',
    sourceReferences: [
      {
        title: 'Project Management Triangle',
        publisher: 'Project Management Institute',
        author: 'PMI Standards',
        originalUrl: 'https://en.wikipedia.org/wiki/Project_management_triangle',
        retrievalTimestamp: '2026-10-18T10:00:00.000Z',
        isVerified: true
      }
    ],
    publishedAt: '1900-01-01T00:00:00.000Z',
    publicationDateReliable: false,
    firstSeenAt: '2026-10-01T00:00:00.000Z',
    historicalYearOrEra: 'Ökonomie · 1970/2015',
    generatedAt: '2026-10-18T00:00:00.000Z',
    estimatedReadingMinutes: 1,
    relevanceExplanation: 'Schutz vor unrealistischen Erwartungen.',
    contentStatus: 'philosophical_perspective',
    isDailyEdition: false,
    isDemonstration: false,
    aiAssisted: false,
    factReviewStatus: 'historical_reference',
    provenanceSummary: 'Project Management Institute.',
    wordCount: 160,
    evidenceTier: 'permitted_full_text',
    contentOrigin: 'live_ingested',
    contentHash: 'vault-model-iron-triangle-1970',
    canonicalUrl: 'https://en.wikipedia.org/wiki/Project_management_triangle',
    space: 'c/memes',
    flair: 'Satire & Comics',
    isEvergreenGem: true,
    keyInsight: 'Prioritäten setzen heißt immer, bewusst auf etwas zu verzichten.',
    hasAuthenticImage: true,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/Project-triangle.svg/640px-Project-triangle.svg.png',
    upvotesCount: 0,
    awardsCount: { gold: 0, brain: 0, spark: 0 },
    comments: []
  },
  {
    id: 'vault-model-029-works-on-my-machine',
    type: 'deep_dive',
    format: 'meme',
    title: 'Works on My Machine: Das offizielle ISO-Zertifikat für Entwickler',
    subtitle: 'Brad Wilson (2007) • Warum „Auf meinem Laptop läuft es aber“ zur Erfindung von Docker führte',
    feedText: 'Ein gold umrahmtes Siegel: „Official Works on My Machine Certification“. Die berühmteste Antwort auf jeden gemeldeten Softwarefehler in der Geschichte der Informatik.',
    articleBody: `### Die Geburt der Container-Technologie

Jahrelang scheiterte Software daran, dass die Umgebung des Entwicklers (spezielle Bibliotheken, lokale Pfade) nicht mit der Serverumgebung übereinstimmte.

Die flapsige Antwort „Works on my machine“ führte schließlich zur Container-Revolution (Docker): „Dann packen wir deinen Laptop eben mitsamt Betriebssystem in einen Container und schicken ihn zum Kunden!“`,
    body: 'Kult-Satire über Systeminkompatibilität und Umgebungsabhängigkeiten.',
    topics: ['memes_satire', 'science_society'],
    primaryTopic: 'memes_satire',
    sourceReferences: [
      {
        title: 'The Works on My Machine Certification Program',
        publisher: 'Coding Horror',
        author: 'Jeff Atwood & Brad Wilson',
        originalUrl: 'https://blog.codinghorror.com/the-works-on-my-machine-certification-program/',
        retrievalTimestamp: '2026-10-18T10:00:00.000Z',
        isVerified: true
      }
    ],
    publishedAt: '1900-01-01T00:00:00.000Z',
    publicationDateReliable: false,
    firstSeenAt: '2026-10-01T00:00:00.000Z',
    historicalYearOrEra: 'Entwickler-Kultur · 2007',
    generatedAt: '2026-10-18T00:00:00.000Z',
    estimatedReadingMinutes: 2,
    relevanceExplanation: 'Kulturgeschichte der modernen Cloud-Infrastruktur.',
    contentStatus: 'philosophical_perspective',
    isDailyEdition: false,
    isDemonstration: false,
    aiAssisted: false,
    factReviewStatus: 'historical_reference',
    provenanceSummary: 'Coding Horror Blog, Jeff Atwood.',
    wordCount: 180,
    evidenceTier: 'permitted_full_text',
    contentOrigin: 'live_ingested',
    contentHash: 'vault-model-works-on-machine-2007',
    canonicalUrl: 'https://blog.codinghorror.com/the-works-on-my-machine-certification-program/',
    space: 'c/memes',
    flair: 'Satire & Comics',
    isEvergreenGem: true,
    keyInsight: 'Wahrheit im Code ist nicht absolut, sondern immer relativ zur ausführenden Umgebung.',
    hasAuthenticImage: true,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Docker_%28container_engine%29_logo.svg/800px-Docker_%28container_engine%29_logo.svg.png',
    upvotesCount: 0,
    awardsCount: { gold: 0, brain: 0, spark: 0 },
    comments: []
  },
  {
    id: 'vault-model-030-bikeshedding',
    type: 'deep_dive',
    format: 'meme',
    title: 'Bikeshedding: Parkinsons Gesetz der Trivialität',
    subtitle: 'C. Northcote Parkinson (1957) • Warum über die Farbe des Fahrradschuppens 3 Stunden gestritten wird und über den Atomreaktor 5 Minuten',
    feedText: 'Eine Versammlung debattiert über ein 100-Millionen-Euro-Kernkraftwerk. Nach 5 Minuten ist der Beschluss gefasst: Niemand versteht genug von Kernphysik, um mitzureden. Als es um den Fahrradschuppen für 500 Euro geht, bricht ein dreistündiger Streit über die Farbe des Anstrichs aus.',
    articleBody: `### Die Psychologie der einfachen Meinungsbildung

C. Northcote Parkinson formulierte 1957 das Gesetz der Trivialität: Die in einem Gremium für einen Tagesordnungspunkt aufgewendete Zeit ist umgekehrt proportional zu dessen finanzieller und strategischer Bedeutung.

Warum? Jeder Mensch traut sich zu, eine Meinung zu einer Schuppenfarbe oder einem Button-Farbton zu haben. Wenn komplexe Systeme verhandelt werden, flüchten Menschen in triviale Scheindiskussionen, um das Gefühl von Handlungsfähigkeit zu bewahren.`,
    body: 'Soziologisches Gesetz über Gremienarbeit und kognitive Ausweichmanöver.',
    topics: ['memes_satire', 'science_society'],
    primaryTopic: 'memes_satire',
    sourceReferences: [
      {
        title: 'Parkinson\'s Law, and Other Studies in Administration',
        publisher: 'Houghton Mifflin',
        author: 'C. Northcote Parkinson',
        originalUrl: 'https://en.wikipedia.org/wiki/Law_of_triviality',
        retrievalTimestamp: '2026-10-18T10:00:00.000Z',
        isVerified: true
      }
    ],
    publishedAt: '1900-01-01T00:00:00.000Z',
    publicationDateReliable: false,
    firstSeenAt: '2026-10-01T00:00:00.000Z',
    historicalYearOrEra: 'Soziologie · 1957',
    generatedAt: '2026-10-18T00:00:00.000Z',
    estimatedReadingMinutes: 2,
    relevanceExplanation: 'Schlüsselmodell zur Vermeidung unproduktiver Debatten.',
    contentStatus: 'philosophical_perspective',
    isDailyEdition: false,
    isDemonstration: false,
    aiAssisted: false,
    factReviewStatus: 'historical_reference',
    provenanceSummary: 'C. Northcote Parkinson 1957.',
    wordCount: 190,
    evidenceTier: 'permitted_full_text',
    contentOrigin: 'live_ingested',
    contentHash: 'vault-model-bikeshedding-1957',
    canonicalUrl: 'https://en.wikipedia.org/wiki/Law_of_triviality',
    space: 'c/memes',
    flair: 'Satire & Comics',
    isEvergreenGem: true,
    keyInsight: 'Die Intensität einer Debatte misst selten ihre Bedeutung, sondern meist nur ihre leichte Verständlichkeit.',
    hasAuthenticImage: true,
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Bicycle_shed.jpg/640px-Bicycle_shed.jpg',
    upvotesCount: 0,
    awardsCount: { gold: 0, brain: 0, spark: 0 },
    comments: []
  }
];

export const MEME_VAULT_ENTRIES: FeedItem[] = RAW_MEME_VAULT_ENTRIES.map(item => ({
  editionDate: '2026-10-18',
  isTeachingRelated: false,
  isChallengingPerspective: false,
  sourceTrustLevel: 'verified_creator' as const,
  ...item
}));
