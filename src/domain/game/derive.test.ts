import assert from 'node:assert/strict';
import { test } from 'node:test';

import * as ops from '../items/ops';
import { Item, Link } from '../items/types';
import { Session } from '../types';
import * as B from './balance';
import { BIOME_IDS, BiomeId, biomeRef } from './biomes';
import { bossGlobal, bossHp, DeriveInput, deriveGameState, nodeAt } from './derive';
import { boughtFreezes } from './freezes';
import { levelFromXp, rankForLevel, skillLevel, xpForLevel } from './level';
import { fixedTz, prevDayKey } from './tz';

const UTC = fixedTz(0);
/** 2026-09-01 00:00 UTC; days are counted from here. */
const D0 = Date.UTC(2026, 8, 1);
const HOUR = 3600_000;
const at = (day: number, hour: number, min = 0) => D0 + day * 24 * HOUR + hour * HOUR + min * 60_000;

let n = 0;
function s(startMs: number, minutes: number, habitId = 'h1', id = `s${++n}`): Session {
  return { id, habitId, start: startMs, end: startMs + minutes * 60_000, duration: minutes * 60 };
}

const META_START = D0 - 24 * HOUR;
function meta(startedAt = META_START): Item {
  return { ...ops.startQuest({ items: [], links: [] }, startedAt).items[0] };
}

function run(sessions: Session[], extra: Partial<DeriveInput> = {}) {
  return deriveGameState({
    sessions,
    habits: [{ id: 'h1', weeklyTargetMin: 300 }],
    items: [meta()],
    links: [],
    now: at(60, 0),
    tz: UTC,
    ...extra,
  });
}

/** Stored boss achievements that put the journey at the start of `biome` (loop 0). */
function arriveAt(biome: BiomeId, when = META_START + 1): Item[] {
  const idx = BIOME_IDS.indexOf(biome);
  const q = ops.addAchievements(
    { items: [], links: [] },
    BIOME_IDS.slice(0, idx).map((b) => ({ kind: 'boss_defeated' as const, ref: biomeRef(b, 0), at: new Date(when).toISOString() })),
    when
  );
  return q.items;
}

/** Items + links for a claimed chest. */
function claimed(base: Item[], links: Link[], sessionId: string, opts: { tasks?: number; text?: string } = {}) {
  let q: ops.QuestSlice = { items: base, links };
  const ids: string[] = [];
  for (let i = 0; i < (opts.tasks ?? 0); i++) {
    const id = `${sessionId}-t${i}`;
    q = ops.addTask(q, 'h1', `task ${i}`, D0, id);
    ids.push(id);
  }
  q = ops.claimChest(q, { sessionId, habitId: 'h1', doneTaskIds: ids, text: opts.text ?? '', now: D0 });
  return q;
}

// ---------------------------------------------------------------------------

test('empty history: level 1 Wanderer, journey at the first mob, nothing else', () => {
  const g = deriveGameState({ sessions: [], habits: [], items: [], links: [], now: D0, tz: UTC });
  assert.equal(g.xp.total, 0);
  assert.equal(g.xp.level, 1);
  assert.equal(g.rank.title, 'Wanderer');
  assert.equal(g.journey.started, false);
  assert.equal(g.journey.position.global, 0);
  assert.equal(g.journey.position.kind, 'mob');
  assert.equal(g.journey.hp, B.MOB_HP);
  assert.deepEqual(g.chests, { unopened: [], hasFreshChest: false });
  assert.deepEqual(g.credits, { earned: 0, welcome: 0, spent: 0, balance: 0 });
  assert.deepEqual(g.newAchievements, []);
  assert.deepEqual(g.skills, []);
});

test('the 10-minute threshold: shorter sessions deal, grant and spawn nothing', () => {
  const short = s(at(0, 9), 9.99);
  const g = run([short]);
  assert.equal(g.sessions.length, 0);
  assert.equal(g.xp.total, 0);
  assert.equal(g.journey.totalDamage, 0);
  assert.equal(g.chests.unopened.length, 0);

  const ok = run([s(at(0, 9), 10)]);
  assert.equal(ok.sessions.length, 1);
  assert.equal(ok.xp.total, 10);
  assert.equal(ok.journey.totalDamage, 10);
  assert.equal(ok.chests.unopened.length, 1);
});

test('the day cap: 240 min at 100%, 240–360 at 50%, beyond at 0%, per local day', () => {
  // 200 + 100 + 120 = 420 minutes in one day.
  const a = s(at(1, 6), 200);
  const b = s(at(1, 11), 100);
  const c = s(at(1, 14), 120);
  const g = run([a, b, c]);
  const eff = Object.fromEntries(g.sessions.map((r) => [r.sessionId, r.effMin]));
  assert.equal(eff[a.id], 200);
  assert.equal(eff[b.id], 40 + 60 * 0.5); // 40 full, 60 half
  assert.equal(eff[c.id], 60 * 0.5); // 60 half, 60 nothing
  assert.equal(g.xp.total, 200 + 70 + 30 + B.BOSS_XP, '300 damage also beats the 270-HP forest');
  // The next day starts fresh.
  const next = run([a, b, c, s(at(2, 6), 240)]);
  assert.equal(next.sessions[3].effMin, 240);
});

test('the day cap follows the start order within a day, whatever order sessions end', () => {
  const long = s(at(3, 6), 300); // 06:00–11:00
  const inside = s(at(3, 7), 30); // starts after, ends first
  const g = run([inside, long]);
  const eff = Object.fromEntries(g.sessions.map((r) => [r.sessionId, r.effMin]));
  assert.equal(eff[long.id], 240 + 60 * 0.5);
  assert.equal(eff[inside.id], 30 * 0.5);
});

test('timezone day boundaries: the same sessions split days differently by zone', () => {
  // 21:00–01:00 UTC then 01:00–04:00 UTC: one UTC day each? First starts 21:00 day 4, second 01:00 day 5.
  const first = s(at(4, 21), 200);
  const second = s(at(5, 1), 180);
  const utc = run([first, second]);
  assert.deepEqual(utc.sessions.map((r) => r.effMin), [200, 180], 'different UTC days: both full');
  const plus5 = run([first, second], { tz: fixedTz(300) }); // both start on the same local day (02:00 and 06:00)
  assert.deepEqual(plus5.sessions.map((r) => r.effMin), [200, 40 + 120 * 0.5 + 20 * 0]);
  assert.equal(plus5.sessions[0].day, '2026-09-06');
  assert.equal(utc.sessions[0].day, '2026-09-05');
  assert.equal(prevDayKey('2026-03-01'), '2026-02-28');
  assert.equal(prevDayKey('2026-01-01'), '2025-12-31');
});

test('overkill carries over; the camp is walked past', () => {
  // 25 + 25 + 25 kills three mobs; +5 lands on node 4 (the camp is node 3).
  const g = run([s(at(0, 9), 80)]);
  assert.equal(g.journey.position.node, 4);
  assert.equal(g.journey.hp, B.MOB_HP - 5);
  const hits = g.sessions[0].hits;
  assert.deepEqual(hits.map((h) => [h.node.node, h.damage, h.defeated]), [
    [0, 25, true],
    [1, 25, true],
    [2, 25, true],
    [4, 5, false],
  ]);
});

test('boss HP: tutorial 120, else 0.8 × weekly target clamped to 150–900, ×1.2 per loop', () => {
  assert.equal(bossHp(0, 0, 10_000), 120);
  assert.equal(bossHp(1, 0, 100), 150);
  assert.equal(bossHp(1, 0, 500), 400);
  assert.equal(bossHp(1, 0, 5000), 900);
  assert.equal(bossHp(1, 1, 500), 480);
  assert.equal(bossHp(0, 1, 500), 480, 'the tutorial boss only gets its fixed HP on the first loop');
  assert.equal(bossHp(1, 2, 500), Math.round(400 * 1.44));
});

test('beating the forest boss unlocks the swamp and is reported once as new', () => {
  // 6 mobs (150) + boss (120) = 270, plus 10 into the swamp.
  const sess = [s(at(0, 6), 140), s(at(1, 6), 140)];
  const g = run(sess);
  assert.equal(g.journey.position.biome, 'swamp');
  assert.equal(g.journey.position.node, 0);
  assert.equal(g.journey.hp, B.MOB_HP - 10);
  assert.equal(g.journey.defeated.length, 1);
  assert.deepEqual(
    g.newAchievements.filter((a) => a.kind !== 'rank_reached').map((a) => [a.kind, a.ref]),
    [
      ['boss_defeated', 'forest:0'],
      ['biome_cleared', 'forest:0'],
    ]
  );
  assert.equal(g.newAchievements[0].at, new Date(sess[1].end).toISOString());
  // Stored: nothing new next time.
  const stored = ops.addAchievements({ items: [meta()], links: [] }, g.newAchievements, D0).items;
  assert.deepEqual(run(sess, { items: stored }).newAchievements, []);
});

test('a boss never un-defeats: a recorded defeat keeps progress when balance or targets drop damage', () => {
  const sess = [s(at(0, 6), 140), s(at(1, 6), 140)];
  const first = run(sess);
  const stored = ops.addAchievements({ items: [meta()], links: [] }, first.newAchievements, D0).items;
  // The second session is edited down: the derived pass alone would stop short of the boss.
  const edited = [sess[0], { ...sess[1], duration: 60 * 60, end: sess[1].start + 60 * 60_000 }];
  const without = run(edited);
  assert.equal(without.journey.position.biome, 'forest');
  const withAch = run(edited, { items: stored });
  assert.equal(withAch.journey.position.biome, 'swamp');
  assert.equal(withAch.journey.position.node, 0);
  assert.equal(withAch.journey.defeated.length, 1);
  assert.equal(withAch.xp.total, 140 + 60 + B.BOSS_XP, 'the recorded boss still pays out');
  // Later sessions keep moving forward from there.
  const later = run([...edited, s(at(2, 6), 20)], { items: stored });
  assert.equal(later.journey.position.biome, 'swamp');
  assert.equal(later.journey.position.node, 0);
  assert.equal(later.journey.hp, B.MOB_HP - 20);
});

test('a recorded defeat does not add progress when derived progress is already past it', () => {
  const sess = [s(at(0, 6), 140), s(at(1, 6), 140), s(at(2, 6), 100)];
  const plain = run(sess);
  const stored = ops.addAchievements({ items: [meta()], links: [] }, plain.newAchievements, D0).items;
  const again = run(sess, { items: stored });
  assert.equal(again.journey.position.global, plain.journey.position.global);
  assert.equal(again.journey.hp, plain.journey.hp);
});

test('only sessions after the quest started move the journey; XP counts all history', () => {
  const before = s(META_START - 5 * 24 * HOUR, 60);
  const after = s(at(0, 9), 20);
  const g = run([before, after]);
  assert.equal(g.journey.totalDamage, 20);
  assert.equal(g.xp.total, 80);
  assert.deepEqual(g.chests.unopened.map((c) => c.sessionId), [after.id]);
  assert.equal(g.credits.earned, 2, 'credits come from the journey only');
  // No quest yet: nothing moves, no chests, XP still counts.
  const none = run([before, after], { items: [] });
  assert.equal(none.journey.started, false);
  assert.equal(none.journey.totalDamage, 0);
  assert.equal(none.chests.unopened.length, 0);
  assert.equal(none.xp.total, 80);
});

test('a veteran starting today: full XP and rank, no chests, only the welcome credits', () => {
  // Two years of daily hour-long sessions before the journey began.
  const history = Array.from({ length: 730 }, (_, i) => s(META_START - (i + 1) * 24 * HOUR, 60));
  const g = run(history);
  assert.equal(g.chests.unopened.length, 0);
  assert.equal(g.credits.earned, 0);
  assert.equal(g.credits.balance, B.WELCOME_CREDITS);
  assert.equal(g.journey.totalDamage, 0);
  assert.ok(g.xp.level > 20, 'history still levels the character');
  assert.ok(g.rank.tier >= 5);
  // A claim written for a pre-journey session (another build, a stray write) adds nothing.
  const q = claimed([meta()], [], history[0].id, { tasks: 3, text: 'old work' });
  const c = run(history, { items: q.items, links: q.links });
  assert.equal(c.xp.total, g.xp.total);
  assert.equal(c.credits.balance, B.WELCOME_CREDITS);
});

test('chest bonuses wait for the claim; base damage and XP apply right away', () => {
  const x = s(at(0, 9), 30);
  const open = run([x]);
  assert.equal(open.sessions[0].baseDamage, 30);
  assert.equal(open.sessions[0].critDamage, 0);
  assert.equal(open.xp.total, 30);
  assert.equal(open.credits.earned, 3);
  assert.equal(open.chests.unopened.length, 1);

  const q = claimed([meta()], [], x.id, { tasks: 2, text: 'shipped the OTP flow' });
  const done = run([x], { items: q.items, links: q.links });
  assert.equal(done.chests.unopened.length, 0);
  assert.equal(done.sessions[0].critDamage, 2 * B.CRIT_DAMAGE);
  assert.equal(done.journey.totalDamage, 30 + 20);
  assert.equal(done.xp.total, 30 + Math.round(30 * B.REFLECTION_XP_SHARE) + 2 * B.TASK_XP);
  assert.equal(done.credits.earned, 3 + B.CHRONICLE_CREDITS);
});

test('crits cap at three per session; an empty chronicle earns no reflection bonus', () => {
  const x = s(at(0, 9), 30);
  const q = claimed([meta()], [], x.id, { tasks: 5, text: '' });
  const g = run([x], { items: q.items, links: q.links });
  assert.equal(g.sessions[0].critDamage, 3 * B.CRIT_DAMAGE);
  assert.equal(g.xp.total, 30 + 5 * B.TASK_XP);
  assert.equal(g.credits.earned, 3);
});

test('credits: floor(eff/10) per session, balance after purchases never below zero', () => {
  const g = run([s(at(0, 9), 39), s(at(1, 9), 41)]);
  assert.equal(g.credits.earned, 3 + 4);
  let q = ops.addPurchase({ items: [meta()], links: [] }, 'cloak.moss', 5, D0, undefined, 'p1');
  const spent = run([s(at(0, 9), 39), s(at(1, 9), 41)], { items: q.items });
  assert.deepEqual(spent.credits, { earned: 7, welcome: B.WELCOME_CREDITS, spent: 5, balance: B.WELCOME_CREDITS + 2 });
  q = ops.addPurchase(q, 'x', B.WELCOME_CREDITS + 50, D0, undefined, 'p2');
  assert.equal(run([s(at(0, 9), 39)], { items: q.items }).credits.balance, 0);
  // Bosses pay 25 credits.
  assert.equal(run([s(at(0, 6), 140), s(at(1, 6), 140)]).credits.earned, 14 + 14 + B.BOSS_CREDITS);
});

test('bought freezes count per month, at most two', () => {
  let q: ops.QuestSlice = { items: [], links: [] };
  for (let i = 0; i < 3; i++) q = ops.addPurchase(q, 'freeze', 60, D0, '2026-09', `f${i}`);
  q = ops.addPurchase(q, 'freeze', 60, D0, '2026-10', 'g');
  q = ops.addPurchase(q, 'cloak', 60, D0, '2026-10', 'h');
  assert.deepEqual(boughtFreezes(q.items), { '2026-09': 2, '2026-10': 1 });
});

test('the level curve: 100 × (L−1)² cumulative, at its boundaries', () => {
  assert.equal(xpForLevel(1), 0);
  assert.equal(xpForLevel(2), 100);
  assert.equal(xpForLevel(3), 400);
  assert.deepEqual(levelFromXp(0), { level: 1, xpIntoLevel: 0, xpForNextLevel: 100 });
  assert.deepEqual(levelFromXp(99), { level: 1, xpIntoLevel: 99, xpForNextLevel: 100 });
  assert.deepEqual(levelFromXp(100), { level: 2, xpIntoLevel: 0, xpForNextLevel: 300 });
  assert.deepEqual(levelFromXp(399), { level: 2, xpIntoLevel: 299, xpForNextLevel: 300 });
  assert.deepEqual(levelFromXp(400), { level: 3, xpIntoLevel: 0, xpForNextLevel: 500 });
  assert.equal(levelFromXp(100 * 99 * 99).level, 100);
  assert.equal(levelFromXp(100 * 99 * 99 - 1).level, 99);
  assert.equal(levelFromXp(-5).level, 1);
  assert.equal(skillLevel(25).level, 2);
  assert.equal(skillLevel(24).level, 1);
});

test('rank titles by level, with the gear tier', () => {
  const cases: [number, string, number][] = [
    [1, 'Wanderer', 0],
    [2, 'Wanderer', 0],
    [3, 'Squire', 1],
    [5, 'Squire', 1],
    [6, 'Knight', 2],
    [9, 'Knight', 2],
    [10, 'Captain', 3],
    [14, 'Captain', 3],
    [15, 'Warden', 4],
    [19, 'Warden', 4],
    [20, 'Lord', 5],
    [26, 'Lord', 5],
    [27, 'Legend', 6],
    [80, 'Legend', 6],
  ];
  for (const [lv, title, tier] of cases) {
    const r = rankForLevel(lv);
    assert.equal(r.title, title, `level ${lv}`);
    assert.equal(r.tier, tier, `level ${lv}`);
  }
  assert.equal(rankForLevel(27).nextAt, null);
  assert.equal(rankForLevel(1).nextAt, 3);
});

test('rank_reached achievements are reported for every rank passed', () => {
  // 25 days × 240 min = 6000 XP → level 8 (Knight).
  const sess = Array.from({ length: 25 }, (_, d) => s(at(d, 6), 240));
  const g = run(sess, { items: [] });
  assert.equal(g.rank.title, 'Knight');
  assert.deepEqual(g.newAchievements.filter((a) => a.kind === 'rank_reached').map((a) => a.ref), ['Squire', 'Knight']);
});

test('skills: effective minutes per habit, with deleted habits retired', () => {
  const g = run([s(at(0, 9), 30, 'h1'), s(at(0, 12), 50, 'gone')], { habits: [{ id: 'h1', weeklyTargetMin: 300 }, { id: 'h2', weeklyTargetMin: 0 }] });
  const by = Object.fromEntries(g.skills.map((k) => [k.habitId, k]));
  assert.equal(by.h1.minutes, 30);
  assert.equal(by.h1.level, 2);
  assert.equal(by.h2.minutes, 0);
  assert.equal(by.gone.retired, true);
  assert.equal(by.gone.minutes, 50);
});

test('chests: newest first; fresh only within 24 hours', () => {
  const a = s(at(0, 9), 20);
  const b = s(at(2, 9), 20);
  const g = run([a, b], { now: b.end + 23 * HOUR });
  assert.deepEqual(g.chests.unopened.map((c) => c.sessionId), [b.id, a.id]);
  assert.deepEqual(g.chests.unopened.map((c) => c.fresh), [true, false]);
  assert.equal(g.chests.hasFreshChest, true);
  assert.equal(run([a, b], { now: b.end + 25 * HOUR }).chests.hasFreshChest, false);
});

// ---------------------------------------------------------------------------
// Biome twists (each only while its biome is active)
// ---------------------------------------------------------------------------

function inBiome(biome: BiomeId, sessions: Session[], extra: { items?: Item[]; links?: Link[] } = {}) {
  const items = [meta(), ...arriveAt(biome), ...(extra.items ?? [])];
  return run(sessions, { items, links: extra.links ?? [] });
}

test('twist — forest: plain damage (and the snap puts us where we asked)', () => {
  const g = inBiome('forest', [s(at(0, 9), 20)]);
  assert.equal(g.sessions[0].biome, 'forest');
  assert.equal(g.sessions[0].baseDamage, 20);
});

test('twist — swamp: 25+ unbroken minutes deal ×1.2, only in the swamp', () => {
  const g = inBiome('swamp', [s(at(0, 9), 24), s(at(1, 9), 25)]);
  assert.equal(g.sessions[0].biome, 'swamp');
  assert.equal(g.sessions[0].baseDamage, 24);
  assert.equal(g.sessions[1].baseDamage, 30);
  // A session with a gap (paused time outside its duration) isn't unbroken.
  const gap: Session = { id: 'gap', habitId: 'h1', start: at(2, 9), end: at(2, 9) + 40 * 60_000, duration: 30 * 60 };
  assert.equal(inBiome('swamp', [gap]).sessions[0].baseDamage, 30);
  assert.equal(inBiome('forest', [s(at(1, 9), 25)]).sessions[0].baseDamage, 25);
});

test('twist — desert: ×1.5 with a completed weak point, ×0.75 without', () => {
  const x = s(at(0, 9), 40);
  const without = inBiome('desert', [x]);
  assert.equal(without.sessions[0].baseDamage, 30);
  const q = claimed([], [], x.id, { tasks: 1, text: '' });
  const withTask = inBiome('desert', [x], { items: q.items, links: q.links });
  assert.equal(withTask.sessions[0].baseDamage, 60);
  assert.equal(withTask.sessions[0].critDamage, 10);
});

test("twist — frost: the first 10 minutes of each day's first session deal ×2", () => {
  const a = s(at(0, 9), 30);
  const b = s(at(0, 14), 30);
  const c = s(at(1, 9), 5 + 5 + 10); // 20 min
  const g = inBiome('frost', [a, b, c]);
  assert.deepEqual(g.sessions.map((r) => r.baseDamage), [40, 30, 30]);
});

test('twist — iron: sessions started before noon (local) deal ×1.25', () => {
  const g = inBiome('iron', [s(at(0, 11, 59), 40), s(at(1, 12), 40)]);
  assert.deepEqual(g.sessions.map((r) => r.baseDamage), [50, 40]);
  // Local time decides: 11:00 UTC is 16:00 at UTC+5.
  const shifted = run([s(at(0, 11), 40)], { items: [meta(), ...arriveAt('iron')], tz: fixedTz(300) });
  assert.equal(shifted.sessions[0].baseDamage, 40);
});

test('twist — volcano: 60–240 minute days ×1.3, Rested after a zero day ×1.2', () => {
  // Day 0: 50 min (not in band; the day before is empty → Rested ×1.2).
  // Day 1: 100 min (in band ×1.3; day 0 had minutes → not rested).
  // Day 2: 300 min (over the band; not rested).
  // Day 4: 60 min (in band ×1.3; day 3 was empty → Rested ×1.2).
  const g = inBiome('volcano', [s(at(0, 9), 50), s(at(1, 9), 100), s(at(2, 6), 300), s(at(4, 9), 60)]);
  assert.deepEqual(g.sessions.map((r) => r.baseDamage), [60, 130, 270, Math.round(60 * 1.3 * 1.2)]);
});

test('twist — volcano: the Burnout Drake takes at most a third of its HP per day', () => {
  // Put the journey at the Drake: every volcano mob cleared by a first session.
  const hp = bossHp(5, 0, 300); // 240
  const cap = Math.ceil(hp / 3); // 80
  // Day 0: 100 × 1.3 (band) × 1.2 (rested) = 156: the six mobs (150) and 6 into the Drake.
  const clear = s(at(0, 6), 100);
  // Days 1–3: 240 × 1.3 = 312 each, far more than a third of the Drake.
  const g = inBiome('volcano', [clear, s(at(1, 6), 240), s(at(2, 6), 240), s(at(3, 6), 240), s(at(4, 6), 30)]);
  assert.equal(g.sessions[0].damage, 156);
  assert.equal(g.sessions[1].damage, cap, 'the rest of the day bounces off');
  assert.equal(g.sessions[2].damage, cap);
  // Day 3: the Drake has 240 − 6 − 160 = 74 left, within today's cap; the overkill carries on.
  assert.equal(g.sessions[3].damage, 312);
  assert.equal(g.journey.defeated.at(-1)?.biome, 'volcano');
  assert.equal(g.journey.position.biome, 'astral');
  assert.equal(g.sessions[4].biome, 'astral');
});

test('twist — astral: a chronicle entry makes a session deal ×1.25', () => {
  const x = s(at(0, 9), 40);
  const y = s(at(1, 9), 40);
  const q = claimed([], [], x.id, { text: 'shipped it' });
  const g = inBiome('astral', [x, y], { items: q.items, links: q.links });
  assert.deepEqual(g.sessions.map((r) => r.baseDamage), [50, 40]);
});

test('twists only apply in their own biome', () => {
  const x = s(at(0, 10), 40);
  for (const b of BIOME_IDS) {
    const g = inBiome(b, [x]);
    assert.equal(g.sessions[0].biome, b);
  }
  // The same morning session in the forest isn't boosted by the iron rule.
  assert.equal(inBiome('forest', [x]).sessions[0].baseDamage, 40);
});

// ---------------------------------------------------------------------------
// Ascension
// ---------------------------------------------------------------------------

test('after the Astral Citadel the journey loops, with 1.2× boss HP', () => {
  const when = META_START + 1;
  const q = ops.addAchievements(
    { items: [meta()], links: [] },
    BIOME_IDS.map((b) => ({ kind: 'boss_defeated' as const, ref: biomeRef(b, 0), at: new Date(when).toISOString() })),
    when
  );
  const g = run([s(at(0, 9), 20)], { items: q.items });
  assert.equal(g.journey.position.loop, 1);
  assert.equal(g.journey.position.biome, 'forest');
  assert.equal(g.journey.bossMaxHp, Math.round(240 * 1.2));
  assert.equal(nodeAt(bossGlobal(0, 1)).kind, 'boss');
  assert.equal(nodeAt(bossGlobal(6, 0) + 1).loop, 1);
});

// ---------------------------------------------------------------------------
// Determinism and speed
// ---------------------------------------------------------------------------

test('derivation is deterministic and ignores input order', () => {
  const sess = Array.from({ length: 50 }, (_, i) => s(at(i % 20, 6 + (i % 5) * 3), 15 + (i % 7) * 10));
  const a = run(sess);
  const b = run([...sess].reverse());
  assert.deepEqual(a, b);
});

test('benchmark: 5,000 sessions derive in under 50 ms', () => {
  const sess: Session[] = [];
  for (let i = 0; i < 5000; i++) sess.push(s(at(Math.floor(i / 3), 6 + (i % 3) * 4), 20 + (i % 9) * 10, i % 4 ? 'h1' : 'h2'));
  // Half the chests claimed with an entry, a completed weak point on every tenth.
  const items: Item[] = [meta()];
  const links: Link[] = [];
  for (let i = 0; i < 5000; i += 2) {
    const q = claimed([], [], sess[i].id, { tasks: i % 10 ? 0 : 1, text: 'x' });
    items.push(...q.items);
    links.push(...q.links);
  }
  const input: DeriveInput = { sessions: sess, habits: [{ id: 'h1', weeklyTargetMin: 600 }, { id: 'h2', weeklyTargetMin: 300 }], items, links, now: at(2000, 0), tz: UTC };
  deriveGameState(input); // warm up
  // The best of several runs: the test runner runs files in parallel, so a
  // single timing can include time the CPU spent elsewhere.
  let ms = Infinity;
  for (let i = 0; i < 12; i++) {
    const t0 = performance.now();
    deriveGameState(input);
    ms = Math.min(ms, performance.now() - t0);
  }
  assert.ok(ms < 50, `took ${ms.toFixed(1)} ms`);
});
