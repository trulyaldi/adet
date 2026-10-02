// The quest a timer was started for (World Mode). The Realm screen's Start
// sets it pending; the start sheet binds it to the habit it starts, or drops
// it when closed without starting. The binding lasts until the session's
// result is told. Device-local and in memory only: nothing is stored or
// synced, so a relaunch mid-session makes it a free session.

let pending: string | null = null;
let bound: { questId: string; habitId: string } | null = null;

export function setTimerQuest(questId: string | null): void {
  pending = questId;
}

/** The start sheet started `habitId`: the pending quest (if any) is now this session's. */
export function bindTimerQuest(habitId: string): void {
  bound = pending ? { questId: pending, habitId } : null;
  pending = null;
}

/** The start sheet closed without starting a timer. */
export function dropTimerQuest(): void {
  pending = null;
}

/** The quest the running session for `habitId` targets, if any. */
export function boundQuest(habitId: string | null | undefined): string | null {
  return bound && habitId && bound.habitId === habitId ? bound.questId : null;
}

/** The session ended (or another habit took the timer): the binding is used up. */
export function releaseTimerQuest(): void {
  bound = null;
}
