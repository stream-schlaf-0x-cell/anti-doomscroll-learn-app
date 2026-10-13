# Technical Architecture: Atem

## 1. System Topology Overview
Atem is designed from day one with a clean separation of concerns, ensuring local-first resilience, predictable performance on mobile hardware (iPhone 15 Pro), and modular extensibility.

```
┌────────────────────────────────────────────────────────────────────────┐
│                          PRESENTATION LAYER                            │
│  Expo Router / React Native (Custom Design Tokens, Editorial Typography)│
│                                                                        │
│  ┌───────────────┐  ┌────────────────┐  ┌─────────────┐  ┌───────────┐ │
│  │ Feed Screen   │  │ Reader Screen  │  │ Library     │  │ Settings  │ │
│  │ (Curated Stream│  │ (Long-form     │  │ (Saved /    │  │ (Interests│ │
│  │ & Discovery)  │  │ & Deepening)   │  │ History)    │  │ & Sources)│ │
│  └───────┬───────┘  └───────┬────────┘  └──────┬──────┘  └─────┬─────┘ │
└──────────┼──────────────────┼──────────────────┼───────────────┼───────┘
           │                  │                  │               │
┌──────────▼──────────────────▼──────────────────▼───────────────▼───────┐
│                       APPLICATION & STATE LAYER                         │
│  React Contexts & Custom Hooks (FeedContext, LibraryContext, Settings)  │
│  Deterministic Feed Ranking Engine & Filtering Pipeline                │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
┌──────────────────────────────────▼─────────────────────────────────────┐
│                          DOMAIN & DATA LAYER                           │
│  Zod Schemas & Domain Models (FeedItem, SourceReference, UserProfile)  │
│  Repository Pattern: FeedRepository, LibraryRepository, SettingsRepo  │
│                                                                        │
│  ┌───────────────────────┐             ┌─────────────────────────────┐ │
│  │ Local Persistence     │             │ Content Adapters            │ │
│  │ (AsyncStorage/SQLite) │             │ (Local Fixtures, RSS, Mock) │ │
│  └───────────────────────┘             └─────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Layers & Responsibilities

### Domain Layer (`src/shared/domain/` or `src/core/models/`)
- Pure TypeScript contracts and runtime schemas (`zod`).
- Invariant validation, types:
  - `FeedItem`: id, type, title, subtitle, body, topics, sourceReferences, readingTime, relevanceExplanation, status, provenance.
  - `SourceReference`: publisher, url, title, publishedAt, retrievedAt, author.
  - `UserProfile`: language, region, explicitInterests, readingPreferences.
  - `ReadingInteraction`: itemId, saved, progress, completedAt, rating.
- Pure ranking logic: Deterministic relevance scoring based on user weights, novelty, freshness, and diversity.

### Data Layer (`src/data/`)
- Repository interfaces:
  - `IFeedRepository`: fetchDailyEdition(), fetchDiscoveryItems(), searchItems()
  - `ILibraryRepository`: getSavedItems(), saveItem(), unsaveItem(), getReadingHistory()
  - `IUserProfileRepository`: getProfile(), updatePreferences()
- Storage adapters:
  - Local SQLite / AsyncStorage for resilient, instant offline availability.
  - Fixture loader with grounded, realistic editorial content.

### UI Layer (`src/ui/` & `src/features/`)
- Apple Human Interface Guidelines aligned typography scale:
  - Display titles (New York / Serif where available, Georgia fallback).
  - Body text (San Francisco / System Sans, carefully tuned `lineHeight` and `letterSpacing` for reading stamina).
- Color roles:
  - Semantic tokens: `surface`, `surfaceSubtle`, `textPrimary`, `textSecondary`, `accent`, `divider`.
  - Dynamic support for both Light and Dark modes with high-contrast accessibility.
- Interaction design:
  - Finite Daily Edition with clear completion state to counteract doomscrolling impulses.
  - Optional progressive discovery mode for intentional continued reading.
  - In-article deepening triggers: "Gegenposition" (Opposing View), "Didaktische Anknüpfung" (Didactic connection), "Philosophischer Kontext" (Philosophical context).
