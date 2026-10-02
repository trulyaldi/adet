// World Mode's repository: writes through the store's quest slice (items +
// links, synced as before; no new table or sync path) and memoized selectors
// for the Overworld and Realm screens. The pure rules and writes live in
// domain/world. Writes wait for the quest tables, like every Quest write.

import { useEffect, useMemo, useRef } from 'react';

import { newId, QuestSlice } from '../domain/items/ops';
import type { ResultKind } from '../domain/items/types';
import { worldOps } from '../domain/world';
import { liveWorld, questById, realmView, RealmView, SlotView, slotsView } from '../domain/world/select';
import { SessionTarget, targetOf } from '../domain/world/target';
import { realmIdFor } from '../domain/world/types';
import { useActions, useData } from '../store/StreakStore';
import { questTablesReady } from '../sync/questTables';

export interface WorldWrites {
  /** Claim a free biome slot (0–6). Returns the realm's id, or null if it can't be claimed now. */
  claimSlot(slot: number, name: string, icon: string): string | null;
  renameRealm(realmId: string, name: string): void;
  /** A new mob on the realm's path. Returns its id (null if it wasn't written). */
  addQuest(realmId: string, title: string): string | null;
  /** A phase of a top-level quest (two make it a boss). Returns its id (null if it wasn't written). */
  addPhase(parentQuestId: string, title: string): string | null;
  renameQuest(questId: string, title: string): void;
  /** Done, Partly or Not yet after a session. Returns the result's id for undo (null if it didn't apply). */
  recordResult(questId: string, kind: ResultKind, sessionId?: string): string | null;
  /** A Done with no session. Returns the result's id for undo (null if it didn't apply). */
  markDone(questId: string): string | null;
  /** Take a result back (within 6 s of telling it). */
  undoResult(resultId: string): void;
  /** Soft-delete a quest and its phases. */
  softDeleteQuest(questId: string): void;
}

/** World writes; stable (the store's actions never change identity). */
export function useWorldWrites(): WorldWrites {
  const { editQuest } = useActions();
  const data = useData();
  // The slice as of the last write or commit, to tell whether a write applies
  // (and return its id) without waiting for the store; writes in one handler see each other.
  const latest = useRef<QuestSlice>({ items: data.items, links: data.links });
  useEffect(() => {
    latest.current = { items: data.items, links: data.links };
  }, [data.items, data.links]);
  return useMemo(() => {
    type Write = (q: QuestSlice, now: number) => QuestSlice;
    /** Apply a pure write; true when it changes the slice. The same write (same id and time) then runs on the store's latest. */
    const edit = (fn: Write): boolean => {
      if (!questTablesReady()) return false;
      const now = Date.now();
      const cur = latest.current;
      const next = fn(cur, now);
      if (next === cur) return false;
      latest.current = next;
      editQuest((q) => fn(q, now));
      return true;
    };
    const created = (prefix: string, fn: (id: string) => Write): string | null => {
      const id = newId(prefix, Date.now());
      return edit(fn(id)) ? id : null;
    };
    return {
      claimSlot: (slot, name, icon) => (edit((q, now) => worldOps.claimSlot(q, slot, name, icon, now)) ? realmIdFor(slot) : null),
      renameRealm: (realmId, name) => void edit((q) => worldOps.renameRealm(q, realmId, name)),
      addQuest: (realmId, title) => created('w', (id) => (q, now) => worldOps.addQuest(q, realmId, title, now, id)),
      addPhase: (parentQuestId, title) => created('w', (id) => (q, now) => worldOps.addPhase(q, parentQuestId, title, now, id)),
      renameQuest: (questId, title) => void edit((q) => worldOps.renameQuest(q, questId, title)),
      recordResult: (questId, kind, sessionId) => created('r', (id) => (q, now) => worldOps.recordResult(q, questId, kind, now, sessionId, id)),
      markDone: (questId) => created('r', (id) => (q, now) => worldOps.markDone(q, questId, now, id)),
      undoResult: (resultId) => void edit((q, now) => worldOps.undoResult(q, resultId, now)),
      softDeleteQuest: (questId) => void edit((q) => worldOps.softDeleteQuest(q, questId)),
    };
  }, [editQuest]);
}

/** The Overworld's 7 slots. */
export function useSlots(): SlotView[] {
  const { items } = useData();
  return useMemo(() => slotsView(items), [items]);
}

/** One realm's path (null when it doesn't exist). */
export function useRealmView(realmId: string | null): RealmView | null {
  const { items } = useData();
  return useMemo(() => (realmId ? realmView(items, realmId) : null), [items, realmId]);
}

/** One quest, its realm and its hearts (null when it's gone). */
export function useWorldQuest(questId: string | null): ReturnType<typeof questById> {
  const { items } = useData();
  return useMemo(() => (questId ? questById(items, questId) : null), [items, questId]);
}

/** What a session for `questId` fights right now (null: a free session, or nothing left to fight). */
export function useSessionTarget(questId: string | null): SessionTarget | null {
  const { items } = useData();
  return useMemo(() => (questId ? targetOf(liveWorld(items), questId) : null), [items, questId]);
}
