import React, { createContext, useContext } from 'react';
import { useColorScheme } from 'react-native';

import { useDevicePrefs } from '../store/devicePrefs';
import { DARK_THEME, LIGHT_THEME, Theme } from './theme';

const ThemeContext = createContext<Theme>(LIGHT_THEME);

/** Follows the system light/dark setting unless Settings overrides it. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const { prefs } = useDevicePrefs();
  const isDark = prefs.appearance === 'system' ? system === 'dark' : prefs.appearance === 'dark';
  return <ThemeContext.Provider value={isDark ? DARK_THEME : LIGHT_THEME}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
