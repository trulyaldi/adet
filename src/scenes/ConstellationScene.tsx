import React, { useMemo } from 'react';
import Animated, { SharedValue, useAnimatedProps } from 'react-native-reanimated';
import Svg, { Circle, Line } from 'react-native-svg';

import { SceneProps, useLoop, usePulse, useSceneProgress } from './common';

const ACircle = Animated.createAnimatedComponent(Circle);
const ALine = Animated.createAnimatedComponent(Line);

const STARS = 12;

/** Points of a heart around the timer (the constellation's shape). */
function heart(cx: number, cy: number, s: number) {
  return Array.from({ length: STARS }, (_, i) => {
    const t = (i / STARS) * Math.PI * 2;
    const x = 16 * Math.sin(t) ** 3;
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    return { x: cx + x * s, y: cy - y * s - s * 2 };
  });
}

/** Quiet background stars at fixed, deterministic spots. */
function dust(w: number, h: number) {
  return Array.from({ length: 40 }, (_, i) => {
    const a = Math.sin(i * 91.7) * 43758.5;
    const b = Math.sin(i * 47.3 + 5) * 24634.6;
    return { x: (a - Math.floor(a)) * w, y: (b - Math.floor(b)) * h, r: 0.8 + (i % 3) * 0.5 };
  });
}

/**
 * Stars appear one by one as time passes and join into a heart around the
 * timer; at the target the last line closes it and it glows. They twinkle.
 */
export function ConstellationScene({ width, height, cx, cy, ringR, progress, swatch, payoff, moving, reduced, dark }: SceneProps) {
  const p = useSceneProgress(progress, reduced);
  const tw = useLoop(4000, moving);
  const glow = usePulse(payoff, reduced);
  const pts = useMemo(() => heart(cx, cy, (ringR + 70) / 16), [cx, cy, ringR]);
  const bg = useMemo(() => dust(width, height), [width, height]);
  const star = dark ? '#FFFFFF' : swatch.dark;

  return (
    <Svg width={width} height={height} style={{ position: 'absolute' }}>
      {bg.map((s, i) => (
        <Circle key={i} cx={s.x} cy={s.y} r={s.r} fill={star} opacity={0.18} />
      ))}
      {pts.map((a, i) => {
        const b = pts[(i + 1) % STARS];
        return <Link key={'l' + i} i={i} a={a} b={b} p={p} glow={glow} color={swatch.base} />;
      })}
      {pts.map((a, i) => (
        <Star key={'s' + i} i={i} x={a.x} y={a.y} p={p} tw={tw} glow={glow} color={star} halo={swatch.bonus} />
      ))}
    </Svg>
  );
}

/** Star i shows once progress passes i/STARS. */
function shownAt(i: number) {
  'worklet';
  return i / STARS;
}

function Star({ i, x, y, p, tw, glow, color, halo }: { i: number; x: number; y: number; p: SharedValue<number>; tw: SharedValue<number>; glow: SharedValue<number>; color: string; halo: string }) {
  const core = useAnimatedProps(() => {
    const on = Math.max(0, Math.min(1, (p.value - shownAt(i)) * STARS));
    const twinkle = 0.75 + 0.25 * Math.sin((tw.value + i * 0.37) * Math.PI * 2);
    return { r: (2.5 + glow.value * 2) * on + 0.001, opacity: on * twinkle };
  });
  const ring = useAnimatedProps(() => {
    const on = Math.max(0, Math.min(1, (p.value - shownAt(i)) * STARS));
    return { r: (7 + glow.value * 6) * on + 0.001, opacity: on * (0.25 + glow.value * 0.5) };
  });
  return (
    <>
      <ACircle cx={x} cy={y} fill={halo} animatedProps={ring} />
      <ACircle cx={x} cy={y} fill={color} animatedProps={core} />
    </>
  );
}

function Link({ i, a, b, p, glow, color }: { i: number; a: { x: number; y: number }; b: { x: number; y: number }; p: SharedValue<number>; glow: SharedValue<number>; color: string }) {
  // The line from star i to the next draws in while the next star arrives; the last one closes the heart at the target.
  const props = useAnimatedProps(() => {
    const next = i === STARS - 1 ? 1 : shownAt(i + 1);
    const f = Math.max(0, Math.min(1, (p.value - shownAt(i)) / (next - shownAt(i))));
    return {
      x2: a.x + (b.x - a.x) * f,
      y2: a.y + (b.y - a.y) * f,
      strokeOpacity: f > 0 ? 0.55 + glow.value * 0.45 : 0,
      strokeWidth: 2 + glow.value * 2.5,
    };
  });
  return <ALine x1={a.x} y1={a.y} stroke={color} strokeLinecap="round" animatedProps={props} />;
}
