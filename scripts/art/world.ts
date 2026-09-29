// World art per biome: ground tiles, path blobs, island edges, decor and a
// landmark, animated liquid and lights, the gate, parallax pieces, and the
// node markers. Generic recipes (tree, rock, crystal…) painted with each
// biome's palette, so every biome shares one pixel density and one outline.

import { BIOME_IDS, BiomeId } from '../../src/domain/game/biomes';
import { BiomePalette, PALETTES } from '../../src/game/content/palettes';
import { bayer, Color, hashStr, hex, mix, Px, rng, valueNoise, withAlpha } from '../pixel/px';
import { ball, ramp } from '../pixel/shade';
import { Registry } from './registry';

type R = Color[];

interface Pal {
  P: BiomePalette;
  ink: Color;
  ground: R;
  path: R;
  foliage: R;
  trunk: R;
  rock: R;
  liquid: R;
  a: R;
  b: R;
  light: Color;
}

function pal(biome: BiomeId): Pal {
  const P = PALETTES[biome];
  return {
    P,
    ink: hex(P.outline),
    ground: ramp(P.ground),
    path: ramp(P.path),
    foliage: ramp(P.foliage),
    trunk: ramp(P.trunk),
    rock: ramp(P.rock),
    liquid: ramp(P.liquid),
    a: ramp(P.accentA),
    b: ramp(P.accentB),
    light: hex(P.light),
  };
}

// ---------------------------------------------------------------------------
// Ground

/** A 16×16 ground tile: mid colour with a sprinkle of detail, seamless at edges. */
function ground(p: Pal, biome: BiomeId, variant: number): Px {
  const px = new Px(16, 16);
  const g = p.ground;
  const noise = valueNoise(hashStr(biome) + variant * 97);
  const r = rng(hashStr(`${biome}.ground.${variant}`));
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      // Tileable noise: sample on a torus.
      // Soft clusters of the lighter shade, dithered only at their edges.
      const n = noise(x / 6, y / 6);
      const v = n + (bayer(x, y) - 0.5) * 0.18;
      px.set(x, y, v > 0.74 ? g[2] : g[1]);
    }
  }
  // Detail: tufts, pebbles, sparkles by biome.
  const spots = variant === 0 ? 2 : variant === 1 ? 4 : 1;
  for (let i = 0; i < spots; i++) {
    const x = 2 + Math.floor(r() * 12);
    const y = 3 + Math.floor(r() * 11);
    switch (biome) {
      case 'forest':
      case 'iron':
        px.set(x, y, g[3]).set(x - 1, y + 1, g[2]).set(x + 1, y + 1, g[2]).set(x, y + 1, g[0]);
        break;
      case 'swamp':
        px.set(x, y, g[3]).set(x + 1, y, g[2]).set(x, y + 1, g[0]);
        break;
      case 'desert':
        px.set(x, y, g[3]).set(x + 1, y, g[3]).set(x + 2, y, g[2]).set(x - 1, y + 1, g[0]).set(x, y + 1, g[0]);
        break;
      case 'frost':
        px.set(x, y, hex('#ffffff')).set(x + 1, y + 1, g[1]);
        break;
      case 'volcano':
        px.set(x, y, g[3]).set(x + 1, y, g[0]);
        if (variant === 2) px.set(x, y + 1, p.liquid[0]);
        break;
      case 'astral':
        px.set(x, y, variant === 1 ? p.liquid[2] : g[3]);
        break;
    }
  }
  return px;
}

/** Path blobs, stamped along the route: a darker edge pass, then the fill. */
function pathBlob(p: Pal, edge: boolean): Px {
  const px = new Px(12, 10);
  if (edge) px.ellipse(6, 5, 6, 5, p.path[0]);
  else
    px.ellipse(6, 5, 4.6, 3.8, (x, y) => (bayer(x, y) > 0.8 ? p.path[2] : p.path[1]));
  return px;
}

/** Island edge (8×16): the cliff face where the ground drops away. */
function edge(p: Pal, right: boolean, variant: number): Px {
  const px = new Px(8, 16);
  const r = rng(hashStr(`edge${right}${variant}${p.P.outline}`));
  for (let y = 0; y < 16; y++) {
    const w = 3 + Math.round(Math.sin((y + variant * 5) * 0.7) * 1.2 + r() * 0.8);
    for (let x = 0; x < 8; x++) {
      const inGround = right ? x < w : x >= 8 - w;
      const lip = right ? x === w || x === w + 1 : x === 7 - w || x === 6 - w;
      if (inGround) px.set(x, y, p.ground[1]);
      else if (lip) px.set(x, y, right ? (x === w ? p.rock[1] : p.rock[0]) : x === 7 - w ? p.rock[1] : p.rock[0]);
    }
  }
  return px;
}

// ---------------------------------------------------------------------------
// Decor recipes

function tree(p: Pal, w: number, h: number, kind: 'round' | 'pine' | 'dead' | 'snowpine', seed: string): Px {
  const px = new Px(w, h);
  const cx = w / 2;
  const trunkH = kind === 'dead' ? h - 4 : Math.round(h * 0.35);
  px.rect(Math.round(cx) - 1 - (w > 20 ? 1 : 0), h - trunkH, w > 20 ? 4 : 3, trunkH, p.trunk[1]);
  px.rect(Math.round(cx) - 1 - (w > 20 ? 1 : 0), h - trunkH, 1, trunkH, p.trunk[0]);
  if (kind === 'round') {
    const r = rng(hashStr(seed));
    const top = h - trunkH - 2;
    ball(px, cx, top - (h - trunkH) * 0.35, w / 2 - 1, (h - trunkH) * 0.45, p.foliage);
    for (let i = 0; i < 4; i++) ball(px, cx + (r() - 0.5) * w * 0.6, top - r() * (h * 0.3), w / 4, w / 5, p.foliage, 0.05);
  } else if (kind === 'pine' || kind === 'snowpine') {
    const tiers = 4;
    for (let i = 0; i < tiers; i++) {
      const ty = 1 + i * ((h - trunkH) / tiers);
      const tw = (w / 2 - 1) * ((i + 1.3) / (tiers + 0.3));
      px.poly([[cx, ty - 2], [cx + tw, ty + (h - trunkH) / tiers + 2], [cx - tw, ty + (h - trunkH) / tiers + 2]], p.foliage[1]);
    }
    px.rim(p.foliage[1], p.foliage[2], p.foliage[0]);
    if (kind === 'snowpine') {
      const snow = hex('#ffffff');
      for (let y = 1; y < h; y++) for (let x = 0; x < w; x++) if (px.get(x, y) && !px.get(x, y - 1) && px.get(x, y) !== p.trunk[1] && px.get(x, y) !== p.trunk[0]) px.set(x, y, snow).set(x, y + 1, p.ground[2]);
    }
  } else {
    // Dead, twisted branches.
    const b = p.trunk[1];
    px.line(cx, h - trunkH, cx - 5, h - trunkH - 6, b).line(cx - 5, h - trunkH - 6, cx - 7, h - trunkH - 9, b);
    px.line(cx + 1, h - trunkH + 3, cx + 6, h - trunkH - 3, b).line(cx + 6, h - trunkH - 3, cx + 5, h - trunkH - 7, b);
    px.line(cx, h - trunkH, cx + 1, 1, b);
  }
  return px.outline(p.ink);
}

function rock(p: Pal, w: number, h: number, r: R = p.rock): Px {
  const px = new Px(w, h);
  ball(px, w / 2, h - h / 2 + 0.5, w / 2 - 1, h / 2 - 1, r);
  return px.outline(p.ink);
}

function crystal(p: Pal, w: number, h: number, r: R): Px {
  const px = new Px(w, h);
  const cx = w / 2;
  px.poly([[cx - 2, h - 1], [cx - 3, h * 0.45], [cx, 1], [cx + 3, h * 0.45], [cx + 2, h - 1]], r[1]);
  px.poly([[cx + 2, h - 1], [cx + 1, h * 0.5], [cx + 4, h * 0.3], [cx + 5, h * 0.6], [cx + 4, h - 1]], r[0]);
  px.line(cx - 1, h * 0.45, cx, 3, r[2]);
  return px.outline(p.ink);
}

function tuft(p: Pal, color: R): Px {
  return new Px(7, 5).stamp(['.a...a.', '.ab.ba.', '..bab..', '.bbabb.', '.......'], { a: color[2], b: color[1] }).outline(p.ink);
}

function flowers(p: Pal, petal: Color, heart: Color): Px {
  return new Px(9, 6).stamp(['.a.....a.', 'aba...aba', '.a..a..a.', '.g.aba.g.', '.g..a..g.', '.........'], { a: petal, b: heart, g: p.foliage[1] });
}

// ---------------------------------------------------------------------------
// Animated pieces

function liquid(p: Pal, t: number, biome: BiomeId): Px {
  const px = new Px(16, 12);
  const l = p.liquid;
  px.ellipse(8, 6, 8, 5.5, l[1]);
  px.ellipse(8, 6.5, 6.5, 4, l[0]);
  // Moving glints.
  const glints = biome === 'volcano' ? [[4, 5], [10, 7], [7, 3]] : [[4, 4], [10, 6], [7, 8]];
  glints.forEach(([x, y], i) => {
    const dx = (t + i) % 3;
    px.set(x + dx, y, l[2]).set(x + dx + 1, y, l[2]);
  });
  const rim = biome === 'frost' ? hex('#ffffff') : p.rock[1];
  return px.outline(rim).outline(p.ink);
}

function torch(p: Pal, t: number): Px {
  const px = new Px(6, 14);
  px.rect(2, 6, 2, 8, p.trunk[1]).rect(1, 5, 4, 2, p.rock[1]);
  const flame = [
    ['..a...', '.aba..', '.bcb..', '..b...'],
    ['...a..', '..aba.', '.abcb.', '..bb..'],
    ['..a...', '..ba..', '.bcba.', '..b...'],
  ][t];
  px.stamp(flame, { a: hex('#ff8a2a'), b: hex('#ffc24a'), c: hex('#fff6c0') }, 0, 1);
  return px.outline(p.ink);
}

function lanternPost(p: Pal, t: number): Px {
  const px = new Px(8, 18);
  px.rect(3, 4, 2, 14, p.trunk[1]).rect(2, 3, 5, 1, p.trunk[1]).rect(6, 3, 1, 4, p.trunk[0]);
  px.rect(5, 7, 3, 4, t ? hex('#fff0b8') : hex('#f3c86a'));
  return px.outline(p.ink);
}

function bannerPole(p: Pal, t: number): Px {
  const px = new Px(10, 24);
  px.rect(1, 1, 1, 23, p.trunk[1]);
  const wave = t ? 1 : 0;
  px.poly([[2, 2], [9, 2 + wave], [8, 8 + wave], [9, 13 + wave], [2, 12]], p.a[1]);
  px.rim(p.a[1], p.a[2], p.a[0]);
  px.set(5, 6 + wave, p.b[2]).set(5, 7 + wave, p.b[1]);
  return px.outline(p.ink);
}

// ---------------------------------------------------------------------------
// Landmarks (one per biome, hand-drawn recipes)

function landmark(biome: BiomeId, p: Pal): Px {
  switch (biome) {
    case 'forest': {
      // An ancient hollow stump with a mossy roof and a door.
      const px = new Px(28, 22);
      ball(px, 14, 14, 12, 8, p.trunk, 0.05);
      px.rect(3, 12, 23, 10, p.trunk[1]).rim(p.trunk[1], p.trunk[1], p.trunk[0]);
      ball(px, 14, 8, 13, 5, p.foliage, 0.1);
      px.ellipse(14, 17, 3, 4, p.ink);
      px.set(16, 17, p.light).set(8, 15, p.light).set(20, 14, p.light);
      return px.outline(p.ink);
    }
    case 'swamp': {
      // A sunken statue head wearing moss.
      const px = new Px(24, 22);
      ball(px, 12, 12, 9, 9, p.rock, 0.05);
      px.rect(5, 18, 15, 4, p.liquid[1]);
      px.rect(8, 10, 2, 2, p.ink).rect(14, 10, 2, 2, p.ink).rect(10, 15, 4, 1, p.ink);
      ball(px, 10, 4, 6, 3, p.foliage);
      return px.outline(p.ink);
    }
    case 'desert': {
      // A leaning obelisk with a sun glyph.
      const px = new Px(16, 32);
      px.poly([[5, 31], [4, 6], [8, 1], [12, 6], [11, 31]], p.rock[1]);
      px.rim(p.rock[1], p.rock[2], p.rock[0]);
      px.ellipse(8, 12, 2, 2, p.b[1]).set(8, 9, p.b[1]).set(8, 15, p.b[1]).set(5, 12, p.b[1]).set(11, 12, p.b[1]);
      return px.outline(p.ink);
    }
    case 'frost': {
      // An ice arch.
      const px = new Px(32, 22);
      for (let a = 0; a <= 180; a += 2) {
        const r = (a * Math.PI) / 180;
        ball(px, 16 + Math.cos(r) * 12, 20 - Math.sin(r) * 16, 3.2, 3.2, p.liquid);
      }
      return px.outline(p.ink);
    }
    case 'iron': {
      // A castle tower with a pennant.
      const px = new Px(22, 40);
      px.rect(4, 12, 14, 28, p.rock[1]).rim(p.rock[1], p.rock[2], p.rock[0]);
      for (let x = 3; x < 19; x += 3) px.rect(x, 9, 2, 3, p.rock[1]);
      px.rect(3, 11, 16, 2, p.rock[2]);
      for (let y = 16; y < 38; y += 4) px.line(4, y, 17, y, p.rock[0]);
      px.rect(9, 20, 3, 5, p.ink).set(10, 21, p.light);
      px.rect(9, 32, 4, 8, p.trunk[0]);
      px.line(11, 9, 11, 1, p.trunk[1]);
      px.poly([[12, 1], [18, 3], [12, 5]], p.a[1]);
      return px.outline(p.ink);
    }
    case 'volcano': {
      // A lava geyser cone.
      const px = new Px(26, 24);
      px.poly([[1, 23], [10, 6], [16, 6], [25, 23]], p.rock[1]);
      px.rim(p.rock[1], p.rock[2], p.rock[0]);
      px.ellipse(13, 6, 3.5, 1.5, p.liquid[1]);
      px.line(12, 7, 9, 15, p.liquid[0]).line(14, 7, 17, 13, p.liquid[0]);
      return px.outline(p.ink);
    }
    case 'astral': {
      // A floating crystal spire.
      const px = new Px(20, 36);
      px.blit(crystal(p, 14, 28, p.liquid), 3, 0);
      ball(px, 10, 30, 9, 4, p.rock);
      px.set(4, 33, p.liquid[2]).set(15, 31, p.liquid[2]);
      return px.outline(p.ink);
    }
  }
}

// ---------------------------------------------------------------------------
// Gate (per biome, 32×28): an arch with doors; open = doors swung away.

function gate(p: Pal, open: boolean): Px {
  const px = new Px(32, 28);
  const stone = p.rock;
  px.rect(2, 6, 6, 22, stone[1]).rect(24, 6, 6, 22, stone[1]);
  for (let a = 0; a <= 180; a += 3) {
    const r = (a * Math.PI) / 180;
    px.rect(Math.round(16 + Math.cos(r) * 11) - 2, Math.round(10 - Math.sin(r) * 8) - 1, 4, 3, stone[1]);
  }
  px.rim(stone[1], stone[2], stone[0]);
  // Keystone glyph in the biome's accent.
  px.rect(15, 1, 3, 3, p.b[1]).set(16, 2, p.light);
  if (!open) {
    px.rect(8, 10, 16, 18, p.trunk[1]);
    px.line(16, 10, 16, 27, p.ink);
    for (let y = 13; y < 27; y += 5) px.line(8, y, 23, y, p.trunk[0]);
    px.set(14, 19, p.b[2]).set(18, 19, p.b[2]);
  } else {
    // Doors swung open, the way through lit.
    px.rect(8, 10, 3, 18, p.trunk[0]).rect(21, 10, 3, 18, p.trunk[0]);
    for (let y = 10; y < 28; y++) for (let x = 11; x < 21; x++) px.set(x, y, withAlpha(p.light, 200));
  }
  return px.outline(p.ink);
}

// ---------------------------------------------------------------------------
// Parallax pieces: soft cloud banks and far silhouettes beside the islands.

function cloud(p: Pal, w: number, h: number, seed: number): Px {
  const px = new Px(w, h);
  const r = rng(seed);
  const col = mix(hex(p.P.sky[1]), hex('#ffffff'), 0.45);
  const shade = mix(hex(p.P.sky[1]), hex(p.P.sky[0]), 0.3);
  for (let i = 0; i < 5; i++) px.ellipse(w * (0.2 + r() * 0.6), h * (0.45 + r() * 0.2), w * (0.14 + r() * 0.12), h * (0.28 + r() * 0.12), col);
  for (let x = 0; x < w; x++) for (let y = h - 1; y >= 0; y--) if (px.get(x, y)) {
    px.set(x, y, shade);
    break;
  }
  return px;
}

function farShape(biome: BiomeId, p: Pal, v: number): Px {
  const col = hex(p.P.layers[v % 2]);
  switch (biome) {
    case 'forest':
    case 'iron': {
      // A far hill with a tree line.
      const px = new Px(40, 22);
      px.ellipse(20, 22, 20, 14, col);
      for (let x = 2; x < 38; x += 5) px.ellipse(x, 10 + (x % 3), 3, 4, col);
      return px;
    }
    case 'swamp':
      return new Px(30, 30).ellipse(15, 18, 12, 10, col).rect(13, 4, 3, 14, col).rect(9, 6, 8, 2, col);
    case 'desert': {
      const px = new Px(40, 20);
      px.poly([[0, 19], [14, 4], [22, 11], [30, 6], [40, 19]], col);
      return px;
    }
    case 'frost': {
      const px = new Px(40, 26);
      px.poly([[0, 25], [16, 2], [24, 12], [30, 7], [40, 25]], col);
      px.poly([[13, 5], [16, 2], [19, 6], [16, 7]], hex('#ffffff'));
      return px;
    }
    case 'volcano': {
      const px = new Px(36, 24);
      px.poly([[0, 23], [14, 5], [22, 5], [36, 23]], col);
      px.rect(15, 4, 6, 1, hex(p.P.liquid[1]));
      return px;
    }
    case 'astral': {
      const px = new Px(24, 20);
      px.ellipse(12, 6, 11, 4, col);
      px.poly([[3, 7], [21, 7], [12, 19]], col);
      return px;
    }
  }
}

// ---------------------------------------------------------------------------
// Node markers (shared shapes, biome colours)

function grave(p: Pal): Px {
  return new Px(10, 12)
    .stamp(['..aaaaa...', '.abbbbba..', '.abkbkba..', '.abbkbba..', '.abkbkba..', '.abbbbba..', '.abbbbba..', 'ggggggggg.'], { a: p.rock[0], b: p.rock[1], k: p.rock[0], g: p.ground[2] }, 0, 3)
    .outline(p.ink);
}

function flag(p: Pal, t: number): Px {
  const px = new Px(10, 14);
  px.rect(2, 1, 1, 13, p.trunk[1]);
  const w = t ? 1 : 0;
  px.poly([[3, 1], [9, 2 + w], [9, 6 + w], [3, 6]], p.b[1]);
  px.set(5, 3 + w, p.b[2]).set(6, 4 + w, p.b[2]);
  return px.outline(p.ink);
}

// ---------------------------------------------------------------------------

interface DecorSpec {
  name: string;
  make: (p: Pal) => Px;
}

const DECOR: Record<BiomeId, DecorSpec[]> = {
  forest: [
    { name: 'tree.a', make: (p) => tree(p, 22, 30, 'round', 'forest.a') },
    { name: 'tree.b', make: (p) => tree(p, 16, 26, 'pine', 'forest.b') },
    { name: 'bush', make: (p) => rock(p, 14, 10, p.foliage) },
    { name: 'rock', make: (p) => rock(p, 11, 8) },
    { name: 'flowers', make: (p) => flowers(p, p.a[1], p.b[1]) },
    { name: 'tuft', make: (p) => tuft(p, p.foliage) },
    { name: 'mushrooms', make: (p) => new Px(10, 8).stamp(['.aa....bb.', 'abba..bccb', '.dd....dd.', '.dd.aa.dd.', '....dd....'], { a: p.a[1], b: p.b[1], c: p.b[2], d: hex('#f3ead8') }, 0, 2).outline(p.ink) },
  ],
  swamp: [
    { name: 'tree.a', make: (p) => tree(p, 20, 30, 'dead', 'swamp.a') },
    { name: 'tree.b', make: (p) => tree(p, 18, 24, 'round', 'swamp.b') },
    { name: 'bush', make: (p) => rock(p, 14, 10, p.foliage) },
    { name: 'rock', make: (p) => rock(p, 12, 8) },
    { name: 'flowers', make: (p) => new Px(8, 12).stamp(['.a....a.', '.b..a.b.', '.b..b.b.', '.bb.b.b.', '..b.bb..', '..bbb...', '...b....', '...b....'], { a: p.b[1], b: p.foliage[1] }, 0, 4).outline(p.ink) },
    { name: 'tuft', make: (p) => tuft(p, p.foliage) },
    { name: 'mushrooms', make: (p) => new Px(9, 8).stamp(['.gg...g..', 'gGGg.gGg.', '.dd...d..', '.dd...d..'], { g: hex('#4fd0b0'), G: hex('#a8ffe8'), d: hex('#c8d8c0') }, 0, 3).outline(p.ink) },
  ],
  desert: [
    { name: 'tree.a', make: (p) => new Px(14, 20).stamp(['.....aa.......', '....abba......', '....abba......', 'aa..abba..aa..', 'ab..abba..ab..', 'ab..abba..ab..', 'abbbabbabbbb..', '.aaaabbaaaa...', '....abba......', '....abba......', '....abba......', '....abba......', '....abba......', '....abba......', '....abba......'], { a: p.foliage[0], b: p.foliage[1] }, 0, 5).rim(p.foliage[1], p.foliage[2], p.foliage[1]).outline(p.ink) },
    { name: 'tree.b', make: (p) => new Px(10, 12).stamp(['...aa.....', '..abba....', 'a.abba....', 'ababba.a..', 'abbbbbab..', '.aabbbba..', '..abba....', '..abba....'], { a: p.foliage[0], b: p.foliage[1] }, 0, 4).outline(p.ink) },
    { name: 'bush', make: (p) => rock(p, 16, 9, p.rock) },
    { name: 'rock', make: (p) => rock(p, 11, 8) },
    { name: 'flowers', make: (p) => new Px(12, 6).stamp(['.a.....a....', 'aaaaaaaaaa..', 'a..a..a..a..', '............'], { a: hex('#efe3c9') }, 0, 2).outline(p.ink) },
    { name: 'tuft', make: (p) => tuft(p, p.ground.slice(1)) },
    { name: 'mushrooms', make: (p) => rock(p, 8, 6, p.a) },
  ],
  frost: [
    { name: 'tree.a', make: (p) => tree(p, 18, 30, 'snowpine', 'frost.a') },
    { name: 'tree.b', make: (p) => tree(p, 14, 22, 'snowpine', 'frost.b') },
    { name: 'bush', make: (p) => rock(p, 14, 10, p.ground.slice(1)) },
    { name: 'rock', make: (p) => rock(p, 12, 9) },
    { name: 'flowers', make: (p) => crystal(p, 10, 14, p.liquid) },
    { name: 'tuft', make: (p) => tuft(p, p.foliage) },
    {
      name: 'mushrooms',
      make: (p) =>
        new Px(10, 14)
          .stamp(['...aa.....', '..abba....', '..bkbk....', '..bbcb....', 'd..bb..d..', '.dabbad...', '.abbbba...', '.bbkbbb...', '.bbbbbb...', '.abbbba...', '..aaaa....'], { a: hex('#c3d0e8'), b: hex('#ffffff'), k: p.ink, c: hex('#ff9a4a'), d: p.trunk[1] }, 0, 3)
          .outline(p.ink),
    },
  ],
  iron: [
    { name: 'tree.a', make: (p) => tree(p, 22, 30, 'round', 'iron.a') },
    { name: 'tree.b', make: (p) => new Px(16, 10).stamp(['a..a..a..a..a...', 'bbbbbbbbbbbbb...', 'a..a..a..a..a...', 'bbbbbbbbbbbbb...', 'a..a..a..a..a...'], { a: p.trunk[1], b: p.trunk[0] }, 0, 4).outline(p.ink) },
    { name: 'bush', make: (p) => new Px(12, 12).stamp(['.aaaaaa.', 'abbbbbba', 'abbbbbba', 'ccccccca', 'abbbbbba', 'abbbbbba', 'ccccccca', 'abbbbbba', '.aaaaaa.'], { a: p.trunk[0], b: p.trunk[1], c: p.rock[0] }, 2, 2).outline(p.ink) },
    { name: 'rock', make: (p) => rock(p, 11, 8) },
    { name: 'flowers', make: (p) => flowers(p, p.a[1], p.b[1]) },
    { name: 'tuft', make: (p) => tuft(p, p.foliage) },
    { name: 'mushrooms', make: (p) => rock(p, 14, 10, p.b) },
  ],
  volcano: [
    { name: 'tree.a', make: (p) => tree(p, 16, 24, 'dead', 'volcano.a') },
    { name: 'tree.b', make: (p) => new Px(10, 20).rect(2, 2, 6, 18, p.rock[1]).rim(p.rock[1], p.rock[2], p.rock[0]).line(4, 4, 4, 18, p.rock[0]).outline(p.ink) },
    { name: 'bush', make: (p) => rock(p, 14, 9, p.rock) },
    { name: 'rock', make: (p) => rock(p, 11, 8) },
    { name: 'flowers', make: (p) => crystal(p, 9, 12, p.b) },
    { name: 'tuft', make: (p) => new Px(8, 5).stamp(['.a..a...', 'abaabaa.', '........'], { a: p.liquid[1], b: p.liquid[2] }, 0, 2) },
    { name: 'mushrooms', make: (p) => rock(p, 8, 6, p.rock) },
  ],
  astral: [
    { name: 'tree.a', make: (p) => crystal(p, 14, 28, p.liquid) },
    { name: 'tree.b', make: (p) => new Px(10, 28).rect(3, 3, 5, 25, p.rock[1]).rim(p.rock[1], p.rock[2], p.rock[0]).rect(2, 2, 7, 2, p.rock[2]).set(5, 10, p.liquid[2]).set(5, 16, p.liquid[2]).outline(p.ink) },
    { name: 'bush', make: (p) => rock(p, 14, 10, p.a) },
    { name: 'rock', make: (p) => rock(p, 11, 8) },
    { name: 'flowers', make: (p) => crystal(p, 8, 10, p.a) },
    { name: 'tuft', make: (p) => new Px(7, 7).stamp(['...a...', '...a...', 'aaabaaa', '...a...', '...a...'], { a: withAlpha(p.b[2], 200), b: hex('#ffffff') }, 0, 1) },
    { name: 'mushrooms', make: (p) => rock(p, 12, 12, p.rock) },
  ],
};

export const DECOR_NAMES = ['tree.a', 'tree.b', 'bush', 'rock', 'flowers', 'tuft', 'mushrooms'] as const;

export function addWorld(reg: Registry): void {
  for (const biome of BIOME_IDS) {
    const p = pal(biome);
    for (const [i, v] of ['a', 'b', 'c'].entries()) reg.add({ id: `tile.${biome}.ground.${v}`, atlas: biome, frames: [ground(p, biome, i)], anchor: [0, 0] });
    reg.add({ id: `tile.${biome}.path.edge`, atlas: biome, frames: [pathBlob(p, true)], anchor: [6, 5] });
    reg.add({ id: `tile.${biome}.path.fill`, atlas: biome, frames: [pathBlob(p, false)], anchor: [6, 5] });
    for (const [i, v] of ['a', 'b'].entries()) {
      reg.add({ id: `tile.${biome}.edge.l.${v}`, atlas: biome, frames: [edge(p, false, i)], anchor: [0, 0] });
      reg.add({ id: `tile.${biome}.edge.r.${v}`, atlas: biome, frames: [edge(p, true, i)], anchor: [0, 0] });
    }
    for (const d of DECOR[biome]) reg.add({ id: `decor.${biome}.${d.name}`, atlas: biome, frames: [d.make(p)] });
    reg.add({ id: `decor.${biome}.landmark`, atlas: biome, frames: [landmark(biome, p)] });
    reg.add({ id: `tile.${biome}.liquid`, atlas: biome, frames: [0, 1, 2].map((t) => liquid(p, t, biome)), fps: 3, loop: true, anchor: [8, 6] });
    const light =
      biome === 'swamp'
        ? [0, 1].map((t) => lanternPost(p, t))
        : biome === 'iron'
          ? [0, 1].map((t) => bannerPole(p, t))
          : [0, 1, 2].map((t) => torch(p, t));
    reg.add({ id: `decor.${biome}.light`, atlas: biome, frames: light, fps: biome === 'iron' ? 2 : 6, loop: true });
    reg.add({ id: `prop.${biome}.gate.closed`, atlas: biome, frames: [gate(p, false)] });
    reg.add({ id: `prop.${biome}.gate.open`, atlas: biome, frames: [gate(p, true)] });
    reg.add({ id: `prop.${biome}.grave`, atlas: biome, frames: [grave(p)] });
    reg.add({ id: `prop.${biome}.flag`, atlas: biome, frames: [0, 1].map((t) => flag(p, t)), fps: 2, loop: true });
    reg.add({ id: `parallax.${biome}.cloud`, atlas: biome, frames: [cloud(p, 36, 14, hashStr(biome + 'c'))], anchor: [0, 0] });
    reg.add({ id: `parallax.${biome}.far.a`, atlas: biome, frames: [farShape(biome, p, 0)], anchor: [0, 0] });
    reg.add({ id: `parallax.${biome}.far.b`, atlas: biome, frames: [farShape(biome, p, 1)], anchor: [0, 0] });
  }
}
