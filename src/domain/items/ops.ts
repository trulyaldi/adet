// Pure writes on items and links. Each returns a new slice and only replaces
// the records it changes (sync finds edits by object identity), or the same
// slice when nothing changed.

import {
  achievementId,
  AchievementProps,
  chestClaimId,
  DEFAULT_QUEST_SETTINGS,
  Item,
  ItemOf,
  itemsOfType,
  Link,
  LinkKind,
  linkId,
  logId,
  QUEST_META_ID,
  QuestMetaItem,
  QuestMetaProps,
  TaskItem,
} from './types';

export interface QuestSlice {
  items: Item[];
  links: Link[];
}

const iso = (ms: number) => new Date(ms).toISOString();

/** A new client id: prefix, time and a little randomness (two quick adds never collide). */
export function newId(prefix: string, now: number): string {
  return prefix + now.toString(36) + Math.floor(Math.random() * 1296).toString(36).padStart(2, '0');
}

/** Longest title a weak point keeps. */
export const TASK_TITLE_MAX = 80;
/** Longest chronicle entry. */
export const LOG_BODY_MAX = 280;

const cleanTitle = (t: string) => t.replace(/\s+/g, ' ').trim().slice(0, TASK_TITLE_MAX);

function replaceItem(q: QuestSlice, id: string, fn: (i: Item) => Item | null): QuestSlice {
  let changed = false;
  const items: Item[] = [];
  for (const i of q.items) {
    if (i.id !== id) {
      items.push(i);
      continue;
    }
    const next = fn(i);
    if (next !== i) changed = true;
    if (next) items.push(next);
  }
  return changed ? { ...q, items } : q;
}

function upsertLink(links: Link[], kind: LinkKind, from: { type: Link['fromType']; id: string }, to: { type: Link['toType']; id: string }, now: number): Link[] {
  const id = linkId(kind, from.id, to.id);
  if (links.some((l) => l.id === id)) return links;
  return [...links, { id, kind, fromType: from.type, fromId: from.id, toType: to.type, toId: to.id, createdAt: now }];
}

// ---------------------------------------------------------------------------
// Weak points (tasks)
// ---------------------------------------------------------------------------

/** A habit's tasks, open first, each group by order. */
export function tasksFor(items: readonly Item[], habitId: string): TaskItem[] {
  return itemsOfType(items, 'task')
    .filter((t) => t.habitId === habitId)
    .sort((a, b) => {
      if (a.props.status !== b.props.status) return a.props.status === 'open' ? -1 : 1;
      return a.props.order - b.props.order || a.createdAt - b.createdAt;
    });
}

export function openTasksFor(items: readonly Item[], habitId: string): TaskItem[] {
  return tasksFor(items, habitId).filter((t) => t.props.status === 'open');
}

export function addTask(q: QuestSlice, habitId: string, title: string, now: number, id = newId('t', now)): QuestSlice {
  const t = cleanTitle(title);
  if (!t) return q;
  const open = openTasksFor(q.items, habitId);
  const order = open.length ? Math.max(...open.map((x) => x.props.order)) + 1 : 0;
  const task: TaskItem = { id, type: 'task', title: t, body: '', props: { status: 'open', order }, habitId, createdAt: now };
  return { ...q, items: [...q.items, task] };
}

export function renameTask(q: QuestSlice, id: string, title: string): QuestSlice {
  const t = cleanTitle(title);
  if (!t) return q;
  return replaceItem(q, id, (i) => (i.type === 'task' && i.title !== t ? { ...i, title: t } : i));
}

export function setTaskStatus(q: QuestSlice, id: string, status: 'open' | 'done', now: number): QuestSlice {
  return replaceItem(q, id, (i) => {
    if (i.type !== 'task' || i.props.status === status) return i;
    const props = status === 'done' ? { ...i.props, status, doneAt: iso(now) } : { status, order: i.props.order };
    return { ...i, props };
  });
}

/** Put a habit's open tasks in this order (ids not listed keep their place after them). */
export function reorderTasks(q: QuestSlice, habitId: string, orderedIds: string[]): QuestSlice {
  const pos = new Map(orderedIds.map((id, i) => [id, i]));
  const open = openTasksFor(q.items, habitId);
  const next = [...open].sort((a, b) => (pos.get(a.id) ?? orderedIds.length + a.props.order) - (pos.get(b.id) ?? orderedIds.length + b.props.order));
  const orderOf = new Map(next.map((t, i) => [t.id, i]));
  let changed = false;
  const items = q.items.map((i) => {
    const o = orderOf.get(i.id);
    if (o === undefined || i.type !== 'task' || i.props.order === o) return i;
    changed = true;
    return { ...i, props: { ...i.props, order: o } };
  });
  return changed ? { ...q, items } : q;
}

/** Soft-delete a task (a delete syncs as deleted_at) and its planned links. */
export function deleteTask(q: QuestSlice, id: string): QuestSlice {
  const next = replaceItem(q, id, (i) => (i.type === 'task' ? null : i));
  if (next === q) return q;
  const links = next.links.filter((l) => !(l.fromId === id && l.kind === 'planned_for'));
  return links.length === next.links.length ? next : { ...next, links };
}

/** Planned weak points for a session (Choose). */
export function planTasks(q: QuestSlice, sessionId: string, taskIds: string[], now: number): QuestSlice {
  let links = q.links;
  for (const t of taskIds) links = upsertLink(links, 'planned_for', { type: 'item', id: t }, { type: 'session', id: sessionId }, now);
  return links === q.links ? q : { ...q, links };
}

// ---------------------------------------------------------------------------
// Chests and the chronicle
// ---------------------------------------------------------------------------

export interface ChestClaim {
  sessionId: string;
  habitId: string | null;
  /** Weak points ticked as done in this session. */
  doneTaskIds: string[];
  /** The one line about what was done (may be empty when boxes were ticked). */
  text: string;
  now: number;
}

/**
 * Open a session's chest: a chest_claim, the chronicle entry (even with no
 * text when boxes were ticked), completed_in links, and the ticked tasks done.
 * Claiming twice is a no-op.
 */
export function claimChest(q: QuestSlice, c: ChestClaim): QuestSlice {
  const cid = chestClaimId(c.sessionId);
  if (q.items.some((i) => i.id === cid)) return q;
  const body = c.text.trim().slice(0, LOG_BODY_MAX);
  const items: Item[] = [
    ...q.items,
    { id: cid, type: 'chest_claim', title: '', body: '', props: { sessionId: c.sessionId, claimedAt: iso(c.now) }, habitId: c.habitId, createdAt: c.now },
  ];
  const lid = logId(c.sessionId);
  if ((body || c.doneTaskIds.length) && !items.some((i) => i.id === lid)) {
    items.push({ id: lid, type: 'log', title: '', body, props: { sessionId: c.sessionId }, habitId: c.habitId, createdAt: c.now });
  }
  let next: QuestSlice = { items, links: q.links };
  let links = next.links;
  if (items.some((i) => i.id === lid)) {
    links = upsertLink(links, 'chronicles', { type: 'item', id: lid }, { type: 'session', id: c.sessionId }, c.now);
  }
  for (const t of c.doneTaskIds) {
    if (!next.items.some((i) => i.id === t && i.type === 'task')) continue;
    links = upsertLink(links, 'completed_in', { type: 'item', id: t }, { type: 'session', id: c.sessionId }, c.now);
    next = setTaskStatus(next, t, 'done', c.now);
  }
  return { ...next, links };
}

export function editLog(q: QuestSlice, id: string, body: string): QuestSlice {
  const b = body.trim().slice(0, LOG_BODY_MAX);
  return replaceItem(q, id, (i) => (i.type === 'log' && i.body !== b ? { ...i, body: b } : i));
}

// ---------------------------------------------------------------------------
// Shop, achievements, quest meta
// ---------------------------------------------------------------------------

export function addPurchase(q: QuestSlice, sku: string, cost: number, now: number, month?: string, id = newId('p', now)): QuestSlice {
  const props = month ? { sku, cost, month } : { sku, cost };
  return { ...q, items: [...q.items, { id, type: 'purchase', title: '', body: '', props, habitId: null, createdAt: now }] };
}

/** Append achievements that aren't recorded yet (never edits or removes one). */
export function addAchievements(q: QuestSlice, list: AchievementProps[], now: number): QuestSlice {
  const have = new Set(q.items.map((i) => i.id));
  const add: Item[] = [];
  for (const a of list) {
    const id = achievementId(a.kind, a.ref);
    if (have.has(id)) continue;
    have.add(id);
    add.push({ id, type: 'achievement', title: '', body: '', props: a, habitId: null, createdAt: now });
  }
  return add.length ? { ...q, items: [...q.items, ...add] } : q;
}

export function questMetaOf(items: readonly Item[]): QuestMetaItem | null {
  return (items.find((i) => i.id === QUEST_META_ID && i.type === 'quest_meta') as QuestMetaItem | undefined) ?? null;
}

export function defaultQuestMeta(now: number): QuestMetaProps {
  return { startedAt: iso(now), avatar: { gear: {} }, settings: DEFAULT_QUEST_SETTINGS };
}

/** Start the journey (onboarding): writes quest_meta once. */
export function startQuest(q: QuestSlice, now: number): QuestSlice {
  if (questMetaOf(q.items)) return q;
  const meta: QuestMetaItem = { id: QUEST_META_ID, type: 'quest_meta', title: '', body: '', props: defaultQuestMeta(now), habitId: null, createdAt: now };
  return { ...q, items: [...q.items, meta] };
}

/**
 * Edit quest_meta's props. Nothing happens before the journey starts: only
 * onboarding may write `startedAt`, since it decides which sessions have chests.
 */
export function updateQuestMeta(q: QuestSlice, fn: (p: QuestMetaProps) => QuestMetaProps, _now: number): QuestSlice {
  return replaceItem(q, QUEST_META_ID, (i) => {
    if (i.type !== 'quest_meta') return i;
    const props = fn(i.props);
    return props === i.props ? i : { ...i, props };
  });
}

/** Items of a type, by id, for quick lookups. */
export function indexById<T extends Item['type']>(items: readonly Item[], type: T): Map<string, ItemOf<T>> {
  return new Map(itemsOfType(items, type).map((i) => [i.id, i]));
}
