import React from 'react';
import { View } from 'react-native';

import { Swatch } from '../theme/palette';
import { useTheme } from '../theme/ThemeProvider';
import { Glyph, IconButton } from './Glyph';
import { Text } from './Text';

const CHIPS = [15, 30, 60];

/**
 * Log time after the fact: +15 / +30 / +60 minutes ending now, or the clock
 * for a custom duration and time.
 */
export function QuickAdd({ name, swatch, onAdd, onCustom }: { name: string; swatch: Swatch; onAdd(min: number): void; onCustom(): void }) {
  const t = useTheme();
  const { colors, radius } = t;
  const ink = t.dark ? swatch.base : swatch.dark;
  return (
    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
      {CHIPS.map((m) => (
        <IconButton
          key={m}
          label={`Log ${m} minutes of ${name}`}
          onPress={() => onAdd(m)}
          quiet
          variant="chunky"
          bg={swatch.light}
          edge={t.dark ? colors.line : swatch.bonus}
          style={{ height: 36, paddingHorizontal: 12, borderRadius: radius.pill }}
        >
          <Text style={{ fontSize: 14, fontWeight: '800', color: ink, fontVariant: ['tabular-nums'] }}>+{m}</Text>
        </IconButton>
      ))}
      <IconButton
        label={`Log a custom time for ${name}`}
        onPress={onCustom}
        variant="chunky"
        bg={swatch.light}
        edge={t.dark ? colors.line : swatch.bonus}
        style={{ height: 36, width: 44, borderRadius: radius.pill }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Glyph name="plus" size={12} color={ink} bg={swatch.light} />
          <Glyph name="clock" size={17} color={ink} bg={swatch.light} />
        </View>
      </IconButton>
    </View>
  );
}
