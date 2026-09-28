// The week view: seven days, each as a small segmented ring of what was
// planned and done, with its streak mark; then each project's week.

import { learnedCapacity, LEARN_AFTER_DAYS } from './capacity';
import { daySecByHabit, planFor } from './dailyLog';
import { ProjectColor, projectLook } from './look';
import { isDone, markIndex } from './marks';
import { activeProjects, projectWeekSec } from './projects';
import { DayMark5 } from './streaks';
import { addDays, dkey, MONTHS_SHORT, monday, pkey } from './time';
import { PersistedState } from './types';

export interface DaySeg {
  color: ProjectColor;
  /** 0..1. */
  frac: number;
}

export type WeekDayState = 'complete' | 'rest' | 'free' | 'today' | 'past' | 'future';

export interface WeekDay {
  key: string;
  /** Date.getDay() (for the letter). */
  weekday: number;
  date: number;
  state: WeekDayState;
  segs: DaySeg[];
  trackedSec: number;
}

export interface WeekProject {
  projectId: string;
  name: string;
  color: ProjectColor;
  sec: number;
  targetH: number;
}

export interface WeekViewModel {
  days: WeekDay[];
  projects: WeekProject[];
  rangeLabel: string;
  hasEarlier: boolean;
  /** A capacity per weekday learned from the last weeks, when worth suggesting. */
  suggestion: number[] | null;
}

function stateOf(mark: DayMark5 | undefined, k: string, today: string): WeekDayState {
  if (k > today) return 'future';
  if (k === today) return mark === 'complete' ? 'complete' : 'today';
  if (mark === 'complete') return 'complete';
  if (mark === 'rest' || mark === 'freeze') return 'rest';
  if (mark === 'free') return 'free';
  return 'past';
}

export function selectWeekView(
  data: PersistedState,
  now: number,
  offset: number,
  marks: Map<string, DayMark5>,
  learnedDismissed: string | null
): WeekViewModel {
  const today = dkey(new Date(now));
  const start = addDays(monday(new Date(now)), -7 * offset);
  const idx = markIndex(data.marks);
  const byId = new Map(data.habits.map((h) => [h.id, h]));
  const projectColor = (pid: string) => projectLook(data.projects.find((p) => p.id === pid) ?? { id: pid }).color;
  const logs = new Map(data.dailyLogs.map((l) => [l.id, l]));

  const days: WeekDay[] = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(start, i);
    const k = dkey(d);
    const secs = daySecByHabit(data, k, k === today ? now : undefined);
    let trackedSec = 0;
    for (const v of secs.values()) trackedSec += v;
    let segs: DaySeg[] = [];
    if (k <= today) {
      // A past day by its log (what it was planned as then), else as planned now.
      const items = logs.get(k)?.items ?? planFor(data, k).items;
      segs = items.map((it) => {
        const h = byId.get(it.habitId);
        const sec = secs.get(it.habitId) || 0;
        const done = !!h && isDone(h, idx, k, sec, it.shareMin * 60);
        return { color: projectColor(it.projectId), frac: done ? 1 : it.shareMin > 0 ? Math.min(1, sec / (it.shareMin * 60)) : 0 };
      });
    }
    return { key: k, weekday: d.getDay(), date: d.getDate(), state: stateOf(marks.get(k), k, today), segs, trackedSec };
  });

  const end = addDays(start, 6);
  const at = Math.min(now, addDays(start, 6).getTime() + 86_399_000);
  let first = Infinity;
  for (const s of data.sessions) first = Math.min(first, s.start);
  const dismissedRecently = !!learnedDismissed && dkey(addDays(pkey(learnedDismissed), LEARN_AFTER_DAYS)) > today;

  return {
    days,
    projects: activeProjects(data).map((p) => ({
      projectId: p.id,
      name: p.name,
      color: projectLook(p).color,
      sec: projectWeekSec(data, p.id, at, offset === 0),
      targetH: p.weeklyTarget,
    })),
    rangeLabel:
      start.getMonth() === end.getMonth()
        ? `${MONTHS_SHORT[start.getMonth()]} ${start.getDate()}–${end.getDate()}`
        : `${MONTHS_SHORT[start.getMonth()]} ${start.getDate()} – ${MONTHS_SHORT[end.getMonth()]} ${end.getDate()}`,
    hasEarlier: first < start.getTime(),
    suggestion: offset === 0 && !dismissedRecently ? learnedCapacity(data.sessions, data.prefs.capacityMin, today) : null,
  };
}
