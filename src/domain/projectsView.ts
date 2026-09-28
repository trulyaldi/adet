// The Projects screen as plain data: each project's week against its target,
// its habits, and this week's sessions.

import { targetCheck, TargetCheck } from './capacity';
import { ICONS } from './constants';
import { ProjectLook, projectLook } from './look';
import { isCheck } from './marks';
import { activeProjects, archivedProjects, projectWeekSec } from './projects';
import { addDays, monday } from './time';
import { HabitKind, PersistedState } from './types';

export interface ProjectHabitView {
  habitId: string;
  name: string;
  iconPath: string;
  kind: HabitKind;
  /** The habit's usual session length (the target marker when not planned). */
  targetMin: number;
  weekSec: number;
  running: boolean;
}

export interface WeekSessionView {
  id: string;
  habitName: string;
  start: number;
  duration: number;
  manual: boolean;
}

export interface ProjectView {
  projectId: string;
  name: string;
  look: ProjectLook;
  weeklyTargetH: number;
  weekSec: number;
  /** 0..1+ of the weekly target. */
  frac: number;
  reached: boolean;
  lifetimeSec: number;
  habits: ProjectHabitView[];
  sessions: WeekSessionView[];
}

export interface ProjectsView {
  cards: ProjectView[];
  archived: { projectId: string; name: string; look: ProjectLook; lifetimeSec: number }[];
  check: TargetCheck;
}

export function selectProjectsView(data: PersistedState, now: number): ProjectsView {
  const ws = monday(new Date(now)).getTime();
  const we = addDays(new Date(ws), 7).getTime();
  const lifetime = (pid: string) => {
    const hids = new Set(data.habits.filter((h) => h.projectId === pid).map((h) => h.id));
    let s = 0;
    for (const x of data.sessions) if (hids.has(x.habitId)) s += x.duration;
    return s;
  };

  const cards = activeProjects(data).map((p): ProjectView => {
    const habits = data.habits.filter((h) => h.projectId === p.id);
    const byId = new Map(habits.map((h) => [h.id, h]));
    const weekSec = projectWeekSec(data, p.id, now);
    const sessions = data.sessions
      .filter((s) => byId.has(s.habitId) && s.start >= ws && s.start < we)
      .sort((a, b) => b.start - a.start)
      .map((s) => ({ id: s.id, habitName: byId.get(s.habitId)!.name, start: s.start, duration: s.duration, manual: !!s.manual }));
    const target = Math.max(0, p.weeklyTarget) * 3600;
    return {
      projectId: p.id,
      name: p.name,
      look: projectLook(p),
      weeklyTargetH: p.weeklyTarget,
      weekSec,
      frac: target > 0 ? weekSec / target : 0,
      reached: target > 0 && weekSec >= target,
      lifetimeSec: lifetime(p.id),
      habits: habits.map((h) => {
        let hs = 0;
        for (const s of data.sessions) if (s.habitId === h.id && s.start >= ws && s.start < we) hs += s.duration;
        return {
          habitId: h.id,
          name: h.name,
          iconPath: ICONS[h.icon] || ICONS.code,
          kind: isCheck(h) ? 'check' : 'timed',
          targetMin: h.dailyTargetMin,
          weekSec: hs,
          running: data.active?.habitId === h.id,
        };
      }),
      sessions,
    };
  });

  return {
    cards,
    archived: archivedProjects(data).map((p) => ({ projectId: p.id, name: p.name, look: projectLook(p), lifetimeSec: lifetime(p.id) })),
    check: targetCheck(data),
  };
}

/** "Mon 9:30" for a session row. */
export function sessionWhen(start: number): string {
  const d = new Date(start);
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
  return `${day} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}
