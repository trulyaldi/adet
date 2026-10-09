import { createContext, useContext, useLayoutEffect } from 'react';

/** Set by DesktopShell; a no-op on phone and outside the shell. */
export const DesktopFillContext = createContext<(fill: boolean) => void>(() => {});

/**
 * Call from a screen that lays itself out for the whole main area. The shell
 * keeps every other screen in a phone-width column in the middle of it. The
 * opt-out lasts while the screen is mounted. Does nothing on phone.
 */
export function useDesktopFill(): void {
  const setFill = useContext(DesktopFillContext);
  useLayoutEffect(() => {
    setFill(true);
    return () => setFill(false);
  }, [setFill]);
}
