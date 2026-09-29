// A sprite (or a stack of layers) in ordinary UI: icons, portraits, the
// avatar on the character sheet. Its own small canvas at an integer scale.

import { Canvas, Group } from '@shopify/react-native-skia';
import React, { memo, useMemo } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';

import { sprite } from '../assets/manifest';
import { useGameClock } from './clock';
import { BatchItem, SpriteBatch } from './SpriteBatch';

export interface SpriteViewProps {
  /** One id, or layers bottom → top (all from one atlas). */
  id: string | string[];
  scale?: number;
  /** Animate (only while `animate` and visible; icons don't). */
  animate?: boolean;
  frame?: number;
  seq?: number[];
  fps?: number;
  flip?: boolean;
  flash?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export const SpriteView = memo(function SpriteView({ id, scale = 3, animate = false, frame, seq, fps, flip, flash, style, accessibilityLabel }: SpriteViewProps) {
  const layers = Array.isArray(id) ? id : [id];
  const key = layers.join('|');
  const base = sprite(layers[0]);
  const clock = useGameClock(animate);
  const items: BatchItem[][] = useMemo(
    () => layers.map((l) => [{ id: l, x: base.ax, y: base.ay, frame, seq, fps, flip, flash, phase: 0 }]),
    [key, frame, seq?.join(','), fps, flip, flash, base.ax, base.ay]
  );
  return (
    <View
      style={[{ width: base.w * scale, height: base.h * scale }, style]}
      accessible={!!accessibilityLabel}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityLabel ? 'image' : undefined}
    >
      <Canvas style={{ width: base.w * scale, height: base.h * scale }}>
        <Group transform={[{ scale }]}>
          {items.map((it, i) => (
            <SpriteBatch key={i} atlas={sprite(layers[i]).atlas} items={it} clock={animate ? clock : undefined} />
          ))}
        </Group>
      </Canvas>
    </View>
  );
});
