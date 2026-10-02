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
  METRIC_LABEL_MAX,
  metricDefId,
  QUEST_META_ID,
  QuestMetaItem,
  QuestMetaProps,
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

/** Longest chronicle entry. */
export const LOG_BODY_MAX = 280;

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
// Chests and the chronicle
// ---------------------------------------------------------------------------

export interface ChestClaim {
  sessionId: string;
  habitId: string | null;
  /** The one line about what was done (may be empty). */
  text: string;
  /** How much of the habit's measure was done (optional; never rewarded). */
  amount?: { value: number; metricId: string };
  now: number;
}

const cleanAmount = (a: { value: number; metricId: string } | undefined) =>
  a && Number.isFinite(a.value) && a.value >= 0 && a.metricId ? { amount: Math.round(a.value * 100) / 100, metricId: a.metricId } : {};

/**
 * Open a session's chest: a chest_claim and, with a line or an amount, the
 * chronicle entry. Claiming twice is a no-op.
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
  const amount = cleanAmount(c.amount);
  if ((body || 'amount' in amount) && !items.some((i) => i.id === lid)) {
    items.push({ id: lid, type: 'log', title: '', body, props: { sessionId: c.sessionId, ...amount }, habitId: c.habitId, createdAt: c.now });
  }
  let links = q.links;
  if (items.some((i) => i.id === lid)) {
    links = upsertLink(links, 'chronicles', { type: 'item', id: lid }, { type: 'session', id: c.sessionId }, c.now);
  }
  return { items, links };
}

/**
 * A quick log: an activity recorded at any time, without a session. Always
 * saved; rewards are capped per day in the derived game, not here.
 */
export function addQuickLog(q: QuestSlice, l: { habitId: string; text: string; amount?: { value: number; metricId: string }; now: number }, id = newId('q', l.now)): QuestSlice {
  const body = l.text.trim().slice(0, LOG_BODY_MAX);
  const amount = cleanAmount(l.amount);
  if (!body && !('amount' in amount)) return q;
  return { ...q, items: [...q.items, { id, type: 'log', title: '', body, props: { sessionId: '', ...amount }, habitId: l.habitId, createdAt: l.now }] };
}

/** Set a habit's one measure (label and unit). Empty label: nothing changes. */
export function setMetric(q: QuestSlice, habitId: string, label: string, unit: string, now: number): QuestSlice {
  const l = label.replace(/\s+/g, ' ').trim().slice(0, METRIC_LABEL_MAX);
  const u = unit.replace(/\s+/g, ' ').trim().slice(0, METRIC_LABEL_MAX);
  if (!l) return q;
  const id = metricDefId(habitId);
  const existing = q.items.find((i) => i.id === id);
  if (!existing) return { ...q, items: [...q.items, { id, type: 'metric_def', title: '', body: '', props: { label: l, unit: u }, habitId, createdAt: now }] };
  return replaceItem(q, id, (i) => (i.type === 'metric_def' && (i.props.label !== l || i.props.unit !== u) ? { ...i, props: { label: l, unit: u } } : i));
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
