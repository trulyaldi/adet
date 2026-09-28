import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, SharedValue, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useUi } from '../../store/StreakStore';
import { useReducedMotion } from '../../theme/useMotion';

const N = 14;

/** A short burst of particles in one color from a point. */
export function Burst({ x, y, color }: { x: number; y: number; color: string }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withTiming(1, { duration: 750, easing: Easing.out(Easing.cubic) });
  }, [p]);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill]}>
      {Array.from({ length: N }, (_, i) => (
        <Particle key={i} i={i} x={x} y={y} p={p} color={color} />
      ))}
    </View>
  );
}

function Particle({ i, x, y, p, color }: { i: number; x: number; y: number; p: SharedValue<number>; color: string }) {
  const a = (i / N) * Math.PI * 2 + (i % 2) * 0.2;
  const dist = 46 + (i % 3) * 18;
  const size = 6 + (i % 3) * 3;
  const round = i % 2 === 0;
  const style = useAnimatedStyle(() => ({
    opacity: 1 - p.value * p.value,
    transform: [
      { translateX: x - size / 2 + Math.cos(a) * dist * p.value },
      { translateY: y - size / 2 + Math.sin(a) * dist * p.value + p.value * p.value * 18 },
      { scale: 1 - p.value * 0.5 },
      { rotate: `${p.value * 180}deg` },
    ],
  }));
  return <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: size, height: size, borderRadius: round ? size / 2 : 2, backgroundColor: color }, style]} />;
}

/** The app's bursts (from ui.bursts), drawn over everything; nothing with reduce motion. */
export function BurstHost() {
  const bursts = useUi((u) => u.bursts);
  const reduced = useReducedMotion();
  if (reduced || !bursts.length) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {bursts.map((b) => (
        <Burst key={b.key} x={b.x} y={b.y} color={b.color} />
      ))}
    </View>
  );
}
