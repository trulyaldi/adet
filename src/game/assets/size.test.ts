// The size budget check (scripts/check-size.ts): a budget over its limit
// fails, with a row per atlas.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import { check } from '../../../scripts/check-size';

const budgets = JSON.parse(readFileSync(join(__dirname, '../../../scripts/size-budgets.json'), 'utf8'));

test('within budget passes; one atlas over its limit fails', () => {
  const ok = check({ js: budgets.baselineJsBytes, images: [{ file: 'a.png', bytes: 10_000 }], audio: [{ file: 'x.m4a', bytes: 50_000 }] }, budgets);
  assert.equal(ok.ok, true);
  const big = check({ js: budgets.baselineJsBytes, images: [{ file: 'a.png', bytes: budgets.maxAtlasBytes + 1 }], audio: [] }, budgets);
  assert.equal(big.ok, false);
  assert.ok(big.rows.some((r) => r.what.includes('a.png') && r.bytes > r.budget));
  const js = check({ js: budgets.baselineJsBytes + budgets.jsGrowthBytes + 1, images: [], audio: [] }, budgets);
  assert.equal(js.ok, false);
});

test('the budgets are the ones the polish pass set', () => {
  assert.equal(budgets.jsGrowthBytes, 1.2 * 1024 * 1024 | 0);
  assert.equal(budgets.gameImagesBytes, 2.5 * 1024 * 1024);
  assert.equal(budgets.maxAtlasBytes, 500 * 1024);
  assert.equal(budgets.gameAudioBytes, 4 * 1024 * 1024);
});
