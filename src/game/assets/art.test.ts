// The shipped art: every sprite is licensed pack art or an allowlisted
// stand-in (with a reason), sizes follow the art bible's one pixel density,
// and the stand-in generator can't reach a release build.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { test } from 'node:test';

import { REQUIRED_IDS, sprite } from './manifest';
import { SPRITE_SOURCES } from './sources.generated';

const root = join(__dirname, '..', '..', '..');
const NEEDS_ART: Record<string, string> = JSON.parse(readFileSync(join(root, 'assets/game/needs-art.json'), 'utf8'));
const registry = readdirSync(join(root, 'assets/game/packs'))
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join(root, 'assets/game/packs', f), 'utf8')) as { name: string; sprites?: Record<string, unknown> });

const SOURCE = /^(pack|recolor|composed):[a-z0-9-]+$|^needs-art$/;

test('no sprite is an unlisted placeholder: pack art, or needs-art with a reason', () => {
  const bad = Object.entries(SPRITE_SOURCES).filter(([, s]) => !SOURCE.test(s));
  assert.deepEqual(bad, []);
  const unlisted = Object.entries(SPRITE_SOURCES).filter(([id, s]) => s === 'needs-art' && !(id in NEEDS_ART)).map(([id]) => id);
  assert.deepEqual(unlisted, [], 'stand-ins missing from assets/game/needs-art.json');
  const stale = Object.keys(NEEDS_ART).filter((id) => SPRITE_SOURCES[id] && SPRITE_SOURCES[id] !== 'needs-art');
  assert.deepEqual(stale, [], 'needs-art.json lists ids that now have pack art');
  for (const [id, why] of Object.entries(NEEDS_ART)) assert.ok(why.length > 60 && /Searched:/.test(why), `${id}: the reason must say what is needed and which packs were searched`);
  const counts = Object.values(SPRITE_SOURCES).reduce<Record<string, number>>((a, s) => ({ ...a, [s.split(':')[0]]: (a[s.split(':')[0]] ?? 0) + 1 }), {});
  console.log('  art sources:', counts);
});

test('every mapped pack sprite is what ships for that id', () => {
  for (const p of registry)
    for (const id of Object.keys(p.sprites ?? {})) assert.match(SPRITE_SOURCES[id] ?? '', new RegExp(`^(pack|recolor|composed):${p.name}$`), id);
});

test('one pixel density: sizes are valid for each category', () => {
  const rules: [RegExp, (w: number, h: number) => boolean, string][] = [
    [/^tile\.[a-z]+\.ground\./, (w, h) => w === 16 && h === 16, '16×16 ground tiles'],
    [/^tile\.[a-z]+\.path\./, (w, h) => w <= 16 && h <= 16, 'path blobs within a tile'],
    [/^mob\.[^@]+\.idle$/, (w, h) => w === 16 && h === 16, '16×16 mobs'],
    [/^boss\.[^@]+\.idle$/, (w, h) => [32, 48, 64].includes(w) && w === h, 'bosses drawn natively at 32, 48 or 64'],
    [/^prop\.chest\./, (w, h) => w === 16 && h >= 16 && h <= 20, 'a 16 px chest'],
    [/^(npc|pet)\.[^@]+\.idle$/, (w, h) => w <= 16 && h <= 16, 'NPCs and companions within 16×16'],
  ];
  for (const id of REQUIRED_IDS) {
    const { w, h } = sprite(id);
    for (const [re, ok, what] of rules) if (re.test(id)) assert.ok(ok(w, h), `${id} is ${w}×${h}; expected ${what}`);
  }
});

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(f) ? [p] : [];
  });
}

test('the stand-in generator is dev tooling only: nothing the app bundles imports it', () => {
  const importers = files(join(root, 'src')).filter((f) => /scripts\/(gen-placeholders|art\/|art-sources|pixel\/)/.test(readFileSync(f, 'utf8')) && !f.endsWith('.test.ts'));
  assert.deepEqual(importers.map((f) => relative(root, f)), []);
  const build = readFileSync(join(root, 'scripts/build-atlases.ts'), 'utf8');
  assert.match(build, /unlistedStandIns\(provenance, needsArt\)/, 'build-atlases refuses unlisted stand-ins');
});
