// App start never loads Skia. Screens that draw with it are behind SkiaGate's
// dynamic import(); on web, Skia needs CanvasKit (WebAssembly) first, so an
// eager import would break start-up. This walks the static imports from the
// entry point the way Metro resolves them, per platform.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { test } from 'node:test';

const root = join(__dirname, '..', '..');
// Static imports and re-exports only: `import(` (lazy) and `import type` don't count.
const IMPORT = /^\s*(?:import|export)\s+(?!type\b)(?:[^'";]*?\sfrom\s+)?['"]([^'"]+)['"]/gm;

function resolve(from: string, spec: string, platform: 'native' | 'web'): string | null {
  const base = join(dirname(from), spec);
  const exts = platform === 'web' ? ['.web.tsx', '.web.ts', '.tsx', '.ts', '.js'] : ['.ios.tsx', '.native.tsx', '.ios.ts', '.native.ts', '.tsx', '.ts', '.js'];
  for (const ext of ['', ...exts, ...exts.map((e) => `/index${e}`)]) {
    const p = base + ext;
    if (ext !== '' && existsSync(p)) return p;
    if (ext === '' && /\.(tsx?|js)$/.test(p) && existsSync(p)) return p;
  }
  return null;
}

/** Every package a platform's start-up imports, with one path that leads to it. */
export function startupPackages(platform: 'native' | 'web'): Map<string, string[]> {
  const entry = join(root, JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).main);
  const parent = new Map<string, string | null>([[entry, null]]);
  const packages = new Map<string, string[]>();
  const chain = (f: string) => {
    const out = [];
    for (let at: string | null = f; at; at = parent.get(at) ?? null) out.push(relative(root, at));
    return out;
  };
  const queue = [entry];
  while (queue.length) {
    const file = queue.shift()!;
    for (const [, spec] of readFileSync(file, 'utf8').matchAll(IMPORT)) {
      if (!spec.startsWith('.')) {
        if (!packages.has(spec)) packages.set(spec, chain(file));
        continue;
      }
      const next = resolve(file, spec, platform);
      if (next && !parent.has(next)) {
        parent.set(next, file);
        queue.push(next);
      }
    }
  }
  return packages;
}

// The web loader (WithSkiaWeb) is the one Skia module allowed at start: it
// fetches CanvasKit only when a gated screen first mounts.
const WEB_LOADER = '@shopify/react-native-skia/lib/module/web';

for (const platform of ['native', 'web'] as const) {
  test(`${platform}: start-up imports no Skia`, () => {
    const pkgs = startupPackages(platform);
    assert.ok(pkgs.size > 10, 'the walk found the app');
    const skia = [...pkgs.entries()].filter(([p]) => p.startsWith('@shopify/react-native-skia') && p !== WEB_LOADER);
    assert.deepEqual(skia.map(([p, path]) => `${p} ← ${path.join(' ← ')}`), []);
  });
}
