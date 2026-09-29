// Summarise one biome run for Aqyl's battle report. Ceremony detection lives
// in the pure domain module; the app-root host owns playback.
import type { GameState } from '../../domain/game/derive';

export interface BossRun { sessions: number; tasks: number; entries: string[] }

export function bossRun(game: GameState, ref: string): BossRun {
  const [biome, loop] = ref.split(':');
  const runs = game.sessions.filter((r) => r.biome === biome && String(r.loop) === loop);
  return {
    sessions: runs.length,
    tasks: runs.reduce((a, r) => a + r.completedTasks, 0),
    entries: runs.map((r) => (r.chronicle ?? '').trim()).filter(Boolean),
  };
}
