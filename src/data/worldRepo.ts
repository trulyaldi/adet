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
import { ProjectRef, realmIdFor } from '../domain/world/types';
import { PROJECT_REALMS } from '../game/enabled';
import { useActions, useData, useSyncStatus } from '../store/StreakStore';
import { questTablesReady } from '../sync/questTables';

/**
 * The project list for world reads: only with projects-as-realms on and sync
 * settled (items arrive before projects, so earlier a realm's project would
 * read as deleted). `undefined` is the project-blind world, exactly as before.
 */
export function useWorldProjects(): readonly ProjectRef[] | undefined {
  const { projects } = useData();
  const { settled } = useSyncStatus();
  return PROJECT_REALMS && settled ? projects : undefined;
}

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
  /** The attach choice: link a hand-claimed realm to a project (once; refused if either already has a link). */
  linkRealm(realmId: string, projectId: string): void;
  /** The attach choice "skip": the realm stays hand-claimed for good. */
  keepRealm(realmId: string): void;
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
      linkRealm: (realmId, projectId) => void edit((q) => worldOps.linkRealm(q, realmId, projectId)),
      keepRealm: (realmId) => void edit((q) => worldOps.keepRealm(q, realmId)),
      undoResult: (resultId) => void edit((q, now) => worldOps.undoResult(q, resultId, now)),
      softDeleteQuest: (questId) => void edit((q) => worldOps.softDeleteQuest(q, questId)),
    };
  }, [editQuest]);
}

/** The Overworld's 7 slots. */
export function useSlots(): SlotView[] {
  const { items } = useData();
  const projects = useWorldProjects();
  return useMemo(() => slotsView(items, projects), [items, projects]);
}

/** One realm's path (null when it doesn't exist). */
export function useRealmView(realmId: string | null): RealmView | null {
  const { items } = useData();
  const projects = useWorldProjects();
  return useMemo(() => (realmId ? realmView(items, realmId, projects) : null), [items, realmId, projects]);
}

/** One quest, its realm and its hearts (null when it's gone). */
export function useWorldQuest(questId: string | null): ReturnType<typeof questById> {
  const { items } = useData();
  const projects = useWorldProjects();
  return useMemo(() => (questId ? questById(items, questId, projects) : null), [items, questId, projects]);
}

/** What a session for `questId` fights right now (null: a free session, or nothing left to fight). */
export function useSessionTarget(questId: string | null): SessionTarget | null {
  const { items } = useData();
  const projects = useWorldProjects();
  return useMemo(() => (questId ? targetOf(liveWorld(items, projects), questId) : null), [items, questId, projects]);
}
