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

export type AvatarAnimation = 'idle' | 'walk' | 'kneel' | 'cheer' | 'wave' | 'attack' | 'nap' | 'wake' | 'sit';
export const AVATAR_ANIMATIONS: readonly AvatarAnimation[] = ['idle', 'walk', 'kneel', 'cheer', 'wave', 'attack', 'nap', 'wake', 'sit'];

/**
 * Pose frames in the avatar sprites (the art pipeline's POSES, characters.ts): 0–1 idle,
 * 2–3 walk, 4 kneel, 5–6 attack (wind-up, strike), 7–8 nap (breathing), 9 wake
 * (half up, eyes closed), 10 sit. Cheer hops on the idle frame; wave adds the
 * arm layer; attack returns to idle; wake ends standing.
 */
export const POSE = { idle: [0, 1], walk: [2, 3], kneel: [4], cheer: [0], wave: [0], attack: [5, 6, 0], nap: [7, 8], wake: [9, 0], sit: [10] } as const;
