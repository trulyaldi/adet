// Turns a biome's hand-written definition into its map: the winding path,
// the eight nodes on it, ground tiles, and decor placed by a seeded scatter
// around hand-placed landmarks. Pure and deterministic (same map on every
// device, every build).

import { BIOME_IDS, BiomeId } from '../../../domain/game/biomes';
import { NODE_KINDS, NODES_PER_BIOME } from '../../../domain/game/balance';
import type { ParticleKind } from '../../render/Particles';

/** The journey's coordinate space, in game pixels. */
export const WORLD_W = 128;
/** The walkable island, centred. */
export const BAND_X = 16;
export const BAND_W = 96;
export const BIOME_H = 400;
export const TILE = 16;
export const WORLD_H = BIOME_H * BIOME_IDS.length;

export interface Placed {
  id: string;
  x: number;
  y: number;
}

export interface BiomeDef {
  id: BiomeId;
  /** Where the path bends, bottom → top, as x within the band (0–1). */
  bends: number[];
  /** Hand-placed landmarks and set pieces (x, y relative to the biome's top-left). */
  landmarks: Placed[];
  /** How many of each decor piece to scatter. */
  scatter: Partial<Record<string, number>>;
  /** Liquid pools (relative). */
  pools: { x: number; y: number }[];
  /** Light sources (relative): the sprite is decor.<biome>.light, glow added. */
  lights: { x: number; y: number }[];
  critters: { name: string; x: number; y: number; wander: number }[];
  villagers: { x: number; y: number; line: number }[];
  ambient: { day: ParticleKind[]; night: ParticleKind[] };
  /** Parallax scroll factors for clouds and far shapes. */
  parallax: [number, number];
  lore: string[];
  boss: { before: [string, string, string]; defeat: string };
}

export interface MapNode {
  index: number;
  kind: (typeof NODE_KINDS)[number];
  x: number;
  y: number;
}

export interface BiomeMap {
  id: BiomeId;
  index: number;
  /** World y of the biome's top edge (biome 0, the forest, is at the bottom). */
  top: number;
  path: { x: number; y: number }[];
  nodes: MapNode[];
  gate: { x: number; y: number };
  ground: (string | null)[][];
  edges: Placed[];
  decor: Placed[];
  lights: Placed[];
  critters: (Placed & { wander: number })[];
  villagers: (Placed & { line: string })[];
}

// ---------------------------------------------------------------------------

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

/** Catmull-Rom through the points, sampled every ~2 px of height. */
export function spline(pts: { x: number; y: number }[]): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const steps = Math.max(2, Math.ceil(Math.abs(p2.y - p1.y) / 2));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push({ x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) });
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

/** Points `n` evenly spaced by arc length along a polyline, excluding the ends' margins. */
export function alongPath(path: { x: number; y: number }[], n: number, from: number, to: number) {
  const cum = [0];
  for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y));
  const total = cum[cum.length - 1];
  const out: { x: number; y: number }[] = [];
  for (let k = 0; k < n; k++) {
    const d = total * (from + ((to - from) * k) / (n - 1));
    let i = 1;
    while (i < cum.length - 1 && cum[i] < d) i++;
    const seg = cum[i] - cum[i - 1] || 1;
    const t = (d - cum[i - 1]) / seg;
    out.push({ x: path[i - 1].x + (path[i].x - path[i - 1].x) * t, y: path[i - 1].y + (path[i].y - path[i - 1].y) * t });
  }
  return out;
}

const distToPath = (path: { x: number; y: number }[], x: number, y: number) => {
  let best = Infinity;
  for (const p of path) best = Math.min(best, Math.hypot(p.x - x, p.y - y));
  return best;
};

export function buildBiome(def: BiomeDef): BiomeMap {
  const index = BIOME_IDS.indexOf(def.id);
  const top = (BIOME_IDS.length - 1 - index) * BIOME_H;
  const bottom = top + BIOME_H;
  const bx = (f: number) => BAND_X + 8 + f * (BAND_W - 16);

  // The path enters at the bottom (from the previous biome's gate) and climbs
  // to this biome's gate at the top.
  const pts = [{ x: WORLD_W / 2, y: bottom + 6 }, ...def.bends.map((f, i) => ({ x: bx(f), y: bottom - ((i + 1) * (BIOME_H - 100)) / (def.bends.length + 1) - 12 })), { x: WORLD_W / 2, y: top + 86 }];
  const path = spline(pts);
  const gate = { x: WORLD_W / 2, y: top + 80 };
  // Nodes 0–6 spaced along the path; the boss (7) waits at the gate.
  const spots = alongPath(path, NODES_PER_BIOME - 1, 0.12, 0.88);
  const nodes: MapNode[] = NODE_KINDS.map((kind, i) => ({
    index: i,
    kind,
    x: Math.round(i === NODES_PER_BIOME - 1 ? gate.x : spots[i].x),
    y: Math.round(i === NODES_PER_BIOME - 1 ? gate.y + 14 : spots[i].y),
  }));

  // Ground: the band in tiles, with variants by hash.
  const cols = BAND_W / TILE;
  const rows = BIOME_H / TILE;
  const ground: (string | null)[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: (string | null)[] = [];
    for (let c = 0; c < cols; c++) {
      const h = hash(`${def.id}:${r}:${c}`) % 10;
      row.push(`tile.${def.id}.ground.${h < 6 ? 'a' : h < 9 ? 'b' : 'c'}`);
    }
    ground.push(row);
  }
  const edges: Placed[] = [];
  for (let r = 0; r < rows; r++) {
    const v = hash(`${def.id}:edge:${r}`) % 2 ? 'a' : 'b';
    edges.push({ id: `tile.${def.id}.edge.l.${v}`, x: BAND_X - 8, y: top + r * TILE });
    edges.push({ id: `tile.${def.id}.edge.r.${v === 'a' ? 'b' : 'a'}`, x: BAND_X + BAND_W, y: top + r * TILE });
  }

  // Decor: landmarks first, then a seeded scatter that keeps off the path,
  // the nodes and each other.
  const rnd = mulberry(hash(def.id));
  const taken: { x: number; y: number; r: number }[] = [];
  const free = (x: number, y: number, r: number) =>
    distToPath(path, x, y) > r + 7 &&
    nodes.every((n) => Math.hypot(n.x - x, n.y - y) > r + 12) &&
    Math.hypot(gate.x - x, gate.y - y) > r + 22 &&
    taken.every((t) => Math.hypot(t.x - x, t.y - y) > r + t.r);
  const decor: Placed[] = [];
  const place = (id: string, x: number, y: number, r: number) => {
    decor.push({ id, x: Math.round(x), y: Math.round(y) });
    taken.push({ x, y, r });
  };
  for (const l of def.landmarks) place(l.id.startsWith('decor.') || l.id.startsWith('prop.') ? l.id : `decor.${def.id}.${l.id}`, l.x, top + l.y, 14);
  for (const p of def.pools) place(`tile.${def.id}.liquid`, p.x, top + p.y, 9);
  for (const l of def.lights) place(`decor.${def.id}.light`, l.x, top + l.y, 5);
  const radius: Record<string, number> = { 'tree.a': 10, 'tree.b': 8, bush: 7, rock: 6, flowers: 4, tuft: 3, mushrooms: 5 };
  for (const [name, count] of Object.entries(def.scatter)) {
    for (let k = 0, tries = 0; k < (count ?? 0) && tries < 400; tries++) {
      const r = radius[name] ?? 5;
      const x = BAND_X + r + rnd() * (BAND_W - 2 * r);
      const y = top + 14 + rnd() * (BIOME_H - 20);
      if (!free(x, y, r)) continue;
      place(`decor.${def.id}.${name}`, x, y, r);
      k++;
    }
  }
  decor.sort((a, b) => a.y - b.y);

  const lights: Placed[] = [
    ...def.lights.map((l) => ({ id: 'fx.glow.warm', x: l.x, y: top + l.y - 8 })),
    ...def.pools.map((p) => ({ id: def.id === 'volcano' ? 'fx.glow.warm' : 'fx.glow.cool', x: p.x, y: top + p.y - 4 })),
  ];
  const critters = def.critters.map((c) => ({ id: `critter.${def.id}.${c.name}.idle`, x: c.x, y: top + c.y, wander: c.wander }));
  const villagers = def.villagers.map((v) => ({ id: `villager.${def.id}.idle`, x: v.x, y: top + v.y, line: def.lore[v.line % def.lore.length] }));
  return { id: def.id, index, top, path, nodes, gate, ground, edges, decor, lights, critters, villagers };
}

/** Words in a line (the ≤12-word rule for NPC and lore lines). */
export const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
