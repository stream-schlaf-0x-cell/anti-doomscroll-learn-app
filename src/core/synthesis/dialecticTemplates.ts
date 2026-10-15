import { TopicTag } from '../domain/types';

export interface DialecticTemplate {
  title: string;
  subtitle: string;
  feedText: string;
  articleBody: string;
  keyInsight: string;
  counterPerspective: string;
  challengePrompt: string;
  actionableTransfer: string;
}

export const TOPIC_DIALECTICS: Record<TopicTag, DialecticTemplate> = {
  ai_apple: {
    title: 'Gegenstimme: Reibungsverlust vs. kognitiver Muskelschwund',
    subtitle: '🤖 KI-Sparring • Kontrapunkt: Bequemlichkeit vs. geistige Autonomie',
    feedText: 'Wenn uns Sprachmodelle jede Recherche und Formulierung abnehmen, gewinnen wir scheinbar Zeit. Doch was passiert mit der Denkfähigkeit, wenn die Reibung des Selberformulierens komplett verschwindet?',
    articleBody: '> [!NOTE]\n> **🤖 Sparring-Transparenz:** Dies ist eine gezielte Gegenperspektive zum Selberdenken. Sie soll helfen, blinde Flecken bei KI und Automatisierung aufzudecken.\n\n### Worum es geht\nDie technologische Begeisterung feiert generative Modelle als universelle Produktivitätssteigerung: Wer KI nutzt, erledigt Recherche, Entwurf und Code in Minuten statt Stunden.\n\n### Warum das wichtig ist\nDenken ist kein reines Ergebnis, sondern ein Transformationsprozess. Der Kampf um den treffenden Satz, das wiederholte Verwerfen eines schlechten Arguments und die Frustration vor dem leeren Blatt sind genau die mentalen Gewichte, die unser Urteilsvermögen überhaupt erst formen.\n\n### Die Gegenperspektive\nWer die kognitive Reibung an Cloud-Modelle auslagert, optimiert den Output, verliert aber schrittweise die Fähigkeit zu originärem, unbequemem Denken. Wir laufen Gefahr, flüssige Antworten zu verwechseln mit echtem Verständnis.\n\n### Zum Weiterdenken & Ausprobieren\nKI als Sparringspartner und Kritiker nutzen – niemals als Vorab-Filter unseres eigenen Urteils. Erst selbst schwitzen, dann Modelle befragen.',
    keyInsight: 'Wer Denk-Reibung vollständig an Modelle delegiert, verliert das neuronale Fundament eigener Urteilskraft.',
    counterPerspective: 'Jede Auslagerung von Denkprozessen an automatisierte Modelle verringert die eigene Frustrationstoleranz und schwächt die Fähigkeit, komplexe Probleme ohne fremde Hilfe zu durchdringen.',
    challengePrompt: 'Welche Gedankenaufgabe willst du heute bewusst ohne KI bis zum Ende selbst durchdringen?',
    actionableTransfer: 'Schreibe den ersten Entwurf deiner nächsten These oder Notiz vollständig von Hand, bevor du ein Sprachmodell zur Kritik hinzuziehst.'
  },
  german_didactics: {
    title: 'Gegenstimme: Kompetenzraster vs. produktive Verwirrung',
    subtitle: '🤖 KI-Sparring • Kontrapunkt: Standardisierung vs. echter Funke',
    feedText: 'Moderne Didaktik liebt messbare Lernziele und lückenlose Kompetenzraster. Aber verpassen wir dabei nicht den wichtigsten Bildungsmoment: die produktive Verwirrung, an der echtes Interesse entbrennt?',
    articleBody: '> [!NOTE]\n> **🤖 Sparring-Transparenz:** Ein didaktischer Kontrapunkt für den Schulalltag. Nicht als Lehrbuchdoktrin, sondern als Anstoß zur kollegialen Diskussion.\n\n### Worum es geht\nLehrpläne fordern engmaschige Operatoren, transparente Bewertungskriterien und kleinschrittig messbare Kompetenzstufen. Jede Unterrichtsstunde soll vorhersehbar ins Ziel laufen.\n\n### Warum das wichtig ist\nEchte geistige Entwicklung ereignet sich selten im linearen Durcharbeiten eines Arbeitsblattes. Sie geschieht, wenn Lernende plötzlich merken: „Moment mal, die These von eben widerspricht doch allem, was wir letzte Woche besprochen haben!“\n\n### Die Gegenperspektive\nEin Unterricht, der keine Zeit für Umwege, argumentative Sackgassen und produktive Ratlosigkeit lässt, erzeugt vielleicht brave Prüfungserfüller, aber keine mündigen, diskursfähigen Menschen.\n\n### Zum Weiterdenken & Ausprobieren\nIm nächsten Unterrichtsentwurf bewusst eine 10-minütige Phase der offenen Verwirrung einbauen – ohne sofortige Auflösung durch die Lehrkraft.',
    keyInsight: 'Echte Mündigkeit entsteht in der Reibung unaufgelöster Widersprüche, nicht im bloßen Abhaken von Kompetenzrastern.',
    counterPerspective: 'Zu eng getaktete Kompetenzraster ersticken die intrinsische Neugier im Keim, weil sie den Lernprozess auf messbare Minimalanforderungen reduzieren.',
    challengePrompt: 'An welcher Stelle in deinem Unterricht gab es zuletzt produktive Verwirrung statt vorgegebener Antworten?',
    actionableTransfer: 'Plane in einer Stunde der nächsten Woche eine Phase ein, in der zwei gegensätzliche Quelltexte ohne Kommentar nebeneinanderstehen und die Klasse die Spannung selbst aushalten muss.'
  },
  philosophy_ethics: {
    title: 'Gegenstimme: Utilitarismus-Falle vs. gelebte Verantwortung',
    subtitle: '🤖 KI-Sparring • Kontrapunkt: Nutzenrechnung vs. unteilbare Würde',
    feedText: 'Kann man gutes Handeln einfach kalkulieren? Wenn Algorithmen oder ethische Modelle das größte Wohl für die größte Zahl berechnen, bleibt das Wichtigste auf der Strecke: das konkrete Gegenüber.',
    articleBody: '> [!NOTE]\n> **🤖 Sparring-Transparenz:** Philosophischer Kontrapunkt zur Schärfung ethischer Urteilskraft.\n\n### Worum es geht\nOb bei autonomen Systemen, Triage-Entscheidungen oder gesellschaftlicher Ressourcenverteilung: Der Utilitarismus verspricht mathematische Eleganz. Berechne den Gesamtnutzen abzüglich des Leids – und handle entsprechend.\n\n### Warum das wichtig ist\nSobald Menschenleben oder Grundrechte in Kosten-Nutzen-Funktionen verrechnet werden, beginnt die schleichende Entwertung des Einzelnen. Kant und Levinas erinnern uns daran: Das Antlitz des konkreten anderen Menschen verlangt unbedingte Achtung – keine statistische Abwägung.\n\n### Die Gegenperspektive\nEine rein optimierende Moral verliert den Begriff der Schuld, der Vergebung und des Unersetzbaren. Wenn das Kollektivwohl jede Härte gegen Minderheiten rechtfertigt, wird Ethik zum bürokratischen Rechenspiel.\n\n### Zum Weiterdenken & Ausprobieren\nFrage dich bei ethischen Debatten stets: Wer bezahlt den Preis für das angebliche „Gesamtwohl“ und hat diese Person ein Mitspracherecht?',
    keyInsight: 'Ethisches Urteil lässt sich nicht in eine Nutzenfunktion übersetzen, ohne den Kern menschlicher Würde zu beschädigen.',
    counterPerspective: 'Wer Ethik nur als Nutzenmaximierung begreift, verliert den Sinn für individuelle Unersetzbarkeit und moralische Grenzen.',
    challengePrompt: 'Wo begegnet dir im Alltag eine verkappte Kosten-Nutzen-Rechnung über Menschen?',
    actionableTransfer: 'Formuliere für eine aktuelle Kontroverse das stärkste Argument der Gegenseite, ohne es sofort zu relativieren.'
  },
  science_society: {
    title: 'Gegenstimme: Technokratischer Fix vs. gesellschaftliche Realität',
    subtitle: '🤖 KI-Sparring • Kontrapunkt: Ingenieurslogik vs. systemische Komplexität',
    feedText: 'Für jedes gesellschaftliche Problem scheint es heute ein technologisches Tool oder Dashboard zu geben. Aber lassen sich gewachsene soziale Konflikte wirklich weg-optimieren?',
    articleBody: '> [!NOTE]\n> **🤖 Sparring-Transparenz:** Soziologischer Kontrapunkt gegen naive Technologiegläubigkeit.\n\n### Worum es geht\nSolutionismus glaubt: Wenn wir nur genügend Sensoren, Algorithmen oder Plattformen bauen, lösen sich Bildungsmisere, Klimakrise und Einsamkeit wie von selbst auf.\n\n### Warum das wichtig ist\nSoziale Strukturen, Machtinteressen und Vertrauen gehorchen keiner Software-Logik. Ein digitales Tool, das in ein dysfunktionales soziales System geworfen wird, vergrößert oft nur die bestehende Ungleichheit, statt sie zu heilen.\n\n### Die Gegenperspektive\nEchter Wandel erfordert institutionellen Mut, Beziehungspflege und politische Auseinandersetzung – Dinge, die sich nicht als API konsumieren lassen. Wer soziale Fragen vertechnisiert, entpolitisiert sie.\n\n### Zum Weiterdenken & Ausprobieren\nPrüfe bei neuen Technologien zuerst: Welches soziale Problem wird hier eigentlich verdeckt statt gelöst?',
    keyInsight: 'Technologie ohne institutionelle Reform zementiert oft genau jene Missstände, die sie zu überwinden vorgibt.',
    counterPerspective: 'Rein technische Lösungen verschieben Probleme häufig in marginalisierte Bereiche, anstatt die gesellschaftlichen Ursachen anzugehen.',
    challengePrompt: 'Welches Tool hat ein Problem in deinem Umfeld scheinbar gelöst, aber neue Nebenwirkungen geschaffen?',
    actionableTransfer: 'Hinterfrage bei der nächsten Prozess-Optimierung, wessen Arbeit dadurch unsichtbar oder abgewertet wird.'
  },
  sound_synthesis: {
    title: 'Gegenstimme: Digitale Perfektion vs. analoger Fehlerzauber',
    subtitle: '🤖 KI-Sparring • Kontrapunkt: Bit-Präzision vs. klangliche Seele',
    feedText: 'Moderne Synthesizer und DAWs bieten unendliche Tracks und mathematisch perfekte Stimmung. Doch warum klingen viele Produktionen trotzdem steril und austauschbar?',
    articleBody: '> [!NOTE]\n> **🤖 Sparring-Transparenz:** Ein Plädoyer für klangliche Imperfektion und physikalischen Widerstand.\n\n### Worum es geht\nUnbegrenzte Plugins, automatisches Quantisieren und totale Kontrolle: Nie war es einfacher, einen klanglich fehlerfreien Track zu produzieren.\n\n### Warum das wichtig ist\nAnaloge Schaltkreise driften mit der Temperatur. Röhren verzerren unlinear. Ein Musiker schwankt um Millisekunden. Genau diese mikroskopischen Abweichungen vom mathematischen Ideal erzeugen Wärme, Tiefe und emotionale Resonanz.\n\n### Die Gegenperspektive\nWer jeden Fehler glattbügelt, tötet den Puls des Klangs. Beschränkung auf wenige Schalter und Unvollkommenheit ist der fruchtbarste Nährboden für eigene Handschrift.\n\n### Zum Weiterdenken & Ausprobieren\nNimm die Quantisierung heraus, lass die Oszillatoren driften und beschränke dich auf drei Spuren.',
    keyInsight: 'Musikalische Lebendigkeit entsteht aus physikalischem Widerstand und Unvollkommenheit, nicht aus digitaler Perfektion.',
    counterPerspective: 'Mathematisch perfekte Symmetrie im Audiobereich wirkt auf das menschliche Gehör rasch monoton, weil unser Gehirn auf organische Mikrofluktuationen programmiert ist.',
    challengePrompt: 'Welcher „Fehler“ in einem Track oder Kunstwerk hat dich zuletzt emotional berührt?',
    actionableTransfer: 'Produziere ein kurzes Klangstück, bei dem du kein einziges Mal die Undo-Funktion benutzt.'
  },
  contemplation_mind: {
    title: 'Gegenstimme: Das optimierte Selbst vs. echtes Loslassen',
    subtitle: '🤖 KI-Sparring • Kontrapunkt: McMindfulness vs. radikale Stille',
    feedText: 'Meditation wird heute oft als Tool verkauft, um im Job noch belastbarer und fokussierter zu sein. Doch pervertiert das nicht die ursprüngliche Idee kontemplativer Praxis?',
    articleBody: '> [!NOTE]\n> **🤖 Sparring-Transparenz:** Kritischer Impuls gegen die Verwertungslogik innerer Einkehr.\n\n### Worum es geht\nApps und Corporate Workshops versprechen: Meditiere 10 Minuten am Tag, senke dein Cortisol und sei am Nachmittag wieder voll leistungsfähig.\n\n### Warum das wichtig ist\nWenn Achtsamkeit nur dazu dient, das bestehende Hamsterrad erträglicher zu machen, wird sie zum Rädchen im Getriebe („McMindfulness“). Die kontemplative Tradition meint etwas Radikaleres:\n\n### Die Gegenperspektive\nNicht noch besser funktionieren, sondern das zwanghafte Müssen hinterfragen. Stille ohne Zweck, absichtsloses Dasein und das mutige Aushalten der eigenen Verwundbarkeit – jenseits jeder Leistungskennzahl.\n\n### Zum Weiterdenken & Ausprobieren\nEinmal am Tag 5 Minuten sitzen – ganz ohne Ziel, ohne Tracking und ohne den Anspruch, dadurch „besser“ zu werden.',
    keyInsight: 'Wer Meditation als Produktivitäts-Tool missbraucht, beraubt die Stille ihrer transformativen Sprengkraft.',
    counterPerspective: 'Sobald Achtsamkeit operationalisiert wird, verstärkt sie das Leistungsego, anstatt die Fixierung darauf aufzulösen.',
    challengePrompt: 'Wann hast du das letzte Mal etwas getan, das absolut keinen messbaren Nutzen hatte?',
    actionableTransfer: 'Setze dich heute für 3 Minuten ans offene Fenster, ohne Handy, ohne Atemzählen und ohne Absicht.'
  },
  health_biohacking: {
    title: 'Gegenstimme: Tracking-Neurose vs. somatische Intuition',
    subtitle: '🤖 KI-Sparring • Kontrapunkt: Schlaf-Scores vs. Körpergefühl',
    feedText: 'Smartwatches sagen uns morgens, ob wir erholt sind oder nicht. Verlieren wir vor lauter Sensordaten den Kontakt zum eigenen körperlichen Spüren?',
    articleBody: '> [!NOTE]\n> **🤖 Sparring-Transparenz:** Ein nüchterner Blick auf den Hype um Schlaftracking und Biohacking.\n\n### Worum es geht\nHRV-Messung, Blutzuckersensoren und Schlafphasen-Scores: Biohacking verspricht die vollständige Kontrolle über die eigene Biologie.\n\n### Warum das wichtig ist\nWer morgens aufwacht, sich wach fühlt, aber von der App liest: „Schlechter Schlaf-Score: 54%“, fühlt sich prompt erschöpft (Orthosomnie). Daten können entmündigen.\n\n### Die Gegenperspektive\nKein Algorithmus kennt die feinen Signale deines Körpers besser als deine eigene Wahrnehmung, wenn du ihr wieder zuhörst: Hunger, Müdigkeit, Atemtiefe und Bewegungsdrang. Dauerhaftes Messen erzeugt oft mehr Stress als es abbaut.\n\n### Zum Weiterdenken & Ausprobieren\nLass das Tracking-Armband am Wochenende bewusst in der Schublade und entscheide nur nach Körpergefühl, wann du schläfst und isst.',
    keyInsight: 'Datengestütztes Biohacking wird destruktiv, wenn der Sensor wichtiger wird als das eigene Körpergefühl.',
    counterPerspective: 'Chronische Selbstüberwachung kann zu Nocebo-Effekten führen, bei denen schlechte Messwerte psychosomatische Erschöpfung auslösen.',
    challengePrompt: 'Wie fühlst du dich gerade wirklich – ganz unabhängig von Daten oder Bildschirmen?',
    actionableTransfer: 'Frage dich vor der nächsten Mahlzeit ohne Blick auf die Uhr: Wie hungrig bin ich auf einer Skala von 1 bis 10?'
  },
  memes_satire: {
    title: 'Gegenstimme: Zynische Distanz vs. mutige Hingabe',
    subtitle: '🤖 KI-Sparring • Kontrapunkt: Ironic Posturing vs. Ernsthaftigkeit',
    feedText: 'Memes und Ironie sind die Schutzschilde der Netzkultur: Wer über alles lacht, kann nicht verletzt werden. Doch verharmlosen wir damit die Dinge, für die es sich zu kämpfen lohnt?',
    articleBody: '> [!NOTE]\n> **🤖 Sparring-Transparenz:** Reflexion über die Grenzen des ironischen Selbstschutzes.\n\n### Worum es geht\nPost-ironische Memes dekonstruieren jeden Pathos. Es fühlt sich klug an, überall das Absurde zu entlarven und sich über Fehltritte lustig zu machen.\n\n### Warum das wichtig ist\nWer sich dauerhaft hinter Ironie verschanzt, muss nie Farbe bekennen. Zynismus ist billig – er baut nichts auf, riskiert nichts und verteidigt kein Ideal.\n\n### Die Gegenperspektive\nWahre geistige Reife braucht den Mut, für etwas offen und unironisch einzustehen, auch auf die Gefahr hin, uncool zu wirken oder zu scheitern. Dauerironie ist die intellektuelle Kapitulation vor der Weltgestaltung.\n\n### Zum Weiterdenken & Ausprobieren\nFeiere guten Humor, aber finde mindestens eine Sache, über die du nicht zynisch wirst, sondern die dir heilig ist.',
    keyInsight: 'Dauernde Ironie schützt vor Verletzlichkeit, betäubt aber gleichzeitig die Fähigkeit zu echter Begeisterung.',
    counterPerspective: 'Reine Satire bleibt oft parasitäre Kritik, die von bestehenden Missständen lebt, ohne gangbare Alternativen aufzuzeigen.',
    challengePrompt: 'Wofür brennst du so sehr, dass du es gegen jeden zynischen Witz verteidigen würdest?',
    actionableTransfer: 'Sprich heute ein ehrliches, unironisches Lob für jemanden aus, dessen Engagement du bewunderst.'
  },
  youtube_gems: {
    title: 'Gegenstimme: Passives Verstehen vs. aktive Rekonstruktion',
    subtitle: '🤖 KI-Sparring • Kontrapunkt: Edutainment-Sucht vs. eigenständiges Tun',
    feedText: 'Ein 40-Minuten-Videoessay über Quantenmechanik fühlt sich extrem klug an. Aber haben wir wirklich etwas gelernt – oder nur das wohlige Gefühl von Bildung konsumiert?',
    articleBody: '> [!NOTE]\n> **🤖 Sparring-Transparenz:** Gegenstimme zum Phänomen des passiven Edutainment-Konsums.\n\n### Worum es geht\nVeritasium, Kurzgesagt, 3Blue1Brown: Visuell atemberaubende Animationen machen hochkomplexe Ideen für jeden verständlich.\n\n### Warum das wichtig ist\nEinem brillanten Erzähler zu folgen erzeugt das Gefühl: „Aha, jetzt habe ich es kapiert!“. Doch wenn man fünf Minuten später gebeten wird, das Konzept auf einem leeren Blatt Papier herzuleiten, scheitert man kläglich.\n\n### Die Gegenperspektive\nVerstehen ist eine aktive Konstruktionsleistung des eigenen Gehirns. Es verlangt Notizen, Nachfragen und das eigene Scheitern am Problem – nicht bloßes Staunen vor dem Bildschirm.\n\n### Zum Weiterdenken & Ausprobieren\nNach dem nächsten guten Video das Browserfenster schließen und in drei Sätzen handschriftlich notieren, was der Kernbeweis war.',
    keyInsight: 'Exzellente Erklärungen erzeugen die Illusion von Kompetenz; echtes Verstehen erfordert eigene Rekonstruktion.',
    counterPerspective: 'Edutainment verwechselt die Ästhetik des Begreifens mit dem mühsamen Prozess des Beherrschens.',
    challengePrompt: 'Kannst du die Kernthese deines letzten Lieblings-Videoessays jemand anderem in 60 Sekunden erklären?',
    actionableTransfer: 'Nimm ein weißes Blatt Papier und zeichne die Kernidee eines Themas als Diagramm ohne Text nach.'
  },
  book_mastery: {
    title: 'Gegenstimme: Bücher-Metriken vs. ein Satz, der dich verwandelt',
    subtitle: '🤖 KI-Sparring • Kontrapunkt: Quantität vs. existenzielle Berührung',
    feedText: '„52 Bücher im Jahr lesen“: Produktivitäts-Gurus machen aus dem Lesen einen Leistungssport. Aber ist ein Buch nicht erst dann wertvoll, wenn wir monatelang an einem einzigen Absatz kauen?',
    articleBody: '> [!NOTE]\n> **🤖 Sparring-Transparenz:** Ein Plädoyer für langsames, verweilendes Lesen statt Bücher-Stapeln.\n\n### Worum es geht\nBlinkist, Zusammenfassungen, Speed-Reading: Die Jagd nach Lesequoten suggeriert, dass Bücher Datenpakete sind, die man in den Kopf laden muss.\n\n### Warum das wichtig ist\nEin wirklich großes Buch will nicht „abgehakt“ werden. Es will dein Weltbild erschüttern. Ein einziger Gedanke von Seneca, Montaigne oder Wittgenstein, den du wirklich ins Handeln übersetzt, ist wertvoller als 50 quer gelesene Ratgeber.\n\n### Die Gegenperspektive\nNicht die Zahl der gelesenen Seiten zählt, sondern wie viele Seiten dein Leben berührt haben. Wer zu schnell liest, gibt dem Gelesenen keine Chance, Widerstand zu leisten.\n\n### Zum Weiterdenken & Ausprobieren\nLies ein Kapitel, lege das Buch weg und gehe damit spazieren, statt sofort das nächste Kapitel zu starten.',
    keyInsight: 'Lesen ist kein Datentransfer, sondern eine Verwandlung; Verweilen schlägt Quantität.',
    counterPerspective: 'Quantitatives Bücher-Tracking verleitet dazu, leicht verdauliche Kost zu bevorzugen, um die Statistik aufzubessern.',
    challengePrompt: 'Welcher Satz aus einem Buch begleitet dich schon seit Jahren im Alltag?',
    actionableTransfer: 'Lies heute eine einzige Buchseite dreimal hintereinander und markiere nur den stärksten Satz.'
  },
  opportunities_growth: {
    title: 'Gegenstimme: Hebel-Wahn vs. geduldige Meisterschaft',
    subtitle: '🤖 KI-Sparring • Kontrapunkt: Quick Leverage vs. langlebiges Handwerk',
    feedText: 'Alle reden von Hebelwirkung, Skalierung und passiven Systemen. Doch was bleibt von der Freude am geduldigen, handwerklichen Meistern einer schwierigen Fertigkeit?',
    articleBody: '> [!NOTE]\n> **🤖 Sparring-Transparenz:** Kontrapunkt zur allgegenwärtigen Skalierungs- und Hebel-Kultur.\n\n### Worum es geht\nDie Startup- und Tech-Welt predigt: Suche dir den maximalen Hebel – Code, Medien, Kapital – um mit minimalem Aufwand maximale Reichweite zu erzielen.\n\n### Warum das wichtig ist\nWenn alles nur noch Mittel zum Hebeln ist, geht der Stolz am Handwerk verloren. Wirkliche Tiefe, Meisterschaft und Vertrauen wachsen langsam durch jahrelange, oft repetitive Praxis.\n\n### Die Gegenperspektive\nWer nur skaliert, baut oft Kartenhäuser ohne Fundament. Wahre Substanz entsteht dort, wo jemand bereit ist, lange an Details zu feilen, die niemand sofort sieht.\n\n### Zum Weiterdenken & Ausprobieren\nFinde eine Fertigkeit, bei der du ganz bewusst nicht auf Abkürzungen setzt, sondern dir Zeit zum Meistern nimmst.',
    keyInsight: 'Hebel ohne handwerkliche Substanz erzeugt Fragilität; Geduld ist der beste Wettbewerbsvorteil.',
    counterPerspective: 'Ein Übermaß an Hebeln führt oft zur Entfremdung von den tatsächlichen Bedürfnissen der Menschen, für die man arbeitet.',
    challengePrompt: 'An welcher Fertigkeit arbeitest du aus reiner Freude am Können, nicht für schnelles Skalieren?',
    actionableTransfer: 'Widme heute 20 Minuten einer analogen Grundfertigkeit, ohne dabei an Skalierbarkeit zu denken.'
  }
};
