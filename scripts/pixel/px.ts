// A tiny pixel-art canvas for authoring sprites in code: palette-indexed
// ASCII stamps, shapes, outlines and shading. Colours are 0xRRGGBBAA;
// 0 is transparent. Node-only (build scripts).

export type Color = number;

export function hex(h: string, alpha = 255): Color {
  const s = h.replace('#', '');
  const full = s.length === 3 ? s.split('').map((c) => c + c).join('') : s;
  const n = parseInt(full.slice(0, 6), 16);
  const a = full.length === 8 ? parseInt(full.slice(6, 8), 16) : alpha;
  return ((n << 8) | a) >>> 0;
}

export const rgba = (c: Color) => [(c >>> 24) & 255, (c >>> 16) & 255, (c >>> 8) & 255, c & 255] as const;
export const alphaOf = (c: Color) => c & 255;
export const withAlpha = (c: Color, a: number) => ((c & 0xffffff00) | (Math.max(0, Math.min(255, Math.round(a))) & 255)) >>> 0;

/** Linear mix of two colours (t = 0 → a). */
export function mix(a: Color, b: Color, t: number): Color {
  const A = rgba(a);
  const B = rgba(b);
  const m = (i: number) => Math.round(A[i] + (B[i] - A[i]) * t);
  return (((m(0) << 24) | (m(1) << 16) | (m(2) << 8) | m(3)) >>> 0) as Color;
}

/** Seeded PRNG (mulberry32): the same art on every build. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** 4×4 Bayer matrix, for ordered dithering (values 0–15). */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export const bayer = (x: number, y: number) => BAYER[(y & 3) * 4 + (x & 3)] / 16;

export class Px {
  readonly w: number;
  readonly h: number;
  readonly data: Uint32Array;

  constructor(w: number, h: number, data?: Uint32Array) {
    this.w = w;
    this.h = h;
    this.data = data ?? new Uint32Array(w * h);
  }

  in(x: number, y: number) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }
  get(x: number, y: number): Color {
    return this.in(x, y) ? this.data[y * this.w + x] : 0;
  }
  set(x: number, y: number, c: Color): this {
    x = Math.round(x);
    y = Math.round(y);
    if (this.in(x, y)) this.data[y * this.w + x] = c;
    return this;
  }
  /** Set only where already opaque / only where empty. */
  setIf(x: number, y: number, c: Color, where: 'opaque' | 'empty'): this {
    const cur = this.get(Math.round(x), Math.round(y));
    if ((where === 'opaque') === (cur !== 0)) this.set(x, y, c);
    return this;
  }
  clone(): Px {
    return new Px(this.w, this.h, new Uint32Array(this.data));
  }
  clear(): this {
    this.data.fill(0);
    return this;
  }

  rect(x: number, y: number, w: number, h: number, c: Color): this {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
    return this;
  }
  /** Filled ellipse centred on (cx, cy); half-pixel centres give even widths. */
  ellipse(cx: number, cy: number, rx: number, ry: number, c: Color | ((x: number, y: number, nx: number, ny: number) => Color | null)): this {
    const x0 = Math.floor(cx - rx - 1);
    const x1 = Math.ceil(cx + rx + 1);
    const y0 = Math.floor(cy - ry - 1);
    const y1 = Math.ceil(cy + ry + 1);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const nx = (x + 0.5 - cx) / rx;
        const ny = (y + 0.5 - cy) / ry;
        if (nx * nx + ny * ny <= 1) {
          const col = typeof c === 'function' ? c(x, y, nx, ny) : c;
          if (col !== null) this.set(x, y, col);
        }
      }
    }
    return this;
  }
  line(x0: number, y0: number, x1: number, y1: number, c: Color): this {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
    return this;
  }
  /** Thick line: a disc of radius r stamped along it. */
  stroke(x0: number, y0: number, x1: number, y1: number, r: number, c: Color): this {
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      this.ellipse(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r, r, c);
    }
    return this;
  }
  /** Filled polygon (even-odd). */
  poly(pts: [number, number][], c: Color): this {
    let ymin = Infinity;
    let ymax = -Infinity;
    for (const [, y] of pts) {
      ymin = Math.min(ymin, y);
      ymax = Math.max(ymax, y);
    }
    for (let y = Math.floor(ymin); y <= Math.ceil(ymax); y++) {
      const yc = y + 0.5;
      const xs: number[] = [];
      for (let i = 0; i < pts.length; i++) {
        const [ax, ay] = pts[i];
        const [bx, by] = pts[(i + 1) % pts.length];
        if ((ay <= yc && by > yc) || (by <= yc && ay > yc)) xs.push(ax + ((yc - ay) / (by - ay)) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        for (let x = Math.ceil(xs[k] - 0.5); x <= Math.floor(xs[k + 1] - 0.5); x++) this.set(x, y, c);
      }
    }
    return this;
  }

  /**
   * Stamp an ASCII grid. Each char maps to a colour; '.' and ' ' are
   * transparent (and leave what's there).
   */
  stamp(grid: string[], map: Record<string, Color>, ox = 0, oy = 0): this {
    for (let y = 0; y < grid.length; y++) {
      const row = grid[y];
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch === '.' || ch === ' ') continue;
        const c = map[ch];
        if (c === undefined) throw new Error(`stamp: no colour for '${ch}'`);
        this.set(ox + x, oy + y, c);
      }
    }
    return this;
  }

  blit(src: Px, ox: number, oy: number, opts: { flipX?: boolean; tint?: (c: Color) => Color } = {}): this {
    for (let y = 0; y < src.h; y++) {
      for (let x = 0; x < src.w; x++) {
        let c = src.data[y * src.w + (opts.flipX ? src.w - 1 - x : x)];
        if (!c) continue;
        if (opts.tint) c = opts.tint(c);
        const a = alphaOf(c);
        if (a === 255) this.set(ox + x, oy + y, c);
        else {
          const under = this.get(ox + x, oy + y);
          this.set(ox + x, oy + y, under ? withAlpha(mix(under, c, a / 255), Math.max(alphaOf(under), a)) : c);
        }
      }
    }
    return this;
  }

  /** A 1-pixel outline around opaque pixels (4-neighbour; `diagonal` adds corners). */
  outline(c: Color, diagonal = false): this {
    const src = new Uint32Array(this.data);
    const at = (x: number, y: number) => (x >= 0 && y >= 0 && x < this.w && y < this.h ? src[y * this.w + x] : 0);
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (at(x, y)) continue;
        const n = at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1);
        const d = diagonal && (at(x - 1, y - 1) || at(x + 1, y - 1) || at(x - 1, y + 1) || at(x + 1, y + 1));
        if (n || d) this.data[y * this.w + x] = c;
      }
    }
    return this;
  }

  /**
   * Light from the top-left: pixels of `base` whose upper/left neighbour is
   * empty (or another colour) get `light`; lower/right edges get `dark`.
   */
  rim(base: Color, light: Color | null, dark: Color | null): this {
    const src = new Uint32Array(this.data);
    const at = (x: number, y: number) => (x >= 0 && y >= 0 && x < this.w && y < this.h ? src[y * this.w + x] : 0);
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (src[y * this.w + x] !== base) continue;
        if (dark !== null && (at(x, y + 1) !== base || at(x + 1, y) !== base) && at(x, y + 1) !== base) this.data[y * this.w + x] = dark;
        else if (light !== null && (at(x, y - 1) !== base || at(x - 1, y) !== base) && at(x, y - 1) !== base) this.data[y * this.w + x] = light;
      }
    }
    return this;
  }

  replace(from: Color, to: Color): this {
    for (let i = 0; i < this.data.length; i++) if (this.data[i] === from) this.data[i] = to;
    return this;
  }
  /** Remap colours through a table (palette swap). */
  remap(table: Map<Color, Color>): this {
    for (let i = 0; i < this.data.length; i++) {
      const to = table.get(this.data[i]);
      if (to !== undefined) this.data[i] = to;
    }
    return this;
  }
  /** Every opaque pixel in one colour (hit flash, shadows). */
  silhouette(c: Color): Px {
    const out = this.clone();
    for (let i = 0; i < out.data.length; i++) if (out.data[i]) out.data[i] = alphaOf(out.data[i]) === 255 ? c : withAlpha(c, alphaOf(out.data[i]));
    return out;
  }
  flipX(): Px {
    const out = new Px(this.w, this.h);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) out.data[y * this.w + x] = this.data[y * this.w + (this.w - 1 - x)];
    return out;
  }
  /** Move rows [y0, y1) by dy (squash/bob a part of a sprite). */
  shiftRows(y0: number, y1: number, dy: number): Px {
    const out = this.clone();
    for (let y = y0; y < y1; y++) for (let x = 0; x < this.w; x++) out.data[y * this.w + x] = 0;
    for (let y = y0; y < y1; y++) {
      const ty = y + dy;
      if (ty < 0 || ty >= this.h) continue;
      for (let x = 0; x < this.w; x++) {
        const c = this.data[y * this.w + x];
        if (c) out.data[ty * this.w + x] = c;
      }
    }
    return out;
  }
  shift(dx: number, dy: number): Px {
    const out = new Px(this.w, this.h);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const c = this.data[y * this.w + x];
      if (c && this.in(x + dx, y + dy)) out.data[(y + dy) * this.w + x + dx] = c;
    }
    return out;
  }
  /** Resize the canvas (content anchored bottom-centre, or at `ox, oy`). */
  pad(w: number, h: number, ox = Math.floor((w - this.w) / 2), oy = h - this.h): Px {
    return new Px(w, h).blit(this, ox, oy);
  }
  /** Bounding box of opaque pixels. */
  bounds(): { x: number; y: number; w: number; h: number } | null {
    let x0 = this.w;
    let y0 = this.h;
    let x1 = -1;
    let y1 = -1;
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (this.data[y * this.w + x]) {
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    }
    return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }
  /** Distinct opaque colours (palette checks). */
  colors(): Set<Color> {
    const s = new Set<Color>();
    for (const c of this.data) if (c) s.add(c);
    return s;
  }
  /** Scale up by an integer (previews). */
  scale(k: number): Px {
    const out = new Px(this.w * k, this.h * k);
    for (let y = 0; y < out.h; y++) for (let x = 0; x < out.w; x++) out.data[y * out.w + x] = this.data[Math.floor(y / k) * this.w + Math.floor(x / k)];
    return out;
  }
  /** Raw RGBA bytes (for PNG encoding). */
  toRGBA(): Buffer {
    const buf = Buffer.alloc(this.w * this.h * 4);
    for (let i = 0; i < this.data.length; i++) {
      const c = this.data[i];
      buf[i * 4] = (c >>> 24) & 255;
      buf[i * 4 + 1] = (c >>> 16) & 255;
      buf[i * 4 + 2] = (c >>> 8) & 255;
      buf[i * 4 + 3] = c & 255;
    }
    return buf;
  }
  static fromRGBA(w: number, h: number, buf: Uint8Array): Px {
    const px = new Px(w, h);
    for (let i = 0; i < w * h; i++) {
      const a = buf[i * 4 + 3];
      px.data[i] = a ? (((buf[i * 4] << 24) | (buf[i * 4 + 1] << 16) | (buf[i * 4 + 2] << 8) | a) >>> 0) : 0;
    }
    return px;
  }
}

/** Value noise in [0, 1) on an integer lattice, smoothly interpolated. */
export function valueNoise(seed: number) {
  const h = (x: number, y: number) => {
    let n = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 2147483647)) | 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  };
  const s = (t: number) => t * t * (3 - 2 * t);
  return (x: number, y: number) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = s(x - xi);
    const yf = s(y - yi);
    const a = h(xi, yi);
    const b = h(xi + 1, yi);
    const c = h(xi, yi + 1);
    const d = h(xi + 1, yi + 1);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  };
}
