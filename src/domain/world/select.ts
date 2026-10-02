// What the Overworld and Realm screens read, derived from the item list. Pure.

import type { Item } from '../items/types';
import { MAX_REALMS } from '../game/balance';
import { BossProgress, bossProgress, heartsOf, isBoss, isCleared, isRealmConquered, liveQuests, phasesOf, resultsFor, World } from './rules';
import { Quest, Realm, Result, worldOf } from './types';

export interface QuestView {
  quest: Quest;
  hearts: number;
  cleared: boolean;
  /** Its newest result, for the 6-second undo. */
  lastResult: Result | null;
}

export interface MobView extends QuestView {
  kind: 'mob';
  /** A single phase waiting for a second one (a quest needs two to be a boss). */
  phases: QuestView[];
}

export interface BossView extends QuestView {
  kind: 'boss';
  phases: QuestView[];
  progress: BossProgress;
}

export type PathNode = MobView | BossView;

export interface RealmView {
  realm: Realm;
  /** The realm's path, oldest first: mobs and bosses as one list. */
  path: PathNode[];
  /** Nothing on the path yet ("What do you want to beat?"). */
  empty: boolean;
  conquered: boolean;
  cleared: number;
  total: number;
}

export interface SlotView {
  slot: number;
  realm: Realm | null;
  conquered: boolean;
}

/** The world with only live quests (deleted ones and their phases dropped). */
export function liveWorld(items: readonly Item[]): World {
  const w = worldOf(items);
  return { ...w, quests: liveQuests(w) };
}

function questView(q: Quest, w: World): QuestView {
  const own = resultsFor(q.id, w.results);
  const last = own.reduce<Result | null>((a, r) => (!a || r.at > a.at || (r.at === a.at && r.id > a.id) ? r : a), null);
  return { quest: q, hearts: heartsOf(q, w.results, w.quests), cleared: isCleared(q, w.results, w.quests), lastResult: last };
}

/** One realm's screen, or null if there's no such realm. */
export function realmView(items: readonly Item[], realmId: string): RealmView | null {
  const w = liveWorld(items);
  const realm = w.realms.find((r) => r.id === realmId);
  if (!realm) return null;
  const top = w.quests.filter((q) => q.realmId === realmId && !q.parentQuestId);
  const path: PathNode[] = top.map((q) => {
    const phases = phasesOf(q, w.quests).map((p) => questView(p, w));
    return isBoss(q, w.quests) ? { kind: 'boss', ...questView(q, w), phases, progress: bossProgress(q, w.quests, w.results) } : { kind: 'mob', ...questView(q, w), phases };
  });
  const cleared = path.filter((n) => n.cleared).length;
  return { realm, path, empty: path.length === 0, conquered: isRealmConquered(realm, w.quests, w.results), cleared, total: path.length };
}

/** The Overworld: all 7 slots, claimed or under cloud. */
export function slotsView(items: readonly Item[]): SlotView[] {
  const w = liveWorld(items);
  return Array.from({ length: MAX_REALMS }, (_, slot) => {
    const realm = w.realms.find((r) => r.slot === slot) ?? null;
    return { slot, realm, conquered: realm ? isRealmConquered(realm, w.quests, w.results) : false };
  });
}

/** A quest by id with its realm, for a sheet or the timer (null when gone). */
export function questById(items: readonly Item[], questId: string): { quest: Quest; realm: Realm; view: QuestView } | null {
  const w = liveWorld(items);
  const quest = w.quests.find((q) => q.id === questId);
  const realm = quest && w.realms.find((r) => r.id === quest.realmId);
  return quest && realm ? { quest, realm, view: questView(quest, w) } : null;
}
