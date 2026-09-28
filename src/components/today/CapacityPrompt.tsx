import React from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';

import { DayLevel } from '../../domain/types';
import { useTheme } from '../../theme/ThemeProvider';
import { useReducedMotion } from '../../theme/useMotion';
import { Glyph, GlyphName, IconButton } from '../Glyph';

const LEVELS: { level: DayLevel; glyph: GlyphName; label: string }[] = [
  { level: 'light', glyph: 'capLight', label: 'Light day, half the usual time' },
  { level: 'normal', glyph: 'capNormal', label: 'Normal day' },
  { level: 'heavy', glyph: 'capHeavy', label: 'Big day, one and a half times the usual time' },
];

/** First open of the day: how much room is there today? Dismissible; counts for today only. */
export function CapacityPrompt({ onPick }: { onPick(level: DayLevel | null): void }) {
  const t = useTheme();
  const { colors, radius } = t;
  const reduced = useReducedMotion();
  return (
    <Animated.View
      entering={reduced ? FadeIn : FadeInDown.springify().damping(16)}
      exiting={FadeOut.duration(160)}
      style={[{ marginTop: 16, backgroundColor: colors.card, borderRadius: radius.xl, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }, t.shadow]}
    >
      <Glyph name="clock" size={22} color={colors.sub} label="How much time today?" />
      <View style={{ flex: 1, flexDirection: 'row', gap: 8 }}>
        {LEVELS.map((l) => (
          <View key={l.level} style={{ flex: 1 }}>
            <IconButton
              label={l.label}
              name={l.glyph}
              size={26}
              color={colors.brand}
              bg={colors.brandLight}
              edge={t.dark ? colors.line : '#C7DEFF'}
              variant="chunky"
              onPress={() => onPick(l.level)}
              style={{ height: 48, borderRadius: radius.md }}
            />
          </View>
        ))}
      </View>
      <IconButton label="Not now" name="close" size={16} color={colors.muted} diameter={32} onPress={() => onPick(null)} />
    </Animated.View>
  );
}
