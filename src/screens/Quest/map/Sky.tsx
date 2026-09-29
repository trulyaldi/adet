// The sky beside the islands: colour bands a few pixels tall (a pixel-art
// gradient, not a smooth one), blending into the next biome, plus clouds and
// far silhouettes on two slower parallax layers.

import { Atlas, rect, Skia } from '@shopify/react-native-skia';
import React, { memo, useMemo } from 'react';
import type { SharedValue } from 'react-native-reanimated';

import { BiomeId, BIOME_IDS } from '../../../domain/game/biomes';
import { BIOME_H, BiomeMap, WORLD_W } from '../../../game/content/biomes/layout';
import { PALETTES } from '../../../game/content/palettes';
import { sprite } from '../../../game/assets/manifest';
import { useAtlas } from '../../../game/render/atlas';
import { NEAREST } from '../../../game/render/pixel';
import { Parallax } from '../../../game/render/PixelStage';
import { SpriteBatch } from '../../../game/render/SpriteBatch';

const BAND = 8;

function rgb(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
const lerp = (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** The sky behind one biome (and the blend from the biome above), in bands. */
export const SkyBands = memo(function SkyBands({ map, x0, width }: { map: BiomeMap; x0: number; width: number }) {
  const image = useAtlas('shared');
  const px = sprite('fx.pixel').frames[0];
  const bands = useMemo(() => {
    const P = PALETTES[map.id];
    const above = map.index + 1 < BIOME_IDS.length ? PALETTES[BIOME_IDS[map.index + 1] as BiomeId] : null;
    const top = rgb(P.sky[0]);
    const bottom = rgb(P.sky[1]);
    // The forest also paints the sky below its island.
    const n = BIOME_H / BAND + (map.index === 0 ? 12 : 0);
    const cols = Math.ceil(width / BAND) + 1;
    const sprites = [];
    const transforms = [];
    const colors = [];
    for (let i = 0; i < n; i++) {
      const t = Math.min(1, i / (BIOME_H / BAND - 1));
      let c = lerp(top, bottom, t);
      // The top fifth blends up into the biome above.
      if (above && t < 0.2) c = lerp(rgb(above.sky[1]), c, t / 0.2);
      // A few steps per channel: pixel banding, not a smooth gradient.
      c = c.map((v) => Math.round(v * 24) / 24) as [number, number, number];
      const col = Float32Array.of(c[0], c[1], c[2], 1);
      for (let k = 0; k < cols; k++) {
        sprites.push(rect(px[0], px[1], 1, 1));
        transforms.push(Skia.RSXform(BAND, 0, x0 + k * BAND, map.top + i * BAND));
        colors.push(col);
      }
    }
    return { sprites, transforms, colors };
  }, [map, px, x0, width]);
  if (!image) return null;
  return <Atlas image={image} sprites={bands.sprites} transforms={bands.transforms} colors={bands.colors} colorBlendMode="modulate" sampling={NEAREST} />;
});

/** Clouds and far shapes, seeded per biome, on two slower layers. */
export const SkyParallax = memo(function SkyParallax({ map, camX, camY, factors, clock }: { map: BiomeMap; camX: number; camY: SharedValue<number>; factors: [number, number]; clock?: SharedValue<number> }) {
  const [fc, ff] = factors;
  const clouds = useMemo(() => {
    const out = [];
    for (let i = 0; i < 5; i++) {
      const left = i % 2 === 0;
      out.push({ id: `parallax.${map.id}.cloud`, x: left ? -22 + (i * 7) % 16 : WORLD_W - 12 + (i * 5) % 14, y: (map.top + 40 + i * 76) * fc, bob: true });
    }
    return out;
  }, [map, fc]);
  const far = useMemo(() => {
    const out = [];
    for (let i = 0; i < 3; i++) {
      const left = i % 2 === 1;
      out.push({ id: `parallax.${map.id}.far.${i % 2 ? 'a' : 'b'}`, x: left ? -30 : WORLD_W - 4, y: (map.top + 60 + i * 120) * ff });
    }
    return out;
  }, [map, ff]);
  return (
    <>
      <Parallax x={camX} y={camY} factor={ff}>
        <SpriteBatch atlas={map.id} items={far} />
      </Parallax>
      <Parallax x={camX} y={camY} factor={fc}>
        <SpriteBatch atlas={map.id} items={clouds} clock={clock} />
      </Parallax>
    </>
  );
});
