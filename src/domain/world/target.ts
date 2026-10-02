// What a session fights and what its result does (world-4). A session's
// target is the quest the timer was started for; for a boss, that's its
// oldest uncleared phase (a boss takes no results of its own). All derived.

import { BOSS_MIN_PHASES, MIN_SESSION_MIN } from '../game/balance';
import type { ResultKind } from '../items/types';
import type { Session } from '../types';
import { bossProgress, isBoss, isCleared, isRealmConquered, heartsOf, phasesOf, World } from './rules';
import type { Quest, Realm } from './types';

export interface SessionTarget {
  /** The quest a result is recorded on: a mob, or a boss's phase. */
  quest: Quest;
  realm: Realm;
  /** The boss when the target is one of its phases (the stage shows its sprite). */
  boss: Quest | null;
  hearts: number;
  /** A boss's phase progress (the stage's pips). */
  phases: { cleared: number; total: number } | null;
}

/** The fight for `questId` right now, or null if there's nothing left to fight (cleared, deleted, or no realm). */
export function targetOf(world: World, questId: string | null): SessionTarget | null {
  if (!questId) return null;
  const picked = world.quests.find((q) => q.id === questId);
  if (!picked) return null;
  const realm = world.realms.find((r) => r.id === picked.realmId);
  if (!realm) return null;
  const parent = picked.parentQuestId ? world.quests.find((q) => q.id === picked.parentQuestId) ?? null : null;
  const boss = isBoss(picked, world.quests) ? picked : parent && isBoss(parent, world.quests) ? parent : null;
  const quest = boss === picked ? phasesOf(picked, world.quests).find((p) => !isCleared(p, world.results, world.quests)) : picked;
  if (!quest || isCleared(quest, world.results, world.quests)) return null;
  const progress = boss ? bossProgress(boss, world.quests, world.results) : null;
  return {
    quest,
    realm,
    boss,
    hearts: heartsOf(quest, world.results, world.quests),
    phases: progress && progress.total >= BOSS_MIN_PHASES ? { cleared: progress.cleared, total: progress.total } : null,
  };
}

export type ResultEffect = 'cleared' | 'heart' | 'none';

/** What a result does to an enemy with `hearts` left: the Damage rules, as one picture. */
export function effectOf(kind: ResultKind, hearts: number): { effect: ResultEffect; hearts: number } {
  if (kind === 'done') return { effect: 'cleared', hearts: 0 };
  if (kind === 'partly' && hearts > 1) return { effect: 'heart', hearts: hearts - 1 };
  return { effect: 'none', hearts };
}

/** Bosses that fell and realms that are conquered: what the ceremony host announces. */
export function worldMoments(world: World): { bosses: string[]; realms: string[] } {
  const bosses = world.quests.filter((q) => isBoss(q, world.quests) && isCleared(q, world.results, world.quests)).map((q) => q.id);
  const realms = world.realms.filter((r) => isRealmConquered(r, world.quests, world.results)).map((r) => r.id);
  return { bosses, realms };
}

/**
 * After a saved session: its chest (MIN_SESSION_MIN or more) and, if it
 * targeted a quest still there to fight, the result to ask for. A session
 * without one stays a free session. Editing the times first: the chest waits
 * at camp and no result is asked (Mark done is on the Realm).
 */
export function afterSession(saved: Pick<Session, 'id' | 'duration'>, questId: string | null, world: World, editAfter: boolean): { lootFor: string | null; target: SessionTarget | null } {
  const loot = !editAfter && saved.duration / 60 >= MIN_SESSION_MIN;
  return { lootFor: loot ? saved.id : null, target: editAfter ? null : targetOf(world, questId) };
}
