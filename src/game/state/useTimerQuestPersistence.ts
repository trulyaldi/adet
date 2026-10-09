// Keeps the running timer's quest on this device (Projects as Realms), so a
// relaunch mid-session still ends in its result sheet. The timer itself
// survives a relaunch through the synced store; this copy is never synced, so
// another device resuming the timer runs a free session. Off with the flag:
// nothing is read or written and the binding stays in memory, as before.

import { useEffect, useRef } from 'react';

import { useData, useReady } from '../../store/StreakStore';
import { PROJECT_REALMS } from '../enabled';
import { updateQuestLocal, useQuestLocal } from './local';
import { adoptTimerQuest, onTimerQuestChange, parseBinding } from './timerQuest';

export function useTimerQuestPersistence(): void {
  const ready = useReady();
  const { loaded, timerQuest } = useQuestLocal();
  const habitId = useData().active?.habitId ?? null;
  const restored = useRef(false);

  // Once the store and the device copy have both loaded: take the copy back if it still belongs to the running timer.
  useEffect(() => {
    if (!PROJECT_REALMS || restored.current || !ready || !loaded) return;
    restored.current = true;
    const b = parseBinding(timerQuest, habitId, Date.now());
    adoptTimerQuest(b);
    if (!b && timerQuest) updateQuestLocal((s) => ({ ...s, timerQuest: null }));
  }, [ready, loaded, timerQuest, habitId]);

  // From then on the copy follows the binding.
  useEffect(() => {
    if (!PROJECT_REALMS) return;
    return onTimerQuestChange((b) => updateQuestLocal((s) => ({ ...s, timerQuest: b })));
  }, []);
}
