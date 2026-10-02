// What a stopped timer means for the quest: a session of 10+ minutes opens
// the Loot sheet once the focus view has gone. Shorter ones
// end exactly as before. Nothing happens before the journey starts, or while
// the server lacks the quest tables.

import { useCallback } from 'react';

import { useQuestStarted } from '../../data/itemsRepo';
import { MIN_SESSION_MIN } from '../../domain/game/balance';
import { QUEST_ENABLED } from '../enabled';
import type { Session } from '../../domain/types';
import { questTablesReady } from '../../sync/questTables';
import { MODAL_GAP_MS } from '../../theme/motion';
import { handOffAfterStop } from './loot';

export function useQuestAfterStop(): (saved: Session | null, opts?: { editAfter?: boolean }) => void {
  const started = useQuestStarted();
  return useCallback(
    (saved, opts) => {
      if (!QUEST_ENABLED || !saved || !started || !questTablesReady()) return;
      // Editing the times first: the chest waits at camp instead.
      const loot = !opts?.editAfter && saved.duration / 60 >= MIN_SESSION_MIN;
      handOffAfterStop(loot ? saved.id : null, MODAL_GAP_MS);
    },
    [started]
  );
}
