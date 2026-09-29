// Quest settings (synced in quest_meta.settings) and the motion and focus
// rules every Quest animation follows.

import { useIsFocused } from './focus';
import { useQuestMeta } from '../../data/itemsRepo';
import { DEFAULT_QUEST_SETTINGS, QuestSettings } from '../../domain/items/types';
import { useAppActive, useReducedMotion } from '../../theme/useMotion';

export function useQuestSettings(): QuestSettings {
  return useQuestMeta()?.props.settings ?? DEFAULT_QUEST_SETTINGS;
}

/** Reduced motion in the Quest world: its own setting, else the app's (which follows the system). */
export function useQuestReduced(): boolean {
  const app = useReducedMotion();
  const { motion } = useQuestSettings();
  return motion === 'system' ? app : motion === 'reduce';
}

/** The world animates only while its screen is focused and the app is in front. */
export function useWorldRunning(): boolean {
  const focused = useIsFocused();
  const active = useAppActive();
  const reduced = useQuestReduced();
  return focused && active && !reduced;
}
