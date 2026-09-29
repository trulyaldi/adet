// Ceremonies (Q9): level-up, rank promotion and boss defeat, each played once
// per event on this device and skippable with a tap.

import React, { useEffect, useMemo, useState } from 'react';
import { Pressable } from 'react-native';

import type { GameState } from '../../../domain/game/derive';
import { CeremonyEvent, pendingCeremonies } from '../../../game/ceremonies';
import { getQuestLocal, markPlayed, updateQuestLocal } from '../../../game/state/local';
import { PixelPanel } from '../../../game/ui/PixelPanel';
import { PixelText } from '../../../game/ui/PixelText';

export function CeremonyPlayer({ game, onDone }: { game: GameState; before?: GameState; onDone(): void; reduced: boolean }) {
  const events = useMemo(() => {
    const l = getQuestLocal();
    return pendingCeremonies(game, l.played, l.shownLevel);
  }, [game]);
  const [i, setI] = useState(0);
  const ev: CeremonyEvent | undefined = events[i];
  useEffect(() => {
    if (!ev) {
      updateQuestLocal((s) => ({ ...s, shownLevel: Math.max(s.shownLevel ?? 0, game.xp.level) }));
      onDone();
      return;
    }
    markPlayed(ev.id);
  }, [ev, game.xp.level, onDone]);
  if (!ev) return null;
  return (
    <Pressable onPress={() => setI(i + 1)} accessibilityRole="button" accessibilityLabel="Continue">
      <PixelPanel tone="night" style={{ alignItems: 'center', padding: 24 }}>
        <PixelText size="xl" color="#f7da7a">
          {ev.kind === 'level' ? `LV ${ev.ref}` : ev.kind === 'rank' ? game.rank.title : 'Victory'}
        </PixelText>
      </PixelPanel>
    </Pressable>
  );
}
