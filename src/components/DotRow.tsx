import React from 'react';
import { View } from 'react-native';

import { colors } from '../theme/tokens';

interface DotRowProps {
  /** Dots in the row (e.g. the weekly target). */
  total: number;
  /** Filled dots (e.g. done this week); extra beyond `total` is ignored. */
  filled: number;
  size?: number;
  color?: string;
  /** Spoken as e.g. "2 of 4 this week"; omit inside a labelled control. */
  label?: string;
}

/**
 * Weekly progress as dots: filled = done, outlined = still to do. Done and
 * remaining differ by fill, not only by color.
 */
export function DotRow({ total, filled, size = 8, color = colors.ink, label }: DotRowProps) {
  const n = Math.max(0, Math.round(total));
  const f = Math.min(n, Math.max(0, Math.round(filled)));
  return (
    <View
      accessible={!!label}
      accessibilityLabel={label}
      style={{ flexDirection: 'row', alignItems: 'center', gap: Math.max(3, size * 0.5) }}
    >
      {Array.from({ length: n }, (_, i) => (
        <View
          key={i}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: i < f ? color : 'transparent',
            borderWidth: Math.max(1.2, size * 0.18),
            borderColor: i < f ? color : colors.faint,
          }}
        />
      ))}
    </View>
  );
}
