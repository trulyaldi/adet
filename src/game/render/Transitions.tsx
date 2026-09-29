// Between map and cutscenes: an iris wipe and a pixel dissolve, both drawn
// on whole game pixels. With reduced motion they're instant.

import { Atlas, Canvas, Circle, Group, Rect, rect, useRSXformBuffer } from '@shopify/react-native-skia';
import React, { useMemo } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { SharedValue, useDerivedValue } from 'react-native-reanimated';

import { sprite } from '../assets/manifest';
import { useAtlas } from './atlas';
import { NEAREST } from './pixel';

/**
 * An iris: `progress` 0 = closed (all colour), 1 = fully open. The hole's
 * radius steps in whole game pixels.
 */
export function IrisWipe({ progress, scale, color = '#0b0a14', cx, cy }: { progress: SharedValue<number>; scale: number; color?: string; cx?: number; cy?: number }) {
  const { width, height } = useWindowDimensions();
  const x = cx ?? width / 2;
  const y = cy ?? height / 2;
  const maxR = Math.hypot(Math.max(x, width - x), Math.max(y, height - y));
  const r = useDerivedValue(() => Math.round((progress.value * maxR) / scale) * scale);
  const hidden = useDerivedValue(() => (progress.value >= 1 ? 0 : 1));
  return (
    <Canvas style={StyleSheet.flatten([StyleSheet.absoluteFill, { pointerEvents: 'none' }])}>
      <Group layer opacity={hidden}>
        <Rect x={0} y={0} width={width} height={height} color={color} />
        <Circle cx={x} cy={y} r={r} color="black" blendMode="clear" />
      </Group>
    </Canvas>
  );
}

/**
 * Blocks of `block` points appear in a scattered order as `progress` goes 0 → 1
 * (1 = fully covered); run it backwards to reveal.
 */
export function PixelDissolve({ progress, block = 24, color = '#0b0a14' }: { progress: SharedValue<number>; block?: number; color?: string }) {
  const { width, height } = useWindowDimensions();
  const image = useAtlas('shared');
  const px = sprite('fx.pixel').frames[0];
  const cols = Math.ceil(width / block);
  const rows = Math.ceil(height / block);
  const n = cols * rows;
  const order = useMemo(() => Array.from({ length: n }, (_, i) => ((i * 2654435761) % 1009) / 1009), [n]);
  const sprites = useMemo(() => Array.from({ length: n }, () => rect(px[0], px[1], 1, 1)), [n, px]);
  const transforms = useRSXformBuffer(n, (xf, i) => {
    'worklet';
    const on = progress.value > order[i] ? block : 0;
    xf.set(on, 0, (i % cols) * block, Math.floor(i / cols) * block);
  });
  if (!image) return null;
  return (
    <Canvas style={StyleSheet.flatten([StyleSheet.absoluteFill, { pointerEvents: 'none' }])}>
      <Group>
        <Atlas image={image} sprites={sprites} transforms={transforms} sampling={NEAREST} colors={sprites.map(() => Float32Array.of(...hexToRgb(color), 1))} colorBlendMode="modulate" />
      </Group>
    </Canvas>
  );
}

function hexToRgb(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
