// Diagnostic harness (not a test file): drives the pure session-end path the
// app runs when a session stops, for long sessions and awkward states, and
// reports anything non-finite, unbounded or out of range.
//
//   npx tsx scripts/quest-crash-repro.ts

import * as ops from '../src/domain/items/ops';
import { itemsOfType } from '../src/domain/items/types';
import { habit, sess, state } from '../src/domain/testkit';
import type { PersistedState } from '../src/domain/types';
import * as B from '../src/domain/game/balance';
import { BIOME_IDS, biomeRef } from '../src/domain/game/biomes';
import { detectCeremonies, markCeremonyStarted, seedCeremonyMarks } from '../src/domain/game/ceremonies';
import { deriveGameState, GameState } from '../src/domain/game/derive';
import { gameInput, gameStateOf, previewClaim } from '../src/domain/game/fromData';
import { hasSprite } from '../src/game/assets/manifest';
import { bossId, mobId, ROSTER } from '../src/game/content/roster';

const DAY = 86_400_000;
const NOW = Date.now();
const problems: string[] = [];
const flag = (tag: string, msg: string) => problems.push(`[${tag}] ${msg}`);

function walkNumbers(tag: string, v: unknown, path = ''): void {
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) flag(tag, `non-finite ${path} = ${v}`);
    return;
  }
  if (Array.isArray(v)) return v.forEach((x, i) => walkNumbers(tag, x, `${path}[${i}]`));
  if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walkNumbers(tag, x, `${path}.${k}`);
}

function checkGame(tag: string, g: GameState) {
  walkNumbers(tag, g);
  const j = g.journey;
  if (j.hp <= 0 || j.hp > j.maxHp) flag(tag, `hp ${j.hp}/${j.maxHp}`);
  if (j.position.kind === 'camp') flag(tag, 'position on camp');
  if (g.rank.tier < 0 || g.rank.tier >= B.RANKS.length) flag(tag, `rank tier ${g.rank.tier}`);
  for (const k of ['xpIntoLevel', 'xpForNextLevel'] as const) if (g.xp[k] < 0) flag(tag, `xp.${k} < 0`);
  if (g.xp.xpIntoLevel >= g.xp.xpForNextLevel) flag(tag, 'xpIntoLevel >= xpForNextLevel');
  // Sprites the Loot sheet, battle strip and boss ceremony would draw.
  const p = j.position;
  const id = p.kind === 'boss' ? `${bossId(p.biome)}.idle` : `${mobId(p.biome, ROSTER[p.biome].mobs[Math.max(0, B.NODE_MOBS[p.node] as number)].key)}.idle`;
  if (!hasSprite(id)) flag(tag, `missing sprite ${id}`);
  for (const d of j.defeated) {
    if (!hasSprite(`${bossId(d.biome)}.low`)) flag(tag, `missing ${bossId(d.biome)}.low`);
    if (!hasSprite(`prop.${d.biome}.gate.open`)) flag(tag, `missing gate ${d.biome}`);
  }
}

/** CountUp's interval, as written: steps = min(12, to − from), period = duration / steps. */
function countUp(tag: string, from: number, to: number, duration = 900) {
  if (to <= from) return;
  const steps = Math.min(12, to - from);
  const period = duration / steps;
  if (!Number.isFinite(steps) || !Number.isFinite(period) || steps <= 0) flag(tag, `CountUp steps=${steps} period=${period}`);
  let i = 0;
  let ticks = 0;
  while (ticks < 1e5) {
    i++;
    ticks++;
    if (i >= steps) break;
  }
  if (ticks >= 1e5) flag(tag, `CountUp never finishes (from ${from} to ${to})`);
}

interface Scenario {
  name: string;
  data: PersistedState;
  /** The session that just ended. */
  sessionId: string;
  tasks?: number;
  text?: string;
}

const H = habit('h1', 60, 10);

function withMeta(data: PersistedState, startedAt: number): PersistedState {
  const q = ops.startQuest({ items: data.items, links: data.links }, startedAt);
  return { ...data, items: q.items, links: q.links };
}

function arriveAt(data: PersistedState, biomeIdx: number, loop = 0, when: number): PersistedState {
  const list = [];
  for (let l = 0; l <= loop; l++)
    for (let b = 0; b < (l < loop ? BIOME_IDS.length : biomeIdx); b++) list.push({ kind: 'boss_defeated' as const, ref: biomeRef(BIOME_IDS[b], l), at: new Date(when).toISOString() });
  const q = ops.addAchievements({ items: data.items, links: data.links }, list, when);
  return { ...data, items: q.items, links: q.links };
}

function addTasks(data: PersistedState, sessionId: string, n: number): PersistedState {
  let q: ops.QuestSlice = { items: data.items, links: data.links };
  const ids: string[] = [];
  for (let i = 0; i < n; i++) {
    const id = `${sessionId}-t${i}`;
    q = ops.addTask(q, 'h1', `task ${i}`, NOW - DAY, id);
    ids.push(id);
  }
  q = ops.planTasks(q, sessionId, ids, NOW);
  return { ...data, items: q.items, links: q.links };
}

function runScenario(sc: Scenario) {
  const tag = sc.name;
  try {
    // Before the session: marks as the host would hold them.
    const without = { ...sc.data, sessions: sc.data.sessions.filter((s) => s.id !== sc.sessionId) };
    const g0 = deriveGameState(gameInput(without, 0));
    let marks = seedCeremonyMarks(g0);
    // 1. Session saved: the store re-derives (base damage lands at once).
    const g1 = gameStateOf(sc.data);
    checkGame(`${tag}/saved`, g1);
    // 2. Watcher writes new boss achievements until nothing is pending.
    let data = sc.data;
    let rounds = 0;
    for (let g = gameStateOf(data); g.newAchievements.length; g = gameStateOf(data)) {
      if (++rounds > 20) {
        flag(tag, 'watcher achievement write loop does not settle');
        break;
      }
      const q = ops.addAchievements({ items: data.items, links: data.links }, g.newAchievements, NOW);
      data = { ...data, items: q.items, links: q.links };
    }
    // 3. Loot: open with weak points ticked and a line.
    const tasks = itemsOfType(data.items, 'task').filter((t) => t.id.startsWith(sc.sessionId)).map((t) => t.id);
    const s = data.sessions.find((x) => x.id === sc.sessionId)!;
    const claim = { sessionId: sc.sessionId, habitId: s.habitId, doneTaskIds: tasks.slice(0, sc.tasks ?? 0), text: sc.text ?? '' };
    const pre = previewClaim(data, NOW, claim);
    checkGame(`${tag}/before`, pre.before);
    checkGame(`${tag}/after`, pre.after);
    walkNumbers(`${tag}/preview`, { xp: pre.xpGained, c: pre.creditsGained, crit: pre.critDamage });
    if (!Number.isInteger(pre.xpGained) || pre.xpGained < 0) flag(tag, `xpGained ${pre.xpGained}`);
    if (!Number.isInteger(pre.creditsGained) || pre.creditsGained < 0) flag(tag, `creditsGained ${pre.creditsGained}`);
    countUp(`${tag}/xp`, 0, pre.xpGained);
    countUp(`${tag}/credits`, 0, pre.creditsGained);
    const q = ops.claimChest({ items: data.items, links: data.links }, { ...claim, now: NOW });
    data = { ...data, items: q.items, links: q.links };
    for (let g = gameStateOf(data), r = 0; g.newAchievements.length && r < 20; g = gameStateOf(data), r++) {
      const q2 = ops.addAchievements({ items: data.items, links: data.links }, g.newAchievements, NOW);
      data = { ...data, items: q2.items, links: q2.links };
    }
    const g2 = gameStateOf(data);
    checkGame(`${tag}/claimed`, g2);
    // 4. Ceremony host: drain the queue one at a time.
    const played: string[] = [];
    for (let i = 0; i < 100; i++) {
      const next = detectCeremonies(marks, g2)[0];
      if (!next) break;
      played.push(next.id);
      marks = markCeremonyStarted(marks, next, g2);
      if (i === 99) flag(tag, 'ceremony queue does not drain');
    }
    if (new Set(played).size !== played.length) flag(tag, `ceremony replayed: ${played}`);
    const hops = g2.sessions.find((r) => r.sessionId === sc.sessionId)?.hits.length ?? 0;
    console.log(
      `${tag.padEnd(46)} lv ${String(g0.xp.level).padStart(2)}→${String(g2.xp.level).padEnd(3)} rank ${g0.rank.tier}→${g2.rank.tier} node ${g0.journey.position.global}→${g2.journey.position.global} (${g2.journey.position.biome}) hits ${hops} +xp ${pre.xpGained} +cr ${pre.creditsGained} ceremonies [${played.join(', ')}]`
    );
  } catch (e) {
    flag(tag, `THREW ${(e as Error).stack}`);
  }
}

const scenarios: Scenario[] = [];
const START = NOW - 30 * DAY;
const base = withMeta(state([H]), START);

// Plain durations on a fresh journey.
for (const min of [25, 60, 90, 180, 239, 240, 241, 300, 359, 360, 361, 480, 720, 1440]) {
  const s = sess(`d${min}`, 'h1', NOW - min * 60_000, min);
  scenarios.push({ name: `fresh ${min}m`, data: { ...base, sessions: [s] }, sessionId: s.id, text: 'did it' });
}
// A boss with little HP left, then a long session that overflows into the next biome.
for (const bi of [0, 1, 5, 6]) {
  for (const min of [60, 180, 300, 400]) {
    let d = arriveAt(base, bi, 0, START + 1);
    const hist = [];
    // Chip the biome to its boss: 6 mobs × 25 = 150 min, then the boss nearly.
    const boss = bi === 0 ? B.FIRST_BOSS_HP : Math.min(B.BOSS_HP_MAX, Math.max(B.BOSS_HP_MIN, Math.round(B.BOSS_HP_FACTOR * H.weeklyTargetMin)));
    let left = 150 + boss - 5;
    let day = 20;
    while (left > 0) {
      const m = Math.min(200, left);
      hist.push(sess(`b${bi}-${min}-h${day}`, 'h1', NOW - day * DAY, m));
      left -= m;
      day--;
    }
    const s = sess(`b${bi}-${min}`, 'h1', NOW - min * 60_000, min);
    d = addTasks({ ...d, sessions: [...hist, s] }, s.id, 3);
    scenarios.push({ name: `boss ${BIOME_IDS[bi]} ~5hp, ${min}m +3wp`, data: d, sessionId: s.id, tasks: 3, text: 'line' });
  }
}
// Near a rank boundary (level 2 → 3 is Squire at 400 XP).
for (const min of [60, 240, 360]) {
  const hist = [sess(`r${min}-h`, 'h1', NOW - 5 * DAY, 230), sess(`r${min}-h2`, 'h1', NOW - 4 * DAY, 160)];
  const s = sess(`r${min}`, 'h1', NOW - min * 60_000, min);
  scenarios.push({ name: `rank edge ${min}m`, data: addTasks({ ...base, sessions: [...hist, s] }, s.id, 5), sessionId: s.id, tasks: 5, text: 'yes' });
}
// Veteran: years of history before startedAt, the quest started today.
{
  const hist = [];
  for (let i = 1; i < 800; i++) hist.push(sess(`v${i}`, 'h1', NOW - i * DAY - 5 * 3600_000, 120 + (i % 5) * 30));
  const vetBase = withMeta(state([H]), NOW - 3600_000 * 7);
  for (const min of [60, 300]) {
    const s = sess(`vet${min}`, 'h1', NOW - min * 60_000, min);
    scenarios.push({ name: `veteran ${min}m`, data: { ...vetBase, sessions: [...hist, s] }, sessionId: s.id, text: 'x' });
  }
}
// Deep loop: ascended twice, at the astral boss.
{
  let d = arriveAt(base, 6, 2, START + 1);
  const s = sess('asc', 'h1', NOW - 400 * 60_000, 400);
  const hist = [];
  for (let i = 0; i < 12; i++) hist.push(sess(`asc-h${i}`, 'h1', NOW - (i + 2) * DAY, 240));
  d = { ...d, sessions: [...hist, s] };
  scenarios.push({ name: 'loop 2 astral, 400m', data: d, sessionId: s.id, text: 'x' });
}
// First qualifying session right after onboarding (history is XP-only).
{
  const hist = [sess('pre1', 'h1', NOW - 3 * DAY, 300), sess('pre2', 'h1', NOW - 2 * DAY, 300)];
  const onb = withMeta(state([H]), NOW - 200 * 60_000);
  const s = sess('first', 'h1', NOW - 180 * 60_000, 180);
  scenarios.push({ name: 'first after onboarding 180m', data: { ...onb, sessions: [...hist, s] }, sessionId: s.id, text: 'x' });
}
// No habits with a weekly target (boss HP from 0), and a habit deleted.
{
  const s = sess('nt', 'h1', NOW - 300 * 60_000, 300);
  const d = withMeta(state([habit('h1', 0, 0)]), START);
  scenarios.push({ name: 'zero weekly target 300m', data: { ...d, sessions: [s] }, sessionId: s.id, text: 'x' });
  const d2 = withMeta(state([]), START);
  scenarios.push({ name: 'habit deleted 300m', data: { ...d2, sessions: [s] }, sessionId: s.id, text: 'x' });
}

for (const sc of scenarios) runScenario(sc);
console.log(`\n${scenarios.length} scenarios, ${problems.length} problems`);
for (const p of problems) console.log(p);
process.exitCode = problems.length ? 1 : 0;
