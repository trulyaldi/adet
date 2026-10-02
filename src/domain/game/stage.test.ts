// The timer Stage's scene machine and its live preview (v2 N6).
import assert from 'node:assert/strict';
import { test } from 'node:test';

import * as ops from '../items/ops';
import { sessionFromTimer } from '../sessions';
import type { ActiveTimer, Session } from '../types';
import { DeriveInput, deriveGameState, mobHp } from './derive';
import { Encounter, encounterOf, liveSession, previewGame, STAGE_TIMING, stageStep, StageState } from './stage';
import { fixedTz } from './tz';

const E = (p: Partial<Encounter> = {}): Encounter => ({ global: 0, kind: 'mob', hp: 90, maxHp: 90, staggered: false, seals: [], ...p });
const T = STAGE_TIMING;

test('first frame: running fights, paused naps, a staggered boss kneels', () => {
  assert.equal(stageStep(null, 'running', E(), 0).scene, 'fight');
  assert.equal(stageStep(null, 'paused', E(), 0).scene, 'nap');
  assert.equal(stageStep(null, 'running', E({ kind: 'boss', hp: 0, staggered: true }), 0).scene, 'stagger');
});

test('pause → nap; resume → wake → fight', () => {
  let s = stageStep(null, 'running', E(), 0);
  s = stageStep(s, 'paused', E(), 1000);
  assert.deepEqual([s.scene, s.since], ['nap', 1000]);
  s = stageStep(s, 'paused', E(), 9000);
  assert.equal(s.since, 1000, 'a nap keeps its start');
  s = stageStep(s, 'running', E(), 10_000);
  assert.deepEqual([s.scene, s.since], ['wake', 10_000]);
  s = stageStep(s, 'running', E(), 10_000 + T.wakeMs - 1);
  assert.equal(s.scene, 'wake');
  s = stageStep(s, 'running', E(), 10_000 + T.wakeMs);
  assert.equal(s.scene, 'fight');
});

test('HP to 0 with the seals met: defeat, then the next enemy walks in, then fight', () => {
  let s: StageState = stageStep(null, 'running', E({ hp: 3 }), 0);
  s = stageStep(s, 'running', E({ global: 1, hp: 90 }), 5000);
  assert.equal(s.scene, 'defeat');
  assert.deepEqual([s.enemy.global, s.enemy.hp], [0, 0], 'the falling enemy stays on stage');
  s = stageStep(s, 'running', E({ global: 1, hp: 88 }), 5000 + T.defeatMs - 1);
  assert.equal(s.scene, 'defeat');
  s = stageStep(s, 'running', E({ global: 1, hp: 88 }), 5000 + T.defeatMs);
  assert.deepEqual([s.scene, s.enemy.global], ['walkIn', 1]);
  s = stageStep(s, 'running', E({ global: 1, hp: 86 }), 5000 + T.defeatMs + T.walkInMs);
  assert.equal(s.scene, 'fight');
});

test('HP to 0 with seals unmet: stagger (no defeat, no walk-in)', () => {
  let s = stageStep(null, 'running', E({ global: 7, kind: 'boss', hp: 5, maxHp: 420 }), 0);
  s = stageStep(s, 'running', E({ global: 7, kind: 'boss', hp: 0, maxHp: 420, staggered: true }), 3000);
  assert.deepEqual([s.scene, s.enemy.global], ['stagger', 7]);
});

test('the session ends: ended, whatever was playing', () => {
  for (const scene of ['fight', 'defeat', 'nap', 'wake'] as const) assert.equal(stageStep({ scene, since: 0, enemy: E() }, 'ended', E(), 10).scene, 'ended');
});

test('the live preview is exactly what the saved session derives to, including a boss falling at session end', () => {
  const D0 = Date.UTC(2026, 8, 1, 6);
  const DAY = 86_400_000;
  const habits = [{ id: 'h1', weeklyTargetMin: 300 }];
  // The Wisp at 120 HP with its seals met (see derive.test.ts): a 2 h session fells it.
  const history: Session[] = [...Array.from({ length: 6 }, (_, i) => ({ id: `m${i}`, habitId: 'h1', start: D0 + i * DAY, end: D0 + i * DAY + 90 * 60_000, duration: 90 * 60 })), ...[6, 7].map((d) => ({ id: `b${d}`, habitId: 'h1', start: D0 + d * DAY, end: D0 + d * DAY + 150 * 60_000, duration: 150 * 60 }))];
  let q: ops.QuestSlice = ops.startQuest({ items: [], links: [] }, D0 - 1);
  for (const id of ['b6', 'b7']) q = ops.claimChest(q, { sessionId: id, habitId: 'h1', doneTaskIds: [], text: 'a line', now: D0 });
  const input: DeriveInput = { sessions: history, habits, items: q.items, links: q.links, now: D0 + 9 * DAY, tz: fixedTz(0) };
  // Started at 08:00 on day 8, paused for 10 minutes along the way.
  const started = D0 + 8 * DAY + 2 * 3600_000;
  const active: ActiveTimer = { habitId: 'h1', startedAt: started + 70 * 60_000, baseSec: 60 * 60 };
  const mid = started + 100 * 60_000; // 90 focused minutes: 30 HP left
  const pre = encounterOf(previewGame(input, liveSession(active, mid)));
  assert.deepEqual([pre.kind, pre.hp], ['boss', 30]);
  const end = started + 131 * 60_000; // 121 focused minutes
  const preview = previewGame(input, liveSession(active, end));
  const saved = deriveGameState({ ...input, sessions: [...history, sessionFromTimer(active, end)!] });
  assert.deepEqual(preview.journey, saved.journey);
  assert.equal(saved.journey.defeated.length, 1, 'the boss fell at session end');
  assert.equal(saved.journey.position.biome, 'swamp');
  assert.equal(saved.journey.hp, mobHp(1) - 1);
  // Under ten minutes a session counts for nothing, in the preview too.
  assert.deepEqual(encounterOf(previewGame(input, liveSession({ habitId: 'h1', startedAt: end, baseSec: 0 }, end + 9 * 60_000))), encounterOf(deriveGameState(input)));
});
