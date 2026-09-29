// Packs every sprite into one atlas per biome plus `shared`, and writes the
// frame table the game reads by logical id.
//
//   npm run game:assets
//
// Sources, in order of preference:
//   1. Licensed packs in assets/game/raw/<pack>/, described by pack.json
//      (see assets/game/raw/README.md). A pack whose tile size isn't 16 px is
//      skipped (pixel densities are never mixed) and flagged in CREDITS.md.
//   2. Original placeholder art from gen-placeholders.ts, for every id no
//      pack provides.
//
// Outputs: src/game/assets/atlases/<atlas>.png, src/game/assets/frames.generated.ts,
// src/game/assets/atlasSources.ts and assets/game/CREDITS.md.

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

import { hex, Px } from './pixel/px';
import { SpriteDef } from './art/registry';
import { generatePlaceholders } from './gen-placeholders';

const ROOT = path.resolve(__dirname, '..');
const RAW = path.join(ROOT, 'assets/game/raw');
const OUT = path.join(ROOT, 'src/game/assets');
const ATLAS_DIR = path.join(OUT, 'atlases');
const TILE = 16;
const MAX_W = 1024;
const PAD = 1;

interface PackSprite {
  file: string;
  /** Frames as [x, y, w, h] in the file. */
  rects: [number, number, number, number][];
  fps?: number;
  loop?: boolean;
  anchor?: [number, number];
  atlas?: string;
}
interface PackJson {
  name: string;
  author: string;
  license: string;
  url: string;
  /** The pack's pixel density; only 16 is accepted. */
  tileSize: number;
  sprites: Record<string, PackSprite>;
}
interface PackReport {
  dir: string;
  pack: PackJson;
  used: number;
  skipped?: string;
}

const PERMISSIVE = /^(cc0|cc-by(-\d(\.\d)?)?|public domain|mit|ofl|apache-2\.0)$/i;

async function loadPacks(defs: Map<string, SpriteDef>): Promise<PackReport[]> {
  if (!fs.existsSync(RAW)) return [];
  const reports: PackReport[] = [];
  for (const dir of fs.readdirSync(RAW).sort()) {
    const file = path.join(RAW, dir, 'pack.json');
    if (!fs.existsSync(file)) continue;
    const pack = JSON.parse(fs.readFileSync(file, 'utf8')) as PackJson;
    if (pack.tileSize !== TILE) {
      reports.push({ dir, pack, used: 0, skipped: `pixel density ${pack.tileSize} px ≠ ${TILE} px` });
      continue;
    }
    let used = 0;
    for (const [id, sp] of Object.entries(pack.sprites ?? {})) {
      const src = path.join(RAW, dir, sp.file);
      if (!fs.existsSync(src)) continue;
      const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const img = Px.fromRGBA(info.width, info.height, data);
      const frames = sp.rects.map(([x, y, w, h]) => {
        const f = new Px(w, h);
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) f.set(i, j, img.get(x + i, y + j));
        return f;
      });
      const prev = defs.get(id);
      defs.set(id, {
        id,
        atlas: sp.atlas ?? prev?.atlas ?? 'shared',
        frames,
        fps: sp.fps ?? prev?.fps,
        loop: sp.loop ?? prev?.loop,
        anchor: sp.anchor ?? prev?.anchor,
        flip: prev?.flip,
        flash: prev?.flash,
        additive: prev?.additive,
      });
      used++;
    }
    reports.push({ dir, pack, used });
  }
  return reports;
}

interface Placed {
  key: string;
  px: Px;
  x: number;
  y: number;
}

/** Shelf packing: tallest first, rows left to right. */
function pack(frames: { key: string; px: Px }[]): { placed: Placed[]; w: number; h: number } {
  const sorted = [...frames].sort((a, b) => b.px.h - a.px.h || b.px.w - a.px.w || (a.key < b.key ? -1 : 1));
  const placed: Placed[] = [];
  let x = 0;
  let y = 0;
  let rowH = 0;
  let w = 0;
  for (const f of sorted) {
    if (x + f.px.w + PAD > MAX_W) {
      x = 0;
      y += rowH + PAD;
      rowH = 0;
    }
    placed.push({ key: f.key, px: f.px, x, y });
    x += f.px.w + PAD;
    rowH = Math.max(rowH, f.px.h);
    w = Math.max(w, x);
  }
  return { placed, w: Math.max(1, w), h: Math.max(1, y + rowH) };
}

const pow2 = (n: number) => 2 ** Math.ceil(Math.log2(Math.max(1, n)));

async function main() {
  const reg = generatePlaceholders();
  const defs = new Map(reg.sprites);
  const packs = await loadPacks(defs);

  // Expand variants (mirror, hit flash).
  const all = new Map<string, SpriteDef>();
  const white = hex('#ffffff');
  for (const d of defs.values()) {
    all.set(d.id, d);
    if (d.flip) all.set(`${d.id}@flip`, { ...d, id: `${d.id}@flip`, frames: d.frames.map((f) => f.flipX()), anchor: d.anchor ? [d.frames[0].w - d.anchor[0], d.anchor[1]] : undefined });
    if (d.flash) all.set(`${d.id}@flash`, { ...d, id: `${d.id}@flash`, frames: d.frames.map((f) => f.silhouette(white)) });
  }

  const byAtlas = new Map<string, SpriteDef[]>();
  for (const d of all.values()) {
    if (!byAtlas.has(d.atlas)) byAtlas.set(d.atlas, []);
    byAtlas.get(d.atlas)!.push(d);
  }

  fs.mkdirSync(ATLAS_DIR, { recursive: true });
  for (const f of fs.readdirSync(ATLAS_DIR)) if (f.endsWith('.png')) fs.unlinkSync(path.join(ATLAS_DIR, f));

  const sizes: Record<string, [number, number]> = {};
  const table: Record<string, unknown[]> = {};
  const atlases = [...byAtlas.keys()].sort((a, b) => (a === 'shared' ? -1 : b === 'shared' ? 1 : 0));
  for (const atlas of atlases) {
    const list = byAtlas.get(atlas)!;
    const frames = list.flatMap((d) => d.frames.map((px, i) => ({ key: `${d.id}#${i}`, px })));
    const { placed, w, h } = pack(frames);
    const W = pow2(w);
    const H = pow2(h);
    const sheet = new Px(W, H);
    const at = new Map<string, Placed>();
    for (const p of placed) {
      sheet.blit(p.px, p.x, p.y);
      at.set(p.key, p);
    }
    await sharp(sheet.toRGBA(), { raw: { width: W, height: H, channels: 4 } }).png({ compressionLevel: 9, palette: false }).toFile(path.join(ATLAS_DIR, `${atlas}.png`));
    sizes[atlas] = [W, H];
    for (const d of list.sort((a, b) => (a.id < b.id ? -1 : 1))) {
      const f0 = d.frames[0];
      const rects = d.frames.map((_, i) => {
        const p = at.get(`${d.id}#${i}`)!;
        return [p.x, p.y, p.px.w, p.px.h];
      });
      const [ax, ay] = d.anchor ?? [Math.floor(f0.w / 2), f0.h];
      // [atlas, frames, fps, loop, anchorX, anchorY, additive]
      table[d.id] = [atlas, rects, d.fps ?? 0, d.loop ? 1 : 0, ax, ay, d.additive ? 1 : 0];
    }
    console.log(`  ${atlas}: ${list.length} sprites, ${frames.length} frames → ${W}×${H}`);
  }

  const ids = Object.keys(table).sort();
  const lines = ids.map((id) => `  ${JSON.stringify(id)}: ${JSON.stringify(table[id])},`);
  fs.writeFileSync(
    path.join(OUT, 'frames.generated.ts'),
    `// Generated by scripts/build-atlases.ts (npm run game:assets). Do not edit.\n` +
      `// id → [atlas, frames [x, y, w, h][], fps, loop, anchorX, anchorY, additive]\n\n` +
      `export type AtlasName = ${atlases.map((a) => JSON.stringify(a)).join(' | ')};\n` +
      `export type RawSprite = [AtlasName, [number, number, number, number][], number, 0 | 1, number, number, 0 | 1];\n\n` +
      `export const ATLAS_SIZES: Record<AtlasName, [number, number]> = ${JSON.stringify(sizes)};\n\n` +
      `export const RAW_SPRITES: Record<string, RawSprite> = {\n${lines.join('\n')}\n};\n`
  );
  fs.writeFileSync(
    path.join(OUT, 'atlasSources.ts'),
    `// Generated by scripts/build-atlases.ts. The atlas images, for React Native\n// only (node tests import frames.generated.ts instead).\n\n` +
      `import type { AtlasName } from './frames.generated';\n\n` +
      `export const ATLAS_SOURCES: Record<AtlasName, number> = {\n${atlases.map((a) => `  ${JSON.stringify(a)}: require('./atlases/${a}.png'),`).join('\n')}\n};\n`
  );
  writeCredits(packs);
  console.log(`wrote ${ids.length} sprites in ${atlases.length} atlases`);
}

function writeCredits(packs: PackReport[]) {
  const rows = packs.map((r) => {
    const ok = PERMISSIVE.test(r.pack.license.trim());
    const flags = [r.skipped ? `**Excluded:** ${r.skipped}` : null, ok ? null : '⚠️ **License is not CC0/CC-BY/explicitly permissive — review before shipping**'].filter(Boolean).join(' · ');
    return `| ${r.pack.name} | ${r.pack.author} | ${r.pack.license} | ${r.pack.url} | ${r.skipped ? 0 : r.used} | ${flags || '—'} |`;
  });
  const md = `# Quest Mode art & audio credits

Generated by \`npm run game:assets\` (scripts/build-atlases.ts). Edit the packs'
\`pack.json\` files, not this table.

## Packs in \`assets/game/raw/\`

| Pack | Author | License | Source | Sprites used | Notes |
|---|---|---|---|---|---|
${rows.length ? rows.join('\n') : '| _none installed_ | | | | 0 | Every sprite is original placeholder art (below). |'}

Recommended primary pack: **Ninja Adventure** by Pixel-boy & AAA (CC0) —
https://pixel-boy.itch.io/ninja-adventure-asset-pack — 16 px, characters,
monsters, bosses, tilesets, UI, SFX and music. Kenney's CC0 packs
(https://kenney.nl/assets) may supplement it; only 16 px packs are used.
Biomes a pack doesn't cover (swamp, volcano, astral) use the generator's
palette-swapped art rather than mismatched density.

## Original art

Every sprite not provided by a pack is original pixel art drawn in code by
\`scripts/gen-placeholders.ts\` for Adet (palette-indexed grids and shape
recipes). Released with the app under the same terms as its source.

## Fonts

| Font | Author | License | Source |
|---|---|---|---|
| Pixelify Sans | Stefie Justprince | SIL Open Font License 1.1 | https://fonts.google.com/specimen/Pixelify+Sans |
| Silkscreen | Jason Kottke | SIL Open Font License 1.1 | https://fonts.google.com/specimen/Silkscreen |

## Sounds

Quest sound effects reuse Adet's own generated sounds (\`scripts/generate-sounds.js\`)
unless a pack's SFX are mapped in its \`pack.json\`.
`;
  fs.writeFileSync(path.join(ROOT, 'assets/game/CREDITS.md'), md);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
