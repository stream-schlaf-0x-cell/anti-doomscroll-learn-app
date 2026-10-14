# Phase 2 Engineering Checkpoint — Atem

**Milestone**: Phase 2 — A real, personalized discovery feed with researched content and controlled operating costs  
**Active Branch**: `feature/phase-2-discovery-pipeline`  
**Date**: 14. Oktober 2026  
**Status**: Stage 1 In Progress  

---

## 1. Objectives & Scope
1. **Rich In-Feed Reading**: Distinct `feedText` (complete standalone substance in card) vs optional `articleBody` (expanded long-form reader).
2. **Real Content Pipeline**: Automated flow outside UI: `collect → normalize → deduplicate → assess relevance → prepare content → validate → persist → deliver`. 6–10 verified live public RSS/Atom endpoints.
3. **Provider-Independent Enrichment & €5 Ceiling**: `IContentEnricher` with structured Zod output, persistent usage ledger, caching by content hash, and source-only zero-cost fallback mode.
4. **Multi-Dimensional Personalization**: Starter data matching founder profile (AI acceleration, creative music, philosophy, teaching ~10%, challenging perspectives ~10%, personal goals, explicit feedback memory, decaying behavioral signals).
5. **Decoupled Saved Library & Storage Safeguards**: Saved items persist full content offline independent of feed rotation. Fix mutation fallback bugs in `updateProfile` and `mutateInteraction`.
6. **Deterministic Batching & "Weiter entdecken"**: 10–12 items per batch, appending without shifting or repeating, stable scroll position.
7. **Verification & Evidence**: 10+ new unit tests, strict typecheck, lint, expo-doctor, clean `npm ci`, production web export, and headless Chrome UI verification at iPhone 15 Pro dimensions.

---

## 2. Stage Breakdown & Execution Status

- [x] **Stage 1**: Domain Schemas & Invariant Hardening (`feedText`, `format`, `evidenceTier`, `PersonalGoal`, founder starter profile).
- [x] **Stage 2**: Storage Safeguards & Decoupled Library Persistence (bug fixes for data protection, offline library retention).
- [x] **Stage 3**: Live Endpoint Discovery & Ingestion Pipeline (verified RSS/Atom feeds, normalization, deduplication, CLI runner).
- [x] **Stage 4**: Provider-Independent Enrichment & €5 Budget Ledger (usage tracker, caching, Gemini pricing model grounding).
- [ ] **Stage 5**: Explainable Multi-Dimensional Personalization Engine (goals, feedback memory, 10% targets, explanation generation).
- [ ] **Stage 6**: Rich Standalone Feed UI & "Weiter entdecken" Batching (interactive cards, progressive disclosure, virtualization).
- [ ] **Stage 7**: Full Test Suite, Clean Verification, Screenshots & Review Archive.

---

## 3. Current Stage
**Stage 5: Explainable Multi-Dimensional Personalization Engine**
- *Goal*:
  1. Upgrade `src/core/domain/ranking.ts` to compute multidimensional affinity:
     - Topic affinity from `explicitInterests` (weights 0.0 - 1.0)
     - Personal goal affinity from `explicitGoals` (aligned goals)
     - Duration preference match (`all`, `quick`, `balanced`, `deep`)
     - Feedback memory boosts/penalties: `feedbackMemory.boostedTopics`, `penalizedTopics`, `boostedAuthors`, `penalizedAuthors`
     - Behavioral signal decay: slight penalty for already-opened unread items to encourage fresh discoveries
  2. Soft editorial quota enforcement during batch selection:
     - Guarantee ~10% teaching-related items (`isTeachingRelated` or `german_didactics`)
     - Guarantee ~10% challenging perspectives (`isChallengingPerspective` or `perspective_disagreement`)
  3. Transparent German explanation generation (`relevanceExplanation` and detailed breakdown) so every card tells the user exactly why it appears.
- *Validation*: Extend `tests/domain.test.ts` with ranking regression tests for goal alignment, feedback memory, editorial quota guarantees, and explanation transparency.
