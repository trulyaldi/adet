// Stats as plain data: time per project per week, totals per project, and
// the badge collection.

import { ICONS } from './constants';
import { ProjectLook, projectLook } from './look';
import { badgeInfo, BadgeInfo } from './milestones';
import { isArchived } from './projects';
import { addDays, dkey, MONTHS_SHORT, monday } from './time';
import { PersistedState } from './types';

export interface WeekPart {
  projectId: string;
  sec: number;
}

export interface WeekColumn {
  /** dkey of the week's first day. */
  week: string;
  /** "Sep 28". */
  label: string;
  total: number;
  /** Project slices, in the projects' order. */
  parts: WeekPart[];
}

export interface ProjectTotal {
  projectId: string;
  name: string;
  look: ProjectLook;
  iconPath: string;
  sec: number;
  archived: boolean;
}

/** Seconds per project in each of the last `weeks` weeks (oldest first). */
export function weeklyByProject(data: PersistedState, now: number, weeks = 12): WeekColumn[] {
  const habitProject = new Map(data.habits.map((h) => [h.id, h.projectId]));
  const first = monday(new Date(now));
  const starts = Array.from({ length: weeks }, (_, i) => addDays(first, -7 * (weeks - 1 - i)));
  const idx = new Map(starts.map((d, i) => [dkey(d), i]));
  const sums = starts.map(() => new Map<string, number>());
  for (const s of data.sessions) {
    const w = idx.get(dkey(monday(new Date(s.start))));
    const pid = habitProject.get(s.habitId);
    if (w === undefined || !pid) continue;
    sums[w].set(pid, (sums[w].get(pid) || 0) + s.duration);
  }
  return starts.map((d, i) => {
    const parts = data.projects.map((p) => ({ projectId: p.id, sec: sums[i].get(p.id) || 0 })).filter((x) => x.sec > 0);
    return { week: dkey(d), label: `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`, total: parts.reduce((a, x) => a + x.sec, 0), parts };
  });
}

/** Lifetime time per project, most first (archived ones too: their history counts). */
export function projectTotals(data: PersistedState): ProjectTotal[] {
  const habitProject = new Map(data.habits.map((h) => [h.id, h.projectId]));
  const sec = new Map<string, number>();
  for (const s of data.sessions) {
    const pid = habitProject.get(s.habitId);
    if (pid) sec.set(pid, (sec.get(pid) || 0) + s.duration);
  }
  return data.projects
    .map((p) => {
      const look = projectLook(p);
      return { projectId: p.id, name: p.name, look, iconPath: ICONS[look.icon], sec: sec.get(p.id) || 0, archived: isArchived(p) };
    })
    .filter((p) => p.sec > 0 || !p.archived)
    .sort((a, b) => b.sec - a.sec);
}

export interface BadgeView extends BadgeInfo {
  earnedAt: number;
}

/** Earned badges, newest first. */
export function badgeCollection(data: PersistedState): BadgeView[] {
  return data.badges
    .map((b) => {
      const info = badgeInfo(b.id, data);
      return info ? { ...info, earnedAt: b.earnedAt } : null;
    })
    .filter((b): b is BadgeView => !!b)
    .sort((a, b) => b.earnedAt - a.earnedAt);
}
