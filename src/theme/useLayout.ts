import { useMemo } from 'react';
import { Platform, useWindowDimensions } from 'react-native';

import { Layout, layoutFor } from './layout';

/** The current layout tier and tokens; changes only when the window size does. */
export function useLayout(): Layout {
  const { width, height } = useWindowDimensions();
  return useMemo(() => layoutFor(width, Platform.OS, height), [width, height]);
}
