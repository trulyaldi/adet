import React, { memo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import Animated, { FadeIn } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { BadgeView } from '../../domain/stats';
import { MONTHS_SHORT } from '../../domain/time';
import { useTheme } from '../../theme/ThemeProvider';
import { BadgeArt } from '../celebrate/BadgeArt';
import { Flame } from '../Flame';
import { Glyph } from '../Glyph';
import { Press } from '../motion/Press';
import { ProjectInfo, StatsCard, TextNum } from './common';
import { Text } from '../Text';

const BADGE = 56;

export function badgeLabel(b: Pick<BadgeView, 'kind' | 'value'>, project?: string): string {
  if (b.kind === 'streak') return `${b.value} day streak`;
  if (b.kind === 'hours') return `${b.value} hours on ${project ?? 'a project'}`;
  if (b.kind === 'week') return `Weekly target reached${project ? ` on ${project}` : ''}`;
  return 'First session';
}

const dateOf = (ms: number) => {
  const d = new Date(ms);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
};

/**
 * The current streak (flame and number) with the longest beside it, then a
 * shelf of earned badges and the next streak badge as a faint outline with a
 * thin ring of progress. Tap a badge for when it was earned.
 */
export const StreakShelf = memo(function StreakShelf({
  current,
  longest,
  badges,
  next,
  info,
}: {
  current: number;
  longest: number;
  badges: BadgeView[];
  next: { value: number; frac: number } | null;
  info: Map<string, ProjectInfo>;
}) {
  const t = useTheme();
  const { colors } = t;
  const [sel, setSel] = useState<string | null>(null);
  const picked = badges.find((b) => b.id === sel);
  return (
    <StatsCard glyph="flame" label="Streaks and badges">
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 18 }}>
        <View accessible accessibilityLabel={`Current streak, ${current} day${current === 1 ? '' : 's'}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Flame days={current} size={34} />
          <TextNum style={{ fontSize: 32, letterSpacing: -0.5 }}>{current}</TextNum>
        </View>
        <View accessible accessibilityLabel={`Longest streak, ${longest} day${longest === 1 ? '' : 's'}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingBottom: 5 }}>
          <Glyph name="flame" size={15} color={colors.muted} />
          <TextNum style={{ fontSize: 15, color: colors.sub }}>{longest}</TextNum>
        </View>
      </View>

      {(badges.length > 0 || next) && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingVertical: 2 }}>
          {badges.map((b) => (
            <Press
              kind="icon"
              key={b.id}
              onPress={() => setSel((s) => (s === b.id ? null : b.id))}
              accessibilityRole="button"
              accessibilityState={{ selected: sel === b.id }}
              accessibilityLabel={`${badgeLabel(b, b.projectId ? info.get(b.projectId)?.name : undefined)} badge`}
            >
              <BadgeArt info={b} size={BADGE} />
            </Press>
          ))}
          {next && <NextBadge value={next.value} frac={next.frac} current={current} />}
        </ScrollView>
      )}

      {picked && (
        <Animated.View entering={FadeIn.duration(160)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.well, borderRadius: t.radius.lg, padding: 10 }}>
          <BadgeArt info={picked} size={40} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text numberOfLines={2} style={{ fontSize: 14, fontWeight: '800', color: colors.ink }}>
              {badgeLabel(picked, picked.projectId ? info.get(picked.projectId)?.name : undefined)}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Glyph name="calendar" size={14} color={colors.sub} label="Earned" />
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.sub }}>{dateOf(picked.earnedAt)}</Text>
            </View>
          </View>
        </Animated.View>
      )}
    </StatsCard>
  );
});

/** The next streak badge: faint, inside a thin ring filled as far as the streak has come. */
function NextBadge({ value, frac, current }: { value: number; frac: number; current: number }) {
  const { colors } = useTheme();
  const size = BADGE + 10;
  const r = size / 2 - 1.5;
  const circ = 2 * Math.PI * r;
  return (
    <View accessible accessibilityLabel={`Next badge: a ${value} day streak, ${current} of ${value} days`} style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', marginTop: -5 }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={colors.track} strokeWidth={2} />
        <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={colors.brand} strokeWidth={2} strokeLinecap="round" strokeDasharray={`${circ} ${circ}`} strokeDashoffset={circ * (1 - frac)} />
      </Svg>
      <BadgeArt info={{ id: 'next', kind: 'streak', value }} size={BADGE} dim />
    </View>
  );
}
