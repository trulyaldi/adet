import React from 'react';
import { View } from 'react-native';

import { useQuestStarted } from '../data/itemsRepo';
import { gameStateOf, hasFreshChest } from '../domain/game/fromData';
import { useData, useStoreNow } from '../store/StreakStore';
import { useQuestTables } from '../sync/questTables';
import { useTheme } from '../theme/ThemeProvider';

export function useFreshChest(): boolean {
  const data = useData();
  const now = useStoreNow();
  return hasFreshChest(gameStateOf(data), now);
}

/** Quest Mode is set up but the journey hasn't begun: a gentle invitation. */
export function useQuestInvite(): boolean {
  const started = useQuestStarted();
  return useQuestTables() === 'available' && !started;
}

/**
 * The dot on the Quest tab while a chest from the last day waits (older chests
 * just sit at camp), or until the journey begins.
 */
export function QuestBadge() {
  const { colors } = useTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={{ position: 'absolute', top: 6, right: 18, width: 9, height: 9, borderRadius: 5, backgroundColor: colors.amber, borderWidth: 2, borderColor: colors.card }}
    />
  );
}
