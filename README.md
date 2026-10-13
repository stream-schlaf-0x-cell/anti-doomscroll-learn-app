# Atem — An AI-Native Antidote to Doomscrolling

> **Eine personalisierte, KI-unterstützte Lese- und Entdeckungs-App für das iPhone.**  
> Mehr bedeutungsvolles Lesen, Verstehen und Behalten pro Minute Aufmerksamkeit.

Atem ersetzt reflexartiges Social-Media-Scrolling durch fokussiertes, anspruchsvolles und ästhetisch gestaltetes Lesen. Keine Endlos-Feeds, keine Clickbait-Mechanismen, keine Zwangs-Quizze — sondern eine persönliche intellektuelle Umgebung, die mit Ihren Interessen wächst.

---

## 📱 Schnellstart: Auf dem Mac & iPhone testen

### 1. Abhängigkeiten installieren
```bash
npm install
```

### 2. Im Web-Browser (Mac) starten
Für eine sofortige lokale Vorschau:
```bash
npm run web
```
Öffnet automatisch `http://localhost:8081`.

### 3. Auf dem physischen iPhone 15 Pro testen (Expo Go)
1. Installieren Sie **Expo Go** aus dem App Store auf Ihrem iPhone 15 Pro.
2. Starten Sie im Terminal auf Ihrem Mac:
   ```bash
   npx expo start
   ```
3. Öffnen Sie die **Kamera-App** auf Ihrem iPhone und scannen Sie den im Terminal angezeigten QR-Code (stellen Sie sicher, dass iPhone und Mac im selben WLAN sind, oder nutzen Sie `npx expo start --tunnel`).
4. Atem öffnet sich direkt nativ auf Ihrem iPhone.

### 4. Tests & Typüberprüfung
```bash
npm run typecheck
npm test
```

---

## 🌟 Kernfunktionen (Phase 1 MVP)

- **Fokussierte Tagesausgabe (Finite Daily Edition)**: Klare redaktionelle Auswahl statt Endlos-Feed, mit explizitem Abschluss-Banner gegen Doomscrolling.
- **Redaktionelle Vielfalt**: Unterschiedliche Layout-Typen (Titelstory, philosophische Gegenüberstellung, Deep Dive, Quick Insight, interdisziplinäre Verknüpfung).
- **Verifizierte Quellenherkunft**: Nachprüfbare Quellenangaben mit direkten Links, Autoren, Zeitstempeln und Validierungsstatus.
- **Transparente Relevanz**: Jedes Thema besitzt eine "Warum sehe ich das?"-Erklärung mit sichtbarer Gewichtung.
- **Fokussierter Reader**: Typografie nach Apple-HIG-Standards (anpassbare Schriftgröße, Hell-/Dunkelmodus, Lese-Fortschrittsbalken).
- **Interaktives Vertiefen**: Optionale Reflexionsimpulse ("Didaktische Anknüpfung", "Gegenposition & Kritik", "Philosophischer Kontext").
- **Lokale Bibliothek**: Gespeicherte Artikel bleiben persistent auf dem Gerät gesichert.
- **Transparente Interessensteuerung**: Schieberegler für Interessensgebiete (Philosophie, Didaktik, KI & Apple, Kontemplation, Wissenschaft) mit sofort beobachtbarer Neugewichtung des Feeds.

---

## 🏗 Architektur & Dokumentation

- [`AGENTS.md`](./AGENTS.md): Runbook für Antigravity-Agenten
- [`docs/PRODUCT.md`](./docs/PRODUCT.md): Produktspezifikation & Leitbild
- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md): Systemtopologie & Schichtenarchitektur
- [`docs/DECISIONS.md`](./docs/DECISIONS.md): Architektur-Entscheidungen (ADRs)
- [`docs/BACKLOG.md`](./docs/BACKLOG.md): Entwicklungs-Backlog
- [`docs/PROGRESS.md`](./docs/PROGRESS.md): Fortschritts- und Meilenstein-Log
- [`docs/QA.md`](./docs/QA.md): Testplan & Akzeptanzkriterien
