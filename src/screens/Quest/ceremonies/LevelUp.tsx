// A short, non-blocking level moment near the top edge.
import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { GameState } from '../../../domain/game/derive';
import { feedback } from '../../../game/feedback';
import { PixelPanel } from '../../../game/ui/PixelPanel';
import { PixelText } from '../../../game/ui/PixelText';
import { QUI } from '../../../game/ui/theme';

export function LevelUp({ level, game, onDone, reduced }: { level: number; game: GameState; onDone(): void; reduced: boolean }) {
  const insets = useSafeAreaInsets();
  const fill = useSharedValue(0);
  const progress = game.xp.xpForNextLevel ? game.xp.xpIntoLevel / game.xp.xpForNextLevel : 0;
  useEffect(() => {
    feedback.sfx('level_up', 'ceremony');
    fill.value = reduced ? progress : withTiming(progress, { duration: 900 });
    const timer = setTimeout(onDone, 1500);
    return () => clearTimeout(timer);
  }, [level, onDone, reduced, progress, fill]);
  const bar = useAnimatedStyle(() => ({ width: Math.round(fill.value * 150) }));
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: Math.max(insets.top, 8) + 8, left: 24, right: 24, alignItems: 'center' }}>
      <PixelPanel tone="gold" padding={2} style={{ alignItems: 'center', gap: 6 }}>
        <PixelText size="lg" bold accessibilityLiveRegion="polite" accessibilityLabel={`Level ${level}`}>LV {level}</PixelText>
        <View style={{ width: 154, height: 8, padding: 2, backgroundColor: QUI.ink }}>
          <Animated.View style={[{ height: 4, backgroundColor: QUI.xp }, bar]} />
        </View>
      </PixelPanel>
    </View>
  );
}
