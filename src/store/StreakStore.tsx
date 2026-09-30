import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { Alert, AppState } from 'react-native';

import { AppConfig, DEFAULT_CONFIG } from '../domain/config';
import { TILES } from '../domain/constants';
import { clampMinMin, defaultMinMin, Frequency, normalizeFrequency, weeklyTargetOf } from '../domain/frequency';
import { clampCapacity, DEFAULT_PREFS, raiseCapacityToFit, scaleTargetsToFit, targetCheck } from '../domain/capacity';
import { missingLogs } from '../domain/dailyLog';
import { selectToday } from '../domain/day';
import { nextProjectColor, nextScene, ProjectColor, projectLook, withLooks } from '../domain/look';
import { addMark, moveMarks, removeMark } from '../domain/marks';
import { award, celebrationOrder, enqueueCelebrations } from '../domain/milestones';
import type { GlyphName } from '../components/glyphs';
import { feedback } from '../feedback/feedback';
import { activeHabits } from '../domain/projects';
import { clampBudgetMin, clampPlanCap } from '../domain/plan';
import { clampReminderHours, reminderFireAt } from '../domain/reminder';
import { seed } from '../domain/seed';
import { addDays, dkey, setWeekStartDay } from '../domain/time';
import {
  applySessionEdit,
  checkSessionTimes,
  defaultManualStart,
  manualSession,
  quickSession,
  restoreSession,
  sessionFromTimer,
  subMinuteSessions,
} from '../domain/sessions';
import type { QuestSlice } from '../domain/items/ops';
import { allAsChanges, enqueue, isUntouchedSeed, stampLocalChanges } from '../domain/sync';
import {
  CURRENT_SCHEMA_VERSION,
  DayLevel,
  Habit,
  HabitKind,
  IconKey,
  PersistedState,
  SceneKind,
  Session,
} from '../domain/types';
import { isLootOpen } from '../game/state/loot';
import { requestReminderPermission, syncReminder } from '../notifications/reminder';
import { SyncStatus, useSync } from '../sync/useSync';
import { MODAL_GAP_MS } from '../theme/motion';
import { AppSettings, DEFAULT_SETTINGS, loadSettings, saveSettings } from './settings';
import { clearState, EMPTY_SYNC_META, loadState, loadSyncMeta, saveState, SyncMeta } from './storage';

export type Screen = 'today' | 'projects' | 'stats' | 'quest';
export type StatsView = 'overview' | 'history';


export interface HabitSheetState {
  id: string | null;
  name: string;
  icon: IconKey;
  projectId: string;
  /** Full session length in minutes. */
  dailyTargetMin: number;
  /** Minimum session length in minutes. */
  minTargetMin: number;
  frequency: Frequency;
  kind: HabitKind;
}
export interface ProjectSheetState {
  id: string | null;
  name: string;
  weeklyTarget: number;
  color: ProjectColor;
  icon: IconKey;
  scene: SceneKind;
}
export interface LogSheetState {
  habitId: string | null;
  /** Epoch ms. */
  start: number;
  /** Whether the length is entered as a duration or as an end time. */
  mode: 'duration' | 'end';
  /** Duration in minutes (mode 'duration'). */
  minutes: number;
  /** Epoch ms (mode 'end'). */
  end: number;
  note: string;
  /** Validation message from the last save attempt. */
  error: string | null;
  /** True once the user was asked to confirm a long (>8h) session. */
  confirmLong: boolean;
}

/** The end time a log sheet currently describes, whichever way it's entered. */
export function logSheetEnd(sh: LogSheetState): number {
  return sh.mode === 'duration' ? sh.start + sh.minutes * 60000 : sh.end;
}
export interface SessionSheetState {
  id: string;
  habitId: string;
  /** Epoch ms. */
  start: number;
  /** Epoch ms. */
  end: number;
  note: string;
  /** Validation message from the last save attempt. */
  error: string | null;
  /** True once the user was asked to confirm a long (>8h) session. */
  confirmLong: boolean;
}

/** A toast is an icon; the label is spoken, not shown. */
export interface Toast {
  glyph: GlyphName;
  label: string;
}

export interface UIState {
  screen: Screen;
  timerOpen: boolean;
  /**
   * The length the running timer is aiming for (full or minimum), in minutes.
   * UI-only: a timer resumed after a restart or from another device aims for
   * the habit's full length.
   */
  timerGoal: { habitId: string; min: number } | null;
  heatSel: string | null;
  heatSheet: boolean;
  clearArmed: boolean;
  habitSheet: HabitSheetState | null;
  projectSheet: ProjectSheetState | null;
  stageSheet: string | null; // projectId
  logSheet: LogSheetState | null;
  sessionSheet: SessionSheetState | null;
  /** The last deleted session, offered for undo until the toast expires. */
  undo: Session | null;
  /** Monday dkey of the weekly recap shown in the recap sheet. */
  recapSheet: string | null;
  /** A brief icon toast (e.g. a timer that wasn't saved); cleared after TOAST_MS. */
  toast: Toast | null;
  settingsOpen: boolean;
  /** Which half of Stats is showing; kept while switching tabs. */
  statsView: StatsView;
  weekOpen: boolean;
  /** The "+" sheet: start any project's habit, planned or not. */
  startSheet: boolean;
  /** The targets-over-capacity sheet. */
  capacityFix: boolean;
  /** Bumped when the running session reaches its target (scene payoff, your character cheers). */
  targetHits: number;
  /** Epoch ms until which your character cheers. */
  cheerUntil: number;
  /** Full-screen milestone celebrations waiting (badge ids); only the first shows. */
  celebrations: string[];
  /** Confetti in these colors (a new key each time the day completes). */
  confetti: { key: number; colors: string[] } | null;
  /** Particle bursts from a point (session complete). */
  bursts: Burst[];
}

export interface Burst {
  key: number;
  x: number;
  y: number;
  color: string;
}

const INITIAL_UI: UIState = {
  screen: 'today',
  timerOpen: false,
  timerGoal: null,
  heatSel: null,
  heatSheet: false,
  clearArmed: false,
  habitSheet: null,
  projectSheet: null,
  stageSheet: null,
  logSheet: null,
  sessionSheet: null,
  undo: null,
  recapSheet: null,
  toast: null,
  settingsOpen: false,
  statsView: 'overview',
  weekOpen: false,
  startSheet: false,
  capacityFix: false,
  targetHits: 0,
  cheerUntil: 0,
  celebrations: [],
  confetti: null,
  bursts: [],
};

/** Whether any sheet or the focus view is up (full-screen celebrations wait for them). */
export function anyModalOpen(ui: UIState): boolean {
  return (
    isLootOpen() ||
    ui.timerOpen || ui.settingsOpen || ui.weekOpen || ui.startSheet || ui.capacityFix ||
    !!ui.habitSheet || !!ui.projectSheet || !!ui.logSheet || !!ui.sessionSheet || !!ui.recapSheet || !!ui.stageSheet
  );
}

/** How long the "Session deleted · Undo" toast stays up. */
export const UNDO_MS = 5000;

/** How long a plain message toast stays up. */
const TOAST_MS = 2500;

/** Shown when a stopped timer is discarded for being too short. */
const SHORT_TIMER_TOAST: Toast = { glyph: 'undo', label: 'Under a minute, not saved' };

export interface StreakActions {
  // navigation
  setScreen(s: Screen): void;
  openSettings(): void;
  closeSettings(): void;
  setStatsView(view: StatsView): void;
  // timer
  /** Start (or switch to) a habit's timer, aiming for `goalMin` minutes (default: its full length). */
  startTimer(habitId: string, goalMin?: number): void;
  openTimer(): void;
  closeTimer(): void;
  togglePause(): void;
  /**
   * Save the running timer as a session. `done` also marks the habit done for
   * today (the done button); `editAfter` then opens it in the edit sheet.
   * Returns the saved session (null when it was too short to keep).
   */
  stopTimer(opts?: { editAfter?: boolean; done?: boolean }): Session | null;
  /** Log `minutes` ending now (the +15 / +30 / +60 chips). */
  quickLog(habitId: string, minutes: number): void;
  /** Check-off habits: mark done for today, or clear the mark. */
  toggleCheck(habitId: string): void;
  // heatmap
  openHeatSheet(): void;
  closeHeatSheet(): void;
  pickHeat(key: string): void;
  closeHeatSel(): void;
  // recent-sessions clear
  armClear(): void;
  cancelClear(): void;
  confirmClear(): void;
  // habit sheet
  openNewHabit(projectId: string): void;
  openEditHabit(habit: Habit): void;
  openEditHabitById(habitId: string): void;
  closeHabitSheet(): void;
  patchHabitSheet(patch: Partial<HabitSheetState>): void;
  saveHabitSheet(): void;
  deleteHabit(id: string): void;
  mergeHabit(fromId: string, intoId: string): void;
  // project sheet
  openNewProject(): void;
  openEditProject(projectId: string): void;
  openCapacityFix(): void;
  closeCapacityFix(): void;
  closeProjectSheet(): void;
  patchProjectSheet(patch: Partial<ProjectSheetState>): void;
  saveProjectSheet(): void;
  deleteProject(id: string): void;
  /** Archive (hide) a project; a timer running on one of its habits is stopped and saved first. */
  archiveProject(id: string): void;
  unarchiveProject(id: string): void;
  // stage sheet
  openStageSheet(projectId: string): void;
  closeStageSheet(): void;
  // log-time sheet
  /** Log time after the fact, for `habitId` (default: the next planned habit). */
  openLogSheet(habitId?: string): void;
  closeLogSheet(): void;
  patchLogSheet(patch: Partial<LogSheetState>): void;
  saveLogSheet(): void;
  // edit-session sheet
  openSessionSheet(sessionId: string): void;
  closeSessionSheet(): void;
  patchSessionSheet(patch: Partial<SessionSheetState>): void;
  saveSessionSheet(): void;
  deleteSession(id: string): void;
  undoDelete(): void;
  // weekly recap
  openRecap(weekStart: string): void;
  closeRecap(): void;
  // week view
  openWeek(): void;
  openStartSheet(): void;
  /** The running session just reached its target. */
  targetReached(habitId: string): void;
  /** Record newly earned badges; `celebrate` queues their full-screen cards. */
  earnBadges(ids: string[], celebrate: boolean): void;
  dismissCelebration(): void;
  /** The day's plan just completed on screen. */
  dayCompleted(colors: string[]): void;
  burst(x: number, y: number, color: string): void;
  closeStartSheet(): void;
  closeWeek(): void;
  // capacity and today's plan edits
  /** Minutes of capacity for one weekday (0 = Monday), or all seven. */
  setCapacity(weekday: number, min: number): void;
  setCapacityAll(mins: number[]): void;
  setWeekStart(day: 0 | 1): void;
  /** Today's light/normal/heavy tap; null dismisses the prompt. */
  setDayLevel(level: DayLevel | null): void;
  /** Today's habits in a new order (drag to reorder). */
  reorderToday(ids: string[]): void;
  /** Set a habit aside for today (its time goes to others or later days), or bring it back. */
  setAside(habitId: string, aside: boolean): void;
  /** Resolve targets over capacity: scale targets down, or raise capacity. */
  fixTargets(how: 'scale' | 'raise'): void;
  dismissTargetCheck(signature: string): void;
  acceptLearned(mins: number[]): void;
  dismissLearned(): void;
  setDailyPrompt(on: boolean): void;
  markWelcomeSeen(): void;
  // device settings
  setReminderHours(hours: number): void;
  /** Daily time budget in minutes (15..180, 15-minute steps). */
  setBudgetMin(min: number): void;
  /** Most habits in a day's plan (1..5). */
  setPlanCap(cap: number): void;
  // Quest Mode (src/data/itemsRepo.ts builds typed writes on this)
  /** Edit items and links; return the same slice for no change. */
  editQuest(fn: (q: QuestSlice) => QuestSlice): void;
}

/**
 * UI state lives outside React state so each overlay subscribes to just its
 * slice (useUi): typing in one sheet doesn't re-render every other one.
 */
interface UiStore {
  get(): UIState;
  set(fn: (prev: UIState) => UIState): void;
  subscribe(listener: () => void): () => void;
}

function createUiStore(): UiStore {
  let state = INITIAL_UI;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set: (fn) => {
      const next = fn(state);
      if (next === state) return;
      state = next;
      listeners.forEach((l) => l());
    },
    subscribe: (l) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
  };
}

/** What never (or only once) changes: actions are stable for the provider's life. */
interface StaticValue {
  ready: boolean;
  config: AppConfig;
  actions: StreakActions;
  uiStore: UiStore;
  /** Stop syncing and erase this device's data and sync state (before sign-out). */
  clearLocalData(): Promise<void>;
}

// One context per kind of change, so a component re-renders only for what it reads.
const StaticContext = createContext<StaticValue | null>(null);
const DataContext = createContext<PersistedState | null>(null);
const NowContext = createContext<number>(0);
/** Device-only preferences (not synced). */
const SettingsContext = createContext<AppSettings>(DEFAULT_SETTINGS);
const SyncContext = createContext<SyncStatus>({ state: 'syncing', pending: 0, settled: false });

function emptyData(now: number): PersistedState {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    projects: [],
    habits: [],
    sessions: [],
    marks: [],
    prefs: DEFAULT_PREFS,
    dailyLogs: [],
    badges: [],
    items: [],
    links: [],
    active: null,
    historyClearedAt: 0,
    plans: {},
    planSince: dkey(new Date(now)),
    streakCarry: null,
    rebalancePending: false,
    days: {},
    // Set once history is here (see MilestoneWatcher).
    badgesPrimed: false,
  };
}

interface StoreState {
  data: PersistedState;
  sync: SyncMeta;
  /** Bumped on every local data change (drives the debounced sync). */
  localRev: number;
  /** Bumped when a local change touches the active timer (syncs immediately). */
  activeRev: number;
}

const SAVE_DEBOUNCE_MS = 500;
/** How often the store's `now` refreshes. */
const STORE_TICK_MS = 15_000;

/**
 * Prepare freshly loaded data for `userId`. On this device's first sign-in to
 * that account, untouched seed data is dropped (the server is the source of
 * truth) and anything else is queued so it's pushed before the first pull.
 */
function forUser(data: PersistedState, meta: SyncMeta, userId: string, now: number): StoreState {
  const base = { localRev: 0, activeRev: 0 };
  if (meta.ownerId === userId) return { ...base, data, sync: meta };
  const fresh: SyncMeta = { ...EMPTY_SYNC_META, ownerId: userId };
  // Data owned by a different account is never uploaded into this one.
  if (meta.ownerId !== null || isUntouchedSeed(data, seed(now))) {
    return { ...base, data: emptyData(now), sync: fresh };
  }
  return { ...base, data, sync: { ...fresh, outbox: enqueue({}, allAsChanges(data)) } };
}

export function StreakProvider({ userId, children }: { userId: string; children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [wiped, setWiped] = useState(false);
  const [store, setStore] = useState<StoreState>(() => ({
    data: emptyData(Date.now()),
    sync: EMPTY_SYNC_META,
    localRev: 0,
    activeRev: 0,
  }));
  const data = store.data;
  const [uiStore] = useState(createUiStore);
  const setUi = uiStore.set;
  const [now, setNow] = useState(() => Date.now());
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  /** Bumped when notification permission is granted, so the reminder reschedules. */
  const [permRev, setPermRev] = useState(0);
  /** Merge into device settings and persist them. */
  const updateSettings = useCallback((patch: Partial<AppSettings>): AppSettings => {
    const next = { ...settingsRef.current, ...patch };
    settingsRef.current = next;
    setSettings(next);
    saveSettings(next);
    return next;
  }, []);

  const storeRef = useRef(store);
  storeRef.current = store;
  const wipedRef = useRef(false);

  // Load persisted state once.
  useEffect(() => {
    let mounted = true;
    // Settings first: upgrading judges the old streak by the old daily budget.
    loadSettings()
      .then((prefs) => Promise.all([loadState(Date.now(), { planSettings: { budgetMin: prefs.budgetMin, planCap: prefs.planCap } }), loadSyncMeta(), prefs]))
      .then(([loaded, meta, prefs]) => {
        if (!mounted) return;
        const next = forUser(loaded, meta, userId, Date.now());
        setStore(next);
        setSettings(prefs);
        if (next.sync !== meta) saveState(next.data, next.sync);
        setReady(true);
      });
    return () => {
      mounted = false;
    };
  }, [userId]);

  /**
   * Every local mutation goes through here: records the action touched are
   * stamped and queued for push. Remote merges bypass this (see useSync).
   */
  const setData = useCallback((fn: (d: PersistedState) => PersistedState) => {
    setStore((s) => {
      const next = fn(s.data);
      if (next === s.data) return s;
      const { data: stamped, changes } = stampLocalChanges(s.data, next, Date.now());
      if (!changes.length) return { ...s, data: stamped };
      return {
        ...s,
        data: stamped,
        sync: { ...s.sync, outbox: enqueue(s.sync.outbox, changes) },
        localRev: s.localRev + 1,
        activeRev: changes.some((c) => c.table === 'active_timers') ? s.activeRev + 1 : s.activeRev,
      };
    });
  }, []);

  // Persist data + sync state, debounced; flushed when the app backgrounds or
  // the provider unmounts so a quick close doesn't lose the last change.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = null;
    if (wipedRef.current) return;
    saveState(storeRef.current.data, storeRef.current.sync);
  }, []);
  useEffect(() => {
    if (!ready || wipedRef.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flushSave, SAVE_DEBOUNCE_MS);
  }, [store.data, store.sync, ready, flushSave]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active' && saveTimer.current) flushSave();
    });
    return () => {
      sub.remove();
      if (saveTimer.current) flushSave();
    };
  }, [flushSave]);

  const sync = useSync({
    enabled: ready && !wiped,
    userId,
    storeRef,
    setStore,
    localRev: store.localRev,
    activeRev: store.activeRev,
  });

  const clearLocalData = useCallback(async () => {
    wipedRef.current = true;
    setWiped(true);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = null;
    await clearState();
  }, []);

  // The long-timer reminder follows the timer state, whichever device changed
  // it (remote merges update data.active too). Cancelled once data is wiped.
  const reminderHabit = data.active
    ? data.habits.find((h) => h.id === data.active!.habitId)?.name ?? 'your habit'
    : '';
  const reminderAt = wiped ? null : reminderFireAt(data.active, settings.reminderHours);
  useEffect(() => {
    if (!ready) return;
    syncReminder({ fireAt: reminderAt, habitName: reminderHabit, hours: settings.reminderHours });
  }, [ready, reminderAt, reminderHabit, settings.reminderHours, permRev]);

  // Weeks start where the (synced) preference says, for every calculation below.
  setWeekStartDay(data.prefs.weekStart);
  const today = dkey(new Date(now));

  // Once per device: offer to remove sessions under a minute left over from
  // before the stop rule. Re-checked as data arrives (e.g. the first pull on a
  // new device) until answered; the ref keeps it to one alert per app session.
  const shortPromptOpen = useRef(false);
  useEffect(() => {
    if (!ready || wiped || settings.shortSessionsReviewed || shortPromptOpen.current) return;
    const short = subMinuteSessions(store.data.sessions);
    if (!short.length) return;
    shortPromptOpen.current = true;
    const ids = new Set(short.map((s) => s.id));
    const done = () => updateSettings({ shortSessionsReviewed: true });
    Alert.alert(
      'Remove short sessions?',
      `Found ${short.length} session${short.length === 1 ? '' : 's'} under a minute. Remove ${short.length === 1 ? 'it' : 'them'}?`,
      [
        { text: 'Keep', style: 'cancel', onPress: done },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            // Removing them locally queues synced deletes (soft deletes on the server).
            setData((d) => ({ ...d, sessions: d.sessions.filter((s) => !ids.has(s.id)) }));
            done();
          },
        },
      ],
      { cancelable: true, onDismiss: done }
    );
  }, [ready, wiped, store.data.sessions, settings.shortSessionsReviewed, updateSettings, setData]);

  // Finished days get their plan-vs-actual log once (for history and a future
  // AI planner); old per-day edits are dropped after two weeks.
  useEffect(() => {
    if (!ready || wiped || !sync.settled) return;
    setData((d) => {
      const logs = missingLogs(d, today, d.planSince);
      const cutoff = dkey(addDays(new Date(), -14));
      const stale = Object.keys(d.days).filter((k) => k < cutoff);
      if (!logs.length && !stale.length) return d;
      const days = { ...d.days };
      for (const k of stale) delete days[k];
      return { ...d, dailyLogs: logs.length ? [...d.dailyLogs, ...logs] : d.dailyLogs, days };
    });
  }, [ready, wiped, sync.settled, today, setData]);

  // Every project gets a color, icon and scene (older projects, and ones
  // created on devices without looks); the assignment syncs like an edit.
  useEffect(() => {
    if (!ready || wiped || !sync.settled) return;
    setData(withLooks);
  }, [ready, wiped, sync.settled, data.projects, data.habits, setData]);

  // The undo toast expires on its own; a newer delete restarts the clock.
  const undo = useSyncExternalStore(uiStore.subscribe, () => uiStore.get().undo);
  const toast = useSyncExternalStore(uiStore.subscribe, () => uiStore.get().toast);
  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUi((p) => (p.undo === undo ? { ...p, undo: null } : p)), UNDO_MS);
    return () => clearTimeout(t);
  }, [undo, setUi]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setUi((p) => (p.toast === toast ? { ...p, toast: null } : p)), TOAST_MS);
    return () => clearTimeout(t);
  }, [toast, setUi]);

  // A slow tick keeps minute-level views (today's total, the day turning)
  // current; live clocks tick on their own (useNow), so a running timer
  // doesn't re-render the whole app every second.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), STORE_TICK_MS);
    const sub = AppState.addEventListener('change', (st) => st === 'active' && setNow(Date.now()));
    return () => {
      clearInterval(t);
      sub.remove();
    };
  }, []);
  // Any data change (start, stop, a log) refreshes it too.
  useEffect(() => setNow(Date.now()), [store.data]);

  /** Latest actions, for calls deferred past a render (stopTimer's editAfter). */
  const actionsRef = useRef<StreakActions | null>(null);

  const actions = useMemo<StreakActions>(() => {
    const patchUi = (patch: Partial<UIState>) =>
      setUi((prev) => ({ ...prev, ...patch }));

    return {
      setScreen: (screen) => patchUi({ screen }),
      openSettings: () => patchUi({ settingsOpen: true }),
      closeSettings: () => patchUi({ settingsOpen: false }),
      setStatsView: (statsView) => patchUi({ statsView }),

      startTimer: (habitId, goalMin) => {
        const now = Date.now();
        const prev = storeRef.current.data.active;
        // Switching habits stops the running timer first (same rule as Stop).
        const discarded = !!prev && prev.habitId !== habitId && !sessionFromTimer(prev, now);
        setData((d) => {
          if (d.active && d.active.habitId === habitId) return d; // already running
          const saved = d.active ? sessionFromTimer(d.active, now) : null;
          return {
            ...d,
            sessions: saved ? [...d.sessions, saved] : d.sessions,
            active: { habitId, startedAt: now, baseSec: 0 },
          };
        });
        const goal = goalMin ?? storeRef.current.data.habits.find((h) => h.id === habitId)?.dailyTargetMin;
        const timerGoal = goal ? { habitId, min: goal } : null;
        patchUi(discarded ? { timerOpen: true, timerGoal, toast: SHORT_TIMER_TOAST } : { timerOpen: true, timerGoal });
        feedback(discarded ? 'undo' : 'session_start');
        // Reminder permission is asked on timer start; iOS only prompts the first time.
        if (settingsRef.current.reminderHours > 0) {
          requestReminderPermission().then((ok) => ok && setPermRev((r) => r + 1));
        }
      },
      openTimer: () => patchUi({ timerOpen: true }),
      closeTimer: () => patchUi({ timerOpen: false }),
      togglePause: () =>
        setData((d) => {
          const a = d.active;
          if (!a) return d;
          if (a.startedAt) {
            return {
              ...d,
              active: {
                ...a,
                baseSec: a.baseSec + (Date.now() - a.startedAt) / 1000,
                startedAt: null,
              },
            };
          }
          return { ...d, active: { ...a, startedAt: Date.now() } };
        }),
      stopTimer: (opts) => {
        const end = Date.now();
        const a = storeRef.current.data.active;
        const saved = a ? sessionFromTimer(a, end) : null;
        setData((d) => {
          if (!d.active) return d;
          const s = sessionFromTimer(d.active, end);
          const next = {
            ...d,
            sessions: s ? [...d.sessions, s] : d.sessions,
            active: null,
          };
          return s && opts?.done ? addMark(next, s.habitId, dkey(new Date(end))) : next;
        });
        if (a && !saved) feedback('undo');
        else if (saved) feedback('session_complete');
        patchUi(a && !saved ? { timerOpen: false, toast: SHORT_TIMER_TOAST } : { timerOpen: false });
        if (opts?.editAfter && saved) {
          // Wait for the timer modal to finish dismissing: iOS won't present the
          // edit sheet while another modal is animating out.
          setTimeout(() => actionsRef.current?.openSessionSheet(saved.id), MODAL_GAP_MS);
        }
        return saved;
      },

      quickLog: (habitId, minutes) => {
        const now = Date.now();
        setData((d) => {
          if (!d.habits.some((h) => h.id === habitId)) return d;
          return { ...d, sessions: [...d.sessions, quickSession('s' + now, habitId, minutes, now)] };
        });
        feedback('session_complete');
      },
      toggleCheck: (habitId) => {
        const day = dkey(new Date());
        const d0 = storeRef.current.data;
        const on = d0.marks.some((m) => m.habitId === habitId && m.day === day);
        setData((d) => (on ? removeMark(d, habitId, day) : addMark(d, habitId, day)));
        feedback(on ? 'undo' : 'session_complete');
      },

      openHeatSheet: () => patchUi({ heatSheet: true }),
      closeHeatSheet: () => patchUi({ heatSheet: false }),
      pickHeat: (key) =>
        setUi((p) => ({ ...p, heatSel: p.heatSel === key ? null : key })),
      closeHeatSel: () => patchUi({ heatSel: null }),

      armClear: () => patchUi({ clearArmed: true }),
      cancelClear: () => patchUi({ clearArmed: false }),
      confirmClear: () => {
        setData((d) => ({ ...d, historyClearedAt: Date.now() }));
        patchUi({ clearArmed: false });
      },

      openNewHabit: (projectId) =>
        patchUi({
          habitSheet: {
            id: null,
            name: '',
            icon: 'code',
            projectId,
            dailyTargetMin: 30,
            minTargetMin: defaultMinMin(30),
            frequency: { kind: 'daily' },
            kind: 'timed',
          },
        }),
      openEditHabit: (habit) =>
        patchUi({
          habitSheet: {
            id: habit.id,
            name: habit.name,
            icon: habit.icon,
            projectId: habit.projectId,
            dailyTargetMin: habit.dailyTargetMin,
            minTargetMin: habit.minTargetMin,
            frequency: habit.frequency,
            kind: habit.kind ?? 'timed',
          },
        }),
      openEditHabitById: (habitId) => {
        const h = storeRef.current.data.habits.find((x) => x.id === habitId);
        if (h) actionsRef.current?.openEditHabit(h);
      },
      closeHabitSheet: () => patchUi({ habitSheet: null }),
      patchHabitSheet: (patch) =>
        setUi((p) =>
          p.habitSheet
            ? { ...p, habitSheet: { ...p.habitSheet, ...patch } }
            : p
        ),
      saveHabitSheet: () => {
        setUi((prevUi) => {
          const sh = prevUi.habitSheet;
          if (!sh || !sh.name.trim()) return prevUi;
          const frequency = normalizeFrequency(sh.frequency);
          const minTargetMin = clampMinMin(sh.minTargetMin, sh.dailyTargetMin);
          // Older app versions show the weekly minutes target; keep it in step.
          const weeklyTargetMin = sh.dailyTargetMin * weeklyTargetOf(frequency);
          setData((d) => {
            if (sh.id) {
              return {
                ...d,
                habits: d.habits.map((h) =>
                  h.id === sh.id
                    ? {
                        ...h,
                        name: sh.name.trim(),
                        icon: sh.icon,
                        projectId: sh.projectId,
                        dailyTargetMin: sh.dailyTargetMin,
                        weeklyTargetMin,
                        frequency,
                        minTargetMin,
                        kind: sh.kind,
                      }
                    : h
                ),
              };
            }
            const dup = d.habits.find(
              (h) => h.name.trim().toLowerCase() === sh.name.trim().toLowerCase()
            );
            if (dup) return d; // silently skip duplicates (parity with design)
            const tile = TILES[d.habits.length % TILES.length];
            const newHabit: Habit = {
              id: 'h' + Date.now(),
              projectId: sh.projectId,
              name: sh.name.trim(),
              icon: sh.icon,
              tile,
              dailyTargetMin: sh.dailyTargetMin,
              weeklyTargetMin,
              frequency,
              minTargetMin,
              kind: sh.kind,
            };
            return { ...d, habits: [...d.habits, newHabit] };
          });
          return { ...prevUi, habitSheet: null };
        });
      },
      deleteHabit: (id) => {
        setData((d) => {
          const habits = d.habits.filter((h) => h.id !== id);
          const sessions = d.sessions.filter((s) => s.habitId !== id);
          const marks = d.marks.filter((m) => m.habitId !== id);
          const active =
            d.active && d.active.habitId === id ? null : d.active;
          return { ...d, habits, sessions, marks, active };
        });
        setUi((p) => ({
          ...p,
          habitSheet: null,
          timerOpen: storeRef.current.data.active?.habitId === id ? false : p.timerOpen,
        }));
      },
      mergeHabit: (fromId, intoId) => {
        setData((d) => {
          const sessions = d.sessions.map((s) =>
            s.habitId === fromId ? { ...s, habitId: intoId } : s
          );
          const habits = d.habits.filter((h) => h.id !== fromId);
          let active = d.active;
          if (active && active.habitId === fromId)
            active = { ...active, habitId: intoId };
          return { ...d, sessions, habits, active, marks: moveMarks(d.marks, fromId, intoId) };
        });
        patchUi({ habitSheet: null });
      },

      openNewProject: () => {
        const d = storeRef.current.data;
        patchUi({
          projectSheet: { id: null, name: '', weeklyTarget: 5, color: nextProjectColor(d.projects), icon: 'target', scene: nextScene(d.projects) },
        });
      },
      openEditProject: (projectId) => {
        const p = storeRef.current.data.projects.find((x) => x.id === projectId);
        if (!p) return;
        const look = projectLook(p);
        patchUi({ projectSheet: { id: p.id, name: p.name, weeklyTarget: p.weeklyTarget, ...look } });
      },
      openCapacityFix: () => patchUi({ capacityFix: true }),
      closeCapacityFix: () => patchUi({ capacityFix: false }),
      closeProjectSheet: () => patchUi({ projectSheet: null }),
      patchProjectSheet: (patch) =>
        setUi((p) =>
          p.projectSheet
            ? { ...p, projectSheet: { ...p.projectSheet, ...patch } }
            : p
        ),
      saveProjectSheet: () => {
        setUi((prevUi) => {
          const sh = prevUi.projectSheet;
          if (!sh || !sh.name.trim()) return prevUi;
          setData((d) => {
            if (sh.id) {
              return {
                ...d,
                projects: d.projects.map((p) =>
                  p.id === sh.id
                    ? { ...p, name: sh.name.trim(), weeklyTarget: sh.weeklyTarget, color: sh.color, icon: sh.icon, scene: sh.scene }
                    : p
                ),
              };
            }
            return {
              ...d,
              projects: [
                ...d.projects,
                {
                  id: 'g' + Date.now(),
                  name: sh.name.trim(),
                  weeklyTarget: sh.weeklyTarget,
                  started: Date.now(),
                  color: sh.color,
                  icon: sh.icon,
                  scene: sh.scene,
                },
              ],
            };
          });
          return { ...prevUi, projectSheet: null };
        });
      },
      deleteProject: (id) => {
        setData((d) => {
          const hids = d.habits
            .filter((h) => h.projectId === id)
            .map((h) => h.id);
          const habits = d.habits.filter((h) => h.projectId !== id);
          const sessions = d.sessions.filter((s) => !hids.includes(s.habitId));
          const marks = d.marks.filter((m) => !hids.includes(m.habitId));
          let active = d.active;
          if (active && hids.includes(active.habitId)) active = null;
          return {
            ...d,
            projects: d.projects.filter((p) => p.id !== id),
            habits,
            sessions,
            marks,
            active,
          };
        });
        patchUi({ projectSheet: null });
      },

      archiveProject: (id) => {
        const now = Date.now();
        const a = storeRef.current.data.active;
        const onIt = !!a && storeRef.current.data.habits.some((h) => h.id === a.habitId && h.projectId === id);
        setData((d) => {
          let { sessions, active } = d;
          if (active && d.habits.some((h) => h.id === active!.habitId && h.projectId === id)) {
            const saved = sessionFromTimer(active, now);
            if (saved) sessions = [...sessions, saved];
            active = null;
          }
          return {
            ...d,
            sessions,
            active,
            projects: d.projects.map((p) => (p.id === id ? { ...p, archivedAt: now } : p)),
          };
        });
        const discarded = onIt && !sessionFromTimer(a!, now);
        patchUi({
          projectSheet: null,
          ...(onIt ? { timerOpen: false } : {}),
          ...(discarded ? { toast: SHORT_TIMER_TOAST } : {}),
        });
      },
      unarchiveProject: (id) =>
        setData((d) => ({
          ...d,
          projects: d.projects.map((p) => (p.id === id ? { ...p, archivedAt: null } : p)),
        })),

      openStageSheet: (projectId) => patchUi({ stageSheet: projectId }),
      closeStageSheet: () => patchUi({ stageSheet: null }),

      openLogSheet: (habitId) => {
        // Default to the given habit, else the first planned one not done yet today.
        const now = Date.now();
        const d = storeRef.current.data;
        const next = selectToday(d, now).items.find((i) => !i.done && i.kind === 'timed')?.habitId;
        const def = habitId ?? next ?? activeHabits(d)[0]?.id ?? null;
        const start = defaultManualStart(Date.now(), 30);
        patchUi({
          logSheet: {
            habitId: def,
            start,
            mode: 'duration',
            minutes: 30,
            end: start + 30 * 60000,
            note: '',
            error: null,
            confirmLong: false,
          },
        });
      },
      closeLogSheet: () => patchUi({ logSheet: null }),
      patchLogSheet: (patch) =>
        setUi((p) =>
          p.logSheet
            ? {
                ...p,
                // Any field change invalidates the last error and confirmation.
                logSheet: { ...p.logSheet, error: null, confirmLong: false, ...patch },
              }
            : p
        ),
      saveLogSheet: () => {
        setUi((prevUi) => {
          const sh = prevUi.logSheet;
          if (!sh || !sh.habitId) return prevUi;
          const habitId = sh.habitId;
          const end = logSheetEnd(sh);
          const check = checkSessionTimes(sh.start, end, Date.now());
          if (!check.ok) return { ...prevUi, logSheet: { ...sh, error: check.error } };
          if (check.needsConfirm && !sh.confirmLong) {
            return { ...prevUi, logSheet: { ...sh, error: null, confirmLong: true } };
          }
          setData((d) => {
            if (!d.habits.some((h) => h.id === habitId)) return d;
            const session = manualSession('s' + Date.now(), { habitId, start: sh.start, end, note: sh.note });
            return { ...d, sessions: [...d.sessions, session] };
          });
          return { ...prevUi, logSheet: null };
        });
      },

      openSessionSheet: (sessionId) => {
        // Latest data, so a session saved moments ago (stopTimer) is found.
        const s = storeRef.current.data.sessions.find((x) => x.id === sessionId);
        if (!s) return;
        patchUi({
          sessionSheet: {
            id: s.id,
            habitId: s.habitId,
            start: s.start,
            end: s.end,
            note: s.notes ?? '',
            error: null,
            confirmLong: false,
          },
        });
      },
      closeSessionSheet: () => patchUi({ sessionSheet: null }),
      patchSessionSheet: (patch) =>
        setUi((p) =>
          p.sessionSheet
            ? {
                ...p,
                // Any field change invalidates the last error and confirmation.
                sessionSheet: { ...p.sessionSheet, error: null, confirmLong: false, ...patch },
              }
            : p
        ),
      saveSessionSheet: () => {
        setUi((prevUi) => {
          const sh = prevUi.sessionSheet;
          if (!sh) return prevUi;
          const check = checkSessionTimes(sh.start, sh.end, Date.now(), { existing: true });
          if (!check.ok) return { ...prevUi, sessionSheet: { ...sh, error: check.error } };
          if (check.needsConfirm && !sh.confirmLong) {
            return { ...prevUi, sessionSheet: { ...sh, error: null, confirmLong: true } };
          }
          setData((d) => {
            if (!d.habits.some((h) => h.id === sh.habitId)) return d;
            return {
              ...d,
              sessions: d.sessions.map((s) =>
                s.id === sh.id
                  ? applySessionEdit(s, { habitId: sh.habitId, start: sh.start, end: sh.end, note: sh.note })
                  : s
              ),
            };
          });
          return { ...prevUi, sessionSheet: null };
        });
      },
      deleteSession: (id) => {
        const deleted = storeRef.current.data.sessions.find((s) => s.id === id) ?? null;
        setData((d) => ({
          ...d,
          sessions: d.sessions.filter((s) => s.id !== id),
        }));
        patchUi({ sessionSheet: null, undo: deleted });
      },
      undoDelete: () => {
        setUi((prevUi) => {
          const s = prevUi.undo;
          if (s) setData((d) => restoreSession(d, s));
          return { ...prevUi, undo: null };
        });
      },

      openRecap: (weekStart) => patchUi({ recapSheet: weekStart }),
      closeRecap: () => patchUi({ recapSheet: null }),

      openWeek: () => patchUi({ weekOpen: true }),
      openStartSheet: () => patchUi({ startSheet: true }),
      earnBadges: (ids, celebrate) => {
        const now = Date.now();
        setData((d) => ({ ...award(d, ids, now), badgesPrimed: true }));
        if (celebrate && ids.length) setUi((p) => ({ ...p, celebrations: enqueueCelebrations(p.celebrations, celebrationOrder(ids)) }));
      },
      dismissCelebration: () => setUi((p) => ({ ...p, celebrations: p.celebrations.slice(1) })),
      dayCompleted: (colors) => {
        feedback('day_complete');
        setUi((p) => ({ ...p, confetti: { key: Date.now(), colors }, cheerUntil: Date.now() + 4000 }));
      },
      burst: (x, y, color) => {
        const key = Date.now() + Math.random();
        setUi((p) => ({ ...p, bursts: [...p.bursts, { key, x, y, color }] }));
        setTimeout(() => setUi((p) => ({ ...p, bursts: p.bursts.filter((b) => b.key !== key) })), 1200);
      },
      targetReached: () => {
        feedback('target_reached');
        setUi((p) => ({ ...p, targetHits: p.targetHits + 1, cheerUntil: Date.now() + 4000 }));
      },
      closeStartSheet: () => patchUi({ startSheet: false }),
      closeWeek: () => patchUi({ weekOpen: false }),

      setReminderHours: (hours) => {
        const next = updateSettings({ reminderHours: clampReminderHours(hours) });
        if (next.reminderHours > 0) {
          requestReminderPermission().then((ok) => ok && setPermRev((r) => r + 1));
        }
      },
      setCapacity: (weekday, min) =>
        setData((d) => {
          const capacityMin = clampCapacity(d.prefs.capacityMin.map((m, i) => (i === weekday ? min : m)));
          return { ...d, prefs: { ...d.prefs, capacityMin } };
        }),
      setCapacityAll: (mins) => setData((d) => ({ ...d, prefs: { ...d.prefs, capacityMin: clampCapacity(mins) } })),
      setWeekStart: (weekStart) => setData((d) => ({ ...d, prefs: { ...d.prefs, weekStart } })),
      setDayLevel: (level) => {
        const day = dkey(new Date());
        setData((d) => {
          const o = d.days[day] ?? {};
          const next = level ? { ...o, level, prompted: true } : { ...o, prompted: true };
          return { ...d, days: { ...d.days, [day]: next } };
        });
      },
      reorderToday: (ids) => {
        const day = dkey(new Date());
        setData((d) => ({ ...d, days: { ...d.days, [day]: { ...(d.days[day] ?? {}), order: ids } } }));
      },
      setAside: (habitId, aside) => {
        const day = dkey(new Date());
        setData((d) => {
          const o = d.days[day] ?? {};
          const cur = new Set(o.aside ?? []);
          if (aside) cur.add(habitId);
          else cur.delete(habitId);
          return { ...d, days: { ...d.days, [day]: { ...o, aside: [...cur] } } };
        });
        feedback(aside ? 'undo' : 'tap');
      },
      fixTargets: (how) => {
        setData((d) => {
          const chk = targetCheck(d);
          if (!chk.over) return d;
          if (how === 'scale') return { ...d, projects: scaleTargetsToFit(d.projects, chk.capacityMin) };
          return { ...d, prefs: { ...d.prefs, capacityMin: raiseCapacityToFit(d.prefs.capacityMin, chk.targetMin) } };
        });
        feedback('session_complete');
      },
      dismissTargetCheck: (signature) => updateSettings({ targetCheckDismissed: signature }),
      acceptLearned: (mins) => {
        setData((d) => ({ ...d, prefs: { ...d.prefs, capacityMin: clampCapacity(mins) } }));
        updateSettings({ learnedDismissed: dkey(new Date()) });
        feedback('session_complete');
      },
      dismissLearned: () => updateSettings({ learnedDismissed: dkey(new Date()) }),
      setDailyPrompt: (dailyPrompt) => updateSettings({ dailyPrompt }),
      markWelcomeSeen: () => updateSettings({ welcomeSeen: true }),
      setBudgetMin: (min) => updateSettings({ budgetMin: clampBudgetMin(min) }),
      setPlanCap: (cap) => updateSettings({ planCap: clampPlanCap(cap) }),
      editQuest: (fn) =>
        setData((d) => {
          const q = fn({ items: d.items, links: d.links });
          return q.items === d.items && q.links === d.links ? d : { ...d, items: q.items, links: q.links };
        }),
    };
    // Reads go through storeRef (the latest committed data), so actions never
    // change identity and memoized children don't re-render for them.
  }, [setData, setUi, updateSettings]);
  actionsRef.current = actions;

  const staticValue = useMemo<StaticValue>(
    () => ({ ready, config: DEFAULT_CONFIG, actions, uiStore, clearLocalData }),
    [ready, actions, uiStore, clearLocalData]
  );

  return (
    <StaticContext.Provider value={staticValue}>
      <DataContext.Provider value={data}>
        <NowContext.Provider value={now}>
          <SettingsContext.Provider value={settings}>
            <SyncContext.Provider value={sync}>{children}</SyncContext.Provider>
          </SettingsContext.Provider>
        </NowContext.Provider>
      </DataContext.Provider>
    </StaticContext.Provider>
  );
}

function useStatic(): StaticValue {
  const ctx = useContext(StaticContext);
  if (!ctx) throw new Error('Streak hooks must be used within StreakProvider');
  return ctx;
}

/** The store's actions; stable, so reading them never re-renders. */
export function useActions(): StreakActions {
  return useStatic().actions;
}

/** True once persisted data is loaded. */
export function useReady(): boolean {
  return useStatic().ready;
}

export function useConfig(): AppConfig {
  return useStatic().config;
}

export function useClearLocalData(): () => Promise<void> {
  return useStatic().clearLocalData;
}

/** Synced data; re-renders on any data change. */
export function useData(): PersistedState {
  const d = useContext(DataContext);
  if (!d) throw new Error('useData must be used within StreakProvider');
  return d;
}

/** The store's slow clock (every STORE_TICK_MS, on data changes and on foreground). */
export function useStoreNow(): number {
  return useContext(NowContext);
}

/** Device-only preferences (not synced). */
export function useSettings(): AppSettings {
  return useContext(SettingsContext);
}

export function useSyncStatus(): SyncStatus {
  return useContext(SyncContext);
}

/**
 * A slice of UI state; re-renders only when the selected value changes
 * (by identity), so select a field, not a new object.
 */
export function useUi<T>(select: (ui: UIState) => T): T {
  const { uiStore } = useStatic();
  return useSyncExternalStore(uiStore.subscribe, () => select(uiStore.get()));
}
