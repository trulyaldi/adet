// How a project looks: its color, icon and focus scene. Keys only (the UI maps
// them to real colors and art), with deterministic defaults so every device
// shows the same thing for a project that has none set yet.

import type { IconKey, Project, SceneKind } from './types';

export type ProjectColor = 'purple' | 'orange' | 'green' | 'pink' | 'teal' | 'yellow' | 'coral' | 'indigo';

export const PROJECT_COLORS: ProjectColor[] = ['purple', 'orange', 'green', 'pink', 'teal', 'yellow', 'coral', 'indigo'];

export const SCENES: SceneKind[] = ['plant', 'orbit', 'fill', 'constellation'];

export const PROJECT_ICONS: IconKey[] = ['target', 'code', 'book', 'briefcase', 'gym', 'meditate', 'walk', 'art', 'music', 'pen', 'leaf', 'globe', 'heart', 'chart'];

export function isProjectColor(v: unknown): v is ProjectColor {
  return typeof v === 'string' && (PROJECT_COLORS as string[]).includes(v);
}

export function isScene(v: unknown): v is SceneKind {
  return typeof v === 'string' && (SCENES as string[]).includes(v);
}

export function isIconKey(v: unknown): v is IconKey {
  return typeof v === 'string' && (PROJECT_ICONS as string[]).includes(v);
}

/** A stable small number from an id (FNV-1a). */
export function idHash(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export interface ProjectLook {
  color: ProjectColor;
  icon: IconKey;
  scene: SceneKind;
}

/** A project's look, with id-derived defaults for anything unset. */
export function projectLook(p: Pick<Project, 'id' | 'color' | 'icon' | 'scene'>): ProjectLook {
  const h = idHash(p.id);
  return {
    color: isProjectColor(p.color) ? p.color : PROJECT_COLORS[h % PROJECT_COLORS.length],
    icon: isIconKey(p.icon) ? p.icon : 'target',
    scene: isScene(p.scene) ? p.scene : SCENES[h % SCENES.length],
  };
}

/**
 * Looks for projects that have none yet, as distinct as possible: colors and
 * scenes go round in order of when projects started (then id), skipping
 * colors already taken. Every device with the same projects assigns the same.
 * `iconFor` suggests an icon (e.g. from the project's first habit).
 */
export function assignLooks<P extends Project>(projects: P[], iconFor: (p: P) => IconKey | undefined): P[] {
  const order = [...projects].sort((a, b) => (a.started ?? 0) - (b.started ?? 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const taken = new Set(projects.map((p) => p.color).filter(isProjectColor));
  const assigned = new Map<string, P>();
  let ci = 0;
  let si = 0;
  for (const p of order) {
    if (isProjectColor(p.color) && isScene(p.scene) && isIconKey(p.icon)) continue;
    let color = p.color;
    if (!isProjectColor(color)) {
      const free = PROJECT_COLORS.filter((c) => !taken.has(c));
      color = free.length ? free[0] : PROJECT_COLORS[ci++ % PROJECT_COLORS.length];
      taken.add(color);
    }
    const scene = isScene(p.scene) ? p.scene : SCENES[si++ % SCENES.length];
    const icon = isIconKey(p.icon) ? p.icon : iconFor(p) ?? 'target';
    assigned.set(p.id, { ...p, color, scene, icon });
  }
  return projects.map((p) => assigned.get(p.id) ?? p);
}

/** The next color for a new project: the first unused one, else round the palette. */
export function nextProjectColor(projects: Project[]): ProjectColor {
  const used = new Set(projects.map((p) => projectLook(p).color));
  return PROJECT_COLORS.find((c) => !used.has(c)) ?? PROJECT_COLORS[projects.length % PROJECT_COLORS.length];
}

/** The next scene for a new project, round the four. */
export function nextScene(projects: Project[]): SceneKind {
  return SCENES[projects.length % SCENES.length];
}

/**
 * Give every project without a full look one (see assignLooks), taking the
 * icon from its first habit. Returns `data` itself when nothing changes, so
 * the store can run it after every load and merge; changed projects are new
 * objects and get synced like any edit.
 */
export function withLooks<D extends { projects: Project[]; habits: { projectId: string; icon: IconKey }[] }>(data: D): D {
  if (data.projects.every((p) => isProjectColor(p.color) && isScene(p.scene) && isIconKey(p.icon))) return data;
  const projects = assignLooks(data.projects, (p) => data.habits.find((h) => h.projectId === p.id)?.icon);
  return { ...data, projects };
}
