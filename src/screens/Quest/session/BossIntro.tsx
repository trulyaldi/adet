// The boss intro card (World Mode, world-6): the first session on a boss in
// an app session opens on its name over a pixel splash. 1.5 s, or a tap.
// With reduced motion it simply appears and goes; nothing loops.

import React, { useEffect, useEffectEvent } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { PixelSplash } from '../../../game/ui/PixelSplash';
import { PixelText } from '../../../game/ui/PixelText';
import { PE } from '../../../game/ui/pointer';
import { QUI } from '../../../game/ui/theme';
import { quantize } from '../overworld/transitionModel';

export const BOSS_INTRO_MS = 1500;

export function BossIntro({ name, width, reduced, onDone }: { name: string; width: number; reduced: boolean; onDone(): void }) {
  const done = useEffectEvent(() => onDone());
  // In from the side in four pixel steps.
  const t = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(`Boss: ${name}`);
    if (!reduced) t.set(withTiming(1, { duration: 220, easing: Easing.out(Easing.quad) }));
    const id = setTimeout(() => done(), BOSS_INTRO_MS);
    return () => clearTimeout(id);
  }, [name, reduced, t]);
  const slide = useAnimatedStyle(() => ({ transform: [{ translateX: Math.round((1 - quantize(t.value, 4)) * -width) }] }));
  const splashW = Math.min(width - 24, 340);
  return (
    <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(10,8,20,0.82)', alignItems: 'center', justifyContent: 'center', zIndex: 20 }]} onPress={onDone} accessibilityRole="button" accessibilityLabel={`Boss: ${name}. Continue`}>
      <Animated.View style={[PE.none, { alignItems: 'center' }, slide]}>
        <PixelSplash width={splashW} />
        <View style={{ position: 'absolute', top: 0, bottom: 0, left: 16, right: 16, alignItems: 'center', justifyContent: 'center', gap: 2 }}>
          <PixelText size="sm" color={QUI.goldLight} style={{ backgroundColor: QUI.ink, paddingHorizontal: 6 }}>
            BOSS
          </PixelText>
          <PixelText size="xl" numberOfLines={2} style={{ textAlign: 'center', color: QUI.ink, maxWidth: splashW * 0.62 }}>
            {name}
          </PixelText>
        </View>
      </Animated.View>
    </Pressable>
  );
}
