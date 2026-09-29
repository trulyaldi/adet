// Dev preview: a small scene per biome from the generated sprites, to judge
// the art in context. `npx tsx scripts/preview-world.ts out.png`
import sharp from 'sharp';

import { BIOME_IDS } from '../src/domain/game/biomes';
import { PALETTES } from '../src/game/content/palettes';
import { ROSTER } from '../src/game/content/roster';
import { hex, mix, Px, rng } from './pixel/px';
import { generatePlaceholders } from './gen-placeholders';

const reg = generatePlaceholders();
const W = 130;
const H = 110;
function put(px: Px, id: string, x: number, y: number, f = 0) {
  const d = reg.sprites.get(id);
  if (!d) throw new Error('missing ' + id);
  const fr = d.frames[f % d.frames.length];
  const [ax, ay] = d.anchor ?? [Math.floor(fr.w / 2), fr.h];
  px.blit(fr, Math.round(x - ax), Math.round(y - ay));
}
const scenes = BIOME_IDS.map((b) => {
  const P = PALETTES[b];
  const px = new Px(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) px.set(x, y, mix(hex(P.sky[0]), hex(P.sky[1]), y / H));
  put(px, `parallax.${b}.far.a`, 0, 50);
  put(px, `parallax.${b}.far.b`, 100, 20);
  put(px, `parallax.${b}.cloud`, 90, 70);
  put(px, `parallax.${b}.cloud`, -10, 10);
  const x0 = 17;
  for (let ty = 0; ty < H; ty += 16) for (let tx = x0; tx < x0 + 96; tx += 16) put(px, `tile.${b}.ground.${'abc'[(tx * 7 + ty * 3) % 3]}`, tx, ty);
  for (let ty = 0; ty < H; ty += 16) {
    put(px, `tile.${b}.edge.l.${ty % 32 ? 'a' : 'b'}`, x0 - 8, ty);
    put(px, `tile.${b}.edge.r.${ty % 32 ? 'b' : 'a'}`, x0 + 96, ty);
  }
  const pathX = (y: number) => 65 + Math.sin(y / 18) * 26;
  for (const pass of ['edge', 'fill']) for (let y = -4; y < H + 4; y += 3) put(px, `tile.${b}.path.${pass}`, pathX(y), y);
  const r = rng(7);
  const objs: [string, number, number, number?][] = [
    [`decor.${b}.tree.a`, 28, 30],
    [`decor.${b}.tree.b`, 104, 44],
    [`decor.${b}.bush`, 40, 60],
    [`decor.${b}.rock`, 98, 90],
    [`decor.${b}.flowers`, 30, 92],
    [`decor.${b}.tuft`, 84, 16],
    [`decor.${b}.mushrooms`, 108, 72],
    [`decor.${b}.landmark`, 34, 108],
    [`tile.${b}.liquid`, 100, 100],
    [`decor.${b}.light`, 50, 40],
    [`prop.${b}.gate.closed`, 64, 22],
    [`prop.${b}.grave`, pathX(82), 84],
    [`prop.${b}.flag`, pathX(60) + 8, 60],
    [`mob.${b}.${ROSTER[b].mobs[0].key}.idle`, pathX(46), 48],
    [`mob.${b}.${ROSTER[b].mobs[1].key}.idle`, pathX(70) - 10, 76],
    [`villager.${b}.idle`, 88, 60],
    [`critter.${b}.${ROSTER[b].critters[0]}.idle`, 76, 96],
  ];
  objs.sort((a, c) => a[2] - c[2]).forEach(([id, x, y]) => put(px, id, x, y));
  void r;
  return px;
});
const sheet = new Px(W * 4 + 12, H * 2 + 4);
scenes.forEach((s, i) => sheet.blit(s, (i % 4) * (W + 4), Math.floor(i / 4) * (H + 4)));
const big = sheet.scale(3);
sharp(big.toRGBA(), { raw: { width: big.w, height: big.h, channels: 4 } }).png().toFile(process.argv[2] ?? 'world-preview.png');
