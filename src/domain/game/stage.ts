// The timer Stage's scene logic, pure (v2 N6). The Stage only presents: what
// the enemy shows comes from a live preview of the running session through
// deriveGameState (the same rules the saved session will get), and the scene
// moves between fight, defeat, walk-in, nap and wake on its own clock.

import { sessionFromTimer } from '../sessions';
import type { ActiveTimer, Session } from '../types';
import { DeriveInput, deriveGameState, GameState, NodeKind } from './derive';

export type SceneState = 'fight' | 'defeat' | 'walkIn' | 'nap' | 'wake' | 'ended';
export const SCENE_STATES: readonly SceneState[] = ['fight', 'defeat', 'walkIn', 'nap', 'wake', 'ended'];

/** Slow, calm timings (milliseconds). */
export const STAGE_TIMING = {
  /** The enemy dissolves into petals and a coin sparkles. */
  defeatMs: 2400,
  /** The next enemy walks in from the right. */
  walkInMs: 1800,
  /** A stretch, then back up. */
  wakeMs: 1600,
  /** The light softens this much toward dusk during a nap. */
  napDusk: 0.13,
} as const;

export type TimerState = 'running' | 'paused' | 'ended';

/** The enemy as the preview has it right now. */
export interface Encounter {
  global: number;
  kind: NodeKind;
  hp: number;
  maxHp: number;
}

export interface StageState {
  scene: SceneState;
  /** Clock time the scene began. */
  since: number;
  /** The enemy on stage (during a defeat, the one falling). */
  enemy: Encounter;
}

export function encounterOf(game: GameState): Encounter {
  const j = game.journey;
  return { global: j.position.global, kind: j.position.kind, hp: j.hp, maxHp: j.maxHp };
}

/** The running session as it would be saved now (null before it counts). */
export function liveSession(active: ActiveTimer | null, now: number): Session | null {
  return active ? sessionFromTimer(active, now) : null;
}

/** The game with the running session included, exactly as saving it now would derive. */
export function previewGame(input: DeriveInput, live: Session | null): GameState {
  return deriveGameState(live ? { ...input, sessions: [...input.sessions, live] } : input);
}


/**
 * One step of the scene. `enc` is the preview's current enemy. A different
 * enemy than the one on stage means the preview beat it: it falls (defeat),
 * then the new one walks in. Pausing naps; resuming wakes, then fights.
 */
export function stageStep(prev: StageState | null, timer: TimerState, enc: Encounter, now: number): StageState {
  const keep = (scene: SceneState, enemy = enc): StageState => ({ scene, since: prev && prev.scene === scene ? prev.since : now, enemy });
  if (timer === 'ended') return keep('ended');
  if (!prev || prev.scene === 'ended') return timer === 'paused' ? keep('nap') : keep('fight');
  if (timer === 'paused') return { scene: 'nap', since: prev.scene === 'nap' ? prev.since : now, enemy: prev.enemy.global === enc.global ? enc : prev.enemy };
  const elapsed = now - prev.since;
  switch (prev.scene) {
    case 'nap':
      return { scene: 'wake', since: now, enemy: prev.enemy };
    case 'wake':
      if (elapsed < STAGE_TIMING.wakeMs) return { ...prev, enemy: prev.enemy.global === enc.global ? enc : prev.enemy };
      break;
    case 'defeat':
      if (elapsed < STAGE_TIMING.defeatMs) return prev;
      return { scene: 'walkIn', since: now, enemy: enc };
    case 'walkIn':
      if (elapsed < STAGE_TIMING.walkInMs) return { ...prev, enemy: enc };
      return { scene: 'fight', since: now, enemy: enc };
  }
  if (enc.global !== prev.enemy.global) return { scene: 'defeat', since: now, enemy: { ...prev.enemy, hp: 0 } };
  const scene: SceneState = 'fight';
  return { scene, since: prev.scene === scene ? prev.since : now, enemy: enc };
}
