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
> **Kompatibilitätshinweis**: Das Projekt ist auf **Expo SDK 54** ausgerichtet (React Native 0.76.7), da die offizielle Apple App Store Version von Expo Go bis SDK 54 unterstützt.
1. Installiere **Expo Go** kostenlos aus dem App Store auf deinem iPhone 15 Pro (kein kostenpflichtiger Developer-Account nötig).
2. Starte im Terminal auf deinem Mac:
   ```bash
   npx expo start
   ```
3. Öffne die **Kamera-App** auf deinem iPhone und scanne den im Terminal angezeigten QR-Code (stelle sicher, dass iPhone und Mac im selben WLAN sind, oder nutze `npx expo start --tunnel`).
4. Atem öffnet sich direkt nativ auf deinem iPhone.
*(Hinweis: Lokale physische Gerätetests bleiben als „bereit für Expo Go SDK 54 auf iPhone 15 Pro“ gekennzeichnet, bis sie physisch am Gerät beobachtet wurden; die interaktive Web-Laufzeit ist zu 100% verifiziert).*

### 4. Tests, Typüberprüfung & Linting
```bash
npm run typecheck    # TypeScript Compiler (0 Fehler)
npm run lint         # Expo ESLint (0 Warnungen / 0 Fehler)
npm test             # 18 automatisierte Tests (Domain, Ranking, Persistenz)
npx expo-doctor@latest # 18/18 Checks bestanden
```

---

## 🌟 Kernfunktionen (Phase 1.2 — Nachgewiesene Zuverlässigkeit)

- **Fokussierte Tagesausgabe (Finite Daily Edition)**: Klare redaktionelle Auswahl statt Endlos-Feed, mit explizitem Abschluss-Banner „Ende dieser Ausgabe“ gegen Doomscrolling.
- **Redaktionelle Längenvielfalt**:
  - *3 Kompaktimpulse* (100–200 Wörter, ca. 1 Min. Lesezeit bei 220 W/Min.)
  - *3 Briefings* (350–650 Wörter, ca. 2–3 Min.)
  - *2 Tiefgänge / Essays* (900–1.400 Wörter, ca. 4–5 Min.)
  - *1 Entdeckungsbeitrag* (500–800 Wörter, ca. 2–3 Min.)
- **Verifizierte Quellenherkunft & Transparenz**: Vollständige URLs zu realen Primärquellen, echte Autoren, Original-Publikationszeitstempel, Erfassungszeitpunkte und deutsche Fact-Review-Statusanzeige.
- **Deadlock-freie Persistenz**: Single-Lock Mutex-Architektur mit `TransactionScope` verhindert Race Conditions und Verklemmungen bei gleichzeitigen Schreibvorgängen.
- **Transparente Fehlerbehandlung & Quarantäne**: Typisierte Speicherfehler (`StorageUnavailableError`, `CorruptedDataError`); beschädigte Rohdaten werden in isolierte Quarantäne verschoben statt stillschweigend überschrieben.
- **Zustandserhaltender Reader**: Als Overlay gerendert; Feed-Scrollposition, Themenfilter und Entdeckungsaufklappung bleiben beim Schließen eines Artikels vollständig erhalten. Vollständige Browser-History-Synchronisation (`?article=...`).
- **Getrennte Einstellungen**: Nicht-destruktives „Onboarding wiederholen“ (Lesezeichen und Leseverlauf bleiben erhalten) getrennt von destructivem „Alle lokalen Daten löschen“ mit explizitem Bestätigungsdialog.

---

## 🏗 Architektur & Dokumentation

- [`AGENTS.md`](./AGENTS.md): Runbook für Antigravity-Agenten
- [`docs/PRODUCT.md`](./docs/PRODUCT.md): Produktspezifikation & Leitbild
- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md): Systemtopologie & Schichtenarchitektur
- [`docs/DECISIONS.md`](./docs/DECISIONS.md): Architektur-Entscheidungen (ADRs)
- [`docs/BACKLOG.md`](./docs/BACKLOG.md): Entwicklungs-Backlog
- [`docs/PROGRESS.md`](./docs/PROGRESS.md): Fortschritts- und Meilenstein-Log
- [`docs/QA.md`](./docs/QA.md): Testplan & Akzeptanzkriterien
