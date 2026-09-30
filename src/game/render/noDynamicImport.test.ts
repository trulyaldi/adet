// No dynamic import() in code that runs on native. In Expo Go an import()
// fetches an async bundle through the dev server; with the connection gone,
// Metro's HMR client calls window.location.reload(), which is undefined on
// native: a red screen. Native loads lazily with require() (render/screens.ts);
// only .web. files (and Node-only tests) may use import().
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { test } from 'node:test';

const root = join(__dirname, '..', '..', '..');
const DYNAMIC = /(?<!typeof\s)\bimport\s*\(\s*['"`]/;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.(tsx?|jsx?)$/.test(f) ? [p] : [];
  });
}

test('no dynamic import() outside .web. files under src/', () => {
  const offenders = files(join(root, 'src'))
    .filter((f) => !/\.web\.[jt]sx?$/.test(f) && !/\.test\.[jt]sx?$/.test(f))
    .flatMap((f) =>
      readFileSync(f, 'utf8')
        .split('\n')
        .map((line, i) => (DYNAMIC.test(line) ? `${relative(root, f)}:${i + 1}` : null))
        .filter((x): x is string => !!x)
    );
  assert.deepEqual(offenders, []);
});

test('the guard itself catches a dynamic import', () => {
  assert.ok(DYNAMIC.test("const load = () => import('./Screen');"));
  assert.ok(!DYNAMIC.test("type M = typeof import('./Screen');"));
});
