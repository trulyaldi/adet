// Dev preview: every biome's built map side by side (the real layouts,
// the real sprites). `npx tsx scripts/preview-map.ts out.png`
import sharp from 'sharp';

import { PALETTES } from '../src/game/content/palettes';
import { ROSTER, bossId, mobId } from '../src/game/content/roster';
import { BIOME_H, biomeMaps, WORLD_W } from '../src/game/content/biomes';
import { hex, mix, Px } from './pixel/px';
import { generatePlaceholders } from './gen-placeholders';

const reg = generatePlaceholders();
function put(px: Px, id: string, x: number, y: number, f = 0) {
  const d = reg.sprites.get(id.replace('@flip', ''));
  if (!d) throw new Error('missing ' + id);
  const fr = d.frames[f % d.frames.length];
  const [ax, ay] = d.anchor ?? [Math.floor(fr.w / 2), fr.h];
  px.blit(fr, Math.round(x - ax), Math.round(y - ay), { flipX: id.endsWith('@flip') });
}
const maps = biomeMaps();
const sheet = new Px(maps.length * (WORLD_W + 4), BIOME_H);
maps.forEach((m, i) => {
  const P = PALETTES[m.id];
  const px = new Px(WORLD_W, BIOME_H);
  for (let y = 0; y < BIOME_H; y++) for (let x = 0; x < WORLD_W; x++) px.set(x, y, mix(hex(P.sky[0]), hex(P.sky[1]), y / BIOME_H));
  const oy = -m.top;
  m.ground.forEach((row, r) => row.forEach((id, c) => id && put(px, id, 16 + c * 16, r * 16)));
  m.edges.forEach((e) => put(px, e.id, e.x, e.y + oy));
  for (const pass of ['edge', 'fill']) for (let k = 0; k < m.path.length; k += 2) put(px, `tile.${m.id}.path.${pass}`, m.path[k].x, m.path[k].y + oy);
  const things: { id: string; x: number; y: number }[] = [...m.decor, ...m.critters, ...m.villagers];
  m.nodes.forEach((n) => {
    if (n.kind === 'mob') things.push({ id: `${mobId(m.id, ROSTER[m.id].mobs[[0, 1, 2, -1, 1, 0, 2][n.index]].key)}.idle`, x: n.x, y: n.y });
    if (n.kind === 'camp') things.push({ id: 'prop.campfire.default.lit', x: n.x, y: n.y });
  });
  things.push({ id: `${bossId(m.id)}.idle`, x: m.gate.x, y: m.gate.y - 14 });
  things.push({ id: `prop.${m.id}.gate.closed`, x: m.gate.x, y: m.gate.y + 4 });
  things.sort((a, b) => a.y - b.y).forEach((t) => put(px, t.id, t.x, t.y + oy));
  sheet.blit(px, i * (WORLD_W + 4), 0);
});
const big = sheet.scale(2);
sharp(big.toRGBA(), { raw: { width: big.w, height: big.h, channels: 4 } }).png().toFile(process.argv[2] ?? 'map-preview.png');
