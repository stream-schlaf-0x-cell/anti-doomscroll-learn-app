# Product & Engineering Backlog — Atem

## Phase 0: Foundation & Environment (Completed)
- [x] Host reconnaissance (macOS 13.7.8 Ventura, Intel x86_64, Node 24.13.0, npm 11.6.2).
- [x] Select stable framework: React Native with Expo SDK 54 + TypeScript + strict mode.
- [x] Identify iOS build constraints (prioritize Expo Go on physical device + Web preview).
- [x] Draft Architecture Decision Records (`docs/DECISIONS.md`).
- [x] Define Domain Schemas with Zod validation.

---

## Phase 1 & 1.1: Functional Vertical Slice & iPhone Compatibility (Completed)
- [x] Expo SDK 54 alignment for App Store Expo Go compatibility.
- [x] Design tokens and editorial typography system (`src/ui/theme.ts`).
- [x] Main Navigation / Tab Shell (Ausgabe, Bibliothek, Steuerung).
- [x] Onboarding flow with topic selection and reading preference setup.
- [x] Focused Article Reader with dark/light mode and deepening options.

---

## Phase 1.2: Reliable Persistence & Reading Experience (Completed)
- [x] Eliminate nested-lock storage deadlock (`TransactionScope` in `src/core/data/storage.ts`).
- [x] Quarantining corrupted data with `CorruptedDataError`.
- [x] Reader mounted as non-unmounting overlay with web URL sync (`?article=...`).
- [x] 18 unit tests passing across domain, ranking, and storage mutex.

---

## Phase 2: Real Personalized Discovery Feed & Pipeline (Completed)
- [x] **Domänen-Erweiterungen**: `feedText`, 7 redaktionelle Formate, 4 Evidenzstufen, 5 Gründer-Ziele (`PersonalGoal`), `PerspectiveDetails`.
- [x] **Speicherschutz**: `CorruptedDataError` schützt vor Datenverlust; entkoppelte Offline-Bibliothek (`saveArticle`/`unsaveArticle` unter `@atem:saved_articles:v1`); `storageGenerationRef` sichert Daten-Resets ab.
- [x] **RSS/Atom-Ingestion**: 10 verifizierte öffentliche Endpunkte; robuster XML-Parser; Normalisierung, SHA-256-Hashing und kanonische URL-Deduplizierung; 36 reale Artikel in `pipeline-output.json`.
- [x] **Provider-unabhängiges Enrichment**: Offizielle Gemini-Tokenpreise modelliert; `EnrichmentUsageLedger` erzwingt harte 5,00 €/Monat Grenze; `EnrichmentCache`; Null-Kosten-Fallback `SourceOnlyEnricher`.
- [x] **Mehrdimensionale Personalisierung**: Themen, Ziele (`TOPIC_GOAL_MAP`), Lesezeit, Feedback-Memory (`boostedAuthors`/`penalizedTopics`), weiche redaktionelle Quoten (~10% Didaktik, ~10% Gegenpositionen), transparentes „Warum sehe ich das?“-Modal.
- [x] **Feed-UI & Batching**: Substanzieller In-Card Leseinhalt (`feedText`), Format- und Evidenz-Badges, Quoten-Hinweise, In-Feed Feedback-Daumen, feste Tagesausgabe (10–12 Artikel), „Weiter entdecken“ hängt 10 Artikel ohne Kartensprung oder Wiederholungen an.
- [x] **Verifikation & Evidenz**: 48 Unit-Tests (6 Suites), 0 Typecheck-Fehler, 0 Lint-Warnungen, Expo Doctor 18/18 Checks, Produktions-Web-Export `dist/`, 8 Headless Chrome Screenshots (iPhone 15 Pro: 393 × 852 px), Review-Archiv `atem-phase-2-review.zip`.

---

## Phase 3: Gehostete Automatisierung & Cloud-Deployment (Nächster Schritt)
- [ ] Supabase Edge Function für täglichen Ingestion-Cron (05:00 UTC).
- [ ] PostgreSQL Schema-Migration für normalisierte Beiträge und Cache.
- [ ] Signierter API-Endpunkt für den mobilen Client (Tagesausgabe als leichtgewichtiger JSON-Snapshot).
- [ ] Optionaler nativer Reddit-OAuth-Adapter für kuratiertes r/singularity / Tech-Scanning.
- [ ] Produktions-Aktivierung des `ProviderEnricher` mit hinterlegtem API-Schlüssel auf Server-Ebene.

---

## Phase 4: Apple-Ökosystem & Wissens-Integrationen
- [ ] Apple Shortcuts & App Intents („Lies Atem Tagesausgabe“, „Atem Quick Insight“).
- [ ] Lock Screen & Home Screen Widgets (WidgetKit via Expo Config Plugin).
- [ ] Craft Read-Only Connector (Verknüpfung mit didaktischen Schreibprojekten).
- [ ] Raindrop.io Connector (Lesezeichen-Abgleich mit privater Sammlungsbegrenzung).
- [ ] Dynamic Type Font Scaling & VoiceOver Barrierefreiheits-Audit.
