// The avatar's look against this build's catalog: the layer ids to draw
// (see resolveAvatarLayers) and the pose frames every layer shares.

import { AvatarLayer, resolveAvatarLayers } from '../domain/game/avatar';
import type { GearSlot } from '../domain/items/types';
import { SHOP_BY_SKU } from './content/shop';

export interface AvatarLook {
  tier: number;
  gear: Partial<Record<GearSlot, string>>;
}

/** Sprite layer ids bottom → top, without the pips (drawn apart, above a shoulder). */
export function avatarLayers({ tier, gear }: AvatarLook, visible?: readonly AvatarLayer[]): string[] {
  return resolveAvatarLayers(tier, gear, 0, SHOP_BY_SKU)
    .filter((l) => !visible || visible.includes(l.layer))
    .map((l) => l.id);
}

export type AvatarAnimation = 'idle' | 'walk' | 'kneel' | 'cheer' | 'wave';

/** Pose frames in the avatar sprites (cheer hops on the idle frame; wave adds the arm layer). */
export const POSE = { idle: [0, 1], walk: [2, 3], kneel: [4], cheer: [0], wave: [0] } as const;
