// World Mode's writes, pure: each takes the quest slice (items + links) and
// returns the next one, or the same slice when the write doesn't apply. A
// delete removes the item, which the store syncs as `deleted_at` (a soft
// delete); undoing a result removes it the same way. The store stamps
// `updatedAt`; nothing else is stored (hearts, cleared, progress are derived).

import { RESULT_UNDO_MS } from '../game/balance';
import { isIconKey, projectLook } from '../look';
import { newId, QuestSlice } from '../items/ops';
import { itemsOfType } from '../items/types';
import type { Item, QuestItem, RealmItem, ResultItem, ResultKind } from '../items/types';
import { attachPending, availableSlots, isBoss, isCleared, liveQuests } from './rules';
import { isSlot, ProjectRef, projectIdOf, projectsByAge, QUEST_TITLE_MAX, REALM_NAME_MAX, realmIdFor, realmIdForProject, realmNameFrom, UNPLACED, worldOf, PROJECT_REALM_PREFIX } from './types';

const clean = (t: string, max: number) => t.replace(/\s+/g, ' ').trim().slice(0, max);
const iso = (ms: number) => new Date(ms).toISOString();

/** The quests a write may act on: those of placed realms (a resting realm takes no new quest, phase or result). */
function live(q: QuestSlice) {
  const w = worldOf(q.items);
  return { ...w, quests: liveQuests({ realms: w.realms, quests: w.quests }) };
}

/**
 * Claim a free biome slot as a realm (its id is `realm:<slot>`). No-op when
 * taken, the name is empty or all 7 are used. Never replaces a realm that is
 * linked to a project (one resting on this slot's id keeps its quests).
 */
export function claimSlot(q: QuestSlice, slot: number, name: string, icon: string, now: number): QuestSlice {
  const title = clean(name, REALM_NAME_MAX);
  if (!isSlot(slot) || !title || !isIconKey(icon)) return q;
  if (!availableSlots(worldOf(q.items).realms).includes(slot)) return q;
  if (itemsOfType(q.items, 'realm').some((r) => r.id === realmIdFor(slot) && projectIdOf(r))) return q;
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
  // One result per session: a second tap (or a remount) can't record twice. An undone one frees it.
  if (sessionId && w.results.some((r) => r.sessionId === sessionId)) return q;
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

// ---------------------------------------------------------------------------
// Projects as realms (docs/quest/world/PROJECT_REALMS.md). A realm is a
// project, one to one; its id is derived from the project, so a slot moving
// never touches a quest. Nothing here deletes a realm item.
// ---------------------------------------------------------------------------

const realmItems = (q: QuestSlice, projectId: string) => itemsOfType(q.items, 'realm').filter((r) => projectIdOf(r) === projectId);

/**
 * Give a project its realm on the lowest free slot (id `realm:p:<projectId>`,
 * `props.projectId` set). No-op when the project already has a realm (placed
 * or resting: a restored project is placed again by reconcileRealms), when
 * no slot is free (it has no realm, and its sessions stay free sessions), or
 * when the name is empty or the icon unknown. `projects` frees the slot of a
 * realm whose project is archived or missing (see worldOf).
 */
export function claimSlotForProject(q: QuestSlice, projectId: string, name: string, icon: string, now: number, projects?: readonly ProjectRef[]): QuestSlice {
  const title = realmNameFrom(name);
  if (!projectId || !title || !isIconKey(icon) || realmItems(q, projectId).length) return q;
  const slot = availableSlots(worldOf(q.items, projects).realms)[0];
  if (slot === undefined) return q;
  const realm: RealmItem = { id: realmIdForProject(projectId), type: 'realm', title, body: '', props: { slot, icon, projectId }, habitId: null, createdAt: now };
  return { ...q, items: [...q.items.filter((i) => i.id !== realm.id), realm] };
}

/**
 * The one-time attach: a hand-claimed realm becomes a project's. Only
 * `props.projectId` is set, so its id, slot, name, icon, quests and results
 * are untouched. Idempotent (the same project again changes nothing). No-op
 * for an unknown realm, one already linked to another project or kept as it
 * is, or a project that already has a realm.
 */
export function linkRealm(q: QuestSlice, realmId: string, projectId: string): QuestSlice {
  const r = itemsOfType(q.items, 'realm').find((x) => x.id === realmId);
  if (!r || !projectId) return q;
  const linked = projectIdOf(r);
  if (linked === projectId) return q;
  if (linked || r.props.manual || realmItems(q, projectId).length) return q;
  return replace(q, realmId, (i) => (i.type === 'realm' ? { ...i, props: { ...i.props, projectId } } : i));
}

/** The attach choice "keep it as it is": the realm stays hand-claimed (and renamable) for good. Idempotent; no-op on a linked realm. */
export function keepRealm(q: QuestSlice, realmId: string): QuestSlice {
  return replace(q, realmId, (i) => (i.type === 'realm' && !projectIdOf(i) && !i.props.manual ? { ...i, props: { ...i.props, manual: true } } : i));
}

/** Copy a project's name and icon into its realm item (the snapshot the flag-off path and older builds read). No-op when equal or invalid. */
export function syncRealmLook(q: QuestSlice, realmId: string, name: string, icon: string): QuestSlice {
  const title = realmNameFrom(name);
  if (!title || !isIconKey(icon)) return q;
  return replace(q, realmId, (i) => (i.type === 'realm' && (i.title !== title || i.props.icon !== icon) ? { ...i, title, props: { ...i.props, icon } } : i));
}

const setSlot = (q: QuestSlice, realmId: string, slot: number): QuestSlice =>
  replace(q, realmId, (i) => (i.type === 'realm' && i.props.slot !== slot ? { ...i, props: { ...i.props, slot } } : i));

/**
 * Bring the realms in line with the projects (PROJECT_REALMS.md, "Where
 * realms come from"). Pure and idempotent: a second run changes nothing, and
 * it returns the same slice when there is nothing to do. The caller runs it
 * only when the flag and quest tables are on, the journey has started and
 * sync has settled (`projects` must be the full list, or a project that
 * hasn't been pulled yet reads as deleted).
 *
 *   1 rest     a realm whose project is archived or missing loses its slot
 *   2 ties     the older project keeps a contested slot (worldOf); the other is placed again below
 *   3 create   an active project with no realm gets one on the lowest free slot (none free: no realm)
 *   4 place    an active project whose realm has no slot gets the lowest free one (none free: it waits)
 *   5 mirror   a realm created for a project follows the project's name and icon
 *
 * Projects are served oldest first. It waits (changes nothing) while the
 * attach choice has something to ask. Hand-claimed realms are never touched.
 * Nothing is deleted, no quest or result changes.
 */
export function reconcileRealms(q: QuestSlice, projects: readonly ProjectRef[], now: number): QuestSlice {
  const active = projects.filter((p) => p.archivedAt == null);
  if (attachPending(worldOf(q.items, projects), active.map((p) => p.id))) return q;
  const byId = new Map(projects.map((p) => [p.id, p]));
  let cur = q;
  // 1 rest
  for (const r of itemsOfType(q.items, 'realm')) {
    const pid = projectIdOf(r);
    const p = pid ? byId.get(pid) : undefined;
    if (pid && (!p || p.archivedAt != null) && r.props.slot !== UNPLACED) cur = setSlot(cur, r.id, UNPLACED);
  }
  // 2-4 in project order, so every device allocates alike
  for (const p of projectsByAge(active)) {
    const owner = itemsOfType(cur.items, 'realm')
      .filter((r) => projectIdOf(r) === p.id)
      .sort((a, b) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : 1))[0];
    const look = projectLook(p).icon;
    if (!owner) {
      cur = claimSlotForProject(cur, p.id, p.name, look, now, projects);
      continue;
    }
    const w = worldOf(cur.items, projects);
    if (w.realms.some((r) => r.id === owner.id)) continue;
    const slot = availableSlots(w.realms)[0];
    if (slot !== undefined) cur = setSlot(cur, owner.id, slot);
  }
  // 5 mirror (not onto a hand-claimed realm that was attached: it keeps its own name and icon)
  for (const r of itemsOfType(cur.items, 'realm')) {
    const p = r.id.startsWith(PROJECT_REALM_PREFIX) ? byId.get(projectIdOf(r) ?? '') : undefined;
    if (p) cur = syncRealmLook(cur, r.id, p.name, projectLook(p).icon);
  }
  return cur === q || cur.items === q.items ? q : cur;
}
