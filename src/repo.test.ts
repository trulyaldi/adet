// Repo hygiene: a temporary QA entry (a harness that replaces the app's
// entry point) must never be committed.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { test } from 'node:test';

const root = join(__dirname, '..');
// Built from parts so this file never matches itself.
const MARKER = ['TEMP', 'QA', 'ENTRY'].join(' ');

export function trackedSources(): string[] {
  return execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' })
    .split('\0')
    .filter((f) => /\.(ts|tsx|js|json)$/.test(f));
}

export function filesWithMarker(files: string[], read: (f: string) => string | null): string[] {
  return files.filter((f) => read(f)?.includes(MARKER));
}

const readIfPresent = (f: string) => {
  const p = join(root, f);
  // A tracked file deleted in the working tree is skipped, not a crash.
  return existsSync(p) ? readFileSync(p, 'utf8') : null;
};

test('no tracked source file is a temporary QA entry', () => {
  assert.deepEqual(filesWithMarker(trackedSources(), readIfPresent), []);
});

test('the guard catches the marker when it is there', () => {
  const fake: Record<string, string> = { 'a.ts': 'ok', 'b.tsx': `// ${MARKER} — do not commit` };
  assert.deepEqual(filesWithMarker(Object.keys(fake), (f) => fake[f]), ['b.tsx']);
});

test("package.json main is the real entry point", () => {
  const main: string = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).main;
  const tracked = new Set(execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).split('\n'));
  assert.notEqual(basename(main), 'index.tsx', 'main points at the QA harness name');
  assert.ok(tracked.has(main), `${main} is not a tracked file`);
  assert.ok(existsSync(join(root, main)), `${main} does not exist`);
});
