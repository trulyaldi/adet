// Quest copy stays warm and short: every line of world content is 12 words
// or fewer, and no Quest string uses guilt language. Content modules are
// walked as data; screen files are scanned for sentence-like literals.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { test } from 'node:test';

import { fallbackInsight, fallbackRecap } from '../../domain/game/sageFallback';
import { BIOMES } from './biomes';
import { GREETINGS } from './npcs';
import { NPCS, ROSTER } from './roster';
import { SHOP } from './shop';

const root = join(__dirname, '..', '..', '..');
const MAX_WORDS = 12;
/** Guilt and pressure, matched on word boundaries. */
export const BANNED = [
  'failed', 'fail', 'failure', 'missed', 'miss', 'lazy', 'behind', 'lost', 'lose', 'streak broken', 'broke your',
  'disappointed', 'disappointing', 'should have', 'shame', 'guilty', 'wasted', 'penalty', 'punish', 'die', 'died', 'dead', 'death', 'hurry',
];
const bannedIn = (s: string) => BANNED.filter((w) => new RegExp(`\\b${w.replace(' ', '\\s+')}\\b`, 'i').test(s));
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

function strings(v: unknown, path: string, out: [string, string][]) {
  if (typeof v === 'string') out.push([path, v]);
  else if (Array.isArray(v)) v.forEach((x, i) => strings(x, `${path}[${i}]`, out));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) strings(x, `${path}.${k}`, out);
  return out;
}

const content = (): [string, string][] => {
  const out: [string, string][] = [];
  strings(ROSTER, 'ROSTER', out);
  strings(NPCS, 'NPCS', out);
  strings(GREETINGS, 'GREETINGS', out);
  strings(SHOP.map((s) => ({ name: s.name })), 'SHOP', out);
  for (const [id, b] of Object.entries(BIOMES)) strings({ lore: b.lore, boss: b.boss, villagers: (b as { villagerLines?: unknown }).villagerLines }, `BIOMES.${id}`, out);
  // The Sage's local templates, at their longest.
  out.push(['fallbackRecap', fallbackRecap('The Doomscroll Hydra', 99, 99, 99)], ['fallbackRecap(0)', fallbackRecap('The Fog Wisp', 0, 0, 0)]);
  out.push(['fallbackInsight', fallbackInsight([])]);
  return out;
};

test('world content: every line is 12 words or fewer', () => {
  // Recaps are 2–3 sentences by design (the spec's battle report); each sentence still counts.
  const long = content()
    .flatMap(([path, s]) => (path.startsWith('fallbackRecap') ? s.split(/(?<=[.!?])\s+/).map((x) => [path, x] as const) : [[path, s] as const]))
    .filter(([, s]) => words(s) > MAX_WORDS);
  assert.deepEqual(long, []);
});

test('world content: no guilt language', () => {
  assert.deepEqual(content().filter(([, s]) => bannedIn(s).length).map(([p, s]) => `${p}: ${s}`), []);
});

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(f) && !f.endsWith('.test.ts') ? [p] : [];
  });
}

/** Sentence-like literals and JSX text in Quest screens: what a player can read. */
function screenCopy(): [string, string][] {
  const out: [string, string][] = [];
  for (const f of [...files(join(root, 'src/screens/Quest')), ...files(join(root, 'src/game/ui'))]) {
    const src = readFileSync(f, 'utf8');
    const rel = relative(root, f);
    for (const m of src.matchAll(/'([^'\n]{3,})'|"([^"\n]{3,})"|`([^`\n]{3,})`|>\s*([A-Z][^<>{}\n]{2,})\s*</g)) {
      const s = (m[1] ?? m[2] ?? m[3] ?? m[4]).trim();
      // Only prose: starts with a letter, has a space, isn't an id, path or style.
      if (/^[A-Za-z][\w'’,.!?\- ${}()]*$/.test(s) && / /.test(s) && !/^(import|export|use|react)/.test(s)) out.push([rel, s]);
    }
  }
  return out;
}

test('Quest screens: no guilt language in anything a player reads', () => {
  const copy = screenCopy();
  assert.ok(copy.length > 40, `found ${copy.length} strings`);
  assert.deepEqual(copy.filter(([, s]) => bannedIn(s).length).map(([f, s]) => `${f}: ${s}`), []);
});

test('ceremony copy: every line is 12 words or fewer', () => {
  const ceremony = screenCopy().filter(([f]) => f.includes('/ceremonies/'));
  assert.ok(ceremony.length > 5);
  assert.deepEqual(ceremony.filter(([, s]) => words(s.replace(/\$\{[^}]*\}/g, 'X')) > MAX_WORDS), []);
});

test('the banned list matches on word boundaries only', () => {
  assert.deepEqual(bannedIn('You missed a day'), ['missed']);
  assert.deepEqual(bannedIn('Your streak broken?'), ['streak broken']);
  assert.deepEqual(bannedIn('Mission complete, a lost-and-found lantern'), ['lost']);
  assert.deepEqual(bannedIn('Behold the dieselpunk tower'), []);
});

test('game words: one or two words each, and what is spoken includes the plain word', async () => {
  const { WORDS, spoken } = await import('../../domain/words');
  for (const w of Object.values(WORDS)) {
    assert.ok(w.game.split(' ').length <= 2, w.game);
    assert.ok(spoken(w).toLowerCase().includes(w.plain.toLowerCase()), w.game);
  }
});
