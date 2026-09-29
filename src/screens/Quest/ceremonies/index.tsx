// Ceremonies: level-up, rank promotion, boss defeat and a boss's first
// lines. Each plays once per event on this device (priming records history
// quietly first) and every one is skippable with a tap.

import React, { useEffect, useMemo, useState } from 'react';
import { Modal } from 'react-native';

import { useQuestMeta } from '../../../data/itemsRepo';
import type { GameState } from '../../../domain/game/derive';
import { CeremonyEvent, pendingCeremonies } from '../../../game/ceremonies';
import { coverWorld } from '../../../game/state/focus';
import { getQuestLocal, markPlayed, updateQuestLocal, useQuestLocal } from '../../../game/state/local';
import { useLootRequest } from '../../../game/state/loot';
import { BossDefeat } from './BossDefeat';
import { BossIntro } from './BossIntro';
import { LevelUp } from './LevelUp';
import { RankUp } from './RankUp';

export function CeremonyPlayer({ game, onDone, reduced }: { game: GameState; before?: GameState; onDone(): void; reduced: boolean }) {
  const meta = useQuestMeta();
  const events = useMemo(() => {
    const l = getQuestLocal();
    return pendingCeremonies(game, l.played, l.shownLevel);
    // The list is fixed when the ceremonies begin.
  }, []);
  const [i, setI] = useState(0);
  const ev: CeremonyEvent | undefined = events[i];
  useEffect(() => {
    if (ev) {
      markPlayed(ev.id);
      if (ev.kind === 'level') updateQuestLocal((s) => ({ ...s, shownLevel: Math.max(s.shownLevel ?? 0, Number(ev.ref)) }));
      return;
    }
    updateQuestLocal((s) => ({ ...s, shownLevel: Math.max(s.shownLevel ?? 0, game.xp.level) }));
    onDone();
  }, [ev, game.xp.level, onDone]);
  if (!ev) return null;
  const next = () => setI((n) => n + 1);
  const look = { tier: game.rank.tier, gear: meta?.props.avatar.gear ?? {} };
  switch (ev.kind) {
    case 'level':
      return <LevelUp key={ev.id} level={Number(ev.ref)} game={game} onDone={next} reduced={reduced} />;
    case 'rank':
      return <RankUp key={ev.id} tier={Number(ev.ref)} look={look} onDone={next} reduced={reduced} />;
    case 'boss':
      return <BossDefeat key={ev.id} refId={ev.ref} game={game} onDone={next} reduced={reduced} settings={meta?.props.settings} />;
    case 'intro':
      return <BossIntro key={ev.id} refId={ev.ref} game={game} onDone={next} reduced={reduced} />;
  }
}

/**
 * On the map: ceremonies earned outside the Loot sheet (a chest left for
 * later, a session from another device) play when the map is next open.
 */
export function CeremonyHost({ game, blocked, reduced }: { game: GameState; blocked: boolean; reduced: boolean }) {
  const local = useQuestLocal();
  const loot = useLootRequest();
  const [playing, setPlaying] = useState(false);
  const pending = local.loaded && local.primed ? pendingCeremonies(game, local.played, local.shownLevel) : [];
  const show = playing || (!blocked && !loot && pending.length > 0);
  useEffect(() => {
    if (!show) return;
    setPlaying(true);
    return coverWorld();
  }, [show]);
  if (!show) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => setPlaying(false)} statusBarTranslucent>
      <CeremonyPlayer game={game} onDone={() => setPlaying(false)} reduced={reduced} />
    </Modal>
  );
}
