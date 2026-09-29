// The game from the app's data: input building and memoised state, keyed like
// the other selectors (the slices it reads plus a clock bucket), so a running
// timer or the store's tick recomputes nothing.

import { claimChest, QuestSlice } from '../items/ops';
import { activeHabits } from '../projects';
import { memoLast } from '../selectors';
import type { PersistedState } from '../types';
import { FRESH_CHEST_MS } from './balance';
import { DeriveInput, deriveGameState, GameState } from './derive';


export function gameInput(data: PersistedState, now: number, quest?: QuestSlice): DeriveInput {
  return {
    sessions: data.sessions,
    habits: data.habits,
    items: quest?.items ?? data.items,
    links: quest?.links ?? data.links,
    now,
    weeklyTargetMin: activeHabits(data).reduce((a, h) => a + (h.weeklyTargetMin || 0), 0),
  };
}

/**
 * The game, memoised on the slices it reads only (never on the clock), so a
 * ticking store or a timer starting elsewhere recomputes nothing. Nothing in
 * it depends on `now` except chest freshness, which freshChests() works out
 * separately (the `fresh` flags inside are never set).
 */
export const gameStateOf = memoLast(
  (data: PersistedState): GameState => deriveGameState(gameInput(data, 0)),
  (data) => [data.sessions, data.habits, data.projects, data.items, data.links]
);

/** Unopened chests younger than FRESH_CHEST_MS (the tab badge). */
export function hasFreshChest(game: GameState, now: number): boolean {
  return game.chests.unopened.some((c) => now - c.end < FRESH_CHEST_MS);
}

export interface ClaimPreview {
  before: GameState;
  after: GameState;
  critDamage: number;
  xpGained: number;
  creditsGained: number;
}

/** What opening a chest would do (the Loot sheet counts these up). */
export function previewClaim(
  data: PersistedState,
  now: number,
  claim: { sessionId: string; habitId: string | null; doneTaskIds: string[]; text: string }
): ClaimPreview {
  const before = gameStateOf(data);
  const q = claimChest({ items: data.items, links: data.links }, { ...claim, now });
  const after = deriveGameState(gameInput(data, 0, q));
  const r = after.sessions.find((x) => x.sessionId === claim.sessionId);
  return {
    before,
    after,
    critDamage: r?.critDamage ?? 0,
    xpGained: after.xp.total - before.xp.total,
    creditsGained: after.credits.earned - before.credits.earned,
  };
}
