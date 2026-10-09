// What the Start sheet does with an objective (Projects as Realms, session 4):
// which open quests a project offers as chips, and whether a tap binds one,
// creates one, or stays a free session. Pure; the sheet only reads this.

import type { Habit } from '../../domain/types';
import { isCheck } from '../../domain/marks';
import { realmOfProject, World } from '../../domain/world/rules';
import { openQuestsOf } from '../../domain/world/target';
import { QUEST_TITLE_MAX } from '../../domain/world/types';
import type { Quest, Realm } from '../../domain/world/types';

/** Chips shown under a project. */
export const START_CHIPS_MAX = 3;

/** A typed objective as one tidy line (the title `addQuest` would keep); '' means none. */
export function cleanObjective(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, QUEST_TITLE_MAX);
}

/** The project's realm when it is on the map (a resting realm, or none, is null). */
export function placedRealmOf(world: World, projectId: string): Realm | null {
  const realm = realmOfProject(world, projectId);
  return realm && realm.slot >= 0 ? realm : null;
}

/** The habit Start runs for a project: its first one with a session (a check has none). */
export function firstTimedHabit(habits: readonly Habit[]): Habit | undefined {
  return habits.find((h) => !isCheck(h));
}

/** Up to three open quests of the project's realm, oldest first. None without a placed realm or a habit to start. */
export function chipsFor(world: World, projectId: string, habits: readonly Habit[]): Quest[] {
  const realm = placedRealmOf(world, projectId);
  if (!realm || !firstTimedHabit(habits)) return [];
  return openQuestsOf(world, realm.id).slice(0, START_CHIPS_MAX);
}

export type StartPlan =
  /** No quest: a free session (or a check). */
  | { kind: 'free' }
  /** Bind an existing quest (the Realm screen's pick, or a chip). */
  | { kind: 'bind'; questId: string }
  /** Create a mob in this realm first, then bind it. */
  | { kind: 'create'; realmId: string; title: string };

export interface StartInput {
  /** The tapped habit has no session. */
  check: boolean;
  /** A quest the Realm screen set pending. */
  pending: string | null;
  /** A chip was tapped. */
  chipQuestId: string | null;
  /** The typed objective, as typed. */
  objective: string;
  /** The tapped habit's project's placed realm, if any. */
  realmId: string | null;
}

/**
 * The order of precedence: a check never has a quest; then the Realm screen's
 * pick, then a tapped chip, then a typed objective (only where there is a
 * realm to put it in); otherwise a free session.
 */
export function planStart(i: StartInput): StartPlan {
  if (i.check) return { kind: 'free' };
  if (i.pending) return { kind: 'bind', questId: i.pending };
  if (i.chipQuestId) return { kind: 'bind', questId: i.chipQuestId };
  const title = cleanObjective(i.objective);
  if (title && i.realmId) return { kind: 'create', realmId: i.realmId, title };
  return { kind: 'free' };
}
