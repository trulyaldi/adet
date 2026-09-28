// Streaks. A streak day is any local day with tracked time. Daily streaks are
// forgiving: each calendar month allows FREEZES_PER_MONTH freezes, each
// bridging exactly one missed day between tracked days; a frozen day keeps the
// streak alive but doesn't add to it. Freezes are derived from history, never
// stored, so every device agrees. Weekly target streaks count consecutive
// weeks (Monday to Sunday, local) that met a project's weekly target.

import { weeklyTargetOf } from './frequency';
import { completionOn, HabitDays, pickPlan, planFor, PlanSettings } from './plan';
import { activeHabits } from './projects';
import { addDays, dkey, monday, pkey } from './time';
import { Habit, PersistedState, StreakCarry } from './types';

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
  // Every day key from the first tracked day to today, built with one Date.
  const all: string[] = [];
  for (const d = pkey(keys[0]); ; d.setDate(d.getDate() + 1)) {
    const k = dkey(d);
    all.push(k);
    if (k >= today) break;
  }

  let run = 0;
  let longest = 0;
  let atRisk = false;
  for (let i = 0; i < all.length; i++) {
    const k = all[i];
    if (tracked(k)) {
      run++;
      longest = Math.max(longest, run);
      continue;
    }
    if (k === today) break; // today is still in progress
    const next = all[i + 1];
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
  // Sum a week's seven days on demand: the walk stops at the first missed week,
  // so this stays cheap however long the history is.
  const met = (w: Date) => {
    let sec = 0;
    for (let i = 0; i < 7; i++) sec += dayMap[dkey(addDays(w, i))] || 0;
    return sec >= targetSec;
  };

  let w = monday(new Date(now));
  let streak = 0;
  if (met(w)) streak++;
  for (w = addDays(w, -7); met(w); w = addDays(w, -7)) streak++;
  return streak;
}

// ---------------------------------------------------------------------------
// Plan-based days (schema v4)
// ---------------------------------------------------------------------------

/**
 * How a day went. `complete`: every planned habit done (full or minimum);
 * `free`: nothing was planned (weekly targets met, or nothing fit); `open`:
 * the plan wasn't finished. Days before plans existed (before `planSince`)
 * are complete when anything was tracked.
 */
export type DayState = 'complete' | 'free' | 'open';

export interface DayRecord {
  key: string;
  state: DayState;
  /** The day's plan, or null for a day judged by the old any-time rule. */
  plan: string[] | null;
  /** Planned habits done that day. */
  done: number;
}

/**
 * Every day from the first tracked day to `today` (inclusive), judged. A day
 * with a stored plan is judged by it; a day since `planSince` without one (the
 * app wasn't opened) gets the plan it would have been given that morning, so
 * skipping the app never counts as a free day.
 */
export function dayRecords(data: PersistedState, days: HabitDays, today: string, settings: PlanSettings): DayRecord[] {
  let first = today;
  for (const m of days.values()) for (const [k, sec] of m) if (sec > 0 && k < first) first = k;
  const habits = activeHabits(data);
  const byId = new Map(data.habits.map((h) => [h.id, h]));
  const weekDone = new Map<string, number>();
  const lastDone = new Map<string, string>();
  const out: DayRecord[] = [];

  for (const d = pkey(first); ; d.setDate(d.getDate() + 1)) {
    const k = dkey(d);
    if (d.getDay() === 1) weekDone.clear();
    let rec: DayRecord;
    if (k < data.planSince) {
      let any = false;
      for (const m of days.values()) if ((m.get(k) || 0) > 0) any = true;
      rec = { key: k, state: any ? 'complete' : 'open', plan: null, done: 0 };
    } else {
      const plan =
        k === today
          ? planFor(data, days, k, settings)
          : data.plans[k]?.filter((id) => byId.has(id)) ??
            pickPlan(
              habits.map((habit) => ({ habit, done: weekDone.get(habit.id) ?? 0, lastDone: lastDone.get(habit.id) ?? null })),
              k,
              settings
            );
      const done = plan.filter((id) => completionOn(byId.get(id)!, days, k)).length;
      rec = { key: k, state: !plan.length ? 'free' : done === plan.length ? 'complete' : 'open', plan, done };
    }
    out.push(rec);
    for (const h of data.habits) {
      if (!completionOn(h, days, k)) continue;
      weekDone.set(h.id, (weekDone.get(h.id) ?? 0) + 1);
      lastDone.set(h.id, k);
    }
    if (k >= today) break;
  }
  return out;
}

/** How a day shows in history: `rest` is the week's forgiven day (a moon); `today` is still in progress. */
export type DayMark = 'complete' | 'rest' | 'free' | 'open' | 'today';

export interface PlanStreak {
  /** Complete days in a row (rest and free days keep it going without adding). */
  current: number;
  longest: number;
  /** dkey → how the day shows. */
  marks: Map<string, DayMark>;
}

/**
 * The main streak over judged days (oldest first, ending with today). A
 * complete day adds one; a free day neither adds nor breaks; the first
 * unfinished day of each Monday-to-Sunday week is a rest day (a moon) and
 * doesn't break it either; another unfinished day in the same week does.
 * Today, while unfinished, is in progress and breaks nothing.
 *
 * `carry` is the streak under the old rules on the migration day: while the
 * streak hasn't broken since then, it never shows less than that plus the
 * complete days after it.
 */
export function planStreak(records: DayRecord[], today: string, carry: StreakCarry | null): PlanStreak {
  const marks = new Map<string, DayMark>();
  let run = 0;
  let longest = 0;
  let lastBreak: string | null = null;
  let restWeek: string | null = null;
  let completeSinceCarry = 0;

  for (const r of records) {
    const complete = r.state === 'complete';
    if (complete) {
      run++;
      longest = Math.max(longest, run);
      if (carry && r.key > carry.day) completeSinceCarry++;
      marks.set(r.key, 'complete');
    } else if (r.state === 'free') {
      marks.set(r.key, 'free');
    } else if (r.key === today) {
      marks.set(r.key, 'today');
    } else {
      const week = dkey(monday(pkey(r.key)));
      if (restWeek !== week) {
        restWeek = week;
        marks.set(r.key, 'rest');
      } else {
        run = 0;
        lastBreak = r.key;
        marks.set(r.key, 'open');
      }
    }
  }

  let current = run;
  if (carry && (lastBreak === null || lastBreak < carry.day)) {
    current = Math.max(run, carry.current + completeSinceCarry);
  }
  longest = Math.max(longest, current, carry?.longest ?? 0);
  return { current, longest, marks };
}

/**
 * Consecutive weeks in which the habit hit its weekly target (days done,
 * bonus days included). The current week counts once met and never breaks
 * the streak while in progress.
 */
export function habitWeekStreak(h: Habit, days: HabitDays, today: string): number {
  const target = weeklyTargetOf(h.frequency);
  const met = (mon: Date) => {
    let n = 0;
    for (let i = 0; i < 7; i++) if (completionOn(h, days, dkey(addDays(mon, i)))) n++;
    return n >= target;
  };
  let w = monday(pkey(today));
  let streak = met(w) ? 1 : 0;
  // Stop at the first week before any tracked time (and after ~10 years at most).
  for (let i = 0; i < 520; i++) {
    w = addDays(w, -7);
    if (!met(w)) break;
    streak++;
  }
  return streak;
}
