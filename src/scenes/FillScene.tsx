import React, { useId } from 'react';
import Animated, { useAnimatedProps } from 'react-native-reanimated';
import Svg, { ClipPath, Defs, Path, Rect } from 'react-native-svg';

import { SceneProps, useLoop, usePulse, useSceneProgress } from './common';

const APath = Animated.createAnimatedComponent(Path);

/**
 * A rounded vessel filling with a gentle wave as today's time grows; full at
 * the target, where the wave splashes up once.
 */
export function FillScene({ width, height, progress, swatch, payoff, moving, reduced }: SceneProps) {
  const clipId = 'vessel' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const p = useSceneProgress(progress, reduced);
  const phase = useLoop(5200, moving);
  const splash = usePulse(payoff, reduced);
  const x0 = width * 0.1;
  const w = width * 0.8;
  const y0 = height * 0.14;
  const h = height * 0.72;
  const r = Math.min(56, w * 0.2);

  const wave = (shift: number, ampK: number) => {
    'worklet';
    const level = Math.max(0, Math.min(1, p.value));
    const top = y0 + h - level * h;
    const amp = (6 + splash.value * 22) * ampK;
    const steps = 16;
    let d = `M${x0} ${y0 + h}L${x0} ${top}`;
    for (let i = 0; i <= steps; i++) {
      const x = x0 + (w * i) / steps;
      const y = top + Math.sin((i / steps) * Math.PI * 2 + (phase.value + shift) * Math.PI * 2) * amp;
      d += `L${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    return d + `L${x0 + w} ${y0 + h}Z`;
  };
  const back = useAnimatedProps(() => ({ d: wave(0.35, 0.8) }));
  const front = useAnimatedProps(() => ({ d: wave(0, 1) }));

  return (
    <Svg width={width} height={height} style={{ position: 'absolute' }}>
      <Defs>
        <ClipPath id={clipId}>
          <Rect x={x0} y={y0} width={w} height={h} rx={r} />
        </ClipPath>
      </Defs>
      <Rect x={x0} y={y0} width={w} height={h} rx={r} fill={swatch.light} opacity={0.55} />
      <APath clipPath={`url(#${clipId})`} fill={swatch.bonus} opacity={0.55} animatedProps={back} />
      <APath clipPath={`url(#${clipId})`} fill={swatch.base} opacity={0.5} animatedProps={front} />
      <Rect x={x0} y={y0} width={w} height={h} rx={r} fill="none" stroke={swatch.base} strokeOpacity={0.45} strokeWidth={3} />
      {/* A glint on the glass */}
      <Path d={`M${x0 + 22} ${y0 + r}L${x0 + 22} ${y0 + h * 0.4}`} stroke="#FFFFFF" strokeOpacity={0.35} strokeWidth={6} strokeLinecap="round" />
    </Svg>
  );
}
