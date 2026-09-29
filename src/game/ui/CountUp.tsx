// A number that counts up from `from` to `to` (XP, credits), ticking in
// steps. `onTick` fires on each step (for a light haptic).

import React, { useEffect, useEffectEvent, useState } from 'react';

import { PixelSize, PixelText } from './PixelText';

export function CountUp({
  from,
  to,
  duration = 900,
  size = 'lg',
  color,
  prefix = '',
  reduced,
  onTick,
  onDone,
  accessibilityLabel,
}: {
  from: number;
  to: number;
  duration?: number;
  size?: PixelSize;
  color?: string;
  prefix?: string;
  reduced?: boolean;
  onTick?(): void;
  onDone?(): void;
  accessibilityLabel?: string;
}) {
  const [v, setV] = useState(from);
  const tick = useEffectEvent(() => onTick?.());
  const finish = useEffectEvent(() => onDone?.());
  // Reduced motion (or nothing to count): the final number, at once.
  const instant = !!reduced || to <= from;
  useEffect(() => {
    if (instant) {
      finish();
      return;
    }
    const steps = Math.min(12, to - from);
    let i = 0;
    const t = setInterval(() => {
      i++;
      setV(Math.round(from + ((to - from) * i) / steps));
      tick();
      if (i >= steps) {
        clearInterval(t);
        finish();
      }
    }, duration / steps);
    return () => clearInterval(t);
  }, [from, to, duration, instant]);
  return (
    <PixelText size={size} bold color={color} accessibilityLabel={accessibilityLabel ?? `${prefix}${to}`}>
      {prefix}
      {instant ? to : v}
    </PixelText>
  );
}
