import React from 'react';
import { View } from 'react-native';

import { WeekDots } from '../../domain/day';
import { useTheme } from '../../theme/ThemeProvider';

/**
 * One dot per day the habit wants this week: filled when done, hollow when
 * still to do. Today's dot carries a small outer ring (the done one if it's
 * done today, else the next to fill), so position doesn't rely on color.
 */
export function WeekDotsRow({ week, color, size = 8 }: { week: WeekDots; color: string; size?: number }) {
  const { colors } = useTheme();
  const n = Math.max(1, Math.min(7, week.total));
  const filled = Math.min(n, week.done);
  const todayAt = week.doneToday ? filled - 1 : Math.min(n - 1, filled);
  return (
    <View
      accessible
      accessibilityLabel={`${Math.min(week.done, week.total)} of ${week.total} this week${week.doneToday ? ', done today' : ''}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: size * 0.55 }}
    >
      {Array.from({ length: n }, (_, i) => {
        const on = i < filled;
        const today = i === todayAt;
        return (
          <View
            key={i}
            style={{
              width: size + 6,
              height: size + 6,
              borderRadius: (size + 6) / 2,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: today ? 1.5 : 0,
              borderColor: today ? color : 'transparent',
            }}
          >
            <View
              style={{
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: on ? color : 'transparent',
                borderWidth: on ? 0 : 1.6,
                borderColor: colors.muted,
              }}
            />
          </View>
        );
      })}
    </View>
  );
}
