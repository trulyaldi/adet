// Pure ceremony decisions. Marks are device-local, monotonic high-water
// values; deriving a lower level after a balance change never replays a scene.
import type { GameState } from './derive';

export interface CeremonyMarks { level: number; rank: number; bosses: string[]; ascensions: number }
export type CeremonyEvent =
  | { id: string; kind: 'boss_defeated'; biomeId: string; loop: number }
  | { id: string; kind: 'ascension'; loop: number }
  | { id: string; kind: 'rank_up'; rankIndex: number }
  | { id: string; kind: 'level_up'; level: number };

const ref = (biome: string, loop: number) => `${biome}:${loop}`;

export function seedCeremonyMarks(game: GameState): CeremonyMarks {
  const bosses = game.journey.defeated.map((d) => ref(d.biome, d.loop));
  return {
    level: game.xp.level,
    rank: game.rank.tier,
    bosses,
    ascensions: Math.max(0, ...game.journey.defeated.filter((d) => d.biome === 'astral').map((d) => d.loop + 1)),
  };
}

export function detectCeremonies(marks: CeremonyMarks, game: GameState): CeremonyEvent[] {
  const seen = new Set(marks.bosses);
  const bosses: CeremonyEvent[] = game.journey.defeated
    .filter((d) => game.bossAchievements.includes(ref(d.biome, d.loop)) && !seen.has(ref(d.biome, d.loop)))
    .map((d) => ({ id: `boss:${ref(d.biome, d.loop)}`, kind: 'boss_defeated', biomeId: d.biome, loop: d.loop }));
  const highestAscension = Math.max(0, ...game.journey.defeated.filter((d) => d.biome === 'astral' && game.bossAchievements.includes(ref(d.biome, d.loop))).map((d) => d.loop + 1));
  const ascensions: CeremonyEvent[] = [];
  for (let n = marks.ascensions + 1; n <= highestAscension; n++) ascensions.push({ id: `ascension:${n}`, kind: 'ascension', loop: n });
  const rank: CeremonyEvent[] = game.rank.tier > marks.rank
    ? [{ id: `rank:${game.rank.tier}`, kind: 'rank_up', rankIndex: game.rank.tier }]
    : [];
  const level: CeremonyEvent[] = !rank.length && game.xp.level > marks.level
    ? [{ id: `level:${game.xp.level}`, kind: 'level_up', level: game.xp.level }]
    : [];
  return [...bosses, ...ascensions, ...level, ...rank];
}

export function markCeremonyStarted(marks: CeremonyMarks, event: CeremonyEvent, game: GameState): CeremonyMarks {
  switch (event.kind) {
    case 'boss_defeated': return { ...marks, bosses: [...new Set([...marks.bosses, ref(event.biomeId, event.loop)])] };
    case 'ascension': return { ...marks, ascensions: Math.max(marks.ascensions, event.loop) };
    case 'level_up': return { ...marks, level: Math.max(marks.level, event.level) };
    case 'rank_up': return { ...marks, rank: Math.max(marks.rank, event.rankIndex), level: Math.max(marks.level, game.xp.level) };
  }
}

export interface CeremonyContext {
  /** A session is running or paused. */
  timerActive: boolean;
  lootOpen: boolean;
  /** Another sheet, a Quest panel or the intro replay is up. */
  modalOpen: boolean;
  /** The map reveal hasn't played yet (it goes first). */
  revealPending: boolean;
  appActive: boolean;
}

/**
 * Whether a scene that already started may be on screen. A session starting
 * hides it; it comes back only when nothing else is up (the Loot sheet opens
 * as the session ends, so it waits for that too). Foreground and the map
 * reveal don't hide a scene that's playing, so it never restarts.
 */
export function ceremonyVisible(c: Pick<CeremonyContext, 'timerActive' | 'lootOpen' | 'modalOpen'>): boolean {
  return !c.timerActive && !c.lootOpen && !c.modalOpen;
}

/** Ceremonies wait for a quiet moment: never during a session, never over another sheet. */
export function ceremonyMayPlay(c: CeremonyContext): boolean {
  return !c.timerActive && !c.lootOpen && !c.modalOpen && !c.revealPending && c.appActive;
}
