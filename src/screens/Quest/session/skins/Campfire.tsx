// Campfire: a fire between you and the enemy, lit for the whole session. It
// grows livelier with focused time (never smaller: it doesn't "die" as a
// punishment), and stars come out one by one in a soft evening sky.

import { Group, Rect } from '@shopify/react-native-skia';
import React, { useMemo } from 'react';
import { useDerivedValue } from 'react-native-reanimated';

import { fireLevel, starsShown } from '../../../../domain/game/timerSkin';
import { PALETTES } from '../../../../game/content/palettes';
import { Particles } from '../../../../game/render/Particles';
import { SpriteBatch } from '../../../../game/render/SpriteBatch';
import { mix } from '../../../../theme/palette';
import { gridCells, Pixels, scatter, SkinProps, SkinRenderer, Sky } from './common';

// Placeholder art (P9 art pass): drawn here as pixel grids.
const LOGS = ['.r.......r.', 'rbaa...aabr', '.rbbaaabbr.', '..rrrrrrr..'];
const FLAMES = [
  ['...y...', '...yy..', '..yoy..', '..ooy..', '.yoLoy.', '.oLLLo.', 'ooLLLoo', 'oLLLLLo', '.oLLLo.'],
  ['...y...', '..yy...', '..yoy..', '..yoo..', '.yoLoy.', '.oLLLo.', 'ooLLLoo', 'oLLLLLo', '.oLLLo.'],
  ['.......', '...y...', '..yoy..', '.yooy..', '.yoLoo.', '.oLLLo.', 'ooLLLoo', 'oLLLLLo', '.oLLLo.'],
];
const FLAME_H = FLAMES[0].length;
const STARS = 14;
/** Flames step at about 6 fps. */
const FLAME_MS = 166;

/** The fire's spot on the ground, between you and the enemy. */
const fireX = (worldW: number) => Math.round(worldW * 0.44);

function Back({ biome, worldW, horizon, progress, clock, reduced }: SkinProps) {
  const pal = PALETTES[biome];
  // A soft evening: the biome's sky toward its own far-hill colour, never dark.
  const top = mix(pal.sky[0], pal.layers[0], 0.45);
  const bottom = mix(pal.sky[1], pal.accentB[2], 0.3);
  const shown = starsShown(progress, STARS);
  const stars = useMemo(
    () => Array.from({ length: shown }, (_, i) => ({ x: Math.round(6 + scatter(i, 1) * (worldW - 12)), y: Math.round(3 + scatter(i, 5) * horizon * 0.5), color: pal.light })),
    [shown, worldW, horizon, pal],
  );
  const twinkle = useDerivedValue(() => (reduced || !stars.length ? -1 : Math.floor(clock.value / 1100) % stars.length));
  const tx = useDerivedValue(() => (twinkle.value >= 0 ? stars[twinkle.value].x : -9));
  const ty = useDerivedValue(() => (twinkle.value >= 0 ? stars[twinkle.value].y : -9));
  return (
    <Group>
      <Sky top={top} bottom={bottom} worldW={worldW} horizon={horizon} />
      <Pixels cells={stars} opacity={0.85} />
      <Rect x={tx} y={ty} width={1} height={1} color={top} opacity={0.6} />
    </Group>
  );
}

function Front({ biome, worldW, worldH, progress, clock, reduced }: SkinProps) {
  const pal = PALETTES[biome];
  const level = fireLevel(progress);
  const cx = fireX(worldW);
  const feet = worldH - 4;
  const logs = useMemo(() => gridCells(LOGS, { a: pal.trunk[1], b: pal.trunk[0], r: pal.rock[1] }, cx - 5, feet - LOGS.length + 1), [pal, cx, feet]);
  // Livelier with time: more of the flame shows (never fewer than five rows).
  const rows = Math.max(5, Math.ceil(level * FLAME_H));
  const frames = useMemo(
    () => FLAMES.map((f) => gridCells(f.slice(FLAME_H - rows), { L: pal.light, o: pal.accentB[1], y: pal.accentB[0] }, cx - 3, feet - LOGS.length - rows + 2)),
    [pal, cx, feet, rows],
  );
  const frame = useDerivedValue(() => (reduced ? 0 : Math.floor(clock.value / FLAME_MS) % FLAMES.length));
  const o0 = useDerivedValue<number>(() => (frame.value === 0 ? 1 : 0));
  const o1 = useDerivedValue<number>(() => (frame.value === 1 ? 1 : 0));
  const o2 = useDerivedValue<number>(() => (frame.value === 2 ? 1 : 0));
  return (
    <Group>
      <Group opacity={0.25 + 0.25 * level}>
        <SpriteBatch atlas="shared" items={[{ id: 'fx.glow.warm', x: cx, y: feet - 6 }]} additive />
      </Group>
      <Pixels cells={frames[0]} opacity={o0} />
      <Pixels cells={frames[1]} opacity={o1} />
      <Pixels cells={frames[2]} opacity={o2} />
      <Pixels cells={logs} />
      {!reduced && <Particles kind="embers" x={cx - 4} y={feet - 26} w={8} h={18} count={Math.round(3 + level * 5)} clock={clock} intensity={level} />}
    </Group>
  );
}

export const campfire: SkinRenderer = {
  Back,
  Front,
  ambient: 'night',
  say: (p, past) => (past ? 'The campfire is bright and every star is out: past the target' : `The campfire burns; ${starsShown(p, STARS)} of ${STARS} stars are out`),
};
