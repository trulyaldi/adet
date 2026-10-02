// Sun Arc (the default skin): a pixel sun crosses the sky over the session,
// rising at the start and setting at the target. The light warms at dawn and
// dusk, clear at noon, and never goes dark. Past the target the sun rests on
// the hills and a few soft stars come out.

import { Group, Rect } from '@shopify/react-native-skia';
import React, { useMemo } from 'react';
import { useDerivedValue } from 'react-native-reanimated';

import { sunAt } from '../../../../domain/game/timerSkin';
import { PALETTES } from '../../../../game/content/palettes';
import { mix } from '../../../../theme/palette';
import { gridCells, Pixels, scatter, SkinProps, SkinRenderer, Sky } from './common';

// Placeholder art (P9 art pass): drawn here as pixel grids.
const SUN = ['..ooo..', '.oyyyo.', 'oyyLyyo', 'oyLLLyo', 'oyyLyyo', '.oyyyo.', '..ooo..'];
const HALO = ['...hhhhh...', '..h.....h..', '.h.......h.', 'h.........h', 'h.........h', 'h.........h', 'h.........h', 'h.........h', '.h.......h.', '..h.....h..', '...hhhhh...'];
const EVENING_STARS = 6;

function Back({ biome, worldW, horizon, progress, past, clock, reduced }: SkinProps) {
  const pal = PALETTES[biome];
  const sun = sunAt(progress);
  const top = mix(pal.sky[0], pal.light, sun.warmth * 0.5);
  const bottom = mix(pal.sky[1], pal.accentB[1], sun.warmth * 0.45);
  const sx = Math.round(sun.x * worldW) - 3;
  const sy = Math.round(horizon - 6 - sun.lift * Math.max(0, horizon - 22));
  const disk = useMemo(() => gridCells(SUN, { o: pal.accentB[1], y: mix(pal.accentB[1], pal.light, 0.6), L: pal.light }, sx, sy), [pal, sx, sy]);
  const halo = useMemo(() => gridCells(HALO, { h: pal.light }, sx - 2, sy - 2), [pal, sx, sy]);
  const stars = useMemo(
    () => (past ? Array.from({ length: EVENING_STARS }, (_, i) => ({ x: Math.round(8 + scatter(i, 3) * (worldW - 16)), y: Math.round(4 + scatter(i, 9) * horizon * 0.4), color: pal.light })) : []),
    [past, worldW, horizon, pal],
  );
  // One star at a time breathes (stepped; still with reduced motion).
  const twinkle = useDerivedValue(() => (reduced ? 0 : Math.floor(clock.value / 900) % Math.max(1, EVENING_STARS)));
  const tx = useDerivedValue(() => stars[twinkle.value]?.x ?? -9);
  const ty = useDerivedValue(() => stars[twinkle.value]?.y ?? -9);
  return (
    <Group>
      <Sky top={top} bottom={bottom} worldW={worldW} horizon={horizon} />
      {stars.length > 0 && (
        <>
          <Pixels cells={stars} opacity={0.8} />
          <Rect x={tx} y={ty} width={1} height={1} color={pal.sky[1]} opacity={0.7} />
        </>
      )}
      <Pixels cells={halo} opacity={0.35} />
      <Pixels cells={disk} />
    </Group>
  );
}

export const sunArc: SkinRenderer = {
  Back,
  ambient: 'day',
  say: (p, past) => (past ? 'The sun has set: past the target' : p < 0.5 ? 'The sun is rising' : 'The sun is past noon'),
};
