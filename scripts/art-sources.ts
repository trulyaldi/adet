// Every sprite the game ships, resolved once for the atlas build and the
// previews: licensed pack art from the registry (assets/game/packs/*.json)
// where it is mapped, else Adet's original stand-in art (gen-placeholders).
// Each id records where it came from, for the inventory and the tests.
//
// A pack sprite is cut from its sheet by tile index or rect, then optionally
// recoloured to a biome palette (nearest colour, so mixed packs share one
// colour language) and masked (an ellipse, for path blobs).

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

import type { BiomeId } from '../src/domain/game/biomes';
import { PALETTES } from '../src/game/content/palettes';
import { SpriteDef } from './art/registry';
import { generatePlaceholders } from './gen-placeholders';
import { loadRegistry, Pack, requirePack } from './packs';
import { alphaOf, Color, hex, Px, rgba } from './pixel/px';

export const TILE = 16;

export type Provenance =
  | { source: 'pack' | 'recolor' | 'composed'; pack: string; file: string }
  | { source: 'stand-in' };

/** Every colour of a biome's palette (the art bible's 16–24 per biome). */
export function paletteColors(biome: BiomeId): Color[] {
  const p = PALETTES[biome];
  const all = [p.outline, ...p.ground, ...p.path, ...p.foliage, ...p.trunk, ...p.rock, ...p.liquid, ...p.accentA, ...p.accentB, p.light];
  return [...new Set(all)].map((c) => hex(c));
}

/** Nearest palette colour for each opaque pixel (weighted RGB distance); alpha is kept. */
export function remapToPalette(px: Px, palette: Color[]): Px {
  const out = px.clone();
  const cache = new Map<Color, Color>();
  const pal = palette.map((c) => rgba(c));
  for (let y = 0; y < px.h; y++)
    for (let x = 0; x < px.w; x++) {
      const c = px.get(x, y);
      const a = alphaOf(c);
      if (!a) continue;
      const key = c | 0xff;
      let m = cache.get(key);
      if (m === undefined) {
        const [r, g, b] = rgba(c);
        let best = 0;
        let bestD = Infinity;
        pal.forEach(([pr, pg, pb], i) => {
          const d = 2 * (r - pr) ** 2 + 4 * (g - pg) ** 2 + 3 * (b - pb) ** 2;
          if (d < bestD) {
            bestD = d;
            best = i;
          }
        });
        m = palette[best];
        cache.set(key, m);
      }
      out.set(x, y, ((m & 0xffffff00) | a) >>> 0);
    }
  return out;
}

const luma = (c: Color) => {
  const [r, g, b] = rgba(c);
  return 0.299 * r + 0.587 * g + 0.114 * b;
};

/** Colours ranked by brightness onto part of a palette ramp (see MappedSprite.ramp). */
export function rampRemap(px: Px, biome: BiomeId, ramp: NonNullable<MappedSprite['ramp']>): Px {
  const target = (PALETTES[biome][ramp.name] as string[]).slice(ramp.from, ramp.to + 1).map((c) => hex(c));
  const colors = [...px.colors()].filter((c) => alphaOf(c)).map((c) => (c | 0xff) >>> 0);
  const ranked = [...new Set(colors)].sort((a, b) => luma(a) - luma(b));
  const table = new Map<Color, Color>(ranked.map((c, i) => [c, target[Math.min(target.length - 1, Math.floor((i / Math.max(1, ranked.length)) * target.length))]]));
  const out = px.clone();
  for (let y = 0; y < px.h; y++)
    for (let x = 0; x < px.w; x++) {
      const c = px.get(x, y);
      if (alphaOf(c)) out.set(x, y, ((table.get((c | 0xff) >>> 0)! & 0xffffff00) | alphaOf(c)) >>> 0);
    }
  return out;
}

export interface MappedSprite {
  sheet?: string;
  file?: string;
  /** Frames as tile indices in `sheet` (packed, 16 px, `cols` wide). */
  tiles?: number[];
  rects?: [number, number, number, number][];
  cols?: number;
  palette?: BiomeId;
  /**
   * Tone-preserving recolour: the sprite's colours, ranked dark → light, are
   * spread over this ramp of the biome palette (indices from..to), so a
   * two-tone pack tile keeps its contrast in the biome's own mid tones.
   */
  ramp?: { name: 'ground' | 'path' | 'foliage' | 'rock' | 'trunk'; from: number; to: number };
  mask?: { ellipse: [number, number, number, number] };
  /** Compose an animation from the first frame, moved by [dx, dy] per frame (a hop, a bounce). */
  offsets?: [number, number][];
  atlas?: string;
  anchor?: [number, number];
  fps?: number;
  loop?: boolean;
  source?: 'pack' | 'recolor' | 'composed';
  why?: string;
}

const images = new Map<string, Px>();
async function load(file: string): Promise<Px> {
  let img = images.get(file);
  if (!img) {
    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    img = Px.fromRGBA(info.width, info.height, data);
    images.set(file, img);
  }
  return img;
}

function crop(img: Px, [x, y, w, h]: [number, number, number, number]): Px {
  const f = new Px(w, h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) f.set(i, j, img.get(x + i, y + j));
  return f;
}

async function packFrames(pack: Pack, s: MappedSprite): Promise<{ frames: Px[]; file: string }> {
  const dir = requirePack(pack);
  const file = s.file ?? s.sheet;
  if (!file) throw new Error(`${pack.name}: a sprite needs a file or sheet`);
  const abs = path.join(dir, file);
  if (!fs.existsSync(abs)) throw new Error(`${pack.name}: ${file} not found`);
  const img = await load(abs);
  const cols = s.cols ?? Math.floor(img.w / TILE);
  const rects = s.rects ?? (s.tiles ?? []).map((t): [number, number, number, number] => [(t % cols) * TILE, Math.floor(t / cols) * TILE, TILE, TILE]);
  if (!rects.length) throw new Error(`${pack.name}: ${file}: no frames`);
  let frames = rects.map((r) => crop(img, r));
  if (s.mask) {
    const [cx, cy, rx, ry] = s.mask.ellipse;
    const w = Math.ceil(cx + rx) + 1;
    const h = Math.ceil(cy + ry) + 1;
    frames = frames.map((f) => {
      const out = new Px(w, h);
      out.ellipse(cx, cy, rx, ry, (x, y) => f.get(x % f.w, y % f.h));
      return out;
    });
  }
  if (s.offsets) {
    const base = frames[0];
    const up = Math.max(0, ...s.offsets.map(([, dy]) => -dy));
    frames = s.offsets.map(([dx, dy]) => new Px(base.w, base.h + up).blit(base, dx, up + dy));
  }
  if (s.palette && s.ramp) frames = frames.map((f) => rampRemap(f, s.palette!, s.ramp!));
  else if (s.palette) frames = frames.map((f) => remapToPalette(f, paletteColors(s.palette!)));
  return { frames, file };
}

/** Placeholder stand-ins, overridden by every mapped pack sprite. */
export async function resolveSprites(): Promise<{ defs: Map<string, SpriteDef>; provenance: Map<string, Provenance> }> {
  const defs = new Map(generatePlaceholders().sprites);
  const provenance = new Map<string, Provenance>([...defs.keys()].map((id) => [id, { source: 'stand-in' }]));
  for (const pack of loadRegistry()) {
    for (const [id, raw] of Object.entries(pack.sprites ?? {}) as [string, MappedSprite][]) {
      const { frames, file } = await packFrames(pack, raw);
      const prev = defs.get(id);
      defs.set(id, {
        id,
        atlas: raw.atlas ?? prev?.atlas ?? 'shared',
        frames,
        fps: raw.fps ?? (frames.length > 1 ? prev?.fps : 0),
        loop: raw.loop ?? prev?.loop,
        anchor: raw.anchor ?? (raw.mask ? prev?.anchor : undefined),
        flip: prev?.flip,
        flash: prev?.flash,
        additive: prev?.additive,
      });
      const source = raw.source ?? (raw.mask || raw.offsets ? 'composed' : raw.palette ? 'recolor' : 'pack');
      provenance.set(id, { source, pack: pack.name, file });
    }
  }
  return { defs, provenance };
}

/** Ids that would ship stand-in art without a needs-art.json entry (the build fails on any). */
export function unlistedStandIns(provenance: ReadonlyMap<string, Provenance>, needsArt: Record<string, string>): string[] {
  return [...provenance].filter(([id, p]) => p.source === 'stand-in' && !(id in needsArt)).map(([id]) => id);
}
