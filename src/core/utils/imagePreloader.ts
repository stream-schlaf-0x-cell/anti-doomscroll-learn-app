/**
 * Lightweight Web Image Preloader
 *
 * Preloads upcoming feed card images ahead of scroll using idle time so
 * Firefox and Safari on older hardware display images immediately as cards
 * enter the viewport without blocking scroll frames.
 */

export const MAX_PRELOAD_CACHE = 80;

const preloadedImageUrls = new Set<string>();

interface WindowWithOptionalIdleCallback {
  requestIdleCallback?: (
    callback: () => void,
    options?: { timeout?: number }
  ) => number;
}

/**
 * Schedules background preloading of up to `maxBatch` unseen image URLs on web.
 * Safe no-op on native platforms or SSR where `window.Image` is unavailable.
 */
export function preloadUpcomingFeedImages(urls: string[], maxBatch = 6): void {
  if (typeof window === 'undefined' || typeof window.Image !== 'function') {
    return;
  }

  const safeMaxBatch = Math.max(0, Math.floor(maxBatch));
  if (safeMaxBatch === 0 || !Array.isArray(urls) || urls.length === 0) {
    return;
  }

  const batch: string[] = [];
  const seenInBatch = new Set<string>();

  for (const rawUrl of urls) {
    if (batch.length >= safeMaxBatch) break;
    if (typeof rawUrl !== 'string') continue;
    const trimmed = rawUrl.trim();
    if (!trimmed) continue;
    if (preloadedImageUrls.has(trimmed) || seenInBatch.has(trimmed)) continue;
    seenInBatch.add(trimmed);
    batch.push(trimmed);
  }

  if (batch.length === 0) {
    return;
  }

  for (const url of batch) {
    while (preloadedImageUrls.size >= MAX_PRELOAD_CACHE) {
      const oldest = preloadedImageUrls.values().next().value;
      if (oldest === undefined) break;
      preloadedImageUrls.delete(oldest);
    }
    preloadedImageUrls.add(url);
  }

  const runPreload = (): void => {
    if (typeof window === 'undefined' || typeof window.Image !== 'function') {
      return;
    }
    for (const url of batch) {
      const img = new window.Image();
      img.decoding = 'async';
      img.src = url;
    }
  };

  const win = window as unknown as WindowWithOptionalIdleCallback;
  if (typeof win.requestIdleCallback === 'function') {
    win.requestIdleCallback(
      () => {
        runPreload();
      },
      { timeout: 300 }
    );
  } else {
    setTimeout(runPreload, 80);
  }
}

/**
 * Resets the bounded preloaded URL cache (for deterministic unit tests).
 */
export function resetPreloadedImageCacheForTest(): void {
  preloadedImageUrls.clear();
}
