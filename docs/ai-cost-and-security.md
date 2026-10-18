# Atmen — AI Cost, Security & Hybrid Proxy Architecture

**Date:** October 18, 2026  
**Status:** Verified & Tested (`server/ai/proxy.ts`, `src/core/ai/atmenAiClient.ts`)  

---

## 1. Security Architecture & Threat Model

### 1.1 Secure Hybrid Proxy (`server/ai/proxy.ts`)
In traditional client-only architectures, API keys (such as `GEMINI_API_KEY`) are either bundled into client bundles or stored in insecure client-side local storage.
Atmen addresses this with a secure hybrid boundary:
1. **Server-Side Secret Isolation:** In serverless or containerized environments, `GEMINI_API_KEY` is loaded strictly from environment variables (`process.env.GEMINI_API_KEY`). The secret is never sent to the client browser or bundle.
2. **Bring-Your-Own-Key (BYOK) Support:** Users wishing to supply their own Gemini key send it via the encrypted HTTP header `x-gemini-key`. It is processed in memory and never logged or persisted on the server.
3. **Payload Protection:** Incoming request bodies are restricted to $\le 120\text{ KB}$ (`413 Payload Too Large`). This protects against buffer attacks and runaway prompt token costs.
4. **Rate Limiting:** Built-in sliding window rate limiter permits a maximum of 45 requests per minute per IP address (`429 Too Many Requests`).
5. **Bounded Execution:** Serverless timeouts are strictly capped at 15 seconds via `AbortController`.
6. **Graceful Non-AI Degradation:** If no API key is available or the network is offline, Atmen operates fully using deterministic heuristics:
   - Topic classification via keyword heuristics.
   - Signal-to-noise gatekeeping via deterministic heuristics.
   - 3 Contemplative lenses via `atmenStudio.ts` deterministic dialectic engines.

---

## 2. Multi-Dimensional Content-Addressable Cache (`EnrichmentCache`)

To eliminate redundant AI calls and guarantee that the same article never consumes Gemini tokens twice, the cache employs a composite hash key:

$$\text{CacheKey} = \text{hash}(\text{contentHash}) : \text{task} : \text{schemaVersion} : \text{promptVersion} : \text{modelId} : \text{language}$$

- **Content Invariance:** If article content, prompt template, model, and schema remain unchanged, responses are served from storage in $<1\text{ ms}$.
- **Safe Eviction & Sharding:** Long-form article bodies are sharded separately to keep cache index overhead minimal.

---

## 3. Sparse-Payload AI Ingestion (`batchEnricher.ts`)

Instead of passing entire 2,000-word article bodies to Gemini for initial curation and gatekeeping, Atmen implements a **Two-Tier Evaluation Pipeline**:

1. **Tier 1 (Deterministic Heuristic Pre-Filter):**
   - Articles are evaluated locally for minimal length, clickbait words, commercial vouchers, and language.
   - Low-quality noise is dropped before any network request occurs.
2. **Tier 2 (Sparse-Payload Batching):**
   - For candidates passing Tier 1, a compact triage snippet ($\le 280$ characters per article) is constructed:
     ```json
     { "id": "item-123", "title": "...", "snippet": "...", "domain": "..." }
     ```
   - Up to 10 articles are evaluated in a single Gemini call, reducing token consumption by over 85% compared to full-article prompt evaluation.

---

## 4. Cost Model & Token Budget

| Model | Input Price / 1M Tokens | Output Price / 1M Tokens | Typical Atmen Curation Cost |
| :--- | :--- | :--- | :--- |
| **Gemini 2.5 Flash** (Default) | \$0.075 | \$0.30 | ~\$0.00012 per 10-article batch |
| **Gemini 2.5 Pro** (Deep Dives) | \$1.25 | \$5.00 | ~\$0.0025 per deep synthesis |
| **Local / Offline (No AI)** | \$0.00 | \$0.00 | \$0.00 (100% free) |
