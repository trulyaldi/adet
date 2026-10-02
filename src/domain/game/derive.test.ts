import assert from 'node:assert/strict';
import { test } from 'node:test';

import * as ops from '../items/ops';
import { Item, itemsOfType, Link } from '../items/types';
import { Session } from '../types';
import * as B from './balance';
import { BIOME_IDS, BiomeId, biomeRef } from './biomes';
import { bossGlobal, bossHp, DeriveInput, deriveGameState, mobHp, nodeAt } from './derive';
import { boughtFreezes } from './freezes';
import { levelFromXp, rankForLevel, skillLevel, xpForLevel } from './level';
import { fixedTz, prevDayKey } from './tz';
import { whatIfGame } from './whatIf';

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
function claimed(base: Item[], links: Link[], sessionId: string, opts: { text?: string } = {}) {
  return ops.claimChest({ items: base, links }, { sessionId, habitId: 'h1', text: opts.text ?? '', now: D0 });
}

/** Six 90-minute sessions, one a day from `day`: each fells one forest mob, with nothing over. */
function forestMobs(day = 0): Session[] {
  return Array.from({ length: 6 }, (_, i) => s(at(day + i, 9), mobHp(0)));
}

/**
 * The whole forest: its mobs, then three 150-minute days at the Fog Wisp (420 HP),
 * two of them claimed with a chronicle line. The third fells it; 30 carries
 * into the swamp's first mob.
 */
function forestCleared(opts: { claims?: boolean } = {}) {
  const mobs = forestMobs(0);
  const boss = [s(at(6, 9), 150), s(at(7, 9), 150), s(at(8, 9), 150)];
  let q: ops.QuestSlice = { items: [meta()], links: [] };
  if (opts.claims !== false) for (const b of boss.slice(0, 2)) q = ops.claimChest(q, { sessionId: b.id, habitId: 'h1', text: 'a line', now: D0 });
  return { sessions: [...mobs, ...boss], mobs, boss, items: q.items, links: q.links };
}

const sumHits = (r: { hits: { damage: number }[] }) => r.hits.reduce((a, h) => a + h.damage, 0);

// ---------------------------------------------------------------------------

test('empty history: level 1 Wanderer, journey at the first mob, nothing else', () => {
  const g = deriveGameState({ sessions: [], habits: [], items: [], links: [], now: D0, tz: UTC });
  assert.equal(g.xp.total, 0);
  assert.equal(g.xp.level, 1);
  assert.equal(g.rank.title, 'Wanderer');
  assert.equal(g.journey.started, false);
  assert.equal(g.journey.position.global, 0);
  assert.equal(g.journey.position.kind, 'mob');
  assert.equal(g.journey.hp, mobHp(0));
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
  assert.equal(g.xp.total, 200 + 70 + 30, 'three sessions fell three mobs at most: no boss');
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

test('R1: one defeat per session; surplus softens the path down to 1 HP, and is never lost', () => {
  // 200 damage: mob 0 falls (90), mob 1 stops at 1 HP (89), mob 2 takes the rest (21).
  const g = run([s(at(0, 9), 200)]);
  assert.deepEqual(g.sessions[0].hits.map((h) => [h.node.node, h.damage, h.defeated]), [
    [0, 90, true],
    [1, 89, false],
    [2, 21, false],
  ]);
  assert.equal(g.journey.position.node, 1);
  assert.equal(g.journey.hp, 1, 'softened, waiting for its own session');
  assert.deepEqual(g.journey.softened, [{ global: 2, hp: mobHp(0) - 21, maxHp: mobHp(0) }]);
  // A 10-minute session lands the final blow on mob 1; its 9 over soften mob 2.
  const next = run([s(at(0, 9), 200), s(at(1, 9), 10)]);
  assert.deepEqual(next.sessions[1].hits.map((h) => [h.node.node, h.damage, h.defeated]), [
    [1, 1, true],
    [2, 9, false],
  ]);
  assert.equal(next.journey.position.node, 2);
  assert.equal(next.journey.hp, mobHp(0) - 30);
});

test('R1: the camp is walked past; surplus reaches the far side of it', () => {
  const g = run([...forestMobs(0).slice(0, 2), s(at(2, 9), 100)]);
  assert.deepEqual(g.sessions[2].hits.map((h) => [h.node.node, h.damage, h.defeated]), [
    [2, 90, true],
    [4, 10, false],
  ]);
  assert.equal(g.journey.position.node, 4);
  assert.equal(g.journey.hp, mobHp(0) - 10);
});

test('R1: every journey session lands all of its damage, however large', () => {
  // 1440 minutes a day for a week into a path that is soon all 1 HP: it keeps flowing forward.
  const g = run(Array.from({ length: 7 }, (_, i) => s(at(i, 0), 1440)));
  for (const r of g.sessions) assert.equal(sumHits(r), r.baseDamage, r.sessionId);
  for (const r of g.sessions) assert.ok(r.hits.filter((h) => h.defeated).length <= 1);
});

test('R2: mob HP grows ×1.15 by biome; the tutorial boss is 420', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map(mobHp), [90, 103, 119, 137, 157, 181, 208]);
  assert.equal(bossHp(0, 0, 0), B.FIRST_BOSS_HP);
});

test('boss HP: tutorial 420, else 1.1 × weekly target × 1.15 per biome, clamped to 480–2400, ×1.2 per loop', () => {
  assert.equal(bossHp(0, 0, 10_000), 420);
  assert.equal(bossHp(1, 0, 100), 480);
  assert.equal(bossHp(1, 0, 720), Math.round(1.1 * 720 * 1.15));
  assert.equal(bossHp(6, 0, 720), Math.round(1.1 * 720 * 1.15 ** 6));
  assert.equal(bossHp(1, 0, 5000), 2400);
  assert.equal(bossHp(0, 1, 720), Math.round(Math.round(1.1 * 720) * 1.2), 'the tutorial boss only gets its fixed HP on the first loop');
  assert.equal(bossHp(1, 2, 720), Math.round(Math.round(1.1 * 720 * 1.15) * 1.44));
  assert.ok(bossHp(5, 0, 720) > bossHp(2, 0, 720), 'later bosses are tougher');
});

test('beating the forest boss unlocks the swamp and is reported once as new', () => {
  const f = forestCleared();
  const g = run(f.sessions, { items: f.items, links: f.links });
  assert.equal(g.journey.position.biome, 'swamp');
  assert.equal(g.journey.position.node, 0);
  assert.equal(g.journey.hp, mobHp(1) - 30, 'the third boss day carries 30 into the swamp');
  assert.equal(g.journey.defeated.length, 1);
  assert.deepEqual(
    g.newAchievements.map((a) => [a.kind, a.ref]),
    [['boss_defeated', 'forest:0']]
  );
  assert.equal(g.newAchievements[0].at, new Date(f.boss[2].end).toISOString());
  // Stored: nothing new next time.
  const stored = ops.addAchievements({ items: f.items, links: f.links }, g.newAchievements, D0).items;
  assert.deepEqual(run(f.sessions, { items: stored, links: f.links }).newAchievements, []);
});

test('R5: a boss never un-defeats: a recorded defeat keeps progress when balance or targets drop damage', () => {
  const f = forestCleared();
  const first = run(f.sessions, { items: f.items, links: f.links });
  const stored = ops.addAchievements({ items: f.items, links: f.links }, first.newAchievements, D0).items;
  // The last boss session is edited down: the derived pass alone would stop short of the boss.
  const last = f.boss[2];
  const edited = [...f.sessions.slice(0, -1), { ...last, duration: 60 * 60, end: last.start + 60 * 60_000 }];
  const without = run(edited, { items: f.items, links: f.links });
  assert.equal(without.journey.position.biome, 'forest');
  const withAch = run(edited, { items: stored, links: f.links });
  assert.equal(withAch.journey.position.biome, 'swamp');
  assert.equal(withAch.journey.position.node, 0);
  assert.equal(withAch.journey.defeated.length, 1);
  assert.ok(withAch.xp.total >= without.xp.total + B.BOSS_XP, 'the recorded boss still pays out');
  // Later sessions keep moving forward from there.
  const later = run([...edited, s(at(9, 6), 20)], { items: stored, links: f.links });
  assert.equal(later.journey.position.biome, 'swamp');
  assert.equal(later.journey.position.node, 0);
  assert.equal(later.journey.hp, mobHp(1) - 20);
});

test('a recorded defeat does not add progress when derived progress is already past it', () => {
  const f = forestCleared();
  const sess = [...f.sessions, s(at(9, 6), 100)];
  const plain = run(sess, { items: f.items, links: f.links });
  const stored = ops.addAchievements({ items: f.items, links: f.links }, plain.newAchievements, D0).items;
  const again = run(sess, { items: stored, links: f.links });
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
  const q = claimed([meta()], [], history[0].id, { text: 'old work' });
  const c = run(history, { items: q.items, links: q.links });
  assert.equal(c.xp.total, g.xp.total);
  assert.equal(c.credits.balance, B.WELCOME_CREDITS);
});

test('chest bonuses wait for the claim; base damage and XP apply right away', () => {
  const x = s(at(0, 9), 30);
  const open = run([x]);
  assert.equal(open.sessions[0].baseDamage, 30);
  assert.equal(open.xp.total, 30);
  assert.equal(open.credits.earned, 3);
  assert.equal(open.chests.unopened.length, 1);

  const q = claimed([meta()], [], x.id, { text: 'shipped the OTP flow' });
  const done = run([x], { items: q.items, links: q.links });
  assert.equal(done.chests.unopened.length, 0);
  assert.equal(done.journey.totalDamage, 30, 'a claim adds no damage');
  assert.equal(done.xp.total, 30 + Math.round(30 * B.REFLECTION_XP_SHARE));
  assert.equal(done.credits.earned, 3 + B.CHRONICLE_CREDITS);
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
  const f = forestCleared();
  const earned = f.sessions.reduce((a, x) => a + Math.floor(x.duration / 60 / 10), 0) + 2 * B.CHRONICLE_CREDITS;
  assert.equal(run(f.sessions, { items: f.items, links: f.links }).credits.earned, earned + B.BOSS_CREDITS);
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

test('ranks are derived, never written as achievements', () => {
  // 25 days × 240 min = 6000 XP → level 8 (Knight).
  const sess = Array.from({ length: 25 }, (_, d) => s(at(d, 6), 240));
  const g = run(sess, { items: [] });
  assert.equal(g.rank.title, 'Knight');
  assert.deepEqual(g.newAchievements, []);
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

test('twist — desert: none for now (TEMP until World Mode results): focused time deals as it is', () => {
  const x = s(at(0, 9), 40);
  assert.equal(inBiome('desert', [x]).sessions[0].baseDamage, 40);
  const q = claimed([], [], x.id, { text: 'a line' });
  assert.equal(inBiome('desert', [x], { items: q.items, links: q.links }).sessions[0].baseDamage, 40);
});

test('bosses fall at 0 HP like any enemy: no seals, no stagger', () => {
  const f = forestCleared({ claims: false });
  const g = run(f.sessions, { items: f.items, links: f.links });
  assert.equal(g.journey.defeated.length, 1, 'the Wisp fell on its third day, with no chronicle lines');
  assert.equal(g.journey.position.biome, 'swamp');
  assert.ok(g.sessions.at(-1)!.hits.some((h) => h.defeated && h.node.kind === 'boss'));
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

test('twist — volcano: the Burnout Drake takes at most a third of its HP per day; the rest walks on', () => {
  const drake = bossGlobal(5, 0);
  const cap = Math.ceil(bossHp(5, 0, 300) / 3);
  // Two sessions a day for twelve days: the mobs fall, then the Drake is worn down a third a day.
  const sess = Array.from({ length: 24 }, (_, i) => s(at(Math.floor(i / 2), i % 2 ? 14 : 6), 120));
  const g = inBiome('volcano', sess);
  const perDay = new Map<string, number>();
  for (const r of g.sessions) {
    assert.equal(sumHits(r), r.baseDamage, 'no damage is dropped at the Drake');
    for (const h of r.hits) if (h.node.global === drake) perDay.set(r.day, (perDay.get(r.day) ?? 0) + h.damage);
  }
  assert.ok(perDay.size >= 3, 'it takes three days or more');
  for (const [day, dmg] of perDay) assert.ok(dmg <= cap, `${day}: ${dmg} > ${cap}`);
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
  assert.equal(g.journey.bossMaxHp, bossHp(0, 1, 300));
  assert.equal(bossHp(0, 1, 300), Math.round(B.BOSS_HP_MIN * 1.2));
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
  // Half the chests claimed with an entry.
  const items: Item[] = [meta()];
  const links: Link[] = [];
  for (let i = 0; i < 5000; i += 2) {
    const q = claimed([], [], sess[i].id, { text: 'x' });
    items.push(...q.items);
    links.push(...q.links);
  }
  const input: DeriveInput = { sessions: sess, habits: [{ id: 'h1', weeklyTargetMin: 600 }, { id: 'h2', weeklyTargetMin: 300 }], items, links, now: at(2000, 0), tz: UTC };
  deriveGameState(input); // warm up
  // The best of many runs: the test runner runs files in parallel, so a
  // single timing can include time the CPU spent elsewhere.
  const RUNS = 30;
  let ms = Infinity;
  for (let i = 0; i < RUNS; i++) {
    const t0 = performance.now();
    deriveGameState(input);
    ms = Math.min(ms, performance.now() - t0);
  }
  assert.ok(ms < 50, `took ${ms.toFixed(1)} ms`);
  console.log(`  deriveGameState, 5,000 sessions: ${ms.toFixed(1)} ms (best of ${RUNS})`);

  // The dev QA panel derives the same history with a what-if overlay on top.
  let qa = Infinity;
  const overlay = { sessions: [{ habitId: 'h1', minutes: 60 }, { habitId: 'h2', minutes: 240 }], bossHp: 0.5 };
  for (let i = 0; i < RUNS; i++) {
    const t0 = performance.now();
    whatIfGame(input, overlay);
    qa = Math.min(qa, performance.now() - t0);
  }
  assert.ok(qa < 50, `what-if took ${qa.toFixed(1)} ms`);
  console.log(`  with a what-if overlay: ${qa.toFixed(1)} ms`);
});

// ---------------------------------------------------------------------------
// Quick logs (v2 N4)
// ---------------------------------------------------------------------------

function quickLogs(base: ops.QuestSlice, list: { at: number; text?: string; amount?: number }[]) {
  let q = base;
  list.forEach((l, i) => {
    q = ops.addQuickLog(q, { habitId: 'h1', text: l.text ?? 'did a thing', amount: l.amount === undefined ? undefined : { value: l.amount, metricId: 'metric:h1' }, now: l.at }, `ql${i}`);
  });
  return q;
}

test('quick logs: +3 XP each, rewarded at most 3 a local day; extra ones are still saved', () => {
  const q = quickLogs({ items: [meta()], links: [] }, [0, 1, 2, 3, 4].map((i) => ({ at: at(2, 9 + i) })));
  const g = run([], { items: q.items });
  assert.equal(itemsOfType(q.items, 'log').length, 5, 'all five saved');
  assert.equal(g.xp.total, 3 * B.QUICK_LOG_XP);
  // The next local day starts again; UTC+5 moves 21:00 UTC into tomorrow.
  const late = quickLogs({ items: [meta()], links: [] }, [9, 10, 11, 21].map((h) => ({ at: at(2, h) })));
  assert.equal(run([], { items: late.items }).xp.total, 3 * B.QUICK_LOG_XP);
  assert.equal(run([], { items: late.items, tz: fixedTz(300) }).xp.total, 4 * B.QUICK_LOG_XP);
});

test('quick logs: an amount alone (no line) earns nothing; amounts never add reward', () => {
  const bare = quickLogs({ items: [meta()], links: [] }, [{ at: at(2, 9), text: '', amount: 30 }]);
  assert.equal(itemsOfType(bare.items, 'log')[0].props.amount, 30);
  assert.equal(run([], { items: bare.items }).xp.total, 0);
  const lined = quickLogs({ items: [meta()], links: [] }, [{ at: at(2, 9), text: 'read', amount: 500 }]);
  assert.equal(run([], { items: lined.items }).xp.total, B.QUICK_LOG_XP, 'a huge amount is worth the same as none');
});

