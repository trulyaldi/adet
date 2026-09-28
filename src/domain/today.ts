// Today: the day's plan (a few habits within the time budget), what's done,
// and what the plan editors can offer. Plain data; the screen attaches actions.

import { ICONS } from './constants';
import { weeklyTargetOf } from './frequency';
import { activeSec } from './engine';
import {
  addToPlan,
  Completion,
  completionOn,
  doneThrough,
  habitDaySec,
  HabitDays,
  planFor,
  planMinutes,
  PlanSettings,
  swapInPlan,
} from './plan';
import { activeHabits } from './projects';
import { dkey } from './time';
import { Habit, PersistedState } from './types';

export interface HabitCard {
  habitId: string;
  name: string;
  iconPath: string;
  tile: string;
  fullMin: number;
  minMin: number;
  /** Days done this week (including today), and the week's target. */
  weekDone: number;
  weekTarget: number;
  /** Today's completion, or null while not done yet. */
  done: Completion | null;
  running: boolean;
  paused: boolean;
  /** The running timer's elapsed seconds; 0 when not running. */
  elapsedSec: number;
}

export interface TodayPlanModel {
  day: string;
  plan: HabitCard[];
  /** Planned full minutes and the budget. */
  plannedMin: number;
  budgetMin: number;
  /** Planned habits done today. */
  doneCount: number;
  /** Every planned habit is done (full or minimum): the day is finished. */
  complete: boolean;
  /** Nothing is due today (weekly targets met, or nothing fits): a free day. */
  free: boolean;
  /** There are no habits at all (empty state). */
  noHabits: boolean;
  /** Room for another habit in the plan (under the cap; the budget is checked on add). */
  canAdd: boolean;
  /** Habits outside the plan that are done or running today (bonus). */
  bonus: HabitCard[];
  /** Habits done today (plan and bonus) and minutes tracked today, all habits. */
  doneTodayCount: number;
  trackedMin: number;
}

function iconPath(h: Habit): string {
  return ICONS[h.icon] || ICONS.code;
}

function card(h: Habit, data: PersistedState, days: HabitDays, day: string, now: number): HabitCard {
  const running = !!data.active && data.active.habitId === h.id;
  return {
    habitId: h.id,
    name: h.name,
    iconPath: iconPath(h),
    tile: h.tile,
    fullMin: h.dailyTargetMin,
    minMin: h.minTargetMin,
    weekDone: doneThrough(h, days, day),
    weekTarget: weeklyTargetOf(h.frequency),
    done: completionOn(h, days, day),
    running,
    paused: running && !data.active!.startedAt,
    elapsedSec: running ? activeSec(data.active, now) : 0,
  };
}

export function selectPlanToday(data: PersistedState, settings: PlanSettings, now: number): TodayPlanModel {
  const day = dkey(new Date(now));
  const days = habitDaySec(data, now);
  const planIds = planFor(data, days, day, settings);
  const byId = new Map(data.habits.map((h) => [h.id, h]));
  const plan = planIds.map((id) => card(byId.get(id)!, data, days, day, now));
  const doneCount = plan.filter((c) => c.done).length;
  const live = activeHabits(data);

  // Bonus: done or running today but not planned. A timer can also run on an
  // archived project's habit (started elsewhere); it shows here until stopped.
  const inPlan = new Set(planIds);
  const bonusHabits = data.habits.filter(
    (h) => !inPlan.has(h.id) && (completionOn(h, days, day) || data.active?.habitId === h.id)
  );
  const bonus = bonusHabits.map((h) => card(h, data, days, day, now));

  let trackedSec = 0;
  for (const m of days.values()) trackedSec += m.get(day) || 0;

  return {
    day,
    plan,
    plannedMin: planMinutes(planIds, data),
    budgetMin: settings.budgetMin,
    doneCount,
    complete: plan.length > 0 && doneCount === plan.length,
    free: plan.length === 0 && live.length > 0,
    noHabits: live.length === 0,
    canAdd: plan.length < settings.planCap,
    bonus,
    doneTodayCount: doneCount + bonus.filter((c) => c.done).length,
    trackedMin: Math.floor(trackedSec / 60),
  };
}

export interface PickerRow extends HabitCard {
  /** False when choosing it would take the plan over the budget (or the cap). */
  fits: boolean;
}

/**
 * Habits to offer when editing today's plan: every active habit not already
 * in it. `swapFor` checks each against swapping out that habit; without it,
 * against adding (bonus starts ignore the budget, so pass `ignoreBudget`).
 */
export function selectPickerRows(
  data: PersistedState,
  settings: PlanSettings,
  now: number,
  opts: { swapFor?: string; ignoreBudget?: boolean } = {}
): PickerRow[] {
  const day = dkey(new Date(now));
  const days = habitDaySec(data, now);
  const planIds = planFor(data, days, day, settings);
  return activeHabits(data)
    .filter((h) => !planIds.includes(h.id))
    .map((h) => ({
      ...card(h, data, days, day, now),
      fits:
        !!opts.ignoreBudget ||
        (opts.swapFor
          ? swapInPlan(planIds, opts.swapFor, h.id, data, settings) !== null
          : addToPlan(planIds, h.id, data, settings) !== null),
    }));
}
