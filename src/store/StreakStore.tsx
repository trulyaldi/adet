import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Alert, AppState } from 'react-native';

import { AppConfig, DEFAULT_CONFIG } from '../domain/config';
import { TILES } from '../domain/constants';
import { clampMinMin, defaultMinMin, Frequency, normalizeFrequency, weeklyTargetOf } from '../domain/frequency';
import { activeSec } from '../domain/engine';
import { clampCapacity, DEFAULT_PREFS, raiseCapacityToFit, scaleTargetsToFit, targetCheck } from '../domain/capacity';
import { missingLogs } from '../domain/dailyLog';
import { nextProjectColor, nextScene, withLooks } from '../domain/look';
import { addMark, moveMarks, removeMark } from '../domain/marks';
import type { GlyphName } from '../components/glyphs';
import { feedback } from '../feedback/feedback';
import { activeHabits } from '../domain/projects';
import {
  addToPlan,
  clampBudgetMin,
  clampPlanCap,
  completionOn,
  habitDaySec,
  planFor,
  PlanSettings,
  suggestPlan,
  swapInPlan,
} from '../domain/plan';
import { clampReminderHours, reminderFireAt } from '../domain/reminder';
import { finishRebalance } from '../domain/rebalance';
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
import { allAsChanges, enqueue, isUntouchedSeed, stampLocalChanges } from '../domain/sync';
import {
  CURRENT_SCHEMA_VERSION,
  DayLevel,
  Habit,
  HabitKind,
  IconKey,
  PersistedState,
  Session,
} from '../domain/types';
import { requestReminderPermission, syncReminder } from '../notifications/reminder';
import { SyncStatus, useSync } from '../sync/useSync';
import { AppSettings, DEFAULT_SETTINGS, loadSettings, saveSettings } from './settings';
import { clearState, EMPTY_SYNC_META, loadState, loadSyncMeta, saveState, SyncMeta } from './storage';

export type Screen = 'today' | 'projects' | 'stats';
export type StatsView = 'overview' | 'history';

/**
 * The plan editor on Today: swap a planned habit for another, add one to a
 * plan with room, or start a bonus habit once the day is done.
 */
export type PlanPicker = { mode: 'swap'; habitId: string } | { mode: 'add' } | { mode: 'bonus' };

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
  planPicker: PlanPicker | null;
  /** Bumped when a plan edit is blocked by the budget: budget bars flash amber and shake. */
  budgetShake: number;
  weekOpen: boolean;
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
  planPicker: null,
  budgetShake: 0,
  weekOpen: false,
};

/** Time for a full-screen modal to finish its dismiss animation. */
const MODAL_DISMISS_MS = 450;

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
   */
  stopTimer(opts?: { editAfter?: boolean; done?: boolean }): void;
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
  closeHabitSheet(): void;
  patchHabitSheet(patch: Partial<HabitSheetState>): void;
  saveHabitSheet(): void;
  deleteHabit(id: string): void;
  mergeHabit(fromId: string, intoId: string): void;
  // project sheet
  openNewProject(): void;
  openEditProject(project: { id: string; name: string; weeklyTarget: number }): void;
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
  openLogSheet(): void;
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
  // today's plan
  openPlanPicker(picker: PlanPicker): void;
  closePlanPicker(): void;
  /** Swap a planned habit for another; false (and a budget shake) when it wouldn't fit. */
  swapPlan(outId: string, inId: string): boolean;
  removeFromPlan(habitId: string): void;
  /** Add a habit to today's plan; false (and a budget shake) when it wouldn't fit. */
  addToPlan(habitId: string): boolean;
  // week view
  openWeek(): void;
  closeWeek(): void;
  /**
   * Close the one-time rebalance screen for good, applying the chosen
   * frequencies (habit id → frequency), or keeping everything as is (null).
   */
  finishRebalance(chosen: Record<string, Frequency> | null): void;
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
}

interface StreakContextValue {
  ready: boolean;
  data: PersistedState;
  ui: UIState;
  now: number;
  config: AppConfig;
  /** Device-only preferences (not synced). */
  settings: AppSettings;
  actions: StreakActions;
  sync: SyncStatus;
  /** Stop syncing and erase this device's data and sync state (before sign-out). */
  clearLocalData(): Promise<void>;
}

const StreakContext = createContext<StreakContextValue | null>(null);

function emptyData(now: number): PersistedState {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    projects: [],
    habits: [],
    sessions: [],
    marks: [],
    prefs: DEFAULT_PREFS,
    dailyLogs: [],
    active: null,
    historyClearedAt: 0,
    plans: {},
    planSince: dkey(new Date(now)),
    streakCarry: null,
    rebalancePending: false,
    days: {},
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
  const [ui, setUi] = useState<UIState>(INITIAL_UI);
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
    Promise.all([loadState(), loadSyncMeta(), loadSettings()]).then(([loaded, meta, prefs]) => {
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
    if (!ready || wiped) return;
    setData((d) => {
      const logs = missingLogs(d, today, d.planSince);
      const cutoff = dkey(addDays(new Date(), -14));
      const stale = Object.keys(d.days).filter((k) => k < cutoff);
      if (!logs.length && !stale.length) return d;
      const days = { ...d.days };
      for (const k of stale) delete days[k];
      return { ...d, dailyLogs: logs.length ? [...d.dailyLogs, ...logs] : d.dailyLogs, days };
    });
  }, [ready, wiped, today, setData]);

  // Every project gets a color, icon and scene (older projects, and ones
  // created on devices without looks); the assignment syncs like an edit.
  useEffect(() => {
    if (!ready || wiped) return;
    setData(withLooks);
  }, [ready, wiped, data.projects, data.habits, setData]);

  // Today's plan is fixed the first time the day is shown, so it doesn't
  // reshuffle as habits are done (completing one changes the weekly counts the
  // suggestion is based on). Re-suggested when the budget or cap changes. An
  // empty suggestion isn't fixed, so habits added (or synced) later that day
  // are still picked up; a plan the user emptied stays empty.
  const todayPinned = data.plans[today] !== undefined;
  const planSettings: PlanSettings = useMemo(
    () => ({ budgetMin: settings.budgetMin, planCap: settings.planCap }),
    [settings.budgetMin, settings.planCap]
  );
  const planSettingsRef = useRef(planSettings);
  planSettingsRef.current = planSettings;
  const pinnedWith = useRef<PlanSettings | null>(null);
  useEffect(() => {
    if (!ready || wiped) return;
    const settingsChanged = pinnedWith.current !== null && pinnedWith.current !== planSettings;
    pinnedWith.current = planSettings;
    if (todayPinned && !settingsChanged) return;
    setData((d) => {
      const days = habitDaySec(d);
      const suggested = suggestPlan(d, days, today, planSettings);
      // After a settings change, habits already done today stay in the plan when they still fit.
      const kept = settingsChanged
        ? (d.plans[today] ?? []).filter((id) => {
            const h = d.habits.find((x) => x.id === id);
            return h && completionOn(h, habitDaySec(d, Date.now()), today);
          })
        : [];
      let plan = kept;
      for (const id of suggested) plan = addToPlan(plan, id, d, planSettings) ?? plan;
      if (!plan.length) {
        if (d.plans[today] === undefined) return d;
        const { [today]: _dropped, ...rest } = d.plans;
        return { ...d, plans: rest };
      }
      return { ...d, plans: { ...d.plans, [today]: plan } };
    });
  }, [ready, wiped, today, todayPinned, planSettings, data.habits, setData]);

  // The undo toast expires on its own; a newer delete restarts the clock.
  useEffect(() => {
    if (!ui.undo) return;
    const t = setTimeout(() => setUi((p) => (p.undo === ui.undo ? { ...p, undo: null } : p)), UNDO_MS);
    return () => clearTimeout(t);
  }, [ui.undo]);
  useEffect(() => {
    if (!ui.toast) return;
    const t = setTimeout(() => setUi((p) => (p.toast === ui.toast ? { ...p, toast: null } : p)), TOAST_MS);
    return () => clearTimeout(t);
  }, [ui.toast]);

  // 1s tick drives the running timer + "Start" button clocks.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

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
          setTimeout(() => actionsRef.current?.openSessionSheet(saved.id), MODAL_DISMISS_MS);
        }
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
          timerOpen:
            data.active && data.active.habitId === id ? false : p.timerOpen,
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

      openNewProject: () =>
        patchUi({ projectSheet: { id: null, name: '', weeklyTarget: 8 } }),
      openEditProject: (project) =>
        patchUi({
          projectSheet: {
            id: project.id,
            name: project.name,
            weeklyTarget: project.weeklyTarget,
          },
        }),
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
                    ? { ...p, name: sh.name.trim(), weeklyTarget: sh.weeklyTarget }
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
                  color: nextProjectColor(d.projects),
                  icon: 'target',
                  scene: nextScene(d.projects),
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

      openLogSheet: () => {
        // Default to the first planned habit not done yet today.
        const now = Date.now();
        const day = dkey(new Date(now));
        const days = habitDaySec(data, now);
        const next = planFor(data, days, day, planSettingsRef.current).find((id) => {
          const h = data.habits.find((x) => x.id === id);
          return h && !completionOn(h, days, day);
        });
        const def = next ?? activeHabits(data)[0]?.id ?? null;
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
        const deleted = data.sessions.find((s) => s.id === id) ?? null;
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

      openPlanPicker: (planPicker) => patchUi({ planPicker }),
      closePlanPicker: () => patchUi({ planPicker: null }),
      swapPlan: (outId, inId) => {
        const d = storeRef.current.data;
        const day = dkey(new Date());
        const current = planFor(d, habitDaySec(d), day, planSettingsRef.current);
        const next = swapInPlan(current, outId, inId, d, planSettingsRef.current);
        if (!next) {
          setUi((p) => ({ ...p, budgetShake: p.budgetShake + 1 }));
          return false;
        }
        setData((x) => ({ ...x, plans: { ...x.plans, [day]: next } }));
        patchUi({ planPicker: null });
        return true;
      },
      removeFromPlan: (habitId) => {
        const day = dkey(new Date());
        setData((d) => {
          const current = planFor(d, habitDaySec(d), day, planSettingsRef.current);
          return { ...d, plans: { ...d.plans, [day]: current.filter((id) => id !== habitId) } };
        });
      },
      addToPlan: (habitId) => {
        const d = storeRef.current.data;
        const day = dkey(new Date());
        const current = planFor(d, habitDaySec(d), day, planSettingsRef.current);
        const next = addToPlan(current, habitId, d, planSettingsRef.current);
        if (!next) {
          setUi((p) => ({ ...p, budgetShake: p.budgetShake + 1 }));
          return false;
        }
        setData((x) => ({ ...x, plans: { ...x.plans, [day]: next } }));
        patchUi({ planPicker: null });
        return true;
      },
      openWeek: () => patchUi({ weekOpen: true }),
      closeWeek: () => patchUi({ weekOpen: false }),
      finishRebalance: (chosen) => setData((d) => finishRebalance(d, chosen, dkey(new Date()))),

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
    };
    // A few actions read `data` directly (deleteHabit's timerOpen decision,
    // openLogSheet, deleteSession's undo copy); the rest use
    // functional updates. Recreate when data identity changes so reads are fresh.
  }, [data, setData, updateSettings]);
  actionsRef.current = actions;

  const value = useMemo<StreakContextValue>(
    () => ({ ready, data, ui, now, config: DEFAULT_CONFIG, settings, actions, sync, clearLocalData }),
    [ready, data, ui, now, settings, actions, sync, clearLocalData]
  );

  return <StreakContext.Provider value={value}>{children}</StreakContext.Provider>;
}

export function useStreak(): StreakContextValue {
  const ctx = useContext(StreakContext);
  if (!ctx) throw new Error('useStreak must be used within StreakProvider');
  return ctx;
}

/** Convenience: current active-timer seconds (unused-safe helper for screens). */
export function currentActiveSec(data: PersistedState, now: number): number {
  return activeSec(data.active, now);
}
