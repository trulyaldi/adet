# Adet

A local-first habit & time tracker for iOS/Android, built with **Expo (SDK 57) + React Native 0.86 + React 19.2 + TypeScript**. Ported from the `Streak v2` Claude Design file. All data lives on the device (AsyncStorage) — no backend, works fully offline.

## Run it on your phone (Expo Go)

This machine is **WSL2**, so your iPhone can't reach the dev server over the LAN. Use **tunnel mode**:

```bash
npm run tunnel      # = expo start --tunnel
```

Then in **Expo Go** on the iPhone 13:
- Scan the QR shown in the terminal, **or**
- Tap *Enter URL manually* and type the `exp://…exp.direct` URL printed by the CLI.

> The tunnel URL is stable across restarts (persisted in `.expo/settings.json`).

Other scripts:

```bash
npm run typecheck   # tsc --noEmit
npm test            # domain unit tests (node --test via tsx)
npm start           # LAN/localhost mode (only works off WSL2)
```

## Architecture

```
App.tsx                     Provider + screen switch + overlays
src/
  domain/                   Framework-free core (unit-tested)
    types.ts                Project / Habit / Session / ActiveTimer
    constants.ts            ICONS, TILES, STAGES, calendars
    config.ts               accent, timerQuote, heatmapWeeks, stageHours
    time.ts                 date + duration formatters
    engine.ts               selectors: today / projects / stats / stage / timer
    seed.ts                 deterministic 90-day sample data
    migrations.ts           persisted-state schema migrations + hydration
    engine.test.ts          unit tests
    migrations.test.ts      migration + hydration unit tests
  store/
    storage.ts              AsyncStorage load / migrate / save ('streak-v3'; reads legacy 'streak-v2')
    StreakStore.tsx         React context: state, 1s tick, all actions (CRUD, timer)
  theme/tokens.ts           colors, radii, shadows
  components/               glyphs.ts + Glyph (the Adet icon set, IconButton with labels and
                            long-press tooltips), DayRing, PlanCard, BudgetBar, ProgressBar, Sheet, TabBar
  screens/                  TodayScreen, ProjectsScreen, StatsScreen
  overlays/                 TimerOverlay, HabitSheet, ProjectSheet, StageSheet,
                            LogTimeSheet, EditSessionSheet, ActivityHistorySheet,
                            ActivityDaySheet, PlanPickerSheet, WeekSheet, RebalanceScreen
```

The `domain/` layer is a faithful, framework-free port of the design's `DCLogic`
(stage progression, streaks, weekly/monthly stats, activity heatmap). Screens are
thin: they call a selector and attach press handlers from the store.

## Data model

- **Project** — `{ name, weeklyTarget (h/week), started, archivedAt? }`; archived projects are hidden from Today/Projects but their history counts in Stats
- **Habit** — belongs to a project; `{ name, icon, tile, dailyTargetMin, minTargetMin, frequency, weeklyTargetMin }`. `dailyTargetMin` is the full session length, `minTargetMin` the minimum (both minutes); `frequency` is every day, 1–6 times a week, or fixed weekdays (`src/domain/frequency.ts`). `weeklyTargetMin` is kept in step for older app versions.
- **Completion** is derived, never stored: a day's time on a habit reaching its minimum counts as done, reaching its full length as a full session (`src/domain/plan.ts`).
- **Plans** (local-only, not synced) — each day's plan of at most `planCap` habits within the daily `budgetMin` (device settings), fixed when the day is first shown. `planSince`, `streakCarry` and `rebalancePending` are local-only too.
- **Streaks** (`src/domain/streaks.ts`) — a day counts when its plan is done; days with nothing planned are neutral; the first unfinished day of each week is a rest day. The pre-plans streak is kept as a floor (`streakCarry`).
- **Session** — a logged block of time on a habit `{ start, end, duration, notes?, manual? }`; `manual` is true when logged manually
- **PersistedState** — carries a numeric `schemaVersion`
- Stages (by lifetime hours): Novice → Learner → Builder → Practitioner → Professional → Expert → Master

## Schema versioning

To change persisted data, increment `CURRENT_SCHEMA_VERSION` in `src/domain/types.ts`, append a migration to `MIGRATIONS` in `src/domain/migrations.ts`, and add a migration test. Each migration converts one version to the next and stamps the resulting `schemaVersion`. New top-level fields must also be added to `persistedSlice` (the saved fields).

Supabase migrations in `supabase/migrations/` are run by hand in the SQL editor, in order, **before** opening a build that needs them: a build that sends a column the server doesn't have stalls all syncing on that device. `004_doable_day.sql` (habit `frequency` and `min_target_min`) is needed from the daily-plan build on.
