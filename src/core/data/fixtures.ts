import { FeedItem, TopicTag, UserProfile, TOPIC_SPACE_MAP, CommunityComment, SparringReply } from '../domain/types';

/**
 * High-quality, fast-loading curated aesthetic imagery matched to user's intellectual domains.
 */
export const TOPIC_CURATED_IMAGES: Record<TopicTag, string[]> = {
  ai_apple: [
    'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=1200&q=80'
  ],
  german_didactics: [
    'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=1200&q=80'
  ],
  philosophy_ethics: [
    'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1507499739999-097706ad8914?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1461360370896-922624d12aa1?auto=format&fit=crop&w=1200&q=80'
  ],
  sound_synthesis: [
    'https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1539375665275-f9de415ef9ac?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1200&q=80'
  ],
  contemplation_mind: [
    'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1518241353330-0f7941c2d9b5?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80'
  ],
  science_society: [
    'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=1200&q=80'
  ],
  memes_satire: [
    'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1541701494587-cb58502866ab?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80'
  ],
  youtube_gems: [
    'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1536240478700-b869070f9279?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=1200&q=80'
  ],
  book_mastery: [
    'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1491841550275-ad7854e35ca6?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1506880018603-83d5b814b5a6?auto=format&fit=crop&w=1200&q=80'
  ],
  health_biohacking: [
    'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=1200&q=80'
  ],
  opportunities_growth: [
    'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1200&q=80'
  ]
};

export function getCuratedImageForTopic(topic: TopicTag, seed: string = ''): string {
  const images = TOPIC_CURATED_IMAGES[topic] || TOPIC_CURATED_IMAGES.philosophy_ethics;
  let code = 0;
  for (let i = 0; i < seed.length; i++) code += seed.charCodeAt(i);
  return images[code % images.length];
}

/**
 * Generates 3 simulated Reddit community comments tailored to the topic and content.
 */
export function getSimulatedCommentsForTopic(
  topic: TopicTag,
  title: string,
  seed: string = ''
): CommunityComment[] {
  let numSeed = 0;
  for (let i = 0; i < seed.length; i++) numSeed += seed.charCodeAt(i);

  switch (topic) {
    case 'philosophy_ethics':
      return [
        {
          id: `c_${seed}_1`,
          authorHandle: 'u/kant_dresden',
          authorBadge: 'Philosophie Sek II',
          timeAgo: 'vor 3 Std.',
          score: 48 + (numSeed % 25),
          commentType: 'dialectic_critique',
          text: `Spannender Punkt bezüglich „${title.slice(0, 50)}…“. Aber setzt dieses Argument nicht stillschweigend voraus, dass Erkenntnis rein diskursiv verfasst ist? Was passiert, wenn wir die phänomenologische Leiblichkeit mitdenken?`
        },
        {
          id: `c_${seed}_2`,
          authorHandle: 'u/didaktik_labor',
          authorBadge: 'Fachleiter Ethik',
          timeAgo: 'vor 2 Std.',
          score: 34 + (numSeed % 18),
          commentType: 'didactic_transfer',
          text: 'Hervorragend als Einstiegsdilemma für eine 11. Klasse. Erst intuitives Schüler-Votum einholen, danach im sokratischen Streitgespräch die stillen Prämissen dekonstruieren.'
        },
        {
          id: `c_${seed}_3`,
          authorHandle: 'u/epistem_x',
          authorBadge: 'Erkenntnistheorie',
          timeAgo: 'vor 1 Std.',
          score: 19 + (numSeed % 12),
          commentType: 'creative_synthesis',
          text: 'Erinnert stark an die Kohärenztheorie: Nicht der isolierte Satz entscheidet über Wahrheit, sondern wie widerspruchsfrei er sich in das bestehende Netz unserer Überzeugungen einfügt.'
        }
      ];

    case 'german_didactics':
      return [
        {
          id: `c_${seed}_1`,
          authorHandle: 'u/deutsch_sek_ii',
          authorBadge: 'Gymnasiallehrer Dresden',
          timeAgo: 'vor 4 Std.',
          score: 52 + (numSeed % 20),
          commentType: 'didactic_transfer',
          text: `Die größte Hürde im Schulalltag ist oft die Begriffsabstraktion: Viele Schüler bleiben an Einzelfällen hängen. Bei „${title.slice(0, 45)}…“ lohnt sich ein Advance Organizer vor der Textlektüre.`
        },
        {
          id: `c_${seed}_2`,
          authorHandle: 'u/sokrates_didaktik',
          authorBadge: 'Seminarleiter',
          timeAgo: 'vor 2 Std.',
          score: 39 + (numSeed % 15),
          commentType: 'dialectic_critique',
          text: 'Genau das Gegenteil von stumpfem Bulimielernen. Wenn man den Jugendlichen den geschützten Raum gibt, eigene Thesen und Gegenargumente zu wagen, entsteht echte Urteilskraft nach dem Beutelsbacher Konsens.'
        },
        {
          id: `c_${seed}_3`,
          authorHandle: 'u/lit_und_code',
          authorBadge: 'Medienpädagogik',
          timeAgo: 'vor 45 Min.',
          score: 22 + (numSeed % 10),
          commentType: 'creative_synthesis',
          text: 'Didaktische Idee: Die Schüler diesen Originaltext mit einer KI zusammenfassen lassen und anschließend systematisch die blinden Flecken der KI-Zusammenfassung analysieren.'
        }
      ];

    case 'ai_apple':
      return [
        {
          id: `c_${seed}_1`,
          authorHandle: 'u/open_weights_fan',
          authorBadge: 'ML-Architekt',
          timeAgo: 'vor 5 Std.',
          score: 65 + (numSeed % 30),
          commentType: 'dialectic_critique',
          text: 'Die eigentliche Kernfrage hierbei ist Souveränität: Wenn wir proprietären Cloud-Modellen unser Denken anvertrauen, verlieren wir die Kontrolle über unsere epistemischen Werkzeuge. Lokale Inferenz ist der einzige Weg.'
        },
        {
          id: `c_${seed}_2`,
          authorHandle: 'u/didaktik_labor',
          authorBadge: 'Ethik & Medien',
          timeAgo: 'vor 3 Std.',
          score: 42 + (numSeed % 16),
          commentType: 'didactic_transfer',
          text: 'In der Schule beobachten wir: Sobald der Denkprozess an LLMs delegiert wird, erodiert die kognitive Frustrationstoleranz. Wir brauchen Interfaces wie Atem, die zum eigenen Formulieren herausfordern!'
        },
        {
          id: `c_${seed}_3`,
          authorHandle: 'u/silicon_monk',
          authorBadge: 'Apple Systems',
          timeAgo: 'vor 1 Std.',
          score: 31 + (numSeed % 14),
          commentType: 'creative_synthesis',
          text: 'Unified Memory auf Apple Silicon zeigt, wie die Hardware-Architektur das Nutzungsmuster prägt: 16–32 GB geteilter Speicher machen lokale 8B-Modelle in Millisekunden privat nutzbar.'
        }
      ];

    case 'sound_synthesis':
      return [
        {
          id: `c_${seed}_1`,
          authorHandle: 'u/patch_cables_only',
          authorBadge: 'Modular Alchemist',
          timeAgo: 'vor 4 Std.',
          score: 46 + (numSeed % 22),
          commentType: 'creative_synthesis',
          text: 'Das erinnert mich an Serge-Wavefolder: Nicht die vorgegebene Tonleiter erzeugt musikalische Tiefe, sondern die feinstufige analoge Phasenverschiebung im Frequenzspektrum.'
        },
        {
          id: `c_${seed}_2`,
          authorHandle: 'u/deep_listening',
          authorBadge: 'Klangökologie',
          timeAgo: 'vor 2 Std.',
          score: 33 + (numSeed % 15),
          commentType: 'dialectic_critique',
          text: 'Akustische Kontemplation schult dieselben Hirnareale wie tiefes Lesen. In einer Welt permanenter Dopamin-Pings ist bewusstes Verweilen in einer Klangschleife ein subversiver Akt.'
        },
        {
          id: `c_${seed}_3`,
          authorHandle: 'u/lofi_artisan',
          authorBadge: 'Improvisation',
          timeAgo: 'vor 50 Min.',
          score: 21 + (numSeed % 11),
          commentType: 'didactic_transfer',
          text: 'Praxistipp: Reduziert man die musikalischen Kontrollparameter auf zwei bis drei Drehregler, zwingt man sich selbst zu echtem Ausdruck statt technischer Ablenkung.'
        }
      ];

    case 'science_society':
      return [
        {
          id: `c_${seed}_1`,
          authorHandle: 'u/fakt_und_diskurs',
          authorBadge: 'Wissenschaftsredaktion',
          timeAgo: 'vor 3 Std.',
          score: 59 + (numSeed % 25),
          commentType: 'dialectic_critique',
          text: `Gute Einordnung zu „${title.slice(0, 48)}…“. Wichtig ist die saubere Unterscheidung zwischen vorläufigen Korrelationsbefunden und methodisch gesicherter Kausalität.`
        },
        {
          id: `c_${seed}_2`,
          authorHandle: 'u/politischer_lehrer',
          authorBadge: 'Gemeinschaftskunde Sek II',
          timeAgo: 'vor 2 Std.',
          score: 41 + (numSeed % 17),
          commentType: 'didactic_transfer',
          text: 'Genau das müssen wir Schülern vermitteln: Wie orientiert man sich in komplexen gesellschaftlichen Debatten anhand verifizierter, öffentlich-rechtlicher Quellen ohne in Zynismus zu verfallen?'
        },
        {
          id: `c_${seed}_3`,
          authorHandle: 'u/gesellschaft_2030',
          authorBadge: 'Techniksoziologe',
          timeAgo: 'vor 1 Std.',
          score: 26 + (numSeed % 13),
          commentType: 'creative_synthesis',
          text: 'Institutionelles Vertrauen wächst nur dort, wo Menschen als mündige, denkende Wesen angesprochen werden – nicht als Klick-Vieh für Werbealgorithmen.'
        }
      ];

    case 'memes_satire':
      return [
        {
          id: `c_${seed}_1`,
          authorHandle: 'u/meme_sokrates',
          authorBadge: 'Satirischer Philosoph',
          timeAgo: 'vor 3 Std.',
          score: 84 + (numSeed % 40),
          commentType: 'dialectic_critique',
          text: 'Der kategorische Imperativ greift hier nicht: Handle nur nach der Maxime, durch die du zugleich wollen kannst, dass dein Meme zum universellen Gesetz wird!'
        },
        {
          id: `c_${seed}_2`,
          authorHandle: 'u/syntax_schmerz',
          authorBadge: 'Senior Dev & Zyniker',
          timeAgo: 'vor 1 Std.',
          score: 59 + (numSeed % 25),
          commentType: 'creative_synthesis',
          text: 'Zu real. Musste im Meeting kurz mein Mikrofon muten, weil ich laut aufgelacht habe. Treffender kann man den Tech-Wahnsinn nicht kondensieren.'
        },
        {
          id: `c_${seed}_3`,
          authorHandle: 'u/postironie_dresden',
          authorBadge: 'Kulturkritik',
          timeAgo: 'vor 45 Min.',
          score: 31 + (numSeed % 15),
          commentType: 'didactic_transfer',
          text: 'Memes sind die Hieroglyphen des 21. Jahrhunderts: Hochkomprimierte semantische Sinnkerne, die ganze philosophische Abhandlungen in einem einzigen Bildframe transportieren.'
        }
      ];

    case 'youtube_gems':
      return [
        {
          id: `c_${seed}_1`,
          authorHandle: 'u/video_essay_junkie',
          authorBadge: 'Deep Learner',
          timeAgo: 'vor 4 Std.',
          score: 72 + (numSeed % 30),
          commentType: 'creative_synthesis',
          text: 'Dieses Video ist pure Magie. Ab Minute 12:45 fällt der Vorhang – die Visualisierung hat bei mir ein monatelanges theoretisches Missverständnis in 2 Minuten gelöst.'
        },
        {
          id: `c_${seed}_2`,
          authorHandle: 'u/didaktik_labor',
          authorBadge: 'Fachdidaktik Sek II',
          timeAgo: 'vor 2 Std.',
          score: 48 + (numSeed % 19),
          commentType: 'didactic_transfer',
          text: 'Exakt solche 3-Minuten-Sequenzen eignen sich meisterhaft als stummer Impuls für eine gymnasiale Oberstufe. Erst staunen lassen, dann formalisieren.'
        },
        {
          id: `c_${seed}_3`,
          authorHandle: 'u/curator_gems',
          authorBadge: 'Wissens-Schatzsucher',
          timeAgo: 'vor 50 Min.',
          score: 29 + (numSeed % 14),
          commentType: 'dialectic_critique',
          text: 'Der Algorithmus empfiehlt einem sonst nur Trash – umso wertvoller, dass dieses Juwel hier im privaten Social Network geborgen wird.'
        }
      ];

    case 'book_mastery':
      return [
        {
          id: `c_${seed}_1`,
          authorHandle: 'u/bibliophil_berlin',
          authorBadge: 'Viel-Leser & Notizen-Sammler',
          timeAgo: 'vor 5 Std.',
          score: 91 + (numSeed % 35),
          commentType: 'creative_synthesis',
          text: 'Kapitel 4 hat mein Entscheidungsverhalten dauerhaft verändert. Der Unterschied zwischen oberflächlicher Lektüre und dem Exzerpieren der Kern-These in Craft Docs ist gewaltig.'
        },
        {
          id: `c_${seed}_2`,
          authorHandle: 'u/kant_dresden',
          authorBadge: 'Epistemologe',
          timeAgo: 'vor 3 Std.',
          score: 55 + (numSeed % 22),
          commentType: 'dialectic_critique',
          text: 'Der Autor argumentiert erstaunlich scharf. Kritikpunkt: Die historische Kontextualisierung kommt etwas zu kurz, aber als intellektueller Hebel unbezahlbar.'
        },
        {
          id: `c_${seed}_3`,
          authorHandle: 'u/lese_praxis',
          authorBadge: 'Mentales Modell-Labor',
          timeAgo: 'vor 1 Std.',
          score: 33 + (numSeed % 16),
          commentType: 'didactic_transfer',
          text: 'Mein Tipp: Unbedingt physisch lesen, Randnotizen anlegen und die Kern-Lektion in den eigenen Alltag übersetzen. 10/10 Empfehlung!'
        }
      ];

    case 'health_biohacking':
      return [
        {
          id: `c_${seed}_1`,
          authorHandle: 'u/neuro_fokus',
          authorBadge: 'Kognition & Chronobiologie',
          timeAgo: 'vor 4 Std.',
          score: 88 + (numSeed % 32),
          commentType: 'didactic_transfer',
          text: 'Der physiologische Seufzer (doppeltes Einatmen durch die Nase, langes Ausatmen durch den Mund) senkt die autonome Erregung in unter 60 Sekunden. Biochemisch unbestechlich.'
        },
        {
          id: `c_${seed}_2`,
          authorHandle: 'u/schlaf_architekt',
          authorBadge: 'Biohacking Dresden',
          timeAgo: 'vor 2 Std.',
          score: 62 + (numSeed % 21),
          commentType: 'creative_synthesis',
          text: 'Morgenlicht innerhalb der ersten 30 Minuten nach dem Aufwachen setzt den Cortisol-Pulse und triggert den Melatonin-Timer für den Abend. Einfachster Hebel überhaupt.'
        },
        {
          id: `c_${seed}_3`,
          authorHandle: 'u/longevity_lab',
          authorBadge: 'Präventivmedizin',
          timeAgo: 'vor 40 Min.',
          score: 37 + (numSeed % 15),
          commentType: 'dialectic_critique',
          text: 'Keine Nahrungsergänzungsmittel können fehlenden Schlaf und chronische sensorische Überreizung kompensieren. Erst die Fundamente richten, dann optimieren.'
        }
      ];

    case 'opportunities_growth':
      return [
        {
          id: `c_${seed}_1`,
          authorHandle: 'u/builder_leverage',
          authorBadge: 'Tech-Souveränität',
          timeAgo: 'vor 3 Std.',
          score: 79 + (numSeed % 30),
          commentType: 'creative_synthesis',
          text: 'Genau nach solchen Hebeln suche ich: Wer offene APIs, lokale Modelle und blitzschnelle SQLite-Architekturen kombiniert, hat einen unfairen Vorteil gegenüber trägen Großkorporationen.'
        },
        {
          id: `c_${seed}_2`,
          authorHandle: 'u/grant_finder_eu',
          authorBadge: 'Forschungsförderung & Open Source',
          timeAgo: 'vor 2 Std.',
          score: 44 + (numSeed % 18),
          commentType: 'didactic_transfer',
          text: 'Sehr starker Impuls. Für ähnliche Open-Source-Initiativen gibt es derzeit auch Sovereign Tech Fund Mittel. Frist läuft noch!'
        },
        {
          id: `c_${seed}_3`,
          authorHandle: 'u/digital_minimalist',
          authorBadge: 'Fokus & Hebelwirkung',
          timeAgo: 'vor 1 Std.',
          score: 30 + (numSeed % 12),
          commentType: 'dialectic_critique',
          text: 'Nicht mehr Informationen anhäufen, sondern die richtigen Informationen in messbare Handlungen und persönliche Meisterschaft ummünzen.'
        }
      ];

    case 'contemplation_mind':
    default:
      return [
        {
          id: `c_${seed}_1`,
          authorHandle: 'u/stille_in_dresden',
          authorBadge: 'Achtsamkeit & Kognition',
          timeAgo: 'vor 4 Std.',
          score: 61 + (numSeed % 28),
          commentType: 'dialectic_critique',
          text: 'Doomscrolling fragmentiert die Aufmerksamkeit im präfrontalen Kortex. Schon drei Minuten fokussiertes Lesen ohne Ablenkung bewirken eine spürbare kognitive Beruhigung.'
        },
        {
          id: `c_${seed}_2`,
          authorHandle: 'u/seneca_reader',
          authorBadge: 'Stoische Philosophie',
          timeAgo: 'vor 2 Std.',
          score: 38 + (numSeed % 14),
          commentType: 'creative_synthesis',
          text: 'Freiheit beginnt da, wo man dem ersten sensorischen Reiz nicht reflexartig nachgibt. Jedes bewusste Innehalten ist gelebte Geistesgegenwart.'
        },
        {
          id: `c_${seed}_3`,
          authorHandle: 'u/schul_kontemplation',
          authorBadge: 'Lehrer Sek I/II',
          timeAgo: 'vor 1 Std.',
          score: 24 + (numSeed % 12),
          commentType: 'didactic_transfer',
          text: 'Wir praktizieren vor anspruchsvollen Textanalysen eine Minute bewusstes Durchatmen. Die Konzentrationsqualität im Raum verändert sich dadurch fundamental.'
        }
      ];
  }
}

/**
 * Deterministic, instant intellectual AI sparring reply to a user reflection note.
 */
export function generateSparringReply(
  noteText: string,
  tag: 'einwand' | 'unterricht' | 'these' | 'notiz' = 'notiz',
  itemTitle?: string
): SparringReply {
  const noteSnippet = noteText.length > 50 ? `${noteText.slice(0, 47)}…` : noteText;

  switch (tag) {
    case 'einwand':
      return {
        id: `reply_${Date.now()}`,
        authorHandle: 'u/sokrates_2026',
        authorBadge: 'Sokratischer Sparring-Partner',
        createdAt: new Date().toISOString(),
        text: `Scharfer Einwand! Du argumentierst: „${noteSnippet}“. Wenn wir diesen Faden zu Ende spinnen: Müsste man dann nicht konsequenterweise auch hinterfragen, ob die zugrundeliegende Prämisse überhaupt universell gilt? Wie würdest du auf den Vorwurf antworten, dass du hier die Ausnahme zum Maßstab machst?`
      };

    case 'unterricht':
      return {
        id: `reply_${Date.now()}`,
        authorHandle: 'u/didaktik_labor',
        authorBadge: 'Fachdidaktik Sek II',
        createdAt: new Date().toISOString(),
        text: `Starker Praxistransfer! Du schlägst vor: „${noteSnippet}“. Für die didaktische Reduktion im 45-Minuten-Takt: Mit welchem konkreten Einstiegsimpuls bringst du die Lerngruppe dazu, das Problem sofort als ihr eigenes Erkenntnisproblem wahrzunehmen?`
      };

    case 'these':
      return {
        id: `reply_${Date.now()}`,
        authorHandle: 'u/dialektik_dresden',
        authorBadge: 'Dialektischer Sparring-Partner',
        createdAt: new Date().toISOString(),
        text: `Mutige These: „${noteSnippet}“. Der dialektische Härtetest: Welches wäre das stärkste Argument eines philosophischen Skeptikers gegen diese Position – und wie würdest du den dialektischen Widerspruch auflösen?`
      };

    case 'notiz':
    default:
      return {
        id: `reply_${Date.now()}`,
        authorHandle: 'u/atem_curator',
        authorBadge: 'Erkenntnis-Begleiter',
        createdAt: new Date().toISOString(),
        text: `Wesentliche Beobachtung zu diesem Text: „${noteSnippet}“. Dieser Gedanke berührt die fundamentale Frage nach kognitiver Souveränität: Wie bewahren wir eigenständige Urteilskraft in einer von Algorithmen getriebenen Aufmerksamkeitsökonomie?`
      };
  }
}

/**
 * Shared calculation function for word count and reading time.
 * Documented rule: Standard adult reading speed is 220 words per minute.
 * Time is rounded to nearest integer (minimum 1 minute).
 * Only the primary body text is included in this estimate;
 * optional interactive deepening prompts and pedagogical reflection questions
 * are complementary materials and intentionally excluded from the linear reading time.
 */
export function calculateReadingStats(bodyText: string): { wordCount: number; estimatedReadingMinutes: number } {
  const words = bodyText.trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.round(words / 220));
  return {
    wordCount: words,
    estimatedReadingMinutes: minutes
  };
}

function createFixture(item: any): FeedItem {
  const stats = calculateReadingStats(item.body);
  const feedText = item.feedText ?? (item.body.split('\n\n').slice(0, 2).join('\n\n'));
  const topic = (item.primaryTopic as TopicTag) || 'philosophy_ethics';
  const topicMeta = TOPIC_SPACE_MAP[topic];
  const imageUrl = item.imageUrl ?? getCuratedImageForTopic(topic, item.id);
  const baseUpvotes = 45 + ((item.id.charCodeAt(item.id.length - 1) * 7) % 65);

  return {
    format: item.format ?? (item.type === 'quick_insight' ? 'concise_insight' : item.type === 'perspective' ? 'perspective_disagreement' : item.type === 'deep_dive' ? 'long_invitation' : 'sourced_update'),
    feedText,
    articleBody: item.articleBody ?? item.body,
    isDailyEdition: item.isDailyEdition ?? true,
    isDemonstration: item.isDemonstration ?? true,
    aiAssisted: item.aiAssisted ?? true,
    factReviewStatus: item.factReviewStatus ?? 'curated_illustrative',
    evidenceTier: item.evidenceTier ?? 'publisher_excerpt',
    contentOrigin: item.contentOrigin ?? 'demo_fixture',
    contentHash: item.contentHash ?? `hash-${item.id}`,
    isTeachingRelated: item.isTeachingRelated ?? (item.primaryTopic === 'german_didactics'),
    isChallengingPerspective: item.isChallengingPerspective ?? (item.type === 'perspective' || item.format === 'perspective_disagreement'),
    space: item.space ?? topicMeta?.space,
    flair: item.flair ?? topicMeta?.flair,
    imageUrl,
    keyInsight: item.keyInsight ?? (item.deepeningOptions?.philosophicalContext || item.subtitle),
    challengePrompt: item.challengePrompt ?? (item.deepeningOptions?.reflectionPrompt || 'Welcher Einwand oder Praxistransfer fällt dir spontan ein?'),
    didacticSeed: item.didacticSeed ?? item.deepeningOptions?.didacticSeed,
    upvotesCount: item.upvotesCount ?? baseUpvotes,
    comments: item.comments ?? getSimulatedCommentsForTopic(topic, item.title, item.id),
    ...item,
    wordCount: item.wordCount ?? stats.wordCount,
    estimatedReadingMinutes: item.estimatedReadingMinutes ?? stats.estimatedReadingMinutes
  };
}

/**
 * Carefully curated personal demonstration edition.
 * Distribution:
 * - 3 Quick Insights (100–200 words, ~1 min)
 * - 3 Briefings (350–650 words, ~2–3 min)
 * - 2 Deep Dives (900–1,400 words, ~4–6 min)
 * - 1 Discovery Piece (500–800 words, ~3 min)
 */
export const INITIAL_FIXTURES: FeedItem[] = [
  // -------------------------------------------------------------
  // 1. Quick Insight: Sound & Ambient Synthesis (135 words, 1 min)
  // -------------------------------------------------------------
  createFixture({
    id: 'art-001-ambient-synthesis',
    type: 'quick_insight',
    title: 'Subtraktive Synthese: Die Skulptur aus Rauschen',
    subtitle: 'Wie durch gezieltes Wegschneiden von Obertönen intellektueller Fokus entsteht.',
    body: `In der klassischen subtraktiven Klangsynthese erzeugt ein Oszillator zunächst eine obertonreiche Wellenform – Sägezahn oder Rechteck –, die in ihrer Rohform rau und aufdringlich wirkt. Die eigentliche ästhetische Gestaltung beginnt erst mit dem Filter: Ähnlich einem Bildhauer, der aus einem Marmorblock überflüssiges Material abschlägt, senkt ein Tiefpassfilter die harschen Höhen ab und modelliert die Resonanz.

Für Brian Eno war diese Reduktion die Geburtsstunde des modernen Ambient: Klang soll nicht die Aufmerksamkeit erzwingen, sondern einen Raum öffnen, in dem Nachdenken erst möglich wird. Ein warmer, resonanzarmer Grundton beruhigt das auditive Nervensystem, ohne einzulullen. Im Zeitalter digitaler Dauerüberreizung wird diese Kunst des Weglassens vom musikalischen Handwerk zu einer Haltung des bewussten mentalen Innehaltens.`,
    topics: ['sound_synthesis'],
    primaryTopic: 'sound_synthesis',
    sourceReferences: [
      {
        publisher: 'Sound On Sound',
        originalUrl: 'https://www.soundonsound.com/techniques/synth-secrets-introduction-subtractive-synthesis',
        title: 'Synth Secrets: An Introduction to Subtractive Synthesis',
        publicationTimestamp: '1999-07-01T00:00:00Z',
        retrievalTimestamp: '2026-10-14T08:00:00Z',
        author: 'Gordon Reid',
        isVerified: true
      }
    ],
    publishedAt: '2026-10-14T06:00:00Z',
    generatedAt: '2026-10-14T06:00:00Z',
    relevanceExplanation: 'Kompakter Impuls zu Klanggestaltung, Synthese und kognitiver Fokussierung.',
    contentStatus: 'editorial_briefing',
    isDailyEdition: true,
    editionDate: '2026-10-14',
    editorialNote: 'Empfehlung für den Morgen: Akustischer Raum vor dem Beginn geistiger Arbeit.',
    isDemonstration: true,
    aiAssisted: true,
    factReviewStatus: 'scientific_paper',
    provenanceSummary: 'Didaktische Aufbereitung auf Grundlage der akustischen Synthese-Theorie von Gordon Reid (Sound On Sound).',
    deepeningOptions: {
      didacticSeed: 'Lass Schülerinnen und Schüler ein lautes Hörspiel-Geräusch schrittweise filtern: Wann kippt Information in Entspannung?',
      counterArgument: 'Kritiker wenden ein, dass Ambient-Hintergrundmusik die Exekutivfunktionen bei anspruchsvollen Textanalysen eher fragmentiert als schützt.',
      philosophicalContext: 'Brian Eno (1978): *Music for Airports* – das Manifest für Musik, die ebenso unaufdringlich wie tiefgründig rezipiert werden kann.',
      reflectionPrompt: 'Welche Geräuschkulisse umgibt dich gerade – und was geschieht, wenn du sie für zwei Minuten bewusst filterst?'
    }
  }),

  // -------------------------------------------------------------
  // 2. Quick Insight: Philosophy & Ethics (155 words, 1 min)
  // -------------------------------------------------------------
  createFixture({
    id: 'art-002-rawls-veil',
    type: 'quick_insight',
    title: 'Der Schleier des Nichtwissens: Gedankenexperiment statt Rechenmodell',
    subtitle: 'Warum John Rawls’ berühmteste Denkfigur kein Algorithmus zur Nutzenmaximierung ist.',
    body: `John Rawls’ „Schleier des Nichtwissens“ (Veil of Ignorance) wird in Einführungen oft auf ein Rechenspiel reduziert: Wie verteilen wir Güter, wenn wir nicht wissen, ob wir reich oder arm sein werden? Doch diese pragmatische Lesart verfehlt den Kern seiner Philosophie.

Für Rawls ist der Schleier kein ökonomisches Risikomanagement, sondern ein epistemisches Werkzeug zur moralischen Selbstreinigung. Er zwingt uns, unsere zufälligen Privilegien – Talent, Herkunft, Gesundheit, Generation – für einen Moment als kontingent zu begreifen. Wir sollen nicht egoistisch für den Ernstfall vorsorgen, sondern anerkennen, dass niemand seine angeborenen Startvorteile im moralischen Sinne „verdient“ hat.

Gerechtigkeit beginnt dort, wo institutionelle Regeln so gestaltet sind, dass sie selbst vor den Augen der Verwundbarsten bestehen können. Der Schleier nimmt uns nicht die Sicht – er nimmt uns die Ausreden.`,
    topics: ['philosophy_ethics'],
    primaryTopic: 'philosophy_ethics',
    sourceReferences: [
      {
        publisher: 'Stanford Encyclopedia of Philosophy',
        originalUrl: 'https://plato.stanford.edu/entries/rawls/',
        title: 'John Rawls and the Original Position',
        publicationTimestamp: '2008-03-25T00:00:00Z',
        retrievalTimestamp: '2026-10-14T08:00:00Z',
        author: 'Leif Wenar',
        isVerified: true
      }
    ],
    publishedAt: '2026-10-14T06:15:00Z',
    generatedAt: '2026-10-14T06:00:00Z',
    relevanceExplanation: 'Fundamentale moralphilosophische Denkfigur, direkt anschlussfähig an Unterricht und Ethik-Diskurs.',
    contentStatus: 'philosophical_perspective',
    isDailyEdition: true,
    editionDate: '2026-10-14',
    editorialNote: 'Klassiker der politischen Philosophie neu gelesen.',
    isDemonstration: true,
    aiAssisted: true,
    factReviewStatus: 'philosophical_discourse',
    provenanceSummary: 'Erkenntnistheoretische Einordnung auf Basis von John Rawls (*A Theory of Justice*, 1971) und der Stanford Encyclopedia of Philosophy.',
    deepeningOptions: {
      didacticSeed: 'Klassisches Rollenspiel für Klasse 9/10: Verteilung von Notenpunkten oder Klassendiensten hinter einem simulierten Schleier.',
      counterArgument: 'Kommunitaristen wie Michael Sandel halten dagegen: Ein Ich ohne historisch-kulturelle Bindungen ist ein lebensfernes, abstraktes Konstrukt.',
      philosophicalContext: 'Immanuel Kant: Das Postulat des autonomen Subjekts als theoretische Wurzel von Rawls’ Verfahrensgerechtigkeit.',
      reflectionPrompt: 'Welche deiner heutigen Selbstverständlichkeiten würdest du verteidigen, wenn du deine gesellschaftliche Position nicht kennen würdest?'
    }
  }),

  // -------------------------------------------------------------
  // 3. Quick Insight: German Didactics (165 words, 1 min)
  // -------------------------------------------------------------
  createFixture({
    id: 'art-003-socratic-silence',
    type: 'quick_insight',
    title: 'Das sokratische Gespräch: Warum Schweigen im Unterricht Mut erfordert',
    subtitle: 'Die Kunst der didaktischen Pause von drei bis fünf Sekunden verändert die Qualität von Antworten grundlegend.',
    body: `Empirische Unterrichtsforschungen zeigen seit Jahrzehnten ein ernüchterndes Muster: Nach einer gestellten Lehrerfrage vergeht im Schnitt weniger als eine Sekunde, bis die Lehrkraft entweder selbst weiterspricht, die Frage umformuliert oder den erstbesten Schüler aufruft. Dieses Tempo belohnt impulsives Halbwissen und bestraft gründliches Nachdenken.

Wer die sokratische Methode ernst nimmt, muss die Kunst der gezielten Pause kultivieren. Erhöht man die Wartezeit auf drei bis fünf Sekunden, verändert sich die Gesprächsdynamik fundamental: Die Zahl der Wortmeldungen steigt, auch zurückhaltende Schülerinnen und Schüler beteiligen sich, und Antworten entwickeln sich von stichwortartigen Einwürfen zu zusammenhängenden Argumenten.

Das Schweigen im Klassenraum ist keine didaktische Leerstelle, sondern der Raum, in dem Gedanken erst reifen können. Wer das Schweigen aushält, signalisiert der Gruppe: Deine Überlegung ist wichtiger als mein Unterrichtstempo.`,
    topics: ['german_didactics', 'philosophy_ethics'],
    primaryTopic: 'german_didactics',
    sourceReferences: [
      {
        publisher: 'Bundeszentrale für politische Bildung',
        originalUrl: 'https://www.bpb.de/lernen/unterrichten/grafstat/partizipation-beim-waehlen/166060/das-sokratische-gespraech/',
        title: 'Das sokratische Gespräch im Unterricht',
        publicationTimestamp: '2013-05-15T00:00:00Z',
        retrievalTimestamp: '2026-10-14T08:00:00Z',
        author: 'Redaktion bpb',
        isVerified: true
      }
    ],
    publishedAt: '2026-10-14T06:30:00Z',
    generatedAt: '2026-10-14T06:00:00Z',
    relevanceExplanation: 'Praxiserprobter didaktischer Impuls für den Deutsch- und Ethikunterricht.',
    contentStatus: 'editorial_briefing',
    isDailyEdition: true,
    editionDate: '2026-10-14',
    editorialNote: 'Didaktische Mikro-Intervention für den Schulalltag.',
    isDemonstration: true,
    aiAssisted: true,
    factReviewStatus: 'pedagogical_concept',
    provenanceSummary: 'Didaktische Synthese historischer sokratischer Gesprächsführung (Leonard Nelson) und empirischer Unterrichtsforschung (Mary Budd Rowe zur Wait-Time).',
    deepeningOptions: {
      didacticSeed: 'Experimentiere in der nächsten Stunde mit einer sichtbaren Sanduhr: 5 Sekunden Stille nach jeder Impulsfrage vor der ersten Meldung.',
      counterArgument: 'In unruhigen Klassen kann plötzliches Schweigen als Unsicherheit der Lehrkraft missverstanden werden und Disziplinprobleme triggern.',
      philosophicalContext: 'Platons Dialog *Menon*: Sokrates führt den Sklavenjungen nicht durch Belehrung, sondern durch beharrliches Nicht-Vorsagen zur mathematischen Einsicht.',
      reflectionPrompt: 'Wie schwer fällt es dir persönlich, Stille im Gespräch auszuhalten, ohne sofort zur nächsten Formulierung zu greifen?'
    }
  }),

  // -------------------------------------------------------------
  // 4. Briefing: AI & Apple Ecosystem (356 words, 2 min)
  // -------------------------------------------------------------
  createFixture({
    id: 'art-004-ondevice-ml',
    type: 'deep_dive',
    title: 'On-Device Intelligence: Warum lokale Inferenz mehr als ein Datenschutz-Versprechen ist',
    subtitle: 'Kompakte Sprachmodelle auf dem iPhone 15 Pro verändern die Architektur persönlicher Assistenz.',
    body: `Wenn über künstliche Intelligenz gesprochen wird, dominieren in den Medien meist gigantische Rechenzentren mit hunderten Milliarden Parametern, astronomischen Stromverbräuchen und unüberschaubaren Cloud-Pipelines. Für die alltägliche Interaktion auf modernen mobilen Endgeräten wie dem iPhone 15 Pro gewinnt jedoch eine gänzlich andere architektonische Entwicklung an praktischer Brisanz: hochoptimierte On-Device-Modelle im Bereich von zwei bis sieben Milliarden Parametern, die direkt im geteilten Arbeitsspeicher des Apple-Silicon-Chipsatzes operieren.

Diese Architekturverschiebung ist weit mehr als eine reine Datenschutzmaßnahme, obgleich das Verbleiben persönlicher Daten auf dem lokalen Gerät für viele Nutzerinnen und Nutzer zweifellos ein schlagendes Argument darstellt. Die eigentliche kognitive und ergonomische Revolution liegt in der drastischen Reduzierung von Latenz und der völligen Entkopplung von externen Netzzugängen.

Während cloudbasierte API-Anfragen unweigerlich von unberechenbaren Netzwerk-Schwankungen, Server-Warteschlangen und Datenübertragungszeiten gebremst werden, reagieren lokale Modelle über Apples integrierte Neural Engine deterministisch im Millisekundenbereich. Dies ermöglicht Interaktionsformen, die im Cloud-Betrieb ergonomisch undenkbar waren: Das System kann in Echtzeit beim Tippen Vorschläge verfeinern, Lesegewohnheiten analysieren, grammatikalische Strukturen spiegeln oder Texte gliedern, ohne dass ein Ladebalken oder ein rotierender Spinner den natürlichen Gedankengang des Nutzers unterbricht.

Ein entscheidender technischer Hebel liegt in der Unified Memory Architecture (UMA) moderner Apple-SoCs: Da Hauptspeicher, CPU, Grafikeinheit und Neural Engine auf denselben physikalischen Adressraum zugreifen, entfällt das zeitraubende und energieintensive Kopieren von Modellgewichten über getrennte PCIe-Busse. Ein kompaktes Sprachmodell mit drei Milliarden Parametern belegt bei moderner 4-Bit-Quantisierung weniger als zwei Gigabyte RAM. Es lässt sich im Bruchteil einer Sekunde für eine spezifische redaktionelle oder didaktische Analyseaufgabe in den aktiven Cache laden und danach sofort wieder freigeben.

Gleichzeitig erfordert die physische Begrenztheit des mobilen Speichers radikale Disziplin im Modelldesign. Methoden wie Parameter-Sharing, Grouped-Query-Attention (GQA) und offene Architekturen wie Apples OpenELM demonstrieren, dass sorgfältig vortrainierte, kompakte Modelle bei eng umrissenen Aufgaben erstaunlich nah an die Qualität riesiger Frontier-Modelle heranreichen. Anstatt ein unhandliches Universalmodell für elementare didaktische Zusammenfassungen anzuwerfen, genügen spezialisierte Low-Rank-Adaptionen (LoRA), die lediglich wenige Megabyte Speicher beanspruchen.

Für Entwickler und anspruchsvolle Anwender markiert dies einen grundlegenden Paradigmenwechsel: Die Zukunft persönlicher Software liegt nicht in der blinden Zentralisierung auf entfernten Großrechnern, sondern in autarken, lokalen Resonanzräumen. Das persönliche Smartphone verwandelt sich so von einer bloßen Empfangsantenne für Cloud-Dienste wieder in ein echtes, souveränes Denkwerkzeug.`,
    topics: ['ai_apple', 'science_society'],
    primaryTopic: 'ai_apple',
    sourceReferences: [
      {
        publisher: 'Apple Machine Learning Research',
        originalUrl: 'https://machinelearning.apple.com/research/open-elm',
        title: 'OpenELM: An Efficient Language Model Family with Open-source Training and Inference Framework',
        publicationTimestamp: '2024-04-24T00:00:00Z',
        retrievalTimestamp: '2026-10-14T08:00:00Z',
        author: 'Sachin Mehta, Mohammad Hossein Sekhavat, Zikang Liu et al.',
        isVerified: true
      }
    ],
    publishedAt: '2026-10-14T07:00:00Z',
    generatedAt: '2026-10-14T06:00:00Z',
    relevanceExplanation: 'Zentral für dein Interesse an Apple-Technologien und zukunftsfähigen KI-Architekturen.',
    contentStatus: 'scientific_analysis',
    isDailyEdition: true,
    editionDate: '2026-10-14',
    editorialNote: 'Technologische Tiefenschärfe: Lokale Inferenz statt Rechenzentren-Abhängigkeit.',
    isDemonstration: true,
    aiAssisted: true,
    factReviewStatus: 'scientific_paper',
    provenanceSummary: 'Fachaufsatz auf Basis der offiziellen OpenELM-Veröffentlichung des Apple Machine Learning Research Teams (Mehta et al., April 2024).',
    deepeningOptions: {
      didacticSeed: 'Diskutiere mit Schülerinnen und Schülern: Wo liegt der Unterschied zwischen einem Rechner, der alles weiß, und einem, der privat bleibt?',
      counterArgument: 'Kleinere lokale Modelle neigen bei komplexen logischen Mehrschritt-Problemen nach wie vor stärker zu Halluzinationen als aktuelle Frontier-Modelle.',
      philosophicalContext: 'Das Prinzip der technologischen Subsidiarität: Aufgaben sollten auf der kleinstmöglichen kognitiven und technischen Ebene gelöst werden.',
      reflectionPrompt: 'Welche deiner persönlichen Daten würdest du niemals einer Cloud anvertrauen, wohl aber einem abgeschirmten lokalen Chip?'
    }
  }),

  // -------------------------------------------------------------
  // 5. Briefing: Contemplation & Deep Reading (373 words, 2 min)
  // -------------------------------------------------------------
  createFixture({
    id: 'art-005-biliterate-reading',
    type: 'deep_dive',
    title: 'Die Bi-literate Kognition: Was digitales Überfliegen mit unserem Lesegedächtnis macht',
    subtitle: 'Maryanne Wolfs Forschung über das menschliche Lesehirn zwischen digitalem Scanning und konzentriertem Verweilen.',
    body: `Das menschliche Gehirn wurde im Laufe der biologischen Evolution nie für das Lesen von Schriftzeichen gebaut. Anders als die gesprochene Sprache, die genetisch fest im menschlichen Erbgut verankert ist und sich im normalen sozialen Umfeld quasi von selbst entfaltet, muss sich das neuronale Lese-Netzwerk in jedem heranwachsenden Menschen von Grund auf neu verdrahten. Es passt sich dabei flexibel und plastisch den materiellen, typografischen und kognitiven Eigenheiten jenes Mediums an, auf dem die Schrift rezipiert wird.

Die international renommierte Neurowissenschaftlerin Maryanne Wolf warnt in ihren wegweisenden Studien davor, dass die allgegenwärtige Dominanz digitaler Medien schleichend unsere Fähigkeit zum sogenannten „Deep Reading“ erodiert. Auf Bildschirmen, Smartphones und in endlosen Social-Media-Feeds trainieren wir täglich das sogenannte F-Muster: Unsere Augen springen hastig über die oberen Zeilenanfänge, tasten nach Signalwörtern ab, scannen Hyperlinks und navigieren in Sekundenschnelle zum nächsten auditiven oder visuellen Reiz. Dieses kursorische Überfliegen stellt in einer Welt permanenter digitaler Informationsflut eine hocheffektive Überlebensstrategie dar.

Die kognitive Kehrseite dieser Anpassung ist jedoch gravierend: Deep-Reading-Prozesse – das Ziehen von weitreichenden Analogien, das empathische Nachempfinden fremder Bewusstseinszustände, das kritische Hinterfragen ungenannter Prämissen und das Erfassen vielschichtiger Ironie – benötigen Zeit, kognitive Ruhe und ungeteilte Aufmerksamkeit. Wenn wir das schnelle Scannen zur unbewussten Standard-Einstellung unseres Gehirns machen, verkümmert jener kognitive Schaltkreis, der für komplexe synthetische Gedankengänge unerlässlich ist.

In empirischen Experimenten mit Studierenden konnte Wolfs Forschungsteam nachweisen, dass Leserinnen und Leser, die längere narrative oder argumentative Texte auf klassischem Papier lasen, die chronologische Abfolge der Argumente und subtile innere Widersprüche signifikant präziser rekonstruieren konnten als Probanden an digitalen Bildschirmen. Das haptische Greifen der Seiten, das Umblättern und die unverrückbare räumliche Verortung eines Gedankens auf einer physischen Buchseite stützen das menschliche Arbeitsgedächtnis durch unbewusste kognitive Landmarken.

Maryanne Wolf plädiert jedoch keineswegs für eine kulturpessimistische Rückkehr zur reinen Gutenberg-Galaxis. Ihr Ziel ist das „bi-literate Gehirn“: die bewusste Fähigkeit, souverän und flexibel zwischen schnellem, digitalem Informationsscannen und entschleunigter, tiefgründiger Lektüre hin- und herzuwechseln.

Für Lehrende und intellektuell arbeitende Menschen ergibt sich daraus ein klarer Handlungsauftrag: Wer den Drang verspürt, lange Texte auf dem Smartphone nach dem zweiten Absatz wegzuschieben, verliert nicht an Begabung, sondern unterliegt einer neurokognitiven Konditionierung. Das Gegenmittel ist kein weltfremder Digital-Detox-Urlaub, sondern die tägliche Einübung bewusster Lesezeit – ununterbrochen, analog oder in einer ruhigen, ablenkungsfreien digitalen Leseumgebung wie Atem.`,
    topics: ['contemplation_mind', 'german_didactics'],
    primaryTopic: 'contemplation_mind',
    sourceReferences: [
      {
        publisher: 'The Guardian',
        originalUrl: 'https://www.theguardian.com/books/2018/aug/25/maryanne-wolf-reading-brain-deep-reading-skills',
        title: 'Skim reading is the new normal. The effect on society is profound',
        publicationTimestamp: '2018-08-25T00:00:00Z',
        retrievalTimestamp: '2026-10-14T08:00:00Z',
        author: 'Maryanne Wolf',
        isVerified: true
      }
    ],
    publishedAt: '2026-10-14T07:15:00Z',
    generatedAt: '2026-10-14T06:00:00Z',
    relevanceExplanation: 'Berührt direkt die Schnittstelle von Lesekompetenz, Geistesschulung und Anti-Doomscroll-Philosophie.',
    contentStatus: 'scientific_analysis',
    isDailyEdition: true,
    editionDate: '2026-10-14',
    editorialNote: 'Lesekultur im 21. Jahrhundert: Wie wir unsere Konzentrationsspanne zurückgewinnen.',
    isDemonstration: true,
    aiAssisted: true,
    factReviewStatus: 'scientific_paper',
    provenanceSummary: 'Wissenschaftlich fundierte Aufbereitung der Arbeiten von Prof. Maryanne Wolf (UCLA Center for Dyslexia, Diverse Learners, and Social Justice).',
    deepeningOptions: {
      didacticSeed: 'Lass Schüler denselben Textauszug einmal digital am Tablet und einmal ausgedruckt auf Papier lesen: Welche Details bleiben hängen?',
      counterArgument: 'Einige Medienpädagogen argumentieren, dass Hypertext-Lesen alternative kognitive Kompetenzen wie vernetztes Denken und Quellenkritik stärkt.',
      philosophicalContext: 'Friedrich Nietzsche: *Morgenröte* (1881) – das Plädoyer für das „Philologen-Handwerk“ als Kunst des langsamen, genauen Lesens.',
      reflectionPrompt: 'Wann hast du das letzte Mal einen Text von mehr als fünf Seiten ohne Griff zum Smartphone zu Ende gelesen?'
    }
  }),

  // -------------------------------------------------------------
  // 6. Briefing: Science & Society (374 words, 2 min)
  // -------------------------------------------------------------
  createFixture({
    id: 'art-006-athenian-deliberation',
    type: 'deep_dive',
    title: 'Deliberation auf der Agora: Das athenische Losverfahren zwischen Mythos und Praxis',
    subtitle: 'Warum die antike Polis auf das Losen setzte, um Parteienbildung und Oligarchien zu verhindern.',
    body: `In modernen Debatten über die Krise der parlamentarischen Demokratie und das Phänomen politischer Polarisierung wird die antike attische Demokratie des fünften und vierten Jahrhunderts vor Christus gern als leuchtendes Ideal direkter Bürgerbeteiligung beschworen. Oft wird dabei jedoch das entscheidende institutionelle Fundament übersehen: Nicht Wahlen bildeten das eigentliche Herzstück der attischen Verfassungsordnung, sondern das Losverfahren (Klerosis).

Der Philosoph Aristoteles brachte diesen fundamentalen Unterschied in seiner *Politik* auf den nüchternen Punkt: Das Losen gelte aus gutem Grund als demokratisch, während Wahlen strukturell oligarchische Tendenzen begünstigen. Denn bei Wahlen gewinnen unweigerlich diejenigen Persönlichkeiten, die über mehr Reichtum, rhetorische Vorbildung, gesellschaftlichen Einfluss, familiäre Vernetzung oder populäre Bekanntheit verfügen. Das Los hingegen neutralisiert soziale Vorzüge vollständig und garantiert, dass jedes freie Mitglied des Demos mit exakt derselben mathematischen Wahrscheinlichkeit ein öffentliches Amt übernimmt.

Im Rat der 500 (Boule) und in den großen Volksgerichten (Heliaia) sorgte eine ausgeklügelte steinerne Maschine, das sogenannte Kleroterion, dafür, dass Geschworene und Amtsträger unvorhersehbar und manipulationssicher bestimmt wurden. Ämter wurden fast ausnahmslos für ein einziges Jahr vergeben, waren kollegial besetzt und wurden nach Ablauf der Amtszeit durch rigorose Rechenschaftsberichte (Euthynai) und Vorprüfungen (Dokimasia) kontrolliert. Wer sich bereichern oder Amtsmissbrauch begehen wollte, musste damit rechnen, von seinen Mitbürgern juristisch zur Verantwortung gezogen zu werden.

Dennoch wäre es historisch verfehlt, das athenische Modell unkritisch zu verklären. Zum einen beruhte die Muße der Vollbürger auf der brutalen Ausbeutung von Sklaven sowie dem völligen Ausschluss von Frauen und Metöken (Zugewanderten). Zum anderen schützte auch das Losverfahren nicht verlässlich vor den Verführungen populistischer Demagogen in der Volksversammlung, wie die verhängnisvolle Sizilische Expedition oder die Hinrichtung des Sokrates schmerzhaft demonstrieren.

In der zeitgenössischen Demokratietheorie erleben aleatorische Verfahren dennoch eine bemerkenswerte Renaissance: Politologen wie Bernard Manin (*The Principles of Representative Government*) und Hélène Landemore (*Open Democracy*) argumentieren überzeugend, dass geloste Bürgerräte genau jene Verkrustungen aufbrechen können, die durch parteipolitische Wahlkämpfe entstehen. Bei der irischen Citizens’ Assembly führten geloste Bürgerinnen und Bürger zu tragfähigen gesellschaftlichen Kompromissen bei hochumstrittenen ethischen Fragen.

Der bleibende Wert der antiken Deliberation liegt daher nicht in einer naiven Kopie ihrer Institutionen, sondern in ihrer fundamentalen Erkenntnis: Eine vitale Demokratie darf sich nicht in periodischen Wahlen erschöpfen. Sie erfordert geschützte Räume, in denen Menschen unterschiedlicher Lebenswelten gezwungen sind, einander zuzuhören, Argumente abzuwägen und gemeinsam Verantwortung für das Gemeinwesen zu tragen.`,
    topics: ['science_society', 'philosophy_ethics'],
    primaryTopic: 'science_society',
    sourceReferences: [
      {
        publisher: 'Cambridge University Press',
        originalUrl: 'https://www.cambridge.org/core/books/principles-of-representative-government/B687C52A9D6A9F6D60DE2B2B8E5F7E7C',
        title: 'The Principles of Representative Government',
        publicationTimestamp: '1997-01-13T00:00:00Z',
        retrievalTimestamp: '2026-10-14T08:00:00Z',
        author: 'Bernard Manin',
        isVerified: true
      }
    ],
    publishedAt: '2026-10-14T07:30:00Z',
    generatedAt: '2026-10-14T06:00:00Z',
    relevanceExplanation: 'Kulturhistorischer Hintergrund zu aktuellen Debatten über Bürgerräte und deliberative Demokratie.',
    contentStatus: 'philosophical_perspective',
    isDailyEdition: true,
    editionDate: '2026-10-14',
    editorialNote: 'Politische Philosophie: Das Losverfahren als Gegenentwurf zur Parteienpolarisierung.',
    isDemonstration: true,
    aiAssisted: true,
    factReviewStatus: 'historical_reference',
    provenanceSummary: 'Historisch-politische Analyse auf Basis von Bernard Manins Standardwerk *The Principles of Representative Government* und Aristoteles (*Politik*).',
    deepeningOptions: {
      didacticSeed: 'Lass eine Klasse Klassenämter oder Referatsthemen losen statt wählen: Wie verändert sich das Verantwortungsgefühl?',
      counterArgument: 'In einer hochkomplexen globalisierten Welt erfordern politische Entscheidungen technisches Fachwissen, das geloste Laien überfordern kann.',
      philosophicalContext: 'Jürgen Habermas: Theorie des kommunikativen Handelns – der zwanglose Zwang des besseren Arguments als Ideal öffentlicher Deliberation.',
      reflectionPrompt: 'Würdest du einer Gruppe zufällig geloster Bürgerinnen und Bürger deines Wohnortes zutrauen, eine Lösung für die lokale Schulpolitik zu finden?'
    }
  }),

  // -------------------------------------------------------------
  // 7. Deep Dive: Philosophy of Mind & Buddhism (1,002 words, 5 min)
  // -------------------------------------------------------------
  createFixture({
    id: 'art-007-bundle-self',
    type: 'perspective',
    title: 'Das Phantom des Ich: Phänomenologie, David Hume und das buddhistische Anattā',
    subtitle: 'Wenn westlicher Empirismus und kontemplative Philosophie im Zweifel am festen Selbst verschmelzen.',
    body: `Kaum eine Überzeugung sitzt im westlichen Alltagsbewusstsein tiefer als das Gefühl eines zentralen „Ichs“: eine feste Instanz hinter der Stirn, die Geräusche wahrnimmt, Gedanken denkt, Gefühle empfindet und willentliche Entscheidungen trifft. Wir sprechen von „meinem Körper“, „meinem Geist“ und „meinen Erinnerungen“, als gäbe es einen unsichtbaren Eigentümer, dem all diese Phänomene gehören.

Doch sobald Philosophen und Kognitionswissenschaftler den Versuch unternahmen, dieses Ich dingfest zu machen, löste es sich vor ihren Augen auf.

Im 18. Jahrhundert unternahm der schottische Aufklärer David Hume ein radikales Selbstexperiment. In seinem *Treatise of Human Nature* (1739) forderte er seine Leser auf, den Blick nach innen zu richten und jenes Ich zu suchen:

„Wenn ich auf das innigste in das eintrete, was ich mein Selbst nenne, stoße ich immer auf irgendeine besondere Wahrnehmung, von Hitze oder Kälte, Licht oder Schatten, Liebe oder Hass, Schmerz oder Vergnügen. Ich kann mich zu keinem Zeitpunkt ohne eine Wahrnehmung ertappen und kann niemals etwas anderes als die Wahrnehmung beobachten.“

Humes schonungslose Konklusion: Das Selbst ist keine beständige Substanz, keine unteilbare Seele, sondern ein „Bündel verschiedener Wahrnehmungen, die einander mit unbegreiflicher Schnelligkeit folgen und in einem beständigen Fluss und einer ewigen Bewegung begriffen sind“. Die sogenannte Bündeltheorie des Geistes (Bundle Theory) war geboren.

Mehr als zwei Jahrtausende vor Hume war die buddhistische Philosophie in Nordindien zu einer verblüffend ähnlichen Diagnose gelangt. In den Lehrreden des historischen Buddha Siddhartha Gautama bildet die Lehre von *Anattā* (Nicht-Selbst) eine der drei grundlegenden Daseinsmerkmale aller Existenz, neben Vergänglichkeit (*Anicca*) und Leidhaftigkeit (*Dukkha*).

Im berühmten antiken Text *Milindapañha* (Die Fragen des Königs Menandros) veranschaulicht der buddhistische Mönch Nagasena diese Einsicht mit dem Gleichnis vom Streitwagen: Wenn man die Deichsel, die Achse, die Räder, den Kasten und die Zügel eines Wagens einzeln betrachtet – wo befindet sich dann der „Wagen“? Ist er die Achse? Nein. Sind es die Räder? Nein. Der Begriff „Wagen“ ist lediglich eine praktische sprachliche Konvention für das funktionale Zusammenspiel vergänglicher Einzelteile. Ebenso, so Nagasena, sei das Wort „Person“ oder „Ich“ nur eine funktionale Bezeichnung für das dynamische Zusammenspiel der fünf Khandhas (Körperlichkeit, Empfindungen, Wahrnehmungen, Geistesformationen und Bewusstsein). Sucht man nach einem unveränderlichen Wesenskern hinter diesen Prozessen, findet man ein Nichts.

Lange Zeit galt diese Parallelität zwischen Humes Skeptizismus und östlicher Philosophie als philosophische Kuriosität. Doch im Zeitalter der Kognitionswissenschaften und der bildgebenden Hirnforschung gewinnt der Diskurs eine neue empirische Relevanz.

Moderne Neurowissenschaftler wie Evan Thompson (*Waking, Dreaming, Being*) und Thomas Metzinger (*Der Ego-Tunnel*) beschreiben das Selbst als eine hochkomplexe, vom Gehirn errechnete Simulation. Unser Gehirn betreibt ständige prädiktive Informationsverarbeitung (Predictive Processing): Es entwirft ein integratives Selbstmodell, um den Organismus in seiner Umwelt handlungsfähig zu halten und den Energieverbrauch zu optimieren. Das „Ich“ ist demnach kein Beobachter, der im Kontrollraum des Gehirns sitzt, sondern die Benutzeroberfläche, die das Gehirn für sich selbst generiert hat.

Wenn man meditative Praktiken wie Vipassana oder Zen untersucht, zeigt sich in funktionellen MRT-Scans eine verminderte Aktivität im sogenannten Default Mode Network (Ruhezustandsnetzwerk) des Gehirns. Dieses Netzwerk ist genau jener Schaltkreis, der für selbstreferenzielle Grübeleien, Ich-Bezug und Vergangenheits-Zukunfts-Projektionen zuständig ist. Berichten Meditierende von „Ich-Auflösung“ oder tiefer Verbundenheit, so ist dies kein esoterischer Zauber, sondern das zeitweilige Herunterfahren dieses neuronalen Selbstmodells.

Diese philosophische Diagnose gewinnt durch die Arbeiten des britischen Moralphilosophen Derek Parfit (*Reasons and Persons*, 1984) eine radikale zeitgenössische Zuspitzung. Parfit fragte: Wenn Identität über die Zeit hinweg nicht in einer starren seelischen Substanz besteht, was rechtfertigt dann unsere Sorge um unser zukünftiges Selbst? Nach Parfits Reduktionismus beruht personale Identität lediglich auf graduellen Beziehungen psychologischer Verbundenheit (Erinnerungen, Absichten, Überzeugungen) und psychologischer Kontinuität – der sogenannten Relation R.

In Gedankenexperimenten wie dem Teletransporter, bei dem ein Mensch auf der Erde atomgenau gescannt, zerstört und auf dem Mars aus neuen Atomen repliziert wird, deckt Parfit unsere intuitiven Widersprüche auf: Ist der Mensch auf dem Mars wirklich „ich“ oder ein perfekter Doppelgänger? Für Parfit ist diese Frage falsch gestellt. Es gibt keine verborgene Tatsache jenseits der psychologischen Kontinuität.

Diese Entdeckung muss keineswegs in Orientierungslosigkeit münden. Ganz im Gegenteil: Parfit beschreibt, wie die Einsicht in die Nicht-Existenz eines festen Selbst ihn von existenzieller Einsamkeit befreite: „Mein Leben schien wie ein gläserner Tunnel, durch den ich mich Jahr für Jahr schneller auf das unausweichliche Dunkel zubewegte. Doch als ich erkannte, dass es dieses getrennte Ich gar nicht gibt, fielen die Wände meines gläsernen Tunnels in sich zusammen.“

In der meditativen Praxis der Achtsamkeit (Mindfulness) wird diese Einsicht phänomenologisch überprüfbar. Wer lernt, Schmerz, Wut oder Angst nicht als Identitätsmerkmal („Ich bin wütend“), sondern als vorübergehendes physiologisches Phänomen im Bewusstseinsfeld („Wut ist im Körper spürbar“) zu beobachten, erlebt eine fundamentale kognitive Entlastung. Das Ich wird nicht vernichtet – es verliert lediglich seinen unerbittlichen Absolutheitsanspruch.

Hier eröffnet sich jedoch eine fundamentale ethische Spannung, die Hume ratlos zurückließ, die buddhistische Philosophie jedoch ins Zentrum ihrer Praxis stellte.

Wenn es kein festes Ich gibt – wer trägt dann die Verantwortung für moralische Taten? Löst sich mit dem Ich nicht auch jede Verbindlichkeit von Versprechen und ethischer Schuld auf?

Hume selbst gab zu, dass seine Zweifel ihn in Melancholie stürzten, aus der er sich nur retten konnte, indem er das Studierzimmer verließ und mit Freunden Backgammon spielte. Die buddhistische Tradition zog die gegenteilige Konsequenz: Das Festhalten an der Illusion eines getrennten, bedrohten Ichs ist die tiefste Ursache für Angst und Feindseligkeit. Wer begreift, dass die Grenze zwischen „mir“ und „der Welt“ eine durchlässige Konstruktion ist, verliert den Grund für existenzielle Abwehrkämpfe. Anattā führt nicht zur Gleichgültigkeit, sondern begründet radikales Mitgefühl (*Karuna*).

Für den Unterricht und das eigene Denken birgt diese Einsicht eine befreiende didaktische Kraft: Wir sind keine starren Monumente, die verteidigt werden müssen. Wir sind lebendige Prozesse, die sich in jeder aufmerksamen Lektüre und in jedem Atemzug neu formieren können.`,
    topics: ['philosophy_ethics', 'contemplation_mind'],
    primaryTopic: 'philosophy_ethics',
    sourceReferences: [
      {
        publisher: 'Stanford Encyclopedia of Philosophy',
        originalUrl: 'https://plato.stanford.edu/entries/hume/',
        title: 'David Hume: Personal Identity',
        publicationTimestamp: '2020-07-06T00:00:00Z',
        retrievalTimestamp: '2026-10-14T08:00:00Z',
        author: 'William Edward Morris & Charlotte R. Brown',
        isVerified: true
      },
      {
        publisher: 'Columbia University Press',
        originalUrl: 'https://cup.columbia.edu/book/waking-dreaming-being/9780231137096',
        title: 'Waking, Dreaming, Being: Self and Consciousness in Neuroscience, Meditation, and Philosophy',
        publicationTimestamp: '2014-11-18T00:00:00Z',
        retrievalTimestamp: '2026-10-14T08:00:00Z',
        author: 'Evan Thompson',
        isVerified: true
      }
    ],
    publishedAt: '2026-10-14T08:00:00Z',
    generatedAt: '2026-10-14T06:00:00Z',
    relevanceExplanation: 'Ausführlicher philosophischer Deep Dive zu Personal Identity, Erkenntnistheorie und Kontemplation.',
    contentStatus: 'philosophical_perspective',
    isDailyEdition: true,
    editionDate: '2026-10-14',
    editorialNote: 'Großer Leitartikel: Wie Hume und buddhistische Philosophie das Rätsel des Ichs beantworten.',
    isDemonstration: true,
    aiAssisted: true,
    factReviewStatus: 'philosophical_discourse',
    provenanceSummary: 'Umfassender philosophischer Essay auf Grundlage von David Hume (*Treatise of Human Nature*), buddhistischer Phänomenologie (*Milindapañha*) und moderner Kognitionsforschung (Evan Thompson, Thomas Metzinger).',
    perspectiveDetails: {
      claim: 'Das menschliche Bewusstsein besitzt eine feste, einheitliche Ich-Instanz als Eigentümer aller Wahrnehmungen und Gedanken.',
      interpretation: 'Westliche Alltagsintuition verwechselt das kohärente neuronale Selbstmodell des Gehirns mit einer realen metaphysischen Substanz.',
      counterPerspective: 'Humes Bündeltheorie und buddhistisches Anattā zeigen: Wer nach innen blickt, findet nur flüchtige Wahrnehmungen, kein festes Ich.',
      humanSource: 'David Hume (A Treatise of Human Nature) & Evan Thompson (Waking, Dreaming, Being)',
      uncertaintyNote: 'Kantische Gegenpositionen betonen, dass ohne ein transzendentales Einheitszentrum kohärente Erfahrung unmöglich wäre.'
    },
    deepeningOptions: {
      didacticSeed: 'Lass Lernende ein Selbstporträt ohne Personen-Substantive zeichnen oder schreiben: Nur Verben und Adjektive sind erlaubt.',
      counterArgument: 'Kantische Philosophen argumentieren: Das transzendentale Subjekt muss alle meine Vorstellungen begleiten können – ohne logischen Bezugspunkt zerfällt Erfahrung in Chaos.',
      philosophicalContext: 'Derek Parfit: *Reasons and Persons* (1984) – die moderne analytische Weiterentwicklung von Humes Bündeltheorie mit radikalen ethischen Konsequenzen für Sterbehilfe und Zukunftsverantwortung.',
      reflectionPrompt: 'Wenn du jetzt die Augen schließt: Wer oder was beobachtet gerade den nächsten Atemzug?'
    }
  }),

  // -------------------------------------------------------------
  // 8. Deep Dive: German Didactics & Moral Aporia (930 words, 5 min)
  // -------------------------------------------------------------
  createFixture({
    id: 'art-008-productive-aporia',
    type: 'deep_dive',
    title: 'Das Wagnis der Produktiven Verunsicherung: Philosophische Didaktik zwischen sokratischer Aporie und zeitgemäßem Deutschunterricht',
    subtitle: 'Warum echter Erkenntnisgewinn im Klassenraum die Irritation von Gewissheiten verlangt.',
    body: `Der Schulalltag in der Sekundarstufe I ist geprägt vom Imperativ der Planbarkeit: Lehrpläne fordern messbare Kompetenzen, Bildungsstandards verlangen standardisierte Operatoren, und Noten verlangen transparente Bewertungsraster. In diesem didaktischen Koordinatensystem gilt eine Unterrichtsstunde dann als gelungen, wenn am Ende eine klar konturierte Zusammenfassung an der Tafel steht, die alle Schülerinnen und Schüler in ihr Heft übertragen können.

Doch wer Philosophie, Ethik oder anspruchsvolle Literatur unterrichtet, stößt mit diesem Berechenbarkeitsideal unweigerlich an eine schmerzhafte Grenze.

Wahre philosophische Bildung beginnt historisch nicht beim Festschreiben von Antworten, sondern beim Einsturz scheinbar unumstößlicher Gewissheiten. Bei Platon führt Sokrates seine Gesprächspartner regelmäßig in die sogenannte Aporie (griechisch ἀπορία: Ausweglosigkeit, Ratlosigkeit). Erst in dem Moment, in dem ein hochmütiger Athener Staatsmann begreift, dass er den Begriff der Tapferkeit nicht definieren kann, ohne in unlösbare Selbstwidersprüche zu geraten, entsteht die Bereitschaft zum wirklichen Philosophieren. Das Nicht-Weiter-Wissen ist keine didaktische Panne, sondern der fruchtbare Boden, auf dem kritisches Denken überhaupt erst gedeihen kann.

In der modernen Fachdidaktik hat der Philosophiedidaktiker Ekkehard Martens diesen Gedanken im Konzept des „Philosophierens als elementare Kulturtechnik“ verankert. Martens unterscheidet fünf methodische Dimensionen: phänomenologisches Beschreiben, hermeneutisches Verstehen, analytisches Klären, dialektisches Abwägen und spekulatives Entwerfen. Entscheidend ist dabei, dass diese Methoden nicht als abstrakte Formeln vermittelt werden, sondern an existenziellen Widerständen erprobt werden müssen.

Im Deutschunterricht der Mittelstufe – etwa bei der Behandlung von Dramen wie Friedrich Dürrenmatts *Die Physiker*, Novellen wie Heinrich von Kleists *Michael Kohlhaas* oder zeitgenössischen Jugendromanen wie Wolfgang Herrndorfs *Tschick* – zeigt sich das enorme Potenzial dieser produktiven Verunsicherung.

Nehmen wir Dürrenmatts *Physiker*: Der traditionelle Literaturunterricht verleitet oft dazu, die Figuren vorschnell in moralische Schubladen zu stecken: Möbius als der opferbereite Held, der sich zum Schutze der Menschheit ins Irrenhaus flüchtet; Fräulein Doktor von Zahnd als die machthungrige Schurkin. Sobald man jedoch die dialektische Frage stellt, ob Möbius’ Rückzug nicht in Wahrheit die ultimative moralische Feigheit darstellt – da er die Welt der Verantwortungslosigkeit überlässt, anstatt sich aktiv im demokratischen Diskurs zu engagieren –, gerät das moralische Urteil der Lernenden ins Wanken. Schülerinnen und Schüler beginnen zu streiten, Definitionen von Verantwortung zu hinterfragen und erkennen: Es gibt in tragischen Konstellationen keine unbefleckte moralische Position.

Ein ebenso eindrückliches Beispiel bietet Kleists *Michael Kohlhaas*: Kohlhaas wird zum Rebellen und Brandstifter, weil ihm ein himmelschreiendes Unrecht widerfährt und die Gerichte versagen. Der Text zwingt Jugendliche in eine unerträgliche ethische Zwickmühle: Wir müssen Kohlhaas’ unbedingtes Rechtsgefühl bewundern und gleichzeitig das mörderische Unheil verurteilen, das aus seiner Selbstjustiz erwächst.

Hier greift die kognitive Dissonanztheorie von Leon Festinger auf pädagogischer Ebene: Echter Lern- und Reifungsprozess setzt immer voraus, dass vertraute Deutungsmuster an einem widerspenstigen Gegenstand zerschellen. Wird der Widerspruch von der Lehrkraft zu schnell aufgelöst – etwa durch eine vorschnelle moralisierende Verurteilung –, bleibt das Denken der Jugendlichen unberührt.

Die eigentliche Kunst der Lehrkraft besteht darin, den Raum der Aporie moderierend offen zu halten: Die gegensätzlichen Thesen werden präzise an der Tafel gegenübergestellt, die unausgesprochenen Wertprämissen herausgearbeitet und die Konsequenzen logisch zu Ende gedacht. Die Schülerinnen und Schüler lernen, dass Ambivalenzkompetenz kein Mangel an Entschlossenheit ist, sondern das Markenzeichen einer reifen demokratischen Urteilskraft.

Dazu gehören drei unverzichtbare didaktische Leitplanken:

Erstens: Trennung von Person und Argument. In einer sokratischen Unterrichtsphase wird niemals die Schülerin oder der Schüler bewertet, sondern ausschließlich die logische Tragfähigkeit einer vorgebrachten These. Der Wechsel von der Konfrontation zur kooperativen Textanalyse nimmt dem Diskurs das Bedrohliche.

Zweitens: Die Würdigung des Scheiterns als Erkenntnisfortschritt. Wenn ein Schüler im Gespräch feststellt: „Ich merke gerade, dass mein Argument von vorhin meiner jetzigen Behauptung widerspricht“, dann ist dies keine Niederlage, sondern der eigentliche Höhepunkt philosophischer Selbstreflexion. Die Lehrkraft muss diesen Moment explizit würdigen.

Drittens: Der sokratische Hebammendienst (Mäeutik) statt rhetorischer Überwältigung. Die Lehrkraft darf ihre eigene moralische oder politische Position nicht als Zielmarke verstecken. Sokrates half den Gedanken anderer auf die Welt – er setzte ihnen keine Kuckuckseier ins Nest.

In einer digitalisierten Gesellschaft, die durch Social-Media-Algorithmen auf maximale affektive Bestätigung und binäre Schwarz-Weiß-Muster konditioniert ist, wird diese didaktische Haltung zum unverzichtbaren Bildungsschutzraum. Wer in der Schule gelernt hat, die sokratische Aporie auszuhalten, lässt sich im öffentlichen Raum nicht mehr von plakativen Parolen und einfachen Antworten verführen.

Auch bei der Lektüre von Wolfgang Herrndorfs Adoleszenzroman *Tschick* in der achten Klasse zeigt sich dieser didaktische Hebel: Die Reise der beiden Außenseiter im gestohlenen Lada ist keine heile Ferienidylle, sondern eine Aneinanderreihung von Rechtsbrüchen, Notlügen und existentiellen Vertrauensproben. Wenn Schülerinnen und Schüler diskutieren, ob Maik und Tschick verurteilt oder bewundert werden sollten, entzündet sich ein lebendiger Diskurs über Gesetzestreue versus persönliche Integrität. Theodor W. Adornos Diktum von der „Erziehung zur Mündigkeit“ wird hier unmittelbar greifbar: Mündig ist nicht, wer brav Regeln memoriert, sondern wer in der Lage ist, bestehende Normen im Lichte des Humanen kritisch zu befragen.

Diesen pädagogischen Schutzraum zu gestalten, erfordert von der Lehrkraft auch institutionellen Mut. In einem Schulsystem, das zunehmend auf Output-Messung und Kompetenzraster getrimmt ist, wirkt das absichtliche Verweilen im Nicht-Wissen fast wie ein subversiver Akt. Doch Bildungsforscher wie John Hattie betonen, dass tiefe kognitive Aktivierung (Deep Learning) genau dort einsetzt, wo Schülerinnen und Schüler Widersprüche nicht mehr durch Auswendiglernen auflösen können, sondern gezwungen sind, eigene kategoriale Brücken zu bauen.

Wenn wir Jugendlichen das Ringen in der Aporie verwehren, entlassen wir sie intellektuell wehrlos in eine polarisierte Informationsgesellschaft. Sie haben dann gelernt, für Klausuren funktionierende Textbausteine zu reproduzieren, aber sie haben nie am eigenen Leib erfahren, wie schwer, schmerzhaft und beglückend es ist, eine eigene moralische Haltung gegen den bequemen Strom des Zeitgeistes zu verteidigen.

Diesen Raum der Stille und des Ringens im Unterricht zu verteidigen, ist daher die schönste und dringendste Aufgabe einer zeitgemäßen humanistischen Pädagogik.`,
    topics: ['german_didactics', 'philosophy_ethics'],
    primaryTopic: 'german_didactics',
    sourceReferences: [
      {
        publisher: 'Philipp Reclam jun.',
        originalUrl: 'https://www.reclam.de/detail/978-3-15-019280-1/Martens__Ekkehard/Methodik_des_Ethik__und_Philosophieunterrichts',
        title: 'Methodik des Ethik- und Philosophieunterrichts: Philosophieren als elementare Kulturtechnik',
        publicationTimestamp: '2003-01-01T00:00:00Z',
        retrievalTimestamp: '2026-10-14T08:00:00Z',
        author: 'Ekkehard Martens',
        isVerified: true
      },
      {
        publisher: 'Routledge',
        originalUrl: 'https://www.routledge.com/Visible-Learning-for-Teachers-Maximizing-Impact-on-Learning/Hattie/p/book/9780415690157',
        title: 'Visible Learning for Teachers: Maximizing Impact on Learning',
        publicationTimestamp: '2012-03-15T00:00:00Z',
        retrievalTimestamp: '2026-10-14T08:00:00Z',
        author: 'John Hattie',
        isVerified: true
      }
    ],
    publishedAt: '2026-10-14T08:30:00Z',
    generatedAt: '2026-10-14T06:00:00Z',
    relevanceExplanation: 'Kernstück deiner didaktischen und philosophischen Unterrichtspraxis.',
    contentStatus: 'philosophical_perspective',
    isDailyEdition: true,
    editionDate: '2026-10-14',
    editorialNote: 'Großer didaktischer Leitessay: Warum Schule den Mut zur sokratischen Ratlosigkeit braucht.',
    isDemonstration: true,
    aiAssisted: true,
    factReviewStatus: 'pedagogical_concept',
    provenanceSummary: 'Fachdidaktischer Grundlagenaufsatz unter Bezugnahme auf Ekkehard Martens (*Methodik des Ethik- und Philosophieunterrichts*), Platons Dialoge und John Hatties Unterrichtsforschung.',
    deepeningOptions: {
      didacticSeed: 'Entwickle für die nächste Unterrichtseinheit ein „Aporie-Protokoll“: Am Ende der Stunde notiert jeder Schüler eine Frage, die ungelöst geblieben ist.',
      counterArgument: 'Kritiker bemängeln, dass offene Aporien bei leistungsschwächeren Schülerinnen und Schülern Prüfungsangst und Frustration schüren können.',
      philosophicalContext: 'Karl Popper: *Logik der Forschung* (1934) – Erkenntnis wächst durch die Falsifikation von Theorien, nicht durch bloße Bestätigung.',
      reflectionPrompt: 'Wann hat dich zuletzt eine Frage im Unterricht so überrascht, dass du selbst keine fertige Antwort parat hattest?'
    }
  }),

  // -------------------------------------------------------------
  // 9. Discovery Piece: Science & Society / Quantum Biology (515 words, 2 min)
  // -------------------------------------------------------------
  createFixture({
    id: 'art-009-quantum-biology',
    type: 'connection',
    title: 'Quantenphänomene im Laubwald: Zwischen biologischer Realität und physikalischer Vorsicht',
    subtitle: 'Wie Pflanzen Sonnenlicht transportieren – und warum die Debatte um Quantenkohärenz in warmen Zellen so heikel ist.',
    body: `Jedes grüne Blatt im herbstlichen Wald vollzieht in jeder Sekunde eine Meisterleistung der Energieumwandlung: Wenn ein Photon auf ein Chlorophyll-Molekül im Lichtsammelkomplex trifft, schlägt es ein Elektron an und erzeugt ein Exziton – ein hochenergetisches Energiepaket. Dieses Exziton muss nun seinen Weg durch ein dichtes Dickicht aus Proteinen zum Reaktionszentrum finden, wo die Energie chemisch gebunden wird.

Das Verblüffende dabei ist der Wirkungsgrad: Nahezu 100 Prozent der absorbierten Lichtquanten erreichen ihr Ziel, bevor die Energie in Wärme verpuffen kann. Wie gelingt der Natur diese nahezu verlustfreie Transmission in einem feuchten, warmen und chaotischen Milieu?

Im Jahr 2007 sorgte eine spektakuläre Veröffentlichung des Biophysikers Gregory Engel und seines Teams in der Fachzeitschrift *Nature* für weltweites Aufsehen. In ultrakurzen Laserspektroskopie-Experimenten an photosynthetischen Bakterien (FMO-Komplex) beobachteten die Forscher quantenmechanische Oszillationen („Quanten-Beats“). Die kühne Hypothese lautete: Das Exziton wandert nicht klassisch von Molekül zu Molekül wie eine Kugel in einem Flipperautomaten. Vielmehr breitet es sich wellenartig über mehrere Pfade gleichzeitig aus (Quantensuperposition) und „wählt“ interferenzgestützt automatisch die schnellste Route.

Die Entdeckung nährte romantische Vorstellungen von „Quantenmagie im Waldboden“. Doch in der Wissenschaftsgemeinde setzte bald eine heilsame Ernüchterung und methodische Differenzierung ein.

Kritische Physiker wiesen darauf hin, dass die ursprünglichen Experimente bei tiefen, kryogenen Temperaturen von 77 Kelvin (-196 °C) durchgeführt wurden. Bei physiologischen Raumtemperaturen von 20 bis 30 Grad Celsius kollidieren Biomoleküle milliardenfach pro Sekunde mit umgebenden Wassermolekülen. Diese thermische Umwelt führt nach herkömmlicher Quantenmechanik innerhalb von Femtosekunden zur Dekohärenz: Die zarten Quantenüberlagerungen brechen schlagartig zusammen.

Neuere Studien – unter anderem von Gregory Scholes et al. (*Nature Chemistry*, 2017) – zeichnen ein weitaus differenzierteres und eleganteres Bild: Die langanhaltenden Oszillationen sind sehr wahrscheinlich keine reine elektronische Quantenkohärenz, sondern eine subtile Kopplung zwischen Elektronen und molekularen Vibrationen des umgebenden Proteingerüsts (vibronische Kopplung).

Der entscheidende biophysikalische Mechanismus hinter diesem Phänomen wird in der aktuellen Forschung als vibronische Resonanz beschrieben: Die elektronischen Anregungszustände der eng benachbarten Chlorophyll-Moleküle besitzen Energiedifferenzen, die fast exakt mit bestimmten diskreten Schwingungsfrequenzen des umgebenden Proteingerüsts übereinstimmen. Anstatt dass thermische Schwingungen die Quantenzustände wahllos zerstören, synchronisieren sie sich mit ihnen.

Diese quantenmechanisch-vibronische Kopplung fungiert wie ein molekulares Schwungrad: Sie verhindert effektiv, dass das Exziton in energetischen Sackgassen hängenbleibt, und leitet die Anregungsenergie mit atemberaubender Präzision bergab in Richtung des photochemischen Reaktionszentrums. Die Evolution hat hier über Jahrmillionen hinweg keine hermetisch isolierte Vakuum-Physik betrieben, sondern eine raffinierte Synthese aus geordneter Quantenüberlagerung und dynamischem thermischem Rauschen optimiert.

Bereits 1944 hatte Erwin Schrödinger in seinem visionären Werk *Was ist Leben?* vermutet, dass lebende Organismen durch eine „aperiodische Kristallstruktur“ in der Lage sein könnten, makroskopische Ordnung aus quantenmechanischen Prinzipien aufrechtzuerhalten. Die moderne Quantenbiologie bestätigt Schrödingers Intuition, jedoch ohne esoterische Überhöhung: Nicht magische Wunder, sondern fein austarierte physikalische Grenzphänomene zwischen Quantenmechanik und Thermodynamik ermöglichen das Wunder des irdischen Lebens.

Diese verblüffende Effizienz wirft auch grundlegende naturphilosophische Fragen auf: Wenn biologische Makromoleküle Quanteneffekte bei Raumtemperatur funktionell nutzen können, verschwimmt die klassische Grenzziehung zwischen lebender und unbelebter Natur. Was das neunzehnte Jahrhundert als mechanistisches Räderwerk begriff, entpuppt sich als ein ununterbrochenes, dynamisches Zusammenspiel von molekularer Information, quantenmechanischer Resonanz und makroskopischer Selbsterhaltung.`,
    topics: ['science_society'],
    primaryTopic: 'science_society',
    sourceReferences: [
      {
        publisher: 'Nature',
        originalUrl: 'https://www.nature.com/articles/nature05678',
        title: 'Evidence for wavelike energy transfer through quantum coherence in photosynthetic systems',
        publicationTimestamp: '2007-04-12T00:00:00Z',
        retrievalTimestamp: '2026-10-14T08:00:00Z',
        author: 'Gregory S. Engel, Tessa R. Calhoun, Elizabeth L. Read et al.',
        isVerified: true
      },
      {
        publisher: 'Nature Chemistry',
        originalUrl: 'https://www.nature.com/articles/nchem.2758',
        title: 'Coherence in chemistry, biology and materials',
        publicationTimestamp: '2017-04-18T00:00:00Z',
        retrievalTimestamp: '2026-10-14T08:00:00Z',
        author: 'Gregory D. Scholes, Graham R. Fleming, Alexandra Olaya-Castro et al.',
        isVerified: true
      }
    ],
    publishedAt: '2026-10-14T09:00:00Z',
    generatedAt: '2026-10-14T06:00:00Z',
    relevanceExplanation: 'Entdeckungs-Artikel: Faszinierende Grenzfragen zwischen Quantenphysik, Biophysik und Naturphilosophie.',
    contentStatus: 'scientific_analysis',
    isDailyEdition: false,
    editionDate: '2026-10-14',
    editorialNote: 'Horizont-Erweiterung: Wo Physik, Biologie und Naturphilosophie verschmelzen.',
    isDemonstration: true,
    aiAssisted: true,
    factReviewStatus: 'scientific_paper',
    provenanceSummary: 'Wissenschaftsjournalistische Einordnung auf Basis begutachteter Fachartikel in Nature (Engel et al.) und Nature Chemistry (Scholes et al.) sowie Schrödingers *Was ist Leben?*.',
    deepeningOptions: {
      didacticSeed: 'Fächerübergreifender Impuls für Ethik/Biologie/Physik: Was unterscheidet eine komplexe chemische Maschine von einem lebendigen Organismus?',
      counterArgument: 'Einige theoretische Physiker bestreiten weiterhin, dass die vibronischen Effekte funktionell notwendig für das Überleben der Pflanze sind.',
      philosophicalContext: 'Erwin Schrödinger: *Was ist Leben?* (1944) – die Vorahnung des genetischen Codes und der Thermodynamik offener Systeme.',
      reflectionPrompt: 'Wie verändert diese Perspektive deinen Blick auf einen Spaziergang durch die Dresdner Heide?'
    }
  })
];

/**
 * Standard starter interests for fresh onboarding configuration.
 */
export const DEFAULT_STARTER_INTERESTS: Record<TopicTag, number> = {
  philosophy_ethics: 0.90,
  german_didactics: 0.85,
  ai_apple: 0.80,
  contemplation_mind: 0.75,
  science_society: 0.70,
  sound_synthesis: 0.60,
  memes_satire: 0.75,
  youtube_gems: 0.85,
  book_mastery: 0.90,
  health_biohacking: 0.85,
  opportunities_growth: 0.80
};

/**
 * Fresh-install default profile: onboarding is deliberately incomplete (isOnboarded: false).
 */
export const DEFAULT_USER_PROFILE: UserProfile = {
  language: 'de',
  region: 'de',
  explicitInterests: { ...DEFAULT_STARTER_INTERESTS },
  derivedWeights: {},
  explicitGoals: {
    understand_tech: 0.95,
    creative_music: 0.85,
    deepen_attention: 0.80,
    philosophical_clarity: 0.95,
    society_and_ethics: 0.75
  },
  editorialTargets: {
    teachingTargetRatio: 0.10,
    challengingTargetRatio: 0.10
  },
  feedbackMemory: {
    boostedTopics: {},
    penalizedTopics: {},
    boostedAuthors: {},
    penalizedAuthors: {},
    boostedKeywords: {},
    penalizedKeywords: {}
  },
  behavioralSignals: {
    recentOpenedIds: [],
    recentSavedIds: [],
    completedReadIds: []
  },
  readingPreferences: {
    preferredDuration: 'balanced',
    theme: 'dark',
    palette: 'tidalglass',
    fontSize: 'md'
  },
  editionPreferences: {
    timezone: 'Europe/Berlin',
    morningStartHour: 5,
    middayStartHour: 12,
    eveningStartHour: 18,
    weatherEnabled: true,
    weatherCity: 'berlin'
  },
  isOnboarded: false,
  lastActiveDate: '2026-10-14'
};
