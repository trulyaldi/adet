import React from 'react';
import { View } from 'react-native';
import Animated, { SharedValue, useAnimatedProps, useAnimatedStyle, useDerivedValue } from 'react-native-reanimated';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';

import { SceneProps, useLoop, usePulse, useSceneProgress } from './common';

const APath = Animated.createAnimatedComponent(Path);
const AEllipse = Animated.createAnimatedComponent(Ellipse);
const ACircle = Animated.createAnimatedComponent(Circle);

/** Leaves along the stem: where they sprout (fraction of growth) and which side. */
const LEAVES = [
  { at: 0.16, side: -1 },
  { at: 0.34, side: 1 },
  { at: 0.52, side: -1 },
  { at: 0.7, side: 1 },
  { at: 0.86, side: -1 },
];

/** The leaf outline, as points of its curve (origin at the stem). */
const LEAF = [0, 0, 10, -18, 30, -20, 44, -12, 34, 2, 14, 6, 0, 0];
const VEIN = [2, -1, 14, -9, 26, -12, 38, -12];

/**
 * A sprout that grows toward the target: the stem rises with today's time,
 * leaves unfold along the way, and at the target it blooms. It sways gently.
 *
 * Animated shapes change their own coordinates (paths, radii); SVG group
 * transforms can't be animated natively, so the sway turns the whole view.
 */
export function PlantScene({ width, height, cx, progress, swatch, payoff, moving, reduced }: SceneProps) {
  const p = useSceneProgress(progress, reduced);
  const sway = useLoop(7000, moving);
  const pop = usePulse(payoff, reduced);
  const baseY = height - 70;
  const maxL = Math.min(height * 0.62, baseY - 110);
  const top = baseY - maxL;
  const stem = `M${cx} ${baseY}C${cx - 26} ${baseY - maxL * 0.35} ${cx + 26} ${baseY - maxL * 0.65} ${cx} ${top}`;
  const stemLen = maxL * 1.08;
  const grow = useDerivedValue(() => Math.max(0.04, Math.min(1, p.value)));

  const stemProps = useAnimatedProps(() => ({ strokeDashoffset: stemLen * (1 - grow.value) }));
  const swayStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${Math.sin(sway.value * Math.PI * 2) * 1.6}deg` }] }));
  const open = useDerivedValue(() => Math.max(0, Math.min(1, (p.value - 0.97) / 0.03)) * (1 + pop.value * 0.25));

  return (
    <View style={{ position: 'absolute', width, height, pointerEvents: 'none' }}>
      <Svg width={width} height={height} style={{ position: 'absolute' }}>
        <Ellipse cx={cx} cy={baseY + 18} rx={width * 0.36} ry={34} fill={swatch.base} opacity={0.18} />
        <Ellipse cx={cx} cy={baseY + 10} rx={70} ry={16} fill={swatch.dark} opacity={0.35} />
      </Svg>
      {/* The plant, swaying about its base. */}
      <Animated.View style={[{ position: 'absolute', width, height, transformOrigin: `${cx}px ${baseY}px` }, swayStyle]}>
        <Svg width={width} height={height}>
          <APath d={stem} stroke={swatch.dark} strokeWidth={7} strokeLinecap="round" fill="none" strokeDasharray={`${stemLen} ${stemLen}`} animatedProps={stemProps} />
          {LEAVES.map((l, i) => (
            <Leaf key={i} p={grow} at={l.at} side={l.side} cx={cx} baseY={baseY} maxL={maxL} color={i % 2 ? swatch.base : swatch.dark} />
          ))}
          <G transform={`translate(${cx} ${top})`}>
            {[0, 72, 144, 216, 288].map((a) => (
              <Petal key={a} angle={a} open={open} color={swatch.bonus} />
            ))}
            <Core open={open} color={swatch.base} />
          </G>
        </Svg>
      </Animated.View>
    </View>
  );
}

function Petal({ angle, open, color }: { angle: number; open: SharedValue<number>; color: string }) {
  const props = useAnimatedProps(() => ({ rx: 11 * open.value + 0.001, ry: 18 * open.value + 0.001, cy: -18 * open.value, opacity: open.value > 0 ? 1 : 0 }));
  return <AEllipse cx={0} fill={color} transform={`rotate(${angle})`} animatedProps={props} />;
}

function Core({ open, color }: { open: SharedValue<number>; color: string }) {
  const core = useAnimatedProps(() => ({ r: 11 * open.value + 0.001, opacity: open.value > 0 ? 1 : 0 }));
  const shine = useAnimatedProps(() => ({ r: 4 * open.value + 0.001, cx: -3 * open.value, cy: -3 * open.value, opacity: open.value > 0 ? 0.6 : 0 }));
  return (
    <>
      <ACircle cx={0} cy={0} fill={color} animatedProps={core} />
      <ACircle fill="#FFFFFF" animatedProps={shine} />
    </>
  );
}

function Leaf({ p, at, side, cx, baseY, maxL, color }: { p: SharedValue<number>; at: number; side: number; cx: number; baseY: number; maxL: number; color: string }) {
  const y = baseY - maxL * at;
  // Follow the stem's S-curve roughly so leaves sit on it.
  const x = cx + Math.sin(at * Math.PI * 2) * -9;
  const shape = (pts: number[], closed: boolean) => {
    'worklet';
    const s = Math.max(0, Math.min(1, (p.value - at) / 0.1));
    const X = (i: number) => (x + pts[i] * s * side).toFixed(1);
    const Y = (i: number) => (y + pts[i + 1] * s).toFixed(1);
    if (pts.length === 14) {
      return `M${X(0)} ${Y(0)}C${X(2)} ${Y(2)} ${X(4)} ${Y(4)} ${X(6)} ${Y(6)}C${X(8)} ${Y(8)} ${X(10)} ${Y(10)} ${X(12)} ${Y(12)}${closed ? 'Z' : ''}`;
    }
    return `M${X(0)} ${Y(0)}C${X(2)} ${Y(2)} ${X(4)} ${Y(4)} ${X(6)} ${Y(6)}`;
  };
  const leaf = useAnimatedProps(() => ({ d: shape(LEAF, true), opacity: p.value > at ? 1 : 0 }));
  const vein = useAnimatedProps(() => ({ d: shape(VEIN, false), strokeOpacity: p.value > at ? 0.35 : 0 }));
  return (
    <>
      <APath fill={color} animatedProps={leaf} />
      <APath stroke="#FFFFFF" strokeWidth={2} fill="none" strokeLinecap="round" animatedProps={vein} />
    </>
  );
}
