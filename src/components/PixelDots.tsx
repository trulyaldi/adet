// Loading, the pixel way (v2 N9): three squares lighting up in turn, a step at
// a time (no fades, no scaling). Still with reduced motion or in the background.

import React, { useEffect, useState } from 'react';
import { View } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { useAppActive, useReducedMotion } from '../theme/useMotion';

const STEP_MS = 280;

export function PixelDots({ size = 8, color }: { size?: number; color?: string }) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const active = useAppActive();
  const [lit, setLit] = useState(0);
  useEffect(() => {
    if (reduced || !active) return;
    const t = setInterval(() => setLit((n) => (n + 1) % 3), STEP_MS);
    return () => clearInterval(t);
  }, [reduced, active]);
  const c = color ?? colors.brand;
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel="Loading" style={{ flexDirection: 'row', gap: size / 2 }}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={{ width: size, height: size, backgroundColor: c, opacity: reduced || i === lit ? 1 : 0.3 }} />
      ))}
    </View>
  );
}
