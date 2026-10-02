// The timer skins behind one small interface (skins/common.tsx).

import type { TimerSkin } from '../../../../domain/game/timerSkin';
import { campfire } from './Campfire';
import type { SkinRegistry, SkinRenderer } from './common';
import { hourglass } from './Hourglass';
import { sunArc } from './SunArc';
import { trail } from './Trail';

export const SKINS: SkinRegistry = { sun: sunArc, campfire, hourglass, trail };

export function skinRenderer(skin: TimerSkin): SkinRenderer {
  return SKINS[skin] ?? sunArc;
}
