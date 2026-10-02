// Pure ceremony decisions. Marks are device-local, monotonic high-water
// values; deriving a lower level after a balance change never replays a scene.
import type { GameState } from './derive';

/** World Mode's fallen bosses and seen realms are absent from marks saved before world-4: they're seeded silently. */
export interface CeremonyMarks { level: number; rank: number; bosses: string[]; ascensions: number; worldBosses?: string[]; realms?: string[] }
/** What World Mode has to announce (domain/world worldMoments). */
export interface WorldMoments { bosses: { id: string; title: string }[]; realms: { id: string; name: string }[] }
export type CeremonyEvent =
  | { id: string; kind: 'boss_defeated'; biomeId: string; loop: number }
  | { id: string; kind: 'world_boss'; questId: string; title: string }
  | { id: string; kind: 'realm_conquered'; realmId: string; name: string }
  | { id: string; kind: 'ascension'; loop: number }
  | { id: string; kind: 'rank_up'; rankIndex: number }
  | { id: string; kind: 'level_up'; level: number };

const ref = (biome: string, loop: number) => `${biome}:${loop}`;

export function seedCeremonyMarks(game: GameState, world?: WorldMoments): CeremonyMarks {
  const bosses = game.journey.defeated.map((d) => ref(d.biome, d.loop));
  const marks: CeremonyMarks = {
    level: game.xp.level,
    rank: game.rank.tier,
    bosses,
    ascensions: Math.max(0, ...game.journey.defeated.filter((d) => d.biome === 'astral').map((d) => d.loop + 1)),
  };
  return world ? withWorldMarks(marks, world) : marks;
}

/** Marks from before World Mode: what has already fallen counts as seen (nothing replays). Unchanged when present. */
export function withWorldMarks(marks: CeremonyMarks, world: WorldMoments): CeremonyMarks {
  if (marks.worldBosses && marks.realms) return marks;
  return { ...marks, worldBosses: marks.worldBosses ?? world.bosses.map((b) => b.id), realms: marks.realms ?? world.realms.map((r) => r.id) };
}

export function detectCeremonies(marks: CeremonyMarks, game: GameState, world?: WorldMoments): CeremonyEvent[] {
  const fell = new Set(marks.worldBosses ?? []);
  const conquered = new Set(marks.realms ?? []);
  // Unseeded world marks announce nothing (withWorldMarks seeds them first).
  const worldBosses: CeremonyEvent[] = world && marks.worldBosses ? world.bosses.filter((b) => !fell.has(b.id)).map((b) => ({ id: `world:${b.id}`, kind: 'world_boss', questId: b.id, title: b.title })) : [];
  const realms: CeremonyEvent[] = world && marks.realms ? world.realms.filter((r) => !conquered.has(r.id)).map((r) => ({ id: `realm:${r.id}`, kind: 'realm_conquered', realmId: r.id, name: r.name })) : [];
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
  return [...worldBosses, ...realms, ...bosses, ...ascensions, ...level, ...rank];
}

export function markCeremonyStarted(marks: CeremonyMarks, event: CeremonyEvent, game: GameState): CeremonyMarks {
  switch (event.kind) {
    case 'boss_defeated': return { ...marks, bosses: [...new Set([...marks.bosses, ref(event.biomeId, event.loop)])] };
    case 'world_boss': return { ...marks, worldBosses: [...new Set([...(marks.worldBosses ?? []), event.questId])] };
    // Once per realm: conquering it again after adding a quest doesn't replay.
    case 'realm_conquered': return { ...marks, realms: [...new Set([...(marks.realms ?? []), event.realmId])] };
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
