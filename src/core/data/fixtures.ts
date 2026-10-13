import { FeedItem } from '../domain/types';

export const INITIAL_FIXTURES: FeedItem[] = [
  // 1. Perspective: Ethics / AI / Epistemology
  {
    id: 'art-001-epistemic-agency',
    type: 'perspective',
    title: 'Epistemische Souveränität: Verlieren wir das Vertrauen in unser eigenes Urteil?',
    subtitle: 'Wenn Sprachmodelle plausible Antworten vorfabrizieren, verändert sich nicht nur das Wissen – sondern die Tugend des Selberdenkens.',
    body: `In der klassischen Erkenntnistheorie galt Wissen stets als „wahre, gerechtfertigte Überzeugung“ (Platon, Theaitetos). Doch was geschieht mit der Rechtfertigungskomponente, wenn Antworten in Sekundenschnelle von synthetischen Sprachmodellen formuliert werden?

Wir erleben derzeit eine subtile Verschiebung von der epistemischen Eigenleistung zur bloßen Evaluierung fremder Synthesen. Wo Schüler und Lehrende früher Argumentationsketten eigenhändig aufbauten, redigieren sie heute primär Vorschläge. Dies spart Zeit, entlastet jedoch genau jenen kognitiven Muskel, den Hannah Arendt als Voraussetzung für moralische Urteilskraft beschrieb: den stummen Dialog mit sich selbst.

Für den Ethikunterricht ergibt sich daraus ein fundamentales Paradoxon:
Einerseits befähigt uns KI, Gegenpositionen zu jedem beliebigen Dilemma in Sekunden zu generieren. Andererseits verführt die geschliffene Glätte maschineller Texte dazu, begriffliche Spannungen zu übersehen. Echte philosophische Einsicht entsteht jedoch selten an der Oberfläche wohlgeformter Sätze, sondern im Widerstand des ungelösten Widerspruchs.

Epistemische Souveränität bedeutet daher nicht, sich vor künstlicher Intelligenz zu verschließen. Sie bedeutet, die Anstrengung des Begriffs nicht an einen Algorithmus zu delegieren.`,
    topics: ['philosophy_ethics', 'ai_apple'],
    primaryTopic: 'philosophy_ethics',
    sourceReferences: [
      {
        publisher: 'Stanford Encyclopedia of Philosophy',
        originalUrl: 'https://plato.stanford.edu/entries/epistemology/',
        title: 'Epistemology and Epistemic Virtues',
        publicationTimestamp: '2025-11-14T09:00:00Z',
        retrievalTimestamp: '2026-10-13T10:00:00Z',
        author: 'Matthias Steup',
        isVerified: true
      },
      {
        publisher: 'Oxford Academic / Mind',
        originalUrl: 'https://academic.oup.com/mind',
        title: 'Cognitive Offloading and Autonomous Agency',
        publicationTimestamp: '2026-03-02T14:30:00Z',
        retrievalTimestamp: '2026-10-13T10:00:00Z',
        author: 'Dr. Helene Fischer-Lohmann',
        isVerified: true
      }
    ],
    publishedAt: '2026-10-12T07:15:00Z',
    generatedAt: '2026-10-13T06:00:00Z',
    estimatedReadingMinutes: 4,
    relevanceExplanation: 'Zentrale Schnittstelle Ihrer Kernfächer: Erkenntnistheorie trifft auf KI-Entwicklung.',
    contentStatus: 'philosophical_perspective',
    isDailyEdition: true,
    editionDate: '2026-10-13',
    editorialNote: 'Empfehlung der Redaktion für den heutigen Morgen: Nachdenken über Kognition vor dem ersten Scrollen.',
    deepeningOptions: {
      didacticSeed: 'Lassen Sie Schülerinnen und Schüler ein Argument von zwei KIs im Streitgespräch generieren und anschließend die logische Lücke im Text aufspüren.',
      counterArgument: 'Clark & Chalmers (Extended Mind Thesis): Geist und Erkenntnis waren immer schon an externe Werkzeuge (Schrift, Notizbuch) gekoppelt. KI ist lediglich die konsequente Fortsetzung.',
      philosophicalContext: 'Immanuel Kant: Was ist Aufklärung? („Habe Muth, dich deines eigenen Verstandes zu bedienen!“)',
      reflectionPrompt: 'Wann haben Sie heute das letzte Mal eine schwierige Frage selbst durchdacht, statt sie einer Such- oder Chat-Maske zu übergeben?'
    }
  },

  // 2. German Didactics: Professional Knowledge
  {
    id: 'art-002-schreibfoerderung-sek1',
    type: 'deep_dive',
    title: 'Textknacker statt Schreibblockade: Narrative Strukturen in der Sekundarstufe I',
    subtitle: 'Neue empirische Befunde aus der Schreibdidaktik zeigen, warum offene Schreibimpulse schwächere Schüler überfordern – und wie Scaffolding Abhilfe schafft.',
    body: `Der Deutschunterricht in den Klassenstufen 7 und 8 steht vor einer chronischen Herausforderung: die Schere zwischen sprachlich versierten Lernenden und jenen, die bei Aufsatzthemen vor einem leeren Blatt kapitulieren. 

Eine aktuelle Metastudie des Mercator-Instituts und der Universität Leipzig zeigt: Reine „Kreativimpulse“ ohne strukturelles Gerüst (Scaffolding) vergrößern den Leistungsabstand messbar. Schüler mit geringerer basaler Schreibflüssigkeit benötigen vor dem Ausformulieren explizite narrative Prototypen.

Drei didaktische Hebel haben sich in sächsischen Modellklassen als besonders wirksam erwiesen:

1. Phasenweises Schreiben mit Entlastung:
Die Trennung von Ideenfindung, formaler Textplanung und stilistischer Überarbeitung verhindert die kognitive Überlastung des Arbeitsgedächtnisses.

2. Makrostrukturen als taktile Karten:
Statt theoretischer Aufsatzregeln arbeiten die Lernenden mit physischen oder digitalen Satz- und Handlungskarten, die die Dynamik von Exposition, retardierendem Moment und Peripetie sichtbar machen.

3. Kriteriengeleitete Peer-Rückmeldungen:
Schüler prüfen gezielt nur ein einziges Kriterium im Text des Partners (z.B. Perspektivwechsel oder Metapherndichte), wodurch die Revisionskompetenz dramatisch ansteigt.

Für die Unterrichtsvorbereitung bedeutet dies: Weniger Korrekturaufwand am Endprodukt, mehr formative Begleitung im Entstehungsprozess.`,
    topics: ['german_didactics'],
    primaryTopic: 'german_didactics',
    sourceReferences: [
      {
        publisher: 'Deutsches Schulportal / Robert Bosch Stiftung',
        originalUrl: 'https://deutsches-schulportal.de/unterricht/schreibdidaktik-sekundarstufe-forschungsueberblick/',
        title: 'Forschungsüberblick: Wirksame Schreibförderung im Deutschunterricht',
        publicationTimestamp: '2026-09-18T11:00:00Z',
        retrievalTimestamp: '2026-10-13T08:00:00Z',
        author: 'Prof. Dr. Michael Becker-Mrotzek',
        isVerified: true
      }
    ],
    publishedAt: '2026-10-11T14:20:00Z',
    generatedAt: '2026-10-13T06:00:00Z',
    estimatedReadingMinutes: 5,
    relevanceExplanation: 'Direkte Relevanz für Ihre Unterrichtsplanung in Deutsch (Sekundarstufe I, Sachsen).',
    contentStatus: 'scientific_analysis',
    isDailyEdition: true,
    editionDate: '2026-10-13',
    editorialNote: 'Praxisnah und forschungsgestützt für den Unterrichtsalltag.',
    deepeningOptions: {
      didacticSeed: 'Kombinieren Sie Schreibphasen mit gezieltem Zwischenfeedback nach Absatz 1: Schüler lesen sich gegenseitig nur den Eröffnungssatz vor.',
      counterArgument: 'Einige Didaktiker warnen vor Über-Schematisierung: Zu starres Scaffolding kann den individuellen Schreibstil und die Freude am freien Erzählen hemmen.',
      philosophicalContext: 'Lev Vygotsky: Die Zone der nächsten Entwicklung (Zone of Proximal Development) und soziokulturelle Sprachtheorie.',
      reflectionPrompt: 'Welche Methode hilft Ihren Schülerinnen und Schülern am verlässlichsten über die erste Texthemmschwelle?'
    }
  },

  // 3. Contemplation & Mind: Buddhism & Cognitive Psychology
  {
    id: 'art-003-satipatthana-dopamine',
    type: 'connection',
    title: 'Achtsamkeit gegen die Rillen des Begehrens: Was Satipaṭṭhāna über den Scroll-Reflex wusste',
    subtitle: 'Die buddhistische Analyse von Vedanā (Gefühlston) entschlüsselt die Neurochemie digitaler Belohnungsschleifen überraschend präzise.',
    body: `Wenn der Daumen im Halbschlaf über das Display gleitet, vollzieht das Nervensystem einen Prozess, den die Psychologie als „Intermittent Variable Reward“ bezeichnet: Die vage Aussicht auf einen unvorhersehbaren Reiz hält uns im Automatismus gefangen.

Interessanterweise analysiert das altindische *Satipaṭṭhāna Sutta* diesen Mechanismus vor über zweitausend Jahren mit verblüffender Schärfe. Der Schlüssel liegt in der Achtsamkeit auf *Vedanā* – den unmittelbaren, oft unbewussten Gefühlston (angenehm, unangenehm, neutral), der jeder Sinneswahrnehmung unmittelbar folgt.

Der buddhistische Psychologie zufolge entsteht Leiden (*Dukkha*) nicht durch den sensorischen Reiz an sich, sondern durch die unreflektierte Reaktion auf den Gefühlston:
- Angenehmes erzeugt sofortiges Greifen (*Taṇhā* / Verlangen nach Verlängerung).
- Unangenehmes erzeugt Aversion (*Dosa* / Ablenkungsdrang).
- Neutrales erzeugt Langeweile und Unruhe (*Moha*).

Beim Doomscrolling fliehen wir meist vor dem neutralen oder leicht unangenehmen Zustand des Nicht-Beschäftigtseins. Der Geist sucht hektisch nach einem angenehmen Mikro-Impuls. 

Die Praxis des Innehaltens besteht darin, den winzigen Sekundenbruchteil zwischen Vedanā und Reaktionsmuster wahrzunehmen:
„Hier ist ein Gefühl von Leere oder Langeweile. Es muss nicht durch einen Swipe gelöscht werden.“ In diesem mikroskopischen Zwischenraum liegt echte Handlungsfreiheit.`,
    topics: ['contemplation_mind', 'philosophy_ethics'],
    primaryTopic: 'contemplation_mind',
    sourceReferences: [
      {
        publisher: 'Access to Insight / Pali Canon Historical Archive',
        originalUrl: 'https://www.accesstoinsight.org/tipitaka/mn/mn.010.nysa.html',
        title: 'The Satipatthana Sutta: The Foundations of Mindfulness',
        publicationTimestamp: '2024-05-01T00:00:00Z',
        retrievalTimestamp: '2026-10-13T09:30:00Z',
        author: 'Nyanaponika Thera',
        isVerified: true
      },
      {
        publisher: 'Trends in Cognitive Sciences',
        originalUrl: 'https://www.cell.com/trends/cognitive-sciences',
        title: 'Affective Valuation and the Habitual Loop of Digital Foraging',
        publicationTimestamp: '2026-01-15T16:00:00Z',
        retrievalTimestamp: '2026-10-13T09:30:00Z',
        author: 'Judson Brewer et al.',
        isVerified: true
      }
    ],
    publishedAt: '2026-10-12T19:00:00Z',
    generatedAt: '2026-10-13T06:00:00Z',
    estimatedReadingMinutes: 3,
    relevanceExplanation: 'Verbindet kontemplative Philosophie mit der Kernintention unserer App: Ausstieg aus dem Automatismus.',
    contentStatus: 'philosophical_perspective',
    isDailyEdition: true,
    editionDate: '2026-10-13',
    editorialNote: 'Eine philosophische Brücke zwischen alter Weisheitslehre und moderner Verhaltensneurobiologie.',
    deepeningOptions: {
      didacticSeed: 'Gedankenexperiment für den Ethikunterricht: Wo verläuft die Grenze zwischen freier Wahl und designter Gewohnheit?',
      counterArgument: 'Evolutionspsychologische Perspektive: Informationssuche ist ein uralter Überlebensinstinkt (Information Foraging), kein neuzeitliches Zivilisationsversagen.',
      philosophicalContext: 'Epiktet / Stoizismus: „Nicht die Dinge beunruhigen die Menschen, sondern die Meinungen über die Dinge.“',
      reflectionPrompt: 'Spüren Sie gerade den Atem im Körper oder die Anspannung in den Schultern?'
    }
  },

  // 4. AI & Apple: Technical Ecosystem Insight
  {
    id: 'art-004-on-device-foundation-models',
    type: 'briefing',
    title: 'Lokale Inferenz im Hosentaschenformat: Was moderne On-Device-Modelle auf dem iPhone leisten',
    subtitle: 'Kompression durch 4-Bit-Quantisierung und NPU-Architekturen machen lokale Sprachmodelle energieeffizient. Warum das für Datenschutz und Privatsphäre alles ändert.',
    body: `Jahrelang galt das Paradigma: Ernstzunehmende künstliche Intelligenz benötigt gigantische Rechenzentren, hunderte Gigawattstunden Strom und eine permanente Internetverbindung. Doch die jüngsten Entwicklungen im Bereich spezialisierter Hardware (Apples Neural Engine ab A17 Pro und M-Chips) sowie radikale Fortschritte bei Post-Training-Quantisierungen verschieben die Grenzen.

Kompakte Modelle mit 3 bis 8 Milliarden Parametern erreichen durch Techniken wie Sparsity, Grouped-Query Attention und AWQ (Activation-aware Weight Quantization) heute logische Fähigkeiten, die vor drei Jahren Modellen der GPT-3.5-Klasse vorbehalten waren – und laufen dabei vollständig im lokalen Arbeitsspeicher des Telefons.

Drei Konsequenzen für den Alltag:

1. Zero-Telemetry-Privatsphäre:
Notizen, Unterrichtsentwürfe oder persönliche Gedanken müssen kein Rechenzentrum eines Drittanbieters in Kalifornien berühren, um semantisch analysiert oder paraphrasiert zu werden.

2. Null Latenz, keine Funkloch-Abhängigkeit:
Ein Lesewerkzeug funktioniert im Flugzeug, im Funkloch im ICE oder im Klassenraum ohne stabiles WLAN mit identischer Reaktionsschnelligkeit.

3. Deterministische Kontrollierbarkeit:
Auf dem Gerät eingebettete Modelle lassen sich über strikte Schemata (wie Zod oder JSON Schema) zwingen, reproduzierbare Datenstrukturen auszugeben, anstatt unkontrolliert zu halluzinieren.

Für Atem bildet diese Philosophie das architektonische Leitbild: Lokale Datenhoheit statt zentraler Nutzerprofile.`,
    topics: ['ai_apple', 'science_society'],
    primaryTopic: 'ai_apple',
    sourceReferences: [
      {
        publisher: 'Apple Machine Learning Research',
        originalUrl: 'https://machinelearning.apple.com/research',
        title: 'On-Device Foundation Models: Architecture and Efficient Execution',
        publicationTimestamp: '2026-06-10T15:00:00Z',
        retrievalTimestamp: '2026-10-13T07:45:00Z',
        author: 'Apple CoreML Engineering Team',
        isVerified: true
      }
    ],
    publishedAt: '2026-10-13T05:30:00Z',
    generatedAt: '2026-10-13T06:00:00Z',
    estimatedReadingMinutes: 3,
    relevanceExplanation: 'Technischer Hintergrund zu den Möglichkeiten Ihres iPhone 15 Pro und zukunftssicherer Architektur.',
    contentStatus: 'verified_fact',
    isDailyEdition: true,
    editionDate: '2026-10-13',
    editorialNote: 'Fokus auf Technologie im Dienst der menschlichen Autonomie.',
    deepeningOptions: {
      didacticSeed: 'Diskutieren Sie mit Schülerinnen und Schülern: Sollten schulische Schreibhilfen nur lokal laufen dürfen, um Chancengleichheit und Datenschutz zu garantieren?',
      counterArgument: 'Größere Cloud-Cluster werden bei extrem komplexen Reasoning-Ketten (z.B. vielschichtige Logikbeweise) stets die qualitative Oberhand behalten.',
      philosophicalContext: 'Technikphilosophie (Günther Anders / Die Antiquiertheit des Menschen): Das Verhältnis von Werkzeugbeherrschung und Autonomie.',
      reflectionPrompt: 'Wie wichtig ist es Ihnen, dass Ihre Notizen und Texte niemals die Grenzen Ihres eigenen Geräts verlassen?'
    }
  },

  // 5. Sound & Synthesis: Creative Thought
  {
    id: 'art-005-ambient-generative-music',
    type: 'quick_insight',
    title: 'Brian Enos Diskretion: Wie generative Klanglandschaften den Fokus schärfen',
    subtitle: 'Warum Ambient-Musik nicht einfach „Hintergrundberieselung“ ist, sondern eine architektonische Raumgestaltung für konzentriertes Denken.',
    body: `Als Brian Eno 1978 sein Manifest zu *Music for Airports* formulierte, postulierte er eine scheinbar paradoxe Anforderung: „Ambient Music must be as ignorable as it is interesting.“

Neuere neuropsychologische Untersuchungen zu neuronalen Oszillationen stützen diese These: Bestimmte, unaufdringliche Klangtexturen mit unregelmäßigen Intervallen und sanften Filtern (Low-Pass Filter sweeps) modulieren die Alpha-Wellen-Aktivität im präfrontalen Kortex. Sie maskieren störende Außengeräusche, ohne das Sprachzentrum zu beanspruchen – im Gegensatz zu strophischer Popmusik mit Gesang, die mit dem sprachlichen Arbeitsgedächtnis beim Lesen konkurriert.

In der Praxis elektronischer Synthesizer (wie in Ableton oder modularen Eurorack-Setups) lässt sich dies durch stochastische LFOs und probabilistische Hüllkurven abbilden: Muster, die sich ähneln, aber niemals exakt wiederholen. Ein akustisches Äquivalent zu fallendem Regen oder fließendem Wasser – ideal für anspruchsvolles Lesen.`,
    topics: ['sound_synthesis', 'contemplation_mind'],
    primaryTopic: 'sound_synthesis',
    sourceReferences: [
      {
        publisher: 'Sound on Sound Magazine',
        originalUrl: 'https://www.soundonsound.com/techniques/generative-music-systems',
        title: 'Designing Generative Ambient Systems in Modern DAWs',
        publicationTimestamp: '2025-08-12T12:00:00Z',
        retrievalTimestamp: '2026-10-13T08:15:00Z',
        author: 'Paul White',
        isVerified: true
      }
    ],
    publishedAt: '2026-10-12T11:00:00Z',
    generatedAt: '2026-10-13T06:00:00Z',
    estimatedReadingMinutes: 2,
    relevanceExplanation: 'Schlägt die Brücke zwischen Klangsynthese, Ästhetik und konzentrierter Leseatmosphäre.',
    contentStatus: 'editorial_briefing',
    isDailyEdition: true,
    editionDate: '2026-10-13',
    editorialNote: 'Kompakte 2-Minuten-Lektüre für kreative Inspiration.',
    deepeningOptions: {
      didacticSeed: 'Musik im Unterricht: Kann unaufdringlicher Ambient-Klang bei Stillarbeitsphasen die Konzentration von unruhigen Klassen spürbar stabilisieren?',
      counterArgument: 'Manche Kognitionspsychologen argumentieren, dass absolute Stille für komplexe Textverständnisprozesse jeder noch so sanften Klangteppich-Beschallung überlegen ist.',
      philosophicalContext: 'Theodor W. Adorno: Philosophie der neuen Musik und die Frage nach dem Hören im Spätkapitalismus.',
      reflectionPrompt: 'Welche Klangkulisse begleitet Ihre produktivsten Lese- und Denkphasen?'
    }
  },

  // 6. Discovery: Science & Society (Beyond immediate bubble)
  {
    id: 'art-006-quantum-biology-photosynthesis',
    type: 'discovery',
    title: 'Quantenkohärenz im Blattgrün: Leben an der Grenze der klassischen Physik',
    subtitle: 'Lange hielten Physiker lebende Zellen für zu warm und feucht für Quanteneffekte. Die Quantenbiologie widerlegt diesen Glaubenssatz.',
    body: `In der konventionellen Festkörperphysik existieren empfindliche Quantenzustände wie Superposition und Verschränkung nur in extrem isolierten Hochvakuum-Kammern bei Temperaturen nahe dem absoluten Nullpunkt. Jede thermische Vibration zerstört die Kohärenz sofort.

Umso erstaunlicher war die Entdeckung der vergangenen Jahre, dass biologische Systeme – insbesondere der Lichtsammelkomplex bei der pflanzlichen Photosynthese – Quantenkohärenz bei Zimmertemperatur nutzen, um Lichtenergie mit nahezu 100% Wirkungsgrad in chemische Energie umzuwandeln.

Exzitonen (gebundene Elektronen-Loch-Paare) „testen“ gewissermaßen gleichzeitig mehrere Pfade durch das Molekülnetzwerk ab und wählen nach Gesetzen der Quantenwahrscheinlichkeit den energieeffizientesten Weg zum Reaktionszentrum.

Diese Entdeckung stellt eine fundamentale philosophische Frage neu: Ist das Phänomen „Leben“ nicht bloß eine komplexe makroskopische Chemie, sondern eine hochentwickelte Schnittstelle, die Quantenphänomene gezielt zähmt und für Überlebensfunktionen nutzbar macht?`,
    topics: ['science_society', 'philosophy_ethics'],
    primaryTopic: 'science_society',
    sourceReferences: [
      {
        publisher: 'Nature Physics',
        originalUrl: 'https://www.nature.com/nphys',
        title: 'Quantum coherence in photosynthetic light-harvesting complexes',
        publicationTimestamp: '2026-02-19T14:00:00Z',
        retrievalTimestamp: '2026-10-13T09:00:00Z',
        author: 'Dr. Gregory Scholes & Team',
        isVerified: true
      }
    ],
    publishedAt: '2026-10-10T16:45:00Z',
    generatedAt: '2026-10-13T06:00:00Z',
    estimatedReadingMinutes: 4,
    relevanceExplanation: 'Entdeckungs-Artikel: Faszinierende Naturwissenschaft jenseits des Alltäglichen.',
    contentStatus: 'scientific_analysis',
    isDailyEdition: false, // Extended discovery stream
    editionDate: '2026-10-13',
    editorialNote: 'Horizont-Erweiterung: Wo Physik, Biologie und Naturphilosophie verschmelzen.',
    deepeningOptions: {
      didacticSeed: 'Ein spannendes Thema für fächerübergreifenden Unterricht (Ethik / Biologie / Physik): Was unterscheidet lebende Materie von unbelebter?',
      counterArgument: 'Einige theoretische Physiker mahnen zur Vorsicht: Viele beobachtete Effekte lassen sich möglicherweise auch über semiklassische Wellenmodelle ohne echte Quantenüberlagerung erklären.',
      philosophicalContext: 'Erwin Schrödinger: *Was ist Leben?* (1944) – die historische Vorahnung molekularer Informationsträger.',
      reflectionPrompt: 'Wie verändert diese Perspektive Ihren Blick auf einen simplen Baum im Dresdner Großen Garten?'
    }
  },

  // 7. Perspective: Ethics & Moral Dilemmas in Education
  {
    id: 'art-007-moral-dilemmas-classroom',
    type: 'perspective',
    title: 'Das Trolley-Problem ist tot: Warum Jugendliche realitätsnahe Dilemmata brauchen',
    subtitle: 'Hypothetische Weichenstellungen wirken auf Schüler oft steril. Wie zeitgenössische Konflikte echte moralische Urteilskraft entfachen.',
    body: `Fast jedes Schulbuch für den Ethikunterricht beginnt beim Thema Pflichtenlehre oder Utilitarismus mit dem klassischen Weichensteller-Problem von Philippa Foot. Doch Lehrkräfte kennen die gängige Schülerreaktion: zynische Scherze, Absurditäten („Kann ich beide Gleise sprengen?“) und emotionale Distanz.

Der Grund: Das Trolley-Problem ist ein extremes Gedankenexperiment ohne sozialen Kontext. Echte moralische Urteilskraft (im Sinne von Lawrence Kohlberg oder Carol Gilligan) bildet sich jedoch nicht an künstlichen Extremen, sondern an Dilemmata mit Ambiguität und existenzieller Relevanz:

- Whistleblowing im Freundeskreis: Melde ich den Missbrauch eines Schulfreundes, wenn dieser schwere seelische Schäden anrichtet, aber meine Clique mich dann verstößt?
- Digitale Zivilcourage: Wann kippt berechtigte Kritik in einen unkontrollierbaren Shitstorm?
- Ökologische Gerechtigkeit: Welche Opfer sind der eigenen Generation zumutbar, wenn das globale Handeln asymmetrisch verläuft?

Wenn Lernende spüren, dass es keine „Musterlösung auf Seite 142“ gibt und beide Handlungsoptionen echte, schmerzhafte Kosten verursachen, verwandelt sich der Ethikunterricht von einer theoretischen Vorlesung in ein lebendiges Laboratorium der Demokratie.`,
    topics: ['philosophy_ethics', 'german_didactics'],
    primaryTopic: 'philosophy_ethics',
    sourceReferences: [
      {
        publisher: 'Zeitschrift für Didaktik der Philosophie und Ethik (ZDPE)',
        originalUrl: 'https://www.fachportal-paedagogik.de/literatur/zdpe',
        title: 'Gedankenexperimente und Problemorientierung im modernen Ethikunterricht',
        publicationTimestamp: '2025-10-05T10:00:00Z',
        retrievalTimestamp: '2026-10-13T08:30:00Z',
        author: 'Dr. Volker Steenblock',
        isVerified: true
      }
    ],
    publishedAt: '2026-10-09T08:30:00Z',
    generatedAt: '2026-10-13T06:00:00Z',
    estimatedReadingMinutes: 4,
    relevanceExplanation: 'Zentral für Ihren Ethikunterricht: Brücke zwischen Moralphilosophie und pädagogischer Praxis.',
    contentStatus: 'philosophical_perspective',
    isDailyEdition: false,
    editionDate: '2026-10-13',
    editorialNote: 'Didaktischer Impuls für die Unterrichtsplanung.',
    deepeningOptions: {
      didacticSeed: 'Methode des sokratischen Gesprächs: Lassen Sie Schüler Regeln aufstellen, die ausnahmslos für alle gelten müssten, und fordern Sie sie auf, selbst die Grenzen der Regel zu finden.',
      counterArgument: 'Verteidigung des Gedankenexperiments: Reduktion auf die Extreme isoliert ethische Variablen sauber von emotionalen Verzerrungen.',
      philosophicalContext: 'Aristoteles: Phronesis (praktische Klugheit) als Fähigkeit, das Angemessene im konkreten Einzelfall zu erkennen.',
      reflectionPrompt: 'Welches moralische Dilemma hat Sie in Ihrem eigenen Leben zuletzt am nachhaltigsten herausgefordert?'
    }
  }
];

export const DEFAULT_USER_PROFILE = {
  language: 'de' as const,
  region: 'de' as const,
  explicitInterests: {
    philosophy_ethics: 0.95,
    german_didactics: 0.90,
    ai_apple: 0.85,
    contemplation_mind: 0.80,
    science_society: 0.70,
    sound_synthesis: 0.65
  },
  readingPreferences: {
    preferredDuration: 'balanced' as const,
    theme: 'system' as const,
    fontSize: 'md' as const
  },
  isOnboarded: true, // Default to true so app works immediately, but reset button is available!
  lastActiveDate: '2026-10-13'
};
