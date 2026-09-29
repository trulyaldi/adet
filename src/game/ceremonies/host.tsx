// One app-root ceremony host. evaluate() is a request to inspect derived
// state; the host owns the mutex, per-user marks and ordered presentation.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Modal } from 'react-native';

import { ceremonyMayPlay, CeremonyEvent, CeremonyMarks, detectCeremonies, markCeremonyStarted, seedCeremonyMarks } from '../../domain/game/ceremonies';
import type { GameState } from '../../domain/game/derive';
import { gameStateOf } from '../../domain/game/fromData';
import { useLootRequest } from '../state/loot';
import { useQuestLocal } from '../state/local';
import { useQuestReduced } from '../state/settings';
import { anyModalOpen, useData, useSyncStatus, useUi } from '../../store/StreakStore';
import { useAuth } from '../../sync/AuthProvider';
import { useQuestTables } from '../../sync/questTables';
import { useAppActive } from '../../theme/useMotion';
import { MODAL_GAP_MS } from '../../theme/motion';
import { SkiaGate } from '../render/SkiaGate';
import { coverWorld } from '../state/focus';
import { setCeremonyPlaying, useCeremoniesHeld } from './gate';
import { loadCeremonyMarks, saveCeremonyMarks } from './marks';
import { LevelUp } from '../../screens/Quest/ceremonies/LevelUp';

interface Handlers { evaluate(): void; seed(game: GameState): void }
let handlers: Handlers | null = null;
export function setCeremonyHandlers(h: Handlers): () => void {
  handlers = h;
  return () => { if (handlers === h) handlers = null; };
}
export const ceremonyHost = {
  evaluate(): void { handlers?.evaluate(); },
  /** Onboarding: record everything reached so far as seen (the host is the one writer). */
  seed(game: GameState): void { handlers?.seed(game); },
};

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
  const sheetOpen = useUi(anyModalOpen);
  // A queued celebration (badge, streak) goes first; it waits for us in turn.
  const celebrating = useUi((u) => u.celebrations.length > 0);
  const held = useCeremoniesHeld();
  const modalOpen = sheetOpen || celebrating || held;
  const [marks, setMarks] = useState<CeremonyMarks | null>(null);
  const marksRef = useRef<CeremonyMarks | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [playing, setPlaying] = useState<CeremonyEvent | null>(null);
  const [cooldown, setCooldown] = useState(false);
  const [request, setRequest] = useState(0);
  const bump = useCallback(() => setRequest((n) => n + 1), []);
  const seed = useCallback((g: GameState) => {
    if (!userId) return;
    const seeded = seedCeremonyMarks(g);
    marksRef.current = seeded;
    setMarks(seeded);
    saveCeremonyMarks(userId, seeded);
  }, [userId]);
  useEffect(() => setCeremonyHandlers({ evaluate: bump, seed }), [bump, seed]);
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
      // Onboarding may already have seeded while this was loading.
      marksRef.current = marksRef.current ?? m;
      setMarks(marksRef.current);
      setLoaded(true);
    }).catch(() => { if (live) setLoaded(true); });
    return () => { live = false; };
  }, [userId]);

  const revealPending = screen === 'quest' && (!local.loaded || !local.seen || local.seen.global !== game.journey.position.global || local.seen.hp !== game.journey.hp);
  useEffect(() => {
    if (!loaded || !userId || tables !== 'available' || !game.journey.started) return;
    if (!marksRef.current) {
      // A veteran, a new device, or first onboarding: silently seed history.
      if (settled) seed(game);
      return;
    }
    if (playing || cooldown || !ceremonyMayPlay({ timerActive: !!data.active, lootOpen: !!loot, modalOpen, revealPending, appActive: active })) return;
    const next = detectCeremonies(marksRef.current, game)[0];
    if (!next) return;
    // Mark at start, before showing the Modal. Skip can never replay it.
    const updated = markCeremonyStarted(marksRef.current, next, game);
    marksRef.current = updated;
    setMarks(updated);
    saveCeremonyMarks(userId, updated);
    setPlaying(next);
  }, [loaded, userId, tables, settled, game, marks, playing, cooldown, data.active, loot, modalOpen, revealPending, active, request, seed]);

  useEffect(() => playing ? coverWorld() : undefined, [playing]);
  // Full-screen ceremonies hold celebrations back; the level-up is a small toast.
  useEffect(() => {
    setCeremonyPlaying(!!playing && playing.kind !== 'level_up');
    return () => setCeremonyPlaying(false);
  }, [playing]);
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
