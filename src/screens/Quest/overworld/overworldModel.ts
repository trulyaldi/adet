// The Overworld's layout (World Mode, world-5): the 7 biome slots stacked
// bottom → top in biome order (slot 0, the forest, at the bottom), each a
// small island drawn from its palette, joined by a winding path. Pure and
// deterministic, so the map, the taps and the hero's walk all agree.

import { BIOME_IDS, BiomeId } from '../../../domain/game/biomes';
import type { SlotView } from '../../../domain/world/select';
import { PALETTES } from '../../../game/content/palettes';
import { WORLD_W } from '../../../game/content/biomes/layout';

/** One slot's band height, in game pixels. */
export const SLOT_H = 96;
/** Sky above the top slot (clear of the HUD) and below the bottom one. */
export const OW_HEAD = 44;
export const OW_FOOT = 24;
export const OW_H = OW_HEAD + SLOT_H * BIOME_IDS.length + OW_FOOT;
/** The island's half-size. */
const ISLAND_RX = 30;
const ISLAND_RY = 13;
/** Procedural tile size. */
export const CELL = 4;
/** The walk between realms never takes longer than this. */
export const TRAVEL_MAX_MS = 850;

export interface SlotSpot {
  slot: number;
  biome: BiomeId;
  /** The band's top edge. */
  top: number;
  /** The island's centre; the hero stands here. */
  x: number;
  y: number;
}

export interface Cells {
  color: string;
  /** Top-left corners, flat [x0, y0, x1, y1, …]. */
  xy: number[];
}

export interface OverworldLayout {
  slots: SlotSpot[];
  /** The path's dots between neighbouring slots, bottom → top. */
  path: { x: number; y: number }[];
  /** For each gap i (slot i → i + 1), the sampled points of its curve. */
  legs: { x: number; y: number }[][];
}

export function slotSpot(slot: number): SlotSpot {
  const top = OW_HEAD + (BIOME_IDS.length - 1 - slot) * SLOT_H;
  const x = Math.round(WORLD_W * (slot % 2 === 0 ? 0.36 : 0.64));
  return { slot, biome: BIOME_IDS[slot], top, x, y: top + Math.round(SLOT_H * 0.55) };
}

/** A gentle S between two islands (a quadratic bend), sampled every few pixels. */
function leg(a: SlotSpot, b: SlotSpot): { x: number; y: number }[] {
  const cx = a.slot % 2 === 0 ? WORLD_W * 0.2 : WORLD_W * 0.8;
  const cy = (a.y + b.y) / 2;
  const out: { x: number; y: number }[] = [];
  const n = 24;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    out.push({ x: Math.round(u * u * a.x + 2 * u * t * cx + t * t * b.x), y: Math.round(u * u * a.y + 2 * u * t * cy + t * t * b.y) });
  }
  return out;
}

export function overworldLayout(): OverworldLayout {
  const slots = BIOME_IDS.map((_, i) => slotSpot(i));
  const legs = slots.slice(0, -1).map((s, i) => leg(s, slots[i + 1]));
  // Dots off the islands themselves, every other sample.
  const path = legs.flatMap((l) => l.filter((p, i) => i % 2 === 0 && !slots.some((s) => onIsland(s, p.x, p.y, 4))));
  return { slots, path, legs };
}

function onIsland(s: SlotSpot, x: number, y: number, pad = 0): boolean {
  const dx = (x - s.x) / (ISLAND_RX + pad);
  const dy = (y - s.y) / (ISLAND_RY + pad);
  return dx * dx + dy * dy <= 1;
}

/** Hit-test a world point against the slots' bands (the whole band, so taps are generous). */
export function slotAt(y: number): number | null {
  const i = Math.floor((y - OW_HEAD) / SLOT_H);
  if (i < 0 || i >= BIOME_IDS.length) return null;
  return BIOME_IDS.length - 1 - i;
}

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

/**
 * One island as procedural pixel tiles in its biome's palette: a ragged
 * ellipse of ground (lighter on top), an outline, and a rock cliff under it.
 */
export function islandCells(s: SlotSpot): Cells[] {
  const pal = PALETTES[s.biome];
  const rand = mulberry(1013 + s.slot * 7919);
  const by = new Map<string, number[]>();
  const put = (color: string, x: number, y: number) => {
    const a = by.get(color) ?? [];
    a.push(x, y);
    by.set(color, a);
  };
  const x0 = s.x - ISLAND_RX - CELL * 2;
  const y0 = s.y - ISLAND_RY - CELL * 2;
  const cols = Math.ceil((ISLAND_RX * 2 + CELL * 4) / CELL);
  const rows = Math.ceil((ISLAND_RY * 2 + CELL * 4) / CELL);
  const inside: boolean[][] = [];
  for (let r = 0; r < rows; r++) {
    inside.push([]);
    for (let c = 0; c < cols; c++) {
      const cx = x0 + c * CELL + CELL / 2;
      const cy = y0 + r * CELL + CELL / 2;
      inside[r].push(onIsland(s, cx, cy, rand() < 0.3 ? 2 : -1));
    }
  }
  const at = (r: number, c: number) => r >= 0 && r < rows && c >= 0 && c < cols && inside[r][c];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = x0 + c * CELL;
      const y = y0 + r * CELL;
      if (!at(r, c)) {
        if (at(r - 1, c)) {
          // Under the rim: a rock cliff two cells deep, then the outline.
          put(pal.rock[1], x, y);
          put(at(r - 2, c) ? pal.rock[0] : pal.outline, x, y + CELL);
          put(pal.outline, x, y + CELL * 2);
        } else if (at(r + 1, c) || at(r, c - 1) || at(r, c + 1)) put(pal.outline, x, y);
        continue;
      }
      const rim = !at(r - 1, c);
      const n = rand();
      const color = rim ? pal.ground[3] : n < 0.18 ? pal.ground[1] : n < 0.8 ? pal.ground[2] : pal.ground[3];
      put(color, x, y);
    }
  }
  return [...by].map(([color, xy]) => ({ color, xy }));
}

/** The band's sky, top → bottom, in four steps between the palette's two sky colours. */
export function skySteps(b: BiomeId): string[] {
  const [a, c] = PALETTES[b].sky;
  return [0, 1 / 3, 2 / 3, 1].map((t) => mix(a, c, t));
}

function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`;
}

/** A few decor sprites on a claimed island (existing sprites only). */
export function islandDecor(s: SlotSpot): { id: string; x: number; y: number }[] {
  const b = s.biome;
  return [
    { id: `decor.${b}.tree.a`, x: s.x - 18, y: s.y - 2 },
    { id: `decor.${b}.tree.b`, x: s.x + 20, y: s.y },
    { id: `decor.${b}.bush`, x: s.x + 10, y: s.y + 8 },
    { id: `decor.${b}.rock`, x: s.x - 10, y: s.y + 9 },
  ];
}

/** Static clouds over an unclaimed island (Session 6 animates them). */
export function islandClouds(s: SlotSpot): { id: string; x: number; y: number }[] {
  const id = `parallax.${s.biome}.cloud`;
  return [
    { id, x: s.x - 38, y: s.y - 16 },
    { id, x: s.x - 2, y: s.y - 19 },
    { id, x: s.x - 28, y: s.y - 5 },
    { id, x: s.x + 2, y: s.y - 4 },
  ];
}

/** The slot the hero stands on: the stored one while it's claimed, else the lowest claimed slot. */
export function currentSlot(slots: readonly SlotView[], stored: number | null): number | null {
  if (stored !== null && slots[stored]?.realm) return stored;
  return slots.find((s) => s.realm)?.slot ?? null;
}

/** The lowest slot under cloud: the only one that offers a visible "+". */
export function nextClaimable(slots: readonly SlotView[]): number | null {
  return slots.find((s) => !s.realm)?.slot ?? null;
}

/** The hero's walk from one slot to another along the path, as flat [x0, y0, x1, y1, …]. */
export function route(layout: OverworldLayout, from: number, to: number): number[] {
  const out: number[] = [];
  const step = from < to ? 1 : -1;
  for (let i = from; i !== to; i += step) {
    const l = step > 0 ? layout.legs[i] : [...layout.legs[i - 1]].reverse();
    for (const p of l) out.push(p.x, p.y);
  }
  if (!out.length) out.push(layout.slots[to].x, layout.slots[to].y);
  return out;
}

/** How long the walk takes: a little per realm passed, never more than TRAVEL_MAX_MS. */
export function travelMs(from: number, to: number): number {
  return Math.min(TRAVEL_MAX_MS, 320 + 180 * Math.abs(to - from));
}

/** The point a fraction t (0–1) along a flat route. A worklet, so the token moves on the UI thread. */
export function along(pts: number[], t: number): { x: number; y: number } {
  'worklet';
  const n = pts.length / 2;
  if (n < 2) return { x: pts[0] ?? 0, y: pts[1] ?? 0 };
  const f = Math.max(0, Math.min(1, t)) * (n - 1);
  const i = Math.min(n - 2, Math.floor(f));
  const k = f - i;
  return { x: pts[i * 2] + (pts[i * 2 + 2] - pts[i * 2]) * k, y: pts[i * 2 + 1] + (pts[i * 2 + 3] - pts[i * 2 + 1]) * k };
}
