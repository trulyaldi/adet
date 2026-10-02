// The timer skins' 12×10 previews for Settings (placeholder art for the P9
// pass), coloured from the forest palette. One character per pixel.

import type { TimerSkin } from '../domain/game/timerSkin';
import { PALETTES } from '../game/content/palettes';
import { mix } from '../theme/palette';

const P = PALETTES.forest;

export const SKIN_PREVIEW_COLS = 12;
export const SKIN_PREVIEW_ROWS = 10;

export const SKIN_PREVIEW_COLORS: Record<string, string> = {
  s: P.sky[0],
  S: P.sky[1],
  n: mix(P.sky[0], P.layers[0], 0.55),
  '*': P.light,
  y: P.accentB[1],
  Y: P.light,
  h: P.layers[1],
  g: P.ground[2],
  G: P.ground[1],
  f: P.accentB[1],
  F: P.light,
  l: P.trunk[1],
  w: P.trunk[0],
  c: P.rock[2],
  a: P.path[2],
  k: P.rock[1],
  p: P.path[1],
};

export const SKIN_PREVIEWS: Record<TimerSkin, readonly string[]> = {
  sun: ['ssssssssssss', 'sssssssyysss', 'ssssssyYYyss', 'ssssssyYYyss', 'sssssssyysss', 'SSSSSSSSSSSS', 'hhhSSSShhhSS', 'hhhhhhhhhhhh', 'gggggggggggg', 'GGGGGGGGGGGG'],
  campfire: ['nnnnnnnnnnnn', 'nn*nnnnnn*nn', 'nnnnnn*nnnnn', 'n*nnnnnnnnnn', 'nnnnnfnnnn*n', 'nnnnfFfnnnnn', 'nnnnfFFfnnnn', 'gggfFFFFfggg', 'ggglllllllgg', 'GGGGGGGGGGGG'],
  hourglass: ['sswwwwwwwwss', 'sscsssssscss', 'ssscaaaacsss', 'sssscaacssss', 'sssssaasssss', 'sssscaacssss', 'ssscsaascsss', 'sscaaaaaacss', 'sswwwwwwwwss', 'GGGGGGGGGGGG'],
  trail: ['ssssssssssss', 'ssssssssksks', 'sssssssskkks', 'sssssssskkks', 'SSSSSSSSkkkS', 'hhhSSSShhkkh', 'hhhhhhhhhhhh', 'gggggggggggg', 'pppppppppppp', 'GGGGGGGGGGGG'],
};
