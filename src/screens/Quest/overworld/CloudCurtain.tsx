// The clouds between the Overworld and a Realm (world-6): three layers of
// pixel cloud wall, each split in two halves that close over the screen and
// slide apart in opposite directions. Driven by the transition's `t` on the UI
// thread; nothing here re-renders while it moves. The walls are procedural
// (placeholder art); the slot's `parallax.<biome>.cloud` sprites line their edges.

import { Group, Path, Skia } from '@shopify/react-native-skia';
import React, { memo, useMemo } from 'react';
import { SharedValue, useDerivedValue } from 'react-native-reanimated';

import type { BiomeId } from '../../../domain/game/biomes';
import { SHARED } from '../../../game/content/palettes';
import { PixelStage } from '../../../game/render/PixelStage';
import { BatchItem, SpriteBatch } from '../../../game/render/SpriteBatch';
import { cloudEdge, coverOf, quantize, ZOOM_STEPS } from './transitionModel';

/** Back → front: the wall colour, its row height and how far it travels past the edge. */
const LAYERS = [
  { color: SHARED.metal[2], row: 6, extra: 30 },
  { color: '#e6e3ea', row: 5, extra: 44 },
  { color: SHARED.white, row: 4, extra: 58 },
] as const;
/** The halves overlap this much when closed, so no seam shows. */
const OVERLAP = 12;

export const CloudCurtain = memo(function CloudCurtain({ t, width, height, scale, biome }: { t: SharedValue<number>; width: number; height: number; scale: number; biome: BiomeId }) {
  const viewW = Math.ceil(width / scale);
  const viewH = Math.ceil(height / scale);
  return (
    <PixelStage width={width} height={height} scale={scale} style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}>
      {LAYERS.map((l, i) => (
        <Group key={i}>
          <Half t={t} layer={i} side={-1} viewW={viewW} viewH={viewH} biome={biome} />
          <Half t={t} layer={i} side={1} viewW={viewW} viewH={viewH} biome={biome} />
        </Group>
      ))}
    </PixelStage>
  );
});

function Half({ t, layer, side, viewW, viewH, biome }: { t: SharedValue<number>; layer: number; side: -1 | 1; viewW: number; viewH: number; biome: BiomeId }) {
  const { color, row, extra } = LAYERS[layer];
  const half = Math.ceil(viewW / 2);
  const { path, items } = useMemo(() => {
    const rows = Math.ceil(viewH / row) + 1;
    const edge = cloudEdge(rows, layer, side);
    const path = Skia.Path.Make();
    const items: BatchItem[] = [];
    edge.forEach((e, i) => {
      // Each row runs from well past the screen's edge to the middle, give or take its jut.
      const reach = half + OVERLAP + e;
      const x = side < 0 ? -viewW : viewW - reach;
      path.addRect(Skia.XYWHRect(x, i * row, viewW + reach, row));
      if (layer === LAYERS.length - 1 && i % 4 === 1) items.push({ id: `parallax.${biome}.cloud`, x: side < 0 ? reach - 26 : viewW - reach - 10, y: i * row - 4 });
    });
    return { path, items };
  }, [layer, side, viewW, viewH, row, half, biome]);
  // Open, the half sits fully past its edge; closed, at the middle. Whole game pixels only.
  const dist = half + OVERLAP + extra;
  const transform = useDerivedValue(() => [{ translateX: Math.round(side * (1 - coverOf(quantize(t.value, ZOOM_STEPS))) * dist) }]);
  return (
    <Group transform={transform}>
      <Path path={path} color={color} />
      {items.length > 0 && <SpriteBatch atlas={biome} items={items} />}
    </Group>
  );
}
