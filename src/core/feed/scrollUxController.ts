/**
 * Pure, framework-agnostic scroll & pull-to-refresh UX state machine for FeedScreen.
 * Zero React / React Native dependencies so Node unit tests can import and verify directly.
 */

export const HORIZON_BAR_HIDE_SCROLL_Y = 72;
export const HORIZON_BAR_TOP_LOCK_Y = 48;
export const HORIZON_BAR_DOWN_DELTA = 10;
export const HORIZON_BAR_UP_DELTA = 7;

export interface HorizonBarVisibilityParams {
  currentY: number;
  lastY: number;
  contentHeight: number;
  viewportHeight: number;
  currentlyVisible: boolean;
  hasFocusWithin?: boolean;
}

export interface HorizonBarVisibilityResult {
  visible: boolean;
  clampedY: number;
}

/**
 * Evaluates whether the sticky Horizon Switcher bar should be visible based on scroll position
 * and direction, with rubber-band overscroll clamping at both top (y < 0) and bottom (y > maxScroll).
 */
export function evaluateHorizonBarVisibility(
  params: HorizonBarVisibilityParams
): HorizonBarVisibilityResult {
  const {
    currentY,
    lastY,
    contentHeight,
    viewportHeight,
    currentlyVisible,
    hasFocusWithin = false
  } = params;

  const safeContentHeight = Number.isFinite(contentHeight) && contentHeight > 0 ? contentHeight : 0;
  const safeViewportHeight = Number.isFinite(viewportHeight) && viewportHeight > 0 ? viewportHeight : 0;
  const maxScroll = Math.max(0, safeContentHeight - safeViewportHeight);

  const safeCurrentY = Number.isFinite(currentY) ? currentY : 0;
  const safeLastY = Number.isFinite(lastY) ? lastY : 0;

  const clampedY = Math.max(0, Math.min(maxScroll, safeCurrentY));
  const clampedLastY = Math.max(0, Math.min(maxScroll, safeLastY));
  const dy = clampedY - clampedLastY;

  if (hasFocusWithin || clampedY <= HORIZON_BAR_TOP_LOCK_Y) {
    return { visible: true, clampedY };
  }

  if (dy > HORIZON_BAR_DOWN_DELTA && clampedY > HORIZON_BAR_HIDE_SCROLL_Y) {
    return { visible: false, clampedY };
  }

  if (dy < -HORIZON_BAR_UP_DELTA) {
    return { visible: true, clampedY };
  }

  return { visible: currentlyVisible, clampedY };
}

export const PULL_REFRESH_THRESHOLD = 64;
export const PULL_REFRESH_MAX = 108;

export type PullToRefreshPhase = 'idle' | 'pulling' | 'ready' | 'refreshing';

export interface PullToRefreshParams {
  pullDeltaY: number;
  isRefreshing: boolean;
  threshold?: number;
  maxPull?: number;
}

export interface PullToRefreshState {
  pullDistance: number;
  progress: number;
  readyToRelease: boolean;
  phase: PullToRefreshPhase;
}

/**
 * Computes damped pull-to-refresh distance, normalized progress [0..1], release readiness,
 * and discrete visual phase ('idle' | 'pulling' | 'ready' | 'refreshing').
 */
export function evaluatePullToRefreshGesture(
  params: PullToRefreshParams
): PullToRefreshState {
  const {
    pullDeltaY,
    isRefreshing,
    threshold = PULL_REFRESH_THRESHOLD,
    maxPull = PULL_REFRESH_MAX
  } = params;

  if (isRefreshing) {
    return {
      pullDistance: threshold,
      progress: 1,
      readyToRelease: false,
      phase: 'refreshing'
    };
  }

  const safeDelta = Number.isFinite(pullDeltaY) ? pullDeltaY : 0;
  const pullDistance = safeDelta > 4 ? Math.min(maxPull, safeDelta * 0.48) : 0;
  const progress = threshold > 0 ? Math.min(1, pullDistance / threshold) : 0;
  const readyToRelease = pullDistance >= threshold;
  const phase: PullToRefreshPhase =
    pullDistance < 10 ? 'idle' : readyToRelease ? 'ready' : 'pulling';

  return {
    pullDistance,
    progress,
    readyToRelease,
    phase
  };
}

/**
 * Returns true when the initial viewport lock accidentally froze static fallback items
 * ('vault-*' or 'init-*') on cold boot AND at least 10 real, non-fallback items have arrived.
 */
export function shouldUnlockFallbackTopLock(
  lockedIds: string[],
  candidatePool: { id: string; isStaticFallback?: boolean }[]
): boolean {
  if (!Array.isArray(lockedIds) || lockedIds.length === 0) return false;
  const hasLockedFallback = lockedIds.some(
    id => typeof id === 'string' && (id.startsWith('vault-') || id.startsWith('init-'))
  );
  if (!hasLockedFallback) return false;
  if (!Array.isArray(candidatePool) || candidatePool.length < 10) return false;

  let realCount = 0;
  for (const item of candidatePool) {
    if (!item || typeof item.id !== 'string') continue;
    if (item.isStaticFallback === true) continue;
    if (item.id.startsWith('vault-') || item.id.startsWith('init-')) continue;
    realCount += 1;
    if (realCount >= 10) return true;
  }
  return false;
}
