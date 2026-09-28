// Milestones: rare, proportional big wins. Detection is pure: given the data
// and the current streak, which badges are newly earned.

import { projectLook, ProjectColor } from './look';
import { activeProjects, projectWeekSec } from './projects';
import { dkey, monday } from './time';
import { Badge, PersistedState } from './types';

export const STREAK_MILESTONES = [3, 7, 14, 30, 50, 100];
export const HOUR_MILESTONES = [10, 50, 100];

export type BadgeKind = 'first' | 'streak' | 'hours' | 'week';

export interface BadgeInfo {
  id: string;
  kind: BadgeKind;
  /** The number on the badge: streak days, hours, or 0. */
  value: number;
  projectId?: string;
  /** Project badges wear the project's color. */
  color?: ProjectColor;
}

/** What a badge id means (ids: first-session, streak-7, hours-<pid>-10, week-<pid>-<week dkey>). */
export function badgeInfo(id: string, data?: PersistedState): BadgeInfo | null {
  if (id === 'first-session') return { id, kind: 'first', value: 0 };
  let m = /^streak-(\d+)$/.exec(id);
  if (m) return { id, kind: 'streak', value: Number(m[1]) };
  const color = (pid: string) => {
    const p = data?.projects.find((x) => x.id === pid);
    return p ? projectLook(p).color : undefined;
  };
  m = /^hours-(.+)-(\d+)$/.exec(id);
  if (m) return { id, kind: 'hours', value: Number(m[2]), projectId: m[1], color: color(m[1]) };
  m = /^week-(.+)-(\d{4}-\d{2}-\d{2})$/.exec(id);
  if (m) return { id, kind: 'week', value: 0, projectId: m[1], color: color(m[1]) };
  return null;
}

/** Every badge the data qualifies for right now (earned or not). */
export function qualifiedBadges(data: PersistedState, streak: number, now: number): string[] {
  const out: string[] = [];
  if (data.sessions.length) out.push('first-session');
  for (const n of STREAK_MILESTONES) if (streak >= n) out.push(`streak-${n}`);
  const week = dkey(monday(new Date(now)));
  for (const p of activeProjects(data)) {
    const hids = new Set(data.habits.filter((h) => h.projectId === p.id).map((h) => h.id));
    let total = 0;
    for (const s of data.sessions) if (hids.has(s.habitId)) total += s.duration;
    for (const h of HOUR_MILESTONES) if (total >= h * 3600) out.push(`hours-${p.id}-${h}`);
    if (p.weeklyTarget > 0 && projectWeekSec(data, p.id, now, false) >= p.weeklyTarget * 3600) out.push(`week-${p.id}-${week}`);
  }
  return out;
}

/** Badges newly earned: qualified for and not yet recorded. */
export function newBadges(data: PersistedState, streak: number, now: number): string[] {
  const have = new Set(data.badges.map((b) => b.id));
  return qualifiedBadges(data, streak, now).filter((id) => !have.has(id));
}

/** Record badges as earned at `now`. */
export function award(data: PersistedState, ids: string[], now: number): PersistedState {
  if (!ids.length) return data;
  const have = new Set(data.badges.map((b) => b.id));
  const add: Badge[] = ids.filter((id) => !have.has(id)).map((id) => ({ id, earnedAt: now }));
  return add.length ? { ...data, badges: [...data.badges, ...add] } : data;
}

/**
 * A queue of full-screen celebrations: never more than one showing, the rest
 * waiting in order, no id twice.
 */
export function enqueueCelebrations(queue: string[], ids: string[]): string[] {
  const seen = new Set(queue);
  const out = [...queue];
  for (const id of ids) if (!seen.has(id)) (seen.add(id), out.push(id));
  return out;
}

/** Most important first when several arrive together: streaks, hours, weekly targets, the first session. */
export function celebrationOrder(ids: string[]): string[] {
  const rank = (id: string) => (id.startsWith('streak') ? 0 : id.startsWith('hours') ? 1 : id.startsWith('week') ? 2 : 3);
  return [...ids].sort((a, b) => rank(a) - rank(b));
}
