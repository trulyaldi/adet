// What a stopped timer means for the quest: a session of 10+ minutes opens
// the Loot sheet once the focus view has gone. Shorter ones
// end exactly as before. A session that targeted a quest (World Mode) asks
// for its result first; one without stays a free session (with Projects as
// Realms on, one in a project that has a realm may be named first). Nothing happens
// before the journey starts, or while the server lacks the quest tables.

import { useCallback } from 'react';

import { useQuestStarted } from '../../data/itemsRepo';
import { useWorldProjects } from '../../data/worldRepo';
import { liveWorld } from '../../domain/world/select';
import { afterSession } from '../../domain/world/target';
import { useData } from '../../store/StreakStore';
import { PROJECT_REALMS, QUEST_ENABLED } from '../enabled';
import type { Session } from '../../domain/types';
import { questTablesReady } from '../../sync/questTables';
import { MODAL_GAP_MS } from '../../theme/motion';
import { handOffAfterStop } from './loot';
import { openResult } from './result';
import { boundQuest, releaseTimerQuest } from './timerQuest';

export function useQuestAfterStop(): (saved: Session | null, opts?: { editAfter?: boolean }) => void {
  const started = useQuestStarted();
  const { items, habits } = useData();
  // The project list once the flag is on and sync has settled; undefined is the project-blind world.
  const projects = useWorldProjects();
  return useCallback(
    (saved, opts) => {
      // The quest goes with this session only, whatever happens next.
      const questId = saved ? boundQuest(saved.habitId) : null;
      releaseTimerQuest();
      if (!QUEST_ENABLED || !saved || !started || !questTablesReady()) return;
      // Projects as Realms (flag): the session's project, so a free session may be named.
      const projectId = PROJECT_REALMS ? habits.find((h) => h.id === saved.habitId)?.projectId : undefined;
      const world = liveWorld(items, projects);
      const { lootFor, target, naming } = afterSession(saved, questId, world, !!opts?.editAfter, projectId);
      const ask = target || naming ? (loot: string | null) => openResult({ sessionId: saved.id, target, naming, lootFor: loot }) : undefined;
      handOffAfterStop(lootFor, MODAL_GAP_MS, ask);
    },
    [started, items, habits, projects]
  );
}
