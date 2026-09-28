// The one-time rebalance offered after the update to plans: habits longer
// than half an hour are suggested three times a week instead of every day.

import { Frequency, normalizeFrequency, weeklyTargetOf } from './frequency';
import { Habit, PersistedState } from './types';

/** Habits with a full session longer than this are suggested 3 times a week. */
export const REBALANCE_LONG_MIN = 30;
export const REBALANCE_TIMES = 3;

export function suggestedFrequency(h: Habit): Frequency {
  if (h.dailyTargetMin > REBALANCE_LONG_MIN && weeklyTargetOf(h.frequency) > REBALANCE_TIMES) {
    return { kind: 'weekly', times: REBALANCE_TIMES };
  }
  return h.frequency;
}

/** Estimated average minutes a day: each habit's full length times how often it's due, over 7 days. */
export function averageDailyMin(habits: Habit[], freqOf: (h: Habit) => Frequency = (h) => h.frequency): number {
  let weekly = 0;
  for (const h of habits) weekly += h.dailyTargetMin * weeklyTargetOf(freqOf(h));
  return Math.round(weekly / 7);
}

/**
 * The habits with the chosen frequencies applied. Only habits whose frequency
 * actually changes become new objects (so only they are synced); their
 * weekly minutes target follows for older app versions.
 */
export function applyFrequencies(habits: Habit[], chosen: Record<string, Frequency>): Habit[] {
  return habits.map((h) => {
    const f = chosen[h.id] ? normalizeFrequency(chosen[h.id]) : null;
    if (!f || JSON.stringify(f) === JSON.stringify(h.frequency)) return h;
    return { ...h, frequency: f, weeklyTargetMin: h.dailyTargetMin * weeklyTargetOf(f) };
  });
}

/**
 * Close the rebalance for good: apply the chosen frequencies (or keep all as
 * is with null). When anything changed, today's plan (made with the old
 * frequencies) is dropped so it's suggested again.
 */
export function finishRebalance(d: PersistedState, chosen: Record<string, Frequency> | null, today: string): PersistedState {
  if (!chosen) return { ...d, rebalancePending: false };
  const habits = applyFrequencies(d.habits, chosen);
  if (habits.every((h, i) => h === d.habits[i])) return { ...d, rebalancePending: false };
  const { [today]: _old, ...plans } = d.plans;
  return { ...d, habits, plans, rebalancePending: false };
}
