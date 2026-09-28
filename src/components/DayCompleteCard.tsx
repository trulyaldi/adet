import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';

import { HabitCard } from '../domain/today';
import { colors, radius, shadowCard } from '../theme/tokens';
import { CompletionMark } from './CompletionMark';
import { Glyph } from './Glyph';
import { Icon } from './Icon';
import { useReducedMotion } from './useReducedMotion';

interface DayCompleteCardProps {
  /** The day's plan, all done (empty on a free day). */
  plan: HabitCard[];
  /** Bonus habits done today. */
  bonus: HabitCard[];
  /** Habits done today and minutes tracked today. */
  habits: number;
  minutes: number;
  accent: string;
  /** Fade (and, without reduce motion, rise) in after the ring turns into the check. */
  animateIn?: boolean;
}

/**
 * The finished day, collapsed into one card: the Adet check, then a dots
 * glyph with the habits done and a clock with the minutes. Tap to see which.
 */
export function DayCompleteCard({ plan, bonus, habits, minutes, accent, animateIn }: DayCompleteCardProps) {
  const [open, setOpen] = useState(false);
  const reduced = useReducedMotion();
  const enter = useRef(new Animated.Value(animateIn ? 0 : 1)).current;
  useEffect(() => {
    if (!animateIn) return;
    Animated.timing(enter, { toValue: 1, duration: reduced ? 220 : 380, delay: reduced ? 0 : 650, useNativeDriver: true }).start();
  }, [animateIn, reduced, enter]);
  const rows = [...plan.map((c) => ({ c, bonus: false })), ...bonus.filter((c) => c.done).map((c) => ({ c, bonus: true }))];

  return (
    <Animated.View
      style={{
        opacity: enter,
        transform: reduced ? [] : [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
      }}
    >
      <Pressable
        onPress={() => setOpen((o) => !o)}
        disabled={!rows.length}
        accessibilityRole="button"
        accessibilityLabel={`Day complete: ${habits} ${habits === 1 ? 'habit' : 'habits'}, ${minutes} minutes`}
        accessibilityState={{ expanded: open }}
        style={[{ marginTop: 16, backgroundColor: colors.card, borderRadius: radius.xl, padding: 16 }, shadowCard]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
          <Glyph name="done" size={30} color={accent} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Glyph name="dots" size={18} color={colors.subtext} />
            <Text style={{ fontSize: 17, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'] }}>{habits}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Glyph name="clock" size={18} color={colors.subtext} />
            <Text style={{ fontSize: 17, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'] }}>{minutes}</Text>
          </View>
          <View style={{ flex: 1 }} />
          {rows.length > 0 && <Glyph name={open ? 'chevronUp' : 'chevronDown'} size={16} color={colors.muted} />}
        </View>

        {open &&
          rows.map(({ c, bonus: isBonus }) => (
            <View
              key={c.habitId}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 12, marginTop: 12, borderTopWidth: 1, borderTopColor: colors.hairline }}
            >
              <View style={{ width: 30, height: 30, borderRadius: radius.sm, backgroundColor: c.tile, alignItems: 'center', justifyContent: 'center' }}>
                <Icon path={c.iconPath} size={15} />
              </View>
              <Text numberOfLines={1} style={{ flex: 1, fontSize: 14, fontWeight: '700', color: colors.ink }}>
                {c.name}
              </Text>
              <CompletionMark mark={c.done} bonus={isBonus} size={18} />
            </View>
          ))}
      </Pressable>
    </Animated.View>
  );
}
