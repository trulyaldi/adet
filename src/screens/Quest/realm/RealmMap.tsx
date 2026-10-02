// The Realm screen's map (World Mode, world-3): one biome, the realm's slot,
// drawn as the journey map draws it (sky, ground, path, decor, critters,
// lights) with the realm's quests on the path, the oldest uncleared boss in
// the lair with its phase pips, the camp and a "+" at the path's start.
// Vertical pan within the island; taps go to the screen in world coordinates.

import { Group, Rect } from '@shopify/react-native-skia';
import React, { memo, useMemo } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { SharedValue, useDerivedValue, useSharedValue, withDecay, withSpring } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { DayPhase, nightLight } from '../../../domain/game/daylight';
import { BIOMES } from '../../../game/content/biomes';
import { BAND_W, BAND_X, BIOME_H, BiomeMap, WORLD_W } from '../../../game/content/biomes/layout';
import type { FireStyle } from '../../../game/content/shop';
import type { AvatarLook } from '../../../game/avatar';
import { Graded, Lights, worldMatrix } from '../../../game/render/Lighting';
import { Particles } from '../../../game/render/Particles';
import { Camera, PixelStage } from '../../../game/render/PixelStage';
import { pixelScale } from '../../../game/render/pixel';
import { BatchItem, SpriteBatch } from '../../../game/render/SpriteBatch';
import { tileItems } from '../../../game/render/Tilemap';
import { CampLayer } from '../map/CampLayer';
import { SkyBands, SkyParallax } from '../map/Sky';
import { RealmLayout } from './realmModel';

export interface RealmMapProps {
  width: number;
  height: number;
  map: BiomeMap;
  layout: RealmLayout;
  conquered: boolean;
  /** Nothing on the path yet: the "+" pulses. */
  empty: boolean;
  phase: DayPhase;
  camY: SharedValue<number>;
  clock: SharedValue<number>;
  reduced: boolean;
  camp: { fireLit: boolean; fireStyle: FireStyle; chests: number; pet: string | null };
  look: AvatarLook;
  avatarX: SharedValue<number>;
  avatarY: SharedValue<number>;
  avatarMode: SharedValue<number>;
  /** A quest just cleared: sparkles here from this clock time. */
  pop: { x: number; y: number; at: SharedValue<number> };
  onTap(wx: number, wy: number, sx: number, sy: number): void;
}

/** Sky below the island and above the lair the camera may show. */
const FOOT = 44;
const HEAD = 24;
const OVERSCROLL = 60;

/** Camera bounds for one biome. */
export function realmCamera(map: BiomeMap, width: number, height: number) {
  const scale = pixelScale(width);
  const viewH = Math.ceil(height / scale);
  const minY = map.top - HEAD;
  const maxY = Math.max(minY, map.top + BIOME_H - viewH + FOOT);
  return { scale, viewW: Math.ceil(width / scale), viewH, minY, maxY };
}

/** Camera y that puts a world point a little below the middle of the view, within the realm. */
export function realmCameraFor(map: BiomeMap, y: number, width: number, height: number): number {
  const c = realmCamera(map, width, height);
  return Math.max(c.minY, Math.min(c.maxY, Math.round(y - c.viewH * 0.6)));
}

export const RealmMap = memo(function RealmMap(p: RealmMapProps) {
  const { scale, viewW, minY, maxY } = realmCamera(p.map, p.width, p.height);
  const camX = Math.round((WORLD_W - viewW) / 2);
  const start = useSharedValue(0);
  const tap = p.onTap;
  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .activeOffsetY([-6, 6])
      .onBegin(() => {
        start.set(p.camY.value);
      })
      .onUpdate((e) => {
        let y = start.value - e.translationY / scale;
        if (y < minY) y = minY - (minY - y) * 0.35;
        if (y > maxY) y = maxY + (y - maxY) * 0.35;
        p.camY.set(Math.max(minY - OVERSCROLL, Math.min(maxY + OVERSCROLL, y)));
      })
      .onEnd((e) => {
        const y = p.camY.value;
        if (y < minY || y > maxY) p.camY.set(withSpring(y < minY ? minY : maxY, { damping: 18, stiffness: 160 }));
        else p.camY.set(withDecay({ velocity: -e.velocityY / scale, clamp: [minY, maxY], rubberBandEffect: true, rubberBandFactor: 0.6 }));
      });
    const tapG = Gesture.Tap()
      .maxDistance(10)
      .onEnd((e) => {
        scheduleOnRN(tap, e.x / scale + camX, e.y / scale + p.camY.value, e.x, e.y);
      });
    return Gesture.Race(pan, tapG);
  }, [p.camY, scale, minY, maxY, camX, start, tap]);

  const night = nightLight(p.phase);
  return (
    <GestureDetector gesture={gesture}>
      <View style={{ width: p.width, height: p.height }} collapsable={false}>
        <PixelStage width={p.width} height={p.height} scale={scale}>
          <Camera x={camX} y={p.camY}>
            <SkyBands map={p.map} x0={camX - 8} width={viewW + 16} />
          </Camera>
          <SkyParallax map={p.map} camX={camX} camY={p.camY} factors={BIOMES[p.map.id].parallax} clock={p.reduced ? undefined : p.clock} />
          <Camera x={camX} y={p.camY}>
            <RealmLayer {...p} />
            <CampLayer at={p.layout.camp} {...p.camp} look={p.look} pips={0} avatarX={p.avatarX} avatarY={p.avatarY} avatarMode={p.avatarMode} clock={p.clock} night={night} reduced={p.reduced} />
            <Plus x={p.layout.plus.x} y={p.layout.plus.y} pulse={p.empty && !p.reduced} clock={p.clock} />
            {!p.reduced && <Particles kind="sparkle" x={p.pop.x - 10} y={p.pop.y - 20} w={20} h={20} count={18} clock={p.clock} startAt={p.pop.at} />}
          </Camera>
        </PixelStage>
      </View>
    </GestureDetector>
  );
});

const RealmLayer = memo(function RealmLayer(p: RealmMapProps) {
  const { map, layout, clock } = p;
  const b = map.id;
  const def = BIOMES[b];
  const ground = useMemo(() => [...tileItems({ grid: map.ground, x: BAND_X, y: map.top }), ...map.edges], [map]);
  const path = useMemo(() => {
    const edge: BatchItem[] = [];
    const fill: BatchItem[] = [];
    for (let i = 0; i < map.path.length; i += 2) {
      edge.push({ id: `tile.${b}.path.edge`, x: map.path[i].x, y: map.path[i].y });
      fill.push({ id: `tile.${b}.path.fill`, x: map.path[i].x, y: map.path[i].y });
    }
    return { edge, fill };
  }, [map, b]);
  // Everything standing on the island, sorted by feet.
  const things = useMemo(() => {
    const out: BatchItem[] = [...map.decor];
    layout.nodes.forEach((n, i) => out.push({ id: n.sprite, x: n.x, y: n.y, flip: n.x > WORLD_W / 2, phase: i }));
    if (layout.lair) out.push({ id: layout.lair.sprite, x: layout.lair.x, y: layout.lair.y });
    out.push({ id: `prop.${b}.gate.${p.conquered ? 'open' : 'closed'}`, x: map.gate.x, y: map.gate.y + 4 });
    for (const c of map.critters) out.push({ id: c.id, x: c.x, y: c.y, wander: p.reduced ? 0 : c.wander });
    return out.sort((a, c) => a.y - c.y);
  }, [map, layout, b, p.conquered, p.reduced]);
  const night = nightLight(p.phase);
  const ambient = night > 0.5 ? def.ambient.night : def.ambient.day;
  return (
    <Group>
      <Graded matrix={worldMatrix(p.phase, { ascension: false, locked: false })}>
        <SpriteBatch atlas={b} items={ground} clock={clock} />
        <SpriteBatch atlas={b} items={path.edge} />
        <SpriteBatch atlas={b} items={path.fill} />
        <SpriteBatch atlas={b} items={things} clock={clock} />
      </Graded>
      <Lights items={map.lights} clock={clock} intensity={night} />
      {!p.reduced &&
        ambient.map((k) => <Particles key={k} kind={k} x={BAND_X - 8} y={map.top} w={BAND_W + 16} h={BIOME_H} count={k === 'fog' ? 10 : 18} clock={clock} intensity={k === 'fireflies' ? Math.max(0.5, night) : 1} />)}
      {layout.lair && <PhasePips x={layout.lair.x} y={map.gate.y - 82} cleared={layout.lair.node.progress.cleared} total={layout.lair.node.progress.total} />}
    </Group>
  );
});

/** A boss's phases above the lair: cleared ones gold, the rest dim. */
function PhasePips({ x, y, cleared, total }: { x: number; y: number; cleared: number; total: number }) {
  const w = total * 6 - 2;
  return (
    <Group>
      {Array.from({ length: total }, (_, i) => (
        <Group key={i}>
          <Rect x={x - w / 2 + i * 6 - 1} y={y - 1} width={6} height={6} color="#1c1a24" />
          <Rect x={x - w / 2 + i * 6} y={y} width={4} height={4} color={i < cleared ? '#f7da7a' : '#4a3a52'} />
        </Group>
      ))}
    </Group>
  );
}

/** The "+" at the path's start (a pixel plate); pulses gently on an empty realm. */
function Plus({ x, y, pulse, clock }: { x: number; y: number; pulse: boolean; clock: SharedValue<number> }) {
  const opacity = useDerivedValue(() => (pulse ? 0.7 + 0.3 * Math.round((Math.sin(clock.value / 300) + 1) * 2) / 4 : 1));
  return (
    <Group opacity={opacity}>
      <Rect x={x - 7} y={y - 7} width={14} height={14} color="#1c1a24" />
      <Rect x={x - 6} y={y - 6} width={12} height={12} color="#f3e6c4" />
      <Rect x={x - 1} y={y - 4} width={2} height={8} color="#74502f" />
      <Rect x={x - 4} y={y - 1} width={8} height={2} color="#74502f" />
    </Group>
  );
}
