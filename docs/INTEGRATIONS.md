# Ecosystem Integrations Roadmap — Atem

## 1. Apple Ecosystem
- **Target Device**: iPhone 15 Pro (A17 Pro, iOS 17/18), Apple Watch Ultra 2, iPad Pro M2.
- **Shortcuts & App Intents**:
  - "Lies Atem Tagesausgabe" (Launch directly into the Daily Edition).
  - "Atem Quick Insight" (Siri or Action Button trigger to read a single 60s insight).
- **Widgets (WidgetKit via Expo config plugins / Swift)**:
  - Small / Medium Home Screen widget showing the daily philosophical thought experiment or key briefing.
- **Share Sheet**:
  - Accept shared URLs or text snippets to summarize and store in Atem.
- **Accessibility**:
  - Dynamic Type font scaling.
  - Full VoiceOver semantic labeling.
  - Respect Reduced Motion (`prefers-reduced-motion`).

## 2. Note & Bookmark Integrations
- **Craft**:
  - Read-only connector via Craft API or exported Markdown spaces.
  - Surface connections between current reading and ongoing pedagogical or philosophical writing projects.
- **Raindrop.io**:
  - Read-only connector to fetch unread bookmarks and synthesize cross-topic connections.
  - Strict privacy boundary: user selects explicit collection tags to index; no unconditional full-library upload.

## 3. AI Providers
- **Google Gemini API** (`gemini-2.5-flash` / `gemini-1.5-pro`):
  - Structured output extraction, German-first synthesis, factual verification passes against source documents.
- **OpenAI API** (`gpt-4o-mini` / `gpt-4o`):
  - Secondary fallback provider for editorial synthesis and dialectical debate generation.
- **Security Rule**:
  - All LLM invocations occur through serverless edge functions (Supabase). No API keys stored in mobile app bundle.
