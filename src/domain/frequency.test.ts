import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  clampMinMin,
  defaultMinMin,
  frequencyLabel,
  isFixedOn,
  normalizeFrequency,
  parseFrequency,
  weekdayIndex,
  weeklyTargetOf,
} from './frequency';

test('weekly target: 7 for daily, n for n times, one per fixed weekday', () => {
  assert.equal(weeklyTargetOf({ kind: 'daily' }), 7);
  assert.equal(weeklyTargetOf({ kind: 'weekly', times: 3 }), 3);
  assert.equal(weeklyTargetOf({ kind: 'days', days: [0, 3] }), 2);
});

test('normalize: 7 times or all seven days is daily; empty days fall back to once a week', () => {
  assert.deepEqual(normalizeFrequency({ kind: 'weekly', times: 7 }), { kind: 'daily' });
  assert.deepEqual(normalizeFrequency({ kind: 'weekly', times: 0 }), { kind: 'weekly', times: 1 });
  assert.deepEqual(normalizeFrequency({ kind: 'weekly', times: 9 }), { kind: 'daily' });
  assert.deepEqual(normalizeFrequency({ kind: 'days', days: [4, 0, 4, 9] }), { kind: 'days', days: [0, 4] });
  assert.deepEqual(normalizeFrequency({ kind: 'days', days: [0, 1, 2, 3, 4, 5, 6] }), { kind: 'daily' });
  assert.deepEqual(normalizeFrequency({ kind: 'days', days: [] }), { kind: 'weekly', times: 1 });
});

test('parse: synced values, JSON strings and junk', () => {
  assert.deepEqual(parseFrequency({ kind: 'weekly', times: 3 }), { kind: 'weekly', times: 3 });
  assert.deepEqual(parseFrequency('{"kind":"days","days":[1,3]}'), { kind: 'days', days: [1, 3] });
  assert.deepEqual(parseFrequency(null), { kind: 'daily' });
  assert.deepEqual(parseFrequency('nope'), { kind: 'daily' });
  assert.deepEqual(parseFrequency({ kind: 'days', days: ['x'] }), { kind: 'daily' });
});

test('weekdays run Monday (0) to Sunday (6)', () => {
  assert.equal(weekdayIndex(new Date(2026, 8, 28)), 0); // Monday
  assert.equal(weekdayIndex(new Date(2026, 9, 4)), 6); // Sunday
  assert.equal(isFixedOn({ kind: 'days', days: [0, 2] }, 2), true);
  assert.equal(isFixedOn({ kind: 'daily' }, 2), false);
});

test('minimum defaults to 5 minutes, or the full length when shorter, and never exceeds it', () => {
  assert.equal(defaultMinMin(45), 5);
  assert.equal(defaultMinMin(5), 5);
  assert.equal(defaultMinMin(3), 3);
  assert.equal(clampMinMin(20, 15), 15);
  assert.equal(clampMinMin(0, 15), 1);
});

test('spoken labels', () => {
  assert.equal(frequencyLabel({ kind: 'daily' }), 'Every day');
  assert.equal(frequencyLabel({ kind: 'weekly', times: 1 }), 'Once a week');
  assert.equal(frequencyLabel({ kind: 'weekly', times: 3 }), '3 times a week');
  assert.equal(frequencyLabel({ kind: 'days', days: [0, 2, 4] }), 'Monday, Wednesday and Friday');
});
