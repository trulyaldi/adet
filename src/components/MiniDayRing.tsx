import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Circle, G, Path } from 'react-native-svg';

import { DaySeg, WeekDayState } from '../domain/weekView';
import { useTheme } from '../theme/ThemeProvider';
import { useAppActive, useReducedMotion } from '../theme/useMotion';
import { Glyph } from './Glyph';

function arc(c: number, r: number, from: number, to: number): string {
  const pt = (deg: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return `${(c + r * Math.cos(rad)).toFixed(2)} ${(c + r * Math.sin(rad)).toFixed(2)}`;
  };
  return `M${pt(from)}A${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${pt(to)}`;
}

/**
 * A day as a small segmented ring in its projects' colors. Complete days
 * carry a check, rest days a moon, today a softly pulsing outline; other
 * past days are a plain empty ring (never red).
 */
export function MiniDayRing({ segs, state, size = 40 }: { segs: DaySeg[]; state: WeekDayState; size?: number }) {
  const t = useTheme();
  const { colors } = t;
  const reduced = useReducedMotion();
  const active = useAppActive();
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (state !== 'today' || reduced || !active) {
      cancelAnimation(pulse);
      pulse.value = 0;
      return;
    }
    pulse.value = withRepeat(withTiming(1, { duration: 1400 }), -1, true);
    return () => cancelAnimation(pulse);
  }, [state, reduced, active, pulse]);
  const pulseStyle = useAnimatedStyle(() => ({ opacity: 0.35 + pulse.value * 0.65, transform: [{ scale: 1 + pulse.value * 0.08 }] }));

  const stroke = size * 0.13;
  const c = size / 2;
  const r = c - stroke / 2 - 2;
  const n = segs.length;
  const gap = n > 1 ? 14 : 0;
  const seg = n ? 360 / n : 360;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {state === 'today' && (
        <Animated.View style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: colors.brand }, pulseStyle]} />
      )}
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        {n === 0 || state === 'future' ? (
          <Circle cx={c} cy={c} r={r} fill="none" stroke={colors.track} strokeWidth={stroke} strokeDasharray={state === 'future' ? '2 4' : undefined} />
        ) : (
          segs.map((s, i) => {
            const sw = t.swatch(s.color);
            const from = i * seg + gap / 2;
            const to = n === 1 ? 359.9 : (i + 1) * seg - gap / 2;
            const fillTo = from + (to - from) * s.frac;
            return (
              <G key={i}>
                <Path d={arc(c, r, from, to)} stroke={sw.light} strokeWidth={stroke} fill="none" strokeLinecap="round" />
                {s.frac > 0.02 && <Path d={arc(c, r, from, fillTo)} stroke={sw.base} strokeWidth={stroke} fill="none" strokeLinecap="round" />}
              </G>
            );
          })
        )}
      </Svg>
      {state === 'complete' && <Glyph name="done" size={size * 0.42} color={colors.brand} />}
      {state === 'rest' && <Glyph name="moon" size={size * 0.4} color={colors.sub} />}
    </View>
  );
}
