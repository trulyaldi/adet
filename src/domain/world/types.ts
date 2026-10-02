// World Mode's three records (docs/quest/world/PLAN.MD, "Design"): a Realm on
// one of the 7 biome slots, a Quest in it (a phase when it has a parent), and
// a Result told after a session or with Mark done. All three are stored as
// `items` (types realm, quest, result; migration 006, no new table), with
// their references in props. Pure.

import { isIconKey } from '../look';
import type { IconKey } from '../types';
import { Item, itemsOfType, ResultKind } from '../items/types';
import { MAX_REALMS } from '../game/balance';

export type { ResultKind } from '../items/types';

export interface Realm {
  id: string;
  /** Biome slot 0–6 (forest … astral): its art, palette, mobs and boss sprite. */
  slot: number;
  name: string;
  icon: IconKey;
}

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

export const realmIdFor = (slot: number) => `realm:${slot}`;
export const isSlot = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < MAX_REALMS;

/** The world's records out of the item list. Malformed ones (no slot, no realm, no quest) are left out. */
export function worldOf(items: readonly Item[]): { realms: Realm[]; quests: Quest[]; results: Result[] } {
  const realms: Realm[] = [];
  const bySlot = new Set<number>();
  for (const r of itemsOfType(items, 'realm').sort((a, b) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : 1))) {
    // One realm per slot: the first claim wins if two devices raced.
    if (!isSlot(r.props.slot) || bySlot.has(r.props.slot)) continue;
    bySlot.add(r.props.slot);
    realms.push({ id: r.id, slot: r.props.slot, name: r.title, icon: isIconKey(r.props.icon) ? r.props.icon : FALLBACK_ICON });
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
  return { realms, quests, results };
}
