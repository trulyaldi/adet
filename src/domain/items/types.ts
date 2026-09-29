// Generic items and links (migration 006_quest), and the typed props of every
// item type Quest Mode uses. Pure: no React or RN, shared with future builds.
//
//   type          purpose                          props
//   task          a weak point                     { status, order, doneAt? }
//   log           a chronicle entry (body = text)  { sessionId }
//   chest_claim   a session's chest was opened     { sessionId, claimedAt }
//   purchase      a shop purchase                  { sku, cost, month? }
//   achievement   an append-only milestone         { kind, ref, at }
//   quest_meta    the quest's singleton            { startedAt, avatar, companion?, campfire?, settings }
//
// Link kinds: task → session `planned_for` / `completed_in`; log → session `chronicles`.

export type ItemType = 'task' | 'log' | 'chest_claim' | 'purchase' | 'achievement' | 'quest_meta';
export const ITEM_TYPES: readonly ItemType[] = ['task', 'log', 'chest_claim', 'purchase', 'achievement', 'quest_meta'];

export interface TaskProps {
  status: 'open' | 'done';
  /** Position among the habit's tasks (lower first). */
  order: number;
  /** ISO time it was completed. */
  doneAt?: string;
}

export interface LogProps {
  sessionId: string;
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

export type AchievementKind = 'boss_defeated' | 'biome_cleared' | 'rank_reached';

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
  /** The battle strip on the timer screen. */
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

export interface PropsByType {
  task: TaskProps;
  log: LogProps;
  chest_claim: ChestClaimProps;
  purchase: PurchaseProps;
  achievement: AchievementProps;
  quest_meta: QuestMetaProps;
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

export type Item = TaskItem | LogEntryItem | ChestClaimItem | PurchaseItem | AchievementItem | QuestMetaItem;
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
export const achievementId = (kind: AchievementKind, ref: string) => `ach:${kind}:${ref}`;
export const linkId = (kind: LinkKind, fromId: string, toId: string) => `${kind}:${fromId}:${toId}`;

// ---------------------------------------------------------------------------
// Parsing (rows from the server, saved state): anything malformed gets a safe
// default instead of crashing a screen.
// ---------------------------------------------------------------------------

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
    case 'log':
      return { sessionId: str(p.sessionId) ?? '' } as PropsByType[T];
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
