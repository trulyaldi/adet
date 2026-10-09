import React from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';

import { colSpan, GRID_COLUMNS, Span } from '../../theme/layout';
import { useLayout } from '../../theme/useLayout';

/**
 * A 12-column grid with the gutter token between columns and rows. Children
 * are `Col`s; a row wraps when its spans pass 12. On phone every `Col` is the
 * full row, so a screen can use the same markup on every tier.
 */
export function Grid({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { gutter } = useLayout();
  // Each Col pads gutter/2 a side; the negative margin hands that back at the edges.
  return <View style={[{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -gutter / 2, rowGap: gutter }, style]}>{children}</View>;
}

/** One cell of a `Grid`, `span` of 12 columns wide (a number, or one per desktop tier). */
export function Col({ span = GRID_COLUMNS, children, style }: { span?: Span; children?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { tier, gutter } = useLayout();
  const n = colSpan(span, tier);
  return <View style={[{ width: `${(n / GRID_COLUMNS) * 100}%`, paddingHorizontal: gutter / 2 }, style]}>{children}</View>;
}
