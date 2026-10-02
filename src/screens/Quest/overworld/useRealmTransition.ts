// Runs the Overworld ⇄ Realm transition (world-6). `t` is 0 on the map and 1
// in a realm; one linear timing moves it on the UI thread and the pieces map
// it themselves (transitionModel). `moving` keeps both screens mounted while
// it runs. The end always lands, finished or cut short, so a transition can't
// strand the screen halfway.

import { useCallback, useRef, useState } from 'react';
import { Easing, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { FADE_MS, ZOOM_MS } from './transitionModel';

export interface Moving {
  dir: 'in' | 'out';
  slot: number;
}

export function useRealmTransition(reduced: boolean) {
  const t = useSharedValue(0);
  const [moving, setMoving] = useState<Moving | null>(null);
  const after = useRef<(() => void) | null>(null);
  // A cut-short timing still calls back: only the latest run may land.
  const gen = useRef(0);
  const land = useCallback((id: number) => {
    if (id !== gen.current) return;
    const f = after.current;
    after.current = null;
    setMoving(null);
    f?.();
  }, []);
  const run = useCallback(
    (dir: Moving['dir'], slot: number, then?: () => void) => {
      // One at a time: a second request lands the first at once.
      if (after.current) land(gen.current);
      const id = ++gen.current;
      after.current = then ?? (() => {});
      setMoving({ dir, slot });
      t.set(withTiming(dir === 'in' ? 1 : 0, { duration: reduced ? FADE_MS : ZOOM_MS, easing: Easing.linear }, () => scheduleOnRN(land, id)));
    },
    [t, reduced, land]
  );
  return { t, moving, run };
}
