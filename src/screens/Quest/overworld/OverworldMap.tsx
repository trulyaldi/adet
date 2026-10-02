// The Overworld's canvas (World Mode, world-5): the 7 biome bands bottom →
// top, each with a small island of procedural pixel tiles in its palette, a
// dotted path joining them, decor and a flag on claimed islands, static
// clouds over unclaimed ones, and the hero token. The camera follows the
// screen's scroll; taps are handled by the overlay above it.

import { Group, Path, Rect, rect, Skia } from '@shopify/react-native-skia';
import React, { memo, useMemo } from 'react';
import { SharedValue, useDerivedValue } from 'react-native-reanimated';

import type { SlotView } from '../../../domain/world/select';
import type { AvatarLook } from '../../../game/avatar';
import { WORLD_W } from '../../../game/content/biomes/layout';
import { SHARED } from '../../../game/content/palettes';
import { AvatarSprite } from '../../../game/render/Avatar';
import { Camera, PixelStage } from '../../../game/render/PixelStage';
import { BatchItem, SpriteBatch } from '../../../game/render/SpriteBatch';
import { LIFT_STEPS, quantize, RAISE_STEPS } from './transitionModel';
import { CELL, islandCells, islandClouds, islandDecor, OW_H, OW_HEAD, OverworldLayout, SLOT_H, SlotSpot, skySteps } from './overworldModel';

export interface OverworldMapProps {
  width: number;
  height: number;
  scale: number;
  layout: OverworldLayout;
  slots: readonly SlotView[];
  camY: SharedValue<number>;
  clock: SharedValue<number>;
  reduced: boolean;
  look: AvatarLook;
  /** The hero token; hidden until a realm is claimed. */
  hero: boolean;
  heroX: SharedValue<number>;
  heroY: SharedValue<number>;
  heroMode: SharedValue<number>;
  /** The slot just claimed: its clouds lift and drift off as `liftT` runs 0 → 1. */
  lift: number | null;
  liftT: SharedValue<number>;
  /** Realms whose flag rises as `raiseT` runs 0 → 1 (newly conquered). */
  raising: readonly string[];
  raiseT: SharedValue<number>;
}

export const OverworldMap = memo(function OverworldMap(p: OverworldMapProps) {
  const viewW = Math.ceil(p.width / p.scale);
  const camX = Math.round((WORLD_W - viewW) / 2);
  return (
    <PixelStage width={p.width} height={p.height} scale={p.scale}>
      <Camera x={camX} y={p.camY}>
        <Sky layout={p.layout} x0={camX - 8} w={viewW + 16} />
        <PathDots layout={p.layout} />
        {p.layout.slots.map((s) => (
          <Island key={s.slot} spot={s} view={p.slots[s.slot]} clock={p.clock} reduced={p.reduced} liftT={p.lift === s.slot ? p.liftT : null} raiseT={p.slots[s.slot].realm && p.raising.includes(p.slots[s.slot].realm!.id) ? p.raiseT : null} />
        ))}
        {p.hero && <AvatarSprite look={p.look} x={p.heroX} y={p.heroY} mode={p.heroMode} clock={p.clock} />}
      </Camera>
    </PixelStage>
  );
});

/** Each band's sky in four flat steps; the top and bottom bands run on past the ends. */
const Sky = memo(function Sky({ layout, x0, w }: { layout: OverworldLayout; x0: number; w: number }) {
  const { slots } = layout;
  const last = slots.length - 1;
  const bands = useMemo(() => slots.map((s) => skySteps(s.biome, slots[s.slot + 1]?.biome, slots[s.slot - 1]?.biome)), [slots]);
  const step = SLOT_H / bands[0].length;
  return (
    <Group>
      <Rect x={x0} y={-OW_H} width={w} height={OW_H + OW_HEAD} color={bands[last][0]} />
      <Rect x={x0} y={slots[0].top + SLOT_H} width={w} height={OW_H} color={bands[0][bands[0].length - 1]} />
      {slots.map((s) => bands[s.slot].map((c, i) => <Rect key={`${s.slot}.${i}`} x={x0} y={s.top + i * step} width={w} height={step} color={c} />))}
    </Group>
  );
});

const PathDots = memo(function PathDots({ layout }: { layout: OverworldLayout }) {
  const { shade, dots } = useMemo(() => {
    const shade = Skia.Path.Make();
    const dots = Skia.Path.Make();
    for (const d of layout.path) {
      shade.addRect(Skia.XYWHRect(d.x - 1, d.y, 3, 3));
      dots.addRect(Skia.XYWHRect(d.x - 1, d.y - 1, 2, 2));
    }
    return { shade, dots };
  }, [layout]);
  return (
    <Group>
      <Path path={shade} color={SHARED.outline} opacity={0.35} />
      <Path path={dots} color={SHARED.paper[2]} />
    </Group>
  );
});

const Island = memo(function Island({ spot, view, clock, reduced, liftT, raiseT }: { spot: SlotSpot; view: SlotView; clock: SharedValue<number>; reduced: boolean; liftT: SharedValue<number> | null; raiseT: SharedValue<number> | null }) {
  const ground = useMemo(
    () =>
      islandCells(spot).map(({ color, xy }) => {
        const path = Skia.Path.Make();
        for (let i = 0; i < xy.length; i += 2) path.addRect(Skia.XYWHRect(xy[i], xy[i + 1], CELL, CELL));
        return { color, path };
      }),
    [spot]
  );
  const claimed = !!view.realm;
  const items = useMemo<BatchItem[]>(() => {
    if (!claimed) return islandClouds(spot);
    const out: BatchItem[] = islandDecor(spot);
    if (view.conquered && !raiseT) out.push(flagOf(spot));
    return out.sort((a, b) => a.y - b.y);
  }, [spot, claimed, view.conquered, raiseT]);
  return (
    <Group>
      {/* Under cloud the island shows only faintly. */}
      <Group opacity={claimed ? 1 : 0.55}>
        {ground.map((g) => (
          <Path key={g.color} path={g.path} color={g.color} />
        ))}
      </Group>
      <SpriteBatch atlas={spot.biome} items={items} clock={reduced ? undefined : clock} />
      {claimed && liftT && <LiftingClouds spot={spot} t={liftT} />}
      {view.conquered && raiseT && <RisingFlag spot={spot} t={raiseT} clock={reduced ? undefined : clock} />}
    </Group>
  );
});

const flagOf = (spot: SlotSpot): BatchItem => ({ id: `prop.${spot.biome}.flag`, x: spot.x + 26, y: spot.y - 6 });
/** The flag sprite's height: it rises this far out of the ground. */
const FLAG_H = 14;

/** A newly conquered realm's flag climbs out of the ground in pixel steps. */
function RisingFlag({ spot, t, clock }: { spot: SlotSpot; t: SharedValue<number>; clock?: SharedValue<number> }) {
  const flag = useMemo(() => [flagOf(spot)], [spot]);
  const clip = useMemo(() => rect(flag[0].x - 8, flag[0].y - FLAG_H - 4, 16, FLAG_H + 4), [flag]);
  const transform = useDerivedValue(() => [{ translateY: Math.round((1 - quantize(t.value, RAISE_STEPS)) * FLAG_H) }]);
  return (
    <Group clip={clip}>
      <Group transform={transform}>
        <SpriteBatch atlas={spot.biome} items={flag} clock={clock} />
      </Group>
    </Group>
  );
}

/** A claimed slot's clouds rise and part, left ones to the left and right ones to the right, fading as they go. */
function LiftingClouds({ spot, t }: { spot: SlotSpot; t: SharedValue<number> }) {
  const { left, right } = useMemo(() => {
    const all = islandClouds(spot);
    return { left: all.filter((c) => c.x < spot.x - 10), right: all.filter((c) => c.x >= spot.x - 10) };
  }, [spot]);
  const q = useDerivedValue(() => quantize(t.value, LIFT_STEPS));
  const opacity = useDerivedValue(() => 1 - q.value);
  const leftT = useDerivedValue(() => [{ translateX: -Math.round(q.value * 22) }, { translateY: -Math.round(q.value * 18) }]);
  const rightT = useDerivedValue(() => [{ translateX: Math.round(q.value * 22) }, { translateY: -Math.round(q.value * 14) }]);
  return (
    <Group opacity={opacity}>
      <Group transform={leftT}>
        <SpriteBatch atlas={spot.biome} items={left} />
      </Group>
      <Group transform={rightT}>
        <SpriteBatch atlas={spot.biome} items={right} />
      </Group>
    </Group>
  );
}
