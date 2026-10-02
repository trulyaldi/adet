import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { isTimerSkin, TimerSkin } from '../domain/game/timerSkin';

// Device look-and-feel preferences, available before sign-in (the theme and
// sounds work on the sign-in screen too). Never synced.
const KEY = 'adet-device-prefs-v1';

export type Appearance = 'system' | 'light' | 'dark';
/** Reduce motion: follow the system setting, or force it on/off. */
export type MotionPref = 'system' | 'reduce' | 'full';

export interface DevicePrefs {
  sound: boolean;
  haptics: boolean;
  appearance: Appearance;
  motion: MotionPref;
  questSfx: boolean;
  questMusic: boolean;
  questHaptics: boolean;
  /** The Quest timer's skin; null until chosen (then each project's old focus scene maps to one). */
  timerSkin: TimerSkin | null;
}

export const DEFAULT_DEVICE_PREFS: DevicePrefs = { sound: true, haptics: true, appearance: 'system', motion: 'system', questSfx: true, questMusic: false, questHaptics: true, timerSkin: null };

function parse(raw: string | null): DevicePrefs {
  try {
    const v = raw ? JSON.parse(raw) : null;
    if (!v || typeof v !== 'object') return DEFAULT_DEVICE_PREFS;
    return {
      sound: v.sound !== false,
      haptics: v.haptics !== false,
      appearance: v.appearance === 'light' || v.appearance === 'dark' ? v.appearance : 'system',
      motion: v.motion === 'reduce' || v.motion === 'full' ? v.motion : 'system',
      questSfx: v.questSfx !== false,
      questMusic: v.questMusic === true,
      questHaptics: v.questHaptics !== false,
      timerSkin: isTimerSkin(v.timerSkin) ? v.timerSkin : null,
    };
  } catch {
    return DEFAULT_DEVICE_PREFS;
  }
}

interface Ctx {
  prefs: DevicePrefs;
  setPrefs(patch: Partial<DevicePrefs>): void;
}

const DevicePrefsContext = createContext<Ctx>({ prefs: DEFAULT_DEVICE_PREFS, setPrefs: () => {} });

/** The latest prefs outside React (the audio and haptics services read them). */
export const devicePrefsRef = { current: DEFAULT_DEVICE_PREFS };

export function DevicePrefsProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setState] = useState(DEFAULT_DEVICE_PREFS);
  const ref = useRef(prefs);
  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        const p = parse(raw);
        ref.current = p;
        devicePrefsRef.current = p;
        setState(p);
      })
      .catch(() => {});
  }, []);
  const setPrefs = useCallback((patch: Partial<DevicePrefs>) => {
    const next = { ...ref.current, ...patch };
    ref.current = next;
    devicePrefsRef.current = next;
    setState(next);
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
  }, []);
  const value = useMemo(() => ({ prefs, setPrefs }), [prefs, setPrefs]);
  return <DevicePrefsContext.Provider value={value}>{children}</DevicePrefsContext.Provider>;
}

export function useDevicePrefs(): Ctx {
  return useContext(DevicePrefsContext);
}
