// The dev QA tools never write to a synced table. Every module the QA panel
// and art gallery reach (transitively) is checked for imported write
// functions, except the data layer that defines them (src/data, src/store,
// src/sync): the tools reach it only through read hooks such as useData and
// useQuestMeta, and no QA module or component it renders may import a writer.
// The ceremony host is a boundary: the tools may only call its preview() and
// forgetMarks(), which leave synced data and the real high-water marks alone.
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { test } from 'node:test';

import { packShelves } from './packShelves';

const root = join(__dirname, '..', '..', '..', '..');
const QA = [
  ...readdirSync(__dirname).filter((f) => f.endsWith('.tsx') || (f.endsWith('.ts') && !f.endsWith('.test.ts'))).map((f) => join(__dirname, f)),
  join(root, 'src/domain/game/whatIf.ts'),
];
const HOST = join(root, 'src/game/ceremonies/host.tsx');
const ALLOWED_HOST_CALLS = new Set(['preview', 'forgetMarks']);
/** Anything that writes items, links, sessions, habits or quest_meta, or real ceremony marks. */
const WRITES = ['useQuestWrites', 'useActions', 'editQuest', 'saveCeremonyMarks', 'updateQuestLocal', 'setActivePlan', 'pickWeakPoints', 'setQuestTables', 'openLoot'];

/** Where writes are defined (not called): the store, the items repository, sync. */
const DATA_LAYER = /^src\/(data|store|sync)\//;

const IMPORT = /^\s*import\s+(?!type\b)([^'";]*?)\s+from\s+['"]([^'"]+)['"]/gm;

function resolve(from: string, spec: string): string | null {
  const base = join(dirname(from), spec);
  for (const ext of ['.ios.tsx', '.native.tsx', '.tsx', '.ts', '/index.tsx', '/index.ts']) if (existsSync(base + ext)) return base + ext;
  return null;
}

function closure(): Map<string, { names: string[]; from: string }[]> {
  const seen = new Map<string, { names: string[]; from: string }[]>();
  const queue = [...QA];
  while (queue.length) {
    const file = queue.shift()!;
    if (seen.has(file)) continue;
    const imports: { names: string[]; from: string }[] = [];
    for (const [, clause, spec] of readFileSync(file, 'utf8').matchAll(IMPORT)) {
      const names = [...clause.matchAll(/\b([A-Za-z_$][\w$]*)\b(?!\s+as\b)/g)].map((m) => m[1]).filter((n) => n !== 'type' && n !== 'as');
      imports.push({ names, from: spec });
      const next = spec.startsWith('.') ? resolve(file, spec) : null;
      // The host is a boundary (checked below); everything else is walked.
      if (next && next !== HOST) queue.push(next);
    }
    seen.set(file, imports);
  }
  return seen;
}

test('no module the QA tools reach imports a write function', () => {
  const files = closure();
  assert.ok(files.size > 20, `walked ${files.size} modules`);
  const hits = [...files.entries()].filter(([f]) => !DATA_LAYER.test(relative(root, f))).flatMap(([f, imports]) =>
    imports.flatMap((i) => i.names.filter((n) => WRITES.includes(n)).map((n) => `${relative(root, f)} imports ${n} from ${i.from}`))
  );
  assert.deepEqual(hits, []);
});

test('the QA tools call only the ceremony host previews', () => {
  const calls = QA.flatMap((f) => [...readFileSync(f, 'utf8').matchAll(/ceremonyHost\.(\w+)/g)].map((m) => m[1]));
  assert.ok(calls.length >= 2);
  assert.deepEqual(calls.filter((c) => !ALLOWED_HOST_CALLS.has(c)), []);
});

test('the QA tools are reachable only in development builds', () => {
  const tab = readFileSync(join(root, 'src/screens/Quest/QuestTab.tsx'), 'utf8');
  assert.match(tab, /const loadPlayground = __DEV__ \? \(\) => import\('\.\/Playground'\) : null;/);
  assert.match(tab, /\{__DEV__ && playground && loadPlayground &&/);
  const importers = readdirSync(join(root, 'src/screens/Quest')).filter((f) => f.endsWith('.tsx') && /from '\.\/qa\//.test(readFileSync(join(root, 'src/screens/Quest', f), 'utf8')));
  assert.deepEqual(importers, ['Playground.tsx']);
});

test('the gallery packs sprites into rows that fit', () => {
  const size = (id: string) => ({ w: Number(id), h: 16 });
  const { cells, height } = packShelves(['16', '64', '32', '100'], 120, size);
  assert.deepEqual(cells.map((c) => [c.x, c.y]), [[0, 0], [30, 0], [0, 22], [0, 44]]);
  assert.equal(height, 60);
});
