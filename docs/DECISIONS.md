# Architecture Decision Records (ADR) — Atem

## ADR 001: Mobile Framework Selection
- **Status**: Accepted
- **Context**: Target device is an iPhone 15 Pro. Development host is an Intel MacBook Pro (2014) on macOS Ventura (13.7.8) without modern Xcode 15/16 installed. The app requires fast iterations, rock-solid iOS feel, and ability to run immediately on device and in local developer tools.
- **Decision**: Adopt React Native with Expo SDK 57, TypeScript with strict mode, React hooks, and Expo vector icons.
- **Consequences**: Enables immediate local testing via Expo Go on the physical iPhone 15 Pro over LAN/tunnel, as well as instant browser verification via Expo Web, bypassing the macOS Ventura local xcodebuild limitation.

---

## ADR 002: Repository Monorepo vs Root App Structure
- **Status**: Accepted
- **Context**: The master prompt suggested `apps/mobile` and `packages/shared`. On Node v24 with Metro on macOS, monorepo symlink hoisting frequently causes module resolution failures unless intricate Metro configuration is maintained.
- **Decision**: Keep the primary Expo application at the repository root, with clean internal directory boundaries (`src/core/domain/`, `src/core/data/`, `src/features/`, `src/ui/`).
- **Consequences**: Zero Metro hoisting issues, seamless `npx expo start`, while domain logic in `src/core/domain/` remains completely decoupled from React Native UI and ready for extraction to `packages/shared` or Supabase Edge Functions when needed in Phase 3.

---

## ADR 003: Local-First Storage & Persistence Engine
- **Status**: Accepted
- **Context**: Phase 1 MVP must run reliably without external cloud credentials (no Supabase account needed on day 1), survive restarts, and provide instantaneous offline reading.
- **Decision**: Use `@react-native-async-storage/async-storage` wrapped behind an abstract repository interface (`IFeedRepository`, `ILibraryRepository`, `IUserProfileRepository`).
- **Consequences**: Instantaneous offline reading, persistent saved state across app restarts, zero configuration required by the user, and swappable with SQLite or Supabase in subsequent phases without touching UI components.

---

## ADR 004: Type Safety & Runtime Validation with Zod
- **Status**: Accepted
- **Context**: Content pipelines handle unstructured or dynamic feeds. LLM outputs and external sources can drift.
- **Decision**: All domain entities (`FeedItem`, `SourceReference`, `UserProfile`, `ReadingInteraction`) are defined as Zod schemas with TypeScript type inference (`z.infer<typeof ...>`).
- **Consequences**: Strict type checking at compile-time and guaranteed runtime sanitization of external or persisted data.

---

## ADR 005: Explainable Deterministic Feed Ranking
- **Status**: Accepted
- **Context**: Prevent algorithmic dopamine manipulation and black-box recommendations. The user wants intellectual control and explainability.
- **Decision**: Implement a transparent scoring function based on:
  1. Explicit user topic affinity weights (0.0 to 1.0)
  2. Content type matching to reading time preference
  3. Freshness decay
  4. Diversity penalty (preventing duplicate consecutive topics)
  5. Unread status boost
- **Consequences**: Immediate, noticeable responsiveness when the user alters preferences in Settings, plus a human-readable "Warum sehe ich das?" explanation attached to every feed item.
