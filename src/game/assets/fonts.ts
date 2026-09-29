// The Quest world's pixel fonts: Pixelify Sans for text, Silkscreen for tiny
// labels. RN text loads them through expo-font; Skia text uses the same files
// through useFont.

import { PixelifySans_400Regular, PixelifySans_700Bold, useFonts } from '@expo-google-fonts/pixelify-sans';
import { Silkscreen_400Regular } from '@expo-google-fonts/silkscreen';
import type { TextStyle } from 'react-native';

export const PIXEL_FONT = 'PixelifySans_400Regular';
export const PIXEL_FONT_BOLD = 'PixelifySans_700Bold';
export const TINY_FONT = 'Silkscreen_400Regular';

/**
 * Pixelify Sans's "fi" ligature draws as a capital A ("first" read "Arst" on
 * web, and iOS applies standard ligatures too), so pixel text turns them off.
 */
export const PIXEL_TEXT: TextStyle = { fontVariant: ['no-common-ligatures'] };

/** Font files, for Skia's useFont. */
export const FONT_FILES = {
  pixel: PixelifySans_400Regular as number,
  pixelBold: PixelifySans_700Bold as number,
  tiny: Silkscreen_400Regular as number,
};

/** Loads the pixel fonts for RN text; true once they're ready (text falls back to the system font until then). */
export function useQuestFonts(): boolean {
  const [loaded] = useFonts({ PixelifySans_400Regular, PixelifySans_700Bold, Silkscreen_400Regular });
  return loaded;
}
