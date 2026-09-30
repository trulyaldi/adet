// "+12 XP" chips (v2 N7.5): when something done outside a session earns XP or
// credits (a weak point ticked, a quick log, a completed day, a week's bounty),
// a small pixel chip floats up for about a second. Derived: it watches the
// game's totals. Sessions (the Loot sheet counts those up), open sheets and a
// running focus view stay quiet. No sound; reduced motion only fades.

import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { useQuestStarted } from '../data/itemsRepo';
import { gameStateOf } from '../domain/game/fromData';
import { isLootOpen } from '../game/state/loot';
import { anyModalOpen, useData, useUi } from '../store/StreakStore';
import { useTheme } from '../theme/ThemeProvider';
import { useReducedMotion } from '../theme/useMotion';
import { rewardChipText } from './rewardChip';
import { Text } from './Text';

const SHOWN_MS = 1100;

export function RewardChipHost() {
  const data = useData();
  const started = useQuestStarted();
  const busy = useUi((u) => anyModalOpen(u) || u.timerOpen);
  const game = gameStateOf(data);
  const totals = { xp: game.xp.total, credits: game.credits.earned };
  const prev = useRef<{ totals: typeof totals; sessions: typeof data.sessions } | null>(null);
  const [chip, setChip] = useState<{ text: string; n: number } | null>(null);
  useEffect(() => {
    const was = prev.current;
    prev.current = { totals, sessions: data.sessions };
    if (!was || !started || busy || isLootOpen() || was.sessions !== data.sessions) return;
    const text = rewardChipText(was.totals, totals);
    // A reward just landed: show it once (one small chip; the previous one is replaced).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (text) setChip((c) => ({ text, n: (c?.n ?? 0) + 1 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totals.xp, totals.credits]);
  if (!chip) return null;
  return <Chip key={chip.n} text={chip.text} onDone={() => setChip(null)} />;
}

function Chip({ text, onDone }: { text: string; onDone(): void }) {
  const { colors, radius } = useTheme();
  const reduced = useReducedMotion();
  const y = useSharedValue(0);
  const o = useSharedValue(0);
  useEffect(() => {
    o.value = withSequence(withTiming(1, { duration: 150 }), withTiming(1, { duration: SHOWN_MS - 450 }), withTiming(0, { duration: 300 }));
    if (!reduced) y.value = withTiming(-18, { duration: SHOWN_MS });
    const t = setTimeout(onDone, SHOWN_MS + 50);
    return () => clearTimeout(t);
  }, [o, y, reduced, onDone]);
  const style = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ translateY: Math.round(y.value) }] }));
  return (
    <View style={{ position: 'absolute', left: 0, right: 0, bottom: 110, alignItems: 'center', pointerEvents: 'none' }}>
      <Animated.View accessible accessibilityLiveRegion="polite" accessibilityLabel={text} style={[{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.sm, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.card }, style]}>
        <Text style={{ fontSize: 14, color: colors.ink }}>{text}</Text>
      </Animated.View>
    </View>
  );
}
