import { useMemo } from 'react';

import { ActiveProgress, activeProgress } from '../domain/day';
import { useData } from './StreakStore';
import { useNow } from './useNow';

/**
 * The running session against its target, live to the second. The plan
 * (for the target) is worked out once per data change; the seconds then
 * advance from the timer's timestamps, so this stays cheap every tick.
 */
export function useActiveProgress(enabled = true): ActiveProgress | null {
  const data = useData();
  const running = !!data.active?.startedAt;
  const now = useNow(1000, enabled && running);
  const base = useMemo(() => {
    const at = Date.now();
    return { at, p: activeProgress(data, at) };
  }, [data]);
  if (!base.p) return null;
  if (base.p.paused) return base.p;
  const extra = Math.max(0, (now - base.at) / 1000);
  return { ...base.p, sec: base.p.sec + extra, sessionSec: base.p.sessionSec + extra };
}
