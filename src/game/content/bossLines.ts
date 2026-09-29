// What a boss says when tapped at its gate: its three pre-fight lines in
// turn. The Hollow Echo (self-doubt) also answers with the player's own
// chronicle, as encouragement.

import type { BiomeId } from '../../domain/game/biomes';
import type { GameState } from '../../domain/game/derive';
import { BIOMES } from './biomes';

/** "You wrote: '…'. You can do this." from a past entry (short ones read best). */
export function echoQuote(game: GameState, seed: number): string | null {
  const entries = game.sessions.map((r) => (r.chronicle ?? '').trim()).filter((e) => e.length > 3 && e.length <= 48);
  if (!entries.length) return null;
  return `You wrote: "${entries[Math.abs(seed) % entries.length]}". You can do this.`;
}

/** The boss's `n`th line (it cycles). */
export function bossLine(game: GameState, biome: BiomeId, n: number): string {
  const lines: string[] = [...BIOMES[biome].boss.before];
  const quote = biome === 'astral' ? echoQuote(game, n) : null;
  if (quote) lines.push(quote);
  return lines[Math.abs(n) % lines.length];
}
