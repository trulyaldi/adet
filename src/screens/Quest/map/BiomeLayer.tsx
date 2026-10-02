// One biome on the journey map: ground, the path, decor and everything that
// lives there, y-sorted so things overlap the right way. Beaten nodes show a
// grave (mobs) or a flag (the camp); the boss looms behind its gate, with its
// HP bar once it's the one being fought. Biomes not reached yet are dimmed
// and greyed, gate shut: nothing to do there yet, but lovely to look at.

import { Group, Rect } from '@shopify/react-native-skia';
import React, { memo, useMemo } from 'react';
import type { SharedValue } from 'react-native-reanimated';

import { NODE_MOBS } from '../../../domain/game/balance';
import type { DayPhase } from '../../../domain/game/daylight';
import { nightLight } from '../../../domain/game/daylight';
import type { NodeRef } from '../../../domain/game/derive';
import { BIOMES } from '../../../game/content/biomes';
import { BAND_W, BAND_X, BIOME_H, BiomeMap } from '../../../game/content/biomes/layout';
import { bossId, mobId, ROSTER } from '../../../game/content/roster';
import { Graded, Lights, worldMatrix } from '../../../game/render/Lighting';
import { Particles } from '../../../game/render/Particles';
import { BatchItem, SpriteBatch } from '../../../game/render/SpriteBatch';
import { tileItems } from '../../../game/render/Tilemap';
import { BiomeStatus, nodeState } from '../model';

export interface BiomeLayerProps {
  map: BiomeMap;
  status: BiomeStatus;
  position: NodeRef;
  /** HP of the node being fought (current biome). */
  hp: number;
  maxHp: number;
  bossMaxHp: number;
  phase: DayPhase;
  ascension: boolean;
  clock?: SharedValue<number>;
  reduced: boolean;
}

export const BiomeLayer = memo(function BiomeLayer(p: BiomeLayerProps) {
  const { map, status, position, clock } = p;
  const b = map.id;
  const def = BIOMES[b];
  const ground = useMemo(() => {
    const out: BatchItem[] = [...tileItems({ grid: map.ground, x: BAND_X, y: map.top }), ...map.edges];
    // The bottom island's rocky underside.
    if (map.index === 0) for (let x = BAND_X - 4; x <= BAND_X + BAND_W + 4; x += 9) out.push({ id: `decor.${b}.rock`, x, y: map.top + BIOME_H + 5 + ((x * 7) % 3) });
    return out;
  }, [map, b]);
  const path = useMemo(() => {
    const edge: BatchItem[] = [];
    const fill: BatchItem[] = [];
    for (let i = 0; i < map.path.length; i += 2) {
      edge.push({ id: `tile.${b}.path.edge`, x: map.path[i].x, y: map.path[i].y });
      fill.push({ id: `tile.${b}.path.fill`, x: map.path[i].x, y: map.path[i].y });
    }
    return { edge, fill };
  }, [map, b]);

  const bossActive = status === 'current' && position.node === 7;
  const bossLow = bossActive && p.maxHp > 0 && p.hp / p.maxHp < 0.3;

  // Everything standing on the island, sorted by feet.
  const things = useMemo(() => {
    const out: BatchItem[] = [...map.decor];
    map.nodes.forEach((n) => {
      const state: 'defeated' | 'active' | 'ahead' = status === 'past' ? 'defeated' : status === 'future' ? 'ahead' : nodeState(map.index, n.index, position);
      if (n.kind === 'mob') {
        const mob = ROSTER[b].mobs[Math.max(0, NODE_MOBS[n.index] as number)];
        if (state === 'defeated') out.push({ id: `prop.${b}.grave`, x: n.x, y: n.y });
        else out.push({ id: `${mobId(b, mob.key)}.idle`, x: n.x, y: n.y, flip: n.x > 64, phase: n.index });
      } else if (n.kind === 'camp') {
        out.push({ id: `prop.${b}.flag`, x: n.x + 8, y: n.y });
      }
    });
    if (status !== 'past') out.push({ id: `${bossId(b)}.${bossLow ? 'low' : 'idle'}`, x: map.gate.x, y: map.gate.y - 14 });
    out.push({ id: `prop.${b}.gate.${status === 'past' ? 'open' : 'closed'}`, x: map.gate.x, y: map.gate.y + 4 });
    for (const c of map.critters) out.push({ id: c.id, x: c.x, y: c.y, wander: p.reduced ? 0 : c.wander });
    for (const v of map.villagers) out.push({ id: v.id, x: v.x, y: v.y, flip: v.x > 64 });
    return out.sort((a, c) => a.y - c.y);
  }, [map, status, position, bossLow, b, p.reduced]);

  const night = nightLight(p.phase);
  const matrix = worldMatrix(p.phase, { ascension: p.ascension, locked: status === 'future' });
  const ambient = night > 0.5 ? def.ambient.night : def.ambient.day;

  // The Fog Wisp's fog thins as the forest is cleared and the Wisp weakens.
  const fog = useMemo(() => {
    if (b !== 'forest' || status === 'past' || position.loop > 0) return 0;
    if (status === 'future') return 0.8;
    const cleared = position.node / 7 + (bossActive && p.bossMaxHp > 0 ? (1 - p.hp / p.bossMaxHp) / 7 : 0);
    return Math.max(0, 0.75 * (1 - cleared));
  }, [b, status, position, bossActive, p.hp, p.bossMaxHp]);
  const fogItems = useMemo(() => Array.from({ length: 8 }, (_, i) => ({ id: 'fx.fog', x: BAND_X + (i % 3) * 40 + 8, y: map.top + 30 + i * 46 })), [map.top]);

  return (
    <Group>
      <Graded matrix={matrix}>
        <SpriteBatch atlas={b} items={ground} clock={clock} />
        <SpriteBatch atlas={b} items={path.edge} />
        <SpriteBatch atlas={b} items={path.fill} />
        <SpriteBatch atlas={b} items={things} clock={status === 'future' ? undefined : clock} />
      </Graded>
      {status !== 'future' && <Lights items={map.lights} clock={clock} intensity={night} />}
      {status !== 'future' && !p.reduced && clock &&
        ambient.map((k) => <Particles key={k} kind={k} x={BAND_X - 8} y={map.top} w={BAND_W + 16} h={BIOME_H} count={k === 'fog' ? 10 : 22} clock={clock} intensity={k === 'fireflies' ? Math.max(0.5, night) : 1} />)}
      {fog > 0 && (
        <Group opacity={fog}>
          <SpriteBatch atlas="shared" items={fogItems} />
        </Group>
      )}
      {bossActive && <WorldHP x={map.gate.x - 20} y={map.gate.y - 84} w={40} hp={p.hp} max={p.maxHp} />}
    </Group>
  );
});

/** A chunky HP bar drawn in the world (whole segments, ink border). */
export function WorldHP({ x, y, w, hp, max, segments = 10 }: { x: number; y: number; w: number; hp: number; max: number; segments?: number }) {
  const frac = max > 0 ? Math.max(0, Math.min(1, hp / max)) : 0;
  const filled = hp > 0 ? Math.max(1, Math.ceil(frac * segments)) : 0;
  const segW = Math.floor((w - 2) / segments);
  const inner = segW * segments;
  return (
    <Group>
      <Rect x={x} y={y} width={inner + 2} height={5} color="#1c1a24" />
      <Rect x={x + 1} y={y + 1} width={inner} height={3} color="#3a2a2e" />
      {Array.from({ length: filled }, (_, i) => (
        <Group key={i}>
          <Rect x={x + 1 + i * segW} y={y + 1} width={segW - 1} height={3} color="#e0504a" />
          <Rect x={x + 1 + i * segW} y={y + 1} width={segW - 1} height={1} color="#ff8a7a" />
        </Group>
      ))}
    </Group>
  );
}
