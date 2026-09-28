import { dayStreakOf } from '../domain/selectors';
import { StreakV5 } from '../domain/streaks';
import { dkey } from '../domain/time';
import { useData, useStoreNow } from './StreakStore';

/**
 * The day streak (forgiving v5 rules, the pre-redesign streak as a floor)
 * and each day's mark. Recomputed when data changes or the day turns.
 */
export function useDayStreak(): StreakV5 {
  const data = useData();
  const now = useStoreNow();
  const day = dkey(new Date(now));
  // Shared: every caller in a render gets the same computed streak.
  return dayStreakOf(data, day);
}
