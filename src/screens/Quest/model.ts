// The map's model, pure: where the avatar stands, how each biome shows,
// where the travelling camp sets up, the reveal's walk, and tap targets.

import { NODES_PER_BIOME } from '../../domain/game/balance';
import { BIOME_COUNT } from '../../domain/game/biomes';
import { nodeAt, NodeRef } from '../../domain/game/derive';
import { BAND_W, BAND_X, BiomeMap, MapNode } from '../../game/content/biomes/layout';

export type BiomeStatus = 'past' | 'current' | 'future';

/** Each loop's own progress decides (the journey repeats the biomes on ascension). */
export function biomeStatus(biomeIndex: number, position: NodeRef): BiomeStatus {
  return biomeIndex < position.biomeIndex ? 'past' : biomeIndex === position.biomeIndex ? 'current' : 'future';
}

/** How a node shows on the map. */
export type NodeState = 'defeated' | 'active' | 'ahead';

export function nodeState(biomeIndex: number, node: number, position: NodeRef): NodeState {
  const cur = position.biomeIndex * NODES_PER_BIOME + position.node;
  const here = biomeIndex * NODES_PER_BIOME + node;
  return here < cur ? 'defeated' : here === cur ? 'active' : 'ahead';
}

/** Where the avatar stands to face a node: a little way back down the path. */
export function avatarSpot(map: BiomeMap, node: number): { x: number; y: number } {
  const n = map.nodes[node];
  if (n.kind === 'boss') return { x: map.gate.x, y: map.gate.y + 28 };
  let best = 0;
  let bd = Infinity;
  map.path.forEach((p, i) => {
    const d = Math.hypot(p.x - n.x, p.y - n.y);
    if (d < bd) {
      bd = d;
      best = i;
    }
  });
  // The path runs bottom → top, so earlier samples are below the node.
  const back = map.path[Math.max(0, best - 7)];
  return { x: Math.round(back.x), y: Math.round(back.y) };
}

/** The avatar's spot for a journey node (any loop). */
export function spotFor(maps: BiomeMap[], global: number): { x: number; y: number } {
  const n = nodeAt(global);
  return avatarSpot(maps[n.biomeIndex % BIOME_COUNT], n.node);
}

// ---------------------------------------------------------------------------
// The camp travels with the player.

export type CampThing = 'fire' | 'sage' | 'merchant' | 'scribe' | 'chests' | 'pet';

const CAMP: [CampThing, number, number][] = [
  ['fire', -20, 8],
  ['sage', -34, -2],
  ['scribe', -32, 18],
  ['merchant', 22, 2],
  ['chests', -8, 20],
  ['pet', 10, 6],
];

/** Camp pieces around the avatar, mirrored when the avatar stands near the island's left or right edge. */
export function campLayout(at: { x: number; y: number }): { thing: CampThing; x: number; y: number }[] {
  const mirror = at.x < BAND_X + 40 ? -1 : 1;
  return CAMP.map(([thing, dx, dy]) => {
    const x = Math.max(BAND_X + 8, Math.min(BAND_X + BAND_W - 8, at.x + dx * mirror));
    return { thing, x: Math.round(x), y: Math.round(at.y + dy) };
  });
}

// ---------------------------------------------------------------------------
// The reveal: walk from where the map was last seen to now.

export interface Reveal {
  /** Avatar waypoints (first = where it was). */
  points: { x: number; y: number }[];
  /** Node spots passed that were beaten (they pop into sparkles). */
  pops: { x: number; y: number; at: number }[];
  /** Milliseconds per step. */
  stepMs: number;
}

/** Longest the reveal may take. */
export const REVEAL_MAX_MS = 3600;

export function planReveal(maps: BiomeMap[], seen: number, now: number): Reveal | null {
  if (now <= seen) return null;
  // Very long gaps (years of history, a new device) jump to the last few nodes.
  const from = Math.max(seen, now - 12);
  const points: { x: number; y: number }[] = [];
  const pops: Reveal['pops'] = [];
  for (let g = from; g <= now; g++) {
    points.push(spotFor(maps, g));
    const n = nodeAt(g);
    if (g < now && n.kind !== 'camp') {
      const m = maps[n.biomeIndex % BIOME_COUNT].nodes[n.node];
      pops.push({ x: m.x, y: m.y, at: points.length - 1 });
    }
  }
  const steps = Math.max(1, points.length - 1);
  return { points, pops, stepMs: Math.min(700, Math.floor(REVEAL_MAX_MS / steps)) };
}

// ---------------------------------------------------------------------------
// Tap targets (world coordinates, at least 44 pt however small the sprite).

export interface Target {
  kind: 'node' | 'npc' | 'chests' | 'fire' | 'pet' | 'critter' | 'villager' | 'avatar' | 'gate';
  key: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Anything the tap handler needs. */
  data?: unknown;
}

/** A target centred above a feet anchor. */
export function targetAt(kind: Target['kind'], key: string, x: number, feetY: number, w: number, h: number, minPx: number, data?: unknown): Target {
  const W = Math.max(w, minPx);
  const H = Math.max(h, minPx);
  return { kind, key, x: x - W / 2, y: feetY - h / 2 - H / 2, w: W, h: H, data };
}

/** The target under a world point, preferring the nearest centre. */
export function hitTest(targets: Target[], x: number, y: number): Target | null {
  let best: Target | null = null;
  let bd = Infinity;
  for (const t of targets) {
    if (x < t.x || x > t.x + t.w || y < t.y || y > t.y + t.h) continue;
    const d = Math.hypot(t.x + t.w / 2 - x, t.y + t.h / 2 - y);
    if (d < bd) {
      bd = d;
      best = t;
    }
  }
  return best;
}

export type { MapNode };
