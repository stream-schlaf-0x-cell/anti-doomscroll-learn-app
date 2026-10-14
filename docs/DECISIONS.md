# Architecture Decision Records (ADR) — Atem

## ADR 001: Mobile Framework Selection
- **Status**: Accepted
- **Context**: Target device is an iPhone 15 Pro. Development host is an Intel MacBook Pro (2014) on macOS Ventura (13.7.8) without modern Xcode 15/16 installed. The app requires fast iterations, rock-solid iOS feel, and ability to run immediately on device and in local developer tools.
- **Decision**: Adopt React Native with Expo SDK, TypeScript with strict mode, React hooks, and Expo vector icons.
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

---

## ADR 006: Expo SDK 54 Alignment for App Store Expo Go Preview
- **Status**: Accepted (Phase 1.1)
- **Context**: The Apple App Store Expo Go client version supports up to Expo SDK 54. Running SDK 57 on a physical iPhone 15 Pro without a paid Apple Developer membership or custom development build would fail.
- **Decision**: Align the project to Expo SDK 54 with React Native 0.81.5 / 0.76.x and React 18/19.
- **Consequences**: Enables zero-cost, immediate physical device preview on iPhone 15 Pro via the App Store Expo Go app.

---

## ADR 007: Single-Lock Storage Mutex & TransactionScope Architecture
- **Status**: Accepted (Phase 1.2)
- **Context**: In Phase 1.1, `runTransaction(key, task)` acquired an exclusive lock, and inside `task`, calls to `setItem(key)` or `removeItem(key)` acquired the same lock again, resulting in an immediate and indefinite deadlock. Catching errors in storage drivers and returning in-memory fallbacks silently masked storage failures.
- **Decision**:
  1. Refactor `AtemStorage` to use an injectable `IStorageDriver` with a per-key mutex `KeyLockManager`.
  2. Provide a single-lock `TransactionScope` (`tx.get`, `tx.set`, `tx.remove`) directly accessing the driver without re-locking.
  3. Propagate typed storage errors (`StorageUnavailableError`, `StorageWriteError`, `CorruptedDataError`).
  4. Isolate corrupt JSON into timestamped quarantine keys (`<key>.corrupt.<iso>`) rather than overwriting valid historical bytes.
- **Consequences**: Complete elimination of persistence deadlocks, atomic concurrent operations across different or identical keys, and transparent data recovery.

---

## ADR 008: Non-Unmounting Overlay Reader & URL History Synchronization
- **Status**: Accepted (Phase 1.2)
- **Context**: Conditional rendering (`selectedArticleId ? <ReaderScreen /> : <Tabs />`) completely unmounts the tab tree, discarding feed scroll position, active topic filters, and discovery section expansions. Furthermore, browser back/forward buttons failed to reflect article states on web.
- **Decision**:
  1. Keep the tabs tree continuously mounted in the background.
  2. Render `ReaderScreen` as an absolute overlay (`StyleSheet.absoluteFillObject`) when an article is open.
  3. Synchronize `selectedArticleId` with `window.history` (`pushState`, `popstate`, and URL query parameter `?article=<id>`).
  4. Flush throttled reading progress synchronously upon leaving the reader or on app state transitions.
- **Consequences**: 100% preservation of feed scroll offset and filters upon exiting an article, combined with natural browser history navigation on web and hardware back handling.

---

## ADR 009: Decoupled Offline Full-Article Library Storage
- **Status**: Accepted (Phase 2)
- **Context**: In Phase 1, the library stored only item IDs and resolved full articles dynamically from the current feed arrays. When daily feeds rotate or older articles drop out, bookmarked articles would vanish or fail to load offline.
- **Decision**:
  1. Extend `ILibraryRepository` with `saveArticle(article: FeedItem)` and `unsaveArticle(id: string)`.
  2. Persist full article entities with complete body, sources, and provenance under `@atem:saved_articles:v1`.
  3. Update `LibraryScreen` to display decoupled saved articles directly from persistent offline storage.
- **Consequences**: Bookmarked reading remains 100% available offline and survives infinite feed rotations and cache flushes.

---

## ADR 010: Pure TypeScript RSS/Atom Ingestion Outside Mobile Runtime
- **Status**: Accepted (Phase 2)
- **Context**: The mobile client should not perform heavy network polling, XML parsing, or web scraping. Heavy dependencies (e.g. native XML parsers) cause mobile bundle bloat and network unreliability on device.
- **Decision**:
  1. Build an external ingestion pipeline (`src/core/ingestion/`) with pure TypeScript regex-based XML parser (`rssParser.ts`) supporting RSS 2.0 and Atom 1.0.
  2. Decode HTML entities (including German umlauts and quotes) and strip malicious tags.
  3. Run via CLI script `scripts/run-pipeline.ts` (`npm run ingest`) outputting to `pipeline-output.json`.
- **Consequences**: Client remains ultra-lightweight and fast; ingestion runs independently on server, local machine, or cron without burdening device battery.

---

## ADR 011: Provider-Independent Enrichment & Hard €5 Monthly Spending Ceiling
- **Status**: Accepted (Phase 2)
- **Context**: The user requires structured German content enrichment while strictly bounding personal operating expenses to ~€5.00/month.
- **Decision**:
  1. Define `IContentEnricher` interface with structured Zod schema output.
  2. Ground pricing on official Google Gemini Flash token rates ($0.10/1M input, $0.40/1M output).
  3. Enforce hard €5.00/month cap via `EnrichmentUsageLedger`, which tracks every call and immediately halts further LLM spend upon reaching the ceiling.
  4. Implement `EnrichmentCache` (key: `contentHash + promptVersion`) to eliminate redundant costs.
  5. Provide `SourceOnlyEnricher` as a zero-cost local fallback that operates completely without API credentials.
- **Consequences**: Guaranteed predictable costs (typically €0.10–€0.25/month for personal use), continuous operation without bill shock, and full offline/no-credential testability.

---

## ADR 012: Multi-Dimensional Ranking with Personal Goals & Soft Quotas
- **Status**: Accepted (Phase 2)
- **Context**: The founder's intellectual profile requires balancing frontier AI acceleration with philosophy, German didactics, modular music, and contemplative science, while ensuring ~10% didactics and ~10% challenging perspectives.
- **Decision**:
  1. Introduce 5 explicit `PersonalGoal` definitions with `TOPIC_GOAL_MAP` alignment factors.
  2. Capture explicit feedback memory (`boostedAuthors`, `penalizedTopics`).
  3. Implement soft editorial quotas in `rankAndInterleaveFeed`: if the top batch lacks a teaching or counter-perspective item, the highest-ranking candidate from the pool is elevated into the primary batch while maintaining topic interleaving.
- **Consequences**: Balanced, intellectually stimulating feed that honors personal learning goals and preserves varied perspectives without rigid clumping.

---

## ADR 013: Standalone In-Card `feedText` Reading & Non-Shifting Discovery Batching
- **Status**: Accepted (Phase 2)
- **Context**: Anti-doomscroll principle requires immediate, standalone substance directly on feed cards without forced clicks to an empty reader screen. Furthermore, requesting additional reading must not shift existing cards or cause scroll disorientation.
- **Decision**:
  1. Separate `feedText` (rich 5–8 line standalone substance on the card) from `articleBody` (optional expanded reader).
  2. Show "Im Lesemodus vertiefen →" only when an expanded body actually exists.
  3. Enforce a finite daily batch of 10–12 items, followed by a calm completion banner ("Ende dieser Ausgabe").
  4. "Weiter entdecken" appends the next 10 items to the bottom of the list without modifying earlier items or changing scroll offset.
- **Consequences**: Satisfying, complete reading right in the feed, zero clickbait snippets, and calm, predictable continuation.
