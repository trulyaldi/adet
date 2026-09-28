import React from 'react';

import { useUi } from '../../store/StreakStore';
import { Ilmek, IlmekProps } from './Ilmek';

/** Ilmek on a tab screen: holds still while the full-screen focus view covers it. */
export function ScreenIlmek({ animated = true, ...props }: IlmekProps) {
  const covered = useUi((u) => u.timerOpen);
  return <Ilmek {...props} animated={animated && !covered} />;
}
