# Quest Mode migrations

Migrations are run **by hand** in the Supabase SQL Editor (Dashboard → SQL
Editor → New query → paste → Run). Nothing in this repo runs them for you.

## What to run, in order

| # | File | Needed for | Safe to re-run |
|---|---|---|---|
| 006 | `supabase/migrations/006_quest.sql` | Quest Mode (`items`, `links`) | yes |
| 007 | `supabase/migrations/007_sage_usage.sql` | Only the optional AI Sage Edge Function (its daily limit) | yes |

001–005 must already be in place (they are, if the app syncs today). Run 006
before using a build with Quest Mode. Without it, the Quest tab shows a calm
"almost ready" note and everything else keeps syncing (see "If 006 is
missing"). Run 007 only if you deploy `supabase/functions/sage`.

## Verify

Run the read-only checks after each migration. They change nothing.

- `supabase/manual/verify_006.sql`
- `supabase/manual/verify_007.sql`

Each prints one row per check (`pass = true`) and a final `== ALL … CHECKS`
row. If any row is `false`, run the migration again (both are idempotent) and
re-check. If it's still false, keep the output and send it along.

The checks:
- **006:** both tables exist with the `(user_id, id)` primary key and the
  `deleted_at` / `server_updated_at` columns; row-level security is on, with
  the four own-row policies; the `server_updated_at` triggers and indexes exist.
- **007:** the counter table exists with RLS on and no client policies;
  clients can neither read it nor call `sage_take_call()`; the service role can.

## Roll back (deletes data)

Rollbacks live in `supabase/manual/`, deliberately outside
`supabase/migrations/`, so no tool can ever run them. Each starts with a
SAFETY LOCK block that stops it with an error. Read the warning, delete that
block, then run.

| File | Removes | Data lost |
|---|---|---|
| `supabase/manual/007_sage_usage_down.sql` | the Sage counter and its function | per-day call counts only. Undeploy the `sage` function first. |
| `supabase/manual/006_quest_down.sql` | `items`, `links` | **every user's** weak points, chronicle, chest claims, purchases (including bought freezes), boss achievements and quest settings |

Roll back 007 before 006. Before 006's rollback, export `items` and `links`
(Table Editor → Export to CSV) if you might want them again.

## If 006 is missing

The app detects the missing tables on its first sync:
- The Quest tab shows the setup note (and, in development builds, which file
  to run).
- Every other table keeps syncing normally.
- Quest writes aren't queued for the server, so nothing piles up and sync
  never loops.
- Once 006 has run, the next sync picks it up.

## How this is tested

`supabase/manual/sql.test.ts` (part of `npm test`) runs real Postgres in-process
(PGlite) with Supabase's roles, `auth.uid()` and default grants. It checks that:
- 006 and 007 apply twice, and both verify scripts pass;
- the verify scripts report failure (without erroring) before the migrations;
- row-level security keeps users apart, and the Sage counter is server-only;
- the daily limit is atomic and stops at the limit;
- both rollbacks are locked until edited, undo cleanly, and 006/007 re-run afterwards.

`src/sync/missingTables.test.ts` covers the app side of "006 is missing".
