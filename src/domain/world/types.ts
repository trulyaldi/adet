// World Mode's three records (docs/quest/world/PLAN.MD, "Design"): a Realm on
// one of the 7 biome slots, a Quest in it (a phase when it has a parent), and
// a Result told after a session or with Mark done. All three are stored as
// `items` (types realm, quest, result; migration 006, no new table), with
// their references in props. Pure.

import { isIconKey, projectLook } from '../look';
import type { IconKey, Project } from '../types';
import { Item, itemsOfType, ResultKind } from '../items/types';
import { MAX_REALMS } from '../game/balance';

export type { ResultKind } from '../items/types';

export interface Realm {
  id: string;
  /**
   * Biome slot 0–6 (forest … astral): its art, palette, mobs and boss sprite.
   * `UNPLACED` (-1) only on a resting realm, one of `World.resting`.
   */
  slot: number;
  name: string;
  icon: IconKey;
  /** The project this realm is (PROJECT_REALMS.md): it gives the name and icon. Absent on a hand-claimed realm. */
  projectId?: string;
  /** A hand-claimed realm the owner chose to keep as it is (the attach choice). */
  manual?: boolean;
}

/** The slot of a realm that exists but isn't on the map (its project rests, it lost a slot tie, or it has no valid slot). */
export const UNPLACED = -1;

export interface Quest {
  id: string;
  realmId: string;
  /** Set on a phase: the boss quest it belongs to. */
  parentQuestId?: string;
  title: string;
  /** Epoch ms (orders a realm's path). */
  createdAt: number;
}

export interface Result {
  id: string;
  questId: string;
  sessionId?: string;
  kind: ResultKind;
  /** Epoch ms. */
  at: number;
}

export const REALM_NAME_MAX = 32;
export const QUEST_TITLE_MAX = 80;
const FALLBACK_ICON: IconKey = 'target';

/** A hand-claimed realm's id: its slot (legacy ids keep it forever). */
export const realmIdFor = (slot: number) => `realm:${slot}`;
export const PROJECT_REALM_PREFIX = 'realm:p:';
/** A project's realm id, derived from the project so it never depends on a slot. The `p:` can't parse as a slot. */
export const realmIdForProject = (projectId: string) => `${PROJECT_REALM_PREFIX}${projectId}`;
export const isSlot = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < MAX_REALMS;

/** The project a realm item belongs to: its `props.projectId`, else the one its id encodes; null for a hand-claimed realm. */
export function projectIdOf(r: { id: string; props: { projectId?: string } }): string | null {
  if (r.props.projectId) return r.props.projectId;
  return r.id.startsWith(PROJECT_REALM_PREFIX) && r.id.length > PROJECT_REALM_PREFIX.length ? r.id.slice(PROJECT_REALM_PREFIX.length) : null;
}

/** What a realm needs of its project. */
export type ProjectRef = Pick<Project, 'id' | 'name' | 'icon' | 'started' | 'archivedAt'>;

/** A project's name as a realm's: whitespace collapsed, and at most REALM_NAME_MAX (the last character an ellipsis when cut). Empty if blank. */
export function realmNameFrom(projectName: string): string {
  const t = projectName.replace(/\s+/g, ' ').trim();
  return t.length > REALM_NAME_MAX ? `${t.slice(0, REALM_NAME_MAX - 1)}…` : t;
}

/** Slot ties and allocation go to the older project, then the lower id; a realm with no project ranks by its own creation. */
function rank(c: { item: { id: string; createdAt: number }; project?: ProjectRef }): [number, string] {
  return c.project ? [c.project.started ?? 0, c.project.id] : [c.item.createdAt, c.item.id];
}
const byRank = (a: [number, string], b: [number, string]) => a[0] - b[0] || (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0);

/** Projects in allocation order: oldest first (`started ?? 0`), then id. */
export function projectsByAge<P extends Pick<Project, 'id' | 'started'>>(projects: readonly P[]): P[] {
  return [...projects].sort((a, b) => byRank([a.started ?? 0, a.id], [b.started ?? 0, b.id]));
}

export interface WorldRecords {
  /** Placed realms: on a biome slot, one per slot. */
  realms: Realm[];
  /** Realms that exist but aren't on the map. They keep their quests, so credits and trophies survive. */
  resting: Realm[];
  quests: Quest[];
  results: Result[];
}

/**
 * The world's records out of the item list. Malformed ones (no realm, no quest) are left out.
 *
 * A realm is **placed** (`realms`) when it has a valid slot that no other
 * placed realm holds and, if it has a project, that project is active. Every
 * other realm is **resting**, still part of the world so its quests and
 * credits survive (PROJECT_REALMS.md, "Exists vs placed"). Slot ties go to
 * the older project (`started ?? 0`, then id); a realm with no project ranks
 * by its creation, so the first claim wins as it always did.
 *
 * `projects` makes projects count: a realm whose project is archived or
 * missing rests, and its name and icon come from the project. Pass it only
 * once sync has settled (items arrive before projects). Without it every
 * linked realm is taken at its stored values.
 */
export function worldOf(items: readonly Item[], projects?: readonly ProjectRef[]): WorldRecords {
  const byProject = projects ? new Map(projects.map((p) => [p.id, p])) : null;
  const cands = itemsOfType(items, 'realm')
    .sort((a, b) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : 1))
    .map((item) => {
      const projectId = projectIdOf(item);
      return { item, projectId, project: projectId && byProject ? byProject.get(projectId) : undefined };
    });
  // One realm per project: the first by creation owns it, a later one rests.
  const owned = new Set<string>();
  const eligible: typeof cands = [];
  const resting = new Set<string>();
  for (const c of cands) {
    if (c.projectId) {
      if (owned.has(c.projectId)) {
        resting.add(c.item.id);
        continue;
      }
      owned.add(c.projectId);
      if (byProject && (!c.project || c.project.archivedAt != null)) {
        resting.add(c.item.id);
        continue;
      }
    }
    if (isSlot(c.item.props.slot)) eligible.push(c);
    else resting.add(c.item.id);
  }
  // One placed realm per slot: the best rank keeps it.
  const holder = new Map<number, (typeof cands)[number]>();
  for (const c of eligible) {
    const cur = holder.get(c.item.props.slot);
    if (!cur || byRank(rank(c), rank(cur)) < 0) holder.set(c.item.props.slot, c);
  }
  const placed = new Set([...holder.values()].map((c) => c.item.id));
  const realms: Realm[] = [];
  const rest: Realm[] = [];
  for (const c of cands) {
    const live = placed.has(c.item.id);
    const p = c.project;
    const name = (p && realmNameFrom(p.name)) || c.item.title;
    const icon: IconKey = p ? projectLook(p).icon : isIconKey(c.item.props.icon) ? c.item.props.icon : FALLBACK_ICON;
    const realm: Realm = {
      id: c.item.id,
      slot: live ? c.item.props.slot : UNPLACED,
      name,
      icon,
      ...(c.projectId ? { projectId: c.projectId } : {}),
      ...(c.item.props.manual ? { manual: true } : {}),
    };
    (live ? realms : rest).push(realm);
  }
  const quests: Quest[] = itemsOfType(items, 'quest')
    .filter((q) => !!q.props.realmId)
    .map((q) => ({ id: q.id, realmId: q.props.realmId, title: q.title, createdAt: q.createdAt, ...(q.props.parentQuestId ? { parentQuestId: q.props.parentQuestId } : {}) }));
  const results: Result[] = [];
  for (const r of itemsOfType(items, 'result')) {
    const at = Date.parse(r.props.at);
    if (!r.props.questId || !Number.isFinite(at)) continue;
    results.push({ id: r.id, questId: r.props.questId, kind: r.props.kind, at, ...(r.props.sessionId ? { sessionId: r.props.sessionId } : {}) });
  }
  return { realms, resting: rest, quests, results };
}
