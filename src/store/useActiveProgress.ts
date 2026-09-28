import { useMemo } from 'react';

import { ActiveProgress, activeProgress } from '../domain/day';
import { useData } from './StreakStore';
import { useNow } from './useNow';

/** How often screens around a running timer refresh (the clock text ticks on its own). */
export const TIMER_FRAME_MS = 15_000;

/**
 * The running session against its target. The plan (for the target) is
 * worked out once per data change; the seconds then come from the timer's
 * timestamps at render time, so they're right after a lock or background.
 * Re-renders every `tickMs` while running (0: only on data changes and
 * whenever the caller re-renders), and right away on returning to the app.
 */
export function useActiveProgress(tickMs: number): ActiveProgress | null {
  const data = useData();
  const running = !!data.active?.startedAt;
  useNow(tickMs, tickMs > 0 && running);
  const base = useMemo(() => {
    const at = Date.now();
    return { at, p: activeProgress(data, at) };
  }, [data]);
  if (!base.p) return null;
  if (base.p.paused) return base.p;
  const extra = Math.max(0, (Date.now() - base.at) / 1000);
  return { ...base.p, sec: base.p.sec + extra, sessionSec: base.p.sessionSec + extra };
}
