import assert from 'node:assert/strict';
import { test } from 'node:test';

import * as ops from '../items/ops';
import * as B from './balance';
import { DeriveInput, deriveGameState } from './derive';
import { fixedTz } from './tz';
import { isWhatIfOff, NO_WHAT_IF, whatIfGame, withWhatIf } from './whatIf';

const D0 = Date.UTC(2026, 8, 1, 12);
const real: DeriveInput = {
  sessions: [{ id: 's1', habitId: 'h1', start: D0 - 40 * 60_000 - 86_400_000, end: D0 - 86_400_000, duration: 2400 }],
  habits: [{ id: 'h1', weeklyTargetMin: 300 }],
  items: ops.startQuest({ items: [], links: [] }, D0 - 2 * 86_400_000).items,
  links: [],
  now: D0,
  tz: fixedTz(0),
};

test('off: the what-if game is exactly the real game, and the input is untouched', () => {
  const before = JSON.stringify(real);
  assert.ok(isWhatIfOff(NO_WHAT_IF));
  assert.deepEqual(whatIfGame(real, NO_WHAT_IF), deriveGameState(real));
  assert.equal(withWhatIf(real, NO_WHAT_IF), real);
  whatIfGame(real, { sessions: [{ habitId: 'h1', minutes: 30, weakPoint: true }], bossHp: 0.5 });
  assert.equal(JSON.stringify(real), before);
});

test('a synthetic session adds its minutes as XP and damage', () => {
  const base = deriveGameState(real);
  const g = whatIfGame(real, { sessions: [{ habitId: 'h1', minutes: 30 }] });
  assert.equal(g.xp.total - base.xp.total, 30);
  assert.equal(g.journey.totalDamage - base.journey.totalDamage, 30);
});

test('a completed weak point adds a crit and task XP through a claimed chest', () => {
  const plain = whatIfGame(real, { sessions: [{ habitId: 'h1', minutes: 30 }] });
  const withTask = whatIfGame(real, { sessions: [{ habitId: 'h1', minutes: 30, weakPoint: true }] });
  assert.equal(withTask.journey.totalDamage - plain.journey.totalDamage, B.CRIT_DAMAGE);
  assert.equal(withTask.xp.total - plain.xp.total, B.TASK_XP);
});

test('before onboarding, what-if sessions still move a (synthetic) journey', () => {
  const fresh = { ...real, items: [] };
  assert.equal(deriveGameState(fresh).journey.started, false);
  const g = whatIfGame(fresh, { sessions: [{ habitId: 'h1', minutes: 60 }] });
  assert.equal(g.journey.started, true);
  assert.ok(g.journey.totalDamage >= 60);
});

test('boss HP puts the current biome boss at that share of its HP', () => {
  const g = whatIfGame(real, { sessions: [], bossHp: 0.25 });
  assert.equal(g.journey.position.kind, 'boss');
  assert.equal(g.journey.position.biomeIndex, deriveGameState(real).journey.position.biomeIndex);
  assert.equal(g.journey.hp, Math.round(0.25 * g.journey.bossMaxHp));
});

test('a synthetic week: sessions placed days back; quick logs in memory; the real input is untouched', () => {
  const before = JSON.stringify(real);
  const w = { sessions: Array.from({ length: 7 }, (_, d) => ({ habitId: 'h1', minutes: 30, daysAgo: d })), quickLogs: 2 };
  const i = withWhatIf(real, w);
  const qa = i.sessions.filter((s) => s.id.startsWith('qa:'));
  assert.equal(qa.length, 7);
  assert.deepEqual(qa.map((s) => Math.round((real.now - s.end) / 86_400_000)), [0, 1, 2, 3, 4, 5, 6]);
  assert.equal(i.items.filter((x) => x.id.startsWith('qa:q')).length, 2);
  assert.equal(JSON.stringify(real), before);
});

test('seal overrides are a view patch: counts change, and a boss at 0 HP staggers or not', () => {
  const g = whatIfGame(real, { sessions: [], bossHp: 0, seals: { days: 99, depth: 99, insight: 0 } });
  const byKind = Object.fromEntries(g.journey.seals.map((s) => [s.kind, s.have]));
  assert.equal(byKind.insight, 0);
  assert.equal(g.journey.staggered, true);
  const full = whatIfGame(real, { sessions: [], bossHp: 0, seals: { days: 99, depth: 99, insight: 99 } });
  assert.equal(full.journey.staggered, false);
});
