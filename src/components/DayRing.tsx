import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { colors } from '../theme/tokens';

interface DayRingProps {
  /** Planned habits (segments). */
  total: number;
  /** Planned habits done (filled segments). */
  done: number;
  size?: number;
  accent: string;
}

const STROKE = 10;
/** Gap between segments, in degrees. */
const GAP_DEG = 14;

function arc(c: number, r: number, fromDeg: number, toDeg: number): string {
  const p = (deg: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return `${c + r * Math.cos(rad)} ${c + r * Math.sin(rad)}`;
  };
  const large = toDeg - fromDeg > 180 ? 1 : 0;
  return `M${p(fromDeg)}A${r} ${r} 0 ${large} 1 ${p(toDeg)}`;
}

/** Today's progress: one ring segment per planned habit, filled as each is done. */
export function DayRing({ total, done, size = 150, accent }: DayRingProps) {
  const c = size / 2;
  const r = c - STROKE / 2 - 1;
  const n = Math.max(1, total);
  const seg = 360 / n;
  return (
    <View
      accessible
      accessibilityLabel={`${done} of ${total} done today`}
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        {n === 1 ? (
          <Circle cx={c} cy={c} r={r} fill="none" stroke={done >= 1 ? accent : colors.track2} strokeWidth={STROKE} />
        ) : (
          Array.from({ length: n }, (_, i) => (
            <Path
              key={i}
              d={arc(c, r, i * seg + GAP_DEG / 2, (i + 1) * seg - GAP_DEG / 2)}
              fill="none"
              stroke={i < done ? accent : colors.track2}
              strokeWidth={STROKE}
              strokeLinecap="round"
            />
          ))
        )}
      </Svg>
      <Text style={{ fontSize: size * 0.2, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'] }}>
        {done}/{total}
      </Text>
    </View>
  );
}
