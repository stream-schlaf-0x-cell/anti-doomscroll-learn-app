# Quality Assurance & Verification Runbook — Atem

## Automated Verification Gates

1. **Reproducible Installation**:
   ```bash
   npm ci
   ```
   Sichert vollständige Lockfile-Übereinstimmung und identische Abhängigkeitsbäume.

2. **TypeScript Typsicherheit**:
   ```bash
   npm run typecheck
   ```
   Führt `tsc --noEmit` aus. Muss mit 0 Fehlern und 0 Warnungen abschließen.

3. **Linter**:
   ```bash
   npm run lint
   ```
   Führt `expo lint` aus. Muss mit 0 Fehlern und 0 Warnungen abschließen.

4. **Automatisierte Test-Suite (91 Tests in 16 Suites)**:
   ```bash
   npm test
   ```
   Validiert:
   - **Domain Schemas & Invariant Validation** (6 Tests):
     * Alle Fixtures genügen `FeedItemSchema`.
     * `DEFAULT_USER_PROFILE` genügt `UserProfileSchema`.
     * Schema-Abweisung ungültiger Lese-Interaktionen.
     * Verteilung der Lesezeiten (Quick Insights, Briefings, Deep Dives).
     * Vorhandensein von eigenständigem `feedText` und Phase-2-Metadaten.
     * `PersonalGoal`-Schema und deutsche Metadaten-Zuordnung.
   - **Deterministic Ranking Engine** (9 Tests):
     * Themenaffinität bevorzugt Top-Interessen.
     * Lesezeit-Passung verstärkt passende Beiträge.
     * Beobachtbare Rangunterschiede zwischen kurzen und langen Lese-Präferenzen.
     * Daumen-Feedback (`more_like_this` / `less_like_this`) passt Reihung an.
     * Topic-Interleaving verhindert thematische Klumpenbildung.
     * Transparente Aufschlüsselung im Erklärungsmuster.
     * Zielabgleich (`PersonalGoal`) steuert Relevanz.
     * Feedback-Memory für Autoren und Themen.
     * Weiche redaktionelle Quoten (~10% Didaktik, ~10% Gegenpositionen).
   - **Provider-Independent Enrichment & €5 Budget Enforcement** (9 Tests):
     * Exakte Berechnung von Token-Kosten anhand offizieller Gemini-Preise.
     * `EnrichmentUsageLedger` erfasst Aufrufe und akkumuliert Monatsausgaben.
     * Erzwingung des harten Ausgabenlimits (5,00 €) und Sperre bei Erreichen.
     * `EnrichmentCache` puffert Ergebnisse anhand von `contentHash + promptVersion`.
     * `SourceOnlyEnricher` operiert mit Null-Kosten und erzeugt deutsche `feedText`-Texte.
     * `ProviderEnricher` nutzt Modell bei verfügbarem Budget und erfasst Kosten.
     * `ProviderEnricher` serviert gecachte Ergebnisse ohne erneute Kosten.
     * Automatischer Fallback auf `SourceOnlyEnricher` bei Budget-Überschreitung.
     * `GeminiEnricher` fängt fehlende API-Keys ab und liefert verlässliche Sparring-Antworten.
   - **Feed Batching & Discovery Partitioning Invariants** (5 Tests):
     * Tagesausgabe liefert maximal 12 Artikel.
     * Disjunkte Mengen: Keine Überschneidungen von IDs zwischen Tagesausgabe und Discovery-Pool.
     * Alle verbleibenden Artikel bleiben im Discovery-Pool erhalten.
     * Vollständige Abbildung aller 4 `EvidenceTier`-Werte auf deutsche Labels.
     * Vollständige Abbildung aller 7 `FeedItemFormat`-Werte auf redaktionelle Badges.
   - **Storage Mutex & Persistence Architecture** (14 Tests):
     * Profil-Speicherung setzt sich ohne Hänger ab.
     * Save, Unsave, Progress, Feedback und Reset laufen ohne Mutex-Deadlock.
     * Nebenläufige Updates auf verschiedene Artikel erhalten beide Änderungen.
     * Gleichzeitige Fortschritts- und Lesezeichen-Updates auf denselben Artikel bleiben erhalten.
     * Fehlgeschlagene Treiber-Operationen geben Locks sauber frei.
     * Neue Repository-Instanzen lesen persistierte Daten von Platte.
     * Anti-Overwriting: Verzögerte asynchrone Writes überschreiben keine neueren Änderungen.
     * `CorruptedDataError` schützt Rohdaten vor destruktivem Überschreiben.
     * Entkoppelte Speicherung gespeicherter Artikel unter `@atem:saved_articles:v1`.
     * Unsave entfernt den Artikel sauber aus der entkoppelten Speicherung.
     * `clearLibrary` leert Interaktionen und gespeicherte Vollartikel vollständig.
     * `addNote` speichert Reflexionsnotizen mit Tags und Zeitstempeln.
     * `voteItem` aktualisiert Vote-Scores und Daumen-Feedback atomar.
   - **Content Ingestion Pipeline: Parser, Normalizer & Deduplication** (8 Tests):
     * Parst RSS 2.0 XML fehlerfrei.
     * Parst Atom 1.0 XML fehlerfrei.
     * Bereinigt HTML-Tags und dekodiert Entitäten (inkl. deutscher Umlaute).
     * Bereinigt kanonische URLs von Tracking- und Marketing-Parametern.
     * Generiert deterministische SHA-256 Content-Hashes.
     * Normalisiert Rohdaten in schemagültige `FeedItem`-Objekte.
     * Dedupliziert Artikel anhand von kanonischer URL, Hash und Titel.
     * Fängt leeres oder fehlerhaftes XML ab, ohne zu werfen.
   - **FoundationalCanonService** (4 Tests):
     * Lädt den Genesis-Kanon mit vorbesetzten Lesezeichen und Gewichten.
     * Persistiert benutzerdefinierte Kanon-Snapshots.
     * Exportiert den Wissenskanon nach Markdown und JSON.
   - **MusicRecommendationService** (3 Tests):
     * Grounding gegen iTunes / Spotify Metadaten für Sound-Synthese und Konzentration.
     * Formatierung und Filtersuche nach Titeln und Künstlern.
   - **OnTheFlyStreamService** (3 Tests):
     * Generiert vollständige maßgeschneiderte Wissens-Streams für „Empty Pockets“.
     * Validiert alle generierten Elemente gegen `FeedItemSchema`.
     * Unterstützt optionale Meme- und AI-Synthese-Filterung.
   - **RaindropService** (6 Tests):
     * Zero-Network Demo-Token Verifikation und Sammlungs-Extraktion.
     * Kalibriert Themenaffinitäten basierend auf Lesezeichen-Tags.
     * Konvertiert Bookmarks in vollwertige `FeedItem`-Objekte.
   - **RecursiveLearningEngine** (4 Tests):
     * Verfolgt kognitive Interessenentwicklung mit Bayesian-Dämpfung.
     * Erzeugt transparente Erklärungen für Themenanpassungen.
   - **SourceRepository & News Hub Ingestion Engine** (7 Tests):
     * Verwaltung verifizierter Quellen und benutzerdefinierter RSS-Feeds.
     * OPML 2.0 XML Import & Export.
     * Preset-Filter (ÖRR, Alle Quellen).
   - **SpaceRepository** (4 Tests):
     * Verwaltung modularer Subchannels (`c/acceleration`, `c/sound_synthesis`, `c/dialektik`).
     * Erstellung neuer Subchannels mit sanitisierten Handles und Pinning.
   - **TrendRadarService** (3 Tests):
     * Dialektische Hegelsche Trend-Analyse (These, Antithese, Synthese).
     * Umwandlung in schemagültige Feed-Objekte.

5. **Projekt-Gesundheit & Expo Doctor**:
   ```bash
   npx expo-doctor@latest
   ```
   Alle 18 Diagnose-Checks schließen ohne Befund ab.

6. **Web Export Build**:
   ```bash
   npx expo export -p web
   ```
   Erzeugt das produktionsreife Standalone-Bundle in `dist/`.
