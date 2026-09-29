// Shared props, effects and UI icons: campfires (per style, lit and embers),
// the chest, the Quest Board, sparkles, dust, hits, glow, fog, and small
// pixel icons for the HUD, sheets and shop.

import { SHARED } from '../../src/game/content/palettes';
import { Color, hex, Px, withAlpha } from '../pixel/px';
import { ramp } from '../pixel/shade';
import { Registry } from './registry';

const INK = hex(SHARED.outline);
type Grid = string[];

// ---------------------------------------------------------------------------
// Campfires (16×16): logs + flame frames; "embers" is the at-risk state.

const FLAMES: Grid[] = [
  ['.......a........', '......aba.......', '.....abcba......', '....abcdcba.....', '....bcdddcb.....', '.....bcdcb......'],
  ['........a.......', '.......aba......', '.....aabcba.....', '....abcddcba....', '....bcdddcb.....', '.....bcdcb......'],
  ['......a.........', '.....aba..a.....', '.....abcbaba....', '....abcdcba.....', '....bcdddcb.....', '.....bcdcb......'],
];
const EMBERS: Grid[] = [
  ['................', '................', '................', '......a..a......', '.....abaaba.....', '.....bcbbcb.....'],
  ['................', '................', '.......a........', '......a..a......', '.....abaaba.....', '.....bcbcbb.....'],
];

type FireStyle = 'default' | 'blue' | 'lantern' | 'crystal';
const FIRE_RAMP: Record<FireStyle, [string, string, string, string]> = {
  default: SHARED.fire,
  blue: ['#2a4ad0', '#4f8aff', '#9fd0ff', '#f0faff'],
  lantern: ['#c87a1a', '#f2b43a', '#ffe08a', '#fffbe0'],
  crystal: ['#7a3fd0', '#b07af0', '#e6c8ff', '#ffffff'],
};

function fireBase(style: FireStyle): Px {
  const px = new Px(16, 16);
  if (style === 'lantern') {
    // A lantern on a post instead of logs.
    px.rect(7, 4, 2, 12, hex(SHARED.wood[1])).rect(4, 3, 8, 1, hex(SHARED.wood[1]));
    px.rect(4, 4, 1, 3, hex(SHARED.wood[0])).rect(11, 4, 1, 3, hex(SHARED.wood[0]));
  } else if (style === 'crystal') {
    px.poly([[3, 15], [5, 12], [8, 13], [11, 12], [13, 15]], hex('#3f3670'));
    px.rim(hex('#3f3670'), hex('#574f99'), hex('#2a2550'));
  } else {
    px.rect(3, 13, 10, 2, hex(SHARED.wood[1])).line(3, 15, 12, 12, hex(SHARED.wood[0])).line(4, 12, 13, 15, hex(SHARED.wood[2]));
    for (const [x, y] of [[2, 14], [13, 14], [5, 15], [10, 15]]) px.set(x, y, hex('#6f798b'));
  }
  return px;
}

function campfire(style: FireStyle, grid: Grid): Px {
  const r = FIRE_RAMP[style];
  const px = fireBase(style);
  const map: Record<string, Color> = { a: hex(r[0]), b: hex(r[1]), c: hex(r[2]), d: hex(r[3]) };
  const oy = style === 'lantern' ? -2 : 6;
  const flame = new Px(16, 16).stamp(grid, map, style === 'lantern' ? 0 : 0, oy);
  if (style === 'lantern') px.rect(5, 5, 6, 6, withAlpha(hex(r[3]), 120));
  px.blit(flame, 0, style === 'lantern' ? 3 : 0);
  return px.outline(INK);
}

// ---------------------------------------------------------------------------
// The chest (16×16)

const CHEST_CLOSED: Grid = ['................', '................', '................', '................', '...aaaaaaaaaa...', '..abbbbbbbbbba..', '..abcccccccbba..', '..agggggggggga..', '..abbbbwwbbbba..', '..abbbbgwbbbba..', '..abbbbbbbbbba..', '..abbbbbbbbbba..', '..agggggggggga..', '...aaaaaaaaaa...', '................', '................'];
const CHEST_OPEN: Grid = ['................', '...aaaaaaaaaa...', '..abbbbbbbbbba..', '..abcccccccbba..', '..agggggggggga..', '..aLLLLLLLLLLa..', '..aLllllllllLa..', '..agggggggggga..', '..abbbbwwbbbba..', '..abbbbgwbbbba..', '..abbbbbbbbbba..', '..abbbbbbbbbba..', '..agggggggggga..', '...aaaaaaaaaa...', '................', '................'];

function chest(open: boolean, squash = 0): Px {
  const map = { a: hex(SHARED.wood[0]), b: hex(SHARED.wood[1]), c: hex(SHARED.wood[2]), g: hex(SHARED.gold[1]), w: hex(SHARED.gold[2]), L: hex('#ffe08a'), l: hex('#fffbe0') };
  const px = new Px(16, 16).stamp(open ? CHEST_OPEN : CHEST_CLOSED, map);
  const out = squash ? px.shiftRows(0, 8, squash) : px;
  return out.outline(INK);
}

// ---------------------------------------------------------------------------
// The Quest Board (20×20): a notice board with pinned papers.

function questBoard(): Px {
  const px = new Px(20, 20);
  const wood = ramp(SHARED.wood);
  px.rect(2, 8, 2, 12, wood[1]).rect(16, 8, 2, 12, wood[1]);
  px.rect(1, 2, 18, 12, wood[1]);
  px.rim(wood[1], wood[2], wood[0]);
  px.rect(1, 1, 18, 2, wood[0]).rect(0, 1, 20, 1, wood[2]);
  const paper = ramp(SHARED.paper);
  const note = (x: number, y: number, w: number, h: number, pin: string) => {
    px.rect(x, y, w, h, paper[2]).rect(x, y + h - 1, w, 1, paper[1]);
    for (let yy = y + 2; yy < y + h - 1; yy += 2) px.line(x + 1, yy, x + w - 2, yy, paper[0]);
    px.set(x + Math.floor(w / 2), y, hex(pin));
  };
  note(3, 4, 5, 7, SHARED.red[1]);
  note(9, 3, 4, 6, SHARED.blue[1]);
  note(13, 5, 4, 7, SHARED.gold[1]);
  return px.outline(INK);
}

// ---------------------------------------------------------------------------
// Effects

function sparkle(t: number): Px {
  const px = new Px(9, 9);
  const c = hex('#fff6c0');
  const g = hex('#ffd35a');
  const s = [1, 3, 4, 2][t];
  px.set(4, 4, c);
  for (let i = 1; i <= s; i++) {
    const col = i === s ? g : c;
    px.set(4 + i, 4, col).set(4 - i, 4, col).set(4, 4 + i, col).set(4, 4 - i, col);
  }
  if (t === 2) px.set(3, 3, g).set(5, 5, g).set(3, 5, g).set(5, 3, g);
  return px;
}

function dust(t: number): Px {
  const px = new Px(10, 6);
  const c = withAlpha(hex('#f3ead8'), 230);
  const d = withAlpha(hex('#c9b89a'), 200);
  const r = [1.2, 2, 2.4, 1.6][t];
  const spread = [1, 2, 3, 4][t];
  px.ellipse(5 - spread, 3.5, r, r * 0.8, t > 2 ? d : c);
  px.ellipse(5 + spread, 3.5, r, r * 0.8, t > 2 ? d : c);
  if (t < 2) px.ellipse(5, 3, r, r * 0.8, c);
  return px;
}

function hit(t: number): Px {
  const px = new Px(11, 11);
  const c = hex('#ffffff');
  const g = hex('#ffe08a');
  const n = [2, 4, 5][t];
  for (let i = 1; i <= n; i++) {
    const col = t === 2 && i < 3 ? withAlpha(g, 120) : i === n ? g : c;
    px.set(5 + i, 5, col).set(5 - i, 5, col).set(5, 5 + i, col).set(5, 5 - i, col);
    if (i < n - 1) px.set(5 + i, 5 + i, col).set(5 - i, 5 - i, col).set(5 + i, 5 - i, col).set(5 - i, 5 + i, col);
  }
  return px;
}

/** A soft round light in stepped rings (drawn additively). */
function glow(size: number, color: string): Px {
  const px = new Px(size, size);
  const c = size / 2;
  const base = hex(color);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const d = Math.hypot(x + 0.5 - c, y + 0.5 - c) / c;
    if (d > 1) continue;
    const step = Math.ceil((1 - d) * 4) / 4; // four hard rings: pixel light
    px.set(x, y, withAlpha(base, Math.round(step * step * 150)));
  }
  return px;
}

function fog(w: number, h: number): Px {
  const px = new Px(w, h);
  const c = hex('#e8f2ec');
  for (let i = 0; i < 7; i++) {
    const x = (i / 6) * w;
    px.ellipse(x, h * 0.55 + Math.sin(i * 1.7) * h * 0.12, w * 0.16, h * 0.34, withAlpha(c, 110));
  }
  return px;
}

// ---------------------------------------------------------------------------
// Icons (12×12 unless noted)

const ICONS: Record<string, { grid: Grid; map: Record<string, Color>; outline?: boolean }> = {
  sword: { grid: ['.........aa.', '........abc.', '.......abc..', '......abc...', '.....abc....', '.d..abc.....', '..dabc......', '..ddc.......', '.dgdd.......', 'dd..d.......', 'd...........', '............'], map: { a: hex(SHARED.metal[0]), b: hex(SHARED.metal[1]), c: hex(SHARED.metal[2]), d: hex(SHARED.leather[1]), g: hex(SHARED.gold[1]) } },
  quill: { grid: ['.........aab', '........abbb', '.......abbb.', '......abbb..', '.....abbb...', '....abbb....', '....abb.....', '...ab.......', '..ak........', '.kk.........', 'k...........', '............'], map: { a: hex('#c8c0b0'), b: hex('#fbf7ec'), k: INK } },
  coin: { grid: ['............', '...aaaaa....', '..abbbbba...', '.abccbbbba..', '.abcbbbbba..', '.abbbbbbba..', '.abbbbbbba..', '.abbbbbbba..', '..abbbbba...', '...aaaaa....', '............', '............'], map: { a: hex(SHARED.gold[0]), b: hex(SHARED.gold[1]), c: hex('#fff6c0') } },
  xp: { grid: ['.....a......', '....aba.....', '....aba.....', 'aaaabcbaaaa.', '.abbbcbbba..', '..abbbbba...', '...abbba....', '..abba.aba..', '..aba...aba.', '..a.......a.', '............', '............'], map: { a: hex('#3a6aa8'), b: hex('#7ab0e0'), c: hex('#e8f4ff') } },
  chest: { grid: ['............', '..aaaaaaaa..', '.abbbbbbbba.', '.agggggggga.', '.abbbwwbbba.', '.abbbgwbbba.', '.abbbbbbbba.', '.agggggggga.', '..aaaaaaaa..', '............', '............', '............'], map: { a: hex(SHARED.wood[0]), b: hex(SHARED.wood[1]), g: hex(SHARED.gold[1]), w: hex(SHARED.gold[2]) } },
  lock: { grid: ['............', '....aaa.....', '...a...a....', '...a...a....', '..bbbbbbb...', '..bcccccb...', '..bcckccb...', '..bcckccb...', '..bcccccb...', '..bbbbbbb...', '............', '............'], map: { a: hex(SHARED.metal[1]), b: hex(SHARED.gold[0]), c: hex(SHARED.gold[1]), k: INK } },
  freeze: { grid: ['.....a......', '..a..a..a...', '...a.a.a....', '....bab.....', 'aaaabcbaaaa.', '....bab.....', '...a.a.a....', '..a..a..a...', '.....a......', '............', '............', '............'], map: { a: hex('#6fa8d8'), b: hex('#c8ecff'), c: hex('#ffffff') } },
  check: { grid: ['............', '..........a.', '.........ab.', '........ab..', '.a.....ab...', '.ba...ab....', '..ba.ab.....', '...bab......', '....b.......', '............', '............', '............'], map: { a: hex(SHARED.green[2]), b: hex(SHARED.green[1]) } },
  heart: { grid: ['............', '..aa...aa...', '.abba.abba..', '.abcbabbba..', '.abbbbbbba..', '..abbbbba...', '...abbba....', '....aba.....', '.....a......', '............', '............', '............'], map: { a: hex(SHARED.red[0]), b: hex(SHARED.red[1]), c: hex(SHARED.red[2]) } },
  rested: { grid: ['............', '.....aaa....', '...aa.......', '..a.........', '..a.........', '..a......b..', '...a....bb..', '....aaaa.b..', '.........b..', '............', '............', '............'], map: { a: hex('#b8c8f0'), b: hex('#fff6c0') } },
  star: { grid: ['.....a......', '.....a......', '....aba.....', 'aaaabcbaaaa.', '.aabbbbbaa..', '...abbba....', '..abbabba...', '..aa...aa...', '............', '............', '............', '............'], map: { a: hex(SHARED.gold[1]), b: hex(SHARED.gold[2]), c: hex('#ffffff') } },
};

// ---------------------------------------------------------------------------

export function addProps(reg: Registry): void {
  for (const style of ['default', 'blue', 'lantern', 'crystal'] as FireStyle[]) {
    reg.add({ id: `prop.campfire.${style}.lit`, atlas: 'shared', frames: FLAMES.map((f) => campfire(style, f)), fps: 7, loop: true });
    reg.add({ id: `prop.campfire.${style}.embers`, atlas: 'shared', frames: EMBERS.map((f) => campfire(style, f)), fps: 2, loop: true });
  }
  reg.add({ id: 'prop.chest.closed', atlas: 'shared', frames: [chest(false), chest(false), chest(false, 1)], fps: 2, loop: true });
  reg.add({ id: 'prop.chest.bounce', atlas: 'shared', frames: [chest(false, 2), chest(false), chest(false, -1), chest(false)], fps: 10 });
  reg.add({ id: 'prop.chest.open', atlas: 'shared', frames: [chest(true)] });
  reg.add({ id: 'prop.board', atlas: 'shared', frames: [questBoard()] });
  reg.add({ id: 'prop.shadow', atlas: 'shared', frames: [new Px(12, 4).ellipse(6, 2, 6, 2, withAlpha(hex('#000000'), 70))], anchor: [6, 2] });

  reg.add({ id: 'fx.sparkle', atlas: 'shared', frames: [0, 1, 2, 3].map(sparkle), fps: 12, anchor: [4, 4] });
  reg.add({ id: 'fx.dust', atlas: 'shared', frames: [0, 1, 2, 3].map(dust), fps: 12, anchor: [5, 5] });
  reg.add({ id: 'fx.hit', atlas: 'shared', frames: [0, 1, 2].map(hit), fps: 14, anchor: [5, 5] });
  reg.add({ id: 'fx.glow.warm', atlas: 'shared', frames: [glow(32, '#ffd27a')], anchor: [16, 16], additive: true });
  reg.add({ id: 'fx.glow.cool', atlas: 'shared', frames: [glow(32, '#9fe8ff')], anchor: [16, 16], additive: true });
  reg.add({ id: 'fx.glow.small', atlas: 'shared', frames: [glow(12, '#fff0b0')], anchor: [6, 6], additive: true });
  reg.add({ id: 'fx.fog', atlas: 'shared', frames: [fog(64, 24)], anchor: [32, 12] });
  reg.add({ id: 'fx.pixel', atlas: 'shared', frames: [new Px(1, 1).set(0, 0, hex('#ffffff'))], anchor: [0, 0] });

  for (const [name, i] of Object.entries(ICONS)) {
    const px = new Px(12, 12).stamp(i.grid, i.map);
    reg.add({ id: `icon.${name}`, atlas: 'shared', frames: [i.outline === false ? px : px.outline(INK)], anchor: [6, 6] });
  }
}
