// Biome twists: how a session's effective minutes become base damage while
// that biome is active. Crits are added on top (see derive.ts).

import * as B from './balance';
import { BiomeId } from './biomes';

export interface TwistCtx {
  /** Effective minutes (after the day cap). */
  effMin: number;
  /** Focused minutes as tracked. */
  minutes: number;
  /** No pauses inside the session (pauses fold into the duration, so every timer session is). */
  unbroken: boolean;
  /** Weak points completed in this session (known once its chest is claimed). */
  completedTasks: number;
  /** Its chest was claimed with a non-empty chronicle entry. */
  hasChronicle: boolean;
  /** The day's first qualifying session. */
  firstOfDay: boolean;
  /** Local hour the session started. */
  startHour: number;
  /** Effective minutes of the whole local day. */
  dayEffMin: number;
  /** Effective minutes of the day before. */
  prevDayEffMin: number;
}

/** Base damage (unrounded) for a session in `biome`. */
export function twistDamage(biome: BiomeId, c: TwistCtx): number {
  const e = c.effMin;
  switch (biome) {
    case 'forest':
      return e;
    case 'swamp':
      return c.unbroken && c.minutes >= B.SWAMP_UNBROKEN_MIN ? e * B.SWAMP_MULT : e;
    case 'desert':
      return e * (c.completedTasks > 0 ? B.DESERT_WITH_TASK : B.DESERT_WITHOUT_TASK);
    case 'frost':
      return c.firstOfDay ? e + Math.min(B.FROST_FIRST_MIN, e) * (B.FROST_MULT - 1) : e;
    case 'iron':
      return c.startHour < B.IRON_BEFORE_HOUR ? e * B.IRON_MULT : e;
    case 'volcano': {
      let m = 1;
      if (c.dayEffMin >= B.VOLCANO_DAY_MIN && c.dayEffMin <= B.VOLCANO_DAY_MAX) m *= B.VOLCANO_DAY_MULT;
      if (c.prevDayEffMin <= 0) m *= B.VOLCANO_RESTED_MULT;
      return e * m;
    }
    case 'astral':
      return c.hasChronicle ? e * B.ASTRAL_MULT : e;
  }
}

/** Whether a session counts as Rested in the volcano (for the UI's buff icon). */
export function isRested(c: Pick<TwistCtx, 'prevDayEffMin'>): boolean {
  return c.prevDayEffMin <= 0;
}
