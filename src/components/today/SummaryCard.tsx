import React, { useState } from 'react';
import { View } from 'react-native';

import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { TodayItem } from '../../domain/day';
import { fmtDur, sayDur } from '../../domain/time';
import { useTheme } from '../../theme/ThemeProvider';
import { useReducedMotion } from '../../theme/useMotion';
import { Flame } from '../Flame';
import { Glyph, GlyphName } from '../Glyph';
import { Press } from '../motion/Press';
import { DoneRow } from './PlanRow';
import { Text } from '../Text';

/**
 * The finished day in one card: habits done, time today and the streak, each
 * a glyph with its number (and unit). Tap to see the habits.
 */
export function SummaryCard({ items, trackedSec, streak, animateIn, onRow }: { items: TodayItem[]; trackedSec: number; streak: number; animateIn: boolean; onRow(i: TodayItem): void }) {
  const t = useTheme();
  const { colors, radius } = t;
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);
  const done = items.filter((i) => i.done).length;
  const entering = !animateIn ? undefined : reduced ? FadeIn.delay(300) : FadeInDown.delay(1100).springify().damping(15);

  return (
    <Animated.View entering={entering} style={{ marginTop: 18 }}>
      <Press
        kind="card"
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`Day complete: ${done} habit${done === 1 ? '' : 's'}, ${sayDur(trackedSec)}, ${streak} day streak`}
        style={[{ backgroundColor: colors.card, borderRadius: radius.xl, padding: 16, gap: 12 }, t.shadow]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' }}>
          <Stat glyph="habits" value={String(done)} />
          <Stat glyph="clock" value={fmtDur(trackedSec)} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Flame days={streak} size={22} />
            <Text style={{ fontSize: 20, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'] }}>{streak}</Text>
          </View>
          <Glyph name={open ? 'chevronUp' : 'chevronDown'} size={18} color={colors.muted} />
        </View>
        {open && (
          <View style={{ gap: 8 }}>
            {items.map((i) => (
              <DoneRow key={i.habitId} item={i} onPress={() => onRow(i)} />
            ))}
          </View>
        )}
      </Press>
    </Animated.View>
  );
}

function Stat({ glyph, value }: { glyph: GlyphName; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Glyph name={glyph} size={20} color={colors.sub} />
      <Text style={{ fontSize: 20, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'] }}>{value}</Text>
    </View>
  );
}
