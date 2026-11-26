/**
 * Lightweight module-level pub/sub coordinator ensuring at most ONE inline
 * YouTube iframe player is mounted across the entire feed at any moment.
 *
 * Avoids prop-drilling through FeedScreen / FlatList so FeedCard React.memo
 * stays completely untouched while scrolling, and protects RAM on older browsers
 * (e.g. Firefox on Intel Mac) by auto-collapsing any previous player back to
 * its lightweight thumbnail when another video starts.
 */

type ActiveVideoListener = (activeKey: string | null) => void;

let activeInlineVideoKey: string | null = null;
const listeners = new Set<ActiveVideoListener>();

export function getActiveInlineVideoKey(): string | null {
  return activeInlineVideoKey;
}

export function setActiveInlineVideoKey(nextKey: string | null): void {
  const normalized = nextKey && nextKey.trim().length > 0 ? nextKey.trim() : null;
  if (activeInlineVideoKey === normalized) return;
  activeInlineVideoKey = normalized;
  for (const listener of listeners) {
    try {
      listener(activeInlineVideoKey);
    } catch {
      // Never let a listener failure break other cards
    }
  }
}

export function subscribeActiveInlineVideo(listener: ActiveVideoListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Extracts a canonical 11-character YouTube video ID from any supported watch/short/embed URL.
 */
export function extractInlineYoutubeVideoId(rawUrl?: string | null): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }
  const match = trimmed.match(
    /(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:[?&#/]|$)/i
  );
  return match?.[1] ?? null;
}

/**
 * Builds the privacy-enhanced YouTube embed URL used on deliberate Click-to-Play.
 */
export function buildYouTubeNoCookieEmbedUrl(videoId: string): string {
  const safeId = encodeURIComponent(videoId.trim());
  return `https://www.youtube-nocookie.com/embed/${safeId}?autoplay=1&rel=0&modestbranding=1`;
}
