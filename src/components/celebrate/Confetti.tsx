import React, { useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, SharedValue, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useStreak } from '../../store/StreakStore';
import { useReducedMotion } from '../../theme/useMotion';

const PIECES = 42;
const DURATION = 2600;

/** Deterministic spread for piece i. */
function r(i: number, k: number): number {
  const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

/** Confetti falling from the top in the given colors, once. */
function Confetti({ colors }: { colors: string[] }) {
  const { width, height } = useWindowDimensions();
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withTiming(1, { duration: DURATION, easing: Easing.linear });
  }, [t]);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: PIECES }, (_, i) => (
        <Piece key={i} i={i} t={t} w={width} h={height} color={colors[i % colors.length]} />
      ))}
    </View>
  );
}

function Piece({ i, t, w, h, color }: { i: number; t: SharedValue<number>; w: number; h: number; color: string }) {
  const x0 = r(i, 1) * w;
  const drift = (r(i, 2) - 0.5) * 120;
  const delay = r(i, 3) * 0.35;
  const spin = 360 + r(i, 4) * 720;
  const size = 7 + r(i, 5) * 6;
  const tall = i % 3 === 0;
  const style = useAnimatedStyle(() => {
    const k = Math.max(0, Math.min(1, (t.value - delay) / (1 - delay)));
    return {
      opacity: k <= 0 ? 0 : k > 0.85 ? (1 - k) / 0.15 : 1,
      transform: [
        { translateX: x0 + drift * k + Math.sin(k * 10 + i) * 12 },
        { translateY: -30 + (h + 60) * k * (0.6 + 0.4 * k) },
        { rotate: `${spin * k}deg` },
        { scaleX: Math.cos(k * 14 + i) },
      ],
    };
  });
  return <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: size, height: tall ? size * 1.8 : size, borderRadius: tall ? 2 : size / 2, backgroundColor: color }, style]} />;
}

/** The day-complete confetti (ui.confetti); off with reduce motion. */
export function ConfettiHost() {
  const { ui } = useStreak();
  const reduced = useReducedMotion();
  const [shown, setShown] = React.useState<number | null>(null);
  useEffect(() => {
    if (!ui.confetti) return;
    setShown(ui.confetti.key);
    const tm = setTimeout(() => setShown(null), DURATION + 100);
    return () => clearTimeout(tm);
  }, [ui.confetti]);
  if (reduced || !ui.confetti || shown !== ui.confetti.key) return null;
  return <Confetti key={ui.confetti.key} colors={ui.confetti.colors} />;
}
