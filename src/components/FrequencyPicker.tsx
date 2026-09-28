import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { Frequency, frequencyLabel, normalizeFrequency, WEEKDAY_LETTERS, weeklyTargetOf } from '../domain/frequency';
import { useTheme } from '../theme/ThemeProvider';
import { Glyph, IconButton } from './Glyph';

const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

interface FrequencyPickerProps {
  value: Frequency;
  onChange(f: Frequency): void;
  accent: string;
  /** Only the times-per-week dots (no weekday row). */
  compact?: boolean;
}

/**
 * Calendar glyph, then two rows. The count row sets times per week: tap a
 * dot, or step with − / +; seven filled dots is every day. The weekday row
 * pins the habit to those days. Whichever row is in use is at full strength;
 * the other is dimmed.
 */
export function FrequencyPicker({ value, onChange, accent, compact }: FrequencyPickerProps) {
  const { colors, radius, shadow } = useTheme();
  const count = weeklyTargetOf(value);
  const byDays = value.kind === 'days';
  const setTimes = (times: number) => onChange(normalizeFrequency({ kind: 'weekly', times }));
  const toggleDay = (d: number) => {
    const days = byDays ? value.days : [];
    onChange(normalizeFrequency({ kind: 'days', days: days.includes(d) ? days.filter((x) => x !== d) : [...days, d] }));
  };

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, opacity: byDays ? 0.45 : 1 }}>
        {!compact && <Glyph name="calendar" size={20} color={colors.sub} label={frequencyLabel(value)} />}
        {!compact && (
          <IconButton label="Fewer times a week" name="minus" size={15} bg={colors.card} diameter={30} disabled={count <= 1} onPress={() => setTimes(count - 1)} />
        )}
        <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          {Array.from({ length: 7 }, (_, i) => {
            const on = i < count;
            const n = i + 1;
            return (
              <IconButton
                key={i}
                onPress={() => setTimes(n)}
                hitSlop={4}
                label={n === 7 ? 'Every day' : n === 1 ? 'Once a week' : `${n} times a week`}
                selected={!byDays && n === count}
                style={{ padding: 3 }}
              >
                <View
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 7,
                    backgroundColor: on ? accent : 'transparent',
                    borderWidth: 2,
                    borderColor: on ? accent : colors.muted,
                  }}
                />
              </IconButton>
            );
          })}
        </View>
        {!compact && (
          <IconButton label="More times a week" name="plus" size={15} bg={colors.card} diameter={30} disabled={count >= 7} onPress={() => setTimes(count + 1)} />
        )}
      </View>

      {!compact && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingLeft: 30, opacity: byDays ? 1 : 0.45 }}>
          {WEEKDAY_LETTERS.map((letter, d) => {
            const on = byDays && value.days.includes(d);
            return (
              <Pressable
                key={d}
                onPress={() => toggleDay(d)}
                accessibilityRole="button"
                accessibilityLabel={WEEKDAY_NAMES[d]}
                accessibilityState={{ selected: on }}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: radius.pill,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: on ? accent : colors.card,
                  borderWidth: 1.5,
                  borderColor: on ? accent : colors.track,
                }}
              >
                <Text style={{ fontSize: 12.5, fontWeight: '800', color: on ? colors.onBrand : colors.sub }}>{letter}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}
