import React, { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, G, Path } from 'react-native-svg';

import { BadgeInfo } from '../../domain/milestones';
import { SWATCHES } from '../../theme/palette';
import { springs } from '../../theme/motion';
import { useTheme } from '../../theme/ThemeProvider';
import { useReducedMotion } from '../../theme/useMotion';
import { Glyph, GlyphName } from '../Glyph';

/** A scalloped medal outline (12 bumps) in a 100×100 box. */
function scallop(): string {
  const n = 12;
  let d = '';
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    const b = ((i + 0.5) / n) * Math.PI * 2 - Math.PI / 2;
    const p = [50 + Math.cos(a) * 44, 50 + Math.sin(a) * 44];
    const q = [50 + Math.cos(b) * 49, 50 + Math.sin(b) * 49];
    const nxt = ((i + 1) / n) * Math.PI * 2 - Math.PI / 2;
    const e = [50 + Math.cos(nxt) * 44, 50 + Math.sin(nxt) * 44];
    if (i === 0) d += `M${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
    if (i < n) d += `Q${q[0].toFixed(1)} ${q[1].toFixed(1)} ${e[0].toFixed(1)} ${e[1].toFixed(1)}`;
  }
  return d + 'Z';
}
const MEDAL = scallop();

export function badgeLook(info: BadgeInfo): { glyph: GlyphName; color: keyof typeof SWATCHES | 'brand' } {
  switch (info.kind) {
    case 'streak':
      return { glyph: 'flame', color: info.value >= 30 ? 'pink' : 'orange' };
    case 'hours':
      return { glyph: 'clock', color: info.color ?? 'indigo' };
    case 'week':
      return { glyph: 'done', color: info.color ?? 'green' };
    case 'first':
      return { glyph: 'sparkle', color: 'brand' };
  }
}

/**
 * A badge: a scalloped medal in its color with a glyph and number. `animated`
 * pops it in with slowly turning rays behind (for the celebration card).
 */
export function BadgeArt({ info, size = 64, animated, dim }: { info: BadgeInfo; size?: number; animated?: boolean; dim?: boolean }) {
  const t = useTheme();
  const reduced = useReducedMotion();
  const look = badgeLook(info);
  const sw = look.color === 'brand' ? t.brand : t.swatch(look.color);
  const pop = useSharedValue(animated && !reduced ? 0 : 1);
  const spin = useSharedValue(0);
  useEffect(() => {
    if (!animated || reduced) return;
    pop.value = withDelay(120, withSpring(1, springs.celebrate));
    spin.value = withRepeat(withTiming(1, { duration: 14000, easing: Easing.linear }), -1);
    return () => cancelAnimation(spin);
  }, [animated, reduced, pop, spin]);
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  const rayStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * 360}deg` }], opacity: pop.value }));
  const number = info.kind === 'streak' ? String(info.value) : info.kind === 'hours' ? `${info.value}h` : '';

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', opacity: dim ? 0.35 : 1 }}>
      {animated && (
        <Animated.View style={[{ position: 'absolute', width: size * 1.7, height: size * 1.7 }, rayStyle]}>
          <Svg width={size * 1.7} height={size * 1.7} viewBox="0 0 100 100">
            <G opacity={0.5}>
              {Array.from({ length: 10 }, (_, i) => (
                <Path key={i} d="M50 50L46 2L54 2Z" fill={sw.base} opacity={0.35} transform={`rotate(${i * 36} 50 50)`} />
              ))}
            </G>
          </Svg>
        </Animated.View>
      )}
      <Animated.View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, popStyle]}>
        <Svg width={size} height={size} viewBox="0 0 100 100" style={{ position: 'absolute' }}>
          <Path d={MEDAL} fill={sw.base} />
          <Circle cx={50} cy={50} r={34} fill={sw.light} />
          <Circle cx={50} cy={50} r={34} fill="none" stroke={sw.dark} strokeOpacity={0.25} strokeWidth={3} />
        </Svg>
        <Glyph name={look.glyph} size={size * 0.34} color={t.dark ? sw.base : sw.dark} bg={sw.light} />
        {!!number && (
          <Text style={{ fontSize: size * 0.16, fontWeight: '800', color: t.dark ? t.colors.ink : sw.dark, marginTop: -size * 0.02, fontVariant: ['tabular-nums'] }}>{number}</Text>
        )}
      </Animated.View>
    </View>
  );
}
