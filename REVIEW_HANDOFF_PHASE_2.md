# Review Handoff — Phase 2: A Real, Personalized Discovery Feed

**Repository**: Atem (Anti-Doomscroll Learn App)  
**Branch**: `feature/phase-2-researched-feed`  
**Date**: 15. Oktober 2026  
**Environment**: Google Antigravity / Gemini 3.8 Flash  
**Target Viewport**: iPhone 15 Pro (393 × 852 pt @ 3x) & Desktop Reddit Layout (>= 960 px)

---

## 1. Executive Summary & Verification Evidence

Phase 2 transforms Atem from an illustrative prototype into a **real, personalized, content-rich discovery feed** powered by automated ingestion and structured enrichment under a strict €5.00/month operating budget ceiling.

All acceptance criteria have been implemented, tested, and validated:

| Verification Gate | Command | Result |
| :--- | :--- | :--- |
| **Typecheck** | `npm run typecheck` (`tsc --noEmit`) | **0 Errors** (Clean) |
| **Linting** | `npm run lint` (`expo lint`) | **0 Warnings / 0 Errors** |
| **Unit Test Suite** | `npm test` (`tsx --test tests/**/*.test.ts`) | **91 / 91 Tests Passing** (16 Suites, 3.5s) |
| **Production Web Export** | `npx expo export -p web` | **100% Succeeded** (`dist/` bundle) |
| **Live Ingestion Pipeline** | `npm run ingest` (`scripts/run-pipeline.ts`) | **94 Real Items** from 22 Live Endpoints |
| **AI Transparency** | Visual in FeedCard & Reader | **🤖 Explicit Sparring Banners** (0 fake humans) |

---

## 2. Key Architectural Deliverables

### Stage 1: Domain Schemas & Invariant Hardening
- Added `feedText`: full standalone substantive reading for direct in-card consumption.
- Added `format` (`FeedItemFormatSchema`): 7 distinct editorial archetypes (`concise_insight`, `sourced_update`, `creative_idea`, `intriguing_question`, `surprising_connection`, `perspective_disagreement`, `long_invitation`).
- Added `evidenceTier` (`EvidenceTierSchema`): transparent provenance tracking (`metadata_only`, `publisher_excerpt`, `permitted_full_text`, `multiple_sources`).
- Added `PersonalGoal` (`PersonalGoalSchema`): 5 founder goals with German metadata mapping (`understand_tech`, `creative_music`, `deepen_attention`, `philosophical_clarity`, `society_and_ethics`).
- Added `PerspectiveDetails` (`PerspectiveDetailsSchema`): explicit claims, counter-positions, and uncertainty notes for philosophical discourse.

### Stage 2: Storage Safeguards & Decoupled Library Persistence
- Fixed data corruption hazard in `userProfileRepository.ts` and `libraryRepository.ts`: both repositories now throw `CorruptedDataError` instead of destructively clobbering stored bytes when schema validation fails.
- Decoupled Library Persistence: full articles are stored offline under `@atem:saved_articles:v1` via `saveArticle()` and `unsaveArticle()`, preserving saved content even if feed rotation flushes older items.
- Added storage generation token (`storageGenerationRef`) in `AppContext.tsx` so debounced reading progress writes cannot resurrect wiped state after a user data reset.

### Stage 3: Live RSS/Atom Ingestion Pipeline
- Verified 22 live public RSS/Atom endpoints across German public broadcasting (ARD Tagesschau Wissen & Inland, ZDFheute, Deutschlandfunk), science (Quanta, Spektrum, Gehirn & Geist), tech/AI (arXiv HTTPS query API, heise, Simon Willison), culture (Aeon, Perlentaucher), education (BPB, Bildungsserver), and synthesizer music (Synthtopia, lines).
- Built pure TypeScript parser (`rssParser.ts`) supporting RSS 2.0 and Atom 1.0 with robust HTML entity decoding (including German umlauts and typographic quotes).
- Built normalizer (`normalizer.ts`) and deduplicator (`deduplicator.ts`) generating SHA-256 content hashes and canonical URLs.
- Created `scripts/run-pipeline.ts` (`npm run ingest`), which successfully collected, deduplicated, and validated **94 real articles** into `src/core/data/pipeline-output.json`.

### Stage 4: Provider-Independent Enrichment & €5 Budget Enforcement
- Grounded token pricing in official Gemini Flash API documentation ($0.10/1M input, $0.40/1M output).
- Implemented `EnrichmentUsageLedger`: accumulates monthly spend and strictly halts LLM calls if monthly cost approaches €5.00.
- Implemented `EnrichmentCache`: caches enrichments keyed by `contentHash + promptVersion` to eliminate redundant spending.
- Implemented `SourceOnlyEnricher`: zero-cost local fallback mode extracting coherent standalone `feedText` from raw source feeds without external API calls.

### Stage 5: Explainable Multi-Dimensional Personalization Engine
- Multi-factor scoring in `src/core/domain/ranking.ts`:
  1. Primary and secondary topic affinity (0.0 to 1.0).
  2. Personal goal alignment via `TOPIC_GOAL_MAP`.
  3. Reading duration matching (compact, balanced, deep).
  4. Explicit feedback memory (`boostedAuthors`, `penalizedAuthors`, `boostedTopics`, `penalizedTopics`).
  5. Soft editorial quotas: ~10% didactics/teaching items and ~10% challenging/counter-perspectives in the primary batch.
  6. Transparent breakdown ("Warum sehe ich das?") explaining why an item was ranked.

### Stage 6: Rich Standalone Feed UI & "Weiter entdecken" Batching
- Replaced title-heavy presentation with substantive standalone `feedText` in `FeedCard.tsx`.
- Progressive disclosure: taps on badges reveal evidence tier details, format definitions, and relevance explanations without opening the reader.
- "Weiter entdecken": deterministic batching appends subsequent batches to the feed without jumping scroll position or repeating stories.
- Two-tier reading: concise items are complete in-feed; deep dives offer seamless transition to the distraction-free reader.

### Stage 7: Sovereign Mindspace & AI Dialectic Sparring
- **Dedicated Reddit Desktop UI**: Responsive two-column view (`>= 960px`) with `DesktopRedditHeader` and sticky `DesktopSidebar`.
- **Honest AI Sparring**: Discussion section features prominent 🤖 transparency banner (`🤖 Transparente KI-Dialektik: Sokratische Reibung & didaktische Gegenpositionen`) and badges (`⚡️ Dialektik`, `🏫 Didaktik`, `☍ Synthese`). No fake human personas.
- **Data Sovereignty & Craft Docs Exporter**: Complete markdown export for Craft Docs, Obsidian, and Bear with one click.
- **Foundational Canon & Music Recommendation**: Independent canon offline archive and curated sound/focus tracks grounded with iTunes/Spotify metadata.
