// A short, non-blocking level moment near the top edge: a pixel burst,
// "LV N" and the XP bar refilling. Reduce motion: the panel alone.
import React, { useEffect, useEffectEvent } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import Animated, { SharedValue, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { GameState } from '../../../domain/game/derive';
import { feedback } from '../../../game/feedback';
import { PixelPanel } from '../../../game/ui/PixelPanel';
import { PixelText } from '../../../game/ui/PixelText';
import { QUI } from '../../../game/ui/theme';
import { QUEST_MS } from '../../../game/ui/motion';

const SHOWN_MS = 1500;
const BURST = 10;

export function LevelUp({ level, game, onDone, reduced }: { level: number; game: GameState; onDone(): void; reduced: boolean }) {
  const insets = useSafeAreaInsets();
  const fill = useSharedValue(0);
  const burst = useSharedValue(0);
  const progress = game.xp.xpForNextLevel ? game.xp.xpIntoLevel / game.xp.xpForNextLevel : 0;
  const done = useEffectEvent(() => onDone());
  useEffect(() => {
    feedback.sfx('level_up', 'ceremony');
    AccessibilityInfo.announceForAccessibility(`Level ${level}`);
    if (!reduced) burst.value = withTiming(1, { duration: QUEST_MS.burst });
    const timer = setTimeout(() => done(), SHOWN_MS);
    return () => clearTimeout(timer);
  }, [level, reduced, burst]);
  useEffect(() => {
    fill.value = reduced ? progress : withTiming(progress, { duration: QUEST_MS.fill });
  }, [progress, reduced, fill]);
  const bar = useAnimatedStyle(() => ({ width: Math.round(fill.value * 150) }));
  return (
    <View style={{ position: 'absolute', top: Math.max(insets.top, 8) + 8, left: 24, right: 24, alignItems: 'center', pointerEvents: 'none' }}>
      {!reduced && (
        <View style={{ position: 'absolute', top: 18, left: 0, right: 0, alignItems: 'center' }}>
          {Array.from({ length: BURST }, (_, i) => <Spark key={i} i={i} t={burst} />)}
        </View>
      )}
      <PixelPanel tone="gold" padding={2} style={{ alignItems: 'center', gap: 6 }}>
        <PixelText size="lg" bold accessibilityLiveRegion="polite" accessibilityLabel={`Level ${level}`}>LV {level}</PixelText>
        <View style={{ width: 154, height: 8, padding: 2, backgroundColor: QUI.ink }}>
          <Animated.View style={[{ height: 4, backgroundColor: QUI.xp }, bar]} />
        </View>
      </PixelPanel>
    </View>
  );
}

/** One square pixel flying out from the panel, snapped to whole points. */
function Spark({ i, t }: { i: number; t: SharedValue<number> }) {
  const angle = (i / BURST) * Math.PI * 2;
  const reach = 70 + (i % 3) * 14;
  const style = useAnimatedStyle(() => ({
    opacity: 1 - t.value,
    transform: [
      { translateX: Math.round(Math.cos(angle) * reach * t.value) },
      { translateY: Math.round(Math.sin(angle) * reach * 0.5 * t.value) },
    ],
  }));
  return <Animated.View style={[{ position: 'absolute', width: 4, height: 4, backgroundColor: i % 2 ? QUI.goldLight : QUI.white }, style]} />;
}
