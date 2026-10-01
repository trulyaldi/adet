# Architecture notes

The short version is in the [README](../README.md). This page keeps the detail.

## Layers

- `src/domain/` is framework-free and unit-tested (`npm test`): plans, streaks, stats, sync merging, and the Quest rules in `src/domain/game/`.
- `src/store/` holds state and actions. `src/sync/` pushes an outbox to Supabase and pulls rows by cursor.
- Screens are thin: they call a selector and attach handlers from the store.
- Supabase is the only backend. The one piece of server code is the optional `sage` Edge Function (`supabase/functions/sage`).

## Data model

- **Project**: name, weekly target (hours), start date, optional `archivedAt`. Archived projects are hidden from Today and Projects, but their history still counts in Stats.
- **Habit**: belongs to a project. Has an icon, a full session length (`dailyTargetMin`), a minimum (`minTargetMin`), and a `frequency` (every day, 1 to 6 times a week, or fixed weekdays; see `src/domain/frequency.ts`).
- **Session**: a logged block of time on a habit: start, end, duration, optional notes, and a `manual` flag.
- **Completion is derived, never stored.** Reaching the minimum counts as done, reaching the full length as a full session (`src/domain/plan.ts`).
- **Plans** are device-local and not synced: each day's plan holds at most `planCap` habits within the daily time budget, fixed when the day is first shown.
- **Streaks** (`src/domain/streaks.ts`): a day counts when its plan is done. Days with nothing planned are neutral. The first unfinished day of each week is a rest day.
- **Stages** by lifetime hours: Novice, Learner, Builder, Practitioner, Professional, Expert, Master.
- **Items** (`supabase/migrations/006_quest.sql`) store only user actions for Quest Mode: tasks, chronicle entries, chest claims, purchases and boss-defeat achievements. Everything else in the game is derived by `deriveGameState()`.

## Schema versioning

To change persisted local data, increment `CURRENT_SCHEMA_VERSION` in `src/domain/types.ts`, append a migration to `MIGRATIONS` in `src/domain/migrations.ts`, and add a migration test. New top-level fields must also be added to `persistedSlice`.

## Supabase migrations

Files in `supabase/migrations/` are run by hand in the SQL Editor, in order, **before** opening a build that needs them. A build that sends a column the server lacks stalls syncing on that device.

| File | Adds |
|---|---|
| `001_init.sql` | Core tables, scoped per user with row-level security |
| `002_sync.sql` | Server-side last-write-wins and merge tracking |
| `003_archive.sql` | Project archiving |
| `004_doable_day.sql` | Habit `frequency` and `min_target_min` |
| `005_redesign.sql` | Project looks, habit kinds, done marks, daily logs, badges, planning preferences |
| `006_quest.sql` | Quest Mode tables |
| `007_sage_usage.sql` | Daily limit for the Sage |

Verify and rollback scripts are described in [`quest/MIGRATIONS.md`](quest/MIGRATIONS.md).

## Quest Mode

See [`quest/README.md`](quest/README.md) for the loop, balance table, ceremonies, safety switches and the asset pipeline.
