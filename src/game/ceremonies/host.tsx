// One app-root ceremony host. evaluate() is a request to inspect derived
// state; the host owns the mutex, per-user marks and ordered presentation.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Modal } from 'react-native';

import { ceremonyMayPlay, CeremonyEvent, CeremonyMarks, detectCeremonies, markCeremonyStarted, seedCeremonyMarks } from '../../domain/game/ceremonies';
import { gameStateOf } from '../../domain/game/fromData';
import { useLootRequest } from '../state/loot';
import { useQuestLocal } from '../state/local';
import { useQuestReduced } from '../state/settings';
import { useData, useSyncStatus, useUi } from '../../store/StreakStore';
import { useAuth } from '../../sync/AuthProvider';
import { useQuestTables } from '../../sync/questTables';
import { useAppActive } from '../../theme/useMotion';
import { MODAL_GAP_MS } from '../../theme/motion';
import { SkiaGate } from '../render/SkiaGate';
import { coverWorld } from '../state/focus';
import { loadCeremonyMarks, saveCeremonyMarks } from './marks';
import { LevelUp } from '../../screens/Quest/ceremonies/LevelUp';

type Evaluator = () => void;
let evaluator: Evaluator | null = null;
export function setCeremonyEvaluator(fn: Evaluator): () => void {
  evaluator = fn;
  return () => { if (evaluator === fn) evaluator = null; };
}
export const ceremonyHost = { evaluate(): void { evaluator?.(); } };

export function RootCeremonyHost() {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const data = useData();
  const game = gameStateOf(data);
  const screen = useUi((u) => u.screen);
  const { settled } = useSyncStatus();
  const tables = useQuestTables();
  const local = useQuestLocal();
  const loot = useLootRequest();
  const reduced = useQuestReduced();
  const active = useAppActive();
  const [marks, setMarks] = useState<CeremonyMarks | null>(null);
  const marksRef = useRef<CeremonyMarks | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [playing, setPlaying] = useState<CeremonyEvent | null>(null);
  const [cooldown, setCooldown] = useState(false);
  const [request, setRequest] = useState(0);
  const bump = useCallback(() => setRequest((n) => n + 1), []);
  useEffect(() => setCeremonyEvaluator(bump), [bump]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => { if (state === 'active') bump(); });
    return () => sub.remove();
  }, [bump]);
  useEffect(() => {
    let live = true;
    marksRef.current = null;
    setMarks(null);
    setLoaded(false);
    if (userId) loadCeremonyMarks(userId).then((m) => {
      if (!live) return;
      marksRef.current = m;
      setMarks(m);
      setLoaded(true);
    }).catch(() => { if (live) setLoaded(true); });
    return () => { live = false; };
  }, [userId]);

  const revealPending = screen === 'quest' && (!local.loaded || !local.seen || local.seen.global !== game.journey.position.global || local.seen.hp !== game.journey.hp);
  useEffect(() => {
    if (!loaded || !userId || tables !== 'available' || !game.journey.started) return;
    if (!marksRef.current) {
      // A veteran, a new device, or first onboarding: silently seed history.
      if (!settled) return;
      const seeded = seedCeremonyMarks(game);
      marksRef.current = seeded;
      setMarks(seeded);
      saveCeremonyMarks(userId, seeded);
      return;
    }
    if (playing || cooldown || !ceremonyMayPlay(!!data.active, !!loot, revealPending, active)) return;
    const next = detectCeremonies(marksRef.current, game)[0];
    if (!next) return;
    // Mark at start, before showing the Modal. Skip can never replay it.
    const updated = markCeremonyStarted(marksRef.current, next, game);
    marksRef.current = updated;
    setMarks(updated);
    saveCeremonyMarks(userId, updated);
    setPlaying(next);
  }, [loaded, userId, tables, settled, game, marks, playing, cooldown, data.active, loot, revealPending, active, request]);

  useEffect(() => playing ? coverWorld() : undefined, [playing]);
  useEffect(() => {
    if (data.active && playing) setPlaying(null);
  }, [data.active, playing]);
  const done = useCallback(() => {
    setPlaying(null);
    setCooldown(true);
    setTimeout(() => setCooldown(false), MODAL_GAP_MS);
  }, []);
  if (!playing) return null;
  if (playing.kind === 'level_up') return <LevelUp level={playing.level} game={game} onDone={done} reduced={reduced} />;
  return (
    <Modal visible transparent animationType={reduced ? 'fade' : 'none'} onRequestClose={done} statusBarTranslucent>
      <SkiaGate load={() => import('../../screens/Quest/ceremonies/Scene')} props={{ event: playing, game, onDone: done, reduced }} />
    </Modal>
  );
}
