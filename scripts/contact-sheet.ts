// A contact sheet: every sprite of one biome (or the shared atlas) on the
// biome's palette, at 3×, labelled with its logical id and where it came
// from. Open the PNG and look for wrong scale, clipped frames, stray pixels,
// uneven baselines and off-palette colours.
//
//   npx tsx scripts/contact-sheet.ts <biome|shared> [out.png] [--compare]
//
// --compare puts the original stand-in above each sprite that now comes
// from a pack.

import sharp from 'sharp';

import { BIOME_IDS, BiomeId } from '../src/domain/game/biomes';
import { biomeIds, REQUIRED_IDS } from '../src/game/assets/manifest';
import { PALETTES } from '../src/game/content/palettes';
import { resolveSprites } from './art-sources';
import { generatePlaceholders } from './gen-placeholders';
import { hex, Px } from './pixel/px';

const SCALE = 3;
const PAD = 6;
const LABEL = 22;
const MAX_W = 360;

async function main() {
  const target = process.argv[2] ?? 'forest';
  const out = process.argv[3] && !process.argv[3].startsWith('--') ? process.argv[3] : `docs/quest/art/contact-${target}.png`;
  const compare = process.argv.includes('--compare');
  const isBiome = (BIOME_IDS as readonly string[]).includes(target);
  const biomeSet = new Set(BIOME_IDS.flatMap((b) => biomeIds(b)));
  const ids = (isBiome ? biomeIds(target as BiomeId) : REQUIRED_IDS.filter((id) => !biomeSet.has(id))).filter((id) => !id.includes('@'));
  const { defs, provenance } = await resolveSprites();
  const stand = generatePlaceholders().sprites;
  const pal = PALETTES[isBiome ? (target as BiomeId) : 'forest'];

  // Shelf layout in game pixels.
  const cells: { id: string; x: number; y: number; w: number; h: number }[] = [];
  let x = PAD;
  let y = PAD;
  let rowH = 0;
  for (const id of ids) {
    const d = defs.get(id);
    if (!d) continue;
    const f = d.frames;
    const pair = compare && provenance.get(id)?.source !== 'stand-in' && stand.get(id);
    const w = Math.max(f[0].w * f.length + (f.length - 1) * 2, 26);
    const h = f[0].h * (pair ? 2 : 1) + (pair ? 4 : 0);
    if (x + w > MAX_W) {
      x = PAD;
      y += rowH + LABEL / SCALE + PAD;
      rowH = 0;
    }
    cells.push({ id, x, y, w, h });
    x += w + PAD;
    rowH = Math.max(rowH, h);
  }
  const H = y + rowH + LABEL / SCALE + PAD;
  const sheet = new Px(MAX_W + PAD, Math.ceil(H));
  for (let j = 0; j < sheet.h; j++) for (let i = 0; i < sheet.w; i++) sheet.set(i, j, hex(((i >> 3) + (j >> 3)) % 2 ? pal.ground[1] : pal.ground[2]));
  const labels: string[] = [];
  for (const c of cells) {
    const d = defs.get(c.id)!;
    const pair = compare && provenance.get(c.id)?.source !== 'stand-in' ? stand.get(c.id) : undefined;
    let oy = c.y;
    if (pair) {
      pair.frames.forEach((f, i) => sheet.blit(f, c.x + i * (f.w + 2), oy));
      oy += pair.frames[0].h + 4;
    }
    d.frames.forEach((f, i) => sheet.blit(f, c.x + i * (f.w + 2), oy));
    const p = provenance.get(c.id)!;
    const tag = p.source === 'stand-in' ? 'stand-in' : `${p.source}:${p.pack.replace('kenney-', '')}`;
    const lx = c.x * SCALE;
    const ly = (c.y + c.h) * SCALE + 9;
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    labels.push(`<text x="${lx}" y="${ly}" font-size="9" font-family="monospace" fill="#fff" stroke="#000" stroke-width="2.5" paint-order="stroke">${esc(c.id)}</text>`);
    labels.push(`<text x="${lx}" y="${ly + 10}" font-size="8" font-family="monospace" fill="${p.source === 'stand-in' ? '#ffd27a' : '#9ef0a0'}" stroke="#000" stroke-width="2.5" paint-order="stroke">${esc(tag)}</text>`);
  }
  const big = sheet.scale(SCALE);
  const svg = `<svg width="${big.w}" height="${big.h}" xmlns="http://www.w3.org/2000/svg">${labels.join('')}</svg>`;
  await sharp(big.toRGBA(), { raw: { width: big.w, height: big.h, channels: 4 } })
    .composite([{ input: Buffer.from(svg) }])
    .png({ palette: true, compressionLevel: 9, effort: 10 })
    .toFile(out);
  const counts = new Map<string, number>();
  for (const c of cells) {
    const s = provenance.get(c.id)!.source;
    counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  console.log(`${out}: ${cells.length} sprites (${[...counts].map(([k, v]) => `${k} ${v}`).join(', ')})`);
}

Promise.resolve().then(main).catch((e) => {
  // A missing pack or a refused stand-in is a message, not a crash.
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
