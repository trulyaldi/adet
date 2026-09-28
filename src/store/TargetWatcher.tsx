import { useEffect, useRef } from 'react';

import { useActions } from './StreakStore';
import { useActiveProgress } from './useActiveProgress';

/**
 * Watches the running session and fires the target moment once when today's
 * time on the habit crosses its target marker (not on opening the app
 * already past it). Renders nothing; ticks only while a timer runs.
 */
export function TargetWatcher() {
  const actions = useActions();
  const p = useActiveProgress();
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
  return null;
}
