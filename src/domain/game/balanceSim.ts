// Balance simulator: a daily-effort profile played through deriveGameState,
// reporting how many calendar days each biome takes. Pure and seeded, so the
// pacing test and `npm run game:balance` see the same numbers.

import * as ops from '../items/ops';
import type { Session } from '../types';
import { BIOME_COUNT, BIOME_IDS } from './biomes';
import { deriveGameState, GameState } from './derive';
import { fixedTz } from './tz';

export interface Profile {
  name: string;
  /** Focused minutes on an active day (varied ±25%). */
  minutesPerDay: number;
  /** Active days per week. */
  activeDays: number;
  /** Chests claimed with a chronicle line (share of sessions). */
  chronicleRate: number;
}

export const PROFILES: Profile[] = [60, 120, 180, 240].map((m) => ({
  name: `${m / 60} h/day`,
  minutesPerDay: m,
  activeDays: 6,
  chronicleRate: 0.4,
}));

const DAY = 86_400_000;
const D0 = Date.UTC(2026, 0, 5); // a Monday

/** Small seeded PRNG (mulberry32). */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SimResult {
  profile: Profile;
  /** Calendar days spent in each biome of the first loop (null: not cleared within `days`). */
  daysPerBiome: (number | null)[];
  game: GameState;
}

export function simulate(profile: Profile, seed = 1, days = 400): SimResult {
  const r = rng(seed);
  const sessions: Session[] = [];
  let q: ops.QuestSlice = ops.startQuest({ items: [], links: [] }, D0 - 1);
  let n = 0;
  for (let d = 0; d < days; d++) {
    // `activeDays` a week: the rest days fall on a different weekday each week.
    const week = Math.floor(d / 7);
    if ((d + week * 3) % 7 >= profile.activeDays) continue;
    const total = Math.round(profile.minutesPerDay * (0.75 + r() * 0.5));
    const count = 1 + Math.floor(r() * 3); // 1–3 sessions
    let hour = 7 + Math.floor(r() * 3);
    for (let i = 0; i < count; i++) {
      const min = Math.max(10, Math.round(total / count));
      const id = `sim${++n}`;
      const start = D0 + d * DAY + hour * 3600_000;
      sessions.push({ id, habitId: 'h1', start, end: start + min * 60_000, duration: min * 60 });
      hour += Math.ceil(min / 60) + 1;
      const chron = r() < profile.chronicleRate;
      if (chron) q = ops.claimChest(q, { sessionId: id, habitId: 'h1', text: 'a line', now: start });
    }
  }
  const weekly = profile.minutesPerDay * profile.activeDays;
  const game = deriveGameState({ sessions, habits: [{ id: 'h1', weeklyTargetMin: weekly }], items: q.items, links: q.links, now: D0 + days * DAY, tz: fixedTz(0) });
  const dayOf = (t: number) => Math.floor((t - D0) / DAY);
  const daysPerBiome: (number | null)[] = [];
  let prev = 0;
  for (let b = 0; b < BIOME_COUNT; b++) {
    const d = game.journey.defeated.find((x) => x.loop === 0 && x.biome === BIOME_IDS[b]);
    if (!d) {
      daysPerBiome.push(null);
      continue;
    }
    const end = dayOf(d.at) + 1;
    daysPerBiome.push(end - prev);
    prev = end;
  }
  return { profile, daysPerBiome, game };
}
