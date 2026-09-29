// Rebuilds assets/game/needs-art.json: every sprite id that still ships Adet's
// stand-in art, with the reason for its category (what's needed, and which
// packs were searched). Run after mapping new pack art, so mapped ids drop
// out; an id no rule covers fails, so a new category gets a real reason.
//
//   npm run game:needs-art

import fs from 'node:fs';
import path from 'node:path';

import { resolveSprites } from './art-sources';
import { REQUIRED_IDS } from '../src/game/assets/manifest';
const SEARCHED = 'Searched: Kenney Tiny Dungeon, Tiny Town, Tiny Farm, Tiny Battle, Roguelike Characters, Roguelike RPG, 1-Bit, Micro Roguelike.';
const RULES: [RegExp, string][] = [
  [/^(boss|trophy)\./, 'Bosses are 64×64, drawn natively; no downloadable CC0 pack has bosses at this density and upscaling a 16 px sprite is not allowed. Needs e.g. Ninja Adventure\'s bosses (see docs/quest/art/MAPPING.md).'],
  [/^mob\./, 'Tiny Dungeon\'s ~8 generic monsters are single-frame and fit about 6 of the 21 named mobs; swapping those alone would mix two styles in one biome. Needs a 16 px creature set with 2–4 idle frames.'],
  [/^critter\./, 'Tiny Farm has farm animals (sheep, cow, chicken), not the biome critters (rabbits, frogs, lizards, foxes, birds). Needs small 16 px wildlife.'],
  [/^villager\./, 'Kenney\'s Tiny people are 16 px tall; the game\'s people are 20×26, so villagers must match the avatar\'s proportions.'],
  [/^avatar\./, 'The avatar is layered (body, 7 outfit tiers, head, back, hand) at 20×26. Tiny heroes are single 16×16 sprites; Roguelike Characters is layered but outline-free, which clashes with the dark-outlined world.'],
  [/^pet\./, 'No fox kit, owlet, slime or ember sprite companion in the Tiny packs.'],
  [/^npc\./, 'No owl (Aqyl), fox (Saudager) or tortoise (Hatshy) in any downloadable CC0 pack found.'],
  [/^tile\.[a-z]+\.edge\./, 'Island cliff edges (8×16): the Tiny tilesets are flat top-down tiles with no cliffs.'],
  [/^tile\.[a-z]+\.liquid$/, 'Animated water/lava/crystal (3 frames); the Tiny packs\' water is static, and one frame in place of an animation would be a regression.'],
  [/^decor\./, 'Tiny Town trees, bushes and mushrooms fit in 16×16, but the game\'s characters are 20×26: at one pixel density they\'d be shorter than people. Needs decor drawn at this game\'s proportions.'],
  [/^prop\.[a-z]+\.gate\./, '32×28 freestanding gates; Tiny Dungeon\'s doors are wall tiles, not gates.'],
  [/^prop\.[a-z]+\.grave$/, 'Tiny Dungeon\'s 16×16 headstone reads larger than the mobs beside it (tried in the Forest trial, reverted).'],
  [/^prop\.[a-z]+\.flag$/, 'Tiny Battle\'s flags belong to a modern military set.'],
  [/^parallax\./, 'No parallax skylines or clouds in the Tiny packs.'],
  [/^prop\.campfire\./, 'No campfire in the Tiny packs (and these are animated).'],
  [/^prop\.board$/, 'Tiny Town\'s signpost is one sign, not a notice board with pinned papers.'],
  [/^(prop\.shadow|fx\.)/, 'Simple generated effects (glows, dust, sparkles, fog, a pixel); the Tiny packs have no FX sprites.'],
  [/^icon\./, 'UI icons are one set: Kenney has a sword, coin, heart and lock but no XP, quill, freeze, rested, star or gear icons, and half a set would mix styles in one row.'],
];
(async () => {
  const { provenance } = await resolveSprites();
  const out: Record<string, string> = {};
  const unmatched: string[] = [];
  for (const id of [...provenance.keys()].sort()) {
    if (provenance.get(id)!.source !== 'stand-in') continue;
    const base = id.replace(/@(flip|flash)$/, '');
    const rule = RULES.find(([re]) => re.test(base));
    if (!rule) unmatched.push(id);
    else out[id] = `${rule[1]} ${SEARCHED}`;
  }
  if (unmatched.length) { console.error('no rule for', unmatched); process.exit(1); }
  fs.writeFileSync(path.join(__dirname, '../assets/game/needs-art.json'), JSON.stringify(out, null, 2) + '\n');
  const req = new Set(REQUIRED_IDS);
  console.log('needs-art', Object.keys(out).length, 'of which required ids', Object.keys(out).filter((k) => req.has(k)).length);
})();
