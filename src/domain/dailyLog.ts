// Today's plan as the app sees it (the planner plus this device's per-day
// edits), how each item stands, and the once-a-day log of plan vs actual.

import { capacityOn } from './capacity';
import { isDone, markIndex, MarkIndex } from './marks';
import { DayPlan, PlanItem, planToday } from './planner';
import { activeHabits } from './projects';
import { addDays, dkey, pkey } from './time';
import { DailyLog, PersistedState } from './types';

/** The plan for `day`, with that day's light/normal/heavy tap, order and set-asides. */
export function planFor(data: PersistedState, day: string): DayPlan {
  const o = data.days[day] ?? {};
  return planToday(
    data.projects,
    activeHabits(data),
    data.sessions,
    { capacityMin: data.prefs.capacityMin, level: o.level },
    day,
    { marks: data.marks, order: o.order, aside: o.aside }
  );
}

/** Seconds per habit on `day` (sessions count on the day they start), plus the running timer when `now` is given. */
export function daySecByHabit(data: PersistedState, day: string, now?: number): Map<string, number> {
  const out = new Map<string, number>();
  for (const s of data.sessions) {
    if (dkey(new Date(s.start)) === day) out.set(s.habitId, (out.get(s.habitId) || 0) + s.duration);
  }
  const a = data.active;
  if (now !== undefined && a && dkey(new Date(now)) === day) {
    const sec = a.baseSec + (a.startedAt ? (now - a.startedAt) / 1000 : 0);
    out.set(a.habitId, (out.get(a.habitId) || 0) + sec);
  }
  return out;
}

export function itemDone(data: PersistedState, idx: MarkIndex, it: PlanItem, day: string, sec: number): boolean {
  const h = data.habits.find((x) => x.id === it.habitId);
  return !!h && isDone(h, idx, day, sec, it.shareMin * 60);
}

/** The log of a finished day. */
export function buildDailyLog(data: PersistedState, day: string): DailyLog {
  const plan = planFor(data, day);
  const secs = daySecByHabit(data, day);
  const idx = markIndex(data.marks);
  let actualSec = 0;
  for (const v of secs.values()) actualSec += v;
  return {
    id: day,
    capacityMin: plan.capacityMin,
    plannedMin: plan.plannedMin,
    actualMin: Math.round(actualSec / 60),
    items: plan.items.map(({ habitId, projectId, shareMin }) => ({ habitId, projectId, shareMin })),
    doneCount: plan.items.filter((it) => itemDone(data, idx, it, day, secs.get(it.habitId) || 0)).length,
  };
}

/** How many past days get a log when the app hasn't been opened for a while. */
const LOG_BACKFILL_DAYS = 14;

/**
 * Logs still to write: every finished day since `since` (at most two weeks
 * back) without one. Each day is logged once; the log is never rewritten.
 */
export function missingLogs(data: PersistedState, today: string, since: string): DailyLog[] {
  const have = new Set(data.dailyLogs.map((l) => l.id));
  const out: DailyLog[] = [];
  const t = pkey(today);
  for (let back = LOG_BACKFILL_DAYS; back >= 1; back--) {
    const k = dkey(addDays(t, -back));
    if (k < since || have.has(k)) continue;
    out.push(buildDailyLog(data, k));
  }
  return out;
}

/** Today's capacity, for display. */
export function todayCapacity(data: PersistedState, day: string): number {
  return capacityOn(data.prefs, day, data.days[day]?.level);
}
