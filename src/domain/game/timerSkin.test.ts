// The timer skins' pure rules: the preference and its mapping from the old
// scenes, the clocks they draw, and the focus screen's four zones.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { DEFAULT_TIMER_SKIN, fireLevel, focusLayout, hpPips, resolveTimerSkin, sandAt, skinProgress, starsShown, STAGE_MAX_SHARE, STAGE_MIN_SHARE, sunAt, TIMER_SKINS } from './timerSkin';

test('a chosen skin wins; else the old scene maps; else the default', () => {
  for (const s of TIMER_SKINS) assert.equal(resolveTimerSkin(s, 'plant'), s);
  assert.equal(resolveTimerSkin(undefined, 'orbit'), 'sun');
  assert.equal(resolveTimerSkin(null, 'constellation'), 'campfire');
  assert.equal(resolveTimerSkin(null, 'fill'), 'hourglass');
  assert.equal(resolveTimerSkin(null, 'plant'), 'trail');
  assert.equal(resolveTimerSkin('ring', 'nebula'), DEFAULT_TIMER_SKIN);
  assert.equal(resolveTimerSkin(42, undefined), DEFAULT_TIMER_SKIN);
  assert.equal(resolveTimerSkin(null, 'toString'), DEFAULT_TIMER_SKIN, 'no prototype keys');
});

test('skin progress clamps, flags the target, and moves per minute with reduced motion', () => {
  assert.deepEqual(skinProgress(0, 3600, false), { progress: 0, past: false });
  assert.deepEqual(skinProgress(1800, 3600, false), { progress: 0.5, past: false });
  assert.deepEqual(skinProgress(5400, 3600, false), { progress: 1, past: true });
  assert.equal(skinProgress(119, 3600, true).progress, 60 / 3600);
  assert.equal(skinProgress(-5, 3600, false).progress, 0);
  assert.deepEqual(skinProgress(10, 0, false), { progress: 1, past: true });
});

test('the sun rises, peaks at half time, and the sky never goes dark', () => {
  assert.ok(sunAt(0).x < sunAt(0.5).x && sunAt(0.5).x < sunAt(1).x);
  assert.equal(sunAt(0.5).lift, 1);
  assert.ok(sunAt(0).lift < 1e-9 && sunAt(1).lift < 1e-9);
  for (let p = 0; p <= 1; p += 0.05) assert.ok(sunAt(p).warmth <= 0.6);
  assert.equal(sunAt(0.5).warmth, 0);
});

test('the fire only grows; stars and sand follow the time', () => {
  assert.ok(fireLevel(0) >= 0.4);
  for (let p = 0; p < 1; p += 0.1) assert.ok(fireLevel(p + 0.1) >= fireLevel(p));
  assert.equal(starsShown(0, 12), 0);
  assert.equal(starsShown(0.5, 12), 6);
  assert.equal(starsShown(2, 12), 12);
  assert.deepEqual(sandAt(0.25), { top: 0.75, bottom: 0.25 });
});

test('HP pips: whole pips, a sliver shows one, none at zero', () => {
  assert.equal(hpPips(90, 90, 10), 10);
  assert.equal(hpPips(1, 90, 10), 1);
  assert.equal(hpPips(0, 90, 10), 0);
  assert.equal(hpPips(45, 90, 10), 5);
  assert.equal(hpPips(5, 0, 10), 0);
});

test('four zones in order; the Stage takes 45–55% from an SE to a Pro Max', () => {
  for (const [h, top, bottom] of [
    [667, 20, 0], // iPhone SE
    [844, 47, 34], // iPhone 14
    [932, 59, 34], // Pro Max
  ]) {
    const l = focusLayout(h, top, bottom);
    assert.ok(l.headerTop >= top);
    assert.ok(l.plateTop >= l.headerTop + l.headerH, `plate below the header at ${h}`);
    assert.ok(l.stageTop >= l.plateTop + l.plateH, `stage below the plate at ${h}`);
    assert.ok(l.controlsTop >= l.stageTop + l.stageH, `controls below the stage at ${h}`);
    assert.ok(l.controlsTop + l.controlsH <= h - bottom);
    assert.ok(l.stageH >= h * STAGE_MIN_SHARE - 1 && l.stageH <= h * STAGE_MAX_SHARE, `stage share at ${h}: ${l.stageH / h}`);
    assert.equal(l.digits % 8, 0);
  }
});

test('a very short screen shrinks the digits before the Stage', () => {
  const tall = focusLayout(932, 59, 34);
  const short = focusLayout(480, 20, 0);
  assert.ok(short.digits < tall.digits);
  assert.ok(short.stageH > 0);
});
