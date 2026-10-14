# Product Specification: Atem (The AI-Native Antidote to Doomscrolling)

## 1. Vision & Core Philosophy
Atem is an iPhone-first personal intellectual environment and reading feed designed to replace habitual social-media scrolling (specifically Reddit and algorithmic feeds) with intentional, high-substance reading.

### North Star Outcome
**More meaningful reading, discovery, understanding, and retention per minute of attention.**
- Not maximum session duration.
- Not endless swipes or algorithmic rage-bait.
- Not superficial flashcards or compulsory quizzes.
- Not artificial engagement hacks.

Reading is the primary, celebrated experience. Short items are complete in the feed; longer items open in the focused reader.

---

## 2. Target Profile (Founder Starter Persona)
- **Role**: Philosophy/Ethics & German Teacher in Dresden, Germany (Sekundarstufe I & II, Saxon curriculum).
- **Primary Device**: iPhone 15 Pro, iOS 17/18.
- **Tone & Language**: German-first, accessible, warm "du", source-grounded without pretension.
- **Core Interests & Topic Weights**:
  - `philosophy_ethics` (90%): Erkenntnistheorie, Moralphilosophie, Philosophie des Geistes, Existenzialismus.
  - `german_didactics` (85%): Deutschunterricht Sek. I, Lernpsychologie, Didaktik, Bildungspolitik.
  - `ai_apple` (80%): Frontier AI acceleration, Singularity discourse, Apple Ecosystem, on-device computing.
  - `contemplation_mind` (75%): Buddhismus, Achtsamkeit, Kognitionswissenschaft, kontemplative Psychologie.
  - `science_society` (70%): Naturwissenschaftliche Durchbrüche, Kulturphilosophie, Demokratietheorie.
  - `sound_synthesis` (60%): Modulare Synthese, Eurorack, Ambient, Sounddesign, algorithmische Komposition.

### Explicit Personal Goals (`PersonalGoal`)
1. `understand_tech`: Technologie & KI-Beschleunigung tief durchdringen.
2. `creative_music`: Kreativprojekte, Synthese und Musikkomposition voranbringen.
3. `deepen_attention`: Aufmerksamkeitsspanne, Lernpraxis und Kontemplation stärken.
4. `philosophical_clarity`: Philosophische Grundfragen, Dialektik und Phänomenologie verstehen.
5. `society_and_ethics`: Gesellschaftlichen Diskurs, Medienökologie und Wertekonflikte einordnen.

### Soft Editorial Quotas
- **Didaktik-Bezug**: Mindestens ~10 % der Beiträge weisen einen praktischen Schul- oder Didaktikbezug auf.
- **Herausfordernde Gegenperspektiven**: Mindestens ~10 % der Beiträge fordern eine Grundannahme dialektisch heraus oder bieten eine ungewohnte Sichtweise.

---

## 3. Feed Architecture & Content Taxonomy

### In-Card vs. Expanded Reader Distinction
- **`feedText` (In-Card Reading)**: Substanzieller, in sich geschlossener Text direkt auf der Karte (5–8 Zeilen, 80–250 Wörter). Kein inhaltsleeres Teaser-Snippet. Der Nutzer gewinnt sofort Substanz, ohne die Karte verlassen zu müssen.
- **`articleBody` (Optionaler Langform-Reader)**: Vertiefender Essay oder ausführliche Recherche (400–1.500 Wörter). Wird nur über „Im Lesemodus vertiefen →“ geöffnet, wenn echter Mehrwert über den `feedText` hinaus vorliegt.

### 7 Phase 2 Editorial Formats (`FeedItemFormat`)
1. `concise_insight` (`⚡︎ Kompaktimpuls`): Prägnanter Gedanke oder Kernerkenntnis, in 30–60s vollständig erfassbar.
2. `sourced_update` (`◈ Recherche & Update`): Aktuelle Entwicklung mit überprüfbaren Primärquellen.
3. `creative_idea` (`💡 Kreativer Impuls`): Praktischer Impuls für Musik, Synthese oder kreatives Schaffen.
4. `intriguing_question` (`❓ Denkfrage`): Philosophische oder didaktische Leitfrage mit Denkanstoß.
5. `surprising_connection` (`☍ Interdisziplinäre Brücke`): Unerwartete Querverbindung (z. B. Epistemologie & Neuro-Inferenz).
6. `perspective_disagreement` (`✦ Philosophische Gegenposition`): Dialektischer Einwand oder Kontroverse.
7. `long_invitation` (`📖 Vertiefender Essay`): Einladung in eine gründliche Langform-Lektüre.

### 4 Evidenzstufen (`EvidenceTier`)
- `metadata_only`: Nur Metadaten und Primärlink verfügbar.
- `publisher_excerpt`: Auszug oder Abstract des Original-Herausgebers.
- `permitted_full_text`: Genehmigter oder lizenzierter Volltext.
- `multiple_sources`: Redaktionelle Synthese aus mehreren belegten Quellen.

---

## 4. Finite Tagesausgabe & „Weiter entdecken“
- **Feste Tagesausgabe**: Exakt 10–12 deterministisch kuratierte Beiträge.
- **Innehalte-Banner („Ende dieser Ausgabe“)**: Bewusster Stopp-Punkt gegen Endlos-Scrolling.
- **„Weiter entdecken“**: Lädt deterministisch 10 weitere Beiträge aus dem Entdeckungs-Pool an das Listenende an.
  - Bereits gelesene Karten bleiben exakt an ihrer Position (kein Shuffling).
  - Keine Wiederholungen von Beiträgen.
  - Exakte Beibehaltung der Scrollposition.
  - Keine versteckten Kosten (reine lokale Filterung/Reihung).

---

## 5. Budget- & Kostenrahmen
- **Persönliches Budgetziel**: Maximal 5,00 €/Monat für einen Einzelnutzer.
- **Gemini Flash LLM-Kosten**: ~0,10–0,25 €/Monat bei 10 kuratierten Beiträgen/Tag ($0.10/1M Input, $0.40/1M Output).
- **Hartes Spending-Limit**: `EnrichmentUsageLedger` stoppt automatische Modellanfragen bei Erreichen von 5,00 € im laufenden Kalendermonat.
- **Null-Kosten-Fallback**: `SourceOnlyEnricher` gewährleistet ununterbrochenen Betrieb komplett ohne API-Kosten.
