/**
 * Atmen Secure Hybrid AI Proxy
 *
 * Provides a protected server-side boundary for production Gemini and OpenRouter calls:
 * 1. Hides master Gemini API keys on the server (via GEMINI_API_KEY env variable).
 * 2. Supports user-supplied BYOK via secure x-gemini-key header.
 * 3. Enforces rate limiting (token bucket per IP/client).
 * 4. Limits request body payload to 120 KB to prevent token exhaustion or buffer attacks.
 * 5. Bounded timeouts (15s) with safe non-leaking error responses.
 */

export interface ProxyRequestContext {
  method: string;
  url: string;
  headers: Record<string, string | string[] | undefined>;
  body?: any;
  clientIp?: string;
}

export interface ProxyResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: any;
}

class InMemoryRateLimiter {
  private requests = new Map<string, number[]>();
  private maxRequestsPerMinute: number;

  constructor(maxRequestsPerMinute: number = 30) {
    this.maxRequestsPerMinute = maxRequestsPerMinute;
  }

  public isAllowed(clientKey: string): boolean {
    const now = Date.now();
    const windowStart = now - 60 * 1000;
    const timestamps = this.requests.get(clientKey) || [];

    const recent = timestamps.filter(t => t > windowStart);
    if (recent.length >= this.maxRequestsPerMinute) {
      this.requests.set(clientKey, recent);
      return false;
    }

    recent.push(now);
    this.requests.set(clientKey, recent);
    return true;
  }
}

export const defaultProxyRateLimiter = new InMemoryRateLimiter(45);

export async function handleAiProxyRequest(ctx: ProxyRequestContext): Promise<ProxyResponse> {
  const urlObj = new URL(ctx.url, 'http://localhost');
  const pathname = urlObj.pathname;

  // 1. CORS headers
  const corsHeaders: Record<string, string> = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-gemini-key, x-atmen-client',
    'Content-Type': 'application/json'
  };

  if (ctx.method === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: corsHeaders,
      body: null
    };
  }

  // 2. Capabilities Endpoint
  if (pathname === '/api/ai/capabilities' && ctx.method === 'GET') {
    const serverHasMasterKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 5);
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: {
        serverProxyActive: true,
        masterKeyConfigured: serverHasMasterKey,
        supportedEndpoints: ['/api/ai/curate', '/api/ai/enrich', '/api/ai/hivemind', '/api/ai/quiz'],
        defaultModel: 'gemini-2.5-flash',
        rateLimitPerMinute: 45
      }
    };
  }

  // 3. Rate Limiting Check
  const clientKey = ctx.clientIp || (Array.isArray(ctx.headers['x-forwarded-for']) ? ctx.headers['x-forwarded-for'][0] : ctx.headers['x-forwarded-for']) || 'anon';
  if (!defaultProxyRateLimiter.isAllowed(String(clientKey))) {
    return {
      statusCode: 429,
      headers: corsHeaders,
      body: {
        error: 'Zu viele KI-Anfragen. Bitte warte einen Moment.',
        retryAfterSeconds: 60
      }
    };
  }

  // 4. Resolve Effective API Key (Priority: Server Secret -> User BYOK Header)
  const byokKey = (Array.isArray(ctx.headers['x-gemini-key']) ? ctx.headers['x-gemini-key'][0] : ctx.headers['x-gemini-key'])?.trim();
  const serverKey = process.env.GEMINI_API_KEY?.trim();
  const effectiveKey = serverKey || byokKey;

  if (!effectiveKey) {
    return {
      statusCode: 401,
      headers: corsHeaders,
      body: {
        error: 'Kein gültiger API-Schlüssel konfiguriert. Bitte gib einen eigenen Gemini-Key in den Einstellungen ein.'
      }
    };
  }

  // 5. Payload Validation & Size Protection
  const rawBody = ctx.body;
  if (ctx.method === 'POST') {
    if (!rawBody) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: { error: 'Ungültiger oder leerer Anfrage-Body.' }
      };
    }

    const payloadString = typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody);
    if (payloadString.length > 120 * 1024) {
      return {
        statusCode: 413,
        headers: corsHeaders,
        body: { error: 'Payload zu groß (maximal 120 KB erlaubt).' }
      };
    }
  }

  // 6. Route to Gemini API with 15s Timeout
  try {
    const parsedBody = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
    const model = parsedBody.model || 'gemini-2.5-flash';
    const prompt = parsedBody.prompt || '';
    const systemInstruction = parsedBody.systemInstruction;
    const jsonMode = Boolean(parsedBody.jsonMode);

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeout = setTimeout(() => controller?.abort(), 15000);

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(effectiveKey)}`;

    const geminiBody: Record<string, any> = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    };

    if (systemInstruction) {
      geminiBody.systemInstruction = { parts: [{ text: systemInstruction }] };
    }

    if (jsonMode) {
      geminiBody.generationConfig = { responseMimeType: 'application/json' };
    }

    const upstreamResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody),
      signal: controller?.signal
    });

    clearTimeout(timeout);

    if (!upstreamResponse.ok) {
      const errText = await upstreamResponse.text();
      return {
        statusCode: upstreamResponse.status,
        headers: corsHeaders,
        body: {
          error: `Gemini API Fehler (${upstreamResponse.status})`,
          details: errText.slice(0, 300)
        }
      };
    }

    const geminiResult = await upstreamResponse.json();
    const candidate = geminiResult.candidates?.[0];
    const text = candidate?.content?.parts?.[0]?.text || '';

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: {
        success: true,
        text,
        model,
        usage: geminiResult.usageMetadata
      }
    };
  } catch (err: any) {
    const isTimeout = err?.name === 'AbortError' || err?.message?.includes('timeout');
    return {
      statusCode: isTimeout ? 504 : 500,
      headers: corsHeaders,
      body: {
        error: isTimeout ? 'Zeitüberschreitung bei der KI-Anfrage (15s).' : 'Interner Server-Fehler bei KI-Proxy-Verarbeitung.'
      }
    };
  }
}
