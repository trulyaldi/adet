// Every character the app writes in its strings has a glyph in the pixel font
// (no missing-glyph boxes), read from the font's own cmap table.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { test } from 'node:test';

const root = join(__dirname, '..', '..', '..');
const FONT = join(root, 'node_modules/@expo-google-fonts/tiny5/400Regular/Tiny5_400Regular.ttf');

/** Code points mapped by a TrueType font (cmap formats 4 and 12). */
export function fontCodePoints(buf: Buffer): Set<number> {
  const tables = buf.readUInt16BE(4);
  let cmap = -1;
  for (let i = 0; i < tables; i++) if (buf.toString('latin1', 12 + i * 16, 16 + i * 16) === 'cmap') cmap = buf.readUInt32BE(12 + i * 16 + 8);
  assert.ok(cmap >= 0, 'font has a cmap');
  const out = new Set<number>();
  const n = buf.readUInt16BE(cmap + 2);
  for (let i = 0; i < n; i++) {
    const off = cmap + buf.readUInt32BE(cmap + 4 + i * 8 + 4);
    const format = buf.readUInt16BE(off);
    if (format === 4) {
      const segs = buf.readUInt16BE(off + 6) / 2;
      const ends = off + 14;
      const starts = ends + segs * 2 + 2;
      const deltas = starts + segs * 2;
      const ranges = deltas + segs * 2;
      for (let s = 0; s < segs; s++) {
        const end = buf.readUInt16BE(ends + s * 2);
        const start = buf.readUInt16BE(starts + s * 2);
        const delta = buf.readInt16BE(deltas + s * 2);
        const range = buf.readUInt16BE(ranges + s * 2);
        for (let c = start; c <= end && c !== 0xffff; c++) {
          let g: number;
          if (range === 0) g = (c + delta) & 0xffff;
          else {
            const at = ranges + s * 2 + range + (c - start) * 2;
            g = buf.readUInt16BE(at);
            if (g) g = (g + delta) & 0xffff;
          }
          if (g) out.add(c);
        }
      }
    } else if (format === 12) {
      const groups = buf.readUInt32BE(off + 12);
      for (let k = 0; k < groups; k++) {
        const start = buf.readUInt32BE(off + 16 + k * 12);
        const end = buf.readUInt32BE(off + 20 + k * 12);
        for (let c = start; c <= end; c++) out.add(c);
      }
    }
  }
  return out;
}

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(f) && !/\.test\./.test(f) ? [p] : [];
  });
}

// String literals, template text and JSX text.
const STRINGS = /'([^'\n\\]*)'|`([^`\n\\]*)`|>([^<>{}\n]+)</g;

test('the pixel font has every character the app writes', () => {
  const have = fontCodePoints(readFileSync(FONT));
  const missing = new Map<string, string>();
  for (const f of files(join(root, 'src'))) {
    for (const m of readFileSync(f, 'utf8').matchAll(STRINGS)) {
      for (const ch of (m[1] ?? m[2] ?? m[3] ?? '')) {
        const cp = ch.codePointAt(0)!;
        if (cp < 32 || cp === 0xfe0f || have.has(cp) || missing.has(ch)) continue;
        missing.set(ch, relative(root, f));
      }
    }
  }
  assert.deepEqual([...missing].map(([c, f]) => `${c} (U+${c.codePointAt(0)!.toString(16)}) in ${f}`), []);
});

test('the cmap reader sees the digits and letters that used to blur', () => {
  const have = fontCodePoints(readFileSync(FONT));
  for (const ch of '0123456789SCOB+−×/%') assert.ok(have.has(ch.codePointAt(0)!), ch);
  assert.ok(!have.has(0x2713), 'no ✓ glyph (PixelCheck draws it)');
});
