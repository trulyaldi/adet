// Saudager's stock. Cosmetics are purely visual; some wait for a rank, which
// gives promotions something to unlock. Pure data.

import { FREEZE_COST, FREEZE_SKU } from '../../domain/game/freezes';
import type { GearSlot } from '../../domain/items/types';

export type ShopKind = 'freeze' | 'gear' | 'companion' | 'campfire';

export interface ShopItem {
  sku: string;
  kind: ShopKind;
  name: string;
  cost: number;
  /** Gear slot for cosmetics. */
  slot?: GearSlot;
  /** Rank tier (0–6) needed to buy and to wear it. */
  rankRequired?: number;
  /** The manifest id of its icon. */
  icon: string;
}

export const SHOP: ShopItem[] = [
  { sku: FREEZE_SKU, kind: 'freeze', name: 'Streak freeze', cost: FREEZE_COST, icon: 'icon.freeze' },

  { sku: 'cloak.moss', kind: 'gear', slot: 'cloak', name: 'Moss cloak', cost: 40, icon: 'icon.gear.cloak.moss' },
  { sku: 'cloak.dusk', kind: 'gear', slot: 'cloak', name: 'Dusk cloak', cost: 90, rankRequired: 2, icon: 'icon.gear.cloak.dusk' },
  { sku: 'cloak.aurora', kind: 'gear', slot: 'cloak', name: 'Aurora cloak', cost: 180, rankRequired: 4, icon: 'icon.gear.cloak.aurora' },

  { sku: 'helmet.leaf', kind: 'gear', slot: 'helmet', name: 'Leaf cap', cost: 30, icon: 'icon.gear.helmet.leaf' },
  { sku: 'helmet.horned', kind: 'gear', slot: 'helmet', name: 'Horned helm', cost: 110, rankRequired: 3, icon: 'icon.gear.helmet.horned' },
  { sku: 'helmet.star', kind: 'gear', slot: 'helmet', name: 'Star circlet', cost: 200, rankRequired: 5, icon: 'icon.gear.helmet.star' },

  { sku: 'banner.ember', kind: 'gear', slot: 'banner', name: 'Ember banner', cost: 70, rankRequired: 1, icon: 'icon.gear.banner.ember' },
  { sku: 'banner.tide', kind: 'gear', slot: 'banner', name: 'Tide banner', cost: 120, rankRequired: 3, icon: 'icon.gear.banner.tide' },

  { sku: 'weapon.oak', kind: 'gear', slot: 'weapon', name: 'Oak blade', cost: 35, icon: 'icon.gear.weapon.oak' },
  { sku: 'weapon.frost', kind: 'gear', slot: 'weapon', name: 'Frost blade', cost: 100, rankRequired: 2, icon: 'icon.gear.weapon.frost' },
  { sku: 'weapon.sun', kind: 'gear', slot: 'weapon', name: 'Sunsteel blade', cost: 220, rankRequired: 6, icon: 'icon.gear.weapon.sun' },

  { sku: 'pet.fox', kind: 'companion', name: 'Fox kit', cost: 80, icon: 'pet.fox.idle' },
  { sku: 'pet.owlet', kind: 'companion', name: 'Owlet', cost: 80, rankRequired: 1, icon: 'pet.owlet.idle' },
  { sku: 'pet.slime', kind: 'companion', name: 'Slime pet', cost: 60, icon: 'pet.slime.idle' },
  { sku: 'pet.ember', kind: 'companion', name: 'Ember sprite', cost: 140, rankRequired: 3, icon: 'pet.ember.idle' },

  { sku: 'fire.blue', kind: 'campfire', name: 'Spirit fire', cost: 50, icon: 'prop.campfire.blue.lit' },
  { sku: 'fire.lantern', kind: 'campfire', name: 'Lantern post', cost: 70, rankRequired: 1, icon: 'prop.campfire.lantern.lit' },
  { sku: 'fire.crystal', kind: 'campfire', name: 'Crystal hearth', cost: 150, rankRequired: 4, icon: 'prop.campfire.crystal.lit' },
];

export const SHOP_BY_SKU = new Map(SHOP.map((s) => [s.sku, s]));
export const GEAR_SKUS = SHOP.filter((s) => s.kind === 'gear').map((s) => s.sku);
export const PET_SKUS = SHOP.filter((s) => s.kind === 'companion').map((s) => s.sku);
/** Where an owned item goes: a gear slot on the avatar, beside it, or at camp. */
export type EquipSlot = GearSlot | 'companion' | 'camp';

export function equipSlotOf(item: ShopItem): EquipSlot | null {
  if (item.kind === 'gear') return item.slot ?? null;
  if (item.kind === 'companion') return 'companion';
  if (item.kind === 'campfire') return 'camp';
  return null;
}

/** Can `sku` go in `slot` now: a known item for that slot, owned, and not above the current rank. */
export function isEquippable(sku: string, slot: EquipSlot, owned: ReadonlySet<string>, rankIndex: number): boolean {
  const item = SHOP_BY_SKU.get(sku);
  if (!item || equipSlotOf(item) !== slot || !owned.has(sku)) return false;
  return (item.rankRequired ?? 0) <= rankIndex;
}

export const FIRE_STYLES = ['default', 'blue', 'lantern', 'crystal'] as const;
export type FireStyle = (typeof FIRE_STYLES)[number];
export const fireStyleOf = (sku: string | undefined): FireStyle =>
  sku === 'fire.blue' ? 'blue' : sku === 'fire.lantern' ? 'lantern' : sku === 'fire.crystal' ? 'crystal' : 'default';
