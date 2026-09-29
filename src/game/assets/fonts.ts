// The Quest world's pixel fonts: Pixelify Sans for text, Silkscreen for tiny
// labels. RN text loads them through expo-font; Skia text uses the same files
// through useFont.

import { PixelifySans_400Regular, PixelifySans_700Bold, useFonts } from '@expo-google-fonts/pixelify-sans';
import { Silkscreen_400Regular } from '@expo-google-fonts/silkscreen';

export const PIXEL_FONT = 'PixelifySans_400Regular';
export const PIXEL_FONT_BOLD = 'PixelifySans_700Bold';
export const TINY_FONT = 'Silkscreen_400Regular';

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
