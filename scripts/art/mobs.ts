// The 21 mobs (16×16): fills authored as palette-indexed grids, outlined in
// the biome's outline colour, with idle, hurt and hit-flash frames.
//
// Grid legend: a b c = body ramp (dark → light); d e f = detail ramp;
// k = ink (eyes, mouth: the outline colour); w = eye white; g = glow;
// '.' = empty.

import { BIOME_IDS, BiomeId } from '../../src/domain/game/biomes';
import { PALETTES } from '../../src/game/content/palettes';
import { mobId, ROSTER } from '../../src/game/content/roster';
import { Color, hex, Px } from '../pixel/px';
import { Registry } from './registry';

type Grid = string[];

interface MobArt {
  /** Idle frame A. */
  a: Grid;
  /** Idle frame B; default: the upper body bobs down a pixel. */
  b?: Grid;
  /** Rows [from, to) that bob in the default frame B. */
  bob?: [number, number];
  body: 'accentA' | 'accentB' | 'foliage' | 'ground' | 'rock' | 'liquid' | 'path' | 'trunk';
  detail: 'accentA' | 'accentB' | 'foliage' | 'ground' | 'rock' | 'liquid' | 'path' | 'trunk';
  glow?: string;
  /** A body ramp of its own (dark → light) instead of a palette ramp. */
  ramp?: [string, string, string];
}

// ---------------------------------------------------------------------------

const SLIME: Grid = [
  '................',
  '................',
  '................',
  '.......f........',
  '......fef.......',
  '.......e.cc.....',
  '.....ccbbbbc....',
  '....cbbbbbbbb...',
  '...cbwkbbbwkbb..',
  '...bbkkbbbkkbb..',
  '..bbbbbbbbbbbbb.',
  '..bbbbbkkkbbbbb.',
  '..bbbbbbbbbbbbb.',
  '..abbbbbbbbbbba.',
  '...aaaaaaaaaaa..',
  '................',
];

const SPRITE_A: Grid = [
  '................',
  '..dd........dd..',
  '.deed......deed.',
  '.defed....defed.',
  '..deefd..dfeed..',
  '...deef..feed...',
  '.....ccccc......',
  '....cbbbbbc.....',
  '....bwkbwkb.....',
  '....bkkbkkb.....',
  '....abbkbba.....',
  '.....abbba......',
  '......aba.......',
  '.......a........',
  '................',
  '................',
];
const SPRITE_B: Grid = [
  '................',
  '................',
  '................',
  '..dd........dd..',
  '.deeffd..dffeed.',
  '..ddeef..feedd..',
  '.....ccccc......',
  '....cbbbbbc.....',
  '....bwkbwkb.....',
  '....bkkbkkb.....',
  '....abbkbba.....',
  '.....abbba......',
  '......aba.......',
  '.......a........',
  '................',
  '................',
];

const MUSHROOM: Grid = [
  '................',
  '................',
  '.....cccccc.....',
  '...ccbfbbbbcc...',
  '..cbbfffbbbfbc..',
  '..bbbbfbbbfffb..',
  '.bbfbbbbbbbfbbb.',
  '.aaaaaaaaaaaaaa.',
  '....deeeeeed....',
  '....ewkeewke....',
  '....ekkeekke....',
  '....eeekkeee....',
  '.....deeeed.....',
  '.....dd..dd.....',
  '.....dd..dd.....',
  '................',
];

const TOAD: Grid = [
  '................',
  '................',
  '................',
  '................',
  '....cc....cc....',
  '...cwkc..cwkc...',
  '...bkkbbbbkkb...',
  '..bbbbbbbbbbbb..',
  '.bbbbbbbbbbbbbb.',
  '.bkkkkkkkkkkkkb.',
  '.bbeeeeeeeeeebb.',
  '.abeeeeeeeeeeba.',
  '..aaeeeeeeeeaa..',
  '.aaa.aaaaaa.aaa.',
  '................',
  '................',
];

const WRAITH: Grid = [
  '................',
  '................',
  '......cccc......',
  '....ccbbbbcc....',
  '...cbbbbbbbbc...',
  '...bbwkbbwkbb...',
  '...bbkkbbkkbb...',
  '...bbbbbbbbbb...',
  '...bbbbkkbbbb...',
  '..dbbbbkkbbbbd..',
  '..ebbbbbbbbbbe..',
  '...bbbbbbbbbb...',
  '...abbabbabba...',
  '....a..ab..a....',
  '.......a........',
  '................',
];

const EEL: Grid = [
  '................',
  '...........g....',
  '..........ggg...',
  '..........fg....',
  '.........f......',
  '....ccccf.......',
  '...cbbbbbc......',
  '..cbwkbbbbb.....',
  '..bbkkbbbbbb....',
  '..bkkkbbeebbb...',
  '...aabbeeebbb...',
  '.....aaeebbbb.d.',
  '......abbbbbbdd.',
  '.......aabbbbd..',
  '.........aaaa...',
  '................',
];

const SCARAB: Grid = [
  '................',
  '................',
  '................',
  '................',
  '......cccc......',
  '....ccbbbbcc....',
  '...cbbbfbbbbc...',
  '..cbbbbfbbbbbc..',
  '..bbbbbfbbbbbb..',
  '.dbbbbbfbbbbbbd.',
  '.daaaaafaaaaaa..',
  '..eekkeeeeeee...',
  '.ewkkeeee.d.d...',
  '..ekkee.d.d.d...',
  '...d.d..........',
  '................',
];

const DEVIL_A: Grid = [
  '................',
  '..ccccccccccc...',
  '...cbbbbbbbbbc..',
  '...bbwkbbbwkb...',
  '....bkkbbbkkb...',
  '....bbbbkbbbb...',
  '.....aabbbbba...',
  '......abbbbb....',
  '.......aabbba...',
  '........abbb....',
  '.......ccbbb....',
  '........abba....',
  '.........bb.....',
  '........ab......',
  '.......dd.d.....',
  '......d..d......',
];
const DEVIL_B: Grid = [
  '................',
  '...ccccccccccc..',
  '..cbbbbbbbbbc...',
  '...bwkbbbwkbb...',
  '...bkkbbbkkbb...',
  '...bbbbkbbbb....',
  '...abbbbbaa.....',
  '....bbbbba......',
  '...abbbaa.......',
  '....bbba........',
  '....bbbcc.......',
  '....abba........',
  '.....bb.........',
  '......ba........',
  '.....d.dd.......',
  '......d..d......',
];

const CACTUS_GOLEM: Grid = [
  '................',
  '.......c........',
  '.....ccbcc......',
  '....cbbbbbc.....',
  '..c.bwkbwkb.c...',
  '.cb.bkkbkkb.bc..',
  '.bb.bbbbbbb.bb..',
  '.bbccbkkkbbcbb..',
  '..abbbbbbbbbba..',
  '....bbbbbbbb....',
  '....abbfbbba....',
  '....bbbbbfbb....',
  '....abbbbbba....',
  '....ddeeeedd....',
  '...ddeeeeeedd...',
  '................',
];

const BAT_A: Grid = [
  '................',
  '................',
  '.c............c.',
  '.cc....cc....cc.',
  '.bcc..cbbc..ccb.',
  '.bbbccbbbbccbbb.',
  '.bbbbbwkwkbbbbb.',
  '.abbbbkkkkbbbba.',
  '..abbbbkkbbbba..',
  '...aba.bb.aba...',
  '....a..ee..a....',
  '................',
  '................',
  '................',
  '................',
  '................',
];
const BAT_B: Grid = [
  '................',
  '................',
  '................',
  '.......cc.......',
  '......cbbc......',
  '....ccbbbbcc....',
  '...cbbwkwkbbc...',
  '..cbbbkkkkbbbc..',
  '.cbbbbbkkbbbbbc.',
  '.bbba..bb..abbb.',
  '.ba....ee....ab.',
  '.a............a.',
  '................',
  '................',
  '................',
  '................',
];

const ICE_GOLEM: Grid = [
  '................',
  '....f.....f.....',
  '...fe....fe.....',
  '...cccccccc.....',
  '..cbbbbbbbbc....',
  '..bbwkbbwkbb....',
  '..bbkkbbkkbb....',
  '..abbbbbbbba....',
  '.cc.cbbbbc.cc...',
  '.bbccbbbbbccbb..',
  '.ab.bbffbbb.ab..',
  '....bbbfbbbb....',
  '....aabbbbaa....',
  '....bb....bb....',
  '...aaa....aaa...',
  '................',
];

const WOLF: Grid = [
  '................',
  '................',
  '................',
  '..c.c...........',
  '..cbcc..........',
  '.cbbbbc.........',
  '.bwkbbb.........',
  'kbkkbbbcccccc...',
  '.bbbbbbbbbbbbc.c',
  '..eebbbbbbbbbbcb',
  '...eebbbbbbbbba.',
  '....abbbbbbbba..',
  '....ab.ab.ab.a..',
  '....ab.ab.ab.ab.',
  '....aa.aa.aa.aa.',
  '................',
];

const KNIGHT: Grid = [
  '................',
  '.....ddd........',
  '....deeed.......',
  '....cccccc......',
  '...cbbbbbbc.....',
  '...bkkkkkkb..f..',
  '...bbwbbwbb..f..',
  '...abbbbbba..f..',
  '..eeeeeeeeee.f..',
  '.edeeeeeeeeedf..',
  '.dd.eeeeeee.dd..',
  '....eeeeeee.....',
  '....dd..dd......',
  '....bb..bb......',
  '...aab..aab.....',
  '................',
];

const PAPER_GOLEM: Grid = [
  '................',
  '.....cccccc.....',
  '....cbbbbbbc....',
  '....bkkbbkkb....',
  '....bwkbbwkb....',
  '....bbbbbbbb....',
  '....bbkkkkbb....',
  '...cccccccccc...',
  '..cbbbbbbbbbbc..',
  '..bbaaaaaaaabb..',
  '..bbbbbbbbbbbb..',
  '..bbaaaaaaaabb..',
  '..bbbbbbbbbbbb..',
  '..abbbbbbbbbba..',
  '...ee......ee...',
  '................',
];

const CROW: Grid = [
  '................',
  '................',
  '......cccc......',
  '.....cbbbbc.....',
  '.....bwkbbb.....',
  '...ddbkkbbb.....',
  '...dddbbbbbc....',
  '......bbbbbbc...',
  '.....cbbbbbbbc..',
  '....cbbbbbbbbbc.',
  '....bbbbbbbbbba.',
  '.....abbbbbbaa..',
  '......abbbba....',
  '.......d..d.....',
  '......dd.dd.....',
  '................',
];

const SLUG: Grid = [
  '................',
  '................',
  '................',
  '................',
  '..c......c......',
  '..b......b......',
  '..cb....cb......',
  '..cbbbbbbbc.....',
  '..bwkbbbwkbc....',
  '..bkkbbbkkbbc...',
  '..bbbbbbbbbbbc..',
  '..bbbfbbbbfbbbc.',
  '..abbbbbfbbbbbb.',
  '...aaaaaaaaaaaa.',
  '................',
  '................',
];

const IMP: Grid = [
  '................',
  '................',
  '...d......d.....',
  '...dd....dd.....',
  '....cccccc......',
  '...cbbbbbbc.....',
  '...bwkbbwkb.....',
  '...bkkbbkkb.....',
  '...bbbkkbbb.....',
  '....abbbba......',
  '..c.bbbbbb.c....',
  '..bbbbbbbbbb....',
  '....bbbbbb..dd..',
  '....ab..ba...d..',
  '....aa..aa......',
  '................',
];

const MOTH_A: Grid = [
  '................',
  '....d......d....',
  '.....d....d.....',
  '.cc...cccc...cc.',
  'cfbc.cbbbbc.cbfc',
  'bffbcbwkwkbcbffb',
  'bfbbbbkkkkbbbbfb',
  '.bbbbbbbbbbbbbb.',
  '.abfbbbbbbbbfba.',
  '..abbbabbabbba..',
  '...aa..bb..aa...',
  '.......bb.......',
  '.......aa.......',
  '................',
  '................',
  '................',
];
const MOTH_B: Grid = [
  '................',
  '................',
  '....d......d....',
  '.....d.cc.d.....',
  '......cbbc......',
  '...ccbwkwkbcc...',
  '..cffbkkkkbffc..',
  '..bffbbbbbbffb..',
  '..bfbbbbbbbbfb..',
  '...abbabbabba...',
  '....a..bb..a....',
  '.......bb.......',
  '.......aa.......',
  '................',
  '................',
  '................',
];

const SENTINEL: Grid = [
  '................',
  '......gg........',
  '......dd........',
  '....cccccc......',
  '...cbbbbbbc.....',
  '...bkkggkkb.....',
  '...bbbbbbbb.....',
  '...abbbbbba.....',
  '..dddddddddd....',
  '.dcbbdeedbbcd...',
  '.dbbdeffedbbd...',
  '.dbbdeffedbbd...',
  '..abbdeedbba....',
  '...bb....bb.....',
  '..aaa....aaa....',
  '................',
];

// ---------------------------------------------------------------------------

type BiomeMobs = Record<string, MobArt>;

const ART: Record<BiomeId, BiomeMobs> = {
  forest: {
    slime: { a: SLIME, bob: [3, 13], body: 'foliage', detail: 'ground' },
    sprite: { a: SPRITE_A, b: SPRITE_B, body: 'accentA', detail: 'foliage' },
    imp: { a: MUSHROOM, bob: [2, 13], body: 'accentA', detail: 'path' },
  },
  swamp: {
    toad: { a: TOAD, bob: [4, 13], body: 'ground', detail: 'accentB' },
    wraith: { a: WRAITH, bob: [2, 15], body: 'accentA', detail: 'liquid' },
    eel: { a: EEL, bob: [1, 11], body: 'liquid', detail: 'accentA', glow: '#fff0b8' },
  },
  desert: {
    scarab: { a: SCARAB, bob: [4, 11], body: 'accentB', detail: 'rock' },
    devil: { a: DEVIL_A, b: DEVIL_B, body: 'ground', detail: 'rock' },
    golem: { a: CACTUS_GOLEM, bob: [1, 13], body: 'foliage', detail: 'accentA' },
  },
  frost: {
    bat: { a: BAT_A, b: BAT_B, body: 'liquid', detail: 'accentA' },
    golem: { a: ICE_GOLEM, bob: [1, 12], body: 'liquid', detail: 'ground' },
    wolf: { a: WOLF, bob: [3, 12], body: 'ground', detail: 'rock' },
  },
  iron: {
    knight: { a: KNIGHT, bob: [1, 12], body: 'rock', detail: 'accentA' },
    golem: { a: PAPER_GOLEM, bob: [1, 14], body: 'ground', detail: 'rock', ramp: ['#b8a888', '#e3d8bc', '#f7f1e0'] },
    crow: { a: CROW, bob: [2, 13], body: 'trunk', detail: 'accentB' },
  },
  volcano: {
    slug: { a: SLUG, bob: [4, 13], body: 'accentA', detail: 'liquid' },
    imp: { a: IMP, bob: [2, 13], body: 'rock', detail: 'accentA' },
    hound: { a: WOLF, bob: [3, 12], body: 'rock', detail: 'liquid' },
  },
  astral: {
    moth: { a: MOTH_A, b: MOTH_B, body: 'accentA', detail: 'accentB' },
    shade: { a: WRAITH, bob: [2, 15], body: 'ground', detail: 'liquid' },
    sentinel: { a: SENTINEL, bob: [1, 13], body: 'rock', detail: 'accentB', glow: '#8ff0f5' },
  },
};

// A few fixed colours so every mob's eyes read the same way.
const EYE_WHITE = '#fbf7ec';

function paint(grid: Grid, biome: BiomeId, art: MobArt): Px {
  const p = PALETTES[biome];
  const ramp3 = (r: string[]) => (r.length >= 3 ? r.slice(-3) : [r[0], r[r.length - 1], r[r.length - 1]]);
  const body = art.ramp ?? ramp3(p[art.body] as string[]);
  const detail = ramp3(p[art.detail] as string[]);
  const map: Record<string, Color> = {
    a: hex(body[0]),
    b: hex(body[1]),
    c: hex(body[2]),
    d: hex(detail[0]),
    e: hex(detail[1]),
    f: hex(detail[2]),
    k: hex(p.outline),
    w: hex(EYE_WHITE),
    g: hex(art.glow ?? p.light),
  };
  return new Px(16, 16).stamp(grid, map).outline(hex(p.outline));
}

/** Hurt: eyes squeezed shut (whites become body colour), knocked back a pixel. */
function hurtOf(grid: Grid): Grid {
  return grid.map((r) => r.replace(/w/g, 'k').replace(/k(?=k)/g, 'k'));
}

export function addMobs(reg: Registry): void {
  for (const biome of BIOME_IDS) {
    for (const mob of ROSTER[biome].mobs) {
      const art = ART[biome][mob.key];
      if (!art) throw new Error(`no art for ${biome}.${mob.key}`);
      const a = paint(art.a, biome, art);
      const b = art.b ? paint(art.b, biome, art) : paint(art.a, biome, art).shiftRows(art.bob?.[0] ?? 0, art.bob?.[1] ?? 16, 1);
      const id = mobId(biome, mob.key);
      reg.add({ id: `${id}.idle`, atlas: biome, frames: [a, b], fps: 4, loop: true, flip: true, flash: true });
      reg.add({ id: `${id}.hurt`, atlas: biome, frames: [paint(hurtOf(art.a), biome, art).shift(1, 0)], flash: true });
    }
  }
}
