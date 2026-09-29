export type FeedbackContext = 'quest' | 'loot' | 'ceremony' | 'timer';
export type SfxId = 'ui_tap' | 'chest_open' | 'hit' | 'crit' | 'level_up' | 'rank_up' | 'boss_defeat' | 'gate_open' | 'purchase';
export type HapticKind = 'light' | 'medium' | 'success';

/** A paused timer is still an active session. It mutes every Quest channel. */
export function feedbackAllowed(context: FeedbackContext, timerActive: boolean): boolean {
  return context !== 'timer' && !timerActive;
}

/** The pack is not checked in yet. Calls without a licensed file stay silent. */
export const AVAILABLE_SFX: ReadonlySet<SfxId> = new Set(['ui_tap']);
export const hasSfxFile = (id: SfxId): boolean => AVAILABLE_SFX.has(id);
