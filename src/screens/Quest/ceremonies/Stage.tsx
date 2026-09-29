// A full-screen ceremony stage: a Skia scene at the world's integer scale
// over a background, and a tap anywhere to skip or continue.

import { Canvas, Group, Rect } from '@shopify/react-native-skia';
import React from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { pixelScale } from '../../../game/render/pixel';
import { PE } from '../../../game/ui/pointer';

export function useCeremonySize() {
  const { width, height } = useWindowDimensions();
  const scale = pixelScale(width);
  return { width, height, scale, worldW: Math.ceil(width / scale), worldH: Math.ceil(height / scale) };
}

export function CeremonyStage({
  background,
  onTap,
  label,
  scene,
  children,
}: {
  background: string;
  /** Tap anywhere to skip or continue; without it the scene waits for its own button. */
  onTap?(): void;
  /** What VoiceOver reads (the scene itself is pictures). */
  label: string;
  /** Skia children in world coordinates. */
  scene: React.ReactNode;
  /** RN overlay (text, buttons). */
  children?: React.ReactNode;
}) {
  const { width, height, scale } = useCeremonySize();
  return (
    <View style={StyleSheet.absoluteFill}>
      <Canvas style={{ width, height }}>
        <Rect x={0} y={0} width={width} height={height} color={background} />
        <Group transform={[{ scale }]}>{scene}</Group>
      </Canvas>
      {/* Tap anywhere (a sibling under the content: buttons never nest). */}
      {onTap ? (
        <Pressable style={StyleSheet.absoluteFill} onPress={onTap} accessibilityRole="button" accessibilityLabel={label} accessibilityHint="Tap to continue" />
      ) : (
        <View style={StyleSheet.absoluteFill} accessible accessibilityLabel={label} />
      )}
      <View style={[StyleSheet.absoluteFill, PE.boxNone]}>{children}</View>
    </View>
  );
}
