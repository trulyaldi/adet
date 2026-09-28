// The daily planner. Pure: planToday(projects, habits, sessions, settings,
// date) → plan, so an AI planner can replace it later with the same inputs
// and output.
//
// Weekly hour targets are the main measure. Each day, a project's remaining
// hours for the week are spread over the days left, weighted by each day's
// capacity: doing less today makes later days slightly heavier, doing more
// makes them lighter. Shares are computed from time logged *before* today, so
// the day's plan stays put while you work through it. There is never a
// backlog: a week's leftovers simply don't carry into the next week.

import { capacityOn } from './capacity';
import { isFixedOn, weekdayIndex, weeklyTargetOf } from './frequency';
import { isCheck } from './marks';
import { addDays, dkey, monday, pkey, weekPos } from './time';
import { DayLevel, Habit, HabitKind, Mark, Project, Session, UserPrefs } from './types';

export interface PlannerSettings {
  /** Minutes per weekday (0 = Monday … 6 = Sunday). */
  capacityMin: number[];
  /** Today's light/normal/heavy tap. */
  level?: DayLevel;
}

/** Things the plan reacts to beyond the core inputs. */
export interface PlannerExtras {
  /** Done marks (check-offs count toward a habit's days this week). */
  marks?: Mark[];
  /** The day's habits in a dragged order. */
  order?: string[];
  /** Habits set aside for the day; their time moves to others or to later days. */
  aside?: string[];
}

export interface PlanItem {
  habitId: string;
  projectId: string;
  kind: HabitKind;
  /** The habit's share of today, in minutes (0 for check-offs). */
  shareMin: number;
}

export interface ProjectDay {
  projectId: string;
  /** Minutes still wanted this week, counted from before today. */
  remainingMin: number;
  /** Today's slice of it. */
  shareMin: number;
}

export interface DayPlan {
  day: string;
  /** Today's capacity in minutes (after the light/normal/heavy tap). */
  capacityMin: number;
  /** Sum of the items' shares. */
  plannedMin: number;
  items: PlanItem[];
  projects: ProjectDay[];
}

/** Shares are handed out in 5-minute steps, never smaller than 5. */
const STEP_MIN = 5;
/** A habit is only planned for at least this long (unless it's the project's only one). */
const MIN_ITEM_MIN = 10;

const round5 = (m: number) => Math.max(STEP_MIN, Math.round(m / STEP_MIN) * STEP_MIN);

function isLive(p: Project): boolean {
  return p.archivedAt == null;
}

export function planToday(
  projects: Project[],
  habits: Habit[],
  sessions: Session[],
  settings: PlannerSettings | UserPrefs,
  date: string | Date,
  extras: PlannerExtras = {}
): DayPlan {
  const day = typeof date === 'string' ? date : dkey(date);
  const d = pkey(day);
  const weekStart = dkey(monday(d));
  const pos = weekPos(d);
  const daysLeft = 7 - pos;
  const level = 'level' in settings ? settings.level : undefined;
  const prefs: UserPrefs = { capacityMin: settings.capacityMin, weekStart: 1 };
  const capToday = capacityOn(prefs, day, level);
  let capRest = 0;
  for (let i = 1; i < daysLeft; i++) capRest += capacityOn(prefs, dkey(addDays(d, i)));
  const capRemaining = capToday + capRest;
  const aside = new Set(extras.aside ?? []);

  // This week's history before today: seconds per habit, and done days per habit.
  const habitSec = new Map<string, number>();
  const doneDays = new Map<string, Set<string>>();
  const lastDone = new Map<string, string>();
  const noteDone = (hid: string, k: string) => {
    if (k >= weekStart && k < day) {
      let s = doneDays.get(hid);
      if (!s) doneDays.set(hid, (s = new Set()));
      s.add(k);
    }
    if (k < day && (lastDone.get(hid) ?? '') < k) lastDone.set(hid, k);
  };
  for (const s of sessions) {
    const k = dkey(new Date(s.start));
    if (k >= weekStart && k < day) habitSec.set(s.habitId, (habitSec.get(s.habitId) || 0) + s.duration);
    if (s.duration > 0) noteDone(s.habitId, k);
  }
  for (const m of extras.marks ?? []) noteDone(m.habitId, m.day);

  const weekday = weekdayIndex(d);
  /** How pressing the habit is today, or null when it isn't due. */
  const urgency = (h: Habit): number | null => {
    const f = h.frequency;
    const done = doneDays.get(h.id)?.size ?? 0;
    const remaining = weeklyTargetOf(f) - done;
    if (remaining <= 0) return null;
    if (f.kind === 'daily') return 1;
    if (f.kind === 'days') return isFixedOn(f, weekday) ? 1 : null;
    // n times a week: due when at or behind an even pace, so they spread out.
    const u = remaining / daysLeft;
    return u >= f.times / 7 - 1e-9 ? u : null;
  };
  const byPriority = (a: { h: Habit; u: number; i: number }, b: { h: Habit; u: number; i: number }) =>
    b.u - a.u || ((lastDone.get(a.h.id) ?? '') < (lastDone.get(b.h.id) ?? '') ? -1 : (lastDone.get(a.h.id) ?? '') > (lastDone.get(b.h.id) ?? '') ? 1 : 0) || a.i - b.i;

  const items: PlanItem[] = [];
  const projectDays: ProjectDay[] = [];

  for (const p of projects) {
    if (!isLive(p)) continue;
    const own = habits.map((h, i) => ({ h, i })).filter(({ h }) => h.projectId === p.id);
    let doneSec = 0;
    for (const { h } of own) doneSec += habitSec.get(h.id) || 0;
    const remainingMin = Math.max(0, Math.round(Math.max(0, p.weeklyTarget) * 60 - doneSec / 60));
    const shareMin = capRemaining > 0 && capToday > 0 ? (remainingMin * capToday) / capRemaining : 0;
    projectDays.push({ projectId: p.id, remainingMin, shareMin: Math.round(shareMin) });

    // Timed habits share the project's slice.
    if (shareMin >= STEP_MIN) {
      const timed = own.filter(({ h }) => !isCheck(h) && !aside.has(h.id));
      let pool = timed
        .map(({ h, i }) => ({ h, i, u: urgency(h) }))
        .filter((x): x is { h: Habit; i: number; u: number } => x.u !== null)
        .sort(byPriority);
      // Nothing due by its frequency, but hours are still wanted: the least recently done one.
      if (!pool.length && timed.length) {
        pool = timed.map(({ h, i }) => ({ h, i, u: 0 })).sort(byPriority).slice(0, 1);
      }
      const n = Math.max(1, Math.min(pool.length, Math.floor(shareMin / MIN_ITEM_MIN)));
      const chosen = pool.slice(0, n);
      const weight = chosen.reduce((a, x) => a + Math.max(1, x.h.dailyTargetMin), 0);
      for (const x of chosen) {
        items.push({ habitId: x.h.id, projectId: p.id, kind: 'timed', shareMin: round5((shareMin * Math.max(1, x.h.dailyTargetMin)) / weight) });
      }
    }

    // Check-offs due today (they don't use time).
    for (const { h } of own) {
      if (!isCheck(h) || aside.has(h.id) || urgency(h) === null) continue;
      items.push({ habitId: h.id, projectId: p.id, kind: 'check', shareMin: 0 });
    }
  }

  // A dragged order wins; anything not in it keeps its place after.
  if (extras.order?.length) {
    const rank = new Map(extras.order.map((id, i) => [id, i]));
    const base = new Map(items.map((it, i) => [it.habitId, i]));
    items.sort((a, b) => (rank.get(a.habitId) ?? 1e6 + base.get(a.habitId)!) - (rank.get(b.habitId) ?? 1e6 + base.get(b.habitId)!));
  }

  return {
    day,
    capacityMin: capToday,
    plannedMin: items.reduce((a, it) => a + it.shareMin, 0),
    items,
    projects: projectDays,
  };
}
