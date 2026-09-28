import React from 'react';
import { Text, TextProps } from 'react-native';

import { fmtClock } from '../domain/time';
import { useActiveProgress } from '../store/useActiveProgress';

/**
 * The running session's count-up. The only part of a timer view that
 * re-renders every second; it reads the timer's timestamps, so it's right
 * the moment the app comes back from the background.
 */
export function SessionClock(props: TextProps) {
  const p = useActiveProgress(1000);
  return <Text {...props}>{fmtClock(p?.sessionSec ?? 0)}</Text>;
}
