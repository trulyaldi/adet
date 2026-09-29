// The character: the avatar large in its gear (tap it to wave), rank title,
// level and XP; the gear slots (tap one for a strip of what you own, tap an
// item to wear it at once); a skill per habit; and the trophy shelf, one
// boss per biome. Nothing Stats already shows.

import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';

import { Icon } from '../../../components/Icon';
import { useQuestWrites } from '../../../data/itemsRepo';
import { ICONS } from '../../../domain/constants';
import { RANKS } from '../../../domain/game/balance';
import { BIOME_IDS } from '../../../domain/game/biomes';
import { gameStateOf } from '../../../domain/game/fromData';
import { itemsOfType } from '../../../domain/items/types';
import { EquipSlot, equipSlotOf, isEquippable, SHOP, ShopItem } from '../../../game/content/shop';
import { ROSTER } from '../../../game/content/roster';
import { Avatar } from '../../../game/render/Avatar';
import { SpriteView } from '../../../game/render/SpriteView';
import { XPBar } from '../../../game/ui/HPBar';
import { PixelPanel } from '../../../game/ui/PixelPanel';
import { PixelText } from '../../../game/ui/PixelText';
import { QUI, useUiUnit } from '../../../game/ui/theme';
import { useData } from '../../../store/StreakStore';
import type { QuestModel } from '../useQuestModel';
import { IconGrid, QuestSheet, Row } from './common';

/** The slots in the order they show: back (cloak, banner), head, hand, companion, camp. */
const SLOTS: EquipSlot[] = ['cloak', 'banner', 'helmet', 'weapon', 'companion', 'camp'];
const SLOT_NAMES: Record<EquipSlot, string> = { cloak: 'Cloak', banner: 'Banner', helmet: 'Head', weapon: 'Blade', companion: 'Pet', camp: 'Camp' };
const WAVE_MS = 1800;

export function CharacterSheet({ model, onClose, reduced }: { model: QuestModel; onClose(): void; reduced: boolean }) {
  const { width } = useWindowDimensions();
  const u = useUiUnit();
  const data = useData();
  const game = gameStateOf(data);
  const writes = useQuestWrites();
  const meta = model.meta?.props;
  const [slot, setSlot] = useState<EquipSlot | null>(null);
  const [waving, setWaving] = useState(false);
  useEffect(() => {
    if (!waving) return;
    const t = setTimeout(() => setWaving(false), WAVE_MS);
    return () => clearTimeout(t);
  }, [waving]);

  const owned = new Set(itemsOfType(data.items, 'purchase').map((p) => p.props.sku));
  const tier = game.rank.tier;
  const gear = meta?.avatar.gear ?? {};
  const stars = game.journey.position.loop;

  const current = (s: EquipSlot): string | undefined => (s === 'companion' ? meta?.companion : s === 'camp' ? meta?.campfire : gear[s]);
  const optionsFor = (s: EquipSlot): ShopItem[] => SHOP.filter((i) => owned.has(i.sku) && equipSlotOf(i) === s);
  const wear = (s: EquipSlot, sku: string | null) => {
    if (sku && !isEquippable(sku, s, owned, tier)) return;
    writes.updateQuestMeta((p) => {
      if (s === 'companion') return { ...p, companion: sku ?? undefined };
      if (s === 'camp') return { ...p, campfire: sku ?? undefined };
      const g = { ...p.avatar.gear };
      if (sku) g[s] = sku;
      else delete g[s];
      return { ...p, avatar: { ...p.avatar, gear: g } };
    });
  };

  // Skills by XP, deleted habits last ("retired").
  const skills = [...game.skills].sort((a, b) => Number(a.retired) - Number(b.retired) || b.minutes - a.minutes);
  const loopsBeaten = new Map<string, number>();
  for (const d of game.journey.defeated) loopsBeaten.set(d.biome, (loopsBeaten.get(d.biome) ?? 0) + 1);
  const bossesBeaten = loopsBeaten.size;
  const summary = `Level ${game.xp.level} ${game.rank.title}, ${bossesBeaten} of ${BIOME_IDS.length} bosses defeated`;
  const avatarScale = Math.max(3, Math.min(7, Math.floor((width - 160) / 20)));
  // Six tiles on one row (44 pt at least).
  const tile = Math.max(44, Math.min(52, Math.floor((width - 72) / 6) - 2 * u));
  const trophyCell = Math.max(44, Math.min(56, Math.floor((width - 64) / 7)));

  return (
    <QuestSheet visible title={game.rank.title} onClose={onClose} reduced={reduced}>
      <View accessible accessibilityLabel={summary} style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }} />
      <View style={{ alignItems: 'center', gap: 2 * u }}>
        <Row style={{ alignItems: 'flex-end' }}>
          <Pressable onPress={() => setWaving(true)} accessibilityRole="button" accessibilityLabel={`Your ${game.rank.title}. Wave`} style={{ backgroundColor: QUI.parchmentDark, padding: 2 * u, minWidth: 44, minHeight: 44 }}>
            <Avatar tier={tier} gear={gear} stars={stars} animation={waving ? 'wave' : 'idle'} scale={avatarScale} animate={!reduced} />
          </Pressable>
          {meta?.companion && <SpriteView id={`${meta.companion}.idle`} scale={Math.max(2, avatarScale - 2)} animate={!reduced} accessibilityLabel="Your companion" />}
        </Row>
        {stars > 0 && (
          <PixelText size="sm" color={QUI.goldDark}>
            Ascension {stars}
          </PixelText>
        )}
        <PixelText size="md" bold accessibilityLabel={`Level ${game.xp.level}`}>
          LV {game.xp.level}
        </PixelText>
        <XPBar value={game.xp.xpForNextLevel ? game.xp.xpIntoLevel / game.xp.xpForNextLevel : 0} width={Math.min(260, width - 80)} label={`Experience, ${game.xp.xpIntoLevel} of ${game.xp.xpForNextLevel}`} />
        <PixelText size="tiny" color={QUI.muted} accessible={false}>
          {game.xp.xpIntoLevel} / {game.xp.xpForNextLevel}
        </PixelText>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: u }}>
        {SLOTS.map((s) => {
          const sku = current(s);
          const item = sku ? SHOP.find((i) => i.sku === sku) : null;
          const on = slot === s;
          return (
            <Pressable
              key={s}
              onPress={() => setSlot(on ? null : s)}
              accessibilityRole="button"
              accessibilityLabel={`${SLOT_NAMES[s]}: ${item?.name ?? 'none'}. Change`}
              accessibilityState={{ expanded: on }}
              style={{ alignItems: 'center', gap: u, width: tile, minHeight: 44 }}
            >
              <PixelPanel tone={on ? 'gold' : 'parchment'} padding={1} style={{ width: tile, height: tile, alignItems: 'center', justifyContent: 'center' }}>
                {item ? <SpriteView id={item.icon} scale={2} /> : <PixelText size="sm" color={QUI.muted}>—</PixelText>}
              </PixelPanel>
              <PixelText size="tiny" color={QUI.muted}>
                {SLOT_NAMES[s]}
              </PixelText>
            </Pressable>
          );
        })}
      </View>
      {slot && <GearStrip slot={slot} items={optionsFor(slot)} current={current(slot) ?? null} tier={tier} owned={owned} onWear={(sku) => wear(slot, sku)} />}

      <PixelText size="sm" bold color={QUI.wood} accessibilityRole="header">
        Skills
      </PixelText>
      {skills.length === 0 && (
        <PixelText size="sm" color={QUI.muted}>
          Each habit becomes a skill as you focus.
        </PixelText>
      )}
      {skills.map((k) => {
        const h = data.habits.find((x) => x.id === k.habitId);
        const name = h?.name ?? 'Retired skill';
        return (
          <Row key={k.habitId} style={{ opacity: k.retired ? 0.5 : 1 }}>
            <Icon path={ICONS[h?.icon ?? 'code'] || ICONS.code} size={18} color={QUI.wood} />
            <View style={{ flex: 1, gap: u }}>
              <Row>
                <PixelText size="sm" numberOfLines={1} style={{ flex: 1 }}>
                  {name}
                  {k.retired && h ? ' · retired' : ''}
                </PixelText>
                <PixelText size="sm" bold>
                  {k.level}
                </PixelText>
              </Row>
              <XPBar value={k.xpForNextLevel ? k.xpIntoLevel / k.xpForNextLevel : 0} width={Math.max(80, width - 140)} label={`${name}${k.retired ? ', retired' : ''}, skill level ${k.level}`} />
            </View>
          </Row>
        );
      })}

      <PixelText size="sm" bold color={QUI.wood} accessibilityRole="header">
        Trophies
      </PixelText>
      <IconGrid
        cells={BIOME_IDS.map((b) => {
          const n = loopsBeaten.get(b) ?? 0;
          const name = ROSTER[b].boss.name;
          return {
            key: b,
            icon: n ? `trophy.${b}` : `trophy.${b}.shadow`,
            label: n ? `${name}, defeated ${n === 1 ? 'once' : `${n} times`}` : 'A boss not yet faced',
            badge: n ? ('star' as const) : null,
            count: n > 1 ? n : undefined,
          };
        })}
        columns={trophyCell * BIOME_IDS.length <= width - 64 ? BIOME_IDS.length : 4}
        cell={trophyCell}
        scale={2}
        onPress={() => {}}
      />
    </QuestSheet>
  );
}

/** What you own for one slot, plus "none": tap to wear it now. Rank-locked pieces show a padlock. */
function GearStrip({ slot, items, current, tier, owned, onWear }: { slot: EquipSlot; items: ShopItem[]; current: string | null; tier: number; owned: ReadonlySet<string>; onWear(sku: string | null): void }) {
  const u = useUiUnit();
  if (!items.length) {
    return (
      <PixelPanel tone="wood" padding={2}>
        <PixelText size="sm" color={QUI.parchment}>
          Saudager may have something.
        </PixelText>
      </PixelPanel>
    );
  }
  const cell = 56;
  return (
    <PixelPanel tone="wood" padding={1}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 2 * u, padding: u }}>
        <Pressable onPress={() => onWear(null)} accessibilityRole="button" accessibilityLabel={`No ${SLOT_NAMES[slot].toLowerCase()}`} accessibilityState={{ selected: !current }} style={{ width: cell, height: cell, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: !current ? QUI.gold : 'transparent' }}>
          <PixelText size="md" color={QUI.parchment}>
            —
          </PixelText>
        </Pressable>
        {items.map((i) => {
          const ok = isEquippable(i.sku, slot, owned, tier);
          const on = current === i.sku;
          const need = i.rankRequired ?? 0;
          return (
            <Pressable
              key={i.sku}
              onPress={() => ok && onWear(i.sku)}
              accessibilityRole="button"
              accessibilityLabel={ok ? i.name : `${i.name}, locked until ${RANKS[need].title}`}
              accessibilityState={{ selected: on, disabled: !ok }}
              style={{ width: cell, height: cell, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: on ? QUI.gold : 'transparent' }}
            >
              <View style={{ opacity: ok ? 1 : 0.4 }}>
                <SpriteView id={i.icon} scale={2} />
              </View>
              {!ok && (
                <>
                  <SpriteView id="icon.lock" scale={1} style={{ position: 'absolute', right: 2, top: 2 }} />
                  <PixelText size="tiny" color={QUI.goldLight} style={{ position: 'absolute', bottom: 1 }}>
                    {RANKS[need].title}
                  </PixelText>
                </>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </PixelPanel>
  );
}
