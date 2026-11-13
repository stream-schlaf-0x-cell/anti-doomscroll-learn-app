export interface FeedPresentation<T> {
  scope: string;
  items: T[];
}

export function holdFeedPresentation<T>(
  previous: FeedPresentation<T>,
  latest: FeedPresentation<T>,
  reading: boolean
): FeedPresentation<T> {
  return reading && previous.scope === latest.scope ? previous : latest;
}

export function formatCurationLabel(curatedAt?: string): string {
  if (!curatedAt) return 'Kuratiert';
  const date = new Date(curatedAt);
  if (isNaN(date.getTime())) return 'Kuratiert';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `Kuratiert am ${day}.${month}.`;
}

/**
 * Prepends newly revealed items guaranteed at the top of the feed without duplicate IDs.
 */
export function prependRevealedItems<T extends { id: string }>(
  items: T[],
  revealedItems: T[]
): T[] {
  if (revealedItems.length === 0) return items;
  const revealedIds = new Set(revealedItems.map(i => i.id));
  const remaining = items.filter(i => !revealedIds.has(i.id));
  return [...revealedItems, ...remaining];
}

export interface ScrollFreezeResult<T extends { id: string }> {
  items: T[];
  queuedArrivals: T[];
}

/**
 * Hard Scroll-Freeze:
 * When scrollOffsetY > threshold (default 80px), freezes the visible item order
 * to prevent background re-orders or prepends from shifting the screen.
 * In-place card updates (upvotes, bookmarks) are applied cleanly, while new
 * background arrivals are queued into queuedArrivals.
 */
export function applyScrollFreeze<T extends { id: string }>(
  currentRendered: T[],
  incomingItems: T[],
  scrollOffsetY: number,
  existingQueuedArrivals: T[] = [],
  threshold = 80
): ScrollFreezeResult<T> {
  if (scrollOffsetY <= threshold || currentRendered.length === 0) {
    return {
      items: incomingItems,
      queuedArrivals: []
    };
  }

  // Scrolled down (scrollOffsetY > threshold): FREEZE visible order against top insertions
  const currentIdSet = new Set(currentRendered.map(i => i.id));
  const incomingMap = new Map(incomingItems.map(i => [i.id, i]));

  // Locate the furthest rendered index in incomingItems so pure tail appends (infinite scroll pagination)
  // extend cleanly below the viewport instead of being mistaken for "new top arrivals".
  let maxRenderedIdx = -1;
  for (let i = 0; i < incomingItems.length; i++) {
    if (currentIdSet.has(incomingItems[i].id)) {
      maxRenderedIdx = i;
    }
  }

  // In-place updates for already rendered items (preserves exact order)
  const frozenItems: T[] = currentRendered.map(item => {
    return incomingMap.get(item.id) || item;
  });

  const tailAppends: T[] = [];
  const topArrivals: T[] = [];
  for (let i = 0; i < incomingItems.length; i++) {
    const candidate = incomingItems[i];
    if (currentIdSet.has(candidate.id)) continue;
    if (maxRenderedIdx >= 0 && i > maxRenderedIdx) {
      tailAppends.push(candidate);
    } else {
      topArrivals.push(candidate);
    }
  }

  const existingQueuedIds = new Set(existingQueuedArrivals.map(i => i.id));
  const newlyQueued = topArrivals.filter(item => !existingQueuedIds.has(item.id));

  return {
    items: tailAppends.length > 0 ? [...frozenItems, ...tailAppends] : frozenItems,
    queuedArrivals: [...existingQueuedArrivals, ...newlyQueued]
  };
}

export interface InitialViewportLockResult<T extends { id: string }> {
  lockedOrderIds: string[];
  hasCommittedInitialViewport: boolean;
  orderedItems: T[];
  queuedArrivals: T[];
}

/**
 * Initial Viewport Lock (Zero-Flicker Boot):
 * Commits `lockedOrderIds` immediately on the very first non-empty render (`incomingItems.length > 0`)
 * EVEN when `scrollOffsetY === 0` at the top of the screen.
 * Subsequent background arrivals are queued into `queuedArrivals` instead of replacing or reordering
 * the user's visible top viewport cards.
 */
export function applyInitialViewportLock<T extends { id: string }>(
  currentLockedOrderIds: string[],
  hasCommittedInitialViewport: boolean,
  incomingItems: T[],
  existingQueuedArrivals: T[] = [],
  lockCount: number = 12
): InitialViewportLockResult<T> {
  if (incomingItems.length === 0) {
    return {
      lockedOrderIds: currentLockedOrderIds,
      hasCommittedInitialViewport,
      orderedItems: [],
      queuedArrivals: existingQueuedArrivals
    };
  }

  // First non-empty render in this scope: commit initial viewport order immediately at scrollOffsetY >= 0
  if (!hasCommittedInitialViewport || currentLockedOrderIds.length === 0) {
    const initialIds = incomingItems.slice(0, lockCount).map(item => item.id);
    return {
      lockedOrderIds: initialIds,
      hasCommittedInitialViewport: true,
      orderedItems: incomingItems,
      queuedArrivals: existingQueuedArrivals
    };
  }

  const lockedSet = new Set(currentLockedOrderIds);
  const incomingMap = new Map(incomingItems.map(item => [item.id, item]));

  // Keep locked top cards in their exact committed order (allowing in-place enrichment updates)
  const lockedTopCards: T[] = [];
  for (const id of currentLockedOrderIds) {
    const match = incomingMap.get(id);
    if (match) {
      lockedTopCards.push(match);
    }
  }

  // Any new items that tried to enter the top `lockCount` slots are queued into `queuedArrivals`
  const incomingTopNew = incomingItems.slice(0, lockCount).filter(item => !lockedSet.has(item.id));
  const existingQueuedIds = new Set(existingQueuedArrivals.map(item => item.id));
  const newlyQueued = incomingTopNew.filter(item => !existingQueuedIds.has(item.id));
  const nextQueued = [...existingQueuedArrivals, ...newlyQueued];
  const queuedIdSet = new Set(nextQueued.map(item => item.id));

  // Remaining tail items follow after the locked top viewport
  const tailCards = incomingItems.filter(item => !lockedSet.has(item.id) && !queuedIdSet.has(item.id));

  return {
    lockedOrderIds: currentLockedOrderIds,
    hasCommittedInitialViewport: true,
    orderedItems: [...lockedTopCards, ...tailCards],
    queuedArrivals: nextQueued
  };
}

