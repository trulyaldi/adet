// Trail: the journey toward this biome's landmark. The far hills scroll by
// as the time grows and the landmark (castle, cave, tower) comes in from the
// right, arriving at the target, while the fight stays in the foreground.
// Everything moves with today's time, not the clock: it is the same picture
// after a relaunch.

import { Group, Rect } from '@shopify/react-native-skia';
import React from 'react';

import type { BiomeId } from '../../../../domain/game/biomes';
import { trailAt } from '../../../../domain/game/timerSkin';
import { sprite } from '../../../../game/assets/manifest';
import { PALETTES } from '../../../../game/content/palettes';
import { SpriteBatch } from '../../../../game/render/SpriteBatch';
import { SkinProps, SkinRenderer, Sky } from './common';

const landmarkId = (b: BiomeId) => `decor.${b}.landmark`;
/** World px the far hills scroll over a whole session. */
const FAR_TRAVEL = 88;

function Back({ biome, worldW, horizon }: SkinProps) {
  const pal = PALETTES[biome];
  return <Sky top={pal.sky[0]} bottom={pal.sky[1]} worldW={worldW} horizon={horizon} />;
}

/** The landmark, between the hills and the ground. */
function Mid({ biome, worldW, horizon, progress }: SkinProps) {
  const id = landmarkId(biome);
  const m = sprite(id);
  const p = trailAt(progress);
  const from = worldW + m.w / 2 - 6;
  const to = Math.round(worldW * 0.62);
  const x = Math.round(from + (to - from) * p);
  return <SpriteBatch atlas={biome} items={[{ id, x, y: horizon + 6 }]} />;
}

/** The path underfoot: dashes that step along with the time. */
function Front({ biome, worldW, worldH, progress }: SkinProps) {
  const pal = PALETTES[biome];
  const y = worldH - 3;
  const shift = Math.round(trailAt(progress) * FAR_TRAVEL) % 6;
  const dashes = [];
  for (let x = -shift; x < worldW; x += 6) dashes.push(<Rect key={x} x={x} y={y} width={3} height={1} color={pal.path[2]} />);
  return (
    <Group>
      <Rect x={0} y={y - 1} width={worldW} height={3} color={pal.path[1]} />
      {dashes}
    </Group>
  );
}

export const trail: SkinRenderer = {
  Back,
  Mid,
  Front,
  farShift: (p) => Math.round(trailAt(p) * FAR_TRAVEL),
  ambient: 'day',
  say: (p, past) => (past ? 'You have reached the landmark: past the target' : `The landmark is ${Math.round(p * 100)}% of the way`),
};
