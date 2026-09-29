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
import { clearCeremonyMarks, loadCeremonyMarks, saveCeremonyMarks } from './marks';
import { LevelUp } from '../../screens/Quest/ceremonies/LevelUp';

interface Handlers {
  evaluate(): void;
  seed(game: GameState): void;
  preview(event: CeremonyEvent, game?: GameState): void;
  forgetMarks(): void;
}
let handlers: Handlers | null = null;
export function setCeremonyHandlers(h: Handlers): () => void {
  handlers = h;
  return () => { if (handlers === h) handlers = null; };
}
export const ceremonyHost = {
  evaluate(): void { handlers?.evaluate(); },
  /** Onboarding: record everything reached so far as seen (the host is the one writer). */
  seed(game: GameState): void { handlers?.seed(game); },
  /** Dev QA: play a scene now. Marks are untouched, so nothing real is skipped or replayed. */
  preview(event: CeremonyEvent, game?: GameState): void { handlers?.preview(event, game); },
  /** Dev QA: forget this device's marks. The host reseeds silently from the real state. */
  forgetMarks(): void { handlers?.forgetMarks(); },
};

const loadScene = () => import('../../screens/Quest/ceremonies/Scene');

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
  // This user's marks (null until loaded or seeded). A ref: only the host reads them.
  const marksRef = useRef<{ userId: string | null; marks: CeremonyMarks | null }>({ userId: null, marks: null });
  const marksFor = (id: string) => (marksRef.current.userId === id ? marksRef.current.marks : null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const loaded = !!userId && loadedFor === userId;
  const [playing, setPlaying] = useState<{ event: CeremonyEvent; game?: GameState; preview?: boolean } | null>(null);
  const [cooldown, setCooldown] = useState(false);
  const [request, setRequest] = useState(0);
  const bump = useCallback(() => setRequest((n) => n + 1), []);
  const seed = useCallback((g: GameState) => {
    if (!userId) return;
    const seeded = seedCeremonyMarks(g);
    marksRef.current = { userId, marks: seeded };
    saveCeremonyMarks(userId, seeded);
  }, [userId]);
  const preview = useCallback((event: CeremonyEvent, g?: GameState) => setPlaying({ event, game: g, preview: true }), []);
  const forgetMarks = useCallback(() => {
    if (!userId) return;
    marksRef.current = { userId, marks: null };
    clearCeremonyMarks(userId);
    bump();
  }, [userId, bump]);
  useEffect(() => setCeremonyHandlers({ evaluate: bump, seed, preview, forgetMarks }), [bump, seed, preview, forgetMarks]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => { if (state === 'active') bump(); });
    return () => sub.remove();
  }, [bump]);
  useEffect(() => {
    if (!userId) return;
    let live = true;
    const settle = (m: CeremonyMarks | null) => {
      if (!live) return;
      // Onboarding may already have seeded while this was loading.
      if (!marksFor(userId)) marksRef.current = { userId, marks: m };
      setLoadedFor(userId);
    };
    loadCeremonyMarks(userId).then(settle, () => settle(null));
    return () => { live = false; };
  }, [userId]);

  const revealPending = screen === 'quest' && (!local.loaded || !local.seen || local.seen.global !== game.journey.position.global || local.seen.hp !== game.journey.hp);
  useEffect(() => {
    if (!loaded || !userId || tables !== 'available' || !game.journey.started) return;
    const marks = marksFor(userId);
    if (!marks) {
      // A veteran, a new device, or first onboarding: silently seed history.
      if (settled) seed(game);
      return;
    }
    if (playing || cooldown || !ceremonyMayPlay({ timerActive: !!data.active, lootOpen: !!loot, modalOpen, revealPending, appActive: active })) return;
    const next = detectCeremonies(marks, game)[0];
    if (!next) return;
    // Mark at start, before showing the Modal. Skip can never replay it.
    const updated = markCeremonyStarted(marks, next, game);
    marksRef.current = { userId, marks: updated };
    saveCeremonyMarks(userId, updated);
    // Starting a scene records its mark in storage exactly once, so it can't be
    // derived during render: this effect is the one transition into "playing".
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlaying({ event: next });
  }, [loaded, userId, tables, settled, game, playing, cooldown, data.active, loot, modalOpen, revealPending, active, request, seed]);

  // A session starting mid-scene hides it; it comes back once the session ends.
  const current = data.active ? null : playing;
  useEffect(() => current ? coverWorld() : undefined, [current]);
  // Full-screen ceremonies hold celebrations back; the level-up is a small toast.
  useEffect(() => {
    setCeremonyPlaying(!!current && current.event.kind !== 'level_up');
    return () => setCeremonyPlaying(false);
  }, [current]);
  const done = useCallback(() => {
    setPlaying(null);
    setCooldown(true);
    setTimeout(() => setCooldown(false), MODAL_GAP_MS);
  }, []);
  if (!current) return null;
  const shownGame = current.game ?? game;
  if (current.event.kind === 'level_up') return <LevelUp level={current.event.level} game={shownGame} onDone={done} reduced={reduced} />;
  return (
    <Modal visible transparent animationType={reduced ? 'fade' : 'none'} onRequestClose={done} statusBarTranslucent>
      <SkiaGate load={loadScene} props={{ event: current.event, game: shownGame, onDone: done, reduced }} />
    </Modal>
  );
}
