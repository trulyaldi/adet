// World Mode's writes, pure: each takes the quest slice (items + links) and
// returns the next one, or the same slice when the write doesn't apply. A
// delete removes the item, which the store syncs as `deleted_at` (a soft
// delete); undoing a result removes it the same way. The store stamps
// `updatedAt`; nothing else is stored (hearts, cleared, progress are derived).

import { RESULT_UNDO_MS } from '../game/balance';
import { isIconKey } from '../look';
import { newId, QuestSlice } from '../items/ops';
import type { Item, QuestItem, RealmItem, ResultItem, ResultKind } from '../items/types';
import { availableSlots, isBoss, isCleared, liveQuests } from './rules';
import { isSlot, QUEST_TITLE_MAX, REALM_NAME_MAX, realmIdFor, worldOf } from './types';

const clean = (t: string, max: number) => t.replace(/\s+/g, ' ').trim().slice(0, max);
const iso = (ms: number) => new Date(ms).toISOString();

function live(q: QuestSlice) {
  const w = worldOf(q.items);
  return { ...w, quests: liveQuests(w) };
}

/** Claim a free biome slot as a realm (its id is `realm:<slot>`). No-op when taken, the name is empty or all 7 are used. */
export function claimSlot(q: QuestSlice, slot: number, name: string, icon: string, now: number): QuestSlice {
  const title = clean(name, REALM_NAME_MAX);
  if (!isSlot(slot) || !title || !isIconKey(icon)) return q;
  if (!availableSlots(worldOf(q.items).realms).includes(slot)) return q;
  const realm: RealmItem = { id: realmIdFor(slot), type: 'realm', title, body: '', props: { slot, icon }, habitId: null, createdAt: now };
  return { ...q, items: [...q.items.filter((i) => i.id !== realm.id), realm] };
}

function replace(q: QuestSlice, id: string, fn: (i: Item) => Item): QuestSlice {
  let changed = false;
  const items = q.items.map((i) => {
    if (i.id !== id) return i;
    const next = fn(i);
    if (next !== i) changed = true;
    return next;
  });
  return changed ? { ...q, items } : q;
}

export function renameRealm(q: QuestSlice, realmId: string, name: string): QuestSlice {
  const title = clean(name, REALM_NAME_MAX);
  if (!title) return q;
  return replace(q, realmId, (i) => (i.type === 'realm' && i.title !== title ? { ...i, title } : i));
}

/** A new quest on a realm's path (a mob until it has phases). */
export function addQuest(q: QuestSlice, realmId: string, title: string, now: number, id = newId('w', now)): QuestSlice {
  const t = clean(title, QUEST_TITLE_MAX);
  if (!t || !worldOf(q.items).realms.some((r) => r.id === realmId)) return q;
  const quest: QuestItem = { id, type: 'quest', title: t, body: '', props: { realmId }, habitId: null, createdAt: now };
  return { ...q, items: [...q.items, quest] };
}

/**
 * A phase of a top-level quest (two or more make it a boss). Not on a phase,
 * and not on a quest already cleared (enemies never heal, and a cleared mob
 * turning into an unbeaten boss would).
 */
export function addPhase(q: QuestSlice, parentQuestId: string, title: string, now: number, id = newId('w', now)): QuestSlice {
  const t = clean(title, QUEST_TITLE_MAX);
  const w = live(q);
  const parent = w.quests.find((x) => x.id === parentQuestId);
  if (!t || !parent || parent.parentQuestId || (!isBoss(parent, w.quests) && isCleared(parent, w.results, w.quests))) return q;
  const phase: QuestItem = { id, type: 'quest', title: t, body: '', props: { realmId: parent.realmId, parentQuestId }, habitId: null, createdAt: now };
  return { ...q, items: [...q.items, phase] };
}

export function renameQuest(q: QuestSlice, questId: string, title: string): QuestSlice {
  const t = clean(title, QUEST_TITLE_MAX);
  if (!t) return q;
  return replace(q, questId, (i) => (i.type === 'quest' && i.title !== t ? { ...i, title: t } : i));
}

/**
 * Tell the game a result for a quest. Not for a boss (its phases take the
 * results), a cleared quest or one that isn't live.
 */
export function recordResult(q: QuestSlice, questId: string, kind: ResultKind, now: number, sessionId?: string, id = newId('r', now)): QuestSlice {
  const w = live(q);
  const quest = w.quests.find((x) => x.id === questId);
  if (!quest || isBoss(quest, w.quests) || isCleared(quest, w.results, w.quests)) return q;
  const result: ResultItem = { id, type: 'result', title: '', body: '', props: { questId, kind, at: iso(now), ...(sessionId ? { sessionId } : {}) }, habitId: null, createdAt: now };
  return { ...q, items: [...q.items, result] };
}

/** Mark done: a Done with no session (something finished away from the timer). */
export function markDone(q: QuestSlice, questId: string, now: number, id?: string): QuestSlice {
  return recordResult(q, questId, 'done', now, undefined, id);
}

/** Take a result back (a soft delete), within RESULT_UNDO_MS of telling it. */
export function undoResult(q: QuestSlice, resultId: string, now: number): QuestSlice {
  const r = q.items.find((i): i is ResultItem => i.id === resultId && i.type === 'result');
  if (!r || now - Date.parse(r.props.at) > RESULT_UNDO_MS) return q;
  return { ...q, items: q.items.filter((i) => i !== r) };
}

/** Soft-delete a quest and its phases. Their results stay, unread, as history. */
export function softDeleteQuest(q: QuestSlice, questId: string): QuestSlice {
  const gone = new Set([questId]);
  for (const i of q.items) if (i.type === 'quest' && i.props.parentQuestId === questId) gone.add(i.id);
  const items = q.items.filter((i) => !(i.type === 'quest' && gone.has(i.id)));
  return items.length === q.items.length ? q : { ...q, items };
}
