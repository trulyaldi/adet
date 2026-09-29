// The travelling camp at the avatar's side: the campfire (bright when today's
// plan is done, soft embers otherwise), Aqyl, Saudager, Hatshy, the Quest
// Board, the pile of unopened chests and the companion. Then the avatar.

import React, { memo, useMemo } from 'react';
import type { SharedValue } from 'react-native-reanimated';

import type { AvatarLook } from '../../../game/avatar';
import { FireStyle } from '../../../game/content/shop';
import { AvatarSprite } from '../../../game/render/Avatar';
import { Lights } from '../../../game/render/Lighting';
import { BatchItem, SpriteBatch } from '../../../game/render/SpriteBatch';
import { campLayout } from '../model';

export interface CampProps {
  at: { x: number; y: number };
  fireLit: boolean;
  fireStyle: FireStyle;
  chests: number;
  pet: string | null;
  look: AvatarLook;
  pips: number;
  avatarX: SharedValue<number>;
  avatarY: SharedValue<number>;
  avatarMode: SharedValue<number>;
  clock: SharedValue<number>;
  night: number;
  reduced: boolean;
}

export const CampLayer = memo(function CampLayer(p: CampProps) {
  const layout = useMemo(() => campLayout(p.at), [p.at]);
  const { items, lights } = useMemo(() => {
    const items: BatchItem[] = [];
    const lights: BatchItem[] = [];
    for (const c of layout) {
      switch (c.thing) {
        case 'fire':
          items.push({ id: `prop.campfire.${p.fireStyle}.${p.fireLit ? 'lit' : 'embers'}`, x: c.x, y: c.y });
          lights.push({ id: p.fireLit ? 'fx.glow.warm' : 'fx.glow.small', x: c.x, y: c.y - 6 });
          break;
        case 'sage':
          items.push({ id: 'npc.sage.idle', x: c.x, y: c.y, flip: c.x > p.at.x });
          break;
        case 'merchant':
          items.push({ id: 'npc.merchant.idle', x: c.x, y: c.y, flip: c.x > p.at.x });
          break;
        case 'scribe':
          items.push({ id: 'npc.scribe.idle', x: c.x, y: c.y, flip: c.x > p.at.x });
          break;
        case 'board':
          items.push({ id: 'prop.board', x: c.x, y: c.y });
          break;
        case 'chests':
          for (let i = 0; i < Math.min(3, p.chests); i++) items.push({ id: 'prop.chest.closed', x: c.x - 5 + i * 7, y: c.y - (i === 1 ? 4 : 0), phase: i * 2 });
          break;
        case 'pet':
          if (p.pet) items.push({ id: `${p.pet}.idle`, x: c.x, y: c.y, wander: p.reduced ? 0 : 5 });
          break;
      }
    }
    items.sort((a, b) => a.y - b.y);
    return { items, lights };
  }, [layout, p.fireLit, p.fireStyle, p.chests, p.pet, p.at.x, p.reduced]);
  return (
    <>
      <SpriteBatch atlas="shared" items={items} clock={p.clock} />
      <AvatarSprite look={p.look} x={p.avatarX} y={p.avatarY} mode={p.avatarMode} clock={p.clock} pips={p.pips} />
      <Lights items={lights} clock={p.clock} intensity={Math.max(p.fireLit ? 0.55 : 0.35, p.night)} />
    </>
  );
});
