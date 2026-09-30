// The player's character drawn for ordinary screens (loaded through SkiaGate
// by components/character/Character.tsx, so app start never loads Skia).

import React from 'react';
import { View } from 'react-native';

import type { AvatarAnimation } from '../avatar';
import { Avatar } from './Avatar';

export default function CharacterArt({ tier, gear, stars, animation, box, animate }: { tier: number; gear: Record<string, string>; stars: number; animation: AvatarAnimation; box: number; animate: boolean }) {
  // Integer scale that fits the box (the art is 20×26).
  const scale = Math.max(1, Math.floor(box / 26));
  return (
    <View style={{ width: box, height: box, alignItems: 'center', justifyContent: 'flex-end' }}>
      <Avatar tier={tier} gear={gear} stars={stars} animation={animation} scale={scale} animate={animate} />
    </View>
  );
}
