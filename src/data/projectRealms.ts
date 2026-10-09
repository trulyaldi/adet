// Projects as realms, wired to the store (docs/quest/world/PROJECT_REALMS.md).
// One effect keeps every project's realm in line through the pure
// `reconcileRealms`: creating, renaming, archiving, restoring or deleting a
// project, a sync pull, or an older build's project all land the same way, and
// no store action changes. Behind EXPO_PUBLIC_PROJECT_REALMS (off: nothing
// here runs). The pure parts (silent attach, the attach choice) are in
// projectRealmsModel.ts.

import { useEffect, useMemo } from 'react';

import { worldOps } from '../domain/world';
import { PROJECT_REALMS } from '../game/enabled';
import { useActions, useData, useReady, useSyncStatus } from '../store/StreakStore';
import { useQuestTables } from '../sync/questTables';
import { useQuestStarted } from './itemsRepo';
import { AttachChoice, attachChoiceOf, linkByName } from './projectRealmsModel';
import { useWorldProjects } from './worldRepo';

/** Every gate the realm bookkeeping waits for; false while off. */
function useRealmGates(): boolean {
  const ready = useReady();
  const { settled } = useSyncStatus();
  const tables = useQuestTables();
  const started = useQuestStarted();
  return PROJECT_REALMS && ready && settled && tables === 'available' && started;
}

/**
 * Keeps realms in line with projects. Runs whenever the items or the
 * projects change; the reconcile is idempotent and returns the same slice
 * when there is nothing to do, so the store sees no change and nothing loops.
 * Waits for the gates (flag, store ready, sync settled, quest tables, journey
 * started) and, inside the reconcile, for the attach choice to be answered.
 */
export function useProjectRealms(): void {
  const gates = useRealmGates();
  const { items, projects } = useData();
  const { editQuest } = useActions();
  useEffect(() => {
    if (!gates) return;
    editQuest((q) => worldOps.reconcileRealms(linkByName(q, projects), projects, Date.now()));
  }, [gates, items, projects, editQuest]);
}

/** The attach choice to show now (null: nothing to ask, or the feature is off or not ready). */
export function useAttachChoice(): AttachChoice | null {
  const gates = useRealmGates();
  const { items } = useData();
  const projects = useWorldProjects();
  return useMemo(() => (gates && projects ? attachChoiceOf(items, projects) : null), [gates, items, projects]);
}
