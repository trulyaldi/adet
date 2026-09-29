// Ceremony events: every level, rank and boss the game has reached, each
// with a stable id. A ceremony plays once per id per device; ids already
// reached when a device first sees the journey are recorded quietly
// ("primed"), so history never replays as a pile of cutscenes.

import { RANKS } from '../domain/game/balance';
import { biomeRef } from '../domain/game/biomes';
import type { GameState } from '../domain/game/derive';

export type CeremonyKind = 'level' | 'rank' | 'boss';

export interface CeremonyEvent {
  id: string;
  kind: CeremonyKind;
  /** Level number, rank tier, or the boss's "biome:loop". */
  ref: string;
}

export function ceremonyEvents(game: GameState): CeremonyEvent[] {
  const out: CeremonyEvent[] = [];
  for (let l = 2; l <= game.xp.level; l++) out.push({ id: `level:${l}`, kind: 'level', ref: String(l) });
  for (let t = 1; t <= game.rank.tier; t++) out.push({ id: `rank:${RANKS[t].title}`, kind: 'rank', ref: String(t) });
  for (const d of game.journey.defeated) out.push({ id: `boss:${biomeRef(d.biome, d.loop)}`, kind: 'boss', ref: biomeRef(d.biome, d.loop) });
  return out;
}

/**
 * Events not yet played, most important first (a boss, then a rank, then the
 * latest level only). Levels count from `shownLevel` (so a trimmed played
 * list can never bring an old level back).
 */
export function pendingCeremonies(game: GameState, played: readonly string[], shownLevel: number | null = null): CeremonyEvent[] {
  const seen = new Set(played);
  const fresh = ceremonyEvents(game).filter((e) => !seen.has(e.id) && (e.kind !== 'level' || shownLevel === null || Number(e.ref) > shownLevel));
  const bosses = fresh.filter((e) => e.kind === 'boss');
  const ranks = fresh.filter((e) => e.kind === 'rank');
  const levels = fresh.filter((e) => e.kind === 'level');
  // Several levels at once celebrate as one (the highest).
  return [...bosses, ...ranks.slice(-1), ...levels.slice(-1)];
}

/** Every current event id (priming). */
export const primeIds = (game: GameState) => ceremonyEvents(game).map((e) => e.id);
