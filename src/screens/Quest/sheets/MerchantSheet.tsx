// Saudager the Fox, the Merchant: spend credits on streak freezes (at most
// two a month, added to the month's freezes), cosmetics, companions and
// campfire styles. Rank-gated wares show locked; ones out of reach are just
// dimmed, never scolded about.

import React, { useRef, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';

import { useQuestWrites } from '../../../data/itemsRepo';
import { RANKS } from '../../../domain/game/balance';
import { FREEZE_SKU, FREEZES_BUYABLE_PER_MONTH } from '../../../domain/game/freezes';
import { gameStateOf } from '../../../domain/game/fromData';
import { itemsOfType } from '../../../domain/items/types';
import { greeting, npcName } from '../../../game/content/npcs';
import { SHOP, SHOP_BY_SKU, ShopItem } from '../../../game/content/shop';
import { SpriteView } from '../../../game/render/SpriteView';
import { PixelButton } from '../../../game/ui/PixelButton';
import { PixelPanel } from '../../../game/ui/PixelPanel';
import { PixelText } from '../../../game/ui/PixelText';
import { QUI } from '../../../game/ui/theme';
import { useData } from '../../../store/StreakStore';
import type { QuestModel } from '../useQuestModel';
import { IconGrid, QuestSheet, Row } from './common';

const monthKey = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export function MerchantSheet({ model, onClose, reduced }: { model: QuestModel; onClose(): void; reduced: boolean }) {
  const { width } = useWindowDimensions();
  const writes = useQuestWrites();
  const data = useData();
  const game = gameStateOf(data);
  const meta = model.meta?.props;
  const [sel, setSel] = useState<string | null>(null);
  const busy = useRef(false);
  const month = monthKey(model.now);
  const purchases = itemsOfType(data.items, 'purchase');
  const owned = new Set(purchases.map((p) => p.props.sku));
  const freezesThisMonth = purchases.filter((p) => p.props.sku === FREEZE_SKU && p.props.month === month).length;
  const locked = (s: ShopItem) => (s.minTier ?? 0) > game.rank.tier;
  const canBuy = (s: ShopItem) => {
    if (locked(s)) return false;
    if (s.kind === 'freeze') return freezesThisMonth < FREEZES_BUYABLE_PER_MONTH && game.credits.balance >= s.cost;
    return !owned.has(s.sku) && game.credits.balance >= s.cost;
  };
  const inUse = (s: ShopItem) =>
    s.kind === 'gear' ? meta?.avatar.gear[s.slot!] === s.sku : s.kind === 'companion' ? meta?.companion === s.sku : s.kind === 'campfire' ? meta?.campfire === s.sku : false;

  const use = (s: ShopItem, on: boolean) =>
    writes.updateQuestMeta((p) => {
      if (s.kind === 'gear') {
        const gear = { ...p.avatar.gear };
        if (on) gear[s.slot!] = s.sku;
        else delete gear[s.slot!];
        return { ...p, avatar: { ...p.avatar, gear } };
      }
      if (s.kind === 'companion') return on ? { ...p, companion: s.sku } : { ...p, companion: undefined };
      if (s.kind === 'campfire') return on ? { ...p, campfire: s.sku } : { ...p, campfire: undefined };
      return p;
    });

  const buy = (s: ShopItem) => {
    // Guard double taps; re-check against the latest data.
    if (busy.current || !canBuy(s)) return;
    busy.current = true;
    setTimeout(() => (busy.current = false), 700);
    writes.purchase(s.sku, s.cost, s.kind === 'freeze' ? month : undefined);
    if (s.kind !== 'freeze') use(s, true);
  };

  const scale = 3;
  const cell = Math.floor(Math.min(84, (width - 64) / 4));
  const cells = SHOP.map((s) => ({
    key: s.sku,
    icon: s.icon,
    label: `${s.name}, ${s.cost} credits${locked(s) ? `, unlocks at ${RANKS[s.minTier!].title}` : owned.has(s.sku) && s.kind !== 'freeze' ? ', owned' : ''}`,
    dim: locked(s) || (!owned.has(s.sku) && !canBuy(s) && s.kind !== 'freeze') || (s.kind === 'freeze' && !canBuy(s)),
    badge: locked(s) ? ('lock' as const) : owned.has(s.sku) && s.kind !== 'freeze' ? ('check' as const) : null,
  }));
  const item = sel ? SHOP_BY_SKU.get(sel) : null;

  return (
    <QuestSheet visible title={npcName('merchant', meta?.settings)} portrait="npc.merchant" greeting={greeting('merchant', model.now >> 20)} onClose={onClose} reduced={reduced}>
      <Row style={{ justifyContent: 'center' }}>
        <SpriteView id="icon.coin" scale={2} />
        <PixelText size="lg" bold color={QUI.goldDark} accessibilityLabel={`${game.credits.balance} credits`}>
          {game.credits.balance}
        </PixelText>
      </Row>
      <IconGrid cells={cells} columns={4} cell={cell} scale={scale} onPress={setSel} selected={sel} />
      {item && (
        <PixelPanel tone="wood" padding={2} style={{ gap: 6 }}>
          <Row>
            <PixelText size="md" bold color={QUI.white} style={{ flex: 1 }}>
              {item.name}
            </PixelText>
            <SpriteView id="icon.coin" scale={2} />
            <PixelText size="md" bold color={QUI.goldLight}>
              {item.cost}
            </PixelText>
          </Row>
          {item.kind === 'freeze' && (
            <PixelText size="sm" color={QUI.parchment}>
              Keeps your streak on a quiet day. {freezesThisMonth}/{FREEZES_BUYABLE_PER_MONTH} this month.
            </PixelText>
          )}
          {locked(item) ? (
            <PixelText size="sm" color={QUI.parchment}>
              Unlocks at {RANKS[item.minTier!].title}.
            </PixelText>
          ) : owned.has(item.sku) && item.kind !== 'freeze' ? (
            <PixelButton
              label={inUse(item) ? (item.kind === 'gear' ? 'Take off' : 'Put away') : item.kind === 'gear' ? 'Wear' : item.kind === 'companion' ? 'Bring along' : 'Light it'}
              accessibilityLabel={`${inUse(item) ? 'Stop using' : 'Use'} ${item.name}`}
              onPress={() => use(item, !inUse(item))}
            />
          ) : (
            <PixelButton label="Buy" accessibilityLabel={`Buy ${item.name} for ${item.cost} credits`} onPress={() => buy(item)} disabled={!canBuy(item)} />
          )}
        </PixelPanel>
      )}
      <View style={{ height: 4 }} />
    </QuestSheet>
  );
}
