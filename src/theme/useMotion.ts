import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useReducedMotion as useSystemReducedMotion } from 'react-native-reanimated';

import { devicePrefsRef, useDevicePrefs } from '../store/devicePrefs';

/**
 * True when motion should be reduced: the system setting, unless Settings
 * forces it on or off. Reduced motion swaps movement for plain fades and
 * turns off confetti and large scene movement.
 */
export function useReducedMotion(): boolean {
  const system = useSystemReducedMotion();
  const { prefs } = useDevicePrefs();
  return prefs.motion === 'system' ? system : prefs.motion === 'reduce';
}

/** The same outside React, for one-off decisions in services (best effort: system value unknown there). */
export function motionReducedPref(): boolean {
  return devicePrefsRef.current.motion === 'reduce';
}

/** False while the app is in the background, so decorative loops can pause. */
export function useAppActive(): boolean {
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setActive(s === 'active'));
    return () => sub.remove();
  }, []);
  return active;
}
