import React, { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { feedback } from '../feedback/feedback';
import { Screen } from '../store/StreakStore';
import { press } from '../theme/motion';
import { useTheme } from '../theme/ThemeProvider';
import { useReducedMotion } from '../theme/useMotion';
import { Glyph, GlyphName } from './Glyph';
import { usePressMotion } from './motion/Press';
import { QuestBadge, useFreshChest } from './QuestBadge';

const TAB_FADE = { duration: 180, easing: Easing.out(Easing.quad) };

const TABS: { key: Screen; label: string; glyph: GlyphName }[] = [
  { key: 'today', label: 'Today', glyph: 'today' },
  { key: 'projects', label: 'Projects', glyph: 'target' },
  { key: 'stats', label: 'Stats', glyph: 'stats' },
  { key: 'quest', label: 'Quest', glyph: 'quest' },
];

/**
 * Four icon tabs. Inactive icons use the secondary ink (readable in bright
 * light); the active one sits on a colored pill that fades in, no bounce.
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
        paddingHorizontal: 12,
        paddingBottom: Math.max(insets.bottom, 10),
      }}
    >
      {TABS.map((tab) => (
        tab.key === 'quest' ? (
          <QuestTabItem key={tab.key} on={active === tab.key} onPress={() => onChange(tab.key)} />
        ) : (
          <Tab key={tab.key} label={tab.label} glyph={tab.glyph} on={active === tab.key} onPress={() => onChange(tab.key)} />
        )
      ))}
    </View>
  );
}

/**
 * The Quest tab reads the game (for its badge) on its own, so data changes
 * re-render just this item, not the whole bar.
 */
function QuestTabItem({ on, onPress }: { on: boolean; onPress(): void }) {
  const fresh = useFreshChest();
  return <Tab label={fresh ? 'Quest, a chest is waiting' : 'Quest'} glyph="quest" on={on} onPress={onPress} badge={fresh ? <QuestBadge /> : null} />;
}

function Tab({ label, glyph, on, onPress, badge }: { label: string; glyph: GlyphName; on: boolean; onPress(): void; badge?: React.ReactNode }) {
  const { colors, radius } = useTheme();
  const reduced = useReducedMotion();
  const pressMotion = usePressMotion('icon');
  // The pill fades in and out (~180ms); the icon lifts to at most 1.05 and settles without overshoot.
  const pill = useSharedValue(on ? 1 : 0);
  const s = useSharedValue(1);
  useEffect(() => {
    pill.value = withTiming(on ? 1 : 0, TAB_FADE);
    if (on && !reduced) s.value = withSequence(withTiming(1.05, press.in), withSpring(1, press.out));
  }, [on, reduced, pill, s]);
  const pillStyle = useAnimatedStyle(() => ({ opacity: pill.value }));
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Pressable
        onPress={() => {
          // Navigation: the tap sound, no haptic.
          if (!on) feedback('tap', { haptic: false });
          onPress();
        }}
        onPressIn={pressMotion.onPressIn}
        onPressOut={pressMotion.onPressOut}
        accessibilityRole="tab"
        accessibilityLabel={label}
        accessibilityState={{ selected: on }}
        hitSlop={8}
      >
        <Animated.View style={[{ width: 72, height: 42, alignItems: 'center', justifyContent: 'center' }, pressMotion.style]}>
          <Animated.View style={[{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: radius.pill, backgroundColor: colors.brandLight }, pillStyle]} />
          <Animated.View style={iconStyle}>
            <Glyph name={glyph} size={25} color={on ? colors.brand : colors.sub} bg={on ? colors.brandLight : colors.card} />
          </Animated.View>
          {badge}
        </Animated.View>
      </Pressable>
    </View>
  );
}
