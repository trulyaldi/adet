import assert from 'node:assert/strict';
import { test } from 'node:test';

import { clampReminderHours, DEFAULT_REMINDER_HOURS, MAX_REMINDER_HOURS, reminderFireAt } from './reminder';

const T0 = new Date(2026, 6, 10, 9, 0, 0).getTime();
const HOUR = 3600 * 1000;

test('a fresh running timer fires N hours after it started', () => {
  assert.equal(reminderFireAt({ habitId: 'h1', startedAt: T0, baseSec: 0 }, 3), T0 + 3 * HOUR);
});

test('time tracked before a pause counts toward the reminder after resume', () => {
  // Ran 1h, paused, resumed at T0: 2h left of a 3h reminder.
  assert.equal(reminderFireAt({ habitId: 'h1', startedAt: T0, baseSec: 3600 }, 3), T0 + 2 * HOUR);
});

test('a timer already past N hours returns a time in the past', () => {
  const at = reminderFireAt({ habitId: 'h1', startedAt: T0, baseSec: 4 * 3600 }, 3);
  assert.equal(at, T0 - HOUR);
});

test('nothing to schedule without a timer, while paused, or with reminders off', () => {
  assert.equal(reminderFireAt(null, 3), null);
  assert.equal(reminderFireAt({ habitId: 'h1', startedAt: null, baseSec: 600 }, 3), null);
  assert.equal(reminderFireAt({ habitId: 'h1', startedAt: T0, baseSec: 0 }, 0), null);
});

test('clampReminderHours keeps whole hours in 0..max and defaults bad input', () => {
  assert.equal(clampReminderHours(5), 5);
  assert.equal(clampReminderHours(2.6), 3);
  assert.equal(clampReminderHours(-1), 0);
  assert.equal(clampReminderHours(99), MAX_REMINDER_HOURS);
  assert.equal(clampReminderHours(undefined), DEFAULT_REMINDER_HOURS);
  assert.equal(clampReminderHours('4'), DEFAULT_REMINDER_HOURS);
});
