// A day's plan: a few habits that fit the daily time budget. Completion is
// derived from tracked time, never stored: a habit is done on a day once that
// day's time on it reaches its minimum, and done in full once it reaches its
// full length. So manual logs, edits and synced sessions all count the same way.

import { isFixedOn, weekdayIndex, weeklyTargetOf } from './frequency';
import { activeHabits } from './projects';
import { addDays, dkey, monday, pkey } from './time';
import { Habit, PersistedState } from './types';

// ---------- settings ----------
export const DEFAULT_BUDGET_MIN = 60;
export const BUDGET_MIN_MIN = 15;
export const BUDGET_MAX_MIN = 180;
export const BUDGET_STEP_MIN = 15;
export const DEFAULT_PLAN_CAP = 3;
export const PLAN_CAP_MAX = 5;

/** A stored budget as 15..180 minutes in 15-minute steps (default 60). */
export function clampBudgetMin(v: unknown): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return DEFAULT_BUDGET_MIN;
  const stepped = Math.round(v / BUDGET_STEP_MIN) * BUDGET_STEP_MIN;
  return Math.min(BUDGET_MAX_MIN, Math.max(BUDGET_MIN_MIN, stepped));
}

/** A stored plan cap as 1..5 habits (default 3). */
export function clampPlanCap(v: unknown): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return DEFAULT_PLAN_CAP;
  return Math.min(PLAN_CAP_MAX, Math.max(1, Math.round(v)));
}

export interface PlanSettings {
  budgetMin: number;
  planCap: number;
}

// ---------- tracked time ----------
/** habitId → dkey → seconds tracked that day. */
export type HabitDays = Map<string, Map<string, number>>;

/**
 * Seconds per habit per local day from saved sessions, plus the running
 * timer (counted on today) when `now` is given. Sessions count on the day
 * they start, like everywhere else.
 */
export function habitDaySec(data: PersistedState, now?: number): HabitDays {
  const out: HabitDays = new Map();
  const add = (hid: string, k: string, sec: number) => {
    let m = out.get(hid);
    if (!m) out.set(hid, (m = new Map()));
    m.set(k, (m.get(k) || 0) + sec);
  };
  for (const s of data.sessions) add(s.habitId, dkey(new Date(s.start)), s.duration);
  const a = data.active;
  if (now !== undefined && a) add(a.habitId, dkey(new Date(now)), a.baseSec + (a.startedAt ? (now - a.startedAt) / 1000 : 0));
  return out;
}

export type Completion = 'full' | 'min';

/** 'full' at the full length, 'min' at the minimum, else null. */
export function completionOf(h: Habit, sec: number): Completion | null {
  if (sec >= h.dailyTargetMin * 60) return 'full';
  if (sec >= h.minTargetMin * 60) return 'min';
  return null;
}

export function completionOn(h: Habit, days: HabitDays, k: string): Completion | null {
  return completionOf(h, days.get(h.id)?.get(k) ?? 0);
}

/** dkeys of the Monday-to-Sunday week containing `k`. */
export function weekKeys(k: string): string[] {
  const mon = monday(pkey(k));
  return Array.from({ length: 7 }, (_, i) => dkey(addDays(mon, i)));
}

/** Days in `k`'s week, before `k`, on which the habit was done. */
export function doneBefore(h: Habit, days: HabitDays, k: string): number {
  let n = 0;
  for (const w of weekKeys(k)) {
    if (w >= k) break;
    if (completionOn(h, days, w)) n++;
  }
  return n;
}

/** Days in `k`'s week, up to and including `k`, on which the habit was done. */
export function doneThrough(h: Habit, days: HabitDays, k: string): number {
  return doneBefore(h, days, k) + (completionOn(h, days, k) ? 1 : 0);
}

/** The latest day before `k` the habit was done, or null. */
export function lastDoneBefore(h: Habit, days: HabitDays, k: string): string | null {
  let last: string | null = null;
  for (const [d, sec] of days.get(h.id) ?? []) {
    if (d < k && (last === null || d > last) && completionOf(h, sec)) last = d;
  }
  return last;
}

// ---------- suggestion ----------
/** What the planner knows about a habit at the start of a day. */
export interface PlanInput {
  habit: Habit;
  /** Done days earlier this week. */
  done: number;
  /** Latest day it was done before this one; null if never. */
  lastDone: string | null;
}

/**
 * Pick a day's plan, in priority order:
 *  1. habits fixed to this weekday,
 *  2. every-day habits,
 *  3. times-per-week habits furthest behind, weighted by how few days are left.
 * Habits whose weekly target is already met aren't due. Within a tier the
 * least recently done comes first, so a long list rotates instead of showing
 * the same few habits every day. Habits are added while they fit: never more
 * than `planCap` of them, never more full minutes than the budget.
 */
export function pickPlan(inputs: PlanInput[], day: string, settings: PlanSettings): string[] {
  const weekday = weekdayIndex(pkey(day));
  const daysLeft = 7 - weekday;
  const ranked: { id: string; tier: number; urgency: number; lastDone: string; order: number; full: number }[] = [];
  inputs.forEach(({ habit: h, done, lastDone }, order) => {
    const f = h.frequency;
    const remaining = weeklyTargetOf(f) - done;
    if (remaining <= 0) return;
    let tier: number;
    if (f.kind === 'days') {
      if (!isFixedOn(f, weekday)) return;
      tier = 0;
    } else tier = f.kind === 'daily' ? 1 : 2;
    ranked.push({ id: h.id, tier, urgency: remaining / daysLeft, lastDone: lastDone ?? '', order, full: h.dailyTargetMin });
  });
  ranked.sort(
    (a, b) =>
      a.tier - b.tier ||
      b.urgency - a.urgency ||
      (a.lastDone < b.lastDone ? -1 : a.lastDone > b.lastDone ? 1 : 0) ||
      a.order - b.order
  );
  const plan: string[] = [];
  let used = 0;
  for (const r of ranked) {
    if (plan.length >= settings.planCap) break;
    if (used + r.full > settings.budgetMin) continue;
    plan.push(r.id);
    used += r.full;
  }
  return plan;
}

/** The suggested plan for `day`, from what was done before it. */
export function suggestPlan(data: PersistedState, days: HabitDays, day: string, settings: PlanSettings): string[] {
  const inputs = activeHabits(data).map((habit) => ({
    habit,
    done: doneBefore(habit, days, day),
    lastDone: lastDoneBefore(habit, days, day),
  }));
  return pickPlan(inputs, day, settings);
}

/** Total full minutes of the given habits. */
export function planMinutes(ids: string[], data: PersistedState): number {
  let m = 0;
  for (const id of ids) m += data.habits.find((h) => h.id === id)?.dailyTargetMin ?? 0;
  return m;
}

/**
 * A stored plan made valid again: habits that no longer exist (or were
 * archived) are dropped, then habits come off the end until it fits the cap
 * and the budget (a habit may have grown longer since, or the budget shrunk).
 */
export function fitPlan(ids: string[], data: PersistedState, settings: PlanSettings): string[] {
  const live = new Set(activeHabits(data).map((h) => h.id));
  const out = [...new Set(ids)].filter((id) => live.has(id)).slice(0, settings.planCap);
  while (out.length && planMinutes(out, data) > settings.budgetMin) out.pop();
  return out;
}

/** Today's plan: the stored one (made to fit), else the suggestion. */
export function planFor(data: PersistedState, days: HabitDays, day: string, settings: PlanSettings): string[] {
  const stored = data.plans[day];
  return stored ? fitPlan(stored, data, settings) : suggestPlan(data, days, day, settings);
}

/** Replace `out` with `into` in a plan when the result fits; null when it would go over. */
export function swapInPlan(
  plan: string[],
  out: string,
  into: string,
  data: PersistedState,
  settings: PlanSettings
): string[] | null {
  if (plan.includes(into)) return null;
  const next = plan.map((id) => (id === out ? into : id));
  return planMinutes(next, data) <= settings.budgetMin ? next : null;
}

/** Add a habit to a plan when there's room under the cap and the budget; null otherwise. */
export function addToPlan(plan: string[], id: string, data: PersistedState, settings: PlanSettings): string[] | null {
  if (plan.includes(id) || plan.length >= settings.planCap) return null;
  const next = [...plan, id];
  return planMinutes(next, data) <= settings.budgetMin ? next : null;
}
