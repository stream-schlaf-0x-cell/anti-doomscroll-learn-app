# Review Handoff — Phase 2: A Real, Personalized Discovery Feed

**Repository**: Atem (Anti-Doomscroll Learn App)  
**Branch**: `feature/phase-2-discovery-pipeline`  
**Date**: 14. Oktober 2026  
**Environment**: Google Antigravity / Gemini 3.8 Flash  
**Target Viewport**: iPhone 15 Pro (393 × 852 pt @ 3x)  

---

## 1. Executive Summary & Verification Evidence

Phase 2 transforms Atem from an illustrative prototype into a **real, personalized, content-rich discovery feed** powered by automated ingestion and structured enrichment under a strict €5.00/month operating budget ceiling.

All acceptance criteria have been implemented, tested, and validated:

| Verification Gate | Command | Result |
| :--- | :--- | :--- |
| **Typecheck** | `npm run typecheck` (`tsc --noEmit`) | **0 Errors** (Clean) |
| **Linting** | `npm run lint` (`expo lint`) | **0 Warnings / 0 Errors** |
| **Unit Test Suite** | `npm test` (`tsx --test tests/**/*.test.ts`) | **48 / 48 Tests Passing** (6 Suites, 1.2s) |
| **Expo Diagnostics** | `npx expo-doctor@latest` | **18 / 18 Checks Passed** |
| **Production Web Export** | `npx expo export -p web` | **100% Succeeded** (`dist/` bundle) |
| **Headless UI Capture** | Chrome CDP (iPhone 15 Pro: 393 × 852 px) | **8 Artifacts Captured** (`docs/screenshots/`) |
| **Review Archive** | `zip -r atem-phase-2-review.zip` | Generated in brain artifact storage |

---

## 2. Key Architectural Deliverables

### Stage 1: Domain Schemas & Invariant Hardening (Commit `61a3e76`)
- Added `feedText`: full standalone substantive reading for in-card consumption.
- Added `format` (`FeedItemFormatSchema`): 7 distinct editorial archetypes (`concise_insight`, `sourced_update`, `creative_idea`, `intriguing_question`, `surprising_connection`, `perspective_disagreement`, `long_invitation`).
- Added `evidenceTier` (`EvidenceTierSchema`): transparent provenance tracking (`metadata_only`, `publisher_excerpt`, `permitted_full_text`, `multiple_sources`).
- Added `PersonalGoal` (`PersonalGoalSchema`): 5 founder goals with German metadata mapping (`understand_tech`, `creative_music`, `deepen_attention`, `philosophical_clarity`, `society_and_ethics`).
- Added `PerspectiveDetails` (`PerspectiveDetailsSchema`): explicit claims, counter-positions, and uncertainty notes for philosophical discourse.

### Stage 2: Storage Safeguards & Decoupled Library Persistence (Commit `158079b`)
- Fixed data corruption hazard in `userProfileRepository.ts` and `libraryRepository.ts`: both repositories now throw `CorruptedDataError` instead of destructively clobbering stored bytes when schema validation fails.
- Decoupled Library Persistence: full articles are stored offline under `@atem:saved_articles:v1` via `saveArticle()` and `unsaveArticle()`, preserving saved content even if feed rotation flushes older items.
- Added storage generation token (`storageGenerationRef`) in `AppContext.tsx` so debounced reading progress writes cannot resurrect wiped state after a user data reset.

### Stage 3: Live RSS/Atom Ingestion Pipeline (Commit `2de9819`)
- Verified 10 live public RSS/Atom endpoints across philosophy, AI, didactics, modular music, and science (e.g. *Daily Nous*, *Stanford Encyclopedia of Philosophy*, *Simon Willison's Weblog*, *Hugging Face Blog*, *Deutsches Schulportal*, *Lines Modular Synthesis*, *Netzpolitik.org*, *Quanta Magazine*).
- Built pure TypeScript parser (`rssParser.ts`) supporting RSS 2.0 and Atom 1.0 with robust HTML entity decoding (including German umlauts and typographic quotes).
- Built normalizer (`normalizer.ts`) and deduplicator (`deduplicator.ts`) generating SHA-256 content hashes and canonical URLs.
- Created `scripts/run-pipeline.ts` (`npm run ingest`), which successfully collected and validated **36 real articles** into `src/core/data/pipeline-output.json`.

### Stage 4: Provider-Independent Enrichment & €5 Budget Enforcement (Commit `a80dc81`)
- Grounded token pricing in official Gemini Flash API documentation ($0.10/1M input, $0.40/1M output).
- Implemented `EnrichmentUsageLedger`: accumulates monthly spend and strictly halts LLM calls if monthly cost approaches €5.00.
- Implemented `EnrichmentCache`: caches enrichments keyed by `contentHash + promptVersion` to eliminate redundant spending.
- Implemented `SourceOnlyEnricher`: zero-cost local fallback mode extracting coherent standalone `feedText` from raw source feeds without external API calls.

### Stage 5: Explainable Multi-Dimensional Personalization Engine (Commit `0fccdd7`)
- Multi-factor scoring in `src/core/domain/ranking.ts`:
  1. Primary and secondary topic affinity (0.0 to 1.0).
  2. Personal goal alignment via `TOPIC_GOAL_MAP`.
  3. Reading duration matching (compact, balanced, deep).
  4. Explicit feedback memory (`boostedAuthors`, `penalizedAuthors`, `boostedTopics`, `penalizedTopics`).
  5. Decaying behavioral signals (opened, saved, completed).
- Editorial Quota Guarantees: primary edition guarantees ~10% teaching-related items and ~10% challenging philosophical perspectives through quota-aware batch elevation.
- Transparent explainability: `getExplanationBreakdown()` returns a full percentage decomposition for the "Warum sehe ich das?" modal.

### Stage 6: Rich Standalone Feed UI & Deterministic Batching (Commit `0051b71`)
- `FeedCard.tsx`:
  - Renders substantial standalone `feedText` directly in the card body (5–7 lines of rich substance, no clickbait snippets).
  - Displays format badges (`⚡︎ Kompaktimpuls`, `◈ Recherche & Update`, `✦ Philosophische Gegenposition`, etc.).
  - Displays evidence tier indicators (`Volltext verfügbar`, `Quellensynthese`, `Herausgeber-Auszug`, `Quellnotiz`).
  - Displays specialized quota badges (`Didaktik-Bezug`, `Gegenposition`).
  - Progressively exposes "Im Lesemodus vertiefen →" only when extended long-form text exists.
  - In-feed feedback pills (thumbs up / thumbs down) for instant ranking adaptation.
- `FeedScreen.tsx`:
  - Enforces a finite primary daily edition of 10–12 items.
  - End of edition pause banner with clear, anti-doomscroll stopping point.
  - "Weiter entdecken (+10 Beiträge)" smoothly appends discovery items without re-shuffling or repeating cards, preserving exact scroll position.

---

## 3. Test Suite Breakdown (48 Passing Tests)

```
▶ Domain Schemas & Invariant Validation (6 tests)
  ✔ validates all fixtures against FeedItemSchema
  ✔ validates default user profile against UserProfileSchema
  ✔ rejects invalid reading interaction schema data
  ✔ verifies reading lengths vary appropriately
  ✔ verifies fixtures contain standalone feedText and Phase 2 metadata
  ✔ validates PersonalGoal schema and German metadata mapping

▶ Deterministic Ranking Engine (9 tests)
  ✔ assigns higher score to matching top user interests
  ✔ boosts items matching reading duration preference
  ✔ produces observable ranking differences between quick and deep preferences
  ✔ adjusts scores based on explicit feedback
  ✔ interleaves topics to avoid clumping
  ✔ produces transparent German explanation breakdown
  ✔ adjusts scores based on explicit personal goals alignment
  ✔ adjusts scores based on feedback memory for authors and topics
  ✔ enforces soft editorial quota for teaching items and challenging perspectives

▶ Provider-Independent Enrichment & €5 Budget Enforcement (8 tests)
  ✔ calculates token costs accurately using grounded Gemini Flash pricing
  ✔ records calls and accumulates monthly totals in memory
  ✔ enforces hard monthly ceiling (€5.00) and blocks further spend
  ✔ caches results keyed by contentHash + promptVersion
  ✔ SourceOnlyEnricher operates at zero cost and synthesizes German standalone reading
  ✔ ProviderEnricher uses active model when budget allows
  ✔ ProviderEnricher serves cached results without re-spending budget
  ✔ ProviderEnricher automatically falls back to SourceOnlyEnricher when budget exceeded

▶ Storage Mutex & Persistence Architecture (12 tests)
  ✔ profile save settles and invokes persistent driver
  ✔ save, unsave, progress, feedback, reset settle without deadlock
  ✔ concurrent updates to different articles preserve both changes
  ✔ progress and bookmark updates on same article preserve both fields
  ✔ failed operation releases lock and later operations succeed
  ✔ new repository instance reads committed data
  ✔ older asynchronous work cannot overwrite newer user choices
  ✔ distinguishes missing vs corrupt data and throws CorruptedDataError
  ✔ updateProfile and mutateInteraction reject on corrupt stored bytes
  ✔ saveArticle persists full article entity offline decoupled from feed rotation
  ✔ unsaveArticle unmarks bookmark and removes full article from storage
  ✔ clearLibrary wipes both interaction state and saved full articles

▶ Content Ingestion Pipeline: Parser, Normalizer & Deduplication (8 tests)
  ✔ parses standard RSS 2.0 XML correctly
  ✔ parses Atom 1.0 XML correctly
  ✔ safely strips HTML tags and decodes entities
  ✔ canonicalizes URLs by stripping tracking query parameters
  ✔ generates deterministic SHA-256 content hashes
  ✔ normalizes RawFeedEntry into schema-valid FeedItem
  ✔ deduplicates feed items by canonical URL, hash and title
  ✔ handles empty or malformed XML gracefully without throwing

▶ Feed Batching & Discovery Partitioning Invariants (5 tests)
  ✔ returns at most 12 items for daily edition
  ✔ guarantees zero ID overlap between daily edition and discovery pool
  ✔ retains all non-daily items in discovery pool without losing stories
  ✔ correctly maps all Phase 2 EvidenceTier values to German UI descriptions
  ✔ correctly maps all Phase 2 FeedItemFormat values to editorial labels
```

---

## 4. UI Screenshots (iPhone 15 Pro Dimensions: 393 × 852 px)

Captured with Headless Chrome via Chrome DevTools Protocol and stored in `docs/screenshots/`:

1. `01-onboarding.png`: Initial setup screen with German founder topics.
2. `02-feed-hero.png`: Daily edition hero card displaying standalone substantive `feedText`, format badge (`✦ Philosophische Gegenposition`), evidence tier (`Herausgeber-Auszug`), quota badge (`⇄ Gegenposition`), and "Im Lesemodus vertiefen (679 Wörter →)".
3. `03-why-modal.png`: "Warum sehe ich das?" modal with deterministic score breakdown (77% Relevanz, 94% Themen-Affinität, Lesezeit-Passung).
4. `04-feed-finite-edition.png`: Finite daily edition completion banner ("Ende dieser Ausgabe") with deliberate pause and "Weiter entdecken (+10 von 33 Beiträgen)".
5. `05-feed-weiter-entdecken.png`: Appended discovery items loaded seamlessly without shifting previous cards.
6. `06-reader-view.png`: Reader overlay showing full text, typography controls, publication source, and honest provenance.
7. `07-library-decoupled.png`: Offline decoupled Library holding saved articles.
8. `08-settings-goals-budget.png`: Settings screen with interactive priority sliders for founder topics and duration preferences.

---

## 5. Cost & Operating Model Summary

- **Gemini 1.5/2.5/3.8 Flash Pricing**:
  - Input: $0.10 / 1,000,000 tokens (~€0.09)
  - Output: $0.40 / 1,000,000 tokens (~€0.37)
- **Daily Operating Cost**:
  - 10 articles/day × ~1,200 tokens/article = ~12,000 tokens/day (~360,000 tokens/month).
  - Monthly cost: **~€0.12 - €0.25 / month** (well within the €5.00 ceiling).
- **Safety Ceiling**:
  - `EnrichmentUsageLedger` blocks calls once €5.00 is reached in a calendar month.
  - Automatic fallback to `SourceOnlyEnricher` guarantees continuous, zero-cost operation.
