import assert from 'node:assert/strict';
import { test } from 'node:test';

import { daysLeftInWeek, weekPace } from './weeks';

const H = 3600;

/** Run `fn` with the process time zone set to `tz` (Node applies TZ changes immediately). */
function inTZ(tz: string, fn: () => void) {
  const prev = process.env.TZ;
  process.env.TZ = tz;
  try {
    fn();
  } finally {
    if (prev === undefined) delete process.env.TZ;
    else process.env.TZ = prev;
  }
}

test('days left counts today: Monday 7 … Sunday 1', () => {
  inTZ('Asia/Almaty', () => {
    assert.equal(daysLeftInWeek(new Date(2026, 8, 21, 0, 0).getTime()), 7); // Mon Sep 21
    assert.equal(daysLeftInWeek(new Date(2026, 8, 23, 12, 0).getTime()), 5); // Wed
    assert.equal(daysLeftInWeek(new Date(2026, 8, 27, 23, 59).getTime()), 1); // Sun
  });
});

test('week boundaries hold across both DST switches in New York', () => {
  inTZ('America/New_York', () => {
    // Spring forward: Sun Mar 8 2026 skips 02:00–03:00.
    assert.equal(daysLeftInWeek(new Date(2026, 2, 8, 23, 59).getTime()), 1);
    assert.equal(daysLeftInWeek(new Date(2026, 2, 9, 0, 0).getTime()), 7);
    assert.equal(daysLeftInWeek(new Date(2026, 2, 8, 3, 30).getTime()), 1);
    // Fall back: Sun Nov 1 2026 repeats 01:00–02:00.
    assert.equal(daysLeftInWeek(new Date(2026, 10, 1, 1, 30).getTime()), 1);
    assert.equal(daysLeftInWeek(new Date(2026, 10, 2, 0, 0).getTime()), 7);
    assert.equal(daysLeftInWeek(new Date(2026, 9, 26, 0, 0).getTime()), 7); // Mon Oct 26
  });
});

test('the same instant can be a different weekday in different time zones', () => {
  const instant = Date.UTC(2026, 8, 27, 20, 0); // Sun 20:00 UTC
  inTZ('America/New_York', () => assert.equal(daysLeftInWeek(instant), 1)); // Sun 16:00
  inTZ('Asia/Almaty', () => assert.equal(daysLeftInWeek(instant), 7)); // Mon 01:00
});

test('mid-week pace spreads what is left over the remaining days', () => {
  inTZ('Asia/Almaty', () => {
    const wed = new Date(2026, 8, 23, 12, 0).getTime();
    const p = weekPace(2.5 * H, 8, wed);
    assert.equal(p.kind, 'pace');
    assert.equal(p.leftSec, 5.5 * H);
    assert.equal(p.daysLeft, 5);
    assert.equal(p.perDaySec, 3960); // 1.1h
    assert.equal(p.label, '5.5h left · ~1.1h/day for 5 days');
  });
});

test('Monday with nothing done spreads the whole target over 7 days', () => {
  inTZ('Asia/Almaty', () => {
    const p = weekPace(0, 7, new Date(2026, 8, 21, 9, 0).getTime());
    assert.equal(p.label, '7h left · ~1h/day for 7 days');
  });
});

test('small paces show minutes', () => {
  inTZ('Asia/Almaty', () => {
    const p = weekPace(7 * H, 8, new Date(2026, 8, 23, 12, 0).getTime()); // 1h over 5 days
    assert.equal(p.label, '1h left · ~12m/day for 5 days');
  });
});

test('leftover seconds round up to a whole minute', () => {
  inTZ('Asia/Almaty', () => {
    const p = weekPace(8 * H - 30, 8, new Date(2026, 8, 23, 12, 0).getTime());
    assert.equal(p.leftSec, 60);
  });
});

test('Sunday says what is left today', () => {
  inTZ('America/New_York', () => {
    const p = weekPace(5.5 * H, 8, new Date(2026, 2, 8, 18, 0).getTime()); // DST Sunday
    assert.equal(p.kind, 'lastDay');
    assert.equal(p.label, '2.5h left today');
  });
});

test('meeting the target reports how far over it is', () => {
  const now = new Date(2026, 8, 23, 12, 0).getTime();
  assert.deepEqual(
    { kind: weekPace(9.5 * H, 8, now).kind, label: weekPace(9.5 * H, 8, now).label },
    { kind: 'met', label: 'Target met · 1.5h over' }
  );
  assert.equal(weekPace(8 * H, 8, now).label, 'Target met');
  assert.equal(weekPace(8 * H + 30, 8, now).label, 'Target met', 'under a minute over is just met');
});

test('no usable target shows only the hours done', () => {
  const now = new Date(2026, 8, 23, 12, 0).getTime();
  for (const t of [0, -2, NaN]) {
    const p = weekPace(4.5 * H, t, now);
    assert.equal(p.kind, 'noTarget');
    assert.equal(p.targetSec, null);
    assert.equal(p.label, '4.5h this week');
  }
});
