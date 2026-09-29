// What a stopped timer means for the quest: the weak points picked for it
// become planned_for links on the saved session, and a session of 10+
// minutes opens the Loot sheet once the focus view has gone. Shorter ones
// end exactly as before. Nothing happens before the journey starts, or while
// the server lacks the quest tables.

import { useCallback } from 'react';

import { useQuestMeta, useQuestWrites } from '../../data/itemsRepo';
import { MIN_SESSION_MIN } from '../../domain/game/balance';
import type { Session } from '../../domain/types';
import { questTablesReady } from '../../sync/questTables';
import { MODAL_GAP_MS } from '../../theme/motion';
import { getQuestLocal, planForSession, setActivePlan } from './local';
import { openLoot } from './loot';

export function useQuestAfterStop(): (saved: Session | null, opts?: { editAfter?: boolean }) => void {
  const meta = useQuestMeta();
  const writes = useQuestWrites();
  const started = !!meta;
  return useCallback(
    (saved, opts) => {
      const plan = getQuestLocal().plan;
      setActivePlan(null);
      if (!saved || !started || !questTablesReady()) return;
      const ids = planForSession(plan, saved);
      if (ids.length) writes.planTasks(saved.id, ids);
      // Editing the times first: the chest waits at camp instead.
      if (opts?.editAfter || saved.duration / 60 < MIN_SESSION_MIN) return;
      setTimeout(() => openLoot({ sessionId: saved.id, fresh: true }), MODAL_GAP_MS);
    },
    [started, writes]
  );
}
