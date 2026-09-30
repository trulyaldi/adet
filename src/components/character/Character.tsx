// The player's own pixel character, in their current rank and gear: the one
// figure the app shows everywhere (it replaced the Ilmek mascot). It keeps the
// mascot's moods as animations. Drawn with Skia, loaded at first use: until
// then (and if drawing fails) an empty box of the same size holds the layout.

import React from 'react';
import { View } from 'react-native';

import { useQuestMeta } from '../../data/itemsRepo';
import { gameStateOf } from '../../domain/game/fromData';
import type { AvatarAnimation } from '../../game/avatar';
import { loadCharacterArt } from '../../game/render/screens';
import { SkiaGate } from '../../game/render/SkiaGate';
import { useData, useUi } from '../../store/StreakStore';
import { useAppActive, useReducedMotion } from '../../theme/useMotion';

/** The moods screens ask for (the mascot's old states). */
export type CharacterMood = 'idle' | 'focused' | 'sleepy' | 'cheering' | 'celebrating' | 'relaxed' | 'waving';

export const MOOD_ANIMATION: Record<CharacterMood, AvatarAnimation> = {
  idle: 'idle',
  focused: 'attack',
  sleepy: 'nap',
  cheering: 'cheer',
  celebrating: 'cheer',
  relaxed: 'sit',
  waving: 'wave',
};

const MOOD_WORD: Record<CharacterMood, string> = {
  idle: 'standing ready',
  focused: 'training',
  sleepy: 'napping',
  cheering: 'cheering',
  celebrating: 'celebrating',
  relaxed: 'resting',
  waving: 'waving',
};

export function characterLabel(mood: CharacterMood): string {
  return `Your character, ${MOOD_WORD[mood]}`;
}

export interface CharacterProps {
  mood?: CharacterMood;
  /** Box size in points (the character fits inside at a whole-pixel scale). */
  size?: number;
  /** False holds a still frame. Motion also stops with Reduce Motion, in the background, and under the focus view. */
  animated?: boolean;
  /** Hidden from screen readers when the surrounding view already says it. */
  decorative?: boolean;
}

export function Character({ mood = 'idle', size = 96, animated = true, decorative }: CharacterProps) {
  const data = useData();
  const meta = useQuestMeta();
  const game = gameStateOf(data);
  const reduced = useReducedMotion();
  const active = useAppActive();
  const covered = useUi((u) => u.timerOpen);
  const stars = Math.max(0, ...game.journey.defeated.filter((d) => d.biome === 'astral').map((d) => d.loop + 1));
  const box = <View style={{ width: size, height: size }} />;
  return (
    <View
      style={{ width: size, height: size }}
      accessible={!decorative}
      accessibilityRole={decorative ? undefined : 'image'}
      accessibilityLabel={decorative ? undefined : characterLabel(mood)}
      importantForAccessibility={decorative ? 'no-hide-descendants' : 'auto'}
      accessibilityElementsHidden={decorative}
    >
      <SkiaGate
        load={loadCharacterArt}
        props={{ tier: game.rank.tier, gear: meta?.props.avatar.gear ?? {}, stars, animation: MOOD_ANIMATION[mood], box: size, animate: animated && !reduced && active && !covered }}
        fallback={box}
      />
    </View>
  );
}
