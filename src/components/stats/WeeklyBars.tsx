import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring } from 'react-native-reanimated';

import { projectLook } from '../../domain/look';
import { WeekColumn } from '../../domain/stats';
import { fmtDur, sayDur } from '../../domain/time';
import { PersistedState } from '../../domain/types';
import { springs } from '../../theme/motion';
import { useTheme } from '../../theme/ThemeProvider';
import { useReducedMotion } from '../../theme/useMotion';
import { Press } from '../motion/Press';

const H = 150;

/**
 * Twelve weeks of time as stacked bars in project colors. Bars grow in on
 * appear; tap one for that week's breakdown.
 */
export function WeeklyBars({ weeks, data }: { weeks: WeekColumn[]; data: PersistedState }) {
  const t = useTheme();
  const { colors, radius } = t;
  const [sel, setSel] = useState<number>(weeks.length - 1);
  const max = Math.max(3600, ...weeks.map((w) => w.total));
  const color = (pid: string) => t.swatch(projectLook(data.projects.find((p) => p.id === pid) ?? { id: pid }).color);
  const nameOf = (pid: string) => data.projects.find((p) => p.id === pid)?.name ?? '';
  const w = weeks[sel];

  return (
    <View style={{ gap: 12 }}>
      <View style={{ height: H, flexDirection: 'row', alignItems: 'flex-end', gap: 5 }}>
        {weeks.map((wk, i) => (
          <Press
            kind="card"
            key={wk.week}
            onPress={() => setSel(i)}
            accessibilityRole="button"
            accessibilityState={{ selected: sel === i }}
            accessibilityLabel={`Week of ${wk.label}, ${sayDur(wk.total)}`}
            style={{ flex: 1, height: H, justifyContent: 'flex-end' }}
          >
            <Bar i={i} frac={wk.total / max} selected={sel === i}>
              {wk.parts.map((p) => (
                <View key={p.projectId} style={{ flex: p.sec, backgroundColor: color(p.projectId).base }} />
              ))}
              {!wk.parts.length && <View style={{ flex: 1, backgroundColor: colors.track }} />}
            </Bar>
          </Press>
        ))}
      </View>
      {w && (
        <View style={{ backgroundColor: colors.well, borderRadius: radius.lg, padding: 12, gap: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 14, fontWeight: '800', color: colors.sub }}>{w.label}</Text>
            <Text style={{ fontSize: 15, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'] }}>{fmtDur(w.total)}</Text>
          </View>
          {w.parts.map((p) => (
            <View key={p.projectId} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: color(p.projectId).base }} />
              <Text numberOfLines={1} style={{ flex: 1, fontSize: 14, fontWeight: '700', color: colors.ink }}>
                {nameOf(p.projectId)}
              </Text>
              <Text style={{ fontSize: 14, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'] }}>{fmtDur(p.sec)}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function Bar({ i, frac, selected, children }: { i: number; frac: number; selected: boolean; children: React.ReactNode }) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const h = useSharedValue(reduced ? frac : 0);
  useEffect(() => {
    h.value = reduced ? frac : withDelay(i * 30, withSpring(frac, springs.progress));
  }, [frac, reduced, i, h]);
  const style = useAnimatedStyle(() => ({ height: Math.max(4, h.value * H) }));
  return (
    <Animated.View style={[{ borderRadius: 6, overflow: 'hidden', flexDirection: 'column-reverse', borderWidth: selected ? 2 : 0, borderColor: colors.ink }, style]}>
      {children}
    </Animated.View>
  );
}
