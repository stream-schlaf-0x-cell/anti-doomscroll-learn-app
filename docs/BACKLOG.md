# Product & Engineering Backlog — Atem

## Phase 0: Foundation & Environment (Completed)
- [x] Host reconnaissance (macOS 13.7.8 Ventura, Intel x86_64, Node 24.13.0, npm 11.6.2).
- [x] Select stable framework: React Native with Expo SDK 57 + TypeScript + strict mode.
- [x] Identify iOS build constraints (no local modern Xcode; prioritize Expo Go + Web preview).
- [x] Draft Architecture Decision Records (`docs/DECISIONS.md`).
- [x] Define Domain Schemas with Zod validation.

## Phase 1: Functional Vertical Slice (Current)
- [x] Install runtime dependencies (`@react-native-async-storage/async-storage`, `react-native-safe-area-context`, `@expo/vector-icons`, `zod`).
- [ ] Implement domain models and Zod schemas (`src/core/domain/`).
- [ ] Implement deterministic feed ranking algorithm (`src/core/domain/ranking.ts`).
- [ ] Create rich, grounded German-first editorial demonstration content across Philosophy, Ethics, AI, Education, and Science (`src/core/data/fixtures.ts`).
- [ ] Implement repository interfaces and local persistence (`src/core/data/`).
- [ ] Build design tokens and editorial typography system (`src/ui/theme.ts`).
- [ ] Implement Main Navigation / Tab Shell (Feed, Bibliothek, Einstellungen).
- [ ] Implement Onboarding flow with topic selection and reading preference setup.
- [ ] Implement Editorial Feed Screen:
  - Hero featured cards, Perspective cards, Deep Dive cards, Quick Insights.
  - "Tagesausgabe" finite edition completion banner.
  - "Warum sehe ich das?" (Relevance explanation modal).
  - Quick save/bookmark with persistent state.
  - Filter / Category switcher.
- [ ] Implement Article Reader Screen:
  - Editorial reading layout, adjustable font size, light/dark mode.
  - Source provenance attribution & external links.
  - Deepening actions ("Gegenposition", "Didaktik im Unterricht", "Philosophischer Kontext").
  - Reading progress indicator.
- [ ] Implement Saved Library Screen:
  - Filter by topic tag / status.
  - Reopen and continue reading.
  - Remove from saved.
- [ ] Implement Settings & Preferences Screen:
  - Topic weights sliders (observable feed re-ranking).
  - Reading length preferences.
  - Language toggle.
  - Clear data & transparency info.
- [ ] Unit tests for ranking algorithm and Zod schema validation.
- [ ] Verification on Web and Expo Go.

## Phase 2: Live Content & Ingestion Pipeline
- [ ] RSS / Atom feed adapters (e.g. PhilPapers, Stanford Encyclopedia updates, Heise/Golem, Die Zeit/Spiegel Wissenschaft, Deutsches Schulportal).
- [ ] Normalization, deduplication, and topic categorization.
- [ ] Offline caching and background refresh.

## Phase 3: AI Enrichment (Server-Side)
- [ ] Provider-agnostic AI interface (Gemini & OpenAI).
- [ ] German-language editorial synthesis and structured claim extraction.
- [ ] Interactive deepening generation ("Gegenargument formulieren", "Unterrichtsbezug herstellen").
- [ ] Caching, rate limiting, and cost monitoring.

## Phase 4: Dynamic Personalization
- [ ] Implicit reading signal weighting (dwell time without clickbait, completed reads).
- [ ] Topic feedback loops ("Mehr zu diesem Aspekt", "Thema pausieren").
- [ ] Cross-disciplinary connection synthesis.

## Phase 5: Knowledge Integrations
- [ ] Read-only Craft document connector (authorized project sync).
- [ ] Read-only Raindrop.io bookmark connector.
- [ ] User-controlled privacy boundaries and data deletion.

## Phase 6: Apple Ecosystem & Native Enhancements
- [ ] Home Screen widgets (Daily Reflection / Insight of the Day).
- [ ] Apple Shortcuts & App Intents.
- [ ] Share extension (Send article to Atem).
- [ ] Dynamic Type and VoiceOver accessibility auditing.
