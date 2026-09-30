# Quest Mode — implementation plan

**Resume here (v2):** last finished N5. Next: N6 (the timer Stage). Nothing half-done.

## Quest Mode v2 (spec: the N0–N10 prompt, 2026-09-30)

Worktree `../adet-v2`, branch `feat/quest-v2` from `origin/main` (`024dcb3`, PR #23 merged), with the
tested stop → Loot hand-off fix cherry-picked from `fix/quest-crash` (`bf378fe`; its diagnostic commit was
not taken). Dependencies are a real `npm ci` (the owner's `node_modules` predates #22's lockfile). Packs
copied read-only from `../adet-polish/assets/game/raw/` (Kenney: impact, interface, music jingles, rpg audio,
tiny dungeon, tiny town).

### N0 baseline

| Check | Result |
|---|---|
| Typecheck | pass |
| Tests | 447 pass, 0 fail |
| iOS export | one Hermes bundle, 5,125,659 B; assets 669,624 B |
| Web export | `index` 2,690,049 B + async chunks (BattleStrip 2.3 KB, LootSheet 7.6 KB, QuestScreen 64 KB, Scene 12 KB, common 555 KB) |

### N0 mascot references, for N5

The old mascot lived in its own component folder (`Mascot`, `ScreenMascot`, art and motion files), in
`src/theme/mascot.ts` (+ its test) and in `assets/mascot/` (a spec and eight SVGs). It was used by
`src/components/ErrorBoundary.tsx`, `src/components/stats/{PeriodChart,WeekHero}.tsx`,
`src/overlays/{CelebrationHost,FocusView,WelcomeFlow}.tsx`, `src/screens/{ProjectsScreen,StatsScreen,TodayScreen}.tsx`,
and named in comments in `src/screens/Quest/session/QuestFocus.tsx` and `src/store/{StreakStore.tsx,Watchers.tsx}`.
All of it is gone after N5.

### N0 stand-in inventory, for N9

`generated-placeholder`: 0. `needs-art` (Adet's own code-drawn stand-ins, allowlisted in
`assets/game/needs-art.json`): 327 ids — avatar 28, boss 21, trophy 14, mob 42, npc 6, villager 7, critter 18,
pet 4, decor 63, parallax 21, prop 38, tile 35, fx 8, icon 22. Only 38 ids come from a pack or a recolour/composite
of one (see `docs/quest/art/INVENTORY.md`).

### N1 result

Confirmed in code: every Skia screen (map, Loot sheet, battle strip, ceremonies, playground) was a
`() => import(...)` passed to `SkiaGate`, so Expo Go fetched each one as an async bundle through the dev
server on first use. Now `src/game/render/screens.ts` (native: `require` inside each loader, still lazy)
and `screens.web.ts` (web: `import()` for CanvasKit) hold every loader; `SkiaGate` renders the synchronous
module inside a `SkiaBoundary`. Error paths: a ceremony that fails finishes (`onError={done}`), the Loot
sheet falls back to a plain "Later" panel (the chest waits at camp), a Quest sheet closes, the map shows
a calm note, the timer strip shows nothing. Guard: `render/noDynamicImport.test.ts`. iOS export: one
Hermes file, 5,124,989 B (−670 B); web export starts (headless Chromium: sign-in screen, no console errors;
needs `.env` and `expo export --clear`).

### N3 result

`npm run game:balance` (5 seeds; days per biome, first loop):

| Profile | forest | swamp | desert | frost | iron | volcano | astral | total |
|---|---|---|---|---|---|---|---|---|
| 1 h/day | 17.6 | 16.6 | 23.4 | 23.2 | 22.6 | 28.4 | 36.0 | 168 |
| 2 h/day | 9.0 | 11.4 | 16.6 | 17.4 | 18.8 | 19.0 | 25.6 | 118 |
| 3 h/day | 6.4 | 11.0 | 13.8 | 15.6 | 15.8 | 16.2 | 21.0 | 100 |
| 4 h/day | 6.2 | 9.6 | 12.8 | 15.6 | 13.8 | 14.2 | 16.2 | 88 |

2 h/day lands in every band (8–10, 16–20, 24–30). 4 h/day finishes the loop 1.9× faster than 1 h/day. Seals
rarely hold a 2 h/day player back (the boss's HP takes longer than its Days seal); they bite for very heavy
days (the 4 h/day forest boss waits ~2 days for its Days seal) and for 1 h/day late bosses (Insight).
**The current biome's node position may move back after this rebalance** (boss defeats, XP, levels and
credits are unaffected: stored achievements floor the journey).

### N5 result

Every mascot appearance is now `<Character mood>` (`src/components/character/Character.tsx`): the player's
own layered avatar in their rank and gear, loaded through `SkiaGate` so app start still loads no Skia, with an
empty same-size box until it draws. Moods map to avatar animations: idle → idle, focused → attack, sleepy →
nap (breathing, drifting "z"), cheering/celebrating → cheer, relaxed → sit, waving → wave. New poses for every
layer (all 7 tiers and all gear): attack ×2 (lean and a sheared blade swing, grip stays in hand), nap ×2 (eyes
closed), wake, sit; `fx.zzz`. Removed: the mascot's components, colours, test, SVGs and spec (no dependency
became unused: `react-native-svg` is still used by icons and charts). Bundle, N0 → N5 (cumulative, N2's font
swap included): iOS Hermes 5,125,659 → 5,110,167 B (−15.5 KB); iOS assets 669,624 → 539,424 B (−130 KB);
web index 2,690,049 → 2,671,082 B (−19 KB).

### v2 assumptions

(Numbered from 51, continuing the list below.)

51. **Branch base.** Quest Mode is on `origin/main`; v2 branches from it. The stop → Loot hand-off hold from
    the crash investigation (`bf378fe`) is kept: it is tested and independent of N1's cause.
52. **Error fallbacks are silent.** A failed Skia screen shows the calmest thing that keeps the flow going
    (see N1 result), never an error message.
53. **One pixel font (N2).** Tiny5 replaces Pixelify Sans and Silkscreen everywhere; `tiny` text is 12 pt,
    bold uses the same face, check marks are drawn (`PixelCheck`). See `docs/quest/art/FONT_DECISION.md`.
54. **A flaky run.** The 5,000-session benchmark (best of 12 runs, < 50 ms) is the one timing test; it failed
    twice under heavy parallel load (N1, and during N5 before 67's speed-up). See 67.
55. **Surplus follows the path, always (R1).** Damage over the one allowed defeat walks forward, stopping each
    enemy at 1 HP, past a staggered boss (0 HP), past the Burnout Drake once its daily third is taken, and into
    the next biome if it gets that far. Nothing is dropped: a test checks that every journey session's hits add
    up to its base + crit damage.
56. **Seals count sessions fought against the boss (R3).** A session belongs to the encounter that is the front
    enemy *before* its damage lands; sessions while a mob is in front count toward no seal. Days are local days
    (the device time zone); Depth counts focused minutes ≥ 45; Insight counts completed weak points plus a
    chronicle entry with text, once the chest is claimed.
57. **When a boss falls (R4).** Either a session's damage empties it with its seals already met, or a session
    against a staggered boss fills the last seal (its own day, depth or claimed insight). Both use the
    session's one defeat.
58. **Pacing constants were retuned (R2).** The spec's starting values (mobs ×1.12 per biome, bosses 1.5 × weekly,
    flat) put biome 7 at ~18 days for 2 h/day. Shipped: mobs `90 × 1.15^biome`; bosses
    `clamp(1.1 × weekly × 1.15^biome, 480, 2400)`, tutorial 420; ×1.2 per loop after the clamp. Result below.
59. **Simulator profiles.** 6 active days a week (rest days rotate), ±25% daily variation, 1–3 sessions a day,
    40% of chests claimed with a line and 30% with one weak point; each profile's weekly target equals its real
    weekly minutes. Seeded (mulberry32), so the test and `npm run game:balance` agree.
60. **Staggered look without new art.** A staggered boss uses its existing `.low` pose plus `fx.dazed` (three
    stars on an ellipse, drawn in the stand-in pipeline); `icon.calendar` is new stand-in art for the Days seal.
61. **Seal counts are shown in the boss panel.** The tap on the gate that opens the panel is the reveal; the pips
    themselves aren't buttons (no nested pressables, see PR #19).
62. **The crash-repro script is gone.** `scripts/quest-crash-repro.ts` came with the cherry-pick and assumed the
    old HP rules; `game:balance` and the derive tests cover the same ground.
63. **A quick log is a `log` with `sessionId: ''` (N4).** Older builds already parse a missing session id to
    `''`, so the new records read harmlessly there. A measure is one `metric_def` per habit with the fixed id
    `metric:<habitId>` ("at most one" by construction; editing overwrites it on every device). No migration:
    `items.type` is free text.
64. **Quick-log rewards.** Only a quick log with a line is rewarded (+3 XP), the first 3 each local day; an amount
    alone is saved but earns nothing. On the journey, a rewarded quick log adds Insight when a boss is the front
    enemy, and fells a staggered boss whose last seal it fills (the defeat records the log's id).
65. **The Trail compares this week so far with last week to the same moment**, as the Stats hero does, so a
    Monday morning is never "resting" against a whole week. Weeks follow the app's week-start setting (local
    time, `time.ts`). Focused minutes count every session by its start; skill levels use the game's effective
    minutes when given. A session's measure counts on the session's day; a quick log's on its own.
## Audit after Codex handoff — 2026-09-29
66. **Mascot moods keep their meaning.** "Focused" became a gentle attack, "sleepy" a nap, "relaxed" sitting.
    Project tints no longer apply (the character wears its own gear). Accessibility labels read "Your
    character, napping" and so on.
67. **Derive stays fast.** N3/N4 made a 5,000-session derive ~40% slower in Node (module getters in tsx's
    output); caching mob HP per biome, computing max HP without building node objects and skipping enemies
    already at 1 HP brought it back to ~13 ms alone (~35–40 ms when the whole suite runs in parallel).
Claude resumed after Codex. Codex's commits are `d7aeff8` (R), `59f7576` (Q10
previews), `9aeb50b` (Q11) and `daee7e7` (Q12); it ran out of credits in the
middle of the Q9 rewrite, which was left uncommitted (`be5ae32` commits it as
it stood). `226e664` (Q10) predates Codex. The spec files were never in the
repo; their text was recovered from Codex's session log into
`docs/quest/spec/`.

### Status (after the fixes below)

| Ticket | Status | Evidence |
|---|---|---|
| Q0 | done | This plan: recon, files per ticket, data flow, assumptions, risks. |
| Q1 | done | `006_quest.sql` idempotent, `(user_id, id)`, `deleted_at`, trigger, RLS with `with check`; `questRows`/`rows` tests. |
| Q2 | done | `derive.test.ts` covers the rule list and a 5,000-session benchmark. |
| Q3 | done | `manifest.test.ts` (zero missing ids, one density); `CREDITS.md`; `npm run game:assets`. |
| Q4 | done | Skia kit samples with `FilterMode.Nearest` everywhere; `Playground` only when `__DEV__`. |
| Q5 | done | `biomes.test.ts` (nodes, spline, ids, ≤12-word lines). Boss pre-fight lines had lost their caller; restored in `b4d1700`. |
| Q6 | done | Quest tab, map, reveal, HUD, badge; `model.test.ts`. |
| Q7 | done | Board, Merchant, Scribe, Sage sheets; bought freezes extend `streakV5` only through a new optional argument. |
| Q8 | done | Weak points row, battle strip, Loot sheet via `useQuestAfterStop`; `stopTimer` returns the session. |
| Q9 | done | Pure `ceremonies.ts` + tests; one `RootCeremonyHost`; marks per user; Ascension. The host was missing the "other sheet open" gate (fixed). |
| Q10 | done (device QA open) | `resolveAvatarLayers`/`isEquippable` tests; previews at 3×/4×. Restart/sync persistence needs Expo Go. |
| Q11 | done | Worker verifies JWT (JWKS or HS256), KV 30/day, 32 KB, zod output, drops unknown habits, CORS from `ALLOWED_ORIGINS`; client tests. |
| Q12 | done | `feedback` gate (`timer` always muted, any active session mutes all); local SFX/music/haptics/motion; gate tests. |
| Q13 | done in code (device QA open) | Kill switch (`enabled.ts`, tested), missing-migration note, `__DEV__` playground, edge-case tests, VoiceOver labels, `README.md`. 3×/4× visuals, profiling and VoiceOver need Expo Go. |
| R | done | This audit. |
| A1 | done | Veteran test: zero unopened chests, balance = `WELCOME_CREDITS` (50). |
| A2 | done | Only `boss_defeated` is written; the other kinds are `@deprecated`. |
| A3 | done | `useQuestStarted()` gates the Loot sheet, battle strip and weak points; the tab dot invites until onboarding. |
| A4 | done | `LootHost` calls `ceremonyHost.evaluate()` on close; `LootSheet` imports no ceremony. |

### Issues found

| Tag | Issue | Where | Fix |
|---|---|---|---|
| blocker | A temporary QA harness replaced the app entry in the working tree (`index.ts` deleted, `main: index.tsx`, `src/qa-ceremony.tsx`, headed "do not commit"). Predates Codex. | working tree only | Never committed; every check below ran in a clean worktree. Left for the owner to delete. |
| blocker | Q9 rewrite uncommitted and unfinished. | `src/game/ceremonies/`, `src/domain/game/ceremonies.ts` | `be5ae32`, `b4d1700` |
| bug | The root ceremony host ignored open sheets, the intro replay and queued celebrations, so a scene could present over the Merchant or a habit sheet. | `host.tsx` | `b4d1700` (`holdCeremonies`, `anyModalOpen`, celebrations wait for ceremonies) |
| bug | Onboarding wrote marks straight to storage while the host's copy stayed empty until sync settled (two writers). | `QuestScreen.tsx` | `b4d1700` (`ceremonyHost.seed`) |
| bug | Boss pre-fight lines and defeat lines were never shown (Q5 content orphaned when the intro event was dropped). | `BossIntro.tsx` | `b4d1700` |
| bug | The worker returned 502 for fenced JSON, and counted oversized requests against the rate limit. | `worker/src/index.ts` | `quest(fix): worker…` |
| bug | `enableSage()` never resolved on web (`Alert` is a no-op there). | `src/services/sage.ts` | `quest(fix): the Sage privacy note…` |
| bug | App start loaded Skia (CanvasKit on web): App → ceremony host → LevelUp → pixel UI theme → `render/pixel.ts`. | `game/ui/theme.ts` | `fbc2484` (`render/grid.ts`) |
| bug | Map tap panels read only "Close" to VoiceOver (boss lines, tips, enemy health unheard); the level-up wasn't announced on iOS. | `TapPanel.tsx`, `LevelUp.tsx` | `9932aae` |
| cleanup | Rank-up unlock icons and the trophy shelf were buttons with a no-op press. | `RankUp.tsx`, `CharacterSheet.tsx`, `IconGrid` | `b4d1700`, `9932aae` |
| cleanup | Level-up had no pixel burst; its timer restarted when XP changed; used the deprecated `pointerEvents` prop. | `LevelUp.tsx` | `b4d1700` |
| cleanup | Two `expo-audio` modules each call `setAudioModeAsync`, with identical options (silent switch respected, mix with others). | `src/feedback/audio.ts`, `src/game/audio.ts` | Kept: same mode, no conflict; noted. |
| cleanup | Legacy synced `sfx/music/haptics/motion` in `quest_meta.settings` are still parsed but read by nothing. | `items/types.ts` | Kept for older builds (see 33). |
| spec | Spec names the AI flag `settings.aiSage`; code uses `settings.ai`. | `items/types.ts` | Kept (see 36). |
| — | Scope and safety checks: no secrets in the diff; `ANTHROPIC_API_KEY` appears only in worker code and docs; no React in `src/domain/game`; no TODO/FIXME/`console.log` in Quest code; migration 006 unchanged since Q1; new deps (Skia 2.6.2, expo-font, Google pixel fonts) are in Expo Go; `sharp` is dev-only. | | pass |

### Health checks (clean worktree of the committed tree)

- Typecheck: pass (`tsc --noEmit`; worker: `tsc --noEmit` in `worker/`).
- Tests: 396 pass, 0 fail (`npm test`).
- Lint: no lint script in the repo (see 9).
- `npx expo start`: Metro serves `index.bundle?platform=ios` with HTTP 200.
- `expo export`: iOS (Quest on and off) and web succeed. iOS Hermes bytecode
  4,132,477 → 5,115,456 bytes (+983 KB, +23.8%); assets 282 KB → 617 KB.
- Static imports from `App.tsx` reach no Skia module (as on `main`).
- `expo-doctor`: 20/21. The one failure is a patch mismatch inherited from
  `main` (`expo` 57.0.25 installed, ~57.0.26 expected), not an Expo Go
  incompatibility.

## Polish pass baseline — 2026-09-29

Measured on a clean worktree of `79a9dfc` before any polish-pass change.

| Check | Result |
|---|---|
| Typecheck (app, worker) | pass, pass |
| Tests | 396 pass, 0 fail |
| `expo export --platform ios` | ok; Hermes bytecode 5,115,347 B; assets 616,750 B (22 files) |
| `expo export --platform web` | ok; 3,960,144 B total |
| Game atlases (`src/game/assets/atlases/`) | 76,528 B (8 PNGs) |
| Entry point | `package.json` `main` = `index.ts`, which exists |
| `assets/game/raw/` | empty (no licensed packs installed) |

## Polish pass: size budgets and render-loop audit (P7)

`npm run check:size` exports iOS and checks `scripts/size-budgets.json`:

| Budget | Limit | Measured (after P9/P10) |
|---|---|---|
| JS bundle (Hermes) | baseline 5,115,347 B + 1.2 MB | 5,125,120 B (+10 KB) |
| Game images, total | 2.5 MB | 66 KB (8 atlases) |
| Any one atlas | 500 KB | 10.7 KB (shared) |
| Game audio | 4 MB | 53 KB (9 SFX; no music) |

No budget was raised.

Render-loop audit:

| Checked | Finding |
|---|---|
| Per-frame React state | None. The world clock is a Reanimated frame callback on the UI thread; the map sets React state only when the visible biome band changes (not per frame); the reveal, camera and avatar are shared values. |
| Battle strip | Re-renders every 5 s for its minute preview (60 s with reduce motion); its clock is paused while the timer is paused. Fine. |
| `deriveGameState` recompute | Memoised on the data slices it reads, never the clock (`fromData.test.ts`). The QA panel's what-if game re-derived on every store tick: now once a minute or on a data/overlay change. |
| Pause on blur / background | The Quest screen is unmounted when its tab isn't showing, so its clock, particles and ambient layers stop; the clock also stops when the app is in the background and with reduce motion. |
| Atlases on blur | Ref-counted (`render/atlas.ts`): unmounting the Quest screen frees every biome atlas (only `shared`, used by HUD-size sprites elsewhere, stays). |
| Audio | SFX players are released when the app leaves the foreground; no music ships yet. |
| Benchmark | 5,000 sessions: 12.8 ms best of 12 (limit 50 ms); with a what-if overlay: 9.3 ms. |

## Codex handoff notes

### Inconsistencies found

- `src/game/ceremonies/host.ts` exposes an evaluator hook, while the real
  `CeremonyHost` is mounted only inside `QuestScreen` and never registers it.
  Q9 will consolidate this into the root host required by Part 2.
- `src/game/feedback.ts` gates sound during a timer but not haptics; Q12 will
  put both through one context gate, including paused sessions.
- `quest_meta.settings` currently holds device audio/motion preferences,
  whereas Part 2 makes SFX, music, haptics and motion local per device. Q12
  will migrate reads to local preferences while preserving synced battle strip,
  AI Sage and NPC names.
- The avatar preview script rebuilt its own layer order instead of calling
  `resolveAvatarLayers`. Q10 now uses the shared resolver for previews too.

### Audit environment

- Both prompt files were absent from the repository and Git history; their full
  text was supplied in the handoff conversation before this audit was written.
- `feat/quest` was pushed to `origin/feat/quest` at `226e664`.
- The checkout contained pre-existing changes to `index.ts`, `index.tsx`,
  `package.json` and `src/qa-ceremony.tsx`; this audit leaves them untouched.
- `npm run lint` is unavailable because this repository has no lint script.
- `npx expo start --offline` reached project startup but did not report a ready
  bundle; `expo export --platform web` bundled 1,464 modules successfully.
- `expo-doctor` could not download through sandbox DNS; it needs an unrestricted
  rerun.
- Q10 previews at 3× and 4× were generated and inspected. Live restart and
  two-device equip persistence still need the Q13 Expo Go QA pass.

Quest Mode gives focused time a purpose through one loop: **choose** weak points →
**fight** (the timer damages the current enemy) → **loot** (a chest opened by ticking
weak points and/or writing one line). The game is a pixel-art journey through 7
biomes and lives in a new **Quest** tab; the loop itself runs inside the existing
session flow.

This file is the reference for every ticket (Q1–Q13). Each commit is
`quest(Qn): …` on `feat/quest`.

---

## Recon (Q0)

| Area | Where | Notes |
|---|---|---|
| Session model | `src/domain/types.ts` `Session` | `{ id, habitId, start, end (epoch ms), duration (s), notes?, manual? }`. Id is `'s' + end` (timer) or `'s' + Date.now()` (manual). **Pauses are not recorded**: `sessionFromTimer` sets `start = end − duration`. |
| Timer | `ActiveTimer { habitId, startedAt, baseSec }` | One per user, synced (`active_timers`). Stopped via `stopTimer` (`StreakStore.tsx`) from `useStopTimer` (FocusView, ActiveSessionCard). |
| Habits = "projects" here | `Habit` (`weeklyTargetMin`, `icon`, `projectId`), `Project` (colour/icon/scene) | Skills are per habit. Boss HP reads `Σ habit.weeklyTargetMin` (active habits). |
| Streak / freeze | `src/domain/streaks.ts` `streakV5` (called from `selectors.ts dayStreakOf`) | `FREEZES_PER_MONTH = 2`, derived, never stored. Bought freezes extend the per-month count through a new optional argument. |
| Sync tables | `src/domain/sync.ts` `SyncTable`, `src/sync/rows.ts`, `src/sync/remote.ts` | Outbox + last-write-wins on `updated_at`; soft deletes; identity-diffing (`stampLocalChanges`) finds local edits. Push parents first; pull children first. Push/pull throw on any error → whole sync "offline". |
| Local storage | `src/store/storage.ts`, `src/domain/migrations.ts` | `PersistedState` schema v5 → **v6** adds `items`, `links`. |
| Tabs | `src/components/TabBar.tsx`, `Screen` type in `StreakStore.tsx`, screen switch in `App.tsx` | Three icon tabs, stroke glyphs from `src/components/glyphs.ts` (24×24, stroke 2, round caps). |
| Theme | `src/theme/theme.ts` (`useTheme`), `useReducedMotion`, `useAppActive` | Light/dark tokens; device prefs for sound/haptics/motion. |
| Feedback | `src/feedback/feedback.ts`, `audio.ts` (expo-audio, preloaded players) | One call per moment. |
| `items` / `links` | — | Do not exist. Created by migration **006**. |
| Tests | `node --test` via `tsx` | The glob covers one level only; extended to the new folders. **No lint is configured.** Typecheck and tests are the gates (see Assumptions). |
| Phase 6 | merged (PR #10) | Stats owns the numbers. Quest shows level, XP bar and credits only; it never repeats hours, streak counts or records. |

---

## Architecture

```
src/domain/items/types.ts     Item/Link types + typed props (pure)
src/domain/game/              pure TS: balance, derive, journey, xp, credits, chests, twists (tested)
src/data/itemsRepo.ts         typed writes + hooks (useItems, useLinks, useQuestMeta…)
src/sync/questRows.ts         item/link ↔ row mapping (rows.ts delegates)
src/sync/questTables.ts       "are the 006 tables there?" flag (persisted)
src/game/content/             biomes (palettes, maps, mobs, bosses, lore), NPCs, shop stock
src/game/assets/              atlases (generated PNG + frames.generated.ts), manifest, atlasSources (RN only), fonts
src/game/render/              Skia kit: PixelStage, AtlasSprites, AnimatedSprite, Tilemap, Particles, Lighting, transitions
src/game/ui/                  RN pixel UI: PixelPanel, PixelButton, PixelText, DialogBox, HPBar, CountUp
src/screens/Quest/            QuestScreen (map), sheets (NPCs, Loot, Character), ceremonies, playground
src/services/sage.ts          AI client (opt-in) + rule-based fallback
worker/                       Cloudflare Worker for the Sage (not deployed)
scripts/gen-placeholders.ts   original pixel art from palette-indexed grids
scripts/build-atlases.ts      packs generated + raw pack sprites into atlases
```

### Data flow

```
sessions, habits, items, links ──▶ deriveGameState(…, now, tz) ──▶ GameState
   (PersistedState, synced)          (pure, memoised by identity + clock bucket)
                                          │
        user actions (itemsRepo) ◀────────┤ Quest tab / Loot sheet / battle strip / tab badge
        tasks, logs, chest_claims,        │
        purchases, quest_meta             └─▶ QuestWatcher (deterministic ids):
                                                writes achievement(boss_defeated) append-only
```

- **Stored:** tasks, logs, chest claims, purchases, `quest_meta` (start, avatar, settings), achievements.
  Everything else (XP, level, rank, boss HP, journey position, credits) is derived.
- **Local-only (device):** `lastSeenProgress`, ceremonies already played, the weak points picked for the
  running timer, the AI response cache.
- **Deterministic ids** for records two devices may both write, so last-write-wins collapses duplicates:
  `quest_meta`, `chest:<sessionId>`, `log:<sessionId>`, `ach:boss:<biome>:<loop>`, links
  `<kind>:<fromId>:<toId>`.

### Session loop (Q8)
- **Choose:** there is no pre-start step today (StartSheet, plan rows and the active card all start in one tap).
  The collapsed weak-points row therefore lives at the top of the focus view, just after start. It adds zero taps.
  The ids picked are kept locally, keyed to the running timer.
- **Fight:** a battle strip (≤72 px) on the focus view shows a live preview only.
- **Loot:** `stopTimer` returns the saved session (a one-line change). For sessions of 10+ minutes, the Loot sheet opens
  after the focus modal dismisses (`MODAL_GAP_MS`, as `editAfter` does). `planned_for` links are written at that
  moment. Other saved sessions (timer switches, manual logs) become chests at camp.

---

## Tickets → files

| Ticket | Creates | Touches (surgically) |
|---|---|---|
| Q1 data | `supabase/migrations/006_quest.sql`, `src/domain/items/types.ts`, `src/domain/items/*.test.ts`, `src/sync/questRows.ts`, `src/sync/questTables.ts`, `src/data/itemsRepo.ts` | `types.ts` (v6 + fields), `migrations.ts` (v6 step, hydrate, slice), `sync.ts` (2 simple tables), `rows.ts` (delegate), `remote.ts` (optional tables), `useSync.ts` (ignore unavailable tables), `StreakStore.tsx` (emptyData + one `editQuest` action), `package.json` test glob |
| Q2 domain | `src/domain/game/{balance,biomes,derive,journey,xp,credits,chests,twists,rank,tz}.ts` + tests + bench | — |
| Q3 assets | `scripts/gen-placeholders.ts`, `scripts/pixel/*`, `scripts/build-atlases.ts`, `src/game/assets/{manifest,frames.generated,atlasSources,fonts}.ts`, `assets/game/CREDITS.md`, `assets/game/raw/README.md` | `package.json` (`game:assets`, deps) |
| Q4 render | `src/game/render/*`, `src/game/ui/*`, `src/screens/Quest/Playground.tsx` | — |
| Q5 biomes | `src/game/content/biomes/*.ts`, `src/game/content/{npcs,lore}.ts`, tests | — |
| Q6 tab + map | `src/screens/Quest/QuestScreen.tsx`, `JourneyMap.tsx`, `Hud.tsx`, `Camp.tsx`, `reveal.ts` | `TabBar.tsx` (4th tab + badge), `glyphs.ts` (controller), `StreakStore.tsx` (`Screen` += `'quest'`), `App.tsx` (screen switch) |
| Q7 NPCs | `src/screens/Quest/sheets/{Sage,QuestBoard,Merchant,Scribe}Sheet.tsx`, `src/game/content/shop.ts` | `streaks.ts` (+ optional extra freezes), `selectors.ts` (pass them) |
| Q8 loop | `src/screens/Quest/session/{WeakPointsRow,BattleStrip,LootSheet}.tsx`, `src/game/state/activePlan.ts` | `FocusView.tsx` (mount row + strip), `StreakStore.tsx` (`stopTimer` returns the session; `anyModalOpen`), `useStopTimer.ts` |
| Q9 ceremonies | `src/domain/game/ceremonies.ts`, `src/game/ceremonies/{host.tsx,marks.ts,gate.ts}`, `src/screens/Quest/ceremonies/*` | `App.tsx` (root host), `CelebrationHost.tsx` (waits for ceremonies) |
| Q10 character | `src/screens/Quest/sheets/CharacterSheet.tsx`, `src/game/render/Avatar.tsx` | — |
| Q11 Sage | `worker/*`, `src/services/sage.ts`, `src/domain/game/sageFallback.ts` + tests | `.env.example` |
| Q12 A/V/settings | `src/game/audio.ts`, `src/game/haptics.ts`, settings UI in Scribe | — |
| Q13 polish | `docs/quest/README.md`, `src/game/enabled.ts`, edge tests, PR | `App.tsx`, `TabBar.tsx` (kill switch) |

---

## Assumptions

1. **Ids are `text`, not `uuid`.** Existing tables use client string ids (`'s'+end`, `'h'+Date.now()`), and links point at
   sessions and habits. `items.id`, `items.habit_id`, `links.from_id` and `links.to_id` are therefore `text`.
2. **`links` has `updated_at`.** The shared trigger and last-write-wins need it (the spec omitted it).
3. **Missing 006 tables never stall sync.** Push and pull of `items`/`links` treat "relation does not exist" as
   *unavailable* and skip those tables only. The Quest tab shows a friendly empty state while the flag says unavailable.
   It stays unavailable until the first pull settles, and the last known value is persisted. Quest writes are not queued
   while unavailable.
4. **Timezone** follows the app's device-local convention (`dkey`). `deriveGameState` takes an injectable `tz`
   (`dayKey(ms)`, `hour(ms)`) so tests can simulate zones. Travelling re-buckets days by the device's current zone, as
   Stats does.
5. **Biome 2 twist uses the fallback.** Pauses aren't tracked, so sessions of 25+ unbroken minutes deal ×1.2. "Unbroken"
   is every timer session: pauses are folded into the duration, so all qualify.
6. **Weak points are picked in the focus view**, just after start (see Session loop). One tap to start is unchanged.
7. **Existing notes:** `session.notes` prefills the Loot sheet's line. The notes UI (edit sheet) is untouched, and the
   chronicle entry is a separate `log` item, so nothing is migrated.
8. **Worker vs CLAUDE.md.** CLAUDE.md says Supabase is the only backend. The spec explicitly asks for a Cloudflare Worker,
   not deployed. It's built isolated in `worker/`, AI is off by default, and the app runs fully on the rule-based fallback.
   The conflict is flagged at the top of the PR so the owner can drop `worker/` in one step.
9. **Lint:** the repo has no lint setup. Adding repo-wide ESLint would fail on existing code and is out of scope.
   Typecheck, tests and an `expo export` bundle are the gates.
10. **Web:** Skia needs CanvasKit on web. The Quest tab and battle strip load Skia lazily, and on web CanvasKit comes from the
    jsDelivr CDN pinned to the installed version (a friendly empty state appears if it can't load). Web start-up never
    imports Skia.
11. **Art:** `assets/game/raw/` is empty, so the placeholder generator is the primary art path and its atlases are
    committed. Raw packs are picked up automatically when present (mapping file). `sharp` is a devDependency only.
12. **Journey start:** the onboarding cutscene writes `quest_meta.startedAt`. Before that the journey is at the Forest start,
    while level/XP/skills already count full history ("you're already a Knight").
13. **Crit timing:** crit damage and all chest bonuses count only once claimed. Base damage counts immediately.
14. **Day cap** is per local day across all habits, in session start order. A session's effective minutes are its share of the
    day's 100% / 50% / 0% bands.
15. **Boss HP** uses `Σ weeklyTargetMin` of active habits *now* (not at fight time). Journey progress is floored by stored
    achievements, so a target change can never un-defeat a boss.
16. **Ascension:** loop `n` (0-based) multiplies boss HP by `1.2^n` and uses the night palette. A star pip per loop shows
    on the avatar.
17. **Rank-gated cosmetics** unlock at a rank's first level; the shop shows them locked (dimmed with a small lock) until then.
18. **Streak freeze** purchases count for the calendar month they were bought in (`props.month`), max 2 per month.
19. **AI cache** is per device per day (AsyncStorage), keyed by endpoint and an input hash.
20. **Chest weak points.** The Loot sheet offers the weak points planned for that session. When none were planned (a chest
    from camp, or a session started without choosing), it offers the habit's top three open ones instead.
21. **Credits count the journey only** (sessions after `startedAt`). XP, levels and skills count all history, but credits
    for years of history would empty the shop on day one.
22. **Chests exist only for journey sessions.** An existing user doesn't start with thousands of chests.
23. **The Burnout Drake "can't be ground down"** means it takes at most a third of its HP per local day (at least three
    days). Days over 240 effective minutes also lose the ×1.3 day bonus.
24. **Only qualifying sessions (10+ min) fill the day's 100% / 50% bands**, in start order. A session counts on the day
    it started.
25. **Ceremonies are primed** (superseded by the revised Q9: see 34, 35 and 37). A device that first sees a
    started journey seeds high-water marks from the current state and plays nothing.
26. **The derived game is memoised on data only.** Chest freshness, the only clock-dependent part, is a separate
    selector, so a ticking store never re-derives.
27. **Welcome credits (A1).** `WELCOME_CREDITS = 50` is part of the balance once `startedAt` is set (`credits.welcome`),
    not a stored grant. Chest claims on sessions before `startedAt` are ignored entirely (no task or reflection XP,
    no crits), so only journey sessions have chests at all.
28. **Gear slots keep their stored names (Q10).** The spec's `head / back / hand / companion / camp` map to the shipped
    keys: `helmet` = head, `cloak` and `banner` = back (both may be worn; banner behind cloak), `weapon` = hand;
    companion and campfire stay top-level on `quest_meta`. Renaming synced keys would silently unequip everyone
    (`parseProps` drops unknown slots). The sheet shows six tiles. `minTier` became `rankRequired` (code only).
29. **One avatar, two forms.** `<Avatar>` (its own canvas: HUD, character sheet, ceremonies) and `<AvatarSprite>`
    (inside the map's canvas, driven by shared values) both resolve layers with `resolveAvatarLayers`. Cheer is a hop
    on the idle frame; wave adds a raised-arm layer (`avatar.wave`). Owned items above the current rank (a rebalance,
    another build) show a padlock and can't be worn.
30. **Sage day cache uses UTC dates.** The worker's rate limit also resets on
    UTC dates; this keeps cache and rate-limit boundaries aligned across travel.
    The cache key hashes the request body so chronicle text is not in keys.
31. **Worker configuration stays isolated.** `worker/` has its own dependencies
    and TypeScript check; the Expo tsconfig excludes it. The worker is not
    deployed in this branch. Live AI calls require owner-provided Supabase JWT
    verification config, Anthropic secret and KV namespace.
32. **Quest sound files.** The licensed primary pack is absent. The existing
    tap file supplies `ui_tap`; all other SFX IDs and biome music are silent
    no-ops until licensed files are added. Controls still persist locally.
33. **Device preferences.** Quest SFX, music and haptics extend the existing
    local `DevicePrefs`; motion uses its existing local system/on/off control.
    Legacy synced Quest audio and motion fields remain parseable but no longer
    drive feedback. Synced settings retain battle strip, AI and NPC names.
34. **Boss ceremonies wait for the achievement item.** The pure game state
    exposes recorded boss refs separately from derived defeats. The watcher
    writes deterministic boss achievements locally even while offline; sync
    merges their IDs later. Ceremony marks seed silently after the initial
    sync settles, and new boss events play after the achievement is recorded.
35. **Old ceremony marks are ignored.** The previous map-only local `played`
    list could miss an event on a second device. The new per-user key
    `adet.quest.ceremonyMarks.v1` seeds current history on first load instead.

36. **The AI flag keeps its shipped key.** Part 2 calls it
    `quest_meta.settings.aiSage`; the synced key has been `settings.ai` since
    Q7. Renaming it would silently turn AI off for anyone who enabled it, so
    the code keeps `ai` and `enableSage()` is the only way to set it.
37. **One full-screen moment at a time.** Ceremonies wait for any open app
    sheet, the Loot sheet, Quest sheets and panels, the intro replay and a
    queued celebration; celebrations wait while a full-screen ceremony plays.
    The level-up toast is small and doesn't hold celebrations back.
38. **Boss lines are asked for, not pushed.** The revised Q9 has four event
    kinds and no boss intro. A boss's three pre-fight lines are spoken one per
    tap on the boss you face (the Hollow Echo adds the player's own words),
    and its defeat line shows as it dissolves.
39. **The spec lives in the repo now.** `QUEST_PROMPT.md` and
    `QUEST_PROMPT_PART2.md` were never committed; their text was recovered
    from the Codex session into `docs/quest/spec/`.

40. **The kill switch hides, it doesn't erase.** With `EXPO_PUBLIC_QUEST_ENABLED=false`, items and links keep
    syncing so nothing is lost, and freezes bought from the Merchant keep counting in the streak: removing them
    would retroactively break a streak.

41. **PR #21 was already merged.** This pass was committed on `feat/quest` (as D2
    asked) from a worktree branch, `quest-polish`, pushed to `origin/feat/quest`,
    and goes to `main` as a new PR; the merged #21 is left as it was.
42. **The Sage is an Edge Function (D1).** JWT verification uses Supabase Auth
    (`auth.getUser`), which works for HS256 and asymmetric projects alike. The
    daily limit is a server-only table with an atomic `sage_take_call()` that
    only the service role may call (migration 007). CLAUDE.md's "no server code
    beyond SQL migrations" still literally conflicts with any Edge Function: this
    is flagged for the owner, and CLAUDE.md is not edited.
43. **"Zero generated placeholders" is read as "zero unlisted stand-ins".**
    322 ids still ship Adet's original stand-in art, because removing them would
    leave the game with invisible bosses and NPCs. Each is on
    `assets/game/needs-art.json` with its reason, the build refuses any other
    stand-in, and nothing the app bundles imports the generator. It is not "all
    art is real", and the PR says so.
44. **Consistency over coverage.** A category is replaced only when it can be
    covered consistently across all 7 biomes. Ground and path (Tiny Town grass
    and dirt, tone-remapped per biome) and the chest pass. Tiny Dungeon's floor
    tiles showed a grid and were dropped. Icons stay stand-ins as a whole set
    (half would mix styles in one row). Trees and decor stay because of
    proportion (16 px trees beside 26 px people).
45. **One P9 commit, not one per biome.** The ground mapping is one rule applied
    to all seven biomes, reviewed together in one before/after sheet; splitting
    it would have needed throwaway intermediate allowlist reasons.
46. **Sounds chosen by measurement, not by ear.** Duration, spectral centroid
    (soft rather than shrill), and melodic contour (rising reads as success).
    Loudness is evened to a −22 dBFS mean with peaks capped at −4, a little
    under the app's own sounds. The device checklist asks the owner to listen.
47. **The pixel font's legibility is left to the owner.** In Pixelify Sans a "5"
    can read as "S" and a bold "C" as "O". Swapping fonts is a design decision.
    Its broken "fi" ligature (which drew "first" as "Arst") was a bug and is off
    everywhere.
48. **A scene hidden by a session waits its turn.** A ceremony interrupted by a
    session starting is hidden, not dropped (a lint-pass change). It comes back
    only when no session, Loot sheet or other sheet is up (`ceremonyVisible`).
49. **Lint scope.** Expo's rules are errors in Quest code and warnings
    elsewhere, so no unrelated file changed. One inline disable remains, in the
    ceremony host's transition into "playing" (it records a mark exactly once).
50. **Quest works on web.** Checked in headless Chromium: CanvasKit loads when the
    Quest tab first opens. A test keeps Skia out of native and web start-up.

## Polish pass results

| Check (clean worktree) | Result |
|---|---|
| Typecheck (app; Sage function via `deno check`) | pass; pass |
| Lint | 0 errors (Quest code error-level; 84 warnings elsewhere, unchanged files) |
| Tests | 444 pass, 0 fail (the SQL kit on PGlite included) |
| `npm run check:size` | within every budget (JS 5,125,322 B, +10 KB; images 66 KB; audio 53 KB) |
| Exports | iOS and web, Quest on and off; `npx expo start` serves the iOS bundle (HTTP 200) |
| Fresh clone → fetch → assets → audio → report | byte-identical to the committed outputs |
| Release bundle | no Playground/QA strings; no `ANTHROPIC`, `sk-ant` or `service_role` |

### Remaining issues

- **Art:** 322 stand-ins wait for a pack with 64 px bosses, animated mobs, the owl,
  fox and tortoise, critters and layered characters. Ninja Adventure is the
  likely one and needs a browser download (`docs/quest/OWNER_ACTIONS.md`).
- **Music:** none. No CC0 loop pack is downloadable without a browser.
- **Plainer ground:** the astral citadel's ground and the iron kingdom's path are
  plainer than their stand-ins. The device art review decides.
- **Font legibility** (47): owner's call.
- **PR #22 and this PR** both change `package.json` and `package-lock.json`.
  Merge #22 first, then regenerate this branch's lockfile (`npm install`), or the
  reverse.
- **Not verified here:** anything on a physical iPhone; how the sounds sound; the
  Edge Function with a real JWT and the Anthropic API; iOS ligature rendering (the
  fix is verified on web).

## Risks

- **Skia Atlas performance / memory on older iPhones.** Mitigations: only visible biomes and their neighbours are mounted;
  batched `Atlas` draws; a single frame clock, paused when unfocused or backgrounded; a 30 fps fallback.
- **Sync conflict on `quest_meta`** (two devices editing avatar/settings). Last-write-wins is accepted.
- **Balance** feels off: every constant is in `balance.ts` behind `BALANCE_VERSION`, and achievements floor progress.
- **Bundle size:** atlases are PNG assets (not JS), and content is data. The delta is reported in the PR.
- **Expo Go:** only Skia, Reanimated, expo-audio, expo-haptics and expo-font are used. All are in Expo Go SDK 57.
