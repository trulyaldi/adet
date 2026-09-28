// Today, as plain data: the plan's items with their progress, the day's
// total, and what's running. The screen attaches actions.

import { ICONS } from './constants';
import { daySecByHabit, itemDone, planFor } from './dailyLog';
import { weeklyTargetOf } from './frequency';
import { ProjectColor, projectLook } from './look';
import { isCheck, markIndex } from './marks';
import { activeHabits } from './projects';
import { addDays, dkey, monday, pkey, weekPos } from './time';
import { Habit, HabitKind, PersistedState } from './types';

export interface WeekDots {
  /** Dots in the row: the habit's weekly target (not always 7). */
  total: number;
  /** Days done this week, today included. */
  done: number;
  /** Today is one of the done days (its dot is marked), else the next dot to fill is. */
  doneToday: boolean;
}

export interface TodayItem {
  habitId: string;
  projectId: string;
  name: string;
  iconPath: string;
  color: ProjectColor;
  kind: HabitKind;
  /** Today's share in seconds (0 for check-offs). */
  shareSec: number;
  /** Seconds tracked today, the running timer included. */
  sec: number;
  done: boolean;
  running: boolean;
  paused: boolean;
  week: WeekDots;
}

export interface TodayModel {
  day: string;
  capacityMin: number;
  plannedMin: number;
  /** Everything tracked today, every habit, the running timer included. */
  trackedSec: number;
  items: TodayItem[];
  /** Planned habits set aside for today. */
  aside: TodayItem[];
  /** Habits outside the plan with time, a mark or a timer today. */
  bonus: TodayItem[];
  doneCount: number;
  /** Everything planned is done (never true for an empty plan). */
  complete: boolean;
  /** Nothing planned (weekly targets met, or capacity 0): a relaxed day. */
  free: boolean;
  noHabits: boolean;
  /** The running (or paused) session's item, wherever it is. */
  active: TodayItem | null;
}

/** Days this week, up to and including `day`, with time or a mark. */
function weekDoneDays(data: PersistedState, habitId: string, day: string): Set<string> {
  const start = dkey(monday(pkey(day)));
  const out = new Set<string>();
  for (const s of data.sessions) {
    if (s.habitId !== habitId || s.duration <= 0) continue;
    const k = dkey(new Date(s.start));
    if (k >= start && k <= day) out.add(k);
  }
  for (const m of data.marks) if (m.habitId === habitId && m.day >= start && m.day <= day) out.add(m.day);
  return out;
}

export function selectToday(data: PersistedState, now: number): TodayModel {
  const day = dkey(new Date(now));
  const plan = planFor(data, day);
  const secs = daySecByHabit(data, day, now);
  const idx = markIndex(data.marks);
  const projects = new Map(data.projects.map((p) => [p.id, p]));
  const a = data.active;

  const item = (h: Habit, shareMin: number): TodayItem => {
    const p = projects.get(h.projectId);
    const running = !!a && a.habitId === h.id;
    const sec = secs.get(h.id) || 0;
    const doneDays = weekDoneDays(data, h.id, day);
    const done = itemDone(data, idx, { habitId: h.id, projectId: h.projectId, kind: isCheck(h) ? 'check' : 'timed', shareMin }, day, sec);
    return {
      habitId: h.id,
      projectId: h.projectId,
      name: h.name,
      iconPath: ICONS[h.icon] || ICONS.code,
      color: projectLook(p ?? { id: h.projectId }).color,
      kind: isCheck(h) ? 'check' : 'timed',
      shareSec: shareMin * 60,
      sec,
      done,
      running,
      paused: running && !a!.startedAt,
      week: { total: weeklyTargetOf(h.frequency), done: doneDays.size, doneToday: doneDays.has(day) },
    };
  };

  const byId = new Map(data.habits.map((h) => [h.id, h]));
  const items = plan.items.map((it) => item(byId.get(it.habitId)!, it.shareMin));
  const planned = new Set(items.map((i) => i.habitId));
  const asideIds = new Set(data.days[day]?.aside ?? []);
  const live = activeHabits(data);
  const aside = live.filter((h) => asideIds.has(h.id) && !planned.has(h.id)).map((h) => item(h, 0));
  const bonus = data.habits
    .filter((h) => !planned.has(h.id) && !asideIds.has(h.id) && ((secs.get(h.id) || 0) > 0 || idx.get(h.id)?.has(day) || a?.habitId === h.id))
    .map((h) => item(h, 0));

  let trackedSec = 0;
  for (const v of secs.values()) trackedSec += v;
  const doneCount = items.filter((i) => i.done).length;
  const all = [...items, ...aside, ...bonus];

  return {
    day,
    capacityMin: plan.capacityMin,
    plannedMin: plan.plannedMin,
    trackedSec,
    items,
    aside,
    bonus,
    doneCount,
    complete: items.length > 0 && doneCount === items.length,
    free: items.length === 0 && live.length > 0,
    noHabits: live.length === 0,
    active: all.find((i) => i.running) ?? null,
  };
}

/** Index of today in its week (0 = the week's first day), for the dots. */
export function todayWeekPos(day: string): number {
  return weekPos(pkey(day));
}

/** The seven dkeys of the week containing `day`. */
export function weekDays(day: string): string[] {
  const start = monday(pkey(day));
  return Array.from({ length: 7 }, (_, i) => dkey(addDays(start, i)));
}

export interface ActiveProgress {
  habitId: string;
  /** Today's time on the habit, the running timer included. */
  sec: number;
  /** This session alone. */
  sessionSec: number;
  /** The target marker: today's share when planned, else the habit's usual length. */
  targetSec: number;
  paused: boolean;
}

/** The running (or paused) session against its target marker. */
export function activeProgress(data: PersistedState, now: number): ActiveProgress | null {
  const a = data.active;
  if (!a) return null;
  const h = data.habits.find((x) => x.id === a.habitId);
  if (!h) return null;
  const day = dkey(new Date(now));
  const plan = planFor(data, day);
  const share = plan.items.find((i) => i.habitId === h.id)?.shareMin ?? 0;
  const sessionSec = a.baseSec + (a.startedAt ? Math.max(0, (now - a.startedAt) / 1000) : 0);
  const sec = daySecByHabit(data, day, now).get(h.id) || 0;
  return { habitId: h.id, sec, sessionSec, targetSec: (share > 0 ? share : Math.max(5, h.dailyTargetMin)) * 60, paused: !a.startedAt };
}
