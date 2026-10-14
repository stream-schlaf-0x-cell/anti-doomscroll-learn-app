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

4. **Automatisierte Test-Suite (48 Tests in 6 Suites)**:
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
   - **Provider-Independent Enrichment & €5 Budget Enforcement** (8 Tests):
     * Exakte Berechnung von Token-Kosten anhand offizieller Gemini-Preise.
     * `EnrichmentUsageLedger` erfasst Aufrufe und akkumuliert Monatsausgaben.
     * Erzwingung des harten Ausgabenlimits (5,00 €) und Sperre bei Erreichen.
     * `EnrichmentCache` puffert Ergebnisse anhand von `contentHash + promptVersion`.
     * `SourceOnlyEnricher` operiert mit Null-Kosten und erzeugt deutsche `feedText`-Texte.
     * `ProviderEnricher` nutzt Modell bei verfügbarem Budget und erfasst Kosten.
     * `ProviderEnricher` serviert gecachte Ergebnisse ohne erneute Kosten.
     * Automatischer Fallback auf `SourceOnlyEnricher` bei Budget-Überschreitung.
   - **Feed Batching & Discovery Partitioning Invariants** (5 Tests):
     * Tagesausgabe liefert maximal 12 Artikel.
     * Disjunkte Mengen: Keine Überschneidungen von IDs zwischen Tagesausgabe und Discovery-Pool.
     * Alle verbleibenden Artikel bleiben im Discovery-Pool erhalten.
     * Vollständige Abbildung aller 4 `EvidenceTier`-Werte auf deutsche Labels.
     * Vollständige Abbildung aller 7 `FeedItemFormat`-Werte auf redaktionelle Badges.
   - **Storage Mutex & Persistence Architecture** (12 Tests):
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
   - **Content Ingestion Pipeline: Parser, Normalizer & Deduplication** (8 Tests):
     * Parst RSS 2.0 XML fehlerfrei.
     * Parst Atom 1.0 XML fehlerfrei.
     * Bereinigt HTML-Tags und dekodiert Entitäten (inkl. deutscher Umlaute).
     * Bereinigt kanonische URLs von Tracking- und Marketing-Parametern.
     * Generiert deterministische SHA-256 Content-Hashes.
     * Normalisiert Rohdaten in schemagültige `FeedItem`-Objekte.
     * Dedupliziert Artikel anhand von kanonischer URL, Hash und Titel.
     * Fängt leeres oder fehlerhaftes XML ab, ohne zu werfen.

5. **Projekt-Gesundheit & Expo Doctor**:
   ```bash
   npx expo-doctor@latest
   ```
   Alle 18 Diagnose-Checks müssen ohne Befund abschließen.

6. **Web Export Build**:
   ```bash
   npx expo export -p web
   ```
   Erzeugt das produktionsreife Standalone-Bundle in `dist/`.

7. **Headless Chrome UI-Verifikation (iPhone 15 Pro: 393 × 852 px)**:
   In `docs/screenshots/` abgelegt:
   - `01-onboarding.png`: Initiales Willkommen & Themenselektion
   - `02-feed-hero.png`: Tagesausgabe mit Hero-Karte, eigenständigem `feedText`, Format- und Evidenz-Badges
   - `03-why-modal.png`: Transparente Relevanzaufschlüsselung („Warum sehe ich das?“)
   - `04-feed-finite-edition.png`: Banner „Ende dieser Ausgabe“ mit bewusstem Stopp-Punkt
   - `05-feed-weiter-entdecken.png`: Nahtlos angehängte Entdeckungsbeiträge ohne Kartensprung
   - `06-reader-view.png`: Volltext-Lesemodus mit Typografie und redaktioneller Provenienz
   - `07-library-decoupled.png`: Entkoppelte Offline-Bibliothek
   - `08-settings-goals-budget.png`: Einstellungen mit Themengewichtungen und Lesezeiten
