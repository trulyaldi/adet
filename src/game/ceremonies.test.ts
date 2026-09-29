import assert from 'node:assert/strict';
import { test } from 'node:test';

import { deriveGameState } from '../domain/game/derive';
import * as ops from '../domain/items/ops';
import { ceremonyEvents, pendingCeremonies, primeIds } from './ceremonies';

const D0 = Date.UTC(2026, 8, 1);
const sess = (i: number, min: number) => ({ id: `s${i}`, habitId: 'h1', start: D0 + i * 86_400_000, end: D0 + i * 86_400_000 + min * 60_000, duration: min * 60 });

test('priming records history quietly; only new events play, highest level only', () => {
  const meta = ops.startQuest({ items: [], links: [] }, D0 - 1).items;
  const history = Array.from({ length: 10 }, (_, i) => sess(i, 240));
  const g = deriveGameState({ sessions: history, habits: [{ id: 'h1', weeklyTargetMin: 300 }], items: meta, links: [], now: D0 });
  const primed = primeIds(g);
  assert.ok(primed.includes('rank:Squire'));
  assert.ok(primed.includes('boss:forest:0'));
  assert.deepEqual(pendingCeremonies(g, primed), []);

  const more = deriveGameState({ sessions: [...history, sess(20, 240), sess(21, 240), sess(22, 240)], habits: [{ id: 'h1', weeklyTargetMin: 300 }], items: meta, links: [], now: D0 });
  const next = pendingCeremonies(more, primed);
  assert.ok(next.length > 0);
  assert.ok(next.filter((e) => e.kind === 'level').length <= 1);
  assert.equal(next[0].kind === 'boss' || next[0].kind === 'rank' || next[0].kind === 'level', true);
  assert.equal(ceremonyEvents(more).filter((e) => e.kind === 'level').length, more.xp.level - 1);
});
