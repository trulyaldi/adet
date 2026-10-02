import React from 'react';

import type { CeremonyEvent } from '../../../domain/game/ceremonies';
import type { GameState } from '../../../domain/game/derive';
import { useQuestMeta } from '../../../data/itemsRepo';
import { Ascension } from './Ascension';
import { BossDefeat } from './BossDefeat';
import { RankUp } from './RankUp';

export default function CeremonyScene({ event, game, onDone, reduced }: { event: CeremonyEvent; game: GameState; onDone(): void; reduced: boolean }) {
  const meta = useQuestMeta();
  const look = { tier: game.rank.tier, gear: meta?.props.avatar.gear ?? {} };
  switch (event.kind) {
    case 'boss_defeated': return <BossDefeat refId={`${event.biomeId}:${event.loop}`} game={game} onDone={onDone} reduced={reduced} settings={meta?.props.settings} />;
    case 'ascension': return <Ascension loop={event.loop} look={look} onDone={onDone} reduced={reduced} />;
    case 'rank_up': return <RankUp tier={event.rankIndex} level={game.xp.level} look={look} onDone={onDone} reduced={reduced} />;
    case 'level_up':
    case 'world_boss':
    case 'realm_conquered':
      return null; // drawn by the host without Skia
  }
}
