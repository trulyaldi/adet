// The world's canvas: one integer scale for everything, nearest-neighbour
// sprites, and a camera that only ever lands on whole game pixels.

import { Canvas, Group } from '@shopify/react-native-skia';
import React, { createContext, useContext, useMemo } from 'react';
import { StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { SharedValue, useDerivedValue } from 'react-native-reanimated';

import { pixelScale } from './pixel';

export interface Stage {
  /** Points per game pixel (an integer). */
  scale: number;
  /** Visible world size in game pixels. */
  worldW: number;
  worldH: number;
}

const StageContext = createContext<Stage>({ scale: 3, worldW: 130, worldH: 240 });
export const useStage = () => useContext(StageContext);

export function PixelStage({
  width,
  height,
  scale: forced,
  style,
  children,
}: {
  width: number;
  height: number;
  scale?: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const scale = forced ?? pixelScale(width);
  const stage = useMemo(() => ({ scale, worldW: Math.ceil(width / scale), worldH: Math.ceil(height / scale) }), [scale, width, height]);
  return (
    <StageContext.Provider value={stage}>
      <Canvas style={StyleSheet.flatten([{ width, height }, style])}>
        <Group transform={[{ scale }]}>{children}</Group>
      </Canvas>
    </StageContext.Provider>
  );
}

/**
 * Children in world coordinates, seen from the camera: (x, y) is the world
 * point at the top-left of the view. Rounded, so nothing is ever drawn between
 * game pixels. `shake` adds a pixel offset (0 with reduced motion).
 */
export function Camera({
  x,
  y,
  shake,
  children,
}: {
  x?: SharedValue<number>;
  y: SharedValue<number>;
  shake?: SharedValue<number>;
  children: React.ReactNode;
}) {
  const transform = useDerivedValue(() => {
    const s = shake ? shake.value : 0;
    return [{ translateX: -Math.round(x ? x.value : 0) + Math.round(s) }, { translateY: -Math.round(y.value) + Math.round(s * 0.5) }];
  });
  return <Group transform={transform}>{children}</Group>;
}

/** Parallax: a layer that moves at `factor` of the camera. */
export function Parallax({ y, factor, children }: { y: SharedValue<number>; factor: number; children: React.ReactNode }) {
  const transform = useDerivedValue(() => [{ translateY: -Math.round(y.value * factor) }]);
  return <Group transform={transform}>{children}</Group>;
}
