# Adet redesign — implementation plan (branch `feat/redesign`)

One commit per ticket. Checks after each: `npm test`, `npm run typecheck`,
`npx expo export -p ios` (bundle smoke test).

## Data shape (decided up front, shipped with the ticket that needs it)

- `Project` + `color` (palette key), `icon` (IconKey), `scene` (plant | orbit | fill | constellation).
  Missing values fall back deterministically from the project id (same on every device).
- `Habit` + `kind` (timed | check). `dailyTargetMin`, `minTargetMin`, `frequency` stay and keep syncing
  (older builds read them; frequency still drives the weekly dots).
- New synced tables, all `(user_id, id)` + `deleted_at` + `server_updated_at` + RLS:
  - `habit_marks` — "done" taps and check-offs, id = `habitId:dkey`.
  - `daily_logs` — plan vs actual per day, id = dkey.
  - `badges` — earned milestones, id = badge key.
  - `user_prefs` — per-weekday capacity and week start, id = `prefs`.
- Local-only (device): sound, haptics, appearance, reduce-motion override, daily capacity tap,
  daily prompt on/off, welcome seen, dismissed suggestions.
- Migration `005_redesign.sql` (idempotent) + local schema v5.

## Tickets and files

1. Design system — `src/theme/{palette,theme,ThemeProvider}.ts(x)`, `src/components/{Button,Glyph,glyphs,AdetMark}`,
   project color/icon/scene fields (`types`, `rows`, `migrations`, `projects`), `app.json` (automatic), `App.tsx`.
2. Motion — `src/theme/motion.ts`, `src/components/{AnimatedBar,AnimatedRing,Appear,useMotion}`, Reanimated everywhere new.
3. Sound + haptics — `scripts/generate-sounds.js`, `assets/sounds/*.wav`, `src/feedback/{audio,haptics,feedback}.ts`, settings toggles.
4. Flexible time — `src/domain/sessions.ts`, `src/domain/marks.ts`, habit kind, quick-add, store actions, discard toast.
5. Capacity + planner — `src/domain/planner.ts` (`planToday`), `capacity.ts`, `dailyLog.ts`, prefs sync, learned capacity.
6. Today — `src/screens/TodayScreen.tsx`, `components/{HeroRing,PlanItem,ActiveSessionCard,StartSheet}`.
7. Focus + scenes — `src/overlays/FocusView.tsx`, `src/scenes/{Plant,Orbit,Fill,Constellation}.tsx`, `src/components/Companion.tsx`.
8. Celebrations — `src/domain/milestones.ts`, `src/components/{Burst,Confetti}`, `src/overlays/CelebrationHost.tsx`.
9. Projects — `src/screens/ProjectsScreen.tsx`, `src/overlays/{ProjectSheet,HabitSheet}.tsx`, capacity indicator.
10. Week + stats — `src/overlays/WeekSheet.tsx`, `src/screens/StatsScreen.tsx`, `src/domain/stats.ts`.
11. Streaks — `src/domain/streaks.ts` (activity-or-plan, weekly rest day, monthly freezes, carry), `components/Flame`.
12. Navigation, onboarding, polish — `TabBar`, `overlays/Welcome.tsx`, `SettingsSheet`, empty/loading/error states.
13. Data + sync — `supabase/migrations/005_redesign.sql`, `src/domain/sync.ts`, `src/sync/rows.ts`, v5 upgrade.
14. QA — tests for rebalance, capacity check, celebration queue, upgrade; greps for wording and labels.
