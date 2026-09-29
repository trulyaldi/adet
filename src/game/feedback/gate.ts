import { SOUND_FILES } from '../assets/sounds.generated';

export type FeedbackContext = 'quest' | 'loot' | 'ceremony' | 'timer';
export type SfxId = 'ui_tap' | 'chest_open' | 'hit' | 'crit' | 'level_up' | 'rank_up' | 'boss_defeat' | 'gate_open' | 'purchase';
export type HapticKind = 'light' | 'medium' | 'success';

/** A paused timer is still an active session. It mutes every Quest channel. */
export function feedbackAllowed(context: FeedbackContext, timerActive: boolean): boolean {
  return context !== 'timer' && !timerActive;
}

export const SFX_IDS: readonly SfxId[] = ['ui_tap', 'chest_open', 'hit', 'crit', 'level_up', 'rank_up', 'boss_defeat', 'gate_open', 'purchase'];

/** Built from licensed packs (npm run game:audio). A call without a file is a silent no-op. */
export const AVAILABLE_SFX: ReadonlySet<SfxId> = new Set(SFX_IDS.filter((id) => id in SOUND_FILES));
export const hasSfxFile = (id: SfxId, available: ReadonlySet<string> = AVAILABLE_SFX): boolean => available.has(id);
