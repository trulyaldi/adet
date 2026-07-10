import React from 'react';
import { View } from 'react-native';

import { colors, radius } from '../theme/tokens';

interface ProgressBarProps {
  /** 0..100 */
  pct: number;
  color?: string;
  track?: string;
  height?: number;
}

export function ProgressBar({
  pct,
  color = colors.ink,
  track = colors.track,
  height = 6,
}: ProgressBarProps) {
  const w = Math.max(0, Math.min(100, pct));
  return (
    <View
      style={{
        height,
        borderRadius: radius.pill,
        backgroundColor: track,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          height: '100%',
          borderRadius: radius.pill,
          backgroundColor: color,
          width: `${w}%`,
        }}
      />
    </View>
  );
}
