import React from 'react';
import { View } from 'react-native';

import { gameStateOf, hasFreshChest } from '../domain/game/fromData';
import { useData, useStoreNow } from '../store/StreakStore';
import { useTheme } from '../theme/ThemeProvider';

export function useFreshChest(): boolean {
  const data = useData();
  const now = useStoreNow();
  return hasFreshChest(gameStateOf(data), now);
}

/** The dot on the Quest tab while a chest from the last day waits. Older chests just sit at camp. */
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
