// Pointer-event styles. They must come from StyleSheet.create: on web,
// react-native-web ignores `pointerEvents` in inline style objects.

import { StyleSheet } from 'react-native';

export const PE = StyleSheet.create({
  /** Taps pass through this view to what's under it (its children still get them). */
  boxNone: { pointerEvents: 'box-none' },
  /** Taps pass through entirely. */
  none: { pointerEvents: 'none' },
});
