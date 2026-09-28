import assert from 'node:assert/strict';
import test from 'node:test';

import { assignLooks, PROJECT_COLORS, projectLook, withLooks } from './look';
import { Project } from './types';

const p = (id: string, started: number, extra: Partial<Project> = {}): Project => ({ id, name: id, weeklyTarget: 5, started, ...extra });

test('assignLooks gives distinct colors in start order and keeps set ones', () => {
  const out = assignLooks([p('b', 2), p('a', 1), p('c', 3, { color: 'purple' })], () => undefined);
  const byId = Object.fromEntries(out.map((x) => [x.id, x]));
  assert.equal(byId.c.color, 'purple');
  assert.equal(byId.a.color, 'orange', 'first free color after purple');
  assert.equal(byId.b.color, 'green');
  assert.notEqual(byId.a.scene, byId.b.scene);
  assert.deepEqual(out.map((x) => x.id), ['b', 'a', 'c'], 'order kept');
});

test('assignLooks is the same on every device regardless of list order', () => {
  const one = assignLooks([p('x', 5), p('y', 1)], () => undefined);
  const two = assignLooks([p('y', 1), p('x', 5)], () => undefined);
  assert.deepEqual(
    one.map((x) => [x.id, x.color, x.scene]).sort(),
    two.map((x) => [x.id, x.color, x.scene]).sort()
  );
});

test('more than eight projects wrap round the palette', () => {
  const many = Array.from({ length: 10 }, (_, i) => p('p' + i, i));
  const out = assignLooks(many, () => undefined);
  assert.equal(new Set(out.slice(0, 8).map((x) => x.color)).size, 8);
  assert.ok(out.every((x) => PROJECT_COLORS.includes(x.color!)));
});

test('icon comes from the first habit; withLooks is a no-op when complete', () => {
  const data = { projects: [p('a', 1)], habits: [{ projectId: 'a', icon: 'book' as const }] };
  const out = withLooks(data);
  assert.equal(out.projects[0].icon, 'book');
  assert.equal(withLooks(out), out);
});

test('projectLook falls back deterministically from the id', () => {
  assert.deepEqual(projectLook(p('abc', 0)), projectLook(p('abc', 99)));
  assert.equal(projectLook(p('abc', 0, { color: 'teal' })).color, 'teal');
});
