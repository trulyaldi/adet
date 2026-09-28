// Project lifecycle helpers shared by the selectors.

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
