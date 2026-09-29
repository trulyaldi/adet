// Original placeholder art for every logical id, drawn in code from
// palette-indexed grids and shape recipes (no external art needed).
//
//   npx tsx scripts/gen-placeholders.ts [out.png]   → a contact sheet for review
//
// build-atlases.ts imports generatePlaceholders() and packs the result.

import sharp from 'sharp';

import { hex, Px } from './pixel/px';
import { Registry } from './art/registry';
import { addBosses } from './art/bosses';
import { addAvatar, addCritters, addNpcs, addPets, addVillagers } from './art/characters';
import { addMobs } from './art/mobs';
import { addProps } from './art/props';
import { addWorld } from './art/world';

export function generatePlaceholders(): Registry {
  const reg = new Registry();
  addMobs(reg);
  addBosses(reg);
  addAvatar(reg);
  addPets(reg);
  addNpcs(reg);
  addVillagers(reg);
  addCritters(reg);
  addWorld(reg);
  addProps(reg);
  return reg;
}

/** Every frame on a grid, scaled up, on a checker so outlines read. */
export async function contactSheet(reg: Registry, file: string, scale = 3, filter?: (id: string) => boolean): Promise<void> {
  const cells: { px: Px; id: string }[] = [];
  for (const def of reg.sprites.values()) {
    if (filter && !filter(def.id)) continue;
    for (const f of def.frames) cells.push({ px: f, id: def.id });
  }
  const cellW = Math.max(...cells.map((c) => c.px.w)) + 4;
  const cellH = Math.max(...cells.map((c) => c.px.h)) + 4;
  const cols = Math.max(1, Math.min(16, Math.floor(1600 / (cellW * scale))));
  const rows = Math.ceil(cells.length / cols);
  const sheet = new Px(cols * cellW, rows * cellH);
  const a = hex('#d8d4cc');
  const b = hex('#c8c4bc');
  for (let y = 0; y < sheet.h; y++) for (let x = 0; x < sheet.w; x++) sheet.set(x, y, ((x >> 2) + (y >> 2)) & 1 ? a : b);
  cells.forEach((c, i) => sheet.blit(c.px, (i % cols) * cellW + 2, Math.floor(i / cols) * cellH + 2));
  const big = sheet.scale(scale);
  await sharp(big.toRGBA(), { raw: { width: big.w, height: big.h, channels: 4 } }).png().toFile(file);
}

if (process.argv[1]?.endsWith('gen-placeholders.ts')) {
  const out = process.argv[2] ?? 'placeholders-preview.png';
  const filter = process.argv[3] ? (id: string) => id.startsWith(process.argv[3]) : undefined;
  contactSheet(generatePlaceholders(), out, Number(process.env.SCALE ?? 3), filter).then(() => console.log('wrote', out));
}
