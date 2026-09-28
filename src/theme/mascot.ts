// Ilmek's colors (assets/mascot/ILMEK_SPEC.md). The character looks the same
// in light and dark themes; only a project tint changes its four body tones.

import { mix, SWATCHES, WHITE } from './palette';
import type { ProjectColor } from './palette';

export interface IlmekTones {
  /** Body and head curl. */
  body: string;
  /** Lower-right crescent, arms and feet. */
  shade: string;
  /** Gloss mark, upper left. */
  gloss: string;
  /** Belly patch. */
  belly: string;
}

/** Brand blue, exactly as drawn on the reference sheet. */
export const ILMEK_BLUE: IlmekTones = { body: '#0A7AFF', shade: '#0062D1', gloss: '#4D9EFF', belly: '#CFE4FF' };

export const ILMEK_INK = '#1C1C1E';
export const ILMEK_CHEEK = '#FF8FB1';
export const ILMEK_TONGUE = '#FF6B8A';

// The brand tones sit at these mixes of the body color (shade toward black,
// gloss and belly toward white), so a tint keeps the same relationships.
const SHADE_MIX = 0.19;
const GLOSS_MIX = 0.27;
const BELLY_MIX = 0.8;

export function tonesFrom(body: string): IlmekTones {
  return { body, shade: mix(body, '#000000', SHADE_MIX), gloss: mix(body, WHITE, GLOSS_MIX), belly: mix(body, WHITE, BELLY_MIX) };
}

/** Body tones for a project color, or brand blue with none. */
export function ilmekTones(tint?: ProjectColor): IlmekTones {
  return tint && SWATCHES[tint] ? tonesFrom(SWATCHES[tint].base) : ILMEK_BLUE;
}
