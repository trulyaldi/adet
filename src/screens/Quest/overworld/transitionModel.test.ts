import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { cloudEdge, coverOf, focalShift, mapOpacityOf, quantize, zoomOf, ZOOM_SCALE } from './transitionModel';

describe('the cloud transition', () => {
  it('moves in whole steps and lands exactly on the ends', () => {
    assert.equal(quantize(0, 14), 0);
    assert.equal(quantize(1, 14), 1);
    assert.equal(quantize(0.5, 4), 0.5);
    assert.equal(quantize(0.49, 4), 0.25);
    const seen = new Set(Array.from({ length: 101 }, (_, i) => quantize(i / 100, 14)));
    assert.equal(seen.size, 15);
  });

  it('is open at both ends and fully closed while the screens swap', () => {
    assert.equal(coverOf(0), 0);
    assert.equal(coverOf(1), 0);
    for (const t of [0.42, 0.5, 0.58]) assert.equal(coverOf(t), 1);
    // The map is gone only under full cover.
    for (let i = 0; i <= 100; i++) {
      const t = i / 100;
      if (mapOpacityOf(t, false) < 1 && mapOpacityOf(t, false) > 0) assert.equal(coverOf(t), 1);
    }
    assert.equal(mapOpacityOf(0, false), 1);
    assert.equal(mapOpacityOf(1, false), 0);
  });

  it('scales the map from 1 to the zoom scale, held through the second half', () => {
    assert.equal(zoomOf(0), 1);
    assert.ok(Math.abs(zoomOf(0.5) - (ZOOM_SCALE)) < 1e-6);
    assert.ok(Math.abs(zoomOf(1) - (ZOOM_SCALE)) < 1e-6);
  });

  it('reduced motion is a plain crossfade', () => {
    assert.equal(mapOpacityOf(0.25, true), 0.75);
  });

  it('keeps the focus point fixed on screen as the map scales about the centre', () => {
    const w = 375;
    const h = 667;
    for (const [fx, fy] of [[60, 600], [300, 40], [w / 2, h / 2]]) {
      const s = 1.6;
      const f = focalShift(fx, fy, w, h, s);
      // RN: translate, then scale about the centre.
      assert.ok(Math.abs(w / 2 + s * (fx - w / 2) + f.x - (fx)) < 1e-6);
      assert.ok(Math.abs(h / 2 + s * (fy - h / 2) + f.y - (fy)) < 1e-6);
    }
  });

  it('cloud edges are whole pixels and differ by layer and side', () => {
    const a = cloudEdge(20, 0, -1);
    assert.equal(a.every(Number.isInteger), true);
    assert.notDeepEqual(a, cloudEdge(20, 1, -1));
    assert.notDeepEqual(a, cloudEdge(20, 0, 1));
    assert.ok(Math.max(...a.map(Math.abs)) <= 9);
  });
});
