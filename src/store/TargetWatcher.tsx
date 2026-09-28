import { useEffect, useRef, useState } from 'react';

import { useAppActive } from '../theme/useMotion';
import { useActions } from './StreakStore';
import { useActiveProgress } from './useActiveProgress';

/**
 * Watches the running session and fires the target moment once when today's
 * time on the habit crosses its target marker (not on opening the app
 * already past it). Renders nothing. Instead of ticking every second it
 * wakes at the crossing, on data changes (a pull can jump past it) and on
 * returning to the app.
 */
export function TargetWatcher() {
  const actions = useActions();
  const [, setWake] = useState(0);
  useAppActive();
  const p = useActiveProgress(0);
  const last = useRef<{ key: string; sec: number } | null>(null);
  useEffect(() => {
    if (!p) {
      last.current = null;
      return;
    }
    const key = p.habitId + ':' + new Date().toDateString() + ':' + p.targetSec;
    const prev = last.current;
    last.current = { key, sec: p.sec };
    if (prev && prev.key === key && prev.sec < p.targetSec && p.sec >= p.targetSec) actions.targetReached(p.habitId);
  }, [p, actions]);

  const msToTarget = p && !p.paused && p.sec < p.targetSec ? (p.targetSec - p.sec) * 1000 : null;
  useEffect(() => {
    if (msToTarget === null) return;
    // A little past the mark, so the next render is surely across it.
    const t = setTimeout(() => setWake((w) => w + 1), msToTarget + 250);
    return () => clearTimeout(t);
  }, [msToTarget]);
  return null;
}
