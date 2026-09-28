import React, { useMemo } from 'react';
import { Text, View } from 'react-native';

import { heatLevel, timeOfDay } from '../../domain/insights';
import { sayDur } from '../../domain/time';
import { PersistedState } from '../../domain/types';
import { mix } from '../../theme/palette';
import { useTheme } from '../../theme/ThemeProvider';

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** When time gets tracked over the last 12 weeks: weekdays by hour, in brand blue shades (darker = more). */
export function TimeHeatmap({ data, now }: { data: PersistedState; now: number }) {
  const t = useTheme();
  const { colors } = t;
  const tod = useMemo(() => timeOfDay(data, null, now), [data, Math.floor(now / 3_600_000)]);
  if (!tod.columns.length) return null;
  const shade = (lvl: number) => (lvl === 0 ? colors.track : mix(t.dark ? colors.card : '#FFFFFF', colors.brand, 0.2 + lvl * 0.2));
  const cell = Math.max(12, Math.min(26, 260 / tod.columns.length));

  return (
    <View style={{ gap: 4 }}>
      {tod.cells.map((row, d) => (
        <View key={d} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
          <Text style={{ width: 16, fontSize: 11, fontWeight: '800', color: colors.sub }}>{DAYS[d]}</Text>
          {row.map((sec, c) => {
            const lvl = heatLevel(sec, tod.max);
            return (
              <View
                key={c}
                accessible
                accessibilityLabel={`${FULL[d]} ${tod.columns[c].start}:00, ${sayDur(sec)}`}
                style={{ width: cell, height: cell, borderRadius: 5, backgroundColor: shade(lvl), borderWidth: lvl === 4 ? 2 : 0, borderColor: colors.brandDark }}
              />
            );
          })}
        </View>
      ))}
      <View style={{ flexDirection: 'row', gap: 3, marginLeft: 19 }}>
        {tod.columns.map((c, i) => (
          <Text key={i} style={{ width: cell, fontSize: 9.5, fontWeight: '700', color: colors.muted, textAlign: 'center' }}>
            {i % 2 === 0 ? c.start : ''}
          </Text>
        ))}
      </View>
    </View>
  );
}
