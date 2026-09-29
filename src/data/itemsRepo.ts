// Typed access to Quest Mode's items and links: read hooks over the synced
// data, and writes built from the pure ops in src/domain/items/ops.ts. Every
// write is dropped while the server lacks the 006 tables (see questTables),
// so nothing is queued that the server can't take.

import { useMemo } from 'react';

import * as ops from '../domain/items/ops';
import { AchievementProps, Item, ItemOf, ItemType, itemsOfType, Link, LinkKind, QuestMetaProps } from '../domain/items/types';
import { useActions, useData } from '../store/StreakStore';
import { questTablesReady } from '../sync/questTables';

/** Items of one type, optionally filtered; stable while the items don't change. */
export function useItems<T extends ItemType>(type: T, filter?: (i: ItemOf<T>) => boolean): ItemOf<T>[] {
  const { items } = useData();
  // The filter is usually an inline closure; results are recomputed only when
  // the items themselves change.
  return useMemo(() => {
    const all = itemsOfType(items, type);
    return filter ? all.filter(filter) : all;
  }, [items, type]);
}

export function useLinks(filter?: { kind?: LinkKind; fromId?: string; toId?: string }): Link[] {
  const { links } = useData();
  const { kind, fromId, toId } = filter ?? {};
  return useMemo(
    () => links.filter((l) => (!kind || l.kind === kind) && (!fromId || l.fromId === fromId) && (!toId || l.toId === toId)),
    [links, kind, fromId, toId]
  );
}

export function useQuestMeta(): ItemOf<'quest_meta'> | null {
  const { items } = useData();
  return useMemo(() => ops.questMetaOf(items), [items]);
}

/**
 * The journey has started (onboarding done). Before that, sessions end
 * exactly as they did before Quest Mode: no loot, strip or weak points.
 */
export function useQuestStarted(): boolean {
  return useQuestMeta() !== null;
}

export interface QuestWrites {
  addTask(habitId: string, title: string): void;
  renameTask(id: string, title: string): void;
  setTaskStatus(id: string, status: 'open' | 'done'): void;
  reorderTasks(habitId: string, orderedIds: string[]): void;
  deleteTask(id: string): void;
  planTasks(sessionId: string, taskIds: string[]): void;
  claimChest(claim: Omit<ops.ChestClaim, 'now'>): void;
  editLog(id: string, body: string): void;
  purchase(sku: string, cost: number, month?: string): void;
  addAchievements(list: AchievementProps[]): void;
  startQuest(): void;
  updateQuestMeta(fn: (p: QuestMetaProps) => QuestMetaProps): void;
}

/** Quest writes; stable (the store's actions never change identity). */
export function useQuestWrites(): QuestWrites {
  const { editQuest } = useActions();
  return useMemo(() => {
    const edit = (fn: (q: ops.QuestSlice, now: number) => ops.QuestSlice) => {
      if (!questTablesReady()) return;
      editQuest((q) => fn(q, Date.now()));
    };
    return {
      addTask: (habitId, title) => edit((q, now) => ops.addTask(q, habitId, title, now)),
      renameTask: (id, title) => edit((q) => ops.renameTask(q, id, title)),
      setTaskStatus: (id, status) => edit((q, now) => ops.setTaskStatus(q, id, status, now)),
      reorderTasks: (habitId, ids) => edit((q) => ops.reorderTasks(q, habitId, ids)),
      deleteTask: (id) => edit((q) => ops.deleteTask(q, id)),
      planTasks: (sessionId, taskIds) => edit((q, now) => ops.planTasks(q, sessionId, taskIds, now)),
      claimChest: (claim) => edit((q, now) => ops.claimChest(q, { ...claim, now })),
      editLog: (id, body) => edit((q) => ops.editLog(q, id, body)),
      purchase: (sku, cost, month) => edit((q, now) => ops.addPurchase(q, sku, cost, now, month)),
      addAchievements: (list) => edit((q, now) => ops.addAchievements(q, list, now)),
      startQuest: () => edit((q, now) => ops.startQuest(q, now)),
      updateQuestMeta: (fn) => edit((q, now) => ops.updateQuestMeta(q, fn, now)),
    };
  }, [editQuest]);
}

export type { Item, Link };
