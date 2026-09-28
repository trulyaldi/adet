import { useMemo } from 'react';

import { planFor } from '../domain/dailyLog';
import { streakV5, StreakV5 } from '../domain/streaks';
import { dkey } from '../domain/time';
import { useStreak } from './StreakStore';

/**
 * The day streak (forgiving v5 rules, the pre-redesign streak as a floor)
 * and each day's mark. Recomputed when data changes or the day turns.
 */
export function useDayStreak(): StreakV5 {
  const { data, now } = useStreak();
  const day = dkey(new Date(now));
  return useMemo(() => streakV5(data, day, data.streakCarry, planFor(data, day).items.length === 0), [data, day]);
}
