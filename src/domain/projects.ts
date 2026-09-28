// Project lifecycle helpers shared by the selectors.

import { addDays, monday } from './time';
import { Habit, PersistedState, Project } from './types';

export function isArchived(p: Project): boolean {
  return p.archivedAt != null;
}

/** Projects that aren't archived, in their stored order. */
export function activeProjects(data: PersistedState): Project[] {
  return data.projects.filter((p) => !isArchived(p));
}

/** Projects that are archived, most recently archived first. */
export function archivedProjects(data: PersistedState): Project[] {
  return data.projects.filter(isArchived).sort((a, b) => (b.archivedAt ?? 0) - (a.archivedAt ?? 0));
}

/**
 * Habits of active projects (the ones that can be started or logged to).
 * A habit whose project is missing counts as active, as before archiving existed.
 */
export function activeHabits(data: PersistedState): Habit[] {
  const archived = new Set(data.projects.filter(isArchived).map((p) => p.id));
  return data.habits.filter((h) => !archived.has(h.projectId));
}

/**
 * Seconds logged on a project's habits in the week containing `now` (from
 * the week's first day), with the running timer when `withActive`.
 */
export function projectWeekSec(data: PersistedState, projectId: string, now: number, withActive = true): number {
  const hids = new Set(data.habits.filter((h) => h.projectId === projectId).map((h) => h.id));
  const ws = monday(new Date(now)).getTime();
  const we = addDays(new Date(ws), 7).getTime();
  let s = 0;
  for (const x of data.sessions) if (hids.has(x.habitId) && x.start >= ws && x.start < we) s += x.duration;
  const a = data.active;
  if (withActive && a && hids.has(a.habitId)) s += a.baseSec + (a.startedAt ? Math.max(0, (now - a.startedAt) / 1000) : 0);
  return s;
}
