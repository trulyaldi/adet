import { useMemo } from 'react';

import { habitDaySec } from '../domain/plan';
import { dayRecords, planStreak } from '../domain/streaks';
import { dkey } from '../domain/time';
import { useStreak } from './StreakStore';

/**
 * The main (plan-based) streak and the longest one, carry included. Walking
 * the whole history is too much for every one-second tick, so it's
 * recomputed when data or settings change, the day turns, or a minute passes
 * (a running timer can finish today's plan).
 */
export function usePlanStreak(): { current: number; longest: number } {
  const { data, now, settings } = useStreak();
  const day = dkey(new Date(now));
  const minute = data.active ? Math.floor(now / 60_000) : 0;
  return useMemo(() => {
    const t = Date.now();
    const s = planStreak(
      dayRecords(data, habitDaySec(data, t), day, { budgetMin: settings.budgetMin, planCap: settings.planCap }),
      day,
      data.streakCarry
    );
    return { current: s.current, longest: s.longest };
  }, [data, day, minute, settings.budgetMin, settings.planCap]);
}
