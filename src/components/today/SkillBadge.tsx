// A habit's skill level, small, beside it (v2 N7.5): the game shown lightly
// outside Quest Mode. Only once the journey has started.

import React from 'react';
import { View } from 'react-native';

import { useQuestStarted } from '../../data/itemsRepo';
import { gameStateOf } from '../../domain/game/fromData';
import { useData } from '../../store/StreakStore';
import { useTheme } from '../../theme/ThemeProvider';
import { Text } from '../Text';

export function SkillBadge({ habitId }: { habitId: string }) {
  const { colors, radius } = useTheme();
  const data = useData();
  const started = useQuestStarted();
  if (!started) return null;
  const skill = gameStateOf(data).skills.find((s) => s.habitId === habitId);
  if (!skill) return null;
  return (
    <View accessible accessibilityLabel={`Skill level ${skill.level}`} style={{ paddingHorizontal: 4, paddingVertical: 1, borderRadius: radius.sm, borderWidth: 2, borderColor: colors.line }}>
      <Text style={{ fontSize: 11, color: colors.sub }}>LV {skill.level}</Text>
    </View>
  );
}
