# Technical Architecture: Atem

## 1. System Topology Overview
Atem trennt Ingestion, serverseitiges/workerseitiges Enrichment und mobile Präsentation strikt voneinander. Der mobile Client läuft vollständig lokal und offlinefähig.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        INGESTION & ENRICHMENT PIPELINE                 │
│  (Läuft als CLI-Job / Cron / Worker außerhalb der React-Native-App)    │
│                                                                        │
│  ┌─────────────────┐       ┌─────────────────┐       ┌───────────────┐ │
│  │ 10 Live Feeds   │ ────> │ XML Parser      │ ────> │ Normalizer    │ │
│  │ (RSS 2.0 / Atom)│       │ (Entities/HTML) │       │ & SHA-256     │ │
│  └─────────────────┘       └─────────────────┘       └───────┬───────┘ │
│                                                              │         │
│  ┌───────────────────────────────────────────────────────────▼───────┐ │
│  │ Deduplicator (Kanonische URLs, Hash-Clustering, Content-Guard)    │ │
│  └───────────────────────────┬───────────────────────────────────────┘ │
│                              │                                         │
│  ┌───────────────────────────▼───────────────────────────────────────┐ │
│  │ IContentEnricher:                                                 │ │
│  │ ├─ EnrichmentUsageLedger (Hartes €5.00/Monat Ausgabenlimit)       │ │
│  │ ├─ EnrichmentCache (Key: contentHash + promptVersion)             │ │
│  │ ├─ ProviderEnricher (Gemini 2.5/3.8 Flash, strukturierte Zod-Ausg)│ │
│  │ └─ SourceOnlyEnricher (Null-Kosten lokaler Fallback)              │ │
│  └───────────────────────────┬───────────────────────────────────────┘ │
│                              │                                         │
│                              ▼                                         │
│                   pipeline-output.json                                 │
└──────────────────────────────┬─────────────────────────────────────────┘
                               │
                               ▼
┌────────────────────────────────────────────────────────────────────────┐
│                          PRESENTATION & CLIENT LAYER                   │
│  Expo SDK 54 / React Native 0.81.5 (iPhone 15 Pro optimiert, Web)      │
│                                                                        │
│  ┌───────────────┐  ┌────────────────┐  ┌─────────────┐  ┌───────────┐ │
│  │ FeedScreen    │  │ ReaderScreen   │  │ Library     │  │ Settings  │ │
│  │ (Finite Batch,│  │ (Overlay-Modus,│  │ (Entkoppelt,│  │ (Ziele,   │ │
│  │ Standalone-   │  │ Typografie,    │  │ Offline-    │  │ Themen,   │ │
│  │ FeedText)     │  │ Provenienz)    │  │ Volltext)   │  │ Ledger)   │ │
│  └───────┬───────┘  └───────┬────────┘  └──────┬──────┘  └─────┬─────┘ │
└──────────┼──────────────────┼──────────────────┼───────────────┼───────┘
           │                  │                  │               │
┌──────────▼──────────────────▼──────────────────▼───────────────▼───────┐
│                       APPLICATION & STATE LAYER                         │
│  AppContext (Sequenzierte Recomputation, StorageGenerationRef)          │
│  Multi-Dimensional Ranking Engine:                                     │
│  ├─ Themen-Affinität & Persönliche Ziele (TOPIC_GOAL_MAP)              │
│  ├─ Lesezeit-Passung & Feedback-Memory (boostedTopics/Authors)         │
│  └─ Weiche redaktionelle Quoten (~10% Didaktik, ~10% Gegenpositionen)  │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
┌──────────────────────────────────▼─────────────────────────────────────┐
│                          DOMAIN & DATA LAYER                           │
│  Zod-Schemas: FeedItem, UserProfile, PersonalGoal, ReadingInteraction  │
│  Repository Pattern:                                                   │
│  ├─ LocalFeedRepository: Top 10-12 Tagesausgabe + Disjunkte Discovery  │
│  ├─ LocalUserProfileRepository: Speicherschutz gegen Clobbering        │
│  └─ LocalLibraryRepository: Entkoppelte Speicherung unter              │
│     @atem:saved_articles:v1                                            │
│  Storage Mutex & Transaktionen:                                        │
│  └─ TransactionScope mit atomarer Quarantäne bei Beschädigung          │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Architektonische Leitprinzipien

### Ingestion außerhalb des UI-Lifecycles
Die Sammlung, Bereinigung und Aufbereitung von Inhalten erfolgt nicht beim Start der App oder beim Scrollen, sondern entkoppelt über den Worker (`scripts/run-pipeline.ts` / `npm run ingest`). Das mobile UI liest den vorbereiteten Snapshot (`pipeline-output.json` mit Fixture-Fallback) schnell und ohne Latenz.

### Entkoppelte Bibliotheks-Persistenz
In früheren Versionen referenzierte die Bibliothek nur IDs aus dem aktuellen Feed. Wird der Feed durch neue Tagesausgaben rotiert, blieben gespeicherte Artikel nicht erhalten. In Phase 2 speichert `ILibraryRepository.saveArticle()` die vollständige Artikelentität inklusive Provenienz und Volltext unter dem Key `@atem:saved_articles:v1`. Gespeicherte Artikel sind somit unbegrenzt offline verfügbar, selbst wenn sie aus dem Feed verschwinden.

### Speichersicherheit & Schutz vor Datenverlust
- **Quarantäne statt Destruktion**: Beschädigte Rohdaten im lokalen Speicher führen nicht zu einem stillen Fallback auf Standardwerte mit anschließendem Überschreiben der Datei, sondern lösen `CorruptedDataError` aus. Die beschädigten Bytes werden unter `<key>.corrupt.<iso>` isoliert.
- **Generation Token (`storageGenerationRef`)**: Verhindert, dass verzögerte Hintergrund-Schreibvorgänge (z. B. gedrosselter Lesefortschritt nach 800 ms) nach einem bewussten Reset durch den Nutzer alte Daten wiederherstellen können.

### Provider-unabhängiges Enrichment & Budget-Deckelung
- Das Interface `IContentEnricher` trennt die Anwendungslogik vom konkreten LLM-Anbieter.
- `EnrichmentUsageLedger` speichert Token-Verbrauch und Kosten lokal persistent. Vor jedem Aufruf wird geprüft, ob die konfigurierte Obergrenze (5,00 €/Monat) überschritten wird.
- Bei Budget-Erschöpfung oder im Offline-/Demo-Modus übernimmt automatisch der `SourceOnlyEnricher`, der ohne externe Anfragen aus den Feed-Metadaten verlässliche `feedText`-Texte generiert.

### Deterministisches Batching ohne Scroll-Sprünge
`FeedScreen` rendert eine feste Tagesausgabe von 10–12 Beiträgen. Am Ende der Ausgabe wird dem Nutzer ein bewusster Stopp-Punkt angeboten („Ende dieser Ausgabe“). Erst durch aktives Tippen auf „Weiter entdecken“ werden die nächsten 10 Artikel aus dem Entdeckungs-Pool angehängt. Bereits gerenderte Karten behalten ihre exakte Position, ohne Neusortierung oder Wiederholung von Artikeln.
