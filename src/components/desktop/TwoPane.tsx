import React from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';

import { RAIL_MIN } from '../../theme/layout';
import { useLayout } from '../../theme/useLayout';

/**
 * A main pane (the children) and an optional right rail. The rail sits beside
 * the main pane from RAIL_MIN wide (railW px, a gutter between); narrower, it
 * stacks under it. On phone there is no frame: the children render alone and
 * the rail is dropped, so a screen decides what the rail's content does there.
 *
 * It is a frame only: it fills its parent and pads it by the gutter (unless
 * `flush`), but it never scrolls. Each pane brings its own ScrollView.
 */
export function TwoPane({
  rail,
  children,
  flush,
  style,
}: {
  rail?: React.ReactNode;
  children: React.ReactNode;
  /** No gutter padding around the frame. */
  flush?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { isDesktop, width, gutter, railW } = useLayout();
  if (!isDesktop) return <>{children}</>;
  const beside = rail != null && width >= RAIL_MIN;
  return (
    <View style={[{ flex: 1, padding: flush ? 0 : gutter, gap: gutter, flexDirection: beside ? 'row' : 'column' }, style]}>
      <View style={{ flex: 1, minWidth: 0, minHeight: 0 }}>{children}</View>
      {rail != null && <View style={beside ? { width: railW, flexShrink: 0, minHeight: 0 } : { minHeight: 0 }}>{rail}</View>}
    </View>
  );
}
