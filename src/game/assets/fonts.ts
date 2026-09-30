// The Quest world's pixel font: Tiny5 for all pixel text (words and numbers).
// Chosen for legibility: 5/S, 0/O, C/O and 8/B stay distinct at 12 pt
// (docs/quest/art/FONT_DECISION.md). It is drawn on an 8-unit grid (one
// font pixel = 1/8 em), so sizes that are multiples of 8 are perfectly crisp.
// One weight: bold pixel text uses the same face.

import { Tiny5_400Regular, useFonts } from '@expo-google-fonts/tiny5';
import type { TextStyle } from 'react-native';

export const PIXEL_FONT = 'Tiny5_400Regular';

/** No ligatures in pixel text (a pixel font's ligatures can swap glyphs, as Pixelify's "fi" did). */
export const PIXEL_TEXT: TextStyle = { fontVariant: ['no-common-ligatures'] };

/** Loads the pixel font for RN text; true once it's ready (text falls back to the system font until then). */
export function useQuestFonts(): boolean {
  const [loaded] = useFonts({ Tiny5_400Regular });
  return loaded;
}
