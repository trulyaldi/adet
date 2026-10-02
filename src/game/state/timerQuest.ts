// The quest a timer was started for (World Mode): set by the Realm screen's
// Start, read by the timer once it targets quests (world-4). A param only;
// nothing is stored or synced.

let pending: string | null = null;

export function setTimerQuest(questId: string | null): void {
  pending = questId;
}

/** The quest the next timer is for, cleared once read. */
export function takeTimerQuest(): string | null {
  const q = pending;
  pending = null;
  return q;
}

/** Peek without clearing. */
export function timerQuest(): string | null {
  return pending;
}
