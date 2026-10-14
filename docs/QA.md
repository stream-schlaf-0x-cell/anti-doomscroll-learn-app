# Quality Assurance & Verification Runbook — Atem

## Automated Verification Gates
1. **Reproducible Installation**:
   ```bash
   npm ci
   ```
   Ensures complete lockfile alignment and identical dependency trees.

2. **TypeScript Type Safety**:
   ```bash
   npm run typecheck
   ```
   Executes `tsc --noEmit`. Must pass with 0 errors and 0 warnings under strict compiler options.

3. **Linter**:
   ```bash
   npm run lint
   ```
   Executes `expo lint`. Must pass with 0 warnings and 0 errors.

4. **Automated Test Suite (18 Tests Across 3 Suites)**:
   ```bash
   npm test
   ```
   Validates:
   - **Domain Schemas & Invariant Validation** (4 tests):
     * All fixtures satisfy `FeedItemSchema`.
     * `DEFAULT_USER_PROFILE` satisfies `UserProfileSchema`.
     * Schema rejection of invalid reading interactions.
     * Demonstration collection reading lengths distribution (3 quick, 3 briefings, 2 deep dives, 1 discovery).
   - **Deterministic Ranking Engine** (6 tests):
     * Topic affinity scoring prioritizes top interests.
     * Duration matching boosts items matching user reading duration preference.
     * Observable ranking differences between quick vs. deep preferences on real fixtures.
     * Explicit feedback adjustment (`more_like_this` / `less_like_this`).
     * Topic interleaving prevents consecutive duplicate topics.
     * Transparent German explanation breakdowns.
   - **Storage Mutex & Persistence Architecture** (8 tests):
     * Profile save settles and invokes persistent driver.
     * Save, unsave, progress, feedback, and reset settle without deadlocking.
     * Concurrent updates to different articles preserve both changes.
     * Progress and bookmark updates on same article preserve both fields.
     * Failed driver operation releases lock so subsequent operations succeed.
     * New repository instances read committed data from disk.
     * Anti-overwriting: older asynchronous work cannot overwrite newer user choices.
     * Corrupted data handling: distinguishes missing vs corrupt bytes, quarantines corrupt payload, and throws `CorruptedDataError`.

5. **Project Health & Expo Doctor**:
   ```bash
   npx expo-doctor@latest
   ```
   All 18 diagnostics checks must pass with 0 issues.

6. **Web Export Build**:
   ```bash
   npx expo export -p web
   ```
   Generates a standalone, production-ready static bundle in `dist/`.

7. **Interactive UI Verification**:
   Visual validation using headless Chrome across 8 target screens in iPhone 15 Pro dimensions (393x852). Screenshots stored in `screenshots/`:
   - `01-onboarding.png` (Initial launch)
   - `02-feed-hero.png` (Finite feed top & dynamic hero)
   - `03-feed-finite-edition.png` ("Ende dieser Ausgabe" anti-doomscroll banner)
   - `04-reader-top.png` (Overlay reader with word counts & reading rates)
   - `05-reader-provenance.png` (Editorial provenance, German fact-review, real URLs)
   - `06-library.png` (Local-first library with sub-filters)
   - `07-settings.png` (Transparent interest weighting steppers)
   - `08-settings-reset-modal.png` (Confirmation modal for destructive reset)

---

## Manual Test Script (Phase 1 Acceptance Flow)
1. **First-Run Onboarding Flow**:
   - Launch app (clean storage).
   - Verify Welcome Screen appears with calm, non-addictive messaging.
   - Adjust initial interest weights (e.g. increase "Ethik & Philosophie", decrease "Wissenschaft").
   - Click "Tagesausgabe starten".
   - Confirm feed loads immediately without requiring an account.

2. **Feed Experience & Variety**:
   - Verify different card layouts: Featured Hero, Perspective (Gegenüberstellung), Deep Dive, Connection, Quick Insight.
   - Verify reading time badge (e.g. "3 Min.").
   - Tap "Warum sehe ich das?" on a card: verify transparent explanation modal with active topic affinity score and reason.
   - Scroll to bottom of daily items: verify "Tagesausgabe abgeschlossen" banner (finite stopping point).
   - Tap "Mehr entdecken" to unlock the extended discovery stream.

3. **Article Reader**:
   - Tap on an article card.
   - Confirm article opens with clean, readable editorial typography.
   - Test text size adjuster (A- / A+ buttons).
   - Test Theme toggle (Hell / Dunkel).
   - Scroll down: verify reading progress bar updates smoothly.
   - Verify source provenance box (Publisher, Author, Link, Verified badge).
   - Tap interactive deepening tabs:
     * "Didaktik & Schule" (Classroom applications)
     * "Gegenposition" (Opposing philosophical perspective)
     * "Philosophischer Kontext" (Foundational background)
   - Tap "Merken" (Save). Verify icon toggles to saved state.
   - Tap back button to return to feed.

4. **Saved Library (Bibliothek)**:
   - Switch to "Bibliothek" tab.
   - Confirm the saved article appears.
   - Tap to open article from library, confirm full content and reading state.
   - Test removing from saved.

5. **Settings & Dynamic Personalization**:
   - Switch to "Einstellungen" tab.
   - Change topic weights (e.g., maximize "Didaktik & Schule" and set "Tech & KI" to minimum).
   - Return to "Feed" tab.
   - Confirm the feed immediately re-ranks to prioritize Didaktik & Education articles.
   - Test resetting onboarding state.

6. **Persistence Across Restarts**:
   - Save an article, change an interest weight.
   - Reload/restart the application.
   - Confirm saved article is still in the Library and interest weights are preserved.
