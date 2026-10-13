# Quality Assurance & Verification Runbook — Atem

## Automated Verification Gates
1. **TypeScript Type Safety**:
   ```bash
   npx tsc --noEmit
   ```
   Must pass with 0 errors and 0 warnings under strict compiler options.

2. **Domain Logic Tests**:
   ```bash
   npm test
   ```
   Validates:
   - Zod schema validation for all feed items and user profiles.
   - Deterministic feed ranking algorithm: ensures higher affinity topics rank first, diversity penalty prevents consecutive duplicate topics, and unread boost functions correctly.
   - Storage serialization and deserialization.

3. **Development Server & Web / Device Preview**:
   ```bash
   npx expo start --web
   ```
   Verifies that the bundler (Metro) resolves all assets and components cleanly.

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
