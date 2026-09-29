// Which sprite layers make up the avatar, back to front: back (banner, cloak
// or the tier's own back piece), body, outfit (from the rank tier, never
// equippable), head, hand, then the ascension star pips. Pure: the catalog is
// passed in, so a SKU this build doesn't know (bought on a newer build, a
// removed item) quietly falls back to the tier's default.

import type { GearSlot } from '../items/types';

export type AvatarLayer = 'back' | 'body' | 'outfit' | 'head' | 'hand' | 'pip';
/** Back to front. */
export const AVATAR_LAYERS: readonly AvatarLayer[] = ['back', 'body', 'outfit', 'head', 'hand', 'pip'];

export interface LayerSpec {
  /** Manifest sprite id. */
  id: string;
  layer: AvatarLayer;
}

export type AvatarGear = Partial<Record<GearSlot, string>>;
/** What the resolver needs to know about a SKU: the gear slot it fits. */
export type GearCatalog = ReadonlyMap<string, { slot?: GearSlot }>;

export const TIER_COUNT = 7;
/** Star pips shown at most (one per ascension loop). */
export const MAX_PIPS = 3;
/** Tiers whose outfit has a back piece (cloak, cape, mantle, aura). */
const TIER_BACKS = new Set([0, 3, 4, 5, 6]);

export const clampTier = (tier: number) => Math.max(0, Math.min(TIER_COUNT - 1, Math.floor(Number.isFinite(tier) ? tier : 0)));

export function resolveAvatarLayers(tier: number, gear: AvatarGear, stars: number, catalog: GearCatalog): LayerSpec[] {
  const t = clampTier(tier);
  const worn = (slot: GearSlot): string | null => {
    const sku = gear[slot];
    return sku && catalog.get(sku)?.slot === slot ? sku : null;
  };
  const out: LayerSpec[] = [];
  const banner = worn('banner');
  const cloak = worn('cloak');
  const helmet = worn('helmet');
  const weapon = worn('weapon');
  if (banner) out.push({ id: `avatar.${banner}`, layer: 'back' });
  if (cloak) out.push({ id: `avatar.${cloak}`, layer: 'back' });
  else if (TIER_BACKS.has(t)) out.push({ id: `avatar.back.${t}`, layer: 'back' });
  out.push({ id: 'avatar.body', layer: 'body' }, { id: `avatar.outfit.${t}`, layer: 'outfit' });
  if (helmet) out.push({ id: `avatar.${helmet}`, layer: 'head' });
  out.push({ id: weapon ? `avatar.${weapon}` : t === 0 ? 'avatar.weapon.staff' : 'avatar.weapon.basic', layer: 'hand' });
  const pips = Math.max(0, Math.min(MAX_PIPS, Math.floor(Number.isFinite(stars) ? stars : 0)));
  for (let i = 0; i < pips; i++) out.push({ id: 'avatar.pip', layer: 'pip' });
  return out;
}
