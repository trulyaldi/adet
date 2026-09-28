import React, { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { DotRow } from '../components/DotRow';
import { CloseButton, Glyph, IconButton } from '../components/Glyph';
import { Icon } from '../components/Icon';
import { Sheet } from '../components/Sheet';
import { dkey } from '../domain/time';
import { selectWeek, WeekCell } from '../domain/week';
import { useStreak } from '../store/StreakStore';
import { colors, radius } from '../theme/tokens';

const CELL = 36;

/**
 * The week at a glance: seven days (a check for complete, a moon for the
 * rest day, a partial ring for today, a quiet circle otherwise), then each
 * habit's dots toward its weekly target and its weeks-on-target chain.
 */
export function WeekSheet() {
  const { data, ui, now, settings, config, actions } = useStreak();
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    if (ui.weekOpen) setOffset(0);
  }, [ui.weekOpen]);
  const day = dkey(new Date(now));
  // Recomputed per minute, not per tick: a running timer moves today's ring at most that often.
  const minute = Math.floor(now / 60_000);
  const model = useMemo(
    () => (ui.weekOpen ? selectWeek(data, { budgetMin: settings.budgetMin, planCap: settings.planCap }, now, offset) : null),
    [ui.weekOpen, data, settings.budgetMin, settings.planCap, day, minute, offset]
  );

  return (
    <Sheet visible={ui.weekOpen} onClose={actions.closeWeek} maxHeightPct={0.86}>
      {model && (
        <View style={{ gap: 18, paddingTop: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, zIndex: 10 }}>
            <IconButton
              label="Earlier week"
              name="chevronLeft"
              size={18}
              color={colors.subtext}
              bg={colors.track}
              diameter={32}
              disabled={!model.hasEarlier}
              onPress={() => setOffset((o) => o + 1)}
            />
            <Text style={{ fontSize: 15, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'] }}>{model.rangeLabel}</Text>
            <IconButton
              label="Later week"
              name="chevronRight"
              size={18}
              color={colors.subtext}
              bg={colors.track}
              diameter={32}
              disabled={model.isCurrent}
              onPress={() => setOffset((o) => Math.max(0, o - 1))}
            />
            <View style={{ flex: 1 }} />
            <View
              accessible
              accessibilityLabel={`${model.streak} day streak, longest ${model.longest}`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
            >
              <Glyph name="flame" size={15} color={colors.ink} />
              <Text style={{ fontSize: 14, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'] }}>{model.streak}</Text>
            </View>
            <CloseButton onPress={actions.closeWeek} />
          </View>

          {/* Seven days */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {model.cells.map((c) => (
              <View key={c.key} accessible accessibilityLabel={c.label} style={{ alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 12, fontWeight: '800', color: c.today ? colors.ink : colors.muted }}>{c.letter}</Text>
                <DayCell cell={c} accent={config.accent} />
                <Text style={{ fontSize: 11, fontWeight: c.today ? '800' : '600', color: c.today ? colors.ink : colors.muted, fontVariant: ['tabular-nums'] }}>
                  {c.date}
                </Text>
              </View>
            ))}
          </View>

          {/* Each habit's week */}
          <View>
            {model.habits.map((h) => (
              <View
                key={h.habitId}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 11, borderTopWidth: 1, borderTopColor: colors.hairline }}
              >
                <View style={{ width: 32, height: 32, borderRadius: radius.sm, backgroundColor: h.tile, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon path={h.iconPath} size={16} />
                </View>
                <View style={{ flex: 1, gap: 6 }}>
                  <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '700', color: colors.ink }}>{h.name}</Text>
                  <DotRow total={h.target} filled={h.done} size={8} color={config.accent} label={`${h.done} of ${h.target} this week`} />
                </View>
                {h.streakWeeks > 0 && (
                  <View
                    accessible
                    accessibilityLabel={`${h.streakWeeks} ${h.streakWeeks === 1 ? 'week' : 'weeks'} in a row on target`}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                  >
                    <Glyph name="chain" size={14} color={colors.subtext} />
                    <Text style={{ fontSize: 13, fontWeight: '700', color: colors.subtext, fontVariant: ['tabular-nums'] }}>{h.streakWeeks}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        </View>
      )}
    </Sheet>
  );
}

/** One day: check, moon, partial ring, or a quiet circle. Shapes differ, not only colors. */
function DayCell({ cell: c, accent }: { cell: WeekCell; accent: string }) {
  const box = { width: CELL, height: CELL, alignItems: 'center' as const, justifyContent: 'center' as const };
  if (c.kind === 'complete') {
    return (
      <View style={[box, { borderRadius: radius.pill, backgroundColor: accent + '1F' }]}>
        <Glyph name="done" size={20} color={accent} bg={accent + '1F'} />
      </View>
    );
  }
  if (c.kind === 'rest') {
    return (
      <View style={[box, { borderRadius: radius.pill, backgroundColor: colors.track }]}>
        <Glyph name="rest" size={18} color={colors.subtext} bg={colors.track} />
      </View>
    );
  }
  const r = CELL / 2 - 2;
  const circ = 2 * Math.PI * r;
  const frac = c.kind === 'progress' && c.total > 0 ? c.done / c.total : 0;
  return (
    <View style={box}>
      <Svg width={CELL} height={CELL} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle
          cx={CELL / 2}
          cy={CELL / 2}
          r={r}
          fill="none"
          stroke={c.kind === 'future' ? colors.track2 : colors.track3}
          strokeWidth={c.kind === 'progress' ? 4 : 2}
          strokeDasharray={c.kind === 'future' ? '3 4' : undefined}
        />
        {frac > 0 && (
          <Circle
            cx={CELL / 2}
            cy={CELL / 2}
            r={r}
            fill="none"
            stroke={accent}
            strokeWidth={4}
            strokeLinecap="round"
            strokeDasharray={`${circ} ${circ}`}
            strokeDashoffset={circ * (1 - frac)}
          />
        )}
      </Svg>
    </View>
  );
}
