import assert from 'node:assert/strict';
import { test } from 'node:test';

import { colSpan, desktopEnabledFrom, layoutFor } from './layout';

test('web is phone below 1024, desktop from 1024, wide from 1600', () => {
  assert.equal(layoutFor(390, 'web').tier, 'phone');
  assert.equal(layoutFor(1023, 'web').tier, 'phone');
  assert.equal(layoutFor(1024, 'web').tier, 'desktop');
  assert.equal(layoutFor(1599, 'web').tier, 'desktop');
  assert.equal(layoutFor(1600, 'web').tier, 'wide');
  assert.equal(layoutFor(2560, 'web').tier, 'wide');
});

test('isDesktop is true for desktop and wide only', () => {
  assert.equal(layoutFor(1023, 'web').isDesktop, false);
  assert.equal(layoutFor(1024, 'web').isDesktop, true);
  assert.equal(layoutFor(1920, 'web').isDesktop, true);
});

test('native is always phone, even on a wide window (iPad)', () => {
  for (const os of ['ios', 'android']) {
    for (const w of [390, 1024, 1366, 1920]) {
      const l = layoutFor(w, os);
      assert.equal(l.tier, 'phone', `${os} ${w}`);
      assert.equal(l.isDesktop, false, `${os} ${w}`);
    }
  }
});

test('the kill switch keeps the phone layout on a wide web window', () => {
  assert.equal(layoutFor(1920, 'web', 1080, false).tier, 'phone');
  assert.equal(layoutFor(1920, 'web', 1080, true).tier, 'wide');
});

test('EXPO_PUBLIC_DESKTOP is on unless explicitly switched off', () => {
  for (const on of [undefined, '', 'true', '1', 'yes', ' TRUE ']) assert.equal(desktopEnabledFrom(on), true, String(on));
  for (const off of ['false', 'FALSE', '0', 'off', 'no', ' false ']) assert.equal(desktopEnabledFrom(off), false, off);
});

test('the layout carries the size and the tokens', () => {
  assert.deepEqual(layoutFor(1920, 'web', 1080, true), {
    tier: 'wide',
    isDesktop: true,
    width: 1920,
    height: 1080,
    sidebarW: 240,
    railW: 360,
    gutter: 32,
  });
});

test('column spans are whole numbers within 12, and phone is the full row', () => {
  assert.equal(colSpan(4, 'desktop'), 4);
  assert.equal(colSpan(4, 'phone'), 12);
  assert.equal(colSpan({ desktop: 8, wide: 6 }, 'wide'), 6);
  assert.equal(colSpan({ desktop: 8 }, 'wide'), 8);
  assert.equal(colSpan({ wide: 3 }, 'desktop'), 12);
  assert.equal(colSpan(0, 'desktop'), 1);
  assert.equal(colSpan(20, 'desktop'), 12);
  assert.equal(colSpan(2.6, 'desktop'), 3);
  assert.equal(colSpan(NaN, 'desktop'), 12);
});
