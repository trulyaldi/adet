// World Mode's moments (world-4 placeholder; Session 6 polishes them): a boss
// whose phases have all fallen gets a "KO" banner, a conquered realm its
// name. A tap or 2.5 s moves on. No Skia, no sound beyond the cue.
import React, { useEffect, useEffectEvent } from 'react';
import { AccessibilityInfo, Modal, Pressable, StyleSheet, View } from 'react-native';

import { feedback } from '../../../game/feedback';
import { PixelPanel } from '../../../game/ui/PixelPanel';
import { PixelText } from '../../../game/ui/PixelText';

const SHOWN_MS = 2500;

export function WorldMoment({ banner, line, onDone, reduced }: { banner: string; line: string; onDone(): void; reduced: boolean }) {
  const done = useEffectEvent(() => onDone());
  useEffect(() => {
    feedback.sfx('level_up', 'ceremony');
    AccessibilityInfo.announceForAccessibility(`${banner}. ${line}`);
    const t = setTimeout(() => done(), SHOWN_MS);
    return () => clearTimeout(t);
  }, [banner, line]);
  return (
    <Modal visible transparent animationType={reduced ? 'none' : 'fade'} onRequestClose={onDone} statusBarTranslucent>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(10,8,20,0.45)', alignItems: 'center', justifyContent: 'center' }]} onPress={onDone} accessibilityRole="button" accessibilityLabel={`${banner}. ${line}. Continue`}>
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
      </Pressable>
    </Modal>
  );
}
