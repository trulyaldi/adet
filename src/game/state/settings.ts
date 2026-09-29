// Quest settings (synced in quest_meta.settings) and the motion and focus
// rules every Quest animation follows.

import { useIsFocused } from './focus';
import { useQuestMeta } from '../../data/itemsRepo';
import { DEFAULT_QUEST_SETTINGS, QuestSettings } from '../../domain/items/types';
import { useAppActive, useReducedMotion } from '../../theme/useMotion';

export function useQuestSettings(): QuestSettings {
  return useQuestMeta()?.props.settings ?? DEFAULT_QUEST_SETTINGS;
}

/** Quest motion follows the local device preference, which follows the system by default. */
export function useQuestReduced(): boolean {
  return useReducedMotion();
}

/** The world animates only while its screen is focused and the app is in front. */
export function useWorldRunning(): boolean {
  const focused = useIsFocused();
  const active = useAppActive();
  const reduced = useQuestReduced();
  return focused && active && !reduced;
}
