import React, { memo, useEffect, useState } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, { useAnimatedProps, useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Rect } from 'react-native-svg';

import { ilmekTones } from '../../theme/mascot';
import type { ProjectColor } from '../../theme/palette';
import { useTheme } from '../../theme/ThemeProvider';
import { useAppActive, useReducedMotion } from '../../theme/useMotion';
import {
  Arm,
  ARMS,
  Body,
  Book,
  BOOK_CENTER,
  BUBBLE_CENTER,
  Brows,
  Cheeks,
  Confetti,
  Eyes,
  Feet,
  hasBrows,
  IlmekState,
  Mouth,
  Page,
  Shadow,
  shoulder,
  SleepBubble,
  SmallEyes,
  Sunglasses,
  Tuft,
  WaveArcs,
} from './art';
import { useIlmekMotion } from './motion';

export type { IlmekState };

/** Below this size Ilmek is drawn as the small version: body, curl and eyes. */
export const ILMEK_SMALL_BELOW = 40;

export interface IlmekProps {
  state?: IlmekState;
  size?: number;
  /** A project's color: swaps the four body tones. Brand blue without one. */
  tint?: ProjectColor;
  /** False draws the static pose. Motion also stops with Reduce Motion and in the background. */
  animated?: boolean;
  /** Hidden from screen readers, for when the surrounding view already says what it means. */
  decorative?: boolean;
  style?: StyleProp<ViewStyle>;
}

const ARect = Animated.createAnimatedComponent(Rect);

// Layers draw on a canvas padded past the 200×200 art so swinging arms and
// bursting confetti aren't clipped; the view itself stays size × size.
const PAD = 24;
const SPAN = 200 + PAD * 2;
const VIEWBOX = `${-PAD} ${-PAD} ${SPAN} ${SPAN}`;

/** A canvas point as a padded layer's transform origin, in px (RN's origin string parser rejects long decimals). */
const origin = ([x, y]: [number, number], k: number) => [(x + PAD) * k, (y + PAD) * k, 0];

/**
 * Ilmek, Adet's mascot (assets/mascot/ILMEK_SPEC.md). Each moving part is its
 * own full-canvas layer inside the rig view, so its motion is a native view
 * transform around the reference sheet's pivots (animated SVG group transforms
 * don't reach native). Layer order follows the sheet.
 */
export const Ilmek = memo(function Ilmek({ state = 'idle', size = 120, tint, animated = true, decorative = false, style }: IlmekProps) {
  const t = useTheme();
  const reduced = useReducedMotion();
  const active = useAppActive();
  const run = animated && !reduced && active;
  const small = size < ILMEK_SMALL_BELOW;

  // Celebrating plays its hops, then settles into cheering.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    setSettled(false);
    if (!run || state !== 'celebrating') return;
    const tm = setTimeout(() => setSettled(true), 1250);
    return () => clearTimeout(tm);
  }, [state, run]);
  const pose: IlmekState = state === 'celebrating' && settled && run ? 'cheering' : state;

  const m = useIlmekMotion(pose, run);
  const k = size / 200;
  const tones = ilmekTones(tint);
  const [armL, armR] = ARMS[pose];

  const rigStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: m.lift.value * k }, { rotate: `${m.rot.value}deg` }, { scaleX: m.sx.value }, { scaleY: m.sy.value }],
  }));
  const shadowStyle = useAnimatedStyle(() => ({ transform: [{ scale: m.shadow.value }] }));
  const tuftStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${m.tuft.value}deg` }] }));
  const eyesStyle = useAnimatedStyle(() => ({ transform: [{ translateX: m.gaze.value * k }, { scaleY: m.blink.value }] }));
  const browStyle = useAnimatedStyle(() => ({ transform: [{ translateY: m.brow.value * k }] }));
  const armLStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${m.armL.value}deg` }] }));
  const armRStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${m.armR.value}deg` }] }));
  const bookStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${m.fx.value}deg` }] }));
  const pageStyle = useAnimatedStyle(() => ({ opacity: m.fx2.value > 0 && m.fx2.value < 1 ? 1 : 0, transform: [{ scaleX: 1 - 2 * m.fx2.value }] }));
  const bubbleStyle = useAnimatedStyle(() => ({ opacity: m.fx2.value, transform: [{ scale: m.fx.value }] }));
  // Confetti bursts outward and fades in 60ms steps (5 steps over its 300ms burst).
  const confettiStyle = useAnimatedStyle(() => ({ opacity: 1 - Math.floor(m.fx.value * 5) / 5, transform: [{ scale: 1 + 0.2 * m.fx.value }] }));
  const arcsStyle = useAnimatedStyle(() => ({ opacity: m.fx.value }));
  const glintProps = useAnimatedProps(() => ({ x: -30 + m.fx.value * 190 }));

  const box = { position: 'absolute' as const, left: -PAD * k, top: -PAD * k, width: SPAN * k, height: SPAN * k };
  const layer = (key: string, children: React.ReactNode, animatedStyle?: object, pivot?: [number, number]) => (
    <Animated.View key={key} pointerEvents="none" style={[pivot ? [box, { transformOrigin: origin(pivot, k) }] : box, animatedStyle]}>
      <Svg width={SPAN * k} height={SPAN * k} viewBox={VIEWBOX}>
        {children}
      </Svg>
    </Animated.View>
  );

  const a11y = decorative
    ? { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' as const }
    : { accessible: true, accessibilityRole: 'image' as const, accessibilityLabel: `Ilmek, ${state}` };

  const arms = small
    ? []
    : [
        layer('arm-left', <Arm id="arm-left" d={armL} tones={tones} />, armLStyle, shoulder(armL)),
        layer('arm-right', <Arm id="arm-right" d={armR} tones={tones} />, armRStyle, shoulder(armR)),
      ];
  const behind = pose === 'relaxed';

  return (
    <View {...a11y} style={[{ width: size, height: size }, style]}>
      {layer('shadow', <Shadow color={t.colors.shadow} opacity={t.dark ? 0.35 : 0.12} />, shadowStyle, [100, 186])}
      {/* The rig is the unpadded size × size box; its layers sit on it like the outer ones. */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { transformOrigin: [100 * k, 180 * k, 0] }, rigStyle]}>
        {behind && arms}
        {layer('tuft', <Tuft tones={tones} small={small} />, tuftStyle, [100, 52])}
        {layer(
          'base',
          <>
            <Feet tones={tones} />
            <Body tones={tones} small={small} />
            {!small && <Cheeks />}
            {!small && <Mouth state={pose} />}
          </>,
        )}
        {layer('eyes', small ? <SmallEyes /> : <Eyes state={pose} tones={tones} />, eyesStyle, [100, 96])}
        {!small && hasBrows(pose) && layer('brows', <Brows state={pose} />, browStyle)}
        {!small && pose === 'relaxed' && layer('sunglasses', <Sunglasses glint={<ARect y={70} width={12} height={50} fill="#FFFFFF" opacity={0.55} transform="rotate(20 100 96)" animatedProps={glintProps} />} />)}
        {!behind && arms}
        {!small && pose === 'focused' && layer('book', <Book />, bookStyle, BOOK_CENTER)}
        {!small && pose === 'focused' && layer('page', <Page />, pageStyle, [100, 167])}
      </Animated.View>
      {!small && pose === 'celebrating' && layer('confetti', <Confetti />, confettiStyle, [100, 100])}
      {!small && pose === 'sleepy' && layer('sleep-bubble', <SleepBubble />, bubbleStyle, BUBBLE_CENTER)}
      {!small && pose === 'waving' && layer('arcs', <WaveArcs />, arcsStyle)}
    </View>
  );
});
