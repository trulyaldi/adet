import { useEffect } from 'react';
import { Platform } from 'react-native';

const FLAG = 'data-adet-desktop';
const STYLE_ID = 'adet-desktop-page';

// Scoped to the flag, so phone web (and the kill switch) never see these rules.
const CSS = `
html[${FLAG}], html[${FLAG}] body { height: 100%; overflow: hidden; overscroll-behavior: none; }
html[${FLAG}] canvas { image-rendering: pixelated; }
`;

/**
 * Page-level setup while the desktop shell is mounted: no body scroll, a full-height
 * root, crisp pixel canvases, and the window title. All of it is undone on unmount.
 */
export function useDesktopPage(title: string): void {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const root = document.documentElement;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
    root.setAttribute(FLAG, '');
    const before = document.title;
    return () => {
      root.removeAttribute(FLAG);
      style.remove();
      document.title = before;
    };
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') document.title = title;
  }, [title]);
}
