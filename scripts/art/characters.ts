// The avatar (layered: back, body, outfit tier, helmet, hand), companions,
// NPCs, villagers and critters. Layers share one 20×26 frame and one set of
// poses, so gear composes without clipping.
//
// Poses: idle0/idle1 (breath), walk0/walk1 (a foot lifts), kneel (rank-up).

import { BIOME_IDS, BiomeId } from '../../src/domain/game/biomes';
import { PALETTES, SHARED } from '../../src/game/content/palettes';
import { ROSTER } from '../../src/game/content/roster';
import { Color, hex, Px } from '../pixel/px';
import { Registry } from './registry';

type Grid = string[];
export const AVATAR_W = 20;
export const AVATAR_H = 26;
export const POSES = ['idle0', 'idle1', 'walk0', 'walk1', 'kneel'] as const;
export type Pose = (typeof POSES)[number];

/** How far the upper body sinks in each pose. */
const SINK: Record<Pose, number> = { idle0: 0, idle1: 1, walk0: 0, walk1: 1, kneel: 3 };
/** Rows at and below this are legs (they don't sink). */
const LEGS_FROM = 20;
const INK = hex(SHARED.outline);

const pad20 = (g: Grid) => g.map((r) => r.padEnd(AVATAR_W, '.'));

// ---------------------------------------------------------------------------
// Body

const BODY: Grid = pad20([
  '....................',
  '....................',
  '....................',
  '.......hhhhhh.......',
  '......hhhhhhhh......',
  '......hhhhhhhh......',
  '......hsssssHh......',
  '......ssssssss......',
  '......ssksskss......',
  '......ssssssss......',
  '......uSsssssu......',
  '.......Sssssu.......',
  '........tttt........',
  '......cccccccc......',
  '.....cccccccccc.....',
  '.....cccccccccc.....',
  '.....cccccccccc.....',
  '.....cccccccccc.....',
  '.....sccccccccs.....',
  '......pppppppp......',
]);

const LEGS: Record<Pose, Grid> = {
  idle0: ['.......pp..pp.......', '.......pp..pp.......', '.......pp..pp.......', '......bbb..bbb......'],
  idle1: ['.......pp..pp.......', '.......pp..pp.......', '.......pp..pp.......', '......bbb..bbb......'],
  walk0: ['.......pp..pp.......', '.......pp..pp.......', '......bbb..pp.......', '...........bbb......'],
  walk1: ['.......pp..pp.......', '.......pp..pp.......', '.......pp..bbb......', '......bbb...........'],
  kneel: ['....................', '....................', '......pppppppp......', '.....bbbb....bbb....'],
};

function bodyMap(skin = SHARED.skin, hair = SHARED.hair, shirt = SHARED.cloth): Record<string, Color> {
  return {
    h: hex(hair[1]),
    H: hex(hair[2]),
    s: hex(skin[1]),
    S: hex(skin[0]),
    u: hex(skin[2]),
    t: hex(skin[0]),
    k: INK,
    c: hex(shirt[1]),
    p: hex(SHARED.leather[0]),
    b: hex(SHARED.leather[1]),
  };
}

/** A layer grid in a pose: rows above the legs sink; `legs` replaces the leg rows. */
function posed(grid: Grid, pose: Pose, map: Record<string, Color>, legs?: Grid): Px {
  const px = new Px(AVATAR_W, AVATAR_H);
  const upper = grid.slice(0, LEGS_FROM);
  px.stamp(upper, map, 0, SINK[pose]);
  const lower = grid.slice(LEGS_FROM);
  if (legs) px.stamp(legs, map, 0, LEGS_FROM + (pose === 'kneel' ? 0 : 0));
  else if (lower.length) px.stamp(lower, map, 0, LEGS_FROM);
  return px.outline(INK);
}

/** A cape behind the body, wider than it so it shows at the sides: `t` trim, `m` main, `h` hem. */
function cape(t: string, m: string, h: string, extra: Grid = []): Grid {
  const rows = [
    `.....${t.repeat(10)}.....`,
    `....${t}${m.repeat(10)}${t}....`,
    `...${t}${m.repeat(12)}${t}...`,
    `...${m.repeat(14)}...`,
    `...${m.repeat(14)}...`,
    `...${m.repeat(14)}...`,
    `..${m.repeat(16)}..`,
    `..${m.repeat(16)}..`,
    `..${m.repeat(16)}..`,
    `..${m}${h}${m.repeat(12)}${h}${m}..`,
    `...${h}..${h.repeat(8)}..${h}...`,
  ];
  const top = extra.length ? extra : Array(12).fill('');
  return pad20([...top.slice(0, 12), ...rows]);
}

// ---------------------------------------------------------------------------
// Outfits by rank tier (front layer, drawn over the body)

interface Outfit {
  front: Grid;
  back?: Grid;
  map: Record<string, Color>;
}

const r3 = (r: [string, string, string]) => ({ a: hex(r[0]), b: hex(r[1]), c: hex(r[2]) });

const OUTFITS: Outfit[] = [
  // 0 Traveller's cloak: a hooded mantle.
  {
    front: pad20([
      ...Array(12).fill(''),
      '.......abbbba.......',
      '.....abbbbbbbba.....',
      '....abbbbbbbbbba....',
      '....abbbbgbbbbba....',
      '....aabbbbbbbbaa....',
      '.....aa......aa.....',
    ]),
    back: pad20([...Array(4).fill(''), '.....a........a.....', '.....ab......ba.....', '.....ab......ba.....', '.....ab......ba.....', '.....abb....bba.....', '......abbbbbba......']),
    map: { ...r3(SHARED.leather), g: hex(SHARED.gold[2]) },
  },
  // 1 Squire tabard.
  {
    front: pad20([
      ...Array(13).fill(''),
      '.......bbwwbb.......',
      '.......bbwwbb.......',
      '......abbwwbba......',
      '.......bbwwbb.......',
      '.......bbwwbb.......',
      '......ddddgddd......',
      '.......abwwba.......',
    ]),
    map: { ...r3(SHARED.blue), w: hex(SHARED.white), d: hex(SHARED.leather[1]), g: hex(SHARED.gold[1]) },
  },
  // 2 Knight armour: plate and pauldrons.
  {
    front: pad20([
      ...Array(13).fill(''),
      '....ccb.cccc.bcc....',
      '....bba.bccb.abb....',
      '.....a.abccba.a.....',
      '.......abbbba.......',
      '.......abbbba.......',
      '......ddddgddd......',
      '.......aabbaa.......',
    ]),
    map: { ...r3(SHARED.metal), d: hex(SHARED.leather[1]), g: hex(SHARED.gold[1]) },
  },
  // 3 Captain's cape: plate, gold trim, a red cape behind.
  {
    front: pad20([
      ...Array(13).fill(''),
      '....ccbgccccgbcc....',
      '....bba.bccb.abb....',
      '.....a.abccba.a.....',
      '.......abgbba.......',
      '.......abbbba.......',
      '......ggggdggg......',
      '.......aabbaa.......',
    ]),
    back: cape('r', 'R', 'r'),
    map: { ...r3(SHARED.metal), d: hex(SHARED.red[1]), g: hex(SHARED.gold[1]), r: hex(SHARED.red[2]), R: hex(SHARED.red[1]) },
  },
  // 4 Warden's lantern: moss-steel with a lantern at the belt.
  {
    front: pad20([
      ...Array(13).fill(''),
      '....ccb.cccc.bcc....',
      '....bba.bccb.abb....',
      '.....a.abccba.a.....',
      '.......abbbba.......',
      '.......abbbba.l.....',
      '......ddddgddLLL....',
      '.......aabbaaLlL....',
      '.............LLL....',
    ]),
    back: cape('f', 'F', 'f'),
    map: { a: hex('#2f4a42'), b: hex('#4f6e62'), c: hex('#86a898'), d: hex(SHARED.leather[1]), g: hex(SHARED.gold[1]), L: hex(SHARED.gold[0]), l: hex('#fff3a0'), f: hex(SHARED.green[1]), F: hex(SHARED.green[0]) },
  },
  // 5 Lord's crown: royal plate and a mantle.
  {
    front: pad20([
      '.......g.gg.g.......',
      '.......gggggg.......',
      '.......gGgGgg.......',
      ...Array(10).fill(''),
      '....ccbgccccgbcc....',
      '....bba.bccb.abb....',
      '.....a.abgcba.a.....',
      '.......abbbba.......',
      '.......agbbga.......',
      '......ggggGggg......',
      '.......aabbaa.......',
    ]),
    back: cape('w', 'p', 'w'),
    map: { a: hex(SHARED.purple[0]), b: hex(SHARED.purple[1]), c: hex(SHARED.purple[2]), g: hex(SHARED.gold[1]), G: hex(SHARED.red[2]), w: hex(SHARED.white), p: hex(SHARED.purple[1]) },
  },
  // 6 Legend's aura: gold plate in a ring of light.
  {
    front: pad20([
      '.......g.gg.g.......',
      '.......gggggg.......',
      '.......gGgGgg.......',
      ...Array(10).fill(''),
      '....ccbgccccgbcc....',
      '....bba.bccb.abb....',
      '.....a.abwcba.a.....',
      '.......abbbba.......',
      '.......awbbwa.......',
      '......ggggwggg......',
      '.......aabbaa.......',
    ]),
    back: cape('w', 'W', 'w', [
      '........llll........',
      '......ll....ll......',
      '.....l........l.....',
      '....l..........l....',
      '....l..........l....',
      '...l............l...',
      '...l............l...',
      '...l............l...',
      '....l..........l....',
      '....l..........l....',
      '.....l........l.....',
      '....................',
    ]),
    map: { a: hex(SHARED.gold[0]), b: hex(SHARED.gold[1]), c: hex(SHARED.gold[2]), g: hex(SHARED.gold[2]), G: hex(SHARED.blue[2]), w: hex(SHARED.white), W: hex('#e8e0c8'), l: hex('#fff6c0') },
  },
];

// ---------------------------------------------------------------------------
// Cosmetics

const CLOAK: Grid = cape('a', 'b', 'c');

const CLOAK_ICON: Grid = ['...aaaaaa...', '..abbggbba..', '.abbbbbbbba.', '.abbbbbbbba.', '.abbbbbbbba.', 'abbbbbbbbbba', 'abbbbbbbbbba', 'abcbbbbbbcba', 'acbbcbbcbbca', '.a..aaaa..a.'];

const CLOAKS: Record<string, [string, string, string]> = {
  'cloak.moss': ['#2f5a3a', '#4a8a4e', '#86c070'],
  'cloak.dusk': ['#2a2550', '#4a3f86', '#8a7ad0'],
  'cloak.aurora': ['#3a8a8a', '#6fd0c0', '#f0b8d8'],
};

const HELMETS: Record<string, { grid: Grid; map: Record<string, Color> }> = {
  'helmet.leaf': {
    grid: pad20(['.........ff.........', '........fef.........', '.......aabbaa.......', '......abbbbbba......', '......bbbbbbbb......', '......a......a......']),
    map: { a: hex('#2f5a3a'), b: hex('#4a8a4e'), e: hex('#2f5a3a'), f: hex('#86c070') },
  },
  'helmet.horned': {
    grid: pad20(['....c..........c....', '....cb........bc....', '.....cbaaaaaabc.....', '......abbbbbba......', '......bbccbbbb......', '......abbbbbba......', '......a......a......']),
    map: { a: hex(SHARED.metal[0]), b: hex(SHARED.metal[1]), c: hex('#f3ead8') },
  },
  'helmet.star': {
    grid: pad20(['.........g..........', '........ggg.........', '.........g..........', '....................', '....................', '......aabbbbaa......']),
    map: { a: hex(SHARED.gold[0]), b: hex(SHARED.gold[1]), g: hex('#fff6c0') },
  },
};

const BANNERS: Record<string, [string, string]> = {
  'banner.ember': ['#c8401a', '#ff8a2a'],
  'banner.tide': ['#24406a', '#3a8ad0'],
};
const BANNER: Grid = pad20([
  '...w................',
  'aabp................',
  'abbp................',
  'abbp................',
  'abbp................',
  '.abp................',
  '..ap................',
  '...p................',
  '...p................',
  '...p................',
  '...p................',
  '...p................',
  '...p................',
  '...p................',
  '...p................',
  '...p................',
  '...p................',
  '...p................',
  '...p................',
  '...p................',
]);

const WEAPON: Grid = pad20([
  ...Array(8).fill(''),
  '................c...',
  '...............cb...',
  '...............cb...',
  '...............cb...',
  '...............cb...',
  '...............cb...',
  '...............cb...',
  '...............cb...',
  '..............gggg..',
  '...............hh...',
  '...............hh...',
]);
const STAFF: Grid = pad20([
  ...Array(7).fill(''),
  '...............ee...',
  '...............ed...',
  '...............d....',
  '...............d....',
  '...............d....',
  '...............d....',
  '...............d....',
  '...............d....',
  '...............d....',
  '...............d....',
  '...............d....',
  '...............d....',
]);
const WEAPONS: Record<string, [string, string, string]> = {
  'weapon.basic': [SHARED.metal[1], SHARED.metal[2], SHARED.leather[1]],
  'weapon.oak': ['#8f6a40', '#c9a46c', '#4a3024'],
  'weapon.frost': ['#6fa8d8', '#d4f1ff', '#3f6fa8'],
  'weapon.sun': ['#d9a53a', '#fff0b0', '#9a6a1a'],
};

// ---------------------------------------------------------------------------

export function addAvatar(reg: Registry): void {
  const bmap = bodyMap();
  const byPose = (fn: (pose: Pose) => Px) => POSES.map(fn);
  reg.add({ id: 'avatar.body', atlas: 'shared', frames: byPose((p) => posed([...BODY, ...LEGS[p]], p, bmap, LEGS[p])), anchor: [10, 24] });

  OUTFITS.forEach((o, tier) => {
    reg.add({ id: `avatar.outfit.${tier}`, atlas: 'shared', frames: byPose((p) => posed(o.front, p, o.map)), anchor: [10, 24] });
    if (o.back) reg.add({ id: `avatar.back.${tier}`, atlas: 'shared', frames: byPose((p) => posed(o.back!, p, o.map)), anchor: [10, 24] });
  });

  for (const [sku, r] of Object.entries(CLOAKS)) {
    reg.add({ id: `avatar.${sku}`, atlas: 'shared', frames: byPose((p) => posed(CLOAK, p, r3(r))), anchor: [10, 24] });
    reg.add({ id: `icon.gear.${sku}`, atlas: 'shared', frames: [new Px(16, 16).stamp(CLOAK_ICON, { ...r3(r), g: hex(SHARED.gold[1]) }, 2, 2).outline(INK)] });
  }
  for (const [sku, h] of Object.entries(HELMETS)) {
    reg.add({ id: `avatar.${sku}`, atlas: 'shared', frames: byPose((p) => posed(h.grid, p, h.map)), anchor: [10, 24] });
    reg.add({ id: `icon.gear.${sku}`, atlas: 'shared', frames: [iconOf(posed(h.grid, 'idle0', h.map))] });
  }
  for (const [sku, [a, b]] of Object.entries(BANNERS)) {
    const map = { a: hex(a), b: hex(b), p: hex(SHARED.wood[1]), w: hex(SHARED.gold[2]) };
    reg.add({ id: `avatar.${sku}`, atlas: 'shared', frames: byPose((p) => posed(BANNER, p, map)), anchor: [10, 24] });
    reg.add({ id: `icon.gear.${sku}`, atlas: 'shared', frames: [iconOf(posed(BANNER, 'idle0', map))] });
  }
  for (const [sku, [b, c, h]] of Object.entries(WEAPONS)) {
    const map = { b: hex(b), c: hex(c), g: hex(SHARED.gold[1]), h: hex(h) };
    reg.add({ id: `avatar.${sku}`, atlas: 'shared', frames: byPose((p) => posed(WEAPON, p, map)), anchor: [10, 24] });
    if (sku !== 'weapon.basic') reg.add({ id: `icon.gear.${sku}`, atlas: 'shared', frames: [iconOf(posed(WEAPON, 'idle0', map))] });
  }
  const staffMap = { d: hex(SHARED.wood[1]), e: hex(SHARED.wood[2]) };
  reg.add({ id: 'avatar.weapon.staff', atlas: 'shared', frames: byPose((p) => posed(STAFF, p, staffMap)), anchor: [10, 24] });
  // The ascension star pip.
  reg.add({ id: 'avatar.pip', atlas: 'shared', frames: [new Px(5, 5).stamp(['..a..', '.aba.', 'abbba', '.aba.', '..a..'], { a: hex(SHARED.gold[1]), b: hex('#fff6c0') })] });
}

/** A gear piece cropped to 16×16 for shop and sheet icons. */
function iconOf(px: Px): Px {
  const b = px.bounds();
  if (!b) return new Px(16, 16);
  const out = new Px(16, 16);
  const ox = Math.round((16 - Math.min(16, b.w)) / 2) - b.x;
  const oy = Math.round((16 - Math.min(16, b.h)) / 2) - b.y;
  return out.blit(px, ox, oy);
}

// ---------------------------------------------------------------------------
// Companions (12×12)

const PETS: Record<string, { a: Grid; b: Grid; map: Record<string, Color> }> = {
  'pet.fox': {
    a: ['............', '..a...a.....', '..aa.aa.....', '..bbbbb.....', '..bkbkb..cc.', '..bbwbb.cbc.', '...bbbbbbc..', '...bbbbbb...', '...b.b.b.b..', '............', '............', '............'],
    b: ['............', '..a...a.....', '..aa.aa.....', '..bbbbb..cc.', '..bkbkb.cbc.', '..bbwbb.bc..', '...bbbbbb...', '...bbbbbb...', '....b.b.b.b.', '............', '............', '............'],
    map: { a: hex('#c8601a'), b: hex('#f08a3a'), c: hex('#fff3e0'), k: INK, w: hex('#fff3e0') },
  },
  'pet.owlet': {
    a: ['............', '..a.....a...', '..abbbbba...', '..bwkbwkb...', '..bkkbkkb...', '..bbbcbbb...', '..abbbbba...', '..abdddba...', '...bbbbb....', '...c...c....', '............', '............'],
    b: ['............', '............', '..a.....a...', '..abbbbba...', '..bbbbbbb...', '..bkkbkkb...', '..bbbcbbb...', '..abdddba...', '...bbbbb....', '...c...c....', '............', '............'],
    map: { a: hex('#6f4a34'), b: hex('#a07a4a'), c: hex('#f2c45a'), d: hex('#dcc59a'), k: INK, w: hex('#fbf7ec') },
  },
  'pet.slime': {
    a: ['............', '............', '............', '....cccc....', '...cbbbbc...', '..cbwkbwkb..', '..bbkkbkkb..', '..bbbbbbbb..', '..abbbbbba..', '...aaaaaa...', '............', '............'],
    b: ['............', '............', '............', '............', '....cccc....', '..cbbbbbbc..', '..bwkbbwkb..', '.bbkkbbkkbb.', '.abbbbbbbba.', '..aaaaaaaa..', '............', '............'],
    map: { a: hex('#2f8a86'), b: hex('#4fc4b8'), c: hex('#a8f0e0'), k: INK, w: hex('#fbf7ec') },
  },
  'pet.ember': {
    a: ['.....c......', '....cb......', '....cbc.....', '...cbbbc....', '...bbbbbc...', '..cbkbkbc...', '..bbkbkbb...', '..abbbbba...', '...abbba....', '....aaa.....', '............', '............'],
    b: ['......c.....', '.....bc.....', '....cbc.....', '...cbbbc....', '..cbbbbb....', '..cbkbkbc...', '..bbkbkbb...', '..abbbbba...', '...abbba....', '....aaa.....', '............', '............'],
    map: { a: hex('#c8401a'), b: hex('#ff8a2a'), c: hex('#ffd35a'), k: INK },
  },
};

export function addPets(reg: Registry): void {
  for (const [sku, p] of Object.entries(PETS)) {
    const f = (g: Grid) => new Px(12, 12).stamp(g, p.map).outline(INK);
    reg.add({ id: `${sku}.idle`, atlas: 'shared', frames: [f(p.a), f(p.b)], fps: 3, loop: true, flip: true });
  }
}

// ---------------------------------------------------------------------------
// NPCs (16×16)

const NPC_ART: Record<string, { idle: Grid; blink: Grid; talk: Grid; map: Record<string, Color> }> = {
  sage: {
    // Aqyl the Owl, spectacles and all, on a stump.
    idle: ['................', '...a........a...', '...aabbbbbbaa...', '...bbbbbbbbbb...', '..bwwwbbbbwwwb..', '..bwkggbbgkwgb..', '..bwwwbccbwwwb..', '..abbbbccbbbba..', '..abddbbbbddba..', '..abddddddddba..', '...abddddddba...', '....bbbbbbbb....', '.....c....c.....', '...eeeeeeeeee...', '...effffffffe...', '....eeeeeeee....'],
    blink: ['................', '...a........a...', '...aabbbbbbaa...', '...bbbbbbbbbb...', '..bbbbbbbbbbbb..', '..bgkkgbbgkkgb..', '..bbbbbccbbbbb..', '..abbbbccbbbba..', '..abddbbbbddba..', '..abddddddddba..', '...abddddddba...', '....bbbbbbbb....', '.....c....c.....', '...eeeeeeeeee...', '...effffffffe...', '....eeeeeeee....'],
    talk: ['................', '...a........a...', '...aabbbbbbaa...', '...bbbbbbbbbb...', '..bwwwbbbbwwwb..', '..bwkggbbgkwgb..', '..bwwwbkkbwwwb..', '..abbbbccbbbba..', '..abddbbbbddba..', '..abddddddddba..', '...abddddddba...', '....bbbbbbbb....', '.....c....c.....', '...eeeeeeeeee...', '...effffffffe...', '....eeeeeeee....'],
    map: { a: hex('#4a3a30'), b: hex('#8a6a4e'), d: hex('#dcc59a'), w: hex('#fbf7ec'), k: INK, g: hex(SHARED.gold[1]), c: hex('#f2b43a'), e: hex(SHARED.wood[0]), f: hex(SHARED.wood[1]) },
  },
  merchant: {
    // Saudager the Fox with a pack of wares.
    idle: ['................', '..a.....a.......', '..aa...aa.......', '..abbbbba..dddd.', '..bkbbbkb.deeeed', '..bbbwbbb.deggde', '..wbbkbbw.deeeed', '...wwwww..deggde', '...ccccccdeeeed.', '..ccccccccdddd..', '..bcccccccb.....', '...cccccc..ff...', '...bb..bb.ff....', '...aa..aa.......', '................', '................'],
    blink: ['................', '..a.....a.......', '..aa...aa.......', '..abbbbba..dddd.', '..bbbbbbb.deeeed', '..bkbwbkb.deggde', '..wbbkbbw.deeeed', '...wwwww..deggde', '...ccccccdeeeed.', '..ccccccccdddd..', '..bcccccccb.....', '...cccccc..ff...', '...bb..bb.ff....', '...aa..aa.......', '................', '................'],
    talk: ['................', '..a.....a.......', '..aa...aa.......', '..abbbbba..dddd.', '..bkbbbkb.deeeed', '..bbbwbbb.deggde', '..wbkkkbw.deeeed', '...wwwww..deggde', '...ccccccdeeeed.', '..ccccccccdddd..', '..bcccccccb.....', '...cccccc..ff...', '...bb..bb.ff....', '...aa..aa.......', '................', '................'],
    map: { a: hex('#a8481a'), b: hex('#f08a3a'), w: hex('#fff3e0'), k: INK, c: hex(SHARED.green[1]), d: hex(SHARED.leather[0]), e: hex(SHARED.leather[1]), g: hex(SHARED.gold[1]), f: hex(SHARED.gold[2]) },
  },
  scribe: {
    // Hatshy the Tortoise, scroll and quill in hand.
    idle: ['................', '................', '..........q.....', '....bbb..q......', '...bkbbb.q......', '...bbbbbq.......', '....bbbwwww.....', '..ddddwwpppw....', '.deeeddwwwww....', 'deffeeeddd......', 'deeeeeeeeed.....', '.deffeeffed.....', '..dddddddd......', '..bb....bb......', '................', '................'],
    blink: ['................', '................', '..........q.....', '....bbb..q......', '...bbbbb.q......', '...bkkbbq.......', '....bbbwwww.....', '..ddddwwpppw....', '.deeeddwwwww....', 'deffeeeddd......', 'deeeeeeeeed.....', '.deffeeffed.....', '..dddddddd......', '..bb....bb......', '................', '................'],
    talk: ['................', '................', '..........q.....', '....bbb..q......', '...bkbbb.q......', '...bbkkbq.......', '....bbbwwww.....', '..ddddwwpppw....', '.deeeddwwwww....', 'deffeeeddd......', 'deeeeeeeeed.....', '.deffeeffed.....', '..dddddddd......', '..bb....bb......', '................', '................'],
    map: { b: hex('#86a860'), k: INK, d: hex('#3f5a2f'), e: hex('#5f7f3f'), f: hex('#a8c070'), w: hex(SHARED.paper[2]), p: hex(SHARED.paper[0]), q: hex(SHARED.white) },
  },
};

export function addNpcs(reg: Registry): void {
  for (const [id, a] of Object.entries(NPC_ART)) {
    const f = (g: Grid) => new Px(16, 16).stamp(g, a.map).outline(INK);
    // Idle: mostly still with a blink; talk: mouth/beak open.
    reg.add({ id: `npc.${id}.idle`, atlas: 'shared', frames: [f(a.idle), f(a.idle), f(a.idle), f(a.blink)], fps: 3, loop: true, flip: true });
    reg.add({ id: `npc.${id}.talk`, atlas: 'shared', frames: [f(a.idle), f(a.talk)], fps: 6, loop: true, flip: true });
  }
}

// ---------------------------------------------------------------------------
// Villagers: the body with a tunic and hat in each biome's colours.

const TUNIC: Grid = pad20([...Array(13).fill(''), '......aabbbbaa......', '.....abbbbbbbba.....', '.....abbbccbbba.....', '.....abbbbbbbba.....', '......abbbbbba......', '.....sabbbbbbas.....', '......dddddddd......']);
const HATS: Grid[] = [
  pad20(['....................', '....................', '.......aaaaaa.......', '......abbbbbba......', '....aabbbbbbbbaa....', '....................']),
  pad20(['..........c.........', '.........cc.........', '........abba........', '.......abbbba.......', '......abbbbbba......', '....................']),
];

export function addVillagers(reg: Registry): void {
  BIOME_IDS.forEach((biome, i) => {
    const P = PALETTES[biome];
    const skin = i % 2 ? ['#6a4430', '#a8704a', '#d8a078'] as [string, string, string] : SHARED.skin;
    const bm = bodyMap(skin, SHARED.hair, SHARED.cloth);
    const tm = { a: hex(P.accentA[0]), b: hex(P.accentA[1]), c: hex(P.accentB[2]), d: hex(SHARED.leather[1]), s: hex(skin[1]) };
    const hm = { a: hex(P.accentB[0]), b: hex(P.accentB[1]), c: hex(P.light) };
    const hat = HATS[i % HATS.length];
    const frames = (['idle0', 'idle1'] as Pose[]).map((p) => {
      const px = posed([...BODY, ...LEGS[p]], p, bm, LEGS[p]);
      px.blit(posed(TUNIC, p, tm), 0, 0);
      px.blit(posed(hat, p, hm), 0, 0);
      return px;
    });
    reg.add({ id: `villager.${biome}.idle`, atlas: biome, frames, fps: 2, loop: true, flip: true, anchor: [10, 24] });
  });
}

// ---------------------------------------------------------------------------
// Critters (10×8): idle and a hop.

const CRITTERS: Record<string, { idle: Grid; hop: Grid; map: (b: BiomeId) => Record<string, Color> }> = {
  rabbit: {
    idle: ['..a.a.....', '..a.a.....', '..bbb.....', '.bkbbb....', '.bbbbbbb..', '..bbbbbbc.', '..b.b.b...', '..........'],
    hop: ['..........', '.a.a......', '.a.a......', '.bbb......', 'bkbbbbb...', '.bbbbbbbc.', '...b...b..', '..........'],
    map: () => ({ a: hex('#c8b8a8'), b: hex('#e8dccf'), c: hex('#ffffff'), k: INK }),
  },
  bird: {
    idle: ['..........', '..........', '...bb.....', '..bkbb....', 'cbbbbbb...', '..bbbbbbb.', '...a.a....', '..........'],
    hop: ['..........', '..........', '.aa.bb.aa.', '..abkbba..', 'cbbbbbb...', '...bbbb...', '..........', '..........'],
    map: () => ({ a: hex('#3a6aa8'), b: hex('#7ab0e0'), c: hex('#f2c45a'), k: INK }),
  },
  frog: {
    idle: ['..........', '..........', '..b..b....', '.bkbbkb...', '.bbbbbbb..', 'abbccbbba.', 'a.a..a.a..', '..........'],
    hop: ['..........', '..b..b....', '.bkbbkb...', '.bbbbbbb..', '.bbccbbb..', 'a.......a.', 'a.......a.', '..........'],
    map: (b) => ({ a: hex(PALETTES[b].foliage[0]), b: hex(PALETTES[b].foliage[2]), c: hex('#e8e0a0'), k: INK }),
  },
  firefly: {
    idle: ['..........', '..........', '....g.....', '...gGg....', '....g.....', '..........', '..........', '..........'],
    hop: ['..........', '..........', '..........', '....G.....', '..........', '..........', '..........', '..........'],
    map: () => ({ g: hex('#f3e07a', 160), G: hex('#fff8c0') }),
  },
  lizard: {
    idle: ['..........', '..........', '..........', '.bkb......', 'bbbbbbbbc.', '.b.b..b.cc', '..........', '..........'],
    hop: ['..........', '..........', '..........', '.bkb......', 'bbbbbbbb..', 'b...b..bcc', '..........', '..........'],
    map: () => ({ b: hex('#4a8f5e'), c: hex('#7cbd72'), k: INK }),
  },
  fox: {
    idle: ['..........', 'a.a.......', 'aba.......', 'bkbb......', 'bbbbbbbcc.', '.bbbbbbc..', '.b.b.b.b..', '..........'],
    hop: ['a.a.......', 'aba.......', 'bkbb......', 'bbbbbbbcc.', '.bbbbbb...', 'b.......b.', '..........', '..........'],
    map: () => ({ a: hex('#c8601a'), b: hex('#f08a3a'), c: hex('#fff3e0'), k: INK }),
  },
  pigeon: {
    idle: ['..........', '...bb.....', '..bkbb....', '.cbbbbb...', '..abbbbbb.', '..aaaabb..', '...c.c....', '..........'],
    hop: ['..........', '..........', '...bb.....', '.cbkbbbb..', '..abbbbbbb', '..aaaa....', '...c.c....', '..........'],
    map: () => ({ a: hex('#6c6e7c'), b: hex('#a2a4b2'), c: hex('#e46a62'), k: INK }),
  },
  beetle: {
    idle: ['..........', '..........', '..........', '...cccc...', '..cbbbbc..', '.kbbbbbbk.', '..a.a.a...', '..........'],
    hop: ['..........', '..........', '...cccc...', '..cbbbbc..', '.kbbbbbbk.', '..........', '..a.a.a...', '..........'],
    map: () => ({ a: INK, b: hex('#d6461c'), c: hex('#ff8a3a'), k: INK }),
  },
  wisp: {
    idle: ['..........', '....c.....', '...cbc....', '..cbbbc...', '..bkbkb...', '..bbbbb...', '...b.b....', '..........'],
    hop: ['....c.....', '...cbc....', '..cbbbc...', '..bkbkb...', '..bbbbb...', '...bbb....', '....b.....', '..........'],
    map: () => ({ b: hex('#8ff0f5'), c: hex('#e8ffff'), k: hex('#1c1840') }),
  },
};

export function addCritters(reg: Registry): void {
  for (const biome of BIOME_IDS) {
    for (const name of ROSTER[biome].critters) {
      const c = CRITTERS[name];
      if (!c) throw new Error(`no critter art for ${name}`);
      const map = c.map(biome);
      const f = (g: Grid) => {
        const px = new Px(10, 8).stamp(g, map);
        return name === 'firefly' ? px : px.outline(INK);
      };
      reg.add({ id: `critter.${biome}.${name}.idle`, atlas: biome, frames: [f(c.idle), f(c.idle), f(c.hop)], fps: 3, loop: true, flip: true });
      reg.add({ id: `critter.${biome}.${name}.hop`, atlas: biome, frames: [f(c.hop), f(c.idle)], fps: 8, flip: true });
    }
  }
}
