// World Mode's rules (docs/quest/world/PLAN.MD, "Damage rules"), all derived
// from result rows; nothing stores a counter. Pure.
//
//   Done       the quest is cleared.
//   Partly     one heart, never the last: hearts floor at 1.
//   Not yet    nothing.
//   Mark done  a Done without a session.
//
// A quest with BOSS_MIN_PHASES or more phases is a boss; it falls when all
// its phases are cleared, in any order, and takes no results of its own. A
// soft-deleted quest (gone from the list) drops out, and so do its phases.
// Enemies never heal: only undoing a result (a soft delete) gives a heart back.

import { BOSS_DEFEAT_CREDITS, BOSS_MIN_PHASES, CLEAR_CREDITS, MAX_REALMS, QUEST_HEARTS } from '../game/balance';
import type { Quest, Realm, Result } from './types';

export interface World {
  /** Placed realms (on the map). */
  realms: Realm[];
  /** Realms that exist but rest (see worldOf): their quests stay live for credits and trophies, but nothing places or targets them. */
  resting?: Realm[];
  quests: Quest[];
  results: Result[];
}

const byOrder = (a: Quest, b: Quest) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : 1);

/**
 * The quests still in play: their realm exists (placed or resting) and, for a phase, its parent is
 * a live top-level quest of the same realm (phases don't nest).
 */
export function liveQuests(world: { realms: readonly Realm[]; resting?: readonly Realm[]; quests: readonly Quest[] }): Quest[] {
  const realms = new Set([...world.realms, ...(world.resting ?? [])].map((r) => r.id));
  const top = new Map<string, Quest>();
  for (const q of world.quests) if (!q.parentQuestId && realms.has(q.realmId)) top.set(q.id, q);
  const out: Quest[] = [...top.values()];
  for (const q of world.quests) {
    if (!q.parentQuestId) continue;
    const parent = top.get(q.parentQuestId);
    if (parent && parent.realmId === q.realmId) out.push(q);
  }
  return out.sort(byOrder);
}

/** A quest's own results (undone ones are already gone from the list). */
export function resultsFor(questId: string, results: readonly Result[]): Result[] {
  return results.filter((r) => r.questId === questId);
}

export function phasesOf(quest: Quest, quests: readonly Quest[]): Quest[] {
  return quests.filter((q) => q.parentQuestId === quest.id).sort(byOrder);
}

export function isBoss(quest: Quest, quests: readonly Quest[]): boolean {
  return !quest.parentQuestId && phasesOf(quest, quests).length >= BOSS_MIN_PHASES;
}

/** Cleared by its own Done (a mob or a phase), or for a boss, by all its phases. */
export function isCleared(quest: Quest, results: readonly Result[], quests: readonly Quest[] = []): boolean {
  if (isBoss(quest, quests)) return phasesOf(quest, quests).every((p) => isCleared(p, results, quests));
  return resultsFor(quest.id, results).some((r) => r.kind === 'done');
}

/**
 * Hearts left: 0 once cleared; else 3 less one per Partly, never below 1 (the
 * last heart only falls to a Done). A boss shows full hearts until it falls;
 * its progress is its phases (bossProgress).
 */
export function heartsOf(quest: Quest, results: readonly Result[], quests: readonly Quest[] = []): number {
  if (isCleared(quest, results, quests)) return 0;
  if (isBoss(quest, quests)) return QUEST_HEARTS;
  const partly = resultsFor(quest.id, results).filter((r) => r.kind === 'partly').length;
  return Math.max(1, QUEST_HEARTS - partly);
}

export interface BossProgress {
  cleared: number;
  total: number;
  defeated: boolean;
}

export function bossProgress(quest: Quest, quests: readonly Quest[], results: readonly Result[]): BossProgress {
  const phases = phasesOf(quest, quests);
  const cleared = phases.filter((p) => isCleared(p, results, quests)).length;
  return { cleared, total: phases.length, defeated: phases.length >= BOSS_MIN_PHASES && cleared === phases.length };
}

/** A realm is conquered once it has quests and every one on its path is cleared (adding one opens it again). */
export function isRealmConquered(realm: Realm, quests: readonly Quest[], results: readonly Result[]): boolean {
  const live = liveQuests({ realms: [realm], quests });
  const top = live.filter((q) => !q.parentQuestId);
  return top.length > 0 && top.every((q) => isCleared(q, results, live));
}

/** Biome slots not yet claimed, in order (none once all 7 are realms). */
export function availableSlots(realms: readonly Realm[]): number[] {
  const taken = new Set(realms.map((r) => r.slot));
  return Array.from({ length: MAX_REALMS }, (_, i) => i).filter((s) => !taken.has(s));
}

/**
 * A project's realm, placed or resting (a resting one has `slot` UNPLACED),
 * or undefined when the project has none (an eighth project, or one not yet
 * reconciled).
 */
export function realmOfProject(world: Pick<World, 'realms' | 'resting'>, projectId: string): Realm | undefined {
  return world.realms.find((r) => r.projectId === projectId) ?? world.resting?.find((r) => r.projectId === projectId);
}

/** Of `projectIds`, those with no realm at all, in the order given (the attach choice's candidates, and what the reconcile creates for). */
export function projectsWithoutRealm(world: Pick<World, 'realms' | 'resting'>, projectIds: readonly string[]): string[] {
  const has = new Set([...world.realms, ...(world.resting ?? [])].flatMap((r) => (r.projectId ? [r.projectId] : [])));
  return projectIds.filter((id) => !has.has(id));
}

/** Placed realms with no project and no answer yet to the attach choice (hand-claimed before project realms). */
export function unlinkedRealms(world: Pick<World, 'realms'>): Realm[] {
  return world.realms.filter((r) => !r.projectId && !r.manual);
}

/** The attach sheet has something to ask: an unanswered realm and a project with no realm. The reconcile waits while this holds. */
export function attachPending(world: Pick<World, 'realms' | 'resting'>, activeProjectIds: readonly string[]): boolean {
  return unlinkedRealms(world).length > 0 && projectsWithoutRealm(world, activeProjectIds).length > 0;
}

/** When a quest was cleared: its first Done, or for a boss the moment its last phase fell. Null if not cleared. */
export function clearedAt(quest: Quest, results: readonly Result[], quests: readonly Quest[]): number | null {
  if (isBoss(quest, quests)) {
    const times = phasesOf(quest, quests).map((p) => clearedAt(p, results, quests));
    return times.every((t) => t !== null) ? Math.max(...(times as number[])) : null;
  }
  const done = resultsFor(quest.id, results).filter((r) => r.kind === 'done');
  return done.length ? Math.min(...done.map((r) => r.at)) : null;
}

/**
 * Credits from results (on top of time's chests and credits): CLEAR_CREDITS
 * for each mob or phase cleared, BOSS_DEFEAT_CREDITS for each boss that fell,
 * counted only when it happened on the journey (from `startedAt`).
 */
export function worldCredits(world: World, startedAt: number | null): number {
  if (startedAt === null) return 0;
  const live = liveQuests(world);
  let credits = 0;
  for (const q of live) {
    const at = clearedAt(q, world.results, live);
    if (at === null || at < startedAt) continue;
    credits += isBoss(q, live) ? BOSS_DEFEAT_CREDITS : CLEAR_CREDITS;
  }
  return credits;
}
