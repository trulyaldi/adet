// Reaching a boss: it looms and speaks its three lines. The Hollow Echo
// (self-doubt) also quotes the player's own chronicle back as encouragement.

import React from 'react';
import { View } from 'react-native';

import { parseBiomeRef } from '../../../domain/game/biomes';
import type { GameState } from '../../../domain/game/derive';
import { BIOMES } from '../../../game/content/biomes';
import { PALETTES } from '../../../game/content/palettes';
import { bossId, ROSTER } from '../../../game/content/roster';
import { useGameClock } from '../../../game/render/clock';
import { AnimatedSprite } from '../../../game/render/Sprite';
import { DialogBox } from '../../../game/ui/DialogBox';
import { CeremonyStage, useCeremonySize } from './Stage';
import { PE } from '../../../game/ui/pointer';

/** "You wrote: '…'. You can do this." from a past entry (short ones read best). */
export function echoQuote(game: GameState, seed: number): string | null {
  const entries = game.sessions.map((r) => (r.chronicle ?? '').trim()).filter((e) => e.length > 3 && e.length <= 48);
  if (!entries.length) return null;
  return `You wrote: "${entries[Math.abs(seed) % entries.length]}". You can do this.`;
}

export function BossIntro({ refId, game, onDone, reduced }: { refId: string; game: GameState; onDone(): void; reduced: boolean }) {
  const { worldW, worldH } = useCeremonySize();
  const r = parseBiomeRef(refId) ?? { biome: 'forest' as const, loop: 0 };
  const clock = useGameClock(!reduced);
  const lines = [...BIOMES[r.biome].boss.before];
  const quote = r.biome === 'astral' ? echoQuote(game, game.sessions.length) : null;
  return (
    <CeremonyStage
      background={PALETTES[r.biome].sky[0]}
      onTap={() => {}}
      label={ROSTER[r.biome].boss.name}
      scene={<AnimatedSprite id={`${bossId(r.biome)}.idle`} x={Math.round(worldW / 2)} y={Math.round(worldH * 0.46)} clock={clock} />}
    >
      <View style={[PE.boxNone, { flex: 1, justifyContent: 'flex-end', padding: 16, paddingBottom: 48 }]}>
        <DialogBox name={ROSTER[r.biome].boss.name} portrait={`trophy.${r.biome}`} portraitStatic={4} lines={quote ? [...lines, quote] : lines} onDone={onDone} reduced={reduced} />
      </View>
    </CeremonyStage>
  );
}
