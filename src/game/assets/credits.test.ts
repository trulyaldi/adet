// The in-app Credits (the Scribe) list every licensed pack the game uses,
// and every CC-BY pack is attributed with its author, title and license.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import { PACK_CREDITS } from './credits.generated';

const root = join(__dirname, '..', '..', '..');
const registry = readdirSync(join(root, 'assets/game/packs'))
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join(root, 'assets/game/packs', f), 'utf8')));
const used = registry.filter((p) => Object.keys(p.sprites ?? {}).length || Object.keys(p.sounds ?? {}).length);
const ALLOWED = /^(cc0|cc-by(-\d(\.\d)?)?|public domain|mit|ofl|apache-2\.0)$/i;

test('every pack in use is in the in-app Credits, with author and license', () => {
  assert.ok(used.length > 0);
  for (const p of used) {
    const c = PACK_CREDITS.find((x) => x.title === p.title);
    assert.ok(c, `${p.title} is missing from the Credits screen`);
    assert.equal(c.author, p.author);
    assert.equal(c.license, p.license);
  }
  assert.equal(PACK_CREDITS.length, used.length);
});

test('CC-BY packs are attributed; every pack has an allowed license and its license text', () => {
  for (const p of used) {
    assert.match(p.license, ALLOWED, `${p.name}: ${p.license} is not allowed`);
    assert.ok(existsSync(join(root, 'assets/game/licenses', p.name, 'License.txt')), `${p.name}: license text not kept`);
    if (/^cc-by/i.test(p.license)) assert.ok(PACK_CREDITS.some((c) => c.title === p.title && c.author && c.license === p.license));
  }
  const md = readFileSync(join(root, 'assets/game/CREDITS.md'), 'utf8');
  for (const p of used) assert.ok(md.includes(p.title) && md.includes(p.url), `${p.title} not in CREDITS.md`);
});
