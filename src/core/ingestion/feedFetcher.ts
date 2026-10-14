export interface FetchOptions {
  timeoutMs?: number;
  maxBytes?: number;
  etag?: string;
  lastModified?: string;
  retries?: number;
}

export interface FetchResult {
  url: string;
  status: number;
  notModified: boolean;
  content: string;
  etag?: string;
  lastModified?: string;
}

/**
 * Resilient, bounded HTTP fetcher for external RSS/Atom feeds.
 * - 5-second timeout default via AbortController
 * - 1MB response size guard to prevent runaway memory consumption
 * - Conditional HTTP caching (If-None-Match / If-Modified-Since)
 * - Exponential backoff retry on transient 5xx or network errors
 */
export async function fetchFeedXml(
  url: string,
  options: FetchOptions = {}
): Promise<FetchResult> {
  const timeoutMs = options.timeoutMs ?? 5000;
  const maxBytes = options.maxBytes ?? 1024 * 1024; // 1 MB
  const maxRetries = options.retries ?? 2;

  let attempt = 0;
  let lastError: Error | null = null;

  while (attempt <= maxRetries) {
    attempt++;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AtemDiscovery/1.0',
      'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8'
    };

    if (options.etag) {
      headers['If-None-Match'] = options.etag;
    }
    if (options.lastModified) {
      headers['If-Modified-Since'] = options.lastModified;
    }

    try {
      const response = await fetch(url, {
        headers,
        signal: controller.signal
      });

      clearTimeout(timer);

      if (response.status === 304) {
        return {
          url,
          status: 304,
          notModified: true,
          content: '',
          etag: response.headers.get('etag') || options.etag,
          lastModified: response.headers.get('last-modified') || options.lastModified
        };
      }

      if (!response.ok) {
        if (response.status >= 500 && attempt <= maxRetries) {
          // Transient server error: retry after delay
          await new Promise(r => setTimeout(r, attempt * 500));
          continue;
        }
        throw new Error(`HTTP ${response.status} ${response.statusText} von ${url}`);
      }

      const contentLengthHeader = response.headers.get('content-length');
      if (contentLengthHeader && parseInt(contentLengthHeader, 10) > maxBytes) {
        throw new Error(`Antwort von ${url} überschreitet das Limit von ${maxBytes} Bytes`);
      }

      const text = await response.text();
      if (text.length > maxBytes) {
        throw new Error(`Antwortinhalt von ${url} überschreitet das Limit von ${maxBytes} Bytes`);
      }

      return {
        url,
        status: response.status,
        notModified: false,
        content: text,
        etag: response.headers.get('etag') ?? undefined,
        lastModified: response.headers.get('last-modified') ?? undefined
      };
    } catch (err: any) {
      clearTimeout(timer);
      lastError = err;
      if (attempt <= maxRetries && (err?.name === 'AbortError' || err?.message?.includes('fetch failed'))) {
        await new Promise(r => setTimeout(r, attempt * 500));
        continue;
      }
      break;
    }
  }

  throw new Error(`Feed-Abruf für ${url} fehlgeschlagen nach ${attempt} Versuchen: ${lastError?.message}`);
}
