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
  components/               Icon (SVG), ProgressBar, Sheet, TabBar
  screens/                  TodayScreen, ProjectsScreen, StatsScreen
  overlays/                 TimerOverlay, HabitSheet, ProjectSheet, StageSheet,
                            LogTimeSheet, EditSessionSheet, ActivityHistorySheet,
                            ActivityDaySheet
```

The `domain/` layer is a faithful, framework-free port of the design's `DCLogic`
(stage progression, streaks, weekly/monthly stats, activity heatmap). Screens are
thin: they call a selector and attach press handlers from the store.

## Data model

- **Project** — `{ name, weeklyTarget (h/week), started, archivedAt? }`; archived projects are hidden from Today/Projects but their history counts in Stats
- **Habit** — belongs to a project; `{ name, icon, tile, dailyTargetMin, weeklyTargetMin }` (targets are in minutes; `dailyTargetMin` is kept and synced but no longer shown)
- **Session** — a logged block of time on a habit `{ start, end, duration, notes?, manual? }`; `manual` is true when logged manually
- **PersistedState** — carries a numeric `schemaVersion`
- Stages (by lifetime hours): Novice → Learner → Builder → Practitioner → Professional → Expert → Master

## Schema versioning

To change persisted data, increment `CURRENT_SCHEMA_VERSION` in `src/domain/types.ts`, append a migration to `MIGRATIONS` in `src/domain/migrations.ts`, and add a migration test. Each migration converts one version to the next and stamps the resulting `schemaVersion`.
