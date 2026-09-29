// Dev preview: every rank tier composed from its layers, in every pose,
// plus each cosmetic on a knight. `npx tsx scripts/preview-avatar.ts out.png`
import sharp from 'sharp';

import { hex, Px } from './pixel/px';
import { generatePlaceholders } from './gen-placeholders';

const reg = generatePlaceholders();
const frame = (id: string, i: number) => reg.sprites.get(id)?.frames[i];
function compose(tier: number, pose: number, extra: string[] = []): Px {
  const px = new Px(20, 26);
  const layers = [
    ...extra.filter((e) => e.startsWith('avatar.banner') || e.startsWith('avatar.cloak')),
    `avatar.back.${tier}`,
    'avatar.body',
    `avatar.outfit.${tier}`,
    ...extra.filter((e) => e.startsWith('avatar.helmet')),
    extra.find((e) => e.startsWith('avatar.weapon')) ?? (tier === 0 ? 'avatar.weapon.staff' : 'avatar.weapon.basic'),
  ];
  for (const l of layers) {
    const f = frame(l, pose);
    if (f) px.blit(f, 0, 0);
  }
  return px;
}
const cells: Px[] = [];
for (let t = 0; t < 7; t++) for (let p = 0; p < 5; p++) cells.push(compose(t, p));
for (const e of ['avatar.cloak.moss', 'avatar.cloak.dusk', 'avatar.cloak.aurora', 'avatar.helmet.leaf', 'avatar.helmet.horned', 'avatar.helmet.star', 'avatar.banner.ember', 'avatar.banner.tide', 'avatar.weapon.oak', 'avatar.weapon.frost', 'avatar.weapon.sun'])
  cells.push(compose(2, 0, [e]));
const cols = 11;
const sheet = new Px(cols * 22, Math.ceil(cells.length / cols) * 28);
for (let y = 0; y < sheet.h; y++) for (let x = 0; x < sheet.w; x++) sheet.set(x, y, ((x >> 2) + (y >> 2)) & 1 ? hex('#d8d4cc') : hex('#c8c4bc'));
cells.forEach((c, i) => sheet.blit(c, (i % cols) * 22 + 1, Math.floor(i / cols) * 28 + 1));
const big = sheet.scale(5);
sharp(big.toRGBA(), { raw: { width: big.w, height: big.h, channels: 4 } }).png().toFile(process.argv[2] ?? 'avatar-preview.png');
