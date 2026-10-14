# Atem — An AI-Native Antidote to Doomscrolling

> **Eine personalisierte, KI-unterstützte Lese- und Entdeckungs-App für das iPhone.**  
> Mehr bedeutungsvolles Lesen, Verstehen und Behalten pro Minute Aufmerksamkeit.

Atem ersetzt reflexartiges Social-Media-Scrolling durch fokussiertes, anspruchsvolles und ästhetisch gestaltetes Lesen. Keine Endlos-Feeds, keine Clickbait-Mechanismen, keine Zwangs-Quizze — sondern eine persönliche intellektuelle Umgebung, die mit deinen Interessen wächst.

---

## 📱 Schnellstart: Auf dem Mac & iPhone testen

### 1. Abhängigkeiten installieren
```bash
npm ci
```
*(Das Lockfile ist synchronisiert und verifiziert für reproduzierbare Builds).*

### 2. Im Web-Browser (Mac) starten
Für eine sofortige lokale Vorschau:
```bash
npm run web
```
Öffnet automatisch `http://localhost:8081`. URL-Deeplinks wie `http://localhost:8081/?article=art-007-bundle-self` werden direkt unterstützt.

### 3. Auf dem physischen iPhone 15 Pro testen (Expo Go)
> **Kompatibilitätshinweis**: Das Projekt ist auf **Expo SDK 54** ausgerichtet (React Native 0.81.5), da die offizielle Apple App Store Version von Expo Go bis SDK 54 unterstützt.
1. Installiere **Expo Go** kostenlos aus dem App Store auf deinem iPhone 15 Pro (kein kostenpflichtiger Developer-Account nötig).
2. Starte im Terminal auf deinem Mac:
   ```bash
   npx expo start
   ```
3. Öffne die **Kamera-App** auf deinem iPhone und scanne den im Terminal angezeigten QR-Code (stelle sicher, dass iPhone und Mac im selben WLAN sind, oder nutze `npx expo start --tunnel`).
4. Atem öffnet sich direkt nativ auf deinem iPhone.
*(Hinweis: Lokale physische Gerätetests bleiben als „bereit für Expo Go SDK 54 auf iPhone 15 Pro“ gekennzeichnet, bis sie physisch am Gerät beobachtet wurden; die interaktive Web-Laufzeit ist zu 100% verifiziert).*

### 4. Tests, Ingestion & Typüberprüfung
```bash
npm run typecheck      # TypeScript Compiler (0 Fehler)
npm run lint           # Expo ESLint (0 Warnungen / 0 Fehler)
npm test               # 48 automatisierte Tests in 6 Suites
npm run ingest         # Externe RSS/Atom-Ingestion ausführen
npx expo-doctor@latest # 18/18 Checks bestanden
```

---

## 🌟 Kernfunktionen (Phase 2 — Personalisierter Discovery-Feed mit Live-Pipeline)

- **Substanzielle In-Card-Lektüre (`feedText`)**: Vollständiger, eigenständiger Leseinhalt direkt auf der Karte (keine leeren Teaser-Snippets). Kurze Beiträge sind direkt im Feed abgeschlossen; ausführliche Essays öffnen den vertiefenden Lesemodus.
- **7 Redaktionelle Formate & 4 Belegstufen**: Klare Einordnung (`⚡︎ Kompaktimpuls`, `◈ Recherche & Update`, `✦ Philosophische Gegenposition`, `☍ Interdisziplinäre Brücke`) und Evidenztransparenz (`Herausgeber-Auszug`, `Volltext verfügbar`, etc.).
- **Reale RSS/Atom-Pipeline**: 10 verifizierte Live-Quellen aus Philosophie, Didaktik, KI-Beschleunigung, Modular-Synthese und Wissenschaft mit kanonischer URL-Deduplizierung und SHA-256-Hashing.
- **Provider-unabhängiges Enrichment & €5-Budgetgrenze**: Offiziell grounded Gemini-Flash-Preise mit persistentem Monats-Ledger (`EnrichmentUsageLedger`). Automatischer Null-Kosten-Fallback (`SourceOnlyEnricher`) verhindert unerwartete Kosten.
- **Mehrdimensionales Relevanz-Scoring**: Berücksichtigt Themenaffinitäten, persönliche Ziele (`PersonalGoal`), Lesezeit-Passung, Feedback-Memory für Autoren und Themen sowie abklingende Verhaltenssignale.
- **Redaktionelle Quoten**: Garantiert ~10% Didaktik-Bezug und ~10% dialektische Gegenpositionen in der primären Tagesausgabe.
- **Fokussierte Tagesausgabe & „Weiter entdecken“**: 10–12 Artikel mit bewusstem Innehalte-Banner („Ende dieser Ausgabe“). Zusätzliche Artikel werden deterministisch unten angehängt, ohne bestehende Karten neu zu sortieren oder zu wiederholen.
- **Entkoppelte Offline-Bibliothek**: Vollständige Artikelentitäten werden offline unter `@atem:saved_articles:v1` gesichert und überdauern Feed-Rotationen und Cache-Bereinigungen.

---

## 🏗 Architektur & Dokumentation

- [`AGENTS.md`](./AGENTS.md): Runbook für Antigravity-Agenten
- [`docs/PRODUCT.md`](./docs/PRODUCT.md): Produktspezifikation & Leitbild
- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md): Systemtopologie & Schichtenarchitektur
- [`docs/INTEGRATIONS.md`](./docs/INTEGRATIONS.md): Quellen-Register & Kostenmodell
- [`docs/DECISIONS.md`](./docs/DECISIONS.md): Architektur-Entscheidungen (ADR 001 – ADR 013)
- [`docs/BACKLOG.md`](./docs/BACKLOG.md): Entwicklungs-Backlog
- [`docs/PROGRESS.md`](./docs/PROGRESS.md): Fortschritts- und Meilenstein-Log
- [`docs/QA.md`](./docs/QA.md): Testplan & Verifikations-Runbook
- [`REVIEW_HANDOFF_PHASE_2.md`](./REVIEW_HANDOFF_PHASE_2.md): Ausführlicher Handoff-Bericht zu Phase 2
