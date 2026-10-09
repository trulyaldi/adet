// One app-root ceremony host. evaluate() is a request to inspect derived
// state; the host owns the mutex, per-user marks and ordered presentation.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Modal } from 'react-native';

import { useWorldProjects } from '../../data/worldRepo';
import { ceremonyMayPlay, ceremonyVisible, CeremonyEvent, CeremonyMarks, detectCeremonies, markCeremonyStarted, seedCeremonyMarks, withWorldMarks } from '../../domain/game/ceremonies';
import type { GameState } from '../../domain/game/derive';
import { gameStateOf } from '../../domain/game/fromData';
import { liveWorld } from '../../domain/world/select';
import { worldMoments } from '../../domain/world/target';
import { useLootRequest } from '../state/loot';
import { useQuestLocal } from '../state/local';
import { useQuestReduced } from '../state/settings';
import { anyModalOpen, useData, useSyncStatus, useUi } from '../../store/StreakStore';
import { useAuth } from '../../sync/AuthProvider';
import { useQuestTables } from '../../sync/questTables';
import { useAppActive } from '../../theme/useMotion';
import { MODAL_GAP_MS } from '../../theme/motion';
import { loadScene } from '../render/screens';
import { SkiaGate } from '../render/SkiaGate';
import { coverWorld } from '../state/focus';
import { setCeremonyPlaying, useCeremoniesHeld } from './gate';
import { clearCeremonyMarks, loadCeremonyMarks, saveCeremonyMarks } from './marks';
import { LevelUp } from '../../screens/Quest/ceremonies/LevelUp';
import { WorldMoment } from '../../screens/Quest/ceremonies/WorldMoment';

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

export function RootCeremonyHost() {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const data = useData();
  const game = gameStateOf(data);
  // World Mode: fallen bosses and conquered realms, from result rows.
  const projects = useWorldProjects();
  const world = useMemo(() => liveWorld(data.items, projects), [data.items, projects]);
  const moments = useMemo(() => worldMoments(world), [world]);
  // What has already happened, resting realms included: marks seeded from this never announce an archived
  // project's old conquest when the project is restored. (Detection above stays on the placed realms.)
  const history = useMemo(() => worldMoments({ ...world, realms: [...world.realms, ...world.resting] }), [world]);
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
    const seeded = seedCeremonyMarks(g, history);
    marksRef.current = { userId, marks: seeded };
    saveCeremonyMarks(userId, seeded);
  }, [userId, history]);
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

  // The Quest tab waits for this device's state. (The legacy journey's reveal, which wrote
  // `local.seen`, went with world-3: waiting on it held every ceremony there on a new device.)
  const revealPending = screen === 'quest' && !local.loaded;
  useEffect(() => {
    if (!loaded || !userId || tables !== 'available' || !game.journey.started) return;
    const stored = marksFor(userId);
    if (!stored) {
      // A veteran, a new device, or first onboarding: silently seed history.
      if (settled) seed(game);
      return;
    }
    // Marks from before World Mode: what has already fallen is seen.
    const marks = settled ? withWorldMarks(stored, history) : stored;
    if (marks !== stored) {
      marksRef.current = { userId, marks };
      saveCeremonyMarks(userId, marks);
    }
    if (playing || cooldown || !ceremonyMayPlay({ timerActive: !!data.active, lootOpen: !!loot, modalOpen, revealPending, appActive: active })) return;
    const next = detectCeremonies(marks, game, moments)[0];
    if (!next) return;
    // Mark at start, before showing the Modal. Skip can never replay it.
    const updated = markCeremonyStarted(marks, next, game);
    marksRef.current = { userId, marks: updated };
    saveCeremonyMarks(userId, updated);
    // Starting a scene records its mark in storage exactly once, so it can't be
    // derived during render: this effect is the one transition into "playing".
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlaying({ event: next });
  }, [loaded, userId, tables, settled, game, moments, history, playing, cooldown, data.active, loot, modalOpen, revealPending, active, request, seed]);

  // A session starting mid-scene hides it; it comes back when the session has
  // ended and the Loot sheet (and anything else) is closed: one modal at a time.
  const current = ceremonyVisible({ timerActive: !!data.active, lootOpen: !!loot, modalOpen }) ? playing : null;
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
  if (current.event.kind === 'world_boss') return <WorldMoment banner="KO" ko line={current.event.title} onDone={done} reduced={reduced} />;
  // Its flag rises on the Overworld afterwards.
  if (current.event.kind === 'realm_conquered') return <WorldMoment banner="Conquered" line={current.event.name} onDone={done} reduced={reduced} />;
  return (
    <Modal visible transparent animationType={reduced ? 'fade' : 'none'} onRequestClose={done} statusBarTranslucent>
      <SkiaGate load={loadScene} props={{ event: current.event, game: shownGame, onDone: done, reduced }} onError={done} />
    </Modal>
  );
}
