import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { Habit } from '../domain/types';
import { useStreak } from '../store/StreakStore';
import { colors } from '../theme/tokens';
import { useTip } from './Glyph';

interface StartButtonsProps {
  habit: Habit;
  size?: number;
  /** Called after the timer starts (e.g. to close a picker). */
  onStarted?(): void;
}

/**
 * Two round start buttons: a filled circle with the full length, a half-filled
 * circle with the minimum. Either one counts the habit as done for the day.
 * With a minimum equal to the full length, only the full button shows.
 */
export function StartButtons({ habit, size = 46, onStarted }: StartButtonsProps) {
  const { config, actions } = useStreak();
  const start = (min: number) => {
    actions.startTimer(habit.id, min);
    onStarted?.();
  };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <StartCircle
        kind="full"
        minutes={habit.dailyTargetMin}
        size={size}
        accent={config.accent}
        label={`Start ${habit.name}, full ${habit.dailyTargetMin} minutes`}
        onPress={() => start(habit.dailyTargetMin)}
      />
      {habit.minTargetMin < habit.dailyTargetMin && (
        <StartCircle
          kind="min"
          minutes={habit.minTargetMin}
          size={size}
          accent={config.accent}
          label={`Start ${habit.name}, minimum ${habit.minTargetMin} minutes`}
          onPress={() => start(habit.minTargetMin)}
        />
      )}
    </View>
  );
}

function StartCircle({
  kind,
  minutes,
  size,
  accent,
  label,
  onPress,
}: {
  kind: 'full' | 'min';
  minutes: number;
  size: number;
  accent: string;
  label: string;
  onPress(): void;
}) {
  const { show, tip } = useTip(label);
  const r = size / 2 - 1.5;
  const c = size / 2;
  // The full button is a solid disc with a white number; the minimum is a
  // ring whose left half is filled, the number sitting on the right half.
  return (
    <View style={{ position: 'relative' }}>
      <Pressable
        onPress={onPress}
        onLongPress={show}
        hitSlop={4}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => ({ width: size, height: size, opacity: pressed ? 0.7 : 1 })}
      >
        <Svg width={size} height={size} style={{ position: 'absolute' }}>
          {kind === 'full' ? (
            <Circle cx={c} cy={c} r={r} fill={accent} stroke={accent} strokeWidth={2} />
          ) : (
            <>
              <Circle cx={c} cy={c} r={r} fill={colors.card} stroke={accent} strokeWidth={2} />
              <Path d={`M${c} ${c - r}A${r} ${r} 0 0 0 ${c} ${c + r}z`} fill={accent + '38'} />
            </>
          )}
        </Svg>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text
            style={{
              fontSize: size * 0.34,
              fontWeight: '800',
              color: kind === 'full' ? '#FFFFFF' : accent,
              fontVariant: ['tabular-nums'],
            }}
          >
            {minutes}
          </Text>
        </View>
      </Pressable>
      {tip}
    </View>
  );
}
