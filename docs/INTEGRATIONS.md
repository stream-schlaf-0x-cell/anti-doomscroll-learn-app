# Ecosystem & Content Integrations — Atem

## 1. Verifiziertes Quellen-Register (Phase 2 Live-Endpunkte)

Alle 10 Quellen wurden live getestet, liefern gültiges XML (RSS 2.0 bzw. Atom 1.0) und decken das Interessensprofil des Gründers ab:

| Quelle | Thema | Format | Endpunkt | Status / Geprüfte Ernte |
| :--- | :--- | :--- | :--- | :--- |
| **Daily Nous** | Philosophie / Ethik | RSS 2.0 | `https://dailynous.com/feed/` | Verifiziert (5 Artikel) |
| **Stanford Encyclopedia of Philosophy** | Philosophie / Ethik | RSS 2.0 | `https://plato.stanford.edu/rss/sep.xml` | Verifiziert (5 Artikel) |
| **Simon Willison’s Weblog** | KI & Software-Architektur | Atom 1.0 | `https://simonwillison.net/atom/everything/` | Verifiziert (5 Artikel) |
| **Hugging Face Blog** | Frontier AI / Open Source | RSS 2.0 | `https://huggingface.co/blog/feed.xml` | Verifiziert (5 Artikel) |
| **Deutsches Schulportal** | Fachdidaktik & Schule | RSS 2.0 | `https://deutsches-schulportal.de/feed/` | Verifiziert (5 Artikel) |
| **Lehrer-Online** | Pädagogik Sek. I | RSS 2.0 | `https://www.lehrer-online.de/rss.xml` | Verifiziert (5 Artikel) |
| **Lines (Monome / Modular)** | Klang & Synthese | RSS 2.0 | `https://llllllll.co/latest.rss` | Verifiziert (5 Artikel) |
| **Netzpolitik.org** | Digitale Gesellschaft / Recht | RSS 2.0 | `https://netzpolitik.org/feed/` | Verifiziert (5 Artikel) |
| **Quanta Magazine** | Wissenschaft & Mathematik | RSS 2.0 | `https://api.quantamagazine.org/feed/` | Verifiziert (5 Artikel) |
| **Tricycle / Buddhist Review** | Kontemplation & Geist | RSS 2.0 | `https://tricycle.org/feed/` | Verifiziert (5 Artikel) |

*Hinweis zu Reddit / r/singularity*: Reddit erfordert seit 2023 OAuth-Authentifizierung und blockiert unauthentifizierte RSS/JSON-Scraper (HTTP 403/429). Als Discovery-Inspiration für Beschleunigungsthemen dienen daher offene, qualitativ hochwertigere Tech-Weblogs (*Simon Willison*, *Hugging Face*). Ein nativer Reddit-OAuth-Adapter bleibt optional.

---

## 2. LLM-Modelle, Bepreisung & Budgetgrenze

### Offizielle Gemini Flash Bepreisung (Stand: Oktober 2026)
- **Modell**: `gemini-2.5-flash` / `gemini-3.8-flash`
- **Eingabe (Input)**: $0.10 pro 1.000.000 Tokens (~0,09 €)
- **Ausgabe (Output)**: $0.40 pro 1.000.000 Tokens (~0,37 €)

### Monatliche Verbrauchsrechnung (1 Nutzer, 10–15 Beiträge/Tag)
- Durchschnittliche Artikelgröße: ~800 Wörter (~1.000 Eingabe-Tokens).
- Generierter strukturierter `feedText`: ~150 Wörter (~200 Ausgabe-Tokens).
- Täglicher Verbrauch:
  - Input: 12 × 1.000 = 12.000 Tokens/Tag = 360.000 Tokens/Monat → ~$0.036
  - Output: 12 × 200 = 2.400 Tokens/Tag = 72.000 Tokens/Monat → ~$0.029
- **Erwartete monatliche Gesamtkosten: ~0,10 € bis 0,25 € / Monat**.

### Hartes Ausgabenlimit (`EnrichmentUsageLedger`)
- Konfigurierte Obergrenze: **5,00 € / Kalendermonat**.
- Der Ledger führt jeden Aufruf mit Timestamp, Input-/Output-Tokens und errechneten Kosten in persistentem Speicher.
- Wird das Limit erreicht, schaltet das System automatisch in den **Null-Kosten-Modus** (`SourceOnlyEnricher`), sodass der Dienst ohne Ausfallzeiten und ohne unerwartete Rechnungen weiterläuft.

---

## 3. Zukünftiger Hosting- & Automatisierungspfad (Phase 3)
- **Aktueller Stand**: Lokaler Ingestion-Runner (`npm run ingest`), speichert Snapshot in `pipeline-output.json`.
- **Zukünftiger gehosteter Pfad**:
  - Supabase Edge Functions (Deno/TypeScript) mit `pg_cron` für den täglichen Ingestionslauf um 05:00 Uhr UTC.
  - Supabase Database (PostgreSQL) zur Speicherung normalisierter Beiträge und Vektor-Embeddings.
  - Der mobile Client ruft einmal täglich das vorbereitete JSON-Paket über einen signierten CDN-Endpunkt ab.
  - **Sicherheitsregel**: Keine API-Keys im Client-Bundle; alle LLM-Aufrufe verbleiben serverseitig.
