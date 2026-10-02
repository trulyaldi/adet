// World Mode's moments (world-4, polished in world-6). A boss whose phases
// have all fallen gets a KO banner: a pixel splash stamped down over the
// screen with its name under it. A conquered realm gets its name on a gold
// panel, and its flag rises on the Overworld afterwards. A tap or 2.5 s moves
// on. No Skia; with reduced motion nothing moves.
import React, { useEffect, useEffectEvent } from 'react';
import { AccessibilityInfo, Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { feedback } from '../../../game/feedback';
import { PixelPanel } from '../../../game/ui/PixelPanel';
import { PixelSplash } from '../../../game/ui/PixelSplash';
import { PixelText } from '../../../game/ui/PixelText';
import { PE } from '../../../game/ui/pointer';
import { QUI } from '../../../game/ui/theme';
import { quantize } from '../overworld/transitionModel';

const SHOWN_MS = 2500;
/** The KO stamp lands from this scale, in three steps. */
const STAMP_FROM = 1.8;

export function WorldMoment({ banner, line, ko, onDone, reduced }: { banner: string; line: string; ko?: boolean; onDone(): void; reduced: boolean }) {
  const done = useEffectEvent(() => onDone());
  const { width } = useWindowDimensions();
  const t = useSharedValue(reduced || !ko ? 1 : 0);
  useEffect(() => {
    feedback.sfx('level_up', 'ceremony');
    AccessibilityInfo.announceForAccessibility(`${banner}. ${line}`);
    if (ko && !reduced) t.set(withTiming(1, { duration: 180, easing: Easing.in(Easing.quad) }));
    const id = setTimeout(() => done(), SHOWN_MS);
    return () => clearTimeout(id);
  }, [banner, line, ko, reduced, t]);
  const stamp = useAnimatedStyle(() => {
    const q = quantize(t.value, 3);
    return { opacity: q === 0 ? 0 : 1, transform: [{ scale: STAMP_FROM - (STAMP_FROM - 1) * q }] };
  });
  const splashW = Math.min(width - 24, 340);
  return (
    <Modal visible transparent animationType={reduced ? 'none' : 'fade'} onRequestClose={onDone} statusBarTranslucent>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(10,8,20,0.55)', alignItems: 'center', justifyContent: 'center' }]} onPress={onDone} accessibilityRole="button" accessibilityLabel={`${banner}. ${line}. Continue`}>
        {ko ? (
          <View style={[PE.none, { alignItems: 'center', gap: 10 }]}>
            <Animated.View style={[{ alignItems: 'center', justifyContent: 'center' }, stamp]}>
              <PixelSplash width={splashW} rows={21} />
              <View style={{ position: 'absolute' }}>
                <PixelText size="hero" color={QUI.ink}>
                  {banner}
                </PixelText>
              </View>
            </Animated.View>
            <PixelPanel tone="parchment" padding={2}>
              <PixelText size="md" numberOfLines={2} style={{ textAlign: 'center', maxWidth: 240 }}>
                {line}
              </PixelText>
            </PixelPanel>
          </View>
        ) : (
          <PixelPanel tone="gold" padding={4}>
            <View style={{ alignItems: 'center', gap: 6, maxWidth: 260 }}>
              <PixelText size="lg" bold>
                {banner}
              </PixelText>
              <PixelText size="md" numberOfLines={2} style={{ textAlign: 'center' }}>
                {line}
              </PixelText>
            </View>
          </PixelPanel>
        )}
      </Pressable>
    </Modal>
  );
}
