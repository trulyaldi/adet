// Generic items and links (migration 006_quest), and the typed props of every
// item type Quest Mode uses. Pure: no React or RN, shared with future builds.
//
//   type          purpose                          props
//   task          a weak point (dormant: removed)  { status, order, doneAt? }
//   log           a chronicle entry (body = text)  { sessionId, amount?, metricId? }
//                 sessionId '' is a quick log: an activity recorded without a session
//   metric_def    a habit's one measure            { label, unit }   (id `metric:<habitId>`)
//   chest_claim   a session's chest was opened     { sessionId, claimedAt }
//   purchase      a shop purchase                  { sku, cost, month? }
//   achievement   an append-only milestone         { kind, ref, at }
//   quest_meta    the quest's singleton            { startedAt, avatar, companion?, campfire?, settings }
//   realm         a World Mode goal area on a biome slot (title = name)   { slot, icon, projectId?, manual? }
//                 id `realm:<slot>` (hand-claimed) or `realm:p:<projectId>` (a project's realm); slot -1 = not placed
//   quest         a mob, or a phase of a boss (title = what to beat)      { realmId, parentQuestId? }
//   result        what a session (or Mark done) did to a quest            { questId, sessionId?, kind, at }
//
// Link kinds: task → session `planned_for` / `completed_in`; log → session `chronicles`.

export type ItemType = 'task' | 'log' | 'chest_claim' | 'purchase' | 'achievement' | 'quest_meta' | 'metric_def' | 'realm' | 'quest' | 'result';
export const ITEM_TYPES: readonly ItemType[] = ['task', 'log', 'chest_claim', 'purchase', 'achievement', 'quest_meta', 'metric_def', 'realm', 'quest', 'result'];

export interface TaskProps {
  status: 'open' | 'done';
  /** Position among the habit's tasks (lower first). */
  order: number;
  /** ISO time it was completed. */
  doneAt?: string;
}

export interface LogProps {
  /** The session it chronicles; '' for a quick log (no session). */
  sessionId: string;
  /** How much of the habit's measure was done (e.g. 12 pages). Never rewarded. */
  amount?: number;
  /** The measure `amount` is in (a metric_def id). */
  metricId?: string;
}

/** A habit's measure: what "how much" means for it (pages, problems, words). */
export interface MetricDefProps {
  label: string;
  unit: string;
}

export interface ChestClaimProps {
  sessionId: string;
  /** ISO time the chest was opened. */
  claimedAt: string;
}

export interface PurchaseProps {
  sku: string;
  cost: number;
  /** 'YYYY-MM' the purchase counts for (streak freezes). */
  month?: string;
}

/**
 * Only `boss_defeated` is written (ranks and levels are derived; ceremonies use
 * device-local marks). The others are still parsed: older builds wrote them.
 */
export type AchievementKind =
  | 'boss_defeated'
  /** @deprecated not written; implied by `boss_defeated`. */
  | 'biome_cleared'
  /** @deprecated not written; ranks are derived. */
  | 'rank_reached';

export interface AchievementProps {
  kind: AchievementKind;
  /** What it's for, e.g. "forest:0" (biome id and ascension loop) or a rank title. */
  ref: string;
  /** ISO time it happened. */
  at: string;
}

export type GearSlot = 'cloak' | 'helmet' | 'banner' | 'weapon';
export const GEAR_SLOTS: readonly GearSlot[] = ['cloak', 'helmet', 'banner', 'weapon'];

/** Reduce motion in the Quest world: follow the system, or force it. */
export type QuestMotion = 'system' | 'reduce' | 'full';

export interface QuestSettings {
  sfx: boolean;
  music: boolean;
  haptics: boolean;
  /** The AI Sage (opt-in; chronicle entries are sent to generate suggestions). */
  ai: boolean;
  /** The privacy line was shown the first time AI was turned on. */
  aiNoticeSeen: boolean;
  /** The scene (the Stage) on the timer screen. The key keeps its shipped name. */
  battleStrip: boolean;
  motion: QuestMotion;
  /** Custom NPC names by NPC id; empty = the defaults. */
  npcNames: Record<string, string>;
}

export const DEFAULT_QUEST_SETTINGS: QuestSettings = {
  sfx: true,
  music: false,
  haptics: true,
  ai: false,
  aiNoticeSeen: false,
  battleStrip: true,
  motion: 'system',
  npcNames: {},
};

export interface QuestMetaProps {
  /** ISO time the journey started (the onboarding cutscene). Only later sessions move the journey. */
  startedAt: string;
  avatar: { gear: Partial<Record<GearSlot, string>> };
  companion?: string;
  campfire?: string;
  settings: QuestSettings;
}

/**
 * World Mode: a realm claims one of the 7 biome slots (0–6; -1 while it rests).
 * `icon` is an IconKey, checked by domain/world. With `projectId` it is that
 * project's realm (the project gives its name and icon); `manual` marks a
 * hand-claimed realm kept as it is (PROJECT_REALMS.md).
 */
export interface RealmProps {
  slot: number;
  icon: string;
  projectId?: string;
  manual?: boolean;
}

/** World Mode: a quest in a realm; with `parentQuestId` it is a phase of that (boss) quest. */
export interface QuestItemProps {
  realmId: string;
  parentQuestId?: string;
}

export type ResultKind = 'done' | 'partly' | 'not_yet';
export const RESULT_KINDS: readonly ResultKind[] = ['done', 'partly', 'not_yet'];

/** World Mode: one result told to the game (soft-deleted to undo). */
export interface ResultProps {
  questId: string;
  /** The session it followed; absent for Mark done. */
  sessionId?: string;
  kind: ResultKind;
  /** ISO time it was told. */
  at: string;
}

export interface PropsByType {
  task: TaskProps;
  log: LogProps;
  chest_claim: ChestClaimProps;
  purchase: PurchaseProps;
  achievement: AchievementProps;
  quest_meta: QuestMetaProps;
  metric_def: MetricDefProps;
  realm: RealmProps;
  quest: QuestItemProps;
  result: ResultProps;
}

interface ItemBase<T extends ItemType> {
  id: string;
  type: T;
  title: string;
  body: string;
  props: PropsByType[T];
  /** The habit it belongs to (tasks, logs), else null. */
  habitId: string | null;
  /** Epoch ms. */
  createdAt: number;
  /** Epoch ms of the last local edit; set by the store, used for sync conflicts. */
  updatedAt?: number;
}

export type TaskItem = ItemBase<'task'>;
export type LogEntryItem = ItemBase<'log'>;
export type ChestClaimItem = ItemBase<'chest_claim'>;
export type PurchaseItem = ItemBase<'purchase'>;
export type AchievementItem = ItemBase<'achievement'>;
export type QuestMetaItem = ItemBase<'quest_meta'>;
export type MetricDefItem = ItemBase<'metric_def'>;
export type RealmItem = ItemBase<'realm'>;
export type QuestItem = ItemBase<'quest'>;
export type ResultItem = ItemBase<'result'>;

export type Item = TaskItem | LogEntryItem | ChestClaimItem | PurchaseItem | AchievementItem | QuestMetaItem | MetricDefItem | RealmItem | QuestItem | ResultItem;
export type ItemOf<T extends ItemType> = Extract<Item, { type: T }>;

export type LinkEnd = 'item' | 'session' | 'habit';
export type LinkKind = 'planned_for' | 'completed_in' | 'chronicles';
export const LINK_KINDS: readonly LinkKind[] = ['planned_for', 'completed_in', 'chronicles'];

export interface Link {
  id: string;
  fromType: LinkEnd;
  fromId: string;
  toType: LinkEnd;
  toId: string;
  kind: LinkKind;
  /** Epoch ms. */
  createdAt: number;
  updatedAt?: number;
}

// ---------------------------------------------------------------------------
// Deterministic ids: records two devices might both write collapse into one
// under last-write-wins.
// ---------------------------------------------------------------------------

export const QUEST_META_ID = 'quest_meta';
export const chestClaimId = (sessionId: string) => `chest:${sessionId}`;
export const logId = (sessionId: string) => `log:${sessionId}`;
/** One measure per habit: editing it overwrites the same record on every device. */
export const metricDefId = (habitId: string) => `metric:${habitId}`;
/** A log recorded without a session (a quick log). */
export const isQuickLog = (l: { props: LogProps }) => !l.props.sessionId;
export const achievementId = (kind: AchievementKind, ref: string) => `ach:${kind}:${ref}`;
export const linkId = (kind: LinkKind, fromId: string, toId: string) => `${kind}:${fromId}:${toId}`;

// ---------------------------------------------------------------------------
// Parsing (rows from the server, saved state): anything malformed gets a safe
// default instead of crashing a screen.
// ---------------------------------------------------------------------------

/** Longest measure label or unit. */
export const METRIC_LABEL_MAX = 24;

const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
const num = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : d);
const obj = (v: unknown): Record<string, unknown> => {
  if (typeof v === 'string') {
    try {
      return obj(JSON.parse(v));
    } catch {
      return {};
    }
  }
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
};

export function isItemType(v: unknown): v is ItemType {
  return typeof v === 'string' && (ITEM_TYPES as readonly string[]).includes(v);
}

export function isLinkKind(v: unknown): v is LinkKind {
  return typeof v === 'string' && (LINK_KINDS as readonly string[]).includes(v);
}

export function isLinkEnd(v: unknown): v is LinkEnd {
  return v === 'item' || v === 'session' || v === 'habit';
}

export function parseSettings(v: unknown): QuestSettings {
  const s = obj(v);
  const d = DEFAULT_QUEST_SETTINGS;
  const bool = (x: unknown, def: boolean) => (typeof x === 'boolean' ? x : def);
  const names: Record<string, string> = {};
  for (const [k, n] of Object.entries(obj(s.npcNames))) if (typeof n === 'string' && n.trim()) names[k] = n.trim().slice(0, 24);
  return {
    sfx: bool(s.sfx, d.sfx),
    music: bool(s.music, d.music),
    haptics: bool(s.haptics, d.haptics),
    ai: bool(s.ai, d.ai),
    aiNoticeSeen: bool(s.aiNoticeSeen, d.aiNoticeSeen),
    battleStrip: bool(s.battleStrip, d.battleStrip),
    motion: s.motion === 'reduce' || s.motion === 'full' ? s.motion : 'system',
    npcNames: names,
  };
}

/** Typed props for `type`, with defaults for anything missing. */
export function parseProps<T extends ItemType>(type: T, raw: unknown): PropsByType[T] {
  const p = obj(raw);
  switch (type) {
    case 'task': {
      const out: TaskProps = { status: p.status === 'done' ? 'done' : 'open', order: num(p.order) };
      const doneAt = str(p.doneAt);
      if (doneAt) out.doneAt = doneAt;
      return out as PropsByType[T];
    }
    case 'log': {
      const out: LogProps = { sessionId: str(p.sessionId) ?? '' };
      const amount = num(p.amount, NaN);
      if (Number.isFinite(amount) && amount >= 0) out.amount = amount;
      const metricId = str(p.metricId);
      if (metricId) out.metricId = metricId;
      return out as PropsByType[T];
    }
    case 'metric_def':
      return { label: (str(p.label) ?? '').trim().slice(0, METRIC_LABEL_MAX), unit: (str(p.unit) ?? '').trim().slice(0, METRIC_LABEL_MAX) } as PropsByType[T];
    case 'chest_claim':
      return { sessionId: str(p.sessionId) ?? '', claimedAt: str(p.claimedAt) ?? new Date(0).toISOString() } as PropsByType[T];
    case 'purchase': {
      const out: PurchaseProps = { sku: str(p.sku) ?? '', cost: Math.max(0, Math.round(num(p.cost))) };
      const month = str(p.month);
      if (month && /^\d{4}-\d{2}$/.test(month)) out.month = month;
      return out as PropsByType[T];
    }
    case 'achievement': {
      const kind = p.kind === 'biome_cleared' || p.kind === 'rank_reached' ? p.kind : 'boss_defeated';
      return { kind, ref: str(p.ref) ?? '', at: str(p.at) ?? new Date(0).toISOString() } as PropsByType[T];
    }
    case 'quest_meta': {
      const avatar = obj(p.avatar);
      const gear: Partial<Record<GearSlot, string>> = {};
      for (const [slot, sku] of Object.entries(obj(avatar.gear))) {
        if ((GEAR_SLOTS as readonly string[]).includes(slot) && typeof sku === 'string' && sku) gear[slot as GearSlot] = sku;
      }
      const out: QuestMetaProps = {
        startedAt: str(p.startedAt) ?? new Date(0).toISOString(),
        avatar: { gear },
        settings: parseSettings(p.settings),
      };
      const companion = str(p.companion);
      if (companion) out.companion = companion;
      const campfire = str(p.campfire);
      if (campfire) out.campfire = campfire;
      return out as PropsByType[T];
    }
    case 'realm': {
      const slot = Math.round(num(p.slot, -1));
      const out: RealmProps = { slot, icon: str(p.icon) ?? '' };
      const projectId = str(p.projectId);
      if (projectId) out.projectId = projectId;
      if (p.manual === true) out.manual = true;
      return out as PropsByType[T];
    }
    case 'quest': {
      const out: QuestItemProps = { realmId: str(p.realmId) ?? '' };
      const parent = str(p.parentQuestId);
      if (parent) out.parentQuestId = parent;
      return out as PropsByType[T];
    }
    case 'result': {
      const kind = (RESULT_KINDS as readonly unknown[]).includes(p.kind) ? (p.kind as ResultKind) : 'not_yet';
      const out: ResultProps = { questId: str(p.questId) ?? '', kind, at: str(p.at) ?? new Date(0).toISOString() };
      const sessionId = str(p.sessionId);
      if (sessionId) out.sessionId = sessionId;
      return out as PropsByType[T];
    }
  }
  return {} as PropsByType[T];
}

/** A saved or pulled item, or null when it isn't one this build understands. */
export function parseItem(v: unknown): Item | null {
  const r = obj(v);
  if (typeof r.id !== 'string' || !r.id || !isItemType(r.type)) return null;
  const item = {
    id: r.id,
    type: r.type,
    title: str(r.title) ?? '',
    body: str(r.body) ?? '',
    props: parseProps(r.type, r.props),
    habitId: str(r.habitId) ?? null,
    createdAt: num(r.createdAt),
    ...(typeof r.updatedAt === 'number' ? { updatedAt: r.updatedAt } : {}),
  } as Item;
  return item;
}

export function parseLink(v: unknown): Link | null {
  const r = obj(v);
  if (typeof r.id !== 'string' || !r.id || !isLinkKind(r.kind) || !isLinkEnd(r.fromType) || !isLinkEnd(r.toType)) return null;
  if (typeof r.fromId !== 'string' || typeof r.toId !== 'string') return null;
  return {
    id: r.id,
    fromType: r.fromType,
    fromId: r.fromId,
    toType: r.toType,
    toId: r.toId,
    kind: r.kind,
    createdAt: num(r.createdAt),
    ...(typeof r.updatedAt === 'number' ? { updatedAt: r.updatedAt } : {}),
  };
}

/** Narrow a list of items to one type. */
export function itemsOfType<T extends ItemType>(items: readonly Item[], type: T): ItemOf<T>[] {
  return items.filter((i): i is ItemOf<T> => i.type === type);
}
