// The seven bosses (64×64), drawn from shape recipes so every pose comes from
// one drawing: 4 idle frames (a breath cycle), hurt, and a staggered low-HP
// pose. Defeat is flash + pixel-dissolve at render time. Plus a 16×16 trophy
// per boss for the character sheet's shelf.

import { BIOME_IDS, BiomeId } from '../../src/domain/game/biomes';
import { PALETTES } from '../../src/game/content/palettes';
import { bossId } from '../../src/game/content/roster';
import { Color, hex, mix, Px, withAlpha } from '../pixel/px';
import { ball, ramp, tube } from '../pixel/shade';
import { Registry } from './registry';

type Pose = 'idle' | 'hurt' | 'low';
const S = 64;

interface Ctx {
  px: Px;
  /** Idle phase 0–3. */
  t: number;
  /** −1…1 breath. */
  breath: number;
  pose: Pose;
  ink: Color;
}

const TAU = Math.PI * 2;

function eye(px: Px, x: number, y: number, rx: number, ry: number, glow: Color, ink: Color, closed: boolean) {
  if (closed) {
    px.line(x - rx, y, x + rx, y, ink);
    return;
  }
  px.ellipse(x, y, rx, ry, glow);
  px.set(Math.round(x - rx / 2), Math.round(y - ry / 2), hex('#ffffff'));
}

// ---------------------------------------------------------------------------
// 1. The Fog Wisp — a soft cloud of mental fog with sleepy lantern eyes.
function fogWisp(c: Ctx) {
  const { px, t, pose, breath, ink } = c;
  const fog = ramp(['#6f9a8a', '#9cc4b3', '#cfe6da', '#f4fbf4']);
  const low = pose === 'low';
  const cy = 24 + Math.round(breath) + (low ? 5 : 0);
  const rx = low ? 14 : 17;
  // Three trailing tails, swaying.
  for (let k = -1; k <= 1; k++) {
    for (let y = cy + 8; y < 60; y++) {
      const p = (y - cy - 8) / (52 - cy);
      const x = 32 + k * 9 + Math.sin(y * 0.28 + (t * TAU) / 4 + k * 1.7) * (2 + p * 3);
      const r = Math.max(0.8, (low ? 5 : 6.5) * (1 - p));
      ball(px, x, y, r, r, fog, -0.05);
    }
  }
  ball(px, 32, cy, rx, low ? 12 : 15, fog, 0.05);
  // Side puffs.
  ball(px, 32 - rx + 1, cy + 5, 6, 5, fog);
  ball(px, 32 + rx - 1, cy + 5, 6, 5, fog);
  ball(px, 32 - 6, cy - 11, 6, 5, fog, 0.1);
  ball(px, 32 + 7, cy - 12, 5, 4, fog, 0.1);
  px.outline(ink);
  const glow = hex('#ffe9a8');
  const closed = pose === 'hurt';
  eye(px, 25, cy - 1, 3, low ? 1.6 : 4, glow, ink, closed);
  eye(px, 39, cy - 1, 3, low ? 1.6 : 4, glow, ink, closed);
  // A small, round mouth.
  px.ellipse(32, cy + 7, 2, pose === 'hurt' ? 1 : 2, ink);
}

// 2. The Doomscroll Hydra — three heads, each lit by a glowing screen.
function hydra(c: Ctx) {
  const { px, t, pose, ink } = c;
  const skin = ramp(['#2a4a48', '#3f6b64', '#5f9486', '#9ccdb6']);
  const belly = ramp(['#56406b', '#7b5e93', '#a58cc4']);
  const low = pose === 'low';
  const sway = (k: number) => Math.sin((t * TAU) / 4 + k * 2.1) * 2;
  const heads: [number, number][] = [
    [11 + sway(0), (low ? 34 : 22) + sway(1) / 2],
    [32 + sway(1) / 2, (low ? 26 : 12) + sway(2) / 2],
    [53 + sway(2), (low ? 36 : 22) + sway(0) / 2],
  ];
  const bases: [number, number][] = [
    [23, 50],
    [32, 47],
    [41, 50],
  ];
  heads.forEach(([hx, hy], i) => {
    const [bx, by] = bases[i];
    tube(px, [bx, by], [(bx + hx) / 2 + (i === 1 ? 0 : i === 0 ? 4 : -4), (by + hy) / 2 + 6], [hx, hy + 4], 5, 3.5, skin);
  });
  ball(px, 32, 55, 22, 9, skin);
  ball(px, 32, 57, 14, 5, belly);
  heads.forEach(([hx, hy], i) => {
    const dir = i === 0 ? -1 : i === 2 ? 1 : 0;
    ball(px, hx, hy, 6.5, 5.5, skin, 0.05);
    ball(px, hx + dir * 4, hy + 2, 4, 3, skin);
    // Spines.
    px.poly([[hx - 2, hy - 5], [hx, hy - 9], [hx + 2, hy - 5]], skin[1]);
  });
  px.outline(ink);
  const screen = hex('#9fe8ff');
  heads.forEach(([hx, hy], i) => {
    const dir = i === 0 ? -1 : i === 2 ? 1 : 0;
    const closed = pose === 'hurt' || (low && i !== 1);
    eye(px, hx - 2 + dir, hy - 1, 1.5, 1.5, hex('#e6c6ff'), ink, closed);
    eye(px, hx + 2 + dir, hy - 1, 1.5, 1.5, hex('#e6c6ff'), ink, closed);
    // The glowing phone each head can't put down.
    const sx = Math.round(hx + dir * 5) - 2;
    const sy = Math.round(hy + 5);
    px.rect(sx - 1, sy - 1, 6, 8, ink);
    px.rect(sx, sy, 4, 6, screen);
    px.rect(sx + 1, sy + 1, 2, 1, hex('#ffffff'));
    px.rect(sx + 1, sy + 3, 2, 1, hex('#5fb8e0'));
  });
}

// 3. The Mirage Djinn — endless busywork, shimmering above a smoke tail.
function djinn(c: Ctx) {
  const { px, t, pose, breath, ink } = c;
  const P = PALETTES.desert;
  const skin = ramp(['#24407a', '#3a5fa8', '#5f8fd8', '#a8c8f5']);
  const cloth = ramp(P.accentA);
  const gold = ramp(['#9a6a1a', '#d9a53a', '#f7da7a']);
  const low = pose === 'low';
  const top = 12 + Math.round(breath) + (low ? 4 : 0);
  // Smoke tail spiralling down.
  for (let y = top + 26; y < 62; y++) {
    const p = (y - top - 26) / (62 - top - 26);
    const x = 32 + Math.sin(y * 0.35 + (t * TAU) / 4) * (2 + p * 5);
    const r = Math.max(1, 9 * (1 - p) + 1);
    ball(px, x, y, r, r * 0.8, skin, -0.1);
  }
  ball(px, 32, top + 22, 13, 10, skin); // torso
  // Crossed arms with gold cuffs.
  ball(px, 25, top + 25, 8, 3.5, skin, 0.05);
  ball(px, 39, top + 26, 8, 3.5, skin, 0.05);
  ball(px, 32, top + 8, 8, 8, skin, 0.1); // head
  // Turban and its jewel.
  ball(px, 32, top + 1, 10, 5.5, cloth, 0.1);
  ball(px, 32, top - 4, 5, 4, cloth, 0.15);
  px.outline(ink);
  px.rect(20, top + 24, 2, 3, gold[1]).rect(43, top + 25, 2, 3, gold[1]);
  ball(px, 32, top + 2, 2, 2, gold);
  px.set(31, top + 1, hex('#ffffff'));
  // Narrow gold eyes and a pointed beard.
  const closed = pose === 'hurt';
  eye(px, 29, top + 8, 1.6, low ? 0.6 : 1, gold[2], ink, closed);
  eye(px, 35, top + 8, 1.6, low ? 0.6 : 1, gold[2], ink, closed);
  px.poly([[30, top + 13], [34, top + 13], [32, top + 18]], ink);
  // Earrings.
  px.set(24, top + 11, gold[2]).set(40, top + 11, gold[2]);
  // Heat shimmer: every other row of the tail slides a pixel.
  const shimmer = px.clone();
  for (let y = top + 30; y < S; y += 2) for (let x = 0; x < S; x++) px.set(x, y, shimmer.get(x - (t % 2 ? 1 : -1), y));
}

// 4. The Frozen Titan — inertia made of ice; slow, huge, patient.
function titan(c: Ctx) {
  const { px, pose, breath, ink } = c;
  const ice = ramp(['#3f6fa8', '#5f9ad0', '#9dd0f0', '#d4f1ff']);
  const stone = ramp(['#505a73', '#6f7b96', '#98a4bf']);
  const snow = hex('#ffffff');
  const low = pose === 'low';
  const b = Math.round(breath);
  const top = 14 + (low ? 4 : 0);
  // Legs.
  px.rect(20, 50, 9, 12, stone[1]).rect(35, 50, 9, 12, stone[1]);
  px.rect(20, 50, 9, 2, stone[2]).rect(35, 50, 9, 2, stone[2]);
  // Torso: a big rounded block.
  ball(px, 32, top + 20 + b, 20, 17, ice);
  // Arms hanging, fists like boulders.
  ball(px, 10, top + 22 + b, 6, 11, ice);
  ball(px, 54, top + 22 + b, 6, 11, ice);
  ball(px, 9, top + 34 + b, 6, 5, stone, 0.05);
  ball(px, 55, top + 34 + b, 6, 5, stone, 0.05);
  // Head sunk between the shoulders.
  ball(px, 32, top + 3 + b, 8, 7, stone, 0.1);
  // Crystal clusters on the shoulders.
  const crystal = (x: number, y: number, h: number, dir: number) => {
    px.poly([[x - 3, y], [x + dir * 1, y - h], [x + 3, y]], ice[3]);
    px.line(x, y - 1, x + dir, y - h + 2, ice[2]);
  };
  crystal(16, top + 8 + b, 12, -1);
  crystal(21, top + 6 + b, 8, 0);
  crystal(46, top + 7 + b, 12, 1);
  crystal(41, top + 5 + b, 7, 0);
  // Snow caps.
  for (let x = 16; x < 49; x++) if (px.get(x, top + 4 + b) && !px.get(x, top + 3 + b)) px.set(x, top + 4 + b, snow);
  px.outline(ink);
  const glow = hex('#8ff0ff');
  const closed = pose === 'hurt';
  eye(px, 29, top + 3 + b, 1.5, low ? 0.7 : 1.4, glow, ink, closed);
  eye(px, 35, top + 3 + b, 1.5, low ? 0.7 : 1.4, glow, ink, closed);
  if (low || pose === 'hurt') {
    // Cracks.
    px.line(26, top + 14, 30, top + 22, ink).line(30, top + 22, 28, top + 28, ink);
    px.line(40, top + 18, 37, top + 25, ink);
  }
}

// 5. King Tomorrow — procrastination on a throne of "later", hourglass in hand.
function king(c: Ctx) {
  const { px, t, pose, breath, ink } = c;
  const P = PALETTES.iron;
  const robe = ramp(P.accentA);
  const gold = ramp(P.accentB);
  const skin = ramp(['#b8744a', '#e0a67a', '#f5cfa8']);
  const ermine = hex('#f5f1e6');
  const low = pose === 'low';
  const b = Math.round(breath);
  // Robe: a wide bell.
  px.poly([[18, 26 + b], [46, 26 + b], [56, 62], [8, 62]], robe[1]);
  px.rim(robe[1], robe[2], robe[0]);
  ball(px, 32, 40 + b, 15, 12, robe, 0.05); // belly
  // Ermine trim and collar.
  px.rect(8, 58, 49, 4, ermine);
  for (let x = 10; x < 56; x += 5) px.set(x, 59, ink).set(x + 2, 61, ink);
  ball(px, 32, 27 + b, 13, 4, [ermine, ermine, ermine]);
  // Head.
  const hy = (low ? 21 : 18) + b;
  ball(px, 32, hy, 9, 9, skin, 0.1);
  // Crown (askew when low).
  const tilt = low ? 2 : 0;
  px.poly(
    [
      [22 + tilt, hy - 6],
      [22 + tilt, hy - 14],
      [26 + tilt, hy - 10],
      [29 + tilt, hy - 16],
      [32 + tilt, hy - 11],
      [35 + tilt, hy - 16],
      [38 + tilt, hy - 10],
      [42 + tilt, hy - 14],
      [42 + tilt, hy - 6],
    ],
    gold[1]
  );
  px.rim(gold[1], gold[2], gold[0]);
  // Hourglass in hand.
  const gx = 50;
  const gy = 36 + b;
  px.rect(gx - 4, gy - 7, 9, 2, gold[1]).rect(gx - 4, gy + 6, 9, 2, gold[1]);
  px.poly([[gx - 3, gy - 5], [gx + 4, gy - 5], [gx + 1, gy], [gx + 4, gy + 6], [gx - 3, gy + 6], [gx, gy]], hex('#cfe6f5'));
  const sandTop = t % 4;
  px.rect(gx - 1, gy - 4 + sandTop, 3, 2, gold[2]).rect(gx - 2, gy + 3, 5, 3, gold[2]);
  ball(px, 44, gy + 2, 3.5, 3, skin); // hand
  px.outline(ink);
  // Gems on the crown.
  px.set(29 + tilt, hy - 12, robe[2]).set(35 + tilt, hy - 12, robe[2]).set(32 + tilt, hy - 8, hex('#5fb8e0'));
  // Sleepy half-lidded eyes; wide open when hurt.
  if (pose === 'hurt') {
    eye(px, 28, hy, 1.5, 1.5, hex('#ffffff'), ink, false);
    eye(px, 36, hy, 1.5, 1.5, hex('#ffffff'), ink, false);
  } else {
    px.line(26, hy, 30, hy, ink).line(34, hy, 38, hy, ink);
    px.set(28, hy + 1, ink).set(36, hy + 1, ink);
  }
  // A grand mustache.
  px.line(26, hy + 4, 31, hy + 3, ink).line(33, hy + 3, 38, hy + 4, ink);
  px.set(25, hy + 3, ink).set(39, hy + 3, ink);
  // Zzz drifting up while idle.
  if (pose === 'idle') {
    const zx = 46 + (t % 2);
    const zy = 10 - t;
    const z = (x: number, y: number, s: number) => px.line(x, y, x + s, y, ink).line(x + s, y, x, y + s, ink).line(x, y + s, x + s, y + s, ink);
    z(zx, zy + 4, 3);
    if (t > 1) z(zx + 5, zy - 1, 2);
  }
}

// 6. The Burnout Drake — overwork: charcoal scales, magma cracks, tired wings.
function drake(c: Ctx) {
  const { px, t, pose, breath, ink } = c;
  const P = PALETTES.volcano;
  const scale = ramp(['#1f1a1f', '#2f282e', '#463b41', '#6f6066']);
  const magma = ramp(P.liquid);
  const low = pose === 'low';
  const b = Math.round(breath);
  const flap = low ? 8 : [0, -3, -5, -3][t];
  // Far wing.
  px.poly([[36, 30 + b], [50, 6 + flap], [60, 14 + flap], [62, 28 + flap / 2], [48, 34 + b]], scale[1]);
  // Tail.
  tube(px, [48, 46 + b], [60, 48], [60, 60], 4, 1.5, scale);
  // Body.
  ball(px, 38, 42 + b, 15, 11, scale);
  // Legs.
  px.rect(30, 50 + b, 5, 10, scale[1]).rect(42, 50 + b, 5, 10, scale[1]);
  // Neck and head.
  const hx = 14;
  const hy = (low ? 30 : 20) + b;
  tube(px, [30, 38 + b], [20, 34 + b], [hx + 4, hy + 2], 5.5, 4, scale);
  ball(px, hx, hy, 8, 6, scale, 0.05);
  ball(px, hx - 7, hy + 2, 5, 3.5, scale, 0.05);
  // Horns.
  px.poly([[hx + 2, hy - 5], [hx + 9, hy - 12], [hx + 5, hy - 4]], scale[3]);
  px.poly([[hx - 2, hy - 5], [hx + 2, hy - 13], [hx + 1, hy - 4]], scale[2]);
  // Near wing (drawn over the body).
  px.poly([[34, 32 + b], [40, 4 + flap], [52, 10 + flap], [46, 30 + b]], scale[2]);
  px.line(40, 5 + flap, 38, 32 + b, scale[0]).line(46, 8 + flap, 42, 32 + b, scale[0]);
  px.outline(ink);
  // Magma cracks glowing through.
  const crack = (pts: [number, number][]) => {
    for (let i = 0; i + 1 < pts.length; i++) px.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], low ? magma[0] : magma[1]);
  };
  crack([[28, 40 + b], [33, 44 + b], [38, 42 + b], [44, 47 + b]]);
  crack([[36, 36 + b], [40, 39 + b], [47, 38 + b]]);
  crack([[hx - 4, hy + 3], [hx + 2, hy + 1]]);
  // A tired, glowing eye.
  const closed = pose === 'hurt';
  eye(px, hx + 1, hy - 1, 1.5, low ? 0.6 : 1.3, magma[2], ink, closed);
  // Embers from the snout.
  if (!low) {
    for (let i = 0; i < 3; i++) {
      const ex = hx - 12 - i * 2 - (t % 2);
      const ey = hy + 1 - i * 2 - t;
      px.set(ex, ey, i ? magma[1] : magma[2]);
    }
  }
}

// 7. The Hollow Echo — self-doubt: a cloak around nothing, a mask, and shards.
function echo(c: Ctx) {
  const { px, t, pose, breath, ink } = c;
  const P = PALETTES.astral;
  const cloak = ramp(['#1c1840', '#2a2550', '#3d3673', '#574f99']);
  const crystal = ramp(P.liquid);
  const mask = ramp(['#b8b0d8', '#e0dcf0', '#ffffff']);
  const low = pose === 'low';
  const b = Math.round(breath);
  // Echo afterimages, faint.
  const echoLayer = new Px(S, S);
  echoLayer.poly([[20, 18], [44, 18], [52, 62], [12, 62]], withAlpha(hex('#8f86d8'), 70));
  px.blit(echoLayer.shift(t % 2 ? -3 : 3, 0), 0, 0);
  // Cloak.
  px.poly([[22, 16 + b], [42, 16 + b], [52, 62], [44, 58], [38, 62], [32, 57], [26, 62], [20, 58], [12, 62]], cloak[2]);
  px.rim(cloak[2], cloak[3], cloak[1]);
  ball(px, 32, 16 + b, 11, 10, cloak, 0.1); // hood
  // The hollow: a void with stars in the chest.
  px.ellipse(32, 38 + b, 7, 10, hex(P.sky[0]));
  const stars = [[30, 33], [34, 37], [31, 42], [35, 44], [29, 39]];
  stars.forEach(([x, y], i) => ((i + t) % 3 ? px.set(x, y + b, hex('#fff4c2')) : null));
  px.outline(ink);
  // The mask.
  const my = 18 + b + (low ? 2 : 0);
  ball(px, 32, my, 6.5, 7.5, mask, 0.15);
  px.ellipse(29, my - 1, 1.5, pose === 'hurt' ? 0.8 : 2, ink);
  px.ellipse(35, my - 1, 1.5, pose === 'hurt' ? 0.8 : 2, ink);
  px.line(30, my + 4, 34, my + 4, mix(mask[0], ink, 0.5));
  if (low) px.line(33, my - 7, 31, my - 2, ink).line(31, my - 2, 33, my + 2, ink);
  // Orbiting shards.
  const n = low ? 2 : 4;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + (t * TAU) / 16;
    const x = 32 + Math.cos(a) * 25;
    const y = 36 + Math.sin(a) * 9;
    px.poly([[x, y - 4], [x + 2.5, y], [x, y + 4], [x - 2.5, y]], crystal[1]);
    px.set(Math.round(x) - 1, Math.round(y) - 1, crystal[2]);
  }
}

const DRAW: Record<BiomeId, (c: Ctx) => void> = {
  forest: fogWisp,
  swamp: hydra,
  desert: djinn,
  frost: titan,
  iron: king,
  volcano: drake,
  astral: echo,
};

function frame(biome: BiomeId, t: number, pose: Pose): Px {
  const px = new Px(S, S);
  const breath = pose === 'idle' ? Math.sin((t / 4) * TAU) : pose === 'low' ? 1 : 0;
  DRAW[biome]({ px, t, breath, pose, ink: hex(PALETTES[biome].outline) });
  return pose === 'hurt' ? px.shift(2, 0) : px;
}

// ---------------------------------------------------------------------------
// Trophies (16×16): one small keepsake per boss.

const TROPHY: Record<BiomeId, string[]> = {
  forest: [
    '................',
    '.....cccccc.....',
    '...ccbbbbbbcc...',
    '..cbbbbbbbbbbc..',
    '..bbggbbbbggbb..',
    '..bbggbbbbggbb..',
    '..bbbbbbbbbbbb..',
    '..bbbbbkkbbbbb..',
    '...bbbbbbbbbb...',
    '...abbbabbbba...',
    '....ab..a.ab....',
    '....a...a..a....',
    '...dddddddddd...',
    '..deeeeeeeeeed..',
    '..dddddddddddd..',
    '................',
  ],
  swamp: [
    '................',
    '......cc........',
    '.....cbbc.......',
    '....cbbbbcc.....',
    '....bgkbbbbc....',
    '....bbbbbbbb....',
    '.....abbbhhh....',
    '......abbhwh....',
    '......bbbhhh....',
    '.....abbba......',
    '.....bbba.......',
    '....abba........',
    '...dddddddddd...',
    '..deeeeeeeeeed..',
    '..dddddddddddd..',
    '................',
  ],
  desert: [
    '................',
    '................',
    '.........g......',
    '........ggg.....',
    '.........g......',
    '..........c.....',
    '...cccccccbc....',
    '..cbbbbbbbbbbc..',
    '.cbbbbbbbbbbbbb.',
    '..abbbbbbbbbba..',
    '....aaaaaaaa....',
    '......abba......',
    '...dddddddddd...',
    '..deeeeeeeeeed..',
    '..dddddddddddd..',
    '................',
  ],
  frost: [
    '................',
    '.......c........',
    '......cbc.......',
    '...c..cbc..c....',
    '..cbc.cbc.cbc...',
    '..cbccbbbccbc...',
    '..cbbbbbbbbbc...',
    '..abbbbbbbbba...',
    '...abbbbbbba....',
    '....abbbbba.....',
    '.....abbba......',
    '......aba.......',
    '...dddddddddd...',
    '..deeeeeeeeeed..',
    '..dddddddddddd..',
    '................',
  ],
  iron: [
    '................',
    '................',
    '..c...c..c...c..',
    '..cc.ccc.ccc.cc.',
    '..cbccbbcbbccbc.',
    '..cbbbbbbbbbbbc.',
    '..bbhbbbgbbbhbb.',
    '..bbbbbbbbbbbbb.',
    '..aaaaaaaaaaaaa.',
    '................',
    '................',
    '................',
    '...dddddddddd...',
    '..deeeeeeeeeed..',
    '..dddddddddddd..',
    '................',
  ],
  volcano: [
    '................',
    '..........c.....',
    '.........cb.....',
    '........cbb.....',
    '.......cbba.....',
    '......cbbhha....',
    '.....cbbhhba....',
    '....cbbhhbba....',
    '....bbhhbbba....',
    '....abbbbbba....',
    '.....aabbaa.....',
    '................',
    '...dddddddddd...',
    '..deeeeeeeeeed..',
    '..dddddddddddd..',
    '................',
  ],
  astral: [
    '................',
    '.....cccccc.....',
    '....cbbbbbbc....',
    '...cbbbbbbbbc...',
    '...bbkkbbkkbb...',
    '...bbkkbbkkbb...',
    '...bbbbbbbbbb...',
    '...abbbbbbbba...',
    '....abkkkkba....',
    '.....abbbba.....',
    '......aaaa......',
    '................',
    '...dddddddddd...',
    '..deeeeeeeeeed..',
    '..dddddddddddd..',
    '................',
  ],
};

const TROPHY_RAMP: Record<BiomeId, string[]> = {
  forest: ['#9cc4b3', '#cfe6da', '#f4fbf4'],
  swamp: ['#2f5a54', '#4f8277', '#7fb3a0'],
  desert: ['#9a6a1a', '#d9a53a', '#f7da7a'],
  frost: ['#5f9ad0', '#9dd0f0', '#d4f1ff'],
  iron: ['#a8741f', '#dca83a', '#f7d77a'],
  volcano: ['#2f282e', '#463b41', '#6f6066'],
  astral: ['#b8b0d8', '#e0dcf0', '#ffffff'],
};

function trophy(biome: BiomeId): Px {
  const P = PALETTES[biome];
  const r = TROPHY_RAMP[biome];
  const map: Record<string, Color> = {
    a: hex(r[0]),
    b: hex(r[1]),
    c: hex(r[2]),
    d: hex('#4a3024'),
    e: hex('#a07a4a'),
    k: hex(P.outline),
    g: hex(P.light),
    h: hex(P.liquid[1]),
    w: hex('#ffffff'),
  };
  return new Px(16, 16).stamp(TROPHY[biome], map).outline(hex(P.outline));
}

export function addBosses(reg: Registry): void {
  for (const biome of BIOME_IDS) {
    const id = bossId(biome);
    reg.add({ id: `${id}.idle`, atlas: biome, frames: [0, 1, 2, 3].map((t) => frame(biome, t, 'idle')), fps: 5, loop: true, flash: true });
    reg.add({ id: `${id}.hurt`, atlas: biome, frames: [frame(biome, 0, 'hurt')], flash: true });
    reg.add({ id: `${id}.low`, atlas: biome, frames: [frame(biome, 0, 'low'), frame(biome, 2, 'low')], fps: 3, loop: true, flash: true });
    reg.add({ id: `trophy.${biome}`, atlas: 'shared', frames: [trophy(biome)] });
    // Not beaten yet: its shape only, on the trophy shelf.
    reg.add({ id: `trophy.${biome}.shadow`, atlas: 'shared', frames: [trophy(biome).silhouette(hex('#3a3242'))] });
  }
}

