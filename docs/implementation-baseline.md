# ATMEN — Implementation Baseline & Repository Audit
**Date:** 2026-10-18  
**Environment:** macOS (Darwin arm64), Node.js v24.13.0, npm 11.2.0, Expo SDK 54.0.37, React Native 0.81.5, React 19.1.0  
**Repository:** Atmen (`anti doomscroll learn app`), Branch `main`

---

## 1. Executive Summary

This baseline document records empirical measurements and architectural findings prior to the implementation of the Master Implementation Directive.

All 186 existing tests pass, TypeScript compilation passes without errors, and Expo linting succeeds. However, key architectural bottlenecks directly impact cold start, bundle weight, main-thread blocking, and AI feedback clarity:

1. **Static Inlining of Article Archive in JS Bundle:** `src/core/data/pipeline-output.json` (1.8 MB JSON) was statically `require()`'d at the module level in `feedRepository.ts`, inflating the uncompressed web JS bundle to **4.61 MB** (1.11 MB gzipped).
2. **Quadratic Startup Computation on Main Thread:** On instantiation of `LocalFeedRepository`, every item was synchronously passed through `enrichSocialFeedItem` -> `enrichItemWithInstantResearch` -> `findRelatedNetworkPosts`, which executed nested loops over the pool without an inverted index.
3. **Absence of Unified Ingestion Contracts & Operation Telemetry:** Live curation in `feedRepository.curateAndAddItems` simply appended items into storage and ran global ranking. Newly curated articles were not top-pinned, resulting in them disappearing into lower ranks. There was no structured operation contract (`FeedOperationResult`) returning inserted, updated, duplicate, or rejected counts.
4. **Direct Browser API Key Usage:** AI requests in `atmenAiClient.ts` hit Google Generative Language REST endpoints directly from the client using keys stored in `appStorage` (`localStorage` on web), exposing them in network tabs and client state.

---

## 2. Empirical Baseline Metrics

### 2.1 Test Suite & Verification Commands
- **Typecheck:** `npm run typecheck` (`tsc --noEmit`)
  - Status: PASS (0 errors, exit code 0)
- **Lint:** `npm run lint` (`expo lint`)
  - Status: PASS (0 errors, exit code 0)
- **Test Suite:** `npm test` (`node --import tsx --test tests/*.test.ts`)
  - Total Tests: **186**
  - Suites: **37**
  - Passed: **186**
  - Failed: **0**
  - Skipped: **0**
  - Duration: **11,074 ms** (~11.1 s)

### 2.2 Web Bundle Size & Assets (`npx expo export -c -p web`)
- **Main Web JS Bundle:** `_expo/static/js/web/index-89544ca7add45a993920d30b5492e413.js`
  - Uncompressed: **4.61 MB** (4,613,446 bytes)
  - Gzipped: **1.11 MB** (1,113,984 bytes)
- **Asset Weight:** 20 assets including Vector Icon fonts (`Ionicons.ttf` 390 kB, `MaterialCommunityIcons.ttf` 1.31 MB, `FontAwesome6_Solid.ttf` 424 kB) and icon images (`android-icon-foreground.png` 78.8 kB, `icon.png` 393 kB).
- **Total `dist/` directory:** **10.0 MB**

### 2.3 Data Payload & Memory Footprint
- `src/core/data/pipeline-output.json`: **1.8 MB** (210 full-body articles with editorial abstracts, dialectics, and source references).
- `public/feed-snapshot.json`: **1.8 MB** (snapshot containing the same 210 articles plus source health metadata).
- `src/core/data/realKnowledgeVault.ts`: **21** curated timeless classics.
- `src/core/data/fixtures.ts`: **9** initial bootstrap fixtures.
- `src/core/ingestion/sources.ts`: **655** verified DE & EN feed sources across 12 knowledge categories.

---

## 3. Discovered Architectural Problems & Bottlenecks

### Problem 1: Blocking Archive Inlining
- **Cause:** `src/core/data/feedRepository.ts` line 12:
  ```ts
  const loaded = require('./pipeline-output.json');
  ```
  Metro bundler statically traces this import and includes all 1.8 MB of JSON directly in the single JavaScript output bundle.
- **Impact:** Slow mobile downloads, excessive memory consumption on mobile WebKit/V8, and delayed page execution.

### Problem 2: Synchronous O(N²) Relationship Comparisons at Boot
- **Cause:** `LocalFeedRepository` constructor iterated through all pipeline items, knowledge vault items, and fixtures, calling `enrichSocialFeedItem`. This called `findRelatedNetworkPosts(item)`, which looped through all items in the pool:
  ```ts
  for (const candidate of pool) {
    // string tokenization, regex splitting, stopword filtering, score calculation
  }
  ```
- **Impact:** 240 items × 240 items = 57,600 cross-evaluations during initial bundle execution before `App.tsx` can complete its first useful frame.

### Problem 3: Missing Ingestion Contract & Invisible Curation Results
- **Cause:** `curateAndAddItems(items)` in `feedRepository.ts` did not track:
  - Candidates evaluated vs rejected.
  - Duplicates detected.
  - Truly new vs updated items.
  - Pinned state for user-initiated additions.
- **Impact:** When a user initiated AI curation, items were swallowed into the global score rank, often placed deep in the feed. The user saw a generic toast without knowing which items were added or why.

### Problem 4: Security of AI Credentials
- **Cause:** `atmenAiClient.ts` stored user-entered Gemini / OpenRouter API keys in `appStorage` (AsyncStorage on native, `localStorage` on web) and made direct `fetch()` calls to `https://generativelanguage.googleapis.com/v1beta/models/...:generateContent?key=${apiKey}`.
- **Impact:** While no hardcoded keys exist in source control, client-side API keys are exposed to client-side inspection. A serverless / secure proxy boundary is required for production deployments, while maintaining clean BYOK and graceful non-AI degradation.

---

## 4. Remediation Architecture & Target Milestones

| Stage | Focus | Target Outcome |
|---|---|---|
| **Phase 1** | Startup & Data Layer | Decouple heavy JSON from initial bundle; lightweight bootstrap store; lazy snapshot hydration; inverted index for relationships ($O(1)$/$O(K)$). |
| **Phase 2** | Visual Identity | Consistent `AtmenLogo` & `AtmenSymbol` across desktop, mobile, and reader; dark/light theme tokens. |
| **Phase 3** | Living Feed Engine | Unified `FeedOperationResult` contract; idempotent merges; top-pinning of newly curated items; real-time progress steps; inspectable reports. |
| **Phase 4** | Sources & Diversity | Source registry health; diversity-aware reranking; publisher clumping prevention; serendipity discovery. |
| **Phase 5** | Sparse AI & Cache | Content-addressable `EnrichmentCache`; sparse candidate payloads; model registry with current Gemini models; strict Zod schemas. |
| **Phase 6** | Secure Hybrid AI | Serverless proxy boundary (`/api/ai/*`); BYOK handling; graceful offline & non-AI fallbacks. |
| **Phase 7** | Reading & Diagnostics| Atmen Studio 3 lenses; Hivemind generator; explainable "Warum sehe ich das?"; developer diagnostics panel. |
| **Phase 8** | Release Gates | Typecheck, lint, all test suites passing, web export validation, and clean commit. |
