import React, { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { feedback } from '../feedback/feedback';
import { Screen } from '../store/StreakStore';
import { springs } from '../theme/motion';
import { useTheme } from '../theme/ThemeProvider';
import { useReducedMotion } from '../theme/useMotion';
import { Glyph, GlyphName } from './Glyph';

const TABS: { key: Screen; label: string; glyph: GlyphName }[] = [
  { key: 'today', label: 'Today', glyph: 'today' },
  { key: 'projects', label: 'Projects', glyph: 'target' },
  { key: 'stats', label: 'Stats', glyph: 'stats' },
];

/**
 * Three icon tabs. Inactive icons use the secondary ink (readable in bright
 * light); the active one sits on a colored pill and gives a small bounce.
 */
export function TabBar({ active, onChange }: { active: Screen; onChange(s: Screen): void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      accessibilityRole="tablist"
      style={{
        backgroundColor: colors.card,
        borderTopWidth: 1,
        borderTopColor: colors.line,
        flexDirection: 'row',
        paddingTop: 8,
        paddingHorizontal: 20,
        paddingBottom: Math.max(insets.bottom, 10),
      }}
    >
      {TABS.map((tab) => (
        <Tab key={tab.key} label={tab.label} glyph={tab.glyph} on={active === tab.key} onPress={() => onChange(tab.key)} />
      ))}
    </View>
  );
}

function Tab({ label, glyph, on, onPress }: { label: string; glyph: GlyphName; on: boolean; onPress(): void }) {
  const { colors, radius } = useTheme();
  const reduced = useReducedMotion();
  const s = useSharedValue(1);
  useEffect(() => {
    if (on && !reduced) s.value = withSequence(withSpring(1.18, springs.bounce), withSpring(1, springs.bounce));
  }, [on, reduced, s]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Pressable
        onPress={() => {
          if (!on) feedback('tap');
          onPress();
        }}
        accessibilityRole="tab"
        accessibilityLabel={label}
        accessibilityState={{ selected: on }}
        hitSlop={8}
        style={{ width: 72, height: 42, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? colors.brandLight : 'transparent' }}
      >
        <Animated.View style={style}>
          <Glyph name={glyph} size={25} color={on ? colors.brand : colors.sub} bg={on ? colors.brandLight : colors.card} />
        </Animated.View>
      </Pressable>
    </View>
  );
}
