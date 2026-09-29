// Which sprite layers make up the avatar, bottom to top: back gear, the rank
// tier's back piece, body, outfit, helmet, weapon. Owned cosmetics override
// the tier's defaults; everything shares one frame, so layers never clip.

import type { GearSlot } from '../domain/items/types';

export interface AvatarLook {
  tier: number;
  gear: Partial<Record<GearSlot, string>>;
}

/** Tiers whose outfit has a back layer (cloak, cape, mantle, aura). */
const TIER_BACKS = new Set([0, 3, 4, 5, 6]);

export function avatarLayers({ tier, gear }: AvatarLook): string[] {
  const t = Math.max(0, Math.min(6, Math.floor(tier)));
  const layers: string[] = [];
  if (gear.banner) layers.push(`avatar.${gear.banner}`);
  if (gear.cloak) layers.push(`avatar.${gear.cloak}`);
  else if (TIER_BACKS.has(t)) layers.push(`avatar.back.${t}`);
  layers.push('avatar.body', `avatar.outfit.${t}`);
  if (gear.helmet) layers.push(`avatar.${gear.helmet}`);
  layers.push(gear.weapon ? `avatar.${gear.weapon}` : t === 0 ? 'avatar.weapon.staff' : 'avatar.weapon.basic');
  return layers;
}

/** Pose frames in the avatar sprites. */
export const POSE = { idle: [0, 1], walk: [2, 3], kneel: [4] } as const;
