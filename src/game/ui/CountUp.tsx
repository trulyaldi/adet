// A number that counts up from `from` to `to` (XP, credits), ticking in
// steps. `onTick` fires on each step (for a light haptic).

import React, { useEffect, useRef, useState } from 'react';

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
  const [v, setV] = useState(reduced ? to : from);
  const tick = useRef(onTick);
  tick.current = onTick;
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    if (reduced || to <= from) {
      setV(to);
      done.current?.();
      return;
    }
    const steps = Math.min(12, to - from);
    let i = 0;
    const t = setInterval(() => {
      i++;
      setV(Math.round(from + ((to - from) * i) / steps));
      tick.current?.();
      if (i >= steps) {
        clearInterval(t);
        done.current?.();
      }
    }, duration / steps);
    return () => clearInterval(t);
  }, [from, to, duration, reduced]);
  return (
    <PixelText size={size} bold color={color} accessibilityLabel={accessibilityLabel ?? `${prefix}${to}`}>
      {prefix}
      {v}
    </PixelText>
  );
}
