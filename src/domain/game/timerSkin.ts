// The timer's skins (the pixel redesign): a diegetic clock drawn in the
// Stage's world, driven only by today's time against the target. Everything
// here is pure and derived from timestamps, so nothing is stored per frame
// and a relaunch lands on the same picture.

import type { SceneKind } from '../types';

export type TimerSkin = 'sun' | 'campfire' | 'hourglass' | 'trail';
export const TIMER_SKINS: readonly TimerSkin[] = ['sun', 'campfire', 'hourglass', 'trail'];
export const DEFAULT_TIMER_SKIN: TimerSkin = 'sun';

export function isTimerSkin(v: unknown): v is TimerSkin {
  return typeof v === 'string' && (TIMER_SKINS as readonly string[]).includes(v);
}

/** The nearest skin to each old per-project focus scene (read only: the project's scene is never rewritten). */
export const SKIN_FROM_SCENE: Record<SceneKind, TimerSkin> = {
  // Orbs circling the ring → a sun crossing the sky.
  orbit: 'sun',
  // Stars appearing over time → stars over the campfire.
  constellation: 'campfire',
  // A vessel filling → sand filling the glass.
  fill: 'hourglass',
  // Something growing along the way → a walk toward the landmark.
  plant: 'trail',
};

/** The skin to draw: the one chosen in Settings, else the project's old scene mapped, else the default. */
export function resolveTimerSkin(chosen: unknown, legacyScene: unknown): TimerSkin {
  if (isTimerSkin(chosen)) return chosen;
  if (typeof legacyScene === 'string' && Object.prototype.hasOwnProperty.call(SKIN_FROM_SCENE, legacyScene)) return SKIN_FROM_SCENE[legacyScene as SceneKind];
  return DEFAULT_TIMER_SKIN;
}

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0);

/**
 * Today's time against the target as the skins read it (0…1, clamped; past
 * the target is a separate flag). With reduced motion it moves only once a
 * minute.
 */
export function skinProgress(sec: number, targetSec: number, reduced: boolean): { progress: number; past: boolean } {
  if (!(targetSec > 0)) return { progress: 1, past: true };
  const s = reduced ? Math.floor(Math.max(0, sec) / 60) * 60 : Math.max(0, sec);
  return { progress: clamp01(s / targetSec), past: sec >= targetSec };
}

/**
 * Sun Arc: where the sun sits (fractions of the sky: x from the left, lift
 * from the horizon) and how warm the light is (dawn and dusk warm, noon
 * clear). The warmth is capped, so the sky never goes dark.
 */
export function sunAt(progress: number): { x: number; lift: number; warmth: number } {
  const p = clamp01(progress);
  const lift = Math.sin(Math.PI * p);
  return { x: 0.08 + 0.84 * p, lift, warmth: Math.min(0.6, 1 - lift) };
}

/** Campfire: how lively the fire is (never below a warm glow, so it never "dies"). */
export function fireLevel(progress: number): number {
  return 0.4 + 0.6 * clamp01(progress);
}

/** Stars shown so far out of `max` (campfire sky; all of them at the target). */
export function starsShown(progress: number, max: number): number {
  return Math.floor(clamp01(progress) * max);
}

/** Hourglass: the share of sand in the top and bottom chambers. */
export function sandAt(progress: number): { top: number; bottom: number } {
  const p = clamp01(progress);
  return { top: 1 - p, bottom: p };
}

/** Trail: how far the landmark has come in from the right edge (0 = just peeking, 1 = arrived). */
export function trailAt(progress: number): number {
  return clamp01(progress);
}

/** Whole HP pips for a meter of `segments` (a sliver left still shows one). */
export function hpPips(hp: number, maxHp: number, segments: number): number {
  if (!(hp > 0) || !(maxHp > 0)) return 0;
  return Math.max(1, Math.min(segments, Math.ceil((hp / maxHp) * segments)));
}

/** The focus screen's four zones (points). */
export interface FocusLayout {
  headerTop: number;
  headerH: number;
  plateTop: number;
  plateH: number;
  /** The plate's digit size: a multiple of 8, crisp in the pixel font. */
  digits: number;
  stageTop: number;
  stageH: number;
  controlsTop: number;
  controlsH: number;
}

export const FOCUS_GAP = 12;
const HEADER_H = 44;
const CONTROLS_H = 60;
/** The Stage's share of the screen: at least this much when it fits, and never more. */
export const STAGE_MIN_SHARE = 0.45;
export const STAGE_MAX_SHARE = 0.55;

/**
 * Header, clock plate, Stage, controls, top to bottom. The Stage takes what's
 * left, capped at 55% of the screen; on short screens the plate's digits
 * shrink a step first so the Stage keeps its 45%.
 */
export function focusLayout(screenH: number, insetTop: number, insetBottom: number): FocusLayout {
  const headerTop = insetTop + 8;
  const controlsH = CONTROLS_H;
  const controlsTop = screenH - Math.max(insetBottom, 12) - 8 - controlsH;
  const plateTop = headerTop + HEADER_H + FOCUS_GAP;
  const plateFor = (d: number) => d + 56;
  let digits = 64;
  for (const d of [64, 56, 48, 40]) {
    digits = d;
    const room = controlsTop - FOCUS_GAP - (plateTop + plateFor(d) + FOCUS_GAP);
    if (room >= screenH * STAGE_MIN_SHARE) break;
  }
  const plateH = plateFor(digits);
  const room = Math.max(0, controlsTop - FOCUS_GAP - (plateTop + plateH + FOCUS_GAP));
  const stageH = Math.floor(Math.min(room, screenH * STAGE_MAX_SHARE));
  // Spare room above a capped Stage goes to the plate's breathing space.
  const spare = room - stageH;
  const stageTop = plateTop + plateH + FOCUS_GAP + Math.floor(spare / 2);
  return { headerTop, headerH: HEADER_H, plateTop: plateTop + Math.floor(spare / 4), plateH, digits, stageTop, stageH, controlsTop, controlsH };
}
