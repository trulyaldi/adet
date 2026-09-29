// The game from the app's data: input building and memoised state, keyed like
// the other selectors (the slices it reads plus a clock bucket), so a running
// timer or the store's tick recomputes nothing.

import { claimChest, QuestSlice } from '../items/ops';
import { activeHabits } from '../projects';
import { memoLast } from '../selectors';
import type { PersistedState } from '../types';
import { DeriveInput, deriveGameState, GameState } from './derive';

/** Freshness of chests only needs minute precision. */
const bucket = (now: number) => Math.floor(now / 60_000);

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

export const gameStateOf = memoLast(
  (data: PersistedState, now: number): GameState => deriveGameState(gameInput(data, now)),
  (data, now) => [data.sessions, data.habits, data.projects, data.items, data.links, bucket(now)]
);

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
  const before = gameStateOf(data, now);
  const q = claimChest({ items: data.items, links: data.links }, { ...claim, now });
  const after = deriveGameState(gameInput(data, now, q));
  const r = after.sessions.find((x) => x.sessionId === claim.sessionId);
  return {
    before,
    after,
    critDamage: r?.critDamage ?? 0,
    xpGained: after.xp.total - before.xp.total,
    creditsGained: after.credits.earned - before.credits.earned,
  };
}
