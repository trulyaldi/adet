// The dev QA panel's "what if": synthetic sessions and weak points added to
// a copy of the real input, derived in memory. Nothing here is ever stored or
// synced; with no overlay the result is exactly the real game.

import * as ops from '../items/ops';
import type { Session } from '../types';
import { bossGlobal, DeriveInput, deriveGameState, GameState, nodeAt } from './derive';

export interface WhatIfSession {
  habitId: string;
  minutes: number;
  /** Also tick one completed weak point (a crit and task XP, via a claimed chest). */
  weakPoint?: boolean;
}

export interface WhatIf {
  sessions: WhatIfSession[];
  /** Show the current biome's boss at this share of its HP (0–1). A view patch, not derived. */
  bossHp?: number;
}

export const NO_WHAT_IF: WhatIf = { sessions: [] };
export const isWhatIfOff = (w: WhatIf) => !w.sessions.length && w.bossHp === undefined;

const MIN = 60_000;

/** The real input plus the overlay's sessions (ending at `now`, back to back) and their weak points. */
export function withWhatIf(input: DeriveInput, w: WhatIf): DeriveInput {
  if (!w.sessions.length) return input;
  let q: ops.QuestSlice = { items: [...input.items], links: [...input.links] };
  const sessions: Session[] = [];
  let end = input.now;
  w.sessions.forEach((s, i) => {
    const minutes = Math.max(1, Math.round(s.minutes));
    const start = end - minutes * MIN;
    sessions.push({ id: `qa:s${i}`, habitId: s.habitId, start, end, duration: minutes * 60 });
    end = start - MIN;
  });
  // Only sessions after the journey starts move it: start one just before them if needed.
  if (!ops.questMetaOf(q.items)) q = ops.startQuest(q, end);
  w.sessions.forEach((s, i) => {
    if (!s.weakPoint) return;
    q = ops.addTask(q, s.habitId, 'What-if weak point', input.now, `qa:t${i}`);
    q = ops.claimChest(q, { sessionId: `qa:s${i}`, habitId: s.habitId, doneTaskIds: [`qa:t${i}`], text: '', now: input.now });
  });
  return { ...input, sessions: [...input.sessions, ...sessions], items: q.items, links: q.links };
}

/** The game as the overlay would have it. */
export function whatIfGame(input: DeriveInput, w: WhatIf): GameState {
  const g = deriveGameState(withWhatIf(input, w));
  if (w.bossHp === undefined) return g;
  const at = g.journey.position;
  const boss = nodeAt(bossGlobal(at.biomeIndex, at.loop));
  const hp = Math.round(Math.max(0, Math.min(1, w.bossHp)) * g.journey.bossMaxHp);
  return { ...g, journey: { ...g.journey, position: boss, hp, maxHp: g.journey.bossMaxHp } };
}
