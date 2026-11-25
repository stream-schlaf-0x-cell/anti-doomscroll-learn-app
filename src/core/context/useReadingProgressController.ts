import { useCallback, useEffect, useRef } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { ReadingInteraction } from '../domain/types';
import { libraryRepository } from '../data/libraryRepository';

export interface UseReadingProgressControllerParams {
  latestInteractionsRef: MutableRefObject<Record<string, ReadingInteraction>>;
  setInteractions: Dispatch<SetStateAction<Record<string, ReadingInteraction>>>;
  storageGenerationRef: MutableRefObject<number>;
  onArticleCompleted?: (itemId: string) => void;
}

export interface ReadingProgressController {
  updateReadingProgress: (id: string, percent: number) => Promise<void>;
  flushReadingProgress: () => Promise<void>;
  cancelPendingReadingProgress: () => void;
}

/**
 * Manages optimistic UI updates and 800ms-debounced persistence of article reading progress,
 * guarded by a storage generation counter so full resets cleanly discard stale writes.
 */
export function useReadingProgressController({
  latestInteractionsRef,
  setInteractions,
  storageGenerationRef,
  onArticleCompleted
}: UseReadingProgressControllerParams): ReadingProgressController {
  const pendingProgressRef = useRef<{ id: string; percent: number } | null>(null);
  const progressDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prePendingCompletionEligibleRef = useRef<Record<string, boolean>>({});
  const completedNotifiedIdsRef = useRef<Set<string>>(new Set());
  const onArticleCompletedRef = useRef(onArticleCompleted);
  onArticleCompletedRef.current = onArticleCompleted;

  const cancelPendingReadingProgress = useCallback(() => {
    if (progressDebounceTimerRef.current) {
      clearTimeout(progressDebounceTimerRef.current);
      progressDebounceTimerRef.current = null;
    }
    pendingProgressRef.current = null;
    prePendingCompletionEligibleRef.current = {};
    completedNotifiedIdsRef.current.clear();
  }, []);

  // Flush pending reading progress immediately to persistent storage
  const flushReadingProgress = useCallback(async () => {
    if (progressDebounceTimerRef.current) {
      clearTimeout(progressDebounceTimerRef.current);
      progressDebounceTimerRef.current = null;
    }
    const pending = pendingProgressRef.current;
    if (pending) {
      pendingProgressRef.current = null;
      const prevExisting = latestInteractionsRef.current[pending.id];
      const wasEligible =
        Boolean(prePendingCompletionEligibleRef.current[pending.id]) ||
        (!prevExisting?.completedAt && (prevExisting?.furthestPositionPercent ?? 0) < 95);
      delete prePendingCompletionEligibleRef.current[pending.id];
      try {
        const updated = await libraryRepository.updateProgress(pending.id, pending.percent);
        setInteractions(prev => {
          const next = { ...prev, [pending.id]: updated };
          latestInteractionsRef.current = next;
          return next;
        });
        if (pending.percent >= 95 && wasEligible && !completedNotifiedIdsRef.current.has(pending.id)) {
          completedNotifiedIdsRef.current.add(pending.id);
          onArticleCompletedRef.current?.(pending.id);
        }
      } catch (err) {
        console.warn('Lesefortschritt konnte nicht persistiert werden:', err);
      }
    }
  }, [latestInteractionsRef, setInteractions]);

  // Throttled reading progress write (bounds write rate to max 1 write / 800ms while scrolling)
  const updateReadingProgress = useCallback(
    async (id: string, percent: number) => {
      pendingProgressRef.current = { id, percent };
      const currentGen = storageGenerationRef.current;

      const prevExisting = latestInteractionsRef.current[id];
      if (
        prevExisting === undefined ||
        (!prevExisting.completedAt && (prevExisting.furthestPositionPercent ?? 0) < 95)
      ) {
        prePendingCompletionEligibleRef.current[id] = true;
      }

      // Update React state optimistically so progress bar is instant
      setInteractions(prev => {
        const existing = prev[id] ?? {
          itemId: id,
          saved: false,
          progressPercent: 0,
          furthestPositionPercent: 0
        };
        const next = {
          ...prev,
          [id]: {
            ...existing,
            progressPercent: Math.max(existing.progressPercent, percent),
            furthestPositionPercent: Math.max(existing.furthestPositionPercent ?? 0, percent)
          }
        };
        latestInteractionsRef.current = next;
        return next;
      });

      if (progressDebounceTimerRef.current) {
        clearTimeout(progressDebounceTimerRef.current);
      }

      progressDebounceTimerRef.current = setTimeout(async () => {
        progressDebounceTimerRef.current = null;
        if (currentGen !== storageGenerationRef.current) return;
        const pending = pendingProgressRef.current;
        if (pending) {
          pendingProgressRef.current = null;
          const prevBeforeWrite = latestInteractionsRef.current[pending.id];
          const wasEligible =
            Boolean(prePendingCompletionEligibleRef.current[pending.id]) ||
            (!prevBeforeWrite?.completedAt && (prevBeforeWrite?.furthestPositionPercent ?? 0) < 95);
          delete prePendingCompletionEligibleRef.current[pending.id];
          try {
            const updated = await libraryRepository.updateProgress(pending.id, pending.percent);
            if (currentGen === storageGenerationRef.current) {
              setInteractions(prev => {
                const next = { ...prev, [pending.id]: updated };
                latestInteractionsRef.current = next;
                return next;
              });
              if (
                pending.percent >= 95 &&
                wasEligible &&
                !completedNotifiedIdsRef.current.has(pending.id)
              ) {
                completedNotifiedIdsRef.current.add(pending.id);
                onArticleCompletedRef.current?.(pending.id);
              }
            }
          } catch {
            // Non-fatal background write
          }
        }
      }, 800);
    },
    [latestInteractionsRef, setInteractions, storageGenerationRef]
  );

  useEffect(() => {
    return () => {
      if (progressDebounceTimerRef.current) {
        clearTimeout(progressDebounceTimerRef.current);
        progressDebounceTimerRef.current = null;
      }
    };
  }, []);

  return {
    updateReadingProgress,
    flushReadingProgress,
    cancelPendingReadingProgress
  };
}
