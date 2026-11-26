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

export const PULL_REFRESH_DEADZONE = 24;
export const PULL_REFRESH_DAMPING = 0.32;
export const PULL_REFRESH_THRESHOLD = 104;
export const PULL_REFRESH_MAX = 148;
export const PULL_REFRESH_HOLD_MS = 350;
export const PULL_REFRESH_TOP_SETTLE_MS = 450;

export type PullToRefreshPhase = 'idle' | 'pulling' | 'holding' | 'ready' | 'refreshing';

export interface PullToRefreshParams {
  pullDeltaY: number;
  isRefreshing: boolean;
  holdElapsedMs?: number;
  threshold?: number;
  maxPull?: number;
  deadzone?: number;
  holdMs?: number;
}

export interface PullToRefreshState {
  pullDistance: number;
  progress: number;
  readyToRelease: boolean;
  phase: PullToRefreshPhase;
}

/**
 * Computes damped pull-to-refresh distance, normalized progress [0..1], release readiness,
 * and discrete visual phase ('idle' | 'pulling' | 'holding' | 'ready' | 'refreshing').
 */
export function evaluatePullToRefreshGesture(
  params: PullToRefreshParams
): PullToRefreshState {
  const {
    pullDeltaY,
    isRefreshing,
    holdElapsedMs,
    threshold = PULL_REFRESH_THRESHOLD,
    maxPull = PULL_REFRESH_MAX,
    deadzone = PULL_REFRESH_DEADZONE,
    holdMs = PULL_REFRESH_HOLD_MS
  } = params;

  if (isRefreshing) {
    return {
      pullDistance: threshold,
      progress: 1,
      readyToRelease: false,
      phase: 'refreshing'
    };
  }

  if (!Number.isFinite(pullDeltaY) || pullDeltaY <= deadzone) {
    return {
      pullDistance: 0,
      progress: 0,
      readyToRelease: false,
      phase: 'idle'
    };
  }

  const pullDistance = Math.min(maxPull, (pullDeltaY - deadzone) * PULL_REFRESH_DAMPING);
  const progress = threshold > 0 ? Math.min(1, pullDistance / threshold) : 0;

  if (pullDistance >= threshold) {
    if (typeof holdElapsedMs === 'number' && holdElapsedMs < holdMs) {
      return {
        pullDistance,
        progress,
        readyToRelease: false,
        phase: 'holding'
      };
    }
    return {
      pullDistance,
      progress,
      readyToRelease: true,
      phase: 'ready'
    };
  }

  return {
    pullDistance,
    progress,
    readyToRelease: false,
    phase: 'pulling'
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
