import React from 'react';
import Animated, { SharedValue, useAnimatedProps, useDerivedValue } from 'react-native-reanimated';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';

import { SceneProps, useLoop, usePulse, useSceneProgress } from './common';

const APath = Animated.createAnimatedComponent(Path);
const AG = Animated.createAnimatedComponent(G);

/** Leaves along the stem: where they sprout (fraction of growth) and which side. */
const LEAVES = [
  { at: 0.16, side: -1 },
  { at: 0.34, side: 1 },
  { at: 0.52, side: -1 },
  { at: 0.7, side: 1 },
  { at: 0.86, side: -1 },
];

/**
 * A sprout that grows toward the target: the stem rises with today's time,
 * leaves unfold along the way, and at the target it blooms. It sways gently.
 */
export function PlantScene({ width, height, cx, progress, swatch, payoff, moving, reduced }: SceneProps) {
  const p = useSceneProgress(progress, reduced);
  const sway = useLoop(7000, moving);
  const pop = usePulse(payoff, reduced);
  const baseY = height - 70;
  const maxL = Math.min(height * 0.62, baseY - 110);
  // The stem: a gentle S-curve from the soil up.
  const top = baseY - maxL;
  const stem = `M${cx} ${baseY}C${cx - 26} ${baseY - maxL * 0.35} ${cx + 26} ${baseY - maxL * 0.65} ${cx} ${top}`;
  const stemLen = maxL * 1.08;
  const grow = useDerivedValue(() => Math.max(0.04, Math.min(1, p.value)));

  const stemProps = useAnimatedProps(() => ({ strokeDashoffset: stemLen * (1 - grow.value) }));
  const swayProps = useAnimatedProps(() => ({
    transform: `rotate(${Math.sin(sway.value * Math.PI * 2) * 1.6} ${cx} ${baseY})`,
  }));
  const bloomProps = useAnimatedProps(() => {
    const open = Math.max(0, Math.min(1, (p.value - 0.97) / 0.03));
    const s = open * (1 + pop.value * 0.25);
    return { transform: `translate(${cx} ${top}) scale(${s})`, opacity: open };
  });

  return (
    <Svg width={width} height={height} style={{ position: 'absolute' }}>
      <Ellipse cx={cx} cy={baseY + 18} rx={width * 0.36} ry={34} fill={swatch.base} opacity={0.18} />
      <Ellipse cx={cx} cy={baseY + 10} rx={70} ry={16} fill={swatch.dark} opacity={0.35} />
      <AG animatedProps={swayProps}>
        <APath d={stem} stroke={swatch.dark} strokeWidth={7} strokeLinecap="round" fill="none" strokeDasharray={`${stemLen} ${stemLen}`} animatedProps={stemProps} />
        {LEAVES.map((l, i) => (
          <Leaf key={i} p={grow} at={l.at} side={l.side} cx={cx} baseY={baseY} maxL={maxL} color={i % 2 ? swatch.base : swatch.dark} />
        ))}
        <AG animatedProps={bloomProps}>
          {[0, 72, 144, 216, 288].map((a) => (
            <Ellipse key={a} cx={0} cy={-18} rx={11} ry={18} fill={swatch.bonus} transform={`rotate(${a})`} />
          ))}
          <Circle cx={0} cy={0} r={11} fill={swatch.base} />
          <Circle cx={-3} cy={-3} r={4} fill="#FFFFFF" opacity={0.6} />
        </AG>
      </AG>
    </Svg>
  );
}

function Leaf({ p, at, side, cx, baseY, maxL, color }: { p: SharedValue<number>; at: number; side: number; cx: number; baseY: number; maxL: number; color: string }) {
  const y = baseY - maxL * at;
  // Follow the stem's S-curve roughly so leaves sit on it.
  const x = cx + Math.sin(at * Math.PI * 2) * -9;
  const props = useAnimatedProps(() => {
    const s = Math.max(0, Math.min(1, (p.value - at) / 0.1));
    return { transform: `translate(${x} ${y}) scale(${side * s} ${s})`, opacity: s > 0 ? 1 : 0 };
  });
  return (
    <AG animatedProps={props}>
      <Path d="M0 0C10 -18 30 -20 44 -12C34 2 14 6 0 0Z" fill={color} />
      <Path d="M2 -1C14 -9 26 -12 38 -12" stroke="#FFFFFF" strokeOpacity={0.35} strokeWidth={2} fill="none" strokeLinecap="round" />
    </AG>
  );
}
