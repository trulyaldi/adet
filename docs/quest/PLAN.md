# Quest Mode — implementation plan

## Handoff audit — 2026-09-29

Status is based on code and checks, not commit titles. The Q0–Q8 implementation
is present; physical-device acceptance is part of Q13.

| Ticket | Status | Evidence |
|---|---|---|
| Q0 | done | This plan records architecture, files, assumptions and risks. |
| Q1 | done | `006_quest.sql`, typed item/link ops, sync adapters and tests exist. |
| Q2 | done | `deriveGameState` is real; `derive.test.ts` includes a 5,000-session benchmark. |
| Q3 | done | Atlas generator, logical manifest, committed atlases and credits exist; manifest test passes. |
| Q4 | done | Skia render kit and dev playground exist; web export bundles. |
| Q5 | done | Seven biome definitions and node/asset tests exist. |
| Q6 | done | Quest tab, map reveal, HUD, badge and map model tests exist. |
| Q7 | done | Board, Merchant, Scribe and rule-based Sage sheets exist. |
| Q8 | done | Weak points, battle strip and Loot sheet are wired into the session flow. |
| Q9 | partial | Map-only `CeremonyHost` exists; revised pure detection, root host and Ascension are absent. |
| Q10 | done | Layered Avatar, gear eligibility, sheet and tests pass; 3×/4× previews were inspected without clipping. |
| Q11 | done | Worker, authenticated opt-in client, local fallback, cache and validation tests pass typecheck. |
| Q12 | partial | Audio is a silent placeholder and SettingsPanel is text; haptics lack timer gating. |
| Q13 | not started | No kill switch or Quest README; device QA and PR checklist remain. |
| R | done | Branch/history/code audited; typecheck and 39 test files pass, web export bundles; no lint script exists. |
| A1 | done | Welcome credits and journey-only chests/credits have tests. |
| A2 | done | Only boss defeats are written; legacy achievement kinds are deprecated. |
| A3 | done | `useQuestStarted()` gates Loot, strip and weak points; badge invites onboarding. |
| A4 | partial | Loot calls `ceremonyHost.evaluate()`, but no component registers an evaluator. |

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
        purchases, quest_meta             └─▶ QuestWatcher (after sync settles):
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
| Q9 ceremonies | `src/screens/Quest/ceremonies/*`, `src/game/state/played.ts` | — |
| Q10 character | `src/screens/Quest/sheets/CharacterSheet.tsx`, `src/game/render/Avatar.tsx` | — |
| Q11 Sage | `worker/*`, `src/services/sage.ts`, `src/domain/game/sageFallback.ts` + tests | `.env.example` |
| Q12 A/V/settings | `src/game/audio.ts`, `src/game/haptics.ts`, settings UI in Scribe | — |
| Q13 polish | `docs/quest/README.md`, PR | — |

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
25. **Ceremonies are primed**, like `badgesPrimed`. A device that first sees a started journey records everything
    reached so far as played. Level-ups count from the last level shown, so history never replays.
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

## Risks

- **Skia Atlas performance / memory on older iPhones.** Mitigations: only visible biomes and their neighbours are mounted;
  batched `Atlas` draws; a single frame clock, paused when unfocused or backgrounded; a 30 fps fallback.
- **Sync conflict on `quest_meta`** (two devices editing avatar/settings). Last-write-wins is accepted.
- **Balance** feels off: every constant is in `balance.ts` behind `BALANCE_VERSION`, and achievements floor progress.
- **Bundle size:** atlases are PNG assets (not JS), and content is data. The delta is reported in the PR.
- **Expo Go:** only Skia, Reanimated, expo-audio, expo-haptics and expo-font are used. All are in Expo Go SDK 57.
