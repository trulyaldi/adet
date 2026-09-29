import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { GameState } from '../../domain/game/derive';
import { BIOMES } from './biomes';
import { bossLine, echoQuote } from './bossLines';

const game = (entries: string[]) => ({ sessions: entries.map((chronicle) => ({ chronicle })) }) as unknown as GameState;

test('a boss speaks its three pre-fight lines in turn', () => {
  const g = game([]);
  const lines = [0, 1, 2, 3].map((n) => bossLine(g, 'forest', n));
  assert.deepEqual(lines, [...BIOMES.forest.boss.before, BIOMES.forest.boss.before[0]]);
});

test('the Hollow Echo quotes a short past entry back, never a long one', () => {
  assert.equal(echoQuote(game(['x'.repeat(60), 'ab']), 0), null);
  const g = game(['shipped the OTP flow']);
  assert.equal(echoQuote(g, 7), 'You wrote: "shipped the OTP flow". You can do this.');
  assert.equal(bossLine(g, 'astral', BIOMES.astral.boss.before.length), 'You wrote: "shipped the OTP flow". You can do this.');
  assert.equal(bossLine(game([]), 'astral', 0), BIOMES.astral.boss.before[0]);
});
