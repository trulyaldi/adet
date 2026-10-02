// What every focus screen layout shares: the screen stays awake, a swipe
// down minimizes back to Today (the session keeps running), a dim button is
// offered after a while, and Done saves after a short beat with a guard
// against double taps.

import { useKeepAwake } from 'expo-keep-awake';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { SessionClock } from '../components/SessionClock';
import { createLatch } from '../game/state/latch';
import { useActions } from '../store/StreakStore';
import { useStopTimer } from '../store/useStopTimer';
import { springs } from '../theme/motion';

/** After this long in focus, a dim button appears. */
const DIM_OFFER_MS = 2 * 60_000;

export function useFocusShell() {
  useKeepAwake();
  const actions = useActions();
  const stop = useStopTimer();
  const [dimOffer, setDimOffer] = useState(false);
  const [dimmed, setDimmed] = useState(false);
  const [finishing] = useState(createLatch);
  useEffect(() => {
    const tm = setTimeout(() => setDimOffer(true), DIM_OFFER_MS);
    return () => clearTimeout(tm);
  }, []);

  const y = useSharedValue(0);
  // Built once, so re-renders don't rebuild the gesture.
  const closeRef = useRef(actions.closeTimer);
  closeRef.current = actions.closeTimer;
  const swipe = useMemo(() => {
    const close = () => closeRef.current();
    return Gesture.Pan()
      .activeOffsetY(14)
      .failOffsetX([-30, 30])
      .onUpdate((e) => {
        y.value = Math.max(0, e.translationY);
      })
      .onEnd((e) => {
        if (e.translationY > 140 || e.velocityY > 900) scheduleOnRN(close);
        y.value = withSpring(0, springs.reorder);
      });
  }, [y]);
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));

  /** Done: `before` plays its moment, then the session saves after `delayMs`. False if a save is already on its way. */
  const finish = (delayMs: number, before?: () => void): boolean => {
    if (!finishing.take()) return false;
    before?.();
    setTimeout(stop, delayMs);
    // A long-session question may be cancelled; allow another try.
    setTimeout(finishing.release, Math.max(1500, delayMs + 500));
    return true;
  };

  return { swipe, sheetStyle, dimOffer, dimmed, setDimmed, finish };
}

/** The dimmed screen: almost black, the count-up in grey; a tap undims. */
export function DimOverlay({ onUndim }: { onUndim(): void }) {
  return (
    <Animated.View entering={FadeIn.duration(400)} exiting={FadeOut.duration(200)} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <Pressable
        onPress={onUndim}
        accessibilityRole="button"
        accessibilityLabel="Undim the screen"
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.82)', alignItems: 'center', justifyContent: 'center' }}
      >
        <SessionClock style={{ fontSize: 44, fontWeight: '800', color: '#7C818B', fontVariant: ['tabular-nums'] }} />
      </Pressable>
    </Animated.View>
  );
}
