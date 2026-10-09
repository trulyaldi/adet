import React from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';

import { colSpan, GRID_COLUMNS, Span } from '../../theme/layout';
import { useLayout } from '../../theme/useLayout';

/**
 * A 12-column grid with the gutter token between columns and rows. Children
 * are `Col`s; a row wraps when its spans pass 12. On phone it adds nothing: a
 * plain View with only the `style` you pass (no gutters, no negative margins),
 * so a screen can share one markup and keep its own phone spacing.
 */
export function Grid({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { isDesktop, gutter } = useLayout();
  if (!isDesktop) return <View style={style}>{children}</View>;
  // Each Col pads gutter/2 a side; the negative margin hands that back at the edges.
  return <View style={[{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -gutter / 2, rowGap: gutter }, style]}>{children}</View>;
}

/** One cell of a `Grid`, `span` of 12 columns wide (a number, or one per desktop tier). On phone: a plain View. */
export function Col({ span = GRID_COLUMNS, children, style }: { span?: Span; children?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { isDesktop, tier, gutter } = useLayout();
  if (!isDesktop) return <View style={style}>{children}</View>;
  const n = colSpan(span, tier);
  return <View style={[{ width: `${(n / GRID_COLUMNS) * 100}%`, paddingHorizontal: gutter / 2 }, style]}>{children}</View>;
}
