// The slim HUD: the avatar's portrait, level, a thin XP bar and credits.
// Nothing else (Stats has the numbers).

import React from 'react';
import { Pressable, View } from 'react-native';

import type { GameState } from '../../domain/game/derive';
import type { AvatarLook } from '../../game/avatar';
import { Avatar } from '../../game/render/Avatar';
import { SpriteView } from '../../game/render/SpriteView';
import { XPBar } from '../../game/ui/HPBar';
import { PixelPanel } from '../../game/ui/PixelPanel';
import { PixelText } from '../../game/ui/PixelText';
import { QUI, useUiUnit } from '../../game/ui/theme';

export function Hud({ game, look, width, onAvatar, onLongPress }: { game: GameState; look: AvatarLook; width: number; onAvatar(): void; onLongPress?(): void }) {
  const u = useUiUnit();
  const { level, xpIntoLevel, xpForNextLevel } = game.xp;
  const barW = Math.max(60, width - 200);
  return (
    <PixelPanel tone="night" padding={1} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 * u }}>
      <Pressable
        onPress={onAvatar}
        onLongPress={onLongPress}
        accessibilityRole="button"
        accessibilityLabel={`${game.rank.title}, level ${level}. Open your character`}
        hitSlop={8}
        style={{ width: 44, height: 44, overflow: 'hidden', backgroundColor: QUI.nightLight, alignItems: 'center' }}
      >
        {/* Just the head and shoulders. */}
        <View style={{ marginTop: -4 }}>
          <Avatar tier={look.tier} gear={look.gear} stars={game.journey.position.loop} scale={3} animate={false} />
        </View>
      </Pressable>
      <View style={{ flex: 1, gap: u }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 2 * u }}>
          <PixelText size="md" bold color={QUI.white} accessibilityLabel={`Level ${level}`}>
            LV {level}
          </PixelText>
          <PixelText size="sm" color={QUI.goldLight}>
            {game.rank.title}
          </PixelText>
        </View>
        <XPBar value={xpForNextLevel ? xpIntoLevel / xpForNextLevel : 0} width={barW} label={`Experience, ${xpIntoLevel} of ${xpForNextLevel} to level ${level + 1}`} />
      </View>
      <View accessible accessibilityLabel={`${game.credits.balance} credits`} style={{ flexDirection: 'row', alignItems: 'center', gap: u, paddingRight: u }}>
        <SpriteView id="icon.coin" scale={2} />
        <PixelText size="md" bold color={QUI.goldLight}>
          {game.credits.balance}
        </PixelText>
      </View>
    </PixelPanel>
  );
}
