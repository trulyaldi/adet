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
import { Pixels, scatter, SkinProps, SkinRenderer, Sky } from './common';

const STARS = 14;
/** The camp's fire (a stand-in sprite until the P9 art pass; animated in the atlas at 7 fps). */
const FIRE = 'prop.campfire.default.lit';

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

function Front({ worldW, worldH, progress, clock, reduced }: SkinProps) {
  const level = fireLevel(progress);
  const cx = fireX(worldW);
  const feet = worldH - 3;
  return (
    <Group>
      {/* Livelier with time: a warmer glow and more embers (the fire itself never shrinks). */}
      <Group opacity={0.25 + 0.25 * level}>
        <SpriteBatch atlas="shared" items={[{ id: 'fx.glow.warm', x: cx, y: feet - 6 }]} additive />
      </Group>
      <SpriteBatch atlas="shared" items={[{ id: FIRE, x: cx, y: feet }]} clock={reduced ? undefined : clock} />
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
