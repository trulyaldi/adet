// Streaks. A streak day is any local day with tracked time. Daily streaks are
// forgiving: each calendar month allows FREEZES_PER_MONTH freezes, each
// bridging exactly one missed day between tracked days; a frozen day keeps the
// streak alive but doesn't add to it. Freezes are derived from history, never
// stored, so every device agrees. Weekly target streaks count consecutive
// weeks (Monday to Sunday, local) that met a project's weekly target.

import { addDays, dkey, monday, pkey } from './time';

export const FREEZES_PER_MONTH = 2;

export interface DailyStreak {
  /** Tracked days in the current streak (frozen days don't count). */
  current: number;
  /** Longest streak in history, under the same rules. */
  longest: number;
  /**
   * Yesterday was missed and today has no time yet, but a freeze can cover
   * yesterday: the streak is alive only if something is tracked today.
   */
  atRisk: boolean;
  /** Freezes left in the current calendar month. */
  freezesLeft: number;
}

const monthOf = (k: string) => k.slice(0, 7);

/** Daily streak with freezes over a day → seconds map (see daySecMap). */
export function dailyStreak(dayMap: Record<string, number>, now: number): DailyStreak {
  const today = dkey(new Date(now));
  const thisMonth = monthOf(today);
  const tracked = (k: string) => (dayMap[k] || 0) > 0;
  const keys = Object.keys(dayMap).filter((k) => tracked(k) && k <= today).sort();
  if (!keys.length) return { current: 0, longest: 0, atRisk: false, freezesLeft: FREEZES_PER_MONTH };

  const used: Record<string, number> = {};
  const canFreeze = (k: string) => (used[monthOf(k)] || 0) < FREEZES_PER_MONTH;
  let run = 0;
  let longest = 0;
  let atRisk = false;
  for (let d = pkey(keys[0]); dkey(d) <= today; d = addDays(d, 1)) {
    const k = dkey(d);
    if (tracked(k)) {
      run++;
      longest = Math.max(longest, run);
      continue;
    }
    if (k === today) break; // today is still in progress
    const next = dkey(addDays(d, 1));
    if (run > 0 && canFreeze(k)) {
      if (tracked(next)) {
        used[monthOf(k)] = (used[monthOf(k)] || 0) + 1;
        continue;
      }
      if (next === today) {
        // Yesterday missed, today not tracked yet: alive but at risk. The
        // freeze is applied once today is tracked (the branch above).
        atRisk = true;
        break;
      }
    }
    run = 0;
  }

  return {
    current: run,
    longest,
    atRisk,
    freezesLeft: Math.max(0, FREEZES_PER_MONTH - (used[thisMonth] || 0)),
  };
}

/**
 * Consecutive weeks that met `targetHours`. The current week counts once met
 * and never breaks the streak while in progress. No usable target: 0.
 */
export function weeklyTargetStreak(dayMap: Record<string, number>, targetHours: number, now: number): number {
  if (!Number.isFinite(targetHours) || targetHours <= 0) return 0;
  const targetSec = targetHours * 3600;
  const weekSec: Record<string, number> = {};
  for (const k of Object.keys(dayMap)) {
    const w = dkey(monday(pkey(k)));
    weekSec[w] = (weekSec[w] || 0) + dayMap[k];
  }
  const met = (w: Date) => (weekSec[dkey(w)] || 0) >= targetSec;

  let w = monday(new Date(now));
  let streak = 0;
  if (met(w)) streak++;
  for (w = addDays(w, -7); met(w); w = addDays(w, -7)) streak++;
  return streak;
}
