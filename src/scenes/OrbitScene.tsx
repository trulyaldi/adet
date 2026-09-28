import React, { useEffect } from 'react';
import Animated, { SharedValue, useAnimatedProps, useSharedValue, withSpring } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { SceneProps, useLoop, usePulse, useSceneProgress } from './common';

const ACircle = Animated.createAnimatedComponent(Circle);

/** Most orbs shown at once (two hours). */
const MAX_ORBS = 12;

/**
 * Small orbs circling the timer: one to start with and a new one joining
 * every 10 minutes of the session. They grow a little brighter toward the
 * target, and burst outward and back when it's reached.
 */
export function OrbitScene({ width, height, cx, cy, ringR, progress, sessionSec, swatch, payoff, moving, reduced }: SceneProps) {
  const n = Math.min(MAX_ORBS, 1 + Math.floor(sessionSec / 600));
  const clock = useLoop(90_000, moving);
  const burst = usePulse(payoff, reduced);
  const p = useSceneProgress(progress, reduced);
  const lanes = [ringR + 34, ringR + 62, ringR + 92];

  return (
    <Svg width={width} height={height} style={{ position: 'absolute' }}>
      {lanes.map((r, i) => (
        <Circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={swatch.base} strokeOpacity={0.14} strokeWidth={1.5} strokeDasharray="2 7" />
      ))}
      {Array.from({ length: n }, (_, i) => (
        <Orb key={i} i={i} cx={cx} cy={cy} r={lanes[i % 3]} clock={clock} burst={burst} p={p} color={i % 3 === 1 ? swatch.bonus : swatch.base} glow={swatch.light} />
      ))}
    </Svg>
  );
}

function Orb({
  i,
  cx,
  cy,
  r,
  clock,
  burst,
  p,
  color,
  glow,
}: {
  i: number;
  cx: number;
  cy: number;
  r: number;
  clock: SharedValue<number>;
  burst: SharedValue<number>;
  p: SharedValue<number>;
  color: string;
  glow: string;
}) {
  // Joins with a small pop.
  const born = useSharedValue(0);
  useEffect(() => {
    born.value = withSpring(1, { damping: 8, stiffness: 120 });
  }, [born]);
  const offset = (i * 137.5 * Math.PI) / 180;
  // Inner lanes go a little faster; alternate lanes counter-rotate slowly.
  const speed = (i % 3 === 0 ? 3 : i % 3 === 1 ? -2 : 1.5) * (1 + (i % 2) * 0.2);
  const size = 7 + (i % 4) * 2;
  const pos = () => {
    'worklet';
    const a = offset + clock.value * Math.PI * 2 * speed;
    const rr = r * (1 + burst.value * 0.35);
    return { x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr };
  };
  const orb = useAnimatedProps(() => {
    const { x, y } = pos();
    return { cx: x, cy: y, r: size * born.value * (1 + burst.value * 0.3), fillOpacity: 0.75 + Math.min(0.25, p.value * 0.25) };
  });
  const halo = useAnimatedProps(() => {
    const { x, y } = pos();
    return { cx: x, cy: y, r: size * 2.1 * born.value, fillOpacity: 0.22 + burst.value * 0.3 };
  });
  return (
    <>
      <ACircle fill={glow} animatedProps={halo} />
      <ACircle fill={color} animatedProps={orb} />
    </>
  );
}
