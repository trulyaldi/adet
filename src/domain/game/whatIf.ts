// The dev QA panel's "what if": synthetic sessions and weak points added to
// a copy of the real input, derived in memory. Nothing here is ever stored or
// synced; with no overlay the result is exactly the real game.

import * as ops from '../items/ops';
import type { Session } from '../types';
import { bossGlobal, DeriveInput, deriveGameState, GameState, nodeAt, SealKind } from './derive';

export interface WhatIfSession {
  habitId: string;
  minutes: number;
  /** Also tick one completed weak point (a crit and task XP, via a claimed chest). */
  weakPoint?: boolean;
  /** End this many days before now (a synthetic week for the Trail); default: back to back ending now. */
  daysAgo?: number;
}

export interface WhatIf {
  sessions: WhatIfSession[];
  /** Show the current biome's boss at this share of its HP (0–1). A view patch, not derived. */
  bossHp?: number;
  /** Show the current boss's seals with these counts (a view patch, not derived). */
  seals?: Partial<Record<SealKind, number>>;
  /** Quick logs with a line, written now (in memory). */
  quickLogs?: number;
}

export const NO_WHAT_IF: WhatIf = { sessions: [] };
export const isWhatIfOff = (w: WhatIf) => !w.sessions.length && w.bossHp === undefined && !w.seals && !w.quickLogs;

const MIN = 60_000;
const DAY = 86_400_000;

/** The real input plus the overlay's sessions (ending at `now`, back to back) and their weak points. */
export function withWhatIf(input: DeriveInput, w: WhatIf): DeriveInput {
  if (!w.sessions.length && !w.quickLogs) return input;
  let q: ops.QuestSlice = { items: [...input.items], links: [...input.links] };
  const sessions: Session[] = [];
  let end = input.now;
  w.sessions.forEach((s, i) => {
    const minutes = Math.max(1, Math.round(s.minutes));
    const e = s.daysAgo !== undefined ? input.now - s.daysAgo * DAY : end;
    const start = e - minutes * MIN;
    sessions.push({ id: `qa:s${i}`, habitId: s.habitId, start, end: e, duration: minutes * 60 });
    if (s.daysAgo === undefined) end = start - MIN;
  });
  const first = Math.min(end, ...sessions.map((s) => s.start - MIN));
  for (let i = 0; i < (w.quickLogs ?? 0); i++) {
    const habitId = w.sessions[0]?.habitId ?? input.habits[0]?.id ?? 'qa:habit';
    q = ops.addQuickLog(q, { habitId, text: 'What-if quick log', now: input.now - i * MIN }, `qa:q${i}`);
  }
  end = first;
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
  let g = deriveGameState(withWhatIf(input, w));
  if (w.bossHp !== undefined) {
    const at = g.journey.position;
    const boss = nodeAt(bossGlobal(at.biomeIndex, at.loop));
    const hp = Math.round(Math.max(0, Math.min(1, w.bossHp)) * g.journey.bossMaxHp);
    g = { ...g, journey: { ...g.journey, position: boss, hp, maxHp: g.journey.bossMaxHp } };
  }
  if (w.seals) {
    const seals = g.journey.seals.map((s) => (w.seals![s.kind] === undefined ? s : { ...s, have: Math.max(0, w.seals![s.kind]!) }));
    const unmet = seals.some((s) => s.have < s.need);
    g = { ...g, journey: { ...g.journey, seals, staggered: g.journey.position.kind === 'boss' && g.journey.hp <= 0 && unmet } };
  }
  return g;
}
