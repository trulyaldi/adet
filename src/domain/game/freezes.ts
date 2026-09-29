// Streak freezes bought from the Merchant: extra freezes for the month they
// were bought in, added to the streak's per-month allowance (streaks.ts).

import { Item, itemsOfType } from '../items/types';

export const FREEZE_SKU = 'freeze';
export const FREEZE_COST = 60;
/** Most freezes that can be bought per calendar month. */
export const FREEZES_BUYABLE_PER_MONTH = 2;

/** Bought freezes per 'YYYY-MM' (capped per month). */
export function boughtFreezes(items: readonly Item[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of itemsOfType(items, 'purchase')) {
    if (p.props.sku !== FREEZE_SKU || !p.props.month) continue;
    out[p.props.month] = Math.min(FREEZES_BUYABLE_PER_MONTH, (out[p.props.month] ?? 0) + 1);
  }
  return out;
}
