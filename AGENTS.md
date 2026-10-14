# AGENTS.md — Antigravity Agent Guidelines & Runbook

## Project: Atem — The AI-Native Antidote to Doomscrolling
**Platform**: iPhone-first (Expo / React Native / TypeScript)  
**Target Device**: iPhone 15 Pro, iOS 17/18  
**Local Host**: Intel MacBook Pro (2014), macOS Ventura 13.7.8 x86_64, Node v24.13.0, npm 11.6.2  
**Date**: October 2026

---

## 1. Context & North Star
Atem is a personalized, AI-powered reading and discovery feed designed to replace reflexive, dopamine-seeking social media scrolling with deep, intellectually stimulating, and aesthetically pleasing reading.
- **Reading is primary**: Clean editorial typography, clear hierarchies, no video feeds, no compulsory flashcards/quizzes.
- **Audience**: Philosophy/Ethics and German teacher in Dresden, Germany. Interested in epistemology, ethics, Buddhism/contemplation, AI, Apple, science, education policy, electronic music, and creative thought.
- **Content Dimensions**:
  1. Current Affairs & News (grounded, factual provenance, European/German & global)
  2. Intellectual Discovery (philosophy, psychology, science, contemplative thought)
  3. Professional Knowledge (teaching German & Ethics, pedagogical research, didactic ideas)
  4. Personal Context & Ongoing Interests (future Craft & Raindrop integrations, explicitly followed topics)

---

## 2. Technical Commandments
1. **Strict TypeScript**: No loose `any`, runtime-validated schemas via Zod for all feed items and user profiles.
2. **Local-First & Offline**: Local SQLite / AsyncStorage repository pattern so the app works immediately with zero network or missing credentials.
3. **No Secret Keys in Client**: All LLM / Supabase secrets belong server-side. The app uses realistic local demonstration fixtures by default and mock adapters when offline.
4. **Editorial Design**: Apple-quality typography, dynamic sizing, light/dark themes, comfortable line length and line height, reading time indicators, source citations.
5. **Transparency**: Explicit "Why am I seeing this?", clear distinction between verified reporting, scientific analysis, and editorial perspectives.

---

## 3. Environment & Running Instructions
Because the local machine is an Intel MacBook Pro on macOS Ventura without a modern local Xcode 15/16 toolchain:
- **SDK Target**: Expo SDK 54 (React Native 0.76.7, React 18.3.1), aligned specifically to enable no-paid-account preview on physical iPhone 15 Pro via the App Store Expo Go app (which supports up to SDK 54).
- **Web Preview**: `npx expo start --web` (or `npm run web`, serving at `http://localhost:8081` with URL deep-linking `?article=<id>`).
- **Physical iPhone Preview**: `npx expo start` -> Scan QR code with the Expo Go app on iPhone 15 Pro (same Wi-Fi or tunnel). Physical device testing is labeled as "unverified" until directly observed on the physical phone.
- **Reproducible Installation**: `npm ci` (lockfile verified and synchronized).
- **Type Check**: `npm run typecheck` (`tsc --noEmit`, 0 errors).
- **Lint**: `npm run lint` (`expo lint`, 0 warnings/errors).
- **Test Suite**: `npm test` (`tsx --test tests/**/*.test.ts`, 18 tests passing).
- **Health Check**: `npx expo-doctor@latest` (18/18 checks pass).

---

## 4. Current Phase Roadmap
- **Phase 0**: Reconnaissance & Architecture Decision Record (Completed).
- **Phase 1.0**: Initial UI Mockup (Completed).
- **Phase 1.1**: Expo SDK 54 Downgrade & Alignment (Completed).
- **Phase 1.2**: Reliable Persistence, Deadlock Elimination & Demonstrated Reading Experience (Completed).
- **Phase 2**: Live Ingestion Pipeline (RSS, ArXiv, Curated feeds) (Upcoming Next Slice).
- **Phase 3**: Server-side AI enrichment & synthesis.
- **Phase 4**: Feedback-driven personalization & explainability engine.
- **Phase 5**: Craft & Raindrop.io connectors.
- **Phase 6**: Apple ecosystem extensions (Shortcuts, Widgets, Share Extension).
